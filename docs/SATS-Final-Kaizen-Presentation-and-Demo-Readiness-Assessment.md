# SATS — Final Kaizen Presentation and Demo Readiness Assessment

Read-only review of the code and of aggregate rows in the local `sats` database on 9 November 2026. No files, configuration, or records were changed for the review. This is an implemented internal prototype on XAMPP, suitable for a scripted demonstration. It is not production-ready, and the database is not an operational baseline.

## Summary

| Feature | Classification | Evidence |
|---|---|---|
| Portal sign-in and current-user load | Verified Working | `backend/CurrentActor.php`, `backend/Models/PortalLoginModel.php`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/services/accountService.ts` |
| Employee and group directory | Verified Working | `backend/Models/EmployeeModel.php`, `backend/Models/GroupModel.php`, `backend/Controllers/DirectoryController.php` |
| Role catalogue and approver seed from designations | Verified Working | `database/sats_roles.sql`, `backend/RoleProjector.php`, `backend/Models/RoleModel.php` |
| Administrator grant and removal, including last-admin guard | Verified Working | `backend/Controllers/AdminController.php`, `backend/Models/RoleModel.php`, `frontend/src/pages/AccessManagementPage.tsx` |
| Approver configuration screen | Verified Working | `frontend/src/pages/ApproverConfigurationPage.tsx`, `frontend/src/services/accessApi.ts` |
| Generic and group templates, versioned | Verified Working | `database/sats_templates.sql`, `backend/Models/TemplateModel.php`, `backend/TemplateValidator.php`, `frontend/src/pages/TemplateEditorPage.tsx` |
| Dynamic form fields and server validation | Verified Working | `frontend/src/components/template/FormFieldBuilder.tsx`, `frontend/src/components/request/DynamicFormField.tsx`, `backend/RequestFields.php` |
| Review / Checking and hierarchy workflows | Verified Working | `backend/Controllers/RequestController.php`, `backend/Models/RequestModel.php`, `frontend/src/pages/RequestFormPage.tsx` |
| Action Inbox | Verified Working | `frontend/src/pages/ActionInboxPage.tsx`, `frontend/src/hooks/usePermissions.ts`, `RequestModel::list` |
| Approve, reject, return | Verified Working | `frontend/src/pages/ReviewPage.tsx`, `frontend/src/components/request/DecisionConfirmationDialog.tsx`, `RequestModel::decide` |
| Return, revise, resubmit, history kept | Verified Working | `frontend/src/pages/EditRequestPage.tsx`, `frontend/src/components/request/RevisionHistory.tsx`, `RequestModel::resubmit` |
| Status, progress, activity, comments | Verified Working | `frontend/src/components/request/ApprovalProgress.tsx`, `ActivityTimeline.tsx`, `request_activity` |
| File attachments | Verified Working | `backend/AttachmentStore.php`, `frontend/src/utils/fileAttachments.ts` |
| Cancel by owner while Pending or Returned | Verified Working | `frontend/src/utils/requestOwnership.ts`, `RequestModel::cancel` |
| Group-scoped template rights for approvers | Verified Working | `backend/Controllers/TemplateController.php` |
| Separate `GROUP_MANAGER` role | Planned, unused | Catalogue row in `database/sats_roles.sql`; `RoleModel::managedGroupIdsByEmployee()` has no caller; zero assignment rows |
| Notifications, profile, email, SLA, delegation | Planned | Named in `docs/REQUIREMENTS.md` only; no routes or tables |
| User or group administration beyond SATS roles | Planned | No user-create or group-edit screens; directory is read from the company database |
| Automated proof of the PHP API | Unverified | Vitest covers client helpers and retired localStorage services, not the API |
| Live browser pass of the full demo script | Unverified | Not executed in this review |
| Operational before-and-after metrics | Unverified | Local rows exist, but they are same-day development activity |

## 1. Current system overview

SATS is a React single-page application talking to a framework-free PHP JSON API. The UI is React 19, React Router 7, TypeScript, Tailwind CSS 4, and Vite 7 (`frontend/package.json`). The API is `api/index.php` plus `backend/Router.php`. SQL uses PDO prepared statements. Critical writes run in transactions with row locks.

Three databases are configured in `.env`:

- The company directory, typically `kdtphdb_new`: `employee_list`, `group_list`, `employee_group`, and `designation_list`. SATS does not copy employees into its own user table.
- The portal login database, typically `kdtphdb`: the `userID` cookie is matched to the portal hash.
- The SATS database, `sats`: roles, templates, requests, decisions, activity, and access audit. Scripts are `database/sats_roles.sql`, `database/sats_templates.sql`, and `database/sats_requests.sql`.

Files sit on disk under `storage/attachments/{requestId}/`. Apache is told to deny that folder (`storage/.htaccess`, root `.htaccess`). Download goes through an authorized API action.

**Deployment.** The running shape is local XAMPP plus the Vite dev server at `http://localhost:5173/`, calling `http://localhost/sats/api`. CORS allows only those two localhost origins (`backend/bootstrap.php`). There is no production host, HTTPS setting, installer, or backup job in the project. The portal login URL in code is `http://localhost/KDTPortalLogin/`.

