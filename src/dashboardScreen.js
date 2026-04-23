/**
 * dashboardScreen.js
 * Dashboard: photo upload, grid, solo play, multiplayer rooms.
 */

import { supabase } from './supabase.js';
import { signOut, getDisplayName } from './auth.js';
import { validateFile, uploadPhoto, getUserPhotos, deletePhoto, updatePhotoLocation } from './photos.js';
import { createRoom, joinRoom, subscribeToRoom, startRoom, leaveRoom } from './rooms.js';
import { openLocationPicker } from './locationPicker.js';
import { startSoloGame as startGame, startMultiplayerGame as startMP } from './game.js';
import { showScreen, toast, escapeHtml } from './utils.js';

let currentUser = null;
let userPhotos = [];
let unsubRoom = null;
let unsubRoomsList = null;
let currentRoom = null;
let eventsWired = false;

// ── Init (called once at startup) ─────────────────────────────────────────
export function initDashboard() {
  wireEvents();
}

// ── Load dashboard ─────────────────────────────────────────────────────────
export async function loadDashboard(user) {
  currentUser = user;
  const name = getDisplayName(user);
  document.getElementById('dash-greeting').textContent = `Welcome back, ${name}`;
  document.getElementById('nav-username').textContent = name;
  await Promise.all([refreshPhotos(), loadRooms()]);
  subscribeRoomsList();
}

async function refreshPhotos() {
  try {
    userPhotos = await getUserPhotos(currentUser.id);
    renderPhotoGrid();
    updateStats();
  } catch (e) {
    toast('Could not load photos.', 'error');
  }
}

function updateStats() {
  document.getElementById('stat-photos').textContent = userPhotos.length;
  // games/best score would come from a scores table — show placeholders for now
  const playable = userPhotos.filter(p => p.lat !== null).length;
  document.getElementById('dash-play-btn').disabled = playable < 1;
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
  el.innerHTML = rooms.map(r => {
    const isHost = r.host_id === currentUser.id;
    const alreadyIn = (r.players ?? []).some(p => p.id === currentUser.id);
    const playerCount = (r.players ?? []).length;
    const hostName = (r.players ?? []).find(p => p.id === r.host_id)?.name ?? 'Unknown';
    const btnLabel = alreadyIn ? 'Enter' : 'Join';
    const btnIcon = alreadyIn
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    return `
      <div class="room-card">
        <div class="room-card-info">
          <div class="room-name">
            <span style="font-family:monospace;letter-spacing:0.1em;font-size:15px;font-weight:700;">${escapeHtml(r.code)}</span>
            ${isHost ? '<span class="badge badge-blue" style="margin-left:8px;">Your room</span>' : ''}
          </div>
          <div class="room-meta">
            <span>${escapeHtml(hostName)}'s room</span>
            <span class="room-players">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              ${playerCount}/6
            </span>
            <span style="display:flex;align-items:center;gap:5px;">
              <span class="room-status-dot dot-green"></span>
              Waiting
            </span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm room-enter-btn" data-room-id="${r.id}" data-already-in="${alreadyIn}">
          ${btnIcon} ${btnLabel}
        </button>
      </div>`;
  }).join('');

  el.querySelectorAll('.room-enter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const alreadyIn = btn.dataset.alreadyIn === 'true';
      if (alreadyIn) {
        rejoinRoom(btn.dataset.roomId);
      } else {
        joinRoomById(btn.dataset.roomId);
      }
    });
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
  if (userPhotos.length === 0) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = userPhotos.map(p => `
    <div class="photo-item" data-id="${p.id}">
      <img src="${p.public_url}" alt="${escapeHtml(p.original_name ?? '')}" loading="lazy">
      <div class="photo-item-overlay">
        <div class="photo-item-actions">
          <button class="photo-item-btn" data-action="locate" data-id="${p.id}" title="Set location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </button>
          <button class="photo-item-btn" data-action="delete" data-id="${p.id}" data-path="${p.storage_path}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="photo-badge">
        ${p.lat !== null
          ? '<span class="badge badge-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> GPS</span>'
          : '<span class="badge badge-amber"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> No GPS</span>'
        }
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-action="locate"]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleLocate(btn.dataset.id); });
  });
  grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleDelete(btn.dataset.id, btn.dataset.path); });
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

async function handleDelete(photoId, storagePath) {
  if (!confirm('Delete this photo?')) return;
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
export function startSoloGame() {
  const playable = userPhotos.filter(p => p.lat !== null);
  if (playable.length === 0) {
    toast('No photos with location data. Set locations first.', 'error');
    return;
  }
  startGame(playable);
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
    const room = await createRoom(currentUser.id, getDisplayName(currentUser), {
      photoIds: playable.map(p => p.id),
    });
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

async function handleJoinRoom() {
  const code = prompt('Enter the 6-character room code:')?.trim().toUpperCase();
  if (!code) return;
  showLoading(true);
  try {
    const room = await joinRoom(code, currentUser.id, getDisplayName(currentUser));
    currentRoom = room;
    showRoomLobby(room, false);
    subscribeRoom(room.id);
  } catch (e) {
    toast(e.message, 'error');
  }
  showLoading(false);
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

  // Sign out
  document.getElementById('nav-signout-btn').addEventListener('click', async () => {
    if (unsubRoomsList) { unsubRoomsList(); unsubRoomsList = null; }
    if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    await signOut().catch(() => {});
  });

  // Auto-join from URL ?join=CODE
  const joinCode = new URLSearchParams(location.search).get('join');
  if (joinCode) handleJoinRoom(joinCode);
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('show', show);
}
