# Azure DevOps Connection Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organization admin securely connect TaskFlow to Microsoft Entra, discover accessible Azure DevOps organizations/projects/teams, and map exactly one TaskFlow planning team to one Azure DevOps project/team behind a fail-closed feature flag.

**Architecture:** Keep OAuth credentials and Azure calls in server-only modules. Persist single-use PKCE state and AES-256-GCM-encrypted delegated tokens in service-role-only Supabase tables. Route handlers own the Entra redirects and callback; typed server actions own discovery, mapping, and disconnect; Server Components render sanitized connection state. This increment deliberately stops before importing or synchronizing work items.

**Tech Stack:** Next.js 16 App Router Route Handlers and Server Actions, React 19, strict TypeScript, native `fetch` and Node `crypto`, Zod 4, Supabase/PostgreSQL with pgTAP and RLS, Vitest/Testing Library, Playwright, Tailwind CSS/shadcn primitives.

---

## Scope boundary

This is the first executable Azure DevOps plan from the approved two-way synchronization design. It includes:

- `azure_devops_integration` feature gating;
- Entra delegated OAuth with authorization-code PKCE;
- encrypted token persistence and refresh primitives;
- Azure organization, project, and team discovery;
- one TaskFlow planning team to one Azure project/team mapping;
- sanitized connection health, reconnect, and disconnect controls;
- database, unit, route, component, and browser contracts.

It does **not** import iterations or work items, extend the native work-item hierarchy, create service hooks, process an outbox, accept inbound webhooks, reconcile records, or resolve revision conflicts. Those remain separate plans, in this order:

1. native planning hierarchy and sprint persistence;
2. restartable initial Azure import;
3. transactional outbox and outbound synchronization;
4. service hooks and inbound synchronization;
5. reconciliation, Azure-wins conflicts, and operational health.

The connection may reach `configured` in this increment, but never `active`; `active` is reserved for a later successful initial import and webhook setup.

## Non-negotiable contracts

- Only active organization admins may connect, configure, reconnect, or disconnect.
- Tokens, PKCE verifiers, and provider error bodies never reach the browser, normal logs, or action results.
- OAuth state is random, stored only as a SHA-256 hash, bound to user and organization, expires after ten minutes, and is consumed atomically once.
- Access and refresh tokens use AES-256-GCM envelopes in the form `v1.<keyId>.<iv>.<ciphertext>.<tag>`.
- Connection and mapping tables grant no privileges to `anon` or `authenticated`; access is through authorized server-only code using the service role.
- One TaskFlow organization owns at most one live Azure connection in this release.
- One TaskFlow planning team has at most one Azure team mapping, and an Azure project/team tuple cannot be mapped twice within the connection.
- OAuth callback, discovery, and settings routes all fail closed when `azure_devops_integration` is disabled.
- External identifiers are stored as opaque strings; display names are never used as stable keys.
- Disconnect clears encrypted tokens and marks mappings disconnected. It does not delete planning teams or imported data.

## File map

| Path | Responsibility |
| --- | --- |
| `.env.example` | New documented Entra and encryption configuration without real secrets |
| `supabase/migrations/202608110001_azure_devops_connection_foundation.sql` | Connection, OAuth-state, and team-link schema; atomic state consumption; grants; rollout flag |
| `supabase/tests/azure_devops_connection_rls.test.sql` | Schema, privilege, immutability, uniqueness, and OAuth-state contracts |
| `src/lib/server-env.ts` | Validate the Entra client, scopes, and 32-byte token encryption key |
| `src/lib/supabase/database.types.ts` | Regenerated Supabase contract |
| `src/modules/azure-devops/auth/crypto.ts` | AES-256-GCM versioned token envelopes |
| `src/modules/azure-devops/auth/oauth-state.ts` | PKCE generation, state hashing, safe return paths, and state persistence |
| `src/modules/azure-devops/auth/entra.ts` | Authorization URL, code exchange, refresh, and revocation-safe token handling |
| `src/modules/azure-devops/client/http.ts` | Typed, paginated Azure REST transport and safe error classification |
| `src/modules/azure-devops/client/discovery.ts` | Profile, account, project, and team discovery DTOs |
| `src/modules/azure-devops/connections/schemas.ts` | Organization selection, mapping, and disconnect validation |
| `src/modules/azure-devops/connections/queries.ts` | Sanitized admin connection and mapping view models |
| `src/modules/azure-devops/connections/actions.ts` | Discovery, organization selection, team mapping, reconnect, and disconnect actions |
| `src/modules/azure-devops/connections/access.ts` | Shared admin + feature-flag authorization guard |
| `src/app/api/integrations/azure-devops/connect/route.ts` | Start the OAuth redirect |
| `src/app/api/integrations/azure-devops/callback/route.ts` | Validate state, exchange code, encrypt tokens, and create a pending connection |
| `src/app/(app)/settings/integrations/azure-devops/layout.tsx` | Fail-closed integration route guard |
| `src/app/(app)/settings/integrations/azure-devops/page.tsx` | Admin connection setup and health page |
| `src/components/integrations/azure-devops-connection-form.tsx` | Connect/reconnect/disconnect controls |
| `src/components/integrations/azure-devops-team-mapping-form.tsx` | Cascading Azure organization/project/team and TaskFlow-team selection |
| `src/app/(app)/settings/page.tsx` | Show the integration entry only to enabled admins |
| `tests/unit/server-env.test.ts` | Secret/configuration validation contract |
| `tests/unit/azure-devops-crypto.test.ts` | Encryption, tamper, key-version, and redaction contract |
| `tests/unit/azure-devops-oauth-state.test.ts` | PKCE, expiry, single-use, ownership, and safe-return-path contract |
| `tests/unit/azure-devops-entra.test.ts` | Entra request/response contract without live network access |
| `tests/unit/azure-devops-client.test.ts` | Azure pagination, schema validation, refresh, and safe errors |
| `tests/unit/azure-devops-actions.test.ts` | Admin authorization, discovery, mapping, and disconnect behavior |
| `tests/unit/azure-devops-routes.test.ts` | Connect/callback redirect and failure contract |
| `tests/unit/azure-devops-settings.test.tsx` | Sanitized setup states and controls |
| `tests/e2e/azure-devops-connection.spec.ts` | Feature-gated admin setup acceptance flow using intercepted provider calls |
| `package.json` | Include the new pgTAP contract in `db:test` |
| `docs/operations/feature-flags.md` | Integration rollout instructions |
| `docs/operations/azure-devops-connection.md` | Entra registration, secrets, callback, rotation, and disconnect runbook |

