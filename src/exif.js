/**
 * exif.js
 * GPS extractor using exifr — handles JPEG, HEIC, PNG, WebP, TIFF,
 * SRATIONAL values, and files re-encoded by Google Drive / WhatsApp / etc.
 */

import * as exifr from 'exifr';

/**
 * Extract GPS coordinates from any image file.
 * @param {File} file
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function extractGPS(file) {
  // Try 1: fast path — dedicated GPS parser
  try {
    const gps = await exifr.gps(file);
    if (gps && isFinite(gps.latitude) && isFinite(gps.longitude)) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch {}

  // Try 2: full parse with all GPS tags enabled — catches more camera/phone formats
  try {
    const data = await exifr.parse(file, {
      gps: true,
      tiff: true,
      xmp: false,
      icc: false,
      iptc: false,
      translateValues: true,
      translateKeys: true,
      reviveValues: true,
    });
    if (data) {
      const lat = data.latitude ?? data.GPSLatitude;
      const lng = data.longitude ?? data.GPSLongitude;
      if (isFinite(lat) && isFinite(lng)) {
        return { lat, lng };
      }
    }
  } catch {}

  // Try 3: read file as ArrayBuffer and retry — fixes cases where File.type is wrong
  try {
    const buf = await file.arrayBuffer();
    const gps = await exifr.gps(buf);
    if (gps && isFinite(gps.latitude) && isFinite(gps.longitude)) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch {}

  return null;
}
