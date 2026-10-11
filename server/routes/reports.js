import { z } from 'zod';
import { get, run, tx } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { limit } from '../middleware/rateLimit.js';
import { parse, optStr } from '../services/validators.js';

const r = makeRouter();
const AUTO_HIDE_AT = 5;

async function resolveTarget(type, id, userId) {
  if (type === 'post') {
    const p = await get('SELECT id, community_id FROM posts WHERE id = ? AND deleted_at IS NULL', id);
    return p && { communityId: p.community_id };
  }
  if (type === 'comment') {
    const c = await get(
      'SELECT c.id, p.community_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ? AND c.deleted_at IS NULL',
      id,
    );
    return c && { communityId: c.community_id };
  }
  if (type === 'message') {
    const m = await get(
      `SELECT m.id FROM messages m JOIN conversations cv ON cv.id = m.conversation_id
       WHERE m.id = ? AND (cv.user_a_id = ? OR cv.user_b_id = ?)`,
      id,
      userId,
      userId,
    );
    return m && { communityId: null };
  }
  const u = await get('SELECT id FROM users WHERE id = ?', id);
  return u && { communityId: null };
}

r.post('/', limit('report', 20, 86_400_000), async (req, res) => {
  const b = parse(
    z.object({
      targetType: z.enum(['post', 'comment', 'message', 'user']),
      targetId: z.number().int().positive(),
      reason: z.enum(['spam', 'harassment', 'inappropriate', 'misinformation', 'other']),
      details: optStr(500),
    }),
    req.body,
  );
  const target = await resolveTarget(b.targetType, b.targetId, req.user.id);
  if (!target) throw notFound('That content no longer exists.');
  if (await get("SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'", req.user.id, b.targetType, b.targetId)) {
    throw new HttpError(409, 'ALREADY_REPORTED', 'You already reported this.');
  }
  await tx(async () => {
    await run(
      'INSERT INTO reports (reporter_id, target_type, target_id, community_id, reason, details) VALUES (?, ?, ?, ?, ?, ?)',
      req.user.id,
      b.targetType,
      b.targetId,
      target.communityId,
      b.reason,
      b.details || null,
    );
    if (b.targetType === 'post' || b.targetType === 'comment') {
      const n = (await get(
        "SELECT count(DISTINCT reporter_id) AS n FROM reports WHERE target_type = ? AND target_id = ? AND status = 'open'",
        b.targetType,
        b.targetId,
      )).n;
      if (n >= AUTO_HIDE_AT) await run(`UPDATE ${b.targetType === 'post' ? 'posts' : 'comments'} SET is_hidden = 1 WHERE id = ?`, b.targetId);
    }
  });
  res.status(201).json({ ok: true });
});

export default r;
