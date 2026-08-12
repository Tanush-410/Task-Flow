import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  requireMembership: vi.fn(),
  revalidatePath: vi.fn(),
  getWorkItemDescendantCount: vi.fn(),
  listValidParentCandidates: vi.fn(),
  listPlanningTeams: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  requireMembership: mocks.requireMembership,
}));
vi.mock('@/modules/backlog/queries', () => ({
  getWorkItemDescendantCount: mocks.getWorkItemDescendantCount,
  listValidParentCandidates: mocks.listValidParentCandidates,
}));
vi.mock('@/modules/planning-teams/queries', () => ({
  listPlanningTeams: mocks.listPlanningTeams,
}));

import {
  createWorkItem,
  fetchWorkItemMoveOptions,
  moveWorkItem,
  rankBacklogItem,
  updateWorkItemPlanningFields,
} from '@/modules/backlog/actions';

type QueryResult = { data?: unknown; error?: unknown };

function query(result: QueryResult = { data: null, error: null }) {
  const builder = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  for (const method of ['eq', 'select', 'update'] as const) {
    builder[method].mockReturnValue(builder);
  }
  builder.single.mockResolvedValue(result);
  return builder;
}

const membership = {
  organizationId: '10000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  role: 'employee' as const,
};

const planningTeamId = '20000000-0000-0000-0000-000000000001';
const taskId = '30000000-0000-0000-0000-000000000001';
const parentTaskId = '30000000-0000-0000-0000-000000000002';
const beforeTaskId = '30000000-0000-0000-0000-000000000003';
const afterTaskId = '30000000-0000-0000-0000-000000000004';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMembership.mockResolvedValue(membership);
});

describe('createWorkItem', () => {
  it('rejects invalid input before any database call', async () => {
    const result = await createWorkItem({ type: 'epic' });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_WORK_ITEM' },
    });
    expect(mocks.requireMembership).not.toHaveBeenCalled();
  });

  it('creates a work item and revalidates planning', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: taskId, error: null });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    const result = await createWorkItem({
      planningTeamId,
      type: 'epic',
      title: 'Ship the thing',
    });

    expect(result).toEqual({ ok: true, data: { workItemId: taskId } });
    // Optional fields (parent, estimates) are omitted rather than sent as
    // explicit null: the generated RPC arg types mark them optional, not
    // nullable, since the SQL parameters use `default null`.
    expect(rpc).toHaveBeenCalledWith('create_work_item', {
      target_planning_team_id: planningTeamId,
      item_type: 'epic',
      item_title: 'Ship the thing',
      item_description: '',
      item_priority: 'medium',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planning', 'layout');
  });

  it('maps a forbidden RPC error to a safe forbidden code', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: '42501' } });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    const result = await createWorkItem({
      planningTeamId,
      type: 'epic',
      title: 'Ship the thing',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'WORK_ITEM_FORBIDDEN' },
    });
  });

  it('does not leak database error details', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'sensitive detail' },
    });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    const result = await createWorkItem({
      planningTeamId,
      type: 'epic',
      title: 'Ship the thing',
    });

    expect(JSON.stringify(result)).not.toContain('sensitive');
  });
});

describe('updateWorkItemPlanningFields', () => {
  it('rejects an empty patch before any database call', async () => {
    const result = await updateWorkItemPlanningFields({ taskId });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_WORK_ITEM' },
    });
    expect(mocks.requireMembership).not.toHaveBeenCalled();
  });

  it('updates ordinary fields with a plain table update, not the hours RPC', async () => {
    const rpc = vi.fn();
    const update = query({ data: { id: taskId }, error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => update),
      rpc,
    });

    const result = await updateWorkItemPlanningFields({
      taskId,
      title: 'Renamed',
      storyPoints: 5,
    });

    expect(result).toEqual({ ok: true, data: { taskId } });
    expect(update.update).toHaveBeenCalledWith({
      title: 'Renamed',
      story_points: 5,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('dispatches an hour re-estimate to the RPC instead of a plain update', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const from = vi.fn();
    mocks.createServerSupabase.mockResolvedValue({ from, rpc });

    const result = await updateWorkItemPlanningFields({
      taskId,
      originalHours: 8,
      remainingHours: 6,
    });

    expect(result).toEqual({ ok: true, data: { taskId } });
    expect(rpc).toHaveBeenCalledWith('reestimate_work_item_hours', {
      target_task_id: taskId,
      new_original_hours: 8,
      new_remaining_hours: 6,
    });
    expect(from).not.toHaveBeenCalled();
  });
});

