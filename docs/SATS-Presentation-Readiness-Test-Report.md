# SATS Presentation Readiness Test Report

**Test date:** Monday, November 9, 2026  
**Presentation date:** Friday, November 13, 2026  
**Tester:** executed in the running application (React on port 5173, PHP API, MySQL)  
**Application code:** not modified

This report records what was actually observed. A result is **PASS** only when the running application produced the expected result. Source inspection is cited only for cases that were unsafe to execute.

## 1. Executive Summary

SATS can demonstrate its two approval models, dynamic forms, and template administration. The hierarchy path was completed in the browser: submit, return, revise, resubmit, first approval, second approval, and a final Approved request with revision history. Parallel review, rejection, return, and cancellation also completed against real employee accounts and MySQL.

The application is **ready to present if the demonstration is rehearsed and the database stays up**. It is not free of issues. During template editing, MySQL stopped and a save returned HTTP 500. The service was restarted and later saves succeeded. The signed-out page shows a “Testing only” employee-ID sign-in. A waiting hierarchy step is labeled “Pending” on Request Details while the inbox correctly says it is not that person’s turn. On the long dynamic form, the sticky footer covered a dropdown until the page was scrolled.

None of those issues stopped the main story once MySQL was running again. They can confuse judges or interrupt a live demo if they are not planned around.

**Verdict: READY WITH MINOR ISSUES**

## 2. Test Environment

| Item | Observed |
|---|---|
| Frontend | `http://localhost:5173/` returned the SATS React app. Vite was already running. |
| API | `http://localhost/sats/api` returned HTTP 200 and the endpoint list. |
| Web server | Apache (`httpd`) stayed up for the whole session. |
| Database | MariaDB 10.4.20 on port 3306. It was up, then the process died around 12:01 PM while a template save was in progress. The API then returned `SQLSTATE[HY000] [2002]`. `mysqld` was started again with the existing `my.ini`. No recovery flags were used and no data was reset. Later reads and writes succeeded. |
| Sign-in used | Local development sign-in (`SATS_DEV_LOGIN`) with the employee ID. Portal password sign-in was not used. |
| Persistence | Templates and requests survived account changes and a browser refresh. |
| Scope limits | No company employee, group, administrator, or approver assignment was changed. Existing business templates and the pre-existing request `SATS-2026-000001` were not edited. |

### Test accounts

These IDs were read from the connected directory and role tables. They were not invented.

| Persona | Employee | ID | Primary group | Roles used |
|---|---|---|---|---|
| A — Requester | Sean Patrick Cabiso | 521 | Systems Group (16) | Employee |
| B — First approver | Tagumpay Cerdan Jr. | 498 | Systems Group (16) | Employee, Approver |
| C — Second approver | Evangeline Panado | 8 | Admin (2) | Employee, Approver |
| D — Administrator | Rhanzces Julia Herrera | 520 | Systems Group (16) | Employee, Admin. Not an approver. The only active administrator. |
| E — Other group | Arlene Derigay | 121 | Admin (2) | Employee |
| F — Third hierarchy step | Edmon Lazaro | 212 | Ship Group (22); also a secondary member of Systems | Employee, Approver |

A and B share Systems Group. E is Admin only. D is the sole active admin and was not deactivated.

### Demo records created

All names start with `DEMO TEST`. Nothing listed here is a pre-existing business record.

| Record | What it is now |
|---|---|
| Template 3, version 2 | `DEMO TEST - Website Access Request`. Systems Group. Hierarchy: 498, then 8. |
| Template 4, version 1 | `DEMO TEST - General Document Review`. Generic. Review / Checking. |
| Template 5, version 2 | `DEMO TEST - Dynamic Form Field Validation`. Generic. An optional “Internal note” field was added after request `SATS-2026-000010` so versioning could be checked. |
| Template 6, version 1 | `DEMO TEST - Three Step Hierarchy`. Systems Group. Steps: 498, 8, 212. |
| `SATS-2026-000002` | Approved hierarchy example. Revision 2. Best live “after” record. |
| `SATS-2026-000003` | Approved parallel review. |
| `SATS-2026-000004` | Rejected review. |
| `SATS-2026-000005` | Pending review, revision 2, after a return and resubmit. |
| `SATS-2026-000006` | Cancelled pending request. |
| `SATS-2026-000007` | Cancelled returned request. |
| `SATS-2026-000008` | Cancelled with an empty reason through the API. |
| `SATS-2026-000009` | Cancelled probe. The API stored the date text `November 20, 2026` without date validation. |
| `SATS-2026-000010` | Pending dynamic-form example. Still on the original 12 fields. |
| `SATS-2026-000011` | Pending attachment example, revision 3. Current file is `demo.pdf`. Older revisions still list the earlier files. |
| `SATS-2026-000012` | Three-step hierarchy check. Cancelled after the step statuses were confirmed, so it would not stay in the inbox. |

