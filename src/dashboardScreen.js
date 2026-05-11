/**
 * dashboardScreen.js
 * Dashboard: photo upload, grid, solo play, multiplayer rooms.
 */

import { supabase } from './supabase.js';
import { signOut, getDisplayName } from './auth.js';
import { validateFile, uploadPhoto, getUserPhotos, deletePhoto, updatePhotoLocation, togglePhotoPublic, getPublicPhotos, checkImageSafety, prewarmNsfwModel } from './photos.js';
import { createRoom, joinRoom, subscribeToRoom, startRoom, leaveRoom, updateRoomSettings, kickPlayer, updatePlayerIncludeOwn } from './rooms.js';
import { openLocationPicker } from './locationPicker.js';
import { startSoloGame as startGame, startMultiplayerGame as startMP, clearSnapshot, getGameStats } from './game.js';
import { showScreen, toast, escapeHtml } from './utils.js';
import { confirmDelete, showGuidelinesIfNeeded } from './modals.js';
import { showAdminNavBtn } from './main.js';

// ── Suspension guard ───────────────────────────────────────────────────────
async function assertNotSuspended() {
  const { data: suspended } = await supabase.rpc('check_user_suspended', { p_user_id: currentUser.id });
  if (suspended) {
    await signOut().catch(() => {});
    throw new Error('Your account has been suspended.');
  }
}

let currentUser = null;
let userPhotos = [];
let photosCached = false;
let unsubRoom = null;
let unsubRoomsList = null;
let currentRoom = null;
let eventsWired = false;
let currentPage = 1;
const PAGE_SIZE = 20;

// ── Init (called once at startup) ─────────────────────────────────────────
export function initDashboard() {
  wireEvents();
}

// ── Load dashboard ─────────────────────────────────────────────────────────
export async function loadDashboard(user) {
  currentUser = user;
  const name = getDisplayName(user);
  const initials = name.slice(0, 2).toUpperCase();
  document.getElementById('nav-username').textContent = name;
  document.getElementById('nav-user-avatar').textContent = initials;
  document.getElementById('nav-dropdown-name').textContent = name;
  document.getElementById('nav-dropdown-email').textContent = user.email ?? '';
  document.getElementById('play-hero-greeting').textContent = `Welcome back, ${name}`;
  showAdminNavBtn(user);
  prewarmNsfwModel();
  renderGameStats(user.id);
  // Only fetch photos on first load; subsequent visits use the in-memory cache
  if (!photosCached) {
    await Promise.all([refreshPhotos(), loadRooms()]);
  } else {
    renderPhotoGrid();
    updateStats();
    renderGpsBanner();
    loadRooms();
  }
  subscribeRoomsList();
}

async function refreshPhotos(preservePage = false) {
  try {
    userPhotos = await getUserPhotos(currentUser.id);
    photosCached = true;
    if (!preservePage) currentPage = 1;
    renderPhotoGrid();
    updateStats();
    renderGpsBanner();
  } catch (e) {
    toast('Could not load photos.', 'error');
  }
}

function patchPhoto(photoId, changes) {
  const idx = userPhotos.findIndex(p => p.id === photoId);
  if (idx === -1) return;
  userPhotos[idx] = { ...userPhotos[idx], ...changes };
  // Patch only the affected tile if it's currently visible — no full re-render
  const grid = document.getElementById('dash-photo-grid');
  const tile = Array.from(grid.children).find(el => el.dataset.id === photoId);
  if (tile) {
    patchTile(tile, userPhotos[idx]);
  } else {
    renderPhotoGrid();
  }
  updateStats();
  renderGpsBanner();
}

function renderGpsBanner() {
  const noGpsCount = userPhotos.filter(p => p.lat === null).length;
  const banner = document.getElementById('gps-info-banner');
  if (!banner) return;
  if (noGpsCount === 0) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  document.getElementById('gps-banner-count').textContent =
    `${noGpsCount} photo${noGpsCount !== 1 ? 's' : ''} missing location`;
}

function updateStats() {
  const withGps = userPhotos.filter(p => p.lat !== null).length;
  document.getElementById('dash-play-btn').disabled = withGps < 1;
  document.getElementById('play-hero-sub').textContent = withGps > 0
    ? `${withGps} photo${withGps !== 1 ? 's' : ''} ready to play`
    : 'Upload photos with GPS to start playing';
  const countEl = document.getElementById('dash-photo-count');
  if (countEl) countEl.textContent = userPhotos.length > 0 ? `${userPhotos.length} photo${userPhotos.length !== 1 ? 's' : ''}` : '';
}

