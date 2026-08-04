import 'server-only';

import { isOnTimeByDate } from '@/lib/calendar-dates';
import { createServerSupabase } from '@/lib/supabase/server';

import {
  listOrganizationMembers,
  requireAdmin,
  requireMembership,
} from '../members/queries';

export type EmployeeCompletionStat = {
  userId: string;
  displayName: string;
  completedCount: number;
  onTimeCount: number;
  onTimePercentage: number;
};

export async function getEmployeeCompletionReport(): Promise<
  EmployeeCompletionStat[]
> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: assignments }, members] = await Promise.all([
    supabase
      .from('task_assignments')
      .select('assignee_id,status,completed_at,task_id')
      .eq('organization_id', membership.organizationId)
      .eq('status', 'completed'),
    listOrganizationMembers(),
  ]);

  const completedRows = assignments ?? [];
  const taskIds = Array.from(new Set(completedRows.map((row) => row.task_id)));
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id,due_at')
    .in('id', taskIds);
  const dueAtByTaskId = new Map(
    (tasks ?? []).map((task) => [task.id, task.due_at]),
  );

  const statsByUser = new Map<string, { completed: number; onTime: number }>();

  for (const row of completedRows) {
    const stat = statsByUser.get(row.assignee_id) ?? {
      completed: 0,
      onTime: 0,
    };
    stat.completed += 1;

    const dueAt = dueAtByTaskId.get(row.task_id);
    if (
      !dueAt ||
      (row.completed_at && isOnTimeByDate(row.completed_at, dueAt))
    ) {
      stat.onTime += 1;
    }

    statsByUser.set(row.assignee_id, stat);
  }

  return members
    .filter((member) => member.role === 'employee')
    .map((member) => {
      const stat = statsByUser.get(member.userId) ?? {
        completed: 0,
        onTime: 0,
      };

      return {
        userId: member.userId,
        displayName: member.displayName,
        completedCount: stat.completed,
        onTimeCount: stat.onTime,
        onTimePercentage:
          stat.completed === 0
            ? 0
            : Math.round((stat.onTime / stat.completed) * 100),
      };
    })
    .sort((a, b) => b.completedCount - a.completedCount);
}

export type EmployeeWorkload = {
  userId: string;
  displayName: string;
  activeCount: number;
  overdueCount: number;
};

/** Active (non-completed) assignment load per employee, busiest first. */
export async function getEmployeeWorkload(): Promise<EmployeeWorkload[]> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: assignments }, members] = await Promise.all([
    supabase
      .from('task_assignments')
      .select('assignee_id,status,task_id')
      .eq('organization_id', membership.organizationId)
      .neq('status', 'completed'),
    listOrganizationMembers(),
  ]);

  const activeRows = assignments ?? [];
  const taskIds = Array.from(new Set(activeRows.map((row) => row.task_id)));
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id,due_at')
    .in('id', taskIds);
  const dueAtByTaskId = new Map(
    (tasks ?? []).map((task) => [task.id, task.due_at]),
  );

  const now = new Date();
  const statsByUser = new Map<string, { active: number; overdue: number }>();

  for (const row of activeRows) {
    const stat = statsByUser.get(row.assignee_id) ?? { active: 0, overdue: 0 };
    stat.active += 1;

    const dueAt = dueAtByTaskId.get(row.task_id);
    if (dueAt && new Date(dueAt) < now) {
      stat.overdue += 1;
    }

    statsByUser.set(row.assignee_id, stat);
  }

  return members
    .filter((member) => member.role === 'employee')
    .map((member) => {
      const stat = statsByUser.get(member.userId) ?? { active: 0, overdue: 0 };

      return {
        userId: member.userId,
        displayName: member.displayName,
        activeCount: stat.active,
        overdueCount: stat.overdue,
      };
    })
    .sort((a, b) => b.activeCount - a.activeCount);
}

export type EmployeeTaskBreakdown = {
  userId: string;
  displayName: string;
  completedOnTimeCount: number;
  completedLateCount: number;
  missedCount: number;
  activeCount: number;
  totalCount: number;
  missedTasks: { id: string; title: string; dueAt: string }[];
  recentlyCompleted: { id: string; title: string; completedAt: string }[];
};

/**
 * Completed vs. missed vs. still-active, for one employee. Scoped to the
 * caller's own organization by construction: assignee_id + organization_id
 * together only ever match rows for someone actually in that org, so an
 * admin can't be handed another organization's data by passing an
 * arbitrary id, and the route (not this query) decides who's allowed to
 * ask for which target — /employees/[userId] (admin-only) or /my-progress
 * (always the caller's own id).
 */
