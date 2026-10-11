import { z } from 'zod';
import { get, all, run, tx, nowIso, placeholders } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { HttpError, notFound, forbidden, badRequest } from '../middleware/errors.js';
import { limit, HOUR } from '../middleware/rateLimit.js';
import { uploadImages, saveImage, keepUploads } from '../middleware/upload.js';
import { parse, str, optStr, optInt, bool, optIsoDateTime, url, jsonList } from '../services/validators.js';
import { POST_SELECT, hydratePosts, loadPost } from '../services/serialize.js';
import {
  assertCanCreatePost,
  canPin,
  canModerate,
  isAdmin,
  isVerifiedTeacher,
  isCommunityMod,
  memberRole,
} from '../services/permissions.js';
import { notify } from '../services/notify.js';
import { hotScore } from '../services/ranking.js';

const r = makeRouter();

const TYPES = ['general', 'doubt', 'request', 'lost', 'found', 'announcement', 'event'];
const TABS = {
  all: null,
  announcements: ['announcement'],
  events: ['event'],
  doubts: ['doubt'],
  requests: ['request'],
  lostfound: ['lost', 'found'],
};
const RESOLVABLE = new Set(['doubt', 'request', 'lost', 'found']);

const encodeCursor = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const decodeCursor = (s) => {
  try {
    return s ? JSON.parse(Buffer.from(s, 'base64url').toString()) : null;
  } catch {
    return null;
  }
};

const feedQuery = z.object({
  tab: z.enum(Object.keys(TABS)).catch('all'),
  sort: z.enum(['hot', 'new', 'top']).catch('hot'),
  communityId: optInt(1, 1e9),
  authorId: optInt(1, 1e9),
  subject: optStr(30),
  unanswered: bool.optional(),
  status: z.enum(['open', 'resolved']).optional().catch(undefined),
  kind: z.enum(['lost', 'found']).optional().catch(undefined),
  when: z.enum(['upcoming', 'past']).optional().catch(undefined),
  cursor: optStr(300),
  limit: optInt(1, 50),
});

async function loadPostRow(id, user) {
  const row = await get('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', id);
  if (!row) throw notFound('This post was removed or does not exist.');
  if (row.is_hidden && row.author_id !== user.id && !isAdmin(user)) throw notFound('This post is under review.');
  return row;
}

const postId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw notFound();
  return id;
};

