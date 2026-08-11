create type public.planning_role as enum ('planner', 'member');

create table public.planning_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  default_sprint_length_days integer not null default 14
    check (default_sprint_length_days between 1 and 42),
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index planning_teams_org_name_unique_idx
on public.planning_teams (organization_id, lower(btrim(name)));

create index planning_teams_org_archived_idx
on public.planning_teams (organization_id, is_archived, created_at);

create trigger planning_teams_set_updated_at
before update on public.planning_teams
for each row execute function public.set_updated_at();

create table public.planning_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  planning_team_id uuid not null references public.planning_teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  planning_role public.planning_role not null default 'member',
  default_capacity_hours_per_day numeric(4,2) not null default 8
    check (default_capacity_hours_per_day between 0 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_team_members
add constraint planning_team_members_team_user_unique_idx
unique (planning_team_id, user_id);

create index planning_team_members_user_team_idx
on public.planning_team_members (user_id, planning_team_id);

create trigger planning_team_members_set_updated_at
before update on public.planning_team_members
for each row execute function public.set_updated_at();

create or replace function public.is_planning_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.planning_teams team
    where team.id = target_team_id
      and (
        public.is_admin(team.organization_id)
        or exists (
          select 1
          from public.planning_team_members member
          join public.organization_memberships organization_member
            on organization_member.organization_id = member.organization_id
           and organization_member.user_id = member.user_id
           and organization_member.status = 'active'
          where member.planning_team_id = team.id
            and member.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_planning_team_planner(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.planning_teams team
    where team.id = target_team_id
      and (
        public.is_admin(team.organization_id)
        or exists (
          select 1
          from public.planning_team_members member
          join public.organization_memberships organization_member
            on organization_member.organization_id = member.organization_id
           and organization_member.user_id = member.user_id
           and organization_member.status = 'active'
          where member.planning_team_id = team.id
            and member.user_id = auth.uid()
            and member.planning_role = 'planner'
        )
      )
  );
$$;

create or replace function public.validate_planning_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_organization_id uuid;
begin
  select organization_id into team_organization_id
  from public.planning_teams
  where id = new.planning_team_id;

  if team_organization_id is null or team_organization_id <> new.organization_id then
    raise exception using errcode = '23514', message = 'planning team organization mismatch';
  end if;

  if not exists (
    select 1
    from public.organization_memberships
    where organization_id = new.organization_id
      and user_id = new.user_id
      and status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'planning team member must be active in organization';
  end if;

  return new;
end;
$$;

create trigger planning_team_members_validate
before insert or update of organization_id, planning_team_id, user_id
on public.planning_team_members
for each row execute function public.validate_planning_team_member();

create or replace function public.prevent_planning_member_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id = auth.uid()
    and new.planning_role is distinct from old.planning_role
    and not public.is_admin(old.organization_id) then
    raise exception using
      errcode = '42501',
      message = 'planning team members cannot change their own role';
  end if;

  return new;
end;
$$;

create trigger planning_team_members_protect_self_role
before update of planning_role on public.planning_team_members
for each row execute function public.prevent_planning_member_self_role_change();

create or replace function public.archive_planning_team(target_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select organization_id into target_organization_id
  from public.planning_teams
  where id = target_team_id;

  if target_organization_id is null or not public.is_admin(target_organization_id) then
    raise exception using errcode = '42501', message = 'planning team admin access required';
  end if;

  update public.planning_teams
  set is_archived = true
  where id = target_team_id and is_archived = false;

  return found;
end;
$$;

create or replace function public.replace_planning_team_members(
  target_team_id uuid,
  replacement_members jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  actor_is_admin boolean;
begin
  if auth.uid() is null
    or replacement_members is null
    or jsonb_typeof(replacement_members) <> 'array'
    or jsonb_array_length(replacement_members) > 500 then
    raise exception using errcode = '22023', message = 'invalid planning team roster';
  end if;

  select organization_id into target_organization_id
  from public.planning_teams
  where id = target_team_id
  for update;

  if target_organization_id is null then
    raise exception using errcode = '42501', message = 'planning team planner access required';
  end if;

  actor_is_admin := public.is_admin(target_organization_id);
  if not actor_is_admin and not public.is_planning_team_planner(target_team_id) then
    raise exception using errcode = '42501', message = 'planning team planner access required';
  end if;

  perform 1
  from public.planning_team_members
  where planning_team_id = target_team_id
  for update;

  if exists (
    select 1
    from jsonb_to_recordset(replacement_members) as member(
      user_id uuid,
      planning_role text,
      default_capacity_hours_per_day numeric
    )
    where member.user_id is null
      or member.planning_role not in ('planner', 'member')
      or member.default_capacity_hours_per_day is null
      or member.default_capacity_hours_per_day < 0
      or member.default_capacity_hours_per_day > 24
  ) or (
    select count(*) <> count(distinct member.user_id)
    from jsonb_to_recordset(replacement_members) as member(user_id uuid)
  ) then
    raise exception using errcode = '22023', message = 'invalid planning team roster';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(replacement_members) as member(user_id uuid)
    left join public.organization_memberships as organization_member
      on organization_member.organization_id = target_organization_id
     and organization_member.user_id = member.user_id
     and organization_member.status = 'active'
    where organization_member.id is null
  ) then
    raise exception using errcode = '23514', message = 'planning team member must be active in organization';
  end if;

  if not actor_is_admin and not exists (
    select 1
    from jsonb_to_recordset(replacement_members) as member(
      user_id uuid,
      planning_role text
    )
    where member.user_id = auth.uid()
      and member.planning_role = 'planner'
  ) then
    raise exception using errcode = '42501', message = 'planning team planner access required';
  end if;

  insert into public.planning_team_members (
    organization_id,
    planning_team_id,
    user_id,
    planning_role,
    default_capacity_hours_per_day
  )
  select
    target_organization_id,
    target_team_id,
    member.user_id,
    member.planning_role::public.planning_role,
    member.default_capacity_hours_per_day
  from jsonb_to_recordset(replacement_members) as member(
    user_id uuid,
    planning_role text,
    default_capacity_hours_per_day numeric
  )
  on conflict (planning_team_id, user_id) do update
  set
    planning_role = excluded.planning_role,
    default_capacity_hours_per_day = excluded.default_capacity_hours_per_day;

  delete from public.planning_team_members as existing
  where existing.planning_team_id = target_team_id
    and not exists (
      select 1
      from jsonb_to_recordset(replacement_members) as member(user_id uuid)
      where member.user_id = existing.user_id
    );

  return true;
end;
$$;

alter table public.planning_teams enable row level security;
alter table public.planning_team_members enable row level security;

revoke all on table public.planning_teams from anon, authenticated;
revoke all on table public.planning_team_members from anon, authenticated;
revoke all on function public.is_planning_team_member(uuid) from public, anon, authenticated;
revoke all on function public.is_planning_team_planner(uuid) from public, anon, authenticated;
revoke all on function public.validate_planning_team_member() from public, anon, authenticated;
revoke all on function public.prevent_planning_member_self_role_change() from public, anon, authenticated;
revoke all on function public.archive_planning_team(uuid) from public, anon, authenticated;
revoke all on function public.replace_planning_team_members(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.is_planning_team_member(uuid) to authenticated;
grant execute on function public.is_planning_team_planner(uuid) to authenticated;
grant execute on function public.archive_planning_team(uuid) to authenticated;
grant execute on function public.replace_planning_team_members(uuid, jsonb) to authenticated;

grant select, delete on public.planning_teams to authenticated;
grant insert (organization_id, name, description, default_sprint_length_days, created_by)
on public.planning_teams to authenticated;
grant update (name, description, default_sprint_length_days)
on public.planning_teams to authenticated;

grant select, delete on public.planning_team_members to authenticated;
grant insert (organization_id, planning_team_id, user_id, planning_role, default_capacity_hours_per_day)
on public.planning_team_members to authenticated;
grant update (planning_role, default_capacity_hours_per_day)
on public.planning_team_members to authenticated;

create policy planning_teams_view_member_or_admin
on public.planning_teams for select to authenticated
using (
  public.is_admin(organization_id)
  or public.is_planning_team_member(id)
);

create policy planning_teams_insert_admin
on public.planning_teams for insert to authenticated
with check (public.is_admin(organization_id) and created_by = auth.uid());

create policy planning_teams_update_planner_or_admin
on public.planning_teams for update to authenticated
using (public.is_planning_team_planner(id))
with check (public.is_planning_team_planner(id));

create policy planning_teams_delete_admin
on public.planning_teams for delete to authenticated
using (public.is_admin(organization_id));

create policy planning_team_members_view_team
on public.planning_team_members for select to authenticated
using (public.is_planning_team_member(planning_team_id));

create policy planning_team_members_insert_planner
on public.planning_team_members for insert to authenticated
with check (public.is_planning_team_planner(planning_team_id));

create policy planning_team_members_update_planner_or_self_capacity
on public.planning_team_members for update to authenticated
using (public.is_planning_team_planner(planning_team_id) or user_id = auth.uid())
with check (
  public.is_admin(organization_id)
  or (
    public.is_planning_team_planner(planning_team_id)
    and (user_id <> auth.uid() or planning_role = 'planner')
  )
  or (user_id = auth.uid() and planning_role = 'member')
);

create policy planning_team_members_delete_planner
on public.planning_team_members for delete to authenticated
using (
  public.is_admin(organization_id)
  or (
    public.is_planning_team_planner(planning_team_id)
    and user_id <> auth.uid()
  )
);

grant select on table public.feature_flags to service_role;

insert into public.feature_flags (
  key,
  environment,
  enabled,
  rollout_percentage,
  owner,
  purpose,
  rollout_plan,
  review_on,
  expires_on
)
values
  (
    'native_sprint_planning', 'development', true, 100,
    'product-engineering', 'Gate native sprint planning',
    'Enabled for local verification', '2026-09-10', '2027-08-10'
  ),
  (
    'native_sprint_planning', 'staging', false, 0,
    'product-engineering', 'Gate native sprint planning',
    'Enable after increment acceptance', '2026-09-10', '2027-08-10'
  ),
  (
    'native_sprint_planning', 'production', false, 0,
    'product-engineering', 'Gate native sprint planning',
    'Organization-scoped rollout after staging approval', '2026-09-10', '2027-08-10'
  )
on conflict (organization_id, environment, role_scope, key) do nothing;