Tagumpay’s Action Inbox currently has **3** actionable assignments (`000005`, `000010`, and `000011`). Clear or complete those before Friday if the badge should show one prepared item.

## 3. Test Execution Summary

| Result | Count |
|---|---|
| Passed | 49 |
| Failed | 7 |
| Blocked | 0 |
| Not tested | 4 |
| **Total rows** | **60** |

The seven failures are the MySQL outage during a save, the cancellation reason being required on screen, the visible testing sign-in, the Waiting/Pending label mismatch, the sticky footer covering a long-form control, decimal yen being accepted, and the API accepting a non-date string. Details are in sections 5, 8, and 9.

## 4. Detailed Test Results

| Test ID | Module | Test Scenario | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|
| ENV-01 | Environment | Apache is running | API host accepts HTTP | Apache stayed up. API and the frontend both loaded. | PASS | HTTP 200 from the API and from port 5173. |
| ENV-02 | Environment | MySQL is accessible | SATS queries succeed | Queries succeeded before and after a crash. The server process died once and was restarted. | PASS | After restart, template and request reads returned data. |
| ENV-03 | Environment | PHP API responds | `http://localhost/sats/api` responds | HTTP 200 with the endpoint list. Authenticated calls returned JSON. | PASS | Sign-in, templates, and requests. |
| ENV-04 | Environment | React frontend loads | `http://localhost:5173/` opens SATS | The app shell, sidebar, and pages rendered. | PASS | Browser session. |
| ENV-05 | Environment | Development authentication | An employee ID signs in and the session sticks | Employees 521, 498, 8, 520, and 121 signed in. The cookie survived navigation and refresh. | PASS | `/dev/sign-in` HTTP 200 and the correct name in the sidebar. |
| ENV-06 | Environment | Portal password sign-in | A portal account can sign in without the testing box | Not executed. No portal password was used. | NOT TESTED | Development sign-in was used instead. |
| ENV-07 | Environment | Records survive refresh | A saved request is still there after reload | `SATS-2026-000002` still showed Approved, revision 2, and the same history after reload. | PASS | Browser reload of `/requests/2`. |
| ENV-08 | Environment | No critical failure during ordinary use | Saves and page loads do not 500 | One template save returned HTTP 500 because MySQL had stopped. Later operations succeeded. | FAIL | API error `SQLSTATE[HY000] [2002]` at the time of the crash. |
| ACCT-01 | Accounts | Personas match real employees | A and B share a group, C can be another group, D is Admin, E is a different group, F can be a third step | All six were found as listed in section 2. No role was changed. | PASS | Directory and `sats_role_assignments`. |
| TPL-01 | Templates | Create the group hierarchy template in the editor | Name, group, four fields, select options, and two ordered approvers are stored and the template activates | `DEMO TEST - Website Access Request` is active, version 2, group 16. Options are Temporary Access and Permanent Access. Steps are 498 then 8. | PASS | Editor session, then `GET /templates/3`. |
| TPL-02 | Templates | Group visibility | Group members see it. An Admin-only employee does not. | Sean and Tagumpay see it. Arlene’s New Request list does not. | PASS | Browser template list as employee 121, and `view=available` for 521 and 121. |
| TPL-03 | Templates | Generic review template | The template is shared, and the requester can pick more than one reviewer | Template 4 is generic. The New Request page required a group and an employee, rejected an unfinished row, and accepted Tagumpay plus Evangeline. | PASS | Browser submission of `SATS-2026-000003`. |
| TPL-04 | Templates | Dynamic template renders every field type | Text, textarea, number, three currencies, URL, date, select, radio, checkbox, and file all appear | All 12 original fields rendered with the configured options. | PASS | New Request after selecting template 5. |
| TPL-05 | Templates | Build and reorder every field type in the editor | Each type is added, configured, reordered, saved, and previewed from the editor | The Website template’s four fields were built, dragged, previewed, and activated in the editor. The 12-type template was saved through the same template API, not by adding each type in the editor. | NOT TESTED | Full editor pass for all 12 types was not repeated. |
| REQ-01 | Access | Menus match the signed-in person | Employee: New Request and My Requests. Approver: inbox and Group Templates. Admin: template, approver, and administrator menus, and no inbox from Admin alone. | 521 and 121 saw only the employee menus. 498 and 8 saw Action Inbox and Group Templates. 520 saw Template Management, Approver Configuration, and Administrators, and no Action Inbox. | PASS | Sidebar text for each account. |
| REQ-02 | Hierarchy | Submit Website Access | A number is issued, status is Pending, B is Pending, C is Waiting | `SATS-2026-000002` was created at 12:07 PM. URL `https://www.canva.com`, duration Permanent Access. Step 1 Pending, step 2 Waiting. | PASS | Request details and `GET /requests/2`. |
| REQ-03 | Hierarchy | Waiting approver cannot act | Approve, Reject, and Return are unavailable, the badge ignores the waiting item, and the server rejects a decision | As Evangeline, the buttons were disabled and the inbox badge had no count. `POST /decisions` returned HTTP 403, “This step is still waiting for an earlier approval.” The request stayed Pending. | PASS | Review page snapshot and the 403 response. |
| REQ-04 | Hierarchy | First approver returns the request | Status becomes Returned, the comment is kept, and the later step cannot continue | Tagumpay returned it at 12:10 PM with the requested justification comment. Activity recorded `request_returned`. A later approve attempt returned “This request is Returned and cannot be decided.” | PASS | Return dialog and `GET /requests/2`. |
| REQ-05 | Hierarchy | Resubmit without a change | The same answers are rejected | The edit page showed “Change at least one answer before resubmitting.” Revision stayed 1. | PASS | Edit page alert. The same rule exists on the server. |
| REQ-06 | Hierarchy | Change the purpose and resubmit | Same number, revision 2, B pending again, C waiting, old comment kept | Resubmit succeeded. Number stayed `SATS-2026-000002`. Revision 2. Steps were Pending then Waiting. Revision 1 still has the short Canva purpose and the return comment. | PASS | My Requests and `GET /requests/2`. |
| REQ-07 | Hierarchy | Both approvers approve | Final status is Approved and another decision is rejected | Tagumpay approved at 12:12 PM. Evangeline’s badge became 1 and her buttons enabled. Her approval finished the request. A further approve returned “This request is Approved and cannot be decided.” | PASS | Review dialogs, inbox, and the API. |
| REQ-08 | Review | Both reviewers must approve | Both start Pending. One approval leaves the request Pending. The second approval finishes it. | `SATS-2026-000003`. After Tagumpay approved, status was still Pending and Evangeline was Pending. Her approval made it Approved. | PASS | Browser approvals and `GET /requests/3`. |
| REQ-09 | Review | One reviewer rejects | Status becomes Rejected, the reason is kept, the other reviewer cannot decide, and the requester cannot resubmit | `SATS-2026-000004` is Rejected with the incomplete-information comment. Evangeline’s decision returned HTTP 400. Resubmit returned “cannot be resubmitted.” Her inbox no longer lists it. | PASS | Reject dialog and API checks. Her stored assignment status was still Pending even though the request is closed. |
| REQ-10 | Review | Return, revise, and resubmit | Reviewers stay the same, both become Pending again, and the old comment remains | `SATS-2026-000005`. The edit page locked the reviewer list and showed Tagumpay’s comment. After the description change, revision 2 is Pending for both reviewers. Revision 1 keeps the old description. | PASS | Edit page and `GET /requests/5`. |
| REQ-11 | Cancel | Owner cancels a pending request | Status becomes Cancelled and a decision is refused | `SATS-2026-000006` was cancelled in the dialog. A later approve returned “This request is Cancelled and cannot be decided.” | PASS | Cancel dialog and API. |
| REQ-12 | Cancel | Owner cancels a returned request | Returned requests can be cancelled | `SATS-2026-000007` showed Edit & Resubmit and Cancel Request. Cancellation completed and the list showed Cancelled. | PASS | Request details dialog. |
| REQ-13 | Cancel | Someone else cannot cancel | The server refuses | Tagumpay received HTTP 403, “Only the original requester can cancel this request.” | PASS | `POST /requests/6/cancel` as employee 498. |
| REQ-14 | Cancel | Cancellation reason is optional | The request can be cancelled with no reason | The dialog labels the reason required and keeps Confirm disabled until text is entered. The API accepts an empty reason and stores null. `SATS-2026-000008` was cancelled that way. | FAIL | `CancelRequestDialog.tsx` requires trimmed text. `RequestModel::cancel` stores null for an empty reason. |
| ATT-01 | Files | Save a PDF and a PNG | Both files are stored on the request | `SATS-2026-000011` stored `demo.pdf` (190 bytes) and `demo.png` (70 bytes). | PASS | Create response attachments. |
| ATT-02 | Files | Open the file from Request Details | The owner can view and download it | The details page opened a viewer for `demo.pdf`, “190 B · application/pdf”, with a Download button. The API returned the PDF bytes with `Content-Type: application/pdf`. The PNG download returned 70 bytes. | PASS | Viewer on `/requests/11` and authenticated download. |
| ATT-03 | Files | Hide files from an unrelated employee | Arlene cannot download the file | Employee 121 received HTTP 404, “Request not found.” The assigned reviewer, 498, received HTTP 200. | PASS | Download calls as 121 and 498. |
| ATT-04 | Files | Reject an unsupported type | `.exe` is refused | HTTP 400, “Files must be PDF, Word, Excel, PowerPoint, CSV, text, PNG, or JPEG.” | PASS | Multipart create. The browser file picker was not driven separately. |
| ATT-05 | Files | Reject a file over 20 MB | A 21 MB PDF is refused | HTTP 400, “Each file must be 20 MB or smaller.” PHP’s own limit is 40 MB, so the application rule produced the error. | PASS | Multipart upload of a 21 MB file. |
| ATT-06 | Files | Reject more than five files | The sixth file is refused | HTTP 400, “Supporting Document can have at most 5 files.” | PASS | Six `.txt` files in one field. |
| ATT-07 | Files | Change only attachments on resubmit | Adding, keeping, or removing files counts as a change, and older revisions keep their own files | Adding `demo.txt` while keeping the PDF and PNG created revision 2. Removing the PNG and text file and keeping the PDF created revision 3. Revision 1 still lists PDF and PNG. Revision 2 still lists PDF, PNG, and text. | PASS | `POST /requests/11/resubmit` and the details page. |
| VER-01 | Templates | Existing requests keep their original form | Editing the template does not change an older request, and a new form uses the new version | Template 5 moved from version 1 to version 2 with an optional Internal note. `SATS-2026-000010` still has the original 12 fields. New Request now shows Internal note. | PASS | `PUT /templates/5`, `GET /requests/10`, and the New Request page. |
| VER-02 | Templates | A stale save is rejected | Saving with an old version does not overwrite the newer one | Repeating the version-1 body returned HTTP 409, “This template was updated by someone else. Reload and try again.” | PASS | Second `PUT /templates/5`. |
| VER-03 | Workflows | Templates route independently | Hierarchy uses the configured people and order, including three steps | Template 3 uses 498 then 8. Template 6 produced Pending, Waiting, Waiting for 498, 8, and 212. Review templates let the requester choose the reviewers. | PASS | `SATS-2026-000012` before it was cancelled, plus the live hierarchy and review requests. |
| RBAC-01 | Access | A regular employee cannot open management | Direct visits to templates, inbox, and administrators leave the employee area | Employee 121 was returned to My Requests from `/templates` and from `/inbox`. The page showed “No requests yet.” | PASS | Browser navigation as 121. |
| RBAC-02 | Access | An approver manages only the primary group and cannot create a generic template | Group Templates lists Systems templates. A generic save is refused. | Tagumpay’s list showed 3 Systems templates and no generic templates. The new-template page said it is group-specific for Systems Group and that only Admin can create a generic template. `POST /templates` with a generic scope returned “Only an administrator can manage a generic template.” | PASS | `/templates` as 498 and the API response. |
| RBAC-03 | Access | Admin can open administration and does not receive inbox work just by being Admin | The three administration screens open, and Admin has no Action Inbox | Template Management showed 6 templates. Approver Configuration showed 65 approvers. Administrators showed one row, employee 520. The sidebar had no Action Inbox. | PASS | Screenshots in `docs/presentation-test-evidence/`. |
| RBAC-04 | Access | The last administrator cannot be removed | The deactivate action is refused | Not clicked. Employee 520 is the only active administrator. The server code throws “The last administrator cannot be removed.” | NOT TESTED | Unsafe to click. See `RoleModel::saveAssignment`. |
| RBAC-05 | Access | Add or deactivate a live approver assignment | The screen can change an assignment and the directory stays intact | Not executed. | NOT TESTED | Avoided so live approver records would not change. |
| UI-01 | UI | The entry screen looks finished for judges | No testing-only control is shown | The signed-out page shows “Testing only”, an Employee ID box, and “Sign in for testing”. The open account menu says “Testing only”. | FAIL | `docs/presentation-test-evidence/sats-signed-out.png`. |
| UI-02 | UI | The main demonstration screens are consistent | Request, inbox, template, approver, and administrator pages share one layout and readable status labels | The pages use the same sidebar, type, spacing, and green Active/Approved treatment. Empty states are readable. | PASS | Screenshots of template management, approvers, administrators, and the approved request. |
| UI-03 | UI | Waiting and Pending mean the same thing in both places | The details page uses the same waiting language as the inbox | The inbox says “Waiting — not your turn yet”. Request Details labels that same step “Pending”, and the current step “In progress”. | FAIL | Evangeline’s inbox versus `/requests/2/review` before the first approval. |
| UI-04 | UI | A long form can be completed without a control being covered | Category and reviewer controls can be clicked | The Request Category control sat under the sticky footer. The click was intercepted until the control was scrolled to the center of the page. | FAIL | Browser click error on the dynamic form. |
| FLD-01 | Fields | Text | Required text is enforced and the value is saved | Empty title showed “Request Title is required.” “Department Equipment Request” was saved and shown. | PASS | Dynamic form and `SATS-2026-000010`. |
| FLD-02 | Fields | Textarea | Required text is enforced and the value is saved | Empty description was rejected. The equipment sentence was saved and shown in the details. | PASS | Same request. |
| FLD-03 | Fields | Number | Letters are rejected and a whole number is saved | “abc” did not remain in the number control. Quantity 3 was saved and displayed as 3. The API rejects a non-numeric quantity with “Quantity must be a number.” | PASS | Browser field and API probe. |
| FLD-04 | Fields | PHP currency | A peso amount is saved and shown with two decimals | 5000 was stored as 5000 and displayed as `₱5,000.00`. | PASS | Request details. |
| FLD-05 | Fields | USD currency | A decimal dollar amount keeps two displayed decimals | 100.50 was stored as 100.5 and displayed as `$100.50`. | PASS | Request details. |
| FLD-06 | Fields | JPY currency | Yen is shown with no decimals, and a fractional yen is not accepted as a normal value | 15000 was stored and displayed as `￥15,000`. The form also accepted 15000.5 with no error. The yen input uses `step="1"`, but the submit validation does not reject a fraction. | FAIL | Browser value 15000.5 produced no alert. Display formatting itself is correct for a whole number. |
| FLD-07 | Fields | URL | A bad URL is rejected and a valid URL is saved as a link | “not-a-url” produced “Enter a valid URL starting with http:// or https://.” `https://example.com` was saved and rendered as a link. The API returns the same message. | PASS | Dynamic form and API probe. |
| FLD-08 | Fields | Date | The date control accepts a real date and the details page formats it | `2026-11-20` displayed as Nov 20, 2026. The API also accepted the prose string “November 20, 2026” and stored it unchanged on `SATS-2026-000009`, which was then cancelled. | FAIL | UI date control is fine. Server-side date format is not checked. |
| FLD-09 | Fields | Select | Options match the template and a missing choice is rejected | Equipment, Software, Supplies, and Other appeared. Empty submit said “Request Category is required.” Equipment was saved and displayed as Equipment. An unknown API value was rejected. | PASS | Browser list and API probe. |
| FLD-10 | Fields | Radio | A missing choice is rejected and the selected label is saved | Empty submit said “Priority Level is required.” High was saved and displayed as High. | PASS | Dynamic form. |
| FLD-11 | Fields | Checkbox | A required checkbox must be checked | Empty submit said “Confirmation must be checked.” Checked confirmation was stored as true and displayed as Yes. The API returns the same message when false. | PASS | Browser alert and API probe. |
| FLD-12 | Fields | File | The field is optional, states the 5-file and 20 MB rule, and enforces those rules | The form shows “Up to 5 files, 20 MB each.” An empty file field submitted successfully. Unsupported, oversized, and six-file uploads were rejected by the API. | PASS | Dynamic form and attachment tests. |
| SIM-01 | Demo | Hierarchy story from submit through final approval | The presenter can switch accounts and reach Approved without a broken step | The browser sequence completed: 521 submitted, 498 returned, 521 resubmitted, 498 approved, 8 approved. The same request number and history remained available. Elapsed time on the clock was 12:07 PM to 12:12 PM. | PASS | `SATS-2026-000002` and `sats-approved-request.png`. |

