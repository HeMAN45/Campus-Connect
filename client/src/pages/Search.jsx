import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, SearchX } from 'lucide-react';
import PostCard from '../components/post/PostCard.jsx';
import UserCard from '../components/UserCard.jsx';
import { CommunityAvatar, TYPE_LABEL } from './Communities.jsx';
import { EmptyState, ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || '';
  const [text, setText] = useState(q);
  const [state, setState] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    setText(q);
    if (q.trim().length < 2) return setState({ data: null, loading: false, error: null });
    setState((s) => ({ ...s, loading: true }));
    api(`/search?q=${encodeURIComponent(q)}&all=1`)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error }));
  }, [q]);

  const d = state.data;
  const empty = d && !d.posts.length && !d.people.length && !d.communities.length;
  return (
    <div className="max-w-[900px] px-3 md:px-0">
      <form
        role="search"
        className="relative mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(text.trim())}`, { replace: true });
        }}
      >
        <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input type="search" className="input h-12 pl-11 text-body" placeholder="Search posts, people, communities, cabins" value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-label="Search" />
      </form>
      {q.length < 2 && <p className="text-ink-2">Type at least 2 characters. Try a subject ("DBMS"), a name, a club, or a cabin number ("304").</p>}
      {state.loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {state.error && <ErrorState error={state.error} />}
      {empty && <EmptyState icon={SearchX} title={`No results for "${q}"`} text="Check the spelling or try fewer words." />}
      {d && !empty && (
        <div className="space-y-8">
          {d.people.length > 0 && (
            <section>
              <h2 className="section-label mb-3">People</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {d.people.map((u) => (
                  <li key={u.id}>
                    <UserCard user={u} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.communities.length > 0 && (
            <section>
              <h2 className="section-label mb-3">Communities</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {d.communities.map((c) => (
                  <li key={c.id}>
                    <Link to={`/c/${c.slug}`} className="card p-3 flex items-center gap-3 hover:border-line-strong">
                      <CommunityAvatar c={c} size={40} />
                      <span className="min-w-0">
                        <span className="block font-semibold truncate">{c.name}</span>
                        <span className="block text-meta text-ink-2">
                          {TYPE_LABEL[c.type]} . {c.memberCount} members
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.posts.length > 0 && (
            <section>
              <h2 className="section-label mb-3">Posts</h2>
              <div className="space-y-3">
                {d.posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
