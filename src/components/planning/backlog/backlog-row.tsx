'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { VariantProps } from 'class-variance-authority';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { CreateWorkItemForm } from '@/components/planning/backlog/create-work-item-form';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BacklogWorkItem } from '@/modules/backlog/queries';
import type { WorkItemType } from '@/modules/backlog/schemas';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export type EstimatePatch = {
  storyPoints?: number | null;
  originalHours?: number | null;
  remainingHours?: number | null;
};

const TYPE_LABELS: Record<WorkItemType, string> = {
  epic: 'Epic',
  feature: 'Feature',
  user_story: 'User story',
  task: 'Task',
};

const CHILD_TYPE_BY_PARENT: Record<WorkItemType, WorkItemType | null> = {
  epic: 'feature',
  feature: 'user_story',
  user_story: 'task',
  task: null,
};

const TYPE_VARIANT: Record<WorkItemType, BadgeVariant> = {
  epic: 'default',
  feature: 'secondary',
  user_story: 'outline',
  task: 'outline',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

function formatEstimate(item: BacklogWorkItem): string | null {
  if (item.storyPoints != null) return `${item.storyPoints} pts`;
  if (item.originalHours != null && item.remainingHours != null) {
    return `${item.remainingHours}h / ${item.originalHours}h`;
  }
  if (item.originalHours != null) return `${item.originalHours}h`;
  return null;
}

function EstimateEditor({
  item,
  onSave,
  onCancel,
}: {
  item: BacklogWorkItem;
  onSave: (patch: EstimatePatch) => void;
  onCancel: () => void;
}) {
  const [storyPoints, setStoryPoints] = useState(
    item.storyPoints?.toString() ?? '',
  );
  const [originalHours, setOriginalHours] = useState(
    item.originalHours?.toString() ?? '',
  );
  const [remainingHours, setRemainingHours] = useState(
    item.remainingHours?.toString() ?? '',
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (item.type === 'task') {
      onSave({
        originalHours: originalHours === '' ? null : Number(originalHours),
        remainingHours: remainingHours === '' ? null : Number(remainingHours),
      });
      return;
    }
    onSave({
      storyPoints: storyPoints === '' ? null : Number(storyPoints),
    });
  }

  return (
    <form
      className="flex shrink-0 items-center gap-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
      onSubmit={submit}
    >
      {item.type === 'task' ? (
        <>
          <Input
            aria-label="Remaining hours"
            className="h-7 w-16"
            min={0}
            onChange={(event) => setRemainingHours(event.target.value)}
            step="0.5"
            type="number"
            value={remainingHours}
          />
          <span className="text-xs text-muted-foreground">/</span>
          <Input
            aria-label="Original hours"
            className="h-7 w-16"
            min={0}
            onChange={(event) => setOriginalHours(event.target.value)}
            step="0.5"
            type="number"
            value={originalHours}
          />
        </>
      ) : (
        <Input
          aria-label="Story points"
          className="h-7 w-16"
          min={0}
          onChange={(event) => setStoryPoints(event.target.value)}
          step="0.5"
          type="number"
          value={storyPoints}
        />
      )}
      <Button
        aria-label="Save estimate"
        size="icon-xs"
        type="submit"
        variant="ghost"
      >
        <Check aria-hidden />
      </Button>
      <Button
        aria-label="Cancel"
        onClick={onCancel}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <X aria-hidden />
      </Button>
    </form>
  );
}

export function BacklogRow({
  item,
  depth,
  siblings,
  collapsedIds,
  onToggle,
  onMove,
  onEstimateSave,
  memberNameById,
  pendingIds,
  teamId,
}: {
  item: BacklogWorkItem;
  depth: number;
  siblings: BacklogWorkItem[];
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  onMove: (
    item: BacklogWorkItem,
    beforeTaskId: string | null,
    afterTaskId: string | null,
  ) => void;
  onEstimateSave: (item: BacklogWorkItem, patch: EstimatePatch) => void;
  memberNameById: Record<string, string>;
  pendingIds: Set<string>;
  teamId: string;
}) {
  const [editingEstimate, setEditingEstimate] = useState(false);
  const hasChildren = item.children.length > 0;
  const isOpen = !collapsedIds.has(item.id);
  const estimate = formatEstimate(item);
  const pending = pendingIds.has(item.id);
  const childType = CHILD_TYPE_BY_PARENT[item.type];

  const typedSiblings = siblings.filter(
    (sibling) => sibling.type === item.type,
  );
  const myIndex = typedSiblings.findIndex((sibling) => sibling.id === item.id);
  const canMoveUp = myIndex > 0;
  const canMoveDown = myIndex !== -1 && myIndex < typedSiblings.length - 1;

  function handleMove(direction: 'up' | 'down') {
    if (direction === 'up') {
      if (!canMoveUp) return;
      onMove(
        item,
        typedSiblings[myIndex - 2]?.id ?? null,
        typedSiblings[myIndex - 1]!.id,
      );
    } else {
      if (!canMoveDown) return;
      onMove(
        item,
        typedSiblings[myIndex + 1]!.id,
        typedSiblings[myIndex + 2]?.id ?? null,
      );
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: item.id,
    disabled: pending,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: item.id });

  return (
    <Collapsible onOpenChange={() => onToggle(item.id)} open={isOpen}>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 transition-colors',
          isOver && 'bg-primary-soft/40 ring-1 ring-inset ring-primary/40',
          isDragging && 'opacity-40',
          pending && 'pointer-events-none opacity-60',
        )}
        ref={setDropRef}
        style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger
            aria-label={
              isOpen ? `Collapse ${item.title}` : `Expand ${item.title}`
            }
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            type="button"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'size-4 transition-transform',
                isOpen && 'rotate-90',
              )}
            />
          </CollapsibleTrigger>
        ) : (
          <span aria-hidden className="size-4 shrink-0" />
        )}

        <Badge variant={TYPE_VARIANT[item.type]}>
          {TYPE_LABELS[item.type]}
        </Badge>

        <Link
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary"
          href={`/tasks/${item.id}`}
        >
          {item.title}
        </Link>

        <Badge variant={PRIORITY_VARIANT[item.priority] ?? 'secondary'}>
          {PRIORITY_LABELS[item.priority] ?? item.priority}
        </Badge>

        {editingEstimate ? (
          <EstimateEditor
            item={item}
            onCancel={() => setEditingEstimate(false)}
            onSave={(patch) => {
              setEditingEstimate(false);
              onEstimateSave(item, patch);
            }}
          />
        ) : (
          <button
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setEditingEstimate(true)}
            type="button"
          >
            {estimate ?? '+ Estimate'}
          </button>
        )}

        {item.assigneeIds.length > 0 ? (
          <div className="flex shrink-0 -space-x-1.5">
            {item.assigneeIds.slice(0, 3).map((userId) => (
              <PersonAvatar
                displayName={memberNameById[userId] ?? 'Unknown'}
                key={userId}
                size="sm"
                userId={userId}
              />
            ))}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          {childType ? (
            <CreateWorkItemForm
              parentTaskId={item.id}
              parentTitle={item.title}
              planningTeamId={teamId}
              trigger={
                <Button
                  aria-label={`Add ${TYPE_LABELS[childType].toLowerCase()} under ${item.title}`}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Plus aria-hidden />
                </Button>
              }
              type={childType}
            />
          ) : null}
          <Button
            aria-label={`Move ${item.title} up`}
            disabled={!canMoveUp}
            onClick={() => handleMove('up')}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            aria-label={`Move ${item.title} down`}
            disabled={!canMoveDown}
            onClick={() => handleMove('down')}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ChevronDown aria-hidden />
          </Button>
          <button
            aria-label="Drag to reorder"
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            ref={setDragRef}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      {hasChildren ? (
        <CollapsibleContent>
          <div className="divide-y divide-border border-t border-border">
            {item.children.map((child) => (
              <BacklogRow
                collapsedIds={collapsedIds}
                depth={depth + 1}
                item={child}
                key={child.id}
                memberNameById={memberNameById}
                onEstimateSave={onEstimateSave}
                onMove={onMove}
                onToggle={onToggle}
                pendingIds={pendingIds}
                siblings={item.children}
                teamId={teamId}
              />
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
