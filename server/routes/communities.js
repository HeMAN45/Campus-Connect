import { z } from 'zod';
import { get, all, run, tx, nowIso } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { HttpError, notFound, forbidden, badRequest } from '../middleware/errors.js';
import { limit, HOUR } from '../middleware/rateLimit.js';
import { uploadFields, saveImage, keepUploads, removeUpload } from '../middleware/upload.js';
import { parse, str, optStr, optInt } from '../services/validators.js';
import { serializeCommunity, miniCols, miniFrom } from '../services/serialize.js';
import { isAdmin, isVerifiedTeacher, memberRole, isCommunityAdmin } from '../services/permissions.js';
import { joinCommunity, leaveCommunity } from '../services/communities.js';
import { ftsQuery } from '../services/search.js';

const r = makeRouter();
const TYPES = ['official', 'department', 'batch', 'club', 'interest'];

async function loadBySlug(slug, user, { allowPending = false } = {}) {
  const c = await get('SELECT * FROM communities WHERE slug = ?', String(slug || '').toLowerCase());
  if (!c) throw notFound('Community not found.');
  if (c.status !== 'active' && !(allowPending && (isAdmin(user) || c.created_by === user.id))) {
    throw notFound('Community not found.');
  }
  return c;
}

r.get('/', async (req, res) => {
  const q = parse(
    z.object({ type: z.enum(TYPES).optional().catch(undefined), q: optStr(60), mine: z.string().optional() }),
    req.query,
  );
  const where = ["c.status = 'active'"];
  const params = [req.user.id];
  if (q.type) {
    where.push('c.type = ?');
    params.push(q.type);
  }
  if (q.q) {
    where.push('(c.name ILIKE ? OR c.description ILIKE ? OR c.slug ILIKE ?)');
    const like = `%${q.q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like);
  }
  if (q.mine === '1') where.push('m.role IS NOT NULL');
  const rows = await all(
    `SELECT c.*, m.role AS my_role FROM communities c
     LEFT JOIN community_members m ON m.community_id = c.id AND m.user_id = ?
     WHERE ${where.join(' AND ')}
     ORDER BY CASE c.type WHEN 'official' THEN 0 WHEN 'club' THEN 1 WHEN 'department' THEN 2 WHEN 'batch' THEN 3 ELSE 4 END,
              c.member_count DESC, c.name`,
    ...params,
  );
  res.json({ items: rows.map((c) => serializeCommunity(c, c.my_role)) });
});

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const createSchema = z.object({
  name: str(2, 60),
  slug: z.preprocess((v) => String(v || '').trim().toLowerCase(), z.string().regex(slugRe, 'Use 2 to 40 lowercase letters, numbers, or hyphens')),
  type: z.enum(['club', 'interest']),
  description: str(10, 500),
  rules: optStr(2000),
});

r.get('/slug-available', async (req, res) => {
  const slug = String(req.query.slug || '').toLowerCase();
  res.json({ available: slugRe.test(slug) && !(await get('SELECT 1 FROM communities WHERE slug = ?', slug)) });
});

r.post('/', limit('community-create', 5, 24 * HOUR), uploadFields(['avatar', 'cover']), async (req, res) => {
  const b = parse(createSchema, req.body);
  if (await get('SELECT 1 FROM communities WHERE slug = ?', b.slug)) {
    throw new HttpError(409, 'SLUG_TAKEN', 'That web address is taken. Try another.', { fields: { slug: 'Already taken' } });
  }
  const direct = isAdmin(req.user) || isVerifiedTeacher(req.user);
  const avatar = req.files?.avatar?.[0] ? saveImage(req, req.files.avatar[0], 'communities') : null;
  const cover = req.files?.cover?.[0] ? saveImage(req, req.files.cover[0], 'communities') : null;
  const id = await tx(async () => {
    const { id } = await run(
      `INSERT INTO communities (slug, name, description, rules, type, avatar_url, cover_url, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      b.slug,
      b.name,
      b.description,
      b.rules || null,
      b.type,
      avatar?.url ?? null,
      cover?.url ?? null,
      direct ? 'active' : 'pending',
      req.user.id,
    );
    if (direct) await joinCommunity(id, req.user.id, 'admin');
    return id;
  });
  keepUploads(req);
  const c = await get('SELECT * FROM communities WHERE id = ?', id);
  res.status(201).json({ community: serializeCommunity(c, direct ? 'admin' : null), pending: !direct });
});

