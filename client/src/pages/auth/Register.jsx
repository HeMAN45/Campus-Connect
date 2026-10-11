import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import AuthLayout, { DevCodeNotice, OtpInput, PasswordInput, useCountdown } from './AuthLayout.jsx';
import { Banner, Field, Segmented, Spinner, errProps } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/hooks.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STEPS = ['Email', 'Verify', 'Profile'];

function emailOk(email, domain) {
  const d = domain.replace(/\./g, '\\.');
  return new RegExp(`^[a-z0-9._%+-]+@([a-z0-9-]+\\.)*${d}$`, 'i').test(email.trim());
}

const mask = (email) => {
  const [name, host] = email.split('@');
  return `${name.slice(0, 4)}${name.length > 4 ? '...' : ''}@${host}`;
};

function EmailStep({ meta, onSent, initial }) {
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState('');
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const domain = meta?.allowedDomain || 'dypiu.ac.in';
  const valid = emailOk(email, domain);
  const showHint = email.includes('@') && !valid;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setTaken(false);
    setBusy(true);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { email, purpose: 'register' } });
      onSent(email.trim().toLowerCase(), r?.devCode);
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') setTaken(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field
        id="reg-email"
        label="College email"
        error={showHint ? `Use your college email ending in ${domain}` : error}
        help={`Only ${domain} emails can join. We'll send you a 6-digit code.`}
      >
        <input
          id="reg-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`yourname@${domain}`}
          autoComplete="email"
          autoFocus
          {...errProps('reg-email', showHint || error)}
        />
      </Field>
      {taken && (
        <p className="text-ui">
          <Link to={`/login?email=${encodeURIComponent(email)}`} className="link font-medium">
            Log in instead
          </Link>
        </p>
      )}
      <button className="btn-primary w-full h-11" disabled={!valid || busy}>
        {busy ? <Spinner size={16} className="text-white" /> : 'Send code'}
      </button>
      <p className="text-ui text-ink-2">
        Already have an account?{' '}
        <Link to="/login" className="link font-medium">
          Log in
        </Link>
      </p>
    </form>
  );
}

