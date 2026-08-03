import { TaskForm } from '@/components/task-form';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { listOrganizationMembers } from '@/modules/members/queries';

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string }>;
}) {
  const [members, { date, assignee }] = await Promise.all([
    listOrganizationMembers(),
    searchParams,
  ]);
  const employees = members.filter(
    (member) => member.role === 'employee' && member.status === 'active',
  );

  return (
    <section aria-labelledby="new-task-heading" className="space-y-6">
      <PageHeader
        description="Fill in the details and assign it to one or more employees. They are notified as soon as you submit."
        eyebrow="Create"
        headingId="new-task-heading"
        title="Create Task"
      />

      <Card className="max-w-2xl">
        <CardContent>
          <TaskForm
            defaultAssigneeId={assignee}
            defaultDueAt={date}
            employees={employees}
          />
        </CardContent>
      </Card>
    </section>
  );
}
