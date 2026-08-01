import { describe, expect, it } from 'vitest';

import { parsePublicEnv } from '@/lib/env';

describe('parsePublicEnv', () => {
  it('parses valid public environment variables', () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key',
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key',
    });
  });

  it('rejects an invalid Supabase URL', () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key',
      }),
    ).toThrow();
  });
});
