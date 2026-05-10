/**
 * main.js
 * Entry point — renders all screen HTML, then initialises controllers.
 */

import { showScreen, toast } from './utils.js';
import { supabase } from './supabase.js';
import { initAuth } from './authScreen.js';
import { initDashboard } from './dashboardScreen.js';
import { initLocationPicker } from './locationPicker.js';
import { initDeleteModal, initGuidelinesModal, showGuidelinesModal } from './modals.js';
import { nextRound, submitGuess, invalidateGameMap, panGameMap, placeGamePin, clearSnapshot, quitGame, playAgain, gameState } from './game.js';
import { startSoloGame, joinRoomByCode, renderGameStats } from './dashboardScreen.js';
import { isAdmin, loadAdminPanel } from './adminScreen.js';
// ── Render all screens ────────────────────────────────────────────────────
document.getElementById('app').innerHTML = `

<!-- CONTACT ADMIN MODAL -->
<div id="contact-admin-modal" class="modal-overlay">
  <div class="modal-box contact-admin-box">
    <div class="modal-header">
      <div class="modal-title">Contact Admin</div>
      <button class="btn btn-ghost btn-sm" id="contact-admin-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="contact-admin-body">
      <div class="contact-admin-profile">
        <img src="/hasim-full.jpg" alt="Hasim Tordios" class="contact-admin-photo">
        <div class="contact-admin-name">Hasim Tordios</div>
        <div class="contact-admin-role">App Administrator</div>
      </div>
      <div class="contact-admin-links">
        <a href="mailto:htordios@gmail.com" class="contact-link" target="_blank">
          <span class="contact-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </span>
          <span>htordios@gmail.com</span>
        </a>
        <a href="https://www.instagram.com/_hqsim/" class="contact-link" target="_blank" rel="noopener">
          <span class="contact-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </span>
          <span>@_hqsim</span>
        </a>
        <a href="https://www.facebook.com/trazhhh/" class="contact-link" target="_blank" rel="noopener">
          <span class="contact-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </span>
          <span>Messenger / Facebook</span>
        </a>
        <a href="https://www.linkedin.com/in/hasim-tordios" class="contact-link" target="_blank" rel="noopener">
          <span class="contact-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </span>
          <span>LinkedIn</span>
        </a>

        <a href="https://github.com/trash-archive" class="contact-link contact-link--disabled" aria-disabled="true" tabindex="-1">
          <span class="contact-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S9 17.44 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
          </span>
          <span>GitHub <span class="contact-link-soon">coming soon</span></span>
        </a>
      </div>
    </div>
  </div>
</div>

<!-- HOW TO PLAY MODAL -->
<div id="how-to-play-modal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title">How to Play</div>
      <button class="btn btn-ghost btn-sm" id="htp-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="htp-modal-body">
      <ol class="htp-steps">
        <li>
          <span class="htp-step-num">1</span>
          <div>
            <div class="htp-step-title">Upload photos with GPS</div>
            <div class="htp-step-desc">Add photos taken on your phone or camera. Location data is read automatically, or you can pin it manually.</div>
          </div>
        </li>
        <li>
          <span class="htp-step-num">2</span>
          <div>
            <div class="htp-step-title">A photo is shown — guess where it was taken</div>
            <div class="htp-step-desc">Drop a pin on the world map as close as you can to the real location. You can search for a place or zoom in.</div>
          </div>
        </li>
        <li>
          <span class="htp-step-num">3</span>
          <div>
            <div class="htp-step-title">Score based on distance</div>
            <div class="htp-step-desc">The closer your guess, the more points you earn — up to 5,000 per round. See the result on the map after each guess.</div>
          </div>
        </li>
        <li>
          <span class="htp-step-num">4</span>
          <div>
            <div class="htp-step-title">Play solo or with friends</div>
            <div class="htp-step-desc">Solo mode cycles through your photo pool. In multiplayer, create or join a room — everyone guesses the same photos and scores are compared live.</div>
          </div>
        </li>
      </ol>
      <div class="htp-tip">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>Enable <strong>Community</strong> in Photo sources to mix in other players' public photos for more variety.</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="htp-got-it">Got it</button>
    </div>
  </div>
</div>

<!-- GUIDELINES MODAL -->
<div id="guidelines-modal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title">Community Guidelines</div>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--gray-500);line-height:1.7;margin-bottom:12px;">To keep Where Were We safe and enjoyable for everyone, all uploaded photos must follow these rules:</p>
      <ul class="guidelines-list">
        <li>No explicit, sexual, or adult content</li>
        <li>No graphic violence or disturbing imagery</li>
        <li>No hate symbols, harassment, or discriminatory content</li>
        <li>Only upload photos you own or have rights to share</li>
        <li>No personal or private information visible in photos</li>
      </ul>
      <p style="font-size:12px;color:var(--gray-400);margin-top:12px;line-height:1.6;">Uploads are automatically scanned. Violations may result in removal and account suspension.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="guidelines-decline-btn">Cancel</button>
      <button class="btn btn-primary" id="guidelines-accept-btn">I Agree &amp; Continue</button>
    </div>
  </div>
</div>

<!-- REPORT MODAL -->
<div id="report-modal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title">Report Photo</div>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--gray-500);line-height:1.6;margin-bottom:14px;">Why are you reporting this photo?</p>
      <div class="report-options">
        <label class="report-option"><input type="radio" name="report-reason" value="explicit"> Explicit or adult content</label>
        <label class="report-option"><input type="radio" name="report-reason" value="violence"> Violence or disturbing content</label>
        <label class="report-option"><input type="radio" name="report-reason" value="hate"> Hate speech or harassment</label>
        <label class="report-option"><input type="radio" name="report-reason" value="spam"> Spam or misleading</label>
        <label class="report-option"><input type="radio" name="report-reason" value="other"> Other</label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="report-cancel-btn">Cancel</button>
      <button class="btn btn-danger" id="report-submit-btn" disabled>Submit Report</button>
    </div>
  </div>
</div>

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
    <div class="map-picker-gps-row">
      <button class="btn btn-secondary btn-sm" id="picker-use-location-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        Use my current location
      </button>
      <span class="map-picker-gps-hint">Useful if the photo was taken nearby</span>
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
  <div id="auth-bg-map" class="auth-bg-map"></div>
  <div class="auth-bg-overlay"></div>
  <div class="auth-layout">
    <div class="auth-brand-title" aria-hidden="true">
      <span class="auth-brand-where">Where</span>
      <span class="auth-brand-were">Were</span>
      <span class="auth-brand-we">We</span>
    </div>
    <div class="auth-card card">
    <div class="auth-logo">
      <div class="auth-logo-mark">
        <img src="/logo-black.png" alt="Where Were We" style="height:70px;width:auto;">
      </div>
      <div class="auth-title" id="auth-title">Sign in</div>
      <div class="auth-sub" id="auth-sub">Good to see you again. Your photos are waiting.</div>
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
      <div class="input-password-wrap">
        <input class="input" id="auth-password" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password">
        <button type="button" class="password-eye-btn" id="auth-password-eye" tabindex="-1" aria-label="Toggle password visibility">
          <svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="eye-off-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
      <div class="field-hint" id="auth-password-hint"></div>
    </div>
    <div id="auth-confirm-field" class="auth-field hidden">
      <label class="label">Confirm Password</label>
      <div class="input-password-wrap">
        <input class="input" id="auth-confirm" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="new-password">
        <button type="button" class="password-eye-btn" id="auth-confirm-eye" tabindex="-1" aria-label="Toggle confirm password visibility">
          <svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="eye-off-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
      <div class="field-hint" id="auth-confirm-hint"></div>
    </div>
    <button class="btn btn-primary w-full" id="auth-submit-btn" style="margin-top:4px;">Sign in</button>
    <div class="auth-footer">
      <span id="auth-toggle-text">Don't have an account?</span>
      <a id="auth-toggle-link"> Sign up</a>
    </div>
    <div class="auth-contact-link">
      <a id="auth-contact-admin-btn">Contact Admin</a>
    </div>
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
          <button class="nav-dropdown-item hidden" id="nav-admin-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Admin Panel
          </button>
        </div>
      </div>
    </div>
  </nav>
  <div class="dashboard-layout">

    <!-- Play hero -->
    <div class="play-hero">
      <div id="hero-map" class="hero-map"></div>
      <div class="play-hero-text">
        <div class="play-hero-greeting" id="play-hero-greeting">Welcome back</div>
        <div class="play-hero-title">Ready to guess?</div>
        <div class="play-hero-sub" id="play-hero-sub">Upload photos with GPS and start playing</div>
        <div class="hero-stats" id="dash-stats-section">
          <div class="hero-stat">
            <span class="hero-stat-val" id="stat-games-played">—</span>
            <span class="hero-stat-lbl">Games</span>
          </div>
          <div class="hero-stat-sep"></div>
          <div class="hero-stat">
            <span class="hero-stat-val" id="stat-best-score">—</span>
            <span class="hero-stat-lbl">Best score</span>
          </div>
        </div>
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
        <div class="photo-source-chips">
          <div class="photo-source-label-row">
            <span class="photo-source-label">Photo sources</span>
            <button id="how-to-play-btn" title="How to play" class="htp-icon-btn">?</button>
          </div>
          <div class="photo-source-row">
            <label class="source-chip" for="include-own-toggle">
              <input type="checkbox" id="include-own-toggle" class="source-chip-input" checked>
              <span class="source-chip-inner">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                My photos
              </span>
            </label>
            <label class="source-chip" for="include-community-toggle">
              <input type="checkbox" id="include-community-toggle" class="source-chip-input">
              <span class="source-chip-inner">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Community
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Rooms -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">Multiplayer Rooms</div>
        <button class="btn-join-code" id="dash-join-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="section-title">Your Photos</div>
          <button id="guidelines-info-btn" title="Community Guidelines" style="width:20px;height:20px;border-radius:50%;border:1.5px solid var(--gray-300);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray-400);font-size:11px;font-weight:700;font-family:var(--font-sans);padding:0;transition:border-color 0.15s,color 0.15s;flex-shrink:0;">i</button>
        </div>
        <span id="dash-photo-count" class="text-small text-muted"></span>
      </div>

      <!-- GPS info banner -->
      <div id="gps-info-banner" class="gps-info-banner hidden">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="gps-banner-text">
          <span id="gps-banner-count"></span> &mdash; iPhones and most mobile browsers strip GPS from photos for privacy. Use the <strong>pin icon</strong> on each photo to set its location manually, or search for a place.
        </div>
      </div>
      <input type="file" id="dash-file-input" multiple accept="image/*" style="display:none">
      <div id="dash-photo-grid" class="photo-grid"></div>
      <div id="dash-pagination" class="pagination" style="display:none;"></div>
    </div>

    <!-- Contact Admin footer -->
    <div class="dash-contact-footer">
      <span>Need help or want to report an issue?</span>
      <a id="dash-contact-admin-btn" class="dash-contact-link">Contact Admin</a>
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
      <div class="room-setting-row">
        <div>
          <div class="room-setting-label">Include My Photos</div>
          <div class="room-setting-sub" id="room-include-own-sub">On — your photos are in the pool</div>
        </div>
        <label class="community-toggle-label" id="room-include-own-label" for="room-include-own-toggle">
          <input type="checkbox" id="room-include-own-toggle" class="community-toggle-input" checked>
          <span class="community-toggle-track">
            <span class="community-toggle-thumb"></span>
          </span>
        </label>
      </div>
      <div class="room-setting-row">
        <div>
          <div class="room-setting-label">Community Photos</div>
          <div class="room-setting-sub" id="room-community-sub">Off — only players' photos</div>
        </div>
        <label class="community-toggle-label" id="room-community-label" for="room-community-toggle">
          <input type="checkbox" id="room-community-toggle" class="community-toggle-input">
          <span class="community-toggle-track">
            <span class="community-toggle-thumb"></span>
          </span>
        </label>
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
      <!-- Report button (community photos only) -->
      <button class="game-report-btn hidden" id="game-report-btn" title="Report this photo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        Report
      </button>
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

    <!-- Hero: photo + score overlay -->
    <div class="result-hero">
      <div class="result-photo-wrap">
        <img id="rr-photo" src="" alt="">
        <div class="result-score-overlay">
          <div class="result-score-big" id="rr-score-num">0</div>
          <div class="result-score-label">points</div>
        </div>
      </div>
      <!-- Stats grid -->
      <div class="result-stats">
        <div class="result-stat">
          <div class="result-stat-label">Distance</div>
          <div class="result-stat-value" id="rr-distance">&mdash;</div>
          <div class="result-stat-sub">from actual location</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Your Guess</div>
          <div class="result-stat-value" style="font-size:14px;padding-top:3px;" id="rr-guess-coords">&mdash;</div>
          <div class="result-stat-sub" id="rr-actual-coords">&mdash;</div>
        </div>
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

    <!-- Map -->
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

    <!-- Hero banner -->
    <div class="final-hero">
      <div class="final-medal medal-default" id="final-medal">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
      </div>
      <div class="final-grade" id="final-grade">Game Over</div>
      <div class="final-sub" id="final-sub">Well played!</div>
    </div>

    <!-- Stats -->
    <div class="final-stats">
      <div class="final-stat">
        <div class="final-stat-num" id="final-total">0</div>
        <div class="final-stat-label">Total Score</div>
      </div>
      <div class="final-stat">
        <div class="final-stat-num" id="final-avg-dist">&mdash;</div>
        <div class="final-stat-label">Avg Distance</div>
      </div>
      <div class="final-stat">
        <div class="final-stat-num" id="final-best">0</div>
        <div class="final-stat-label">Best Round</div>
      </div>
    </div>

    <!-- Solo breakdown -->
    <div id="final-solo-section">
      <div class="final-section-title">Round Breakdown</div>
      <div class="final-breakdown" id="final-breakdown"></div>
    </div>

    <!-- Multiplayer leaderboard (hidden in solo) -->
    <div class="final-mp-wrap hidden">
      <div class="final-section-title">Final Leaderboard</div>
      <div class="final-breakdown" id="final-mp-leaderboard"></div>
    </div>

    <div class="final-actions">
      <button class="btn btn-secondary btn-lg" id="final-play-again-btn">Play Again</button>
      <button class="btn btn-primary btn-lg" id="final-dashboard-btn">Back to Dashboard</button>
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

<!-- ADMIN SCREEN -->
<div id="screen-admin" class="screen">
  <nav class="navbar">
    <button class="btn btn-ghost btn-sm" id="admin-back-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      Back
    </button>
    <div class="navbar-brand" style="margin-left:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      Admin Panel
    </div>
  </nav>
  <div class="admin-layout">
    <div id="admin-panel-wrap"></div>
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

<!-- FULL-PAGE DRAG OVERLAY -->
<div id="drag-overlay" class="drag-overlay">
  <div class="drag-overlay-inner">
    <div class="drag-overlay-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
    <div class="drag-overlay-title">Drop photos here</div>
    <div class="drag-overlay-sub">JPEG, PNG, WebP &middot; GPS auto-detected</div>
  </div>
</div>

<!-- KICKED MODAL -->
<div id="kicked-modal" class="modal-overlay">
  <div class="modal-box" style="text-align:center;">
    <div class="modal-body" style="padding:40px 32px 28px;">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--red-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </div>
      <div style="font-size:18px;font-weight:600;margin-bottom:8px;">Removed from room</div>
      <p style="font-size:14px;color:var(--gray-500);line-height:1.6;margin-bottom:0;">The host removed you from the room.</p>
    </div>
    <div class="modal-footer" style="justify-content:center;padding-bottom:28px;">
      <button class="btn btn-primary" id="kicked-ok">Back to Dashboard</button>
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
initGuidelinesModal();
initAuth();
initDashboard();

// ── Hero background map ───────────────────────────────────────────────────
(function initHeroMap() {
  const el = document.getElementById('hero-map');
  if (!el || typeof L === 'undefined') return;
  const map = L.map(el, {
    center: [20, 10],
    zoom: 3,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    touchZoom: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
    preferCanvas: true,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);
  // Leaflet can't measure size until the element is visible in the DOM
  setTimeout(() => map.invalidateSize(), 100);
  // Re-measure whenever the dashboard screen is shown (e.g. after login)
  const observer = new MutationObserver(() => {
    const dash = document.getElementById('screen-dashboard');
    if (dash?.classList.contains('active')) map.invalidateSize();
  });
  const dash = document.getElementById('screen-dashboard');
  if (dash) observer.observe(dash, { attributes: true, attributeFilter: ['class'] });
})();

// ── Auth background map ───────────────────────────────────────────────────
(function initAuthBgMap() {
  const el = document.getElementById('auth-bg-map');
  if (!el || typeof L === 'undefined') return;
  const map = L.map(el, {
    center: [30, 15],
    zoom: 3,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    touchZoom: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
    preferCanvas: true,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
  const authScreen = document.getElementById('screen-auth');
  if (authScreen) {
    new MutationObserver(() => {
      if (authScreen.classList.contains('active')) map.invalidateSize();
    }).observe(authScreen, { attributes: true, attributeFilter: ['class'] });
  }
})();

// ── Contact Admin modal ───────────────────────────────────────────────────
function openContactAdmin() {
  document.getElementById('contact-admin-modal').classList.add('open');
}
document.getElementById('contact-admin-close').addEventListener('click', () => {
  document.getElementById('contact-admin-modal').classList.remove('open');
});
document.getElementById('contact-admin-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('contact-admin-modal'))
    document.getElementById('contact-admin-modal').classList.remove('open');
});
document.getElementById('auth-contact-admin-btn').addEventListener('click', openContactAdmin);
document.getElementById('dash-contact-admin-btn').addEventListener('click', openContactAdmin);
// Prevent disabled GitHub link from navigating
document.querySelector('.contact-link--disabled')?.addEventListener('click', e => e.preventDefault());

// ── How to Play modal ────────────────────────────────────────────────
const htpModal = document.getElementById('how-to-play-modal');
function openHtp() { htpModal.classList.add('open'); }
function closeHtp() { htpModal.classList.remove('open'); }
document.getElementById('how-to-play-btn').addEventListener('click', openHtp);
document.getElementById('htp-close').addEventListener('click', closeHtp);
document.getElementById('htp-got-it').addEventListener('click', closeHtp);
htpModal.addEventListener('click', e => { if (e.target === htpModal) closeHtp(); });

// ── Guidelines info button ────────────────────────────────────────────────
document.getElementById('guidelines-info-btn').addEventListener('click', () => showGuidelinesModal());

// ── Admin panel ───────────────────────────────────────────────────────────
document.getElementById('nav-admin-btn').addEventListener('click', () => {
  showScreen('admin');
  loadAdminPanel();
});
document.getElementById('admin-back-btn').addEventListener('click', () => {
  // Reset so next open re-fetches fresh data
  const wrap = document.getElementById('admin-panel-wrap');
  wrap.innerHTML = '';
  delete wrap.dataset.ready;
  showScreen('dashboard');
});

// Expose showAdminBtn so dashboardScreen can call it after login
export function showAdminNavBtn(user) {
  document.getElementById('nav-admin-btn').classList.toggle('hidden', !isAdmin(user));
}

// ── Report modal ──────────────────────────────────────────────────────────
const reportModal = document.getElementById('report-modal');
const reportSubmit = document.getElementById('report-submit-btn');
reportModal.querySelectorAll('input[name="report-reason"]').forEach(r => {
  r.addEventListener('change', () => { reportSubmit.disabled = false; });
});
document.getElementById('report-cancel-btn').addEventListener('click', () => {
  reportModal.classList.remove('open');
  reportModal.querySelectorAll('input[name="report-reason"]').forEach(r => { r.checked = false; });
  reportSubmit.disabled = true;
});
reportModal.addEventListener('click', e => {
  if (e.target === reportModal) document.getElementById('report-cancel-btn').click();
});
reportSubmit.addEventListener('click', async () => {
  const reason = reportModal.querySelector('input[name="report-reason"]:checked')?.value;
  const photoId = reportModal.dataset.photoId;
  if (!reason || !photoId) return;
  reportSubmit.disabled = true;
  reportSubmit.textContent = 'Submitting…';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('photo_reports').insert({ photo_id: photoId, reason, reporter_id: user?.id });
    document.getElementById('report-cancel-btn').click();
    toast('Report submitted. Thank you!', 'success');
  } catch {
    reportSubmit.disabled = false;
    reportSubmit.textContent = 'Submit Report';
  }
});

// ── Game buttons ──────────────────────────────────────────────────────────
document.getElementById('submit-guess-btn').addEventListener('click', () => { closeMapDrawer(); submitGuess(); });
document.getElementById('rr-next-btn').addEventListener('click', () => { closeMapDrawer(); nextRound(); });
document.getElementById('final-dashboard-btn').addEventListener('click', () => { clearSnapshot(); showScreen('dashboard'); if (gameState.userId) renderGameStats(gameState.userId); });
document.getElementById('final-play-again-btn').addEventListener('click', playAgain);

// ── Report photo during gameplay ──────────────────────────────────────────
document.getElementById('game-report-btn').addEventListener('click', () => {
  const btn = document.getElementById('game-report-btn');
  const photoId = btn.dataset.photoId;
  if (!photoId) return;
  const modal = document.getElementById('report-modal');
  modal.dataset.photoId = photoId;
  modal.classList.add('open');
});

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
document.getElementById('kicked-ok').addEventListener('click', () => {
  document.getElementById('kicked-modal').classList.remove('open');
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

// ── Source chip toggles — restore + persist ──────────────────────────────
const communityCheckbox = document.getElementById('include-community-toggle');
const ownCheckbox = document.getElementById('include-own-toggle');
const _communityOn = localStorage.getItem('community-photos') === 'true';
const _ownOn = localStorage.getItem('include-own-photos') !== 'false'; // default true
communityCheckbox.checked = _communityOn;
ownCheckbox.checked = _ownOn;
// Sync active class on chips
communityCheckbox.closest('.source-chip').classList.toggle('is-on', _communityOn);
ownCheckbox.closest('.source-chip').classList.toggle('is-on', _ownOn);
ownCheckbox.addEventListener('change', () => {
  if (!ownCheckbox.checked && !communityCheckbox.checked) {
    ownCheckbox.checked = true;
    ownCheckbox.closest('.source-chip').classList.add('is-on');
    toast('At least one photo source must be active.', 'error');
    return;
  }
  ownCheckbox.closest('.source-chip').classList.toggle('is-on', ownCheckbox.checked);
  localStorage.setItem('include-own-photos', ownCheckbox.checked);
});
communityCheckbox.addEventListener('change', () => {
  if (!communityCheckbox.checked && !ownCheckbox.checked) {
    communityCheckbox.checked = true;
    communityCheckbox.closest('.source-chip').classList.add('is-on');
    toast('At least one photo source must be active.', 'error');
    return;
  }
  communityCheckbox.closest('.source-chip').classList.toggle('is-on', communityCheckbox.checked);
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
