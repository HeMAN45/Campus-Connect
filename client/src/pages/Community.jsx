import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock3, Inbox, Plus, Settings, UserMinus, Users } from 'lucide-react';
import PostCard from '../components/post/PostCard.jsx';
import { Avatar, Banner, EmptyState, ErrorState, Field, Modal, PageLoader, PostSkeleton, Spinner, UserName } from '../components/ui.jsx';
import { CommunityAvatar, JoinButton, TYPE_LABEL } from './Communities.jsx';
import Linkify from '../components/Linkify.jsx';
import { api, qs, toForm } from '../lib/api.js';
import { useDebounced, useInfiniteScroll, usePaged } from '../lib/hooks.js';
import { useComposer } from '../context/ComposerContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function Feed({ community, query, emptyTitle, emptyText }) {
  const key = JSON.stringify(query);
  const feed = usePaged(
    async (cursor) => {
      const r = await api(`/posts${qs({ ...query, communityId: community.id, cursor })}`);
      return { items: r.items, next: r.nextCursor, extra: r.pinned };
    },
    [key, community.id],
  );
  const sentinel = useInfiniteScroll(
    useCallback(() => feed.loadMore(), [feed]),
    feed.hasMore && !feed.loading,
  );
  const pinned = feed.extra || [];
  return (
    <div className="space-y-3">
      {pinned.map((p) => (
        <PostCard key={`pin-${p.id}`} post={p} showCommunity={false} />
      ))}
      {feed.items.map((p) => (
        <PostCard key={p.id} post={p} showCommunity={false} />
      ))}
      {feed.loading && !feed.items.length && [0, 1].map((i) => <PostSkeleton key={i} />)}
      {feed.error && <ErrorState error={feed.error} onRetry={feed.reload} />}
      {!feed.loading && !feed.error && !feed.items.length && !pinned.length && <EmptyState icon={Inbox} title={emptyTitle} text={emptyText} />}
      <div ref={sentinel} />
    </div>
  );
}

