/**
 * authScreen.js
 * Sign in / Sign up screen controller.
 */

import { signIn, signUp, onAuthChange, getDisplayName } from './auth.js';
import { showScreen } from './utils.js';
import { loadDashboard, rejoinActiveRoom, showLoading } from './dashboardScreen.js';
import { restoreGameSnapshot } from './game.js';

let isSignUp = false;
let initialised = false;

export function initAuth() {
  onAuthChange(async (event, user) => {
    if (event === 'INITIAL_SESSION') {
      if (!initialised) {
        initialised = true;
        if (user) {
          const snapshot = sessionStorage.getItem('gameSnapshot');
          const activeRoomId = sessionStorage.getItem('activeRoomId');
          const hasRestore = snapshot || activeRoomId;

          // Only show dashboard immediately if there's nothing to restore
          if (!hasRestore) showScreen('dashboard');
          else showLoading(true);

          await loadDashboard(user);

          if (snapshot) {
            const restored = restoreGameSnapshot(JSON.parse(snapshot));
            if (!restored) {
              if (activeRoomId) await rejoinActiveRoom(activeRoomId);
              else showScreen('dashboard');
            }
          } else if (activeRoomId) {
            const rejoined = await rejoinActiveRoom(activeRoomId);
            if (!rejoined) showScreen('dashboard');
          }

          if (hasRestore) showLoading(false);
        } else {
          showScreen('auth');
        }
      }
      return;
    }

    if (event === 'SIGNED_IN') {
      const onAuthScreen = document.getElementById('screen-auth')?.classList.contains('active');
      if (onAuthScreen) {
        showScreen('dashboard');
        loadDashboard(user);
      }
      return;
    }

    if (event === 'SIGNED_OUT') {
      initialised = false;
      sessionStorage.removeItem('activeRoomId');
      showScreen('auth');
      return;
    }
  });

  document.getElementById('auth-toggle-link').addEventListener('click', toggleMode);
  document.getElementById('auth-submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
  document.getElementById('auth-confirm').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });

  // Live validation
  document.getElementById('auth-email').addEventListener('blur', () => validateEmail(true));
  document.getElementById('auth-password').addEventListener('blur', () => validatePassword(true));
  document.getElementById('auth-confirm').addEventListener('blur', () => validateConfirm(true));
  document.getElementById('auth-username').addEventListener('blur', () => validateUsername(true));
}

function toggleMode() {
  isSignUp = !isSignUp;
  document.getElementById('auth-title').textContent = isSignUp ? 'Create account' : 'Sign in';
  document.getElementById('auth-sub').textContent = isSignUp
    ? 'Join Where Were We — it\'s free'
    : 'Welcome back to Where Were We';
  document.getElementById('auth-submit-btn').textContent = isSignUp ? 'Create account' : 'Sign in';
  document.getElementById('auth-toggle-text').textContent = isSignUp ? 'Already have an account?' : 'Don\'t have an account?';
  document.getElementById('auth-toggle-link').textContent = isSignUp ? ' Sign in' : ' Sign up';
  document.getElementById('auth-username-field').classList.toggle('hidden', !isSignUp);
  document.getElementById('auth-confirm-field').classList.toggle('hidden', !isSignUp);
  clearFieldErrors();
  hideError();
}

// ── Validation helpers ────────────────────────────────────────────────────
function setFieldError(inputId, hintId, msg) {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  if (msg) {
    input.classList.add('error');
    hint.textContent = msg;
    hint.classList.add('show');
  } else {
    input.classList.remove('error');
    hint.textContent = '';
    hint.classList.remove('show');
  }
  return !msg;
}

function validateEmail(blur = false) {
  const val = document.getElementById('auth-email').value.trim();
  if (!val) return setFieldError('auth-email', 'auth-email-hint', blur ? 'Email is required.' : null);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return setFieldError('auth-email', 'auth-email-hint', 'Enter a valid email address.');
  return setFieldError('auth-email', 'auth-email-hint', null);
}

function validatePassword(blur = false) {
  const val = document.getElementById('auth-password').value;
  if (!val) return setFieldError('auth-password', 'auth-password-hint', blur ? 'Password is required.' : null);
  if (isSignUp && val.length < 8) return setFieldError('auth-password', 'auth-password-hint', 'Password must be at least 8 characters.');
  return setFieldError('auth-password', 'auth-password-hint', null);
}

function validateConfirm(blur = false) {
  if (!isSignUp) return true;
  const pass = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-confirm').value;
  if (!confirm) return setFieldError('auth-confirm', 'auth-confirm-hint', blur ? 'Please confirm your password.' : null);
  if (confirm !== pass) return setFieldError('auth-confirm', 'auth-confirm-hint', 'Passwords do not match.');
  return setFieldError('auth-confirm', 'auth-confirm-hint', null);
}

function validateUsername(blur = false) {
  if (!isSignUp) return true;
  const val = document.getElementById('auth-username').value.trim();
  if (!val) return setFieldError('auth-username', 'auth-username-hint', blur ? 'Username is required.' : null);
  if (val.length < 2) return setFieldError('auth-username', 'auth-username-hint', 'Username must be at least 2 characters.');
  return setFieldError('auth-username', 'auth-username-hint', null);
}

function clearFieldErrors() {
  ['auth-email', 'auth-password', 'auth-confirm', 'auth-username'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });
  ['auth-email-hint', 'auth-password-hint', 'auth-confirm-hint', 'auth-username-hint'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  });
}

async function handleSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value.trim();
  const btn = document.getElementById('auth-submit-btn');

  hideError();

  const emailOk = validateEmail(true);
  const passOk = validatePassword(true);
  const confirmOk = validateConfirm(true);
  const usernameOk = validateUsername(true);
  if (!emailOk || !passOk || !confirmOk || !usernameOk) return;

  btn.disabled = true;
  btn.textContent = isSignUp ? 'Creating account…' : 'Signing in…';

  try {
    if (isSignUp) {
      await signUp(email, password, username);
    } else {
      await signIn(email, password);
    }
  } catch (err) {
    showError(err.message ?? 'Something went wrong. Please try again.');
    btn.disabled = false;
    btn.textContent = isSignUp ? 'Create account' : 'Sign in';
  }
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.add('show');
}

function hideError() {
  document.getElementById('auth-error').classList.remove('show');
}
