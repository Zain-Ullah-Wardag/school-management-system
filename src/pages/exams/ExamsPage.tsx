import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { Tabs } from '../../components/common/Tabs';
import { Card } from '../../components/common/Card';
import { PrerequisiteNotice } from '../../components/common/PrerequisiteNotice';
import { ClassTestsPanel } from '../../components/forms/ClassTestsPanel';
import { TermExamsPanel } from '../../components/forms/TermExamsPanel';
import { ExamResultsPanel } from '../../components/forms/ExamResultsPanel';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';

type Tab = 'tests' | 'exams' | 'results';

export default function ExamsPage() {
  const [tab, setTab] = useState<Tab>('tests');
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: subjects = [], isLoading: isSubjectsLoading } = useQuery({ queryKey: queryKeys.academic.subjects(), queryFn: schoolApi.academic.subjects });
  const { data: staff = [], isLoading: isStaffLoading } = useQuery({ queryKey: queryKeys.staff.options, queryFn: schoolApi.staff.options });
  const isSetupLoading = isClassesLoading || isSubjectsLoading || isStaffLoading;
  const hasPrerequisites = classes.length > 0 && subjects.length > 0 && staff.length > 0;

  return <>
    <PageHeader title="Tests & examinations" description="Unlimited class tests, weighted term exams, approval workflow and professional progress cards." />
    {!isSetupLoading && !hasPrerequisites && <div className="mb-4 space-y-3">
      {classes.length === 0 && <PrerequisiteNotice title="Assessments need classes" description="Create classes and sections before adding tests or examinations." actionLabel="Create classes" to="/academic" />}
      {classes.length > 0 && subjects.length === 0 && <PrerequisiteNotice title="Assessments need subjects" description="Add subjects and class subject allocations before entering marks." actionLabel="Manage subjects" to="/academic" />}
      {classes.length > 0 && staff.length === 0 && <PrerequisiteNotice title="Assessments need teachers" description="Create teacher staff records before assigning subject teachers." actionLabel="Add teachers" to="/staff" />}
    </div>}
    <Tabs tabs={[{ id: 'tests', label: 'Class tests' }, { id: 'exams', label: 'Term exams' }, { id: 'results', label: 'Results & award lists' }]} value={tab} onChange={setTab} />
    <Card className="p-5">{isSetupLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading assessment setup…</p> : hasPrerequisites ? <>{tab === 'tests' && <ClassTestsPanel />}{tab === 'exams' && <TermExamsPanel />}{tab === 'results' && <ExamResultsPanel />}</> : <p className="py-10 text-center text-sm text-slate-500">Complete the setup guidance above, or initialize the demo school from the Dashboard.</p>}</Card>
  </>;
}
