import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AccessPendingPage from '@/app/access-pending/page';

describe('access pending page', () => {
  it('explains that organization access is pending', () => {
    render(<AccessPendingPage />);

    expect(
      screen.getByRole('heading', { name: 'Access pending' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/organization administrator/i)).toBeInTheDocument();
  });
});
