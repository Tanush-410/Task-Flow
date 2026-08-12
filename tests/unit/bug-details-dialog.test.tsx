import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  updateWorkItemPlanningFields: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/modules/backlog/actions', () => ({
  updateWorkItemPlanningFields: mocks.updateWorkItemPlanningFields,
}));

import { BugDetailsDialog } from '@/components/planning/backlog/bug-details-dialog';

const bugId = '30000000-0000-0000-0000-000000000001';

const item = {
  id: bugId,
  title: 'Save button does nothing',
  reproSteps: 'Click Save on an empty form',
  severity: 'high' as const,
  foundInBuild: '1.4.0',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BugDetailsDialog', () => {
  it('pre-fills the current bug details', () => {
    render(
      <BugDetailsDialog
        item={item}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByLabelText('Repro steps')).toHaveValue(
      'Click Save on an empty form',
    );
    expect(screen.getByLabelText('Found in build')).toHaveValue('1.4.0');
  });

  it('saves the edited fields via updateWorkItemPlanningFields', async () => {
    mocks.updateWorkItemPlanningFields.mockResolvedValue({
      ok: true,
      data: { taskId: bugId },
    });

    render(
      <BugDetailsDialog
        item={item}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.change(screen.getByLabelText('Repro steps'), {
      target: { value: 'Updated repro steps' },
    });
    fireEvent.change(screen.getByLabelText('Found in build'), {
      target: { value: '1.5.0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(mocks.updateWorkItemPlanningFields).toHaveBeenCalledWith({
        taskId: bugId,
        reproSteps: 'Updated repro steps',
        severity: 'high',
        foundInBuild: '1.5.0',
      }),
    );
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('sends null for cleared optional fields', async () => {
    mocks.updateWorkItemPlanningFields.mockResolvedValue({
      ok: true,
      data: { taskId: bugId },
    });

    render(
      <BugDetailsDialog
        item={item}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.change(screen.getByLabelText('Repro steps'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Found in build'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(mocks.updateWorkItemPlanningFields).toHaveBeenCalledWith({
        taskId: bugId,
        reproSteps: null,
        severity: 'high',
        foundInBuild: null,
      }),
    );
  });

  it('shows a safe error and keeps the dialog open on failure', async () => {
    mocks.updateWorkItemPlanningFields.mockResolvedValue({
      ok: false,
      error: {
        code: 'WORK_ITEM_FORBIDDEN',
        message: 'You cannot make that backlog change.',
        traceId: 'trace-1',
      },
    });

    render(
      <BugDetailsDialog
        item={item}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('You cannot make that backlog change.');
    expect(screen.getByRole('heading', { name: 'Bug details' })).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('resets to the original values when cancelled and reopened', () => {
    render(
      <BugDetailsDialog
        item={item}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.change(screen.getByLabelText('Repro steps'), {
      target: { value: 'Draft edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByLabelText('Repro steps')).toHaveValue(
      'Click Save on an empty form',
    );
  });
});
