import type { EmployeeProductivity } from '@/modules/reports/queries';

function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }
  if (hours < 48) {
    return `${hours.toFixed(1)} hrs`;
  }
  return `${(hours / 24).toFixed(1)} days`;
}

export function ProductivityChart({
  stats,
}: {
  stats: EmployeeProductivity[];
}) {
  const measured = stats.filter((stat) => stat.averageHoursToComplete !== null);
  const maxHours = Math.max(
    1,
    ...measured.map((stat) => stat.averageHoursToComplete!),
  );

  return (
    <div className="space-y-4">
      {stats.map((stat) => (
        <div key={stat.userId}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {stat.displayName}
            </span>
            <span className="text-muted-foreground">
              {stat.averageHoursToComplete === null
                ? 'No completions yet'
                : `${formatDuration(stat.averageHoursToComplete)} avg · ${stat.completedCount} completed`}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{
                width:
                  stat.averageHoursToComplete === null
                    ? '0%'
                    : `${Math.max(2, 100 - (stat.averageHoursToComplete / maxHours) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
