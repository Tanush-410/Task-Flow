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
    expect(seed).toMatch(
      /jsonb_build_object\('provider', 'email', 'providers', jsonb_build_array\('email'\)\)/,
    );
  });

  it('repairs every required GoTrue string and status field on rerun', () => {
    const seed = readRepositoryFile('supabase/seed.sql');
    const userColumns = seed.match(
      /insert into auth\.users\s*\(([\s\S]*?)\)\s*select/i,
    )?.[1];
    if (!userColumns) throw new Error('auth.users insert columns are missing');
    const requiredEmptyStrings = [
      'confirmation_token',
      'recovery_token',
      'email_change',
      'email_change_token_new',
      'email_change_token_current',
      'phone_change',
      'phone_change_token',
      'reauthentication_token',
    ];

    for (const field of requiredEmptyStrings) {
      expect(userColumns).toMatch(new RegExp(`\\b${field}\\b`, 'i'));
      expect(seed).toMatch(new RegExp(`''::text as ${field}`, 'i'));
      expect(seed).toContain(`${field} = excluded.${field}`);
    }

    for (const field of [
      'aud',
      'role',
      'email_change_confirm_status',
      'is_sso_user',
      'is_anonymous',
    ]) {
      expect(userColumns).toMatch(new RegExp(`\\b${field}\\b`, 'i'));
      expect(seed).toContain(field);
      expect(seed).toContain(`${field} = excluded.${field}`);
    }

    expect(seed).toMatch(/0::smallint as email_change_confirm_status/i);
    expect(seed).toMatch(/false as is_sso_user/i);
    expect(seed).toMatch(/false as is_anonymous/i);
  });

  it('runs database, type-drift, application, and browser gates in CI', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');

    expect(workflow).not.toContain('supabase/setup-cli');
    expect(workflow).toMatch(/npx supabase start/);
    expect(workflow).toMatch(/supabase start/);
    expect(workflow).toMatch(/supabase db reset/);
    expect(workflow).toMatch(/supabase test db/);
    expect(workflow).toMatch(/supabase gen types typescript --local/);
    expect(workflow).toContain('npx prettier --write /tmp/database.types.ts');
    expect(workflow).toMatch(/diff -u .*database\.types\.ts/);
    expect(workflow).toMatch(/npm run verify/);
    expect(workflow).toMatch(/playwright install --with-deps chromium/);
    expect(workflow).toMatch(/npm run test:e2e/);
    expect(workflow).toMatch(/npm audit --audit-level=high/);
    expect(workflow).toMatch(
      /gitleaks-action@[0-9a-f]{40}|gitleaks-action@v\d+\.\d+\.\d+/,
    );
    expect(workflow).toMatch(
      /codeql-action\/init@[0-9a-f]{40}|codeql-action\/init@v\d+\.\d+\.\d+/,
    );
    expect(workflow).toMatch(
      /codeql-action\/analyze@[0-9a-f]{40}|codeql-action\/analyze@v\d+\.\d+\.\d+/,
    );
    expect(workflow).toContain(
      'supabase db reset --local --version 202608010001 --no-seed',
    );
    expect(workflow).toContain('supabase/fixtures/pre_upgrade.sql');
    expect(workflow).toContain('supabase migration up --local');
    expect(workflow).toContain('supabase/tests/verify_upgrade.sql');
    expect(workflow).toContain('api.url=NEXT_PUBLIC_SUPABASE_URL');
    expect(workflow).toContain(
      'auth.anon_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
    expect(workflow).toContain(
      'auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(workflow).toMatch(/> \.env\.local/);
    expect(workflow).not.toContain('GITHUB_ENV');
    expect(workflow).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(workflow).not.toMatch(/actions\/(checkout|setup-node)@v\d+\s/);
    expect(workflow).toMatch(/security-events: write/);
    expect(workflow).toMatch(/actions: read/);

    const actionReferences = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map(
      ([, reference]) => reference,
    );
    expect(actionReferences.length).toBeGreaterThanOrEqual(5);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/@(?:[0-9a-f]{40}|v\d+\.\d+\.\d+)$/);
    }
  });

  it('isolates browser servers and ignores browser artifacts', () => {
    const config = readRepositoryFile('playwright.config.ts');
    const gitignore = readRepositoryFile('.gitignore');

    expect(config).toContain(
      "process.env.CI ? 'npm run start' : 'npm run dev'",
    );
    expect(config).toContain("process.env.PLAYWRIGHT_REUSE_SERVER === 'true'");
    expect(gitignore).toContain('/playwright-report/');
    expect(gitignore).toContain('/test-results/');
  });

  it('preserves representative existing records across incremental migrations', () => {
    const fixture = readRepositoryFile('supabase/fixtures/pre_upgrade.sql');
    const verification = readRepositoryFile(
      'supabase/tests/verify_upgrade.sql',
    );

    expect(fixture).toContain('Legacy Workspace');
    expect(fixture).toMatch(/insert into public\.invitations/i);
    expect(fixture).toMatch(/insert into public\.feature_flags/i);
    expect(verification).toMatch(/delivery_status = 'active'/i);
    expect(verification).toMatch(/delivery_status = 'failed'/i);
    expect(verification).toMatch(/feature_flags_evaluation_lookup_idx/i);
    expect(verification).toMatch(/raise exception/i);

    const normalizationMigration = readRepositoryFile(
      'supabase/migrations/202608010009_normalize_invitation_delivery_status.sql',
    );
    expect(normalizationMigration).toMatch(
      /set delivery_status = 'failed'[\s\S]*where revoked_at is not null/i,
    );
  });

  it('covers the invitation acceptance UI with a deterministic fail-closed smoke', () => {
    const invitationTest = readRepositoryFile('tests/e2e/invitation.spec.ts');

    expect(invitationTest).toContain("'A'.repeat(43)");
    expect(invitationTest).toContain('Organization invitation');
    expect(invitationTest).toContain('Accept invitation');
    expect(invitationTest).toContain('This invitation could not be accepted');
  });

  it('tracks every migrated enum in the generated database constants', () => {
    const databaseTypes = readRepositoryFile(
      'src/lib/supabase/database.types.ts',
    );

    expect(databaseTypes).toMatch(
      /invitation_delivery_status:\s*'pending_delivery'\s*\|\s*'active'\s*\|\s*'failed'/,
    );
  });
});
