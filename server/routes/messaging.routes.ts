import { Router } from 'express';
import * as controller from '../controllers/messaging.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.get('/providers', requirePermission('sms.manage'), controller.providers);
router.get('/configurations', requirePermission('sms.manage'), controller.configurations);
router.post('/configurations', requirePermission('sms.manage'), controller.saveConfiguration);
router.get('/configurations/:id', requirePermission('sms.manage'), controller.configuration);
router.patch('/configurations/:id', requirePermission('sms.manage'), controller.saveConfiguration);
router.delete('/configurations/:id', requirePermission('sms.manage'), controller.deleteConfiguration);
router.post('/configurations/:id/validate', requirePermission('sms.manage'), controller.validateConfiguration);
router.post('/configurations/:id/test', requirePermission('sms.manage'), controller.testConfiguration);
router.get('/logs', requirePermission('sms.send', 'sms.manage'), controller.logs);
router.post('/logs/:id/retry', requirePermission('sms.send', 'sms.manage'), controller.retry);
router.get('/templates', requirePermission('sms.send', 'sms.manage'), controller.templates);
router.post('/templates', requirePermission('sms.manage'), controller.saveTemplate);
router.patch('/templates/:id', requirePermission('sms.manage'), controller.saveTemplate);
router.delete('/templates/:id', requirePermission('sms.manage'), controller.deleteTemplate);
router.post('/send', requirePermission('sms.send'), controller.sendMessage);
router.get('/modem/ports', requirePermission('sms.manage'), controller.modemPorts);
router.post('/modem/connect', requirePermission('sms.manage'), controller.modemConnect);
router.post('/modem/disconnect', requirePermission('sms.manage'), controller.modemDisconnect);
router.post('/modem/info', requirePermission('sms.manage'), controller.modemInfo);

export default router;
