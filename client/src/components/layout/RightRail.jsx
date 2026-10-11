import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookUser, GraduationCap, MapPin, Pin, Smartphone } from 'lucide-react';
import { EventDateBlock } from '../post/EventBits.jsx';
import { SectionHeader } from '../ui.jsx';
import { InstallButton } from './AppShell.jsx';
import { api } from '../../lib/api.js';
import { fmtTime, fmtDay } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useInstall } from '../../lib/install.js';

export function useUpcomingEvents(limit = 5) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api(`/posts/upcoming-events?limit=${limit}`)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [limit]);
  return items;
}

export function UpcomingEvents({ items }) {
  return (
    <section className="card p-4" aria-labelledby="rail-events">
      <SectionHeader
        action={
          <Link to="/?tab=events" className="text-meta link">
            All events
          </Link>
        }
      >
        <span id="rail-events">Upcoming events</span>
      </SectionHeader>
      {!items ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-meta text-ink-2">No upcoming events yet. Clubs post them here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link to={`/post/${p.id}`} className="flex gap-3 group">
                <EventDateBlock startsAt={p.event.startsAt} small />
                <div className="min-w-0">
                  <p className="text-ui font-semibold leading-5 line-clamp-2 group-hover:underline underline-offset-2">{p.title}</p>
                  <p className="text-meta text-ink-2 truncate">
                    {p.community?.name} . {fmtTime(p.event.startsAt)}
                  </p>
                  <p className="text-meta text-ink-3 tabular-nums">
                    {p.event.goingCount} going{p.event.myRsvp === 'going' ? ', including you' : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EventStrip({ items }) {
  if (!items?.length) return null;
  return (
    <section aria-label="Upcoming events" className="mb-4">
      <div className="flex items-center justify-between px-3 md:px-0 mb-2">
        <h2 className="section-label">Upcoming events</h2>
        <Link to="/?tab=events" className="text-meta link">
          See all
        </Link>
      </div>
      <ul className="flex gap-2 overflow-x-auto scrollbar-none px-3 md:px-0 snap-x">
        {items.map((p) => (
          <li key={p.id} className="snap-start shrink-0 w-[260px]">
            <Link to={`/post/${p.id}`} className="card p-3 flex gap-3 h-full hover:border-line-strong">
              <EventDateBlock startsAt={p.event.startsAt} small />
              <div className="min-w-0">
                <p className="text-ui font-semibold leading-5 line-clamp-2">{p.title}</p>
                <p className="text-meta text-ink-2 truncate">
                  {fmtDay(p.event.startsAt)}, {fmtTime(p.event.startsAt)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PinnedList() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api('/posts/pinned')
      .then((r) => setItems(r.items))
      .catch(() => {});
  }, []);
  if (!items.length) return null;
  return (
    <section className="card p-4" aria-labelledby="rail-pinned">
      <SectionHeader>
        <span id="rail-pinned">Pinned</span>
      </SectionHeader>
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p.id}>
            <Link to={`/post/${p.id}`} className="flex gap-2 group">
              <Pin size={15} className="mt-[3px] text-ink-2 shrink-0" aria-hidden="true" />
              <span className="text-ui leading-5 group-hover:underline underline-offset-2">{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuickLinks() {
  const { user } = useAuth();
  const student = user.role === 'student';
  return (
    <section className="card divide-y divide-line" aria-label="Quick links">
      <Link to="/directory?role=teacher" className="flex items-center gap-3 p-4 hover:bg-surface-2">
        <MapPin size={20} className="text-accent shrink-0" aria-hidden="true" />
        <span className="flex-1">
          <span className="block font-semibold text-ui">Find a faculty cabin</span>
          <span className="block text-meta text-ink-2">Cabin, office hours, and subjects</span>
        </span>
        <ArrowRight size={18} className="text-ink-3" aria-hidden="true" />
      </Link>
      {student ? (
        <Link to="/directory?tab=seniors" className="flex items-center gap-3 p-4 hover:bg-surface-2">
          <GraduationCap size={20} className="text-success shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-ui">Talk to a senior</span>
            <span className="block text-meta text-ink-2">Seniors who are open to mentoring</span>
          </span>
          <ArrowRight size={18} className="text-ink-3" aria-hidden="true" />
        </Link>
      ) : (
        <Link to="/?tab=doubts&unanswered=1" className="flex items-center gap-3 p-4 hover:bg-surface-2">
          <BookUser size={20} className="text-success shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-ui">Unanswered doubts</span>
            <span className="block text-meta text-ink-2">Students waiting for help</span>
          </span>
          <ArrowRight size={18} className="text-ink-3" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function InstallCard() {
  const install = useInstall();
  if (install.installed || (!install.canPrompt && !install.iosHint)) return null;
  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Smartphone size={18} aria-hidden="true" /> Get the app
      </p>
      <p className="text-meta text-ink-2 mt-1 mb-3">Install Campus Connect on your phone for one-tap access between classes.</p>
      <InstallButton className="btn-secondary btn-sm w-full" />
    </section>
  );
}

export default function RightRail({ events }) {
  return (
    <aside className="hidden xl:block w-[300px] shrink-0">
      <div className="sticky top-[84px] space-y-4">
        <UpcomingEvents items={events} />
        <PinnedList />
        <QuickLinks />
        <InstallCard />
      </div>
    </aside>
  );
}
