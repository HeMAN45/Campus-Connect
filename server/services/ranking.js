const BOOST = { announcement: 10, lost: 5, found: 5 };

function typeBoost(p, now, nowStr) {
  if (p.status !== 'open') return 0;
  switch (p.type) {
    case 'event':
      return (p.event_ends_at || p.event_starts_at) >= nowStr ? 8 : 0;
    case 'request':
      return !p.needed_by || Date.parse(p.needed_by) > now ? 5 : 0;
    case 'doubt':
      return p.accepted_comment_id ? 0 : 3;
    default:
      return BOOST[p.type] || 0;
  }
}

export function hotScore(p, now = Date.now()) {
  const nowStr = new Date(now).toISOString();
  const ageHours = Math.max(0, (now - Date.parse(p.created_at)) / 3_600_000);
  const base = (p.score + 2 * p.comment_count + typeBoost(p, now, nowStr)) / Math.pow(ageHours + 2, 1.5);
  return p.status === 'resolved' ? base * 0.3 : base;
}
