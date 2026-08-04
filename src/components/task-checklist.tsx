'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef } from 'react';

import type { ActionResult } from '@/lib/result';
import {
  createChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from '@/modules/checklist/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export type ChecklistItemRow = {
  id: string;
  title: string;
  isDone: boolean;
};

async function submitItem(
  _previousState: ActionResult<{ itemId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ itemId: string }>> {
  return createChecklistItem({
    taskId: formData.get('taskId'),
    title: formData.get('title'),
  });
}

function ChecklistRow({ item }: { item: ChecklistItemRow }) {
  const router = useRouter();

  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Checkbox
        checked={item.isDone}
        onCheckedChange={(checked) => {
          toggleChecklistItem({
            itemId: item.id,
            isDone: checked === true,
          }).then((result) => {
            if (result.ok) router.refresh();
          });
        }}
      />
      <span
        className={
          item.isDone
            ? 'flex-1 text-sm text-muted-foreground line-through'
            : 'flex-1 text-sm text-foreground'
        }
      >
        {item.title}
      </span>
      <button
        className="text-xs font-semibold text-muted-foreground hover:text-red-400"
        onClick={() => {
          deleteChecklistItem({ itemId: item.id }).then((result) => {
            if (result.ok) router.refresh();
          });
        }}
        type="button"
      >
        Remove
      </button>
    </li>
  );
}

export function TaskChecklist({
  taskId,
  items,
}: {
  taskId: string;
  items: ChecklistItemRow[];
}) {
  const [state, formAction, pending] = useActionState(submitItem, null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const doneCount = items.filter((item) => item.isDone).length;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width: `${(doneCount / items.length) * 100}%`,
              }}
            />
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <ChecklistRow item={item} key={item.id} />
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No checklist items yet.</p>
      )}

      <form
        action={formAction}
        className="flex gap-2"
        key={state?.ok ? 'sent' : 'idle'}
      >
        <input name="taskId" type="hidden" value={taskId} />
        <Input
          className="h-9"
          disabled={pending}
          maxLength={200}
          name="title"
          placeholder="Add an item…"
          ref={inputRef}
          required
        />
        <Button disabled={pending} size="sm" type="submit">
          Add
        </Button>
      </form>
    </div>
  );
}
