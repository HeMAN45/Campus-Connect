import { useEffect, useState } from 'react';
import { Check, Star } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export function EventDateBlock({ startsAt, small = false }) {
  const d = new Date(startsAt);
  const month = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
  return (
    <div
      className={`shrink-0 border border-line rounded-sm bg-surface flex flex-col items-center justify-center ${small ? 'w-12 h-[52px]' : 'w-14 h-16'}`}
      aria-hidden="true"
    >
      <span className="text-label font-semibold text-event">{month}</span>
      <span className={`${small ? 'text-[20px] leading-6' : 'text-[24px] leading-7'} font-bold tabular-nums`}>{d.getDate()}</span>
    </div>
  );
}

export function RsvpButtons({ post, compact = false, onChange }) {
  const toast = useToast();
  const [ev, setEv] = useState(post.event);
  useEffect(() => setEv(post.event), [post.event]);
  const past = new Date(ev.endsAt || ev.startsAt) < new Date();

  async function set(e, status) {
    e.stopPropagation();
    const next = ev.myRsvp === status ? null : status;
    const prev = ev;
    const delta = (s) => (next === s ? 1 : 0) - (ev.myRsvp === s ? 1 : 0);
    setEv({ ...ev, myRsvp: next, goingCount: ev.goingCount + delta('going'), interestedCount: ev.interestedCount + delta('interested') });
    try {
      const r = await api(`/posts/${post.id}/rsvp`, { method: 'PUT', body: { status: next } });
      const updated = { ...ev, ...r };
      setEv(updated);
      onChange?.(updated);
      if (next === 'going') toast("You're going. See you there!");
    } catch (err) {
      setEv(prev);
      toast(err.message);
    }
  }

  if (past) return <span className="text-meta text-ink-2 tabular-nums">{ev.goingCount} went</span>;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        className={`${ev.myRsvp === 'going' ? 'btn-on' : 'btn-secondary'} btn-sm`}
        aria-pressed={ev.myRsvp === 'going'}
        onClick={(e) => set(e, 'going')}
      >
        {ev.myRsvp === 'going' && <Check size={16} />}
        Going
      </button>
      {!compact && (
        <button
          type="button"
          className={`${ev.myRsvp === 'interested' ? 'btn-on' : 'btn-secondary'} btn-sm`}
          aria-pressed={ev.myRsvp === 'interested'}
          onClick={(e) => set(e, 'interested')}
        >
          {ev.myRsvp === 'interested' && <Star size={15} fill="currentColor" />}
          Interested
        </button>
      )}
      <span className="text-meta text-ink-2 tabular-nums">
        <strong className="text-ink font-semibold">{ev.goingCount}</strong> going
        {!compact && ev.interestedCount > 0 && <> . {ev.interestedCount} interested</>}
      </span>
    </div>
  );
}
