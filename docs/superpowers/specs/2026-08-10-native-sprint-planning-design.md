# Native Sprint Planning Design

Date: 2026-08-10
Status: Approved product design

## 1. Purpose

Add a complete native sprint-planning cycle to TaskFlow. Organizations can form multiple planning teams, maintain hierarchical backlogs, plan and execute sprints against capacity, track risks and delivery metrics, run sprint reviews and retrospectives, carry unfinished work forward intentionally, and organize long-range work on a release roadmap.

TaskFlow remains the source of truth. Azure DevOps authentication, import, export, and synchronization are explicitly deferred to a later project. The data model should leave room for future external identifiers without introducing Azure-specific fields or behavior in this release.

## 2. Approved product decisions

- An organization can have multiple planning teams.
- Admins and employees can participate in planning.
- Work follows an Epic → Feature → User Story → Task hierarchy.
- Every hierarchy level is actionable and can have assignees, progress, comments, attachments, dependencies, and activity.
- A sprint board displays one card per work item, not one card per assignee.
- Board state is derived from assignment state so there is no second editable workflow state.
- Epics, features, and user stories use story points. Tasks use hours.
- The release includes the complete planning cycle: backlog, sprint planning, capacity, active board, burndown, velocity, risks, review, retrospective, carry-over, and roadmap.
- Azure DevOps is not part of this scope.

## 3. Architecture

Extend the existing task domain instead of replacing it. The `tasks` table remains the canonical work-item table so current assignments, comments, attachments, dependencies, notifications, activity events, task detail pages, and row-level policies continue to work. Product-facing sprint interfaces use “work item” as the umbrella term.

Existing tasks are migrated to `work_item_type = 'task'`. New nullable planning fields allow existing non-sprint task flows to remain valid. A task does not have to belong to a planning team, sprint, release, or hierarchy.

New planning modules own their validation, queries, server actions, view models, and focused interface components:

| Module | Responsibility |
| --- | --- |
| `planning-teams` | Team lifecycle, membership, permissions, and default capacity |
| `backlog` | Hierarchy, ranking, estimation, filtering, and sprint assignment |
| `sprints` | Sprint lifecycle, scope, capacity, carry-over, and board view models |
| `planning-insights` | Burndown, velocity, forecast, and load calculations |
| `releases` | Release goals, date ranges, and roadmap grouping |
| `risks` | Sprint/release risks, owners, scoring, mitigation, and status |
| `retrospectives` | Review summary, retrospective notes, voting, and follow-up actions |

These modules reuse the existing `tasks`, `assignments`, `members`, `activity`, and `notifications` modules through exported operations. They do not duplicate task or assignment mutation logic.

## 4. Data model

### 4.1 Existing task extensions

Add the database enum:

- `work_item_type`: `epic`, `feature`, `user_story`, `task`

Define `planning_item_state` only in application/query code as `todo`, `in_progress`, `blocked`, or `done`; it is derived and is not persisted.

Add nullable columns to `tasks`:

- `work_item_type work_item_type not null default 'task'`
- `parent_task_id uuid references tasks(id) on delete restrict`
- `planning_team_id uuid references planning_teams(id) on delete set null`
- `sprint_id uuid references sprints(id) on delete set null`
- `release_id uuid references releases(id) on delete set null`
- `story_points numeric(6,2)`
- `original_hours numeric(8,2)`
- `remaining_hours numeric(8,2)`
- `backlog_rank text`

Constraints enforce:

- Epic has no parent.
- Feature may only have an Epic parent.
- User Story may only have a Feature parent.
- Task may only have a User Story parent.
- Parent and child belong to the same organization and planning team.
- Cycles are impossible because only the immediately preceding type can be a parent.
- Epic, Feature, and User Story may set `story_points` but not hour fields.
- Task may set hour fields but not `story_points`.
- Estimates are non-negative.
- `remaining_hours` cannot exceed `original_hours` unless an explicit re-estimation action raises both values and records an activity event.
- A sprint item and its sprint belong to the same organization and team.
- A release item and its release belong to the same organization.

Indexes cover organization/team/rank, parent lookup, sprint scope, release scope, and work-item type filters.

### 4.2 Planning teams

`planning_teams` stores:

- `id`, `organization_id`, `name`, `description`
- `default_sprint_length_days`
- `is_archived`
- `created_by`, `created_at`, `updated_at`

`planning_team_members` stores:

- `id`, `organization_id`, `planning_team_id`, `user_id`
- `planning_role`: `planner` or `member`
- `default_capacity_hours_per_day`
- `created_at`, `updated_at`

