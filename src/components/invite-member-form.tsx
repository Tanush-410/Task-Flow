'use client';

import { useActionState } from 'react';

import type { ActionResult } from '@/lib/result';
import { inviteMember } from '@/modules/members/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        <Input
          className="h-11 flex-1"
          disabled={pending}
          name="email"
          placeholder="employee@company.com"
          required
          type="email"
        />
        <Select defaultValue="employee" disabled={pending} name="role">
          <SelectTrigger className="h-11 sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="whitespace-nowrap"
          disabled={pending}
          size="lg"
          type="submit"
        >
          {pending ? 'Sending…' : 'Send invite'}
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error.message}
        </p>
      ) : null}
      {state && state.ok ? (
        <p className="text-sm text-emerald-400">
          Invitation sent to {state.data.email}.
        </p>
      ) : null}
    </form>
  );
}
