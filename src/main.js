/**
 * main.js
 * Entry point — renders all screen HTML, then initialises controllers.
 */

import { showScreen } from './utils.js';
import { initAuth } from './authScreen.js';
import { initDashboard } from './dashboardScreen.js';
import { initLocationPicker } from './locationPicker.js';
import { initDeleteModal } from './modals.js';
import { nextRound, submitGuess, invalidateGameMap, panGameMap, placeGamePin, clearSnapshot, quitGame, playAgain } from './game.js';
import { startSoloGame, joinRoomByCode } from './dashboardScreen.js';
// ── Render all screens ────────────────────────────────────────────────────
document.getElementById('app').innerHTML = `

<!-- LOADING OVERLAY -->
<div id="loading-overlay" class="loading-overlay">
  <div class="spinner"></div>
  <p class="loading-text" id="loading-text">Loading&hellip;</p>
  <div id="loading-progress" class="loading-progress hidden">
    <div class="loading-bar-track"><div class="loading-bar-fill" id="loading-bar-fill"></div></div>
    <p class="loading-counter" id="loading-counter"></p>
  </div>
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
        <img src="/logo-black.png" alt="Where Were We" style="height:70px;width:auto;">
      </div>
      <div class="auth-title" id="auth-title">Sign in</div>
      <div class="auth-sub" id="auth-sub">Welcome back to Where Were We</div>
    </div>
    <div class="auth-error" id="auth-error"></div>
    <div id="auth-username-field" class="auth-field hidden">
      <label class="label">Username</label>
      <input class="input" id="auth-username" type="text" placeholder="Your display name" autocomplete="username">
      <div class="field-hint" id="auth-username-hint"></div>
    </div>
    <div class="auth-field">
      <label class="label">Email</label>
      <input class="input" id="auth-email" type="email" placeholder="you@example.com" autocomplete="email">
      <div class="field-hint" id="auth-email-hint"></div>
    </div>
    <div class="auth-field">
      <label class="label">Password</label>
      <input class="input" id="auth-password" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password">
      <div class="field-hint" id="auth-password-hint"></div>
    </div>
    <div id="auth-confirm-field" class="auth-field hidden">
      <label class="label">Confirm Password</label>
      <input class="input" id="auth-confirm" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="new-password">
      <div class="field-hint" id="auth-confirm-hint"></div>
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
      <img src="/logo-black.png" alt="Where Were We" style="height:40px;width:auto;">
      Where Were We
    </div>
    <div class="navbar-right">
      <div class="nav-user" id="nav-user">
        <button class="nav-user-btn" id="nav-user-btn">
          <div class="nav-user-avatar" id="nav-user-avatar">?</div>
          <span class="nav-user-name" id="nav-username"></span>
          <svg class="nav-user-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-dropdown" id="nav-dropdown">
          <div class="nav-dropdown-header">
            <div class="nav-dropdown-name" id="nav-dropdown-name"></div>
            <div class="nav-dropdown-email" id="nav-dropdown-email"></div>
          </div>
          <button class="nav-dropdown-item danger" id="nav-signout-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  </nav>
  <div class="dashboard-layout">

    <!-- Play hero -->
    <div class="play-hero">
      <div class="play-hero-text">
        <div class="play-hero-greeting" id="play-hero-greeting">Welcome back</div>
        <div class="play-hero-title">Ready to guess?</div>
        <div class="play-hero-sub" id="play-hero-sub">Upload photos with GPS and start playing</div>
      </div>
      <div class="play-hero-actions">
        <div class="play-hero-btns">
          <button class="btn-play-solo" id="dash-play-btn" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play Solo
          </button>
          <button class="btn-play-multi" id="dash-room-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Multiplayer
          </button>
        </div>
        <label class="community-toggle-label" for="include-community-toggle">
          <input type="checkbox" id="include-community-toggle" class="community-toggle-input">
          <span class="community-toggle-track">
            <span class="community-toggle-thumb"></span>
          </span>
          <span class="community-toggle-text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Include community photos
          </span>
        </label>
      </div>
    </div>

    <!-- Rooms -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">Multiplayer Rooms</div>
        <button class="btn btn-secondary btn-sm" id="dash-join-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Join with Code
        </button>
      </div>
      <div class="card rooms-scroll-card">
        <div id="dash-rooms-list">
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

    <!-- Photos -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">Your Photos</div>
        <span id="dash-photo-count" class="text-small text-muted"></span>
      </div>
      <div class="upload-zone" id="dash-drop-zone">
        <div class="upload-zone-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        </div>
        <div class="upload-zone-title">Drop photos here or click to browse</div>
        <div class="upload-zone-sub">JPEG, PNG, WebP, HEIC &mdash; max 20 MB &middot; GPS auto-detected</div>
      </div>
      <input type="file" id="dash-file-input" multiple accept="image/*" style="display:none">
      <div id="dash-photo-grid" class="photo-grid" style="margin-top:14px;"></div>
      <div id="dash-pagination" class="pagination" style="display:none;"></div>
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
      <div class="game-players-pill hidden" id="game-players-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span id="game-players-count">0</span>
      </div>
      <div class="game-score-pill" id="game-score-display">0 pts</div>
      <button class="game-quit-btn hidden" id="game-quit-btn" title="Leave game">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span class="game-quit-label">Leave</span>
      </button>
    </div>
  </nav>
  <div class="game-map-backdrop" id="game-map-backdrop"></div>
  <div class="game-body">
    <div class="game-photo-panel">
      <div class="game-photo-zoom-wrap" id="game-photo-zoom-wrap">
        <img id="game-photo-img" src="" alt="Guess this location">
      </div>
      <!-- Zoom controls -->
      <div class="game-photo-zoom-controls">
        <button class="game-photo-zoom-btn" id="zoom-in-btn" title="Zoom in" aria-label="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button class="game-photo-zoom-btn" id="zoom-out-btn" title="Zoom out" aria-label="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button class="game-photo-zoom-btn" id="zoom-reset-btn" title="Reset zoom" aria-label="Reset zoom">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>
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

    <!-- Multiplayer scoreboard (hidden in solo) -->
    <div class="rr-mp-wrap hidden">
      <div class="rr-mp-title">Round Scores</div>
      <div class="rr-mp-table-wrap">
        <table class="rr-mp-table">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Distance</th><th>Round</th><th>Total</th>
            </tr>
          </thead>
          <tbody id="rr-mp-scoreboard"></tbody>
        </table>
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

    <!-- Multiplayer leaderboard (hidden in solo) -->
    <div class="final-mp-wrap hidden">
      <div class="breakdown-title">Final Leaderboard</div>
      <div class="breakdown-list" id="final-mp-leaderboard"></div>
    </div>

    <div class="final-actions">
      <button class="btn btn-secondary" id="final-play-again-btn">Play Again</button>
      <button class="btn btn-primary" id="final-dashboard-btn">Back to Dashboard</button>
    </div>
  </div>
</div>
<!-- QUIT CONFIRM MODAL -->
<div id="quit-confirm-modal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title" id="quit-modal-title">Leave game?</div>
    </div>
    <div class="modal-body">
      <p id="quit-modal-body" style="font-size:14px;color:var(--gray-500);line-height:1.6;"></p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="quit-modal-cancel">Stay</button>
      <button class="btn btn-danger" id="quit-modal-confirm">Leave</button>
    </div>
  </div>
</div>

<!-- DELETE CONFIRM MODAL -->
<div id="delete-confirm-modal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title">Delete photo?</div>
    </div>
    <div class="modal-body">
      <p style="font-size:14px;color:var(--gray-500);line-height:1.6;">This will permanently remove the photo. This action cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="delete-modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="delete-modal-confirm">Delete</button>
    </div>
  </div>
</div>

<!-- HOST ENDED MODAL -->
<div id="host-ended-modal" class="modal-overlay">
  <div class="modal-box" style="text-align:center;">
    <div class="modal-body" style="padding:40px 32px 28px;">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--red-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </div>
      <div style="font-size:18px;font-weight:600;margin-bottom:8px;">Game ended</div>
      <p style="font-size:14px;color:var(--gray-500);line-height:1.6;margin-bottom:0;">The host left the game. Thanks for playing!</p>
    </div>
    <div class="modal-footer" style="justify-content:center;padding-bottom:28px;">
      <button class="btn btn-primary" id="host-ended-ok">Back to Dashboard</button>
    </div>
  </div>
</div>
`;

