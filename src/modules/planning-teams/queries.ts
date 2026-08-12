import 'server-only';

import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';
import {
  requireMembership,
  type MembershipContext,
} from '@/modules/members/queries';

export type PlanningTeamRole = 'admin' | 'planner' | 'member';

export type PlanningTeamSummary = {
  id: string;
  name: string;
  description: string;
  defaultSprintLengthDays: number;
  isArchived: boolean;
  memberCount: number;
  currentUserRole: PlanningTeamRole;
};

export type PlanningTeamMember = {
  userId: string;
  displayName: string;
  planningRole: 'planner' | 'member';
  defaultCapacityHoursPerDay: number;
};

export type PlanningTeamDetail = PlanningTeamSummary & {
  members: PlanningTeamMember[];
};

export type PlanningTeamCandidate = {
  userId: string;
  displayName: string;
  planningRole: 'planner' | 'member' | null;
  defaultCapacityHoursPerDay: number | null;
};

export async function listPlanningTeams(
  input: { includeArchived?: boolean } = {},
): Promise<PlanningTeamSummary[]> {
  const membership = await requireMembership();
  return listPlanningTeamsForMembership(membership, input);
}

export async function listPlanningTeamsForMembership(
  membership: MembershipContext,
  input: { includeArchived?: boolean } = {},
): Promise<PlanningTeamSummary[]> {
  const supabase = await createServerSupabase();
  let teamQuery = supabase
    .from('planning_teams')
    .select('id,name,description,default_sprint_length_days,is_archived')
    .eq('organization_id', membership.organizationId);

  if (!input.includeArchived) {
    teamQuery = teamQuery.eq('is_archived', false);
  }

  const [{ data: teams, error: teamsError }, { data: memberRows }] =
    await Promise.all([
      teamQuery.order('created_at', { ascending: true }),
      supabase
        .from('planning_team_members')
        .select('planning_team_id,user_id,planning_role')
        .eq('organization_id', membership.organizationId),
    ]);

  if (teamsError || !teams) return [];

  return teams.map((team) => {
    const teamMembers = (memberRows ?? []).filter(
      (member) => member.planning_team_id === team.id,
    );
    const ownMembership = teamMembers.find(
      (member) => member.user_id === membership.userId,
    );

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      defaultSprintLengthDays: team.default_sprint_length_days,
      isArchived: team.is_archived,
      memberCount: teamMembers.length,
      currentUserRole:
        membership.role === 'admin'
          ? 'admin'
          : (ownMembership?.planning_role ?? 'member'),
    };
  });
}

export async function getPlanningTeam(
  teamId: string,
): Promise<PlanningTeamDetail | null> {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();
  const { data: team, error } = await supabase
    .from('planning_teams')
    .select('id,name,description,default_sprint_length_days,is_archived')
    .eq('organization_id', membership.organizationId)
    .eq('id', teamId)
    .maybeSingle();

  if (error || !team) return null;

  const { data: memberRows, error: membersError } = await supabase
    .from('planning_team_members')
    .select(
      'planning_team_id,user_id,planning_role,default_capacity_hours_per_day',
    )
    .eq('organization_id', membership.organizationId)
    .eq('planning_team_id', teamId)
    .order('created_at', { ascending: true });

  if (membersError || !memberRows) return null;

  const userIds = memberRows.map((member) => member.user_id);
  const profileResult =
    userIds.length === 0
      ? { data: [] }
      : await supabase
          .from('profiles')
          .select('id,display_name')
          .in('id', userIds);
  const displayNameById = new Map(
    (profileResult.data ?? []).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
  const ownMembership = memberRows.find(
    (member) => member.user_id === membership.userId,
  );

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    defaultSprintLengthDays: team.default_sprint_length_days,
    isArchived: team.is_archived,
    memberCount: memberRows.length,
    currentUserRole:
      membership.role === 'admin'
        ? 'admin'
        : (ownMembership?.planning_role ?? 'member'),
    members: memberRows.map((member) => ({
      userId: member.user_id,
      displayName: displayNameById.get(member.user_id) ?? 'Unknown',
      planningRole: member.planning_role,
      defaultCapacityHoursPerDay: member.default_capacity_hours_per_day,
    })),
  };
}

export async function requirePlanningTeamAccess(
  teamId: string,
): Promise<PlanningTeamDetail> {
  const team = await getPlanningTeam(teamId);

  if (!team) redirect('/planning');

  return team;
}

export async function listPlanningTeamCandidates(
  teamId: string,
): Promise<PlanningTeamCandidate[]> {
  const team = await requirePlanningTeamAccess(teamId);
  if (team.currentUserRole === 'member') redirect('/planning');

  const membership = await requireMembership();
  const supabase = await createServerSupabase();
  const { data: organizationMembers, error } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', membership.organizationId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error || !organizationMembers) return [];

  const userIds = organizationMembers.map((member) => member.user_id);
  const { data: profiles } =
    userIds.length === 0
      ? { data: [] }
      : await supabase
          .from('profiles')
          .select('id,display_name')
          .in('id', userIds);
  const displayNameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );
  const teamMemberById = new Map(
    team.members.map((member) => [member.userId, member]),
  );

  return organizationMembers.map((member) => {
    const teamMember = teamMemberById.get(member.user_id);
    return {
      userId: member.user_id,
      displayName: displayNameById.get(member.user_id) ?? 'Unknown',
      planningRole: teamMember?.planningRole ?? null,
      defaultCapacityHoursPerDay:
        teamMember?.defaultCapacityHoursPerDay ?? null,
    };
  });
}
