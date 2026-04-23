/**
 * modals.js
 * Shared modal helpers wired to HTML in main.js.
 */

let deleteResolve = null;

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
