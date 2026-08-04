'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import {
  checklistItemCreateSchema,
  checklistItemDeleteSchema,
  checklistItemToggleSchema,
} from './schemas';

const CHECKLIST_ERROR = {
  code: 'CHECKLIST_UPDATE_FAILED',
  message: 'The checklist item could not be updated.',
} as const;

export async function createChecklistItem(
  input: unknown,
): Promise<ActionResult<{ itemId: string }>> {
  const traceId = randomUUID();
  const parsed = checklistItemCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_CHECKLIST_ITEM',
        message: 'Check the checklist item.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();

    const { count } = await supabase
      .from('task_checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', parsed.data.taskId);

    const { data, error } = await supabase
      .from('task_checklist_items')
      .insert({
        organization_id: membership.organizationId,
        task_id: parsed.data.taskId,
        title: parsed.data.title,
        created_by: membership.userId,
        position: count ?? 0,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...CHECKLIST_ERROR, traceId } };
    }

    return { ok: true, data: { itemId: data.id } };
  } catch {
    return { ok: false, error: { ...CHECKLIST_ERROR, traceId } };
  }
}

export async function toggleChecklistItem(
  input: unknown,
): Promise<ActionResult<{ itemId: string }>> {
  const traceId = randomUUID();
  const parsed = checklistItemToggleSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_CHECKLIST_ITEM',
        message: 'Check the checklist item.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_checklist_items')
      .update({ is_done: parsed.data.isDone })
      .eq('id', parsed.data.itemId)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...CHECKLIST_ERROR, traceId } };
    }

    return { ok: true, data: { itemId: data.id } };
  } catch {
    return { ok: false, error: { ...CHECKLIST_ERROR, traceId } };
  }
}

export async function deleteChecklistItem(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = checklistItemDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_CHECKLIST_ITEM',
        message: 'Check the checklist item.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('task_checklist_items')
      .delete()
      .eq('id', parsed.data.itemId);

    if (error) {
      return { ok: false, error: { ...CHECKLIST_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...CHECKLIST_ERROR, traceId } };
  }
}
