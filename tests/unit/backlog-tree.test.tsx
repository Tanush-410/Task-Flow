import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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

const featureId = '30000000-0000-0000-0000-000000000002';
const epicId = '30000000-0000-0000-0000-000000000001';

const tree: BacklogWorkItem[] = [
  item({
    id: epicId,
    type: 'epic',
    title: 'Ship the thing',
    priority: 'high',
    children: [
      item({
        id: featureId,
        type: 'feature',
        parentTaskId: epicId,
        title: 'Onboarding flow',
        priority: 'medium',
        storyPoints: 5,
        assigneeIds: [userId],
      }),
    ],
  }),
];

const memberNameById = { [userId]: 'Ada Lovelace' };

afterEach(cleanup);

describe('BacklogTree', () => {
  it('shows an empty state when there are no items', () => {
    render(<BacklogTree items={[]} memberNameById={{}} />);

    expect(screen.getByText('No work items match these filters')).toBeVisible();
  });

  it('renders the nested hierarchy with type, priority, estimate, and assignee', () => {
    render(<BacklogTree items={tree} memberNameById={memberNameById} />);

    expect(
      screen.getByRole('link', { name: 'Ship the thing' }),
    ).toHaveAttribute('href', `/tasks/${epicId}`);
    expect(
      screen.getByRole('link', { name: 'Onboarding flow' }),
    ).toHaveAttribute('href', `/tasks/${featureId}`);
    expect(screen.getByText('Epic')).toBeVisible();
    expect(screen.getByText('Feature')).toBeVisible();
    expect(screen.getByText('5 pts')).toBeVisible();
    expect(screen.getByTitle('Ada Lovelace')).toBeVisible();
  });

  it('collapses and expands a branch via its trigger', () => {
    render(<BacklogTree items={tree} memberNameById={memberNameById} />);

    const trigger = screen.getByRole('button', {
      name: 'Collapse Ship the thing',
    });
    expect(screen.getByRole('link', { name: 'Onboarding flow' })).toBeVisible();

    fireEvent.click(trigger);

    expect(
      screen.getByRole('button', { name: 'Expand Ship the thing' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Onboarding flow' }),
    ).not.toBeInTheDocument();
  });

  it('collapses and re-expands every branch via the all-branches controls', () => {
    render(<BacklogTree items={tree} memberNameById={memberNameById} />);

    expect(screen.getByRole('button', { name: 'Expand all' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));

    expect(
      screen.getByRole('button', { name: 'Expand Ship the thing' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(
      screen.getByRole('button', { name: 'Collapse Ship the thing' }),
    ).toBeVisible();
  });
});
