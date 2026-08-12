-- Adds a Bug work item type: a sibling of User Story (child of Feature,
-- can itself parent Tasks) carrying repro steps, severity, and an optional
-- found-in-build note. The 'bug' enum value itself lives in the prior
-- migration (202608130001), its own transaction, so it can safely be used
-- in the CHECK constraint and trigger body below. See
-- docs/superpowers/plans/2026-08-12-bug-work-item-type.md.

alter table public.tasks
  add column repro_steps text,
  add column severity public.task_priority,
  add column found_in_build text;

-- Mirrors tasks_hierarchy_requires_team_check's type-gated-nullability
-- pattern: these three fields are only ever meaningful on a bug.
alter table public.tasks
  add constraint tasks_bug_fields_require_bug_type_check
    check (
      work_item_type = 'bug'
      or (repro_steps is null and severity is null and found_in_build is null)
    );

-- Extends the hierarchy trigger from the previous migration: a bug is
-- valid wherever a user_story is (child of feature), and a task now
-- accepts either a user_story or a bug as its optional parent. Estimate
-- exclusivity needs no change -- a bug is not 'task', so it already lands
-- in the "gets story points, no hours" bucket the existing check already
-- enforces.
create or replace function public.validate_work_item_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_row public.tasks%rowtype;
  expected_parent_type public.work_item_type;
begin
  if new.work_item_type = 'epic' then
    if new.parent_task_id is not null then
      raise exception using errcode = '23514', message = 'an epic may not have a parent';
    end if;
    return new;
  end if;

  if new.work_item_type = 'feature' then
    expected_parent_type := 'epic';
  elsif new.work_item_type in ('user_story', 'bug') then
    expected_parent_type := 'feature';
  else
    -- 'task': a parent is optional; a bare task may stand alone exactly as
    -- it did before. When present, the parent may be either a user_story
    -- or a bug -- both sit one level above task -- so this branch does its
    -- own lookup instead of the single-expected-type check below.
    if new.parent_task_id is null then
      return new;
    end if;

    select * into parent_row from public.tasks where id = new.parent_task_id;

    if not found
      or parent_row.work_item_type not in ('user_story', 'bug')
      or parent_row.organization_id <> new.organization_id
      or parent_row.planning_team_id is distinct from new.planning_team_id then
      raise exception using
        errcode = '23514',
        message = 'a task must be parented by a user_story or a bug in the same organization and planning team';
    end if;

    return new;
  end if;

  if new.parent_task_id is null then
    raise exception using
      errcode = '23514',
      message = format('a %s requires a parent', new.work_item_type);
  end if;

  select * into parent_row from public.tasks where id = new.parent_task_id;

  if not found
    or parent_row.work_item_type <> expected_parent_type
    or parent_row.organization_id <> new.organization_id
    or parent_row.planning_team_id is distinct from new.planning_team_id then
    raise exception using
      errcode = '23514',
      message = format(
        'a %s must be parented by a %s in the same organization and planning team',
        new.work_item_type, expected_parent_type
      );
  end if;

  return new;
end;
$$;

-- create or replace cannot change a function's parameter list in place;
-- the three trailing bug-field params (default null, per the ordering
-- rule below) make this a different signature, so the old one must be
-- dropped explicitly or it would linger as a stale duplicate overload.
drop function public.create_work_item(
  uuid, public.work_item_type, text, text, public.task_priority, uuid, numeric, numeric, numeric
);

-- Optional parameters are declared last (Postgres requires every
-- parameter after the first one with a default to also have one); the
-- defaults exist purely so generated TypeScript types allow null/omitted
-- values, since every real caller supplies them by name regardless of
-- position.
create or replace function public.create_work_item(
  target_planning_team_id uuid,
  item_type public.work_item_type,
  item_title text,
  item_description text,
  item_priority public.task_priority,
  target_parent_task_id uuid default null,
  item_story_points numeric default null,
  item_original_hours numeric default null,
  item_remaining_hours numeric default null,
  item_repro_steps text default null,
  item_severity public.task_priority default null,
  item_found_in_build text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  parent_row public.tasks%rowtype;
  new_task_id uuid;
  last_rank text;
begin
  if auth.uid() is null or not public.is_planning_team_member(target_planning_team_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  select organization_id into target_organization_id
  from public.planning_teams
  where id = target_planning_team_id;

  if target_organization_id is null then
    raise exception using errcode = '23514', message = 'planning team not found';
  end if;

  if target_parent_task_id is not null then
    select * into parent_row from public.tasks where id = target_parent_task_id for update;
    if not found or parent_row.planning_team_id is distinct from target_planning_team_id then
      raise exception using errcode = '23514', message = 'parent must belong to the same planning team';
    end if;
  end if;

  select backlog_rank into last_rank
  from public.tasks
  where planning_team_id = target_planning_team_id
    and coalesce(parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(target_parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and work_item_type = item_type
  order by (backlog_rank collate "C") desc
  limit 1;

  insert into public.tasks (
    organization_id, created_by, title, description, priority, status,
    published_at, work_item_type, parent_task_id, planning_team_id,
    story_points, original_hours, remaining_hours, backlog_rank,
    repro_steps, severity, found_in_build
  )
  values (
    target_organization_id, auth.uid(), item_title, coalesce(item_description, ''),
    coalesce(item_priority, 'medium'), 'published', now(),
    item_type, target_parent_task_id, target_planning_team_id,
    item_story_points, item_original_hours, item_remaining_hours,
    public.backlog_rank_midpoint(last_rank, null),
    item_repro_steps, item_severity, item_found_in_build
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

revoke all on function public.create_work_item(
  uuid, public.work_item_type, text, text, public.task_priority, uuid, numeric, numeric, numeric, text, public.task_priority, text
) from public, anon, authenticated;

grant execute on function public.create_work_item(
  uuid, public.work_item_type, text, text, public.task_priority, uuid, numeric, numeric, numeric, text, public.task_priority, text
) to authenticated;

-- Ordinary fields, same grant shape as story_points/remaining_hours: no
-- cross-field invariant like remaining_hours <= original_hours to protect,
-- so a plain grant + the existing tasks_update_planning_team_member RLS
-- policy is sufficient. No SECURITY DEFINER RPC needed.
grant update (repro_steps) on public.tasks to authenticated;
grant update (severity) on public.tasks to authenticated;
grant update (found_in_build) on public.tasks to authenticated;
