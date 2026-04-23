/**
 * main.js
 * Entry point — renders all screen HTML, then initialises controllers.
 */

import { showScreen } from './utils.js';
import { initAuth } from './authScreen.js';
import { initDashboard } from './dashboardScreen.js';
import { initLocationPicker } from './locationPicker.js';
import { nextRound, submitGuess, invalidateGameMap, panGameMap } from './game.js';
import { startSoloGame, joinRoomByCode } from './dashboardScreen.js';

// ── Render all screens ────────────────────────────────────────────────────
document.getElementById('app').innerHTML = `

<!-- LOADING OVERLAY -->
<div id="loading-overlay" class="loading-overlay">
  <div class="spinner"></div>
  <p class="loading-text">Loading&hellip;</p>
</div>

<!-- MAP LOCATION PICKER MODAL -->
<div id="map-picker-modal" class="map-picker-modal">
  <div class="map-picker-box">
    <div class="map-picker-header">
      <div>
        <div class="map-picker-title">Set Location</div>
        <div class="map-picker-sub" id="picker-image-name"></div>
      </div>
      <button class="map-picker-close btn-ghost btn" id="picker-close-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="map-picker-search">
      <input class="input" id="picker-search" type="text" placeholder="Search for a city or place&hellip;">
    </div>
    <div class="map-picker-map-wrap">
      <div id="location-picker-map"></div>
      <div class="map-picker-hint hidden" id="picker-hint">Click the map to drop a pin</div>
    </div>
    <div class="map-picker-footer">
      <div class="map-picker-coords" id="picker-coords">Click the map to pick a location</div>
      <div class="map-picker-actions">
        <button class="btn btn-secondary btn-sm" id="picker-cancel-btn">Cancel</button>
        <button class="btn btn-primary btn-sm" id="picker-confirm-btn" disabled>Confirm</button>
      </div>
    </div>
  </div>
</div>

<!-- JOIN ROOM MODAL -->
<div id="join-room-modal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title">Join a Room</div>
      <button class="btn btn-ghost btn-sm" id="join-modal-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:20px;">Enter the 6-character code shared by the host.</p>
      <div class="join-code-inputs">
        <input class="join-code-char" maxlength="1" autocomplete="off" spellcheck="false" inputmode="text">
        <input class="join-code-char" maxlength="1" autocomplete="off" spellcheck="false" inputmode="text">
        <input class="join-code-char" maxlength="1" autocomplete="off" spellcheck="false" inputmode="text">
        <input class="join-code-char" maxlength="1" autocomplete="off" spellcheck="false" inputmode="text">
        <input class="join-code-char" maxlength="1" autocomplete="off" spellcheck="false" inputmode="text">
        <input class="join-code-char" maxlength="1" autocomplete="off" spellcheck="false" inputmode="text">
      </div>
      <div class="join-code-error hidden" id="join-code-error">Room not found. Check the code and try again.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="join-modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="join-modal-submit" disabled>Join Room</button>
    </div>
  </div>
</div>

<!-- AUTH -->
<div id="screen-auth" class="screen">
  <div class="auth-card card" style="margin:auto;">
    <div class="auth-logo">
      <div class="auth-logo-mark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div class="auth-title" id="auth-title">Sign in</div>
      <div class="auth-sub" id="auth-sub">Welcome back to Where Were We</div>
    </div>
    <div class="auth-error" id="auth-error"></div>
    <div id="auth-username-field" class="auth-field hidden">
      <label class="label">Username</label>
      <input class="input" id="auth-username" type="text" placeholder="Your display name" autocomplete="username">
    </div>
    <div class="auth-field">
      <label class="label">Email</label>
      <input class="input" id="auth-email" type="email" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="auth-field">
      <label class="label">Password</label>
      <input class="input" id="auth-password" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password">
    </div>
    <button class="btn btn-primary w-full" id="auth-submit-btn" style="margin-top:4px;">Sign in</button>
    <div class="auth-footer">
      <span id="auth-toggle-text">Don't have an account?</span>
      <a id="auth-toggle-link"> Sign up</a>
    </div>
  </div>
</div>

<!-- DASHBOARD -->
<div id="screen-dashboard" class="screen">
  <nav class="navbar">
    <div class="navbar-brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      Where Were We
    </div>
    <div class="navbar-right">
      <span id="nav-username" class="text-small text-muted"></span>
      <button class="btn btn-ghost btn-sm" id="nav-signout-btn">Sign out</button>
    </div>
  </nav>
  <div class="dashboard-layout">
    <div class="dashboard-header">
      <div class="dashboard-greeting" id="dash-greeting">Welcome back</div>
      <div class="dashboard-sub">Upload photos and guess where they were taken</div>
    </div>
    <div class="stats-row" id="dash-stats">
      <div class="stat-item card-flat">
        <div class="stat-num" id="stat-photos">0</div>
        <div class="stat-label">Photos</div>
      </div>
      <div class="stat-item card-flat">
        <div class="stat-num" id="stat-games">0</div>
        <div class="stat-label">Games played</div>
      </div>
      <div class="stat-item card-flat">
        <div class="stat-num" id="stat-best">&mdash;</div>
        <div class="stat-label">Best score</div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">Your Photos</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" id="dash-play-btn" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play Solo
          </button>
          <button class="btn btn-primary btn-sm" id="dash-room-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Multiplayer
          </button>
        </div>
      </div>
      <div class="upload-zone" id="dash-drop-zone">
        <div class="upload-zone-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <div class="upload-zone-title">Drop photos here or click to browse</div>
        <div class="upload-zone-sub">JPEG, PNG, WebP, GIF, HEIC &mdash; max 20 MB each &middot; GPS auto-detected</div>
      </div>
      <input type="file" id="dash-file-input" multiple accept="image/*" style="display:none">
      <div id="dash-photo-grid" class="photo-grid" style="margin-top:16px;"></div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">Multiplayer Rooms</div>
        <button class="btn btn-secondary btn-sm" id="dash-join-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Join Room
        </button>
      </div>
      <div id="dash-rooms-list" class="card">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="empty-state-title">No active rooms</div>
          <div class="empty-state-sub">Create one or join with a code</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ROOM LOBBY -->
<div id="screen-room" class="screen">
  <nav class="navbar">
    <button class="btn btn-ghost btn-sm" id="room-back-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      Back
    </button>
    <div class="navbar-brand" style="margin-left:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      Room Lobby
    </div>
  </nav>
  <div class="room-layout">

    <!-- Code card -->
    <div class="room-code-display">
      <div>
        <div class="room-code-label">Room Code</div>
        <div class="room-code-value" id="room-code-value">------</div>
      </div>
      <button class="btn room-copy-btn" id="room-copy-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy Code
      </button>
    </div>

    <!-- Players -->
    <div class="section-header" style="margin-bottom:12px;">
      <div class="section-title">Players (<span id="room-player-count">0</span>/6)</div>
    </div>
    <div class="room-players-grid" id="room-players-grid"></div>

    <!-- Settings -->
    <div class="room-settings">
      <div class="room-setting-row">
        <div>
          <div class="room-setting-label">Rounds</div>
          <div class="room-setting-sub">Number of photos to guess</div>
        </div>
        <select class="select" id="room-rounds-select">
          <option value="3">3</option>
          <option value="5" selected>5</option>
          <option value="10">10</option>
        </select>
      </div>
    </div>

    <!-- Actions -->
    <div class="room-actions">
      <button class="btn btn-secondary" id="room-leave-btn">Leave</button>
      <button class="btn btn-primary" id="room-start-btn" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Start Game
      </button>
    </div>
  </div>
</div>

<!-- GAME -->
<div id="screen-game" class="screen">
  <nav class="game-nav">
    <div class="game-nav-left">
      <div class="game-round-pill" id="game-round-num">Round 1 / 5</div>
      <div class="game-progress-wrap">
        <div class="game-progress-track">
          <div class="game-progress-fill" id="game-progress-fill" style="width:0%"></div>
        </div>
      </div>
    </div>
    <div class="game-nav-right">
      <div class="game-score-pill" id="game-score-display">0 pts</div>
    </div>
  </nav>
  <div class="game-map-backdrop" id="game-map-backdrop"></div>
  <div class="game-body">
    <div class="game-photo-panel">
      <img id="game-photo-img" src="" alt="Guess this location">
      <div class="game-photo-label">Where in the world was this taken?</div>
      <button class="game-map-toggle" id="game-map-toggle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z"/><path d="M9 4v13M15 7v13"/></svg>
        Map
      </button>
    </div>
    <div class="game-map-panel" id="game-map-panel">
      <div class="game-map-header">
        <div class="game-map-header-row">
          <div class="game-map-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="game-map-search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input class="game-map-search-input" id="game-map-search" type="text" placeholder="Search a place&hellip;" autocomplete="off">
          </div>
          <button class="game-map-close" id="game-map-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="game-map-wrap">
        <div id="game-leaflet-map"></div>
        <div class="game-map-pin-hint" id="game-map-pin-hint">Click anywhere to drop a pin</div>
      </div>
      <div class="game-map-footer">
        <button class="btn btn-primary w-full" id="submit-guess-btn" disabled>Confirm Guess</button>
      </div>
    </div>
  </div>
</div>

<!-- ROUND RESULT -->
<div id="screen-round-result" class="screen">
  <div class="result-layout">
    <div class="result-header">
      <div class="result-title">Round Result</div>
      <div class="badge badge-gray" id="rr-round-label">Round 1 of 5</div>
    </div>
    <div class="result-main card">
      <div class="result-top-row">
        <img class="result-photo" id="rr-photo" src="" alt="">
        <div class="result-score-wrap">
          <div class="result-score-ring-container">
            <svg class="score-ring-svg" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#e8e7e5" stroke-width="7"/>
              <circle id="rr-ring-fill" cx="40" cy="40" r="34" fill="none"
                stroke="#191816" stroke-width="7" stroke-linecap="round"
                stroke-dasharray="0 213.6" style="transition:stroke-dasharray 0.7s ease;"/>
            </svg>
            <span class="score-ring-num" id="rr-score-num">0</span>
          </div>
          <div class="score-ring-label">points</div>
        </div>
      </div>
      <div class="result-dist-num" id="rr-distance">&mdash;</div>
      <div class="result-dist-label">from the actual location</div>
      <div class="result-locs">
        <div class="result-loc"><span>Your guess</span><span id="rr-guess-coords">&mdash;</span></div>
        <div class="result-loc"><span>Actual</span><span id="rr-actual-coords">&mdash;</span></div>
      </div>
    </div>
    <div class="result-mini-map">
      <div id="mini-result-map" style="width:100%;height:100%;"></div>
    </div>
    <div class="result-actions">
      <button class="btn btn-primary btn-lg" id="rr-next-btn">Next Round</button>
    </div>
  </div>
</div>

<!-- FINAL -->
<div id="screen-final" class="screen">
  <div class="final-layout">
    <div class="final-hero">
      <div class="final-medal medal-default" id="final-medal">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
      </div>
      <div class="final-grade" id="final-grade">Game Over</div>
      <div class="final-sub" id="final-sub">Well played!</div>
    </div>
    <div class="final-stats">
      <div class="final-stat card-flat">
        <div class="final-stat-num" id="final-total">0</div>
        <div class="final-stat-label">Total Score</div>
      </div>
      <div class="final-stat card-flat">
        <div class="final-stat-num" id="final-avg-dist">&mdash;</div>
        <div class="final-stat-label">Avg Distance</div>
      </div>
      <div class="final-stat card-flat">
        <div class="final-stat-num" id="final-best">0</div>
        <div class="final-stat-label">Best Round</div>
      </div>
    </div>
    <div class="breakdown-title">Round Breakdown</div>
    <div class="breakdown-list" id="final-breakdown"></div>
    <div class="final-actions">
      <button class="btn btn-secondary" id="final-play-again-btn">Play Again</button>
      <button class="btn btn-primary" id="final-dashboard-btn">Back to Dashboard</button>
    </div>
  </div>
</div>
`;

