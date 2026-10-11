import { z } from 'zod';
import { get, all, run, tx } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { notFound, forbidden, badRequest } from '../middleware/errors.js';
import { limit, MIN } from '../middleware/rateLimit.js';
import { uploadImage, saveImage, keepUploads } from '../middleware/upload.js';
import { parse, optStr, optInt } from '../services/validators.js';
import { loadMini, serializeMessage } from '../services/serialize.js';
import { emitTo } from '../services/notify.js';

const r = makeRouter();

const otherOf = (cv, me) => (cv.user_a_id === me ? cv.user_b_id : cv.user_a_id);

export async function loadConversation(id, userId) {
  const cv = await get('SELECT * FROM conversations WHERE id = ?', id);
  if (!cv || (cv.user_a_id !== userId && cv.user_b_id !== userId)) throw notFound('Conversation not found.');
  return cv;
}

async function blockState(me, other) {
  if (await get('SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', other, me)) return 'blocked_you';
  if (await get('SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', me, other)) return 'you_blocked';
  return null;
}

r.get('/', async (req, res) => {
  const me = req.user.id;
  const rows = await all(
    `SELECT cv.*, m.body AS last_body, m.image_url AS last_image, m.sender_id AS last_sender_id, m.deleted_at AS last_deleted,
       (SELECT count(*) FROM messages mm
         WHERE mm.conversation_id = cv.id AND mm.deleted_at IS NULL AND mm.sender_id <> ?
           AND mm.id > CASE WHEN cv.user_a_id = ? THEN cv.user_a_last_read_id ELSE cv.user_b_last_read_id END) AS unread
     FROM conversations cv
     LEFT JOIN messages m ON m.id = cv.last_message_id
     WHERE (cv.user_a_id = ? OR cv.user_b_id = ?) AND cv.last_message_id IS NOT NULL
     ORDER BY cv.last_message_at DESC`,
    me,
    me,
    me,
    me,
  );
  const items = [];
  for (const cv of rows) {
    items.push({
      id: cv.id,
      otherUser: await loadMini(otherOf(cv, me)),
      lastMessage: {
        body: cv.last_deleted ? '' : cv.last_body,
        hasImage: !!cv.last_image,
        senderId: cv.last_sender_id,
        createdAt: cv.last_message_at,
      },
      unreadCount: cv.unread,
    });
  }
  res.json({ items });
});

r.post('/', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.number().int().positive() }), req.body);
  const me = req.user.id;
  if (userId === me) throw badRequest("You can't message yourself.");
  const other = await get('SELECT id, status FROM users WHERE id = ?', userId);
  if (!other) throw notFound('That person does not exist.');
  const state = await blockState(me, userId);
  if (state === 'blocked_you') throw forbidden("You can't message this person.", 'BLOCKED');
  const [a, b] = me < userId ? [me, userId] : [userId, me];
  await run('INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?) ON CONFLICT DO NOTHING', a, b);
  const cv = await get('SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?', a, b);
  res.json({ conversation: { id: cv.id, otherUser: await loadMini(userId) } });
});

r.get('/:id/messages', async (req, res) => {
  const me = req.user.id;
  const cv = await loadConversation(Number(req.params.id), me);
  const q = parse(z.object({ before: optInt(1, 1e15), limit: optInt(1, 50) }), req.query);
  const n = q.limit || 30;
  const rows = await all(
    `SELECT * FROM messages WHERE conversation_id = ? ${q.before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    ...(q.before ? [cv.id, q.before, n + 1] : [cv.id, n + 1]),
  );
  const other = otherOf(cv, me);
  res.json({
    conversation: { id: cv.id, otherUser: await loadMini(other), blockState: await blockState(me, other) },
    items: rows.slice(0, n).reverse().map(serializeMessage),
    hasMore: rows.length > n,
    otherLastReadId: cv.user_a_id === me ? cv.user_b_last_read_id : cv.user_a_last_read_id,
  });
});

r.post('/:id/messages', limit('message', 120, MIN), uploadImage('image'), async (req, res) => {
  const me = req.user.id;
  const cv = await loadConversation(Number(req.params.id), me);
  const b = parse(z.object({ body: optStr(2000), clientId: optStr(64) }), req.body);
  if (!b.body && !req.file) throw badRequest('Write a message or attach an image.');
  const other = otherOf(cv, me);
  const state = await blockState(me, other);
  if (state === 'blocked_you') throw forbidden("You can't message this person.", 'BLOCKED');
  if (state === 'you_blocked') throw forbidden('You blocked this person. Unblock them to send messages.', 'BLOCKED');

  if (b.clientId) {
    const dup = await get('SELECT * FROM messages WHERE sender_id = ? AND client_id = ?', me, b.clientId);
    if (dup) return res.status(200).json({ message: serializeMessage(dup) });
  }
  const image = req.file ? saveImage(req, req.file, 'messages') : null;
  const message = await tx(async () => {
    const { id } = await run(
      'INSERT INTO messages (conversation_id, sender_id, body, image_url, client_id) VALUES (?, ?, ?, ?, ?)',
      cv.id,
      me,
      b.body || '',
      image?.url ?? null,
      b.clientId ?? null,
    );
    const m = await get('SELECT * FROM messages WHERE id = ?', id);
    await run(
      `UPDATE conversations SET last_message_id = ?, last_message_at = ?,
         user_a_last_read_id = CASE WHEN user_a_id = ? THEN ? ELSE user_a_last_read_id END,
         user_b_last_read_id = CASE WHEN user_b_id = ? THEN ? ELSE user_b_last_read_id END
       WHERE id = ?`,
      id,
      m.created_at,
      me,
      id,
      me,
      id,
      cv.id,
    );
    return m;
  });
  keepUploads(req);
  const payload = serializeMessage(message);
  emitTo(me, 'message:new', { message: payload, otherUser: await loadMini(other) });
  emitTo(other, 'message:new', { message: payload, otherUser: await loadMini(me) });
  res.status(201).json({ message: payload });
});

r.post('/:id/read', async (req, res) => {
  const me = req.user.id;
  const cv = await loadConversation(Number(req.params.id), me);
  const { lastReadMessageId } = parse(z.object({ lastReadMessageId: z.number().int().nonnegative() }), req.body);
  const upTo = Math.min(lastReadMessageId, cv.last_message_id || 0);
  const col = cv.user_a_id === me ? 'user_a_last_read_id' : 'user_b_last_read_id';
  const { changes } = await run(`UPDATE conversations SET ${col} = ? WHERE id = ? AND ${col} < ?`, upTo, cv.id, upTo);
  if (changes) emitTo(otherOf(cv, me), 'message:read', { conversationId: cv.id, readerId: me, lastReadMessageId: upTo });
  res.status(204).end();
});

export default r;
