import type Database from 'better-sqlite3';

// Upgrade only the previous stock enrollment wording. Administrator-customized
// templates are never overwritten.
const previousEnrollment = 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is currently enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. This enrollment certificate is issued on {{issue_date}} at the request of the student/parent for official use.';
const professionalEnrollment = 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is duly enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. This confirms the student\'s current active enrollment in the institution. The certificate is issued on {{issue_date}} at the request of the student or parent/guardian for official use.';

export const up = (db: Database.Database) => {
  db.prepare(`UPDATE settings SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key='certificate.enrollment_template' AND value=?`)
    .run(professionalEnrollment, previousEnrollment);
};
