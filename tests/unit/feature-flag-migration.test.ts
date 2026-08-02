import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationPath =
  'supabase/migrations/202608010008_feature_flag_evaluation_index.sql';

describe('feature flag evaluation migration', () => {
  it('indexes the server evaluation lookup dimensions', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(
      /create index feature_flags_evaluation_lookup_idx\s+on public\.feature_flags\s*\(key, environment, organization_id, role_scope\)/i,
    );
  });

  it('keeps the pgTAP index assertion and plan synchronized', () => {
    const sql = readFileSync('supabase/tests/foundation_rls.test.sql', 'utf8');

    expect(sql).toMatch(/select plan\(138\)/i);
    expect(sql).toMatch(
      /has_index\([\s\S]*?'public',[\s\S]*?'feature_flags',[\s\S]*?'feature_flags_evaluation_lookup_idx'/i,
    );
  });
});
