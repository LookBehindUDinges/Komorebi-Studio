'use strict';

window.KomorebiPractice = (() => {
  const LOG_KEY = 'komorebi-practice-log-v1', GOAL_KEY = 'komorebi-weekly-goals-v1', MIGRATION_KEY = 'komorebi-practice-cloud-migrated-v1', DELETE_KEY = 'komorebi-practice-delete-queue-v1';
  const listeners = new Set();
  let client = null, user = null, logs = readArray(LOG_KEY), goals = readArray(GOAL_KEY), status = 'loading', message = 'Loading practice history…';
  const notify = () => listeners.forEach(listener => listener({ logs, goals, status, message, user }));
  const saveCache = () => { localStorage.setItem(LOG_KEY, JSON.stringify(logs)); localStorage.setItem(GOAL_KEY, JSON.stringify(goals)); };
  function readArray(key) { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
  function categoryParts(entry) {
    const items = window.KomorebiActivities?.read?.() || [], id = entry.activityId || entry.kind, item = items.find(value => value.id === id), parent = item?.parentId && items.find(value => value.id === item.parentId);
    return { activity: parent?.name || item?.name || entry.activity || id || 'Uncategorized', subcategory: parent ? item.name : (entry.subcategory || null) };
  }
  function activityIdFor(activity, subcategory) {
    const items = window.KomorebiActivities?.read?.() || [], parent = items.find(item => !item.parentId && item.name.toLowerCase() === String(activity).toLowerCase()), child = subcategory && items.find(item => item.parentId === parent?.id && item.name.toLowerCase() === String(subcategory).toLowerCase());
    if (child) return child.id;
    if (parent) return parent.id;
    if (window.KomorebiActivities && activity) { const createdParent = window.KomorebiActivities.add(activity); return subcategory ? window.KomorebiActivities.add(subcategory, createdParent.id).id : createdParent.id; }
    return String(activity || 'uncategorized').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  function fromCloud(row) { return { id: row.id, userId: row.user_id, activity: row.activity, subcategory: row.subcategory, activityId: activityIdFor(row.activity, row.subcategory), minutes: row.minutes, logged_at: row.logged_at, at: row.logged_at, day: new Date(row.logged_at).toLocaleDateString('en-CA'), notes: row.notes || '', cloudSynced: true }; }
  function toCloud(entry) { const parts = categoryParts(entry), loggedAt = entry.logged_at || entry.at || new Date(`${entry.day}T12:00:00`).toISOString(); return { id: entry.id || crypto.randomUUID(), user_id: user.id, activity: parts.activity, subcategory: parts.subcategory, minutes: Number(entry.minutes), logged_at: loggedAt, notes: entry.notes?.trim() || null, updated_at: new Date().toISOString() }; }
  function setState(nextStatus, nextMessage) { status = nextStatus; message = nextMessage; notify(); }
  async function fetchCloud() {
    if (!client || !user || !navigator.onLine) return false;
    const result = await client.from('practice_logs').select('id,user_id,activity,subcategory,minutes,logged_at,notes').order('logged_at', { ascending: true });
    if (result.error) return false;
    logs = (result.data || []).map(fromCloud); saveCache();
    const goalResult = await client.from('weekly_goals').select('activity,target_minutes').order('activity');
    if (!goalResult.error) { goals = (goalResult.data || []).map(item => ({ activity: item.activity, targetMinutes: item.target_minutes, cloudSynced: true })); saveCache(); }
    return true;
  }
  async function migrateLocal(pendingLogs = readArray(LOG_KEY).filter(item => !item.cloudSynced)) {
    if (!client || !user || localStorage.getItem(MIGRATION_KEY) === user.id) return;
    if (pendingLogs.length) { const rows = pendingLogs.map(toCloud); const result = await client.from('practice_logs').upsert(rows, { onConflict: 'id' }); if (result.error) throw result.error; }
    localStorage.setItem(MIGRATION_KEY, user.id);
  }
  async function flushDeletes() { const ids = readArray(DELETE_KEY); if (!ids.length || !client || !user) return; const result = await client.from('practice_logs').delete().in('id', ids); if (!result.error) localStorage.removeItem(DELETE_KEY); }
  async function migrateGoals(pendingGoals = goals.filter(goal => !goal.cloudSynced)) { if (!pendingGoals.length || !client || !user) return; const rows = pendingGoals.map(goal => ({ user_id: user.id, activity: goal.activity, target_minutes: Number(goal.targetMinutes), updated_at: new Date().toISOString() })); const result = await client.from('weekly_goals').upsert(rows, { onConflict: 'user_id,activity' }); if (result.error) throw result.error; }
  async function initialize() {
    notify();
    const cfg = window.KOMOREBI_CONFIG || {}, library = window.supabase || await (window.KOMOREBI_SUPABASE_READY || Promise.resolve(null));
    if (!library || !cfg.supabaseUrl || !cfg.supabasePublishableKey) { setState('offline', 'Saved on this device'); return; }
    try {
      client = window.getKomorebiSupabaseClient ? await window.getKomorebiSupabaseClient() : library.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const sessionResult = await client.auth.getSession(); user = sessionResult.data?.session?.user || null;
      if (!user) { setState('signed-out', 'Sign in from the vocabulary page to sync'); return; }
      if (!navigator.onLine) { setState('offline', 'Offline · showing cached history'); return; }
      const pendingBeforeCloudRead = logs.filter(item => !item.cloudSynced), pendingGoalsBeforeCloudRead = goals.filter(goal => !goal.cloudSynced);
      const protectedReadWorks = await fetchCloud();
      if (!protectedReadWorks) { setState('offline', logs.length ? 'Cloud unavailable · showing cached history' : 'Run the protected Supabase migration to enable sync'); return; }
      await migrateLocal(pendingBeforeCloudRead); await migrateGoals(pendingGoalsBeforeCloudRead); await flushDeletes(); await fetchCloud(); setState('online', 'Synced privately');
      client.auth.onAuthStateChange((_event, session) => { user = session?.user || null; if (user) refresh(); else setState('signed-out', 'Sign in to sync'); });
    } catch { setState('offline', logs.length ? 'Offline · showing cached history' : 'Cloud sync is unavailable'); }
  }
  async function refresh() { setState('loading', 'Updating practice history…'); const pending = logs.filter(item => !item.cloudSynced), pendingGoals = goals.filter(goal => !goal.cloudSynced); if (await fetchCloud()) { try { await migrateLocal(pending); await migrateGoals(pendingGoals); await flushDeletes(); await fetchCloud(); setState('online', 'Synced privately'); } catch { setState('offline', 'Saved locally · sync will retry'); } } else setState('offline', 'Offline · showing cached history'); }
  async function createLog(entry) { const local = { ...entry, id: entry.id || crypto.randomUUID(), at: entry.logged_at || entry.at || new Date().toISOString(), logged_at: entry.logged_at || entry.at || new Date().toISOString(), cloudSynced: false }; logs = [...logs, local]; saveCache(); notify(); if (status === 'online' && client && user) { const row = toCloud(local), result = await client.from('practice_logs').insert(row).select().single(); if (result.error) { setState('offline', 'Saved locally · sync will retry'); return local; } logs = logs.map(item => item.id === local.id ? fromCloud(result.data) : item); saveCache(); notify(); } return local; }
  async function updateLog(id, changes) { const previous = logs.find(item => item.id === id), next = { ...previous, ...changes, cloudSynced: false }; logs = logs.map(item => item.id === id ? next : item); saveCache(); notify(); if (status === 'online' && client && user) { const row = toCloud(next), result = await client.from('practice_logs').update({ activity: row.activity, subcategory: row.subcategory, minutes: row.minutes, logged_at: row.logged_at, notes: row.notes, updated_at: row.updated_at }).eq('id', id).select().single(); if (!result.error) { logs = logs.map(item => item.id === id ? fromCloud(result.data) : item); saveCache(); notify(); } } return next; }
  async function deleteLog(id) { logs = logs.filter(item => item.id !== id); saveCache(); notify(); if (status === 'online' && client && user) { const result = await client.from('practice_logs').delete().eq('id', id); if (!result.error) return; } const queue = readArray(DELETE_KEY); if (!queue.includes(id)) queue.push(id); localStorage.setItem(DELETE_KEY, JSON.stringify(queue)); setState('offline', 'Change saved locally · sync will retry'); }
  async function setGoal(activity, targetMinutes) { const next = { activity, targetMinutes: Number(targetMinutes), cloudSynced: false }; goals = [...goals.filter(goal => goal.activity !== activity), next]; saveCache(); notify(); if (status === 'online' && client && user) { const result = await client.from('weekly_goals').upsert({ user_id: user.id, activity, target_minutes: next.targetMinutes, updated_at: new Date().toISOString() }, { onConflict: 'user_id,activity' }); if (!result.error) { next.cloudSynced = true; saveCache(); notify(); } } }
  const subscribe = listener => { listeners.add(listener); listener({ logs, goals, status, message, user }); return () => listeners.delete(listener); };
  window.addEventListener('online', refresh); window.addEventListener('offline', () => setState('offline', 'Offline · showing cached history'));
  const ready = initialize();
  return { ready, subscribe, getLogs: () => logs, getGoals: () => goals, getStatus: () => ({ status, message, user }), createLog, updateLog, deleteLog, setGoal, refresh, csvRows: () => logs.map(item => ({ date: item.day || new Date(item.logged_at).toLocaleDateString('en-CA'), ...categoryParts(item), minutes: item.minutes, notes: item.notes || '' })) };
})();