## Task 1: Lock the configuration and feature-flag contracts

**Files:**
- Modify: `src/lib/server-env.ts`
- Modify: `tests/unit/server-env.test.ts`
- Create: `.env.example`
- Create: `tests/unit/azure-devops-feature-flag.test.ts`

- [ ] **Step 1: Write failing environment tests**

Extend the valid fixture and assert these fields are returned:

```ts
const validServerEnv = {
  APP_ORIGIN: 'https://tasks.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  AZURE_DEVOPS_ENTRA_TENANT_ID: 'organizations',
  AZURE_DEVOPS_ENTRA_CLIENT_ID: '10000000-0000-0000-0000-000000000001',
  AZURE_DEVOPS_ENTRA_CLIENT_SECRET: 'client-secret',
  AZURE_DEVOPS_OAUTH_SCOPES:
    'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
  AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  AZURE_DEVOPS_TOKEN_KEY_ID: 'primary-2026-08',
};
```

Add cases that reject a non-UUID client ID, an empty secret, scopes without `offline_access`, a decoded encryption key shorter or longer than 32 bytes, and whitespace/control characters in the key ID. Preserve the existing HTTP-origin behavior; the route guard enforces HTTPS outside development because deployment environment is not part of the reusable environment parser.

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- tests/unit/server-env.test.ts`

Expected: FAIL because the Azure variables are not parsed.

- [ ] **Step 3: Extend the server-only environment schema**

Add the six Azure fields to `serverEnvSchema`. Decode the encryption key during validation to verify exactly 32 bytes, but return the original base64 string so key bytes are materialized only by the crypto module.

Use a narrow key identifier schema:

```ts
const encryptionKeyIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/);
```

- [ ] **Step 4: Write the feature-flag contract test**

Read the planned migration as text and assert it inserts exactly one `azure_devops_integration` row for each deployment environment, enabled at 100% only in development and disabled at 0% in staging/production. This test should remain red until Task 2 creates the migration.

- [ ] **Step 5: Document environment names only**

Add placeholders to `.env.example` for the six Azure variables. Do not add live identifiers, secrets, or a generated encryption key. Include the callback URL as a comment:

```dotenv
# Entra redirect URI: ${APP_ORIGIN}/api/integrations/azure-devops/callback
AZURE_DEVOPS_ENTRA_TENANT_ID=
AZURE_DEVOPS_ENTRA_CLIENT_ID=
AZURE_DEVOPS_ENTRA_CLIENT_SECRET=
AZURE_DEVOPS_OAUTH_SCOPES="openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default"
AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY=
AZURE_DEVOPS_TOKEN_KEY_ID=primary
```

- [ ] **Step 6: Re-run focused tests**

Run: `npm test -- tests/unit/server-env.test.ts tests/unit/azure-devops-feature-flag.test.ts`

Expected: environment tests PASS; feature-flag migration test FAIL because the migration is absent.

- [ ] **Step 7: Commit**

```bash
git add .env.example src/lib/server-env.ts tests/unit/server-env.test.ts tests/unit/azure-devops-feature-flag.test.ts
git commit -m "test: define Azure DevOps connection configuration"
```

## Task 2: Specify and implement service-role-only connection persistence

**Files:**
- Create: `supabase/tests/azure_devops_connection_rls.test.sql`
- Create: `supabase/migrations/202608110001_azure_devops_connection_foundation.sql`
- Modify: `package.json`

- [ ] **Step 1: Write the failing pgTAP contract**

Start the test with `begin`, an exact `plan(...)`, and `rollback`. Cover:

```sql
select has_type('public', 'azure_devops_connection_status', 'connection status exists');
select has_table('public', 'azure_devops_connections', 'connections exist');
select has_table('public', 'azure_devops_oauth_states', 'single-use OAuth state exists');
select has_table('public', 'azure_devops_team_links', 'team links exist');
select has_function(
  'public',
  'consume_azure_devops_oauth_state',
  array['text', 'uuid', 'uuid'],
  'OAuth state is consumed atomically'
);
select has_function(
  'public',
  'configure_azure_devops_team_link',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'uuid'],
  'mapping is configured transactionally'
);
select has_function(
  'public',
  'disconnect_azure_devops_connection',
  array['uuid', 'uuid'],
  'disconnect is transactional'
);

