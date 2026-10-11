// Manual end-to-end smoke check against a running seeded server: node test/smoke.mjs
const B = 'http://localhost:4000/api';
const pw = process.env.PW;
const out = (...a) => console.log(...a);

async function login(email) {
  const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
  return { c: r.headers.get('set-cookie')?.split(';')[0] || '', j: await r.json(), s: r.status };
}
async function call(c, path, opt = {}) {
  const headers = { cookie: c, ...(typeof opt.body === 'string' ? { 'content-type': 'application/json' } : {}) };
  const r = await fetch(B + path, { ...opt, headers });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
}
const json = (o) => JSON.stringify(o);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const img = (name = 'x.png') => [new Blob([png], { type: 'image/png' }), name];

const a = await login('demo.aarav@dypiu.ac.in');
out('login', a.s, a.j.user?.name, a.j.unread);
out('bad login', (await login('demo.nobody@dypiu.ac.in')).j.error?.code);
let r = await call(a.c, '/posts?tab=all&sort=hot');
out('feed', r.s, 'pinned', r.j.pinned?.length, 'items', r.j.items?.length, r.j.items?.slice(0, 4).map((p) => p.type + ':' + p.title.slice(0, 28)), 'next', !!r.j.nextCursor);
r = await call(a.c, '/posts?tab=all&sort=hot&cursor=' + r.j.nextCursor);
out('feed p2', r.s, r.j.items?.length, 'pinned', r.j.pinned?.length);
r = await call(a.c, '/posts?tab=events&when=upcoming');
out('events', r.s, r.j.items.map((p) => p.title.slice(0, 20) + ' ' + p.event.goingCount));
r = await call(a.c, '/posts?tab=doubts&sort=new');
out('doubts', r.s, r.j.items.length);
r = await call(a.c, '/users?role=teacher&teachesYear=3');
out('dir y3 teachers', r.s, r.j.items.map((u) => u.name + ' / ' + u.officeLocation));
r = await call(a.c, '/users?q=304');
out('dir q=304', r.s, r.j.items.map((u) => u.name));
r = await call(a.c, '/users/seniors');
out('seniors', r.s, r.j.items.map((u) => u.name + ' y' + u.year + ' ' + u.dept));
r = await call(a.c, '/communities');
out('comms', r.s, r.j.items.length, r.j.items.slice(0, 6).map((c) => c.slug + ':' + c.myRole + ':' + c.memberCount));
r = await call(a.c, '/conversations');
out('convs', r.s, r.j.items.map((c) => c.otherUser.name + ' unread ' + c.unreadCount));
r = await call(a.c, '/notifications');
out('notifs', r.s, r.j.items.length, 'unread', r.j.unreadCount);
r = await call(a.c, '/search?q=dbms');
out('search', r.s, r.j.posts.length, r.j.people.map((p) => p.name), r.j.communities.length);

let fd = new FormData();
fd.append('type', 'doubt'); fd.append('title', 'Test doubt from smoke'); fd.append('subjectTag', 'DBMS'); fd.append('images', ...img());
r = await call(a.c, '/posts', { method: 'POST', body: fd });
out('create doubt', r.s, r.j.post?.images, r.j.error);
const pid = r.j.post.id;
fd = new FormData(); fd.append('type', 'announcement'); fd.append('title', 'Student tries announcement');
r = await call(a.c, '/posts', { method: 'POST', body: fd });
out('student announcement', r.s, r.j.error?.code);
fd = new FormData(); fd.append('type', 'event'); fd.append('title', 'x event');
r = await call(a.c, '/posts', { method: 'POST', body: fd });
out('event missing fields', r.s, r.j.error?.fields);
fd = new FormData(); fd.append('body', 'hi'); fd.append('image', new Blob([Buffer.from('MZ not an image at all')], { type: 'image/png' }), 'x.png');
r = await call(a.c, `/posts/${pid}/comments`, { method: 'POST', body: fd });
out('fake image', r.s, r.j.error?.code);

