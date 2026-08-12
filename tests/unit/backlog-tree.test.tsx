import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  rankBacklogItem: vi.fn(),
  updateWorkItemPlanningFields: vi.fn(),
  createWorkItem: vi.fn(),
  moveWorkItem: vi.fn(),
  fetchWorkItemMoveOptions: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/modules/backlog/actions', () => ({
  rankBacklogItem: mocks.rankBacklogItem,
  updateWorkItemPlanningFields: mocks.updateWorkItemPlanningFields,
  createWorkItem: mocks.createWorkItem,
  moveWorkItem: mocks.moveWorkItem,
  fetchWorkItemMoveOptions: mocks.fetchWorkItemMoveOptions,
}));

import { BacklogTree } from '@/components/planning/backlog/backlog-tree';
import type { BacklogWorkItem } from '@/modules/backlog/queries';

const teamId = '20000000-0000-0000-0000-000000000001';
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
    render(<BacklogTree items={[]} memberNameById={{}} teamId={teamId} />);

    expect(screen.getByText('No work items match these filters')).toBeVisible();
  });

  it('renders the nested hierarchy with type, priority, estimate, and assignee', () => {
    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

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
    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

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

    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

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

    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

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

    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

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

    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '3 pts' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Story points' }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '3 pts' })).toBeVisible();
  });

  it('cancels an inline estimate edit without saving', () => {
    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '3 pts' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Story points' }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: '3 pts' })).toBeVisible();
    expect(mocks.updateWorkItemPlanningFields).not.toHaveBeenCalled();
  });

  it('creates a root epic via the New epic dialog', async () => {
    mocks.createWorkItem.mockResolvedValue({
      ok: true,
      data: { workItemId: 'new-epic-id' },
    });

    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New epic' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Epic C' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create epic' }));

    await vi.waitFor(() =>
      expect(mocks.createWorkItem).toHaveBeenCalledWith(
        expect.objectContaining({
          planningTeamId: teamId,
          parentTaskId: null,
          type: 'epic',
          title: 'Epic C',
        }),
      ),
    );
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('creates a child feature under an epic, scoped to that epic', async () => {
    mocks.createWorkItem.mockResolvedValue({
      ok: true,
      data: { workItemId: 'new-feature-id' },
    });

    render(
      <BacklogTree
        items={baseTree()}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add feature under Epic B' }),
    );
    expect(screen.getByText('Under “Epic B”')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Second feature' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create feature' }));

    await vi.waitFor(() =>
      expect(mocks.createWorkItem).toHaveBeenCalledWith(
        expect.objectContaining({
          planningTeamId: teamId,
          parentTaskId: epicBId,
          type: 'feature',
          title: 'Second feature',
        }),
      ),
    );
  });

  it('does not offer an add-child action on a task, the leaf type', () => {
    const treeWithTask: BacklogWorkItem[] = [
      item({
        id: epicAId,
        title: 'Epic A',
        children: [
          item({
            id: featureId,
            type: 'feature',
            parentTaskId: epicAId,
            title: 'Feature A',
            children: [
              item({
                id: '30000000-0000-0000-0000-000000000004',
                type: 'user_story',
                parentTaskId: featureId,
                title: 'Story A',
                children: [
                  item({
                    id: '30000000-0000-0000-0000-000000000005',
                    type: 'task',
                    parentTaskId: '30000000-0000-0000-0000-000000000004',
                    title: 'Task A',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    render(
      <BacklogTree
        items={treeWithTask}
        memberNameById={memberNameById}
        teamId={teamId}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /Add .* under Task A/ }),
    ).not.toBeInTheDocument();
  });
});
