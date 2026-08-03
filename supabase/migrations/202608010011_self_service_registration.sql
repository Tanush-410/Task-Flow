-- Open self-service registration: an authenticated user can either found a new
-- organization as its first Admin, or join an existing organization as an
-- Employee, without an invitation or the privileged `can_bootstrap_org` gate
-- used by `bootstrap_organization`. That function remains untouched for the
-- existing ops-controlled bootstrap path; this is an additive, deliberately
-- open alternative.

create or replace function public.register_organization_admin(
  organization_name text,
  organization_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'REGISTRATION_DENIED';
  end if;

  if organization_name is null
    or char_length(btrim(organization_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'REGISTRATION_INVALID';
  end if;

  if organization_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = organization_timezone
  ) then
    raise exception using errcode = '22023', message = 'REGISTRATION_INVALID';
  end if;

  perform 1
  from public.profiles
  where id = auth.uid()
  for update;

  if not found or exists (
    select 1
    from public.organization_memberships
    where user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'REGISTRATION_DENIED';
  end if;

  insert into public.organizations (name, timezone, created_by)
  values (btrim(organization_name), organization_timezone, auth.uid())
  returning id into new_organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (new_organization_id, auth.uid(), 'admin', 'active');

  return new_organization_id;
end;
$$;

create or replace function public.join_organization_as_employee(
  target_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or target_organization_id is null then
    raise exception using errcode = '42501', message = 'REGISTRATION_DENIED';
  end if;

  perform 1
  from public.profiles
  where id = auth.uid()
  for update;

  if not found or exists (
    select 1
    from public.organization_memberships
    where user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'REGISTRATION_DENIED';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = target_organization_id
  ) then
    raise exception using errcode = '22023', message = 'REGISTRATION_INVALID';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (target_organization_id, auth.uid(), 'employee', 'active');

  return target_organization_id;
end;
$$;

revoke all on function public.register_organization_admin(text, text) from public, anon;
revoke all on function public.join_organization_as_employee(uuid) from public, anon;
grant execute on function public.register_organization_admin(text, text) to authenticated;
grant execute on function public.join_organization_as_employee(uuid) to authenticated;

-- Notifications need to reach the client without a page refresh; add the
-- table to the default realtime publication so authenticated clients can
-- subscribe to postgres_changes for their own rows (RLS still applies).
alter publication supabase_realtime add table public.task_notifications;
