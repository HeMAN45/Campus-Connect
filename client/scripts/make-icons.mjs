// Renders the "CC" app icon to PNG without any image library.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

const BG = [0x1e, 0x22, 0x27];
const FG = [0xff, 0xff, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// A "C" is a ring with an opening on the right side.
function inC(px, py, cx, cy, r, t) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d > r || d < r - t) return false;
  const angle = Math.abs(Math.atan2(dy, dx));
  return angle > 0.75;
}

function render(size, { radius, scale }) {
  const S = 4;
  const r = 0.17 * size * scale;
  const t = 0.07 * size * scale;
  const gap = 0.02 * size * scale;
  const c1 = size / 2 - r - gap / 2 + t * 0.35;
  const c2 = size / 2 + r + gap / 2 - t * 0.35 - 0.0 * size;
  const cy = size / 2;
  const rr = radius * size;
  return png(size, (x, y) => {
    let cover = 0;
    let fg = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const px = x + (sx + 0.5) / S;
        const py = y + (sy + 0.5) / S;
        const qx = Math.max(rr - px, 0, px - (size - rr));
        const qy = Math.max(rr - py, 0, py - (size - rr));
        if (rr > 0 && qx > 0 && qy > 0 && Math.hypot(qx, qy) > rr) continue;
        cover++;
        if (inC(px, py, c1, cy, r, t) || inC(px, py, c2, cy, r, t)) fg++;
      }
    }
    if (!cover) return [0, 0, 0, 0];
    const f = fg / cover;
    const mix = (i) => Math.round(BG[i] * (1 - f) + FG[i] * f);
    return [mix(0), mix(1), mix(2), Math.round((cover / (S * S)) * 255)];
  });
}

const icons = [
  ['icon-192.png', 192, { radius: 0.08, scale: 1 }],
  ['icon-512.png', 512, { radius: 0.08, scale: 1 }],
  ['maskable-512.png', 512, { radius: 0, scale: 0.78 }],
  ['apple-touch-icon.png', 180, { radius: 0, scale: 0.9 }],
  ['favicon-32.png', 32, { radius: 0.1, scale: 1.1 }],
];
for (const [name, size, opts] of icons) fs.writeFileSync(path.join(out, name), render(size, opts));
console.log(`Wrote ${icons.length} icons to ${out}`);
