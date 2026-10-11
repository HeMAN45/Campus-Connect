import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Plus, Search, Users } from 'lucide-react';
import { EmptyState, ErrorState, Spinner } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useDebounced, useFetch } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const TYPES = [
  ['', 'All'],
  ['club', 'Clubs'],
  ['interest', 'Interest'],
  ['department', 'Departments'],
  ['batch', 'Batches'],
  ['official', 'Official'],
];

export const TYPE_LABEL = { club: 'Club', interest: 'Interest group', department: 'Department', batch: 'Batch', official: 'Official' };

export function CommunityAvatar({ c, size = 48 }) {
  if (c.avatarUrl) return <img src={c.avatarUrl} alt="" style={{ width: size, height: size }} className="rounded-sm object-cover border border-line shrink-0" />;
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.4 }} className="rounded-sm bg-surface-2 border border-line font-bold text-ink-2 inline-flex items-center justify-center shrink-0">
      {c.name[0]}
    </span>
  );
}

export function JoinButton({ community, onChange, size = 'btn-sm' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const joined = !!community.myRole;
  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (joined && community.myRole === 'admin') return toast('Make someone else an admin before you leave.');
    if (joined && community.type === 'official') return toast("Official communities can't be left.");
    setBusy(true);
    try {
      const r = await api(`/communities/${community.slug}/${joined ? 'leave' : 'join'}`, { method: 'POST' });
      onChange({ ...community, myRole: r.myRole, memberCount: r.memberCount });
      toast(joined ? `You left ${community.name}` : `You joined ${community.name}`);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={`${joined ? 'btn-on' : 'btn-primary'} ${size}`} onClick={toggle} disabled={busy} aria-pressed={joined}>
      {joined ? (community.myRole === 'admin' ? 'Admin' : community.myRole === 'moderator' ? 'Moderator' : 'Joined') : 'Join'}
    </button>
  );
}

export default function Communities() {
  const { permissions } = useAuth();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload, setData } = useFetch(`/communities${qs({ type, q: dq })}`);
  const update = (c) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === c.id ? c : x)) }));

  return (
    <div className="max-w-[960px] px-3 md:px-0">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-h1 font-bold">Communities</h1>
          <p className="text-ink-2 mt-1">Clubs, departments, batches, and interest groups.</p>
        </div>
        <Link to="/communities/new" className="btn-secondary shrink-0">
          <Plus size={18} /> <span className="hidden sm:inline">{permissions.canCreateCommunity ? 'Create' : 'Request'} community</span>
        </Link>
      </div>
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input type="search" className="input pl-10" placeholder="Search communities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search communities" />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none mb-5" role="radiogroup" aria-label="Community type">
        {TYPES.map(([v, label]) => (
          <button key={label} role="radio" aria-checked={type === v} className={type === v ? 'chip-on shrink-0' : 'chip shrink-0'} onClick={() => setType(v)}>
            {label}
          </button>
        ))}
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {data && data.items.length === 0 && <EmptyState icon={Users} title="No communities found" text="Try another search, or request a new community." />}
      {data && (
        <ul className="grid md:grid-cols-2 gap-3">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link to={`/c/${c.slug}`} className="card p-4 flex gap-3 h-full hover:border-line-strong">
                <CommunityAvatar c={c} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-1.5">
                        <span className="truncate">{c.name}</span>
                        {c.isVerified && c.type !== 'batch' && c.type !== 'department' && <BadgeCheck size={16} className="text-accent shrink-0" aria-label="Verified" />}
                      </p>
                      <p className="text-meta text-ink-2">
                        {TYPE_LABEL[c.type]} . {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    <JoinButton community={c} onChange={update} />
                  </div>
                  {c.description && <p className="text-meta text-ink-2 mt-2 line-clamp-2">{c.description}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
