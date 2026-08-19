import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDatabase } from '../../database';
import type { AuthenticatedRequest, AuthUser } from '../types';
import { ApiError } from '../utils/errors';

let cachedSecret: string | null = null;
const secret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  const db = getDatabase();
  const stored = db.prepare("SELECT value FROM settings WHERE key='system.jwt_secret'").get() as { value: string } | undefined;
  if (stored?.value) { cachedSecret = stored.value; return cachedSecret; }
  cachedSecret = crypto.randomBytes(48).toString('hex');
  db.prepare("INSERT INTO settings (key,value,group_name) VALUES ('system.jwt_secret',?,'system')").run(cachedSecret);
  return cachedSecret;
};

export function signToken(user: AuthUser) {
  return jwt.sign(user, secret(), { expiresIn: '12h', issuer: 'school-erp' });
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiError(401, 'Authentication is required');
    req.user = jwt.verify(token, secret(), { issuer: 'school-erp' }) as AuthUser;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'Your session is invalid or expired'));
  }
}

export function requirePermission(...codes: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const permissions = req.user?.permissions || [];
    if (!req.user || !codes.some((code) => permissions.includes(code))) return next(new ApiError(403, 'You do not have permission for this action'));
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'This dashboard is available only to the Administrator or Principal'));
    next();
  };
}

export function currentUser(userId: number): AuthUser {
  const db = getDatabase();
  const row = db.prepare(`SELECT u.id,u.username,u.full_name,r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.status='active'`).get(userId) as { id: number; username: string; full_name: string; role: string } | undefined;
  if (!row) throw new ApiError(401, 'User account is unavailable');
  const permissions = db.prepare(`
    SELECT DISTINCT p.code FROM permissions p
    JOIN role_permissions rp ON rp.permission_id=p.id
    JOIN users u ON u.role_id=rp.role_id WHERE u.id=?
    UNION
    SELECT p.code FROM permissions p JOIN user_permissions up ON up.permission_id=p.id WHERE up.user_id=? AND up.granted=1
  `).all(userId, userId) as { code: string }[];
  const denied = db.prepare(`SELECT p.code FROM permissions p JOIN user_permissions up ON up.permission_id=p.id WHERE up.user_id=? AND up.granted=0`).all(userId) as { code: string }[];
  const resolved = permissions.map((item) => item.code).filter((code) => !denied.some((item) => item.code === code));
  const teacherRoles = ['class_teacher', 'subject_teacher'];
  const restrictedForTeachers = ['dashboard.', 'fees.', 'finance.', 'reports.', 'academic.', 'settings.', 'users.', 'staff.', 'visitors.'];
  const safePermissions = teacherRoles.includes(row.role) ? resolved.filter((code) => !restrictedForTeachers.some((prefix) => code.startsWith(prefix))) : resolved;
  return { id: row.id, username: row.username, fullName: row.full_name, role: row.role, permissions: safePermissions };
}
