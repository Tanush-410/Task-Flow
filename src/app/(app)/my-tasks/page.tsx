import { TaskAssignmentGroup } from '@/components/task-assignment-group';
import {
  listMyAssignmentsWithTasks,
  type MyAssignmentWithTask,
} from '@/modules/assignments/queries';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function MyTasksPage() {
  const rows = await listMyAssignmentsWithTasks();
  const now = new Date();

  const overdue: MyAssignmentWithTask[] = [];
  const dueToday: MyAssignmentWithTask[] = [];
  const upcoming: MyAssignmentWithTask[] = [];
  const completed: MyAssignmentWithTask[] = [];

  for (const row of rows) {
    if (row.assignment.status === 'completed') {
      completed.push(row);
      continue;
    }

    const dueAt = row.task.due_at ? new Date(row.task.due_at) : null;

    if (dueAt && dueAt < now) {
      overdue.push(row);
    } else if (dueAt && isSameDay(dueAt, now)) {
      dueToday.push(row);
    } else {
      upcoming.push(row);
    }
  }

  return (
    <section aria-labelledby="my-tasks-heading" className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">Assigned to you</p>
        <h1
          className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
          id="my-tasks-heading"
        >
          My Tasks
        </h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-base text-slate-600">
          No tasks are assigned to you yet.
        </p>
      ) : (
        <>
          <TaskAssignmentGroup rows={overdue} title="Overdue" />
          <TaskAssignmentGroup rows={dueToday} title="Due today" />
          <TaskAssignmentGroup rows={upcoming} title="Upcoming" />
          <TaskAssignmentGroup rows={completed} title="Completed" />
        </>
      )}
    </section>
  );
}
