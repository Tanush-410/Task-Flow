import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseServerEnv } from '@/lib/server-env';

describe('parseServerEnv', () => {
  it('accepts an absolute HTTP application origin', () => {
    expect(parseServerEnv({ APP_ORIGIN: 'https://tasks.example' })).toEqual({
      APP_ORIGIN: 'https://tasks.example',
    });
  });

  it.each([
    '/relative',
    'javascript:alert(1)',
    'https://tasks.example/base',
    'https://tasks.example?next=evil',
  ])('rejects a non-origin APP_ORIGIN value', (APP_ORIGIN) => {
    expect(() => parseServerEnv({ APP_ORIGIN })).toThrow();
  });
});
