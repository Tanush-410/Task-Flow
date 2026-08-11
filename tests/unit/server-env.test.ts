import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseServerEnv } from '@/lib/server-env';

const validServerEnv = {
  APP_ORIGIN: 'https://tasks.example',
  SUPABASE_SERVICE_ROLE_KEY: 'secret',
  AZURE_DEVOPS_ENTRA_TENANT_ID: 'organizations',
  AZURE_DEVOPS_ENTRA_CLIENT_ID: '4f86df7a-4c57-4da8-b838-09c9441b35d2',
  AZURE_DEVOPS_ENTRA_CLIENT_SECRET: 'client-secret',
  AZURE_DEVOPS_OAUTH_SCOPES:
    'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
  AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  AZURE_DEVOPS_TOKEN_KEY_ID: 'azure-devops.key-1',
};

describe('parseServerEnv', () => {
  it('accepts an absolute HTTP application origin', () => {
    expect(parseServerEnv(validServerEnv)).toEqual(validServerEnv);
  });

  it.each([
    '/relative',
    'javascript:alert(1)',
    'https://tasks.example/base',
    'https://tasks.example?next=evil',
  ])('rejects a non-origin APP_ORIGIN value', (APP_ORIGIN) => {
    expect(() => parseServerEnv({ ...validServerEnv, APP_ORIGIN })).toThrow();
  });

  it('rejects a missing service-role credential', () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toThrow();
  });

  it('rejects an invalid Entra client UUID', () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        AZURE_DEVOPS_ENTRA_CLIENT_ID: 'not-a-uuid',
      }),
    ).toThrow();
  });

  it('rejects an empty Entra tenant ID', () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        AZURE_DEVOPS_ENTRA_TENANT_ID: '',
      }),
    ).toThrow();
  });

  it('rejects an empty Entra client secret', () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        AZURE_DEVOPS_ENTRA_CLIENT_SECRET: '',
      }),
    ).toThrow();
  });

  it('rejects OAuth scopes without offline_access', () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        AZURE_DEVOPS_OAUTH_SCOPES:
          'openid profile email 499b84ac-1321-427f-aa17-267ca6975798/.default',
      }),
    ).toThrow();
  });

  it.each([31, 33])(
    'rejects an encryption key that decodes to %i bytes',
    (byteLength) => {
      expect(() =>
        parseServerEnv({
          ...validServerEnv,
          AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY:
            Buffer.alloc(byteLength).toString('base64'),
        }),
      ).toThrow();
    },
  );

  it.each(['.starts-with-dot', 'contains spaces', 'a'.repeat(33)])(
    'rejects the invalid encryption key ID %j',
    (AZURE_DEVOPS_TOKEN_KEY_ID) => {
      expect(() =>
        parseServerEnv({
          ...validServerEnv,
          AZURE_DEVOPS_TOKEN_KEY_ID,
        }),
      ).toThrow();
    },
  );
});
