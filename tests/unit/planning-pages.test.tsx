import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPlanningTeams: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/modules/members/queries', () => ({
  requireMembership: mocks.requireMembership,
}));
vi.mock('@/modules/planning-teams/queries', () => ({
  listPlanningTeams: mocks.listPlanningTeams,
}));
vi.mock('@/components/planning/team-form', () => ({
  TeamForm: () => <div>Create team form</div>,
}));

import PlanningPage from '@/app/(app)/planning/page';
import PlanningTeamsPage from '@/app/(app)/planning/teams/page';

const team = {
  id: 'team-1',
  name: 'Platform',
  description: 'Core delivery',
  defaultSprintLengthDays: 14,
  isArchived: false,
  memberCount: 4,
  currentUserRole: 'planner' as const,
};

describe('planning pages', () => {
  it('renders the team-aware planning landing page', async () => {
    mocks.requireMembership.mockResolvedValue({ role: 'employee' });
    mocks.listPlanningTeams.mockResolvedValue([team]);

    render(await PlanningPage());

    expect(
      screen.getByRole('heading', { name: 'Sprint planning' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/planning/teams/team-1',
    );
    expect(screen.getByText('14-day cadence')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Manage teams' })).toBeNull();
  });

  it('gives admins the team management and create flow', async () => {
    mocks.requireMembership.mockResolvedValue({ role: 'admin' });
    mocks.listPlanningTeams.mockResolvedValue([team]);

    render(await PlanningTeamsPage());

    expect(
      screen.getByRole('heading', { name: 'Planning teams' }),
    ).toBeVisible();
    expect(screen.getByText('Create team form')).toBeVisible();
    expect(mocks.listPlanningTeams).toHaveBeenCalledWith({
      includeArchived: true,
    });
  });
});
