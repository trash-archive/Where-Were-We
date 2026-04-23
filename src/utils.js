/**
 * utils.js
 * Shared helpers used across modules.
 */

import { getOrCreateMap, destroyMap } from './mapManager.js';

// Re-export map helpers so game.js can import from utils
export { getOrCreateMap, destroyMap };

// Re-export distance helpers
export { haversineKm, distanceToScore, formatDistance } from './distance.js';

// ── Screen router ──────────────────────────────────────────────────────────
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${id}`);
  if (el) el.classList.add('active');
}

// ── Toast ──────────────────────────────────────────────────────────────────
export function toast(message, type = 'default', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }, duration);
}

// ── HTML escape ────────────────────────────────────────────────────────────
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Avatar helpers ─────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#e0e7ff','#fce7f3','#d1fae5','#fef3c7','#ffe4e6','#e0f2fe'];
export function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
export function avatarTextColor() { return '#374151'; }
