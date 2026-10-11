import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationList from '../components/NotificationList.jsx';
import { EmptyState, ErrorState, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';

function group(items) {
  const now = Date.now();
  const buckets = [
    ['Today', []],
    ['This week', []],
    ['Earlier', []],
  ];
  for (const n of items) {
    const age = now - new Date(n.createdAt).getTime();
    const same = new Date(n.createdAt).toDateString() === new Date().toDateString();
    (same ? buckets[0] : age < 7 * 86400000 ? buckets[1] : buckets[2])[1].push(n);
  }
  return buckets.filter(([, list]) => list.length);
}

export default function Notifications() {
  const { setUnread } = useAuth();
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);
  const [error, setError] = useState(null);

  const load = async (before) => {
    try {
      const r = await api(`/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`);
      setItems((cur) => (before ? [...cur, ...r.items] : r.items));
      setNext(r.nextBefore);
      setError(null);
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useSocketEvent('notification:new', (n) => setItems((list) => (list ? [n, ...list.filter((x) => x.id !== n.id)] : list)));

  const markAll = async () => {
    await api('/notifications/read', { method: 'POST', body: {} });
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread((u) => ({ ...u, notifications: 0 }));
  };
  const openOne = (n) => {
    if (n.read) return;
    api('/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {});
    setUnread((u) => ({ ...u, notifications: Math.max(0, u.notifications - 1) }));
  };

  if (error) return <ErrorState error={error} onRetry={() => load()} />;
  if (!items) return <PageLoader />;
  const unread = items.some((n) => !n.read);

  return (
    <div className="max-w-[720px]">
      <div className="flex items-center justify-between px-3 md:px-0 mb-4">
        <h1 className="text-h1 font-bold">Notifications</h1>
        {unread && (
          <button className="btn-secondary btn-sm" onClick={markAll}>
            Mark all as read
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" text="Comments on your posts, accepted answers, and announcements will show up here." />
      ) : (
        <div className="space-y-5">
          {group(items).map(([label, list]) => (
            <section key={label}>
              <h2 className="section-label px-3 md:px-0 mb-2">{label}</h2>
              <div className="card overflow-hidden max-md:rounded-none max-md:border-x-0">
                <NotificationList items={list} onOpen={openOne} />
              </div>
            </section>
          ))}
          {next && (
            <div className="flex justify-center">
              <button className="btn-secondary" onClick={() => load(next)}>
                Show older
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
