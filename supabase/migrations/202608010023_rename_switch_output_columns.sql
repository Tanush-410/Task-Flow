-- Root cause, finally confirmed via a live Postgres log entry (internal_query_pos
-- pointed exactly at the "(" in `on conflict (organization_id, user_id)`):
-- ON CONFLICT's column-list is NOT exempt from PL/pgSQL's ambiguous
-- variable-vs-column-name resolution, contrary to what the two previous
-- migrations assumed. Because ON CONFLICT (col, col) syntax requires bare,
-- unqualified column names — `table.column` isn't valid there — aliasing
-- the target table (the fix used everywhere else) cannot fix this specific
-- clause. The only real fix is to stop having a PL/pgSQL variable (here, the
-- RETURNS TABLE output columns) share a name with any table column these
-- functions touch. Renamed organization_id/role -> out_organization_id/
-- out_role throughout both functions; the app layer is updated to match in
-- the same commit as this migration.
--
-- CREATE OR REPLACE FUNCTION cannot change a function's RETURNS TABLE
-- column names (Postgres: "cannot change return type of existing function
-- ... Row type defined by OUT parameters is different") — the function has
-- to be dropped and recreated, which also drops its grants, so those are
-- reapplied at the end exactly as originally set in
-- 202608010003/202608010004 (accept_invitation) and 202608010019
-- (respond_to_connection_request).

drop function if exists public.accept_invitation(text);
drop function if exists public.respond_to_connection_request(uuid, boolean);

create function public.accept_invitation(invitation_token_hash text)
returns table (out_organization_id uuid, out_role public.membership_role)
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

create function public.respond_to_connection_request(
  request_id uuid,
  accept boolean
)
returns table (out_organization_id uuid, out_role public.membership_role)
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

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
revoke all on function public.respond_to_connection_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_connection_request(uuid, boolean) to authenticated;
