import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const foundationMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/202608010001_foundation.sql'),
  'utf8',
);
const identityMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608010004_secure_invitation_lifecycle.sql',
  ),
  'utf8',
);

describe('secure identity lifecycle migration', () => {
  it('uses only columns granted for client invitation insertion', () => {
    expect(foundationMigration).toMatch(
      /grant insert \(organization_id, email, role, token_hash, expires_at\)\s+on public\.invitations to authenticated/i,
    );
    expect(foundationMigration).not.toMatch(
      /grant insert \([^)]*invited_by[^)]*\)\s+on public\.invitations to authenticated/i,
    );
  });

  it('authoritatively locks and verifies the bootstrap identity', () => {
    const bootstrap = identityMigration.slice(
      identityMigration.indexOf(
        'create or replace function public.bootstrap_organization',
      ),
      identityMigration.indexOf(
        'create or replace function public.accept_invitation',
      ),
    );
    expect(bootstrap).toMatch(/from auth\.users as auth_user/i);
    expect(bootstrap).toMatch(/auth_user\.email_confirmed_at is not null/i);
    expect(bootstrap).toMatch(
      /auth_user\.raw_app_meta_data\s*->>\s*'can_bootstrap_org'/i,
    );
    expect(bootstrap).toMatch(/for update/i);
    expect(bootstrap).not.toMatch(/auth\.jwt\(\)/i);
  });

  it('enforces one normalized pending invitation and safely replaces older tokens', () => {
    expect(identityMigration).toMatch(/add column revoked_at timestamptz/i);
    expect(identityMigration).toMatch(
      /create unique index invitations_one_pending_per_organization_email_idx/i,
    );
    expect(identityMigration).toMatch(
      /organization_id, lower\(btrim\(email\)\)/i,
    );
    expect(identityMigration).toMatch(
      /where accepted_at is null\s+and revoked_at is null/i,
    );
    expect(identityMigration).toMatch(/pg_advisory_xact_lock/i);
    expect(identityMigration).toMatch(
      /new\.expires_at <= statement_timestamp\(\)/i,
    );
    expect(identityMigration).toMatch(
      /set revoked_at = statement_timestamp\(\)/i,
    );
  });

  it('rejects revoked tokens and invalidates every pending sibling on acceptance', () => {
    const acceptance = identityMigration.slice(
      identityMigration.indexOf(
        'create or replace function public.accept_invitation',
      ),
    );
    expect(acceptance).toMatch(/pg_advisory_xact_lock/i);
    expect(acceptance).toMatch(/candidate\.revoked_at is null/i);
    expect(acceptance).toMatch(
      /candidate\.expires_at > statement_timestamp\(\)/i,
    );
    expect(acceptance).toMatch(/for update/i);
    expect(acceptance).toMatch(
      /lower\(btrim\(pending\.email\)\) = lower\(btrim\(invitation\.email\)\)/i,
    );
    expect(acceptance).toMatch(/pending\.id <> invitation\.id/i);
    expect(acceptance).toMatch(/message = 'INVITATION_INVALID'/i);
  });
});