## 5. Dynamic Form Fields Assessment

Template 5 was submitted in the browser as `SATS-2026-000010`. Required-field messages appeared together on an empty submit. The saved request was reloaded from MySQL and the details page formatted the values below.

| Field | Result |
|---|---|
| Text | Works. Required when empty. Saved title is the request heading. |
| Textarea | Works. Required when empty. The full sentence is shown, with “Read more” when the details layout truncates it. |
| Number | Works. The browser number control does not keep letters. The API rejects a non-numeric value. |
| PHP currency | Works. Symbol `₱`, locale grouping, two decimals: `₱5,000.00`. |
| USD currency | Works. `$100.50` even though the stored JSON number is `100.5`. |
| JPY currency | Display works for a whole number: `￥15,000`. A fractional value is not rejected. Do not type a decimal during the demo. |
| URL | Works. The scheme is required. The saved value is a link. |
| Date | The on-screen control is a date input and the details page shows “Nov 20, 2026”. The API does not check that the value is a date. |
| Select | Works. The four category labels were saved with the template and displayed by label, not by the stored value `equipment`. |
| Radio | Works. Low, Medium, and High render, and High was stored and labeled correctly. |
| Checkbox | Works. Required means it must be checked. The details page shows Yes. |
| File | The empty optional field is valid. Limits are visible on the form and enforced by the API. Adding a file through the browser picker was not repeated on this form; the attachment tests covered the upload API and the details viewer. |

