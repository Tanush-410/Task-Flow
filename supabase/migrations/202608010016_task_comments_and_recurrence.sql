-- Two independent additions:
--
-- 1. Recurrence: a task can be marked to repeat daily/weekly/monthly. The
--    application (not a DB trigger/cron job) creates the next occurrence
--    the moment the current one is completed, reusing the same insert
--    paths — and therefore the same RLS policies — as manual task
--    creation. This column just records the intent.
--
-- 2. task_comments: a lightweight discussion thread on a task, visible to
--    (and postable by) anyone who can already see the task under the
--    org-member model introduced in 202608010015_employee_task_creation.sql.

create type public.task_recurrence as enum ('none', 'daily', 'weekly', 'monthly');

-- Lets a new comment notify a task's participants, reusing the existing
-- task_notifications table/policies rather than a bespoke mechanism.
alter type public.task_notification_type add value 'comment_added';

alter table public.tasks
add column recurrence public.task_recurrence not null default 'none';

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_comments_task_created_idx
on public.task_comments (task_id, created_at asc);

create trigger task_comments_set_updated_at
before update on public.task_comments
for each row execute function public.set_updated_at();

alter table public.task_comments enable row level security;

-- Same visibility predicate as task_assignments_view_org_members: any
-- active member of the task's organization, not just its participants.
create policy task_comments_view_org_members
on public.task_comments
for select
to authenticated
using (public.is_task_org_member(task_id));

create policy task_comments_insert_org_members
on public.task_comments
for insert
to authenticated
with check (
  public.is_task_org_member(task_id)
  and author_id = auth.uid()
);

create policy task_comments_delete_own_or_admin
on public.task_comments
for delete
to authenticated
using (
  author_id = auth.uid()
  or public.is_task_admin(task_id)
);

grant select, insert, delete on public.task_comments to authenticated;