select ok(
  not has_table_privilege('anon', 'public.azure_devops_connections', 'select')
  and not has_table_privilege('authenticated', 'public.azure_devops_connections', 'select')
  and has_table_privilege('service_role', 'public.azure_devops_connections', 'select'),
  'tokens are service-role-only'
);
```

Also assert RLS is enabled, all three tables deny `anon` and `authenticated`, all three RPCs are executable only by `service_role`, ownership columns cannot change, state hashes are unique, one connection per organization is enforced, one link per planning team is enforced, Azure project/team tuples are unique per connection, expired/consumed state cannot be reused, configure rejects cross-organization provenance, disconnect clears ciphertext and preserves rows, and the feature-flag defaults match Task 1.

- [ ] **Step 2: Register the new database test and confirm red**

Append `supabase/tests/azure_devops_connection_rls.test.sql` to the existing `db:test` command in `package.json`.

Run: `npm run db:start && npm run db:test`

Expected: FAIL because the Azure schema is absent.

- [ ] **Step 3: Create the enums and tables**

Use this persistence shape:

```sql
create type public.azure_devops_connection_status as enum (
  'pending', 'configured', 'paused', 'disconnected'
);

create table public.azure_devops_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.organizations(id) on delete cascade,
  tenant_id text not null,
  authorized_user_id text not null,
  authorized_user_display_name text not null default '',
  authorized_user_email text,
  granted_scopes text[] not null default '{}',
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  azure_organization_id text,
  azure_organization_name text,
  azure_organization_url text,
  status public.azure_devops_connection_status not null default 'pending',
  safe_error_code text,
  last_verified_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((access_token_ciphertext is null) = (refresh_token_ciphertext is null)),
  check (status <> 'disconnected' or access_token_ciphertext is null)
);

create table public.azure_devops_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pkce_verifier_ciphertext text not null,
  return_path text not null default '/settings/integrations/azure-devops',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.azure_devops_team_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.azure_devops_connections(id) on delete cascade,
  planning_team_id uuid not null unique references public.planning_teams(id) on delete restrict,
  azure_project_id text not null,
  azure_project_name text not null,
  azure_team_id text not null,
  azure_team_name text not null,
  status public.azure_devops_connection_status not null default 'configured',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, azure_project_id, azure_team_id)
);
```

Use validation triggers to prove that the connection, planning team, and link all share the same `organization_id`. Use immutability triggers for organization, connection, planning-team, Azure project ID, Azure team ID, and creator provenance. Reuse `public.set_updated_at()`.

- [ ] **Step 4: Add atomic state consumption**

Create a `security definer`, `set search_path = ''` function that atomically updates an unconsumed, unexpired row matching state hash, organization, and user, and returns only `pkce_verifier_ciphertext` and `return_path`:

```sql
update public.azure_devops_oauth_states
set consumed_at = now()
where state_hash = target_state_hash
  and organization_id = target_organization_id
  and user_id = target_user_id
  and consumed_at is null
  and expires_at > now()
returning pkce_verifier_ciphertext, return_path;
```

Revoke function execution from `public`, `anon`, and `authenticated`; grant only to `service_role`.

- [ ] **Step 5: Apply grants, RLS, indexes, and flag rows**

Enable RLS on all three tables. Revoke all from `public`, `anon`, and `authenticated`; grant the minimum table/function privileges to `service_role`. Add indexes for state expiry cleanup and organization/connection lookup. Insert three `azure_devops_integration` rollout rows using the same metadata shape as `native_sprint_planning`: development `true/100`, staging and production `false/0`.

Add these two `security definer`, `set search_path = ''`, service-role-only transactional functions now, so the action layer cannot partially configure or disconnect a connection:

```sql
public.configure_azure_devops_team_link(
  target_organization_id uuid,
  target_connection_id uuid,
  target_planning_team_id uuid,
  target_azure_project_id text,
  target_azure_project_name text,
  target_azure_team_id text,
  target_azure_team_name text,
  target_created_by uuid
) returns uuid

