# School ERP QA Checklist — Fresh Installation Demo School

Use this checklist after a fresh installation. It is intentionally ordered so each module has the records it needs.

## 0. Start and initialize

```bash
npm install
npm run dev
```

1. Open the application and sign in with `admin` / `admin123`.
2. On the first Dashboard visit, locate **Initialize Demo School**.
3. Confirm the dialog and wait for the success notification.
4. Refresh the dashboard once.

Expected demo dataset:

| Item | Expected minimum |
| --- | ---: |
| Academic session | 1 active current session |
| Classes | 12: Nursery, Kindergarten, Grade 1–10 |
| Sections | A and B for every class |
| Subjects | 11 reusable subjects |
| Rooms | Classroom A/B rooms plus Science and Computer labs |
| Teaching staff | 10 teacher records and logins |
| Office staff | 5 staff records and logins |
| Students | 24 enrolled students |
| Attendance | 10 recent school days for students and staff |
| Fee invoices | 24 invoices with paid, partial, and unpaid examples |
| Exams | Published mid-term data plus one upcoming final exam |
| SMS logs | Sent, delivered, and queued examples |

Demo user accounts:

| User | Password | Purpose |
| --- | --- | --- |
| `admin` | `admin123` | Full administrator setup and all tests |
| `teacher01` | `Demo123!` | Class/subject teacher permissions |
| `accountant` | `Demo123!` | Fee and finance workflow |
| `reception` | `Demo123!` | Admissions/front desk workflow |

---

## 1. Login and authentication

1. Leave username empty and submit. Confirm `Username is required`.
2. Enter `admin`, leave password empty, and submit. Confirm `Password is required`.
3. Test an invalid username and password. Confirm a safe invalid-credentials message.
4. Sign in as `admin` / `admin123`.
5. Confirm Dashboard loads and the user menu shows **System Administrator**.
6. Open the user menu and select **Sign out**.
7. Confirm protected pages redirect to the login page.
8. Log back in as `teacher01` / `Demo123!` and confirm the sidebar is permission-scoped.

---

## 2. Academic Setup

1. Open **Academic Setup**.
2. Confirm Nursery through Grade 10 are listed.
3. Use the Academic Setup search bar, class filter, and status filter on every tab (Classes, Sections, Subjects, Subject Allocation, Sessions, and Rooms).
4. Open a class and verify sections A/B, assigned subjects, and class teachers.
5. Add a temporary class, section, subject, room, and subject assignment.
6. Edit each temporary record.
7. Delete records that have no history; confirm the application explains when historical records prevent deletion.
8. Open **Settings → Rules & preferences** and verify editable exam types.

Expected: academic setup is editable and class/section/subject dependencies are available to later modules.

---

## 3. Students

1. Open **Students** and filter by class, section, and status.
2. Search for `DEMO-0001` and open the profile.
3. Verify guardian contacts, active enrollment, documents area, attendance percentage, and certificate actions.
4. Print an ID card, Bonafide certificate, and Enrollment certificate. Confirm the print preview contains content and offers Save PDF.
5. Register one new student using the camera/upload field and a parent contact. Confirm Registration Number and Roll Number are generated automatically.
6. Upload a document to the new student profile, then view it, download it, and remove it.
7. Edit the new student and verify data persists.
8. Open **Archived students**, archive the temporary student, filter by class, search it, then restore it.
9. Use **Promote class** to inspect the auto-promotion workflow; do not confirm unless testing with disposable data.
10. Test a manual promotion from a student profile.
11. Open Class Test History and print a Class Test Result Card.

Fresh-database dependency check: when no classes exist, Student Management displays a guided **Create class** action instead of opening a broken registration form.

---

## 4. Staff

1. Open **Staff** and confirm 15 demo staff records.
2. Search for `TCH-001`, type a long staff name, and confirm the full query remains visible in the expanded search field.
3. Open a teacher profile and inspect salary history and attendance.
4. Add a temporary staff member with a staff login account.
5. Change salary and confirm a salary-history entry is created.
6. Archive the temporary staff member.
7. Sign in as `teacher01` and verify the role has teacher-facing access only.

---

## 5. Timetable

1. Open **Timetable**.
2. Select Grade 1, Grade 5, or Grade 10, Section A.
3. Confirm demo lessons, teachers, and rooms appear in the weekly grid.
4. Add, edit, and remove one lesson.
5. Try assigning a conflicting teacher or room in the same period; confirm the system blocks the conflict.
6. Print the timetable and confirm A4 landscape output.
7. Open **Configure periods** and update a period or school day.

Fresh-database dependency check: if classes, subjects, teachers, or rooms are absent, the page shows guided links to the appropriate setup page and disables lesson creation safely.

---

## 6. Attendance

