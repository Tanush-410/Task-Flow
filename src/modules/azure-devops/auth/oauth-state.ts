import 'server-only';

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';

import { serverEnv } from '@/lib/server-env';
import { createAdminSupabase } from '@/lib/supabase/admin';

import { decryptSecret, encryptSecret, type EncryptionKey } from './crypto';

const SETTINGS_PATH = '/settings/integrations/azure-devops';
const RANDOM_BYTES = 32;
const EXPIRY_MILLISECONDS = 10 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

type OAuthStateInsert = {
  state_hash: string;
  organization_id: string;
  user_id: string;
  pkce_verifier_ciphertext: string;
  return_path: string;
  expires_at: string;
};

type ConsumeArgs = {
  target_organization_id: string;
  target_state_hash: string;
  target_user_id: string;
};

type DatabaseResponse<T> = {
  data?: T | null;
  error?: unknown;
};

export type OAuthStateAdminClient = {
  from(table: 'azure_devops_oauth_states'): {
    insert(values: OAuthStateInsert): PromiseLike<DatabaseResponse<unknown>>;
    delete(): {
      or(filter: string): PromiseLike<DatabaseResponse<unknown>>;
    };
  };
  rpc(
    functionName: 'consume_azure_devops_oauth_state',
    args: ConsumeArgs,
  ): PromiseLike<DatabaseResponse<unknown>>;
};

export type OAuthStateDependencies = {
  readonly admin?: OAuthStateAdminClient;
  readonly now?: () => Date;
  readonly randomBytes?: (size: number) => Uint8Array;
  readonly currentKey?: EncryptionKey;
  readonly decryptionKeys?: readonly EncryptionKey[];
};

export type CreateOAuthAttemptInput = {
  organizationId: string;
  userId: string;
  returnPath?: string;
  now?: Date;
};

export type ConsumeOAuthAttemptInput = {
  state: string;
  organizationId: string;
  userId: string;
};

export type CleanupOAuthAttemptsInput = {
  readonly cutoff?: Date;
};

type OAuthStateDependencySnapshot = Readonly<{
  admin?: OAuthStateAdminClient;
  now?: () => Date;
  randomBytes?: (size: number) => Uint8Array;
  currentKey?: EncryptionKey;
  decryptionKeys?: readonly EncryptionKey[];
}>;

class OAuthAttemptError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OAuthAttemptError';
    this.code = code;
  }
}

function invalidCreateInput(): never {
  throw new OAuthAttemptError(
    'INVALID_OAUTH_ATTEMPT',
    'OAuth attempt input is invalid.',
  );
}

function createFailed(): never {
  throw new OAuthAttemptError(
    'OAUTH_ATTEMPT_CREATE_FAILED',
    'OAuth attempt could not be created.',
  );
}

function invalidOAuthState(): never {
  throw new OAuthAttemptError(
    'INVALID_OAUTH_STATE',
    'OAuth state is invalid or expired.',
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function normalizeReturnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return SETTINGS_PATH;
  }

  try {
    const parsed = new URL(value, 'https://oauth-state.invalid');
    if (
      parsed.origin !== 'https://oauth-state.invalid' ||
      parsed.pathname !== SETTINGS_PATH
    ) {
      return SETTINGS_PATH;
    }

    return value;
  } catch {
    return SETTINGS_PATH;
  }
}

function randomBase64url(source: (size: number) => Uint8Array): string {
  const bytes = source(RANDOM_BYTES);
  const isByteView =
    ArrayBuffer.isView(bytes) &&
    'BYTES_PER_ELEMENT' in bytes &&
    bytes.BYTES_PER_ELEMENT === 1;
  if (!isByteView || bytes.byteLength !== RANDOM_BYTES) {
    createFailed();
  }
  return Buffer.from(bytes).toString('base64url');
}

function currentEnvironmentKey(): EncryptionKey {
  const env = serverEnv();
  return {
    id: env.AZURE_DEVOPS_TOKEN_KEY_ID,
    bytes: new Uint8Array(
      Buffer.from(env.AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY, 'base64'),
    ),
  };
}

function defaultAdminClient(): OAuthStateAdminClient {
  return createAdminSupabase() as unknown as OAuthStateAdminClient;
}

function cloneKey(key: EncryptionKey): EncryptionKey {
  return Object.freeze({
    id: key.id,
    bytes: new Uint8Array(Buffer.from(key.bytes)),
  });
}

function snapshotDependencies(
  dependencies: OAuthStateDependencies,
): OAuthStateDependencySnapshot {
  return Object.freeze({
    admin: dependencies.admin,
    now: dependencies.now,
    randomBytes: dependencies.randomBytes,
    currentKey: dependencies.currentKey
      ? cloneKey(dependencies.currentKey)
      : undefined,
    decryptionKeys: dependencies.decryptionKeys
      ? Object.freeze(dependencies.decryptionKeys.map(cloneKey))
      : undefined,
  });
}

