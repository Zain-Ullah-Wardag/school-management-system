import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, Download, FilePlus2, IdCard, Printer, Send, Trash2, UploadCloud } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { Button } from '../../components/common/Button';
import { Card, CardHeader } from '../../components/common/Card';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Field, SelectInput, TextArea, TextInput } from '../../components/common/FormFields';
import { PageHeader } from '../../components/common/PageHeader';
import { date, fullName } from '../../utils/format';
import { escapeHtml, printHtml } from '../../utils/print';
import { buildCertificate, certificateCatalog, type CertificateDocumentType } from '../../utils/certificate';
import { buildAcademicResultCard } from '../../utils/result-card';
import { useMutationToast } from '../../hooks/useMutationToast';
import { useToast } from '../../context/ToastContext';
import { apiError } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import { useDataSync } from '../../hooks/useDataSync';

export default function StudentProfilePage() {
  const { id = '' } = useParams();
  const studentId = Number(id);
  const navigate = useNavigate();
  const synchronize = useDataSync();
  const { toast } = useToast();
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const { data: student, isLoading } = useQuery({ queryKey: queryKeys.students.detail(studentId), queryFn: () => schoolApi.students.get(studentId) });
  const { data: classes = [] } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { data: sessions = [] } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const { data: attendance, isLoading: isAttendanceLoading } = useQuery({ queryKey: queryKeys.students.attendance(studentId), queryFn: () => schoolApi.attendance.history(studentId) });
  const { data: classTests = [], isLoading: isClassTestsLoading } = useQuery({ queryKey: queryKeys.students.classTests(studentId), queryFn: () => schoolApi.students.classTestHistory(studentId) });
  const { data: academicResults = [], isLoading: isAcademicResultsLoading } = useQuery({ queryKey: queryKeys.students.results(studentId), queryFn: () => schoolApi.students.academicResults(studentId) });

  const promote = useMutationToast((body: any) => schoolApi.students.promote(studentId, body), {
    success: 'Promotion processed', sync: ['students'], onSuccess: () => setPromoteOpen(false)
  });
  const removeDocument = useMutationToast(({ documentId }: { documentId: number }) => schoolApi.students.removeDocument(studentId, documentId), {
    success: 'Document removed', sync: ['students']
  });

  const uploadDocument = async (file: File) => {
    try {
      const uploaded = await schoolApi.upload(file);
      await schoolApi.students.document(studentId, { document_type: classifyDocument(file.name), file_name: uploaded.file_name, file_path: uploaded.path, mime_type: uploaded.mime_type });
      await synchronize(['students']);
      toast('success', 'Document uploaded and attached to the student record');
    } catch (error) {
      toast('error', 'Document upload failed', apiError(error));
    }
  };

  const printCertificate = async (type: CertificateDocumentType) => {
    try {
      const data = await schoolApi.reports.certificate(studentId, { type });
      printHtml(buildCertificate(data, 'portrait'), `${type}-certificate`, 'portrait');
    } catch (error) { toast('error', 'Certificate could not be generated', apiError(error)); }
  };

  const printIdCard = async () => {
    try {
      const data = await schoolApi.reports.certificate(studentId, { type: 'id-card' });
      printHtml(buildCertificate(data, 'portrait'), 'student-id-card', 'portrait');
    } catch (error) { toast('error', 'ID card could not be generated', apiError(error)); }
  };

  const printClassTest = async (testId: number) => {
    try {
      const data = await schoolApi.reports.classTestCard(testId, studentId);
      printHtml(classTestTemplate(data), `class-test-${testId}`);
    } catch (error) { toast('error', 'Class test result could not be generated', apiError(error)); }
  };

  const printAcademicResult = async (result: any) => {
    try {
      const data = await schoolApi.reports.resultCard(result.exam.id, studentId, { class_id: result.class_id, section_id: result.section_id || undefined });
      printHtml(buildAcademicResultCard(data), `${result.exam_type}-result-card`);
    } catch (error) { toast('error', 'Result card could not be generated', apiError(error)); }
  };

  if (isLoading) return <p className="p-8 text-sm text-slate-500">Loading student profile…</p>;
  if (!student) return <p className="p-8 text-sm text-slate-500">Student not found.</p>;

  return <>
    <PageHeader
      crumbs="Students / Profile"
      title={fullName(student)}
      description={`${student.admission_no} · ${student.class_name || 'No class'} ${student.section_name || ''}`}
      actions={<>
        <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/students')}>Back to list</Button>
        <Button variant="outline" icon={<IdCard className="h-4 w-4" />} onClick={() => void printIdCard()}>ID card</Button>
        <Button variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => setWhatsAppOpen(true)}>WhatsApp</Button>
        <Button icon={<Award className="h-4 w-4" />} onClick={() => setPromoteOpen(true)}>Promote student</Button>
      </>}
    />

    <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
      <Card className="overflow-hidden"><div className="h-20 bg-gradient-to-r from-brand-700 to-brand-500" /><div className="px-5 pb-5"><Avatar src={student.photo_path} name={fullName(student)} className="-mt-10 h-20 w-20 rounded-2xl border-4 border-white text-xl" /><div className="mt-3 flex items-start justify-between gap-2"><div><h2 className="text-xl font-extrabold text-slate-900">{fullName(student)}</h2><p className="text-sm text-slate-500">{student.admission_no}</p></div><div className="flex flex-col items-end gap-1"><Badge value={student.status} /><Badge value={isAttendanceLoading ? 'loading' : (attendance?.today_status || attendance?.current_status || 'not_marked')}>{isAttendanceLoading ? 'Attendance…' : `Attendance: ${(attendance?.today_status || attendance?.current_status || 'not marked').replace(/_/g, ' ')}`}</Badge></div></div><dl className="mt-5 space-y-3 text-sm"><Info label="Class" value={`${student.class_name || '—'} ${student.section_name || ''}`} /><Info label="Roll number" value={student.roll_no || '—'} /><Info label="Date of birth" value={date(student.date_of_birth)} /><Info label="Gender" value={student.gender} /><Info label="Phone" value={student.phone || '—'} /><Info label="Blood group" value={student.blood_group || '—'} /></dl><div className="mt-5 grid grid-cols-2 gap-2">{certificateCatalog.filter((item) => item.type !== 'id-card').map((item) => <Button key={item.type} variant="outline" className="text-xs" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => void printCertificate(item.type)}>{item.label.replace(' Certificate', '')}</Button>)}</div></div></Card>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Attendance" value={isAttendanceLoading ? 'Loading…' : `${attendance?.percentage ?? 0}%`} detail={isAttendanceLoading ? 'Loading attendance summary…' : `${attendance?.attended_days ?? 0} attended of ${attendance?.marked_days ?? 0} marked days`} tone="brand" />
          <Metric label="Today's attendance" value={isAttendanceLoading ? 'Loading…' : formatAttendanceStatus(attendance?.today_status)} detail={attendance?.last_marked_date ? `Latest marked: ${formatAttendanceStatus(attendance?.last_status)} on ${date(attendance.last_marked_date)}` : 'Most recently marked attendance'} />
          <Metric label="Admission date" value={date(student.admission_date)} detail="Active academic enrollment" />
          <Metric label="Emergency contact" value={student.emergency_contact || student.phone || 'Not entered'} detail="For urgent school communication" />
        </div>
        <Card>
          <CardHeader title="Attendance history" description="The summary is calculated from the same saved rows shown below and refreshes as soon as attendance is saved." action={isAttendanceLoading ? <span className="text-xs text-slate-400">Loading…</span> : <Badge value={attendance?.current_status || 'not_marked'} />} />
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 md:grid-cols-4 md:divide-y-0">
            <AttendanceCount label="Present days" value={attendance?.present_days ?? 0} tone="brand" />
            <AttendanceCount label="Absent days" value={attendance?.absent_days ?? 0} tone="rose" />
            <AttendanceCount label="Leave days" value={attendance?.leave_days ?? 0} tone="violet" />
            <AttendanceCount label="Late days" value={attendance?.late_days ?? 0} tone="amber" />
          </div>
          <div className="divide-y divide-slate-50">{isAttendanceLoading ? <p className="p-5 text-sm text-slate-400">Loading attendance history…</p> : attendance?.records?.length ? attendance.records.slice(0, 20).map((record: any) => <div className="flex items-center justify-between px-5 py-3" key={record.attendance_session_id || `${record.attendance_date}-${record.status}`}><span><b className="text-sm text-slate-700">{date(record.attendance_date)}</b><small className="ml-2 text-xs text-slate-400">{record.class_name} {record.section_name || ''}{record.remarks ? ` · ${record.remarks}` : ''}</small></span><Badge value={record.status} /></div>) : <p className="p-5 text-sm text-slate-400">No attendance records are available yet.</p>}</div>
        </Card>
        <Card><CardHeader title="Parents & guardians" description="Primary contacts used for fee and attendance alerts." /><div className="grid divide-y divide-slate-50 md:grid-cols-3 md:divide-x md:divide-y-0">{student.contacts?.length ? student.contacts.map((contact: any) => <div className="p-4" key={contact.id}><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{contact.contact_type}</p><p className="mt-2 font-bold text-slate-800">{contact.full_name}</p><p className="mt-1 text-sm text-slate-500">{contact.phone || 'No phone'} · {contact.relation || '—'}</p>{contact.is_primary ? <span className="mt-2 inline-block text-xs font-semibold text-brand-700">Primary contact</span> : null}</div>) : <p className="p-5 text-sm text-slate-400">No guardian contact added.</p>}</div></Card>
        <Card><CardHeader title="Documents" description="Stored documents can be previewed, downloaded, or removed." action={<label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><UploadCloud className="h-4 w-4" /> Upload<input type="file" className="sr-only" accept=".pdf,.doc,.docx,.odt,.txt,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(file); event.currentTarget.value = ''; }} /></label>} /><div className="divide-y divide-slate-50">{student.documents?.length ? student.documents.map((document: any) => <div key={document.id} className="flex items-center gap-3 px-5 py-3"><FilePlus2 className="h-5 w-5 text-brand-600" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-700">{document.file_name}</span><span className="text-xs text-slate-400">{document.document_type} · {date(document.uploaded_at)}</span></span><a href={document.file_path} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700" title="View"><EyeIcon /></a><a href={document.file_path} download={document.file_name} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700" title="Download"><Download className="h-4 w-4" /></a><label className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700" title="Replace"><input type="file" className="sr-only" accept=".pdf,.doc,.docx,.odt,.txt,image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await schoolApi.students.replaceDocument(studentId, document.id, file); await synchronize(['students']); toast('success', 'Document replaced'); } catch (error) { toast('error', 'Document replacement failed', apiError(error)); } event.currentTarget.value = ''; }} /><span className="text-xs font-bold">↻</span></label><button onClick={() => removeDocument.mutate({ documentId: document.id })} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove"><Trash2 className="h-4 w-4" /></button></div>) : <p className="p-5 text-sm text-slate-400">No documents attached yet.</p>}</div></Card>
        <Card><CardHeader title="Class test history" description="Every recorded class test remains attached to this student." /><div className="divide-y divide-slate-50">{isClassTestsLoading ? <p className="p-5 text-sm text-slate-400">Loading class test history…</p> : classTests.length ? classTests.map((test: any) => <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" key={test.class_test_id}><div><p className="font-semibold text-slate-700">{test.name} · {test.subject_name}</p><p className="text-xs text-slate-500">{test.class_name} {test.section_name || ''} · {date(test.test_date)} · {test.obtained_marks ?? '—'} / {test.total_marks} · {test.percentage}% · Grade {test.grade}</p></div><div className="flex items-center gap-2"><Badge value={test.result_status?.toLowerCase() || test.status} /><Button variant="outline" className="h-8 px-2 text-xs" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => void printClassTest(test.class_test_id)}>Result card</Button></div></div>) : <p className="p-5 text-sm text-slate-400">No class test records are available for this student.</p>}</div></Card>
        <Card><CardHeader title="Academic result history" description="Published Midterm, Final Term, and custom examination result cards." /><div className="divide-y divide-slate-50">{isAcademicResultsLoading ? <p className="p-5 text-sm text-slate-400">Loading academic results…</p> : academicResults.length ? academicResults.map((result: any) => <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" key={result.exam.id}><div><p className="font-semibold text-slate-700">{result.exam.name}</p><p className="text-xs text-slate-500">{result.student.class_name} {result.student.section_name || ''} · Total {result.total_marks} · Obtained {result.obtained_marks} · {result.percentage}% · Grade {result.grade} · GPA {result.gpa}</p></div><div className="flex items-center gap-2"><Badge value={result.status.toLowerCase()} /><Button variant="outline" className="h-8 px-2 text-xs" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => void printAcademicResult(result)}>{result.exam_type === 'final' ? 'Final Card' : result.exam_type === 'midterm' ? 'Midterm Card' : 'Result Card'}</Button></div></div>) : <p className="p-5 text-sm text-slate-400">No published academic results are available for this student.</p>}</div></Card><Card><CardHeader title="Enrollment history" /><div className="divide-y divide-slate-50">{student.enrollments?.map((entry: any) => <div className="flex items-center justify-between px-5 py-3" key={entry.id}><div><p className="font-semibold text-slate-700">{entry.class_name} {entry.section_name || ''} · {entry.session_name}</p><p className="text-xs text-slate-500">Roll {entry.roll_no || '—'} · Started {date(entry.started_on)}</p></div><Badge value={entry.status} /></div>)}</div></Card>
      </div>
    </div>

    <Modal open={whatsAppOpen} onClose={() => setWhatsAppOpen(false)} title="Send through WhatsApp" size="sm"><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const response = await schoolApi.communication.whatsapp({ phone: form.get('phone'), message: form.get('message') }); if (window.desktop?.isElectron) await window.desktop.openExternal(response.url); else window.open(response.url, '_blank'); setWhatsAppOpen(false); } catch (error) { toast('error', 'Could not create WhatsApp link', apiError(error)); } }} className="space-y-4"><Field label="WhatsApp number"><TextInput name="phone" defaultValue={student.whatsapp || student.phone || ''} required /></Field><Field label="Message"><TextArea name="message" defaultValue={`Dear parent, this is a message regarding ${fullName(student)}.`} required /></Field><p className="text-xs text-slate-500">This opens regular WhatsApp with your editable message. No paid WhatsApp API is used.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setWhatsAppOpen(false)}>Cancel</Button><Button type="submit" icon={<Send className="h-4 w-4" />}>Open WhatsApp</Button></div></form></Modal>
    <Modal open={promoteOpen} onClose={() => setPromoteOpen(false)} title="Process promotion" size="md"><PromotionForm student={student} classes={classes} sections={sections} sessions={sessions} saving={promote.isPending} onClose={() => setPromoteOpen(false)} onSave={(body: any) => promote.mutate(body)} /></Modal>
  </>;
}