public.disconnect_azure_devops_connection(
  target_organization_id uuid,
  target_connection_id uuid
) returns boolean
```

`configure_azure_devops_team_link` validates connection, planning team, organization, and creator membership provenance, upserts the unique link, marks the connection `configured`, and returns the link ID. `disconnect_azure_devops_connection` nulls both token ciphertexts and expiry and marks the connection and every link `disconnected` without deleting rows. Neither function trusts browser authorization; it is callable only by the service role after the application guard.

- [ ] **Step 6: Reset and run the database suite**

Run: `npm run db:reset && npm run db:test`

Expected: all existing pgTAP files and `azure_devops_connection_rls.test.sql` PASS.

- [ ] **Step 7: Run the migration contract test**

Run: `npm test -- tests/unit/azure-devops-feature-flag.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json supabase/migrations/202608110001_azure_devops_connection_foundation.sql supabase/tests/azure_devops_connection_rls.test.sql
git commit -m "feat: add secure Azure DevOps connection persistence"
```

## Task 3: Regenerate and lock database types

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Create: `tests/unit/azure-devops-database-types.test.ts`

- [ ] **Step 1: Write a failing generated-type contract**

Read `database.types.ts` and assert it contains the three new tables, `azure_devops_connection_status`, and `consume_azure_devops_oauth_state`. Assert the status union is exactly:

```ts
'pending' | 'configured' | 'paused' | 'disconnected'
```

- [ ] **Step 2: Confirm red**

Run: `npm test -- tests/unit/azure-devops-database-types.test.ts`

Expected: FAIL because generated types do not include the migration.

- [ ] **Step 3: Generate from the reset local database**

Run:

```bash
npx supabase gen types typescript --local > /tmp/taskflow-database.types.ts
```

Inspect the generated file for the Azure tables/function/enum, then replace `src/lib/supabase/database.types.ts` using `apply_patch`. Do not hand-edit individual generated table definitions.

- [ ] **Step 4: Run focused and compile checks**

Run: `npm test -- tests/unit/azure-devops-database-types.test.ts && npm run typecheck`

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/database.types.ts tests/unit/azure-devops-database-types.test.ts
git commit -m "chore: generate Azure DevOps database types"
```

## Task 4: Implement token encryption and OAuth-state primitives

**Files:**
- Create: `src/modules/azure-devops/auth/crypto.ts`
- Create: `src/modules/azure-devops/auth/oauth-state.ts`
- Create: `tests/unit/azure-devops-crypto.test.ts`
- Create: `tests/unit/azure-devops-oauth-state.test.ts`

- [ ] **Step 1: Write failing crypto tests**

Cover round-trip encryption, unique IVs for identical plaintext, rejected malformed envelopes, rejected wrong key IDs, rejected tampered ciphertext/tag, and absence of plaintext from thrown errors. Inject the key ring rather than reading process environment in tests.

The public contract is:

```ts
type EncryptionKey = { id: string; bytes: Uint8Array };

export function encryptSecret(
  plaintext: string,
  key: EncryptionKey,
): string;

export function decryptSecret(
  envelope: string,
  keys: readonly EncryptionKey[],
): string;
```

- [ ] **Step 2: Confirm crypto tests are red**

Run: `npm test -- tests/unit/azure-devops-crypto.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement AES-256-GCM envelopes**

Use `randomBytes(12)`, `createCipheriv('aes-256-gcm', ...)`, and base64url segments. Parse the envelope before decryption; accept only version `v1`, the configured key ID, a 12-byte IV, and a 16-byte tag. Throw stable internal error classes such as `InvalidSecretEnvelopeError`; never include the envelope or plaintext in messages.

- [ ] **Step 4: Write failing OAuth-state and PKCE tests**

Cover:

- state and verifier each have at least 256 bits of entropy;
- PKCE challenge equals `base64url(sha256(verifier))`;
- only relative `/settings/integrations/azure-devops...` return paths are retained;
- state is stored as a SHA-256 hex hash, never raw;
- verifier is encrypted before insert;
- consumed state is bound to the current user and organization;
- missing/expired/reused state produces one safe `INVALID_OAUTH_STATE` result.

Define dependency-injected functions:

```ts
export function createOAuthAttempt(input: {
  organizationId: string;
  userId: string;
  returnPath?: string;
  now?: Date;
}): Promise<{ state: string; codeChallenge: string }>;

export function consumeOAuthAttempt(input: {
  state: string;
  organizationId: string;
  userId: string;
}): Promise<{ codeVerifier: string; returnPath: string }>;
```

- [ ] **Step 5: Implement OAuth state through the admin client**

Add `import 'server-only'`. Persist expiry at `now + 10 minutes`; invoke `consume_azure_devops_oauth_state` through `createAdminSupabase()`. Validate returned rows defensively before decrypting the verifier. Keep a cleanup query for consumed or expired state as best-effort maintenance, never on the callback critical path.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/azure-devops-crypto.test.ts tests/unit/azure-devops-oauth-state.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/azure-devops/auth tests/unit/azure-devops-crypto.test.ts tests/unit/azure-devops-oauth-state.test.ts
git commit -m "feat: secure Azure OAuth state and tokens"
```

