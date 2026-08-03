'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import type { ActionResult } from '@/lib/result';
import type { OrganizationMember } from '@/modules/members/queries';
import { createAndAssignTask } from '@/modules/tasks/actions';

const fieldClassName =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-950 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100';
const labelClassName = 'text-sm font-medium text-slate-800';

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

export function TaskForm({ employees }: { employees: OrganizationMember[] }) {
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
        <label className={labelClassName} htmlFor="title">
          Title
        </label>
        <input
          className={fieldClassName}
          disabled={pending}
          id="title"
          maxLength={140}
          name="title"
          placeholder="Prepare weekly client report"
          required
          type="text"
        />
        {error?.fields?.title?.[0] ? (
          <p className="mt-1.5 text-sm text-red-700">{error.fields.title[0]}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClassName} htmlFor="description">
          Description
        </label>
        <textarea
          className={fieldClassName}
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
          <label className={labelClassName} htmlFor="priority">
            Priority
          </label>
          <select
            className={fieldClassName}
            defaultValue="medium"
            disabled={pending}
            id="priority"
            name="priority"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className={labelClassName} htmlFor="dueAt">
            Due date
          </label>
          <input
            className={fieldClassName}
            disabled={pending}
            id="dueAt"
            name="dueAt"
            type="datetime-local"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          className="size-4 rounded border-slate-300"
          disabled={pending}
          name="acknowledgementRequired"
          type="checkbox"
        />
        Require assignees to acknowledge this task
      </label>

      {employees.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Invite an employee from the Employees page before creating a task.
        </p>
      ) : (
        <fieldset>
          <legend className={labelClassName}>Assign to</legend>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-300 p-3">
            {employees.map((employee) => (
              <label
                className="flex items-center gap-2 text-sm text-slate-800"
                key={employee.userId}
              >
                <input
                  className="size-4 rounded border-slate-300"
                  disabled={pending}
                  name="assigneeIds"
                  type="checkbox"
                  value={employee.userId}
                />
                {employee.displayName}
              </label>
            ))}
          </div>
          {error?.fields?.assigneeIds?.[0] ? (
            <p className="mt-1.5 text-sm text-red-700">
              {error.fields.assigneeIds[0]}
            </p>
          ) : null}
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

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
        disabled={pending || employees.length === 0}
        type="submit"
      >
        {pending ? 'Creating…' : 'Create & Assign'}
      </button>
    </form>
  );
}
