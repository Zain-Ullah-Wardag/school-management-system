# School ERP — Offline-First Desktop Management System

A production-oriented School Management System built with **React 18 + TypeScript + Vite**, **Electron**, **Express**, and **SQLite (better-sqlite3)**. It is designed for a school desktop environment: data remains local, the app works offline, and the renderer communicates with a local API rather than embedding database access in React.

## Highlights

- Electron-ready offline desktop architecture
- JWT authentication with bcrypt password hashes and role/permission controls
- Normalized SQLite schema with foreign keys, WAL mode, migration history, and non-destructive migrations
- Student registrations, camera/photo capture, contacts, document uploads, certificates, ID cards, and promotions
- Staff, salary history, optional staff login accounts, and attendance
- Editable classes, sections, subjects, sessions, rooms, exam types, school days, and timetable periods
- Student/staff attendance, sheet locking, school-day calculations, and scheduled absence SMS dispatch
- Fee structures, invoices, partial allocations, receipt printing, income, expenses, and collections
- Unlimited class tests, weighted term exams, approval/publish workflow, results, award lists, and result cards
- Configurable SMS gateway, templates, logs, resend flow, and regular WhatsApp click-to-send links
- Branded A4 print/PDF paths plus Excel export using `xlsx`
- English / Urdu interface foundation, responsive desktop layout, Tailwind-only UI, Recharts dashboards
- One-click **Initialize Demo School** workflow with a complete realistic test dataset
- Authenticated SQLite backup/download and validated restore with a pre-restore safety copy

## Quick start

```bash
npm install
npm run build
npm run dev
```

Open the Vite workspace at the local URL shown by `npm run dev` (normally `http://localhost:5173`). `npm run dev` starts both the Express API and the Vite renderer.

To open the Electron desktop shell during development:

```bash
npm run dev:desktop
```

Use **Node.js 20** for this project. Native dependencies such as `better-sqlite3`,
`bcrypt`, and `serialport` are rebuilt for Electron during packaging and are not
supported by this project configuration under Node.js 24.

To build the Windows installer on Windows:

```bash
npm ci
npm run package:win
```

The NSIS installer is written to `artifacts/School ERP Setup 1.0.0.exe`.
You can also open the repository's **Actions** tab, run **Build Windows Installer**,
and download the `school-erp-windows-installer` artifact after the workflow finishes.

### First sign-in

On a brand-new database, use the bootstrap administrator account:

- **Username:** `admin`
- **Password:** `admin123`

The account is flagged for a password change. Change it immediately in a real deployment. These can be overridden on first launch with `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`.

### Initialize Demo School

For a fresh database, sign in as `admin` and use **Initialize Demo School** on the Dashboard. It creates the complete Green Valley School dataset in one transaction: Nursery through Grade 10, 24 students, 10 teachers, 5 office staff, attendance, fee records, payments, timetables, assessments, SMS logs, reports, and dashboard activity.

Demo accounts created by this action include `teacher01`, `accountant`, and `reception`, all with password `Demo123!`. The action is intentionally available only while the database contains no operational records.

## Environment

Copy `.env.example` to `.env` only when overrides are needed.

```env
PORT=3299
JWT_SECRET=replace-with-a-long-random-secret-before-deployment
DATABASE_PATH=database/school.db
UPLOAD_DIR=uploads
BACKUP_DIR=backups
```

When `JWT_SECRET` is omitted, the local server creates and persists a random local signing secret in the database. Packaged Electron builds use the Electron user-data directory for the SQLite database and uploads.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts Express and Vite for local development |
| `npm run dev:desktop` | Starts API, Vite, and Electron together |
| `npm run build` | Type-checks and builds server, Electron, and renderer |
| `npm run typecheck` | Runs TypeScript checks only |
| `npm run lint` | Runs the ESLint quality gate |
| `npm run test:auth` | Runs isolated authentication, JWT, bootstrap-seed, and user-management checks |
| `npm run test:demo` | Starts a clean temporary database and verifies one-click demo initialization |
| `npm run test:reset` | Verifies automatic backup, demo reset, and new academic year cleanup |
| `npm run test:smoke` | Runs an isolated end-to-end SQLite/API smoke test |
| `npm test` | Alias for the full smoke test |
| `npm run package` | Builds then invokes electron-builder |
| `npm run package:win` | Builds the Windows x64 NSIS `.exe` installer |
| `npm run package:dir` | Builds an unpacked desktop directory for testing |
| `npm run start:lan` | Serves the built ERP and API together for LAN browser clients |

## Architecture

