begin;

select plan(26);

select has_type('public', 'planning_role', 'planning role enum exists');
select has_table('public', 'planning_teams', 'planning teams exist');
select has_table('public', 'planning_team_members', 'planning team members exist');
select has_column('public', 'planning_teams', 'default_sprint_length_days', 'teams store sprint cadence');
select has_column('public', 'planning_team_members', 'default_capacity_hours_per_day', 'members store capacity defaults');
select has_function('public', 'is_planning_team_member', array['uuid'], 'team membership helper exists');
select has_function('public', 'is_planning_team_planner', array['uuid'], 'team planner helper exists');

select policies_are(
  'public',
  'planning_teams',
  array[
    'planning_teams_view_member_or_admin',
    'planning_teams_insert_admin',
    'planning_teams_update_planner_or_admin',
    'planning_teams_delete_admin'
  ],
  'planning teams have explicit policies'
);

select policies_are(
  'public',
  'planning_team_members',
  array[
    'planning_team_members_view_team',
    'planning_team_members_insert_planner',
    'planning_team_members_update_planner_or_self_capacity',
    'planning_team_members_delete_planner'
  ],
  'planning team members have explicit policies'
);

select ok(
  not has_table_privilege('anon', 'public.planning_teams', 'select')
  and not has_table_privilege('anon', 'public.planning_team_members', 'select'),
  'anonymous users have no planning access'
);

select ok(
  has_table_privilege('authenticated', 'public.planning_teams', 'select')
  and has_table_privilege('authenticated', 'public.planning_team_members', 'select'),
  'authenticated users receive select grants subject to RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.planning_teams', 'update'),
  'whole-row team updates are not granted'
);

select ok(
  has_column_privilege('authenticated', 'public.planning_teams', 'name', 'update')
  and not has_column_privilege('authenticated', 'public.planning_teams', 'organization_id', 'update'),
  'only mutable team columns are updateable'
);

select ok(
  has_column_privilege('authenticated', 'public.planning_team_members', 'default_capacity_hours_per_day', 'update')
  and not has_column_privilege('authenticated', 'public.planning_team_members', 'organization_id', 'update')
  and not has_column_privilege('authenticated', 'public.planning_team_members', 'user_id', 'update'),
  'membership provenance cannot be rewritten'
);

select ok(
  has_index('public', 'planning_teams', 'planning_teams_org_name_unique_idx')
  and has_index('public', 'planning_team_members', 'planning_team_members_team_user_unique_idx'),
  'team lookup and uniqueness indexes exist'
);

select lives_ok(
  $$insert into public.feature_flags (
      key, environment, enabled, rollout_percentage, owner, purpose,
      rollout_plan, review_on, expires_on
    ) values (
      'sprint_foundation_test', 'development', false, 0, 'test', 'test flag',
      'never enabled', current_date, current_date
    )$$,
  'migration leaves feature flags writable by database owner'
);

select is(
  (select count(*)::integer from public.feature_flags where key = 'native_sprint_planning'),
  3,
  'rollout rows exist for development, staging, and production'
);

select is(
  (select enabled from public.feature_flags where key = 'native_sprint_planning' and environment = 'development'),
  true,
  'local development is enabled'
);

select is(
  (select enabled from public.feature_flags where key = 'native_sprint_planning' and environment = 'staging'),
  false,
  'staging defaults off'
);

select is(
  (select enabled from public.feature_flags where key = 'native_sprint_planning' and environment = 'production'),
  false,
  'production defaults off'
);

select ok(
  has_function_privilege('authenticated', 'public.is_planning_team_member(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.is_planning_team_planner(uuid)', 'execute'),
  'authenticated users can execute team authorization helpers'
);

select ok(
  not has_function_privilege('anon', 'public.is_planning_team_member(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.is_planning_team_planner(uuid)', 'execute'),
  'anonymous users cannot execute team authorization helpers'
);

select col_is_unique(
  'public',
  'planning_team_members',
  array['planning_team_id', 'user_id'],
  'one membership per user and team'
);
select col_not_null('public', 'planning_teams', 'organization_id', 'team organization is required');
select col_not_null('public', 'planning_team_members', 'organization_id', 'member organization is required');

select throws_ok(
  $$insert into public.planning_teams (organization_id, name, default_sprint_length_days, created_by)
    values (
      '10000000-0000-0000-0000-000000000001',
      'Invalid',
      0,
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'sprint length must be positive'
);

select * from finish();
rollback;
