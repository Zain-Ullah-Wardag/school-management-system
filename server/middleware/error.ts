import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'The requested resource was not found'));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const known = error instanceof ApiError ? error : null;
  const dbError = error as { code?: string; message?: string };
  const uploadError = dbError.code === 'LIMIT_FILE_SIZE' || /Only JPG|file too large|Select a SQLite|Supported files/i.test(dbError.message || '');
  const status = known?.statusCode || (uploadError ? 422 : dbError.code?.includes('CONSTRAINT') ? 409 : 500);
  const message = known?.message || (uploadError ? (dbError.code === 'LIMIT_FILE_SIZE' ? 'File must be 8 MB or smaller' : dbError.message || 'Invalid upload') : status === 409 ? 'This record conflicts with existing data' : 'An unexpected server error occurred');
  if (!known && status === 500) console.error(error);
  res.status(status).json({ success: false, message, details: known?.details });
}
