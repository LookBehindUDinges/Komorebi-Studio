'use strict';
const root = document.querySelector('#briefingRoot');
const meta = document.querySelector('#briefingMeta');
const tabs = document.querySelector('#briefingTabs');

let allArticles = [];
let currentCategory = 'All';

function escapeHtml(value) {
  return String(value ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

const KANJI_RANGE = '一-鿿々';
const HIRAGANA_RANGE = '぀-ゟ';
const FURIGANA_PATTERN = new RegExp('([' + KANJI_RANGE + ']+)\\(([' + HIRAGANA_RANGE + ']+)\\)', 'g');
const HAS_KANJI = new RegExp('[' + KANJI_RANGE + ']');

function toRuby(text) {
  return escapeHtml(text).replace(FURIGANA_PATTERN, '<ruby>$1<rt>$2</rt></ruby>');
}

// Vocabulary words are only worth annotating with a reading if they contain
// kanji — a learner who already knows kana doesn't need it spelled out again.
function vocabTerm(word, reading) {
  if (reading && HAS_KANJI.test(word)) {
    return '<ruby>' + escapeHtml(word) + '<rt>' + escapeHtml(reading) + '</rt></ruby>';
  }
  return escapeHtml(word);
}

function emptyState(message) {
  return '<p class="briefing-empty">' + (message || 'No briefing has been generated yet. Run <code>python scripts/daily_briefing.py</code> (with Ollama running) to create one.') + '</p>';
}

function articleCard(article, index) {
  const vocabList = (article.vocabulary || []).filter(v => v && typeof v === 'object' && v.word);
  const vocab = vocabList.map(v =>
    '<div><dt>' + vocabTerm(v.word, v.reading) + '</dt><dd>' + escapeHtml(v.meaning || '') + '</dd></div>'
  ).join('');
  const titleHtml = article.link
    ? '<a href="' + escapeHtml(article.link) + '" target="_blank" rel="noopener">' + escapeHtml(article.title) + '</a>'
    : escapeHtml(article.title);
  return '<article class="briefing-card">' +
    '<div class="briefing-card-head"><span class="briefing-index">' + (index + 1) + '</span><small>' + escapeHtml(article.category || article.source) + ' · ' + escapeHtml(article.source) + '</small><h2>' + titleHtml + '</h2>' +
    (article.japanese_title ? '<p class="briefing-japanese-title">' + toRuby(article.japanese_title) + '</p>' : '') +
    '</div>' +
    '<p class="briefing-english">' + escapeHtml(article.english_summary) + '</p>' +
    '<p class="briefing-japanese">' + toRuby(article.japanese_summary) + '</p>' +
    (vocab ? '<details class="briefing-vocab"><summary>Vocabulary (' + vocabList.length + ')</summary><dl>' + vocab + '</dl></details>' : '') +
    '<p class="briefing-why"><b>Why it matters:</b> ' + escapeHtml(article.why_it_matters) + '</p>' +
    '</article>';
}

function renderTabs(categories) {
  if (!tabs) return;
  const cats = ['All', ...categories];
  tabs.innerHTML = cats.map(cat =>
    '<button type="button" class="' + (cat === currentCategory ? 'active' : '') + '" data-category="' + escapeHtml(cat) + '">' + escapeHtml(cat) + '</button>'
  ).join('');
}

function renderArticles() {
  const filtered = currentCategory === 'All' ? allArticles : allArticles.filter(a => a.category === currentCategory);
  root.innerHTML = filtered.length ? filtered.map((a, i) => articleCard(a, i)).join('') : emptyState('No articles in this category yet.');
}

if (tabs) {
  tabs.addEventListener('click', event => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    currentCategory = button.dataset.category;
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button));
    renderArticles();
  });
}

async function loadBriefing() {
  try {
    const response = await fetch('briefing/latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No briefing file yet');
    const data = await response.json();
    allArticles = Array.isArray(data.articles) ? data.articles : [];
    if (!allArticles.length) {
      root.innerHTML = emptyState();
      return;
    }
    meta.textContent = 'Generated ' + new Date(data.generated_at).toLocaleString() + ' · model: ' + data.model;
    const categories = [...new Set(allArticles.map(a => a.category).filter(Boolean))];
    renderTabs(categories);
    renderArticles();
  } catch (error) {
    root.innerHTML = emptyState();
  }
}

loadBriefing();
