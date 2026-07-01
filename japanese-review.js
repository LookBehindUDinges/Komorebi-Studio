'use strict';

const REVIEW_KEY = 'komorebi-japanese-review-v1';
const reviewDay = () => new Date().toLocaleDateString('en-CA');

function readReview() {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') || {}; }
  catch { return {}; }
}

function duePhraseIndexes() {
  const state = readReview();
  const today = reviewDay();
  return phrases.map((_, index) => index).filter(index => !state[index]?.due || state[index].due <= today);
}

function drawReviewStatus() {
  const state = readReview();
  const today = reviewDay();
  const reviewed = Object.values(state).filter(item => item.last === today).reduce((sum, item) => sum + Number(item.count || 0), 0);
  document.querySelector('#jpReviewCount').textContent = `${reviewed} reviewed today`;
  document.querySelector('#jpDueCount').textContent = `${duePhraseIndexes().length} due`;
}

function advanceReview() {
  const due = duePhraseIndexes();
  phraseIndex = due.length ? (due.find(index => index !== phraseIndex) ?? due[0]) : (phraseIndex + 1) % phrases.length;
  renderPhrase();
  drawReviewStatus();
}

document.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => {
  const rating = button.dataset.review;
  const state = readReview();
  const current = state[phraseIndex] || {};
  const days = rating === 'again' ? 0 : rating === 'hard' ? 2 : Math.min(30, Math.max(4, Number(current.interval || 2) * 2));
  const due = new Date();
  due.setDate(due.getDate() + days);
  state[phraseIndex] = { interval: days, due: due.toLocaleDateString('en-CA'), last: reviewDay(), count: Number(current.count || 0) + 1, rating };
  localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
  advanceReview();
}));

drawReviewStatus();