r.get('/:slug', async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user, { allowPending: true });
  const leaders = (await all(
    `SELECT m.role AS member_role, ${miniCols('u', 'd', 'x_')}
     FROM community_members m JOIN users u ON u.id = m.user_id LEFT JOIN departments d ON d.id = u.department_id
     WHERE m.community_id = ? AND m.role <> 'member'
     ORDER BY CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, u.name`,
    c.id,
  )).map((row) => ({ ...miniFrom(row, 'x_'), communityRole: row.member_role }));
  res.json({ community: serializeCommunity(c, await memberRole(c.id, req.user.id)), leaders, canManage: await isCommunityAdmin(c.id, req.user) });
});

r.patch('/:slug', uploadFields(['avatar', 'cover']), async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user);
  if (!(await isCommunityAdmin(c.id, req.user))) throw forbidden();
  const b = parse(z.object({ name: str(2, 60), description: optStr(500), rules: optStr(2000) }), req.body);
  const avatar = req.files?.avatar?.[0] ? saveImage(req, req.files.avatar[0], 'communities') : null;
  const cover = req.files?.cover?.[0] ? saveImage(req, req.files.cover[0], 'communities') : null;
  await run(
    `UPDATE communities SET name = ?, description = ?, rules = ?, avatar_url = coalesce(?, avatar_url),
       cover_url = coalesce(?, cover_url), updated_at = ? WHERE id = ?`,
    b.name,
    b.description || null,
    b.rules || null,
    avatar?.url ?? null,
    cover?.url ?? null,
    nowIso(),
    c.id,
  );
  keepUploads(req);
  if (avatar) removeUpload(c.avatar_url);
  if (cover) removeUpload(c.cover_url);
  const updated = await get('SELECT * FROM communities WHERE id = ?', c.id);
  res.json({ community: serializeCommunity(updated, await memberRole(c.id, req.user.id)) });
});

r.post('/:slug/join', async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user);
  if (!(await joinCommunity(c.id, req.user.id))) throw new HttpError(409, 'ALREADY_MEMBER', "You're already a member.");
  res.json({ memberCount: (await get('SELECT member_count FROM communities WHERE id = ?', c.id)).member_count, myRole: 'member' });
});

r.post('/:slug/leave', async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user);
  if (c.type === 'official') throw badRequest("Official communities can't be left. They carry campus announcements.");
  const role = await memberRole(c.id, req.user.id);
  if (role === 'admin') {
    const admins = (await get("SELECT count(*) AS n FROM community_members WHERE community_id = ? AND role = 'admin'", c.id)).n;
    if (admins <= 1) throw badRequest('Make someone else an admin before you leave.');
  }
  await leaveCommunity(c.id, req.user.id);
  res.json({ memberCount: (await get('SELECT member_count FROM communities WHERE id = ?', c.id)).member_count, myRole: null });
});

r.get('/:slug/members', async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user);
  const q = parse(z.object({ q: optStr(60), offset: optInt(0, 1e6) }), req.query);
  const offset = q.offset || 0;
  const params = [c.id];
  let filter = '';
  const fts = ftsQuery(q.q);
  if (fts) {
    filter = "AND u.search_vector @@ to_tsquery('simple', ?)";
    params.push(fts);
  }
  const rows = await all(
    `SELECT m.role AS member_role, ${miniCols('u', 'd', 'x_')}
     FROM community_members m JOIN users u ON u.id = m.user_id LEFT JOIN departments d ON d.id = u.department_id
     WHERE m.community_id = ? AND u.status <> 'suspended' ${filter}
     ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, u.name
     LIMIT 41 OFFSET ?`,
    ...params,
    offset,
  );
  res.json({
    items: rows.slice(0, 40).map((row) => ({ ...miniFrom(row, 'x_'), communityRole: row.member_role })),
    nextOffset: rows.length > 40 ? offset + 40 : null,
  });
});

r.patch('/:slug/members/:userId', async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user);
  if (!(await isCommunityAdmin(c.id, req.user))) throw forbidden();
  const { role } = parse(z.object({ role: z.enum(['member', 'moderator', 'admin']) }), req.body);
  const userId = Number(req.params.userId);
  const current = await memberRole(c.id, userId);
  if (!current) throw notFound('That person is not a member.');
  if (current === 'admin' && role !== 'admin') {
    const admins = (await get("SELECT count(*) AS n FROM community_members WHERE community_id = ? AND role = 'admin'", c.id)).n;
    if (admins <= 1) throw badRequest('A community needs at least one admin.');
  }
  await run('UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?', role, c.id, userId);
  res.status(204).end();
});

r.delete('/:slug/members/:userId', async (req, res) => {
  const c = await loadBySlug(req.params.slug, req.user);
  if (!(await isCommunityAdmin(c.id, req.user))) throw forbidden();
  const userId = Number(req.params.userId);
  if ((await memberRole(c.id, userId)) === 'admin') throw badRequest('Change their role before removing an admin.');
  await leaveCommunity(c.id, userId);
  res.status(204).end();
});

export default r;
