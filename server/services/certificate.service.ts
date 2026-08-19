import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { today } from '../utils/serializers';
import { SettingsService } from './settings.service';

export const certificateTypes = ['bonafide', 'enrollment', 'character', 'leaving', 'id-card'] as const;
export type CertificateType = typeof certificateTypes[number];

type CertificateDefinition = {
  title: string;
  numberPrefix: string;
  templateKey?: string;
  fallbackTemplate?: string;
};

const definitions: Record<CertificateType, CertificateDefinition> = {
  bonafide: {
    title: 'BONAFIDE CERTIFICATE',
    numberPrefix: 'BON',
    templateKey: 'certificate.bonafide_template',
    fallbackTemplate: 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is a bona fide student of {{school_name}}. The student is currently enrolled in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. According to the records maintained by the school, the student\'s conduct and attendance have been satisfactory. This certificate is issued upon the student\'s request for official purposes and carries no financial liability on the part of the institution.'
  },
  enrollment: {
    title: 'ENROLLMENT CERTIFICATE',
    numberPrefix: 'ENR',
    templateKey: 'certificate.enrollment_template',
    fallbackTemplate: 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is duly enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. This confirms the student\'s current active enrollment in the institution. The certificate is issued on {{issue_date}} at the request of the student or parent/guardian for official use.'
  },
  character: {
    title: 'CHARACTER CERTIFICATE',
    numberPrefix: 'CHR',
    templateKey: 'certificate.character_template',
    fallbackTemplate: 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is a student of {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. During the period of association with this institution, the student\'s character, conduct, and behaviour have been found to be good and satisfactory. This character certificate is issued on {{issue_date}} for official purposes.'
  },
  leaving: {
    title: 'LEAVING CERTIFICATE',
    numberPrefix: 'LVC',
    templateKey: 'certificate.leaving_template',
    fallbackTemplate: 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, was enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. The student is leaving the institution with effect from {{issue_date}}. According to the records maintained by the school, the student\'s conduct has been satisfactory. This leaving certificate is issued at the request of the parent or guardian.'
  },
  'id-card': {
    title: 'STUDENT ID CARD',
    numberPrefix: 'ID'
  }
};

function normalizeType(value: string): CertificateType {
  if ((certificateTypes as readonly string[]).includes(value)) return value as CertificateType;
  throw new ApiError(422, 'Unsupported certificate type. Select Bonafide, Enrollment, Character, Leaving, or Student ID Card.');
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-z_]+)\}\}/gi, (_match, key) => values[key] || '');
}

/**
 * The single certificate data source used by both Student Profiles and Reports.
 * Renderers only choose their presentation layout; they do not recalculate
 * certificate content or student data independently.
 */
export class CertificateService {
  build(studentId: number, rawType: string) {
    const type = normalizeType(rawType);
    const definition = definitions[type];
    const db = getDatabase();
    const student = db.prepare(`
      SELECT s.*,e.roll_no,c.name class_name,sec.name section_name,ss.name session_name
      FROM students s
      LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active'
      LEFT JOIN classes c ON c.id=e.class_id
      LEFT JOIN sections sec ON sec.id=e.section_id
      LEFT JOIN school_sessions ss ON ss.id=e.session_id
      WHERE s.id=?
    `).get(studentId) as Record<string, unknown> | undefined;
    if (!student) throw new ApiError(404, 'Student not found');

    const guardian = db.prepare(`
      SELECT full_name,contact_type,relation
      FROM student_contacts
      WHERE student_id=? AND contact_type IN ('father','guardian','mother')
      ORDER BY CASE contact_type WHEN 'father' THEN 0 WHEN 'guardian' THEN 1 ELSE 2 END,is_primary DESC,id
      LIMIT 1
    `).get(studentId) as { full_name: string; contact_type: string; relation: string | null } | undefined;

    const branding = new SettingsService().branding();
    const issueDate = today();
    const guardianName = guardian?.full_name || '—';
    const values: Record<string, string> = {
      student_name: [student.first_name, student.last_name].filter(Boolean).join(' '),
      father_name: guardianName,
      registration_number: String(student.admission_no || ''),
      roll_number: String(student.roll_no || ''),
      class: String(student.class_name || ''),
      section: String(student.section_name || ''),
      session: String(student.session_name || ''),
      issue_date: issueDate,
      school_name: branding.name || 'School',
      principal_name: branding.principal_name || 'Principal'
    };

    const storedTemplate = definition.templateKey
      ? db.prepare('SELECT value FROM settings WHERE key=?').get(definition.templateKey) as { value: string } | undefined
      : undefined;
    const template = storedTemplate?.value || definition.fallbackTemplate || '';
    const certificateNumber = `${definition.numberPrefix}-${issueDate.replace(/-/g, '')}-${String(studentId).padStart(5, '0')}`;

    return {
      ...branding,
      type,
      certificate_title: definition.title,
      document_number_label: type === 'id-card' ? 'Card No.' : 'Certificate No.',
      student,
      father_name: guardianName,
      guardian_name: guardianName,
      guardian_relation: guardian?.relation || guardian?.contact_type || '',
      certificate_number: certificateNumber,
      issue_date: issueDate,
      template_key: definition.templateKey || null,
      template_body: template,
      certificate_body: renderTemplate(template, values),
      certificate_values: values,
      generated_on: new Date().toISOString()
    };
  }
}
