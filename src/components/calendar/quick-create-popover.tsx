'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';

import type { ActionResult } from '@/lib/result';
import { toDateTimeLocalValue } from '@/lib/calendar-dates';
import type { OrganizationMember } from '@/modules/members/queries';
import { createAndAssignTask } from '@/modules/tasks/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
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

async function submitQuickTask(
  _previousState: ActionResult<{ taskId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const dueAtRaw = formData.get('dueAt');

  return createAndAssignTask({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    priority: formData.get('priority'),
    dueAt:
      typeof dueAtRaw === 'string' && dueAtRaw.length > 0
        ? new Date(dueAtRaw).toISOString()
        : null,
    acknowledgementRequired: false,
    assigneeIds: formData.getAll('assigneeIds'),
  });
}

export function QuickCreatePopover({
  defaultDate,
  employees,
  onClose,
  onCreated,
}: {
  defaultDate: Date;
  employees: OrganizationMember[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [state, formAction, pending] = useActionState(submitQuickTask, null);
  const error = state && !state.ok ? state.error : null;
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      onCreated();
      onClose();
    }
    // Only react to a fresh successful submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const prefillHref = `/tasks/new?date=${encodeURIComponent(defaultDate.toISOString())}`;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Create task</DialogTitle>
        <form action={formAction} className="space-y-4">
          <Input
            className="h-auto border-none bg-transparent px-0 text-lg font-semibold shadow-none placeholder:font-normal focus-visible:ring-0"
            disabled={pending}
            maxLength={140}
            name="title"
            placeholder="Add title"
            ref={titleRef}
            required
            type="text"
          />
          <FieldError>{error?.fields?.title?.[0]}</FieldError>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs" htmlFor="dueAt">
                Date &amp; time
              </Label>
              <Input
                className="mt-1.5"
                defaultValue={toDateTimeLocalValue(defaultDate)}
                disabled={pending}
                id="dueAt"
                name="dueAt"
                type="datetime-local"
              />
            </div>
            <div>
              <Label className="text-xs" htmlFor="priority">
                Priority
              </Label>
              <Select defaultValue="medium" disabled={pending} name="priority">
                <SelectTrigger className="mt-1.5 w-full" id="priority">
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
          </div>

          {employees.length === 0 ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
              Invite an employee from the Employees page before creating a task.
            </p>
          ) : (
            <fieldset>
              <Label className="text-xs">Assign to</Label>
              <div className="mt-1.5 max-h-32 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2.5">
                {employees.map((employee) => (
                  <label
                    className="flex items-center gap-2 text-sm text-foreground"
                    key={employee.userId}
                  >
                    <Checkbox name="assigneeIds" value={employee.userId} />
                    {employee.displayName}
                  </label>
                ))}
              </div>
              <FieldError>{error?.fields?.assigneeIds?.[0]}</FieldError>
            </fieldset>
          )}

          <Textarea
            disabled={pending}
            maxLength={10_000}
            name="description"
            placeholder="Add description"
            rows={2}
          />

          {error && !error.fields ? (
            <p className="text-sm text-red-400" role="alert">
              {error.message}
            </p>
          ) : null}

          <DialogFooter className="border-none bg-transparent p-0 sm:justify-between">
            <Link
              className="self-center text-sm font-semibold text-primary underline underline-offset-2"
              href={prefillHref}
            >
              More options
            </Link>
            <div className="flex gap-2">
              <Button onClick={onClose} type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={pending || employees.length === 0}
                type="submit"
              >
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
