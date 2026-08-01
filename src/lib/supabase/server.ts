import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { publicEnv } from '@/lib/env';

import { writeServerCookies } from './cookie-writes';
import type { Database } from './database.types';

export async function createServerSupabase() {
  const store = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          writeServerCookies(() => {
            values.forEach(({ name, value, options }) => {
              store.set(name, value, options);
            });
          });
        },
      },
    },
  );
}