**Maturity.** The request lifecycle a Kaizen audience cares about is implemented on the server and wired to the screens. Sign-in reuses the company portal. Approver membership can be seeded from designation rules. What remains is hardening, a real deployment, notifications, and measured use. Treat it as a demonstrable pilot candidate, not a finished production service.

**Completed:** sign-in, directory read, templates, both workflows, inbox, decisions, revision, files, cancel, approver and administrator assignment.

**Partial:** permission management (SATS roles only; the directory stays outside SATS), security (visibility checks on requests, but directory lists and a localhost test login are still open), automated tests (they do not exercise the API), and the data set (local exercise data, not operations).

**Planned, not built:** notifications, My Profile, email, SLA timers, delegation, Group Management as its own screen, System Settings, and the unused `GROUP_MANAGER` role.

## 2. Functional implementation assessment

**Request creation and submission — Verified Working.** `frontend/src/pages/RequestFormPage.tsx` posts to `POST /requests` through `frontend/src/services/requestApi.ts`. `RequestController::create` checks that the template is active for the caller's group, validates fields, and snapshots the template version. The number format is `SATS-{year}-{6 digits}` using Asia/Manila. Success shows a toast and returns to My Requests. An empty required field stays on the form. Limitation: there is no draft save.

**Generic and group-specific templates — Verified Working.** `templates`, `template_versions`, and `template_allowed_groups`. Generic templates are for all groups when the allowed-group list is empty, or for selected groups. Group templates belong to one owning group. Approvers are forced to their own primary group (`TemplateController::restrictNonAdmin`). Administrators can manage every template. Content edits create a new version; a stale version returns a conflict. The local database has 6 templates, all Active: 3 generic Review / Checking and 3 group Hierarchy Approval.

**Dynamic form fields and validation — Verified Working.** Authors build fields in `FormFieldBuilder.tsx`. Types are text, textarea, number, PHP/USD/JPY currency, URL, date, select, radio, checkbox, and file. The browser checks the form; `backend/RequestFields.php` checks the same rules again. A new template opens its first blank field. Limitation: file rules are fixed in code (5 files, 20 MB, a set extension list), not chosen per template.

**Configurable approval hierarchy — Verified Working.** Hierarchy steps store an order, a label, and a specific employee. Assignees may come from any group. Inactive assignees block submit. There is no position-based routing ("whoever holds Department Manager"). The assignee is a person chosen on the template.

**Approval routing and assignment — Verified Working.** Review / Checking: the requester picks people. A generic template may pick any active employee except the requester. A group template may pick designated approvers. All start Pending. Hierarchy: step 1 is Pending and the rest are Waiting. One approve promotes the next Waiting step. The local data has assignments from 1 to 5 people on a revision, averaging 2.

**Action Inbox — Verified Working.** `ActionInboxPage.tsx` loads `view=inbox` and `view=completed`. Waiting steps are listed and marked not actionable. The sidebar badge counts only actionable items. Completed shows that person's latest decision. An administrator does not get the inbox unless they are also an approver or already have assigned work.