## Task 5: Implement the Entra and Azure discovery clients

**Files:**
- Create: `src/modules/azure-devops/auth/entra.ts`
- Create: `src/modules/azure-devops/client/http.ts`
- Create: `src/modules/azure-devops/client/discovery.ts`
- Create: `tests/unit/azure-devops-entra.test.ts`
- Create: `tests/unit/azure-devops-client.test.ts`

- [ ] **Step 1: Write failing Entra client tests**

Mock injected `fetch`. Assert the authorization URL uses the configured tenant, client ID, exact scopes, callback URI, state, `response_type=code`, `response_mode=query`, `code_challenge_method=S256`, and supplied challenge. Assert the token exchange uses `application/x-www-form-urlencoded` and includes the PKCE verifier. Test refresh-token exchange and malformed/non-2xx response handling without returning provider bodies.

Use these DTOs:

```ts
export type EntraTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  grantedScopes: string[];
};

export type EntraClientErrorCode =
  | 'ENTRA_UNAVAILABLE'
  | 'ENTRA_AUTH_REJECTED'
  | 'ENTRA_RESPONSE_INVALID';
```

- [ ] **Step 2: Implement Entra authorization, exchange, and refresh**

Use:

```text
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
```

Validate token JSON with Zod. Calculate `expiresAt` from the current injected clock and `expires_in`, allowing a 60-second early-refresh skew. Require a refresh token because continuous delegated access is part of the approved design.

- [ ] **Step 3: Write failing Azure transport and discovery tests**

Test:

- Authorization is `Bearer`, never a query parameter;
- continuation-token pagination terminates and preserves order;
- at most 25 pages are accepted per discovery request;
- one 401 triggers one token refresh and one retry;
- 429 and 5xx become retryable safe errors;
- 401 after refresh becomes `AZURE_RECONNECT_REQUIRED`;
- malformed JSON and unexpected shapes become `AZURE_RESPONSE_INVALID`;
- error bodies and access tokens are absent from errors;
- account, project, and team responses map to minimal DTOs.

- [ ] **Step 4: Implement the server-only transport**

`http.ts` accepts an injected access-token provider and `fetch`; it sets an abort timeout, validates HTTPS endpoints, applies `api-version`, consumes `x-ms-continuationtoken`, and returns only validated values. No general-purpose arbitrary URL method is exported.

- [ ] **Step 5: Implement discovery endpoints**

Use the documented API boundaries:

```text
GET https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1
GET https://app.vssps.visualstudio.com/_apis/accounts?memberId={profileId}&api-version=7.1-preview.1
GET https://dev.azure.com/{organization}/_apis/projects?api-version=7.1
GET https://dev.azure.com/{organization}/_apis/projects/{projectId}/teams?api-version=7.1
```

Return sanitized DTOs only:

```ts
type AzureAccount = { id: string; name: string; url: string };
type AzureProject = { id: string; name: string };
type AzureTeam = { id: string; name: string };
```

Normalize and validate the organization slug extracted from Azure's account URI before interpolating it into a URL. Always URL-encode path/query inputs.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/azure-devops-entra.test.ts tests/unit/azure-devops-client.test.ts`

Expected: PASS with no live Microsoft requests.

- [ ] **Step 7: Commit**

```bash
git add src/modules/azure-devops/auth/entra.ts src/modules/azure-devops/client tests/unit/azure-devops-entra.test.ts tests/unit/azure-devops-client.test.ts
git commit -m "feat: add Entra and Azure discovery clients"
```

## Task 6: Add the shared integration access guard and connection queries

**Files:**
- Create: `src/modules/azure-devops/connections/access.ts`
- Create: `src/modules/azure-devops/connections/queries.ts`
- Create: `tests/unit/azure-devops-access.test.ts`
- Create: `tests/unit/azure-devops-queries.test.ts`

- [ ] **Step 1: Write failing access tests**

Assert the guard:

- requires an active admin membership;
- evaluates `azure_devops_integration` with current environment, user, organization, and role;
- redirects disabled users to `/settings`;
- returns the admin membership only when enabled;
- never calls the service-role client before both checks succeed.

Export:

```ts
export async function requireAzureDevOpsAdmin(): Promise<MembershipContext>;
```

- [ ] **Step 2: Implement the fail-closed guard**

Compose `requireAdmin()`, `currentDeploymentEnvironment()`, and `evaluateFeatureFlag()`. Keep it in a server-only module so route handlers, queries, actions, and layouts share the exact same authorization boundary.

- [ ] **Step 3: Write failing sanitized-query tests**

Assert `getAzureDevOpsConnection()` uses the admin Supabase client only after the guard and returns:

```ts
export type AzureDevOpsConnectionView = {
  id: string;
  status: 'pending' | 'configured' | 'paused' | 'disconnected';
  authorizedUser: { displayName: string; email: string | null };
  organization: { id: string; name: string; url: string } | null;
  lastVerifiedAt: string | null;
  safeErrorCode: string | null;
  teamLinks: Array<{
    id: string;
    planningTeamId: string;
    azureProjectName: string;
    azureTeamName: string;
    status: 'configured' | 'paused' | 'disconnected';
  }>;
};
```

