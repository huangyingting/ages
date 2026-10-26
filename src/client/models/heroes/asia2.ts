import { human, passerby } from '../human.ts';
import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, rod, sweep, lathe, slab, skin, prism, gable, panel, archPath,
  paintFaces, shade, mix, fbm, hash3,
} from '../prims.ts';
import { type HFn, island, sstep, ridged, strataSide, EARTH, scatter, onGround } from '../nature.ts';

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
const sea = (c: string, cell = 0.025): Paint => (x, _y, z) => {
  const ci = Math.floor(x / cell), cj = Math.floor(z / cell), h = hash3(ci, 4, cj);
  if (Math.sin(x * 46 + Math.sin(z * 18) * 2.2) > 0.975) return mix(c, '#e2f4f6', 0.45);
  return h > 0.72 ? shade(c, 1.07) : h < 0.25 ? shade(c, 0.93) : null;
};

/** Tiny visitor for scale. */
function person(p: THREE.Object3D, x: number, y: number, z: number, c: string, s = 1): void {
  passerby(p, x, y, z, 0.018 * s, 1, { top: c });
}

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
function plathe(p: THREE.Object3D, key: string, pts: [number, number][], base: string, paint: Paint | undefined, x: number, y: number, z: number, seg = 16, o: { metal?: number; rough?: number; flat?: boolean } = {}): THREE.Mesh {
  const geo = g('plathe:' + key + ':' + seg, () => {
    const lg = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
    lg.computeVertexNormals();
    return paintFaces(lg, base, paint);
  });
  return add(p, geo, mat('#ffffff', { vc: true, flat: o.flat ?? false, metal: o.metal, rough: o.rough }), x, y, z, 1, 1, 1);
}

/** Tropical palm: slender leaning trunk with drooping fronds. */
function palm(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number): void {
  const lean = hash3(seed, 1, 1) * 0.3;
  const top: V3 = [x + Math.cos(seed) * s * lean, y + s, z + Math.sin(seed) * s * lean];
  rod(p, [x, y, z], top, s * 0.03, '#7a6650', 5);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + seed, d = 0.35 + (k % 2) * 0.35, L = s * 0.32;
    box(p, k % 2 ? '#3f7a3a' : '#4f8a42', top[0] + (L / 2) * Math.cos(d) * Math.cos(a), top[1] - (L / 2) * Math.sin(d), top[2] - (L / 2) * Math.cos(d) * Math.sin(a), L, 0.003, s * 0.07, a, 0, -d);
  }
  lowball(p, '#3a6b35', top[0], top[1], top[2], s * 0.12);
}

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

// ---------------------------------------------------------------------------------------------------------
// Marina Bay Sands — three 55-storey twin-legged towers under the SkyPark, ArtScience lotus on the bay

const marinabay: Builder = (gp, r) => {
  const GLS = '#4f7486', SP = mix(r.color ?? '#cbd5e1', '#f1f5f9', 0.5), WHT = '#eef2f4', G = 0.041;
  const shoreZ = 0.17;
  island(gp, 0.5, (x, z) => (z > shoreZ + 0.015 * Math.sin(x * 9) ? 0.0 : 0.006), '#7c8a6a', (x, y, z, _nx, ny) => {
    if (y - 0.035 < 0.002 && ny > 0.9) return sea('#3d7f86')(x, y, z, 0, 1, 0) ?? '#3d7f86';
    if (z > shoreZ - 0.035) return hash3(Math.floor(x * 80), 1, Math.floor(z * 80)) > 0.6 ? '#c9c1b0' : '#d8d0bf';
    if (Math.abs(z + 0.3) < 0.02) return '#40454c';
    return mix('#5f8a4a', '#7c9a5a', fbm(x * 9, 0, z * 9));
  }, { rings: 30, segs: 96, side: strataSide(['#5b5f66', '#4b5058']) });
  // Podium: The Shoppes with its rippling white roofs along the promenade
  box(gp, '#9fb6c0', 0.03, G, 0.07, 0.74, 0.03, 0.13);
  for (let k = 0; k < 2; k++) box(gp, '#d9dfe2', 0.03, G + 0.008 + k * 0.011, 0.07, 0.742, 0.003, 0.132);
  for (let i = 0; i < 5; i++) {
    const x = -0.27 + i * 0.15;
    lowball(gp, '#f3f4f2', x, G + 0.03, 0.08, 0.16, 0.035, 0.13);
  }
  // Three towers, each a straight narrow leg and a wide leg curving outward below level 23
  const H = 0.62, YJ = 0.33, D = 0.052, FL = 0.0113 * 2;
  const leg = (x0: number, x1: number, z: number, flare: number) => {
    const ys: number[] = [];
    for (let y = G; y < G + H - 1e-4; y += FL) ys.push(y, Math.min(G + H, y + FL * 0.3));
    ys.push(G + H);
    const rings = ys.map(y => {
      const t = Math.max(0, 1 - (y - G) / (YJ - G)), o = flare * t ** 1.7;
      return [[x0 + o, y, z + D / 2], [x1 + o, y, z + D / 2], [x1 + o, y, z - D / 2], [x0 + o, y, z - D / 2]] as V3[];
    });
    skin(gp, rings, GLS, {
      caps: true, flat: true, metal: 0.25, rough: 0.35,
      paint: (_x, y, _z, nx, ny) => {
        if (ny > 0.8) return '#9aa3aa';
        if (Math.abs(nx) > 0.5) return WHT;
        return ((y - G) / FL) % 1 < 0.3 ? '#c9d4da' : null;
      },
    });
  };
  const TX = [-0.215, 0, 0.215], TZ = -0.09;
  for (const tx of TX) {
    leg(tx - 0.068, tx - 0.02, TZ, 0);
    leg(tx - 0.02, tx + 0.068, TZ, 0.055);
    // Vertical white fins down the straight leg and the glass atrium between the splayed legs
    for (const dx of [-0.068, -0.044, -0.02]) for (const sz of [-1, 1]) box(gp, WHT, tx + dx, G, TZ + sz * (D / 2 + 0.001), 0.003, H, 0.002);
    prism(gp, [[tx - 0.02, TZ + D / 2 - 0.006], [tx + 0.035, TZ + D / 2 - 0.006], [tx + 0.035, TZ - D / 2 + 0.006], [tx - 0.02, TZ - D / 2 + 0.006]], G, 0.07, '#6d93a3');
    box(gp, '#8a959c', tx, G + H, TZ, 0.05, 0.012, 0.03);
  }
  // SkyPark: the 340 m "ship" deck with its cantilevered bow over the north tower
  const SY = G + H + 0.012, xs: number[] = [];
  for (let i = 0; i <= 26; i++) xs.push(-0.43 + (i / 26) * 0.77);
  const wAt = (x: number) => 0.045 * Math.sqrt(Math.max(0.02, 1 - Math.max(0, (-0.3 - x) / 0.13) ** 2)) * Math.sqrt(Math.max(0.05, 1 - Math.max(0, (x - 0.31) / 0.03) ** 2));
  const zc = (x: number) => TZ + 0.06 * x * x;
  const rings = xs.map(x => {
    const w = wAt(x), th = 0.02 * (0.55 + 0.45 * Math.min(1, w / 0.04)), z = zc(x), yt = SY + 0.004 * Math.max(0, (-0.25 - x) / 0.18);
    return [[x, yt, z + w], [x, yt - th * 0.45, z + w * 1.04], [x, yt - th, z + w * 0.5], [x, yt - th, z - w * 0.5], [x, yt - th * 0.45, z - w * 1.04], [x, yt, z - w]] as V3[];
  });
  skin(gp, rings, SP, { caps: true, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny > 0.8 ? '#c8b79a' : ny < -0.8 ? '#aeb8c0' : null) });
  // Infinity pool along the city-facing edge, gardens, pavilions and the observation deck
  box(gp, '#2fa6c9', -0.13, SY - 0.002, zc(-0.13) + 0.026, 0.3, 0.004, 0.016).material = mat('#2fa6c9', { emissive: '#0e4f63', rough: 0.15 });
  for (let i = 0; i < 18; i++) {
    const x = -0.3 + i * 0.033, z = zc(x) - 0.012 + (i % 2) * 0.012;
    if (i % 3 === 0) palm(gp, x, SY, z, 0.03, i); else lowball(gp, i % 2 ? '#3f7a3a' : '#4f8a46', x, SY + 0.007, z, 0.016, 0.014, 0.016);
  }
  for (const x of [0.12, 0.2, 0.27]) { box(gp, '#f4f4f2', x, SY, zc(x) - 0.012, 0.04, 0.012, 0.03); box(gp, '#9fb6c0', x, SY + 0.002, zc(x) + 0.004, 0.036, 0.008, 0.003); }
  for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + (i / 7) * Math.PI; box(gp, '#d9dfe2', -0.4 + Math.cos(a) * 0.02, SY, zc(-0.4) + Math.sin(a) * 0.02, 0.002, 0.006, 0.002); }
  // ArtScience Museum: ten white "fingers" of the lotus rising from a reflecting dish
  const AX = -0.3, AZ = 0.3;
  lathe(gp, [[0.0, 0], [0.05, 0], [0.055, 0.004], [0.03, 0.006], [0, 0.006]], '#dfe5e8', AX, 0.035, AZ, 16);
  cyl(gp, '#b9c4c8', AX, 0.035, AZ, 0.012, 0.03, 8);
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * (0.08 + (i / 9) * 0.84) + Math.PI, L = 0.07 + 0.05 * Math.sin((i / 9) * Math.PI), ca = Math.cos(a), sa = Math.sin(a);
    const pt = (t: number, up: number): V3 => [AX + ca * L * t * 0.85, 0.05 + up, AZ - sa * L * t * 0.85 * -1];
    sweep(gp, [{ p: pt(0, 0), w: 0.018, h: 0.012 }, { p: pt(0.45, 0.012 + L * 0.15), w: 0.016, h: 0.01 }, { p: pt(0.85, 0.03 + L * 0.5), w: 0.009, h: 0.006 }, { p: pt(1, 0.04 + L * 0.85), w: 0.002, h: 0.002 }], i % 2 ? '#f4f6f6' : '#e6ebec', { radial: 8, sub: 3 });
  }
  // Promenade palms, the event plaza steps and a bumboat on the bay
  for (let i = 0; i < 9; i++) palm(gp, -0.12 + i * 0.06, G, 0.16, 0.05, i * 3 + 1);
  for (let k = 0; k < 3; k++) box(gp, '#bdb5a5', 0.15, 0.035, shoreZ + 0.01 + k * 0.008, 0.26, 0.006 - k * 0.002, 0.008);
  const bt = grp(gp, 0.18, 0.36, 0.3, 0.035);
  box(bt, '#b45309', 0, 0, 0, 0.06, 0.008, 0.018);
  box(bt, '#f1f5f9', 0, 0.008, 0, 0.034, 0.008, 0.014);
  box(bt, '#dc2626', 0, 0.016, 0, 0.04, 0.002, 0.018);
};

