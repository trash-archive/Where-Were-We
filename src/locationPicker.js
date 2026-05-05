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
      setTimeout(() => pickerMap.invalidateSize(), 200);
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
    el.textContent = `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
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

  document.getElementById('picker-use-location-btn').addEventListener('click', () => {
    const btn = document.getElementById('picker-use-location-btn');
    if (!navigator.geolocation) {
      btn.textContent = 'Not supported by browser';
      return;
    }
    btn.textContent = 'Locating…';
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        pickerMap.setView(latlng, 13, { animate: true });
        placeMarker(latlng);
        updateCoordsDisplay();
        document.getElementById('picker-confirm-btn').disabled = false;
        document.getElementById('picker-hint').classList.add('hidden');
        btn.textContent = 'Use my current location';
        btn.disabled = false;
      },
      () => {
        btn.textContent = 'Location denied';
        setTimeout(() => { btn.textContent = 'Use my current location'; btn.disabled = false; }, 2500);
      },
      { timeout: 8000 }
    );
  });

  const searchInput = document.getElementById('picker-search');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (!q) { clearDropdown(); return; }
    searchTimer = setTimeout(() => geocodeSearch(q), 400);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveFocus(-1); return; }
    if (e.key === 'Escape')    { clearDropdown(); return; }
    if (e.key === 'Enter')     { clearTimeout(searchTimer); geocodeSearch(searchInput.value.trim()); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-picker-search')) clearDropdown();
  });
}

const GEOCODE_HOST = 'photon.komoot.io';

async function geocodeSearch(query) {
  if (!query || query.length < 3) return;
  try {
    const url = new URL('https://photon.komoot.io/api/');
    if (url.hostname !== GEOCODE_HOST) return;
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');
    const res = await fetch(url.toString());
    const { features } = await res.json();
    showDropdown(features);
  } catch {}
}

let focusedIndex = -1;

function formatPhotonLabel(p) {
  const primary = [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street].filter(Boolean).join(', ');
  const locality = p.city || p.town || p.village || p.district || p.county || '';
  const region = [p.state, p.country].filter(Boolean).join(', ');
  return [primary, locality, region].filter(Boolean).join(' · ');
}

function showDropdown(features) {
  clearDropdown();
  if (!features.length) return;
  const wrap = document.querySelector('.map-picker-search');
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
    li.addEventListener('mousedown', (e) => { e.preventDefault(); selectResult(f); });
    li.addEventListener('touchend', (e) => { e.preventDefault(); selectResult(f); });
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  focusedIndex = -1;
}

function moveFocus(dir) {
  const items = document.querySelectorAll('.picker-search-item');
  if (!items.length) return;
  items[focusedIndex]?.classList.remove('focused');
  focusedIndex = Math.max(0, Math.min(items.length - 1, focusedIndex + dir));
  items[focusedIndex].classList.add('focused');
  items[focusedIndex].scrollIntoView({ block: 'nearest' });
}

function selectResult(f) {
  const [lon, lat] = f.geometry.coordinates;
  const latlng = L.latLng(lat, lon);
  pickerMap.setView(latlng, 13, { animate: true });
  currentLat = lat;
  currentLng = lon;
  placeMarker(latlng);
  updateCoordsDisplay();
  document.getElementById('picker-confirm-btn').disabled = false;
  document.getElementById('picker-hint').classList.add('hidden');
  const p = f.properties;
  document.getElementById('picker-search').value = formatPhotonLabel(p);
  clearDropdown();
}

function clearDropdown() {
  document.querySelector('.picker-search-dropdown')?.remove();
  focusedIndex = -1;
}

function closePicker(result) {
  // Don't destroy the map — keep it alive for next open (much faster)
  if (pickerMarker) { pickerMap.removeLayer(pickerMarker); pickerMarker = null; }
  currentLat = null;
  currentLng = null;
  document.getElementById('map-picker-modal').classList.remove('open');
  document.getElementById('picker-confirm-btn').disabled = true;
  document.getElementById('picker-hint').classList.remove('hidden');
  document.getElementById('picker-coords').textContent = 'Click the map to pick a location';
  document.getElementById('picker-search').value = '';
  clearDropdown();
  if (pickerResolve) { pickerResolve(result); pickerResolve = null; }
}
