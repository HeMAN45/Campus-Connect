import { z } from 'zod';
import { get, all, run, nowIso, placeholders } from '../db/index.js';
import { makeRouter } from '../middleware/router.js';
import { parse, optStr } from '../services/validators.js';
import { NOTIFICATION_SELECT, serializeNotification } from '../services/serialize.js';

const r = makeRouter();

r.get('/', async (req, res) => {
  const q = parse(z.object({ before: optStr(40) }), req.query);
  const rows = await all(
    `${NOTIFICATION_SELECT} WHERE n.user_id = ? ${q.before ? 'AND n.updated_at < ?' : ''} ORDER BY n.updated_at DESC LIMIT 31`,
    ...(q.before ? [req.user.id, q.before] : [req.user.id]),
  );
  res.json({
    items: rows.slice(0, 30).map(serializeNotification),
    nextBefore: rows.length > 30 ? rows[29].updated_at : null,
    unreadCount: (await get('SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id)).n,
  });
});

r.post('/read', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.number().int().positive()).max(200).optional() }), req.body || {});
  if (ids?.length) {
    await run(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders(ids.length)})`,
      nowIso(),
      req.user.id,
      ...ids,
    );
  } else {
    await run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), req.user.id);
  }
  res.status(204).end();
});

export default r;
