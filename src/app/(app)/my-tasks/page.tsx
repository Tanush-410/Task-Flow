import { CheckSquare2 } from 'lucide-react';

import { TaskAssignmentGroup } from '@/components/task-assignment-group';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { ViewSwitcher } from '@/components/view-switcher';
import {
  listMyAssignmentsWithTasks,
  type MyAssignmentWithTask,
} from '@/modules/assignments/queries';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function MyTasksPage() {
  const rows = await listMyAssignmentsWithTasks();
  const now = new Date();

  const overdue: MyAssignmentWithTask[] = [];
  const dueToday: MyAssignmentWithTask[] = [];
  const upcoming: MyAssignmentWithTask[] = [];
  const completed: MyAssignmentWithTask[] = [];

  for (const row of rows) {
    if (row.assignment.status === 'completed') {
      completed.push(row);
      continue;
    }

    const dueAt = row.task.due_at ? new Date(row.task.due_at) : null;

    if (dueAt && dueAt < now) {
      overdue.push(row);
    } else if (dueAt && isSameDay(dueAt, now)) {
      dueToday.push(row);
    } else {
      upcoming.push(row);
    }
  }

  return (
    <section aria-labelledby="my-tasks-heading" className="space-y-8">
      <PageHeader
        eyebrow="Assigned to you"
        headingId="my-tasks-heading"
        title="My Tasks"
      />

      <ViewSwitcher
        items={[
          { href: '/my-tasks', label: 'List', view: 'list' },
          { href: '/my-tasks/board', label: 'Board', view: 'board' },
          { href: '/calendar', label: 'Calendar' },
        ]}
        scope="my-tasks"
      />

      {rows.length === 0 ? (
        <EmptyState
          description="Work your admin assigns to you will show up here, grouped by how soon it's due."
          icon={CheckSquare2}
          title="No tasks assigned yet"
        />
      ) : (
        <>
          <TaskAssignmentGroup rows={overdue} title="Overdue" />
          <TaskAssignmentGroup rows={dueToday} title="Due today" />
          <TaskAssignmentGroup rows={upcoming} title="Upcoming" />
          <TaskAssignmentGroup rows={completed} title="Completed" />
        </>
      )}
    </section>
  );
}
