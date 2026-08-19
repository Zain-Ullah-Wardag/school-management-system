import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

const uploadDirectory = () => path.resolve(process.env.UPLOAD_DIR || 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => { fs.mkdirSync(uploadDirectory(), { recursive: true }); callback(null, uploadDirectory()); },
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});

const documentMimeTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text', 'text/plain'
];
const documentExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.odt', '.txt'];

function acceptsDocument(file: Express.Multer.File) {
  return documentMimeTypes.includes(file.mimetype) || documentExtensions.includes(path.extname(file.originalname).toLowerCase());
}

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!acceptsDocument(file)) return callback(new Error('Supported files are PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX, ODT, and TXT'));
    callback(null, true);
  }
});

export const studentDocumentUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!acceptsDocument(file)) return callback(new Error('Supported files are PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX, ODT, and TXT'));
    callback(null, true);
  }
});

export const databaseUpload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.db', '.sqlite', '.sqlite3'].includes(extension)) return callback(new Error('Select a SQLite backup file (.db, .sqlite, or .sqlite3)'));
    callback(null, true);
  }
});
