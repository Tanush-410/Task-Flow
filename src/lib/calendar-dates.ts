export type ViewMode = 'month' | 'week' | 'day';

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function startOfMonthGrid(date: Date): Date {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(firstOfMonth);
}

export function endOfMonthGrid(date: Date): Date {
  return addDays(startOfMonthGrid(date), 42);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getRangeForView(
  date: Date,
  viewMode: ViewMode,
): { start: Date; end: Date } {
  if (viewMode === 'month') {
    return { start: startOfMonthGrid(date), end: endOfMonthGrid(date) };
  }

  if (viewMode === 'week') {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }

  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

export function navigateDate(
  date: Date,
  viewMode: ViewMode,
  direction: 1 | -1,
): Date {
  if (viewMode === 'month') {
    return new Date(date.getFullYear(), date.getMonth() + direction, 1);
  }

  if (viewMode === 'week') {
    return addDays(date, direction * 7);
  }

  return addDays(date, direction);
}
