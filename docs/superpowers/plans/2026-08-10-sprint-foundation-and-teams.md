# Sprint Foundation and Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first native sprint-planning increment: a green baseline, secure multi-team persistence, generated types, feature-flagged navigation, and usable team/member management screens.

**Architecture:** Add organization-scoped `planning_teams` and `planning_team_members` tables with security-definer authorization helpers and RLS. Follow the existing domain pattern with Zod schemas, server-only queries, typed Server Actions, small client forms, and Server Component pages. Gate the shared Planning navigation and routes with the existing fail-closed feature-flag service.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19 `useActionState`, strict TypeScript, Supabase/PostgreSQL with pgTAP and RLS, Zod 4, Vitest/Testing Library, Playwright, Tailwind CSS/shadcn primitives.

---

## Scope boundary

This is Plan 1 of 8 from the approved design. It intentionally stops after team management. Work-item hierarchy, backlog ranking, sprints/capacity, sprint board, insights, risks/retrospectives, and releases/roadmap each receive their own implementation plan after this increment is green.

## File map

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/202608100001_sprint_foundation.sql` | Planning-team schema, helpers, triggers, grants, RLS, and rollout flags |
| `supabase/tests/sprint_foundation_rls.test.sql` | Schema, grant, RLS, and behavioral authorization contract |
| `src/lib/supabase/database.types.ts` | Generated database contract after the migration |
| `src/modules/planning-teams/schemas.ts` | Team and membership input validation |
| `src/modules/planning-teams/queries.ts` | Role-filtered team/member view models and access guard |
| `src/modules/planning-teams/actions.ts` | Create, update, membership replacement, and archive mutations |
| `src/modules/operations/deployment-environment.ts` | Stable feature-flag environment selection |
| `src/components/planning/team-form.tsx` | Create/edit team form with safe action feedback |
| `src/components/planning/team-members-form.tsx` | Member/role/capacity editor |
| `src/components/app-shell.tsx` | Conditional shared Planning navigation entry |
| `src/app/(app)/layout.tsx` | Server-side flag evaluation and shell propagation |
| `src/app/(app)/planning/layout.tsx` | Fail-closed feature access guard |
| `src/app/(app)/planning/page.tsx` | Team-aware planning landing page |
| `src/app/(app)/planning/teams/page.tsx` | Team list and create flow |
| `src/app/(app)/planning/teams/[teamId]/page.tsx` | Team settings and membership flow |
| `tests/unit/planning-team-schemas.test.ts` | Validation contract |
| `tests/unit/planning-team-actions.test.ts` | Action auth, persistence, revalidation, and safe-error contract |
| `tests/unit/planning-team-queries.test.ts` | Query mapping and access behavior |
| `tests/unit/deployment-environment.test.ts` | Environment mapping contract |
| `tests/unit/planning-navigation.test.tsx` | Feature-gated navigation contract |
| `tests/e2e/planning-teams.spec.ts` | Admin and employee acceptance coverage |
| `docs/operations/feature-flags.md` | `native_sprint_planning` rollout instructions |

## Task 1: Restore a green unit-test baseline

**Files:**
- Modify: `tests/unit/foundation-release-contract.test.ts`

- [ ] **Step 1: Update the stale generated-enum assertion**

Replace the array-only assertion with the generated union contract:

```ts
expect(databaseTypes).toMatch(
  /invitation_delivery_status:\s*'pending_delivery'\s*\|\s*'active'\s*\|\s*'failed'/,
);
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- tests/unit/foundation-release-contract.test.ts`

Expected: `8 passed` and no failed tests.

- [ ] **Step 3: Run the full unit baseline**

Run: `npm test`

Expected: `35 passed` test files and `203 passed` tests.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/foundation-release-contract.test.ts
git commit -m "test: align enum contract with generated types"
```

## Task 2: Specify the database authorization contract

**Files:**
- Create: `supabase/tests/sprint_foundation_rls.test.sql`

- [ ] **Step 1: Write the failing pgTAP schema and policy test**

Create the test with this contract:

