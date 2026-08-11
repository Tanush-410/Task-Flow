# Azure DevOps Two-Way Synchronization Design

## Objective

Add a production-grade Azure DevOps integration to TaskFlow. One TaskFlow
planning team connects to one Azure DevOps organization, project, and team.
TaskFlow users can work with synchronized sprints and the full planning
hierarchy while Azure DevOps remains canonical for every linked record.

This release supports Microsoft Entra delegated OAuth, two-way work-item and
iteration synchronization, Azure-wins revision conflicts, webhook-driven
inbound updates, durable outbound jobs, scheduled reconciliation, verified
email identity matching, and archive-only removal behavior.

## Product decisions

- Azure DevOps is canonical for linked records.
- TaskFlow writes are still accepted locally and queued for outbound sync.
- Azure revision conflicts never overwrite newer Azure data.
- One TaskFlow planning team maps to exactly one Azure project and Azure team.
- The initial type set is Epic, Feature, User Story/Product Backlog Item, Bug,
  and Task.
- Azure assignees match TaskFlow profiles by verified, normalized email.
- Unmatched Azure identities remain unassigned and are surfaced to admins.
- Deletions are represented as archives; synchronization never hard-deletes
  work across systems.
- Changes flow through Azure service hooks plus scheduled reconciliation.
- Microsoft Entra delegated OAuth is the only interactive authentication path.
  Legacy Azure DevOps OAuth and personal access tokens are out of scope.

## Architecture

TaskFlow keeps its existing Next.js and Supabase boundaries. The integration
adds five focused modules:

| Module | Responsibility |
| --- | --- |
| `azure-devops-auth` | OAuth state, Entra authorization callback, encrypted token storage, refresh, reconnect, and disconnect |
| `azure-devops-client` | Typed Azure REST requests, pagination, revisions, service-hook administration, rate limits, and safe transport errors |
| `azure-devops-mapping` | Work-item types, process states, fields, identities, iterations, and TaskFlow view models |
| `azure-devops-sync` | Outbox processing, inbound webhook handling, idempotency, retries, conflicts, reconciliation, and loop prevention |
| `azure-devops-connections` | Admin setup, discovery, mapping, import progress, health, warnings, and manual controls |

TaskFlow mutations that affect linked data write the local record and an
outbound job in one database transaction. A protected worker endpoint leases
and processes jobs. Azure sends service-hook events to a public HTTPS webhook
endpoint. A separately protected reconciliation endpoint compares Azure
revisions with stored link revisions and repairs missed or delayed events.

The worker and reconciliation endpoints are scheduler-neutral. Production may
call them from the hosting provider's scheduler, GitHub Actions, or another
trusted scheduler using the internal worker secret. Their behavior does not
depend on a specific hosting vendor.

## Native planning model extension

Azure synchronization depends on a minimal native planning model shared by
linked and unlinked TaskFlow records.

Extend `tasks` with nullable planning fields:

- `planning_team_id`
- `work_item_type`: `epic`, `feature`, `story`, `bug`, or `task`
- `parent_task_id`
- `estimate_points`
- `backlog_rank`
- `planning_archived_at`

Existing tasks remain valid because these fields are nullable. Parent and child
records must belong to the same organization and planning team. Cycles are
rejected at the database boundary.

Add `planning_sprints` with:

- organization and planning-team ownership
- name, goal, start date, end date, and lifecycle state
- optional capacity metadata
- created/updated audit fields

Tasks may reference a planning sprint. Existing task and assignment behavior
continues to work when no planning team or sprint is assigned.

## Azure persistence model

### Connections

`azure_devops_connections` is organization-scoped and stores:

- Azure organization identifier and URL
- Entra tenant, authorized user, granted scopes, and connection status
- encrypted access token, encrypted refresh token, token expiry, nonce, and
  encryption-key version
- last successful sync, last reconciliation, paused reason, and audit fields

OAuth tokens use AES-256-GCM with a deployment-provided key. Plaintext tokens
exist only in server memory during an Azure request and never reach client
components, logs, action results, or browser responses.

### Team and record links

`azure_devops_team_links` maps one planning team to one Azure project and team.
It stores stable Azure identifiers, selected iteration root, process metadata,
state mappings, activation status, and service-hook subscription identifiers.
A planning team has at most one active Azure link.

`azure_devops_work_item_links` maps a TaskFlow task to an Azure work item and
stores the Azure ID, URL, current revision, last synchronized field hash, last
direction, and timestamps. Organization, connection, team, and task ownership
are immutable.

`azure_devops_sprint_links` maps a TaskFlow sprint to one Azure iteration ID and
path with the last observed Azure change marker.

`azure_devops_identity_mappings` stores normalized verified-email matches.
Unresolved Azure identities are retained as non-sensitive display metadata for
admin review and do not create invitations automatically.

### Delivery and audit tables

`azure_devops_sync_jobs` is the durable outbox. A job includes organization,
connection, entity, operation, expected Azure revision, deduplication key,
status, attempt count, lease, next-attempt time, safe error code, and trace ID.
Raw OAuth tokens are never stored in jobs.

