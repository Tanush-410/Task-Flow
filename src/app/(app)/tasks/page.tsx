import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import Link from 'next/link';

import { TaskList } from '@/components/task-list';
import { TaskSortSelect } from '@/components/task-sort-select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  listOrganizationTasksPage,
  TASKS_PAGE_SIZE,
} from '@/modules/tasks/queries';

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
const PRIORITY_FILTERS = ['all', 'urgent', 'high', 'medium', 'low'] as const;
const SORT_VALUES = ['due-asc', 'due-desc', 'priority', 'newest'] as const;

function buildFilterHref(params: {
  status: string;
  priority: string;
  sort: string;
  page?: number;
}): string {
  const query = new URLSearchParams();
  if (params.status !== 'all') query.set('status', params.status);
  if (params.priority !== 'all') query.set('priority', params.priority);
  if (params.sort !== 'due-asc') query.set('sort', params.sort);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const queryString = query.toString();
  return queryString ? `/tasks?${queryString}` : '/tasks';
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const { status, priority, sort, page } = await searchParams;
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
  const activePage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  const { tasks, totalCount } = await listOrganizationTasksPage({
    page: activePage,
    status: activeStatus,
    priority: activePriority,
    sort: activeSort,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / TASKS_PAGE_SIZE));

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

      {tasks.length === 0 ? (
        <EmptyState
          description="Tasks matching this filter will show up here."
          icon={ListChecks}
          title="No tasks yet"
        />
      ) : (
        <TaskList tasks={tasks} />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {activePage} of {totalPages} &middot; {totalCount} tasks
          </p>
          <div className="flex gap-2">
            <Button
              asChild
              disabled={activePage <= 1}
              size="sm"
              variant="outline"
            >
              <Link
                href={buildFilterHref({
                  status: activeStatus,
                  priority: activePriority,
                  sort: activeSort,
                  page: activePage - 1,
                })}
              >
                <ChevronLeft aria-hidden />
                Previous
              </Link>
            </Button>
            <Button
              asChild
              disabled={activePage >= totalPages}
              size="sm"
              variant="outline"
            >
              <Link
                href={buildFilterHref({
                  status: activeStatus,
                  priority: activePriority,
                  sort: activeSort,
                  page: activePage + 1,
                })}
              >
                Next
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
