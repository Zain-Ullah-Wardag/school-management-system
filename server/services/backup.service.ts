import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { closeDatabase, getDatabase, getDatabaseFilePath } from '../../database';
import { ApiError } from '../utils/errors';

const backupDirectory = () => path.resolve(process.env.BACKUP_DIR || 'backups');
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export class BackupService {
  async create() {
    const directory = backupDirectory();
    await fs.mkdir(directory, { recursive: true });
    const fileName = `school-erp-backup-${stamp()}.db`;
    const destination = path.join(directory, fileName);
    await getDatabase().backup(destination);
    const info = await fs.stat(destination);
    return { file_name: fileName, size: info.size, created_at: info.mtime.toISOString() };
  }

  async list() {
    const directory = backupDirectory();
    await fs.mkdir(directory, { recursive: true });
    const files = await fs.readdir(directory);
    const rows = await Promise.all(files.filter((name) => name.endsWith('.db')).map(async (fileName) => {
      const info = await fs.stat(path.join(directory, fileName));
      return { file_name: fileName, size: info.size, created_at: info.mtime.toISOString() };
    }));
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  pathForDownload(fileName: string) {
    if (!/^[a-zA-Z0-9_.-]+\.db$/.test(fileName)) throw new ApiError(400, 'Invalid backup file name');
    const file = path.join(backupDirectory(), fileName);
    if (!file.startsWith(backupDirectory())) throw new ApiError(400, 'Invalid backup path');
    return file;
  }

  async restore(uploadedFile: string) {
    await this.validateDatabase(uploadedFile);
    const target = getDatabaseFilePath();
    await fs.mkdir(backupDirectory(), { recursive: true });
    const safetyCopy = path.join(backupDirectory(), `school-erp-pre-restore-${stamp()}.db`);
    const previousWal = `${target}-wal`;
    const previousShm = `${target}-shm`;

    closeDatabase();
    try {
      await fs.copyFile(target, safetyCopy);
      await fs.copyFile(uploadedFile, target);
      await Promise.all([fs.rm(previousWal, { force: true }), fs.rm(previousShm, { force: true })]);
      getDatabase();
    } catch (error) {
      await fs.copyFile(safetyCopy, target).catch(() => undefined);
      await Promise.all([fs.rm(previousWal, { force: true }), fs.rm(previousShm, { force: true })]);
      getDatabase();
      throw new ApiError(422, error instanceof Error ? `Restore failed: ${error.message}` : 'Restore failed');
    }
    return { restored: true, safety_backup: path.basename(safetyCopy) };
  }

  private async validateDatabase(file: string) {
    try {
      const candidate = new Database(file, { readonly: true, fileMustExist: true });
      const userTable = candidate.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`).get();
      const migrationTable = candidate.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`).get();
      candidate.close();
      if (!userTable || !migrationTable) throw new Error('The selected file is not a School ERP database');
    } catch (error) {
      throw new ApiError(422, error instanceof Error ? error.message : 'Invalid database backup');
    }
  }
}
