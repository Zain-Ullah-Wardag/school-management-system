import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';

type SeedRole = { code: string; name: string; nameUr: string; description: string };

const roles: SeedRole[] = [
  { code: 'principal', name: 'Principal', nameUr: 'پرنسپل', description: 'School leadership and final approvals' },
  { code: 'administrator', name: 'Administrator', nameUr: 'منتظم', description: 'Full system administration' },
  { code: 'accountant', name: 'Accountant', nameUr: 'اکاؤنٹنٹ', description: 'Fees, income and expenses' },
  { code: 'receptionist', name: 'Receptionist', nameUr: 'استقبالیہ', description: 'Admissions and front desk operations' },
  { code: 'class_teacher', name: 'Class Teacher', nameUr: 'کلاس ٹیچر', description: 'Assigned class operations' },
  { code: 'subject_teacher', name: 'Subject Teacher', nameUr: 'سبجیکٹ ٹیچر', description: 'Assigned subject and assessment operations' },
  { code: 'staff', name: 'Staff', nameUr: 'عملہ', description: 'Staff self-service access' }
];

const permissions = [
  ['dashboard.read', 'dashboard', 'read', 'View dashboard'],
  ['users.manage', 'users', 'manage', 'Manage users and permissions'],
  ['students.read', 'students', 'read', 'View students'],
  ['students.manage', 'students', 'manage', 'Manage students and promotions'],
  ['staff.read', 'staff', 'read', 'View staff'],
  ['staff.manage', 'staff', 'manage', 'Manage staff and salaries'],
  ['academic.read', 'academic', 'read', 'View classes, sections and subjects'],
  ['academic.manage', 'academic', 'manage', 'Manage academic setup'],
  ['timetable.read', 'timetable', 'read', 'View timetable'],
  ['timetable.manage', 'timetable', 'manage', 'Manage timetable'],
  ['attendance.read', 'attendance', 'read', 'View attendance'],
  ['attendance.mark', 'attendance', 'mark', 'Mark attendance'],
  ['attendance.manage', 'attendance', 'manage', 'Manage and amend attendance'],
  ['fees.read', 'fees', 'read', 'View fees and collections'],
  ['fees.manage', 'fees', 'manage', 'Manage fee structures and invoices'],
  ['fees.collect', 'fees', 'collect', 'Collect payments'],
  ['finance.manage', 'finance', 'manage', 'Manage income and expenses'],
  ['assessments.read', 'assessments', 'read', 'View tests and exams'],
  ['assessments.manage', 'assessments', 'manage', 'Manage tests and exams'],
  ['assessments.approve', 'assessments', 'approve', 'Approve and publish results'],
  ['reports.read', 'reports', 'read', 'View and export reports'],
  ['sms.send', 'sms', 'send', 'Send SMS and WhatsApp messages'],
  ['sms.manage', 'sms', 'manage', 'Configure messaging'],
  ['settings.manage', 'settings', 'manage', 'Manage school settings'],
  ['visitors.read', 'visitors', 'read', 'View visitor register'],
  ['visitors.manage', 'visitors', 'manage', 'Manage visitor register']
] as const;