1. Open **Attendance → Student attendance**.
2. Select a demo class/section and a recent school date.
3. Confirm the roster loads with present, absent, late, and leave controls.
4. Change several statuses and save.
5. Lock the sheet as administrator, then confirm it cannot be changed by a non-admin workflow.
6. Open **Daily report** and print it.
7. Open a student profile and verify attendance history updates.
8. Open **Staff attendance**; save a staff sheet.
9. Sign in as a teacher/staff user and use **Mark my check-in** if that account has a linked staff profile.

---

## 7. Fees and Finance

1. Open **Fees & Finance → Fee heads** and verify the default heads.
2. Review **Fee structures** for multiple classes.
3. Open **Invoices & collection** and verify paid, partial, and unpaid demo invoices.
4. Open a partial invoice and collect a second partial payment.
5. Confirm the receipt prints and the invoice balance/status updates.
6. Create a manual invoice for a demo student.
7. Use **Generate monthly** for a class only after changing the billing month to avoid duplicate-demo invoice checks.
8. Add an income entry and expense entry; verify monthly net income updates.
9. Open the fee report from **Reports** and confirm outstanding dues appear.

---

## 8. Tests and Exams

1. Open **Tests & Exams → Class tests**.
2. Open a demo class test, edit marks, save, and publish.
3. Open **Term exams** and review the published Demo Mid-Term Examination.
4. Open an exam subject and edit marks.
5. Create a new custom exam, add subjects, enter marks, and submit it.
6. Sign in with a principal/administrator account to approve and publish the exam.
7. Open **Results & award lists**.
8. Select Grade 5 Section A and the Demo Mid-Term Examination.
9. Print a result card, award list, and blank award list.
10. Verify class-test 25% + examination 75% contribution, grades, attendance, position, and progress graph.

---

## 9. SMS and WhatsApp

1. Open **SMS & WhatsApp → Templates** and inspect or edit a template.
2. Open **Gateway settings**. Leave it disabled for offline queue testing, or enter a real provider in a test environment.
3. Send a test SMS to a single demo student.
4. Send an unpaid-fee reminder group message.
5. Open **Delivery log** and confirm queued/sent/delivered sample entries.
6. Use **Resend** on a queued message.
7. Open a student profile, choose **WhatsApp**, edit the message, and confirm the regular WhatsApp URL opens.

---

## 10. Reports and printing

1. Open **Reports & printing**.
2. Run Student List by class/section; print and export Excel.
3. Run Attendance as daily, monthly sheet, and student history; print each.
4. Run Fees & Dues and Income & Expenses; print and export Excel.
5. Run Award List and Timetable reports.
6. Generate Bonafide and Enrollment certificates.
7. Confirm reports use the editable School Profile branding.

---

## 11. Dashboard

1. Return to Dashboard.
2. Confirm cards show students, boys/girls, teachers, attendance, collections, pending fees, income, expenses, and net income.
3. Confirm weekly/monthly attendance, financial, and student-growth charts render.
4. Confirm recent activity, upcoming exam, birthdays, and quick actions work.
5. After changing attendance, payments, income, or expenses, refresh Dashboard and verify the affected metrics update.

---

## 12. User Management

1. Open **Settings → Users** as administrator.
2. Create a temporary user with Receptionist or Staff role.
3. Sign in with the new account and verify permitted navigation only.
4. Reset the temporary user password.
5. Deactivate the account and confirm login is denied.
6. Archive the temporary account.
7. Open **Roles & permissions** and create/edit a custom role.

---

## 13. Settings

1. Open **School profile** and update name, address, phone, website, tagline, principal, and logo.
2. Print a certificate or receipt to verify branding updates instantly.
3. Open **Certificate templates**, update a placeholder-based template, then print a Bonafide Certificate to verify replacement.
4. Open **Rules & preferences** and adjust passing percentage, attendance warning threshold, SMS time, and assessment weights.
5. Confirm the new values are retained after refreshing the application.

---

## 14. Backup and Restore

1. Open **Settings → Backup & restore**.
2. Select **Create backup**.
3. Confirm a backup appears in the backup list and download it.
4. Make a harmless visible change such as a temporary income entry.
5. Select the downloaded `.db`, `.sqlite`, or `.sqlite3` backup file and choose **Restore and sign out**.
6. Sign in again with `admin` / `admin123`.
7. Confirm the temporary post-backup change is gone and core demo records are intact.
8. Confirm the application created a safety copy before replacing the active database.
9. Open **Settings → Reset school data** and review both destructive modes without confirming on a production database.
10. In a disposable test database, type `RESET SCHOOL DATA`, verify the automatic backup, then test Demo Reset and New Academic Year cleanup.

> Always create and download a backup before testing restore on a real school database.
