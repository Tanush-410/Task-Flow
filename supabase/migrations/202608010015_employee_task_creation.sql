-- Let any active organization member create tasks and tag/untag assignees,
-- not just admins. Employees previously could only update the status of
-- assignments already made to them; now they can also create tasks and
-- assign them to coworkers (mirroring what admins have always been able
-- to do), while task editing/publishing/archiving stay admin-only.

create or replace function public.is_task_org_member(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks as task
    join public.organization_memberships as membership
      on membership.organization_id = task.organization_id
    where task.id = target_task_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

grant execute on function public.is_task_org_member(uuid) to authenticated;

-- tasks: any active org member may insert, provided they're recorded as
-- the creator (can't spoof created_by for someone else). Mirrors the
-- org-id-based, non-self-referential INSERT pattern from
-- 202608010012_fix_task_insert_policies.sql.
drop policy if exists tasks_insert_admins on public.tasks;

create policy tasks_insert_members
on public.tasks
for insert
to authenticated
with check (
  public.is_active_member(organization_id)
  and created_by = auth.uid()
);

-- A creator must be able to read back the row they just inserted (the
-- INSERT ... RETURNING the app performs) even before they're a
-- participant, e.g. they didn't assign themselves. Same fix shape as
-- 202608010013_fix_task_returning_select_policy.sql, generalized to any
-- creator rather than just admins.
create policy tasks_select_creator
on public.tasks
for select
to authenticated
using (created_by = auth.uid());

-- task_assignments: any active member of the task's organization may
-- tag/untag people on it, not just its admin.
drop policy if exists task_assignments_insert_admins on public.task_assignments;
drop policy if exists task_assignments_delete_admins on public.task_assignments;

create policy task_assignments_insert_members
on public.task_assignments
for insert
to authenticated
with check (public.is_task_org_member(task_id));

create policy task_assignments_delete_members
on public.task_assignments
for delete
to authenticated
using (public.is_task_org_member(task_id));

-- Any org member may view the full assignee list for a task in their org
-- (needed to render/manage the Assignees card, and to satisfy the
-- INSERT ... RETURNING check right after tagging someone other than
-- themselves).
create policy task_assignments_view_org_members
on public.task_assignments
for select
to authenticated
using (public.is_task_org_member(task_id));

-- Let a tagging member's "new assignment" notification insert succeed even
-- when they assigned someone other than themselves and aren't the task's
-- admin (previously only is_task_participant, which excludes a
-- non-participant creator/tagger).
create policy task_notifications_insert_org_members
on public.task_notifications
for insert
to authenticated
with check (public.is_task_org_member(task_id));
