-- Two real gaps found while testing the role-management feature, both
-- silent (the code catches the resulting error and treats it as empty
-- data rather than surfacing it):
--
-- 1. listOrganizationsForSignup() (src/modules/organizations/queries.ts)
--    reads public.organizations via the service-role admin client to
--    populate the employee signup form's "join an existing organization"
--    picker -- service_role was never granted SELECT on this table (only
--    anon/authenticated were addressed by the original revoke), so this
--    query has been silently returning zero organizations. Every employee
--    self-service signup ("join an org that already exists") would show
--    no organizations to pick from, regardless of how many exist.
--
-- 2. filterMutedEntries() (src/modules/notifications/actions.ts) reads
--    public.task_mutes via the same admin client, for the same reason
--    (comment there: "the actor triggering a notification has no RLS
--    access to other users' task_mutes rows"). Missing grant means it
--    silently fails open -- notifications ignore mute preferences instead
--    of failing loudly.
--
-- Matches the existing precedent for this exact pattern
-- (`grant select on table public.feature_flags to service_role`,
-- 202608100001_sprint_foundation.sql).

grant select on table public.organizations to service_role;
grant select on table public.task_mutes to service_role;
