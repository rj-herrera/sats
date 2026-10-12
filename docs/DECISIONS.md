# SATS Architecture and Product Decisions

Phase 1.1 decision log. Entries distinguish **confirmed** choices (approved for this project), **technical recommendations** (implementation defaults that are not business rules), and **open questions** (unconfirmed product/workflow behavior to resolve in later phases). **Recommendations must not be read as approved workflow or eligibility rules.**

---

## Confirmed Technology Decisions

| Decision | Rationale |
|----------|-----------|
| **Plain PHP with simple MVC** | Matches team constraints and Kaizen scope; avoids framework lock-in and learning overhead for a focused internal app. |
| **MySQL/MariaDB via PDO prepared statements** | Aligns with XAMPP; prepared statements for security and clarity without ORM magic. |
| **No Laravel, Next.js, React, Prisma, ORM, or workflow engine** | Explicit project constraint; keeps stack understandable and deployment light. |
| **Server-rendered HTML + TypeScript (Vite)** | SEO/ simplicity not critical, but SSR reduces complexity; TypeScript only where interactivity helps. |
| **Tailwind CSS** | Utility-first styling with fast iteration; pairs well with Vite. |
| **Composer for PHP dependencies** | Standard dependency management when bootstrap occurs; minimal packages planned. |
| **npm + Vite for frontend assets** | Modern TS/CSS pipeline without adopting a SPA framework. |
| **Windows + XAMPP at `C:\xampp`, project at `C:\xampp\htdocs\sats`** | Stated development environment. |
| **Git for version control** | Standard collaboration and history. |
| **PHP sessions for authentication** | Simple, proven fit for internal server-rendered app on XAMPP. |
| **Password hashing via PHP built-ins** | `password_hash` / `password_verify` — no custom crypto. |
| **CSRF protection on mutating requests** | Required baseline for session-based forms. |
| **Uploads outside public web root** | Reduces direct exposure; downloads via authorized controller action. |
| **Separate application roles vs organizational positions** | Roles control admin capabilities; positions drive sequential approver resolution. |
| **Explicit group membership** | Clear authorization and template scoping. |
| **Template/workflow snapshot on submission** | Historical accuracy when templates change later. |
| **Append-only / preserved history for rounds and audit** | Supports compliance and user trust in tracking. |
| **Database transactions for critical approval actions** | Prevents inconsistent task/state under concurrency. |

---

## Confirmed Domain Decisions

| Decision | Rationale |
|----------|-----------|
| **Two template categories:** generic (parallel, all must approve) and group-specific (sequential hierarchy) | Core differentiator stated in project brief. |
| **Generic templates managed by System Administrators** | Central governance for cross-group forms. |
| **Group-specific templates managed via `manage_group_templates` and/or System Administrators** | Authorized Group Leaders / Managers may hold `manage_group_templates`; job title alone does not grant it. Admins handle generic and system-wide template admin. |
| **No MVP Dashboard page; default landing = My Submissions** | Simplifies employee IA; `/` maps to My Submissions. |
| **No standalone Action History or employee Templates pages** | Action History lives on Submission Details; template pick lives in New Submission. |
| **MVP sidebar: My Submissions, New Submission, Needs My Action** | Notifications and My Profile use the header (bell / profile), not the primary sidebar. |
| **Management vs Administration nav sections** | Management = Template Management for `manage_group_templates` holders; Administration = templates + users + groups + settings for System Administrators; no duplicate Template Management entry. |
| **Template form fields defined manually in PHP for MVP** (generic and group-specific) | Fixed template fields are code-defined; avoids drag-and-drop form-builder scope. |
| **Submission-specific additional fields (where permitted)** | Planned MVP capability: requesters may add simple extra fields on a submission; finalized in Phase 4 with implementation details still undecided; not a form builder. |
| **Reviewer actions: Approve, Reject, Return for Revision** | Standard approval vocabulary for MVP. |
| **Revision creates new review round with prior history retained** | Auditable iteration model. |
| **MVP includes in-app notifications only** | Scope control; channel abstraction in services for later. |
| **Core employee surfaces: My Submissions, Needs My Action, New Submission, Notifications, My Profile** | Minimum viable UX for requesters and actors (no separate Dashboard). |
| **Frontend `nav_preview` demo modes are temporary and non-secure** | Employee / Leader / Admin preview via query string only; not auth, not sessions, easy to remove. |

---

## Architectural Constraints (Non-Negotiable for MVP)

