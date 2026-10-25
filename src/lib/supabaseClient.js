import { createClient } from '@supabase/supabase-js';

// Read Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

/**
 * Checks whether valid Supabase configuration is present.
 * Prevents application crashes when environment variables are missing or placeholders.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseKey.includes('your-supabase-publishable-key')
);

if (!isSupabaseConfigured) {
  console.info(
    '[SpendSense] Supabase credentials not detected or using placeholders. ' +
    'To enable live Supabase Auth, provide VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.'
  );
}

/**
 * Supabase client instance.
 * When properly configured, connects with persistent session handling and auto-token refresh.
 * When not configured, set to null to allow graceful fallback UI without crashing.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    })
  : null;
