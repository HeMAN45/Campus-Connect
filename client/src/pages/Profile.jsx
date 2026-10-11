import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, BookOpen, Clock, Copy, Flag, Github, Inbox, Linkedin, Mail, MapPin, Pencil, Send } from 'lucide-react';
import PostCard from '../components/post/PostCard.jsx';
import ReportModal from '../components/ReportModal.jsx';
import { Avatar, ConfirmModal, EmptyState, ErrorState, Menu, PageLoader, PostSkeleton, RoleBadges } from '../components/ui.jsx';
import { CommunityAvatar, TYPE_LABEL } from './Communities.jsx';
import { roleLine } from '../components/UserCard.jsx';
import { api, qs } from '../lib/api.js';
import { usePaged, useInfiniteScroll } from '../lib/hooks.js';
import { openConversation } from '../lib/dm.js';
import { yearLong, timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon size={18} className="text-ink-2 mt-[3px] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-meta text-ink-2">{label}</p>
        <div className="text-ink">{children}</div>
      </div>
    </div>
  );
}

function UserPosts({ userId }) {
  const feed = usePaged(
    async (cursor) => {
      const r = await api(`/posts${qs({ authorId: userId, sort: 'new', cursor })}`);
      return { items: r.items, next: r.nextCursor };
    },
    [userId],
  );
  const sentinel = useInfiniteScroll(
    useCallback(() => feed.loadMore(), [feed]),
    feed.hasMore && !feed.loading,
  );
  return (
    <div className="space-y-3">
      {feed.items.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {feed.loading && !feed.items.length && <PostSkeleton />}
      {!feed.loading && !feed.items.length && <EmptyState icon={Inbox} title="No posts yet" />}
      <div ref={sentinel} />
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('posts');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/users/${id}`));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [id]);
  useEffect(() => {
    setData(null);
    setTab('posts');
    load();
  }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader />;

  const { user: u, communities, stats, isBlocked, hasBlockedYou } = data;
  const self = u.id === me.id;
  const faculty = u.role === 'teacher';

  const message = async () => {
    try {
      await openConversation(navigate, u.id);
    } catch (e) {
      toast(e.message);
    }
  };
  const toggleBlock = async () => {
    await api(`/users/${u.id}/block`, { method: isBlocked ? 'DELETE' : 'POST' });
    setData((d) => ({ ...d, isBlocked: !isBlocked }));
    toast(isBlocked ? `Unblocked ${u.name}` : `Blocked ${u.name}. They can't message you.`);
  };

  return (
    <div className="max-w-[860px]">
      <section className="card p-4 md:p-6 max-md:rounded-none max-md:border-x-0">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <Avatar user={u} size={88} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-h1 font-bold">{u.name}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <RoleBadges user={u} showYear={false} showMentor />
                  {u.pending && <span className="tag text-warning border-warning/40 bg-warning-soft">Verification pending</span>}
                </div>
                <p className="text-ink-2 mt-1.5">{roleLine(u)}</p>
              </div>
              {!self && (
                <Menu
                  label="Profile options"
                  items={[
                    { label: isBlocked ? 'Unblock' : 'Block', icon: Ban, onClick: () => (isBlocked ? toggleBlock() : setModal('block')) },
                    { label: 'Report profile', icon: Flag, onClick: () => setModal('report') },
                  ]}
                />
              )}
            </div>
            {u.bio && <p className="mt-3 text-ink max-w-2xl">{u.bio}</p>}
            <div className="mt-4 flex gap-2 flex-wrap">
              {self ? (
                <Link to="/settings/profile" className="btn-secondary">
                  <Pencil size={16} /> Edit profile
                </Link>
              ) : hasBlockedYou ? (
                <p className="text-meta text-ink-3">You can't message this person.</p>
              ) : (
                <button className="btn-primary" onClick={message} disabled={isBlocked}>
                  <Send size={16} /> Message
                </button>
              )}
            </div>
          </div>
        </div>

        {faculty && (
          <div className="mt-6 p-4 rounded-sm border border-line bg-surface-2">
            <h2 className="section-label mb-3">Find me</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Row icon={MapPin} label="Cabin">
                <span className="text-title font-semibold">{u.officeLocation || 'Not added yet'}</span>
              </Row>
              <Row icon={Clock} label="Office hours">
                {u.officeHours || 'Not added yet'}
              </Row>
              <Row icon={Mail} label="Email">
                <span className="flex items-center gap-2 min-w-0">
                  <a href={`mailto:${u.email}`} className="link truncate">
                    {u.email}
                  </a>
                  <button
                    className="btn-icon h-8 w-8 shrink-0"
                    aria-label="Copy email"
                    onClick={() => {
                      navigator.clipboard?.writeText(u.email);
                      toast('Email copied');
                    }}
                  >
                    <Copy size={15} />
                  </button>
                </span>
              </Row>
              {u.subjects.length > 0 && (
                <Row icon={BookOpen} label="Teaches">
                  <ul>
                    {u.subjects.map((s) => (
                      <li key={s.name}>
                        {s.name}
                        {s.year ? <span className="text-ink-2"> ({yearLong(s.year)})</span> : null}
                      </li>
                    ))}
                  </ul>
                </Row>
              )}
            </div>
          </div>
        )}

        {!faculty && (u.skills.length > 0 || u.mentor || u.githubUrl || u.linkedinUrl) && (
          <div className="mt-6 space-y-4">
            {u.mentor && u.mentorTopics.length > 0 && (
              <div className="p-4 rounded-sm border border-success/30 bg-success-soft/50">
                <p className="font-semibold text-success">Open to mentoring juniors</p>
                <p className="text-ink mt-1">Can help with: {u.mentorTopics.join(', ')}</p>
              </div>
            )}
            {u.skills.length > 0 && (
              <div>
                <h2 className="section-label mb-2">Skills</h2>
                <ul className="flex flex-wrap gap-2">
                  {u.skills.map((s) => (
                    <li key={s} className="tag text-ink-2 border-line bg-surface normal-case tracking-normal text-meta font-medium">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(u.githubUrl || u.linkedinUrl) && (
              <div className="flex gap-2 flex-wrap">
                {u.githubUrl && (
                  <a href={u.githubUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary btn-sm">
                    <Github size={15} /> GitHub
                  </a>
                )}
                {u.linkedinUrl && (
                  <a href={u.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary btn-sm">
                    <Linkedin size={15} /> LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-meta text-ink-3">
          {stats.posts} {stats.posts === 1 ? 'post' : 'posts'}
          {stats.answersAccepted > 0 && ` . ${stats.answersAccepted} accepted ${stats.answersAccepted === 1 ? 'answer' : 'answers'}`} . Joined {timeAgo(u.createdAt)}
          {self && u.enrollmentNo && ` . Enrollment ${u.enrollmentNo} (only you see this)`}
        </p>
      </section>

      <div role="tablist" className="flex gap-1 border-b border-line mt-5 mb-4 px-3 md:px-0">
        {[
          ['posts', 'Posts'],
          ['communities', `Communities (${communities.length})`],
        ].map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-11 px-3 text-ui font-medium border-b-2 -mb-px ${tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'posts' && <UserPosts userId={u.id} />}
      {tab === 'communities' &&
        (communities.length ? (
          <ul className="grid sm:grid-cols-2 gap-3 px-3 md:px-0">
            {communities.map((c) => (
              <li key={c.id}>
                <Link to={`/c/${c.slug}`} className="card p-3 flex items-center gap-3 hover:border-line-strong">
                  <CommunityAvatar c={c} size={40} />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{c.name}</span>
                    <span className="block text-meta text-ink-2">
                      {TYPE_LABEL[c.type]}
                      {c.memberRole !== 'member' && ` . ${c.memberRole === 'admin' ? (c.type === 'club' ? 'Club lead' : 'Admin') : 'Moderator'}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No communities yet" />
        ))}

      {modal === 'report' && <ReportModal targetType="user" targetId={u.id} onClose={() => setModal(null)} />}
      {modal === 'block' && (
        <ConfirmModal
          title={`Block ${u.name}?`}
          text="They won't be able to message you or find you in the directory. You can unblock them anytime from Account and app."
          confirmLabel="Block"
          danger
          onClose={() => setModal(null)}
          onConfirm={toggleBlock}
        />
      )}
    </div>
  );
}
