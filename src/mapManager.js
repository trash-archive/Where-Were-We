/**
 * mapManager.js
 * Manages Leaflet map instances, preventing duplicate-init bugs.
 */

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '© OpenStreetMap contributors';

const maps = {}; // keyed by element id

/**
 * Create or recycle a Leaflet map inside `elementId`.
 * Returns the map instance.
 */
export function getOrCreateMap(elementId, options = {}) {
  // Destroy stale instance if element was re-rendered
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Map element #${elementId} not found`);

  if (maps[elementId]) {
    try {
      maps[elementId].remove();
    } catch {}
    delete maps[elementId];
  }

  const map = L.map(el, {
    center: options.center ?? [20, 0],
    zoom: options.zoom ?? 2,
    zoomControl: options.zoomControl ?? true,
    attributionControl: false,
    ...options.leafletOpts,
  });

  L.tileLayer(TILE_URL, { maxZoom: 18, attribution: TILE_ATTR }).addTo(map);

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