// ---------------------------------------------------------------------------------------------------------
// Borobudur — six redented square terraces with relief galleries, three round terraces of perforated stupas

/** Redented square plan (stepped corners + central projection per side), edges subdivided to ≈`seg` spacing. */
function redent(s: number, n: number, pw: number, pp: number, seg = 0): [number, number][] {
  const side: [number, number][] = [[-(s - 2 * n), s], [-pw, s], [-pw, s + pp], [pw, s + pp], [pw, s], [s - 2 * n, s], [s - 2 * n, s - n], [s - n, s - n], [s - n, s - 2 * n]];
  const out: [number, number][] = [];
  for (const [rx, rz] of [[1, 0], [0, -1], [-1, 0], [0, 1]] as const) {
    // rotate (x, z) by quarter turns: front → right → back → left
    const rot = ([x, z]: [number, number]): [number, number] => (rx === 1 ? [x, z] : rz === -1 ? [z, -x] : rx === -1 ? [-x, -z] : [-z, x]);
    for (let i = 0; i < side.length; i++) {
      const a = rot(side[i]);
      out.push(a);
      if (seg > 0 && (i === 0 || i === 4)) {
        const b = rot(side[i + 1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.floor(L / seg);
        for (let j = 1; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
      }
    }
  }
  return out;
}

const borobudur: Builder = (root, r) => {
  const ST = r.color ?? '#7a7466', DK = shade(ST, 0.72), LT = shade(ST, 1.14), MOSS = '#5f6a4a';
  // Lawn with paths and the temple park; the monument itself is built at 0.88 scale inside it
  paved(root, 1.0, 1.0, 0, 0.02, '#5c8a44', 0.05, 0, 0, (x, _y, z) => {
    const ci = Math.floor((x + 0.5) / 0.05), cj = Math.floor((z + 0.5) / 0.05);
    if (ci === 9 || ci === 10 || cj === 9 || cj === 10) return '#b3a58a';
    const h = hash3(ci, 1, cj);
    return h > 0.75 ? '#6b9a4c' : h < 0.2 ? '#4f7d3c' : null;
  }, 20);
  const G = 0.02, gp = grp(root, 0, 0);
  gp.scale.setScalar(0.88);
  gp.position.y = G * 0.12;
  const S = [0.43, 0.375, 0.335, 0.3, 0.27, 0.245], Y = [G, G + 0.04, G + 0.07, G + 0.1, G + 0.13, G + 0.16, G + 0.185];
  for (let k = 0; k < S.length; k++) {
    const plan = redent(S[k], 0.018 + k * 0.001, 0.07, 0.012, 0.03), y0 = Y[k], y1 = Y[k + 1], hh = y1 - y0;
    const ys = k === 0 ? [y0, y0 + hh * 0.2, y0 + hh * 0.3, y0 + hh * 0.85, y1] : [y0, y0 + hh * 0.15, y0 + hh * 0.25, y0 + hh * 0.8, y0 + hh * 0.9, y1];
    const rings = ys.map((y, i) => plan.map(([x, z]) => {
      const o = i === 1 || (k > 0 && i === 4) ? 0.003 : 0;
      return [x * (1 + o / S[k]), y, z * (1 + o / S[k])] as V3;
    }));
    skin(gp, rings, ST, {
      caps: true, flat: true,
      paint: (x, y, z, nx, ny, nz) => {
        if (ny > 0.8) return hash3(Math.floor(x * 40 + 99), k, Math.floor(z * 40 + 99)) > 0.6 ? shade(ST, 1.06) : shade(ST, 0.97);
        const v = (y - y0) / hh;
        if (v < 0.15 || v > 0.9) return LT;
        if (v > 0.8) return DK;
        const u = Math.abs(nz) > Math.abs(nx) ? x : z, cell = Math.floor(u / 0.03 + 100);
        return hash3(cell, k, 3) > 0.82 ? MOSS : cell % 2 ? shade(ST, 0.86) : shade(ST, 0.94);
      },
    });
    if (k === 0 || k === S.length - 1) continue;
    // Balustrade crowned by Buddha niches with miniature stupa tops
    const bp = redent(S[k] - 0.004, 0.018 + k * 0.001, 0.07, 0.012);
    for (let i = 0; i < bp.length; i++) {
      const a = bp[i], b = bp[(i + 1) % bp.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ry = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (Math.min(Math.abs(mx), Math.abs(mz)) < 0.03 && L > 0.05) {
        // leave the stair gateway open at the side centre
        for (const t of [0.15, 0.85]) box(gp, ST, a[0] + (b[0] - a[0]) * t, y1, a[1] + (b[1] - a[1]) * t, L * 0.3, 0.018, 0.007, ry);
        continue;
      }
      box(gp, ST, mx, y1, mz, L + 0.006, 0.018, 0.007, ry);
      const n = Math.max(1, Math.round(L / 0.05));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        box(gp, DK, x, y1 + 0.018, z, 0.012, 0.01, 0.009, ry);
        cone(gp, ST, x, y1 + 0.028, z, 0.0055, 0.011, 6);
      }
    }
  }
  // Stairways straight up the four axes with kala-makara gateways at each gallery
  const ty = Y[S.length], PP = 0.012;
  for (let q = 0; q < 4; q++) {
    const sg = grp(gp, 0, 0, (q * Math.PI) / 2);
    for (let i = 0; i < S.length; i++) {
      const zi = S[i] + PP, run = i === 0 ? 0.05 : Math.min(0.035, 0.72 * (S[i - 1] - S[i])), zo = zi + run, ylo = i === 0 ? G : Y[i];
      flight(sg, 0, zo, ylo, Y[i + 1], 0.04, run, shade(ST, 0.92), 6);
      for (const sx of [-1, 1]) {
        add(sg, g('box', () => new THREE.BoxGeometry(1, 1, 1)), mat(DK), sx * 0.024, (ylo + Y[i + 1]) / 2 + 0.004, zi + run / 2, 0.008, 0.008, Math.hypot(run, Y[i + 1] - ylo), 0, Math.atan2(Y[i + 1] - ylo, run));
      }
      if (i > 0 && i < S.length - 1) {
        // kala gateway over the stair head
        for (const sx of [-1, 1]) box(sg, ST, sx * 0.025, Y[i + 1], zi - 0.004, 0.009, 0.03, 0.008);
        box(sg, LT, 0, Y[i + 1] + 0.024, zi - 0.004, 0.06, 0.012, 0.009);
        cone(sg, ST, 0, Y[i + 1] + 0.036, zi - 0.004, 0.009, 0.013, 6);
      }
    }
  }
  // Three circular terraces ringed by 32, 24 and 16 perforated bell stupas
  const RR = [0.218, 0.17, 0.124], RS = [0.198, 0.152, 0.107], NS = [32, 24, 16], CH = 0.016;
  const bell: [number, number][] = [[0.013, 0], [0.013, 0.004], [0.0118, 0.006], [0.0121, 0.012], [0.0114, 0.018], [0.0096, 0.024], [0.0065, 0.0285], [0.0042, 0.031], [0.004, 0.036], [0.0008, 0.043]];
  let cy = ty;
  for (let k = 0; k < 3; k++) {
    cyl(gp, LT, 0, cy, 0, RR[k] + 0.003, 0.003, 40);
    cyl(gp, ST, 0, cy + 0.003, 0, RR[k], CH - 0.003, 40);
    cy += CH;
    const diamond = k < 2;
    for (let i = 0; i < NS[k]; i++) {
      const a = ((i + 0.5) / NS[k]) * Math.PI * 2;
      plathe(gp, 'boro-bell' + (diamond ? 'd' : 's'), bell, ST, (px, py, pz, _nx, ny) => {
        if (ny > 0.95 || py < 0.0045) return py < 0.0045 ? LT : null;
        if (py > 0.006 && py < 0.024) {
          const col = Math.floor(((Math.atan2(pz, px) + Math.PI) / (Math.PI * 2)) * 8), row = Math.floor((py - 0.006) / 0.006);
          return (diamond ? (col + row) % 2 : col % 2) ? '#2b2721' : null;
        }
        return py > 0.03 ? DK : null;
      }, Math.cos(a) * RS[k], cy, Math.sin(a) * RS[k], 8);
    }
  }
  // The great crowning stupa with its square harmika and pinnacle
  lathe(gp, [[0.0, 0], [0.072, 0], [0.072, 0.008], [0.066, 0.01], [0.068, 0.022], [0.062, 0.038], [0.05, 0.052], [0.032, 0.062], [0.015, 0.066], [0, 0.066]], ST, 0, cy, 0, 24);
  cyl(gp, LT, 0, cy + 0.02, 0, 0.0685, 0.003, 24);
  box(gp, ST, 0, cy + 0.064, 0, 0.026, 0.012, 0.026);
  box(gp, LT, 0, cy + 0.076, 0, 0.03, 0.004, 0.03);
  lathe(gp, [[0.0, 0], [0.008, 0], [0.007, 0.006], [0.004, 0.022], [0.0015, 0.04], [0, 0.044]], ST, 0, cy + 0.08, 0, 8);
  // Palms, rain trees and visitors around the monument
  scatter(150, 11, (x, z, i) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < 0.44 || d > 0.49 || Math.abs(x) < 0.06 || Math.abs(z) < 0.06) return;
    if (i % 3 === 0) palm(root, x, G, z, 0.06, i);
    else { rod(root, [x, G, z], [x, G + 0.03, z], 0.003, '#5a4a3a', 4); lowball(root, i % 2 ? '#3f6f35' : '#4f7f3c', x, G + 0.045, z, 0.06, 0.035, 0.06, i); }
  }, 0.7);
  const pc = ['#f8fafc', '#1f2937', '#dc2626', '#2563eb', '#eab308'];
  for (let i = 0; i < 14; i++) {
    const k = 1 + (i % 4), side = Math.floor(hash3(i, 4, 1) * 4), u = (hash3(i, 4, 2) - 0.5) * 2 * (S[k] - 0.06), w = (S[k] + S[k - 1]) / 2 - 0.006;
    const [x, z] = side === 0 ? [u, w] : side === 1 ? [w, u] : side === 2 ? [u, -w] : [-w, u];
    if (Math.abs(u) < 0.04) continue;
    person(gp, x, Y[k], z, pc[i % pc.length], 0.9);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Shwedagon Pagoda — gilded bell stupa on octagonal terraces, hti spire, ringed by shrines and pavilions

/** Myanmar pyatthat: hall with a stack of diminishing tiered roofs and a spike finial. */
function pyatthat(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, body: string, roofC: string, tiers = 5): void {
  const pg = grp(p, x, z, ry, y);
  box(pg, body, 0, 0, 0, s, s * 0.55, s);
  box(pg, '#2a1d14', 0, s * 0.05, s / 2 + 0.0005, s * 0.4, s * 0.35, 0.001);
  let yy = s * 0.55, w = s * 1.25;
  for (let i = 0; i < tiers; i++) {
    const h = s * 0.22 * (1 - i * 0.08);
    cone(pg, roofC, 0, yy, 0, w * 0.72, h, 4, Math.PI / 4);
    box(pg, shade(roofC, 0.8), 0, yy + h * 0.55, 0, w * 0.42, h * 0.5, w * 0.42);
    yy += h * 0.9;
    w *= 0.78;
  }
  cone(pg, roofC, 0, yy, 0, w * 0.4, s * 0.6, 6);
}

const shwedagon: Builder = (gp, r) => {
  const GOLD = r.color ?? '#e2b13c', G2 = shade(GOLD, 0.84), G3 = shade(GOLD, 1.12), MAR = '#efebe2';
  // Singuttara hill: green mound with the marble-paved platform on top
  lathe(gp, [[0, 0], [0.5, 0], [0.5, 0.012], [0.47, 0.03], [0.44, 0.04], [0, 0.04]], '#557d3e', 0, 0, 0, 40);
  const PY = 0.04;
  paved(gp, 0.7, 0.7, PY, 0.012, MAR, 0.035, 0, 0, (x, _y, z) => {
    const ci = Math.floor((x + 0.35) / 0.035), cj = Math.floor((z + 0.35) / 0.035);
    return (ci + cj) % 2 ? (hash3(ci, 2, cj) > 0.5 ? '#e6e0d4' : null) : '#d9d1c2';
  });
  const Y0 = PY + 0.012;
  // Octagonal gilded terraces
  const oct = [[0.2, 0.022], [0.182, 0.02], [0.164, 0.018]];
  let y = Y0;
  for (const [rad, h] of oct) {
    const m = cyl(gp, GOLD, 0, y, 0, rad, h, 8);
    m.rotation.y = Math.PI / 8;
    gild(m, GOLD, false);
    const t = cyl(gp, G3, 0, y + h - 0.003, 0, rad + 0.003, 0.003, 8);
    t.rotation.y = Math.PI / 8;
    gild(t, G3, false);
    y += h;
  }
  // The stupa: bell, moulded rings, inverted alms bowl, lotus petals, banana bud — one gilded painted lathe
  const prof: [number, number][] = [
    [0.0001, 0], [0.15, 0], [0.15, 0.012], [0.142, 0.014], [0.142, 0.026], [0.134, 0.028], [0.134, 0.04], [0.126, 0.042], [0.126, 0.054],
    [0.124, 0.07], [0.118, 0.11], [0.104, 0.16], [0.084, 0.2], [0.064, 0.232], [0.05, 0.25],
    [0.052, 0.255], [0.052, 0.262], [0.046, 0.266], [0.047, 0.274], [0.042, 0.278], [0.043, 0.286], [0.038, 0.29],
    [0.044, 0.296], [0.046, 0.31], [0.04, 0.322],
    [0.046, 0.326], [0.034, 0.348], [0.036, 0.352], [0.03, 0.37],
    [0.03, 0.375], [0.027, 0.4], [0.021, 0.44], [0.013, 0.48], [0.0065, 0.505], [0.004, 0.512], [0, 0.514],
  ];
  const base = y;
  plathe(gp, 'shwe-main', prof, GOLD, (px, py, pz, _nx, ny) => {
    const a = Math.atan2(pz, px), u = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 48);
    if (py < 0.056) return ny > 0.5 ? G3 : null;
    if (py > 0.13 && py < 0.16) return u % 2 ? G3 : G2;
    if (py > 0.25 && py < 0.29) return Math.floor(py / 0.004) % 2 ? G3 : G2;
    if (py > 0.322 && py < 0.352) return u % 3 === 0 ? G2 : G3;
    if (py > 0.375) return Math.floor(py / 0.012) % 3 === 0 ? G2 : null;
    return null;
  }, 0, base, 0, 48, { metal: 0.6, rough: 0.3 });
  // Hti: tiered umbrella of jewelled rings, flag vane and diamond orb
  let hy = base + 0.505;
  for (let i = 0; i < 6; i++) {
    const rr = 0.012 - i * 0.0015;
    gild(cyl(gp, G3, 0, hy, 0, rr, 0.004, 12), G3);
    gild(cyl(gp, G2, 0, hy + 0.004, 0, rr * 0.7, 0.003, 10), G2);
    hy += 0.007;
  }
  gild(cone(gp, GOLD, 0, hy, 0, 0.004, 0.012, 8), GOLD);
  rod(gp, [0, hy, 0], [0, hy + 0.05, 0], 0.0012, GOLD, 4);
  gild(slab(gp, [[0, 0], [0.014, 0.002], [0.012, 0.007], [0, 0.009]], 0.001, G3, 0, false), G3).position.set(0.001, hy + 0.025, 0);
  const orb = lowball(gp, '#f5f7ff', 0, hy + 0.046, 0, 0.007);
  orb.material = mat('#f5f7ff', { metal: 0.3, rough: 0.1, emissive: '#7a8aa8' });
  // Guardian chinthe, planetary posts and a ring of 64 smaller gilded stupas around the terrace
  const small: [number, number][] = [[0.0001, 0], [0.019, 0], [0.019, 0.007], [0.017, 0.009], [0.017, 0.014], [0.016, 0.02], [0.013, 0.028], [0.009, 0.034], [0.0075, 0.037], [0.008, 0.041], [0.0065, 0.044], [0.0055, 0.05], [0.0035, 0.06], [0.0015, 0.068], [0, 0.071]];
  const smallP: Paint = (_x, py) => (py < 0.008 ? G3 : py > 0.036 && py < 0.044 ? G2 : null);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + Math.PI / 64, R = 0.232;
    plathe(gp, 'shwe-small', small, GOLD, smallP, Math.cos(a) * R, Y0, Math.sin(a) * R, 8, { metal: 0.55, rough: 0.32 });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, R = 0.275;
    const m = plathe(gp, 'shwe-small', small, GOLD, smallP, Math.cos(a) * R, Y0, Math.sin(a) * R, 8, { metal: 0.55, rough: 0.32 });
    m.scale.setScalar(1.7);
  }
  // Prayer halls (tazaung) on the four axes and around the platform: red-and-gold or white tiered roofs
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2;
    pyatthat(gp, Math.sin(a) * 0.3, Y0, Math.cos(a) * 0.3, 0.06, a, '#f3eee4', GOLD, 6);
  }
  const ring: [number, number, number, string, string][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16, R = i % 2 ? 0.31 : 0.33;
    const kind = i % 4;
    ring.push([Math.sin(a) * R, Math.cos(a) * R, a, kind === 1 ? '#f4f2ec' : kind === 3 ? '#8e2a1e' : '#f3eee4', kind === 1 ? '#f4f2ec' : kind === 3 ? '#9b3322' : GOLD]);
  }
  for (const [x, z, a, b, c] of ring) pyatthat(gp, x, Y0, z, 0.042, a, b, c, 4);
  // Covered stairway down the south hill with a pair of white chinthe guardians
  for (let i = 0; i < 6; i++) {
    const z = 0.36 + i * 0.022, yb = PY - i * 0.0075;
    for (const sx of [-1, 1]) box(gp, '#f3eee4', sx * 0.02, Math.max(0, yb - 0.02), z, 0.006, 0.026, 0.006);
    box(gp, '#d9a93a', 0, yb + 0.006, z, 0.05, 0.003, 0.024);
    gable(gp, 0.024, 0.012, 0.05, '#9b3322', 0, yb + 0.009, z, Math.PI / 2);
  }
  for (const sx of [-1, 1]) {
    box(gp, '#f4f2ec', sx * 0.045, 0.026, 0.462, 0.02, 0.02, 0.02);
    box(gp, '#f4f2ec', sx * 0.045, 0.046, 0.466, 0.012, 0.03, 0.012);
    box(gp, '#d9a93a', sx * 0.045, 0.072, 0.47, 0.012, 0.008, 0.014);
  }
  // Trees on the hill, pilgrims on the platform
  scatter(36, 21, (x, z, i) => {
    const d = Math.hypot(x, z);
    if (d < 0.43 || d > 0.49 || (Math.abs(x) < 0.06 && z > 0)) return;
    lowball(gp, i % 2 ? '#3f6f35' : '#4f7f3c', x, 0.04, z, 0.045, 0.04, 0.045, i);
  }, 0.5);
  const pc = ['#f8fafc', '#7c2d12', '#b45309', '#1f2937', '#dc2626', '#0f766e'];
  for (let i = 0; i < 22; i++) {
    const a = hash3(i, 3, 1) * Math.PI * 2, d = 0.25 + hash3(i, 3, 2) * 0.13;
    person(gp, Math.cos(a) * d, Y0, Math.sin(a) * d, pc[i % pc.length]);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Tokyo Skytree — steel lattice morphing from a triangular base to a circle, two observatories, gain tower

const skytree: Builder = (gp, r) => {
  const WH = r.color ?? '#e2e8f0', STEEL = mix(WH, '#f4f8fc', 0.5), CORE = '#d3dae2', GLS = '#4a6378', G = 0.02;
  // Ground: Oshiage district with the Kitajukken canal and the Sumida river edge
  const CELL = 0.84 / 30;
  const ground: Paint = (x, _y, z) => {
    const ci = Math.floor((x + 0.42) / CELL), cj = Math.floor((z + 0.42) / CELL), cx = (ci + 0.5) * CELL - 0.42, cz = (cj + 0.5) * CELL - 0.42;
    if (Math.abs(cz - 0.13 - 0.04 * Math.sin(cx * 6)) < 0.016) return '#4f7f96';
    if (cx + cz * 0.4 > 0.33) return cx + cz * 0.4 > 0.36 ? '#3f6f8a' : '#b9bdc0';
    if (ci % 4 === 0 || cj % 4 === 0) return '#6f757c';
    const h = hash3(ci, 5, cj);
    return h > 0.85 ? '#6e9a5a' : h > 0.55 ? '#a7aeb5' : null;
  };
  paved(gp, 0.84, 0.84, 0, G, '#9aa1a8', 0.028, 0, 0, ground, 30);
  // Lattice outline: triangle (circumradius Rs) blending to a circle with height
  const a0 = Math.PI / 2, LT = 0.535;
  const Rs = (y: number) => (y <= LT ? 0.034 + 0.034 * (1 - y / LT) ** 1.6 : y < 0.7 ? 0.028 : 0.024);
  const tri = (a: number) => { const t = (((a - a0) % (Math.PI * 2 / 3)) + Math.PI * 2 / 3) % (Math.PI * 2 / 3); return 0.5 / Math.cos(t - Math.PI / 3); };
  const P = (a: number, y: number): V3 => {
    const w = sstep(0.04, 0.42, y), rr = Rs(y) * (tri(a) * (1 - w) + 0.8 * w);
    return [Math.cos(a) * rr, G + y, Math.sin(a) * rr];
  };
  const lattice = (y0: number, y1: number, N: number, L: number, rad: number, legs: boolean) => {
    const pts: V3[][] = [];
    for (let l = 0; l <= L; l++) {
      const y = y0 + ((y1 - y0) * l) / L;
      pts.push(Array.from({ length: N }, (_, j) => P((j / N) * Math.PI * 2 + a0, y)));
    }
    for (let l = 0; l < L; l++) for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N, leg = legs && j % (N / 3) === 0;
      rod(gp, pts[l][j], pts[l + 1][j], leg ? rad * 2.2 : rad, STEEL, 4);
      rod(gp, (j + l) % 2 ? pts[l][j] : pts[l][j1], (j + l) % 2 ? pts[l + 1][j1] : pts[l + 1][j], rad * 0.8, STEEL, 4);
      if (l % 2 === 0) rod(gp, pts[l][j], pts[l][j1], rad * 0.8, STEEL, 4);
    }
  };
  lattice(0, LT, 15, 16, 0.0019, true);
  // Inner core shaft (the central reinforced-concrete column) and the base podium
  lathe(gp, [[0.022, 0], [0.02, 0.2], [0.017, 0.4], [0.016, LT + 0.01], [0, LT + 0.01]], CORE, 0, G, 0, 12);
  prism(gp, [[0, 0.085], [0.074, -0.043], [-0.074, -0.043]].map(([x, z]) => [x * 1.1, z * 1.1] as [number, number]), G, 0.018, '#d5dbe2');
  // Tembo Deck: three-level drum with a flared skirt, glazing bands and a ribbed crown
  const DY = G + LT;
  plathe(gp, 'sky-deck', [[0.026, -0.012], [0.04, 0.002], [0.044, 0.008], [0.045, 0.018], [0.045, 0.03], [0.044, 0.038], [0.04, 0.044], [0.031, 0.048], [0.0, 0.05]], WH, (_x, py, _z, _nx, ny) => {
    if (ny < -0.5) return '#cfd6de';
    if (py > 0.011 && py < 0.016) return GLS;
    if (py > 0.021 && py < 0.025) return shade(GLS, 1.25);
    if (py > 0.031 && py < 0.036) return GLS;
    return null;
  }, 0, DY, 0, 40);
  lattice(0.585, 0.7, 12, 5, 0.0012, false);
  lathe(gp, [[0.015, 0], [0.014, 0.17], [0, 0.17]], CORE, 0, G + 0.585, 0, 10);
  // Tembo Galleria: slim glass ring with the spiral ramp, then the upper lattice and gain tower
  plathe(gp, 'sky-gal', [[0.024, -0.006], [0.033, 0.0], [0.034, 0.012], [0.032, 0.018], [0.024, 0.022], [0, 0.022]], WH, (px, py, pz, _nx, ny) => {
    if (ny < -0.5) return '#cfd6de';
    const a = Math.atan2(pz, px);
    return py > 0.002 && py < 0.013 ? (Math.floor((a / (Math.PI * 2)) * 24 + py * 120) % 4 === 0 ? '#e8edf2' : GLS) : null;
  }, 0, G + 0.7, 0, 32);
  lattice(0.722, 0.79, 9, 3, 0.0011, false);
  lathe(gp, [[0.013, 0], [0.012, 0.07], [0, 0.07]], CORE, 0, G + 0.722, 0, 10);
  let y = G + 0.79;
  const segs: [number, number, string][] = [[0.0105, 0.05, '#d7dde4'], [0.0092, 0.06, '#c7ced6'], [0.008, 0.05, '#d7dde4'], [0.007, 0.035, '#b9c1ca']];
  for (const [rad, h, c] of segs) {
    cyl(gp, c, 0, y, 0, rad, h, 12);
    for (let k = 1; k < 4; k++) cyl(gp, '#8d97a3', 0, y + (h * k) / 4, 0, rad + 0.0012, 0.003, 12);
    y += h;
  }
  lathe(gp, [[0.0085, 0], [0.0095, 0.006], [0.006, 0.012], [0.002, 0.016], [0, 0.018]], '#e5e9ee', 0, y, 0, 12);
  rod(gp, [0, y, 0], [0, y + 0.03, 0], 0.0012, '#c7ced6', 4);
  // Tokyo Solamachi: long glazed galleria wrapping the tower base, and the surrounding city blocks
  box(gp, '#b9c6d0', -0.2, G, 0.03, 0.26, 0.04, 0.07);
  box(gp, '#e6eaee', -0.2, G + 0.04, 0.03, 0.262, 0.004, 0.072);
  box(gp, '#b9c6d0', 0.17, G, 0.0, 0.18, 0.05, 0.08);
  box(gp, '#e6eaee', 0.17, G + 0.05, 0.0, 0.182, 0.004, 0.082);
  box(gp, '#c7d2da', 0.2, G, -0.06, 0.07, 0.15, 0.05);
  for (let k = 0; k < 7; k++) box(gp, '#5b7385', 0.2, G + 0.01 + k * 0.02, -0.0345, 0.066, 0.011, 0.001);
  for (let i = 0; i < 60; i++) {
    const x = -0.39 + hash3(i, 8, 1) * 0.78, z = -0.39 + hash3(i, 8, 2) * 0.78;
    if (Math.hypot(x, z) < 0.12 || Math.abs(z - 0.13 - 0.04 * Math.sin(x * 6)) < 0.035 || x + z * 0.4 > 0.3) continue;
    if (Math.abs(z - 0.02) < 0.06 && x > -0.34 && x < 0.27) continue;
    const h = 0.012 + hash3(i, 8, 3) ** 2 * 0.07, w = 0.03 + hash3(i, 8, 4) * 0.03, d = 0.03 + hash3(i, 8, 5) * 0.03;
    const c = ['#d6d3cc', '#c9ccd1', '#e4e1da', '#b8bec6', '#d9cfc0'][i % 5];
    box(gp, c, x, G, z, w, h, d);
    box(gp, shade(c, 0.85), x, G + h, z, w * 0.5, 0.004, d * 0.5);
  }
  // Bridges over the canal, trees along the promenade, a water bus on the Sumida
  for (const x of [-0.25, 0.05]) box(gp, '#d1d5db', x, G + 0.002, 0.13 + 0.04 * Math.sin(x * 6), 0.03, 0.004, 0.05);
  for (let i = 0; i < 16; i++) { const x = -0.38 + i * 0.045; lowball(gp, '#4d7c45', x, G + 0.008, 0.1 + 0.04 * Math.sin(x * 6), 0.022, 0.02, 0.022); }
  const bt = grp(gp, 0.3, 0.24, -0.4, G);
  box(bt, '#f1f5f9', 0, 0, 0, 0.07, 0.008, 0.016);
  box(bt, '#94a3b8', 0, 0.008, 0, 0.05, 0.006, 0.012);
};

// ---------------------------------------------------------------------------------------------------------
// Itsukushima — the great vermilion ryōbu torii in the sea, shrine corridors on stilts, five-storey pagoda

const itsukushima: Builder = (gp, r) => {
  const VER = r.color ?? '#d9452b', V2 = shade(VER, 0.85), BARK = '#4d4239', WALL = '#f4efe6', SEA = '#3f7f86';
  // Bay at the front, Miyajima's forested hill behind
  const hf: HFn = (x, z) => {
    const back = sstep(-0.12, -0.42, z + 0.05 * Math.sin(x * 5));
    return Math.max(0, back * (0.2 + 0.12 * Math.exp(-(((x - 0.12) / 0.3) ** 2))) + 0.02 * ridged(x * 6, z * 6) * back - 0.004);
  };
  island(gp, 0.5, hf, '#4c7a3e', (x, y, z, _nx, ny) => {
    const t = y - 0.035;
    if (t < 0.002) return sea(SEA)(x, y, z, 0, 1, 0) ?? SEA;
    if (t < 0.012) return ny > 0.8 ? '#bfae8a' : '#8a7a5e';
    return hash3(Math.floor(x * 40 + 50), 3, Math.floor(z * 40 + 50)) > 0.6 ? '#3f6e35' : ny < 0.6 ? '#556b3f' : null;
  }, { rings: 26, segs: 80, side: strataSide(['#2f6a72', '#285c63']) });
  const gy = onGround(hf);
  scatter(190, 13, (x, z, i) => {
    const h = hf(x, z);
    if (h < 0.02 || (x < -0.2 && x > -0.4 && z > -0.3 && z < -0.12)) return;
    const s = 0.035 + hash3(i, 1, 9) * 0.03;
    lowball(gp, ['#2f5e31', '#3d6e36', '#4f7d3a', '#557f44'][i % 4], x, gy(x, z) + s * 0.3, z, s, s * 0.8, s, i);
  }, 0.5);
  const SY = 0.035, DY = SY + 0.022;
  // Shrine deck on stilts with vermilion corridors (kairō) zig-zagging over the water
  const deck = (x: number, z: number, w: number, d: number, ry = 0) => {
    const dg = grp(gp, x, z, ry);
    box(dg, '#8a7660', 0, DY - 0.004, 0, w, 0.004, d);
    for (let i = 0; i <= Math.round(w / 0.03); i++) for (const sz of [-1, 1]) box(dg, '#3a3028', -w / 2 + (i * w) / Math.round(w / 0.03), SY - 0.004, sz * (d / 2 - 0.003), 0.003, DY - SY, 0.003);
  };
  const corridor = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), cg = grp(gp, (x0 + x1) / 2, (z0 + z1) / 2, ry);
    const W = 0.034, n = Math.max(1, Math.round(L / 0.026));
    box(cg, '#8a7660', 0, DY - 0.004, 0, L + W, 0.004, W);
    for (let i = 0; i <= n; i++) {
      const u = -L / 2 + (i * L) / n;
      for (const sz of [-1, 1]) {
        box(cg, '#3a3028', u, SY - 0.004, sz * W * 0.42, 0.003, DY - SY, 0.003);
        box(cg, VER, u, DY, sz * W * 0.42, 0.0035, 0.026, 0.0035);
      }
    }
    for (const sz of [-1, 1]) {
      box(cg, VER, 0, DY + 0.006, sz * W * 0.42, L, 0.0025, 0.002);
      box(cg, VER, 0, DY + 0.023, sz * W * 0.42, L, 0.004, 0.003);
    }
    // cypress-bark gable roof: two pitched planes, white bargeboards and a dark ridge
    const pitch = 0.5, half = (W + 0.014) / 2 / Math.cos(pitch);
    for (const sz of [-1, 1]) {
      box(cg, BARK, 0, DY + 0.0255 + Math.sin(pitch) * half * 0.5 - 0.002, sz * (W + 0.014) / 4, L + W, 0.004, half, 0, sz * pitch);
      box(cg, '#f3efe6', 0, DY + 0.0235, sz * (W + 0.014) / 2, L + W, 0.002, 0.002);
    }
    box(cg, '#2c2620', 0, DY + 0.026 + Math.sin(pitch) * half - 0.002, 0, L + W, 0.004, 0.005);
  };
  const hall = (x: number, z: number, w: number, d: number, h: number, ry = 0, rh = 0.03) => {
    const hg = grp(gp, x, z, ry);
    box(hg, '#8a7660', 0, DY - 0.004, 0, w + 0.01, 0.004, d + 0.01);
    for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) box(hg, '#3a3028', -w / 2 + (i * w) / 4, SY - 0.004, sz * d / 2, 0.003, DY - SY, 0.003);
    box(hg, WALL, 0, DY, 0, w * 0.86, h, d * 0.86);
    const nc = Math.max(2, Math.round(w / 0.022));
    for (let i = 0; i <= nc; i++) for (const sz of [-1, 1]) box(hg, VER, -w / 2 + (i * w) / nc, DY, sz * d / 2, 0.0045, h, 0.0045);
    for (let i = 0; i <= 2; i++) for (const sx of [-1, 1]) box(hg, VER, sx * w / 2, DY, -d / 2 + (i * d) / 2, 0.0045, h, 0.0045);
    box(hg, VER, 0, DY + h - 0.006, 0, w + 0.002, 0.006, d + 0.002);
    roof(hg, { y: DY + h, w: w + 0.03, d: d + 0.03, h: rh, ridge: w * 0.3, gable: 0.6, lift: 0.006, nr: 4, step: 0.012, k: 0.5, tile: BARK, rib: shade(BARK, 1.08), eave: '#e9e2d4', under: VER, ridgeC: '#2c2620', hipR: 0.0025 });
  };
  // Honden, heiden, haiden and haraiden along the axis, the hirabutai stage reaching toward the torii
  hall(0, -0.12, 0.13, 0.07, 0.035, 0, 0.035);
  hall(0, -0.05, 0.11, 0.05, 0.03, 0, 0.028);
  hall(0, 0.01, 0.14, 0.05, 0.026, 0, 0.026);
  deck(0, 0.08, 0.12, 0.08);
  for (const sx of [-1, 1]) {
    box(gp, VER, sx * 0.06, DY, 0.115, 0.004, 0.012, 0.004);
    box(gp, VER, sx * 0.03, DY, 0.12, 0.004, 0.012, 0.004);
  }
  for (let i = 0; i < 9; i++) box(gp, VER, -0.06 + i * 0.015, DY + 0.01, 0.12, 0.004, 0.002, 0.003);
  // Lantern-hung corridors: east and west wings stepping forward over the water
  corridor(-0.09, 0.0, -0.22, 0.0);
  corridor(-0.22, 0.0, -0.22, 0.12);
  corridor(-0.22, 0.12, -0.38, 0.12);
  corridor(0.09, 0.0, 0.22, 0.0);
  corridor(0.22, 0.0, 0.22, 0.1);
  corridor(0.22, 0.1, 0.36, 0.1);
  hall(-0.3, 0.04, 0.07, 0.05, 0.024, 0, 0.024);
  // Noh stage on the west side
  hall(0.32, 0.02, 0.06, 0.06, 0.03, 0, 0.026);
  for (const [x, z] of [[-0.15, 0.03], [-0.25, 0.08], [0.15, 0.03], [0.25, 0.06]] as const) box(gp, '#d6cfc2', x, SY, z + 0.03, 0.006, 0.025, 0.006);
  // The ō-torii: camphor main pillars braced by four support legs, double lintel and plaque
  const TZ = 0.31, PX = 0.082, TH = 0.25;
  for (const sx of [-1, 1]) {
    const x = sx * PX;
    cyl(gp, '#4a4a3c', x, SY - 0.002, TZ, 0.0135, 0.03, 12);
    cyl(gp, VER, x, SY + 0.028, TZ, 0.012, TH - 0.028, 12);
    cyl(gp, V2, x, SY + TH - 0.016, TZ, 0.0135, 0.014, 12);
    for (const sz of [-1, 1]) {
      const z = TZ + sz * 0.045;
      cyl(gp, '#4a4a3c', x, SY - 0.002, z, 0.0085, 0.02, 8);
      cyl(gp, VER, x, SY + 0.018, z, 0.0075, 0.12, 8);
      box(gp, '#2c2a26', x, SY + 0.138, z, 0.026, 0.004, 0.026);
      box(gp, VER, x, SY + 0.11, (TZ + z) / 2, 0.009, 0.012, 0.045);
      box(gp, VER, x, SY + 0.05, (TZ + z) / 2, 0.008, 0.01, 0.045);
      mbox(gp, '#c9a14a', x, SY + 0.122, z + sz * 0.0072, 0.006, 0.01, 0.002);
    }
  }
  // Nuki tie beam with wedges, then the shimaki and the upswept kasagi on top
  box(gp, VER, 0, SY + 0.178, TZ, 0.27, 0.018, 0.016);
  for (const sx of [-1, 1]) box(gp, VER, sx * PX, SY + 0.196, TZ, 0.03, 0.006, 0.02);
  box(gp, VER, 0, SY + 0.196, TZ, 0.012, 0.03, 0.01);
  box(gp, '#1d1a17', 0, SY + 0.198, TZ + 0.006, 0.026, 0.034, 0.004);
  mbox(gp, '#d9a93a', 0, SY + 0.2, TZ + 0.0085, 0.018, 0.026, 0.001);
  const lint = (y0: number, h: number, d: number, half: number, up: number, c: string, top: string) => {
    const rings: V3[][] = [];
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12, x = u * half, lift = up * Math.abs(u) ** 3;
      rings.push([[x, y0 + lift, TZ - d / 2], [x, y0 + lift, TZ + d / 2], [x, y0 + h + lift, TZ + d / 2 + 0.002], [x, y0 + h + lift + 0.003, TZ], [x, y0 + h + lift, TZ - d / 2 - 0.002]]);
    }
    skin(gp, rings, c, { caps: true, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny > 0.5 ? top : null) });
  };
  lint(SY + TH - 0.002, 0.016, 0.02, 0.17, 0.01, VER, VER);
  lint(SY + TH + 0.014, 0.012, 0.026, 0.19, 0.022, '#2b2a26', '#4f5a4c');
  // Five-storey pagoda (Gojū-no-tō) on the hill
  const PXp = -0.3, PZ = -0.2, py0 = gy(PXp, PZ) + 0.004;
  box(gp, '#cfc8b8', PXp, py0 - 0.02, PZ, 0.07, 0.03, 0.07);
  let yy = py0 + 0.01;
  for (let k = 0; k < 5; k++) {
    const w = 0.05 - k * 0.004, h = 0.022;
    box(gp, VER, PXp, yy, PZ, w, h, w);
    for (const sx of [-1, 1]) box(gp, WALL, PXp + sx * w * 0.25, yy + h * 0.25, PZ + w / 2 + 0.0005, w * 0.2, h * 0.5, 0.001);
    const R = roof(gp, { x: PXp, z: PZ, y: yy + h, w: w + 0.04, d: w + 0.04, h: 0.016, ridge: 0, lift: 0.006, nr: 3, step: 0.012, k: 0.5, upto: 0.62, tile: BARK, eave: '#e9e2d4', under: VER, hipR: 0.002 });
    yy = R.top;
  }
  rod(gp, [PXp, yy, PZ], [PXp, yy + 0.05, PZ], 0.0025, '#a37a2c', 6);
  for (let k = 0; k < 9; k++) gild(cyl(gp, '#c9a14a', PXp, yy + 0.012 + k * 0.0035, PZ, 0.0055, 0.0015, 8), '#c9a14a');
  // Stone lanterns along the beach, a ferry and visitors at low tide
  for (let i = 0; i < 8; i++) {
    const x = -0.44 + i * 0.03, z = -0.06 + i * 0.012;
    if (hf(x, z) > 0.03) continue;
    box(gp, '#b9b2a4', x, gy(x, z), z, 0.006, 0.014, 0.006);
    box(gp, '#a59e90', x, gy(x, z) + 0.014, z, 0.011, 0.004, 0.011);
  }
  const fb = grp(gp, 0.32, 0.36, 0.5, SY);
  box(fb, '#f8fafc', 0, 0, 0, 0.08, 0.01, 0.022);
  box(fb, '#1e3a8a', 0, 0.002, 0, 0.081, 0.002, 0.023);
  box(fb, '#e2e8f0', 0, 0.01, 0, 0.05, 0.01, 0.018);
};

