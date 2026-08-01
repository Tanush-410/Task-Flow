import { requireAdmin } from '@/modules/members/queries';

export default async function DashboardPage() {
  await requireAdmin();

  return (
    <section aria-labelledby="dashboard-heading">
      <p className="text-sm font-medium text-slate-500">Overview</p>
      <h1
        className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
        id="dashboard-heading"
      >
        Dashboard
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
        Organization work and team activity will appear here as those features
        become available.
      </p>
    </section>
  );
}
