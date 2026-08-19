import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors';

export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next);

export const success = <T>(res: Response, data: T, status = 200) => res.status(status).json({ success: true, data });
export const message = (res: Response, text: string, status = 200) => res.status(status).json({ success: true, message: text });

export function parseId(value: string | string[] | undefined, field = 'id') {
  const id = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, `Invalid ${field}`);
  return id;
}

export function pagination(query: Request['query']) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export const asString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export const required = (value: unknown, label: string) => {
  const string = asString(value);
  if (!string) throw new ApiError(422, `${label} is required`);
  return string;
};
