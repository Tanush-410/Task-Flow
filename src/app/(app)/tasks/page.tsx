import { ListChecks } from 'lucide-react';
import Link from 'next/link';

import { TaskSortSelect } from '@/components/task-sort-select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { listOrganizationTasks } from '@/modules/tasks/queries';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Active',
  archived: 'Archived',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_FILTERS = ['all', 'published', 'draft', 'archived'] as const;
const PRIORITY_FILTERS = ['all', 'urgent', 'high', 'medium', 'low'] as const;
const SORT_VALUES = ['due-asc', 'due-desc', 'priority', 'newest'] as const;

function isOverdue(dueAt: string | null, status: string): boolean {
  return (
    Boolean(dueAt) && status !== 'archived' && new Date(dueAt!) < new Date()
  );
}

function buildFilterHref(params: {
  status: string;
  priority: string;
  sort: string;
}): string {
  const query = new URLSearchParams();
  if (params.status !== 'all') query.set('status', params.status);
  if (params.priority !== 'all') query.set('priority', params.priority);
  if (params.sort !== 'due-asc') query.set('sort', params.sort);
  const queryString = query.toString();
  return queryString ? `/tasks?${queryString}` : '/tasks';
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; sort?: string }>;
}) {
  const { status, priority, sort } = await searchParams;
  const activeStatus = STATUS_FILTERS.includes(
    status as (typeof STATUS_FILTERS)[number],
  )
    ? (status as (typeof STATUS_FILTERS)[number])
    : 'all';
  const activePriority = PRIORITY_FILTERS.includes(
    priority as (typeof PRIORITY_FILTERS)[number],
  )
    ? (priority as (typeof PRIORITY_FILTERS)[number])
    : 'all';
  const activeSort = SORT_VALUES.includes(sort as (typeof SORT_VALUES)[number])
    ? (sort as (typeof SORT_VALUES)[number])
    : 'due-asc';

  const { data: tasks } = await listOrganizationTasks();
  const filtered = (tasks ?? []).filter(
    (task) =>
      (activeStatus === 'all' || task.status === activeStatus) &&
      (activePriority === 'all' || task.priority === activePriority),
  );

  const sorted = [...filtered].sort((a, b) => {
    if (activeSort === 'priority') {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    if (activeSort === 'newest') {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    const diff = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    return activeSort === 'due-desc' ? -diff : diff;
  });

  return (
    <section aria-labelledby="tasks-heading" className="space-y-6">
      <PageHeader
        action={
          <Link
            className="flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/tasks/new"
          >
            Create Task
          </Link>
        }
        eyebrow="Organization"
        headingId="tasks-heading"
        title="All Tasks"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          aria-label="Filter tasks by status"
          className="flex flex-wrap gap-2"
          role="group"
        >
          {STATUS_FILTERS.map((value) => (
            <Link
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeStatus === value
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/40'
              }`}
              href={buildFilterHref({
                status: value,
                priority: activePriority,
                sort: activeSort,
              })}
              key={value}
            >
              {value === 'all' ? 'All' : STATUS_LABELS[value]}
            </Link>
          ))}
        </div>
        <TaskSortSelect defaultValue={activeSort} />
      </div>

      <div
        aria-label="Filter tasks by priority"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {PRIORITY_FILTERS.map((value) => (
          <Link
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              activePriority === value
                ? 'border border-primary/40 bg-primary-soft text-primary'
                : 'border border-border text-muted-foreground hover:border-primary/40'
            }`}
            href={buildFilterHref({
              status: activeStatus,
              priority: value,
              sort: activeSort,
            })}
            key={value}
          >
            {value === 'all' ? 'All priorities' : PRIORITY_LABELS[value]}
          </Link>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          description="Tasks matching this filter will show up here."
          icon={ListChecks}
          title="No tasks yet"
        />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {sorted.map((task) => {
            const overdue = isOverdue(task.due_at, task.status);

            return (
              <li key={task.id}>
                <Link
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted"
                  href={`/tasks/${task.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {task.title}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2">
                      <Badge variant="secondary">
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <Badge
                        variant={
                          task.status === 'archived' ? 'secondary' : 'default'
                        }
                      >
                        {STATUS_LABELS[task.status]}
                      </Badge>
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
    </section>
  );
}
