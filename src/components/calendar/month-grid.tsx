'use client';

import { useState } from 'react';

import { addDays, isSameDay, startOfMonthGrid } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';
import type { CalendarTask } from '@/modules/tasks/queries';

import { EventChip } from './event-chip';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_EVENTS = 3;

export function MonthGrid({
  month,
  events,
  canCreate,
  canEdit = false,
  onSelectDay,
  onCreateAt,
  onRescheduleTask,
}: {
  month: Date;
  events: CalendarTask[];
  canCreate: boolean;
  canEdit?: boolean;
  onSelectDay: (day: Date) => void;
  onCreateAt: (date: Date) => void;
  onRescheduleTask?: (taskId: string, newDueAt: string) => void;
}) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/80">
        {WEEKDAY_LABELS.map((label) => (
          <div
            className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase"
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

          const dayKey = day.toISOString();

          return (
            <div
              className={cn(
                'group relative min-h-[112px] border-r border-b border-border p-1.5 transition-colors',
                !isCurrentMonth && 'bg-muted/50',
                dragOverKey === dayKey && 'bg-primary-soft/60',
              )}
              key={dayKey}
              onDragLeave={canEdit ? () => setDragOverKey(null) : undefined}
              onDragOver={
                canEdit
                  ? (dragEvent) => {
                      dragEvent.preventDefault();
                      setDragOverKey(dayKey);
                    }
                  : undefined
              }
              onDrop={
                canEdit && onRescheduleTask
                  ? (dragEvent) => {
                      dragEvent.preventDefault();
                      setDragOverKey(null);
                      const raw =
                        dragEvent.dataTransfer.getData('application/json');
                      if (!raw) return;

                      try {
                        const payload = JSON.parse(raw) as {
                          taskId: string;
                          dueAt: string | null;
                        };
                        const original = payload.dueAt
                          ? new Date(payload.dueAt)
                          : null;
                        const newDueAt = new Date(
                          day.getFullYear(),
                          day.getMonth(),
                          day.getDate(),
                          original?.getHours() ?? 9,
                          original?.getMinutes() ?? 0,
                        );
                        onRescheduleTask(
                          payload.taskId,
                          newDueAt.toISOString(),
                        );
                      } catch {
                        // Ignore malformed drag payloads.
                      }
                    }
                  : undefined
              }
            >
              {canCreate ? (
                <button
                  aria-label={`Create task on ${day.toLocaleDateString()}`}
                  className="absolute inset-0 z-0 rounded-sm transition-colors hover:bg-primary-soft/40 focus-visible:bg-primary-soft/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
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
                      ? 'bg-primary text-primary-foreground'
                      : isCurrentMonth
                        ? 'text-muted-foreground hover:bg-accent/70'
                        : 'text-muted-foreground hover:bg-accent/70',
                  )}
                  onClick={() => onSelectDay(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
              </div>
              <div className="relative z-10 mt-1 space-y-1">
                {visible.map((event) => (
                  <EventChip
                    draggable={canEdit}
                    event={event}
                    key={event.task.id}
                  />
                ))}
                {overflow > 0 ? (
                  <button
                    className="block text-left text-[11px] font-medium text-muted-foreground hover:text-muted-foreground"
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
