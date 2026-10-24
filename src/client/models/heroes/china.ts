import { human, passerby } from '../human.ts';
import * as THREE from 'three';
import {
  type Builder, type Paint, type V3, add, g, mat, box, cyl, cone, rod, strut, ellip, sweep, tube, skin, lathe, tbox, shade, fbm, hash3,
  tree, PLINTH_SIDE,
} from '../prims.ts';
import { type HFn, type IslandOpts, island as island0, sstep, ridged } from '../nature.ts';

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
/** Radius of the sculpted terrain disc; it sits inside the shared plinth rim (R 0.48). */
const RIM = 0.465;
/** Terrain heights fade to the plinth top over the outer rim, so every diorama stands on the same low base. */
const rimFade = (h: HFn): HFn => (x, z) => h(x, z) * sstep(RIM, RIM - 0.05, Math.hypot(x, z));
/**
 * Sculpted terrain on the shared museum base: the shared plinth's bevelled walnut side profile (open ring — the
 * terrain is the top, so water may sit below the rim) and a terrain disc with a plinth-coloured skirt.
 * Heights should come from rimFade() so the rim meets the plinth top.
 */
function island(gp: THREE.Object3D, _R: number, h: HFn, base: string, paint: Paint, o: IslandOpts = {}): void {
  const R = 0.48, H = 0.035;
  lathe(gp, [[R * 0.97, 0], [R, H * 0.18], [R, H * 0.7], [R * 0.985, H * 0.92], [R * 0.965, H]], PLINTH_SIDE, 0, 0, 0, 56);
  island0(gp, RIM, h, base, paint, { ...o, side: () => PLINTH_SIDE });
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
    blob(p, i % 2 ? '#dfe2e1' : '#d6dad9', x + Math.cos(a) * d * 1.4, y + hash3(seed, i, 4) * s * 0.18, z + Math.sin(a) * d * 0.7, r, r * 0.42, r * 0.75, a, true);
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
  add(p, geo, mat('#d8dcdb', { flat: false, rough: 0.95, transparent: 0.72 }), 0, 0, 0, 1, 1, 1);
}
/** Muted, everyday clothing colours for visitors (natural dyes, no saturated primaries). */
const DRESS = ['#3d5470', '#d8cfbd', '#7a5a3c', '#5b6455', '#8e3b2e', '#2f3a48', '#a8946c', '#6d7a86'];
/** Tiny visitor for scale. */
function person(p: THREE.Object3D, x: number, y: number, z: number, c: string, s = 1): void {
  passerby(p, x, y, z, 0.018 * s, 1, { top: c });
}
/** Chinese pine (shared layered-pad pine from prims). */
function minipine(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#2f5a32'): void {
  tree(p, x, y, z, s * 0.78, c, true);
}
/** Broadleaf tree (shared natural clump from prims). */
function bush(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string): void {
  tree(p, x, y, z, s * 0.85, c);
}
/** Calm natural water: faint sheen streaks instead of bright ripple flecks. */
function calm(gp: THREE.Object3D, _R: number, y: number, c: string, dir = 0): void {
  const R = RIM - 0.004, ca = Math.cos(dir), sa = Math.sin(dir);
  island0(gp, R, () => 0, c, (x, _y, z) => {
    const u = x * ca + z * sa, v = -x * sa + z * ca, k = Math.sin(v * 70 + Math.sin(u * 9) * 3) * Math.sin(u * 23 + v * 5);
    return k > 0.8 ? shade(c, 1.05) : c;
  }, { rings: 18, segs: 96, base: y, side: () => PLINTH_SIDE });
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
  const h: HFn = rimFade((x, z) => 0.025 * fbm(x * 7, 1, z * 7, 3) + 0.02 * sstep(0.3, 0.5, Math.hypot(x, z)));
  island(gp, 0.5, h, '#3f6b35', (x, _y, z) => {
    const f = fbm(x * 14, 2, z * 14, 2), c = hash3(Math.floor(x * 70), 1, Math.floor(z * 70));
    return f > 0.58 ? '#4e8040' : f < 0.4 ? '#30562c' : c > 0.85 ? '#5a8a44' : null;
  }, { rings: 26, segs: 80 });
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
  const segs = 16, nf = 14, la = hash3(seed, 2, 2) * Math.PI * 2, lean = (hash3(seed, 1, 2) - 0.5) * 0.3;
  const flute = Array.from({ length: segs }, (_, j) => 0.78 + 0.44 * hash3(j, seed, 5));
  const rings: V3[][] = [];
  for (let i = 0; i <= nf; i++) {
    // Tower karst: near-vertical lower walls, then a blunt conical crown (not a dome)
    const f = (i / nf) * 0.99, rf = Math.pow(Math.max(0, 1 - f ** 2.2), 0.6) * (1 - 0.18 * f);
    const ring: V3[] = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const rr = R * rf * flute[j] * (0.75 + 0.5 * fbm(Math.cos(a) * 1.5 + seed, f * 4, Math.sin(a) * 1.5 + seed, 2));
      const off = lean * f * f * H;
      ring.push([x + Math.cos(a) * rr + Math.cos(la) * off, y0 - 0.01 + f * H, z + Math.sin(a) * rr + Math.sin(la) * off]);
    }
    rings.push(ring);
  }
  skin(p, rings, '#4c7038', {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      const f = (py - y0) / H, col = Math.floor(((Math.atan2(pz - z, px - x) + Math.PI) / (Math.PI * 2)) * segs), band = Math.floor(f * nf);
      // Bare limestone shows as vertical grey-white cliff streaks on the steep flanks; the rest is dense dark scrub
      const st = hash3(col, 0, seed);
      if (ny < 0.35 && st > 0.55 && f > 0.1 && f < 0.8 && hash3(col, Math.floor(band / 3), seed + 1) > 0.45) return hash3(col, band, 1) > 0.5 ? '#94907f' : '#828072';
      const hh = hash3(col, band, seed);
      return hh > 0.75 ? '#55753f' : hh < 0.25 ? '#3a5a30' : f > 0.75 ? '#4a6c38' : null;
    },
  });
}
const cn_guilin: Builder = gp => {
  // Ref: Li River at Xingping (the ¥20 note view, Wikimedia "Li River Xingping"): steep tower karst, jade river, bamboo-fringed banks, cormorant fishers.
  const WC = '#5e8f84', WL = Y0 - 0.002, Wd = 0.095;
  calm(gp, 0.49, WL - 0.004, WC, Math.PI / 2);
  const h: HFn = rimFade((x, z) => { const d = Math.abs(x - rivX(z)); return -0.014 + 0.026 * sstep(Wd * 0.75, Wd * 1.3, d) + 0.008 * fbm(x * 8, 3, z * 8, 2) * sstep(Wd, Wd * 2, d); });
  island(gp, 0.5, h, '#6a8a48', (x, y, z) => {
    if (y < WL + 0.003) return '#a59d86';
    const ci = Math.floor((x + 1) * 26), cj = Math.floor((z + 1) * 26), hh = hash3(ci, 7, cj);
    return hh > 0.75 ? '#718f4c' : hh > 0.5 ? '#6a8848' : hh < 0.1 ? '#8c8a62' : null;
  }, { rings: 34, segs: 96 });
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
      add(gp, g('cn:cone5', () => new THREE.ConeGeometry(0.5, 1, 5)), mat(k % 2 ? '#6f9046' : '#5d7f3c'), x + rz * 0.02, Y0 + h(x, z) + hh / 2, z + rx * 0.02, 0.014, hh, 0.014, 0, rx, rz);
    }
  }
  // Xingping riverside houses: lime-washed brick walls, dark grey tile
  for (const [x, z, ry] of [[0.2, 0.3, 0.3], [0.25, 0.25, 0.1], [0.17, 0.37, 0.5]] as const) {
    const y = Y0 + h(x, z);
    box(gp, '#d9d4c8', x, y, z, 0.034, 0.024, 0.024, ry);
    const gr = grp(gp, x, z, ry, y + 0.024);
    add(gr, g('cn:gable', () => { const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.5)]); const eg = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); eg.translate(0, 0, -0.5); return eg; }), mat('#4a4e52'), 0, 0, 0, 0.032, 0.03, 0.04, Math.PI / 2);
  }
  // Bamboo raft: lashed poles with upturned bow, a fisherman in a conical bamboo hat poling, two cormorants on the gunwale
  const rz0 = 0.28, rr = grp(gp, rivX(rz0), rz0, -0.35, WL);
  for (let k = 0; k < 9; k++) {
    const x = (k - 4) * 0.0052, c = k % 3 ? '#a8955f' : '#8f7e50';
    tube(rr, [[x, 0.002, -0.058], [x, 0.002, 0.03], [x, 0.006, 0.052], [x, 0.012, 0.064]], 0.0026, 0.0024, c, { radial: 5 });
  }
  for (const z of [-0.04, 0.0, 0.035]) rod(rr, [-0.024, 0.0045, z], [0.024, 0.0045, z], 0.0011, '#6f6040', 4);
  const fish = human(rr, 0, 0.004, -0.018, { h: 0.019, top: '#3b4656', bottom: '#2f3540', skin: '#b08866', hair: null, hat: '#b49e6c', hatStyle: 'conical', pose: 'stand', ry: 0.4, hands: [[-0.05, 0.62, 0.12], [0.06, 0.78, 0.14]], detail: 'lo' });
  rod(rr, [fish.handL[0] - 0.012, -0.006, fish.handL[2] - 0.03], [fish.handR[0] + 0.01, 0.05, fish.handR[2] + 0.02], 0.0007, '#7a6a48', 4);
  for (const [cx, cz, ry] of [[-0.013, 0.028, 0.4], [0.013, 0.036, -0.3]] as const) {
    const cb = grp(rr, cx, cz, ry, 0.005);
    ellip(cb, '#24272a', 0, 0.006, 0, 0.0034, 0.0042, 0.0058, 0, -0.5);
    rod(cb, [0, 0.009, 0.002], [0, 0.0135, 0.0035], 0.0012, '#24272a', 4);
    ellip(cb, '#2a2d30', 0, 0.0145, 0.004, 0.0018, 0.0017, 0.0022);
    rod(cb, [0, 0.0143, 0.0058], [0, 0.0138, 0.0085], 0.0005, '#8a7a5a', 3);
    rod(cb, [0, 0.003, -0.004], [0, 0.0005, -0.009], 0.0016, '#1e2023', 3);
  }
  // Hanging oil lamp on its bamboo crook at the stern
  rod(rr, [0, 0.004, -0.052], [0, 0.03, -0.056], 0.0008, '#6f6040', 3);
  cyl(rr, '#5a5248', 0, 0.019, -0.056, 0.0028, 0.007, 6);
  // Li River tour boat upstream: low white two-deck hull, grey awning roof
  const bz = -0.16, bt = grp(gp, rivX(bz), bz, 0.25, WL);
  box(bt, '#dcdcd6', 0, -0.002, 0, 0.03, 0.01, 0.1);
  box(bt, '#2e3438', 0, 0.008, 0.0, 0.028, 0.006, 0.07);
  box(bt, '#d4d4ce', 0, 0.014, 0.0, 0.03, 0.002, 0.074);
  box(bt, '#33383c', 0, 0.016, -0.005, 0.026, 0.004, 0.05);
  box(bt, '#8b9195', 0, 0.02, -0.005, 0.03, 0.0015, 0.056);
};

