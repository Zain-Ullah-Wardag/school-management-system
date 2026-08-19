import { Router } from 'express';
import { overview } from '../controllers/dashboard.controller';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.get('/', requireAuth, requireRole('administrator', 'principal'), overview);
export default router;