```sql
begin;

select plan(26);

select has_type('public', 'planning_role', 'planning role enum exists');
select has_table('public', 'planning_teams', 'planning teams exist');
select has_table('public', 'planning_team_members', 'planning team members exist');
select has_column('public', 'planning_teams', 'default_sprint_length_days', 'teams store sprint cadence');
select has_column('public', 'planning_team_members', 'default_capacity_hours_per_day', 'members store capacity defaults');
select has_function('public', 'is_planning_team_member', array['uuid'], 'team membership helper exists');
select has_function('public', 'is_planning_team_planner', array['uuid'], 'team planner helper exists');

select policies_are(
  'public',
  'planning_teams',
  array[
    'planning_teams_view_member_or_admin',
    'planning_teams_insert_admin',
    'planning_teams_update_planner_or_admin',
    'planning_teams_delete_admin'
  ],
  'planning teams have explicit policies'
);

select policies_are(
  'public',
  'planning_team_members',
  array[
    'planning_team_members_view_team',
    'planning_team_members_insert_planner',
    'planning_team_members_update_planner_or_self_capacity',
    'planning_team_members_delete_planner'
  ],
  'planning team members have explicit policies'
);

select ok(
  not has_table_privilege('anon', 'public.planning_teams', 'select')
  and not has_table_privilege('anon', 'public.planning_team_members', 'select'),
  'anonymous users have no planning access'
);

select ok(
  has_table_privilege('authenticated', 'public.planning_teams', 'select')
  and has_table_privilege('authenticated', 'public.planning_team_members', 'select'),
  'authenticated users receive select grants subject to RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.planning_teams', 'update'),
  'whole-row team updates are not granted'
);

select ok(
  has_column_privilege('authenticated', 'public.planning_teams', 'name', 'update')
  and not has_column_privilege('authenticated', 'public.planning_teams', 'organization_id', 'update'),
  'only mutable team columns are updateable'
);

select ok(
  has_column_privilege('authenticated', 'public.planning_team_members', 'default_capacity_hours_per_day', 'update')
  and not has_column_privilege('authenticated', 'public.planning_team_members', 'organization_id', 'update')
  and not has_column_privilege('authenticated', 'public.planning_team_members', 'user_id', 'update'),
  'membership provenance cannot be rewritten'
);

select ok(
  has_index('public', 'planning_teams', 'planning_teams_org_name_unique_idx')
  and has_index('public', 'planning_team_members', 'planning_team_members_team_user_unique_idx'),
  'team lookup and uniqueness indexes exist'
);

select lives_ok(
  $$insert into public.feature_flags (
      key, environment, enabled, rollout_percentage, owner, purpose,
      rollout_plan, review_on, expires_on
    ) values (
      'sprint_foundation_test', 'development', false, 0, 'test', 'test flag',
      'never enabled', current_date, current_date
    )$$,
  'migration leaves feature flags writable by database owner'
);

select is(
  (select count(*)::integer from public.feature_flags where key = 'native_sprint_planning'),
  3,
  'rollout rows exist for development, staging, and production'
);

select is(
  (select enabled from public.feature_flags where key = 'native_sprint_planning' and environment = 'development'),
  true,
  'local development is enabled'
);

select is(
  (select enabled from public.feature_flags where key = 'native_sprint_planning' and environment = 'staging'),
  false,
  'staging defaults off'
);

select is(
  (select enabled from public.feature_flags where key = 'native_sprint_planning' and environment = 'production'),
  false,
  'production defaults off'
);

select ok(
  has_function_privilege('authenticated', 'public.is_planning_team_member(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.is_planning_team_planner(uuid)', 'execute'),
  'authenticated users can execute team authorization helpers'
);

select ok(
  not has_function_privilege('anon', 'public.is_planning_team_member(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.is_planning_team_planner(uuid)', 'execute'),
  'anonymous users cannot execute team authorization helpers'
);

select col_is_unique('public', 'planning_team_members', array['planning_team_id', 'user_id'], 'one membership per user and team');
select col_not_null('public', 'planning_teams', 'organization_id', 'team organization is required');
select col_not_null('public', 'planning_team_members', 'organization_id', 'member organization is required');

select throws_ok(
  $$insert into public.planning_teams (organization_id, name, default_sprint_length_days, created_by)
    values (
      '10000000-0000-0000-0000-000000000001',
      'Invalid',
      0,
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'sprint length must be positive'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test to verify it fails**

Run: `npm run db:start && npm run db:test`

Expected: FAIL because `planning_role` and the planning tables do not exist.

- [ ] **Step 3: Commit the red test**

```bash
git add supabase/tests/sprint_foundation_rls.test.sql
git commit -m "test: specify sprint foundation database security"
```

## Task 3: Implement planning-team schema and RLS

**Files:**
- Create: `supabase/migrations/202608100001_sprint_foundation.sql`
- Modify: `supabase/tests/sprint_foundation_rls.test.sql`

- [ ] **Step 1: Create the enum, tables, and indexes**

Use this schema at the top of the migration:

```sql
create type public.planning_role as enum ('planner', 'member');

