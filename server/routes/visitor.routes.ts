import { Router } from 'express';
import { checkoutVisitor, createVisitor, listVisitors } from '../controllers/visitor.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.get('/', requirePermission('visitors.read', 'visitors.manage'), listVisitors);
router.post('/', requirePermission('visitors.manage'), createVisitor);
router.post('/:id/checkout', requirePermission('visitors.manage'), checkoutVisitor);

export default router;
