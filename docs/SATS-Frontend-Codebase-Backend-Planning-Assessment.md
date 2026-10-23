# SATS Frontend Codebase — Backend Planning Assessment

**Document type:** Read-only codebase analysis for backend design  
**Scope:** Existing React + Vite MVP (through Phase 8)  
**Target backend stack (planned):** Vanilla PHP (framework-free), MySQL, REST API, cookie-based session authentication, company employee database integration  
**Assessment date:** 2026-10-23  
**Codebase root:** `C:\xampp\htdocs\SATS`

> **Constraint honored:** This document is analysis and planning only. No application code was modified, refactored, or generated as part of this assessment.

---

## How to read this document

| Label | Meaning |
|-------|---------|
| **Verified in code** | Behavior implemented and observable in TypeScript sources (and often covered by Vitest). |
| **Partially implemented** | Present in types/UI/docs but incomplete, unused, or client-only without full enforcement. |
| **Not implemented** | Named in early docs or types but absent from runtime behavior. |
| **Recommendation** | Proposed for the future PHP/MySQL backend; not current product confirmation unless noted. |

**Source-of-truth note:** Early docs under `docs/` (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `FRONTEND.md`, parts of `DECISIONS.md`) describe a PHP server-rendered app without React. The **implemented** application is a **React SPA** with mock `localStorage` persistence. This assessment treats the **running frontend code** as the behavior specification for backend compatibility. Where early docs conflict with code, the conflict is called out.

---

## 1. Frontend Architecture

### 1.1 Frameworks and major dependencies

**Verified in code** (`package.json`):

| Category | Package | Version (approx.) |
|----------|---------|-------------------|
| UI | `react`, `react-dom` | ^19.1 |
| Routing | `react-router-dom` | ^7.9 |
| Icons | `lucide-react` | ^0.544 |
| Build | `vite` | ^7.1 |
| CSS | `tailwindcss` + `@tailwindcss/vite` | ^4.1 |
| Language | `typescript` | ~5.8 |
| Tests | `vitest` | ^3.2 |

**Not present:** Redux, Zustand, React Query, Axios, any HTTP API client library.

Vite config (`vite.config.ts`): `base: '/sats_demo/'`, path alias `@` → `./src`, React + Tailwind plugins.

### 1.2 Source directory structure

```
src/
├── App.tsx, main.tsx, index.css
├── components/
│   ├── ProtectedRoute.tsx
│   ├── request/          # Request UI (lists, forms, review, timeline, …)
│   └── template/         # Template builder, list, preview, …
├── contexts/             # AuthContext only
├── data/                 # MOCK_USERS, MOCK_GROUPS, MOCK_TEMPLATES, MOCK_REQUESTS
├── hooks/                # usePermissions
├── layouts/              # AppLayout, Header, Sidebar, PageScroll
├── pages/                # Route-level pages
├── routes/               # AppRouter, paths, routeConfig
├── services/             # Repositories + domain orchestration
├── types/                # Domain TypeScript models
├── utils/                # Permissions, validation, transitions, helpers
└── test/                 # Vitest setup (in-memory localStorage)
```

Supporting docs: `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`, `docs/DECISIONS.md`, `docs/FRONTEND.md` (partially outdated relative to the React MVP).

### 1.3 Application routing

**Verified in code** — `src/routes/AppRouter.tsx`, `src/routes/paths.ts`, `src/App.tsx` (`basename="/sats_demo"`).

| Path | Page component | Route guard |
|------|----------------|-------------|
| `/login` | Redirect → `/requests` | Public redirect (no login UI) |
| `/` | Redirect → `/requests` | Auth shell |
| `/requests` | `MyRequestsPage` | `requests:view_own` |
| `/requests/new` | `RequestFormPage` | `requests:create` |
| `/requests/:id` | `RequestDetailsPage` | Shell only; page ACL |
| `/requests/:id/edit` | `EditRequestPage` | `requests:view_own` + page ownership/Returned |
| `/requests/:id/review` | `ReviewPage` | Shell only; assignment ACL |
| `/inbox` | `ActionInboxPage` | Shell only; `canAccessActionInbox` |
| `/templates` | `TemplatesPage` | `manage_group` **or** `manage_generic` |
| `/templates/new` | `TemplateEditorPage` | same |
| `/templates/:id/edit` | `TemplateEditorPage` | same + `canManageTemplate` |
| `*` (in layout) | `NotFoundPage` | — |

`routeConfig.ts` documents intended permissions for review/details/inbox, but **AppRouter does not apply** those `anyOf` checks for review, details, or inbox — enforcement is page-level only (**partially implemented** at route layer).

### 1.4 Page organization

| Page | Responsibility |
|------|----------------|
| My Requests | List requester’s submissions; filters; navigate to details |
| New Request | Template select → dynamic form → submit |
| Request Details | Owner view: fields, progress, activity, revisions, cancel/resubmit CTAs |
| Edit & Resubmit | Returned requests only; form edit + resubmit |
| Action Inbox | Pending / completed assigned work |
| Review / Approval | Decision UI for assignees |
| Templates | Manage list, activate/deactivate |
| Template Editor | Create/edit fields + workflow; activate |

### 1.5 State management approach

**Verified in code:**

| Concern | Approach |
|---------|----------|
| Auth identity | Single `AuthContext` wrapping the app (`App.tsx` L5–11) |
| Domain data | Service/repository modules reading/writing `localStorage` |
| UI state | Local `useState` / props on pages and components |
| Permissions | Pure functions + `usePermissions` (recomputed on navigation) |
| Cross-page refresh | Often via `location.key` or remount after navigation — no global store |

**No** global request/template cache layer. Each page typically re-reads repositories on mount.

### 1.6 Data access patterns

```
UI (pages / components)
        │
        ▼
Domain services (decision, lifecycle, inbox, template, workflow, auth)
        │
        ▼
Repositories (user, group, template, request)
        │
        ▼
localStorage  ←── seeded from src/data/mock*.ts
```

