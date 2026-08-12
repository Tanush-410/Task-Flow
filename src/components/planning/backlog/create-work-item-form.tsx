'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import type { ActionError } from '@/lib/result';
import { createWorkItem } from '@/modules/backlog/actions';
import type { WorkItemType } from '@/modules/backlog/schemas';

const TYPE_LABELS: Record<WorkItemType, string> = {
  epic: 'Epic',
  feature: 'Feature',
  user_story: 'User story',
  task: 'Task',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export function CreateWorkItemForm({
  planningTeamId,
  type,
  parentTaskId,
  parentTitle,
  trigger,
}: {
  planningTeamId: string;
  type: WorkItemType;
  parentTaskId: string | null;
  parentTitle?: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [storyPoints, setStoryPoints] = useState('');
  const [originalHours, setOriginalHours] = useState('');
  const [remainingHours, setRemainingHours] = useState('');

  function reset() {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStoryPoints('');
    setOriginalHours('');
    setRemainingHours('');
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createWorkItem({
      planningTeamId,
      parentTaskId,
      type,
      title,
      description,
      priority,
      storyPoints:
        type === 'task' || storyPoints === '' ? undefined : Number(storyPoints),
      originalHours:
        type === 'task' && originalHours !== ''
          ? Number(originalHours)
          : undefined,
      remainingHours:
        type === 'task' && remainingHours !== ''
          ? Number(remainingHours)
          : undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    reset();
    toast(`${TYPE_LABELS[type]} created`);
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
          <DialogTitle>New {TYPE_LABELS[type].toLowerCase()}</DialogTitle>
          {parentTitle ? (
            <p className="text-sm text-muted-foreground">
              Under “{parentTitle}”
            </p>
          ) : null}
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="work-item-title">Title</Label>
            <Input
              className="mt-2"
              disabled={pending}
              id="work-item-title"
              maxLength={140}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
            <FieldError>{error?.fields?.title?.[0]}</FieldError>
          </div>

          <div>
            <Label htmlFor="work-item-description">Description</Label>
            <Textarea
              className="mt-2"
              disabled={pending}
              id="work-item-description"
              maxLength={10_000}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
            <FieldError>{error?.fields?.description?.[0]}</FieldError>
          </div>

          <div>
            <Label htmlFor="work-item-priority">Priority</Label>
            <Select
              disabled={pending}
              onValueChange={setPriority}
              value={priority}
            >
              <SelectTrigger className="mt-2 w-full" id="work-item-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'task' ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="work-item-original-hours">Original hours</Label>
                <Input
                  className="mt-2"
                  disabled={pending}
                  id="work-item-original-hours"
                  min={0}
                  onChange={(event) => setOriginalHours(event.target.value)}
                  step="0.5"
                  type="number"
                  value={originalHours}
                />
                <FieldError>{error?.fields?.originalHours?.[0]}</FieldError>
              </div>
              <div className="flex-1">
                <Label htmlFor="work-item-remaining-hours">
                  Remaining hours
                </Label>
                <Input
                  className="mt-2"
                  disabled={pending}
                  id="work-item-remaining-hours"
                  min={0}
                  onChange={(event) => setRemainingHours(event.target.value)}
                  step="0.5"
                  type="number"
                  value={remainingHours}
                />
                <FieldError>{error?.fields?.remainingHours?.[0]}</FieldError>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="work-item-story-points">Story points</Label>
              <Input
                className="mt-2"
                disabled={pending}
                id="work-item-story-points"
                min={0}
                onChange={(event) => setStoryPoints(event.target.value)}
                step="0.5"
                type="number"
                value={storyPoints}
              />
              <FieldError>{error?.fields?.storyPoints?.[0]}</FieldError>
            </div>
          )}

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
            <Button
              disabled={pending || title.trim().length === 0}
              type="submit"
            >
              {pending
                ? 'Creating…'
                : `Create ${TYPE_LABELS[type].toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
