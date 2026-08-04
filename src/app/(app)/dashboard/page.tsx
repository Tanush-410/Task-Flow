import {
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

import { StatTile } from '@/components/stat-tile';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getEmployeeCompletionReport } from '@/modules/reports/queries';
import {
  getDashboardSummary,
  listRecentOrganizationTasks,
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
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  href: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  tone?: 'default' | 'danger' | 'success';
}) {
  return (
    <Link
      className="block transition-transform hover:-translate-y-0.5"
      href={href}
    >
      <StatTile icon={icon} label={label} tone={tone} value={value} />
    </Link>
  );
}

export default async function DashboardPage() {
  const [summary, recentTasks, completionStats] = await Promise.all([
    getDashboardSummary(),
    listRecentOrganizationTasks(5),
    getEmployeeCompletionReport(),
  ]);

  const totalCompleted = completionStats.reduce(
    (sum, stat) => sum + stat.completedCount,
    0,
  );
  const totalOnTime = completionStats.reduce(
    (sum, stat) => sum + stat.onTimeCount,
    0,
  );
  const onTimePercentage =
    totalCompleted === 0
      ? null
      : Math.round((totalOnTime / totalCompleted) * 100);

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <PageHeader
        action={
          onTimePercentage === null ? null : (
            <Badge variant="success">{onTimePercentage}% on time</Badge>
          )
        }
        eyebrow="Overview"
        headingId="dashboard-heading"
        title="Dashboard"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          href="/tasks"
          icon={ListChecks}
          label="Active assignments"
          value={summary.activeAssignments}
        />
        <MetricCard
          href="/tasks?status=published"
          icon={AlertTriangle}
          label="Overdue"
          tone="danger"
          value={summary.overdueCount}
        />
        <MetricCard
          href="/tasks?status=published"
          icon={Hourglass}
          label="Delayed"
          value={summary.delayedCount}
        />
        <MetricCard
          href="/reports"
          icon={CheckCircle2}
          label="Completed this month"
          tone="success"
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
