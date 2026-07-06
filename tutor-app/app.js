'use strict';
const MODEL_KEY = 'komorebi-tutor-model';
const EXPANDED_KEY = 'komorebi-tutor-expanded-projects';
const SPEAK_KEY = 'komorebi-tutor-speak';
const VOICE_EN_KEY = 'komorebi-tutor-voice-en';
const VOICE_JA_KEY = 'komorebi-tutor-voice-ja';

const shellEl = document.querySelector('.tutor-shell');
const sidebarToggle = document.querySelector('#tutorSidebarToggle');
const sidebarBackdrop = document.querySelector('#tutorSidebarBackdrop');
const chatListEl = document.querySelector('#tutorChatList');
const newChatBtn = document.querySelector('#tutorNewChat');
const newProjectBtn = document.querySelector('#tutorNewProject');

const chatTitleEl = document.querySelector('#tutorChatTitle');
const chatProjectSelect = document.querySelector('#tutorChatProject');
const modelSelect = document.querySelector('#tutorModel');
const deleteChatBtn = document.querySelector('#tutorDeleteChat');

const chatEl = document.querySelector('#tutorChat');
const formEl = document.querySelector('#tutorForm');
const inputEl = document.querySelector('#tutorInput');
const sendBtn = document.querySelector('#tutorSend');
const micBtn = document.querySelector('#tutorMic');
const speakToggle = document.querySelector('#tutorSpeakToggle');
const statusEl = document.querySelector('#tutorStatus');

let projects = [];
let chatSummaries = [];
let currentChat = null;
let expandedProjects = new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || '[]'));

function saveExpandedProjects() {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedProjects]));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

const KANJI_RANGE = '一-鿿々';
const HIRAGANA_RANGE = '぀-ゟ';
const FURIGANA_PATTERN = new RegExp('([' + KANJI_RANGE + ']+)\\(([' + HIRAGANA_RANGE + ']+)\\)', 'g');

function toRuby(text) {
  return escapeHtml(text).replace(FURIGANA_PATTERN, '<ruby>$1<rt>$2</rt></ruby>').replace(/\n/g, '<br>');
}

function stripThinkTags(text) {
  // Some models (e.g. qwen3:4b) omit the opening <think> tag in the returned
  // content but still emit the closing tag, so match on the close alone.
  const str = String(text ?? '');
  const closeIdx = str.indexOf('</think>');
  if (closeIdx === -1) return str.trim();
  return str.slice(closeIdx + '</think>'.length).trim();
}