export function renderGameStats(userId) {
  const { games, best } = getGameStats(userId);
  document.getElementById('stat-games-played').textContent = games > 0 ? games.toLocaleString() : '—';
  document.getElementById('stat-best-score').textContent = best !== null ? best.toLocaleString() : '—';
}

// ── Rejoin active room after page reload ─────────────────────────────────
export async function rejoinActiveRoom(roomId) {
  try {
    const { data: room, error } = await supabase
      .from('rooms').select('*').eq('id', roomId).single();
    if (error || !room) {
      sessionStorage.removeItem('activeRoomId');
      return false;
    }
    // Don't rejoin if kicked
    if ((room.kicked ?? []).includes(currentUser.id)) {
      sessionStorage.removeItem('activeRoomId');
      return false;
    }
    // Room is still playing — jump back in
    if (room.status === 'playing' && room.photos_data?.length) {
      currentRoom = room;
      if (unsubRoom) unsubRoom();
      subscribeRoom(room.id);
      startMultiplayerGame(room);
      return true;
    }
    // Room is still waiting — go back to lobby
    if (room.status === 'waiting') {
      currentRoom = room;
      const isHost = room.host_id === currentUser.id;
      showRoomLobby(room, isHost);
      subscribeRoom(room.id);
      return true;
    }
    // Room finished or unknown state — clear and ignore
    sessionStorage.removeItem('activeRoomId');
    return false;
  } catch {
    sessionStorage.removeItem('activeRoomId');
    return false;
  }
}

// ── Rooms List ────────────────────────────────────────────────────────────
async function loadRooms() {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, code, status, players, host_id, created_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });
    if (error) throw error;
    renderRoomsList(data ?? []);
  } catch {
    renderRoomsList([]);
  }
}

function subscribeRoomsList() {
  if (unsubRoomsList) unsubRoomsList();
  const channel = supabase
    .channel('dashboard-rooms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
      loadRooms();
    })
    .subscribe();
  unsubRoomsList = () => supabase.removeChannel(channel);
}

function renderRoomsList(rooms) {
  const el = document.getElementById('dash-rooms-list');
  el.innerHTML = '';
  if (!rooms.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="empty-state-title">No open rooms</div>
        <div class="empty-state-sub">Create one or wait for someone to open a room</div>
      </div>`;
    return;
  }

  rooms.forEach(r => {
    const isHost = r.host_id === currentUser.id;
    const alreadyIn = (r.players ?? []).some(p => p.id === currentUser.id);
    const playerCount = (r.players ?? []).length;
    const hostName = (r.players ?? []).find(p => p.id === r.host_id)?.name ?? 'Unknown';

    // Card
    const card = document.createElement('div');
    card.className = 'room-card';

    // Info
    const info = document.createElement('div');
    info.className = 'room-card-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'room-name';
    const codeSpan = document.createElement('span');
    codeSpan.style.cssText = 'font-family:monospace;letter-spacing:0.1em;font-size:15px;font-weight:700;';
    codeSpan.textContent = r.code;
    nameRow.appendChild(codeSpan);
    if (isHost) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-blue';
      badge.style.marginLeft = '8px';
      badge.textContent = 'Your room';
      nameRow.appendChild(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'room-meta';

    const hostSpan = document.createElement('span');
    hostSpan.textContent = `${hostName}'s room`;

    const playersSpan = document.createElement('span');
    playersSpan.className = 'room-players';
    playersSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;
    playersSpan.appendChild(document.createTextNode(` ${playerCount}/6`));

    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'display:flex;align-items:center;gap:5px;';
    statusSpan.innerHTML = '<span class="room-status-dot dot-green"></span>';
    statusSpan.appendChild(document.createTextNode('Waiting'));

    meta.append(hostSpan, playersSpan, statusSpan);
    info.append(nameRow, meta);

    // Button — static SVG icons are safe; only textContent carries user data
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm room-enter-btn';
    btn.innerHTML = alreadyIn
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    btn.appendChild(document.createTextNode(alreadyIn ? ' Enter' : ' Join'));
    btn.addEventListener('click', () => alreadyIn ? rejoinRoom(r.id) : joinRoomById(r.id));

    card.append(info, btn);
    el.appendChild(card);
  });
}

async function joinRoomById(roomId) {
  showLoading(true);
  try {
    const { data: room, error } = await supabase
      .from('rooms').select('code').eq('id', roomId).single();
    if (error || !room) throw new Error('Room not found.');
    const myPhotoIds = userPhotos.filter(p => p.lat !== null).map(p => p.id);
    const joined = await joinRoom(room.code, currentUser.id, getDisplayName(currentUser), myPhotoIds);
    currentRoom = joined;
    showRoomLobby(joined, false);
    subscribeRoom(joined.id);
  } catch (e) {
    toast(e.message, 'error');
  }
  showLoading(false);
}

