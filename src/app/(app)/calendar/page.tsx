import { CalendarView } from '@/components/calendar/calendar-view';
import { PageHeader } from '@/components/ui/page-header';
import { ViewSwitcher } from '@/components/view-switcher';
import { getRangeForView } from '@/lib/calendar-dates';
import { getCalendarEvents } from '@/modules/calendar/actions';
import {
  listAssignableMembers,
  requireMembership,
} from '@/modules/members/queries';

export default async function CalendarPage() {
  const membership = await requireMembership();
  const now = new Date();
  const range = getRangeForView(now, 'month');

  const [events, people] = await Promise.all([
    getCalendarEvents(range.start.toISOString(), range.end.toISOString()),
    listAssignableMembers(),
  ]);

  return (
    <section aria-labelledby="calendar-heading" className="space-y-6">
      <PageHeader
        description="Every task, tagged by who it belongs to — switch between Month, Week, and Day."
        eyebrow="Schedule"
        headingId="calendar-heading"
        title="Calendar"
      />

      <ViewSwitcher
        items={[
          {
            href: membership.role === 'admin' ? '/tasks' : '/my-tasks',
            label: 'List',
          },
          { href: '/calendar', label: 'Calendar' },
        ]}
      />

      <CalendarView
        initialDate={now.toISOString()}
        initialEvents={events}
        people={people.filter((person) => person.status === 'active')}
        role={membership.role}
      />
    </section>
  );
}
