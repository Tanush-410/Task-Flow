'use server';

import { listMyAssignmentsInRange } from '../assignments/queries';
import { requireMembership } from '../members/queries';
import {
  listOrganizationTasksInRange,
  type CalendarTask,
} from '../tasks/queries';

/**
 * The server (not the client) decides which query to run based on the
 * caller's real role — the client never gets to request another
 * organization's or another employee's events by passing a different role.
 */
export async function getCalendarEvents(
  startISO: string,
  endISO: string,
): Promise<CalendarTask[]> {
  const membership = await requireMembership();

  return membership.role === 'admin'
    ? listOrganizationTasksInRange(startISO, endISO)
    : listMyAssignmentsInRange(startISO, endISO);
}