create table public.planning_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  default_sprint_length_days integer not null default 14
    check (default_sprint_length_days between 1 and 42),
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index planning_teams_org_name_unique_idx
on public.planning_teams (organization_id, lower(btrim(name)));

create index planning_teams_org_archived_idx
on public.planning_teams (organization_id, is_archived, created_at);

create trigger planning_teams_set_updated_at
before update on public.planning_teams
for each row execute function public.set_updated_at();

create table public.planning_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  planning_team_id uuid not null references public.planning_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  planning_role public.planning_role not null default 'member',
  default_capacity_hours_per_day numeric(4,2) not null default 8
    check (default_capacity_hours_per_day between 0 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index planning_team_members_team_user_unique_idx
on public.planning_team_members (planning_team_id, user_id);

create index planning_team_members_user_team_idx
on public.planning_team_members (user_id, planning_team_id);

create trigger planning_team_members_set_updated_at
before update on public.planning_team_members
for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Add non-recursive authorization helpers and membership validation**

Append:

```sql
create or replace function public.is_planning_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.planning_teams team
    where team.id = target_team_id
      and (
        public.is_admin(team.organization_id)
        or exists (
          select 1
          from public.planning_team_members member
          join public.organization_memberships organization_member
            on organization_member.organization_id = member.organization_id
           and organization_member.user_id = member.user_id
           and organization_member.status = 'active'
          where member.planning_team_id = team.id
            and member.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_planning_team_planner(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.planning_teams team
    where team.id = target_team_id
      and (
        public.is_admin(team.organization_id)
        or exists (
          select 1
          from public.planning_team_members member
          join public.organization_memberships organization_member
            on organization_member.organization_id = member.organization_id
           and organization_member.user_id = member.user_id
           and organization_member.status = 'active'
          where member.planning_team_id = team.id
            and member.user_id = auth.uid()
            and member.planning_role = 'planner'
        )
      )
  );
$$;

create or replace function public.validate_planning_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_organization_id uuid;
begin
  select organization_id into team_organization_id
  from public.planning_teams
  where id = new.planning_team_id;

  if team_organization_id is null or team_organization_id <> new.organization_id then
    raise exception using errcode = '23514', message = 'planning team organization mismatch';
  end if;

  if not exists (
    select 1 from public.organization_memberships
    where organization_id = new.organization_id
      and user_id = new.user_id
      and status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'planning team member must be active in organization';
  end if;

  return new;
end;
$$;

create trigger planning_team_members_validate
before insert or update of organization_id, planning_team_id, user_id
on public.planning_team_members
for each row execute function public.validate_planning_team_member();

create or replace function public.archive_planning_team(target_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select organization_id into target_organization_id
  from public.planning_teams
  where id = target_team_id;

  if target_organization_id is null or not public.is_admin(target_organization_id) then
    raise exception using errcode = '42501', message = 'planning team admin access required';
  end if;

  update public.planning_teams
  set is_archived = true
  where id = target_team_id and is_archived = false;

  return found;
end;
$$;
```

- [ ] **Step 3: Add grants and RLS policies**

Append explicit revokes, grants, and the policy names asserted in Task 2. The self-capacity policy must use this exact `with check` rule so members cannot promote themselves:

```sql
alter table public.planning_teams enable row level security;
alter table public.planning_team_members enable row level security;

revoke all on table public.planning_teams from anon, authenticated;
revoke all on table public.planning_team_members from anon, authenticated;
revoke all on function public.is_planning_team_member(uuid) from public, anon, authenticated;
revoke all on function public.is_planning_team_planner(uuid) from public, anon, authenticated;
revoke all on function public.validate_planning_team_member() from public, anon, authenticated;
revoke all on function public.archive_planning_team(uuid) from public, anon, authenticated;

grant execute on function public.is_planning_team_member(uuid) to authenticated;
grant execute on function public.is_planning_team_planner(uuid) to authenticated;
grant execute on function public.archive_planning_team(uuid) to authenticated;

grant select, delete on public.planning_teams to authenticated;
grant insert (organization_id, name, description, default_sprint_length_days, created_by)
on public.planning_teams to authenticated;
grant update (name, description, default_sprint_length_days)
on public.planning_teams to authenticated;

grant select, delete on public.planning_team_members to authenticated;
grant insert (organization_id, planning_team_id, user_id, planning_role, default_capacity_hours_per_day)
on public.planning_team_members to authenticated;
grant update (planning_role, default_capacity_hours_per_day)
on public.planning_team_members to authenticated;

create policy planning_teams_view_member_or_admin
on public.planning_teams for select to authenticated
using (public.is_planning_team_member(id));

create policy planning_teams_insert_admin
on public.planning_teams for insert to authenticated
with check (public.is_admin(organization_id) and created_by = auth.uid());

create policy planning_teams_update_planner_or_admin
on public.planning_teams for update to authenticated
using (public.is_planning_team_planner(id))
with check (public.is_planning_team_planner(id));

create policy planning_teams_delete_admin
on public.planning_teams for delete to authenticated
using (public.is_admin(organization_id));

create policy planning_team_members_view_team
on public.planning_team_members for select to authenticated
using (public.is_planning_team_member(planning_team_id));

create policy planning_team_members_insert_planner
on public.planning_team_members for insert to authenticated
with check (public.is_planning_team_planner(planning_team_id));

create policy planning_team_members_update_planner_or_self_capacity
on public.planning_team_members for update to authenticated
using (public.is_planning_team_planner(planning_team_id) or user_id = auth.uid())
with check (
  public.is_planning_team_planner(planning_team_id)
  or (user_id = auth.uid() and planning_role = 'member')
);

create policy planning_team_members_delete_planner
on public.planning_team_members for delete to authenticated
using (public.is_planning_team_planner(planning_team_id));
```

- [ ] **Step 4: Seed fail-closed rollout rows**

Append:

```sql
insert into public.feature_flags (
  key,
  environment,
  enabled,
  rollout_percentage,
  owner,
  purpose,
  rollout_plan,
  review_on,
  expires_on
)
values
  (
    'native_sprint_planning', 'development', true, 100,
    'product-engineering', 'Gate native sprint planning',
    'Enabled for local verification', '2026-09-10', '2027-08-10'
  ),
  (
    'native_sprint_planning', 'staging', false, 0,
    'product-engineering', 'Gate native sprint planning',
    'Enable after increment acceptance', '2026-09-10', '2027-08-10'
  ),
  (
    'native_sprint_planning', 'production', false, 0,
    'product-engineering', 'Gate native sprint planning',
    'Organization-scoped rollout after staging approval', '2026-09-10', '2027-08-10'
  )
on conflict (organization_id, environment, role_scope, key) do nothing;
```

- [ ] **Step 5: Reset and run database tests**

Run: `npm run db:reset && npm run db:test`

Expected: all migrations apply and every pgTAP file passes.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202608100001_sprint_foundation.sql supabase/tests/sprint_foundation_rls.test.sql
git commit -m "feat: add secure planning team foundation"
```

## Task 4: Regenerate database types and lock the migration contract

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Create: `tests/unit/sprint-foundation-migration.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('sprint foundation migration', () => {
  const migration = read('supabase/migrations/202608100001_sprint_foundation.sql');
  const types = read('src/lib/supabase/database.types.ts');

  it('keeps helpers hardened and tables protected by RLS', () => {
    expect(migration).toMatch(/is_planning_team_member[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(migration).toMatch(/alter table public\.planning_teams enable row level security/i);
    expect(migration).toMatch(/alter table public\.planning_team_members enable row level security/i);
  });

  it('tracks the planning schema in generated types', () => {
    expect(types).toContain('planning_teams: {');
    expect(types).toContain('planning_team_members: {');
    expect(types).toMatch(/planning_role:\s*'planner'\s*\|\s*'member'/);
  });
});
```

- [ ] **Step 2: Run it and confirm the types assertion fails**

Run: `npm test -- tests/unit/sprint-foundation-migration.test.ts`

Expected: FAIL because generated types do not yet include the planning tables.

- [ ] **Step 3: Regenerate and format types**

Run: `npx supabase gen types typescript --local > /tmp/taskflow-database.types.ts`

Run: `cp /tmp/taskflow-database.types.ts src/lib/supabase/database.types.ts && npx prettier --write src/lib/supabase/database.types.ts`

Expected: `database.types.ts` contains both tables, both helper functions, and `planning_role`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/sprint-foundation-migration.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/database.types.ts tests/unit/sprint-foundation-migration.test.ts
git commit -m "chore: generate sprint foundation database types"
```

## Task 5: Add team validation and deployment environment selection

**Files:**
- Create: `src/modules/planning-teams/schemas.ts`
- Create: `src/modules/operations/deployment-environment.ts`
- Create: `tests/unit/planning-team-schemas.test.ts`
- Create: `tests/unit/deployment-environment.test.ts`

- [ ] **Step 1: Write failing schema tests**

Cover trimmed names, 1–42 day cadence, unique member IDs, 0–24 capacity, planner/member roles, and UUID validation:

```ts
import { describe, expect, it } from 'vitest';
import { planningTeamCreateSchema, planningTeamMembersSchema } from '@/modules/planning-teams/schemas';

describe('planning team schemas', () => {
  it('normalizes a valid team', () => {
    expect(planningTeamCreateSchema.parse({ name: ' Platform ', description: '', defaultSprintLengthDays: 14 })).toEqual({
      name: 'Platform', description: '', defaultSprintLengthDays: 14,
    });
  });

  it.each([0, 43, 1.5])('rejects cadence %s', (days) => {
    expect(planningTeamCreateSchema.safeParse({ name: 'Team', description: '', defaultSprintLengthDays: days }).success).toBe(false);
  });

  it('rejects duplicate members and invalid capacity', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    expect(planningTeamMembersSchema.safeParse({ teamId: userId, members: [
      { userId, role: 'member', capacityHoursPerDay: 8 },
      { userId, role: 'planner', capacityHoursPerDay: 25 },
    ] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement schemas**

Export `planningTeamCreateSchema`, `planningTeamUpdateSchema`, `planningTeamMembersSchema`, and `planningTeamArchiveSchema`. Use `uuidSchema`, trimmed bounded strings, integer cadence, numeric capacity, and a `.superRefine` duplicate-user check that reports on `members`.

- [ ] **Step 3: Write failing environment tests**

Test the pure function with explicit inputs:

```ts
expect(resolveDeploymentEnvironment({ nodeEnv: 'development' })).toBe('development');
expect(resolveDeploymentEnvironment({ nodeEnv: 'production', vercelEnv: 'preview' })).toBe('staging');
expect(resolveDeploymentEnvironment({ nodeEnv: 'production', vercelEnv: 'production' })).toBe('production');
```

- [ ] **Step 4: Implement environment selection**

```ts
import type { Database } from '@/lib/supabase/database.types';

type Environment = Database['public']['Enums']['deployment_environment'];

export function resolveDeploymentEnvironment(input: { nodeEnv?: string; vercelEnv?: string }): Environment {
  if (input.vercelEnv === 'preview') return 'staging';
  if (input.vercelEnv === 'production' || input.nodeEnv === 'production') return 'production';
  return 'development';
}

export function currentDeploymentEnvironment(): Environment {
  return resolveDeploymentEnvironment({ nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV });
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/unit/planning-team-schemas.test.ts tests/unit/deployment-environment.test.ts`

Expected: PASS.

```bash
git add src/modules/planning-teams/schemas.ts src/modules/operations/deployment-environment.ts tests/unit/planning-team-schemas.test.ts tests/unit/deployment-environment.test.ts
git commit -m "feat: validate planning team inputs"
```

## Task 6: Add secure planning-team queries

**Files:**
- Create: `src/modules/planning-teams/queries.ts`
- Create: `tests/unit/planning-team-queries.test.ts`

- [ ] **Step 1: Write failing query tests**

Mock `requireMembership` and `createServerSupabase`. Assert that `listPlanningTeams()` filters by `organization_id`, hides archived teams by default, joins member rows to display names, and returns only this view model:

```ts
export type PlanningTeamSummary = {
  id: string;
  name: string;
  description: string;
  defaultSprintLengthDays: number;
  isArchived: boolean;
  memberCount: number;
  currentUserRole: 'admin' | 'planner' | 'member';
};
```

Also assert that `getPlanningTeam(teamId)` returns `null` on a missing/hidden row and that `requirePlanningTeamAccess(teamId)` redirects to `/planning` when access is absent.

Assert that `listPlanningTeamCandidates(teamId)` first verifies planner access, then returns active organization members who may be added without calling the admin-only `listOrganizationMembers()` helper.

- [ ] **Step 2: Implement bounded query view models**

Implement:

```ts
export async function listPlanningTeams(input: { includeArchived?: boolean } = {}): Promise<PlanningTeamSummary[]>;
export async function getPlanningTeam(teamId: string): Promise<PlanningTeamDetail | null>;
export async function requirePlanningTeamAccess(teamId: string): Promise<PlanningTeamDetail>;
export async function listPlanningTeamCandidates(teamId: string): Promise<PlanningTeamCandidate[]>;
```

`PlanningTeamDetail` extends the summary with `members: PlanningTeamMember[]`; each member contains only `userId`, `displayName`, `planningRole`, and `defaultCapacityHoursPerDay`. `PlanningTeamCandidate` contains `userId`, `displayName`, and current team membership fields when present. Depend on RLS, but still constrain every query by the current `organizationId`.

- [ ] **Step 3: Run tests and typecheck**

Run: `npm test -- tests/unit/planning-team-queries.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/planning-teams/queries.ts tests/unit/planning-team-queries.test.ts
git commit -m "feat: query planning teams securely"
```

## Task 7: Add team lifecycle and membership actions

**Files:**
- Create: `src/modules/planning-teams/actions.ts`
- Create: `tests/unit/planning-team-actions.test.ts`

- [ ] **Step 1: Write failing action tests**

Test these exact behaviors:

- Invalid input returns `INVALID_PLANNING_TEAM` before opening a database client.
- `createPlanningTeam` requires `requireAdmin`, writes the authenticated organization/user IDs, and returns only `{ teamId }`.
- `updatePlanningTeam` requires membership plus `is_planning_team_planner` RPC success.
- `setPlanningTeamMembers` replaces membership rows only after every submitted user is an active organization member.
- A member updating only their own capacity is accepted; changing their own role is rejected.
- `archivePlanningTeam` requires an organization admin and calls the `archive_planning_team` RPC; direct column updates are not granted.
- Database errors return stable codes and trace IDs without leaking database messages.
- Successful actions call `revalidatePath('/planning', 'layout')`.

Use this return surface:

```ts
type TeamActionCode =
  | 'INVALID_PLANNING_TEAM'
  | 'PLANNING_TEAM_FORBIDDEN'
  | 'PLANNING_TEAM_CONFLICT'
  | 'PLANNING_TEAM_SAVE_FAILED';
```

- [ ] **Step 2: Implement the four actions**

Create `createPlanningTeam`, `updatePlanningTeam`, `setPlanningTeamMembers`, and `archivePlanningTeam` in a `'use server'` file with these signatures:

```ts
export async function createPlanningTeam(input: unknown): Promise<ActionResult<{ teamId: string }>>;
export async function updatePlanningTeam(input: unknown): Promise<ActionResult<{ teamId: string }>>;
export async function setPlanningTeamMembers(input: unknown): Promise<ActionResult<{ teamId: string }>>;
export async function archivePlanningTeam(input: unknown): Promise<ActionResult<null>>;
```

Parse before authorization, call `requireAdmin` only for create/archive, call `requireMembership` for update/member replacement, confirm team organization explicitly, and rely on RLS as the final boundary. `setPlanningTeamMembers` deletes rows absent from the submitted set and upserts submitted rows only after validating all candidate IDs with one organization-membership query. `archivePlanningTeam` invokes `supabase.rpc('archive_planning_team', { target_team_id: teamId })`. Use `randomUUID()` for trace IDs and `revalidatePath('/planning', 'layout')` after success.

- [ ] **Step 3: Run focused tests**

Run: `npm test -- tests/unit/planning-team-actions.test.ts`

Expected: PASS with all authorization and safe-error cases.

- [ ] **Step 4: Run related tests and typecheck**

Run: `npm test -- tests/unit/planning-team-actions.test.ts tests/unit/planning-team-queries.test.ts tests/unit/member-actions.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/planning-teams/actions.ts tests/unit/planning-team-actions.test.ts
git commit -m "feat: manage planning teams and members"
```

## Task 8: Add feature-gated Planning navigation and route guard

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/planning/layout.tsx`
- Create: `tests/unit/planning-navigation.test.tsx`
- Modify: `tests/unit/app-shell.test.tsx`

- [ ] **Step 1: Write failing navigation tests**

Render `AppShell` for both roles with `planningEnabled={true}` and assert a `Planning` link to `/planning`. Render with `false` and assert the link is absent. Update every existing AppShell render to pass `planningEnabled={false}`.

- [ ] **Step 2: Add the conditional navigation item**

Add `PanelsTopLeft` from Lucide. Accept `planningEnabled: boolean`. Insert `{ href: '/planning', icon: PanelsTopLeft, label: 'Planning' }` for both roles only when enabled; do not duplicate the static arrays.

- [ ] **Step 3: Evaluate the flag in the protected layout**

Add the feature evaluation to the existing `Promise.all`:

```ts
evaluateFeatureFlag({
  key: 'native_sprint_planning',
  environment: currentDeploymentEnvironment(),
  userId: membership.userId,
  organizationId: membership.organizationId,
  role: membership.role,
})
```

Pass the boolean to `AppShell`.

- [ ] **Step 4: Add a fail-closed nested layout**

The `/planning` layout repeats authorization rather than trusting hidden navigation. Require membership, evaluate the same flag, and call `notFound()` when disabled. Return `children` when enabled.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/unit/planning-navigation.test.tsx tests/unit/app-shell.test.tsx && npm run typecheck`

Expected: PASS.

```bash
git add src/components/app-shell.tsx 'src/app/(app)/layout.tsx' 'src/app/(app)/planning/layout.tsx' tests/unit/planning-navigation.test.tsx tests/unit/app-shell.test.tsx
git commit -m "feat: gate planning navigation and routes"
```

## Task 9: Build team management forms and pages

**Files:**
- Create: `src/components/planning/team-form.tsx`
- Create: `src/components/planning/team-members-form.tsx`
- Create: `src/app/(app)/planning/page.tsx`
- Create: `src/app/(app)/planning/teams/page.tsx`
- Create: `src/app/(app)/planning/teams/[teamId]/page.tsx`
- Create: `tests/unit/planning-team-form.test.tsx`
- Create: `tests/unit/planning-pages.test.tsx`

- [ ] **Step 1: Write failing form tests**

Assert accessible labels for name, description, sprint length, member role, and daily capacity; pending buttons; safe error rendering with trace ID; and successful `router.push('/planning/teams/<id>')` for create.

- [ ] **Step 2: Implement `TeamForm`**

Use `useActionState`, `Input`, `Textarea`, `Select`, `Button`, `Label`, and `FieldError`. Support `mode: 'create' | 'edit'`, submit normalized values to the corresponding action, show `Creating…`/`Saving…`, and navigate only after a successful create.

- [ ] **Step 3: Implement `TeamMembersForm`**

Render active organization members as rows with a checkbox, planner/member select, and numeric capacity input. Disable role edits for non-planners and allow non-planner members to edit only their own capacity. Submit one normalized `members` array to `setPlanningTeamMembers`.

- [ ] **Step 4: Build the planning landing page**

Use `PageHeader`, cards, and `EmptyState`. Show the user’s active teams, role badge, member count, cadence, and links to `/planning/teams/[teamId]`. Admins receive a “Manage teams” action.

- [ ] **Step 5: Build list/create and detail pages**

`/planning/teams` calls `listPlanningTeams({ includeArchived: true })` and renders creation only for admins. The detail page awaits `params: Promise<{ teamId: string }>`, calls `requirePlanningTeamAccess`, calls `listPlanningTeamCandidates(teamId)` only for admins/planners, and uses `notFound()` for unavailable teams. It renders team settings, membership management, and an admin-only archive action.

- [ ] **Step 6: Run component/page tests**

Run: `npm test -- tests/unit/planning-team-form.test.tsx tests/unit/planning-pages.test.tsx`

Expected: PASS.

- [ ] **Step 7: Run accessibility-focused lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/planning 'src/app/(app)/planning' tests/unit/planning-team-form.test.tsx tests/unit/planning-pages.test.tsx
git commit -m "feat: add planning team management interface"
```

## Task 10: Add acceptance coverage and rollout documentation

**Files:**
- Create: `tests/e2e/planning-teams.spec.ts`
- Modify: `docs/operations/feature-flags.md`
- Modify: `README.md`

- [ ] **Step 1: Write the end-to-end acceptance test**

Use the seeded admin and employee accounts. Cover: admin sees Planning, creates a uniquely named team, adds the seeded employee as member, edits cadence, and sees the saved team. Then sign in as the employee and prove the team is visible but archive/team-membership controls are absent. Use role/name-based locators and no arbitrary timeouts.

- [ ] **Step 2: Run the focused E2E test**

Run: `npx playwright test tests/e2e/planning-teams.spec.ts --project=chromium`

Expected: PASS. If it fails, correct only deterministic selectors or setup defects exposed by the acceptance test; do not weaken assertions.

- [ ] **Step 3: Document rollout controls**

Add a `native_sprint_planning` section documenting the three seeded environments, fail-closed behavior, the exact organization override fields, review/expiry ownership, and the rollback action: disable the flag without dropping planning data.

- [ ] **Step 4: Update the README structure and feature status**

Add Planning to the feature list as a feature-flagged first increment and add `src/modules/planning-teams/` to the project-structure explanation. State explicitly that backlog/sprints/insights follow in subsequent increments.

- [ ] **Step 5: Run the complete verification sequence**

Run in order:

```bash
npm run db:reset
npm run db:test
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test tests/e2e/planning-teams.spec.ts --project=chromium
```

Expected: every command exits 0. Record test counts in the completion handoff.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/planning-teams.spec.ts docs/operations/feature-flags.md README.md
git commit -m "test: verify planning team foundation"
```

## Completion checkpoint

Before planning Increment 2, verify:

- The worktree is clean.
- Local Supabase reset, pgTAP, format, lint, typecheck, unit tests, production build, and focused E2E all pass.
- Development shows Planning for both seeded roles.
- Staging and production remain fail-closed until explicitly enabled.
- Admin, planner, member, unrelated employee, and cross-organization access paths are covered.
- No work-item hierarchy or sprint lifecycle behavior has leaked into this increment.
