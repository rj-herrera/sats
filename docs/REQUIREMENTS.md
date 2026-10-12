# SATS Requirements (MVP)

Functional and domain requirements for the Submission and Approval Tracking System. Phase 1.1 captures intent; detailed field-level specs for each template will be defined when templates are implemented in PHP.

## User Roles (Application)

Application **roles** govern what a user may do in the system. They are separate from **organizational positions** (job titles / hierarchy used in group-specific approval chains).

| Role | Description |
|------|-------------|
| **Requester** | Any authenticated user who may create submissions on templates they are allowed to use (default capability for standard users). |
| **Reviewer / Approver** | Users assigned tasks on submissions; act via inbox actions (not a single global role — assignment is contextual). |
| **Group Leader / Manager (authorized)** | May manage group-scoped templates **only when** granted the application permission `manage_group_templates` (or equivalent). Organizational title alone does **not** grant template management. May also act as approver when hierarchy requires. |
| **System Administrator** | Manages users, groups, global settings, generic templates, system-wide template administration, and full audit visibility within policy. |

Additional named roles may be introduced only if needed for permission bundles; MVP should keep the matrix small and enforce via services.

### Template usage vs Template Management

| Audience | Can do | Cannot do |
|----------|--------|-----------|
| **Normal employee** | Open **New Submission**, see ready-to-use forms, select an eligible generic or group-specific template, complete and submit | Create/edit templates, change approval hierarchies, open Template Management |
| **Holder of `manage_group_templates`** (authorized Group Leader / Manager) | Use **Template Management** for groups they are authorized to manage; configure supported workflow settings for those group templates | Automatically inherit rights from job title alone |
| **System Administrator** | Manage **generic** templates; authorized system-wide template administration; User Management; Group Management; System Settings | — |

There is **no** standalone employee-facing Templates page. Template selection belongs inside the **New Submission** workflow.

Global (generic) template administration remains conceptually separate from group-scoped template management. Exact permission storage is finalized during backend development.

## Groups and Organizational Positions

- The system supports **multiple company groups**; data and templates may be scoped to a group.
- **Group membership** is an explicit relationship (user ↔ group), not inferred from department text fields.
- **Organizational positions** (e.g. Leader, Assistant Manager, Department Manager) are defined per group or company convention and may be used when resolving sequential approvers (see stage assignment below).
- A user may belong to multiple groups; submissions and templates are evaluated in group context.

## Template Categories

### 1. Generic templates

- Available to **all groups** (subject to user being authenticated and template being active).
- **Template form fields** are **manually defined in PHP** for the MVP (not a drag-and-drop form builder).
- Used for simple checking or review.
- Requester selects **one or more reviewers**.
- Reviews occur **in parallel**.
- **All** assigned reviewers must **approve** for final approval.
- Reviewers may **Approve**, **Reject**, or **Return for Revision**.
- Managed by **System Administrators**.

### 2. Group-specific templates

- Available only to members of the **owning group**.
- Managed by users with **`manage_group_templates`** (authorized Group Leaders / Managers) and/or **System Administrators** — not by organizational title alone.
- **Template form fields** are **manually defined in PHP** for the MVP (not a drag-and-drop form builder). This applies to the fixed fields on the template itself.
- **Approval hierarchy** is configured on the template (ordered stages). Each stage’s approver target is configured on the template; resolution rules are not fully specified at Phase 1.1 (see [DECISIONS.md](DECISIONS.md)).
- Approvals proceed **sequentially**; requesters cannot bypass required stages.
- Example hierarchy: Leader → Assistant Manager → Department Manager → IT Manager → Senior Manager.

Each template type must be versioned or snapshotted at submission time so historical submissions reflect the rules and fields at creation.

## Core Functional Requirements

### Authentication and accounts

- Users sign in with credentials stored using secure password hashing.
- Session-based authentication; sign out invalidates session.
- Account management: administrators can create/disable users; users may change password where policy allows (MVP scope: admin-provisioned accounts acceptable if stated during setup).

