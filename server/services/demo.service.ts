import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { today } from '../utils/serializers';

type DemoClass = { code: string; name: string; monthlyFee: number };
type DemoStudent = { first: string; last: string; gender: 'male' | 'female'; parent: string };

const demoClasses: DemoClass[] = [
  { code: 'NUR', name: 'Nursery', monthlyFee: 3500 },
  { code: 'KG', name: 'Kindergarten', monthlyFee: 3800 },
  { code: 'G1', name: 'Grade 1', monthlyFee: 4200 },
  { code: 'G2', name: 'Grade 2', monthlyFee: 4400 },
  { code: 'G3', name: 'Grade 3', monthlyFee: 4600 },
  { code: 'G4', name: 'Grade 4', monthlyFee: 4800 },
  { code: 'G5', name: 'Grade 5', monthlyFee: 5000 },
  { code: 'G6', name: 'Grade 6', monthlyFee: 5300 },
  { code: 'G7', name: 'Grade 7', monthlyFee: 5600 },
  { code: 'G8', name: 'Grade 8', monthlyFee: 6000 },
  { code: 'G9', name: 'Grade 9', monthlyFee: 6500 },
  { code: 'G10', name: 'Grade 10', monthlyFee: 7000 }
];

const demoStudents: DemoStudent[] = [
  { first: 'Ayaan', last: 'Khan', gender: 'male', parent: 'Imran Khan' },
  { first: 'Hania', last: 'Ahmed', gender: 'female', parent: 'Faisal Ahmed' },
  { first: 'Muhammad', last: 'Ali', gender: 'male', parent: 'Nadeem Ali' },
  { first: 'Zoya', last: 'Malik', gender: 'female', parent: 'Usman Malik' },
  { first: 'Ibrahim', last: 'Raza', gender: 'male', parent: 'Kamran Raza' },
  { first: 'Areeba', last: 'Shah', gender: 'female', parent: 'Bilal Shah' },
  { first: 'Hamza', last: 'Iqbal', gender: 'male', parent: 'Sajid Iqbal' },
  { first: 'Maham', last: 'Hussain', gender: 'female', parent: 'Javed Hussain' },
  { first: 'Rayyan', last: 'Akram', gender: 'male', parent: 'Adnan Akram' },
  { first: 'Anaya', last: 'Butt', gender: 'female', parent: 'Noman Butt' },
  { first: 'Saad', last: 'Farooq', gender: 'male', parent: 'Waqas Farooq' },
  { first: 'Eman', last: 'Qureshi', gender: 'female', parent: 'Tariq Qureshi' },
  { first: 'Abdullah', last: 'Javed', gender: 'male', parent: 'Asif Javed' },
  { first: 'Minal', last: 'Yousaf', gender: 'female', parent: 'Sohail Yousaf' },
  { first: 'Haris', last: 'Nawaz', gender: 'male', parent: 'Rashid Nawaz' },
  { first: 'Laiba', last: 'Saeed', gender: 'female', parent: 'Arif Saeed' },
  { first: 'Taha', last: 'Zaman', gender: 'male', parent: 'Salman Zaman' },
  { first: 'Noor', last: 'Rizvi', gender: 'female', parent: 'Adeel Rizvi' },
  { first: 'Daniyal', last: 'Aslam', gender: 'male', parent: 'Naveed Aslam' },
  { first: 'Izza', last: 'Rana', gender: 'female', parent: 'Sami Rana' },
  { first: 'Fahad', last: 'Mirza', gender: 'male', parent: 'Kashif Mirza' },
  { first: 'Amna', last: 'Siddiqui', gender: 'female', parent: 'Yasir Siddiqui' },
  { first: 'Usman', last: 'Maqsood', gender: 'male', parent: 'Owais Maqsood' },
  { first: 'Maira', last: 'Latif', gender: 'female', parent: 'Naeem Latif' }
];

const subjectDefinitions = [
  ['ENG', 'English'], ['URD', 'Urdu'], ['MTH', 'Mathematics'], ['SCI', 'General Science'],
  ['GKN', 'General Knowledge'], ['ISL', 'Islamiyat'], ['PST', 'Pakistan Studies'],
  ['CMP', 'Computer Science'], ['PHY', 'Physics'], ['CHM', 'Chemistry'], ['BIO', 'Biology']
] as const;

