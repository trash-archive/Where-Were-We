/**
 * gameScreen.js
 * Controls the main game loop: round loading, map guessing, result screens.
 */

import { state, resetGame } from './state.js';
import { showScreen } from './router.js';
import { getOrCreateMap, destroyMap } from './mapManager.js';
import { haversineKm, distanceToScore, formatDistance } from './distance.js';
import { toast } from './utils.js';

let guessMarker = null;
let gameMap = null;

// ── Public: Start a new game ──────────────────────────────────────────────
export function startGame() {
  resetGame();
  if (state.gameImages.length === 0) {
    toast('No photos with locations! Please add location data to at least one photo.', 'error');
    return;
  }
  showScreen('game');
  initGameMap();
  loadRound();
}

// ── Map Setup ─────────────────────────────────────────────────────────────
function initGameMap() {
  // Small delay ensures the game screen is visible before Leaflet measures size
  setTimeout(() => {
    gameMap = getOrCreateMap('leaflet-map', { zoom: 2, zoomControl: true });
    gameMap.on('click', onMapClick);
    gameMap.invalidateSize();
  }, 80);
}

function onMapClick(e) {
  state.currentGuess = { lat: e.latlng.lat, lng: e.latlng.lng };

  // Remove old marker
  if (guessMarker) { gameMap.removeLayer(guessMarker); guessMarker = null; }

  // Place new marker
  guessMarker = L.circleMarker(e.latlng, {
    radius: 10, color: '#7c6aff', fillColor: '#7c6aff',
    fillOpacity: 1, weight: 2,
  }).addTo(gameMap);

  document.getElementById('submit-guess-btn').disabled = false;
  document.getElementById('pin-hint').classList.add('hidden');
}

// ── Round Loading ─────────────────────────────────────────────────────────
function loadRound() {
  state.currentGuess = null;
  guessMarker = null;

  const total = state.gameImages.length;
  const round = state.currentRound;

  // Header
  document.getElementById('round-num').textContent = round + 1;
  document.getElementById('total-rounds').textContent = total;
  document.getElementById('total-score-display').textContent = state.totalScore.toLocaleString();
  document.getElementById('progress-fill').style.width = `${(round / total) * 100}%`;

  // Photo
  try {
    const parsed = new URL(state.gameImages[round].url);
    if (parsed.protocol === 'https:') document.getElementById('game-photo').src = state.gameImages[round].url;
  } catch {}

  // Reset map state
  document.getElementById('submit-guess-btn').disabled = true;
  document.getElementById('pin-hint').classList.remove('hidden');

  if (gameMap) {
    // Clear any existing markers
    gameMap.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        gameMap.removeLayer(layer);
      }
    });
    // Reset view
    gameMap.setView([20, 0], 2);
  }
}

// ── Submit Guess ──────────────────────────────────────────────────────────
export function submitGuess() {
  if (!state.currentGuess) return;

  const img = state.gameImages[state.currentRound];
  const { lat, lng } = state.currentGuess;
  const distKm = haversineKm(img.lat, img.lng, lat, lng);
  const score = distanceToScore(distKm);

  state.totalScore += score;
  state.roundResults.push({ img, guess: state.currentGuess, distKm, score });

  showRoundResult(img, state.currentGuess, distKm, score);
}

// ── Round Result ──────────────────────────────────────────────────────────
function showRoundResult(img, guess, distKm, score) {
  try {
    const parsed = new URL(img.url);
    if (parsed.protocol === 'https:') document.getElementById('result-photo').src = img.url;
  } catch {}
  document.getElementById('result-distance').textContent = formatDistance(distKm);
  document.getElementById('result-guess-loc').textContent =
    `${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}`;
  document.getElementById('result-actual-loc').textContent =
    `${img.lat.toFixed(4)}, ${img.lng.toFixed(4)}`;

  // Score ring — SVG circle approach (no conic-gradient z-index bug)
  const pct = score / 5000;
  const circumference = 2 * Math.PI * 46; // r=46
  const dash = pct * circumference;
  document.getElementById('ring-progress').setAttribute('stroke-dasharray', `${dash} ${circumference}`);
  document.getElementById('result-score-num').textContent = score.toLocaleString();

  showScreen('round-result');

  // Build mini result map after screen is visible
  requestAnimationFrame(() => buildResultMap(img, guess));
}

