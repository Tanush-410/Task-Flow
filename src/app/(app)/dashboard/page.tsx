import Link from 'next/link';

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
    <Link
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)] transition-colors hover:border-slate-300"
      href={href}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${
          tone === 'danger' && value > 0 ? 'text-red-700' : 'text-slate-950'
        }`}
      >
        {value}
      </p>
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
    <section aria-labelledby="dashboard-heading">
      <p className="text-sm font-medium text-slate-500">Overview</p>
      <h1
        className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
        id="dashboard-heading"
      >
        Dashboard
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
            Recent tasks
          </h2>
          <Link
            className="text-sm font-semibold text-slate-950 underline underline-offset-2"
            href="/tasks"
          >
            View all
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No tasks yet.{' '}
            <Link className="underline underline-offset-2" href="/tasks/new">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {recentTasks.map((task) => (
              <li key={task.id}>
                <Link
                  className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50"
                  href={`/tasks/${task.id}`}
                >
                  <span className="text-sm font-semibold text-slate-950">
                    {task.title}
                  </span>
                  <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    {STATUS_LABELS[task.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
