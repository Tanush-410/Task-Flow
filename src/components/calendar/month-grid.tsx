'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';

import { addDays, isSameDay, startOfMonthGrid } from '@/lib/calendar-dates';
import { cn } from '@/lib/cn';
import type { CalendarTask } from '@/modules/tasks/queries';

import { EventChip } from './event-chip';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_EVENTS = 3;

function createTaskHref(day: Date): string {
  const dueAt = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    9,
    0,
  );
  return `/tasks/new?date=${encodeURIComponent(dueAt.toISOString())}`;
}

export function MonthGrid({
  month,
  events,
  onSelectDay,
}: {
  month: Date;
  events: CalendarTask[];
  onSelectDay: (day: Date) => void;
}) {
  const gridStart = startOfMonthGrid(month);
  const today = new Date();
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index),
  );

  const eventsByDay = new Map<string, CalendarTask[]>();
  for (const event of events) {
    const effectiveDate = event.task.due_at ?? event.task.start_at;
    if (!effectiveDate) continue;
    const key = new Date(effectiveDate).toDateString();
    const list = eventsByDay.get(key) ?? [];
    list.push(event);
    eventsByDay.set(key, list);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase"
            key={label}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isToday = isSameDay(day, today);
          const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              className={cn(
                'group relative min-h-[112px] border-r border-b border-slate-100 p-1.5',
                !isCurrentMonth && 'bg-slate-50/60',
              )}
              key={day.toISOString()}
            >
              <div className="flex items-center justify-between">
                <button
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    isToday
                      ? 'bg-accent text-white'
                      : isCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-slate-100',
                  )}
                  onClick={() => onSelectDay(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
                <Link
                  aria-label={`Create task on ${day.toLocaleDateString()}`}
                  className="flex size-6 items-center justify-center rounded-full text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-accent-hover group-hover:opacity-100"
                  href={createTaskHref(day)}
                >
                  <Plus aria-hidden className="size-3.5" />
                </Link>
              </div>
              <div className="mt-1 space-y-1">
                {visible.map((event) => (
                  <EventChip event={event} key={event.task.id} />
                ))}
                {overflow > 0 ? (
                  <button
                    className="block text-left text-[11px] font-medium text-slate-500 hover:text-slate-700"
                    onClick={() => onSelectDay(day)}
                    type="button"
                  >
                    +{overflow} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
