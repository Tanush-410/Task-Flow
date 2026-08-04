'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import type { ActionResult } from '@/lib/result';
import { createComment, deleteComment } from '@/modules/comments/actions';
import { PersonAvatar } from '@/components/person-avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type TaskCommentRow = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

async function submitComment(
  _previousState: ActionResult<{ commentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ commentId: string }>> {
  return createComment({
    taskId: formData.get('taskId'),
    body: formData.get('body'),
  });
}

function DeleteCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();

  return (
    <button
      className="text-xs font-semibold text-muted-foreground hover:text-red-400"
      onClick={() => {
        deleteComment({ commentId }).then((result) => {
          if (result.ok) {
            router.refresh();
          }
        });
      }}
      type="button"
    >
      Delete
    </button>
  );
}

export function TaskComments({
  taskId,
  comments,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  comments: TaskCommentRow[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitComment, null);
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li className="flex gap-3" key={comment.id}>
              <PersonAvatar
                displayName={comment.authorName}
                size="sm"
                userId={comment.authorId}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {comment.authorName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                  {comment.authorId === currentUserId || canModerate ? (
                    <DeleteCommentButton commentId={comment.id} />
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="space-y-2"
        key={state ? 'sent' : 'idle'}
      >
        <input name="taskId" type="hidden" value={taskId} />
        <Textarea
          disabled={pending}
          maxLength={4000}
          name="body"
          placeholder="Add a comment…"
          required
          rows={2}
        />
        {error ? (
          <p className="text-xs text-red-400" role="alert">
            {error.message}
          </p>
        ) : null}
        <Button disabled={pending} size="sm" type="submit">
          {pending ? 'Posting…' : 'Post comment'}
        </Button>
      </form>
    </div>
  );
}