Types under `src/types/` are explicitly designed so mock data can later be replaced by API responses (`src/types/index.ts` L1–4).

### 1.7 Shared utilities and services

| Area | Key files |
|------|-----------|
| Auth | `services/authService.ts`, `contexts/AuthContext.tsx` |
| Users/Groups | `services/userRepository.ts`, `groupRepository.ts`, `*Normalizer.ts` |
| Templates | `templateRepository.ts`, `templateService.ts`, `templateValidation.ts`, `templatePermissions.ts` |
| Requests | `requestRepository.ts`, `requestLifecycleService.ts`, `decisionService.ts` |
| Workflow | `workflowService.ts`, `assignmentHelpers.ts`, `requestTransitions.ts` |
| Inbox | `inboxService.ts` |
| Permissions | `utils/permissions.ts`, `hooks/usePermissions.ts` |
| Forms | `utils/formValidation.ts`, `currencyFields.ts` |
| Reset | `services/resetMockData.ts` |

### 1.8 Type definitions and interfaces

| Module | Exports |
|--------|---------|
| `src/types/index.ts` | `Role`, `Permission`, `User`, `Group`, `AuthSession`, re-exports |
| `src/types/template.ts` | `FormTemplate`, fields, workflows, statuses |
| `src/types/request.ts` | `SubmittedRequest`, revisions, activity, decisions, inputs |

### 1.9 Data flow (end-to-end)

1. **Boot:** `AuthProvider` calls `ensureMockSession()` → loads/creates `{ userId }` in `sats.mock.session` → resolves `User` from `sats.mock.users`.
2. **Read:** Pages call services → repositories `JSON.parse` localStorage → normalizers coerce legacy shapes → UI renders.
3. **Write (example — submit):** `RequestFormPage` validates → builds `CreateRequestInput` (field snapshot + reviewer/step snapshots) → `createRequest` appends to `sats.mock.requests`.
4. **Write (example — decide):** `ReviewPage` → `processRequestDecision` → mutates in memory → `saveRequest` replaces the record.
5. **No network:** Domain data never leaves the browser except static sample attachment URLs.

---

## 2. Existing Data Models

### 2.1 Summary table

| Model | TypeScript type | Persistence | Primary files |
|-------|-----------------|-------------|---------------|
| User / employee | `User` | `sats.mock.users` | `types/index.ts`, `data/mockUsers.ts`, `userRepository.ts` |
| Group | `Group` | `sats.mock.groups` | same |
| Auth session | `AuthSession` | `sats.mock.session` | `authService.ts` |
| Form template | `FormTemplate` | `sats.mock.templates` | `types/template.ts`, `templateRepository.ts` |
| Form fields | `FormFieldDefinition` | Embedded in template / request snapshot | `types/template.ts` |
| Workflow config | `TemplateWorkflow` | Embedded in template | `types/template.ts` |
| Submitted request | `SubmittedRequest` | `sats.mock.requests` | `types/request.ts`, `requestRepository.ts` |
| Revision | `RequestRevision` | Embedded array on request | `types/request.ts`, `requestLifecycleService.ts` |
| Reviewer / step decisions | `ReviewerSnapshot`, `ApprovalStepSnapshot` | Embedded on request + revisions | `types/request.ts`, `decisionService.ts` |
| Attachments | `AttachmentMetadata` | Embedded (metadata + optional data URL) | `types/request.ts`, `formValidation.ts` |
| Activity / history | `ActivityEvent` | Embedded `activity[]` on request | `types/request.ts` |
| Notifications | — | **Not implemented** | No matches under `src/` |

### 2.2 Employees / users

**Verified** — `User` (`src/types/index.ts` L84–106):

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | e.g. `usr-employee-1` |
| `employeeId` | `string` | Human-readable employee number |
| `name`, `email` | `string` | |
| `groupId`, `groupName` | `string` | Single group; `groupName` denormalized |
| `roles` | `Role[]` | Always includes `employee` effectively |
| `hasApprovalResponsibility` | `boolean` | Designated Approver; Admin alone does not imply this |
| `status` | `Active` \| `Inactive` | |
| `createdAt`, `updatedAt` | `string` (ISO) | |

**Relationships:** `User.groupId` → `Group.id`.  
**CRUD:** Read-only directory; seed/merge from `MOCK_USERS`; no in-app create/update/delete (**Verified** — comments in `userRepository.ts` state future company DB).  
**Inconsistencies:** Legacy role label `manager` normalized to `approver`; legacy user ID map in `mockUsers.ts`.

### 2.3 Groups

**Verified** — `Group` (`src/types/index.ts` L73–82): `id`, `name`, `code`, `description`, `status`, timestamps.  
Seed: System Group (`grp-system`), Admin Group (`grp-admin`).  
**No Group Management UI** in the MVP (do not restore for backend planning). Backend should treat groups as data from/synced with the company directory.

### 2.4 Templates

**Verified** — `FormTemplate` (`src/types/template.ts` L97–122):

| Field | Type | Notes |
|-------|------|-------|
| `scope` | `generic` \| `group` | |
| `owningGroupId` | `string \| null` | Null for generic |
| `allowedGroupIds` | `string[]` | Generic empty = all groups |
| `status` | `Active` \| `Inactive` | No Draft |
| `fields` | `FormFieldDefinition[]` | Dynamic form definition |
| `workflow` | `TemplateWorkflow` | Discriminated union |
| `version` | `number` | Counter only; increments on update |
| Audit | `createdBy*`, `updatedBy*`, timestamps | |

**CRUD:** Create / update / set status via `templateRepository`; **delete not implemented**.

### 2.5 Form fields and configurations

**Verified** — `FormFieldDefinition` (`src/types/template.ts` L52–72): `id`, `label`, `type`, `required`, optional `placeholder`, `helpText`, `defaultValue`, `options`, `min`/`max`, `maxLength`, `accept`, `maxFileSizeMb`.

**Field types:** text, textarea, number, currency_php/usd/jpy, url, date, select, radio, checkbox, file (`FORM_FIELD_TYPES`).