A user can belong to multiple planning teams. Organization admins are implicit planners for every team. Employees assigned the team role `planner` can manage team settings and other members. Both planners and members can create hierarchy items, estimate, rank the backlog, and change sprint scope. Members can edit only their own capacity row. Team planners can activate a planned sprint. Non-planner members cannot activate a sprint, and only organization admins can complete or reopen a sprint, archive a team, or delete planning records.

### 4.3 Sprints and capacity

`sprints` stores:

- `id`, `organization_id`, `planning_team_id`
- `name`, `goal`, `start_date`, `end_date`
- `status`: `planned`, `active`, `completed`
- `completed_at`, `completed_by`
- immutable completion snapshots: committed points/hours, completed points/hours, carried-over counts, and member capacity totals
- `created_by`, `created_at`, `updated_at`

Rules:

- Dates are inclusive local dates interpreted using the organization timezone.
- Sprints for the same team cannot overlap.
- A team can have at most one active sprint.
- Only planned sprints can be activated.
- Only an active sprint can be completed.
- A completed sprint is immutable except for review and retrospective content.

`sprint_capacity` stores one row per sprint member:

- `sprint_id`, `user_id`
- `working_days`
- `hours_per_day`
- `days_off`
- optional `activity_name`
- computed capacity is `(working_days - days_off) × hours_per_day`

Capacity values are snapshotted for a sprint and do not change when team defaults change.

### 4.4 Releases and roadmap

`releases` stores organization-scoped `name`, `goal`, `start_date`, `target_date`, `status` (`planned`, `active`, `released`, `cancelled`), display color, and audit fields. Items from multiple planning teams can belong to one release. Roadmap progress is a weighted roll-up of assigned estimates; when estimates are absent it falls back to work-item counts.

### 4.5 Risks

`planning_risks` stores:

- organization and planning-team ownership
- optional `sprint_id` and `release_id`
- title, description, owner
- probability and impact from 1–5
- computed score `probability × impact`
- mitigation, status (`open`, `mitigating`, `resolved`, `accepted`)
- audit fields

A risk must reference at least a sprint or release. Referenced sprint/release records must be compatible with its organization and team.

### 4.6 Reviews and retrospectives

`sprint_reviews` stores one record per sprint with outcome summary, demo notes, stakeholder feedback, and author/update metadata.

`sprint_retrospectives` stores one record per sprint and its lifecycle (`draft`, `shared`, `closed`). `sprint_retro_items` stores categorized entries (`went_well`, `needs_improvement`, `action`) with author, optional owner/due date, vote count, and resolution state. Users can vote once per item through `sprint_retro_votes`.

Retro action items can create linked Task work items through the normal task action. The link is stored explicitly so the retrospective remains historical even if the task is later archived.

## 5. Derived state and metrics

### 5.1 Work-item board state

The board computes one state per work item from active assignments:

1. No assignments, or all assignments `not_started`: `todo`
2. Any incomplete assignment is `delayed`: `blocked`
3. All assignments are `completed`: `done`
4. Otherwise: `in_progress`

An unassigned parent with descendants uses descendant roll-up progress for display but remains `todo` for board filtering. This avoids treating planning containers as completed without an explicit assignment.

### 5.2 Hierarchy roll-up

Each actionable item keeps its own estimate and assignment state. Parent progress is displayed in two forms:

- Direct progress: derived only from the parent’s own assignments.
- Delivery roll-up: weighted completion across all descendants, using story points for non-task items and original hours for tasks. Items without estimates receive equal weight within their sibling group.

The interface labels these values distinctly to avoid implying that descendant completion automatically completes the parent.

### 5.3 Sprint commitment and completion

Activating a sprint snapshots its committed item IDs, points, hours, and capacity. Items may be added or removed during an active sprint, but every scope change is recorded and burndown displays a scope-change marker.

Completing a sprint requires an explicit decision for every unfinished work item:

- Move to a selected future planned sprint.
- Return to the ranked team backlog.
- Keep associated with the completed sprint as intentionally unfinished.

The completion transaction snapshots metrics and applies carry-over decisions atomically. Completed sprint metrics never change afterward, even if work items are edited later.

### 5.4 Burndown and velocity

Daily sprint snapshots store remaining points, remaining task hours, completed item count, total scope, and capacity. A daily scheduled job creates snapshots; assignment and scope mutations also upsert the current day so charts remain current.

- Points burndown covers Epic, Feature, and User Story estimates.
- Hours burndown covers Task remaining hours.
- Sprint point totals use point-bearing leaf items: a User Story always counts, while a Feature or Epic counts only when no point-estimated descendant of that item is in the same sprint. This prevents the same scope from being counted at several hierarchy levels.
- Velocity is completed point-bearing-leaf story points per completed sprint, based on the sprint’s immutable completion snapshot.
- Forecast uses the rolling average of the team’s last three completed sprints when available; it remains unavailable rather than fabricated when history is insufficient.

