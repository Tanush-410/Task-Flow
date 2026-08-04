import { notFound } from 'next/navigation';

import { EditTaskForm } from '@/components/edit-task-form';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireAdmin } from '@/modules/members/queries';
import { getTaskById } from '@/modules/tasks/queries';

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  await requireAdmin();
  const { taskId } = await params;
  const { data: task } = await getTaskById(taskId);

  if (!task) {
    notFound();
  }

  return (
    <section aria-labelledby="edit-task-heading" className="space-y-6">
      <PageHeader
        eyebrow="Edit"
        headingId="edit-task-heading"
        title="Edit Task"
      />

      <Card className="max-w-2xl">
        <CardContent>
          <EditTaskForm task={task} />
        </CardContent>
      </Card>
    </section>
  );
}
