import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { schoolApi } from '../../services/schoolApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Field, SelectInput, TextInput } from '../../components/common/FormFields';
import { Tabs } from '../../components/common/Tabs';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { apiError } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import { useDataSync } from '../../hooks/useDataSync';
import { academicActionLabel, academicEditorTitle, academicTabConfig, academicTabs, type AcademicTab } from '../../utils/academic';

type Tab = AcademicTab;
type Editor = { tab: Tab; item?: any } | null;

export default function AcademicPage() {
  const [tab, setTab] = useState<Tab>('classes');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editor, setEditor] = useState<Editor>(null);
  const [removing, setRemoving] = useState<Editor>(null);
  const synchronize = useDataSync();
  const { toast } = useToast();
  const { query: globalQuery } = useGlobalSearch();

  const { data: classes = [], isLoading: classesLoading } = useQuery({ queryKey: queryKeys.academic.classes({ all: 'true' }), queryFn: () => schoolApi.academic.classes({ all: 'true' }) });
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({ queryKey: queryKeys.academic.subjects({ all: 'true' }), queryFn: () => schoolApi.academic.subjects({ all: 'true' }) });
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({ queryKey: queryKeys.academic.assignments, queryFn: schoolApi.academic.classSubjects });
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({ queryKey: queryKeys.academic.rooms, queryFn: schoolApi.academic.rooms });
  const { data: staff = [] } = useQuery({ queryKey: queryKeys.staff.options, queryFn: schoolApi.staff.options });

  const datasets: Record<Tab, any[]> = { classes, sections, subjects, assignments, sessions, rooms };
  const loadingByTab: Record<Tab, boolean> = {
    classes: classesLoading,
    sections: sectionsLoading,
    subjects: subjectsLoading,
    assignments: assignmentsLoading,
    sessions: sessionsLoading,
    rooms: roomsLoading
  };
  const refresh = () => synchronize(['academic']);
  const activeTab = academicTabConfig(tab);
  const filteredRows = useMemo(() => datasets[tab].filter((row) => {
    const text = Object.values(row).join(' ').toLowerCase();
    const activeSearch = globalQuery.trim() || search.trim();
    const matchesSearch = !activeSearch || text.includes(activeSearch.toLowerCase());
    const matchesClass = !classFilter || (tab === 'sections' ? String(row.class_id) === classFilter : tab === 'assignments' ? String(row.class_id) === classFilter : true);
    const matchesStatus = !statusFilter || String(row.status || '') === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  }), [datasets, tab, search, globalQuery, classFilter, statusFilter]);

  const save = async (values: any, target: Editor) => {
    if (!target) return;
    try {
      if (target.tab === 'classes') await schoolApi.academic.saveClass(values, target.item?.id);
      if (target.tab === 'sections') await schoolApi.academic.saveSection(values, target.item?.id);
      if (target.tab === 'subjects') await schoolApi.academic.saveSubject(values, target.item?.id);
      if (target.tab === 'assignments') await schoolApi.academic.saveClassSubject(values, target.item?.id);
      if (target.tab === 'sessions') await schoolApi.academic.saveSession(values, target.item?.id);
      if (target.tab === 'rooms') await schoolApi.academic.saveRoom(values, target.item?.id);
      await refresh();
      setEditor(null);
      toast('success', `${academicTabConfig(target.tab).label} saved`);
    } catch (error) { toast('error', 'Could not save record', apiError(error)); }
  };

  const remove = async () => {
    if (!removing?.item) return;
    try {
      if (removing.tab === 'classes') await schoolApi.academic.deleteClass(removing.item.id);
      if (removing.tab === 'sections') await schoolApi.academic.deleteSection(removing.item.id);
      if (removing.tab === 'subjects') await schoolApi.academic.deleteSubject(removing.item.id);
      if (removing.tab === 'assignments') await schoolApi.academic.deleteClassSubject(removing.item.id);
      if (removing.tab === 'rooms') await schoolApi.academic.deleteRoom(removing.item.id);
      await refresh();
      setRemoving(null);
      toast('success', `${academicTabConfig(removing.tab).label} deleted`);
    } catch (error) { toast('error', 'Record could not be deleted', apiError(error)); }
  };

  return <>
    <PageHeader title="Academic setup" description="Build the school's classes, sections, subjects, staff allocations and academic calendar." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ tab })}>{academicActionLabel(tab)}</Button>} />
    <Tabs tabs={academicTabs.map((item) => ({ id: item.id, label: item.label, count: datasets[item.id].length }))} value={tab} onChange={(next) => { setTab(next); setSearch(''); setClassFilter(''); setStatusFilter(''); }} />
    <div className="mb-4 grid gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-panel lg:grid-cols-[1fr_220px_180px]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeTab.label.toLowerCase()}…`} /></div>
      {(tab === 'sections' || tab === 'assignments') ? <SelectInput value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">All classes</option>{classes.map((schoolClass: any) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</SelectInput> : <span />}
      {['classes', 'sections', 'subjects', 'rooms', 'sessions'].includes(tab) ? <SelectInput value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>{tab === 'sessions' && <><option value="planned">Planned</option><option value="closed">Closed</option></>}</SelectInput> : <span />}
    </div>
    <DataTable loading={loadingByTab[tab]} columns={columnsFor(tab, (item) => setEditor({ tab, item }), (item) => setRemoving({ tab, item }))} rows={filteredRows} emptyText={`No ${activeTab.label.toLowerCase()} match these filters.`} />
    <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor ? academicEditorTitle(editor.tab, Boolean(editor.item)) : ''} size="md">{editor && <AcademicEditor tab={editor.tab} item={editor.item} classes={classes} sections={sections} subjects={subjects} staff={staff} onClose={() => setEditor(null)} onSaved={(values) => void save(values, editor)} />}</Modal>
    <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={() => void remove()} title="Delete academic record" confirmLabel="Delete" description={`Delete this ${removing ? academicTabConfig(removing.tab).singular.toLowerCase() : 'record'}? Records with operational history are protected.`} />
  </>;
}

