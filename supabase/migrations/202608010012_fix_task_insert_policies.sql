-- tasks_manage_admins (202608010010_task_workflow.sql) used a single
-- is_task_admin(id) check for every command, including INSERT. For INSERT,
-- that check does a self-join lookup against public.tasks for the row
-- being inserted, which is not yet visible to that lookup at check time --
-- so no task could ever actually be created; every insert was silently
-- denied by RLS. Split the policy so INSERT is authorized against the
-- organization_id being inserted into (is_admin(organization_id), no
-- self-reference) instead. UPDATE/DELETE keep using is_task_admin(id),
-- which is safe there because those rows already exist.

drop policy if exists tasks_manage_admins on public.tasks;

create policy tasks_insert_admins
on public.tasks
for insert
to authenticated
with check (public.is_admin(organization_id));

create policy tasks_update_admins
on public.tasks
for update
to authenticated
using (public.is_task_admin(id))
with check (public.is_task_admin(id));

create policy tasks_delete_admins
on public.tasks
for delete
to authenticated
using (public.is_task_admin(id));

-- task_notifications had select/update policies but no insert policy at
-- all, so with RLS's default-deny, every notification insert (new
-- assignment, completion, delay, reopen) was silently denied and swallowed
-- by queueTaskNotifications's best-effort error handling. Any current
-- participant of the referenced task (its admin, or any of its assignees)
-- may create a notification for another participant of that same task.
create policy task_notifications_insert_participants
on public.task_notifications
for insert
to authenticated
with check (public.is_task_participant(task_id));
