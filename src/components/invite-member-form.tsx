'use client';

import { Check, Copy } from 'lucide-react';
import { useActionState, useState } from 'react';

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
  invitationUrl: string;
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

function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
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
          {pending ? 'Creating…' : 'Create invite link'}
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error.message}
        </p>
      ) : null}
      {state && state.ok ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-emerald-300">
            Invite link created for {state.data.email}. Share it yourself — it
            won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <Input
              className="h-9 flex-1 font-mono text-xs"
              readOnly
              value={state.data.invitationUrl}
            />
            <CopyInviteLink url={state.data.invitationUrl} />
          </div>
        </div>
      ) : null}
    </form>
  );
}
