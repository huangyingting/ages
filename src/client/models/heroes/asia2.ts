import { human } from '../human.ts';
import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, rod, sweep, lathe, skin, gable, 
  paintFaces, shade, hash3,
} from '../prims.ts';
import { type HFn, island, sstep, ridged, strataSide, EARTH, scatter, onGround } from '../nature.ts';

// Hero builders for: potala, templeofheaven, marinabay, borobudur, shwedagon, skytree, itsukushima, sheikhzayed, halong.

// Hero builders for: potala, templeofheaven, marinabay, borobudur, shwedagon, skytree, itsukushima, sheikhzayed, halong.
// Keyed by catalogue item key (recipe.hero). Front faces +z, base at y=0, footprint radius ≈0.5.

// ---------------------------------------------------------------------------------------------------------
// Shared helpers

/** Child group placed at (x, z) and turned by ry — lets axis-aligned helpers build rotated parts. */
function grp(p: THREE.Object3D, x: number, z: number, ry = 0, y = 0): THREE.Group {
  const gr = new THREE.Group();
  gr.position.set(x, y, z);
  gr.rotation.y = ry;
  p.add(gr);
  return gr;
}

/** Paved slab of size w×d (flagstones with per-cell tonal variation) on a plinth of thickness th. */
function paved(p: THREE.Object3D, w: number, d: number, y: number, th: number, c: string, cell: number, x = 0, z = 0, paint?: Paint, seg = 0): void {
  const pg = new THREE.PlaneGeometry(w, d, seg || Math.max(1, Math.round(w / cell)), seg || Math.max(1, Math.round(d / cell)));
  pg.rotateX(-Math.PI / 2);
  const def: Paint = (px, _py, pz) => {
    const h = hash3(Math.floor(px / cell + 500.5), 3, Math.floor(pz / cell + 500.5));
    return h > 0.72 ? shade(c, 1.06) : h < 0.22 ? shade(c, 0.92) : null;
  };
  add(p, paintFaces(pg, c, paint ?? def), mat('#ffffff', { vc: true, flat: true, rough: 0.9 }), x, y + th, z, 1, 1, 1);
  if (th > 0.0005) box(p, shade(c, 0.82), x, y, z, w, th, d);
}

/** Calm water: cell-quantised tonal patches with sparse glints (reads better than fine ripples at low res). */

/** Tiny visitor for scale. */

/** Solid flight of n steps rising toward -z from (x, y0, zFront) to y1 over the run. */
function flight(p: THREE.Object3D, x: number, zFront: number, y0: number, y1: number, w: number, run: number, c: string, n = 6): void {
  const rise = (y1 - y0) / n, dz = run / n;
  for (let i = 0; i < n; i++) box(p, i % 2 ? c : shade(c, 0.95), x, y0, zFront - (i + 0.5) * dz, w, rise * (i + 1), dz);
}

let _lb: THREE.SphereGeometry | null = null;
/** Low-poly blob (shrubs, canopies, rocks). */
const lowball = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0) =>
  add(p, (_lb ??= new THREE.SphereGeometry(0.5, 6, 4)), mat(c), x, y, z, sx, sy, sz, ry);
/** Metallic box (gold leaf, stainless steel). */
const mbox = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, metal = 0.45, ry = 0) =>
  add(p, g('box', () => new THREE.BoxGeometry(1, 1, 1)), mat(c, { metal, rough: 0.38 }), x, y + sy / 2, z, sx, sy, sz, ry);
/** Gold material swap for lathes & sweeps. */
const gild = (m: THREE.Mesh, c: string, smooth = true) => { m.material = mat(c, { metal: 0.55, rough: 0.32, flat: !smooth }); return m; };

/**
 * Painted lathe: revolved [r, y] profile with per-face colours (bands, lattices, petals). Geometry is cached under
 * `key`, so many identical stupas/domes share one buffer.
 */

/** Tropical palm: slender leaning trunk with drooping fronds. */

