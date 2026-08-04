import { CalendarX, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PersonAvatar } from '@/components/person-avatar';
import { StatTile } from '@/components/stat-tile';
import { TaskBreakdownChart } from '@/components/task-breakdown-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/modules/members/queries';
import { getEmployeeTaskBreakdown } from '@/modules/reports/queries';

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const breakdown = await getEmployeeTaskBreakdown(userId);

  if (!breakdown) {
    notFound();
  }

  const completedCount =
    breakdown.completedOnTimeCount + breakdown.completedLateCount;
  const onTimePercentage =
    completedCount === 0
      ? null
      : Math.round((breakdown.completedOnTimeCount / completedCount) * 100);

  return (
    <section aria-labelledby="employee-heading" className="space-y-6">
      <div>
        <Link
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          href="/employees"
        >
          ← Back to Employees
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <PersonAvatar
            displayName={breakdown.displayName}
            size="lg"
            userId={breakdown.userId}
          />
          <div>
            <h1
              className="text-3xl font-semibold tracking-[-0.035em] text-foreground"
              id="employee-heading"
            >
              {breakdown.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {breakdown.totalCount} tasks assigned all-time
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          tone="success"
          value={completedCount}
        />
        <StatTile
          icon={CalendarX}
          label="Missed"
          tone="danger"
          value={breakdown.missedCount}
        />
        <StatTile
          icon={Clock}
          label="In progress"
          value={breakdown.activeCount}
        />
        <StatTile
          icon={TrendingUp}
          label="On-time rate"
          tone="success"
          value={onTimePercentage === null ? '—' : `${onTimePercentage}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed vs. missed</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskBreakdownChart
            active={breakdown.activeCount}
            completed={completedCount}
            missed={breakdown.missedCount}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Missed deadlines ({breakdown.missedTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown.missedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No missed deadlines. Nice work.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {breakdown.missedTasks.map((task) => (
                <li
                  className="flex items-center justify-between gap-3 py-2.5"
                  key={task.id}
                >
                  <Link
                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                    href={`/tasks/${task.id}`}
                  >
                    {task.title}
                  </Link>
                  <span className="shrink-0 text-xs font-semibold text-red-400">
                    Due {new Date(task.dueAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently completed</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown.recentlyCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing completed yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {breakdown.recentlyCompleted.map((task) => (
                <li
                  className="flex items-center justify-between gap-3 py-2.5"
                  key={task.id}
                >
                  <Link
                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                    href={`/tasks/${task.id}`}
                  >
                    {task.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(task.completedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
