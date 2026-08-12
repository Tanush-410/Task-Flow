# Work-Item Hierarchy, Estimates, and Ranked Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `tasks` table into the canonical Epic → Feature → User Story → Task work-item table with database-provable hierarchy integrity, a fractional-rank ranked backlog, planning-team-scoped RLS visibility, and a collapsible/keyboard-accessible backlog UI at `/planning/teams/[teamId]/backlog`.

**Architecture:** One additive migration extends `tasks` with nullable planning columns and a `work_item_type` enum. Hierarchy correctness (no cycles, correct parent type, matching org/team) is enforced by a single `BEFORE INSERT OR UPDATE` trigger on `tasks`. Every write that touches a structurally sensitive column (`work_item_type`, `parent_task_id`, `planning_team_id`, `backlog_rank`, `original_hours`) goes exclusively through `SECURITY DEFINER` RPC functions modeled on the existing `replace_planning_team_members`/`archive_planning_team`; `authenticated` receives no column grants for those five columns. Ordinary fields (`title`, `description`, `priority`, `story_points`, `remaining_hours`) stay reachable through a plain grant + RLS policy pair, mirroring the existing `tasks` pattern. A new `backlog` module owns schemas/queries/actions and composes the existing `members`, `tasks`, `assignments`, and `notifications` modules rather than duplicating their logic.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19, strict TypeScript, Supabase/PostgreSQL with pgTAP and RLS, Zod 4, Vitest/Testing Library, Playwright, `@dnd-kit/core`/`@dnd-kit/utilities`, Tailwind CSS/shadcn primitives.

---

## Scope boundary

This is Plan 2 of 8 from the approved `docs/superpowers/specs/2026-08-10-native-sprint-planning-design.md`. Plan 1 (planning teams) is already merged. This plan covers §4.1 (task extensions), the ranking half of §9, the backlog half of §6, and the backlog half of §7/§8/§11. It does **not** touch `sprints`, `sprint_capacity`, `releases`, `planning_risks`, `sprint_reviews`/`sprint_retrospectives`, board state derivation, burndown/velocity, or the roadmap — those tables don't exist yet. `sprint_id`/`release_id` columns on `tasks` are deferred to Plans 3 and 7. Bulk selection for "move to sprint" is deferred entirely.

## Non-negotiable contracts

- Cycles are structurally impossible: the hierarchy trigger only permits `child.work_item_type` to be exactly one step below `parent.work_item_type` (`epic → feature → user_story → task`); an `epic` may never have a parent.
- `remaining_hours <= original_hours` holds unconditionally. `original_hours` is never granted to `authenticated` — the only writers are `create_work_item` and `reestimate_work_item_hours`, both `SECURITY DEFINER`.
- Estimate mutual exclusivity (`story_points` XOR hour fields, by type) and non-negativity are single-row `CHECK` constraints.
- Every new/changed column gets an explicit, minimal column-scoped grant. `work_item_type`, `parent_task_id`, `planning_team_id`, `backlog_rank`, `original_hours` get **no** grant to `authenticated` at all.
- `tasks` SELECT/UPDATE visibility is extended, never replaced — new permissive policies are added alongside the existing ones so non-planning task visibility is unchanged.
- Ranking uses a real fractional/lexicographic base62 algorithm, not floating point, with a bounded (one retry), provable rebalance path.
- Reparenting and rank changes are transactional Postgres functions (`security definer`, `set search_path = ''`, `for update` row locks, errcodes `23514`/`42501`/`22023`) that check organization/team authorization internally.
- Reparenting across planning teams cascades `planning_team_id` (never `organization_id`) to every transitive descendant in one transaction, gated behind an explicit `includeDescendants` flag whenever the target has descendants.

## Fractional ranking algorithm

Alphabet: base62 `0-9A-Za-z` (ASCII order matches `COLLATE "C"` Postgres comparison and JS default string comparison — `backlog_rank` is compared/indexed with `COLLATE "C"` explicitly). Ranks are only compared within `(planning_team_id, coalesce(parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid), work_item_type)` — `work_item_type` is included so a top-level `epic` and a bare hierarchy-less `task` (both `parent_task_id = null`) don't collide in the same bucket.

