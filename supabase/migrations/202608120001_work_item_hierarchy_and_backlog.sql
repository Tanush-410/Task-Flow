-- Extends the existing `tasks` table into the canonical Epic -> Feature ->
-- User Story -> Task work-item hierarchy, adds estimates, and adds a
-- fractional-rank ranked backlog scoped to a planning team. See
-- docs/superpowers/plans/2026-08-12-work-item-hierarchy-and-backlog.md.

create type public.work_item_type as enum ('epic', 'feature', 'user_story', 'task');

alter table public.tasks
  add column work_item_type public.work_item_type not null default 'task',
  add column parent_task_id uuid references public.tasks (id) on delete restrict,
  add column planning_team_id uuid references public.planning_teams (id) on delete set null,
  add column story_points numeric(6,2),
  add column original_hours numeric(8,2),
  add column remaining_hours numeric(8,2),
  -- collate "C" at the column level (not just in the unique index and the
  -- ranking functions below) so a plain `order by backlog_rank` from
  -- PostgREST/supabase-js -- which has no way to request a collation --
  -- still sorts by byte value, matching the fractional-rank algorithm's
  -- assumption. The database's default collation sorts case-insensitively
  -- (e.g. "k" before "V"), which silently breaks rank order once a mix of
  -- upper- and lowercase digits appears.
  add column backlog_rank text collate "C";

alter table public.tasks
  add constraint tasks_story_points_nonnegative_check
    check (story_points is null or story_points >= 0),
  add constraint tasks_original_hours_nonnegative_check
    check (original_hours is null or original_hours >= 0),
  add constraint tasks_remaining_hours_nonnegative_check
    check (remaining_hours is null or remaining_hours >= 0),
  add constraint tasks_remaining_within_original_check
    check (remaining_hours is null or original_hours is null or remaining_hours <= original_hours),
  -- A task may carry hour estimates but never story points; every other
  -- work-item type may carry story points but never hour estimates.
  add constraint tasks_estimate_exclusivity_check
    check (
      (work_item_type = 'task' and story_points is null)
      or (work_item_type <> 'task' and original_hours is null and remaining_hours is null)
    ),
  -- Epics/features/user stories always belong to a planning team; a bare
  -- task may opt out of planning entirely, preserving today's behavior.
  add constraint tasks_hierarchy_requires_team_check
    check (work_item_type = 'task' or planning_team_id is not null);

create index tasks_org_team_rank_idx
on public.tasks (organization_id, planning_team_id, backlog_rank);

create index tasks_parent_task_id_idx
on public.tasks (parent_task_id);

create index tasks_work_item_type_idx
on public.tasks (organization_id, work_item_type);

-- work_item_type is included in the scope even though it is implied by
-- parent_task_id for non-top-level items, because top-level items are
-- ambiguous otherwise: an epic (parent_task_id = null) and a bare,
-- hierarchy-less task (parent_task_id = null, allowed) would otherwise
-- collide in the same "no parent" bucket. NULL parent_task_id is coalesced
-- to a sentinel because Postgres treats NULL as distinct from itself in a
-- plain unique index, which would defeat top-level uniqueness entirely.
create unique index tasks_backlog_rank_unique_idx
on public.tasks (
  planning_team_id,
  coalesce(parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid),
  work_item_type,
  (backlog_rank collate "C")
)
where planning_team_id is not null and backlog_rank is not null;

-- Cross-row hierarchy validation. Fires regardless of which code path
-- writes the row, so it is the one provable source of truth: cycles are
-- structurally impossible because every parent edge strictly decreases a
-- fixed type rank (epic -> feature -> user_story -> task).
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
  elsif new.work_item_type = 'user_story' then
    expected_parent_type := 'feature';
  else
    -- 'task': a parent is optional; a bare task may stand alone exactly as
    -- it did before this migration.
    if new.parent_task_id is null then
      return new;
    end if;
    expected_parent_type := 'user_story';
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

create trigger tasks_validate_work_item_hierarchy
before insert or update of work_item_type, parent_task_id, planning_team_id, organization_id
on public.tasks
for each row execute function public.validate_work_item_hierarchy();

-- Backs the new RLS policies below: true only for tasks that belong to a
-- planning team the caller can see (admin or explicit member).
create or replace function public.is_task_planning_team_member(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks as task
    where task.id = target_task_id
      and task.planning_team_id is not null
      and public.is_planning_team_member(task.planning_team_id)
  );
