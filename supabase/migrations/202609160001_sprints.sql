-- Real sprints. Until now "sprint planning" was a ranked backlog with no
-- iteration dimension at all -- planning_teams.default_sprint_length_days
-- (202608100001) was stored but never used in any date calculation, and
-- there was no way to say "these tasks are in Sprint 3." This adds the
-- missing entity and a single nullable link from tasks into it.

create type public.sprint_status as enum ('planned', 'active', 'completed');

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  planning_team_id uuid not null references public.planning_teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status public.sprint_status not null default 'planned',
  created_by uuid references public.profiles (id), -- nullable: an author leaving (delete_own_account, 202609150001) must not block the sprint from existing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mirrors organization_memberships_one_active_per_user_idx's "one active X
-- at a time" pattern (202608010001) -- keeps "the current sprint" an
-- unambiguous concept per team without forbidding multiple planned/
-- completed sprints to coexist.
create unique index sprints_one_active_per_team_idx
on public.sprints (planning_team_id) where status = 'active';

create index sprints_team_status_idx on public.sprints (planning_team_id, status, start_date);

create trigger sprints_set_updated_at
before update on public.sprints
for each row execute function public.set_updated_at();

alter table public.tasks add column sprint_id uuid references public.sprints (id) on delete set null;

-- Defensive backstop for the app-level fix in move_work_item below: a
-- sprint belongs to exactly one team, so a task's sprint_id must always
-- point at a sprint from the task's own planning_team_id. Same
-- "app handles it, DB refuses to let it drift" pairing as
-- validate_work_item_hierarchy (202608120001).
create or replace function public.validate_task_sprint_team()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sprint_team_id uuid;
begin
  if new.sprint_id is null then
    return new;
  end if;

  select planning_team_id into sprint_team_id
  from public.sprints
  where id = new.sprint_id;

  if sprint_team_id is null or sprint_team_id is distinct from new.planning_team_id then
    raise exception using errcode = '23514', message = 'sprint must belong to the task''s own planning team';
  end if;

  return new;
end;
$$;

create trigger tasks_validate_sprint_team
before insert or update of sprint_id, planning_team_id on public.tasks
for each row execute function public.validate_task_sprint_team();

alter table public.sprints enable row level security;

create policy sprints_view_team_member
on public.sprints for select to authenticated
using (public.is_planning_team_member(planning_team_id));

create policy sprints_manage_planner_or_admin
on public.sprints for all to authenticated
using (public.is_planning_team_planner(planning_team_id))
with check (public.is_planning_team_planner(planning_team_id));

grant select, insert, update, delete on public.sprints to authenticated;

-- Column-level grant, matching this schema's existing practice for tasks
-- (story_points, remaining_hours, repro_steps, ... -- 202608120001,
-- 202608130002 -- never a blanket "grant update on tasks"). The existing
-- tasks_update_planning_team_member policy (any team member, not just
-- planner, 202608120001) already covers row-level access once this grant
-- exists.
grant update (sprint_id) on public.tasks to authenticated;

-- Cross-team moves must clear sprint_id -- a sprint belongs to one team,
-- so a task moved to a different team can't stay in that old team's
-- sprint. Re-created in full since CREATE OR REPLACE can't change
-- semantics hidden inside the function body without restating it (the
-- signature and return type are unchanged here, so this stays a plain
-- CREATE OR REPLACE, unlike 202609151001's respond_to_connection_request
-- case which had to rename RETURNS TABLE columns).
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
  changing_team boolean;
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

  changing_team := target_row.planning_team_id is distinct from resolved_team_id;
  descendant_count := 0;
  if changing_team then
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
    backlog_rank = public.backlog_rank_midpoint(last_rank, null),
    sprint_id = case when changing_team then null else sprint_id end
  where id = target_task_id;

  if descendant_count > 0 then
    frontier := array[target_task_id];
    loop
      select array_agg(id) into next_frontier
      from public.tasks
      where parent_task_id = any(frontier);

      exit when next_frontier is null;

      update public.tasks
      set planning_team_id = resolved_team_id,
        sprint_id = case when changing_team then null else sprint_id end
      where id = any(next_frontier);

      frontier := next_frontier;
    end loop;

    moved_count := moved_count + descendant_count;
  end if;

  return moved_count;
end;
$$;