// ---------------------------------------------------------------------------------------------------------
// Sheikh Zayed Grand Mosque — white marble domes, four minarets, floral courtyard and reflecting pools

const sheikhzayed: Builder = (gp, r) => {
  const gpRoot = gp;
  const MW = r.color ?? '#f8fafc', M2 = '#e6e7e3', GOLD = '#d9b04a', POOL = '#2b8fb5', G = 0.02;
  // Plaza paving, lawns and palms framing the mosque
  paved(gp, 0.98, 0.98, 0, G, '#e9e4d8', 0.05, 0, 0, (x, _y, z) => {
    const ax = Math.abs(x), az = Math.abs(z);
    const ci = Math.floor((x + 0.49) / 0.035), cj = Math.floor((z + 0.49) / 0.035);
    if (ax > 0.42 || az > 0.47) return (ci + cj) % 2 ? '#5f8f45' : '#6a9a4c';
    return hash3(ci, 1, cj) > 0.7 ? '#e0dacd' : null;
  }, 28);
  // Podium of the whole complex
  box(gp, '#dcd8ce', 0, G, -0.03, 0.66, 0.025, 0.86);
  box(gp, M2, 0, G + 0.025, -0.03, 0.668, 0.004, 0.868);
  const PY = G + 0.029;
  // Courtyard with its giant floral marble inlay
  const CX = 0.24, CZ0 = -0.14, CZ1 = 0.32;
  const cpg = new THREE.PlaneGeometry(CX * 2, CZ1 - CZ0, 36, 36);
  cpg.rotateX(-Math.PI / 2);
  add(gp, paintFaces(cpg, '#f6f5f1', (x, _y, z) => {
    const u = x / CX, v = (z / ((CZ1 - CZ0) / 2));
    const rr = Math.hypot(u * 1.2, v), a = Math.atan2(v, u);
    const petal = Math.abs(Math.sin(a * 6 + rr * 4));
    if (Math.abs(rr - 0.55 - 0.1 * petal) < 0.05) return '#c9a54a';
    if (rr < 0.45 && petal > 0.85 && rr > 0.15) return '#5f8a4f';
    if (rr < 0.12) return '#c9a54a';
    const cx = ((x / 0.05) % 1 + 1) % 1, cz = ((z / 0.05) % 1 + 1) % 1;
    if (rr > 0.85 && Math.hypot(cx - 0.5, cz - 0.5) < 0.22) return (Math.floor(x / 0.05) + Math.floor(z / 0.05)) % 2 ? '#a3b8a0' : '#d6c08a';
    return null;
  }), mat('#ffffff', { vc: true, flat: true, rough: 0.5 }), 0, PY + 0.001, (CZ0 + CZ1) / 2, 1, 1, 1);
  // Onion-profile domes (cached lathes) with gilded crescent finials
  const domeP = (R: number, H: number): [number, number][] => [[R * 0.98, 0], [R, H * 0.08], [R * 1.08, H * 0.3], [R * 1.06, H * 0.5], [R * 0.9, H * 0.7], [R * 0.6, H * 0.88], [R * 0.25, H * 0.98], [0, H]];
  const dome = (key: string, x: number, y: number, z: number, R: number, H: number, drumH: number, seg: number, gp: THREE.Object3D = gpRoot) => {
    if (drumH > 0) plathe(gp, key + 'd', [[R * 0.98, 0], [R * 0.98, drumH], [0, drumH]], MW, (_px, py) => (py > drumH * 0.85 ? M2 : null), x, y, z, seg);
    plathe(gp, key, domeP(R, H), MW, (_px, py, _pz, _nx, ny) => (ny < 0.2 && py < H * 0.12 ? M2 : null), x, y + drumH, z, seg, { rough: 0.35 });
    const top = y + drumH + H;
    gild(cyl(gp, GOLD, x, top - 0.001, z, R * 0.06 + 0.001, R * 0.25 + 0.004, 6), GOLD);
    gild(lowball(gp, GOLD, x, top + R * 0.25 + 0.005, z, R * 0.12 + 0.003), GOLD);
    const cr = add(gp, g('sz-crescent', () => new THREE.TorusGeometry(0.5, 0.13, 3, 8, Math.PI * 1.3)), mat(GOLD, { metal: 0.55, rough: 0.32 }), x, top + R * 0.42 + 0.01, z, R * 0.22 + 0.006, R * 0.22 + 0.006, R * 0.22 + 0.006, 0, 0, Math.PI * 0.85);
    cr.rotation.y = Math.PI / 2;
  };
  // Arcades: pointed-arch screens on slim columns with gilded palm capitals, small domes over the bays
  const arcade = (x0: number, z0: number, x1: number, z1: number, H: number, inward: number, domes: boolean) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), ag = grp(gp, (x0 + x1) / 2, (z0 + z1) / 2, ry, PY);
    const n = Math.max(2, Math.round(L / 0.032)), bw = L / n, D = 0.05;
    const holes: THREE.Path[] = [];
    for (let i = 0; i < n; i++) holes.push(archPath(-L / 2 + (i + 0.5) * bw, 0, bw * 0.74, H * 0.8, true));
    panel(ag, L, H, 0.006, MW, holes);
    box(ag, M2, 0, 0, -inward * D, L, H, 0.004);
    box(ag, '#f1efe9', 0, 0.0005, -inward * D / 2, L, 0.001, D);
    box(ag, MW, 0, H, -inward * D / 2, L + 0.004, 0.008, D + 0.006);
    box(ag, M2, 0, H + 0.008, -inward * D / 2, L + 0.006, 0.003, D + 0.01);
    for (let i = 0; i <= n; i++) {
      const u = -L / 2 + i * bw;
      gild(lowball(ag, GOLD, u, H * 0.55, 0.004 * inward, 0.012, 0.008, 0.006), GOLD);
      box(ag, '#c7cbc4', u, 0, 0.004 * inward, 0.006, H * 0.5, 0.002);
    }
    if (domes) for (let i = 0; i < n; i += 2) dome('sz-s', -L / 2 + (i + 0.5) * bw, H + 0.011, -inward * D / 2, 0.014, 0.022, 0, 10, ag);
  };
  const AH = 0.045;
  arcade(-CX, CZ1, CX, CZ1, AH, -1, true);
  arcade(-CX - 0.05, CZ0, -CX - 0.05, CZ1 + 0.05, AH, 1, true);
  arcade(CX + 0.05, CZ1 + 0.05, CX + 0.05, CZ0, AH, 1, true);
  // Reflecting pools along the outer arcades, with dark tiled floors
  for (const sx of [-1, 1]) {
    box(gp, '#1f4e63', sx * 0.37, PY - 0.004, 0.08, 0.08, 0.004, 0.46);
    add(gp, g('box', () => new THREE.BoxGeometry(1, 1, 1)), mat(POOL, { metal: 0.2, rough: 0.12 }), sx * 0.37, PY + 0.0005, 0.08, 0.072, 0.001, 0.45);
    for (let i = 0; i < 9; i++) box(gp, MW, sx * 0.33, PY, -0.13 + i * 0.05, 0.008, 0.002, 0.008);
  }
  // Main entrance portal on the east (front) side
  const eg = grp(gp, 0, CZ1 + 0.045, 0, PY);
  panel(eg, 0.12, 0.09, 0.03, MW, [archPath(0, 0, 0.06, 0.07, true)]);
  box(eg, M2, 0, 0.09, 0, 0.126, 0.006, 0.034);
  dome('sz-m2', -0.045, 0.096, 0, 0.022, 0.032, 0.01, 14, eg);
  dome('sz-m2', 0.045, 0.096, 0, 0.022, 0.032, 0.01, 14, eg);
  // Prayer hall block: arcaded façade, then the great dome ringed by secondary domes
  const HZ0 = -0.43, HZ1 = CZ0, HH = 0.09;
  box(gp, MW, 0, PY, (HZ0 + HZ1) / 2, 0.58, HH, HZ1 - HZ0);
  box(gp, M2, 0, PY + HH, (HZ0 + HZ1) / 2, 0.59, 0.005, HZ1 - HZ0 + 0.01);
  const fg = grp(gp, 0, HZ1 + 0.003, 0, PY);
  const fh: THREE.Path[] = [];
  for (let i = 0; i < 13; i++) fh.push(archPath(-0.27 + (i + 0.5) * (0.54 / 13), 0.005, 0.03, i === 6 ? 0.075 : 0.06, true));
  panel(fg, 0.56, HH, 0.006, MW, fh);
  box(gp, '#9fa9a8', 0, PY, HZ1 - 0.002, 0.54, HH * 0.85, 0.002);
  dome('sz-main', 0, PY + HH + 0.005, -0.29, 0.075, 0.13, 0.04, 40);
  for (const [x, z] of [[-0.14, -0.2], [0.14, -0.2], [-0.14, -0.38], [0.14, -0.38]] as const) dome('sz-m', x, PY + HH + 0.005, z, 0.04, 0.07, 0.022, 24);
  for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, -0.38], [0.24, -0.38], [0, -0.17], [0, -0.41], [-0.24, -0.29], [0.24, -0.29]] as const) dome('sz-m2', x, PY + HH + 0.005, z, 0.022, 0.034, 0.01, 14);
  // Four minarets at the corners of the courtyard: square base, fluted octagonal shaft, balconies, gilded lantern
  for (const [x, z] of [[-CX - 0.07, CZ0 - 0.01], [CX + 0.07, CZ0 - 0.01], [-CX - 0.07, CZ1 + 0.07], [CX + 0.07, CZ1 + 0.07]] as const) {
    box(gp, MW, x, PY, z, 0.04, 0.09, 0.04);
    box(gp, M2, x, PY + 0.09, z, 0.044, 0.005, 0.044);
    const shaft: [number, number][] = [[0.014, 0], [0.014, 0.12], [0.02, 0.124], [0.02, 0.13], [0.0125, 0.132], [0.012, 0.21], [0.018, 0.213], [0.018, 0.22], [0.0105, 0.222], [0.0105, 0.25], [0.014, 0.252], [0.014, 0.256], [0.008, 0.258], [0.008, 0.274], [0, 0.274]];
    plathe(gp, 'sz-minaret', shaft, MW, (px, py, pz, _nx, ny) => {
      if (ny > 0.5 || ny < -0.5) return M2;
      if (py > 0.258) return Math.floor(((Math.atan2(pz, px) + Math.PI) / (Math.PI * 2)) * 8) % 2 ? '#b8c2c4' : null;
      return Math.floor(((Math.atan2(pz, px) + Math.PI) / (Math.PI * 2)) * 16) % 2 ? null : '#eceeeb';
    }, x, PY + 0.095, z, 16);
    dome('sz-mt', x, PY + 0.095 + 0.274, z, 0.009, 0.016, 0, 10);
  }
  // Palms along the approach avenue, visitors in white and black
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) palm(gp, sx * 0.445, G, -0.36 + i * 0.17, 0.065, i * 2 + (sx > 0 ? 1 : 0));
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) palm(gp, sx * (0.1 + i * 0.09), G, 0.455, 0.055, i + 30);
  for (let i = 0; i < 14; i++) person(gp, -0.2 + hash3(i, 6, 1) * 0.4, PY, -0.1 + hash3(i, 6, 2) * 0.4, i % 3 ? '#f8fafc' : '#111827');
};

