import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** False when env vars are missing — app should show setup instructions instead of throwing. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null =
  isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/** For code behind `isSupabaseConfigured` — narrows type for TypeScript. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  return supabase;
}
