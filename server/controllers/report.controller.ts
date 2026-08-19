import { asyncHandler, parseId, success } from '../utils/http';
import { ReportService } from '../services/report.service';

const service = new ReportService();

export const students = asyncHandler((req, res) => success(res, service.studentList(req.query)));
export const attendance = asyncHandler((req, res) => success(res, service.attendance(req.query)));
export const fees = asyncHandler((req, res) => success(res, service.fees(req.query)));
export const finance = asyncHandler((req, res) => success(res, service.finance(req.query)));
export const resultCard = asyncHandler((req, res) => success(res, service.resultCard(parseId(req.params.examId, 'exam id'), parseId(req.params.studentId, 'student id'), Number(req.query.class_id), req.query.section_id ? Number(req.query.section_id) : null)));
export const classTestCard = asyncHandler((req, res) => success(res, service.classTestCard(parseId(req.params.testId, 'test id'), parseId(req.params.studentId, 'student id'))));
export const awardList = asyncHandler((req, res) => success(res, service.awardList(parseId(req.params.examId, 'exam id'), Number(req.query.class_id), req.query.section_id ? Number(req.query.section_id) : null)));
export const blankAwardList = asyncHandler((req, res) => success(res, service.blankAwardList(parseId(req.params.examId, 'exam id'), Number(req.query.class_id), req.query.section_id ? Number(req.query.section_id) : null)));
export const timetable = asyncHandler((req, res) => success(res, service.timetable(req.query)));
export const certificate = asyncHandler((req, res) => success(res, service.certificate(parseId(req.params.studentId, 'student id'), String(req.query.type || 'bonafide'))));
