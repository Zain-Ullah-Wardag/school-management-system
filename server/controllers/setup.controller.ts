import type { Request, Response } from 'express';
import { DemoService } from '../services/demo.service';
import { asyncHandler, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';

const service = new DemoService();

export const status = asyncHandler((_req: Request, res: Response) => success(res, service.status()));

export const initializeDemo = asyncHandler((req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  success(res, service.initialize(user.id), 201);
});