// ---------------------------------------------------------------------------------------------------------
// Huangshan — granite spires above a sea of clouds, the Welcoming-Guest Pine and the Flying-Over Rock
function guestPine(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const T = '#4e3d30', F = '#2c4a2b', F2 = '#365631';
  tube(p, [[x, y, z], [x + 0.01 * s, y + 0.07 * s, z], [x - 0.004 * s, y + 0.15 * s, z], [x + 0.006 * s, y + 0.22 * s, z]], 0.012 * s, 0.007 * s, T, { radial: 7 });
  // The long "welcoming arm" reaching out to the side
  tube(p, [[x, y + 0.1 * s, z], [x - 0.06 * s, y + 0.11 * s, z + 0.01 * s], [x - 0.13 * s, y + 0.1 * s, z + 0.03 * s], [x - 0.2 * s, y + 0.105 * s, z + 0.04 * s]], 0.007 * s, 0.004 * s, T, { radial: 6 });
  tube(p, [[x, y + 0.17 * s, z], [x + 0.06 * s, y + 0.18 * s, z - 0.01 * s], [x + 0.09 * s, y + 0.2 * s, z]], 0.005 * s, 0.003 * s, T, { radial: 6 });
  const pads: [number, number, number, number][] = [
    [-0.2, 0.12, 0.04, 0.034], [-0.16, 0.112, 0.045, 0.03], [-0.13, 0.115, 0.025, 0.036], [-0.09, 0.122, 0.03, 0.03], [-0.06, 0.127, 0.012, 0.034],
    [0.0, 0.24, 0.0, 0.042], [0.03, 0.255, 0.015, 0.03], [0.04, 0.2, -0.01, 0.036], [0.09, 0.215, 0.0, 0.03], [-0.03, 0.19, 0.01, 0.034],
    [0.02, 0.29, 0.0, 0.03], [-0.025, 0.265, -0.012, 0.028],
  ];
  pads.forEach(([dx, dy, dz, r], i) => {
    // Huangshan pines carry flat, layered needle shelves: two thin offset plates per pad
    blob(p, i % 2 ? F : F2, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.22, r * s * 0.8, i);
    blob(p, shade(i % 2 ? F2 : F, 0.92), x + (dx + 0.01) * s, y + (dy - 0.012) * s, z + (dz + 0.008) * s, r * s * 0.8, r * s * 0.16, r * s * 0.7, i + 2);
  });
}
const cn_huangshan: Builder = gp => {
  // Ref: Huangshan (UNESCO 547) — grey granite spires over a sea of clouds; Guest-Greeting Pine (~10 m) by Yuping Lou; Feilai Shi, a 12 m upright slab on a flat summit.
  const GR = ['#a49b92', '#8f877f', '#b6ada2', '#7f786f', '#9c948a'];
  const h: HFn = rimFade((x, z) => 0.05 * ridged(x * 4 + 3, z * 4, 3) + 0.06 * sstep(0.45, 0.0, Math.hypot(x, z + 0.1)));
  island(gp, 0.5, h, '#355f33', (x, y, z, _nx, ny) => {
    if (ny < 0.6) return hash3(Math.floor(x * 80), 2, Math.floor(z * 80)) > 0.5 ? '#8a827a' : '#6f6962';
    const f = fbm(x * 12, y * 10, z * 12, 2);
    return f > 0.58 ? '#447a3c' : f < 0.4 ? '#2b5129' : null;
  }, { rings: 26, segs: 80 });
  const S: [number, number, number, number][] = [
    [0.0, -0.1, 0.09, 0.78], [-0.17, -0.16, 0.075, 0.62], [0.18, -0.2, 0.07, 0.58], [-0.31, -0.02, 0.06, 0.44], [0.31, -0.04, 0.06, 0.46],
    [-0.07, -0.32, 0.065, 0.52], [0.1, -0.35, 0.06, 0.44], [-0.28, -0.28, 0.055, 0.4], [0.32, -0.27, 0.05, 0.36], [-0.12, 0.06, 0.045, 0.3], [0.14, 0.0, 0.05, 0.36],
  ];
  const tops: V3[] = [];
  S.forEach(([x, z, R, H], i) => {
    const y0 = Y0 + h(x, z), c = column(gp, x, z, R, H, y0, i * 7 + 3, { pal: GR, moss: '#3e5a36', top: '#8f877f', segs: 10, nf: 12, jag: 0.5, taper: 0.62, point: 1, wob: 0.12, lean: 0.12, mossT: 1.25 });
    tops.push(c.top);
    // Pines clinging to the granite ledges
    for (let k = 0; k < 4 + Math.round(R * 40); k++) {
      const f = 0.15 + hash3(i, k, 1) * 0.6, a = hash3(i, k, 2) * Math.PI * 2, q = c.at(f), rr = c.rAt(f) * 0.9;
      minipine(gp, q[0] + Math.cos(a) * rr, q[1], q[2] + Math.sin(a) * rr, 0.022 + hash3(i, k, 3) * 0.014, k % 2 ? '#2f5a2e' : '#3c6b36');
    }
  });
  // Flying-Over Rock: a tall weathered slab standing on a flat summit ledge
  const fr = tops[4];
  box(gp, '#9a9289', fr[0], fr[1] - 0.006, fr[2], 0.03, 0.008, 0.026, 0.3);
  column(gp, fr[0], fr[2], 0.011, 0.05, fr[1], 91, { pal: ['#aaa298', '#9a9289', '#b3aba0'], moss: '#6f6a60', top: '#a39b91', segs: 8, nf: 5, jag: 0.35, taper: 0.1, wob: 0.15, lean: 0.05 });
  // Sea of clouds pooling between the spires (one soft sheet, no cartoon puffs)
  cloudSheet(gp, 0.47, 0.16, 0.045, 3);
  // Granite lookout with the Welcoming-Guest Pine; a second outcrop carries the viewing terrace and visitors
  const px = 0.25, pz = 0.27, py = Y0 + h(px, pz);
  const lk = column(gp, px, pz, 0.08, 0.26, py, 77, { pal: GR, moss: '#3e5a36', top: '#8f877f', segs: 10, nf: 7, jag: 0.4, taper: 0.25, wob: 0.1, lean: 0, mossT: 1.25 });
  guestPine(gp, px - 0.01, lk.top[1] - 0.01, pz - 0.01, 0.55);
  const vx = -0.14, vz = 0.3, vk = column(gp, vx, vz, 0.085, 0.22, Y0 + h(vx, vz), 78, { pal: GR, moss: '#3e5a36', top: '#8f877f', segs: 10, nf: 6, jag: 0.35, taper: 0.15, wob: 0.08, lean: 0, mossT: 1.25 });
  const vy = vk.top[1] - 0.008;
  box(gp, '#c9c1b4', vx, vy, vz, 0.13, 0.012, 0.1, 0.15);
  rail(gp, [vx - 0.06, vy + 0.012, vz + 0.055], [vx + 0.06, vy + 0.012, vz + 0.04], 0.014, '#e6e0d4');
  for (const [dx, c] of [[-0.03, DRESS[0]], [0.0, DRESS[4]], [0.03, DRESS[6]]] as const) person(gp, vx + dx, vy + 0.012, vz + 0.02, c, 1.1);
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
  for (let i = 0; i <= nc; i++) cyl(gr, o.col ?? '#7a2a20', -w / 2 + (i / nc) * w, 0, d / 2 + cr * 0.6, cr, h, 5);
  const bh = Math.min(0.008, h * 0.18);
  box(gr, o.band ?? '#3f5f5a', 0, h - bh, 0, w + 0.004, bh, d + 0.004);
  const ov = o.ov ?? 1.35, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  return y + proof(gr, 0, h, 0, { n: 4, R0, R1: R0 * 0.3, h: o.rh ?? d * 0.42, lift: o.lift ?? 0.35, tile: roof, sx: (w + d * (ov - 1)) / (d * ov) });
}
/** Calabash (gourd) finial on a spike — the golden tip of pagodas and towers. */
function gourd(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#e8b23a'): void {
  lathe(p, [[0, 0], [0.4, 0.05], [0.55, 0.25], [0.3, 0.48], [0.42, 0.66], [0.2, 0.9], [0, 1]].map(([r, v]) => [r * s, v * s * 1.6] as [number, number]), c, x, y, z, 8);
  rod(p, [x, y + s * 1.5, z], [x, y + s * 2.4, z], s * 0.06, c, 4);
}
/** Weeping willow: leaning trunk, a light crown and a curtain of hanging strands (or a peach when c is pink). */
function willow(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#8fa860'): void {
  const lx = (hash3(x * 50, z * 50, 1) - 0.5) * s * 0.3, lz = (hash3(x * 50, z * 50, 2) - 0.5) * s * 0.3;
  strut(p, [x, y, z], [x + lx, y + s * 0.6, z + lz], s * 0.06, s * 0.035, '#4d4034', 5);
  const cx = x + lx, cy = y + s * 0.62, cz = z + lz;
  ellip(p, shade(c, 0.9), cx, cy + s * 0.04, cz, s * 0.2, s * 0.2, s * 0.2);
  const DROP = g('cn:droop', () => { const c0 = new THREE.ConeGeometry(0.5, 1, 4); c0.rotateX(Math.PI); c0.translate(0, -0.5, 0); return c0; });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + x * 5, r = s * (0.15 + 0.05 * hash3(k, x * 40, 3)), L = s * (0.5 + 0.15 * hash3(k, z * 40, 4));
    add(p, DROP, mat(shade(c, k % 2 ? 0.92 : 1.05)), cx + Math.cos(a) * r, cy + s * 0.2, cz + Math.sin(a) * r, s * 0.11, L, s * 0.11, a);
  }
}

