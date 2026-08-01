import { describe, expect, it } from 'vitest';

import { writeServerCookies } from '@/lib/supabase/cookie-writes';

describe('writeServerCookies', () => {
  it('suppresses the known read-only Server Component cookie error', () => {
    const error = Object.assign(new Error('framework detail'), {
      __NEXT_ERROR_CODE: 'E1180',
    });

    expect(() =>
      writeServerCookies(() => {
        throw error;
      }),
    ).not.toThrow();
  });

  it('rethrows unknown cookie-write errors', () => {
    const error = new Error('unexpected cookie failure');

    expect(() =>
      writeServerCookies(() => {
        throw error;
      }),
    ).toThrow(error);
  });
});
