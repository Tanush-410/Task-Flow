import { describe, expect, it } from 'vitest';

import {
  buildBacklogIndex,
  reorderSiblings,
  replaceSiblings,
  updateItemInTree,
} from '@/components/planning/backlog/tree-utils';
import type { BacklogWorkItem } from '@/modules/backlog/queries';

function item(overrides: Partial<BacklogWorkItem>): BacklogWorkItem {
  return {
    id: 'id',
    parentTaskId: null,
    type: 'epic',
    title: 'Untitled',
    priority: 'medium',
    storyPoints: null,
    originalHours: null,
    remainingHours: null,
    backlogRank: 'V',
    reproSteps: null,
    severity: null,
    foundInBuild: null,
    assigneeIds: [],
    children: [],
    ...overrides,
  };
}

describe('buildBacklogIndex', () => {
  it('maps every node to itself and its exact sibling array, at every depth', () => {
    const child = item({ id: 'child', type: 'feature' });
    const root = item({ id: 'root', children: [child] });

    const index = buildBacklogIndex([root]);

    expect(index.get('root')?.item).toBe(root);
    expect(index.get('root')?.siblings).toEqual([root]);
    expect(index.get('child')?.item).toBe(child);
    expect(index.get('child')?.siblings).toBe(root.children);
  });
});

describe('reorderSiblings', () => {
  const a = item({ id: 'a', backlogRank: 'A' });
  const b = item({ id: 'b', backlogRank: 'B' });
  const c = item({ id: 'c', backlogRank: 'C' });

  it('moves an item to sit immediately before afterId', () => {
    const result = reorderSiblings([a, b, c], 'c', null, 'b');
    expect(result.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('moves an item to sit immediately after beforeId when there is no afterId', () => {
    const result = reorderSiblings([a, b, c], 'a', 'b', null);
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves an item to the front when both bounds are null', () => {
    const result = reorderSiblings([a, b, c], 'c', null, null);
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op for an unknown item id', () => {
    const siblings = [a, b, c];
    expect(reorderSiblings(siblings, 'missing', null, 'b')).toBe(siblings);
  });

  it('is a no-op when the neighbor id is not found', () => {
    const siblings = [a, b, c];
    expect(reorderSiblings(siblings, 'a', null, 'missing')).toBe(siblings);
  });
});

describe('replaceSiblings', () => {
  it('replaces the root list by reference', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b' });
    const root = [a, b];
    const replacement = [b, a];

    expect(replaceSiblings(root, root, replacement)).toBe(replacement);
  });

  it('replaces a nested children array, rebuilding only the path to it', () => {
    const grandchild = item({ id: 'gc' });
    const child = item({ id: 'child', children: [grandchild] });
    const otherRoot = item({ id: 'other' });
    const root = item({ id: 'root', children: [child] });

    const replacement = [{ ...grandchild, title: 'Reordered' }];
    const result = replaceSiblings(
      [root, otherRoot],
      child.children,
      replacement,
    );

    expect(result[0]!.children[0]!.children).toBe(replacement);
    // Unrelated branches keep their identity -- no unnecessary rebuilds.
    expect(result[1]).toBe(otherRoot);
  });
});

describe('updateItemInTree', () => {
  it('patches the matching node wherever it is nested', () => {
    const grandchild = item({ id: 'gc', storyPoints: null });
    const child = item({ id: 'child', children: [grandchild] });
    const root = item({ id: 'root', children: [child] });

    const result = updateItemInTree([root], 'gc', { storyPoints: 5 });

    expect(result[0]!.children[0]!.children[0]!.storyPoints).toBe(5);
  });

  it('leaves the tree untouched (by reference) when nothing matches', () => {
    const root = item({ id: 'root' });
    const items = [root];

    const result = updateItemInTree(items, 'missing', { storyPoints: 5 });

    expect(result[0]).toBe(root);
  });
});
