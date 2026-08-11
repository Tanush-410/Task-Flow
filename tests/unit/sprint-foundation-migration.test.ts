import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('sprint foundation migration', () => {
  const migration = read(
    'supabase/migrations/202608100001_sprint_foundation.sql',
  );
  const types = read('src/lib/supabase/database.types.ts');

  it('keeps helpers hardened and tables protected by RLS', () => {
    expect(migration).toMatch(
      /is_planning_team_member[\s\S]*security definer[\s\S]*set search_path = ''/i,
    );
    expect(migration).toMatch(
      /alter table public\.planning_teams enable row level security/i,
    );
    expect(migration).toMatch(
      /alter table public\.planning_team_members enable row level security/i,
    );
  });

  it('tracks the planning schema in generated types', () => {
    expect(types).toContain('planning_teams: {');
    expect(types).toContain('planning_team_members: {');
    expect(types).toMatch(/planning_role:\s*'planner'\s*\|\s*'member'/);
  });
});
