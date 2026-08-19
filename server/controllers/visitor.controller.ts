import type { Request, Response } from 'express';
import { VisitorService } from '../services/visitor.service';
import { asyncHandler, parseId, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';

const service = new VisitorService();

export const listVisitors = asyncHandler((req, res) => success(res, service.list(req.query)));
export const createVisitor = asyncHandler((req: Request, res: Response) => success(res, service.create(req.body, (req as AuthenticatedRequest).user!.id), 201));
export const checkoutVisitor = asyncHandler((req, res) => success(res, service.checkout(parseId(req.params.id, 'visitor id'), req.body.note)));
