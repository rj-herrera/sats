# SATS Architecture

This document describes the intended technical architecture for SATS at Phase 1.1. It is a design reference only; no application code exists yet.

## Design Goals

- Keep approval and workflow **business rules on the server** (services layer), not in views or frontend TypeScript.
- Use a **simple modular MVC-style** PHP application without a full framework.
- Separate **application roles** from **organizational positions**; tie group access to explicit membership.
- **Snapshot** template and workflow configuration when a submission is created so later template edits do not rewrite history.
- Preserve **review rounds**, decisions, comments, and attachment history as append-only or versioned records where appropriate.
- Use **database transactions** for critical approval state changes.
- Apply **defense in depth**: sessions, password hashing, CSRF, authorization checks, and PDO prepared statements.

## Simplified MVC Overview

```
                    ┌─────────────┐
   HTTP Request ──► │   Router    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Controller  │  HTTP I/O, flash messages, redirects, status codes
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │  Services   │ │ Models│ │   Views     │
       │ (domain +   │ │ (data │ │ (PHP HTML + │
       │  workflow)  │ │ access)│ │  partials)  │
       └──────┬──────┘ └───┬───┘ └─────────────┘
              │            │
              └────────────┼────────────► MySQL (PDO)
                           │
                    ┌──────▼──────┐
                    │ File store  │  (outside web root)
                    └─────────────┘
```

### Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Router** | Map HTTP method and path to controller actions; apply middleware-style checks (auth, CSRF) before controllers run. |
| **Controllers** | Parse and validate request input at the HTTP boundary; call services; choose views or JSON fragments for TypeScript-driven partial updates if needed; never embed workflow rules. |
| **Services** | Orchestrate use cases: create submission, assign tasks, record decision, advance sequential stage, open revision round, withdraw, notify. Enforce authorization using role + group + position context. Manage transactions. |
| **Models** | Encapsulate table-oriented access: queries, inserts, updates via PDO prepared statements. Thin data access; no HTML. |
| **Views** | Server-rendered PHP templates composing layout, forms, and lists. Display data prepared by controllers; minimal logic (formatting, loops). |

Frontend **TypeScript** (built with Vite) enhances UX: client validation for convenience only, dynamic form sections, inbox refresh patterns, etc. **Authoritative validation and authorization remain server-side.**

## Proposed Directory Structure

Structure is proposed for implementation in a later phase; paths may be refined during bootstrap.

```
sats/
├── public/                 # Web root (index.php, built assets only)
│   ├── index.php           # Front controller
│   └── assets/             # Vite build output (CSS/JS)
├── storage/                # Non-public: uploads, logs (outside public/)
├── app/
│   ├── Config/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/     # Auth, CSRF, etc.
│   │   └── Router.php
│   ├── Models/
│   ├── Services/
│   │   ├── Auth/
│   │   ├── Submission/
│   │   ├── Workflow/
│   │   ├── Notification/
│   │   └── Audit/
│   ├── Support/            # Helpers, CSRF, session wrapper
│   └── Views/
│       ├── layouts/
│       ├── auth/
│       ├── submissions/
│       └── ...
├── resources/
│   ├── css/                # Tailwind entry
│   └── ts/                 # TypeScript sources
├── database/               # SQL scripts or migrations (later phase)
├── docs/
├── tests/                  # Optional, later
├── composer.json           # (later)
├── package.json            # (later)
└── vite.config.ts          # (later)
```

**Bootstrap note:** Only `public/` should be exposed by Apache. `storage/` and application source live above or beside the web root per deployment choice; the principle is that uploaded binaries are not directly URL-guessable under `/uploads` in public.

## Planned Application Routes (MVP)

Documented in Phase 1.4A. **Only `/` is implemented today** (temporary My Submissions landing / UI showcase). Other paths must not be registered until their pages are built.

| Route | Page | Status |
|-------|------|--------|
| `/` | My Submissions (default landing) | Implemented (showcase placeholder until Phase 1.5) |
| `/submissions/new` | New Submission | Planned |
| `/submissions/{id}` | Submission Details | Planned |
| `/my-actions` | Needs My Action | Planned |
| `/my-actions/{id}` | Review Submission | Planned |
| `/notifications` | Notifications | Planned |
| `/profile` | My Profile | Planned |
| `/manage/templates` | Template Management | Planned |
| `/admin/users` | User Management | Planned |
| `/admin/groups` | Group Management | Planned |
| `/admin/settings` | System Settings | Planned |
| `/login` | Login | Planned |

### Frontend navigation preview (temporary)

- Config: `app/Config/navigation.php`
- Helper: `App\Support\NavPreview` (query key `nav_preview`)
- Modes: `employee` (default), `leader`, `admin` — change **visible nav only**
- **Not** authentication, authorization, or a security control; remove when real roles exist

## High-Level Request Flow (PHP / MySQL)

