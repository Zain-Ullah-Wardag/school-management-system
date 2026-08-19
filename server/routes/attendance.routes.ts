import { Router } from 'express';
import * as c from '../controllers/attendance.controller';
import { requireAuth,requirePermission } from '../middleware/auth';
const router=Router();router.use(requireAuth);
router.get('/roster',requirePermission('attendance.read','attendance.mark'),c.roster);router.post('/',requirePermission('attendance.mark','attendance.manage'),c.save);router.patch('/:id/lock',requirePermission('attendance.manage'),c.lock);
router.get('/reports/daily',requirePermission('attendance.read'),c.daily);router.get('/reports/monthly',requirePermission('attendance.read'),c.monthly);router.get('/students/:studentId/history',requirePermission('attendance.read'),c.history);
router.get('/staff',requirePermission('staff.read','attendance.manage'),c.staffList);router.post('/staff',requirePermission('attendance.manage'),c.staffSave);router.post('/staff/me',c.markOwn);
export default router;
