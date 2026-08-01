import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

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
    <main className="grid min-h-screen place-items-center bg-[#f4f4f1] px-5 py-12">
      <section className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)] sm:px-9 sm:py-10">
        <p className="text-sm font-semibold text-slate-500">TaskFlow</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
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
            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              type="submit"
            >
              Accept invitation
            </button>
          </form>
        ) : (
          <Link
            className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href={`/login?next=${encodeURIComponent(invitationPath)}`}
          >
            Sign in to continue
          </Link>
        )}
      </section>
    </main>
  );
}
