import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

/**
 * A mutation declares business resources, not a hand-written list of pages.
 * This map owns all cache relationships, including legacy aliases retained
 * while the application transitions to the canonical key factory.
 */
export type SyncScope =
  | 'setup'
  | 'students'
  | 'staff'
  | 'academic'
  | 'attendance'
  | 'fees'
  | 'finance'
  | 'assessments'
  | 'timetable'
  | 'settings'
  | 'users'
  | 'messaging'
  | 'visitors'
  | 'backups'
  | 'system';

const roots: Record<Exclude<SyncScope, 'system'>, QueryKey[]> = {
  setup: [
    queryKeys.setup.status,
    queryKeys.dashboard.root
  ],
  students: [
    queryKeys.students.root,
    queryKeys.students.detailRoot,
    queryKeys.academic.classesRoot,
    queryKeys.academic.sectionsRoot,
    queryKeys.students.identifiers(),
    queryKeys.students.attendanceRoot,
    queryKeys.students.classTestsRoot,
    queryKeys.students.resultsRoot,
    queryKeys.students.invoicePicker,
    queryKeys.students.reportPicker,
    queryKeys.students.messagingPicker,
    queryKeys.students.feePrerequisite,
    queryKeys.attendance.rosterRoot,
    queryKeys.assessments.testMarksRoot,
    queryKeys.assessments.examMarksRoot,
    queryKeys.assessments.resultsRoot,
    queryKeys.fees.eligibleMonthlyFees(),
    queryKeys.dashboard.root
  ],
  staff: [
    queryKeys.staff.root,
    queryKeys.staff.options,
    queryKeys.staff.departments,
    queryKeys.staff.designations,
    queryKeys.staff.attendance(),
    queryKeys.staff.messagingPicker,
    queryKeys.staff.workspace,
    queryKeys.academic.sectionsRoot,
    queryKeys.academic.assignments,
    queryKeys.settings.usersRoot,
    queryKeys.timetable.entriesRoot,
    queryKeys.dashboard.root
  ],
  academic: [
    queryKeys.academic.classesRoot,
    queryKeys.academic.sectionsRoot,
    queryKeys.academic.subjectsRoot,
    queryKeys.academic.sessions,
    queryKeys.academic.rooms,
    queryKeys.academic.assignments,
    queryKeys.academic.examTypes,
    queryKeys.students.identifiers(),
    queryKeys.students.root,
    queryKeys.students.detailRoot,
    queryKeys.students.reportPicker,
    queryKeys.students.invoicePicker,
    queryKeys.fees.structuresRoot,
    queryKeys.fees.eligibleMonthlyFees(),
    queryKeys.fees.generationStructures(),
    queryKeys.timetable.entriesRoot,
    queryKeys.staff.workspace,
    queryKeys.assessments.tests,
    queryKeys.assessments.exams,
    queryKeys.dashboard.root
  ],
  attendance: [
    queryKeys.attendance.rosterRoot,
    queryKeys.attendance.dailyRoot,
    queryKeys.students.attendanceRoot,
    queryKeys.students.detailRoot,
    queryKeys.staff.attendance(),
    queryKeys.staff.root,
    queryKeys.assessments.resultsRoot,
    queryKeys.students.resultsRoot,
    queryKeys.dashboard.root
  ],
  fees: [
    queryKeys.fees.heads,
    queryKeys.fees.structuresRoot,
    queryKeys.fees.invoicesRoot,
    queryKeys.fees.eligibleMonthlyFees(),
    queryKeys.fees.generationStructures(),
    queryKeys.fees.reports,
    queryKeys.finance.summary,
    queryKeys.students.detailRoot,
    queryKeys.students.feePrerequisite,
    queryKeys.dashboard.root
  ],
  finance: [
    queryKeys.finance.entriesRoot,
    queryKeys.finance.categories,
    queryKeys.finance.summary,
    queryKeys.fees.reports,
    queryKeys.dashboard.root
  ],
  assessments: [
    queryKeys.assessments.tests,
    queryKeys.assessments.testMarksRoot,
    queryKeys.assessments.exams,
    queryKeys.assessments.examDetailRoot,
    queryKeys.assessments.examMarksRoot,
    queryKeys.assessments.resultsRoot,
    queryKeys.students.classTestsRoot,
    queryKeys.students.resultsRoot,
    queryKeys.students.detailRoot,
    queryKeys.dashboard.root
  ],
  timetable: [
    queryKeys.timetable.settings,
    queryKeys.timetable.entriesRoot,
    queryKeys.staff.workspace,
    queryKeys.dashboard.root
  ],
  settings: [
    queryKeys.settings.all,
    queryKeys.settings.branding,
    queryKeys.assessments.resultsRoot,
    queryKeys.students.resultsRoot,
    queryKeys.dashboard.root
  ],
  users: [
    queryKeys.settings.usersRoot,
    queryKeys.settings.roles,
    queryKeys.settings.userRoles,
    queryKeys.settings.permissions,
    queryKeys.staff.options,
    queryKeys.staff.workspace,
    queryKeys.dashboard.root
  ],
  messaging: [
    queryKeys.messaging.configurations,
    queryKeys.messaging.providers,
    queryKeys.messaging.templates,
    queryKeys.messaging.logsRoot,
    ['sms-logs'],
    queryKeys.fees.reminderStatus
  ],
  visitors: [
    queryKeys.visitors.root,
    queryKeys.visitors.messagingPicker
  ],
  backups: [queryKeys.backups]
};

const keyIdentity = (queryKey: QueryKey) => JSON.stringify(queryKey);

export function rootsForScopes(scopes: readonly SyncScope[], extra: readonly QueryKey[] = []) {
  if (scopes.includes('system')) return null;
  const unique = new Map<string, QueryKey>();
  for (const scope of scopes) {
    if (scope === 'system') continue;
    for (const queryKey of roots[scope]) unique.set(keyIdentity(queryKey), queryKey);
  }
  for (const queryKey of extra) unique.set(keyIdentity(queryKey), queryKey);
  return [...unique.values()];
}

/**
 * Marks related queries stale and refetches all currently mounted observers.
 * Inactive queries remain stale and fetch as soon as their route is mounted;
 * no timers, polling, navigation, or full-page reload is used.
 */
export async function synchronizeData(queryClient: QueryClient, scopes: readonly SyncScope[] = [], extra: readonly QueryKey[] = []) {
  const queryRoots = rootsForScopes(scopes, extra);
  if (queryRoots === null) {
    await queryClient.invalidateQueries({ refetchType: 'active' });
    return;
  }
  await Promise.all(queryRoots.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'active' })));
}
