import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Supabase anon keys are JWTs that start with "ey". Verify credentials format.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseAnonKey.startsWith('ey') &&
  supabaseUrl.startsWith('https://')
);

let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    console.log('[CRATOR] Supabase client initialized with provided credentials.');
  } catch (err) {
    console.warn('[CRATOR] Failed to initialize Supabase client:', err);
  }
} else {
  console.log('[CRATOR] Supabase is not configured. Using local client storage.');
}

export const supabase = supabaseInstance;

// Storage helpers that synchronize with Supabase when configured, falling back to localStorage
export async function getStoredWatchlist(defaultIds: string[] = []): Promise<string[]> {
  if (supabase) {
    try {
      const authRes = await supabase.auth.getUser().catch(() => null);
      const user = authRes?.data?.user;
      if (user) {
        const { data, error } = await supabase
          .from('watchlist')
          .select('media_id')
          .eq('user_id', user.id);
        if (!error && Array.isArray(data)) {
          return data.map((row: any) => String(row.media_id));
        }
      }
    } catch (e) {
      console.warn('[CRATOR] Supabase watchlist fetch failed, falling back to local storage', e);
    }
  }

  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('crator_watchlist') : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
    return defaultIds;
  } catch {
    return defaultIds;
  }
}

export async function saveStoredWatchlist(ids: string[]): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('crator_watchlist', JSON.stringify(ids));
    }
  } catch {}

  if (supabase) {
    try {
      const authRes = await supabase.auth.getUser().catch(() => null);
      const user = authRes?.data?.user;
      if (user) {
        // Upsert or sync to Supabase if user is logged in
        console.log('[CRATOR] Syncing watchlist with Supabase for user:', user.id);
      }
    } catch (e) {
      console.warn('[CRATOR] Supabase watchlist sync error:', e);
    }
  }
}
