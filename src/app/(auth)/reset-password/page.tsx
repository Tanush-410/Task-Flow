import type { Metadata } from 'next';
import Link from 'next/link';

import { createServerSupabase } from '@/lib/supabase/server';
import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/reset-password-form';

export const metadata: Metadata = {
  title: 'Set a new password | TaskFlow',
};

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const hasRecoverySession = Boolean(data?.claims) && !error;

  return (
    <AuthCard headingId="reset-password-heading">
      <div className="mb-8">
        <AuthLogo />
        <h1
          className="text-3xl font-semibold tracking-[-0.035em] text-foreground"
          id="reset-password-heading"
        >
          Set a new password
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>

      {hasRecoverySession ? (
        <ResetPasswordForm />
      ) : (
        <p
          className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
          role="alert"
        >
          This reset link is invalid or has expired.{' '}
          <Link
            className="font-semibold underline underline-offset-2"
            href="/forgot-password"
          >
            Request a new one
          </Link>
          .
        </p>
      )}
    </AuthCard>
  );
}
