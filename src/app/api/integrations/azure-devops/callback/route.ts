import 'server-only';

import { NextResponse } from 'next/server';

import { serverEnv, type ServerEnv } from '@/lib/server-env';
import { createAdminSupabase } from '@/lib/supabase/admin';
import {
  encryptSecret,
  type EncryptionKey,
} from '@/modules/azure-devops/auth/crypto';
import { exchangeEntraCode } from '@/modules/azure-devops/auth/entra';
import { consumeOAuthAttempt } from '@/modules/azure-devops/auth/oauth-state';
import { getAzureProfile } from '@/modules/azure-devops/client/discovery';
import { createAzureDevOpsClient } from '@/modules/azure-devops/client/http';
import { getAzureDevOpsAdminAccess } from '@/modules/azure-devops/connections/access';
import type { MembershipContext } from '@/modules/members/context';

const SETTINGS_PATH = '/settings/integrations/azure-devops';
const PRIVATE_REDIRECT_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
} as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CallbackResult =
  | 'callback_failed'
  | 'connected'
  | 'consent_denied'
  | 'invalid_callback'
  | 'invalid_state'
  | 'reconnected';

function redirectUrl(
  appOrigin: string,
  result: CallbackResult,
  returnPath: unknown = SETTINGS_PATH,
): URL {
  let url = new URL(SETTINGS_PATH, appOrigin);

  if (
    typeof returnPath === 'string' &&
    returnPath.length <= 2_048 &&
    returnPath.startsWith('/') &&
    !returnPath.startsWith('//') &&
    !returnPath.includes('\\') &&
    !CONTROL_CHARACTER_PATTERN.test(returnPath)
  ) {
    try {
      const candidate = new URL(returnPath, appOrigin);
      if (
        candidate.origin === appOrigin &&
        candidate.pathname === SETTINGS_PATH
      ) {
        url = candidate;
      }
    } catch {
      // The fixed settings path remains the safe destination.
    }
  }

  url.searchParams.set('result', result);
  return url;
}

function redirectResult(
  appOrigin: string,
  result: CallbackResult,
  returnPath?: unknown,
): NextResponse {
  return NextResponse.redirect(redirectUrl(appOrigin, result, returnPath), {
    status: 303,
    headers: PRIVATE_REDIRECT_HEADERS,
  });
}

function accessRedirect(appOrigin: string, location: string): NextResponse {
  return NextResponse.redirect(new URL(location, appOrigin), {
    status: 303,
    headers: PRIVATE_REDIRECT_HEADERS,
  });
}

function oneValue(
  searchParams: URLSearchParams,
  name: 'code' | 'error' | 'error_description' | 'state',
): string | null | undefined {
  const values = searchParams.getAll(name);
  if (values.length > 1) return undefined;
  return values[0] ?? null;
}

function isBoundedSafeString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= minimum &&
    value.length <= maximum &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isCanonicalState(value: unknown): value is string {
  if (!isBoundedSafeString(value, 43, 43) || !BASE64URL_PATTERN.test(value)) {
    return false;
  }
  const decoded = Buffer.from(value, 'base64url');
  return decoded.byteLength === 32 && decoded.toString('base64url') === value;
}

type ParsedCallback =
  | { kind: 'denied'; state: string }
  | { kind: 'invalid' }
  | { kind: 'success'; code: string; state: string };

function parseCallback(request: Request): ParsedCallback {
  const searchParams = new URL(request.url).searchParams;
  const code = oneValue(searchParams, 'code');
  const state = oneValue(searchParams, 'state');
  const error = oneValue(searchParams, 'error');
  const errorDescription = oneValue(searchParams, 'error_description');

  if (
    code === undefined ||
    state === undefined ||
    error === undefined ||
    errorDescription === undefined
  ) {
    return { kind: 'invalid' };
  }

  if (
    code !== null &&
    isBoundedSafeString(code, 1, 4_096) &&
    isCanonicalState(state) &&
    error === null &&
    errorDescription === null
  ) {
    return { kind: 'success', code, state };
  }

  if (
    code === null &&
    isBoundedSafeString(error, 1, 256) &&
    isCanonicalState(state) &&
    (errorDescription === null ||
      isBoundedSafeString(errorDescription, 0, 4_096))
  ) {
    return { kind: 'denied', state };
  }

  return { kind: 'invalid' };
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

type PersistenceResult = {
  connection_id: string;
  connection_status: 'pending' | 'configured' | 'paused' | 'disconnected';
  was_existing: boolean;
  credentials_applied: boolean;
};

function isPersistenceResult(value: unknown): value is PersistenceResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    Object.keys(row).length === 4 &&
    isUuid(row.connection_id) &&
    ['pending', 'configured', 'paused', 'disconnected'].includes(
      String(row.connection_status),
    ) &&
    typeof row.was_existing === 'boolean' &&
    typeof row.credentials_applied === 'boolean'
  );
}

