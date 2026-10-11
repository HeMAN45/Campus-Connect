import { all } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { POST_SELECT, hydratePosts, userProfile, serializeCommunity } from '../services/serialize.js';
import { ftsQuery } from '../services/search.js';

const r = makeRouter();

r.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const fts = ftsQuery(q);
  if (!fts || q.length < 2) return res.json({ posts: [], people: [], communities: [] });
  const n = req.query.all ? 30 : 5;

  const postRows = await all(
    `${POST_SELECT} WHERE p.search_vector @@ to_tsquery('simple', ?)
       AND p.deleted_at IS NULL AND p.is_hidden = 0 AND (c.id IS NULL OR c.status = 'active')
     ORDER BY ts_rank(p.search_vector, to_tsquery('simple', ?)) DESC, p.created_at DESC LIMIT ?`,
    fts,
    fts,
    n,
  );
  const people = await all(
    `SELECT u.* FROM users u
     WHERE u.search_vector @@ to_tsquery('simple', ?)
       AND u.status <> 'suspended' AND u.role <> 'admin' AND NOT (u.role = 'teacher' AND u.status = 'pending')
       AND u.id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ?)
     ORDER BY (u.role = 'teacher') DESC, u.name LIMIT ?`,
    fts,
    req.user.id,
    n,
  );
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const communities = await all(
    `SELECT * FROM communities WHERE status = 'active' AND (name ILIKE ? OR description ILIKE ?)
     ORDER BY member_count DESC LIMIT ?`,
    like,
    like,
    n,
  );
  const peopleProfiles = [];
  for (const u of people) peopleProfiles.push(await userProfile(u, req.user));
  res.json({
    posts: await hydratePosts(postRows, req.user),
    people: peopleProfiles,
    communities: communities.map((c) => serializeCommunity(c)),
  });
});

export default r;
