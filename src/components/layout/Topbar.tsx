import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Search, UserCircle2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';

const searchConfig = (pathname: string) => {
  if (pathname.startsWith('/students')) return { module: 'students', placeholder: 'Search students by name, registration, class…' };
  if (pathname.startsWith('/staff')) return { module: 'staff', placeholder: 'Search staff by name, employee no., or phone…' };
  if (pathname.startsWith('/fees')) return { module: 'fees', placeholder: 'Search invoices, receipts, or students…' };
  if (pathname.startsWith('/attendance')) return { module: 'attendance', placeholder: 'Search attendance records…' };
  if (pathname.startsWith('/timetable')) return { module: 'timetable', placeholder: 'Search timetable classes, teachers, subjects…' };
  if (pathname.startsWith('/academic')) return { module: 'academic', placeholder: 'Search academic setup records…' };
  if (pathname.startsWith('/exams')) return { module: 'exams', placeholder: 'Search tests, exams, and results…' };
  if (pathname.startsWith('/reports')) return { module: 'reports', placeholder: 'Search report results or certificates…' };
  if (pathname.startsWith('/communication')) return { module: 'messaging', placeholder: 'Search messages, recipients, providers…' };
  if (pathname.startsWith('/visitors')) return { module: 'visitors', placeholder: 'Search visitor register…' };
  return null;
};

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { pathname } = useLocation();
  const { query, setQuery, setActiveModule, clear } = useGlobalSearch();
  const [menu, setMenu] = useState(false);
  const config = useMemo(() => searchConfig(pathname), [pathname]);

  useEffect(() => {
    setActiveModule(config?.module || '');
    clear();
  }, [config?.module, setActiveModule]);

  return <header className="no-print sticky top-0 z-30 flex h-[73px] shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <button onClick={onOpenNav} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
      {config ? <div className="relative hidden min-w-0 w-72 md:block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') clear(); }} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-50" placeholder={config.placeholder} aria-label={config.placeholder} />{query && <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>}</div> : <div className="hidden text-sm font-semibold text-slate-400 md:block">Workspace</div>}
    </div>
    <div className="flex items-center gap-2 sm:gap-3"><button onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')} className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{language === 'en' ? 'اردو' : 'EN'}</button><button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" /></button><div className="relative"><button onClick={() => setMenu((value) => !value)} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-slate-50"><Avatar src={user?.photo_path} name={user?.fullName} /><span className="hidden text-left sm:block"><span className="block max-w-28 truncate text-sm font-bold text-slate-700">{user?.fullName}</span><span className="block text-[11px] font-medium capitalize text-slate-400">{user?.role.replace('_', ' ')}</span></span><ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" /></button>{menu && <div className="absolute right-0 top-full z-40 mt-2 w-52 rounded-2xl border border-slate-100 bg-white p-2 shadow-float"><div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-bold text-slate-800">{user?.fullName}</p><p className="truncate text-xs text-slate-500">@{user?.username}</p></div><Button variant="ghost" className="mt-1 w-full justify-start px-3" icon={<UserCircle2 className="h-4 w-4" />}>My account</Button><Button variant="ghost" className="w-full justify-start px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<LogOut className="h-4 w-4" />} onClick={logout}>Sign out</Button></div>}</div></div>
  </header>;
}
