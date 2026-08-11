import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  requireAdmin: vi.fn(),
  requireMembership: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
  requireMembership: mocks.requireMembership,
}));

import {
  archivePlanningTeam,
  createPlanningTeam,
  setPlanningTeamMembers,
  updatePlanningTeam,
} from '@/modules/planning-teams/actions';

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

function query(result: QueryResult = { data: null, error: null }) {
  const builder = {
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    not: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
    update: vi.fn(),
    upsert: vi.fn(),
  };

  for (const method of [
    'delete',
    'eq',
    'in',
    'insert',
    'not',
    'select',
    'update',
    'upsert',
  ] as const) {
    builder[method].mockReturnValue(builder);
  }
  builder.single.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

const admin = {
  organizationId: '10000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000001',
  role: 'admin' as const,
};
const employee = {
  ...admin,
  userId: '00000000-0000-0000-0000-000000000002',
  role: 'employee' as const,
};
const teamId = '40000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(admin);
  mocks.requireMembership.mockResolvedValue(admin);
});

describe('planning team actions', () => {
  it('rejects invalid input before authorization or database access', async () => {
    await expect(createPlanningTeam({ name: '' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_PLANNING_TEAM' },
    });
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it('creates an organization-owned team as an admin', async () => {
    const teams = query({ data: { id: teamId }, error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => teams),
    });

    await expect(
      createPlanningTeam({
        name: ' Platform ',
        description: ' Delivery ',
        defaultSprintLengthDays: 14,
      }),
    ).resolves.toEqual({ ok: true, data: { teamId } });
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(teams.insert).toHaveBeenCalledWith({
      organization_id: admin.organizationId,
      created_by: admin.userId,
      name: 'Platform',
      description: 'Delivery',
      default_sprint_length_days: 14,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planning', 'layout');
  });

  it('requires planner authorization and organization ownership to update', async () => {
    mocks.requireMembership.mockResolvedValue(employee);
    const lookup = query({
      data: { organization_id: employee.organizationId },
      error: null,
    });
    const update = query({ data: { id: teamId }, error: null });
    let teamCalls = 0;
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => (teamCalls++ === 0 ? lookup : update)),
      rpc,
    });

    await expect(
      updatePlanningTeam({
        teamId,
        name: 'Platform',
        description: '',
        defaultSprintLengthDays: 21,
      }),
    ).resolves.toEqual({ ok: true, data: { teamId } });
    expect(rpc).toHaveBeenCalledWith('is_planning_team_planner', {
      target_team_id: teamId,
    });
    expect(update.update).toHaveBeenCalledWith({
      name: 'Platform',
      description: '',
      default_sprint_length_days: 21,
    });
    expect(update.eq).toHaveBeenCalledWith(
      'organization_id',
      employee.organizationId,
    );
  });

  it('replaces the complete roster through one transactional RPC', async () => {
    const firstUserId = employee.userId;
    const secondUserId = '00000000-0000-0000-0000-000000000003';
    const lookup = query({
      data: { organization_id: admin.organizationId },
      error: null,
    });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => lookup),
      rpc,
    });

    await expect(
      setPlanningTeamMembers({
        teamId,
        members: [
          { userId: firstUserId, role: 'member', capacityHoursPerDay: 8 },
          { userId: secondUserId, role: 'planner', capacityHoursPerDay: 6 },
        ],
      }),
    ).resolves.toEqual({ ok: true, data: { teamId } });
    expect(rpc).toHaveBeenNthCalledWith(2, 'replace_planning_team_members', {
      target_team_id: teamId,
      replacement_members: [
        {
          user_id: firstUserId,
          planning_role: 'member',
          default_capacity_hours_per_day: 8,
        },
        {
          user_id: secondUserId,
          planning_role: 'planner',
          default_capacity_hours_per_day: 6,
        },
      ],
    });
  });

  it('allows a member to update only their own capacity', async () => {
    mocks.requireMembership.mockResolvedValue(employee);
    const lookup = query({
      data: { organization_id: employee.organizationId },
      error: null,
    });
    const update = query({ data: null, error: null });
    const tableQueries = [lookup, update];
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => tableQueries.shift()),
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    });

    await expect(
      setPlanningTeamMembers({
        teamId,
        members: [
          {
            userId: employee.userId,
            role: 'member',
            capacityHoursPerDay: 6.5,
          },
        ],
      }),
    ).resolves.toEqual({ ok: true, data: { teamId } });
    expect(update.update).toHaveBeenCalledWith({
      default_capacity_hours_per_day: 6.5,
    });
    expect(update.eq).toHaveBeenCalledWith('user_id', employee.userId);
  });

  it('forbids a member from changing their own role', async () => {
    mocks.requireMembership.mockResolvedValue(employee);
    const lookup = query({
      data: { organization_id: employee.organizationId },
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => lookup),
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    });

    await expect(
      setPlanningTeamMembers({
        teamId,
        members: [
          {
            userId: employee.userId,
            role: 'planner',
            capacityHoursPerDay: 8,
          },
        ],
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'PLANNING_TEAM_FORBIDDEN' },
    });
  });

  it('archives through the hardened RPC as an organization admin', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createServerSupabase.mockResolvedValue({ rpc });

    await expect(archivePlanningTeam({ teamId })).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('archive_planning_team', {
      target_team_id: teamId,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planning', 'layout');
  });

  it('maps conflicts without leaking database messages', async () => {
    const teams = query({
      data: null,
      error: { code: '23505', message: 'sensitive database detail' },
    });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => teams),
    });

    const result = await createPlanningTeam({
      name: 'Platform',
      description: '',
      defaultSprintLengthDays: 14,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PLANNING_TEAM_CONFLICT',
        message: 'A planning team with that name already exists.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive database detail');
  });
});