**Runtime values:** `FieldValue = string | number | boolean | null`. Files held as `File` in UI; persisted as `AttachmentMetadata`.

**On submit:** `fieldDefinitions` copied onto the request (**snapshot**) — `SubmittedRequest.fieldDefinitions` (`types/request.ts` L145–149).

### 2.6 Workflows and approvers

| Workflow | Config shape | Runtime snapshot |
|----------|--------------|------------------|
| Generic review | `{ type: 'review_checking' }` | `reviewers: ReviewerSnapshot[]` chosen at submit |
| Hierarchy | `{ type: 'hierarchy_approval', steps: HierarchyApprovalStep[] }` | `approvalSteps: ApprovalStepSnapshot[]` resolved at submit |

**Hierarchy step config:** `id`, `stepOrder`, `roleLabel`, `assigneeUserId` (specific user — not position-based yet).

**Duplication:** Template stores assignee **IDs**; request stores denormalized name/group/role/status/comments. Intentional for history; backend should keep the same snapshot pattern.

### 2.7 Requests

**Verified** — `SubmittedRequest` (`types/request.ts` L127–165): stable `requestNumber`, template metadata, requester snapshot, `fieldValues`, attachments, workflow snapshots, `status`, `revisionNumber`, `revisions[]`, cancel metadata, `activity[]`.

**Create:** `createRequest` → always `Pending`, revision 1 (`requestRepository.ts` L256–296).  
**Update:** via decision/lifecycle services → `saveRequest`.  
**Delete:** not supported (cancel only).

### 2.8 Request revisions

**Verified** — `RequestRevision` (`types/request.ts` L107–125): archived field values, attachments, reviewer/step snapshots, outcome, return metadata.

Created by `snapshotClosedRevision` on resubmit and cancel (`requestLifecycleService.ts` L37–61). Past revisions must not be overwritten (**type comment L104–105**).

### 2.9 Approval decisions

Not a separate top-level entity. Decisions are fields on `ReviewerSnapshot` / `ApprovalStepSnapshot` (`status`, `comments`, `actionAt`) plus mirrored `ActivityEvent` entries.

**Decision types:** `approve` \| `reject` \| `return` (`DECISION_TYPES`).

### 2.10 Attachments

**Verified** — `AttachmentMetadata`: `fieldId`, `fileName`, `fileSize`, `fileType`, optional `downloadUrl`.  
Mock: often data URLs or static samples under `BASE_URL/samples/`. **Not** a real file store.

### 2.11 Notifications

**Not implemented** in frontend. Early docs plan in-app notifications; no types, services, or UI under `src/`.

### 2.12 Activity / history

**Verified** — `ActivityEvent` with types in `ACTIVITY_EVENT_TYPES` (`types/request.ts` L40–53).  
**Partially implemented:** Several enum values are never emitted (e.g. `comment_added`, `review_approved`, `review_rejected`, `approval_completed`). Emitted types include `request_submitted`, `review_completed`, `approval_step_approved`, `request_approved`, `request_rejected`, `request_returned`, `request_resubmitted`, `request_cancelled`.

### 2.13 Model inconsistencies / duplication

| Issue | Detail |
|-------|--------|
| Denormalized names | Requester/group/template names copied onto requests; can drift from live directory |
| Dual permission views | `routeMeta` vs actual `ProtectedRoute` usage |
| Role naming drift | Docs say Leader/Manager; code uses `approver` + `hasApprovalResponsibility` |
| Early docs vs SPA | `FRONTEND.md` / `ARCHITECTURE.md` describe PHP views; code is React |
| Activity enum vs emitters | Unused activity types |
| Cancel reason | UI required; service accepts optional reason |
| Template `version` | Counter only — not a historical version store |

---

## 3. Current Data Persistence

### 3.1 Storage keys

| Key | Contents | Cleared by reset? |
|-----|----------|-------------------|
| `sats.mock.session` | `{ userId: string }` | **No** (session preserved) |
| `sats.mock.users` | `User[]` | Yes |
| `sats.mock.groups` | `Group[]` | Yes |
| `sats.mock.templates` | `FormTemplate[]` | Yes |
| `sats.mock.requests` | `SubmittedRequest[]` | Yes |

Defined in `resetMockData.ts` L7–12; session key in `authService.ts` L12.

### 3.2 Initialization and seed data

Pattern (all domain repositories):

1. `readRaw` → `JSON.parse` (safe catch → empty).
2. If empty → write seed (`MOCK_*`).
3. Else merge/hydrate (legacy ID remap, refresh display names, inject missing seed IDs).
4. Normalize every record.

| Seed module | Contents |
|-------------|----------|
| `mockUsers.ts` | 2 groups, 5 users (2 employees, 2 approvers, 1 admin) |
| `mockTemplates.ts` | General Review (generic/parallel), Website Access Request (group/hierarchy) |
| `mockRequests.ts` | 3 seed requests for Employee 1 |

### 3.3 CRUD operations

| Store | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Session | login / ensure | load | switch user | logout / clear |
| Users | seed only | list/get | hydrate merge | reset wipe |
| Groups | seed only | list/get | hydrate merge | reset wipe |
| Templates | `createTemplate` | list/get | `updateTemplate`, `setTemplateStatus` | wipe / no soft entity delete |
| Requests | `createRequest` | list/get | `saveRequest` | wipe; cancel is status change |

### 3.4 Reset mechanisms

- **Primary UI:** Sidebar “Reset mock data” → `resetAllMockData()` → reload (`Sidebar.tsx`).
- **Helpers:** `clearAllRequests`, `clearAllTemplates`, `clearSession`.
- After wipe, next repository read re-seeds automatically.

### 3.5 Serialization

- `JSON.stringify` / `JSON.parse` only.
- No schema version envelope.
- Legacy migrations in normalizers (Draft→Inactive, manager→approver, missing step statuses, etc.).
- Request numbers: client-side `SATS-{year}-{6-digit}` (`requestRepository.ts` L222–237).
- IDs: `crypto.randomUUID()` with string fallback.