## 6. User experience and routes

Add a shared `Planning` navigation group for admins and employees:

```text
/planning                         Team-aware planning overview
/planning/teams                   Team directory and membership
/planning/teams/[teamId]/backlog  Ranked hierarchical backlog
/planning/teams/[teamId]/sprints  Sprint list and planning
/planning/sprints/[sprintId]      Sprint summary and planning workspace
/planning/sprints/[sprintId]/board
/planning/sprints/[sprintId]/insights
/planning/sprints/[sprintId]/review
/planning/sprints/[sprintId]/retro
/planning/roadmap                 Cross-team release roadmap
/planning/releases/[releaseId]    Release detail and risks
```

### Backlog

- Displays a collapsible Epic → Feature → User Story → Task tree.
- Supports keyboard-accessible rank controls in addition to drag and drop.
- Filters by assignee, type, release, estimate state, and text.
- Allows inline estimate editing and parent assignment when authorized.
- Provides bulk selection for moving compatible items into a planned or active sprint.

Moving a parent does not silently move descendants. The action offers an explicit “include descendants” option and previews the affected item count.

### Sprint planning workspace

- Left pane: ranked team backlog.
- Center: proposed sprint scope grouped by hierarchy.
- Right summary: team capacity, committed points, committed hours, per-member task-hour load, warnings, and sprint goal.
- Over-capacity planning is allowed but requires confirmation and leaves a visible warning; it is not silently blocked.

### Active sprint board

- Columns: To do, In progress, Blocked, Done.
- One card per work item.
- Moving a card invokes existing assignment transitions for every affected incomplete assignment only after a confirmation preview. Unassigned items must be assigned before they can move. Moving back to To do is unavailable because the existing workflow does not allow started assignments to return to Not Started. Moving to Blocked collects a delay reason; moving to Done preserves completed assignments and completes the remaining assignments.
- Moving to Done is blocked by unsatisfied dependencies, preserving the existing dependency rule.
- Cards show type, hierarchy breadcrumb, estimate, assignees, due date, risk indicator, and direct versus rolled-up progress.

### Review, retrospective, and roadmap

- Review combines committed/completed scope, demos, feedback, carry-over, and delivery metrics.
- Retrospectives support private drafts until shared, categorized notes, voting, and linked action tasks.
- Roadmap groups releases on a time axis and nests Epics/Features by team. It supports accessible list mode on small screens and for keyboard users.

## 7. Server operations and data flow

Server Actions remain the primary mutation boundary. Important actions include:

- Teams: `createPlanningTeam`, `updatePlanningTeam`, `setPlanningTeamMembers`, `archivePlanningTeam`
- Backlog: `createWorkItem`, `updateWorkItemPlanningFields`, `moveWorkItem`, `rankBacklogItem`, `bulkMoveWorkItemsToSprint`
- Sprints: `createSprint`, `updateSprint`, `setSprintCapacity`, `activateSprint`, `completeSprint`, `reopenSprint`
- Releases: `createRelease`, `updateRelease`, `assignWorkItemToRelease`, `changeReleaseStatus`
- Risks: `createPlanningRisk`, `updatePlanningRisk`, `resolvePlanningRisk`
- Reviews/retrospectives: `saveSprintReview`, `saveRetrospective`, `addRetroItem`, `voteRetroItem`, `createRetroActionTask`

Queries return bounded role-filtered view models rather than raw unrestricted tables. Complex hierarchy, capacity, and metric reads use database functions or focused SQL views where this reduces query count and guarantees consistent calculations.

Multi-record operations—hierarchy moves, sprint activation/completion, carry-over, membership replacement, and metric snapshots—use transactional PostgreSQL functions. Each function checks organization and team authorization internally; client-supplied organization IDs are never trusted as authority.

Mutations return the existing typed `ActionResult` shape with a safe error, trace ID, and field errors. Successful writes revalidate only affected planning, task, dashboard, and report routes.

## 8. Permissions and row-level security

- Active organization members may view planning teams they belong to and their associated planning records.
- Organization admins may view and manage every planning team in the organization.
- Team planners may manage team settings and membership, backlog hierarchy, estimates, sprint scope, capacity, risks, reviews, and retrospectives for their teams, and may activate planned sprints.
- Team members may create and edit work items, hierarchy, estimates, backlog rank, sprint scope, risks, and retrospective content for their teams; edit their own capacity; and update assignments they already have permission to update.
- Only organization admins may archive teams, complete/reopen sprints, close retrospectives, or delete planning records.
- Planning-team membership grants visibility to every work item assigned to that planning team, including parent breadcrumbs and team aggregates. This is an intentional expansion from the existing participant-only task model so shared planning is possible. For tasks without a planning team, existing participant-only visibility remains unchanged. Employees outside a task’s planning team must not discover it through metrics, roadmaps, search, or aggregate counts.
- Service-role access is reserved for scheduled snapshot jobs and never exposed to browser code.

