import { get, all } from '../db/index.js';
import { forbidden, badRequest, notFound } from '../middleware/errors.js';

export const isAdmin = (u) => u.role === 'admin';
export const isVerifiedTeacher = (u) => u.role === 'teacher' && u.status === 'active';
export const isPendingTeacher = (u) => u.role === 'teacher' && u.status === 'pending';

export const memberRole = async (communityId, userId) =>
  (await get('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?', communityId, userId))?.role || null;

export const isCommunityMod = async (communityId, user) =>
  isAdmin(user) || ['moderator', 'admin'].includes(await memberRole(communityId, user.id));

export const isCommunityAdmin = async (communityId, user) => isAdmin(user) || (await memberRole(communityId, user.id)) === 'admin';

export async function permissionsFor(user) {
  const modOf = (await all(
    "SELECT community_id FROM community_members WHERE user_id = ? AND role IN ('moderator','admin')",
    user.id,
  )).map((r) => r.community_id);
  return {
    isAdmin: isAdmin(user),
    isVerifiedTeacher: isVerifiedTeacher(user),
    isPendingTeacher: isPendingTeacher(user),
    canPostCampusAnnouncement: isAdmin(user) || isVerifiedTeacher(user),
    canCreateCommunity: isAdmin(user) || isVerifiedTeacher(user),
    canPostEvents: isAdmin(user) || isVerifiedTeacher(user) || modOf.length > 0,
    modCommunityIds: modOf,
  };
}

const pendingError = () => forbidden('Available after your faculty account is verified.', 'PENDING_APPROVAL');

export async function assertCanCreatePost(user, type, community) {
  if (community) {
    if (community.status !== 'active') throw notFound('Community not found.');
    const role = await memberRole(community.id, user.id);
    const mod = isAdmin(user) || role === 'moderator' || role === 'admin';
    if (!role && !isAdmin(user)) throw forbidden(`Join ${community.name} to post there.`, 'NOT_MEMBER');
    if (community.type === 'official' && !mod && !(type === 'announcement' && isVerifiedTeacher(user))) {
      throw forbidden('Only moderators can post in official communities.');
    }
    if (type === 'announcement' || type === 'event') {
      if (mod || isVerifiedTeacher(user)) return;
      if (isPendingTeacher(user)) throw pendingError();
      throw forbidden(
        type === 'event'
          ? 'Only club leads, moderators, and faculty can post events here.'
          : 'Only moderators and faculty can post announcements here.',
      );
    }
    return;
  }
  if (type === 'event') throw badRequest('Choose the community hosting this event.', { communityId: 'Choose a community' });
  if (type === 'announcement') {
    if (isAdmin(user) || isVerifiedTeacher(user)) return;
    if (isPendingTeacher(user)) throw pendingError();
    throw forbidden('Only verified faculty can post campus-wide announcements.');
  }
}

export async function canPin(post, user) {
  if (isAdmin(user)) return true;
  if (post.community_id) return isCommunityMod(post.community_id, user);
  return post.type === 'announcement' && post.author_id === user.id && isVerifiedTeacher(user);
}

export async function canModerate(post, user) {
  if (isAdmin(user)) return true;
  return post.community_id ? isCommunityMod(post.community_id, user) : false;
}

export async function isBlockedBetween(a, b) {
  return !!(await get(
    'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
    a,
    b,
    b,
    a,
  ));
}
