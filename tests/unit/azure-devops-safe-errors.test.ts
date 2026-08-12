import { describe, expect, it } from 'vitest';

import {
  AZURE_DEVOPS_SAFE_ERROR_CODES,
  azureDevOpsSafeErrorCodeSchema,
} from '@/modules/azure-devops/connections/safe-errors';

describe('Azure DevOps persisted safe error codes', () => {
  it('exposes the canonical persisted codes as a readonly schema', () => {
    expect(AZURE_DEVOPS_SAFE_ERROR_CODES).toEqual([
      'AZURE_RECONNECT_REQUIRED',
      'AZURE_CONNECTION_DATA_INVALID',
      'AZURE_CONNECTION_QUERY_FAILED',
    ]);

    for (const code of AZURE_DEVOPS_SAFE_ERROR_CODES) {
      expect(azureDevOpsSafeErrorCodeSchema.parse(code)).toBe(code);
    }
  });

  it.each([
    'reconnect_required',
    'AZURE_UNAVAILABLE',
    'AZURE_CONNECTION_QUERY_FAILED_PROVIDER_BODY',
    '',
  ])('rejects noncanonical persisted code %s', (code) => {
    expect(azureDevOpsSafeErrorCodeSchema.safeParse(code).success).toBe(false);
  });
});
