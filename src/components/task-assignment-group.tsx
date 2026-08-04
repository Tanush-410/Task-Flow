import Link from 'next/link';

import type { MyAssignmentWithTask } from '@/modules/assignments/queries';
import { Badge } from '@/components/ui/badge';

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  delayed: 'Delayed',
  completed: 'Completed',
};

const STATUS_BADGE_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive' | 'success'
> = {
  not_started: 'secondary',
  in_progress: 'default',
  delayed: 'destructive',
  completed: 'success',
};

export function TaskAssignmentGroup({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: MyAssignmentWithTask[];
  emptyMessage?: string;
}) {
  if (rows.length === 0 && !emptyMessage) {
    return null;
  }

  return (
    <div>
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map(({ assignment, task }) => {
            const overdue =
              assignment.status !== 'completed' &&
              Boolean(task.due_at) &&
              new Date(task.due_at!) < new Date();

            return (
              <li key={assignment.id}>
                <Link
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted"
                  href={`/tasks/${task.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {task.title}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={STATUS_BADGE_VARIANT[assignment.status]}>
                        {STATUS_LABELS[assignment.status]}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {assignment.progress}%
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    {task.due_at ? (
                      <span
                        className={
                          overdue
                            ? 'font-semibold text-red-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {overdue ? 'Overdue · ' : 'Due '}
                        {new Date(task.due_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No due date</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
