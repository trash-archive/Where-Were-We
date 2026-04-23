/**
 * game.js
 * Core game engine — solo and multiplayer.
 * Multiplayer: shared photo order, wait-for-all-guesses, auto-advance,
 * per-round scoreboard, final leaderboard.
 */

import { showScreen, haversineKm, distanceToScore, formatDistance, getOrCreateMap, destroyMap, escapeHtml, toast } from './utils.js';
import { submitRoomGuess, advanceRound, finishRoom, subscribeToRoom, leaveRoom } from './rooms.js';

const state = {
  photos: [],
  currentRound: 0,
  totalScore: 0,
  roundResults: [],
  currentGuess: null,
  guessMarker: null,
  gameMap: null,
  // multiplayer
  roomId: null,
  isHost: false,
  userId: null,
  userName: null,
  roomData: null,       // latest room snapshot from realtime
  unsubRoom: null,      // realtime unsubscribe fn
  hasGuessed: false,    // has this player submitted for the current round
};

// Tracks the remaining unplayed photos for solo mode across play-again sessions
let _soloPhotoPool = [];
let _soloAllPhotos = [];

// ── Snapshot helpers ──────────────────────────────────────────────────────
function saveSnapshot(screen) {
  const snap = {
    screen,
    photos: state.photos,
    currentRound: state.currentRound,
    totalScore: state.totalScore,
    roundResults: state.roundResults,
    currentGuess: state.currentGuess,
    roomId: state.roomId,
    isHost: state.isHost,
    userId: state.userId,
    userName: state.userName,
  };
  try { sessionStorage.setItem('gameSnapshot', JSON.stringify(snap)); } catch {}
}

export function clearSnapshot() {
  sessionStorage.removeItem('gameSnapshot');
  sessionStorage.removeItem('activeScreen');
}

// ── Start ─────────────────────────────────────────────────────────────────
export function startSoloGame(photos, userId = null) {
  const MAX_ROUNDS = 10;
  if (photos) {
    _soloAllPhotos = [...photos];
    _soloPhotoPool = shuffle([...photos]);
  } else if (_soloPhotoPool.length === 0) {
    const lastPlayed = state.photos[state.photos.length - 1];
    _soloPhotoPool = shuffle([..._soloAllPhotos]);
    if (_soloPhotoPool.length > 1 && lastPlayed && _soloPhotoPool[0].id === lastPlayed.id) {
      _soloPhotoPool.push(_soloPhotoPool.shift());
    }
  }
  const count = Math.min(_soloPhotoPool.length, MAX_ROUNDS);
  const selected = _soloPhotoPool.splice(0, count);
  Object.assign(state, {
    photos: selected,
    currentRound: 0, totalScore: 0, roundResults: [],
    currentGuess: null, guessMarker: null, gameMap: null,
    roomId: null, isHost: false, roomData: null,
    unsubRoom: null, hasGuessed: false,
    userId: userId ?? state.userId,
  });
  document.getElementById('game-players-pill')?.classList.add('hidden');
  document.getElementById('game-quit-btn')?.classList.remove('hidden');
  saveSnapshot('game');
  showScreen('game');
  requestAnimationFrame(() => { initGameMap(); loadRound(); });
}

// ── Play Again ────────────────────────────────────────────────────────────
export function playAgain() {
  if (state.roomId) {
    // Multiplayer: host goes back to lobby to restart, guests go to dashboard
    clearSnapshot();
    sessionStorage.removeItem('activeRoomId');
    showScreen(state.isHost ? 'room' : 'dashboard');
  } else {
    // Solo: continue cycling through the photo pool
    startSoloGame(null);
  }
}

export function startMultiplayerGame(photos, roomId, userId, userName, isHost, roomData) {
  Object.assign(state, {
    photos: [...photos],
    currentRound: roomData.current_round ?? 0,
    totalScore: 0, roundResults: [],
    currentGuess: null, guessMarker: null, gameMap: null,
    roomId, isHost, userId, userName, roomData,
    unsubRoom: null, hasGuessed: false,
  });
  sessionStorage.setItem('activeRoomId', roomId);
  saveSnapshot('game');
  // Show multiplayer-only UI
  document.getElementById('game-players-pill')?.classList.remove('hidden');
  document.getElementById('game-quit-btn')?.classList.remove('hidden');
  updatePlayersPill(roomData);
  showScreen('game');
  requestAnimationFrame(() => { initGameMap(); loadRound(); });
  subscribeGameRoom();
}

