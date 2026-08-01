# Task Management Platform Design

Date: 2026-08-01
Status: Approved product design

## 1. Purpose

Build a secure, responsive task-management web application for founders/managers and employees/interns. Admins assign and oversee work; employees manage their own assignments, progress, delays, files, and discussions. The product combines the clarity of Google Classroom's assignment lifecycle with the operational task views of Microsoft Planner in Teams, while retaining original branding and interaction design.

## 2. Product assumptions

- The initial deployment serves one organization and fewer than 500 users, while all organization-owned records include an organization boundary so multi-tenant support can be added safely.
- Registration is invitation-only. Users cannot grant themselves the Admin role.
- Employees can access only tasks assigned to them. Admins can access all records in their organization.
- Multiple admins are supported.
- The default organization timezone is Asia/Kolkata and can be changed by an admin.
- English is the initial interface language.
- Both in-app and email notifications are in scope.
- Third-party collaboration integrations such as Slack, Google Workspace, and Microsoft 365 are outside the initial build.
- All three phases in the source requirements are included, delivered as independently testable milestones.

## 3. Product principles

1. Assignment lifecycle first: creating, understanding, progressing, discussing, and completing work must remain obvious.
2. Personal focus for employees: My Day and My Tasks prioritize actionable work without exposing colleagues' assignments.
3. Operational visibility for admins: dashboards, filters, workload, deadlines, and reporting make problems visible early.
4. Durable accountability: task changes, comments, notifications, and delivery attempts survive refresh and are auditable.
5. Mobile parity: core employee actions must work comfortably on a phone.
6. Accessible by default: semantic controls, keyboard navigation, visible focus, sufficient contrast, and clear error messaging are required.

## 4. Selected architecture

Use a TypeScript Next.js application backed by Supabase services:

- Next.js supplies the responsive web interface, server-rendered pages, server-side actions, and protected API boundaries.
- PostgreSQL stores organizations, identities, tasks, assignments, conversations, audit events, recurrence rules, notifications, and reporting data.
- Supabase Auth manages authentication, invitations, verification, sessions, and password recovery.
- Row-level security enforces organization and role boundaries at the database layer.
- Supabase Realtime delivers near-realtime task and notification updates.
- Private object storage holds task reference files and employee deliverables. Access uses short-lived signed URLs.
- Scheduled server jobs create recurring work, detect overdue assignments, and enqueue reminders.
- A transactional email provider sends queued email notifications. Provider-specific code remains behind a notification adapter.
- Vercel hosts the application, while Supabase hosts the managed database, authentication, realtime, and storage services.

This architecture is preferred over a separate custom API/worker stack because it meets the expected scale with substantially less operational complexity. It is preferred over Firebase because the domain is relational and requires aggregation-heavy reporting and strict row-level access rules.

## 5. Roles and permissions

### Admin

- Invite, deactivate, and manage organization members.
- Grant or remove the Admin role for authorized members.
- Create, draft, schedule, edit, assign, archive, reopen, and recur tasks.
- Access all task assignments, conversations, files, activity events, and reports in the organization.
- Configure organization timezone and default notification settings.

### Employee

- View only tasks assigned to them.
- Change their assignment status and progress.
- Supply a required reason when declaring a delay.
- Add comments, replies, mentions, and permitted attachments.
- Complete their assignment and view its activity history.
- Manage personal notification preferences and profile details.

Every privileged operation is authorized on the server and reinforced by database policy. Hiding an interface control is never treated as authorization.

## 6. Task and assignment model

A task stores shared intent: title, description, creator, priority, schedule, deadline, reference attachments, and recurrence configuration. Assigning the task creates one task-assignment record per employee.

Each assignment independently stores status, progress, delay reason, started time, completed time, and assignee-specific deliverables. Therefore, one employee completing a task does not complete it for other assignees. Admin views show a parent rollup such as "2 of 3 completed."

Supported employee statuses are:

- Not Started
- In Progress
- Delayed
- Completed

Progress uses 0, 25, 50, 75, or 100 percent. Starting work moves a zero-progress assignment to In Progress. Completing sets progress to 100. Moving to Delayed requires a non-empty reason. Reopening a completed assignment is an Admin action and creates an audit event.

Overdue is a computed condition, not a manually selected status. An incomplete assignment is overdue when the deadline has passed in the organization's timezone. This permits meaningful combinations such as In Progress + Overdue and Delayed + Overdue.

## 7. User flows

### Admin assignment flow

