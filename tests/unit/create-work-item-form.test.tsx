import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createWorkItem: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/modules/backlog/actions', () => ({
  createWorkItem: mocks.createWorkItem,
}));

import { CreateWorkItemForm } from '@/components/planning/backlog/create-work-item-form';

const teamId = '20000000-0000-0000-0000-000000000001';
const parentId = '30000000-0000-0000-0000-000000000001';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CreateWorkItemForm', () => {
  it('shows story points for a non-task type and submits the expected payload', async () => {
    mocks.createWorkItem.mockResolvedValue({
      ok: true,
      data: { workItemId: 'new-id' },
    });

    render(
      <CreateWorkItemForm
        parentTaskId={null}
        planningTeamId={teamId}
        trigger={<button type="button">Open</button>}
        type="epic"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('heading', { name: 'New epic' })).toBeVisible();
    expect(screen.getByLabelText('Story points')).toBeVisible();
    expect(screen.queryByLabelText('Original hours')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Ship the thing' },
    });
    fireEvent.change(screen.getByLabelText('Story points'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create epic' }));

    await vi.waitFor(() =>
      expect(mocks.createWorkItem).toHaveBeenCalledWith({
        planningTeamId: teamId,
        parentTaskId: null,
        type: 'epic',
        title: 'Ship the thing',
        description: '',
        priority: 'medium',
        storyPoints: 5,
        originalHours: undefined,
        remainingHours: undefined,
      }),
    );
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('shows original/remaining hour fields for a task instead of story points', async () => {
    mocks.createWorkItem.mockResolvedValue({
      ok: true,
      data: { workItemId: 'new-id' },
    });

    render(
      <CreateWorkItemForm
        parentTaskId={parentId}
        parentTitle="Sign up form"
        planningTeamId={teamId}
        trigger={<button type="button">Open</button>}
        type="task"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Under “Sign up form”')).toBeVisible();
    expect(screen.getByLabelText('Original hours')).toBeVisible();
    expect(screen.getByLabelText('Remaining hours')).toBeVisible();
    expect(screen.queryByLabelText('Story points')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Wire up validation' },
    });
    fireEvent.change(screen.getByLabelText('Original hours'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByLabelText('Remaining hours'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await vi.waitFor(() =>
      expect(mocks.createWorkItem).toHaveBeenCalledWith(
        expect.objectContaining({
          parentTaskId: parentId,
          type: 'task',
          originalHours: 8,
          remainingHours: 8,
          storyPoints: undefined,
        }),
      ),
    );
  });

  it('shows a field error and keeps the dialog open on validation failure', async () => {
    mocks.createWorkItem.mockResolvedValue({
      ok: false,
      error: {
        code: 'INVALID_WORK_ITEM',
        message: 'Check the work item details.',
        traceId: 'trace-1',
        fields: { title: ['Title is required'] },
      },
    });

    render(
      <CreateWorkItemForm
        parentTaskId={null}
        planningTeamId={teamId}
        trigger={<button type="button">Open</button>}
        type="epic"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create epic' }));

    await screen.findByText('Title is required');
    expect(screen.getByRole('heading', { name: 'New epic' })).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('resets the form when cancelled and reopened', () => {
    render(
      <CreateWorkItemForm
        parentTaskId={null}
        planningTeamId={teamId}
        trigger={<button type="button">Open</button>}
        type="epic"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Draft title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });
});
