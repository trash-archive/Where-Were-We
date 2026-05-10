/**
 * auth.js
 * Supabase authentication helpers.
 */

import { supabase } from './supabase.js';

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data.user;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Check suspension before allowing access
  const { data: suspended } = await supabase.rpc('check_user_suspended', { p_user_id: data.user.id });
  if (suspended) {
    await supabase.auth.signOut().catch(() => {});
    throw new Error('Your account has been suspended. Please contact support.');
  }

  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null);
  });
}

export function getDisplayName(user) {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';
}

export function getInitials(user) {
  const name = getDisplayName(user);
  return name.slice(0, 2).toUpperCase();
}
