'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import {
  createNoteSchema,
  noteIdSchema,
  saveChecklistItemsSchema,
  setChecklistItemCheckedSchema,
  setNoteArchivedSchema,
  setNotePinnedSchema,
  updateNoteSchema,
} from './schemas';

const NOTE_ERROR = {
  code: 'NOTE_ACTION_FAILED',
  message: 'That note could not be saved.',
} as const;

export async function createNote(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const traceId = randomUUID();
  const parsed = createNoteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_NOTE',
        message: 'Check the note details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: membership.userId,
        note_type: parsed.data.noteType,
        title: parsed.data.title,
        body: parsed.data.body,
        color: parsed.data.color,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return { ok: true, data: { id: data.id } };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}

export async function updateNote(input: unknown): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = updateNoteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_NOTE',
        message: 'Check the note details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('notes')
      .update({
        title: parsed.data.title,
        body: parsed.data.body,
        color: parsed.data.color,
      })
      .eq('id', parsed.data.id)
      .eq('user_id', membership.userId);

    if (error) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}

export async function setNotePinned(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = setNotePinnedSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('notes')
      .update({ pinned: parsed.data.pinned })
      .eq('id', parsed.data.id)
      .eq('user_id', membership.userId);

    if (error) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}

export async function setNoteArchived(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = setNoteArchivedSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('notes')
      .update({ archived: parsed.data.archived })
      .eq('id', parsed.data.id)
      .eq('user_id', membership.userId);

    if (error) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}

export async function deleteNote(input: unknown): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = noteIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', membership.userId);

    if (error) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}

export async function setChecklistItemChecked(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = setChecklistItemCheckedSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('note_checklist_items')
      .update({ checked: parsed.data.checked })
      .eq('id', parsed.data.itemId)
      .eq('user_id', membership.userId);

    if (error) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}

export type SavedChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  position: number;
};

/**
 * Full replace of a checklist note's items — used when the editor closes.
 * Returns the newly inserted rows (with real ids) so the caller can update
 * its local state without going stale — a subsequent checkbox toggle needs
 * a real item id, not a locally-fabricated placeholder.
 */
export async function saveChecklistItems(
  input: unknown,
): Promise<ActionResult<{ items: SavedChecklistItem[] }>> {
  const traceId = randomUUID();
  const parsed = saveChecklistItemsSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();

    const { error: deleteError } = await supabase
      .from('note_checklist_items')
      .delete()
      .eq('note_id', parsed.data.noteId)
      .eq('user_id', membership.userId);

    if (deleteError) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    const nonEmptyItems = parsed.data.items.filter(
      (item) => item.text.length > 0,
    );

    if (nonEmptyItems.length === 0) {
      return { ok: true, data: { items: [] } };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('note_checklist_items')
      .insert(
        nonEmptyItems.map((item, index) => ({
          note_id: parsed.data.noteId,
          user_id: membership.userId,
          text: item.text,
          checked: item.checked,
          position: index,
        })),
      )
      .select('id,text,checked,position');

    if (insertError || !inserted) {
      return { ok: false, error: { ...NOTE_ERROR, traceId } };
    }

    return {
      ok: true,
      data: {
        items: inserted.map((row) => ({
          id: row.id,
          text: row.text,
          checked: row.checked,
          position: row.position,
        })),
      },
    };
  } catch {
    return { ok: false, error: { ...NOTE_ERROR, traceId } };
  }
}
