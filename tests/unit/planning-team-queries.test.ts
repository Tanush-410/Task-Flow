import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`REDIRECT:${location}`);
  }),
  requireMembership: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

vi.mock('@/modules/members/queries', () => ({
  requireMembership: mocks.requireMembership,
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import {
  getPlanningTeam,
  listPlanningTeamCandidates,
  listPlanningTeams,
  requirePlanningTeamAccess,
} from '@/modules/planning-teams/queries';

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

const membership = {
  organizationId: '10000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  role: 'employee' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMembership.mockResolvedValue(membership);
});

describe('planning team queries', () => {
  it('lists only current-organization active teams with bounded summaries', async () => {
    const teams = query({
      data: [
        {
          id: 'team-1',
          name: 'Platform',
          description: 'Core delivery',
          default_sprint_length_days: 14,
          is_archived: false,
        },
      ],
      error: null,
    });
    const members = query({
      data: [
        {
          planning_team_id: 'team-1',
          user_id: membership.userId,
          planning_role: 'planner',
        },
        {
          planning_team_id: 'team-1',
          user_id: 'another-user',
          planning_role: 'member',
        },
      ],
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'planning_teams' ? teams : members,
      ),
    });

    await expect(listPlanningTeams()).resolves.toEqual([
      {
        id: 'team-1',
        name: 'Platform',
        description: 'Core delivery',
        defaultSprintLengthDays: 14,
        isArchived: false,
        memberCount: 2,
        currentUserRole: 'planner',
      },
    ]);
    expect(teams.eq).toHaveBeenCalledWith(
      'organization_id',
      membership.organizationId,
    );
    expect(teams.eq).toHaveBeenCalledWith('is_archived', false);
    expect(members.eq).toHaveBeenCalledWith(
      'organization_id',
      membership.organizationId,
    );
  });

  it('can include archived teams explicitly', async () => {
    const teams = query({ data: [], error: null });
    const members = query({ data: [], error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'planning_teams' ? teams : members,
      ),
    });

    await listPlanningTeams({ includeArchived: true });

    expect(teams.eq).not.toHaveBeenCalledWith('is_archived', false);
  });

  it('returns null when a team is missing or hidden', async () => {
    const team = query({ data: null, error: null });
    mocks.createServerSupabase.mockResolvedValue({ from: vi.fn(() => team) });

    await expect(getPlanningTeam('team-1')).resolves.toBeNull();
  });

  it('redirects to planning when required team access is absent', async () => {
    const team = query({ data: null, error: null });
    mocks.createServerSupabase.mockResolvedValue({ from: vi.fn(() => team) });

    await expect(requirePlanningTeamAccess('team-1')).rejects.toThrow(
      'REDIRECT:/planning',
    );
  });

  it('returns active organization candidates after verifying planner access', async () => {
    mocks.requireMembership.mockResolvedValue({ ...membership, role: 'admin' });
    const team = query({
      data: {
        id: 'team-1',
        name: 'Platform',
        description: '',
        default_sprint_length_days: 14,
        is_archived: false,
      },
      error: null,
    });
    const teamMembers = query({
      data: [
        {
          planning_team_id: 'team-1',
          user_id: membership.userId,
          planning_role: 'member',
          default_capacity_hours_per_day: 8,
        },
      ],
      error: null,
    });
    const profiles = query({
      data: [
        { id: membership.userId, display_name: 'Eshan Employee' },
        { id: 'admin-user', display_name: 'Asha Admin' },
      ],
      error: null,
    });
    const organizationMembers = query({
      data: [{ user_id: membership.userId }, { user_id: 'admin-user' }],
      error: null,
    });
    let planningMemberCalls = 0;
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'planning_teams') return team;
        if (table === 'profiles') return profiles;
        if (table === 'organization_memberships') return organizationMembers;
        planningMemberCalls += 1;
        return teamMembers;
      }),
    });

    await expect(listPlanningTeamCandidates('team-1')).resolves.toEqual([
      {
        userId: membership.userId,
        displayName: 'Eshan Employee',
        planningRole: 'member',
        defaultCapacityHoursPerDay: 8,
      },
      {
        userId: 'admin-user',
        displayName: 'Asha Admin',
        planningRole: null,
        defaultCapacityHoursPerDay: null,
      },
    ]);
    expect(organizationMembers.eq).toHaveBeenCalledWith(
      'organization_id',
      membership.organizationId,
    );
    expect(organizationMembers.eq).toHaveBeenCalledWith('status', 'active');
    expect(planningMemberCalls).toBeGreaterThan(0);
  });
});