// ── Init controllers ──────────────────────────────────────────────────────
initLocationPicker();
initDeleteModal();
initAuth();
initDashboard();

// ── Game buttons ──────────────────────────────────────────────────────────
document.getElementById('submit-guess-btn').addEventListener('click', () => { closeMapDrawer(); submitGuess(); });
document.getElementById('rr-next-btn').addEventListener('click', () => { closeMapDrawer(); nextRound(); });
document.getElementById('final-dashboard-btn').addEventListener('click', () => { clearSnapshot(); showScreen('dashboard'); });
document.getElementById('final-play-again-btn').addEventListener('click', playAgain);

// ── Quit / host-ended modals ────────────────────────────────────────────────────
document.getElementById('game-quit-btn').addEventListener('click', () => quitGame('confirm'));
document.getElementById('quit-modal-cancel').addEventListener('click', () => {
  document.getElementById('quit-confirm-modal').classList.remove('open');
});
document.getElementById('quit-modal-confirm').addEventListener('click', () => {
  document.getElementById('quit-confirm-modal').classList.remove('open');
  quitGame('execute');
});
document.getElementById('host-ended-ok').addEventListener('click', () => {
  document.getElementById('host-ended-modal').classList.remove('open');
  clearSnapshot();
  showScreen('dashboard');
});

