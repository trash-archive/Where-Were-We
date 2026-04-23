/**
 * exif.js
 * GPS extractor using exifr — handles JPEG, HEIC, PNG, WebP, TIFF,
 * and files from all major phone/camera manufacturers.
 */

import exifr from 'exifr';

// Options shared across all parse attempts.
// firstChunkSize: 0 forces exifr to read the entire file — critical for
// large phone JPEGs where GPS data sits beyond the default 40 KB boundary.
const PARSE_OPTS = {
  gps: true,
  tiff: true,
  xmp: false,
  icc: false,
  iptc: false,
  translateValues: true,
  translateKeys: true,
  reviveValues: true,
  firstChunkSize: 0,   // read whole file — fixes GPS miss on large JPEGs
  chunkSize: 0,
};

/**
 * Convert a raw GPS coordinate array [deg, min, sec] to decimal degrees.
 * Returns null if the value is not a valid coordinate array or number.
 */
function toDecimal(val, ref) {
  if (typeof val === 'number' && isFinite(val)) return val;
  if (Array.isArray(val) && val.length === 3) {
    const dec = val[0] + val[1] / 60 + val[2] / 3600;
    if (!isFinite(dec)) return null;
    // South and West are negative
    if (ref === 'S' || ref === 'W') return -dec;
    return dec;
  }
  return null;
}

/**
 * Extract GPS coordinates from any image file.
 * @param {File} file
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function extractGPS(file) {
  // Try 1: exifr.parse with full-file read — most reliable path
  try {
    const data = await exifr.parse(file, PARSE_OPTS);
    if (data) {
      // exifr with translateValues:true returns decimal lat/lng directly
      let lat = data.latitude;
      let lng = data.longitude;

      // Fallback: raw GPS tags (some cameras skip translation)
      if (!isFinite(lat) || !isFinite(lng)) {
        lat = toDecimal(data.GPSLatitude, data.GPSLatitudeRef);
        lng = toDecimal(data.GPSLongitude, data.GPSLongitudeRef);
      }

      if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) {
        return { lat, lng };
      }
    }
  } catch {}

  // Try 2: read as ArrayBuffer — bypasses any File.type misdetection
  try {
    const buf = await file.arrayBuffer();
    const data = await exifr.parse(buf, PARSE_OPTS);
    if (data) {
      let lat = data.latitude;
      let lng = data.longitude;

      if (!isFinite(lat) || !isFinite(lng)) {
        lat = toDecimal(data.GPSLatitude, data.GPSLatitudeRef);
        lng = toDecimal(data.GPSLongitude, data.GPSLongitudeRef);
      }

      if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) {
        return { lat, lng };
      }
    }
  } catch {}

  return null;
}
