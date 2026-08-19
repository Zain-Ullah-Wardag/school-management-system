import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CalendarDays, ClipboardCheck, ContactRound, FilePenLine, MessageSquareText, ReceiptText, School, UserRoundCheck, UsersRound, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { useAuth } from '../../context/AuthContext';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

const leadership = new Set(['administrator', 'principal']);

type Action = { title: string; description: string; to: string; icon: typeof BookOpenCheck; permission: string };

const roleActions: Record<string, Action[]> = {
  subject_teacher: [
    { title: 'My timetable', description: 'Today’s classes, rooms, and periods.', to: '/timetable', icon: CalendarDays, permission: 'timetable.read' },
    { title: 'Student attendance', description: 'Open a class register and mark attendance.', to: '/attendance', icon: ClipboardCheck, permission: 'attendance.mark' },
    { title: 'Enter marks', description: 'Class tests, term exams, and subject marks.', to: '/exams', icon: FilePenLine, permission: 'assessments.manage' },
    { title: 'Messages', description: 'Communicate with parents through SMS or WhatsApp.', to: '/communication', icon: MessageSquareText, permission: 'sms.send' }
  ],
  class_teacher: [
    { title: 'My class students', description: 'Student lists, profiles, and history.', to: '/students', icon: UsersRound, permission: 'students.read' },
    { title: 'Attendance', description: 'Mark and review my class attendance.', to: '/attendance', icon: ClipboardCheck, permission: 'attendance.mark' },
    { title: 'Results', description: 'Class tests, marks, and progress cards.', to: '/exams', icon: FilePenLine, permission: 'assessments.read' },
    { title: 'Fee status', description: 'View fee status and outstanding balances for families.', to: '/fees', icon: WalletCards, permission: 'fees.read' },
    { title: 'Parent communication', description: 'Send attendance and progress messages.', to: '/communication', icon: MessageSquareText, permission: 'sms.send' }
  ],
  accountant: [
    { title: 'Invoices & receipts', description: 'Issue invoices, collect payments, and print receipts.', to: '/fees', icon: ReceiptText, permission: 'fees.collect' },
    { title: 'Fees & finance', description: 'Collections, expenses, income, and outstanding dues.', to: '/fees', icon: WalletCards, permission: 'finance.manage' },
    { title: 'Financial reports', description: 'Collection, income, expense, and dues reports.', to: '/reports', icon: BookOpenCheck, permission: 'reports.read' }
  ],
  receptionist: [
    { title: 'Student registration', description: 'Admissions, documents, and student records.', to: '/students', icon: UsersRound, permission: 'students.manage' },
    { title: 'Certificates', description: 'Open a profile to print certificates and ID cards.', to: '/students', icon: School, permission: 'students.read' },
    { title: 'Fee collection', description: 'Collect and print fee receipts for families.', to: '/fees', icon: ReceiptText, permission: 'fees.collect' },
    { title: 'Visitor management', description: 'Check visitors in, out, and maintain the reception register.', to: '/visitors', icon: ContactRound, permission: 'visitors.read' },
    { title: 'Parent messages', description: 'Send admission, attendance, or manual messages.', to: '/communication', icon: MessageSquareText, permission: 'sms.send' }
  ],
  staff: [
    { title: 'My attendance', description: 'Mark your attendance and review your timetable.', to: '/attendance', icon: UserRoundCheck, permission: 'dashboard.read' }
  ]
};

export default function RoleHomePage() {
  const { user, can } = useAuth();
  const { data: workspace } = useQuery({ queryKey: queryKeys.staff.workspace, queryFn: schoolApi.staff.workspace, enabled: Boolean(user) && !leadership.has(user?.role || '') });
  if (user && leadership.has(user.role)) return <DashboardPage />;
  const actions = (roleActions[user?.role || 'staff'] || roleActions.staff).filter((action) => can(action.permission));
  const title = user?.role.replace(/_/g, ' ') || 'workspace';

  return <>
    <PageHeader title={`Welcome, ${user?.fullName || ''}`} description={`Your ${title} workspace keeps the actions you need front and centre.`} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{actions.map((action) => { const Icon = action.icon; return <Link key={action.title} to={action.to}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-brand-100 hover:bg-brand-50/40"><span className="inline-flex rounded-xl bg-brand-100 p-2.5 text-brand-700"><Icon className="h-5 w-5" /></span><h2 className="mt-4 font-bold text-slate-800">{action.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{action.description}</p></Card></Link>; })}</div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card><CardHeader title="My classes & subjects" description="Assignments linked to your staff profile." /><div className="divide-y divide-slate-50">{workspace?.class_assignments?.length ? workspace.class_assignments.map((item: any) => <div className="flex justify-between gap-3 px-5 py-3" key={item.id}><div><p className="font-semibold text-slate-700">{item.subject_name}</p><p className="text-xs text-slate-500">{item.class_name} {item.section_name ? `· ${item.section_name}` : ''}</p></div><span className="text-xs font-bold text-brand-700">{item.weekly_periods} periods</span></div>) : <p className="p-6 text-sm text-slate-400">No subject assignments are linked to this account.</p>}</div></Card>
      <Card><CardHeader title="Today's timetable" description="Periods assigned to you today." /><div className="divide-y divide-slate-50">{workspace?.today_timetable?.length ? workspace.today_timetable.map((item: any) => <div className="flex justify-between gap-3 px-5 py-3" key={item.id}><div><p className="font-semibold text-slate-700">{item.subject_name || item.period_name}</p><p className="text-xs text-slate-500">{item.class_name} {item.section_name ? `· ${item.section_name}` : ''} {item.room_name ? `· ${item.room_name}` : ''}</p></div><span className="text-xs font-bold text-slate-500">{item.start_time}–{item.end_time}</span></div>) : <p className="p-6 text-sm text-slate-400">No timetable entry is assigned today.</p>}</div></Card>
    </div>
    {user?.role === 'class_teacher' && <Card className="mt-4 p-5"><h2 className="font-bold text-slate-800">My class</h2><p className="mt-1 text-sm text-slate-500">Use Student Management for your class roster, Attendance for daily registers, and Tests & Exams for results. Fee status is available where your role has fee-read permission.</p><Link to="/students"><Button className="mt-4" variant="outline">Open student list</Button></Link></Card>}
  </>;
}
