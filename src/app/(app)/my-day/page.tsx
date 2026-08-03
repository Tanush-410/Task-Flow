import Link from 'next/link';

import { TaskAssignmentGroup } from '@/components/task-assignment-group';
import { PageHeader } from '@/components/ui/page-header';
import {
  listMyAssignmentsWithTasks,
  type MyAssignmentWithTask,
} from '@/modules/assignments/queries';
import { requireEmployee } from '@/modules/members/queries';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function MyDayPage() {
  await requireEmployee();
  const rows = await listMyAssignmentsWithTasks();
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const overdue: MyAssignmentWithTask[] = [];
  const dueTodayOrHighPriority: MyAssignmentWithTask[] = [];
  const recentlyAssigned: MyAssignmentWithTask[] = [];

  for (const row of rows) {
    if (row.assignment.status === 'completed') {
      continue;
    }

    const dueAt = row.task.due_at ? new Date(row.task.due_at) : null;

    if (dueAt && dueAt < now) {
      overdue.push(row);
    } else if (
      (dueAt && isSameDay(dueAt, now)) ||
      row.task.priority === 'high' ||
      row.task.priority === 'urgent'
    ) {
      dueTodayOrHighPriority.push(row);
    } else if (new Date(row.assignment.created_at) >= threeDaysAgo) {
      recentlyAssigned.push(row);
    }
  }

  const nothingUrgent =
    overdue.length === 0 &&
    dueTodayOrHighPriority.length === 0 &&
    recentlyAssigned.length === 0;

  return (
    <section aria-labelledby="my-day-heading" className="space-y-8">
      <PageHeader
        description="Overdue work comes first, followed by what's due today or high priority."
        eyebrow="Focus"
        headingId="my-day-heading"
        title="My Day"
      />

      {rows.length === 0 ? (
        <p className="text-base text-slate-600">
          You have no assignments yet. New tasks will show up here.
        </p>
      ) : (
        <>
          <TaskAssignmentGroup rows={overdue} title="Overdue" />
          <TaskAssignmentGroup
            rows={dueTodayOrHighPriority}
            title="Due today & high priority"
          />
          <TaskAssignmentGroup
            rows={recentlyAssigned}
            title="Recently assigned"
          />
          {nothingUrgent ? (
            <p className="text-base text-slate-600">
              Nothing urgent right now — see{' '}
              <Link
                className="text-accent-hover underline underline-offset-2"
                href="/my-tasks"
              >
                My Tasks
              </Link>{' '}
              for everything assigned to you.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