r.get('/', async (req, res) => {
  const q = parse(feedQuery, req.query);
  const pageSize = q.limit || 20;
  const nowStr = nowIso();
  const cursor = decodeCursor(q.cursor);

  const where = ['p.deleted_at IS NULL', "(c.id IS NULL OR c.status = 'active')", '(p.is_hidden = 0 OR p.author_id = ?)'];
  const params = [req.user.id];
  const types = TABS[q.tab];
  if (types) {
    where.push(`p.type IN (${placeholders(types.length)})`);
    params.push(...types);
  }
  if (q.kind && q.tab === 'lostfound') {
    where.push('p.type = ?');
    params.push(q.kind);
  }
  if (q.communityId) {
    where.push('p.community_id = ?');
    params.push(q.communityId);
  }
  if (q.authorId) {
    where.push('p.author_id = ?');
    params.push(q.authorId);
  }
  if (q.subject) {
    where.push('LOWER(p.subject_tag) = LOWER(?)');
    params.push(q.subject);
  }
  if (q.unanswered) where.push('p.comment_count = 0 AND p.accepted_comment_id IS NULL');
  if (q.status) {
    where.push('p.status = ?');
    params.push(q.status);
  }
  const eventsByTime = q.tab === 'events' && q.when;
  if (eventsByTime) {
    where.push(`coalesce(p.event_ends_at, p.event_starts_at) ${q.when === 'upcoming' ? '>=' : '<'} ?`);
    params.push(nowStr);
  }

  const showPins = ['all', 'announcements'].includes(q.tab) && !q.authorId;
  const pinScope = q.communityId ? 'p.community_id = ?' : 'p.community_id IS NULL';
  const pinParams = q.communityId ? [q.communityId] : [];
  if (showPins) {
    where.push(`NOT (p.is_pinned = 1 AND (p.pinned_until IS NULL OR p.pinned_until > ?) AND ${pinScope})`);
    params.push(nowStr, ...pinParams);
  }

  let pinned = [];
  if (showPins && !q.cursor) {
    pinned = await all(
      `${POST_SELECT} WHERE p.deleted_at IS NULL AND p.is_hidden = 0 AND p.is_pinned = 1
         AND (p.pinned_until IS NULL OR p.pinned_until > ?) AND ${pinScope}
       ORDER BY p.created_at DESC LIMIT 3`,
      nowStr,
      ...pinParams,
    );
  }

  const base = `${POST_SELECT} WHERE ${where.join(' AND ')}`;
  let rows;
  let nextCursor = null;

  if (q.sort === 'new' && !eventsByTime) {
    let sql = base;
    const ps = [...params];
    if (cursor?.c) {
      sql += ' AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))';
      ps.push(cursor.c, cursor.c, cursor.i);
    }
    rows = await all(`${sql} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`, ...ps, pageSize + 1);
    if (rows.length > pageSize) {
      rows = rows.slice(0, pageSize);
      const last = rows.at(-1);
      nextCursor = encodeCursor({ c: last.created_at, i: last.id });
    }
  } else {
    const offset = Number(cursor?.o) || 0;
    if (eventsByTime) {
      const dir = q.when === 'upcoming' ? 'ASC' : 'DESC';
      rows = await all(`${base} ORDER BY p.event_starts_at ${dir}, p.id LIMIT ? OFFSET ?`, ...params, pageSize + 1, offset);
    } else if (q.sort === 'top') {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      rows = await all(`${base} AND p.created_at >= ? ORDER BY p.score DESC, p.id DESC LIMIT ? OFFSET ?`, ...params, weekAgo, pageSize + 1, offset);
    } else {
      const now = Date.now();
      const candidates = await all(`${base} ORDER BY p.created_at DESC LIMIT 500`, ...params);
      for (const c of candidates) c.hot = hotScore(c, now);
      candidates.sort((a, b) => b.hot - a.hot);
      rows = candidates.slice(offset, offset + pageSize + 1);
    }
    if (rows.length > pageSize) {
      rows = rows.slice(0, pageSize);
      nextCursor = encodeCursor({ o: offset + pageSize });
    }
  }

  res.json({ pinned: await hydratePosts(pinned, req.user), items: await hydratePosts(rows, req.user), nextCursor });
});

r.get('/upcoming-events', async (req, res) => {
  const n = Math.min(Number(req.query.limit) || 5, 10);
  const rows = await all(
    `${POST_SELECT} WHERE p.type = 'event' AND p.deleted_at IS NULL AND p.is_hidden = 0 AND c.status = 'active'
       AND coalesce(p.event_ends_at, p.event_starts_at) >= ?
     ORDER BY p.event_starts_at ASC LIMIT ?`,
    nowIso(),
    n,
  );
  res.json({ items: await hydratePosts(rows, req.user) });
});

r.get('/pinned', async (req, res) => {
  const rows = await all(
    `${POST_SELECT} WHERE p.deleted_at IS NULL AND p.is_hidden = 0 AND p.is_pinned = 1 AND p.community_id IS NULL
       AND (p.pinned_until IS NULL OR p.pinned_until > ?)
     ORDER BY p.created_at DESC LIMIT 3`,
    nowIso(),
  );
  res.json({ items: await hydratePosts(rows, req.user) });
});

r.get('/subjects', async (req, res) => {
  const rows = await all(
    `SELECT LOWER(subject_tag) AS tag, count(*) AS n FROM posts
     WHERE type = 'doubt' AND deleted_at IS NULL AND subject_tag IS NOT NULL
     GROUP BY LOWER(subject_tag) ORDER BY n DESC LIMIT 20`,
  );
  res.json({ items: rows });
});

const optDate = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date').optional(),
);

