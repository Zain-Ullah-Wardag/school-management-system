import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { DataTable } from '../common/DataTable';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Field, SelectInput, TextInput } from '../common/FormFields';
import { Badge } from '../common/Badge';
import { money } from '../../utils/format';

export function FeeStructuresPanel() {
  const [classFilter, setClassFilter] = useState('');
  const [editor, setEditor] = useState<any>();
  const [remove, setRemove] = useState<any>();
  const { data = [], isLoading } = useQuery({ queryKey: queryKeys.fees.structures(classFilter), queryFn: () => schoolApi.fees.structures(classFilter ? { class_id: classFilter } : undefined) });
  const { data: classes = [] } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { data: sessions = [] } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const { data: heads = [] } = useQuery({ queryKey: queryKeys.fees.heads, queryFn: schoolApi.fees.heads });
  const save = useMutationToast(({ body, id }: any) => schoolApi.fees.saveStructure(body, id), { success: 'Fee structure saved', sync: ['fees'], onSuccess: () => setEditor(null) });
  const deleteItem = useMutationToast((id: number) => schoolApi.fees.deleteStructure(id), { success: 'Fee structure deleted', sync: ['fees'], onSuccess: () => setRemove(null) });

  return <>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SelectInput className="w-full sm:w-64" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">All classes</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput>
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ class_id: classFilter || '' })}>Add fee structure</Button>
    </div>
    <DataTable loading={isLoading} rows={data} columns={[
      { key: 'class', header: 'Class', render: (row: any) => `${row.class_name}${row.section_name ? ` · ${row.section_name}` : ''}` },
      { key: 'head', header: 'Fee head', render: (row: any) => row.fee_head_name },
      { key: 'amount', header: 'Amount', render: (row: any) => money(row.amount) },
      { key: 'frequency', header: 'Frequency', render: (row: any) => <span className="capitalize">{row.frequency}</span> },
      { key: 'due', header: 'Due day', render: (row: any) => row.due_day || '—' },
      { key: 'status', header: 'Status', render: (row: any) => <Badge value={row.status} /> },
      { key: 'actions', header: '', className: 'w-24 text-right', render: (row: any) => <><button onClick={() => setEditor(row)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700"><Edit3 className="h-4 w-4" /></button><button onClick={() => setRemove(row)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></> }
    ]} />
    <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.id ? 'Edit fee structure' : 'Add fee structure'} size="md">{editor && <StructureForm item={editor} classes={classes} sections={sections} sessions={sessions} heads={heads} onClose={() => setEditor(null)} onSaved={(body) => save.mutate({ body, id: editor.id })} />}</Modal>
    <ConfirmDialog open={Boolean(remove)} onClose={() => setRemove(null)} onConfirm={() => remove && deleteItem.mutate(remove.id)} loading={deleteItem.isPending} description="Delete this fee structure? Existing invoices are not changed." />
  </>;
}

function StructureForm({ item, classes, sections, sessions, heads, onClose, onSaved }: { item: any; classes: any[]; sections: any[]; sessions: any[]; heads: any[]; onClose: () => void; onSaved: (data: any) => void }) {
  const { register, handleSubmit, watch } = useForm<any>({ defaultValues: { frequency: 'monthly', status: 'active', ...item } });
  const classId = watch('class_id');
  const validSections = classId ? sections.filter((section: any) => String(section.class_id) === String(classId)) : [];
  return <form onSubmit={handleSubmit(onSaved)} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Session"><SelectInput {...register('session_id')}><option value="">Current session</option>{sessions.map((session: any) => <option key={session.id} value={session.id}>{session.name}</option>)}</SelectInput></Field><Field label="Class"><SelectInput {...register('class_id', { required: true })}><option value="">Select class</option>{classes.map((schoolClass: any) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</SelectInput></Field><Field label="Section"><SelectInput disabled={!classId} {...register('section_id')}><option value="">{classId ? 'No / all section' : 'Select class first'}</option>{validSections.map((section: any) => <option key={section.id} value={section.id}>{section.name}</option>)}</SelectInput></Field><Field label="Fee head"><SelectInput {...register('fee_head_id', { required: true })}><option value="">Select fee head</option>{heads.filter((head: any) => head.status === 'active').map((head: any) => <option key={head.id} value={head.id}>{head.name}</option>)}</SelectInput></Field><Field label="Amount (PKR)"><TextInput type="number" min="0" {...register('amount', { required: true })} /></Field><Field label="Frequency"><SelectInput {...register('frequency')}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="one_time">One time</option></SelectInput></Field><Field label="Due day"><TextInput type="number" min="1" max="31" {...register('due_day')} /></Field><Field label="Status"><SelectInput {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></SelectInput></Field></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save structure</Button></div></form>;
}
