create or replace function public.bootstrap_organization(
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
    raise exception using errcode = '42501', message = 'BOOTSTRAP_DENIED';
  end if;

  if coalesce(
    auth.jwt() -> 'app_metadata' ->> 'can_bootstrap_org',
    'false'
  ) <> 'true' then
    raise exception using errcode = '42501', message = 'BOOTSTRAP_DENIED';
  end if;

  if char_length(btrim(organization_name)) not between 1 and 120
    or organization_name is null then
    raise exception using errcode = '22023', message = 'BOOTSTRAP_INVALID';
  end if;

  if organization_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = organization_timezone
  ) then
    raise exception using errcode = '22023', message = 'BOOTSTRAP_INVALID';
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
    raise exception using errcode = '42501', message = 'BOOTSTRAP_DENIED';
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

create or replace function public.accept_invitation(invitation_token_hash text)
returns table (organization_id uuid, role public.membership_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_email text;
  invitation public.invitations%rowtype;
begin
  if auth.uid() is null
    or invitation_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  select lower(btrim(auth_user.email))
  into authenticated_email
  from auth.users as auth_user
  where auth_user.id = auth.uid()
    and auth_user.email_confirmed_at is not null
  for update;

  if authenticated_email is null then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  select candidate.*
  into invitation
  from public.invitations as candidate
  where candidate.token_hash = invitation_token_hash
    and candidate.accepted_at is null
    and candidate.expires_at > statement_timestamp()
  for update;

  if not found
    or lower(btrim(invitation.email)) <> authenticated_email
    or exists (
      select 1
      from public.organization_memberships as active_membership
      where active_membership.user_id = auth.uid()
        and active_membership.status = 'active'
    ) then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (invitation.organization_id, auth.uid(), invitation.role, 'active')
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      status = 'active';

  update public.invitations
  set accepted_at = statement_timestamp()
  where id = invitation.id;

  return query
  select invitation.organization_id, invitation.role;
exception
  when unique_violation then
    -- Includes organization_memberships_one_active_per_user_idx races.
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
end;
$$;

revoke all on function public.bootstrap_organization(text, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.bootstrap_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
