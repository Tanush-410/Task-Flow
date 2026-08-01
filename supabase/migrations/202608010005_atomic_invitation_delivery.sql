create type public.invitation_delivery_status
as enum ('pending_delivery', 'active', 'failed');

alter table public.invitations
add column delivery_status public.invitation_delivery_status not null default 'active';

drop trigger if exists invitations_replace_pending on public.invitations;
drop index if exists public.invitations_one_pending_per_organization_email_idx;

create unique index invitations_one_active_per_organization_email_idx
on public.invitations (organization_id, lower(btrim(email)))
where delivery_status = 'active'
  and accepted_at is null
  and revoked_at is null;

create or replace function public.stage_invitation(
  invitation_email text,
  invitation_role public.membership_role,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns table (id uuid, email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_organization_id uuid;
begin
  if auth.uid() is null
    or lower(btrim(invitation_email)) = ''
    or invitation_token_hash !~ '^[0-9a-f]{64}$'
    or invitation_expires_at <= statement_timestamp()
    or invitation_expires_at > statement_timestamp() + interval '8 days' then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  select membership.organization_id
  into admin_organization_id
  from public.organization_memberships as membership
  where membership.user_id = auth.uid()
    and membership.role = 'admin'
    and membership.status = 'active';

  if admin_organization_id is null then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  if exists (
    select 1
    from public.organization_memberships as membership
    join auth.users as member_user on member_user.id = membership.user_id
    where membership.organization_id = admin_organization_id
      and membership.status = 'active'
      and lower(btrim(member_user.email)) = lower(btrim(invitation_email))
  ) then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  return query
  insert into public.invitations (
    organization_id, email, role, token_hash, invited_by, expires_at,
    delivery_status
  ) values (
    admin_organization_id, lower(btrim(invitation_email)), invitation_role,
    invitation_token_hash, auth.uid(), invitation_expires_at,
    'pending_delivery'
  )
  returning invitations.id, invitations.email, invitations.expires_at;
end;
$$;

create or replace function public.finalize_invitation_delivery(invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  staged public.invitations%rowtype;
  staged_email text;
  staged_organization_id uuid;
begin
  select candidate.organization_id, lower(btrim(candidate.email))
  into staged_organization_id, staged_email
  from public.invitations as candidate
  where candidate.id = invitation_id
    and candidate.delivery_status = 'pending_delivery'
    and public.is_admin(candidate.organization_id);
  if not found then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(staged_organization_id::text || ':' || staged_email, 0)
  );

  select candidate.* into staged
  from public.invitations as candidate
  where candidate.id = invitation_id
    and candidate.delivery_status = 'pending_delivery'
    and candidate.revoked_at is null
    and candidate.expires_at > statement_timestamp()
    and public.is_admin(candidate.organization_id)
  for update;
  if not found then raise exception using errcode = '42501', message = 'INVITATION_INVALID'; end if;

  update public.invitations as prior
  set revoked_at = statement_timestamp(), delivery_status = 'failed'
  where prior.organization_id = staged.organization_id
    and lower(btrim(prior.email)) = lower(btrim(staged.email))
    and prior.delivery_status = 'active'
    and prior.accepted_at is null
    and prior.revoked_at is null
    and prior.id <> staged.id;

  update public.invitations
  set delivery_status = 'active'
  where invitations.id = staged.id;
  return true;
end;
$$;

create or replace function public.discard_staged_invitation(invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invitations as staged
  set delivery_status = 'failed', revoked_at = statement_timestamp()
  where staged.id = invitation_id
    and staged.delivery_status = 'pending_delivery'
    and public.is_admin(staged.organization_id);
  return found;
end;
$$;

create or replace function public.revoke_invitations_on_deactivation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare member_email text;
begin
  if old.status = 'active' and new.status = 'deactivated' then
    select lower(btrim(auth_user.email)) into member_email
    from auth.users as auth_user where auth_user.id = new.user_id;
    if member_email is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(new.organization_id::text || ':' || member_email, 0)
      );
      update public.invitations as outstanding
      set revoked_at = statement_timestamp(), delivery_status = 'failed'
      where outstanding.organization_id = new.organization_id
        and lower(btrim(outstanding.email)) = member_email
        and outstanding.accepted_at is null
        and outstanding.revoked_at is null;
    end if;
  end if;
  return new;
end;
$$;

create trigger memberships_revoke_invitations_on_deactivation
after update of status on public.organization_memberships
for each row execute function public.revoke_invitations_on_deactivation();

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
  if not found or lower(btrim(invitation.email)) <> authenticated_email
    or exists (select 1 from public.organization_memberships as active_membership
      where active_membership.user_id = auth.uid() and active_membership.status = 'active') then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;
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

revoke all privileges on table public.invitations from authenticated;
grant select on public.invitations to authenticated;
revoke all on function public.stage_invitation(text, public.membership_role, text, timestamptz) from public, anon;
revoke all on function public.finalize_invitation_delivery(uuid) from public, anon;
revoke all on function public.discard_staged_invitation(uuid) from public, anon;
revoke all on function public.revoke_invitations_on_deactivation() from public, anon, authenticated;
grant execute on function public.stage_invitation(text, public.membership_role, text, timestamptz) to authenticated;
grant execute on function public.finalize_invitation_delivery(uuid) to authenticated;
grant execute on function public.discard_staged_invitation(uuid) to authenticated;
