/**
 * rooms.js
 * Multiplayer room management using Supabase Realtime + DB.
 * Max 6 players per room.
 */

import { supabase, MAX_PLAYERS } from './supabase.js';

// ── Room CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new room. Returns the room record.
 */
export async function createRoom(hostUserId, hostName, settings = {}) {
  const code = generateCode();

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code,
      host_id: hostUserId,
      status: 'waiting',       // waiting | playing | finished
      rounds: settings.rounds ?? 5,
      photo_ids: settings.photoIds ?? [],
      players: [{ id: hostUserId, name: hostName, score: 0, ready: true, is_host: true }],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Join an existing room by code.
 */
export async function joinRoom(code, userId, userName) {
  // Fetch room
  const { data: room, error: fetchErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (fetchErr || !room) throw new Error('Room not found. Check the code and try again.');
  if (room.status !== 'waiting') throw new Error('This game has already started.');
  if (room.players.length >= MAX_PLAYERS) throw new Error(`Room is full (max ${MAX_PLAYERS} players).`);
  if (room.players.find(p => p.id === userId)) return room; // already in

  const updatedPlayers = [...room.players, { id: userId, name: userName, score: 0, ready: false, is_host: false }];

  const { data, error } = await supabase
    .from('rooms')
    .update({ players: updatedPlayers })
    .eq('id', room.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Start the game (host only). Shuffles photo_ids order.
 */
export async function startRoom(roomId, photoIds) {
  // Fetch the full photo records so we can embed them in the room
  // This way guests don't need to query the photos table (which is RLS-protected)
  const { data: photos, error: photoErr } = await supabase
    .from('photos')
    .select('id, public_url, lat, lng, original_name')
    .in('id', photoIds);
  if (photoErr) throw photoErr;

  const shuffled = [...photos].sort(() => Math.random() - 0.5);
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'playing', photo_ids: photoIds, photos_data: shuffled, current_round: 0 })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * Submit a guess for a round.
 */
export async function submitRoomGuess(roomId, userId, round, guess, distKm, score) {
  const { data: room } = await supabase.from('rooms').select('players,guesses').eq('id', roomId).single();
  const guesses = room.guesses ?? [];
  guesses.push({ user_id: userId, round, lat: guess.lat, lng: guess.lng, dist_km: distKm, score });

  // Update player's cumulative score
  const players = room.players.map(p =>
    p.id === userId ? { ...p, score: (p.score ?? 0) + score } : p
  );

  const { error } = await supabase.from('rooms').update({ guesses, players }).eq('id', roomId);
  if (error) throw error;
}

/**
 * Advance to next round (host only).
 */
export async function advanceRound(roomId, nextRound) {
  const { error } = await supabase
    .from('rooms')
    .update({ current_round: nextRound })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * Mark room as finished.
 */
export async function finishRoom(roomId) {
  const { error } = await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
  if (error) throw error;
}

/**
 * Leave a room.
 */
export async function leaveRoom(roomId, userId) {
  const { data: room } = await supabase.from('rooms').select('players,host_id').eq('id', roomId).single();
  if (!room) return;

  const players = room.players.filter(p => p.id !== userId);

  if (players.length === 0) {
    // Delete empty room
    await supabase.from('rooms').delete().eq('id', roomId);
    return;
  }

  // Pass host to next player if host left
  let updates = { players };
  if (room.host_id === userId) {
    const newHost = players[0];
    newHost.is_host = true;
    updates.host_id = newHost.id;
  }

  await supabase.from('rooms').update(updates).eq('id', roomId);
}

/**
 * Subscribe to real-time room changes.
 * Returns unsubscribe function.
 */
export function subscribeToRoom(roomId, callback) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => callback(payload.new))
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Fetch a room by ID.
 */
export async function getRoom(roomId) {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (error) throw error;
  return data;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
