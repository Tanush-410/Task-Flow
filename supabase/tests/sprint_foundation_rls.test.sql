begin;

select plan(44);

select has_type('public', 'planning_role', 'planning role enum exists');
select has_table('public', 'planning_teams', 'planning teams exist');
select has_table('public', 'planning_team_members', 'planning team members exist');
select has_column('public', 'planning_teams', 'default_sprint_length_days', 'teams store sprint cadence');
select has_column('public', 'planning_team_members', 'default_capacity_hours_per_day', 'members store capacity defaults');
select has_function('public', 'is_planning_team_member', array['uuid'], 'team membership helper exists');
select has_function('public', 'is_planning_team_planner', array['uuid'], 'team planner helper exists');
select has_function(
  'public',
  'replace_planning_team_members',
  array['uuid', 'jsonb'],
  'transactional team roster replacement exists'
);

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
  has_table_privilege('service_role', 'public.feature_flags', 'select'),
  'the server-side feature flag evaluator can read flags'
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

select has_index(
  'public',
  'planning_teams',
  'planning_teams_org_name_unique_idx',
  'team name uniqueness index exists'
);

select has_index(
  'public',
  'planning_team_members',
  'planning_team_members_team_user_unique_idx',
  'team membership uniqueness index exists'
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
  and has_function_privilege('authenticated', 'public.is_planning_team_planner(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.replace_planning_team_members(uuid, jsonb)', 'execute'),
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

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.planning_teams (
      organization_id, name, default_sprint_length_days, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'Admin-created team',
      14,
      '00000000-0000-0000-0000-000000000001'
    )$$,
  'organization admins can insert a team and receive its id'
);

reset role;

insert into public.organizations (id, name, timezone, created_by)
values (
  '10000000-0000-0000-0000-000000000002',
  'Other organization',
  'UTC',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.planning_teams (
  id, organization_id, name, default_sprint_length_days, created_by
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Authorization contract team',
    14,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Unrelated same organization team',
    14,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Cross organization team',
    14,
    '00000000-0000-0000-0000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.replace_planning_team_members(
    '40000000-0000-0000-0000-000000000001',
    '[{"user_id":"00000000-0000-0000-0000-000000000002","planning_role":"planner","default_capacity_hours_per_day":8}]'::jsonb
  )$$,
  'organization admins can replace a roster atomically'
);
select results_eq(
  $$select user_id::text || ':' || planning_role::text
    from public.planning_team_members
    where planning_team_id = '40000000-0000-0000-0000-000000000001'$$,
  array['00000000-0000-0000-0000-000000000002:planner'],
  'admin roster replacement persists the requested role'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.is_planning_team_planner('40000000-0000-0000-0000-000000000001'),
  true,
  'an active employee planner is recognized'
);
select results_eq(
  $$select name from public.planning_teams
    where id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000003'
    )
    order by name$$,
  array['Authorization contract team'],
  'employee planners cannot see unrelated or cross-organization teams'
);
select lives_ok(
  $$select public.replace_planning_team_members(
    '40000000-0000-0000-0000-000000000001',
    '[{"user_id":"00000000-0000-0000-0000-000000000001","planning_role":"member","default_capacity_hours_per_day":8},{"user_id":"00000000-0000-0000-0000-000000000002","planning_role":"planner","default_capacity_hours_per_day":7.5}]'::jsonb
  )$$,
  'employee planners can manage other active organization members'
);
select throws_like(
  $$update public.planning_team_members
    set planning_role = 'member'
    where planning_team_id = '40000000-0000-0000-0000-000000000001'
      and user_id = auth.uid()$$,
  '%planning team members cannot change their own role%',
  'employee planners cannot bypass the RPC to demote themselves'
);
select throws_ok(
  $$select public.replace_planning_team_members(
    '40000000-0000-0000-0000-000000000001',
    '[{"user_id":"00000000-0000-0000-0000-000000000001","planning_role":"planner","default_capacity_hours_per_day":8},{"user_id":"00000000-0000-0000-0000-000000000002","planning_role":"member","default_capacity_hours_per_day":7.5}]'::jsonb
  )$$,
  '42501',
  'planning team planner access required',
  'employee planners cannot demote themselves'
);
select throws_ok(
  $$select public.replace_planning_team_members(
    '40000000-0000-0000-0000-000000000001',
    '[{"user_id":"00000000-0000-0000-0000-000000000001","planning_role":"planner","default_capacity_hours_per_day":8}]'::jsonb
  )$$,
  '42501',
  'planning team planner access required',
  'employee planners cannot remove themselves'
);
select results_eq(
  $$select user_id::text || ':' || planning_role::text
    from public.planning_team_members
    where planning_team_id = '40000000-0000-0000-0000-000000000001'
    order by user_id$$,
  array[
    '00000000-0000-0000-0000-000000000001:member',
    '00000000-0000-0000-0000-000000000002:planner'
  ],
  'rejected self-role changes leave the complete roster unchanged'
);
select is_empty(
  $$delete from public.planning_team_members
    where planning_team_id = '40000000-0000-0000-0000-000000000001'
      and user_id = auth.uid()
    returning id$$,
  'employee planners cannot bypass the RPC to remove themselves'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.planning_team_members
set planning_role = 'member'
where planning_team_id = '40000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select results_eq(
  $$update public.planning_team_members
    set default_capacity_hours_per_day = 6.5
    where planning_team_id = '40000000-0000-0000-0000-000000000001'
      and user_id = auth.uid()
    returning default_capacity_hours_per_day::text$$,
  array['6.50'],
  'members can update only their own capacity'
);
select throws_like(
  $$update public.planning_team_members
    set planning_role = 'planner'
    where planning_team_id = '40000000-0000-0000-0000-000000000001'
      and user_id = auth.uid()
    returning id$$,
  '%planning team members cannot change their own role%',
  'members cannot promote themselves'
);
select throws_ok(
  $$select public.replace_planning_team_members(
    '40000000-0000-0000-0000-000000000001',
    '[]'::jsonb
  )$$,
  '42501',
  'planning team planner access required',
  'members cannot replace the team roster'
);
select is_empty(
  $$update public.planning_teams
    set name = 'Cross organization rewrite'
    where id = '40000000-0000-0000-0000-000000000003'
    returning id$$,
  'employees cannot write across organization boundaries'
);

reset role;

select * from finish();
rollback;
