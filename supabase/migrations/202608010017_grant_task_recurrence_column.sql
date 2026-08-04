-- 202608010016_task_comments_and_recurrence.sql added tasks.recurrence but
-- never extended the column-level insert/update grants established in
-- 202608010010_task_workflow.sql (public.tasks uses column-specific grants,
-- not a blanket `grant insert/update on public.tasks`). Since Postgres
-- rejects an entire INSERT/UPDATE statement if it touches any ungranted
-- column, and the app always submits `recurrence` on both create and edit,
-- this silently broke ALL task creation and editing — not just requests
-- that changed the recurrence value. Column-level grants are additive, so
-- this only needs to grant the one missing column.

grant insert (recurrence) on public.tasks to authenticated;
grant update (recurrence) on public.tasks to authenticated;
