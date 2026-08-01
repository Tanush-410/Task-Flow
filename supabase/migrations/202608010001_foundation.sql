create extension if not exists pgcrypto;

create type public.membership_role as enum ('admin', 'employee');
create type public.membership_status as enum ('active', 'deactivated');

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
  invited_by uuid not null references public.profiles (id),
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
  enabled boolean not null default false,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  owner text not null,
  review_on date not null,
  unique nulls not distinct (organization_id, key)
);

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

revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.feature_flags enable row level security;

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

create policy members_view_flags
on public.feature_flags
for select
to authenticated
using (
  organization_id is null
  or public.is_active_member(organization_id)
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

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.feature_flags to authenticated;
