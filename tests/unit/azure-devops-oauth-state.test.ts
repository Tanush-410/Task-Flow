import { createHash, randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decryptSecret,
  encryptSecret,
} from '@/modules/azure-devops/auth/crypto';
import {
  cleanupOAuthAttempts,
  consumeOAuthAttempt,
  createOAuthAttempt,
} from '@/modules/azure-devops/auth/oauth-state';

const organizationId = 'f44d8307-00eb-48bf-8e79-34476e569fd5';
const userId = '9047b9d2-bc90-4e78-b15c-a5c9bd6b9222';
const settingsPath = '/settings/integrations/azure-devops';
const encryptionKey = {
  id: 'azure.devops.key-1',
  bytes: new Uint8Array(Buffer.alloc(32, 19)),
};

const makeAdmin = () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const or = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockReturnValue({ or });
  const from = vi.fn().mockReturnValue({ insert, delete: remove });
  const rpc = vi.fn();

  return { admin: { from, rpc }, from, insert, remove, or, rpc };
};

const createDependencies = (admin: ReturnType<typeof makeAdmin>['admin']) => ({
  admin,
  currentKey: encryptionKey,
  decryptionKeys: [encryptionKey],
});

describe('createOAuthAttempt', () => {
  it('creates independent 256-bit state and RFC 7636 verifier values', async () => {
    const fake = makeAdmin();

    const first = await createOAuthAttempt(
      { organizationId, userId },
      createDependencies(fake.admin),
    );
    const second = await createOAuthAttempt(
      { organizationId, userId },
      createDependencies(fake.admin),
    );
    const firstVerifier = decryptSecret(
      fake.insert.mock.calls[0]![0].pkce_verifier_ciphertext,
      [encryptionKey],
    );
    const secondVerifier = decryptSecret(
      fake.insert.mock.calls[1]![0].pkce_verifier_ciphertext,
      [encryptionKey],
    );

    expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.state).not.toBe(second.state);
    expect(Buffer.from(first.state, 'base64url')).toHaveLength(32);
    expect(Buffer.from(second.state, 'base64url')).toHaveLength(32);
    expect(firstVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstVerifier).not.toBe(secondVerifier);
    expect(Buffer.from(firstVerifier, 'base64url')).toHaveLength(32);
    expect(Buffer.from(secondVerifier, 'base64url')).toHaveLength(32);
    expect(Object.keys(first).sort()).toEqual(['codeChallenge', 'state']);
    expect(fake.remove).not.toHaveBeenCalled();
  });

  it('matches the RFC 7636 S256 challenge vector', async () => {
    const fake = makeAdmin();
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const random = vi
      .fn()
      .mockReturnValueOnce(new Uint8Array(Buffer.alloc(32, 1)))
      .mockReturnValueOnce(new Uint8Array(Buffer.from(verifier, 'base64url')));

    const result = await createOAuthAttempt(
      { organizationId, userId },
      { ...createDependencies(fake.admin), randomBytes: random },
    );

    expect(random).toHaveBeenNthCalledWith(1, 32);
    expect(random).toHaveBeenNthCalledWith(2, 32);
    expect(result.codeChallenge).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('persists only a hashed state, encrypted verifier, and exact ten-minute expiry', async () => {
    const fake = makeAdmin();
    const now = new Date('2026-08-12T10:15:30.000Z');
    const verifierBytes = new Uint8Array(Buffer.alloc(32, 2));
    const verifier = Buffer.from(verifierBytes).toString('base64url');
    const random = vi
      .fn()
      .mockReturnValueOnce(new Uint8Array(Buffer.alloc(32, 1)))
      .mockReturnValueOnce(verifierBytes);

    const result = await createOAuthAttempt(
      { organizationId, userId, returnPath: `${settingsPath}?tab=connection` },
      {
        ...createDependencies(fake.admin),
        now: () => now,
        randomBytes: random,
      },
    );

    expect(fake.from).toHaveBeenCalledWith('azure_devops_oauth_states');
    expect(fake.insert).toHaveBeenCalledOnce();
    const persisted = fake.insert.mock.calls[0]![0];
    expect(persisted).toEqual({
      state_hash: createHash('sha256').update(result.state).digest('hex'),
      organization_id: organizationId,
      user_id: userId,
      pkce_verifier_ciphertext: expect.stringMatching(/^v1\./),
      return_path: `${settingsPath}?tab=connection`,
      expires_at: '2026-08-12T10:25:30.000Z',
    });
    expect(persisted.state_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(
      decryptSecret(persisted.pkce_verifier_ciphertext, [encryptionKey]),
    ).toBe(verifier);
    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain(result.state);
    expect(serialized).not.toContain(verifier);
  });

  it.each([
    settingsPath,
    `${settingsPath}?tab=connection&mode=edit`,
    `${settingsPath}#connection`,
    `${settingsPath}?tab=connection#permissions`,
  ])('preserves the safe relative return path %s', async (returnPath) => {
    const fake = makeAdmin();

    await createOAuthAttempt(
      { organizationId, userId, returnPath },
      createDependencies(fake.admin),
    );

    expect(fake.insert).toHaveBeenCalledWith(
      expect.objectContaining({ return_path: returnPath }),
    );
  });

  it.each([
    undefined,
    '',
    '/',
    '/settings/integrations/azure-devops-extra',
    '/settings/integrations/azure-devops/child',
    '/settings/integrations/azure-devops%2fchild',
    '/settings/integrations/%61zure-devops',
    '/settings/integrations/azure-devops/../github',
    'https://evil.example/settings/integrations/azure-devops',
    '//evil.example/settings/integrations/azure-devops',
    '\\evil.example\\settings\\integrations\\azure-devops',
    `${settingsPath}\\evil`,
    `${settingsPath}\n?tab=connection`,
    `${settingsPath}\u0000?tab=connection`,
  ])('falls back for the unsafe return path %j', async (returnPath) => {
    const fake = makeAdmin();

    await createOAuthAttempt(
      { organizationId, userId, returnPath },
      createDependencies(fake.admin),
    );

    expect(fake.insert).toHaveBeenCalledWith(
      expect.objectContaining({ return_path: settingsPath }),
    );
  });

  it('rejects invalid UUIDs before opening the admin client', async () => {
    const fake = makeAdmin();

    await expect(
      createOAuthAttempt(
        { organizationId: 'not-a-uuid', userId },
        createDependencies(fake.admin),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OAUTH_ATTEMPT' });
    await expect(
      createOAuthAttempt(
        { organizationId, userId: '../user' },
        createDependencies(fake.admin),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OAUTH_ATTEMPT' });
    await expect(
      createOAuthAttempt(
        {
          // TaskFlow's own ids don't require RFC 4122 version/variant
          // nibbles (see src/lib/schemas.ts) — this case must stay invalid
          // for a different reason: a non-hex character.
          organizationId: 'f44d8307-00eb-08bf-0e79-34476e569fzz',
          userId,
        },
        createDependencies(fake.admin),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OAUTH_ATTEMPT' });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('accepts ids shaped like supabase/seed.sql fixtures, which have no RFC 4122 version/variant nibbles', async () => {
    const fake = makeAdmin();

    await expect(
      createOAuthAttempt(
        {
          organizationId: '10000000-0000-0000-0000-000000000001',
          userId: '00000000-0000-0000-0000-000000000001',
        },
        createDependencies(fake.admin),
      ),
    ).resolves.toMatchObject({ state: expect.any(String) });
  });

  it('fails safely when persistence fails', async () => {
    const fake = makeAdmin();
    fake.insert.mockResolvedValue({
      error: { message: 'sensitive database detail' },
    });

    let thrown: unknown;
    try {
      await createOAuthAttempt(
        { organizationId, userId },
        createDependencies(fake.admin),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'OAUTH_ATTEMPT_CREATE_FAILED' });
    expect(`${String(thrown)} ${JSON.stringify(thrown)}`).not.toContain(
      'sensitive database detail',
    );
  });
});

describe('consumeOAuthAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hashes state, delegates organization/user scoping, and decrypts one row', async () => {
    const fake = makeAdmin();
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const ciphertext = encryptSecret(codeVerifier, encryptionKey);
    fake.rpc.mockResolvedValue({
      data: [
        {
          pkce_verifier_ciphertext: ciphertext,
          return_path: `${settingsPath}?tab=connection`,
        },
      ],
      error: null,
    });

    await expect(
      consumeOAuthAttempt(
        { state, organizationId, userId },
        createDependencies(fake.admin),
      ),
    ).resolves.toEqual({
      codeVerifier,
      returnPath: `${settingsPath}?tab=connection`,
    });
    expect(fake.rpc).toHaveBeenCalledWith('consume_azure_devops_oauth_state', {
      target_organization_id: organizationId,
      target_state_hash: createHash('sha256').update(state).digest('hex'),
      target_user_id: userId,
    });
    expect(fake.remove).not.toHaveBeenCalled();
  });

  it('snapshots dependency fields and key material before awaiting the RPC', async () => {
    const fake = makeAdmin();
    const state = randomBytes(32).toString('base64url');
    const initialKey = {
      id: encryptionKey.id,
      bytes: new Uint8Array(encryptionKey.bytes),
    };
    const ciphertext = encryptSecret('a'.repeat(43), initialKey);
    const keyRing = [initialKey];
    const dependencies = {
      admin: fake.admin,
      currentKey: initialKey,
      decryptionKeys: keyRing,
    };
    let resolveRpc!: (value: {
      data: {
        pkce_verifier_ciphertext: string;
        return_path: string;
      }[];
      error: null;
    }) => void;
    fake.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve;
      }),
    );

    const pending = consumeOAuthAttempt(
      { state, organizationId, userId },
      dependencies,
    );
    initialKey.bytes.fill(99);
    keyRing[0] = {
      id: initialKey.id,
      bytes: new Uint8Array(Buffer.alloc(32, 88)),
    };
    dependencies.decryptionKeys = [
      { id: initialKey.id, bytes: new Uint8Array(Buffer.alloc(32, 77)) },
    ];
    dependencies.currentKey = {
      id: initialKey.id,
      bytes: new Uint8Array(Buffer.alloc(32, 66)),
    };
    resolveRpc({
      data: [
        {
          pkce_verifier_ciphertext: ciphertext,
          return_path: settingsPath,
        },
      ],
      error: null,
    });

    await expect(pending).resolves.toEqual({
      codeVerifier: 'a'.repeat(43),
      returnPath: settingsPath,
    });
  });

  it.each([
    ['different organization', crypto.randomUUID(), userId],
    ['different user', organizationId, crypto.randomUUID()],
  ])('delegates %s to the atomic RPC', async (_name, scopedOrg, scopedUser) => {
    const fake = makeAdmin();
    const state = randomBytes(32).toString('base64url');
    fake.rpc.mockResolvedValue({ data: [], error: null });

    await expect(
      consumeOAuthAttempt(
        { state, organizationId: scopedOrg, userId: scopedUser },
        createDependencies(fake.admin),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
    expect(fake.rpc).toHaveBeenCalledWith('consume_azure_devops_oauth_state', {
      target_organization_id: scopedOrg,
      target_state_hash: createHash('sha256').update(state).digest('hex'),
      target_user_id: scopedUser,
    });
  });

  it.each([
    ['null data', null],
    ['missing data', undefined],
    ['empty data', []],
    [
      'multiple rows',
      [
        {
          pkce_verifier_ciphertext: 'ciphertext',
          return_path: settingsPath,
        },
        {
          pkce_verifier_ciphertext: 'ciphertext',
          return_path: settingsPath,
        },
      ],
    ],
    ['null row', [null]],
    ['missing ciphertext', [{ return_path: settingsPath }]],
    ['missing return path', [{ pkce_verifier_ciphertext: 'ciphertext' }]],
    [
      'unsafe return path',
      [
        {
          pkce_verifier_ciphertext: 'ciphertext',
          return_path: 'https://evil.example',
        },
      ],
    ],
  ])('maps %s to INVALID_OAUTH_STATE', async (_name, data) => {
    const fake = makeAdmin();
    const state = randomBytes(32).toString('base64url');
    fake.rpc.mockResolvedValue({ data, error: null });

    await expect(
      consumeOAuthAttempt(
        { state, organizationId, userId },
        createDependencies(fake.admin),
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_OAUTH_STATE',
      message: 'OAuth state is invalid or expired.',
    });
  });

  it('maps RPC errors, rejected RPCs, and decryption failures to one safe error', async () => {
    const state = randomBytes(32).toString('base64url');
    const scenarios = [
      () => ({
        data: null,
        error: { message: `database leaked ${state}` },
      }),
      () => Promise.reject(new Error(`provider leaked ${state}`)),
      () => ({
        data: [
          {
            pkce_verifier_ciphertext: `ciphertext-${state}`,
            return_path: settingsPath,
          },
        ],
        error: null,
      }),
    ];

    for (const scenario of scenarios) {
      const fake = makeAdmin();
      fake.rpc.mockImplementation(scenario);

      let thrown: unknown;
      try {
        await consumeOAuthAttempt(
          { state, organizationId, userId },
          createDependencies(fake.admin),
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: 'INVALID_OAUTH_STATE',
        message: 'OAuth state is invalid or expired.',
      });
      const serialized = `${String(thrown)} ${JSON.stringify(thrown)}`;
      expect(serialized).not.toContain(state);
      expect(serialized).not.toMatch(
        /database leaked|provider leaked|ciphertext-/,
      );
    }
  });

  it('rejects malformed state and UUID inputs without calling the RPC', async () => {
    const fake = makeAdmin();

    for (const input of [
      { state: '', organizationId, userId },
      { state: '***', organizationId, userId },
      {
        state: randomBytes(31).toString('base64url'),
        organizationId,
        userId,
      },
      {
        state: randomBytes(32).toString('base64url'),
        organizationId: 'invalid',
        userId,
      },
      {
        state: randomBytes(32).toString('base64url'),
        organizationId,
        userId: 'invalid',
      },
      {
        state: randomBytes(32).toString('base64url'),
        // Non-hex character — TaskFlow's own ids don't require RFC 4122
        // version/variant nibbles (see src/lib/schemas.ts), so an
        // all-zeros id like seed data uses must NOT be rejected here.
        organizationId: '00000000-0000-0000-0000-00000000000z',
        userId,
      },
    ]) {
      await expect(
        consumeOAuthAttempt(input, createDependencies(fake.admin)),
      ).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
    }

    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe('cleanupOAuthAttempts', () => {
  it('deletes only consumed or expired rows at the snapshotted cutoff', async () => {
    const fake = makeAdmin();
    const cutoff = new Date('2026-08-12T12:34:56.789Z');

    await expect(
      cleanupOAuthAttempts({ cutoff }, createDependencies(fake.admin)),
    ).resolves.toBeUndefined();

    expect(fake.from).toHaveBeenCalledWith('azure_devops_oauth_states');
    expect(fake.remove).toHaveBeenCalledOnce();
    expect(fake.or).toHaveBeenCalledWith(
      'consumed_at.not.is.null,expires_at.lte.2026-08-12T12:34:56.789Z',
    );
  });

  it('uses the injected current time when no cutoff is provided', async () => {
    const fake = makeAdmin();

    await cleanupOAuthAttempts(undefined, {
      ...createDependencies(fake.admin),
      now: () => new Date('2026-08-12T13:00:00.000Z'),
    });

    expect(fake.or).toHaveBeenCalledWith(
      'consumed_at.not.is.null,expires_at.lte.2026-08-12T13:00:00.000Z',
    );
  });

  it('validates the cutoff without broadening the delete', async () => {
    const fake = makeAdmin();

    await expect(
      cleanupOAuthAttempts(
        { cutoff: new Date(Number.NaN) },
        createDependencies(fake.admin),
      ),
    ).resolves.toBeUndefined();

    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.remove).not.toHaveBeenCalled();
    expect(fake.or).not.toHaveBeenCalled();
  });

  it('swallows returned and thrown cleanup failures without logging details', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    for (const behavior of [
      () => Promise.resolve({ error: { message: 'sensitive cleanup error' } }),
      () => Promise.reject(new Error('sensitive rejected cleanup error')),
      () => {
        throw new Error('sensitive thrown cleanup error');
      },
    ]) {
      const fake = makeAdmin();
      fake.or.mockImplementation(behavior);

      await expect(
        cleanupOAuthAttempts(
          { cutoff: new Date('2026-08-12T14:00:00.000Z') },
          createDependencies(fake.admin),
        ),
      ).resolves.toBeUndefined();
    }

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });
});
