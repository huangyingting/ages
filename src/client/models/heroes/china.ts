import { passerby } from '../human.ts';
import * as THREE from 'three';
import {
  type Builder, type V3, add, g, mat, box, cyl, cone, rod, strut, ellip, sweep, tube, skin, lathe, tbox, shade, fbm, hash3,
} from '../prims.ts';
import { type HFn, island, sstep, ridged, ripple, strataSide, EARTH } from '../nature.ts';

// Hero dioramas for the China collection (cn_*). Front faces +z, base at y=0, footprint radius ≈0.5.

// ---------------------------------------------------------------------------------------------------------
// Shared kit

const Y0 = 0.035;
/** Child group at (x, z) turned by ry — lets axis-aligned helpers build rotated parts. */
function grp(p: THREE.Object3D, x: number, z: number, ry = 0, y = 0): THREE.Group {
  const gr = new THREE.Group();
  gr.position.set(x, y, z);
  gr.rotation.y = ry;
  p.add(gr);
  return gr;
}
const ICO = () => g('cn:ico1', () => new THREE.IcosahedronGeometry(1, 1));
/** Low-poly faceted blob (foliage, boulders, clouds when smooth). */
function blob(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0, smooth = false): THREE.Mesh {
  return add(p, ICO(), mat(c, { flat: !smooth, rough: smooth ? 0.95 : 0.8 }), x, y, z, sx, sy, sz, ry);
}
/** Soft cumulus puff made of overlapping smooth blobs. */
function cloud(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number, n = 5): void {
  for (let i = 0; i < n; i++) {
    const a = hash3(seed, i, 1) * Math.PI * 2, d = (i === 0 ? 0 : 0.5 + hash3(seed, i, 2) * 0.5) * s;
    const r = s * (i === 0 ? 0.75 : 0.42 + hash3(seed, i, 3) * 0.3);
    blob(p, i % 2 ? '#f7f9fc' : '#eef2f7', x + Math.cos(a) * d * 1.4, y + hash3(seed, i, 4) * s * 0.18, z + Math.sin(a) * d * 0.7, r, r * 0.42, r * 0.75, a, true);
  }
}
/** Puffy sea-of-clouds layer: a bumpy smooth white sheet whose rim rolls down like a pillow; peaks poke through. */
function cloudSheet(p: THREE.Object3D, R: number, y: number, amp: number, seed: number, front = 1): void {
  const rings = 16, segs = 64, pos: number[] = [0, y + amp * 0.5, 0];
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const a = (j / segs) * Math.PI * 2, u = i / rings, x = Math.cos(a) * R * u, z = Math.sin(a) * R * u;
    // Optional thinning toward the front (+z) so foreground ground stays visible
    const fz = front < 1 ? sstep(0.12, 0.0, z) : 1;
    const bump = amp * (fbm(x * 6 + seed, 0, z * 6, 3) * 1.6 + 0.4 * Math.abs(Math.sin(x * 22 + z * 7) * Math.sin(z * 19 - x * 5)));
    const top = y + bump - (u ** 6) * (y - Y0);
    pos.push(x, Y0 - 0.01 + (top - Y0 + 0.01) * fz, z);
  }
  const vi = (i: number, j: number) => 1 + (i - 1) * segs + (j % segs), idx: number[] = [];
  for (let j = 0; j < segs; j++) idx.push(0, vi(1, j + 1), vi(1, j));
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) idx.push(vi(i, j), vi(i, j + 1), vi(i + 1, j), vi(i, j + 1), vi(i + 1, j + 1), vi(i + 1, j));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  add(p, geo, mat('#f3f6fa', { flat: false, rough: 0.95, transparent: 0.82 }), 0, 0, 0, 1, 1, 1);
}
/** Tiny visitor for scale. */
function person(p: THREE.Object3D, x: number, y: number, z: number, c: string, s = 1): void {
  passerby(p, x, y, z, 0.018 * s, 1, { top: c });
}
/** Small conifer (two stacked cones on a stub trunk). */
function minipine(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#2f5a32'): void {
  cyl(p, '#5b4030', x, y - s * 0.05, z, s * 0.07, s * 0.3, 5);
  cone(p, c, x, y + s * 0.15, z, s * 0.42, s * 0.55, 6);
  cone(p, shade(c, 1.14), x, y + s * 0.45, z, s * 0.3, s * 0.5, 6);
}
/** Broadleaf tree: trunk + two faceted crowns. */
function bush(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string): void {
  cyl(p, '#5b4030', x, y - s * 0.1, z, s * 0.1, s * 0.6, 5);
  blob(p, c, x, y + s * 0.65, z, s * 0.5, s * 0.42, s * 0.5, x * 9);
  blob(p, shade(c, 1.12), x + s * 0.12, y + s * 0.85, z + s * 0.08, s * 0.3, s * 0.26, s * 0.3, z * 7);
}
/** Flat water disc (radius R) with ripple paint at height y. */
function water(gp: THREE.Object3D, R: number, y: number, c: string): void {
  island(gp, R, () => 0, c, ripple(c), { rings: 18, segs: 96, base: y, side: () => shade(c, 0.7) });
}
/** Railing between a and b (posts + top rail). */
function rail(p: THREE.Object3D, a: V3, b: V3, h: number, c: string, sp = 0.02): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(L / sp));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    box(p, c, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 0.003, h, 0.003);
  }
  rod(p, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.0015, c, 4);
}

interface ColO { segs?: number; nf?: number; pal: string[]; moss: string; top: string; taper?: number; point?: number; jag?: number; lean?: number; wob?: number; mossT?: number }
/** Rock column / spire built from irregular rings (sandstone pillars, granite spires, karst towers). */
function column(p: THREE.Object3D, x: number, z: number, R: number, H: number, y0: number, seed: number, o: ColO): { top: V3; rAt: (f: number) => number; at: (f: number) => V3 } {
  const segs = o.segs ?? 12, nf = o.nf ?? 10, jag = o.jag ?? 0.25, taper = o.taper ?? 0.12, point = o.point ?? 0, wob = o.wob ?? 0.08;
  const flute = Array.from({ length: segs }, (_, j) => 1 - jag / 2 + jag * hash3(j, seed, 5));
  const la = hash3(seed, 2, 2) * Math.PI * 2, lean = (o.lean ?? 0.06) * (hash3(seed, 1, 2) - 0.3);
  const prof = (f: number) => (1 - taper * f) * (1 + wob * Math.sin(f * 9 + seed)) * (f > 0.86 ? 1 - ((f - 0.86) / 0.14) ** 1.5 * (0.18 + point * 0.8) : 1);
  const at = (f: number): V3 => [x + Math.cos(la) * lean * f * H, y0 + f * H, z + Math.sin(la) * lean * f * H];
  const rings: V3[][] = [];
  for (let i = 0; i <= nf; i++) {
    const f = i / nf, c = at(f), ring: V3[] = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const rr = R * prof(f) * flute[j] * (0.8 + 0.4 * fbm(Math.cos(a) * 1.2 + seed, f * 2.4, Math.sin(a) * 1.2 + seed * 1.3, 2));
      ring.push([c[0] + Math.cos(a) * rr, i === 0 ? y0 - 0.02 : c[1], c[2] + Math.sin(a) * rr]);
    }
    rings.push(ring);
  }
  skin(p, rings, o.pal[0], {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      const f = (py - y0) / H;
      if (ny > 0.55) return o.top;
      const col = Math.floor(((Math.atan2(pz - z, px - x) + Math.PI) / (Math.PI * 2)) * segs);
      const band = Math.floor(f * nf), h = hash3(Math.floor(col / 2), band, seed), mt = o.mossT ?? 0.8;
      if (f < 0.04) return shade(o.moss, 0.8);
      const ledge = hash3(band, seed, 9) > mt && hash3(col, band, seed + 2) > 0.3;
      if (ledge || h > 0.93 || (ny > 0.2 && h > mt - 0.3)) return hash3(col, band, 3) > 0.5 ? o.moss : shade(o.moss, 1.15);
      const st = hash3(col, 0, seed) * 0.7 + hash3(col, band, seed + 7) * 0.3;
      return shade(o.pal[Math.floor(st * o.pal.length)], band % 4 === 0 ? 0.9 : 1);
    },
  });
  return { top: at(1), rAt: (f: number) => R * prof(f), at };
}

// ---- East-Asian timber kit ------------------------------------------------------------------------------
interface PRoof { n: number; R0: number; R1: number; h: number; lift?: number; k?: number; rot?: number; sub?: number; tile: string; rib?: string; under?: string; sx?: number; sz?: number }
/**
 * Polygonal pagoda roof (square, hexagonal, octagonal…) with concave slope and upturned corner tips.
 * R0 = eave corner radius, R1 = top radius; optional (sx, sz) stretches it into a rectangle.
 */