async function rejoinRoom(roomId) {
  showLoading(true);
  try {
    const { data: room, error } = await supabase
      .from('rooms').select('*').eq('id', roomId).single();
    if (error || !room) throw new Error('Room not found.');
    if (room.status === 'playing' && room.photos_data?.length) {
      // Game already started — jump straight in
      currentRoom = room;
      if (unsubRoom) unsubRoom();
      unsubRoom = subscribeToRoom(room.id, (updated) => {
        currentRoom = updated;
        renderRoomPlayers(updated);
        if (updated.status === 'playing') startMultiplayerGame(updated);
      });
      startMultiplayerGame(room);
    } else {
      // Still in lobby
      currentRoom = room;
      const isHost = room.host_id === currentUser.id;
      showRoomLobby(room, isHost);
      subscribeRoom(room.id);
    }
  } catch (e) {
    toast(e.message, 'error');
  }
  showLoading(false);
}

// ── Photo Grid ─────────────────────────────────────────────────────────────

// SVG strings defined once — not recreated on every render
const SVG = {
  pin:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  globe:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  trash:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  dotGps: `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  dotNo:  `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  dotPub: `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  upload: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  prev:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`,
  next:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`,
};

// Build a photo tile DOM node (no innerHTML on the grid)
function buildPhotoTile(p) {
  const div = document.createElement('div');
  div.className = 'photo-item';
  div.dataset.id = p.id;

  const img = document.createElement('img');
  img.src = p.public_url;
  img.alt = p.original_name ?? '';
  img.loading = 'lazy';
  img.decoding = 'async';
  div.appendChild(img);

  const overlay = document.createElement('div');
  overlay.className = 'photo-item-overlay';
  const actions = document.createElement('div');
  actions.className = 'photo-item-actions';

  const locBtn = document.createElement('button');
  locBtn.className = 'photo-item-btn';
  locBtn.dataset.action = 'locate';
  locBtn.dataset.id = p.id;
  locBtn.title = 'Set location';
  locBtn.innerHTML = SVG.pin;

  const pubBtn = document.createElement('button');
  pubBtn.className = `photo-item-btn photo-item-btn--public${p.is_public ? ' active' : ''}`;
  pubBtn.dataset.action = 'toggle-public';
  pubBtn.dataset.id = p.id;
  pubBtn.dataset.public = p.is_public;
  pubBtn.title = p.is_public ? 'Make private' : 'Make public';
  pubBtn.innerHTML = SVG.globe;

  const delBtn = document.createElement('button');
  delBtn.className = 'photo-item-btn';
  delBtn.dataset.action = 'delete';
  delBtn.dataset.id = p.id;
  delBtn.dataset.path = p.storage_path;
  delBtn.title = 'Delete';
  delBtn.innerHTML = SVG.trash;

  actions.append(locBtn, pubBtn, delBtn);
  overlay.appendChild(actions);
  div.appendChild(overlay);

  const indicators = document.createElement('div');
  indicators.className = 'photo-indicators';
  const gpsDot = document.createElement('span');
  gpsDot.className = p.lat !== null ? 'photo-dot photo-dot--gps' : 'photo-dot photo-dot--nogps';
  gpsDot.title = p.lat !== null ? 'Has GPS' : 'No GPS';
  gpsDot.innerHTML = p.lat !== null ? SVG.dotGps : SVG.dotNo;
  indicators.appendChild(gpsDot);
  if (p.is_public) {
    const pubDot = document.createElement('span');
    pubDot.className = 'photo-dot photo-dot--public';
    pubDot.title = 'Public';
    pubDot.innerHTML = SVG.dotPub;
    indicators.appendChild(pubDot);
  }
  div.appendChild(indicators);
  return div;
}

// Update only the parts of an existing tile that changed (avoids full rebuild)
function patchTile(tile, p) {
  const img = tile.querySelector('img');
  if (img && img.src !== p.public_url) img.src = p.public_url;

  const pubBtn = tile.querySelector('[data-action="toggle-public"]');
  if (pubBtn) {
    const isPublic = pubBtn.dataset.public === 'true';
    if (isPublic !== p.is_public) {
      pubBtn.dataset.public = p.is_public;
      pubBtn.title = p.is_public ? 'Make private' : 'Make public';
      pubBtn.classList.toggle('active', p.is_public);
    }
  }

  const delBtn = tile.querySelector('[data-action="delete"]');
  if (delBtn && delBtn.dataset.path !== p.storage_path) delBtn.dataset.path = p.storage_path;

  const indicators = tile.querySelector('.photo-indicators');
  if (indicators) {
    const gpsDot = indicators.querySelector('.photo-dot');
    const wantsGps = p.lat !== null;
    const hasGps = gpsDot?.classList.contains('photo-dot--gps');
    if (wantsGps !== hasGps) {
      // GPS state changed — rebuild indicators cheaply
      indicators.innerHTML = '';
      const dot = document.createElement('span');
      dot.className = wantsGps ? 'photo-dot photo-dot--gps' : 'photo-dot photo-dot--nogps';
      dot.title = wantsGps ? 'Has GPS' : 'No GPS';
      dot.innerHTML = wantsGps ? SVG.dotGps : SVG.dotNo;
      indicators.appendChild(dot);
    }
    const pubDot = indicators.querySelector('.photo-dot--public');
    if (p.is_public && !pubDot) {
      const d = document.createElement('span');
      d.className = 'photo-dot photo-dot--public';
      d.title = 'Public';
      d.innerHTML = SVG.dotPub;
      indicators.appendChild(d);
    } else if (!p.is_public && pubDot) {
      pubDot.remove();
    }
  }
}

function getPageSlice() {
  const page1Photos = PAGE_SIZE - 1;
  const totalPages = userPhotos.length <= page1Photos
    ? 1
    : 1 + Math.ceil((userPhotos.length - page1Photos) / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
  const pageSize = currentPage === 1 ? page1Photos : PAGE_SIZE;
  const start = currentPage === 1 ? 0 : page1Photos + (currentPage - 2) * PAGE_SIZE;
  return { page: userPhotos.slice(start, start + pageSize), start, pageSize, totalPages };
}

function wireGridEvents(grid) {
  // Single delegated listener — wired once, never re-added
  if (grid.dataset.wired) return;
  grid.dataset.wired = '1';

  const mq = window.matchMedia('(max-width: 768px)');

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const { action, id, path } = btn.dataset;
      if (action === 'locate')        handleLocate(id);
      if (action === 'toggle-public') handleTogglePublic(id, btn.dataset.public === 'true');
      if (action === 'delete')        handleDelete(id, path);
      return;
    }
    const item = e.target.closest('.photo-item');
    if (!item || item.classList.contains('photo-upload-tile')) return;
    if (mq.matches) {
      if (item.classList.contains('selected')) {
        const img = item.querySelector('img');
        openDashLightbox(img.src, img.alt);
      } else {
        grid.querySelectorAll('.photo-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
      }
    } else {
      const img = item.querySelector('img');
      openDashLightbox(img.src, img.alt);
    }
  });

  document.addEventListener('click', e => {
    if (!grid.contains(e.target))
      grid.querySelectorAll('.photo-item.selected').forEach(el => el.classList.remove('selected'));
  }, { capture: true });
}

function renderPhotoGrid() {
  const grid = document.getElementById('dash-photo-grid');
  const paginationEl = document.getElementById('dash-pagination');

  wireGridEvents(grid);

  if (userPhotos.length === 0) {
    // Keep the upload tile if it's the only child, otherwise rebuild
    if (grid.children.length !== 1 || !grid.firstElementChild.classList.contains('photo-upload-tile')) {
      grid.innerHTML = '';
      const label = document.createElement('label');
      label.className = 'photo-item photo-upload-tile';
      label.htmlFor = 'dash-file-input';
      label.innerHTML = SVG.upload + '<span>Upload Photos</span>';
      grid.appendChild(label);
    }
    paginationEl.style.display = 'none';
    return;
  }

  const { page, start, pageSize, totalPages } = getPageSlice();

  // Build the desired ordered list of keys for this page
  const desiredKeys = [];
  if (currentPage === 1) desiredKeys.push('__upload__');
  page.forEach(p => desiredKeys.push(p.id));

  // Index existing tiles by key
  const existing = new Map();
  for (const child of grid.children) {
    const key = child.dataset.id ?? '__upload__';
    existing.set(key, child);
  }

  // Reconcile: insert/move/patch tiles to match desired order
  desiredKeys.forEach((key, i) => {
    let tile = existing.get(key);
    if (!tile) {
      if (key === '__upload__') {
        tile = document.createElement('label');
        tile.className = 'photo-item photo-upload-tile';
        tile.htmlFor = 'dash-file-input';
        tile.innerHTML = SVG.upload + '<span>Upload Photos</span>';
      } else {
        const p = page.find(x => x.id === key);
        tile = buildPhotoTile(p);
      }
    } else if (key !== '__upload__') {
      patchTile(tile, page.find(x => x.id === key));
    }
    // Move to correct position if needed
    const current = grid.children[i];
    if (current !== tile) grid.insertBefore(tile, current ?? null);
  });

  // Remove tiles no longer in this page
  const desiredSet = new Set(desiredKeys);
  for (const [key, tile] of existing) {
    if (!desiredSet.has(key)) tile.remove();
  }

  // Pagination
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }
  paginationEl.style.display = 'flex';
  const from = start + 1, to = Math.min(start + pageSize, userPhotos.length);
  paginationEl.innerHTML = `
    <span class="pagination-info">${from}–${to} of ${userPhotos.length}</span>
    <div class="pagination-controls">
      <button class="page-btn" id="page-prev" ${currentPage === 1 ? 'disabled' : ''}>${SVG.prev}</button>
      ${Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
        .reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
          acc.push(p); return acc;
        }, [])
        .map(p => p === '…'
          ? `<span style="padding:0 4px;color:var(--gray-400);">…</span>`
          : `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
      <button class="page-btn" id="page-next" ${currentPage === totalPages ? 'disabled' : ''}>${SVG.next}</button>
    </div>`;
  paginationEl.querySelector('#page-prev')?.addEventListener('click', () => { currentPage--; renderPhotoGrid(); });
  paginationEl.querySelector('#page-next')?.addEventListener('click', () => { currentPage++; renderPhotoGrid(); });
  paginationEl.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.page); renderPhotoGrid(); });
  });
}

