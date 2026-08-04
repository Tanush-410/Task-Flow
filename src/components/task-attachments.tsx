'use client';

import { FileIcon, Paperclip, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { createBrowserSupabase } from '@/lib/supabase/browser';
import {
  deleteAttachment,
  recordAttachment,
} from '@/modules/attachments/actions';
import { Button } from '@/components/ui/button';

export type TaskAttachmentRow = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  downloadUrl: string | null;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachments({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: TaskAttachmentRow[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError('Files must be 25 MB or smaller.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const supabase = createBrowserSupabase();
      const storagePath = `${taskId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(storagePath, file);

      if (uploadError) {
        setError('The file could not be uploaded.');
        return;
      }

      const result = await recordAttachment({
        taskId,
        fileName: file.name,
        storagePath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  function handleDelete(attachmentId: string) {
    deleteAttachment({ attachmentId }).then((result) => {
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <li
              className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
              key={attachment.id}
            >
              <FileIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                {attachment.downloadUrl ? (
                  <a
                    className="block truncate text-sm font-medium text-foreground hover:text-primary"
                    href={attachment.downloadUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {attachment.fileName}
                  </a>
                ) : (
                  <span className="block truncate text-sm font-medium text-foreground">
                    {attachment.fileName}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </span>
              </div>
              <button
                aria-label={`Delete ${attachment.fileName}`}
                className="text-muted-foreground hover:text-red-400"
                onClick={() => handleDelete(attachment.id)}
                type="button"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <input
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <Button
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        size="sm"
        type="button"
        variant="outline"
      >
        <Paperclip aria-hidden />
        {isUploading ? 'Uploading…' : 'Attach a file'}
      </Button>
    </div>
  );
}
