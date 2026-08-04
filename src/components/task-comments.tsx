'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef } from 'react';

import type { ActionResult } from '@/lib/result';
import { tokenizeMentions, type Mentionable } from '@/lib/mentions';
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

function CommentBody({
  body,
  members,
}: {
  body: string;
  members: Mentionable[];
}) {
  const tokens = tokenizeMentions(body, members);

  return (
    <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
      {tokens.map((token, index) =>
        token.type === 'mention' ? (
          <span
            className="font-semibold text-primary"
            key={`${token.userId}-${index}`}
          >
            {token.value}
          </span>
        ) : (
          <span key={`text-${index}`}>{token.value}</span>
        ),
      )}
    </p>
  );
}

export function TaskComments({
  taskId,
  comments,
  members,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  comments: TaskCommentRow[];
  members: Mentionable[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitComment, null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  function insertMention(displayName: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const current = textarea.value;
    textarea.value =
      current.length === 0 || current.endsWith(' ')
        ? `${current}@${displayName} `
        : `${current} @${displayName} `;
    textarea.focus();
  }

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
                <CommentBody body={comment.body} members={members} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="space-y-2"
        key={state?.ok ? 'sent' : 'idle'}
      >
        <input name="taskId" type="hidden" value={taskId} />
        <Textarea
          disabled={pending}
          maxLength={4000}
          name="body"
          placeholder="Add a comment… type @ to mention someone"
          ref={textareaRef}
          required
          rows={2}
        />
        {members.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {members.map((member) => (
              <button
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                key={member.userId}
                onClick={() => insertMention(member.displayName)}
                type="button"
              >
                @{member.displayName}
              </button>
            ))}
          </div>
        ) : null}
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
