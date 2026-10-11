import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && !process.env.CC_SKIP_ENV_FILE && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';

let jwtSecret = env.JWT_SECRET || '';
if (jwtSecret.length < 32) {
  if (isProd) {
    console.error('[config] JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
  jwtSecret = 'development-only-secret-do-not-use-in-production';
}

const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const config = {
  root,
  isProd,
  port: Number(env.PORT || 4000),
  jwtSecret,
  sessionDays: Number(env.SESSION_DAYS || 7),
  allowedDomain: (env.ALLOWED_EMAIL_DOMAIN || 'dypiu.ac.in').toLowerCase(),
  databaseUrl: env.DATABASE_URL || 'postgresql://localhost:5432/campus_connect',
  uploadDir: env.UPLOAD_DIR ? path.resolve(root, env.UPLOAD_DIR) : (env.VERCEL ? '/tmp/uploads' : path.resolve(root, './uploads')),
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 5),
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  clientDist: path.resolve(root, '../client/dist'),
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },
  mailFrom: env.MAIL_FROM || 'Campus Connect <no-reply@localhost>',
  adminEmails: list(env.ADMIN_EMAILS),
};
