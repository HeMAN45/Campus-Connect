import { z } from 'zod';
import { get, all, run, tx, nowIso } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { notFound, badRequest } from '../middleware/errors.js';
import { uploadImage, saveImage, keepUploads, removeUpload } from '../middleware/upload.js';
import { parse, str, optStr, optInt, bool, url, jsonList } from '../services/validators.js';
import { userProfile, serializeCommunity, loadMini } from '../services/serialize.js';
import { ftsQuery, reindexUser } from '../services/search.js';
import { findProgram, graduationYear } from '../services/reference.js';
import { joinDefaultCommunities } from '../services/communities.js';
import { mePayload } from './auth.js';

const r = makeRouter();
const PAGE = 24;

const directoryQuery = z.object({
  q: optStr(100),
  role: z.enum(['student', 'teacher']).optional().catch(undefined),
  departmentId: optInt(1, 1e9),
  year: optInt(1, 5),
  teachesYear: optInt(1, 5),
  mentor: bool.optional(),
  topic: optStr(40),
  offset: optInt(0, 1e6),
});

async function searchUsers(q, viewer, extra = { where: [], params: [], order: null }) {
  const where = [
    "u.status <> 'suspended'",
    "u.role <> 'admin'",
    "NOT (u.role = 'teacher' AND u.status = 'pending')",
    'u.id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ?)',
    ...extra.where,
  ];
  const params = [viewer.id, ...extra.params];
  const fts = ftsQuery(q.q);
  if (fts) {
    where.push("u.search_vector @@ to_tsquery('simple', ?)");
    params.push(fts);
  }
  if (q.role) {
    where.push('u.role = ?');
    params.push(q.role);
  }
  if (q.departmentId) {
    where.push('u.department_id = ?');
    params.push(q.departmentId);
  }
  if (q.year) {
    where.push("u.role = 'student' AND u.year = ?");
    params.push(q.year);
  }
  if (q.teachesYear) {
    where.push("EXISTS (SELECT 1 FROM jsonb_array_elements(u.subjects::jsonb) s WHERE (s->>'year')::int = ?)");
    params.push(q.teachesYear);
  }
  if (q.mentor) where.push('u.open_to_mentor = 1');
  if (q.topic) {
    where.push("EXISTS (SELECT 1 FROM jsonb_array_elements_text(u.mentor_topics::jsonb) t WHERE t = ?)");
    params.push(q.topic);
  }
  const offset = q.offset || 0;
  const rows = await all(
    `SELECT u.* FROM users u WHERE ${where.join(' AND ')}
     ORDER BY ${extra.order || "(u.role = 'teacher') DESC, u.name"} LIMIT ? OFFSET ?`,
    ...params,
    PAGE + 1,
    offset,
  );
  const items = [];
  for (const u of rows.slice(0, PAGE)) items.push(await userProfile(u, viewer));
  return {
    items,
    nextOffset: rows.length > PAGE ? offset + PAGE : null,
  };
}

r.get('/', async (req, res) => res.json(await searchUsers(parse(directoryQuery, req.query), req.user)));

r.get('/seniors', async (req, res) => {
  const q = parse(directoryQuery, req.query);
  const me = req.user;
  const extra = { where: ["u.role = 'student'", 'u.open_to_mentor = 1', 'u.id <> ?'], params: [me.id], order: null };
  if (me.role === 'student' && me.year) {
    extra.where.push('u.year > ?');
    extra.params.push(me.year);
  }
  extra.order = `(u.department_id = ${me.department_id ? Number(me.department_id) : 'NULL'})::int DESC, u.year DESC, u.name`;
  res.json(await searchUsers({ ...q, role: undefined, mentor: undefined }, me, extra));
});

r.get('/me/blocks', async (req, res) => {
  const ids = await all('SELECT blocked_id FROM user_blocks WHERE blocker_id = ? ORDER BY created_at DESC', req.user.id);
  const items = [];
  for (const b of ids) {
    const mini = await loadMini(b.blocked_id);
    if (mini) items.push(mini);
  }
  res.json({ items });
});

const profileSchema = z.object({
  name: str(2, 80),
  bio: optStr(300),
  departmentId: optInt(1, 1e9),
  program: optStr(40),
  year: optInt(1, 5),
  section: optStr(10),
  enrollmentNo: optStr(20),
  designation: optStr(60),
  officeLocation: optStr(100),
  officeHours: optStr(120),
  subjects: jsonList(
    z.object({ name: z.string().trim().min(1).max(60), year: z.number().int().min(1).max(5).nullable().optional() }),
    20,
  ).optional(),
  skills: jsonList(z.string().trim().min(1).max(30), 15).optional(),
  githubUrl: url,
  linkedinUrl: url,
  openToMentor: bool.optional(),
  mentorTopics: jsonList(z.string().trim().max(40), 10).optional(),
});

