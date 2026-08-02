# Core Task Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the production-shaped task workflow on top of the verified foundation: task creation, assignment, status progression, delay reasons, publication, acknowledgements, activity history, employee-facing task views, and the Phase 1 release gate.

**Architecture:** This plan extends the existing Next.js App Router shell, the current membership and invitation foundation, and the generated Supabase database types in `src/lib/supabase/database.types.ts`. Server Actions remain the primary mutation surface, route handlers stay limited to callbacks and external entry points, and row-level security remains the final data boundary.

**Current app structure:** The workspace already has the protected shell and role-aware navigation in place at `src/components/app-shell.tsx` and `src/modules/auth/navigation.ts`, plus the authenticated route groups in `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, and `src/app/(app)/my-day/page.tsx`. This plan fills in the task-specific routes and module boundaries that the shell already points to, including `/tasks`, `/my-tasks`, and task detail pages.

**Current schema anchor:** The generated foundation types currently cover `organizations`, `profiles`, `organization_memberships`, `invitations`, and `feature_flags`. This plan introduces the task-domain tables and regenerates the database types so the task workflow code can use concrete inserts, updates, and query shapes instead of ad hoc JSON or loose records.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, Zod, Vitest, Testing Library, Playwright, ESLint, Prettier, Husky, lint-staged, npm.

---

## Planned file map

```text
src/
├── app/
│   ├── (app)/tasks/page.tsx
│   ├── (app)/tasks/[taskId]/page.tsx
│   ├── (app)/my-tasks/page.tsx
│   └── (app)/layout.tsx
├── components/
│   ├── task-card.tsx
│   ├── task-detail.tsx
│   ├── assignment-status-pill.tsx
│   └── progress-slider.tsx
├── lib/
│   └── supabase/database.types.ts
├── modules/
│   ├── tasks/{actions,queries,schemas}.ts
│   ├── assignments/{actions,queries,schemas}.ts
│   ├── activity/queries.ts
│   └── notifications/{actions,queries}.ts
└── app/api/jobs/notifications/route.ts
supabase/
├── migrations/202608010010_task_workflow.sql
├── migrations/202608010011_task_activity_and_notifications.sql
├── fixtures/pre_task_workflow.sql
└── tests/task_workflow_rls.test.sql
tests/
├── unit/{task-schemas,assignment-schemas,task-actions,task-queries}.test.ts
└── e2e/{task-flow,my-tasks}.spec.ts
```

## Task 1: Add the task workflow schema and generated types

**Files:**
- Create: `supabase/migrations/202608010010_task_workflow.sql`
- Create: `supabase/migrations/202608010011_task_activity_and_notifications.sql`
- Create or update: `src/lib/supabase/database.types.ts`
- Create: `supabase/tests/task_workflow_rls.test.sql`

- [ ] **Step 1: Model the task domain in PostgreSQL**

Introduce task tables that match the product design: tasks, task assignments, task activity events, task comments, and durable notifications. Keep every organization-owned row scoped by `organization_id`, and preserve the assignment-level state machine with explicit columns for status, progress, delay reason, started/completed timestamps, and moderation/audit metadata.

- [ ] **Step 2: Regenerate the database types**

Regenerate `src/lib/supabase/database.types.ts` so the application can use concrete table rows, inserts, updates, and enum values for the new task workflow tables and any supporting enums such as task status, priority, and activity types.

- [ ] **Step 3: Lock the access boundaries in pgTAP**

Add RLS tests that prove admins can view organization-wide task data, employees can only see their assignments and shared task context, and no direct write path bypasses the server-side mutation rules.

## Task 2: Add task and assignment schemas plus server actions

**Files:**
- Create: `src/modules/tasks/schemas.ts`
- Create: `src/modules/tasks/actions.ts`
- Create: `src/modules/tasks/queries.ts`
- Create: `src/modules/assignments/schemas.ts`
- Create: `src/modules/assignments/actions.ts`
- Create: `src/modules/assignments/queries.ts`

- [ ] **Step 1: Define Zod schemas from the product rules**

Encode the task creation, publication, update, assignment, progress, delay, completion, reopen, and acknowledgement inputs so the server rejects invalid transitions before touching the database.

- [ ] **Step 2: Implement transactional server actions**

Create `createTask`, `updateTask`, `publishTask`, `updateAssignmentProgress`, `changeAssignmentStatus`, `adminOverrideAssignment`, `reopenAssignment`, and `acknowledgeTaskChange` as server actions that enforce organization membership and role checks.

- [ ] **Step 3: Return typed results and trace IDs**

Use the shared result boundary from `src/lib/result.ts` so all task mutations return typed success or safe error objects instead of leaking raw database failures to the client.

## Task 3: Build the employee task views

**Files:**
- Create: `src/app/(app)/tasks/page.tsx`
- Create: `src/app/(app)/tasks/[taskId]/page.tsx`
- Create: `src/app/(app)/my-tasks/page.tsx`
- Create: `src/components/task-card.tsx`
- Create: `src/components/task-detail.tsx`

- [ ] **Step 1: Implement the task list and detail pages**

Show shared task intent, assignment state, deadlines, progress, delays, comments, and activity history with role-aware rendering.

- [ ] **Step 2: Keep the employee surface narrow**

Employee views should only expose the employee's own assignments, while admin views can show rollups and per-assignee state.

- [ ] **Step 3: Preserve responsive behavior**

Make the task detail layout work on mobile first, then expand into the richer desktop presentation already implied by the shell.

## Task 4: Add activity, notifications, and task-change auditing

**Files:**
- Create: `src/modules/activity/queries.ts`
- Create: `src/modules/notifications/actions.ts`
- Create: `src/modules/notifications/queries.ts`
- Create: `src/app/api/jobs/notifications/route.ts`

- [ ] **Step 1: Persist task events and change history**

Every publication, assignment change, completion, delay, reopen, and acknowledgement should create an audit-visible activity record.

- [ ] **Step 2: Deliver durable notifications**

Use the notification tables and job route to queue, display, and mark notifications read without relying on client memory.

- [ ] **Step 3: Keep delivery idempotent**

Scheduled delivery and retry paths must tolerate retries without duplicating user-visible state.

## Task 5: Verify the Phase 1 release gate

**Files:**
- Create: `tests/e2e/task-flow.spec.ts`
- Create: `tests/e2e/my-tasks.spec.ts`
- Create: `tests/unit/task-schemas.test.ts`
- Create: `tests/unit/assignment-schemas.test.ts`

- [ ] **Step 1: Write the task workflow acceptance tests**

Cover the admin create/publish/assign path, the employee start/progress/delay/complete path, and the owner versus assignee visibility rules.

- [ ] **Step 2: Run the task release gate**

The Phase 1 checkpoint passes only when the database migration suite, unit tests, E2E tests, lint, typecheck, and production build all succeed against the new task workflow.

- [ ] **Step 3: Commit the workflow milestone**

Commit only after the task schema, server actions, UI, and tests align with the approved spec and the current generated types.

At this checkpoint, use the actual generated task tables and application routes as the source of truth for the next plan segment rather than re-deriving them from the design spec.