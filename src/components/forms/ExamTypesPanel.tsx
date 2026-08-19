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

export function ExamTypesPanel() {
  const [editor, setEditor] = useState<any>(); const [remove, setRemove] = useState<any>();
  const { data = [], isLoading } = useQuery({ queryKey: queryKeys.academic.examTypes, queryFn: schoolApi.academic.examTypes });
  const save = useMutationToast(({ body, id }: any) => schoolApi.academic.saveExamType(body, id), { success: 'Exam type saved', sync: ['academic'], onSuccess: () => setEditor(null) });
  const deleteType = useMutationToast((id: number) => schoolApi.academic.deleteExamType(id), { success: 'Exam type deleted', sync: ['academic'], onSuccess: () => setRemove(null) });
  return <><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold text-slate-800">Exam types</h3><p className="text-xs text-slate-500">Mid, final and custom exam classifications are fully editable.</p></div><Button className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ default_weight: 75, status: 'active' })}>Add type</Button></div><DataTable loading={isLoading} rows={data} columns={[{ key: 'name', header: 'Exam type', render: (row: any) => <span><b>{row.name}</b><small className="block text-slate-400">{row.code}</small></span> }, { key: 'weight', header: 'Exam weight', render: (row: any) => `${row.default_weight}%` }, { key: 'status', header: 'Status', render: (row: any) => <Badge value={row.status} /> }, { key: 'actions', header: '', className: 'w-24 text-right', render: (row: any) => <><button onClick={() => setEditor(row)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700"><Edit3 className="h-4 w-4" /></button><button onClick={() => setRemove(row)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></> }]} /><Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.id ? 'Edit exam type' : 'Add exam type'} size="sm">{editor && <ExamTypeForm item={editor} onClose={() => setEditor(null)} onSave={(body) => save.mutate({ body, id: editor.id })} />}</Modal><ConfirmDialog open={Boolean(remove)} onClose={() => setRemove(null)} onConfirm={() => remove && deleteType.mutate(remove.id)} loading={deleteType.isPending} description="Delete this exam type? It must not be used by existing exams." /></>;
}
function ExamTypeForm({ item, onClose, onSave }: { item: any; onClose: () => void; onSave: (data: any) => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: item });
  return <form onSubmit={handleSubmit(onSave)} className="space-y-4"><Field label="Type name"><TextInput {...register('name', { required: true })} /></Field><Field label="Code"><TextInput {...register('code', { required: true })} /></Field><Field label="Default exam weight"><TextInput type="number" min="0" max="100" {...register('default_weight')} /></Field><Field label="Status"><SelectInput {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></SelectInput></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save type</Button></div></form>;
}
