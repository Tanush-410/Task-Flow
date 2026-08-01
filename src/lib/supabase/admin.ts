import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';

import type { Database } from './database.types';

export function createAdminSupabase() {
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
