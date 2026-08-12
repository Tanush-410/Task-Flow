begin;

select plan(60);

-- Schema

select has_type('public', 'work_item_type', 'work item type enum exists');
select has_column('public', 'tasks', 'work_item_type', 'tasks store their work item type');
select has_column('public', 'tasks', 'parent_task_id', 'tasks store their hierarchy parent');
select has_column('public', 'tasks', 'planning_team_id', 'tasks store their owning planning team');
select has_column('public', 'tasks', 'story_points', 'tasks store story point estimates');
select has_column('public', 'tasks', 'original_hours', 'tasks store original hour estimates');
select has_column('public', 'tasks', 'remaining_hours', 'tasks store remaining hour estimates');
select has_column('public', 'tasks', 'backlog_rank', 'tasks store their backlog rank');
select has_column('public', 'tasks', 'repro_steps', 'tasks store bug repro steps');
select has_column('public', 'tasks', 'severity', 'tasks store bug severity');
select has_column('public', 'tasks', 'found_in_build', 'tasks store the bug''s found-in-build note');

-- Column-level collate "C" is what makes a plain `order by backlog_rank`
-- (e.g. from PostgREST/supabase-js, which cannot request a collation)
-- sort by byte value, matching the fractional-rank algorithm's own
-- comparisons. The database's default collation instead sorts
-- case-insensitively (e.g. "k" before "V"), which silently breaks rank
-- order once a mix of upper- and lowercase digits appears.
select is(
  (
    select collation_name from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'backlog_rank'
  ),
  'C',
  'backlog_rank is collate "C" so unqualified ORDER BY matches byte order'
);

select has_function(
  'public', 'is_task_planning_team_member', array['uuid'],
  'task planning-team membership helper exists'
);
select has_function(
  'public', 'backlog_rank_midpoint', array['text', 'text'],
  'rank midpoint helper exists'
);
select has_function(
  'public', 'create_work_item',
  array['uuid', 'work_item_type', 'text', 'text', 'task_priority', 'uuid', 'numeric', 'numeric', 'numeric', 'text', 'task_priority', 'text'],
  'work item creation function exists'
);
select has_function(
  'public', 'assign_backlog_rank', array['uuid', 'uuid', 'uuid'],
  'rank assignment function exists'
);
select has_function(
  'public', 'rebalance_backlog_siblings', array['uuid', 'work_item_type', 'uuid'],
  'sibling rebalance function exists'
);
select has_function(
  'public', 'count_work_item_descendants', array['uuid'],
  'descendant counting function exists'
);
select has_function(
  'public', 'move_work_item', array['uuid', 'uuid', 'boolean', 'uuid'],
  'reparent function exists'
);
select has_function(
  'public', 'reestimate_work_item_hours', array['uuid', 'numeric', 'numeric'],
  'hour re-estimation function exists'
);

select has_index(
  'public', 'tasks', 'tasks_backlog_rank_unique_idx',
  'backlog rank uniqueness index exists'
);

-- Grants: the five structurally sensitive columns are never directly writable

select ok(
  not has_column_privilege('authenticated', 'public.tasks', 'work_item_type', 'update')
  and not has_column_privilege('authenticated', 'public.tasks', 'parent_task_id', 'update')
  and not has_column_privilege('authenticated', 'public.tasks', 'planning_team_id', 'update')
  and not has_column_privilege('authenticated', 'public.tasks', 'backlog_rank', 'update')
  and not has_column_privilege('authenticated', 'public.tasks', 'original_hours', 'update'),
  'structurally sensitive columns have no direct grant'
);

select ok(
  has_column_privilege('authenticated', 'public.tasks', 'story_points', 'update')
  and has_column_privilege('authenticated', 'public.tasks', 'remaining_hours', 'update'),
  'ordinary estimate columns remain directly writable'
);

select ok(
  has_column_privilege('authenticated', 'public.tasks', 'repro_steps', 'update')
  and has_column_privilege('authenticated', 'public.tasks', 'severity', 'update')
  and has_column_privilege('authenticated', 'public.tasks', 'found_in_build', 'update'),
  'bug detail columns remain directly writable'
);

select ok(
  has_function_privilege('authenticated', 'public.create_work_item(uuid,work_item_type,text,text,task_priority,uuid,numeric,numeric,numeric,text,task_priority,text)', 'execute')
  and has_function_privilege('authenticated', 'public.move_work_item(uuid,uuid,boolean,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.reestimate_work_item_hours(uuid,numeric,numeric)', 'execute'),
  'authenticated users can execute the work item RPCs'
);