The editor was not used to add all 12 types one at a time in this run. The Website template’s URL, textarea, select, and file fields were built in the editor, including a drag reorder that was then put back into the intended order.

## 6. Approval Workflow Assessment

**Hierarchy Approval works and follows the people configured on the template.** Job title was not used to choose the route. Tagumpay is Senior Software Supervisor and Evangeline is Department Manager, and they acted in the template order 498 then 8. The three-step template routed 498 Pending, 8 Waiting, and 212 Waiting.

Return sends the request back to the owner, keeps the comment, and stops the next step. Resubmit without an answer or attachment change is rejected. A real edit keeps the request number, increments the revision, restarts the sequence, and preserves the earlier revision. Final approval closes the request. Another decision is rejected.

**Review / Checking works in parallel.** Both selected reviewers were Pending immediately. One approval left the request Pending. The second approval closed it. One rejection closed it, left the reason on the request, removed it from the other reviewer’s inbox, and blocked resubmit. One return let the owner edit, kept the same reviewers, and restarted both of them as Pending.

**Cancellation works for Pending and Returned requests, and only for the owner.** The on-screen reason is required. The API reason is optional. That is a product mismatch, not a broken cancel action.

**Revision history works.** The approved Website request still shows revision 1’s short purpose and Tagumpay’s return comment beside revision 2. The attachment request’s revision 2 still lists the files that revision 3 removed.

