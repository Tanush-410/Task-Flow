'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { Database } from '@/lib/supabase/database.types';
import { bulkUpdateTaskStatus } from '@/modules/tasks/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type Task = Database['public']['Tables']['tasks']['Row'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Active',
  archived: 'Archived',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function isOverdue(dueAt: string | null, status: string): boolean {
  return (
    Boolean(dueAt) && status !== 'archived' && new Date(dueAt!) < new Date()
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const allSelected = selected.size > 0 && selected.size === tasks.length;

  function toggle(taskId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((previous) =>
      previous.size === tasks.length
        ? new Set()
        : new Set(tasks.map((t) => t.id)),
    );
  }

  function runBulkAction(status: 'published' | 'archived') {
    const taskIds = Array.from(selected);
    startTransition(() => {
      bulkUpdateTaskStatus({ taskIds, status }).then((result) => {
        if (result.ok) {
          setSelected(new Set());
          router.refresh();
        }
      });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            aria-label="Select all tasks"
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          {selected.size > 0
            ? `${selected.size} selected`
            : 'Select all on this page'}
        </label>

        {selected.size > 0 ? (
          <div className="flex gap-2">
            <Button
              disabled={isPending}
              onClick={() => runBulkAction('archived')}
              size="sm"
              variant="outline"
            >
              Archive selected
            </Button>
            <Button
              disabled={isPending}
              onClick={() => runBulkAction('published')}
              size="sm"
              variant="outline"
            >
              Restore selected
            </Button>
          </div>
        ) : null}
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {tasks.map((task) => {
          const overdue = isOverdue(task.due_at, task.status);

          return (
            <li className="flex items-center gap-3 px-5 py-4" key={task.id}>
              <Checkbox
                aria-label={`Select ${task.title}`}
                checked={selected.has(task.id)}
                onCheckedChange={() => toggle(task.id)}
              />
              <Link
                className="flex min-w-0 flex-1 items-center justify-between gap-4 hover:opacity-80"
                href={`/tasks/${task.id}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {task.title}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2">
                    <Badge variant="secondary">
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                    <Badge
                      variant={
                        task.status === 'archived' ? 'secondary' : 'default'
                      }
                    >
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  {task.due_at ? (
                    <span
                      className={
                        overdue
                          ? 'font-semibold text-red-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {overdue ? 'Overdue · ' : 'Due '}
                      {new Date(task.due_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No due date</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
