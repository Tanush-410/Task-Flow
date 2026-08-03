'use client';

import { useActionState, useState } from 'react';

import { login } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { FieldError, Label, TextInput } from '@/components/ui/field';

type Portal = 'manager' | 'employee';

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(login, null);
  const [portal, setPortal] = useState<Portal>('manager');
  const error = state && !state.ok ? state.error : null;
  const emailError = error?.fields?.email?.[0];
  const passwordError = error?.fields?.password?.[0];

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      {nextPath ? <input name="next" type="hidden" value={nextPath} /> : null}

      <div
        aria-label="Sign in as"
        className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1.5"
        role="radiogroup"
      >
        <button
          aria-checked={portal === 'manager'}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            portal === 'manager'
              ? 'bg-white text-accent-hover shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          disabled={pending}
          onClick={() => setPortal('manager')}
          role="radio"
          type="button"
        >
          Admin / Manager
        </button>
        <button
          aria-checked={portal === 'employee'}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            portal === 'employee'
              ? 'bg-white text-accent-hover shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          disabled={pending}
          onClick={() => setPortal('employee')}
          role="radio"
          type="button"
        >
          Employee / Intern
        </button>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <TextInput
          aria-describedby={emailError ? 'email-error' : undefined}
          aria-invalid={Boolean(emailError)}
          autoComplete="email"
          disabled={pending}
          id="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
        {emailError ? (
          <FieldError id="email-error">{emailError}</FieldError>
        ) : null}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <TextInput
          aria-describedby={passwordError ? 'password-error' : undefined}
          aria-invalid={Boolean(passwordError)}
          autoComplete="current-password"
          disabled={pending}
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
        {passwordError ? (
          <FieldError id="password-error">{passwordError}</FieldError>
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

      <Button
        className="w-full disabled:cursor-wait"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Signing in, please wait.' : ''}
      </span>
    </form>
  );
}
