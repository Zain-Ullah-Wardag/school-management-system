import type { Request, Response } from 'express';
import { FeeReminderService } from '../services/fee-reminder.service';
import { asyncHandler, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';

const service = new FeeReminderService();
export const reminderStatus = asyncHandler((_req: Request, res: Response) => success(res, service.status()));
export const configureReminders = asyncHandler((req: Request, res: Response) => success(res, service.configure(req.body)));
export const sendReminderNow = asyncHandler(async (req: Request, res: Response) => success(res, await service.sendNow((req as AuthenticatedRequest).user!.id), 201));
