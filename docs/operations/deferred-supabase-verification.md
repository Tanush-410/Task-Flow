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

Public signup and email signup are disabled, and email confirmation is required. Until the invitation acceptance flow exists, create the first identity only through the Supabase console or a trusted server-side Admin API call using the service-role credential. Never expose that credential to a browser, checked-in script, or client-visible environment variable.

After the Auth identity exists and the profile trigger has run, use the SQL console or another service-role-only transaction to insert the organization and its first active `admin` membership. The public client has no organization-insert path and cannot bootstrap itself. Record the operator and resulting IDs in the deployment change record. Additional identities remain console/service-role controlled until the invitation flow is implemented and verified.

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

Confirm that reset applies `202608010001_foundation.sql` and `202608010002_single_active_membership.sql`, all 95 pgTAP assertions pass, and database lint reports no security or correctness findings. The authorization contract covers the one-active-organization-per-user invariant, explicit privilege revocation and column grants, role/JWT fixtures, anonymous and cross-organization denial, same-organization and cross/global `WITH CHECK` behavior, deactivated-user isolation, self-escalation and deactivation denial, last-admin protection, invitation isolation, flag metadata isolation, append-only audit attribution across account deletion, column-level provenance protection, timestamp maintenance, and timezone validation.

Confirm that the regenerated declarations still contain the six public tables, all three enums, and the `is_active_member`, `is_admin`, and `is_active_admin` functions. Review any generated type diff before committing it.
