import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { signToken } from '../middleware/auth';
import { asyncHandler, message, success } from '../utils/http';
import { required } from '../utils/http';
import type { AuthenticatedRequest } from '../types';
import { logActivity } from '../utils/activity';

const service = new AuthService();

export const login = asyncHandler((req: Request, res: Response) => {
  const result = service.login(required(req.body.username, 'Username'), required(req.body.password, 'Password'));
  const token = signToken(result.user);
  logActivity(result.user.id, 'login', 'user', result.user.id, `${result.user.fullName} signed in`);
  success(res, { token, user: result.user, must_change_password: result.mustChangePassword });
});

export const me = asyncHandler((req: Request, res: Response) => success(res, service.me((req as AuthenticatedRequest).user!.id)));
export const changePassword = asyncHandler((req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  service.changePassword(user.id, required(req.body.current_password, 'Current password'), required(req.body.new_password, 'New password'));
  logActivity(user.id, 'password_changed', 'user', user.id, 'Password changed');
  message(res, 'Password updated successfully');
});
