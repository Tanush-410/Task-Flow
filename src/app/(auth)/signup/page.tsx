import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { SignupForm } from '@/components/signup-form';
import { listOrganizationsForSignup } from '@/modules/organizations/queries';

export const metadata: Metadata = {
  title: 'Create account | TaskFlow',
};

export default async function SignupPage() {
  const organizations = await listOrganizationsForSignup();

  return (
    <AuthCard headingId="signup-heading">
      <div className="mb-8">
        <AuthLogo />
        <h1
          className="text-3xl font-semibold tracking-[-0.035em] text-slate-950"
          id="signup-heading"
        >
          Create your account
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">
          Sign up as an Admin to start a new workspace, or as an Employee to
          join one that already exists.
        </p>
      </div>

      <SignupForm organizations={organizations} />

      <p className="mt-7 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          className="font-semibold text-primary underline underline-offset-2"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