function encryptionKey(environment: ServerEnv): EncryptionKey {
  return {
    id: environment.AZURE_DEVOPS_TOKEN_KEY_ID,
    bytes: new Uint8Array(
      Buffer.from(environment.AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY, 'base64'),
    ),
  };
}

async function persistConnection(
  membership: MembershipContext,
  environment: ServerEnv,
  identity: {
    id: string;
    displayName: string;
    email: string | null;
  },
  credentials: {
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    expiresAt: string;
    grantedScopes: readonly string[];
  },
): Promise<'connected' | 'reconnected'> {
  const admin = createAdminSupabase();
  const optionalEmail = identity.email
    ? { target_authorized_user_email: identity.email }
    : {};
  const { data, error } = await admin.rpc(
    'persist_azure_devops_oauth_connection',
    {
      target_organization_id: membership.organizationId,
      target_actor_id: membership.userId,
      target_tenant_id: environment.AZURE_DEVOPS_ENTRA_TENANT_ID,
      target_authorized_user_id: identity.id,
      target_authorized_user_display_name: identity.displayName,
      target_granted_scopes: [...credentials.grantedScopes],
      target_access_token_ciphertext: credentials.accessTokenCiphertext,
      target_refresh_token_ciphertext: credentials.refreshTokenCiphertext,
      target_token_expires_at: credentials.expiresAt,
      ...optionalEmail,
    },
  );

  if (
    error ||
    !Array.isArray(data) ||
    data.length !== 1 ||
    !isPersistenceResult(data[0])
  ) {
    throw new Error('Connection persistence failed.');
  }

  return data[0].was_existing ? 'reconnected' : 'connected';
}

export async function GET(request: Request): Promise<NextResponse> {
  const { APP_ORIGIN } = serverEnv();
  const access = await getAzureDevOpsAdminAccess();
  if (access.kind === 'redirect') {
    return accessRedirect(APP_ORIGIN, access.location);
  }
  const { membership } = access;
  const environment = serverEnv();
  const parsed = parseCallback(request);

  if (parsed.kind === 'invalid') {
    return redirectResult(APP_ORIGIN, 'invalid_callback');
  }
  let consumed: { codeVerifier: string; returnPath: string };
  try {
    consumed = await consumeOAuthAttempt({
      state: parsed.state,
      organizationId: membership.organizationId,
      userId: membership.userId,
    });
  } catch {
    return redirectResult(APP_ORIGIN, 'invalid_state');
  }

  if (parsed.kind === 'denied') {
    return redirectResult(APP_ORIGIN, 'consent_denied');
  }

  try {
    const tokens = await exchangeEntraCode({
      code: parsed.code,
      codeVerifier: consumed.codeVerifier,
    });
    const client = createAzureDevOpsClient({
      tokenProvider: {
        getAccessToken: async () => tokens.accessToken,
        refreshAccessToken: async () => {
          throw new Error('Unexpected token refresh.');
        },
      },
    });
    const identity = await getAzureProfile(client);
    const key = encryptionKey(environment);
    const accessTokenCiphertext = encryptSecret(tokens.accessToken, key);
    const refreshTokenCiphertext = encryptSecret(tokens.refreshToken, key);
    const result = await persistConnection(membership, environment, identity, {
      accessTokenCiphertext,
      refreshTokenCiphertext,
      expiresAt: tokens.expiresAt,
      grantedScopes: tokens.grantedScopes,
    });

    return redirectResult(APP_ORIGIN, result, consumed.returnPath);
  } catch {
    return redirectResult(APP_ORIGIN, 'callback_failed', consumed.returnPath);
  }
}
