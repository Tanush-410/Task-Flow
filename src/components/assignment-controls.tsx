'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import type { ActionResult } from '@/lib/result';
import {
  changeAssignmentStatus,
  updateAssignmentProgress,
} from '@/modules/assignments/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type AssignmentStatus = 'not_started' | 'in_progress' | 'delayed' | 'completed';

type AssignmentRow = {
  id: string;
  status: AssignmentStatus;
  progress: number;
  delayReason: string | null;
};

async function submitStatusChange(
  _previousState: ActionResult<{ assignmentId: string }> | null,
  formData: FormData,
) {
  const reason = formData.get('reason');

  return changeAssignmentStatus({
    assignmentId: formData.get('assignmentId'),
    status: formData.get('status'),
    reason:
      typeof reason === 'string' && reason.length > 0 ? reason : undefined,
  });
}

async function submitProgress(
  _previousState: ActionResult<{ assignmentId: string }> | null,
  formData: FormData,
) {
  return updateAssignmentProgress({
    assignmentId: formData.get('assignmentId'),
    progress: Number(formData.get('progress')),
  });
}

export function AssignmentControls({
  assignment,
}: {
  assignment: AssignmentRow;
}) {
  const router = useRouter();
  const [showDelayForm, setShowDelayForm] = useState(false);
  const [statusState, statusAction, statusPending] = useActionState(
    submitStatusChange,
    null,
  );
  const [progressState, progressAction, progressPending] = useActionState(
    submitProgress,
    null,
  );

  const pending = statusPending || progressPending;
  const error =
    (statusState && !statusState.ok && statusState.error) ||
    (progressState && !progressState.ok && progressState.error) ||
    null;

  useEffect(() => {
    if (statusState?.ok || progressState?.ok) {
      router.refresh();
    }
  }, [statusState, progressState, router]);

  const delayFormOpen = showDelayForm && assignment.status !== 'delayed';

  if (assignment.status === 'completed') {
    return (
      <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
        You marked this task complete.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {assignment.status === 'not_started' ? (
          <form action={statusAction}>
            <input name="assignmentId" type="hidden" value={assignment.id} />
            <input name="status" type="hidden" value="in_progress" />
            <Button disabled={pending} size="sm" type="submit">
              Start task
            </Button>
          </form>
        ) : null}

        {assignment.status === 'delayed' ? (
          <form action={statusAction}>
            <input name="assignmentId" type="hidden" value={assignment.id} />
            <input name="status" type="hidden" value="in_progress" />
            <Button disabled={pending} size="sm" type="submit">
              Resume task
            </Button>
          </form>
        ) : null}

        {assignment.status === 'in_progress' ? (
          <>
            {[25, 50, 75].map((value) => (
              <form action={progressAction} key={value}>
                <input
                  name="assignmentId"
                  type="hidden"
                  value={assignment.id}
                />
                <input name="progress" type="hidden" value={value} />
                <Button
                  aria-pressed={assignment.progress === value}
                  className={
                    assignment.progress === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : ''
                  }
                  disabled={pending}
                  size="sm"
                  type="submit"
                  variant="outline"
                >
                  {value}%
                </Button>
              </form>
            ))}
          </>
        ) : null}

        <form action={statusAction}>
          <input name="assignmentId" type="hidden" value={assignment.id} />
          <input name="status" type="hidden" value="completed" />
          <Button
            className="bg-emerald-700 hover:bg-emerald-800"
            disabled={pending}
            size="sm"
            type="submit"
          >
            Mark complete
          </Button>
        </form>

        {assignment.status !== 'delayed' ? (
          <Button
            disabled={pending}
            onClick={() => setShowDelayForm((value) => !value)}
            size="sm"
            type="button"
            variant="destructive"
          >
            Report delay
          </Button>
        ) : null}
      </div>

      {assignment.status === 'delayed' && assignment.delayReason ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Delay reason: {assignment.delayReason}
        </p>
      ) : null}

      {delayFormOpen ? (
        <form action={statusAction} className="space-y-2">
          <input name="assignmentId" type="hidden" value={assignment.id} />
          <input name="status" type="hidden" value="delayed" />
          <Label htmlFor="reason">Reason for delay</Label>
          <Textarea
            id="reason"
            maxLength={2_000}
            name="reason"
            required
            rows={3}
          />
          <Button disabled={pending} size="sm" type="submit">
            Submit delay
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
