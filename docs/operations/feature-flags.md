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
