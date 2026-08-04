import Link from 'next/link';

import { cn } from '@/lib/utils';
import { getPersonTag } from '@/lib/person-tag';
import type { CalendarTask } from '@/modules/tasks/queries';

export function EventChip({
  event,
  className,
  draggable = false,
}: {
  event: CalendarTask;
  className?: string;
  draggable?: boolean;
}) {
  const primary = event.assignees[0];
  const tag = primary
    ? getPersonTag(primary.userId, primary.displayName)
    : null;

  return (
    <Link
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80',
        draggable && 'cursor-grab active:cursor-grabbing',
        tag
          ? [tag.softBg, tag.softText, tag.softBorder]
          : 'border-border bg-muted text-muted-foreground',
        className,
      )}
      draggable={draggable}
      href={`/tasks/${event.task.id}`}
      onDragStart={
        draggable
          ? (dragEvent) => {
              dragEvent.dataTransfer.setData(
                'application/json',
                JSON.stringify({
                  taskId: event.task.id,
                  dueAt: event.task.due_at,
                }),
              );
              dragEvent.dataTransfer.effectAllowed = 'move';
            }
          : undefined
      }
      title={event.task.title}
    >
      {event.assignees.length > 0 ? (
        <span className="flex -space-x-1.5">
          {event.assignees.slice(0, 3).map((assignee) => {
            const assigneeTag = getPersonTag(
              assignee.userId,
              assignee.displayName,
            );
            return (
              <span
                className={cn(
                  'grid size-3.5 shrink-0 place-items-center rounded-full text-[7px] font-bold ring-1 ring-card',
                  assigneeTag.solidBg,
                  assigneeTag.solidText,
                )}
                key={assignee.userId}
              >
                {assigneeTag.initials[0]}
              </span>
            );
          })}
        </span>
      ) : null}
      <span className="truncate">{event.task.title}</span>
    </Link>
  );
}
