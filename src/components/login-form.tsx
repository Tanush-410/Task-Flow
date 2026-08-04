'use client';

import { useActionState, useState } from 'react';

import { login } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

      <Tabs
        onValueChange={(value) => setPortal(value as Portal)}
        value={portal}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger disabled={pending} value="manager">
            Admin / Manager
          </TabsTrigger>
          <TabsTrigger disabled={pending} value="employee">
            Employee / Intern
          </TabsTrigger>
        </TabsList>
      </Tabs>

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

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a
            className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </a>
        </div>
        <Input
          aria-describedby={passwordError ? 'password-error' : undefined}
          aria-invalid={Boolean(passwordError)}
          autoComplete="current-password"
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
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Signing in, please wait.' : ''}
      </span>
    </form>
  );
}