const createSchema = z
  .object({
    type: z.enum(TYPES, { errorMap: () => ({ message: 'Choose a post type' }) }),
    title: str(3, 150),
    body: optStr(5000),
    communityId: optInt(1, 1e9),
    subjectTag: optStr(30),
    neededBy: optIsoDateTime,
    itemLocation: optStr(100),
    itemDate: optDate,
    eventStartsAt: optIsoDateTime,
    eventEndsAt: optIsoDateTime,
    eventVenue: optStr(120),
    eventUrl: url,
    pinned: bool.optional(),
    commentsLocked: bool.optional(),
    imageAlts: jsonList(z.string().max(200), 4).optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    const need = (path, message = 'Required') => !v[path] && issue(path, message);
    if (v.type === 'doubt') need('subjectTag', 'Pick a subject');
    if (v.type === 'lost' || v.type === 'found') {
      need('itemLocation');
      need('itemDate');
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      if (v.itemDate && v.itemDate > tomorrow) issue('itemDate', 'Date cannot be in the future');
    }
    if (v.type === 'event') {
      need('communityId', 'Choose the club or community hosting this event');
      need('eventStartsAt');
      need('eventVenue');
      if (v.eventStartsAt && Date.parse(v.eventStartsAt) < Date.now() - 3_600_000) issue('eventStartsAt', 'Start time must be in the future');
      if (v.eventEndsAt && v.eventStartsAt && Date.parse(v.eventEndsAt) <= Date.parse(v.eventStartsAt)) {
        issue('eventEndsAt', 'End must be after the start');
      }
    }
    if (v.type === 'request' && v.neededBy && Date.parse(v.neededBy) < Date.now()) issue('neededBy', 'Pick a time in the future');
  });

const iso = (v) => (v ? new Date(v).toISOString() : null);

async function membersOf(communityId) {
  return (await all('SELECT user_id FROM community_members WHERE community_id = ?', communityId)).map((m) => m.user_id);
}

