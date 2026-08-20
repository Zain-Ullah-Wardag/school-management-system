import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Edit3, Plus, Printer, Settings2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { schoolApi } from '../../services/schoolApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Field, SelectInput, TextInput } from '../../components/common/FormFields';
import { PrerequisiteNotice } from '../../components/common/PrerequisiteNotice';
import { useToast } from '../../context/ToastContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { apiError } from '../../services/api';
import { escapeHtml, printHtml } from '../../utils/print';
import { queryKeys } from '../../services/queryKeys';
import { useDataSync } from '../../hooks/useDataSync';

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Entry = Record<string, any>;

export default function TimetablePage() {
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [editor, setEditor] = useState<Entry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const synchronize = useDataSync();
  const { toast } = useToast();
  const { query: globalQuery } = useGlobalSearch();

  const { data: classes = [], isLoading: isClassesLoading } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [], isLoading: isSectionsLoading } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { data: sessions = [], isLoading: isSessionsLoading } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const { data: subjects = [], isLoading: isSubjectsLoading } = useQuery({ queryKey: queryKeys.academic.subjects(), queryFn: schoolApi.academic.subjects });
  const { data: staff = [], isLoading: isStaffLoading } = useQuery({ queryKey: queryKeys.staff.options, queryFn: schoolApi.staff.options });
  const { data: rooms = [], isLoading: isRoomsLoading } = useQuery({ queryKey: queryKeys.academic.rooms, queryFn: schoolApi.academic.rooms });
  const { data: timetableSettings, isLoading: isTimetableSettingsLoading } = useQuery({ queryKey: queryKeys.timetable.settings, queryFn: schoolApi.timetable.settings });

  const params = { class_id: classId, section_id: sectionId || undefined, session_id: sessionId || undefined };
  const { data: entries = [] } = useQuery({
    queryKey: queryKeys.timetable.entries(params),
    queryFn: () => schoolApi.timetable.entries(params),
    enabled: Boolean(classId)
  });

  const isSetupLoading = isClassesLoading || isSectionsLoading || isSessionsLoading || isSubjectsLoading || isStaffLoading || isRoomsLoading || isTimetableSettingsLoading;
  const periods = timetableSettings?.periods || [];
  const days = (timetableSettings?.school_days || []).filter((day: any) => day.is_school_day);
  const canPlanLessons = classes.length > 0 && subjects.length > 0 && staff.length > 0 && rooms.length > 0;
  const filteredEntries = useMemo(() => { const search = globalQuery.trim().toLowerCase(); return !search ? entries : entries.filter((entry: any) => `${entry.subject_name || ''} ${entry.teacher_name || ''} ${entry.room_name || ''} ${entry.period_name || ''}`.toLowerCase().includes(search)); }, [entries, globalQuery]);
  const entryMap = useMemo(() => new Map(filteredEntries.map((entry: any) => [`${entry.weekday}-${entry.period_id}`, entry])), [filteredEntries]);
  const refreshEntries = () => synchronize(['timetable']);

  const newEntry = (weekday: number, periodId: number) => {
    setEditor({ class_id: classId, section_id: sectionId, session_id: sessionId, weekday, period_id: periodId });
  };

  const printTimetable = async () => {
    if (!classId) return;
    try {
      const report = await schoolApi.reports.timetable(params);
      const className = classes.find((item: any) => String(item.id) === classId)?.name || '';
      const rows = periods.map((period: any) => {
        const cells = days.map((day: any) => {
          const item = (report.rows || []).find((entry: any) => entry.sequence === period.sequence && entry.weekday === day.weekday);
          return `<td>${item ? `<strong>${escapeHtml(item.subject_name || '')}</strong><br/><small>${escapeHtml(item.teacher_name || '')}${item.room_name ? ` · ${escapeHtml(item.room_name)}` : ''}</small>` : '—'}</td>`;
        }).join('');
        return `<tr><td><strong>${escapeHtml(period.name)}</strong><br/><small>${escapeHtml(period.start_time)}–${escapeHtml(period.end_time)}</small></td>${cells}</tr>`;
      }).join('');
      printHtml(`<div class="header"><div><h1>${escapeHtml(report.name || 'School')}</h1><p class="muted">Class timetable</p></div><div class="right"><strong>${escapeHtml(className)}</strong></div></div><table><thead><tr><th>Period</th>${days.map((day: any) => `<th>${escapeHtml(weekdayNames[day.weekday])}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`, 'class-timetable', 'landscape');
    } catch (error) {
      toast('error', 'Could not prepare timetable', apiError(error));
    }
  };

  return <>
    <PageHeader
      title="Timetable"
      description="Design weekly schedules with periods, breaks, subject teachers and rooms."
      actions={<>
        <Button variant="outline" icon={<Settings2 className="h-4 w-4" />} onClick={() => setSettingsOpen(true)}>Configure periods</Button>
        <Button variant="outline" icon={<Printer className="h-4 w-4" />} disabled={!classId} onClick={() => void printTimetable()}>Print timetable</Button>
        <Button icon={<Plus className="h-4 w-4" />} disabled={!classId || !canPlanLessons} onClick={() => newEntry(days[0]?.weekday || 1, periods.find((period: any) => period.period_type === 'lesson')?.id || '')}>Add lesson</Button>
      </>}
    />

    <div className="mb-4 space-y-3">
      {!isSetupLoading && classes.length === 0 && <PrerequisiteNotice title="Timetables need classes" description="Create at least one class and section before building a timetable, or initialize the demo school from the Dashboard." actionLabel="Create classes" to="/academic" />}
      {!isSetupLoading && classes.length > 0 && subjects.length === 0 && <PrerequisiteNotice title="Timetables need subjects" description="Add subjects and assign them to classes before creating lessons." actionLabel="Manage subjects" to="/academic" />}
      {!isSetupLoading && classes.length > 0 && staff.length === 0 && <PrerequisiteNotice title="Timetables need teachers" description="Create staff teacher records before assigning lessons." actionLabel="Add teachers" to="/staff" />}
      {!isSetupLoading && classes.length > 0 && rooms.length === 0 && <PrerequisiteNotice title="Timetables need rooms" description="Create classrooms or labs before scheduling lessons." actionLabel="Manage rooms" to="/academic" />}
    </div>
    <Card className="mb-4 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Academic session"><SelectInput value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Current session</option>{sessions.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="Class"><SelectInput value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(''); }}><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="Section"><SelectInput value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">All / no section</option>{sections.filter((item: any) => !classId || String(item.class_id) === classId).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
      </div>
    </Card>

    {isSetupLoading ? <Card className="p-14 text-center"><p className="text-sm font-semibold text-slate-500">Loading timetable setup…</p></Card> : !classId ? <Card className="p-14 text-center"><Clock3 className="mx-auto h-9 w-9 text-brand-500" /><p className="mt-3 font-semibold text-slate-700">Select a class to view or create its timetable.</p></Card> :
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-panel">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead><tr className="bg-slate-50"><th className="w-40 border-b border-r border-slate-100 p-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Period</th>{days.map((day: any) => <th key={day.weekday} className="border-b border-slate-100 p-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{weekdayNames[day.weekday]}</th>)}</tr></thead>
          <tbody>{periods.map((period: any) => <tr key={period.id}>
            <td className="border-b border-r border-slate-100 bg-slate-50/50 p-3"><p className="font-bold text-slate-700">{period.name}</p><p className="text-xs text-slate-400">{period.start_time} – {period.end_time}</p></td>
            {days.map((day: any) => {
              const item = entryMap.get(`${day.weekday}-${period.id}`) as any;
              if (period.period_type !== 'lesson') return <td key={day.weekday} className="border-b border-slate-100 p-1.5"><div className="rounded-xl bg-amber-50 px-3 py-4 text-center text-xs font-bold uppercase tracking-wide text-amber-700">{period.name}</div></td>;
              return <td key={day.weekday} className="border-b border-slate-100 p-1.5">
                <button disabled={!item && !canPlanLessons} onClick={() => item ? setEditor(item) : canPlanLessons && newEntry(day.weekday, period.id)} className={`min-h-20 w-full rounded-xl p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${item ? 'bg-brand-50 hover:bg-brand-100' : 'border border-dashed border-slate-200 text-slate-400 hover:border-brand-300 hover:bg-brand-50'}`}>
                  {item ? <><p className="font-bold text-brand-900">{item.subject_name || 'Unassigned'}</p><p className="mt-1 text-xs text-brand-700">{item.teacher_name || 'Teacher pending'}</p><p className="mt-1 text-[11px] text-brand-600">{item.room_name || ''}</p></> : <span className="inline-flex items-center gap-1 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Add lesson</span>}
                </button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>}

    <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.id ? 'Edit timetable entry' : 'Add timetable entry'} size="md">
      {editor && <EntryEditor entry={editor} subjects={subjects} staff={staff} rooms={rooms} onClose={() => setEditor(null)} onSaved={async (values) => {
        try { await schoolApi.timetable.saveEntry(values, editor.id); await refreshEntries(); setEditor(null); toast('success', 'Timetable entry saved'); }
        catch (error) { toast('error', 'Could not save timetable entry', apiError(error)); }
      }} onDelete={editor.id ? async () => {
        try { await schoolApi.timetable.deleteEntry(editor.id); await refreshEntries(); setEditor(null); toast('success', 'Timetable entry deleted'); }
        catch (error) { toast('error', 'Could not delete entry', apiError(error)); }
      } : undefined} />}
    </Modal>
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Timetable periods & school days" size="lg">
      <TimetableSettings settings={timetableSettings} onChanged={() => synchronize(['timetable'])} />
    </Modal>
  </>;
}

function EntryEditor({ entry, subjects, staff, rooms, onClose, onSaved, onDelete }: { entry: any; subjects: any[]; staff: any[]; rooms: any[]; onClose: () => void; onSaved: (data: any) => void; onDelete?: () => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: entry });
  return <form onSubmit={handleSubmit(onSaved)} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Subject"><SelectInput {...register('subject_id')}><option value="">Select subject</option>{subjects.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
      <Field label="Teacher"><SelectInput {...register('teacher_id')}><option value="">Select teacher</option>{staff.map((item: any) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name || ''}</option>)}</SelectInput></Field>
      <Field label="Room"><SelectInput {...register('room_id')}><option value="">No room</option>{rooms.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
      <Field label="Note"><TextInput {...register('note')} /></Field>
    </div>
    {['session_id', 'class_id', 'section_id', 'weekday', 'period_id'].map((key) => <input key={key} type="hidden" {...register(key)} />)}
    <div className="flex justify-between gap-2"><div>{onDelete && <Button type="button" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>Delete</Button>}</div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save entry</Button></div></div>
  </form>;
}

function TimetableSettings({ settings, onChanged }: { settings: any; onChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<any>();
  const periods = settings?.periods || [];
  const days = settings?.school_days || [];
  const { register, handleSubmit } = useForm<any>({ defaultValues: settings?.settings });
  const saveDuration = async (values: any) => {
    try {
      await schoolApi.timetable.saveSettings({
        ...values,
        days,
        school_days: days.filter((item: any) => item.is_school_day).map((item: any) => item.weekday),
        default_period_minutes: Number(values.default_period_minutes)
      });
      await onChanged();
      toast('success', 'Lesson duration saved and period times updated');
    }
    catch (error) { toast('error', 'Could not save settings', apiError(error)); }
  };
  const toggleDay = async (day: any, checked: boolean) => {
    const updated = days.map((item: any) => item.weekday === day.weekday ? { ...item, is_school_day: checked ? 1 : 0 } : item);
    try {
      await schoolApi.timetable.saveSettings({ days: updated, school_days: updated.filter((item: any) => item.is_school_day).map((item: any) => item.weekday), default_period_minutes: settings?.settings?.default_period_minutes || 40 });
      await onChanged();
    } catch (error) { toast('error', 'Could not update school day', apiError(error)); }
  };
  return <div className="space-y-5">
    <form onSubmit={handleSubmit(saveDuration)} className="flex flex-wrap items-end gap-3"><Field label="Default lesson duration (minutes)"><TextInput type="number" {...register('default_period_minutes')} /></Field><Button type="submit">Save duration</Button></form>
    <div><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-800">Periods</h3><Button className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setPeriod({ sequence: (periods[periods.length - 1]?.sequence || 0) + 1, period_type: 'lesson' })}>Add period</Button></div><div className="space-y-2">{periods.map((item: any) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><span><b>{item.sequence}. {item.name}</b><small className="ml-2 text-slate-400">{item.start_time}–{item.end_time} · {item.period_type}</small></span><button onClick={() => setPeriod(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><Edit3 className="h-4 w-4" /></button></div>)}</div></div>
    <div><h3 className="mb-3 font-bold text-slate-800">School days</h3><div className="grid gap-2 sm:grid-cols-2">{days.map((day: any) => <label key={day.weekday} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"><span>{weekdayNames[day.weekday]}</span><input type="checkbox" checked={Boolean(day.is_school_day)} onChange={(event) => void toggleDay(day, event.target.checked)} /></label>)}</div></div>
    <Modal open={Boolean(period)} onClose={() => setPeriod(null)} title="Timetable period" size="sm">{period && <PeriodForm period={period} onClose={() => setPeriod(null)} onSaved={async (values) => { try { await schoolApi.timetable.savePeriod(values, period.id); await onChanged(); setPeriod(null); toast('success', 'Period saved'); } catch (error) { toast('error', 'Could not save period', apiError(error)); } }} />}</Modal>
  </div>;
}

function PeriodForm({ period, onClose, onSaved }: { period: any; onClose: () => void; onSaved: (values: any) => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: period });
  return <form onSubmit={handleSubmit(onSaved)} className="space-y-4">
    <Field label="Period name"><TextInput {...register('name', { required: true })} /></Field>
    <div className="grid grid-cols-3 gap-3"><Field label="Sequence"><TextInput type="number" {...register('sequence', { required: true })} /></Field><Field label="Start"><TextInput type="time" {...register('start_time', { required: true })} /></Field><Field label="End"><TextInput type="time" {...register('end_time', { required: true })} /></Field></div>
    <Field label="Type"><SelectInput {...register('period_type')}><option value="lesson">Lesson</option><option value="break">Break</option><option value="assembly">Assembly</option><option value="other">Other</option></SelectInput></Field>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save period</Button></div>
  </form>;
}
