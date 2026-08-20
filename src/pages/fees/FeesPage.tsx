import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { Tabs } from '../../components/common/Tabs';
import { Card } from '../../components/common/Card';
import { PrerequisiteNotice } from '../../components/common/PrerequisiteNotice';
import { InvoicesPanel } from '../../components/forms/InvoicesPanel';
import { FeeHeadsPanel } from '../../components/forms/FeeHeadsPanel';
import { FeeStructuresPanel } from '../../components/forms/FeeStructuresPanel';
import { FinancePanel } from '../../components/forms/FinancePanel';
import { FeeReminderPanel } from '../../components/forms/FeeReminderPanel';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';

type Tab = 'invoices' | 'structures' | 'heads' | 'finance' | 'reminders';

export default function FeesPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const { data: students } = useQuery({ queryKey: queryKeys.students.feePrerequisite, queryFn: () => schoolApi.students.list({ limit: 1, status: 'active' }) });
  const { data: classes = [] } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const missingStudents = Boolean(students && students.pagination.total === 0);

  return <>
    <PageHeader title="Fees & finance" description="Configure charges, generate invoices, collect partial payments and monitor school income." />
    {tab === 'invoices' && missingStudents && <div className="mb-4"><PrerequisiteNotice title="Invoices need enrolled students" description="Register students before creating invoices, or initialize the complete demo school from the Dashboard." actionLabel={classes.length ? 'Register students' : 'Create classes'} to={classes.length ? '/students' : '/academic'} /></div>}
    <Tabs tabs={[{ id: 'invoices', label: 'Invoices & collection' }, { id: 'structures', label: 'Fee structures' }, { id: 'heads', label: 'Fee heads' }, { id: 'finance', label: 'Income & expenses' }, { id: 'reminders', label: 'Fee reminders' }]} value={tab} onChange={setTab} />
    <Card className="p-5">
      {tab === 'invoices' && <InvoicesPanel />}
      {tab === 'structures' && <FeeStructuresPanel />}
      {tab === 'heads' && <FeeHeadsPanel />}
      <div className={tab === 'finance' ? 'block' : 'hidden'}><FinancePanel /></div>
      {tab === 'reminders' && <FeeReminderPanel />}
    </Card>
  </>;
}
