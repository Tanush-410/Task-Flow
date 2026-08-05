import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';

export type NoteChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  position: number;
};

export type Note = {
  id: string;
  noteType: 'text' | 'checklist';
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  items: NoteChecklistItem[];
};

/** Every note belonging to the caller — personal, never shared across users. */
export async function listMyNotes(): Promise<Note[]> {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  const { data: notes } = await supabase
    .from('notes')
    .select(
      'id,note_type,title,body,color,pinned,archived,created_at,updated_at',
    )
    .eq('user_id', membership.userId)
    .order('updated_at', { ascending: false });

  const rows = notes ?? [];
  const checklistNoteIds = rows
    .filter((row) => row.note_type === 'checklist')
    .map((row) => row.id);

  let items: {
    id: string;
    note_id: string;
    text: string;
    checked: boolean;
    position: number;
  }[] = [];

  if (checklistNoteIds.length > 0) {
    const { data } = await supabase
      .from('note_checklist_items')
      .select('id,note_id,text,checked,position')
      .in('note_id', checklistNoteIds)
      .order('position', { ascending: true });
    items = data ?? [];
  }

  const itemsByNote = new Map<string, NoteChecklistItem[]>();
  for (const item of items) {
    const list = itemsByNote.get(item.note_id) ?? [];
    list.push({
      id: item.id,
      text: item.text,
      checked: item.checked,
      position: item.position,
    });
    itemsByNote.set(item.note_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    noteType: row.note_type as Note['noteType'],
    title: row.title,
    body: row.body,
    color: row.color,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: itemsByNote.get(row.id) ?? [],
  }));
}