r.post('/', limit('post-create', 10, HOUR), uploadImages('images', 4), async (req, res) => {
  const b = parse(createSchema, req.body);
  const community = b.communityId ? await get('SELECT * FROM communities WHERE id = ?', b.communityId) : null;
  if (b.communityId && !community) throw notFound('Community not found.');
  await assertCanCreatePost(req.user, b.type, community);

  const wantsPin = !!(
    b.pinned &&
    b.type === 'announcement' &&
    (isAdmin(req.user) || (community ? await isCommunityMod(community.id, req.user) : isVerifiedTeacher(req.user)))
  );
  const pinnedUntil = wantsPin && !community ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null;
  const images = (req.files || []).map((f, i) => ({ ...saveImage(req, f, 'posts'), alt: b.imageAlts?.[i] || null }));
  const t = b.type;

  const id = await tx(async () => {
    const { id } = await run(
      `INSERT INTO posts (author_id, community_id, type, title, body, subject_tag, needed_by, item_location, item_date,
         event_starts_at, event_ends_at, event_venue, event_url, is_pinned, pinned_until, comments_locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id,
      community?.id ?? null,
      t,
      b.title,
      b.body || '',
      t === 'doubt' ? b.subjectTag : null,
      t === 'request' ? iso(b.neededBy) : null,
      t === 'lost' || t === 'found' ? b.itemLocation : null,
      t === 'lost' || t === 'found' ? b.itemDate : null,
      t === 'event' ? iso(b.eventStartsAt) : null,
      t === 'event' ? iso(b.eventEndsAt) : null,
      t === 'event' ? b.eventVenue : null,
      t === 'event' ? b.eventUrl || null : null,
      wantsPin,
      pinnedUntil,
      t === 'announcement' && !!b.commentsLocked,
    );
    for (let i = 0; i < images.length; i++) {
      const im = images[i];
      await run(
        'INSERT INTO post_images (post_id, url, alt_text, width, height, bytes, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        im.url,
        im.alt,
        im.width ?? null,
        im.height ?? null,
        im.bytes,
        i,
      );
    }
    return id;
  });
  keepUploads(req);

  if (t === 'announcement' && !community) {
    const everyone = (await all("SELECT id FROM users WHERE status <> 'suspended'")).map((u) => u.id);
    await notify(everyone, { type: 'announcement', actorId: req.user.id, postId: id });
  } else if (t === 'announcement') {
    await notify(await membersOf(community.id), { type: 'community_announcement', actorId: req.user.id, postId: id, communityId: community.id });
  } else if (t === 'event') {
    await notify(await membersOf(community.id), { type: 'community_event', actorId: req.user.id, postId: id, communityId: community.id });
  }

  res.status(201).json({ post: await loadPost(id, req.user) });
});

r.get('/:id', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  const owner = row.author_id === req.user.id;
  const role = row.community_id ? await memberRole(row.community_id, req.user.id) : null;
  res.json({
    post: await loadPost(row.id, req.user),
    viewer: {
      isOwner: owner,
      isMember: row.community_id ? !!role : null,
      canModerate: await canModerate(row, req.user),
      canPin: await canPin(row, req.user),
      canEdit: isAdmin(req.user) || (owner && Date.now() - Date.parse(row.created_at) < 86_400_000),
      canDelete: owner || (await canModerate(row, req.user)),
      canSeeRsvps: row.type === 'event' && (owner || (await canModerate(row, req.user))),
    },
  });
});

r.patch('/:id', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  const owner = row.author_id === req.user.id;
  if (!isAdmin(req.user) && !owner) throw forbidden();
  if (!isAdmin(req.user) && Date.now() - Date.parse(row.created_at) > 86_400_000) {
    throw forbidden('Posts can be edited for 24 hours after posting.');
  }
  const b = parse(z.object({ title: str(3, 150), body: optStr(5000) }), req.body);
  await run('UPDATE posts SET title = ?, body = ?, edited_at = ? WHERE id = ?', b.title, b.body || '', nowIso(), row.id);
  res.json({ post: await loadPost(row.id, req.user) });
});

r.delete('/:id', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  const owner = row.author_id === req.user.id;
  if (!owner && !(await canModerate(row, req.user))) throw forbidden();
  await run('UPDATE posts SET deleted_at = ?, is_pinned = 0 WHERE id = ?', nowIso(), row.id);
  if (!owner) await notify([row.author_id], { type: 'content_removed', actorId: req.user.id, data: { title: row.title, kind: 'post' } });
  res.status(204).end();
});

const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

r.post('/:id/vote', limit('vote', 300, HOUR), async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (row.author_id === req.user.id) throw forbidden("You can't vote on your own post.");
  const { value } = parse(voteSchema, req.body);
  const score = await tx(async () => {
    const old = (await get('SELECT value FROM post_votes WHERE post_id = ? AND user_id = ?', row.id, req.user.id))?.value || 0;
    if (value === 0) await run('DELETE FROM post_votes WHERE post_id = ? AND user_id = ?', row.id, req.user.id);
    else {
      await run(
        `INSERT INTO post_votes (post_id, user_id, value) VALUES (?, ?, ?)
         ON CONFLICT(post_id, user_id) DO UPDATE SET value = excluded.value`,
        row.id,
        req.user.id,
        value,
      );
    }
    await run('UPDATE posts SET score = score + ? WHERE id = ?', value - old, row.id);
    return (await get('SELECT score FROM posts WHERE id = ?', row.id)).score;
  });
  res.json({ score, myVote: value });
});

r.post('/:id/resolve', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (row.author_id !== req.user.id && !isAdmin(req.user)) throw forbidden('Only the author can change this.');
  if (!RESOLVABLE.has(row.type) || row.type === 'doubt') throw badRequest('This post type cannot be resolved.');
  const { resolved } = parse(z.object({ resolved: z.boolean() }), req.body);
  await run(
    'UPDATE posts SET status = ?, resolved_at = ? WHERE id = ?',
    resolved ? 'resolved' : 'open',
    resolved ? nowIso() : null,
    row.id,
  );
  res.json({ post: await loadPost(row.id, req.user) });
});

r.post('/:id/accept', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (row.type !== 'doubt') throw badRequest('Only doubts have accepted answers.');
  if (row.author_id !== req.user.id) throw forbidden('Only the person who asked can accept an answer.');
  const { commentId } = parse(z.object({ commentId: z.number().int().positive().nullable() }), req.body);
  let comment = null;
  if (commentId) {
    comment = await get('SELECT * FROM comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL', commentId, row.id);
    if (!comment) throw notFound('That answer no longer exists.');
  }
  await run(
    'UPDATE posts SET accepted_comment_id = ?, status = ?, resolved_at = ? WHERE id = ?',
    commentId,
    commentId ? 'resolved' : 'open',
    commentId ? nowIso() : null,
    row.id,
  );
  if (comment && comment.author_id !== req.user.id && comment.id !== row.accepted_comment_id) {
    await notify([comment.author_id], { type: 'answer_accepted', actorId: req.user.id, postId: row.id, commentId: comment.id });
  }
  res.json({ post: await loadPost(row.id, req.user) });
});

r.post('/:id/pin', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (!(await canPin(row, req.user))) throw forbidden();
  const { pinned } = parse(z.object({ pinned: z.boolean() }), req.body);
  const until = pinned && !row.community_id ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null;
  await run('UPDATE posts SET is_pinned = ?, pinned_until = ? WHERE id = ?', pinned, until, row.id);
  res.json({ post: await loadPost(row.id, req.user) });
});

r.post('/:id/lock-comments', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (row.author_id !== req.user.id && !(await canModerate(row, req.user))) throw forbidden();
  const { locked } = parse(z.object({ locked: z.boolean() }), req.body);
  await run('UPDATE posts SET comments_locked = ? WHERE id = ?', locked, row.id);
  res.json({ post: await loadPost(row.id, req.user) });
});

r.put('/:id/rsvp', limit('rsvp', 120, HOUR), async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (row.type !== 'event') throw badRequest('Only events take RSVPs.');
  const { status } = parse(z.object({ status: z.enum(['going', 'interested']).nullable() }), req.body);
  await tx(async () => {
    const old = (await get('SELECT status FROM event_rsvps WHERE post_id = ? AND user_id = ?', row.id, req.user.id))?.status || null;
    if (old === status) return;
    if (status) {
      await run(
        `INSERT INTO event_rsvps (post_id, user_id, status) VALUES (?, ?, ?)
         ON CONFLICT(post_id, user_id) DO UPDATE SET status = excluded.status, updated_at = NOW()`,
        row.id,
        req.user.id,
        status,
      );
    } else {
      await run('DELETE FROM event_rsvps WHERE post_id = ? AND user_id = ?', row.id, req.user.id);
    }
    const delta = (s) => (status === s ? 1 : 0) - (old === s ? 1 : 0);
    await run(
      'UPDATE posts SET going_count = going_count + ?, interested_count = interested_count + ? WHERE id = ?',
      delta('going'),
      delta('interested'),
      row.id,
    );
  });
  const counts = await get('SELECT going_count, interested_count FROM posts WHERE id = ?', row.id);
  res.json({ myRsvp: status, goingCount: counts.going_count, interestedCount: counts.interested_count });
});

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

r.get('/:id/rsvps', async (req, res) => {
  const row = await loadPostRow(postId(req), req.user);
  if (row.type !== 'event') throw badRequest('Only events take RSVPs.');
  if (row.author_id !== req.user.id && !(await canModerate(row, req.user))) throw forbidden();
  const list = await all(
    `SELECT u.id, u.name, u.email, u.year, u.role, d.code AS dept, r.status, r.updated_at
     FROM event_rsvps r JOIN users u ON u.id = r.user_id LEFT JOIN departments d ON d.id = u.department_id
     WHERE r.post_id = ? ORDER BY r.status, u.name`,
    row.id,
  );
  if (req.query.format === 'csv') {
    const lines = [['Name', 'Email', 'Department', 'Year', 'Role', 'RSVP', 'Updated']];
    for (const x of list) lines.push([x.name, x.email, x.dept, x.year, x.role, x.status, x.updated_at]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rsvps-post-${row.id}.csv"`);
    return res.send(lines.map((l) => l.map(csvCell).join(',')).join('\n'));
  }
  res.json({
    items: list.map((x) => ({ id: x.id, name: x.name, email: x.email, dept: x.dept, year: x.year, role: x.role, status: x.status })),
  });
});

export { loadPostRow };
export default r;
