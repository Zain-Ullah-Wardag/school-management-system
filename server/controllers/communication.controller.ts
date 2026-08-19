import type { Request } from 'express';
import { CommunicationService } from '../services/communication.service';
import { asyncHandler,message,parseId,success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';
import { logActivity } from '../utils/activity';
const service=new CommunicationService();const user=(r:Request)=>(r as AuthenticatedRequest).user!;
export const gateway=asyncHandler((_req,res)=>success(res,service.gateway()));export const saveGateway=asyncHandler((req,res)=>success(res,service.saveGateway(req.body)));
export const templates=asyncHandler((_req,res)=>success(res,service.templates()));export const saveTemplate=asyncHandler((req,res)=>success(res,service.saveTemplate(req.body,req.params.id?parseId(req.params.id):undefined),req.params.id?200:201));export const deleteTemplate=asyncHandler((req,res)=>{service.deleteTemplate(parseId(req.params.id));message(res,'Template deleted');});
export const logs=asyncHandler((req,res)=>success(res,service.logs(req.query)));export const send=asyncHandler(async(req,res)=>{const result=await service.send(req.body,user(req).id);logActivity(user(req).id,'sent','message',undefined,`Sent ${result.total} ${req.body.channel||'SMS'} messages`);success(res,result,201);});export const resend=asyncHandler(async(req,res)=>success(res,await service.resend(parseId(req.params.id,'message id'),user(req).id),201));export const whatsapp=asyncHandler((req,res)=>success(res,{url:service.whatsappUrl(String(req.body.phone||''),String(req.body.message||''))}));