`azure_devops_webhook_receipts` stores the connection, Azure event ID, event
type, resource identifiers, processing status, safe failure metadata, and
payload hash. Unique event IDs make webhook processing idempotent.

`azure_devops_conflicts` stores the entity link, expected and actual Azure
revisions, rejected local field patch, imported Azure field snapshot, status,
trace ID, and audit timestamps. Access is admin-only.

## Authorization and row-level security

- Only active organization admins can create, configure, reconnect, pause, or
  disconnect an Azure connection.
- Planning-team members can read synchronized planning data according to the
  existing planning-team rules.
- Connection tokens, webhook credentials, raw payloads, jobs, and worker leases
  are inaccessible to authenticated browser clients.
- Admin-facing queries expose sanitized connection health and safe errors only.
- Server-only functions authorize the organization and planning team before
  writing mappings or jobs.
- Organization identifiers and external ownership fields are immutable.
- All tables enable RLS and deny anonymous access.
- Webhook and worker endpoints use independent secrets and constant-time
  comparisons. OAuth callbacks validate signed, expiring, single-use state.

## Authentication and connection flow

The admin setup route is `/settings/integrations/azure-devops`.

1. TaskFlow generates signed OAuth state bound to the user, organization, and
   return path.
2. The admin signs in through Microsoft Entra delegated OAuth.
3. The callback validates state, exchanges the authorization code, encrypts
   tokens, and stores a pending connection.
4. TaskFlow discovers accessible Azure organizations, projects, and teams.
5. The admin selects one project, one team, and an iteration root.
6. TaskFlow discovers enabled work-item types and process states, normalizes
   state categories, and asks the admin to confirm the mapping.
7. TaskFlow previews verified-email identity matches and unresolved identities.
8. The admin starts the initial import.
9. After import succeeds, TaskFlow creates Azure work-item service-hook
   subscriptions and activates continuous synchronization.

The callback URL must use HTTPS outside local development. OAuth scopes are
limited to identity/profile access, work-item read/write, project/team read,
and service-hook administration required by the selected workflow.

## Initial import

Initial import is asynchronous and restartable:

1. Import the selected team's iterations under the configured iteration root.
2. Create or update TaskFlow sprints and iteration links.
3. Query supported work items in pages.
4. Import parent records before children when possible; unresolved parent links
   are repaired in a second pass.
5. Normalize fields and states, match assignees by verified email, and upsert
   tasks and Azure links transactionally.
6. Record import cursors and counts so a retry resumes without duplication.
7. Run reconciliation before marking the link active.

Users may continue using TaskFlow during import. The planning-team page shows
processed, remaining, warning, and failure counts.

## Field and state mapping

The first release synchronizes:

- work-item type and parent hierarchy
- title and description
- Azure state and normalized TaskFlow planning state
- priority
- story-point/effort estimate
- iteration/sprint
- assigned identity
- tags
- archived/removed status

Azure process templates vary. Setup queries the work-item-type and state APIs,
maps state categories to TaskFlow states, and stores the confirmed mapping on
the team link. Unsupported custom fields are ignored and never round-tripped.
Azure remains the display source for the exact external state name.

## Outbound synchronization

TaskFlow saves a linked edit and its outbox job in one transaction. The worker:

1. leases the next eligible job with `skip locked` semantics;
2. refreshes the Entra access token if needed;
3. loads the current link revision;
4. sends an Azure JSON Patch request using revision-based optimistic
   concurrency;
5. stores the returned revision and synchronized field hash;
6. marks the job complete and clears a matching pending indicator.

Creating a linked TaskFlow planning item creates the corresponding Azure work
item before finalizing its link. Updating a linked item patches Azure. Archiving
a linked item requests the configured Azure removed/closed state after explicit
confirmation; TaskFlow never requests permanent Azure deletion.

Transient network failures, rate limits, and Azure 5xx responses retry with
bounded exponential backoff and jitter. Authentication failures pause the
connection. Validation and permission failures become permanent safe errors.

## Inbound synchronization

Azure service hooks send work-item create, update, and removal events to:

`/api/integrations/azure-devops/webhooks/[connectionId]`

The handler:

1. requires HTTPS in non-development environments;
2. verifies connection-specific webhook credentials;
3. rejects oversized or malformed payloads;
4. records the Azure event ID before processing;
5. acknowledges already-recorded events;
6. fetches the authoritative work item from Azure rather than trusting all
   webhook fields;
7. applies the update only when the Azure revision is newer;
8. stores the revision/hash and completes the receipt.

If the inbound revision equals the revision returned by an outbound job, the
event is an acknowledgement and creates no new outbound job. This prevents
sync loops without requiring custom Azure fields.

## Conflict policy

Every outbound update includes the last known Azure revision. If Azure rejects
the patch because its revision advanced:

- TaskFlow fetches and imports the newer Azure record.
- The local rejected patch and both revisions are stored in a conflict record.
- The work item displays a warning with a safe explanation.
- Users may reapply their intended change against the new Azure revision.
- TaskFlow never automatically overwrites the newer Azure version.