describe('moveWorkItem', () => {
  it('calls move_work_item and maps a descendant-count rejection to a field error', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: '23514' } });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    const result = await moveWorkItem({
      taskId,
      newParentTaskId: null,
      newPlanningTeamId: planningTeamId,
    });

    expect(rpc).toHaveBeenCalledWith('move_work_item', {
      target_task_id: taskId,
      new_planning_team_id: planningTeamId,
      include_descendants: false,
    });
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_WORK_ITEM',
        fields: { includeDescendants: expect.any(Array) },
      },
    });
  });

  it('succeeds and revalidates planning', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    const result = await moveWorkItem({
      taskId,
      newParentTaskId: parentTaskId,
      newPlanningTeamId: planningTeamId,
      includeDescendants: true,
    });

    expect(result).toEqual({ ok: true, data: { movedCount: 3 } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planning', 'layout');
  });
});

describe('rankBacklogItem', () => {
  it('assigns a rank in one RPC call on the happy path', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'M', error: null });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    const result = await rankBacklogItem({ taskId, beforeTaskId, afterTaskId });

    expect(result).toEqual({ ok: true, data: { rank: 'M' } });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('rebalances and retries exactly once after a rank precision conflict', async () => {
    const rpc = vi.fn();
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: '22023' } }) // first assign attempt
      .mockResolvedValueOnce({ data: 5, error: null }) // rebalance
      .mockResolvedValueOnce({ data: 'V', error: null }); // retry assign
    const scopeRow = query({
      data: {
        planning_team_id: planningTeamId,
        parent_task_id: null,
        work_item_type: 'epic',
      },
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      rpc,
      from: vi.fn(() => scopeRow),
    });

    const result = await rankBacklogItem({ taskId, beforeTaskId, afterTaskId });

    expect(result).toEqual({ ok: true, data: { rank: 'V' } });
    const assignCalls = rpc.mock.calls.filter(
      ([name]) => name === 'assign_backlog_rank',
    );
    expect(assignCalls).toHaveLength(2);
    expect(rpc).toHaveBeenCalledWith('rebalance_backlog_siblings', {
      target_team_id: planningTeamId,
      target_work_item_type: 'epic',
    });
  });

  it('returns a safe conflict error when the retry also fails, without looping', async () => {
    const rpc = vi.fn();
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } })
      .mockResolvedValueOnce({ data: 5, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    const scopeRow = query({
      data: {
        planning_team_id: planningTeamId,
        parent_task_id: null,
        work_item_type: 'epic',
      },
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      rpc,
      from: vi.fn(() => scopeRow),
    });

    const result = await rankBacklogItem({ taskId, beforeTaskId, afterTaskId });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RANK_CONFLICT' },
    });
    const assignCalls = rpc.mock.calls.filter(
      ([name]) => name === 'assign_backlog_rank',
    );
    expect(assignCalls).toHaveLength(2);
  });
});

describe('fetchWorkItemMoveOptions', () => {
  it('returns valid parent candidates for a non-epic type', async () => {
    mocks.getWorkItemDescendantCount.mockResolvedValue(3);
    mocks.listValidParentCandidates.mockResolvedValue([
      {
        id: 'epic-1',
        title: 'Ship the thing',
        planningTeamId: planningTeamId,
        planningTeamName: 'Platform',
      },
    ]);

    const result = await fetchWorkItemMoveOptions(taskId, 'feature');

    expect(mocks.listValidParentCandidates).toHaveBeenCalledWith('feature');
    expect(mocks.listPlanningTeams).not.toHaveBeenCalled();
    expect(result).toEqual({
      descendantCount: 3,
      candidates: [
        {
          id: 'epic-1',
          title: 'Ship the thing',
          planningTeamId,
          planningTeamName: 'Platform',
        },
      ],
    });
  });

  it('returns visible non-archived teams as candidates for an epic', async () => {
    mocks.getWorkItemDescendantCount.mockResolvedValue(0);
    mocks.listPlanningTeams.mockResolvedValue([
      { id: 'team-1', name: 'Platform', isArchived: false },
      { id: 'team-2', name: 'Retired team', isArchived: true },
    ]);

    const result = await fetchWorkItemMoveOptions(taskId, 'epic');

    expect(mocks.listValidParentCandidates).not.toHaveBeenCalled();
    expect(result).toEqual({
      descendantCount: 0,
      candidates: [
        {
          id: 'team-1',
          title: 'Platform',
          planningTeamId: 'team-1',
          planningTeamName: 'Platform',
        },
      ],
    });
  });
});
