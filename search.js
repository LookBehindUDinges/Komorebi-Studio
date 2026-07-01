'use strict';

const searchInput = document.querySelector('#studioSearchInput');
const resultsRoot = document.querySelector('#studioSearchResults');
const resultCount = document.querySelector('#studioSearchCount');
const readArray = key => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const escapeText = value => String(value ?? '').replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[character]));

function searchableItems() {
  const words = readArray('komorebi-vocabulary-local-v1').map(item => ({ type: 'Japanese word', title: item.word || item.japanese, detail: [item.reading, item.meaning || item.english, item.category].filter(Boolean).join(' · '), href: 'add-word.html' }));
  const songs = readArray('komorebi-youtube-lessons-v1').map(item => ({ type: 'Learning queue', title: item.title, detail: [item.style, item.status, item.key, item.tuning].filter(Boolean).join(' · '), href: 'music.html#youtubeLearning' }));
  const videos = readArray('komorebi-channel-videos-v1').map(item => ({ type: 'Channel video', title: item.title, detail: 'Saved YouTube video', href: 'index.html#channel-videos' }));
  const pages = [
    ['Japanese practice', 'Phrases, flashcards, sentence structure, and particles', 'japanese.html'],
    ['Music Room', 'Recordings, theory, lessons, and learning queue', 'music.html'],
    ['Study Material', 'Japanese and music theory references', 'study.html'],
    ['Pet Archives', 'Cat and dog photographs', 'pets.html'],
    ['Backup and restore', 'Export or restore private device data', 'backup.html']
  ].map(item => ({ type: 'Komorebi page', title: item[0], detail: item[1], href: item[2] }));
  return [...words, ...songs, ...videos, ...pages];
}

function renderSearch() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  if (!query) { resultsRoot.innerHTML = ''; resultCount.textContent = 'Start typing to search.'; return; }
  const matches = searchableItems().filter(item => `${item.title} ${item.detail} ${item.type}`.toLocaleLowerCase().includes(query)).slice(0, 40);
  resultCount.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
  resultsRoot.innerHTML = matches.length ? matches.map(item => `<a href="${escapeText(item.href)}"><small>${escapeText(item.type)}</small><strong>${escapeText(item.title)}</strong><span>${escapeText(item.detail)}</span></a>`).join('') : '<p class="studio-search-empty">No matches yet. Try a shorter word.</p>';
}

searchInput.addEventListener('input', renderSearch);
searchInput.focus();