1. Admin opens Create Task.
2. Admin enters a title, detailed instructions, assignees, priority, deadline, optional start date, reference files, reminders, and optional recurrence.
3. Admin saves a draft, schedules publication, or assigns immediately.
4. Publication creates assignment records, activity events, and durable notifications in one consistent operation.
5. Realtime delivery updates connected employees; queued email delivery serves users who are offline.
6. Admin follows aggregate and individual progress from the dashboard or task detail.

### Employee work flow

1. Employee sees a realtime alert and unread bell count.
2. Employee opens the linked task and reviews instructions, due date, and reference files.
3. Employee starts the task, adjusts progress, posts updates or blockers, and uploads deliverables.
4. If delayed, the employee selects Delayed and provides the required explanation.
5. Employee marks the assignment complete. The action sets progress to 100, records completion time, creates an activity event, and notifies admins.

### Discussion flow

Comments form a chronological task thread with replies and mentions. Comments are durable and attributed. Rather than silently deleting or rewriting accountability records, edited comments retain edit metadata and deleted comments retain an audit-visible tombstone. Mentioned users and relevant participants receive notifications subject to their preferences.

## 8. Information architecture

### Shared screens

- Login, password recovery, invitation acceptance, and initial organization setup
- Task detail
- Notifications center
- Profile and notification preferences

### Admin screens

- Dashboard
- All Tasks with list, board, and calendar views
- Create/Edit Task
- Employee Directory and employee workload detail
- Reports
- Organization settings

### Employee screens

- My Day
- My Tasks with list, board, and calendar views
- Task detail

Desktop navigation uses a persistent sidebar. Mobile uses a compact header and bottom navigation for primary destinations. Secondary information in the desktop task view becomes vertically stacked content on mobile.

## 9. Key screen behavior

### Admin dashboard

Display total active, due today, overdue, delayed, and completed-this-month metrics; completion trends; task distribution; employee workload; attention items; and recent activity. Every metric links to its filtered source records.

### My Day

Show overdue assignments first, followed by work due today and upcoming high-priority assignments. Recently assigned work appears as a secondary section.

### Task views

Provide:

- Grid/list view for scanning and quick field comparison.
- Board view grouped by status with authorized drag transitions.
- Calendar view based on start and due dates.
- Search by task text and filters for status, assignee, priority, deadline, overdue state, and creator.

The application remembers each user's last view and filter preferences.

### Task detail

Show summary, deadline, priority, instructions, assignee rollup, individual progress, attachments, discussion, delay information, and immutable activity history. Controls reflect the viewer's role and assignment relationship.

## 10. Data model

Core tables are:

- `organizations`
- `profiles`
- `organization_memberships`
- `invitations`
- `tasks`
- `task_assignments`
- `comments`
- `attachments`
- `activity_events`
- `notifications`
- `notification_preferences`
- `recurrence_rules`
- `reminder_deliveries`

All organization-owned records contain `organization_id`. Mutable records use creation and update timestamps. Records needed for accountability are archived or deactivated rather than hard-deleted. Activity events are append-only and include actor, event type, subject, timestamp, and structured change metadata.

## 11. Notifications and scheduled work

Events can generate notifications for assignment, edits affecting an assignee, reassignment, comments, replies, mentions, deadline reminders, newly overdue work, delay declarations, completion, and reopening.

In-app notifications consist of realtime toasts, an unread bell counter, and a durable notification center with deep links. Email is queued separately, so email provider failure never rolls back a successful task action.

Scheduled processing:

- Sends reminders according to the task reminder configuration.
- Marks each overdue transition once and notifies the configured audience.
- Generates recurring task occurrences.
- Retries failed notification deliveries with bounded backoff.

All jobs use unique delivery or occurrence keys so retries cannot duplicate notifications or tasks.

## 12. Recurring work

Support daily, weekly, monthly, and custom interval rules. Each occurrence becomes an ordinary task with independent assignments and history. Editing recurrence offers "this occurrence" or "this and future occurrences." Completed or historical occurrences are never rewritten implicitly.

## 13. Reporting

Admin reports support organization-timezone-aware date filters and optional employee filters. Initial measures are:

- Completed task count by employee
- On-time completion percentage
- Average completion duration
- Delayed and overdue counts
- Current active workload
- Weekly and monthly completion trend
- Priority distribution

CSV export is included. PDF export is deferred because it is not required by the source document.

## 14. Security and privacy

