import 'server-only';

import { createHash } from 'node:crypto';

import { createAdminSupabase } from '@/lib/supabase/admin';

import type { Database } from '@/lib/supabase/database.types';

type DeploymentEnvironment =
  Database['public']['Enums']['deployment_environment'];
type MembershipRole = Database['public']['Enums']['membership_role'];

type FeatureFlagRecord = {
  organization_id: string | null;
  role_scope: MembershipRole | null;
  enabled: boolean;
  rollout_percentage: number;
  expires_on: string;
};

type FeatureFlagQuery = (input: {
  key: string;
  environment: DeploymentEnvironment;
}) => Promise<unknown>;

type EvaluateFeatureFlagInput = {
  key: string;
  environment: DeploymentEnvironment;
  userId: string;
  organizationId?: string | null;
  role?: MembershipRole | null;
};

type EvaluateFeatureFlagDependencies = {
  query?: FeatureFlagQuery;
  now?: () => Date;
};

export function isInRollout(
  userId: string,
  key: string,
  percentage: number,
): boolean {
  if (!userId.trim() || !key.trim() || !Number.isFinite(percentage)) {
    return false;
  }
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  const bucket =
    Number.parseInt(
      createHash('sha256').update(`${key}:${userId}`).digest('hex').slice(0, 8),
      16,
    ) % 100;

  return bucket < percentage;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value)
  );
}

function isFeatureFlagRecord(value: unknown): value is FeatureFlagRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  const expiresOn = record.expires_on;

  return (
    (record.organization_id === null ||
      (typeof record.organization_id === 'string' &&
        record.organization_id.length > 0)) &&
    (record.role_scope === null ||
      record.role_scope === 'admin' ||
      record.role_scope === 'employee') &&
    typeof record.enabled === 'boolean' &&
    typeof record.rollout_percentage === 'number' &&
    Number.isInteger(record.rollout_percentage) &&
    record.rollout_percentage >= 0 &&
    record.rollout_percentage <= 100 &&
    isDateOnly(expiresOn)
  );
}

async function queryFeatureFlags(input: {
  key: string;
  environment: DeploymentEnvironment;
}): Promise<FeatureFlagRecord[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('feature_flags')
    .select(
      'organization_id, role_scope, enabled, rollout_percentage, expires_on',
    )
    .eq('key', input.key)
    .eq('environment', input.environment);

  if (error || !data) throw new Error('Feature flag query failed');

  return data;
}

function scopeSpecificity(record: FeatureFlagRecord): number {
  return (
    (record.organization_id === null ? 0 : 2) +
    (record.role_scope === null ? 0 : 1)
  );
}

export async function evaluateFeatureFlag(
  input: EvaluateFeatureFlagInput,
  dependencies: EvaluateFeatureFlagDependencies = {},
): Promise<boolean> {
  if (
    !input.key.trim() ||
    !input.userId.trim() ||
    !['development', 'staging', 'production'].includes(input.environment) ||
    (input.organizationId !== undefined &&
      input.organizationId !== null &&
      !input.organizationId.trim()) ||
    (input.role !== undefined &&
      input.role !== null &&
      input.role !== 'admin' &&
      input.role !== 'employee')
  ) {
    return false;
  }

  try {
    const rows = await (dependencies.query ?? queryFeatureFlags)({
      key: input.key,
      environment: input.environment,
    });
    if (!Array.isArray(rows) || !rows.every(isFeatureFlagRecord)) return false;

    const applicable = rows.filter(
      (row) =>
        (row.organization_id === null ||
          row.organization_id === input.organizationId) &&
        (row.role_scope === null || row.role_scope === input.role),
    );
    if (applicable.length === 0) return false;

    const highestSpecificity = Math.max(...applicable.map(scopeSpecificity));
    const selected = applicable.filter(
      (row) => scopeSpecificity(row) === highestSpecificity,
    );
    if (selected.length !== 1) return false;

    const flag = selected[0];
    const today = (dependencies.now ?? (() => new Date()))()
      .toISOString()
      .slice(0, 10);

    return (
      flag.enabled &&
      flag.expires_on >= today &&
      isInRollout(input.userId, input.key, flag.rollout_percentage)
    );
  } catch {
    return false;
  }
}
