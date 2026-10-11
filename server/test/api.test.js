import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.CC_SKIP_ENV_FILE = '1';
process.env.CC_QUIET = '1';
process.env.DB_PATH = ':memory:';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `cc-test-uploads-${process.pid}`);
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
process.env.ALLOWED_EMAIL_DOMAIN = 'dypiu.ac.in';

const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcryptjs');
const { default: jwt } = await import('jsonwebtoken');
const { createApp } = await import('../index.js');
const { run, get } = await import('../db/index.js');
const { joinDefaultCommunities } = await import('../services/communities.js');
const { resetRateLimits } = await import('../middleware/rateLimit.js');

const app = createApp();
const PASSWORD = 'Testing123';
const hash = bcrypt.hashSync(PASSWORD, 4);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let deptId;
let clubId;
const users = {};

function makeUser(key, fields) {
  const { id } = run(
    `INSERT INTO users (email, password_hash, name, role, status, department_id, program, year, graduation_year, designation, office_location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    `${key}@dypiu.ac.in`,
    hash,
    fields.name,
    fields.role,
    fields.status || 'active',
    deptId,
    fields.role === 'student' ? 'B.Tech' : null,
    fields.year ?? null,
    fields.role === 'student' ? 2030 : null,
    fields.role === 'teacher' ? 'Assistant Professor' : null,
    fields.role === 'teacher' ? 'Block A, Room 1' : null,
  );
  const u = get('SELECT * FROM users WHERE id = ?', id);
  joinDefaultCommunities(u);
  users[key] = u;
  return u;
}

async function agentFor(key) {
  const agent = request.agent(app);
  const r = await agent.post('/api/auth/login').send({ email: `${key}@dypiu.ac.in`, password: PASSWORD });
  assert.equal(r.status, 200, `login ${key}`);
  return agent;
}

before(() => {
  deptId = run("INSERT INTO departments (code, name) VALUES ('CSE', 'Computer Science')").id;
  run("INSERT INTO communities (slug, name, type, department_id) VALUES ('cse', 'CSE Department', 'department', ?)", deptId);
  run("INSERT INTO communities (slug, name, type, auto_join) VALUES ('dypiu', 'DYPIU Announcements', 'official', 1)");
  clubId = run("INSERT INTO communities (slug, name, type) VALUES ('gdgc', 'GDGC', 'club')").id;
  makeUser('student1', { name: 'Student One', role: 'student', year: 1 });
  makeUser('student3', { name: 'Student Three', role: 'student', year: 3 });
  makeUser('outsider', { name: 'Third Party', role: 'student', year: 2 });
  makeUser('teacher', { name: 'Verified Teacher', role: 'teacher' });
  makeUser('pending', { name: 'Pending Teacher', role: 'teacher', status: 'pending' });
  run("INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'admin')", clubId, users.student3.id);
});

test('registration only accepts the college domain', async () => {
  resetRateLimits();
  for (const email of ['a@gmail.com', 'a@dypiu.ac.in.evil.com', 'a@notdypiu.ac.in']) {
    const r = await request(app).post('/api/auth/otp/request').send({ email });
    assert.equal(r.status, 400, email);
    assert.equal(r.body.error.code, 'INVALID_EMAIL_DOMAIN');
  }
  const ok = await request(app).post('/api/auth/otp/request').send({ email: 'new.person@abc.dypiu.ac.in' });
  assert.equal(ok.status, 200);
  assert.match(ok.body.devCode, /^\d{6}$/);
  const wrongCode = ok.body.devCode === '000000' ? '111111' : '000000';
  const wrong = await request(app).post('/api/auth/otp/verify').send({ email: 'new.person@abc.dypiu.ac.in', code: wrongCode });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error.code, /OTP_INVALID/);
  const right = await request(app).post('/api/auth/otp/verify').send({ email: 'new.person@abc.dypiu.ac.in', code: ok.body.devCode });
  assert.ok(right.body.registrationToken);
  const taken = await request(app).post('/api/auth/otp/request').send({ email: 'student1@dypiu.ac.in' });
  assert.equal(taken.body.error.code, 'EMAIL_TAKEN');
});

test('register with a verified email auto-joins department and official communities', async () => {
  const token = jwt.sign({ email: 'fresh@dypiu.ac.in', purpose: 'register' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const r = await request(app)
    .post('/api/auth/register')
    .send({ registrationToken: token, name: 'Fresh Student', password: 'Fresh2026', role: 'student', departmentId: deptId, program: 'B.Tech', year: 1 });
  assert.equal(r.status, 201);
  assert.ok(r.headers['set-cookie'][0].includes('HttpOnly'));
  const slugs = get(
    "SELECT group_concat(c.slug) AS s FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ?",
    r.body.user.id,
  ).s;
  assert.match(slugs, /cse/);
  assert.match(slugs, /dypiu/);
  assert.match(slugs, /cse-\d{4}/);
});

test('teacher registration starts pending', async () => {
  const token = jwt.sign({ email: 'prof.new@dypiu.ac.in', purpose: 'register' }, process.env.JWT_SECRET);
  const r = await request(app)
    .post('/api/auth/register')
    .send({ registrationToken: token, name: 'Prof New', password: 'Teach2026', role: 'teacher', departmentId: deptId, designation: 'Professor', officeLocation: 'Block B' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.status, 'pending');
  assert.equal(r.body.permissions.canPostCampusAnnouncement, false);
});

test('campus announcement permissions follow the matrix', async () => {
  const student = await agentFor('student1');
  let r = await student.post('/api/posts').field('type', 'announcement').field('title', 'Not allowed');
  assert.equal(r.status, 403);
  const pending = await agentFor('pending');
  r = await pending.post('/api/posts').field('type', 'announcement').field('title', 'Not yet');
  assert.equal(r.body.error.code, 'PENDING_APPROVAL');
  const teacher = await agentFor('teacher');
  r = await teacher.post('/api/posts').field('type', 'announcement').field('title', 'Lab moved').field('pinned', 'true');
  assert.equal(r.status, 201);
  assert.equal(r.body.post.isPinned, true);
  const notified = get("SELECT count(*) AS n FROM notifications WHERE type = 'announcement' AND post_id = ?", r.body.post.id).n;
  assert.ok(notified >= 4);
});

test('events need a community the author moderates', async () => {
  const student = await agentFor('student1');
  const start = new Date(Date.now() + 86_400_000).toISOString();
  let r = await student.post('/api/posts').field('type', 'event').field('title', 'Party').field('communityId', clubId).field('eventStartsAt', start).field('eventVenue', 'Hall');
  assert.equal(r.status, 403);
  const lead = await agentFor('student3');
  r = await lead.post('/api/posts').field('type', 'event').field('title', 'Workshop').field('communityId', clubId).field('eventStartsAt', start).field('eventVenue', 'Hall');
  assert.equal(r.status, 201);
  const rsvp = await student.put(`/api/posts/${r.body.post.id}/rsvp`).send({ status: 'going' });
  assert.equal(rsvp.body.goingCount, 1);
  const undo = await student.put(`/api/posts/${r.body.post.id}/rsvp`).send({ status: null });
  assert.equal(undo.body.goingCount, 0);
});

test('post validation and image checks', async () => {
  const student = await agentFor('student1');
  let r = await student.post('/api/posts').field('type', 'doubt').field('title', 'No subject');
  assert.equal(r.status, 400);
  assert.ok(r.body.error.fields.subjectTag);
  r = await student.post('/api/posts').field('type', 'lost').field('title', 'Keys').field('itemLocation', 'Canteen').field('itemDate', '2020-01-01').attach('images', PNG, { filename: 'k.png', contentType: 'image/png' });
  assert.equal(r.status, 201);
  assert.equal(r.body.post.images.length, 1);
  r = await student.post('/api/posts').field('type', 'general').field('title', 'Fake image').attach('images', Buffer.from('MZ this is not an image'), { filename: 'x.png', contentType: 'image/png' });
  assert.equal(r.status, 415);
});

test('comments, accepted answers, and self votes', async () => {
  const asker = await agentFor('student1');
  const helper = await agentFor('student3');
  const post = (await asker.post('/api/posts').field('type', 'doubt').field('title', 'What is a deadlock?').field('subjectTag', 'OS')).body.post;
  const comment = (await helper.post(`/api/posts/${post.id}/comments`).field('body', 'Circular wait.').attach('image', PNG, { filename: 'a.png', contentType: 'image/png' })).body.comment;
  assert.ok(comment.image.url.startsWith('/uploads/comments/'));
  const accepted = await asker.post(`/api/posts/${post.id}/accept`).send({ commentId: comment.id });
  assert.equal(accepted.body.post.status, 'resolved');
  const selfVote = await asker.post(`/api/posts/${post.id}/vote`).send({ value: 1 });
  assert.equal(selfVote.status, 403);
  const vote = await helper.post(`/api/posts/${post.id}/vote`).send({ value: 1 });
  assert.deepEqual(vote.body, { score: 1, myVote: 1 });
  const stranger = await helper.post(`/api/posts/${post.id}/accept`).send({ commentId: comment.id });
  assert.equal(stranger.status, 403);
});

test('direct messages are private, idempotent, and respect blocks', async () => {
  const a = await agentFor('student1');
  const b = await agentFor('student3');
  const c = await agentFor('outsider');
  const conv = (await a.post('/api/conversations').send({ userId: users.student3.id })).body.conversation;
  const send = () => a.post(`/api/conversations/${conv.id}/messages`).field('body', 'hello').field('clientId', 'same-id');
  const first = await send();
  const retry = await send();
  assert.equal(first.status, 201);
  assert.equal(retry.body.message.id, first.body.message.id);
  assert.equal((await b.get(`/api/conversations/${conv.id}/messages`)).body.items.length, 1);
  assert.equal((await c.get(`/api/conversations/${conv.id}/messages`)).status, 404);
  assert.equal((await b.get('/api/auth/unread')).body.messages, 1);
  await b.post(`/api/users/${users.student1.id}/block`);
  const blocked = await a.post(`/api/conversations/${conv.id}/messages`).field('body', 'still there?');
  assert.equal(blocked.body.error.code, 'BLOCKED');
});

test('directory finds faculty by cabin and hides pending faculty', async () => {
  const { reindexUser } = await import('../services/search.js');
  Object.values(users).forEach((u) => reindexUser(u.id));
  const s = await agentFor('student1');
  const byCabin = await s.get('/api/users?q=Block A');
  assert.ok(byCabin.body.items.some((u) => u.id === users.teacher.id));
  const faculty = await s.get('/api/users?role=teacher');
  assert.ok(!faculty.body.items.some((u) => u.id === users.pending.id));
});

test('admin routes are admin only and approvals unlock announcements', async () => {
  const s = await agentFor('student1');
  assert.equal((await s.get('/api/admin/stats')).status, 403);
  makeUser('admin1', { name: 'Admin', role: 'admin' });
  const admin = await agentFor('admin1');
  const pending = await admin.get('/api/admin/teachers/pending');
  assert.ok(pending.body.items.some((u) => u.id === users.pending.id));
  await admin.post(`/api/admin/teachers/${users.pending.id}/decision`).send({ approve: true });
  const teacher = await agentFor('pending');
  const r = await teacher.post('/api/posts').field('type', 'announcement').field('title', 'Now allowed');
  assert.equal(r.status, 201);
});

test('requests without a session are rejected', async () => {
  assert.equal((await request(app).get('/api/posts')).status, 401);
  assert.equal((await request(app).post('/api/posts').set('Origin', 'https://evil.example').send({})).status, 403);
});