## 7. Template Management Assessment

Creating and activating a group template in the editor worked. Preview matched the fields and the two approvers. Select options survived a second save after an earlier save had briefly stored placeholder option labels; the active template now has the correct Temporary Access and Permanent Access labels.

Generic and group scope both work. Availability uses the employee’s primary group. Arlene does not see Systems templates. Tagumpay can manage Systems templates and cannot save a generic template. The administrator can open generic and group templates, Approver Configuration, and Administrators.

Versioning works. Request `SATS-2026-000010` kept the 12-field snapshot after template 5 became version 2. A new form shows the added Internal note. A save that still carries version 1 is rejected with a reload message.

Two editor behaviors are awkward for a live tour:

- A new, unsaved template already shows an Active badge.
- “Back to Templates” asks before discarding edits. Choosing My Requests in the sidebar does not. That discarded an in-progress edit earlier in this test.

Deactivating the last administrator and changing live approver rows were not clicked.

## 8. UI/UX Assessment

The signed-in product looks consistent enough to put on a projector. The sidebar, page title, cards, green status pills, and confirmation dialogs match across My Requests, Request Details, the review page, Template Management, Approver Configuration, and Administrators. Empty states are plain and useful: “No requests yet” and “This group has no designated approvers.”

Screenshots saved with this report:

- `docs/presentation-test-evidence/sats-approved-request.png` — the completed hierarchy, revision 1, and the activity timeline.
- `docs/presentation-test-evidence/sats-template-management.png` — six templates, including the demo set.
- `docs/presentation-test-evidence/sats-approver-configuration.png` — group list and empty state.
- `docs/presentation-test-evidence/sats-administrators.png` — the single administrator.
- `docs/presentation-test-evidence/sats-signed-out.png` — the testing sign-in.

Issues that can show during the presentation:

1. The signed-out card advertises a testing sign-in. The account menu repeats “Testing only”.
2. Request Details calls a future hierarchy step “Pending” and the current step “In progress”. The inbox is more precise. A judge can ask why Evangeline is Pending and still unable to click Approve.
3. On the long dynamic form, the bottom bar covered Request Category. The presenter should scroll that control to the middle of the screen before opening it.
4. Reviewer groups are listed as ACT, ADM, SYS, and similar codes while the closed control shows the full group name.
5. The employee picker includes secondary group members and duplicate directory names, such as two Agusto Claudio rows in Admin.
6. Template row actions are icons. They have accessible names, but they are easier to miss than a text button.
7. The cancel question renders as “cancel SATS-2026-000006 ?” with a space before the question mark.
8. A new template is labeled Active before it has been activated.
9. Leaving the editor through the sidebar does not warn about unsaved work.

The approved-request screen itself is the strongest visual in the product. It shows the number, the green Approved pill, both approvers, the old and new purpose, and the timeline without looking unfinished.

## 9. Bugs and Issues Found

### ISS-01 — MySQL stopped during a template save

- **Affected module:** Environment / API
- **Steps:** Edit and save a template while MariaDB is in the state observed on this machine. In this run the server process exited around 12:01 PM. The error log had previously recorded InnoDB “log sequence number is in the future” at startup.
- **Expected:** The save succeeds or the application shows a recoverable error and the database stays up.
- **Actual:** `POST` returned HTTP 500, `SQLSTATE[HY000] [2002]`. The process was gone. Restarting `mysqld` restored service. No records were reset.
- **Severity:** P0 — Presentation blocker if it happens again on Friday
- **Recommended fix:** Before Friday, restart MySQL once, submit and approve a throwaway request, and confirm the process is still running. Keep the XAMPP MySQL start command available. Do not delete InnoDB logs. This is an environment fault, not a SATS form defect.
- **Evidence:** API 500 during the option save; later `GET /templates/3` succeeded only after the restart.

### ISS-02 — Testing sign-in is part of the entry screen

- **Affected module:** Sign-in / account menu
- **Steps:** Open `http://localhost:5173/` while signed out, or open the account menu while signed in.
- **Expected:** Judges see a normal portal sign-in, or the testing control is not visible.
- **Actual:** The card shows “Testing only”, Employee ID, and “Sign in for testing”. The account menu says “Testing only”.
- **Severity:** P1 — Important
- **Recommended fix:** For the presentation, either sign in through the portal button or explain the employee-ID box in one sentence and do not linger on it. Hiding it is a small code change and was not made in this test.
- **Evidence:** `sats-signed-out.png`.