// ── Mobile map drawer ─────────────────────────────────────────────────────
function openMapDrawer() {
  document.getElementById('game-map-panel').classList.add('open');
  document.getElementById('game-map-backdrop').classList.add('open');
  setTimeout(() => invalidateGameMap(), 350);
}
function closeMapDrawer() {
  document.getElementById('game-map-panel').classList.remove('open');
  document.getElementById('game-map-backdrop').classList.remove('open');
}
document.getElementById('game-map-toggle').addEventListener('click', openMapDrawer);
document.getElementById('game-map-close').addEventListener('click', closeMapDrawer);
document.getElementById('game-map-backdrop').addEventListener('click', closeMapDrawer);

// ── In-map search (with dropdown, mirrors locationPicker) ────────────────
let searchTimer = null;
let gameSearchFocusedIndex = -1;
const gameSearchInput = document.getElementById('game-map-search');

gameSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = gameSearchInput.value.trim();
  if (!q) { clearGameSearchDropdown(); return; }
  searchTimer = setTimeout(() => gameGeocode(q), 400);
});
gameSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveGameSearchFocus(1); return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); moveGameSearchFocus(-1); return; }
  if (e.key === 'Escape')    { clearGameSearchDropdown(); return; }
  if (e.key === 'Enter')     { clearTimeout(searchTimer); gameGeocode(gameSearchInput.value.trim()); }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.game-map-search-wrap')) clearGameSearchDropdown();
});

const GEOCODE_HOST = 'photon.komoot.io';

async function gameGeocode(query) {
  if (!query || query.length < 3) return;
  try {
    const url = new URL('https://photon.komoot.io/api/');
    if (url.hostname !== GEOCODE_HOST) return;
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');
    const res = await fetch(url.toString());
    const { features } = await res.json();
    showGameSearchDropdown(features);
  } catch {}
}

