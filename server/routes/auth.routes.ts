import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.post('/login', controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, controller.changePassword);
export default router;
