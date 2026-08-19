import { Router } from 'express';
import { resetSchoolData } from '../controllers/reset.controller';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireRole('administrator'));
router.post('/reset', resetSchoolData);

export default router;
