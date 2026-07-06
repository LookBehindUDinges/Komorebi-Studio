'use strict';

// Fill in each url once the account exists; leave it empty to show as "coming soon."
const SOCIAL_LINKS = [
  { name: 'YouTube', handle: 'Ben Ballard Music', url: 'https://www.youtube.com/channel/UCpZ3i0_Ua58VJ5ButiRkslw', icon: '▶', color: '#db5b47' },
  { name: 'Instagram', handle: '@benballardmusic', url: 'https://www.instagram.com/benballardmusic/', icon: '📷', color: '#db5b47' },
  { name: 'TikTok', handle: '@benballardmusicofficial', url: 'https://www.tiktok.com/@benballardmusicofficial', icon: '🎵', color: '#19333a' },
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

function socialCard(social) {
  const hasLink = Boolean(social.url);
  const inner =
    `<span class="socials-icon" style="background:${escapeHtml(social.color)}">${escapeHtml(social.icon)}</span>` +
    `<span class="socials-name">${escapeHtml(social.name)}</span>` +
    `<span class="socials-handle">${hasLink ? escapeHtml(social.handle || '') : 'Coming soon'}</span>`;
  return hasLink
    ? `<a class="socials-card" href="${escapeHtml(social.url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="socials-card socials-card-pending">${inner}</div>`;
}

const root = document.querySelector('#socialsRoot');
if (root) {
  root.innerHTML = SOCIAL_LINKS.map(socialCard).join('');
}
