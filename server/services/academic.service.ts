import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { required } from '../utils/http';
import { nullable, number, bool } from '../utils/serializers';

export class AcademicService {
  classes(includeInactive = false) {
    const db = getDatabase();
    return db.prepare(`SELECT c.*,s.first_name || CASE WHEN s.last_name IS NOT NULL THEN ' ' || s.last_name ELSE '' END head_teacher_name,(SELECT COUNT(*) FROM sections sec WHERE sec.class_id=c.id AND sec.status='active') section_count,(SELECT COUNT(*) FROM enrollments e WHERE e.class_id=c.id AND e.status='active') student_count FROM classes c LEFT JOIN staff s ON s.id=c.head_teacher_id ${includeInactive ? '' : "WHERE c.status='active'"} ORDER BY c.display_order,c.name`).all();
  }

  classById(id: number) {
    const db = getDatabase(); const item = db.prepare('SELECT * FROM classes WHERE id=?').get(id);
    if (!item) throw new ApiError(404, 'Class not found');
    return { ...item as object, sections: db.prepare('SELECT * FROM sections WHERE class_id=? ORDER BY name').all(id), subjects: this.classSubjects(id) };
  }

  saveClass(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const code = required(input.code, 'Class code'); const name = required(input.name, 'Class name');
    const values = [code, name, nullable(input.name_ur), number(input.display_order), nullable(input.head_teacher_id), input.status === 'inactive' ? 'inactive' : 'active'];
    if (id) {
      const changed = db.prepare(`UPDATE classes SET code=?,name=?,name_ur=?,display_order=?,head_teacher_id=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...values, id).changes;
      if (!changed) throw new ApiError(404, 'Class not found'); return this.classById(id);
    }
    const result = db.prepare(`INSERT INTO classes (code,name,name_ur,display_order,head_teacher_id,status) VALUES (?,?,?,?,?,?)`).run(...values);
    return this.classById(Number(result.lastInsertRowid));
  }

  deleteClass(id: number) {
    const db = getDatabase(); const dependencies = db.prepare('SELECT COUNT(*) count FROM enrollments WHERE class_id=?').get(id) as { count: number };
    if (dependencies.count) throw new ApiError(422, 'Classes with enrollment history cannot be deleted. Mark it inactive instead.');
    if (!db.prepare('DELETE FROM classes WHERE id=?').run(id).changes) throw new ApiError(404, 'Class not found');
  }

  sections(classId?: number) {
    const db = getDatabase(); return db.prepare(`SELECT sec.*,c.name class_name,s.first_name || CASE WHEN s.last_name IS NOT NULL THEN ' '||s.last_name ELSE '' END class_teacher_name FROM sections sec JOIN classes c ON c.id=sec.class_id LEFT JOIN staff s ON s.id=sec.class_teacher_id ${classId ? 'WHERE sec.class_id=?' : ''} ORDER BY c.display_order,sec.name`).all(...(classId ? [classId] : []));
  }

  saveSection(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const classId = Number(input.class_id); if (!classId) throw new ApiError(422, 'Class is required');
    const values = [classId, required(input.name, 'Section name'), nullable(input.capacity), nullable(input.class_teacher_id), nullable(input.room), input.status === 'inactive' ? 'inactive' : 'active'];
    if (id) { if (!db.prepare(`UPDATE sections SET class_id=?,name=?,capacity=?,class_teacher_id=?,room=?,status=? WHERE id=?`).run(...values, id).changes) throw new ApiError(404, 'Section not found'); return db.prepare('SELECT * FROM sections WHERE id=?').get(id); }
    const result = db.prepare(`INSERT INTO sections (class_id,name,capacity,class_teacher_id,room,status) VALUES (?,?,?,?,?,?)`).run(...values);
    return db.prepare('SELECT * FROM sections WHERE id=?').get(result.lastInsertRowid);
  }

  deleteSection(id: number) { const db = getDatabase(); if ((db.prepare('SELECT COUNT(*) count FROM enrollments WHERE section_id=?').get(id) as { count: number }).count) throw new ApiError(422, 'Sections with enrollment history cannot be deleted. Mark it inactive instead.'); if (!db.prepare('DELETE FROM sections WHERE id=?').run(id).changes) throw new ApiError(404, 'Section not found'); }

  subjects(includeInactive = false) { return getDatabase().prepare(`SELECT s.*,(SELECT COUNT(*) FROM class_subjects cs WHERE cs.subject_id=s.id) class_count FROM subjects s ${includeInactive ? '' : "WHERE s.status='active'"} ORDER BY s.name`).all(); }
  saveSubject(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const values = [required(input.code, 'Subject code'), required(input.name, 'Subject name'), nullable(input.name_ur), number(input.max_marks, 100), number(input.pass_marks, 40), input.status === 'inactive' ? 'inactive' : 'active'];
    if (id) { if (!db.prepare('UPDATE subjects SET code=?,name=?,name_ur=?,max_marks=?,pass_marks=?,status=? WHERE id=?').run(...values, id).changes) throw new ApiError(404, 'Subject not found'); return db.prepare('SELECT * FROM subjects WHERE id=?').get(id); }
    const result = db.prepare('INSERT INTO subjects (code,name,name_ur,max_marks,pass_marks,status) VALUES (?,?,?,?,?,?)').run(...values); return db.prepare('SELECT * FROM subjects WHERE id=?').get(result.lastInsertRowid);
  }
  deleteSubject(id: number) { const db = getDatabase(); if ((db.prepare('SELECT COUNT(*) count FROM class_subjects WHERE subject_id=?').get(id) as { count: number }).count) throw new ApiError(422, 'Subjects assigned to a class cannot be deleted. Mark it inactive instead.'); if (!db.prepare('DELETE FROM subjects WHERE id=?').run(id).changes) throw new ApiError(404, 'Subject not found'); }

  classSubjects(classId?: number) {
    return getDatabase().prepare(`SELECT cs.*,c.name class_name,sec.name section_name,sub.code subject_code,sub.name subject_name,st.first_name || CASE WHEN st.last_name IS NOT NULL THEN ' '||st.last_name ELSE '' END teacher_name FROM class_subjects cs JOIN classes c ON c.id=cs.class_id LEFT JOIN sections sec ON sec.id=cs.section_id JOIN subjects sub ON sub.id=cs.subject_id LEFT JOIN staff st ON st.id=cs.teacher_id ${classId ? 'WHERE cs.class_id=?' : ''} ORDER BY c.name,sec.name,sub.name`).all(...(classId ? [classId] : []));
  }
  saveClassSubject(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const classId = Number(input.class_id); const subjectId = Number(input.subject_id); if (!classId || !subjectId) throw new ApiError(422, 'Class and subject are required');
    const values = [classId, nullable(input.section_id), subjectId, nullable(input.teacher_id), number(input.weekly_periods, 1)];
    if (id) { if (!db.prepare('UPDATE class_subjects SET class_id=?,section_id=?,subject_id=?,teacher_id=?,weekly_periods=? WHERE id=?').run(...values, id).changes) throw new ApiError(404, 'Class subject assignment not found'); return db.prepare('SELECT * FROM class_subjects WHERE id=?').get(id); }
    const result = db.prepare('INSERT INTO class_subjects (class_id,section_id,subject_id,teacher_id,weekly_periods) VALUES (?,?,?,?,?)').run(...values); return db.prepare('SELECT * FROM class_subjects WHERE id=?').get(result.lastInsertRowid);
  }
  deleteClassSubject(id: number) { if (!getDatabase().prepare('DELETE FROM class_subjects WHERE id=?').run(id).changes) throw new ApiError(404, 'Class subject assignment not found'); }

  sessions() { return getDatabase().prepare('SELECT * FROM school_sessions ORDER BY starts_on DESC').all(); }
  saveSession(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const name = required(input.name, 'Session name'); const starts = required(input.starts_on, 'Start date'); const ends = required(input.ends_on, 'End date'); const current = bool(input.is_current);
    let itemId = id;
    db.transaction(() => {
      if (current) db.prepare('UPDATE school_sessions SET is_current=0').run();
      if (id) { if (!db.prepare('UPDATE school_sessions SET name=?,starts_on=?,ends_on=?,is_current=?,status=? WHERE id=?').run(name, starts, ends, current ? 1 : 0, input.status || 'active', id).changes) throw new ApiError(404, 'Session not found'); }
      else itemId = Number(db.prepare('INSERT INTO school_sessions (name,starts_on,ends_on,is_current,status) VALUES (?,?,?,?,?)').run(name, starts, ends, current ? 1 : 0, input.status || 'active').lastInsertRowid);
    })();
    return db.prepare('SELECT * FROM school_sessions WHERE id=?').get(itemId);
  }

  examTypes() { return getDatabase().prepare('SELECT * FROM exam_types ORDER BY name').all(); }
  saveExamType(input: Record<string, unknown>, id?: number) {
    const db = getDatabase(); const values = [required(input.name, 'Exam type name'), required(input.code, 'Exam type code'), number(input.default_weight, 75), input.status === 'inactive' ? 'inactive' : 'active'];
    if (id) { if (!db.prepare('UPDATE exam_types SET name=?,code=?,default_weight=?,status=? WHERE id=?').run(...values, id).changes) throw new ApiError(404, 'Exam type not found'); return db.prepare('SELECT * FROM exam_types WHERE id=?').get(id); }
    const result = db.prepare('INSERT INTO exam_types (name,code,default_weight,status) VALUES (?,?,?,?)').run(...values); return db.prepare('SELECT * FROM exam_types WHERE id=?').get(result.lastInsertRowid);
  }
  deleteExamType(id: number) { const db = getDatabase(); if ((db.prepare('SELECT COUNT(*) count FROM exams WHERE exam_type_id=?').get(id) as { count: number }).count) throw new ApiError(422, 'This exam type is used by existing exams and cannot be deleted'); if (!db.prepare('DELETE FROM exam_types WHERE id=?').run(id).changes) throw new ApiError(404, 'Exam type not found'); }

  rooms() { return getDatabase().prepare('SELECT * FROM rooms ORDER BY name').all(); }
  saveRoom(input: Record<string, unknown>, id?: number) { const db = getDatabase(); const values = [required(input.name, 'Room name'), nullable(input.capacity), nullable(input.description), input.status === 'inactive' ? 'inactive' : 'active']; if (id) { if (!db.prepare('UPDATE rooms SET name=?,capacity=?,description=?,status=? WHERE id=?').run(...values, id).changes) throw new ApiError(404, 'Room not found'); return db.prepare('SELECT * FROM rooms WHERE id=?').get(id); } const result = db.prepare('INSERT INTO rooms (name,capacity,description,status) VALUES (?,?,?,?)').run(...values); return db.prepare('SELECT * FROM rooms WHERE id=?').get(result.lastInsertRowid); }
  deleteRoom(id: number) { const db = getDatabase(); if ((db.prepare('SELECT COUNT(*) count FROM timetable_entries WHERE room_id=?').get(id) as { count: number }).count) throw new ApiError(422, 'This room is used in a timetable and cannot be deleted'); if (!db.prepare('DELETE FROM rooms WHERE id=?').run(id).changes) throw new ApiError(404, 'Room not found'); }
}
