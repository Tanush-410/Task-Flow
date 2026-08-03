'use client';

import { useActionState } from 'react';

import type { ActionResult } from '@/lib/result';
import { inviteMember } from '@/modules/members/actions';

type InviteResult = ActionResult<{
  invitationId: string;
  email: string;
  expiresAt: string;
}>;

async function submitInvite(
  _previousState: InviteResult | null,
  formData: FormData,
): Promise<InviteResult> {
  return inviteMember({
    email: formData.get('email'),
    role: formData.get('role'),
  });
}

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(submitInvite, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10 disabled:bg-slate-100"
          disabled={pending}
          name="email"
          placeholder="employee@company.com"
          required
          type="email"
        />
        <select
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10 disabled:bg-slate-100"
          defaultValue="employee"
          disabled={pending}
          name="role"
        >
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
        <button
          className="h-11 rounded-lg bg-slate-950 px-4 text-sm font-semibold whitespace-nowrap text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error.message}
        </p>
      ) : null}
      {state && state.ok ? (
        <p className="text-sm text-emerald-700">
          Invitation sent to {state.data.email}.
        </p>
      ) : null}
    </form>
  );
}
