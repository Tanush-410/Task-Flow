-- Self-service account deletion. profiles.id -> auth.users(id) is already
-- "on delete cascade" (202608010001), so deleting the auth user cleans up
-- the profile row for free -- but every other FK back to profiles across
-- this schema is either "on delete restrict" or has no "on delete" clause
-- at all (defaults to the same thing), so auth.admin.deleteUser() would
-- simply fail with a foreign-key violation the moment the departing user
-- has ever created a task, written a comment, assigned anyone, etc.
--
-- Two kinds of reference get handled differently here:
--   - Personal/operational rows (assignments, acknowledgements, mutes,
--     org memberships) are deleted outright -- nobody else's data depends
--     on them surviving.
--   - Shared content rows (tasks, comments, checklist items, templates,
--     attachments, dependencies, orgs, invitations, connection requests,
--     planning teams) must keep existing even after their author leaves,
--     so those "*_by"/"author_id" columns become nullable and get nulled
--     out instead -- the row survives, attributed to nobody in particular.
--
-- Already-safe references (cascade or set-null) are untouched:
-- task_activity.actor_id, task_notifications.recipient_id,
-- connection_requests.requested_user_id, notes.user_id,
-- note_checklist_items.user_id, planning_team_members.user_id.

alter table public.organizations alter column created_by drop not null;
alter table public.invitations alter column invited_by drop not null;
alter table public.tasks alter column created_by drop not null;
alter table public.task_comments alter column author_id drop not null;
alter table public.task_checklist_items alter column created_by drop not null;
alter table public.task_dependencies alter column created_by drop not null;
alter table public.task_templates alter column created_by drop not null;
alter table public.task_attachments alter column uploaded_by drop not null;
alter table public.connection_requests alter column invited_by drop not null;
alter table public.planning_teams alter column created_by drop not null;
alter table public.task_assignments alter column assigned_by drop not null;

-- Mirrors accept_invitation/respond_to_connection_request's last-admin
-- pre-check (202608010022), extended with a second case: an organization
-- where the caller is the *only* member left at all is deleted outright
-- rather than blocked, since organization_memberships' existing
-- protect_last_active_admin trigger already special-cases "the
-- organization row no longer exists" as a pass-through (it does a
-- `perform ... for update; if not found then return old;` before ever
-- checking for another active admin) -- deleting the org first cascades
-- away its membership row through that exact escape hatch, rather than
-- fighting the trigger for it. Every org-scoped table is
-- "on delete cascade" on organization_id, so this is a clean removal of
-- an organization that would have had zero members left anyway.
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  if exists (
    select 1
    from public.organization_memberships as membership
    where membership.user_id = caller
      and membership.status = 'active'
      and membership.role = 'admin'
      and exists (
        select 1
        from public.organization_memberships as other
        where other.organization_id = membership.organization_id
          and other.user_id <> caller
          and other.status = 'active'
      )
      and not exists (
        select 1
        from public.organization_memberships as other_admin
        where other_admin.organization_id = membership.organization_id
          and other_admin.role = 'admin'
          and other_admin.status = 'active'
          and other_admin.user_id <> caller
      )
  ) then
    raise exception using errcode = '42501', message = 'LAST_ADMIN_CANNOT_DELETE';
  end if;

  delete from public.organizations
  where id in (
    select membership.organization_id
    from public.organization_memberships as membership
    where membership.user_id = caller
      and membership.status = 'active'
      and not exists (
        select 1
        from public.organization_memberships as other
        where other.organization_id = membership.organization_id
          and other.user_id <> caller
          and other.status = 'active'
      )
  );

  update public.organizations set created_by = null where created_by = caller;
  update public.invitations set invited_by = null where invited_by = caller;
  update public.tasks set created_by = null where created_by = caller;
  update public.task_comments set author_id = null where author_id = caller;
  update public.task_checklist_items set created_by = null where created_by = caller;
  update public.task_dependencies set created_by = null where created_by = caller;
  update public.task_templates set created_by = null where created_by = caller;
  update public.task_attachments set uploaded_by = null where uploaded_by = caller;
  update public.connection_requests set invited_by = null where invited_by = caller;
  update public.planning_teams set created_by = null where created_by = caller;
  update public.task_assignments
  set assigned_by = null
  where assigned_by = caller and assignee_id <> caller;

  delete from public.task_assignments where assignee_id = caller;
  delete from public.task_acknowledgements where acknowledged_by = caller;
  delete from public.task_mutes where user_id = caller;
  delete from public.organization_memberships where user_id = caller;
end;
$$;

revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
