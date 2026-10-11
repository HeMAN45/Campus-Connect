import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    reload();
  }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

// Cursor-paged list. `fetchPage(cursor)` must return { items, next, extra }.
export function usePaged(fetchPage, deps) {
  const [items, setItems] = useState([]);
  const [extra, setExtra] = useState(null);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const gen = useRef(0);

  const load = useCallback(
    async (cursor) => {
      const my = ++gen.current;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchPage(cursor);
        if (my !== gen.current) return;
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        if (!cursor) setExtra(page.extra ?? null);
        setNext(page.next ?? null);
      } catch (e) {
        if (my === gen.current) setError(e);
      } finally {
        if (my === gen.current) setLoading(false);
      }
    },
    deps, // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setItems([]);
    setNext(null);
    load(null);
  }, [load]);

  return {
    items,
    setItems,
    extra,
    loading,
    error,
    hasMore: !!next,
    loadMore: () => next && !loading && load(next),
    reload: () => load(null),
  };
}

export function useInfiniteScroll(onHit, enabled) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && onHit(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onHit, enabled]);
  return ref;
}

let metaCache = null;
let metaPromise = null;
export function useMeta() {
  const [meta, setMeta] = useState(metaCache);
  useEffect(() => {
    if (metaCache) return;
    metaPromise ||= api('/meta').then((m) => (metaCache = m));
    metaPromise.then(setMeta).catch(() => {
      metaPromise = null;
    });
  }, []);
  return meta;
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useMediaQuery(q) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const fn = () => setMatch(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [q]);
  return match;
}
