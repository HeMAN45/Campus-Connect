import { z } from 'zod';
import { get, all, run, tx, nowIso } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { notFound, forbidden, badRequest } from '../middleware/errors.js';
import { limit, HOUR } from '../middleware/rateLimit.js';
import { uploadImage, saveImage, keepUploads } from '../middleware/upload.js';
import { parse, optStr, optInt, str } from '../services/validators.js';
import { COMMENT_SELECT, serializeComment } from '../services/serialize.js';
import { isAdmin, memberRole, canModerate } from '../services/permissions.js';
import { notify } from '../services/notify.js';
import { loadPostRow } from './posts.js';

const r = makeRouter();

const numId = (v) => {
  const id = Number(v);
  if (!Number.isInteger(id) || id < 1) throw notFound();
  return id;
};

function loadComment(id, viewer, post) {
  const row = get(`${COMMENT_SELECT} WHERE cm.id = ?`, id);
  const role = post.community_id ? memberRole(post.community_id, row.author_id) : null;
  return serializeComment(row, { acceptedId: post.accepted_comment_id, communityRole: role, viewer });
}

r.get('/posts/:id/comments', (req, res) => {
  const post = loadPostRow(numId(req.params.id), req.user);
  const sort = req.query.sort === 'new' ? 'new' : 'top';
  const rows = all(`${COMMENT_SELECT} WHERE cm.post_id = ? ORDER BY cm.created_at ASC LIMIT 1000`, post.id);
  const votes = new Map(
    all(
      'SELECT v.comment_id, v.value FROM comment_votes v JOIN comments c ON c.id = v.comment_id WHERE c.post_id = ? AND v.user_id = ?',
      post.id,
      req.user.id,
    ).map((v) => [v.comment_id, v.value]),
  );
  const roles = new Map();
  const roleOf = (uid) => {
    if (!post.community_id) return null;
    if (!roles.has(uid)) roles.set(uid, memberRole(post.community_id, uid));
    return roles.get(uid);
  };

  const byId = new Map();
  const top = [];
  for (const row of rows) {
    const c = serializeComment(row, {
      myVote: votes.get(row.id) || 0,
      acceptedId: post.accepted_comment_id,
      communityRole: roleOf(row.author_id),
      viewer: req.user,
    });
    byId.set(c.id, c);
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).replies.push(c);
    else if (!c.parentId) top.push(c);
  }
  // Deleted comments only stay visible as placeholders when they still have replies.
  const visible = top.filter((c) => !c.isDeleted || c.replies.length);
  for (const c of visible) c.replies = c.replies.filter((x) => !x.isDeleted);
  if (sort === 'top') visible.sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
  else visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ items: visible, acceptedCommentId: post.accepted_comment_id });
});

