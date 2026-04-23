/**
 * router.js
 * Simple screen switcher — shows one .screen at a time.
 */

const listeners = {}; // screenId -> callback[]

export function onShow(screenId, fn) {
  if (!listeners[screenId]) listeners[screenId] = [];
  listeners[screenId].push(fn);
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById(`screen-${id}`);
  if (!el) { console.error(`Screen #screen-${id} not found`); return; }
  el.classList.add('active');
  // Fire lifecycle hooks
  (listeners[id] ?? []).forEach((fn) => fn());
}