function textForSpeech(text) {
  return String(text ?? '')
    .replace(FURIGANA_PATTERN, '$1')
    .replace(/[*_#`]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .trim();
}

let speakKeepAliveTimer = null;

const JA_CHAR = /[぀-ヿ一-鿿々ー]/;
const EN_CHAR = /[A-Za-z]/;

// Split text into runs of Japanese vs. non-Japanese so each can be spoken by
// a voice that can actually pronounce it. Neutral characters (spaces, digits,
// punctuation) stick to whichever run they're adjacent to.
function splitSpeechSegments(text) {
  const segments = [];
  let lang = null;
  let buffer = '';
  for (const ch of text) {
    const det = JA_CHAR.test(ch) ? 'ja' : (EN_CHAR.test(ch) ? 'en' : null);
    if (det && lang && det !== lang) {
      segments.push({ lang, text: buffer });
      buffer = '';
    }
    if (det) lang = det;
    buffer += ch;
  }
  if (buffer.trim()) segments.push({ lang: lang || 'en', text: buffer });
  return segments.filter(s => s.text.trim());
}

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  const wantName = localStorage.getItem(lang === 'ja' ? VOICE_JA_KEY : VOICE_EN_KEY);
  const prefix = lang === 'ja' ? 'ja' : 'en';
  const candidates = voices.filter(v => v.lang.toLowerCase().startsWith(prefix));
  if (wantName) {
    const chosen = candidates.find(v => v.name === wantName);
    if (chosen) return chosen;
  }
  return candidates[0] || null;
}

function speakText(text, options = {}) {
  const { force = false, onDone = null } = options;
  const finish = () => { if (onDone) onDone(); };
  if (!force && speakToggle.getAttribute('aria-pressed') !== 'true') return finish();
  if (!('speechSynthesis' in window)) return finish();
  const clean = textForSpeech(text);
  if (!clean) return finish();

  let started = false;
  const doSpeak = () => {
    if (started) return;
    started = true;
    // Chrome has a long-standing bug where cancel() immediately followed by
    // speak() silently drops the utterance; a short delay avoids it.
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const segments = splitSpeechSegments(clean);
      if (!segments.length) return finish();
      let remaining = segments.length;
      let done = false;
      const segmentDone = () => {
        remaining -= 1;
        if (remaining <= 0 && !done) {
          done = true;
          clearInterval(speakKeepAliveTimer);
          finish();
        }
      };
      for (const segment of segments) {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.lang === 'ja' ? 'ja-JP' : 'en-US';
        const voice = pickVoice(segment.lang);
        if (voice) utterance.voice = voice;
        utterance.addEventListener('start', () => {
          clearInterval(speakKeepAliveTimer);
          // Chrome also stops speaking mid-utterance after ~15s unless nudged.
          speakKeepAliveTimer = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
              clearInterval(speakKeepAliveTimer);
              return;
            }
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }, 5000);
        });
        utterance.addEventListener('end', segmentDone);
        utterance.addEventListener('error', event => {
          console.error('Speech synthesis error:', event.error);
          segmentDone();
        });
        window.speechSynthesis.speak(utterance);
      }
    }, 60);
  };

  if (window.speechSynthesis.getVoices().length) {
    doSpeak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
    setTimeout(doSpeak, 300);
  }
}

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`Server responded ${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

function autoTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New chat';
  const trimmed = firstUser.content.trim();
  return trimmed.length > 48 ? trimmed.slice(0, 48) + '…' : trimmed;
}

// ---- rendering ----

function chatItemHtml(chat) {
  const active = currentChat && currentChat.id === chat.id ? ' active' : '';
  return `<button type="button" class="tutor-chat-item${active}" data-chat-id="${chat.id}">${escapeHtml(chat.title || 'New chat')}</button>`;
}

function renderSidebar() {
  if (!projects.length && !chatSummaries.length) {
    chatListEl.innerHTML = '<p class="tutor-empty-list">No saved chats yet.</p>';
    return;
  }
  const byProject = new Map();
  const uncategorized = [];
  for (const chat of chatSummaries) {
    if (chat.projectId) {
      if (!byProject.has(chat.projectId)) byProject.set(chat.projectId, []);
      byProject.get(chat.projectId).push(chat);
    } else {
      uncategorized.push(chat);
    }
  }
  let html = '';
  for (const project of projects) {
    const chats = byProject.get(project.id) || [];
    const open = expandedProjects.has(project.id);
    html += `<div class="tutor-project-group${open ? ' open' : ''}">` +
      `<button type="button" class="tutor-project-head" data-toggle-project="${project.id}">` +
      `<span class="tutor-project-chevron">▸</span>` +
      `<span class="tutor-project-icon">📁</span>` +
      `<span class="tutor-project-name">${escapeHtml(project.name)}</span>` +
      `<span class="tutor-project-delete" data-delete-project="${project.id}" title="Delete project">×</span>` +
      `</button>` +
      `<div class="tutor-project-chats">` +
      (chats.length ? chats.map(chatItemHtml).join('') : '<p class="tutor-empty-list">No chats yet.</p>') +
      `</div></div>`;
  }
  if (projects.length) html += '<p class="tutor-chats-heading">Chats</p>';
  html += uncategorized.length ? uncategorized.map(chatItemHtml).join('') : '<p class="tutor-empty-list">No chats yet.</p>';
  chatListEl.innerHTML = html;
}

function renderProjectSelect() {
  chatProjectSelect.innerHTML = '<option value="">No project</option>' +
    projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  chatProjectSelect.value = (currentChat && currentChat.projectId) || '';
}

function renderChatTitle() {
  chatTitleEl.textContent = (currentChat && currentChat.title) || 'New chat';
}

function renderMessages() {
  const messages = (currentChat && currentChat.messages) || [];
  if (!messages.length) {
    chatEl.innerHTML = '<p class="tutor-empty">Ask anything — English or Japanese practice, grammar checks, vocab, whatever\'s useful.</p>';
    return;
  }
  chatEl.innerHTML = messages.map(msg =>
    `<div class="tutor-msg tutor-msg-${msg.role}"><span class="tutor-msg-label">${msg.role === 'user' ? 'You' : 'Tutor'}</span><div class="tutor-msg-body">${toRuby(msg.content)}</div></div>`
  ).join('');
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setBusy(busy, message) {
  sendBtn.disabled = busy;
  inputEl.disabled = busy;
  statusEl.textContent = message || '';
}

// ---- data flow ----

async function refreshSidebarData() {
  [projects, chatSummaries] = await Promise.all([api('/tutor-api/projects'), api('/tutor-api/chats')]);
  renderSidebar();
  renderProjectSelect();
}

function startDraftChat(projectId) {
  currentChat = { id: null, title: '', projectId: projectId || null, model: modelSelect.value, messages: [] };
  renderChatTitle();
  renderMessages();
  renderProjectSelect();
  renderSidebar();
  closeSidebarMobile();
}

async function loadChat(id) {
  currentChat = await api(`/tutor-api/chats/${id}`);
  modelSelect.value = currentChat.model;
  if (currentChat.projectId && !expandedProjects.has(currentChat.projectId)) {
    expandedProjects.add(currentChat.projectId);
    saveExpandedProjects();
  }
  renderChatTitle();
  renderMessages();
  renderProjectSelect();
  renderSidebar();
  closeSidebarMobile();
}

async function ensureChatExists() {
  if (currentChat.id) return;
  const created = await api('/tutor-api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '', projectId: currentChat.projectId, model: currentChat.model, messages: [] }),
  });
  currentChat.id = created.id;
  await refreshSidebarData();
}

async function persistCurrentChat() {
  if (!currentChat.id) return;
  if (!currentChat.title) currentChat.title = autoTitle(currentChat.messages);
  await api(`/tutor-api/chats/${currentChat.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: currentChat.title, projectId: currentChat.projectId, model: currentChat.model, messages: currentChat.messages }),
  });
  renderChatTitle();
  await refreshSidebarData();
}