export async function getEmployeeTaskBreakdown(
  targetUserId: string,
): Promise<EmployeeTaskBreakdown | null> {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  const [{ data: profile }, { data: assignments }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', targetUserId)
      .maybeSingle(),
    supabase
      .from('task_assignments')
      .select('id,status,completed_at,task_id')
      .eq('organization_id', membership.organizationId)
      .eq('assignee_id', targetUserId),
  ]);

  if (!profile) {
    return null;
  }

  const rows = assignments ?? [];
  const taskIds = Array.from(new Set(rows.map((row) => row.task_id)));
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id,title,due_at')
    .in('id', taskIds);
  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));

  const now = new Date();
  let completedOnTimeCount = 0;
  let completedLateCount = 0;
  let missedCount = 0;
  let activeCount = 0;
  const missedTasks: EmployeeTaskBreakdown['missedTasks'] = [];
  const recentlyCompleted: EmployeeTaskBreakdown['recentlyCompleted'] = [];

  for (const row of rows) {
    const task = taskById.get(row.task_id);
    const dueAt = task?.due_at ?? null;

    if (row.status === 'completed') {
      const onTime =
        !dueAt || (row.completed_at && isOnTimeByDate(row.completed_at, dueAt));
      if (onTime) {
        completedOnTimeCount += 1;
      } else {
        completedLateCount += 1;
      }
      if (task && row.completed_at) {
        recentlyCompleted.push({
          id: task.id,
          title: task.title,
          completedAt: row.completed_at,
        });
      }
      continue;
    }

    if (dueAt && new Date(dueAt) < now) {
      missedCount += 1;
      if (task) {
        missedTasks.push({ id: task.id, title: task.title, dueAt });
      }
    } else {
      activeCount += 1;
    }
  }

  missedTasks.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
  recentlyCompleted.sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  return {
    userId: targetUserId,
    displayName: profile.display_name,
    completedOnTimeCount,
    completedLateCount,
    missedCount,
    activeCount,
    totalCount: rows.length,
    missedTasks: missedTasks.slice(0, 10),
    recentlyCompleted: recentlyCompleted.slice(0, 5),
  };
}

export type EmployeeProductivity = {
  userId: string;
  displayName: string;
  completedCount: number;
  /** Average time from assignment to completion, in hours. */
  averageHoursToComplete: number | null;
};

/**
 * "Most productive" = fastest average turnaround from being assigned a
 * task to completing it, not raw completed count — someone who finishes
 * fewer tasks but much faster still ranks ahead of someone slower with
 * more. Employees with zero completions sort last (nothing to measure).
 */
export async function getEmployeeProductivity(): Promise<
  EmployeeProductivity[]
> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: assignments }, members] = await Promise.all([
    supabase
      .from('task_assignments')
      .select('assignee_id,created_at,completed_at')
      .eq('organization_id', membership.organizationId)
      .eq('status', 'completed'),
    listOrganizationMembers(),
  ]);

  const statsByUser = new Map<
    string,
    { completed: number; totalHours: number; measured: number }
  >();

  for (const row of assignments ?? []) {
    const stat = statsByUser.get(row.assignee_id) ?? {
      completed: 0,
      totalHours: 0,
      measured: 0,
    };
    stat.completed += 1;

    if (row.completed_at) {
      const hours =
        (new Date(row.completed_at).getTime() -
          new Date(row.created_at).getTime()) /
        (1000 * 60 * 60);
      if (hours >= 0) {
        stat.totalHours += hours;
        stat.measured += 1;
      }
    }

    statsByUser.set(row.assignee_id, stat);
  }

  return members
    .filter((member) => member.role === 'employee')
    .map((member) => {
      const stat = statsByUser.get(member.userId) ?? {
        completed: 0,
        totalHours: 0,
        measured: 0,
      };

      return {
        userId: member.userId,
        displayName: member.displayName,
        completedCount: stat.completed,
        averageHoursToComplete:
          stat.measured === 0 ? null : stat.totalHours / stat.measured,
      };
    })
    .sort((a, b) => {
      if (a.averageHoursToComplete === null) return 1;
      if (b.averageHoursToComplete === null) return -1;
      return a.averageHoursToComplete - b.averageHoursToComplete;
    });
}

export type CurrentWorkTask = {
  assignmentId: string;
  taskId: string;
  title: string;
  priority: string;
  dueAt: string | null;
  progress: number;
  startedAt: string | null;
};

export type EmployeeCurrentWork = {
  userId: string;
  displayName: string;
  tasks: CurrentWorkTask[];
};

/** What every employee is actively working on right now (status = in_progress). */
export async function listCurrentWorkByEmployee(): Promise<
  EmployeeCurrentWork[]
> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: assignments }, members] = await Promise.all([
    supabase
      .from('task_assignments')
      .select('id,assignee_id,task_id,progress,started_at')
      .eq('organization_id', membership.organizationId)
      .eq('status', 'in_progress'),
    listOrganizationMembers(),
  ]);

  const rows = assignments ?? [];
  const taskIds = Array.from(new Set(rows.map((row) => row.task_id)));
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id,title,priority,due_at')
    .in('id', taskIds);
  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));

  const tasksByUser = new Map<string, CurrentWorkTask[]>();
  for (const row of rows) {
    const task = taskById.get(row.task_id);
    if (!task) continue;

    const list = tasksByUser.get(row.assignee_id) ?? [];
    list.push({
      assignmentId: row.id,
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      dueAt: task.due_at,
      progress: row.progress,
      startedAt: row.started_at,
    });
    tasksByUser.set(row.assignee_id, list);
  }

  return members
    .filter((member) => member.role === 'employee')
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      tasks: (tasksByUser.get(member.userId) ?? []).sort((a, b) => {
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }),
    }))
    .sort((a, b) => b.tasks.length - a.tasks.length);
}
