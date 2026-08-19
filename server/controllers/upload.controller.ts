import type { Request, Response } from 'express';
import { asyncHandler, success } from '../utils/http';
import { ApiError } from '../utils/errors';

export const uploadFile = asyncHandler((req: Request, res: Response) => {
  if (!req.file) throw new ApiError(422, 'Select a file to upload');
  success(res, { path: `/uploads/${req.file.filename}`, file_name: req.file.originalname, mime_type: req.file.mimetype, size: req.file.size }, 201);
});
