import { getDatabase } from '../../database';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/errors';
import { nullable, today } from '../utils/serializers';

const statuses = ['present', 'absent', 'leave', 'late'];
const currentSession = () => {
  const row = getDatabase().prepare('SELECT id FROM school_sessions WHERE is_current=1').get() as { id: number } | undefined;
  if (!row) throw new ApiError(422, 'Set a current academic session first'); return row.id;
};

export class AttendanceService {
  roster(query: Record<string, unknown>) {
    const classId=Number(query.class_id); if(!classId) throw new ApiError(422,'Class is required'); const sectionId=nullable(query.section_id); const date=String(query.date||today()); const sessionId=Number(query.session_id)||currentSession(); const db=getDatabase();
    const session=db.prepare(`SELECT id,locked,marked_by FROM attendance_sessions WHERE attendance_date=? AND session_id=? AND class_id=? AND section_id IS ?`).get(date,sessionId,classId,sectionId) as {id:number;locked:number;marked_by:number}|undefined;
    const students=db.prepare(`SELECT s.id AS student_id,s.admission_no,s.first_name,s.last_name,s.gender,e.roll_no,COALESCE(ar.status,'present') status,ar.remarks FROM enrollments e JOIN students s ON s.id=e.student_id LEFT JOIN attendance_records ar ON ar.student_id=s.id AND ar.attendance_session_id=? WHERE e.session_id=? AND e.class_id=? AND e.section_id IS ? AND e.status='active' AND s.status='active' ORDER BY CAST(e.roll_no AS INTEGER),s.first_name`).all(session?.id||0,sessionId,classId,sectionId);
    return { attendance_session: session || null, date, session_id:sessionId, students };
  }

