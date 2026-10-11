import { useEffect, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

const OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function validateImage(file, maxMb = 5) {
  if (!OK.includes(file.type)) return 'Use a JPG, PNG, WebP, or GIF image.';
  if (file.size > maxMb * 1024 * 1024) return `Images must be under ${maxMb} MB.`;
  return null;
}

// Adds validated files to an attachments list of { file, url, alt }.
export function addFiles(items, files, { max, maxMb = 5, onError }) {
  const next = [...items];
  for (const f of files) {
    if (next.length >= max) {
      onError?.(`You can attach up to ${max} image${max > 1 ? 's' : ''}.`);
      break;
    }
    const err = validateImage(f, maxMb);
    if (err) {
      onError?.(err);
      continue;
    }
    next.push({ file: f, url: URL.createObjectURL(f), alt: '' });
  }
  return next;
}

export function imagesFromPaste(e) {
  return [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
}

export function AttachButton({ items, onChange, max = 1, maxMb = 5, onError, label = 'Add image', showLabel = false, className = '' }) {
  const input = useRef(null);
  const full = items.length >= max;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={OK.join(',')}
        multiple={max > 1}
        hidden
        onChange={(e) => {
          onChange(addFiles(items, [...e.target.files], { max, maxMb, onError }));
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className={showLabel ? `btn-secondary ${className}` : `btn-icon ${className}`}
        onClick={() => input.current.click()}
        disabled={full}
        aria-label={label}
        title={full ? `Up to ${max} image${max > 1 ? 's' : ''}` : label}
      >
        <ImagePlus size={20} aria-hidden="true" />
        {showLabel && <span>{label}</span>}
      </button>
    </>
  );
}

export function Previews({ items, onChange, showAlt = true, size = 72 }) {
  const urls = useRef(new Set());
  useEffect(() => {
    items.forEach((i) => urls.current.add(i.url));
  }, [items]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  if (!items.length) return null;
  const update = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={it.url} className="flex items-start gap-3">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <img src={it.url} alt="" className="w-full h-full object-cover rounded-sm border border-line" />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-ink text-white inline-flex items-center justify-center"
              aria-label={`Remove image ${it.file.name}`}
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-meta text-ink-2 truncate">
              {it.file.name} . {it.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(it.file.size / 1024))} KB` : `${(it.file.size / 1024 / 1024).toFixed(1)} MB`}
            </p>
            {showAlt && (
              <input
                className="input h-9 mt-1 text-meta"
                placeholder="Describe the image (helps screen reader users)"
                maxLength={200}
                value={it.alt}
                onChange={(e) => update(i, { alt: e.target.value })}
                aria-label={`Description for image ${i + 1}`}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
