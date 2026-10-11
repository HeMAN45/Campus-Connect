import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, BadgeCheck, Loader2, MoreHorizontal, X, RotateCw } from 'lucide-react';
import { initials, yearLabel } from '../lib/format.js';
import { POST_TYPES } from '../lib/postTypes.js';

const AVATAR_COLORS = [
  'bg-accent-soft text-accent',
  'bg-event-soft text-event',
  'bg-success-soft text-success',
  'bg-warning-soft text-warning',
  'bg-[#ECECE7] text-ink',
  'bg-danger-soft text-danger',
];

export function Avatar({ user, size = 32, className = '' }) {
  const style = { width: size, height: size };
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" style={style} className={`rounded-full object-cover bg-surface-2 shrink-0 ${className}`} />;
  }
  const color = AVATAR_COLORS[(user?.id || 0) % AVATAR_COLORS.length];
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      className={`rounded-full inline-flex items-center justify-center font-semibold shrink-0 ${color} ${className}`}
    >
      {initials(user?.name)}
    </span>
  );
}

export function TypeTag({ type }) {
  const t = POST_TYPES[type];
  if (!t) return null;
  const Icon = t.icon;
  return (
    <span className={`tag ${t.tag}`}>
      <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
      {t.label}
    </span>
  );
}

export function StatusTag({ tone = 'success', children, icon: Icon }) {
  const tones = {
    success: 'text-success border-success/40 bg-success-soft',
    muted: 'text-ink-3 border-line bg-surface-2',
    ink: 'text-ink border-ink/40 bg-surface',
    warning: 'text-warning border-warning/40 bg-warning-soft',
  };
  return (
    <span className={`tag ${tones[tone]}`}>
      {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function RoleBadges({ user, communityType, showYear = true, showMentor = false }) {
  if (!user) return null;
  const roleName = user.communityRole === 'admin' ? (communityType === 'club' ? 'Club lead' : 'Admin') : 'Mod';
  return (
    <>
      {user.verified && <BadgeCheck size={16} className="text-accent shrink-0" aria-label="Verified faculty" />}
      {user.role === 'teacher' && <span className="tag text-ink border-ink/40">Faculty</span>}
      {user.role === 'admin' && <span className="tag text-accent border-accent/40 bg-accent-soft">Admin</span>}
      {user.communityRole && <span className="tag text-event border-event/40 bg-event-soft">{roleName}</span>}
      {showMentor && user.mentor && <span className="tag text-success border-success/40 bg-success-soft">Mentor</span>}
      {showYear && user.role === 'student' && user.year && <span className="text-meta text-ink-2 whitespace-nowrap">{yearLabel(user.year)}</span>}
    </>
  );
}

export function UserName({ user, communityType, showYear, showMentor, className = '' }) {
  if (!user) return <span className="text-ink-3">[deleted]</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap min-w-0 ${className}`}>
      <Link to={`/u/${user.id}`} className="font-semibold text-ink hover:underline underline-offset-2 truncate" onClick={(e) => e.stopPropagation()}>
        {user.name}
      </Link>
      <RoleBadges user={user} communityType={communityType} showYear={showYear} showMentor={showMentor} />
    </span>
  );
}

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-ink-3 ${className}`} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Spinner size={24} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      {Icon && <Icon size={40} strokeWidth={1.5} className="text-ink-3 mb-4" aria-hidden="true" />}
      <h2 className="text-[18px] leading-7 font-semibold">{title}</h2>
      {text && <p className="text-ink-2 mt-1.5 max-w-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const notFound = error?.status === 404;
  return (
    <EmptyState
      icon={AlertCircle}
      title={notFound ? 'Not found' : "Couldn't load this"}
      text={error?.message || 'Something went wrong. Try again.'}
      action={
        notFound ? (
          <Link to="/" className="btn-secondary">
            Back to Home
          </Link>
        ) : (
          onRetry && (
            <button className="btn-secondary" onClick={onRetry}>
              <RotateCw size={16} /> Try again
            </button>
          )
        )
      }
    />
  );
}

export function PostSkeleton() {
  return (
    <div className="card p-5 space-y-3" aria-hidden="true">
      <div className="flex gap-2">
        <div className="skeleton h-5 w-20" />
        <div className="skeleton h-5 w-40" />
      </div>
      <div className="skeleton h-6 w-3/4" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="flex gap-3 pt-1">
        <div className="skeleton h-8 w-24" />
        <div className="skeleton h-8 w-28" />
      </div>
    </div>
  );
}

export function Field({ id, label, error, help, optional, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {optional && <span className="text-ink-3 font-normal"> (optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error flex items-start gap-1.5">
          <AlertCircle size={15} className="mt-[2px] shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        help && <p className="help">{help}</p>
      )}
    </div>
  );
}

export function errProps(id, error) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-line rounded bg-surface p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-9 px-4 rounded-sm text-ui font-medium transition-colors ${value === o.value ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size = 'md', fullOnMobile = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () =>
      [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (x) => !x.disabled && x.offsetParent !== null,
      );
    (el.querySelector('[data-autofocus]') || focusables()[1] || focusables()[0])?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    el.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      el.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);
  const widths = { sm: 'md:max-w-[420px]', md: 'md:max-w-[560px]', lg: 'md:max-w-[680px]' };
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface w-full ${widths[size]} ${fullOnMobile ? 'h-[100dvh] md:h-auto md:max-h-[90vh]' : 'max-h-[92dvh]'} rounded-t md:rounded md:mx-4 flex flex-col shadow-float`}
      >
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-line shrink-0">
          <h2 className="text-h2 font-semibold truncate">{title}</h2>
          <button className="btn-icon -mr-2" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2 shrink-0 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({ title, text, confirmLabel, danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={danger ? 'btn bg-danger text-white hover:bg-danger/90' : 'btn-primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-ink-2">{text}</p>
    </Modal>
  );
}

export function Menu({ items, label = 'More options', align = 'right', size = 20 }) {
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
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <MoreHorizontal size={size} />
      </button>
      {open && (
        <div role="menu" className={`absolute z-40 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} min-w-[220px] card shadow-float py-1`}>
          {list.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
              className={`w-full flex items-center gap-3 px-3 h-11 text-ui text-left hover:bg-surface-2 ${it.danger ? 'text-danger' : 'text-ink'}`}
            >
              {it.icon && <it.icon size={18} aria-hidden="true" />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Banner({ tone = 'warning', icon: Icon, children, onDismiss }) {
  const tones = {
    warning: 'border-l-warning bg-warning-soft/60',
    info: 'border-l-accent bg-accent-soft/60',
    success: 'border-l-success bg-success-soft/60',
    danger: 'border-l-danger bg-danger-soft/60',
  };
  return (
    <div className={`card border-l-[3px] ${tones[tone]} px-4 py-3 flex items-start gap-3`}>
      {Icon && <Icon size={20} className="mt-0.5 shrink-0 text-ink-2" aria-hidden="true" />}
      <div className="flex-1 text-ui text-ink">{children}</div>
      {onDismiss && (
        <button className="btn-icon h-8 w-8 -mr-1 -mt-1" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function SectionHeader({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="section-label">{children}</h2>
      {action}
    </div>
  );
}
