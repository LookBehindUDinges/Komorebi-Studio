'use strict';
const root = document.querySelector('#videosRoot');
const titleEl = document.querySelector('#videosChannelTitle');
const playerEl = document.querySelector('#videosPlayer');
const frameEl = document.querySelector('#videosFrame');
const playerTitleEl = document.querySelector('#videosPlayerTitle');

function escapeHtml(value) {
  return String(value ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function emptyState(message) {
  return `<p class="videos-empty">${message}</p>`;
}

function videoCard(video) {
  return `<button type="button" class="videos-card" data-video-id="${escapeHtml(video.id)}" data-video-title="${escapeHtml(video.title)}">` +
    `<span class="videos-thumb-wrap"><img class="videos-thumb" src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy"><span class="videos-play">▶</span></span>` +
    `<span class="videos-card-title">${escapeHtml(video.title)}</span>` +
    `<span class="videos-card-date">${escapeHtml(formatDate(video.published))}</span>` +
    `</button>`;
}

function playVideo(id, title) {
  frameEl.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`;
  playerTitleEl.textContent = title;
  playerEl.hidden = false;
  playerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

root.addEventListener('click', event => {
  const card = event.target.closest('[data-video-id]');
  if (!card) return;
  playVideo(card.dataset.videoId, card.dataset.videoTitle);
});

async function loadVideos() {
  try {
    const response = await fetch('videos/latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No videos file yet');
    const data = await response.json();
    if (data.channel_title) {
      titleEl.textContent = data.channel_title;
    }
    const videos = Array.isArray(data.videos) ? data.videos : [];
    if (!videos.length) {
      root.innerHTML = emptyState('No videos yet — check back soon!');
      return;
    }
    root.innerHTML = videos.map(videoCard).join('');
  } catch (error) {
    root.innerHTML = emptyState('No videos yet — check back soon!');
  }
}

loadVideos();