interface RoofO {
  x?: number; z?: number; y: number; w: number; d: number; h: number;
  /** Ridge half-length (final half-width at the top). 0 = pyramidal, w/2 = plain gable. */
  ridge: number;
  /** Hip-and-gable: fraction of the rise at which the hips stop and the gable triangle starts. */
  gable?: number;
  upto?: number; lift?: number; spanF?: number; k?: number; step?: number; nr?: number; th?: number;
  tile: string; rib?: string; eave?: string; under?: string; gableC?: string; ridgeC?: string; ridgeH?: number; hipR?: number;
}
/** Curved East-Asian hip / hip-and-gable / pyramidal roof with upturned eave corners, tile ribs and hip ridges. */
function roof(p: THREE.Object3D, o: RoofO): { top: number } {
  const X = o.x ?? 0, Z = o.z ?? 0, W = o.w, D = o.d, gb = o.gable ?? 1, upto = o.upto ?? 1, k = o.k ?? 0.6;
  const step = o.step ?? 0.012, nr = o.nr ?? 6, lift = o.lift ?? 0.02, th = o.th ?? 0.007;
  const span = Math.min(W, D) * (o.spanF ?? 0.42);
  const hwAt = (t: number) => W / 2 - (W / 2 - o.ridge) * Math.min(1, t / gb);
  const hdAt = (t: number) => (D / 2) * (1 - t);
  const yAt = (t: number) => o.y + o.h * (t * (1 - k) + k * t * t);
  const nf = Math.max(2, Math.round(W / step)), ns = Math.max(2, Math.round(D / step));
  const P = (t: number, x: number, z: number, dy = 0): V3 => {
    const hw = hwAt(t), hd = hdAt(t);
    const dc = Math.hypot(hw - Math.abs(x), hd - Math.abs(z));
    const c = Math.max(0, 1 - dc / span) ** 2 * Math.max(0, 1 - t / Math.max(0.3, gb)) ** 1.4;
    const o2 = lift * 0.55 * c;
    return [X + x + Math.sign(x) * o2, yAt(t) + lift * c + dy, Z + z + Math.sign(z) * o2];
  };
  const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const ring = (t: number, dy = 0): V3[] => {
    const hw = hwAt(t), hd = hdAt(t), out: V3[] = [];
    for (let i = 0; i <= nf; i++) out.push(P(t, cl(-W / 2 + (i * W) / nf, hw), hd, dy));
    for (let i = 1; i < ns; i++) out.push(P(t, hw, cl(D / 2 - (i * D) / ns, hd), dy));
    for (let i = 0; i <= nf; i++) out.push(P(t, cl(W / 2 - (i * W) / nf, hw), -hd, dy));
    for (let i = 1; i < ns; i++) out.push(P(t, -hw, cl(-D / 2 + (i * D) / ns, hd), dy));
    return out;
  };
  const rings: V3[][] = [ring(0, -th)];
  for (let i = 0; i <= nr; i++) rings.push(ring((upto * i) / nr));
  const tile = o.tile, rib = o.rib ?? shade(tile, 1.12), ch = shade(tile, 0.86);
  const eave = o.eave ?? shade(tile, 0.7), under = o.under ?? eave, gc = o.gableC ?? eave;
  const yG = yAt(Math.min(gb, upto)), hwG = hwAt(gb);
  skin(p, rings, tile, {
    caps: true, flat: true,
    paint: (x, y, z, nx, ny, nz) => {
      if (ny < -0.35) return under;
      if (Math.abs(ny) < 0.3) return gb < 1 && y > yG - 0.002 && Math.abs(Math.abs(x - X) - hwG) < 0.006 ? gc : eave;
      const col = Math.abs(nz) >= Math.abs(nx) ? Math.floor((x - X + W / 2) / (W / nf) + 1e-3) : Math.floor((z - Z + D / 2) / (D / ns) + 1e-3);
      return col % 2 ? rib : ch;
    },
  });
  const rc = o.ridgeC ?? shade(tile, 1.08), hr = o.hipR ?? 0.0035, tEnd = Math.min(gb, upto);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const st: { p: V3; w: number }[] = [];
    for (let i = 0; i <= 4; i++) { const t = (tEnd * i) / 4; st.push({ p: P(t, sx * hwAt(t), sz * hdAt(t), hr * 0.6), w: hr }); }
    sweep(p, st, rc, { radial: 5, sub: 2, flat: true });
  }
  const top = yAt(upto);
  if (upto >= 1 && o.ridge > 0.001) {
    const rh = o.ridgeH ?? 0.008;
    box(p, rc, X, top - rh * 0.3, Z, o.ridge * 2 + 0.008, rh, hr * 2.4);
  }
  return { top };
}

// ---------------------------------------------------------------------------------------------------------
// Potala Palace — White Palace wings flanking the Red Palace on Marpo Ri, battered walls and gilded roofs

interface TBlock {
  x: number; z: number; w: number; d: number; y0: number; y1: number; c: string;
  bat?: number; rows?: number; cols?: number; colsD?: number; wb?: number; win?: string; lintel?: string; frieze?: string; fh?: number; top?: string;
}
/**
 * Tibetan battered block: walls lean inward (bat = inset per unit height), a dark penbey frieze crowns the top and
 * the faces carry a painted grid of black-framed windows with dark awnings. Ring vertices follow the window grid
 * so every window is a crisp quad.
 */