const s = await login('demo.sneha@dypiu.ac.in');
fd = new FormData(); fd.append('body', 'Answer with image'); fd.append('image', ...img('a.png'));
r = await call(s.c, `/posts/${pid}/comments`, { method: 'POST', body: fd });
out('sneha comment', r.s, r.j.comment?.image, r.j.error);
const cid = r.j.comment.id;
r = await call(a.c, `/posts/${pid}/accept`, { method: 'POST', body: json({ commentId: cid }) });
out('accept', r.s, r.j.post?.status, r.j.post?.acceptedCommentId === cid);
r = await call(s.c, `/posts/${pid}/vote`, { method: 'POST', body: json({ value: 1 }) });
out('vote', r.s, r.j);
r = await call(a.c, `/posts/${pid}/vote`, { method: 'POST', body: json({ value: 1 }) });
out('self vote', r.s, r.j.error?.code);
r = await call(a.c, `/posts/${pid}/comments`);
out('comments', r.s, r.j.items.map((c) => c.body + ' accepted=' + c.isAccepted));

const gd = (await call(s.c, '/communities/gdgc')).j;
out('gdgc', gd.community?.myRole, gd.leaders?.map((l) => l.name + ':' + l.communityRole));
fd = new FormData();
fd.append('type', 'event'); fd.append('title', 'Smoke event'); fd.append('communityId', gd.community.id);
fd.append('eventStartsAt', new Date(Date.now() + 86400000).toISOString()); fd.append('eventVenue', 'Hall');
r = await call(s.c, '/posts', { method: 'POST', body: fd });
out('sneha event', r.s, r.j.post?.event, r.j.error);
const eid = r.j.post.id;
r = await call(a.c, `/posts/${eid}/rsvp`, { method: 'PUT', body: json({ status: 'going' }) });
out('rsvp', r.s, r.j);
r = await call(s.c, `/posts/${eid}/rsvps?format=csv`);
out('csv lines', r.s, String(r.j).split('\n').length);
r = await call(a.c, `/posts/${eid}/comments`, { method: 'POST', body: json({ body: 'nonmember comment' }) });
out('nonmember comment', r.s, r.j.error?.code);

r = await call(s.c, '/conversations', { method: 'POST', body: json({ userId: a.j.user.id }) });
out('conv', r.s, r.j.conversation?.otherUser?.name);
const conv = r.j.conversation.id;
fd = new FormData(); fd.append('body', 'I can help'); fd.append('clientId', 'abc-1'); fd.append('image', ...img('m.png'));
r = await call(s.c, `/conversations/${conv}/messages`, { method: 'POST', body: fd });
out('msg', r.s, r.j.message?.image);
r = await call(s.c, `/conversations/${conv}/messages`, { method: 'POST', body: fd });
out('msg retry is idempotent', r.s, r.j.message?.id);
r = await call(a.c, '/auth/unread');
out('unread aarav', r.j);
const k = await login('demo.kabir@dypiu.ac.in');
r = await call(k.c, `/conversations/${conv}/messages`);
out('third party reads DM', r.s);
r = await call(a.c, '/admin/stats');
out('admin as student', r.s);
const ad = await login('demo.admin@dypiu.ac.in');
r = await call(ad.c, '/admin/stats');
out('admin stats', r.s, r.j);
r = await call(ad.c, '/admin/teachers/pending');
out('pending faculty', r.j.items.map((u) => u.name));
r = await call('', '/auth/otp/request', { method: 'POST', body: json({ email: 'x@gmail.com' }) });
out('otp gmail', r.s, r.j.error?.code);
r = await call('', '/auth/otp/request', { method: 'POST', body: json({ email: 'x@dypiu.ac.in.evil.com' }) });
out('otp spoof domain', r.s, r.j.error?.code);
r = await call('', '/posts');
out('anon feed', r.s);
