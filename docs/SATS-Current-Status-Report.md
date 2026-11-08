# SATS Current Status Report

Date: 8 November 2026

SATS (Submission and Approval Tracking System) is an internal request-and-approval app. The screens are a React app. Identity, people, groups, templates, requests, files, and role assignments are stored through a plain PHP JSON API and MySQL. The browser no longer keeps templates or requests in localStorage.

Older files in `docs/` (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `FRONTEND.md`, and the October 2026 assessments) describe an earlier plan: server-rendered PHP, or a React demo that saved everything in the browser. They are not the current system. This report follows the code.

## Current status

A signed-in employee can create a request from an active template, attach files, and send it through one of two workflows. An assigned person can approve, reject, or return it. The owner can revise a returned request or cancel a pending one. Approvers manage templates for their own group. Administrators manage every template, designate approvers, and designate other administrators.

| Layer | What it does | Where data lives |
|---|---|---|
| React UI (`frontend/`) | My Requests, New Request, details, edit, inbox, review, templates, approver configuration, administrators | Reads and writes the PHP API |
| Directory API | Current user, groups, employees | Company MySQL (`employee_list`, `group_list`, `employee_group`) |
| SATS API | Templates, requests, decisions, files, role assignments | `sats` MySQL, plus files on disk |
| Sign-in | Portal cookie `userID` | Portal login database (`kdtlogin.fldUserHash`) |

Not built: in-app notifications, My Profile, a SATS username form, email or SMS, Group Management as its own screen, and System Settings. The UI is English only.

Leftover browser modules still exist and are used by older unit tests: `requestRepository`, `templateRepository`, `decisionService`, `requestLifecycleService`, and `inboxService`. Live pages do not call them. They still describe an older localStorage workflow, including a cancel rule that only the tests use.

## How the app is put together

The browser app is React 19, React Router 7, TypeScript, Tailwind CSS 4, and Vite 7. Development runs at `http://localhost:5173/` with `base: '/'`. API calls go to `http://localhost/sats/api` unless `VITE_API_BASE` is set. Requests send cookies (`credentials: 'include'`).

The API is plain PHP with no framework and no Composer app. `api/index.php` builds the controllers. `backend/Router.php` maps the path. Responses are JSON. CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173`. SQL uses PDO prepared statements. Template saves, request decisions, resubmits, cancels, and role changes run inside a database transaction and lock the row they change.

Three MySQL databases, from `.env`:

- **Directory** (`DB_NAME`, typically `kdtphdb_new`): read-only employees and groups.
- **Portal login** (`LOGIN_DB_NAME`, typically `kdtphdb`): the `userID` cookie is matched to the portal user hash.
- **SATS** (`SATS_DB_NAME`, typically `sats`): roles, templates, and requests. Scripts are `database/sats_roles.sql`, `database/sats_templates.sql`, and `database/sats_requests.sql`.

Uploaded files are stored under `storage/attachments/{requestId}/`, outside the public web root. Download goes through an authorized API route. The database stores the file name, size, type, and stored name, not the bytes.

## Sign-in and roles

There is no SATS login form. On load the app calls `GET /me`. PHP reads the `userID` cookie, resolves the employee, and refuses an inactive employee. If the cookie is missing, the UI shows "Sign in required" and links to `http://localhost/KDTPortalLogin/`.

A local testing sign-in exists. It answers only when `SATS_DEV_LOGIN=1` and the caller is localhost. `POST /dev/sign-in` with an employee id writes the same portal cookie. The sidebar account menu has a matching "Log out" marked "Testing only".

After sign-in, the app loads groups and employees into an in-memory directory. Template and reviewer pickers read that directory. The signed-in user is refreshed when the window gains focus.

Everyone is an employee. Extra authority comes from `sats_role_assignments`:

| Stored code | App role | What they can do |
|---|---|---|
| none | employee | Create requests and see their own. Action Inbox appears only if they already have assigned work. |
| `APPROVER` | approver | Action Inbox, decide on assignments, and manage templates owned by their primary group |
| `ADMIN` | admin | Manage every template, including generic ones. Open Approver Configuration and Administrators. Admin alone does not open the inbox. |

