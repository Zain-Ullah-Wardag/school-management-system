import bcrypt from 'bcrypt';
import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { currentUser } from '../middleware/auth';

export class AuthService {
  login(username: string, password: string) {
    const db = getDatabase();
    const user = db.prepare(`SELECT id,password_hash,status FROM users WHERE username = ? COLLATE NOCASE`).get(username) as { id: number; password_hash: string; status: string } | undefined;
    if (!user || !(bcrypt.compareSync(password, user.password_hash))) throw new ApiError(401, 'Invalid username or password');
    if (user.status !== 'active') throw new ApiError(403, 'This user account is inactive');
    db.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(user.id);
    return { user: currentUser(user.id), mustChangePassword: Boolean((db.prepare('SELECT must_change_password FROM users WHERE id=?').get(user.id) as { must_change_password: number }).must_change_password) };
  }

  me(userId: number) {
    const user = currentUser(userId);
    const row = getDatabase().prepare(`SELECT u.photo_path,u.last_login_at,u.must_change_password,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`).get(userId) as { photo_path: string | null; last_login_at: string | null; must_change_password: number; role_name: string };
    return { ...user, photo_path: row.photo_path, role_name: row.role_name, last_login_at: row.last_login_at, must_change_password: Boolean(row.must_change_password) };
  }

  changePassword(userId: number, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) throw new ApiError(422, 'Password must be at least 8 characters long');
    const db = getDatabase();
    const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId) as { password_hash: string } | undefined;
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) throw new ApiError(422, 'Current password is incorrect');
    db.prepare('UPDATE users SET password_hash=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bcrypt.hashSync(newPassword, 12), userId);
  }
}
