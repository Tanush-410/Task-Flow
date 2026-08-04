'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { addDays, isSameDay } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';
import { getPersonTag } from '@/lib/person-tag';
import type { CalendarTask } from '@/modules/tasks/queries';

const HOUR_HEIGHT = 48;
const DEFAULT_DURATION_MINUTES = 30;
const MIN_EVENT_HEIGHT = 20;

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function eventTimes(event: CalendarTask): { start: Date; end: Date } | null {
  const dueAt = event.task.due_at ? new Date(event.task.due_at) : null;
  const startAt = event.task.start_at ? new Date(event.task.start_at) : null;

  if (startAt && dueAt && dueAt > startAt) {
    return { start: startAt, end: dueAt };
  }

  const anchor = dueAt ?? startAt;
  if (!anchor) {
    return null;
  }

  return {
    start: anchor,
    end: new Date(anchor.getTime() + DEFAULT_DURATION_MINUTES * 60_000),
  };
}

export function WeekGrid({
  startDate,
  dayCount,
  events,
  canCreate,
  onCreateAt,
}: {
  startDate: Date;
  dayCount: 1 | 7;
  events: CalendarTask[];
  canCreate: boolean;
  onCreateAt: (date: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: dayCount }, (_, index) =>
    addDays(startDate, index),
  );
  const today = new Date();
  const columnsClass =
    dayCount === 7 ? 'grid-cols-[56px_repeat(7,1fr)]' : 'grid-cols-[56px_1fr]';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * HOUR_HEIGHT });
  }, []);

  const eventsByDay = days.map((day) =>
    events.filter((event) => {
      const times = eventTimes(event);
      return times ? isSameDay(times.start, day) : false;
    }),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className={cn('grid border-b border-border', columnsClass)}>
        <div />
        {days.map((day) => (
          <div
            className="border-l border-border px-2 py-2 text-center"
            key={day.toISOString()}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {day.toLocaleDateString(undefined, { weekday: 'short' })}
            </p>
            <p
              className={cn(
                'mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                isSameDay(day, today)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground',
              )}
            >
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      <div className="max-h-[600px] overflow-y-auto" ref={scrollRef}>
        <div className={cn('grid', columnsClass)}>
          <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                className="absolute right-2 -translate-y-2 text-right text-[11px] text-muted-foreground"
                key={hour}
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour === 0
                  ? ''
                  : new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                    })}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => (
            <div
              className="relative border-l border-border"
              key={day.toISOString()}
              style={{ height: HOUR_HEIGHT * 24 }}
            >
              {Array.from({ length: 24 }, (_, hour) =>
                canCreate ? (
                  <button
                    aria-label={`Create task at ${hour}:00 on ${day.toLocaleDateString()}`}
                    className="absolute inset-x-0 border-t border-border text-left hover:bg-muted"
                    key={hour}
                    onClick={() =>
                      onCreateAt(
                        new Date(
                          day.getFullYear(),
                          day.getMonth(),
                          day.getDate(),
                          hour,
                        ),
                      )
                    }
                    style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    type="button"
                  />
                ) : (
                  <div
                    className="absolute inset-x-0 border-t border-border"
                    key={hour}
                    style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ),
              )}

              {eventsByDay[dayIndex].map((event) => {
                const times = eventTimes(event);
                if (!times) {
                  return null;
                }

                const top =
                  (minutesSinceMidnight(times.start) / 60) * HOUR_HEIGHT;
                const durationMinutes = Math.max(
                  (times.end.getTime() - times.start.getTime()) / 60_000,
                  DEFAULT_DURATION_MINUTES,
                );
                const height = Math.max(
                  (durationMinutes / 60) * HOUR_HEIGHT,
                  MIN_EVENT_HEIGHT,
                );
                const primary = event.assignees[0];
                const tag = primary
                  ? getPersonTag(primary.userId, primary.displayName)
                  : null;

                return (
                  <Link
                    className={cn(
                      'absolute inset-x-1 z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] font-medium shadow-sm',
                      tag
                        ? [tag.softBg, tag.softText, tag.softBorder]
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                    href={`/tasks/${event.task.id}`}
                    key={event.task.id}
                    style={{ top, height }}
                  >
                    <span className="block truncate">{event.task.title}</span>
                  </Link>
                );
              })}

              {isSameDay(day, today) ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                  style={{
                    top: (minutesSinceMidnight(today) / 60) * HOUR_HEIGHT,
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