// ---------------------------------------------------------------------------------------------------------
// West Lake, Hangzhou — Leifeng Pagoda on its hill, Bai Causeway willows, the Broken Bridge, Three Pools lanterns
const cn_westlake: Builder = gp => {
  // Ref: Leifeng Pagoda as rebuilt 2002 (Baidu Baike 雷峰塔): octagonal 5-storey Song-style tower, dark tin-bronze tiles, brass columns/brackets, 16 m spire; Bai Causeway willows, Duanqiao, Santan Yinyue lanterns.
  const WC = '#6c8880', WL = Y0 - 0.002;
  calm(gp, 0.49, WL - 0.004, WC, 0.8);
  const ax = -0.42, az = -0.1, bx = -0.04, bz = 0.46, L = Math.hypot(bx - ax, bz - az);
  const along = (x: number, z: number) => ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L);
  const cdist = (x: number, z: number) => { const t = Math.max(0, Math.min(1, along(x, z))); return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t); };
  const GAP = [0.7, 0.78];
  const hill = (x: number, z: number) => 0.16 * sstep(1, 0.25, Math.hypot((x - 0.06) / 0.46, (z + 0.42) / 0.24)) + 0.02 * fbm(x * 9, 4, z * 9, 2) * sstep(1, 0.5, Math.hypot((x - 0.06) / 0.46, (z + 0.42) / 0.24));
  const h: HFn = rimFade((x, z) => {
    const t = along(x, z), gap = t > GAP[0] && t < GAP[1] ? 1 : 0;
    const cw = gap ? -0.03 : 0.03 * sstep(0.034, 0.022, cdist(x, z));
    return Math.max(hill(x, z), cw) - 0.02;
  });
  island(gp, 0.5, h, '#4c7442', (x, y, z) => {
    if (y < WL + 0.004) return '#a89f86';
    if (cdist(x, z) < 0.04 && hill(x, z) < 0.02) return cdist(x, z) < 0.009 ? '#bdb6a2' : '#6d8f50';
    const f = fbm(x * 16, 2, z * 16, 2);
    return f > 0.6 ? '#567f49' : f < 0.4 ? '#3c6136' : null;
  }, { rings: 30, segs: 96 });
  // Leifeng Pagoda — stone podium over the Wuyue ruins, five octagonal storeys with balconies, bronze eaves, tall spire
  const px = 0.06, pz = -0.36, py = Y0 + h(px, pz), TILE = '#3e4743', RIB = '#4f5953', BRASS = '#7d4a2c', WALL = '#9a6a42';
  lathe(gp, [[0, 0], [0.1, 0], [0.1, 0.03], [0.088, 0.03], [0.088, 0.036], [0, 0.036]], '#a8a194', px, py - 0.01, pz, 8);
  for (let k = 0; k < 6; k++) box(gp, '#9a9387', px, py - 0.01 + k * 0.005, pz + 0.1 + (5 - k) * 0.006, 0.04, 0.005, 0.006);
  let y = py + 0.026;
  for (let i = 0; i < 5; i++) {
    const R = 0.062 - i * 0.0045, sh = i === 0 ? 0.05 : 0.04;
    storey(gp, px, y, pz, 8, R, sh, BRASS, WALL, undefined, 1, 1, 2);
    // Balcony walkway with railing around each upper storey
    if (i > 0) { lathe(gp, [[0, 0], [R * 1.12, 0], [R * 1.12, 0.003], [0, 0.003]], '#5d4a3a', px, y - 0.002, pz, 8); }
    y += sh;
    box(gp, '#6e5034', px, y - 0.007, pz, R * 1.75, 0.007, R * 1.75, Math.PI / 8);
    y = proof(gp, px, y, pz, { n: 8, R0: R * 1.5, R1: R * 0.86, h: 0.018, lift: 0.3, tile: TILE, rib: RIB, under: '#5a3e2a' }) - 0.004;
  }
  y = proof(gp, px, y, pz, { n: 8, R0: 0.05, R1: 0.004, h: 0.03, lift: 0.3, tile: TILE, rib: RIB });
  // Spire (塔刹): base drum, seven bronze rings and a pearl — about a third of the body height
  const SP = '#8a6a3c';
  cyl(gp, SP, px, y - 0.006, pz, 0.006, 0.012, 8);
  for (let k = 0; k < 7; k++) cyl(gp, shade(SP, 1.1), px, y + 0.008 + k * 0.007, pz, 0.0085 - k * 0.0006, 0.0025, 10);
  rod(gp, [px, y, pz], [px, y + 0.085, pz], 0.0016, SP, 5);
  ellip(gp, SP, px, y + 0.066, pz, 0.006, 0.0045, 0.006);
  ellip(gp, shade(SP, 1.15), px, y + 0.078, pz, 0.004);
  // Wooded hill around the pagoda
  for (let i = 0; i < 46; i++) {
    const x = -0.36 + hash3(i, 1, 9) * 0.8, z = -0.46 + hash3(i, 2, 9) * 0.3;
    if (Math.hypot(x, z) > 0.46 || Math.hypot(x - px, (z - pz) * 1.3) < 0.13 || hill(x, z) < 0.03) continue;
    const s = 0.03 + hash3(i, 3, 9) * 0.02, c = ['#3d6136', '#4a6e40', '#34532f', '#566f45', '#44603a'][i % 5];
    bush(gp, x, Y0 + h(x, z), z, s * 1.2, c);
  }
  // Bai Causeway: willows alternating with (pale) peach, strollers, the Broken Bridge arching over the gap
  for (let i = 0; i < 16; i++) {
    const t = 0.05 + i * 0.058;
    if (t > GAP[0] - 0.04 && t < GAP[1] + 0.03) continue;
    const sd = i % 2 ? 1 : -1, nx = (bz - az) / L, nz = -(bx - ax) / L;
    const x = ax + (bx - ax) * t + nx * sd * 0.022, z = az + (bz - az) * t + nz * sd * 0.022;
    if (Math.hypot(x, z) > 0.47) continue;
    willow(gp, x, Y0 + h(x, z), z, 0.065, i % 4 === 0 ? '#c9aeb0' : '#8fa860');
  }
  for (const [t, c] of [[0.3, DRESS[0]], [0.34, DRESS[1]], [0.55, DRESS[4]], [0.9, DRESS[3]]] as const) {
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    person(gp, x, Y0 + h(x, z), z, c, 1.0);
  }
  {
    const t = (GAP[0] + GAP[1]) / 2, x = ax + (bx - ax) * t, z = az + (bz - az) * t, ry = Math.atan2(-(bz - az), bx - ax);
    const br = grp(gp, x, z, ry, WL), hl = (GAP[1] - GAP[0]) * L * 0.5 + 0.03;
    const deck = [-1, -0.5, 0, 0.5, 1].map(u => ({ p: [u * hl, 0.012 + 0.026 * (1 - u * u), 0] as V3, w: 0.016, h: 0.006 }));
    sweep(br, deck, '#bdb7aa', { radial: 6, sub: 3, flat: true, up: [0, 0, 1] });
    for (const sd of [-1, 1]) {
      add(br, g('cn:arch', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, -Math.PI / 2, Math.PI)), mat('#2c3e3a'), 0, 0, sd * 0.0165, hl * 0.42, 0.002, hl * 0.42, 0, Math.PI / 2);
      for (let k = -4; k <= 4; k++) { const u = k / 4; box(br, '#cfc9bc', u * hl * 0.95, 0.018 + 0.026 * (1 - u * u), sd * 0.014, 0.003, 0.009, 0.003); }
    }
  }
  // Three Pools Mirroring the Moon — three ~2 m stone lanterns: hollow globe with five round holes, gourd cap
  for (const [x, z] of [[0.2, 0.12], [0.3, 0.2], [0.17, 0.26]] as const) {
    const ST = '#8f8a7e';
    cyl(gp, ST, x, WL - 0.004, z, 0.0035, 0.012, 6);
    ellip(gp, ST, x, WL + 0.014, z, 0.0075, 0.007, 0.0075);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ellip(gp, '#2a2a26', x + Math.cos(a) * 0.0068, WL + 0.014, z + Math.sin(a) * 0.0068, 0.0022, 0.0022, 0.0022); }
    lathe(gp, [[0, 0], [0.004, 0], [0.0055, 0.003], [0.003, 0.006], [0.0035, 0.008], [0, 0.011]], ST, x, WL + 0.02, z, 6);
  }
  // Hangzhou canopy rowboat (手划船) with a standing boatman sculling at the stern
  const bt = grp(gp, 0.06, 0.06, 0.5, WL);
  sweep(bt, [-0.05, -0.03, 0, 0.03, 0.05].map((u, i) => ({ p: [0, 0.006 + (i === 0 || i === 4 ? 0.006 : 0), u] as V3, w: i === 0 || i === 4 ? 0.003 : i === 2 ? 0.015 : 0.012, h: 0.007 })), '#6a4a30', { radial: 8, sub: 3, squash: 0.6, flat: true });
  add(bt, g('cn:awning', () => { const c = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true, Math.PI / 2, Math.PI); c.rotateX(Math.PI / 2); return c; }), mat('#33302b'), 0, 0.012, 0, 0.026, 0.026, 0.04);
  const bm = human(bt, 0, 0.008, -0.036, { h: 0.019, top: '#3b4656', bottom: '#2f3540', skin: '#b08866', hair: '#1d1a17', pose: 'stand', hands: [[-0.05, 0.6, 0.18], [0.05, 0.64, 0.2]], detail: 'lo' });
  rod(bt, [bm.handR[0], bm.handR[1], bm.handR[2]], [0.012, -0.004, -0.075], 0.0009, '#5e4a30', 4);
  // Lotus pads with a few pale flowers
  for (let i = 0; i < 14; i++) {
    const x = 0.28 + (hash3(i, 1, 4) - 0.5) * 0.16, z = 0.36 + (hash3(i, 2, 4) - 0.5) * 0.12;
    if (Math.hypot(x, z) > 0.47) continue;
    cyl(gp, i % 2 ? '#4d7440' : '#587c45', x, WL, z, 0.009 + hash3(i, 3, 4) * 0.005, 0.0015, 9);
    if (i % 5 === 0) cone(gp, '#d8b6bc', x, WL + 0.0015, z, 0.003, 0.006, 6);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Yellow Crane Tower, Wuhan — five golden-roofed storeys with cross-plan wings, on Snake Hill
const cn_yellowcrane: Builder = gp => {
  // Ref: Yellow Crane Tower, 1985 rebuild on Snake Hill (Wikipedia): 5 storeys / 51.4 m, square-in-octagon cross plan, 72 red columns, 60 upturned eaves of yellow glazed tile, pyramidal top with gourd.
  const WC = '#7f8a7e', WL = Y0 - 0.004;
  calm(gp, 0.49, WL - 0.004, WC, -0.6);
  const h: HFn = rimFade((x, z) => 0.1 * sstep(0.46, 0.14, Math.hypot(x, (z + 0.06) * 1.15)) + 0.01 * fbm(x * 8, 2, z * 8, 2) - 0.03 * sstep(0.34, 0.44, z + x * 0.25));
  island(gp, 0.5, h, '#567a44', (x, y, z) => {
    if (y < WL + 0.006) return '#9e937a';
    const f = fbm(x * 14, 3, z * 14, 2);
    return f > 0.62 ? '#628450' : f < 0.38 ? '#466a3a' : null;
  }, { rings: 28, segs: 84 });
  const tx = 0, tz = -0.08, ty = Y0 + h(tx, tz) + 0.002;
  // White marble terrace with balustrade and front stairs
  box(gp, '#cfc9bb', tx, ty - 0.03, tz, 0.36, 0.034, 0.34);
  for (const [a, b] of [[[-0.18, 0.17], [-0.03, 0.17]], [[0.03, 0.17], [0.18, 0.17]], [[-0.18, -0.17], [0.18, -0.17]], [[-0.18, -0.17], [-0.18, 0.17]], [[0.18, -0.17], [0.18, 0.17]]] as const)
    rail(gp, [tx + a[0], ty + 0.004, tz + a[1]], [tx + b[0], ty + 0.004, tz + b[1]], 0.01, '#dcd6c9', 0.03);
  for (let i = 0; i < 9; i++) { const z = tz + 0.18 + i * 0.016; box(gp, '#c4beb0', tx, Y0 + h(tx, z + 0.008) - 0.004, z, 0.06, ty - (Y0 + h(tx, z + 0.008)) - i * 0.0005 + 0.004 - i * 0.002, 0.016); }
  // Storeys: square core, a wing on every side (cross plan), each with its own upturned golden eaves
  const GOLD = '#c79a3c', GOLD2 = '#d6ad52', RED = '#9a3328', UND = '#4a6a62', BAND = '#3d6a62';
  let y = ty + 0.004;
  for (let i = 0; i < 5; i++) {
    const s = 0.085 - i * 0.009, sh = i === 0 ? 0.075 : 0.06, ww = s * 1.15, wd = s * 0.42;
    box(gp, RED, tx, y, tz, s * 2, sh, s * 2);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, ox = Math.sin(a) * (s + wd / 2), oz = Math.cos(a) * (s + wd / 2);
      const wg = grp(gp, tx + ox, tz + oz, a, y);
      box(wg, RED, 0, 0, 0, ww, sh * 0.82, wd);
      for (let c = -2; c <= 2; c++) cyl(wg, '#7a2a20', (c / 2) * ww * 0.48, 0, wd / 2 + 0.002, 0.0035, sh * 0.82, 5);
      box(wg, '#5e2a22', 0, sh * 0.22, wd / 2 + 0.001, ww * 0.8, sh * 0.42, 0.003);
      for (let c = -3; c <= 3; c++) box(wg, '#8a5a3a', (c / 3) * ww * 0.38, sh * 0.22, wd / 2 + 0.0025, 0.0012, sh * 0.42, 0.001);
      box(wg, BAND, 0, sh * 0.82 - 0.007, 0, ww + 0.004, 0.007, wd + 0.004);
      const R0 = ((wd / 2 + 0.02) * 1) / Math.SQRT1_2;
      proof(wg, 0, sh * 0.82, 0.006, { n: 4, R0, R1: R0 * 0.35, h: 0.022, lift: 0.42, tile: GOLD, rib: GOLD2, under: UND, sx: (ww / 2 + 0.02) / (wd / 2 + 0.02) });
    }
    y += sh;
    box(gp, BAND, tx, y - 0.008, tz, s * 2 + 0.006, 0.008, s * 2 + 0.006);
    const R0 = (s + 0.03) / Math.SQRT1_2;
    proof(gp, tx, y, tz, { n: 4, R0, R1: R0 * 0.72, h: 0.02, lift: 0.42, tile: GOLD, rib: GOLD2, under: UND });
    y += 0.012;
    if (i < 4) rail(gp, [tx - s * 0.9, y, tz + s * 0.9], [tx + s * 0.9, y, tz + s * 0.9], 0.008, '#8a3026', 0.02);
  }
  // Crowning double-eave pyramid roof and the gourd finial
  box(gp, RED, tx, y - 0.01, tz, 0.08, 0.035, 0.08);
  let r = proof(gp, tx, y + 0.022, tz, { n: 4, R0: 0.075, R1: 0.035, h: 0.022, lift: 0.42, tile: GOLD, rib: GOLD2, under: UND });
  r = proof(gp, tx, r + 0.006, tz, { n: 4, R0: 0.058, R1: 0.004, h: 0.06, lift: 0.4, tile: GOLD, rib: GOLD2, under: UND });
  box(gp, BAND, tx, r - 0.06, tz, 0.05, 0.008, 0.05);
  gourd(gp, tx, r - 0.006, tz, 0.02, '#b08a3e');
  // Bronze "returning crane" (黄鹤归来) statue: cranes standing on a tortoise and snake, dark patinated bronze
  const cx = 0.17, cz = 0.22, cy = Y0 + h(cx, cz);
  cyl(gp, '#8f897c', cx, cy, cz, 0.022, 0.012, 8);
  ellip(gp, '#4f4a3c', cx, cy + 0.014, cz, 0.014, 0.005, 0.017);
  const cr = grp(gp, cx, cz, -0.5, cy + 0.012);
  for (const sd of [-1, 1]) rod(cr, [sd * 0.004, 0.004, 0], [sd * 0.004, 0.03, 0], 0.0012, '#4f4a3c', 4);
  ellip(cr, '#5a5442', 0, 0.037, 0, 0.008, 0.008, 0.014, 0, -0.2);
  tube(cr, [[0, 0.04, 0.01], [0, 0.056, 0.014], [0, 0.068, 0.012]], 0.0022, 0.0018, '#5a5442');
  ellip(cr, '#5a5442', 0, 0.069, 0.013, 0.0026, 0.0024, 0.0034);
  cone(cr, '#4f4a3c', 0, 0.068, 0.02, 0.0009, 0.01, 4, 0).rotation.x = Math.PI / 2;
  for (const sd of [-1, 1]) add(cr, ICO(), mat('#57513f'), sd * 0.012, 0.044, -0.004, 0.004, 0.012, 0.016, 0, -0.5, sd * 0.6);
  // Trees: camphor and other evergreen broadleaves around the hill
  for (let i = 0; i < 30; i++) {
    const a = hash3(i, 1, 6) * Math.PI * 2, d = 0.24 + hash3(i, 2, 6) * 0.18, x = Math.cos(a) * d, z = Math.sin(a) * d - 0.04;
    if (Math.hypot(x, z) > 0.44 || (Math.abs(x) < 0.06 && z > 0)) continue;
    const s = 0.04 + hash3(i, 3, 6) * 0.025, c = i % 4 === 0 ? '#4e6c3c' : i % 3 === 0 ? '#5d7a46' : '#3c5c34';
    bush(gp, x, Y0 + h(x, z), z, s, c);
  }
  for (const [dx, c] of [[-0.03, DRESS[0]], [0.03, DRESS[1]], [0.08, DRESS[2]]] as const) person(gp, tx + dx, ty, tz + 0.15, c, 1.0);
};