function tblock(p: THREE.Object3D, o: TBlock): void {
  const bat = o.bat ?? 0.1, fh = o.fh ?? 0.012, rows = o.rows ?? 0, cols = o.cols ?? 0, colsD = o.colsD ?? Math.max(0, Math.round(cols * o.d / o.w));
  const wb = o.wb ?? o.y0 + (o.y1 - o.y0) * 0.3, wt = o.y1 - fh - 0.006, rowH = rows ? (wt - wb) / rows : 1;
  const ys = new Set<number>([o.y0, o.y1 - fh, o.y1]);
  for (let i = 0; i < rows; i++) for (const f of [0.22, 0.68, 0.82]) ys.add(wb + (i + f) * rowH);
  const yl = [...ys].filter(y => y >= o.y0 && y <= o.y1).sort((a, b) => a - b);
  const us = (n: number) => { const out = [0]; for (let j = 0; j < n; j++) out.push((j + 0.3) / n, (j + 0.7) / n); out.push(1); return out; };
  const uf = us(cols), ud = us(colsD);
  const rings = yl.map(y => {
    const ins = bat * (y - o.y0), hw = o.w / 2 - ins, hd = o.d / 2 - ins, out: V3[] = [];
    for (let i = 0; i < uf.length - 1; i++) out.push([o.x - hw + uf[i] * 2 * hw, y, o.z + hd]);
    for (let i = 0; i < ud.length - 1; i++) out.push([o.x + hw, y, o.z + hd - ud[i] * 2 * hd]);
    for (let i = 0; i < uf.length - 1; i++) out.push([o.x + hw - uf[i] * 2 * hw, y, o.z - hd]);
    for (let i = 0; i < ud.length - 1; i++) out.push([o.x - hw, y, o.z - hd + ud[i] * 2 * hd]);
    return out;
  });
  const win = o.win ?? '#1d1714', lin = o.lintel ?? '#6b2a1e', frz = o.frieze ?? '#5a2219', top = o.top ?? '#9a8a74';
  skin(p, rings, o.c, {
    caps: true, flat: true,
    paint: (x, y, z, nx, ny, nz) => {
      if (ny > 0.8) return top;
      if (y > o.y1 - fh) return frz;
      if (!rows || y < wb) return null;
      const ins = bat * (y - o.y0), front = Math.abs(nz) > Math.abs(nx);
      const n = front ? cols : colsD;
      if (!n) return null;
      const u = front ? (x - o.x + o.w / 2 - ins) / (o.w - 2 * ins) : (z - o.z + o.d / 2 - ins) / (o.d - 2 * ins);
      const cf = (u * n) % 1, rf = ((y - wb) / rowH) % 1;
      if (cf < 0.3 || cf > 0.7 || y > wt) return null;
      return rf > 0.22 && rf < 0.68 ? win : rf >= 0.68 && rf < 0.82 ? lin : null;
    },
  });
}
/** Front-face z of a battered block at height y. */
const tfront = (o: TBlock, y: number) => o.z + o.d / 2 - (o.bat ?? 0.1) * (y - o.y0);

