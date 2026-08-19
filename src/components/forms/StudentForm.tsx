import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { Button } from '../common/Button';
import { Field, SelectInput, TextArea, TextInput } from '../common/FormFields';
import { PhotoUploader } from './PhotoUploader';
import { useToast } from '../../context/ToastContext';
import { apiError } from '../../services/api';
import { todayInput } from '../../utils/format';
import { queryKeys } from '../../services/queryKeys';

type FormData = Record<string, any> & { contacts: any[] };
const defaults = {
  session_id: '', class_id: '', section_id: '', first_name: '', last_name: '', gender: 'male',
  date_of_birth: '', b_form_no: '', cnic: '', blood_group: '', religion: '', nationality: 'Pakistani',
  phone: '', whatsapp: '', email: '', address: '', emergency_contact: '',
  admission_date: todayInput(), leaving_date: '', status: 'active', photo_path: '',
  contacts: [
    { contact_type: 'father', full_name: '', relation: 'Father', phone: '', whatsapp: '', cnic: '', occupation: '', is_primary: true },
    { contact_type: 'mother', full_name: '', relation: 'Mother', phone: '', whatsapp: '', cnic: '', occupation: '', is_primary: false },
    { contact_type: 'guardian', full_name: '', relation: 'Guardian', phone: '', whatsapp: '', cnic: '', occupation: '', is_primary: false }
  ]
};

