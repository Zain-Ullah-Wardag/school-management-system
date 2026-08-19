import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Edit3, Eye, Plus, RotateCcw, Search, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMutationToast } from '../../hooks/useMutationToast';
import { useAuth } from '../../context/AuthContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StudentForm } from '../../components/forms/StudentForm';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { SelectInput } from '../../components/common/FormFields';
import { PrerequisiteNotice } from '../../components/common/PrerequisiteNotice';
import { classLabel, fullName } from '../../utils/format';
import type { Student } from '../../types';

type ViewMode = 'active' | 'archived';

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const searched = useDebouncedValue(search);
  const [filters, setFilters] = useState({ class_id: '', section_id: '', status: '' });
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [archiving, setArchiving] = useState<Student | null>(null);
  const [autoPromotion, setAutoPromotion] = useState(false);
  const { can } = useAuth();
  const { query: globalQuery } = useGlobalSearch();

  const { data: classes = [], isLoading: isClassesLoading } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { data: sessions = [] } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const params = {
    page,
    limit: 20,
    search: globalQuery.trim() || searched || undefined,
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    status: viewMode === 'archived' ? 'archived' : filters.status || undefined
  };
  const { data, isLoading } = useQuery({ queryKey: queryKeys.students.list(params), queryFn: () => schoolApi.students.list(params), placeholderData: (previous) => previous });

  const create = useMutationToast((body: any) => schoolApi.students.create(body), { success: 'Student registered successfully', sync: ['students'] });
  const update = useMutationToast(({ id, body }: any) => schoolApi.students.update(id, body), { success: 'Student record updated', sync: ['students'] });
  const archive = useMutationToast((id: number) => schoolApi.students.remove(id), { success: 'Student archived', sync: ['students'], onSuccess: () => setArchiving(null) });
  const restore = useMutationToast((id: number) => schoolApi.students.restore(id), { success: 'Student restored to active records', sync: ['students'] });
  const autoPromote = useMutationToast((body: any) => schoolApi.students.autoPromote(body), { success: 'Class promotion completed', sync: ['students'], onSuccess: () => setAutoPromotion(false) });

  const openEdit = async (student: Student) => {
    const record = await schoolApi.students.get(student.id);
    setEditing(record);
    setFormOpen(true);
  };

  const columns: Column<Student>[] = useMemo(() => [
    {
      key: 'student', header: 'Student', render: (row) => <Link to={`/students/${row.id}`} className="flex items-center gap-3"><Avatar src={row.photo_path} name={fullName(row)} /><span><span className="block font-bold text-slate-800 hover:text-brand-700">{fullName(row)}</span><span className="text-xs text-slate-500">{row.admission_no}</span></span></Link>
    },
    { key: 'class', header: 'Class / roll no.', render: (row) => <span><span className="block font-medium">{classLabel(row)}</span><span className="text-xs text-slate-400">Roll: {row.roll_no || '—'}</span></span> },
    { key: 'gender', header: 'Gender', render: (row) => <span className="capitalize">{row.gender}</span> },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
    {
      key: 'actions', header: '', className: 'w-36 text-right', render: (row) => <div className="flex justify-end gap-1">
        <Link to={`/students/${row.id}`}><button className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700" title="View profile"><Eye className="h-4 w-4" /></button></Link>
        {can('students.manage') && viewMode === 'active' && <><button onClick={() => void openEdit(row)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit"><Edit3 className="h-4 w-4" /></button><button onClick={() => setArchiving(row)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Archive"><Archive className="h-4 w-4" /></button></>}
        {can('students.manage') && viewMode === 'archived' && <button onClick={() => restore.mutate(row.id)} className="rounded-lg p-2 text-brand-600 hover:bg-brand-50" title="Restore"><RotateCcw className="h-4 w-4" /></button>}
      </div>
    }
  ], [can, restore, viewMode]);

  const switchView = (next: ViewMode) => {
    setViewMode(next);
    setPage(1);
    if (next === 'archived') setFilters((current) => ({ ...current, status: '' }));
  };

  return <>
    <PageHeader
      title={viewMode === 'archived' ? 'Archived students' : 'Student management'}
      description={viewMode === 'archived' ? 'Search, review, and restore archived student records without losing history.' : 'Admissions, family contacts, documents, promotions and school records.'}
      actions={can('students.manage') ? <>
        <Button variant={viewMode === 'archived' ? 'outline' : 'ghost'} icon={<Archive className="h-4 w-4" />} onClick={() => switchView(viewMode === 'archived' ? 'active' : 'archived')}>{viewMode === 'archived' ? 'Active students' : 'Archived students'}</Button>
        {viewMode === 'active' && classes.length > 0 && <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setAutoPromotion(true)}>Promote class</Button>}
        {viewMode === 'active' && (classes.length > 0 ? <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => { setEditing(undefined); setFormOpen(true); }}>Register student</Button> : <Link to="/academic"><Button icon={<Plus className="h-4 w-4" />}>Create a class first</Button></Link>)}
      </> : undefined}
    />

    {viewMode === 'active' && !isClassesLoading && classes.length === 0 && <div className="mb-4"><PrerequisiteNotice title="Students need at least one class" description="Create a class and section before registering students, or return to the Dashboard and initialize the complete demo school." actionLabel="Create class" to="/academic" /></div>}

    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-panel lg:flex-row">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="form-control pl-9" placeholder={viewMode === 'archived' ? 'Search archived student records' : 'Search by registration no., name or phone'} /></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <SelectInput value={filters.class_id} onChange={(event) => { setFilters((value) => ({ ...value, class_id: event.target.value, section_id: '' })); setPage(1); }}><option value="">All classes</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput>
        <SelectInput value={filters.section_id} onChange={(event) => { setFilters((value) => ({ ...value, section_id: event.target.value })); setPage(1); }}><option value="">All sections</option>{sections.filter((item: any) => !filters.class_id || String(item.class_id) === filters.class_id).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput>
        <SelectInput disabled={viewMode === 'archived'} value={filters.status} onChange={(event) => { setFilters((value) => ({ ...value, status: event.target.value })); setPage(1); }}><option value="">All statuses</option>{['active', 'inactive', 'left', 'graduated'].map((status) => <option key={status} value={status}>{status}</option>)}</SelectInput>
      </div>
    </div>

    <DataTable columns={columns} rows={data?.data} loading={isLoading} pagination={data?.pagination} onPage={setPage} emptyText={viewMode === 'archived' ? 'No archived students match these filters.' : 'No students match these filters.'} />

    <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(undefined); }} title={editing ? 'Edit student' : 'New student registration'} size="xl">
      <StudentForm student={editing} saving={create.isPending || update.isPending} onCancel={() => { setFormOpen(false); setEditing(undefined); }} onComplete={() => { setFormOpen(false); setEditing(undefined); }} onSubmit={async (values) => editing ? update.mutateAsync({ id: editing.id, body: values }) : create.mutateAsync(values)} />
    </Modal>

    <Modal open={autoPromotion} onClose={() => setAutoPromotion(false)} title="Auto promote a class" size="md"><AutoPromotionForm classes={classes} sections={sections} sessions={sessions} onClose={() => setAutoPromotion(false)} onSave={(body) => autoPromote.mutate(body)} saving={autoPromote.isPending} /></Modal>
    <ConfirmDialog open={Boolean(archiving)} onClose={() => setArchiving(null)} onConfirm={() => archiving && archive.mutate(archiving.id)} loading={archive.isPending} title="Archive student record" confirmLabel="Archive" description={`Archive ${archiving ? fullName(archiving) : 'this student'}? Historical fees, attendance, class tests, and results remain available.`} />
  </>;
}

