import { Router } from 'express';
import * as c from '../controllers/settings.controller';
import { requireAuth,requirePermission } from '../middleware/auth';
const router=Router();router.use(requireAuth);
router.get('/branding',c.getBranding);
router.get('/',requirePermission('settings.manage'),c.getSettings);router.put('/',requirePermission('settings.manage'),c.updateSettings);
router.get('/roles',requirePermission('settings.manage'),c.roles);router.post('/roles',requirePermission('settings.manage'),c.saveRole);router.get('/roles/:id',requirePermission('settings.manage'),c.role);router.patch('/roles/:id',requirePermission('settings.manage'),c.saveRole);router.delete('/roles/:id',requirePermission('settings.manage'),c.deleteRole);
export default router;
