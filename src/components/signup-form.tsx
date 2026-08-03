'use client';

import { useActionState, useState } from 'react';

import { signUp } from '@/modules/auth/actions';
import type { SignupOrganizationOption } from '@/modules/organizations/queries';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

      <Tabs onValueChange={(value) => setRole(value as Role)} value={role}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger disabled={pending} value="admin">
            Admin / Founder
          </TabsTrigger>
          <TabsTrigger
            disabled={pending || organizations.length === 0}
            value="employee"
          >
            Employee / Intern
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {role === 'employee' && organizations.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No organizations exist yet. Sign up as Admin first to create one, then
          employees can join it here.
        </p>
      ) : null}

      <div>
        <Label htmlFor="displayName">Full name</Label>
        <Input
          autoComplete="name"
          className="mt-2 h-11"
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
        <Input
          autoComplete="email"
          className="mt-2 h-11"
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
        <Input
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
        <FieldError>{error?.fields?.password?.[0]}</FieldError>
      </div>

      {role === 'admin' ? (
        <div>
          <Label htmlFor="organizationName">Organization name</Label>
          <Input
            autoComplete="organization"
            className="mt-2 h-11"
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
            defaultValue={organizations[0]?.id}
            disabled={pending || organizations.length === 0}
            name="organizationId"
            required
          >
            <SelectTrigger className="mt-2 h-11 w-full" id="organizationId">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
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
        size="lg"
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
