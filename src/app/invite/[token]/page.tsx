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
  const errorMessage =
    error === 'last_admin'
      ? "You're the only admin of your current organization, so accepting would leave it with no one to manage it. Promote another admin there first, or ignore this invitation."
      : error
        ? 'This invitation could not be accepted. It may be invalid, expired, already used, or intended for another email address.'
        : null;
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
      const code =
        result.error.code === 'LAST_ADMIN_CANNOT_SWITCH'
          ? 'last_admin'
          : 'invalid';
      return redirect(`${invitationPath}?error=${code}`);
    }

    return redirect(roleLandingPath(result.data.role));
  }

  return (
    <AuthCard>
      <AuthLogo />
      <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground">
        Organization invitation
      </h1>
      <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
        Sign in with the verified email address that received this invitation,
        then accept it to join the organization.
      </p>

      {errorMessage ? (
        <p
          className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {errorMessage}
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
          className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href={`/login?next=${encodeURIComponent(invitationPath)}`}
        >
          Sign in to continue
        </Link>
      )}
    </AuthCard>
  );
}