r.patch('/me', async (req, res) => {
  const b = parse(profileSchema, req.body);
  const me = req.user;
  const student = me.role === 'student' || (me.role === 'admin' && me.program);
  if (b.departmentId && !(await get('SELECT 1 FROM departments WHERE id = ?', b.departmentId))) {
    throw badRequest('Choose your department.', { departmentId: 'Choose your department' });
  }
  let gradYear = me.graduation_year;
  if (me.role === 'student') {
    const program = findProgram(b.program || me.program);
    if (!program) throw badRequest('Choose your program.', { program: 'Choose your program' });
    const year = b.year || me.year;
    if (year > program.years) throw badRequest(`${program.name} has ${program.years} years.`, { year: 'Not valid for this program' });
    gradYear = graduationYear(program.name, year);
  }
  if (me.role === 'teacher' && !b.officeLocation) {
    throw badRequest('Add your cabin or office so students can find you.', { officeLocation: 'Required' });
  }
  const mentor = !!b.openToMentor && !(me.role === 'student' && (b.year || me.year) < 2);

  const updated = await tx(async () => {
    await run(
      `UPDATE users SET name = ?, bio = ?, department_id = coalesce(?, department_id), program = ?, year = ?, section = ?,
         graduation_year = ?, enrollment_no = ?, designation = ?, office_location = ?, office_hours = ?, subjects = ?,
         skills = ?, github_url = ?, linkedin_url = ?, open_to_mentor = ?, mentor_topics = ?, updated_at = ?
       WHERE id = ?`,
      b.name,
      b.bio || null,
      b.departmentId,
      student ? b.program || me.program : null,
      student ? b.year || me.year : null,
      student ? b.section || null : null,
      student ? gradYear : null,
      student ? b.enrollmentNo || null : null,
      student ? null : b.designation || me.designation,
      student ? null : b.officeLocation || null,
      student ? null : b.officeHours || null,
      JSON.stringify(student ? [] : b.subjects || []),
      JSON.stringify(b.skills || []),
      b.githubUrl || null,
      b.linkedinUrl || null,
      mentor,
      JSON.stringify(mentor ? b.mentorTopics || [] : []),
      nowIso(),
      me.id,
    );
    const u = await get('SELECT * FROM users WHERE id = ?', me.id);
    if (u.department_id !== me.department_id || u.graduation_year !== me.graduation_year) await joinDefaultCommunities(u);
    await reindexUser(me.id);
    return u;
  });
  res.json(await mePayload(updated));
});

r.post('/me/avatar', uploadImage('avatar'), async (req, res) => {
  if (!req.file) throw badRequest('Choose an image.');
  const saved = saveImage(req, req.file, 'avatars');
  await run('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?', saved.url, nowIso(), req.user.id);
  keepUploads(req);
  removeUpload(req.user.avatar_url);
  res.json({ avatarUrl: saved.url });
});

r.delete('/me/avatar', async (req, res) => {
  await run('UPDATE users SET avatar_url = NULL, updated_at = ? WHERE id = ?', nowIso(), req.user.id);
  removeUpload(req.user.avatar_url);
  res.status(204).end();
});

const userId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw notFound('Profile not found.');
  return id;
};

r.get('/:id', async (req, res) => {
  const u = await get('SELECT * FROM users WHERE id = ?', userId(req));
  if (!u) throw notFound('Profile not found.');
  const communities = (await all(
    `SELECT c.*, m.role AS member_role FROM community_members m JOIN communities c ON c.id = m.community_id
     WHERE m.user_id = ? AND c.status = 'active' AND c.type <> 'official'
     ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, c.name`,
    u.id,
  )).map((c) => ({ ...serializeCommunity(c), memberRole: c.member_role }));
  const stats = {
    posts: (await get('SELECT count(*) AS n FROM posts WHERE author_id = ? AND deleted_at IS NULL AND is_hidden = 0', u.id)).n,
    answersAccepted: (await get(
      'SELECT count(*) AS n FROM posts p JOIN comments c ON c.id = p.accepted_comment_id WHERE c.author_id = ?',
      u.id,
    )).n,
  };
  res.json({
    user: await userProfile(u, req.user),
    communities,
    stats,
    isBlocked: !!(await get('SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, u.id)),
    hasBlockedYou: !!(await get('SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', u.id, req.user.id)),
  });
});

r.post('/:id/block', async (req, res) => {
  const id = userId(req);
  if (id === req.user.id) throw badRequest("You can't block yourself.");
  if (!(await get('SELECT 1 FROM users WHERE id = ?', id))) throw notFound('Profile not found.');
  await run('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?) ON CONFLICT DO NOTHING', req.user.id, id);
  res.status(204).end();
});

r.delete('/:id/block', async (req, res) => {
  await run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, userId(req));
  res.status(204).end();
});

export default r;