// ── Realtime subscription during gameplay ─────────────────────────────────
function subscribeGameRoom() {
  if (state.unsubRoom) state.unsubRoom();
  state.unsubRoom = subscribeToRoom(state.roomId, (updated) => {
    // null means room was deleted — host left
    if (!updated) {
      if (state.unsubRoom) { state.unsubRoom(); state.unsubRoom = null; }
      sessionStorage.removeItem('activeRoomId');
      clearSnapshot();
      document.getElementById('host-ended-modal')?.classList.add('open');
      return;
    }

    const prev = state.roomData;
    state.roomData = updated;

    // Update live player count pill
    updatePlayersPill(updated);

    // Host advanced the round — non-hosts follow
    if (!state.isHost && updated.current_round !== prev?.current_round) {
      state.currentRound = updated.current_round;
      if (state.currentRound >= state.photos.length) {
        showFinalScreen();
      } else {
        state.hasGuessed = false;
        showScreen('game');
        setTimeout(() => { if (state.gameMap) state.gameMap.invalidateSize(); loadRound(); }, 150);
      }
      return;
    }

    // Room finished
    if (updated.status === 'finished' && prev?.status !== 'finished') {
      showFinalScreen();
      return;
    }

    // All players have guessed this round → show result for everyone
    const allGuessed = (updated.players ?? []).every(p => p.guessed);
    if (allGuessed && state.hasGuessed) {
      showRoundResult(
        state.photos[state.currentRound],
        state.currentGuess,
        state._lastDistKm,
        state._lastScore,
        updated
      );
    }

    // Update waiting UI if we already guessed but not everyone has yet
    if (state.hasGuessed) updateWaitingCount(updated);
  });
}

function updatePlayersPill(room) {
  const pill = document.getElementById('game-players-pill');
  const count = document.getElementById('game-players-count');
  if (!pill || !count) return;
  count.textContent = (room.players ?? []).length;
}

function updateWaitingCount(room) {
  const el = document.getElementById('mp-waiting-text');
  if (!el) return;
  const guessed = (room.players ?? []).filter(p => p.guessed).length;
  const total = (room.players ?? []).length;
  el.textContent = `Waiting for players… ${guessed}/${total} guessed`;
}

// ── Map ───────────────────────────────────────────────────────────────────
function initGameMap() {
  setTimeout(() => {
    state.gameMap = getOrCreateMap('game-leaflet-map', { zoom: 2 });
    state.gameMap.on('click', onMapClick);
    state.gameMap.invalidateSize();
  }, 150);
}

