import { CalendarX, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { StatTile } from '@/components/stat-tile';
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
          value={breakdown?.missedCount ?? 0}
        />
        <StatTile
          icon={Clock}
          label="In progress"
          value={breakdown?.activeCount ?? 0}
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
