-- Comment/task-notification inserts started failing with:
--   42501 permission denied for table task_notifications
--   hint: Grant the required privileges to the current role with:
--         GRANT INSERT ON public.task_notifications TO authenticated;
-- This table originally had precise column-level grants (see
-- 202608010010_task_workflow.sql), not a blanket INSERT. The timing lines
-- up with this session's Realtime troubleshooting: toggling "Enable
-- Realtime" off/on for this table via the Table Editor UI (Database ->
-- Table Editor -> Edit table -> Save) appears to have reset the table's
-- privileges to its own defaults rather than preserving the existing
-- column-scoped grants. Restoring them exactly as originally defined.
grant select, delete on public.task_notifications to authenticated;

grant insert (
  organization_id,
  task_id,
  assignment_id,
  recipient_id,
  notification_type,
  title,
  body,
  payload,
  delivered_at,
  read_at
) on public.task_notifications to authenticated;

grant update (
  delivered_at,
  read_at,
  updated_at
) on public.task_notifications to authenticated;
