/**
 * supabase.js
 * Supabase client singleton.
 * Configuration is loaded from environment variables.
 * See SETUP.md for full instructions.
 */

// ── CONFIGURATION — loaded from .env ──────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ── Client ─────────────────────────────────────────────────────────────────
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // prevents SIGNED_IN firing from URL hash on tab focus
  },
});

// Storage bucket name (create this in Supabase dashboard → Storage)
export const PHOTO_BUCKET = 'photos';

// Max players per multiplayer room
export const MAX_PLAYERS = 6;

// Check if config is set
export function isConfigured() {
  return SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.includes('supabase.co');
}