function proof(p: THREE.Object3D, x: number, y: number, z: number, o: PRoof): number {
  const n = o.n, sub = o.sub ?? 4, lift = o.lift ?? 0.3, k = o.k ?? 0.55, rot = o.rot ?? Math.PI / n + Math.PI / 2, sx = o.sx ?? 1, sz = o.sz ?? 1;
  const T = [0, 0.08, 0.25, 0.5, 0.75, 1];
  const yAt = (t: number) => y + o.h * (t * (1 - k) + k * t * t);
  const ring = (t: number, dy: number): V3[] => {
    const R = o.R0 + (o.R1 - o.R0) * t, out: V3[] = [];
    for (let i = 0; i < n; i++) for (let s = 0; s < sub; s++) {
      const u = s / sub, a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
      const px = Math.cos(a0) * (1 - u) + Math.cos(a1) * u, pz = Math.sin(a0) * (1 - u) + Math.sin(a1) * u;
      const c = Math.max(0, 1 - Math.min(u, 1 - u) / 0.42) ** 2 * (1 - t) ** 1.6;
      const out2 = 1 + c * lift * 0.25;
      out.push([x + px * R * sx * out2, yAt(t) + dy + c * lift * o.R0 * 0.35, z + pz * R * sz * out2]);
    }
    return out;
  };
  const th = o.R0 * 0.05;
  const rings = [ring(0, -th), ...T.map(t => ring(t, 0))];
  const rib = o.rib ?? shade(o.tile, 1.12), under = o.under ?? shade(o.tile, 0.6);
  skin(p, rings, o.tile, {
    caps: true, flat: true,
    paint: (px, _py, pz, _nx, ny) => {
      if (ny < -0.3) return under;
      if (ny < 0.25) return shade(o.tile, 0.72);
      const a = Math.atan2(pz - z, px - x);
      return Math.floor(((a + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2) * n * sub * 3) % 2 ? rib : o.tile;
    },
  });
  return yAt(1);
}
/** Storey of a timber hall: columns around a polygon, solid wall core, a balcony with railing. */
function storey(p: THREE.Object3D, x: number, y: number, z: number, n: number, R: number, h: number, col: string, wall: string, rot = Math.PI / n + Math.PI / 2, sx = 1, sz = 1, nc = 2): void {
  for (let i = 0; i < n; i++) for (let s = 0; s < nc; s++) {
    const u = s / nc, a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
    const px = (Math.cos(a0) * (1 - u) + Math.cos(a1) * u) * R * sx, pz = (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * R * sz;
    cyl(p, col, x + px, y, z + pz, R * 0.06, h, 6);
  }
  const core = lathe(p, Array.from({ length: 2 }, (_, i) => [R * 0.86, i * h] as [number, number]), wall, x, y, z, n);
  core.rotation.y = -rot + Math.PI / 2;
  core.scale.set(sx, 1, sz);
}

// ---------------------------------------------------------------------------------------------------------
// Zhangjiajie — sandstone pillar forest, natural stone bridge and the Bailong cliff lift
const cn_zhangjiajie: Builder = gp => {
  const PAL = ['#b9ad95', '#a69a83', '#c8bda5', '#958a76', '#afa18a'], MOSS = '#4c7a3a', TOP = '#3f6b33';
  const h: HFn = (x, z) => 0.025 * fbm(x * 7, 1, z * 7, 3) + 0.02 * sstep(0.3, 0.5, Math.hypot(x, z));
  island(gp, 0.5, h, '#3f6b35', (x, _y, z) => {
    const f = fbm(x * 14, 2, z * 14, 2), c = hash3(Math.floor(x * 70), 1, Math.floor(z * 70));
    return f > 0.58 ? '#4e8040' : f < 0.4 ? '#30562c' : c > 0.85 ? '#5a8a44' : null;
  }, { rings: 26, segs: 80, side: strataSide(['#7a6a55', '#6a5a46', '#857560']) });
  const P: [number, number, number, number][] = [
    [0.0, -0.05, 0.06, 0.85], [-0.13, -0.12, 0.045, 0.66], [0.12, -0.14, 0.05, 0.72], [-0.24, -0.2, 0.05, 0.58], [-0.36, -0.1, 0.045, 0.56],
    [0.24, -0.26, 0.045, 0.6], [0.03, -0.26, 0.045, 0.62], [-0.1, -0.36, 0.04, 0.5], [0.12, -0.4, 0.04, 0.46], [-0.3, -0.33, 0.04, 0.44],
    [0.08, 0.08, 0.04, 0.42], [-0.11, 0.05, 0.045, 0.48], [-0.25, 0.02, 0.04, 0.38], [0.22, 0.0, 0.035, 0.34], [-0.38, 0.12, 0.035, 0.26],
    [0.33, 0.17, 0.035, 0.24], [-0.2, 0.24, 0.03, 0.2], [0.16, 0.25, 0.03, 0.18], [-0.04, 0.2, 0.032, 0.26], [0.42, -0.25, 0.035, 0.36],
    [-0.44, -0.25, 0.035, 0.3],
  ];
  const tops: { top: V3; R: number }[] = [];
  P.forEach(([x, z, R, H], i) => {
    const y0 = Y0 + h(x, z);
    const c = column(gp, x, z, R, H, y0, i * 3 + 1, { pal: PAL, moss: MOSS, top: TOP, segs: 10, nf: 12, jag: 0.35, taper: 0.06, wob: 0.06, lean: 0.03, mossT: 0.78 });
    tops.push({ top: c.top, R: c.rAt(1) });
    // Pine crown on the flat summit + shrubs clinging to ledges
    const n = Math.max(3, Math.round(R * 75));
    for (let k = 0; k < n; k++) {
      const a = hash3(i, k, 3) * Math.PI * 2, d = Math.sqrt(hash3(i, k, 4)) * c.rAt(1) * 0.8;
      const s = 0.03 + hash3(i, k, 5) * 0.025;
      if (k % 3 === 0) blob(gp, k % 2 ? '#3d6b32' : '#4f8040', c.top[0] + Math.cos(a) * d, c.top[1] + s * 0.3, c.top[2] + Math.sin(a) * d, s * 0.7, s * 0.45, s * 0.7, a);
      else minipine(gp, c.top[0] + Math.cos(a) * d, c.top[1], c.top[2] + Math.sin(a) * d, s * 1.1, k % 2 ? '#2f5a32' : '#3b6a3a');
    }
    for (let k = 0; k < 3; k++) {
      const f = 0.25 + hash3(i, k, 7) * 0.55, a = hash3(i, k, 8) * Math.PI * 2, q = c.at(f), rr = c.rAt(f) * 0.95;
      blob(gp, '#4a7a3a', q[0] + Math.cos(a) * rr, q[1], q[2] + Math.sin(a) * rr, 0.016, 0.012, 0.016, a);
    }
  });
  // "First Bridge Under Heaven": a natural rock arch between two pillar tops
  const A = tops[3].top, Bp = tops[4].top, yb = Math.min(A[1], Bp[1]) - 0.035;
  sweep(gp, [0, 0.25, 0.5, 0.75, 1].map(t => ({ p: [A[0] + (Bp[0] - A[0]) * t, yb + Math.sin(t * Math.PI) * 0.012, A[2] + (Bp[2] - A[2]) * t] as V3, w: 0.02 - Math.sin(t * Math.PI) * 0.006, h: 0.012 })), '#a99c84', { radial: 7, sub: 3, flat: true });
  for (const t of [0.35, 0.55, 0.7]) minipine(gp, A[0] + (Bp[0] - A[0]) * t, yb + 0.02, A[2] + (Bp[2] - A[2]) * t, 0.03);
  // Bailong lift: steel shaft hugging a broad cliff massif on the right
  const cx = 0.36, cz = -0.08, cl = column(gp, cx, cz, 0.075, 0.66, Y0 + h(cx, cz), 99, { pal: PAL, moss: MOSS, top: TOP, segs: 12, nf: 11, jag: 0.2, taper: 0.05 });
  for (let k = 0; k < 6; k++) minipine(gp, cl.top[0] + (hash3(k, 2, 1) - 0.5) * 0.09, cl.top[1], cl.top[2] + (hash3(k, 3, 1) - 0.5) * 0.09, 0.035);
  const ex = cx - 0.035, ez = cz + 0.085, eh = cl.top[1] + 0.02;
  box(gp, '#7d868d', ex, Y0 + h(ex, ez), ez, 0.026, eh - Y0, 0.024);
  for (let y = Y0 + 0.02; y < eh; y += 0.03) box(gp, '#a9cbe0', ex, y, ez + 0.0125, 0.02, 0.022, 0.002);
  box(gp, '#e5e7eb', ex, 0.36, ez + 0.006, 0.018, 0.022, 0.016);
  box(gp, '#7d868d', ex + 0.02, eh - 0.004, ez - 0.02, 0.05, 0.006, 0.012, 0.6);
  // Mist drifting between the pillars
  cloud(gp, -0.02, 0.16, 0.12, 0.08, 1);
  cloud(gp, 0.2, 0.3, -0.1, 0.07, 2);
  cloud(gp, -0.22, 0.22, -0.08, 0.08, 3);
  cloud(gp, 0.06, 0.42, -0.24, 0.06, 4, 4);
  cloud(gp, -0.2, 0.36, -0.3, 0.06, 5, 4);
};

// ---------------------------------------------------------------------------------------------------------
// Li River at Xingping — karst towers, bamboo raft with a cormorant fisherman
const rivX = (z: number) => 0.07 * Math.sin(z * 5.2 + 0.5) - 0.06 * z;
function karstHill(p: THREE.Object3D, x: number, z: number, R: number, H: number, y0: number, seed: number): void {
  const segs = 14, nf = 12, la = hash3(seed, 2, 2) * Math.PI * 2, lean = (hash3(seed, 1, 2) - 0.5) * 0.25;
  const flute = Array.from({ length: segs }, (_, j) => 0.85 + 0.3 * hash3(j, seed, 5));
  const rings: V3[][] = [];
  for (let i = 0; i <= nf; i++) {
    const f = (i / nf) * 0.99, rf = Math.pow(Math.max(0, 1 - f ** 3), 0.36);
    const ring: V3[] = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const rr = R * rf * flute[j] * (0.8 + 0.4 * fbm(Math.cos(a) + seed, f * 2, Math.sin(a) + seed, 2));
      const off = lean * f * f * H;
      ring.push([x + Math.cos(a) * rr + Math.cos(la) * off, y0 - 0.01 + f * H, z + Math.sin(a) * rr + Math.sin(la) * off]);
    }
    rings.push(ring);
  }
  skin(p, rings, '#4f7d3c', {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      const f = (py - y0) / H, col = Math.floor(((Math.atan2(pz - z, px - x) + Math.PI) / (Math.PI * 2)) * segs);
      const hh = hash3(Math.floor(col / 2), Math.floor(f * nf * 0.5), seed);
      if (ny < 0.3 && hh > 0.6 && f > 0.1 && f < 0.85) return hash3(col, Math.floor(f * nf), 1) > 0.5 ? '#a7a091' : '#8c877b';
      return hh > 0.7 ? '#5a8a44' : hh < 0.25 ? '#3a6331' : f > 0.75 ? '#4a7a3a' : null;
    },
  });
}
const cn_guilin: Builder = gp => {
  const WC = '#5c9a8e', WL = Y0 - 0.002, Wd = 0.095;
  water(gp, 0.49, WL - 0.004, WC);
  const h: HFn = (x, z) => { const d = Math.abs(x - rivX(z)); return -0.014 + 0.026 * sstep(Wd * 0.75, Wd * 1.3, d) + 0.008 * fbm(x * 8, 3, z * 8, 2) * sstep(Wd, Wd * 2, d); };
  island(gp, 0.5, h, '#7aa04c', (x, y, z) => {
    if (y < WL + 0.003) return '#b9ad8a';
    const ci = Math.floor((x + 1) * 26), cj = Math.floor((z + 1) * 26), hh = hash3(ci, 7, cj);
    return hh > 0.75 ? '#8fb556' : hh > 0.5 ? '#79a648' : hh < 0.1 ? '#b8b25a' : null;
  }, { rings: 34, segs: 96, side: strataSide(EARTH) });
  const hills: [number, number, number, number, number][] = [
    [-1, -0.34, 0.09, 0.5, 0.0], [-1, -0.12, 0.075, 0.38, 0.0], [-1, 0.1, 0.06, 0.25, 0.02], [-1, -0.25, 0.07, 0.3, 0.13], [-1, -0.02, 0.06, 0.22, 0.16],
    [-1, 0.28, 0.05, 0.14, 0.02], [1, -0.32, 0.08, 0.4, 0.0], [1, -0.09, 0.075, 0.56, 0.0], [1, 0.14, 0.065, 0.3, 0.0], [1, -0.22, 0.06, 0.3, 0.14],
    [1, 0.06, 0.055, 0.2, 0.17], [1, 0.32, 0.045, 0.12, 0.02], [-1, -0.42, 0.06, 0.28, 0.12], [1, -0.4, 0.05, 0.24, 0.14],
  ];
  hills.forEach(([sd, z, R, H, dd], i) => {
    const x = rivX(z) + sd * (Wd + R * 0.85 + dd);
    if (Math.hypot(x, z) + R > 0.5) return;
    karstHill(gp, x, z, R, H, Y0 + h(x, z), i * 5 + 2);
  });
  // Bamboo clumps along both banks
  for (let i = 0; i < 14; i++) {
    const z = -0.3 + i * 0.05, sd = i % 2 ? 1 : -1, x = rivX(z) + sd * (Wd + 0.012 + hash3(i, 1, 1) * 0.01);
    if (Math.hypot(x, z) > 0.46) continue;
    for (let k = 0; k < 4; k++) {
      const rz = (hash3(i, k, 2) - 0.5) * 0.6, rx = (hash3(i, k, 3) - 0.5) * 0.6, hh = 0.05 + hash3(i, k, 4) * 0.03;
      add(gp, g('cn:cone5', () => new THREE.ConeGeometry(0.5, 1, 5)), mat(k % 2 ? '#7fb04a' : '#6a9a3e'), x + rz * 0.02, Y0 + h(x, z) + hh / 2, z + rx * 0.02, 0.014, hh, 0.014, 0, rx, rz);
    }
  }
  // Riverside village houses (white walls, grey roofs)
  for (const [x, z, ry] of [[0.2, 0.3, 0.3], [0.25, 0.25, 0.1], [0.17, 0.37, 0.5]] as const) {
    const y = Y0 + h(x, z);
    box(gp, '#f1ede4', x, y, z, 0.034, 0.024, 0.024, ry);
    const gr = grp(gp, x, z, ry, y + 0.024);
    add(gr, g('cn:gable', () => { const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.5)]); const eg = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); eg.translate(0, 0, -0.5); return eg; }), mat('#4b5560'), 0, 0, 0, 0.032, 0.03, 0.04, Math.PI / 2);
  }
  // Bamboo raft: seven poles, a fisherman in a straw hat with his pole, two cormorants and a lantern
  const rz0 = 0.28, rr = grp(gp, rivX(rz0), rz0, -0.35, WL);
  for (let k = 0; k < 7; k++) {
    const m = add(rr, g('cn:cyl6', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6)), mat(k % 2 ? '#c9b26b' : '#b39b55'), (k - 3) * 0.0065, 0.002, 0, 0.0064, 0.12, 0.0064, 0, Math.PI / 2);
    m.position.z = 0;
  }
  box(rr, '#a88f4f', 0, 0.004, 0.05, 0.05, 0.004, 0.006);
  cyl(rr, '#2f4a6b', 0, 0.005, -0.01, 0.0055, 0.03, 6);
  box(rr, '#e2b48a', 0, 0.035, -0.01, 0.007, 0.008, 0.007);
  cone(rr, '#e3c77a', 0, 0.043, -0.01, 0.017, 0.012, 10);
  rod(rr, [0.004, 0.02, -0.008], [0.03, 0.09, -0.045], 0.0012, '#6b4f2a', 4);
  for (const [cx, cz] of [[-0.012, 0.03], [0.012, 0.035]]) {
    blob(rr, '#1f2328', cx, 0.014, cz, 0.006, 0.008, 0.009);
    blob(rr, '#1f2328', cx, 0.024, cz + 0.004, 0.0035);
    box(rr, '#e2a33a', cx, 0.022, cz + 0.009, 0.002, 0.002, 0.006);
  }
  cyl(rr, '#d03a2a', 0, 0.006, -0.05, 0.005, 0.01, 8);
  // Tour boat further upstream
  const bz = -0.16, bt = grp(gp, rivX(bz), bz, 0.25, WL);
  box(bt, '#f3f4f6', 0, -0.002, 0, 0.032, 0.012, 0.1);
  box(bt, '#1e3a8a', 0, 0.01, 0.0, 0.03, 0.002, 0.07);
  box(bt, '#bcd3e6', 0, 0.01, 0.0, 0.028, 0.008, 0.065);
  box(bt, '#2563eb', 0, 0.018, 0.0, 0.034, 0.003, 0.075);
  // Low drifting mist behind the towers
  cloud(gp, -0.2, 0.3, -0.38, 0.06, 7);
  cloud(gp, 0.22, 0.26, -0.3, 0.05, 8);
};

