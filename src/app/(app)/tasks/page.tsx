import { ListChecks } from 'lucide-react';
import Link from 'next/link';

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

const STATUS_FILTERS = ['all', 'published', 'draft', 'archived'] as const;

function isOverdue(dueAt: string | null, status: string): boolean {
  return (
    Boolean(dueAt) && status !== 'archived' && new Date(dueAt!) < new Date()
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = STATUS_FILTERS.includes(
    status as (typeof STATUS_FILTERS)[number],
  )
    ? (status as (typeof STATUS_FILTERS)[number])
    : 'all';
  const { data: tasks } = await listOrganizationTasks();
  const filtered = (tasks ?? []).filter(
    (task) => activeFilter === 'all' || task.status === activeFilter,
  );

  return (
    <section aria-labelledby="tasks-heading" className="space-y-6">
      <PageHeader
        action={
          <Link
            className="flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/tasks/new"
          >
            Create Task
          </Link>
        }
        eyebrow="Organization"
        headingId="tasks-heading"
        title="All Tasks"
      />

      <div
        aria-label="Filter tasks by status"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {STATUS_FILTERS.map((value) => (
          <Link
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeFilter === value
                ? 'bg-accent text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
            href={value === 'all' ? '/tasks' : `/tasks?status=${value}`}
            key={value}
          >
            {value === 'all' ? 'All' : STATUS_LABELS[value]}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          description="Tasks matching this filter will show up here."
          icon={ListChecks}
          title="No tasks yet"
        />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {filtered.map((task) => {
            const overdue = isOverdue(task.due_at, task.status);

            return (
              <li key={task.id}>
                <Link
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
                  href={`/tasks/${task.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {task.title}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2">
                      <Badge variant="neutral">
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <Badge
                        variant={
                          task.status === 'archived' ? 'neutral' : 'accent'
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
                            ? 'font-semibold text-red-700'
                            : 'text-slate-600'
                        }
                      >
                        {overdue ? 'Overdue · ' : 'Due '}
                        {new Date(task.due_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-slate-400">No due date</span>
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
