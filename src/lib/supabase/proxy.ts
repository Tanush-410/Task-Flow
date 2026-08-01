import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { publicEnv } from '@/lib/env';

import type { Database } from './database.types';
import { synchronizeProxyCookies } from './proxy-cookies';

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();
  const client = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          response = synchronizeProxyCookies(
            values,
            (name, value) => request.cookies.set(name, value),
            () => NextResponse.next({ request }),
            (nextResponse, name, value, options) => {
              nextResponse.cookies.set(name, value, options);
            },
          );
        },
      },
    },
  );

  await client.auth.getClaims();

  return response;
}
