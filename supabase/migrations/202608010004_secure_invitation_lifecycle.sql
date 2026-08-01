alter table public.invitations
add column revoked_at timestamptz;

with ranked_pending as (
  select
    id,
    row_number() over (
      partition by organization_id, lower(btrim(email))
      order by created_at desc, id desc
    ) as pending_rank
  from public.invitations
  where accepted_at is null
    and revoked_at is null
)
update public.invitations as invitation
set revoked_at = statement_timestamp()
from ranked_pending
where invitation.id = ranked_pending.id
  and ranked_pending.pending_rank > 1;

create unique index invitations_one_pending_per_organization_email_idx
on public.invitations (organization_id, lower(btrim(email)))
where accepted_at is null
  and revoked_at is null;

create or replace function public.replace_pending_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expires_at <= statement_timestamp()
    or lower(btrim(new.email)) = ''
    or new.token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVITATION_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.organization_id::text || ':' || lower(btrim(new.email)),
      0
    )
  );

  update public.invitations as pending
  set revoked_at = statement_timestamp()
  where pending.organization_id = new.organization_id
    and lower(btrim(pending.email)) = lower(btrim(new.email))
    and pending.accepted_at is null
    and pending.revoked_at is null;

  return new;
end;
$$;

create trigger invitations_replace_pending
before insert on public.invitations
for each row execute function public.replace_pending_invitation();

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
  bootstrap_allowed boolean;
  identity_verified boolean;
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'BOOTSTRAP_DENIED';
  end if;

  select
    auth_user.email_confirmed_at is not null,
    coalesce(
      auth_user.raw_app_meta_data ->> 'can_bootstrap_org' = 'true',
      false
    )
  into identity_verified, bootstrap_allowed
  from auth.users as auth_user
  where auth_user.id = auth.uid()
  for update;

  if not found or not identity_verified or not bootstrap_allowed then
    raise exception using errcode = '42501', message = 'BOOTSTRAP_DENIED';
  end if;

  if organization_name is null
    or char_length(btrim(organization_name)) not between 1 and 120 then
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
  candidate_email text;
  candidate_organization_id uuid;
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

  select candidate.organization_id, lower(btrim(candidate.email))
  into candidate_organization_id, candidate_email
  from public.invitations as candidate
  where candidate.token_hash = invitation_token_hash;

  if not found then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      candidate_organization_id::text || ':' || candidate_email,
      0
    )
  );

  select candidate.*
  into invitation
  from public.invitations as candidate
  where candidate.token_hash = invitation_token_hash
    and candidate.accepted_at is null
    and candidate.revoked_at is null
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

  update public.invitations as pending
  set revoked_at = statement_timestamp()
  where pending.organization_id = invitation.organization_id
    and lower(btrim(pending.email)) = lower(btrim(invitation.email))
    and pending.accepted_at is null
    and pending.revoked_at is null
    and pending.id <> invitation.id;

  return query
  select invitation.organization_id, invitation.role;
exception
  when unique_violation then
    raise exception using errcode = '42501', message = 'INVITATION_INVALID';
end;
$$;

revoke all on function public.replace_pending_invitation() from public, anon, authenticated;
revoke all on function public.bootstrap_organization(text, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.bootstrap_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
