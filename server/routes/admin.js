import { z } from 'zod';
import { get, all, run, tx, nowIso } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { notFound, badRequest } from '../middleware/errors.js';
import { parse, optStr } from '../services/validators.js';
import { userProfile, serializeCommunity, loadMini } from '../services/serialize.js';
import { notify } from '../services/notify.js';
import { joinCommunity } from '../services/communities.js';
import { reindexUser } from '../services/search.js';

const r = makeRouter();

r.get('/stats', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();
  const n = async (sql, ...p) => (await get(sql, ...p)).n;
  res.json({
    users: await n("SELECT count(*) AS n FROM users WHERE status <> 'suspended'"),
    newUsersToday: await n('SELECT count(*) AS n FROM users WHERE created_at >= ?', since),
    postsToday: await n('SELECT count(*) AS n FROM posts WHERE created_at >= ? AND deleted_at IS NULL', since),
    messagesToday: await n('SELECT count(*) AS n FROM messages WHERE created_at >= ?', since),
    openReports: await n("SELECT count(*) AS n FROM reports WHERE status = 'open'"),
    pendingTeachers: await n("SELECT count(*) AS n FROM users WHERE role = 'teacher' AND status = 'pending'"),
    pendingCommunities: await n("SELECT count(*) AS n FROM communities WHERE status = 'pending'"),
    suspended: await n("SELECT count(*) AS n FROM users WHERE status = 'suspended'"),
  });
});

r.get('/teachers/pending', async (req, res) => {
  const rows = await all("SELECT * FROM users WHERE role = 'teacher' AND status = 'pending' ORDER BY created_at");
  const items = [];
  for (const u of rows) items.push(await userProfile(u, req.user));
  res.json({ items });
});

r.post('/teachers/:id/decision', async (req, res) => {
  const { approve, reason } = parse(z.object({ approve: z.boolean(), reason: optStr(300) }), req.body);
  const u = await get("SELECT * FROM users WHERE id = ? AND role = 'teacher' AND status = 'pending'", Number(req.params.id));
  if (!u) throw notFound('That request was already handled.');
  if (approve) {
    await run("UPDATE users SET status = 'active', updated_at = ? WHERE id = ?", nowIso(), u.id);
    await notify([u.id], { type: 'teacher_approved', actorId: req.user.id });
  } else {
    await run(
      "UPDATE users SET role = 'student', status = 'active', designation = NULL, office_location = NULL, office_hours = NULL, updated_at = ? WHERE id = ?",
      nowIso(),
      u.id,
    );
    await reindexUser(u.id);
    await notify([u.id], { type: 'teacher_rejected', actorId: req.user.id, data: { reason: reason || null } });
  }
  res.status(204).end();
});

async function targetPreview(rep) {
  if (rep.target_type === 'post') {
    const p = await get('SELECT id, title, body, author_id, deleted_at FROM posts WHERE id = ?', rep.target_id);
    return p && { kind: 'post', id: p.id, title: p.title, text: p.body?.slice(0, 280), author: await loadMini(p.author_id), removed: !!p.deleted_at, link: `/post/${p.id}` };
  }
  if (rep.target_type === 'comment') {
    const c = await get('SELECT id, body, image_url, author_id, post_id, deleted_at FROM comments WHERE id = ?', rep.target_id);
    return c && { kind: 'comment', id: c.id, text: c.body?.slice(0, 280), imageUrl: c.image_url, author: await loadMini(c.author_id), removed: !!c.deleted_at, link: `/post/${c.post_id}#c-${c.id}` };
  }
  if (rep.target_type === 'message') {
    const m = await get('SELECT id, body, image_url, sender_id, deleted_at FROM messages WHERE id = ?', rep.target_id);
    return m && { kind: 'message', id: m.id, text: m.body?.slice(0, 280), imageUrl: m.image_url, author: await loadMini(m.sender_id), removed: !!m.deleted_at };
  }
  const u = await loadMini(rep.target_id);
  return u && { kind: 'user', id: u.id, title: u.name, author: u, link: `/u/${u.id}` };
}

