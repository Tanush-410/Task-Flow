import { ExportReportButton } from '@/components/export-report-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getEmployeeCompletionReport } from '@/modules/reports/queries';

export default async function ReportsPage() {
  const stats = await getEmployeeCompletionReport();

  return (
    <section aria-labelledby="reports-heading" className="space-y-6">
      <PageHeader
        action={<ExportReportButton stats={stats} />}
        description="Completed tasks by employee, and how many finished on time."
        eyebrow="Organization"
        headingId="reports-heading"
        title="Reports"
      />

      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
          <tbody className="divide-y divide-border">
            {stats.length === 0 ? (
              <tr>
                <td className="px-5 py-4 text-muted-foreground" colSpan={3}>
                  No completed tasks yet.
                </td>
              </tr>
            ) : (
              stats.map((stat) => (
                <tr key={stat.userId}>
                  <td className="px-5 py-3 font-semibold text-foreground">
                    {stat.displayName}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {stat.completedCount}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
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