// ---------------------------------------------------------------------------------------------------------
// Mogao Caves, Dunhuang — the Nine-Storey Pavilion against a cliff honeycombed with cave doorways
const cn_mogao: Builder = gp => {
  // Ref: Mogao Caves, Dunhuang (UNESCO 440; Dunhuang Academy): Cave 96 'Nine-Storey' facade ~45 m, eaves 1-6 single-face, 7 three-face, 8 four-face, octagonal 攒尖 top.
  // Photo: Commons "Dunhuang Mogao Ku 2013.12.31 12-30-18.jpg" — red columns with cream infill under grey eaves, grey-tan conglomerate cliff.
  const h: HFn = rimFade((x, z) => 0.008 * fbm(x * 9, 1, z * 9, 2));
  island(gp, 0.5, h, '#c9b28a', (x, _y, z) => {
    if (Math.abs(x) < 0.035 && z > -0.02) return '#b9a684';
    return fbm(x * 12, 2, z * 12, 2) > 0.62 ? '#bfa780' : null;
  }, { rings: 20, segs: 72 });
  // Cliff: a tall strata wall filling the back of the diorama
  const CH = 0.36, zf = (x: number, y: number) => -0.11 + 0.012 * Math.sin(x * 23 + y * 9) + 0.01 * fbm(x * 6, y * 6, 3, 2);
  const NF = 34, NB = 14, rings: V3[][] = [];
  for (let i = 0; i <= 8; i++) {
    const y = Y0 - 0.01 + (i / 8) * CH, ring: V3[] = [];
    for (let j = 0; j <= NF; j++) { const x = -0.445 + (j / NF) * 0.89; ring.push([x, y, zf(x, y) + (i === 8 ? -0.02 : 0)]); }
    const a0 = Math.atan2(zf(0.445, y), 0.445), a1 = Math.atan2(zf(-0.445, y), -0.445);
    for (let j = 1; j < NB; j++) { const a = a0 + ((a1 - a0) * j) / NB; ring.push([Math.cos(a) * 0.458, y, Math.sin(a) * 0.458]); }
    rings.push(ring.reverse());
  }
  // Conglomerate cliff of the Daquan valley: grey-ochre gravel beds, gravel Gobi plateau on top
  skin(gp, rings, '#b29d7e', {
    caps: true, flat: true,
    paint: (_x, y, _z, _nx, ny) => {
      if (ny > 0.6) return hash3(Math.floor(_x * 60), 1, Math.floor(_z * 60)) > 0.5 ? '#a8957a' : '#b49f80';
      const b = Math.floor(y * 60 + fbm(_x * 5, y * 5, 1, 2) * 3) % 4;
      return ['#b29d7e', '#a38f72', '#bba689', '#aa9578'][b];
    },
  });
  // Cave tiers: the 1960s concrete-faced galleries with railings, rows of dark cave doorways and linking stairs
  const GAL = '#b3a690';
  for (let row = 0; row < 4; row++) {
    const yy = Y0 + 0.05 + row * 0.072;
    for (let j = 0; j < 22; j++) {
      const x = -0.45 + j * 0.043 + (row % 2) * 0.02 + (hash3(row, j, 2) - 0.5) * 0.012;
      if (Math.abs(x) < 0.14 || Math.abs(x) > 0.44 || hash3(row, j, 5) > 0.82) continue;
      const z = zf(x, yy + 0.015), dh = 0.018 + hash3(row, j, 3) * 0.012;
      box(gp, '#2e241c', x, yy, z + 0.001, 0.011 + hash3(row, j, 4) * 0.008, dh, 0.01);
    }
    for (const sd of [-1, 1]) {
      const x0 = sd * 0.14, x1 = sd * 0.44, zg = zf(0.3, yy) + 0.012;
      box(gp, GAL, (x0 + x1) / 2, yy - 0.005, zg, 0.3, 0.005, 0.018);
      rail(gp, [x0, yy, zg + 0.009], [x1 * 0.97, yy, zg + 0.009], 0.007, '#9c8f7a', 0.012);
      if (row < 3) for (let k = 0; k < 6; k++) box(gp, GAL, sd * (0.4 - k * 0.006), yy + k * 0.012, zg + 0.002, 0.012, 0.004, 0.014);
    }
  }
  // Nine-Storey Pavilion (Cave 96, rebuilt 1935): red timber front against the cliff. Eaves on levels 1–6 are
  // single lean-to roofs, level 7 has three faces, level 8 four, and the top is an octagonal pyramid with a bao-ping finial
  const TILE = '#5b605c', RIB = '#6b716c', UNDER = '#4a3a2e', REDW = '#8f3326', BEAM = '#c9b896';
  const leanTo = (y: number, zb: number, w: number, D: number, drop: number) => {
    const N = 10, T = [0, 0.25, 0.5, 0.75, 1], th = 0.003, rings: V3[][] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, ring: V3[] = [];
      for (const t of T) {
        const c = Math.max(0, 1 - Math.min(u, 1 - u) / 0.22) ** 2 * t * t;
        ring.push([-w / 2 + u * w + (u < 0.5 ? -1 : 1) * c * 0.006, y - drop * (1 - (1 - t) ** 2) + c * drop * 0.7, zb + t * D + c * 0.004]);
      }
      for (const t of [...T].reverse()) {
        const c = Math.max(0, 1 - Math.min(u, 1 - u) / 0.22) ** 2 * t * t;
        ring.push([-w / 2 + u * w + (u < 0.5 ? -1 : 1) * c * 0.006, y - th - drop * (1 - (1 - t) ** 2) + c * drop * 0.7, zb + t * D + c * 0.004]);
      }
      rings.push(ring);
    }
    skin(gp, rings, TILE, { caps: true, flat: true, paint: (px, _py, _pz, _nx, ny) => (ny < -0.2 ? UNDER : Math.floor((px + 1) * 260) % 2 ? RIB : TILE) });
  };
  const front = (y: number, w: number, hgt: number, zb: number, D: number) => {
    box(gp, REDW, 0, y, zb + D / 2, w, hgt, D);
    const n = Math.max(3, Math.round(w / 0.02));
    for (let i = 0; i <= n; i++) box(gp, '#6a241b', -w / 2 + (i / n) * w, y, zb + D + 0.0008, 0.0035, hgt, 0.002);
    box(gp, BEAM, 0, y + hgt - 0.006, zb + D + 0.001, w, 0.006, 0.003);
    for (let i = 0; i < n; i++) box(gp, '#cdbb98', -w / 2 + ((i + 0.5) / n) * w, y + hgt * 0.12, zb + D + 0.0006, w / n - 0.007, hgt * 0.66, 0.002);
  };
  let y = Y0 + 0.004;
  box(gp, '#c4b08c', 0, y - 0.004, -0.04, 0.3, 0.012, 0.16);
  y += 0.008;
  for (let i = 0; i < 9; i++) {
    const w = 0.24 - i * 0.012, hgt = i === 0 ? 0.07 : i < 6 ? 0.038 : 0.034, D = 0.05 - Math.min(i, 6) * 0.003;
    const zb = zf(0, y + hgt) - 0.03, zfr = zb + D;
    if (i < 8) front(y, w, hgt, zb, D);
    if (i === 0) for (const dx of [-0.03, 0.03]) box(gp, '#3a2a20', dx, y, zfr + 0.002, 0.018, 0.034, 0.003);
    y += hgt;
    if (i < 6) {
      leanTo(y + 0.007, zfr - 0.004, w + 0.02, 0.022, 0.01);
      y += 0.008;
    } else if (i === 6) {
      // three-face eave: a hip roof whose back half disappears into the cliff
      y = proof(gp, 0, y, zfr - 0.012, { n: 4, R0: 0.046 / Math.SQRT1_2, R1: 0.02, h: 0.018, lift: 0.4, tile: TILE, rib: RIB, under: UNDER, sx: (w / 2 + 0.02) / 0.046 }) - 0.012;
    } else if (i === 7) {
      // four-face eave on the free-standing top storey
      y = proof(gp, 0, y, zfr - D / 2, { n: 4, R0: 0.05 / Math.SQRT1_2, R1: 0.02, h: 0.02, lift: 0.4, tile: TILE, rib: RIB, under: UNDER, sx: (w / 2 + 0.018) / 0.05 }) - 0.014;
    } else {
      const zc = zfr - D / 2;
      storey(gp, 0, y - hgt, zc, 8, 0.038, hgt, '#7a2a20', REDW);
      const r = proof(gp, 0, y, zc, { n: 8, R0: 0.06, R1: 0.004, h: 0.05, lift: 0.35, tile: TILE, rib: RIB, under: UNDER });
      gourd(gp, 0, r - 0.004, zc, 0.012, '#9a8a5a');
    }
  }
  // Forecourt along the Daquan river: slender poplars, a rammed-earth stupa and visitors
  for (let i = 0; i < 12; i++) {
    const sd = i % 2 ? 1 : -1, x = sd * (0.2 + hash3(i, 1, 1) * 0.2), z = 0.02 + Math.floor(i / 2) * 0.07;
    if (Math.hypot(x, z) > 0.46) continue;
    tree(gp, x, Y0, z, 0.032 + hash3(i, 3, 1) * 0.014, i % 4 ? '#6f7a48' : '#8a8650');
  }
  {
    const sx0 = -0.1, sz0 = 0.22, E = '#c2ab84';
    box(gp, E, sx0, Y0, sz0, 0.04, 0.012, 0.04);
    box(gp, shade(E, 0.95), sx0, Y0 + 0.012, sz0, 0.032, 0.008, 0.032);
    lathe(gp, [[0, 0], [0.013, 0], [0.016, 0.01], [0.015, 0.022], [0.009, 0.03], [0, 0.03]], E, sx0, Y0 + 0.02, sz0, 10);
    lathe(gp, [[0, 0], [0.005, 0], [0.003, 0.03], [0, 0.034]], shade(E, 0.92), sx0, Y0 + 0.05, sz0, 8);
  }
  for (const [dx, dz, c] of [[-0.03, 0.12, DRESS[0]], [0.02, 0.16, DRESS[1]], [0.05, 0.08, DRESS[2]], [-0.06, 0.26, DRESS[3]]] as const) person(gp, dx, Y0, dz, c, 1.0);
};

