'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import type { ActionResult } from '@/lib/result';
import { toDateTimeLocalValue } from '@/lib/calendar-dates';
import { updateTask } from '@/modules/tasks/actions';
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

async function submitEdit(
  _previousState: ActionResult<{ taskId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const dueAtRaw = formData.get('dueAt');

  return updateTask({
    taskId: formData.get('taskId'),
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    priority: formData.get('priority'),
    dueAt:
      typeof dueAtRaw === 'string' && dueAtRaw.length > 0
        ? new Date(dueAtRaw).toISOString()
        : null,
    acknowledgementRequired: formData.get('acknowledgementRequired') === 'on',
    recurrence: formData.get('recurrence'),
  });
}

export function EditTaskForm({
  task,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    due_at: string | null;
    acknowledgement_required: boolean;
    recurrence: string;
  };
}) {
  const [state, formAction, pending] = useActionState(submitEdit, null);
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      router.push(`/tasks/${state.data.taskId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <input name="taskId" type="hidden" value={task.id} />

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          className="mt-2"
          defaultValue={task.title}
          disabled={pending}
          id="title"
          maxLength={140}
          name="title"
          required
          type="text"
        />
        <FieldError>{error?.fields?.title?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          className="mt-2"
          defaultValue={task.description ?? ''}
          disabled={pending}
          id="description"
          maxLength={10_000}
          name="description"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            defaultValue={task.priority}
            disabled={pending}
            name="priority"
          >
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
              task.due_at ? toDateTimeLocalValue(task.due_at) : undefined
            }
            disabled={pending}
            id="dueAt"
            name="dueAt"
            type="datetime-local"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="recurrence">Repeat</Label>
        <Select
          defaultValue={task.recurrence}
          disabled={pending}
          name="recurrence"
        >
          <SelectTrigger className="mt-2 w-full sm:w-[220px]" id="recurrence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Does not repeat</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox
          defaultChecked={task.acknowledgement_required}
          disabled={pending}
          name="acknowledgementRequired"
        />
        Require assignees to acknowledge this task
      </label>

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

      <div className="flex gap-2">
        <Button disabled={pending} size="lg" type="submit">
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          asChild
          disabled={pending}
          size="lg"
          type="button"
          variant="outline"
        >
          <Link href={`/tasks/${task.id}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
