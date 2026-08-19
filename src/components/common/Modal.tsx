import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

class ModalContentBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Modal content failed to render', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center"><span className="rounded-2xl bg-rose-50 p-3 text-rose-600"><AlertTriangle className="h-6 w-6" /></span><h3 className="mt-4 font-bold text-slate-800">This form could not be displayed</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Please close this window and try again. The application kept the page available instead of showing a blank dialog.</p></div>;
  }
}

export function Modal({ open, onClose, title, children, size = 'lg' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/30 p-3 backdrop-blur-[1px] sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true">
      <button aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-float ${widths[size]}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 overflow-y-auto p-5"><ModalContentBoundary>{children}</ModalContentBoundary></div>
      </div>
    </div>,
    document.body
  );
}
