# Data Synchronization Architecture

The ERP uses TanStack Query as the single client-side server-state layer. A successful mutation must not depend on a route change, browser refresh, timeout, or polling cycle to show current data.

## Query keys

`src/services/queryKeys.ts` is the canonical factory for all `useQuery` keys. Resource roots are stable and filters/identifiers are placed after the root. For example:

- `['students', filters]`
- `['student', studentId]`
- `['attendance-roster', filters]`
- `['invoices', filters]`
- `['finance-entries', kind, page]`
- `['exam-results', examId, filters]`
- `['dashboard', userId]`

A root invalidation therefore covers every active filtered/page/detail variation of that resource.

## Synchronization scopes

`src/services/dataSync.ts` owns the dependency graph. Mutations declare business scopes instead of page-local key arrays:

| Scope | Refreshed resource families |
| --- | --- |
| `students` | student lists/details, class/section counts, identifiers, profile histories, pickers, dashboard |
| `staff` | lists/details, options, departments/designations, attendance/profile data, timetable workspace, dashboard |
| `academic` | classes, sections, subjects, sessions, rooms, allocations, dependent pickers, timetable, assessment setup |
| `attendance` | roster, daily sheet, student/staff profiles and history, result attendance data, dashboard |
| `fees` | fee heads/structures, invoices, fee reports, finance summary, dependent pickers, dashboard |
| `finance` | income/expense history, categories, net summary, fee reports, dashboard |
| `assessments` | tests, exams, marks, result calculations, student histories, dashboard |
| `timetable` | timetable settings/entries and teacher workspace |
| `settings` | settings, branding, dependent calculated results, dashboard |
| `users`, `messaging`, `visitors`, `backups` | their corresponding resource families |
| `system` | every cached resource after a demo initialization, restore, or reset |

## Mutation rule

Use `useMutationToast` with a `sync` scope:

```ts
const save = useMutationToast(saveStudent, {
  success: 'Student saved',
  sync: ['students']
});
```

The hook waits for `synchronizeData()` to invalidate all dependent resource roots and refetch **active** observers before invoking its success callback/toast. Inactive queries are marked stale and refetch on route mount. This guarantees current mounted screens update without navigation.

For the few screens that use a direct async action rather than a React Query mutation, use `useDataSync()` after the API call.

## Cache policy

The default query configuration deliberately has:

- `staleTime: 0`
- `refetchOnMount: 'always'`
- no polling
- no full-page reload behavior

The local SQLite API is fast, and operational correctness is preferred over retaining a time-window cache when a route remounts.

## Regression coverage

`npm run test:sync` creates active TanStack Query observers for every synchronization scope and proves that a centralized synchronization event refetches the current list/detail/profile/summary/dashboard observers without a route change or page reload.