Explicitly assert that access-token ciphertext, refresh-token ciphertext, tenant ID, and raw provider errors are neither selected nor returned.

- [ ] **Step 4: Implement the query**

Scope every query by `membership.organizationId`. Map null/malformed rows to a safe disconnected view rather than trusting service-role data. Load TaskFlow planning teams through `listPlanningTeams()` for the mapping page; do not duplicate its visibility logic.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/azure-devops-access.test.ts tests/unit/azure-devops-queries.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/azure-devops/connections/access.ts src/modules/azure-devops/connections/queries.ts tests/unit/azure-devops-access.test.ts tests/unit/azure-devops-queries.test.ts
git commit -m "feat: guard and query Azure DevOps connections"
```

## Task 7: Implement OAuth connect and callback routes

**Files:**
- Create: `src/app/api/integrations/azure-devops/connect/route.ts`
- Create: `src/app/api/integrations/azure-devops/callback/route.ts`
- Create: `tests/unit/azure-devops-routes.test.ts`

- [ ] **Step 1: Write failing connect-route tests**

For `POST /api/integrations/azure-devops/connect`, assert:

- disabled/non-admin access follows the shared guard;
- a new OAuth attempt is created for the current user/organization;
- the response is a 303 redirect to the exact Entra host;
- the callback URI derives from validated `APP_ORIGIN`, never the request `Host` header;
- hostile `returnPath` values are replaced by the integration settings path;
- internal errors redirect to `?result=connect_failed` without sensitive data.

- [ ] **Step 2: Implement the connect route**

Use a `POST` Route Handler to prevent link prefetch from creating state. Construct the URL from `createEntraAuthorizationUrl`; return `NextResponse.redirect(url, 303)`. Keep redirect response construction outside error-catching code that could accidentally convert it into a failure.

- [ ] **Step 3: Write failing callback-route tests**

For `GET /api/integrations/azure-devops/callback`, assert:

- provider denial returns `?result=consent_denied`;
- missing code/state returns `?result=invalid_callback`;
- the current logged-in admin and enabled flag are required;
- state is consumed before the token request;
- code exchange receives the decrypted PKCE verifier;
- Azure profile discovery supplies the stable authorized user ID;
- access and refresh tokens are encrypted before persistence;
- the pending connection upsert is organization-scoped;
- ciphertext, code, tokens, state, and provider bodies never appear in redirect URLs;
- reused state fails safely;
- redirect uses the validated stored return path.

- [ ] **Step 4: Implement callback orchestration**

Order operations exactly:

1. parse only `code`, `state`, `error`, and `error_description`;
2. require the shared admin/flag guard;
3. consume state for that user and organization;
4. exchange code using the stored PKCE verifier;
5. call profile discovery;
6. encrypt both tokens;
7. upsert the organization connection as `pending` and clear any stale safe error;
8. redirect to the stored path with a safe result code.

Do not log query parameters. Preserve an existing configured connection's Azure organization and mappings during reconnect; only refresh the delegated identity/token fields and set status back to `configured` when its mapping remains valid.

- [ ] **Step 5: Run route tests**

Run: `npm test -- tests/unit/azure-devops-routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/integrations/azure-devops tests/unit/azure-devops-routes.test.ts
git commit -m "feat: connect TaskFlow through Entra OAuth"
```

## Task 8: Implement discovery, mapping, and disconnect server actions

**Files:**
- Create: `src/modules/azure-devops/connections/schemas.ts`
- Create: `src/modules/azure-devops/connections/actions.ts`
- Create: `tests/unit/azure-devops-actions.test.ts`

- [ ] **Step 1: Write failing validation and action tests**

Cover invalid UUIDs, trimmed bounded names, organization URLs restricted to `https://dev.azure.com/{slug}`, admin/flag enforcement, organization scoping, token refresh, encrypted-token replacement after refresh, and safe action errors.

Export typed actions:

```ts
export async function listAccessibleAzureOrganizations(): Promise<ActionResult<AzureAccount[]>>;
export async function selectAzureOrganization(input: unknown): Promise<ActionResult<{ connectionId: string }>>;
export async function listAzureProjects(): Promise<ActionResult<AzureProject[]>>;
export async function listAzureTeams(input: unknown): Promise<ActionResult<AzureTeam[]>>;
export async function saveAzureTeamLink(input: unknown): Promise<ActionResult<{ teamLinkId: string }>>;
export async function disconnectAzureDevOps(): Promise<ActionResult<void>>;
```

- [ ] **Step 2: Add bounded Zod schemas**

Create separate schemas for account, project lookup, team lookup, and final mapping. Never accept display names without their stable IDs. Final mapping input contains only:

```ts
{
  planningTeamId: string;
  azureProjectId: string;
  azureProjectName: string;
  azureTeamId: string;
  azureTeamName: string;
}
```

