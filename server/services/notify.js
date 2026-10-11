import { get, run, tx, nowIso } from '../db/index.js';
import { NOTIFICATION_SELECT, serializeNotification } from './serialize.js';

let io = null;
export const setIo = (instance) => {
  io = instance;
};
export const emitTo = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);

const COLLAPSIBLE = new Set(['post_comment']);

export function notify(userIds, { type, actorId = null, postId = null, commentId = null, communityId = null, data = {} }) {
  const targets = [...new Set(userIds)].filter((id) => id && id !== actorId);
  if (!targets.length) return;
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const touched = tx(() =>
    targets.map((userId) => {
      if (COLLAPSIBLE.has(type)) {
        const existing = get(
          'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND post_id IS ? AND read_at IS NULL AND updated_at > ?',
          userId,
          type,
          postId,
          since,
        );
        if (existing) {
          run(
            'UPDATE notifications SET actor_id = ?, actor_count = actor_count + 1, comment_id = ?, updated_at = ? WHERE id = ?',
            actorId,
            commentId,
            nowIso(),
            existing.id,
          );
          return [userId, existing.id];
        }
      }
      const { id } = run(
        'INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id, community_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        userId,
        type,
        actorId,
        postId,
        commentId,
        communityId,
        JSON.stringify(data),
      );
      return [userId, id];
    }),
  );
  if (!io) return;
  for (const [userId, id] of touched) {
    const row = get(`${NOTIFICATION_SELECT} WHERE n.id = ?`, id);
    if (row) emitTo(userId, 'notification:new', serializeNotification(row));
  }
}