function showGameSearchDropdown(features) {
  clearGameSearchDropdown();
  if (!features.length) return;
  const wrap = document.querySelector('.game-map-search-wrap');
  const ul = document.createElement('ul');
  ul.className = 'picker-search-dropdown';
  features.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'picker-search-item';
    const p = f.properties;
    if (p.osm_value) {
      const typeSpan = document.createElement('span');
      typeSpan.className = 'psi-type';
      typeSpan.textContent = p.osm_value.replace(/_/g, ' ');
      li.appendChild(typeSpan);
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'psi-name';
    nameSpan.textContent = formatPhotonLabel(p);
    li.appendChild(nameSpan);
    li.addEventListener('mousedown', (e) => { e.preventDefault(); selectGameSearchResult(f); });
    li.addEventListener('touchend', (e) => { e.preventDefault(); selectGameSearchResult(f); });
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  gameSearchFocusedIndex = -1;
}

function formatPhotonLabel(p) {
  const primary = [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street].filter(Boolean).join(', ');
  const locality = p.city || p.town || p.village || p.district || p.county || '';
  const region = [p.state, p.country].filter(Boolean).join(', ');
  return [primary, locality, region].filter(Boolean).join(' · ');
}

function moveGameSearchFocus(dir) {
  const items = document.querySelectorAll('.game-map-search-wrap .picker-search-item');
  if (!items.length) return;
  items[gameSearchFocusedIndex]?.classList.remove('focused');
  gameSearchFocusedIndex = Math.max(0, Math.min(items.length - 1, gameSearchFocusedIndex + dir));
  items[gameSearchFocusedIndex].classList.add('focused');
  items[gameSearchFocusedIndex].scrollIntoView({ block: 'nearest' });
}

function selectGameSearchResult(f) {
  const [lon, lat] = f.geometry.coordinates;
  panGameMap(lat, lon, 10);
  placeGamePin(lat, lon);
  gameSearchInput.value = formatPhotonLabel(f.properties);
  clearGameSearchDropdown();
}

function clearGameSearchDropdown() {
  document.querySelector('.game-map-search-wrap .picker-search-dropdown')?.remove();
  gameSearchFocusedIndex = -1;
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

// ── Community toggle — restore + persist ─────────────────────────────────
const communityCheckbox = document.getElementById('include-community-toggle');
const communityLabel = communityCheckbox.closest('.community-toggle-label');
const _communityOn = localStorage.getItem('community-photos') === 'true';
communityCheckbox.checked = _communityOn;
communityLabel.classList.toggle('is-on', _communityOn);
communityCheckbox.addEventListener('change', () => {
  communityLabel.classList.toggle('is-on', communityCheckbox.checked);
  localStorage.setItem('community-photos', communityCheckbox.checked);
});

// ── System / browser back button ──────────────────────────────────────────
window.addEventListener('popstate', (e) => {
  const screen = e.state?.screen;

  // 1. If any modal is open, close it and re-push so back doesn't leave the screen
  const openModal = document.querySelector(
    '.modal-overlay.open, .map-picker-modal.open'
  );
  if (openModal) {
    openModal.classList.remove('open');
    history.pushState({ screen }, '', location.pathname);
    return;
  }

  // 2. If the mobile map drawer is open, close it instead
  if (document.getElementById('game-map-panel').classList.contains('open')) {
    closeMapDrawer();
    history.pushState({ screen }, '', location.pathname);
    return;
  }

  // 3. Per-screen back behaviour
  switch (screen) {
    case 'auth':
    case 'dashboard':
      // Already at root — re-push to prevent leaving the app
      history.pushState({ screen }, '', location.pathname);
      break;

    case 'room':
      // Back from room lobby → dashboard (same as clicking the Back button)
      document.getElementById('room-leave-btn').click();
      break;

    case 'game':
      // Back during gameplay → trigger the quit flow (shows confirm modal for MP)
      quitGame('confirm');
      // Re-push so if they cancel the modal the history entry is still there
      history.pushState({ screen: 'game' }, '', location.pathname);
      break;

    case 'round-result':
      // Can't go back mid-round — re-push to block
      history.pushState({ screen: 'round-result' }, '', location.pathname);
      break;

    case 'final':
      // Back from final → dashboard
      clearSnapshot();
      showScreen('dashboard');
      break;

    default:
      // Unknown state (e.g. first load with no state) — go to whatever is active
      history.pushState({ screen: sessionStorage.getItem('activeScreen') ?? 'auth' }, '', location.pathname);
      break;
  }
});

// ── Photo zoom ────────────────────────────────────────────────────────────
(function initPhotoZoom() {
  const wrap = document.getElementById('game-photo-zoom-wrap');
  const img  = document.getElementById('game-photo-img');

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const STEP      = 0.5;

  let scale  = 1;
  let ox = 0, oy = 0;   // current translate offset
  let startX, startY, startOx, startOy;
  let isDragging = false;

  // ── helpers ──────────────────────────────────────────────────────────────
  function clampOffset(s, x, y) {
    // How far the image can travel before showing empty space
    const maxX = Math.max(0, (wrap.clientWidth  * (s - 1)) / 2);
    const maxY = Math.max(0, (wrap.clientHeight * (s - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function applyTransform(animate = false) {
    img.style.transition = animate ? 'transform 0.2s ease' : 'none';
    img.style.transform  = `translate(${ox}px, ${oy}px) scale(${scale})`;
    wrap.classList.toggle('zoomed', scale > 1);
  }

  function zoomTo(newScale, pivotX, pivotY) {
    // pivotX/Y are relative to the wrap element
    const rect = wrap.getBoundingClientRect();
    const px = (pivotX ?? rect.width  / 2) - rect.width  / 2;
    const py = (pivotY ?? rect.height / 2) - rect.height / 2;

    const ratio = newScale / scale;
    ox = px + (ox - px) * ratio;
    oy = py + (oy - py) * ratio;
    scale = newScale;

    const clamped = clampOffset(scale, ox, oy);
    ox = clamped.x; oy = clamped.y;
    applyTransform(true);
  }

  function resetZoom() {
    scale = 1; ox = 0; oy = 0;
    applyTransform(true);
  }

  // Reset zoom whenever a new round loads (image src changes)
  img.addEventListener('load', resetZoom);

  // ── Zoom buttons ──────────────────────────────────────────────────────────
  document.getElementById('zoom-in-btn').addEventListener('click', () => {
    zoomTo(Math.min(MAX_SCALE, parseFloat((scale + STEP).toFixed(2))));
  });
  document.getElementById('zoom-out-btn').addEventListener('click', () => {
    const next = Math.max(MIN_SCALE, parseFloat((scale - STEP).toFixed(2)));
    if (next <= MIN_SCALE) resetZoom(); else zoomTo(next);
  });
  document.getElementById('zoom-reset-btn').addEventListener('click', resetZoom);

  // ── Mouse wheel zoom (desktop) ────────────────────────────────────────────
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    const pivotX = e.clientX - rect.left;
    const pivotY = e.clientY - rect.top;
    const delta  = e.deltaY < 0 ? STEP : -STEP;
    const next   = Math.min(MAX_SCALE, Math.max(MIN_SCALE, parseFloat((scale + delta).toFixed(2))));
    if (next <= MIN_SCALE) resetZoom(); else zoomTo(next, pivotX, pivotY);
  }, { passive: false });

  // ── Mouse drag (desktop) ──────────────────────────────────────────────────
  wrap.addEventListener('mousedown', (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    startOx = ox; startOy = oy;
    wrap.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const clamped = clampOffset(scale, startOx + dx, startOy + dy);
    ox = clamped.x; oy = clamped.y;
    applyTransform(false);
  });
  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    wrap.classList.remove('dragging');
  });

  // ── Double-click to zoom in / reset (desktop) ─────────────────────────────
  wrap.addEventListener('dblclick', (e) => {
    const rect = wrap.getBoundingClientRect();
    if (scale > 1) {
      resetZoom();
    } else {
      zoomTo(2.5, e.clientX - rect.left, e.clientY - rect.top);
    }
  });

  // ── Pinch-to-zoom + drag (touch) ──────────────────────────────────────────
  let lastDist   = null;
  let lastMidX   = null, lastMidY = null;
  let touchStartOx, touchStartOy, touchStartX, touchStartY;
  let isSingleDrag = false;

  function getTouchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }
  function getTouchMid(t, rect) {
    return {
      x: ((t[0].clientX + t[1].clientX) / 2) - rect.left,
      y: ((t[0].clientY + t[1].clientY) / 2) - rect.top,
    };
  }

  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastDist = getTouchDist(e.touches);
      const rect = wrap.getBoundingClientRect();
      const mid  = getTouchMid(e.touches, rect);
      lastMidX = mid.x; lastMidY = mid.y;
      isSingleDrag = false;
    } else if (e.touches.length === 1 && scale > 1) {
      isSingleDrag = true;
      touchStartX  = e.touches[0].clientX;
      touchStartY  = e.touches[0].clientY;
      touchStartOx = ox; touchStartOy = oy;
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const rect    = wrap.getBoundingClientRect();
      const newDist = getTouchDist(e.touches);
      const mid     = getTouchMid(e.touches, rect);
      const ratio   = newDist / lastDist;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, parseFloat((scale * ratio).toFixed(3))));

      // Pan with the midpoint movement
      const dmx = mid.x - lastMidX;
      const dmy = mid.y - lastMidY;
      const pivotX = lastMidX - rect.width  / 2;
      const pivotY = lastMidY - rect.height / 2;
      const scaleRatio = newScale / scale;
      ox = pivotX + (ox - pivotX) * scaleRatio + dmx;
      oy = pivotY + (oy - pivotY) * scaleRatio + dmy;
      scale = newScale;

      const clamped = clampOffset(scale, ox, oy);
      ox = clamped.x; oy = clamped.y;
      applyTransform(false);

      lastDist = newDist; lastMidX = mid.x; lastMidY = mid.y;
    } else if (e.touches.length === 1 && isSingleDrag) {
      e.preventDefault();
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      const clamped = clampOffset(scale, touchStartOx + dx, touchStartOy + dy);
      ox = clamped.x; oy = clamped.y;
      applyTransform(false);
    }
  }, { passive: false });

  wrap.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) { lastDist = null; }
    if (e.touches.length === 0) { isSingleDrag = false; }
    // Snap back to min if scale drifted below 1
    if (scale < MIN_SCALE) resetZoom();
  });

  // ── Double-tap to zoom (touch) ────────────────────────────────────────────
  let lastTap = 0;
  wrap.addEventListener('touchend', (e) => {
    if (e.touches.length !== 0) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      const rect = wrap.getBoundingClientRect();
      const t = e.changedTouches[0];
      if (scale > 1) {
        resetZoom();
      } else {
        zoomTo(2.5, t.clientX - rect.left, t.clientY - rect.top);
      }
      e.preventDefault();
    }
    lastTap = now;
  });
})();
