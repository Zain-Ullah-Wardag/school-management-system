# School ERP API Reference

All endpoints are relative to `/api`. Except `/health` and `/auth/login`, requests require:

```http
Authorization: Bearer <jwt>
Content-Type: application/json
```

Successful responses use `{ "success": true, "data": ... }`. Validation, authorization, and database errors use `{ "success": false, "message": ... }`.

## Authentication and users

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Sign in |
| GET | `/auth/me` | Authenticated | Current identity and permissions |
| POST | `/auth/change-password` | Authenticated | Change own password |
| GET/POST | `/users` | `users.manage` | Search or create user accounts |
| PATCH/DELETE | `/users/:id` | `users.manage` | Edit or archive an account |
| PATCH | `/users/:id/reset-password` | `users.manage` | Reset a password |
| GET | `/users/roles` | `users.manage` | Roles for account assignment |
| GET | `/users/permissions` | `users.manage` | Permission catalogue |

## Student and staff management

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET/POST | `/students` | `students.read` / `students.manage` | Paginated filtering and registration |
| GET/PATCH/DELETE | `/students/:id` | `students.read` / `students.manage` | Profile, update, archive |
| GET | `/students/stats` | `students.read` | Enrollment counts |
| GET | `/students/next-identifiers` | `students.manage` | Preview automatically generated registration/roll numbers |
| GET | `/students/:id/class-tests` | `students.read` | Complete student class-test history |
| POST | `/students/:id/restore` | `students.manage` | Restore an archived student |
| POST | `/students/:id/documents` | `students.manage` | Attach an uploaded document |
| DELETE | `/students/:id/documents/:documentId` | `students.manage` | Remove document metadata |
| POST | `/students/:id/promote` | `students.manage` | Manual/repeater promotion |
| POST | `/students/promotions/auto` | `students.manage` | Batch promotion by class/section |
| GET/POST | `/staff` | `staff.read` / `staff.manage` | Search or add staff |
| GET/PATCH/DELETE | `/staff/:id` | `staff.read` / `staff.manage` | Staff profile, update, archive |
| POST | `/staff/:id/salary-history` | `staff.manage` | Add salary revision |
| GET/POST | `/staff/departments`, `/staff/designations` | Read/manage staff | Lookup management |
| POST | `/uploads` | Authenticated | JPG, PNG, WEBP, or PDF upload (8MB max) |

## Academic configuration and timetable

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET/POST | `/academic/classes` | Academic read/manage | Class catalogue |
| GET/PATCH/DELETE | `/academic/classes/:id` | Academic read/manage | Class detail and editing |
| GET/POST/PATCH/DELETE | `/academic/sections[/:id]` | Academic read/manage | Section catalogue |
| GET/POST/PATCH/DELETE | `/academic/subjects[/:id]` | Academic read/manage | Subject catalogue |
| GET/POST/PATCH/DELETE | `/academic/class-subjects[/:id]` | Academic read/manage | Subject/teacher allocation |
| GET/POST/PATCH | `/academic/sessions[/:id]` | Academic read/manage | Academic sessions/current session |
| GET/POST/PATCH/DELETE | `/academic/rooms[/:id]` | Academic read/manage | Rooms |
| GET/POST/PATCH/DELETE | `/academic/exam-types[/:id]` | Academic read/manage | Exam types |
| GET/PATCH | `/timetable/settings` | Timetable read/manage | School days and duration |
| POST/PATCH/DELETE | `/timetable/periods[/:id]` | `timetable.manage` | Periods/breaks |
| GET/POST/PATCH/DELETE | `/timetable/entries[/:id]` | Timetable read/manage | Weekly entries and conflict checks |

