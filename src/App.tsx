import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { RequirePermission } from './components/common/RequirePermission';
import { LoadingScreen } from './components/common/LoadingScreen';
import { AppShell } from './layouts/AppShell';

const Login = lazy(() => import('./pages/auth/LoginPage'));
const RoleHome = lazy(() => import('./pages/dashboard/RoleHomePage'));
const Students = lazy(() => import('./pages/students/StudentsPage'));
const StudentProfile = lazy(() => import('./pages/students/StudentProfilePage'));
const Visitors = lazy(() => import('./pages/visitors/VisitorsPage'));
const Staff = lazy(() => import('./pages/staff/StaffPage'));
const Academic = lazy(() => import('./pages/academic/AcademicPage'));
const Timetable = lazy(() => import('./pages/timetable/TimetablePage'));
const Attendance = lazy(() => import('./pages/attendance/AttendancePage'));
const Fees = lazy(() => import('./pages/fees/FeesPage'));
const Exams = lazy(() => import('./pages/exams/ExamsPage'));
const Communication = lazy(() => import('./pages/sms/CommunicationPage'));
const Reports = lazy(() => import('./pages/reports/ReportsPage'));
const Settings = lazy(() => import('./pages/settings/SettingsPage'));
const NotFound = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return <BrowserRouter><Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<RoleHome />} />
        <Route path="students" element={<RequirePermission anyOf={['students.read']}><Students /></RequirePermission>} />
        <Route path="students/:id" element={<RequirePermission anyOf={['students.read']}><StudentProfile /></RequirePermission>} />
        <Route path="visitors" element={<RequirePermission anyOf={['visitors.read', 'visitors.manage']}><Visitors /></RequirePermission>} />
        <Route path="staff" element={<RequirePermission anyOf={['staff.read']}><Staff /></RequirePermission>} />
        <Route path="academic" element={<RequirePermission anyOf={['academic.read']}><Academic /></RequirePermission>} />
        <Route path="timetable" element={<RequirePermission anyOf={['timetable.read']}><Timetable /></RequirePermission>} />
        <Route path="attendance" element={<RequirePermission anyOf={['attendance.read', 'attendance.mark', 'attendance.manage']}><Attendance /></RequirePermission>} />
        <Route path="fees" element={<RequirePermission anyOf={['fees.read', 'fees.collect', 'finance.manage']}><Fees /></RequirePermission>} />
        <Route path="exams" element={<RequirePermission anyOf={['assessments.read', 'assessments.manage']}><Exams /></RequirePermission>} />
        <Route path="communication" element={<RequirePermission anyOf={['sms.send', 'sms.manage']}><Communication /></RequirePermission>} />
        <Route path="reports" element={<RequirePermission anyOf={['reports.read']}><Reports /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission anyOf={['settings.manage']}><Settings /></RequirePermission>} />
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></BrowserRouter>;
}
