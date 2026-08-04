import { ListChecks } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  getDashboardSummary,
  listOrganizationTasks,
} from '@/modules/tasks/queries';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Active',
  archived: 'Archived',
};

function MetricCard({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <Link href={href}>
      <Card className="p-5 transition-colors hover:border-border sm:p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p
          className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${
            tone === 'danger' && value > 0 ? 'text-red-400' : 'text-foreground'
          }`}
        >
          {value}
        </p>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const [summary, { data: tasks }] = await Promise.all([
    getDashboardSummary(),
    listOrganizationTasks(),
  ]);

  const recentTasks = (tasks ?? []).slice(0, 5);

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        headingId="dashboard-heading"
        title="Dashboard"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          href="/tasks"
          label="Active assignments"
          value={summary.activeAssignments}
        />
        <MetricCard
          href="/tasks?status=published"
          label="Overdue"
          tone="danger"
          value={summary.overdueCount}
        />
        <MetricCard
          href="/tasks?status=published"
          label="Delayed"
          value={summary.delayedCount}
        />
        <MetricCard
          href="/reports"
          label="Completed this month"
          value={summary.completedThisMonth}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent tasks</CardTitle>
            <Link
              className="text-sm font-semibold text-primary underline underline-offset-2"
              href="/tasks"
            >
              View all
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          {recentTasks.length === 0 ? (
            <EmptyState
              action={
                <Link
                  className="text-sm font-semibold text-primary underline underline-offset-2"
                  href="/tasks/new"
                >
                  Create your first task
                </Link>
              }
              description="Tasks you create will show up here."
              icon={ListChecks}
              title="No tasks yet"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    className="flex items-center justify-between gap-4 py-3 hover:bg-muted"
                    href={`/tasks/${task.id}`}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {task.title}
                    </span>
                    <Badge>{STATUS_LABELS[task.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
