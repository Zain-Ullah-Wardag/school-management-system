import type { Request, Response } from 'express';
import { MessagingService } from '../services/messaging.service';
import { asyncHandler, parseId, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';

const service = new MessagingService();
const userId = (req: Request) => (req as AuthenticatedRequest).user!.id;

export const providers = asyncHandler((_req: Request, res: Response) => success(res, service.providers()));
export const configurations = asyncHandler((_req: Request, res: Response) => success(res, service.configurations()));
export const configuration = asyncHandler((req: Request, res: Response) => success(res, service.configuration(parseId(req.params.id, 'configuration id'))));
export const saveConfiguration = asyncHandler((req: Request, res: Response) => success(res, service.saveConfiguration(req.body, userId(req), req.params.id ? parseId(req.params.id, 'configuration id') : undefined), req.params.id ? 200 : 201));
export const deleteConfiguration = asyncHandler((req: Request, res: Response) => { service.deleteConfiguration(parseId(req.params.id, 'configuration id')); success(res, { deleted: true }); });
export const validateConfiguration = asyncHandler(async (req: Request, res: Response) => success(res, await service.validateConfiguration(parseId(req.params.id, 'configuration id'))));
export const testConfiguration = asyncHandler(async (req: Request, res: Response) => success(res, await service.testConfiguration(parseId(req.params.id, 'configuration id'), req.body, userId(req))));
export const templates = asyncHandler((_req: Request, res: Response) => success(res, service.templates()));
export const saveTemplate = asyncHandler((req: Request, res: Response) => success(res, service.saveTemplate(req.body, userId(req), req.params.id ? parseId(req.params.id, 'template id') : undefined), req.params.id ? 200 : 201));
export const deleteTemplate = asyncHandler((req: Request, res: Response) => { service.deleteTemplate(parseId(req.params.id, 'template id')); success(res, { deleted: true }); });
export const sendMessage = asyncHandler(async (req: Request, res: Response) => success(res, await service.send(req.body, userId(req)), 201));
export const logs = asyncHandler((req: Request, res: Response) => success(res, service.logs(req.query)));
export const retry = asyncHandler(async (req: Request, res: Response) => success(res, await service.retry(parseId(req.params.id, 'message log id'), userId(req)), 201));
export const modemPorts = asyncHandler(async (_req: Request, res: Response) => success(res, await service.modemPorts()));
export const modemConnect = asyncHandler(async (req: Request, res: Response) => success(res, await service.modemConnect(req.body)));
export const modemDisconnect = asyncHandler(async (req: Request, res: Response) => success(res, await service.modemDisconnect(req.body)));
export const modemInfo = asyncHandler(async (req: Request, res: Response) => success(res, await service.modemInfo(req.body)));
