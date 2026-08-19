import bcrypt from 'bcrypt';
import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { pagination, required } from '../utils/http';
import { nullable, number, today } from '../utils/serializers';

const fields = ['employee_no', 'first_name', 'last_name', 'photo_path', 'cnic', 'qualification', 'department_id', 'designation_id', 'employment_type', 'salary', 'joining_date', 'leaving_date', 'phone', 'whatsapp', 'email', 'address', 'emergency_contact', 'status'] as const;
type Field = typeof fields[number];

export class StaffService {
  list(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query as never);
    const conditions = ['1=1']; const params: unknown[] = [];
    if (typeof query.search === 'string' && query.search.trim()) { const value = `%${query.search.trim()}%`; conditions.push('(s.employee_no LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.phone LIKE ?)'); params.push(value, value, value, value); }
    if (query.status) { conditions.push('s.status=?'); params.push(query.status); }
    if (query.department_id) { conditions.push('s.department_id=?'); params.push(Number(query.department_id)); }
    const where = conditions.join(' AND '); const db = getDatabase();
    const from = `FROM staff s LEFT JOIN departments d ON d.id=s.department_id LEFT JOIN designations des ON des.id=s.designation_id LEFT JOIN users u ON u.id=s.user_id`;
    const total = (db.prepare(`SELECT COUNT(*) total ${from} WHERE ${where}`).get(...params) as { total: number }).total;
    const data = db.prepare(`SELECT s.*,d.name department_name,des.name designation_name,u.username,u.status login_status ${from} WHERE ${where} ORDER BY s.first_name,s.last_name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  options() { return getDatabase().prepare(`SELECT s.id,s.employee_no,s.first_name,s.last_name,s.department_id,s.designation_id FROM staff s WHERE s.status='active' ORDER BY s.first_name,s.last_name`).all(); }

  workspace(userId: number) {
    const db = getDatabase();
    const staff = db.prepare(`SELECT s.*,d.name department_name,des.name designation_name FROM staff s LEFT JOIN departments d ON d.id=s.department_id LEFT JOIN designations des ON des.id=s.designation_id WHERE s.user_id=? AND s.status='active'`).get(userId) as { id: number } | undefined;
    if (!staff) return { staff: null, class_assignments: [], class_teacher_sections: [], today_timetable: [] };
    const currentSession = db.prepare('SELECT id FROM school_sessions WHERE is_current=1').get() as { id: number } | undefined;
    const weekday = new Date().getDay();
    const classAssignments = db.prepare(`SELECT cs.*,c.name class_name,sec.name section_name,sub.name subject_name,sub.code subject_code FROM class_subjects cs JOIN classes c ON c.id=cs.class_id LEFT JOIN sections sec ON sec.id=cs.section_id JOIN subjects sub ON sub.id=cs.subject_id WHERE cs.teacher_id=? ORDER BY c.display_order,sub.name`).all(staff.id);
    const classTeacherSections = db.prepare(`SELECT sec.id,sec.name section_name,c.id class_id,c.name class_name FROM sections sec JOIN classes c ON c.id=sec.class_id WHERE sec.class_teacher_id=? ORDER BY c.display_order,sec.name`).all(staff.id);
    const timetable = currentSession ? db.prepare(`SELECT te.*,p.name period_name,p.start_time,p.end_time,sub.name subject_name,c.name class_name,sec.name section_name,r.name room_name FROM timetable_entries te JOIN timetable_periods p ON p.id=te.period_id JOIN classes c ON c.id=te.class_id LEFT JOIN sections sec ON sec.id=te.section_id LEFT JOIN subjects sub ON sub.id=te.subject_id LEFT JOIN rooms r ON r.id=te.room_id WHERE te.session_id=? AND te.teacher_id=? AND te.weekday=? ORDER BY p.sequence`).all(currentSession.id, staff.id, weekday) : [];
    return { staff, class_assignments: classAssignments, class_teacher_sections: classTeacherSections, today_timetable: timetable };
  }

  get(id: number) {
    const db = getDatabase();
    const staff = db.prepare(`SELECT s.*,d.name department_name,des.name designation_name,u.username,u.status login_status,u.role_id FROM staff s LEFT JOIN departments d ON d.id=s.department_id LEFT JOIN designations des ON des.id=s.designation_id LEFT JOIN users u ON u.id=s.user_id WHERE s.id=?`).get(id);
    if (!staff) throw new ApiError(404, 'Staff member not found');
    const salary_history = db.prepare('SELECT * FROM staff_salary_history WHERE staff_id=? ORDER BY effective_from DESC').all(id);
    const attendance = db.prepare('SELECT * FROM staff_attendance WHERE staff_id=? ORDER BY attendance_date DESC LIMIT 90').all(id);
    const attendance_summary = db.prepare(`SELECT COUNT(*) total_days,COALESCE(SUM(status IN ('present','late')),0) present_days,COALESCE(SUM(status='absent'),0) absent_days,COALESCE(SUM(status='leave'),0) leave_days,COALESCE(SUM(status='late'),0) late_days FROM staff_attendance WHERE staff_id=?`).get(id) as { total_days: number; present_days: number; absent_days: number; leave_days: number; late_days: number };
    const attendance_monthly = db.prepare(`SELECT substr(attendance_date,1,7) month,COUNT(*) total_days,COALESCE(SUM(status IN ('present','late')),0) present_days,COALESCE(SUM(status='absent'),0) absent_days,COALESCE(SUM(status='leave'),0) leave_days,COALESCE(SUM(status='late'),0) late_days FROM staff_attendance WHERE staff_id=? GROUP BY substr(attendance_date,1,7) ORDER BY month DESC LIMIT 12`).all(id);
    const attendance_percentage = attendance_summary.total_days ? Number((attendance_summary.present_days * 100 / attendance_summary.total_days).toFixed(1)) : 0;
    return { ...staff as object, salary_history, attendance, attendance_summary: { ...attendance_summary, percentage: attendance_percentage }, attendance_monthly };
  }

  create(input: Record<string, unknown>, actorId: number) {
    const db = getDatabase();
    const employeeNo = required(input.employee_no, 'Employee number');
    const firstName = required(input.first_name, 'First name');
    const joining = required(input.joining_date, 'Joining date');
    let id = 0;
    db.transaction(() => {
      const userId = input.login && typeof input.login === 'object' ? this.createLogin(input.login as Record<string, unknown>, firstName, actorId) : nullable(input.user_id);
      const values = this.values(input, { employee_no: employeeNo, first_name: firstName, joining_date: joining });
      id = Number(db.prepare(`INSERT INTO staff (user_id,${fields.join(',')}) VALUES (?,${fields.map(() => '?').join(',')})`).run(userId, ...fields.map((field) => values[field])).lastInsertRowid);
      if (number(values.salary) > 0) db.prepare(`INSERT INTO staff_salary_history (staff_id,amount,effective_from,note,created_by) VALUES (?,?,?,?,?)`).run(id, number(values.salary), joining, 'Initial salary', actorId);
    })();
    return this.get(id);
  }

  update(id: number, input: Record<string, unknown>, actorId: number) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM staff WHERE id=?').get(id) as Record<string, unknown> | undefined;
    if (!existing) throw new ApiError(404, 'Staff member not found');
    db.transaction(() => {
      const values = this.values({ ...input, _existing: existing });
      db.prepare(`UPDATE staff SET ${fields.map((field) => `${field}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...fields.map((field) => values[field]), id);
      if (input.salary !== undefined && number(input.salary) !== number(existing.salary)) this.addSalary(id, number(input.salary), String(input.salary_effective_from || today()), String(input.salary_note || 'Salary revision'), actorId);
      if (input.login && typeof input.login === 'object' && !existing.user_id) {
        const userId = this.createLogin(input.login as Record<string, unknown>, String(values.first_name), actorId);
        db.prepare('UPDATE staff SET user_id=? WHERE id=?').run(userId, id);
      }
    })();
    return this.get(id);
  }

  archive(id: number) {
    const result = getDatabase().prepare(`UPDATE staff SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
    if (!result.changes) throw new ApiError(404, 'Staff member not found');
  }

  addSalary(id: number, amount: number, effectiveFrom: string, note: string, actorId: number) {
    if (amount < 0) throw new ApiError(422, 'Salary cannot be negative');
    const db = getDatabase();
    if (!db.prepare('SELECT 1 FROM staff WHERE id=?').get(id)) throw new ApiError(404, 'Staff member not found');
    db.prepare(`INSERT INTO staff_salary_history (staff_id,amount,effective_from,note,created_by) VALUES (?,?,?,?,?)`).run(id, amount, effectiveFrom, note, actorId);
    db.prepare('UPDATE staff SET salary=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(amount, id);
  }

  departments() { return getDatabase().prepare(`SELECT * FROM departments ORDER BY name`).all(); }
  designations() { return getDatabase().prepare(`SELECT * FROM designations ORDER BY name`).all(); }
  manageLookup(table: 'departments' | 'designations', name: string) {
    const result = getDatabase().prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(required(name, 'Name'));
    return getDatabase().prepare(`SELECT * FROM ${table} WHERE id=?`).get(result.lastInsertRowid);
  }

  private values(input: Record<string, unknown>, overrides: Partial<Record<Field, unknown>> = {}) {
    const existing = input._existing as Record<string, unknown> | undefined; const result: Record<string, unknown> = {};
    for (const field of fields) result[field] = field in overrides ? overrides[field] : field in input ? nullable(input[field]) : existing?.[field] ?? null;
    result.salary = number(result.salary); result.employment_type = result.employment_type || 'permanent';
    result.status = ['active', 'inactive', 'archived'].includes(String(result.status)) ? result.status : 'active';
    return result;
  }

  private createLogin(login: Record<string, unknown>, fallbackName: string, actorId: number) {
    const username = required(login.username, 'Login username'); const password = required(login.password, 'Login password'); const roleId = Number(login.role_id);
    if (password.length < 8 || !roleId) throw new ApiError(422, 'A valid role and password of at least 8 characters are required');
    if (!getDatabase().prepare('SELECT 1 FROM roles WHERE id=?').get(roleId)) throw new ApiError(422, 'Login role is invalid');
    return getDatabase().prepare(`INSERT INTO users (full_name,username,password_hash,role_id,status,must_change_password,created_by) VALUES (?,?,?,?,?,?,?)`)
      .run(String(login.full_name || fallbackName), username, bcrypt.hashSync(password, 12), roleId, 'active', 1, actorId).lastInsertRowid;
  }
}
