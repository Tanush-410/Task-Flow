import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useActionState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: mocks.useActionState };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/modules/planning-teams/actions', () => ({
  archivePlanningTeam: vi.fn(),
  createPlanningTeam: vi.fn(),
  setPlanningTeamMembers: vi.fn(),
  updatePlanningTeam: vi.fn(),
}));

import { TeamForm } from '@/components/planning/team-form';
import { TeamMembersForm } from '@/components/planning/team-members-form';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TeamForm', () => {
  it('provides accessible fields and a pending create state', () => {
    mocks.useActionState.mockReturnValue([null, vi.fn(), true]);

    render(<TeamForm mode="create" />);

    expect(screen.getByRole('textbox', { name: 'Team name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeDisabled();
    expect(
      screen.getByRole('spinbutton', { name: 'Sprint length' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  });

  it('renders a safe error and trace reference', () => {
    mocks.useActionState.mockReturnValue([
      {
        ok: false,
        error: {
          code: 'PLANNING_TEAM_SAVE_FAILED',
          message: 'The planning team could not be saved.',
          traceId: 'trace-team-123',
        },
      },
      vi.fn(),
      false,
    ]);

    render(<TeamForm mode="create" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The planning team could not be saved.',
    );
    expect(screen.getByText('Reference: trace-team-123')).toBeVisible();
  });

  it('navigates to a newly created team', () => {
    mocks.useActionState.mockReturnValue([
      { ok: true, data: { teamId: 'team-123' } },
      vi.fn(),
      false,
    ]);

    render(<TeamForm mode="create" />);

    expect(mocks.push).toHaveBeenCalledWith('/planning/teams/team-123');
  });
});

describe('TeamMembersForm', () => {
  it('labels membership, role, and daily capacity controls', () => {
    mocks.useActionState.mockReturnValue([null, vi.fn(), false]);

    render(
      <TeamMembersForm
        canManage
        candidates={[
          {
            userId: 'user-1',
            displayName: 'Asha Admin',
            planningRole: 'planner',
            defaultCapacityHoursPerDay: 8,
          },
        ]}
        currentUserId="user-1"
        teamId="team-1"
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Include Asha Admin' }),
    ).toBeChecked();
    expect(screen.getByLabelText('Role for Asha Admin')).toBeVisible();
    expect(
      screen.getByRole('spinbutton', { name: 'Daily capacity for Asha Admin' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save members' })).toBeEnabled();
  });
});
