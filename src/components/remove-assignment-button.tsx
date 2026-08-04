'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import type { ActionResult } from '@/lib/result';
import { removeAssignment } from '@/modules/assignments/actions';
import { Button } from '@/components/ui/button';

async function submitRemove(
  _previousState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return removeAssignment({ assignmentId: formData.get('assignmentId') });
}

export function RemoveAssignmentButton({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(submitRemove, null);
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!confirming) {
    return (
      <button
        className="text-xs font-semibold text-muted-foreground hover:text-red-400"
        onClick={() => setConfirming(true)}
        type="button"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <span className="text-xs text-muted-foreground">Remove from task?</span>
      <Button disabled={pending} size="sm" type="submit" variant="destructive">
        {pending ? 'Removing…' : 'Confirm'}
      </Button>
      <button
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        onClick={() => setConfirming(false)}
        type="button"
      >
        Cancel
      </button>
      {error ? <p className="text-xs text-red-400">{error.message}</p> : null}
    </form>
  );
}
