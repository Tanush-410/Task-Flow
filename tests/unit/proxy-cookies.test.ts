import { describe, expect, it } from 'vitest';

import { synchronizeProxyCookies } from '@/lib/supabase/proxy-cookies';

describe('synchronizeProxyCookies', () => {
  it('writes refreshed cookies to the request and replacement response', () => {
    const values = [
      {
        name: 'sb-access-token',
        value: 'refreshed',
        options: { httpOnly: true },
      },
    ];
    const requestWrites: unknown[] = [];
    const responseWrites: unknown[] = [];
    const response = { kind: 'replacement' };

    const result = synchronizeProxyCookies(
      values,
      (name, value) => requestWrites.push({ name, value }),
      () => response,
      (target, name, value, options) => {
        responseWrites.push({ target, name, value, options });
      },
    );

    expect(requestWrites).toEqual([
      { name: 'sb-access-token', value: 'refreshed' },
    ]);
    expect(responseWrites).toEqual([
      {
        target: response,
        name: 'sb-access-token',
        value: 'refreshed',
        options: { httpOnly: true },
      },
    ]);
    expect(result).toBe(response);
  });
});
