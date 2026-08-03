import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getEmployeeCompletionReport } from '@/modules/reports/queries';

export default async function ReportsPage() {
  const stats = await getEmployeeCompletionReport();

  return (
    <section aria-labelledby="reports-heading" className="space-y-6">
      <PageHeader
        description="Completed tasks by employee, and how many finished on time."
        eyebrow="Organization"
        headingId="reports-heading"
        title="Reports"
      />

      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <th className="px-5 py-3" scope="col">
                Employee
              </th>
              <th className="px-5 py-3" scope="col">
                Completed
              </th>
              <th className="px-5 py-3" scope="col">
                On time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {stats.length === 0 ? (
              <tr>
                <td className="px-5 py-4 text-slate-600" colSpan={3}>
                  No completed tasks yet.
                </td>
              </tr>
            ) : (
              stats.map((stat) => (
                <tr key={stat.userId}>
                  <td className="px-5 py-3 font-semibold text-slate-950">
                    {stat.displayName}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {stat.completedCount}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {stat.completedCount === 0
                      ? '—'
                      : `${stat.onTimePercentage}% (${stat.onTimeCount}/${stat.completedCount})`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
