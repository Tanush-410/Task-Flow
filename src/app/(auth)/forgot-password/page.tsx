import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot password | TaskFlow',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard headingId="forgot-password-heading">
      <div className="mb-8">
        <AuthLogo />
        <h1
          className="text-3xl font-semibold tracking-[-0.035em] text-foreground"
          id="forgot-password-heading"
        >
          Reset your password
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          Enter the email on your account and we&apos;ll send you a link to set
          a new password.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="mt-7 text-center text-sm text-muted-foreground">
        <Link
          className="font-semibold text-primary underline underline-offset-2"
          href="/login"
        >
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
