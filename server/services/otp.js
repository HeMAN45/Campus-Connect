import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { get, all, run, nowIso } from '../db/index.js';
import { HttpError } from '../middleware/errors.js';
import { hit, HOUR, MIN } from '../middleware/rateLimit.js';

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

async function sendOtp(email, code, purpose) {
  const subject = purpose === 'register' ? 'Your Campus Connect sign-up code' : 'Your Campus Connect password reset code';
  const text = `Your code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`;
  if (!transport) {
    console.log(`\n[mail:dev] To: ${email}\n[mail:dev] ${subject}: ${code}\n`);
    return;
  }
  await transport.sendMail({ from: config.mailFrom, to: email, subject, text });
}

const hash = (email, code) => crypto.createHash('sha256').update(`${code}:${email}:${config.jwtSecret}`).digest('hex');

export async function issueOtp(email, purpose, ip) {
  const recent = all(
    'SELECT created_at FROM email_otps WHERE email = ? AND purpose = ? AND created_at > ? ORDER BY created_at DESC',
    email,
    purpose,
    new Date(Date.now() - HOUR).toISOString(),
  );
  if (recent[0]) {
    const elapsed = Math.floor((Date.now() - Date.parse(recent[0].created_at)) / 1000);
    if (elapsed < 60) {
      const retryAfter = 60 - elapsed;
      throw new HttpError(429, 'RATE_LIMITED', `Wait ${retryAfter} seconds before requesting another code.`, { retryAfter });
    }
  }
  if (recent.length >= 5) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many codes requested. Try again in an hour.', { retryAfter: 3600 });
  }
  hit(`otp-ip:${ip}`, 20, HOUR);

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  run('UPDATE email_otps SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL', nowIso(), email, purpose);
  run(
    'INSERT INTO email_otps (email, purpose, code_hash, expires_at, request_ip) VALUES (?, ?, ?, ?, ?)',
    email,
    purpose,
    hash(email, code),
    new Date(Date.now() + 10 * MIN).toISOString(),
    ip,
  );
  await sendOtp(email, code, purpose);
  return code;
}

export function verifyOtp(email, purpose, code) {
  const row = get(
    'SELECT * FROM email_otps WHERE email = ? AND purpose = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1',
    email,
    purpose,
  );
  if (!row) throw new HttpError(400, 'OTP_INVALID', 'That code is not valid. Request a new code.');
  if (row.expires_at < nowIso()) throw new HttpError(400, 'OTP_EXPIRED', 'This code expired. Request a new one.');
  if (row.attempts >= 5) throw new HttpError(400, 'OTP_LOCKED', 'Too many wrong tries. Request a new code.');

  const given = Buffer.from(hash(email, String(code || '').trim()), 'hex');
  if (!crypto.timingSafeEqual(given, Buffer.from(row.code_hash, 'hex'))) {
    run('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', row.id);
    const left = 4 - row.attempts;
    if (left <= 0) throw new HttpError(400, 'OTP_LOCKED', 'Too many wrong tries. Request a new code.');
    throw new HttpError(400, 'OTP_INVALID', `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, {
      triesLeft: left,
    });
  }
  run('UPDATE email_otps SET consumed_at = ? WHERE id = ?', nowIso(), row.id);
}

export function purgeOldOtps() {
  run('DELETE FROM email_otps WHERE created_at < ?', new Date(Date.now() - 24 * HOUR).toISOString());
}