### ISS-03 — Waiting step is labeled Pending

- **Affected module:** Request Details / Review
- **Steps:** Open a two-step hierarchy before the first approver acts. Compare the inbox with the approval progress.
- **Expected:** The second person is clearly Waiting, matching the inbox.
- **Actual:** Inbox: “Waiting — not your turn yet”, and the badge does not count it. Progress panel: “Pending”. The acting step says “In progress”.
- **Severity:** P1 — Important
- **Recommended fix:** Use Waiting on the progress panel for a step that has not opened. Practice the sentence: “Evangeline can see it, and the buttons stay disabled until Tagumpay finishes.”
- **Evidence:** Review page for employee 8 before the first approval. The buttons were disabled.

### ISS-04 — Sticky footer covers controls on a long form

- **Affected module:** New Request
- **Steps:** Open the dynamic template and try to open Request Category without scrolling it up.
- **Expected:** The dropdown opens.
- **Actual:** The click was intercepted by the bottom bar. Scrolling the control to the center allowed it to open.
- **Severity:** P1 — Important
- **Recommended fix:** Scroll the category and reviewer rows into view before opening them. A later layout change can add space under the last field.
- **Evidence:** Browser click intercepted at the bottom of `/requests/new`.

### ISS-05 — Cancellation reason is required on screen and optional in the API

- **Affected module:** Cancel request
- **Steps:** Open Cancel Request and leave the reason blank. Then send an empty reason to the API as the owner.
- **Expected:** The requested behavior is an optional reason.
- **Actual:** Confirm stays disabled until the reason has text, and the label has a red asterisk. `POST /cancel` with an empty reason cancelled `SATS-2026-000008`.
- **Severity:** P2 — Minor
- **Recommended fix:** Leave the dialog as it is for Friday. A required reason is easy to explain and is safer in a demo. Align the API later if an empty reason should stay allowed.
- **Evidence:** Disabled Confirm button on `SATS-2026-000006` and the empty-reason API cancel.

### ISS-06 — Fractional yen is accepted

- **Affected module:** Dynamic form, JPY currency
- **Steps:** Enter `15000.5` in Estimated Cost (JPY) and submit the other required fields.
- **Expected:** A yen field with zero fraction digits rejects or rounds the fraction before save.
- **Actual:** No validation message. A whole number displays correctly as `￥15,000`.
- **Severity:** P2 — Minor
- **Recommended fix:** Use a whole number in the demo. Add a fraction check later.
- **Evidence:** The dynamic form kept `15000.5` and did not show an alert.

### ISS-07 — The API does not validate date format

- **Affected module:** Request API, date fields
- **Steps:** Submit a date field with the text “November 20, 2026” through the API.
- **Expected:** The value is a date, as in the browser date control.
- **Actual:** The request was created and the string was stored. The on-screen control itself only accepts a date.
- **Severity:** P2 — Minor
- **Recommended fix:** No demo change. The browser control is sufficient for Friday. Validate the format on the server later.
- **Evidence:** `SATS-2026-000009`, cancelled after the probe.

### ISS-08 — New templates look Active before activation

- **Affected module:** Template editor
- **Steps:** Open New Template as an approver or administrator.
- **Expected:** The badge reflects that the template is not active yet.
- **Actual:** The header shows Active on a blank unsaved template.
- **Severity:** P2 — Minor
- **Recommended fix:** Do not open a blank template during the presentation. Show the existing active templates.
- **Evidence:** New Template page as employee 498.

### ISS-09 — Sidebar navigation discards editor changes without a warning

- **Affected module:** Template editor
- **Steps:** Change a draft and click My Requests. Separately, click Back to Templates.
- **Expected:** Both exits warn.
- **Actual:** Back to Templates asks, “You have unsaved changes. Leave this page and discard them?” The sidebar does not. An option-label edit was lost this way.
- **Severity:** P2 — Minor
- **Recommended fix:** Use Back to Templates during the demo. Extend the warning later.
- **Evidence:** Draft loss during the Website template edit, and the confirm text on Back to Templates.

### ISS-10 — Group codes and duplicate directory names in the reviewer picker

- **Affected module:** Reviewer selection
- **Steps:** Open the group list, then open Admin employees.
- **Expected:** Full group names and one row per person.
- **Actual:** The open list shows ADM, SYS, and the other short codes. Admin lists two Agusto Claudio rows. Secondary members of a group also appear.
- **Severity:** P3 — Future
- **Recommended fix:** Search for “Tagumpay” and “Evangeline” instead of scrolling the full list.
- **Evidence:** Reviewer picker on the General Document Review form.

### ISS-11 — A rejected review can still show the other reviewer as Pending

