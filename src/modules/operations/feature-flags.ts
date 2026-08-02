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
  organizationId: string | null;
  role: MembershipRole | null;
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

const FEATURE_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const ROLLOUT_SUBJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isInRollout(
  userId: string,
  key: string,
  percentage: number,
): boolean {
  if (
    typeof userId !== 'string' ||
    !ROLLOUT_SUBJECT_PATTERN.test(userId) ||
    typeof key !== 'string' ||
    key.length > 64 ||
    !FEATURE_KEY_PATTERN.test(key) ||
    !Number.isInteger(percentage)
  ) {
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
  organizationId: string | null;
  role: MembershipRole | null;
}): Promise<FeatureFlagRecord[]> {
  const admin = createAdminSupabase();
  let query = admin
    .from('feature_flags')
    .select(
      'organization_id, role_scope, enabled, rollout_percentage, expires_on',
    )
    .eq('key', input.key)
    .eq('environment', input.environment);

  query = input.organizationId
    ? query.or(
        `organization_id.is.null,organization_id.eq.${input.organizationId}`,
      )
    : query.is('organization_id', null);
  query = input.role
    ? query.or(`role_scope.is.null,role_scope.eq.${input.role}`)
    : query.is('role_scope', null);

  const { data, error } = await query;

  if (error || !data) throw new Error('Feature flag query failed');

  return data;
}

function scopeSpecificity(record: FeatureFlagRecord): number {
  // Precedence is org+role > org-only > global+role > global-unscoped.
  // Organization specificity intentionally outranks global role specificity.
  return (
    (record.organization_id === null ? 0 : 2) +
    (record.role_scope === null ? 0 : 1)
  );
}

function parseEvaluationInput(value: unknown): {
  key: string;
  environment: DeploymentEnvironment;
  userId: string;
  organizationId: string | null;
  role: MembershipRole | null;
} | null {
  if (!value || typeof value !== 'object') return null;

  const input = value as Record<string, unknown>;
  const key = input.key;
  const environment = input.environment;
  const userId = input.userId;
  const organizationId = input.organizationId ?? null;
  const role = input.role ?? null;

  if (
    typeof key !== 'string' ||
    key.length > 64 ||
    !FEATURE_KEY_PATTERN.test(key) ||
    (environment !== 'development' &&
      environment !== 'staging' &&
      environment !== 'production') ||
    typeof userId !== 'string' ||
    !UUID_PATTERN.test(userId) ||
    (organizationId !== null &&
      (typeof organizationId !== 'string' ||
        !UUID_PATTERN.test(organizationId))) ||
    (role !== null && role !== 'admin' && role !== 'employee')
  ) {
    return null;
  }

  return { key, environment, userId, organizationId, role };
}

export async function evaluateFeatureFlag(
  input: EvaluateFeatureFlagInput,
  dependencies: EvaluateFeatureFlagDependencies = {},
): Promise<boolean> {
  try {
    const validated = parseEvaluationInput(input);
    if (!validated) return false;

    const rows = await (dependencies.query ?? queryFeatureFlags)({
      key: validated.key,
      environment: validated.environment,
      organizationId: validated.organizationId,
      role: validated.role,
    });
    if (!Array.isArray(rows) || !rows.every(isFeatureFlagRecord)) return false;

    const applicable = rows.filter(
      (row) =>
        (row.organization_id === null ||
          row.organization_id === validated.organizationId) &&
        (row.role_scope === null || row.role_scope === validated.role),
    );
    if (applicable.length === 0) return false;

    const highestSpecificity = Math.max(...applicable.map(scopeSpecificity));
    const selected = applicable.filter(
      (row) => scopeSpecificity(row) === highestSpecificity,
    );
    if (selected.length !== 1) return false;

    const flag = selected[0];
    // expires_on is inclusive for the current UTC calendar date.
    const today = (dependencies.now ?? (() => new Date()))()
      .toISOString()
      .slice(0, 10);

    return (
      flag.enabled &&
      flag.expires_on >= today &&
      isInRollout(validated.userId, validated.key, flag.rollout_percentage)
    );
  } catch {
    return false;
  }
}