### 3.6 Direct storage readers/writers

Only repository/auth/reset modules touch `localStorage` for domain data. Pages go through services. Exception: Vitest setup mocks `localStorage`; `FileViewerDialog` uses `fetch` only for static attachment text preview — not an API.

### 3.7 Functions to replace with PHP API calls

**High priority (mutations + authorization):**

| Frontend | Future REST (proposed) |
|----------|------------------------|
| `createRequest` | `POST /api/requests` |
| `processRequestDecision` | `POST /api/requests/{id}/decisions` |
| `resubmitRequest` | `POST /api/requests/{id}/resubmit` |
| `cancelRequest` | `POST /api/requests/{id}/cancel` |
| `createTemplate` / `updateTemplate` / `setTemplateStatus` | `POST` / `PATCH /api/templates`, `PATCH .../status` |
| Mock session (`loginAsMockUser`, …) | PHP session login / SSO identity |

**Medium priority (reads):**

| Frontend | Future REST (proposed) |
|----------|------------------------|
| `listRequests` / `getRequestById` / by requester | `GET /api/requests`, `GET /api/requests/{id}` |
| Template list/get | `GET /api/templates` |
| Inbox pending/completed/count | `GET /api/inbox/...` |
| Users/groups assignable lists | Company DB / `GET /api/users`, `GET /api/groups` |

**Can remain client-side (UX only):** display formatters, badge CSS, list filter UI helpers — with **server re-enforcement** of any security-sensitive filter.

---

## 4. Templates and Dynamic Forms

### 4.1 Creation and editing

**Verified:**

- Create/edit via `TemplateEditorPage` + `FormFieldBuilder` + `ApprovalWorkflowBuilder`.
- Persist through `createTemplate` / `updateTemplate` (`templateRepository.ts`).
- Primary publish action is **Activate Template** (full validation).
- List page can activate/deactivate via confirm dialog.

**Partially implemented:** `persist('Inactive')` path exists in editor logic but there is no prominent “Save as Inactive” footer action; Inactive is mainly via list deactivate.

### 4.2 Ownership and visibility

| Scope | Ownership | Submit visibility | Manage |
|-------|-----------|-------------------|--------|
| `generic` | `owningGroupId = null` | Empty `allowedGroupIds` → all active groups; else listed groups | Admin (`templates:manage_generic`) |
| `group` | `owningGroupId` required | User’s group in `allowedGroupIds`; owning group Active | Approver for **own** group; Admin any |

Rules: `templateService.ts` L42–72, `templatePermissions.ts` L31–50. Non-admin creates forced to group scope + actor’s group (`templateRepository`).

### 4.3 Group-specific vs generic review vs hierarchy

| Seed / type | Scope | Workflow |
|-------------|-------|----------|
| General Review | generic | `review_checking` (requester picks reviewers) |
| Website Access | group (System) | `hierarchy_approval` (ordered assignees on template) |

**Note vs early docs:** Early docs map “generic = parallel” and “group = sequential.” Code allows either workflow type on either scope at the type level; seeds follow the conventional pairing. Backend should decide whether to enforce scope↔workflow coupling (**Recommendation:** preserve current flexibility unless product locks the pairing).

### 4.4 Dynamic form field definitions

Built in UI; stored as JSON array on template; snapshotted onto request at submit. Field builder supports reorder, options, numeric bounds, file accept/size.

### 4.5 Field validation

| Layer | File | Enforced when |
|-------|------|---------------|
| Template draft/activation | `templateValidation.ts` | Save/activate template |
| Request submit/resubmit | `formValidation.ts` | Create / resubmit |

**Client-only today.** Must be duplicated server-side.

Highlights:

- Activation: name, description, ≥1 field, option uniqueness, hierarchy assignees Active, etc.
- Duplicate hierarchy assignees → **warning only**.
- Request: required fields, URL scheme, min/max, file size/accept, ≥1 reviewer for review_checking, hierarchy resolve OK.

### 4.6 Activation / deactivation

- Only `Active` templates appear in New Request.
- Activate requires `validateTemplateForActivation`.
- Deactivate removes from New Request; does not rewrite existing requests.

### 4.7 Modifying an existing template

**Verified intended behavior:**

- In-place overwrite of template record; `version++` on each successful update.
- UI states existing requests keep original field snapshots (`TemplateEditorPage` copy).
- Historical requests use `fieldDefinitions` on the request; legacy missing snapshot may fall back to live template in normalizer (**partial** — migration concern).

### 4.8 Template versioning

| Aspect | Status |
|--------|--------|
| Integer `version` counter | **Verified** |
| Immutable version history / restore | **Not implemented** |
| Request-side field/workflow snapshot | **Verified** (functional substitute for history) |

**Assumed / frontend-enforced only:** manage ACL, availability filters, activation validation — all bypassable without a server.

---

## 5. Request Lifecycle

### 5.1 Statuses

**Verified** (`types/request.ts` L10–16):

`Pending` | `Approved` | `Rejected` | `Returned` | `Cancelled`

**No request Draft status** (**Not implemented**; resolves open question OQ-12 in the mock as “no drafts”).

### 5.2 Allowed transitions

**Verified** via `requestTransitions.ts` + services:

| From | To | Trigger | Conditions |
|------|-----|---------|------------|
| *(new)* | Pending | `createRequest` | Always |
| Pending | Approved | Decision | Workflow completion rules |
| Pending | Rejected | Decision `reject` | Assigned + can act + comment required |
| Pending | Returned | Decision `return` | Assigned + can act + comment required |
| Pending | Cancelled | `cancelRequest` | Owner; Pending only |
| Returned | Pending | `resubmitRequest` | Owner; validation passes |
| Approved / Rejected / Cancelled | — | — | Terminal |

**Not allowed:** Cancel from Returned; decide while Returned; reopen Rejected; change status from terminal.

Gate helpers: `canRecordDecision`, `canResubmitFrom`, `canCancelFrom` (`requestTransitions.ts` L19–32).

