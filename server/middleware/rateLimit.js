import { HttpError } from './errors.js';

const buckets = new Map();

const describe = (s) => (s < 60 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`);

export function hit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    throw new HttpError(429, 'RATE_LIMITED', `Too many attempts. Try again in ${describe(retryAfter)}.`, {
      retryAfter,
    });
  }
  recent.push(now);
  buckets.set(key, recent);
}

export const limit = (name, max, windowMs, keyFn = (req) => req.user?.id ?? req.ip) => (req, res, next) => {
  hit(`${name}:${keyFn(req)}`, max, windowMs);
  next();
};

export const resetRateLimits = () => buckets.clear();

setInterval(() => {
  const now = Date.now();
  for (const [key, times] of buckets) if (!times.some((t) => now - t < 3_600_000 * 24)) buckets.delete(key);
}, 600_000).unref();

export const MIN = 60_000;
export const HOUR = 3_600_000;
