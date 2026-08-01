# Deferred Supabase Verification

The organization identity migration and its pgTAP contract were prepared without a live local Supabase runtime. Database execution remains a required verification gate before this migration is promoted or relied on for authorization.

## Root cause

On 2026-08-01, `npm run db:start` reached the pinned Supabase CLI but failed with:

```text
docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH
```

`/usr/local/bin/docker` exists only as a broken symlink to `/Applications/Docker.app/Contents/Resources/bin/docker`. No Docker or Podman executable was found in the shell path or under `/Applications`.

Because the database never started, neither the expected RED missing-table result nor a GREEN database test result has been observed. The checked-in TypeScript database declarations are carefully hand-authored from the migration and must be replaced with CLI-generated output during deferred verification.

## Deferred commands

After installing or exposing a working Docker/Podman runtime, run these commands from the repository root:

```bash
npm run db:start
npm run db:reset
npm run db:test
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Confirm that reset applies `202608010001_foundation.sql`, all four pgTAP assertions pass, and the regenerated declarations still contain the five public tables, both membership enums, and the `is_active_member` and `is_admin` functions. Review any generated type diff before committing it.