**Approve, reject, and return — Verified Working.** `ReviewPage.tsx` opens `DecisionConfirmationDialog.tsx`. Reject and return require a comment. Approve's comment is optional. `RequestModel::decide` locks the row, checks `rowVersion`, and accepts a decision only when the request and that assignment are Pending. One reject ends the request. One return sends it back. Review / Checking becomes Approved only when every reviewer has approved.

**Revision and resubmission — Verified Working.** Only the owner, and only while status is Returned (`requestOwnership.ts`). At least one non-file answer must change. The reviewer list is locked on `EditRequestPage.tsx`. Resubmit copies assignments onto a new revision and starts again at the beginning. Local data: 17 revisions for 12 requests, and 4 requests have gone past revision 1. Five `request_resubmitted` events are stored.

**Revision history — Verified Working.** Closed revisions stay in `request_revisions` and are shown by `RevisionHistory.tsx`. They are not overwritten.

**Status and approval progress — Verified Working.** Statuses are Pending, Approved, Rejected, Returned, and Cancelled. `ApprovalProgress.tsx` and `ReviewerProgress.tsx` show Waiting, Pending, and completed steps. Current local counts: 3 Pending, 3 Approved, 1 Rejected, 5 Cancelled, 0 currently Returned. Returns did happen (6 return events); those requests were later resubmitted, approved, or cancelled.

**Activity, comments, and attachments — Verified Working.** `request_activity` stores submit, review, step approval, approve, reject, return, resubmit, and cancel, with the comment where one was required. Five revisions have at least one file. Download checks the same owner-or-assignee rule as the request (`RequestModel::attachmentFile`). The owner of a returned request can remove a current file.

**Group-scoped template management — Verified Working.** An approver's template menu is labeled "Group Templates" and is limited to their primary group. An administrator sees "Template Management" for all templates (`Sidebar.tsx`, `TemplateController.php`).

**Administrator and employee permission management — Partially implemented.** SATS can grant and deactivate `APPROVER` and `ADMIN`. Deactivating the last active administrator is refused. Every grant or change is written to `sats_access_audit`. The schema script also seeds approvers from active employees whose designation section is 1, plus two extra designation ids, and seeds one fixed employee id as the first administrator. Existing rows are not reactivated. SATS does not create employees, edit groups, or change portal passwords. `GROUP_MANAGER` is unused: the method exists, and the table has zero such rows.

## 3. Business and process improvement value

These points follow from the implemented behavior. They are not measured savings.

Email-based approval usually loses the current owner of a request, lets people skip a step, and leaves the history in inboxes. SATS gives one request number, one status, and one ordered path. The requester sees their own list. The assigned person sees an inbox. A Waiting approver cannot act early. A decision stores the person, the time, and the comment. A return keeps the old answers and starts a new revision instead of starting a new email thread. Files stay on the request instead of as loose attachments.

Manual work SATS can take over, once people use it: finding the right form, remembering who approves next, forwarding the same mail, and reconstructing what was approved. Template fields make the same request look the same every time. Group templates keep a group's form inside that group. Administrators can add or remove approvers without a code change.

**Directly demonstrable:** one number, a visible status, who is waiting, a required reason to reject or return, a locked sequence, and a revision trail.

**Needs a pilot before anyone quotes a result:** time saved, fewer follow-up emails, fewer skipped approvals, and faster completion. The product does not record "someone was chased by email," so that comparison has to come from a before-study.

## 4. Why a custom application?

The choices that match this company's setup are visible in the code:

- Sign-in is the existing portal cookie, not a second account.
- People and groups are read from the company directory. A new hire does not need a SATS account created by hand.
- Approvers can be seeded from designation rules already stored in that directory, then adjusted on the Approver Configuration screen.
- Two approval shapes are fixed in the product: parallel review where everyone must approve, and a strict sequence. The requester cannot skip a hierarchy step.
- A group approver manages only that group's templates. Generic forms stay with administrators.
- Each submission freezes the form and the workflow, so a later template edit does not rewrite old requests.
- Files are stored outside the web root and downloaded only after an authorization check.

