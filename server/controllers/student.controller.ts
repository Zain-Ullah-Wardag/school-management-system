import type { Request, Response } from 'express';
import { StudentService } from '../services/student.service';
import { asyncHandler, message, parseId, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';
import { logActivity } from '../utils/activity';
import { ApiError } from '../utils/errors';

const service = new StudentService();
const actor = (req: Request) => (req as AuthenticatedRequest).user!;

export const listStudents = asyncHandler((req, res) => success(res, service.list(req.query)));
export const studentStats = asyncHandler((_req, res) => success(res, service.stats()));
export const nextIdentifiers = asyncHandler((req, res) => success(res, service.nextIdentifiers(req.query.class_id ? Number(req.query.class_id) : undefined, req.query.section_id ? Number(req.query.section_id) : null, req.query.session_id ? Number(req.query.session_id) : undefined)));
export const getStudent = asyncHandler((req, res) => success(res, service.get(parseId(req.params.id, 'student id'))));
export const classTestHistory = asyncHandler((req, res) => success(res, service.classTestHistory(parseId(req.params.id, 'student id'))));
export const academicResults = asyncHandler((req, res) => success(res, service.academicResults(parseId(req.params.id, 'student id'))));

export const createStudent = asyncHandler((req: Request, res: Response) => {
  const user = actor(req);
  const student = service.create(req.body, user.id);
  const record = student as unknown as { id: number; admission_no: string; first_name: string };
  logActivity(user.id, 'created', 'student', record.id, `Registered ${record.first_name} (${record.admission_no})`);
  success(res, student, 201);
});

export const updateStudent = asyncHandler((req: Request, res: Response) => {
  const user = actor(req);
  const id = parseId(req.params.id, 'student id');
  const student = service.update(id, req.body);
  logActivity(user.id, 'updated', 'student', id, 'Updated student record');
  success(res, student);
});

export const archiveStudent = asyncHandler((req: Request, res: Response) => {
  const id = parseId(req.params.id, 'student id');
  service.archive(id);
  logActivity(actor(req).id, 'archived', 'student', id, 'Archived student record');
  message(res, 'Student archived successfully');
});

export const restoreStudent = asyncHandler((req: Request, res: Response) => {
  const id = parseId(req.params.id, 'student id');
  const student = service.restore(id);
  logActivity(actor(req).id, 'restored', 'student', id, 'Restored archived student record');
  success(res, student);
});

export const addDocument = asyncHandler((req: Request, res: Response) => success(res, service.addDocument(parseId(req.params.id, 'student id'), req.body, actor(req).id), 201));
export const uploadDocuments = asyncHandler((req: Request, res: Response) => success(res, service.addUploadedDocuments(parseId(req.params.id, 'student id'), (req.files || []) as Express.Multer.File[], actor(req).id), 201));
export const replaceDocument = asyncHandler((req: Request, res: Response) => { if (!req.file) throw new ApiError(422, 'Select a replacement document'); return success(res, service.replaceDocument(parseId(req.params.id, 'student id'), parseId(req.params.documentId, 'document id'), req.file, actor(req).id)); });
export const removeDocument = asyncHandler((req: Request, res: Response) => {
  service.removeDocument(parseId(req.params.id, 'student id'), parseId(req.params.documentId, 'document id'));
  message(res, 'Document removed');
});

export const autoPromote = asyncHandler((req: Request, res: Response) => {
  const result = service.autoPromote(req.body, actor(req).id);
  logActivity(actor(req).id, 'auto_promoted', 'students', undefined, `Processed ${result.promoted} student promotions`);
  success(res, result);
});

export const promote = asyncHandler((req: Request, res: Response) => {
  const id = parseId(req.params.id, 'student id');
  const student = service.promote(id, req.body, actor(req).id);
  logActivity(actor(req).id, 'promoted', 'student', id, 'Processed student promotion');
  success(res, student);
});