function columnsFor(tab: Tab, onEdit: (item: any) => void, onRemove: (item: any) => void): Column<any>[] {
  const actions: Column<any> = { key: 'actions', header: '', className: 'w-24 text-right', render: (row) => <span className="inline-flex"><button onClick={() => onEdit(row)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700"><Edit3 className="h-4 w-4" /></button>{tab !== 'sessions' && <button onClick={() => onRemove(row)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</span> };
  if (tab === 'classes') return [{ key: 'code', header: 'Code', render: (row) => <b>{row.code}</b> }, { key: 'name', header: 'Class', render: (row) => <span>{row.name}<small className="ml-2 text-slate-400">{row.name_ur}</small></span> }, { key: 'sections', header: 'Sections', render: (row) => row.section_count || 0 }, { key: 'students', header: 'Active students', render: (row) => row.student_count || 0 }, { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> }, actions];
  if (tab === 'sections') return [{ key: 'class', header: 'Class', render: (row) => row.class_name }, { key: 'name', header: 'Section', render: (row) => <b>{row.name}</b> }, { key: 'teacher', header: 'Class teacher', render: (row) => row.class_teacher_name || '—' }, { key: 'capacity', header: 'Capacity', render: (row) => row.capacity || '—' }, { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> }, actions];
  if (tab === 'subjects') return [{ key: 'code', header: 'Code', render: (row) => <b>{row.code}</b> }, { key: 'name', header: 'Subject', render: (row) => row.name }, { key: 'marks', header: 'Marks', render: (row) => `${row.pass_marks} / ${row.max_marks}` }, { key: 'classes', header: 'Classes', render: (row) => row.class_count || 0 }, { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> }, actions];
  if (tab === 'assignments') return [{ key: 'class', header: 'Class', render: (row) => `${row.class_name}${row.section_name ? ` · ${row.section_name}` : ''}` }, { key: 'subject', header: 'Subject', render: (row) => row.subject_name }, { key: 'teacher', header: 'Teacher', render: (row) => row.teacher_name || 'Not assigned' }, { key: 'weekly', header: 'Periods / week', render: (row) => row.weekly_periods }, actions];
  if (tab === 'sessions') return [{ key: 'name', header: 'Session', render: (row) => <b>{row.name}</b> }, { key: 'starts', header: 'Starts', render: (row) => row.starts_on }, { key: 'ends', header: 'Ends', render: (row) => row.ends_on }, { key: 'current', header: 'Current', render: (row) => row.is_current ? <Badge value="active">Current</Badge> : '—' }, { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> }, actions];
  return [{ key: 'name', header: 'Room', render: (row) => <b>{row.name}</b> }, { key: 'capacity', header: 'Capacity', render: (row) => row.capacity || '—' }, { key: 'description', header: 'Description', render: (row) => row.description || '—' }, { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> }, actions];
}

function AcademicEditor({ tab, item, classes, sections, subjects, staff, onClose, onSaved }: { tab: Tab; item?: any; classes: any[]; sections: any[]; subjects: any[]; staff: any[]; onClose: () => void; onSaved: (values: any) => void }) {
  const { register, handleSubmit, watch } = useForm<any>({ defaultValues: { status: 'active', display_order: 0, weekly_periods: 1, max_marks: 100, pass_marks: 40, capacity: '', ...item } });
  const selectedClass = watch('class_id');
  const SelectField = ({ name, label, options }: { name: string; label: string; options: any[] }) => <Field label={label}><SelectInput {...register(name)}><option value="">Select {label}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name || `${option.first_name} ${option.last_name || ''}`}</option>)}</SelectInput></Field>;
  return <form onSubmit={handleSubmit(onSaved)} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    {tab === 'classes' && <><Field label="Class code"><TextInput {...register('code', { required: true })} /></Field><Field label="Class name"><TextInput {...register('name', { required: true })} /></Field><Field label="Urdu name"><TextInput {...register('name_ur')} /></Field><Field label="Display order"><TextInput type="number" {...register('display_order')} /></Field><SelectField name="head_teacher_id" label="Head teacher" options={staff} /></>}
    {tab === 'sections' && <><SelectField name="class_id" label="Class" options={classes} /><Field label="Section name"><TextInput {...register('name', { required: true })} /></Field><Field label="Capacity"><TextInput type="number" {...register('capacity')} /></Field><SelectField name="class_teacher_id" label="Class teacher" options={staff} /><Field label="Room / location"><TextInput {...register('room')} /></Field></>}
    {tab === 'subjects' && <><Field label="Subject code"><TextInput {...register('code', { required: true })} /></Field><Field label="Subject name"><TextInput {...register('name', { required: true })} /></Field><Field label="Urdu name"><TextInput {...register('name_ur')} /></Field><Field label="Maximum marks"><TextInput type="number" {...register('max_marks')} /></Field><Field label="Passing marks"><TextInput type="number" {...register('pass_marks')} /></Field></>}
    {tab === 'assignments' && <><SelectField name="class_id" label="Class" options={classes} /><SelectField name="section_id" label="Section" options={selectedClass ? sections.filter((section: any) => String(section.class_id) === String(selectedClass)) : []} /><SelectField name="subject_id" label="Subject" options={subjects} /><SelectField name="teacher_id" label="Teacher" options={staff} /><Field label="Periods per week"><TextInput type="number" {...register('weekly_periods')} /></Field></>}
    {tab === 'sessions' && <><Field label="Session name"><TextInput {...register('name', { required: true })} /></Field><Field label="Start date"><TextInput type="date" {...register('starts_on', { required: true })} /></Field><Field label="End date"><TextInput type="date" {...register('ends_on', { required: true })} /></Field><Field label="Status"><SelectInput {...register('status')}><option value="active">Active</option><option value="planned">Planned</option><option value="closed">Closed</option></SelectInput></Field><label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" {...register('is_current')} /> Make this the current session</label></>}
    {tab === 'rooms' && <><Field label="Room name"><TextInput {...register('name', { required: true })} /></Field><Field label="Capacity"><TextInput type="number" {...register('capacity')} /></Field><Field label="Description"><TextInput {...register('description')} /></Field></>}
  </div>{tab !== 'sessions' && <Field label="Status"><SelectInput {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></SelectInput></Field>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form>;
}