1. **Front controller** (`public/index.php`) loads autoloader, configuration, and session handling.
2. **Router** resolves the route; middleware verifies authentication and CSRF on mutating requests.
3. **Controller** loads input, delegates to a **service** method.
4. **Service** loads actor context (user id, roles, group memberships, positions), checks policy, begins transaction if needed.
5. **Models** read/write rows: submissions, tasks, history, notifications, audit entries.
6. **Service** commits or rolls back; returns a result DTO or domain outcome.
7. **Controller** renders a **view** or returns redirect with flash message.
8. For interactive pages, the view includes Vite-built assets; TypeScript may call same-origin endpoints that repeat steps 2–7.

Read-heavy pages (tracking, history) query through services to keep consistent filtering and authorization.

## Workflow Design (Conceptual)

Two template categories drive different engines behind a common submission shell.

### Generic templates — parallel review

- Requester selects one or more **reviewers** from allowed scope (rules defined at template level).
- System creates **review tasks** for all selected reviewers simultaneously.
- Each reviewer may **Approve**, **Reject**, or **Return for Revision**.
- **Final approval** requires **all** assigned reviewers to approve (consensus / unanimous parallel gate).
- Reject records a decision; post-reject status and whether the submission can continue are **not finalized** at Phase 1.1 ([DECISIONS.md](DECISIONS.md)).
- Return for revision sends the submission back to the requester; a **new review round** may begin after resubmission, preserving prior round history.

```
     [Submitted]
          │
          ├─► Reviewer A ──┐
          ├─► Reviewer B ──┼─► all approved? ──► [Approved]
          └─► Reviewer C ──┘         │
                    any reject ───────► [Rejected]
                    any return ───────► [Revision requested] ──► resubmit ──► new round
```

### Group-specific templates — sequential approval

- Template defines an ordered **approval hierarchy** (e.g. Leader → Assistant Manager → Department Manager → IT Manager → Senior Manager).
- Each stage references an approver target configured on the template. Targets are **not** limited to positions within the template’s owning group. A stage may eventually resolve to:
  - a **specific assigned employee**;
  - an **organizational position** (resolved to user(s) by position rules);
  - a **position associated with a designated company group** (possibly different from the template owner).
- **Assignment and resolution rules** (how many users receive a task, fallbacks, conflicts) remain an **open design decision** until Phase 5 workflow implementation ([DECISIONS.md](DECISIONS.md)).
- Only the **current stage** actor(s) receive actionable tasks; earlier stages are complete and immutable for that round.
- Requesters **cannot skip** stages; the service advances the pointer only on Approve at the current stage.
- Reject and Return for Revision behave similarly to generic flows but scoped to the active stage. After resubmission from revision, **which stage the workflow re-enters is not confirmed** at Phase 1.1 ([DECISIONS.md](DECISIONS.md)).

```
[Submitted] → Stage 1 → Stage 2 → … → Stage N → [Approved]
                  │         │
                  reject    return ──► [Revision] ──► resubmit ──► new round / stage policy
                  └─► [Rejected]
```

### Shared concepts

- **Submission snapshot:** Copy of template metadata, field definitions, workflow definition, and (once designed) permitted submission-specific additional field values at creation time.
- **Round:** A numbered iteration of review/approval after initial submit or after resubmission from revision.
- **Task:** An assignee’s inbox item tied to submission, round, stage (if sequential), and action type.
- **Action history:** User-visible timeline of decisions and comments.
- **Audit log:** Administrative and security-sensitive events (config changes, role grants, login failures if logged).

Workflow logic lives in `app/Services/Workflow/` (and related submission services), with clear state transition functions invoked inside transactions.

## Security Principles

| Area | Approach |
|------|----------|
| Authentication | PHP sessions; secure cookie flags; session regeneration on login; password hashing (e.g. `password_hash` / `password_verify`). |
| Authorization | Checked in services on every mutating and sensitive read operation; roles + group membership + position/user resolution for sequential stages per finalized workflow rules. |
| CSRF | Tokens on all state-changing forms and POST endpoints. |
| SQL injection | PDO prepared statements exclusively in models. |
| XSS | Escape output in views; treat rich text as out of MVP unless explicitly scoped. |
| File uploads | Validate type/size; store outside public web root; serve via controlled download endpoint after authorization check; optional virus scanning deferred. |
| Audit | Append-only admin audit log for configuration and privilege changes; business action history for submission lifecycle. |

## File Upload Handling

1. Requester attaches files during submission or revision; controller passes validated upload metadata to a **SubmissionAttachmentService**.
2. Service generates a unique stored name; writes to `storage/uploads/` (or group/date subpaths).
3. Database row links submission (and round) to stored path, original filename, mime type, size, uploader, timestamp.
4. Download: controller action verifies user may view submission, streams file with appropriate headers, no direct public URL.
5. Prior rounds retain attachment records; new rounds may add or supersede per product rules in requirements.

## Notifications (MVP)

In-app notification rows created by services when tasks are assigned or decisions made. Delivery mechanism (email, push) is out of MVP unless added in a later phase; architecture should keep notification creation in one service for future channels.

## What Is Not Defined Here

Database table designs, exact route list, and class names will be specified during schema and implementation phases. This document intentionally stays at the architectural level for Phase 1.1.
