import { get, all, placeholders, parseJson, nowIso } from '../db/index.js';

// Columns for a compact user, aliased with a prefix so they can sit next to other tables' columns.
export const miniCols = (u, d, p) =>
  `${u}.id AS ${p}id, ${u}.name AS ${p}name, ${u}.avatar_url AS ${p}avatar_url, ${u}.role AS ${p}role, ` +
  `${u}.status AS ${p}status, ${u}.designation AS ${p}designation, ${u}.year AS ${p}year, ` +
  `${u}.open_to_mentor AS ${p}open_to_mentor, ${d}.code AS ${p}dept`;

export function miniFrom(row, p) {
  if (!row[`${p}id`]) return null;
  return {
    id: row[`${p}id`],
    name: row[`${p}name`],
    avatarUrl: row[`${p}avatar_url`],
    role: row[`${p}role`],
    verified: row[`${p}role`] === 'teacher' && row[`${p}status`] === 'active',
    pending: row[`${p}role`] === 'teacher' && row[`${p}status`] === 'pending',
    designation: row[`${p}designation`] || null,
    year: row[`${p}year`] || null,
    mentor: !!row[`${p}open_to_mentor`],
    dept: row[`${p}dept`] || null,
  };
}

export const loadMini = (id) =>
  miniFrom(
    get(`SELECT ${miniCols('u', 'd', 'x_')} FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?`, id) || {},
    'x_',
  );

export function userProfile(u, viewer) {
  const dept = u.department_id ? get('SELECT id, code, name FROM departments WHERE id = ?', u.department_id) : null;
  const canSeePrivate = viewer && (viewer.id === u.id || viewer.role === 'admin');
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar_url,
    role: u.role,
    status: u.status,
    verified: u.role === 'teacher' && u.status === 'active',
    pending: u.role === 'teacher' && u.status === 'pending',
    bio: u.bio,
    dept: dept?.code || null,
    department: dept,
    program: u.program,
    year: u.year,
    section: u.section,
    graduationYear: u.graduation_year,
    designation: u.designation,
    officeLocation: u.office_location,
    officeHours: u.office_hours,
    subjects: parseJson(u.subjects),
    skills: parseJson(u.skills),
    githubUrl: u.github_url,
    linkedinUrl: u.linkedin_url,
    mentor: !!u.open_to_mentor,
    openToMentor: !!u.open_to_mentor,
    mentorTopics: parseJson(u.mentor_topics),
    lastSeenAt: u.last_seen_at,
    createdAt: u.created_at,
    ...(canSeePrivate ? { enrollmentNo: u.enrollment_no, suspendedUntil: u.suspended_until } : {}),
  };
}

export const POST_SELECT = `
  SELECT p.*, ${miniCols('u', 'ud', 'a_')},
         c.slug AS c_slug, c.name AS c_name, c.type AS c_type, c.avatar_url AS c_avatar_url
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN departments ud ON ud.id = u.department_id
  LEFT JOIN communities c ON c.id = p.community_id`;