export function StudentForm({ student, onSubmit, onCancel, onComplete, saving }: {
  student?: any;
  onSubmit: (values: Record<string, unknown>) => Promise<any> | void;
  onCancel: () => void;
  onComplete?: (student: any) => void;
  saving?: boolean;
}) {
  const editing = Boolean(student?.id);
  const { data: classes = [] } = useQuery({ queryKey: queryKeys.academic.classes(), queryFn: schoolApi.academic.classes });
  const { data: sections = [] } = useQuery({ queryKey: queryKeys.academic.sections(), queryFn: () => schoolApi.academic.sections() });
  const { data: sessions = [] } = useQuery({ queryKey: queryKeys.academic.sessions, queryFn: schoolApi.academic.sessions });
  const { toast } = useToast();
  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    defaultValues: student ? {
      ...defaults, ...student,
      session_id: student.session_id || '', class_id: student.class_id || '', section_id: student.section_id || '',
      contacts: student.contacts?.length ? student.contacts : defaults.contacts
    } : defaults
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });
  const selectedClass = watch('class_id');
  const selectedSection = watch('section_id');
  const selectedSession = watch('session_id');
  const { data: identifiers } = useQuery({
    queryKey: queryKeys.students.identifiers(selectedClass, selectedSection, selectedSession),
    queryFn: () => schoolApi.students.nextIdentifiers({ class_id: selectedClass || undefined, section_id: selectedSection || undefined, session_id: selectedSession || undefined }),
    enabled: !editing
  });

  const classSections = useMemo(() => {
    if (!selectedClass) return [];
    const matching = sections.filter((section: any) => String(section.class_id) === String(selectedClass));
    return Array.from(new Map(matching.map((section: any) => [`${section.class_id}:${section.name.toLowerCase()}`, section])).values());
  }, [sections, selectedClass]);

  useEffect(() => {
    if (selectedSection && !classSections.some((section: any) => String(section.id) === String(selectedSection))) setValue('section_id', '');
  }, [classSections, selectedSection, setValue]);

  const submit = async (values: FormData) => {
    try {
      const payload = {
        ...values,
        // Registration and roll numbers are generated server-side for new records.
        ...(editing ? { admission_no: student.admission_no, roll_no: student.roll_no } : { admission_no: undefined, roll_no: undefined }),
        section_id: values.section_id || null,
        session_id: values.session_id || null,
        contacts: values.contacts.filter((contact) => contact.full_name)
      };
      const saved = await onSubmit(payload);
      onComplete?.(saved);
    } catch (error) {
      toast('error', 'Student could not be saved', apiError(error));
    }
  };

  return <form onSubmit={handleSubmit(submit)} className="space-y-7">
    <section>
      <h3 className="mb-4 text-sm font-bold text-slate-800">Identity & admission</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:row-span-2"><Field label="Student photo"><PhotoUploader value={watch('photo_path')} onChange={(path) => setValue('photo_path', path)} name={watch('first_name')} /></Field></div>
        <Field label="Registration number"><TextInput value={editing ? student.admission_no : identifiers?.admission_no || 'Generated on save'} readOnly className="bg-slate-50 font-semibold text-brand-700" /></Field>
        <Field label="Roll number"><TextInput value={editing ? student.roll_no || '—' : identifiers?.roll_no || 'Select class first'} readOnly className="bg-slate-50 font-semibold text-brand-700" /></Field>
        <Field label="Academic session"><SelectInput {...register('session_id')}><option value="">Current session</option>{sessions.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="Class" required error={errors.class_id?.message}><SelectInput {...register('class_id', { required: 'Class is required' })}><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="Section"><SelectInput disabled={!selectedClass} {...register('section_id')}><option value="">{selectedClass ? 'No section' : 'Select a class first'}</option>{classSections.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field>
        <Field label="Admission date" required><TextInput type="date" {...register('admission_date', { required: true })} /></Field>
      </div>
    </section>

    <section>
      <h3 className="mb-4 text-sm font-bold text-slate-800">Student details</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="First name" required error={errors.first_name?.message}><TextInput {...register('first_name', { required: 'First name is required' })} /></Field>
        <Field label="Last name"><TextInput {...register('last_name')} /></Field>
        <Field label="Gender" required><SelectInput {...register('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></SelectInput></Field>
        <Field label="Date of birth"><TextInput type="date" {...register('date_of_birth')} /></Field>
        <Field label="B-Form number"><TextInput {...register('b_form_no')} /></Field>
        <Field label="CNIC (if applicable)"><TextInput {...register('cnic')} /></Field>
        <Field label="Blood group"><SelectInput {...register('blood_group')}><option value="">Not recorded</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}</SelectInput></Field>
        <Field label="Religion"><TextInput {...register('religion')} /></Field>
        <Field label="Nationality"><TextInput {...register('nationality')} /></Field>
      </div>
    </section>

    <section>
      <h3 className="mb-4 text-sm font-bold text-slate-800">Contact & address</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Phone"><TextInput inputMode="tel" {...register('phone')} /></Field>
        <Field label="WhatsApp"><TextInput inputMode="tel" {...register('whatsapp')} /></Field>
        <Field label="Email"><TextInput type="email" {...register('email')} /></Field>
        <Field label="Emergency contact"><TextInput inputMode="tel" {...register('emergency_contact')} /></Field>
        <Field label="Status"><SelectInput {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option><option value="left">Left</option><option value="graduated">Graduated</option></SelectInput></Field>
        <Field label="Leaving date"><TextInput type="date" {...register('leaving_date')} /></Field>
        <Field label="Address"><TextArea className="min-h-[42px]" {...register('address')} /></Field>
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-800">Parents & guardians</h3><p className="text-xs text-slate-500">Keep the primary contact up to date for attendance and fee alerts.</p></div><Button type="button" variant="outline" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => append({ contact_type: 'guardian', full_name: '', relation: '', phone: '', whatsapp: '', cnic: '', occupation: '', is_primary: false })}>Add contact</Button></div>
      <div className="space-y-3">{fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[130px_1fr_1fr_1fr_36px]"><SelectInput {...register(`contacts.${index}.contact_type` as const)}><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="emergency">Emergency</option></SelectInput><TextInput placeholder="Full name" {...register(`contacts.${index}.full_name` as const)} /><TextInput placeholder="Relation / occupation" {...register(`contacts.${index}.relation` as const)} /><TextInput placeholder="Phone" {...register(`contacts.${index}.phone` as const)} /><button type="button" onClick={() => remove(index)} className="rounded-xl text-rose-500 hover:bg-rose-50"><Trash2 className="mx-auto h-4 w-4" /></button></div>)}</div>
    </section>

    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Documents are managed after registration from the Student Profile. This ensures every file is attached to an existing student record and can be viewed, replaced, downloaded, or deleted safely.</div>

    <div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Register student'}</Button></div>
  </form>;
}