`rankBetween(lower, upper)` is implemented identically in `src/modules/backlog/rank.ts` (pure TS) and `public.backlog_rank_midpoint(text, text)` (server-authoritative `plpgsql`). A missing `lower` behaves as all-`0` digits; a missing `upper` behaves as all-`62` ("infinity") digits. Walk positions until a digit gap ≥ 2 is found (take the midpoint digit), gap = 1 (descend a level, treat further comparison as unbounded), or gap = 0 (descend, continue matching prefix), up to `MAX_RANK_LENGTH = 30`; beyond that, return/raise `RANK_PRECISION_EXHAUSTED` (`22023`). `rankBetween(null, null) = "V"` (mid-alphabet) for the first item in an empty scope.

Rebalance is triggered by `22023` (precision exhausted) or `23505` (unique-index race) from `assign_backlog_rank`. The server action calls `rebalance_backlog_siblings(teamId, parentTaskId, workItemType)`, which locks the sibling set `for update` and assigns evenly spaced canonical ranks (`base62Encode(round((i+1) * 62^k / (n+1)), width=k)` for the smallest `k` with `62^k > n`), then retries `assign_backlog_rank` exactly once. A second failure returns `RANK_CONFLICT` rather than looping.

## File map

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/202608120001_work_item_hierarchy_and_backlog.sql` | Enum, columns, checks, hierarchy trigger, indexes, RPCs, grants, RLS |
| `supabase/tests/work_item_hierarchy_rls.test.sql` | Schema, constraint, RPC, and RLS contract |
| `src/lib/supabase/database.types.ts` | Regenerated Supabase contract |
| `src/modules/backlog/rank.ts` | Pure `rankBetween`/`rebalancePlan`, client-optimistic mirror of the SQL algorithm |
| `src/modules/backlog/schemas.ts` | Work-item and backlog input validation |
| `src/modules/backlog/queries.ts` | `listBacklogHierarchy`, `getWorkItemDescendantCount`, `listValidParentCandidates` |
| `src/modules/backlog/actions.ts` | `createWorkItem`, `updateWorkItemPlanningFields`, `moveWorkItem`, `rankBacklogItem` |
| `src/components/ui/collapsible.tsx` | Shared expand/collapse primitive |
| `src/components/planning/backlog/backlog-tree.tsx` | Client orchestrator: state, filters, DnD, keyboard rank |
| `src/components/planning/backlog/backlog-row.tsx` | One row: expand toggle, type badge, inline estimate, rank buttons, drag handle |
| `src/components/planning/backlog/backlog-filters.tsx` | Assignee/type/estimate-state/text filters |
| `src/components/planning/backlog/create-work-item-form.tsx` | Creation form scoped to legal child types |
| `src/components/planning/backlog/move-work-item-dialog.tsx` | Reparent/team-reassign dialog with descendant preview |
| `src/app/(app)/planning/teams/[teamId]/backlog/page.tsx` | Server Component: access check, initial tree fetch |
| `tests/unit/backlog-rank.test.ts` | Rank algorithm contract |
| `tests/unit/backlog-schemas.test.ts` | Validation contract |
| `tests/unit/backlog-queries.test.ts` | Tree-building and filtering contract |
| `tests/unit/backlog-actions.test.ts` | Action auth, RPC dispatch, safe-error, rebalance-retry contract |
| `tests/unit/backlog-tree.test.tsx` | Tree rendering, keyboard rank, filters |
| `tests/unit/create-work-item-form.test.tsx` | Creation form contract |
| `tests/unit/move-work-item-dialog.test.tsx` | Descendant preview and gating contract |
| `tests/e2e/planning-backlog.spec.ts` | Hierarchy build, estimate, rank, cross-team move, visibility acceptance |
| `README.md` | Delivered-scope update |

---

## Task 1: Specify the database hierarchy, rank, and RLS contract

**Files:**
- Create: `supabase/tests/work_item_hierarchy_rls.test.sql`

- [ ] **Step 1: Write the failing pgTAP contract**

Structure as `begin; select plan(N); ...; select * from finish(); rollback;`, matching `supabase/tests/sprint_foundation_rls.test.sql`. Cover:

- `has_type`/`has_column` for `work_item_type` and the seven new `tasks` columns.
- `has_function` for `is_task_planning_team_member(uuid)`, `backlog_rank_midpoint(text,text)`, `create_work_item(...)`, `assign_backlog_rank(uuid,uuid,uuid)`, `rebalance_backlog_siblings(uuid,uuid,work_item_type)`, `count_work_item_descendants(uuid)`, `move_work_item(uuid,uuid,boolean)`, `reestimate_work_item_hours(uuid,numeric,numeric)`.
- `throws_ok(...'23514'...)` for every invalid hierarchy combination: feature-under-task, user_story-under-epic, task-under-feature, epic-with-parent, feature-with-null-parent, cross-org parent, cross-team parent.
- `lives_ok(...)` for every valid combination, including a top-level bare task (no team, no parent) still working exactly as before.
- `throws_ok` for `story_points` on a `task`, hour fields on a non-`task`, negative estimates, and `remaining_hours > original_hours` in one statement.
- `ok(not has_column_privilege('authenticated','public.tasks','original_hours','update'))` and the same for `parent_task_id`, `planning_team_id`, `backlog_rank`, `work_item_type`.
- `ok(has_column_privilege('authenticated','public.tasks','story_points','update'))` and the same for `remaining_hours`.
- Rank ordering/uniqueness: insert three siblings via `assign_backlog_rank`, assert strict ordering; assert a duplicate-rank insert violates `tasks_backlog_rank_unique_idx`.
- `is(count_work_item_descendants(...), N, ...)` against a three-level fixture.
- `move_work_item` cross-team rejection without `include_descendants` when the target has children; success when `include_descendants = true`, with every descendant's `planning_team_id` updated.
- RLS: a planning-team member (not admin, not creator, not assignee) can `select` a team-owned `user_story`/`task`; an org member outside that team cannot.

- [ ] **Step 2: Run and confirm red**

Run: `npm run db:start && npm run db:test`

Expected: FAIL — type/columns/functions don't exist yet.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/work_item_hierarchy_rls.test.sql
git commit -m "test: specify work-item hierarchy and backlog database contract"
```

