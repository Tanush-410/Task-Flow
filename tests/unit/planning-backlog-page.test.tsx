import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listBacklogHierarchy: vi.fn(),
  listAssignableMembers: vi.fn(),
  requirePlanningTeamAccess: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/modules/backlog/queries', () => ({
  listBacklogHierarchy: mocks.listBacklogHierarchy,
}));
vi.mock('@/modules/members/queries', () => ({
  listAssignableMembers: mocks.listAssignableMembers,
}));
vi.mock('@/modules/planning-teams/queries', () => ({
  requirePlanningTeamAccess: mocks.requirePlanningTeamAccess,
}));

import BacklogPage from '@/app/(app)/planning/teams/[teamId]/backlog/page';

const teamId = '20000000-0000-0000-0000-000000000001';
const epicId = '30000000-0000-0000-0000-000000000001';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BacklogPage', () => {
  it('parses filters from the URL, fetches a scoped tree, and renders it', async () => {
    mocks.requirePlanningTeamAccess.mockResolvedValue({
      id: teamId,
      name: 'Platform',
    });
    mocks.listAssignableMembers.mockResolvedValue([
      { userId: 'user-1', displayName: 'Ada Lovelace' },
    ]);
    mocks.listBacklogHierarchy.mockResolvedValue([
      {
        id: epicId,
        parentTaskId: null,
        type: 'epic',
        title: 'Ship the thing',
        priority: 'high',
        storyPoints: null,
        originalHours: null,
        remainingHours: null,
        backlogRank: 'V',
        assigneeIds: [],
        children: [],
      },
    ]);

    render(
      await BacklogPage({
        params: Promise.resolve({ teamId }),
        searchParams: Promise.resolve({ type: 'epic', q: 'ship' }),
      }),
    );

    expect(mocks.listBacklogHierarchy).toHaveBeenCalledWith(teamId, {
      type: 'epic',
      assigneeId: undefined,
      estimateState: undefined,
      text: 'ship',
    });
    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ship the thing' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute(
      'href',
      `/planning/teams/${teamId}`,
    );
  });

  it('ignores an invalid type filter instead of passing it through', async () => {
    mocks.requirePlanningTeamAccess.mockResolvedValue({
      id: teamId,
      name: 'Platform',
    });
    mocks.listAssignableMembers.mockResolvedValue([]);
    mocks.listBacklogHierarchy.mockResolvedValue([]);

    render(
      await BacklogPage({
        params: Promise.resolve({ teamId }),
        searchParams: Promise.resolve({ type: 'not-a-real-type' }),
      }),
    );

    expect(mocks.listBacklogHierarchy).toHaveBeenCalledWith(teamId, {
      type: undefined,
      assigneeId: undefined,
      estimateState: undefined,
      text: '',
    });
  });
});
