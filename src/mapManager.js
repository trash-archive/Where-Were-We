/**
 * mapManager.js
 * Manages Leaflet map instances, preventing duplicate-init bugs.
 */

const TILES = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    opts: { maxZoom: 19 },
  },
  satellite: null, // handled by BingLayer
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    opts: { maxZoom: 17, subdomains: 'abc' },
  },
};

const BASE_TILE_OPTIONS = { keepBuffer: 4 };

// ── Bing Maps quadkey tile layer ──────────────────────────────────────────
const BingLayer = L.TileLayer.extend({
  getTileUrl(coords) {
    let quadkey = '';
    for (let i = coords.z; i > 0; i--) {
      let digit = 0;
      const mask = 1 << (i - 1);
      if (coords.x & mask) digit += 1;
      if (coords.y & mask) digit += 2;
      quadkey += digit;
    }
    const servers = ['t0','t1','t2','t3'];
    const s = servers[(coords.x + coords.y + coords.z) % servers.length];
    return `https://ecn.${s}.tiles.virtualearth.net/tiles/a${quadkey}.jpeg?g=1`;
  },
});

function addBingLayer(map) {
  return new BingLayer('', {
    ...BASE_TILE_OPTIONS,
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.microsoft.com/en-us/maps">Microsoft Bing Maps</a>',
  }).addTo(map);
}

const maps = {};
const activeLayers = {};
const activeTypes = {};

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
    tap: false,
    ...options.leafletOpts,
  });

  const type = options.tileType ?? 'street';
  activeLayers[elementId] = addTileLayer(map, type);
  activeTypes[elementId] = type;

  addTypeToggle(map, elementId);

  maps[elementId] = map;
  return map;
}

function addTileLayer(map, type) {
  if (type === 'satellite') return addBingLayer(map);
  const t = TILES[type];
  return L.tileLayer(t.url, { ...BASE_TILE_OPTIONS, ...t.opts, attribution: t.attr }).addTo(map);
}

function addTypeToggle(map, elementId) {
  const Control = L.Control.extend({
    onAdd() {
      const wrap = L.DomUtil.create('div', 'map-type-toggle');
      L.DomEvent.disableClickPropagation(wrap);
      ['street', 'satellite', 'terrain'].forEach(type => {
        const btn = L.DomUtil.create('button', 'mtt-btn', wrap);
        btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        btn.dataset.type = type;
        if (type === (activeTypes[elementId] ?? 'street')) btn.classList.add('active');
        L.DomEvent.on(btn, 'click', () => setMapType(elementId, type));
      });
      return wrap;
    },
  });
  new Control({ position: 'topright' }).addTo(map);
}

export function setMapType(elementId, type) {
  const map = maps[elementId];
  if (!map || !TILES[type] && type !== 'satellite') return;
  if (activeLayers[elementId]) map.removeLayer(activeLayers[elementId]);
  activeLayers[elementId] = addTileLayer(map, type);
  activeTypes[elementId] = type;
  map.invalidateSize();
  activeLayers[elementId].redraw();
  map.getContainer().querySelectorAll('.mtt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

export function destroyMap(elementId) {
  if (maps[elementId]) {
    try { maps[elementId].remove(); } catch {}
    delete maps[elementId];
    delete activeLayers[elementId];
    delete activeTypes[elementId];
  }
}

export function getMap(elementId) {
  return maps[elementId] ?? null;
}
