import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  requireMembership: vi.fn(),
  requirePlanningTeamAccess: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  requireMembership: mocks.requireMembership,
}));
vi.mock('@/modules/planning-teams/queries', () => ({
  requirePlanningTeamAccess: mocks.requirePlanningTeamAccess,
}));

import {
  getWorkItemDescendantCount,
  listBacklogHierarchy,
  listValidParentCandidates,
} from '@/modules/backlog/queries';

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return builder;
}

const membership = {
  organizationId: '10000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  role: 'employee' as const,
};

const teamId = '20000000-0000-0000-0000-000000000001';
const epicId = '30000000-0000-0000-0000-000000000001';
const featureId = '30000000-0000-0000-0000-000000000002';
const storyId = '30000000-0000-0000-0000-000000000003';
const taskRowId = '30000000-0000-0000-0000-000000000004';
const userId = '00000000-0000-0000-0000-000000000002';

const taskRows = [
  {
    id: epicId,
    parent_task_id: null,
    work_item_type: 'epic',
    title: 'Ship the thing',
    priority: 'medium',
    story_points: 8,
    original_hours: null,
    remaining_hours: null,
    backlog_rank: 'A',
  },
  {
    id: featureId,
    parent_task_id: epicId,
    work_item_type: 'feature',
    title: 'Onboarding flow',
    priority: 'medium',
    story_points: 5,
    original_hours: null,
    remaining_hours: null,
    backlog_rank: 'B',
  },
  {
    id: storyId,
    parent_task_id: featureId,
    work_item_type: 'user_story',
    title: 'Sign up form',
    priority: 'medium',
    story_points: null,
    original_hours: null,
    remaining_hours: null,
    backlog_rank: 'C',
  },
  {
    id: taskRowId,
    parent_task_id: storyId,
    work_item_type: 'task',
    title: 'Wire up validation',
    priority: 'high',
    story_points: null,
    original_hours: 4,
    remaining_hours: 4,
    backlog_rank: 'D',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlanningTeamAccess.mockResolvedValue({ id: teamId });
  mocks.requireMembership.mockResolvedValue(membership);
});

describe('listBacklogHierarchy', () => {
  it('builds a nested tree from flat rows ordered by rank', async () => {
    const tasksQuery = query({ data: taskRows, error: null });
    const assignmentsQuery = query({
      data: [{ task_id: taskRowId, assignee_id: userId }],
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'tasks' ? tasksQuery : assignmentsQuery,
      ),
    });

    const tree = await listBacklogHierarchy(teamId);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe(epicId);
    expect(tree[0]!.children[0]!.id).toBe(featureId);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe(storyId);
    expect(tree[0]!.children[0]!.children[0]!.children[0]!.assigneeIds).toEqual(
      [userId],
    );
  });

  it('preserves the ancestor chain when a filter matches only a descendant', async () => {
    const tasksQuery = query({ data: taskRows, error: null });
    const assignmentsQuery = query({ data: [], error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'tasks' ? tasksQuery : assignmentsQuery,
      ),
    });

    const tree = await listBacklogHierarchy(teamId, { type: 'task' });

    // The epic itself doesn't match `type: 'task'`, but its descendant
    // does, so the whole ancestor chain down to that descendant remains.
    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe(epicId);
    expect(tree[0]!.children[0]!.children[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.children[0]!.children[0]!.id).toBe(taskRowId);
  });

  it('filters out branches with no matching descendant at all', async () => {
    const tasksQuery = query({ data: taskRows, error: null });
    const assignmentsQuery = query({ data: [], error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'tasks' ? tasksQuery : assignmentsQuery,
      ),
    });

    const tree = await listBacklogHierarchy(teamId, { text: 'no match' });

    expect(tree).toEqual([]);
  });

  it('returns an empty tree when the query fails', async () => {
    const tasksQuery = query({ data: null, error: { message: 'boom' } });
    const assignmentsQuery = query({ data: [], error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'tasks' ? tasksQuery : assignmentsQuery,
      ),
    });

    await expect(listBacklogHierarchy(teamId)).resolves.toEqual([]);
  });

  it('maps bug fields through onto the tree node', async () => {
    const bugId = '30000000-0000-0000-0000-000000000005';
    const tasksQuery = query({
      data: [
        {
          id: bugId,
          parent_task_id: null,
          work_item_type: 'bug',
          title: 'Save button does nothing',
          priority: 'high',
          story_points: 3,
          original_hours: null,
          remaining_hours: null,
          backlog_rank: 'A',
          repro_steps: 'Click Save on an empty form',
          severity: 'high',
          found_in_build: '1.4.0',
        },
      ],
      error: null,
    });
    const assignmentsQuery = query({ data: [], error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'tasks' ? tasksQuery : assignmentsQuery,
      ),
    });

    const tree = await listBacklogHierarchy(teamId);

    expect(tree[0]).toMatchObject({
      reproSteps: 'Click Save on an empty form',
      severity: 'high',
      foundInBuild: '1.4.0',
    });
  });
});

