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
const atomicMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608010005_atomic_invitation_delivery.sql',
  ),
  'utf8',
);
const databaseContract = readFileSync(
  join(process.cwd(), 'supabase/tests/foundation_rls.test.sql'),
  'utf8',
);

describe('secure identity lifecycle migration', () => {
  it('uses only columns granted for client invitation insertion', () => {
    expect(identityMigration).toMatch(
      /revoke all privileges on table public\.invitations from authenticated/i,
    );
    expect(identityMigration).toMatch(
      /grant select, delete on public\.invitations to authenticated/i,
    );
    expect(identityMigration).toMatch(
      /grant insert \(organization_id, email, role, token_hash, expires_at\)\s+on public\.invitations to authenticated/i,
    );
    expect(identityMigration).not.toMatch(
      /grant update|grant insert \([^)]*invited_by/i,
    );
    expect(foundationMigration).toMatch(/default auth\.uid\(\)/i);
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

describe('atomic invitation delivery migration', () => {
  it('asserts the final active-only invitation index in pgTAP', () => {
    expect(databaseContract).toMatch(
      /has_index\([\s\S]*?'public',[\s\S]*?'invitations',[\s\S]*?'invitations_one_active_per_organization_email_idx'/i,
    );
    expect(databaseContract).not.toMatch(
      /'invitations_one_pending_per_organization_email_idx'/i,
    );
  });

  it('models delivery state and permits only active invitations to be accepted', () => {
    expect(atomicMigration).toMatch(
      /pending_delivery[\s\S]*active[\s\S]*failed/i,
    );
    expect(atomicMigration).toMatch(/candidate\.delivery_status = 'active'/i);
    expect(atomicMigration).toMatch(/where delivery_status = 'active'/i);
  });

  it('stages, finalizes, and discards through narrow security-definer RPCs', () => {
    expect(atomicMigration).toMatch(/function public\.stage_invitation/i);
    expect(atomicMigration).toMatch(
      /function public\.finalize_invitation_delivery/i,
    );
    expect(atomicMigration).toMatch(
      /function public\.discard_staged_invitation/i,
    );
    expect(atomicMigration).toMatch(
      /revoke all privileges on table public\.invitations from authenticated/i,
    );
    expect(atomicMigration).toMatch(
      /grant select on public\.invitations to authenticated/i,
    );
    expect(atomicMigration).not.toMatch(
      /grant insert|grant delete|grant update/i,
    );
  });

  it('revokes outstanding invitations on membership deactivation', () => {
    expect(atomicMigration).toMatch(
      /after update of status on public\.organization_memberships/i,
    );
    expect(atomicMigration).toMatch(/new\.status = 'deactivated'/i);
    expect(atomicMigration).toMatch(
      /set revoked_at = statement_timestamp\(\)/i,
    );
  });
});
