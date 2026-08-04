import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOwnConnectCode: vi.fn(),
  listMyConnectionRequests: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/modules/members/queries', () => ({
  getOwnConnectCode: mocks.getOwnConnectCode,
  listMyConnectionRequests: mocks.listMyConnectionRequests,
}));

import AccessPendingPage from '@/app/access-pending/page';

describe('access pending page', () => {
  it('explains that organization access is pending', async () => {
    mocks.getOwnConnectCode.mockResolvedValue(null);
    mocks.listMyConnectionRequests.mockResolvedValue([]);

    render(await AccessPendingPage());

    expect(
      screen.getByRole('heading', { name: 'Access pending' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/organization administrator/i)).toBeInTheDocument();
  });

  it('shows the connect code so it can be shared with an admin', async () => {
    mocks.getOwnConnectCode.mockResolvedValue({
      connectCode: 'ABC123',
      displayName: 'Jane Doe',
    });
    mocks.listMyConnectionRequests.mockResolvedValue([]);

    render(await AccessPendingPage());

    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });
});