const teacherNames = [
  ['Nadia', 'Siddiqui', 'English'], ['Sana', 'Rashid', 'Urdu'], ['Faisal', 'Mehmood', 'Mathematics'],
  ['Amina', 'Khalid', 'Science'], ['Hassan', 'Tariq', 'Computer Science'], ['Rabia', 'Naseer', 'Islamiyat'],
  ['Omar', 'Farid', 'Pakistan Studies'], ['Hira', 'Aziz', 'Biology'], ['Bilal', 'Akhtar', 'Physics'], ['Saira', 'Jamil', 'Chemistry']
] as const;

const officeStaff = [
  ['Usman', 'Riaz', 'Accountant', 'accountant'], ['Mehwish', 'Iqbal', 'Receptionist', 'receptionist'],
  ['Kashif', 'Naeem', 'Admin Assistant', 'staff'], ['Farah', 'Munir', 'Librarian', 'staff'], ['Dawood', 'Akbar', 'IT Officer', 'staff']
] as const;

function toId(result: Database.RunResult) {
  return Number(result.lastInsertRowid);
}

function dateOffset(days: number) {
  const value = new Date(`${today()}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function recentSchoolDays(count: number) {
  const result: string[] = [];
  let cursor = new Date(`${today()}T00:00:00Z`);
  while (result.length < count) {
    const day = cursor.getUTCDay();
    if (day > 0 && day < 6) result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return result.reverse();
}

export class DemoService {
  status() {
    const db = getDatabase();
    const count = (table: string) => Number((db.prepare(`SELECT COUNT(*) total FROM ${table}`).get() as { total: number }).total);
    const initialized = (db.prepare("SELECT value FROM settings WHERE key='system.demo_initialized'").get() as { value: string } | undefined)?.value === 'true';
    const totals = { classes: count('classes'), staff: count('staff'), students: count('students'), invoices: count('invoices'), exams: count('exams') };
    return {
      initialized,
      can_initialize: totals.students === 0 && totals.staff === 0 && totals.invoices === 0,
      totals,
      demo_credentials: initialized ? { teacher: 'teacher01 / Demo123!', receptionist: 'reception / Demo123!' } : null
    };
  }

  initialize(actorId: number) {
    const db = getDatabase();
    const state = this.status();
    if (!state.can_initialize) throw new ApiError(422, 'Demo initialization is available only on a clean database. Back up or restore before replacing existing operational data.');

    db.transaction(() => {
      const sessionId = this.ensureCurrentSession(db);
      const roles = this.roleMap(db);
      const adminId = this.adminId(db, actorId);
      const lookups = this.createLookups(db);
      const teachers = this.createTeachers(db, roles, lookups, adminId);
      this.createOfficeStaff(db, roles, lookups, adminId);
      const academic = this.createAcademicData(db, sessionId, teachers, lookups);
      const students = this.createStudents(db, sessionId, academic);
      this.createTimetable(db, sessionId, academic, teachers);
      this.createAttendance(db, sessionId, academic, students, teachers, adminId);
      this.createFinance(db, sessionId, academic, students, adminId);
      this.createAssessments(db, sessionId, academic, students, teachers, adminId);
      this.createVisitors(db, adminId);
      this.createMessages(db, students, adminId);
      this.saveSetting(db, 'school.name', 'Green Valley School', 'school', adminId);
      this.saveSetting(db, 'school.address', 'Murree Road, Rawalpindi, Punjab, Pakistan', 'school', adminId);
      this.saveSetting(db, 'school.phone', '+92 51 555 0100', 'school', adminId);
      this.saveSetting(db, 'school.email', 'info@greenvalleyschool.edu.pk', 'school', adminId);
      this.saveSetting(db, 'school.website', 'https://greenvalleyschool.edu.pk', 'school', adminId);
      this.saveSetting(db, 'school.tagline', 'Learning for a brighter future', 'school', adminId);
      this.saveSetting(db, 'school.principal_name', 'Dr. Ayesha Siddiqui', 'school', adminId);
      this.saveSetting(db, 'system.demo_initialized', 'true', 'system', adminId);
      db.prepare(`INSERT INTO activity_logs (user_id,action,entity_type,summary,meta_json) VALUES (?,?,?,?,?)`)
        .run(adminId, 'demo_initialized', 'system', 'Initialized Green Valley School demo dataset', JSON.stringify({ students: students.length, teachers: teachers.length }));
    })();

    return this.status();
  }

  private ensureCurrentSession(db: Database.Database) {
    const current = db.prepare('SELECT id FROM school_sessions WHERE is_current=1').get() as { id: number } | undefined;
    if (current) return current.id;
    const year = new Date().getFullYear();
    return toId(db.prepare(`INSERT INTO school_sessions (name,starts_on,ends_on,is_current,status) VALUES (?,?,?,?,?)`)
      .run(`${year}-${year + 1}`, `${year}-04-01`, `${year + 1}-03-31`, 1, 'active'));
  }

  private roleMap(db: Database.Database) {
    const rows = db.prepare('SELECT id,code FROM roles').all() as { id: number; code: string }[];
    return new Map(rows.map((row) => [row.code, row.id]));
  }

  private adminId(db: Database.Database, fallbackId: number) {
    const admin = db.prepare("SELECT id FROM users WHERE username='admin' COLLATE NOCASE").get() as { id: number } | undefined;
    return admin?.id || fallbackId;
  }

  private createLookups(db: Database.Database) {
    const departmentInsert = db.prepare('INSERT OR IGNORE INTO departments (name,description) VALUES (?,?)');
    [['Academics', 'Teaching and learning'], ['Administration', 'School administration'], ['Finance', 'Accounts and fee operations'], ['Support Services', 'Library, IT and campus services']]
      .forEach(([name, description]) => departmentInsert.run(name, description));
    const designationInsert = db.prepare('INSERT OR IGNORE INTO designations (name,description) VALUES (?,?)');
    ['Principal', 'Class Teacher', 'Subject Teacher', 'Accountant', 'Receptionist', 'Admin Assistant', 'Librarian', 'IT Officer']
      .forEach((name) => designationInsert.run(name, `${name} role`));
    const departmentRows = db.prepare('SELECT id,name FROM departments').all() as { id: number; name: string }[];
    const designationRows = db.prepare('SELECT id,name FROM designations').all() as { id: number; name: string }[];
    return {
      departments: new Map(departmentRows.map((row) => [row.name, row.id])),
      designations: new Map(designationRows.map((row) => [row.name, row.id]))
    };
  }

  private createTeachers(db: Database.Database, roles: Map<string, number>, lookups: ReturnType<DemoService['createLookups']>, actorId: number) {
    const userInsert = db.prepare(`INSERT INTO users (full_name,username,password_hash,role_id,status,must_change_password,created_by) VALUES (?,?,?,?,?,?,?)`);
    const staffInsert = db.prepare(`INSERT INTO staff (employee_no,user_id,first_name,last_name,qualification,department_id,designation_id,employment_type,salary,joining_date,phone,whatsapp,email,address,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const salaryInsert = db.prepare(`INSERT INTO staff_salary_history (staff_id,amount,effective_from,note,created_by) VALUES (?,?,?,?,?)`);
    const passwordHash = bcrypt.hashSync('Demo123!', 12);
    const teacherIds: number[] = [];
    teacherNames.forEach(([first, last, specialization], index) => {
      const roleCode = index < 4 ? 'class_teacher' : 'subject_teacher';
      const userId = toId(userInsert.run(`${first} ${last}`, `teacher${String(index + 1).padStart(2, '0')}`, passwordHash, roles.get(roleCode), 'active', 1, actorId));
      const salary = 48000 + index * 2500;
      const staffId = toId(staffInsert.run(`TCH-${String(index + 1).padStart(3, '0')}`, userId, first, last, `M.Ed. (${specialization})`, lookups.departments.get('Academics'), lookups.designations.get(index < 4 ? 'Class Teacher' : 'Subject Teacher'), 'permanent', salary, dateOffset(-540 - index * 15), `0301${String(1100000 + index).slice(-7)}`, `0301${String(1100000 + index).slice(-7)}`, `${first.toLowerCase()}.${last.toLowerCase()}@greenvalleyschool.edu.pk`, 'Rawalpindi', 'active'));
      salaryInsert.run(staffId, salary, dateOffset(-540 - index * 15), 'Demo opening salary', actorId);
      teacherIds.push(staffId);
    });
    return teacherIds;
  }

  private createOfficeStaff(db: Database.Database, roles: Map<string, number>, lookups: ReturnType<DemoService['createLookups']>, actorId: number) {
    const userInsert = db.prepare(`INSERT INTO users (full_name,username,password_hash,role_id,status,must_change_password,created_by) VALUES (?,?,?,?,?,?,?)`);
    const staffInsert = db.prepare(`INSERT INTO staff (employee_no,user_id,first_name,last_name,qualification,department_id,designation_id,employment_type,salary,joining_date,phone,whatsapp,email,address,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const salaryInsert = db.prepare(`INSERT INTO staff_salary_history (staff_id,amount,effective_from,note,created_by) VALUES (?,?,?,?,?)`);
    const passwordHash = bcrypt.hashSync('Demo123!', 12);
    officeStaff.forEach(([first, last, designation, role], index) => {
      const department = designation === 'Accountant' ? 'Finance' : designation === 'Librarian' || designation === 'IT Officer' ? 'Support Services' : 'Administration';
      const username = role === 'accountant' ? 'accountant' : role === 'receptionist' ? 'reception' : `office${index + 1}`;
      const userId = toId(userInsert.run(`${first} ${last}`, username, passwordHash, roles.get(role), 'active', 1, actorId));
      const salary = 35000 + index * 2200;
      const staffId = toId(staffInsert.run(`OFF-${String(index + 1).padStart(3, '0')}`, userId, first, last, 'Bachelor Degree', lookups.departments.get(department), lookups.designations.get(designation), 'permanent', salary, dateOffset(-400 - index * 10), `0302${String(2200000 + index).slice(-7)}`, `0302${String(2200000 + index).slice(-7)}`, `${username}@greenvalleyschool.edu.pk`, 'Rawalpindi', 'active'));
      salaryInsert.run(staffId, salary, dateOffset(-400 - index * 10), 'Demo opening salary', actorId);
    });
  }

  private createAcademicData(db: Database.Database, sessionId: number, teachers: number[], lookups: ReturnType<DemoService['createLookups']>) {
    const classInsert = db.prepare(`INSERT INTO classes (code,name,display_order,head_teacher_id,status) VALUES (?,?,?,?,?)`);
    const sectionInsert = db.prepare(`INSERT INTO sections (class_id,name,capacity,class_teacher_id,room,status) VALUES (?,?,?,?,?,?)`);
    const roomInsert = db.prepare(`INSERT OR IGNORE INTO rooms (name,capacity,description,status) VALUES (?,?,?,?)`);
    const subjectInsert = db.prepare(`INSERT OR IGNORE INTO subjects (code,name,max_marks,pass_marks,status) VALUES (?,?,?,?,?)`);
    const assignmentInsert = db.prepare(`INSERT OR IGNORE INTO class_subjects (class_id,section_id,subject_id,teacher_id,weekly_periods) VALUES (?,?,?,?,?)`);
    const classIds = new Map<string, number>();
    const sectionAIds = new Map<string, number>();
    const roomIds = new Map<string, number>();

    demoClasses.forEach((item, index) => {
      roomInsert.run(`${item.code}-A`, 28, `${item.name} classroom A`, 'active');
      roomInsert.run(`${item.code}-B`, 28, `${item.name} classroom B`, 'active');
      const classId = toId(classInsert.run(item.code, item.name, index + 1, teachers[index % teachers.length], 'active'));
      const sectionA = toId(sectionInsert.run(classId, 'A', 28, teachers[index % 4], `${item.code}-A`, 'active'));
      sectionInsert.run(classId, 'B', 28, teachers[(index + 1) % 4], `${item.code}-B`, 'active');
      classIds.set(item.code, classId);
      sectionAIds.set(item.code, sectionA);
    });
    roomInsert.run('SCI-LAB', 35, 'Science laboratory', 'active');
    roomInsert.run('COMP-LAB', 30, 'Computer laboratory', 'active');
    (db.prepare('SELECT id,name FROM rooms').all() as { id: number; name: string }[]).forEach((row) => roomIds.set(row.name, row.id));

    subjectDefinitions.forEach(([code, name]) => subjectInsert.run(code, name, 100, 40, 'active'));
    const subjectIds = new Map((db.prepare('SELECT id,code FROM subjects').all() as { id: number; code: string }[]).map((row) => [row.code, row.id]));
    demoClasses.forEach((item, classIndex) => {
      const subjects = classIndex < 2 ? ['ENG', 'URD', 'MTH', 'GKN'] : classIndex < 5 ? ['ENG', 'URD', 'MTH', 'SCI', 'ISL', 'CMP'] : classIndex < 8 ? ['ENG', 'URD', 'MTH', 'SCI', 'ISL', 'PST', 'CMP'] : ['ENG', 'URD', 'MTH', 'PHY', 'CHM', 'BIO', 'PST', 'CMP'];
      subjects.forEach((code, subjectIndex) => assignmentInsert.run(classIds.get(item.code), null, subjectIds.get(code), teachers[(classIndex + subjectIndex) % teachers.length], code === 'CMP' ? 2 : 4));
    });

    return { sessionId, classIds, sectionAIds, subjectIds, roomIds, lookups };
  }

  private createStudents(db: Database.Database, sessionId: number, academic: ReturnType<DemoService['createAcademicData']>) {
    const studentInsert = db.prepare(`INSERT INTO students (admission_no,first_name,last_name,gender,date_of_birth,b_form_no,photo_path,blood_group,religion,nationality,phone,whatsapp,email,address,emergency_contact,admission_date,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const contactInsert = db.prepare(`INSERT INTO student_contacts (student_id,contact_type,full_name,relation,phone,whatsapp,occupation,is_primary) VALUES (?,?,?,?,?,?,?,?)`);
    const enrollmentInsert = db.prepare(`INSERT INTO enrollments (student_id,session_id,class_id,section_id,roll_no,started_on,status) VALUES (?,?,?,?,?,?,?)`);
    const result: { id: number; classCode: string; sectionId: number; rollNo: string; phone: string }[] = [];
    demoStudents.forEach((student, index) => {
      const classItem = demoClasses[Math.floor(index / 2)];
      const roll = String((index % 2) + 1);
      const admissionNo = `DEMO-${String(index + 1).padStart(4, '0')}`;
      const phone = `0303${String(3300000 + index).slice(-7)}`;
      const studentId = toId(studentInsert.run(admissionNo, student.first, student.last, student.gender, dateOffset(-(1800 + index * 35)), `35202-${String(1000000 + index).padStart(7, '0')}-1`, null, index % 4 === 0 ? 'O+' : index % 4 === 1 ? 'A+' : index % 4 === 2 ? 'B+' : 'AB+', 'Islam', 'Pakistani', phone, phone, `${student.first.toLowerCase()}.${student.last.toLowerCase()}@demo.local`, 'Rawalpindi, Punjab', phone, dateOffset(-(120 + index)), 'active'));
      contactInsert.run(studentId, 'father', student.parent, 'Father', phone, phone, index % 2 ? 'Business' : 'Government Service', 1);
      enrollmentInsert.run(studentId, sessionId, academic.classIds.get(classItem.code), academic.sectionAIds.get(classItem.code), roll, dateOffset(-(120 + index)), 'active');
      result.push({ id: studentId, classCode: classItem.code, sectionId: academic.sectionAIds.get(classItem.code)!, rollNo: roll, phone });
    });
    return result;
  }

  private createTimetable(db: Database.Database, sessionId: number, academic: ReturnType<DemoService['createAcademicData']>, teachers: number[]) {
    const periods = db.prepare(`SELECT id,sequence FROM timetable_periods WHERE period_type='lesson' ORDER BY sequence LIMIT 5`).all() as { id: number; sequence: number }[];
    const assignmentRows = db.prepare(`SELECT class_id,subject_id,teacher_id FROM class_subjects WHERE section_id IS NULL ORDER BY id`).all() as { class_id: number; subject_id: number; teacher_id: number | null }[];
    const insert = db.prepare(`INSERT OR IGNORE INTO timetable_entries (session_id,class_id,section_id,weekday,period_id,subject_id,teacher_id,room_id,note) VALUES (?,?,?,?,?,?,?,?,?)`);
    ['NUR', 'G1', 'G5', 'G10'].forEach((classCode, classIndex) => {
      const classId = academic.classIds.get(classCode)!;
      const subjects = assignmentRows.filter((row) => row.class_id === classId);
      for (let day = 1; day <= 5; day += 1) {
        periods.forEach((period, periodIndex) => {
          const assignment = subjects[(day + periodIndex) % subjects.length];
          const teacherId = assignment.teacher_id || teachers[(classIndex + periodIndex) % teachers.length];
          const roomName = classIndex === 2 && periodIndex === 3 ? 'SCI-LAB' : classIndex === 3 && periodIndex === 4 ? 'COMP-LAB' : `${classCode}-A`;
          insert.run(sessionId, classId, academic.sectionAIds.get(classCode), day, period.id, assignment.subject_id, teacherId, academic.roomIds.get(roomName), 'Demo timetable lesson');
        });
      }
    });
  }

  private createAttendance(db: Database.Database, sessionId: number, academic: ReturnType<DemoService['createAcademicData']>, students: ReturnType<DemoService['createStudents']>, teachers: number[], adminId: number) {
    const sessionInsert = db.prepare(`INSERT INTO attendance_sessions (attendance_date,session_id,class_id,section_id,marked_by,locked) VALUES (?,?,?,?,?,?)`);
    const recordInsert = db.prepare(`INSERT INTO attendance_records (attendance_session_id,student_id,status,remarks) VALUES (?,?,?,?)`);
    const staffInsert = db.prepare(`INSERT INTO staff_attendance (staff_id,attendance_date,status,check_in,check_out,remarks,marked_by) VALUES (?,?,?,?,?,?,?)`);
    recentSchoolDays(10).forEach((day, dateIndex) => {
      demoClasses.forEach((classItem, classIndex) => {
        const attendanceId = toId(sessionInsert.run(day, sessionId, academic.classIds.get(classItem.code), academic.sectionAIds.get(classItem.code), adminId, dateIndex < 8 ? 1 : 0));
        students.filter((student) => student.classCode === classItem.code).forEach((student, studentIndex) => {
          const status = (dateIndex + studentIndex + classIndex) % 13 === 0 ? 'absent' : (dateIndex + studentIndex) % 9 === 0 ? 'late' : 'present';
          recordInsert.run(attendanceId, student.id, status, status === 'late' ? 'Arrived after assembly' : null);
        });
      });
      teachers.forEach((staffId, index) => staffInsert.run(staffId, day, (dateIndex + index) % 17 === 0 ? 'leave' : 'present', '07:50', '14:20', null, adminId));
      (db.prepare(`SELECT id FROM staff WHERE designation_id IN (?, ?, ?, ?, ?)`).all(academic.lookups.designations.get('Accountant'), academic.lookups.designations.get('Receptionist'), academic.lookups.designations.get('Admin Assistant'), academic.lookups.designations.get('Librarian'), academic.lookups.designations.get('IT Officer')) as { id: number }[])
        .forEach((staff, index) => staffInsert.run(staff.id, day, (dateIndex + index) % 19 === 0 ? 'late' : 'present', '08:05', '16:00', null, adminId));
    });
  }

  private createFinance(db: Database.Database, sessionId: number, academic: ReturnType<DemoService['createAcademicData']>, students: ReturnType<DemoService['createStudents']>, adminId: number) {
    const heads = new Map((db.prepare('SELECT id,code FROM fee_heads').all() as { id: number; code: string }[]).map((row) => [row.code, row.id]));
    const structureInsert = db.prepare(`INSERT INTO fee_structures (session_id,class_id,section_id,fee_head_id,amount,frequency,due_day,status) VALUES (?,?,?,?,?,?,?,?)`);
    demoClasses.forEach((item) => {
      const classId = academic.classIds.get(item.code)!;
      const sections = db.prepare('SELECT id FROM sections WHERE class_id=?').all(classId) as { id: number }[];
      sections.forEach((section) => {
        structureInsert.run(sessionId, classId, section.id, heads.get('MONTHLY'), item.monthlyFee, 'monthly', 10, 'active');
        structureInsert.run(sessionId, classId, section.id, heads.get('EXAM'), 600, 'quarterly', 15, 'active');
        structureInsert.run(sessionId, classId, section.id, heads.get('TRANSPORT'), 1800, 'monthly', 10, 'active');
      });
    });
    const invoiceInsert = db.prepare(`INSERT INTO invoices (invoice_no,student_id,session_id,issue_date,due_date,billing_month,subtotal,discount,fine,total,paid_amount,status,note,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const itemInsert = db.prepare(`INSERT INTO invoice_items (invoice_id,fee_head_id,description,amount,discount) VALUES (?,?,?,?,?)`);
    const paymentInsert = db.prepare(`INSERT INTO payments (receipt_no,student_id,payment_date,amount,method,note,received_by) VALUES (?,?,?,?,?,?,?)`);
    const allocationInsert = db.prepare(`INSERT INTO payment_allocations (payment_id,invoice_id,amount) VALUES (?,?,?)`);
    const month = today().slice(0, 7);
    students.forEach((student, index) => {
      const fee = demoClasses.find((item) => item.code === student.classCode)!.monthlyFee;
      const total = fee + 600;
      const paid = index % 3 === 0 ? total : index % 3 === 1 ? Math.round(total * 0.55) : 0;
      const status = paid === total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      const invoiceId = toId(invoiceInsert.run(`DEMO-INV-${String(index + 1).padStart(4, '0')}`, student.id, sessionId, `${month}-01`, `${month}-10`, month, total, 0, 0, total, paid, status, 'Demo monthly invoice', adminId));
      itemInsert.run(invoiceId, heads.get('MONTHLY'), 'Monthly Tuition Fee', fee, 0);
      itemInsert.run(invoiceId, heads.get('EXAM'), 'Assessment Fee', 600, 0);
      if (paid) {
        const paymentDate = index % 4 === 0 ? today() : `${month}-05`;
        const paymentId = toId(paymentInsert.run(`DEMO-RCT-${String(index + 1).padStart(4, '0')}`, student.id, paymentDate, paid, index % 2 ? 'bank' : 'cash', 'Demo payment', adminId));
        allocationInsert.run(paymentId, invoiceId, paid);
      }
    });
    const category = db.prepare("SELECT id FROM expense_categories WHERE name='Utilities'").get() as { id: number } | undefined;
    const incomeInsert = db.prepare(`INSERT INTO income_entries (income_date,category,amount,description,reference_no,created_by) VALUES (?,?,?,?,?,?)`);
    const expenseInsert = db.prepare(`INSERT INTO expenses (expense_date,category_id,amount,description,payment_method,reference_no,created_by) VALUES (?,?,?,?,?,?,?)`);
    [2, 1, 0].forEach((offset, index) => {
      const monthDate = dateOffset(-offset * 30);
      incomeInsert.run(monthDate, 'Donations', 12000 + index * 3000, 'Community contribution', `INC-DEMO-${index + 1}`, adminId);
      expenseInsert.run(monthDate, category?.id || null, 18000 + index * 2500, 'Electricity and utilities', 'bank', `EXP-DEMO-${index + 1}`, adminId);
    });
  }

  private createAssessments(db: Database.Database, sessionId: number, academic: ReturnType<DemoService['createAcademicData']>, students: ReturnType<DemoService['createStudents']>, teachers: number[], adminId: number) {
    const grade5 = academic.classIds.get('G5')!;
    const grade5Section = academic.sectionAIds.get('G5')!;
    const math = academic.subjectIds.get('MTH')!;
    const english = academic.subjectIds.get('ENG')!;
    const testInsert = db.prepare(`INSERT INTO class_tests (name,test_date,session_id,class_id,section_id,subject_id,teacher_id,total_marks,passing_marks,contribution_percent,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const testMarkInsert = db.prepare(`INSERT INTO class_test_marks (class_test_id,student_id,obtained_marks,remarks,entered_by) VALUES (?,?,?,?,?)`);
    const grade5Students = students.filter((student) => student.classCode === 'G5');
    [math, english].forEach((subjectId, subjectIndex) => {
      const testId = toId(testInsert.run(subjectIndex ? 'English Unit Test 2' : 'Mathematics Unit Test 2', dateOffset(-8), sessionId, grade5, grade5Section, subjectId, teachers[subjectIndex], 20, 8, 25, 'published', adminId));
      grade5Students.forEach((student, studentIndex) => testMarkInsert.run(testId, student.id, 15 + subjectIndex + studentIndex * 2, 'Good progress', adminId));
    });
    const midType = db.prepare("SELECT id FROM exam_types WHERE code='MID'").get() as { id: number } | undefined;
    const examInsert = db.prepare(`INSERT INTO exams (name,exam_type_id,session_id,starts_on,ends_on,class_test_weight,exam_weight,status,created_by,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const subjectInsert = db.prepare(`INSERT INTO exam_subjects (exam_id,class_id,section_id,subject_id,teacher_id,exam_date,total_marks,passing_marks) VALUES (?,?,?,?,?,?,?,?)`);
    const markInsert = db.prepare(`INSERT INTO exam_marks (exam_subject_id,student_id,obtained_marks,remarks,entered_by) VALUES (?,?,?,?,?)`);
    const publishedExam = toId(examInsert.run('Demo Mid-Term Examination', midType?.id || null, sessionId, dateOffset(-18), dateOffset(-12), 25, 75, 'published', adminId, adminId, dateOffset(-10)));
    [math, english, academic.subjectIds.get('SCI')!, academic.subjectIds.get('ISL')!].forEach((subjectId, index) => {
      const examSubjectId = toId(subjectInsert.run(publishedExam, grade5, grade5Section, subjectId, teachers[index], dateOffset(-18 + index), 100, 40));
      grade5Students.forEach((student, studentIndex) => markInsert.run(examSubjectId, student.id, 72 + index * 3 + studentIndex * 5, 'Satisfactory', adminId));
    });
    const grade10 = academic.classIds.get('G10')!;
    const upcomingExam = toId(examInsert.run('Final Term Examination (Upcoming)', midType?.id || null, sessionId, dateOffset(14), dateOffset(22), 25, 75, 'draft', adminId, null, null));
    subjectInsert.run(upcomingExam, grade10, academic.sectionAIds.get('G10'), math, teachers[2], dateOffset(14), 100, 40);
  }

  private createVisitors(db: Database.Database, adminId: number) {
    const insert = db.prepare(`INSERT INTO visitor_logs (visitor_name,phone,cnic,purpose,person_to_meet,check_in,check_out,note,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    insert.run('Mr. Hamid Iqbal', '03005550001', '35202-1234567-1', 'Parent meeting', 'Class Teacher Grade 5', `${today()}T08:40:00`, `${today()}T09:15:00`, 'Discussed student progress', 'checked_out', adminId);
    insert.run('Ms. Sarah Khan', '03005550002', null, 'Admission inquiry', 'Reception', `${today()}T10:10:00`, null, 'Interested in Grade 3 admission', 'checked_in', adminId);
  }

  private createMessages(db: Database.Database, students: ReturnType<DemoService['createStudents']>, adminId: number) {
    const insert = db.prepare(`INSERT INTO sms_logs (student_id,phone,message,template_code,channel,status,provider_response,sent_by,sent_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    students.slice(0, 6).forEach((student, index) => {
      const status = index % 3 === 0 ? 'delivered' : index % 3 === 1 ? 'sent' : 'queued';
      insert.run(student.id, student.phone, `Dear parent, demo fee reminder for ${student.rollNo}.`, 'fee_due', 'sms', status, status === 'delivered' ? 'Delivered by demo gateway' : null, adminId, status === 'queued' ? null : `${today()}T09:${String(index + 10).padStart(2, '0')}:00`);
    });
  }

  private saveSetting(db: Database.Database, key: string, value: string, groupName: string, userId: number) {
    db.prepare(`INSERT INTO settings (key,value,group_name,updated_by,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,group_name=excluded.group_name,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
      .run(key, value, groupName, userId);
  }
}