r.post('/posts/:id/comments', limit('comment', 60, HOUR), uploadImage('image'), (req, res) => {
  const post = loadPostRow(numId(req.params.id), req.user);
  const b = parse(z.object({ body: optStr(2000), parentId: optInt(1, 1e12), imageAlt: optStr(200) }), req.body);
  if (!b.body && !req.file) throw badRequest('Write something or attach an image.', { body: 'Write something or attach an image' });
  if (post.comments_locked) throw forbidden('Comments are turned off for this post.', 'COMMENTS_LOCKED');
  if ((post.type === 'lost' || post.type === 'found') && post.status === 'resolved') {
    throw forbidden('This item has been resolved.', 'RESOLVED');
  }
  if (post.community_id && !isAdmin(req.user) && !memberRole(post.community_id, req.user.id)) {
    const c = get('SELECT name FROM communities WHERE id = ?', post.community_id);
    throw forbidden(`Join ${c.name} to comment.`, 'NOT_MEMBER');
  }

  let body = b.body || '';
  let parent = null;
  let replyTo = null;
  if (b.parentId) {
    replyTo = get(
      'SELECT cm.*, u.name AS author_name FROM comments cm JOIN users u ON u.id = cm.author_id WHERE cm.id = ? AND cm.post_id = ? AND cm.deleted_at IS NULL',
      b.parentId,
      post.id,
    );
    if (!replyTo) throw notFound('That comment no longer exists.');
    parent = replyTo.parent_id ? get('SELECT * FROM comments WHERE id = ?', replyTo.parent_id) : replyTo;
    if (replyTo.parent_id && replyTo.author_id !== req.user.id) body = `@${replyTo.author_name} ${body}`.slice(0, 2000);
  }

  const image = req.file ? saveImage(req, req.file, 'comments') : null;
  const id = tx(() => {
    const { id } = run(
      'INSERT INTO comments (post_id, author_id, parent_id, depth, body, image_url, image_alt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      post.id,
      req.user.id,
      parent?.id ?? null,
      parent ? 1 : 0,
      body,
      image?.url ?? null,
      image ? b.imageAlt || null : null,
    );
    run('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', post.id);
    return id;
  });
  keepUploads(req);

  notify([post.author_id], { type: 'post_comment', actorId: req.user.id, postId: post.id, commentId: id });
  if (replyTo) {
    const targets = [replyTo.author_id, parent.author_id].filter((u) => u !== post.author_id);
    notify(targets, { type: 'comment_reply', actorId: req.user.id, postId: post.id, commentId: id });
  }
  res.status(201).json({ comment: loadComment(id, req.user, post) });
});

function loadCommentRow(id) {
  const c = get('SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL', id);
  if (!c) throw notFound('That comment no longer exists.');
  return c;
}

r.patch('/comments/:id', (req, res) => {
  const c = loadCommentRow(numId(req.params.id));
  if (c.author_id !== req.user.id) throw forbidden();
  const { body } = parse(z.object({ body: c.image_url ? optStr(2000) : str(1, 2000) }), req.body);
  run('UPDATE comments SET body = ?, edited_at = ? WHERE id = ?', body || '', nowIso(), c.id);
  const post = get('SELECT * FROM posts WHERE id = ?', c.post_id);
  res.json({ comment: loadComment(c.id, req.user, post) });
});

r.delete('/comments/:id', (req, res) => {
  const c = loadCommentRow(numId(req.params.id));
  const post = get('SELECT * FROM posts WHERE id = ?', c.post_id);
  const owner = c.author_id === req.user.id;
  if (!owner && !canModerate(post, req.user)) throw forbidden();
  tx(() => {
    run('UPDATE comments SET deleted_at = ? WHERE id = ?', nowIso(), c.id);
    run('UPDATE posts SET comment_count = max(comment_count - 1, 0) WHERE id = ?', c.post_id);
    if (post.accepted_comment_id === c.id) {
      run("UPDATE posts SET accepted_comment_id = NULL, status = 'open', resolved_at = NULL WHERE id = ?", post.id);
    }
  });
  if (!owner) notify([c.author_id], { type: 'content_removed', actorId: req.user.id, postId: post.id, data: { kind: 'comment' } });
  res.status(204).end();
});

r.post('/comments/:id/vote', limit('vote', 300, HOUR), (req, res) => {
  const c = loadCommentRow(numId(req.params.id));
  if (c.author_id === req.user.id) throw forbidden("You can't vote on your own comment.");
  const { value } = parse(z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }), req.body);
  const score = tx(() => {
    const old = get('SELECT value FROM comment_votes WHERE comment_id = ? AND user_id = ?', c.id, req.user.id)?.value || 0;
    if (value === 0) run('DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?', c.id, req.user.id);
    else {
      run(
        `INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, ?, ?)
         ON CONFLICT(comment_id, user_id) DO UPDATE SET value = excluded.value`,
        c.id,
        req.user.id,
        value,
      );
    }
    run('UPDATE comments SET score = score + ? WHERE id = ?', value - old, c.id);
    return get('SELECT score FROM comments WHERE id = ?', c.id).score;
  });
  res.json({ score, myVote: value });
});

export default r;
