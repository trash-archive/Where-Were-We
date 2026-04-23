/**
 * photos.js
 * Photo upload, storage, and retrieval via Supabase.
 * Accepts any image format — non-browser-renderable types (HEIC, TIFF, BMP, etc.)
 * are converted to JPEG before upload so they always display correctly.
 */

import { supabase, PHOTO_BUCKET } from './supabase.js';

const MAX_SIZE_MB = 20;

// MIME types browsers can natively render in <img> tags
const BROWSER_RENDERABLE = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/svg+xml', 'image/avif',
]);

export function validateFile(file) {
  // Only reject non-image files and oversized files
  if (file.type && !file.type.startsWith('image/')) {
    return `Not an image file: ${file.name}`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_SIZE_MB} MB.`;
  }
  return null;
}

export async function uploadPhoto(file, userId, lat = null, lng = null) {
  // 1. Extract GPS from original file before any conversion
  let finalLat = lat;
  let finalLng = lng;
  if (finalLat === null || finalLng === null) {
    const { extractGPS } = await import('./exif.js');
    const gps = await extractGPS(file);
    if (gps) { finalLat = gps.lat; finalLng = gps.lng; }
  }

  // 2. Convert to JPEG if browser can't render the format natively
  let uploadFile = file;
  let uploadExt = getExtension(file);
  let uploadMime = file.type || 'image/jpeg';

  const needsConversion = !BROWSER_RENDERABLE.has(uploadMime) || isHeicFile(file);
  if (needsConversion) {
    try {
      const { default: heic2any } = await import('heic2any');
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const converted = Array.isArray(blob) ? blob[0] : blob;
      const newName = file.name.replace(/\.[^.]+$/, '.jpg');
      uploadFile = new File([converted], newName, { type: 'image/jpeg' });
      uploadExt = 'jpg';
      uploadMime = 'image/jpeg';
    } catch {
      // Conversion failed — try canvas fallback for formats like BMP/TIFF
      try {
        const converted = await convertViaCanvas(file);
        if (converted) {
          uploadFile = converted;
          uploadExt = 'jpg';
          uploadMime = 'image/jpeg';
        }
      } catch {
        // Upload original as last resort
      }
    }
  }

  // 3. Build storage path
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${uploadExt}`;

  // 4. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(fileName, uploadFile, { contentType: uploadMime, upsert: false });
  if (uploadError) throw uploadError;

  // 5. Get public URL
  const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  // 6. Save metadata to DB
  const { data, error: dbError } = await supabase
    .from('photos')
    .insert({
      user_id: userId,
      storage_path: fileName,
      public_url: publicUrl,
      original_name: file.name,
      lat: finalLat,
      lng: finalLng,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(PHOTO_BUCKET).remove([fileName]);
    throw dbError;
  }

  return data;
}

export async function updatePhotoLocation(photoId, lat, lng) {
  const { error } = await supabase
    .from('photos').update({ lat, lng }).eq('id', photoId);
  if (error) throw error;
}

export async function getUserPhotos(userId) {
  const { data, error } = await supabase
    .from('photos').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deletePhoto(photoId, storagePath) {
  await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  const { error } = await supabase.from('photos').delete().eq('id', photoId);
  if (error) throw error;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isHeicFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif')
    || file.type === 'image/heic' || file.type === 'image/heif';
}

function getExtension(file) {
  const parts = file.name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : 'jpg';
}

function convertViaCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('canvas toBlob failed')); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
