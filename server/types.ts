import type { Request } from 'express';

export type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
};

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export type PageResult<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