function Members({ community, canManage }) {
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);

  const load = useCallback(
    async (offset = 0) => {
      const r = await api(`/communities/${community.slug}/members${qs({ q: dq, offset })}`);
      setItems((cur) => (offset ? [...(cur || []), ...r.items] : r.items));
      setNext(r.nextOffset);
    },
    [community.slug, dq],
  );
  useEffect(() => {
    load(0).catch((e) => toast(e.message));
  }, [load, toast]);

  const setRole = async (m, role) => {
    try {
      await api(`/communities/${community.slug}/members/${m.id}`, { method: 'PATCH', body: { role } });
      setItems((list) => list.map((x) => (x.id === m.id ? { ...x, communityRole: role } : x)));
      toast(`${m.name} is now ${role === 'member' ? 'a member' : `a ${role}`}`);
    } catch (e) {
      toast(e.message);
    }
  };
  const remove = async (m) => {
    try {
      await api(`/communities/${community.slug}/members/${m.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((x) => x.id !== m.id));
      toast(`Removed ${m.name}`);
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className="card">
      <div className="p-3 border-b border-line">
        <input type="search" className="input" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
      </div>
      {!items ? (
        <div className="py-8 flex justify-center">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="p-6 text-center text-ink-2">No members found.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar user={m} size={36} />
              <div className="flex-1 min-w-0">
                <UserName user={{ ...m, communityRole: m.communityRole === 'member' ? null : m.communityRole }} communityType={community.type} />
                <p className="text-meta text-ink-2">{m.role === 'teacher' ? m.designation : m.dept}</p>
              </div>
              {canManage && m.id !== user.id && (
                <div className="flex items-center gap-1">
                  <select className="select h-9 w-[132px] text-meta" value={m.communityRole} onChange={(e) => setRole(m, e.target.value)} aria-label={`Role for ${m.name}`}>
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  {m.communityRole === 'member' && community.type !== 'official' && (
                    <button className="btn-icon" onClick={() => remove(m)} aria-label={`Remove ${m.name}`} title="Remove from community">
                      <UserMinus size={18} />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {next !== null && (
        <div className="p-3 border-t border-line">
          <button className="btn-secondary w-full" onClick={() => load(next)}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsModal({ community, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: community.name, description: community.description || '', rules: community.rules || '' });
  const [avatar, setAvatar] = useState(null);
  const [cover, setCover] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api(`/communities/${community.slug}`, { method: 'PATCH', form: toForm(f, { avatar, cover }) });
      onSaved(r.community);
      toast('Community updated');
      onClose();
    } catch (e) {
      setErrors(e.fields || {});
      if (!e.fields) toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Community settings"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="cs-name" label="Name" error={errors.name}>
          <input id="cs-name" className="input" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field id="cs-desc" label="Description" error={errors.description}>
          <textarea id="cs-desc" className="textarea" rows={3} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field id="cs-rules" label="Rules" optional error={errors.rules}>
          <textarea id="cs-rules" className="textarea" rows={4} maxLength={2000} value={f.rules} onChange={(e) => setF({ ...f, rules: e.target.value })} />
        </Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field id="cs-avatar" label="Logo" optional help="Square image works best.">
            <input id="cs-avatar" type="file" accept="image/jpeg,image/png,image/webp" className="block text-meta" onChange={(e) => setAvatar(e.target.files[0] || null)} />
          </Field>
          <Field id="cs-cover" label="Cover image" optional help="Wide image, about 1200 x 320.">
            <input id="cs-cover" type="file" accept="image/jpeg,image/png,image/webp" className="block text-meta" onChange={(e) => setCover(e.target.files[0] || null)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Community() {
  const { slug } = useParams();
  const openComposer = useComposer();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`/communities/${slug}`));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [slug]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader />;

  const { community: c, leaders, canManage } = data;
  const member = !!c.myRole;
  const hasEvents = c.type === 'club' || c.type === 'interest' || c.type === 'official';
  const tabs = [['posts', 'Posts'], ...(hasEvents ? [['events', 'Events']] : []), ['about', 'About'], ['members', 'Members']];
  const tab = tabs.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'posts';
  const setCommunity = (next) => setData((d) => ({ ...d, community: { ...d.community, ...next } }));

  return (
    <div className="max-w-[860px]">
      <div className="card overflow-hidden max-md:rounded-none max-md:border-x-0">
        <div className="h-28 md:h-40 bg-surface-2 border-b border-line">{c.coverUrl && <img src={c.coverUrl} alt="" className="w-full h-full object-cover" />}</div>
        <div className="px-4 md:px-6 pb-5">
          <div className="-mt-7 mb-3">
            <span className="inline-block rounded-sm ring-[3px] ring-surface bg-surface">
              <CommunityAvatar c={c} size={72} />
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-h1 font-bold">{c.name}</h1>
              <p className="text-ink-2 mt-0.5">
                {TYPE_LABEL[c.type]} . {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <button className="btn-icon" onClick={() => setSettings(true)} aria-label="Community settings">
                  <Settings size={20} />
                </button>
              )}
              {member && c.status === 'active' && (
                <button className="btn-secondary" onClick={() => openComposer({ communityId: c.id })}>
                  <Plus size={18} /> New post
                </button>
              )}
              {c.status === 'active' && <JoinButton community={c} onChange={setCommunity} size="" />}
            </div>
          </div>
          {c.description && <p className="mt-3 text-ink-2 max-w-2xl">{c.description}</p>}
        </div>
        <div role="tablist" className="flex gap-1 px-2 md:px-4 border-t border-line overflow-x-auto scrollbar-none">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setParams(id === 'posts' ? {} : { tab: id }, { replace: true })}
              className={`shrink-0 h-12 px-3 text-ui font-medium border-b-2 ${tab === id ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {c.status === 'pending' && (
          <Banner tone="warning" icon={Clock3}>
            This community is waiting for admin approval. It will be visible to everyone once approved.
          </Banner>
        )}
        {!member && c.status === 'active' && tab !== 'about' && (
          <Banner tone="info" icon={Users}>
            Join {c.name} to post and comment. Anyone can read.
          </Banner>
        )}

        {tab === 'posts' && <Feed community={c} query={{ tab: 'all', sort: 'new' }} emptyTitle="No posts yet" emptyText={member ? 'Start the first conversation here.' : 'Join to start the first conversation.'} />}
        {tab === 'events' && (
          <>
            <div className="flex gap-2 max-md:px-3">
              {['upcoming', 'past'].map((w) => (
                <button key={w} className={(params.get('when') || 'upcoming') === w ? 'chip-on' : 'chip'} onClick={() => setParams({ tab: 'events', ...(w === 'past' ? { when: 'past' } : {}) }, { replace: true })}>
                  {w === 'upcoming' ? 'Upcoming' : 'Past events'}
                </button>
              ))}
            </div>
            <Feed community={c} query={{ tab: 'events', when: params.get('when') || 'upcoming' }} emptyTitle="No events" emptyText="Events from this community will show up here and on everyone's home page." />
          </>
        )}
        {tab === 'about' && (
          <div className="card p-4 md:p-6 space-y-6">
            <section>
              <h2 className="section-label mb-2">About</h2>
              <p className="text-ink">{c.description || 'No description yet.'}</p>
            </section>
            {c.rules && (
              <section>
                <h2 className="section-label mb-2">Rules</h2>
                <p className="text-ink">
                  <Linkify text={c.rules} />
                </p>
              </section>
            )}
            <section>
              <h2 className="section-label mb-3">Leads and moderators</h2>
              {leaders.length === 0 ? (
                <p className="text-ink-2">None yet.</p>
              ) : (
                <ul className="space-y-3">
                  {leaders.map((l) => (
                    <li key={l.id} className="flex items-center gap-3">
                      <Avatar user={l} size={36} />
                      <UserName user={l} communityType={c.type} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="text-meta text-ink-3 flex items-center gap-1.5">
              <CalendarDays size={14} /> Created {new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
        {tab === 'members' && <Members community={c} canManage={canManage} />}
      </div>
      {settings && <SettingsModal community={c} onClose={() => setSettings(false)} onSaved={setCommunity} />}
      <p className="sr-only">
        <Link to="/communities">All communities</Link>
      </p>
    </div>
  );
}
