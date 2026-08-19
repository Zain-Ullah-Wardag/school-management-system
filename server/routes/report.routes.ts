import { Router } from 'express';
import * as c from '../controllers/report.controller';
import { requireAuth,requirePermission } from '../middleware/auth';
const router=Router();router.use(requireAuth,requirePermission('reports.read'));
router.get('/students',c.students);router.get('/attendance',c.attendance);router.get('/fees',c.fees);router.get('/finance',c.finance);router.get('/class-test-card/:testId/:studentId',c.classTestCard);router.get('/result-card/:examId/:studentId',c.resultCard);router.get('/award-list/:examId',c.awardList);router.get('/blank-award-list/:examId',c.blankAwardList);router.get('/timetable',c.timetable);router.get('/certificate/:studentId',c.certificate);export default router;
