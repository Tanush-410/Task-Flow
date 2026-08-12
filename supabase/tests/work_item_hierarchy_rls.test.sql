begin;

select plan(44);

-- Schema

select has_type('public', 'work_item_type', 'work item type enum exists');
select has_column('public', 'tasks', 'work_item_type', 'tasks store their work item type');
select has_column('public', 'tasks', 'parent_task_id', 'tasks store their hierarchy parent');
select has_column('public', 'tasks', 'planning_team_id', 'tasks store their owning planning team');
select has_column('public', 'tasks', 'story_points', 'tasks store story point estimates');
select has_column('public', 'tasks', 'original_hours', 'tasks store original hour estimates');
select has_column('public', 'tasks', 'remaining_hours', 'tasks store remaining hour estimates');
select has_column('public', 'tasks', 'backlog_rank', 'tasks store their backlog rank');

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
  array['uuid', 'uuid', 'work_item_type', 'text', 'text', 'task_priority', 'numeric', 'numeric', 'numeric'],
  'work item creation function exists'
);
select has_function(
  'public', 'assign_backlog_rank', array['uuid', 'uuid', 'uuid'],
  'rank assignment function exists'
);
select has_function(
  'public', 'rebalance_backlog_siblings', array['uuid', 'uuid', 'work_item_type'],
  'sibling rebalance function exists'
);
select has_function(
  'public', 'count_work_item_descendants', array['uuid'],
  'descendant counting function exists'
);
select has_function(
  'public', 'move_work_item', array['uuid', 'uuid', 'uuid', 'boolean'],
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
  has_function_privilege('authenticated', 'public.create_work_item(uuid,uuid,work_item_type,text,text,task_priority,numeric,numeric,numeric)', 'execute')
  and has_function_privilege('authenticated', 'public.move_work_item(uuid,uuid,uuid,boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.reestimate_work_item_hours(uuid,numeric,numeric)', 'execute'),
  'authenticated users can execute the work item RPCs'
);

select ok(
  not has_function_privilege('anon', 'public.create_work_item(uuid,uuid,work_item_type,text,text,task_priority,numeric,numeric,numeric)', 'execute'),
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
  $$insert into public.tasks (organization_id, created_by, title, work_item_type, planning_team_id, parent_task_id)
    values (
      '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Second feature',
      'feature', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'
    )$$,
  'a second feature under the same epic is valid'
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

select is(
  public.count_work_item_descendants('60000000-0000-0000-0000-000000000001'),
  3,
  'the epic fixture has three descendants (feature, story, task)'
);
select is(
  public.count_work_item_descendants('60000000-0000-0000-0000-000000000004'),
  0,
  'a leaf task has no descendants'
);

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
    '60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001', false
  )$$,
  'reparenting within the same team never requires include_descendants'
);

select throws_ok(
  $$select public.move_work_item(
    '60000000-0000-0000-0000-000000000001', null,
    '50000000-0000-0000-0000-000000000002', false
  )$$,
  '23514', null,
  'moving an item with descendants to a different team requires include_descendants'
);

select lives_ok(
  $$select public.move_work_item(
    '60000000-0000-0000-0000-000000000001', null,
    '50000000-0000-0000-0000-000000000002', true
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