select ok(
  not has_function_privilege('anon', 'public.create_work_item(uuid,work_item_type,text,text,task_priority,uuid,numeric,numeric,numeric,text,task_priority,text)', 'execute'),
  'anonymous users cannot execute the work item RPCs'
);

-- Fixtures: two teams in the demo organization, one team in another organization

insert into public.organizations (id, name, timezone, created_by)
values (
  '10000000-0000-0000-0000-000000000002',
  'Other organization',
  'UTC',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.planning_teams (id, organization_id, name, default_sprint_length_days, created_by)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Backlog team A',
    14,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Backlog team B',
    14,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Cross organization team',
    14,
    '00000000-0000-0000-0000-000000000001'
  );

-- Only employee-002 is an explicit member of team A; admin-001 reaches every
-- team in its own organization implicitly via is_admin().
insert into public.planning_team_members (organization_id, planning_team_id, user_id, planning_role, default_capacity_hours_per_day)
values (
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'planner',
  8
);

insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id)
values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Backlog epic',
  'epic',
  '50000000-0000-0000-0000-000000000001'
);

insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
values (
  '60000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Backlog feature',
  'feature',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001'
);

insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
values (
  '60000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Backlog user story',
  'user_story',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002'
);

insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id, original_hours, remaining_hours)
values (
  '60000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Backlog task',
  'task',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000003',
  8,
  8
);

insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id)
values (
  '60000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Team B epic',
  'epic',
  '50000000-0000-0000-0000-000000000002'
);

insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id)
values (
  '60000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Other org epic',
  'epic',
  '50000000-0000-0000-0000-000000000003'
);

-- A bare, hierarchy-less task keeps working exactly as before.
select lives_ok(
  $$insert into public.tasks (organization_id, created_by, title)
    values (
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      'Ordinary non-planning task'
    )$$,
  'a bare task with no team or hierarchy still inserts'
);

-- Hierarchy validation matrix

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Bad epic',
      'epic', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'an epic may not have a parent'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Parentless feature',
      'feature', '50000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'a feature requires a parent'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Feature under task',
      'feature', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004'
    )$$,
  '23514', null, 'a feature may only be parented by an epic'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Story under epic',
      'user_story', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'a user story may only be parented by a feature'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Task under feature',
      'task', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002'
    )$$,
  '23514', null, 'a task may only be parented by a user story'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Cross team feature',
      'feature', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'parent and child must share a planning team'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Cross org feature',
      'feature', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'parent and child must share an organization'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Teamless epic', 'epic'
    )$$,
  '23514', null, 'an epic requires a planning team'
);

select lives_ok(
  $$insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '60000000-0000-0000-0000-000000000007',
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Second feature',
      'feature', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'
    )$$,
  'a second feature under the same epic is valid'
);

-- Bug hierarchy: a bug is a child of a feature (sibling of user_story), and
-- can itself parent tasks exactly like a user_story can.

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Parentless bug',
      'bug', '50000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'a bug requires a parent'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Bug under epic',
      'bug', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'
    )$$,
  '23514', null, 'a bug may only be parented by a feature'
);

select lives_ok(
  $$insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '60000000-0000-0000-0000-000000000008',
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Backlog bug',
      'bug', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002'
    )$$,
  'a bug under a feature is valid'
);

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Story under bug',
      'user_story', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000008'
    )$$,
  '23514', null, 'a user story may not be parented by a bug'
);

select lives_ok(
  $$insert into public.tasks (id, organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '60000000-0000-0000-0000-000000000009',
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Task under bug',
      'task', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000008'
    )$$,
  'a task may be parented by a bug as well as a user story'
);

-- Estimate constraints

select throws_ok(
  $$update public.tasks set story_points = 3 where id = '60000000-0000-0000-0000-000000000004'$$,
  '23514', null, 'a task cannot carry story points'
);

select throws_ok(
  $$update public.tasks set original_hours = 4 where id = '60000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'an epic cannot carry hour estimates'
);

select throws_ok(
  $$update public.tasks set story_points = -1 where id = '60000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'story points cannot be negative'
);

