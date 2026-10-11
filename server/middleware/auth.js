import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { get, run, nowIso } from '../db/index.js';
import { HttpError, forbidden } from './errors.js';

export const SESSION_COOKIE = 'cc_session';

export function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: config.sessionDays * 86_400_000,
  });
}

export const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, { path: '/' });

export function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return get('SELECT * FROM users WHERE id = ?', payload.sub) || null;
  } catch {
    return null;
  }
}

const fmt = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Lifts expired suspensions, otherwise throws for suspended users.
export function checkSuspension(user) {
  if (user.status !== 'suspended') return;
  if (user.suspended_until && user.suspended_until <= nowIso()) {
    const restored = user.prior_status || 'active';
    run('UPDATE users SET status = ?, prior_status = NULL, suspended_until = NULL WHERE id = ?', restored, user.id);
    user.status = restored;
    user.suspended_until = null;
    return;
  }
  throw new HttpError(
    403,
    'SUSPENDED',
    user.suspended_until
      ? `Your account is suspended until ${fmt(user.suspended_until)}. Contact student affairs if you think this is a mistake.`
      : 'Your account is suspended. Contact student affairs if you think this is a mistake.',
    { until: user.suspended_until },
  );
}

export function requireAuth(req, res, next) {
  const user = userFromToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
  checkSuspension(user);
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw forbidden();
  next();
}
