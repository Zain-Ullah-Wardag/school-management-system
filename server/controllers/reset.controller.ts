import type { Request, Response } from 'express';
import { ResetService } from '../services/reset.service';
import { asyncHandler, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';

const service = new ResetService();

export const resetSchoolData = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  success(res, await service.reset(req.body, user.id));
});