### Groups, positions, permissions

- CRUD for groups (admin); assign users to groups.
- Define organizational positions and map users to positions within a group as needed for routing.
- Configure which roles may manage which templates.

### Templates

- Create, edit, activate/deactivate generic templates (admin).
- Create, edit, activate/deactivate group-specific templates (users with `manage_group_templates` and/or System Administrators).
- Define parallel reviewer selection rules for generic templates.
- Define sequential stages for group-specific templates. A stage may eventually reference a **specific assigned employee**, an **organizational position**, or a **position associated with a designated company group** (exact assignment and resolution rules are open until workflow implementation).

### Submissions

- Create submission from allowed template; populate **template fields** defined in PHP for that template.
- Where the template permits it, requesters may add **simple submission-specific additional fields** (e.g. extra labeled values attached to that submission only). This is a **planned MVP capability** to be finalized during **Phase 4 — Submission Creation and Forms**; storage, validation, and UI details are **not decided** in Phase 1.1. This does **not** require a dynamic form-builder interface.
- Attach one or more files; generate a **reference number** per submission (unique, human-readable format TBD in implementation).
- View submission detail, progress, and history.
- **Conditional withdrawal:** requesters (or policy-defined actors) may withdraw a submission when eligibility rules allow. **Exact withdrawal eligibility is not finalized** at Phase 1.1 (see [DECISIONS.md](DECISIONS.md)).

### Workflows

- **Parallel (generic):** create tasks for all selected reviewers; track partial completion; finalize when all approve or when any reject/return triggers configured outcome.
- **Sequential (group-specific):** activate first stage only; on approve, activate next stage; enforce no skip.
- **Inbox / Needs My Action:** list open tasks for current user with filters.
- **My Submissions:** list requester’s submissions with status.

### Decisions

- **Approve:** record decision; comments and whether they are required are subject to template/policy rules not fully specified at Phase 1.1.
- **Reject:** record rejection; downstream status and whether the submission may continue in a new round are **workflow rules to be confirmed** during workflow implementation (see [DECISIONS.md](DECISIONS.md)).
- **Return for Revision:** return to requester with comments; submission enters a revision state pending resubmission.

### Revision and resubmission

- Requester edits allowed fields and attachments per rules.
- **New review round** starts after resubmission; prior round decisions, comments, and attachments remain visible in history.
- Sequential workflows after resubmission: **whether approval restarts at Stage 1 or another stage is unconfirmed** ([DECISIONS.md](DECISIONS.md), OQ-1).

### Tracking and history

- Show current status, active stage or pending reviewers, and completed steps.
- **Action history:** chronological business events visible to authorized viewers on **Submission Details** (no standalone Action History page in the MVP).
- **Administrative audit log:** configuration and security-relevant events for admins.

## MVP Page Inventory (Phase 1.4A)

Default landing page after sign-in: **My Submissions** (`/`). There is **no** separate Dashboard page in the MVP.

### Main employee pages

| # | Page | Purpose |
|---|------|---------|
| 1 | **My Submissions** | List the current user’s submissions and statuses (default home). |
| 2 | **New Submission** | Choose an available generic or eligible group-specific template, then complete and submit the form. |
| 3 | **Submission Details** | Submission information, attachments, approval progress, action history, and revision/resubmission UI when applicable. |
| 4 | **Needs My Action** | Inbox of review/approval tasks assigned to the current user. |
| 5 | **Review Submission** | Act on a single assigned task (approve / reject / return). |
| 6 | **Notifications** | In-app notification list (opened from the **header bell**, not the primary sidebar). |
| 7 | **My Profile** | Account/profile settings (accessed from the **header profile area**, not the primary sidebar). |

### Management / administration pages

