import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { required } from '../utils/http';
import { applyLessonDuration, type PeriodClock } from '../utils/periods';
import { nullable, number } from '../utils/serializers';

export class TimetableService {
  settings() {
    const db = getDatabase();
    return { settings: db.prepare('SELECT * FROM timetable_settings WHERE id=1').get(), school_days: db.prepare('SELECT * FROM school_days ORDER BY weekday').all(), periods: db.prepare('SELECT * FROM timetable_periods ORDER BY sequence').all() };
  }
  saveSettings(input: Record<string, unknown>) {
    const db = getDatabase();
    db.transaction(() => {
      const lessonMinutes = number(input.default_period_minutes, 40);
      if (lessonMinutes < 1 || lessonMinutes > 240) throw new ApiError(422, 'Default lesson duration must be between 1 and 240 minutes');
      db.prepare(`UPDATE timetable_settings SET school_days_json=?,default_period_minutes=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`).run(JSON.stringify(Array.isArray(input.school_days) ? input.school_days : [1,2,3,4,5]), lessonMinutes);
      if (Array.isArray(input.days)) {
        const update = db.prepare('UPDATE school_days SET is_school_day=?,start_time=?,end_time=? WHERE weekday=?');
        input.days.forEach((raw) => { const day = raw as Record<string, unknown>; update.run(day.is_school_day ? 1 : 0, nullable(day.start_time), nullable(day.end_time), Number(day.weekday)); });
      }
      const periods = db.prepare('SELECT id,sequence,start_time,end_time,period_type FROM timetable_periods ORDER BY sequence,id').all() as PeriodClock[];
      try {
        const next = applyLessonDuration(periods, lessonMinutes);
        const updatePeriod = db.prepare('UPDATE timetable_periods SET start_time=?,end_time=? WHERE id=?');
        next.forEach((period) => updatePeriod.run(period.start_time, period.end_time, period.id));
      } catch (error) {
        throw new ApiError(422, error instanceof Error ? error.message : 'Period times could not be recalculated');
      }
    })(); return this.settings();
  }
  savePeriod(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const values = [required(input.name, 'Period name'), number(input.sequence), required(input.start_time, 'Start time'), required(input.end_time, 'End time'), ['lesson','break','assembly','other'].includes(String(input.period_type)) ? input.period_type : 'lesson'];
    if (id) { if (!db.prepare('UPDATE timetable_periods SET name=?,sequence=?,start_time=?,end_time=?,period_type=? WHERE id=?').run(...values,id).changes) throw new ApiError(404,'Period not found'); return db.prepare('SELECT * FROM timetable_periods WHERE id=?').get(id); }
    const r=db.prepare('INSERT INTO timetable_periods (name,sequence,start_time,end_time,period_type) VALUES (?,?,?,?,?)').run(...values); return db.prepare('SELECT * FROM timetable_periods WHERE id=?').get(r.lastInsertRowid);
  }
  deletePeriod(id:number){ const db=getDatabase(); if((db.prepare('SELECT COUNT(*) count FROM timetable_entries WHERE period_id=?').get(id) as {count:number}).count)throw new ApiError(422,'This period is used in a timetable and cannot be deleted');if(!db.prepare('DELETE FROM timetable_periods WHERE id=?').run(id).changes)throw new ApiError(404,'Period not found'); }
  entries(filters: Record<string, unknown>) {
    const db=getDatabase(); const sessionId=Number(filters.session_id)||this.currentSession(); const classId=Number(filters.class_id); if(!classId) throw new ApiError(422,'Class is required');
    return db.prepare(`SELECT te.*,p.name period_name,p.sequence,p.start_time,p.end_time,p.period_type,sub.name subject_name,sub.code subject_code,st.first_name || CASE WHEN st.last_name IS NOT NULL THEN ' '||st.last_name ELSE '' END teacher_name,r.name room_name FROM timetable_entries te JOIN timetable_periods p ON p.id=te.period_id LEFT JOIN subjects sub ON sub.id=te.subject_id LEFT JOIN staff st ON st.id=te.teacher_id LEFT JOIN rooms r ON r.id=te.room_id WHERE te.session_id=? AND te.class_id=? AND (te.section_id IS ? OR te.section_id=?) ORDER BY te.weekday,p.sequence`).all(sessionId,classId,nullable(filters.section_id),nullable(filters.section_id));
  }
  saveEntry(input: Record<string, unknown>, id?:number) {
    const db=getDatabase(); const sessionId=Number(input.session_id)||this.currentSession(); const classId=Number(input.class_id), periodId=Number(input.period_id), weekday=Number(input.weekday); if(!classId||!periodId||weekday<0||weekday>6)throw new ApiError(422,'Class, day and period are required');
    const values=[sessionId,classId,nullable(input.section_id),weekday,periodId,nullable(input.subject_id),nullable(input.teacher_id),nullable(input.room_id),nullable(input.note)];
    this.assertNoConflict(values,id);
    if(id){ if(!db.prepare('UPDATE timetable_entries SET session_id=?,class_id=?,section_id=?,weekday=?,period_id=?,subject_id=?,teacher_id=?,room_id=?,note=? WHERE id=?').run(...values,id).changes)throw new ApiError(404,'Timetable entry not found'); return db.prepare('SELECT * FROM timetable_entries WHERE id=?').get(id); }
    const r=db.prepare('INSERT INTO timetable_entries (session_id,class_id,section_id,weekday,period_id,subject_id,teacher_id,room_id,note) VALUES (?,?,?,?,?,?,?,?,?)').run(...values); return db.prepare('SELECT * FROM timetable_entries WHERE id=?').get(r.lastInsertRowid);
  }
  deleteEntry(id:number){if(!getDatabase().prepare('DELETE FROM timetable_entries WHERE id=?').run(id).changes)throw new ApiError(404,'Timetable entry not found');}
  private currentSession(){const row=getDatabase().prepare('SELECT id FROM school_sessions WHERE is_current=1').get() as {id:number}|undefined;if(!row)throw new ApiError(422,'Current session is not configured');return row.id;}
  private assertNoConflict(values:unknown[], id?:number){
    const [sessionId,, ,weekday,periodId,,teacherId,roomId]=values;const db=getDatabase();const notSelf=id? 'AND id<>?' : ''; const append=id?[id]:[];
    if(teacherId){const conflict=db.prepare(`SELECT id FROM timetable_entries WHERE session_id=? AND weekday=? AND period_id=? AND teacher_id=? ${notSelf}`).get(sessionId,weekday,periodId,teacherId,...append);if(conflict)throw new ApiError(422,'The selected teacher already has a class in this period');}
    if(roomId){const conflict=db.prepare(`SELECT id FROM timetable_entries WHERE session_id=? AND weekday=? AND period_id=? AND room_id=? ${notSelf}`).get(sessionId,weekday,periodId,roomId,...append);if(conflict)throw new ApiError(422,'The selected room is already occupied in this period');}
  }
}