### 5.3 Lifecycle stages (mapped to code)

| Stage | Support |
|-------|---------|
| Draft create/edit | **Not implemented** |
| Initial submission | **Verified** → Pending |
| Pending review/approval | **Verified** |
| Approval | **Verified** |
| Rejection | **Verified** (terminal for request) |
| Return for correction | **Verified** → Returned |
| Edit returned | **Verified** (`EditRequestPage`) |
| Resubmission | **Verified** |
| Cancel returned | **Not allowed** (must be Pending) |
| Cancel pending | **Verified** |
| Final completion | Approved / Rejected / Cancelled |

### 5.4 Revision mechanics

| Rule | Behavior | Status |
|------|----------|--------|
| Preserve `requestNumber` | Never changed on resubmit | **Verified** |
| Retain previous form data | Archived in `revisions[]` | **Verified** |
| Retain prior decisions | Archived in revision snapshots + activity | **Verified** |
| Restart approval after resubmit | Hierarchy → step 1; review → all Pending | **Verified** (answers OQ-1 as restart) |
| Attachments with revisions | Metadata snapshotted per closed revision | **Verified** |
| Change reviewers on resubmit | Locked to original assignees | **Verified** (UI + reset helpers) |
| Free-text resubmit comment | None | **Not implemented** |

Resubmit core: `requestLifecycleService.ts` L63–149 (comments note non-transactional localStorage).

### 5.5 Enforcement correctness

**Verified correctly in single-tab mock flows** (Vitest covers decision + lifecycle):

- Unanimous parallel approve; any reject/return ends.
- Hierarchy Waiting blocked; approve advances next Waiting→Pending.
- Resubmit archives and resets; cancel archives.

**Gaps:** no concurrency control; cancel reason optional in service; some activity types unused; `explainInvalidTransition` unused by mutators.

---

## 6. Approval Workflow Engine

### 6.1 Generic Review / Checking

**Verified** — `processReviewChecking` in `decisionService.ts`:

| Rule | Behavior |
|------|----------|
| Reviewer selection | Requester selects ≥1 from `listSelectableReviewers` (active approvers ≠ self) |
| Parallelism | All start `Pending` |
| Completion | **All** must `Approved` → overall Approved |
| Reject | Immediate overall Rejected |
| Return | Immediate overall Returned |
| Comments | Required for reject/return; optional for approve (`requireComment` L50–57) |

### 6.2 Hierarchy Approval

**Verified** — `processHierarchy` in `decisionService.ts`:

| Rule | Behavior |
|------|----------|
| Configured approvers | Template `assigneeUserId` per step; resolved to snapshots at submit (`workflowService.ts`) |
| Ordering | `stepOrder`; first Pending, rest Waiting |
| Next approver | On approve, next Waiting after current → Pending |
| Final approve | No remaining Waiting → overall Approved |
| Reject / return | Ends overall; later Waiting steps left as Waiting |

**Not implemented vs early docs:** position-based / group-position resolution (OQ-3); only specific employees.

### 6.3 Workflow state representation

Embedded on `SubmittedRequest`:

- `workflowType`
- `reviewers` **or** `approvalSteps` (other null)
- Per-assignee `status` / `comments` / `actionAt`
- Overall `status` + `activity[]` + `revisionNumber` / `revisions[]`

### 6.4 Action Inbox identification

**Verified** — `inboxService.ts` L33–56, L94–101:

- Pending tab: overall `Pending` + user assigned + no completed decision on **current** revision.
- Hierarchy assignees with Waiting still **see** the item (`canAct: false`).
- Badge count: `canAct === true` only.
- Access: designated Approver **or** any user with pending/completed assigned work; **Admin alone does not**.

### 6.5 How decisions update status

`processRequestDecision` (`decisionService.ts` ~L286–388):

1. Load request + actor; block Cancelled / Returned / non-Pending / unassigned / cannot act.
2. Branch by `workflowType`.
3. Mutate snapshots + append activity.
4. `saveRequest` blind replace.

### 6.6 Concurrency / duplicate-action vulnerabilities

**Verified risk (no mitigation beyond UI flags):**

| Risk | Why |
|------|-----|
| Last-write-wins | `saveRequest` replaces entire JSON record |
| Parallel reject vs approve | Two actors; storage has no merge/transaction |
| Double resubmit / cancel vs decide | Same |
| Double submit | UI `submitting` only |

**Recommendation:** PHP transactions + optimistic locking (`revision_number` or `updated_at` / row version) on every decision and lifecycle mutation.

### 6.7 Logic that must move to PHP

All of: transition gates, both workflow engines, comment requirements, ownership checks, assignment/actability, inbox queries, request number allocation, template availability at submit, field validation, revision archival integrity, file authorization.

Frontend may keep **display** helpers only.

---

## 7. Authentication, Employees, and Permissions

### 7.1 Mock authentication

**Verified:**

- Always “authenticated” in `AuthContext` (`isAuthenticated: true`).
- Session = `{ userId }` in `sats.mock.session`.
- No login page; `/login` redirects to requests.
- Dev role/user switcher in Sidebar.
- Inactive user or inactive group clears session (`authService.ts` L45–57).

### 7.2 Roles

**Verified** — `Role = 'employee' | 'approver' | 'admin'` (`types/index.ts` L13).

| Role | Capabilities (via `ROLE_PERMISSIONS`) |
|------|--------------------------------------|
| employee | create + view own requests |
| approver | + view assigned, approve, manage group templates, inbox |
| admin | + manage group **and** generic templates (no inbox by role alone) |

**Extra:** `hasApprovalResponsibility` grants inbox/approve/view_assigned even if role matrix would not (`permissions.ts` L63–71).

### 7.3 Route- and component-level permissions

See §1.3 and §1.4. Additional:

- Request view: owner **or** assigned only — **Admin has no blanket access** (`requestAccess.ts`, `permissions.ts` `canViewRequest`).
- Template manage: `canManageTemplate` per template.
- Sidebar: inbox for Approvers; templates for manage permissions.

