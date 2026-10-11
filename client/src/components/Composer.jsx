import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Lock } from 'lucide-react';
import { Modal, Field, errProps, TypeTag, Banner, Spinner } from './ui.jsx';
import { AttachButton, Previews, addFiles, imagesFromPaste } from './ImagePicker.jsx';
import { POST_TYPES, TYPE_ORDER } from '../lib/postTypes.js';
import { api, toForm } from '../lib/api.js';
import { useMeta } from '../lib/hooks.js';
import { localToIso, todayLocal, toLocalInput } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DRAFT_KEY = 'cc-draft';
const CAMPUS = 'campus';

const empty = (type) => ({
  type,
  title: '',
  body: '',
  where: '',
  subjectTag: '',
  neededBy: '',
  itemLocation: '',
  itemDate: todayLocal(),
  eventStartsAt: '',
  eventEndsAt: '',
  eventVenue: '',
  eventUrl: '',
  pinned: false,
  commentsLocked: false,
});

const isMod = (c, perms) => perms.isAdmin || c.myRole === 'admin' || c.myRole === 'moderator';

function whereOptions(type, mine, perms) {
  if (type === 'event') return mine.filter((c) => isMod(c, perms) || perms.isVerifiedTeacher);
  if (type === 'announcement') {
    const list = mine.filter((c) => isMod(c, perms) || perms.isVerifiedTeacher);
    return perms.canPostCampusAnnouncement ? [CAMPUS, ...list] : list;
  }
  return [CAMPUS, ...mine.filter((c) => c.type !== 'official' || isMod(c, perms))];
}

function typeAvailability(type, mine, perms) {
  if (type !== 'announcement' && type !== 'event') return { ok: true };
  if (whereOptions(type, mine, perms).length) return { ok: true };
  if (perms.isPendingTeacher) return { ok: false, reason: 'Available after your faculty account is verified' };
  return { ok: false, reason: type === 'event' ? 'For club leads and faculty' : 'For faculty and community moderators' };
}

const TITLE_PLACEHOLDER = {
  general: 'What do you want to share?',
  doubt: 'e.g. Why is 3NF not always dependency preserving?',
  request: 'e.g. Need a scientific calculator for the 2 PM exam',
  lost: 'e.g. Blue ID card holder with college ID',
  found: 'e.g. Found: bike keys with a red keychain',
  announcement: 'e.g. Lab moved to Lab 3, Block A this Friday',
  event: 'e.g. Build with AI: hands-on workshop',
};

