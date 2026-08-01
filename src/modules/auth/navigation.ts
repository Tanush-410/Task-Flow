import type { MembershipContext } from '@/modules/members/context';

type MembershipRole = MembershipContext['role'];

const ADMIN_ONLY_PATHS = ['/dashboard', '/tasks', '/employees', '/reports'];
const AUTH_LOOP_PATHS = ['/login', '/auth/callback'];

function isPathOrDescendant(pathname: string, roots: string[]) {
  return roots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export function sanitizeNextPath(candidate: string | null): string | null {
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return null;
  }

  const origin = 'https://taskflow.local';

  try {
    const url = new URL(candidate, origin);

    if (
      url.origin !== origin ||
      isPathOrDescendant(url.pathname, AUTH_LOOP_PATHS)
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function roleLandingPath(
  role: MembershipRole,
  requestedPath?: string | null,
): '/dashboard' | '/my-day' | string {
  const fallback = role === 'admin' ? '/dashboard' : '/my-day';
  const safePath = sanitizeNextPath(requestedPath ?? null);

  if (!safePath) {
    return fallback;
  }

  const pathname = new URL(safePath, 'https://taskflow.local').pathname;
  if (role === 'employee' && isPathOrDescendant(pathname, ADMIN_ONLY_PATHS)) {
    return fallback;
  }

  return safePath;
}
