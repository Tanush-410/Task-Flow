import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseServerEnv } from '@/lib/server-env';

describe('parseServerEnv', () => {
  it('accepts an absolute HTTP application origin', () => {
    expect(
      parseServerEnv({
        APP_ORIGIN: 'https://tasks.example',
        SUPABASE_SERVICE_ROLE_KEY: 'secret',
      }),
    ).toEqual({
      APP_ORIGIN: 'https://tasks.example',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
    });
  });

  it.each([
    '/relative',
    'javascript:alert(1)',
    'https://tasks.example/base',
    'https://tasks.example?next=evil',
  ])('rejects a non-origin APP_ORIGIN value', (APP_ORIGIN) => {
    expect(() =>
      parseServerEnv({ APP_ORIGIN, SUPABASE_SERVICE_ROLE_KEY: 'secret' }),
    ).toThrow();
  });

  it('rejects a missing service-role credential', () => {
    expect(() =>
      parseServerEnv({ APP_ORIGIN: 'https://tasks.example' }),
    ).toThrow();
  });
});
