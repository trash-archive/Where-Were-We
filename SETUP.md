# PhotoGeoGuess — Setup Guide

## What You Need
- A modern browser (Chrome, Firefox, Edge, Safari)
- **No build step required** — runs with a simple local server

---

## Option A: Quickest Start (VS Code + Live Server)

1. Install [VS Code](https://code.visualstudio.com/)
2. Install the **Live Server** extension (by Ritwick Dey)
3. Open the `photo-geoguess` folder in VS Code
4. Right-click `index.html` → **"Open with Live Server"**
5. Your browser opens automatically at `http://127.0.0.1:5500`

Done! ✅

---

## Option B: Node.js Local Server

1. Install [Node.js](https://nodejs.org) (v16+ recommended)
2. Open a terminal in the `photo-geoguess` folder
3. Run:

```bash
npx serve .
```

4. Open `http://localhost:3000` in your browser

---

## Option C: Python (built into most systems)

```bash
# Python 3
python3 -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

Then open `http://localhost:8080`

---

## ⚠️ Why You Need a Server

The game uses ES Modules (`import`/`export`), which browsers **block** when
opening `index.html` directly as a `file://` URL due to CORS security policy.
Any of the methods above (Live Server, `npx serve`, Python) fixes this.

---

## File Structure

```
photo-geoguess/
├── index.html          ← Open this in a server
└── src/
    ├── style.css       ← All styles
    ├── main.js         ← App entry, HTML rendering, button wiring
    ├── router.js       ← Screen switching
    ├── state.js        ← Shared game state
    ├── exif.js         ← GPS extraction from JPEG EXIF data
    ├── distance.js     ← Haversine + scoring formula
    ├── mapManager.js   ← Leaflet map lifecycle manager
    ├── uploadScreen.js ← Upload UI + manual location modal
    └── gameScreen.js   ← Game loop, round results, final screen
```

---

## How to Play

1. **Home** → click "Upload Photos & Play" or "Try Demo"
2. **Upload** → drop JPEG photos; photos with GPS auto-tag; manually pin others
3. **Game** → view the photo, click the map to place your guess, confirm
4. **Result** → see how far off you were and your score (0–5000 per round)
5. **Final** → total score, average distance, per-round breakdown

---

## Scoring Formula

| Distance | Score |
|----------|-------|
| < 1 km   | 5,000 |
| ~100 km  | ~4,760 |
| ~500 km  | ~3,890 |
| ~1,385 km | ~2,500 (half) |
| ~5,000 km | ~820 |
| ~10,000 km | ~67 |

Formula: `score = 5000 × e^(−distance_km / 2000)`

---

## Tips for Best Experience

- Use **photos taken on a smartphone** — they almost always embed GPS coordinates
- For photos without GPS, right-click any place in Google Maps → "What's here?" to get the latitude/longitude
- The game shuffles photos each time, so replaying gives a fresh experience

---

## No External Services Required

- Maps: [OpenStreetMap](https://openstreetmap.org) (free, no API key)
- Map library: [Leaflet.js](https://leafletjs.com) (loaded from CDN)
- Fonts: Google Fonts (loaded from CDN)
- **No backend, no database, no login**
