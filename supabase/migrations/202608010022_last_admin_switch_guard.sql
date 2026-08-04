-- The org-switch-on-accept behavior (202608010020/21) can collide with a
-- pre-existing, correct safety rail: memberships_protect_last_active_admin
-- (202608010001) refuses to deactivate an organization's last active admin,
-- to avoid ever orphaning an org with nobody able to manage it. Reproduced
-- live: a sole-admin account trying to accept elsewhere got a raw
-- "organization must retain at least one active admin" constraint error
-- surfaced as a generic failure. Add an explicit, friendlier pre-check with
-- a distinct message so the app can explain *why*, instead of relying on
-- the constraint violation to fail unexplained. The constraint itself stays
-- as the final backstop either way.

create or replace function public.accept_invitation(invitation_token_hash text)
returns table (organization_id uuid, role public.membership_role)
language plpgsql security definer set search_path = '' as $$
declare authenticated_email text; candidate_email text; candidate_organization_id uuid; invitation public.invitations%rowtype;
begin
  if auth.uid() is null or invitation_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;
  select lower(btrim(auth_user.email)) into authenticated_email
  from auth.users as auth_user
  where auth_user.id = auth.uid() and auth_user.email_confirmed_at is not null for update;
  if authenticated_email is null then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;
  select candidate.organization_id, lower(btrim(candidate.email))
  into candidate_organization_id, candidate_email
  from public.invitations as candidate where candidate.token_hash = invitation_token_hash;
  if not found then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(candidate_organization_id::text || ':' || candidate_email, 0)
  );
  select candidate.* into invitation from public.invitations as candidate
  where candidate.token_hash = invitation_token_hash
    and candidate.delivery_status = 'active'
    and candidate.accepted_at is null and candidate.revoked_at is null
    and candidate.expires_at > statement_timestamp() for update;
  if not found or lower(btrim(invitation.email)) <> authenticated_email then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  if exists (
    select 1
    from public.organization_memberships as membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = 'admin'
      and membership.organization_id <> invitation.organization_id
      and not exists (
        select 1
        from public.organization_memberships as other_admin
        where other_admin.organization_id = membership.organization_id
          and other_admin.role = 'admin'
          and other_admin.status = 'active'
          and other_admin.user_id <> auth.uid()
      )
  ) then
    raise exception using errcode = '42501', message = 'LAST_ADMIN_CANNOT_SWITCH';
  end if;

  update public.organization_memberships as membership
  set status = 'deactivated'
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and membership.organization_id <> invitation.organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (invitation.organization_id, auth.uid(), invitation.role, 'active')
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
  update public.invitations set accepted_at = statement_timestamp() where invitations.id = invitation.id;
  update public.invitations as sibling set revoked_at = statement_timestamp(), delivery_status = 'failed'
  where sibling.organization_id = invitation.organization_id
    and lower(btrim(sibling.email)) = lower(btrim(invitation.email))
    and sibling.accepted_at is null and sibling.revoked_at is null and sibling.id <> invitation.id;
  return query select invitation.organization_id, invitation.role;
exception when unique_violation then
  raise exception using errcode = '42501', message = 'INVITATION_INVALID';
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
    from public.organization_memberships as membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = 'admin'
      and membership.organization_id <> request.organization_id
      and not exists (
        select 1
        from public.organization_memberships as other_admin
        where other_admin.organization_id = membership.organization_id
          and other_admin.role = 'admin'
          and other_admin.status = 'active'
          and other_admin.user_id <> auth.uid()
      )
  ) then
    raise exception using errcode = '42501', message = 'LAST_ADMIN_CANNOT_SWITCH';
  end if;

  update public.organization_memberships as membership
  set status = 'deactivated'
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and membership.organization_id <> request.organization_id;

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
