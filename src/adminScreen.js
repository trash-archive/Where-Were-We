/**
 * adminScreen.js
 * Full admin panel — Users tab + Reported Photos tab.
 * Only accessible to the ADMIN_EMAIL account.
 */

import { supabase } from './supabase.js';

export const ADMIN_EMAIL = 'theactualadmin.www@gmail.com';

export function isAdmin(user) {
  return user?.email === ADMIN_EMAIL;
}

// ── Tab state ──────────────────────────────────────────────────────────────
let activeTab = 'users';

export async function loadAdminPanel() {
  activeTab = 'users'; // always reset to users tab on fresh open
  renderAdminShell();
  switchTab(activeTab);
}

function renderAdminShell() {
  const wrap = document.getElementById('admin-panel-wrap');
  if (wrap.dataset.ready) return;
  wrap.dataset.ready = '1';
  wrap.innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab active" data-tab="users">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Users
      </button>
      <button class="admin-tab" data-tab="reports">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        Reported Photos
      </button>
    </div>
    <div id="admin-tab-content"></div>
  `;

  wrap.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      wrap.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b === btn));
      switchTab(activeTab);
    });
  });
}

function switchTab(tab) {
  const content = document.getElementById('admin-tab-content');
  if (tab === 'users') {
    content.innerHTML = `<div class="admin-loading">Loading users…</div>`;
    loadUsersTab(content);
  } else {
    content.innerHTML = `<div class="admin-loading">Loading reports…</div>`;
    loadReportsTab(content);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════════════════════
async function loadUsersTab(container) {
  try {
    const { data, error } = await supabase.rpc('admin_get_all_users');
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = emptyState('No users found', 'Users will appear here once they sign up.');
      return;
    }

    container.innerHTML = `
      <div class="admin-users-table-wrap">
        <table class="admin-users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th>Photos</th>
              <th>Public</th>
              <th>Reports</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="admin-users-tbody">
            ${data.map(u => renderUserRow(u)).join('')}
          </tbody>
        </table>
      </div>
    `;

    wireUserRows(container);
  } catch (e) {
    container.innerHTML = errorState(e.message);
  }
}

function renderUserRow(u) {
  const initials = (u.username ?? u.email ?? '?').slice(0, 2).toUpperCase();
  const joined = new Date(u.created_at).toLocaleDateString();
  const suspended = u.suspended;

  return `
    <tr class="admin-user-row ${suspended ? 'is-suspended' : ''}" data-user-id="${u.user_id}">
      <td>
        <div class="admin-user-cell">
          <div class="admin-user-avatar">${esc(initials)}</div>
          <div class="admin-user-info">
            <div class="admin-user-name">${esc(u.username ?? '—')}</div>
            <div class="admin-user-email">${esc(u.email ?? '—')}</div>
          </div>
        </div>
      </td>
      <td class="admin-td-muted">${joined}</td>
      <td>${u.photo_count}</td>
      <td>${u.public_count}</td>
      <td>${u.report_count > 0 ? `<span class="badge badge-amber">${u.report_count}</span>` : '0'}</td>
      <td>
        ${suspended
          ? '<span class="badge badge-red">Suspended</span>'
          : '<span class="badge badge-green">Active</span>'}
      </td>
      <td class="admin-user-actions-cell">
        <button class="btn btn-ghost btn-sm admin-expand-btn" data-user-id="${u.user_id}" title="View photos">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <button class="btn btn-sm ${suspended ? 'btn-secondary' : 'btn-warning'} admin-suspend-btn"
          data-user-id="${u.user_id}" data-suspended="${suspended}">
          ${suspended ? 'Unsuspend' : 'Suspend'}
        </button>
        <button class="btn btn-danger btn-sm admin-delete-user-btn" data-user-id="${u.user_id}" data-username="${esc(u.username ?? u.email)}">
          Delete
        </button>
      </td>
    </tr>
    <tr class="admin-user-photos-row hidden" id="photos-row-${u.user_id}">
      <td colspan="7" class="admin-photos-td">
        <div class="admin-user-photos-wrap" id="photos-wrap-${u.user_id}">
          <div class="admin-loading" style="padding:20px;">Loading photos…</div>
        </div>
      </td>
    </tr>
  `;
}

function wireUserRows(container) {
  container.querySelectorAll('.admin-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleUserPhotos(btn.dataset.userId));
  });
  container.querySelectorAll('.admin-suspend-btn').forEach(btn => {
    btn.addEventListener('click', () => handleSuspend(btn));
  });
  container.querySelectorAll('.admin-delete-user-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteUser(btn.dataset.userId, btn.dataset.username));
  });
}

async function toggleUserPhotos(userId) {
  const row = document.getElementById(`photos-row-${userId}`);
  const wrap = document.getElementById(`photos-wrap-${userId}`);
  const expandBtn = document.querySelector(`.admin-expand-btn[data-user-id="${userId}"]`);
  const isOpen = !row.classList.contains('hidden');

  if (isOpen) {
    row.classList.add('hidden');
    expandBtn?.classList.remove('rotated');
    return;
  }

  row.classList.remove('hidden');
  expandBtn?.classList.add('rotated');

  // Only fetch if not already loaded
  if (wrap.dataset.loaded) return;
  wrap.dataset.loaded = '1';

  try {
    const { data, error } = await supabase.rpc('admin_get_user_photos', { p_user_id: userId });
    if (error) throw error;

    if (!data?.length) {
      wrap.innerHTML = `<div class="admin-no-photos">No photos uploaded yet.</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="admin-photos-grid">
        ${data.map(p => `
          <div class="admin-photo-card" data-photo-id="${p.photo_id}">
            <div class="admin-photo-thumb-wrap">
              <img src="${p.public_url}" alt="${esc(p.original_name ?? '')}" loading="lazy" class="admin-photo-thumb">
              ${p.report_count > 0 ? `<span class="admin-photo-report-badge">${p.report_count} report${p.report_count !== 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="admin-photo-meta">
              <div class="admin-photo-name" title="${esc(p.original_name ?? '')}">${esc(p.original_name ?? 'Untitled')}</div>
              <div class="admin-photo-details">
                <span class="badge ${p.is_public ? 'badge-blue' : 'badge-gray'}">${p.is_public ? 'Public' : 'Private'}</span>
                ${p.lat != null ? `<span class="badge badge-green">Has GPS</span>` : `<span class="badge badge-gray">No GPS</span>`}
              </div>
              ${p.lat != null ? `<div class="admin-photo-coords">${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}</div>` : ''}
              <div class="admin-photo-date">${new Date(p.created_at).toLocaleDateString()}</div>
              <button class="btn btn-danger btn-sm admin-delete-photo-btn" style="margin-top:6px;width:100%;"
                data-photo-id="${p.photo_id}" data-storage-path="${p.storage_path ?? ''}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire photo lightbox
    wrap.querySelectorAll('.admin-photo-thumb').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });

    // Wire photo delete
    wrap.querySelectorAll('.admin-delete-photo-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDeletePhoto(btn.dataset.photoId, btn.dataset.storagePath, btn));
    });

  } catch (e) {
    wrap.innerHTML = errorState(e.message);
  }
}

