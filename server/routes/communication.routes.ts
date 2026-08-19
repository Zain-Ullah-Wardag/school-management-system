import { Router } from 'express';
import * as c from '../controllers/communication.controller';
import { requireAuth,requirePermission } from '../middleware/auth';
const router=Router();router.use(requireAuth);
router.get('/gateway',requirePermission('sms.manage'),c.gateway);router.patch('/gateway',requirePermission('sms.manage'),c.saveGateway);
router.get('/templates',requirePermission('sms.send','sms.manage'),c.templates);router.post('/templates',requirePermission('sms.manage'),c.saveTemplate);router.patch('/templates/:id',requirePermission('sms.manage'),c.saveTemplate);router.delete('/templates/:id',requirePermission('sms.manage'),c.deleteTemplate);
router.get('/logs',requirePermission('sms.send','sms.manage'),c.logs);router.post('/send',requirePermission('sms.send'),c.send);router.post('/logs/:id/resend',requirePermission('sms.send'),c.resend);router.post('/whatsapp-link',requirePermission('sms.send'),c.whatsapp);
export default router;
