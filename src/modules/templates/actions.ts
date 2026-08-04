'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import { templateCreateSchema, templateDeleteSchema } from './schemas';

const TEMPLATE_ERROR = {
  code: 'TEMPLATE_UPDATE_FAILED',
  message: 'The template could not be saved.',
} as const;

export async function createTaskTemplate(
  input: unknown,
): Promise<ActionResult<{ templateId: string }>> {
  const traceId = randomUUID();
  const parsed = templateCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TEMPLATE',
        message: 'Check the template details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        organization_id: membership.organizationId,
        created_by: membership.userId,
        name: parsed.data.name,
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        recurrence: parsed.data.recurrence,
        acknowledgement_required: parsed.data.acknowledgementRequired,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...TEMPLATE_ERROR, traceId } };
    }

    return { ok: true, data: { templateId: data.id } };
  } catch {
    return { ok: false, error: { ...TEMPLATE_ERROR, traceId } };
  }
}

export async function deleteTaskTemplate(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = templateDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TEMPLATE',
        message: 'Check the template details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', parsed.data.templateId);

    if (error) {
      return { ok: false, error: { ...TEMPLATE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...TEMPLATE_ERROR, traceId } };
  }
}
