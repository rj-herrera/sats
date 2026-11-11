# SATS Current Status Report

Date: 8 November 2026

This report describes the Submission and Approval Tracking System (SATS) as the code works now. It is written so another model can build a live-demo test program. The test program should be a browser walkthrough against the running app, not a unit-test suite. The question to answer is: is this already okay to present to an internal audience?

Older files in `docs/` (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `FRONTEND.md`, and the October 2026 assessments) describe an earlier plan. They are not the current system. Do not use them as the test specification.

## What SATS is

SATS is an internal web app for creating a request from a template and tracking it through approval. The screens are a React app. Identity, people, groups, templates, requests, files, and role assignments go through a plain PHP JSON API and MySQL. The browser does not keep templates or requests in localStorage.

Two workflows exist:

- **Review / Checking.** The requester picks the reviewers. They all act at the same time. Every one of them must approve. Any reject ends the request. Any return sends it back.
- **Hierarchy Approval.** The template fixes the ordered approvers. Only the current step can act. Approving opens the next step. The last approval finishes the request. Reject and return stop the chain.

## How to run it for a demo

Both of these must be running on the demo machine:

- Apache (XAMPP) so the API answers at `http://localhost/sats/api`.
- The Vite dev server so the UI answers at `http://localhost:5173/`.

The UI calls the API on port 80 and sends cookies. Opening only port 5173 with Apache stopped will show account errors. Opening only the Apache folder will not show the React app.

Sign-in uses the company portal cookie named `userID`. There is no SATS username form. If the cookie is missing, the screen says "Sign in required" and links to `http://localhost/KDTPortalLogin/`.

For a local demo, a testing sign-in box appears on that screen when `SATS_DEV_LOGIN=1` in `.env` and the browser is on localhost. It asks for an employee id and writes the same portal cookie. The sidebar account menu then shows "Log out", labeled "Testing only". Both labels are visible. A presenter should either explain them as local demo controls or avoid lingering on them.

Databases, from `.env`:

- Directory (`DB_NAME`, typically `kdtphdb_new`): employees and groups. Read only.
- Portal login (`LOGIN_DB_NAME`, typically `kdtphdb`): cookie hash lookup.
- SATS (`SATS_DB_NAME`, typically `sats`): roles, templates, requests, audit.

There is no bundled sample company. People and groups are the real directory. Templates and requests are whatever is already in the `sats` database. A demo that starts from an empty `sats` database must create its templates live. Do not expect the old seed numbers `SATS-2026-000001` through `000003`, or the old mock users Employee 1 / Approver 1. Those belonged to the retired localStorage demo.

## Roles the demo must use

Everyone is an employee. Extra authority is a row in `sats_role_assignments`.

| Stored code | What the person sees | Demo use |
|---|---|---|
| none | New Request, My Requests. Action Inbox only if they already have assigned work. | Requester |
| `APPROVER` | Those, plus Action Inbox, plus Group Templates for their primary group | Group template author and approver |
| `ADMIN` | Template Management for every template, plus Approver Configuration and Administrators. No inbox unless they are also an approver or already have assigned work. | System administrator |

Roles stack. An approver who is also an admin keeps both. Inactive employees cannot sign in as active users. Job title does not grant access.

`GROUP_MANAGER` still exists in the role catalogue, but no screen grants it and the sign-in code does not turn it into a role. Do not build a demo step around it.

Before the audience arrives, confirm these four people exist and write down their employee ids:

1. A requester in group A, with no approver or admin role.
2. Approver 1, primary group A, role `APPROVER`.
3. Approver 2, any group, role `APPROVER`. Used as the second hierarchy step.
4. An administrator, role `ADMIN`, who will not be the only administrator if the demo touches the Administrators screen.

Using the wrong person is the main way a live demo fails. An employee from group B will not see a group A template. An admin who is not an approver will not see Action Inbox.

## Screens

The app opens on My Requests.

| Path | Screen | Who |
|---|---|---|
| `/requests` | My Requests | Everyone |
| `/requests/new` | New Request | Everyone with an active group |
| `/requests/{id}` | Request Details | Owner. An assignee who opens this is sent to the inbox. |
| `/requests/{id}/edit` | Edit & Resubmit | Owner, and only while status is Returned |
| `/requests/{id}/review` | Review / Approval | The person whose assignment is Pending |
| `/inbox` | Action Inbox | Approvers, and anyone who already has assigned work |
| `/templates` | Template list | Approvers see "Group Templates". Admins see "Template Management". |
| `/templates/new` and `/templates/{id}/edit` | Template editor | Same |
| `/admin/approvers` | Approver Configuration | Admin only |
| `/admin/access` | Administrators | Admin only |
| `/login` | Redirects to My Requests | |