function AutoPromotionForm({ classes, sections, sessions, onClose, onSave, saving }: { classes: any[]; sections: any[]; sessions: any[]; onClose: () => void; onSave: (body: any) => void; saving: boolean }) {
  return <form onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({ from_class_id: form.get('from_class_id'), from_section_id: form.get('from_section_id') || null, to_class_id: form.get('to_class_id'), to_section_id: form.get('to_section_id') || null, to_session_id: form.get('to_session_id') || null, promotion_type: form.get('promotion_type'), keep_roll_no: form.get('keep_roll_no') === 'on', principal_approved: form.get('principal_approved') === 'on', note: form.get('note') });
  }} className="space-y-4">
    <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">Moves every active student in the selected source class and section into the target class. Review the roster before confirming.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="form-label">Target academic session</span><select name="to_session_id" className="form-control"><option value="">Current session</option>{sessions.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span />
      <label className="block"><span className="form-label">Source class</span><select name="from_class_id" required className="form-control"><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="block"><span className="form-label">Source section</span><select name="from_section_id" className="form-control"><option value="">No / all section</option>{sections.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="block"><span className="form-label">Target class</span><select name="to_class_id" required className="form-control"><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="block"><span className="form-label">Target section</span><select name="to_section_id" className="form-control"><option value="">No / all section</option>{sections.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="block"><span className="form-label">Placement</span><select name="promotion_type" className="form-control"><option value="promoted">Promoted</option><option value="repeated">Repeated</option></select></label>
    </div>
    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="keep_roll_no" /> Keep roll numbers (for repeaters)</label>
    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="principal_approved" /> Principal approval recorded</label>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Process promotions</Button></div>
  </form>;
}
