'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import type { ActionResult } from '@/lib/result';
import { reopenAssignment } from '@/modules/assignments/actions';
import { Button } from '@/components/ui/button';

async function submitReopen(
  _previousState: ActionResult<{ assignmentId: string }> | null,
  formData: FormData,
) {
  return reopenAssignment({
    assignmentId: formData.get('assignmentId'),
    reason: formData.get('reason'),
  });
}

export function ReopenAssignmentForm({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitReopen, null);
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      // The parent list only renders this component for completed
      // assignments; a successful reopen changes the row's status, so the
      // refreshed server data unmounts this component on its own.
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        className="text-sm font-semibold text-accent-hover underline underline-offset-2"
        onClick={() => setOpen(true)}
        type="button"
      >
        Reopen
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <textarea
        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-950 outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
        name="reason"
        placeholder="Reason for reopening"
        required
        rows={2}
      />
      {error ? <p className="text-xs text-red-700">{error.message}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending} size="sm" type="submit">
          Confirm reopen
        </Button>
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