Unknown routes inside the shell show a 404. A page the role cannot open redirects to My Requests.

## How each feature works

**New Request.** Loads active templates the signed-in person's group may use. A generic template with no allowed-group list is available to every group. A group template is available only to its allowed groups. The form is built from the template fields. A new template starts with one blank text field, and that field is open so the label can be typed. Added fields also open. Saved fields stay collapsed until opened.

Review / Checking asks the requester to pick people, one row at a time (group, then person). A generic template may pick any active employee except the requester. A group template may pick designated approvers. An unfinished row blocks submit.

Hierarchy Approval does not ask the requester to pick people. The steps on the template are shown. Assignees may come from any group. If an assignee is inactive, submit is blocked.

Submit checks the form in the browser, then `POST /requests`. Files go as multipart data. Success shows a toast "Request submitted" with the new number, shaped `SATS-{year}-{6 digits}` using the Asia/Manila year, then returns to My Requests. The request stores a copy of the template fields and workflow, so later template edits do not change it.

**My Requests.** The signed-in person's own requests, with search and status filters.

**Request Details.** Snapshotted answers, files, status, progress, activity, and older revisions. Visible only to the requester or to someone assigned on any revision. Admin does not get a blanket view.

The owner can cancel while the status is Pending or Returned. Cancel asks for an optional reason, then returns to My Requests with a toast. Approved, Rejected, and Cancelled cannot be cancelled. Cancel is permanent.

**Edit & Resubmit.** Only the owner, only when status is Returned. The return note is shown. At least one answer must change. New files can be added. The reviewer or approver list is locked and cannot be changed for that revision. The page also has Cancel Request. Save starts a new revision, sets the status back to Pending, and restarts the workflow: every reviewer Pending again, or hierarchy back to step 1. Older decisions stay in history.

**Action Inbox.** Two lists: Assigned to Me, and Completed. Assigned includes hierarchy steps that are still Waiting. Those rows are visible and not actionable. The sidebar badge counts only items the person can act on now. Completed shows that person's latest decision and hides anything still waiting on them.

**Review / Approval.** Approve, Reject, or Return. A confirmation dialog opens first. Approve has an optional comment. Reject requires a rejection reason. Return requires revision notes. Only a Pending assignment on a Pending request can be decided. The server rejects a Waiting step and a stale screen.

**Templates.** Approvers can create and edit only group templates for their own primary group. Admins can create generic templates (all groups, or selected groups) and can edit every template. Status is Active or Inactive. There is no Draft. Activation requires a name, description, at least one field, and a valid workflow. The editor steps are Basic Information, Form Fields, Approval Workflow, Preview & Publish. Leaving with unsaved changes asks for confirmation. Activate and deactivate from the list ask for confirmation. A content change stores a new template version. Sending a stale version fails with a conflict.

Field types: text, textarea, number, Philippine peso, US dollar, Japanese yen, URL, date, select, radio, checkbox, and file. File rules are fixed: up to 5 files per field, 20 MB each, types pdf, doc, docx, xls, xlsx, ppt, pptx, csv, txt, png, jpg, jpeg. Files are stored on disk under `storage/attachments/{requestId}/` and downloaded through the API after the same visibility check. The owner of a returned request can remove a file from the current revision.

**Approver Configuration.** Admin only. Lists active approvers by their primary group. Add an active employee, or deactivate an approver. Deactivate does not delete the history row.

**Administrators.** Admin only. Add an administrator or deactivate one. The server refuses to deactivate the last active administrator. Do not demo that failure unless the point is to show the guard.

Success and failure use a small toast. There is no notification inbox.

## Status rules a test must expect

Request statuses: Pending, Approved, Rejected, Returned, Cancelled.

Assignment statuses: Waiting, Pending, Approved, Rejected, Returned.

