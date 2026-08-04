'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import type { ActionResult } from '@/lib/result';
import { toDateTimeLocalValue } from '@/lib/calendar-dates';
import type { OrganizationMember } from '@/modules/members/queries';
import { createAndAssignTask } from '@/modules/tasks/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';

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
        <Input
          className="mt-2"
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
          className="mt-2"
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
          <Select defaultValue="medium" disabled={pending} name="priority">
            <SelectTrigger className="mt-2 w-full" id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dueAt">Due date</Label>
          <Input
            className="mt-2"
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

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox disabled={pending} name="acknowledgementRequired" />
        Require assignees to acknowledge this task
      </label>

      {employees.length === 0 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Invite an employee from the Employees page before creating a task.
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            Assign to
          </legend>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
            {employees.map((employee) => (
              <label
                className="flex items-center gap-2 text-sm text-foreground"
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
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          <p>{error.message}</p>
          <p className="mt-1 text-xs text-red-400">
            Reference: {error.traceId}
          </p>
        </div>
      ) : null}

      <Button
        className="w-full disabled:cursor-not-allowed sm:w-auto"
        disabled={pending || employees.length === 0}
        size="lg"
        type="submit"
      >
        {pending ? 'Creating…' : 'Create & Assign'}
      </Button>
    </form>
  );
}