The selected Azure organization comes from the stored connection, not the browser.

- [ ] **Step 3: Add a reusable valid-access-token helper**

Inside `actions.ts` or a private sibling module, load the organization-scoped connection, decrypt tokens, refresh when expiry is within 60 seconds, encrypt the replacement tokens, and persist them before returning an in-memory access token. On refresh rejection, set `status='paused'` and `safe_error_code='AZURE_RECONNECT_REQUIRED'`.

- [ ] **Step 4: Implement discovery actions**

Each action calls `requireAzureDevOpsAdmin()` first. Account discovery works before Azure organization selection. Project/team discovery uses the selected stored organization. Return only minimal DTOs and `ActionResult` stable codes.

- [ ] **Step 5: Implement final team mapping**

Before insert/upsert:

- verify the planning team belongs to the current organization;
- rediscover the selected project and team server-side and compare both IDs and names;
- rely on database uniqueness and organization triggers as the second boundary;
- invoke `configure_azure_devops_team_link` so connection and link status become `configured` in one transaction;
- revalidate `/settings/integrations/azure-devops` and `/planning`.

- [ ] **Step 6: Implement disconnect**

Invoke `disconnect_azure_devops_connection` to null both token ciphertext columns and expiry and mark the connection and links `disconnected`. Do not delete rows or planning data. Return success when the RPC returns true, including when the connection is already disconnected.

- [ ] **Step 7: Run focused and database tests**

Run: `npm test -- tests/unit/azure-devops-actions.test.ts && npm run db:test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/azure-devops/connections/schemas.ts src/modules/azure-devops/connections/actions.ts tests/unit/azure-devops-actions.test.ts supabase/migrations/202608110001_azure_devops_connection_foundation.sql supabase/tests/azure_devops_connection_rls.test.sql src/lib/supabase/database.types.ts
git commit -m "feat: configure Azure DevOps team mappings"
```

## Task 9: Build the feature-gated admin setup UI

**Files:**
- Create: `src/app/(app)/settings/integrations/azure-devops/layout.tsx`
- Create: `src/app/(app)/settings/integrations/azure-devops/page.tsx`
- Create: `src/components/integrations/azure-devops-connection-form.tsx`
- Create: `src/components/integrations/azure-devops-team-mapping-form.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `tests/unit/azure-devops-settings.test.tsx`

- [ ] **Step 1: Write failing settings-page tests**

Assert:

- disabled integration redirects via the layout guard;
- enabled admins see an Azure DevOps card on Settings;
- disconnected state shows `Connect Azure DevOps` as a POST form;
- pending state shows account selection;
- organization-selected state shows TaskFlow team, Azure project, and Azure team selectors;
- configured state shows sanitized organization/project/team/identity details;
- paused state shows reconnect guidance;
- no ciphertext, tenant secret, token expiry internals, or provider error body is rendered;
- disconnect requires a confirmation dialog and describes archive/preservation behavior.

- [ ] **Step 2: Add the route layout guard**

Call `requireAzureDevOpsAdmin()` in the nested layout. Do not rely on hiding the Settings link as authorization.

- [ ] **Step 3: Add the Settings integration card**

Evaluate the integration flag alongside the existing settings queries. When enabled, render a concise Azure DevOps card linking to `/settings/integrations/azure-devops`. Do not change the main app navigation in this increment.

- [ ] **Step 4: Build the setup page states**

Use `PageHeader`, `Card`, `Badge`, `Alert`, `Button`, and existing form primitives. The page is a Server Component and loads only `AzureDevOpsConnectionView` plus visible planning teams. Keep provider discovery lists in the client mapping form only as action results.

State progression:

```text
Disconnected -> OAuth pending -> Organization selected -> Team configured
                                         \-> Paused/reconnect
```

Label the configured state `Ready for initial import`; do not say `Syncing` or `Active` yet.

- [ ] **Step 5: Build accessible interactive forms**

Use `useActionState` for action feedback. Disable team selection until a project is selected; clear stale teams when the project changes; retain keyboard focus; expose loading status with `aria-live`; and prevent double submission. Never cache discovery responses in browser storage.

- [ ] **Step 6: Run component tests**

Run: `npm test -- tests/unit/azure-devops-settings.test.tsx`

Expected: PASS.

- [ ] **Step 7: Run the existing app-shell and settings-adjacent tests**

Run: `npm test -- tests/unit/app-shell.test.tsx tests/unit/planning-navigation.test.tsx tests/unit/app-smoke.test.tsx`

Expected: PASS with no navigation regression.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/(app)/settings' src/components/integrations tests/unit/azure-devops-settings.test.tsx
git commit -m "feat: add Azure DevOps connection settings"
```

## Task 10: Add browser acceptance coverage and the operating runbook

**Files:**
- Create: `tests/e2e/azure-devops-connection.spec.ts`
- Modify: `docs/operations/feature-flags.md`
- Create: `docs/operations/azure-devops-connection.md`

- [ ] **Step 1: Write the browser test with provider interception**

