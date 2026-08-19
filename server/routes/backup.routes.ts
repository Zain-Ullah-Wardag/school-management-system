import { Router } from 'express';
import { createBackup, downloadBackup, listBackups, restoreBackup } from '../controllers/backup.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { databaseUpload } from '../middleware/upload';

const router = Router();
router.use(requireAuth, requirePermission('settings.manage'));
router.get('/', listBackups);
router.post('/', createBackup);
router.get('/:fileName', downloadBackup);
router.post('/restore', databaseUpload.single('database'), restoreBackup);

export default router;
