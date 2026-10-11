export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Something went wrong. Try again.');
    this.status = status;
    this.code = body?.code || 'UNKNOWN';
    this.fields = body?.fields || {};
    this.data = body || {};
  }
}

let onUnauthenticated = null;
export const setUnauthenticatedHandler = (fn) => {
  onUnauthenticated = fn;
};

export async function api(path, { method = 'GET', body, form, signal } = {}) {
  const opts = { method, credentials: 'include', signal, headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, { code: 'NETWORK', message: "Can't reach Campus Connect. Check your connection." });
  }
  if (res.status === 204) return null;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error);
    if (err.code === 'UNAUTHENTICATED' && onUnauthenticated) onUnauthenticated(err);
    throw err;
  }
  return data;
}

export function toForm(fields, files = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue;
    f.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  for (const [k, list] of Object.entries(files)) {
    for (const file of [].concat(list || [])) if (file) f.append(k, file);
  }
  return f;
}

export const qs = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, v === true ? '1' : v);
  const str = s.toString();
  return str ? `?${str}` : '';
};
