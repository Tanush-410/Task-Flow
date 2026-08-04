const SEGMENTS = [
  { key: 'completed', label: 'Completed', className: 'bg-emerald-500' },
  { key: 'missed', label: 'Missed deadline', className: 'bg-red-500' },
  { key: 'active', label: 'In progress', className: 'bg-primary' },
] as const;

export function TaskBreakdownChart({
  completed,
  missed,
  active,
}: {
  completed: number;
  missed: number;
  active: number;
}) {
  const total = completed + missed + active;
  const values: Record<(typeof SEGMENTS)[number]['key'], number> = {
    completed,
    missed,
    active,
  };

  return (
    <div>
      {total === 0 ? (
        <div className="h-4 w-full rounded-full bg-muted" />
      ) : (
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          {SEGMENTS.filter((segment) => values[segment.key] > 0).map(
            (segment) => (
              <div
                className={segment.className}
                key={segment.key}
                style={{ width: `${(values[segment.key] / total) * 100}%` }}
                title={`${segment.label}: ${values[segment.key]}`}
              />
            ),
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {SEGMENTS.map((segment) => (
          <span className="flex items-center gap-1.5" key={segment.key}>
            <span className={`size-2.5 rounded-full ${segment.className}`} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-semibold text-foreground">
              {values[segment.key]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
