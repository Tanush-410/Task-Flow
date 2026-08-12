import 'server-only';

import { NextResponse } from 'next/server';

import { serverEnv } from '@/lib/server-env';
import { createEntraAuthorizationUrl } from '@/modules/azure-devops/auth/entra';
import { createOAuthAttempt } from '@/modules/azure-devops/auth/oauth-state';
import { getAzureDevOpsAdminAccess } from '@/modules/azure-devops/connections/access';

const SETTINGS_PATH = '/settings/integrations/azure-devops';
const ENTRA_ORIGIN = 'https://login.microsoftonline.com';
const PRIVATE_REDIRECT_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
} as const;

function safeFailureUrl(appOrigin: string): URL {
  const url = new URL(SETTINGS_PATH, appOrigin);
  url.searchParams.set('result', 'connect_failed');
  return url;
}

function validatedAuthorizationUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.origin !== ENTRA_ORIGIN ||
    url.protocol !== 'https:' ||
    url.hostname !== 'login.microsoftonline.com' ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid authorization destination.');
  }
  return url;
}

function privateRedirect(destination: URL): NextResponse {
  return NextResponse.redirect(destination, {
    status: 303,
    headers: PRIVATE_REDIRECT_HEADERS,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  void request;
  const { APP_ORIGIN } = serverEnv();
  const access = await getAzureDevOpsAdminAccess();
  if (access.kind === 'redirect') {
    return privateRedirect(new URL(access.location, APP_ORIGIN));
  }
  const { membership } = access;

  try {
    const attempt = await createOAuthAttempt({
      organizationId: membership.organizationId,
      userId: membership.userId,
      returnPath: SETTINGS_PATH,
    });
    const authorizationUrl = createEntraAuthorizationUrl(attempt);

    return privateRedirect(validatedAuthorizationUrl(authorizationUrl));
  } catch {
    return privateRedirect(safeFailureUrl(APP_ORIGIN));
  }
}