## Attendance

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/attendance/roster` | Attendance read/mark | Class roster with current statuses |
| POST | `/attendance` | Attendance mark/manage | Save student register |
| PATCH | `/attendance/:id/lock` | `attendance.manage` | Lock/unlock a register |
| GET | `/attendance/reports/daily` | `attendance.read` | Daily class summary |
| GET | `/attendance/reports/monthly` | `attendance.read` | Student monthly sheet |
| GET | `/attendance/students/:studentId/history` | `attendance.read` | Student attendance history |
| GET/POST | `/attendance/staff` | Staff read or attendance manage | Staff register |
| POST | `/attendance/staff/me` | Authenticated | Staff self check-in |

## Fees and finance

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET/POST/PATCH/DELETE | `/fees/heads[/:id]` | Fees read/manage | Fee heads |
| GET/POST/PATCH/DELETE | `/fees/structures[/:id]` | Fees read/manage | Class fee structures |
| GET/POST | `/fees/invoices` | Fees read/manage | Search/create manual invoices |
| POST | `/fees/invoices/generate` | `fees.manage` | Generate monthly invoices in bulk |
| GET | `/fees/invoices/:id` | `fees.read` | Invoice detail and payment history |
| POST | `/fees/invoices/:id/void` | `fees.manage` | Void unpaid invoice |
| POST | `/fees/payments` | Fees collect/manage | Partial/full payment plus allocations |
| GET | `/fees/payments/:id/receipt` | Fees read/collect | Receipt data |
| GET | `/fees/reports` | Fees read/reports read | Collection and outstanding data |
| GET/POST/PATCH/DELETE | `/fees/income[/:id]` | Finance manage | Other income |
| GET/POST/PATCH/DELETE | `/fees/expenses[/:id]` | Finance manage | Expenses |
| GET/POST | `/fees/expense-categories` | Finance manage | Expense category setup |
| GET | `/fees/finance-summary` | Finance/reports | Net income summary |

## Assessments and results

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET/POST/PATCH | `/assessments/tests[/:id]` | Assessments read/manage | Unlimited class test setup |
| GET/PUT | `/assessments/tests/:id/marks` | Assessments read/manage | Test roster and marks |
| POST | `/assessments/tests/:id/publish` | `assessments.manage` | Publish class test |
| GET/POST/PATCH | `/assessments/exams[/:id]` | Assessments read/manage | Term/custom exam setup |
| POST/PATCH | `/assessments/exams/:id/subjects[/:subjectId]` | `assessments.manage` | Exam subjects |
| GET/PUT | `/assessments/exams/:id/subjects/:subjectId/marks` | Assessments read/manage | Exam marks |
| POST | `/assessments/exams/:id/submit` | `assessments.manage` | Submit for principal approval |
| POST | `/assessments/exams/:id/approve` | `assessments.approve` | Principal approval |
| POST | `/assessments/exams/:id/publish` | `assessments.approve` | Publish results |
| GET | `/assessments/exams/:id/results` | Assessments/reports read | Calculated class results |

## Communication, reports, settings, dashboard

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET/PATCH | `/communication/gateway` | `sms.manage` | SMS provider configuration |
| GET/POST/PATCH/DELETE | `/communication/templates[/:id]` | SMS send/manage | Templates |
| POST | `/communication/send` | `sms.send` | SMS or WhatsApp send/queue |
| GET | `/communication/logs` | SMS send/manage | Delivery/audit log |
| POST | `/communication/logs/:id/resend` | `sms.send` | Resend a log entry |
| POST | `/communication/whatsapp-link` | `sms.send` | Generate regular WhatsApp URL |
| GET | `/reports/students`, `/reports/attendance`, `/reports/fees`, `/reports/finance` | `reports.read` | Report data sources |
| GET | `/reports/result-card/:examId/:studentId` | `reports.read` | Branded midterm/final/custom result-card data |
| GET | `/reports/class-test-card/:testId/:studentId` | `reports.read` | Branded class-test result-card data |
| GET | `/reports/award-list/:examId`, `/reports/blank-award-list/:examId` | `reports.read` | Award-list data |
| GET | `/reports/timetable`, `/reports/certificate/:studentId` | `reports.read` | Print data |
| GET/PUT | `/settings` | `settings.manage` | Editable key/value school settings |
| GET/POST/PATCH/DELETE | `/settings/roles[/:id]` | `settings.manage` | Role/permission sets |
| GET | `/dashboard` | Administrator/Principal | KPI cards, charts, activity, birthday and exam data |
| GET/POST | `/visitors` | Visitor read/manage | Reception visitor register and check-in |
| POST | `/visitors/:id/checkout` | `visitors.manage` | Check a visitor out |
| GET | `/setup/status` | `settings.manage` | Fresh-database/demo initialization status |
| POST | `/setup/demo` | `settings.manage` | Safely initialize the complete Green Valley demo school on a clean database |
| GET/POST | `/backups` | `settings.manage` | List or create consistent local SQLite backups |
| GET | `/backups/:fileName` | `settings.manage` | Download a local backup |
| POST | `/backups/restore` | `settings.manage` | Validate and restore a SQLite School ERP backup |
| POST | `/system/reset` | Administrator only | Automatic backup plus demo reset or new academic year cleanup |
| GET/POST/PATCH/DELETE | `/messaging/configurations[/:id]` | `sms.manage` | Provider configuration catalogue and dynamic settings |
| POST | `/messaging/configurations/:id/validate` | `sms.manage` | Validate provider connection |
| POST | `/messaging/configurations/:id/test` | `sms.manage` | Send provider test message |
| GET/POST/PATCH/DELETE | `/messaging/templates[/:id]` | SMS send/manage | Commercial messaging templates |
| POST | `/messaging/send` | `sms.send` | Send to student, parent, staff, visitor, class, section, or school |
| GET | `/messaging/logs` | SMS send/manage | Provider-aware delivery log |
| POST | `/messaging/logs/:id/retry` | SMS send/manage | Retry a message |
| GET/POST | `/messaging/modem/ports`, `/messaging/modem/connect` | `sms.manage` | GSM modem serial-port workflow |
| GET/PUT/POST | `/fees/reminders/status`, `/fees/reminders/config`, `/fees/reminders/send-now` | Fees manage | Automatic/manual outstanding fee reminders |
