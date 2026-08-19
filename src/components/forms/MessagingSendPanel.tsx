import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Send, UsersRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Field, SelectInput, TextArea } from '../common/FormFields';
import { useToast } from '../../context/ToastContext';

type SendScope = 'individual' | 'class' | 'section' | 'multiple_classes' | 'entire_school';

export function MessagingSendPanel() {
  const { toast } = useToast();
  const [preview, setPreview] = useState('');
  const { data: configurations = [] } = useQuery({ queryKey: queryKeys.messaging.configurations, queryFn: schoolApi.messaging.configurations });
  const { data: templates = [] } = useQuery({ queryKey: queryKeys.messaging.templates, queryFn: schoolApi.messaging.templates });
  const { data: studentsPage } = useQuery({ queryKey: queryKeys.students.messagingPicker, queryFn: () => schoolApi.students.list({ limit: 100, status: 'active' }) });
  const { data: staffPage } = useQuery({ queryKey: queryKeys.staff.messagingPicker, queryFn: () => schoolApi.staff.list({ limit: 100, status: 'active' }) });
  const { data: visitorsPage } = useQuery({ queryKey: queryKeys.visitors.messagingPicker, queryFn: () => schoolApi.visitors.list({ limit: 100 }) });
  const { data: classes = [] } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: schoolApi.academic.sections });
  const { register, handleSubmit, watch, setValue } = useForm<any>({ defaultValues: { provider_configuration_id: configurations.find((item: any) => item.is_default)?.id || '', channel: 'auto', recipient_type: 'student', send_to: 'individual', class_ids: [], template_code: '', message: '', message_type: 'manual' } });
  const recipientType = watch('recipient_type');
  const scope = watch('send_to') as SendScope;
  const classId = watch('class_id');
  const templateCode = watch('template_code');
  const message = watch('message');
  const recipientOptions = recipientType === 'staff' ? staffPage?.data || [] : recipientType === 'visitor' ? visitorsPage?.data || [] : studentsPage?.data || [];
  const send = useMutationToast((body: any) => schoolApi.messaging.send(body), { success: 'Messages submitted to provider', sync: ['messaging'] });

  const chooseTemplate = (code: string) => {
    setValue('template_code', code);
    const template = templates.find((item: any) => item.code === code);
    if (template) { setValue('message', template.body); setValue('message_type', template.category || template.code); }
  };
  const submit = (values: any) => {
    const payload = { ...values, recipient_ids: values.recipient_id ? [Number(values.recipient_id)] : values.recipient_ids || [], class_ids: Array.isArray(values.class_ids) ? values.class_ids.map(Number) : [] };
    send.mutate(payload);
  };
  const showPreview = () => setPreview((message || '').replace(/\{\{student_name\}\}|\{student\}/gi, 'Sample Student').replace(/\{\{school_name\}\}/gi, 'Green Valley School').replace(/\{\{due_amount\}\}|\{amount\}/gi, '5,000').replace(/\{\{class\}\}/gi, 'Grade 5').replace(/\{\{section\}\}/gi, 'A'));

  return <div className="mx-auto max-w-5xl space-y-5"><Card className="p-5"><form onSubmit={handleSubmit(submit)} className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><Field label="Provider"><SelectInput {...register('provider_configuration_id')}><option value="">Default provider</option>{configurations.map((config: any) => <option key={config.id} value={config.id}>{config.name} · {config.provider_name}</option>)}</SelectInput></Field><Field label="Channel"><SelectInput {...register('channel')}><option value="auto">Auto</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></SelectInput></Field><Field label="Recipient Type"><SelectInput {...register('recipient_type')}><option value="student">Student</option><option value="parent">Parent</option><option value="staff">Staff</option><option value="visitor">Visitor</option></SelectInput></Field><Field label="Send To"><SelectInput {...register('send_to')}><option value="individual">Individual</option>{recipientType !== 'visitor' && <option value="class">Class</option>}{recipientType !== 'visitor' && <option value="section">Section</option>}{recipientType !== 'visitor' && <option value="multiple_classes">Multiple Classes</option>}{recipientType !== 'visitor' && <option value="entire_school">Entire School</option>}</SelectInput></Field>
        {scope === 'individual' && <Field label="Recipient"><SelectInput {...register('recipient_id', { required: true })}><option value="">Select recipient</option>{recipientOptions.map((item: any) => <option key={item.id} value={item.id}>{recipientType === 'staff' ? `${item.employee_no} · ${item.first_name} ${item.last_name || ''}` : recipientType === 'visitor' ? `${item.visitor_name} · ${item.phone || ''}` : `${item.admission_no} · ${item.first_name} ${item.last_name || ''}`}</option>)}</SelectInput></Field>}
        {(scope === 'class' || scope === 'section') && <Field label="Class"><SelectInput {...register('class_id', { required: true })}><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>}
        {scope === 'section' && <Field label="Section"><SelectInput disabled={!classId} {...register('section_id', { required: true })}><option value="">Select section</option>{sections.filter((item: any) => String(item.class_id) === String(classId)).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>}
      </div>
      {scope === 'multiple_classes' && <div><p className="mb-2 text-sm font-bold text-slate-700">Multiple Classes</p><div className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-3">{classes.map((item: any) => <label className="flex items-center gap-2 text-sm text-slate-700" key={item.id}><input type="checkbox" value={item.id} {...register('class_ids')} /> {item.name}</label>)}</div></div>}
      <div className="grid gap-4 md:grid-cols-[260px_1fr]"><Field label="Message Template"><SelectInput value={templateCode} onChange={(event) => chooseTemplate(event.target.value)}><option value="">Custom message</option>{templates.filter((item: any) => item.status === 'active').map((template: any) => <option key={template.id} value={template.code}>{template.name}</option>)}</SelectInput></Field><Field label="Message Type"><SelectInput {...register('message_type')}><option value="manual">Manual</option><option value="attendance">Attendance</option><option value="fee_reminder">Fee Reminder</option><option value="fee_received">Fee Received</option><option value="exam_schedule">Exam Schedule</option><option value="exam_result">Exam Result</option><option value="homework">Homework</option><option value="holiday_notice">Holiday Notice</option><option value="emergency_alert">Emergency Alert</option><option value="birthday_wishes">Birthday Wishes</option><option value="admission_confirmation">Admission Confirmation</option></SelectInput></Field></div>
      <Field label="Message"><TextArea className="min-h-36" placeholder="Use {{student_name}}, {{father_name}}, {{class}}, {{section}}, {{due_amount}}, {{school_name}}" {...register('message', { required: true })} /></Field>
      {preview && <div className="rounded-xl border border-brand-100 bg-brand-50 p-4"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-700">Preview Message</p><p className="whitespace-pre-wrap text-sm text-brand-950">{preview}</p></div>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={showPreview}>Preview Message</Button><Button type="button" variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => { if (!message) toast('error', 'Enter a message first'); else showPreview(); }}>Send Test</Button><Button type="submit" loading={send.isPending} icon={<UsersRound className="h-4 w-4" />}>Send Message</Button></div>
    </form></Card></div>;
}
