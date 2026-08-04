'use client';

import { useActionState } from 'react';

import { requestPasswordReset } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    null,
  );
  const error = state && !state.ok ? state.error : null;
  const emailError = error?.fields?.email?.[0];

  if (state?.ok) {
    return (
      <p
        className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        role="status"
      >
        If an account exists for that email, a reset link is on its way. Check
        your inbox.
      </p>
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          aria-describedby={emailError ? 'email-error' : undefined}
          aria-invalid={Boolean(emailError)}
          autoComplete="email"
          className="mt-2 h-11"
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

      {error ? (
        <div
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          <p>{error.message}</p>
          <p className="mt-1 text-xs text-red-400">
            Reference: {error.traceId}
          </p>
        </div>
      ) : null}

      <Button
        className="w-full disabled:cursor-wait"
        disabled={pending}
        size="lg"
        type="submit"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
