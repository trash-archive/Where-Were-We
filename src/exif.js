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
  try {
    const gps = await exifr.gps(file);
    if (gps && isFinite(gps.latitude) && isFinite(gps.longitude)) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
    return null;
  } catch {
    return null;
  }
}
