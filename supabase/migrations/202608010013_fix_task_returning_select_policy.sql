-- 202608010012 fixed the tasks INSERT policy's chicken-and-egg problem, but
-- every task-creating call also does `.select().single()` (INSERT ...
-- RETURNING). Postgres additionally re-checks the SELECT policy against the
-- just-inserted row to honor RETURNING, and the only SELECT policy
-- (tasks_view_participants -> is_task_admin(id)) has the exact same
-- self-referential lookup problem: it queries public.tasks for a row that,
-- from that subquery's point of view, is not yet visible. Verified via a
-- direct RLS repro against the live database: INSERT alone succeeds,
-- INSERT ... RETURNING fails, and adding this policy (which checks the new
-- row's own organization_id instead of self-joining on its id) fixes it.
--
-- This is also a more direct rule for admins generally: an admin can see
-- every task in their organization by organization membership alone, with
-- no need to resolve it through a per-task lookup. tasks_view_participants
-- is left as-is for the employee/assignee case.
create policy tasks_select_admins_by_org
on public.tasks
for select
to authenticated
using (public.is_admin(organization_id));
