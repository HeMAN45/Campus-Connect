import { get, all, run } from '../db/index.js';
import { admissionYear } from './reference.js';

export function joinCommunity(communityId, userId, role = 'member') {
  const r = run('INSERT OR IGNORE INTO community_members (community_id, user_id, role) VALUES (?, ?, ?)', communityId, userId, role);
  if (r.changes) run('UPDATE communities SET member_count = member_count + 1 WHERE id = ?', communityId);
  return r.changes > 0;
}

export function leaveCommunity(communityId, userId) {
  const r = run('DELETE FROM community_members WHERE community_id = ? AND user_id = ?', communityId, userId);
  if (r.changes) run('UPDATE communities SET member_count = max(member_count - 1, 0) WHERE id = ?', communityId);
  return r.changes > 0;
}

function ensureBatchCommunity(user) {
  if (user.role !== 'student' || !user.department_id || !user.graduation_year) return null;
  const existing = get(
    "SELECT id FROM communities WHERE type = 'batch' AND department_id = ? AND graduation_year = ?",
    user.department_id,
    user.graduation_year,
  );
  if (existing) return existing.id;
  const dept = get('SELECT code, name FROM departments WHERE id = ?', user.department_id);
  const admitted = admissionYear(user.program, user.graduation_year);
  let slug = `${dept.code.toLowerCase()}-${admitted}`;
  if (get('SELECT 1 FROM communities WHERE slug = ?', slug)) slug = `${slug}-${user.graduation_year}`;
  return run(
    `INSERT INTO communities (slug, name, description, type, department_id, graduation_year, is_verified)
     VALUES (?, ?, ?, 'batch', ?, ?, 1)`,
    slug,
    `${dept.code} ${admitted} Batch`,
    `${dept.name} students admitted in ${admitted}. Class updates, notes, and plans.`,
    user.department_id,
    user.graduation_year,
  ).id;
}

// Official communities for everyone, plus the user's department and batch.
export function joinDefaultCommunities(user) {
  for (const c of all("SELECT id FROM communities WHERE auto_join = 1 AND status = 'active'")) joinCommunity(c.id, user.id);
  if (user.department_id) {
    const dept = get("SELECT id FROM communities WHERE type = 'department' AND department_id = ?", user.department_id);
    if (dept) joinCommunity(dept.id, user.id);
  }
  const batchId = ensureBatchCommunity(user);
  if (batchId) joinCommunity(batchId, user.id);
}
