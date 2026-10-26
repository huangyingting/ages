import * as THREE from 'three';

/** Width of the growth field in cells (height follows the territory canvas). */
const FIELD_W = 360;
/** Colour distance (sum of |Δ| over r, g, b, a, 0–255) under which two cells count as the same fill. */
const SAME = 40;
const MAX_GROUPS = 16;

const close = (a: Uint8ClampedArray, i: number, b: Uint8ClampedArray, j: number): boolean =>
  (a[i + 3] < 24 && b[j + 3] < 24)
  || Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]) + Math.abs(a[i + 3] - b[j + 3]) < SAME;

/** Two-pass chamfer (3-4) distance transform in place: `d` holds 0 at sources and Infinity elsewhere. */
function chamfer(d: Float32Array, w: number, h: number): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) {
      v = Math.min(v, d[i - w] + 3);
      if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + 3);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
      if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
    }
    d[i] = v;
  }
}

let dScratch: Float32Array | null = null;
let edgeScratch: Float32Array | null = null;
let histScratch = new Uint32Array(2048);

/**
 * The border morph between two territory maps (RGBA, same size): for every cell whose fill changes, the normalised
 * time (0–1) at which it switches. A cell taken over by a polity switches in order of its distance from where that
 * polity already stood, so the new owner grows outward from its old border and a retreating one shrinks back toward
 * what it keeps; a polity with no earlier ground fills in from the edges of the change. Unchanged cells are 0.
 */
export function growthField(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number): Float32Array {
  const n = w * h;
  const out = new Float32Array(n);
  // changed cells grouped by their new fill (quantised, so one watercolour fill is one group)
  const groups = new Map<number, number[]>();
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    if (close(a, j, b, j)) continue;
    changed++;
    const k = b[j + 3] < 24 ? -1 : ((b[j] >> 4) << 8) | ((b[j + 1] >> 4) << 4) | (b[j + 2] >> 4);
    const g = groups.get(k);
    if (g) g.push(i); else groups.set(k, [i]);
  }
  if (!changed) return out;
  if (!dScratch || dScratch.length !== n) dScratch = new Float32Array(n);
  const d = dScratch;
  // new ground and the thin leftovers (border lines, antialiased edges) fill in from the edges of the change
  let edge: Float32Array | null = null;
  const fromEdge = (): Float32Array => {
    if (edge) return edge;
    if (!edgeScratch || edgeScratch.length !== n) edgeScratch = new Float32Array(n);
    edge = edgeScratch;
    for (let i = 0; i < n; i++) edge[i] = close(a, i * 4, b, i * 4) ? 0 : Infinity;
    chamfer(edge, w, h);
    return edge;
  };
  // the largest fills get their own growth; at most MAX_GROUPS, so a busy change stays cheap
  const minCells = Math.max(4, changed * 0.004);
  const big = [...groups].filter(([k, c]) => k >= 0 && c.length >= minCells).sort((x, y) => y[1].length - x[1].length).slice(0, MAX_GROUPS);
  const own = new Set(big.map(([k]) => k));
  let maxVal = 0;
  for (const [k, cells] of groups) {
    let field: Float32Array;
    const seed = cells[0] * 4;
    if (!own.has(k)) field = fromEdge();
    else {
      let sources = 0;
      for (let i = 0; i < n; i++) {
        const src = close(a, i * 4, b, seed);
        d[i] = src ? 0 : Infinity;
        if (src) sources++;
      }
      if (sources) { chamfer(d, w, h); field = d; } else field = fromEdge();
    }
    for (const i of cells) {
      const v = Number.isFinite(field[i]) ? field[i] : 0;
      out[i] = v;
      if (v > maxVal) maxVal = v;
    }
  }
  // normalise by the 97th percentile via O(N) integer histogram (chamfer distances are exact integers)
  const cap = Math.ceil(maxVal);
  if (histScratch.length <= cap) histScratch = new Uint32Array(cap + 256);
  else histScratch.fill(0, 0, cap + 1);
  for (const cells of groups.values()) for (const i of cells) histScratch[out[i] | 0]++;
  const target = Math.floor(changed * 0.97);
  let acc = 0, p97 = 1;
  for (let v = 0; v <= cap; v++) {
    acc += histScratch[v];
    if (acc > target) { p97 = Math.max(1, v); break; }
  }
  for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i] / p97);
  return out;
}

let scratch: HTMLCanvasElement | null = null;
/** downsampled pixels per painted canvas: a phase's map is read back once, as the target and then as the source */
const small = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();
const pixels = (src: HTMLCanvasElement, w: number, h: number): Uint8ClampedArray => {
  const hit = small.get(src);
  if (hit && hit.length === w * h * 4) return hit;
  scratch ??= document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  small.set(src, data);
  return data;
};

/** The growth field of two painted territory canvases as a linear-filtered texture (null when nothing changes). */
export function morphTexture(from: HTMLCanvasElement, to: HTMLCanvasElement): THREE.DataTexture | null {
  const w = FIELD_W, h = Math.max(2, Math.round((FIELD_W * to.height) / to.width));
  const f = growthField(pixels(from, w, h), pixels(to, w, h), w, h);
  if (!f.some(v => v > 0)) return null;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < f.length; i++) data[i] = Math.round(f[i] * 255);
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
