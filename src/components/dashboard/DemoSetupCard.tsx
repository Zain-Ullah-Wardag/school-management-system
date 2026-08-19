import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DatabaseZap, GraduationCap, Sparkles, UsersRound } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useAuth } from '../../context/AuthContext';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function DemoSetupCard() {
  const { can } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.setup.status,
    queryFn: schoolApi.setup.status,
    enabled: can('settings.manage')
  });
  const initialize = useMutationToast(() => schoolApi.setup.initializeDemo(), {
    success: 'Demo school initialized. Your dashboard is ready to explore.',
    sync: ['system'],
    onSuccess: () => setConfirming(false)
  });

  if (!can('settings.manage') || isLoading || data?.initialized) return null;
  const canInitialize = Boolean(data?.can_initialize);

  return <>
    <Card className="mb-6 overflow-hidden border-brand-100 bg-gradient-to-r from-brand-50 via-white to-emerald-50">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20"><Sparkles className="h-6 w-6" /></span>
          <div>
            <p className="text-base font-extrabold text-slate-900">Start with a fully testable demo school</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">One click creates Nursery through Grade 10, 24 students, 10 teachers, 5 office staff, attendance, fees, exams, timetable entries, messages, and reports.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-brand-800"><span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Ready-made academics</span><span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" /> 39 demo people</span><span className="inline-flex items-center gap-1"><DatabaseZap className="h-3.5 w-3.5" /> Safe clean-database setup</span></div>
          </div>
        </div>
        <Button disabled={!canInitialize} loading={initialize.isPending} icon={<Sparkles className="h-4 w-4" />} onClick={() => setConfirming(true)}>{canInitialize ? 'Initialize Demo School' : 'Demo setup unavailable'}</Button>
      </div>
      {!canInitialize && <p className="border-t border-brand-100 bg-white/70 px-5 py-3 text-xs text-amber-700">This database already contains operational records. Demo initialization never overwrites existing school data.</p>}
    </Card>
    <ConfirmDialog
      open={confirming}
      onClose={() => setConfirming(false)}
      onConfirm={() => initialize.mutate(undefined)}
      loading={initialize.isPending}
      title="Initialize Demo School"
      confirmLabel="Initialize demo data"
      description="This will add a realistic Green Valley School dataset to the current clean database. It does not overwrite existing operational data."
    />
  </>;
}
