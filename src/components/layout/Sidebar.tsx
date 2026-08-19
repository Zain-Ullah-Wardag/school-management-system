import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { BarChart3, BookOpenCheck, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ContactRound, GraduationCap, LayoutDashboard, MessageSquareText, ReceiptText, Settings2, UsersRound, UserRoundCog, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; permission: string };
const items: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
  { to: '/students', label: 'Students', icon: UsersRound, permission: 'students.read' },
  { to: '/visitors', label: 'Visitors', icon: ContactRound, permission: 'visitors.read' },
  { to: '/staff', label: 'Staff', icon: UserRoundCog, permission: 'staff.read' },
  { to: '/academic', label: 'Academic Setup', icon: BookOpenCheck, permission: 'academic.read' },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, permission: 'timetable.read' },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'attendance.read' },
  { to: '/fees', label: 'Fees & Finance', icon: WalletCards, permission: 'fees.read' },
  { to: '/exams', label: 'Tests & Exams', icon: ReceiptText, permission: 'assessments.read' },
  { to: '/communication', label: 'SMS & WhatsApp', icon: MessageSquareText, permission: 'sms.send' },
  { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.read' },
  { to: '/settings', label: 'Settings', icon: Settings2, permission: 'settings.manage' }
];

export function Sidebar() {
  const [compact, setCompact] = useState(false);
  const { can, user } = useAuth();
  const isLeadership = user?.role === 'administrator' || user?.role === 'principal';
  const { data: branding } = useQuery({ queryKey: queryKeys.settings.branding, queryFn: schoolApi.settings.branding });
  const schoolName = branding?.name || 'School ERP';
  const tagline = branding?.tagline || 'OFFLINE DESKTOP';
  return <aside className={`no-print sticky top-0 hidden h-screen shrink-0 border-r border-slate-100 bg-white transition-all duration-300 lg:flex lg:flex-col ${compact ? 'w-[76px]' : 'w-64'}`}>
    <div className={`flex h-[73px] items-center border-b border-slate-100 ${compact ? 'justify-center' : 'px-5'}`}><div className="flex min-w-0 items-center gap-3">{branding?.logo ? <img src={branding.logo} alt="School logo" className="h-10 w-10 shrink-0 rounded-xl object-contain" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20"><GraduationCap className="h-5 w-5" /></span>}{!compact && <div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-tight text-slate-900">{schoolName}</p><p className="truncate text-[11px] font-medium uppercase tracking-wide text-brand-600">{tagline}</p></div>}</div></div>
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">{!compact && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Operations</p>}{items.filter((item) => item.to === '/' ? isLeadership : can(item.permission)).map((item) => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'} title={compact ? item.label : undefined} className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'} ${compact ? 'justify-center px-2' : ''}`}><Icon className="h-[19px] w-[19px] shrink-0" />{!compact && <span>{item.label}</span>}</NavLink>; })}</nav>
    <div className="border-t border-slate-100 p-3"><button onClick={() => setCompact((value) => !value)} className="flex w-full items-center justify-center rounded-xl py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">{compact ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /><span className="ml-2 text-xs font-semibold">Collapse</span></>}</button></div>
  </aside>;
}
