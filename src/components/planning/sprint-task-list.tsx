'use client';

import type { VariantProps } from 'class-variance-authority';
import { ListTree, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PersonAvatar } from '@/components/person-avatar';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { updateWorkItemPlanningFields } from '@/modules/backlog/actions';
import type { SprintTaskRow } from '@/modules/sprints/queries';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const TYPE_LABELS: Record<SprintTaskRow['type'], string> = {
  epic: 'Epic',
  feature: 'Feature',
  user_story: 'User story',
  bug: 'Bug',
  task: 'Task',
};

const TYPE_VARIANT: Record<SprintTaskRow['type'], BadgeVariant> = {
  epic: 'default',
  feature: 'secondary',
  user_story: 'outline',
  bug: 'destructive',
  task: 'outline',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

function formatEstimate(task: SprintTaskRow): string | null {
  if (task.storyPoints != null) return `${task.storyPoints} pts`;
  if (task.originalHours != null && task.remainingHours != null) {
    return `${task.remainingHours}h / ${task.originalHours}h`;
  }
  return null;
}

function SprintTaskItem({
  task,
  memberNameById,
}: {
  task: SprintTaskRow;
  memberNameById: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const estimate = formatEstimate(task);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Badge variant={TYPE_VARIANT[task.type]}>{TYPE_LABELS[task.type]}</Badge>
      <Link
        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary"
        href={`/tasks/${task.id}`}
      >
        {task.title}
      </Link>
      <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'secondary'}>
        {PRIORITY_LABELS[task.priority] ?? task.priority}
      </Badge>
      {estimate ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {estimate}
        </span>
      ) : null}
      {task.assigneeIds.length > 0 ? (
        <div className="flex shrink-0 -space-x-1.5">
          {task.assigneeIds.slice(0, 3).map((userId) => (
            <PersonAvatar
              displayName={memberNameById[userId] ?? 'Unknown'}
              key={userId}
              size="sm"
              userId={userId}
            />
          ))}
        </div>
      ) : null}
      <Button
        aria-label={`Remove ${task.title} from this sprint`}
        disabled={pending}
        onClick={() => {
          setPending(true);
          updateWorkItemPlanningFields({
            taskId: task.id,
            sprintId: null,
          }).then(() => {
            setPending(false);
            router.refresh();
          });
        }}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

export function SprintTaskList({
  tasks,
  memberNameById,
}: {
  tasks: SprintTaskRow[];
  memberNameById: Record<string, string>;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        description="Assign tasks to this sprint from the team's backlog."
        icon={ListTree}
        title="Nothing planned yet"
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {tasks.map((task) => (
        <SprintTaskItem
          key={task.id}
          memberNameById={memberNameById}
          task={task}
        />
      ))}
    </ul>
  );
}
