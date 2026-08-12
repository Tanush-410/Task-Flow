# Feature flag evaluation

Feature flags are evaluated only on the server through the service-role client. Callers receive a boolean and never raw flag records. Invalid input, missing or malformed configuration, ambiguous rows, and query failures all return `false`.

Applicable rows use this fixed precedence:

1. Organization and role
2. Organization, all roles
3. Global, matching role
4. Global, all roles

An organization-wide override therefore wins over a global role-specific flag. More than one row at the winning scope is ambiguous and fails closed.

`expires_on` is inclusive through that UTC calendar date. A flag with `expires_on = 2026-08-01` remains active until `2026-08-01T23:59:59.999Z` and is expired at the start of `2026-08-02Z`.

The service-role query filters by key and environment, requested organization plus global scope, and requested role plus unscoped rows before materializing records. The `feature_flags_evaluation_lookup_idx` index supports those lookup dimensions.

## Native sprint planning

`native_sprint_planning` gates the Planning navigation and every route under
`/planning`. The route guard evaluates independently of the navigation, so a
missing, malformed, expired, or disabled flag returns a 404 instead of
exposing a partially enabled feature.

The migration seeds these global defaults:

| Environment   | Enabled | Rollout | Purpose                              |
| ------------- | ------- | ------- | ------------------------------------ |
| `development` | Yes     | 100%    | Local verification                  |
| `staging`     | No      | 0%      | Enable after increment acceptance   |
| `production`  | No      | 0%      | Enable only through approved rollout |

To override the default for one organization, create a `feature_flags` row
with `key = 'native_sprint_planning'`, the target `environment`, its
`organization_id`, and either a specific `role_scope` (`admin` or `employee`)
or `NULL` for every role. Set `enabled`, `rollout_percentage`, `owner`,
`purpose`, `rollout_plan`, `review_on`, and `expires_on` explicitly. The seeded
owner is `product-engineering`; review is due on 2026-09-10 and expiry is
2027-08-10.

Rollback is non-destructive: disable the applicable flag row or set its
rollout to zero. Do not drop planning tables; existing team data remains
available for a later rollout.

## Azure DevOps integration

`azure_devops_integration` gates every Azure DevOps surface: the Settings
card, the `/settings/integrations/azure-devops` route and its nested layout
guard, the OAuth connect/callback routes, and every discovery, mapping, and
disconnect server action. The guard (`requireAzureDevOpsAdmin` /
`getAzureDevOpsAdminAccess`) also requires an active organization admin;
non-admins and disabled organizations both fail closed to a redirect, never a
partially rendered page.

The migration seeds these global defaults:

| Environment   | Enabled | Rollout | Purpose                                            |
| ------------- | ------- | ------- | --------------------------------------------------- |
| `development` | Yes     | 100%    | Local connection verification                       |
| `staging`     | No      | 0%      | Enable after connection security acceptance          |
| `production`  | No      | 0%      | Organization-scoped rollout after staging approval   |

Because this is a live, delegated OAuth integration, production rollout is
always organization-scoped, never global. To enable it for one organization,
create a `feature_flags` row with `key = 'azure_devops_integration'`, the
target `environment`, its `organization_id`, and `role_scope = NULL` (the
guard only ever evaluates the connecting admin's own role, so a role-scoped
override adds no isolation here). Set `enabled`, `rollout_percentage`,
`owner`, `purpose`, `rollout_plan`, `review_on`, and `expires_on` explicitly.
The seeded owner is `product-engineering`; review is due on 2026-09-11 and
expiry is 2027-08-11. The demo organization created by `supabase/seed.sql`
carries exactly this kind of override for `staging` and `production` so
local and CI acceptance runs can exercise the integration without changing
the global default.

Canary an organization by setting its override's `rollout_percentage` below
100 before raising it to 100, the same bucketing `native_sprint_planning`
uses (`isInRollout` hashes `key:userId`, so individual admins within an
enabled organization see a stable, deterministic on/off result).

Rollback order matters here specifically because live credentials are
involved: **disable the flag first**, then disconnect credentials only if
necessary. Disabling immediately fails closed on the connect/callback routes
and every server action, without touching stored data. Disconnecting (through
the UI or the `disconnect_azure_devops_connection` RPC) additionally clears
the stored access/refresh token ciphertext; it never deletes planning teams
or their existing Azure DevOps mappings. Do not drop or truncate
`azure_devops_connections`, `azure_devops_oauth_states`, or
`azure_devops_team_links` as a rollback step.
