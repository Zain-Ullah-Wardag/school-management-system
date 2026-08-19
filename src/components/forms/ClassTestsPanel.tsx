import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Edit3, Plus, Save, Upload } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { Button } from '../common/Button';
import { DataTable } from '../common/DataTable';
import { Modal } from '../common/Modal';
import { Field, SelectInput, TextInput } from '../common/FormFields';
import { Badge } from '../common/Badge';
import { fullName, todayInput } from '../../utils/format';
import { obtainedMarksError } from '../../utils/marks';
export function ClassTestsPanel(){const {query:globalQuery}=useGlobalSearch();const [editor,setEditor]=useState<any>();const [marksFor,setMarksFor]=useState<any>();const {data,isLoading}=useQuery({queryKey:queryKeys.assessments.tests,queryFn:()=>schoolApi.assessments.tests({limit:100})});const {data:classes=[]}=useQuery({queryKey:queryKeys.academic.classes(),queryFn:schoolApi.academic.classes});const {data:sections=[]}=useQuery({queryKey:queryKeys.academic.sections(),queryFn:schoolApi.academic.sections});const {data:subjects=[]}=useQuery({queryKey:queryKeys.academic.subjects(),queryFn:schoolApi.academic.subjects});const {data:staff=[]}=useQuery({queryKey:queryKeys.staff.options,queryFn:schoolApi.staff.options});const {data:sessions=[]}=useQuery({queryKey:queryKeys.academic.sessions,queryFn:schoolApi.academic.sessions});const save=useMutationToast(({body,id}:any)=>schoolApi.assessments.saveTest(body,id),{success:'Class test saved',sync:['assessments'],onSuccess:()=>setEditor(null)});const publish=useMutationToast((id:number)=>schoolApi.assessments.publishTest(id),{success:'Class test published',sync:['assessments']});const rows=(data?.data||[]).filter((test:any)=>!globalQuery.trim()||`${test.name||''} ${test.class_name||''} ${test.section_name||''} ${test.subject_name||''} ${test.teacher_name||''}`.toLowerCase().includes(globalQuery.trim().toLowerCase()));return <><div className="mb-4 flex justify-end"><Button icon={<Plus className="h-4 w-4"/>} onClick={()=>setEditor({})}>Create class test</Button></div><DataTable loading={isLoading} rows={rows} columns={[{key:'name',header:'Test',render:(r:any)=><span><b>{r.name}</b><small className="block text-slate-400">{r.test_date}</small></span>},{key:'class',header:'Class / subject',render:(r:any)=><span>{r.class_name}{r.section_name?` · ${r.section_name}`:''}<small className="block text-slate-400">{r.subject_name}</small></span>},{key:'marks',header:'Marks',render:(r:any)=>`${r.total_marks} · pass ${r.passing_marks}`},{key:'teacher',header:'Teacher',render:(r:any)=>r.teacher_name||'—'},{key:'status',header:'Status',render:(r:any)=><Badge value={r.status}/>},{key:'actions',header:'',className:'w-32 text-right',render:(r:any)=><><button onClick={()=>setMarksFor(r)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700" title="Enter marks"><Edit3 className="h-4 w-4"/></button>{r.status!=='published'&&<button onClick={()=>publish.mutate(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-700" title="Publish"><Upload className="h-4 w-4"/></button>}</>}]}/><Modal open={Boolean(editor)} onClose={()=>setEditor(null)} title={editor?.id?'Edit class test':'Create class test'} size="md">{editor&&<TestForm item={editor} classes={classes} sections={sections} subjects={subjects} staff={staff} sessions={sessions} onClose={()=>setEditor(null)} onSave={(body)=>save.mutate({body,id:editor.id})}/>}</Modal><Modal open={Boolean(marksFor)} onClose={()=>setMarksFor(null)} title={marksFor?`Marks · ${marksFor.name}`:''} size="xl">{marksFor&&<TestMarks test={marksFor} onClose={()=>setMarksFor(null)}/>}</Modal></>}
function TestForm({item,classes,sections,subjects,staff,sessions,onClose,onSave}:{item:any;classes:any[];sections:any[];subjects:any[];staff:any[];sessions:any[];onClose:()=>void;onSave:(v:any)=>void}){const {register,handleSubmit,watch}=useForm({defaultValues:{test_date:todayInput(),total_marks:20,passing_marks:8,contribution_percent:25,...item}});const classId=watch('class_id');return <form onSubmit={handleSubmit(onSave)} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Test name"><TextInput placeholder="e.g. Unit Test 1 / Quiz" {...register('name',{required:true})}/></Field><Field label="Date"><TextInput type="date" {...register('test_date',{required:true})}/></Field><Field label="Session"><SelectInput {...register('session_id')}><option value="">Current session</option>{sessions.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput></Field><Field label="Class"><SelectInput {...register('class_id',{required:true})}><option value="">Select class</option>{classes.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field><Field label="Section"><SelectInput {...register('section_id')}><option value="">No / all section</option>{sections.filter((s:any)=>!classId||String(s.class_id)===String(classId)).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput></Field><Field label="Subject"><SelectInput {...register('subject_id',{required:true})}><option value="">Select subject</option>{subjects.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput></Field><Field label="Teacher"><SelectInput {...register('teacher_id')}><option value="">Select teacher</option>{staff.map((s:any)=><option key={s.id} value={s.id}>{s.first_name} {s.last_name||''}</option>)}</SelectInput></Field><Field label="Total marks"><TextInput type="number" min="1" {...register('total_marks',{required:true})}/></Field><Field label="Passing marks"><TextInput type="number" min="0" {...register('passing_marks',{required:true})}/></Field><Field label="Contribution (%)"><TextInput type="number" min="0" max="100" {...register('contribution_percent')}/></Field></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save test</Button></div></form>}
function TestMarks({ test, onClose }: { test: any; onClose: () => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: queryKeys.assessments.testMarks(test.id), queryFn: () => schoolApi.assessments.testMarks(test.id) });
  const [marks, setMarks] = useState<any[]>([]);
  useEffect(() => setMarks(data), [data]);
  const save = useMutationToast((body: any) => schoolApi.assessments.saveTestMarks(test.id, body), {
    success: 'Test marks saved',
    sync: ['assessments']
  });
  const average = marks.filter((mark) => mark.obtained_marks !== null && mark.obtained_marks !== '').reduce((sum, mark) => sum + Number(mark.obtained_marks), 0) / (marks.filter((mark) => mark.obtained_marks !== null && mark.obtained_marks !== '').length || 1);
  const firstError = marks.map((mark) => obtainedMarksError(mark.obtained_marks, test.total_marks)).find(Boolean);

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-3">
      <p className="text-sm text-brand-800">Total marks: <b>{test.total_marks}</b> · Passing marks: <b>{test.passing_marks}</b> · Decimal marks are supported.</p>
      <span className="text-sm font-bold text-brand-700">Average: {average.toFixed(1)}</span>
    </div>
    {firstError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">Correct invalid marks before saving. {firstError}</p>}
    <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Student</th><th className="p-3">Roll</th><th className="p-3">Obtained marks</th><th className="p-3">Remarks</th></tr></thead>
        <tbody>{isLoading
          ? <tr><td className="p-4" colSpan={4}>Loading roster…</td></tr>
          : marks.map((row, index) => {
            const error = obtainedMarksError(row.obtained_marks, test.total_marks);
            return <tr key={row.student_id} className="border-t border-slate-50">
              <td className="p-3 font-semibold">{fullName(row)}<small className="ml-2 text-slate-400">{row.admission_no}</small></td>
              <td className="p-3">{row.roll_no || '—'}</td>
              <td className="p-3"><div><TextInput className="w-28" type="number" min="0" max={test.total_marks} step="0.01" aria-invalid={Boolean(error)} value={row.obtained_marks ?? ''} onChange={(event) => setMarks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, obtained_marks: event.target.value } : item))} />{error && <p className="mt-1 max-w-48 text-xs font-medium text-rose-600">{error}</p>}</div></td>
              <td className="p-3"><TextInput value={row.remarks || ''} onChange={(event) => setMarks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, remarks: event.target.value } : item))} /></td>
            </tr>;
          })}</tbody>
      </table>
    </div>
    <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button icon={<Save className="h-4 w-4" />} loading={save.isPending} disabled={Boolean(firstError)} onClick={() => save.mutate(marks)}>Save marks</Button></div>
  </div>;
}
