'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import { attachmentDeleteSchema, attachmentRecordSchema } from './schemas';

const ATTACHMENT_ERROR = {
  code: 'ATTACHMENT_UPDATE_FAILED',
  message: 'The attachment could not be saved.',
} as const;

/**
 * Called after the browser uploads the file directly to Supabase Storage
 * (RLS-gated by the same is_task_org_member predicate as this metadata
 * row's own insert policy) — this just records what was uploaded.
 */
export async function recordAttachment(
  input: unknown,
): Promise<ActionResult<{ attachmentId: string }>> {
  const traceId = randomUUID();
  const parsed = attachmentRecordSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ATTACHMENT',
        message: 'Check the file details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_attachments')
      .insert({
        organization_id: membership.organizationId,
        task_id: parsed.data.taskId,
        uploaded_by: membership.userId,
        file_name: parsed.data.fileName,
        storage_path: parsed.data.storagePath,
        file_size: parsed.data.fileSize,
        mime_type: parsed.data.mimeType,
      })
      .select('id')
      .single();

    if (error || !data) {
      // Best-effort cleanup: the file already landed in storage even
      // though the metadata insert failed.
      await supabase.storage
        .from('task-attachments')
        .remove([parsed.data.storagePath]);
      return { ok: false, error: { ...ATTACHMENT_ERROR, traceId } };
    }

    return { ok: true, data: { attachmentId: data.id } };
  } catch {
    return { ok: false, error: { ...ATTACHMENT_ERROR, traceId } };
  }
}

export async function deleteAttachment(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = attachmentDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ATTACHMENT',
        message: 'Check the attachment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data: attachment } = await supabase
      .from('task_attachments')
      .select('storage_path')
      .eq('id', parsed.data.attachmentId)
      .maybeSingle();

    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', parsed.data.attachmentId);

    if (error) {
      return { ok: false, error: { ...ATTACHMENT_ERROR, traceId } };
    }

    if (attachment) {
      await supabase.storage
        .from('task-attachments')
        .remove([attachment.storage_path]);
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...ATTACHMENT_ERROR, traceId } };
  }
}