// ---------------------------------------------------------------------------------------------------------
// Ha Long Bay — steep limestone karst towers with jungle crowns, wave-cut notches and batwing-sailed junks

/**
 * A karst tower: fluted, slightly leaning limestone column with a wave-cut notch at the waterline, sheer streaked
 * cliffs and a ragged, jungle-capped crown.
 */
function karst(p: THREE.Object3D, x: number, z: number, R: number, H: number, seed: number, W: number): void {
  const segs = 20, fs = [-0.02, 0.0, 0.02, 0.06, 0.25, 0.45, 0.62, 0.76, 0.86, 0.93, 0.98, 1.0];
  const prof = (f: number) => (f < 0 ? 1.0 : f < 0.03 ? 0.8 : f < 0.07 ? 0.92 : f < 0.65 ? 1.0 - 0.06 * Math.sin(f * 7) : f < 0.8 ? 0.94 : f < 0.88 ? 0.86 : f < 0.95 ? 0.72 : f < 0.99 ? 0.5 : 0.2);
  const flute = Array.from({ length: segs }, (_, j) => 0.86 + 0.28 * hash3(j, seed, 5));
  const lean = (hash3(seed, 1, 2) - 0.5) * 0.25, la = hash3(seed, 2, 2) * Math.PI * 2;
  const rings = fs.map(f => Array.from({ length: segs }, (_, j) => {
    const a = (j / segs) * Math.PI * 2;
    const rr = R * prof(f) * flute[j] * (0.72 + 0.56 * fbm(Math.cos(a) * 1.3 + seed, Math.max(0, f) * 1.8, Math.sin(a) * 1.3 + seed * 1.7, 2));
    const top = f > 0.8 ? (fbm(Math.cos(a) * 2 + seed, 5, Math.sin(a) * 2) - 0.5) * H * 0.22 * (f - 0.8) * 5 : 0;
    const off = lean * Math.max(0, f) * H;
    return [x + Math.cos(a) * rr + Math.cos(la) * off, W + f * H + top, z + Math.sin(a) * rr + Math.sin(la) * off] as V3;
  }));
  skin(p, rings, '#9a958a', {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      const f = (py - W) / H;
      if (f < 0.03) return '#3f3d38';
      if (ny > 0.5 || f > 0.9) return hash3(Math.floor(px * 120), seed, Math.floor(pz * 120)) > 0.45 ? '#3f6b35' : '#4f7d3c';
      const col = Math.floor(((Math.atan2(pz - z, px - x) + Math.PI) / (Math.PI * 2)) * segs) % segs;
      const h = hash3(col, seed, Math.floor(f * 4)), h2 = hash3(col, seed, 9);
      if (ny > 0.15 || (f > 0.6 && h > 0.6)) return '#55753f';
      if (h2 > 0.8) return '#56544c';
      if (h < 0.22) return '#7a766b';
      return h > 0.7 ? '#c4baa4' : h > 0.5 ? '#aaa597' : null;
    },
  });
  // Jungle tufts on the crown and clinging to ledges
  const n = Math.round(5 + R * 70);
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 1) * Math.PI * 2, d = Math.sqrt(hash3(i, seed, 2)) * R * 0.75, s = R * (0.3 + hash3(i, seed, 3) * 0.3);
    lowball(p, ['#3f6b35', '#55803f', '#2f5a2c'][i % 3], x + Math.cos(a) * d + Math.cos(la) * lean * H * 0.95, W + H * (0.92 + hash3(i, seed, 4) * 0.06), z + Math.sin(a) * d + Math.sin(la) * lean * H * 0.95, s, s * 0.6, s, a);
  }
  for (let i = 0; i < 4; i++) {
    const a = hash3(i, seed, 7) * Math.PI * 2, f = 0.3 + hash3(i, seed, 8) * 0.5, rr = R * 0.95;
    lowball(p, '#4f7d3c', x + Math.cos(a) * rr + Math.cos(la) * lean * f * H, W + H * f, z + Math.sin(a) * rr + Math.sin(la) * lean * f * H, R * 0.28, R * 0.16, R * 0.28, a);
  }
}

