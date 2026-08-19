import bcrypt from 'bcrypt';
import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { pagination, required } from '../utils/http';
import { bool, nullable } from '../utils/serializers';

export class UserService {
  list(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query as never);
    const search = typeof query.search === 'string' ? `%${query.search.trim()}%` : '%';
    const status = typeof query.status === 'string' ? query.status : null;
    const where = `WHERE (u.full_name LIKE ? OR u.username LIKE ?) ${status ? 'AND u.status=?' : ''}`;
    const params = status ? [search, search, status] : [search, search];
    const db = getDatabase();
    const total = (db.prepare(`SELECT COUNT(*) total FROM users u ${where}`).get(...params) as { total: number }).total;
    const data = db.prepare(`SELECT u.id,u.full_name,u.username,u.photo_path,u.status,u.last_login_at,u.must_change_password,u.created_at,r.id role_id,r.code role_code,r.name role_name FROM users u JOIN roles r ON r.id=u.role_id ${where} ORDER BY u.full_name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  roles() { return getDatabase().prepare('SELECT * FROM roles ORDER BY is_system DESC,name').all(); }
  permissions() { return getDatabase().prepare('SELECT * FROM permissions ORDER BY module,label').all(); }

  create(input: Record<string, unknown>, actorId: number) {
    const fullName = required(input.full_name, 'Full name');
    const username = required(input.username, 'Username');
    const password = required(input.password, 'Password');
    if (password.length < 8) throw new ApiError(422, 'Password must be at least 8 characters long');
    const roleId = Number(input.role_id);
    const db = getDatabase();
    if (!db.prepare('SELECT 1 FROM roles WHERE id=?').get(roleId)) throw new ApiError(422, 'Select a valid role');
    const result = db.prepare(`INSERT INTO users (full_name,username,password_hash,photo_path,role_id,status,must_change_password,created_by) VALUES (?,?,?,?,?,?,?,?)`)
      .run(fullName, username, bcrypt.hashSync(password, 12), nullable(input.photo_path), roleId, input.status === 'inactive' ? 'inactive' : 'active', bool(input.must_change_password) ? 1 : 0, actorId);
    this.setOverrides(Number(result.lastInsertRowid), Array.isArray(input.permissions) ? input.permissions : []);
    return this.byId(Number(result.lastInsertRowid));
  }

  update(id: number, input: Record<string, unknown>) {
    const db = getDatabase();
    if (!this.byId(id)) throw new ApiError(404, 'User not found');
    const fullName = required(input.full_name, 'Full name');
    const username = required(input.username, 'Username');
    const roleId = Number(input.role_id);
    db.prepare(`UPDATE users SET full_name=?,username=?,photo_path=?,role_id=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(fullName, username, nullable(input.photo_path), roleId, input.status === 'inactive' ? 'inactive' : 'active', id);
    if (Array.isArray(input.permissions)) this.setOverrides(id, input.permissions);
    return this.byId(id);
  }

  resetPassword(id: number, password: string) {
    if (password.length < 8) throw new ApiError(422, 'Password must be at least 8 characters long');
    const result = getDatabase().prepare('UPDATE users SET password_hash=?,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bcrypt.hashSync(password, 12), id);
    if (!result.changes) throw new ApiError(404, 'User not found');
  }

  remove(id: number, actorId: number) {
    if (id === actorId) throw new ApiError(422, 'You cannot delete your own account');
    const result = getDatabase().prepare(`UPDATE users SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
    if (!result.changes) throw new ApiError(404, 'User not found');
  }

  private setOverrides(userId: number, codes: unknown[]) {
    const db = getDatabase();
    db.transaction(() => {
      db.prepare('DELETE FROM user_permissions WHERE user_id=?').run(userId);
      const insert = db.prepare('INSERT INTO user_permissions (user_id,permission_id,granted) VALUES (?,?,1)');
      for (const code of codes) {
        const permission = db.prepare('SELECT id FROM permissions WHERE code=?').get(String(code)) as { id: number } | undefined;
        if (permission) insert.run(userId, permission.id);
      }
    })();
  }

  private byId(id: number) {
    return getDatabase().prepare(`SELECT u.id,u.full_name,u.username,u.photo_path,u.status,u.last_login_at,u.must_change_password,u.created_at,r.id role_id,r.code role_code,r.name role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`).get(id);
  }
}