// Viewed from the south as in the classic Shol-side photographs: the White Palace (Potrang Karpo, 1645–48) to the
// east (+x) with its sun-terrace top storey, the Red Palace (Potrang Marpo, 1690–94) in the centre with the black
// yak-hair curtain and gilt-copper chapel roofs, the yellow building between them, lower white monastic wings to
// the west, the zig-zag stairways and the walled village of Shol below. Squashed slightly to fit the footprint.
const potala: Builder = (root, r) => {
  const gp = grp(root, 0, 0);
  gp.scale.set(0.9, 0.86, 0.9);
  const WH = '#ebe5d8', RED = '#86302a', GOLD = '#c99a3a', YEL = '#c99a45';
  // Marpo Ri: rocky hill rising behind the palace, Shol village plain in front
  const crest = (x: number) => 0.1 + 0.11 * Math.exp(-((x / 0.36) ** 2));
  const hf: HFn = (x, z) => {
    const prof = z > -0.16 ? 1 - sstep(-0.16, 0.34, z) : 1 - 0.55 * sstep(-0.16, -0.5, z);
    const rock = 0.014 * ridged(x * 9, z * 9) * sstep(0.02, 0.1, prof * crest(x));
    return Math.max(0.006, crest(x) * prof + rock);
  };
  island(gp, 0.5, hf, '#8a7a62', (x, y, z, _nx, ny) => {
    const t = y - 0.035;
    if (t < 0.012 && z > 0.25) return hash3(Math.floor(x * 50), 0, Math.floor(z * 50)) > 0.7 ? '#c9bda6' : '#d6cbb4';
    const h = hash3(Math.floor(x * 28 + 50), Math.floor(y * 40), Math.floor(z * 28 + 50));
    if (ny < 0.6) return h > 0.5 ? '#6f6556' : '#857a68';
    if (h > 0.8) return '#5f6e3f';
    return h > 0.4 ? '#a39377' : '#8f7f64';
  }, { rings: 26, segs: 80, side: strataSide(EARTH) });
  const gy = onGround(hf);
  scatter(60, 5, (x, z, i) => {
    const h = hf(x, z);
    if (h < 0.03 || z > 0.2 || (Math.abs(x) < 0.46 && z > -0.2 && z < 0.16)) return;
    lowball(gp, i % 3 ? '#4f6338' : '#3f5a34', x, gy(x, z) + 0.006, z, 0.025, 0.018, 0.025);
  }, 0.48);

  const blocks: TBlock[] = [
    // Lower bastion walls that the zig-zag stairways climb
    { x: 0, z: 0.1, w: 0.9, d: 0.1, y0: 0.03, y1: 0.2, c: WH, bat: 0.16, rows: 2, cols: 26, wb: 0.15 },
    // White Palace to the east (the Dalai Lamas' quarters, sun-terrace storey on top) and the eastern end bastion
    { x: 0.25, z: -0.01, w: 0.34, d: 0.22, y0: 0.03, y1: 0.37, c: WH, bat: 0.09, rows: 6, cols: 13, wb: 0.215 },
    { x: 0.25, z: -0.07, w: 0.16, d: 0.13, y0: 0.3, y1: 0.42, c: WH, bat: 0.06, rows: 2, cols: 6, wb: 0.37 },
    { x: 0.415, z: 0.02, w: 0.1, d: 0.16, y0: 0.03, y1: 0.285, c: WH, bat: 0.12, rows: 3, cols: 3, wb: 0.2 },
    // Lower white monastic wings (Namgyal) to the west and the western end
    { x: -0.27, z: -0.01, w: 0.3, d: 0.2, y0: 0.03, y1: 0.345, c: WH, bat: 0.09, rows: 5, cols: 11, wb: 0.215 },
    { x: -0.425, z: 0.03, w: 0.09, d: 0.14, y0: 0.03, y1: 0.285, c: WH, bat: 0.12, rows: 3, cols: 2, wb: 0.2 },
    // Red Palace on its white base, with the yellow building between it and the White Palace
    { x: 0.01, z: -0.03, w: 0.27, d: 0.24, y0: 0.03, y1: 0.33, c: WH, bat: 0.08, rows: 3, cols: 10, wb: 0.215 },
    { x: 0.01, z: -0.05, w: 0.23, d: 0.2, y0: 0.31, y1: 0.5, c: RED, bat: 0.05, rows: 6, cols: 9, wb: 0.335, frieze: '#3d1712', lintel: '#d9c9a0', top: '#7a6a58' },
    { x: 0.01, z: -0.075, w: 0.16, d: 0.13, y0: 0.48, y1: 0.535, c: RED, bat: 0.03, rows: 1, cols: 7, wb: 0.495, frieze: '#3d1712', lintel: '#d9c9a0', top: '#7a6a58' },
    { x: 0.155, z: -0.06, w: 0.06, d: 0.09, y0: 0.33, y1: 0.445, c: YEL, bat: 0.05, rows: 2, cols: 2, wb: 0.39 },
  ];
  for (const b of blocks) tblock(gp, b);
  // Black yak-hair curtain hanging down the Red Palace front, white drapes beside it
  const rp = blocks[7];
  for (const [dx, w, c] of [[0, 0.034, '#221714'], [-0.03, 0.01, '#efe6d2'], [0.03, 0.01, '#efe6d2']] as const) {
    box(gp, c, rp.x + dx, 0.36, tfront(rp, 0.43) + 0.004, w, 0.12, 0.003, 0, -Math.atan(rp.bat ?? 0.05));
  }
  // Gilded Chinese-style roofs over the stupa chapels, victory banners (gyaltsen) and the dharma wheel
  const RT = { tile: GOLD, rib: shade(GOLD, 1.15), eave: '#7a3b1e', under: '#5a2a18', ridgeC: '#e8bd52' };
  for (const [x, z, w, d, h] of [[-0.03, -0.095, 0.056, 0.048, 0.026], [0.05, -0.095, 0.05, 0.042, 0.024], [-0.025, -0.04, 0.04, 0.034, 0.02], [0.055, -0.04, 0.036, 0.03, 0.018]] as const) {
    box(gp, '#7a2a20', x, 0.53, z, w * 0.8, 0.01, d * 0.8);
    const R = roof(gp, { x, z, y: 0.54, w, d, h, ridge: w * 0.25, gable: 0.55, lift: 0.005, nr: 4, step: 0.008, ...RT, hipR: 0.002, ridgeH: 0.0035 });
    lathe(gp, [[0.0025, 0], [0.0032, 0.005], [0.0018, 0.009], [0, 0.012]], GOLD, x, R.top, z, 6);
  }
  for (const b of [blocks[1], blocks[4], blocks[7], blocks[2]]) {
    const ins = (b.bat ?? 0.1) * (b.y1 - b.y0);
    for (const sx of [-1, 1]) {
      const x = b.x + sx * (b.w / 2 - ins - 0.006), z = b.z + b.d / 2 - ins - 0.006;
      gild(cyl(gp, b.c === RED ? GOLD : '#3a2a22', x, b.y1, z, 0.0045, 0.022, 8), b.c === RED ? GOLD : '#3a2a22');
      cone(gp, GOLD, x, b.y1 + 0.022, z, 0.004, 0.008, 6);
    }
  }
  const wz = tfront(blocks[8], 0.535);
  cyl(gp, GOLD, 0.01, 0.545, wz - 0.004, 0.009, 0.003, 12).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) lowball(gp, GOLD, 0.01 + sx * 0.014, 0.541, wz - 0.004, 0.009, 0.007, 0.006);
  // Zig-zag stairways climbing the bastion face
  const bw = blocks[0];
  for (const sx of [-1, 1]) {
    const pts: [number, number][] = [[0.07, 0.1], [0.36, 0.13], [0.12, 0.16], [0.33, 0.19]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const ax = sx * x0, bx = sx * x1, L = Math.hypot(bx - ax, y1 - y0), a = Math.atan2(y1 - y0, bx - ax);
      const ym = (y0 + y1) / 2, zf = tfront(bw, ym) + 0.004;
      add(gp, g('box', () => new THREE.BoxGeometry(1, 1, 1)), mat('#f7f3ea'), (ax + bx) / 2, ym, zf, L, 0.012, 0.012, 0, -0.16, a);
      add(gp, g('box', () => new THREE.BoxGeometry(1, 1, 1)), mat('#b9ae9a'), (ax + bx) / 2, ym - 0.008, zf + 0.002, L, 0.003, 0.008, 0, -0.16, a);
    }
  }
  // Bare rock of Marpo Ri breaking through at the ends and below the bastion
  for (let i = 0; i < 14; i++) {
    const x = (i % 2 ? 1 : -1) * (0.3 + hash3(i, 5, 1) * 0.16), z = 0.12 + hash3(i, 5, 2) * 0.1;
    if (Math.abs(x) > 0.46) continue;
    lowball(gp, i % 3 ? '#7d7262' : '#6a6153', x, gy(x, z) + 0.004, z, 0.05 + hash3(i, 5, 3) * 0.04, 0.03, 0.04, i);
  }
  // Shol: the walled village at the foot, with white houses, the long front wall and gate
  for (const sx of [-1, 1]) {
    box(gp, WH, sx * 0.225, 0.035, 0.36, 0.37, 0.028, 0.012);
    box(gp, '#5a2219', sx * 0.225, 0.06, 0.36, 0.37, 0.004, 0.014);
    box(gp, WH, sx * 0.41, 0.035, 0.36, 0.024, 0.04, 0.024);
  }
  box(gp, WH, 0, 0.035, 0.36, 0.08, 0.05, 0.03);
  box(gp, '#2a211c', 0, 0.035, 0.376, 0.026, 0.03, 0.002);
  for (let i = 0; i < 16; i++) {
    const x = -0.4 + (i / 15) * 0.8 + (hash3(i, 2, 1) - 0.5) * 0.03, z = 0.24 + hash3(i, 2, 2) * 0.08;
    if (Math.abs(x) < 0.05) continue;
    const h = 0.018 + hash3(i, 2, 3) * 0.015;
    box(gp, i % 4 ? WH : '#e3c98f', x, gy(x, z), z, 0.04, h, 0.03);
    box(gp, '#5a2219', x, gy(x, z) + h - 0.003, z, 0.041, 0.003, 0.031);
    box(gp, '#1d1714', x, gy(x, z) + h * 0.5, z + 0.0155, 0.008, 0.007, 0.001);
  }
  // Five-colour prayer flags (weathered) and pilgrims in chuba robes before the Shol gate
  for (let i = 0; i < 10; i++) box(gp, ['#3f5f8f', '#e4ded0', '#9a3d32', '#4f7a52', '#c9a24a'][i % 5], -0.44 + i * 0.012, 0.15 - Math.sin(i / 3) * 0.01, 0.2, 0.01, 0.008, 0.001);
  for (let i = 0; i < 10; i++) {
    const c = ['#5a3a2a', '#3a332c', '#7a2e24', '#6b5a46'][i % 4];
    human(gp, -0.3 + hash3(i, 9, 1) * 0.6, 0.038, 0.41 + hash3(i, 9, 2) * 0.04, { h: 0.024, ry: Math.PI + (hash3(i, 9, 3) - 0.5), pose: i % 3 ? 'walk' : 'stand', phase: i, top: c, bottom: shade(c, 0.8), skin: '#a8785a', hair: '#1d1915', hatStyle: i % 4 === 1 ? 'fur' : undefined, hat: '#4a3d30', dress: 'ankle', shoes: '#2a2420', detail: 'lo' });
  }
  if (r?.style === 'tibet1951') {
    // 1951 Peaceful Liberation celebratory red archway and silk banners before the Shol gate
    for (const sx of [-0.09, 0.09]) cyl(gp, '#b91c1c', sx, 0.035, 0.43, 0.006, 0.095, 8);
    box(gp, '#b91c1c', 0, 0.118, 0.43, 0.21, 0.016, 0.014);
    box(gp, GOLD, 0, 0.132, 0.43, 0.22, 0.006, 0.016);
    for (const sx of [-0.16, 0.16]) {
      cyl(gp, GOLD, sx, 0.035, 0.42, 0.004, 0.09, 6);
      box(gp, '#c81e1e', sx + 0.018, 0.105, 0.42, 0.034, 0.022, 0.003);
    }
  } else {
    // Qing Amban & Golden Urn (金瓶掣签) gilded ceremonial pavilion in the Shol courtyard
    box(gp, '#d6cbb4', 0, 0.035, 0.42, 0.07, 0.012, 0.07);
    gild(lathe(gp, [[0, 0], [0.016, 0], [0.022, 0.014], [0.014, 0.028], [0.018, 0.034], [0, 0.036]], GOLD, 0, 0.047, 0.42, 10), GOLD);
    for (const dx of [-0.005, 0, 0.005]) box(gp, '#f5efe0', dx, 0.082, 0.42, 0.003, 0.018, 0.002);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Temple of Heaven — Hall of Prayer for Good Harvests on its three-tier marble altar

/** Circular glazed roof: concave cone with tile ribs, upturned eave lip and painted under-eave. */
function roundRoof(p: THREE.Object3D, x: number, y: number, z: number, rOut: number, rIn: number, h: number, o: { tile: string; rib?: string; eave?: string; under?: string; seg?: number; k?: number; lift?: number; th?: number }): number {
  const seg = o.seg ?? 64, k = o.k ?? 0.55, th = o.th ?? 0.008, lift = o.lift ?? 0.007, nr = 7;
  const ring = (rad: number, yy: number): V3[] => Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [x + Math.cos(a) * rad, yy, z + Math.sin(a) * rad];
  });
  const rings: V3[][] = [ring(rOut * 0.97, y - th)];
  for (let i = 0; i <= nr; i++) {
    const t = i / nr;
    rings.push(ring(rOut - (rOut - rIn) * t, y + h * (t * (1 - k) + k * t * t) + lift * Math.max(0, 1 - t / 0.3) ** 2));
  }
  const rib = o.rib ?? shade(o.tile, 1.18), eave = o.eave ?? shade(o.tile, 0.6), under = o.under ?? '#2f6a5e';
  skin(p, rings, o.tile, {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      if (ny < -0.3) return under;
      if (ny < 0.3) return eave;
      const col = Math.floor(((Math.atan2(pz - z, px - x) + Math.PI) / (Math.PI * 2)) * seg + 0.5);
      return col % 2 ? rib : py - y < h * 0.12 ? shade(o.tile, 0.8) : null;
    },
  });
  return y + h;
}