function buildResultMap(img, guess) {
  destroyMap('mini-result-map');
  const miniMap = getOrCreateMap('mini-result-map', {
    zoom: 3,
    zoomControl: false,
    leafletOpts: { dragging: false, scrollWheelZoom: false },
  });

  const actualLL = L.latLng(img.lat, img.lng);
  const guessLL = L.latLng(guess.lat, guess.lng);

  // Actual location marker (red pin)
  L.marker(actualLL, {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#4ade80;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
      iconSize: [16, 16], iconAnchor: [8, 8],
    })
  }).addTo(miniMap).bindPopup('📍 Actual location');

  // Guess marker (purple)
  L.circleMarker(guessLL, {
    radius: 8, color: '#fff', weight: 2,
    fillColor: '#7c6aff', fillOpacity: 1,
  }).addTo(miniMap).bindPopup('Your guess');

  // Line between them
  L.polyline([actualLL, guessLL], {
    color: '#7c6aff', weight: 2, dashArray: '5,5', opacity: 0.8,
  }).addTo(miniMap);

  // Fit both points
  const bounds = L.latLngBounds([actualLL, guessLL]).pad(0.3);
  miniMap.fitBounds(bounds);
}

// ── Next Round / Final ────────────────────────────────────────────────────
export function nextRound() {
  state.currentRound++;
  if (state.currentRound >= state.gameImages.length) {
    showFinalScreen();
  } else {
    showScreen('game');
    // Map already exists; just reload the round
    setTimeout(() => {
      if (gameMap) gameMap.invalidateSize();
      loadRound();
    }, 80);
  }
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

  // Verdict
  const pct = total / (state.gameImages.length * 5000);
  let emoji = '😅', subtitle = 'Keep exploring the world!';
  if (pct >= 0.8) { emoji = '🌟'; subtitle = 'Outstanding! You\'re a geography genius!'; }
  else if (pct >= 0.6) { emoji = '🏆'; subtitle = 'Excellent! You really know your photos!'; }
  else if (pct >= 0.4) { emoji = '👍'; subtitle = 'Solid performance! Not bad at all!'; }
  else if (pct >= 0.2) { emoji = '🗺️'; subtitle = 'Good try! The world is a big place!'; }
  document.getElementById('final-emoji').textContent = emoji;
  document.getElementById('final-subtitle').textContent = subtitle;

  // Leaderboard — sorted by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const leaderboard = document.getElementById('leaderboard');
  leaderboard.innerHTML = '';
  sorted.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row';

    const rank = document.createElement('div');
    rank.className = `rank-badge ${i < 3 ? `rank-${i + 1}` : 'rank-n'}`;
    rank.textContent = i + 1;

    const thumb = document.createElement('img');
    thumb.className = 'lb-thumb';
    thumb.alt = '';
    try {
      const parsed = new URL(r.img.url);
      if (parsed.protocol === 'https:') thumb.src = r.img.url;
    } catch {}

    const info = document.createElement('div');
    info.className = 'lb-info';
    const name = document.createElement('div');
    name.className = 'lb-name';
    name.textContent = r.img.name ?? 'Photo';
    const dist = document.createElement('div');
    dist.className = 'lb-dist';
    dist.textContent = `${formatDistance(r.distKm)} away`;
    info.append(name, dist);

    const scoreWrap = document.createElement('div');
    scoreWrap.className = 'lb-score';
    const scoreNum = document.createElement('div');
    scoreNum.className = 'lb-score-num';
    scoreNum.textContent = r.score.toLocaleString();
    const scorePts = document.createElement('div');
    scorePts.className = 'lb-score-pts';
    scorePts.textContent = 'pts';
    scoreWrap.append(scoreNum, scorePts);

    row.append(rank, thumb, info, scoreWrap);
    leaderboard.appendChild(row);
  });

  showScreen('final');
}

