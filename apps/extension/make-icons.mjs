// node apps/extension/make-icons.mjs — draws the toolbar icons (no dependencies).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x++) { const [r, g, b, a] = px(x + 0.5, y + 0.5); raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4); } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const GREEN = [11, 42, 31], BRASS = [176, 141, 87], WHITE = [255, 255, 255];
for (const size of [16, 32, 48, 128]) {
  const s = size / 128; // design on a 128 grid
  const inRound = (x, y, x0, y0, x1, y1, r) => { const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r); return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= x0 && x <= x1 && y >= y0 && y <= y1; };
  writeFileSync(join(here, 'icons', `icon${size}.png`), png(size, (px, py) => {
    const x = px / s, y = py / s;
    if (!inRound(x, y, 4, 4, 124, 124, 26)) return [0, 0, 0, 0];
    // brass hairline near the top, lock in white
    const ring = Math.hypot(x - 64, y - 52);
    const shackle = ring >= 17 && ring <= 27 && y <= 60 && Math.abs(x - 64) <= 27;
    const body = inRound(x, y, 30, 54, 98, 106, 10);
    const hole = Math.hypot(x - 64, y - 74) <= 8 || (Math.abs(x - 64) <= 3.5 && y >= 74 && y <= 92);
    if (body && !hole) return [...WHITE, 255];
    if (shackle) return [...BRASS, 255];
    return [...GREEN, 255];
  }));
}
console.log('icons written');