/** Painted timber drum: red lattice doors between columns, with a blue-green-gold beam frieze on top. */
function drum(p: THREE.Object3D, key: string, x: number, y: number, z: number, rad: number, h: number, beamF: number, seg = 48, doors = true): void {
  const geo = g('drum:' + key, () => {
    const cg = new THREE.CylinderGeometry(rad, rad, h, seg, 10, true);
    cg.translate(0, h / 2, 0);
    return paintFaces(cg, '#a3322a', (px, py, pz) => {
      const s = Math.floor(((Math.atan2(pz, px) + Math.PI) / (Math.PI * 2)) * seg + 0.5) % seg, v = py / h;
      if (v > 1 - beamF) {
        const band = Math.floor(((1 - v) / beamF) * 3);
        return band === 1 ? (s % 4 < 2 ? '#2a5d8f' : '#2f7a5e') : s % 2 ? '#d6a841' : '#1f4f7a';
      }
      if (s % 4 === 0) return '#8e2219';
      if (!doors) return null;
      if (v < 0.22) return '#8e2a20';
      return (Math.floor(v * 40) + s) % 2 ? '#c4643a' : '#b23a2e';
    });
  });
  add(p, geo, mat('#ffffff', { vc: true, flat: true }), x, y, z, 1, 1, 1);
}

