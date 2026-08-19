import { Router } from 'express';
import { initializeDemo, status } from '../controllers/setup.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requirePermission('settings.manage'));
router.get('/status', status);
router.post('/demo', initializeDemo);

export default router;