Roles stack. An approver who is also an admin keeps both. Inactive employees stay employees with no approver or admin power. Job title is not a permission.

`GROUP_MANAGER` is still in the role catalogue and in `RoleModel::managedGroupIdsByEmployee()`, but nothing calls that method, the role projector does not turn it into an app role, and no screen grants it. Group template management now comes from the `APPROVER` role and the employee's primary group.

Sidebar:

- **My Workspace** (everyone): New Request, My Requests. Action Inbox when the user is an approver, still has the unused `groupManager` flag, or already has assigned work. The badge counts items they can act on now.
- **Management** (approvers and admins): "Group Templates" for an approver, "Template Management" for an admin.
- **Administration** (admins only): Approver Configuration, Administrators.
- `/` and `/login` redirect to My Requests. A page the role cannot open redirects to My Requests. Unknown routes inside the shell show a 404.

## Screens and how they work

**My Requests** loads `GET /requests?view=mine`. Filters cover search and status. Opening a row goes to details.

**New Request** loads Active templates the user's group may use (`GET /templates?view=available`). Choosing one builds the form from that template's fields. Two workflows:

- **Review / Checking** (`review_checking`): the requester picks one or more people. They all become Pending at once. The request is Approved only when every one of them approves. Any reject ends it as Rejected. Any return sets Returned. A generic template can pick any active employee except the requester. A group template can pick designated approvers. The picker is one row per person: choose a group, then a person, and add another row for the next person.
- **Hierarchy Approval** (`hierarchy_approval`): steps and assignees are fixed on the template. Assignees may come from any group. Step 1 is Pending. Later steps are Waiting. Approving a step makes the next Waiting step Pending. The last approval sets Approved. Reject and return stop the chain.

The browser checks required fields, types, and reviewer selection, then `POST /requests`. If files are attached, the same route receives multipart form data (`payload` JSON plus `files[fieldId][]`). The server copies the current template version, field definitions, values, and assignments onto the request, so a later template edit does not rewrite it. The request number is `SATS-{year}-{6 digits}` using the Asia/Manila year. Success shows a toast and returns to My Requests.

**Request Details** loads `GET /requests/{id}`. It shows the snapshotted fields, files, status, approval progress, activity, and past revisions. A request is visible only to its requester or to someone assigned on any revision. Others get "not found". Admin does not get a blanket view. The owner can cancel while status is Pending. If status is Returned, the owner can open Edit & Resubmit. An assignee who opens details is sent to the inbox instead of staying on the owner page.

**Edit & Resubmit** is only for the owner, and only when status is Returned. At least one answer must change. New files can be added and kept files can be dropped. Save opens the next revision, sets status back to Pending, and restarts the workflow: all reviewers Pending again, or hierarchy back to step 1 Pending and the rest Waiting. Older decisions stay in revision history. The route is `POST /requests/{id}/resubmit`.

**Action Inbox** has Assigned to Me (`view=inbox`) and Completed (`view=completed`). Pending requests the user is assigned to appear under Assigned, including hierarchy steps that are still Waiting. Waiting steps are visible but not actionable (`canAct` is false). Completed lists the user's latest decision and hides anything still waiting on them.

**Review / Approval** records Approve, Reject, or Return through `POST /requests/{id}/decisions`. Reject and Return require a comment. Approve's comment is optional. A confirmation dialog is shown before the decision is sent. Only a Pending assignment on a Pending request can be decided. The server locks the request row and checks `rowVersion`, so a stale screen cannot overwrite a newer change.

**Templates** lists templates the user may manage (`view=manageable`), with activate and deactivate. The editor is four steps: Basic Information, Form Fields, Approval Workflow, Preview & Publish. There is no Draft status. A template is Active or Inactive. Activation requires a description, at least one field, and a valid workflow. A new template starts with one blank text field, and that field opens expanded so the label can be typed immediately. Fields added with Add Field also open. Existing fields on a saved template stay collapsed until opened. Approvers are forced to group scope and their own primary group. Admins can create generic templates or group templates and can edit any template. For a generic template, an empty allowed-group list means all groups; the admin can also limit it to selected groups. Each content change stores a new immutable `template_versions` row. A status-only change does not. The client must send the current `version` or the save returns 409.