export default function Composer({ type: presetType, communityId: presetCommunity, onClose, onPosted }) {
  const { user, permissions: perms } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const meta = useMeta();
  const [mine, setMine] = useState(null);
  const [form, setForm] = useState(() => {
    if (!presetType && !presetCommunity) {
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
        if (d?.type && (d.title || d.body)) return { ...empty(d.type), ...d, restored: true };
      } catch {
        // ignore broken drafts
      }
    }
    return empty(presetType || null);
  });
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api('/communities?mine=1')
      .then((r) => setMine(r.items))
      .catch(() => setMine([]));
  }, []);

  const options = useMemo(() => (mine && form.type ? whereOptions(form.type, mine, perms) : []), [mine, form.type, perms]);

  useEffect(() => {
    if (!form.type || !mine) return;
    const values = options.map((o) => (o === CAMPUS ? CAMPUS : String(o.id)));
    if (values.includes(form.where)) return;
    const preferred = presetCommunity && values.includes(String(presetCommunity)) ? String(presetCommunity) : values[0] || '';
    setForm((f) => ({ ...f, where: preferred }));
  }, [form.type, form.where, options, mine, presetCommunity]);

  useEffect(() => {
    if (!form.type || (!form.title && !form.body)) return;
    const t = setTimeout(() => {
      const { restored, ...rest } = form; // eslint-disable-line no-unused-vars
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
    }, 800);
    return () => clearTimeout(t);
  }, [form]);

  const set = (key) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const selectedCommunity = mine?.find((c) => String(c.id) === form.where) || null;
  const canPin =
    form.type === 'announcement' &&
    (form.where === CAMPUS ? perms.canPostCampusAnnouncement : selectedCommunity && (isMod(selectedCommunity, perms) || perms.isAdmin));

  const subjectSuggestions = useMemo(() => {
    if (!meta) return [];
    const dept = user?.dept;
    return [...new Set([...(meta.subjectTags[dept] || []), ...Object.entries(meta.subjectTags).filter(([k]) => k !== dept).flatMap(([, v]) => v)])];
  }, [meta, user?.dept]);

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const t = form.type;
    const fields = {
      type: t,
      title: form.title,
      body: form.body,
      communityId: form.where && form.where !== CAMPUS ? form.where : undefined,
      subjectTag: t === 'doubt' ? form.subjectTag : undefined,
      neededBy: t === 'request' ? localToIso(form.neededBy) : undefined,
      itemLocation: t === 'lost' || t === 'found' ? form.itemLocation : undefined,
      itemDate: t === 'lost' || t === 'found' ? form.itemDate : undefined,
      eventStartsAt: t === 'event' ? localToIso(form.eventStartsAt) : undefined,
      eventEndsAt: t === 'event' ? localToIso(form.eventEndsAt) : undefined,
      eventVenue: t === 'event' ? form.eventVenue : undefined,
      eventUrl: t === 'event' ? form.eventUrl : undefined,
      pinned: canPin && form.pinned ? 'true' : undefined,
      commentsLocked: t === 'announcement' && form.commentsLocked ? 'true' : undefined,
      imageAlts: images.length ? images.map((i) => i.alt || '') : undefined,
    };
    setBusy(true);
    try {
      const { post } = await api('/posts', { method: 'POST', form: toForm(fields, { images: images.map((i) => i.file) }) });
      localStorage.removeItem(DRAFT_KEY);
      toast('Posted');
      onClose();
      onPosted?.(post);
      navigate(`/post/${post.id}`);
    } catch (err) {
      const f = { ...err.fields };
      if (f.communityId) f.where = f.communityId;
      setErrors(f);
      if (!Object.keys(f).length) setFormError(err.message);
      else document.getElementById(`c-${Object.keys(f)[0]}`)?.focus();
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (form.title || form.body) toast('Draft saved. Open New post to continue.');
    onClose();
  };

  const T = form.type ? POST_TYPES[form.type] : null;
  const heading = !form.type ? 'New post' : { doubt: 'Ask a doubt', request: 'Request something', lost: 'Report a lost item', found: 'Report a found item', announcement: 'New announcement', event: 'New event', general: 'New post' }[form.type];

  return (
    <Modal
      title={heading}
      onClose={close}
      size="lg"
      fullOnMobile
      footer={
        form.type && (
          <>
            <button type="button" className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" form="composer" className="btn-primary min-w-[96px]" disabled={busy || !mine}>
              {busy ? <Spinner size={16} className="text-white" /> : 'Post'}
            </button>
          </>
        )
      }
    >
      {!form.type ? (
        <div>
          <p className="text-ink-2 mb-4">What would you like to post?</p>
          {!mine ? (
            <div className="py-8 flex justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TYPE_ORDER.map((type) => {
                const info = POST_TYPES[type];
                const avail = typeAvailability(type, mine, perms);
                const Icon = info.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!avail.ok}
                    onClick={() => setForm((f) => ({ ...empty(type), title: f.title, body: f.body }))}
                    className="card text-left p-3 border-l-[3px] hover:bg-surface-2 disabled:opacity-60 disabled:hover:bg-surface disabled:cursor-not-allowed"
                    style={{ borderLeftColor: info.hex }}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Icon size={18} style={{ color: info.hex }} aria-hidden="true" />
                      {info.name}
                    </span>
                    <span className="block text-meta text-ink-2 mt-0.5">{avail.ok ? info.hint : avail.reason}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <form id="composer" onSubmit={submit} className="space-y-4" noValidate>
          {form.restored && (
            <Banner tone="info" icon={Info} onDismiss={() => setForm((f) => ({ ...f, restored: false }))}>
              We restored your unsent draft.{' '}
              <button
                type="button"
                className="link font-medium"
                onClick={() => {
                  localStorage.removeItem(DRAFT_KEY);
                  setForm(empty(null));
                }}
              >
                Start over
              </button>
            </Banner>
          )}
          <div className="flex items-center justify-between gap-3">
            <TypeTag type={form.type} />
            {!presetType && (
              <button type="button" className="link text-meta font-medium" onClick={() => setForm((f) => ({ ...f, type: null }))}>
                Change type
              </button>
            )}
          </div>

          <Field id="c-where" label="Post in" error={errors.where}>
            <select id="c-where" className="select" value={form.where} onChange={set('where')} {...errProps('c-where', errors.where)}>
              {options.map((o) =>
                o === CAMPUS ? (
                  <option key="campus" value={CAMPUS}>
                    Campus-wide (everyone)
                  </option>
                ) : (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field id="c-title" label="Title" error={errors.title}>
            <input
              id="c-title"
              className="input"
              value={form.title}
              onChange={set('title')}
              maxLength={150}
              placeholder={TITLE_PLACEHOLDER[form.type]}
              data-autofocus
              {...errProps('c-title', errors.title)}
            />
          </Field>

          {form.type === 'doubt' && (
            <Field id="c-subjectTag" label="Subject" error={errors.subjectTag} help="Helps classmates and faculty find your doubt.">
              <input id="c-subjectTag" className="input" list="subject-tags" value={form.subjectTag} onChange={set('subjectTag')} maxLength={30} placeholder="e.g. DBMS" {...errProps('c-subjectTag', errors.subjectTag)} />
              <datalist id="subject-tags">
                {subjectSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          )}

          {(form.type === 'lost' || form.type === 'found') && (
            <div className="grid md:grid-cols-[1fr_180px] gap-4">
              <Field id="c-itemLocation" label={form.type === 'lost' ? 'Where did you lose it?' : 'Where did you find it?'} error={errors.itemLocation}>
                <input id="c-itemLocation" className="input" value={form.itemLocation} onChange={set('itemLocation')} maxLength={100} placeholder="e.g. Canteen, Block C" {...errProps('c-itemLocation', errors.itemLocation)} />
              </Field>
              <Field id="c-itemDate" label="When" error={errors.itemDate}>
                <input id="c-itemDate" type="date" className="input" value={form.itemDate} max={todayLocal()} onChange={set('itemDate')} {...errProps('c-itemDate', errors.itemDate)} />
              </Field>
            </div>
          )}

          {form.type === 'request' && (
            <Field id="c-neededBy" label="Needed by" optional error={errors.neededBy}>
              <input id="c-neededBy" type="datetime-local" className="input md:max-w-[280px]" value={form.neededBy} min={toLocalInput(new Date())} onChange={set('neededBy')} {...errProps('c-neededBy', errors.neededBy)} />
            </Field>
          )}

          {form.type === 'event' && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Field id="c-eventStartsAt" label="Starts" error={errors.eventStartsAt}>
                  <input id="c-eventStartsAt" type="datetime-local" className="input" value={form.eventStartsAt} min={toLocalInput(new Date())} onChange={set('eventStartsAt')} {...errProps('c-eventStartsAt', errors.eventStartsAt)} />
                </Field>
                <Field id="c-eventEndsAt" label="Ends" optional error={errors.eventEndsAt}>
                  <input id="c-eventEndsAt" type="datetime-local" className="input" value={form.eventEndsAt} min={form.eventStartsAt || toLocalInput(new Date())} onChange={set('eventEndsAt')} {...errProps('c-eventEndsAt', errors.eventEndsAt)} />
                </Field>
              </div>
              <Field id="c-eventVenue" label="Venue" error={errors.eventVenue}>
                <input id="c-eventVenue" className="input" value={form.eventVenue} onChange={set('eventVenue')} maxLength={120} placeholder="e.g. Seminar Hall, Block A" {...errProps('c-eventVenue', errors.eventVenue)} />
              </Field>
              <Field id="c-eventUrl" label="Registration link" optional error={errors.eventUrl}>
                <input id="c-eventUrl" type="url" className="input" value={form.eventUrl} onChange={set('eventUrl')} placeholder="https://" {...errProps('c-eventUrl', errors.eventUrl)} />
              </Field>
            </>
          )}

          <Field id="c-body" label={form.type === 'doubt' ? 'Details' : 'Description'} optional error={errors.body}>
            <textarea
              id="c-body"
              className="textarea min-h-[132px]"
              rows={5}
              value={form.body}
              onChange={set('body')}
              maxLength={5000}
              onPaste={(e) => {
                const files = imagesFromPaste(e);
                if (files.length) setImages((cur) => addFiles(cur, files, { max: 4, maxMb: meta?.maxUploadMb, onError: toast }));
              }}
              placeholder={form.type === 'doubt' ? 'Explain what you tried and where you got stuck. You can paste a screenshot.' : 'Add details. You can paste images here.'}
            />
            {form.body.length > 4500 && <p className="help text-right tabular-nums">{5000 - form.body.length} characters left</p>}
          </Field>

          {form.type === 'found' && (
            <Banner tone="info" icon={Lock}>
              Don't post ID numbers or photos with personal details. Ask the owner to describe the item.
            </Banner>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AttachButton items={images} onChange={setImages} max={4} maxMb={meta?.maxUploadMb} onError={toast} label={form.type === 'event' ? 'Add poster or photos' : 'Add images'} showLabel />
              <span className="text-meta text-ink-3">
                {form.type === 'event' ? 'The first image is used as the poster.' : form.type === 'lost' || form.type === 'found' ? 'A photo helps people recognise it.' : 'Up to 4 images.'}
              </span>
            </div>
            <Previews items={images} onChange={setImages} />
          </div>

          {form.type === 'announcement' && (
            <div className="space-y-2">
              {canPin && (
                <label className="flex items-center gap-3 text-ui">
                  <input type="checkbox" className="h-5 w-5 accent-[#1F4E8C]" checked={form.pinned} onChange={set('pinned')} />
                  Pin to the top {form.where === CAMPUS ? 'of everyone\'s feed for 7 days' : 'of the community'}
                </label>
              )}
              <label className="flex items-center gap-3 text-ui">
                <input type="checkbox" className="h-5 w-5 accent-[#1F4E8C]" checked={form.commentsLocked} onChange={set('commentsLocked')} />
                Turn off comments
              </label>
              <p className="help">{form.where === CAMPUS ? 'Everyone on campus will get a notification.' : 'Members of this community will get a notification.'}</p>
            </div>
          )}

          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          {T && <span className="sr-only">Posting a {T.name}</span>}
        </form>
      )}
    </Modal>
  );
}
