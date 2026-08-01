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

Before that identity calls `bootstrap_organization`, set the boolean Auth app-metadata claim `can_bootstrap_org` to `true` through the trusted Admin API or console. The security-definer RPC requires that trusted claim, a verified identity, a profile, and no active membership; it validates the name and timezone and atomically creates the organization and first active `admin` membership. Remove the bootstrap claim after successful provisioning and record the operator and resulting IDs in the deployment change record. Arbitrary authenticated identities cannot bootstrap themselves.

## Invitation delivery status

Invitation creation is admin-gated and persists only a SHA-256 token hash with a seven-day expiry. The raw 32-byte base64url token is used transiently to produce `/invite/<token>` and is never stored. Acceptance is an authenticated database transaction requiring a verified email that matches an unexpired, unused invitation; it locks the identity and invitation, activates the membership under the one-active-organization invariant, and marks the invitation accepted once.

Live email delivery remains deferred. `src/modules/members/invitation-delivery.ts` is the server-only provider boundary and currently returns the deterministic invitation path to the trusted admin caller. Before production invitations are enabled, connect that boundary to the managed Supabase Auth admin invitation API using a server-only service-role credential, configure the approved application origin, and verify that redirects can target only `/invite/<43-character-base64url-token>`. Do not add a public signup route or expose the service-role key to client code.

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

Confirm that reset applies `202608010001_foundation.sql`, `202608010002_single_active_membership.sql`, and `202608010003_identity_functions.sql`; all 101 pgTAP assertions pass; and database lint reports no security or correctness findings. The authorization contract covers the one-active-organization-per-user invariant, explicit privilege revocation and column grants, bootstrap and acceptance function privileges, role/JWT fixtures, anonymous and cross-organization denial, same-organization and cross/global `WITH CHECK` behavior, deactivated-user isolation, self-escalation and deactivation denial, last-admin protection, invitation isolation, flag metadata isolation, append-only audit attribution across account deletion, column-level provenance protection, timestamp maintenance, and timezone validation. Exercise bootstrap and invitation acceptance manually against the local Auth runtime as part of this gate, including untrusted bootstrap, email mismatch, unverified email, expiry, replay, and concurrent acceptance failures.

Confirm that the regenerated declarations still contain the six public tables, all three enums, and the `bootstrap_organization`, `accept_invitation`, `is_active_member`, `is_admin`, and `is_active_admin` functions. Review any generated type diff before committing it.