Field types: text, textarea, number, PHP/USD/JPY currency, URL, date, select, radio, checkbox, and file. File rules are fixed, not chosen by the template author: up to 5 files per field, 20 MB each, types pdf, doc, docx, xls, xlsx, ppt, pptx, csv, txt, png, jpg, jpeg. The owner can remove a file from the current revision with `POST /requests/{id}/attachments/{attachmentId}/remove`. Download is `GET /requests/{id}/attachments/{attachmentId}` after the same visibility check.

**Approver Configuration** (admin only) lists active `APPROVER` assignments, grouped by the employee's primary group. An admin can add an active employee or deactivate an existing approver. Deactivate sets `is_active` to 0. It does not delete the row. The change is written to `sats_access_audit`.

**Administrators** (admin only) lists active `ADMIN` assignments. An admin can add another administrator or deactivate one. The server refuses to deactivate the last active administrator.

Success and failure of these actions use a small toast, not a separate notification inbox.

## API routes

Directory, used at sign-in:

- `GET /me`
- `GET /groups`, `GET /groups/{id}`
- `GET /employees`, `GET /employees?groupId=`, `GET /employees/{id}`
- `POST /dev/sign-in`, `POST /dev/sign-out` (localhost testing only)

Templates:

- `GET /templates?view=available`
- `GET /templates?view=manageable`
- `GET /templates/{id}`
- `POST /templates`
- `PUT /templates/{id}`

Requests:

- `GET /requests?view=mine|inbox|completed`
- `GET /requests/{id}`
- `POST /requests`
- `POST /requests/{id}/decisions`
- `POST /requests/{id}/resubmit`
- `POST /requests/{id}/cancel`
- `GET /requests/{id}/attachments/{attachmentId}`
- `POST /requests/{id}/attachments/{attachmentId}/remove`

Administration (admin only):

- `GET /admin/approvers`, `POST /admin/approvers`, `PATCH /admin/approvers/{employeeId}`
- `GET /admin/access`, `POST /admin/access`, `PATCH /admin/access/{employeeId}/ADMIN`

## Workflow rules

Statuses are Pending, Approved, Rejected, Returned, and Cancelled. Assignment statuses add Waiting.

- Review is parallel and unanimous. Hierarchy is one active step at a time and cannot be skipped.
- A decision is allowed only while the request is Pending and the caller's assignment is Pending. A Waiting step returns an error.
- Reject is terminal. Return sends the request back to the owner and closes that revision.
- Resubmit is owner-only, status Returned, and at least one non-file answer must change. It starts a new round from the beginning and keeps history.
- The details screen offers Cancel only while status is Pending, and only to the owner. The API also accepts Cancel from Returned. That difference is real: the screen is stricter than the server.
- Approved, Rejected, and Cancelled do not accept new decisions.
- Field values are checked against the snapshotted definitions (required, type, options, length, min and max, URL). File fields are checked by the attachment store, not as text values.
- Each mutation bumps `row_version`.

Tables: `templates`, `template_versions`, `template_allowed_groups`, `requests`, `request_revisions`, `request_approval_assignments`, `approval_decisions`, `request_activity`, `request_number_sequences`, `sats_roles`, `sats_role_assignments`, `sats_access_audit`.

## Known gaps

- **No notifications, profile, group-admin screen, or system settings.**
- **Directory list endpoints are broad.** Any signed-in user who can reach them receives the group and employee lists. The screens need that directory for pickers.
- **`GROUP_MANAGER` is unused.** The catalogue and a query method remain. Live group-template rights come from `APPROVER` plus the primary group.
- **Cancel mismatch.** The screen allows Pending only. The API allows Pending or Returned.
- **Old localStorage services and their tests remain.** They are not what the screens run. Do not treat them as the live workflow.
- **Early docs in `docs/` are stale**, except this report.
