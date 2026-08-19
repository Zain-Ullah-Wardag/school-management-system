import { Router } from 'express';
import * as c from '../controllers/timetable.controller';
import { requireAuth,requirePermission } from '../middleware/auth';
const router=Router();router.use(requireAuth);
router.get('/settings',requirePermission('timetable.read'),c.getSettings);router.patch('/settings',requirePermission('timetable.manage'),c.updateSettings);
router.post('/periods',requirePermission('timetable.manage'),c.createPeriod);router.patch('/periods/:id',requirePermission('timetable.manage'),c.updatePeriod);router.delete('/periods/:id',requirePermission('timetable.manage'),c.deletePeriod);
router.get('/entries',requirePermission('timetable.read'),c.listEntries);router.post('/entries',requirePermission('timetable.manage'),c.createEntry);router.patch('/entries/:id',requirePermission('timetable.manage'),c.updateEntry);router.delete('/entries/:id',requirePermission('timetable.manage'),c.deleteEntry);
export default router;
