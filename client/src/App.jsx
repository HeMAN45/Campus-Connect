import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { RotateCw, WifiOff } from 'lucide-react';
import AppShell from './components/layout/AppShell.jsx';
import { EmptyState, PageLoader, Spinner } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useToast } from './context/ToastContext.jsx';

const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const PostDetail = lazy(() => import('./pages/PostDetail.jsx'));
const Communities = lazy(() => import('./pages/Communities.jsx'));
const NewCommunity = lazy(() => import('./pages/NewCommunity.jsx'));
const Community = lazy(() => import('./pages/Community.jsx'));
const Directory = lazy(() => import('./pages/Directory.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const EditProfile = lazy(() => import('./pages/settings/EditProfile.jsx'));
const Account = lazy(() => import('./pages/settings/Account.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <span className="h-12 w-12 rounded-sm bg-ink text-white inline-flex items-center justify-center text-[20px] font-bold">CC</span>
      <Spinner size={22} />
    </div>
  );
}

function RequireAuth() {
  const { status, error, refresh } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const warned = useRef(false);
  useEffect(() => {
    if (status === 'expired' && !warned.current) {
      warned.current = true;
      toast('Your session ended. Please log in again.');
    }
  }, [status, toast]);
  if (status === 'loading') return <Splash />;
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={WifiOff}
          title="Can't reach Campus Connect"
          text={error?.message}
          action={
            <button className="btn-secondary" onClick={refresh}>
              <RotateCw size={16} /> Try again
            </button>
          }
        />
      </div>
    );
  }
  if (status !== 'authed') {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

function PublicOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'authed') {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />;
  }
  return <Outlet />;
}

function RequireAdmin({ children }) {
  const { permissions } = useAuth();
  return permissions?.isAdmin ? children : <NotFound />;
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route index element={<Home />} />
                    <Route path="post/:id" element={<PostDetail />} />
                    <Route path="communities" element={<Communities />} />
                    <Route path="communities/new" element={<NewCommunity />} />
                    <Route path="c/:slug" element={<Community />} />
                    <Route path="directory" element={<Directory />} />
                    <Route path="u/:id" element={<Profile />} />
                    <Route path="settings/profile" element={<EditProfile />} />
                    <Route path="settings/account" element={<Account />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="messages/:id" element={<Messages />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="search" element={<Search />} />
                    <Route
                      path="admin"
                      element={
                        <RequireAdmin>
                          <Admin />
                        </RequireAdmin>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
