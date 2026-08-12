# Azure DevOps connection runbook

This covers registering the Entra application, configuring secrets, and
operating the Azure DevOps connection feature (`azure_devops_integration`,
see `docs/operations/feature-flags.md`). It stops at team mapping: **no
work-item import or synchronization has started in this increment.** The
connection can reach `configured`, never `active`; the UI labels that state
`Ready for initial import`, not `Syncing`.

## Register the Entra application

1. In the Microsoft Entra admin center, create an **App registration**.
2. **Supported account types**: choose single-tenant if every connecting
   organization is on the same Microsoft tenant as TaskFlow; choose the
   `organizations` (multitenant) option if different customer organizations
   connect from their own tenants. Set `AZURE_DEVOPS_ENTRA_TENANT_ID`
   accordingly — a specific tenant GUID for single-tenant, or the literal
   value `organizations` for multitenant.
3. **Redirect URI** (Web platform): `${APP_ORIGIN}/api/integrations/azure-devops/callback`.
   This must match `APP_ORIGIN` exactly, including scheme; the callback route
   derives the redirect URI it sends to Entra from `APP_ORIGIN` only, never
   from the incoming request's `Host` header.
4. **API permissions**: add the delegated Azure DevOps scope
   `499b84ac-1321-427f-aa17-267ca6975798/.default` plus `openid`, `profile`,
   `email`, and `offline_access`. `AZURE_DEVOPS_OAUTH_SCOPES` must include
   `offline_access` and that Azure DevOps scope; the server-env schema
   rejects a value missing either.
5. **Certificates & secrets**: create a client secret. Set an expiry your
   team can actually track — Entra does not warn on its own.

## Client-secret rotation

1. Create a new secret in the same app registration; do not delete the old
   one yet.
2. Update `AZURE_DEVOPS_ENTRA_CLIENT_SECRET` in the deployment's environment
   configuration and redeploy.
3. Once the new secret is confirmed working (an admin can reconnect
   successfully), delete the old secret from Entra.

Rotating the secret does not affect already-stored delegated tokens; it only
changes what the server presents at the next code exchange or refresh.

## Generate the token encryption key

`AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY` must decode from base64 to exactly 32
bytes. Generate one locally and paste it directly into the deployment's
secret store — never into a committed file:

```bash
openssl rand -base64 32
```

Pair it with an `AZURE_DEVOPS_TOKEN_KEY_ID` (e.g. `primary-2026-08`) matching
`^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$`. To rotate the key later, ship a new key
ID and value while the crypto module still accepts the old key ID for
decrypting already-stored tokens; a reconnect (see below) then re-encrypts
under the new key.

## Environment configuration

Copy `.env.example` to `.env.local` and fill in the Azure fields alongside
the existing Supabase ones. See `docs/operations/local-development.md` for
the base local setup.

`staging` and `production` require `APP_ORIGIN` to be an HTTPS origin; the
server-env schema only accepts `http://localhost`, `http://127.0.0.1`, or
`http://[::1]` for local development. This is enforced by the route guard,
not the reusable environment parser, because deployment environment isn't
part of that parser.

## Enable and disable order

`azure_devops_integration` defaults to enabled in `development` and disabled
in `staging`/`production`; production rollout is always organization-scoped.
See `docs/operations/feature-flags.md` for the exact rows and how to add an
organization override.

- **Enabling**: confirm the Entra app registration and secrets are correct
  first, then enable the flag for the target organization. Enabling before
  the app registration is ready just produces `connect_failed` redirects.
- **Disabling (rollback)**: disable the flag first. This immediately fails
  closed on the connect/callback routes and every discovery/mapping/disconnect
  server action, without touching stored data. Only disconnect credentials
  afterward, and only if actually necessary — never delete mappings or
  planning data as a rollback step.

## Reconnect and disconnect behavior

**Reconnect** (an admin clicks "Connect" again while a connection already
exists, e.g. after the stored refresh token stops working): runs the same
OAuth flow and replaces the delegated identity and tokens. It preserves the
connection's selected Azure organization and any existing team mappings —
the callback only resets those if the connection's mapping is no longer
valid. Reconnecting never creates a second connection for an organization;
one organization owns at most one connection.

**Disconnect** (`disconnect_azure_devops_connection`): nulls the stored
access/refresh token ciphertext and expiry, and marks the connection and its
team links `disconnected`. It does not delete the connection row, the team
link rows, or any planning team or its data — those remain in place so a
later reconnect can re-establish the same mapping. The UI requires an
explicit confirmation step before calling disconnect and states this
preservation behavior in that confirmation.

## Safe failure symptoms

The callback and every server action return stable, sanitized result codes.
None of the following ever include the provider's raw error body, an OAuth
code, a token, or ciphertext — check server-side traces (never client-visible
logs) if a stable code alone isn't enough to diagnose:

| Symptom the admin sees                                    | Likely cause                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Redirected back with `?result=consent_denied`               | The signed-in Microsoft account declined consent, or lacks Azure DevOps access. |
| Redirected back with `?result=invalid_state` or `invalid_callback` | The OAuth attempt expired (10 minutes), was already used, or the callback query was tampered with or malformed. |
| Redirected back with `?result=callback_failed`               | Code exchange or profile discovery failed — commonly an incorrect redirect URI registered in Entra, or a wrong/expired client secret. |
| Connection status `paused` with reconnect guidance           | The stored refresh token was rejected on renewal (revoked consent, disabled account, expired credential). Reconnecting replaces it without losing the team mapping. |
| `AZURE_DEVOPS_UNAVAILABLE` action errors                     | Azure DevOps returned a 5xx/408/429; transient — retry. |
| `AZURE_RECONNECT_REQUIRED` action errors                     | Same underlying condition as the `paused` status above, surfaced from a discovery or mapping action instead of a page load. |

## No live Azure tenant required for automated tests

Unit tests exercise the crypto, OAuth-state, Entra, and Azure client modules
entirely through dependency injection — no network access. The browser
acceptance spec (`tests/e2e/azure-devops-connection.spec.ts`) drives the real
connect → callback → discovery → mapping → disconnect flow but never reaches
Microsoft: the Playwright `webServer` sets `AZURE_DEVOPS_E2E_FIXTURES=true`,
which makes `src/modules/azure-devops/testing/fixture-fetch.ts` serve canned
Entra/Azure DevOps responses to the server-side code that would otherwise
call those hosts. That variable is read nowhere except those fixture-served
HTTP calls; leaving it unset (the default everywhere outside the e2e run)
makes every call go to the real hosts. **Never set
`AZURE_DEVOPS_E2E_FIXTURES` in a staging or production deployment.**