r.get('/reports', async (req, res) => {
  const status = ['open', 'actioned', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const rows = await all(
    `SELECT r.target_type, r.target_id, min(r.id) AS id, count(*) AS report_count, string_agg(DISTINCT r.reason, ',') AS reasons,
            max(r.created_at) AS last_at, max(r.details) AS details
     FROM reports r WHERE r.status = ? GROUP BY r.target_type, r.target_id ORDER BY last_at DESC LIMIT 100`,
    status,
  );
  const items = [];
  for (const rep of rows) {
    items.push({
      id: rep.id,
      targetType: rep.target_type,
      targetId: rep.target_id,
      reportCount: rep.report_count,
      reasons: rep.reasons.split(','),
      details: rep.details,
      lastAt: rep.last_at,
      target: (await targetPreview(rep)) || { kind: rep.target_type, removed: true, text: 'Content no longer exists' },
    });
  }
  res.json({ items });
});

const authorOf = async (type, id) => {
  if (type === 'post') return (await get('SELECT author_id AS id FROM posts WHERE id = ?', id))?.id;
  if (type === 'comment') return (await get('SELECT author_id AS id FROM comments WHERE id = ?', id))?.id;
  if (type === 'message') return (await get('SELECT sender_id AS id FROM messages WHERE id = ?', id))?.id;
  return id;
};

r.post('/reports/:id/resolve', async (req, res) => {
  const b = parse(
    z.object({ action: z.enum(['dismiss', 'remove', 'suspend']), suspendDays: z.union([z.literal(7), z.literal(30)]).nullable().optional() }),
    req.body,
  );
  const rep = await get('SELECT * FROM reports WHERE id = ?', Number(req.params.id));
  if (!rep) throw notFound('Report not found.');
  const now = nowIso();
  await tx(async () => {
    if (b.action !== 'dismiss') {
      if (rep.target_type === 'post') await run('UPDATE posts SET deleted_at = coalesce(deleted_at, ?), is_pinned = 0 WHERE id = ?', now, rep.target_id);
      if (rep.target_type === 'comment') {
        const c = await get('SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL', rep.target_id);
        if (c) {
          await run('UPDATE comments SET deleted_at = ? WHERE id = ?', now, c.id);
          await run('UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', c.post_id);
          await run("UPDATE posts SET accepted_comment_id = NULL, status = 'open' WHERE id = ? AND accepted_comment_id = ?", c.post_id, c.id);
        }
      }
      if (rep.target_type === 'message') await run('UPDATE messages SET deleted_at = coalesce(deleted_at, ?) WHERE id = ?', now, rep.target_id);
    }
    if (b.action === 'suspend') {
      const uid = await authorOf(rep.target_type, rep.target_id);
      const target = uid && (await get('SELECT * FROM users WHERE id = ?', uid));
      if (!target) throw notFound('That person no longer exists.');
      if (target.role === 'admin') throw badRequest("Admins can't be suspended here.");
      const until = b.suspendDays ? new Date(Date.now() + b.suspendDays * 86_400_000).toISOString() : null;
      await run(
        "UPDATE users SET prior_status = CASE WHEN status = 'suspended' THEN prior_status ELSE status END, status = 'suspended', suspended_until = ? WHERE id = ?",
        until,
        uid,
      );
    }
    await run(
      "UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE target_type = ? AND target_id = ? AND status = 'open'",
      b.action === 'dismiss' ? 'dismissed' : 'actioned',
      b.action,
      req.user.id,
      now,
      rep.target_type,
      rep.target_id,
    );
  });
  res.status(204).end();
});

r.get('/communities/pending', async (req, res) => {
  const rows = await all("SELECT * FROM communities WHERE status = 'pending' ORDER BY created_at");
  const items = [];
  for (const c of rows) {
    items.push({ ...serializeCommunity(c), requestedBy: c.created_by ? await loadMini(c.created_by) : null });
  }
  res.json({ items });
});

r.post('/communities/:id/decision', async (req, res) => {
  const { approve, reason } = parse(z.object({ approve: z.boolean(), reason: optStr(300) }), req.body);
  const c = await get("SELECT * FROM communities WHERE id = ? AND status = 'pending'", Number(req.params.id));
  if (!c) throw notFound('That request was already handled.');
  await tx(async () => {
    await run('UPDATE communities SET status = ?, reviewed_by = ?, review_note = ?, updated_at = ? WHERE id = ?', approve ? 'active' : 'rejected', req.user.id, reason || null, nowIso(), c.id);
    if (approve && c.created_by) await joinCommunity(c.id, c.created_by, 'admin');
  });
  if (c.created_by) {
    await notify([c.created_by], {
      type: approve ? 'community_approved' : 'community_rejected',
      actorId: req.user.id,
      communityId: c.id,
      data: { name: c.name, reason: reason || null },
    });
  }
  res.status(204).end();
});

export default r;
