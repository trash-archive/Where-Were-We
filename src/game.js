/**
 * game.js
 * Core game engine — handles round flow, scoring, result/final screens.
 * Works for both solo and multiplayer.
 */

import { showScreen, haversineKm, distanceToScore, formatDistance, getOrCreateMap, destroyMap, escapeHtml, toast, avatarColor, avatarTextColor } from './utils.js';
import { submitRoomGuess, advanceRound, finishRoom } from './rooms.js';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  photos: [],          // array of photo records {id, public_url, lat, lng, original_name}
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
  roomData: null,
};

// ── Start Game ────────────────────────────────────────────────────────────
export function startSoloGame(photos) {
  Object.assign(state, {
    photos: shuffle([...photos]),
    currentRound: 0, totalScore: 0,
    roundResults: [], currentGuess: null,
    guessMarker: null, gameMap: null,
    roomId: null, isHost: false,
  });
  showScreen('game');
  requestAnimationFrame(() => { initGameMap(); loadRound(); });
}

export function startMultiplayerGame(photos, roomId, userId, userName, isHost) {
  Object.assign(state, {
    photos: shuffle([...photos]),
    currentRound: 0, totalScore: 0,
    roundResults: [], currentGuess: null,
    guessMarker: null, gameMap: null,
    roomId, isHost, userId, userName,
  });
  showScreen('game');
  requestAnimationFrame(() => { initGameMap(); loadRound(); });
}

// ── Map ───────────────────────────────────────────────────────────────────
function initGameMap() {
  setTimeout(() => {
    state.gameMap = getOrCreateMap('game-leaflet-map', { zoom: 2 });
    state.gameMap.on('click', onMapClick);
    state.gameMap.invalidateSize();
  }, 80);
}

function onMapClick(e) {
  state.currentGuess = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (state.guessMarker) state.gameMap.removeLayer(state.guessMarker);
  state.guessMarker = L.circleMarker(e.latlng, {
    radius: 9, color: '#fff', weight: 3,
    fillColor: '#2563eb', fillOpacity: 1,
  }).addTo(state.gameMap);
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

  // Photo
  const photo = state.photos[idx];
  const img = document.getElementById('game-photo-img');
  img.src = photo.public_url;
  img.alt = photo.original_name ?? 'Photo';

  // Reset guess
  state.currentGuess = null;
  document.getElementById('submit-guess-btn').disabled = true;
  document.getElementById('game-map-pin-hint').classList.remove('hidden');

  if (state.gameMap) {
    state.gameMap.eachLayer(l => {
      if (l instanceof L.CircleMarker) state.gameMap.removeLayer(l);
    });
    state.guessMarker = null;
    state.gameMap.setView([20, 0], 2);
  }
}

// ── Submit Guess ──────────────────────────────────────────────────────────
export async function submitGuess() {
  if (!state.currentGuess) return;
  const photo = state.photos[state.currentRound];
  const { lat, lng } = state.currentGuess;
  const distKm = haversineKm(photo.lat, photo.lng, lat, lng);
  const score = distanceToScore(distKm);

  state.totalScore += score;
  state.roundResults.push({ photo, guess: state.currentGuess, distKm, score });

  // Submit to room if multiplayer
  if (state.roomId) {
    try {
      await submitRoomGuess(state.roomId, state.userId, state.currentRound, state.currentGuess, distKm, score);
    } catch (e) {
      toast('Could not sync score. Check your connection.', 'error');
    }
  }

  showRoundResult(photo, state.currentGuess, distKm, score);
}

// ── Round Result ──────────────────────────────────────────────────────────
function showRoundResult(photo, guess, distKm, score) {
  document.getElementById('rr-photo').src = photo.public_url;
  document.getElementById('rr-distance').textContent = formatDistance(distKm);
  document.getElementById('rr-guess-coords').textContent = `${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}`;
  document.getElementById('rr-actual-coords').textContent = `${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}`;

  // SVG score ring
  const pct = score / 5000;
  const r = 34, circ = 2 * Math.PI * r;
  document.getElementById('rr-ring-fill').setAttribute('stroke-dasharray', `${pct * circ} ${circ}`);
  document.getElementById('rr-score-num').textContent = score.toLocaleString();

  // Round label in header
  const total = state.photos.length;
  document.getElementById('rr-round-label').textContent = `Round ${state.currentRound + 1} of ${total}`;

  // Next button label
  const isLast = state.currentRound + 1 >= total;
  document.getElementById('rr-next-btn').textContent = isLast ? 'See Final Score' : 'Next Round';

  showScreen('round-result');
  requestAnimationFrame(() => buildResultMap(photo, guess));
}

function buildResultMap(photo, guess) {
  destroyMap('mini-result-map');
  const m = getOrCreateMap('mini-result-map', {
    zoom: 3, zoomControl: false,
    leafletOpts: { dragging: true, scrollWheelZoom: false },
  });

  const actual = L.latLng(photo.lat, photo.lng);
  const guessLL = L.latLng(guess.lat, guess.lng);

  L.marker(actual, {
    icon: L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] })
  }).addTo(m).bindPopup('Actual location');

  L.circleMarker(guessLL, { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 })
    .addTo(m).bindPopup('Your guess');

  L.polyline([actual, guessLL], { color: '#2563eb', weight: 1.5, dashArray: '4,4', opacity: 0.7 }).addTo(m);

  m.fitBounds(L.latLngBounds([actual, guessLL]).pad(0.3));
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

  showScreen('game');
  setTimeout(() => {
    if (state.gameMap) state.gameMap.invalidateSize();
    loadRound();
  }, 80);
}

// ── Final Screen ──────────────────────────────────────────────────────────
function showFinalScreen() {
  const results = state.roundResults;
  const total = results.reduce((s, r) => s + r.score, 0);
  const avgDist = results.reduce((s, r) => s + r.distKm, 0) / results.length;
  const best = Math.max(...results.map(r => r.score));

  document.getElementById('final-total').textContent = total.toLocaleString();
  document.getElementById('final-avg-dist').textContent = formatDistance(avgDist);
  document.getElementById('final-best').textContent = best.toLocaleString();

  // Medal & grade
  const pct = total / (state.photos.length * 5000);
  let medalClass = 'medal-default', grade = 'Keep Exploring', sub = 'The world is vast — keep guessing!';
  if (pct >= 0.8) { medalClass = 'medal-gold'; grade = 'World Explorer'; sub = 'Outstanding! You have an incredible sense of place.'; }
  else if (pct >= 0.6) { medalClass = 'medal-silver'; grade = 'Seasoned Traveller'; sub = 'Excellent guessing — you really know your photos!'; }
  else if (pct >= 0.4) { medalClass = 'medal-bronze'; grade = 'Curious Wanderer'; sub = 'Solid performance! Your geography is improving.'; }
  else if (pct >= 0.2) { medalClass = 'medal-default'; grade = 'Brave Guesser'; sub = 'Good try! The world has many surprises.'; }

  document.getElementById('final-medal').className = `final-medal ${medalClass}`;
  document.getElementById('final-medal').innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>`;
  document.getElementById('final-grade').textContent = grade;
  document.getElementById('final-sub').textContent = sub;

  // Breakdown list (sorted by score)
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

  showScreen('final');
}

export function invalidateGameMap() {
  if (state.gameMap) state.gameMap.invalidateSize();
}

export function panGameMap(lat, lng, zoom = 10) {
  if (state.gameMap) state.gameMap.setView([lat, lng], zoom, { animate: true });
}

function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

export { state as gameState };
