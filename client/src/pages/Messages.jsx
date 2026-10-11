import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookUser, ImageIcon, MapPin, MessagesSquare, RotateCw, Send } from 'lucide-react';
import { Avatar, EmptyState, ErrorState, RoleBadges, Spinner } from '../components/ui.jsx';
import { AttachButton, Previews, addFiles, imagesFromPaste } from '../components/ImagePicker.jsx';
import { Lightbox } from '../components/post/Images.jsx';
import Linkify from '../components/Linkify.jsx';
import { api, toForm } from '../lib/api.js';
import { dayLabel, fmtTime, timeAgo, yearLabel } from '../lib/format.js';
import { useMediaQuery } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket, useSocketEvent } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const subline = (u) => (u?.role === 'teacher' ? u.designation : [u?.dept, u?.role === 'student' ? yearLabel(u.year) : null].filter(Boolean).join(' . '));

function ConversationList({ items, activeId, loading }) {
  const { user } = useAuth();
  if (loading)
    return (
      <div className="py-10 flex justify-center">
        <Spinner />
      </div>
    );
  if (!items.length) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No messages yet"
        text="Find a classmate, senior, or faculty member in the Directory to start a conversation."
        action={
          <Link to="/directory" className="btn-primary">
            <BookUser size={18} /> Open Directory
          </Link>
        }
      />
    );
  }
  return (
    <ul>
      {items.map((c) => {
        const mine = c.lastMessage.senderId === user.id;
        const preview = c.lastMessage.body || (c.lastMessage.hasImage ? 'Photo' : '');
        return (
          <li key={c.id}>
            <Link
              to={`/messages/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 border-b border-line ${String(activeId) === String(c.id) ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
            >
              <Avatar user={c.otherUser} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${c.unreadCount ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>{c.otherUser.name}</span>
                  <span className="text-meta text-ink-3 shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-meta truncate flex items-center gap-1 ${c.unreadCount ? 'text-ink font-medium' : 'text-ink-2'}`}>
                    {mine && <span className="text-ink-3">You:</span>}
                    {c.lastMessage.hasImage && !c.lastMessage.body && <ImageIcon size={14} aria-hidden="true" />}
                    {preview}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[12px] font-semibold leading-5 text-center tabular-nums">{c.unreadCount}</span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Bubble({ m, mine, onImage }) {
  return (
    <div className={`max-w-[78%] md:max-w-[72%] rounded border px-3 py-2 ${mine ? 'bg-accent-soft border-accent/20' : 'bg-surface border-line'} ${m.status === 'failed' ? 'opacity-70' : ''}`}>
      {m.image && (
        <button type="button" onClick={() => onImage(m.image)} className="block -mx-1 mb-1" aria-label="Open image">
          <img src={m.image.url} alt="Shared image" className="max-w-[260px] max-h-[300px] w-auto rounded-sm object-cover bg-surface-2" />
        </button>
      )}
      {m.isDeleted ? (
        <p className="text-ink-3 italic">Message removed</p>
      ) : (
        m.body && (
          <p className="text-body text-ink">
            <Linkify text={m.body} />
          </p>
        )
      )}
    </div>
  );
}

function ConversationPane({ id, onActivity, onRead }) {
  const { user, refreshUnread } = useAuth();
  const { activeConversation, emit } = useSocket();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [otherRead, setOtherRead] = useState(0);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const scroller = useRef(null);
  const input = useRef(null);
  const stick = useRef(true);
  const typingTimer = useRef(null);
  const lastTypingEmit = useRef(0);
  const prevHeight = useRef(null);

  const markRead = useCallback(
    (list) => {
      const last = [...list].reverse().find((m) => typeof m.id === 'number');
      if (!last || document.visibilityState !== 'visible') return;
      api(`/conversations/${id}/read`, { method: 'POST', body: { lastReadMessageId: last.id } })
        .then(() => {
          onRead(Number(id));
          refreshUnread();
        })
        .catch(() => {});
    },
    [id, onRead, refreshUnread],
  );

  const load = useCallback(async () => {
    try {
      const r = await api(`/conversations/${id}/messages`);
      setData(r.conversation);
      setMessages(r.items);
      setHasMore(r.hasMore);
      setOtherRead(r.otherLastReadId);
      setError(null);
      stick.current = true;
      markRead(r.items);
    } catch (e) {
      setError(e);
    }
  }, [id, markRead]);

  useEffect(() => {
    setData(null);
    setMessages([]);
    setTyping(false);
    activeConversation.current = Number(id);
    load();
    return () => {
      activeConversation.current = null;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (prefill) {
      setText(prefill);
      navigate(location.pathname, { replace: true, state: null });
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useSocketEvent('message:new', ({ message }) => {
    if (message.conversationId !== Number(id)) return;
    setMessages((list) => {
      if (list.some((m) => m.id === message.id)) return list;
      const i = message.clientId ? list.findIndex((m) => m.clientId === message.clientId) : -1;
      if (i >= 0) return list.map((m, j) => (j === i ? { ...message } : m));
      return [...list, message];
    });
    if (message.senderId !== user.id) {
      setTyping(false);
      stick.current = true;
      markRead([message]);
    }
  });
  useSocketEvent('typing', (p) => {
    if (p.conversationId !== Number(id)) return;
    setTyping(p.isTyping);
    clearTimeout(typingTimer.current);
    if (p.isTyping) typingTimer.current = setTimeout(() => setTyping(false), 4000);
  });
  useSocketEvent('message:read', (p) => p.conversationId === Number(id) && setOtherRead(p.lastReadMessageId));
  useSocketEvent('reconnect', load);

  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && markRead(messages);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [messages, markRead]);

  const loadOlder = async () => {
    const first = messages.find((m) => typeof m.id === 'number');
    if (!first) return;
    const r = await api(`/conversations/${id}/messages?before=${first.id}`);
    prevHeight.current = scroller.current.scrollHeight;
    setMessages((list) => [...r.items, ...list]);
    setHasMore(r.hasMore);
  };

  const sendTyping = (isTyping) => {
    const now = Date.now();
    if (isTyping && now - lastTypingEmit.current < 2000) return;
    lastTypingEmit.current = isTyping ? now : 0;
    emit('typing', { conversationId: Number(id), isTyping });
  };

  const deliver = async (temp) => {
    try {
      const { message } = await api(`/conversations/${id}/messages`, {
        method: 'POST',
        form: toForm({ body: temp.body, clientId: temp.clientId }, { image: temp.file }),
      });
      setMessages((list) => {
        const without = list.filter((m) => m.id !== message.id || m.clientId === temp.clientId);
        return without.map((m) => (m.clientId === temp.clientId ? message : m));
      });
      onActivity({ id: Number(id), otherUser: data.otherUser, lastMessage: { body: message.body, hasImage: !!message.image, senderId: user.id, createdAt: message.createdAt } });
    } catch (e) {
      setMessages((list) => list.map((m) => (m.clientId === temp.clientId ? { ...m, status: 'failed' } : m)));
      toast(e.message);
    }
  };

  const send = (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body && !images.length) return;
    const clientId = uid();
    const temp = {
      id: `tmp-${clientId}`,
      clientId,
      senderId: user.id,
      body,
      file: images[0]?.file,
      image: images[0] ? { url: images[0].url } : null,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    setMessages((list) => [...list, temp]);
    setText('');
    setImages([]);
    stick.current = true;
    sendTyping(false);
    if (input.current) input.current.style.height = '';
    deliver(temp);
  };

  const retry = (m) => {
    setMessages((list) => list.map((x) => (x.clientId === m.clientId ? { ...x, status: 'sending' } : x)));
    deliver(m);
  };

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const other = data.otherUser;
  const blocked = data.blockState;
  const lastMine = [...messages].reverse().find((m) => m.senderId === user.id);
  let lastDay = null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg">
      <header className="h-16 shrink-0 flex items-center gap-3 px-2 md:px-4 border-b border-line bg-surface">
        <Link to="/messages" className="btn-icon md:hidden" aria-label="Back to conversations">
          <ArrowLeft size={22} />
        </Link>
        <Link to={`/u/${other.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
          <Avatar user={other} size={40} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="font-semibold truncate group-hover:underline underline-offset-2">{other.name}</span>
              <RoleBadges user={other} showYear={false} />
            </span>
            <span className="block text-meta text-ink-2 truncate">{typing ? <span className="text-accent">typing...</span> : subline(other)}</span>
          </span>
        </Link>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-3 md:px-6 py-4" onScroll={(e) => (stick.current = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight < 80)} aria-live="polite">
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button className="btn-ghost btn-sm" onClick={loadOlder}>
              Load earlier messages
            </button>
          </div>
        )}
        {!messages.length && (
          <div className="text-center py-10 text-ink-2">
            <Avatar user={other} size={64} className="mx-auto mb-3" />
            <p className="font-semibold text-ink">Say hi to {other.name}</p>
            <p className="text-meta mt-1">Messages are private between you two.</p>
            {other.role === 'teacher' && (
              <p className="text-meta mt-3 inline-flex items-center gap-1.5">
                <MapPin size={14} /> You can also visit their cabin. See their profile for office hours.
              </p>
            )}
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === user.id;
          const prev = messages[i - 1];
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const grouped = prev && prev.senderId === m.senderId && !showDay && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;
          const next = messages[i + 1];
          const endOfGroup = !next || next.senderId !== m.senderId || new Date(next.createdAt) - new Date(m.createdAt) >= 5 * 60000 || dayLabel(next.createdAt) !== day;
          const isLastMine = lastMine && m === lastMine;
          return (
            <Fragment key={m.clientId || m.id}>
              {showDay && (
                <div className="flex items-center gap-3 my-4" role="separator">
                  <span className="flex-1 h-px bg-line" />
                  <span className="text-meta text-ink-3 font-medium">{day}</span>
                  <span className="flex-1 h-px bg-line" />
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-3'}`}>
                <Bubble m={m} mine={mine} onImage={(img) => setLightbox(img)} />
              </div>
              {(endOfGroup || m.status === 'failed') && (
                <p className={`text-[12px] text-ink-3 mt-1 tabular-nums ${mine ? 'text-right' : ''}`}>
                  {fmtTime(m.createdAt)}
                  {mine && isLastMine && m.status === 'sending' && ' . Sending'}
                  {mine && isLastMine && !m.status && (otherRead >= m.id ? ' . Seen' : ' . Sent')}
                  {mine && m.status === 'failed' && (
                    <button className="text-danger font-medium ml-1 inline-flex items-center gap-1" onClick={() => retry(m)}>
                      . Not sent. <RotateCw size={12} /> Retry
                    </button>
                  )}
                </p>
              )}
            </Fragment>
          );
        })}
        {typing && (
          <div className="mt-3 flex">
            <span className="rounded border border-line bg-surface px-3 py-2 text-meta text-ink-2">{other.name.split(' ')[0]} is typing...</span>
          </div>
        )}
      </div>

      {blocked ? (
        <p className="shrink-0 border-t border-line bg-surface px-4 py-4 text-center text-ink-2 pb-safe">
          {blocked === 'blocked_you' ? "You can't message this person." : 'You blocked this person. Unblock them from their profile to send messages.'}
        </p>
      ) : (
        <form onSubmit={send} className="shrink-0 border-t border-line bg-surface px-2 md:px-4 py-2 pb-safe">
          {images.length > 0 && (
            <div className="px-2 pb-2">
              <Previews items={images} onChange={setImages} showAlt={false} size={64} />
            </div>
          )}
          <div className="flex items-end gap-1">
            <AttachButton items={images} onChange={setImages} max={1} onError={toast} label="Attach image" />
            <label htmlFor="dm-input" className="sr-only">
              Message {other.name}
            </label>
            <textarea
              id="dm-input"
              ref={input}
              rows={1}
              value={text}
              maxLength={2000}
              placeholder="Write a message"
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                sendTyping(!!e.target.value);
              }}
              onBlur={() => sendTyping(false)}
              onPaste={(e) => {
                const files = imagesFromPaste(e);
                if (files.length) setImages((cur) => addFiles(cur, files, { max: 1, onError: toast }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                  e.preventDefault();
                  send();
                }
              }}
              className="flex-1 resize-none rounded border border-line bg-surface-2 px-3 py-2.5 text-body leading-6 placeholder:text-ink-3 focus:outline-none focus:border-accent max-h-40"
            />
            <button type="submit" className="btn-primary h-11 w-11 px-0 shrink-0" disabled={!text.trim() && !images.length} aria-label="Send">
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
      {lightbox && <Lightbox images={[lightbox]} onClose={() => setLightbox(null)} />}
    </div>
  );
}

export default function Messages() {
  const { id } = useParams();
  const { user } = useAuth();
  const desktop = useMediaQuery('(min-width: 768px)');
  const { activeConversation } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    try {
      const r = await api('/conversations');
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadList();
  }, [loadList]);

  const bump = useCallback((conv) => {
    setItems((list) => {
      const existing = list.find((c) => c.id === conv.id);
      const merged = { ...existing, ...conv, unreadCount: conv.unreadCount ?? existing?.unreadCount ?? 0 };
      return [merged, ...list.filter((c) => c.id !== conv.id)];
    });
  }, []);

  useSocketEvent('message:new', ({ message, otherUser }) => {
    const fromOther = message.senderId !== user.id;
    setItems((list) => {
      const existing = list.find((c) => c.id === message.conversationId);
      const active = activeConversation.current === message.conversationId;
      const conv = {
        id: message.conversationId,
        otherUser: existing?.otherUser || otherUser,
        lastMessage: { body: message.body, hasImage: !!message.image, senderId: message.senderId, createdAt: message.createdAt },
        unreadCount: (existing?.unreadCount || 0) + (fromOther && !active ? 1 : 0),
      };
      return [conv, ...list.filter((c) => c.id !== conv.id)];
    });
  });
  useSocketEvent('reconnect', loadList);

  const onRead = useCallback((convId) => setItems((list) => list.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))), []);

  const showList = desktop || !id;
  const showPane = desktop || !!id;
  return (
    <div className="h-[calc(100dvh-64px-56px)] md:h-[calc(100dvh-64px)] flex md:border-x md:border-line bg-surface">
      {showList && (
        <section className={`${desktop ? 'w-[340px] border-r border-line' : 'w-full'} flex flex-col min-h-0`} aria-label="Conversations">
          <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-line">
            <h1 className="text-h2 font-bold">Messages</h1>
            <Link to="/directory" className="btn-ghost btn-sm">
              <BookUser size={16} /> New
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ConversationList items={items} activeId={id} loading={loading} />
          </div>
        </section>
      )}
      {showPane &&
        (id ? (
          <ConversationPane key={id} id={id} onActivity={bump} onRead={onRead} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-bg">
            <EmptyState icon={MessagesSquare} title="Your messages" text="Pick a conversation, or message someone from their profile or the Directory." />
          </div>
        ))}
    </div>
  );
}
