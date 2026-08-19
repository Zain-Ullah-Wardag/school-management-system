import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Edit3, Eye, Plus, Search, Wallet } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMutationToast } from '../../hooks/useMutationToast';
import { useAuth } from '../../context/AuthContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StaffForm } from '../../components/forms/StaffForm';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { SelectInput } from '../../components/common/FormFields';
import { fullName, money } from '../../utils/format';
import type { Staff } from '../../types';

export default function StaffPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number>();
  const [archiveItem, setArchiveItem] = useState<Staff | null>(null);
  const { can } = useAuth();
  const { query: globalQuery } = useGlobalSearch();
  const params = { page, limit: 20, search: globalQuery.trim() || debounced || undefined, department_id: department || undefined };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.staff.list(params),
    queryFn: () => schoolApi.staff.list(params),
    placeholderData: (previous) => previous
  });
  const { data: departments = [] } = useQuery({ queryKey: queryKeys.staff.departments, queryFn: schoolApi.staff.departments });
  const { data: selected, isLoading: isLoadingSelected } = useQuery({
    queryKey: selectedId ? queryKeys.staff.detail(selectedId) : ['staff', 'no-selection'],
    queryFn: () => schoolApi.staff.get(selectedId!),
    enabled: Boolean(selectedId) && (formOpen || detailOpen)
  });

  const create = useMutationToast((body: any) => schoolApi.staff.create(body), {
    success: 'Staff member added',
    sync: ['staff'],
    onSuccess: () => setFormOpen(false)
  });
  const update = useMutationToast(({ id, body }: any) => schoolApi.staff.update(id, body), {
    success: 'Staff record updated',
    sync: ['staff'],
    onSuccess: () => setFormOpen(false)
  });
  const archive = useMutationToast((id: number) => schoolApi.staff.remove(id), {
    success: 'Staff member archived',
    sync: ['staff'],
    onSuccess: () => setArchiveItem(null)
  });

  const openDetail = (staff: Staff, editing = false) => {
    setSelectedId(staff.id);
    if (editing) setFormOpen(true);
    else setDetailOpen(true);
  };

  const columns: Column<Staff>[] = useMemo(() => [
    {
      key: 'member',
      header: 'Staff member',
      render: (row) => <button onClick={() => openDetail(row)} className="flex items-center gap-3 text-left"><Avatar src={row.photo_path} name={fullName(row)} /><span><span className="block font-bold text-slate-800">{fullName(row)}</span><span className="text-xs text-slate-500">{row.employee_no}</span></span></button>
    },
    {
      key: 'role',
      header: 'Department / designation',
      render: (row) => <span><span className="block font-medium">{row.designation_name || '—'}</span><span className="text-xs text-slate-400">{row.department_name || 'No department'}</span></span>
    },
    { key: 'contact', header: 'Contact', render: (row) => row.phone || '—' },
    { key: 'salary', header: 'Salary', render: (row) => money(row.salary) },
    { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (row) => <div className="flex justify-end gap-1"><button onClick={() => openDetail(row)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700"><Eye className="h-4 w-4" /></button>{can('staff.manage') && <><button onClick={() => openDetail(row, true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Edit3 className="h-4 w-4" /></button><button onClick={() => setArchiveItem(row)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Archive className="h-4 w-4" /></button></>}</div>
    }
  ], [can]);

  return <>
    <PageHeader title="Staff management" description="Employment records, salary history, accounts and attendance for every staff member." actions={can('staff.manage') ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setSelectedId(undefined); setFormOpen(true); }}>Add staff</Button> : undefined} />
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-panel md:flex-row">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="form-control min-w-0 pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search employee no., name or phone" /></div>
      <SelectInput className="w-full md:w-56" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}><option value="">All departments</option>{departments.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput>
    </div>
    <DataTable columns={columns} rows={data?.data} loading={isLoading} pagination={data?.pagination} onPage={setPage} />

    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={selectedId ? 'Edit staff member' : 'Add staff member'} size="xl">
      {selectedId && isLoadingSelected ? <p className="p-6 text-sm text-slate-500">Loading staff record…</p> : <StaffForm staff={selected} saving={create.isPending || update.isPending} onCancel={() => setFormOpen(false)} onSubmit={(values) => selectedId ? update.mutateAsync({ id: selectedId, body: values }) : create.mutateAsync(values)} />}
    </Modal>

    <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Staff profile" size="lg">
      {isLoadingSelected ? <p className="p-6 text-sm text-slate-500">Refreshing staff profile…</p> : selected ? <StaffProfile staff={selected} /> : <p className="p-6 text-sm text-slate-500">Staff member not found.</p>}
    </Modal>

    <ConfirmDialog open={Boolean(archiveItem)} onClose={() => setArchiveItem(null)} onConfirm={() => archiveItem && archive.mutate(archiveItem.id)} loading={archive.isPending} title="Archive staff member" confirmLabel="Archive" description={`Archive ${archiveItem ? fullName(archiveItem) : 'this staff member'}? Historical records are retained.`} />
  </>;
}

function StaffProfile({ staff }: { staff: any }) {
  return <div className="space-y-5">
    <div className="flex gap-4"><Avatar src={staff.photo_path} name={fullName(staff)} className="h-16 w-16 rounded-2xl text-lg" /><div><h3 className="text-xl font-bold text-slate-900">{fullName(staff)}</h3><p className="text-sm text-slate-500">{staff.employee_no} · {staff.designation_name || 'No designation'}</p><Badge value={staff.status} /></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Info label="Qualification" value={staff.qualification} /><Info label="Joining date" value={staff.joining_date} /><Info label="Phone" value={staff.phone} /><Info label="WhatsApp" value={staff.whatsapp} /><Info label="Email" value={staff.email} /><Info label="Login" value={staff.username || 'Not linked'} /></div>
    <div className="rounded-2xl border border-slate-100"><div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><Wallet className="h-4 w-4 text-brand-600" /><h4 className="font-bold text-slate-800">Salary history</h4></div>{staff.salary_history?.length ? <div className="divide-y divide-slate-50">{staff.salary_history.map((item: any) => <div className="flex justify-between px-4 py-3 text-sm" key={item.id}><span>{item.effective_from}<small className="ml-2 text-slate-400">{item.note}</small></span><strong>{money(item.amount)}</strong></div>)}</div> : <p className="p-4 text-sm text-slate-400">No salary history available.</p>}</div>
    <div className="rounded-2xl border border-slate-100"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h4 className="font-bold text-slate-800">Attendance history</h4><p className="text-xs text-slate-500">Present {staff.attendance_summary?.present_days || 0} · Absent {staff.attendance_summary?.absent_days || 0} · Leave {staff.attendance_summary?.leave_days || 0} · Late {staff.attendance_summary?.late_days || 0}</p></div><strong className="text-brand-700">{staff.attendance_summary?.percentage || 0}%</strong></div>{staff.attendance?.length ? <div className="max-h-60 overflow-auto divide-y divide-slate-50">{staff.attendance.map((item: any) => <div className="flex items-center justify-between px-4 py-2.5 text-sm" key={item.id}><span>{item.attendance_date}<small className="ml-2 text-slate-400">{item.check_in || ''} {item.check_out ? `– ${item.check_out}` : ''}</small></span><Badge value={item.status} /></div>)}</div> : <p className="p-4 text-sm text-slate-400">No attendance records available.</p>}</div>
  </div>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{value || '—'}</p></div>;
}
