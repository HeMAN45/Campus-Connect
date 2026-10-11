const ampm = (s) => s.replace(/\s?am$/i, ' AM').replace(/\s?pm$/i, ' PM');

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const days = Math.floor(s / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const fmtTime = (iso) =>
  ampm(new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }));

export const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtEventRange(start, end) {
  const s = `${fmtDay(start)}, ${fmtTime(start)}`;
  if (!end) return s;
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  return sameDay ? `${s} to ${fmtTime(end)}` : `${s} to ${fmtDay(end)}, ${fmtTime(end)}`;
}

export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return fmtDay(iso);
}

export const yearLabel = (y) => (y ? `${y}${{ 1: 'st', 2: 'nd', 3: 'rd' }[y] || 'th'} yr` : '');
export const yearLong = (y) => (y ? `${y}${{ 1: 'st', 2: 'nd', 3: 'rd' }[y] || 'th'} year` : '');

export const initials = (name = '?') =>
  name
    .replace(/^(Prof\.|Dr\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const toLocalInput = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const todayLocal = () => toLocalInput(new Date()).slice(0, 10);
export const localToIso = (v) => (v ? new Date(v).toISOString() : '');

export const isPast = (iso) => iso && new Date(iso).getTime() < Date.now();
