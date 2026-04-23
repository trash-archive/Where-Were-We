/**
 * uploadScreen.js
 * Handles the upload UI, EXIF extraction, and manual location modal.
 */

import { extractGPS } from './exif.js';
import { state } from './state.js';
import { showScreen } from './router.js';

// ── DOM refs ──────────────────────────────────────────────────────────────
const dropZone = () => document.getElementById('drop-zone');
const fileInput = () => document.getElementById('file-input');
const imgGrid = () => document.getElementById('img-grid');
const imgCount = () => document.getElementById('img-count');
const imagesSection = () => document.getElementById('images-section');
const playBtn = () => document.getElementById('play-btn');
const manualOverlay = () => document.getElementById('manual-overlay');
const latInput = () => document.getElementById('lat-input');
const lngInput = () => document.getElementById('lng-input');
const manualImgName = () => document.getElementById('manual-img-name');

let manualTargetId = null;

// ── Init ──────────────────────────────────────────────────────────────────
export function initUploadScreen() {
  // Drop zone events
  dropZone().addEventListener('click', () => fileInput().click());
  dropZone().addEventListener('dragover', (e) => { e.preventDefault(); dropZone().classList.add('dragover'); });
  dropZone().addEventListener('dragleave', () => dropZone().classList.remove('dragover'));
  dropZone().addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone().classList.remove('dragover');
    processFiles(Array.from(e.dataTransfer.files));
  });

  fileInput().addEventListener('change', (e) => processFiles(Array.from(e.target.files)));

  // "Add More" button
  document.getElementById('add-more-btn').addEventListener('click', () => fileInput().click());

  // Clear button
  document.getElementById('clear-btn').addEventListener('click', () => {
    state.images = [];
    renderGrid();
  });

  // Play button
  playBtn().addEventListener('click', () => {
    if (state.images.filter(i => i.lat !== null).length > 0) {
      import('./gameScreen.js').then(m => m.startGame());
    }
  });

  // Back button
  document.getElementById('upload-back-btn').addEventListener('click', () => showScreen('home'));

  // Modal buttons
  document.getElementById('manual-cancel-btn').addEventListener('click', closeManualModal);
  document.getElementById('manual-save-btn').addEventListener('click', saveManualLocation);

  // Close modal on overlay click
  manualOverlay().addEventListener('click', (e) => {
    if (e.target === manualOverlay()) closeManualModal();
  });
}

// ── File Processing ───────────────────────────────────────────────────────
async function processFiles(files) {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  const total = imageFiles.length;
  showLoading(true, 0, total);

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    showLoading(true, i + 1, total);
    const gps = await extractGPS(file);
    state.images.push({
      id: generateId(),
      file,
      url: URL.createObjectURL(file),
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      name: file.name,
    });
  }

  showLoading(false);
  renderGrid();

  // Reset file input so same files can be re-added if cleared
  fileInput().value = '';
}

// ── Grid Rendering ────────────────────────────────────────────────────────
export function renderGrid() {
  const images = state.images;
  imgCount().textContent = images.length;

  if (images.length === 0) {
    imagesSection().classList.add('hidden');
    return;
  }
  imagesSection().classList.remove('hidden');

  imgGrid().innerHTML = images.map(img => `
    <div class="img-thumb" data-id="${img.id}">
      <img src="${img.url}" alt="${escapeHtml(img.name)}" loading="lazy">
      <button class="thumb-remove" data-remove="${img.id}" title="Remove">×</button>
      <div class="thumb-badge">
        ${img.lat !== null
          ? `<span class="gps-tag">📍 GPS</span>`
          : `<button class="set-btn" data-manual="${img.id}">📍 Set</button>`}
      </div>
    </div>
  `).join('');

  // Delegate events
  imgGrid().querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeImage(btn.dataset.remove);
    });
  });
  imgGrid().querySelectorAll('[data-manual]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openManualModal(btn.dataset.manual);
    });
  });

  // Update play button
  const readyCount = images.filter(i => i.lat !== null).length;
  const btn = playBtn();
  btn.disabled = readyCount < 1;
  btn.textContent = readyCount > 0
    ? `Play ${readyCount} Photo${readyCount !== 1 ? 's' : ''} →`
    : 'Set locations to play';
}

function removeImage(id) {
  const img = state.images.find(i => i.id === id);
  if (img && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
  state.images = state.images.filter(i => i.id !== id);
  renderGrid();
}

// ── Manual Modal ──────────────────────────────────────────────────────────
function openManualModal(id) {
  manualTargetId = id;
  const img = state.images.find(i => i.id === id);
  manualImgName().textContent = img?.name ?? '';
  latInput().value = img?.lat ?? '';
  lngInput().value = img?.lng ?? '';
  manualOverlay().classList.add('open');
  latInput().focus();
}

function closeManualModal() {
  manualOverlay().classList.remove('open');
  manualTargetId = null;
}

function saveManualLocation() {
  const lat = parseFloat(latInput().value);
  const lng = parseFloat(lngInput().value);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    latInput().style.borderColor = '#ff5a5a';
    latInput().focus();
    return;
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    lngInput().style.borderColor = '#ff5a5a';
    lngInput().focus();
    return;
  }

  // Reset error state
  latInput().style.borderColor = '';
  lngInput().style.borderColor = '';

  const img = state.images.find(i => i.id === manualTargetId);
  if (img) { img.lat = lat; img.lng = lng; }

  closeManualModal();
  renderGrid();
}

// ── Helpers ───────────────────────────────────────────────────────────────
function showLoading(show, current = 0, total = 0) {
  document.getElementById('loading-overlay').classList.toggle('show', show);
  const progress = document.getElementById('loading-progress');
  const text = document.getElementById('loading-text');
  if (!show || total <= 1) {
    progress?.classList.add('hidden');
    if (text) text.textContent = show ? 'Reading photos\u2026' : 'Loading\u2026';
    return;
  }
  progress?.classList.remove('hidden');
  const pct = Math.round((current / total) * 100);
  document.getElementById('loading-bar-fill').style.width = pct + '%';
  document.getElementById('loading-counter').textContent = `${current} of ${total} photos`;
  if (text) text.textContent = 'Reading photos\u2026';
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
