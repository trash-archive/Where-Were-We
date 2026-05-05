/**
 * modals.js
 * Shared modal helpers wired to HTML in main.js.
 */

let deleteResolve = null;
let guidelinesResolve = null;

export function initDeleteModal() {
  document.getElementById('delete-modal-cancel').addEventListener('click', () => {
    document.getElementById('delete-confirm-modal').classList.remove('open');
    if (deleteResolve) { deleteResolve(false); deleteResolve = null; }
  });
  document.getElementById('delete-modal-confirm').addEventListener('click', () => {
    document.getElementById('delete-confirm-modal').classList.remove('open');
    if (deleteResolve) { deleteResolve(true); deleteResolve = null; }
  });
  document.getElementById('delete-confirm-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-confirm-modal')) {
      document.getElementById('delete-confirm-modal').classList.remove('open');
      if (deleteResolve) { deleteResolve(false); deleteResolve = null; }
    }
  });
}

export function confirmDelete() {
  return new Promise(resolve => {
    deleteResolve = resolve;
    document.getElementById('delete-confirm-modal').classList.add('open');
  });
}

export function initGuidelinesModal() {
  const acceptBtn = document.getElementById('guidelines-accept-btn');
  const declineBtn = document.getElementById('guidelines-decline-btn');
  if (!acceptBtn || !declineBtn) return;
  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('guidelines-accepted', 'true');
    document.getElementById('guidelines-modal').classList.remove('open');
    if (guidelinesResolve) { guidelinesResolve(true); guidelinesResolve = null; }
  });
  declineBtn.addEventListener('click', () => {
    document.getElementById('guidelines-modal').classList.remove('open');
    if (guidelinesResolve) { guidelinesResolve(false); guidelinesResolve = null; }
  });
}

/** Shows the guidelines modal only if the user hasn't accepted yet. Resolves true if accepted. */
export function showGuidelinesIfNeeded() {
  if (localStorage.getItem('guidelines-accepted') === 'true') return Promise.resolve(true);
  return showGuidelinesModal();
}

/** Always shows the guidelines modal (e.g. from the ⓘ info button). */
export function showGuidelinesModal() {
  const modal = document.getElementById('guidelines-modal');
  if (!modal) return Promise.resolve(true);
  return new Promise(resolve => {
    guidelinesResolve = resolve;
    modal.classList.add('open');
  });
}
