import { Link, useNavigate } from 'react-router-dom';
import { Clock, MapPin, Send } from 'lucide-react';
import { Avatar, UserName } from './ui.jsx';
import { yearLong } from '../lib/format.js';
import { openConversation } from '../lib/dm.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function roleLine(u) {
  if (u.role === 'teacher') return [u.designation, u.department?.code || u.dept].filter(Boolean).join(', ');
  if (u.role === 'admin') return 'Campus administration';
  return [u.department?.code || u.dept, u.program, yearLong(u.year)].filter(Boolean).join(' . ');
}

export default function UserCard({ user: u, prefill }) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const message = async () => {
    try {
      await openConversation(navigate, u.id, prefill);
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <article className="card p-4 flex flex-col">
      <div className="flex items-start gap-3">
        <Link to={`/u/${u.id}`} aria-hidden="true" tabIndex={-1}>
          <Avatar user={u} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <UserName user={u} showYear={false} showMentor />
          <p className="text-meta text-ink-2 mt-0.5">{roleLine(u)}</p>
        </div>
      </div>
      {u.role === 'teacher' && (
        <div className="mt-3 space-y-1">
          {u.officeLocation && (
            <p className="flex items-center gap-2 text-ui font-medium text-ink">
              <MapPin size={16} className="text-accent shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">Cabin: </span>
                {u.officeLocation}
              </span>
            </p>
          )}
          {u.officeHours && (
            <p className="flex items-center gap-2 text-meta text-ink-2">
              <Clock size={15} className="shrink-0" aria-hidden="true" />
              {u.officeHours}
            </p>
          )}
          {u.subjects?.length > 0 && (
            <p className="text-meta text-ink-2 line-clamp-2">
              Teaches {u.subjects.map((s) => (s.year ? `${s.name} (${yearLong(s.year)})` : s.name)).join(', ')}
            </p>
          )}
        </div>
      )}
      {u.role === 'student' && u.mentor && u.mentorTopics?.length > 0 && (
        <p className="mt-3 text-meta text-ink-2">
          Can help with: <span className="text-ink">{u.mentorTopics.join(', ')}</span>
        </p>
      )}
      {u.role === 'student' && !u.mentor && u.skills?.length > 0 && <p className="mt-3 text-meta text-ink-2 line-clamp-1">{u.skills.join(' . ')}</p>}
      <div className="mt-auto pt-4">
        <div className="pt-3 border-t border-line flex gap-2">
          {u.id !== me.id && (
            <button className="btn-secondary btn-sm flex-1" onClick={message}>
              <Send size={15} /> Message
            </button>
          )}
          <Link to={`/u/${u.id}`} className="btn-ghost btn-sm flex-1">
            View profile
          </Link>
        </div>
      </div>
    </article>
  );
}
