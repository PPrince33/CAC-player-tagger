import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co';
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: { params: { eventsPerSecond: 10 } },
});

/** Acquire exclusive tagger lock for a match. Returns true if acquired. */
export async function acquireMatchLock(matchId) {
  const { data, error } = await supabase.rpc('acquire_match_lock', { p_match_id: matchId });
  if (error) throw error;
  return data;
}

export async function refreshMatchLock(matchId) {
  await supabase.rpc('refresh_match_lock', { p_match_id: matchId });
}

export async function releaseMatchLock(matchId) {
  await supabase.rpc('release_match_lock', { p_match_id: matchId });
}
