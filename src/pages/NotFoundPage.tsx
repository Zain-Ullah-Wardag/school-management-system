import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/common/Button';
export default function NotFoundPage(){return <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center"><span className="rounded-2xl bg-brand-100 p-4 text-brand-700"><Compass className="h-8 w-8"/></span><h1 className="mt-5 text-3xl font-extrabold text-slate-900">Page not found</h1><p className="mt-2 text-slate-500">This workspace page does not exist or you may not have access to it.</p><Link to="/"><Button className="mt-6">Go to dashboard</Button></Link></div>}
