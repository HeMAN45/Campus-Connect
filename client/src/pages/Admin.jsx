import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Avatar, EmptyState, ErrorState, Modal, PageLoader, Spinner, UserName } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';

const TABS = [
  ['overview', 'Overview'],
  ['faculty', 'Pending faculty'],
  ['reports', 'Reports'],
  ['communities', 'Community requests'],
];

function Stat({ label, value, to, onClick }) {
  const body = (
    <>
      <span className="block text-[28px] leading-9 font-bold tabular-nums">{value}</span>
      <span className="block text-meta text-ink-2">{label}</span>
    </>
  );
  return onClick ? (
    <button className="card p-4 text-left hover:border-line-strong" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

function ReasonModal({ title, confirmLabel, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn bg-danger text-white hover:bg-danger/90" onClick={() => onConfirm(reason)}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <label htmlFor="reason" className="label">
        Reason <span className="text-ink-3 font-normal">(shown to the person)</span>
      </label>
      <textarea id="reason" className="textarea" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function Faculty({ onChange }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  useEffect(() => {
    api('/admin/teachers/pending').then((r) => setItems(r.items));
  }, []);
  const decide = async (u, approve, reason) => {
    try {
      await api(`/admin/teachers/${u.id}/decision`, { method: 'POST', body: { approve, reason } });
      setItems((list) => list.filter((x) => x.id !== u.id));
      toast(approve ? `${u.name} is now verified faculty` : `${u.name} was converted to a student account`);
      onChange();
    } catch (e) {
      toast(e.message);
    }
  };
  if (!items) return <Spinner />;
  if (!items.length) return <EmptyState icon={CheckCircle2} title="No pending faculty" text="New faculty sign-ups will appear here for verification." />;
  return (
    <>
      <ul className="card divide-y divide-line">
        {items.map((u) => (
          <li key={u.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar user={u} size={40} />
              <div className="min-w-0">
                <UserName user={u} />
                <p className="text-meta text-ink-2 truncate">
                  {u.email} . {u.designation}, {u.dept} . Cabin: {u.officeLocation}
                </p>
                <p className="text-meta text-ink-3">Signed up {timeAgo(u.createdAt)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm" onClick={() => setRejecting(u)}>
                Reject
              </button>
              <button className="btn-primary btn-sm" onClick={() => decide(u, true)}>
                Approve
              </button>
            </div>
          </li>
        ))}
      </ul>
      {rejecting && (
        <ReasonModal
          title={`Reject ${rejecting.name}?`}
          confirmLabel="Reject"
          onClose={() => setRejecting(null)}
          onConfirm={(reason) => {
            decide(rejecting, false, reason || undefined);
            setRejecting(null);
          }}
        />
      )}
    </>
  );
}

function Reports({ onChange }) {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const load = useCallback(() => {
    setItems(null);
    api(`/admin/reports?status=${status}`).then((r) => setItems(r.items));
  }, [status]);
  useEffect(load, [load]);
  const resolve = async (rep, action, suspendDays) => {
    try {
      await api(`/admin/reports/${rep.id}/resolve`, { method: 'POST', body: { action, suspendDays } });
      setItems((list) => list.filter((x) => x.id !== rep.id));
      toast({ dismiss: 'Report dismissed', remove: 'Content removed', suspend: 'Content removed and user suspended' }[action]);
      onChange();
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['open', 'actioned', 'dismissed'].map((s) => (
          <button key={s} className={status === s ? 'chip-on' : 'chip'} onClick={() => setStatus(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {!items ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState icon={CheckCircle2} title={status === 'open' ? 'No open reports' : 'Nothing here'} />
      ) : (
        <ul className="space-y-3">
          {items.map((rep) => (
            <li key={`${rep.targetType}-${rep.targetId}`} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tag text-danger border-danger/40 bg-danger-soft">{rep.targetType}</span>
                  {rep.reasons.map((r) => (
                    <span key={r} className="tag text-ink-2 border-line">
                      {r}
                    </span>
                  ))}
                  <span className="text-meta text-ink-2">
                    {rep.reportCount} {rep.reportCount === 1 ? 'report' : 'reports'} . {timeAgo(rep.lastAt)}
                  </span>
                </div>
                {rep.target.link && (
                  <Link to={rep.target.link} className="btn-ghost btn-sm">
                    <ExternalLink size={15} /> Open
                  </Link>
                )}
              </div>
              <div className="mt-3 p-3 rounded-sm bg-surface-2 border border-line">
                {rep.target.author && <p className="text-meta text-ink-2 mb-1">By {rep.target.author.name}</p>}
                {rep.target.title && <p className="font-semibold">{rep.target.title}</p>}
                {rep.target.text && <p className="text-ink line-clamp-4">{rep.target.text}</p>}
                {rep.target.imageUrl && <img src={rep.target.imageUrl} alt="Reported attachment" className="mt-2 max-h-40 rounded-sm border border-line" />}
                {rep.target.removed && <p className="text-meta text-ink-3 mt-1">Already removed</p>}
              </div>
              {rep.details && <p className="text-meta text-ink-2 mt-2">Reporter note: {rep.details}</p>}
              {status === 'open' && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button className="btn-secondary btn-sm" onClick={() => resolve(rep, 'dismiss')}>
                    Dismiss
                  </button>
                  {rep.targetType !== 'user' && (
                    <button className="btn-danger btn-sm" onClick={() => resolve(rep, 'remove')}>
                      Remove content
                    </button>
                  )}
                  <button className="btn-danger btn-sm" onClick={() => resolve(rep, 'suspend', 7)}>
                    Suspend 7 days
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => resolve(rep, 'suspend', 30)}>
                    Suspend 30 days
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => resolve(rep, 'suspend', null)}>
                    Suspend permanently
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommunityRequests({ onChange }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  useEffect(() => {
    api('/admin/communities/pending').then((r) => setItems(r.items));
  }, []);
  const decide = async (c, approve, reason) => {
    try {
      await api(`/admin/communities/${c.id}/decision`, { method: 'POST', body: { approve, reason } });
      setItems((list) => list.filter((x) => x.id !== c.id));
      toast(approve ? `${c.name} is live` : `${c.name} was rejected`);
      onChange();
    } catch (e) {
      toast(e.message);
    }
  };
  if (!items) return <Spinner />;
  if (!items.length) return <EmptyState icon={CheckCircle2} title="No community requests" />;
  return (
    <>
      <ul className="card divide-y divide-line">
        {items.map((c) => (
          <li key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold">
                  {c.name} <span className="text-meta text-ink-2 font-normal">/c/{c.slug} . {c.type}</span>
                </p>
                <p className="text-ink-2 mt-1">{c.description}</p>
                {c.requestedBy && <p className="text-meta text-ink-3 mt-1">Requested by {c.requestedBy.name} . {timeAgo(c.createdAt)}</p>}
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" onClick={() => setRejecting(c)}>
                  Reject
                </button>
                <button className="btn-primary btn-sm" onClick={() => decide(c, true)}>
                  Approve
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rejecting && (
        <ReasonModal
          title={`Reject ${rejecting.name}?`}
          confirmLabel="Reject"
          onClose={() => setRejecting(null)}
          onConfirm={(reason) => {
            decide(rejecting, false, reason || undefined);
            setRejecting(null);
          }}
        />
      )}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const loadStats = useCallback(() => {
    api('/admin/stats')
      .then(setStats)
      .catch(setError);
  }, []);
  useEffect(loadStats, [loadStats]);
  if (error) return <ErrorState error={error} onRetry={loadStats} />;
  if (!stats) return <PageLoader />;
  const badge = { faculty: stats.pendingTeachers, reports: stats.openReports, communities: stats.pendingCommunities };
  return (
    <div className="max-w-[1000px] px-3 md:px-0">
      <h1 className="text-h1 font-bold mb-4">Admin</h1>
      <div role="tablist" className="flex gap-1 border-b border-line mb-5 overflow-x-auto scrollbar-none">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 h-11 px-3 text-ui font-medium border-b-2 -mb-px inline-flex items-center gap-2 ${tab === id ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}>
            {label}
            {badge[id] > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[12px] font-semibold leading-5 tabular-nums">{badge[id]}</span>}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active users" value={stats.users} />
          <Stat label="New today" value={stats.newUsersToday} />
          <Stat label="Posts today" value={stats.postsToday} />
          <Stat label="Messages today" value={stats.messagesToday} />
          <Stat label="Open reports" value={stats.openReports} onClick={() => setTab('reports')} />
          <Stat label="Pending faculty" value={stats.pendingTeachers} onClick={() => setTab('faculty')} />
          <Stat label="Community requests" value={stats.pendingCommunities} onClick={() => setTab('communities')} />
          <Stat label="Suspended" value={stats.suspended} />
        </div>
      )}
      {tab === 'faculty' && <Faculty onChange={loadStats} />}
      {tab === 'reports' && <Reports onChange={loadStats} />}
      {tab === 'communities' && <CommunityRequests onChange={loadStats} />}
    </div>
  );
}
