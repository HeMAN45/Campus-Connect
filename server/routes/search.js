import { all } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { POST_SELECT, hydratePosts, userProfile, serializeCommunity } from '../services/serialize.js';
import { ftsQuery } from '../services/search.js';

const r = makeRouter();

r.get('/', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const fts = ftsQuery(q);
  if (!fts || q.length < 2) return res.json({ posts: [], people: [], communities: [] });
  const n = req.query.all ? 30 : 5;

  const postRows = all(
    `${POST_SELECT} WHERE p.id IN (
       SELECT rowid FROM posts_fts WHERE posts_fts MATCH ? ORDER BY bm25(posts_fts, 10.0, 1.0, 4.0) LIMIT 200
     ) AND p.deleted_at IS NULL AND p.is_hidden = 0 AND (c.id IS NULL OR c.status = 'active')
     ORDER BY p.created_at DESC LIMIT ?`,
    fts,
    n,
  );
  const people = all(
    `SELECT u.* FROM users u
     WHERE u.id IN (SELECT rowid FROM users_fts WHERE users_fts MATCH ?)
       AND u.status <> 'suspended' AND u.role <> 'admin' AND NOT (u.role = 'teacher' AND u.status = 'pending')
       AND u.id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ?)
     ORDER BY (u.role = 'teacher') DESC, u.name LIMIT ?`,
    fts,
    req.user.id,
    n,
  );
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const communities = all(
    `SELECT * FROM communities WHERE status = 'active' AND (name LIKE ? OR description LIKE ?)
     ORDER BY member_count DESC LIMIT ?`,
    like,
    like,
    n,
  );
  res.json({
    posts: hydratePosts(postRows, req.user),
    people: people.map((u) => userProfile(u, req.user)),
    communities: communities.map((c) => serializeCommunity(c)),
  });
});

export default r;
