-- Personal notes, inspired by Google Keep. Purely personal (not shared
-- within an org), so this is deliberately simple: plain owner-only RLS on
-- two tables, no security definer functions needed — there's no
-- cross-user visibility or privilege bypassing required for this feature.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note_type text not null default 'text' check (note_type in ('text', 'checklist')),
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  color text not null default 'default',
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_idx on public.notes (user_id);

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create table public.note_checklist_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null default '' check (char_length(text) <= 500),
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index note_checklist_items_note_id_idx
on public.note_checklist_items (note_id, position);

alter table public.notes enable row level security;
alter table public.note_checklist_items enable row level security;

create policy owner_manages_notes
on public.notes
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy owner_manages_note_checklist_items
on public.note_checklist_items
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on public.notes from anon;
revoke all on public.note_checklist_items from anon;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_checklist_items to authenticated;
