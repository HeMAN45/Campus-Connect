import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './errors.js';

const MIME_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const ALLOWED = new Set(Object.values(MIME_BY_EXT));
const typeError = () => new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Use a JPG, PNG, WebP, or GIF image.');

const make = (files) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files, fields: 40, fieldSize: 20 * 1024 },
    fileFilter: (req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(typeError())),
  });

export const uploadImages = (field, max) => make(max).array(field, max);
export const uploadImage = (field) => make(1).single(field);
export const uploadFields = (fields) => make(fields.length).fields(fields.map((name) => ({ name, maxCount: 1 })));

function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function dimensions(buf, ext) {
  try {
    if (ext === 'png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (ext === 'gif') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (ext === 'webp') {
      const chunk = buf.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
      }
      if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (ext === 'jpg') {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) return {};
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {
    // Unreadable headers just mean unknown dimensions.
  }
  return {};
}

// Writes a validated image to disk and registers it for deletion if the request later fails.
export function saveImage(req, file, kind) {
  const ext = sniff(file.buffer);
  if (!ext || MIME_BY_EXT[ext] !== file.mimetype) throw typeError();
  const d = new Date();
  const rel = path.posix.join(
    kind,
    String(d.getUTCFullYear()),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    `${crypto.randomBytes(16).toString('hex')}.${ext}`,
  );
  const abs = path.join(config.uploadDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, file.buffer);
  (req.cleanupFiles ||= []).push(abs);
  return { url: `/uploads/${rel}`, bytes: file.size, ...dimensions(file.buffer, ext) };
}

export const keepUploads = (req) => {
  req.cleanupFiles = [];
};

export function removeUpload(url) {
  if (!url?.startsWith('/uploads/')) return;
  const abs = path.resolve(config.uploadDir, url.slice('/uploads/'.length));
  if (!abs.startsWith(path.resolve(config.uploadDir))) return;
  fs.rm(abs, { force: true }, () => {});
}