/** Ha Long junk: dark wooden hull, deckhouse and orange batwing sails with bamboo battens. */
function junk(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number): void {
  const jg = grp(p, x, z, ry, y);
  jg.scale.setScalar(s);
  sweep(jg, [{ p: [-0.07, 0.016, 0], w: 0.004, h: 0.004 }, { p: [-0.05, 0.008, 0], w: 0.016, h: 0.008 }, { p: [0.02, 0.006, 0], w: 0.018, h: 0.008 }, { p: [0.065, 0.014, 0], w: 0.008, h: 0.006 }, { p: [0.08, 0.022, 0], w: 0.002, h: 0.003 }], '#5a3a24', { radial: 8, sub: 3, up: [0, 1, 0] });
  box(jg, '#7a5236', -0.01, 0.012, 0, 0.07, 0.012, 0.022);
  box(jg, '#f1e7d0', -0.005, 0.024, 0, 0.045, 0.004, 0.024);
  for (const [mx, h, w] of [[0.035, 0.07, 0.045], [-0.005, 0.09, 0.055], [-0.045, 0.06, 0.04]] as const) {
    rod(jg, [mx, 0.012, 0], [mx, 0.012 + h + 0.006, 0], 0.0014, '#3a2a1c', 4);
    const sg = grp(jg, mx - w * 0.15, 0, 0, 0.026);
    const sail = slab(sg, [[0, 0], [w * 0.55, 0], [w * 0.75, h * 0.35], [w * 0.7, h * 0.75], [w * 0.35, h], [-w * 0.1, h * 0.92], [-w * 0.2, h * 0.5]], 0.0015, '#d9692b', 0, false);
    sail.material = mat('#d9692b', { flat: true });
    for (let k = 1; k <= 4; k++) box(sg, '#7a3a1a', w * 0.25, (h * k) / 5, 0.001, w * 0.95, 0.0015, 0.003);
  }
}