function isCanonicalState(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length !== 43 ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return false;
  }

  const decoded = Buffer.from(value, 'base64url');
  return (
    decoded.byteLength === RANDOM_BYTES &&
    decoded.toString('base64url') === value
  );
}

function isConsumedRow(
  value: unknown,
): value is { pkce_verifier_ciphertext: string; return_path: string } {
  if (!value || typeof value !== 'object') return false;

  const row = value as Record<string, unknown>;
  return (
    typeof row.pkce_verifier_ciphertext === 'string' &&
    row.pkce_verifier_ciphertext.length > 0 &&
    typeof row.return_path === 'string' &&
    normalizeReturnPath(row.return_path) === row.return_path
  );
}

export async function createOAuthAttempt(
  input: CreateOAuthAttemptInput,
  dependencies: OAuthStateDependencies = {},
): Promise<{ state: string; codeChallenge: string }> {
  if (
    !input ||
    !isUuid(input.organizationId) ||
    !isUuid(input.userId) ||
    (input.now !== undefined &&
      (!(input.now instanceof Date) || Number.isNaN(input.now.valueOf())))
  ) {
    invalidCreateInput();
  }

  try {
    const snapshot = snapshotDependencies(dependencies);
    const randomSource = snapshot.randomBytes ?? nodeRandomBytes;
    const key = snapshot.currentKey ?? currentEnvironmentKey();
    const admin = snapshot.admin ?? defaultAdminClient();
    const state = randomBase64url(randomSource);
    const codeVerifier = randomBase64url(randomSource);
    const codeChallenge = createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');
    const stateHash = createHash('sha256').update(state, 'ascii').digest('hex');
    const now = input.now ?? (snapshot.now ?? (() => new Date()))();
    if (!(now instanceof Date) || Number.isNaN(now.valueOf())) createFailed();

    const response = await admin.from('azure_devops_oauth_states').insert({
      state_hash: stateHash,
      organization_id: input.organizationId,
      user_id: input.userId,
      pkce_verifier_ciphertext: encryptSecret(codeVerifier, key),
      return_path: normalizeReturnPath(input.returnPath),
      expires_at: new Date(now.valueOf() + EXPIRY_MILLISECONDS).toISOString(),
    });

    if (!response || response.error) createFailed();
    return { state, codeChallenge };
  } catch {
    createFailed();
  }
}

export async function consumeOAuthAttempt(
  input: ConsumeOAuthAttemptInput,
  dependencies: OAuthStateDependencies = {},
): Promise<{ codeVerifier: string; returnPath: string }> {
  try {
    const snapshot = snapshotDependencies(dependencies);
    if (
      !input ||
      !isCanonicalState(input.state) ||
      !isUuid(input.organizationId) ||
      !isUuid(input.userId)
    ) {
      invalidOAuthState();
    }

    const stateHash = createHash('sha256')
      .update(input.state, 'ascii')
      .digest('hex');
    const admin = snapshot.admin ?? defaultAdminClient();
    const keys =
      snapshot.decryptionKeys ??
      (snapshot.currentKey ? [snapshot.currentKey] : [currentEnvironmentKey()]);
    const response = await admin.rpc('consume_azure_devops_oauth_state', {
      target_organization_id: input.organizationId,
      target_state_hash: stateHash,
      target_user_id: input.userId,
    });

    if (
      !response ||
      response.error ||
      !Array.isArray(response.data) ||
      response.data.length !== 1 ||
      !isConsumedRow(response.data[0])
    ) {
      invalidOAuthState();
    }

    const codeVerifier = decryptSecret(
      response.data[0].pkce_verifier_ciphertext,
      keys,
    );
    if (!PKCE_VERIFIER_PATTERN.test(codeVerifier)) invalidOAuthState();

    return {
      codeVerifier,
      returnPath: response.data[0].return_path,
    };
  } catch {
    invalidOAuthState();
  }
}

export async function cleanupOAuthAttempts(
  input: CleanupOAuthAttemptsInput | undefined = undefined,
  dependencies: OAuthStateDependencies = {},
): Promise<void> {
  try {
    const snapshot = snapshotDependencies(dependencies);
    const cutoff = input?.cutoff ?? (snapshot.now ?? (() => new Date()))();
    if (!(cutoff instanceof Date) || Number.isNaN(cutoff.valueOf())) return;

    const cutoffIso = new Date(cutoff.valueOf()).toISOString();
    const admin = snapshot.admin ?? defaultAdminClient();
    await admin
      .from('azure_devops_oauth_states')
      .delete()
      .or(`consumed_at.not.is.null,expires_at.lte.${cutoffIso}`);
  } catch {
    // Cleanup is intentionally best effort and must not affect OAuth flows.
  }
}
