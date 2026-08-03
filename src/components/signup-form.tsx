'use client';

import { useActionState, useState } from 'react';

import { signUp } from '@/modules/auth/actions';
import type { SignupOrganizationOption } from '@/modules/organizations/queries';

const fieldClassName =
  'mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-950 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100';
const labelClassName = 'text-sm font-medium text-slate-800';

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
        className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1.5"
        role="radiogroup"
        aria-label="Account type"
      >
        <button
          aria-checked={role === 'admin'}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            role === 'admin'
              ? 'bg-white text-slate-950 shadow-sm'
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
              ? 'bg-white text-slate-950 shadow-sm'
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
        <label className={labelClassName} htmlFor="displayName">
          Full name
        </label>
        <input
          autoComplete="name"
          className={fieldClassName}
          disabled={pending}
          id="displayName"
          maxLength={100}
          name="displayName"
          placeholder="Jordan Lee"
          required
          type="text"
        />
        {error?.fields?.displayName?.[0] ? (
          <p className="mt-1.5 text-sm text-red-700">
            {error.fields.displayName[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label className={labelClassName} htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className={fieldClassName}
          disabled={pending}
          id="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
        {error?.fields?.email?.[0] ? (
          <p className="mt-1.5 text-sm text-red-700">{error.fields.email[0]}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClassName} htmlFor="password">
          Password
        </label>
        <input
          autoComplete="new-password"
          className={fieldClassName}
          disabled={pending}
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
        {error?.fields?.password?.[0] ? (
          <p className="mt-1.5 text-sm text-red-700">
            {error.fields.password[0]}
          </p>
        ) : null}
      </div>

      {role === 'admin' ? (
        <div>
          <label className={labelClassName} htmlFor="organizationName">
            Organization name
          </label>
          <input
            autoComplete="organization"
            className={fieldClassName}
            disabled={pending}
            id="organizationName"
            maxLength={120}
            name="organizationName"
            placeholder="Acme Inc."
            required
            type="text"
          />
          {error?.fields?.organizationName?.[0] ? (
            <p className="mt-1.5 text-sm text-red-700">
              {error.fields.organizationName[0]}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <label className={labelClassName} htmlFor="organizationId">
            Organization
          </label>
          <select
            className={fieldClassName}
            disabled={pending || organizations.length === 0}
            id="organizationId"
            name="organizationId"
            required
          >
            <option value="">Select an organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {error?.fields?.organizationId?.[0] ? (
            <p className="mt-1.5 text-sm text-red-700">
              {error.fields.organizationId[0]}
            </p>
          ) : null}
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

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 active:bg-slate-900 disabled:cursor-wait disabled:bg-slate-500"
        disabled={
          pending || (role === 'employee' && organizations.length === 0)
        }
        type="submit"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Creating your account, please wait.' : ''}
      </span>
    </form>
  );
}
