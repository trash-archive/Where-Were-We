/**
 * supabase.js
 * Supabase client singleton.
 */

// ── CONFIGURATION ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ghebsyimjlbboayvbnso.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoZWJzeWltamxiYm9heXZibnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODg4MDYsImV4cCI6MjA5MjQ2NDgwNn0.08LcoDxwPxxz7FJ-LWhBl-TiQsvJkliBzX-Wf-a_FY4';

// ── Client ─────────────────────────────────────────────────────────────────
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Storage bucket name (create this in Supabase dashboard → Storage)
export const PHOTO_BUCKET = 'photos';

// Max players per multiplayer room
export const MAX_PLAYERS = 6;

// Check if config is set
export function isConfigured() {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}