function PromotionForm({ student, classes, sections, sessions, saving, onClose, onSave }: any) {
  return <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ to_session_id: form.get('session'), to_class_id: form.get('class'), to_section_id: form.get('section') || null, promotion_type: form.get('type'), keep_roll_no: form.get('keep_roll') === 'on', roll_no: form.get('roll_no') || null, principal_approved: form.get('approved') === 'on', note: form.get('note') }); }} className="space-y-4"><p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">Promotion closes the current enrollment and creates a new active enrollment. Principal approval is recorded on the promotion history.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Academic session" required><SelectInput name="session" defaultValue={student.session_id || ''}>{sessions.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field><Field label="Promotion type" required><SelectInput name="type"><option value="promoted">Promoted</option><option value="repeated">Repeat student</option><option value="manual">Manual placement</option></SelectInput></Field><Field label="Target class" required><SelectInput name="class"><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field><Field label="Target section"><SelectInput name="section"><option value="">No section</option>{sections.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field><Field label="New roll number"><TextInput name="roll_no" placeholder="Generated if left blank" /></Field><Field label="Approval"><span className="flex h-10 items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="approved" /> Principal approved</span></Field></div><Field label="Note"><TextArea name="note" /></Field><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="keep_roll" /> Keep current roll number (for repeater)</label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Confirm promotion</Button></div></form>;
}

function formatAttendanceStatus(value?: string | null) { if (!value || value === 'not_marked') return 'Not marked'; return value.replace(/^./, (letter) => letter.toUpperCase()); }
function AttendanceCount({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'rose' | 'violet' | 'amber' }) { const colors = { brand: 'text-brand-700', rose: 'text-rose-700', violet: 'text-violet-700', amber: 'text-amber-700' }; return <div className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-extrabold ${colors[tone]}`}>{value}</p></div>; }
function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'brand' }) { return <Card className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-xl font-extrabold ${tone === 'brand' ? 'text-brand-700' : 'text-slate-800'}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold capitalize text-slate-700">{value}</dd></div>; }
function EyeIcon() { return <span className="text-sm font-bold">↗</span>; }
function classifyDocument(name: string) { const lower = name.toLowerCase(); return lower.includes('birth') ? 'Birth Certificate' : lower.includes('b-form') || lower.includes('bform') ? 'B Form' : lower.includes('result') ? 'Previous Result' : 'Other Document'; }
function schoolHeading(data: any) { return `<div style="display:flex;align-items:center;gap:12px">${data.logo ? `<img src="${escapeHtml(data.logo)}" style="height:50px;width:50px;object-fit:contain"/>` : ''}<div><h1>${escapeHtml(data.name || 'School')}</h1><p class="muted">${escapeHtml(data.tagline || data.address || '')}</p><p class="muted">${escapeHtml(data.address || '')}</p></div></div>`; }
function photoMarkup(student: any) { return student.photo_path ? `<img src="${escapeHtml(student.photo_path)}" style="width:32mm;height:40mm;object-fit:cover;border-radius:4px;border:1px solid #cbd5d1"/>` : `<div style="width:32mm;height:40mm;display:flex;align-items:center;justify-content:center;background:#edf7f1;border:1px solid #cbd5d1;border-radius:4px">PHOTO</div>`; }
function classTestTemplate(data: any) { const test = data.test; return `<div class="header">${schoolHeading(data)}<div class="right"><h2>CLASS TEST RESULT CARD</h2><p class="muted">${escapeHtml(test.test_date)}</p></div></div><div style="display:flex;gap:18px;align-items:flex-start">${photoMarkup(test)}<div><h2>${escapeHtml(fullName(test))}</h2><p>Registration: <strong>${escapeHtml(test.admission_no)}</strong> · Roll: <strong>${escapeHtml(test.roll_no || '')}</strong></p><p>Class: ${escapeHtml(test.class_name || '')} ${escapeHtml(test.section_name || '')}</p><p>Test: ${escapeHtml(test.name)} · Subject: ${escapeHtml(test.subject_name)}</p></div></div><table style="margin-top:18px"><thead><tr><th>Total Marks</th><th>Passing Marks</th><th>Obtained Marks</th><th>Percentage</th><th>Grade</th><th>Result</th></tr></thead><tbody><tr><td>${test.total_marks}</td><td>${test.passing_marks}</td><td>${test.obtained_marks ?? '—'}</td><td>${data.percentage}%</td><td>${data.grade}</td><td>${data.status}</td></tr></tbody></table><p style="margin-top:22px"><strong>Teacher remarks:</strong> ${escapeHtml(test.remarks || 'Keep working consistently.')}</p><div style="display:flex;justify-content:space-between;margin-top:70px"><span>Teacher signature</span><span>${escapeHtml(data.principal_name || 'Principal')}<br/>Principal signature</span></div>`; }
