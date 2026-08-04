'use client';

import { Download } from 'lucide-react';

import type { EmployeeCompletionStat } from '@/modules/reports/queries';
import { Button } from '@/components/ui/button';

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: EmployeeCompletionStat[]): string {
  const header = ['Employee', 'Completed', 'On time', 'On-time %'];
  const lines = rows.map((row) =>
    [
      row.displayName,
      row.completedCount,
      row.onTimeCount,
      row.completedCount === 0 ? '' : row.onTimePercentage,
    ]
      .map(csvEscape)
      .join(','),
  );

  return [header.join(','), ...lines].join('\n');
}

export function ExportReportButton({
  stats,
}: {
  stats: EmployeeCompletionStat[];
}) {
  function handleExport() {
    const csv = toCsv(stats);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      disabled={stats.length === 0}
      onClick={handleExport}
      size="sm"
      variant="outline"
    >
      <Download aria-hidden />
      Export CSV
    </Button>
  );
}
