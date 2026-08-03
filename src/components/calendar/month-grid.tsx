'use client';

import { addDays, isSameDay, startOfMonthGrid } from '@/lib/calendar-dates';
import { cn } from '@/lib/cn';
import type { CalendarTask } from '@/modules/tasks/queries';

import { EventChip } from './event-chip';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_EVENTS = 3;

export function MonthGrid({
  month,
  events,
  canCreate,
  onSelectDay,
  onCreateAt,
}: {
  month: Date;
  events: CalendarTask[];
  canCreate: boolean;
  onSelectDay: (day: Date) => void;
  onCreateAt: (date: Date) => void;
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
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
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
                'group relative min-h-[112px] border-r border-b border-slate-100 p-1.5 transition-colors',
                !isCurrentMonth && 'bg-slate-50/50',
              )}
              key={day.toISOString()}
            >
              {canCreate ? (
                <button
                  aria-label={`Create task on ${day.toLocaleDateString()}`}
                  className="absolute inset-0 z-0 rounded-sm transition-colors hover:bg-accent-soft/40 focus-visible:bg-accent-soft/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  onClick={() =>
                    onCreateAt(
                      new Date(
                        day.getFullYear(),
                        day.getMonth(),
                        day.getDate(),
                        9,
                        0,
                      ),
                    )
                  }
                  type="button"
                />
              ) : null}

              <div className="relative z-10 flex items-center justify-between">
                <button
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    isToday
                      ? 'bg-accent text-white'
                      : isCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-200/70'
                        : 'text-slate-400 hover:bg-slate-200/70',
                  )}
                  onClick={() => onSelectDay(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
              </div>
              <div className="relative z-10 mt-1 space-y-1">
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
