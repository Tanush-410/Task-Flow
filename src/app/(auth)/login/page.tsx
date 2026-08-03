import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
import { sanitizeNextPath } from '@/modules/auth/navigation';

export const metadata: Metadata = {
  title: 'Sign in | TaskFlow',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = sanitizeNextPath(next ?? null) ?? undefined;

  return (
    <AuthCard headingId="login-heading">
      <div className="mb-8">
        <AuthLogo />
        <h1
          className="text-3xl font-semibold tracking-[-0.035em] text-slate-950"
          id="login-heading"
        >
          Welcome back
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">
          Sign in to continue to your workspace.
        </p>
      </div>

      {error ? (
        <p
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          We could not complete that sign-in request. Please try again.
        </p>
      ) : null}

      <LoginForm nextPath={nextPath} />

      <p className="mt-7 text-center text-sm text-slate-600">
        New to TaskFlow?{' '}
        <Link
          className="font-semibold text-primary underline underline-offset-2"
          href="/signup"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
