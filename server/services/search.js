import { get, run, parseJson } from '../db/index.js';

// Quotes each token so user input can never become FTS syntax.
export function ftsQuery(q) {
  const tokens = (String(q || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).slice(0, 8);
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(' ') : null;
}

export function reindexUser(id) {
  run('DELETE FROM users_fts WHERE rowid = ?', id);
  const u = get(
    'SELECT u.*, d.code AS dept_code, d.name AS dept_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?',
    id,
  );
  if (!u) return;
  run(
    'INSERT INTO users_fts (rowid, name, department, designation, office_location, subjects, skills) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    u.name,
    [u.dept_code, u.dept_name].filter(Boolean).join(' '),
    u.designation || '',
    u.office_location || '',
    parseJson(u.subjects).map((s) => s.name).join(' '),
    [...parseJson(u.skills), ...parseJson(u.mentor_topics)].join(' '),
  );
}
