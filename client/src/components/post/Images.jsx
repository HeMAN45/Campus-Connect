import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function Lightbox({ images, index: start = 0, onClose }) {
  const [i, setI] = useState(start);
  const img = images[i];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [images.length, onClose]);

  const nav = 'absolute top-1/2 -translate-y-1/2 h-12 w-12 inline-flex items-center justify-center rounded text-white hover:bg-white/10';
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[70] bg-[rgba(27,31,36,0.94)] flex flex-col items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button autoFocus className="absolute top-3 right-3 h-11 w-11 inline-flex items-center justify-center rounded text-white hover:bg-white/10" onClick={onClose} aria-label="Close image">
        <X size={24} />
      </button>
      {i > 0 && (
        <button className={`${nav} left-2`} onClick={() => setI(i - 1)} aria-label="Previous image">
          <ChevronLeft size={28} />
        </button>
      )}
      {i < images.length - 1 && (
        <button className={`${nav} right-2`} onClick={() => setI(i + 1)} aria-label="Next image">
          <ChevronRight size={28} />
        </button>
      )}
      <img src={img.url} alt={img.alt || ''} className="max-w-[92vw] max-h-[84vh] object-contain" />
      {(img.alt || images.length > 1) && (
        <p className="text-white/85 text-meta mt-3 text-center max-w-xl">
          {img.alt}
          {images.length > 1 && <span className="text-white/60"> {img.alt ? ' . ' : ''}{i + 1} of {images.length}</span>}
        </p>
      )}
    </div>,
    document.body,
  );
}

export function ImageGrid({ images, preview = false }) {
  const [open, setOpen] = useState(null);
  if (!images?.length) return null;
  const openAt = (e, i) => {
    e.stopPropagation();
    setOpen(i);
  };
  const imgCls = 'w-full h-full object-cover bg-surface-2';

  let body;
  if (preview) {
    const first = images[0];
    body = (
      <button type="button" onClick={(e) => openAt(e, 0)} className="relative block w-full aspect-[16/9] max-h-[360px] overflow-hidden rounded-sm border border-line" aria-label={`Open image${first.alt ? `: ${first.alt}` : ''}`}>
        <img src={first.url} alt={first.alt || ''} loading="lazy" className={imgCls} />
        {images.length > 1 && (
          <span className="absolute bottom-2 right-2 bg-ink/80 text-white text-meta font-semibold px-2 py-0.5 rounded-sm">+{images.length - 1}</span>
        )}
      </button>
    );
  } else if (images.length === 1) {
    const im = images[0];
    const ratio = im.width && im.height ? Math.max(0.6, Math.min(im.width / im.height, 2)) : 16 / 9;
    body = (
      <button type="button" onClick={(e) => openAt(e, 0)} className="block w-full overflow-hidden rounded-sm border border-line max-h-[520px]" style={{ aspectRatio: ratio }} aria-label="Open image">
        <img src={im.url} alt={im.alt || ''} className={`${imgCls} object-contain bg-surface-2`} />
      </button>
    );
  } else {
    const cells = images.length === 3 ? ['row-span-2', '', ''] : images.map(() => '');
    body = (
      <div className={`grid grid-cols-2 gap-1 ${images.length === 2 ? 'aspect-[2/1]' : 'aspect-[4/3]'} rounded-sm overflow-hidden border border-line`}>
        {images.map((im, i) => (
          <button key={im.url} type="button" onClick={(e) => openAt(e, i)} className={`overflow-hidden ${cells[i]}`} aria-label={`Open image ${i + 1}`}>
            <img src={im.url} alt={im.alt || ''} loading="lazy" className={imgCls} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      {body}
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