// ── Init controllers ──────────────────────────────────────────────────────
initLocationPicker();
initAuth();
initDashboard();

// ── Game buttons ──────────────────────────────────────────────────────────
document.getElementById('submit-guess-btn').addEventListener('click', () => { closeMapDrawer(); submitGuess(); });
document.getElementById('rr-next-btn').addEventListener('click', () => { closeMapDrawer(); nextRound(); });
document.getElementById('final-dashboard-btn').addEventListener('click', () => showScreen('dashboard'));
document.getElementById('final-play-again-btn').addEventListener('click', startSoloGame);

// ── Mobile map drawer ─────────────────────────────────────────────────────
function openMapDrawer() {
  document.getElementById('game-map-panel').classList.add('open');
  document.getElementById('game-map-backdrop').classList.add('open');
  setTimeout(() => invalidateGameMap(), 300);
}
function closeMapDrawer() {
  document.getElementById('game-map-panel').classList.remove('open');
  document.getElementById('game-map-backdrop').classList.remove('open');
}
document.getElementById('game-map-toggle').addEventListener('click', openMapDrawer);
document.getElementById('game-map-close').addEventListener('click', closeMapDrawer);
document.getElementById('game-map-backdrop').addEventListener('click', closeMapDrawer);

// ── In-map search (Nominatim) ─────────────────────────────────────────────
let searchTimer = null;
const gameSearchInput = document.getElementById('game-map-search');
gameSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = gameSearchInput.value.trim();
  if (q.length < 3) return;
  searchTimer = setTimeout(() => searchAndPan(q), 600);
});
gameSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { clearTimeout(searchTimer); searchAndPan(gameSearchInput.value.trim()); }
});
async function searchAndPan(query) {
  if (!query) return;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const results = await res.json();
    if (results.length > 0) {
      const { lat, lon } = results[0];
      panGameMap(parseFloat(lat), parseFloat(lon), 10);
    }
  } catch { /* silently ignore */ }
}

