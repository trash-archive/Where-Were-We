/**
 * adminScreen.js
 * Admin panel — view and action reported photos.
 * Only accessible to the ADMIN_EMAIL account.
 */

import { supabase } from './supabase.js';
import { showScreen } from './utils.js';

export const ADMIN_EMAIL = 'theactualadmin.www@gmail.com'; // ← replace with your email

export function isAdmin(user) {
  return user?.email === ADMIN_EMAIL;
}

// ── Load & render ──────────────────────────────────────────────────────────
export async function loadAdminPanel() {
  const container = document.getElementById('admin-reports-list');
  container.innerHTML = `<div class="admin-loading">Loading reports…</div>`;

  try {
    // Fetch all reported photos with report details
    const { data, error } = await supabase.rpc('get_reported_photos');
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:60px 24px;">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </div>
          <div class="empty-state-title">No reports yet</div>
          <div class="empty-state-sub">Reported photos will appear here</div>
        </div>`;
      return;
    }

    container.innerHTML = data.map(r => `
      <div class="admin-report-card" data-photo-id="${r.photo_id}" data-storage-path="${r.storage_path ?? ''}">
        <div class="admin-report-img-wrap">
          <img src="${r.public_url}" alt="${escHtml(r.original_name ?? '')}" loading="lazy">
          ${!r.is_public ? '<div class="admin-hidden-badge">Hidden</div>' : ''}
        </div>
        <div class="admin-report-info">
          <div class="admin-report-meta">
            <span class="admin-report-count">${r.report_count} report${r.report_count !== 1 ? 's' : ''}</span>
            <span class="admin-report-name">${escHtml(r.original_name ?? 'Unknown')}</span>
          </div>
          <div class="admin-report-reasons">${r.reasons.map(reason =>
            `<span class="badge badge-amber">${reason}</span>`
          ).join('')}</div>
          <div class="admin-report-reporters">
            Reported by: ${r.reporter_emails.map(e => escHtml(e)).join(', ')}
          </div>
          <div class="admin-report-owner">
            Owner: ${escHtml(r.owner_email ?? 'Unknown')}
          </div>
          <div class="admin-report-date">
            First report: ${new Date(r.first_reported).toLocaleDateString()}
          </div>
          <div class="admin-report-actions">
            <button class="btn btn-danger btn-sm" data-action="delete" data-photo-id="${r.photo_id}" data-storage-path="${r.storage_path ?? ''}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete Photo
            </button>
            <button class="btn btn-secondary btn-sm" data-action="dismiss" data-photo-id="${r.photo_id}">
              Dismiss Reports
            </button>
            ${!r.is_public ? `
            <button class="btn btn-secondary btn-sm" data-action="restore" data-photo-id="${r.photo_id}">
              Restore Public
            </button>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Wire image lightbox
    container.querySelectorAll('.admin-report-img-wrap img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });

    // Wire action buttons
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.photoId, btn.dataset.storagePath));
    });
    container.querySelectorAll('[data-action="dismiss"]').forEach(btn => {
      btn.addEventListener('click', () => handleDismiss(btn.dataset.photoId));
    });
    container.querySelectorAll('[data-action="restore"]').forEach(btn => {
      btn.addEventListener('click', () => handleRestore(btn.dataset.photoId));
    });

  } catch (e) {
    container.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-state-title" style="color:var(--red);">Error loading reports</div><div class="empty-state-sub">${escHtml(e.message)}</div></div>`;
  }
}

// ── Actions ────────────────────────────────────────────────────────────────
async function handleDelete(photoId, storagePath) {
  if (!confirm('Permanently delete this photo and all its reports?')) return;
  try {
    if (storagePath) await supabase.storage.from('photos').remove([storagePath]);
    await supabase.from('photos').delete().eq('id', photoId);
    document.querySelector(`[data-photo-id="${photoId}"]`)?.remove();
    checkEmpty();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

async function handleDismiss(photoId) {
  try {
    await supabase.from('photo_reports').delete().eq('photo_id', photoId);
    document.querySelector(`.admin-report-card[data-photo-id="${photoId}"]`)?.remove();
    checkEmpty();
  } catch (e) {
    alert('Dismiss failed: ' + e.message);
  }
}

async function handleRestore(photoId) {
  try {
    await supabase.from('photos').update({ is_public: true }).eq('id', photoId);
    loadAdminPanel(); // refresh
  } catch (e) {
    alert('Restore failed: ' + e.message);
  }
}

function checkEmpty() {
  const container = document.getElementById('admin-reports-list');
  if (!container.querySelector('.admin-report-card')) {
    container.innerHTML = `
      <div class="empty-state" style="padding:60px 24px;">
        <div class="empty-state-title">No reports</div>
        <div class="empty-state-sub">All clear!</div>
      </div>`;
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Lightbox ───────────────────────────────────────────────────────────────
function openLightbox(src, alt) {
  const overlay = document.createElement('div');
  overlay.className = 'admin-lightbox';
  overlay.innerHTML = `<img src="${src}" alt="${alt}"><button class="admin-lightbox-close" aria-label="Close">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>`;
  document.body.appendChild(overlay);

  // Double rAF: first frame applies display:flex, second triggers the opacity transition
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));

  const close = () => {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  // Clicking the backdrop (not the image) closes it
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  // Prevent image clicks from bubbling up to the backdrop
  overlay.querySelector('img').addEventListener('click', e => e.stopPropagation());
  overlay.querySelector('.admin-lightbox-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
}
