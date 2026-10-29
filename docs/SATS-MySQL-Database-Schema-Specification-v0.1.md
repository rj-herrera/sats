# SATS — Proposed MySQL Database Schema Specification

**Status:** Planning baseline for review; **NOT an approved SQL migration or implementation authorization**  
**Version:** 0.1  
**Prepared:** 2026-10-27  
**System:** Submission and Approval Tracking System (SATS)  
**Target architecture:** React + Vite frontend; framework-free PHP REST API; MySQL/InnoDB; company SSO and read-only employee-directory integration  
**Source:** SATS planning decisions through Technical Review 5, and `SATS-Frontend-Codebase-Backend-Planning-Assessment.md` (Cursor's read-only assessment, dated 2026-10-23)

## 0. How to interpret this document

- **Approved principle:** Behavior or architectural choice explicitly accepted during SATS database planning.
- **Proposed physical detail:** Table/column/index definition recommended for validation, not yet approved as production DDL.
- **Open / verify:** Cannot be finalized without reviewing company infrastructure, the actual source code, or a remaining product choice.
- **No code changes are authorized by this document.** Ask Cursor to perform a read-only compatibility and feasibility assessment before preparing migrations.

All types/lengths shown below are **candidate** MySQL types. Employee, department, group, and position identifiers must be matched to the company database definitions. Use `utf8mb4`, InnoDB, and UTC timestamps in the SATS application, subject to company standards. The correct collation and MySQL/MariaDB engine/version must be checked.

## 1. Approved architecture and functional decisions

| Area | Approved principle |
|---|---|
| Employees | Stable company Employee ID; never maintain an independent employee master in SATS |
| Employee integration | Direct **read-only** access to company database; local development uses a safely sanitized/authorized copy |
| Organization | Unique Department IDs and Group IDs; each group belongs to a department; current employee group is authoritative for scoped permissions |
| Roles | Basic Employee rights for active employees; SATS-specific Admin, Approver, and group-scoped Template Manager assignments; Approver and Template Manager are **independent** |
| Templates | One owning group for group templates; configurable sharing by authorized group personnel or Admin; generic templates centrally managed |
| Form structure | JSON for dynamic form definitions/answers; relational tables for requests, workflow, revisions, attachments, and audit |
| Template versions | Immutable configurations; valid edit creates a new version; changes take immediate effect if template is Active; existing submissions and resubmissions keep original version |
| Approvers | Explicit employee or organizational position; per-position step resolution can use requester group/department or specific group/department |
| Request numbering | Company-wide annual sequence `SATS-YYYY-XXXXXX`; never reuse or change across revisions |
| Lifecycle | `Pending`, `Approved`, `Rejected`, `Returned`, `Cancelled`; requester may cancel **Pending or Returned** requests |
| Revisions | Every submitted version gets a distinct record, beginning with revision 1; resubmission restarts approval at step 1 and retains historical records |
| Request title | Optional; snapshot per revision; fall back to template name for display |
| Files | Protected application-server storage, metadata in MySQL; reuse unchanged physical files across revisions; new revisions may add/remove/replace attachments without modifying history |
| History | Separate request activity and system audit; selective before/after audit details |
| Notifications | Prepare notifications table; do not implement notification feature in initial backend integration |
| Deletion | Deactivate/revoke rather than normally physically delete historical business records; retention follows future company policy |
| Concurrency | MySQL transactions + locking + request `row_version` checks |
| Performance | Workload-based indexes, server pagination (initial proposal 20/page), `EXPLAIN` testing |
| Controlled statuses | `VARCHAR` with enforced `CHECK`, **conditional on compatible database version** |
| Environments/backups | Production on existing company MySQL infrastructure; development local; existing company backup system if it covers SATS DB **and files** |

### 1.1 Authentication boundary

Company SSO establishes identity through a **trusted integration mechanism** (technology not yet verified); SATS uses a secure server-side session/cookie. A separate web application must **not** trust an employee number stored in a browser cookie or assume it can directly consume another application's session cookie. PHP enforces authorization on every protected API action. Protect cookie-authenticated mutations against CSRF, use HTTPS, HttpOnly/Secure/SameSite cookies, and avoid sharing credentials with the frontend.

### 1.2 Company database boundary

No SATS-owned `employees`, `groups`, `departments`, or `group_members` tables are proposed. SATS stores their immutable identifiers as **logical external references**, validated via `EmployeeDirectoryService`. In this design, MySQL does not enforce foreign keys into the company database, even if the schemas are currently on the same server. Historical name/group/department snapshots are kept where needed for audit readability. Only SATS-internal relationships use MySQL foreign keys.

## 2. Complete table inventory (15)

| # | Table | Main responsibility |
|---:|---|---|
| 1 | `sats_roles` | SATS role catalogue |
| 2 | `sats_role_assignments` | SATS-specific employee permissions |
| 3 | `templates` | Template identity, ownership, visibility, activation, current version |
| 4 | `template_versions` | Immutable JSON form/workflow configuration |
| 5 | `template_allowed_groups` | Explicit group sharing grants |
| 6 | `requests` | Permanent request number, requester, current state |
| 7 | `request_number_sequences` | Company-wide annual number counter |
| 8 | `request_revisions` | Immutable submitted contents per revision, separately tracked outcome |
| 9 | `request_approval_assignments` | Resolved per-revision reviewer/approver work |
| 10 | `approval_decisions` | Immutable approval/reject/return decision per standard assignment |
| 11 | `stored_files` | Protected physical file identity and metadata |
| 12 | `request_attachments` | Revision-to-file associations |
| 13 | `request_activity` | Participant-visible event timeline |
| 14 | `system_audit_logs` | Administrative/configuration change history |
| 15 | `notifications` | Schema reserved for future in-app notifications |

## 3. Proposed table definitions

### 3.1 `sats_roles`

| Column | Candidate type | Rules |
|---|---|---|
| `role_code` | `VARCHAR(32)` | PK; e.g. `ADMIN`, `APPROVER`, `TEMPLATE_MANAGER` |
| `role_name` | `VARCHAR(100)` | NOT NULL |
| `description` | `VARCHAR(255)` | Nullable |
| `is_active` | `BOOLEAN` | NOT NULL, default TRUE |

Basic Employee access is inferred from active company identity, not assigned as a database role. SATS Admin **does not** inherently have blanket request-content visibility or approval authority. Approver designation **does not** automatically grant group template-editing rights; it grants eligibility to act only on a currently assigned, actionable approval.

### 3.2 `sats_role_assignments`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `employee_id` | `VARCHAR(64)` | NOT NULL; external company Employee ID |
| `role_code` | `VARCHAR(32)` | FK → `sats_roles.role_code` (RESTRICT) |
| `scope_type` | `VARCHAR(16)` | `GLOBAL` or `GROUP`; CHECK |
| `scope_id` | `VARCHAR(64)` | NOT NULL; `''` for GLOBAL, actual group ID for GROUP |
| `is_active` | `BOOLEAN` | NOT NULL, default TRUE |
| `assigned_by` | `VARCHAR(64)` | External Employee ID |
| `assigned_at` | `DATETIME(6)` | NOT NULL, UTC |
| `updated_by` | `VARCHAR(64)` | Nullable; external Employee ID |
| `updated_at` | `DATETIME(6)` | Nullable |

**Proposed constraints:** UNIQUE (`employee_id`, `role_code`, `scope_type`, `scope_id`), index (`employee_id`, `is_active`), CHECK ensuring (`scope_type='GLOBAL' AND scope_id=''`) OR (`scope_type='GROUP' AND scope_id<>''`). The nonnullable sentinel avoids MySQL allowing duplicates when a UNIQUE column is NULL. Prefer role-specific scope validation in PHP (e.g. Admin is global; Template Manager is group-scoped), or add corresponding database enforcement after reviewing desired role taxonomy.

**Transfer rule (approved):** Current company group determines effective group-scoped permissions; a previous group's assignment is retained but becomes ineffective after transfer. No automatic grant to new group; audited admin action may grant it. Consider explicit `revoked_at`/`revoked_by` as optional physical columns if audit reconstruction requires them.

### 3.3 `templates`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `name` | `VARCHAR(200)` | NOT NULL |
| `description` | `TEXT` | Nullable/required at activation: validate in PHP |
| `scope` | `VARCHAR(16)` | `GENERIC` or `GROUP`; CHECK |
| `owning_group_id` | `VARCHAR(64)` | NULL for GENERIC, mandatory for GROUP; external group reference |
| `status` | `VARCHAR(16)` | `ACTIVE` or `INACTIVE`; CHECK, default INACTIVE |
| `visibility_mode` | `VARCHAR(16)` | `ALL` or `SELECTED`; CHECK |
| `current_version_number` | `INT UNSIGNED` | Existing immutable version number; NOT NULL after initial version creation |
| `created_by` | `VARCHAR(64)` | External Employee ID |
| `created_at` | `DATETIME(6)` | NOT NULL |
| `updated_by` | `VARCHAR(64)` | External Employee ID |
| `updated_at` | `DATETIME(6)` | NOT NULL |

Indexes: (`owning_group_id`, `status`), optional (`scope`, `status`). Cross-field CHECK: GENERIC ↔ `owning_group_id IS NULL`; GROUP ↔ nonnull. **Open product validation:** Generic templates were conceptually intended for simple review/checking, but current TypeScript model can represent both workflows under either scope. Do not silently enforce a new scope/workflow coupling until reconciled.

The owner group has **implicit submit eligibility** for group templates. Explicit sharing is held in `template_allowed_groups`. **Open:** exact meaning/permitted use of `visibility_mode='ALL'` on a GROUP template; a conservative proposal is to use explicit sharing for group templates until approved.

### 3.4 `template_versions`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `template_id` | `BIGINT UNSIGNED` | FK → `templates.id` (RESTRICT) |
| `version_number` | `INT UNSIGNED` | NOT NULL; positive; UNIQUE with template_id |
| `fields_json` | `JSON` | NOT NULL; definition validated by PHP |
| `workflow_json` | `JSON` | NOT NULL; workflow validated by PHP |
| `created_by` | `VARCHAR(64)` | External Employee ID |
| `created_at` | `DATETIME(6)` | NOT NULL |

**Approved:** Versions are immutable after creation. A valid edit inserts version N+1 and atomically moves `templates.current_version_number` to it; if template is Active, new submissions use it immediately. If Inactive, it stays Inactive. Existing request revisions and resubmissions keep their original template version. Updating activation status or sharing alone does not create a new configuration version. Use transaction + expected version to prevent concurrent editors overwriting the active pointer. Database-level enforcement of immutable rows (permissions/triggers) is a later implementation choice; normal PHP APIs must never UPDATE/DELETE versions.

### 3.5 `template_allowed_groups`

| Column | Candidate type | Rules |
|---|---|---|
| `template_id` | `BIGINT UNSIGNED` | FK → `templates.id` (RESTRICT), composite PK |
| `group_id` | `VARCHAR(64)` | External Group ID, composite PK |
| `granted_by` | `VARCHAR(64)` | External Employee ID |
| `granted_at` | `DATETIME(6)` | NOT NULL |

Reverse index (`group_id`, `template_id`) for available-template query. Grant/revoke changes recorded in `system_audit_logs`. **Note:** Removing an active sharing grant is permitted and does not erase its audit history. This is an operational membership link, not immutable historical submission data. Group management/member administration is **out of scope**.

### 3.6 `request_number_sequences`

| Column | Candidate type | Rules |
|---|---|---|
| `year` | `SMALLINT UNSIGNED` | PK |
| `last_number` | `INT UNSIGNED` | NOT NULL, nonnegative |
| `updated_at` | `DATETIME(6)` | NOT NULL |

One company-wide sequence per year. Allocate number atomically with creation of request and first revision. Output `SATS-2026-000123`; increment under transaction/lock, unique `requests.request_number`, no reuse after cancellation. **Open:** define timezone for year rollover and how to handle a year exceeding 999,999 requests; never truncate or silently overflow.

### 3.7 `requests`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `request_number` | `VARCHAR(32)` | NOT NULL, UNIQUE |
| `template_id` | `BIGINT UNSIGNED` | FK → `templates.id` (RESTRICT) |
| `requester_employee_id` | `VARCHAR(64)` | External Employee ID, NOT NULL |
| `requester_name_snapshot` | `VARCHAR(200)` | NOT NULL at initial submit |
| `department_id_snapshot` | `VARCHAR(64)` | Company department at initial submit |
| `group_id_snapshot` | `VARCHAR(64)` | Company group at initial submit |
| `current_title` | `VARCHAR(255)` | Nullable; display template name if NULL/empty |
| `status` | `VARCHAR(16)` | NOT NULL; one of 5 agreed request statuses |
| `current_revision_number` | `INT UNSIGNED` | NOT NULL; starts at 1 |
| `row_version` | `INT UNSIGNED` | NOT NULL, starts at 1, increases on workflow mutation |
| `created_at` | `DATETIME(6)` | NOT NULL |
| `updated_at` | `DATETIME(6)` | NOT NULL |
| `completed_at` | `DATETIME(6)` | Nullable; final terminal time |
| `cancelled_by` | `VARCHAR(64)` | Nullable; employee ID |
| `cancelled_at` | `DATETIME(6)` | Nullable |
| `cancellation_reason` | `TEXT` | Nullable in schema; product/API validation TBD |

CHECK for `status IN ('Pending','Approved','Rejected','Returned','Cancelled')`, `current_revision_number>=1`, `row_version>=1`, and cancellation/terminal consistency where safely expressible. Index (`requester_employee_id`, `created_at`) and (`status`, `updated_at`). All business transitions are validated by PHP in a transaction.

**Approved transitions:** new→Pending; Pending→Approved/Rejected/Returned/Cancelled; Returned→Pending (new revision) or Cancelled; Approved/Rejected/Cancelled are terminal. Only original requester cancels Pending or Returned. Admin is not automatically allowed to view all request contents.

### 3.8 `request_revisions`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `request_id` | `BIGINT UNSIGNED` | FK → `requests.id` (RESTRICT) |
| `revision_number` | `INT UNSIGNED` | NOT NULL, >=1; UNIQUE with request_id |
| `template_version_id` | `BIGINT UNSIGNED` | FK → `template_versions.id` (RESTRICT) |
| `title` | `VARCHAR(255)` | Nullable, immutable once submitted |
| `field_definitions_json` | `JSON` | NOT NULL; immutable submitted snapshot |
| `field_values_json` | `JSON` | NOT NULL; immutable submitted answers |
| `workflow_snapshot_json` | `JSON` | NOT NULL; immutable configured workflow/resolution context |
| `submitted_by` | `VARCHAR(64)` | External Employee ID |
| `submitted_at` | `DATETIME(6)` | NOT NULL |
| `outcome` | `VARCHAR(16)` | Pending/Approved/Rejected/Returned/Cancelled; CHECK |
| `closed_at` | `DATETIME(6)` | NULL while actively pending; populated on terminal/return outcome |

**Immutability distinction:** Form content, title, selected template version, and configured workflow must never change after submission; only the revision's controlled outcome/closure fields may change. Keep prior revision 1 outcome `Returned` if the **request** is later cancelled while Returned (cancellation recorded on request/activity); if Pending is cancelled, close current pending revision as Cancelled. No new revision is created just to cancel. Each resubmission inserts revision N+1 with same template version as original, new answers/attachments, and fresh assignments; previous revisions stay untouched.

**Proposed consistency:** `request_revisions.template_version_id` must belong to `requests.template_id`; implement this check in PHP transaction (and possibly stronger composite referential design after DDL review). Optionally maintain `requests.current_revision_id` as a validated pointer instead of relying only on `(request_id,current_revision_number)` if join/performance testing demonstrates a need.

### 3.9 `request_approval_assignments`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `request_revision_id` | `BIGINT UNSIGNED` | FK → `request_revisions.id` (RESTRICT) |
| `assignment_key` | `VARCHAR(100)` | Stable key within revision; UNIQUE with request_revision_id |
| `step_order` | `SMALLINT UNSIGNED` | NOT NULL; repeated order allowed for parallel reviews |
| `role_label` | `VARCHAR(100)` | Optional descriptive label |
| `assignment_type` | `VARCHAR(16)` | `EMPLOYEE` or `POSITION`; CHECK |
| `configured_employee_id` | `VARCHAR(64)` | Nullable; for EMPLOYEE assignment |
| `configured_position_code` | `VARCHAR(64)` | Nullable; for POSITION assignment |
| `resolution_scope` | `VARCHAR(32)` | Nullable; requester group/department or specified group/department |
| `resolution_scope_id` | `VARCHAR(64)` | Nullable; specific group/department ID when applicable |
| `resolved_employee_id` | `VARCHAR(64)` | NOT NULL; actual assignee at submit |
| `employee_name_snapshot` | `VARCHAR(200)` | Display name at assignment |
| `status` | `VARCHAR(20)` | At least Waiting, Pending, Approved, Rejected, Returned; CHECK list finalization needed |
| `activated_at` | `DATETIME(6)` | Nullable |
| `created_at` | `DATETIME(6)` | NOT NULL |

Indexes: (`resolved_employee_id`, `status`, `request_revision_id`); (`request_revision_id`, `step_order`). CHECK conditional configured employee/position fields; specify exact `resolution_scope` string values during DDL review. The exact current company position lookup may require a company directory view or maintained position mapping; **do not claim it works until verified**.

For review/checking, selected reviewers act in parallel; all must approve for final approval, any reject/return ends the revision. Hierarchy has one currently actionable stage, later stages Waiting. Assignments from a prior revision remain historical. A request no longer Pending renders residual Pending/Waiting assignments **non-actionable**; decision about a dedicated `Closed`/`Skipped` assignment status is still open. Existing frontend keeps some residual tasks Pending/Waiting on early closure.

### 3.10 `approval_decisions`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `assignment_id` | `BIGINT UNSIGNED` | FK → `request_approval_assignments.id` (RESTRICT); UNIQUE for single final decision |
| `decision` | `VARCHAR(16)` | `APPROVE`, `REJECT`, `RETURN`; CHECK |
| `decided_by` | `VARCHAR(64)` | External Employee ID |
| `remarks` | `TEXT` | Required for REJECT/RETURN in PHP; optional for APPROVE |
| `decided_at` | `DATETIME(6)` | NOT NULL |

Decisions are append-only. The unique assignment ID prevents duplicate final decisions. Actor must match eligible resolved assignee unless an explicitly approved reassignment/delegation policy is later added. Never accept client-supplied approver ID as proof of identity. Create decision, update assignment and revision/request states, and insert request activity within a single transaction.

### 3.11 `stored_files`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `storage_key` | `VARCHAR(255)` | NOT NULL, UNIQUE; opaque server-generated reference |
| `original_filename` | `VARCHAR(255)` | NOT NULL; never use as disk path |
| `mime_type` | `VARCHAR(150)` | NOT NULL; determined/validated server-side |
| `file_size` | `BIGINT UNSIGNED` | NOT NULL |
| `checksum_sha256` | `CHAR(64)` | NOT NULL; integrity reference |
| `uploaded_by` | `VARCHAR(64)` | External Employee ID |
| `uploaded_at` | `DATETIME(6)` | NOT NULL |

File bytes stored outside Nginx's public root; access only via authenticated/authorized PHP download. Validate allowed types, size and content; consider malware scanning per company security policy. **Open operational detail:** staged uploads, scan status, orphan cleanup, retention/backup coordination; DB transactions cannot make filesystem writes atomically reversible.

### 3.12 `request_attachments`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `request_revision_id` | `BIGINT UNSIGNED` | FK → `request_revisions.id` (RESTRICT) |
| `stored_file_id` | `BIGINT UNSIGNED` | FK → `stored_files.id` (RESTRICT) |
| `field_id` | `VARCHAR(100)` | Nullable; refers to JSON-defined field key |
| `created_at` | `DATETIME(6)` | NOT NULL |

Index (`request_revision_id`), (`stored_file_id`). Validate field identifier and permitted file count/type in PHP against the revision's immutable field definitions; cannot enforce external JSON field identifier using simple FK. Multiple revisions may reference same `stored_file_id`. On resubmit, carry attachments forward unless requester removes/replaces/adds them; previous links stay unchanged. Cleanup may delete an orphaned physical file only after verifying **no references** and applying retention/incident requirements.

### 3.13 `request_activity`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `request_id` | `BIGINT UNSIGNED` | FK → `requests.id` (RESTRICT) |
| `request_revision_id` | `BIGINT UNSIGNED` | Nullable FK → `request_revisions.id` (RESTRICT) |
| `event_type` | `VARCHAR(50)` | NOT NULL; controlled by PHP contract |
| `actor_employee_id` | `VARCHAR(64)` | External Employee ID |
| `actor_name_snapshot` | `VARCHAR(200)` | Historical name |
| `description` | `TEXT` | NOT NULL or rendered from event metadata |
| `remarks` | `TEXT` | Nullable |
| `related_decision_id` | `BIGINT UNSIGNED` | Nullable FK → `approval_decisions.id` (RESTRICT) |
| `metadata_json` | `JSON` | Nullable; minimal non-sensitive event details |
| `created_at` | `DATETIME(6)` | NOT NULL |

Index (`request_id`, `created_at`, `id`). Append-only request history visible only to authorized request participants. Keep `approval_decisions` as authoritative fact source for decisions; activity is the user-visible timeline. Event vocabulary should be mapped against actual frontend `ACTIVITY_EVENT_TYPES` before API cutover.

### 3.14 `system_audit_logs`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `actor_employee_id` | `VARCHAR(64)` | Nullable for trusted system action |
| `actor_name_snapshot` | `VARCHAR(200)` | Nullable |
| `action` | `VARCHAR(100)` | NOT NULL |
| `entity_type` | `VARCHAR(50)` | NOT NULL |
| `entity_id` | `VARCHAR(64)` | NOT NULL |
| `description` | `TEXT` | Nullable |
| `old_values_json` | `JSON` | Nullable; selective relevant prior values |
| `new_values_json` | `JSON` | Nullable; selective relevant new values |
| `ip_address` | `VARCHAR(45)` | Nullable |
| `created_at` | `DATETIME(6)` | NOT NULL |

Indexes: (`entity_type`, `entity_id`, `created_at`) and/or (`actor_employee_id`, `created_at`) as needed. Audit template version pointers, visibility changes, activation, and role grants/revocations. Exclude cookies, credentials, secrets and unnecessary personal/form content. Append-only for normal application users; additional tamper resistance / access controls are an operational follow-up.

### 3.15 `notifications`

| Column | Candidate type | Rules |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK |
| `recipient_employee_id` | `VARCHAR(64)` | External Employee ID |
| `request_id` | `BIGINT UNSIGNED` | Nullable FK → `requests.id` (RESTRICT) |
| `notification_type` | `VARCHAR(50)` | NOT NULL |
| `title` | `VARCHAR(200)` | NOT NULL |
| `message` | `TEXT` | NOT NULL |
| `metadata_json` | `JSON` | Nullable |
| `created_at` | `DATETIME(6)` | NOT NULL |
| `read_at` | `DATETIME(6)` | Nullable |

Index (`recipient_employee_id`, `read_at`, `created_at`). Table included in initial database specification; **notification generation, delivery and UI remain out of initial backend scope**. Avoid generating placeholder notifications until the corresponding feature is authorized.

## 4. Integrity, concurrency and read behavior

### 4.1 Foreign keys and deletion

All SATS-owned parent-child relations above use **RESTRICT / NO ACTION** for historical records; no `ON DELETE CASCADE` on submissions, decisions, revisions, template versions, or stored files. Templates are deactivated, roles revoked, requests cancelled. Operational grants may be physically removed but the change is recorded in system audit. Future policy-driven retention/archival is a separate controlled administrative workflow.

### 4.2 Key constraints and statuses

- `requests.request_number` UNIQUE, `request_number_sequences.year` PK.
- `template_versions(template_id, version_number)` UNIQUE, positive version number.
- `request_revisions(request_id, revision_number)` UNIQUE, positive revision number.
- `template_allowed_groups(template_id, group_id)` composite PK.
- `sats_role_assignments(employee_id, role_code, scope_type, scope_id)` UNIQUE with non-NULL group scope placeholder for GLOBAL.
- `request_approval_assignments(request_revision_id, assignment_key)` UNIQUE; do **not** make stage order unique because reviews may be parallel.
- `approval_decisions.assignment_id` UNIQUE for ordinary one-decision-per-assignment rules.
- Controlled string statuses use `VARCHAR` + enforced CHECK (never assume enforcement without engine verification).
- Template current-version pointer, revision current pointer, and multi-table consistency enforced atomically in PHP; consider composite FKs only after ERD/DDL feasibility review.

**Proposed request-status CHECK:** `('Pending','Approved','Rejected','Returned','Cancelled')`. **Proposed template-status CHECK:** `('ACTIVE','INACTIVE')`. Assignment-status vocabulary and closure behavior need final mapping to frontend and agreement before CHECK migration. All authorization and transitions remain PHP responsibilities even when CHECK constraints exist.

### 4.3 Critical workflow transaction

1. Authenticate through trusted company SSO session; obtain actor Employee ID server-side.
2. Begin MySQL transaction; `SELECT ... FOR UPDATE` on the relevant `requests` row.
3. Verify expected `row_version`, current overall status, current revision, actor's active company status and permissions, and actionable assignment/ownership.
4. Update the correct assignment/revision/request state, insert the immutable decision where applicable, write request activity, and increase `row_version`.
5. Commit; on rule/version failure, roll back and return an explicit conflict/validation response.

This serializes conflicting actions. A stale parallel approver may need to refresh before acting, even if the assignment remains valid. Protect request creation from duplicate browser retries using an API idempotency strategy decided during API design. Use consistent transaction/lock ordering to reduce deadlocks, and safely retry only transactions that are idempotent.

### 4.4 Invariants to test

- Request numbers remain unique under concurrent submissions and annual rollover.
- Only owner can cancel Pending or Returned, not Approved/Rejected/Cancelled.
- A rejected/returned/cancelled request cannot accept subsequent normal approval actions.
- All parallel reviewers must approve for a successful generic review; any reject/return closes the revision.
- Hierarchy steps advance in order; Waiting assignments cannot act.
- Resubmit creates revision N+1, restarts approval from first stage, and retains original template version, title/field/history snapshots for all prior revisions.
- Previous decisions and stored file references are never overwritten or deleted by resubmit.
- Template edits create N+1 and do not affect existing requests.
- Admin cannot read arbitrary request content solely by being Admin.
- A group-scoped manager loses effective old-group permission following transfer; prior audit remains.

## 5. Workload-based indexes and list queries

| Query | Starting index / strategy |
|---|---|
| My Requests | `requests(requester_employee_id, created_at)`; mandatory server filter + pagination |
| Request lookup | UNIQUE `requests(request_number)` or PK `id`, followed by server ACL |
| Status-filtered views | `requests(status, updated_at)` only for permission-appropriate queries |
| Action Inbox | `request_approval_assignments(resolved_employee_id, status, request_revision_id)` joined to revisions/requests; filter actual actability server-side |
| Template owner management | `templates(owning_group_id, status)` |
| Shared template availability | reverse index `template_allowed_groups(group_id, template_id)` |
| Request revisions | UNIQUE `(request_id, revision_number)` supports chronological retrieval |
| Request timeline | `request_activity(request_id, created_at, id)` |
| Notifications later | `notifications(recipient_employee_id, read_at, created_at)` |

Validate with realistic, sanitized datasets using `EXPLAIN` and representative SQL. Do not index arbitrary form JSON by default. Consider derived/functional indexes only if later verified queries require them. Proposed starting page size: 20; exact pagination contract and sort tie-breakers to be determined in API design.

## 6. Current React frontend compatibility and expected changes

The 2026-10-23 Cursor assessment describes a React SPA using mock repositories and localStorage, **not** an existing network API. Keep the UI but replace mock service I/O with asynchronous REST calls. Use stable backend response shapes aligned with `src/types/` where possible.

| Area | Current implementation / known difference | Backend/frontend action |
|---|---|---|
| Employee identity | Mock session/localStorage user switching | Replace with trusted SSO/session `/auth/me`; remove demo switcher in production |
| Roles | Approver also manages group templates | Separate `APPROVER` and group-scoped `TEMPLATE_MANAGER` UI permissions |
| Status transitions | Frontend cancels Pending only | Update to approved cancellation from Pending **and Returned** |
| Templates | In-place updates + numeric counter | API uses immutable `template_versions`; surface currently effective version |
| Request revisions | Embedded snapshots in localStorage | API maps relational rows to frontend-compatible details/history |
| Request title | No separate universal title confirmed | Add optional title field/display; revision snapshot |
| Position-based hierarchy | Explicit assignee Employee IDs only | UI/service must support step type and resolution scope; dependent on real company directory schema |
| Attachments | Data URLs/static sample URLs | Real secure upload/download and revision-to-file references |
| Concurrency | Blind overwrite in mock | Expected `row_version` + conflict message/reload |
| Audit/security | Client-only permissions | Server-side checks, request activity, system audit, CSRF, validation |
| Notifications | No implemented frontend notification layer | Table only initially; defer runtime feature |

**API candidate (not yet approved):** same-origin `/api/v1/` REST endpoints for `/auth/me`, `/users`, `/groups`, `/templates`, `/requests`, `/requests/{id}/decisions`, `/requests/{id}/resubmit`, `/requests/{id}/cancel`, `/inbox`, `/attachments/{id}`. Endpoints are for future separate API-contract planning, not implementation authorization. Avoid assuming a password-based `POST /auth/login` when company SSO is intended.

## 7. Required verifications before migrations / backend implementation

### 7.1 Infrastructure — verify with IT / Cursor

1. **Actual production engine/version:** MySQL vs MariaDB; check `SELECT VERSION()` and `@@version_comment`; confirm `CHECK` enforcement, JSON behavior, InnoDB, charset/collation, transactional settings. MySQL enforces CHECK constraints from **8.0.16** onward; MariaDB differs.
2. **Company directory schema:** exact Employee, Department, Group, Position IDs, data types/lengths/charsets, joins, active/inactive designations and duplicate-position possibilities; inspect metadata/sample sanitized rows only, not credentials.
3. **SSO integration:** supported company identity protocol and trustworthy mapping to Employee ID, cookie domains, session expiry, CSRF, HTTPS, logout behavior.
4. **Database separation:** where dedicated SATS schema/database resides; restricted DB user for read/write SATS records and separate read-only company directory account/connection.
5. **Local testing:** legally/policy permitted sanitized company database copy (no unprotected production PII); distinguish local dev from production config.
6. **Backups:** existing backup system covers SATS MySQL AND filesystem, restore testing, backup frequency/recovery goals, and company retention policy.

### 7.2 Functional/product decisions intentionally still open

1. **Scope/workflow coupling:** Whether generic scope must exclusively use simple parallel review (product intent) or retain type-level flexibility from current frontend.
2. **Template visibility:** Exact rules for `visibility_mode='ALL'` on GROUP templates and group-owner implicit access.
3. **Position resolution:** How to resolve selected position and scope from company directory; zero or multiple matches, unavailable/inactive people, transfers, substitutes/delegation/reassignment.
4. **Residual assignments:** When request is returned/rejected/cancelled, leave Waiting/Pending historical assignments non-actionable (frontend behavior) or introduce a distinct closure state.
5. **Cancellation reason:** Required or optional; how to represent cancel of already Returned revision vs current request status.
6. **Reviewer changes on resubmit:** Earlier frontend locks reviewers; keep until explicitly reconsidered.
7. **File policy:** Allowed extensions/content types, maximum sizes/counts, malware scanning, upload staging and orphan cleanup.
8. **Retention and audit:** Official company retention periods, archival/tamper-resistance, access audit policy.
9. **Numbering year:** Company timezone for Jan 1 rollover, overflow policy for 6-digit sequence.
10. **Operational UI:** Handling stale version response, loading/errors, whether admins ever get emergency audited access.

These items do **not** invalidate the conceptual model; they must be resolved at the appropriate implementation step. Do not silently lock them in SQL migration defaults where they affect business behavior.

## 8. Proposed read-only Cursor assessment request

Before writing schema migrations, ask Cursor to:

1. Compare these 15 proposed tables and their relationships with actual React types/services/tests and identify mismatches or missing columns.
2. Verify the local company database metadata and engine/version **read-only**; never print credentials, secrets, or raw personal records.
3. Identify which of the open points require product decisions versus technical implementation choices.
4. Recommend any changes to indexes, FKs, constraints, transaction boundaries and file lifecycle.
5. Produce a gap/risk report and a corrected candidate DDL plan **without changing code or databases**.

**Explicit stop condition:** Do not implement, run migrations, change schema, or refactor React until the owner reviews and approves the assessment.

---

**Next milestone:** Cursor compatibility/database feasibility assessment → discuss open findings → finalized SQL DDL/migration plan → phased backend implementation after authorization.
