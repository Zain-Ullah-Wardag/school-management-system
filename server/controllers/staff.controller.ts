import type { Request, Response } from 'express';
import { StaffService } from '../services/staff.service';
import { asyncHandler, message, parseId, required, success } from '../utils/http';
import type { AuthenticatedRequest } from '../types';
import { logActivity } from '../utils/activity';

const service = new StaffService(); const user = (req: Request) => (req as AuthenticatedRequest).user!;
export const listStaff = asyncHandler((req, res) => success(res, service.list(req.query)));
export const staffOptions = asyncHandler((_req, res) => success(res, service.options()));
export const myWorkspace = asyncHandler((req: Request, res: Response) => success(res, service.workspace(user(req).id)));
export const getStaff = asyncHandler((req, res) => success(res, service.get(parseId(req.params.id, 'staff id'))));
export const createStaff = asyncHandler((req: Request, res: Response) => { const record = service.create(req.body, user(req).id) as unknown as { id: number; first_name: string }; logActivity(user(req).id, 'created', 'staff', record.id, `Added staff member ${record.first_name}`); success(res, record, 201); });
export const updateStaff = asyncHandler((req: Request, res: Response) => { const id = parseId(req.params.id, 'staff id'); success(res, service.update(id, req.body, user(req).id)); logActivity(user(req).id, 'updated', 'staff', id, 'Updated staff record'); });
export const archiveStaff = asyncHandler((req: Request, res: Response) => { const id = parseId(req.params.id, 'staff id'); service.archive(id); logActivity(user(req).id, 'archived', 'staff', id, 'Archived staff member'); message(res, 'Staff member archived'); });
export const addSalary = asyncHandler((req: Request, res: Response) => { const id = parseId(req.params.id, 'staff id'); service.addSalary(id, Number(req.body.amount), required(req.body.effective_from, 'Effective date'), String(req.body.note || ''), user(req).id); message(res, 'Salary history updated'); });
export const departments = asyncHandler((_req, res) => success(res, service.departments()));
export const designations = asyncHandler((_req, res) => success(res, service.designations()));
export const addDepartment = asyncHandler((req, res) => success(res, service.manageLookup('departments', String(req.body.name || '')), 201));
export const addDesignation = asyncHandler((req, res) => success(res, service.manageLookup('designations', String(req.body.name || '')), 201));