$$;

-- Fractional/lexicographic ranking. Base62 (0-9A-Za-z) is chosen because
-- its code-point order matches both COLLATE "C" Postgres comparison and
-- JavaScript's default string comparison, so the client-side mirror in
-- src/modules/backlog/rank.ts produces byte-identical results. A missing
-- lower bound behaves as all-'0' digits; a missing upper bound behaves as
-- one past the last real digit ("infinity").
create or replace function public.backlog_rank_midpoint(lower_rank text, upper_rank text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  alphabet_size constant integer := 62;
  max_rank_length constant integer := 30;
  prefix text := '';
  position_index integer := 0;
  digit_a integer;
  digit_b integer;
  gap integer;
  upper_exhausted boolean := false;
begin
  if lower_rank is not null and upper_rank is not null
    and (lower_rank collate "C") >= (upper_rank collate "C") then
    raise exception using errcode = '22023', message = 'invalid rank bounds';
  end if;

  loop
    if position_index > max_rank_length then
      raise exception using errcode = '22023', message = 'RANK_PRECISION_EXHAUSTED';
    end if;

    if lower_rank is not null and position_index < length(lower_rank) then
      digit_a := strpos(alphabet, substr(lower_rank, position_index + 1, 1)) - 1;
    else
      digit_a := 0;
    end if;

    if not upper_exhausted and upper_rank is not null and position_index < length(upper_rank) then
      digit_b := strpos(alphabet, substr(upper_rank, position_index + 1, 1)) - 1;
    else
      digit_b := alphabet_size;
    end if;

    gap := digit_b - digit_a;

    if gap >= 2 then
      return prefix || substr(alphabet, digit_a + (gap / 2) + 1, 1);
    elsif gap = 1 then
      prefix := prefix || substr(alphabet, digit_a + 1, 1);
      upper_exhausted := true;
      position_index := position_index + 1;
    else
      prefix := prefix || substr(alphabet, digit_a + 1, 1);
      position_index := position_index + 1;
    end if;
  end loop;
end;
$$;

-- The sole path that may create a work item. Derives organization_id from
-- the planning team, re-validates the client's parent claim against the
-- parent's own team rather than trusting it, and appends the new item at
-- the end of its sibling scope.
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
  item_remaining_hours numeric default null
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
    story_points, original_hours, remaining_hours, backlog_rank
  )
  values (
    target_organization_id, auth.uid(), item_title, coalesce(item_description, ''),
    coalesce(item_priority, 'medium'), 'published', now(),
    item_type, target_parent_task_id, target_planning_team_id,
    item_story_points, item_original_hours, item_remaining_hours,
    public.backlog_rank_midpoint(last_rank, null)
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

-- Repositions one work item between two optional neighbors sharing its
-- exact sibling scope. Surfaces RANK_PRECISION_EXHAUSTED (22023) for the
-- caller to rebalance and retry.
create or replace function public.assign_backlog_rank(
  target_task_id uuid,
  before_task_id uuid default null,
  after_task_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.tasks%rowtype;
  before_row public.tasks%rowtype;
  after_row public.tasks%rowtype;
  new_rank text;
begin
  select * into target_row from public.tasks where id = target_task_id for update;
  if not found or not public.is_task_planning_team_member(target_task_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  if before_task_id is not null then
    select * into before_row from public.tasks where id = before_task_id for update;
    if not found
      or before_row.planning_team_id is distinct from target_row.planning_team_id
      or coalesce(before_row.parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
        <> coalesce(target_row.parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      or before_row.work_item_type <> target_row.work_item_type then
      raise exception using errcode = '23514', message = 'rank neighbor must share the same backlog scope';
    end if;
  end if;

  if after_task_id is not null then
    select * into after_row from public.tasks where id = after_task_id for update;
    if not found
      or after_row.planning_team_id is distinct from target_row.planning_team_id
      or coalesce(after_row.parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
        <> coalesce(target_row.parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      or after_row.work_item_type <> target_row.work_item_type then
      raise exception using errcode = '23514', message = 'rank neighbor must share the same backlog scope';
    end if;
  end if;

  if before_row.id is not null and after_row.id is not null
    and (before_row.backlog_rank collate "C") >= (after_row.backlog_rank collate "C") then
    raise exception using errcode = '23514', message = 'rank neighbors must be correctly ordered';
  end if;

  new_rank := public.backlog_rank_midpoint(before_row.backlog_rank, after_row.backlog_rank);

  update public.tasks set backlog_rank = new_rank where id = target_task_id;

  return new_rank;
end;
$$;

-- Bounded, server-side rebalance: reassigns every sibling in one scope to
-- evenly spaced canonical ranks. Called by the server action after a
-- RANK_PRECISION_EXHAUSTED or unique-index race, followed by exactly one
-- retry of assign_backlog_rank.
create or replace function public.rebalance_backlog_siblings(
  target_team_id uuid,
  target_work_item_type public.work_item_type,
  target_parent_task_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  sibling_ids uuid[] := '{}';
  sibling_row record;
  sibling_count integer;
  width integer := 1;
  capacity numeric := 62;
  code bigint;
  remainder bigint;
  rank_text text;
begin
  if not public.is_planning_team_member(target_team_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  for sibling_row in
    select id
    from public.tasks
    where planning_team_id = target_team_id
      and coalesce(parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(target_parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and work_item_type = target_work_item_type
    order by (backlog_rank collate "C")
    for update
  loop
    sibling_ids := array_append(sibling_ids, sibling_row.id);
  end loop;

  sibling_count := coalesce(array_length(sibling_ids, 1), 0);
  if sibling_count = 0 then
    return 0;
  end if;

  while capacity <= sibling_count loop
    width := width + 1;
    capacity := capacity * 62;
  end loop;

  for position_index in 1..sibling_count loop
    code := floor(position_index::numeric * power(62::numeric, width) / (sibling_count + 1));
    rank_text := '';
    remainder := code;
    for digit_index in 1..width loop
      rank_text := substr(alphabet, (remainder % 62)::integer + 1, 1) || rank_text;
      remainder := remainder / 62;
    end loop;

    update public.tasks set backlog_rank = rank_text where id = sibling_ids[position_index];
  end loop;

  return sibling_count;
end;
$$;

-- Read-only preview, never an authorization boundary.
create or replace function public.count_work_item_descendants(target_task_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result integer;
begin
  if not public.is_task_planning_team_member(target_task_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  with recursive descendants as (
    select id from public.tasks where parent_task_id = target_task_id
    union all
    select t.id from public.tasks t join descendants d on t.parent_task_id = d.id
  )
  select count(*) into result from descendants;

  return result;
end;
$$;

-- Reparents one work item. Same-team reparenting never touches
-- descendants (they reference their own direct parent by id, unaffected
-- by a grandparent move). Cross-team reparenting cascades
-- planning_team_id (never organization_id) to every transitive
-- descendant in this same transaction, gated behind include_descendants
-- whenever the target has any.
create or replace function public.move_work_item(
  target_task_id uuid,
  new_planning_team_id uuid,
  include_descendants boolean,
  new_parent_task_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.tasks%rowtype;
  new_parent_row public.tasks%rowtype;
  resolved_team_id uuid;
  descendant_ids uuid[];
  descendant_count integer;
  moved_count integer := 1;
  last_rank text;
  frontier uuid[];
  next_frontier uuid[];
begin
  select * into target_row from public.tasks where id = target_task_id for update;
  if not found or not public.is_task_planning_team_member(target_task_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  if new_parent_task_id is not null then
    select * into new_parent_row from public.tasks where id = new_parent_task_id for update;
    if not found then
      raise exception using errcode = '23514', message = 'new parent not found';
    end if;
    resolved_team_id := new_parent_row.planning_team_id;
    if new_planning_team_id is distinct from resolved_team_id then
      raise exception using errcode = '23514', message = 'planning team must match the new parent''s team';
    end if;
  else
    resolved_team_id := new_planning_team_id;
  end if;

  if resolved_team_id is null or not public.is_planning_team_member(resolved_team_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  descendant_count := 0;
  if target_row.planning_team_id is distinct from resolved_team_id then
    select array_agg(id) into descendant_ids
    from (
      with recursive descendants as (
        select id from public.tasks where parent_task_id = target_task_id
        union all
        select t.id from public.tasks t join descendants d on t.parent_task_id = d.id
      )
      select id from descendants limit 2001
    ) bounded;

    descendant_count := coalesce(array_length(descendant_ids, 1), 0);

    if descendant_count > 2000 then
      raise exception using errcode = '22023', message = 'too many descendants to move in one operation';
    end if;

    if descendant_count > 0 and not include_descendants then
      raise exception using
        errcode = '23514',
        message = 'moving to a different team requires include_descendants';
    end if;
  end if;

  select backlog_rank into last_rank
  from public.tasks
  where planning_team_id = resolved_team_id
    and coalesce(parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(new_parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and work_item_type = target_row.work_item_type
    and id <> target_task_id
  order by (backlog_rank collate "C") desc
  limit 1;

  -- Move the target itself first so its new team is already committed
  -- before any descendant's own hierarchy trigger re-validates against
  -- it; then cascade level by level (not one bulk update) so a
  -- grandchild's trigger never fires before its immediate parent's team
  -- change has already committed in an earlier statement.
  update public.tasks
  set
    parent_task_id = new_parent_task_id,
    planning_team_id = resolved_team_id,
    backlog_rank = public.backlog_rank_midpoint(last_rank, null)
  where id = target_task_id;

  if descendant_count > 0 then
    frontier := array[target_task_id];
    loop
      select array_agg(id) into next_frontier
      from public.tasks
      where parent_task_id = any(frontier);

      exit when next_frontier is null;

      update public.tasks
      set planning_team_id = resolved_team_id
      where id = any(next_frontier);

      frontier := next_frontier;
    end loop;

    moved_count := moved_count + descendant_count;
  end if;

  return moved_count;
end;
$$;

-- The only writer of original_hours anywhere in the system. Since
-- original_hours is never granted to `authenticated`, this makes
-- "remaining_hours <= original_hours holds unconditionally, except
-- through an explicit re-estimation action" true by construction rather
-- than by a relaxable check.
create or replace function public.reestimate_work_item_hours(
  target_task_id uuid,
  new_original_hours numeric,
  new_remaining_hours numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.tasks%rowtype;
begin
  select * into target_row from public.tasks where id = target_task_id for update;
  if not found or not public.is_task_planning_team_member(target_task_id) then
    raise exception using errcode = '42501', message = 'planning team member access required';
  end if;

  if target_row.work_item_type <> 'task' then
    raise exception using errcode = '23514', message = 'only tasks carry hour estimates';
  end if;

  if new_original_hours is null or new_remaining_hours is null
    or new_original_hours < 0 or new_remaining_hours < 0
    or new_remaining_hours > new_original_hours then
    raise exception using errcode = '22023', message = 'invalid hour re-estimate';
  end if;

  update public.tasks
  set original_hours = new_original_hours, remaining_hours = new_remaining_hours
  where id = target_task_id;

  return true;
end;
$$;

-- Extend the existing activity logger (already evolved via create or
-- replace in prior migrations) with one more distinguishable summary for
-- hour re-estimation, without minting a new task_activity_type value.
create or replace function public.log_task_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type public.task_activity_type;
  event_summary text;
  task_id_value uuid;
  organization_id_value uuid;
  assignment_id_value uuid;
  actor_id_value uuid;
begin
  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      event_type := 'task_created';
      event_summary := 'Task created';
      task_id_value := new.id;
      organization_id_value := new.organization_id;
      actor_id_value := new.created_by;
    elsif tg_op = 'UPDATE' then
      if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
        return new;
      end if;

      task_id_value := new.id;
      organization_id_value := new.organization_id;
      actor_id_value := new.created_by;

      if old.status <> new.status and new.status = 'published' then
        event_type := 'task_published';
        event_summary := 'Task published';
      elsif old.status <> new.status and new.status = 'archived' then
        event_type := 'task_archived';
        event_summary := 'Task archived';
      elsif old.original_hours is distinct from new.original_hours then
        event_type := 'task_updated';
        event_summary := 'Task hours re-estimated';
      else
        event_type := 'task_updated';
        event_summary := 'Task updated';
      end if;
    else
      event_type := 'task_archived';
      event_summary := 'Task deleted';
      task_id_value := old.id;
      organization_id_value := old.organization_id;
      actor_id_value := old.created_by;
    end if;
  elsif tg_table_name = 'task_assignments' then
    if tg_op = 'INSERT' then
      event_type := 'assignment_created';
      event_summary := 'Assignment created';
      task_id_value := new.task_id;
      organization_id_value := new.organization_id;
      assignment_id_value := new.id;
      actor_id_value := new.assigned_by;
    elsif tg_op = 'UPDATE' then
      if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
        return new;
      end if;

      task_id_value := new.task_id;
      organization_id_value := new.organization_id;
      assignment_id_value := new.id;
      actor_id_value := new.assigned_by;

      if old.status <> new.status and new.status = 'completed' then
        event_type := 'assignment_completed';
        event_summary := 'Assignment completed';
      elsif old.status <> new.status and new.status = 'delayed' then
        event_type := 'assignment_delayed';
        event_summary := 'Assignment delayed';
      elsif old.status <> new.status and old.status = 'completed' and new.status <> 'completed' then
        event_type := 'assignment_reopened';
        event_summary := 'Assignment reopened';
      elsif old.status <> new.status then
        event_type := 'assignment_status_changed';
        event_summary := 'Assignment status changed';
      elsif old.progress <> new.progress then
        event_type := 'assignment_progress_changed';
        event_summary := 'Assignment progress changed';
      else
        event_type := 'assignment_updated';
        event_summary := 'Assignment updated';
      end if;
    else
      event_type := 'assignment_updated';
      event_summary := 'Assignment deleted';
      task_id_value := old.task_id;
      organization_id_value := old.organization_id;
      assignment_id_value := old.id;
      actor_id_value := old.assigned_by;
    end if;
  elsif tg_table_name = 'task_acknowledgements' then
    if tg_op = 'INSERT' then
      event_type := 'task_acknowledgement_recorded';
      event_summary := 'Task acknowledgement recorded';
      task_id_value := new.task_id;
      organization_id_value := new.organization_id;
      assignment_id_value := new.assignment_id;
      actor_id_value := new.acknowledged_by;
    else
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  else
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into public.task_activity_events (
    organization_id,
    task_id,
    assignment_id,
    actor_id,
    event_type,
    summary,
    before_record,
    after_record
  )
  values (
    organization_id_value,
    task_id_value,
    assignment_id_value,
    actor_id_value,
    event_type,
    event_summary,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.is_task_planning_team_member(uuid) from public, anon, authenticated;
revoke all on function public.backlog_rank_midpoint(text, text) from public, anon, authenticated;
revoke all on function public.create_work_item(
  uuid, public.work_item_type, text, text, public.task_priority, uuid, numeric, numeric, numeric
) from public, anon, authenticated;
revoke all on function public.assign_backlog_rank(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.rebalance_backlog_siblings(uuid, public.work_item_type, uuid)
from public, anon, authenticated;
revoke all on function public.count_work_item_descendants(uuid) from public, anon, authenticated;
revoke all on function public.move_work_item(uuid, uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.reestimate_work_item_hours(uuid, numeric, numeric)
from public, anon, authenticated;

grant execute on function public.is_task_planning_team_member(uuid) to authenticated;
grant execute on function public.create_work_item(
  uuid, public.work_item_type, text, text, public.task_priority, uuid, numeric, numeric, numeric
) to authenticated;
grant execute on function public.assign_backlog_rank(uuid, uuid, uuid) to authenticated;
grant execute on function public.rebalance_backlog_siblings(uuid, public.work_item_type, uuid)
to authenticated;
grant execute on function public.count_work_item_descendants(uuid) to authenticated;
grant execute on function public.move_work_item(uuid, uuid, boolean, uuid) to authenticated;
grant execute on function public.reestimate_work_item_hours(uuid, numeric, numeric)
to authenticated;
-- backlog_rank_midpoint stays internal: every caller reaches it indirectly
-- through the RPCs above, so it is never granted to authenticated.

-- Only story_points and remaining_hours become directly writable.
-- work_item_type, parent_task_id, planning_team_id, backlog_rank, and
-- original_hours get no grant at all: every write to those five columns
-- happens inside a security-definer function above, which writes as the
-- function owner, not as `authenticated` -- so there is no direct-SQL path
-- around the RPCs even if an RLS policy were ever misconfigured.
grant update (story_points) on public.tasks to authenticated;
grant update (remaining_hours) on public.tasks to authenticated;

-- Additive only: every existing tasks/task_activity_events policy is left
-- untouched, so non-planning task visibility is unchanged.
create policy tasks_select_planning_team_member
on public.tasks for select to authenticated
using (public.is_task_planning_team_member(id));

create policy tasks_update_planning_team_member
on public.tasks for update to authenticated
using (public.is_task_planning_team_member(id))
with check (public.is_task_planning_team_member(id));

create policy task_activity_view_planning_team_member
on public.task_activity_events for select to authenticated
using (public.is_task_planning_team_member(task_id));
