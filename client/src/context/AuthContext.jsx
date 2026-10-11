import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthenticatedHandler } from '../lib/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, permissions: null, error: null });
  const [unread, setUnread] = useState({ messages: 0, notifications: 0 });

  const applyMe = useCallback((data) => {
    setState({ status: 'authed', user: data.user, permissions: data.permissions, error: null });
    setUnread(data.unread);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyMe(await api('/auth/me'));
    } catch (e) {
      if (e.status === 401 || e.status === 403) setState({ status: 'guest', user: null, permissions: null, error: null });
      else setState((s) => (s.status === 'authed' ? s : { status: 'error', user: null, permissions: null, error: e }));
    }
  }, [applyMe]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthenticatedHandler(() =>
      setState((s) => (s.status === 'authed' ? { status: 'expired', user: null, permissions: null, error: null } : s)),
    );
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      applyMe(data);
      return data;
    },
    [applyMe],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setState({ status: 'guest', user: null, permissions: null, error: null });
      setUnread({ messages: 0, notifications: 0 });
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      setUnread(await api('/auth/unread'));
    } catch {
      // Badges will catch up on the next refresh.
    }
  }, []);

  return (
    <AuthCtx.Provider value={{ ...state, unread, setUnread, refresh, refreshUnread, login, logout, applyMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