## Task 2: Implement the migration

**Files:**
- Create: `supabase/migrations/202608120001_work_item_hierarchy_and_backlog.sql`
- Modify: `package.json`

- [ ] **Step 1: Add the enum and columns**

```sql
create type public.work_item_type as enum ('epic', 'feature', 'user_story', 'task');

alter table public.tasks
  add column work_item_type public.work_item_type not null default 'task',
  add column parent_task_id uuid references public.tasks (id) on delete restrict,
  add column planning_team_id uuid references public.planning_teams (id) on delete set null,
  add column story_points numeric(6,2),
  add column original_hours numeric(8,2),
  add column remaining_hours numeric(8,2),
  add column backlog_rank text;
```

- [ ] **Step 2: Add named single-row CHECK constraints**

Non-negativity on `story_points`/`original_hours`/`remaining_hours`; `remaining_hours <= original_hours` when both set; estimate exclusivity (`work_item_type = 'task' and story_points is null) or (work_item_type <> 'task' and original_hours is null and remaining_hours is null)`; `work_item_type = 'task' or planning_team_id is not null`.

- [ ] **Step 3: Add the hierarchy trigger**

`public.validate_work_item_hierarchy()` — `plpgsql security definer set search_path = ''`, `before insert or update of work_item_type, parent_task_id, planning_team_id, organization_id on tasks`. `epic` ⇒ parent must be null. `feature`/`user_story` ⇒ parent required, must be exactly one level up, same `organization_id`, same `planning_team_id` (`errcode 23514` otherwise). `task` ⇒ parent optional; if present must be a `user_story` in the same org/team.

- [ ] **Step 4: Add indexes**

`(organization_id, planning_team_id, backlog_rank)`, `(parent_task_id)`, `(organization_id, work_item_type)`, and:

```sql
create unique index tasks_backlog_rank_unique_idx on public.tasks (
  planning_team_id,
  coalesce(parent_task_id, '00000000-0000-0000-0000-000000000000'::uuid),
  work_item_type,
  backlog_rank collate "C"
) where planning_team_id is not null and backlog_rank is not null;
```

- [ ] **Step 5: Add `is_task_planning_team_member` and `backlog_rank_midpoint`**

`is_task_planning_team_member(target_task_id uuid) returns boolean` — `sql stable security definer set search_path = ''`: `exists (select 1 from public.tasks t where t.id = target_task_id and t.planning_team_id is not null and public.is_planning_team_member(t.planning_team_id))`.

`backlog_rank_midpoint(lower_rank text, upper_rank text) returns text` — pure `plpgsql`, implements the algorithm above; raises `22023` on precision exhaustion.

- [ ] **Step 6: Add `create_work_item`**

Validates `is_planning_team_member(target_planning_team_id)` (`42501`); if a parent is given, locks it `for update` and requires its `planning_team_id` to equal `target_planning_team_id` exactly (`23514`); inserts with `status = 'published'`, `published_at = now()`, `created_by = auth.uid()`; computes append-at-end rank via `backlog_rank_midpoint(currentMaxInScope, null)`. Returns the new `id`.

- [ ] **Step 7: Add `assign_backlog_rank`**

Locks the target and both neighbor rows (if given) `for update`; requires `is_task_planning_team_member(target_task_id)`; requires any given neighbor to share the target's `(planning_team_id, parent_task_id, work_item_type)` scope (`23514`) and, if both given, `before.backlog_rank < after.backlog_rank` (`23514`); writes and returns the midpoint; surfaces `22023` on precision exhaustion.

- [ ] **Step 8: Add `rebalance_backlog_siblings`**

Requires `is_planning_team_member(target_team_id)`; locks the full sibling set `for update order by backlog_rank`; reassigns evenly spaced canonical ranks; returns the count rebalanced.

- [ ] **Step 9: Add `count_work_item_descendants` and `move_work_item`**

`count_work_item_descendants` — `stable`, requires `is_task_planning_team_member`, recursive CTE, read-only preview.

`move_work_item(target_task_id, new_parent_task_id, include_descendants boolean) returns integer` — locks target `for update`; resolves the new team from `new_parent_task_id`; requires `is_planning_team_member` on both current and new teams; if the new team differs from the current one, locks every transitive descendant `for update` via a bounded (2000-row, else `22023`) recursive CTE and requires `include_descendants = true` whenever that count is nonzero (`23514` otherwise); updates `parent_task_id` (re-firing the hierarchy trigger) and, when cascading, every descendant's `planning_team_id`; repositions the target at the end of its new sibling scope. Returns `1 + cascaded count`.

- [ ] **Step 10: Add `reestimate_work_item_hours` and extend the activity trigger**

`reestimate_work_item_hours(target_task_id, new_original_hours, new_remaining_hours) returns boolean` — locks the row `for update`; requires `is_task_planning_team_member`; requires `work_item_type = 'task'` (`23514`); requires `new_original_hours >= new_remaining_hours >= 0` (`22023`); is the only writer of `original_hours`.

`create or replace` the existing `public.log_task_activity_event()` (already evolved once, in `202608010014`) with one new branch: when `old.original_hours is distinct from new.original_hours`, set the summary to `'Task hours re-estimated'` instead of the generic update summary.

- [ ] **Step 11: Grants**

```sql
grant update (story_points) on public.tasks to authenticated;
grant update (remaining_hours) on public.tasks to authenticated;
-- no grant to authenticated on: work_item_type, parent_task_id, planning_team_id,
-- backlog_rank, original_hours — every write to these five columns happens inside
-- a security-definer function above, which writes as the function owner.

revoke all on function public.is_task_planning_team_member(uuid) from public, anon, authenticated;
revoke all on function public.backlog_rank_midpoint(text, text) from public, anon, authenticated;
revoke all on function public.create_work_item(...) from public, anon, authenticated;
revoke all on function public.assign_backlog_rank(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.rebalance_backlog_siblings(uuid, uuid, public.work_item_type) from public, anon, authenticated;
revoke all on function public.count_work_item_descendants(uuid) from public, anon, authenticated;
revoke all on function public.move_work_item(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.reestimate_work_item_hours(uuid, numeric, numeric) from public, anon, authenticated;

grant execute on function public.is_task_planning_team_member(uuid) to authenticated;
grant execute on function public.create_work_item(...) to authenticated;
grant execute on function public.assign_backlog_rank(uuid, uuid, uuid) to authenticated;
grant execute on function public.rebalance_backlog_siblings(uuid, uuid, public.work_item_type) to authenticated;
grant execute on function public.count_work_item_descendants(uuid) to authenticated;
grant execute on function public.move_work_item(uuid, uuid, boolean) to authenticated;
grant execute on function public.reestimate_work_item_hours(uuid, numeric, numeric) to authenticated;
-- backlog_rank_midpoint stays internal (service-role-callable only if ever needed); not
-- granted to authenticated since callers only ever reach it indirectly through the RPCs above.
```

- [ ] **Step 12: RLS — additive policies only**

```sql
create policy tasks_select_planning_team_member
on public.tasks for select to authenticated
using (public.is_task_planning_team_member(id));

create policy tasks_update_planning_team_member
on public.tasks for update to authenticated
using (public.is_task_planning_team_member(id))
with check (public.is_task_planning_team_member(id));

create policy task_activity_view_planning_team_member
on public.task_activity_events for select to authenticated
using (public.is_task_planning_team_member(task_id));
```

Leave every existing `tasks`/`task_activity_events` policy untouched.

- [ ] **Step 13: Register the test file and run**

Add `supabase/tests/work_item_hierarchy_rls.test.sql` to `package.json`'s `db:test` script, after the existing `sprint_foundation_rls.test.sql` entry.

Run: `npm run db:reset && npm run db:test`

Expected: all pgTAP files, including the new one, PASS.

- [ ] **Step 14: Commit**

```bash
git add supabase/migrations/202608120001_work_item_hierarchy_and_backlog.sql package.json
git commit -m "feat: add work-item hierarchy, estimates, and ranked backlog to the database"
```

## Task 3: Regenerate database types

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Create: `tests/unit/backlog-migration.test.ts`

- [ ] **Step 1: Write the failing contract test**

Mirror the existing generated-types contract tests (e.g. `tests/unit/planning-team-queries.test.ts`'s use of generated RPC signatures, or the pattern in the migration text tests used for previous increments): read the migration file as text and assert the hierarchy trigger and every RPC are `security definer`; assert no `grant update` exists for the five protected columns; assert generated `database.types.ts` contains `work_item_type: "epic" | "feature" | "user_story" | "task"` and all seven new `tasks` Row/Insert/Update fields plus the seven RPC `Args`/`Returns` shapes.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-migration.test.ts`

Expected: FAIL — types not yet regenerated.

- [ ] **Step 3: Regenerate and format**

```bash
npx supabase gen types typescript --local > /tmp/database.types.ts
npx prettier --config .prettierrc.json --write /tmp/database.types.ts
cp /tmp/database.types.ts src/lib/supabase/database.types.ts
```

- [ ] **Step 4: Re-run and typecheck**

Run: `npm test -- tests/unit/backlog-migration.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/database.types.ts tests/unit/backlog-migration.test.ts
git commit -m "chore: generate work-item hierarchy database types"
```

## Task 4: Rank algorithm module

**Files:**
- Create: `src/modules/backlog/rank.ts`
- Create: `tests/unit/backlog-rank.test.ts`

- [ ] **Step 1: Write failing unit tests**

Fixed vector table: `rankBetween(null, null) === 'V'`; `rankBetween(null, 'V')`; `rankBetween('V', null)`; adjacent-digit carry (`rankBetween('V','W')` must extend length); a case exceeding `MAX_RANK_LENGTH` returns a `RANK_PRECISION_EXHAUSTED` result rather than throwing; `rebalancePlan(ranks)` produces strictly increasing, distinct canonical ranks for `n = 1, 2, 61, 200`.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-rank.test.ts`

- [ ] **Step 3: Implement `rankBetween` and `rebalancePlan`**

Pure functions, no DB/network dependency, matching the algorithm in this plan's header exactly (same alphabet, same digit-gap walk, same `MAX_RANK_LENGTH`).

- [ ] **Step 4: Re-run and commit**

Run: `npm test -- tests/unit/backlog-rank.test.ts`

```bash
git add src/modules/backlog/rank.ts tests/unit/backlog-rank.test.ts
git commit -m "feat: implement fractional backlog ranking algorithm"
```

## Task 5: Backlog schemas

**Files:**
- Create: `src/modules/backlog/schemas.ts`
- Create: `tests/unit/backlog-schemas.test.ts`

- [ ] **Step 1: Write failing validation tests**

`workItemCreateSchema` (planning team id, optional parent id via `uuidSchema`, type enum, title/description/priority, mutually-exclusive optional `storyPoints` vs. `originalHours`+`remainingHours`); `workItemPlanningFieldsUpdateSchema` (taskId + optional title/description/priority/storyPoints/remainingHours/originalHours, at least one field required); `moveWorkItemSchema` (taskId, newParentTaskId nullable, includeDescendants boolean); `rankBacklogItemSchema` (taskId, beforeTaskId nullable, afterTaskId nullable, refine at least one present).

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-schemas.test.ts`

- [ ] **Step 3: Implement**

Use `uuidSchema` from `@/lib/schemas` throughout — never `z.uuid()`.

- [ ] **Step 4: Re-run and commit**

```bash
git add src/modules/backlog/schemas.ts tests/unit/backlog-schemas.test.ts
git commit -m "feat: validate work-item and backlog inputs"
```

## Task 6: Backlog queries

**Files:**
- Create: `src/modules/backlog/queries.ts`
- Create: `tests/unit/backlog-queries.test.ts`

- [ ] **Step 1: Write failing query tests**

Mock `createServerSupabase`/`requireMembership` per `tests/unit/planning-team-queries.test.ts`'s style. Cover:
- `listBacklogHierarchy(teamId, filters)`: builds a nested tree from flat `tasks` rows (ordered by `parent_task_id, backlog_rank collate "C"`), applies assignee/type/estimate-state/text filters, and preserves ancestor chains (collapsed but present) when filtering matches only a descendant.
- `getWorkItemDescendantCount(taskId)`: wraps the RPC, returns `0` on RPC error rather than throwing.
- `listValidParentCandidates(teamId, childType)`: same-team candidates of the correct parent type, plus other teams the caller belongs to for the cross-team case.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-queries.test.ts`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Re-run, typecheck, and commit**

```bash
npm test -- tests/unit/backlog-queries.test.ts && npm run typecheck
git add src/modules/backlog/queries.ts tests/unit/backlog-queries.test.ts
git commit -m "feat: query the ranked work-item backlog"
```

## Task 7: Backlog actions

**Files:**
- Create: `src/modules/backlog/actions.ts`
- Create: `tests/unit/backlog-actions.test.ts`

- [ ] **Step 1: Write failing action tests**

Mirror `tests/unit/planning-team-actions.test.ts`'s mock-builder pattern. Cover:
- `createWorkItem`: invalid input rejected before any DB call; calls `requireMembership()` then `supabase.rpc('create_work_item', {...})`; maps `42501→WORK_ITEM_FORBIDDEN`, `23514→INVALID_WORK_ITEM`, else `WORK_ITEM_SAVE_FAILED`; `revalidatePath('/planning', 'layout')` on success; never calls `queueTaskNotifications` (no assignees at creation).
- `updateWorkItemPlanningFields`: a patch touching only `title`/`description`/`priority`/`storyPoints`/`remainingHours` does a plain `.from('tasks').update(...)` (relying on RLS + the narrow grants from Task 2) and does **not** call `updateTask` from `src/modules/tasks/actions.ts` (assert via mock/spy that module is never imported for this path); a patch including `originalHours` dispatches to the `reestimate_work_item_hours` RPC instead.
- `moveWorkItem`: calls `move_work_item` RPC directly; maps its `23514` (missing `includeDescendants`) to a field error naming the required flag.
- `rankBacklogItem`: happy path calls `assign_backlog_rank` once; on `22023`/`23505`, calls `rebalance_backlog_siblings` then retries `assign_backlog_rank` exactly once (assert call count is exactly 2); a second failure returns `RANK_CONFLICT`.
- Every action: Zod-parse first, `randomUUID()` traceId, module-level `as const` error objects, generic catch-all, no leaked DB error text.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-actions.test.ts`

- [ ] **Step 3: Implement**

`createWorkItem`, `updateWorkItemPlanningFields` (including internal re-estimate dispatch), `moveWorkItem`, `rankBacklogItem`.

- [ ] **Step 4: Re-run, typecheck, and commit**

```bash
npm test -- tests/unit/backlog-actions.test.ts && npm run typecheck
git add src/modules/backlog/actions.ts tests/unit/backlog-actions.test.ts
git commit -m "feat: add work-item creation, estimation, move, and rank actions"
```

## Task 8: Collapsible primitive, backlog route, read-only tree, filters

**Files:**
- Create: `src/components/ui/collapsible.tsx`
- Create: `src/components/planning/backlog/backlog-tree.tsx`
- Create: `src/components/planning/backlog/backlog-row.tsx`
- Create: `src/components/planning/backlog/backlog-filters.tsx`
- Create: `src/app/(app)/planning/teams/[teamId]/backlog/page.tsx`
- Modify: `src/app/(app)/planning/teams/[teamId]/page.tsx`
- Create: `tests/unit/backlog-tree.test.tsx`

- [ ] **Step 1: Write failing component tests**

Renders a nested tree with correct indentation/type badges; expand/collapse persists per-node state; filters trigger a re-fetch/re-render; empty state when a team has no work items; accessible roles/names on every interactive element.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-tree.test.tsx`

- [ ] **Step 3: Implement**

`Collapsible` wraps `radix-ui`'s primitive (thin-wrapper style matching `src/components/ui/dialog.tsx`). Build the tree/row/filter components read-only (no mutation wiring yet). Server Component route: `requirePlanningTeamAccess(teamId)`, parse filter `searchParams`, call `listBacklogHierarchy`, render the tree. Add a "View backlog" link from the team settings page.

- [ ] **Step 4: Re-run, lint, typecheck, and commit**

```bash
npm test -- tests/unit/backlog-tree.test.tsx && npm run lint && npm run typecheck
git add src/components/ui/collapsible.tsx src/components/planning/backlog "src/app/(app)/planning/teams" tests/unit/backlog-tree.test.tsx
git commit -m "feat: render the ranked backlog tree"
```

## Task 9: Inline estimate editing, keyboard rank, drag-and-drop

**Files:**
- Modify: `src/components/planning/backlog/backlog-tree.tsx`, `src/components/planning/backlog/backlog-row.tsx`
- Create: `src/components/planning/backlog/estimate-input.tsx`
- Modify: `tests/unit/backlog-tree.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Clicking an estimate value swaps to an editable input, submits `updateWorkItemPlanningFields`, optimistically reflects the new value, reverts on failure with a visible error (same shape as `task-board.tsx`'s revert-on-failure pattern). "Move up"/"Move down" buttons compute `beforeTaskId`/`afterTaskId` from the current sibling order and call `rankBacklogItem`, are keyboard-reachable, disabled at sibling-group edges. Drag start/end via `DndContext`/`useDraggable`/`useDroppable` (per-sibling-slot droppables) produces the same `rankBacklogItem` call as the keyboard action, with optimistic reorder + revert-on-failure.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/backlog-tree.test.tsx`

- [ ] **Step 3: Implement**

Reuse the `task-board.tsx` `PointerSensor`/optimistic-then-revert pattern. Import `rankBetween` from `src/modules/backlog/rank.ts` only for instant optimistic positioning feedback — the server call remains the source of truth.

- [ ] **Step 4: Re-run, lint, typecheck, and commit**

```bash
npm test -- tests/unit/backlog-tree.test.tsx && npm run lint && npm run typecheck
git add src/components/planning/backlog tests/unit/backlog-tree.test.tsx
git commit -m "feat: add inline estimate editing and keyboard/drag backlog ranking"
```

## Task 10: Create-work-item UI

**Files:**
- Create: `src/components/planning/backlog/create-work-item-form.tsx`
- Create: `tests/unit/create-work-item-form.test.tsx`
- Modify: `src/components/planning/backlog/backlog-tree.tsx`, `backlog-row.tsx`

- [ ] **Step 1: Write failing form tests**

Form only offers the one legal child type for the clicked context (top-level → Epic only; under an Epic → Feature only; under a Feature → User Story only; under a User Story → Task only); submits `createWorkItem`; accessible labels; pending/disabled state; safe error + trace ID on failure.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/create-work-item-form.test.tsx`

- [ ] **Step 3: Implement**

Add "Add child" entry points to `backlog-tree.tsx`/`backlog-row.tsx` scoped to valid child types.

- [ ] **Step 4: Re-run and commit**

```bash
npm test -- tests/unit/create-work-item-form.test.tsx
git add src/components/planning/backlog tests/unit/create-work-item-form.test.tsx
git commit -m "feat: add work-item creation to the backlog"
```

## Task 11: Move/reparent UI with descendant preview

**Files:**
- Create: `src/components/planning/backlog/move-work-item-dialog.tsx`
- Create: `tests/unit/move-work-item-dialog.test.tsx`
- Modify: `src/modules/backlog/queries.ts`, `tests/unit/backlog-queries.test.ts` (if `listValidParentCandidates` needs extending for this UI)

- [ ] **Step 1: Write failing dialog tests**

Opening the dialog for an item with descendants calls `getWorkItemDescendantCount` and displays the count before submission. Picking a new parent from a different planning team makes the "include descendants" checkbox required (and forces it checked) whenever the count is `> 0`; same-team reparenting never shows the checkbox. Submits `moveWorkItem`; safe error rendering.

- [ ] **Step 2: Run and confirm red**

Run: `npm test -- tests/unit/move-work-item-dialog.test.tsx`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Re-run, lint, typecheck, and commit**

```bash
npm test -- tests/unit/move-work-item-dialog.test.tsx && npm run lint && npm run typecheck
git add src/components/planning/backlog/move-work-item-dialog.tsx tests/unit/move-work-item-dialog.test.tsx src/modules/backlog/queries.ts tests/unit/backlog-queries.test.ts
git commit -m "feat: add work-item reparenting and team reassignment with descendant preview"
```

## Task 12: Acceptance coverage, full verification, and docs

**Files:**
- Create: `tests/e2e/planning-backlog.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the browser acceptance test**

Using seeded admin/employee accounts and a planning team created at test start (via the existing Increment 1 flow): build a full Epic→Feature→User Story→Task hierarchy through the UI; set story points on the Epic/Feature/Story and hours on the Task; reorder two sibling Stories via the keyboard "Move up" control and confirm the order persists after reload; attempt a cross-team move of a Feature with children without checking "include descendants" (see it rejected with the descendant-count preview shown), then complete it with the checkbox checked; sign in as an org member who is not a member of the planning team and confirm they cannot see the team's backlog route or any of its work items.

- [ ] **Step 2: Run the focused e2e test**

Run: `npx playwright test tests/e2e/planning-backlog.spec.ts --project="Desktop Chrome"`

Expected: PASS.

- [ ] **Step 3: Update the README**

Mark backlog/hierarchy as delivered under `native_sprint_planning`; note `src/modules/backlog/` in the project-structure section; state that sprints/board/insights/risks/releases remain future increments.

- [ ] **Step 4: Run full verification**

Run: `npm run db:reset && npm run db:test && npm run verify && npx playwright test tests/e2e/planning-backlog.spec.ts --project="Desktop Chrome"`

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/planning-backlog.spec.ts README.md
git commit -m "test: verify work-item hierarchy, estimates, and ranked backlog"
```

## Done definition

This plan is complete only when all of the following hold:

- Cycles are structurally impossible; every valid/invalid hierarchy combination is enforced by the database, not just the app.
- `authenticated` has zero grants on `work_item_type`, `parent_task_id`, `planning_team_id`, `backlog_rank`, `original_hours`.
- `remaining_hours <= original_hours` holds unconditionally; estimate fields are mutually exclusive by work-item type.
- Backlog ranking is fractional/lexicographic with a working, bounded rebalance path.
- Reparenting across planning teams always requires and correctly previews `includeDescendants` when the target has descendants; same-team reparenting never asks for it.
- An org member outside a planning team cannot see that team's work items through the backlog route, search, or activity events.
- Existing non-planning task creation, editing, board, and dashboard behavior is unchanged.
- Database, unit, production-build, and browser gates pass.
- No `sprint_id`/`release_id` column, `sprints`/`releases` table, board, burndown, risk, or retrospective behavior has leaked into this increment.