// ---------------------------------------------------------------------------------------------------------
// The Bund & Lujiazui, Shanghai — Oriental Pearl Tower, Jin Mao, the "bottle opener" and the twisting Shanghai Tower
const cn_bund: Builder = gp => {
  // Ref: Lujiazui skyline (Wikipedia: Oriental Pearl Tower 468 m, spheres Ø50/45 m; SWFC 492 m trapezoid aperture; Jin Mao 421 m; Shanghai Tower 632 m) and the Bund's granite neoclassical row (Customs House clock tower, HSBC dome, Sassoon House green pyramid). Scale ≈ 0.00158/m.
  const WC = '#6c7d74', WL = Y0 - 0.01;
  calm(gp, 0.49, WL - 0.004, WC, -0.12);
  const zc = (x: number) => 0.06 + 0.12 * x, RW = 0.085;
  const h: HFn = rimFade((x, z) => { const d = Math.abs(z - zc(x)); return d < RW ? -0.03 : 0.0; });
  island(gp, 0.5, h, '#6a8a56', (x, y, z) => {
    if (y < WL + 0.004) return '#76847c';
    const d = z - zc(x);
    if (d > 0) return d < RW + 0.05 ? '#c9c2b2' : d < RW + 0.08 ? '#4b5058' : '#a7a49c';
    if (d > -RW - 0.025) return '#b8b4a8';
    return fbm(x * 14, 1, z * 14, 2) > 0.58 ? '#759a5e' : null;
  }, { rings: 30, segs: 100 });
  // --- Pudong skyline
  const PK = '#9a4c60', CR = '#d9d6cf';
  {
    // Oriental Pearl Tower: three Ø9 m columns and three raking legs, Ø50 m lower and Ø45 m upper spheres,
    // five small spheres between them, the Ø16 m space module at 350 m and the antenna mast
    const x = -0.17, z = -0.2, y0 = Y0;
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; cyl(gp, CR, x + Math.cos(a) * 0.014, y0, z + Math.sin(a) * 0.014, 0.007, 0.43, 8); }
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3 + Math.PI / 3; rod(gp, [x + Math.cos(a) * 0.065, y0, z + Math.sin(a) * 0.065], [x + Math.cos(a) * 0.022, y0 + 0.11, z + Math.sin(a) * 0.022], 0.0055, CR, 6); }
    ellip(gp, PK, x, y0 + 0.147, z, 0.04, 0.04, 0.04);
    cyl(gp, '#a9aeb2', x, y0 + 0.143, z, 0.0415, 0.007, 20);
    for (let k = 0; k < 5; k++) ellip(gp, PK, x, y0 + 0.215 + k * 0.03, z, 0.0095, 0.0095, 0.0095);
    ellip(gp, PK, x, y0 + 0.415, z, 0.036, 0.036, 0.036);
    cyl(gp, '#a9aeb2', x, y0 + 0.412, z, 0.0375, 0.006, 20);
    cyl(gp, CR, x, y0 + 0.43, z, 0.009, 0.12, 8);
    ellip(gp, PK, x, y0 + 0.553, z, 0.013, 0.013, 0.013);
    strut(gp, [x, y0 + 0.56, z], [x, y0 + 0.74, z], 0.006, 0.0015, '#c9ccd0', 6);
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
  // Shanghai World Financial Center: a square prism sheared by two arcs into a slab, with the trapezoid aperture through the top
  {
    const x = 0.15, z = -0.33, H = 0.78, Ht = 0.1, d1 = 0.012, dT = 0.08 + (d1 - 0.08) * ((H - Ht) / H);
    tbox(gp, 0.09, 0.08, 0.09, dT, H - Ht, '#8fa6b4', x, Y0, z, 0, 0, 0.35);
    const top = g('cn:swfcTop', () => {
      const W = 0.045, sh = new THREE.Shape([new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(W, Ht), new THREE.Vector2(-W, Ht)]);
      sh.holes.push(new THREE.Path([new THREE.Vector2(-0.026, 0.028), new THREE.Vector2(0.026, 0.028), new THREE.Vector2(0.034, 0.084), new THREE.Vector2(-0.034, 0.084)]));
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
      eg.translate(0, 0, -0.5);
      return eg;
    });
    const gr = grp(gp, x, z, 0.35, Y0 + H - Ht);
    add(gr, top, mat('#8fa6b4', { rough: 0.35 }), 0, 0, 0, 1, 1, (dT + d1) / 2);
    box(gr, '#c9d2d8', 0, Ht, 0, 0.09, 0.003, d1);
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
    skin(gp, rings, '#94adb4', {
      caps: true, flat: true, metal: 0.3, rough: 0.35,
      paint: (_px, py) => (Math.floor(((py - Y0) / H) * 9 * 4) % 4 === 0 ? '#738c94' : null),
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
    // Rusticated granite base, a grid of tall windows, cornice
    box(gr, shade(c, 0.88), 0, 0, 0.0005, w + 0.002, 0.016, 0.081);
    const nf = Math.max(3, Math.round((hh - 0.02) / 0.016)), nc = Math.max(3, Math.round(w / 0.011));
    for (let f = 0; f < nf; f++) for (let k = 0; k < nc; k++) box(gr, '#4a4a46', -w / 2 + ((k + 0.5) / nc) * w, 0.02 + f * 0.016, 0.0402, w / nc * 0.45, 0.009, 0.002);
    box(gr, shade(c, 0.82), 0, hh, 0, w + 0.004, 0.004, 0.084);
    if (kind === 'clock') {
      // Customs House (1927): square clock tower in stages
      box(gr, c, 0, hh, 0.005, 0.032, 0.05, 0.032);
      box(gr, shade(c, 0.9), 0, hh + 0.05, 0.005, 0.026, 0.018, 0.026);
      cyl(gr, '#e9e4d6', 0, hh + 0.035, 0.0215, 0.009, 0.0015, 14).rotation.x = Math.PI / 2;
      box(gr, shade(c, 0.85), 0, hh + 0.068, 0.005, 0.016, 0.01, 0.016);
      cone(gr, '#6e6a62', 0, hh + 0.078, 0.005, 0.009, 0.012, 4, Math.PI / 4);
    } else if (kind === 'dome') {
      // HSBC Building (1923): drum and shallow dome
      cyl(gr, c, 0, hh, 0, 0.022, 0.016, 14);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; cyl(gr, shade(c, 1.05), Math.cos(a) * 0.022, hh, Math.sin(a) * 0.022, 0.0016, 0.016, 5); }
      lathe(gr, [[0.024, 0], [0.022, 0.012], [0.014, 0.022], [0, 0.026]], '#6f7a72', 0, hh + 0.016, 0, 14);
    } else if (kind === 'peace') {
      // Sassoon House / Peace Hotel (1929): copper-green pyramid roof
      box(gr, c, 0, hh, 0, 0.03, 0.02, 0.03);
      cone(gr, '#56786a', 0, hh + 0.02, 0, 0.024, 0.036, 4, Math.PI / 4);
    }
  }
  // Promenade lamps, strollers and boats on the Huangpu
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09, z = zc(x) + RW + 0.012;
    if (Math.hypot(x, z) > 0.47) continue;
    rod(gp, [x, Y0, z], [x, Y0 + 0.04, z], 0.0016, '#3b3f46', 4);
    blob(gp, '#e8dcb8', x, Y0 + 0.042, z, 0.0035);
    if (i % 2) person(gp, x + 0.02, Y0, z + 0.015, DRESS[i % 8], 0.8);
  }
  const boat = (x: number, s: number, c: string, deck: string) => {
    const z = zc(x), gr = grp(gp, x, z, ry, WL);
    sweep(gr, [-1, -0.6, 0, 0.6, 1].map((u, i) => ({ p: [u * 0.07 * s, 0.008, 0] as V3, w: (i === 0 || i === 4 ? 0.006 : 0.018) * s, h: 0.009 * s })), c, { radial: 8, sub: 3, flat: true, squash: 0.5, up: [0, 0, 1] });
    box(gr, deck, -0.005 * s, 0.014 * s, 0, 0.08 * s, 0.014 * s, 0.026 * s);
    box(gr, shade(deck, 0.9), -0.008 * s, 0.028 * s, 0, 0.05 * s, 0.012 * s, 0.022 * s);
    for (let k = -2; k <= 2; k++) box(gr, '#3a4048', k * 0.012 * s, 0.018 * s, 0.0131 * s, 0.008 * s, 0.005 * s, 0.001);
  };
  boat(-0.05, 1.1, '#dedbd3', '#d4d0c6');
  boat(0.24, 0.8, '#3e4448', '#c9c5bb');
};

