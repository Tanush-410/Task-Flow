import { z } from 'zod';

export const AZURE_DEVOPS_SAFE_ERROR_CODES = [
  'AZURE_RECONNECT_REQUIRED',
  'AZURE_CONNECTION_DATA_INVALID',
  'AZURE_CONNECTION_QUERY_FAILED',
] as const;

export const azureDevOpsSafeErrorCodeSchema = z.enum(
  AZURE_DEVOPS_SAFE_ERROR_CODES,
);

export type AzureDevOpsSafeErrorCode = z.infer<
  typeof azureDevOpsSafeErrorCodeSchema
>;