### 7.4 Template ownership / group restrictions

See §4.2. Approvers limited to their `owningGroupId`; Admins manage all including generic.

### 7.5 Approver authorization

Must be assigned **and** currently `Pending` on that assignment (`assignmentHelpers.ts` L36–51). Hierarchy Waiting cannot act.

### 7.6 Administrator capabilities

- Manage any template / create generic templates.
- Create requests like any employee.
- **Cannot** open Action Inbox without Approver designation or assignments.
- **Cannot** view arbitrary requests by admin privilege alone.

### 7.7 Frontend-only restrictions → must become server-enforced

1. Session identity (never trust client `userId` / role switcher).
2. Role + `hasApprovalResponsibility` permission matrix.
3. Template manage/create/activate ACL and availability for submit.
4. Request view/act/cancel/resubmit ownership and assignment rules.
5. Decision eligibility and workflow outcomes.
6. Form and attachment validation.
7. Inactive user/group denial.
8. File download authorization.

**Out of scope for this assessment:** restoring Group Management / Group Members UI. Employees/groups will come from the **existing company employee database**.

---

## 8. API Integration Readiness

### 8.1 Current API-related functionality

| Item | Finding |
|------|---------|
| Axios / fetch API client | **None** for domain data |
| Endpoint definitions | **None** |
| `fetch` usage | `FileViewerDialog` only (static attachment preview) |
| Mock services | Full domain layer under `src/services/` |
| Loading / error handling | Local `useState` flags + service `{ ok, error }` results |
| Auth assumptions | Mock session always present |

### 8.2 Components tightly coupled to mock data

Virtually all pages call repositories/services directly. Highest coupling:

- `RequestFormPage`, `EditRequestPage`, `ReviewPage`
- `ActionInboxPage`, `MyRequestsPage`, `RequestDetailsPage`
- `TemplatesPage`, `TemplateEditorPage`
- `Sidebar` (badge counts, reset, role switcher)

Types are already API-shaped; repositories are the natural swap boundary.

### 8.3 Proposed mock → REST mapping

| Mock operation | Proposed endpoint | Notes |
|----------------|-------------------|-------|
| `ensureMockSession` / login | `POST /api/auth/login` (session cookie) | Company credentials / SSO later |
| `logoutMockUser` | `POST /api/auth/logout` | |
| `refreshSessionUser` | `GET /api/auth/me` | |
| `listUsers` / assignable | `GET /api/users?…` | Backed by company DB |
| `listGroups` | `GET /api/groups` | |
| `getAvailableTemplatesForUser` | `GET /api/templates?available=1` | Server filters |
| `listManageableTemplates` | `GET /api/templates?manageable=1` | |
| `getTemplateById` | `GET /api/templates/{id}` | |
| `createTemplate` | `POST /api/templates` | |
| `updateTemplate` | `PATCH /api/templates/{id}` | Optimistic `version` |
| `setTemplateStatus` | `PATCH /api/templates/{id}/status` | |
| `listRequestsByRequester` | `GET /api/requests?mine=1` | |
| `getRequestById` | `GET /api/requests/{id}` | ACL |
| `createRequest` | `POST /api/requests` | Multipart for files |
| `processRequestDecision` | `POST /api/requests/{id}/decisions` | |
| `resubmitRequest` | `POST /api/requests/{id}/resubmit` | |
| `cancelRequest` | `POST /api/requests/{id}/cancel` | |
| `listPendingInboxItems` | `GET /api/inbox/pending` | |
| `listCompletedInboxItems` | `GET /api/inbox/completed` | |
| `countActionableInboxItems` | `GET /api/inbox/badge` or include in pending | |
| File download | `GET /api/attachments/{id}` | Authz + stream |

### 8.4 Frontend changes likely required when replacing localStorage

**Recommendation (compatibility-preserving):**

1. Introduce a thin `apiClient` (fetch + credentials: `include`) replacing repository I/O.
2. Keep TypeScript domain types largely unchanged.
3. Replace role switcher with real login; remove `resetAllMockData`.
4. Replace data-URL attachments with upload endpoints + secure download URLs.
5. Add loading/error/retry UX for network failures.
6. Optionally introduce React Query (or similar) later — **not required** for first cut if services return Promises.
7. Align CSRF strategy with cookie sessions (header token or double-submit).
8. Re-test page ACL; prefer consistent route + server enforcement.
9. Basename / deployment path may move from `/sats_demo/` when PHP hosts the SPA.

---

## 9. Backend Database Planning

### 9.1 Legend

| Tag | Meaning |
|-----|---------|
| **Confirmed (from frontend behavior)** | Needed to preserve current MVP behavior |
| **Proposed improvement** | Recommended for PHP/MySQL robustness; not present as a first-class store today |

### 9.2 Preliminary MySQL tables

#### A. Identity & org (integrate with company employee DB)

| Table | Purpose | Important fields | Keys / relations | Frontend model |
|-------|---------|------------------|------------------|----------------|
| `users` *(or sync view)* | Employees | external employee id, name, email, status, approval_responsibility, app roles | PK; FK/group link | `User` |
| `groups` *(or sync view)* | Org units | code, name, status | PK | `Group` |
| `user_groups` **Proposed** | Explicit membership if multi-group later | user_id, group_id | PK composite | Today: single `groupId` only |
| `sessions` | PHP session or app session meta | session_id, user_id, expires | PK | `AuthSession` |

**Confirmed:** Map `employeeId`, roles, `hasApprovalResponsibility`, Active/Inactive.  
**Proposed:** Prefer reading employees from company DB (SSO/employee number) rather than duplicating HR fields; store only SATS-specific flags/roles if needed.

> Do **not** plan UI for Group Management / Group Members restoration.

#### B. Templates & dynamic forms

