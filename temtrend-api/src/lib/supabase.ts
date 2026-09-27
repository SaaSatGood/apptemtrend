import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Client for authenticated user operations (uses anon key + JWT)
export function createSupabaseClient(accessToken?: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

// Admin client for backend-only operations (service role)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
