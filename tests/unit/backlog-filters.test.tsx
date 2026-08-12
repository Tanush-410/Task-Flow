import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

import { BacklogFilters } from '@/components/planning/backlog/backlog-filters';

const teamId = '20000000-0000-0000-0000-000000000001';
const assignees = [
  {
    userId: '00000000-0000-0000-0000-000000000002',
    displayName: 'Ada Lovelace',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BacklogFilters', () => {
  it('shows the current filter values', () => {
    render(
      <BacklogFilters
        assigneeId="all"
        assignees={assignees}
        estimateState="all"
        teamId={teamId}
        text="onboarding"
        type="epic"
      />,
    );

    expect(screen.getByDisplayValue('onboarding')).toBeVisible();
  });

  it('debounces the search input and navigates with the query preserved', () => {
    vi.useFakeTimers();

    render(
      <BacklogFilters
        assigneeId="all"
        assignees={assignees}
        estimateState="all"
        teamId={teamId}
        text=""
        type="all"
      />,
    );

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'sign up' },
    });

    expect(mocks.push).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(mocks.push).toHaveBeenCalledWith(
      `/planning/teams/${teamId}/backlog?q=sign+up`,
    );

    vi.useRealTimers();
  });

  it('does not render an assignee filter when there are no assignable members', () => {
    render(
      <BacklogFilters
        assigneeId="all"
        assignees={[]}
        estimateState="all"
        teamId={teamId}
        text=""
        type="all"
      />,
    );

    expect(screen.queryByLabelText('Assignee')).not.toBeInTheDocument();
  });
});