select throws_ok(
  $$update public.tasks
    set original_hours = 4, remaining_hours = 8
    where id = '60000000-0000-0000-0000-000000000004'$$,
  '23514', null, 'remaining hours cannot exceed original hours'
);

-- Bug-specific fields require work_item_type = 'bug'

select throws_ok(
  $$update public.tasks set repro_steps = 'Click X, then Y' where id = '60000000-0000-0000-0000-000000000004'$$,
  '23514', null, 'a non-bug cannot carry repro steps'
);

select lives_ok(
  $$update public.tasks set repro_steps = 'Click X, then Y', severity = 'high', found_in_build = '1.2.3'
    where id = '60000000-0000-0000-0000-000000000008'$$,
  'a bug can carry repro steps, severity, and a found-in-build note'
);

-- Rank uniqueness

update public.tasks set backlog_rank = 'M' where id = '60000000-0000-0000-0000-000000000001';

select throws_ok(
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, backlog_rank)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Duplicate rank epic',
      'epic', '50000000-0000-0000-0000-000000000001', 'M'
    )$$,
  '23505', null, 'duplicate backlog ranks within the same scope are rejected'
);

-- Descendant counting

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.count_work_item_descendants('60000000-0000-0000-0000-000000000001'),
  6,
  'the epic fixture has six descendants (two features, one story, one task, one bug, one task under the bug)'
);
select is(
  public.count_work_item_descendants('60000000-0000-0000-0000-000000000004'),
  0,
  'a leaf task has no descendants'
);

select public.create_work_item(
  target_planning_team_id := '50000000-0000-0000-0000-000000000001',
  item_type := 'bug',
  item_title := 'RPC-created bug',
  item_description := '',
  item_priority := 'high',
  target_parent_task_id := '60000000-0000-0000-0000-000000000002',
  item_repro_steps := 'Open the app and click Save',
  item_severity := 'urgent',
  item_found_in_build := '2.0.0-rc1'
);

select is(
  (select repro_steps from public.tasks where title = 'RPC-created bug'),
  'Open the app and click Save',
  'create_work_item sets repro steps for a bug'
);
select is(
  (select severity from public.tasks where title = 'RPC-created bug'),
  'urgent',
  'create_work_item sets severity for a bug'
);
select is(
  (select found_in_build from public.tasks where title = 'RPC-created bug'),
  '2.0.0-rc1',
  'create_work_item sets found-in-build for a bug'
);

reset role;

-- RLS visibility: admin-001 (implicit member via is_admin) vs employee-002
-- (explicit member of team A only) vs an outside employee

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.tasks where id = '60000000-0000-0000-0000-000000000004'),
  1,
  'a planning-team member can see a team-owned task they neither created nor are assigned to'
);
select is(
  (select count(*)::integer from public.tasks where id = '60000000-0000-0000-0000-000000000005'),
  0,
  'a planning-team member cannot see a different team''s work item'
);

reset role;

-- move_work_item: same-team reparent is unrestricted; cross-team reparent
-- requires include_descendants whenever the target has descendants

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.move_work_item(
    target_task_id := '60000000-0000-0000-0000-000000000003',
    new_planning_team_id := '50000000-0000-0000-0000-000000000001',
    include_descendants := false,
    new_parent_task_id := '60000000-0000-0000-0000-000000000007'
  )$$,
  'reparenting within the same team never requires include_descendants'
);
select is(
  (select parent_task_id from public.tasks where id = '60000000-0000-0000-0000-000000000003'),
  '60000000-0000-0000-0000-000000000007',
  'the user story now reports the new sibling feature as its parent'
);

select throws_ok(
  $$select public.move_work_item(
    target_task_id := '60000000-0000-0000-0000-000000000001',
    new_planning_team_id := '50000000-0000-0000-0000-000000000002',
    include_descendants := false
  )$$,
  '23514', null,
  'moving an item with descendants to a different team requires include_descendants'
);

select lives_ok(
  $$select public.move_work_item(
    target_task_id := '60000000-0000-0000-0000-000000000001',
    new_planning_team_id := '50000000-0000-0000-0000-000000000002',
    include_descendants := true
  )$$,
  'moving an item with descendants to a different team succeeds when include_descendants is set'
);

select is(
  (select planning_team_id from public.tasks where id = '60000000-0000-0000-0000-000000000004'),
  '50000000-0000-0000-0000-000000000002',
  'a cascaded move reassigns every transitive descendant to the new team'
);

reset role;

select * from finish();
rollback;
