import type { LonLat } from '../data/types.ts';

/**
 * Compact ring codec for imported boundaries: lon/lat rounded to 0.01°, delta-encoded, zig-zag signed and written as
 * little-endian base64url VLQ digits (5 data bits + 1 continuation bit per character).
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DEC = new Int8Array(128).fill(-1);
for (let i = 0; i < 64; i++) DEC[B64.charCodeAt(i)] = i;

function vlq(n: number): string {
  let v = n < 0 ? (-n * 2) + 1 : n * 2;
  let s = '';
  do {
    let d = v % 32;
    v = Math.floor(v / 32);
    if (v) d += 32;
    s += B64[d];
  } while (v);
  return s;
}

export function encodeRing(pts: LonLat[]): string {
  let px = 0, py = 0, s = '';
  for (const [lon, lat] of pts) {
    const x = Math.round(lon * 100), y = Math.round(lat * 100);
    s += vlq(x - px) + vlq(y - py);
    px = x;
    py = y;
  }
  return s;
}

export function decodeRing(s: string): LonLat[] {
  const out: LonLat[] = [];
  let i = 0, x = 0, y = 0;
  const next = (): number => {
    let v = 0, mul = 1, d: number;
    do {
      d = DEC[s.charCodeAt(i++)];
      if (d < 0) throw new Error('bad ring encoding');
      v += (d & 31) * mul;
      mul *= 32;
    } while (d & 32);
    return v % 2 ? -(v - 1) / 2 : v / 2;
  };
  while (i < s.length) {
    x += next();
    y += next();
    out.push([x / 100, y / 100]);
  }
  return out;
}
