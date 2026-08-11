import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationPath =
  'supabase/migrations/202608110001_azure_devops_connection_foundation.sql';

type FeatureFlagSeed = {
  environment: string;
  enabled: boolean;
  rolloutPercentage: number;
};

function stripSqlComments(sql: string): string {
  let result = '';
  let inString = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (character === "'") {
      result += character;
      if (inString && nextCharacter === "'") {
        result += nextCharacter;
        index += 1;
      } else {
        inString = !inString;
      }
      continue;
    }

    if (!inString && character === '-' && nextCharacter === '-') {
      index += 2;
      while (index < sql.length && !['\n', '\r'].includes(sql[index])) {
        index += 1;
      }
      result += sql[index] ?? '';
      continue;
    }

    if (!inString && character === '/' && nextCharacter === '*') {
      index += 2;
      while (
        index < sql.length &&
        !(sql[index] === '*' && sql[index + 1] === '/')
      ) {
        index += 1;
      }
      index += 1;
      result += ' ';
      continue;
    }

    result += character;
  }

  return result;
}

function findValuesEnd(sql: string, start: number): number {
  let depth = 0;
  let inString = false;

  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index];

    if (character === "'") {
      if (inString && sql[index + 1] === "'") {
        index += 1;
      } else {
        inString = !inString;
      }
      continue;
    }

    if (inString) continue;
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;

    if (
      depth === 0 &&
      (character === ';' || /^on\s+conflict\b/i.test(sql.slice(index)))
    ) {
      return index;
    }
  }

  return sql.length;
}

function extractValueTuples(values: string): string[] {
  const tuples: string[] = [];
  let depth = 0;
  let inString = false;
  let tupleStart = -1;

  for (let index = 0; index < values.length; index += 1) {
    const character = values[index];

    if (character === "'") {
      if (inString && values[index + 1] === "'") {
        index += 1;
      } else {
        inString = !inString;
      }
      continue;
    }

    if (inString) continue;
    if (character === '(') {
      if (depth === 0) tupleStart = index + 1;
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0 && tupleStart >= 0) {
        tuples.push(values.slice(tupleStart, index));
        tupleStart = -1;
      }
    }
  }

  return tuples;
}

function splitTuple(tuple: string): string[] {
  const fields: string[] = [];
  let fieldStart = 0;
  let depth = 0;
  let inString = false;

  for (let index = 0; index < tuple.length; index += 1) {
    const character = tuple[index];

    if (character === "'") {
      if (inString && tuple[index + 1] === "'") {
        index += 1;
      } else {
        inString = !inString;
      }
      continue;
    }

    if (inString) continue;
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      fields.push(tuple.slice(fieldStart, index).trim());
      fieldStart = index + 1;
    }
  }

  fields.push(tuple.slice(fieldStart).trim());
  return fields;
}

function readSqlString(value: string | undefined): string | undefined {
  const match = value?.match(/^'([\s\S]*)'$/);
  return match?.[1].replaceAll("''", "'");
}

function extractAzureDevOpsFeatureFlagSeeds(sql: string): FeatureFlagSeed[] {
  const executableSql = stripSqlComments(sql);
  const insertPattern =
    /insert\s+into\s+public\.feature_flags\s*\(([^)]*)\)\s*values\s*/gi;
  const seeds: FeatureFlagSeed[] = [];

  for (const match of executableSql.matchAll(insertPattern)) {
    const columns = match[1]
      .split(',')
      .map((column) => column.trim().replace(/^"|"$/g, '').toLowerCase());
    const requiredColumns = [
      'key',
      'environment',
      'enabled',
      'rollout_percentage',
    ];

    for (const column of requiredColumns) {
      if (!columns.includes(column)) {
        throw new Error(`feature_flags insert is missing the ${column} column`);
      }
    }

    const valuesStart = (match.index ?? 0) + match[0].length;
    const values = executableSql.slice(
      valuesStart,
      findValuesEnd(executableSql, valuesStart),
    );
    const keyIndex = columns.indexOf('key');
    const environmentIndex = columns.indexOf('environment');
    const enabledIndex = columns.indexOf('enabled');
    const rolloutIndex = columns.indexOf('rollout_percentage');

    for (const tuple of extractValueTuples(values)) {
      const fields = splitTuple(tuple);
      if (readSqlString(fields[keyIndex]) !== 'azure_devops_integration') {
        continue;
      }

      const environment = readSqlString(fields[environmentIndex]);
      const enabled = fields[enabledIndex]?.toLowerCase();
      const rolloutPercentage = fields[rolloutIndex];

      if (!environment || !/^(true|false)$/.test(enabled ?? '')) {
        throw new Error('Azure DevOps feature flag row has invalid values');
      }
      if (!/^\d+$/.test(rolloutPercentage ?? '')) {
        throw new Error(
          'Azure DevOps feature flag row has an invalid rollout percentage',
        );
      }

      seeds.push({
        environment: environment.toLowerCase(),
        enabled: enabled === 'true',
        rolloutPercentage: Number(rolloutPercentage),
      });
    }
  }

  return seeds;
}

describe('feature flag SQL parser', () => {
  it.each([
    "-- insert into public.feature_flags (key, environment, enabled, rollout_percentage) values ('azure_devops_integration', 'development', true, 100);",
    "/* insert into public.feature_flags (key, environment, enabled, rollout_percentage) values ('azure_devops_integration', 'development', true, 100); */",
  ])('ignores commented-out feature flag rows', (sql) => {
    expect(extractAzureDevOpsFeatureFlagSeeds(sql)).toEqual([]);
  });

  it('ignores matching rows inserted into another table', () => {
    const sql = `
      insert into public.integration_settings (
        key, environment, enabled, rollout_percentage
      ) values (
        'azure_devops_integration', 'development', true, 100
      );
    `;

    expect(extractAzureDevOpsFeatureFlagSeeds(sql)).toEqual([]);
  });

  it('maps feature flag values using their declared column positions', () => {
    const sql = `
      insert into public.feature_flags (
        rollout_percentage, enabled, environment, key
      ) values (
        100, true, 'development', 'azure_devops_integration'
      );
    `;

    expect(extractAzureDevOpsFeatureFlagSeeds(sql)).toEqual([
      {
        environment: 'development',
        enabled: true,
        rolloutPercentage: 100,
      },
    ]);
  });
});

describe('Azure DevOps feature flag migration', () => {
  it('seeds one rollout row for each deployment environment', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const rows = extractAzureDevOpsFeatureFlagSeeds(sql).sort((left, right) =>
      left.environment.localeCompare(right.environment),
    );

    expect(rows).toEqual([
      {
        environment: 'development',
        enabled: true,
        rolloutPercentage: 100,
      },
      {
        environment: 'production',
        enabled: false,
        rolloutPercentage: 0,
      },
      {
        environment: 'staging',
        enabled: false,
        rolloutPercentage: 0,
      },
    ]);
  });
});
