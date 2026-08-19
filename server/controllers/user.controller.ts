import type { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler, message, parseId, required, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';
import { logActivity } from '../utils/activity';

const service = new UserService();
export const listUsers = asyncHandler((req: Request, res: Response) => success(res, service.list(req.query)));
export const roles = asyncHandler((_req: Request, res: Response) => success(res, service.roles()));
export const permissions = asyncHandler((_req: Request, res: Response) => success(res, service.permissions()));
export const createUser = asyncHandler((req: Request, res: Response) => {
  const actor = (req as AuthenticatedRequest).user!; const user = service.create(req.body, actor.id);
  logActivity(actor.id, 'created', 'user', (user as { id: number }).id, `Created user ${(user as { full_name: string }).full_name}`);
  success(res, user, 201);
});
export const updateUser = asyncHandler((req: Request, res: Response) => {
  const actor = (req as AuthenticatedRequest).user!; const id = parseId(req.params.id); const user = service.update(id, req.body);
  logActivity(actor.id, 'updated', 'user', id, `Updated user ${(user as { full_name: string }).full_name}`); success(res, user);
});
export const resetPassword = asyncHandler((req: Request, res: Response) => {
  const id = parseId(req.params.id); service.resetPassword(id, required(req.body.password, 'New password'));
  logActivity((req as AuthenticatedRequest).user!.id, 'password_reset', 'user', id, 'User password reset'); message(res, 'Password reset successfully');
});
export const deleteUser = asyncHandler((req: Request, res: Response) => {
  const actor = (req as AuthenticatedRequest).user!; const id = parseId(req.params.id); service.remove(id, actor.id);
  logActivity(actor.id, 'archived', 'user', id, 'User archived'); message(res, 'User archived successfully');
});
