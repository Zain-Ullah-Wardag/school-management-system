import type Database from 'better-sqlite3';

const characterTemplate = 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is a student of {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. During the period of association with this institution, the student\'s character, conduct, and behaviour have been found to be good and satisfactory. This character certificate is issued on {{issue_date}} for official purposes.';
const leavingTemplate = 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, was enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. The student is leaving the institution with effect from {{issue_date}}. According to the records maintained by the school, the student\'s conduct has been satisfactory. This leaving certificate is issued at the request of the parent or guardian.';

export const up = (db: Database.Database) => {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key,value,group_name) VALUES (?,?,?)');
  insert.run('certificate.character_template', characterTemplate, 'certificate');
  insert.run('certificate.leaving_template', leavingTemplate, 'certificate');
};
