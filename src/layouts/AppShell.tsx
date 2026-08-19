import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  return <div className="flex h-screen overflow-hidden bg-canvas">
    <Sidebar />
    {mobileNav && <div className="fixed inset-0 z-50 bg-slate-950/30 lg:hidden" onClick={() => setMobileNav(false)}><div className="h-full w-72 bg-white p-4" onClick={(event) => event.stopPropagation()}><p className="mb-4 text-lg font-extrabold text-brand-700">School ERP</p><p className="text-sm text-slate-500">Use the desktop sidebar for full navigation.</p></div></div>}
    <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
      <Topbar onOpenNav={() => setMobileNav(true)} />
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-7"><Outlet /></div>
    </main>
  </div>;
}
