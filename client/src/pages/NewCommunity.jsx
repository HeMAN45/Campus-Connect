import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import { Banner, EmptyState, Field, Segmented, Spinner, errProps } from '../components/ui.jsx';
import { api, toForm } from '../lib/api.js';
import { useDebounced } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export default function NewCommunity() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', slug: '', type: 'club', description: '', rules: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [available, setAvailable] = useState(null);
  const slug = useDebounced(f.slug, 400);
  const direct = permissions.canCreateCommunity;

  useEffect(() => {
    if (!slug || slug.length < 2) return setAvailable(null);
    api(`/communities/slug-available?slug=${encodeURIComponent(slug)}`)
      .then((r) => setAvailable(r.available))
      .catch(() => setAvailable(null));
  }, [slug]);

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setF((x) => ({ ...x, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/communities', { method: 'POST', form: toForm(f, { avatar }) });
      if (r.pending) setDone(r.community);
      else navigate(`/c/${r.community.slug}`);
    } catch (err) {
      setErrors(err.fields || { name: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Request sent"
        text={`An admin will review "${done.name}". You'll get a notification when it's approved, and you'll be its admin.`}
        action={
          <Link to="/communities" className="btn-secondary">
            Back to communities
          </Link>
        }
      />
    );
  }

  return (
    <div className="max-w-[640px] px-3 md:px-0">
      <Link to="/communities" className="btn-ghost btn-sm -ml-2 mb-3">
        <ArrowLeft size={16} /> Communities
      </Link>
      <h1 className="text-h1 font-bold">{direct ? 'Create a community' : 'Request a community'}</h1>
      <p className="text-ink-2 mt-1 mb-6">For clubs and interest groups. Department and batch communities are created automatically.</p>
      {!direct && (
        <div className="mb-5">
          <Banner tone="info" icon={Info}>
            Student requests are reviewed by the admin to keep communities real and active. You'll be the admin once approved.
          </Banner>
        </div>
      )}
      <form onSubmit={submit} className="card p-4 md:p-6 space-y-5" noValidate>
        <div>
          <span className="label">Type</span>
          <Segmented
            label="Type"
            value={f.type}
            onChange={set('type')}
            options={[
              { value: 'club', label: 'Club' },
              { value: 'interest', label: 'Interest group' },
            ]}
          />
        </div>
        <Field id="nc-name" label="Name" error={errors.name}>
          <input id="nc-name" className="input" value={f.name} onChange={set('name')} maxLength={60} placeholder="e.g. Photography Club" {...errProps('nc-name', errors.name)} />
        </Field>
        <Field
          id="nc-slug"
          label="Web address"
          error={errors.slug || (available === false ? 'Already taken' : null)}
          help={available ? 'Available' : 'Lowercase letters, numbers, and hyphens.'}
        >
          <div className="flex items-center">
            <span className="h-11 px-3 inline-flex items-center border border-r-0 border-line rounded-l bg-surface-2 text-ink-2 text-meta">/c/</span>
            <input
              id="nc-slug"
              className="input rounded-l-none"
              value={f.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug')({ target: { value: slugify(e.target.value) } });
              }}
              {...errProps('nc-slug', errors.slug)}
            />
          </div>
        </Field>
        <Field id="nc-desc" label="Description" error={errors.description} help="What is it for, and who should join?">
          <textarea id="nc-desc" className="textarea" rows={3} maxLength={500} value={f.description} onChange={set('description')} {...errProps('nc-desc', errors.description)} />
        </Field>
        <Field id="nc-rules" label="Rules" optional>
          <textarea id="nc-rules" className="textarea" rows={3} maxLength={2000} value={f.rules} onChange={set('rules')} />
        </Field>
        <Field id="nc-avatar" label="Logo" optional>
          <input id="nc-avatar" type="file" accept="image/jpeg,image/png,image/webp" className="block text-meta" onChange={(e) => setAvatar(e.target.files[0] || null)} />
        </Field>
        <button className="btn-primary w-full md:w-auto" disabled={busy}>
          {busy ? <Spinner size={16} className="text-white" /> : direct ? 'Create community' : 'Send request'}
        </button>
      </form>
    </div>
  );
}
