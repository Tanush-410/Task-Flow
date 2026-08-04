import type { BoardAssignment } from '@/components/board/board-card';
import { TaskBoard } from '@/components/board/task-board';
import { PageHeader } from '@/components/ui/page-header';
import { ViewSwitcher } from '@/components/view-switcher';
import {
  listMyAssignmentsWithTasks,
  type MyAssignmentWithTask,
} from '@/modules/assignments/queries';
import { requireEmployee } from '@/modules/members/queries';

function toBoardAssignment(row: MyAssignmentWithTask): BoardAssignment {
  return {
    assignmentId: row.assignment.id,
    taskId: row.task.id,
    title: row.task.title,
    priority: row.task.priority,
    dueAt: row.task.due_at,
    status: row.assignment.status,
    assigneeId: row.assignment.assignee_id,
    assigneeName: '',
  };
}

export default async function MyTasksBoardPage() {
  await requireEmployee();
  const rows = await listMyAssignmentsWithTasks();
  const assignments = rows.map(toBoardAssignment);

  return (
    <section aria-labelledby="my-tasks-board-heading" className="space-y-6">
      <PageHeader
        eyebrow="Assigned to you"
        headingId="my-tasks-board-heading"
        title="My Tasks"
      />

      <ViewSwitcher
        items={[
          { href: '/my-tasks', label: 'List' },
          { href: '/my-tasks/board', label: 'Board' },
          { href: '/calendar', label: 'Calendar' },
        ]}
      />

      <TaskBoard assignments={assignments} />
    </section>
  );
}
