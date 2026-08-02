import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepositoryFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Phase 0 release artifacts', () => {
  it('seeds deterministic fictional admin and employee memberships', () => {
    const seed = readRepositoryFile('supabase/seed.sql');

    expect(seed).toContain('admin@example.test');
    expect(seed).toContain('employee@example.test');
    expect(seed).toContain('Asha Admin');
    expect(seed).toContain('Eshan Employee');
    expect(seed).toContain('10000000-0000-0000-0000-000000000001');
    expect(seed).toMatch(/'admin'::public\.membership_role/i);
    expect(seed).toMatch(/'employee'::public\.membership_role/i);
    expect(seed).toMatch(/on conflict \(id\) do update/i);
    expect(seed).toMatch(/on conflict \(organization_id, user_id\) do update/i);
  });

  it('keeps local authentication compatible with invite-only production', () => {
    const seed = readRepositoryFile('supabase/seed.sql');
    const config = readRepositoryFile('supabase/config.toml');

    expect(config).toMatch(/\[auth\][\s\S]*?enable_signup = false/);
    expect(config).toMatch(/\[auth\.email\][\s\S]*?enable_signup = false/);
    expect(seed).toMatch(/insert into auth\.users/i);
    expect(seed).toMatch(/insert into auth\.identities/i);
    expect(seed).toContain('"provider":"email"');
    expect(seed).toContain('"providers":["email"]');
  });

  it('runs database, type-drift, application, and browser gates in CI', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');

    expect(workflow).toContain('supabase/setup-cli@v3');
    expect(workflow).toMatch(/supabase start/);
    expect(workflow).toMatch(/supabase db reset/);
    expect(workflow).toMatch(/supabase test db/);
    expect(workflow).toMatch(/supabase gen types typescript --local/);
    expect(workflow).toContain('npx prettier --write /tmp/database.types.ts');
    expect(workflow).toMatch(/diff -u .*database\.types\.ts/);
    expect(workflow).toMatch(/npm run verify/);
    expect(workflow).toMatch(/playwright install --with-deps chromium/);
    expect(workflow).toMatch(/npm run test:e2e/);
    expect(workflow).toContain('api.url=NEXT_PUBLIC_SUPABASE_URL');
    expect(workflow).toContain(
      'auth.anon_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
    expect(workflow).toContain(
      'auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(workflow).toMatch(/> \.env\.local/);
    expect(workflow).not.toContain('GITHUB_ENV');
  });

  it('tracks every migrated enum in the generated database constants', () => {
    const databaseTypes = readRepositoryFile(
      'src/lib/supabase/database.types.ts',
    );

    expect(databaseTypes).toMatch(
      /invitation_delivery_status:\s*\[\s*'pending_delivery',\s*'active',\s*'failed',?\s*\]/,
    );
  });
});