- **Affected module:** Review progress
- **Steps:** Reject a two-reviewer request as the first reviewer and read the stored assignments.
- **Expected:** The other reviewer is closed, not still Pending.
- **Actual:** The request is Rejected, the other person cannot decide, and the inbox no longer shows it. The stored assignment status for Evangeline remained Pending.
- **Severity:** P3 — Future
- **Recommended fix:** No demo impact if the rejected request is opened from My Requests and the status pill is what is discussed.
- **Evidence:** `GET /requests/4` after the rejection.

## 10. Presentation Simulation Result

The Friday story was executed in the browser rather than as a second uninterrupted rehearsal.

1. Sean Patrick Cabiso signed in and submitted Website Access at 12:07 PM. The number was `SATS-2026-000002`.
2. Evangeline could see it and could not act.
3. Tagumpay returned it at 12:10 PM with the business-justification comment.
4. Sean’s unchanged resubmit was rejected. The revised purpose resubmitted as revision 2.
5. Tagumpay approved at 12:12 PM. Evangeline then approved. The request is Approved.
6. Refreshing the details page kept the number, both decisions, revision 1, and the timeline.
7. A separate parallel review, `SATS-2026-000003`, was submitted in the browser and approved by both reviewers.
8. The administrator screens opened without an inbox.

Account switching through the development sign-in was reliable. Requests remained available after each switch. The hierarchy story is easy to narrate from My Requests, the review page, and the final details page. The awkward parts are the testing sign-in, the Pending label on a waiting step, and the extra demo requests now sitting in Tagumpay’s inbox.

**Show live**

- Sign in as Sean, open the prepared Approved request, and walk the timeline. Or submit one fresh Website Access request if the inbox has been reduced to that item.
- Switch to Tagumpay, return or approve that one request.
- Switch to Evangeline only after Tagumpay has approved, then approve.
- As the administrator, show Template Management and the field list. Do not edit a template that already has the demo request unless the versioning point is intentional.

**Use prepared data**

- `SATS-2026-000002` for the finished hierarchy, revision history, and return comment.
- `SATS-2026-000003` for parallel approval.
- `SATS-2026-000004` for rejection.
- `SATS-2026-000010` for currency, date, select, radio, and checkbox display.
- `SATS-2026-000011` only if attachments are mentioned. It is revision 3 and can distract.

Do not live-demo the 21 MB upload, six-file rejection, last-admin protection, or a template edit on the Website template.

## 11. Recommended Tasks Before Friday

1. Confirm MySQL stays running through a full submit, return, resubmit, and two approvals. If it exits again, fix the database startup before changing SATS.
2. Decide the sign-in story. Use the portal button, or say that the employee-ID box is a local demonstration aid and then move on.
3. Clear Tagumpay’s inbox down to the one request that will be acted on live. The badge currently shows 3 because of `000005`, `000010`, and `000011`.
4. Rehearse the waiting-step sentence so the Pending label does not become a question.
5. If the dynamic form is shown, scroll the category and reviewer controls into view, use whole yen, and use the date picker.
6. Practice account switches in the order Sean, Tagumpay, Evangeline, then the administrator.
7. Leave the last administrator and the live approver list unchanged.
8. Optional, only if there is time to change code: label waiting steps as Waiting, hide the testing sign-in for the presentation build, and keep the footer from covering the last form controls.

## 12. Features That Can Be Deferred

- Portal password login, if the development sign-in is an accepted demonstration method.
- Hiding or redesigning the testing sign-in.
- Making the cancellation reason optional on screen.
- Rejecting fractional yen and non-date strings on the server.
- Warning on every exit from the template editor.
- Changing the premature Active badge.
- Showing full group names instead of codes in the open list.
- Closing the other reviewer’s assignment status after a rejection.
- Deactivate-last-admin as a live click. The guard can be described without clicking it.
- Adding or removing approvers during the presentation.
- A three-step live approval. The configuration was verified and the request was cancelled.
- Attachment stress cases: oversized files, six files, and unsupported types.
- Dragging every field type again in the editor.

## 13. Final Verdict

**Is SATS ready for the Friday, November 13, 2026 Kaizen presentation?**

**READY WITH MINOR ISSUES**

The major demonstration works on the real frontend, API, and database. A group hierarchy template routed to the configured employees, survived return and resubmit, and finished Approved. A generic review template supported two simultaneous reviewers, rejection, return, and cancellation. The dynamic form saved and redisplayed text, textarea, number, peso, dollar, yen, URL, date, select, radio, and checkbox values. Template versions did not rewrite an existing request. Role menus matched employee, approver, and administrator.

The issues that remain are real, and the MySQL outage is the one that can stop the room. It happened once, the service was restored, and the rest of the workflow completed. The testing sign-in, the Waiting/Pending wording, and the covered dropdown are visible, but they do not prevent a rehearsed demonstration. No application code was changed during this test.
