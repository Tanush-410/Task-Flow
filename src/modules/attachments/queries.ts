import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export type TaskAttachmentRow = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
  downloadUrl: string | null;
};

export async function listTaskAttachments(
  taskId: string,
): Promise<TaskAttachmentRow[]> {
  await requireMembership();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = await Promise.all(
    data.map(async (attachment) => {
      const { data: signed } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS);

      return {
        id: attachment.id,
        fileName: attachment.file_name,
        fileSize: attachment.file_size,
        mimeType: attachment.mime_type,
        uploadedBy: attachment.uploaded_by,
        createdAt: attachment.created_at,
        downloadUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  return rows;
}