function VerifyStep({ email, onVerified, onBack, devCode: initialDevCode }) {
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(initialDevCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(60);
  const [locked, setLocked] = useState(false);

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/otp/verify', { method: 'POST', body: { email, code: value, purpose: 'register' } });
      onVerified(r.registrationToken);
    } catch (err) {
      setError(err.message);
      setCode('');
      if (err.code === 'OTP_LOCKED' || err.code === 'OTP_EXPIRED') setLocked(true);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { email, purpose: 'register' } });
      setDevCode(r?.devCode);
      setLeft(60);
      setLocked(false);
      setCode('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-ink-2">
        We sent a 6-digit code to <strong className="text-ink">{mask(email)}</strong>. It expires in 10 minutes. Check your spam folder if you don't see it.
      </p>
      <DevCodeNotice code={devCode} />
      <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy || locked} invalid={!!error} />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primary w-full h-11" disabled={code.length !== 6 || busy || locked} onClick={() => verify()}>
        {busy ? <Spinner size={16} className="text-white" /> : 'Verify'}
      </button>
      <div className="flex items-center justify-between text-ui">
        <button className="link" onClick={onBack}>
          Change email
        </button>
        <button className="link font-medium disabled:text-ink-3 disabled:no-underline" disabled={left > 0} onClick={resend}>
          {left > 0 ? `Resend code in ${left}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

function DetailsStep({ meta, token, email }) {
  const { applyMe } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', password: '', role: 'student', departmentId: '', program: 'B.Tech', year: '', section: '', designation: '', designationOther: '', officeLocation: '', officeHours: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const program = meta?.programs.find((p) => p.name === f.program);
  const years = useMemo(() => Array.from({ length: program?.years || 4 }, (_, i) => i + 1), [program]);
  const student = f.role === 'student';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const designation = f.designation === 'Other' ? f.designationOther : f.designation;
      const data = await api('/auth/register', {
        method: 'POST',
        body: {
          registrationToken: token,
          name: f.name,
          password: f.password,
          role: f.role,
          departmentId: f.departmentId,
          ...(student ? { program: f.program, year: f.year, section: f.section } : { designation, officeLocation: f.officeLocation, officeHours: f.officeHours }),
        },
      });
      applyMe(data);
      navigate('/', { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      if (!Object.keys(err.fields || {}).length) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!meta) return <Spinner />;
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-meta text-ink-2">
        Signing up as <strong className="text-ink">{email}</strong>
      </p>
      <Field id="r-name" label="Full name" error={errors.name}>
        <input id="r-name" className="input" value={f.name} onChange={set('name')} autoComplete="name" autoFocus {...errProps('r-name', errors.name)} />
      </Field>
      <Field id="r-password" label="Password" error={errors.password} help="At least 8 characters, with a letter and a number.">
        <PasswordInput id="r-password" value={f.password} onChange={set('password')} autoComplete="new-password" invalid={!!errors.password} describedBy={errors.password ? 'r-password-error' : undefined} />
      </Field>
      <div>
        <span className="label" id="r-role-label">
          I am a
        </span>
        <Segmented
          label="I am a"
          value={f.role}
          onChange={set('role')}
          options={[
            { value: 'student', label: 'Student' },
            { value: 'teacher', label: 'Faculty' },
          ]}
        />
      </div>
      <Field id="r-dept" label="Department" error={errors.departmentId}>
        <select id="r-dept" className="select" value={f.departmentId} onChange={set('departmentId')} {...errProps('r-dept', errors.departmentId)}>
          <option value="">Choose your department</option>
          {meta.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </Field>
      {student ? (
        <div className="grid grid-cols-2 gap-4">
          <Field id="r-program" label="Program" error={errors.program}>
            <select id="r-program" className="select" value={f.program} onChange={set('program')}>
              {meta.programs.map((p) => (
                <option key={p.code}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field id="r-year" label="Year" error={errors.year}>
            <select id="r-year" className="select" value={f.year} onChange={set('year')} {...errProps('r-year', errors.year)}>
              <option value="">Choose</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </Field>
          <Field id="r-section" label="Section" optional className="col-span-2 md:col-span-1">
            <input id="r-section" className="input" value={f.section} onChange={set('section')} maxLength={10} placeholder="e.g. B" />
          </Field>
        </div>
      ) : (
        <>
          <Field id="r-designation" label="Designation" error={errors.designation}>
            <select id="r-designation" className="select" value={f.designation} onChange={set('designation')} {...errProps('r-designation', errors.designation)}>
              <option value="">Choose</option>
              {meta.designations.map((d) => (
                <option key={d}>{d}</option>
              ))}
              <option>Other</option>
            </select>
          </Field>
          {f.designation === 'Other' && (
            <Field id="r-designation-other" label="Your designation">
              <input id="r-designation-other" className="input" value={f.designationOther} onChange={set('designationOther')} maxLength={60} />
            </Field>
          )}
          <Field id="r-office" label="Cabin or office" error={errors.officeLocation} help="So students can find you, e.g. Block A, Room 304.">
            <input id="r-office" className="input" value={f.officeLocation} onChange={set('officeLocation')} maxLength={100} {...errProps('r-office', errors.officeLocation)} />
          </Field>
          <Field id="r-hours" label="Office hours" optional>
            <input id="r-hours" className="input" value={f.officeHours} onChange={set('officeHours')} maxLength={120} placeholder="e.g. Mon, Wed 2:00 to 4:00 PM" />
          </Field>
          <Banner tone="info" icon={Info}>
            Faculty accounts are verified by the admin before you can post campus announcements. You can use everything else right away.
          </Banner>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primary w-full h-11" disabled={busy}>
        {busy ? <Spinner size={16} className="text-white" /> : 'Create account'}
      </button>
    </form>
  );
}

export default function Register() {
  const meta = useMeta();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [devCode, setDevCode] = useState(null);
  const titles = ['Join Campus Connect', 'Check your email', 'Set up your account'];
  const subtitles = ['Only students and faculty with a college email can join.', null, 'This is how classmates and faculty will see you.'];
  return (
    <AuthLayout title={titles[step]} subtitle={subtitles[step]} steps={STEPS} step={step}>
      {step === 0 && (
        <EmailStep
          meta={meta}
          initial={email}
          onSent={(e, dev) => {
            setEmail(e);
            setDevCode(dev);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <VerifyStep
          email={email}
          devCode={devCode}
          onBack={() => setStep(0)}
          onVerified={(t) => {
            setToken(t);
            setStep(2);
          }}
        />
      )}
      {step === 2 && <DetailsStep meta={meta} token={token} email={email} />}
    </AuthLayout>
  );
}
