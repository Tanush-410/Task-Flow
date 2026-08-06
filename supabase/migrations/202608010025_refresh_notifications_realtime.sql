-- Every postgres_changes subscription to task_notifications currently
-- succeeds on the initial handshake (the server replies "ok" with a real
-- subscription id) but is then immediately torn down again with:
--   "invalid column for filter recipient_id"
-- ...even though recipient_id obviously exists and the column-level
-- validation is what produced the successful reply moments earlier. This
-- happens for every user and every filter value, which points at a stale
-- Realtime-side registration for this one table rather than anything
-- filter- or row-specific. Dropping and re-adding the table forces
-- Realtime to rebuild its cached knowledge of it from scratch.
alter publication supabase_realtime drop table public.task_notifications;
alter publication supabase_realtime add table public.task_notifications;
