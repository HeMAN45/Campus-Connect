import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock3, HelpCircle, Inbox, Megaphone, PackageSearch, Sparkles, HandHelping, MessageSquare } from 'lucide-react';
import PostCard from '../components/post/PostCard.jsx';
import RightRail, { EventStrip, useUpcomingEvents } from '../components/layout/RightRail.jsx';
import { Avatar, Banner, EmptyState, ErrorState, PostSkeleton, Spinner } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { usePaged, useInfiniteScroll } from '../lib/hooks.js';
import { FEED_TABS } from '../lib/postTypes.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useComposer } from '../context/ComposerContext.jsx';

function QuickCompose() {
  const { user, permissions } = useAuth();
  const open = useComposer();
  const teacher = permissions.isVerifiedTeacher || permissions.isAdmin;
  const actions = teacher
    ? [
        { type: 'announcement', label: 'Announcement', icon: Megaphone },
        ...(permissions.canPostEvents ? [{ type: 'event', label: 'Event', icon: CalendarDays }] : []),
        { type: 'general', label: 'Post', icon: MessageSquare },
      ]
    : [
        { type: 'doubt', label: 'Ask a doubt', icon: HelpCircle },
        { type: 'request', label: 'Request', icon: HandHelping },
        { type: 'lost', label: 'Lost or found', icon: PackageSearch },
        ...(permissions.canPostEvents ? [{ type: 'event', label: 'Event', icon: CalendarDays }] : []),
      ];
  return (
    <div className="card p-3 md:p-4 max-md:rounded-none max-md:border-x-0">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={40} />
        <button className="flex-1 min-w-0 h-11 px-4 text-left rounded border border-line bg-surface-2 text-ink-3 hover:border-line-strong truncate" onClick={() => open()}>
          {teacher ? 'Share an update with students...' : (
            <>
              <span className="sm:hidden">What do you need help with?</span>
              <span className="hidden sm:inline">Ask a doubt, request something, or share an update...</span>
            </>
          )}
        </button>
      </div>
      <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
        {actions.map((a) => (
          <button key={a.type} className="chip shrink-0" onClick={() => open({ type: a.type })}>
            <a.icon size={16} aria-hidden="true" /> {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WelcomeCard() {
  const { user } = useAuth();
  const key = `cc-welcome-${user.id}`;
  const [show, setShow] = useState(() => !localStorage.getItem(key) && Date.now() - new Date(user.createdAt).getTime() < 3 * 86400000);
  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem(key, '1');
    setShow(false);
  };
  return (
    <Banner tone="info" icon={Sparkles} onDismiss={dismiss}>
      <p className="font-semibold">Welcome to Campus Connect, {user.name.split(' ')[0]}.</p>
      <p className="text-ink-2 mt-0.5">
        {user.role === 'student'
          ? "You've been added to your department and batch communities. Complete your profile so seniors and faculty can find you."
          : 'Add your cabin, office hours, and subjects so students can find you in the Directory.'}
      </p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <Link to="/settings/profile" className="btn-primary btn-sm" onClick={dismiss}>
          Complete profile
        </Link>
        <Link to="/communities" className="btn-secondary btn-sm" onClick={dismiss}>
          Find communities
        </Link>
      </div>
    </Banner>
  );
}

function SubFilters({ tab, params, set }) {
  const [subjects, setSubjects] = useState([]);
  useEffect(() => {
    if (tab !== 'doubts') return;
    api('/posts/subjects')
      .then((r) => setSubjects(r.items))
      .catch(() => {});
  }, [tab]);
  const chip = (on) => (on ? 'chip-on shrink-0' : 'chip shrink-0');
  if (tab === 'doubts') {
    return (
      <>
        <button className={chip(params.get('unanswered') === '1')} onClick={() => set({ unanswered: params.get('unanswered') === '1' ? null : '1' })}>
          Unanswered
        </button>
        <span className="w-px bg-line shrink-0" aria-hidden="true" />
        {subjects.map((s) => (
          <button key={s.tag} className={chip(params.get('subject') === s.tag)} onClick={() => set({ subject: params.get('subject') === s.tag ? null : s.tag })}>
            {s.tag}
          </button>
        ))}
      </>
    );
  }
  if (tab === 'lostfound') {
    const kind = params.get('kind');
    return (
      <>
        {[
          [null, 'All'],
          ['lost', 'Lost'],
          ['found', 'Found'],
        ].map(([k, label]) => (
          <button key={label} className={chip(kind === k)} onClick={() => set({ kind: k })}>
            {label}
          </button>
        ))}
        <span className="w-px bg-line shrink-0" aria-hidden="true" />
        <button className={chip(params.get('resolved') === '1')} onClick={() => set({ resolved: params.get('resolved') === '1' ? null : '1' })}>
          Show resolved
        </button>
      </>
    );
  }
  if (tab === 'requests') {
    return (
      <button className={chip(params.get('resolved') === '1')} onClick={() => set({ resolved: params.get('resolved') === '1' ? null : '1' })}>
        Show fulfilled
      </button>
    );
  }
  if (tab === 'events') {
    const when = params.get('when') || 'upcoming';
    return ['upcoming', 'past'].map((w) => (
      <button key={w} className={chip(when === w)} onClick={() => set({ when: w === 'upcoming' ? null : w })}>
        {w === 'upcoming' ? 'Upcoming' : 'Past'}
      </button>
    ));
  }
  return null;
}

const EMPTY = {
  all: ['Nothing here yet', 'Be the first to post something for campus.'],
  announcements: ['No announcements', 'Faculty and club announcements will show up here.'],
  events: ['No events', 'Club events will show up here for everyone.'],
  doubts: ['No doubts here', 'Stuck on something? Ask it. Classmates, seniors, and faculty can answer.'],
  requests: ['No open requests', 'Need to borrow a calculator or a lab coat? Ask here.'],
  lostfound: ['No lost or found items', 'Lost something? Post it with a photo and the place.'],
};

export default function Home() {
  const { user } = useAuth();
  const openComposer = useComposer();
  const [params, setParams] = useSearchParams();
  const tab = FEED_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'all';
  const sort = params.get('sort') || 'hot';
  const events = useUpcomingEvents(5);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v === null || v === undefined ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  const showResolved = params.get('resolved') === '1';
  const query = {
    tab,
    sort: tab === 'events' ? 'new' : sort,
    subject: tab === 'doubts' ? params.get('subject') : null,
    unanswered: tab === 'doubts' && params.get('unanswered') === '1',
    kind: tab === 'lostfound' ? params.get('kind') : null,
    status: (tab === 'lostfound' || tab === 'requests') && !showResolved ? 'open' : null,
    when: tab === 'events' ? params.get('when') || 'upcoming' : null,
  };
  const key = JSON.stringify(query);

  const feed = usePaged(
    async (cursor) => {
      const r = await api(`/posts${qs({ ...query, cursor })}`);
      return { items: r.items, next: r.nextCursor, extra: r.pinned };
    },
    [key],
  );
  const sentinel = useInfiniteScroll(
    useCallback(() => feed.loadMore(), [feed]),
    feed.hasMore && !feed.loading,
  );
  const pinned = feed.extra || [];

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 max-w-[720px] mx-auto xl:mx-0">
        <div className="space-y-3 mb-4">
          {user.pending && (
            <Banner tone="warning" icon={Clock3}>
              Your faculty account is waiting for verification by the admin. You can comment and message now. Announcements unlock after approval.
            </Banner>
          )}
          <WelcomeCard />
          <QuickCompose />
        </div>

        <div className="xl:hidden">
          <EventStrip items={events} />
        </div>

        <div className="sticky top-16 z-20 bg-bg -mx-0 pt-1 pb-3 max-md:px-3">
          <div role="tablist" aria-label="Feed" className="flex gap-1 overflow-x-auto scrollbar-none border-b border-line">
            {FEED_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setParams(t.id === 'all' ? {} : { tab: t.id }, { replace: true })}
                className={`shrink-0 h-11 px-3 text-ui font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1">
              <SubFilters tab={tab} params={params} set={set} />
            </div>
            {tab !== 'events' && (
              <label className="flex items-center gap-2 text-meta text-ink-2 shrink-0">
                <span className="hidden sm:inline">Sort</span>
                <select className="select h-8 py-0 text-meta w-[118px]" value={sort} onChange={(e) => set({ sort: e.target.value === 'hot' ? null : e.target.value })} aria-label="Sort posts">
                  <option value="hot">Hot</option>
                  <option value="new">New</option>
                  <option value="top">Top this week</option>
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {pinned.map((p) => (
            <PostCard key={`pin-${p.id}`} post={p} />
          ))}
          {feed.items.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {feed.loading && feed.items.length === 0 && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
          {feed.error && <ErrorState error={feed.error} onRetry={feed.reload} />}
          {!feed.loading && !feed.error && feed.items.length === 0 && pinned.length === 0 && (
            <EmptyState
              icon={Inbox}
              title={EMPTY[tab][0]}
              text={EMPTY[tab][1]}
              action={
                <button className="btn-primary" onClick={() => openComposer(tab === 'doubts' ? { type: 'doubt' } : tab === 'requests' ? { type: 'request' } : tab === 'lostfound' ? { type: 'lost' } : {})}>
                  Create a post
                </button>
              }
            />
          )}
          <div ref={sentinel} />
          {feed.loading && feed.items.length > 0 && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
          {!feed.hasMore && feed.items.length > 5 && <p className="text-center text-meta text-ink-3 py-6">You're all caught up.</p>}
        </div>
      </div>
      <RightRail events={events} />
    </div>
  );
}
