import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('single active organization membership migration', () => {
  it('enforces one active membership per user with a partial unique index', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/202608010002_single_active_membership.sql',
      ),
      'utf8',
    );

    expect(migration).toMatch(
      /create unique index organization_memberships_one_active_per_user_idx\s+on public\.organization_memberships \(user_id\)\s+where status = 'active';/i,
    );
  });
});
