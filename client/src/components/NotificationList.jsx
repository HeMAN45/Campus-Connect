import { Link } from 'react-router-dom';
import { BadgeCheck, CalendarDays, CheckCircle2, CornerDownRight, Megaphone, MessageCircle, ShieldAlert, Users } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { timeAgo } from '../lib/format.js';

const q = (t) => (t ? `"${t}"` : 'your post');

export function describe(n) {
  const who = n.actor?.name || 'Someone';
  const others = n.actorCount > 1 ? ` and ${n.actorCount - 1} other${n.actorCount > 2 ? 's' : ''}` : '';
  switch (n.type) {
    case 'post_comment':
      return { icon: MessageCircle, text: `${who}${others} ${n.post?.type === 'doubt' ? 'answered your doubt' : 'commented on'} ${q(n.post?.title)}` };
    case 'comment_reply':
      return { icon: CornerDownRight, text: `${who} replied to your comment on ${q(n.post?.title)}` };
    case 'answer_accepted':
      return { icon: CheckCircle2, text: `${who} accepted your answer on ${q(n.post?.title)}` };
    case 'announcement':
      return { icon: Megaphone, text: `New announcement from ${who}: ${n.post?.title || ''}` };
    case 'community_announcement':
      return { icon: Megaphone, text: `${n.community?.name}: ${n.post?.title || 'new announcement'}` };
    case 'community_event':
      return { icon: CalendarDays, text: `${n.community?.name} posted an event: ${n.post?.title || ''}` };
    case 'teacher_approved':
      return { icon: BadgeCheck, text: 'Your faculty account is verified. You can now post announcements.' };
    case 'teacher_rejected':
      return { icon: ShieldAlert, text: `Your faculty verification was not approved, so this is now a student account.${n.data?.reason ? ` Reason: ${n.data.reason}` : ''}` };
    case 'community_approved':
      return { icon: Users, text: `Your community "${n.data?.name || n.community?.name}" was approved. You're its admin.` };
    case 'community_rejected':
      return { icon: Users, text: `Your community request "${n.data?.name}" was not approved.${n.data?.reason ? ` Reason: ${n.data.reason}` : ''}` };
    case 'content_removed':
      return { icon: ShieldAlert, text: `A moderator removed your ${n.data?.kind || 'content'}${n.data?.title ? ` "${n.data.title}"` : ''}.` };
    default:
      return { icon: MessageCircle, text: 'New activity' };
  }
}

export function linkFor(n) {
  if (n.post) return `/post/${n.post.id}${n.commentId ? `#c-${n.commentId}` : ''}`;
  if (n.community?.slug) return `/c/${n.community.slug}`;
  if (n.type.startsWith('teacher_')) return '/settings/profile';
  return '/notifications';
}

export default function NotificationList({ items, onOpen, compact = false }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const { icon: Icon, text } = describe(n);
        return (
          <li key={n.id}>
            <Link
              to={linkFor(n)}
              onClick={() => onOpen?.(n)}
              className={`flex items-start gap-3 px-4 ${compact ? 'py-3' : 'py-3.5'} hover:bg-surface-2 ${n.read ? '' : 'bg-accent-soft/60'}`}
            >
              {n.actor ? (
                <Avatar user={n.actor} size={36} />
              ) : (
                <span className="h-9 w-9 rounded-full bg-surface-2 border border-line inline-flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-ink-2" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-ui ${n.read ? 'text-ink-2' : 'text-ink'} ${compact ? 'line-clamp-2' : ''}`}>{text}</p>
                <p className="text-meta text-ink-3 mt-0.5 flex items-center gap-1.5">
                  <Icon size={13} aria-hidden="true" />
                  {timeAgo(n.createdAt)}
                </p>
              </div>
              {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-accent mt-2 shrink-0" aria-label="Unread" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
