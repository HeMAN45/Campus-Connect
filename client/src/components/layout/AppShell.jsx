import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookUser,
  CircleUser,
  Download,
  Home,
  LogOut,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
  Pencil,
  Share,
  PlusSquare,
} from 'lucide-react';
import { Avatar, Modal, Spinner } from '../ui.jsx';
import NotificationList from '../NotificationList.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useComposer } from '../../context/ComposerContext.jsx';
import { useSocketEvent } from '../../context/SocketContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useOnline } from '../../lib/hooks.js';
import { useInstall } from '../../lib/install.js';
import { api } from '../../lib/api.js';

export function Logo({ withName = true }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Campus Connect home">
      <span className="h-8 w-8 rounded-sm bg-ink text-white inline-flex items-center justify-center text-[14px] font-bold tracking-tight">CC</span>
      {withName && <span className="text-[17px] font-semibold tracking-tight">Campus Connect</span>}
    </Link>
  );
}

function Count({ n, className = '' }) {
  if (!n) return null;
  return (
    <span className={`min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[12px] font-semibold leading-5 text-center tabular-nums ${className}`}>
      {n > 9 ? '9+' : n}
    </span>
  );
}

function IosInstallHelp({ onClose }) {
  return (
    <Modal title="Install Campus Connect" onClose={onClose} size="sm">
      <ol className="space-y-3 text-ui">
        <li className="flex gap-3">
          <span className="font-semibold">1.</span>
          <span>
            Tap the <Share size={16} className="inline -mt-1" aria-label="Share" /> Share button in Safari.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold">2.</span>
          <span>
            Choose <strong>Add to Home Screen</strong> <PlusSquare size={16} className="inline -mt-1" aria-hidden="true" />.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold">3.</span>
          <span>Open Campus Connect from your home screen like any other app.</span>
        </li>
      </ol>
    </Modal>
  );
}

export function InstallButton({ className = 'btn-secondary w-full', label = 'Install app' }) {
  const install = useInstall();
  const toast = useToast();
  const [ios, setIos] = useState(false);
  if (install.installed || (!install.canPrompt && !install.iosHint)) return null;
  return (
    <>
      <button
        className={className}
        onClick={async () => {
          if (install.canPrompt) {
            if (await install.install()) toast('Campus Connect is installed. Find it on your home screen.');
          } else setIos(true);
        }}
      >
        <Download size={18} /> {label}
      </button>
      {ios && <IosInstallHelp onClose={() => setIos(false)} />}
    </>
  );
}

