import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArchiveRestore, Download, HardDriveDownload, Upload } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { apiError } from '../../services/api';
import { useMutationToast } from '../../hooks/useMutationToast';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { DataTable } from '../common/DataTable';

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 1 : 2)} MB`;

export function BackupRestorePanel() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const { data: backups = [], isLoading } = useQuery({ queryKey: queryKeys.backups, queryFn: schoolApi.backups.list });
  const create = useMutationToast(() => schoolApi.backups.create(), {
    success: 'Database backup created',
    sync: ['backups']
  });
  const restore = useMutationToast((file: File) => schoolApi.backups.restore(file), {
    success: 'Database restored. Please sign in again.',
    sync: ['system'],
    onSuccess: () => {
      logout();
      navigate('/login', { replace: true });
    }
  });

  const download = async (fileName: string) => {
    try {
      const response = await schoolApi.backups.download(fileName);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast('error', 'Backup download failed', apiError(error));
    }
  };

  return <>
    <div className="mb-5 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <Card className="border-brand-100 bg-brand-50/40 p-5">
        <div className="flex gap-3"><span className="rounded-xl bg-brand-600 p-2.5 text-white"><HardDriveDownload className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">Create a safe local backup</h3><p className="mt-1 text-sm leading-6 text-slate-600">Creates a consistent SQLite snapshot while the ERP is running. Download it and store it securely off this computer.</p></div></div>
        <Button className="mt-4" loading={create.isPending} icon={<HardDriveDownload className="h-4 w-4" />} onClick={() => create.mutate(undefined)}>Create backup</Button>
      </Card>
      <Card className="border-amber-100 bg-amber-50/50 p-5">
        <div className="flex gap-3"><span className="rounded-xl bg-amber-500 p-2.5 text-white"><ArchiveRestore className="h-5 w-5" /></span><div><h3 className="font-bold text-amber-950">Restore a backup</h3><p className="mt-1 text-sm leading-6 text-amber-800">Restoring replaces the active school database. A safety copy is made first and you will be signed out.</p></div></div>
        <input ref={fileInput} className="sr-only" type="file" accept=".db,.sqlite,.sqlite3" onChange={(event) => setRestoreFile(event.target.files?.[0] || null)} />
        <Button className="mt-4" variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => fileInput.current?.click()}>Choose backup file</Button>
        {restoreFile && <p className="mt-2 truncate text-xs font-semibold text-amber-800">Selected: {restoreFile.name}</p>}
      </Card>
    </div>

    <DataTable
      loading={isLoading}
      rows={backups}
      emptyText="No local backups have been created yet."
      columns={[
        { key: 'file', header: 'Backup file', render: (row: any) => <span className="font-semibold text-slate-700">{row.file_name}</span> },
        { key: 'created', header: 'Created', render: (row: any) => new Date(row.created_at).toLocaleString() },
        { key: 'size', header: 'Size', render: (row: any) => size(row.size) },
        { key: 'download', header: '', className: 'w-28 text-right', render: (row: any) => <Button variant="outline" className="h-8 px-2 text-xs" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void download(row.file_name)}>Download</Button> }
      ]}
    />

    <ConfirmDialog
      open={Boolean(restoreFile)}
      onClose={() => { setRestoreFile(null); if (fileInput.current) fileInput.current.value = ''; }}
      onConfirm={() => restoreFile && restore.mutate(restoreFile)}
      loading={restore.isPending}
      title="Restore School ERP database"
      confirmLabel="Restore and sign out"
      description={`Restore “${restoreFile?.name || ''}”? This replaces the active database. The current database is copied to a local safety file first.`}
    />
  </>;
}
