-- log_task_activity_event() ran as an AFTER DELETE trigger and tried to
-- insert a new task_activity_events row whose assignment_id (or task_id, for
-- a hard task delete) pointed at the row that trigger invocation had just
-- deleted. By the time an AFTER DELETE trigger fires the row is already
-- gone, so that insert always violated the foreign key constraint
-- (task_activity_events_assignment_id_fkey / _task_id_fkey) — every
-- assignment removal failed with a 23503 error. This was never exercised
-- until removeAssignment() started using this path.
--
-- Fix: task_activity_events.assignment_id is nullable, so a deleted
-- assignment logs its event with assignment_id = null (task_id still
-- refers to the live parent task, so that reference stays valid). task_id
-- is NOT NULL on that table, so a hard task delete has no valid id left to
-- reference at all; skip logging for that case rather than fail the delete
-- (no code path deletes a task today — tasks are archived via UPDATE — but
-- the trigger should not corrupt/block a delete if one ever happens).
create or replace function public.log_task_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type public.task_activity_type;
  event_summary text;
  task_id_value uuid;
  organization_id_value uuid;
  assignment_id_value uuid;
  actor_id_value uuid;
begin
  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      event_type := 'task_created';
      event_summary := 'Task created';
      task_id_value := new.id;
      organization_id_value := new.organization_id;
      actor_id_value := new.created_by;
    elsif tg_op = 'UPDATE' then
      if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
        return new;
      end if;

      task_id_value := new.id;
      organization_id_value := new.organization_id;
      actor_id_value := new.created_by;

      if old.status <> new.status and new.status = 'published' then
        event_type := 'task_published';
        event_summary := 'Task published';
      elsif old.status <> new.status and new.status = 'archived' then
        event_type := 'task_archived';
        event_summary := 'Task archived';
      else
        event_type := 'task_updated';
        event_summary := 'Task updated';
      end if;
    else
      -- task_activity_events.task_id is NOT NULL; a deleted task leaves no
      -- valid id to log against, so this delete is not recorded.
      return old;
    end if;
  elsif tg_table_name = 'task_assignments' then
    if tg_op = 'INSERT' then
      event_type := 'assignment_created';
      event_summary := 'Assignment created';
      task_id_value := new.task_id;
      organization_id_value := new.organization_id;
      assignment_id_value := new.id;
      actor_id_value := new.assigned_by;
    elsif tg_op = 'UPDATE' then
      if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
        return new;
      end if;

      task_id_value := new.task_id;
      organization_id_value := new.organization_id;
      assignment_id_value := new.id;
      actor_id_value := new.assigned_by;

      if old.status <> new.status and new.status = 'completed' then
        event_type := 'assignment_completed';
        event_summary := 'Assignment completed';
      elsif old.status <> new.status and new.status = 'delayed' then
        event_type := 'assignment_delayed';
        event_summary := 'Assignment delayed';
      elsif old.status <> new.status and old.status = 'completed' and new.status <> 'completed' then
        event_type := 'assignment_reopened';
        event_summary := 'Assignment reopened';
      elsif old.status <> new.status then
        event_type := 'assignment_status_changed';
        event_summary := 'Assignment status changed';
      elsif old.progress <> new.progress then
        event_type := 'assignment_progress_changed';
        event_summary := 'Assignment progress changed';
      else
        event_type := 'assignment_updated';
        event_summary := 'Assignment updated';
      end if;
    else
      event_type := 'assignment_updated';
      event_summary := 'Assignment deleted';
      task_id_value := old.task_id;
      organization_id_value := old.organization_id;
      -- old.id no longer exists in task_assignments by the time this AFTER
      -- DELETE trigger runs; assignment_id is nullable, so log null instead
      -- of a dangling reference.
      assignment_id_value := null;
      actor_id_value := old.assigned_by;
    end if;
  elsif tg_table_name = 'task_acknowledgements' then
    if tg_op = 'INSERT' then
      event_type := 'task_acknowledgement_recorded';
      event_summary := 'Task acknowledgement recorded';
      task_id_value := new.task_id;
      organization_id_value := new.organization_id;
      assignment_id_value := new.assignment_id;
      actor_id_value := new.acknowledged_by;
    else
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  else
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into public.task_activity_events (
    organization_id,
    task_id,
    assignment_id,
    actor_id,
    event_type,
    summary,
    before_record,
    after_record
  )
  values (
    organization_id_value,
    task_id_value,
    assignment_id_value,
    actor_id_value,
    event_type,
    event_summary,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
