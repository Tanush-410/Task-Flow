'use client';

import { useActionState } from 'react';

import { login } from '@/modules/auth/actions';

const fieldClassName =
  'mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-950 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  const error = state && !state.ok ? state.error : null;
  const emailError = error?.fields?.email?.[0];
  const passwordError = error?.fields?.password?.[0];

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="email">
          Email
        </label>
        <input
          aria-describedby={emailError ? 'email-error' : undefined}
          aria-invalid={Boolean(emailError)}
          autoComplete="email"
          className={fieldClassName}
          disabled={pending}
          id="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
        {emailError ? (
          <p className="mt-1.5 text-sm text-red-700" id="email-error">
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor="password"
        >
          Password
        </label>
        <input
          aria-describedby={passwordError ? 'password-error' : undefined}
          aria-invalid={Boolean(passwordError)}
          autoComplete="current-password"
          className={fieldClassName}
          disabled={pending}
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
        {passwordError ? (
          <p className="mt-1.5 text-sm text-red-700" id="password-error">
            {passwordError}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          <p>{error.message}</p>
          <p className="mt-1 text-xs text-red-700">
            Reference: {error.traceId}
          </p>
        </div>
      ) : null}

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 active:bg-slate-900 disabled:cursor-wait disabled:bg-slate-500"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
