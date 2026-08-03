import { getEmployeeCompletionReport } from '@/modules/reports/queries';

export default async function ReportsPage() {
  const stats = await getEmployeeCompletionReport();

  return (
    <section aria-labelledby="reports-heading">
      <p className="text-sm font-medium text-slate-500">Organization</p>
      <h1
        className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
        id="reports-heading"
      >
        Reports
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
        Completed tasks by employee, and how many finished on time.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
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
      </div>
    </section>
  );
}
