/**
 * locationPicker.js
 * Interactive map modal for picking a location.
 * Opens a full Leaflet map — user clicks to set pin, confirms.
 */

import { getOrCreateMap, destroyMap } from './utils.js';

let pickerMap = null;
let pickerMarker = null;
let pickerResolve = null;
let currentLat = null;
let currentLng = null;

/**
 * Open the location picker modal.
 * @param {string} imageName - shown in modal subtitle
 * @param {number|null} initialLat - optional pre-set lat
 * @param {number|null} initialLng - optional pre-set lng
 * @returns {Promise<{lat, lng}|null>} resolved with coords or null if cancelled
 */
export function openLocationPicker(imageName, initialLat = null, initialLng = null) {
  return new Promise((resolve) => {
    pickerResolve = resolve;
    currentLat = initialLat;
    currentLng = initialLng;

    // Set image name
    document.getElementById('picker-image-name').textContent = imageName ?? 'Unnamed photo';

    // Open modal
    document.getElementById('map-picker-modal').classList.add('open');

    // Init map after modal is visible
    requestAnimationFrame(() => {
      pickerMap = getOrCreateMap('location-picker-map', {
        zoom: initialLat ? 8 : 2,
        center: initialLat ? [initialLat, initialLng] : [20, 0],
        leafletOpts: {},
      });

      pickerMap.on('click', onMapClick);

      // Place existing marker if coords present
      if (initialLat && initialLng) {
        placeMarker(L.latLng(initialLat, initialLng));
        updateCoordsDisplay();
      }

      setTimeout(() => pickerMap.invalidateSize(), 100);
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
    icon: L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.4);"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    })
  }).addTo(pickerMap);
}

function updateCoordsDisplay() {
  const el = document.getElementById('picker-coords');
  if (el && currentLat !== null) {
    el.innerHTML = `<strong>${currentLat.toFixed(5)}</strong>, <strong>${currentLng.toFixed(5)}</strong>`;
  }
}

export function initLocationPicker() {
  // Confirm button
  document.getElementById('picker-confirm-btn').addEventListener('click', () => {
    if (currentLat !== null && currentLng !== null) {
      closePicker({ lat: currentLat, lng: currentLng });
    }
  });

  // Cancel button
  document.getElementById('picker-cancel-btn').addEventListener('click', () => {
    closePicker(null);
  });

  // Close X
  document.getElementById('picker-close-btn').addEventListener('click', () => {
    closePicker(null);
  });

  // Close on overlay click
  document.getElementById('map-picker-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('map-picker-modal')) closePicker(null);
  });

  // Search box — geocoding via Nominatim (free)
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
  } catch {
    // Nominatim unavailable — silently fail
  }
}

function closePicker(result) {
  destroyMap('location-picker-map');
  pickerMap = null;
  pickerMarker = null;
  currentLat = null;
  currentLng = null;
  document.getElementById('map-picker-modal').classList.remove('open');
  document.getElementById('picker-confirm-btn').disabled = true;
  document.getElementById('picker-hint').classList.remove('hidden');
  document.getElementById('picker-coords').innerHTML = 'Click the map to pick a location';
  document.getElementById('picker-search').value = '';
  if (pickerResolve) { pickerResolve(result); pickerResolve = null; }
}
