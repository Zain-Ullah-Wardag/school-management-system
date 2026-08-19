import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LogIn, Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMutationToast } from '../../hooks/useMutationToast';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Field, SelectInput, TextArea, TextInput } from '../../components/common/FormFields';
import { Badge } from '../../components/common/Badge';

export default function VisitorsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const debounced = useDebouncedValue(search);
  const { query: globalQuery } = useGlobalSearch();
  const params = { page, limit: 25, search: globalQuery.trim() || debounced || undefined, status: status || undefined };
  const { data, isLoading } = useQuery({ queryKey: queryKeys.visitors.list(params), queryFn: () => schoolApi.visitors.list(params), placeholderData: (previous) => previous });
  const create = useMutationToast((body: any) => schoolApi.visitors.create(body), { success: 'Visitor checked in', sync: ['visitors'], onSuccess: () => setFormOpen(false) });
  const checkout = useMutationToast((id: number) => schoolApi.visitors.checkout(id), { success: 'Visitor checked out', sync: ['visitors'] });

  return <>
    <PageHeader title="Visitor management" description="Maintain a secure, timestamped visitor register for the reception desk." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>Check in visitor</Button>} />
    <Card className="mb-4 p-3"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search visitor, phone, purpose, or host" /></div><SelectInput className="w-full sm:w-48" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All visitors</option><option value="checked_in">Checked in</option><option value="checked_out">Checked out</option></SelectInput></div></Card>
    <DataTable loading={isLoading} rows={data?.data} pagination={data?.pagination} onPage={setPage} columns={[
      { key: 'visitor', header: 'Visitor', render: (row: any) => <span><b>{row.visitor_name}</b><small className="block text-slate-400">{row.phone || 'No phone'}</small></span> },
      { key: 'purpose', header: 'Purpose / host', render: (row: any) => <span>{row.purpose}<small className="block text-slate-400">{row.person_to_meet || '—'}</small></span> },
      { key: 'in', header: 'Check in', render: (row: any) => new Date(row.check_in).toLocaleString() },
      { key: 'out', header: 'Check out', render: (row: any) => row.check_out ? new Date(row.check_out).toLocaleString() : '—' },
      { key: 'status', header: 'Status', render: (row: any) => <Badge value={row.status} /> },
      { key: 'actions', header: '', className: 'w-32 text-right', render: (row: any) => row.status === 'checked_in' ? <Button variant="outline" className="h-8 px-2 text-xs" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => checkout.mutate(row.id)}>Check out</Button> : null }
    ]} />
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Check in visitor" size="md"><VisitorForm saving={create.isPending} onClose={() => setFormOpen(false)} onSave={(body) => create.mutate(body)} /></Modal>
  </>;
}

function VisitorForm({ saving, onClose, onSave }: { saving: boolean; onClose: () => void; onSave: (body: any) => void }) {
  const { register, handleSubmit } = useForm<any>({ defaultValues: { check_in: new Date().toISOString().slice(0, 16) } });
  return <form onSubmit={handleSubmit(onSave)} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Visitor name"><TextInput {...register('visitor_name', { required: true })} /></Field><Field label="Phone"><TextInput {...register('phone')} /></Field><Field label="CNIC"><TextInput {...register('cnic')} /></Field><Field label="Person to meet"><TextInput {...register('person_to_meet')} /></Field><Field label="Check-in time"><TextInput type="datetime-local" {...register('check_in')} /></Field><Field label="Purpose"><SelectInput {...register('purpose', { required: true })}><option value="Parent meeting">Parent meeting</option><option value="Admission inquiry">Admission inquiry</option><option value="Vendor">Vendor</option><option value="Official visit">Official visit</option><option value="Other">Other</option></SelectInput></Field></div><Field label="Note"><TextArea {...register('note')} /></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving} icon={<LogIn className="h-4 w-4" />}>Check in</Button></div></form>;
}
