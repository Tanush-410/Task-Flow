import Link from 'next/link';

import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireAdmin } from '@/modules/members/queries';
import { listCurrentWorkByEmployee } from '@/modules/reports/queries';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive'
> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

export default async function CurrentWorkPage() {
  await requireAdmin();
  const employees = await listCurrentWorkByEmployee();

  return (
    <section aria-labelledby="current-work-heading" className="space-y-6">
      <PageHeader
        description="What everyone is actively working on right now."
        eyebrow="Organization"
        headingId="current-work-heading"
        title="Current Work"
      />

      <div className="space-y-4">
        {employees.map((employee) => (
          <Card key={employee.userId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <PersonAvatar
                  displayName={employee.displayName}
                  userId={employee.userId}
                />
                {employee.displayName}
                <span className="text-sm font-normal text-muted-foreground">
                  {employee.tasks.length === 0
                    ? 'Nothing in progress'
                    : `${employee.tasks.length} in progress`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employee.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active tasks right now.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {employee.tasks.map((task) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      key={task.assignmentId}
                    >
                      <Link
                        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary"
                        href={`/tasks/${task.taskId}`}
                      >
                        {task.title}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <Badge variant={PRIORITY_VARIANT[task.priority]}>
                          {PRIORITY_LABELS[task.priority] ?? task.priority}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">
                          {task.progress}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {task.dueAt
                            ? `Due ${new Date(task.dueAt).toLocaleDateString()}`
                            : 'No due date'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
