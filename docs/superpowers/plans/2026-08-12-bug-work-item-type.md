# Bug Work Item Type (sibling of User Story)

## Context

The native, Azure-DevOps-inspired sprint planning feature currently supports
a fixed Epic → Feature → User Story → Task hierarchy
(`docs/superpowers/plans/2026-08-12-work-item-hierarchy-and-backlog.md`,
already shipped). This plan adds the next Azure DevOps concept the user
picked: a **Bug** work item type. Azure Boards treats a Bug as a distinct
work item with its own fields (repro steps, severity) that, in the default
Agile process template, sits at the same hierarchy level as a User Story.

The user confirmed: **Bug is a child of Feature, exactly like User Story, and
can itself have Task children.** This is the closest match to Azure DevOps'
default process template, and it composes cleanly with the existing
rank/estimate machinery — ranking is already scoped by `work_item_type`, so
Stories and Bugs under the same Feature rank independently with no changes
to the ranking functions.

## Goal

Let a planning team file a Bug under any Feature (with repro steps,
severity, and an optional found-in-build note), break it down into Tasks
exactly like a User Story, and view/edit those bug-specific fields both in
the backlog tree and on the task detail page.

## Architecture

`work_item_type` gains a `'bug'` value. Three new nullable `tasks` columns
(`repro_steps`, `severity`, `found_in_build`) are meaningful only for bugs,
enforced by a type-gated `CHECK` constraint mirroring the existing
`tasks_hierarchy_requires_team_check` pattern. The hierarchy trigger gains
one new branch (bug ⇒ parent must be a feature) and one existing branch
gains a second valid parent type (task ⇒ parent must be a user_story **or**
a bug). Estimate exclusivity needs no constraint change: the existing check
is keyed on `work_item_type = 'task'` vs. not, and a bug is not a task, so
it already lands in the "gets story points, no hours" bucket. The three new
columns are ordinary fields — no cross-field invariant like
`remaining_hours <= original_hours` — so they get a plain grant to
`authenticated` gated by the existing `tasks_update_planning_team_member`
RLS policy, not a new `SECURITY DEFINER` RPC.

**Tech stack:** unchanged — Next.js 16 App Router/Server Actions, strict
TypeScript, Supabase/PostgreSQL + pgTAP + RLS, Zod 4, Vitest/Testing
Library, Playwright.

## Scope boundary

Covers filing a bug, its repro/severity/build fields (create + a dedicated
edit dialog), the hierarchy/rank consequences of a new sibling type at the
User Story level, and a read-only bug-details card on the task detail page.
Does not touch sprints, boards, or any other increment-3+ concept. Does not
add a distinct `bug_severity` enum — severity reuses the existing 4-value
`task_priority` enum, since Azure DevOps' Critical/High/Medium/Low severity
scale maps directly onto it and a second near-identical enum would be
schema sprawl for no behavioral gain.

## Non-negotiable contracts

1. Cycles remain structurally impossible: the hierarchy trigger, not
   application code, is the only thing that decides valid parent/child type
   pairs, exactly as for the existing four types.
2. Every new/changed column gets an explicit, minimal grant, named in the
   migration. `repro_steps`/`severity`/`found_in_build` are grantable
   directly (no `SECURITY DEFINER` indirection needed) because none of them
   participate in a cross-field invariant that a malicious direct write
   could violate.
3. `create_work_item`'s three new params are appended at the end of the
   parameter list with `default null` — Postgres requires every parameter
   after the first one with a default to also have one, the exact rule that
   forced a parameter reorder during the previous increment.
4. `ALTER TYPE ... ADD VALUE` must be its own statement, ideally its own
   early step in the migration, before any `CHECK` constraint or trigger
   body references `'bug'` — using a brand-new enum label in the same
   transaction that adds it can raise "unsafe use of new value of enum
   type" on some Postgres versions. If `db:reset` hits that error, split
   into two migration files (enum-only, then everything else) rather than
   fight it.

