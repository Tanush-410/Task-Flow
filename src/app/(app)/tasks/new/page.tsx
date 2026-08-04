import { TaskForm } from '@/components/task-form';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { listAssignableMembers } from '@/modules/members/queries';
import { listTaskTemplates } from '@/modules/templates/queries';

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string }>;
}) {
  const [members, { date, assignee }, { data: templateRows }] =
    await Promise.all([
      listAssignableMembers(),
      searchParams,
      listTaskTemplates(),
    ]);
  const employees = members.filter(
    (member) => member.role === 'employee' && member.status === 'active',
  );
  const templates = (templateRows ?? []).map((template) => ({
    id: template.id,
    name: template.name,
    title: template.title,
    description: template.description,
    priority: template.priority,
    recurrence: template.recurrence,
    acknowledgementRequired: template.acknowledgement_required,
  }));

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
            templates={templates}
          />
        </CardContent>
      </Card>
    </section>
  );
}
