'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { ActionError } from '@/lib/result';
import { updateWorkItemPlanningFields } from '@/modules/backlog/actions';
import type { BacklogWorkItem } from '@/modules/backlog/queries';

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export function BugDetailsDialog({
  item,
  trigger,
}: {
  item: Pick<
    BacklogWorkItem,
    'id' | 'title' | 'reproSteps' | 'severity' | 'foundInBuild'
  >;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [reproSteps, setReproSteps] = useState(item.reproSteps ?? '');
  const [severity, setSeverity] = useState<string>(item.severity ?? 'medium');
  const [foundInBuild, setFoundInBuild] = useState(item.foundInBuild ?? '');

  function reset() {
    setReproSteps(item.reproSteps ?? '');
    setSeverity(item.severity ?? 'medium');
    setFoundInBuild(item.foundInBuild ?? '');
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await updateWorkItemPlanningFields({
      taskId: item.id,
      reproSteps: reproSteps === '' ? null : reproSteps,
      severity,
      foundInBuild: foundInBuild === '' ? null : foundInBuild,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    toast('Bug details updated');
    router.refresh();
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bug details</DialogTitle>
          <p className="text-sm text-muted-foreground">“{item.title}”</p>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="bug-details-repro-steps">Repro steps</Label>
            <Textarea
              className="mt-2"
              disabled={pending}
              id="bug-details-repro-steps"
              maxLength={10_000}
              onChange={(event) => setReproSteps(event.target.value)}
              rows={4}
              value={reproSteps}
            />
            <FieldError>{error?.fields?.reproSteps?.[0]}</FieldError>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="bug-details-severity">Severity</Label>
              <Select
                disabled={pending}
                onValueChange={setSeverity}
                value={severity}
              >
                <SelectTrigger
                  className="mt-2 w-full"
                  id="bug-details-severity"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{error?.fields?.severity?.[0]}</FieldError>
            </div>
            <div className="flex-1">
              <Label htmlFor="bug-details-found-in-build">Found in build</Label>
              <Input
                className="mt-2"
                disabled={pending}
                id="bug-details-found-in-build"
                maxLength={500}
                onChange={(event) => setFoundInBuild(event.target.value)}
                value={foundInBuild}
              />
              <FieldError>{error?.fields?.foundInBuild?.[0]}</FieldError>
            </div>
          </div>

          {error && !error.fields ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : null}

          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => {
                setOpen(false);
                reset();
              }}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
