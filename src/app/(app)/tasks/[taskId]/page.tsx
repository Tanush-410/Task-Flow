import { Repeat, SquarePen } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddAssigneeForm } from '@/components/add-assignee-form';
import { AssignmentControls } from '@/components/assignment-controls';
import { MuteTaskButton } from '@/components/mute-task-button';
import { RemoveAssignmentButton } from '@/components/remove-assignment-button';
import { ReopenAssignmentForm } from '@/components/reopen-assignment-form';
import { PersonAvatar } from '@/components/person-avatar';
import { TaskAttachments } from '@/components/task-attachments';
import { TaskChecklist } from '@/components/task-checklist';
import { TaskComments, type TaskCommentRow } from '@/components/task-comments';
import { TaskDependencies } from '@/components/task-dependencies';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listTaskActivity } from '@/modules/activity/queries';
import { listTaskAttachments } from '@/modules/attachments/queries';
import { listChecklistItems } from '@/modules/checklist/queries';
import { listTaskComments } from '@/modules/comments/queries';
import { listTaskDependencies } from '@/modules/dependencies/queries';
import {
  listAssignableMembers,
  listDisplayNames,
  requireMembership,
} from '@/modules/members/queries';
import { isTaskMuted } from '@/modules/notifications/queries';
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

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Repeats daily',
  weekly: 'Repeats weekly',
  monthly: 'Repeats monthly',
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const membership = await requireMembership();

  const [
    { data: task },
    { data: assignments },
    { data: activity },
    { data: comments },
    { data: checklistRows },
    dependencies,
    attachments,
    muted,
  ] = await Promise.all([
    getTaskById(taskId),
    listTaskAssignments(taskId),
    listTaskActivity(taskId),
    listTaskComments(taskId),
    listChecklistItems(taskId),
    listTaskDependencies(taskId),
    listTaskAttachments(taskId),
    isTaskMuted(taskId),
  ]);

  if (!task) {
    notFound();
  }

  const assignmentRows = assignments ?? [];
  const activityRows = activity ?? [];
  const commentRows = comments ?? [];
  const checklistItems = (checklistRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    isDone: row.is_done,
  }));
  const myAssignment = assignmentRows.find(
    (row) => row.assignee_id === membership.userId,
  );

  const orgMembers = await listAssignableMembers();
  const activeMembers = orgMembers.filter(
    (member) => member.status === 'active',
  );
  const availableEmployees = activeMembers.filter(
    (member) =>
      member.role === 'employee' &&
      !assignmentRows.some((row) => row.assignee_id === member.userId),
  );

  const displayNames = await listDisplayNames([
    ...assignmentRows.map((row) => row.assignee_id),
    ...activityRows
      .map((row) => row.actor_id)
      .filter((id): id is string => Boolean(id)),
    ...commentRows.map((row) => row.author_id),
  ]);

  const commentsWithAuthor: TaskCommentRow[] = commentRows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorName: displayNames.get(row.author_id) ?? 'Unknown',
    body: row.body,
    createdAt: row.created_at,
  }));

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
  const isBlocked = dependencies.some((dependency) => !dependency.isSatisfied);

  return (
    <section aria-labelledby="task-heading" className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            href={membership.role === 'admin' ? '/tasks' : '/my-tasks'}
          >
            ← Back to {membership.role === 'admin' ? 'All Tasks' : 'My Tasks'}
          </Link>
          <div className="flex items-center gap-2">
            <MuteTaskButton initialMuted={muted} taskId={task.id} />
            {membership.role === 'admin' ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/tasks/${task.id}/edit`}>
                  <SquarePen aria-hidden />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground"
          id="task-heading"
        >
          {task.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge>{PRIORITY_LABELS[task.priority]} priority</Badge>
          {task.recurrence !== 'none' ? (
            <Badge variant="secondary">
              <Repeat aria-hidden className="size-3" />
              {RECURRENCE_LABELS[task.recurrence]}
            </Badge>
          ) : null}
          {isBlocked ? <Badge variant="destructive">Blocked</Badge> : null}
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
            {isBlocked && myAssignment.status !== 'completed' ? (
              <p className="mt-2 text-xs font-semibold text-amber-400">
                This task is blocked by an incomplete dependency — it can&apos;t
                be marked complete yet.
              </p>
            ) : null}
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
          <CardTitle>Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskChecklist items={checklistItems} taskId={task.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dependencies</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskDependencies dependencies={dependencies} taskId={task.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskAttachments attachments={attachments} taskId={task.id} />
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

      <Card>
        <CardHeader>
          <CardTitle>Comments ({commentsWithAuthor.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskComments
            canModerate={membership.role === 'admin'}
            comments={commentsWithAuthor}
            currentUserId={membership.userId}
            members={activeMembers.map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
            }))}
            taskId={task.id}
          />
        </CardContent>
      </Card>
    </section>
  );
}
