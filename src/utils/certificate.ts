import { escapeHtml } from './print';

export type CertificateDocumentType = 'bonafide' | 'enrollment' | 'id-card';
export type CertificateLayout = 'portrait' | 'landscape';

export type CertificateData = {
  type: CertificateDocumentType | string;
  certificate_title?: string;
  name?: string;
  name_ur?: string;
  logo?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  principal_name?: string;
  certificate_number?: string;
  issue_date?: string;
  template_body?: string;
  certificate_body?: string;
  certificate_values?: Record<string, string>;
  father_name?: string;
  guardian_name?: string;
  guardian_relation?: string;
  student: Record<string, unknown>;
};

export const certificateTitle = (type: string) => {
  if (type === 'enrollment') return 'ENROLLMENT CERTIFICATE';
  if (type === 'id-card') return 'STUDENT ID CARD';
  return 'BONAFIDE CERTIFICATE';
};

const studentName = (student: Record<string, unknown>) => [student.first_name, student.last_name]
  .filter(Boolean)
  .map(String)
  .join(' ') || 'Student';

const studentValue = (student: Record<string, unknown>, key: string) => escapeHtml(student[key] ?? '—');

const photoMarkup = (student: Record<string, unknown>, width: string, height: string) => student.photo_path
  ? `<img src="${escapeHtml(student.photo_path)}" alt="Student photograph" style="width:${width};height:${height};object-fit:cover;border:1px solid #c7d8cc;border-radius:4px;background:#f6faf7"/>`
  : `<div style="width:${width};height:${height};display:flex;align-items:center;justify-content:center;border:1px solid #c7d8cc;border-radius:4px;background:#f3f8f4;color:#6f8275;font-size:9px;font-weight:700;letter-spacing:.06em">STUDENT PHOTO</div>`;

const contactLine = (data: CertificateData) => [data.address, data.phone, data.email, data.website]
  .filter(Boolean)
  .map((value) => escapeHtml(value))
  .join(' &nbsp;•&nbsp; ');

/**
 * Certificate settings are intentionally plain text. Escape the template before
 * inserting resolved values so custom copy cannot inject markup into a print
 * preview; dynamic data is always rendered with the same strong emphasis.
 */
export function renderCertificateBody(data: CertificateData) {
  const values = data.certificate_values || {};
  const source = escapeHtml(data.template_body || data.certificate_body || '');
  return source
    .replace(/\{\{([a-z_]+)\}\}/gi, (_match, key) => `<strong>${escapeHtml(values[key] || '')}</strong>`)
    .replace(/\n/g, '<br/>');
}

function decorativeFrame() {
  return `
    <div aria-hidden="true" style="position:absolute;inset:5px;border:1px solid #bf9d52;pointer-events:none"></div>
    <div aria-hidden="true" style="position:absolute;inset:10px;border:1px solid rgba(13,86,53,.42);pointer-events:none"></div>
    <span aria-hidden="true" style="position:absolute;left:13px;top:8px;color:#b48b37;font-size:23px;line-height:1">❦</span>
    <span aria-hidden="true" style="position:absolute;right:13px;top:8px;color:#b48b37;font-size:23px;line-height:1;transform:scaleX(-1)">❦</span>
    <span aria-hidden="true" style="position:absolute;left:13px;bottom:8px;color:#b48b37;font-size:23px;line-height:1;transform:scaleY(-1)">❦</span>
    <span aria-hidden="true" style="position:absolute;right:13px;bottom:8px;color:#b48b37;font-size:23px;line-height:1;transform:scale(-1)">❦</span>`;
}

