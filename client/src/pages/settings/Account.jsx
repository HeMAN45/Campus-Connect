import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, LogOut, Smartphone } from 'lucide-react';
import { InstallButton } from '../../components/layout/AppShell.jsx';
import { PasswordInput } from '../auth/AuthLayout.jsx';
import { Avatar, Field, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useInstall } from '../../lib/install.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

function ChangePassword() {
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return setErrors({ confirm: 'Passwords do not match' });
    setBusy(true);
    try {
      await api('/auth/password/change', { method: 'POST', body: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      setErrors({});
      toast('Password changed');
    } catch (err) {
      setErrors(err.fields || { currentPassword: err.message });
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form onSubmit={submit} className="card p-4 md:p-6 space-y-4">
      <h2 className="section-label">Change password</h2>
      <Field id="a-cur" label="Current password" error={errors.currentPassword}>
        <PasswordInput id="a-cur" value={f.currentPassword} onChange={set('currentPassword')} />
      </Field>
      <Field id="a-new" label="New password" error={errors.newPassword} help="At least 8 characters, with a letter and a number.">
        <PasswordInput id="a-new" value={f.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
      </Field>
      <Field id="a-confirm" label="Confirm new password" error={errors.confirm}>
        <PasswordInput id="a-confirm" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </Field>
      <button className="btn-primary" disabled={busy || !f.currentPassword || !f.newPassword}>
        Update password
      </button>
    </form>
  );
}

function Blocked() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  useEffect(() => {
    api('/users/me/blocks')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);
  return (
    <section className="card p-4 md:p-6">
      <h2 className="section-label mb-3">Blocked people</h2>
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-ink-2">You haven't blocked anyone.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <Avatar user={u} size={32} />
              <span className="flex-1 font-medium">{u.name}</span>
              <button
                className="btn-secondary btn-sm"
                onClick={async () => {
                  await api(`/users/${u.id}/block`, { method: 'DELETE' });
                  setItems((list) => list.filter((x) => x.id !== u.id));
                  toast(`Unblocked ${u.name}`);
                }}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const install = useInstall();
  const navigate = useNavigate();
  return (
    <div className="max-w-[640px] px-3 md:px-0 space-y-5">
      <div>
        <h1 className="text-h1 font-bold">Account and app</h1>
        <p className="text-ink-2 mt-1">Signed in as {user.email}</p>
      </div>

      <section className="card p-4 md:p-6">
        <h2 className="section-label mb-3">App</h2>
        {install.installed ? (
          <p className="flex items-center gap-2 text-success font-medium">
            <CheckCircle2 size={18} /> Campus Connect is installed on this device.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="flex items-start gap-3 text-ink-2">
              <Smartphone size={20} className="mt-0.5 shrink-0" />
              Install Campus Connect on your phone or laptop. It opens like a normal app, works on slow connections, and keeps you signed in.
            </p>
            <InstallButton className="btn-primary" label="Install Campus Connect" />
            {!install.canPrompt && !install.iosHint && (
              <p className="text-meta text-ink-3">
                In Chrome or Edge, use the install icon in the address bar, or the browser menu's "Install app" option. On iPhone, use Safari's Share, then Add to Home Screen.
              </p>
            )}
          </div>
        )}
      </section>

      <ChangePassword />
      <Blocked />

      <section className="card p-4 md:p-6">
        <button
          className="btn-danger"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          <LogOut size={18} /> Log out
        </button>
      </section>
    </div>
  );
}
