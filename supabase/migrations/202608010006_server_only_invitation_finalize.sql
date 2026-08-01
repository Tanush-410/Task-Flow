create or replace function public.stage_invitation(
  invitation_email text,
  invitation_role public.membership_role,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns table (id uuid, email text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare admin_organization_id uuid;
begin
  if auth.uid() is null
    or invitation_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or invitation_token_hash !~ '^[0-9a-f]{64}$'
    or invitation_expires_at <= statement_timestamp()
    or invitation_expires_at > statement_timestamp() + interval '8 days' then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;
  select membership.organization_id into admin_organization_id
  from public.organization_memberships as membership
  where membership.user_id = auth.uid() and membership.role = 'admin' and membership.status = 'active';
  if admin_organization_id is null or exists (
    select 1 from public.organization_memberships as membership
    join auth.users as member_user on member_user.id = membership.user_id
    where membership.organization_id = admin_organization_id and membership.status = 'active'
      and lower(btrim(member_user.email)) = lower(btrim(invitation_email))
  ) then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;
  return query insert into public.invitations (
    organization_id, email, role, token_hash, invited_by, expires_at, delivery_status
  ) values (
    admin_organization_id, lower(btrim(invitation_email)), invitation_role,
    invitation_token_hash, auth.uid(), invitation_expires_at, 'pending_delivery'
  ) returning invitations.id, invitations.email, invitations.expires_at;
end;
$$;

revoke all on function public.finalize_invitation_delivery(uuid) from public, anon, authenticated;
grant execute on function public.finalize_invitation_delivery(uuid) to service_role;
