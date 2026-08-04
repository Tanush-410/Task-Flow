import { ChartNoAxesCombined, Trophy } from 'lucide-react';

import { ExportReportButton } from '@/components/export-report-button';
import { ProductivityChart } from '@/components/productivity-chart';
import { ReportChart } from '@/components/report-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  getEmployeeCompletionReport,
  getEmployeeProductivity,
} from '@/modules/reports/queries';

export default async function ReportsPage() {
  const [stats, productivity] = await Promise.all([
    getEmployeeCompletionReport(),
    getEmployeeProductivity(),
  ]);
  const hasCompletions = stats.some((stat) => stat.completedCount > 0);
  const hasProductivityData = productivity.some(
    (stat) => stat.averageHoursToComplete !== null,
  );

  return (
    <section aria-labelledby="reports-heading" className="space-y-6">
      <PageHeader
        action={<ExportReportButton stats={stats} />}
        description="Completed tasks by employee, and how many finished on time."
        eyebrow="Organization"
        headingId="reports-heading"
        title="Reports"
      />

      {hasCompletions ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartNoAxesCombined
                aria-hidden
                className="size-4 text-primary"
              />
              Completed tasks by employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReportChart stats={stats} />
          </CardContent>
        </Card>
      ) : null}

      {hasProductivityData ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy aria-hidden className="size-4 text-primary" />
              Most productive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductivityChart stats={productivity} />
          </CardContent>
        </Card>
      ) : null}

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
