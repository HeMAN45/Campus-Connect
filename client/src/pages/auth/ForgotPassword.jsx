import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { DevCodeNotice, OtpInput, PasswordInput } from './AuthLayout.jsx';
import { Field, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.fields?.newPassword || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle={['Enter your college email.', 'Enter the code we sent you.', 'Choose a new password.'][step]}>
      {step === 0 && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await api('/auth/otp/request', { method: 'POST', body: { email, purpose: 'reset_password' } });
              setDevCode(r?.devCode);
              setStep(1);
            });
          }}
        >
          <Field id="fp-email" label="College email">
            <input id="fp-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
          </Field>
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary w-full h-11" disabled={busy || !email}>
            {busy ? <Spinner size={16} className="text-white" /> : 'Send code'}
          </button>
        </form>
      )}
      {step === 1 && (
        <div className="space-y-5">
          <p className="text-ink-2">If an account exists for {email}, we sent a code to it.</p>
          <DevCodeNotice code={devCode} />
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(c) =>
              run(async () => {
                const r = await api('/auth/otp/verify', { method: 'POST', body: { email, code: c, purpose: 'reset_password' } });
                setToken(r.resetToken);
                setStep(2);
              })
            }
            disabled={busy}
            invalid={!!error}
          />
          {error && <p className="field-error">{error}</p>}
        </div>
      )}
      {step === 2 && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw !== pw2) return setError('Passwords do not match.');
            run(async () => {
              await api('/auth/password/reset', { method: 'POST', body: { resetToken: token, newPassword: pw } });
              toast('Password changed. Log in with your new password.');
              navigate(`/login?email=${encodeURIComponent(email)}`);
            });
          }}
        >
          <Field id="fp-pw" label="New password" help="At least 8 characters, with a letter and a number.">
            <PasswordInput id="fp-pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field id="fp-pw2" label="Confirm new password">
            <PasswordInput id="fp-pw2" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </Field>
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary w-full h-11" disabled={busy || !pw}>
            Change password
          </button>
        </form>
      )}
      <p className="text-ui mt-6">
        <Link to="/login" className="link">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
