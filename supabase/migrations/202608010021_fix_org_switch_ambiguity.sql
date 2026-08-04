-- Bugfix: both accept_invitation and respond_to_connection_request declare
-- RETURNS TABLE(organization_id uuid, role membership_role, ...), which
-- creates implicit PL/pgSQL variables literally named organization_id and
-- role. The deactivation UPDATE added in 202608010020 referenced a bare
-- (unqualified) organization_id in its WHERE clause, which PL/pgSQL
-- resolves against those implicit variables instead of the
-- organization_memberships column, raising "column reference
-- organization_id is ambiguous" on every accept attempt — reproduced live:
-- every switch-org accept failed with a generic error. Fixed by aliasing
-- the target table and qualifying every column, matching the convention
-- already used elsewhere in this file (e.g. create_connection_request's
-- "as membership" checks).

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
