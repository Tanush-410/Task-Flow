import { describe, expect, it } from 'vitest';

import { loginSchema } from '@/modules/auth/schemas';

describe('loginSchema', () => {
  it('trims and lowercases a valid email', () => {
    const result = loginSchema.parse({
      email: ' ADMIN@EXAMPLE.COM ',
      password: 'password123',
    });

    expect(result.email).toBe('admin@example.com');
  });

  it('rejects a password shorter than eight characters', () => {
    const result = loginSchema.safeParse({
      email: 'a@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });
});
