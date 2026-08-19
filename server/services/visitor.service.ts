import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { pagination, required } from '../utils/http';
import { nullable } from '../utils/serializers';

export class VisitorService {
  list(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query as never);
    const search = typeof query.search === 'string' && query.search.trim() ? `%${query.search.trim()}%` : '%';
    const status = typeof query.status === 'string' && query.status ? query.status : null;
    const where = `WHERE (v.visitor_name LIKE ? OR v.phone LIKE ? OR v.purpose LIKE ? OR v.person_to_meet LIKE ?) ${status ? 'AND v.status=?' : ''}`;
    const params = status ? [search, search, search, search, status] : [search, search, search, search];
    const db = getDatabase();
    const total = (db.prepare(`SELECT COUNT(*) total FROM visitor_logs v ${where}`).get(...params) as { total: number }).total;
    const data = db.prepare(`SELECT v.*,u.full_name created_by_name FROM visitor_logs v LEFT JOIN users u ON u.id=v.created_by ${where} ORDER BY v.check_in DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  create(input: Record<string, unknown>, userId: number) {
    const result = getDatabase().prepare(`INSERT INTO visitor_logs (visitor_name,phone,cnic,purpose,person_to_meet,check_in,note,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(required(input.visitor_name, 'Visitor name'), nullable(input.phone), nullable(input.cnic), required(input.purpose, 'Purpose'), nullable(input.person_to_meet), input.check_in || new Date().toISOString(), nullable(input.note), 'checked_in', userId);
    return getDatabase().prepare('SELECT * FROM visitor_logs WHERE id=?').get(result.lastInsertRowid);
  }

  checkout(id: number, note?: unknown) {
    const result = getDatabase().prepare(`UPDATE visitor_logs SET check_out=CURRENT_TIMESTAMP,status='checked_out',note=COALESCE(?,note),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='checked_in'`).run(nullable(note), id);
    if (!result.changes) throw new ApiError(404, 'Checked-in visitor not found');
    return getDatabase().prepare('SELECT * FROM visitor_logs WHERE id=?').get(id);
  }
}