function makePinIcon(color, inner) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:34px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.32));">
      <svg viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:28px;height:34px;">
        <path d="M14 0C8.477 0 4 4.477 4 10c0 7.5 10 24 10 24S24 17.5 24 10C24 4.477 19.523 0 14 0z" fill="${color}"/>
        ${inner}
      </svg>
    </div>`,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34],
  });
}

function makeGuessPin(color = '#2563eb') {
  return makePinIcon(color, '<circle cx="14" cy="10" r="4.5" fill="white" opacity="0.95"/>');
}

function makeActualPin() {
  return makePinIcon('#16a34a', '<path d="M10 10l2.5 2.5 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
}

function onMapClick(e) {
  if (state.hasGuessed) return;
  state.currentGuess = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (state.guessMarker) state.gameMap.removeLayer(state.guessMarker);
  state.guessMarker = L.marker(e.latlng, { icon: makeGuessPin('#2563eb'), zIndexOffset: 100 }).addTo(state.gameMap);
  document.getElementById('submit-guess-btn').disabled = false;
  document.getElementById('game-map-pin-hint').classList.add('hidden');
}

// ── Round ─────────────────────────────────────────────────────────────────
function loadRound() {
  const total = state.photos.length;
  const idx = state.currentRound;

  document.getElementById('game-round-num').textContent = `Round ${idx + 1} / ${total}`;
  document.getElementById('game-progress-fill').style.width = `${(idx / total) * 100}%`;
  document.getElementById('game-score-display').textContent = `${state.totalScore.toLocaleString()} pts`;

  const photo = state.photos[idx];
  const img = document.getElementById('game-photo-img');
  img.src = photo.public_url;
  img.alt = photo.original_name ?? 'Photo';

  state.currentGuess = null;
  state.hasGuessed = false;
  document.getElementById('submit-guess-btn').disabled = true;
  document.getElementById('submit-guess-btn').textContent = 'Confirm Guess';
  document.getElementById('game-map-pin-hint').classList.remove('hidden');

  if (state.gameMap) {
    if (state.guessMarker) { state.gameMap.removeLayer(state.guessMarker); state.guessMarker = null; }
    state.gameMap.setView([20, 0], 2);
  }
}

// ── Submit Guess ──────────────────────────────────────────────────────────
export async function submitGuess() {
  if (!state.currentGuess || state.hasGuessed) return;
  const photo = state.photos[state.currentRound];
  const { lat, lng } = state.currentGuess;
  const distKm = haversineKm(photo.lat, photo.lng, lat, lng);
  const score = distanceToScore(distKm);

  state.totalScore += score;
  state.roundResults.push({ photo, guess: state.currentGuess, distKm, score });
  state.hasGuessed = true;
  state._lastDistKm = distKm;
  state._lastScore = score;

  // Lock the button
  const btn = document.getElementById('submit-guess-btn');
  btn.disabled = true;
  btn.textContent = 'Guess submitted';

  saveSnapshot('round-result');

  if (state.roomId) {
    try {
      await submitRoomGuess(state.roomId, state.userId, state.currentRound, state.currentGuess, distKm, score);
      showWaitingState(score);
    } catch {
      toast('Could not sync score. Check your connection.', 'error');
      showRoundResult(photo, state.currentGuess, distKm, score, null);
    }
  } else {
    showRoundResult(photo, state.currentGuess, distKm, score, null);
  }
}

function showWaitingState(score) {
  const el = document.getElementById('game-map-pin-hint');
  el.classList.remove('hidden');
  el.id = 'mp-waiting-text';
  el.textContent = 'Waiting for players…';
  // Update immediately with current count
  if (state.roomData) updateWaitingCount(state.roomData);
}

// ── Round Result ──────────────────────────────────────────────────────────
function showRoundResult(photo, guess, distKm, score, room) {
  // Reset the waiting hint id so it can be reused next round
  const hint = document.getElementById('mp-waiting-text');
  if (hint) hint.id = 'game-map-pin-hint';

  document.getElementById('rr-photo').src = photo.public_url;
  document.getElementById('rr-distance').textContent = formatDistance(distKm);
  document.getElementById('rr-guess-coords').textContent =
    guess ? `${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}` : '—';
  document.getElementById('rr-actual-coords').textContent =
    `${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}`;

  const pct = score / 5000;
  const r = 34, circ = 2 * Math.PI * r;
  document.getElementById('rr-ring-fill').setAttribute('stroke-dasharray', `${pct * circ} ${circ}`);
  document.getElementById('rr-score-num').textContent = score.toLocaleString();

  const total = state.photos.length;
  document.getElementById('rr-round-label').textContent = `Round ${state.currentRound + 1} of ${total}`;

  // Multiplayer scoreboard
  const scoreboardEl = document.getElementById('rr-mp-scoreboard');
  if (room && scoreboardEl) {
    const roundGuesses = (room.guesses ?? []).filter(g => g.round === state.currentRound);
    const rows = (room.players ?? [])
      .map(p => {
        const g = roundGuesses.find(g => g.user_id === p.id);
        return { name: p.name, dist: g?.dist_km ?? null, roundScore: g?.score ?? 0, total: p.score ?? 0, isMe: p.id === state.userId };
      })
      .sort((a, b) => b.roundScore - a.roundScore);

    scoreboardEl.innerHTML = rows.map((r, i) => `
      <tr class="${r.isMe ? 'mp-row-me' : ''}">
        <td class="mp-rank">${i + 1}</td>
        <td class="mp-name">${escapeHtml(r.name)}</td>
        <td class="mp-dist">${r.dist !== null ? formatDistance(r.dist) : '—'}</td>
        <td class="mp-score">${r.roundScore.toLocaleString()}</td>
        <td class="mp-total">${r.total.toLocaleString()}</td>
      </tr>`).join('');
    scoreboardEl.closest('.rr-mp-wrap').classList.remove('hidden');
  } else if (scoreboardEl) {
    scoreboardEl.closest('.rr-mp-wrap').classList.add('hidden');
  }

  // Next button
  const isLast = state.currentRound + 1 >= total;
  const nextBtn = document.getElementById('rr-next-btn');
  if (state.roomId) {
    if (state.isHost) {
      nextBtn.textContent = isLast ? 'End Game' : 'Next Round';
      nextBtn.disabled = false;
    } else {
      nextBtn.textContent = 'Waiting for host…';
      nextBtn.disabled = true;
    }
  } else {
    nextBtn.textContent = isLast ? 'See Final Score' : 'Next Round';
    nextBtn.disabled = false;
  }

  showScreen('round-result');
  requestAnimationFrame(() => buildResultMap(photo, guess, room));
}

function buildResultMap(photo, guess, room) {
  destroyMap('mini-result-map');
  const m = getOrCreateMap('mini-result-map', {
    zoom: 3, zoomControl: false,
    leafletOpts: { dragging: true, scrollWheelZoom: false },
  });

  const actual = L.latLng(photo.lat, photo.lng);

  // Actual location — green pin with checkmark
  L.marker(actual, { icon: makeActualPin(), zIndexOffset: 200 })
    .addTo(m).bindPopup('<b>Actual location</b>');

  const bounds = [actual];

  if (room) {
    const roundGuesses = (room.guesses ?? []).filter(g => g.round === state.currentRound);
    roundGuesses.forEach(g => {
      const ll = L.latLng(g.lat, g.lng);
      const player = (room.players ?? []).find(p => p.id === g.user_id);
      const isMe = g.user_id === state.userId;
      const color = isMe ? '#2563eb' : '#9ca3af';
      L.marker(ll, { icon: makeGuessPin(color), zIndexOffset: isMe ? 150 : 100 })
        .addTo(m).bindPopup(`<b>${escapeHtml(player?.name ?? 'Player')}</b>`);
      L.polyline([actual, ll], {
        color, weight: isMe ? 2.5 : 1.5,
        dashArray: '6,5', opacity: isMe ? 0.85 : 0.5,
      }).addTo(m);
      bounds.push(ll);
    });
  } else if (guess) {
    const guessLL = L.latLng(guess.lat, guess.lng);
    L.marker(guessLL, { icon: makeGuessPin('#2563eb'), zIndexOffset: 150 })
      .addTo(m).bindPopup('<b>Your guess</b>');
    L.polyline([actual, guessLL], {
      color: '#2563eb', weight: 2.5, dashArray: '6,5', opacity: 0.8,
    }).addTo(m);
    bounds.push(guessLL);
  }

  m.fitBounds(L.latLngBounds(bounds).pad(0.35));
}

// ── Next Round ────────────────────────────────────────────────────────────
export async function nextRound() {
  state.currentRound++;

  if (state.currentRound >= state.photos.length) {
    if (state.roomId && state.isHost) {
      try { await finishRoom(state.roomId); } catch {}
    }
    showFinalScreen();
    return;
  }

  if (state.roomId && state.isHost) {
    try { await advanceRound(state.roomId, state.currentRound); } catch {}
  }

  state.hasGuessed = false;
  saveSnapshot('game');
  showScreen('game');
  setTimeout(() => { if (state.gameMap) state.gameMap.invalidateSize(); loadRound(); }, 150);
}

// ── Final Screen ──────────────────────────────────────────────────────────
function showFinalScreen() {
  if (state.unsubRoom) { state.unsubRoom(); state.unsubRoom = null; }
  sessionStorage.removeItem('activeRoomId');
  saveSnapshot('final');

  const results = state.roundResults;
  const total = results.reduce((s, r) => s + r.score, 0);
  const avgDist = results.length ? results.reduce((s, r) => s + r.distKm, 0) / results.length : 0;
  const best = results.length ? Math.max(...results.map(r => r.score)) : 0;

  // Persist game result to localStorage
  if (state.userId && results.length) saveGameResult(state.userId, total);

  document.getElementById('final-total').textContent = total.toLocaleString();
  document.getElementById('final-avg-dist').textContent = formatDistance(avgDist);
  document.getElementById('final-best').textContent = best.toLocaleString();

  const pct = total / (state.photos.length * 5000);
  let medalClass = 'medal-default', grade = 'Keep Exploring', sub = 'The world is vast — keep guessing!';
  if (pct >= 0.8) { medalClass = 'medal-gold'; grade = 'World Explorer'; sub = 'Outstanding! You have an incredible sense of place.'; }
  else if (pct >= 0.6) { medalClass = 'medal-silver'; grade = 'Seasoned Traveller'; sub = 'Excellent guessing — you really know your photos!'; }
  else if (pct >= 0.4) { medalClass = 'medal-bronze'; grade = 'Curious Wanderer'; sub = 'Solid performance! Your geography is improving.'; }
  else if (pct >= 0.2) { grade = 'Brave Guesser'; sub = 'Good try! The world has many surprises.'; }

  document.getElementById('final-medal').className = `final-medal ${medalClass}`;
  document.getElementById('final-medal').innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`;
  document.getElementById('final-grade').textContent = grade;
  document.getElementById('final-sub').textContent = sub;

  // Multiplayer leaderboard
  const mpLeaderboard = document.getElementById('final-mp-leaderboard');
  if (state.roomId && state.roomData && mpLeaderboard) {
    const players = [...(state.roomData.players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    mpLeaderboard.innerHTML = players.map((p, i) => {
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
      const isMe = p.id === state.userId;
      return `
        <div class="breakdown-row ${isMe ? 'mp-row-me' : ''}">
          <div class="breakdown-rank ${rankClass}">${i + 1}</div>
          <div class="mp-player-avatar">${escapeHtml(p.name.slice(0, 2).toUpperCase())}</div>
          <div class="breakdown-info">
            <div class="breakdown-name">${escapeHtml(p.name)}${isMe ? ' <span class="badge badge-blue" style="font-size:10px;">You</span>' : ''}</div>
          </div>
          <div class="breakdown-score">${(p.score ?? 0).toLocaleString()}</div>
        </div>`;
    }).join('');
    mpLeaderboard.closest('.final-mp-wrap').classList.remove('hidden');
    // Hide solo breakdown in multiplayer
    document.getElementById('final-breakdown').closest('.breakdown-list')?.classList.add('hidden');
  } else {
    mpLeaderboard?.closest('.final-mp-wrap')?.classList.add('hidden');
    // Solo breakdown
    const sorted = [...results].sort((a, b) => b.score - a.score);
    document.getElementById('final-breakdown').innerHTML = sorted.map((r, i) => {
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
      return `
        <div class="breakdown-row">
          <div class="breakdown-rank ${rankClass}">${i + 1}</div>
          <img class="breakdown-thumb" src="${r.photo.public_url}" alt="">
          <div class="breakdown-info">
            <div class="breakdown-name">${escapeHtml(r.photo.original_name ?? 'Photo')}</div>
            <div class="breakdown-dist">${formatDistance(r.distKm)} away</div>
          </div>
          <div class="breakdown-score">${r.score.toLocaleString()}</div>
        </div>`;
    }).join('');
  }

  showScreen('final');
}

export function invalidateGameMap() { if (state.gameMap) state.gameMap.invalidateSize(); }
export function panGameMap(lat, lng, zoom = 10) { if (state.gameMap) state.gameMap.setView([lat, lng], zoom, { animate: true }); }
export function placeGamePin(lat, lng) {
  if (!state.gameMap || state.hasGuessed) return;
  const latlng = L.latLng(lat, lng);
  if (state.guessMarker) state.gameMap.removeLayer(state.guessMarker);
  state.guessMarker = L.marker(latlng, { icon: makeGuessPin('#2563eb'), zIndexOffset: 100 }).addTo(state.gameMap);
  state.currentGuess = { lat, lng };
  document.getElementById('submit-guess-btn').disabled = false;
  document.getElementById('game-map-pin-hint').classList.add('hidden');
}

/**
 * Called on page reload — restores game/result/final screen from sessionStorage snapshot.
 * Returns true if successfully restored, false if snapshot was unusable.
 */
export function restoreGameSnapshot(snap) {
  if (!snap?.photos?.length) return false;

  Object.assign(state, {
    photos: snap.photos,
    currentRound: snap.currentRound ?? 0,
    totalScore: snap.totalScore ?? 0,
    roundResults: snap.roundResults ?? [],
    currentGuess: snap.currentGuess ?? null,
    roomId: snap.roomId ?? null,
    isHost: snap.isHost ?? false,
    userId: snap.userId ?? null,
    userName: snap.userName ?? null,
    guessMarker: null,
    gameMap: null,
    roomData: null,
    unsubRoom: null,
    hasGuessed: false,
  });

  const screen = snap.screen;

  if (screen === 'game') {
    document.getElementById('game-quit-btn')?.classList.remove('hidden');
    if (state.roomId) {
      document.getElementById('game-players-pill')?.classList.remove('hidden');
      if (state.roomData) updatePlayersPill(state.roomData);
    }
    showScreen('game');
    requestAnimationFrame(() => { initGameMap(); loadRound(); });
    if (state.roomId) subscribeGameRoom();
    return true;
  }

  if (screen === 'round-result') {
    if (state.roomId) {
      document.getElementById('game-players-pill')?.classList.remove('hidden');
      document.getElementById('game-quit-btn')?.classList.remove('hidden');
    }
    // The round was already submitted — show the result for the last completed round
    const lastResult = state.roundResults[state.roundResults.length - 1];
    if (!lastResult) {
      // No result yet, fall back to showing the game screen for that round
      showScreen('game');
      requestAnimationFrame(() => { initGameMap(); loadRound(); });
      if (state.roomId) subscribeGameRoom();
      return true;
    }
    showRoundResult(lastResult.photo, lastResult.guess, lastResult.distKm, lastResult.score, null);
    if (state.roomId) subscribeGameRoom();
    return true;
  }

  if (screen === 'final') {
    if (!state.roundResults.length) return false;
    showFinalScreen();
    return true;
  }

  return false;
}

// ── Quit game ─────────────────────────────────────────────────────────────
export function quitGame(phase) {
  if (phase === 'confirm') {
    // Solo — no confirm needed, just leave
    if (!state.roomId) {
      clearSnapshot();
      showScreen('dashboard');
      return;
    }
    const titleEl = document.getElementById('quit-modal-title');
    const bodyEl = document.getElementById('quit-modal-body');
    if (state.isHost) {
      titleEl.textContent = 'End game for everyone?';
      bodyEl.textContent = 'You are the host. Leaving will end the game for all players.';
    } else {
      titleEl.textContent = 'Leave game?';
      bodyEl.textContent = 'Your progress for this game will be lost.';
    }
    document.getElementById('quit-confirm-modal').classList.add('open');
    return;
  }

  // phase === 'execute'
  if (state.unsubRoom) { state.unsubRoom(); state.unsubRoom = null; }
  const roomId = state.roomId;
  const userId = state.userId;
  clearSnapshot();
  sessionStorage.removeItem('activeRoomId');
  document.getElementById('game-players-pill')?.classList.add('hidden');
  document.getElementById('game-quit-btn')?.classList.add('hidden');
  showScreen('dashboard');
  if (roomId && userId) leaveRoom(roomId, userId).catch(() => {});
}

export { makePinIcon };

// ── Local stats persistence ─────────────────────────────────────────────────
function statsKey(userId) { return `wwwstats_${userId}`; }

function saveGameResult(userId, score) {
  try {
    const key = statsKey(userId);
    const existing = JSON.parse(localStorage.getItem(key) ?? '{"games":0,"best":0}');
    existing.games = (existing.games ?? 0) + 1;
    existing.best = Math.max(existing.best ?? 0, score);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

export function getGameStats(userId) {
  try {
    const raw = localStorage.getItem(statsKey(userId));
    if (!raw) return { games: 0, best: null };
    const { games, best } = JSON.parse(raw);
    return { games: games ?? 0, best: best > 0 ? best : null };
  } catch {
    return { games: 0, best: null };
  }
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export { state as gameState };
