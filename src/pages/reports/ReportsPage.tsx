import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarDays, Download, FileText, GraduationCap, Printer, ReceiptText, TableProperties } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Field, SelectInput, TextInput } from '../../components/common/FormFields';
import { exportExcel } from '../../utils/export';
import { escapeHtml, printHtml } from '../../utils/print';
import { buildCertificate, certificateCatalog } from '../../utils/certificate';
import { currentMonthInput, fullName, todayInput } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { apiError } from '../../services/api';

type ReportKind = 'students' | 'attendance' | 'fees' | 'finance' | 'award' | 'timetable' | 'certificate';
const options: { id: ReportKind; title: string; description: string; icon: typeof GraduationCap }[] = [
  { id: 'students', title: 'Student list', description: 'Class-wise enrollment and contact list', icon: GraduationCap },
  { id: 'attendance', title: 'Attendance', description: 'Daily, monthly, and history reports', icon: CalendarDays },
  { id: 'fees', title: 'Fees & dues', description: 'Collection trend and outstanding dues', icon: ReceiptText },
  { id: 'finance', title: 'Income & expenses', description: 'Financial activity and net income', icon: TableProperties },
  { id: 'award', title: 'Award list', description: 'Exam positions and result performance', icon: Award },
  { id: 'timetable', title: 'Timetable', description: 'Class weekly timetable', icon: CalendarDays },
  { id: 'certificate', title: 'Certificates', description: 'Bonafide, enrollment, character, leaving, and ID cards', icon: FileText }
];

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('students');
  const [filters, setFilters] = useState<any>({ date: todayInput(), from: `${todayInput().slice(0, 4)}-01-01`, to: todayInput(), type: 'bonafide', attendance_mode: 'daily', month: currentMonthInput(), session_id: '', class_id: '', section_id: '', student_id: '' });
  const [result, setResult] = useState<any>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { query: globalQuery } = useGlobalSearch();
  const { data: classes = [] } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { data: sessions = [] } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const { data: exams = [] } = useQuery({ queryKey: queryKeys.assessments.exams, queryFn: schoolApi.assessments.exams });
  const { data: studentsPage } = useQuery({
    queryKey: [...queryKeys.students.reportPicker, filters.session_id, filters.class_id, filters.section_id, globalQuery],
    queryFn: () => schoolApi.students.list({ limit: 100, status: 'active', search: globalQuery.trim() || undefined, session_id: filters.session_id || undefined, class_id: filters.class_id || undefined, section_id: filters.section_id || undefined })
  });

  const setFilter = (patch: object) => setFilters((current: any) => ({ ...current, ...patch }));
  const run = async () => {
    try {
      setLoading(true);
      let data: any;
      if (kind === 'students') data = await schoolApi.reports.students(filters);
      if (kind === 'attendance') {
        const attendanceFilters = { ...filters };
        if (attendanceFilters.attendance_mode === 'history') delete attendanceFilters.month;
        data = await schoolApi.reports.attendance(attendanceFilters);
      }
      if (kind === 'fees') data = await schoolApi.reports.fees(filters);
      if (kind === 'finance') data = await schoolApi.reports.finance(filters);
      if (kind === 'award') data = await schoolApi.reports.awardList(Number(filters.exam_id), filters);
      if (kind === 'timetable') data = await schoolApi.reports.timetable(filters);
      if (kind === 'certificate') {
        if (!filters.student_id) throw new Error('Select a student before generating a certificate');
        data = await schoolApi.reports.certificate(Number(filters.student_id), { type: filters.type });
      }
      setResult(data);
    } catch (error) { toast('error', 'Report could not be generated', apiError(error)); }
    finally { setLoading(false); }
  };
  const print = () => { if (!result) return; const orientation: 'portrait' | 'landscape' = kind === 'certificate' ? (result.type === 'id-card' ? 'portrait' : 'landscape') : kind === 'timetable' ? 'landscape' : 'portrait'; printHtml(reportHtml(kind, result), `${kind}-report`, orientation); };
  const exportRows = useMemo(() => rowsForExport(kind, result), [kind, result]);
  const showAcademicFilters = kind === 'students' || kind === 'timetable' || kind === 'award' || kind === 'certificate';

  return <>
    <PageHeader title="Reports & printing" description="Generate branded, print-ready school reports and export operational data to Excel." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{options.map((option) => { const Icon = option.icon; return <button key={option.id} onClick={() => { setKind(option.id); setResult(null); }} className={`rounded-2xl border p-4 text-left transition ${kind === option.id ? 'border-brand-300 bg-brand-50 shadow-panel' : 'border-slate-100 bg-white hover:border-brand-100 hover:bg-brand-50/30'}`}><span className={`inline-flex rounded-xl p-2 ${kind === option.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-4 w-4" /></span><p className="mt-3 font-bold text-slate-800">{option.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p></button>; })}</div>
    <Card className="mt-5 p-5"><div className="grid gap-4 md:grid-cols-3">
      {showAcademicFilters && <Field label="Academic session"><SelectInput value={filters.session_id} onChange={(event) => setFilter({ session_id: event.target.value, student_id: '' })}><option value="">Current / active session</option>{sessions.map((session: any) => <option key={session.id} value={session.id}>{session.name}</option>)}</SelectInput></Field>}
      {showAcademicFilters && <Field label="Class"><SelectInput value={filters.class_id} onChange={(event) => setFilter({ class_id: event.target.value, section_id: '', student_id: '' })}><option value="">{kind === 'certificate' ? 'All classes' : 'Select class'}</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>}
      {showAcademicFilters && <Field label="Section"><SelectInput disabled={!filters.class_id} value={filters.section_id} onChange={(event) => setFilter({ section_id: event.target.value, student_id: '' })}><option value="">{filters.class_id ? 'All / no section' : 'Select class first'}</option>{sections.filter((item: any) => String(item.class_id) === String(filters.class_id)).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>}
      {kind === 'attendance' && <><Field label="Attendance report"><SelectInput value={filters.attendance_mode} onChange={(event) => setFilter({ attendance_mode: event.target.value, student_id: '' })}><option value="daily">Daily class summary</option><option value="monthly">Student monthly sheet</option><option value="history">Student attendance history</option></SelectInput></Field>{filters.attendance_mode === 'daily' ? <Field label="Attendance date"><TextInput type="date" value={filters.date} onChange={(event) => setFilter({ date: event.target.value })} /></Field> : <><Field label="Student"><StudentSelect value={filters.student_id} students={studentsPage?.data || []} onChange={(value) => setFilter({ student_id: value })} /></Field>{filters.attendance_mode === 'monthly' && <Field label="Month"><TextInput type="month" value={filters.month} onChange={(event) => setFilter({ month: event.target.value })} /></Field>}</>}</>}
      {(kind === 'fees' || kind === 'finance') && <><Field label="From"><TextInput type="date" value={filters.from} onChange={(event) => setFilter({ from: event.target.value })} /></Field><Field label="To"><TextInput type="date" value={filters.to} onChange={(event) => setFilter({ to: event.target.value })} /></Field></>}
      {kind === 'award' && <Field label="Exam"><SelectInput value={filters.exam_id || ''} onChange={(event) => setFilter({ exam_id: event.target.value })}><option value="">Select exam</option>{exams.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>}
      {kind === 'certificate' && <><Field label="Student"><StudentSelect value={filters.student_id} students={studentsPage?.data || []} onChange={(value) => setFilter({ student_id: value })} /></Field><Field label="Certificate / document"><SelectInput value={filters.type} onChange={(event) => setFilter({ type: event.target.value })}>{certificateCatalog.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</SelectInput></Field></>}
      <div className="flex items-end gap-2"><Button loading={loading} onClick={() => void run()}>Run report</Button>{result && <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={print}>Print / PDF</Button>}{result && kind !== 'certificate' && <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => exportExcel(exportRows, `${kind}-report`)}>Excel</Button>}</div>
    </div></Card>
    {result && <ReportPreview kind={kind} data={result} search={globalQuery} />}
  </>;
}

function StudentSelect({ value, students, onChange }: { value: string; students: any[]; onChange: (value: string) => void }) { return <SelectInput value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select student</option>{students.map((student: any) => <option key={student.id} value={student.id}>{student.admission_no} · {fullName(student)}</option>)}</SelectInput>; }
function ReportPreview({ kind, data, search }: { kind: ReportKind; data: any; search: string }) { const rows = rowsForExport(kind, data).filter((row) => !search.trim() || Object.values(row).join(' ').toLowerCase().includes(search.trim().toLowerCase())); return <Card className="mt-5 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-800">Report preview</h2><p className="text-sm text-slate-500">Ready to print or export.</p></div>{kind === 'certificate' ? <CertificatePreview data={data} /> : <div className="table-shell rounded-none border-0 shadow-none"><table><thead><tr>{rows[0] && Object.keys(rows[0]).map((key) => <th key={key}>{key.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{Object.values(row).map((value, cell) => <td key={cell}>{String(value ?? '—')}</td>)}</tr>)}{!rows.length && <tr><td className="p-10 text-center text-slate-400">No records were returned.</td></tr>}</tbody></table></div>}</Card>; }
function CertificatePreview({ data }: { data: any }) {
  const layout = data.type === 'id-card' ? 'portrait' : 'landscape';
  return <div className={`overflow-x-auto bg-slate-50 p-4 sm:p-7 ${data.type === 'id-card' ? 'flex justify-center' : ''}`}>
    <div className={data.type === 'id-card' ? '' : 'min-w-[760px]'} dangerouslySetInnerHTML={{ __html: buildCertificate(data, layout) }} />
  </div>;
}
function rowsForExport(kind: ReportKind, data: any): Record<string, unknown>[] { if (!data) return []; if (kind === 'students') return data.rows || []; if (kind === 'attendance') return data.type === 'daily' ? data.data || [] : data.data?.records || []; if (kind === 'fees') return data.outstanding || []; if (kind === 'finance') return [...(data.income || []).map((item: any) => ({ type: 'Income', date: item.income_date, category: item.category, amount: item.amount, description: item.description })), ...(data.expenses || []).map((item: any) => ({ type: 'Expense', date: item.expense_date, category: item.category_name, amount: item.amount, description: item.description }))]; if (kind === 'award') return (data.results || []).map((item: any) => ({ position: item.position, roll_no: item.student.roll_no, student: fullName(item.student), percentage: item.percentage, grade: item.grade, status: item.status })); if (kind === 'timetable') return data.rows || []; return []; }
function reportHtml(kind: ReportKind, data: any) { if (kind === 'certificate') return buildCertificate(data, data.type === 'id-card' ? 'portrait' : 'landscape'); const rows = rowsForExport(kind, data); const headers = rows[0] ? Object.keys(rows[0]) : []; return `<div class="header"><div><h1>${escapeHtml(data.name || 'School ERP')}</h1><p class="muted">${escapeHtml(data.tagline || '')}</p><p class="muted">${escapeHtml(options.find((option) => option.id === kind)?.title || 'Report')}</p></div><div class="right">Generated ${new Date().toLocaleDateString()}</div></div><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header.replace(/_/g, ' '))}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((key) => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