- Workflow and approval rules **must not** live in views or client-only TypeScript.
- **Server-side validation and authorization** on every sensitive operation.
- **No** migration of code or documentation from any prior application (greenfield project).
- **No** unnecessary dependencies or speculative features outside [REQUIREMENTS.md](REQUIREMENTS.md) MVP list.
- Keep controllers thin; **services own use cases**.

---

## Technical Recommendations (Implementation — Not Business Rules)

These suggest how to build the stack; they do **not** confirm workflow outcomes, withdrawal eligibility, or resubmission stage behavior.

| Topic | Recommendation |
|-------|----------------|
| **Front controller** | Single `public/index.php` with explicit router table or small route map file. |
| **Autoloading** | PSR-4 via Composer for `App\` namespace under `app/`. |
| **Config** | Environment-specific PHP array or `.env` loaded once (no secrets in git). |
| **Session cookie** | `HttpOnly`, `SameSite=Lax`, `Secure` when HTTPS available. |
| **Admin audit events** | Log user/role changes, template publish, group membership changes; optional failed-login logging. |

---

## Deferred Until Later Phases

| Item | Notes |
|------|-------|
| Apache virtual host / document root configuration | After project bootstrap. |
| Composer / npm initialization and dependency list | Phase 1.2+; only document intent now. |
| Database connectivity (PDO, config) | Phase 1 foundation. |
| Database schema, migrations, seeds | Introduced **incrementally** in Phases 2–8 as each feature requires tables; not a single monolithic schema drop. |
| Exact route map and API shape for TS calls | Phases 2–8 as features land. |
| Email or external notification channels | Post-MVP. |
| SSO / LDAP | Post-MVP unless prioritized. |
| Automated test suite structure | Optional phase; not required for 1.1. |
| Production deployment target (IIS vs Linux) | Out of scope for local XAMPP MVP. |
| Backup/retention policy for uploads and DB | Operational doc later. |
| Virus scanning on uploads | Deferred security enhancement. |

---

## Open Questions (Unconfirmed — Including Workflow)

Resolve before or during the phase that implements the affected feature. Items below remain **explicitly unconfirmed** at Phase 1.1.

| # | Question | Impacts |
|---|----------|---------|
| OQ-1 | After **Return for Revision** on sequential templates, does resubmission **restart at Stage 1** or **resume at another stage** (e.g. the stage that returned)? | Workflow service, UX copy |
| OQ-2 | **Submission withdrawal:** which statuses allow withdrawal, who may withdraw, and is withdrawal reversible? | Submission service, lifecycle |
| OQ-3 | **Sequential stage resolution:** rules when a stage references a specific employee vs position vs position in a designated group (multiple matches, vacancies, acting approvers). | Workflow configuration, task assignment |
| OQ-4 | Can requester **change reviewer set** on generic templates after submit but before all approve? | Generic workflow rules |
| OQ-5 | **Reject** outcome: terminal for the submission vs new round vs new submission record? | Status model |
| OQ-6 | Are **comments** required or optional for Approve / Reject / Return? | Forms, validation |
| OQ-7 | **Submission-specific additional fields:** allowed types, limits, snapshot behavior, and validation (Phase 4). | Submission creation, storage |
| OQ-8 | Are **multiple attachments per round** unlimited or capped (count/size)? | Storage, validation |
| OQ-9 | Beyond `manage_group_templates`, may Group Leaders / Managers also edit group membership? | Admin UI scope |
| OQ-10 | **Disabled users**: behavior for pending tasks (reassign vs block)? | Task service |
| OQ-11 | **Reference number** format and uniqueness scope (global vs per-group)? | DB, display |
| OQ-12 | Is **save draft** in MVP or cut? | Submission states |
| OQ-13 | **Audit log** retention and export format for admins | Compliance |
| OQ-14 | Maximum **parallel reviewers** on generic templates | Validation |
| OQ-15 | **Timezone** for timestamps (server local vs UTC) | Display consistency |

When an open question is resolved, record the outcome under **Confirmed Domain Decisions** with date and brief rationale. Do not leave resolved workflow rules in the technical recommendations section.

---

## Explicit Non-Decisions (Intentionally Not Chosen Yet)

- Specific PHP version minimum (recommend 8.1+ when bootstrap starts).
- Choice of minimal router library vs hand-rolled router.
- Whether inbox uses full page reload or partial TS fetch for MVP.
- Logging library (monolog vs simple file logger).

These remain implementation details as long as they honor the confirmed stack and constraints above.