async function handleLocate(photoId) {
  const photo = userPhotos.find(p => p.id === photoId);
  if (!photo) return;
  const result = await openLocationPicker(photo.original_name, photo.lat, photo.lng);
  if (!result) return;
  try {
    await updatePhotoLocation(photoId, result.lat, result.lng);
    toast('Location saved!', 'success');
    patchPhoto(photoId, { lat: result.lat, lng: result.lng });
  } catch {
    toast('Could not save location.', 'error');
  }
}

async function handleTogglePublic(photoId, currentlyPublic) {
  const next = !currentlyPublic;
  try {
    await togglePhotoPublic(photoId, next);
    toast(next ? 'Photo is now public 🌐' : 'Photo is now private', 'success');
    patchPhoto(photoId, { is_public: next });
  } catch {
    toast('Could not update visibility.', 'error');
  }
}

async function handleDelete(photoId, storagePath) {
  const confirmed = await confirmDelete();
  if (!confirmed) return;
  try {
    await deletePhoto(photoId, storagePath);
    toast('Photo deleted.', 'success');
    userPhotos = userPhotos.filter(p => p.id !== photoId);
    // Clamp page if last item on page was deleted
    const page1Photos = PAGE_SIZE - 1;
    const totalPages = userPhotos.length <= page1Photos ? 1 : 1 + Math.ceil((userPhotos.length - page1Photos) / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
    renderPhotoGrid();
    updateStats();
    renderGpsBanner();
  } catch {
    toast('Could not delete photo.', 'error');
  }
}

// ── Upload ─────────────────────────────────────────────────────────────────
async function handleFiles(files) {
  const accepted = await showGuidelinesIfNeeded();
  if (!accepted) return;

  try { await assertNotSuspended(); } catch (e) { toast(e.message, 'error'); return; }

  const imageFiles = Array.from(files).filter(f => {
    const err = validateFile(f);
    if (err) { toast(err, 'error'); return false; }
    return true;
  });
  if (imageFiles.length === 0) return;

  const total = imageFiles.length;
  showLoading(true, 0, total);
  let uploaded = 0;
  for (let i = 0; i < imageFiles.length; i++) {
    showLoading(true, i, total);
    const safetyErr = await checkImageSafety(imageFiles[i]);
    if (safetyErr) {
      toast(safetyErr, 'error');
      continue;
    }
    try {
      await uploadPhoto(imageFiles[i], currentUser.id);
      uploaded++;
    } catch (e) {
      toast(`Failed to upload ${imageFiles[i].name}: ${e.message}`, 'error');
    }
    showLoading(true, i + 1, total);
  }
  showLoading(false);
  if (uploaded > 0) {
    toast(`${uploaded} photo${uploaded > 1 ? 's' : ''} uploaded!`, 'success');
    await refreshPhotos();
  }
}

// ── Solo game ──────────────────────────────────────────────────────────────
export async function startSoloGame() {
  try { await assertNotSuspended(); } catch (e) { toast(e.message, 'error'); return; }
  const playable = userPhotos.filter(p => p.lat !== null);
  if (playable.length === 0) {
    toast('No photos with location data. Set locations first.', 'error');
    return;
  }
  const includeOwn = document.getElementById('include-own-toggle')?.checked !== false;
  let photos = includeOwn ? [...playable] : [];
  if (document.getElementById('include-community-toggle')?.checked) {
    try {
      const community = await getPublicPhotos(100);
      const myIds = new Set(playable.map(p => p.id));
      const others = community.filter(p => !myIds.has(p.id));
      photos = [...photos, ...others];
    } catch {
      toast('Could not load community photos.', 'error');
    }
  }
  if (photos.length === 0) {
    toast('No photos to play with. Enable community photos or include your own.', 'error');
    return;
  }
  startGame(photos, currentUser.id);
}

// ── Multiplayer ────────────────────────────────────────────────────────────
async function handleCreateRoom() {
  try { await assertNotSuspended(); } catch (e) { toast(e.message, 'error'); return; }
  const playable = userPhotos.filter(p => p.lat !== null);
  if (playable.length === 0) {
    toast('Upload photos with locations first.', 'error');
    return;
  }
  showLoading(true);
  try {
    const includeOwn = document.getElementById('include-own-toggle')?.checked !== false;
    const photoIds = playable.map(p => p.id);
    const room = await createRoom(currentUser.id, getDisplayName(currentUser), { photoIds, includeOwn });
    currentRoom = room;
    showRoomLobby(room, true);
    subscribeRoom(room.id);
  } catch (e) {
    toast(e.message, 'error');
  }
  showLoading(false);
}

export async function joinRoomByCode(code) {
  showLoading(true);
  try {
    const myPhotoIds = userPhotos.filter(p => p.lat !== null).map(p => p.id);
    const room = await joinRoom(code, currentUser.id, getDisplayName(currentUser), myPhotoIds);
    currentRoom = room;
    showRoomLobby(room, false);
    subscribeRoom(room.id);
  } finally {
    showLoading(false);
  }
}

async function handleKickPlayer(playerId) {
  if (!currentRoom) return;
  try {
    await kickPlayer(currentRoom.id, playerId);
  } catch {
    toast('Could not kick player.', 'error');
  }
}

function subscribeRoom(roomId) {
  if (unsubRoom) unsubRoom();
  unsubRoom = subscribeToRoom(roomId, (updated) => {
    if (!updated) {
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentRoom = null;
      showScreen('dashboard');
      toast('The host closed the room.', 'error');
      return;
    }
    // Check if current user was kicked
    const wasKicked = (updated.kicked ?? []).includes(currentUser.id);
    if (wasKicked) {
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentRoom = null;
      showScreen('dashboard');
      toast('You were removed from the room by the host.', 'error');
      return;
    }
    currentRoom = updated;
    renderRoomPlayers(updated);
    if (updated.status === 'playing') {
      startMultiplayerGame(updated);
    }
  });
}

function showRoomLobby(room, isHost) {
  document.getElementById('room-code-value').textContent = room.code;
  document.getElementById('room-start-btn').style.display = isHost ? '' : 'none';
  renderRoomPlayers(room);
  showScreen('room');
}

function renderRoomPlayers(room) {
  const isHost = room.host_id === currentUser?.id;

  // Sync rounds select
  const roundsSelect = document.getElementById('room-rounds-select');
  roundsSelect.value = room.rounds ?? 5;
  roundsSelect.disabled = !isHost;
  roundsSelect.style.opacity = isHost ? '' : '0.5';
  roundsSelect.style.cursor = isHost ? '' : 'not-allowed';

  // Sync community toggle state for all players from the room record
  const communityToggle = document.getElementById('room-community-toggle');
  const communityLabel = document.getElementById('room-community-label');
  const communityOn = room.include_community ?? false;
  communityToggle.checked = communityOn;
  communityLabel.classList.toggle('is-on', communityOn);
  communityToggle.disabled = !isHost;
  communityLabel.style.opacity = isHost ? '' : '0.5';
  communityLabel.style.cursor = isHost ? '' : 'not-allowed';
  document.getElementById('room-community-sub').textContent = communityOn
    ? "On — community photos included"
    : "Off — only players' photos";

  // Sync include-own toggle for current user (room setting row removed — handled via player card button)
  const myPlayer = (room.players ?? []).find(p => p.id === currentUser?.id);
  const includeOwnOn = myPlayer?.include_own !== false;
  const includeOwnToggle = document.getElementById('room-include-own-toggle');
  const includeOwnLabel = document.getElementById('room-include-own-label');
  if (includeOwnToggle && includeOwnLabel) {
    includeOwnToggle.checked = includeOwnOn;
    includeOwnLabel.classList.toggle('is-on', includeOwnOn);
    document.getElementById('room-include-own-sub').textContent = includeOwnOn
      ? "On — your photos are in the pool"
      : "Off — your photos excluded";
  }

  const players = room.players ?? [];
  document.getElementById('room-player-count').textContent = players.length;
  document.getElementById('room-players-grid').innerHTML = players.map(p => {
    const photoCount = (p.photo_ids ?? []).length;
    const includeOwn = p.include_own !== false;
    const isMe = p.id === currentUser?.id;
    return `
    <div class="room-player-card card-flat">
      <div class="room-player-avatar">${escapeHtml(p.name.slice(0,2).toUpperCase())}</div>
      <div class="room-player-name">${escapeHtml(p.name)}</div>
      <div class="room-player-status" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        ${p.is_host ? '<span class="badge badge-blue">Host</span>' : '<span class="badge badge-gray">Player</span>'}
        <span class="badge ${includeOwn ? 'badge-green' : 'badge-gray'}" title="Photos with GPS">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          ${includeOwn ? photoCount : '0 (excluded)'}
        </span>
        ${isMe && !p.is_host ? `<button class="btn btn-ghost btn-sm room-include-own-btn" data-player-id="${p.id}" data-include="${includeOwn}" title="${includeOwn ? 'Exclude my photos' : 'Include my photos'}" style="font-size:11px;padding:2px 6px;">${includeOwn ? 'Exclude mine' : 'Include mine'}</button>` : ''}
        ${isHost && !p.is_host ? `<button class="btn btn-danger btn-sm room-kick-btn" data-player-id="${p.id}" style="font-size:11px;padding:2px 6px;">Kick</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // Wire kick buttons
  document.getElementById('room-players-grid').querySelectorAll('.room-kick-btn').forEach(btn => {
    btn.addEventListener('click', () => handleKickPlayer(btn.dataset.playerId));
  });

  // Wire include-own toggle buttons
  document.getElementById('room-players-grid').querySelectorAll('.room-include-own-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const currentVal = btn.dataset.include === 'true';
      const newVal = !currentVal;
      // Validate: can't exclude own photos if it would leave zero sources
      if (!newVal) {
        const communityOn = currentRoom?.include_community ?? false;
        const otherPhotos = (currentRoom?.players ?? [])
          .filter(p => p.id !== currentUser.id && p.include_own !== false)
          .reduce((s, p) => s + (p.photo_ids ?? []).length, 0);
        if (!communityOn && otherPhotos === 0) {
          toast('At least one photo source must be active.', 'error');
          return;
        }
      }
      try {
        await updatePlayerIncludeOwn(currentRoom.id, currentUser.id, newVal);
      } catch {
        toast('Could not update preference.', 'error');
      }
    });
  });

  // Enable start if host and 2+ players and at least someone contributes photos
  const totalPhotos = players.reduce((s, p) => s + ((p.include_own !== false) ? (p.photo_ids ?? []).length : 0), 0);
  const startBtn = document.getElementById('room-start-btn');
  if (startBtn) startBtn.disabled = !isHost || players.length < 2 || (totalPhotos === 0 && !communityOn);
}