// ── Join room modal ───────────────────────────────────────────────────────
const joinModal = document.getElementById('join-room-modal');
const joinChars = Array.from(document.querySelectorAll('.join-code-char'));
const joinSubmit = document.getElementById('join-modal-submit');
const joinError = document.getElementById('join-code-error');

function openJoinModal() {
  joinChars.forEach(c => { c.value = ''; c.classList.remove('filled'); });
  joinError.classList.add('hidden');
  joinSubmit.disabled = true;
  joinModal.classList.add('open');
  joinChars[0].focus();
}
function closeJoinModal() {
  joinModal.classList.remove('open');
}

document.getElementById('join-modal-close').addEventListener('click', closeJoinModal);
document.getElementById('join-modal-cancel').addEventListener('click', closeJoinModal);
joinModal.addEventListener('click', e => { if (e.target === joinModal) closeJoinModal(); });

// 6-char input behaviour: auto-advance, backspace, paste
joinChars.forEach((input, i) => {
  input.addEventListener('input', () => {
    const val = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    input.value = val ? val[val.length - 1] : '';
    input.classList.toggle('filled', !!input.value);
    if (input.value && i < 5) joinChars[i + 1].focus();
    joinSubmit.disabled = joinChars.some(c => !c.value);
    joinError.classList.add('hidden');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      joinChars[i - 1].value = '';
      joinChars[i - 1].classList.remove('filled');
      joinChars[i - 1].focus();
      joinSubmit.disabled = true;
    }
    if (e.key === 'Enter' && !joinSubmit.disabled) joinSubmit.click();
  });
  input.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    text.split('').forEach((ch, idx) => {
      if (joinChars[idx]) { joinChars[idx].value = ch; joinChars[idx].classList.add('filled'); }
    });
    const next = Math.min(text.length, 5);
    joinChars[next].focus();
    joinSubmit.disabled = joinChars.some(c => !c.value);
  });
  // Select all on focus so re-typing is easy
  input.addEventListener('focus', () => input.select());
});

joinSubmit.addEventListener('click', async () => {
  const code = joinChars.map(c => c.value).join('').toUpperCase();
  if (code.length < 6) return;
  joinSubmit.disabled = true;
  joinSubmit.textContent = 'Joining...';
  try {
    await joinRoomByCode(code);
    closeJoinModal();
  } catch (err) {
    joinError.textContent = err.message || 'Room not found. Check the code and try again.';
    joinError.classList.remove('hidden');
    joinSubmit.disabled = false;
    joinSubmit.textContent = 'Join Room';
  }
});

// Override the dashboard join button to open modal instead of prompt
document.getElementById('dash-join-btn').addEventListener('click', openJoinModal);
