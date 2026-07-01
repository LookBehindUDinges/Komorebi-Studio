'use strict';

const STORAGE_KEYS = {
  vocabulary: 'komorebi-vocabulary-local-v1',
  lessons: 'komorebi-youtube-lessons-v1',
  channelVideos: 'komorebi-channel-videos-v1',
  practice: 'komorebi-practice-log-v1',
  reviews: 'komorebi-japanese-review-v1',
  categories: 'komorebi-practice-categories-v1',
  weeklyGoals: 'komorebi-weekly-goals-v1'
};

const statusEl = document.querySelector('#backupMessage');
const wordCountEl = document.querySelector('#backupWordCount');
const songCountEl = document.querySelector('#backupSongCount');
const videoCountEl = document.querySelector('#backupVideoCount');
const cloudStateEl = document.querySelector('#cloudBackupState');
const backupFileEl = document.querySelector('#backupFile');
const restoreButtonEl = document.querySelector('#restoreBackup');
let selectedBackupFile = null;

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', isError);
}

function deviceData() {
  return {
    vocabulary: readArray(STORAGE_KEYS.vocabulary),
    lessons: readArray(STORAGE_KEYS.lessons),
    channelVideos: readArray(STORAGE_KEYS.channelVideos),
    practice: readArray(STORAGE_KEYS.practice),
    reviews: readObject(STORAGE_KEYS.reviews),
    categories: readArray(STORAGE_KEYS.categories),
    weeklyGoals: readArray(STORAGE_KEYS.weeklyGoals)
  };
}

function updateCounts() {
  const data = deviceData();
  if (wordCountEl) wordCountEl.textContent = String(data.vocabulary.length);
  if (songCountEl) songCountEl.textContent = String(data.lessons.length);
  if (videoCountEl) videoCountEl.textContent = String(data.channelVideos.length);
}

async function cloudVocabulary() {
  try {
    await Promise.race([window.KOMOREBI_SUPABASE_READY || Promise.resolve(false), new Promise(resolve => setTimeout(() => resolve(false), 5000))]);
    if (!window.supabase || !window.KOMOREBI_SUPABASE) return [];
    const client = window.supabase.createClient(window.KOMOREBI_SUPABASE.url, window.KOMOREBI_SUPABASE.anonKey);
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) return [];
    const { data, error } = await client.from('vocabulary').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function createBackup() {
  const local = deviceData();
  const cloud = await cloudVocabulary();
  return {
    format: 'komorebi-studio-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    device: local,
    cloud: { vocabulary: cloud }
  };
}

function filename(extension) {
  return `komorebi-backup-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const valueText = String(value ?? '');
  return /[",\n]/.test(valueText) ? '"' + valueText.replaceAll('"', '""') + '"' : valueText;
}

function vocabularyRows(backup) {
  const localRows = backup.device.vocabulary.map(item => ({ ...item, storage: 'device' }));
  const cloudRows = backup.cloud.vocabulary.map(item => ({ ...item, storage: 'cloud' }));
  return [...localRows, ...cloudRows];
}

async function exportJson() {
  setStatus('Preparing your backup…');
  const backup = await createBackup();
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), filename('json'));
  setStatus('Backup downloaded. Keep that file somewhere safe.');
}

async function exportCsv() {
  setStatus('Preparing vocabulary…');
  const backup = await createBackup();
  const headers = ['storage', 'word', 'reading', 'meaning', 'example', 'translation', 'category', 'notes', 'date_added'];
  const rows = vocabularyRows(backup);
  const csvLines = [headers.join(','), ...rows.map(row => headers.map(key => csvCell(row[key] ?? row[key === 'word' ? 'japanese' : key === 'meaning' ? 'english' : key] ?? '')).join(','))];
  const csv = '\uFEFF' + csvLines.join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename('csv'));
  setStatus(`Vocabulary CSV downloaded (${rows.length} words).`);
}

async function shareBackup() {
  const backup = await createBackup();
  const file = new File([JSON.stringify(backup, null, 2)], filename('json'), { type: 'application/json' });
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    setStatus('Sharing is not available here. Use Download full backup instead.', true);
    return;
  }
  try {
    await navigator.share({ files: [file], title: 'Komorebi Studio backup' });
    setStatus('Backup shared.');
  } catch (error) {
    if (error?.name !== 'AbortError') setStatus('The backup could not be shared. Try downloading it instead.', true);
  }
}

async function importBackup(file) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    setStatus('That file is not a readable JSON backup.', true);
    return;
  }
  if (backup?.format !== 'komorebi-studio-backup' || !backup.device) {
    setStatus('That does not look like a Komorebi Studio backup.', true);
    return;
  }
  const next = {
    vocabulary: Array.isArray(backup.device.vocabulary) ? backup.device.vocabulary : [],
    lessons: Array.isArray(backup.device.lessons) ? backup.device.lessons : [],
    channelVideos: Array.isArray(backup.device.channelVideos) ? backup.device.channelVideos : [],
    practice: Array.isArray(backup.device.practice) ? backup.device.practice : [],
    reviews: backup.device.reviews && typeof backup.device.reviews === 'object' ? backup.device.reviews : {},
    categories: Array.isArray(backup.device.categories) ? backup.device.categories : [],
    weeklyGoals: Array.isArray(backup.device.weeklyGoals) ? backup.device.weeklyGoals : []
  };
  const summary = `${next.vocabulary.length} words, ${next.lessons.length} song links, and ${next.channelVideos.length} channel videos`;
  if (!confirm(`Replace this device's saved data with ${summary}? Cloud vocabulary will not be changed.`)) {
    setStatus('Import cancelled.');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.vocabulary, JSON.stringify(next.vocabulary));
  localStorage.setItem(STORAGE_KEYS.lessons, JSON.stringify(next.lessons));
  localStorage.setItem(STORAGE_KEYS.channelVideos, JSON.stringify(next.channelVideos));
  localStorage.setItem(STORAGE_KEYS.practice, JSON.stringify(next.practice));
  localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(next.reviews));
  if (next.categories.length) localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(next.categories));
  localStorage.setItem(STORAGE_KEYS.weeklyGoals, JSON.stringify(next.weeklyGoals));
  updateCounts();
  setStatus('Backup restored on this device.');
}

document.querySelector('#downloadBackup')?.addEventListener('click', exportJson);
document.querySelector('#downloadVocabCsv')?.addEventListener('click', exportCsv);
const shareButton = document.querySelector('#shareBackup');
if (shareButton && navigator.share && typeof File !== 'undefined') shareButton.hidden = false;
shareButton?.addEventListener('click', shareBackup);
backupFileEl?.addEventListener('change', event => {
  selectedBackupFile = event.target.files?.[0] || null;
  if (restoreButtonEl) restoreButtonEl.disabled = !selectedBackupFile;
  setStatus(selectedBackupFile ? 'Ready to restore ' + selectedBackupFile.name + '.' : 'Choose a backup file first.');
});
restoreButtonEl?.addEventListener('click', async () => {
  if (!selectedBackupFile) return;
  await importBackup(selectedBackupFile);
  selectedBackupFile = null;
  if (backupFileEl) backupFileEl.value = '';
  restoreButtonEl.disabled = true;
});

updateCounts();