async function startMultiplayerGame(room) {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  const photos = room.photos_data;
  if (!photos?.length) return;
  startMP(photos, room.id, currentUser.id, getDisplayName(currentUser), room.host_id === currentUser.id, room);
}

// ── Photo Lightbox ────────────────────────────────────────────────────────
function openDashLightbox(src, alt) {
  const overlay = document.createElement('div');
  overlay.className = 'dash-lightbox';
  // Build with DOM API so user-supplied alt text can never inject HTML
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dash-lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  overlay.append(img, closeBtn);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));

  const close = () => {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  img.addEventListener('click', e => e.stopPropagation());
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
}

// ── Wire events ────────────────────────────────────────────────────────────
function wireEvents() {
  if (eventsWired) return;
  eventsWired = true;
  // Upload
  const fileInput = document.getElementById('dash-file-input');
  fileInput.addEventListener('change', e => { const files = Array.from(e.target.files); fileInput.value = ''; handleFiles(files); });

  // Full-page drag overlay
  const dragOverlay = document.getElementById('drag-overlay');
  let dragCounter = 0;
  document.addEventListener('dragenter', e => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragCounter++;
    dragOverlay.classList.add('active');
  });
  document.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('active'); }
  });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  // Play / room
  document.getElementById('dash-play-btn').addEventListener('click', startSoloGame);
  document.getElementById('dash-room-btn').addEventListener('click', handleCreateRoom);
  // dash-join-btn is handled by main.js (opens the join modal)

  // Room lobby
  document.getElementById('room-back-btn').addEventListener('click', async () => {
    if (currentRoom) {
      await leaveRoom(currentRoom.id, currentUser.id).catch(() => {});
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentRoom = null;
    }
    clearSnapshot();
    showScreen('dashboard');
  });
  document.getElementById('room-copy-btn').addEventListener('click', () => {
    const code = document.getElementById('room-code-value').textContent.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => toast('Code copied!', 'success')).catch(() => fallbackCopy(code));
    } else {
      fallbackCopy(code);
    }
  });
  document.getElementById('room-start-btn').addEventListener('click', async () => {
    if (!currentRoom) return;
    const rounds = parseInt(document.getElementById('room-rounds-select').value);
    const includeCommunity = document.getElementById('room-community-toggle').checked;
    try {
      await startRoom(currentRoom.id, rounds, includeCommunity);
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  document.getElementById('room-leave-btn').addEventListener('click', async () => {
    if (currentRoom) {
      await leaveRoom(currentRoom.id, currentUser.id).catch(() => {});
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentRoom = null;
    }
    clearSnapshot();
    showScreen('dashboard');
  });

  document.getElementById('room-rounds-select').addEventListener('change', async (e) => {
    if (currentRoom) {
      try {
        await updateRoomSettings(currentRoom.id, { rounds: parseInt(e.target.value) });
      } catch {
        toast('Could not update setting.', 'error');
      }
    }
  });

  document.getElementById('room-community-toggle').addEventListener('change', async (e) => {
    const on = e.target.checked;
    document.getElementById('room-community-label').classList.toggle('is-on', on);
    document.getElementById('room-community-sub').textContent = on
      ? "On — community photos included"
      : "Off — only players' photos";
    if (currentRoom) {
      try {
        await updateRoomSettings(currentRoom.id, { include_community: on });
      } catch {
        toast('Could not update setting.', 'error');
      }
    }
  });

  document.getElementById('room-include-own-toggle').addEventListener('change', async (e) => {
    const on = e.target.checked;
    // Validate: can't turn off own photos if community is also off and no other player has photos
    if (!on) {
      const communityOn = document.getElementById('room-community-toggle')?.checked;
      const otherPhotos = (currentRoom?.players ?? [])
        .filter(p => p.id !== currentUser.id && p.include_own !== false)
        .reduce((s, p) => s + (p.photo_ids ?? []).length, 0);
      if (!communityOn && otherPhotos === 0) {
        e.target.checked = true; // revert
        document.getElementById('room-include-own-label').classList.add('is-on');
        toast('At least one photo source must be active.', 'error');
        return;
      }
    }
    document.getElementById('room-include-own-label').classList.toggle('is-on', on);
    document.getElementById('room-include-own-sub').textContent = on
      ? "On — your photos are in the pool"
      : "Off — your photos excluded";
    if (currentRoom) {
      try {
        await updatePlayerIncludeOwn(currentRoom.id, currentUser.id, on);
      } catch {
        toast('Could not update preference.', 'error');
      }
    }
  });

  // Delete room if host closes the tab
  window.addEventListener('beforeunload', () => {
    if (currentRoom && currentRoom.host_id === currentUser?.id) {
      // Use sendBeacon for reliable fire-and-forget on tab close
      const url = `https://ghebsyimjlbboayvbnso.supabase.co/rest/v1/rooms?id=eq.${currentRoom.id}`;
      navigator.sendBeacon(url); // won't work without auth — best effort only
      // Fallback: synchronous fetch (may be blocked by browser)
      leaveRoom(currentRoom.id, currentUser.id).catch(() => {});
    }
  });

  // Nav user dropdown
  const navUserBtn = document.getElementById('nav-user-btn');
  const navDropdown = document.getElementById('nav-dropdown');
  navUserBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navDropdown.classList.toggle('open');
    navUserBtn.classList.toggle('open', isOpen);
  });
  document.addEventListener('click', () => {
    navDropdown.classList.remove('open');
    navUserBtn.classList.remove('open');
  });

  // Sign out
  document.getElementById('nav-signout-btn').addEventListener('click', async () => {
    if (unsubRoomsList) { unsubRoomsList(); unsubRoomsList = null; }
    if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    photosCached = false;
    userPhotos = [];
    await signOut().catch(() => {});
  });

  // Auto-join from URL ?join=CODE is handled by the join modal in main.js
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); toast('Code copied!', 'success'); } catch { toast('Copy failed — share the code manually.', 'error'); }
  document.body.removeChild(ta);
}

export function showLoading(show, current = 0, total = 0) {
  document.getElementById('loading-overlay').classList.toggle('show', show);
  const progress = document.getElementById('loading-progress');
  const text = document.getElementById('loading-text');
  if (!show || total <= 1) {
    progress?.classList.add('hidden');
    if (text) text.textContent = show ? 'Uploading…' : 'Loading…';
    return;
  }
  progress?.classList.remove('hidden');
  const pct = Math.round((current / total) * 100);
  document.getElementById('loading-bar-fill').style.width = pct + '%';
  document.getElementById('loading-counter').textContent = `${current} of ${total} photos`;
  if (text) text.textContent = 'Uploading photos…';
}