| Table | Purpose | Important fields | Keys / relations | Frontend model |
|-------|---------|------------------|------------------|----------------|
| `templates` | Template header | name, description, scope, owning_group_id, status, version, audit columns | PK; FK group | `FormTemplate` |
| `template_allowed_groups` | Visibility | template_id, group_id | PK composite | `allowedGroupIds` |
| `template_fields` | Field definitions | template_id, field_key, label, type, required, config JSON | PK; FK template | `FormFieldDefinition` |
| `template_workflow` | Workflow header | template_id, workflow_type | PK/FK | `TemplateWorkflow` |
| `template_hierarchy_steps` | Ordered steps | template_id, step_order, role_label, assignee_user_id | PK; FK template, user | `HierarchyApprovalStep` |

**Confirmed:** Active/Inactive; generic vs group; field JSON/config; hierarchy assignees; version counter.  
**Proposed improvement:** Optional `template_versions` history table if product needs restore — **not required** if request snapshots remain authoritative for past submissions.

#### C. Requests, revisions, values, attachments

| Table | Purpose | Important fields | Keys / relations | Frontend model |
|-------|---------|------------------|------------------|----------------|
| `requests` | Stable request identity | request_number **UNIQUE**, template_id, workflow_type, requester_*, status, revision_number, submitted_at, last_resubmitted_at, cancel_* | PK; UNIQUE number | `SubmittedRequest` root |
| `request_revisions` | Append-only revisions | request_id, revision_number, submission_type, submitted_at, outcome, return_* | PK; UNIQUE (request_id, revision_number) | `RequestRevision` |
| `request_field_definitions` | Snapshotted fields | revision_id **or** request_id+revision | FK | `fieldDefinitions` |
| `request_field_values` | Values | revision_id, field_id, value | FK | `fieldValues` |
| `request_attachments` | Files metadata | revision_id, field_id, stored_path, original_name, mime, size | FK | `AttachmentMetadata` |
| `request_reviewers` | Parallel assignments | request_id, revision_number, user_id, status, comments, action_at | FK | `ReviewerSnapshot` |
| `request_approval_steps` | Hierarchy assignments | request_id, revision_number, step_order, role_label, user_id, status, comments, action_at | FK | `ApprovalStepSnapshot` |

**Confirmed:** Stable request number across revisions; immutable closed revisions; current work either as “open revision row” or root + current snapshots (match frontend: current on root, closed in `revisions[]`).  
**Proposed:** Store files outside web root; DB holds paths only. Use transactions when closing a revision and opening the next.

#### D. Activity, notifications, audit

| Table | Purpose | Important fields | Keys / relations | Frontend model |
|-------|---------|------------------|------------------|----------------|
| `request_activity` | User-visible timeline | request_id, revision_number, type, actor, description, comment, related_step_key, timestamp | FK request | `ActivityEvent` |
| `notifications` **Proposed / planned in docs** | In-app alerts | user_id, type, payload, read_at, created_at | FK user | **Not in frontend yet** |
| `admin_audit_log` **Proposed** | Config/security events | actor, action, entity, before/after JSON, ip, timestamp | — | **Not in frontend** |

#### E. Concurrency helper

| Table / column | Purpose | Tag |
|----------------|---------|-----|
| `requests.row_version` or `updated_at` | Optimistic lock for decisions | **Proposed improvement** |
| UNIQUE(`request_number`) | Number integrity | **Confirmed** need |

### 9.3 Revision & immutability pattern (recommended)

Align with frontend semantics:

1. **Open revision** = current `field_values` + current reviewer/step rows for `revision_number`.
2. On return: set status Returned; leave assignments as historical for that revision.
3. On resubmit: **INSERT** closed revision snapshot (values, attachments, decisions); increment `revision_number`; **INSERT** fresh Pending assignments (same user IDs); status Pending — in one transaction.
4. On cancel: archive open revision with outcome Cancelled; set terminal status.
5. Never UPDATE closed revision decision rows.

### 9.4 Template vs request versioning

| Concern | Confirmed from frontend | Proposed backend |
|---------|-------------------------|------------------|
| Live template edits | Overwrite + version++ | Same; ACL on server |
| Past submissions | Field definition snapshot on request | Persist snapshot tables |
| Full template version history | Absent | Optional later |

---

## 10. Findings and Recommendations

### 10.1 Architectural strengths

- Clear domain types designed for API substitution.
- Repository / service separation already mirrors PHP MVC service layer.
- Workflow rules centralized in `decisionService` / `requestLifecycleService` (good porting target).
- Request snapshots protect history from template edits.
- Revision model preserves request numbers and prior decisions.
- Permission helpers are explicit (including “Admin ≠ blanket request access”).
- Vitest coverage for transitions, decisions, lifecycle, permissions.

### 10.2 Potential implementation problems

- **Doc drift:** Early PHP-SSR docs vs React SPA reality — reconcile before coding backend.
- **Client-trusted security:** All ACL and workflow rules are bypassable today.
- **No transactions / locking** under concurrent approvers.
- **Attachments as data URLs** unsuitable for production size/security.
- **Single-group users** vs possible multi-group company DB.
- **Hierarchy assignees are concrete users** — positions (OQ-3) not modeled.
- Route meta permissions unused for several sensitive routes.

### 10.3 Missing backend requirements (relative to frontend + early docs)

| Item | Status |
|------|--------|
| Real auth + PHP sessions + CSRF | Required; mock only today |
| Company employee DB integration | Required (users read-only in mock) |
| File storage outside web root | Required |
| In-app notifications | Documented earlier; **not in frontend** |
| Admin audit log | Documented; **not in frontend** |
| User/Group admin UIs | Early docs; Group Management **out of scope** for restore |
| Position-based approver resolution | Open (OQ-3); not in frontend |
| Request drafts | Not in frontend (OQ-12 answered “no” by code) |

### 10.4 Data inconsistencies

- Denormalized display fields vs live directory.
- Activity event enum includes unused types.
- Cancel reason UI vs optional service field.
- `FRONTEND.md` paths (`resources/ts`, PHP views) do not match `src/` React tree.
- `DECISIONS.md` historically said “No React”; codebase is React — treat decisions as partially superseded for UI technology.

### 10.5 Security concerns

