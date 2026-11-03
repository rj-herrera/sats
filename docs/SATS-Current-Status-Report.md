# SATS Current Status Report

SATS (Submission and Approval Tracking System) is an internal request-and-approval app. The screens you use are a React app. People and groups come from the company databases through a PHP API. Templates and requests that you create in the browser are still saved only in that browser, not in MySQL. A separate PHP API already implements templates and the full request lifecycle in MySQL, but the React pages do not call it yet.

This report follows the code as of November 2026. Early docs under `docs/` (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `FRONTEND.md`, and the October 2026 assessments) describe an older plan and are not the current system.

## Current status

The product story works in the browser: pick a template, fill a form, submit, review or approve, return, revise, resubmit, cancel, and read history. Sign-in is real. Persistence of templates and requests is not.

| Layer | What it does today | Where data lives |
|---|---|---|
| React UI (`frontend/`) | All screens: My Requests, New Request, details, edit, inbox, review, template management | Templates and requests in `localStorage` |
| Directory API | Who you are, groups, employees, SATS roles | Company MySQL plus the `sats` role tables |
| Template and request API | Create, update, submit, decide, resubmit, cancel | `sats` MySQL, with transactions |
| Wiring | The UI calls `/me`, `/groups`, `/employees`, and the test sign-in routes only | Request and template screens never call `/requests` or `/templates` |

Not built: notifications, My Profile, User Management, Group Management, System Settings, email, file storage, and a real SATS login page. The header language switcher is gone. The UI is English only.

## How the app is put together

The browser app is React 19, React Router 7, TypeScript, Tailwind CSS 4, and Vite 7. It runs at `http://localhost:5173/` with `base: '/'`. API calls go to `http://localhost/sats/api` (override with `VITE_API_BASE`) and send cookies.

The API is plain PHP with no framework. `api/index.php` builds the controllers and `backend/Router.php` maps the path. JSON in, JSON out. CORS allows only `localhost:5173` and `127.0.0.1:5173`.

Three MySQL databases, configured in `.env`:

- **Directory** (`DB_NAME`, typically `kdtphdb_new`): read-only `employee_list`, `group_list`, `employee_group`.
- **Portal login** (`LOGIN_DB_NAME`, typically `kdtphdb`): the `userID` cookie is matched to `kdtlogin.fldUserHash`.
- **SATS** (`SATS_DB_NAME`, typically `sats`): roles, templates, and requests. Scripts are `database/sats_roles.sql`, `sats_templates.sql`, and `sats_requests.sql`.

There is no Composer app and no ORM. SQL uses PDO prepared statements. Critical request and template writes run inside a database transaction and use row locks.

## Sign-in and roles

There is no SATS username form. On load, the app calls `GET /me`. PHP reads the `userID` cookie, looks up the portal hash, loads the employee, and refuses inactive employees. If the cookie is missing, the UI shows "Sign in required" and a link to `http://localhost/KDTPortalLogin/`.

A local testing sign-in exists. It is off unless `SATS_DEV_LOGIN=1`, and it only answers from localhost. `POST /dev/sign-in` with an employee id writes the same portal cookie. The sidebar has a matching test sign-out. Comments in the code mark this as temporary.

After sign-in, the app loads every group and employee into an in-memory directory. Later screens look people up from that memory. Unit tests still use sample users when that directory was not installed.

Everyone is an employee. Extra authority comes from `sats_role_assignments`:

| Stored code | App role | What they can do |
|---|---|---|
| none | employee | Create requests and see their own |
| `APPROVER` | approver | Action Inbox, decide on assignments, manage templates owned by their primary group |
| `ADMIN` | admin | Manage every template, including generic ones |

Admin alone does not open the inbox. An approver's template rights are their primary group on the employee record. Job title is not a permission. Inactive employees stay employees with no approver or admin power.

Sidebar:

- Everyone: New Request, My Requests.
- Approvers: Action Inbox, with a badge for items they can act on now.
- Approvers and admins: Templates.
- Unknown routes inside the shell show a 404. `/login` and `/` redirect to My Requests. A page the role cannot open redirects to My Requests.

## Screens and how they work

**My Requests** lists requests whose requester id is the signed-in user, from `localStorage`. Filters cover search and status. Opening a row goes to details.

**New Request** lists Active templates the user's group may use. Choosing one builds the form from that template's fields. Two workflows:

- **Review / Checking** (`review_checking`): the requester picks one or more reviewers. They all become Pending at once. The request is Approved only when every reviewer approves. Any reject ends it as Rejected. Any return sets Returned.
- **Hierarchy Approval** (`hierarchy_approval`): steps and assignees are fixed on the template. Step 1 is Pending. Later steps are Waiting. Approving a step makes the next Waiting step Pending. The last approval sets Approved. Reject and return stop the chain the same way as review.

The form checks required fields, types, and reviewer selection in the browser, then writes the request to `localStorage`. The request number looks like `SATS-2026-000001`. Field definitions, reviewers, and steps are copied onto the request so later template edits do not rewrite it. A confirmation screen shows the number.

**Request Details** shows the snapshot fields, status, approval progress, activity timeline, and past revisions. The owner can cancel while status is Pending. If status is Returned, they can open Edit & Resubmit. Someone else sees the request only if they are assigned on it. Admin does not get a blanket view.

