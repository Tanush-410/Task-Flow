import Link from 'next/link';

import { TaskBreakdownChart } from '@/components/task-breakdown-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireEmployee } from '@/modules/members/queries';
import { getEmployeeTaskBreakdown } from '@/modules/reports/queries';

export default async function MyProgressPage() {
  const membership = await requireEmployee();
  const breakdown = await getEmployeeTaskBreakdown(membership.userId);

  const completedCount =
    (breakdown?.completedOnTimeCount ?? 0) +
    (breakdown?.completedLateCount ?? 0);
  const onTimePercentage =
    !breakdown || completedCount === 0
      ? null
      : Math.round((breakdown.completedOnTimeCount / completedCount) * 100);

  return (
    <section aria-labelledby="my-progress-heading" className="space-y-6">
      <PageHeader
        description="How you're doing across everything ever assigned to you."
        eyebrow="Your stats"
        headingId="my-progress-heading"
        title="My Progress"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-5 sm:p-5">
          <p className="text-sm font-medium text-muted-foreground">Completed</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {completedCount}
          </p>
        </Card>
        <Card className="p-5 sm:p-5">
          <p className="text-sm font-medium text-muted-foreground">Missed</p>
          <p
            className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${
              (breakdown?.missedCount ?? 0) > 0
                ? 'text-red-400'
                : 'text-foreground'
            }`}
          >
            {breakdown?.missedCount ?? 0}
          </p>
        </Card>
        <Card className="p-5 sm:p-5">
          <p className="text-sm font-medium text-muted-foreground">
            In progress
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {breakdown?.activeCount ?? 0}
          </p>
        </Card>
        <Card className="p-5 sm:p-5">
          <p className="text-sm font-medium text-muted-foreground">
            On-time rate
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {onTimePercentage === null ? '—' : `${onTimePercentage}%`}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed vs. missed</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskBreakdownChart
            active={breakdown?.activeCount ?? 0}
            completed={completedCount}
            missed={breakdown?.missedCount ?? 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Missed deadlines ({breakdown?.missedTasks.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!breakdown || breakdown.missedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No missed deadlines. Keep it up.
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
    </section>
  );
}
