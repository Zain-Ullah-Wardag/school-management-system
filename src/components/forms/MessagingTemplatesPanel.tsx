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
import { Field, SelectInput, TextArea, TextInput } from '../common/FormFields';
import { Badge } from '../common/Badge';

export function MessagingTemplatesPanel() {
  const [editor, setEditor] = useState<any>();
  const [removing, setRemoving] = useState<any>();
  const { data: templates = [], isLoading } = useQuery({ queryKey: queryKeys.messaging.templates, queryFn: schoolApi.messaging.templates });
  const save = useMutationToast(({ body, id }: any) => schoolApi.messaging.saveTemplate(body, id), { success: 'Messaging template saved', sync: ['messaging'], onSuccess: () => setEditor(null) });
  const remove = useMutationToast((id: number) => schoolApi.messaging.deleteTemplate(id), { success: 'Messaging template deleted', sync: ['messaging'], onSuccess: () => setRemoving(null) });
  return <><div className="mb-4 flex justify-end"><Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ channel: 'auto', is_active: true, category: 'manual' })}>Add template</Button></div><DataTable loading={isLoading} rows={templates} columns={[{ key: 'name', header: 'Template', render: (row: any) => <span><b>{row.name}</b><small className="block text-slate-400">{row.code} · {row.category}</small></span> }, { key: 'channel', header: 'Channel', render: (row: any) => <span className="capitalize">{row.channel}</span> }, { key: 'body', header: 'Message', render: (row: any) => <span className="line-clamp-2 max-w-lg">{row.body}</span> }, { key: 'status', header: 'Status', render: (row: any) => <Badge value={row.is_active ? 'active' : 'inactive'} /> }, { key: 'actions', header: '', className: 'w-24 text-right', render: (row: any) => <><button onClick={() => setEditor(row)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700"><Edit3 className="h-4 w-4" /></button><button onClick={() => setRemoving(row)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></> }]} /><Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.id ? 'Edit messaging template' : 'Add messaging template'} size="lg">{editor && <TemplateForm item={editor} onClose={() => setEditor(null)} onSave={(body) => save.mutate({ body, id: editor.id })} />}</Modal><ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing.id)} loading={remove.isPending} description="Delete this messaging template? Existing logs are retained." /></>;
}

function TemplateForm({ item, onClose, onSave }: { item: any; onClose: () => void; onSave: (body: any) => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: item });
  return <form onSubmit={handleSubmit(onSave)} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Template name"><TextInput {...register('name', { required: true })} /></Field><Field label="Template code"><TextInput {...register('code', { required: true })} /></Field><Field label="Category"><SelectInput {...register('category')}><option value="attendance">Attendance</option><option value="fee_reminder">Fee Reminder</option><option value="fee_received">Fee Received</option><option value="exam_schedule">Exam Schedule</option><option value="exam_result">Exam Result</option><option value="homework">Homework</option><option value="holiday_notice">Holiday Notice</option><option value="emergency_alert">Emergency Alert</option><option value="birthday_wishes">Birthday Wishes</option><option value="admission_confirmation">Admission Confirmation</option><option value="manual">Manual</option></SelectInput></Field><Field label="Channel"><SelectInput {...register('channel')}><option value="auto">Auto</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></SelectInput></Field></div><Field label="Message Body"><TextArea className="min-h-40" {...register('body', { required: true })} /></Field><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" {...register('is_active')} /> Active template</label><p className="text-xs text-slate-500">Placeholders: {'{{student_name}}'}, {'{{father_name}}'}, {'{{class}}'}, {'{{section}}'}, {'{{due_amount}}'}, {'{{due_date}}'}, {'{{school_name}}'}, {'{{message}}'}.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save template</Button></div></form>;
}
