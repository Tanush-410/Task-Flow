import type { Metadata } from 'next';

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
    <main className="grid min-h-screen place-items-center bg-[#f4f4f1] px-5 py-12">
      <section
        aria-labelledby="login-heading"
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
      </section>
    </main>
  );
}
