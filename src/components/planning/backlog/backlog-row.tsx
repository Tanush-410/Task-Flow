'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { PersonAvatar } from '@/components/person-avatar';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { BacklogWorkItem } from '@/modules/backlog/queries';
import type { WorkItemType } from '@/modules/backlog/schemas';
import type { VariantProps } from 'class-variance-authority';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const TYPE_LABELS: Record<WorkItemType, string> = {
  epic: 'Epic',
  feature: 'Feature',
  user_story: 'User story',
  task: 'Task',
};

const TYPE_VARIANT: Record<WorkItemType, BadgeVariant> = {
  epic: 'default',
  feature: 'secondary',
  user_story: 'outline',
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

function formatEstimate(item: BacklogWorkItem): string | null {
  if (item.storyPoints != null) return `${item.storyPoints} pts`;
  if (item.originalHours != null && item.remainingHours != null) {
    return `${item.remainingHours}h / ${item.originalHours}h`;
  }
  if (item.originalHours != null) return `${item.originalHours}h`;
  return null;
}

export function BacklogRow({
  item,
  depth,
  collapsedIds,
  onToggle,
  memberNameById,
}: {
  item: BacklogWorkItem;
  depth: number;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  memberNameById: Record<string, string>;
}) {
  const hasChildren = item.children.length > 0;
  const isOpen = !collapsedIds.has(item.id);
  const estimate = formatEstimate(item);

  return (
    <Collapsible onOpenChange={() => onToggle(item.id)} open={isOpen}>
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger
            aria-label={
              isOpen ? `Collapse ${item.title}` : `Expand ${item.title}`
            }
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            type="button"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'size-4 transition-transform',
                isOpen && 'rotate-90',
              )}
            />
          </CollapsibleTrigger>
        ) : (
          <span aria-hidden className="size-4 shrink-0" />
        )}

        <Badge variant={TYPE_VARIANT[item.type]}>
          {TYPE_LABELS[item.type]}
        </Badge>

        <Link
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary"
          href={`/tasks/${item.id}`}
        >
          {item.title}
        </Link>

        <Badge variant={PRIORITY_VARIANT[item.priority] ?? 'secondary'}>
          {PRIORITY_LABELS[item.priority] ?? item.priority}
        </Badge>

        {estimate ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {estimate}
          </span>
        ) : null}

        {item.assigneeIds.length > 0 ? (
          <div className="flex shrink-0 -space-x-1.5">
            {item.assigneeIds.slice(0, 3).map((userId) => (
              <PersonAvatar
                displayName={memberNameById[userId] ?? 'Unknown'}
                key={userId}
                size="sm"
                userId={userId}
              />
            ))}
          </div>
        ) : null}
      </div>

      {hasChildren ? (
        <CollapsibleContent>
          <div className="divide-y divide-border border-t border-border">
            {item.children.map((child) => (
              <BacklogRow
                collapsedIds={collapsedIds}
                depth={depth + 1}
                item={child}
                key={child.id}
                memberNameById={memberNameById}
                onToggle={onToggle}
              />
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
