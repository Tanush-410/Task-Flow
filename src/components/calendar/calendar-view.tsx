'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import {
  getRangeForView,
  navigateDate,
  startOfWeek,
  type ViewMode,
} from '@/lib/calendar-dates';
import { getCalendarEvents } from '@/modules/calendar/actions';
import type { OrganizationMember } from '@/modules/members/queries';
import type { CalendarTask } from '@/modules/tasks/queries';
import { PersonAvatar } from '@/components/person-avatar';
import { Button } from '@/components/ui/button';

import { MonthGrid } from './month-grid';
import { QuickCreatePopover } from './quick-create-popover';
import { WeekGrid } from './week-grid';

const VIEW_MODES: ViewMode[] = ['month', 'week', 'day'];

export function CalendarView({
  initialDate,
  initialEvents,
  people,
}: {
  initialDate: string;
  initialEvents: CalendarTask[];
  people: OrganizationMember[];
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date(initialDate));
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState(initialEvents);
  const [hiddenPeople, setHiddenPeople] = useState<Set<string>>(new Set());
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);

  const range = getRangeForView(currentDate, viewMode);
  const rangeKey = `${viewMode}-${range.start.getTime()}-${range.end.getTime()}`;

  const refetchEvents = useCallback(() => {
    startTransition(() => {
      getCalendarEvents(
        range.start.toISOString(),
        range.end.toISOString(),
      ).then(setEvents);
    });
    // rangeKey captures the same range.start/range.end this closure reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    refetchEvents();
    // Re-fetch only when the visible range actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  function togglePerson(userId: string) {
    setHiddenPeople((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  const visibleEvents =
    hiddenPeople.size === 0
      ? events
      : events.filter(
          (event) =>
            event.assignees.length === 0 ||
            event.assignees.some(
              (assignee) => !hiddenPeople.has(assignee.userId),
            ),
        );

  const heading =
    viewMode === 'month'
      ? currentDate.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : viewMode === 'day'
        ? currentDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
        : `${range.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
            range.end.getTime() - 86_400_000,
          ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCurrentDate(new Date())}
            size="sm"
            variant="outline"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Previous"
              onClick={() =>
                setCurrentDate((date) => navigateDate(date, viewMode, -1))
              }
              size="sm"
              variant="ghost"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
            <Button
              aria-label="Next"
              onClick={() =>
                setCurrentDate((date) => navigateDate(date, viewMode, 1))
              }
              size="sm"
              variant="ghost"
            >
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        </div>

        <div
          aria-label="Calendar view"
          className="flex gap-1 rounded-lg bg-muted p-1"
          role="radiogroup"
        >
          {VIEW_MODES.map((mode) => (
            <button
              aria-checked={viewMode === mode}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              key={mode}
              onClick={() => setViewMode(mode)}
              role="radio"
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {people.length > 0 ? (
          <aside className="w-full shrink-0 lg:w-48">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              People
            </p>
            <ul className="mt-2 space-y-1.5">
              {people.map((person) => (
                <li key={person.userId}>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      checked={!hiddenPeople.has(person.userId)}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary"
                      onChange={() => togglePerson(person.userId)}
                      type="checkbox"
                    />
                    <PersonAvatar
                      displayName={person.displayName}
                      size="sm"
                      userId={person.userId}
                    />
                    <span className="truncate">{person.displayName}</span>
                  </label>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <div
          className={`min-w-0 flex-1 ${isPending ? 'opacity-60 transition-opacity' : ''}`}
        >
          {viewMode === 'month' ? (
            <MonthGrid
              canCreate
              events={visibleEvents}
              month={currentDate}
              onCreateAt={setQuickCreateDate}
              onSelectDay={(day) => {
                setCurrentDate(day);
                setViewMode('day');
              }}
            />
          ) : (
            <WeekGrid
              canCreate
              dayCount={viewMode === 'week' ? 7 : 1}
              events={visibleEvents}
              onCreateAt={setQuickCreateDate}
              startDate={
                viewMode === 'week' ? startOfWeek(currentDate) : currentDate
              }
            />
          )}
        </div>
      </div>

      {quickCreateDate ? (
        <QuickCreatePopover
          defaultDate={quickCreateDate}
          employees={people.filter(
            (person) =>
              person.role === 'employee' && person.status === 'active',
          )}
          onClose={() => setQuickCreateDate(null)}
          onCreated={refetchEvents}
        />
      ) : null}
    </div>
  );
}
