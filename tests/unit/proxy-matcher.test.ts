import { describe, expect, it } from 'vitest';

import { shouldRefreshSession } from '@/lib/supabase/proxy-paths';

describe('shouldRefreshSession', () => {
  it.each(['/dashboard', '/login', '/auth/callback', '/api/tasks'])(
    'retains the application route %s',
    (pathname) => {
      expect(shouldRefreshSession(pathname)).toBe(true);
    },
  );

  it.each([
    '/_next/static/chunks/app.js',
    '/_next/image',
    '/_next/hmr',
    '/_next/webpack-hmr',
    '/favicon.ico',
    '/logo.svg',
    '/images/avatar.png',
    '/fonts/app.woff2',
    '/robots.txt',
  ])('excludes the static path %s', (pathname) => {
    expect(shouldRefreshSession(pathname)).toBe(false);
  });
});
