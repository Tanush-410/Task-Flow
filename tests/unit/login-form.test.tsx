import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: mocks.useActionState };
});
vi.mock('@/modules/auth/actions', () => ({ login: vi.fn() }));

import { LoginForm } from '@/components/login-form';

afterEach(cleanup);

describe('LoginForm', () => {
  it('associates labels and field errors with the inputs', () => {
    mocks.useActionState.mockReturnValue([
      {
        ok: false,
        error: {
          code: 'INVALID_LOGIN',
          message: 'Enter a valid email and password.',
          traceId: 'trace-123',
          fields: { email: ['Enter a valid email address.'] },
        },
      },
      vi.fn(),
      false,
    ]);

    render(<LoginForm />);

    const email = screen.getByRole('textbox', { name: 'Email' });
    expect(email).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a valid email and password.',
    );
    expect(screen.getByText('Reference: trace-123')).toBeVisible();
  });

  it('exposes and disables the pending submission state', () => {
    mocks.useActionState.mockReturnValue([null, vi.fn(), true]);

    render(<LoginForm />);

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Signing in');
  });
});
