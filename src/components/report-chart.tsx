import type { EmployeeCompletionStat } from '@/modules/reports/queries';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function ReportChart({ stats }: { stats: EmployeeCompletionStat[] }) {
  const maxCompleted = Math.max(1, ...stats.map((stat) => stat.completedCount));

  return (
    <div className="space-y-4">
      {stats.map((stat, index) => (
        <div key={stat.userId}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {stat.displayName}
            </span>
            <span className="text-muted-foreground">
              {stat.completedCount} completed
              {stat.completedCount > 0
                ? ` · ${stat.onTimePercentage}% on time`
                : ''}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.max(2, (stat.completedCount / maxCompleted) * 100)}%`,
                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
