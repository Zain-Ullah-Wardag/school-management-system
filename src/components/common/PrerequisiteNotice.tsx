import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { Button } from './Button';

export function PrerequisiteNotice({ title, description, actionLabel, to }: { title: string; description: string; actionLabel: string; to: string }) {
  return <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-bold text-amber-950">{title}</p><p className="mt-1 text-sm leading-5 text-amber-800">{description}</p></div></div>
      <Link to={to}><Button variant="outline" className="border-amber-200 bg-white text-amber-800 hover:bg-amber-100" icon={<ArrowRight className="h-4 w-4" />}>{actionLabel}</Button></Link>
    </div>
  </div>;
}
