-- Five independent additions, all new tables (deliberately not new columns
-- on tasks/task_assignments — 202608010016/202608010017 already showed how
-- easy it is to forget those tables' column-level grants). Every table here
-- gets a plain table-level grant instead, matching task_comments.

-- 1. task_mutes: a member can silence in-app notifications for one task
-- without leaving it. Checked centrally in queueTaskNotifications rather
-- than at each call site.
create table public.task_mutes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

alter table public.task_mutes enable row level security;

create policy task_mutes_manage_own
on public.task_mutes
for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_task_org_member(task_id)
);

grant select, insert, delete on public.task_mutes to authenticated;

-- 2. task_checklist_items: a shared, editable checklist per task (unlike
-- comments, any org member of the task may toggle/edit/delete any item —
-- it's task state, not a personal remark).
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  is_done boolean not null default false,
  position integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_checklist_items_task_position_idx
on public.task_checklist_items (task_id, position);

create trigger task_checklist_items_set_updated_at
before update on public.task_checklist_items
for each row execute function public.set_updated_at();

alter table public.task_checklist_items enable row level security;

create policy task_checklist_items_view_org_members
on public.task_checklist_items
for select
to authenticated
using (public.is_task_org_member(task_id));

create policy task_checklist_items_insert_org_members
on public.task_checklist_items
for insert
to authenticated
with check (
  public.is_task_org_member(task_id)
  and created_by = auth.uid()
);

create policy task_checklist_items_update_org_members
on public.task_checklist_items
for update
to authenticated
using (public.is_task_org_member(task_id))
with check (public.is_task_org_member(task_id));

create policy task_checklist_items_delete_org_members
on public.task_checklist_items
for delete
to authenticated
using (public.is_task_org_member(task_id));

grant select, insert, update, delete on public.task_checklist_items to authenticated;

-- 3. task_dependencies: task_id is blocked until depends_on_task_id's
-- assignments are all completed. Both tasks end up implicitly constrained
-- to the same organization, since a caller can only satisfy
-- is_task_org_member on both ids using a single (their own) active
-- membership.
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);

create index task_dependencies_task_idx on public.task_dependencies (task_id);
create index task_dependencies_depends_on_idx on public.task_dependencies (depends_on_task_id);

alter table public.task_dependencies enable row level security;

create policy task_dependencies_view_org_members
on public.task_dependencies
for select
to authenticated
using (
  public.is_task_org_member(task_id)
  or public.is_task_org_member(depends_on_task_id)
);

create policy task_dependencies_insert_org_members
on public.task_dependencies
for insert
to authenticated
with check (
  public.is_task_org_member(task_id)
  and public.is_task_org_member(depends_on_task_id)
  and created_by = auth.uid()
);

create policy task_dependencies_delete_org_members
on public.task_dependencies
for delete
to authenticated
using (public.is_task_org_member(task_id));

grant select, insert, delete on public.task_dependencies to authenticated;

-- 4. task_templates: saved task shapes any active member can create from
-- or reuse, matching the org-member task-creation model.
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  description text not null default '' check (char_length(btrim(description)) <= 10000),
  priority public.task_priority not null default 'medium',
  recurrence public.task_recurrence not null default 'none',
  acknowledgement_required boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index task_templates_org_idx
on public.task_templates (organization_id, created_at desc);

alter table public.task_templates enable row level security;

create policy task_templates_view_org_members
on public.task_templates
for select
to authenticated
using (public.is_active_member(organization_id));

create policy task_templates_insert_org_members
on public.task_templates
for insert
to authenticated
with check (
  public.is_active_member(organization_id)
  and created_by = auth.uid()
);

create policy task_templates_delete_own_or_admin
on public.task_templates
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_admin(organization_id)
);

grant select, insert, delete on public.task_templates to authenticated;

-- 5. task_attachments: file metadata; the actual bytes live in the
-- 'task-attachments' Storage bucket under `${task_id}/${filename}`, so
-- storage.objects policies can reuse is_task_org_member by reading the
-- first path segment back out as the task id.
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments (task_id);

alter table public.task_attachments enable row level security;

create policy task_attachments_view_org_members
on public.task_attachments
for select
to authenticated
using (public.is_task_org_member(task_id));

create policy task_attachments_insert_org_members
on public.task_attachments
for insert
to authenticated
with check (
  public.is_task_org_member(task_id)
  and uploaded_by = auth.uid()
);

create policy task_attachments_delete_own_or_admin
on public.task_attachments
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  or public.is_task_admin(task_id)
);

grant select, insert, delete on public.task_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 26214400)
on conflict (id) do nothing;

create policy task_attachments_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-attachments'
  and public.is_task_org_member(((storage.foldername(name))[1])::uuid)
);

create policy task_attachments_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-attachments'
  and public.is_task_org_member(((storage.foldername(name))[1])::uuid)
);

create policy task_attachments_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-attachments'
  and public.is_task_org_member(((storage.foldername(name))[1])::uuid)
);
