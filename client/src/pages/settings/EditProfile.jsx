import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Plus, Trash2, X } from 'lucide-react';
import { Avatar, Field, Spinner, errProps } from '../../components/ui.jsx';
import { validateImage } from '../../components/ImagePicker.jsx';
import { api, toForm } from '../../lib/api.js';
import { useMeta } from '../../lib/hooks.js';
import { yearLong } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

function ChipInput({ id, value, onChange, max = 15, placeholder }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim().replace(/,$/, '');
    if (!v || value.includes(v) || value.length >= max) return setText('');
    onChange([...value, v.slice(0, 30)]);
    setText('');
  };
  return (
    <div className="input h-auto min-h-11 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:border-accent">
      {value.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-sm bg-surface-2 border border-line text-meta">
          {s}
          <button type="button" className="h-5 w-5 inline-flex items-center justify-center rounded-sm hover:bg-line" onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
            <X size={13} />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="flex-1 min-w-[140px] h-7 bg-transparent focus:outline-none text-ui"
        value={text}
        onChange={(e) => (e.target.value.endsWith(',') ? add() : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length >= max ? '' : placeholder}
      />
    </div>
  );
}

export default function EditProfile() {
  const { user, applyMe, refresh } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const teacher = user.role === 'teacher';
  const student = user.role === 'student';
  const [f, setF] = useState({
    name: user.name,
    bio: user.bio || '',
    departmentId: user.department?.id || '',
    program: user.program || 'B.Tech',
    year: user.year || '',
    section: user.section || '',
    enrollmentNo: user.enrollmentNo || '',
    designation: user.designation || '',
    officeLocation: user.officeLocation || '',
    officeHours: user.officeHours || '',
    subjects: user.subjects || [],
    skills: user.skills || [],
    githubUrl: user.githubUrl || '',
    linkedinUrl: user.linkedinUrl || '',
    openToMentor: user.openToMentor,
    mentorTopics: user.mentorTopics || [],
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const program = meta?.programs.find((p) => p.name === f.program);
  const years = useMemo(() => Array.from({ length: program?.years || 4 }, (_, i) => i + 1), [program]);
  const canMentor = !student || Number(f.year) >= 2;

  const uploadAvatar = async (file) => {
    const err = validateImage(file, meta?.maxUploadMb || 5);
    if (err) return toast(err);
    setAvatarBusy(true);
    try {
      await api('/users/me/avatar', { method: 'POST', form: toForm({}, { avatar: file }) });
      await refresh();
      toast('Photo updated');
    } catch (e) {
      toast(e.message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api('/users/me', {
        method: 'PATCH',
        body: { ...f, subjects: f.subjects.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), year: s.year ? Number(s.year) : null })) },
      });
      applyMe(data);
      toast('Profile saved');
      navigate(`/u/${user.id}`);
    } catch (err) {
      setErrors(err.fields || {});
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!meta) return <Spinner />;
  return (
    <div className="max-w-[720px] px-3 md:px-0">
      <h1 className="text-h1 font-bold">Edit profile</h1>
      <p className="text-ink-2 mt-1 mb-6">{teacher ? 'Help students find you: keep your cabin and office hours up to date.' : 'Help classmates, seniors, and faculty know who you are.'}</p>

      <form onSubmit={save} className="space-y-6" noValidate>
        <section className="card p-4 md:p-6 flex items-center gap-4">
          <Avatar user={user} size={80} />
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files[0] && uploadAvatar(e.target.files[0])} />
            <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current.click()} disabled={avatarBusy}>
              {avatarBusy ? <Spinner size={14} /> : <Camera size={16} />} {user.avatarUrl ? 'Change photo' : 'Add photo'}
            </button>
            {user.avatarUrl && (
              <button
                type="button"
                className="btn-ghost btn-sm text-danger"
                onClick={async () => {
                  await api('/users/me/avatar', { method: 'DELETE' });
                  await refresh();
                }}
              >
                <Trash2 size={16} /> Remove
              </button>
            )}
            <p className="text-meta text-ink-3">JPG, PNG, or WebP. Under 5 MB.</p>
          </div>
        </section>

        <section className="card p-4 md:p-6 space-y-5">
          <h2 className="section-label">Basics</h2>
          <Field id="p-name" label="Full name" error={errors.name}>
            <input id="p-name" className="input" value={f.name} onChange={set('name')} maxLength={80} {...errProps('p-name', errors.name)} />
          </Field>
          <Field id="p-bio" label="Bio" optional error={errors.bio} help={`${300 - f.bio.length} characters left`}>
            <textarea id="p-bio" className="textarea" rows={3} maxLength={300} value={f.bio} onChange={set('bio')} placeholder={teacher ? 'Your research areas, what students can come to you for.' : 'What you are into, what you are learning.'} />
          </Field>
          <Field id="p-dept" label="Department" error={errors.departmentId}>
            <select id="p-dept" className="select" value={f.departmentId} onChange={set('departmentId')}>
              {meta.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </Field>
          {student && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field id="p-program" label="Program" className="col-span-2 md:col-span-1">
                <select id="p-program" className="select" value={f.program} onChange={set('program')}>
                  {meta.programs.map((p) => (
                    <option key={p.code}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field id="p-year" label="Year" error={errors.year}>
                <select id="p-year" className="select" value={f.year} onChange={set('year')}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="p-section" label="Section" optional>
                <input id="p-section" className="input" value={f.section} onChange={set('section')} maxLength={10} />
              </Field>
              <Field id="p-enroll" label="Enrollment no." optional help="Only you and admins can see this." className="col-span-2 md:col-span-1">
                <input id="p-enroll" className="input" value={f.enrollmentNo} onChange={set('enrollmentNo')} maxLength={20} />
              </Field>
            </div>
          )}
        </section>

        {teacher && (
          <section className="card p-4 md:p-6 space-y-5">
            <h2 className="section-label">Where students can find you</h2>
            <Field id="p-desig" label="Designation" error={errors.designation}>
              <input id="p-desig" className="input" list="designations" value={f.designation} onChange={set('designation')} maxLength={60} />
              <datalist id="designations">
                {meta.designations.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field id="p-office" label="Cabin or office" error={errors.officeLocation} help="e.g. Block A, Room 304">
              <input id="p-office" className="input" value={f.officeLocation} onChange={set('officeLocation')} maxLength={100} {...errProps('p-office', errors.officeLocation)} />
            </Field>
            <Field id="p-hours" label="Office hours" optional help="e.g. Mon, Wed 2:00 to 4:00 PM">
              <input id="p-hours" className="input" value={f.officeHours} onChange={set('officeHours')} maxLength={120} />
            </Field>
            <div>
              <span className="label">Subjects you teach</span>
              <ul className="space-y-2">
                {f.subjects.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={s.name}
                      maxLength={60}
                      placeholder="Subject name"
                      aria-label={`Subject ${i + 1}`}
                      onChange={(e) => set('subjects')(f.subjects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <select
                      className="select w-[150px]"
                      value={s.year || ''}
                      aria-label={`Year for subject ${i + 1}`}
                      onChange={(e) => set('subjects')(f.subjects.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))}
                    >
                      <option value="">Any year</option>
                      {[1, 2, 3, 4, 5].map((y) => (
                        <option key={y} value={y}>
                          {yearLong(y)}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-icon" onClick={() => set('subjects')(f.subjects.filter((_, j) => j !== i))} aria-label={`Remove subject ${i + 1}`}>
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {f.subjects.length < 20 && (
                <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => set('subjects')([...f.subjects, { name: '', year: '' }])}>
                  <Plus size={16} /> Add subject
                </button>
              )}
              <p className="help">The year lets students filter, e.g. "faculty teaching 3rd year AIML".</p>
            </div>
          </section>
        )}

        <section className="card p-4 md:p-6 space-y-5">
          <h2 className="section-label">Skills and links</h2>
          <Field id="p-skills" label="Skills" optional help="Press Enter after each skill. Up to 15.">
            <ChipInput id="p-skills" value={f.skills} onChange={set('skills')} placeholder="e.g. Python, Figma, Public speaking" />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field id="p-gh" label="GitHub" optional error={errors.githubUrl}>
              <input id="p-gh" type="url" className="input" value={f.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/..." />
            </Field>
            <Field id="p-li" label="LinkedIn" optional error={errors.linkedinUrl}>
              <input id="p-li" type="url" className="input" value={f.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
            </Field>
          </div>
        </section>

        {!teacher && (
          <section className="card p-4 md:p-6 space-y-4">
            <h2 className="section-label">Mentoring</h2>
            <label className={`flex items-start gap-3 ${canMentor ? '' : 'opacity-60'}`}>
              <input type="checkbox" className="h-5 w-5 mt-0.5 accent-[#1F4E8C]" checked={f.openToMentor && canMentor} disabled={!canMentor} onChange={set('openToMentor')} />
              <span>
                <span className="block font-medium">Open to mentor juniors</span>
                <span className="block text-meta text-ink-2">{canMentor ? 'Juniors will see you in "Seniors open to mentor" and can message you.' : 'Available from second year.'}</span>
              </span>
            </label>
            {f.openToMentor && canMentor && (
              <fieldset>
                <legend className="label">I can help with</legend>
                <div className="flex flex-wrap gap-2">
                  {meta.mentorTopics.map((t) => {
                    const on = f.mentorTopics.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        role="checkbox"
                        aria-checked={on}
                        className={on ? 'chip-on' : 'chip'}
                        onClick={() => set('mentorTopics')(on ? f.mentorTopics.filter((x) => x !== t) : [...f.mentorTopics, t])}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </section>
        )}

        <div className="flex gap-2 justify-end sticky bottom-[68px] md:bottom-4 bg-bg py-2">
          <Link to={`/u/${user.id}`} className="btn-secondary">
            Cancel
          </Link>
          <button className="btn-primary min-w-[140px]" disabled={busy}>
            {busy ? <Spinner size={16} className="text-white" /> : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
