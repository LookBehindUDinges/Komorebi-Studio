'use strict';

window.KomorebiActivities = (() => {
  const CATEGORY_KEY = 'komorebi-practice-categories-v1', MIGRATION_KEY = 'komorebi-activities-cloud-migrated-v1';
  const defaults = [
    { id: 'japanese', name: 'Japanese', parentId: null, active: true, color: '#db5b47' },
    { id: 'japanese-reading', name: 'Reading', parentId: 'japanese', active: true, color: '#db5b47' },
    { id: 'japanese-writing', name: 'Writing', parentId: 'japanese', active: true, color: '#c84a3b' },
    { id: 'music', name: 'Music', parentId: null, active: true, color: '#356486' },
    { id: 'music-guitar', name: 'Guitar', parentId: 'music', active: true, color: '#356486' },
    { id: 'music-recording', name: 'Recording', parentId: 'music', active: true, color: '#294f6b' }
  ];
  const slug = value => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';
  const listeners = new Set();
  let client = null, user = null, items = readLocal();
  function readLocal() {
    try {
      const stored = JSON.parse(localStorage.getItem(CATEGORY_KEY) || 'null');
      if (Array.isArray(stored) && stored.length) return stored;
    } catch {}
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(defaults));
    return defaults.map(item => ({ ...item }));
  }
  const notify = () => listeners.forEach(listener => listener(items));
  const subscribe = listener => { listeners.add(listener); listener(items); return () => listeners.delete(listener); };
  function write(next) { items = next; localStorage.setItem(CATEGORY_KEY, JSON.stringify(items)); notify(); }
  function read() { return items; }
  function toCloud(item) { return { user_id: user.id, id: item.id, name: item.name, parent_id: item.parentId, color: item.color, active: item.active, updated_at: new Date().toISOString() }; }
  function fromCloud(row) { return { id: row.id, name: row.name, parentId: row.parent_id, active: row.active, color: row.color }; }
  function pushCloud(rows) { if (!client || !user || !rows.length) return; client.from('activities').upsert(rows.map(toCloud), { onConflict: 'user_id,id' }).then(result => { if (result.error) console.warn('Activity sync failed', result.error); }); }
  function uniqueId(name, list) { const base = slug(name); let id = base, number = 2; while (list.some(item => item.id === id)) id = `${base}-${number++}`; return id; }
  function add(name, parentId = null) {
    const parent = parentId ? items.find(item => item.id === parentId) : null;
    const item = { id: uniqueId(name, items), name: name.trim(), parentId: parent?.id || null, active: true, color: parent?.color || '#52836e' };
    write([...items, item]);
    pushCloud([item]);
    return item;
  }
  function setActive(id, active) {
    const affected = new Set(descendants(id, items));
    const next = items.map(item => affected.has(item.id) ? { ...item, active: Boolean(active) } : item);
    write(next);
    pushCloud(next.filter(item => affected.has(item.id)));
  }
  function descendants(id, list = items) { const ids = [id]; for (let index = 0; index < ids.length; index += 1) list.filter(item => item.parentId === ids[index]).forEach(item => ids.push(item.id)); return ids; }
  function activityId(entry) { return entry.activityId || entry.kind || 'uncategorized'; }
  function label(id, list = items) { const item = list.find(entry => entry.id === id); if (!item) return id === 'uncategorized' ? 'Uncategorized' : id; const parent = item.parentId && list.find(entry => entry.id === item.parentId); return parent ? `${parent.name} → ${item.name}` : item.name; }
  function currentLoggable(list = items) { const activeThroughParents = item => { let current = item; while (current) { if (!current.active) return false; current = current.parentId ? list.find(entry => entry.id === current.parentId) : null; } return true; }; return list.filter(item => activeThroughParents(item) && (!list.some(child => child.parentId === item.id && activeThroughParents(child)) || item.parentId)); }
  async function fetchCloud() {
    if (!client || !user || !navigator.onLine) return false;
    const result = await client.from('activities').select('id,name,parent_id,color,active').order('created_at', { ascending: true });
    if (result.error) return false;
    if (result.data.length) write(result.data.map(fromCloud));
    return true;
  }
  async function migrateLocal() {
    if (!client || !user || localStorage.getItem(MIGRATION_KEY) === user.id) return;
    pushCloud(items);
    localStorage.setItem(MIGRATION_KEY, user.id);
  }
  async function initialize() {
    const cfg = window.KOMOREBI_CONFIG || {}, library = window.supabase || await (window.KOMOREBI_SUPABASE_READY || Promise.resolve(null));
    if (!library || !cfg.supabaseUrl || !cfg.supabasePublishableKey) return;
    try {
      client = library.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const sessionResult = await client.auth.getSession(); user = sessionResult.data?.session?.user || null;
      if (!user || !navigator.onLine) return;
      const reachable = await fetchCloud();
      if (!reachable) return;
      await migrateLocal();
      client.auth.onAuthStateChange((_event, session) => { user = session?.user || null; if (user) fetchCloud().then(migrateLocal); });
    } catch {}
  }
  const ready = initialize();
  return { CATEGORY_KEY, ready, subscribe, read, write, add, setActive, descendants, activityId, label, currentLoggable };
})();
