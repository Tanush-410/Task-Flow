import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabase } from '@/lib/supabase/server';
import {
  isInvitationPath,
  roleLandingPath,
  sanitizeNextPath,
} from '@/modules/auth/navigation';
import { getMembershipAccess } from '@/modules/members/queries';

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'));

  if (!code) {
    return redirectTo(request, '/login?error=callback');
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectTo(request, '/login?error=callback');
    }

    if (isInvitationPath(nextPath)) {
      return redirectTo(request, nextPath);
    }

    const access = await getMembershipAccess();

    if (access.kind === 'redirect') {
      const destination =
        access.location === '/login' ? '/login?error=session' : access.location;
      return redirectTo(request, destination);
    }

    return redirectTo(
      request,
      roleLandingPath(access.membership.role, nextPath),
    );
  } catch {
    return redirectTo(request, '/login?error=callback');
  }
}