// ---------------------------------------------------------------------------------------------------------
// Huangshan — granite spires above a sea of clouds, the Welcoming-Guest Pine and the Flying-Over Rock
function guestPine(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const T = '#5a3f2c', F = '#2f5a2e', F2 = '#3c6b36';
  tube(p, [[x, y, z], [x + 0.01 * s, y + 0.07 * s, z], [x - 0.004 * s, y + 0.15 * s, z], [x + 0.006 * s, y + 0.22 * s, z]], 0.012 * s, 0.007 * s, T, { radial: 7 });
  // The long "welcoming arm" reaching out to the side
  tube(p, [[x, y + 0.1 * s, z], [x - 0.06 * s, y + 0.11 * s, z + 0.01 * s], [x - 0.13 * s, y + 0.1 * s, z + 0.03 * s], [x - 0.2 * s, y + 0.105 * s, z + 0.04 * s]], 0.007 * s, 0.004 * s, T, { radial: 6 });
  tube(p, [[x, y + 0.17 * s, z], [x + 0.06 * s, y + 0.18 * s, z - 0.01 * s], [x + 0.09 * s, y + 0.2 * s, z]], 0.005 * s, 0.003 * s, T, { radial: 6 });
  const pads: [number, number, number, number][] = [
    [-0.2, 0.12, 0.04, 0.045], [-0.13, 0.115, 0.03, 0.05], [-0.06, 0.125, 0.015, 0.045], [0.0, 0.24, 0.0, 0.06],
    [0.04, 0.2, -0.01, 0.05], [0.09, 0.215, 0.0, 0.04], [-0.03, 0.19, 0.01, 0.045], [0.02, 0.29, 0.0, 0.04],
  ];
  pads.forEach(([dx, dy, dz, r], i) => blob(p, i % 2 ? F : F2, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.32, r * s * 0.8, i));
}
const cn_huangshan: Builder = gp => {
  const GR = ['#a49b92', '#8f877f', '#b6ada2', '#7f786f', '#9c948a'];
  const h: HFn = (x, z) => 0.05 * ridged(x * 4 + 3, z * 4, 3) + 0.06 * sstep(0.45, 0.0, Math.hypot(x, z + 0.1));
  island(gp, 0.5, h, '#355f33', (x, y, z, _nx, ny) => {
    if (ny < 0.6) return hash3(Math.floor(x * 80), 2, Math.floor(z * 80)) > 0.5 ? '#8a827a' : '#6f6962';
    const f = fbm(x * 12, y * 10, z * 12, 2);
    return f > 0.58 ? '#447a3c' : f < 0.4 ? '#2b5129' : null;
  }, { rings: 26, segs: 80, side: strataSide(['#7a736b', '#6a645d', '#857e75']) });
  const S: [number, number, number, number][] = [
    [0.0, -0.1, 0.09, 0.78], [-0.17, -0.16, 0.075, 0.62], [0.18, -0.2, 0.07, 0.58], [-0.31, -0.02, 0.06, 0.44], [0.31, -0.04, 0.06, 0.46],
    [-0.07, -0.32, 0.065, 0.52], [0.1, -0.35, 0.06, 0.44], [-0.28, -0.28, 0.055, 0.4], [0.32, -0.27, 0.05, 0.36], [-0.12, 0.06, 0.045, 0.3], [0.14, 0.0, 0.05, 0.36],
  ];
  const tops: V3[] = [];
  S.forEach(([x, z, R, H], i) => {
    const y0 = Y0 + h(x, z), c = column(gp, x, z, R, H, y0, i * 7 + 3, { pal: GR, moss: '#3a6a36', top: '#8f877f', segs: 10, nf: 12, jag: 0.5, taper: 0.62, point: 1, wob: 0.12, lean: 0.12 });
    tops.push(c.top);
    // Pines clinging to the granite ledges
    for (let k = 0; k < 4 + Math.round(R * 40); k++) {
      const f = 0.15 + hash3(i, k, 1) * 0.6, a = hash3(i, k, 2) * Math.PI * 2, q = c.at(f), rr = c.rAt(f) * 0.9;
      minipine(gp, q[0] + Math.cos(a) * rr, q[1], q[2] + Math.sin(a) * rr, 0.022 + hash3(i, k, 3) * 0.014, k % 2 ? '#2f5a2e' : '#3c6b36');
    }
  });
  // Flying-Over Rock perched on a summit
  const fr = tops[4];
  blob(gp, '#a8a097', fr[0], fr[1] + 0.03, fr[2], 0.018, 0.04, 0.02, 0.4);
  // Sea of clouds swirling between the spires
  const C: [number, number, number][] = [[-0.2, 0.08, 0.2], [0.05, 0.06, 0.24], [0.28, 0.1, 0.16], [-0.38, -0.12, 0.13], [0.4, -0.15, 0.14],
    [-0.15, -0.24, 0.17], [0.05, -0.22, 0.15], [0.25, -0.38, 0.13], [-0.32, 0.22, 0.11], [-0.02, 0.36, 0.1], [-0.42, 0.06, 0.12]];
  cloudSheet(gp, 0.47, 0.16, 0.045, 3);
  C.forEach(([x, z], i) => cloud(gp, x, 0.2 + hash3(i, 5, 5) * 0.03, z, 0.085, i + 11, 6));
  // Granite lookout with the Welcoming-Guest Pine; a second outcrop carries the viewing terrace and visitors
  const px = 0.25, pz = 0.27, py = Y0 + h(px, pz);
  const lk = column(gp, px, pz, 0.08, 0.26, py, 77, { pal: GR, moss: '#3a6a36', top: '#8f877f', segs: 10, nf: 7, jag: 0.4, taper: 0.25, wob: 0.1, lean: 0 });
  guestPine(gp, px - 0.01, lk.top[1] - 0.01, pz - 0.01, 1.15);
  const vx = -0.14, vz = 0.3, vk = column(gp, vx, vz, 0.085, 0.22, Y0 + h(vx, vz), 78, { pal: GR, moss: '#3a6a36', top: '#8f877f', segs: 10, nf: 6, jag: 0.35, taper: 0.15, wob: 0.08, lean: 0 });
  const vy = vk.top[1] - 0.008;
  box(gp, '#c9c1b4', vx, vy, vz, 0.13, 0.012, 0.1, 0.15);
  rail(gp, [vx - 0.06, vy + 0.012, vz + 0.055], [vx + 0.06, vy + 0.012, vz + 0.04], 0.014, '#e6e0d4');
  for (const [dx, c] of [[-0.03, '#dc2626'], [0.0, '#2563eb'], [0.03, '#f59e0b']] as const) person(gp, vx + dx, vy + 0.012, vz + 0.02, c, 1.2);
  minipine(gp, vx + 0.05, vy + 0.01, vz - 0.03, 0.05);
};

// ---- More kit -------------------------------------------------------------------------------------------
/** Flat water / pool surface over a plan outline [x, z][] at height y (optionally see-through). */
function pool(p: THREE.Object3D, outline: [number, number][], y: number, c: string, op?: number): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z))), 4);
  geo.rotateX(-Math.PI / 2);
  return add(p, geo, mat(c, op === undefined ? { rough: 0.3 } : { transparent: op, rough: 0.2 }), 0, y, 0, 1, 1, 1);
}
/** Ellipse outline in plan, optionally wobbled. */
const oval = (cx: number, cz: number, rx: number, rz: number, n = 28, wob = 0, seed = 1): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, k = 1 + wob * (fbm(Math.cos(a) * 2 + seed, 1, Math.sin(a) * 2, 2) - 0.5);
    return [cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k] as [number, number];
  });
/**
 * Rectangular timber hall: wall block, a row of red columns and a green bracket band on the front,
 * hip roof with upturned corners. Returns the roof ridge height.
 */
function hall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, roof: string, ry = 0, wall = '#b0372b', o: { rh?: number; ov?: number; lift?: number; col?: string; band?: string } = {}): number {
  const gr = grp(p, x, z, ry, y);
  box(gr, wall, 0, 0, 0, w, h, d);
  const nc = Math.max(2, Math.round(w / 0.024)), cr = Math.min(0.0042, w * 0.05);
  for (let i = 0; i <= nc; i++) cyl(gr, o.col ?? '#8f1f1a', -w / 2 + (i / nc) * w, 0, d / 2 + cr * 0.6, cr, h, 5);
  const bh = Math.min(0.008, h * 0.18);
  box(gr, o.band ?? '#2f7d6d', 0, h - bh, 0, w + 0.004, bh, d + 0.004);
  const ov = o.ov ?? 1.35, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  return y + proof(gr, 0, h, 0, { n: 4, R0, R1: R0 * 0.3, h: o.rh ?? d * 0.42, lift: o.lift ?? 0.35, tile: roof, sx: (w + d * (ov - 1)) / (d * ov) });
}
/** Calabash (gourd) finial on a spike — the golden tip of pagodas and towers. */
function gourd(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#e8b23a'): void {
  lathe(p, [[0, 0], [0.4, 0.05], [0.55, 0.25], [0.3, 0.48], [0.42, 0.66], [0.2, 0.9], [0, 1]].map(([r, v]) => [r * s, v * s * 1.6] as [number, number]), c, x, y, z, 8);
  rod(p, [x, y + s * 1.5, z], [x, y + s * 2.4, z], s * 0.06, c, 4);
}
/** Drooping willow (light green curtain) or blossoming peach. */
function willow(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#9cc56a'): void {
  cyl(p, '#5b4636', x, y, z, s * 0.07, s * 0.55, 5);
  blob(p, c, x, y + s * 0.62, z, s * 0.4, s * 0.3, s * 0.4, x * 7);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + x * 5;
    blob(p, shade(c, k % 2 ? 0.9 : 1.08), x + Math.cos(a) * s * 0.24, y + s * 0.38, z + Math.sin(a) * s * 0.24, s * 0.16, s * 0.3, s * 0.16, a);
  }
}

