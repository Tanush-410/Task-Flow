import type { BacklogWorkItem } from '@/modules/backlog/queries';

export type BacklogTreeEntry = {
  item: BacklogWorkItem;
  siblings: BacklogWorkItem[];
};

/**
 * Maps every item id to itself plus the exact sibling array it lives in
 * (the parent's `children`, or the root list) -- reference-equal to the
 * array in `items`, so `replaceSiblings` can locate it again by identity.
 */
export function buildBacklogIndex(
  items: BacklogWorkItem[],
): Map<string, BacklogTreeEntry> {
  const index = new Map<string, BacklogTreeEntry>();

  function walk(nodes: BacklogWorkItem[]) {
    for (const node of nodes) {
      index.set(node.id, { item: node, siblings: nodes });
      if (node.children.length > 0) walk(node.children);
    }
  }

  walk(items);
  return index;
}

/**
 * Returns `siblings` with `itemId` moved to sit immediately before
 * `afterId`, or immediately after `beforeId` when there's no upper
 * neighbor, or at the front when both are null (moved to the very start
 * of the scope). Unknown ids are a no-op -- the caller's optimistic
 * update is simply skipped, the server call remains the source of truth.
 */
export function reorderSiblings(
  siblings: BacklogWorkItem[],
  itemId: string,
  beforeId: string | null,
  afterId: string | null,
): BacklogWorkItem[] {
  const item = siblings.find((sibling) => sibling.id === itemId);
  if (!item) return siblings;

  const rest = siblings.filter((sibling) => sibling.id !== itemId);

  if (afterId !== null) {
    const index = rest.findIndex((sibling) => sibling.id === afterId);
    if (index === -1) return siblings;
    return [...rest.slice(0, index), item, ...rest.slice(index)];
  }

  if (beforeId !== null) {
    const index = rest.findIndex((sibling) => sibling.id === beforeId);
    if (index === -1) return siblings;
    return [...rest.slice(0, index + 1), item, ...rest.slice(index + 1)];
  }

  return [item, ...rest];
}

/** Rebuilds `items` with `targetSiblings` swapped for `replacement`, by reference identity. */
export function replaceSiblings(
  items: BacklogWorkItem[],
  targetSiblings: BacklogWorkItem[],
  replacement: BacklogWorkItem[],
): BacklogWorkItem[] {
  if (items === targetSiblings) return replacement;

  return items.map((item) => {
    if (item.children === targetSiblings) {
      return { ...item, children: replacement };
    }
    if (item.children.length === 0) return item;
    const children = replaceSiblings(
      item.children,
      targetSiblings,
      replacement,
    );
    return children === item.children ? item : { ...item, children };
  });
}

/** Rebuilds `items` with a shallow patch applied to the node matching `itemId`. */
export function updateItemInTree(
  items: BacklogWorkItem[],
  itemId: string,
  patch: Partial<BacklogWorkItem>,
): BacklogWorkItem[] {
  return items.map((item) => {
    if (item.id === itemId) return { ...item, ...patch };
    if (item.children.length === 0) return item;
    const children = updateItemInTree(item.children, itemId, patch);
    return children === item.children ? item : { ...item, children };
  });
}
