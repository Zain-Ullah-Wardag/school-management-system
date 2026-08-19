import fs from 'fs/promises';
import type { Request, Response } from 'express';
import { BackupService } from '../services/backup.service';
import { ApiError } from '../utils/errors';
import { asyncHandler, success } from '../utils/http';

const service = new BackupService();

export const listBackups = asyncHandler(async (_req: Request, res: Response) => success(res, await service.list()));
export const createBackup = asyncHandler(async (_req: Request, res: Response) => success(res, await service.create(), 201));

export const downloadBackup = asyncHandler(async (req: Request, res: Response) => {
  const fileName = Array.isArray(req.params.fileName) ? req.params.fileName[0] : req.params.fileName;
  const file = service.pathForDownload(fileName);
  await fs.access(file);
  res.download(file, fileName);
});

export const restoreBackup = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(422, 'Select a School ERP SQLite backup file');
  try {
    success(res, await service.restore(req.file.path));
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});
