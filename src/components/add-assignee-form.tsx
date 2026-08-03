'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import type { ActionResult } from '@/lib/result';
import type { OrganizationMember } from '@/modules/members/queries';
import { createAssignment } from '@/modules/assignments/actions';
import { Button } from '@/components/ui/button';
import { FieldError, Select } from '@/components/ui/field';

async function submitAddAssignee(
  _previousState: ActionResult<{ assignmentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ assignmentId: string }>> {
  return createAssignment({
    taskId: formData.get('taskId'),
    assigneeId: formData.get('assigneeId'),
  });
}

export function AddAssigneeForm({
  taskId,
  availableEmployees,
}: {
  taskId: string;
  availableEmployees: OrganizationMember[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitAddAssignee, null);
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      // availableEmployees drops the just-added person once the parent
      // re-fetches; staying open lets an admin add several people in a row.
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (availableEmployees.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" variant="secondary">
        Add assignee
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <input name="taskId" type="hidden" value={taskId} />
      <div>
        <Select
          className="h-9 py-1.5 text-sm"
          defaultValue=""
          disabled={pending}
          name="assigneeId"
          required
        >
          <option disabled value="">
            Select employee
          </option>
          {availableEmployees.map((employee) => (
            <option key={employee.userId} value={employee.userId}>
              {employee.displayName}
            </option>
          ))}
        </Select>
        <FieldError>{error?.fields?.assigneeId?.[0]}</FieldError>
      </div>
      <Button disabled={pending} size="sm" type="submit">
        {pending ? 'Adding…' : 'Add'}
      </Button>
      <Button
        onClick={() => setOpen(false)}
        size="sm"
        type="button"
        variant="ghost"
      >
        Cancel
      </Button>
      {error && !error.fields ? (
        <p className="w-full text-xs text-red-700">{error.message}</p>
      ) : null}
    </form>
  );
}
