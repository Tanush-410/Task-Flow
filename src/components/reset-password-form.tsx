'use client';

import { useActionState } from 'react';

import { resetPassword } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, null);
  const error = state && !state.ok ? state.error : null;
  const passwordError = error?.fields?.password?.[0];
  const confirmError = error?.fields?.confirmPassword?.[0];

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          aria-describedby={passwordError ? 'password-error' : undefined}
          aria-invalid={Boolean(passwordError)}
          autoComplete="new-password"
          className="mt-2 h-11"
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

      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          aria-describedby={confirmError ? 'confirm-error' : undefined}
          aria-invalid={Boolean(confirmError)}
          autoComplete="new-password"
          className="mt-2 h-11"
          disabled={pending}
          id="confirmPassword"
          maxLength={128}
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
        {confirmError ? (
          <FieldError id="confirm-error">{confirmError}</FieldError>
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
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