// ---------------------------------------------------------------------------------------------------------
// West Lake, Hangzhou — Leifeng Pagoda on its hill, Bai Causeway willows, the Broken Bridge, Three Pools lanterns
const cn_westlake: Builder = gp => {
  const WC = '#6aa6a0', WL = Y0 - 0.002;
  water(gp, 0.49, WL - 0.004, WC);
  const ax = -0.42, az = -0.1, bx = -0.04, bz = 0.46, L = Math.hypot(bx - ax, bz - az);
  const along = (x: number, z: number) => ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L);
  const cdist = (x: number, z: number) => { const t = Math.max(0, Math.min(1, along(x, z))); return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t); };
  const GAP = [0.7, 0.78];
  const hill = (x: number, z: number) => 0.16 * sstep(1, 0.25, Math.hypot((x - 0.06) / 0.46, (z + 0.42) / 0.24)) + 0.02 * fbm(x * 9, 4, z * 9, 2) * sstep(1, 0.5, Math.hypot((x - 0.06) / 0.46, (z + 0.42) / 0.24));
  const h: HFn = (x, z) => {
    const t = along(x, z), gap = t > GAP[0] && t < GAP[1] ? 1 : 0;
    const cw = gap ? -0.03 : 0.03 * sstep(0.034, 0.022, cdist(x, z));
    return Math.max(hill(x, z), cw) - 0.02;
  };
  island(gp, 0.5, h, '#4f8244', (x, y, z) => {
    if (y < WL + 0.004) return '#b9ad8a';
    if (cdist(x, z) < 0.04 && hill(x, z) < 0.02) return cdist(x, z) < 0.009 ? '#d6ccb2' : '#7fb35a';
    const f = fbm(x * 16, 2, z * 16, 2);
    return f > 0.6 ? '#5d9450' : f < 0.4 ? '#3c6c38' : null;
  }, { rings: 30, segs: 96, side: strataSide(EARTH) });
  // Leifeng Pagoda — octagonal, five storeys of bronze-tiled eaves
  const px = 0.06, pz = -0.36, py = Y0 + h(px, pz);
  lathe(gp, [[0, 0], [0.105, 0], [0.105, 0.025], [0.09, 0.025], [0.09, 0.035], [0, 0.035]], '#cdbfa5', px, py - 0.01, pz, 8);
  rail(gp, [px - 0.08, py + 0.025, pz + 0.07], [px + 0.08, py + 0.025, pz + 0.07], 0.01, '#efe8da');
  let y = py + 0.025;
  for (let i = 0; i < 5; i++) {
    const R = 0.066 - i * 0.004, sh = i === 0 ? 0.06 : 0.048;
    storey(gp, px, y, pz, 8, R, sh, '#9b2f22', '#e9cf98', undefined, 1, 1, 2);
    y += sh;
    box(gp, '#2f6f62', px, y - 0.008, pz, R * 1.7, 0.008, R * 1.7, Math.PI / 8);
    y = proof(gp, px, y, pz, { n: 8, R0: R * 1.62, R1: R * 0.86, h: 0.022, lift: 0.5, tile: '#8a5a2e', rib: '#a8743e', under: '#6a3a22' }) - 0.004;
  }
  y = proof(gp, px, y, pz, { n: 8, R0: 0.06, R1: 0.004, h: 0.05, lift: 0.4, tile: '#8a5a2e', rib: '#a8743e' });
  gourd(gp, px, y - 0.004, pz, 0.02);
  // Wooded hill around the pagoda
  for (let i = 0; i < 46; i++) {
    const x = -0.36 + hash3(i, 1, 9) * 0.8, z = -0.46 + hash3(i, 2, 9) * 0.3;
    if (Math.hypot(x, z) > 0.46 || Math.hypot(x - px, (z - pz) * 1.3) < 0.13 || hill(x, z) < 0.03) continue;
    const s = 0.03 + hash3(i, 3, 9) * 0.02, c = ['#3d6e38', '#4f8244', '#2f5a32', '#5d9450', '#e6a0b8'][i % 5];
    blob(gp, c, x, Y0 + h(x, z) + s * 0.5, z, s, s * 0.8, s, i);
  }
  // Bai Causeway: willows and peach blossom, strollers, the Broken Bridge arching over the gap
  for (let i = 0; i < 16; i++) {
    const t = 0.05 + i * 0.058;
    if (t > GAP[0] - 0.04 && t < GAP[1] + 0.03) continue;
    const sd = i % 2 ? 1 : -1, nx = (bz - az) / L, nz = -(bx - ax) / L;
    const x = ax + (bx - ax) * t + nx * sd * 0.022, z = az + (bz - az) * t + nz * sd * 0.022;
    if (Math.hypot(x, z) > 0.47) continue;
    willow(gp, x, Y0 + h(x, z), z, 0.07, i % 3 === 0 ? '#f0a6c0' : '#9cc56a');
  }
  for (const [t, c] of [[0.3, '#dc2626'], [0.34, '#2563eb'], [0.55, '#f59e0b'], [0.9, '#16a34a']] as const) {
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    person(gp, x, Y0 + h(x, z), z, c, 1.2);
  }
  {
    const t = (GAP[0] + GAP[1]) / 2, x = ax + (bx - ax) * t, z = az + (bz - az) * t, ry = Math.atan2(-(bz - az), bx - ax);
    const br = grp(gp, x, z, ry, WL), hl = (GAP[1] - GAP[0]) * L * 0.5 + 0.03;
    const deck = [-1, -0.5, 0, 0.5, 1].map(u => ({ p: [u * hl, 0.012 + 0.026 * (1 - u * u), 0] as V3, w: 0.016, h: 0.006 }));
    sweep(br, deck, '#ddd6c6', { radial: 6, sub: 3, flat: true, up: [0, 0, 1] });
    for (const sd of [-1, 1]) {
      add(br, g('cn:arch', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, -Math.PI / 2, Math.PI)), mat('#2c3e3a'), 0, 0, sd * 0.0165, hl * 0.42, 0.002, hl * 0.42, 0, Math.PI / 2);
      for (let k = -4; k <= 4; k++) { const u = k / 4; box(br, '#f3efe6', u * hl * 0.95, 0.018 + 0.026 * (1 - u * u), sd * 0.014, 0.003, 0.009, 0.003); }
    }
  }
  // Three Pools Mirroring the Moon — stone lanterns standing in the lake
  for (const [x, z] of [[0.2, 0.12], [0.3, 0.2], [0.17, 0.26]] as const) {
    lathe(gp, [[0, 0], [0.006, 0], [0.006, 0.012], [0.016, 0.016], [0.017, 0.03], [0.01, 0.04], [0.004, 0.048], [0, 0.054]], '#b3ad9f', x, WL - 0.004, z, 6);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; box(gp, '#3a3a36', x + Math.cos(a) * 0.016, WL + 0.016, z + Math.sin(a) * 0.016, 0.006, 0.007, 0.006, -a); }
  }
  // Painted canopy rowboat and lotus pads
  const bt = grp(gp, 0.06, 0.06, 0.5, WL);
  sweep(bt, [-0.05, -0.03, 0, 0.03, 0.05].map((u, i) => ({ p: [0, 0.006 + (i === 0 || i === 4 ? 0.006 : 0), u] as V3, w: i === 0 || i === 4 ? 0.003 : i === 2 ? 0.015 : 0.012, h: 0.007 })), '#8a5a32', { radial: 8, sub: 3, squash: 0.6, flat: true });
  add(bt, g('cn:awning', () => { const c = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true, Math.PI / 2, Math.PI); c.rotateX(Math.PI / 2); return c; }), mat('#2b2b2b'), 0, 0.012, 0, 0.026, 0.026, 0.04);
  box(bt, '#e2b48a', 0, 0.012, -0.036, 0.006, 0.014, 0.006);
  cone(bt, '#e3c77a', 0, 0.026, -0.036, 0.012, 0.008, 8);
  rod(bt, [0.004, 0.02, -0.038], [0.02, 0.0, -0.075], 0.0012, '#6b4f2a', 4);
  for (let i = 0; i < 14; i++) {
    const x = 0.28 + (hash3(i, 1, 4) - 0.5) * 0.16, z = 0.36 + (hash3(i, 2, 4) - 0.5) * 0.12;
    if (Math.hypot(x, z) > 0.47) continue;
    cyl(gp, i % 2 ? '#4f8a3c' : '#5f9a44', x, WL, z, 0.012 + hash3(i, 3, 4) * 0.006, 0.002, 7);
    if (i % 3 === 0) cone(gp, '#f08bb0', x, WL + 0.002, z, 0.006, 0.012, 6);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Yellow Crane Tower, Wuhan — five golden-roofed storeys with cross-plan wings, on Snake Hill
const cn_yellowcrane: Builder = gp => {
  const WC = '#7a9fa6', WL = Y0 - 0.004;
  water(gp, 0.49, WL - 0.004, WC);
  const h: HFn = (x, z) => 0.1 * sstep(0.46, 0.14, Math.hypot(x, (z + 0.06) * 1.15)) + 0.01 * fbm(x * 8, 2, z * 8, 2) - 0.03 * sstep(0.34, 0.44, z + x * 0.25);
  island(gp, 0.5, h, '#5f8f45', (x, y, z) => {
    if (y < WL + 0.006) return '#b5a582';
    const f = fbm(x * 14, 3, z * 14, 2);
    return f > 0.62 ? '#6fa052' : f < 0.38 ? '#4c7a3a' : null;
  }, { rings: 28, segs: 84, side: strataSide(EARTH) });
  const tx = 0, tz = -0.08, ty = Y0 + h(tx, tz) + 0.002;
  // White marble terrace with balustrade and front stairs
  box(gp, '#ece6d8', tx, ty - 0.03, tz, 0.36, 0.034, 0.34);
  for (const [a, b] of [[[-0.18, 0.17], [-0.03, 0.17]], [[0.03, 0.17], [0.18, 0.17]], [[-0.18, -0.17], [0.18, -0.17]], [[-0.18, -0.17], [-0.18, 0.17]], [[0.18, -0.17], [0.18, 0.17]]] as const)
    rail(gp, [tx + a[0], ty + 0.004, tz + a[1]], [tx + b[0], ty + 0.004, tz + b[1]], 0.01, '#f7f3ea', 0.03);
  for (let i = 0; i < 9; i++) { const z = tz + 0.18 + i * 0.016; box(gp, '#e2dccd', tx, Y0 + h(tx, z + 0.008) - 0.004, z, 0.06, ty - (Y0 + h(tx, z + 0.008)) - i * 0.0005 + 0.004 - i * 0.002, 0.016); }
  // Storeys: square core, a wing on every side (cross plan), each with its own upturned golden eaves
  const GOLD = '#e8a92e', GOLD2 = '#f4c552', RED = '#b8322a';
  let y = ty + 0.004;
  for (let i = 0; i < 5; i++) {
    const s = 0.085 - i * 0.009, sh = i === 0 ? 0.075 : 0.06, ww = s * 1.15, wd = s * 0.42;
    box(gp, RED, tx, y, tz, s * 2, sh, s * 2);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, ox = Math.sin(a) * (s + wd / 2), oz = Math.cos(a) * (s + wd / 2);
      const wg = grp(gp, tx + ox, tz + oz, a, y);
      box(wg, RED, 0, 0, 0, ww, sh * 0.82, wd);
      for (let c = -2; c <= 2; c++) cyl(wg, '#7d1d16', (c / 2) * ww * 0.48, 0, wd / 2 + 0.002, 0.0035, sh * 0.82, 5);
      box(wg, '#f3d27a', 0, sh * 0.28, wd / 2 + 0.001, ww * 0.8, sh * 0.3, 0.003);
      box(wg, '#2f7d6d', 0, sh * 0.82 - 0.007, 0, ww + 0.004, 0.007, wd + 0.004);
      const R0 = ((wd / 2 + 0.02) * 1) / Math.SQRT1_2;
      proof(wg, 0, sh * 0.82, 0.006, { n: 4, R0, R1: R0 * 0.35, h: 0.022, lift: 0.7, tile: GOLD, rib: GOLD2, under: '#3f8f7a', sx: (ww / 2 + 0.02) / (wd / 2 + 0.02) });
    }
    y += sh;
    box(gp, '#2f7d6d', tx, y - 0.008, tz, s * 2 + 0.006, 0.008, s * 2 + 0.006);
    const R0 = (s + 0.03) / Math.SQRT1_2;
    proof(gp, tx, y, tz, { n: 4, R0, R1: R0 * 0.72, h: 0.02, lift: 0.7, tile: GOLD, rib: GOLD2, under: '#3f8f7a' });
    y += 0.012;
    if (i < 4) rail(gp, [tx - s * 0.9, y, tz + s * 0.9], [tx + s * 0.9, y, tz + s * 0.9], 0.008, '#c8402e', 0.02);
  }
  // Crowning double-eave pyramid roof and the gourd finial
  box(gp, RED, tx, y - 0.01, tz, 0.08, 0.035, 0.08);
  let r = proof(gp, tx, y + 0.022, tz, { n: 4, R0: 0.075, R1: 0.035, h: 0.022, lift: 0.7, tile: GOLD, rib: GOLD2, under: '#3f8f7a' });
  r = proof(gp, tx, r + 0.006, tz, { n: 4, R0: 0.058, R1: 0.004, h: 0.06, lift: 0.6, tile: GOLD, rib: GOLD2, under: '#3f8f7a' });
  box(gp, '#2f7d6d', tx, r - 0.06, tz, 0.05, 0.008, 0.05);
  gourd(gp, tx, r - 0.006, tz, 0.022);
  // Bronze "returning crane" statue in the forecourt
  const cx = 0.17, cz = 0.22, cy = Y0 + h(cx, cz);
  cyl(gp, '#9c8a6a', cx, cy, cz, 0.022, 0.012, 8);
  const cr = grp(gp, cx, cz, -0.5, cy + 0.012);
  for (const sd of [-1, 1]) rod(cr, [sd * 0.004, 0, 0], [sd * 0.004, 0.03, 0], 0.0015, '#6b5a3a', 4);
  blob(cr, '#c7963c', 0, 0.038, 0, 0.012, 0.01, 0.018, 0, true);
  tube(cr, [[0, 0.042, 0.012], [0, 0.06, 0.016], [0, 0.074, 0.012]], 0.0035, 0.003, '#c7963c');
  cone(cr, '#c7963c', 0, 0.072, 0.02, 0.002, 0.014, 4);
  for (const sd of [-1, 1]) add(cr, ICO(), mat('#b58530'), sd * 0.012, 0.044, -0.004, 0.004, 0.012, 0.016, 0, -0.5, sd * 0.6);
  // Trees: cherry blossom and camphor around the hill
  for (let i = 0; i < 30; i++) {
    const a = hash3(i, 1, 6) * Math.PI * 2, d = 0.24 + hash3(i, 2, 6) * 0.18, x = Math.cos(a) * d, z = Math.sin(a) * d - 0.04;
    if (Math.hypot(x, z) > 0.44 || (Math.abs(x) < 0.06 && z > 0)) continue;
    const s = 0.04 + hash3(i, 3, 6) * 0.025, c = i % 4 === 0 ? '#f2b6c6' : i % 3 === 0 ? '#6fa052' : '#3f6e38';
    cyl(gp, '#5b4030', x, Y0 + h(x, z), z, s * 0.1, s * 0.6, 5);
    blob(gp, c, x, Y0 + h(x, z) + s * 0.8, z, s * 0.6, s * 0.5, s * 0.6, i);
  }
  for (const [dx, c] of [[-0.03, '#dc2626'], [0.03, '#2563eb'], [0.08, '#f59e0b']] as const) person(gp, tx + dx, ty, tz + 0.15, c, 1.2);
};

