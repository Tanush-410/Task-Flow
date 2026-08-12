'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ListTree, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  BacklogRow,
  type EstimatePatch,
} from '@/components/planning/backlog/backlog-row';
import { CreateWorkItemForm } from '@/components/planning/backlog/create-work-item-form';
import {
  buildBacklogIndex,
  reorderSiblings,
  replaceSiblings,
  updateItemInTree,
} from '@/components/planning/backlog/tree-utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  rankBacklogItem,
  updateWorkItemPlanningFields,
} from '@/modules/backlog/actions';
import type { BacklogWorkItem } from '@/modules/backlog/queries';

function collectParentIds(items: BacklogWorkItem[]): string[] {
  return items.flatMap((item) =>
    item.children.length > 0
      ? [item.id, ...collectParentIds(item.children)]
      : [],
  );
}

export function BacklogTree({
  items: initialItems,
  memberNameById,
  teamId,
}: {
  items: BacklogWorkItem[];
  memberNameById: Record<string, string>;
  teamId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [syncedItems, setSyncedItems] = useState(initialItems);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reconciles with the server after router.refresh() -- necessary (not
  // just belt-and-suspenders) for creations, which add a node that has no
  // optimistic local counterpart to patch in place. Adjusting state during
  // render (rather than in an effect) avoids the extra commit-then-effect
  // render pass for what is, from React's point of view, a derived value.
  if (initialItems !== syncedItems) {
    setSyncedItems(initialItems);
    setItems(initialItems);
  }

  const treeIndex = useMemo(() => buildBacklogIndex(items), [items]);
  const parentIds = useMemo(() => collectParentIds(items), [items]);
  const activeItem = activeId ? (treeIndex.get(activeId)?.item ?? null) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

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

  async function commitRank(
    item: BacklogWorkItem,
    beforeTaskId: string | null,
    afterTaskId: string | null,
  ) {
    const entry = treeIndex.get(item.id);
    if (!entry) return;

    const previousItems = items;
    const reordered = reorderSiblings(
      entry.siblings,
      item.id,
      beforeTaskId,
      afterTaskId,
    );
    setItems((current) => replaceSiblings(current, entry.siblings, reordered));
    setPendingIds((previous) => new Set(previous).add(item.id));
    setError(null);

    const result = await rankBacklogItem({
      taskId: item.id,
      beforeTaskId,
      afterTaskId,
    });

    setPendingIds((previous) => {
      const next = new Set(previous);
      next.delete(item.id);
      return next;
    });

    if (!result.ok) {
      setItems(previousItems);
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function commitEstimate(item: BacklogWorkItem, patch: EstimatePatch) {
    const previousItems = items;
    setItems((current) => updateItemInTree(current, item.id, patch));
    setPendingIds((previous) => new Set(previous).add(item.id));
    setError(null);

    const result = await updateWorkItemPlanningFields({
      taskId: item.id,
      ...patch,
    });

    setPendingIds((previous) => {
      const next = new Set(previous);
      next.delete(item.id);
      return next;
    });

    if (!result.ok) {
      setItems(previousItems);
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedEntry = treeIndex.get(String(active.id));
    const overEntry = treeIndex.get(String(over.id));
    if (!draggedEntry || !overEntry) return;
    if (draggedEntry.siblings !== overEntry.siblings) return;
    if (draggedEntry.item.type !== overEntry.item.type) return;

    const typedSiblings = overEntry.siblings.filter(
      (sibling) =>
        sibling.type === draggedEntry.item.type &&
        sibling.id !== draggedEntry.item.id,
    );
    const targetIndex = typedSiblings.findIndex(
      (sibling) => sibling.id === overEntry.item.id,
    );
    if (targetIndex === -1) return;

    void commitRank(
      draggedEntry.item,
      typedSiblings[targetIndex - 1]?.id ?? null,
      overEntry.item.id,
    );
  }

  const newEpicTrigger = (
    <CreateWorkItemForm
      parentTaskId={null}
      planningTeamId={teamId}
      trigger={
        <Button size="sm" type="button">
          <Plus aria-hidden />
          New epic
        </Button>
      }
      type="epic"
    />
  );

  if (items.length === 0) {
    return (
      <EmptyState
        action={newEpicTrigger}
        description="Create an epic to start building out this team's backlog, or clear your filters."
        icon={ListTree}
        title="No work items match these filters"
      />
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <p>{error}</p>
          <button
            className="shrink-0 text-sm font-semibold underline underline-offset-2"
            onClick={() => setError(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {newEpicTrigger}
        <div className="flex gap-2">
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
      </div>

      <DndContext
        id="backlog-tree"
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
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
              onEstimateSave={commitEstimate}
              onMove={commitRank}
              onToggle={toggle}
              pendingIds={pendingIds}
              siblings={items}
              teamId={teamId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-card-lg">
              {activeItem.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
