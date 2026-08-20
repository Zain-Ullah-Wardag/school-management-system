import { academicActionLabel, academicEditorTitle, academicTabs } from '../src/utils/academic';
import { financeActionLabel, financeModalTitle } from '../src/utils/finance';
import { applyLessonDuration } from '../server/utils/periods';
import { buildCertificate, certificateCatalog } from '../src/utils/certificate';
import { isFailedLoad, isInitialLoad } from '../src/utils/queryDisplay';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const expectedActions: Record<string, string> = {
  classes: 'Add Class',
  sections: 'Add Section',
  subjects: 'Add Subject',
  assignments: 'Add Allocation',
  sessions: 'Add Academic Session',
  rooms: 'Add Room'
};

for (const tab of academicTabs) {
  assert(academicActionLabel(tab.id) === expectedActions[tab.id], `${tab.id} action label is ${academicActionLabel(tab.id)}`);
  assert(academicEditorTitle(tab.id).startsWith('Add '), `${tab.id} create title is wrong`);
  assert(academicEditorTitle(tab.id, true).startsWith('Edit '), `${tab.id} edit title is wrong`);
}

assert(academicActionLabel('classes') !== academicActionLabel('sections'), 'Academic action labels do not change with the tab');
assert(financeActionLabel('income') === 'Add Income', 'Income action label is wrong');
assert(financeActionLabel('expense') === 'Add Expense', 'Expense action label is wrong');
assert(financeModalTitle('expense') === 'Add Expense' && financeModalTitle('income', true) === 'Edit Income', 'Finance modal titles are wrong');

const periods = [
  { id: 1, sequence: 1, start_time: '08:00', end_time: '08:40', period_type: 'lesson' },
  { id: 2, sequence: 2, start_time: '08:40', end_time: '09:20', period_type: 'lesson' },
  { id: 3, sequence: 3, start_time: '09:20', end_time: '09:40', period_type: 'break' },
  { id: 4, sequence: 4, start_time: '09:40', end_time: '10:20', period_type: 'lesson' }
];
const updated = applyLessonDuration(periods, 45);
assert(updated[0].start_time === '08:00' && updated[0].end_time === '08:45', 'Period 1 did not become 08:00–08:45');
assert(updated[1].start_time === '08:45' && updated[1].end_time === '09:30', 'Period 2 did not become 08:45–09:30');
assert(updated[2].start_time === '09:30' && updated[2].end_time === '09:50' && updated[2].id === 3, 'Break duration was not preserved sequentially');
assert(updated[3].start_time === '09:50' && updated[3].end_time === '10:35', 'Period 3 did not continue after the break');

assert(isInitialLoad(true, undefined) && !isInitialLoad(true, { ok: true }) && !isInitialLoad(false, undefined), 'Initial-load helper hides data or spins forever');
assert(isFailedLoad(true, undefined) && !isFailedLoad(true, { ok: true }), 'Failed-load helper treats cached data as an error');

const certificateData = {
  type: 'bonafide',
  certificate_title: 'BONAFIDE CERTIFICATE',
  name: 'The Standard Model School',
  certificate_number: 'BON-1',
  issue_date: '2026-08-20',
  template_body: 'This is to certify that {{student_name}}, son/daughter of {{father_name}}, bearing Registration No. {{registration_number}}.',
  certificate_values: { student_name: 'Abdullah Javed', father_name: 'Asif Javed', registration_number: 'DEMO-0013' },
  father_name: 'Asif Javed',
  student: { first_name: 'Abdullah', last_name: 'Javed', admission_no: 'DEMO-0013', roll_no: '1', class_name: 'Grade 5', section_name: 'A', session_name: '2026-2027' }
};

for (const item of certificateCatalog.filter((entry) => entry.type !== 'id-card')) {
  const html = buildCertificate({ ...certificateData, type: item.type, certificate_title: item.label.toUpperCase() }, 'landscape');
  assert(!html.includes('Father / Guardian'), `${item.type} still renders the student information table`);
  assert(!html.includes('Class / Section'), `${item.type} still renders the class/section table`);
  assert(html.includes('Abdullah Javed') || html.includes(item.label.toUpperCase()), `${item.type} lost its certificate content`);
}

const idCard = buildCertificate({ ...certificateData, type: 'id-card' }, 'portrait');
assert(idCard.includes('Abdullah Javed') && idCard.includes('DEMO-0013'), 'ID card no longer includes student identity details');

console.log('Module fixes test passed: academic action labels, finance labels, 40→45 period recalculation, query loading helpers, and certificate table removal.');