// ---------------------------------------------------------------------------------------------------------
// Mogao Caves, Dunhuang — the Nine-Storey Pavilion against a cliff honeycombed with cave doorways
const cn_mogao: Builder = gp => {
  const h: HFn = (x, z) => 0.008 * fbm(x * 9, 1, z * 9, 2);
  island(gp, 0.5, h, '#e2c592', (x, _y, z) => {
    if (Math.abs(x) < 0.035 && z > -0.02) return '#cdb48a';
    return fbm(x * 12, 2, z * 12, 2) > 0.62 ? '#d6b47e' : null;
  }, { rings: 20, segs: 72, side: strataSide(['#b8946a', '#a8845c', '#c4a074']) });
  // Cliff: a tall strata wall filling the back of the diorama
  const CH = 0.36, zf = (x: number, y: number) => -0.11 + 0.012 * Math.sin(x * 23 + y * 9) + 0.01 * fbm(x * 6, y * 6, 3, 2);
  const NF = 34, NB = 14, rings: V3[][] = [];
  for (let i = 0; i <= 8; i++) {
    const y = Y0 - 0.01 + (i / 8) * CH, ring: V3[] = [];
    for (let j = 0; j <= NF; j++) { const x = -0.47 + (j / NF) * 0.94; ring.push([x, y, zf(x, y) + (i === 8 ? -0.02 : 0)]); }
    const a0 = Math.atan2(zf(0.47, y), 0.47), a1 = Math.atan2(zf(-0.47, y), -0.47);
    for (let j = 1; j < NB; j++) { const a = a0 + ((a1 - a0) * j) / NB; ring.push([Math.cos(a) * 0.49, y, Math.sin(a) * 0.49]); }
    rings.push(ring.reverse());
  }
  skin(gp, rings, '#c9a878', {
    caps: true, flat: true,
    paint: (_x, y, _z, _nx, ny) => {
      if (ny > 0.6) return '#d9bd8a';
      const b = Math.floor(y * 60 + fbm(_x * 5, y * 5, 1, 2) * 3) % 4;
      return ['#c9a878', '#b8946a', '#d2b183', '#bf9c70'][b];
    },
  });
  // Rows of cave doorways with plank galleries
  for (let row = 0; row < 3; row++) {
    const yy = Y0 + 0.07 + row * 0.085;
    for (let j = 0; j < 14; j++) {
      const x = -0.44 + j * 0.066 + (row % 2) * 0.03 + (hash3(row, j, 2) - 0.5) * 0.02;
      if (Math.abs(x) < 0.15 || Math.abs(x) > 0.45) continue;
      const z = zf(x, yy + 0.015);
      box(gp, '#3b2a1e', x, yy, z + 0.002, 0.02, 0.03, 0.01);
    }
    for (const sd of [-1, 1]) box(gp, '#8a6a46', sd * 0.3, yy - 0.006, zf(0.3, yy) + 0.012, 0.3, 0.005, 0.02);
  }
  // Nine-Storey Pavilion (Cave 96): cream walls, red columns, nine tiers of grey eaves
  let y = Y0 + 0.004;
  box(gp, '#d8c4a0', 0, y - 0.004, -0.04, 0.3, 0.012, 0.16);
  y += 0.008;
  for (let i = 0; i < 9; i++) {
    const w = 0.25 - i * 0.012, d = 0.13 - i * 0.005, sh = i === 0 ? 0.055 : 0.03, z = zf(0, y) + d / 2 - 0.02;
    const top = hall(gp, 0, y, z, w, d, sh, '#56625e', 0, '#efe3c6', { rh: 0.018, ov: 1.25, lift: 0.5, col: '#b8322a', band: '#3f7a72' });
    if (i === 0) for (const dx of [-0.02, 0.02]) box(gp, '#7a2a1e', dx, y, z + d / 2 + 0.002, 0.016, 0.03, 0.004);
    box(gp, '#b8322a', 0, y + sh * 0.35, z + d / 2 + 0.003, w * 0.7, sh * 0.32, 0.003);
    if (i === 8) {
      const t2 = hall(gp, 0, top - 0.012, z - 0.01, w * 0.62, d * 0.7, 0.022, '#56625e', 0, '#efe3c6', { rh: 0.04, ov: 1.4, lift: 0.5, col: '#b8322a', band: '#3f7a72' });
      gourd(gp, 0, t2 - 0.004, z - 0.01, 0.012, '#d9a43a');
    }
    y += sh + 0.016;
  }
  // Sand dunes peeking over the cliff top
  for (let i = 0; i < 6; i++) {
    const x = -0.36 + i * 0.15, z = -0.32 + hash3(i, 1, 3) * 0.08;
    if (Math.hypot(x, z) > 0.42) continue;
    add(gp, ICO(), mat('#e8bf78', { flat: false, rough: 0.95 }), x, Y0 + CH - 0.02, z, 0.12, 0.06 + hash3(i, 2, 3) * 0.04, 0.09, i);
  }
  // Forecourt: white poplars, a little stupa, a camel and visitors
  for (let i = 0; i < 10; i++) {
    const sd = i % 2 ? 1 : -1, x = sd * (0.2 + hash3(i, 1, 1) * 0.2), z = 0.02 + Math.floor(i / 2) * 0.08;
    if (Math.hypot(x, z) > 0.46) continue;
    cyl(gp, '#e9e2d0', x, Y0, z, 0.004, 0.05, 5);
    blob(gp, i % 3 ? '#9fb447' : '#d6b23a', x, Y0 + 0.08, z, 0.022, 0.05, 0.022, i);
  }
  lathe(gp, [[0, 0], [0.026, 0], [0.026, 0.016], [0.022, 0.03], [0.012, 0.05], [0.004, 0.07], [0, 0.085]], '#f2ece0', -0.1, Y0, 0.2, 10);
  const cm = grp(gp, 0.14, 0.3, -0.7, Y0);
  for (const [lx, lz] of [[-0.01, -0.02], [0.01, -0.02], [-0.01, 0.02], [0.01, 0.02]]) rod(cm, [lx, 0, lz], [lx * 0.8, 0.034, lz * 0.8], 0.0028, '#b48a50', 4);
  blob(cm, '#c49a5e', 0, 0.04, 0, 0.016, 0.012, 0.028, 0, true);
  blob(cm, '#b48a50', 0, 0.054, -0.01, 0.009, 0.01, 0.01, 0, true);
  blob(cm, '#b48a50', 0, 0.054, 0.01, 0.009, 0.01, 0.01, 0, true);
  tube(cm, [[0, 0.04, 0.026], [0, 0.058, 0.038], [0, 0.064, 0.046]], 0.0045, 0.004, '#c49a5e');
  blob(cm, '#c49a5e', 0, 0.064, 0.052, 0.006, 0.006, 0.01, 0, true);
  box(cm, '#c8402e', 0, 0.052, 0, 0.022, 0.004, 0.012);
  for (const [dx, dz, c] of [[-0.03, 0.12, '#dc2626'], [0.02, 0.16, '#2563eb'], [0.05, 0.08, '#f59e0b'], [-0.06, 0.26, '#16a34a']] as const) person(gp, dx, Y0, dz, c, 1.2);
};