// 祈年殿 as rebuilt in 1890 to the 1752 design: 32.7 m across, 38 m tall, on the 5.6 m three-tier marble 祈谷坛
// (≈0.0085 per metre). Deep cobalt-blue glazed roofs over painted drums, 28 columns, gilt 宝顶; 祈年门 to the
// south, a green-glazed 燎炉 furnace in the south-east and Qing officials attending the rite. Scaled to fit.
const templeofheaven: Builder = root => {
  const gp = grp(root, 0, 0);
  gp.scale.setScalar(0.9);
  const TILE = '#2c4682', M = '#e9e5db', M2 = '#d2ccbe', GOLD = '#c99a3a', RED = '#8e2a1f';
  // Square courtyard paved in grey brick, enclosed by red walls under blue-glazed copings
  paved(gp, 1.0, 1.0, 0, 0.02, '#a39d92', 0.05);
  const WY = 0.02;
  for (const [x, z, L, ry] of [[0, -0.48, 0.98, 0], [-0.48, 0, 0.98, Math.PI / 2], [0.48, 0, 0.98, Math.PI / 2], [-0.31, 0.48, 0.36, 0], [0.31, 0.48, 0.36, 0]] as const) {
    const wg = grp(gp, x, z, ry);
    box(wg, RED, 0, WY, 0, L, 0.045, 0.016);
    box(wg, '#3d5a6a', 0, WY + 0.04, 0, L, 0.003, 0.018);
    gable(wg, L, 0.012, 0.03, TILE, 0, WY + 0.045, 0);
  }
  // Qinian Gate in the south wall
  box(gp, RED, 0, WY, 0.48, 0.24, 0.055, 0.05);
  for (let i = -1; i <= 1; i++) box(gp, '#3a1a14', i * 0.06, WY, 0.506, 0.03, 0.04, 0.002);
  box(gp, '#2f6a5e', 0, WY + 0.055, 0.48, 0.25, 0.008, 0.056);
  roof(gp, { z: 0.48, y: WY + 0.063, w: 0.3, d: 0.09, h: 0.04, ridge: 0.1, lift: 0.008, nr: 4, step: 0.014, tile: TILE, eave: '#2f6a5e', under: '#2f6a5e', ridgeC: shade(TILE, 1.2) });
  // Three-tier white marble altar with balustrades, dragon-head spouts and four stairways
  const R = [0.385, 0.315, 0.25], TH = 0.019;
  for (let k = 0; k < 3; k++) {
    const y = WY + k * TH, rad = R[k];
    cyl(gp, M2, 0, y, 0, rad + 0.004, 0.007, 64);
    cyl(gp, M, 0, y + 0.007, 0, rad, TH - 0.011, 64);
    cyl(gp, shade(M, 1.03), 0, y + TH - 0.004, 0, rad + 0.004, 0.004, 64);
    const rr = rad - 0.004, n = Math.round((Math.PI * 2 * rr) / 0.02), hw = (k === 0 ? 0.075 : 0.06) / 2 + 0.006;
    const inGap = (a: number) => { for (let q = 0; q < 4; q++) { const d = Math.abs(Math.atan2(Math.sin(a - q * Math.PI / 2), Math.cos(a - q * Math.PI / 2))); if (Math.sin(d) * rr < (q === 1 ? hw + 0.03 : hw) && d < 1) return true; } return false; };
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      if (inGap(a0)) continue;
      box(gp, M, Math.cos(a0) * rr, y + TH, Math.sin(a0) * rr, 0.0045, 0.015, 0.0045, -a0);
      if (i % 2 === 0) box(gp, '#cfc8b8', Math.cos(a0) * (rad + 0.006), y + TH - 0.009, Math.sin(a0) * (rad + 0.006), 0.009, 0.004, 0.004, -a0);
    }
    // Carved balustrade panels: one lathe arc per quadrant between the stair openings
    const gapA = (q: number) => Math.asin(Math.min(0.9, (q === 1 ? hw + 0.03 : hw) / rr));
    for (let q = 0; q < 4; q++) {
      const a0 = (q * Math.PI) / 2 + gapA(q), a1 = ((q + 1) * Math.PI) / 2 - gapA((q + 1) % 4), sg = Math.max(2, Math.round(((a1 - a0) / (Math.PI * 2)) * 72));
      const lg = new THREE.LatheGeometry([[rr + 0.0016, 0], [rr + 0.0016, 0.011], [rr + 0.0022, 0.0125], [rr - 0.0022, 0.0125], [rr - 0.0016, 0.011], [rr - 0.0016, 0]].map(([a, b]) => new THREE.Vector2(a, b)), sg, Math.PI / 2 - a1, a1 - a0);
      add(gp, paintFaces(lg, M, (_x, py) => (py > 0.011 ? '#fbfaf6' : py < 0.003 ? '#e2ddd2' : null)), mat('#ffffff', { vc: true, flat: true }), 0, y + TH, 0, 1, 1, 1);
    }
    // Stairways on the four axes; the south stair is a triple flight with a carved dragon ramp
    for (let q = 0; q < 4; q++) {
      const sg = grp(gp, 0, 0, (q * Math.PI) / 2);
      const run = 0.03, zf = rad + run;
      if (q === 0) {
        for (const sx of [-1, 1]) flight(sg, sx * 0.037, zf, y, y + TH, 0.028, run, M2, 5);
        add(sg, g('box', () => new THREE.BoxGeometry(1, 1, 1)), mat('#d9d3c5'), 0, y + TH / 2, zf - run / 2, 0.042, 0.004, Math.hypot(run, TH), 0, Math.atan2(TH, run));
        for (const sx of [-1, 0, 1]) rod(sg, [sx * 0.056 + (sx === 0 ? 0 : 0), y + 0.012, zf], [sx * 0.056, y + TH + 0.012, zf - run], 0.0022, M, 4);
      } else {
        flight(sg, 0, zf, y, y + TH, 0.06, run, M2, 5);
        for (const sx of [-1, 1]) rod(sg, [sx * 0.033, y + 0.012, zf], [sx * 0.033, y + TH + 0.012, zf - run], 0.0022, M, 4);
      }
    }
  }
  // The hall: 28 columns, lattice doors, three blue conical roofs on painted drums, gilded finial
  const HY = WY + 3 * TH;
  cyl(gp, M2, 0, HY, 0, 0.165, 0.008, 48);
  cyl(gp, M, 0, HY + 0.008, 0, 0.158, 0.006, 48);
  const B0 = HY + 0.014;
  drum(gp, 'toh1', 0, B0, 0, 0.142, 0.1, 0.22);
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) / 24) * Math.PI * 2;
    cyl(gp, RED, Math.cos(a) * 0.15, B0, Math.sin(a) * 0.15, 0.0055, 0.08, 6);
  }
  let y = roundRoof(gp, 0, B0 + 0.1, 0, 0.188, 0.124, 0.048, { tile: TILE });
  drum(gp, 'toh2', 0, y - 0.012, 0, 0.12, 0.068, 0.55, 48, false);
  y = roundRoof(gp, 0, y + 0.054, 0, 0.152, 0.094, 0.042, { tile: TILE });
  drum(gp, 'toh3', 0, y - 0.01, 0, 0.09, 0.066, 0.55, 40, false);
  // Gilded plaque with the hall's name under the top eave
  mbox(gp, GOLD, 0, y + 0.01, 0.09, 0.032, 0.04, 0.004);
  box(gp, '#23345e', 0, y + 0.014, 0.0925, 0.022, 0.032, 0.002);
  y = roundRoof(gp, 0, y + 0.054, 0, 0.12, 0.014, 0.084, { tile: TILE, k: 0.35 });
  gild(lathe(gp, [[0.016, 0], [0.012, 0.006], [0.008, 0.01], [0.009, 0.018], [0.014, 0.028], [0.0145, 0.036], [0.01, 0.046], [0, 0.05]], GOLD, 0, y - 0.004, 0, 16), GOLD);
  // Green-glazed 燎炉 sacrificial furnace (south-east) and iron burners
  const LZ = '#3f6b4f';
  box(gp, '#6b7a62', 0.36, WY, 0.38, 0.05, 0.006, 0.04);
  box(gp, LZ, 0.36, WY + 0.006, 0.38, 0.04, 0.032, 0.03);
  box(gp, '#2a221c', 0.36, WY + 0.01, 0.396, 0.014, 0.016, 0.001);
  roof(gp, { x: 0.36, z: 0.38, y: WY + 0.038, w: 0.05, d: 0.04, h: 0.018, ridge: 0.012, gable: 0.55, lift: 0.004, nr: 3, step: 0.008, tile: LZ, ridgeC: shade(LZ, 1.1), hipR: 0.0018, ridgeH: 0.003 });
  for (const sx of [-1, 1]) lathe(gp, [[0.006, 0], [0.01, 0.006], [0.009, 0.016], [0, 0.016]], '#3e3a34', sx * 0.11, WY, 0.4, 8);
  // Qing officials in dark 补服 lining the south approach, facing the hall
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    human(gp, sx * (0.075 + (i % 2) * 0.03), WY, 0.425 - i * 0.012 - (i % 2) * 0.006, {
      h: 0.024, ry: Math.PI, top: i === 0 ? '#3b2f2a' : '#2a2d3a', bottom: '#1f2029', skin: '#c49a76', hair: '#1d1915',
      hat: '#2a2622', hatStyle: 'qing', hatBadge: '#a8322a', dress: 'ankle', shoes: '#1c1a18', detail: 'lo',
    });
  }
};
export const ASIA2: Record<string, Builder> = { potala, templeofheaven };