async function deleteCurrentChat() {
  if (!currentChat.id) {
    startDraftChat();
    return;
  }
  if (!confirm('Delete this chat?')) return;
  await api(`/tutor-api/chats/${currentChat.id}`, { method: 'DELETE' });
  startDraftChat();
  await refreshSidebarData();
}

async function createProject() {
  const name = prompt('Project name?');
  if (!name || !name.trim()) return;
  await api('/tutor-api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  });
  await refreshSidebarData();
}

async function deleteProject(id) {
  if (!confirm('Delete this project? Its chats will become uncategorized.')) return;
  await api(`/tutor-api/projects/${id}`, { method: 'DELETE' });
  if (currentChat && currentChat.projectId === id) currentChat.projectId = null;
  await refreshSidebarData();
}

// ---- sending messages ----

async function sendMessage(text) {
  await ensureChatExists();
  currentChat.messages.push({ role: 'user', content: text });
  renderMessages();
  setBusy(true, 'Thinking…');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: currentChat.model, messages: currentChat.messages, stream: false, think: false }),
    });
    if (!response.ok) throw new Error(`Server responded ${response.status}`);
    const data = await response.json();
    const reply = stripThinkTags(data?.message?.content || '');
    if (!reply) throw new Error('empty-reply');
    currentChat.messages.push({ role: 'assistant', content: reply });
    setBusy(false);
    if (voiceMode) {
      statusEl.textContent = 'Speaking…';
      speakText(reply, { force: true, onDone: resumeVoiceListening });
    } else {
      speakText(reply);
    }
  } catch (error) {
    currentChat.messages.push({
      role: 'assistant',
      content: `Couldn't reach the tutor (${error.message || error}). Is the PC on and the tunnel running?`,
      isError: true,
    });
    setBusy(false, '');
    if (voiceMode) resumeVoiceListening();
  }
  renderMessages();
  await persistCurrentChat();
}

