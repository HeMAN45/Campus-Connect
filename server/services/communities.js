import { get, all, run } from '../db/index.js';
import { admissionYear } from './reference.js';

export async function joinCommunity(communityId, userId, role = 'member') {
  const r = await run('INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', communityId, userId, role);
  if (r.changes) await run('UPDATE communities SET member_count = member_count + 1 WHERE id = ?', communityId);
  return r.changes > 0;
}

export async function leaveCommunity(communityId, userId) {
  const r = await run('DELETE FROM community_members WHERE community_id = ? AND user_id = ?', communityId, userId);
  if (r.changes) await run('UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = ?', communityId);
  return r.changes > 0;
}

async function ensureBatchCommunity(user) {
  if (user.role !== 'student' || !user.department_id || !user.graduation_year) return null;
  const existing = await get(
    "SELECT id FROM communities WHERE type = 'batch' AND department_id = ? AND graduation_year = ?",
    user.department_id,
    user.graduation_year,
  );
  if (existing) return existing.id;
  const dept = await get('SELECT code, name FROM departments WHERE id = ?', user.department_id);
  const admitted = admissionYear(user.program, user.graduation_year);
  let slug = `${dept.code.toLowerCase()}-${admitted}`;
  if (await get('SELECT 1 FROM communities WHERE slug = ?', slug)) slug = `${slug}-${user.graduation_year}`;
  return (await run(
    `INSERT INTO communities (slug, name, description, type, department_id, graduation_year, is_verified)
     VALUES (?, ?, ?, 'batch', ?, ?, 1)`,
    slug,
    `${dept.code} ${admitted} Batch`,
    `${dept.name} students admitted in ${admitted}. Class updates, notes, and plans.`,
    user.department_id,
    user.graduation_year,
  )).id;
}

export async function joinDefaultCommunities(user) {
  for (const c of await all("SELECT id FROM communities WHERE auto_join = 1 AND status = 'active'")) await joinCommunity(c.id, user.id);
  if (user.department_id) {
    const dept = await get("SELECT id FROM communities WHERE type = 'department' AND department_id = ?", user.department_id);
    if (dept) await joinCommunity(dept.id, user.id);
  }
  const batchId = await ensureBatchCommunity(user);
  if (batchId) await joinCommunity(batchId, user.id);
}
