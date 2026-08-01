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

Invitation creation is admin-gated and persists only a SHA-256 token hash with a seven-day expiry. The raw 32-byte base64url token is used transiently to produce an absolute bearer URL from the server-only `APP_ORIGIN` setting and is never stored or returned to client code. Persistence precedes delivery. If delivery is unavailable or fails, the action makes a best-effort discard that marks the invitation failed and revoked, retains it for reconciliation, and returns only a generic traced error.

Live email delivery remains deferred and fails closed. `src/modules/members/invitation-delivery.ts` is the server-only provider boundary and currently reports delivery unavailable without logging its recipient or bearer URL. Consequently, new users cannot yet be invited through the application; there is no manual bearer-link or pre-provisioning workaround. Before enabling invitations, connect that boundary to managed delivery, configure `APP_ORIGIN` and the server-only `SUPABASE_SERVICE_ROLE_KEY`, and verify redirects remain fixed-shape. Only the privileged server client may finalize delivery; never expose its key to client code.

Acceptance is an authenticated database transaction requiring a confirmed email that matches the current, unexpired, unaccepted, unrevoked invitation. Replacement is serialized per organization and normalized email; it revokes any older pending token before inserting the new one. Acceptance locks the identity and invitation, activates the constrained membership under the one-active-organization invariant, invalidates sibling pending invitations, and marks the selected invitation accepted exactly once.

Authenticated clients have only `SELECT` access to invitation rows. Creation, delivery finalization, staging cleanup, acceptance, replacement, and deactivation revocation are reserved for narrowly granted security-definer functions and triggers.

Invitation delivery follows a stage → deliver → finalize lifecycle. Staged and failed tokens cannot be accepted and do not participate in the one-active-invitation constraint. Service-role finalization requires no user subject: it takes the organization/email lock, revokes the prior active token, and activates the delivered token atomically. A failed resend is discarded by marking its staged row `failed` and revoked without disturbing the prior active invite. If reconciliation returns an error or false result, or throws, the privacy-safe report contains only trace and invitation IDs; the still-pending token remains non-acceptable and requires support reconciliation before retrying.

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

Confirm that reset applies migrations `202608010001` through `202608010007_service_role_finalize.sql`; all 137 pgTAP assertions pass; and database lint reports no security or correctness findings. The authorization contract additionally covers the stage/discard/finalize privilege matrix, malformed-email denial, staged-token denial, failed-resend preservation, finalize activation, active-member rejection, deactivation revocation, and denial of token-based reactivation. Exercise concurrent finalization, acceptance, and deactivation against the local Auth runtime as part of this gate; static contracts check shared advisory locking and the active-only unique index but do not execute concurrency.

Confirm that regenerated declarations contain the six public tables, invitation `revoked_at` and `delivery_status`, all four enums, and the bootstrap, stage, finalize, discard, acceptance, and membership helper functions. Review any generated type diff before committing it.
