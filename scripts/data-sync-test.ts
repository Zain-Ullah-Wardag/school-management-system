import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { queryKeys } from '../src/services/queryKeys';
import { synchronizeData } from '../src/services/dataSync';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function activate<T>(client: QueryClient, queryKey: readonly unknown[], read: () => T) {
  const observer = new QueryObserver<T>(client, {
    queryKey,
    queryFn: async () => read(),
    staleTime: Infinity
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await observer.refetch();
  return { observer, unsubscribe };
}

async function run() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let version = 0;

  // These active observers simulate currently mounted lists/details/summary cards.
  const studentList = await activate(client, queryKeys.students.list({ status: 'active' }), () => ({ version, records: ['students'] }));
  const studentDetail = await activate(client, queryKeys.students.detail(7), () => ({ version, record: 'student-detail' }));
  const classCounts = await activate(client, queryKeys.academic.classes(), () => ({ version, records: ['class-counts'] }));
  const dashboard = await activate(client, queryKeys.dashboard.overview(1), () => ({ version, cards: { total_students: version } }));

  version = 1;
  await synchronizeData(client, ['students']);
  assert(studentList.observer.getCurrentResult().data?.version === 1, 'Student list did not refetch after student mutation sync');
  assert(studentDetail.observer.getCurrentResult().data?.version === 1, 'Student detail did not refetch after student mutation sync');
  assert(classCounts.observer.getCurrentResult().data?.version === 1, 'Class counts did not refetch after student mutation sync');
  assert(dashboard.observer.getCurrentResult().data?.version === 1, 'Dashboard did not refetch after student mutation sync');

  const attendanceRoster = await activate(client, queryKeys.attendance.roster({ class_id: 1, date: '2026-08-19' }), () => ({ version, records: ['roster'] }));
  const attendanceHistory = await activate(client, queryKeys.students.attendance(7), () => ({ version, percentage: version }));
  const staffDetail = await activate(client, queryKeys.staff.detail(4), () => ({ version, attendance: version }));

  version = 2;
  await synchronizeData(client, ['attendance']);
  assert(attendanceRoster.observer.getCurrentResult().data?.version === 2, 'Attendance roster did not refetch after attendance mutation sync');
  assert(attendanceHistory.observer.getCurrentResult().data?.version === 2, 'Student attendance history did not refetch after attendance mutation sync');
  assert(staffDetail.observer.getCurrentResult().data?.version === 2, 'Staff profile did not refetch after attendance mutation sync');
  assert(dashboard.observer.getCurrentResult().data?.version === 2, 'Dashboard did not refetch after attendance mutation sync');

  const incomeHistory = await activate(client, queryKeys.finance.entries('income', 1), () => ({ version, rows: ['income'] }));
  const financeSummary = await activate(client, queryKeys.finance.summary, () => ({ version, net_income: version }));
  version = 3;
  await synchronizeData(client, ['finance']);
  assert(incomeHistory.observer.getCurrentResult().data?.version === 3, 'Income history did not refetch after finance mutation sync');
  assert(financeSummary.observer.getCurrentResult().data?.version === 3, 'Finance summary did not refetch after finance mutation sync');
  assert(dashboard.observer.getCurrentResult().data?.version === 3, 'Dashboard did not refetch after finance mutation sync');

  const testMarks = await activate(client, queryKeys.assessments.testMarks(4), () => ({ version, marks: [version] }));
  const resultHistory = await activate(client, queryKeys.students.results(7), () => ({ version, grade: version }));
  version = 4;
  await synchronizeData(client, ['assessments']);
  assert(testMarks.observer.getCurrentResult().data?.version === 4, 'Marks entry query did not refetch after assessment mutation sync');
  assert(resultHistory.observer.getCurrentResult().data?.version === 4, 'Student result history did not refetch after assessment mutation sync');

  // Cover remaining application domains with their representative current-page query.
  const staffList = await activate(client, queryKeys.staff.list({ status: 'active' }), () => ({ version, rows: ['staff'] }));
  const academicAssignments = await activate(client, queryKeys.academic.assignments, () => ({ version, rows: ['assignments'] }));
  const invoiceList = await activate(client, queryKeys.fees.invoices({ status: 'unpaid' }), () => ({ version, rows: ['invoices'] }));
  const timetable = await activate(client, queryKeys.timetable.entries({ class_id: 1 }), () => ({ version, rows: ['timetable'] }));
  const branding = await activate(client, queryKeys.settings.branding, () => ({ version, name: 'School' }));
  const users = await activate(client, queryKeys.settings.users(''), () => ({ version, rows: ['users'] }));
  const messages = await activate(client, queryKeys.messaging.templates, () => ({ version, rows: ['messages'] }));
  const visitors = await activate(client, queryKeys.visitors.list({ page: 1 }), () => ({ version, rows: ['visitors'] }));

  version = 5;
  await synchronizeData(client, ['staff', 'academic', 'fees', 'timetable', 'settings', 'users', 'messaging', 'visitors']);
  assert(staffList.observer.getCurrentResult().data?.version === 5, 'Staff list did not refetch after staff mutation sync');
  assert(academicAssignments.observer.getCurrentResult().data?.version === 5, 'Academic assignments did not refetch after academic mutation sync');
  assert(invoiceList.observer.getCurrentResult().data?.version === 5, 'Invoice list did not refetch after fees mutation sync');
  assert(timetable.observer.getCurrentResult().data?.version === 5, 'Timetable entries did not refetch after timetable mutation sync');
  assert(branding.observer.getCurrentResult().data?.version === 5, 'Branding did not refetch after settings mutation sync');
  assert(users.observer.getCurrentResult().data?.version === 5, 'User list did not refetch after users mutation sync');
  assert(messages.observer.getCurrentResult().data?.version === 5, 'Messaging templates did not refetch after messaging mutation sync');
  assert(visitors.observer.getCurrentResult().data?.version === 5, 'Visitor list did not refetch after visitor mutation sync');

  version = 6;
  await synchronizeData(client, ['system']);
  assert(dashboard.observer.getCurrentResult().data?.version === 6 && visitors.observer.getCurrentResult().data?.version === 6, 'System-wide synchronization did not refetch all active queries');

  [studentList, studentDetail, classCounts, dashboard, attendanceRoster, attendanceHistory, staffDetail, incomeHistory, financeSummary, testMarks, resultHistory, staffList, academicAssignments, invoiceList, timetable, branding, users, messages, visitors]
    .forEach(({ unsubscribe }) => unsubscribe());
  client.clear();
  console.log('Data synchronization test passed: every major list/detail/profile/summary query scope refreshes centrally without route navigation or page reload.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
