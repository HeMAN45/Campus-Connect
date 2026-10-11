import { MessageSquare, HelpCircle, HandHelping, SearchX, PackageCheck, Megaphone, CalendarDays } from 'lucide-react';

export const POST_TYPES = {
  general: {
    label: 'Post',
    name: 'General',
    hint: 'Share something with campus',
    icon: MessageSquare,
    hex: '#4A5058',
    tag: 'text-ink-2 border-ink-2/40 bg-[#F1F1EE]',
  },
  doubt: {
    label: 'Doubt',
    name: 'Doubt',
    hint: 'Ask an academic question',
    icon: HelpCircle,
    hex: '#1F4E8C',
    tag: 'text-accent border-accent/40 bg-accent-soft',
  },
  request: {
    label: 'Request',
    name: 'Request',
    hint: 'Need to borrow something?',
    icon: HandHelping,
    hex: '#8A5A00',
    tag: 'text-warning border-warning/40 bg-warning-soft',
  },
  lost: {
    label: 'Lost',
    name: 'Lost',
    hint: 'Lost an item on campus',
    icon: SearchX,
    hex: '#A23B32',
    tag: 'text-danger border-danger/40 bg-danger-soft',
  },
  found: {
    label: 'Found',
    name: 'Found',
    hint: "Found something that isn't yours",
    icon: PackageCheck,
    hex: '#2F6B3F',
    tag: 'text-success border-success/40 bg-success-soft',
  },
  announcement: {
    label: 'Announcement',
    name: 'Announcement',
    hint: 'Official update for students',
    icon: Megaphone,
    hex: '#1E2227',
    tag: 'text-ink border-ink/50 bg-[#ECECE7]',
  },
  event: {
    label: 'Event',
    name: 'Event',
    hint: 'Workshop, talk, fest, or meetup',
    icon: CalendarDays,
    hex: '#5B3F8C',
    tag: 'text-event border-event/40 bg-event-soft',
  },
};

export const TYPE_ORDER = ['doubt', 'request', 'lost', 'found', 'general', 'announcement', 'event'];

export function resolvedLabel(post) {
  if (post.status !== 'resolved') return null;
  return { doubt: 'Answered', request: 'Fulfilled', lost: 'Resolved', found: 'Returned' }[post.type] || 'Resolved';
}

export const FEED_TABS = [
  { id: 'all', label: 'All' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'events', label: 'Events' },
  { id: 'doubts', label: 'Doubts' },
  { id: 'requests', label: 'Requests' },
  { id: 'lostfound', label: 'Lost & Found' },
];
