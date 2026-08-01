create or replace function public.finalize_invitation_delivery(invitation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare staged public.invitations%rowtype; staged_email text; staged_organization_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;
  select candidate.organization_id, lower(btrim(candidate.email))
  into staged_organization_id, staged_email from public.invitations as candidate
  where candidate.id = invitation_id and candidate.delivery_status = 'pending_delivery';
  if not found then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(staged_organization_id::text || ':' || staged_email, 0)
  );
  select candidate.* into staged from public.invitations as candidate
  where candidate.id = invitation_id and candidate.delivery_status = 'pending_delivery'
    and candidate.revoked_at is null and candidate.expires_at > statement_timestamp() for update;
  if not found then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;
  update public.invitations as prior set revoked_at = statement_timestamp(), delivery_status = 'failed'
  where prior.organization_id = staged.organization_id
    and lower(btrim(prior.email)) = lower(btrim(staged.email))
    and prior.delivery_status = 'active' and prior.accepted_at is null
    and prior.revoked_at is null and prior.id <> staged.id;
  update public.invitations set delivery_status = 'active' where invitations.id = staged.id;
  return true;
end;
$$;

revoke all on function public.finalize_invitation_delivery(uuid) from public, anon, authenticated;
grant execute on function public.finalize_invitation_delivery(uuid) to service_role;
