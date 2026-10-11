import { get, run, parseJson } from '../db/index.js';

export function ftsQuery(q) {
  const tokens = (String(q || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).slice(0, 8);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null;
}

export async function reindexUser(id) {
  const u = await get(
    'SELECT u.*, d.code AS dept_code, d.name AS dept_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?',
    id,
  );
  if (!u) return;
  const text = [
    u.name,
    [u.dept_code, u.dept_name].filter(Boolean).join(' '),
    u.designation || '',
    u.office_location || '',
    parseJson(u.subjects).map((s) => (typeof s === 'string' ? s : s.name)).join(' '),
    [...parseJson(u.skills), ...parseJson(u.mentor_topics)].join(' '),
  ].join(' ');
  await run("UPDATE users SET search_vector = to_tsvector('simple', ?) WHERE id = ?", text, id);
}