A generic form or a commercial workflow tool can also do requests, inboxes, and attachments. This review did not compare product catalogs, so it does not claim those products lack any of the above. Custom work is reasonable here if the deciding requirements are the portal cookie, the live employee and designation data, and these two exact approval rules. If the company only needs a form and an email alert, a packaged tool is likely the smaller option.

The tradeoff is that this team now owns the application. There is no vendor patch stream. Security, backups, PHP and MySQL upgrades, and directory-schema changes sit with the company. The current code still has a localhost-only test login, no CSRF token, and directory list endpoints that do not check the cookie. Those are support and security costs, not reasons to hide the prototype. They are reasons to keep the first release inside a controlled pilot.

## 5. Available evidence and quantitative data

The local `sats` database was queried for counts only. No employee names or request contents were read. All 12 requests were submitted between 8 November 2026 13:57 and 9 November 2026 04:26 local database time. Completion times average a few minutes. All 66 access-audit rows are system grants from the seed script, not actions taken by an administrator in the screen. This is development and demonstration activity on one machine. It is not operational data and must not be presented as a Kaizen before-or-after result.

What the schema can measure later, and what it shows today:

| Question | Can the database answer it later? | What exists today |
|---|---|---|
| Number of requests | Yes, `requests` | 12 |
| By status | Yes | 3 Pending, 3 Approved, 1 Rejected, 5 Cancelled, 0 Returned |
| Approval lead time | Yes, `submitted_at` to `completed_at` | Approved average about 4 minutes; rejected and cancelled are about 0 to 1 minute. That is test pace, not business lead time |
| Approval stages | Yes, assignments per revision | Average 2, maximum 5 |
| Returns and resubmits | Yes, activity and revision number | 6 returns, 5 resubmits, 4 requests past revision 1 |
| Completion rate | Yes, once a real period is defined | 3 of 12 approved. Meaningless as a process result because 5 were cancelled during testing |
| Repeated follow-ups | No | Decisions and comments are stored. Reminders, emails, and chases are not |

A proper before-and-after study still needs a baseline taken outside SATS: how many of these requests are done by email today, median days to approval, how often a step is skipped or re-sent, and how often a file is missing. After a pilot, report the same definitions from `requests`, `approval_decisions`, and `request_activity`, and label the period as pilot data.

## 6. Live demonstration readiness

A 6–8 minute demo can show the finished path. Do it on the machine where Apache, MySQL, and `npm run dev` are already running. Sign in with the testing box only if `SATS_DEV_LOGIN=1`, and say once that it is a local stand-in for the portal. Prefer signing in through the portal before the audience sits down so the amber "Testing only" box stays off screen.

Prepare three people and write their employee ids on a card: a requester, Approver 1 in that requester's group, and Approver 2. Use an existing active group template with two hierarchy steps, or create that template before the audience arrives. The database already has group hierarchy templates and generic review templates. Current pending requests are all Review / Checking, so a live hierarchy walk should be a new submission, not an old pending row.

| Minute | Who | What to show |
|---|---|---|
| 0:00–0:40 | Requester | My Requests. Point at the request number and status. |
| 0:40–2:00 | Requester | New Request. Open the group hierarchy template. Show the fixed steps. Submit one required answer. Read the new number from the toast. |
| 2:00–3:30 | Approver 1 | Action Inbox. Open the request, show that it is their turn, and return it with a short note. |
| 3:30–5:00 | Requester | Status is Returned. Edit & Resubmit. Change one answer. Show that the approver list is locked. Resubmit. |
| 5:00–6:30 | Approver 1, then Approver 2 | Approver 1 approves. Approver 2, who was Waiting, can now approve. Status becomes Approved. Open activity and the previous revision. |
| 6:30–8:00 | Administrator, if time | Template list versus the approver's Group Templates. One glance at Approver Configuration. Do not add or remove anyone on stage. |

**If something fails.** If submit fails, open one of the three already Approved requests and walk status, progress, activity, and revision history. Those rows already contain both workflow types. If the inbox is noisy, filter by the number just created. If Approver 2 can act too early, stop and treat that as a defect; do not click around it. Do not deactivate an approver, and do not remove an administrator, during the talk.

## 7. Risks, limitations, and next steps

