'use client';

import { useActionState, useState } from 'react';

import { signUp } from '@/modules/auth/actions';
import type { SignupOrganizationOption } from '@/modules/organizations/queries';
import { Button } from '@/components/ui/button';
import { FieldError, Label, Select, TextInput } from '@/components/ui/field';

type Role = 'admin' | 'employee';

export function SignupForm({
  organizations,
}: {
  organizations: SignupOrganizationOption[];
}) {
  const [state, formAction, pending] = useActionState(signUp, null);
  const [role, setRole] = useState<Role>(
    organizations.length === 0 ? 'admin' : 'employee',
  );
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <input name="role" type="hidden" value={role} />

      <div
        aria-label="Account type"
        className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1.5"
        role="radiogroup"
      >
        <button
          aria-checked={role === 'admin'}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            role === 'admin'
              ? 'bg-white text-accent-hover shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          disabled={pending}
          onClick={() => setRole('admin')}
          role="radio"
          type="button"
        >
          Admin / Founder
        </button>
        <button
          aria-checked={role === 'employee'}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            role === 'employee'
              ? 'bg-white text-accent-hover shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          } disabled:cursor-not-allowed disabled:text-slate-300`}
          disabled={pending || organizations.length === 0}
          onClick={() => setRole('employee')}
          role="radio"
          type="button"
        >
          Employee / Intern
        </button>
      </div>

      {role === 'employee' && organizations.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No organizations exist yet. Sign up as Admin first to create one, then
          employees can join it here.
        </p>
      ) : null}

      <div>
        <Label htmlFor="displayName">Full name</Label>
        <TextInput
          autoComplete="name"
          disabled={pending}
          id="displayName"
          maxLength={100}
          name="displayName"
          placeholder="Jordan Lee"
          required
          type="text"
        />
        <FieldError>{error?.fields?.displayName?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <TextInput
          autoComplete="email"
          disabled={pending}
          id="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
        <FieldError>{error?.fields?.email?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <TextInput
          autoComplete="new-password"
          disabled={pending}
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
        <FieldError>{error?.fields?.password?.[0]}</FieldError>
      </div>

      {role === 'admin' ? (
        <div>
          <Label htmlFor="organizationName">Organization name</Label>
          <TextInput
            autoComplete="organization"
            disabled={pending}
            id="organizationName"
            maxLength={120}
            name="organizationName"
            placeholder="Acme Inc."
            required
            type="text"
          />
          <FieldError>{error?.fields?.organizationName?.[0]}</FieldError>
        </div>
      ) : (
        <div>
          <Label htmlFor="organizationId">Organization</Label>
          <Select
            defaultValue={organizations[0]?.id ?? ''}
            disabled={pending || organizations.length === 0}
            id="organizationId"
            name="organizationId"
            required
          >
            <option disabled hidden value="">
              Select an organization
            </option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </Select>
          <FieldError>{error?.fields?.organizationId?.[0]}</FieldError>
        </div>
      )}

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
        disabled={
          pending || (role === 'employee' && organizations.length === 0)
        }
        type="submit"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Creating your account, please wait.' : ''}
      </span>
    </form>
  );
}
