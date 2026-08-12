import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  rankBacklogItem: vi.fn(),
  updateWorkItemPlanningFields: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/modules/backlog/actions', () => ({
  rankBacklogItem: mocks.rankBacklogItem,
  updateWorkItemPlanningFields: mocks.updateWorkItemPlanningFields,
}));

import { BacklogTree } from '@/components/planning/backlog/backlog-tree';
import type { BacklogWorkItem } from '@/modules/backlog/queries';

const userId = '00000000-0000-0000-0000-000000000002';

function item(overrides: Partial<BacklogWorkItem>): BacklogWorkItem {
  return {
    id: '30000000-0000-0000-0000-000000000001',
    parentTaskId: null,
    type: 'epic',
    title: 'Untitled',
    priority: 'medium',
    storyPoints: null,
    originalHours: null,
    remainingHours: null,
    backlogRank: 'V',
    assigneeIds: [],
    children: [],
    ...overrides,
  };
}

const epicAId = '30000000-0000-0000-0000-000000000001';
const epicBId = '30000000-0000-0000-0000-000000000002';
const featureId = '30000000-0000-0000-0000-000000000003';

function baseTree(): BacklogWorkItem[] {
  return [
    item({ id: epicAId, title: 'Epic A', backlogRank: 'A' }),
    item({
      id: epicBId,
      title: 'Epic B',
      backlogRank: 'B',
      children: [
        item({
          id: featureId,
          type: 'feature',
          parentTaskId: epicBId,
          title: 'Feature under B',
          storyPoints: 3,
          assigneeIds: [userId],
        }),
      ],
    }),
  ];
}

const memberNameById = { [userId]: 'Ada Lovelace' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BacklogTree', () => {
  it('shows an empty state when there are no items', () => {
    render(<BacklogTree items={[]} memberNameById={{}} />);

    expect(screen.getByText('No work items match these filters')).toBeVisible();
  });

  it('renders the nested hierarchy with type, priority, estimate, and assignee', () => {
    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    expect(screen.getByRole('link', { name: 'Epic A' })).toHaveAttribute(
      'href',
      `/tasks/${epicAId}`,
    );
    expect(
      screen.getByRole('link', { name: 'Feature under B' }),
    ).toHaveAttribute('href', `/tasks/${featureId}`);
    expect(screen.getByText('3 pts')).toBeVisible();
    expect(screen.getByTitle('Ada Lovelace')).toBeVisible();
  });

  it('collapses and re-expands every branch via the all-branches controls', () => {
    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    expect(screen.getByRole('button', { name: 'Expand all' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));

    expect(screen.getByRole('button', { name: 'Expand Epic B' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeEnabled();
  });

  it('moves an item down via the rank button and calls rankBacklogItem with the right neighbors', async () => {
    mocks.rankBacklogItem.mockResolvedValue({
      ok: true,
      data: { rank: 'C' },
    });

    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    expect(
      screen.getByRole('button', { name: 'Move Epic A up' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move Epic B down' }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Move Epic A down' }));

    expect(mocks.rankBacklogItem).toHaveBeenCalledWith({
      taskId: epicAId,
      beforeTaskId: epicBId,
      afterTaskId: null,
    });

    const rows = screen.getAllByRole('link', { name: /^Epic/ });
    expect(rows[0]).toHaveTextContent('Epic B');
    expect(rows[1]).toHaveTextContent('Epic A');

    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('reverts the optimistic move and shows an error when the rank call fails', async () => {
    mocks.rankBacklogItem.mockResolvedValue({
      ok: false,
      error: { code: 'RANK_CONFLICT', message: 'The backlog order changed.' },
    });

    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move Epic A down' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The backlog order changed.',
    );

    const rows = screen.getAllByRole('link', { name: /^Epic/ });
    expect(rows[0]).toHaveTextContent('Epic A');
    expect(rows[1]).toHaveTextContent('Epic B');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('edits an estimate inline and calls updateWorkItemPlanningFields', async () => {
    mocks.updateWorkItemPlanningFields.mockResolvedValue({
      ok: true,
      data: { taskId: featureId },
    });

    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    fireEvent.click(screen.getByRole('button', { name: '3 pts' }));
    const input = screen.getByRole('spinbutton', { name: 'Story points' });
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }));

    expect(mocks.updateWorkItemPlanningFields).toHaveBeenCalledWith({
      taskId: featureId,
      storyPoints: 8,
    });
    expect(screen.getByRole('button', { name: '8 pts' })).toBeVisible();

    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('reverts an inline estimate edit when the save fails', async () => {
    mocks.updateWorkItemPlanningFields.mockResolvedValue({
      ok: false,
      error: { code: 'WORK_ITEM_FORBIDDEN', message: 'Not allowed.' },
    });

    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    fireEvent.click(screen.getByRole('button', { name: '3 pts' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Story points' }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '3 pts' })).toBeVisible();
  });

  it('cancels an inline estimate edit without saving', () => {
    render(<BacklogTree items={baseTree()} memberNameById={memberNameById} />);

    fireEvent.click(screen.getByRole('button', { name: '3 pts' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Story points' }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: '3 pts' })).toBeVisible();
    expect(mocks.updateWorkItemPlanningFields).not.toHaveBeenCalled();
  });
});