**Before the demonstration**

- Rehearse the three people and one template the same morning. Wrong group or an admin who is not an approver will hide the inbox or the template.
- Confirm Apache, MySQL, and the Vite server. The UI on port 5173 does nothing useful if the API on port 80 is down.
- Decide whether the testing sign-in will be visible. It is labeled "Testing only" in `TestingSignIn.tsx` and `Sidebar.tsx`.
- Do not present the local counts as improvement results.

**Before any pilot, not required to survive the talk**

- Remove or keep disabled the dev login (`backend/DevLogin.php`) on any shared server. The cookie is HttpOnly, but `secure` is false, which matches local HTTP only.
- Require a signed-in user on `GET /groups` and `GET /employees`. Those actions currently return directory data with no cookie check (`DirectoryController.php`).
- Add CSRF protection on the cookie-authenticated POST, PUT, and PATCH routes. None is present.
- Serve the built UI from Apache over HTTPS, with backups of `sats` and `storage/attachments`. None of that is set up.
- Replace the single seeded administrator with a named owner, and confirm the designation seed matches who the company actually wants as approvers. The seed grants a broad supervisor set. That may be wider than the pilot group.
- The Vitest suite does not prove the API. A pilot needs a short scripted check of submit, return, resubmit, and approve against MySQL.

**Later expansion:** notifications, drafts, position-based routing instead of a named person, delegation, SLA reminders, and a real before-and-after report.

Nothing in the deployment, security, or test evidence supports calling the system production-ready.

## 8. Recommended presentation content

**Five verified points worth saying**

1. A request has one number, one status, and a stored copy of the form and approval path.
2. Parallel review and sequential approval are both enforced on the server, including the rule that a later step cannot act early.
3. Return keeps the old revision and starts a new one, with the comment still visible.
4. Templates, people, and groups come from the company's own directory and designation data, with approvers adjustable by an administrator.
5. The inbox shows whose turn it is, and the record stores who decided, when, and why.

**Screens to capture**

- New Request with the hierarchy steps visible.
- Action Inbox with one actionable row and one Waiting row.
- The return confirmation dialog, because the reason is required.
- Request details after resubmit: status, progress, activity, and the previous revision.
- Template Management beside Approver Configuration, to show administration without making it the whole story.

**KPIs to propose, not to quote as already achieved**

- Requests submitted per month, by template.
- Median hours from submit to Approved.
- Share of requests returned at least once.
- Share approved with no return.
- Number of decisions recorded with a comment.

**Claims that match the evidence**

- The workflow above works on the local stack against the company directory.
- History, files, and decisions are stored in MySQL and on disk, not only in the browser.
- Administrators can grant and withdraw approver and administrator access, and the last administrator cannot be removed.

**Claims to avoid**

- Any hour saved, peso saved, or percent improved.
- "Production-ready," "company-wide," or "replaces email."
- That commercial products cannot do workflow. That was not compared.
- That follow-up effort is measured. It is not.
- That the November 8–9 rows are a pilot. They are a development exercise: 12 requests, completions in minutes, and 66 system-seeded role grants.

**Questions judges may ask**

- *Is this only a mock-up?* The screens call the PHP API. Templates, requests, decisions, and files are in MySQL and on disk. The old browser-storage code is still in the repository and is not what the pages use.
- *What did you measure?* The system can measure volume, lead time, returns, and completion after a pilot. Today's database is a two-day local exercise, so no improvement number is claimed.
- *Why not email or a packaged tool?* SATS uses the existing portal and employee directory, and it enforces this company's two approval patterns. A packaged tool may still be cheaper if those integrations are not required. That cost comparison has not been done.
- *Who can see a request?* The requester and people assigned on it. An administrator does not get every request by default. Directory lists are a known gap and should be closed before a pilot.
- *What happens when someone is absent?* The step is assigned to a named person. There is no delegate and no automatic substitute. That is a pilot limitation, not a hidden feature.
- *Can we start with one group?* Yes. Use one group template, the approvers already seeded for that group, and a short period with the KPIs above. Do not turn on a shared server until the test login is off and the directory routes require sign-in.