async function handleSuspend(btn) {
  const userId = btn.dataset.userId;
  const isSuspended = btn.dataset.suspended === 'true';
  const fn = isSuspended ? 'admin_unsuspend_user' : 'admin_suspend_user';

  btn.disabled = true;
  try {
    const { error } = await supabase.rpc(fn, { p_user_id: userId });
    if (error) throw error;

    // Update row visually
    const row = document.querySelector(`.admin-user-row[data-user-id="${userId}"]`);
    const newSuspended = !isSuspended;
    row?.classList.toggle('is-suspended', newSuspended);
    btn.dataset.suspended = String(newSuspended);
    btn.textContent = newSuspended ? 'Unsuspend' : 'Suspend';
    btn.className = `btn btn-sm ${newSuspended ? 'btn-secondary' : 'btn-warning'} admin-suspend-btn`;

    const statusCell = row?.querySelector('.badge-green, .badge-red');
    if (statusCell) {
      statusCell.className = newSuspended ? 'badge badge-red' : 'badge badge-green';
      statusCell.textContent = newSuspended ? 'Suspended' : 'Active';
    }
  } catch (e) {
    alert('Action failed: ' + e.message);
  }
  btn.disabled = false;
}

async function handleDeleteUser(userId, username) {
  if (!confirm(`Permanently delete user "${username}" and all their photos? This cannot be undone.`)) return;

  try {
    // Clean up storage files first (RPC can't reach storage bucket)
    const { data: photos } = await supabase.rpc('admin_get_user_photos', { p_user_id: userId });
    if (photos?.length) {
      const paths = photos.map(p => p.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from('photos').remove(paths);
    }

    // RPC deletes photos rows, profile, and anonymises the auth record
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
    if (error) throw error;

    document.querySelector(`.admin-user-row[data-user-id="${userId}"]`)?.remove();
    document.getElementById(`photos-row-${userId}`)?.remove();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

async function handleDeletePhoto(photoId, storagePath, btn) {
  if (!confirm('Permanently delete this photo?')) return;
  btn.disabled = true;
  try {
    if (storagePath) await supabase.storage.from('photos').remove([storagePath]);
    const { error } = await supabase.rpc('admin_delete_photo', { p_photo_id: photoId });
    if (error) throw error;
    document.querySelector(`.admin-photo-card[data-photo-id="${photoId}"]`)?.remove();
  } catch (e) {
    alert('Delete failed: ' + e.message);
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ══════════════════════════════════════════════════════════════════════════
async function loadReportsTab(container) {
  try {
    const { data, error } = await supabase.rpc('get_reported_photos');
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = emptyState('No reports yet', 'Reported photos will appear here.');
      return;
    }

    container.innerHTML = data.map(r => `
      <div class="admin-report-card" data-photo-id="${r.photo_id}" data-storage-path="${r.storage_path ?? ''}">
        <div class="admin-report-img-wrap">
          <img src="${r.public_url}" alt="${esc(r.original_name ?? '')}" loading="lazy">
          ${!r.is_public ? '<div class="admin-hidden-badge">Hidden</div>' : ''}
        </div>
        <div class="admin-report-info">
          <div class="admin-report-meta">
            <span class="admin-report-count">${r.report_count} report${r.report_count !== 1 ? 's' : ''}</span>
            <span class="admin-report-name">${esc(r.original_name ?? 'Unknown')}</span>
          </div>
          <div class="admin-report-reasons">${r.reasons.map(reason =>
            `<span class="badge badge-amber">${reason}</span>`
          ).join('')}</div>
          <div class="admin-report-reporters">Reported by: ${r.reporter_emails.map(e => esc(e)).join(', ')}</div>
          <div class="admin-report-owner">Owner: ${esc(r.owner_email ?? 'Unknown')}</div>
          <div class="admin-report-date">First report: ${new Date(r.first_reported).toLocaleDateString()}</div>
          <div class="admin-report-actions">
            <button class="btn btn-danger btn-sm" data-action="delete" data-photo-id="${r.photo_id}" data-storage-path="${r.storage_path ?? ''}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete Photo
            </button>
            <button class="btn btn-secondary btn-sm" data-action="dismiss" data-photo-id="${r.photo_id}">Dismiss Reports</button>
            ${!r.is_public ? `
            <button class="btn btn-secondary btn-sm" data-action="restore" data-photo-id="${r.photo_id}">Restore Public</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.admin-report-img-wrap img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => handleReportDelete(btn.dataset.photoId, btn.dataset.storagePath, container));
    });
    container.querySelectorAll('[data-action="dismiss"]').forEach(btn => {
      btn.addEventListener('click', () => handleDismiss(btn.dataset.photoId, container));
    });
    container.querySelectorAll('[data-action="restore"]').forEach(btn => {
      btn.addEventListener('click', () => handleRestore(btn.dataset.photoId));
    });

  } catch (e) {
    container.innerHTML = errorState(e.message);
  }
}

async function handleReportDelete(photoId, storagePath, container) {
  if (!confirm('Permanently delete this photo and all its reports?')) return;
  try {
    if (storagePath) await supabase.storage.from('photos').remove([storagePath]);
    const { error } = await supabase.rpc('admin_delete_photo', { p_photo_id: photoId });
    if (error) throw error;
    container.querySelector(`[data-photo-id="${photoId}"]`)?.remove();
    checkReportsEmpty(container);
  } catch (e) { alert('Delete failed: ' + e.message); }
}

async function handleDismiss(photoId, container) {
  try {
    const { error } = await supabase.rpc('admin_dismiss_reports', { p_photo_id: photoId });
    if (error) throw error;
    container.querySelector(`.admin-report-card[data-photo-id="${photoId}"]`)?.remove();
    checkReportsEmpty(container);
  } catch (e) { alert('Dismiss failed: ' + e.message); }
}

async function handleRestore(photoId) {
  try {
    const { error } = await supabase.rpc('admin_restore_photo', { p_photo_id: photoId });
    if (error) throw error;
    switchTab('reports');
  } catch (e) { alert('Restore failed: ' + e.message); }
}

function checkReportsEmpty(container) {
  if (!container.querySelector('.admin-report-card')) {
    container.innerHTML = emptyState('No reports', 'All clear!');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function emptyState(title, sub) {
  return `<div class="empty-state" style="padding:60px 24px;">
    <div class="empty-state-title">${title}</div>
    <div class="empty-state-sub">${sub}</div>
  </div>`;
}

function errorState(msg) {
  return `<div class="empty-state" style="padding:40px;">
    <div class="empty-state-title" style="color:var(--red);">Error loading data</div>
    <div class="empty-state-sub">${esc(msg)}</div>
  </div>`;
}

function openLightbox(src, alt) {
  const overlay = document.createElement('div');
  overlay.className = 'admin-lightbox';
  overlay.innerHTML = `<img src="${src}" alt="${alt}"><button class="admin-lightbox-close" aria-label="Close">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
  const close = () => {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('img').addEventListener('click', e => e.stopPropagation());
  overlay.querySelector('.admin-lightbox-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
}
