import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// jsdom doesn't implement scrollIntoView; radix Select calls it when an
// item is selected.
Element.prototype.scrollIntoView = vi.fn();

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  moveWorkItem: vi.fn(),
  fetchWorkItemMoveOptions: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/modules/backlog/actions', () => ({
  moveWorkItem: mocks.moveWorkItem,
  fetchWorkItemMoveOptions: mocks.fetchWorkItemMoveOptions,
}));

import { MoveWorkItemDialog } from '@/components/planning/backlog/move-work-item-dialog';

const taskId = '30000000-0000-0000-0000-000000000001';
const currentTeamId = '20000000-0000-0000-0000-000000000001';
const otherTeamId = '20000000-0000-0000-0000-000000000002';
const epicId = '30000000-0000-0000-0000-000000000002';

function renderDialog(
  props: Partial<React.ComponentProps<typeof MoveWorkItemDialog>> = {},
) {
  return render(
    <MoveWorkItemDialog
      currentTeamId={currentTeamId}
      taskId={taskId}
      title="Sign up form"
      trigger={<button type="button">Open</button>}
      type="feature"
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MoveWorkItemDialog', () => {
  it('fetches options scoped to the type when opened', async () => {
    mocks.fetchWorkItemMoveOptions.mockResolvedValue({
      descendantCount: 0,
      candidates: [],
    });

    renderDialog({ type: 'feature' });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    await vi.waitFor(() =>
      expect(mocks.fetchWorkItemMoveOptions).toHaveBeenCalledWith(
        taskId,
        'feature',
      ),
    );
  });

  it('moves within the same team without requiring a descendant checkbox', async () => {
    mocks.fetchWorkItemMoveOptions.mockResolvedValue({
      descendantCount: 4,
      candidates: [
        {
          id: epicId,
          title: 'Ship the thing',
          planningTeamId: currentTeamId,
          planningTeamName: 'Platform',
        },
      ],
    });
    mocks.moveWorkItem.mockResolvedValue({
      ok: true,
      data: { movedCount: 1 },
    });

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByLabelText('New parent');

    fireEvent.click(screen.getByRole('combobox', { name: 'New parent' }));
    fireEvent.click(
      screen.getByRole('option', { name: 'Ship the thing (Platform)' }),
    );

    expect(
      screen.queryByText(/descendant/, { selector: 'label' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Move' }));

    await vi.waitFor(() =>
      expect(mocks.moveWorkItem).toHaveBeenCalledWith({
        taskId,
        newParentTaskId: epicId,
        newPlanningTeamId: currentTeamId,
        includeDescendants: false,
      }),
    );
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('requires the descendant checkbox for a cross-team move with descendants', async () => {
    mocks.fetchWorkItemMoveOptions.mockResolvedValue({
      descendantCount: 2,
      candidates: [
        {
          id: epicId,
          title: 'Other epic',
          planningTeamId: otherTeamId,
          planningTeamName: 'Growth',
        },
      ],
    });
    mocks.moveWorkItem.mockResolvedValue({
      ok: true,
      data: { movedCount: 3 },
    });

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByLabelText('New parent');

    fireEvent.click(screen.getByRole('combobox', { name: 'New parent' }));
    fireEvent.click(
      screen.getByRole('option', { name: 'Other epic (Growth)' }),
    );

    expect(screen.getByText(/2 descendants, which will move/)).toBeVisible();
    const moveButton = screen.getByRole('button', { name: 'Move' });
    expect(moveButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Move 2 descendants too/ }),
    );
    expect(moveButton).toBeEnabled();

    fireEvent.click(moveButton);

    await vi.waitFor(() =>
      expect(mocks.moveWorkItem).toHaveBeenCalledWith({
        taskId,
        newParentTaskId: epicId,
        newPlanningTeamId: otherTeamId,
        includeDescendants: true,
      }),
    );
  });

  it('shows a plain team picker and sends a null parent for an epic', async () => {
    mocks.fetchWorkItemMoveOptions.mockResolvedValue({
      descendantCount: 0,
      candidates: [
        {
          id: otherTeamId,
          title: 'Growth',
          planningTeamId: otherTeamId,
          planningTeamName: 'Growth',
        },
      ],
    });
    mocks.moveWorkItem.mockResolvedValue({
      ok: true,
      data: { movedCount: 1 },
    });

    renderDialog({ type: 'epic', title: 'Ship the thing' });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByLabelText('New team');

    fireEvent.click(screen.getByRole('combobox', { name: 'New team' }));
    fireEvent.click(screen.getByRole('option', { name: 'Growth' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));

    await vi.waitFor(() =>
      expect(mocks.moveWorkItem).toHaveBeenCalledWith({
        taskId,
        newParentTaskId: null,
        newPlanningTeamId: otherTeamId,
        includeDescendants: false,
      }),
    );
  });

  it('shows a safe error and keeps the dialog open on failure', async () => {
    mocks.fetchWorkItemMoveOptions.mockResolvedValue({
      descendantCount: 0,
      candidates: [
        {
          id: epicId,
          title: 'Ship the thing',
          planningTeamId: currentTeamId,
          planningTeamName: 'Platform',
        },
      ],
    });
    mocks.moveWorkItem.mockResolvedValue({
      ok: false,
      error: {
        code: 'WORK_ITEM_FORBIDDEN',
        message: 'You cannot make that backlog change.',
        traceId: 'trace-1',
      },
    });

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByLabelText('New parent');
    fireEvent.click(screen.getByRole('combobox', { name: 'New parent' }));
    fireEvent.click(
      screen.getByRole('option', { name: 'Ship the thing (Platform)' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));

    await screen.findByText('You cannot make that backlog change.');
    expect(screen.getByRole('heading', { name: /Move/ })).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
