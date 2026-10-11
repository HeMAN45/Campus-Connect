import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { PasswordInput } from './AuthLayout.jsx';
import { Field, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back. Use your college email.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field id="email" label="College email">
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="yourname@dypiu.ac.in" autoFocus />
        </Field>
        <Field id="password" label="Password">
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary w-full h-11" disabled={busy || !email || !password}>
          {busy ? <Spinner size={16} className="text-white" /> : 'Log in'}
        </button>
        <div className="flex items-center justify-between text-ui">
          <Link to="/register" className="link font-medium">
            Create an account
          </Link>
          <Link to="/forgot-password" className="link">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
