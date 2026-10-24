/// <reference lib="webworker" />
import { DataUtils } from 'three';

/**
 * Close-up relief: fetches AWS Terrain Tiles (Terrarium PNGs, the same public-domain source as the base heightmap)
 * for a lon/lat box at a zoom level that matches the view, and resamples them to an equirectangular grid of
 * elevations in km (half floats), like the base heightmap but up to ~30× finer.
 */
export interface DetailJob { id: number; box: [w: number, e: number, s: number, n: number]; z: number; size: number }
export type DetailResult = { id: number; data: Uint16Array | null };

const URL_T = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const MAX_TILES = 160;
const cache = new Map<string, Promise<Int16Array | null>>();

function tile(z: number, x: number, y: number): Promise<Int16Array | null> {
  const key = `${z}/${x}/${y}`;
  let p = cache.get(key);
  if (p) { cache.delete(key); cache.set(key, p); return p; }
  p = (async () => {
    try {
      const r = await fetch(`${URL_T}/${key}.png`);
      if (!r.ok) return null;
      const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const c = new OffscreenCanvas(256, 256).getContext('2d', { willReadFrequently: true })!;
      c.drawImage(bmp, 0, 0);
      const d = c.getImageData(0, 0, 256, 256).data;
      const out = new Int16Array(65536);
      for (let i = 0; i < 65536; i++) out[i] = Math.max(-32000, Math.min(32000, d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768));
      return out;
    } catch { return null; }
  })();
  cache.set(key, p);
  while (cache.size > MAX_TILES) cache.delete(cache.keys().next().value!);
  return p;
}

const mercY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};

async function run({ id, box: [w, e, s, n], z, size }: DetailJob): Promise<DetailResult> {
  const N = 2 ** z, T = 256;
  const x0 = Math.floor(((w + 180) / 360) * N), x1 = Math.floor(((e + 180) / 360) * N);
  const y0 = Math.floor(mercY(n) * N), y1 = Math.floor(mercY(s) * N);
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1;
  const tiles = await Promise.all(Array.from({ length: nx * ny }, (_, i) => tile(z, x0 + (i % nx), y0 + Math.floor(i / nx))));
  if (tiles.some(t => !t)) return { id, data: null };
  // stitch a mosaic, then sample it bilinearly for every output pixel
  const MW = nx * T, MH = ny * T, mos = new Int16Array(MW * MH);
  tiles.forEach((t, i) => {
    const ox = (i % nx) * T, oy = Math.floor(i / nx) * T;
    for (let r = 0; r < T; r++) mos.set(t!.subarray(r * T, r * T + T), (oy + r) * MW + ox);
  });
  const out = new Uint16Array(size * size);
  const px0 = x0 * T, py0 = y0 * T;
  const colX = new Float32Array(size);
  for (let i = 0; i < size; i++) colX[i] = ((w + ((i + 0.5) / size) * (e - w) + 180) / 360) * N * T - px0 - 0.5;
  for (let j = 0; j < size; j++) {
    const lat = n - ((j + 0.5) / size) * (n - s);
    const fy = Math.min(MH - 1.001, Math.max(0, mercY(lat) * N * T - py0 - 0.5));
    const iy = Math.floor(fy), ty = fy - iy, r0 = iy * MW, r1 = r0 + MW;
    for (let i = 0; i < size; i++) {
      const fx = Math.min(MW - 1.001, Math.max(0, colX[i]));
      const ix = Math.floor(fx), tx = fx - ix;
      const a = mos[r0 + ix] + (mos[r0 + ix + 1] - mos[r0 + ix]) * tx;
      const b = mos[r1 + ix] + (mos[r1 + ix + 1] - mos[r1 + ix]) * tx;
      out[j * size + i] = DataUtils.toHalfFloat((a + (b - a) * ty) / 1000);
    }
  }
  return { id, data: out };
}

self.onmessage = async (ev: MessageEvent<DetailJob>) => {
  const res = await run(ev.data);
  (self as unknown as Worker).postMessage(res, res.data ? [res.data.buffer] : []);
};
