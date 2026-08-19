import type { Request } from 'express';
import { AcademicService } from '../services/academic.service';
import { asyncHandler, message, parseId, success } from '../utils/http';
import { logActivity } from '../utils/activity';
import type { AuthenticatedRequest } from '../types';
const service = new AcademicService(); const actor = (r: Request) => (r as AuthenticatedRequest).user!;
const entity = (name: string, getter: (req: Request) => unknown, saver: (input: Record<string, unknown>, id?: number) => unknown) => ({
  list: asyncHandler((req, res) => success(res, getter(req))),
  create: asyncHandler((req, res) => { const item = saver(req.body); logActivity(actor(req).id, 'created', name, undefined, `Created ${name}`); success(res, item, 201); }),
  update: asyncHandler((req, res) => { const id = parseId(req.params.id); const item = saver(req.body, id); logActivity(actor(req).id, 'updated', name, id, `Updated ${name}`); success(res, item); })
});
export const classEntity = entity('class', (req) => service.classes(req.query.all === 'true'), service.saveClass.bind(service));
export const listClasses = classEntity.list; export const createClass = classEntity.create; export const updateClass = classEntity.update;
export const getClass = asyncHandler((req, res) => success(res, service.classById(parseId(req.params.id))));
export const deleteClass = asyncHandler((req, res) => { const id=parseId(req.params.id); service.deleteClass(id); message(res, 'Class deleted'); });
export const sectionEntity = entity('section', (req) => service.sections(req.query.class_id ? Number(req.query.class_id) : undefined), service.saveSection.bind(service));
export const listSections=sectionEntity.list; export const createSection=sectionEntity.create; export const updateSection=sectionEntity.update;
export const deleteSection=asyncHandler((req,res)=>{service.deleteSection(parseId(req.params.id));message(res,'Section deleted');});
export const subjectEntity=entity('subject',(req)=>service.subjects(req.query.all==='true'),service.saveSubject.bind(service));
export const listSubjects=subjectEntity.list; export const createSubject=subjectEntity.create; export const updateSubject=subjectEntity.update;
export const deleteSubject=asyncHandler((req,res)=>{service.deleteSubject(parseId(req.params.id));message(res,'Subject deleted');});
export const listClassSubjects=asyncHandler((req,res)=>success(res,service.classSubjects(req.query.class_id?Number(req.query.class_id):undefined)));
export const createClassSubject=asyncHandler((req,res)=>success(res,service.saveClassSubject(req.body),201));
export const updateClassSubject=asyncHandler((req,res)=>success(res,service.saveClassSubject(req.body,parseId(req.params.id))));
export const deleteClassSubject=asyncHandler((req,res)=>{service.deleteClassSubject(parseId(req.params.id));message(res,'Subject assignment deleted');});
export const listSessions=asyncHandler((_req,res)=>success(res,service.sessions()));
export const createSession=asyncHandler((req,res)=>success(res,service.saveSession(req.body),201));
export const updateSession=asyncHandler((req,res)=>success(res,service.saveSession(req.body,parseId(req.params.id))));
export const listExamTypes=asyncHandler((_req,res)=>success(res,service.examTypes()));
export const createExamType=asyncHandler((req,res)=>success(res,service.saveExamType(req.body),201));
export const updateExamType=asyncHandler((req,res)=>success(res,service.saveExamType(req.body,parseId(req.params.id))));
export const deleteExamType=asyncHandler((req,res)=>{service.deleteExamType(parseId(req.params.id));message(res,'Exam type deleted');});
export const listRooms=asyncHandler((_req,res)=>success(res,service.rooms()));
export const createRoom=asyncHandler((req,res)=>success(res,service.saveRoom(req.body),201));
export const updateRoom=asyncHandler((req,res)=>success(res,service.saveRoom(req.body,parseId(req.params.id))));
export const deleteRoom=asyncHandler((req,res)=>{service.deleteRoom(parseId(req.params.id));message(res,'Room deleted');});
