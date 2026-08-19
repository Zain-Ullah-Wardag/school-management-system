import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, GraduationCap, LockKeyhole, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiError } from '../../services/api';
import { Button } from '../../components/common/Button';
import { Field, TextInput } from '../../components/common/FormFields';

type FieldErrors = { username?: string; password?: string };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    const normalizedUsername = username.trim();
    if (!normalizedUsername) nextErrors.username = 'Username is required';
    if (!password) nextErrors.password = 'Password is required';
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      // Controlled values ensure the exact values visible in the form are sent.
      await login(normalizedUsername, password);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(apiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/30 blur-2xl" />
      <div className="relative flex items-center gap-3"><span className="rounded-2xl bg-white/15 p-3 backdrop-blur"><GraduationCap className="h-7 w-7" /></span><div><p className="text-xl font-extrabold">School ERP</p><p className="text-sm text-brand-100">Offline-first education management</p></div></div>
      <div className="relative max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-200">Your school, in control</p><h1 className="mt-4 text-5xl font-extrabold leading-[1.08]">A calmer way to run every school day.</h1><p className="mt-6 max-w-md text-lg leading-8 text-brand-100">Admissions, attendance, fees, assessments and reports—kept secure on your own desktop.</p><div className="mt-12 grid grid-cols-3 gap-3"><InfoCard value="100%" label="Offline capable" /><InfoCard value="PKR" label="Local finance" /><InfoCard value="EN / اردو" label="Bilingual workspace" /></div></div>
      <p className="relative text-xs text-brand-200">© {new Date().getFullYear()} School ERP · Secure local workspace</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md"><div className="mb-9 lg:hidden"><span className="inline-flex rounded-2xl bg-brand-600 p-3 text-white"><GraduationCap className="h-7 w-7" /></span><h1 className="mt-4 text-2xl font-extrabold text-slate-900">School ERP</h1></div><p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-600">Welcome back</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">Enter your school account credentials to continue.</p>
      <form noValidate onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Username" error={errors.username} required><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput autoFocus autoComplete="username" aria-invalid={Boolean(errors.username)} className="pl-10" placeholder="e.g. admin" value={username} onChange={(event) => { setUsername(event.target.value); setErrors((current) => ({ ...current, username: undefined })); }} /></div></Field>
        <Field label="Password" error={errors.password} required><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput autoComplete="current-password" aria-invalid={Boolean(errors.password)} className="pl-10 pr-10" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); }} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></Field>
        {serverError && <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">{serverError}</div>}
        <Button type="submit" className="w-full" loading={submitting}>Sign in securely</Button>
      </form>
      <div className="mt-7 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><strong className="text-slate-700">First launch:</strong> sign in with <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-brand-700">admin</code> / <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-brand-700">admin123</code>, then change the password.</div>
    </div></section>
  </main>;
}

function InfoCard({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-brand-100">{label}</p></div>; }
