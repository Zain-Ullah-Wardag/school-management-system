import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArchiveRestore, DatabaseZap, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { schoolApi } from '../../services/schoolApi';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Field, SelectInput, TextInput } from '../common/FormFields';

type FormData = { mode: 'demo_reset' | 'new_year'; confirmation: string; new_session_name: string; starts_on: string; ends_on: string; archive_students: boolean };

export function SchoolResetPanel() {
  const { user } = useAuth();
  const [review, setReview] = useState<FormData | null>(null);
  const [report, setReport] = useState<any>();
  const [phase, setPhase] = useState<'idle' | 'resetting' | 'done'>('idle');
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({ defaultValues: { mode: 'demo_reset', confirmation: '', new_session_name: '', starts_on: '', ends_on: '', archive_students: false } });
  const mode = watch('mode');
  const reset = useMutationToast((body: FormData) => schoolApi.system.reset(body), {
    success: 'School data operation completed safely',
    sync: ['system'],
    onSuccess: (data) => { setReport(data); setPhase('done'); setReview(null); }
  });

  if (user?.role !== 'administrator') return <Card className="border-amber-100 bg-amber-50 p-5"><div className="flex gap-3"><ShieldAlert className="h-6 w-6 text-amber-700" /><div><h2 className="font-bold text-amber-950">Administrator-only operation</h2><p className="mt-1 text-sm text-amber-800">Only the Administrator account can reset demo data or start a new academic year.</p></div></div></Card>;

  const submit = (values: FormData) => {
    if (values.confirmation !== 'RESET SCHOOL DATA') return;
    setReview(values);
  };
  const execute = () => {
    if (!review) return;
    setPhase('resetting');
    reset.mutate(review);
  };

  return <div className="mx-auto max-w-4xl space-y-5">
    <Card className="border-rose-100 bg-rose-50/40 p-5"><div className="flex gap-3"><span className="rounded-xl bg-rose-600 p-2.5 text-white"><AlertTriangle className="h-5 w-5" /></span><div><h2 className="font-bold text-rose-950">School Data Reset / Academic Year Cleanup</h2><p className="mt-1 text-sm leading-6 text-rose-800">This is a destructive administrative operation. A complete SQLite backup is created automatically before any deletion or academic-year cleanup begins.</p></div></div></Card>
    <form onSubmit={handleSubmit(submit)} className="space-y-5"><Field label="Operation mode"><SelectInput {...register('mode')}><option value="demo_reset">Option A — Reset Demo Data to first-install state</option><option value="new_year">Option B — Archive & Start New Academic Year</option></SelectInput></Field>
      {mode === 'demo_reset' ? <Card className="p-5"><h3 className="font-bold text-slate-800">Reset Demo Data</h3><p className="mt-2 text-sm leading-6 text-slate-600">Removes sample students, staff, classes, attendance, invoices, payments, exams, results, timetable entries, SMS logs, visitor records, uploads, and demo accounts. It preserves the Administrator account, school branding, settings, roles, and permissions, then restores clean default master setup.</p></Card> : <Card className="p-5"><h3 className="font-bold text-slate-800">Start New Academic Year</h3><p className="mt-2 text-sm leading-6 text-slate-600">Creates a backup, clears operational records, closes the current session, and creates a new current session. Users, settings, branding, staff, and academic configuration remain available.</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="New session name"><TextInput placeholder="2027-2028" {...register('new_session_name')} /></Field><Field label="Starts on"><TextInput type="date" {...register('starts_on')} /></Field><Field label="Ends on"><TextInput type="date" {...register('ends_on')} /></Field></div><label className="mt-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" {...register('archive_students')} /> Archive active students after closing their current enrollments</label></Card>}
      <Card className="p-5"><Field label="Destructive action confirmation" error={errors.confirmation?.message}><TextInput placeholder="Type RESET SCHOOL DATA" {...register('confirmation', { validate: (value) => value === 'RESET SCHOOL DATA' || 'Type RESET SCHOOL DATA exactly to continue' })} /></Field><p className="mt-3 text-xs leading-5 text-slate-500">Recovery: download the automatically created backup from Settings → Backup & restore. Restore it to recover the exact pre-reset database.</p></Card>
      {phase !== 'idle' && <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900"><b>{phase === 'resetting' ? 'Creating backup and cleaning school data…' : 'Operation complete.'}</b><div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100"><div className={`h-full bg-brand-600 transition-all ${phase === 'resetting' ? 'w-2/3' : 'w-full'}`} /></div></div>}
      <div className="flex justify-end"><Button type="submit" variant="danger" icon={<DatabaseZap className="h-4 w-4" />}>Review destructive operation</Button></div>
    </form>
    {report && <Card className="border-brand-100 bg-brand-50/30 p-5"><div className="flex gap-3"><ArchiveRestore className="h-6 w-6 text-brand-700" /><div><h3 className="font-bold text-brand-950">Success report</h3><p className="mt-1 text-sm text-brand-800">Backup: <b>{report.backup?.file_name}</b></p><p className="text-sm text-brand-800">Before: {JSON.stringify(report.before)}<br />After: {JSON.stringify(report.after)}</p><p className="mt-2 text-xs text-brand-700">{report.recovery}</p></div></div></Card>}
    <ConfirmDialog open={Boolean(review)} onClose={() => setReview(null)} onConfirm={execute} loading={reset.isPending} title="Final confirmation: destructive operation" confirmLabel={review?.mode === 'demo_reset' ? 'Reset demo data' : 'Start new academic year'} description={review?.mode === 'demo_reset' ? 'A backup will be created, then all demo and operational data will be removed. This cannot be undone without restoring the backup.' : 'A backup will be created, current operational records will be cleared, and a new academic session will be created.'} />
  </div>;
}
