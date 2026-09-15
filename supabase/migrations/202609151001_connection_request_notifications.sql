-- Connection requests (an admin adding someone by their connect code) never
-- notified anyone. The target had no way to discover a pending request
-- short of manually opening their Profile page, and the inviting admin had
-- no way to know whether it was ever seen -- reported as "people aren't
-- getting the invite" when an admin adds their code. Task notifications
-- already have a working delivery pipeline (poll + toast + bell badge,
-- see NotificationBell); connection requests just never fed it.

alter type public.task_notification_type add value if not exists 'connection_request_received';
alter type public.task_notification_type add value if not exists 'connection_request_responded';

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
  admin_organization_name text;
  target_user_id uuid;
  target_name text;
  new_request_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'CONNECTION_REQUEST_INVALID';
  end if;

  select membership.organization_id, organization.name
  into admin_organization_id, admin_organization_name
  from public.organization_memberships as membership
  join public.organizations as organization on organization.id = membership.organization_id
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

  insert into public.task_notifications (
    organization_id, recipient_id, notification_type, title, body, payload
  ) values (
    admin_organization_id,
    target_user_id,
    'connection_request_received',
    'New request to join an organization',
    coalesce(admin_organization_name, 'An organization') || ' invited you to join as ' || target_role::text || '. Review it from your profile.',
    jsonb_build_object('requestId', new_request_id)
  );

  return query select new_request_id, target_name;
end;
$$;

-- respond_to_connection_request's RETURNS TABLE column names were renamed
-- to out_organization_id/out_role by 202608010023 (ON CONFLICT's
-- column-list can't disambiguate a PL/pgSQL variable from a same-named
-- table column) -- CREATE OR REPLACE cannot change RETURNS TABLE column
-- names, so this has to be a drop-then-create like that migration did,
-- with grants reapplied after.
drop function if exists public.respond_to_connection_request(uuid, boolean);

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
  responder_name text;
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

  select profile.display_name into responder_name
  from public.profiles as profile
  where profile.id = auth.uid();

  if not accept then
    update public.connection_requests
    set status = 'declined', responded_at = statement_timestamp()
    where connection_requests.id = request.id;

    if request.invited_by is not null then
      insert into public.task_notifications (
        organization_id, recipient_id, notification_type, title, body, payload
      ) values (
        request.organization_id,
        request.invited_by,
        'connection_request_responded',
        'Connection request declined',
        coalesce(responder_name, 'They') || ' declined your invitation to join.',
        jsonb_build_object('requestId', request.id, 'accepted', false)
      );
    end if;

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

  if request.invited_by is not null then
    insert into public.task_notifications (
      organization_id, recipient_id, notification_type, title, body, payload
    ) values (
      request.organization_id,
      request.invited_by,
      'connection_request_responded',
      'Connection request accepted',
      coalesce(responder_name, 'They') || ' accepted your invitation and joined.',
      jsonb_build_object('requestId', request.id, 'accepted', true)
    );
  end if;

  return query select request.organization_id, request.role;
end;
$$;

revoke all on function public.create_connection_request(text, public.membership_role) from public, anon, authenticated;
grant execute on function public.create_connection_request(text, public.membership_role) to authenticated;
revoke all on function public.respond_to_connection_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_to_connection_request(uuid, boolean) to authenticated;
