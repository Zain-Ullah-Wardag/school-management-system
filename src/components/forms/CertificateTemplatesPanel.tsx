import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { FileText, Save } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Field, TextArea } from '../common/FormFields';

const placeholders = ['{{student_name}}', '{{father_name}}', '{{registration_number}}', '{{roll_number}}', '{{class}}', '{{section}}', '{{session}}', '{{issue_date}}', '{{school_name}}', '{{principal_name}}'];

export function CertificateTemplatesPanel() {
  const { data } = useQuery({ queryKey: queryKeys.settings.all, queryFn: schoolApi.settings.all });
  const defaultBonafide = 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is a bona fide student of {{school_name}}. The student is currently enrolled in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. According to the records maintained by the school, the student\'s conduct and attendance have been satisfactory. This certificate is issued upon the student\'s request for official purposes and carries no financial liability on the part of the institution.';
  const defaultEnrollment = 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}} and Roll No. {{roll_number}}, is duly enrolled at {{school_name}} in Class {{class}}, Section {{section}}, for the Academic Session {{session}}. This confirms the student\'s current active enrollment in the institution. The certificate is issued on {{issue_date}} at the request of the student or parent/guardian for official use.';
  const { register, handleSubmit } = useForm<any>({ values: { bonafide: data?.['certificate.bonafide_template']?.value || defaultBonafide, enrollment: data?.['certificate.enrollment_template']?.value || defaultEnrollment } });
  const save = useMutationToast((values: any) => schoolApi.settings.save({ settings: { 'certificate.bonafide_template': values.bonafide, 'certificate.enrollment_template': values.enrollment } }), { success: 'Certificate templates saved', sync: ['settings'] });

  return <div className="mx-auto max-w-5xl space-y-5"><Card className="border-brand-100 bg-brand-50/30 p-5"><div className="flex gap-3"><span className="rounded-xl bg-brand-600 p-2.5 text-white"><FileText className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">Certificate template editor</h2><p className="mt-1 text-sm leading-6 text-slate-600">Use the placeholders below in the certificate body. They are replaced securely with live student and school data at print time.</p></div></div><div className="mt-4 flex flex-wrap gap-2">{placeholders.map((placeholder) => <code key={placeholder} className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{placeholder}</code>)}</div></Card><form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-5"><Field label="Bonafide Certificate Body"><TextArea className="min-h-52" {...register('bonafide', { required: true })} /></Field><Field label="Enrollment Certificate Body"><TextArea className="min-h-52" {...register('enrollment', { required: true })} /></Field><div className="flex justify-end"><Button type="submit" loading={save.isPending} icon={<Save className="h-4 w-4" />}>Save certificate templates</Button></div></form></div>;
}