describe('getWorkItemDescendantCount', () => {
  it('returns the RPC result', async () => {
    mocks.createServerSupabase.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: 3, error: null }),
    });

    await expect(getWorkItemDescendantCount(storyId)).resolves.toBe(3);
  });

  it('fails soft to zero when the RPC errors', async () => {
    mocks.createServerSupabase.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
    });

    await expect(getWorkItemDescendantCount(storyId)).resolves.toBe(0);
  });
});

describe('listValidParentCandidates', () => {
  it('returns no candidates for an epic, which never has a parent', async () => {
    await expect(listValidParentCandidates('epic')).resolves.toEqual([]);
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it('returns same-team candidates of the correct parent type', async () => {
    const membershipsQuery = query({
      data: [{ planning_team_id: teamId }],
      error: null,
    });
    const teamsQuery = query({
      data: [{ id: teamId, name: 'Backlog team' }],
      error: null,
    });
    const candidatesQuery = query({
      data: [{ id: epicId, title: 'Ship the thing', planning_team_id: teamId }],
      error: null,
    });
    let call = 0;
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'planning_team_members') return membershipsQuery;
        if (table === 'planning_teams') return teamsQuery;
        call += 1;
        return candidatesQuery;
      }),
    });

    const candidates = await listValidParentCandidates('feature');

    expect(candidates).toEqual([
      {
        id: epicId,
        title: 'Ship the thing',
        planningTeamId: teamId,
        planningTeamName: 'Backlog team',
      },
    ]);
    expect(call).toBeGreaterThan(0);
    expect(candidatesQuery.in).toHaveBeenCalledWith('work_item_type', ['epic']);
  });

  it('returns candidates of either legal parent type for a task', async () => {
    const membershipsQuery = query({
      data: [{ planning_team_id: teamId }],
      error: null,
    });
    const teamsQuery = query({
      data: [{ id: teamId, name: 'Backlog team' }],
      error: null,
    });
    const candidatesQuery = query({
      data: [{ id: storyId, title: 'Sign up form', planning_team_id: teamId }],
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'planning_team_members') return membershipsQuery;
        if (table === 'planning_teams') return teamsQuery;
        return candidatesQuery;
      }),
    });

    await listValidParentCandidates('task');

    expect(candidatesQuery.in).toHaveBeenCalledWith('work_item_type', [
      'user_story',
      'bug',
    ]);
  });

  it('returns feature candidates for a bug, just like a user story', async () => {
    const membershipsQuery = query({
      data: [{ planning_team_id: teamId }],
      error: null,
    });
    const teamsQuery = query({
      data: [{ id: teamId, name: 'Backlog team' }],
      error: null,
    });
    const candidatesQuery = query({
      data: [
        { id: featureId, title: 'Onboarding flow', planning_team_id: teamId },
      ],
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'planning_team_members') return membershipsQuery;
        if (table === 'planning_teams') return teamsQuery;
        return candidatesQuery;
      }),
    });

    const candidates = await listValidParentCandidates('bug');

    expect(candidatesQuery.in).toHaveBeenCalledWith('work_item_type', [
      'feature',
    ]);
    expect(candidates).toEqual([
      {
        id: featureId,
        title: 'Onboarding flow',
        planningTeamId: teamId,
        planningTeamName: 'Backlog team',
      },
    ]);
  });
});
