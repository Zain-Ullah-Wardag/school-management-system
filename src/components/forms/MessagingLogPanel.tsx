import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, Search } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { DataTable } from '../common/DataTable';
import { SelectInput } from '../common/FormFields';
import { Badge } from '../common/Badge';
import { exportCsv } from '../../utils/export';
import { useGlobalSearch } from '../../context/GlobalSearchContext';

export function MessagingLogPanel() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(1);
  const localSearch = useDebouncedValue(search);
  const { query: globalQuery } = useGlobalSearch();
  const { data: configurations = [] } = useQuery({ queryKey: queryKeys.messaging.configurations, queryFn: schoolApi.messaging.configurations });
  const params = { page, limit: 50, search: globalQuery.trim() || localSearch || undefined, status: status || undefined, provider_configuration_id: provider || undefined };
  const { data, isLoading } = useQuery({ queryKey: queryKeys.messaging.logs(params), queryFn: () => schoolApi.messaging.logs(params), placeholderData: (previous) => previous });
  const retry = useMutationToast((id: number) => schoolApi.messaging.retry(id), { success: 'Message retry submitted', sync: ['messaging'] });

  return <div className="space-y-4"><div className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-panel md:grid-cols-[1fr_180px_220px_auto]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="form-control pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search recipient, phone, message, or type" /></div><SelectInput value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="queued">Queued</option><option value="sent">Sent</option><option value="delivered">Delivered</option><option value="failed">Failed</option></SelectInput><SelectInput value={provider} onChange={(event) => { setProvider(event.target.value); setPage(1); }}><option value="">All providers</option>{configurations.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput><Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => exportCsv((data?.data || []).map((row: any) => ({ date: row.created_at?.slice(0, 10), time: row.created_at, recipient_name: row.recipient_name, phone_number: row.phone_number, message_type: row.message_type, provider: row.provider_name, status: row.status, error_message: row.error_message, message: row.message })), 'messaging-delivery-log')}>Export CSV</Button></div><DataTable loading={isLoading} rows={data?.data} pagination={data?.pagination} onPage={setPage} columns={[{ key: 'date', header: 'Date / Time', render: (row: any) => <span>{new Date(row.created_at).toLocaleDateString()}<small className="block text-slate-400">{new Date(row.created_at).toLocaleTimeString()}</small></span> }, { key: 'recipient', header: 'Recipient Name', render: (row: any) => <span><b>{row.recipient_name || '—'}</b><small className="block text-slate-400">{row.recipient_type}</small></span> }, { key: 'phone', header: 'Phone Number', render: (row: any) => row.phone_number }, { key: 'type', header: 'Message Type', render: (row: any) => row.message_type || 'manual' }, { key: 'provider', header: 'Provider', render: (row: any) => row.provider_name || '—' }, { key: 'status', header: 'Status', render: (row: any) => <Badge value={row.status} /> }, { key: 'error', header: 'Error Message', render: (row: any) => <span className="max-w-48 truncate text-rose-700">{row.error_message || '—'}</span> }, { key: 'retry', header: '', className: 'w-20 text-right', render: (row: any) => <Button variant="outline" className="h-8 px-2 text-xs" disabled={row.status === 'delivered'} loading={retry.isPending} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => retry.mutate(row.id)}>Retry</Button> }]} /></div>;
}
