import type { Request } from 'express';
import { SettingsService } from '../services/settings.service';
import { asyncHandler,message,parseId,success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';
const service=new SettingsService();const user=(r:Request)=>(r as AuthenticatedRequest).user!;
export const getBranding=asyncHandler((_req,res)=>success(res,service.branding()));
export const getSettings=asyncHandler((_req,res)=>success(res,service.all()));export const updateSettings=asyncHandler((req,res)=>success(res,service.update(req.body,user(req).id)));
export const roles=asyncHandler((_req,res)=>success(res,service.roles()));export const role=asyncHandler((req,res)=>success(res,service.role(parseId(req.params.id,'role id'))));export const saveRole=asyncHandler((req,res)=>success(res,service.saveRole(req.body,req.params.id?parseId(req.params.id,'role id'):undefined),req.params.id?200:201));export const deleteRole=asyncHandler((req,res)=>{service.deleteRole(parseId(req.params.id,'role id'));message(res,'Role deleted');});