- Invitation-only membership and server-controlled roles
- Verified sessions and secure password recovery
- Row-level organization isolation
- Employee access limited to their assignments and related records
- Private storage and signed file URLs
- Client and server schema validation
- File size, count, and type restrictions
- Rate limits on authentication, invitations, comments, and uploads
- Protected secrets and environment validation
- Audit events for role, membership, task, deadline, assignment, status, and completion changes
- Safe account deactivation and session revocation

## 15. Error handling and consistency

- Optimistic updates roll back when persistence fails and expose a retry action.
- Version checks reject stale concurrent edits instead of silently overwriting newer work.
- Idempotency prevents duplicate task creation from repeated submissions.
- Server rules enforce valid status transitions, mandatory delay reasons, and 100 percent completion.
- Unsupported or oversized files fail before upload when possible and never create dangling attachment records.
- Notification delivery failures are logged and retried without undoing the source action.
- Empty, loading, offline, unauthorized, not-found, and unexpected-error states use clear user-facing guidance.

## 16. Visual and interaction direction

The interface is an original, modern workplace product rather than a visual clone of an education tool. It uses readable typography, restrained color, clear hierarchy, generous spacing, and consistent status chips. Red is reserved for overdue and destructive/error states. Motion is subtle and functional. Core actions use plain labels such as Assign Task, Start Task, Report Delay, and Mark Complete.

Accessibility requirements include semantic HTML, complete keyboard use, visible focus, screen-reader labels, sufficient contrast, reduced-motion support, and phone-sized touch targets.

## 17. Delivery milestones

### Phase 0: Foundation

- Application and design-system setup
- Database migrations and seed strategy
- Authentication and invitation flow
- Organization membership and row-level security
- Testing, local development, and deployment foundations

### Phase 1: Core workflow

- Admin and employee experiences
- Task drafts, creation, editing, publication, and multiple assignees
- My Tasks and task detail
- Status, progress, mandatory delay reason, and completion
- Basic discussion
- Realtime assignment and completion notifications
- Responsive application shell

### Phase 2: Operational usability

- Admin dashboard
- List, board, and calendar views
- Search, sorting, grouping, and filters
- Threaded discussion and mentions
- Automatic overdue handling and deadline reminders
- Activity history
- Employee directory and workload views
- Durable notification center

### Phase 3: Full requested scope

- Private file attachments and deliverables
- Email delivery and notification preferences
- Recurring tasks
- Reporting and CSV export
- Multiple-admin management
- Mobile, accessibility, security, and performance hardening
- Production deployment and operational documentation

Each phase must be demonstrably usable and pass its automated acceptance suite before the next phase begins.

## 18. Testing strategy

- Unit tests cover status transitions, progress constraints, overdue calculations, recurrence, reminders, reporting, and permission decisions.
- Database tests prove organization isolation and employee assignment access.
- Integration tests cover creation, publication, multiple assignments, comments, notifications, uploads, scheduled processing, and reporting.
- Component tests cover forms, filters, dialogs, navigation, loading, empty, and error states.
- End-to-end tests cover invitation, Admin assignment, employee progress/delay/completion, Admin notification and reopening, recurring occurrence creation, and report generation.
- Accessibility tests cover labels, keyboard flow, focus behavior, contrast, and reduced motion.
- Responsive checks cover representative phone, tablet, laptop, and wide-desktop widths.
- Time tests cover organization timezone boundaries, daylight-saving-safe storage, deadline transitions, and reminder idempotency.

## 19. Acceptance criteria

The product is complete when:

1. Admins can securely invite and manage employees and additional admins.
2. Admins can draft, schedule, assign, edit, recur, archive, and reopen tasks.
3. Multiple assignees maintain independent progress and completion.
4. Employees can access only authorized assignments and related files and discussions.
5. Delay declarations require reasons and overdue state is computed automatically.
6. Comments, replies, mentions, reference files, and deliverables work reliably.
7. Realtime and email notifications are durable, link to their source, and respect preferences.
8. Dashboards and reports derive from stored production data and respect filters and timezone.
9. Every meaningful task and membership change produces an attributable activity event.
10. Core workflows are accessible and usable on desktop and mobile.
11. Authorization, database, integration, end-to-end, accessibility, and production-build checks pass.
12. Environment setup, deployment, backups, scheduled jobs, and operational recovery are documented.

## 20. Explicitly deferred scope

- Native iOS or Android applications
- Public self-registration
- Slack, Google Workspace, or Microsoft 365 integration
- Billing and subscription management
- Gantt charts, dependencies, timesheets, and resource forecasting
- PDF report export
- Multi-organization administration UI

The schema and module boundaries should avoid preventing these future additions, but no deferred feature will be implemented speculatively.
