'use client';

import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';

import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export type BoardAssignment = {
  assignmentId: string;
  taskId: string;
  title: string;
  priority: string;
  dueAt: string | null;
  status: 'not_started' | 'in_progress' | 'delayed' | 'completed';
  assigneeId: string;
  assigneeName: string;
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive'
> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

/** Presentational card body — no drag hooks, so it's safe to render standalone inside DragOverlay. */
export function BoardCardContent({
  assignment,
  showAssignee,
  dragHandleProps,
  ...cardProps
}: {
  assignment: BoardAssignment;
  showAssignee?: boolean;
  dragHandleProps?: { attributes?: object; listeners?: object };
} & ComponentProps<typeof Card>) {
  const overdue =
    assignment.status !== 'completed' &&
    Boolean(assignment.dueAt) &&
    new Date(assignment.dueAt!) < new Date();

  return (
    <Card {...cardProps} className={`p-3 sm:p-3 ${cardProps.className ?? ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:text-primary"
          href={`/tasks/${assignment.taskId}`}
        >
          {assignment.title}
        </Link>
        <button
          aria-label="Drag to move"
          className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          type="button"
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={PRIORITY_VARIANT[assignment.priority]}>
          {PRIORITY_LABELS[assignment.priority] ?? assignment.priority}
        </Badge>
        {assignment.dueAt ? (
          <span
            className={`text-xs ${overdue ? 'font-semibold text-red-400' : 'text-muted-foreground'}`}
          >
            {overdue ? 'Overdue · ' : 'Due '}
            {new Date(assignment.dueAt).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {showAssignee ? (
        <div className="mt-2.5 flex items-center gap-1.5">
          <PersonAvatar
            displayName={assignment.assigneeName}
            size="sm"
            userId={assignment.assigneeId}
          />
          <span className="truncate text-xs text-muted-foreground">
            {assignment.assigneeName}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

/** Draggable card used inside a board column. */
export function BoardCard({
  assignment,
  showAssignee,
  pending,
}: {
  assignment: BoardAssignment;
  showAssignee?: boolean;
  pending?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.assignmentId,
  });

  return (
    <BoardCardContent
      assignment={assignment}
      className={`${isDragging ? 'opacity-40' : ''} ${pending ? 'pointer-events-none opacity-60' : ''}`}
      dragHandleProps={{ attributes, listeners }}
      ref={setNodeRef}
      showAssignee={showAssignee}
    />
  );
}