Use the existing seeded admin flow. Do not contact Microsoft. Intercept the TaskFlow connect endpoint/Entra redirect boundary and seed a pending encrypted connection through the test fixture boundary. Cover:

1. disabled flag hides the card and protects the direct route;
2. enabled admin sees the integration card;
3. connect starts a POST-based OAuth flow;
4. a mocked successful callback creates pending setup;
5. mocked account/project/team discovery drives the cascading form;
6. mapping one planning team reaches `Ready for initial import`;
7. an employee cannot open the settings route;
8. disconnect requires confirmation and returns to disconnected while preserving the planning team.

- [ ] **Step 2: Run the focused browser test**

Run: `npm run test:e2e -- tests/e2e/azure-devops-connection.spec.ts`

Expected: PASS in Chromium.

- [ ] **Step 3: Document Entra application setup**

The runbook must include:

- single-tenant vs `organizations` tenant configuration;
- web redirect URI `${APP_ORIGIN}/api/integrations/azure-devops/callback`;
- delegated Azure DevOps scope configuration;
- client-secret creation and rotation;
- generation of a 32-byte base64 encryption key without printing it into committed files;
- staging/production HTTPS requirement;
- local development setup;
- enable/disable order for `azure_devops_integration`;
- reconnect and disconnect behavior;
- safe symptoms for invalid consent, expired refresh token, and incorrect redirect URI;
- explicit statement that synchronization has not started in this increment.

- [ ] **Step 4: Update feature-flag operations**

Add `azure_devops_integration` with development on, staging/production off, organization-scoped canary guidance, owner/review date, and rollback steps. Rollback is: disable flag first, then disconnect credentials if necessary; never delete mappings or planning data.

- [ ] **Step 5: Run documentation and browser checks**

Run: `npm run format:check && npm run test:e2e -- tests/e2e/azure-devops-connection.spec.ts`

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/azure-devops-connection.spec.ts docs/operations/azure-devops-connection.md docs/operations/feature-flags.md
git commit -m "docs: add Azure DevOps connection rollout runbook"
```

## Task 11: Verify the complete connection foundation

**Files:**
- Modify only files required by verified failures; do not expand scope.

- [ ] **Step 1: Run database verification from a clean reset**

Run: `npm run db:reset && npm run db:test`

Expected: every pgTAP file passes, including the Azure connection contract.

- [ ] **Step 2: Run all application verification**

Run: `npm run verify`

Expected: formatting, ESLint, TypeScript, all Vitest tests, and the production build PASS.

- [ ] **Step 3: Run the full browser suite**

Run: `npm run test:e2e`

Expected: all Playwright specs PASS.

- [ ] **Step 4: Inspect the production boundary**

Run these read-only checks:

```bash
rg -n "access_token|refresh_token|client_secret|error_description" src/app src/components
rg -n "console\.(log|error)|JSON\.stringify" src/modules/azure-devops src/app/api/integrations/azure-devops
git diff --check
git status --short
```

Expected:

- token/secret names appear only in server-only implementation or test code, never rendered components;
- no OAuth query/body logging exists;
- no whitespace errors;
- only intentional changes remain.

- [ ] **Step 5: Confirm completion criteria manually**

Verify all are true:

- an enabled admin can start Entra OAuth;
- callback state is expiring, single-use, user/org-bound, and PKCE-protected;
- stored tokens are encrypted and service-role-only;
- accessible Azure organizations/projects/teams can be discovered;
- one TaskFlow planning team can be mapped to one Azure project/team;
- an employee and a disabled organization cannot access the feature;
- reconnect replaces credentials without deleting mapping;
- disconnect removes usable credentials and preserves data;
- UI says `Ready for initial import`, not `Syncing`;
- no live Azure tenant is required by automated tests.

- [ ] **Step 6: Commit verified fixes, if any**

If verification required edits, inspect `git status --short`, stage only the exact files changed for those verified failures, and commit them with `fix: close Azure connection verification gaps`. Skip this step if verification required no edits.

## Done definition

This plan is complete only when all of the following hold:

- the feature is hidden and inaccessible unless `azure_devops_integration` evaluates true;
- only organization admins can connect and configure Azure DevOps;
- delegated OAuth uses Entra authorization code + PKCE and a validated callback origin;
- OAuth state is hashed, encrypted where secret, expiring, bound, and single-use;
- access and refresh tokens are AES-256-GCM encrypted at rest and never client-visible;
- Azure organization/project/team discovery is typed, paginated, bounded, and testable without network access;
- database constraints enforce the one-team mapping and organization provenance;
- reconnect and disconnect are safe and idempotent;
- connection UI exposes only sanitized health and explicitly stops before import/sync;
- database, unit, production-build, and browser gates pass;
- the operating runbook is sufficient for a staging Entra registration and canary rollout.

## Follow-on planning checkpoint

After this foundation is merged and green, write the next plan for the native planning hierarchy and sprint persistence required by the Azure import. Do not start synchronization by adding ad hoc Azure fields to the existing `tasks` table outside that reviewed plan.
