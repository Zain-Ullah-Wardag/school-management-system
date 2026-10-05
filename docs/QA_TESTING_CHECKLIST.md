# School ERP Master QA and User-Acceptance Test Script

Use this document to test one release from installation through daily school workflows. Run the phases in order because later tests use records created earlier.

## Result rules

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` in each Result cell.

- A test passes only when the complete expected result occurs without reloading or navigating away, unless the test explicitly requires a restart.
- For every failure, record its test ID, screenshot, exact steps, expected result, and actual result in the defect log.
- Do not fix issues during the run. Record all failures first, then fix them together.
- Use only test contact details and approved test messaging accounts. A real provider can charge for SMS.

## Data-safety rules

1. Test `artifacts\win-unpacked\School ERP.exe` first. Test the installer after the unpacked build passes.
2. Create and download a backup before restore, reset, promotion, or new-academic-year tests.
3. Never run destructive tests against the only copy of real school data.
4. Use a disposable database or clean Windows profile for initialization and reset tests.
5. Close all old School ERP processes before starting, so an older build cannot display stale data from another local API.

## Test-run record

| Field | Value |
| --- | --- |
| Tester |  |
| Date/time |  |
| Git branch and commit |  |
| App version |  |
| Windows version |  |
| Node/npm versions |  |
| Build | `win-unpacked` / installed NSIS |
| Database | Existing test / fresh demo / disposable |
| Overall result | PASS / FAIL / BLOCKED |

## Phase 0 — Automated preflight and build

From `D:\School-ERP\school-management-system`, run this exact order:

```bat
node -v
npm -v
git status
npm ci
npm run typecheck
npm run lint
npm run test:auth
npm run test:demo
npm run test:reset
npm run test:audit
npm run test:sync
npm run test:localization
npm test
npm run build
npm run package:win
```

Expected: Node 20.x, npm 10.x, and every command exits successfully. Record audit/deprecation warnings separately; they do not alone fail functional testing.

> `package:win` rebuilds native dependencies for Electron. Run Node tests before it. If a later Node test reports `NODE_MODULE_VERSION 130` versus `115`, run `npm rebuild better-sqlite3 bcrypt @serialport/bindings-cpp` before Node tests, then run `npm run package:win` again before desktop testing.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| PRE-01 | Check versions and `git status`. | Node/npm match requirements; only intended source/icon changes appear. |  |
| PRE-02 | Run all automated commands above. | Every command succeeds. |  |
| PRE-03 | Build Windows package. | Unpacked app and `School ERP Setup 1.0.0.exe` exist. |  |
| PRE-04 | Review builder output. | Custom icon is used; no fatal native-module or `rcedit` failure. |  |

## Phase 1 — Desktop installation, startup, and persistence

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| DESK-01 | Open the unpacked executable. | One window opens, local API becomes ready, and Login appears without a remaining command window. |  |
| DESK-02 | Inspect title bar, taskbar, executable, and installer. | Custom icon is clear, centered, recognizable, and not cropped. |  |
| DESK-03 | Sign in, visit pages, close normally, and reopen. | No API timeout; data remains. |  |
| DESK-04 | Start while port 3398 is occupied by a harmless local process/old test build. | App selects an available API port and shows its own data. |  |
| DESK-05 | Open the executable twice quickly. | No database corruption, mixed session, or blank window. |  |
| DESK-06 | Install with NSIS; launch from installer, Start menu, and shortcut. | Install and each launch succeed with correct name/icon. |  |
| DESK-07 | Uninstall the test copy after backup. | Only app files are removed; unrelated files remain. Record app-data retention behavior. |  |
| DESK-08 | Disconnect internet and open app. | Core local features work; only external links/providers may be unavailable. |  |

## Phase 2 — Fresh demo initialization

Run only on a disposable fresh database. Sign in with `admin` / `admin123`, then select **Initialize Demo School** once.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| SEED-01 | Initialize once. | Success appears; Dashboard updates without reload. |  |
| SEED-02 | Try initialization again. | Duplicate demo data is not created. |  |
| SEED-03 | Check academic data. | Current session, 12 classes, A/B sections, 11 subjects, and rooms exist. |  |
| SEED-04 | Check people data. | 15 staff and 24 active students exist. |  |
| SEED-05 | Check operational data. | Attendance, 24 invoices, exams/results, timetable, visitors, and messaging logs exist. |  |

| Demo account | Password | Workflow |
| --- | --- | --- |
| `admin` | `admin123` | Full administration |
| `teacher01` | `Demo123!` | Teacher workspace, attendance, marks |
| `accountant` | `Demo123!` | Fees, finance, reports |
| `reception` | `Demo123!` | Admissions, visitors, collection |

## Phase 3 — Authentication and role access

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| AUTH-01 | Submit empty fields, then each field empty separately. | Required-field messages appear. |  |
| AUTH-02 | Use invalid credentials. | Safe error appears without technical/database details. |  |
| AUTH-03 | Sign in as admin, sign out, then use Back or protected URL. | Protected content stays hidden; Login appears. |  |
| AUTH-04 | Change password; try old then new password. | Old fails; new succeeds. |  |
| AUTH-05 | Try an inactive/deactivated user. | Login is denied. |  |
| AUTH-06 | Enter an unauthorized URL as a limited user. | Navigation/action/data are denied, not only hidden. |  |

### Role matrix

| Role | Must access | Must not manage unless granted |
| --- | --- | --- |
| Administrator/Principal | Leadership Dashboard and all assigned modules | Nothing outside assigned permissions |
| Accountant | Invoices, receipts, finance, reports, allowed messaging | Academic/staff/users/settings |
| Receptionist | Students, visitors, collection, certificates, messaging | Roles/settings, exam approval |
| Class teacher | Students, attendance, results, allowed fee status/messaging | Finance/settings/users |
| Subject teacher | Timetable, attendance, assessments, messaging | Finance/settings/users |
| Staff | Personal workspace and own attendance | School operational/administrative data |

## Phase 4 — Shell, search, language, and loading states

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| UI-01 | Open every sidebar page; use Back/Forward. | Correct page/sidebar state; no blank page or 404. |  |
| UI-02 | Collapse sidebar and resize window. | Navigation remains usable; content does not overlap. |  |
| UI-03 | Use global search on Students, Staff, Fees, Attendance, Academic. | Current page filters immediately; clearing restores rows. |  |
| UI-04 | Enter a long search. | Query remains readable/editable; layout holds. |  |
| UI-05 | Switch English → Urdu on every major page, table, modal, toast, and empty state. | Text/direction switch; controls work. |  |
| UI-06 | In Urdu, save attendance, collect payment, and edit a record. | Live values/statuses update and are not replaced by old translated text. |  |
| UI-07 | Switch Urdu → English without navigation. | Current data stays correct; English labels return. |  |
| UI-08 | Save data and inspect list/detail/summary on the current page. | All visible state updates without reload/navigation. |  |
| UI-09 | Trigger validation/API error. | Friendly error appears once; UI recovers; no permanent loader. |  |
| UI-10 | Search for no results. | Intentional empty state appears, not stuck loading or false statistics. |  |

## Phase 5 — Academic setup

Use prefix `QA-<date>` for temporary records.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| ACD-01 | Check Classes, Sections, Subjects, Subject allocation, Sessions, Rooms; test filters. | Records/counts and filters are correct. |  |
| ACD-02 | Create/edit/inactivate `QA Class`, including Urdu name. | Row updates immediately and persists after restart. |  |
| ACD-03 | Create `QA-A` section with capacity, class teacher, location. | Appears under correct class; edits persist. |  |
| ACD-04 | Create `QA Science` max 100/pass 40; try pass > max. | Valid saves; invalid is rejected. |  |
| ACD-05 | Allocate subject to QA class/section with teacher and periods/week. | Allocation appears in timetable/assessments. |  |
| ACD-06 | Create `QA-101` room. | Room becomes selectable in timetable. |  |
| ACD-07 | Create planned session; try end date before start. | Valid saves; invalid range is rejected. |  |
| ACD-08 | Make a session current. | Only intended session is current; dependent pages use it. |  |
| ACD-09 | Try duplicate identifiers. | Duplicate data is rejected clearly. |  |
| ACD-10 | Delete unused QA record, then one with history. | Unused deletes; historical record is protected with explanation. |  |
| ACD-11 | Create/edit exam type in Preferences. | It appears in assessment forms and persists. |  |

## Phase 6 — Students

Create `QA Student One` with non-sensitive test contact data.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| STU-01 | Filter/search by class, section, status, name, admission, roll, guardian. | Correct rows and reset behavior. |  |
| STU-02 | Open existing profile directly. | Identity, enrollment, guardian, documents, attendance, academic data load; no `Loading…` remains. |  |
| STU-03 | Register QA student with photo, guardian, enrollment. | Identifiers generate; row appears immediately. |  |
| STU-04 | Try missing fields, duplicates, invalid email/phone/date/class-section. | Invalid submission is blocked with field feedback. |  |
| STU-05 | Edit name/contact/class. | List, profile, search, certificates, and selectors update immediately. |  |
| STU-06 | Upload, view/download, replace, delete document; try invalid/oversized file. | Valid works; invalid fails safely; no broken link. |  |
| STU-07 | Print ID card, Bonafide, Enrollment certificate. | Correct student/school/logo/layout; Save PDF available. |  |
| STU-08 | Mark attendance, then go directly to profile. | Percentage, current status, totals, history update; no loader. |  |
| STU-09 | Publish assessment, then open profile. | Academic history updates without reload. |  |
| STU-10 | Manually promote QA student. | Enrollment/header/list update; history remains. |  |
| STU-11 | Preview auto-promotion on disposable data, then cancel. | Eligibility/targets correct; cancel makes no changes. |  |
| STU-12 | Archive, find in Archived, then restore. | Moves between views immediately. |  |
| STU-13 | Open nonexistent student URL. | Friendly not-found state; app remains usable. |  |

## Phase 7 — Staff

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| STF-01 | Search/filter staff and open teacher profile. | Profile, assignments, salary, attendance, account load. |  |
| STF-02 | Add department/designation and `QA Staff One`. | Unique employee appears immediately. |  |
| STF-03 | Create/link login during staff creation. | Account signs in with expected workspace. |  |
| STF-04 | Edit details/photo/assignment. | List, selectors, workspace update immediately. |  |
| STF-05 | Add salary change. | Latest salary and history are correct. |  |
| STF-06 | Save staff attendance, then open profile/workspace. | Attendance updates immediately. |  |
| STF-07 | Archive QA staff. | Leaves active list/selectors; linked login has no unintended access. |  |
| STF-08 | Try duplicate employee/username and missing fields. | Rejected clearly. |  |

## Phase 8 — Timetable

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| TIME-01 | Select multiple class/sections. | Correct weekly entries/teachers/rooms/periods. |  |
| TIME-02 | Configure days; add/edit/delete period. | Grid/selectors update and persist. |  |
| TIME-03 | Add QA lesson with class, section, subject, teacher, room, day, period. | Correct cell and teacher workspace update. |  |
| TIME-04 | Edit then delete QA lesson. | Grid updates immediately. |  |
| TIME-05 | Create teacher, room, and class conflict. | Each is blocked with useful explanation. |  |
| TIME-06 | Try missing prerequisites/invalid time. | Rejected safely with setup guidance. |  |
| TIME-07 | Print. | Complete readable A4 landscape output. |  |

## Phase 9 — Attendance

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| ATT-01 | Select session/class/section/date. | Correct active roster loads once. |  |
| ATT-02 | Mix Present/Absent/Leave/Late and save. | Saved statuses remain without reload. |  |
| ATT-03 | Use All present/absent, correct individuals, save. | Bulk and individual changes persist. |  |
| ATT-04 | Immediately open a student's profile. | Attendance cards/history/counts are correct; no `Loading…`. |  |
| ATT-05 | Immediately open Dashboard. | Today's count/percentage is correct. |  |
| ATT-06 | Change same sheet again. | Profile, report, Dashboard show newest values. |  |
| ATT-07 | Lock as admin; try edit as teacher; unlock. | Teacher is blocked; admin can unlock. |  |
| ATT-08 | Open/print Daily report. | Totals equal saved statuses. |  |
| ATT-09 | Save staff attendance/time. | Profile/workspace updates immediately. |  |
| ATT-10 | Use Mark my check-in as linked employee. | Only own attendance is recorded once. |  |
| ATT-11 | Test empty class/future date/missing prerequisites. | Clear state; no false counts or permanent loading. |  |

## Phase 10 — Fees and finance

Use a billing month with no demo invoice.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| FEE-01 | Add/edit fee head; try duplicate/invalid. | Valid updates immediately; invalid rejected. |  |
| FEE-02 | Create/edit multi-head fee structure for QA class. | Total correct and available for invoicing. |  |
| FEE-03 | Generate monthly invoices twice for one test class/month. | One per eligible student; second run makes no duplicates. |  |
| FEE-04 | Create manual multi-item invoice. | Total, due date, balance, status correct. |  |
| FEE-05 | Search/filter invoices. | Paid/partial/unpaid/void results correct. |  |
| FEE-06 | Collect partial payment. | Receipt created; modal and outside row immediately show Partial/new balance. |  |
| FEE-07 | Pay exact remainder. | Modal and outside row immediately show Paid/balance 0 without closing or navigating. |  |
| FEE-08 | Try zero, negative, text, overpayment. | Blocked; totals unchanged. |  |
| FEE-09 | Print invoice/receipts. | Items, totals, method/reference, branding, date correct. |  |
| FEE-10 | Reopen invoice and restart app. | Payment history/Paid status persist. |  |
| FEE-11 | Void disposable unpaid invoice; try payment. | Void updates immediately; payment blocked. |  |
| FEE-12 | Add/edit/delete income and expense/category. | Tables/monthly summary update; calculations correct. |  |
| FEE-13 | Compare report/Dashboard after financial changes. | Collection, pending, income, expense, net agree immediately. |  |
| FEE-14 | Configure reminder schedule/template. | Saves and persists after restart. |  |
| FEE-15 | Send reminder now with disabled provider. | Only unpaid recipients queue/log; no paid-student reminder/duplicate. |  |

## Phase 11 — Tests, exams, results

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| EXM-01 | Create class test with max/pass/date. | Appears immediately; correct roster. |  |
| EXM-02 | Enter marks including 0 and absence; save draft. | Zero remains numeric; absence distinct; totals correct. |  |
| EXM-03 | Try negative, over-max, text, missing marks. | Invalid input rejected. |  |
| EXM-04 | Publish test. | Student history/result card updates immediately. |  |
| EXM-05 | Create term exam, subjects, dates, marks. | Setup/rosters correct. |  |
| EXM-06 | Test Draft → Submitted → Approved → Published using proper roles. | Only authorized transitions succeed; status updates immediately. |  |
| EXM-07 | Try incomplete publish/unauthorized approval. | Blocked clearly. |  |
| EXM-08 | Open Results & award lists. | Totals, %, grade, pass/fail, position, attendance correct. |  |
| EXM-09 | Manually verify one result with configured weights and pass %. | UI equals manual calculation; zero-mark failure logic correct. |  |
| EXM-10 | Print result card, award list, blank list. | Complete branded output, no clipping. |  |
| EXM-11 | Change weights/pass % in disposable data. | Recalculation follows saved settings consistently. |  |

## Phase 12 — Visitors

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| VIS-01 | Register visitor with contact, purpose, person, entry. | Appears immediately as checked in with correct time. |  |
| VIS-02 | Try missing/invalid input. | Not created; clear validation. |  |
| VIS-03 | Search/filter history. | Correct current/history rows. |  |
| VIS-04 | Check visitor out. | Time/status update immediately; no duplicate checkout. |  |
| VIS-05 | Test receptionist vs unauthorized role. | Only permitted role creates/checks out/sees protected details. |  |

## Phase 13 — SMS, providers, WhatsApp

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| MSG-01 | Open Messaging Providers/configurations. | Provider types load without blocking offline use. |  |
| MSG-02 | Create/edit disabled test configuration; validate. | Required fields checked; secrets not exposed. |  |
| MSG-03 | If approved test provider exists, use Test; otherwise keep disabled. | Clear result; no accidental bulk send. |  |
| MSG-04 | For GSM test: list ports, connect/info/disconnect; test no-device state. | State accurate; missing modem fails safely. |  |
| MSG-05 | Add/edit/delete temporary template/placeholders. | Updates immediately; old logs retained. |  |
| MSG-06 | Send one message through disabled provider. | Queued/failed safely; one log created. |  |
| MSG-07 | Send group/unpaid-fee message after recipient preview. | Only intended recipients; one click does not duplicate. |  |
| MSG-08 | Filter/inspect Delivery Log. | Recipient/body/provider/status match attempts. |  |
| MSG-09 | Retry queued/failed test. | Attempt/status updates without confusing duplicate. |  |
| MSG-10 | Open WhatsApp from profile, edit message, continue/cancel. | Correct normalized number/message; cancel returns safely. |  |

## Phase 14 — Reports and printing

Compare at least three rows and every total to its source module.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| RPT-01 | Student list: filter, print, Excel export. | Counts/data match Students; file opens. |  |
| RPT-02 | Attendance daily/monthly/history. | Totals match attendance/profile. |  |
| RPT-03 | Fees & dues: filter, print, export. | Status/balances/collections match Fees. |  |
| RPT-04 | Income & expenses. | Income/expense/net match Finance/Dashboard. |  |
| RPT-05 | Award and blank award lists. | Published ranks/subjects correct. |  |
| RPT-06 | Timetable report. | Matches selected class/section grid. |  |
| RPT-07 | Certificates, ID, result card, invoice, receipt. | Correct branding/logo/placeholders/dates/layout. |  |
| RPT-08 | Cancel print, then print/save PDF. | Cancel does not freeze; later print works. |  |
| RPT-09 | Print English/Urdu record. | Characters render without boxes/overlap/missing text. |  |

## Phase 15 — System-wide live synchronization

After each action, go directly to the verification screen. Do not visit another page first and do not reload.

| ID | Action | Verify immediately | Expected | Result |
| --- | --- | --- | --- | --- |
| SYNC-01 | Add/edit/archive/restore student. | List/profile/Dashboard | Counts and values are newest. |  |
| SYNC-02 | Save/change attendance. | Profile/report/Dashboard | Cards/history/percentage/counts update; no Loading. |  |
| SYNC-03 | Collect partial/full fee. | Row/modal/report/Dashboard | Paid/balance/status/summary update. |  |
| SYNC-04 | Add/edit/delete income/expense. | Finance/report/Dashboard | Totals agree immediately. |  |
| SYNC-05 | Save/publish marks. | Profile/results/reports | New mark/status/result appears. |  |
| SYNC-06 | Edit academic/staff/timetable assignment. | Selectors/grid/workspace | Assignment appears immediately. |  |
| SYNC-07 | Change branding/settings. | Shell/print preview | Identity/rules update consistently. |  |
| SYNC-08 | Repeat SYNC-01–07 in Urdu. | Same destinations | Localization never restores stale values. |  |

| ID | Dashboard check | Expected | Result |
| --- | --- | --- | --- |
| DASH-01 | Open as administrator/principal. | Student/gender/teacher/attendance/fees/finance values are accurate on first visit. |  |
| DASH-02 | Inspect charts, activity, exams, birthdays, quick actions. | Correct data or intentional empty state; no false zero/stale state. |  |
| DASH-03 | Open each quick action. | Correct destination/action. |  |
| DASH-04 | Sign in as each non-leadership role. | Role workspace/assignments/today's timetable replace leadership metrics. |  |

## Phase 16 — Users, roles, settings, templates

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| SET-01 | Create user with system role. | Appears immediately; correct access. |  |
| SET-02 | Edit role/status; reset password; test old/new. | Changes apply; old password fails. |  |
| SET-03 | Deactivate/archive user. | Login denied; no unintended protected session remains. |  |
| SET-04 | Create custom role with small permission set. | Only selected navigation/actions/data available. |  |
| SET-05 | Edit assigned custom role. | Permissions update after expected re-auth/session refresh. |  |
| SET-06 | Try deleting system/assigned role. | Incorrect deletion blocked. |  |
| SET-07 | Edit school English/Urdu name, logo, contact, principal, website, tagline, timezone. | Shell/prints update immediately and persist. |  |
| SET-08 | Edit pass %, attendance warning, SMS time, weights, currency, language; try invalid values. | Valid persists; invalid combinations rejected/handled clearly. |  |
| SET-09 | Edit certificate template/placeholders and print. | Supported placeholders resolve; unsupported input is visible/validated. |  |

## Phase 17 — Backup, restore, reset

Disposable database only.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| BAK-01 | Create/download backup. | New dated backup appears and downloads. |  |
| BAK-02 | Add uniquely named record after backup. | Visible before restore. |  |
| BAK-03 | Restore downloaded DB and accept sign-out. | Pre-backup data returns; post-backup record is gone. |  |
| BAK-04 | Inspect backups after restore. | Automatic safety copy exists. |  |
| BAK-05 | Try invalid/corrupt disposable file. | Rejected; active database remains usable. |  |
| BAK-06 | Run Demo Reset with exact confirmation. | Backup created; demo operations/accounts cleared; documented admin/settings/defaults remain. |  |
| BAK-07 | Run New Academic Year with valid dates/options. | Backup; old session closes; new current session; cleanup/archive matches choices. |  |
| BAK-08 | Cancel before final confirmation. | No data changes. |  |

## Phase 18 — LAN, offline, reliability, recovery

Run LAN cases only if LAN deployment is part of the release.

| ID | Procedure | Expected | Result |
| --- | --- | --- | --- |
| REL-01 | Build, run `npm run start:lan`, connect from authorized LAN device. | Login/operations use intended host DB. |  |
| REL-02 | Edit from one client; observe/reopen on another. | Consistent saved data; no silent overwrite. |  |
| REL-03 | Disconnect client during save, reconnect. | Clear failure; no false success/partial duplicate. |  |
| REL-04 | Work without internet. | Local CRUD/reports/print work; external failures are clear. |  |
| REL-05 | Double-click Save/Pay/Send rapidly. | One logical record/payment/message. |  |
| REL-06 | Switch modules repeatedly for 30 minutes. | No stale values, infinite loading, duplicate toast, slowdown, timeout. |  |
| REL-07 | Restart Windows/app after successful work. | Committed data remains; database opens. |  |
| REL-08 | Use Urdu, apostrophes, long values, optional blanks in QA records. | Save/search/print/export safely. |  |
| REL-09 | Test missing image/file, unavailable printer, blocked link. | Friendly recoverable error; no crash. |  |

## Final golden-path regression

Run after every group of fixes:

1. Start packaged app and sign in as administrator.
2. Switch Urdu, then English.
3. Register a temporary student; verify Dashboard count immediately.
4. Mark student Present; verify profile cards and Dashboard immediately.
5. Create/open invoice, pay partially then fully; verify outside label becomes Paid immediately.
6. Add expense; verify Finance, report, Dashboard immediately.
7. Publish a class-test mark; verify profile/result output.
8. Print/save certificate, receipt, attendance report, result card.
9. Test receptionist, accountant, and teacher access.
10. Reopen app; verify data persists with no loading/API error.

The release is not ready if any golden-path step fails.

## Release exit criteria

- Automated tests, build, unpacked startup, and installer pass.
- Critical daily workflows pass in English and Urdu where applicable.
- No permanent Loading, known stale state, navigation-to-refresh workaround, or duplicate attendance/payment/message record.
- Role restrictions protect navigation, actions, and data.
- Financial, attendance, student, and result totals agree across detail/list/report/Dashboard.
- Backup/restore passes on disposable data.
- No open Critical or High defects; accepted Medium/Low issues are documented.

## Defect severity

| Severity | Meaning | Example |
| --- | --- | --- |
| Critical | Data loss/corruption, access failure, app cannot start | Unauthorized finance access; restore destroys DB |
| High | Core workflow fails or material data is wrong | Wrong payment total; incorrect result |
| Medium | Workaround exists but normal work is impaired | Must navigate away to refresh |
| Low | Cosmetic/text issue only | Typo or small spacing/icon issue |

## Defect log

| Defect ID | Test ID(s) | Severity | Summary | Steps | Expected | Actual | Evidence | Frequency | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-001 |  |  |  |  |  |  |  | Always/Sometimes/Once | Open |

```text
Defect ID:
Test ID:
Build/commit:
Role/account:
Language:
Database type:
Severity:

Steps to reproduce:
1.
2.
3.

Expected result:
Actual result:
Does navigation/reload/restart change it?:
Frequency:
Screenshot/video:
Visible error message:
```