## File map

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/202608130001_bug_work_item_type.sql` | Enum value, columns, constraint, hierarchy trigger update, `create_work_item` params, grants |
| `supabase/tests/work_item_hierarchy_rls.test.sql` | Extended: bug schema/columns, hierarchy matrix, grants, `create_work_item` with bug fields |
| `src/lib/supabase/database.types.ts` | Regenerated after the migration |
| `src/modules/backlog/schemas.ts` | `workItemTypeSchema` gains `'bug'`; create/update schemas gain the three fields, gated to `type === 'bug'` |
| `src/modules/backlog/queries.ts` | `BacklogWorkItem` gains the three fields; `PARENT_TYPE_BY_CHILD` becomes multi-type per child (`task` → `['user_story', 'bug']`) |
| `src/modules/backlog/actions.ts` | `createWorkItem`/`updateWorkItemPlanningFields` pass the three fields through |
| `src/components/planning/backlog/backlog-row.tsx` | Bug label/badge; "add child" becomes a dropdown on rows with two legal child types (features) |
| `src/components/planning/backlog/create-work-item-form.tsx` | Bug fields (repro steps/severity/found-in-build) shown when `type === 'bug'` |
| `src/components/planning/backlog/bug-details-dialog.tsx` | New: post-creation edit dialog for the three bug fields |
| `src/app/(app)/tasks/[taskId]/page.tsx` | New read-only "Bug details" card, shown when `work_item_type === 'bug'` |
| `tests/unit/backlog-*.test.ts(x)`, `tests/unit/bug-details-dialog.test.tsx` | Schema, query, action, and component coverage |
| `tests/e2e/planning-backlog.spec.ts` | Extended with a bug-creation + task-under-bug case |

## Task sequence

1. **Specify the database contract (pgTAP, red).** Extend
   `supabase/tests/work_item_hierarchy_rls.test.sql`: `has_column` for the
   three new columns; hierarchy matrix cases (bug valid under feature,
   invalid under epic/user_story/task; task valid under both user_story and
   bug); column-privilege assertions for the new grants; a
   `create_work_item` case that sets bug fields; the type-gated `CHECK`
   constraint (`lives_ok`/`throws_ok`). Run red. Commit
   `test: specify bug work item type database contract`.
2. **Implement the migration (green).** Add the enum value, columns,
   constraint, hierarchy trigger update, and `create_work_item` params and
   grants per the architecture above. `npm run db:reset && npm run db:test`
   green. Commit `feat: add bug work item type to the database`.
3. **Regenerate types.** `npm run typecheck` clean. Commit
   `chore: generate bug work item type database types`.
4. **Backlog schemas.** `workItemTypeSchema`, create/update schema
   additions, `superRefine` gating. Commit
   `feat: validate bug work item fields`.
5. **Backlog queries.** `BacklogWorkItem` fields, multi-parent-type
   `PARENT_TYPE_BY_CHILD`/`listValidParentCandidates`. Commit
   `feat: support bugs in backlog hierarchy queries`.
6. **Backlog actions.** `createWorkItem`/`updateWorkItemPlanningFields`
   pass the three fields through. Commit
   `feat: create and edit bug work items`.
7. **Backlog row UI.** Bug label/badge, dropdown "add child" for rows with
   two legal child types. Commit
   `feat: show bugs in the backlog tree with a two-option add-child menu`.
8. **Create + edit UI.** Bug fields on the create form; new
   `bug-details-dialog.tsx` for post-creation editing. Commit
   `feat: add bug filing and detail editing to the backlog`.
9. **Task detail page.** Read-only bug-details card. Commit
   `feat: show bug details on the task detail page`.
10. **Acceptance coverage, full verification, docs.** Extend
    `tests/e2e/planning-backlog.spec.ts` with a bug-creation and
    task-under-bug case. Run `npm run db:reset && npm run db:test`, then
    `npm run verify`, then the focused e2e spec, then a manual Playwright
    smoke test against local Supabase seed data (same throwaway-spec
    workflow used throughout the previous increment). Update `README.md`.
    Commit `test: verify bug work item type`.

## Verification

- After task 2 and again after task 10: `npm run db:reset && npm run db:test`.
- After every task: focused `npm test -- <new/changed test file>`, then
  full `npm test` before each commit.
- Before the final commit: `npm run verify` (format, lint, typecheck, unit
  suite, production build) and `npx playwright test
  tests/e2e/planning-backlog.spec.ts --project="Desktop Chrome"`.
- Manual smoke test: file a bug under a feature via the dropdown, confirm
  both User Story and Bug options appear; add a task under the bug; edit
  repro steps/severity/found-in-build via the new dialog; confirm the task
  detail page's Bug details card reflects it.

## Completion checkpoint

- Full local verification suite green, worktree clean.
- A bug can be filed under any feature, ranked independently from that
  feature's user stories, broken down into tasks, and edited post-creation
  — all gated the same way (`is_planning_team_member`) as every other
  backlog write.
- No behavior of the existing four work item types changed.
