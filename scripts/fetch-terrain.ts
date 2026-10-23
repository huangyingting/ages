/**
 * Builds the terrain heightmap for the map stage from public-domain elevation data.
 *
 * Source: AWS Open Data "Terrain Tiles" (Terrarium encoding; SRTM, GMTED2010, ETOPO1 and others, see
 * https://registry.opendata.aws/terrain-tiles/). Tiles are Web Mercator; we resample them to an equirectangular
 * grid covering the stage bounds and write `public/data/terrain/east-asia.png`:
 *   R,G = elevation as (R * 256 + G) - 11000 metres (clamped to -11000…+54535)
 *   B   = 255 for connected ocean (flood-filled from the edges); on land 0, or 1…254 = river strength
 *         (log of D8 flow accumulation after priority-flood pit filling). Inland basins (e.g. Turpan, -154 m) stay land.
 * Usage: node scripts/fetch-terrain.ts   (tiles are cached in .terrain-cache/)
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { STAGES } from '../src/shared/data/stage.ts';

const stage = STAGES.china;
const Z = 6;
const OUT_W = 2200;
const { west, east, south, north } = stage.bounds;
const OUT_H = Math.round(OUT_W * (north - south) / (east - west));
const CACHE = '.terrain-cache';
mkdirSync(CACHE, { recursive: true });

const N = 2 ** Z;
const tileX = (lon: number) => ((lon + 180) / 360) * N;
const tileY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N;
};

async function tile(x: number, y: number): Promise<PNG> {
  const f = `${CACHE}/${Z}-${x}-${y}.png`;
  if (!existsSync(f)) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(url);
      if (r.ok) { writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; }
      if (attempt > 3) throw new Error(`${url}: ${r.status}`);
      await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  return PNG.sync.read(readFileSync(f));
}

const x0 = Math.floor(tileX(west)), x1 = Math.floor(tileX(east - 1e-9));
const y0 = Math.floor(tileY(north)), y1 = Math.floor(tileY(south + 1e-9));
const tiles = new Map<string, PNG>();
const jobs: Promise<void>[] = [];
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
  jobs.push(tile(x, y).then(p => { tiles.set(`${x},${y}`, p); }));
  if (jobs.length >= 8) await Promise.all(jobs.splice(0));
}
await Promise.all(jobs);
console.log(`tiles ${tiles.size} (x ${x0}-${x1}, y ${y0}-${y1}) → ${OUT_W}×${OUT_H}`);

function elevAt(px: number, py: number): number {
  const tx = Math.floor(px / 256), ty = Math.floor(py / 256);
  const t = tiles.get(`${tx},${ty}`)!;
  const ix = Math.min(255, Math.floor(px - tx * 256)), iy = Math.min(255, Math.floor(py - ty * 256));
  const i = (iy * 256 + ix) * 4;
  return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
}

const elev = new Float32Array(OUT_W * OUT_H);
for (let j = 0; j < OUT_H; j++) {
  const lat = north - ((j + 0.5) / OUT_H) * (north - south);
  const py = tileY(lat) * 256;
  for (let i = 0; i < OUT_W; i++) {
    const lon = west + ((i + 0.5) / OUT_W) * (east - west);
    const px = tileX(lon) * 256;
    // 2×2 box sample to soften Mercator resampling at high latitudes
    elev[j * OUT_W + i] = (elevAt(px, py) + elevAt(px + 0.5, py) + elevAt(px, py + 0.5) + elevAt(px + 0.5, py + 0.5)) / 4;
  }
}

// Ocean = water (≤ 0 m) connected to the map edge.
const ocean = new Uint8Array(OUT_W * OUT_H);
const stack: number[] = [];
const push = (k: number) => { if (!ocean[k] && elev[k] <= 0) { ocean[k] = 1; stack.push(k); } };
for (let i = 0; i < OUT_W; i++) { push(i); push((OUT_H - 1) * OUT_W + i); }
for (let j = 0; j < OUT_H; j++) { push(j * OUT_W); push(j * OUT_W + OUT_W - 1); }
while (stack.length) {
  const k = stack.pop()!;
  const i = k % OUT_W, j = (k - i) / OUT_W;
  if (i > 0) push(k - 1);
  if (i < OUT_W - 1) push(k + 1);
  if (j > 0) push(k - OUT_W);
  if (j < OUT_H - 1) push(k + OUT_W);
}

// ---- Rivers: priority-flood pit filling (Barnes et al. 2014, with ε) + D8 flow accumulation ----
const W = OUT_W, H = OUT_H, NC = W * H;
const filled = new Float32Array(elev);
const done = new Uint8Array(NC);
// binary min-heap of cell indices keyed by filled elevation
const heap = new Int32Array(NC);
let hn = 0;
const less = (a: number, b: number) => filled[heap[a]] < filled[heap[b]];
const hpush = (k: number) => {
  let i = hn++; heap[i] = k;
  while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; }
};
const hpop = () => {
  const top = heap[0]; heap[0] = heap[--hn];
  let i = 0;
  for (;;) {
    const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < hn && less(l, m)) m = l;
    if (r < hn && less(r, m)) m = r;
    if (m === i) break;
    [heap[i], heap[m]] = [heap[m], heap[i]]; i = m;
  }
  return top;
};
const DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
for (let k = 0; k < NC; k++) {
  const i = k % W, j = (k - i) / W;
  if (ocean[k] || i === 0 || j === 0 || i === W - 1 || j === H - 1) { done[k] = 1; hpush(k); }
}
while (hn) {
  const k = hpop();
  const i = k % W, j = (k - i) / W;
  for (let d = 0; d < 8; d++) {
    const x = i + DX[d], y = j + DY[d];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const n = y * W + x;
    if (done[n]) continue;
    done[n] = 1;
    if (filled[n] <= filled[k]) filled[n] = filled[k] + 0.01;
    hpush(n);
  }
}
const down = new Int32Array(NC).fill(-1);
for (let k = 0; k < NC; k++) {
  if (ocean[k]) continue;
  const i = k % W, j = (k - i) / W;
  let best = -1, drop = 0;
  for (let d = 0; d < 8; d++) {
    const x = i + DX[d], y = j + DY[d];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const n = y * W + x;
    const s = (filled[k] - filled[n]) / (d === 0 || d === 2 || d === 5 || d === 7 ? Math.SQRT2 : 1);
    if (s > drop) { drop = s; best = n; }
  }
  down[k] = best;
}
// Large deep depressions are endorheic basins (Tarim, Qaidam, Junggar, Gobi…): flow ends there. Small ones are
// resampling "dams" in narrow gorges (Three Gorges, Hukou…) and are flowed through.
const sink = new Uint8Array(NC);
{
  const seen = new Uint8Array(NC);
  const deep = (k: number) => !ocean[k] && filled[k] - elev[k] > 25;
  for (let s = 0; s < NC; s++) {
    if (seen[s] || !deep(s)) continue;
    const comp: number[] = [s];
    seen[s] = 1;
    for (let q = 0; q < comp.length; q++) {
      const k = comp[q], i = k % W, j = (k - i) / W;
      for (const n of [i > 0 ? k - 1 : -1, i < W - 1 ? k + 1 : -1, j > 0 ? k - W : -1, j < H - 1 ? k + W : -1]) {
        if (n >= 0 && !seen[n] && deep(n)) { seen[n] = 1; comp.push(n); }
      }
    }
    if (comp.length > 2500) {
      // only the arid interior is truly endorheic; a big "depression" in the monsoon east (Sichuan Basin behind the
      // Three Gorges) is a resampling artefact and must drain
      let sl = 0, sb = 0;
      for (const k of comp) { sl += west + ((k % W) / W) * (east - west); sb += north - (Math.floor(k / W) / H) * (north - south); }
      const lon = sl / comp.length, lat = sb / comp.length;
      if (lon < 102 || (lat > 40 && lon < 118)) for (const k of comp) sink[k] = 1;
    }
  }
}
const order = Array.from({ length: NC }, (_, k) => k).filter(k => !ocean[k]).sort((a, b) => filled[b] - filled[a]);
const acc = new Float32Array(NC);
for (const k of order) {
  const j = Math.floor(k / W);
  const lat = north - ((j + 0.5) / H) * (north - south);
  const lon = west + (((k % W) + 0.5) / W) * (east - west);
  // crude rainfall weight: the monsoon east and south are wet, the interior is dry
  const wet = Math.min(1, Math.max(0.12, (lon - 78) / 32)) * (lat > 42 ? 0.7 : 1);
  acc[k] += Math.cos((lat * Math.PI) / 180) * wet;
  if (down[k] >= 0 && !sink[down[k]]) acc[down[k]] += acc[k];
}
const RIVER_MIN = 260;
const river = new Uint8Array(NC);
for (let k = 0; k < NC; k++) {
  if (ocean[k] || sink[k] || acc[k] < RIVER_MIN) continue;
  river[k] = Math.min(254, Math.max(1, Math.round(40 * Math.log2(acc[k] / RIVER_MIN) + 1)));
}

const png = new PNG({ width: OUT_W, height: OUT_H });
let land = 0, maxE = -1e9, minE = 1e9;
for (let k = 0; k < elev.length; k++) {
  const e = Math.max(0, Math.min(65535, Math.round(elev[k] + 11000)));
  png.data[k * 4] = e >> 8;
  png.data[k * 4 + 1] = e & 255;
  png.data[k * 4 + 2] = ocean[k] ? 255 : river[k];
  png.data[k * 4 + 3] = 255;
  if (!ocean[k]) land++;
  maxE = Math.max(maxE, elev[k]); minE = Math.min(minE, elev[k]);
}
mkdirSync('public/data/terrain', { recursive: true });
const buf = PNG.sync.write(png, { colorType: 6 });
writeFileSync('public/data/terrain/east-asia.png', buf);
console.log(`wrote public/data/terrain/east-asia.png ${(buf.length / 1024).toFixed(0)} KB · land ${(100 * land / elev.length).toFixed(1)}% · elev ${minE.toFixed(0)}…${maxE.toFixed(0)} m`);