This is the agreed Azure-wins behavior. Timestamp-based last-write-wins and
field-by-field automatic merging are out of scope.

## Reconciliation

`/api/internal/azure-devops/reconcile` is called on a schedule and on demand.
It validates connection health, walks changed Azure iterations and work items,
compares revisions and hashes, repairs missing links or webhook events, and
requeues safe outbound work. Reconciliation is paginated, resumable, and
bounded per invocation.

`/api/internal/azure-devops/process-jobs` leases and processes bounded job
batches. Both internal endpoints require the worker secret and return aggregate
counts rather than record payloads.

## User interface

The connection page shows:

- connected Azure organization, project, and team
- OAuth, webhook, import, and reconciliation health
- last successful sync
- queued, retrying, failed, and conflict counts
- unresolved identity mappings
- `Sync now`, `Reconnect`, `Pause`, and `Disconnect` actions

Planning teams gain an Azure DevOps section with mapping and health details.
Linked sprints and work items show a compact Azure badge, external ID/link,
last-sync time, and `pending`, `synced`, `warning`, or `failed` status.

Disconnect removes Azure service-hook subscriptions when possible, revokes or
invalidates stored tokens, cancels queued jobs, and unlinks the connection. It
preserves imported TaskFlow records as archived or unlinked data. Reconnection
requires mapping confirmation before synchronization resumes.

## Error handling and observability

All user-facing failures use the existing typed action-result shape with stable
codes, safe messages, trace IDs, and optional field errors. Azure response
bodies, OAuth tokens, secrets, and raw webhook payloads are never returned to
the browser or written to normal application logs.

Operational events record connection ID, organization ID, entity type,
external ID where safe, direction, duration, attempt, result code, and trace
ID. Health queries aggregate those records for admins without exposing secret
data.

## Feature flag and rollout

`azure_devops_integration` gates navigation, setup routes, callbacks, webhook
activation, worker processing, and synchronized-record controls.

- Development defaults on for local contract testing.
- Staging remains off until Entra credentials and a public HTTPS webhook URL
  are configured.
- Production remains off until a complete staging import, outbound update,
  inbound webhook, conflict, reconciliation, and disconnect exercise passes.
- Organization-scoped rollout may enable a single organization before global
  production rollout.

Required secrets are the Entra tenant/application identifiers, Entra client
secret, token-encryption key, internal worker/reconciliation secret, and public
application origin.

## Testing strategy

### Unit tests

- OAuth state validation and one-time use
- AES-GCM token encryption, decryption, and key versioning
- Azure type, field, state, and iteration mapping
- verified-email identity matching
- revision conflicts and Azure-wins behavior
- retry classification, backoff, and lease expiry
- event/job deduplication and loop prevention
- archive behavior and safe errors

### Database tests

- organization isolation and admin-only connection management
- server-only token, webhook, job, and conflict access
- immutable ownership and external mapping fields
- atomic task-plus-outbox writes
- job leasing and retry transitions
- idempotent webhook receipts
- planning-team visibility and cross-organization denial
- hierarchy integrity and cycle prevention

### Azure contract tests

A local fake Azure server verifies pagination, JSON Patch requests, revision
preconditions, `412` conflicts, token refresh, rate limiting, transient and
permanent errors, service-hook payloads, and malformed responses. Tests never
depend on a live Azure tenant.

### Browser tests

- mocked Entra connection and callback
- organization/project/team selection
- mapping and identity preview
- asynchronous import progress and completion
- pending and synchronized edits
- inbound webhook refresh
- conflict warning and retry
- manual synchronization, reconnect, pause, and disconnect

## Delivery sequence

1. Native planning model extension and database security.
2. Azure persistence, encryption, and connection health foundations.
3. Entra OAuth and Azure discovery client.
4. Setup wizard and team mapping.
5. Restartable initial import.
6. Transactional outbox and outbound updates.
7. Webhook ingestion and loop prevention.
8. Reconciliation, conflicts, retry controls, and health UI.
9. Full verification and feature-flagged rollout documentation.

## Completion criteria

- An organization admin can connect one Azure project/team through Entra OAuth.
- Existing iterations and the supported work-item hierarchy import without
  duplicates.
- TaskFlow edits synchronize to Azure with revision protection.
- Azure edits synchronize through service hooks.
- Reconciliation repairs missed webhook events.
- Revision conflicts preserve Azure and expose a retryable warning.
- Unmatched assignees remain unassigned and visible to admins.
- Removal archives linked data; no synchronized hard deletion occurs.
- Disconnect stops synchronization and preserves imported TaskFlow data.
- Database, unit, Azure contract, browser, type, lint, and production-build
  gates pass.

## External references

- [Microsoft Entra authentication for Azure DevOps](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/entra?view=azure-devops)
- [Azure DevOps webhooks](https://learn.microsoft.com/en-us/azure/devops/service-hooks/services/webhooks?view=azure-devops)
