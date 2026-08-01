create extension if not exists pgcrypto;

create type public.membership_role as enum ('admin', 'employee');
create type public.membership_status as enum ('active', 'deactivated');
create type public.deployment_environment as enum ('development', 'staging', 'production');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null default 'Asia/Kolkata',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_id_status_idx
on public.organization_memberships (user_id, status, organization_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.membership_role not null,
  token_hash text not null unique,
  invited_by uuid not null default auth.uid() references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_organization_id_idx
on public.invitations (organization_id);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  key text not null,
  environment public.deployment_environment not null,
  role_scope public.membership_role,
  enabled boolean not null default false,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  owner text not null,
  purpose text not null,
  rollout_plan text not null,
  review_on date not null,
  expires_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(owner)) > 0),
  check (char_length(btrim(purpose)) > 0),
  check (char_length(btrim(rollout_plan)) > 0),
  check (review_on >= created_at::date),
  check (review_on <= expires_on),
  unique nulls not distinct (organization_id, environment, role_scope, key)
);

create table public.feature_flag_audit_log (
  id uuid primary key default gen_random_uuid(),
  feature_flag_id uuid not null,
  organization_id uuid,
  flag_key text not null,
  changed_by uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_record jsonb,
  new_record jsonb,
  changed_at timestamptz not null default now()
);

create index feature_flag_audit_log_organization_changed_at_idx
on public.feature_flag_audit_log (organization_id, changed_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'User'
      ),
      100
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

create or replace function public.validate_organization_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception using
      errcode = 'check_violation',
      message = format('invalid organization timezone: %s', new.timezone);
  end if;

  return new;
end;
$$;

create trigger organizations_validate_timezone
before insert or update of timezone on public.organizations
for each row execute function public.validate_organization_timezone();

create or replace function public.is_active_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function public.is_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role = 'admin'
      and membership.status = 'active'
  );
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.user_id = auth.uid()
      and membership.role = 'admin'
      and membership.status = 'active'
  );
$$;

create or replace function public.protect_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removes_active_admin boolean := false;
begin
  if old.role = 'admin' and old.status = 'active' then
    if tg_op = 'DELETE' then
      removes_active_admin := true;
    elsif new.role <> 'admin' or new.status <> 'active' then
      removes_active_admin := true;
    end if;
  end if;

  if removes_active_admin then
    perform 1
    from public.organizations
    where id = old.organization_id
    for update;

    if not found then
      return old;
    end if;

    if not exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = old.organization_id
        and membership.id <> old.id
        and membership.role = 'admin'
        and membership.status = 'active'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'organization must retain at least one active admin';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger memberships_protect_last_active_admin
before update of role, status or delete on public.organization_memberships
for each row execute function public.protect_last_active_admin();

create or replace function public.audit_feature_flag_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.feature_flag_audit_log (
    feature_flag_id,
    organization_id,
    flag_key,
    changed_by,
    action,
    old_record,
    new_record
  )
  values (
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op = 'DELETE' then old.organization_id else new.organization_id end,
    case when tg_op = 'DELETE' then old.key else new.key end,
    auth.uid(),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger feature_flags_audit_changes
after insert or update or delete on public.feature_flags
for each row execute function public.audit_feature_flag_change();

create or replace function public.prevent_feature_flag_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'check_violation',
    message = 'feature flag audit records are append-only';
end;
$$;

create trigger feature_flag_audit_log_append_only
before update or delete on public.feature_flag_audit_log
for each row execute function public.prevent_feature_flag_audit_mutation();

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_organization_timezone() from public, anon, authenticated;
revoke all on function public.is_active_member(uuid) from public, anon, authenticated;
revoke all on function public.is_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_active_admin() from public, anon, authenticated;
revoke all on function public.protect_last_active_admin() from public, anon, authenticated;
revoke all on function public.audit_feature_flag_change() from public, anon, authenticated;
revoke all on function public.prevent_feature_flag_audit_mutation() from public, anon, authenticated;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.invitations from anon, authenticated;
revoke all on table public.feature_flags from anon, authenticated;
revoke all on table public.feature_flag_audit_log from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_active_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_flag_audit_log enable row level security;

create policy profiles_view_self_or_coworker
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_memberships as mine
    join public.organization_memberships as theirs
      using (organization_id)
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = profiles.id
      and theirs.status = 'active'
  )
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy members_view_organization
on public.organizations
for select
to authenticated
using (public.is_active_member(id));

create policy admins_update_organization
on public.organizations
for update
to authenticated
using (public.is_admin(id))
with check (public.is_admin(id));

create policy members_view_memberships
on public.organization_memberships
for select
to authenticated
using (public.is_active_member(organization_id));

create policy admins_manage_memberships
on public.organization_memberships
for all
to authenticated
using (public.is_admin(organization_id))
with check (public.is_admin(organization_id));

create policy admins_manage_invitations
on public.invitations
for all
to authenticated
using (public.is_admin(organization_id))
with check (public.is_admin(organization_id));

create policy admins_view_flags
on public.feature_flags
for select
to authenticated
using (
  (organization_id is null and public.is_active_admin())
  or public.is_admin(organization_id)
);

create policy admins_manage_flags
on public.feature_flags
for all
to authenticated
using (
  organization_id is not null
  and public.is_admin(organization_id)
)
with check (
  organization_id is not null
  and public.is_admin(organization_id)
);

create policy admins_view_flag_audit_log
on public.feature_flag_audit_log
for select
to authenticated
using (
  (organization_id is null and public.is_active_admin())
  or public.is_admin(organization_id)
);

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.organizations to authenticated;
grant update (name, timezone) on public.organizations to authenticated;

grant select, delete on public.organization_memberships to authenticated;
grant insert (organization_id, user_id, role, status)
on public.organization_memberships to authenticated;
grant update (role, status) on public.organization_memberships to authenticated;

grant select, delete on public.invitations to authenticated;
grant insert (organization_id, email, role, token_hash, expires_at)
on public.invitations to authenticated;
grant update (role, expires_at, accepted_at) on public.invitations to authenticated;

grant select, delete on public.feature_flags to authenticated;
grant insert (
  organization_id,
  key,
  environment,
  role_scope,
  enabled,
  rollout_percentage,
  owner,
  purpose,
  rollout_plan,
  review_on,
  expires_on
)
on public.feature_flags to authenticated;
grant update (
  enabled,
  rollout_percentage,
  owner,
  purpose,
  rollout_plan,
  review_on,
  expires_on
)
on public.feature_flags to authenticated;

grant select on public.feature_flag_audit_log to authenticated;
