-- Short, human-friendly connect codes on every profile, plus a
-- consent-required "request to join by code" flow, as an alternative to
-- the email invite-link flow: an admin enters someone's code, the
-- targeted person still has to accept before they're added to the org.

create or replace function public.generate_connect_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.profiles where connect_code = code
    );
  end loop;
  return code;
end;
$$;

alter table public.profiles add column connect_code text;

update public.profiles
set connect_code = public.generate_connect_code()
where connect_code is null;

alter table public.profiles
alter column connect_code set not null,
add constraint profiles_connect_code_unique unique (connect_code);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, connect_code)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'User'
      ),
      100
    ),
    public.generate_connect_code()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null,
  invited_by uuid not null default auth.uid() references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (organization_id, requested_user_id)
);

create index connection_requests_requested_user_id_idx
on public.connection_requests (requested_user_id);

alter table public.connection_requests enable row level security;

create policy admins_manage_connection_requests
on public.connection_requests
for all
to authenticated
using (public.is_admin(organization_id))
with check (public.is_admin(organization_id));

create policy target_views_own_connection_requests
on public.connection_requests
for select
to authenticated
using (requested_user_id = auth.uid());

create or replace function public.create_connection_request(
  target_code text,
  target_role public.membership_role
)
returns table (request_id uuid, target_display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_organization_id uuid;
  target_user_id uuid;
  target_name text;
  new_request_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  select membership.organization_id
  into admin_organization_id
  from public.organization_memberships as membership
  where membership.user_id = auth.uid()
    and membership.role = 'admin'
    and membership.status = 'active';

  if admin_organization_id is null then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  select profile.id, profile.display_name
  into target_user_id, target_name
  from public.profiles as profile
  where profile.connect_code = upper(btrim(target_code));

  if target_user_id is null then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  if exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = admin_organization_id
      and membership.user_id = target_user_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  insert into public.connection_requests (
    organization_id, requested_user_id, role, invited_by, status, responded_at
  ) values (
    admin_organization_id, target_user_id, target_role, auth.uid(), 'pending', null
  )
  on conflict (organization_id, requested_user_id) do update
  set role = excluded.role,
    status = 'pending',
    invited_by = excluded.invited_by,
    created_at = statement_timestamp(),
    responded_at = null
  returning id into new_request_id;

  return query select new_request_id, target_name;
end;
$$;

create or replace function public.respond_to_connection_request(
  request_id uuid,
  accept boolean
)
returns table (organization_id uuid, role public.membership_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.connection_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  select candidate.*
  into request
  from public.connection_requests as candidate
  where candidate.id = request_id
    and candidate.requested_user_id = auth.uid()
    and candidate.status = 'pending'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  if not accept then
    update public.connection_requests
    set status = 'declined', responded_at = statement_timestamp()
    where connection_requests.id = request.id;
    return query select null::uuid, null::public.membership_role;
    return;
  end if;

  if exists (
    select 1
    from public.organization_memberships as active_membership
    where active_membership.user_id = auth.uid()
      and active_membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (request.organization_id, auth.uid(), request.role, 'active')
  on conflict (organization_id, user_id) do update
  set role = excluded.role, status = 'active';

  update public.connection_requests
  set status = 'accepted', responded_at = statement_timestamp()
  where connection_requests.id = request.id;

  return query select request.organization_id, request.role;
end;
$$;

-- The target of a request isn't a member of the org (or a coworker of the
-- inviting admin) yet, so profiles_view_self_or_coworker / the org's own
-- select policy don't let a plain client-side join resolve the org name or
-- inviter's name for them. Same "security definer, minimal fields only"
-- pattern as create_connection_request's code lookup.
create or replace function public.list_my_connection_requests()
returns table (
  id uuid,
  organization_name text,
  role public.membership_role,
  invited_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    organization.name,
    request.role,
    inviter.display_name,
    request.created_at
  from public.connection_requests as request
  join public.organizations as organization on organization.id = request.organization_id
  join public.profiles as inviter on inviter.id = request.invited_by
  where request.requested_user_id = auth.uid()
    and request.status = 'pending'
  order by request.created_at desc;
$$;

revoke all on function public.generate_connect_code() from public, anon, authenticated;
revoke all on function public.create_connection_request(text, public.membership_role) from public, anon;
revoke all on function public.respond_to_connection_request(uuid, boolean) from public, anon;
revoke all on function public.list_my_connection_requests() from public, anon;
grant execute on function public.create_connection_request(text, public.membership_role) to authenticated;
grant execute on function public.respond_to_connection_request(uuid, boolean) to authenticated;
grant execute on function public.list_my_connection_requests() to authenticated;

revoke all privileges on table public.connection_requests from authenticated;
grant select on public.connection_requests to authenticated;