**Edit & Resubmit** is only for the owner, and only when status is Returned. At least one answer must change. Save archives the closed revision, increments the revision number, sets status back to Pending, and restarts the workflow: all reviewers Pending again, or hierarchy back to step 1 Pending and the rest Waiting. Older decisions stay in revision history.

**Action Inbox** has Assigned to Me and Completed. Pending requests the user is assigned to appear under Assigned, including hierarchy steps that are still Waiting. Waiting steps are visible but not actionable. The badge counts only Pending assignments. Completed lists the user's latest decision and hides anything still waiting on them. A non-approver can still open the inbox if they already have assigned work.

**Review / Approval** is the decision page. Approve, Reject, or Return. Reject and Return require a comment. Approve's comment is optional. Only a Pending assignment on a Pending request can be decided. The result is written in `localStorage` and an activity event is appended.

**Templates** is a list of templates the user may manage, with activate and deactivate. The editor is four steps: Basic Information, Form Fields, Approval Workflow, Preview & Publish. There is no Draft status. A template is Active or Inactive. Activation requires a description, at least one field, and a valid workflow. Approvers are forced to group scope and their own group. Admins can create generic templates (empty allowed-groups means all groups) or group templates and can edit any template. Field types: text, textarea, number, PHP/USD/JPY currency, URL, date, select, radio, checkbox, and file.

**Reset sample data** in the sidebar clears template and request `localStorage`. It does not change the company directory.

## What the PHP API already does

These routes exist and enforce rules on the server. The React pages do not use the template or request ones yet.

Directory, used by the UI:

- `GET /me`, `GET /groups`, `GET /groups/{id}`, `GET /employees`, `GET /employees?groupId=`, `GET /employees/{id}`
- `POST /dev/sign-in`, `POST /dev/sign-out` (localhost testing only)

Templates, MySQL, not used by the screens:

- `GET /templates?view=available` — Active templates for the caller's group.
- `GET /templates?view=manageable` — all templates for an admin; an approver's own-group templates otherwise.
- `GET /templates/{id}`, `POST /templates`, `PUT /templates/{id}`.
- Each content change stores a new immutable `template_versions` row. Status-only changes do not. `version` must match or the save returns 409.
- Allowed groups live in `template_allowed_groups`.

Requests, MySQL, not used by the screens:

- `GET /requests?view=mine|inbox|completed`, `GET /requests/{id}`
- `POST /requests`, `POST /requests/{id}/decisions`, `POST /requests/{id}/resubmit`, `POST /requests/{id}/cancel`
- A request is visible only to its requester or to someone assigned on any revision. Others get 404.
- Creates copy the current template version, field definitions, values, and assignments. The number is `SATS-{year}-{6 digits}` using the Asia/Manila year, from `request_number_sequences`.
- Decisions lock the request row, check `rowVersion`, require status Pending, and require the caller's assignment to be Pending. A Waiting step returns an error. Approve on review waits until no Pending reviewers remain. Approve on hierarchy promotes the next Waiting step. Reject and return close the revision. A comment is required for reject and return.
- Resubmit is owner-only, status Returned, and at least one non-file answer must change. It opens the next revision and copies assignments, resetting hierarchy to step 1.
- Cancel is owner-only. The API allows Pending or Returned. The browser only allows Pending. That is a real difference.
- Each mutation bumps `row_version`. A stale client gets a conflict instead of overwriting someone else.

Tables: `templates`, `template_versions`, `template_allowed_groups`, `requests`, `request_revisions`, `request_approval_assignments`, `approval_decisions`, `request_activity`, `request_number_sequences`, `sats_roles`, `sats_role_assignments`. Status values are Pending, Approved, Rejected, Returned, and Cancelled. Assignment statuses add Waiting.

## Rules that match on both sides

- Review is parallel and unanimous. Hierarchy is one active step at a time and cannot be skipped.
- Reject is terminal. Return sends the request back. Resubmit starts a new round from the beginning and keeps history.
- Approved, Rejected, and Cancelled do not accept new decisions.
- Only the original requester can resubmit or cancel.
- Field values are checked against the snapshotted definitions (required, type, options, length, min and max, URL).

## Known gaps

- **Split brain.** A template or request saved in the UI is not in MySQL. A row created through the API does not appear in the UI.
- **File fields.** The form can attach files and store name, size, and type in `localStorage`. The API rejects any attachment and any required file field with "File uploads are not available yet." Nothing is stored outside the web root.
- **Cancel rule.** Browser: Pending only. API: Pending or Returned.
- **Authorization of decisions.** In the browser it is JavaScript. The API is the one that locks rows and checks the actor.
- **No notifications, profile, user admin, group admin, or system settings.**
- **Directory reads are broad.** Group and employee list endpoints are not limited to the caller's group.
- **Outdated docs.** Do not treat `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`, or the October assessments as the live design.

## Practical reading for another model

Treat the React services `requestRepository`, `templateRepository`, `decisionService`, `requestLifecycleService`, and `inboxService` as the behavior users see. Treat `backend/Controllers/*`, `backend/Models/RequestModel.php`, `backend/Models/TemplateModel.php`, and `backend/RequestFields.php` as the server behavior that is implemented in code but not connected to those screens. The next integration step is to point the React repositories at `/templates` and `/requests` and stop using `localStorage` for those two domains.