// ---------------------------------------------------------------------------------------------------------
// Zhangye Danxia — rainbow-striped sandstone hills with a boardwalk up to a viewing platform
const cn_danxia: Builder = gp => {
  const BANDS = ['#b8604a', '#c98a5c', '#dcc08e', '#c06a58', '#dcd0b0', '#a8503f', '#d09a6c', '#a3a688', '#d8a896', '#c07a4a'];
  const plat: [number, number] = [0.16, 0.12];
  const h: HFn = rimFade((x, z) => {
    const r = Math.hypot(x, z), back = sstep(0.42, -0.05, z);
    const rid = ridged(x * 3.3 + 1.3, z * 3.3 + 0.7, 2);
    const knob = 0.15 * Math.exp(-((x - plat[0]) ** 2 + (z - plat[1]) ** 2) / 0.008);
    return Math.max((0.03 + 0.36 * rid ** 1.8) * (0.2 + 0.8 * back), knob) * sstep(0.52, 0.4, r) + 0.004 * fbm(x * 20, 1, z * 20, 2);
  });
  island(gp, 0.5, h, '#c06a58', (x, y, z, _nx, ny) => {
    if (y < Y0 + 0.012 && z > 0.1) return ny > 0.9 && fbm(x * 10, 2, z * 10, 2) > 0.55 ? '#b9a27a' : '#c9a27a';
    const tilt = y + 0.05 * x - 0.03 * z + 0.004 * fbm(x * 6, y * 6, z * 6, 2);
    const c = BANDS[((Math.floor(tilt * 26) % BANDS.length) + BANDS.length) % BANDS.length];
    return ny > 0.92 ? shade(c, 1.06) : c;
  }, { rings: 44, segs: 120 });
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
  for (const [dx, dz, c] of [[-0.02, 0.02, DRESS[4]], [0.02, 0.0, DRESS[0]], [0.0, -0.025, DRESS[6]]] as const) person(gp, plat[0] + dx, py + 0.008, plat[1] + dz, c, 1.2);
  for (const [t, c] of [[0.3, DRESS[3]], [0.6, DRESS[7]]] as const) { const x = A[0] + (Bx - A[0]) * t, z = A[1] + (Bz - A[1]) * t; person(gp, x, Y0 + h(x, z) + 0.018, z, c, 1.2); }
  // Gravel road and a little sightseeing bus
  const bs = grp(gp, -0.3, 0.3, 0.6, Y0 + 0.002);
  box(bs, '#5a6e5c', 0, 0.004, 0, 0.08, 0.03, 0.034);
  box(bs, '#8fa4ac', 0, 0.018, 0, 0.082, 0.01, 0.03);
  for (const [lx, lz] of [[-0.026, -0.017], [0.026, -0.017], [-0.026, 0.017], [0.026, 0.017]]) cyl(bs, '#2a2826', lx, 0, lz, 0.007, 0.006, 8).rotation.x = Math.PI / 2;
};

