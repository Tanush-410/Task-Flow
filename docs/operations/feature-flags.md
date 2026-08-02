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