- Reviewers on Review / Checking are all Pending together. The request becomes Approved only when every reviewer has approved. One reject makes the request Rejected. One return makes it Returned.
- Hierarchy step 1 starts Pending. Later steps start Waiting. Approving the current step makes the next Waiting step Pending. The last approval makes the request Approved.
- Decisions are refused unless the request is Pending and that person's assignment is Pending.
- Resubmit is refused unless the owner changed at least one non-file answer and the status is Returned. After resubmit, hierarchy starts again at step 1. Reviewers are all Pending again. The same people stay assigned.
- Cancel from the screen is owner-only and allowed for Pending and Returned.
- Approved, Rejected, and Cancelled accept no further decision, resubmit, or cancel.

## What is okay to present

These paths are implemented end to end against MySQL and are the right demo:

1. Approver 1 creates a group template, adds fields, sets a two-step hierarchy (Approver 1 then Approver 2), and activates it.
2. The requester in the same group submits that template.
3. Approver 1 opens Action Inbox, sees the new request as their turn, and returns it with a note.
4. The requester sees Returned, edits one answer, and resubmits.
5. Approver 1 sees the request back at step 1. Approver 2 still cannot act. Approver 1 approves. Approver 2 can then act.
6. Contrast with Review / Checking: the requester picks Approver 1, submits, and Approver 1 approves, rejects, or returns.
7. The administrator opens Template Management and shows a generic template, then opens Approver Configuration without changing the people who are about to be used on stage.

File attach and download can be shown with one small PDF or PNG if time allows. Keep it to one file.

## What will make a live demo look unfinished

- The amber "Testing only" sign-in box and the sidebar "Log out / Testing only" line. Say they are local demo controls, or sign in through the portal before the audience arrives so that box is not on screen.
- An empty template list or an empty inbox because nobody created data. Create the template and, if wanted, one request before the audience arrives. Write down the new request number.
- The wrong persona. Admin with no approver role has no Action Inbox. An employee outside the template's group cannot select that template.
- Deactivating the last administrator, or deactivating the approver who is needed for the next click.
- Japanese or any other language. The UI is English only. There is no language switcher.
- Notifications, My Profile, Group Management, and System Settings. They are not in the product. Do not look for them.
- The old localStorage modules under `frontend/src/services/` (`requestRepository`, `templateRepository`, `decisionService`, `requestLifecycleService`). Pages do not call them. A test that writes localStorage will not change what the audience sees.

## What the test program should do

Build a manual browser script the presenter, or an agent with the browser, can run on `http://localhost:5173/` while Apache and MySQL are up. It should not reset the company directory. It should not deactivate the last administrator. It should create its own template and request, and it should say which employee id to type at each switch.

Suggested checks, each with an expected result:

1. Signed out: the sign-in gate appears. With dev login enabled, an employee id signs in and My Requests opens.
2. Requester sidebar: New Request and My Requests. No Approver Configuration. No Administrators. No Group Templates.
3. Approver 1 sidebar: Action Inbox and Group Templates. No Administrators.
4. Admin sidebar: Template Management, Approver Configuration, Administrators. Action Inbox only if that admin is also an approver or already has assigned work.
5. Approver 1 creates and activates a group hierarchy template with two steps and at least one required text field. It appears for the requester in that group and does not appear for an employee in another group.
6. Requester submits. My Requests shows the new number as Pending. A second submit with the required field empty stays on the form and shows an error.
7. Approver 2 opens the inbox and can see the request but cannot decide yet, because their step is Waiting.
8. Approver 1 returns it with a note. The requester sees Returned and the note.
9. Resubmit with no changes is refused. Resubmit after editing the text succeeds, status returns to Pending, and the workflow is back at step 1. The approver list did not change.
10. Approver 1 approves. Approver 2 can then approve. The request becomes Approved. Neither person can decide again.
11. A separate Review / Checking request: requester picks one approver, that approver rejects with a reason, and the request becomes Rejected. Cancel is not offered.
12. A separate request is cancelled by the owner while Pending. It becomes Cancelled. The same owner can also cancel a Returned request from Edit & Resubmit.
13. A direct URL to another person's request that the current user does not own and is not assigned to does not show the data.
14. Template activate and deactivate ask for confirmation. An approver cannot save a generic template.
15. One allowed file uploads and can be opened. A disallowed type or a sixth file is refused.

Judge the demo ready if checks 1 through 11 pass with the scripted people, the two workflows are visually distinct, and the only unfinished chrome is the explained testing sign-in. Fail the demo if the wrong role can manage templates, a Waiting approver can decide, a returned request cannot be resubmitted, or the new request never appears for the assigned approver.

Do not treat a green `npm test` as presentation proof. Those tests still cover the retired localStorage services. The presentation proof is this browser script against the API.