// ---------------------------------------------------------------------------------------------------------
// The Bund & Lujiazui, Shanghai — Oriental Pearl Tower, Jin Mao, the "bottle opener" and the twisting Shanghai Tower
const cn_bund: Builder = gp => {
  const WC = '#6f8f86', WL = Y0 - 0.01;
  water(gp, 0.49, WL - 0.004, WC);
  const zc = (x: number) => 0.06 + 0.12 * x, RW = 0.085;
  const h: HFn = (x, z) => { const d = Math.abs(z - zc(x)); return d < RW ? -0.03 : 0.0; };
  island(gp, 0.5, h, '#7aa85a', (x, y, z) => {
    if (y < WL + 0.004) return '#7c8f86';
    const d = z - zc(x);
    if (d > 0) return d < RW + 0.05 ? '#c9c2b2' : d < RW + 0.08 ? '#4b5058' : '#a7a49c';
    if (d > -RW - 0.025) return '#b8b4a8';
    return fbm(x * 14, 1, z * 14, 2) > 0.58 ? '#8aba66' : null;
  }, { rings: 30, segs: 100, side: strataSide(['#7a7468', '#6a6458', '#857f72']) });
  // --- Pudong skyline
  const PK = '#d8467a', CR = '#ece6dc';
  {
    const x = -0.17, z = -0.2, y0 = Y0;
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; cyl(gp, CR, x + Math.cos(a) * 0.02, y0, z + Math.sin(a) * 0.02, 0.009, 0.5, 8); }
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3 + Math.PI / 3; rod(gp, [x + Math.cos(a) * 0.1, y0, z + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.03, y0 + 0.14, z + Math.sin(a) * 0.03], 0.008, CR, 6); }
    ellip(gp, PK, x, y0 + 0.17, z, 0.062, 0.062, 0.062);
    cyl(gp, '#c0c6cc', x, y0 + 0.164, z, 0.066, 0.012, 16);
    for (const yy of [0.25, 0.29, 0.33, 0.37]) ellip(gp, PK, x, y0 + yy, z, 0.016, 0.016, 0.016);
    ellip(gp, PK, x, y0 + 0.44, z, 0.042, 0.042, 0.042);
    cyl(gp, '#c0c6cc', x, y0 + 0.436, z, 0.046, 0.008, 16);
    cyl(gp, CR, x, y0 + 0.48, z, 0.012, 0.08, 8);
    ellip(gp, PK, x, y0 + 0.57, z, 0.018, 0.018, 0.018);
    strut(gp, [x, y0 + 0.58, z], [x, y0 + 0.74, z], 0.008, 0.002, '#dfe3e8', 6);
  }
  // Jin Mao: stepped pagoda-like tower with a spire
  {
    const x = 0.02, z = -0.3;
    let y = Y0, w = 0.07;
    for (let i = 0; i < 13; i++) {
      const hh = i < 6 ? 0.06 : 0.035;
      box(gp, i % 2 ? '#9aa6ad' : '#b5bec4', x, y, z, w, hh, w, Math.PI / 4);
      box(gp, '#6f7d86', x, y + hh - 0.004, z, w + 0.004, 0.004, w + 0.004, Math.PI / 4);
      y += hh; w *= i < 6 ? 0.96 : 0.9;
    }
    cone(gp, '#c9d2d8', x, y, z, w * 0.7, 0.06, 4, Math.PI / 4);
    rod(gp, [x, y + 0.05, z], [x, y + 0.12, z], 0.002, '#dfe3e8', 4);
  }
  // Shanghai World Financial Center: tapering slab with the trapezoid "bottle opener" hole
  {
    const x = 0.15, z = -0.33, H = 0.8;
    tbox(gp, 0.08, 0.08, 0.08, 0.012, H, '#8fb3c9', x, Y0, z, 0, 0, 0.35);
    const gr = grp(gp, x, z, 0.35, Y0);
    box(gr, '#1c2a38', 0, H - 0.11, 0, 0.05, 0.065, 0.03);
    box(gr, '#cfdae2', 0, H, 0, 0.082, 0.004, 0.014);
  }
  // Shanghai Tower: rounded triangle twisting 120° as it rises, glass-green
  {
    const x = 0.3, z = -0.2, H = 0.92, NF = 16, S = 21, rings: V3[][] = [];
    for (let i = 0; i <= NF; i++) {
      const t = i / NF, R = 0.064 * (1 - 0.42 * t) * (t > 0.94 ? 0.9 : 1), tw = t * 2.1, ring: V3[] = [];
      for (let j = 0; j < S; j++) {
        const a = (j / S) * Math.PI * 2, rr = R * (1 + 0.14 * Math.cos(3 * a) - (Math.abs(Math.sin(1.5 * a)) < 0.12 ? 0.1 : 0));
        ring.push([x + Math.cos(a + tw) * rr, Y0 + t * H - (i === NF ? 0.03 * Math.cos(a + tw) : 0), z + Math.sin(a + tw) * rr]);
      }
      rings.push(ring);
    }
    skin(gp, rings, '#8fbfc0', {
      caps: true, flat: true, metal: 0.3, rough: 0.35,
      paint: (_px, py) => (Math.floor(((py - Y0) / H) * 9 * 4) % 4 === 0 ? '#6c9a9c' : null),
    });
  }
  // Generic glass towers to fill out the skyline
  const T: [number, number, number, number, string][] = [
    [-0.36, -0.22, 0.05, 0.26, '#7c95a6'], [-0.28, -0.36, 0.05, 0.34, '#a3b4bf'], [-0.42, -0.06, 0.045, 0.18, '#94a6b2'], [-0.06, -0.38, 0.05, 0.4, '#b9c4cc'],
    [-0.02, -0.18, 0.04, 0.22, '#8aa0ae'], [0.4, -0.06, 0.045, 0.24, '#a6b7c2'], [0.12, -0.16, 0.045, 0.3, '#7f97a8'], [0.24, -0.4, 0.04, 0.42, '#97aab6'],
    [0.42, -0.2, 0.04, 0.3, '#b5c1c9'], [-0.18, -0.4, 0.04, 0.28, '#8697a4'],
  ];
  T.forEach(([x, z, w, hh, c], i) => {
    if (Math.hypot(x, z) > 0.46) return;
    box(gp, c, x, Y0, z, w, hh, w, i * 0.4);
    for (let k = 1; k < 4; k++) box(gp, shade(c, 0.78), x, Y0 + (hh * k) / 4, z, w + 0.002, 0.004, w + 0.002, i * 0.4);
  });
  // --- The Bund: a row of stone heritage buildings along the waterfront
  const ry = Math.atan2(-0.12, 1), bd = (x: number) => zc(x) + RW + 0.13;
  const B: [number, number, number, string, string?][] = [
    [-0.33, 0.07, 0.09, '#d4c8ae'], [-0.25, 0.07, 0.11, '#c9bc9f', 'dome'], [-0.165, 0.08, 0.1, '#e1d8c4', 'clock'], [-0.08, 0.07, 0.09, '#bfb39a'],
    [0.0, 0.07, 0.1, '#d9ceb7'], [0.08, 0.07, 0.12, '#cdbfa2', 'peace'], [0.16, 0.06, 0.085, '#e0d6c0'], [0.24, 0.06, 0.08, '#c7bba3'], [0.32, 0.05, 0.075, '#d5cab2'],
  ];
  for (const [x, w, hh, c, kind] of B) {
    const z = bd(x);
    if (Math.hypot(x, z + 0.04) > 0.47) continue;
    const gr = grp(gp, x, z, ry, Y0);
    box(gr, c, 0, 0, 0, w, hh, 0.08);
    for (let k = 1; k <= 3; k++) box(gr, '#5f5a50', 0, (hh * k) / 4 - 0.006, 0, w * 0.8, 0.01, 0.082);
    box(gr, shade(c, 0.85), 0, hh, 0, w + 0.004, 0.005, 0.084);
    if (kind === 'clock') {
      box(gr, c, 0, hh, -0.01, 0.03, 0.07, 0.03);
      cyl(gr, '#f8f5ec', 0, hh + 0.045, -0.026, 0.009, 0.002, 12).rotation.x = Math.PI / 2;
      cone(gr, '#6f7a70', 0, hh + 0.07, -0.01, 0.022, 0.03, 4, Math.PI / 4);
    } else if (kind === 'dome') {
      cyl(gr, c, 0, hh, 0, 0.022, 0.016, 12);
      lathe(gr, [[0.024, 0], [0.022, 0.012], [0.014, 0.024], [0, 0.028]], '#7d8f86', 0, hh + 0.016, 0, 12);
    } else if (kind === 'peace') {
      box(gr, c, 0, hh, 0, 0.03, 0.02, 0.03);
      cone(gr, '#3f7a5e', 0, hh + 0.02, 0, 0.026, 0.04, 4, Math.PI / 4);
    }
  }
  // Promenade lamps, strollers and boats on the Huangpu
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09, z = zc(x) + RW + 0.012;
    if (Math.hypot(x, z) > 0.47) continue;
    rod(gp, [x, Y0, z], [x, Y0 + 0.04, z], 0.0016, '#3b3f46', 4);
    blob(gp, '#fff1c2', x, Y0 + 0.042, z, 0.004);
    if (i % 2) person(gp, x + 0.02, Y0, z + 0.015, ['#dc2626', '#2563eb', '#f59e0b', '#16a34a'][i % 4], 1.2);
  }
  const boat = (x: number, s: number, c: string, deck: string) => {
    const z = zc(x), gr = grp(gp, x, z, ry, WL);
    sweep(gr, [-1, -0.6, 0, 0.6, 1].map((u, i) => ({ p: [u * 0.07 * s, 0.008, 0] as V3, w: (i === 0 || i === 4 ? 0.006 : 0.018) * s, h: 0.009 * s })), c, { radial: 8, sub: 3, flat: true, squash: 0.5, up: [0, 0, 1] });
    box(gr, deck, -0.005 * s, 0.014 * s, 0, 0.08 * s, 0.014 * s, 0.026 * s);
    box(gr, shade(deck, 0.9), -0.008 * s, 0.028 * s, 0, 0.05 * s, 0.012 * s, 0.022 * s);
    for (let k = -2; k <= 2; k++) blob(gr, '#e23b2e', k * 0.016 * s, 0.03 * s, 0.014 * s, 0.004 * s);
  };
  boat(-0.05, 1.1, '#f4f1ea', '#e8e4dc');
  boat(0.24, 0.8, '#c8402e', '#f2efe6');
};

// ---------------------------------------------------------------------------------------------------------
// Zhangye Danxia — rainbow-striped sandstone hills with a boardwalk up to a viewing platform
const cn_danxia: Builder = gp => {
  const BANDS = ['#c8553d', '#e58f55', '#f3c98a', '#d9695a', '#f1e0b8', '#b8443a', '#eaa66c', '#a9b48e', '#f2b3a1', '#d97a3f'];
  const plat: [number, number] = [0.16, 0.12];
  const h: HFn = (x, z) => {
    const r = Math.hypot(x, z), back = sstep(0.42, -0.05, z);
    const rid = ridged(x * 3.3 + 1.3, z * 3.3 + 0.7, 2);
    const knob = 0.15 * Math.exp(-((x - plat[0]) ** 2 + (z - plat[1]) ** 2) / 0.008);
    return Math.max((0.03 + 0.36 * rid ** 1.8) * (0.2 + 0.8 * back), knob) * sstep(0.52, 0.4, r) + 0.004 * fbm(x * 20, 1, z * 20, 2);
  };
  island(gp, 0.5, h, '#d9695a', (x, y, z, _nx, ny) => {
    if (y < Y0 + 0.012 && z > 0.1) return ny > 0.9 && fbm(x * 10, 2, z * 10, 2) > 0.55 ? '#b9a27a' : '#c9a27a';
    const tilt = y + 0.05 * x - 0.03 * z + 0.004 * fbm(x * 6, y * 6, z * 6, 2);
    const c = BANDS[((Math.floor(tilt * 26) % BANDS.length) + BANDS.length) % BANDS.length];
    return ny > 0.92 ? shade(c, 1.06) : c;
  }, { rings: 44, segs: 120, side: strataSide(['#b8443a', '#e58f55', '#c8553d', '#f3c98a']) });
  // Boardwalk: plank stairs on posts climbing from the car park to the platform
  const A: [number, number] = [-0.2, 0.38], Bx = plat[0] - 0.02, Bz = plat[1] + 0.03, N = 18;
  let prev: V3 | null = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = A[0] + (Bx - A[0]) * t, z = A[1] + (Bz - A[1]) * t, y = Y0 + Math.max(h(x, z), 0) + 0.014;
    const ry = Math.atan2(-(Bz - A[1]), Bx - A[0]);
    box(gp, '#8a5a36', x, y, z, 0.03, 0.004, 0.024, ry);
    if (i % 2 === 0) for (const sd of [-1, 1]) {
      const ox = Math.sin(ry) * sd * 0.012, oz = Math.cos(ry) * sd * 0.012;
      rod(gp, [x + ox, Y0 + h(x, z) - 0.004, z + oz], [x + ox, y + 0.016, z + oz], 0.0016, '#6b4426', 4);
    }
    if (prev) rod(gp, [prev[0], prev[1] + 0.016, prev[2]], [x, y + 0.016, z], 0.0014, '#6b4426', 4);
    prev = [x, y, z];
  }
  const py = Y0 + h(plat[0], plat[1]) + 0.01;
  cyl(gp, '#8a5a36', plat[0], py, plat[1], 0.05, 0.008, 8);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; rod(gp, [plat[0] + Math.cos(a) * 0.05, py + 0.008, plat[1] + Math.sin(a) * 0.05], [plat[0] + Math.cos(a + 0.78) * 0.05, py + 0.008, plat[1] + Math.sin(a + 0.78) * 0.05], 0.0016, '#6b4426', 4); box(gp, '#6b4426', plat[0] + Math.cos(a) * 0.05, py + 0.004, plat[1] + Math.sin(a) * 0.05, 0.003, 0.012, 0.003); }
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.3; cyl(gp, '#b8322a', plat[0] + Math.cos(a) * 0.026, py + 0.008, plat[1] + Math.sin(a) * 0.026, 0.003, 0.04, 5); }
  proof(gp, plat[0], py + 0.048, plat[1], { n: 6, R0: 0.048, R1: 0.004, h: 0.03, lift: 0.4, tile: '#4f6b5e' });
  for (const [dx, dz, c] of [[-0.02, 0.02, '#dc2626'], [0.02, 0.0, '#2563eb'], [0.0, -0.025, '#f59e0b']] as const) person(gp, plat[0] + dx, py + 0.008, plat[1] + dz, c, 1.2);
  for (const [t, c] of [[0.3, '#16a34a'], [0.6, '#a855f7']] as const) { const x = A[0] + (Bx - A[0]) * t, z = A[1] + (Bz - A[1]) * t; person(gp, x, Y0 + h(x, z) + 0.018, z, c, 1.2); }
  // Gravel road and a little sightseeing bus
  const bs = grp(gp, -0.3, 0.3, 0.6, Y0 + 0.002);
  box(bs, '#2f8f5b', 0, 0.004, 0, 0.08, 0.03, 0.034);
  box(bs, '#bfe3f2', 0, 0.018, 0, 0.082, 0.01, 0.03);
  for (const [lx, lz] of [[-0.026, -0.017], [0.026, -0.017], [-0.026, 0.017], [0.026, 0.017]]) cyl(bs, '#222', lx, 0, lz, 0.007, 0.006, 8).rotation.x = Math.PI / 2;
};

