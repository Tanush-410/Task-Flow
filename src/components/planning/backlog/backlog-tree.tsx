'use client';

import { ListTree } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BacklogRow } from '@/components/planning/backlog/backlog-row';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { BacklogWorkItem } from '@/modules/backlog/queries';

function collectParentIds(items: BacklogWorkItem[]): string[] {
  return items.flatMap((item) =>
    item.children.length > 0
      ? [item.id, ...collectParentIds(item.children)]
      : [],
  );
}

export function BacklogTree({
  items,
  memberNameById,
}: {
  items: BacklogWorkItem[];
  memberNameById: Record<string, string>;
}) {
  const parentIds = useMemo(() => collectParentIds(items), [items]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        description="Create an epic to start building out this team's backlog, or clear your filters."
        icon={ListTree}
        title="No work items match these filters"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button
          disabled={collapsedIds.size === 0}
          onClick={() => setCollapsedIds(new Set())}
          size="sm"
          type="button"
          variant="ghost"
        >
          Expand all
        </Button>
        <Button
          disabled={parentIds.length === 0}
          onClick={() => setCollapsedIds(new Set(parentIds))}
          size="sm"
          type="button"
          variant="ghost"
        >
          Collapse all
        </Button>
      </div>

      <div
        className="divide-y divide-border rounded-xl border border-border"
        role="tree"
      >
        {items.map((item) => (
          <BacklogRow
            collapsedIds={collapsedIds}
            depth={0}
            item={item}
            key={item.id}
            memberNameById={memberNameById}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}
