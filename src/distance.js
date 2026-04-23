/**
 * distance.js
 * Haversine distance + score calculation.
 */

/**
 * Calculate great-circle distance in kilometres between two lat/lng points.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert km distance to a 0-5000 score.
 * Perfect (< 1 km) = 5000.  Uses exponential decay so nearby guesses still score well.
 */
export function distanceToScore(distKm) {
  if (distKm < 1) return 5000;
  // Exponential decay: half score at ~1385 km, zero-ish at 10,000 km
  return Math.max(0, Math.round(5000 * Math.exp(-distKm / 2000)));
}

/**
 * Format a distance for display.
 */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}
