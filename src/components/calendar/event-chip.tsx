import Link from 'next/link';

import { cn } from '@/lib/cn';
import { getPersonTag } from '@/lib/person-tag';
import type { CalendarTask } from '@/modules/tasks/queries';

export function EventChip({
  event,
  className,
}: {
  event: CalendarTask;
  className?: string;
}) {
  const primary = event.assignees[0];
  const tag = primary
    ? getPersonTag(primary.userId, primary.displayName)
    : null;

  return (
    <Link
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80',
        tag
          ? [tag.softBg, tag.softText, tag.softBorder]
          : 'border-slate-200 bg-slate-50 text-slate-700',
        className,
      )}
      href={`/tasks/${event.task.id}`}
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
                  'grid size-3.5 shrink-0 place-items-center rounded-full text-[7px] font-bold ring-1 ring-white',
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