Every new table enables RLS and receives explicit grants. Policies use security-definer helper functions with fixed empty search paths, following the repository’s current database security pattern.

## 9. Error handling and concurrency

- Hierarchy validation errors identify the incompatible parent or team.
- Sprint date overlap and single-active-sprint constraints are enforced in the database and translated into actionable messages.
- Ranking mutations use fractional ranks and optimistic UI; collisions trigger a bounded server-side rebalance and retry.
- Update actions include the record’s `updated_at` value. A stale mutation returns a conflict response and prompts refresh instead of overwriting another planner’s change.
- Sprint completion is idempotent. Retrying the same request returns the existing completion result.
- Scheduled metric snapshots use `(sprint_id, snapshot_date)` uniqueness and upserts.
- Partial bulk moves report per-item failures and do not move incompatible descendants unless the user explicitly selected them. Sprint completion and carry-over remain all-or-nothing.
- Notification failures are best-effort and do not roll back valid planning mutations; durable notification records can be retried.

## 10. Migration and compatibility

The rollout is additive:

1. Create planning enums, tables, indexes, authorization helpers, and RLS policies.
2. Add nullable planning columns to `tasks`; backfill `work_item_type = 'task'`.
3. Add constraints after the backfill.
4. Regenerate Supabase TypeScript types.
5. Ship planning routes behind an organization-scoped `native_sprint_planning` feature flag.
6. Preserve all existing task routes and task-creation behavior. New non-planning tasks continue to have no team, sprint, release, parent, or estimate.

Existing dashboards and reports remain based on assignments. Planning insights are additive and do not silently change established productivity calculations.

## 11. Testing strategy

### Database tests

- RLS isolation across organizations, teams, members, and non-participants
- Admin/planner/member permission matrix
- Valid and invalid hierarchy combinations
- Cross-organization and cross-team reference rejection
- Sprint overlap and lifecycle constraints
- Atomic activation, completion, and carry-over
- Immutable completion snapshots
- Capacity and metric calculations
- Retrospective vote uniqueness
- Upgrade preservation for existing tasks and assignments

### Unit and component tests

- Schemas and safe action errors
- Board-state and hierarchy-progress derivation
- Points, hours, capacity, velocity, forecast, and burndown calculations
- Backlog tree building and filtering
- Role-aware navigation and controls
- Keyboard ranking and accessible board interactions
- Over-capacity and stale-update conflict states

### End-to-end tests

- Create a team and assign members
- Build a complete hierarchy and estimates
- Plan and activate a sprint against capacity
- Execute work through the shared board
- Record risks and scope changes
- Complete a sprint with each carry-over choice
- Review immutable metrics and run a retrospective
- Create a retrospective action task
- Build and inspect a cross-team release roadmap
- Prove that an unrelated employee cannot discover hidden work through planning views

The existing verification suite remains required. At design time, the repository has one pre-existing failing unit contract test caused by its expectation of array-style generated enum constants while the checked-in generated types expose union types. Implementation setup will correct that stale contract test before sprint work begins so every later increment starts from a green unit-test baseline.

## 12. Delivery sequence

Implementation should be split into independently releasable increments:

1. Database foundation, RLS, types, and team management
2. Work-item hierarchy, estimates, and ranked backlog
3. Sprint lifecycle, capacity, and planning workspace
4. Active sprint board and assignment roll-ups
5. Burndown, velocity, forecasts, and immutable snapshots
6. Risks, review, retrospective, and action items
7. Releases and cross-team roadmap
8. Accessibility, end-to-end coverage, operational documentation, and feature-flag rollout

Each increment must preserve existing non-planning task behavior and pass its focused tests before the next increment begins.

## 13. Acceptance criteria

The feature is complete when:

- Multiple planning teams can independently maintain backlogs and non-overlapping sprint schedules.
- Users can create, rank, filter, and act on the full Epic → Feature → User Story → Task hierarchy.
- Every hierarchy level can be assigned and progressed without duplicating workflow state.
- Planners can compare committed scope with member capacity before activation.
- Teams can execute a sprint on a shared roll-up board with dependency enforcement.
- Burndown, velocity, scope changes, and forecasts are reproducible from durable snapshots.
- Sprint completion records immutable results and handles every unfinished item explicitly.
- Teams can manage risks, reviews, retrospectives, and follow-up actions.
- Organizations can plan releases across teams on an accessible roadmap.
- RLS and server authorization prevent organization, team, hierarchy, and aggregate-data leakage.
- Existing TaskFlow task, assignment, notification, reporting, and personal-work flows continue to function.
