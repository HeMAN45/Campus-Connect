import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap, Search, SearchX } from 'lucide-react';
import UserCard from '../components/UserCard.jsx';
import { EmptyState, ErrorState, Spinner } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useDebounced, useMeta } from '../lib/hooks.js';
import { yearLong } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Directory() {
  const { user } = useAuth();
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'seniors' ? 'seniors' : 'people';
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q);
  const [state, setState] = useState({ items: null, next: null, loading: true, error: null });

  const filters = {
    q: dq,
    role: tab === 'people' ? params.get('role') : null,
    departmentId: params.get('dept'),
    year: params.get('year'),
    teachesYear: params.get('teachesYear'),
    mentor: tab === 'people' && params.get('mentor') === '1',
    topic: tab === 'seniors' ? params.get('topic') : null,
  };
  const key = JSON.stringify({ tab, ...filters });

  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v === null || v === '' || v === undefined ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  const urlQ = params.get('q') || '';
  useEffect(() => {
    if (urlQ !== dq) setQ(urlQ);
  }, [urlQ]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if ((dq || '') !== urlQ) set({ q: dq || null });
  }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (offset = 0) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await api(`/users${tab === 'seniors' ? '/seniors' : ''}${qs({ ...filters, offset })}`);
      setState((s) => ({ items: offset ? [...(s.items || []), ...r.items] : r.items, next: r.nextOffset, loading: false, error: null }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  };
  useEffect(() => {
    setState({ items: null, next: null, loading: true, error: null });
    load(0);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const role = params.get('role') || '';
  const chip = (on) => (on ? 'chip-on shrink-0' : 'chip shrink-0');
  const seniorPrefill = (topic) =>
    user.role === 'student'
      ? `Hi, I'm a ${yearLong(user.year)} ${user.dept || ''} student. Could I ask you about ${topic ? topic.toLowerCase() : 'a few things'}?`
      : undefined;

  return (
    <div className="max-w-[1000px] px-3 md:px-0">
      <h1 className="text-h1 font-bold">Directory</h1>
      <p className="text-ink-2 mt-1 mb-5">Find classmates, seniors, and faculty. Faculty cards show their cabin and office hours.</p>

      <div role="tablist" className="flex gap-1 border-b border-line mb-4">
        {[
          ['people', 'People'],
          ['seniors', 'Seniors open to mentor'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'seniors' ? { tab: 'seniors' } : {}, { replace: true })}
            className={`h-11 px-3 text-ui font-medium border-b-2 -mb-px ${tab === id ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          className="input pl-10 h-12 text-body"
          placeholder={tab === 'seniors' ? 'Search by name, skill, or topic' : 'Search by name, subject, skill, or cabin (e.g. 304)'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the directory"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {tab === 'people' && (
          <>
            {[
              ['', 'Everyone'],
              ['student', 'Students'],
              ['teacher', 'Faculty'],
            ].map(([v, label]) => (
              <button key={label} className={chip(role === v)} onClick={() => set({ role: v || null, year: null, teachesYear: null })}>
                {label}
              </button>
            ))}
            <span className="w-px h-6 bg-line" aria-hidden="true" />
          </>
        )}
        <select className="select h-8 py-0 text-meta w-auto min-w-[150px]" value={params.get('dept') || ''} onChange={(e) => set({ dept: e.target.value })} aria-label="Department">
          <option value="">All departments</option>
          {meta?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code}
            </option>
          ))}
        </select>
        {tab === 'people' && role === 'teacher' && (
          <select className="select h-8 py-0 text-meta w-auto" value={params.get('teachesYear') || ''} onChange={(e) => set({ teachesYear: e.target.value })} aria-label="Teaches year">
            <option value="">Teaches any year</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                Teaches {yearLong(y)}
              </option>
            ))}
          </select>
        )}
        {tab === 'people' && role === 'student' && (
          <select className="select h-8 py-0 text-meta w-auto" value={params.get('year') || ''} onChange={(e) => set({ year: e.target.value })} aria-label="Year">
            <option value="">Any year</option>
            {[1, 2, 3, 4, 5].map((y) => (
              <option key={y} value={y}>
                {yearLong(y)}
              </option>
            ))}
          </select>
        )}
        {tab === 'people' && role !== 'teacher' && (
          <button className={chip(params.get('mentor') === '1')} onClick={() => set({ mentor: params.get('mentor') === '1' ? null : '1' })}>
            <GraduationCap size={15} /> Open to mentor
          </button>
        )}
        {tab === 'seniors' &&
          meta?.mentorTopics.map((t) => (
            <button key={t} className={chip(params.get('topic') === t)} onClick={() => set({ topic: params.get('topic') === t ? null : t })}>
              {t}
            </button>
          ))}
      </div>

      {tab === 'seniors' && user.role === 'student' && (
        <p className="text-meta text-ink-2 mb-4">
          Showing students senior to you who are happy to help. People from your department appear first.
        </p>
      )}

      {state.error && <ErrorState error={state.error} onRetry={() => load(0)} />}
      {!state.items && state.loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {state.items && state.items.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="No one matches"
          text={tab === 'seniors' ? 'Try another topic, or check back as more seniors join.' : 'Try fewer filters or a different search.'}
          action={
            <button
              className="btn-secondary"
              onClick={() => {
                setQ('');
                setParams(tab === 'seniors' ? { tab: 'seniors' } : {}, { replace: true });
              }}
            >
              Clear filters
            </button>
          }
        />
      )}
      {state.items && state.items.length > 0 && (
        <>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.items.map((u) => (
              <li key={u.id}>
                <UserCard user={u} prefill={tab === 'seniors' ? seniorPrefill(params.get('topic')) : undefined} />
              </li>
            ))}
          </ul>
          {state.next !== null && (
            <div className="flex justify-center mt-6">
              <button className="btn-secondary" onClick={() => load(state.next)} disabled={state.loading}>
                {state.loading ? <Spinner size={16} /> : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
