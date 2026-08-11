'use client';

import { useActionState, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActionResult } from '@/lib/result';
import { setPlanningTeamMembers } from '@/modules/planning-teams/actions';
import type { PlanningTeamCandidate } from '@/modules/planning-teams/queries';

type EditableCandidate = PlanningTeamCandidate & {
  selected: boolean;
  role: 'planner' | 'member';
  capacityHoursPerDay: number;
};

async function submitMembers(
  _previousState: ActionResult<{ teamId: string }> | null,
  formData: FormData,
) {
  const rawMembers = formData.get('members');
  let members: unknown = [];

  try {
    members = JSON.parse(typeof rawMembers === 'string' ? rawMembers : '[]');
  } catch {
    members = null;
  }

  return setPlanningTeamMembers({
    teamId: formData.get('teamId'),
    members,
  });
}

export function TeamMembersForm({
  teamId,
  candidates,
  currentUserId,
  canManage,
  canManageOwnRole,
}: {
  teamId: string;
  candidates: PlanningTeamCandidate[];
  currentUserId: string;
  canManage: boolean;
  canManageOwnRole: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitMembers, null);
  const [rows, setRows] = useState<EditableCandidate[]>(() =>
    candidates.map((candidate) => ({
      ...candidate,
      selected: candidate.planningRole !== null,
      role: candidate.planningRole ?? 'member',
      capacityHoursPerDay: candidate.defaultCapacityHoursPerDay ?? 8,
    })),
  );
  const error = state && !state.ok ? state.error : null;
  const submittedRows = rows
    .filter(
      (row) => row.selected && (canManage || row.userId === currentUserId),
    )
    .map((row) => ({
      userId: row.userId,
      role: row.role,
      capacityHoursPerDay: row.capacityHoursPerDay,
    }));

  function updateRow(userId: string, patch: Partial<EditableCandidate>) {
    setRows((current) =>
      current.map((row) =>
        row.userId === userId ? { ...row, ...patch } : row,
      ),
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <input name="teamId" type="hidden" value={teamId} />
      <input
        name="members"
        type="hidden"
        value={JSON.stringify(submittedRows)}
      />

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="hidden grid-cols-[minmax(0,1fr)_9rem_10rem] gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid">
          <span>Member</span>
          <span>Role</span>
          <span>Daily capacity</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const isCurrentUser = row.userId === currentUserId;
            const rowEditable = canManage || isCurrentUser;
            const ownRoleLocked =
              isCurrentUser && canManage && !canManageOwnRole;
            const roleId = `role-${row.userId}`;
            const capacityId = `capacity-${row.userId}`;

            return (
              <li
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_10rem] sm:items-center sm:gap-4"
                key={row.userId}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Checkbox
                    aria-label={`Include ${row.displayName}`}
                    checked={row.selected}
                    disabled={pending || !canManage || ownRoleLocked}
                    onCheckedChange={(checked) =>
                      updateRow(row.userId, { selected: checked === true })
                    }
                  />
                  <span className="truncate text-sm font-medium">
                    {row.displayName}
                    {isCurrentUser ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        You
                      </span>
                    ) : null}
                  </span>
                </div>

                <div>
                  <Label className="sr-only" htmlFor={roleId}>
                    Role for {row.displayName}
                  </Label>
                  <Select
                    disabled={
                      pending || !canManage || !row.selected || ownRoleLocked
                    }
                    onValueChange={(role: 'planner' | 'member') =>
                      updateRow(row.userId, { role })
                    }
                    value={row.role}
                  >
                    <SelectTrigger className="w-full" id={roleId}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planner">Planner</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="sr-only" htmlFor={capacityId}>
                    Daily capacity for {row.displayName}
                  </Label>
                  <Input
                    disabled={pending || !rowEditable || !row.selected}
                    id={capacityId}
                    max={24}
                    min={0}
                    onChange={(event) =>
                      updateRow(row.userId, {
                        capacityHoursPerDay: Number(event.target.value),
                      })
                    }
                    step={0.25}
                    type="number"
                    value={row.capacityHoursPerDay}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error.message}</AlertTitle>
          <AlertDescription>Reference: {error.traceId}</AlertDescription>
        </Alert>
      ) : null}

      <Button disabled={pending} type="submit">
        {pending ? 'Saving…' : canManage ? 'Save members' : 'Save capacity'}
      </Button>
    </form>
  );
}
