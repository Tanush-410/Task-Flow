'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import type { ActionResult } from '@/lib/result';
import { toDateTimeLocalValue } from '@/lib/calendar-dates';
import type { OrganizationMember } from '@/modules/members/queries';
import { createAndAssignTask } from '@/modules/tasks/actions';
import { Button } from '@/components/ui/button';
import {
  Checkbox,
  FieldError,
  Label,
  Select,
  TextInput,
  Textarea,
} from '@/components/ui/field';

async function submitTask(
  _previousState: ActionResult<{ taskId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const dueAtRaw = formData.get('dueAt');
  const startAtRaw = formData.get('startAt');

  return createAndAssignTask({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    priority: formData.get('priority'),
    dueAt:
      typeof dueAtRaw === 'string' && dueAtRaw.length > 0
        ? new Date(dueAtRaw).toISOString()
        : null,
    startAt:
      typeof startAtRaw === 'string' && startAtRaw.length > 0
        ? new Date(startAtRaw).toISOString()
        : null,
    acknowledgementRequired: formData.get('acknowledgementRequired') === 'on',
    assigneeIds: formData.getAll('assigneeIds'),
  });
}

export function TaskForm({
  employees,
  defaultDueAt,
  defaultAssigneeId,
}: {
  employees: OrganizationMember[];
  defaultDueAt?: string;
  defaultAssigneeId?: string;
}) {
  const [state, formAction, pending] = useActionState(submitTask, null);
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      router.push(`/tasks/${state.data.taskId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <div>
        <Label htmlFor="title">Title</Label>
        <TextInput
          disabled={pending}
          id="title"
          maxLength={140}
          name="title"
          placeholder="Prepare weekly client report"
          required
          type="text"
        />
        <FieldError>{error?.fields?.title?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          disabled={pending}
          id="description"
          maxLength={10_000}
          name="description"
          placeholder="What needs to be done?"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            defaultValue="medium"
            disabled={pending}
            id="priority"
            name="priority"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="dueAt">Due date</Label>
          <TextInput
            defaultValue={
              defaultDueAt ? toDateTimeLocalValue(defaultDueAt) : undefined
            }
            disabled={pending}
            id="dueAt"
            name="dueAt"
            type="datetime-local"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-800">
        <Checkbox disabled={pending} name="acknowledgementRequired" />
        Require assignees to acknowledge this task
      </label>

      {employees.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Invite an employee from the Employees page before creating a task.
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">
            Assign to
          </legend>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-300 p-3">
            {employees.map((employee) => (
              <label
                className="flex items-center gap-2 text-sm text-slate-800"
                key={employee.userId}
              >
                <Checkbox
                  defaultChecked={employee.userId === defaultAssigneeId}
                  disabled={pending}
                  name="assigneeIds"
                  value={employee.userId}
                />
                {employee.displayName}
              </label>
            ))}
          </div>
          <FieldError>{error?.fields?.assigneeIds?.[0]}</FieldError>
        </fieldset>
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
        className="w-full disabled:cursor-not-allowed sm:w-auto"
        disabled={pending || employees.length === 0}
        type="submit"
      >
        {pending ? 'Creating…' : 'Create & Assign'}
      </Button>
    </form>
  );
}