// ---------------------------------------------------------------------------------------------------------
// Jiuzhaigou — turquoise travertine lakes with sunken logs, a wide forested waterfall and autumn colour
const cn_jiuzhaigou: Builder = gp => {
  const LL = Y0 + 0.004, LU = Y0 + 0.1;
  const e1 = (x: number, z: number) => Math.hypot((x - 0.02) / 0.36, (z - 0.17) / 0.2);
  const e2 = (x: number, z: number) => Math.hypot((x + 0.03) / 0.3, (z + 0.16) / 0.085);
  const mtn = (x: number, z: number) => sstep(-0.22, -0.46, z) * (0.14 + 0.18 * ridged(x * 3.5 + 2, z * 3.5, 3)) + 0.2 * Math.exp(-((x + 0.12) ** 2 + (z + 0.42) ** 2) / 0.012);
  const h: HFn = (x, z) => {
    const step = 0.1 * sstep(0.0, -0.045, z);
    let v = 0.016 + step + 0.01 * fbm(x * 9, 2, z * 9, 2) - 0.05 * sstep(1, 0.7, e1(x, z)) - 0.045 * sstep(1, 0.65, e2(x, z)) * sstep(0.0, -0.05, z);
    v = Math.max(v, mtn(x, z) + step);
    return v;
  };
  island(gp, 0.5, h, '#3f6e3a', (x, y, z, _nx, ny) => {
    if (e1(x, z) < 1.02 && y < LL + 0.002) { const f = fbm(x * 11, 1, z * 11, 2); return f > 0.62 ? '#c9b45a' : f > 0.48 ? '#3fb0a6' : '#2d8f8a'; }
    if (e2(x, z) < 1.02 && y < LU + 0.002 && z < -0.02) return fbm(x * 11, 3, z * 11, 2) > 0.55 ? '#9fb85a' : '#2f9c98';
    if (y > 0.36) return ny > 0.5 ? '#f4f7fb' : '#c9d2dc';
    if (ny < 0.55) return '#7a7468';
    const f = fbm(x * 14, y * 9, z * 14, 2);
    return f > 0.6 ? '#4f8244' : f < 0.4 ? '#2b5129' : null;
  }, { rings: 34, segs: 100, side: strataSide(EARTH) });
  pool(gp, oval(0.02, 0.17, 0.355, 0.198, 36), LL, '#22c3cf', 0.62);
  pool(gp, oval(-0.03, -0.16, 0.296, 0.083, 30), LU, '#27b6d6', 0.62);
  // Sunken logs on the lake beds
  for (let i = 0; i < 9; i++) {
    const x = -0.24 + hash3(i, 1, 2) * 0.48, z = 0.08 + hash3(i, 2, 2) * 0.18, a = hash3(i, 3, 2) * Math.PI;
    if (e1(x, z) > 0.8) continue;
    const yb = Y0 + h(x, z) + 0.004;
    rod(gp, [x - Math.cos(a) * 0.04, yb, z - Math.sin(a) * 0.04], [x + Math.cos(a) * 0.04, yb + 0.004, z + Math.sin(a) * 0.04], 0.003, '#9a7a52', 5);
  }
  // Nuorilang-style waterfall: white curtains tumbling over the travertine step, with trees growing in it
  box(gp, '#dcf2f8', -0.005, LL - 0.004, -0.014, 0.6, LU - LL + 0.012, 0.006, 0, -0.5);
  for (let i = 0; i < 30; i++) {
    const x = -0.31 + i * 0.021 + (hash3(i, 1, 7) - 0.5) * 0.006;
    if (Math.hypot(x, 0) > 0.44) continue;
    const ht = LU - LL + 0.006 - hash3(i, 4, 7) * 0.01;
    box(gp, i % 3 ? '#f4fbff' : i % 2 ? '#d7f1f7' : '#bfe8f2', x, LL - 0.004, -0.012 + hash3(i, 2, 7) * 0.006, 0.026 + hash3(i, 3, 7) * 0.01, ht + 0.008, 0.01, 0, -0.5);
    blob(gp, '#ffffff', x, LL + 0.004, 0.004, 0.018, 0.008, 0.014, i, true);
    if (i % 5 === 2) { cyl(gp, '#5b4030', x, LU - 0.01, -0.03, 0.003, 0.03, 5); blob(gp, i % 2 ? '#e8a23a' : '#4f8244', x, LU + 0.03, -0.03, 0.018, 0.022, 0.018, i); }
  }
  // Autumn forest around the lakes, conifers on the slopes
  const AC = ['#e07b2a', '#f2b33d', '#c8402e', '#5f8f3a', '#2f5e3a', '#e8c23a'];
  for (let i = 0; i < 70; i++) {
    const a = hash3(i, 1, 3) * Math.PI * 2, d = Math.sqrt(hash3(i, 2, 3)) * 0.47, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (e1(x, z) < 1.08 || (e2(x, z) < 1.1 && z < 0) || Math.abs(z + 0.02) < 0.03) continue;
    const y = Y0 + h(x, z);
    if (y > 0.33) continue;
    const s = 0.026 + hash3(i, 3, 3) * 0.02;
    if (z < -0.24 || hash3(i, 4, 3) > 0.6) minipine(gp, x, y, z, s * 1.5, i % 2 ? '#2f5a32' : '#3b6a3a');
    else blob(gp, AC[i % AC.length], x, y + s * 0.8, z, s * 0.8, s, s * 0.8, i);
  }
  // Plank boardwalk zig-zagging across the lake with visitors
  const W: [number, number][] = [[-0.36, 0.33], [-0.14, 0.24], [0.06, 0.33], [0.28, 0.24], [0.4, 0.3]];
  for (let k = 0; k < W.length - 1; k++) {
    const [x0, z0] = W[k], [x1, z1] = W[k + 1], L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
    box(gp, '#9a6a3e', (x0 + x1) / 2, LL + 0.008, (z0 + z1) / 2, L + 0.02, 0.005, 0.026, ry);
    for (let u = 0; u <= 1.001; u += 0.25) for (const sd of [-1, 1]) {
      const x = x0 + (x1 - x0) * u + Math.sin(ry) * sd * 0.012, z = z0 + (z1 - z0) * u + Math.cos(ry) * sd * 0.012;
      box(gp, '#6b4426', x, Y0 + h(x, z) - 0.004, z, 0.004, LL + 0.022 - (Y0 + h(x, z)), 0.004);
    }
    for (const sd of [-1, 1]) rod(gp, [x0 + Math.sin(ry) * sd * 0.012, LL + 0.022, z0 + Math.cos(ry) * sd * 0.012], [x1 + Math.sin(ry) * sd * 0.012, LL + 0.022, z1 + Math.cos(ry) * sd * 0.012], 0.0014, '#6b4426', 4);
  }
  for (const [x, z, c] of [[-0.25, 0.285, '#dc2626'], [-0.05, 0.285, '#2563eb'], [0.16, 0.29, '#f59e0b'], [0.2, 0.275, '#16a34a']] as const) person(gp, x, LL + 0.013, z, c, 1.2);
};

// ---------------------------------------------------------------------------------------------------------
// Hanging Temple, Mount Heng — wooden halls pinned halfway up a sheer cliff on slender stilts
const cn_hangingtemple: Builder = gp => {
  const WC = '#5f9a92', WL = Y0 - 0.004;
  water(gp, 0.49, WL - 0.004, WC);
  const h: HFn = (x, z) => 0.012 + 0.01 * fbm(x * 9, 1, z * 9, 2) - 0.04 * sstep(0.05, 0.02, Math.abs(z - 0.32 - 0.05 * Math.sin(x * 6)));
  island(gp, 0.5, h, '#5c8a46', (x, y, z) => {
    if (y < WL + 0.004) return '#b5a582';
    if (z < -0.02) return '#8f8576';
    return fbm(x * 13, 1, z * 13, 2) > 0.6 ? '#6f9c52' : null;
  }, { rings: 24, segs: 84, side: strataSide(['#7a7468', '#6a6458', '#857f72']) });
  // Sheer cliff face across the back
  const CH = 0.66, zf = (x: number, y: number) => -0.07 + 0.018 * Math.sin(x * 14 + y * 5) + 0.02 * fbm(x * 7, y * 4, 2, 2) - 0.03 * sstep(0.2, 0.4, y) * sstep(-0.1, -0.35, x);
  const NF = 30, NB = 12, rings: V3[][] = [];
  for (let i = 0; i <= 10; i++) {
    const y = Y0 - 0.01 + (i / 10) * CH, ring: V3[] = [];
    for (let j = 0; j <= NF; j++) { const x = -0.47 + (j / NF) * 0.94; ring.push([x, y + (i === 10 ? 0.04 * fbm(x * 6, 1, 1, 2) : 0), zf(x, y)]); }
    const a0 = Math.atan2(zf(0.47, y), 0.47), a1 = Math.atan2(zf(-0.47, y), -0.47);
    for (let j = 1; j < NB; j++) { const a = a0 + ((a1 - a0) * j) / NB; ring.push([Math.cos(a) * 0.49, y, Math.sin(a) * 0.49]); }
    rings.push(ring.reverse());
  }
  skin(gp, rings, '#9b8f80', {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      if (ny > 0.6) return '#5f7d4a';
      const f = fbm(x * 9, y * 3, 1, 2);
      return f > 0.62 ? '#7d7366' : f < 0.38 ? '#b0a493' : Math.floor(x * 40) % 5 === 0 ? '#867b6d' : null;
    },
  });
  for (let i = 0; i < 9; i++) { const x = -0.4 + i * 0.1, y = Y0 + CH - 0.01; if (Math.abs(x) < 0.45) minipine(gp, x, y, zf(x, y) - 0.06, 0.04 + hash3(i, 1, 1) * 0.02); }
  // The temple: a gallery of halls on cantilevered beams and stilts
  const RW = '#8a3b28', YEL = '#d9a43a', GRN = '#3f7a5c', front = (x: number, y: number) => zf(x, y) + 0.004;
  const deck = (x0: number, x1: number, y: number, d: number) => {
    const xm = (x0 + x1) / 2, z = Math.max(front(x0, y), front(x1, y), front(xm, y)) + d / 2;
    box(gp, '#7a4a2a', xm, y - 0.006, z - 0.004, x1 - x0, 0.006, d + 0.008);
    rail(gp, [x0, y, z + d / 2], [x1, y, z + d / 2], 0.012, '#5a2e1c', 0.025);
    for (let x = x0 + 0.015; x < x1; x += 0.05) rod(gp, [x, y - 0.006, z + d / 2 - 0.004], [x, y - 0.11, front(x, y - 0.11) + 0.004], 0.0016, '#4a3a2a', 4);
    return z;
  };
  // Lower gallery and halls
  const y1 = Y0 + 0.24, y2 = Y0 + 0.33;
  const z1 = deck(-0.32, 0.12, y1, 0.05);
  hall(gp, -0.24, y1, z1 - 0.004, 0.07, 0.04, 0.04, GRN, 0, RW, { col: '#5a1e12', rh: 0.02 });
  hall(gp, -0.06, y1, z1 - 0.004, 0.09, 0.04, 0.045, YEL, 0, RW, { col: '#5a1e12', rh: 0.022 });
  hall(gp, 0.07, y1, z1 - 0.004, 0.06, 0.04, 0.04, GRN, 0, RW, { col: '#5a1e12', rh: 0.02 });
  // Upper gallery
  const z2 = deck(-0.16, 0.3, y2, 0.045);
  hall(gp, 0.0, y2, z2 - 0.004, 0.07, 0.036, 0.038, YEL, 0, RW, { col: '#5a1e12', rh: 0.02 });
  hall(gp, 0.12, y2, z2 - 0.004, 0.06, 0.036, 0.036, GRN, 0, RW, { col: '#5a1e12', rh: 0.018 });
  // Two three-storey towers linked by an aerial plank bridge
  const towers: V3[] = [];
  for (const [tx, by] of [[-0.3, y1 + 0.06], [0.24, y2]] as const) {
    let y = by;
    const tz = front(tx, y) + 0.03;
    for (let k = 0; k < 3; k++) { y = hall(gp, tx, y, tz, 0.05 - k * 0.006, 0.04 - k * 0.004, 0.034, k === 2 ? YEL : GRN, 0, RW, { col: '#5a1e12', rh: 0.018, lift: 0.5 }) - 0.006; }
    gourd(gp, tx, y, tz, 0.008, YEL);
    towers.push([tx, by + 0.07, tz + 0.016]);
    for (let k = 0; k < 4; k++) { const xx = tx - 0.018 + k * 0.012; rod(gp, [xx, by, tz + 0.016], [xx, by - 0.14, front(xx, by - 0.14) + 0.004], 0.0016, '#4a3a2a', 4); }
  }
  {
    const [a, b] = towers, n = 10;
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 0.03 + Math.sin(t * Math.PI) * 0.02; box(gp, '#7a4a2a', x, y, Math.max(front(x, y) + 0.02, a[2]), 0.05, 0.004, 0.02); }
  }
  // Stair to the ground and visitors
  for (let i = 0; i < 12; i++) { const y = Y0 + i * 0.02, x = -0.4 + i * 0.008; box(gp, '#7a4a2a', x, y, front(x, y) + 0.016, 0.03, 0.004, 0.022); }
  hall(gp, -0.38, Y0 + h(-0.38, 0.03), 0.02, 0.06, 0.04, 0.04, YEL, 0.3, RW, { col: '#5a1e12', rh: 0.02 });
  for (const [x, y, z, c] of [[-0.12, y1, z1 + 0.012, '#dc2626'], [0.04, y1, z1 + 0.014, '#2563eb'], [0.19, y2, z2 + 0.012, '#f59e0b'], [-0.32, Y0 + 0.012, 0.14, '#16a34a']] as const) person(gp, x, y, z, c, 1.2);
  // Valley trees along the stream
  for (let i = 0; i < 18; i++) {
    const x = -0.44 + i * 0.05 + (hash3(i, 1, 4) - 0.5) * 0.03, z = 0.14 + hash3(i, 2, 4) * 0.08;
    if (Math.hypot(x, z) > 0.45 || (x > -0.44 && x < -0.32 && z < 0.12)) continue;
    bush(gp, x, Y0 + h(x, z), z, 0.045 + hash3(i, 3, 4) * 0.02, i % 3 ? '#4f8244' : '#7aa84a');
  }
};

