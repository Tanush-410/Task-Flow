'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';

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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state?.ok) {
      onCreated();
      onClose();
    }
    // Only react to a fresh successful submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const prefillHref = `/tasks/new?date=${encodeURIComponent(defaultDate.toISOString())}`;

  return (
    <div
      aria-labelledby="quick-create-heading"
      aria-modal="true"
      className="animate-overlay-in fixed inset-0 z-50 flex items-start justify-center bg-slate-950/30 px-4 pt-20 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (!dialogRef.current?.contains(event.target as Node)) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div
        className="animate-popover-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-popover"
        ref={dialogRef}
      >
        <form action={formAction} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <input
              className="w-full border-b border-transparent pb-1.5 text-lg font-semibold text-slate-950 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-accent"
              disabled={pending}
              id="quick-create-heading"
              maxLength={140}
              name="title"
              placeholder="Add title"
              ref={titleRef}
              required
              type="text"
            />
            <button
              aria-label="Close"
              className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <FieldError>{error?.fields?.title?.[0]}</FieldError>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs" htmlFor="dueAt">
                Date &amp; time
              </Label>
              <TextInput
                className="mt-1.5 py-2 text-sm"
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
              <Select
                className="mt-1.5 py-2 text-sm"
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
          </div>

          {employees.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              Invite an employee from the Employees page before creating a task.
            </p>
          ) : (
            <fieldset>
              <Label className="text-xs">Assign to</Label>
              <div className="mt-1.5 max-h-32 space-y-1.5 overflow-y-auto rounded-xl border border-slate-300 p-2.5">
                {employees.map((employee) => (
                  <label
                    className="flex items-center gap-2 text-sm text-slate-800"
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
            className="py-2 text-sm"
            disabled={pending}
            maxLength={10_000}
            name="description"
            placeholder="Add description"
            rows={2}
          />

          {error && !error.fields ? (
            <p className="text-sm text-red-700" role="alert">
              {error.message}
            </p>
          ) : null}

          <div className="flex items-center justify-between pt-1">
            <Link
              className="text-sm font-semibold text-accent-hover underline underline-offset-2"
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
          </div>
        </form>
      </div>
    </div>
  );
}