// ---------------------------------------------------------------------------------------------------------
// Jiuzhaigou — turquoise travertine lakes with sunken logs, a wide forested waterfall and autumn colour
const cn_jiuzhaigou: Builder = gp => {
  const LL = Y0 + 0.004, LU = Y0 + 0.1;
  const e1 = (x: number, z: number) => Math.hypot((x - 0.02) / 0.36, (z - 0.17) / 0.2);
  const e2 = (x: number, z: number) => Math.hypot((x + 0.03) / 0.3, (z + 0.16) / 0.085);
  const mtn = (x: number, z: number) => sstep(-0.22, -0.46, z) * (0.14 + 0.18 * ridged(x * 3.5 + 2, z * 3.5, 3)) + 0.2 * Math.exp(-((x + 0.12) ** 2 + (z + 0.42) ** 2) / 0.012);
  const h: HFn = rimFade((x, z) => {
    const step = 0.1 * sstep(0.0, -0.045, z);
    let v = 0.016 + step + 0.01 * fbm(x * 9, 2, z * 9, 2) - 0.05 * sstep(1, 0.7, e1(x, z)) - 0.045 * sstep(1, 0.65, e2(x, z)) * sstep(0.0, -0.05, z);
    v = Math.max(v, mtn(x, z) + step);
    return v;
  });
  island(gp, 0.5, h, '#3f6e3a', (x, y, z, _nx, ny) => {
    if (e1(x, z) < 1.02 && y < LL + 0.002) { const f = fbm(x * 11, 1, z * 11, 2); return f > 0.62 ? '#b0a868' : f > 0.48 ? '#4f9a92' : '#3d8580'; }
    if (e2(x, z) < 1.02 && y < LU + 0.002 && z < -0.02) return fbm(x * 11, 3, z * 11, 2) > 0.55 ? '#8fa060' : '#3f8e8a';
    if (y > 0.36) return ny > 0.5 ? '#e4e4de' : '#c2c6c4';
    if (ny < 0.55) return '#7a7468';
    const f = fbm(x * 14, y * 9, z * 14, 2);
    return f > 0.6 ? '#4f8244' : f < 0.4 ? '#2b5129' : null;
  }, { rings: 34, segs: 100 });
  pool(gp, oval(0.02, 0.17, 0.355, 0.198, 36), LL, '#4aa3a6', 0.62);
  pool(gp, oval(-0.03, -0.16, 0.296, 0.083, 30), LU, '#4a9eb0', 0.62);
  // Sunken logs on the lake beds
  for (let i = 0; i < 9; i++) {
    const x = -0.24 + hash3(i, 1, 2) * 0.48, z = 0.08 + hash3(i, 2, 2) * 0.18, a = hash3(i, 3, 2) * Math.PI;
    if (e1(x, z) > 0.8) continue;
    const yb = Y0 + h(x, z) + 0.004;
    rod(gp, [x - Math.cos(a) * 0.04, yb, z - Math.sin(a) * 0.04], [x + Math.cos(a) * 0.04, yb + 0.004, z + Math.sin(a) * 0.04], 0.003, '#9a7a52', 5);
  }
  // Nuorilang-style waterfall: white curtains tumbling over the travertine step, with trees growing in it
  box(gp, '#d2dcdc', -0.005, LL - 0.004, -0.014, 0.6, LU - LL + 0.012, 0.006, 0, -0.5);
  for (let i = 0; i < 30; i++) {
    const x = -0.31 + i * 0.021 + (hash3(i, 1, 7) - 0.5) * 0.006;
    if (Math.hypot(x, 0) > 0.44) continue;
    const ht = LU - LL + 0.006 - hash3(i, 4, 7) * 0.01;
    box(gp, i % 3 ? '#e2e6e4' : i % 2 ? '#d2dcdc' : '#c2d2d2', x, LL - 0.004, -0.012 + hash3(i, 2, 7) * 0.006, 0.026 + hash3(i, 3, 7) * 0.01, ht + 0.008, 0.01, 0, -0.5);
    blob(gp, '#dfe3e1', x, LL + 0.004, 0.004, 0.018, 0.008, 0.014, i, true);
    if (i % 5 === 2) { cyl(gp, '#5b4030', x, LU - 0.01, -0.03, 0.003, 0.03, 5); blob(gp, i % 2 ? '#b8843a' : '#4f7244', x, LU + 0.03, -0.03, 0.018, 0.022, 0.018, i); }
  }
  // Autumn forest around the lakes, conifers on the slopes
  const AC = ['#b8743a', '#c49a48', '#9a4a34', '#5f7a3a', '#3a5a3a', '#b8a048'];
  for (let i = 0; i < 70; i++) {
    const a = hash3(i, 1, 3) * Math.PI * 2, d = Math.sqrt(hash3(i, 2, 3)) * 0.47, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (e1(x, z) < 1.08 || (e2(x, z) < 1.1 && z < 0) || Math.abs(z + 0.02) < 0.03) continue;
    const y = Y0 + h(x, z);
    if (y > 0.33) continue;
    const s = 0.026 + hash3(i, 3, 3) * 0.02;
    if (z < -0.24 || hash3(i, 4, 3) > 0.6) minipine(gp, x, y, z, s * 1.5, i % 2 ? '#2f5a32' : '#3b6a3a');
    else tree(gp, x, y, z, s, AC[i % AC.length]);
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
  for (const [x, z, c] of [[-0.25, 0.285, DRESS[4]], [-0.05, 0.285, DRESS[0]], [0.16, 0.29, DRESS[6]], [0.2, 0.275, DRESS[3]]] as const) person(gp, x, LL + 0.013, z, c, 1.2);
};

// ---------------------------------------------------------------------------------------------------------
// Hanging Temple, Mount Heng — wooden halls pinned halfway up a sheer cliff on slender stilts
const cn_hangingtemple: Builder = gp => {
  // Ref: Xuankong Si, Mt Heng, Shanxi (Wikipedia/Baike 悬空寺): grey-tiled timber halls in a cliff recess under an overhang, ~60 m up,
  // carried on 27 beams sunk into the rock plus slender posts; north and south three-storey towers joined by plank walkways.
  // Photos (Commons "Xuankongsi.jpg", "Hunyuan Xuankong Si 2013.08.30"): ochre-yellow and green glazed eaves, red-brown
  // timber, a red-washed brick podium wall at the south foot, grey-tan horizontally bedded cliff under a deep overhang.
  const WC = '#6a8a80', WL = Y0 - 0.004;
  calm(gp, 0.49, WL - 0.004, WC, 0.2);
  const h: HFn = rimFade((x, z) => 0.012 + 0.01 * fbm(x * 9, 1, z * 9, 2) - 0.04 * sstep(0.05, 0.02, Math.abs(z - 0.32 - 0.05 * Math.sin(x * 6))));
  island(gp, 0.5, h, '#6c7350', (x, y, z) => {
    if (y < WL + 0.004) return '#a59a80';
    if (z < -0.02) return '#8f8576';
    const n = fbm(x * 13, 1, z * 13, 2);
    return n > 0.62 ? '#626f4a' : n < 0.36 ? '#7a7660' : null;
  }, { rings: 24, segs: 84 });
  // Sheer cliff face across the back
  const CH = 0.66, zf = (x: number, y: number) => -0.07 + 0.018 * Math.sin(x * 14 + y * 5) + 0.02 * fbm(x * 7, y * 4, 2, 2) - 0.03 * sstep(0.2, 0.4, y) * sstep(-0.1, -0.35, x) + 0.05 * sstep(0.44, 0.5, y) * sstep(0.42, 0.3, Math.abs(x + 0.02));
  const NF = 30, NB = 12, rings: V3[][] = [];
  for (let i = 0; i <= 10; i++) {
    const y = Y0 - 0.01 + (i / 10) * CH, ring: V3[] = [];
    for (let j = 0; j <= NF; j++) { const x = -0.445 + (j / NF) * 0.89; ring.push([x, y + (i === 10 ? 0.04 * fbm(x * 6, 1, 1, 2) : 0), zf(x, y)]); }
    const a0 = Math.atan2(zf(0.445, y), 0.445), a1 = Math.atan2(zf(-0.445, y), -0.445);
    for (let j = 1; j < NB; j++) { const a = a0 + ((a1 - a0) * j) / NB; ring.push([Math.cos(a) * 0.458, y, Math.sin(a) * 0.458]); }
    rings.push(ring.reverse());
  }
  skin(gp, rings, '#9b8f80', {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      if (ny > 0.6) return '#5a6e48';
      if (ny < -0.3) return '#6e665a';
      const f = fbm(x * 9, y * 3, 1, 2);
      return f > 0.62 ? '#7d7366' : f < 0.38 ? '#b0a493' : Math.floor(x * 40) % 5 === 0 ? '#867b6d' : null;
    },
  });
  for (let i = 0; i < 9; i++) { const x = -0.4 + i * 0.1, y = Y0 + CH - 0.01; if (Math.abs(x) < 0.45) minipine(gp, x, y, zf(x, y) - 0.06, 0.04 + hash3(i, 1, 1) * 0.02); }
  // The temple: a gallery of halls on cantilevered beams and stilts
  const RW = '#7a3a2a', YEL = '#b8973e', GRN = '#4e7a5a', front = (x: number, y: number) => zf(x, y) + 0.004;
  const deck = (x0: number, x1: number, y: number, d: number) => {
    const xm = (x0 + x1) / 2, z = Math.max(front(x0, y), front(x1, y), front(xm, y)) + d / 2;
    box(gp, '#5e4630', xm, y - 0.006, z - 0.004, x1 - x0, 0.006, d + 0.008);
    // cantilever beams (横梁) socketed into the rock
    for (let x = x0 + 0.01; x < x1; x += 0.03) box(gp, '#4a3a2a', x, y - 0.011, (front(x, y) + z + d / 2) / 2, 0.004, 0.005, z + d / 2 - front(x, y));
    rail(gp, [x0, y, z + d / 2], [x1, y, z + d / 2], 0.01, '#4e2a1c', 0.016);
    for (let x = x0 + 0.015; x < x1; x += 0.05) rod(gp, [x, y - 0.006, z + d / 2 - 0.004], [x, y - 0.11, front(x, y - 0.11) + 0.004], 0.0011, '#4a3a2a', 4);
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
    gourd(gp, tx, y, tz, 0.006, '#6a665c');
    towers.push([tx, by + 0.07, tz + 0.016]);
    for (let k = 0; k < 4; k++) { const xx = tx - 0.018 + k * 0.012; rod(gp, [xx, by, tz + 0.016], [xx, by - 0.14, front(xx, by - 0.14) + 0.004], 0.0011, '#4a3a2a', 4); }
  }
  {
    const [a, b] = towers, n = 10;
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 0.03 + Math.sin(t * Math.PI) * 0.02; box(gp, '#5e4630', x, y, Math.max(front(x, y) + 0.02, a[2]), 0.05, 0.004, 0.02); }
  }
  // Red-washed brick podium wall at the south (left) foot of the cliff, as in the photos
  for (let k = 0; k < 5; k++) {
    const x = -0.42 + k * 0.035, z = front(x, Y0 + 0.05) + 0.012;
    box(gp, k % 2 ? '#94503c' : '#8a4a38', x, Y0 - 0.004, z, 0.036, 0.1 - k * 0.006, 0.024);
  }
  box(gp, '#6d6a62', -0.35, Y0 + 0.094, front(-0.35, Y0 + 0.1) + 0.012, 0.17, 0.004, 0.028);
  // Stair to the ground and visitors
  for (let i = 0; i < 12; i++) { const y = Y0 + i * 0.02, x = -0.4 + i * 0.008; box(gp, '#8a8072', x, y, front(x, y) + 0.016, 0.03, 0.004, 0.022); }
  hall(gp, -0.38, Y0 + h(-0.38, 0.03), 0.02, 0.06, 0.04, 0.04, YEL, 0.3, RW, { col: '#5a1e12', rh: 0.02 });
  for (const [x, y, z, c] of [[-0.12, y1, z1 + 0.012, DRESS[0]], [0.04, y1, z1 + 0.014, DRESS[4]], [0.19, y2, z2 + 0.012, DRESS[2]], [-0.32, Y0 + 0.012, 0.14, DRESS[3]]] as const) person(gp, x, y, z, c, 1.0);
  // Sparse valley trees in the gorge: loose clumps of willow-scrub and a few tall Lombardy-type poplars, not a planted row
  for (let i = 0; i < 16; i++) {
    const x = -0.42 + hash3(i, 1, 4) * 0.84, z = 0.1 + hash3(i, 2, 4) * 0.36, y = Y0 + h(x, z);
    if (Math.hypot(x, z) > 0.44 || (x < -0.3 && z < 0.12) || y < WL + 0.006) continue;
    const s = 0.03 + hash3(i, 3, 4) * 0.025, c = ['#4a5c3a', '#56663e', '#5e6a48'][i % 3];
    if (i % 4 === 0) {
      cyl(gp, '#6a6050', x, y, z, s * 0.08, s * 0.7, 5);
      blob(gp, c, x, y + s * 1.25, z, s * 0.26, s * 0.85, s * 0.26, x * 5);
    } else bush(gp, x, y, z, s, c);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Mount Tai — the steep stone stairway climbing a gully to the red South Gate of Heaven
const cn_taishan: Builder = gp => {
  // Ref: Tai Shan (Wikipedia/Baike 南天门): granite Eighteen Bends stairway up to the Qing-rebuilt South Gate of Heaven — red-walled stone
  // arch gate under the three-bay double-eave Mokong Pavilion (yellow glazed tile); Jade Emperor Temple and the Wordless Stele on the summit.
  const gs = (x: number, z: number, cx: number, cz: number, s: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / s);
  const h0 = (x: number, z: number) => Math.max(
    0.5 * gs(x, z * 1.1, 0.2, -0.24, 0.03), 0.4 * gs(x, z, -0.3, -0.2, 0.025), 0.32 * Math.exp(-((z + 0.12) ** 2) / 0.016) * sstep(0.5, 0.3, Math.abs(x)),
    0.14 * sstep(0.42, -0.1, z),
  ) + 0.035 * ridged(x * 5 + 1, z * 5, 3);
  const S0: [number, number] = [-0.07, 0.44], S1: [number, number] = [-0.05, -0.06], L = Math.hypot(S1[0] - S0[0], S1[1] - S0[1]);
  const y0p = h0(...S0), y1p = h0(S1[0], S1[1] - 0.06);
  const tOf = (x: number, z: number) => Math.max(0, Math.min(1, ((x - S0[0]) * (S1[0] - S0[0]) + (z - S0[1]) * (S1[1] - S0[1])) / (L * L)));
  const pd = (x: number, z: number) => { const t = tOf(x, z); return Math.hypot(x - S0[0] - (S1[0] - S0[0]) * t, z - S0[1] - (S1[1] - S0[1]) * t); };
  const ph = (t: number) => y0p + (y1p - y0p) * t ** 1.9;
  const h: HFn = rimFade((x, z) => { const w = sstep(0.06, 0.025, pd(x, z)); return h0(x, z) * (1 - w) + (ph(tOf(x, z)) - 0.004) * w; });
  island(gp, 0.5, h, '#66704a', (x, y, z, _nx, ny) => {
    if (ny < 0.45 || (ny < 0.6 && fbm(x * 9, y * 9, z * 9, 2) > 0.55)) return fbm(x * 20, y * 20, z * 20, 2) > 0.5 ? '#a39b8d' : '#8c8578';
    const f = fbm(x * 13, y * 8, z * 13, 2);
    return f > 0.64 ? '#857654' : f < 0.36 ? '#525d3c' : f > 0.55 ? '#a0998a' : null;
  }, { rings: 40, segs: 110 });
  // Stone stairway with low parapets
  const N = 64, ry = Math.atan2(-(S1[1] - S0[1]), S1[0] - S0[0]) + Math.PI / 2;
  for (let i = 0; i < N; i++) {
    const t = i / N, x = S0[0] + (S1[0] - S0[0]) * t, z = S0[1] + (S1[1] - S0[1]) * t, y = Y0 + ph(t) - 0.006, y2 = Y0 + ph((i + 1) / N) - 0.006;
    box(gp, i % 2 ? '#b9b2a4' : '#aaa395', x, y - 0.01, z, 0.03, y2 - y + 0.01, L / N + 0.002, ry);
    if (i % 2 === 0) for (const sd of [-1, 1]) box(gp, '#8f897e', x + Math.cos(ry) * sd * 0.017, y, z - Math.sin(ry) * sd * 0.017, 0.004, 0.009, L / N * 2, ry);
  }
  // South Gate of Heaven: stone-arched red gate block with flanking red walls, Mokong Pavilion above (double eaves, yellow glaze)
  const gx = S1[0], gz = S1[1] - 0.03, gy = Y0 + ph(1) - 0.008, gr = grp(gp, gx, gz, ry, gy);
  const RED = '#94382c', GLZ = '#bc9442';
  box(gr, '#8e8678', 0, -0.034, 0, 0.1, 0.006, 0.054);
  box(gr, RED, 0, -0.028, 0, 0.09, 0.07, 0.05);
  for (const sd of [-1, 1]) {
    box(gr, RED, sd * 0.085, -0.03, -0.004, 0.08, 0.034, 0.012);
    box(gr, '#5a5e5c', sd * 0.085, 0.004, -0.004, 0.084, 0.004, 0.018);
  }
  box(gr, '#a69e90', 0, -0.028, 0.0252, 0.032, 0.046, 0.0012);
  box(gr, '#1e1814', 0, -0.028, 0.026, 0.022, 0.03, 0.0012);
  add(gr, g('cn:arch2', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI)), mat('#1e1814'), 0, 0.002, 0.026, 0.011, 0.0012, 0.011, 0, Math.PI / 2);
  box(gr, '#2e3540', 0, 0.022, 0.0262, 0.022, 0.008, 0.0012);
  box(gr, '#b89a58', 0, 0.0245, 0.0270, 0.016, 0.003, 0.0004);
  box(gr, '#8e8678', 0, 0.042, 0, 0.094, 0.004, 0.054);
  for (let k = 0; k <= 14; k++) box(gr, '#8e8678', -0.045 + k * 0.0064, 0.046, 0.025, 0.002, 0.006, 0.002);
  const ht = 0.03, hw = 0.066, hd = 0.032;
  hall(gr, 0, 0.046, 0, hw, hd, ht, GLZ, 0, '#8a3026', { rh: 0.022, lift: 0.35, ov: 1.3 });
  const ov2 = 1.55, R2 = ((hd / 2) * ov2) / Math.SQRT1_2;
  proof(gr, 0, 0.046 + ht * 0.5, 0, { n: 4, R0: R2, R1: R2 * 0.62, h: 0.007, lift: 0.3, tile: GLZ, sx: (hw + hd * (ov2 - 1)) / (hd * ov2) });
  // Summit: Jade Emperor Temple compound (stone wall, grey-tiled halls) and the Wordless Stele in front
  const sx = 0.2, sz = -0.24, sy = Y0 + h(sx, sz);
  for (const [dx, dz, w, d] of [[0, -0.04, 0.12, 0.006], [0, 0.04, 0.12, 0.006], [-0.06, 0, 0.006, 0.086], [0.06, 0, 0.006, 0.086]] as const) box(gp, '#8a8072', sx + dx, sy - 0.012, sz + dz, w, 0.026, d);
  box(gp, '#8a8072', sx, sy - 0.012, sz + 0.04, 0.026, 0.03, 0.008);
  hall(gp, sx, sy + 0.004, sz - 0.012, 0.062, 0.03, 0.026, '#5a5e5c', 0, '#86382c', { rh: 0.018 });
  for (const sd of [-1, 1]) hall(gp, sx + sd * 0.04, sy + 0.002, sz + 0.012, 0.022, 0.03, 0.018, '#5a5e5c', Math.PI / 2, '#86382c', { rh: 0.012 });
  box(gp, '#a39b8a', sx - 0.02, sy - 0.004, sz + 0.07, 0.016, 0.004, 0.012);
  box(gp, '#b2aa98', sx - 0.02, sy, sz + 0.07, 0.012, 0.034, 0.008);
  box(gp, '#5a5e5c', sx - 0.02, sy + 0.034, sz + 0.07, 0.015, 0.004, 0.011);
  // Inscribed granite boulder (cliff carving in faded red), pines and pilgrims
  const bx = 0.1, bz = 0.3;
  blob(gp, '#9a9284', bx, Y0 + h(bx, bz) + 0.014, bz, 0.036, 0.03, 0.026, 0.3);
  for (let k = 0; k < 3; k++) box(gp, '#8a3a2e', bx - 0.008 + k * 0.008, Y0 + h(bx, bz) + 0.016, bz + 0.025, 0.005, 0.014, 0.0015, 0.3);
  for (let i = 0; i < 90; i++) {
    const x = -0.45 + hash3(i, 1, 5) * 0.9, z = -0.45 + hash3(i, 2, 5) * 0.9;
    if (Math.hypot(x, z) > 0.43 || pd(x, z) < 0.05 || Math.hypot(x - sx, z - sz) < 0.08 || Math.hypot(x - gx, z - gz) < 0.1) continue;
    minipine(gp, x, Y0 + h(x, z), z, 0.04 + hash3(i, 3, 5) * 0.025, i % 2 ? '#2e4630' : '#3a5236');
  }
  for (const [t, c] of [[0.12, DRESS[0]], [0.3, DRESS[1]], [0.33, DRESS[2]], [0.55, DRESS[5]], [0.72, DRESS[3]], [0.9, DRESS[6]]] as const) {
    const x = S0[0] + (S1[0] - S0[0]) * t, z = S0[1] + (S1[1] - S0[1]) * t;
    person(gp, x + 0.005, Y0 + ph(t) - 0.004, z, c, 1.0);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Yuanyang Hani rice terraces — flooded mirror terraces stepping down a mountainside, mushroom-roof village
const cn_yuanyang: Builder = gp => {
  const S = 0.026, FOREST = 0.3;
  const base = (x: number, z: number) => 0.34 * Math.exp(-((x + 0.06) ** 2 / 0.16 + (z + 0.3) ** 2 / 0.09)) + 0.12 * Math.exp(-((x - 0.3) ** 2 + (z + 0.05) ** 2) / 0.03) + 0.02 * fbm(x * 5, 1, z * 5, 2) + 0.02;
  const h: HFn = rimFade((x, z) => {
    const b = base(x, z);
    if (b > FOREST) return b;
    const q = b / S, k = Math.floor(q);
    return S * (k + sstep(0.72, 1, q - k));
  });
  island(gp, 0.5, h, '#5d7a3c', (x, y, z, _nx, ny) => {
    const b = base(x, z);
    if (b > FOREST - 0.005) return fbm(x * 14, 2, z * 14, 2) > 0.5 ? '#2f5a32' : '#3b6a3a';
    const q = b / S;
    if (q - Math.floor(q) < 0.66 && ny > 0.8) {
      const k = Math.floor(q), f = fbm(x * 7 + k, 1, z * 7, 2);
      return f > 0.62 ? '#7e9a56' : (k + Math.floor(x * 6)) % 3 === 0 ? '#b8a08e' : f < 0.4 ? '#7f98a4' : '#97aab2';
    }
    return ny > 0.7 ? '#6f8a46' : '#5a6b38';
  }, { rings: 48, segs: 128 });
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
  person(gp, fx, fy, fz, '#34405a', 1.3);
  cone(gp, '#c8b07a', fx, fy + 0.026, fz, 0.012, 0.008, 8);
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
