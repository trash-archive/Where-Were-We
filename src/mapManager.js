/**
 * mapManager.js
 * Manages Leaflet map instances, preventing duplicate-init bugs.
 */

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const TILE_OPTIONS = {
  maxZoom: 19,
  attribution: TILE_ATTR,
  updateWhenIdle: false,
  updateWhenZooming: false,
  keepBuffer: 4,
};

const maps = {};

export function getOrCreateMap(elementId, options = {}) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Map element #${elementId} not found`);

  if (maps[elementId]) {
    try { maps[elementId].remove(); } catch {}
    delete maps[elementId];
  }

  const map = L.map(el, {
    center: options.center ?? [20, 0],
    zoom: options.zoom ?? 2,
    zoomControl: options.zoomControl ?? true,
    attributionControl: false,
    preferCanvas: true,
    ...options.leafletOpts,
  });

  L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

  maps[elementId] = map;
  return map;
}

export function destroyMap(elementId) {
  if (maps[elementId]) {
    try { maps[elementId].remove(); } catch {}
    delete maps[elementId];
  }
}

export function getMap(elementId) {
  return maps[elementId] ?? null;
}
