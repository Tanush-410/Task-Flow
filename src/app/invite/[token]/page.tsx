import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { createServerSupabase } from '@/lib/supabase/server';
import { isInvitationPath, roleLandingPath } from '@/modules/auth/navigation';
import { acceptInvitation } from '@/modules/members/actions';

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const invitationPath = `/invite/${token}`;

  if (!isInvitationPath(invitationPath)) {
    notFound();
  }

  const { error } = await searchParams;
  let userId: string | undefined;

  try {
    const supabase = await createServerSupabase();
    const claims = await supabase.auth.getClaims();
    if (!claims.error) userId = claims.data?.claims.sub;
  } catch {
    userId = undefined;
  }

  async function accept() {
    'use server';

    const result = await acceptInvitation({ token });
    if (!result.ok) {
      return redirect(`${invitationPath}?error=invalid`);
    }

    return redirect(roleLandingPath(result.data.role));
  }

  return (
    <AuthCard>
      <AuthLogo />
      <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">
        Organization invitation
      </h1>
      <p className="mt-3 text-[15px] leading-6 text-slate-600">
        Sign in with the verified email address that received this invitation,
        then accept it to join the organization.
      </p>

      {error ? (
        <p
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          This invitation could not be accepted. It may be invalid, expired,
          already used, or intended for another email address.
        </p>
      ) : null}

      {userId ? (
        <form action={accept} className="mt-7">
          <Button className="w-full" type="submit">
            Accept invitation
          </Button>
        </form>
      ) : (
        <Link
          className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href={`/login?next=${encodeURIComponent(invitationPath)}`}
        >
          Sign in to continue
        </Link>
      )}
    </AuthCard>
  );
}