function studentFacts(data: CertificateData, compact = false) {
  const student = data.student;
  const guardian = data.guardian_name || data.father_name || '—';
  const cell = (label: string, value: string) => `<div style="min-width:${compact ? '108px' : '125px'};padding:${compact ? '5px 8px' : '7px 10px'};border-right:1px solid #d8e4dc"><div style="font-size:${compact ? '7.8px' : '8.5px'};font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#5b7665">${label}</div><div style="margin-top:2px;font-size:${compact ? '9.5px' : '10.5px'};font-weight:700;color:#173b29">${value}</div></div>`;
  return `<div style="display:flex;flex-wrap:wrap;border:1px solid #d8e4dc;border-radius:4px;overflow:hidden;background:rgba(248,252,249,.92)">
    ${cell('Registration No.', studentValue(student, 'admission_no'))}
    ${cell('Roll No.', studentValue(student, 'roll_no'))}
    ${cell('Class / Section', `${studentValue(student, 'class_name')} ${studentValue(student, 'section_name')}`)}
    ${cell('Academic Session', studentValue(student, 'session_name'))}
    ${cell('Father / Guardian', escapeHtml(guardian))}
  </div>`;
}

/**
 * Shared certificate renderer. Content/data comes from the one reports API; the
 * caller chooses only the presentation orientation.
 */
export function buildProfessionalCertificate(data: CertificateData, layout: CertificateLayout = 'portrait') {
  const student = data.student;
  const landscape = layout === 'landscape';
  const title = data.certificate_title || certificateTitle(data.type);
  const watermark = escapeHtml((data.name || 'School').toUpperCase());
  const verticalPadding = landscape ? '10mm' : '13mm';
  const horizontalPadding = landscape ? '14mm' : '15mm';
  const contentMargin = landscape ? '11mm' : '18mm';
  const documentHeight = landscape ? '164mm' : '245mm';
  const photo = photoMarkup(student, landscape ? '31mm' : '32mm', landscape ? '38mm' : '40mm');

  return `<article style="position:relative;box-sizing:border-box;width:100%;min-height:${documentHeight};overflow:hidden;background:linear-gradient(135deg,#fffef8 0%,#fff 54%,#f7fbf7 100%);border:3px solid #0d5738;padding:${verticalPadding} ${horizontalPadding};color:#18261f;font-family:Arial,Helvetica,sans-serif">
    ${decorativeFrame()}
    <div aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;opacity:.055;color:#0b5938;font-size:${landscape ? '62px' : '56px'};font-weight:800;letter-spacing:5px;transform:rotate(-27deg);pointer-events:none">${watermark}</div>
    <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:2px solid #0b5938;padding:0 0 ${landscape ? '6mm' : '8mm'}">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        ${data.logo ? `<img src="${escapeHtml(data.logo)}" alt="School logo" style="width:${landscape ? '15mm' : '16mm'};height:${landscape ? '15mm' : '16mm'};object-fit:contain"/>` : `<div style="width:${landscape ? '15mm' : '16mm'};height:${landscape ? '15mm' : '16mm'};border:1px solid #9db8a5;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0d5738;font-size:8px;font-weight:800">SCHOOL</div>`}
        <div>
          <div style="font-size:${landscape ? '22px' : '21px'};font-weight:800;line-height:1.05;letter-spacing:.01em;color:#122b1d">${escapeHtml(data.name || 'School')}</div>
          <div style="margin-top:3px;font-size:10px;color:#4c6957">${escapeHtml(data.tagline || 'Learning for a brighter future')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:9px;text-align:right;flex-shrink:0">
        <div style="padding-top:1px"><div style="font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5e7567">Certificate No.</div><div style="margin-top:2px;font-size:10.5px;font-weight:800;color:#102d1d">${escapeHtml(data.certificate_number || '—')}</div><div style="margin-top:5px;font-size:8.5px;color:#53685b">Issued: ${escapeHtml(data.issue_date || '—')}</div></div>
        ${photo}
      </div>
    </div>

    <div style="position:relative;margin-top:${landscape ? '7mm' : '11mm'};text-align:center">
      <div style="font-size:${landscape ? '30px' : '28px'};font-weight:900;letter-spacing:${landscape ? '.055em' : '.045em'};color:#11281b;line-height:1.12">${escapeHtml(title)}</div>
      <div style="width:${landscape ? '128mm' : '112mm'};max-width:76%;height:2px;margin:${landscape ? '5mm' : '6mm'} auto 0;background:#0c603d"></div>
    </div>

    <div style="position:relative;margin-top:${landscape ? '7mm' : '10mm'};font-size:${landscape ? '13px' : '14px'};line-height:${landscape ? '1.75' : '1.82'};color:#172a20;text-align:justify">
      ${renderCertificateBody(data)}
    </div>

    <div style="position:relative;margin-top:${contentMargin}">
      ${studentFacts(data, landscape)}
    </div>

    <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-top:${landscape ? '10mm' : '22mm'};font-size:10.5px">
      <div style="line-height:1.7;color:#294735"><strong>Issue Date:</strong> ${escapeHtml(data.issue_date || '—')}<br/><strong>Academic Session:</strong> ${studentValue(student, 'session_name')}</div>
      <div style="min-width:50mm;text-align:center;color:#173425"><div style="height:23px;border-bottom:1px solid #748a7a"></div><div style="margin-top:4px;font-size:11px;font-weight:800">${escapeHtml(data.principal_name || 'Principal')}</div><div style="margin-top:2px;font-size:8.5px;color:#5b7162">Principal Signature & Official School Seal</div></div>
    </div>

    <div style="position:absolute;left:${horizontalPadding};right:${horizontalPadding};bottom:${landscape ? '6mm' : '8mm'};border-top:1px solid #cddbd1;padding-top:4px;text-align:center;font-size:8.5px;line-height:1.35;color:#53685b">${contactLine(data)}</div>
  </article>`;
}