const settingRows = [
  ['school.name', 'School ERP Academy', 'school'], ['school.name_ur', 'اسکول ای آر پی اکیڈمی', 'school'],
  ['school.logo', '', 'school'], ['school.address', '', 'school'], ['school.phone', '', 'school'],
  ['school.email', '', 'school'], ['school.website', '', 'school'], ['school.tagline', 'Learning for a brighter future', 'school'], ['school.principal_name', '', 'school'], ['school.passing_percentage', '40', 'academic'],
  ['school.currency', 'PKR', 'finance'], ['school.timezone', 'Asia/Karachi', 'school'],
  ['attendance.warning_percentage', '75', 'attendance'], ['attendance.sms_time', '10:15', 'attendance'],
  ['exam.class_test_weight', '25', 'exam'], ['exam.term_weight', '75', 'exam'],
  ['ui.language', 'en', 'general'], ['ui.date_format', 'dd MMM yyyy', 'general'],
  ['certificate.bonafide_template', 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is a bona fide student of {{school_name}}. The student is currently enrolled in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. According to the records maintained by the school, the student\'s conduct and attendance have been satisfactory. This certificate is issued upon the student\'s request for official purposes and carries no financial liability on the part of the institution.', 'certificate'],
  ['certificate.enrollment_template', 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is duly enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. This confirms the student\'s current active enrollment in the institution. The certificate is issued on {{issue_date}} at the request of the student or parent/guardian for official use.', 'certificate'],
  ['certificate.character_template', 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is a student of {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. During the period of association with this institution, the student\'s character, conduct, and behaviour have been found to be good and satisfactory. This character certificate is issued on {{issue_date}} for official purposes.', 'certificate'],
  ['certificate.leaving_template', 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, was enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. The student is leaving the institution with effect from {{issue_date}}. According to the records maintained by the school, the student\'s conduct has been satisfactory. This leaving certificate is issued at the request of the parent or guardian.', 'certificate'],
  ['fee.reminder_enabled', 'true', 'fee_reminders'], ['fee.reminder_day', '5', 'fee_reminders'], ['fee.reminder_template_code', 'fee_due', 'fee_reminders'], ['fee.reminder_channel', 'sms', 'fee_reminders']
];

export function seedDatabase(db: Database.Database) {
  const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (code,name,name_ur,description,is_system) VALUES (?,?,?,?,1)`);
  roles.forEach((role) => insertRole.run(role.code, role.name, role.nameUr, role.description));
  const insertPermission = db.prepare(`INSERT OR IGNORE INTO permissions (code,module,action,label) VALUES (?,?,?,?)`);
  permissions.forEach(([code, module, action, label]) => insertPermission.run(code, module, action, label));

  const allPermissionIds = db.prepare('SELECT id FROM permissions').all() as { id: number }[];
  const roleId = (code: string) => (db.prepare('SELECT id FROM roles WHERE code = ?').get(code) as { id: number }).id;
  const mapPermission = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  const allRoles = ['administrator', 'principal'];
  allRoles.forEach((role) => allPermissionIds.forEach((p) => mapPermission.run(roleId(role), p.id)));
  const allow = (role: string, codes: string[]) => codes.forEach((code) => {
    const permission = db.prepare('SELECT id FROM permissions WHERE code = ?').get(code) as { id: number } | undefined;
    if (permission) mapPermission.run(roleId(role), permission.id);
  });
  allow('accountant', ['dashboard.read', 'students.read', 'fees.read', 'fees.manage', 'fees.collect', 'finance.manage', 'reports.read', 'sms.send']);
  allow('receptionist', ['dashboard.read', 'students.read', 'students.manage', 'academic.read', 'fees.read', 'fees.collect', 'attendance.read', 'reports.read', 'sms.send', 'visitors.read', 'visitors.manage']);
  // Teacher system roles are intentionally restricted to teaching workflows.
  // Synchronize existing installations as well as fresh databases so previously
  // granted administrative/financial permissions do not remain active.
  const synchronizeRole = (role: string, codes: string[]) => {
    const roleIdentifier = roleId(role);
    db.prepare('DELETE FROM role_permissions WHERE role_id=?').run(roleIdentifier);
    codes.forEach((code) => {
      const permission = db.prepare('SELECT id FROM permissions WHERE code=?').get(code) as { id: number } | undefined;
      if (permission) mapPermission.run(roleIdentifier, permission.id);
    });
  };
  synchronizeRole('class_teacher', ['students.read', 'timetable.read', 'attendance.read', 'attendance.mark', 'assessments.read', 'assessments.manage', 'sms.send']);
  synchronizeRole('subject_teacher', ['students.read', 'timetable.read', 'attendance.read', 'attendance.mark', 'assessments.read', 'assessments.manage', 'sms.send']);
  synchronizeRole('staff', ['dashboard.read']);

  const settingInsert = db.prepare('INSERT OR IGNORE INTO settings (key,value,group_name) VALUES (?,?,?)');
  settingRows.forEach((row) => settingInsert.run(...row));
  const year = new Date().getFullYear();
  db.prepare(`INSERT OR IGNORE INTO school_sessions (name,starts_on,ends_on,is_current,status) VALUES (?,?,?,?,?)`)
    .run(`${year}-${year + 1}`, `${year}-04-01`, `${year + 1}-03-31`, 1, 'active');
  db.prepare(`INSERT OR IGNORE INTO timetable_settings (id) VALUES (1)`).run();
  const dayInsert = db.prepare('INSERT OR IGNORE INTO school_days (weekday,is_school_day,start_time,end_time) VALUES (?,?,?,?)');
  for (let day = 0; day < 7; day += 1) dayInsert.run(day, day > 0 && day < 6 ? 1 : 0, '08:00', '14:00');
  const periodInsert = db.prepare('INSERT OR IGNORE INTO timetable_periods (name,sequence,start_time,end_time,period_type) VALUES (?,?,?,?,?)');
  [['Period 1', 1, '08:00', '08:40', 'lesson'], ['Period 2', 2, '08:40', '09:20', 'lesson'], ['Break', 3, '09:20', '09:40', 'break'], ['Period 3', 4, '09:40', '10:20', 'lesson'], ['Period 4', 5, '10:20', '11:00', 'lesson'], ['Period 5', 6, '11:00', '11:40', 'lesson']]
    .forEach((item) => periodInsert.run(...item));
  const headInsert = db.prepare('INSERT OR IGNORE INTO fee_heads (name,code,category) VALUES (?,?,?)');
  [['Admission Fee', 'ADMISSION', 'one_time'], ['Monthly Fee', 'MONTHLY', 'recurring'], ['Exam Fee', 'EXAM', 'recurring'], ['Transport', 'TRANSPORT', 'transport'], ['Fine', 'FINE', 'fine'], ['Others', 'OTHER', 'other']]
    .forEach((item) => headInsert.run(...item));
  const examTypeInsert = db.prepare('INSERT OR IGNORE INTO exam_types (name,code,default_weight) VALUES (?,?,?)');
  [['Mid Term', 'MID', 75], ['Final Term', 'FINAL', 75], ['Custom Exam', 'CUSTOM', 75]].forEach((item) => examTypeInsert.run(...item));
  const templateInsert = db.prepare('INSERT OR IGNORE INTO sms_templates (code,name,body) VALUES (?,?,?)');
  [
    ['fee_due', 'Fee due reminder', 'Dear Parent, the monthly fee of Rs. {{due_amount}} for {{student_name}} (Class {{class}} - {{section}}) is still pending. Kindly submit the fee at your earliest convenience. Regards, {{school_name}}.'], 
    ['absent', 'Absent alert', 'Dear parent, {student} is absent today ({date}).'],
    ['attendance_warning', 'Attendance warning', '{student} attendance is {percentage}%. Please ensure regular attendance.'],
    ['exam_result', 'Exam result', '{student} result for {exam}: {percentage}% ({grade}).']
  ].forEach((item) => templateInsert.run(...item));
  ['Salaries', 'Utilities', 'Maintenance', 'Stationery', 'Transport', 'Other'].forEach((name) => db.prepare('INSERT OR IGNORE INTO expense_categories (name) VALUES (?)').run(name));

  // Bootstrap is intentionally checked by username rather than total user count.
  // This repairs an incomplete/imported database where users exist but the documented
  // administrator account was never created, without changing an existing password.
  const bootstrapUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
  const bootstrapExists = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(bootstrapUsername) as { id: number } | undefined;
  if (!bootstrapExists) {
    const adminRole = roleId('administrator');
    const passwordHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD || 'admin123', 12);
    db.prepare(`INSERT INTO users (full_name,username,password_hash,role_id,status,must_change_password) VALUES (?,?,?,?,?,1)`)
      .run('System Administrator', bootstrapUsername, passwordHash, adminRole, 'active');
  }
}
