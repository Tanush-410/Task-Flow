import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddAssigneeForm } from '@/components/add-assignee-form';
import { AssignmentControls } from '@/components/assignment-controls';
import { RemoveAssignmentButton } from '@/components/remove-assignment-button';
import { ReopenAssignmentForm } from '@/components/reopen-assignment-form';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listTaskActivity } from '@/modules/activity/queries';
import {
  listAssignableMembers,
  listDisplayNames,
  requireMembership,
} from '@/modules/members/queries';
import { getTaskById, listTaskAssignments } from '@/modules/tasks/queries';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  delayed: 'Delayed',
  completed: 'Completed',
};

const STATUS_BADGE_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive' | 'success'
> = {
  not_started: 'secondary',
  in_progress: 'default',
  delayed: 'destructive',
  completed: 'success',
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const membership = await requireMembership();

  const [{ data: task }, { data: assignments }, { data: activity }] =
    await Promise.all([
      getTaskById(taskId),
      listTaskAssignments(taskId),
      listTaskActivity(taskId),
    ]);

  if (!task) {
    notFound();
  }

  const assignmentRows = assignments ?? [];
  const activityRows = activity ?? [];
  const myAssignment = assignmentRows.find(
    (row) => row.assignee_id === membership.userId,
  );

  const availableEmployees = (await listAssignableMembers()).filter(
    (member) =>
      member.role === 'employee' &&
      member.status === 'active' &&
      !assignmentRows.some((row) => row.assignee_id === member.userId),
  );

  const displayNames = await listDisplayNames([
    ...assignmentRows.map((row) => row.assignee_id),
    ...activityRows
      .map((row) => row.actor_id)
      .filter((id): id is string => Boolean(id)),
  ]);

  const now = new Date();
  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const anyIncomplete = assignmentRows.some(
    (row) => row.status !== 'completed',
  );
  const isPastDue = Boolean(dueDate) && dueDate! < now;
  const overdue =
    isPastDue &&
    (membership.role === 'admin'
      ? anyIncomplete
      : Boolean(myAssignment) && myAssignment!.status !== 'completed');

  return (
    <section aria-labelledby="task-heading" className="space-y-6">
      <div>
        <Link
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          href={membership.role === 'admin' ? '/tasks' : '/my-tasks'}
        >
          ← Back to {membership.role === 'admin' ? 'All Tasks' : 'My Tasks'}
        </Link>

        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground"
          id="task-heading"
        >
          {task.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge>{PRIORITY_LABELS[task.priority]} priority</Badge>
          {dueDate ? (
            <span className={overdue ? 'font-semibold text-red-400' : ''}>
              {overdue ? 'Overdue · ' : 'Due '}
              {dueDate.toLocaleString()}
            </span>
          ) : (
            <span className="text-muted-foreground">No due date</span>
          )}
        </p>

        {task.description ? (
          <p className="mt-4 max-w-3xl leading-7 whitespace-pre-wrap text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </div>

      {myAssignment ? (
        <Card>
          <CardHeader>
            <CardTitle>Your assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={STATUS_BADGE_VARIANT[myAssignment.status]}>
                {STATUS_LABELS[myAssignment.status]}
              </Badge>
              {myAssignment.progress}% complete
            </p>
            <div className="mt-4">
              <AssignmentControls
                assignment={{
                  id: myAssignment.id,
                  status: myAssignment.status,
                  progress: myAssignment.progress,
                  delayReason: myAssignment.delay_reason,
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              Assignees (
              {
                assignmentRows.filter((row) => row.status === 'completed')
                  .length
              }{' '}
              of {assignmentRows.length} completed)
            </CardTitle>
            <AddAssigneeForm
              availableEmployees={availableEmployees}
              taskId={task.id}
            />
          </div>
        </CardHeader>
        <CardContent>
          {assignmentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one is assigned to this task yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {assignmentRows.map((row) => {
                const rowOverdue = isPastDue && row.status !== 'completed';
                const name = displayNames.get(row.assignee_id) ?? 'Unknown';

                return (
                  <li className="py-3" key={row.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          displayName={name}
                          userId={row.assignee_id}
                        />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                              {STATUS_LABELS[row.status]}
                            </Badge>
                            {row.progress}%
                            {rowOverdue ? (
                              <span className="font-semibold text-red-400">
                                Overdue
                              </span>
                            ) : null}
                          </p>
                          {row.status === 'delayed' && row.delay_reason ? (
                            <p className="mt-1 text-xs text-red-400">
                              Delay reason: {row.delay_reason}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {row.status === 'completed' ? (
                          <ReopenAssignmentForm assignmentId={row.id} />
                        ) : (
                          <RemoveAssignmentButton assignmentId={row.id} />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {activityRows.map((event) => (
                <li className="text-sm text-muted-foreground" key={event.id}>
                  <span className="font-semibold text-foreground">
                    {event.actor_id
                      ? (displayNames.get(event.actor_id) ?? 'Someone')
                      : 'System'}
                  </span>{' '}
                  — {event.summary} ·{' '}
                  <span className="text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
