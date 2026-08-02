create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('draft', 'published', 'archived');
create type public.assignment_status as enum (
  'not_started',
  'in_progress',
  'delayed',
  'completed'
);
create type public.task_activity_type as enum (
  'task_created',
  'task_updated',
  'task_published',
  'task_archived',
  'assignment_created',
  'assignment_updated',
  'assignment_progress_changed',
  'assignment_status_changed',
  'assignment_delayed',
  'assignment_completed',
  'assignment_reopened',
  'task_acknowledgement_recorded'
);
create type public.task_notification_type as enum (
  'task_published',
  'task_updated',
  'assignment_created',
  'assignment_progress_changed',
  'assignment_status_changed',
  'assignment_delayed',
  'assignment_completed',
  'acknowledgement_required'
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  description text not null default '' check (char_length(btrim(description)) <= 10000),
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'draft',
  acknowledgement_required boolean not null default false,
  due_at timestamptz,
  start_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_organization_status_due_idx
on public.tasks (organization_id, status, due_at);

create index tasks_organization_published_idx
on public.tasks (organization_id, published_at desc nulls last);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  status public.assignment_status not null default 'not_started',
  progress integer not null default 0 check (progress in (0, 25, 50, 75, 100)),
  delay_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, assignee_id),
  check (delay_reason is null or char_length(btrim(delay_reason)) > 0),
  check (override_reason is null or char_length(btrim(override_reason)) > 0)
);

create index task_assignments_task_id_idx
on public.task_assignments (task_id, status, assignee_id);

create index task_assignments_assignee_id_idx
on public.task_assignments (assignee_id, status, task_id);

create table public.task_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  assignment_id uuid references public.task_assignments (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type public.task_activity_type not null,
  summary text not null,
  before_record jsonb,
  after_record jsonb,
  created_at timestamptz not null default now()
);

create index task_activity_events_task_created_idx
on public.task_activity_events (task_id, created_at desc);

create index task_activity_events_assignment_created_idx
on public.task_activity_events (assignment_id, created_at desc)
where assignment_id is not null;

create table public.task_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  activity_event_id uuid not null references public.task_activity_events (id) on delete cascade,
  acknowledged_by uuid not null references public.profiles (id) on delete restrict,
  note text,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (activity_event_id, acknowledged_by),
  check (note is null or char_length(btrim(note)) > 0)
);

create index task_acknowledgements_task_created_idx
on public.task_acknowledgements (task_id, acknowledged_at desc);

create table public.task_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  assignment_id uuid references public.task_assignments (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  notification_type public.task_notification_type not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(title)) > 0),
  check (char_length(btrim(body)) > 0)
);

create index task_notifications_recipient_read_idx
on public.task_notifications (recipient_id, read_at, created_at desc);

create index task_notifications_task_created_idx
on public.task_notifications (task_id, created_at desc);

create or replace function public.is_task_admin(target_task_id uuid)
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
      and membership.role = 'admin'
      and membership.status = 'active'
  );
$$;

