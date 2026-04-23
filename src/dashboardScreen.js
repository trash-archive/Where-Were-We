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

  await refreshPhotos();
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
    const room = await joinRoom(code, currentUser.id, getDisplayName(currentUser));
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
  document.getElementById('room-players-grid').innerHTML = players.map(p => `
    <div class="room-player-card card-flat">
      <div class="room-player-avatar">${escapeHtml(p.name.slice(0,2).toUpperCase())}</div>
      <div class="room-player-name">${escapeHtml(p.name)}</div>
      <div class="room-player-status">
        ${p.is_host ? '<span class="badge badge-blue">Host</span>' : '<span class="badge badge-gray">Player</span>'}
      </div>
    </div>
  `).join('');
  // Enable start if host and 2+ players
  const isHost = room.host_id === currentUser?.id;
  const startBtn = document.getElementById('room-start-btn');
  if (startBtn) startBtn.disabled = !isHost || players.length < 2;
}

async function startMultiplayerGame(room) {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  const photos = room.photos_data;
  if (!photos?.length) return;
  startMP(photos, room.id, currentUser.id, getDisplayName(currentUser), room.host_id === currentUser.id);
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
    const playable = (currentRoom.photo_ids ?? []).slice(0, rounds);
    await startRoom(currentRoom.id, playable);
  });
  document.getElementById('room-leave-btn').addEventListener('click', async () => {
    if (currentRoom) {
      await leaveRoom(currentRoom.id, currentUser.id).catch(() => {});
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    }
    showScreen('dashboard');
  });

  // Sign out
  document.getElementById('nav-signout-btn').addEventListener('click', async () => {
    await signOut().catch(() => {});
  });

  // Auto-join from URL ?join=CODE
  const joinCode = new URLSearchParams(location.search).get('join');
  if (joinCode) handleJoinRoom(joinCode);
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('show', show);
}
