import { TaskBoard } from '@/components/board/task-board';
import { PageHeader } from '@/components/ui/page-header';
import { ViewSwitcher } from '@/components/view-switcher';
import { listOrganizationAssignmentsBoard } from '@/modules/tasks/queries';

export default async function TasksBoardPage() {
  const assignments = await listOrganizationAssignmentsBoard();

  return (
    <section aria-labelledby="tasks-board-heading" className="space-y-6">
      <PageHeader
        eyebrow="Organization"
        headingId="tasks-board-heading"
        title="All Tasks"
      />

      <ViewSwitcher
        items={[
          { href: '/tasks', label: 'List' },
          { href: '/tasks/board', label: 'Board' },
          { href: '/calendar', label: 'Calendar' },
        ]}
      />

      <TaskBoard assignments={assignments} showAssignee />
    </section>
  );
}
