import { z } from 'zod';
import { config } from '../config.js';

const blank = (v) => v === '' || v === null || v === undefined || v === 'null' || v === 'undefined';
const trimOrUndef = (v) => {
  if (blank(v)) return undefined;
  const t = typeof v === 'string' ? v.trim() : v;
  return t === '' ? undefined : t;
};

export const str = (min, max) =>
  z.preprocess(
    trimOrUndef,
    z
      .string({ required_error: 'Required', invalid_type_error: 'Required' })
      .min(min, min === 1 ? 'Required' : `Use at least ${min} characters`)
      .max(max, `Use at most ${max} characters`),
  );

export const optStr = (max) =>
  z.preprocess(trimOrUndef, z.string().max(max, `Use at most ${max} characters`).optional());

export const optInt = (min, max) =>
  z.preprocess((v) => (blank(v) ? undefined : Number(v)), z.number().int().min(min).max(max).optional());

export const reqInt = (min, max) =>
  z.preprocess((v) => (blank(v) ? undefined : Number(v)), z.number({ required_error: 'Required', invalid_type_error: 'Required' }).int().min(min).max(max));

export const bool = z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 1, z.boolean());

export const isoDateTime = z.preprocess(
  trimOrUndef,
  z.string({ required_error: 'Required' }).refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time'),
);
export const optIsoDateTime = z.preprocess(
  trimOrUndef,
  z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time').optional(),
);
export const dateOnly = z.preprocess(
  trimOrUndef,
  z.string({ required_error: 'Required' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
);

export const url = optStr(300).refine((v) => !v || /^https?:\/\/\S+$/i.test(v), 'Use a link starting with http:// or https://');

export const jsonList = (item, max) =>
  z.preprocess((v) => {
    if (blank(v)) return [];
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return v.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return v;
  }, z.array(item).max(max, `At most ${max} items`));

const domainPattern = config.allowedDomain.replace(/\./g, '\\.');
export const EMAIL_RE = new RegExp(`^[a-z0-9._%+-]+@([a-z0-9-]+\\.)*${domainPattern}$`, 'i');

export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

export const password = z
  .string({ required_error: 'Required' })
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), 'Include at least one letter and one number');

export const parse = (schema, data) => schema.parse(data);
