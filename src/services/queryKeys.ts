/**
 * Canonical React Query key factory.
 *
 * Keep resource roots stable and put filters/identifiers after the root. This
 * lets one resource invalidation refresh every active list variation without
 * relying on page-specific key spelling.
 */
const key = <T extends readonly unknown[]>(...parts: T) => parts;

export const queryKeys = {
  dashboard: {
    root: key('dashboard'),
    overview: (userId?: number) => key('dashboard', userId)
  },
  setup: {
    status: key('setup-status')
  },
  students: {
    root: key('students'),
    list: (params?: object) => key('students', params || {}),
    detailRoot: key('student'),
    detail: (studentId: number) => key('student', studentId),
    identifiers: (classId?: string, sectionId?: string, sessionId?: string) => key('student-identifiers', classId, sectionId, sessionId),
    attendanceRoot: key('student-attendance'),
    attendance: (studentId: number) => key('student-attendance', studentId),
    classTestsRoot: key('student-class-tests'),
    classTests: (studentId: number) => key('student-class-tests', studentId),
    resultsRoot: key('student-academic-results'),
    results: (studentId: number) => key('student-academic-results', studentId),
    invoicePicker: key('students-invoice-picker'),
    reportPicker: key('students-report-picker'),
    messagingPicker: key('messaging-students'),
    feePrerequisite: key('students-fee-prerequisite')
  },
  staff: {
    root: key('staff'),
    list: (params?: object) => key('staff', params || {}),
    detail: (staffId: number) => key('staff', staffId),
    options: key('staff-options'),
    departments: key('departments'),
    designations: key('designations'),
    attendance: (date?: string) => key('staff-attendance', date),
    messagingPicker: key('messaging-staff'),
    workspace: key('my-workspace')
  },
  academic: {
    classes: (params?: object) => key('classes', params || {}),
    classesRoot: key('classes'),
    sections: (params?: object) => key('sections', params || {}),
    sectionsRoot: key('sections'),
    subjects: (params?: object) => key('subjects', params || {}),
    subjectsRoot: key('subjects'),
    sessions: key('sessions'),
    rooms: key('rooms'),
    assignments: key('class-subjects'),
    examTypes: key('exam-types')
  },
  attendance: {
    rosterRoot: key('attendance-roster'),
    roster: (params: object) => key('attendance-roster', params),
    dailyRoot: key('daily-attendance'),
    daily: (date?: string) => key('daily-attendance', date)
  },
  fees: {
    heads: key('fee-heads'),
    structuresRoot: key('fee-structures'),
    structures: (classId?: string) => key('fee-structures', classId || ''),
    invoicesRoot: key('invoices'),
    invoices: (params?: object) => key('invoices', params || {}),
    eligibleMonthlyFees: (classId?: string, sectionId?: string) => key('eligible-monthly-fees', classId, sectionId),
    generationStructures: (classId?: string) => key('generation-fee-structures', classId),
    reminderStatus: key('fee-reminder-status'),
    reports: key('fee-reports')
  },
  finance: {
    entriesRoot: key('finance-entries'),
    entries: (kind: 'income' | 'expense', page = 1) => key('finance-entries', kind, page),
    categories: key('expense-categories'),
    summary: key('finance-summary')
  },
  assessments: {
    tests: key('class-tests'),
    testMarksRoot: key('test-marks'),
    testMarks: (testId: number) => key('test-marks', testId),
    exams: key('exams'),
    examDetailRoot: key('exam-detail'),
    examDetail: (examId: number) => key('exam-detail', examId),
    examMarksRoot: key('exam-marks'),
    examMarks: (examId: number, subjectId: number) => key('exam-marks', examId, subjectId),
    resultsRoot: key('exam-results'),
    results: (examId?: string, params?: object) => key('exam-results', examId, params || {})
  },
  timetable: {
    settings: key('timetable-settings'),
    entriesRoot: key('timetable-entries'),
    entries: (params?: object) => key('timetable-entries', params || {})
  },
  settings: {
    all: key('settings'),
    branding: key('school-branding'),
    roles: key('settings-roles'),
    userRoles: key('user-roles'),
    permissions: key('permissions'),
    usersRoot: key('users'),
    users: (search = '') => key('users', search)
  },
  messaging: {
    configurations: key('messaging-configurations'),
    providers: key('messaging-providers'),
    templates: key('messaging-templates'),
    logsRoot: key('messaging-logs'),
    logs: (params?: object) => key('messaging-logs', params || {})
  },
  visitors: {
    root: key('visitors'),
    list: (params?: object) => key('visitors', params || {}),
    messagingPicker: key('messaging-visitors')
  },
  backups: key('backups')
} as const;