| # | Page | Who (conceptually) |
|---|------|--------------------|
| 8 | **Template Management** | Holders of `manage_group_templates` (group-scoped) and System Administrators (plus generic / system-wide template admin). Shown once in nav even if permissions overlap. |
| 9 | **User Management** | System Administrators |
| 10 | **Group Management** | System Administrators |
| 11 | **System Settings** | System Administrators |

### Supporting pages

- **Login**
- **404 / Error**

### Sidebar structure (by audience)

- **Employee:** My Submissions, New Submission, Needs My Action. (Notifications → header bell; My Profile → header profile area.)
- **Management** (authorized Group Leader / Manager preview): Template Management.
- **Administration** (System Administrator): Template Management, User Management, Group Management, System Settings.

Pages above (except the temporary home showcase and 404) are **not implemented** in Phase 1.4A — inventory and navigation alignment only.

### Notifications

- Basic **in-app notifications** when user receives a new task or when submission they own changes state materially.
- Mark as read; link to relevant submission/task.

## Approval and Revision Rules

| Rule | Generic (parallel) | Group-specific (sequential) |
|------|--------------------|-----------------------------|
| Assignment | Requester picks reviewer set | System assigns by stage from hierarchy |
| Concurrency | All reviewers active at once | One stage active at a time |
| Pass condition | All approve | Each stage approves in order |
| Reject | Recorded; outcome rules TBD | Recorded; outcome rules TBD |
| Return | Requester revises; new round | Requester revises; new round |
| Bypass stages | N/A | Not allowed |

- Decisions are recorded with actor, timestamp, and optional comment.
- Critical transitions use database transactions to avoid double approval or lost tasks.

## Conceptual Status Lifecycle

Statuses are conceptual for MVP design; exact enum names may differ in code.

```
                    ┌──────────────┐
                    │    Draft     │ (optional: if save-draft supported)
                    └──────┬───────┘
                           │ submit
                    ┌──────▼───────┐
         ┌──────────│  In Review   │──────────┐
         │          │ / In Approval│          │
         │          └──────┬───────┘          │
         │ return        │ approve path      │ reject
         │               │                   │
  ┌──────▼──────┐  ┌─────▼─────┐      ┌──────▼──────┐
  │  Revision   │  │  Approved │      │  Rejected   │
  │  Required   │  └───────────┘      └─────────────┘
  └──────┬──────┘
         │ resubmit
         └──► new round → In Review / In Approval

  Withdrawn (when eligibility rules allow — details TBD)
```

- **In Review / In Approval:** umbrella active state while tasks are open (wording may differ by template type).
- **Revision Required:** returned to requester; no pending approver tasks until resubmission.
- **Approved / Rejected:** outcomes after successful completion or rejection; whether rejected submissions are terminal for the entire request is **not finalized** at Phase 1.1. History is retained regardless.
- **Withdrawn:** cancellation outcome when permitted; **exact eligibility rules are open** (see [DECISIONS.md](DECISIONS.md)).

## MVP Boundaries (Out of Scope)

The following are **not** required for MVP unless explicitly promoted in a later phase:

- Drag-and-drop form builder or ad hoc template fields defined by end users without developer PHP changes (distinct from **submission-specific additional fields** on PHP-defined templates, which remain a planned MVP item).
- Email/SMS/push notifications (in-app only for MVP).
- Mobile native apps.
- Full-text search across attachments.
- Multi-language UI.
- External SSO (LDAP/OAuth) — may be deferred; local accounts first.
- Delegation (“approve on behalf of”) and substitute approvers.
- SLA timers, escalations, and automatic rerouting.
- Complex workflow engine with arbitrary graphs (only parallel-all and fixed sequential chains).
- Public/anonymous submissions.
- React/SPA as the primary UI paradigm.

## Non-Functional Expectations (MVP)

- Reasonable performance for internal user counts on XAMPP/MySQL.
- Server-side validation on all writes.
- Uploaded files stored outside public web root.
- Auditability of admin actions and submission decisions.