| Concern | Severity |
|---------|----------|
| Forgeable userId / roles via localStorage | Critical for production |
| Client-side-only authorization | Critical |
| Blind overwrite of request JSON | High (integrity) |
| Attachment data URLs / guessable sample paths | High |
| No CSRF model yet | High for cookie sessions |
| XSS / output encoding | Medium (React helps; API JSON still needs care) |

### 10.6 Approval workflow edge cases

| Case | Current mock behavior | Backend note |
|------|----------------------|--------------|
| Parallel: one rejects while another still Pending | Overall Rejected; other stays Pending on snapshot | Decide whether to auto-close remaining tasks |
| Resubmit after hierarchy return | Always restart step 1 | Matches mock; confirm vs OQ-1 product intent |
| Reject terminal | No reopen | Matches mock; confirm vs OQ-5 |
| Cancel only from Pending | Returned cannot cancel | Preserve |
| Waiting approver in inbox | Visible, not actionable | Preserve UX |
| Disabled assignee mid-flight | Not handled | OQ-10 still open |
| Duplicate hierarchy assignee | Warning only | Consider server hard-fail |

### 10.7 Recommended integration order

1. **PHP project bootstrap** — public front controller, PDO, config, session cookies, CORS/same-origin for SPA.
2. **Auth + employee directory read** — map company users → SATS roles/flags; `/api/auth/me`.
3. **Groups read API** — no Group Management UI.
4. **Templates read + manage API** — port validation + ACL; then cut over Templates pages.
5. **Requests create + list + detail** — numbers, snapshots, multipart uploads.
6. **Decision engine** — port `decisionService` with transactions + locking.
7. **Resubmit / cancel** — port `requestLifecycleService`.
8. **Inbox API** — replace `inboxService` queries.
9. **Notifications** (if still in MVP scope) — new feature; no frontend yet.
10. **Remove mock repositories / role switcher / reset**.

### 10.8 Features that may require frontend adjustments

- Login/logout UI (or token handoff) replacing Sidebar switcher.
- Async service APIs + error toasts/retry.
- Real file upload progress and secure viewers (replace data URLs).
- CSRF token plumbing on mutations.
- Remove mock reset; environment-specific basename.
- Optional: tighten `ProtectedRoute` for review/details/inbox to match `routeMeta`.
- Notifications bell if/when backend adds notifications.
- If company DB is multi-group, UI assumptions of single `groupId` need product decision.

### 10.9 Open questions: mock answers vs still open

| OQ | Topic | Mock frontend answer | Still need product confirmation? |
|----|-------|----------------------|----------------------------------|
| OQ-1 | Resubmit hierarchy stage | Restart at step 1 | Confirm for PHP |
| OQ-2 | Withdrawal rules | Cancel = Pending + owner only; irreversible | Confirm naming (cancel vs withdraw) |
| OQ-3 | Position resolution | Specific users only | Still open |
| OQ-4 | Change reviewers after submit | Not allowed (incl. resubmit) | Confirm |
| OQ-5 | Reject terminal | Yes | Confirm |
| OQ-6 | Comments required | Reject/return yes; approve no | Confirm |
| OQ-7 | Extra submission fields | Not implemented | Still open |
| OQ-12 | Drafts | Not implemented | Confirm cut |
| OQ-11 | Request number format | `SATS-{year}-{6}` global max | Confirm |

---

## Appendix A — Key source index

| Topic | Path | Notable lines |
|-------|------|---------------|
| Roles / User / Group | `src/types/index.ts` | L13–110 |
| Request / revision types | `src/types/request.ts` | L10–195 |
| Template / field types | `src/types/template.ts` | L7–125 |
| Transitions | `src/utils/requestTransitions.ts` | L19–62 |
| Permissions | `src/utils/permissions.ts` | L9–74, L152–163 |
| Template ACL | `src/utils/templatePermissions.ts` | L31–50 |
| Assignment / actability | `src/utils/assignmentHelpers.ts` | L21–51 |
| Decisions | `src/services/decisionService.ts` | L50–57, ~L99–150, ~L218–244, ~L286–388 |
| Resubmit / cancel | `src/services/requestLifecycleService.ts` | L37–61, L70–217 |
| Inbox | `src/services/inboxService.ts` | L33–101 |
| Create request / numbers | `src/services/requestRepository.ts` | L222–296 |
| Template availability | `src/services/templateService.ts` | L30–72 |
| Routes | `src/routes/AppRouter.tsx` | full file |
| Storage keys | `src/services/resetMockData.ts` | L7–23 |
| Auth session | `src/services/authService.ts` | L12–96 |

## Appendix B — Classification cheat sheet

| Feature | Classification |
|---------|----------------|
| React SPA + localStorage MVP | Verified |
| Two workflow engines + revisions | Verified |
| Cookie/PHP session auth | Not implemented (planned) |
| REST API client | Not implemented |
| Notifications | Not implemented |
| Request drafts | Not implemented |
| Template version history store | Not implemented (counter only) |
| Position-based hierarchy | Not implemented |
| Group Management UI | Not present (do not restore) |
| Server-side authorization | Not implemented (client-only today) |
| Concurrency-safe approvals | Not implemented |
| Company employee DB | Assumed future; mock directory now |

---

## Appendix C — Compatibility principle for backend design

Preserve these frontend-proven behaviors unless product explicitly changes them:

1. Five request statuses and the transition matrix in §5.2.  
2. Parallel unanimous approve; reject/return ends the revision.  
3. Sequential one-active-step hierarchy; resubmit restarts at step 1.  
4. Stable `requestNumber`; append-only closed revisions.  
5. Field/workflow snapshots at submission.  
6. Admin does not get blanket request visibility or inbox.  
7. Designated Approver (`hasApprovalResponsibility`) distinct from Admin.  
8. Cancel only while Pending; edit/resubmit only while Returned and owner.

Port `decisionService.ts` and `requestLifecycleService.ts` as the first PHP service specifications; replace repositories with PDO models; keep the React UI as the client of a same-origin REST API with cookie sessions.

---

*End of assessment.*