export function hydratePosts(rows, viewer) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ph = placeholders(ids.length);
  const images = new Map();
  for (const im of all(`SELECT post_id, url, alt_text, width, height FROM post_images WHERE post_id IN (${ph}) ORDER BY post_id, position`, ...ids)) {
    if (!images.has(im.post_id)) images.set(im.post_id, []);
    images.get(im.post_id).push({ url: im.url, alt: im.alt_text, width: im.width, height: im.height });
  }
  const votes = new Map(all(`SELECT post_id, value FROM post_votes WHERE user_id = ? AND post_id IN (${ph})`, viewer.id, ...ids).map((v) => [v.post_id, v.value]));
  const rsvps = new Map(all(`SELECT post_id, status FROM event_rsvps WHERE user_id = ? AND post_id IN (${ph})`, viewer.id, ...ids).map((v) => [v.post_id, v.status]));
  const now = nowIso();
  return rows.map((r) => {
    const communityRole = r.community_id
      ? get('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?', r.community_id, r.author_id)?.role
      : null;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      status: r.status,
      resolvedAt: r.resolved_at,
      isPinned: !!r.is_pinned && (!r.pinned_until || r.pinned_until > now),
      commentsLocked: !!r.comments_locked,
      isHidden: !!r.is_hidden,
      subjectTag: r.subject_tag,
      acceptedCommentId: r.accepted_comment_id,
      neededBy: r.needed_by,
      item: r.type === 'lost' || r.type === 'found' ? { location: r.item_location, date: r.item_date } : null,
      event:
        r.type === 'event'
          ? {
              startsAt: r.event_starts_at,
              endsAt: r.event_ends_at,
              venue: r.event_venue,
              url: r.event_url,
              goingCount: r.going_count,
              interestedCount: r.interested_count,
              myRsvp: rsvps.get(r.id) || null,
            }
          : null,
      score: r.score,
      myVote: votes.get(r.id) || 0,
      commentCount: r.comment_count,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      author: { ...miniFrom(r, 'a_'), communityRole: communityRole && communityRole !== 'member' ? communityRole : null },
      community: r.community_id ? { id: r.community_id, slug: r.c_slug, name: r.c_name, type: r.c_type, avatarUrl: r.c_avatar_url } : null,
      images: images.get(r.id) || [],
    };
  });
}

export const loadPost = (id, viewer) => {
  const row = get(`${POST_SELECT} WHERE p.id = ?`, id);
  return row ? hydratePosts([row], viewer)[0] : null;
};

export function serializeCommunity(c, myRole = null) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    rules: c.rules,
    type: c.type,
    status: c.status,
    avatarUrl: c.avatar_url,
    coverUrl: c.cover_url,
    memberCount: c.member_count,
    isVerified: !!c.is_verified,
    departmentId: c.department_id,
    createdAt: c.created_at,
    myRole,
  };
}

export const COMMENT_SELECT = `
  SELECT cm.*, ${miniCols('u', 'ud', 'a_')}
  FROM comments cm
  JOIN users u ON u.id = cm.author_id
  LEFT JOIN departments ud ON ud.id = u.department_id`;

export function serializeComment(r, { myVote = 0, acceptedId = null, communityRole = null, viewer } = {}) {
  const deleted = !!r.deleted_at;
  const hidden = !!r.is_hidden && viewer && viewer.id !== r.author_id && viewer.role !== 'admin';
  return {
    id: r.id,
    postId: r.post_id,
    parentId: r.parent_id,
    body: deleted ? '' : hidden ? 'This comment is under review.' : r.body,
    image: deleted || hidden || !r.image_url ? null : { url: r.image_url, alt: r.image_alt },
    author: deleted ? null : { ...miniFrom(r, 'a_'), communityRole: communityRole && communityRole !== 'member' ? communityRole : null },
    score: r.score,
    myVote,
    isAccepted: acceptedId === r.id,
    isDeleted: deleted,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    replies: [],
  };
}

export function serializeMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    body: m.deleted_at ? '' : m.body,
    image: m.deleted_at || !m.image_url ? null : { url: m.image_url },
    isDeleted: !!m.deleted_at,
    clientId: m.client_id,
    createdAt: m.created_at,
  };
}

export const NOTIFICATION_SELECT = `
  SELECT n.*, a.name AS actor_name, a.avatar_url AS actor_avatar_url,
         p.title AS post_title, p.type AS post_type,
         c.name AS community_name, c.slug AS community_slug
  FROM notifications n
  LEFT JOIN users a ON a.id = n.actor_id
  LEFT JOIN posts p ON p.id = n.post_id
  LEFT JOIN communities c ON c.id = n.community_id`;

export function serializeNotification(n) {
  return {
    id: n.id,
    type: n.type,
    actor: n.actor_id ? { id: n.actor_id, name: n.actor_name, avatarUrl: n.actor_avatar_url } : null,
    actorCount: n.actor_count,
    post: n.post_id ? { id: n.post_id, title: n.post_title, type: n.post_type } : null,
    commentId: n.comment_id,
    community: n.community_id ? { id: n.community_id, name: n.community_name, slug: n.community_slug } : null,
    data: parseJson(n.data, {}),
    read: !!n.read_at,
    createdAt: n.updated_at,
  };
}
