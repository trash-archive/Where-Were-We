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
      status: 'waiting',
      rounds: settings.rounds ?? 5,
      photo_ids: settings.photoIds ?? [],
      players: [{ id: hostUserId, name: hostName, score: 0, ready: true, is_host: true, photo_ids: settings.photoIds ?? [] }],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Join an existing room by code.
 */
export async function joinRoom(code, userId, userName, photoIds = []) {
  const { data: room, error: fetchErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (fetchErr || !room) throw new Error('Room not found. Check the code and try again.');
  if (room.status !== 'waiting') throw new Error('This game has already started.');
  if (room.players.length >= MAX_PLAYERS) throw new Error(`Room is full (max ${MAX_PLAYERS} players).`);
  if (room.players.find(p => p.id === userId)) return room; // already in

  const updatedPlayers = [
    ...room.players,
    { id: userId, name: userName, score: 0, ready: false, is_host: false, photo_ids: photoIds },
  ];

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
export async function startRoom(roomId, roundCount, includeCommunity = false) {
  // Fetch the room to get all players and their photo_ids
  const { data: room, error: roomErr } = await supabase
    .from('rooms').select('players, include_community').eq('id', roomId).single();
  if (roomErr) throw roomErr;

  const includeCommunityFinal = room.include_community ?? includeCommunity;

  // Pool all players' photo IDs
  const allPhotoIds = (room.players ?? []).flatMap(p => p.photo_ids ?? []);

  // Fetch the full photo records (host can read their own; RLS allows this)
  let photos = [];
  if (allPhotoIds.length) {
    const { data, error: photoErr } = await supabase
      .from('photos')
      .select('id, public_url, lat, lng, original_name')
      .in('id', allPhotoIds);
    if (photoErr) throw photoErr;
    photos = data ?? [];
  }

  // Merge in community photos if requested
  if (includeCommunityFinal) {
    const myIdSet = new Set(photos.map(p => p.id));
    const { data: community } = await supabase
      .from('photos')
      .select('id, public_url, lat, lng, original_name')
      .eq('is_public', true)
      .not('lat', 'is', null)
      .limit(200);
    (community ?? []).filter(p => !myIdSet.has(p.id)).forEach(p => photos.push(p));
  }

  if (!photos.length) throw new Error('No photos with location data found in this room.');

  // Shuffle and cap at the selected round count
  const shuffled = [...photos].sort(() => Math.random() - 0.5).slice(0, roundCount);

  const { error } = await supabase
    .from('rooms')
    .update({ status: 'playing', photo_ids: shuffled.map(p => p.id), photos_data: shuffled, current_round: 0 })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * Submit a guess for a round.
 * Marks the player as having guessed this round.
 */
export async function submitRoomGuess(roomId, userId, round, guess, distKm, score) {
  const { data: room, error: fetchErr } = await supabase
    .from('rooms').select('players,guesses').eq('id', roomId).single();
  if (fetchErr) throw fetchErr;

  const guesses = room.guesses ?? [];
  // Remove any previous guess from this player for this round (re-submit guard)
  const filtered = guesses.filter(g => !(g.user_id === userId && g.round === round));
  filtered.push({ user_id: userId, round, lat: guess.lat, lng: guess.lng, dist_km: distKm, score });

  // Mark player as guessed this round
  const players = room.players.map(p =>
    p.id === userId
      ? { ...p, score: (p.score ?? 0) + score, guessed: true }
      : p
  );

  const { error } = await supabase.from('rooms').update({ guesses: filtered, players }).eq('id', roomId);
  if (error) throw error;
}

/**
 * Advance to next round — resets all players' guessed flag.
 */
export async function advanceRound(roomId, nextRound) {
  const { data: room } = await supabase.from('rooms').select('players').eq('id', roomId).single();
  const players = (room?.players ?? []).map(p => ({ ...p, guessed: false }));
  const { error } = await supabase
    .from('rooms')
    .update({ current_round: nextRound, players })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * Update room settings (host only).
 */
export async function updateRoomSettings(roomId, settings) {
  const { error } = await supabase.from('rooms').update(settings).eq('id', roomId);
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
 * If the host leaves, the room is deleted immediately — guests are notified via realtime DELETE event.
 * If a guest leaves, they are removed from the players list.
 */
export async function leaveRoom(roomId, userId) {
  const { data: room } = await supabase.from('rooms').select('players,host_id').eq('id', roomId).single();
  if (!room) return;

  // Host leaving always deletes the room
  if (room.host_id === userId) {
    await supabase.from('rooms').delete().eq('id', roomId);
    return;
  }

  // Guest leaving — remove from players list
  const players = room.players.filter(p => p.id !== userId);
  if (players.length === 0) {
    await supabase.from('rooms').delete().eq('id', roomId);
  } else {
    await supabase.from('rooms').update({ players }).eq('id', roomId);
  }
}

/**
 * Subscribe to real-time room changes.
 * Returns unsubscribe function.
 */
export function subscribeToRoom(roomId, callback) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      async () => {
        const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
        callback(data ?? null);
      })
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      () => callback(null))
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
