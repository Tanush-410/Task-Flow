# Deferred Supabase Verification

The organization identity migration and its pgTAP contract were prepared without a live local Supabase runtime. Database execution remains a required verification gate before this migration is promoted or relied on for authorization.

## Root cause

On 2026-08-01, `npm run db:start` reached the pinned Supabase CLI but failed with:

```text
docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH
```

`/usr/local/bin/docker` exists only as a broken symlink to `/Applications/Docker.app/Contents/Resources/bin/docker`. No Docker or Podman executable was found in the shell path or under `/Applications`.

Because the database never started, neither the expected RED result nor a GREEN database test result has been observed. The checked-in TypeScript database declarations are carefully hand-authored from the migration and must be replaced atomically with CLI-generated output during deferred verification.

## Controlled initial-admin bootstrap

Public signup and email signup are disabled, and email confirmation is required. Create the first identity only through the Supabase console or a trusted server-side Admin API call using the service-role credential. Never expose that credential to a browser, checked-in script, or client-visible environment variable.

Before that identity calls `bootstrap_organization`, set the boolean Auth app-metadata value `can_bootstrap_org` to `true` through the trusted Admin API or console. The security-definer RPC locks and reads `auth.users` directly; it does not trust a caller-supplied JWT copy of app metadata. It requires that authoritative value, a confirmed email, a profile, and no active membership, then validates the name and timezone and atomically creates the organization and first active `admin` membership. Remove the bootstrap value after successful provisioning and record the operator and resulting IDs in the deployment change record. Arbitrary authenticated identities cannot bootstrap themselves.

## Invitation delivery status

Invitation creation is admin-gated and persists only a SHA-256 token hash with a seven-day expiry. The raw 32-byte base64url token is used transiently to produce an absolute bearer URL from the server-only `APP_ORIGIN` setting and is never stored or returned to client code. Persistence precedes delivery. If delivery is unavailable or fails, the action makes a best-effort deletion of the newly persisted invitation and returns only a generic traced error.

Live email delivery remains deferred and fails closed. `src/modules/members/invitation-delivery.ts` is the server-only provider boundary and currently reports delivery unavailable without logging its recipient or bearer URL. Consequently, new users cannot yet be invited through the application; there is no manual bearer-link or pre-provisioning workaround. Before enabling invitations, connect that boundary to the managed Supabase Auth admin invitation API using a server-only service-role credential, configure `APP_ORIGIN` as the exact approved HTTP(S) origin, and verify that redirects can target only `/invite/<43-character-base64url-token>`. Do not add a public signup route or expose the service-role key to client code.

Acceptance is an authenticated database transaction requiring a confirmed email that matches the current, unexpired, unaccepted, unrevoked invitation. Replacement is serialized per organization and normalized email; it revokes any older pending token before inserting the new one. Acceptance locks the identity and invitation, activates the constrained membership under the one-active-organization invariant, invalidates sibling pending invitations, and marks the selected invitation accepted exactly once.

## Deferred commands

After installing or exposing a working Docker/Podman runtime, run these commands from the repository root:

```bash
npm run db:start
npm run db:reset
npx supabase db lint --local
npm run db:test
types_temp_file="$(mktemp src/lib/supabase/database.types.ts.XXXXXX)"
if npx supabase gen types typescript --local > "$types_temp_file"; then
  mv "$types_temp_file" src/lib/supabase/database.types.ts
else
  echo "Type generation failed; provisional types remain unchanged. Temporary output: $types_temp_file" >&2
  false
fi
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Confirm that reset applies `202608010001_foundation.sql`, `202608010002_single_active_membership.sql`, `202608010003_identity_functions.sql`, and `202608010004_secure_invitation_lifecycle.sql`; all 122 pgTAP assertions pass; and database lint reports no security or correctness findings. The authorization contract covers the one-active-organization-per-user invariant, explicit privilege revocation and column grants, server-derived invitation provenance, authoritative bootstrap identity verification, bootstrap and acceptance function privileges, normalized pending-invitation replacement, invalid-replacement rollback, revoked elevated-token denial, expiry, email mismatch, rollback, replay denial, constrained-role activation, role/JWT fixtures, anonymous and cross-organization denial, same-organization and cross/global `WITH CHECK` behavior, deactivated-user isolation, self-escalation and deactivation denial, last-admin protection, invitation isolation, flag metadata isolation, append-only audit attribution across account deletion, column-level provenance protection, timestamp maintenance, and timezone validation. Exercise concurrent replacement and acceptance against the local Auth runtime as part of this gate; the static contract checks advisory locking and the unique index, but does not execute concurrency.

Confirm that the regenerated declarations still contain the six public tables, the invitation `revoked_at` column, all three enums, and the `bootstrap_organization`, `accept_invitation`, `is_active_member`, `is_admin`, and `is_active_admin` functions. Review any generated type diff before committing it.
