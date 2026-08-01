import { describe, expect, it } from 'vitest';

import { roleLandingPath, sanitizeNextPath } from '@/modules/auth/navigation';

describe('sanitizeNextPath', () => {
  it('keeps a same-origin internal path with its query and hash', () => {
    expect(sanitizeNextPath('/my-tasks?filter=today#next')).toBe(
      '/my-tasks?filter=today#next',
    );
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example/phish',
    'dashboard',
    '/login',
    '/auth/callback?code=again',
  ])('rejects unsafe or looping destination %s', (candidate) => {
    expect(sanitizeNextPath(candidate)).toBeNull();
  });
});

describe('roleLandingPath', () => {
  it('sends each role to its own default landing page', () => {
    expect(roleLandingPath('admin')).toBe('/dashboard');
    expect(roleLandingPath('employee')).toBe('/my-day');
  });

  it('does not send an employee to an admin-only destination', () => {
    expect(roleLandingPath('employee', '/reports')).toBe('/my-day');
  });

  it('honors a safe authorized next path', () => {
    expect(roleLandingPath('employee', '/notifications')).toBe(
      '/notifications',
    );
  });
});
