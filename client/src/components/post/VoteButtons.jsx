import { useEffect, useState } from 'react';
import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function VoteButtons({ kind, id, score, myVote, isOwn, size = 20 }) {
  const toast = useToast();
  const [state, setState] = useState({ score, myVote });
  useEffect(() => setState({ score, myVote }), [score, myVote]);

  async function vote(e, v) {
    e.stopPropagation();
    if (isOwn) {
      toast(`You can't vote on your own ${kind === 'posts' ? 'post' : 'comment'}.`);
      return;
    }
    const next = state.myVote === v ? 0 : v;
    const prev = state;
    setState({ score: state.score - state.myVote + next, myVote: next });
    try {
      const r = await api(`/${kind}/${id}/vote`, { method: 'POST', body: { value: next } });
      setState({ score: r.score, myVote: r.myVote });
    } catch (err) {
      setState(prev);
      toast(err.message);
    }
  }

  const btn = 'inline-flex items-center justify-center h-9 w-9 rounded transition-colors';
  return (
    <div className="inline-flex items-center -ml-2" role="group" aria-label="Votes">
      <button
        type="button"
        aria-pressed={state.myVote === 1}
        aria-label={`Upvote, score ${state.score}`}
        onClick={(e) => vote(e, 1)}
        className={`${btn} ${state.myVote === 1 ? 'text-accent' : 'text-ink-3 hover:text-ink hover:bg-surface-2'}`}
      >
        <ArrowBigUp size={size} fill={state.myVote === 1 ? 'currentColor' : 'none'} strokeWidth={1.75} />
      </button>
      <span className={`tabular-nums text-meta font-semibold min-w-[2ch] text-center ${state.myVote === 1 ? 'text-accent' : state.myVote === -1 ? 'text-danger' : 'text-ink'}`}>
        {state.score}
      </span>
      <button
        type="button"
        aria-pressed={state.myVote === -1}
        aria-label="Downvote"
        onClick={(e) => vote(e, -1)}
        className={`${btn} ${state.myVote === -1 ? 'text-danger' : 'text-ink-3 hover:text-ink hover:bg-surface-2'}`}
      >
        <ArrowBigDown size={size} fill={state.myVote === -1 ? 'currentColor' : 'none'} strokeWidth={1.75} />
      </button>
    </div>
  );
}
