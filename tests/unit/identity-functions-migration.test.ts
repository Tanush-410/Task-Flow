import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608010003_identity_functions.sql',
  ),
  'utf8',
);

describe('organization and invitation function migration', () => {
  it('restricts organization bootstrap to trusted authenticated identities', () => {
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/auth\.uid\(\) is null/i);
    expect(migration).toMatch(
      /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'can_bootstrap_org'/i,
    );
    expect(migration).toMatch(/status = 'active'/i);
    expect(migration).toMatch(
      /revoke all on function public\.bootstrap_organization\(text, text\) from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.bootstrap_organization\(text, text\) to authenticated/i,
    );
  });

  it('validates bootstrap inputs inside the database transaction', () => {
    expect(migration).toMatch(/char_length\(btrim\(organization_name\)\)/i);
    expect(migration).toMatch(/pg_catalog\.pg_timezone_names/i);
    expect(migration).toMatch(/insert into public\.organizations/i);
    expect(migration).toMatch(/insert into public\.organization_memberships/i);
  });

  it('accepts only a locked, unused, unexpired invitation for verified matching email', () => {
    expect(migration).toMatch(
      /create or replace function public\.accept_invitation/i,
    );
    expect(migration).toMatch(/email_confirmed_at is not null/i);
    expect(migration).toMatch(/lower\(btrim\(invitation\.email\)\)/i);
    expect(migration).toMatch(/candidate\.accepted_at is null/i);
    expect(migration).toMatch(
      /candidate\.expires_at > statement_timestamp\(\)/i,
    );
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(
      /organization_memberships_one_active_per_user_idx/i,
    );
    expect(migration).toMatch(/accepted_at = statement_timestamp\(\)/i);
  });

  it('exposes acceptance only to authenticated users and takes no raw token', () => {
    expect(migration).toMatch(
      /accept_invitation\(invitation_token_hash text\)/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.accept_invitation\(text\) from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.accept_invitation\(text\) to authenticated/i,
    );
    expect(migration).not.toMatch(/raw_token|invitation_token text/i);
  });
});
