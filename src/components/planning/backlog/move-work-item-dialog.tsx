'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActionError } from '@/lib/result';
import {
  fetchWorkItemMoveOptions,
  moveWorkItem,
  type MoveWorkItemOptions,
} from '@/modules/backlog/actions';
import type { WorkItemType } from '@/modules/backlog/schemas';

const TYPE_LABELS: Record<WorkItemType, string> = {
  epic: 'Epic',
  feature: 'Feature',
  user_story: 'User story',
  bug: 'Bug',
  task: 'Task',
};

export function MoveWorkItemDialog({
  taskId,
  type,
  title,
  currentTeamId,
  trigger,
}: {
  taskId: string;
  type: WorkItemType;
  title: string;
  currentTeamId: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [options, setOptions] = useState<MoveWorkItemOptions | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [includeDescendants, setIncludeDescendants] = useState(false);

  const selectedCandidate = options?.candidates.find(
    (candidate) => candidate.id === selectedCandidateId,
  );
  const isCrossTeam = Boolean(
    selectedCandidate && selectedCandidate.planningTeamId !== currentTeamId,
  );
  const hasDescendants = Boolean(options && options.descendantCount > 0);
  const requiresDescendantConfirmation = isCrossTeam && hasDescendants;

  function reset() {
    setOptions(null);
    setSelectedCandidateId(null);
    setIncludeDescendants(false);
    setError(null);
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      return;
    }

    setLoading(true);
    const result = await fetchWorkItemMoveOptions(taskId, type);
    setOptions(result);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!selectedCandidate) return;

    setPending(true);
    setError(null);

    const result = await moveWorkItem({
      taskId,
      newParentTaskId: type === 'epic' ? null : selectedCandidate.id,
      newPlanningTeamId: selectedCandidate.planningTeamId,
      includeDescendants: requiresDescendantConfirmation
        ? includeDescendants
        : false,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    reset();
    toast(`${TYPE_LABELS[type]} moved`);
    router.refresh();
  }

  const candidateLabel = type === 'epic' ? 'New team' : 'New parent';

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move “{title}”</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading options…</p>
        ) : options && options.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {type === 'epic'
              ? 'No other teams are available.'
              : 'No valid destinations are available.'}
          </p>
        ) : options ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="move-work-item-target">{candidateLabel}</Label>
              <Select
                disabled={pending}
                onValueChange={setSelectedCandidateId}
                value={selectedCandidateId ?? undefined}
              >
                <SelectTrigger
                  className="mt-2 w-full"
                  id="move-work-item-target"
                >
                  <SelectValue placeholder="Choose a destination" />
                </SelectTrigger>
                <SelectContent>
                  {options.candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {type === 'epic'
                        ? candidate.title
                        : `${candidate.title} (${candidate.planningTeamName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {requiresDescendantConfirmation ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
                <p className="text-amber-800 dark:text-amber-400">
                  This moves {title} to a different team. It has{' '}
                  {options.descendantCount} descendant
                  {options.descendantCount === 1 ? '' : 's'}, which will move
                  with it.
                </p>
                <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={includeDescendants}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      setIncludeDescendants(checked === true)
                    }
                  />
                  Move {options.descendantCount} descendant
                  {options.descendantCount === 1 ? '' : 's'} too
                </label>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive">{error.message}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => setOpen(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
              !selectedCandidate ||
              (requiresDescendantConfirmation && !includeDescendants)
            }
            onClick={handleSubmit}
            type="button"
          >
            {pending ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