```text
school-management-system/
├── electron/
│   ├── main.ts                         # Secure desktop shell, local API child process, PDF save IPC
│   └── preload.ts                      # Narrow renderer-to-desktop bridge
├── database/
│   ├── index.ts                        # SQLite setup, WAL, FK enforcement, migration runner
│   ├── seed.ts                         # Editable defaults and first administrator seed
│   └── migrations/
│       ├── 001_core.ts
│       ├── 002_people_academic.ts
│       ├── 003_operations.ts
│       └── 004_assessment_communication.ts
├── server/
│   ├── controllers/                    # Thin HTTP controllers
│   ├── middleware/                     # JWT, authorization, upload, errors
│   ├── routes/                         # Module routes
│   ├── services/                       # Database/business rules (no SQL in React)
│   ├── utils/
│   ├── app.ts
│   └── index.ts
├── src/
│   ├── components/
│   │   ├── common/                     # Cards, tables, modal, forms, print helpers
│   │   ├── dashboard/
│   │   ├── forms/                      # Student/staff/fee/exam/settings module forms
│   │   └── layout/
│   ├── context/                        # Auth, language, toast providers
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   │   ├── academic/
│   │   ├── attendance/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── exams/
│   │   ├── fees/
│   │   ├── reports/
│   │   ├── settings/
│   │   ├── sms/
│   │   ├── staff/
│   │   ├── students/
│   │   └── timetable/
│   ├── services/                       # Typed API client
│   ├── styles/
│   ├── types/
│   └── utils/                          # Formatting, Excel, print/PDF helpers
├── uploads/                            # Runtime local uploads (excluded from source control)
├── scripts/smoke-test.ts
├── App.tsx
├── main.tsx
└── package.json
```

## Database design

Migrations are append-only and tracked in `schema_migrations`. Existing data is never dropped by the migration runner.

| Area | Tables |
| --- | --- |
| Security and audit | `roles`, `permissions`, `role_permissions`, `users`, `user_permissions`, `settings`, `activity_logs`, `notifications` |
| Academic calendar | `school_sessions`, `school_days`, `timetable_settings`, `timetable_periods`, `timetable_entries` |
| People | `departments`, `designations`, `staff`, `staff_salary_history`, `students`, `student_contacts`, `student_documents`, `enrollments`, `student_promotions` |
| Academics | `classes`, `sections`, `subjects`, `class_subjects`, `rooms` |
| Attendance | `attendance_sessions`, `attendance_records`, `staff_attendance` |
| Fees and finance | `fee_heads`, `fee_structures`, `invoices`, `invoice_items`, `payments`, `payment_allocations`, `income_entries`, `expense_categories`, `expenses` |
| Assessment | `class_tests`, `class_test_marks`, `exam_types`, `exams`, `exam_subjects`, `exam_marks`, `result_publications` |
| Communication | `sms_gateway_settings`, `sms_templates`, `sms_logs` |

Foreign keys are enabled for every SQLite connection. High-volume lookup paths have indexes for student, enrollment, activity, attendance, invoice, and SMS access patterns.

## API modules

All endpoints are rooted at `/api` and return a consistent `{ success, data, message? }` envelope.

| Module | Endpoint root | Main capabilities |
| --- | --- | --- |
| Auth | `/auth` | Login, current identity, password change |
| Users | `/users` | Account creation, roles, permission overrides, reset/archive |
| Students | `/students` | Registration, profile, documents, manual/auto promotions |
| Staff | `/staff` | Staff profiles, salary history, departments, designations |
| Academic | `/academic` | Classes, sections, subjects, allocations, sessions, rooms, exam types |
| Timetable | `/timetable` | School days, periods, entries, conflict checks |
| Attendance | `/attendance` | Registers, locking, staff attendance, daily/monthly/history data |
| Fees | `/fees` | Heads, structures, invoices, collection, receipts, financial records |
| Assessments | `/assessments` | Tests, marks, exams, approval, publishing, result calculations |
| Communication | `/communication` | Gateway, templates, SMS/WhatsApp sending, logs, resends |
| Reports | `/reports` | Printable student, attendance, fee, finance, result, award, timetable, certificate data |
| Settings | `/settings` | Branding, operational rules, roles and permission sets |
| Dashboard | `/dashboard` | KPI cards, charts, activity, birthday and exam data |
| Setup | `/setup` | Clean-database status and one-click demo initialization |
| Backups | `/backups` | Local SQLite backup, download, validation, and restore |

## Printing and export

- **Browser:** print-ready HTML opens the system print dialog; select “Save as PDF” if desired.
- **Electron:** the preload bridge sends print-ready HTML to a hidden Electron window and saves a real PDF through the native save dialog.
- **Excel:** report tables export through `xlsx` as `.xlsx` files.

## Verification

The included smoke test uses a temporary SQLite file and exercises:

1. Migration and first-login setup
2. Class, section, subject, assignment, and student registration
3. Student attendance
4. Fee invoice and partial payment receipt allocation
5. Class test marks, term exam marks, submit/approve/publish, result calculation
6. Timetable entry creation
7. Offline SMS queueing
8. Settings persistence, reporting, and dashboard retrieval

Run it with:

```bash
npm run test:smoke
```

For a complete tester-facing module order and expected results, use [`docs/QA_TESTING_CHECKLIST.md`](docs/QA_TESTING_CHECKLIST.md).

For server/client LAN deployment, firewall, backup, shared upload, and SQLite scaling guidance, use [`docs/LAN_DEPLOYMENT_GUIDE.md`](docs/LAN_DEPLOYMENT_GUIDE.md).

For automatic fee reminder configuration and placeholders, use [`docs/FEE_REMINDER_GUIDE.md`](docs/FEE_REMINDER_GUIDE.md).

For GSM modem, SMS API, Android gateway, WhatsApp Cloud API, and provider extension guidance, use [`docs/MESSAGING_PROVIDER_GUIDE.md`](docs/MESSAGING_PROVIDER_GUIDE.md).