const halong: Builder = (gp, r) => {
  const EM = r.color ? mix(r.color, '#2f8c84', 0.8) : '#2f8c84', W = 0.035, CELL = 1 / 40;
  island(gp, 0.5, () => 0, EM, (x, _y, z) => {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL), f = fbm(x * 5, 0, z * 5, 2);
    if (Math.sin(x * 50 + Math.sin(z * 20) * 2) > 0.97) return '#7fc0b4';
    const h = hash3(ci, 3, cj);
    return f > 0.56 ? '#38998a' : f < 0.42 ? '#26776f' : h > 0.8 ? shade(EM, 1.06) : null;
  }, { rings: 20, segs: 72, side: strataSide(['#2a6f6c', '#235f5d']) });
  // Clusters of towers: each islet is two or three merged columns of different heights
  const isl: [number, number, number, number, number][] = [
    [-0.08, -0.06, 0.085, 0.46, 3], [-0.01, -0.1, 0.06, 0.36, 4], [-0.14, 0.0, 0.05, 0.3, 6],
    [0.18, -0.17, 0.075, 0.34, 7], [0.24, -0.12, 0.05, 0.26, 8],
    [-0.29, -0.2, 0.07, 0.3, 11], [-0.34, -0.13, 0.045, 0.22, 12],
    [0.31, 0.1, 0.055, 0.22, 5], [-0.31, 0.15, 0.045, 0.17, 9], [0.08, 0.17, 0.035, 0.12, 2],
    [0.36, -0.3, 0.045, 0.2, 13], [-0.1, -0.36, 0.055, 0.24, 17], [0.06, -0.33, 0.04, 0.18, 19],
  ];
  for (const [x, z, R, H, seed] of isl) karst(gp, x, z, R, H, seed, W);
  // Rubble at the foot of the cliffs
  for (let i = 0; i < 10; i++) {
    const [x, z, R] = isl[i % isl.length], a = hash3(i, 2, 1) * Math.PI * 2;
    lowball(gp, '#9a968a', x + Math.cos(a) * R * 1.05, W, z + Math.sin(a) * R * 1.05, 0.02, 0.012, 0.016, a);
  }
  // Junks with orange batwing sails, a small sampan and its wake
  junk(gp, 0.1, W - 0.004, 0.36, 0.3, 1.0);
  junk(gp, -0.25, W - 0.004, 0.3, -0.5, 0.85);
  junk(gp, 0.33, W - 0.004, -0.02, 1.2, 0.7);
  const sp = grp(gp, -0.05, 0.4, 0.8, W);
  box(sp, '#4a3322', 0, -0.002, 0, 0.04, 0.006, 0.01);
  box(sp, '#2563eb', 0, 0.004, 0, 0.014, 0.004, 0.011);
  void r;
};

export const ASIA2: Record<string, Builder> = { potala, templeofheaven, marinabay, borobudur, shwedagon, skytree, itsukushima, sheikhzayed, halong };