create or replace function public.is_task_participant(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_task_admin(target_task_id)
    or exists (
      select 1
      from public.task_assignments as assignment
      where assignment.task_id = target_task_id
        and assignment.assignee_id = auth.uid()
    );
$$;

create or replace function public.is_task_assignment_owner(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = target_assignment_id
      and assignment.assignee_id = auth.uid()
  );
$$;

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
      event_type := 'task_archived';
      event_summary := 'Task deleted';
      task_id_value := old.id;
      organization_id_value := old.organization_id;
      actor_id_value := old.created_by;
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
      assignment_id_value := old.id;
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

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger task_assignments_set_updated_at
before update on public.task_assignments
for each row execute function public.set_updated_at();

create trigger task_notifications_set_updated_at
before update on public.task_notifications
for each row execute function public.set_updated_at();

create trigger task_activity_events_record_tasks
after insert or update or delete on public.tasks
for each row execute function public.log_task_activity_event();

create trigger task_activity_events_record_assignments
after insert or update or delete on public.task_assignments
for each row execute function public.log_task_activity_event();

create trigger task_activity_events_record_acknowledgements
after insert on public.task_acknowledgements
for each row execute function public.log_task_activity_event();

revoke all on function public.is_task_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_task_participant(uuid) from public, anon, authenticated;
revoke all on function public.is_task_assignment_owner(uuid) from public, anon, authenticated;
revoke all on function public.log_task_activity_event() from public, anon, authenticated;

revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_assignments from anon, authenticated;
revoke all on table public.task_activity_events from anon, authenticated;
revoke all on table public.task_acknowledgements from anon, authenticated;
revoke all on table public.task_notifications from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant execute on function public.is_task_admin(uuid) to authenticated;
grant execute on function public.is_task_participant(uuid) to authenticated;
grant execute on function public.is_task_assignment_owner(uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_activity_events enable row level security;
alter table public.task_acknowledgements enable row level security;
alter table public.task_notifications enable row level security;

create policy tasks_view_participants
on public.tasks
for select
to authenticated
using (public.is_task_participant(id));

create policy tasks_manage_admins
on public.tasks
for all
to authenticated
using (public.is_task_admin(id))
with check (public.is_task_admin(id));

create policy task_assignments_view_participants
on public.task_assignments
for select
to authenticated
using (
  public.is_task_admin(task_id)
  or assignee_id = auth.uid()
);

create policy task_assignments_manage_self_or_admin
on public.task_assignments
for update
to authenticated
using (
  public.is_task_admin(task_id)
  or assignee_id = auth.uid()
)
with check (
  public.is_task_admin(task_id)
  or assignee_id = auth.uid()
);

create policy task_assignments_insert_admins
on public.task_assignments
for insert
to authenticated
with check (public.is_task_admin(task_id));

create policy task_assignments_delete_admins
on public.task_assignments
for delete
to authenticated
using (public.is_task_admin(task_id));

create policy task_activity_view_participants
on public.task_activity_events
for select
to authenticated
using (public.is_task_participant(task_id));

create policy task_acknowledgements_view_participants
on public.task_acknowledgements
for select
to authenticated
using (
  public.is_task_admin(task_id)
  or acknowledged_by = auth.uid()
);

create policy task_acknowledgements_insert_participants
on public.task_acknowledgements
for insert
to authenticated
with check (
  public.is_task_admin(task_id)
  or acknowledged_by = auth.uid()
);

create policy task_notifications_view_recipient_or_admin
on public.task_notifications
for select
to authenticated
using (
  recipient_id = auth.uid()
  or public.is_task_admin(task_id)
  or public.is_admin(organization_id)
);

create policy task_notifications_manage_recipient_or_admin
on public.task_notifications
for update
to authenticated
using (
  recipient_id = auth.uid()
  or public.is_task_admin(task_id)
  or public.is_admin(organization_id)
)
with check (
  recipient_id = auth.uid()
  or public.is_task_admin(task_id)
  or public.is_admin(organization_id)
);

grant select, delete on public.tasks to authenticated;
grant insert (
  organization_id,
  created_by,
  title,
  description,
  priority,
  status,
  acknowledgement_required,
  due_at,
  start_at,
  published_at,
  archived_at
) on public.tasks to authenticated;
grant update (
  title,
  description,
  priority,
  status,
  acknowledgement_required,
  due_at,
  start_at,
  published_at,
  archived_at,
  updated_at
) on public.tasks to authenticated;

grant select, delete on public.task_assignments to authenticated;
grant insert (
  organization_id,
  task_id,
  assignee_id,
  assigned_by,
  status,
  progress,
  delay_reason,
  started_at,
  completed_at,
  override_reason
) on public.task_assignments to authenticated;
grant update (
  status,
  progress,
  delay_reason,
  started_at,
  completed_at,
  override_reason,
  updated_at
) on public.task_assignments to authenticated;

grant select on public.task_activity_events to authenticated;
grant select, insert, update on public.task_acknowledgements to authenticated;
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