-- Promote an employee to admin, demote an admin back to employee (which is
-- also how "transfer your admin role" works: promote someone else, then
-- demote yourself). RLS's existing admins_manage_memberships policy
-- ("for all", is_admin(organization_id)) already technically permits an
-- admin to update any membership row's role in their own org, and the
-- existing protect_last_active_admin trigger (202608010001) already
-- refuses to demote an org's last active admin -- but a raw constraint
-- violation isn't a friendly error message. This RPC mirrors the same
-- "friendlier pre-check ahead of the trigger" pattern already used for
-- accept_invitation/respond_to_connection_request/delete_own_account.
create or replace function public.update_member_role(
  target_user_id uuid,
  new_role public.membership_role
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  caller_organization_id uuid;
  target_status public.membership_status;
  target_role public.membership_role;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select membership.organization_id
  into caller_organization_id
  from public.organization_memberships as membership
  where membership.user_id = auth.uid()
    and membership.role = 'admin'
    and membership.status = 'active';

  if caller_organization_id is null then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;

  select membership.status, membership.role
  into target_status, target_role
  from public.organization_memberships as membership
  where membership.organization_id = caller_organization_id
    and membership.user_id = target_user_id
  for update;

  if target_status is null or target_status <> 'active' then
    raise exception using errcode = '42501', message = 'MEMBER_NOT_FOUND';
  end if;

  if target_role = new_role then
    return;
  end if;

  if target_role = 'admin' and new_role = 'employee' and not exists (
    select 1
    from public.organization_memberships as other_admin
    where other_admin.organization_id = caller_organization_id
      and other_admin.role = 'admin'
      and other_admin.status = 'active'
      and other_admin.user_id <> target_user_id
  ) then
    raise exception using errcode = '42501', message = 'LAST_ADMIN_CANNOT_DEMOTE';
  end if;

  update public.organization_memberships
  set role = new_role
  where organization_id = caller_organization_id
    and user_id = target_user_id;
end;
$$;

revoke all on function public.update_member_role(uuid, public.membership_role) from public, anon, authenticated;
grant execute on function public.update_member_role(uuid, public.membership_role) to authenticated;
