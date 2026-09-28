import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Admin client for backend-only operations (service role).
// RLS is bypassed by this client: every authorization check must live in the
// route/service layer (requireAuth, requireAdmin, ownership checks).
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