// ---------------------------------------------------------------------------------------------------------
// Mount Tai — the steep stone stairway climbing a gully to the red South Gate of Heaven
const cn_taishan: Builder = gp => {
  const gs = (x: number, z: number, cx: number, cz: number, s: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / s);
  const h0 = (x: number, z: number) => Math.max(
    0.5 * gs(x, z * 1.1, 0.2, -0.24, 0.03), 0.4 * gs(x, z, -0.3, -0.2, 0.025), 0.32 * Math.exp(-((z + 0.12) ** 2) / 0.016) * sstep(0.5, 0.3, Math.abs(x)),
    0.14 * sstep(0.42, -0.1, z),
  ) + 0.035 * ridged(x * 5 + 1, z * 5, 3);
  const S0: [number, number] = [-0.07, 0.44], S1: [number, number] = [-0.05, -0.06], L = Math.hypot(S1[0] - S0[0], S1[1] - S0[1]);
  const y0p = h0(...S0), y1p = h0(S1[0], S1[1] - 0.06);
  const tOf = (x: number, z: number) => Math.max(0, Math.min(1, ((x - S0[0]) * (S1[0] - S0[0]) + (z - S0[1]) * (S1[1] - S0[1])) / (L * L)));
  const pd = (x: number, z: number) => { const t = tOf(x, z); return Math.hypot(x - S0[0] - (S1[0] - S0[0]) * t, z - S0[1] - (S1[1] - S0[1]) * t); };
  const ph = (t: number) => y0p + (y1p - y0p) * t ** 1.3;
  const h: HFn = (x, z) => { const w = sstep(0.06, 0.025, pd(x, z)); return h0(x, z) * (1 - w) + (ph(tOf(x, z)) - 0.004) * w; };
  island(gp, 0.5, h, '#4c7a3a', (x, y, z, _nx, ny) => {
    if (ny < 0.6) return fbm(x * 20, y * 20, z * 20, 2) > 0.5 ? '#9a9286' : '#857d72';
    const f = fbm(x * 13, y * 8, z * 13, 2);
    return f > 0.6 ? '#5d9450' : f < 0.4 ? '#3a6533' : null;
  }, { rings: 40, segs: 110, side: strataSide(['#857d72', '#756d63', '#958c80']) });
  // Stone stairway with low parapets
  const N = 30, ry = Math.atan2(-(S1[1] - S0[1]), S1[0] - S0[0]) + Math.PI / 2;
  for (let i = 0; i < N; i++) {
    const t = i / N, x = S0[0] + (S1[0] - S0[0]) * t, z = S0[1] + (S1[1] - S0[1]) * t, y = Y0 + ph(t) - 0.006, y2 = Y0 + ph((i + 1) / N) - 0.006;
    box(gp, i % 2 ? '#e1dbcd' : '#d2cbbb', x, y - 0.01, z, 0.036, y2 - y + 0.01, L / N + 0.002, ry);
    if (i % 2 === 0) for (const sd of [-1, 1]) box(gp, '#b9b1a3', x + Math.cos(ry) * sd * 0.021, y, z - Math.sin(ry) * sd * 0.021, 0.006, 0.012, L / N * 2, ry);
  }
  // South Gate of Heaven: red arched gate block and the orange-roofed tower above it
  const gx = S1[0], gz = S1[1] - 0.03, gy = Y0 + ph(1) - 0.008, gr = grp(gp, gx, gz, ry, gy);
  box(gr, '#b8322a', 0, -0.03, 0, 0.13, 0.08, 0.06);
  box(gr, '#2a1a14', 0, 0, 0.0305, 0.03, 0.034, 0.002);
  add(gr, g('cn:arch2', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI)), mat('#2a1a14'), 0, 0.034, 0.0305, 0.015, 0.002, 0.015, 0, Math.PI / 2);
  box(gr, '#f4efe3', 0, 0.042, 0.0305, 0.02, 0.008, 0.002);
  box(gr, '#9a9286', 0, 0.05, 0, 0.135, 0.004, 0.064);
  hall(gr, 0, 0.054, 0, 0.08, 0.04, 0.034, '#e0952f', 0, '#c0392b', { rh: 0.028, lift: 0.5 });
  // Summit temple on the Jade Emperor Peak
  const sx = 0.2, sz = -0.24, sy = Y0 + h(sx, sz);
  box(gp, '#b8322a', sx, sy - 0.01, sz, 0.12, 0.022, 0.09);
  hall(gp, sx, sy + 0.012, sz, 0.07, 0.045, 0.036, '#e6b13a', 0, '#c0392b', { rh: 0.026 });
  // Inscribed red-character boulder, pines, clouds and pilgrims
  const bx = 0.1, bz = 0.3;
  blob(gp, '#a39b8f', bx, Y0 + h(bx, bz) + 0.02, bz, 0.05, 0.04, 0.035, 0.3);
  for (let k = 0; k < 3; k++) box(gp, '#c62828', bx - 0.012 + k * 0.012, Y0 + h(bx, bz) + 0.02, bz + 0.033, 0.008, 0.02, 0.002, 0.3);
  for (let i = 0; i < 60; i++) {
    const x = -0.45 + hash3(i, 1, 5) * 0.9, z = -0.45 + hash3(i, 2, 5) * 0.9;
    if (Math.hypot(x, z) > 0.46 || pd(x, z) < 0.05 || Math.hypot(x - sx, z - sz) < 0.08 || Math.hypot(x - gx, z - gz) < 0.1) continue;
    minipine(gp, x, Y0 + h(x, z), z, 0.03 + hash3(i, 3, 5) * 0.025, i % 2 ? '#2f5a32' : '#3b6a3a');
  }
  cloud(gp, -0.32, 0.3, 0.05, 0.08, 1);
  cloud(gp, 0.36, 0.26, 0.04, 0.07, 2);
  cloud(gp, 0.0, 0.5, -0.38, 0.06, 3, 4);
  for (const [t, c] of [[0.2, '#dc2626'], [0.45, '#2563eb'], [0.62, '#f59e0b'], [0.85, '#16a34a']] as const) {
    const x = S0[0] + (S1[0] - S0[0]) * t, z = S0[1] + (S1[1] - S0[1]) * t;
    person(gp, x + 0.006, Y0 + ph(t) - 0.004, z, c, 1.2);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Yuanyang Hani rice terraces — flooded mirror terraces stepping down a mountainside, mushroom-roof village
const cn_yuanyang: Builder = gp => {
  const S = 0.026, FOREST = 0.3;
  const base = (x: number, z: number) => 0.34 * Math.exp(-((x + 0.06) ** 2 / 0.16 + (z + 0.3) ** 2 / 0.09)) + 0.12 * Math.exp(-((x - 0.3) ** 2 + (z + 0.05) ** 2) / 0.03) + 0.02 * fbm(x * 5, 1, z * 5, 2) + 0.02;
  const h: HFn = (x, z) => {
    const b = base(x, z);
    if (b > FOREST) return b;
    const q = b / S, k = Math.floor(q);
    return S * (k + sstep(0.72, 1, q - k));
  };
  island(gp, 0.5, h, '#5d7a3c', (x, y, z, _nx, ny) => {
    const b = base(x, z);
    if (b > FOREST - 0.005) return fbm(x * 14, 2, z * 14, 2) > 0.5 ? '#2f5a32' : '#3b6a3a';
    const q = b / S;
    if (q - Math.floor(q) < 0.66 && ny > 0.8) {
      const k = Math.floor(q), f = fbm(x * 7 + k, 1, z * 7, 2);
      return f > 0.62 ? '#86b35a' : (k + Math.floor(x * 6)) % 3 === 0 ? '#e0b3a0' : f < 0.4 ? '#9ec1d8' : '#b9d3e4';
    }
    return ny > 0.7 ? '#6f8a46' : '#5a6b38';
  }, { rings: 48, segs: 128, side: strataSide(EARTH) });
  // Forest crown above the terraces
  for (let i = 0; i < 40; i++) {
    const x = -0.4 + hash3(i, 1, 8) * 0.7, z = -0.48 + hash3(i, 2, 8) * 0.34;
    if (Math.hypot(x, z) > 0.46 || base(x, z) < FOREST) continue;
    blob(gp, i % 3 ? '#2f5a32' : '#3f6e38', x, Y0 + h(x, z) + 0.03, z, 0.035, 0.035, 0.035, i);
  }
  // Hani village: earth-walled houses with big thatched "mushroom" roofs
  const V: [number, number][] = [[0.26, -0.08], [0.32, -0.02], [0.22, -0.01], [0.36, -0.1], [0.29, 0.05], [0.18, -0.08], [0.38, 0.03]];
  V.forEach(([x, z], i) => {
    const y = Y0 + base(x, z) - 0.004, ry = hash3(i, 1, 1);
    box(gp, '#c9a27a', x, y, z, 0.03, 0.022, 0.026, ry);
    add(gp, g('cn:hut', () => { const c = new THREE.ConeGeometry(0.5, 1, 4); c.rotateY(Math.PI / 4); return c; }), mat(i % 2 ? '#b89a5a' : '#a8884a'), x, y + 0.038, z, 0.052, 0.034, 0.046, ry);
  });
  for (let i = 0; i < 8; i++) { const x = 0.2 + hash3(i, 1, 9) * 0.2, z = -0.16 + hash3(i, 2, 9) * 0.06; blob(gp, '#3f6e38', x, Y0 + base(x, z) + 0.02, z, 0.025, 0.03, 0.025, i); }
  // Farmer in a conical hat with a water buffalo on a terrace bund
  const fx = -0.05, fz = 0.3, fy = Y0 + h(fx, fz);
  person(gp, fx, fy, fz, '#1e3a8a', 1.3);
  cone(gp, '#e3c77a', fx, fy + 0.026, fz, 0.012, 0.008, 8);
  const bf = grp(gp, fx + 0.06, fz - 0.01, 0.4, fy);
  for (const [lx, lz] of [[-0.008, -0.014], [0.008, -0.014], [-0.008, 0.014], [0.008, 0.014]]) cyl(bf, '#3a3a3a', lx, 0, lz, 0.003, 0.016, 5);
  blob(bf, '#4a4a4a', 0, 0.022, 0, 0.014, 0.011, 0.024, 0, true);
  blob(bf, '#4a4a4a', 0, 0.026, 0.026, 0.008, 0.008, 0.01, 0, true);
  for (const sd of [-1, 1]) rod(bf, [sd * 0.006, 0.032, 0.026], [sd * 0.02, 0.036, 0.018], 0.0018, '#d8cfbf', 4);
  // Morning mist
  cloud(gp, -0.34, 0.3, -0.12, 0.07, 1);
  cloud(gp, 0.3, 0.32, -0.3, 0.06, 2, 4);
  cloud(gp, 0.05, 0.42, -0.42, 0.06, 3, 4);
};

export const H_CHINA: Record<string, Builder> = {
  cn_zhangjiajie, cn_guilin, cn_huangshan, cn_westlake, cn_yellowcrane, cn_mogao, cn_bund,
  cn_danxia, cn_jiuzhaigou, cn_hangingtemple, cn_taishan, cn_yuanyang,
};
