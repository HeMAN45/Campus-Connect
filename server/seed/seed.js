import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { get, all, run, tx } from '../db/index.js';
import { reference, graduationYear } from '../services/reference.js';
import { joinDefaultCommunities } from '../services/communities.js';
import { reindexUser } from '../services/search.js';

const dir = path.join(config.root, 'seed', 'demo');
const load = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);
const pick = (arr, r = rand) => arr[Math.floor(r() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const UNIT = { m: 60_000, h: 3_600_000, d: 86_400_000 };
function duration(spec) {
  let ms = 0;
  for (const part of String(spec).trim().split(/\s+/)) {
    const m = part.match(/^(\d+)([mhd])$/);
    if (!m) throw new Error(`Bad duration "${spec}"`);
    ms += Number(m[1]) * UNIT[m[2]];
  }
  return ms;
}
const ago = (spec) => new Date(Date.now() - duration(spec)).toISOString();
const ahead = (spec) => new Date(Date.now() + duration(spec)).toISOString();
function dayAt(spec) {
  const m = spec.match(/^(-?\d+)d (\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Bad day spec "${spec}"`);
  const d = new Date();
  d.setDate(d.getDate() + Number(m[1]));
  d.setHours(Number(m[2]), Number(m[3]), 0, 0);
  return d;
}
const localDate = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * UNIT.d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const plus = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

function generateUsers(spec, names) {
  const r = rng(spec.seed);
  const used = new Set();
  const out = [];
  for (let i = 0; i < spec.count; i++) {
    const dept = spec.departments[i % spec.departments.length];
    const year = spec.years[Math.floor(i / spec.departments.length) % spec.years.length];
    let name;
    do name = `${pick(names.first, r)} ${pick(names.last, r)}`;
    while (used.has(name));
    used.add(name);
    const key = `g-${dept.toLowerCase()}-${year}-01`;
    const skills = [...new Set([pick(names.skills, r), pick(names.skills, r), pick(names.skills, r)])];
    const mentor = year >= 2 && r() < spec.mentorShare ? [pick(reference.mentorTopics, r), pick(reference.mentorTopics, r)] : null;
    out.push({
      key,
      email: `demo.${key}@dypiu.ac.in`,
      name,
      role: 'student',
      department: dept,
      program: dept === 'BCA' ? 'BCA' : 'B.Tech',
      year,
      section: pick(['A', 'B', 'C'], r),
      bio: pick(names.bios, r),
      skills,
      mentor: mentor ? [...new Set(mentor)] : null,
    });
  }
  return out;
}

function setRole(communityId, userId, role) {
  run(
    `INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(community_id, user_id) DO UPDATE SET role = excluded.role`,
    communityId,
    userId,
    role,
  );
}
const ensureMember = (communityId, userId) =>
  run('INSERT OR IGNORE INTO community_members (community_id, user_id) VALUES (?, ?)', communityId, userId);

function main() {
  if (!config.seedPassword) {
    console.error('Set SEED_PASSWORD in server/.env before seeding (see .env.example).');
    process.exit(1);
  }
  const real = get("SELECT count(*) AS n FROM users WHERE email NOT LIKE 'demo.%'").n;
  if (real > 0) {
    console.error(`This database has ${real} real accounts. Demo data is only loaded into demo databases.`);
    process.exit(1);
  }

  const started = Date.now();
  const hash = bcrypt.hashSync(config.seedPassword, 10);
  const names = load('names.json');
  const communitiesJson = load('communities.json');

  const stats = tx(() => {
    run("DELETE FROM users WHERE email LIKE 'demo.%'");

    for (const d of reference.departments) {
      run(
        'INSERT INTO departments (code, name, school) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, school = excluded.school',
        d.code,
        d.name,
        d.school,
      );
    }
    const deptId = (code) => get('SELECT id FROM departments WHERE code = ?', code)?.id;
    for (const d of reference.departments) {
      run(
        `INSERT INTO communities (slug, name, description, type, department_id, is_verified)
         VALUES (?, ?, ?, 'department', ?, 1) ON CONFLICT(slug) DO NOTHING`,
        d.code.toLowerCase(),
        `${d.code} Department`,
        `${d.name}: notices, doubts, and discussion for everyone in ${d.code}.`,
        deptId(d.code),
      );
    }
    for (const c of communitiesJson) {
      run(
        `INSERT INTO communities (slug, name, description, rules, type, auto_join, is_verified, status)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'active')
         ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description,
           rules = excluded.rules, type = excluded.type, auto_join = excluded.auto_join, status = 'active'`,
        c.slug,
        c.name,
        c.description,
        c.rules || null,
        c.type,
        !!c.autoJoin,
      );
    }
    const communityId = (slug) => get('SELECT id FROM communities WHERE slug = ?', slug)?.id;

    // Users
    const specs = load('users.json').flatMap((u) => (u.generate ? generateUsers(u.generate, names) : [u]));
    const users = {};
    for (const u of specs) {
      const student = u.role === 'student';
      const program = student ? u.program || 'B.Tech' : null;
      const created = ago(`${12 + Math.floor(rand() * 40)}d`);
      const { id } = run(
        `INSERT INTO users (email, password_hash, name, role, status, department_id, program, year, section, graduation_year,
           designation, office_location, office_hours, subjects, skills, bio, github_url, linkedin_url, open_to_mentor,
           mentor_topics, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        u.email,
        hash,
        u.name,
        u.role,
        u.status || 'active',
        u.department ? deptId(u.department) : null,
        program,
        student ? u.year : null,
        student ? u.section || null : null,
        student ? graduationYear(program, u.year) : null,
        student ? null : u.designation || null,
        student ? null : u.officeLocation || null,
        student ? null : u.officeHours || null,
        JSON.stringify(u.subjects || []),
        JSON.stringify(u.skills || []),
        u.bio || null,
        u.githubUrl || null,
        u.linkedinUrl || null,
        !!u.mentor,
        JSON.stringify(u.mentor || []),
        created,
        created,
        ago(`${1 + Math.floor(rand() * 48)}h`),
      );
      users[u.key] = get('SELECT * FROM users WHERE id = ?', id);
    }
    for (const u of Object.values(users)) {
      joinDefaultCommunities(u);
      reindexUser(u.id);
    }
    const uid = (key) => {
      if (!users[key]) throw new Error(`Unknown user key "${key}"`);
      return users[key].id;
    };
    const everyone = Object.values(users).filter((u) => u.status === 'active').map((u) => u.id);

    // Community leaders and members
    for (const c of communitiesJson) {
      const cid = communityId(c.slug);
      for (const k of c.admins || []) setRole(cid, uid(k), 'admin');
      for (const k of c.moderators || []) setRole(cid, uid(k), 'moderator');
    }
    for (const m of load('memberships.json')) {
      const cid = communityId(m.community);
      for (const k of m.users) ensureMember(cid, uid(k));
      for (const id of shuffle(everyone).slice(0, m.random || 0)) ensureMember(cid, id);
    }

    // Posts
    const resolveCommunity = (key) => {
      if (!key) return null;
      if (key.startsWith('batch:')) {
        const [, code, year] = key.split(':');
        return get(
          "SELECT id FROM communities WHERE type = 'batch' AND department_id = ? AND graduation_year = ?",
          deptId(code),
          graduationYear('B.Tech', Number(year)),
        )?.id;
      }
      const id = communityId(key);
      if (!id) throw new Error(`Unknown community "${key}"`);
      return id;
    };
    const posts = {};
    for (const p of load('posts.json')) {
      const author = uid(p.author);
      const cid = resolveCommunity(p.community);
      if (cid) ensureMember(cid, author);
      const created = ago(p.ago);
      let start = null;
      let end = null;
      if (p.event) {
        const s = dayAt(p.event.startsIn);
        start = s.toISOString();
        end = new Date(s.getTime() + (p.event.durationMinutes || 120) * 60_000).toISOString();
      }
      const { id } = run(
        `INSERT INTO posts (author_id, community_id, type, title, body, status, resolved_at, subject_tag, needed_by,
           item_location, item_date, event_starts_at, event_ends_at, event_venue, event_url, is_pinned, pinned_until, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        author,
        cid,
        p.type,
        p.title,
        p.body || '',
        p.status || 'open',
        p.status === 'resolved' ? plus(created, UNIT.h) : null,
        p.subjectTag || null,
        p.neededIn ? ahead(p.neededIn) : null,
        p.item?.location || null,
        p.item ? localDate(p.item.daysAgo || 0) : null,
        start,
        end,
        p.event?.venue || null,
        p.event?.url || null,
        !!p.pinned,
        p.pinned && !cid ? plus(created, 7 * UNIT.d) : null,
        created,
      );
      posts[p.key] = { id, author, spec: p, created, communityId: cid };
    }

    // Comments
    const comments = {};
    for (const c of load('comments.json')) {
      const post = posts[c.post];
      if (!post) throw new Error(`Unknown post "${c.post}"`);
      const parent = c.parent ? comments[c.parent] : null;
      const author = uid(c.author);
      if (post.communityId) ensureMember(post.communityId, author);
      const created = ago(c.ago);
      const { id } = run(
        'INSERT INTO comments (post_id, author_id, parent_id, depth, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        post.id,
        author,
        parent?.id ?? null,
        parent ? 1 : 0,
        c.body,
        created,
      );
      comments[c.key] = { id, author, created, post, spec: c };
      const read = Date.now() - Date.parse(created) > 6 * UNIT.h ? created : null;
      const notifyUser = (userId, type) =>
        userId !== author &&
        run(
          'INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id, read_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          userId,
          type,
          author,
          post.id,
          id,
          read,
          created,
          created,
        );
      notifyUser(post.author, 'post_comment');
      if (parent && parent.author !== post.author) notifyUser(parent.author, 'comment_reply');
    }
    for (const p of Object.values(posts)) {
      if (p.spec.accepted) run('UPDATE posts SET accepted_comment_id = ? WHERE id = ?', comments[p.spec.accepted].id, p.id);
    }

    // Votes
    const voteTo = (table, col, id, authorId, target) => {
      const voters = shuffle(everyone.filter((u) => u !== authorId)).slice(0, Math.max(0, target || 0));
      for (const v of voters) run(`INSERT INTO ${table} (${col}, user_id, value) VALUES (?, ?, 1)`, id, v);
      run(`UPDATE ${table === 'post_votes' ? 'posts' : 'comments'} SET score = ? WHERE id = ?`, voters.length, id);
    };
    for (const p of Object.values(posts)) voteTo('post_votes', 'post_id', p.id, p.author, p.spec.score);
    for (const c of Object.values(comments)) voteTo('comment_votes', 'comment_id', c.id, c.author, c.spec.score);

    // Campus announcements notify everyone
    for (const p of Object.values(posts)) {
      if (p.spec.type !== 'announcement' || p.communityId) continue;
      for (const u of everyone) {
        if (u === p.author) continue;
        run(
          'INSERT INTO notifications (user_id, type, actor_id, post_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          u,
          'announcement',
          p.author,
          p.id,
          p.created,
          p.created,
        );
      }
    }

    // RSVPs
    for (const rs of load('rsvps.json')) {
      const post = posts[rs.post];
      const going = new Set((rs.include || []).map(uid));
      const pool = shuffle(everyone.filter((u) => u !== post.author && !going.has(u)));
      while (going.size < rs.going && pool.length) going.add(pool.pop());
      const interested = pool.splice(0, rs.interested || 0);
      for (const u of going) run("INSERT INTO event_rsvps (post_id, user_id, status) VALUES (?, ?, 'going')", post.id, u);
      for (const u of interested) run("INSERT INTO event_rsvps (post_id, user_id, status) VALUES (?, ?, 'interested')", post.id, u);
      run('UPDATE posts SET going_count = ?, interested_count = ? WHERE id = ?', going.size, interested.length, post.id);
    }

    // Conversations
    for (const cv of load('conversations.json')) {
      const [x, y] = cv.between.map(uid);
      const [a, b] = x < y ? [x, y] : [y, x];
      const { id } = run('INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?)', a, b);
      let last = null;
      for (const m of cv.messages) {
        const created = ago(m.ago);
        last = { id: run('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)', id, uid(m.from), m.body, created).id, created, sender: uid(m.from) };
      }
      const readA = cv.readAll || last.sender === a ? last.id : 0;
      const readB = cv.readAll || last.sender === b ? last.id : 0;
      run(
        'UPDATE conversations SET last_message_id = ?, last_message_at = ?, user_a_last_read_id = ?, user_b_last_read_id = ? WHERE id = ?',
        last.id,
        last.created,
        readA,
        readB,
        id,
      );
    }

    run('UPDATE communities SET member_count = (SELECT count(*) FROM community_members m WHERE m.community_id = communities.id)');
    run('UPDATE posts SET comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = posts.id AND c.deleted_at IS NULL)');

    return {
      users: Object.keys(users).length,
      communities: all('SELECT id FROM communities').length,
      posts: Object.keys(posts).length,
      comments: Object.keys(comments).length,
      rsvps: get('SELECT count(*) AS n FROM event_rsvps').n,
      conversations: get('SELECT count(*) AS n FROM conversations').n,
    };
  });

  console.log(`Seeded in ${Date.now() - started} ms:`, stats);
  console.log('Demo accounts: demo.<name>@dypiu.ac.in with the SEED_PASSWORD from server/.env');
}

main();