function BellMenu() {
  const { unread, setUnread } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    api('/notifications')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useSocketEvent('notification:new', (n) => setItems((list) => (list ? [n, ...list.filter((x) => x.id !== n.id)] : list)));

  const markAll = async () => {
    await api('/notifications/read', { method: 'POST', body: {} });
    setItems((list) => list?.map((n) => ({ ...n, read: true })));
    setUnread((u) => ({ ...u, notifications: 0 }));
  };
  const openOne = (n) => {
    setOpen(false);
    if (!n.read) {
      api('/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {});
      setUnread((u) => ({ ...u, notifications: Math.max(0, u.notifications - 1) }));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-icon relative"
        aria-label={`Notifications${unread.notifications ? `, ${unread.notifications} unread` : ''}`}
        aria-expanded={open}
        onClick={() => (window.innerWidth < 768 ? navigate('/notifications') : setOpen((o) => !o))}
      >
        <Bell size={22} />
        <Count n={unread.notifications} className="absolute -top-0.5 -right-0.5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[400px] card shadow-float z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 h-12 border-b border-line">
            <h2 className="font-semibold">Notifications</h2>
            {unread.notifications > 0 && (
              <button className="link text-meta font-medium" onClick={markAll}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[440px] overflow-y-auto">
            {!items ? (
              <div className="py-8 flex justify-center">
                <Spinner />
              </div>
            ) : items.length ? (
              <NotificationList items={items.slice(0, 20)} onOpen={openOne} compact />
            ) : (
              <p className="px-4 py-8 text-center text-ink-2">You're all caught up.</p>
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center h-11 leading-[44px] border-t border-line text-ui font-medium text-accent hover:bg-surface-2">
            See all
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const go = (to) => {
    setOpen(false);
    navigate(to);
  };
  const item = 'w-full flex items-center gap-3 px-4 h-11 text-ui text-left hover:bg-surface-2';
  return (
    <div className="relative" ref={ref}>
      <button className="rounded-full" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar user={user} size={34} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 card shadow-float z-40 py-1">
          <div className="px-4 py-3 border-b border-line">
            <p className="font-semibold truncate">{user.name}</p>
            <p className="text-meta text-ink-2 truncate">{user.email}</p>
          </div>
          <button role="menuitem" className={item} onClick={() => go(`/u/${user.id}`)}>
            <CircleUser size={18} /> My profile
          </button>
          <button role="menuitem" className={item} onClick={() => go('/settings/profile')}>
            <Pencil size={18} /> Edit profile
          </button>
          <button role="menuitem" className={item} onClick={() => go('/settings/account')}>
            <Settings size={18} /> Account and app
          </button>
          {permissions.isAdmin && (
            <button role="menuitem" className={item} onClick={() => go('/admin')}>
              <ShieldCheck size={18} /> Admin
            </button>
          )}
          <div className="border-t border-line mt-1 pt-1">
            <button
              role="menuitem"
              className={`${item} text-danger`}
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/login');
              }}
            >
              <LogOut size={18} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const openComposer = useComposer();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  useEffect(() => {
    if (location.pathname === '/search') setQ(new URLSearchParams(location.search).get('q') || '');
  }, [location]);
  return (
    <header className="sticky top-0 z-30 bg-bg border-b border-line">
      <div className="h-16 max-w-[1280px] mx-auto px-3 md:px-6 flex items-center gap-3">
        <div className="md:hidden">
          <Logo withName={false} />
        </div>
        <div className="hidden md:block lg:hidden">
          <Logo withName={false} />
        </div>
        <div className="hidden lg:block w-[216px]">
          <Logo />
        </div>
        <form
          role="search"
          className="flex-1 max-w-[560px] hidden md:block"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Search
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              id="global-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search posts, people, communities, cabins"
              className="input pl-10 bg-surface"
            />
          </div>
        </form>
        <span className="flex-1 md:hidden text-[17px] font-semibold tracking-tight truncate">Campus Connect</span>
        <div className="flex items-center gap-1 md:gap-2 ml-auto">
          <Link to="/search" className="btn-icon md:hidden" aria-label="Search">
            <Search size={22} />
          </Link>
          <button className="btn-primary hidden md:inline-flex" onClick={() => openComposer()}>
            <Plus size={18} /> New post
          </button>
          <BellMenu />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const { unread, permissions } = useAuth();
  const [mine, setMine] = useState([]);
  useEffect(() => {
    api('/communities?mine=1')
      .then((r) => setMine(r.items.filter((c) => c.type !== 'official')))
      .catch(() => {});
  }, []);
  const nav = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/communities', label: 'Communities', icon: Users },
    { to: '/directory', label: 'Directory', icon: BookUser },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, count: unread.messages },
    { to: '/notifications', label: 'Notifications', icon: Bell, count: unread.notifications },
    ...(permissions.isAdmin ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];
  const cls = ({ isActive }) =>
    `flex items-center gap-3 h-11 px-3 rounded text-ui font-medium transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`;
  return (
    <aside className="hidden md:block shrink-0 w-[72px] lg:w-[232px]">
      <div className="sticky top-16 pt-5 pb-6 h-[calc(100vh-64px)] flex flex-col overflow-y-auto scrollbar-none">
        <nav aria-label="Main" className="space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={cls} title={n.label}>
              <span className="relative">
                <n.icon size={21} aria-hidden="true" />
                <Count n={n.count} className="absolute -top-2 -right-2.5 lg:hidden" />
              </span>
              <span className="hidden lg:inline flex-1">{n.label}</span>
              <Count n={n.count} className="hidden lg:inline-block" />
            </NavLink>
          ))}
        </nav>
        {mine.length > 0 && (
          <div className="hidden lg:block mt-7">
            <p className="section-label px-3 mb-2">Your communities</p>
            <ul className="space-y-0.5">
              {mine.slice(0, 7).map((c) => (
                <li key={c.id}>
                  <NavLink to={`/c/${c.slug}`} className={({ isActive }) => `flex items-center gap-2.5 h-9 px-3 rounded text-meta ${isActive ? 'bg-accent-soft text-accent font-medium' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}>
                    <span className="h-5 w-5 rounded-sm bg-surface border border-line text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                      {c.name[0]}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
            <Link to="/communities" className="block px-3 mt-2 text-meta link">
              Browse all
            </Link>
          </div>
        )}
        <div className="mt-auto pt-6 hidden lg:block">
          <InstallButton />
        </div>
      </div>
    </aside>
  );
}

function MobileTabBar() {
  const { unread } = useAuth();
  const openComposer = useComposer();
  const cls = ({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-ink-2'}`;
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-safe">
      <div className="h-14 flex">
        <NavLink to="/" end className={cls}>
          <Home size={22} aria-hidden="true" />
          Home
        </NavLink>
        <NavLink to="/communities" className={cls}>
          <Users size={22} aria-hidden="true" />
          Groups
        </NavLink>
        <button className="flex-1 flex items-center justify-center" onClick={() => openComposer()} aria-label="New post">
          <span className="h-10 w-12 rounded bg-accent text-white inline-flex items-center justify-center">
            <Plus size={24} />
          </span>
        </button>
        <NavLink to="/messages" className={cls}>
          <span className="relative">
            <MessagesSquare size={22} aria-hidden="true" />
            <Count n={unread.messages} className="absolute -top-1.5 -right-3" />
          </span>
          Messages
        </NavLink>
        <NavLink to="/directory" className={cls}>
          <BookUser size={22} aria-hidden="true" />
          Directory
        </NavLink>
      </div>
    </nav>
  );
}

export default function AppShell() {
  const online = useOnline();
  const location = useLocation();
  const fullBleed = location.pathname.startsWith('/messages');
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-primary">
        Skip to content
      </a>
      <TopBar />
      {!online && (
        <div className="bg-warning-soft border-b border-warning/30 text-warning text-meta font-medium px-4 py-2 flex items-center justify-center gap-2" role="status">
          <WifiOff size={16} /> You're offline. We'll reconnect automatically.
        </div>
      )}
      <div className="max-w-[1280px] mx-auto md:px-6 flex gap-6">
        <Sidebar />
        <main id="main" className={`flex-1 min-w-0 ${fullBleed ? 'pb-14 md:pb-0' : 'pt-4 md:pt-5 pb-24 md:pb-12'}`}>
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
