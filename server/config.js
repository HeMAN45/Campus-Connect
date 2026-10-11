import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && !process.env.CC_SKIP_ENV_FILE) process.loadEnvFile(envFile);

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

const resolvePath = (value, fallback) => {
  const v = value || fallback;
  return v === ':memory:' ? v : path.resolve(root, v);
};

const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const config = {
  root,
  isProd,
  port: Number(env.PORT || 4000),
  jwtSecret,
  sessionDays: Number(env.SESSION_DAYS || 7),
  allowedDomain: (env.ALLOWED_EMAIL_DOMAIN || 'dypiu.ac.in').toLowerCase(),
  dbPath: resolvePath(env.DB_PATH, './data/campus.db'),
  uploadDir: resolvePath(env.UPLOAD_DIR, './uploads'),
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
  seedPassword: env.SEED_PASSWORD || '',
};