  save(input: Record<string, unknown>, user: AuthUser) {
    const date=String(input.attendance_date||today()); const sessionId=Number(input.session_id)||currentSession(); const classId=Number(input.class_id); const sectionId=nullable(input.section_id); if(!classId || !Array.isArray(input.records))throw new ApiError(422,'Class and attendance records are required');
    const db=getDatabase(); let attendanceSessionId=0;
    db.transaction(()=>{
      let session=db.prepare(`SELECT * FROM attendance_sessions WHERE attendance_date=? AND session_id=? AND class_id=? AND section_id IS ?`).get(date,sessionId,classId,sectionId) as {id:number;locked:number;marked_by:number}|undefined;
      const manages=user.permissions.includes('attendance.manage');
      if(session?.locked && !manages) throw new ApiError(403,'This attendance sheet is locked. Only an administrator can edit it.');
      if(session && session.marked_by!==user.id && !manages) throw new ApiError(403,'Only the original teacher or an administrator can edit this attendance sheet.');
      if(!session) { attendanceSessionId=Number(db.prepare(`INSERT INTO attendance_sessions (attendance_date,session_id,class_id,section_id,marked_by) VALUES (?,?,?,?,?)`).run(date,sessionId,classId,sectionId,user.id).lastInsertRowid); }
      else { attendanceSessionId=session.id; db.prepare('UPDATE attendance_sessions SET marked_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(user.id,session.id); }
      const enrolled=new Set((db.prepare(`SELECT student_id FROM enrollments WHERE session_id=? AND class_id=? AND section_id IS ? AND status='active'`).all(sessionId,classId,sectionId) as {student_id:number}[]).map((row)=>row.student_id));
      const upsert=db.prepare(`INSERT INTO attendance_records (attendance_session_id,student_id,status,remarks,marked_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(attendance_session_id,student_id) DO UPDATE SET status=excluded.status,remarks=excluded.remarks,marked_at=CURRENT_TIMESTAMP`);
      (input.records as unknown[]).forEach((raw)=>{const record=raw as Record<string,unknown>;const studentId=Number(record.student_id);if(!enrolled.has(studentId))throw new ApiError(422,'One or more students are not enrolled in the selected class');const status=String(record.status);if(!statuses.includes(status))throw new ApiError(422,'Attendance status must be Present, Absent, Leave, or Late');upsert.run(attendanceSessionId,studentId,status,nullable(record.remarks));});
    })();
    return this.roster({class_id:classId,section_id:sectionId,date,session_id:sessionId});
  }

  lock(id:number, locked:boolean){const result=getDatabase().prepare('UPDATE attendance_sessions SET locked=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(locked?1:0,id);if(!result.changes)throw new ApiError(404,'Attendance session not found');}

  dailyReport(query:Record<string,unknown>){
    const date=String(query.date||today());const db=getDatabase();return db.prepare(`SELECT a.id,a.attendance_date,a.locked,c.name class_name,sec.name section_name,u.full_name marked_by,COUNT(ar.id) total,SUM(ar.status='present') present,SUM(ar.status='absent') absent,SUM(ar.status='late') late,SUM(ar.status='leave') on_leave FROM attendance_sessions a JOIN classes c ON c.id=a.class_id LEFT JOIN sections sec ON sec.id=a.section_id JOIN users u ON u.id=a.marked_by LEFT JOIN attendance_records ar ON ar.attendance_session_id=a.id WHERE a.attendance_date=? GROUP BY a.id ORDER BY c.display_order,sec.name`).all(date);
  }

  monthlySheet(query:Record<string,unknown>){
    const studentId=Number(query.student_id);const month=String(query.month||today().slice(0,7));if(!studentId)throw new ApiError(422,'Student is required');const start=`${month}-01`;const next=new Date(`${month}-01T00:00:00`);next.setUTCMonth(next.getUTCMonth()+1);const endDate=next.toISOString().slice(0,10);
    const records=getDatabase().prepare(`SELECT a.attendance_date,ar.status,ar.remarks FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id WHERE ar.student_id=? AND a.attendance_date>=? AND a.attendance_date<? ORDER BY a.attendance_date`).all(studentId,start,endDate) as {attendance_date:string;status:string;remarks:string|null}[];
    const schoolDays=this.schoolDaysBetween(start,endDate); const present=records.filter(r=>r.status==='present'||r.status==='late').length;
    return { month, records, school_days:schoolDays, present_days:present, percentage:schoolDays?Number(((present/schoolDays)*100).toFixed(1)):0 };
  }

  history(studentId:number){
    const student=getDatabase().prepare('SELECT id,admission_no,first_name,last_name FROM students WHERE id=?').get(studentId);if(!student)throw new ApiError(404,'Student not found');
    const rows=getDatabase().prepare(`SELECT a.id attendance_session_id,a.attendance_date,ar.status,ar.remarks,c.name class_name,sec.name section_name FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id JOIN classes c ON c.id=a.class_id LEFT JOIN sections sec ON sec.id=a.section_id WHERE ar.student_id=? ORDER BY a.attendance_date DESC,a.id DESC`).all(studentId) as {attendance_date:string;status:string}[];
    const presentDays=rows.filter(r=>r.status==='present').length;const absentDays=rows.filter(r=>r.status==='absent').length;const leaveDays=rows.filter(r=>r.status==='leave').length;const lateDays=rows.filter(r=>r.status==='late').length;const markedDays=rows.length;const attendedDays=presentDays+lateDays;const percentage=markedDays?Number((attendedDays*100/markedDays).toFixed(1)):0;const todayDate=today();const todayRecord=rows.find((row)=>row.attendance_date===todayDate);const lastStatus=rows[0]?.status||'not_marked';return {student,records:rows,marked_days:markedDays,school_days:markedDays,attended_days:attendedDays,present_days:presentDays,absent_days:absentDays,leave_days:leaveDays,late_days:lateDays,today_status:todayRecord?.status||'not_marked',last_status:lastStatus,last_marked_date:rows[0]?.attendance_date||null,current_status:todayRecord?.status||lastStatus,percentage};
  }

  dashboard(date=today()){const db=getDatabase();return db.prepare(`SELECT COUNT(ar.id) total,SUM(ar.status='present' OR ar.status='late') present,SUM(ar.status='absent') absent,SUM(ar.status='leave') on_leave FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id WHERE a.attendance_date=?`).get(date);}

  listStaff(query:Record<string,unknown>){const date=String(query.date||today());return getDatabase().prepare(`SELECT s.id,s.employee_no,s.first_name,s.last_name,s.photo_path,COALESCE(a.status,'present') status,a.check_in,a.check_out,a.remarks FROM staff s LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.attendance_date=? WHERE s.status='active' ORDER BY s.first_name,s.last_name`).all(date);}
  saveStaff(input:Record<string,unknown>,user:AuthUser){const date=String(input.attendance_date||today());if(!Array.isArray(input.records))throw new ApiError(422,'Staff attendance records are required');const db=getDatabase();const allowed=new Set((db.prepare("SELECT id FROM staff WHERE status='active'").all() as {id:number}[]).map(x=>x.id));const upsert=db.prepare(`INSERT INTO staff_attendance (staff_id,attendance_date,status,check_in,check_out,remarks,marked_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(staff_id,attendance_date) DO UPDATE SET status=excluded.status,check_in=excluded.check_in,check_out=excluded.check_out,remarks=excluded.remarks,marked_by=excluded.marked_by`);db.transaction(()=>{(input.records as unknown[]).forEach(raw=>{const r=raw as Record<string,unknown>;const id=Number(r.staff_id);if(!allowed.has(id))throw new ApiError(422,'Invalid staff member');const status=String(r.status);if(!statuses.includes(status))throw new ApiError(422,'Attendance status must be Present, Absent, Leave, or Late');upsert.run(id,date,status,nullable(r.check_in),nullable(r.check_out),nullable(r.remarks),user.id);});})();return this.listStaff({date});}
  markOwnStaffAttendance(user:AuthUser,input:Record<string,unknown>){const db=getDatabase();let staff=db.prepare('SELECT id FROM staff WHERE user_id=?').get(user.id) as {id:number}|undefined;if(!staff){const matches=db.prepare(`SELECT id FROM staff WHERE user_id IS NULL AND lower(trim(first_name || ' ' || coalesce(last_name,'')))=lower(trim(?))`).all(user.fullName) as {id:number}[];if(matches.length===1){db.prepare('UPDATE staff SET user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(user.id,matches[0].id);staff=matches[0];}}if(!staff)throw new ApiError(422,'Your account is not linked to a staff profile. Ask an administrator to open the staff record and create or attach a login account.');return this.saveStaff({attendance_date:input.attendance_date||today(),records:[{staff_id:staff.id,status:input.status||'present',check_in:input.check_in||new Date().toTimeString().slice(0,5),check_out:input.check_out,remarks:input.remarks}]},user);}

  private schoolDaysBetween(start:string,endExclusive:string){const days=new Set((getDatabase().prepare('SELECT weekday FROM school_days WHERE is_school_day=1').all() as {weekday:number}[]).map(x=>x.weekday));let date=new Date(`${start}T00:00:00Z`);const until=new Date(`${endExclusive}T00:00:00Z`);let count=0;while(date<until){if(days.has(date.getUTCDay()))count++;date.setUTCDate(date.getUTCDate()+1);}return count;}
}
