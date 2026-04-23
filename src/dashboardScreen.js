/**
 * dashboardScreen.js
 * Dashboard: photo upload, grid, solo play, multiplayer rooms.
 */

import { supabase } from './supabase.js';
import { signOut, getDisplayName } from './auth.js';
import { validateFile, uploadPhoto, getUserPhotos, deletePhoto, updatePhotoLocation, togglePhotoPublic, getPublicPhotos } from './photos.js';
import { createRoom, joinRoom, subscribeToRoom, startRoom, leaveRoom } from './rooms.js';
import { openLocationPicker } from './locationPicker.js';
import { startSoloGame as startGame, startMultiplayerGame as startMP, clearSnapshot } from './game.js';
import { showScreen, toast, escapeHtml } from './utils.js';
import { confirmDelete } from './modals.js';

let currentUser = null;
let userPhotos = [];
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
  await Promise.all([refreshPhotos(), loadRooms()]);
  subscribeRoomsList();
}

async function refreshPhotos() {
  try {
    userPhotos = await getUserPhotos(currentUser.id);
    currentPage = 1;
    renderPhotoGrid();
    updateStats();
  } catch (e) {
    toast('Could not load photos.', 'error');
  }
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

// ── Rejoin active room after page reload ─────────────────────────────────
export async function rejoinActiveRoom(roomId) {
  try {
    const { data: room, error } = await supabase
      .from('rooms').select('*').eq('id', roomId).single();
    if (error || !room) {
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
function renderPhotoGrid() {
  const grid = document.getElementById('dash-photo-grid');
  const paginationEl = document.getElementById('dash-pagination');

  if (userPhotos.length === 0) {
    grid.innerHTML = '';
    paginationEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(userPhotos.length / PAGE_SIZE);
  // Clamp currentPage in case photos were deleted
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = userPhotos.slice(start, start + PAGE_SIZE);

  grid.innerHTML = page.map(p => `
    <div class="photo-item" data-id="${p.id}">
      <img src="${p.public_url}" alt="${escapeHtml(p.original_name ?? '')}" loading="lazy">
      <div class="photo-item-overlay">
        <div class="photo-item-actions">
          <button class="photo-item-btn" data-action="locate" data-id="${p.id}" title="Set location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </button>
          <button class="photo-item-btn photo-item-btn--public ${p.is_public ? 'active' : ''}" data-action="toggle-public" data-id="${p.id}" data-public="${p.is_public}" title="${p.is_public ? 'Make private' : 'Make public'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </button>
          <button class="photo-item-btn" data-action="delete" data-id="${p.id}" data-path="${p.storage_path}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="photo-indicators">
        ${p.lat !== null
          ? '<span class="photo-dot photo-dot--gps" title="Has GPS"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>'
          : '<span class="photo-dot photo-dot--nogps" title="No GPS"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>'
        }${p.is_public ? '<span class="photo-dot photo-dot--public" title="Public"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>' : ''}
      </div>
    </div>
  `).join('');

  // Toggle selected on mobile/tablet; action buttons handle their own clicks
  grid.querySelectorAll('.photo-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 768px)').matches) {
        const isSelected = item.classList.contains('selected');
        grid.querySelectorAll('.photo-item.selected').forEach(el => el.classList.remove('selected'));
        if (!isSelected) item.classList.add('selected');
      }
    });
  });
  // Deselect when clicking outside the grid
  document.addEventListener('click', (e) => {
    if (!grid.contains(e.target)) {
      grid.querySelectorAll('.photo-item.selected').forEach(el => el.classList.remove('selected'));
    }
  }, { capture: true });

  grid.querySelectorAll('[data-action="locate"]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleLocate(btn.dataset.id); });
  });
  grid.querySelectorAll('[data-action="toggle-public"]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleTogglePublic(btn.dataset.id, btn.dataset.public === 'true'); });
  });
  grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleDelete(btn.dataset.id, btn.dataset.path); });
  });

  // Pagination
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }
  paginationEl.style.display = 'flex';
  const from = start + 1, to = Math.min(start + PAGE_SIZE, userPhotos.length);
  paginationEl.innerHTML = `
    <span class="pagination-info">${from}–${to} of ${userPhotos.length}</span>
    <div class="pagination-controls">
      <button class="page-btn" id="page-prev" ${currentPage === 1 ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      ${Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
        .reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
          acc.push(p);
          return acc;
        }, [])
        .map(p => p === '…'
          ? `<span style="padding:0 4px;color:var(--gray-400);">…</span>`
          : `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
      <button class="page-btn" id="page-next" ${currentPage === totalPages ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  `;
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
    await refreshPhotos();
  } catch {
    toast('Could not save location.', 'error');
  }
}

async function handleTogglePublic(photoId, currentlyPublic) {
  const next = !currentlyPublic;
  try {
    await togglePhotoPublic(photoId, next);
    toast(next ? 'Photo is now public 🌐' : 'Photo is now private', 'success');
    await refreshPhotos();
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
    await refreshPhotos();
  } catch {
    toast('Could not delete photo.', 'error');
  }
}

// ── Upload ─────────────────────────────────────────────────────────────────
async function handleFiles(files) {
  const imageFiles = Array.from(files).filter(f => {
    const err = validateFile(f);
    if (err) { toast(err, 'error'); return false; }
    return true;
  });
  if (imageFiles.length === 0) return;

  showLoading(true);
  let uploaded = 0;
  for (const file of imageFiles) {
    try {
      await uploadPhoto(file, currentUser.id);
      uploaded++;
    } catch (e) {
      toast(`Failed to upload ${file.name}: ${e.message}`, 'error');
    }
  }
  showLoading(false);
  if (uploaded > 0) {
    toast(`${uploaded} photo${uploaded > 1 ? 's' : ''} uploaded!`, 'success');
    await refreshPhotos();
  }
}

// ── Solo game ──────────────────────────────────────────────────────────────
export async function startSoloGame() {
  const playable = userPhotos.filter(p => p.lat !== null);
  if (playable.length === 0) {
    toast('No photos with location data. Set locations first.', 'error');
    return;
  }
  let photos = [...playable];
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
  startGame(photos, currentUser.id);
}

// ── Multiplayer ────────────────────────────────────────────────────────────
async function handleCreateRoom() {
  const playable = userPhotos.filter(p => p.lat !== null);
  if (playable.length === 0) {
    toast('Upload photos with locations first.', 'error');
    return;
  }
  showLoading(true);
  try {
    let photoIds = playable.map(p => p.id);
    if (document.getElementById('include-community-toggle')?.checked) {
      try {
        const community = await getPublicPhotos(100);
        const myIdSet = new Set(photoIds);
        community.filter(p => !myIdSet.has(p.id)).forEach(p => photoIds.push(p.id));
      } catch {}
    }
    const room = await createRoom(currentUser.id, getDisplayName(currentUser), { photoIds });
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

function subscribeRoom(roomId) {
  if (unsubRoom) unsubRoom();
  unsubRoom = subscribeToRoom(roomId, (updated) => {
    // null means the room was deleted (host left or disconnected)
    if (!updated) {
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentRoom = null;
      showScreen('dashboard');
      toast('The host closed the room.', 'error');
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
  const players = room.players ?? [];
  document.getElementById('room-player-count').textContent = players.length;
  document.getElementById('room-players-grid').innerHTML = players.map(p => {
    const photoCount = (p.photo_ids ?? []).length;
    return `
    <div class="room-player-card card-flat">
      <div class="room-player-avatar">${escapeHtml(p.name.slice(0,2).toUpperCase())}</div>
      <div class="room-player-name">${escapeHtml(p.name)}</div>
      <div class="room-player-status" style="display:flex;align-items:center;gap:6px;">
        ${p.is_host ? '<span class="badge badge-blue">Host</span>' : '<span class="badge badge-gray">Player</span>'}
        <span class="badge badge-green" title="Photos with GPS">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          ${photoCount}
        </span>
      </div>
    </div>`;
  }).join('');
  // Enable start if host and 2+ players and at least someone has photos
  const isHost = room.host_id === currentUser?.id;
  const totalPhotos = players.reduce((s, p) => s + (p.photo_ids ?? []).length, 0);
  const startBtn = document.getElementById('room-start-btn');
  if (startBtn) startBtn.disabled = !isHost || players.length < 2 || totalPhotos === 0;
}

async function startMultiplayerGame(room) {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  const photos = room.photos_data;
  if (!photos?.length) return;
  startMP(photos, room.id, currentUser.id, getDisplayName(currentUser), room.host_id === currentUser.id, room);
}

// ── Wire events ────────────────────────────────────────────────────────────
function wireEvents() {
  if (eventsWired) return;
  eventsWired = true;
  // Upload
  const dropZone = document.getElementById('dash-drop-zone');
  const fileInput = document.getElementById('dash-file-input');
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });

  // Play / room
  document.getElementById('dash-play-btn').addEventListener('click', startSoloGame);
  document.getElementById('dash-room-btn').addEventListener('click', handleCreateRoom);
  // dash-join-btn is handled by main.js (opens the join modal)

  // Room lobby
  document.getElementById('room-back-btn').addEventListener('click', () => {
    if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    clearSnapshot();
    showScreen('dashboard');
  });
  document.getElementById('room-copy-btn').addEventListener('click', () => {
    const code = document.getElementById('room-code-value').textContent.trim();
    navigator.clipboard.writeText(code).then(() => toast('Code copied!', 'success'));
  });
  document.getElementById('room-start-btn').addEventListener('click', async () => {
    if (!currentRoom) return;
    const rounds = parseInt(document.getElementById('room-rounds-select').value);
    try {
      await startRoom(currentRoom.id, rounds);
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
    await signOut().catch(() => {});
  });

  // Auto-join from URL ?join=CODE is handled by the join modal in main.js
}

export function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('show', show);
}
