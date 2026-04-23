/**
 * authScreen.js
 * Sign in / Sign up screen controller.
 */

import { signIn, signUp, onAuthChange, getDisplayName } from './auth.js';
import { showScreen } from './utils.js';
import { loadDashboard } from './dashboardScreen.js';

let isSignUp = false;
let initialised = false;

export function initAuth() {
  onAuthChange((event, user) => {
    if (event === 'INITIAL_SESSION') {
      // Fires once on page load — route to the right starting screen
      if (!initialised) {
        initialised = true;
        if (user) {
          showScreen('dashboard');
          loadDashboard(user);
        } else {
          showScreen('auth');
        }
      }
      return;
    }

    if (event === 'SIGNED_IN') {
      // Only navigate if we're actually on the auth screen (real login, not tab refocus)
      const onAuthScreen = document.getElementById('screen-auth')?.classList.contains('active');
      if (onAuthScreen) {
        showScreen('dashboard');
        loadDashboard(user);
      }
      return;
    }

    if (event === 'SIGNED_OUT') {
      initialised = false;
      showScreen('auth');
      return;
    }
    // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY — ignore
  });

  document.getElementById('auth-toggle-link').addEventListener('click', toggleMode);
  document.getElementById('auth-submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
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
  hideError();
}

async function handleSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value.trim();
  const btn = document.getElementById('auth-submit-btn');

  hideError();
  if (!email || !password) { showError('Please fill in all fields.'); return; }
  if (isSignUp && !username) { showError('Please enter a username.'); return; }

  btn.disabled = true;
  btn.textContent = isSignUp ? 'Creating account…' : 'Signing in…';

  try {
    if (isSignUp) {
      await signUp(email, password, username);
    } else {
      await signIn(email, password);
    }
    // onAuthChange will fire and route to dashboard
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
