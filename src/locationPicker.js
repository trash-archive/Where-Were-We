/**
 * locationPicker.js
 * Interactive map modal for picking a location.
 * Opens a full Leaflet map — user clicks to set pin, confirms.
 */

import { getOrCreateMap } from './utils.js';
import { makePinIcon } from './game.js';

let pickerMap = null;
let pickerMarker = null;
let pickerResolve = null;
let currentLat = null;
let currentLng = null;

export function openLocationPicker(imageName, initialLat = null, initialLng = null) {
  return new Promise((resolve) => {
    pickerResolve = resolve;
    currentLat = initialLat;
    currentLng = initialLng;

    document.getElementById('picker-image-name').textContent = imageName ?? 'Unnamed photo';
    document.getElementById('map-picker-modal').classList.add('open');

    requestAnimationFrame(() => {
      // Reuse existing map instance — only create once
      if (!pickerMap) {
        pickerMap = getOrCreateMap('location-picker-map', {
          zoom: initialLat ? 8 : 2,
          center: initialLat ? [initialLat, initialLng] : [20, 0],
        });
        pickerMap.on('click', onMapClick);
      } else {
        // Already exists — just reposition
        pickerMap.setView(
          initialLat ? [initialLat, initialLng] : [20, 0],
          initialLat ? 8 : 2,
          { animate: false }
        );
      }

      // Clear previous marker
      if (pickerMarker) { pickerMap.removeLayer(pickerMarker); pickerMarker = null; }

      if (initialLat && initialLng) {
        placeMarker(L.latLng(initialLat, initialLng));
        updateCoordsDisplay();
      }

      // Single invalidateSize call after layout settles
      setTimeout(() => pickerMap.invalidateSize(), 50);
    });
  });
}

function onMapClick(e) {
  currentLat = e.latlng.lat;
  currentLng = e.latlng.lng;
  placeMarker(e.latlng);
  updateCoordsDisplay();
  document.getElementById('picker-confirm-btn').disabled = false;
  document.getElementById('picker-hint').classList.add('hidden');
}

function placeMarker(latlng) {
  if (pickerMarker) pickerMap.removeLayer(pickerMarker);
  pickerMarker = L.marker(latlng, {
    icon: makePinIcon('#2563eb', '<circle cx="14" cy="10" r="4.5" fill="white" opacity="0.95"/>'),
  }).addTo(pickerMap);
}

function updateCoordsDisplay() {
  const el = document.getElementById('picker-coords');
  if (el && currentLat !== null) {
    el.innerHTML = `<strong>${currentLat.toFixed(5)}</strong>, <strong>${currentLng.toFixed(5)}</strong>`;
  }
}

export function initLocationPicker() {
  document.getElementById('picker-confirm-btn').addEventListener('click', () => {
    if (currentLat !== null && currentLng !== null) closePicker({ lat: currentLat, lng: currentLng });
  });
  document.getElementById('picker-cancel-btn').addEventListener('click', () => closePicker(null));
  document.getElementById('picker-close-btn').addEventListener('click', () => closePicker(null));
  document.getElementById('map-picker-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('map-picker-modal')) closePicker(null);
  });

  const searchInput = document.getElementById('picker-search');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => geocodeSearch(searchInput.value.trim()), 600);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(searchTimer); geocodeSearch(searchInput.value.trim()); }
  });
}

async function geocodeSearch(query) {
  if (!query || query.length < 3) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const results = await res.json();
    if (results.length > 0) {
      const { lat, lon } = results[0];
      const latlng = L.latLng(parseFloat(lat), parseFloat(lon));
      pickerMap.setView(latlng, 10, { animate: true });
      currentLat = latlng.lat;
      currentLng = latlng.lng;
      placeMarker(latlng);
      updateCoordsDisplay();
      document.getElementById('picker-confirm-btn').disabled = false;
      document.getElementById('picker-hint').classList.add('hidden');
    }
  } catch {}
}

function closePicker(result) {
  // Don't destroy the map — keep it alive for next open (much faster)
  if (pickerMarker) { pickerMap.removeLayer(pickerMarker); pickerMarker = null; }
  currentLat = null;
  currentLng = null;
  document.getElementById('map-picker-modal').classList.remove('open');
  document.getElementById('picker-confirm-btn').disabled = true;
  document.getElementById('picker-hint').classList.remove('hidden');
  document.getElementById('picker-coords').innerHTML = 'Click the map to pick a location';
  document.getElementById('picker-search').value = '';
  if (pickerResolve) { pickerResolve(result); pickerResolve = null; }
}
