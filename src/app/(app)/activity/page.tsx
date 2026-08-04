import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Activity } from 'lucide-react';
import { listOrganizationActivity } from '@/modules/activity/queries';
import { listDisplayNames } from '@/modules/members/queries';
import { createServerSupabase } from '@/lib/supabase/server';

const EVENT_BADGE_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive' | 'success'
> = {
  task_created: 'default',
  task_updated: 'secondary',
  task_published: 'success',
  task_archived: 'secondary',
  assignment_created: 'default',
  assignment_progress_changed: 'secondary',
  assignment_status_changed: 'secondary',
  assignment_completed: 'success',
  assignment_delayed: 'destructive',
};

export default async function OrganizationActivityPage() {
  const { data: events } = await listOrganizationActivity();
  const eventRows = events ?? [];

  const taskIds = Array.from(
    new Set(eventRows.map((event) => event.task_id).filter(Boolean)),
  );

  const [displayNames, taskTitles] = await Promise.all([
    listDisplayNames(
      eventRows
        .map((event) => event.actor_id)
        .filter((id): id is string => Boolean(id)),
    ),
    (async () => {
      if (taskIds.length === 0) return new Map<string, string>();
      const supabase = await createServerSupabase();
      const { data } = await supabase
        .from('tasks')
        .select('id,title')
        .in('id', taskIds);
      return new Map((data ?? []).map((task) => [task.id, task.title]));
    })(),
  ]);

  return (
    <section aria-labelledby="activity-heading" className="space-y-6">
      <PageHeader
        description="Everything happening across your organization's tasks, most recent first."
        eyebrow="Organization"
        headingId="activity-heading"
        title="Activity"
      />

      {eventRows.length === 0 ? (
        <EmptyState
          description="Task and assignment changes across your organization will show up here."
          icon={Activity}
          title="No activity yet"
        />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y divide-border">
              {eventRows.map((event) => (
                <li
                  className="flex flex-wrap items-center gap-2 py-3 text-sm"
                  key={event.id}
                >
                  <Badge
                    variant={
                      EVENT_BADGE_VARIANT[event.event_type] ?? 'secondary'
                    }
                  >
                    {event.event_type.replaceAll('_', ' ')}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {event.actor_id
                      ? (displayNames.get(event.actor_id) ?? 'Someone')
                      : 'System'}
                  </span>
                  <span className="text-muted-foreground">{event.summary}</span>
                  {event.task_id && taskTitles.get(event.task_id) ? (
                    <Link
                      className="font-semibold text-primary underline underline-offset-2"
                      href={`/tasks/${event.task_id}`}
                    >
                      {taskTitles.get(event.task_id)}
                    </Link>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
