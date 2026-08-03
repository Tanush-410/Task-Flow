import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AssignmentControls } from '@/components/assignment-controls';
import { ReopenAssignmentForm } from '@/components/reopen-assignment-form';
import { listTaskActivity } from '@/modules/activity/queries';
import { listDisplayNames, requireMembership } from '@/modules/members/queries';
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

const cardClassName =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]';

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
    <section aria-labelledby="task-heading" className="space-y-8">
      <div>
        <Link
          className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          href={membership.role === 'admin' ? '/tasks' : '/my-tasks'}
        >
          ← Back to {membership.role === 'admin' ? 'All Tasks' : 'My Tasks'}
        </Link>

        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
          id="task-heading"
        >
          {task.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase">
            {PRIORITY_LABELS[task.priority]} priority
          </span>
          {dueDate ? (
            <span className={overdue ? 'font-semibold text-red-700' : ''}>
              {overdue ? 'Overdue · ' : 'Due '}
              {dueDate.toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-400">No due date</span>
          )}
        </p>

        {task.description ? (
          <p className="mt-4 max-w-3xl leading-7 whitespace-pre-wrap text-slate-700">
            {task.description}
          </p>
        ) : null}
      </div>

      {myAssignment ? (
        <div className={cardClassName}>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
            Your assignment
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Status: {STATUS_LABELS[myAssignment.status]} · Progress:{' '}
            {myAssignment.progress}%
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
        </div>
      ) : null}

      {membership.role === 'admin' ? (
        <div className={cardClassName}>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
            Assignees (
            {assignmentRows.filter((row) => row.status === 'completed').length}{' '}
            of {assignmentRows.length} completed)
          </h2>
          {assignmentRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No one is assigned to this task yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200">
              {assignmentRows.map((row) => {
                const rowOverdue = isPastDue && row.status !== 'completed';

                return (
                  <li className="py-3" key={row.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {displayNames.get(row.assignee_id) ?? 'Unknown'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {STATUS_LABELS[row.status]} · {row.progress}%
                          {rowOverdue ? ' · Overdue' : ''}
                        </p>
                        {row.status === 'delayed' && row.delay_reason ? (
                          <p className="mt-1 text-xs text-red-700">
                            Delay reason: {row.delay_reason}
                          </p>
                        ) : null}
                      </div>
                      {row.status === 'completed' ? (
                        <ReopenAssignmentForm assignmentId={row.id} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className={cardClassName}>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Activity
        </h2>
        {activityRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {activityRows.map((event) => (
              <li className="text-sm text-slate-600" key={event.id}>
                <span className="font-semibold text-slate-950">
                  {event.actor_id
                    ? (displayNames.get(event.actor_id) ?? 'Someone')
                    : 'System'}
                </span>{' '}
                — {event.summary} ·{' '}
                <span className="text-slate-400">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