export function buildStudentIdCard(data: CertificateData) {
  const student = data.student;
  const guardian = data.guardian_name || data.father_name || '—';
  const photo = photoMarkup(student, '26mm', '33mm');

  return `<article style="position:relative;box-sizing:border-box;width:86mm;min-height:54mm;margin:0 auto;overflow:hidden;border:1.2mm solid #0b5938;border-radius:4mm;background:linear-gradient(135deg,#fff 0%,#f3f9f4 100%);color:#14291c;font-family:Arial,Helvetica,sans-serif">
    <div aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.055;color:#0a5738;font-size:25px;font-weight:900;letter-spacing:3px;transform:rotate(-26deg);pointer-events:none">${escapeHtml((data.name || 'SCHOOL').toUpperCase())}</div>
    <div style="position:relative;display:flex;align-items:center;gap:6px;background:#0b5938;color:#fff;padding:5px 7px">
      ${data.logo ? `<img src="${escapeHtml(data.logo)}" alt="School logo" style="width:9mm;height:9mm;object-fit:contain"/>` : `<div style="width:9mm;height:9mm;border:1px solid rgba(255,255,255,.65);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:5px;font-weight:800">S</div>`}
      <div style="min-width:0"><div style="font-size:11px;font-weight:800;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:57mm">${escapeHtml(data.name || 'School')}</div><div style="margin-top:1px;font-size:6.5px;letter-spacing:.08em;font-weight:700">STUDENT IDENTITY CARD</div></div>
    </div>
    <div style="position:relative;display:flex;gap:6px;padding:6px 7px 4px">
      <div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:900;line-height:1.1;color:#0d492e">${escapeHtml(studentName(student))}</div><div style="margin-top:3px;font-size:7.2px;line-height:1.55"><strong>Reg. No.:</strong> ${studentValue(student, 'admission_no')}<br/><strong>Roll No.:</strong> ${studentValue(student, 'roll_no')}<br/><strong>Class:</strong> ${studentValue(student, 'class_name')} ${studentValue(student, 'section_name')}<br/><strong>Guardian:</strong> ${escapeHtml(guardian)}<br/><strong>Session:</strong> ${studentValue(student, 'session_name')}</div></div>
      ${photo}
    </div>
    <div style="position:relative;display:flex;justify-content:space-between;gap:5px;border-top:1px solid #cfddd3;padding:3px 7px 4px;font-size:5.9px;line-height:1.35;color:#385845"><span>${escapeHtml(data.certificate_number || '')}</span><span style="text-align:right">${escapeHtml(data.phone || data.address || '')}<br/>Principal Signature & Seal</span></div>
  </article>`;
}

export function buildCertificate(data: CertificateData, layout: CertificateLayout) {
  return data.type === 'id-card'
    ? buildStudentIdCard(data)
    : buildProfessionalCertificate(data, layout);
}
