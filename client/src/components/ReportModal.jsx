import { useState } from 'react';
import { Modal } from './ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

const REASONS = [
  ['spam', 'Spam', 'Ads, repeated posts, or irrelevant links'],
  ['harassment', 'Harassment', 'Bullying, threats, or targeting someone'],
  ['inappropriate', 'Inappropriate content', 'Offensive, explicit, or unsafe'],
  ['misinformation', 'Misinformation', 'False or misleading information'],
  ['other', 'Something else', 'Tell us below'],
];

export default function ReportModal({ targetType, targetId, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details || undefined } });
      toast('Thanks. Our moderators will review this.');
      onClose();
    } catch (e) {
      if (e.code === 'ALREADY_REPORTED') {
        toast(e.message);
        onClose();
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Report"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!reason || busy || (reason === 'other' && !details.trim())} onClick={submit}>
            Submit report
          </button>
        </>
      }
    >
      <fieldset>
        <legend className="text-ink-2 mb-3">Why are you reporting this? Reports are anonymous to the person reported.</legend>
        <div className="space-y-1">
          {REASONS.map(([value, label, hint]) => (
            <label key={value} className={`flex items-start gap-3 p-2.5 rounded cursor-pointer hover:bg-surface-2 ${reason === value ? 'bg-accent-soft' : ''}`}>
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="mt-1 h-4 w-4 accent-[#1F4E8C]" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-meta text-ink-2">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="report-details" className="label mt-4">
        Details {reason !== 'other' && <span className="text-ink-3 font-normal">(optional)</span>}
      </label>
      <textarea id="report-details" className="textarea" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      {error && <p className="field-error">{error}</p>}
    </Modal>
  );
}
