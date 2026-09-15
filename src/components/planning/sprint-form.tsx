'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionResult } from '@/lib/result';
import { createSprint, updateSprint } from '@/modules/sprints/actions';

type SprintResult = ActionResult<{ sprintId: string }>;

function valuesFromForm(formData: FormData) {
  return {
    name: formData.get('name'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
  };
}

async function submitCreate(
  _previousState: SprintResult | null,
  formData: FormData,
): Promise<SprintResult> {
  return createSprint({
    planningTeamId: formData.get('planningTeamId'),
    ...valuesFromForm(formData),
  });
}

async function submitUpdate(
  _previousState: SprintResult | null,
  formData: FormData,
): Promise<SprintResult> {
  return updateSprint({
    sprintId: formData.get('sprintId'),
    ...valuesFromForm(formData),
  });
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function SprintForm({
  mode,
  planningTeamId,
  defaultSprintLengthDays,
  initialSprint,
}: {
  mode: 'create' | 'edit';
  planningTeamId: string;
  defaultSprintLengthDays?: number;
  initialSprint?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    mode === 'create' ? submitCreate : submitUpdate,
    null,
  );
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (!state?.ok) return;
    if (mode === 'create') {
      router.push(
        `/planning/teams/${planningTeamId}/sprints/${state.data.sprintId}`,
      );
    } else {
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const today = new Date();
  const suggestedEnd = new Date(today);
  suggestedEnd.setDate(today.getDate() + (defaultSprintLengthDays ?? 14) - 1);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <input name="planningTeamId" type="hidden" value={planningTeamId} />
      {initialSprint ? (
        <input name="sprintId" type="hidden" value={initialSprint.id} />
      ) : null}

      <div>
        <Label htmlFor={`${mode}-sprint-name`}>Sprint name</Label>
        <Input
          className="mt-2"
          defaultValue={initialSprint?.name}
          disabled={pending}
          id={`${mode}-sprint-name`}
          maxLength={100}
          name="name"
          placeholder="Sprint 14"
          required
        />
        <FieldError>{error?.fields?.name?.[0]}</FieldError>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${mode}-sprint-start`}>Start date</Label>
          <Input
            className="mt-2"
            defaultValue={initialSprint?.startDate ?? toIsoDate(today)}
            disabled={pending}
            id={`${mode}-sprint-start`}
            name="startDate"
            required
            type="date"
          />
          <FieldError>{error?.fields?.startDate?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor={`${mode}-sprint-end`}>End date</Label>
          <Input
            className="mt-2"
            defaultValue={initialSprint?.endDate ?? toIsoDate(suggestedEnd)}
            disabled={pending}
            id={`${mode}-sprint-end`}
            name="endDate"
            required
            type="date"
          />
          <FieldError>{error?.fields?.endDate?.[0]}</FieldError>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error.message}</AlertTitle>
          <AlertDescription>Reference: {error.traceId}</AlertDescription>
        </Alert>
      ) : null}

      <Button disabled={pending} type="submit">
        {pending
          ? mode === 'create'
            ? 'Creating…'
            : 'Saving…'
          : mode === 'create'
            ? 'Create sprint'
            : 'Save changes'}
      </Button>
    </form>
  );
}
