import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { BellRing, CalendarClock, Send, Settings2 } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { DataTable } from '../common/DataTable';
import { Field, SelectInput, TextInput } from '../common/FormFields';
import { Badge } from '../common/Badge';
import { money } from '../../utils/format';

export function FeeReminderPanel() {
  const { data: status, isLoading } = useQuery({ queryKey: queryKeys.fees.reminderStatus, queryFn: schoolApi.fees.reminderStatus });
  const { data: templates = [] } = useQuery({ queryKey: queryKeys.messaging.templates, queryFn: schoolApi.messaging.templates });
  const { data: configurations = [] } = useQuery({ queryKey: queryKeys.messaging.configurations, queryFn: schoolApi.messaging.configurations });
  const { register, handleSubmit } = useForm<any>({ values: { enabled: Boolean(status?.enabled), reminder_day: status?.reminder_day || 5, template_code: status?.template_code || 'fee_due', channel: status?.channel || 'sms', provider_configuration_id: status?.provider_configuration_id || '' } });
  const configure = useMutationToast((body: any) => schoolApi.fees.configureReminders(body), { success: 'Fee reminder schedule saved', sync: ['fees'] });
  const sendNow = useMutationToast(() => schoolApi.fees.sendRemindersNow(), { success: 'Outstanding fee reminders processed', sync: ['fees', 'messaging'] });

  return <div className="space-y-5">
    <div className="grid gap-4 lg:grid-cols-3"><Metric label="Outstanding students" value={status?.outstanding?.total_students ?? 0} icon={<BellRing className="h-5 w-5" />} /><Metric label="Total due" value={money(status?.outstanding?.total_due)} icon={<CalendarClock className="h-5 w-5" />} /><Metric label="Next scheduled reminder" value={status?.next_scheduled_reminder || '—'} icon={<Settings2 className="h-5 w-5" />} /></div>
    <Card className="p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-800">Automatic unpaid-fee reminders</h2><p className="mt-1 text-sm text-slate-500">The scheduler checks unpaid and partial invoices once per minute and sends only once on the configured reminder day.</p></div><Button loading={sendNow.isPending} icon={<Send className="h-4 w-4" />} onClick={() => sendNow.mutate(undefined)}>Send Reminder Now</Button></div><form onSubmit={handleSubmit((values) => configure.mutate(values))} className="grid gap-4 md:grid-cols-4"><Field label="Enable automatic reminders"><SelectInput {...register('enabled')}><option value="true">Enabled</option><option value="false">Disabled</option></SelectInput></Field><Field label="Reminder day"><TextInput type="number" min="1" max="28" {...register('reminder_day')} /></Field><Field label="Message template"><SelectInput {...register('template_code')}>{templates.filter((template: any) => Boolean(template.is_active)).map((template: any) => <option key={template.id} value={template.code}>{template.name}</option>)}</SelectInput></Field><Field label="Messaging Provider"><SelectInput {...register('provider_configuration_id')}><option value="">Legacy SMS gateway</option>{configurations.filter((config: any) => config.is_enabled).map((config: any) => <option key={config.id} value={config.id}>{config.name} · {config.provider_name}</option>)}</SelectInput></Field><Field label="Channel"><SelectInput {...register('channel')}><option value="sms">SMS gateway</option><option value="whatsapp">WhatsApp (provider-enabled)</option></SelectInput></Field><div className="md:col-span-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><span>Gateway: <b>{status?.gateway?.provider_name || 'Not configured'}</b> · Last automatic run: <b>{status?.last_reminder_date || 'Never'}</b></span><Button type="submit" variant="outline" loading={configure.isPending}>Save reminder configuration</Button></div></form></Card>
    <Card><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-800">Reminder history</h2><p className="text-sm text-slate-500">Every scheduled or manual reminder is stored in the SMS log.</p></div><DataTable loading={isLoading} rows={status?.history} emptyText="No fee reminders have been sent yet." columns={[{ key: 'created', header: 'Created', render: (row: any) => new Date(row.created_at).toLocaleString() }, { key: 'phone', header: 'Recipient', render: (row: any) => row.phone }, { key: 'message', header: 'Message', render: (row: any) => <span className="line-clamp-2 max-w-md">{row.message}</span> }, { key: 'channel', header: 'Channel', render: (row: any) => <span className="capitalize">{row.channel}</span> }, { key: 'status', header: 'Status', render: (row: any) => <Badge value={row.status} /> }]} /></Card>
  </div>;
}
function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) { return <Card className="p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold text-slate-900">{value}</p></div><span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">{icon}</span></div></Card>; }
