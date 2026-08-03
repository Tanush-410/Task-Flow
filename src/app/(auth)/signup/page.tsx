import type { Metadata } from 'next';
import Link from 'next/link';

import { SignupForm } from '@/components/signup-form';
import { listOrganizationsForSignup } from '@/modules/organizations/queries';

export const metadata: Metadata = {
  title: 'Create account | TaskFlow',
};

export default async function SignupPage() {
  const organizations = await listOrganizationsForSignup();

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f4f1] px-5 py-12">
      <section
        aria-labelledby="signup-heading"
        className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)] sm:px-9 sm:py-10"
      >
        <div className="mb-8">
          <div className="mb-7 flex items-center gap-2.5 font-semibold tracking-[-0.02em] text-slate-950">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-slate-950 text-sm text-white"
            >
              T
            </span>
            TaskFlow
          </div>
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
            className="font-semibold text-slate-950 underline underline-offset-2"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