// ---- events ----

formEl.addEventListener('submit', event => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  sendMessage(text);
});

inputEl.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    formEl.requestSubmit();
  }
});

modelSelect.addEventListener('change', () => {
  localStorage.setItem(MODEL_KEY, modelSelect.value);
  if (!currentChat) return;
  currentChat.model = modelSelect.value;
  if (currentChat.id) persistCurrentChat();
});

chatProjectSelect.addEventListener('change', () => {
  if (!currentChat) return;
  currentChat.projectId = chatProjectSelect.value || null;
  if (currentChat.id) {
    persistCurrentChat();
  } else {
    renderSidebar();
  }
});

deleteChatBtn.addEventListener('click', deleteCurrentChat);
newChatBtn.addEventListener('click', () => startDraftChat());
newProjectBtn.addEventListener('click', createProject);

chatListEl.addEventListener('click', event => {
  const delBtn = event.target.closest('[data-delete-project]');
  if (delBtn) {
    event.stopPropagation();
    deleteProject(delBtn.dataset.deleteProject);
    return;
  }
  const item = event.target.closest('[data-chat-id]');
  if (item) {
    loadChat(item.dataset.chatId);
    return;
  }
  const toggle = event.target.closest('[data-toggle-project]');
  if (toggle) {
    const id = toggle.dataset.toggleProject;
    if (expandedProjects.has(id)) expandedProjects.delete(id);
    else expandedProjects.add(id);
    saveExpandedProjects();
    renderSidebar();
  }
});

function closeSidebarMobile() {
  shellEl.classList.remove('sidebar-open');
}

sidebarToggle.addEventListener('click', () => shellEl.classList.toggle('sidebar-open'));
sidebarBackdrop.addEventListener('click', closeSidebarMobile);

const voiceRowEl = document.querySelector('#tutorVoiceRow');
const voiceEnSelect = document.querySelector('#tutorVoiceEn');
const voiceJaSelect = document.querySelector('#tutorVoiceJa');

