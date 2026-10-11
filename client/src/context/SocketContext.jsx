import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket.js';
import { useAuth } from './AuthContext.jsx';

const SocketCtx = createContext(null);

export function SocketProvider({ children }) {
  const { status, user, setUnread, refreshUnread } = useAuth();
  const handlers = useRef(new Map());
  const activeConversation = useRef(null);
  const [connected, setConnected] = useState(false);

  const dispatch = useCallback((event, payload) => {
    handlers.current.get(event)?.forEach((fn) => fn(payload));
  }, []);

  useEffect(() => {
    if (status !== 'authed' || !user) return undefined;
    const s = connectSocket();
    let everConnected = false;
    const onMessage = (p) => {
      if (p.message.senderId !== user.id && activeConversation.current !== p.message.conversationId) {
        setUnread((u) => ({ ...u, messages: u.messages + 1 }));
      }
      dispatch('message:new', p);
    };
    const onNotification = (n) => {
      setUnread((u) => ({ ...u, notifications: u.notifications + 1 }));
      dispatch('notification:new', n);
    };
    const onTyping = (p) => dispatch('typing', p);
    const onRead = (p) => dispatch('message:read', p);
    const onConnect = () => {
      setConnected(true);
      if (everConnected) {
        refreshUnread();
        dispatch('reconnect');
      }
      everConnected = true;
    };
    const onDisconnect = () => setConnected(false);
    s.on('message:new', onMessage);
    s.on('notification:new', onNotification);
    s.on('typing', onTyping);
    s.on('message:read', onRead);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) onConnect();
    return () => {
      s.off('message:new', onMessage);
      s.off('notification:new', onNotification);
      s.off('typing', onTyping);
      s.off('message:read', onRead);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      disconnectSocket();
      setConnected(false);
    };
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const subscribe = useCallback((event, fn) => {
    if (!handlers.current.has(event)) handlers.current.set(event, new Set());
    handlers.current.get(event).add(fn);
    return () => handlers.current.get(event)?.delete(fn);
  }, []);

  const emit = useCallback((event, payload) => getSocket()?.emit(event, payload), []);

  return <SocketCtx.Provider value={{ subscribe, emit, activeConversation, connected }}>{children}</SocketCtx.Provider>;
}

export const useSocket = () => useContext(SocketCtx);

export function useSocketEvent(event, handler) {
  const { subscribe } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(event, (p) => ref.current(p)), [event, subscribe]);
}
