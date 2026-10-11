import fs from 'node:fs';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from '../config.js';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const notFound = (message = "This doesn't exist or was removed.") =>
  new HttpError(404, 'NOT_FOUND', message);
export const forbidden = (message = "You don't have permission to do that.", code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const badRequest = (message, fields) =>
  new HttpError(400, 'VALIDATION_ERROR', message, fields ? { fields } : {});

const humanize = (key) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/\.\d+$/, '');

export function errorHandler(err, req, res, next) {
  for (const file of req.cleanupFiles || []) fs.rm(file, { force: true }, () => {});
  if (res.headersSent) return next(err);

  let status = 500;
  let body;
  if (err instanceof HttpError) {
    status = err.status;
    body = { code: err.code, message: err.message, ...err.extra };
  } else if (err instanceof ZodError) {
    status = 400;
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fields[key]) fields[key] = issue.message;
    }
    const [firstKey, firstMsg] = Object.entries(fields)[0] || ['form', 'Invalid input'];
    body = { code: 'VALIDATION_ERROR', message: `${humanize(firstKey)}: ${firstMsg}`, fields };
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    body =
      err.code === 'LIMIT_FILE_SIZE'
        ? { code: 'FILE_TOO_LARGE', message: `Images must be under ${config.maxUploadMb} MB.` }
        : { code: 'TOO_MANY_FILES', message: 'Too many images attached.' };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'That request is too large.' };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'VALIDATION_ERROR', message: 'Malformed request body.' };
  } else if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    status = err.status;
    body = { code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: status === 404 ? 'Not found.' : 'Bad request.' };
  } else if (/UNIQUE constraint failed/.test(err?.message || '')) {
    status = 409;
    body = { code: 'CONFLICT', message: 'That already exists.' };
  } else {
    console.error(err);
    body = { code: 'INTERNAL', message: 'Something went wrong. Try again.' };
  }
  res.status(status).json({ error: body });
}
