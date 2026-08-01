import { NextResponse, type NextRequest } from 'next/server';

import { shouldRefreshSession } from '@/lib/supabase/proxy-paths';
import { refreshSession } from '@/lib/supabase/proxy';

export function proxy(request: NextRequest) {
  if (!shouldRefreshSession(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return refreshSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|map|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$).*)',
  ],
};
