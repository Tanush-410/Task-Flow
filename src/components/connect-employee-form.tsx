'use client';

import { useActionState } from 'react';

import type { ActionResult } from '@/lib/result';
import { requestConnection } from '@/modules/members/connection-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ConnectResult = ActionResult<{
  requestId: string;
  targetDisplayName: string;
}>;

async function submitConnect(
  _previousState: ConnectResult | null,
  formData: FormData,
): Promise<ConnectResult> {
  return requestConnection({
    code: formData.get('code'),
    role: formData.get('role'),
  });
}

export function ConnectEmployeeForm() {
  const [state, formAction, pending] = useActionState(submitConnect, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          className="h-11 flex-1 font-mono uppercase"
          disabled={pending}
          maxLength={6}
          name="code"
          placeholder="Connect code, e.g. 8F3K2Q"
          required
          style={{ textTransform: 'uppercase' }}
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
          {pending ? 'Sending…' : 'Send request'}
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error.message}
        </p>
      ) : null}
      {state && state.ok ? (
        <p className="text-sm text-emerald-400">
          Request sent to {state.data.targetDisplayName}. They need to accept it
          before they show up in your directory.
        </p>
      ) : null}
    </form>
  );
}
