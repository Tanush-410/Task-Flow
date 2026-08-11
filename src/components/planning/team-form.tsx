'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ActionResult } from '@/lib/result';
import {
  createPlanningTeam,
  updatePlanningTeam,
} from '@/modules/planning-teams/actions';

type TeamResult = ActionResult<{ teamId: string }>;

function valuesFromForm(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    defaultSprintLengthDays: Number(formData.get('defaultSprintLengthDays')),
  };
}

async function submitCreate(
  _previousState: TeamResult | null,
  formData: FormData,
): Promise<TeamResult> {
  return createPlanningTeam(valuesFromForm(formData));
}

async function submitUpdate(
  _previousState: TeamResult | null,
  formData: FormData,
): Promise<TeamResult> {
  return updatePlanningTeam({
    teamId: formData.get('teamId'),
    ...valuesFromForm(formData),
  });
}

export function TeamForm({
  mode,
  initialTeam,
}: {
  mode: 'create' | 'edit';
  initialTeam?: {
    id: string;
    name: string;
    description: string;
    defaultSprintLengthDays: number;
  };
}) {
  const [state, formAction, pending] = useActionState(
    mode === 'create' ? submitCreate : submitUpdate,
    null,
  );
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (mode === 'create' && state?.ok) {
      router.push(`/planning/teams/${state.data.teamId}`);
    }
  }, [mode, router, state]);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      {initialTeam ? (
        <input name="teamId" type="hidden" value={initialTeam.id} />
      ) : null}

      <div>
        <Label htmlFor={`${mode}-team-name`}>Team name</Label>
        <Input
          className="mt-2"
          defaultValue={initialTeam?.name}
          disabled={pending}
          id={`${mode}-team-name`}
          maxLength={100}
          name="name"
          placeholder="Platform"
          required
        />
        <FieldError>{error?.fields?.name?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor={`${mode}-team-description`}>Description</Label>
        <Textarea
          className="mt-2"
          defaultValue={initialTeam?.description}
          disabled={pending}
          id={`${mode}-team-description`}
          maxLength={2_000}
          name="description"
          placeholder="What this team owns and delivers"
          rows={4}
        />
        <FieldError>{error?.fields?.description?.[0]}</FieldError>
      </div>

      <div className="max-w-48">
        <Label htmlFor={`${mode}-sprint-length`}>Sprint length</Label>
        <Input
          aria-describedby={`${mode}-sprint-length-help`}
          className="mt-2"
          defaultValue={initialTeam?.defaultSprintLengthDays ?? 14}
          disabled={pending}
          id={`${mode}-sprint-length`}
          max={42}
          min={1}
          name="defaultSprintLengthDays"
          required
          step={1}
          type="number"
        />
        <p
          className="mt-1.5 text-xs text-muted-foreground"
          id={`${mode}-sprint-length-help`}
        >
          Days per sprint (1–42)
        </p>
        <FieldError>{error?.fields?.defaultSprintLengthDays?.[0]}</FieldError>
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
            ? 'Create team'
            : 'Save changes'}
      </Button>
    </form>
  );
}
