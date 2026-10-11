import { useEffect, useRef, useState } from 'react';
import { CalendarDays, HelpCircle, MapPin } from 'lucide-react';

export default function AuthLayout({ title, subtitle, children, steps, step }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden lg:flex flex-col justify-between bg-surface border-r border-line p-12">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-sm bg-ink text-white inline-flex items-center justify-center text-[16px] font-bold">CC</span>
          <span className="text-[20px] font-semibold tracking-tight">Campus Connect</span>
        </div>
        <div>
          <h2 className="text-display font-bold max-w-md">Everything happening at DYPIU, in one place.</h2>
          <ul className="mt-10 space-y-6 max-w-md">
            {[
              [HelpCircle, 'Ask and answer doubts', 'Classmates, seniors, and faculty help you get unstuck.'],
              [CalendarDays, 'Never miss a club event', 'Every club event shows up for every student, with one-tap RSVP.'],
              [MapPin, 'Find any faculty cabin', 'Cabin numbers, office hours, and subjects for every teacher.'],
            ].map(([Icon, head, text]) => (
              <li key={head} className="flex gap-4">
                <span className="h-10 w-10 rounded-sm border border-line inline-flex items-center justify-center shrink-0">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-title">{head}</span>
                  <span className="block text-ink-2">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-meta text-ink-3">For students and faculty of D Y Patil International University.</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <span className="h-9 w-9 rounded-sm bg-ink text-white inline-flex items-center justify-center text-[15px] font-bold">CC</span>
            <span className="text-[18px] font-semibold tracking-tight">Campus Connect</span>
          </div>
          {steps && (
            <ol className="flex gap-2 mb-8" aria-label="Progress">
              {steps.map((s, i) => (
                <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                  <span className={`block h-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
                  <span className={`block text-meta mt-2 ${i === step ? 'text-ink font-medium' : 'text-ink-3'}`}>
                    {i + 1}. {s}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <h1 className="text-h1 md:text-display font-bold">{title}</h1>
          {subtitle && <p className="text-ink-2 mt-2">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function OtpInput({ value, onChange, onComplete, disabled, invalid }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  const setAt = (i, d) => {
    const arr = value.padEnd(6, ' ').split('');
    arr[i] = d;
    const next = arr.join('').replace(/\s+$/, '');
    onChange(next);
    if (next.replace(/\s/g, '').length === 6) onComplete?.(next.replace(/\s/g, ''));
  };
  return (
    <div className="flex gap-2" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          maxLength={1}
          value={d.trim()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) return;
            if (v.length > 1) {
              const all = v.slice(0, 6);
              onChange(all);
              refs.current[Math.min(all.length, 5)]?.focus();
              if (all.length === 6) onComplete?.(all);
              return;
            }
            setAt(i, v);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (d.trim()) setAt(i, ' ');
              else if (i > 0) {
                setAt(i - 1, ' ');
                refs.current[i - 1]?.focus();
              }
            }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1].focus();
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1].focus();
          }}
          onPaste={(e) => {
            const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (!v) return;
            e.preventDefault();
            onChange(v);
            refs.current[Math.min(v.length, 5)]?.focus();
            if (v.length === 6) onComplete?.(v);
          }}
          className="input w-[52px] h-14 px-0 text-center text-[24px] font-semibold tabular-nums"
        />
      ))}
    </div>
  );
}

export function DevCodeNotice({ code }) {
  if (!code) return null;
  return (
    <div className="card border-l-[3px] border-l-warning bg-warning-soft/60 px-4 py-3" role="status">
      <p className="text-meta text-ink-2">Development mode: email sending is not set up, so here is your code.</p>
      <p className="text-[26px] leading-9 font-bold tracking-[0.2em] tabular-nums text-ink mt-1">{code}</p>
    </div>
  );
}

export function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

export function PasswordInput({ id, value, onChange, autoComplete = 'current-password', invalid, describedBy }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="input pr-16"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1 h-9 px-3 text-meta font-medium text-accent rounded hover:bg-surface-2">
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
