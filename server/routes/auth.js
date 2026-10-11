import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { get, run, tx } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { HttpError, badRequest } from '../middleware/errors.js';
import { requireAuth, setSessionCookie, clearSessionCookie, checkSuspension } from '../middleware/auth.js';
import { hit, MIN } from '../middleware/rateLimit.js';
import { issueOtp, verifyOtp } from '../services/otp.js';
import { EMAIL_RE, normalizeEmail, parse, str, optStr, optInt, reqInt, password } from '../services/validators.js';
import { findProgram, graduationYear } from '../services/reference.js';
import { joinDefaultCommunities } from '../services/communities.js';
import { reindexUser } from '../services/search.js';
import { userProfile } from '../services/serialize.js';
import { permissionsFor } from '../services/permissions.js';

const r = makeRouter();
const PURPOSES = ['register', 'reset_password'];

export async function unreadCounts(userId) {
  const messages = (await get(
    `SELECT count(*) AS n FROM messages m
     JOIN conversations cv ON cv.id = m.conversation_id
     WHERE (cv.user_a_id = ? OR cv.user_b_id = ?) AND m.sender_id <> ? AND m.deleted_at IS NULL
       AND m.id > CASE WHEN cv.user_a_id = ? THEN cv.user_a_last_read_id ELSE cv.user_b_last_read_id END`,
    userId,
    userId,
    userId,
    userId,
  )).n;
  const notifications = (await get('SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', userId)).n;
  return { messages, notifications };
}

export const mePayload = async (user) => ({
  user: await userProfile(user, user),
  permissions: await permissionsFor(user),
  unread: await unreadCounts(user.id),
});

const domainError = () =>
  new HttpError(400, 'INVALID_EMAIL_DOMAIN', `Use your college email ending in ${config.allowedDomain}.`, {
    fields: { email: `Use your college email ending in ${config.allowedDomain}` },
  });

r.post('/otp/request', async (req, res) => {
  const body = parse(z.object({ email: z.string(), purpose: z.enum(PURPOSES).default('register') }), req.body);
  const email = normalizeEmail(body.email);
  if (!EMAIL_RE.test(email)) throw domainError();
  const existing = await get('SELECT id FROM users WHERE email = ?', email);
  if (body.purpose === 'register' && existing) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'You already have an account. Log in instead.');
  }
  if (body.purpose === 'reset_password' && !existing) return res.status(204).end();
  const code = await issueOtp(email, body.purpose, req.ip);
  if (!config.smtp.host && !config.isProd) return res.json({ devCode: code });
  res.status(204).end();
});

r.post('/otp/verify', async (req, res) => {
  const body = parse(
    z.object({ email: z.string(), code: z.string(), purpose: z.enum(PURPOSES).default('register') }),
    req.body,
  );
  const email = normalizeEmail(body.email);
  hit(`otp-verify:${req.ip}`, 10, 15 * MIN);
  await verifyOtp(email, body.purpose, body.code);
  const token = jwt.sign({ email, purpose: body.purpose }, config.jwtSecret, { expiresIn: '15m' });
  res.json(body.purpose === 'register' ? { registrationToken: token } : { resetToken: token });
});

const registerSchema = z
  .object({
    registrationToken: z.string(),
    name: str(2, 80),
    password,
    role: z.enum(['student', 'teacher']),
    departmentId: reqInt(1, 1e9),
    program: optStr(40),
    year: optInt(1, 5),
    section: optStr(10),
    designation: optStr(60),
    officeLocation: optStr(100),
    officeHours: optStr(120),
  })
  .superRefine((v, ctx) => {
    const need = (key) => !v[key] && ctx.addIssue({ code: 'custom', path: [key], message: 'Required' });
    if (v.role === 'student') ['program', 'year'].forEach(need);
    else ['designation', 'officeLocation'].forEach(need);
  });

function readToken(token, purpose) {
  try {
    const claims = jwt.verify(token, config.jwtSecret);
    if (claims.purpose === purpose) return claims;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'TOKEN_EXPIRED', 'Your verification expired. Start again with your email.');
}

r.post('/register', async (req, res) => {
  const b = parse(registerSchema, req.body);
  const { email } = readToken(b.registrationToken, 'register');
  if (await get('SELECT id FROM users WHERE email = ?', email)) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'You already have an account. Log in instead.');
  }
  if (!(await get('SELECT id FROM departments WHERE id = ?', b.departmentId))) {
    throw badRequest('Choose your department.', { departmentId: 'Choose your department' });
  }
  const student = b.role === 'student';
  if (student) {
    const program = findProgram(b.program);
    if (!program) throw badRequest('Choose your program.', { program: 'Choose your program' });
    if (b.year > program.years) throw badRequest(`${program.name} has ${program.years} years.`, { year: 'Not valid for this program' });
  }
  const hash = await bcrypt.hash(b.password, 10);
  const role = config.adminEmails.includes(email) ? 'admin' : b.role;
  const user = await tx(async () => {
    const { id } = await run(
      `INSERT INTO users (email, password_hash, name, role, status, department_id, program, year, section,
         graduation_year, designation, office_location, office_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      email,
      hash,
      b.name,
      role,
      role === 'teacher' ? 'pending' : 'active',
      b.departmentId,
      student ? b.program : null,
      student ? b.year : null,
      student ? b.section : null,
      student ? graduationYear(b.program, b.year) : null,
      student ? null : b.designation,
      student ? null : b.officeLocation,
      student ? null : b.officeHours,
    );
    const u = await get('SELECT * FROM users WHERE id = ?', id);
    await joinDefaultCommunities(u);
    await reindexUser(id);
    return u;
  });
  setSessionCookie(res, user);
  res.status(201).json(await mePayload(user));
});

r.post('/login', async (req, res) => {
  const b = parse(z.object({ email: z.string(), password: z.string() }), req.body);
  const email = normalizeEmail(b.email);
  hit(`login:${req.ip}:${email}`, 10, 15 * MIN);
  const user = await get('SELECT * FROM users WHERE email = ?', email);
  const ok = user && (await bcrypt.compare(b.password, user.password_hash));
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  await checkSuspension(user);
  setSessionCookie(res, user);
  res.json(await mePayload(user));
});

r.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

r.get('/me', requireAuth, async (req, res) => res.json(await mePayload(req.user)));

r.get('/unread', requireAuth, async (req, res) => res.json(await unreadCounts(req.user.id)));

r.post('/password/reset', async (req, res) => {
  const b = parse(z.object({ resetToken: z.string(), newPassword: password }), req.body);
  const { email } = readToken(b.resetToken, 'reset_password');
  const hash = await bcrypt.hash(b.newPassword, 10);
  await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?', hash, new Date().toISOString(), email);
  res.status(204).end();
});

r.post('/password/change', requireAuth, async (req, res) => {
  const b = parse(z.object({ currentPassword: z.string(), newPassword: password }), req.body);
  hit(`pw-change:${req.user.id}`, 10, 15 * MIN);
  if (!(await bcrypt.compare(b.currentPassword, req.user.password_hash))) {
    throw badRequest('Your current password is not right.', { currentPassword: 'Not right' });
  }
  const hash = await bcrypt.hash(b.newPassword, 10);
  await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hash, new Date().toISOString(), req.user.id);
  res.status(204).end();
});

export default r;