function populateVoicePickers() {
  const voices = window.speechSynthesis.getVoices();
  const fill = (select, prefix, storageKey, emptyLabel) => {
    const candidates = voices.filter(v => v.lang.toLowerCase().startsWith(prefix));
    if (!candidates.length) {
      select.innerHTML = `<option value="">${emptyLabel}</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    const saved = localStorage.getItem(storageKey);
    select.innerHTML = candidates.map(v =>
      `<option value="${escapeHtml(v.name)}"${v.name === saved ? ' selected' : ''}>${escapeHtml(v.name.replace(/^Microsoft |^Google /, ''))}</option>`
    ).join('');
  };
  fill(voiceEnSelect, 'en', VOICE_EN_KEY, 'No English voice');
  fill(voiceJaSelect, 'ja', VOICE_JA_KEY, 'No Japanese voice installed');
}

if (!('speechSynthesis' in window)) {
  speakToggle.style.display = 'none';
  voiceRowEl.style.display = 'none';
} else {
  speakToggle.addEventListener('click', () => {
    const isOn = speakToggle.getAttribute('aria-pressed') === 'true';
    speakToggle.setAttribute('aria-pressed', String(!isOn));
    localStorage.setItem(SPEAK_KEY, String(!isOn));
    if (isOn) window.speechSynthesis.cancel();
  });

  populateVoicePickers();
  window.speechSynthesis.addEventListener('voiceschanged', populateVoicePickers);

  voiceEnSelect.addEventListener('change', () => {
    localStorage.setItem(VOICE_EN_KEY, voiceEnSelect.value);
    speakText('This is my voice.', { force: true });
  });
  voiceJaSelect.addEventListener('change', () => {
    localStorage.setItem(VOICE_JA_KEY, voiceJaSelect.value);
    speakText('こんにちは、私の声です。', { force: true });
  });
}

// ---- speech input ----

let voiceMode = false;

function resumeVoiceListening() {}

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognitionImpl) {
  micBtn.style.display = 'none';
  const vmBtn = document.querySelector('#tutorVoiceMode');
  if (vmBtn) vmBtn.style.display = 'none';
} else {
  const recognition = new SpeechRecognitionImpl();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener('start', () => micBtn.classList.add('listening'));
  recognition.addEventListener('end', () => micBtn.classList.remove('listening'));
  recognition.addEventListener('result', event => {
    const transcript = event.results[0][0].transcript.trim();
    if (!transcript) return;
    if (voiceMode) {
      sendMessage(transcript);
      return;
    }
    inputEl.value = inputEl.value ? `${inputEl.value} ${transcript}` : transcript;
    inputEl.focus();
  });

  // ---- voice mode (continuous back-and-forth) ----

  const voiceModeBtn = document.querySelector('#tutorVoiceMode');
  let voiceRestartTimer = null;

  function startVoiceListening() {
    if (!voiceMode) return;
    statusEl.textContent = 'Listening…';
    try {
      recognition.start();
    } catch {
      // start() throws if recognition is already running; that's fine.
    }
  }

  resumeVoiceListening = () => {
    if (!voiceMode) return;
    clearTimeout(voiceRestartTimer);
    voiceRestartTimer = setTimeout(startVoiceListening, 250);
  };

  function stopVoiceMode() {
    voiceMode = false;
    clearTimeout(voiceRestartTimer);
    voiceModeBtn.setAttribute('aria-pressed', 'false');
    voiceModeBtn.classList.remove('listening');
    statusEl.textContent = '';
    recognition.abort();
    window.speechSynthesis?.cancel();
  }

  voiceModeBtn.addEventListener('click', () => {
    if (voiceMode) {
      stopVoiceMode();
      return;
    }
    voiceMode = true;
    voiceModeBtn.setAttribute('aria-pressed', 'true');
    voiceModeBtn.classList.add('listening');
    startVoiceListening();
  });

  recognition.addEventListener('error', event => {
    micBtn.classList.remove('listening');
    // In voice mode, "no-speech" just means a quiet moment — keep listening.
    if (voiceMode && (event.error === 'no-speech' || event.error === 'aborted')) {
      if (event.error === 'no-speech') resumeVoiceListening();
      return;
    }
    if (voiceMode) {
      console.error('Speech recognition error:', event.error);
      stopVoiceMode();
    }
  });

  recognition.addEventListener('end', () => {
    // Chrome ends recognition after each utterance/silence; keep the loop
    // alive while in voice mode unless we're mid-request or speaking.
    if (voiceMode && !sendBtn.disabled && !window.speechSynthesis.speaking) {
      resumeVoiceListening();
    }
  });

  micBtn.addEventListener('click', () => {
    if (voiceMode) stopVoiceMode();
    if (micBtn.classList.contains('listening')) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

// ---- init ----

(async function init() {
  const savedModel = localStorage.getItem(MODEL_KEY);
  if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
    modelSelect.value = savedModel;
  }
  if (localStorage.getItem(SPEAK_KEY) === 'true') {
    speakToggle.setAttribute('aria-pressed', 'true');
  }
  startDraftChat();
  try {
    await refreshSidebarData();
  } catch {
    chatListEl.innerHTML = '<p class="tutor-empty-list">Couldn\'t load saved chats.</p>';
  }
})();
