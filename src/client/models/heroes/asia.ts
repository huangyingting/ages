import { human, passerby } from '../human.ts';
import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, mat, box, cyl, ball, rbox, rod, sweep, lathe, slab, skin, tbox,
  shade, mix, fbm, hash3,
} from '../prims.ts';
import { type HFn, island, sstep, ridged, ripple, strataSide, EARTH, scatter, onGround, pine } from '../nature.ts';

// Hero builders for: forbidden, gyeongbok, kinkakuji, angkor, taipei101, petronas, greatwall, namsan.
// Keyed by catalogue item key (recipe.hero). Front faces +z, base at y=0, footprint radius ≈0.5.

// ---------------------------------------------------------------------------------------------------------
// Shared East-Asian timber-architecture kit

/** Child group placed at (x, z) and turned by ry — lets axis-aligned helpers build rotated wings. */
function grp(p: THREE.Object3D, x: number, z: number, ry = 0, y = 0): THREE.Group {
  const gr = new THREE.Group();
  gr.position.set(x, y, z);
  gr.rotation.y = ry;
  p.add(gr);
  return gr;
}

/** Paved slab of size w×d (flagstones with per-cell tonal variation) on a plinth of thickness th. */
function paved(p: THREE.Object3D, w: number, d: number, y: number, th: number, c: string, cell: number, x = 0, z = 0, paint?: Paint): void {
  const pg = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(d / cell)));
  pg.rotateX(-Math.PI / 2);
  const def: Paint = (px, _py, pz) => {
    const h = hash3(Math.floor(px / cell + 500.5), 3, Math.floor(pz / cell + 500.5));
    return h > 0.72 ? shade(c, 1.06) : h < 0.22 ? shade(c, 0.92) : null;
  };
  add(p, paintFaces2(pg, c, paint ?? def), mat('#ffffff', { vc: true, flat: true, rough: 0.9 }), x, y + th, z, 1, 1, 1);
  if (th > 0.0005) box(p, shade(c, 0.82), x, y, z, w, th, d);
}
import { paintFaces as paintFaces2 } from '../prims.ts';

/** Tiny visitor for scale. */
function person(p: THREE.Object3D, x: number, y: number, z: number, c: string, s = 1): void {
  passerby(p, x, y, z, 0.018 * s, 1, { top: c });
}

/** Balustrade: square posts with a continuous rail between a and b. */
function rail(p: THREE.Object3D, a: [number, number], b: [number, number], y: number, h: number, c: string, sp = 0.022, heads = false): void {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  if (L < 0.004) return;
  const n = Math.max(1, Math.round(L / sp)), ry = -Math.atan2(dz, dx);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + (dx * i) / n, z = a[1] + (dz * i) / n;
    box(p, c, x, y, z, 0.0055, h * 1.15, 0.0055, ry);
    if (heads && i % 2 === 0) {
      const nx = -dz / L, nz = dx / L; // outward normal (left of a→b for CCW rects)
      box(p, shade(c, 0.9), x - nx * 0.006, y - 0.006, z - nz * 0.006, 0.004, 0.0035, 0.009, ry + Math.PI / 2);
    }
  }
  box(p, c, a[0] + dx / 2, y + h * 0.62, a[1] + dz / 2, L, h * 0.22, 0.0035, ry);
  box(p, c, a[0] + dx / 2, y + h * 0.08, a[1] + dz / 2, L, h * 0.16, 0.0035, ry);
}

/** Rectangle balustrade (centre cx,cz, size w×d) with an optional front opening [-gap, gap]. */
function railRect(p: THREE.Object3D, cx: number, cz: number, w: number, d: number, y: number, h: number, c: string, gap = 0, sp = 0.022, heads = false, backGap = 0): void {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  if (gap > 0) { rail(p, [x0, z1], [cx - gap, z1], y, h, c, sp, heads); rail(p, [cx + gap, z1], [x1, z1], y, h, c, sp, heads); }
  else rail(p, [x0, z1], [x1, z1], y, h, c, sp, heads);
  rail(p, [x1, z1], [x1, z0], y, h, c, sp, heads);
  if (backGap > 0) { rail(p, [x1, z0], [cx + backGap, z0], y, h, c, sp, heads); rail(p, [cx - backGap, z0], [x0, z0], y, h, c, sp, heads); }
  else rail(p, [x1, z0], [x0, z0], y, h, c, sp, heads);
  rail(p, [x0, z0], [x0, z1], y, h, c, sp, heads);
}

/** Solid flight of n steps rising toward -z from (x, y0, zFront) to y1 over the run. */
function flight(p: THREE.Object3D, x: number, zFront: number, y0: number, y1: number, w: number, run: number, c: string, n = 6): void {
  const rise = (y1 - y0) / n, dz = run / n;
  for (let i = 0; i < n; i++) box(p, i % 2 ? c : shade(c, 0.96), x, y0, zFront - (i + 0.5) * dz, w, rise * (i + 1), dz);
}

/** Sloped carved ramp slab (imperial "dragon way") laid over a flight. */
function ramp(p: THREE.Object3D, x: number, zFront: number, y0: number, y1: number, w: number, run: number, c: string, relief: string): void {
  const L = Math.hypot(run, y1 - y0), a = Math.atan2(y1 - y0, run);
  add(p, BOXG(), mat(c), x, (y0 + y1) / 2 + 0.003, zFront - run / 2, w, 0.005, L, 0, a);
  add(p, BOXG(), mat(relief), x, (y0 + y1) / 2 + 0.0055, zFront - run / 2, w * 0.7, 0.002, L * 0.86, 0, a);
}
const BOXG = () => new THREE.BoxGeometry(1, 1, 1);

interface RoofO {
  x?: number; z?: number; y: number; w: number; d: number; h: number;
  /** Ridge half-length (final half-width at the top). 0 = pyramidal, w/2 = plain gable. */
  ridge: number;
  /** Hip-and-gable: fraction of the rise at which the hips stop and the gable triangle starts. */
  gable?: number;
  /** Stop the roof at this fraction of its rise (lower eave "skirt" of a double roof). */
  upto?: number;
  lift?: number; spanF?: number; k?: number; step?: number; nr?: number; th?: number;
  tile: string; rib?: string; eave?: string; under?: string; gableC?: string; ridgeC?: string;
  ridgeH?: number; hipR?: number; beasts?: number; beastC?: string; ends?: 'chiwen' | 'korean' | 'none';
}
/**
 * Curved East-Asian roof: concave hip (庑殿), hip-and-gable (歇山/팔작) or pyramidal roof with upturned eave
 * corners, painted tile ribs, painted rafters under the eaves, hip ridges and optional ridge beasts.
 */
function roof(p: THREE.Object3D, o: RoofO): { top: number; yAt: (t: number) => number } {
  const X = o.x ?? 0, Z = o.z ?? 0, W = o.w, D = o.d, g = o.gable ?? 1, upto = o.upto ?? 1, k = o.k ?? 0.6;
  const step = o.step ?? 0.012, nr = o.nr ?? 7, lift = o.lift ?? 0.025, th = o.th ?? 0.008;
  const span = Math.min(W, D) * (o.spanF ?? 0.42);
  const hwAt = (t: number) => W / 2 - (W / 2 - o.ridge) * Math.min(1, t / g);
  const hdAt = (t: number) => (D / 2) * (1 - t);
  const yAt = (t: number) => o.y + o.h * (t * (1 - k) + k * t * t);
  const nf = Math.max(2, Math.round(W / step)), ns = Math.max(2, Math.round(D / step));
  const P = (t: number, x: number, z: number, dy = 0): V3 => {
    const hw = hwAt(t), hd = hdAt(t);
    const dc = Math.hypot(hw - Math.abs(x), hd - Math.abs(z));
    const c = Math.max(0, 1 - dc / span) ** 2 * Math.max(0, 1 - t / Math.max(0.3, g)) ** 1.4;
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
  const yG = yAt(Math.min(g, upto)), hwG = hwAt(g);
  skin(p, rings, tile, {
    caps: true, flat: true,
    paint: (x, y, z, nx, ny, nz) => {
      if (ny < -0.35) return under;
      if (Math.abs(ny) < 0.3) return g < 1 && y > yG - 0.002 && Math.abs(Math.abs(x - X) - hwG) < 0.006 ? gc : eave;
      const col = Math.abs(nz) >= Math.abs(nx) ? Math.floor((x - X + W / 2) / (W / nf) + 1e-3) : Math.floor((z - Z + D / 2) / (D / ns) + 1e-3);
      return col % 2 ? rib : hash3(col, Math.floor(y * 300), 1) > 0.85 ? shade(ch, 1.05) : ch;
    },
  });
  // Hip ridges (and gable-edge ridges for hip-and-gable roofs)
  const rc = o.ridgeC ?? shade(tile, 1.08), hr = o.hipR ?? 0.0045, tEnd = Math.min(g, upto);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const st: { p: V3; w: number }[] = [];
    for (let i = 0; i <= 5; i++) { const t = (tEnd * i) / 5; st.push({ p: P(t, sx * hwAt(t), sz * hdAt(t), hr * 0.6), w: hr }); }
    sweep(p, st, rc, { radial: 6, sub: 3, flat: true });
    if (g < 1 && upto >= 1) {
      const gs: { p: V3; w: number }[] = [];
      for (let i = 0; i <= 4; i++) { const t = g + ((1 - g) * i) / 4; gs.push({ p: P(t, sx * hwG, sz * hdAt(t), hr * 0.6), w: hr * 0.9 }); }
      sweep(p, gs, rc, { radial: 6, sub: 3, flat: true });
    }
    for (let b = 0; b < (o.beasts ?? 0); b++) {
      const t = 0.03 + b * 0.035, q = P(t, sx * hwAt(t), sz * hdAt(t), hr * 1.6);
      box(p, o.beastC ?? rc, q[0], q[1], q[2], 0.005, 0.007 - b * 0.0004, 0.005, sx * sz * Math.PI / 4);
    }
  }
  const top = yAt(upto);
  if (upto >= 1 && o.ridge > 0.001) {
    const rh = o.ridgeH ?? 0.012;
    box(p, rc, X, top - rh * 0.3, Z, o.ridge * 2 + 0.01, rh, hr * 2.6);
    box(p, shade(rc, 0.85), X, top + rh * 0.7, Z, o.ridge * 2 + 0.006, rh * 0.25, hr * 1.6);
    for (const sx of [-1, 1]) {
      if (o.ends === 'chiwen') {
        const s = rh * 3;
        const cw = slab(p, [[0, 0], [0.42, 0], [0.5, 0.45], [0.32, 0.9], [0.05, 1.05], [-0.12, 0.85], [0.08, 0.7], [0.05, 0.35]].map(([a, b]) => [sx * a * s, b * s] as [number, number]), hr * 2.4, o.beastC ?? rc, 0.001);
        cw.position.set(X + sx * (o.ridge - s * 0.1), top - rh * 0.3, Z);
      } else if (o.ends === 'korean') {
        rbox(p, '#4b524e', X + sx * (o.ridge + 0.002), top - rh * 0.3, Z, 0.012, rh * 2.2, hr * 2.8, 0.002);
      }
    }
  }
  return { top, yAt };
}

/** Bracket-set frieze (dougong / gongpo) around a rectangle: painted beam plus a row of small blocks. */
function brackets(p: THREE.Object3D, cx: number, cz: number, w: number, d: number, y: number, beam: string, blk: string, accent: string, sp = 0.02): void {
  box(p, beam, cx, y, cz, w, 0.009, d);
  box(p, accent, cx, y + 0.0035, cz + d / 2 + 0.0004, w * 0.98, 0.002, 0.001);
  box(p, accent, cx, y + 0.017, cz, w + 0.012, 0.003, d + 0.012);
  const nw = Math.round(w / sp), nd = Math.round(d / sp);
  for (let i = 0; i <= nw; i++) for (const sz of [-1, 1]) box(p, blk, cx - w / 2 + (i * w) / nw, y + 0.009, cz + sz * (d / 2 + 0.002), 0.009, 0.008, 0.012);
  for (let i = 1; i < nd; i++) for (const sx of [-1, 1]) box(p, blk, cx + sx * (w / 2 + 0.002), y + 0.009, cz - d / 2 + (i * d) / nd, 0.012, 0.008, 0.009);
}

/** Colonnade of round columns around a rectangle (n bays across, m bays deep), with plinth stones. */
function columns(p: THREE.Object3D, cx: number, cz: number, w: number, d: number, n: number, m: number, y: number, h: number, c: string, r = 0.0075, base = '#d8d2c4'): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([cx - w / 2 + (i * w) / n, cz + d / 2], [cx - w / 2 + (i * w) / n, cz - d / 2]);
  for (let j = 1; j < m; j++) pts.push([cx - w / 2, cz - d / 2 + (j * d) / m], [cx + w / 2, cz - d / 2 + (j * d) / m]);
  for (const [x, z] of pts) {
    box(p, base, x, y, z, r * 2.6, 0.004, r * 2.6);
    cyl(p, c, x, y + 0.004, z, r, h - 0.004, 8);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Forbidden City — Hall of Supreme Harmony (太和殿, rebuilt 1695). Proportioned from the measured hall
// (11 × 5 bays, 60 × 33 m, 26.9 m tall on the 8.1 m three-tier marble 三台) at ≈0.0073 per metre: red
// columns and walls, 菱花 lattice doors behind a front gallery, blue-green 和玺 bracket friezes, a double-eaved
// 庑殿 roof in yellow glaze with 正吻 and ridge beasts. The court is lined by yellow-roofed 廊庑 with
// 体仁阁/弘义阁 at mid-flank; officials in Qing court dress stand by the bronze 品级山 rank markers.
const forbidden: Builder = gp => {
  const GOLD = '#c99a3a', RED = '#8e2a1f', WALL = '#94382a', DOOR = '#9a3a26', LAT = '#c39539';
  const M = '#e6e2d8', M2 = '#cfc9bb', BLUE = '#2c5560', GRN = '#3a6b55', BR = '#4c4232';
  const RT = { tile: GOLD, rib: shade(GOLD, 1.06), eave: shade(GOLD, 0.8), under: '#2d5a55', ridgeC: shade(GOLD, 1.02), beastC: '#b98a2c' };
  const Y0 = 0.022;
  // Brick-paved court and the white stone imperial way
  paved(gp, 0.9, 0.9, 0, Y0, '#9d968a', 0.04);
  paved(gp, 0.09, 0.27, Y0, 0.002, '#c3bcac', 0.03, 0, 0.315);
  // Flanking corridors (廊庑): red back wall, open colonnade toward the court, yellow hip-and-gable roof
  for (const sx of [-1, 1]) {
    const c = grp(gp, sx * 0.402, -0.01, Math.PI / 2);
    box(c, M2, 0, Y0, 0, 0.84, 0.004, 0.06);
    box(c, WALL, 0, Y0, sx * 0.016, 0.82, 0.04, 0.012);
    for (let i = 0; i <= 20; i++) cyl(c, RED, -0.41 + i * 0.041, Y0, -sx * 0.02, 0.0032, 0.04, 6);
    box(c, BLUE, 0, Y0 + 0.04, 0, 0.82, 0.005, 0.05);
    roof(c, { y: Y0 + 0.045, w: 0.85, d: 0.075, h: 0.032, ridge: 0.4, gable: 0.45, lift: 0.006, nr: 5, ...RT, gableC: WALL, hipR: 0.0025, ridgeH: 0.004 });
    // 体仁阁 (east) / 弘义阁 (west): two storeys, pent roof, hip roof — set into the corridor line
    const g = grp(gp, sx * 0.392, 0.08, Math.PI / 2);
    box(g, M2, 0, Y0, 0, 0.17, 0.012, 0.07);
    box(g, WALL, 0, Y0 + 0.012, 0, 0.15, 0.04, 0.05);
    for (let i = 0; i <= 7; i++) cyl(g, RED, -0.075 + i * 0.0214, Y0 + 0.012, -sx * 0.029, 0.0034, 0.04, 6);
    box(g, BLUE, 0, Y0 + 0.052, 0, 0.16, 0.005, 0.062);
    roof(g, { y: Y0 + 0.057, w: 0.18, d: 0.085, h: 0.05, ridge: 0.05, upto: 0.4, lift: 0.006, nr: 3, ...RT, hipR: 0.0022 });
    box(g, WALL, 0, Y0 + 0.06, 0, 0.14, 0.04, 0.046);
    for (let i = 0; i < 7; i++) box(g, DOOR, -0.06 + i * 0.02, Y0 + 0.074, -sx * 0.0235, 0.014, 0.018, 0.002);
    box(g, BLUE, 0, Y0 + 0.1, 0, 0.15, 0.005, 0.056);
    roof(g, { y: Y0 + 0.105, w: 0.175, d: 0.08, h: 0.04, ridge: 0.05, lift: 0.008, nr: 4, ...RT, hipR: 0.0024, ridgeH: 0.005, beasts: 3 });
  }
  box(gp, WALL, 0, Y0, -0.425, 0.77, 0.045, 0.018);
  roof(gp, { y: Y0 + 0.045, z: -0.425, w: 0.79, d: 0.04, h: 0.018, ridge: 0.38, lift: 0.003, nr: 3, ...RT, hipR: 0.0022, ridgeH: 0.004 });
  // 三台: three white marble 须弥座 tiers with balustrades, 螭首 spouts and front stairs with the carved 御路
  const TZ = -0.08, tw = [0.68, 0.62, 0.56], td = [0.56, 0.5, 0.44], TH = 0.019;
  for (let k = 0; k < 3; k++) {
    const y = Y0 + k * TH, fz = TZ + td[k] / 2;
    box(gp, M2, 0, y, TZ, tw[k], 0.005, td[k]);
    box(gp, M, 0, y + 0.005, TZ, tw[k] - 0.008, TH - 0.01, td[k] - 0.008);
    box(gp, shade(M, 1.02), 0, y + TH - 0.005, TZ, tw[k] + 0.005, 0.005, td[k] + 0.005);
    railRect(gp, 0, TZ, tw[k] - 0.008, td[k] - 0.008, y + TH, 0.011, M, 0.06, 0.024, true);
    for (let i = 0; i <= 12; i++) box(gp, M2, -tw[k] / 2 + (i * tw[k]) / 12, y + TH - 0.007, fz + 0.004, 0.004, 0.004, 0.008);
    flight(gp, 0, fz + 0.03, y, y + TH, 0.11, 0.03, M2, 5);
    ramp(gp, 0, fz + 0.03, y, y + TH, 0.042, 0.03, '#dcd6c8', '#c9c0ad');
    for (const sx of [-1, 1]) rod(gp, [sx * 0.056, y + 0.01, fz + 0.03], [sx * 0.056, y + TH + 0.01, fz], 0.002, M, 4);
  }
  const TY = Y0 + 3 * TH;
  // Bronze on the 丹陛 terrace: gilt vats, 鼎 burners, turtle and crane, 日晷 sundial (east) and 嘉量 (west)
  for (const sx of [-1, 1]) {
    lathe(gp, [[0.006, 0], [0.013, 0.003], [0.015, 0.012], [0.013, 0.018], [0, 0.018]], '#6a5432', sx * 0.25, TY, 0.06, 10);
    lathe(gp, [[0.006, 0], [0.005, 0.008], [0.009, 0.011], [0.009, 0.019], [0.003, 0.024], [0, 0.03]], BR, sx * 0.15, TY, 0.1, 8);
    ball(gp, BR, sx * 0.09, TY + 0.005, 0.1, 0.008, 0.006, 0.011);
    cyl(gp, BR, sx * 0.07, TY, 0.08, 0.0018, 0.016, 4);
    ball(gp, BR, sx * 0.07, TY + 0.018, 0.08, 0.004, 0.005, 0.006);
  }
  box(gp, M2, 0.2, TY, 0.105, 0.014, 0.012, 0.014);
  add(gp, CYLG(), mat(M), 0.2, TY + 0.017, 0.105, 0.022, 0.003, 0.022, 0, -0.7);
  box(gp, M2, -0.2, TY, 0.105, 0.012, 0.012, 0.012);
  box(gp, '#5f5236', -0.2, TY + 0.012, 0.105, 0.016, 0.01, 0.01);
  // The hall: front gallery with columns standing clear of the lattice doors; solid side and rear walls
  const HZ = TZ - 0.04, CW = 0.44, CD = 0.245, CH = 0.05;
  rbox(gp, M2, 0, TY, HZ, CW + 0.04, 0.005, CD + 0.04, 0.002);
  const HY = TY + 0.005, zF = HZ + CD / 2 - 0.022, zB = HZ - CD / 2 + 0.003;
  box(gp, WALL, 0, HY, (zF + zB) / 2, CW - 0.004, CH, zF - zB);
  const bay = CW / 11;
  for (let i = 0; i < 11; i++) {
    const xc = -CW / 2 + (i + 0.5) * bay, end = i === 0 || i === 10;
    if (end) box(gp, '#7c2a1e', xc, HY, zF + 0.001, bay - 0.006, 0.018, 0.002);
    box(gp, DOOR, xc, HY + (end ? 0.018 : 0.002), zF + 0.001, bay - 0.007, end ? 0.026 : 0.042, 0.002);
    for (const yy of end ? [0.026, 0.036] : [0.012, 0.026, 0.036]) box(gp, LAT, xc, HY + yy, zF + 0.0025, bay - 0.009, 0.002, 0.0015);
  }
  columns(gp, 0, HZ, CW, CD, 11, 5, HY, CH, RED, 0.0052, M);
  for (let i = 1; i < 11; i++) cyl(gp, RED, -CW / 2 + i * bay, HY, zF + 0.003, 0.0045, CH, 6);
  box(gp, BLUE, 0, HY + CH, HZ, CW + 0.012, 0.007, CD + 0.012);
  box(gp, LAT, 0, HY + CH + 0.003, HZ + CD / 2 + 0.0065, CW + 0.008, 0.0015, 0.001);
  brackets(gp, 0, HZ, CW + 0.012, CD + 0.012, HY + CH + 0.007, GRN, '#2f5f4c', LAT, 0.016);
  const E1 = HY + CH + 0.025;
  roof(gp, { y: E1, z: HZ, w: CW + 0.08, d: CD + 0.08, h: 0.1, ridge: 0.14, upto: 0.47, lift: 0.016, nr: 5, ...RT, hipR: 0.0035, beasts: 5 });
  // Upper storey (inner 9 × 3 bays) between the eaves, its frieze and the upper 庑殿 roof with 正吻
  const UW = CW - 0.08, UD = CD - 0.09;
  box(gp, WALL, 0, E1 + 0.01, HZ, UW, 0.038, UD);
  for (let i = 0; i < 9; i++) box(gp, DOOR, -UW / 2 + (i + 0.5) * (UW / 9), E1 + 0.033, HZ + UD / 2 + 0.001, UW / 9 - 0.007, 0.012, 0.002);
  for (let i = 0; i <= 9; i++) cyl(gp, RED, -UW / 2 + (i * UW) / 9, E1 + 0.028, HZ + UD / 2 + 0.002, 0.0042, 0.02, 6);
  const E2 = E1 + 0.048;
  box(gp, BLUE, 0, E2, HZ, UW + 0.012, 0.007, UD + 0.012);
  box(gp, LAT, 0, E2 + 0.003, HZ + UD / 2 + 0.0065, UW + 0.008, 0.0015, 0.001);
  brackets(gp, 0, HZ, UW + 0.012, UD + 0.012, E2 + 0.007, GRN, '#2f5f4c', LAT, 0.016);
  roof(gp, { y: E2 + 0.025, z: HZ, w: UW + 0.08, d: UD + 0.08, h: 0.068, ridge: 0.135, lift: 0.02, ...RT, hipR: 0.004, beasts: 9, ends: 'chiwen', ridgeH: 0.009 });
  // 品级山 rank markers flanking the imperial way, officials in dark 补服 and red-tasselled hats facing the hall
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = 0.235 + i * 0.026;
      cyl(gp, '#5b5446', sx * 0.06, Y0, z, 0.0035, 0.002, 6);
      add(gp, CYLG(), mat('#4d4a3f'), sx * 0.06, Y0 + 0.002, z, 0.006, 0.006, 0.003);
    }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      const x = sx * (0.085 + col * 0.03 + hash3(row, col, sx) * 0.004), z = 0.255 + row * 0.045;
      human(gp, x, Y0, z, {
        h: 0.022, ry: Math.PI, top: col === 0 && row < 2 ? '#3b2f2a' : '#2a2d3a', bottom: '#1f2029', skin: '#c49a76', hair: '#1d1915',
        hat: '#2a2622', hatStyle: 'qing', hatBadge: '#a8322a', dress: 'ankle', shoes: '#1c1a18', detail: 'lo',
      });
    }
    human(gp, sx * 0.075, TY, 0.13, { h: 0.022, ry: Math.PI, top: '#2f3446', bottom: '#2a2c36', skin: '#c49a76', hair: '#1d1915', hat: '#2a2622', hatStyle: 'qing', armor: '#3a4258', armorTrim: '#b8a26a', dress: 'ankle', shoes: '#1c1a18', detail: 'lo' });
  }
};
const CYLG = () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
let _arch: THREE.BufferGeometry | null = null;
/** Unit round-headed window/door recess (width 1, height 1, depth 1, base at the origin). */
const ARCHW = () => {
  if (_arch) return _arch;
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, 0.5);
  sh.absarc(0, 0.5, 0.5, 0, Math.PI, false); sh.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -0.5);
  return (_arch = g);
};

// ---------------------------------------------------------------------------------------------------------
// Gyeongbokgung — Geunjeongjeon (근정전) throne hall
const gyeongbok: Builder = (gp, r) => {
  const RED = r.color ?? '#a8382a', TILE = typeof r.roof === 'string' ? r.roof : '#59625c';
  const GRAN = '#cfc8b8', GRAN2 = '#b9b2a2', GRN = '#3c8a6a', DGRN = '#2e6e55', RD = '#b5402e', BL = '#2f5f8a';
  const RT = { tile: TILE, rib: shade(TILE, 1.18), eave: GRN, under: '#3a7d63', ridgeC: '#e3dfd6', beastC: '#6a706b' };
  // Bugaksan / Bukhansan granite ridges rising behind the palace
  const hf: HFn = (x, z) => {
    const m = sstep(-0.31, -0.45, z + 0.03 * Math.sin(x * 9));
    return m * (0.06 + 0.13 * ridged(x * 4 + 3, z * 5) + 0.07 * Math.max(0, Math.cos(x * 4 + 0.9)));
  };
  island(gp, 0.5, hf, '#7d8a5a', (x, y, z, _nx, ny) => {
    const t = y - 0.035;
    if (t < 0.004) return mix('#b9b09d', '#a99f8b', fbm(x * 12, 0, z * 12));
    if (ny < 0.55 && t > 0.09 && fbm(x * 14, y * 14, z * 14) > 0.5) return fbm(x * 30, y * 30, z * 30) > 0.5 ? '#a8a49a' : '#c3bfb4';
    return hash3(Math.floor(x * 60), 2, Math.floor(z * 60)) > 0.6 ? '#3d6a3d' : mix('#4f7a45', '#6b8a4f', fbm(x * 9, 0, z * 9));
  }, { rings: 30, segs: 84, side: strataSide(EARTH) });
  const gy = onGround(hf);
  scatter(26, 21, (x, z, i) => { if (z < -0.36 && hf(x, z) > 0.04) pine(gp, x, gy(x, z), z, 0.05 + (i % 3) * 0.008, i % 2 ? '#2f5e3f' : '#3d6b45'); }, 0.49);
  // Granite courtyard (박석) with the raised three-lane royal path and the rank stones (품계석)
  const B0 = 0.035;
  paved(gp, 0.74, 0.62, B0, 0.003, '#c9c1ae', 0.034, 0, -0.01);
  paved(gp, 0.1, 0.17, B0 + 0.003, 0.004, '#d9d2c2', 0.025, 0, 0.215);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
    const z = 0.15 + i * 0.03;
    box(gp, '#b8b0a0', sx * 0.085, B0 + 0.003, z, 0.008, 0.012, 0.006);
    box(gp, '#a59c8a', sx * 0.085, B0 + 0.015, z, 0.01, 0.002, 0.008);
  }
  // Haenggak cloister corridors framing the courtyard
  const corridor = (c: THREE.Object3D, L: number) => {
    box(c, GRAN2, 0, B0, 0, L, 0.005, 0.06);
    box(c, '#efe9dc', 0, B0 + 0.005, -0.01, L - 0.01, 0.036, 0.026);
    const n = Math.round(L / 0.04);
    for (let i = 0; i <= n; i++) cyl(c, RED, -L / 2 + 0.005 + (i * (L - 0.01)) / n, B0 + 0.005, 0.019, 0.0035, 0.036, 6);
    box(c, GRN, 0, B0 + 0.041, 0, L, 0.005, 0.056);
    roof(c, { y: B0 + 0.045, w: L + 0.03, d: 0.085, h: 0.036, ridge: L / 2 + 0.015, lift: 0.004, nr: 4, ...RT, gableC: '#d8d0bf', hipR: 0.0028, ridgeH: 0.005 });
  };
  corridor(grp(gp, 0, -0.37), 0.7);
  for (const sx of [-1, 1]) corridor(grp(gp, sx * 0.37, -0.08, sx * Math.PI / 2), 0.5);
  // Two-tier stone platform (월대) with balustrades, corner guardian beasts and the phoenix ramp
  const GZ = -0.1, pw = [0.54, 0.44], pd = [0.4, 0.31], PH = 0.034;
  for (let k = 0; k < 2; k++) {
    const y = B0 + 0.003 + k * PH;
    box(gp, GRAN2, 0, y, GZ, pw[k], 0.006, pd[k]);
    box(gp, GRAN, 0, y + 0.006, GZ, pw[k] - 0.006, PH - 0.006, pd[k] - 0.006);
    railRect(gp, 0, GZ, pw[k] - 0.01, pd[k] - 0.01, y + PH, 0.016, '#ddd6c6', 0.06, 0.028, false, 0.04);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ball(gp, '#a39b8b', sx * (pw[k] / 2 - 0.005), y + PH + 0.022, GZ + sz * (pd[k] / 2 - 0.005), 0.012, 0.01, 0.014);
    const zf = GZ + pd[k] / 2 + 0.035;
    flight(gp, 0, zf, y, y + PH, 0.115, 0.035, GRAN2, 6);
    ramp(gp, 0, zf, y, y + PH, 0.036, 0.035, '#e6e0d2', '#c9c1ae');
    for (const sx of [-1, 1]) {
      flight(grp(gp, sx * pw[k] / 2, GZ, sx * Math.PI / 2), 0, 0.03, y, y + PH, 0.06, 0.03, GRAN2, 6);
      rod(gp, [sx * 0.058, y + 0.012, zf], [sx * 0.058, y + PH + 0.012, zf - 0.035], 0.0025, '#ddd6c6', 4);
    }
  }
  // The hall: 5 bays, red columns, lattice doors framed in green, dense gongpo brackets, two-storey roof
  const HY = B0 + 0.003 + 2 * PH, CW = 0.31, CD = 0.21, CH = 0.072;
  rbox(gp, GRAN, 0, HY, GZ, CW + 0.05, 0.006, CD + 0.05, 0.002);
  const Y1 = HY + 0.006;
  box(gp, '#7d3324', 0, Y1, GZ, CW - 0.03, CH, CD - 0.03);
  for (let i = 0; i < 5; i++) {
    const xc = -CW / 2 + (i + 0.5) * (CW / 5);
    box(gp, GRN, xc, Y1, GZ + CD / 2 - 0.014, CW / 5 - 0.006, CH - 0.004, 0.003);
    for (let j = 0; j < 3; j++) box(gp, '#8a3a28', xc - CW / 10 + 0.004 + (j + 0.5) * ((CW / 5 - 0.008) / 3), Y1 + 0.004, GZ + CD / 2 - 0.012, (CW / 5 - 0.008) / 3 - 0.003, CH - 0.014, 0.002);
  }
  columns(gp, 0, GZ, CW, CD, 5, 4, Y1, CH, RED, 0.0068, GRAN);
  box(gp, GRN, 0, Y1 + CH, GZ, CW + 0.014, 0.01, CD + 0.014);
  box(gp, RD, 0, Y1 + CH + 0.004, GZ + CD / 2 + 0.0075, CW + 0.01, 0.0025, 0.001);
  brackets(gp, 0, GZ, CW + 0.014, CD + 0.014, Y1 + CH + 0.01, GRN, DGRN, RD, 0.016);
  const E1 = Y1 + CH + 0.028;
  roof(gp, { y: E1, z: GZ, w: 0.44, d: 0.34, h: 0.13, ridge: 0.08, upto: 0.46, lift: 0.026, spanF: 0.75, k: 0.7, ...RT });
  const UW = 0.27, UD = 0.17;
  box(gp, '#7d3324', 0, E1 + 0.012, GZ, UW, 0.05, UD);
  for (let i = 0; i < 5; i++) {
    const xc = -UW / 2 + (i + 0.5) * (UW / 5);
    box(gp, GRN, xc, E1 + 0.036, GZ + UD / 2 + 0.001, UW / 5 - 0.008, 0.02, 0.002);
    box(gp, BL, xc, E1 + 0.042, GZ + UD / 2 + 0.0022, UW / 5 - 0.018, 0.008, 0.001);
  }
  for (let i = 0; i <= 5; i++) cyl(gp, RED, -UW / 2 + (i * UW) / 5, E1 + 0.03, GZ + UD / 2 + 0.003, 0.0045, 0.032, 6);
  const E2b = E1 + 0.062;
  box(gp, GRN, 0, E2b, GZ, UW + 0.012, 0.009, UD + 0.012);
  brackets(gp, 0, GZ, UW + 0.012, UD + 0.012, E2b + 0.009, GRN, DGRN, RD, 0.016);
  roof(gp, { y: E2b + 0.026, z: GZ, w: 0.43, d: 0.32, h: 0.16, ridge: 0.13, gable: 0.42, lift: 0.03, spanF: 0.75, k: 0.7, ...RT, gableC: '#8b3b2c', ends: 'korean', ridgeH: 0.012, beasts: 5 });
  const pc = ['#f8fafc', '#ec4899', '#1f2937', '#0ea5e9', '#f59e0b'];
  for (let i = 0; i < 10; i++) person(gp, -0.3 + hash3(i, 9, 1) * 0.6, B0 + 0.003, 0.17 + hash3(i, 9, 2) * 0.1, pc[i % pc.length]);
};


// ---------------------------------------------------------------------------------------------------------
// Small shared scenery helpers
const SPHL = () => g7();
let _g7: THREE.SphereGeometry | null = null;
function g7(): THREE.SphereGeometry { return (_g7 ??= new THREE.SphereGeometry(0.5, 6, 4)); }
/** Low-poly blob (shrubs, canopies, rocks). */
const lowball = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0) => add(p, SPHL(), mat(c), x, y, z, sx, sy, sz, ry);
/** Metallic box (gold leaf, stainless steel). */
const mbox = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, metal = 0.35, ry = 0) =>
  add(p, BOXC(), mat(c, { metal, rough: 0.4 }), x, y + sy / 2, z, sx, sy, sz, ry);
let _bx: THREE.BoxGeometry | null = null;
const BOXC = () => (_bx ??= new THREE.BoxGeometry(1, 1, 1));

/** Japanese cloud-pruned pine: leaning twisted trunk with flat needle pads. */
function jpine(p: THREE.Object3D, x: number, y: number, z: number, s: number, lean: number, seed: number): void {
  const dx = Math.cos(lean) * s, dz = Math.sin(lean) * s;
  const pts: V3[] = [[x, y, z], [x + dx * 0.25, y + s * 0.35, z + dz * 0.25], [x + dx * 0.55, y + s * 0.62, z + dz * 0.5], [x + dx * 0.7, y + s * 0.85, z + dz * 0.6]];
  sweep(p, pts.map((q, i) => ({ p: q, w: s * (0.07 - i * 0.012) })), '#5b4434', { radial: 5, sub: 2, flat: true });
  for (let k = 0; k < 5; k++) {
    const q = pts[Math.min(3, 1 + Math.floor(k / 2))], a = hash3(seed, k, 3) * Math.PI * 2, d = s * (0.12 + 0.18 * hash3(seed, k, 4));
    lowball(p, k % 2 ? '#2f5a3a' : '#3b6b44', q[0] + Math.cos(a) * d, q[1] + s * (k * 0.05 - 0.05), q[2] + Math.sin(a) * d, s * 0.62, s * 0.2, s * 0.5, a);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Kinkaku-ji — the Golden Pavilion on the Kyōko-chi mirror pond
const kinkakuji: Builder = (gp, r) => {
  const GOLD = mix(r.color ?? '#e5c04a', '#ffe08a', 0.35), G2 = shade(GOLD, 0.85), WOOD = '#5a3f2c', WHITE = '#f0ebdf', SH = '#3b2f28';
  const BZ = -0.14, shoreZ = (x: number) => -0.04 + 0.05 * Math.sin(x * 6 + 1.2) + 0.02 * Math.sin(x * 17);
  const isl: [number, number, number][] = [[-0.27, 0.16, 0.07], [0.25, 0.1, 0.06], [0.06, 0.3, 0.05], [-0.1, 0.4, 0.035]];
  const hf: HFn = (x, z) => {
    const rr = Math.hypot(x, z);
    const land = 0.02 + 0.006 * fbm(x * 12, 1, z * 12) + 0.17 * sstep(-0.28, -0.5, z) * (0.6 + 0.6 * fbm(x * 5, 2, z * 5));
    const water = sstep(shoreZ(x) - 0.01, shoreZ(x) + 0.035, z) * (1 - sstep(0.43, 0.47, rr));
    let y = land * (1 - water);
    for (const [ix, iz, ir] of isl) y = Math.max(y, 0.034 * Math.max(0, 1 - Math.hypot(x - ix, z - iz) / ir) ** 0.6);
    return Math.max(0.002, y);
  };
  island(gp, 0.5, hf, '#4f7a45', (x, y, z, _nx, ny) => {
    const t = y - 0.035;
    if (t < 0.0035 && ny > 0.97) {
      if (Math.abs(x) < 0.13 && z > -0.02 && z < 0.2) {
        const f = (1 - (z + 0.02) / 0.22) ** 1.4 * (1 - Math.abs(x) / 0.13) ** 0.5;
        return mix((ripple('#3f6b5c')(x, y, z, 0, 1, 0) ?? '#3f6b5c'), GOLD, f * 0.45);
      }
      return (ripple('#3f6b5c')(x, y, z, 0, 1, 0) ?? '#3f6b5c');
    }
    if (t < 0.012) return hash3(Math.floor(x * 90), 0, Math.floor(z * 90)) > 0.5 ? '#8a8578' : '#a39d8e';
    if (ny < 0.75) return '#6b5a45';
    return hash3(Math.floor(x * 60), 1, Math.floor(z * 60)) > 0.65 ? '#3f6b3a' : mix('#4f7d44', '#6b8f4f', fbm(x * 10, 0, z * 10));
  }, { rings: 34, segs: 88, side: strataSide(EARTH) });
  const gy = onGround(hf);
  // Kinugasa-yama forest behind: pines, evergreen oaks and a few red maples
  scatter(140, 33, (x, z, i) => {
    if (z > -0.25 || hf(x, z) < 0.03) return;
    const y = gy(x, z), c = i % 7 === 0 ? '#b8452a' : i % 5 === 0 ? '#c27a2a' : ['#2f5a3a', '#3d6b42', '#4a7a46', '#355e3c'][i % 4];
    if (i % 3 === 0) pine(gp, x, y, z, 0.05 + hash3(i, 1, 1) * 0.03, c);
    else { cyl(gp, '#5b4030', x, y, z, 0.004, 0.02, 5); lowball(gp, c, x, y + 0.03, z, 0.05 + hash3(i, 2, 2) * 0.02, 0.045, 0.05); }
  }, 0.49);
  // Islets with pines, shore rocks
  for (const [k, [ix, iz]] of isl.entries()) jpine(gp, ix, gy(ix, iz), iz, 0.07 + (k % 2) * 0.02, k * 1.7, k + 3);
  for (let i = 0; i < 16; i++) {
    const a = hash3(i, 4, 1) * Math.PI * 2, [ix, iz, ir] = isl[i % isl.length];
    const x = ix + Math.cos(a) * ir * 0.85, z = iz + Math.sin(a) * ir * 0.85;
    lowball(gp, hash3(i, 4, 2) > 0.5 ? '#7d7a72' : '#93908a', x, 0.038, z, 0.018 + hash3(i, 4, 3) * 0.012, 0.012, 0.016, a);
  }
  jpine(gp, -0.3, gy(-0.3, -0.12), -0.12, 0.1, 0.4, 9);
  jpine(gp, 0.33, gy(0.33, -0.16), -0.16, 0.09, 2.6, 11);
  // Stone foundation rising from the water
  box(gp, '#8d897d', 0, 0.035, BZ, 0.36, 0.03, 0.27);
  for (let i = 0; i < 9; i++) box(gp, i % 2 ? '#7d796e' : '#9a968a', -0.17 + i * 0.0425, 0.035, BZ + 0.136, 0.04, 0.03, 0.004);
  // 1st floor — Hōsui-in, shinden style: natural wood posts, white plaster, dark shutters, open veranda
  const Y1 = 0.065, H1 = 0.085, W1 = 0.3, D1 = 0.22;
  box(gp, '#6e4e36', 0, Y1, BZ, W1 + 0.04, 0.006, D1 + 0.04);
  box(gp, WHITE, 0, Y1 + 0.006, BZ, W1 - 0.02, H1 - 0.006, D1 - 0.02);
  box(gp, '#3e2e24', 0, Y1 + 0.006, BZ, W1 - 0.018, 0.036, D1 - 0.018);
  for (const yy of [0.042, 0.064, 0.082]) box(gp, WOOD, 0, Y1 + yy, BZ, W1 - 0.012, 0.004, D1 - 0.012);
  for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) box(gp, WOOD, -W1 / 2 + (i * W1) / 6, Y1 + 0.006, BZ + sz * D1 / 2, 0.008, H1 - 0.006, 0.008);
  for (let j = 1; j < 4; j++) for (const sx of [-1, 1]) box(gp, WOOD, sx * W1 / 2, Y1 + 0.006, BZ - D1 / 2 + (j * D1) / 4, 0.008, H1 - 0.006, 0.008);
  for (let i = 0; i < 18; i++) box(gp, '#2e2219', -W1 / 2 + 0.008 + (i + 0.5) * ((W1 - 0.016) / 18), Y1 + 0.046, BZ + D1 / 2 - 0.009, 0.002, 0.034, 0.002);
  rail(gp, [-W1 / 2 - 0.018, BZ + D1 / 2 + 0.018], [W1 / 2 + 0.018, BZ + D1 / 2 + 0.018], Y1 + 0.006, 0.012, '#6e4e36', 0.03);
  // 2nd floor — Chōon-dō, buke style, covered in gold leaf, balcony with railing
  const Y2 = Y1 + H1, H2 = 0.088, W2 = 0.28, D2 = 0.2;
  mbox(gp, G2, 0, Y2, BZ, W1 + 0.03, 0.007, D1 + 0.03);
  mbox(gp, GOLD, 0, Y2 + 0.007, BZ, W2, H2 - 0.007, D2);
  for (let i = 0; i <= 5; i++) for (const sz of [-1, 1]) mbox(gp, shade(GOLD, 1.08), -W2 / 2 + (i * W2) / 5, Y2 + 0.007, BZ + sz * (D2 / 2 + 0.001), 0.007, H2 - 0.007, 0.004);
  for (let i = 0; i < 5; i++) mbox(gp, G2, -W2 / 2 + (i + 0.5) * (W2 / 5), Y2 + 0.022, BZ + D2 / 2 + 0.001, W2 / 5 - 0.016, 0.03, 0.003);
  railRect(gp, 0, BZ, W1 + 0.022, D1 + 0.022, Y2 + 0.007, 0.014, GOLD, 0, 0.026);
  // Big shingled (kokera-buki) roof with gently rising corners
  const RS = { tile: SH, rib: '#4a3c33', eave: '#2a211c', under: '#6b5236', ridgeC: '#2e2520', th: 0.014 };
  const R2 = roof(gp, { y: Y2 + H2, z: BZ, w: 0.39, d: 0.31, h: 0.1, ridge: 0.06, upto: 0.56, lift: 0.014, spanF: 0.7, k: 0.45, ...RS });
  // 3rd floor — Kukkyō-chō, Zen style with cusped katōmado windows, gilded inside and out
  const Y3 = R2.top - 0.016, H3 = 0.075, W3 = 0.15, D3 = 0.14;
  mbox(gp, GOLD, 0, Y3, BZ, W3, H3, D3);
  mbox(gp, G2, 0, Y3 + 0.014, BZ, W3 + 0.05, 0.006, D3 + 0.05);
  railRect(gp, 0, BZ, W3 + 0.044, D3 + 0.044, Y3 + 0.02, 0.012, GOLD, 0, 0.024);
  for (const sx of [-1, 1]) for (const fz of [1, -1]) {
    const win = slab(gp, [[-0.012, 0], [0.012, 0], [0.012, 0.022], [0.006, 0.03], [0, 0.036], [-0.006, 0.03], [-0.012, 0.022]], 0.003, '#3a2a1c', 0, true);
    win.position.set(sx * 0.038, Y3 + 0.03, BZ + fz * (D3 / 2 + 0.001));
  }
  for (const sx of [-1, 1]) mbox(gp, shade(GOLD, 1.1), sx * W3 / 2, Y3, BZ + D3 / 2 + 0.001, 0.007, H3, 0.004);
  const R3 = roof(gp, { y: Y3 + H3, z: BZ, w: 0.25, d: 0.24, h: 0.085, ridge: 0.004, lift: 0.014, spanF: 0.7, k: 0.45, ...RS });
  // Hōju finial and the golden phoenix (hōō)
  const PY = R3.top;
  lathe(gp, [[0.012, 0], [0.008, 0.008], [0.004, 0.012], [0.004, 0.018], [0, 0.018]], GOLD, 0, PY - 0.004, BZ, 8);
  const ph = grp(gp, 0, BZ, 0.5, PY + 0.014);
  const body = slab(ph, [[-0.022, 0.004], [-0.004, 0.0], [0.012, 0.006], [0.02, 0.022], [0.027, 0.026], [0.022, 0.016], [0.012, 0.012], [0.004, 0.016], [-0.014, 0.02], [-0.028, 0.032], [-0.026, 0.016]], 0.005, GOLD, 0.001, true);
  body.material = mat(GOLD, { metal: 0.6, rough: 0.3, flat: false });
  for (const sz of [-1, 1]) {
    const w = slab(ph, [[-0.01, 0], [0.012, 0], [0.006, 0.018], [-0.006, 0.03], [-0.012, 0.018]], 0.003, GOLD, 0, true);
    w.position.set(0, 0.012, sz * 0.006); w.rotation.set(sz * 0.7, 0, 0);
    w.material = mat(GOLD, { metal: 0.6, rough: 0.3, flat: false });
  }
  // Sosei fishing pavilion on the west side
  const sx0 = -0.21, sz0 = BZ + 0.04;
  box(gp, '#6e4e36', sx0, 0.06, sz0, 0.08, 0.006, 0.08);
  box(gp, WHITE, sx0, 0.066, sz0, 0.06, 0.04, 0.06);
  for (const dx of [-0.03, 0.03]) for (const dz of [-0.03, 0.03]) box(gp, WOOD, sx0 + dx, 0.066, sz0 + dz, 0.006, 0.04, 0.006);
  roof(gp, { x: sx0, z: sz0, y: 0.106, w: 0.1, d: 0.1, h: 0.035, ridge: 0.02, lift: 0.006, ...RS, th: 0.008 });
  // A visitors' boat on the pond
  const bt = grp(gp, 0.2, 0.3, 0.6, 0.037);
  box(bt, '#6b4a32', 0, 0, 0, 0.05, 0.006, 0.016);
  person(bt, 0.012, 0.006, 0, '#1f2937', 0.8);
};

// ---------------------------------------------------------------------------------------------------------
// Angkor Wat — quincunx of lotus-bud towers over concentric colonnaded galleries, moat and causeway
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
/** Khmer prasat: redented square base and a corncob (lotus-bud) spire of receding tiers. */
function prasat(p: THREE.Object3D, x: number, y: number, z: number, R: number, H: number, c: string): void {
  const dark = shade(c, 0.78), lite = shade(c, 1.1);
  box(p, dark, x, y, z, R * 2.1, H * 0.05, R * 2.1);
  box(p, c, x, y + H * 0.05, z, R * 1.75, H * 0.2, R * 1.75);
  box(p, c, x, y + H * 0.05, z, R * 2.2, H * 0.17, R * 0.9);
  box(p, c, x, y + H * 0.05, z, R * 0.9, H * 0.17, R * 2.2);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) box(p, '#2b2620', x + dx * R * 1.1, y + H * 0.06, z + dz * R * 1.1, dz ? R * 0.35 : 0.002, H * 0.11, dx ? R * 0.35 : 0.002);
  const prof: [number, number][] = [[R * 0.95, 0]];
  const N = 8, y0 = H * 0.25;
  for (let i = 0; i < N; i++) {
    const t = i / N, t1 = (i + 1) / N;
    const rad = R * 0.92 * (1 - 0.8 * t ** 1.25) * (1 + 0.1 * Math.sin(Math.PI * t));
    const rad1 = R * 0.92 * (1 - 0.8 * t1 ** 1.25) * (1 + 0.1 * Math.sin(Math.PI * t1));
    const ya = y0 + (H * 0.68 * i) / N, yb = y0 + (H * 0.68 * (i + 1)) / N;
    prof.push([rad, ya + (yb - ya) * 0.05], [rad * 1.07, ya + (yb - ya) * 0.4], [rad1 * 0.94, yb]);
  }
  prof.push([R * 0.14, H * 0.95], [0.0005, H]);
  const sp = lathe(p, prof.map(([a, b]) => [a, b - H * 0.25] as [number, number]), lite, x, y + H * 0.25, z, 8);
  sp.rotation.y = Math.PI / 8;
  sp.material = mat(mix(c, lite, 0.5), { flat: true });
}
/** Colonnaded gallery wing: stylobate, inner wall, square pillars and a corbelled stone roof. */
function gallery(p: THREE.Object3D, L: number, y: number, h: number, c: string, d = 0.04, sp = 0.021): void {
  box(p, shade(c, 0.85), 0, y, 0, L, 0.01, d + 0.012);
  box(p, shade(c, 0.92), 0, y + 0.01, -d * 0.3, L, h, d * 0.35);
  const n = Math.max(2, Math.round(L / sp));
  for (let i = 0; i <= n; i++) box(p, c, -L / 2 + (i * L) / n, y + 0.01, d * 0.38, 0.0055, h, 0.0055);
  box(p, shade(c, 0.95), 0, y + 0.01 + h, 0, L, 0.005, d + 0.004);
  roof(p, { y: y + 0.015 + h, w: L + 0.006, d: d + 0.01, h: d * 0.45, ridge: L / 2 + 0.003, lift: 0, k: -0.3, nr: 3, step: 0.03, tile: shade(c, 0.98), rib: shade(c, 1.06), eave: shade(c, 0.8), gableC: shade(c, 0.9), hipR: 0.0022, ridgeH: 0.004, th: 0.004 });
}
/** Four gallery wings around a rectangle with corner pavilions (prasat stubs) and a front entrance. */
function enclosure(p: THREE.Object3D, w: number, d: number, y: number, h: number, c: string, gd: number, tower: number): void {
  const fw = grp(p, 0, d / 2), bw = grp(p, 0, -d / 2, Math.PI), lw = grp(p, -w / 2, 0, -Math.PI / 2), rw = grp(p, w / 2, 0, Math.PI / 2);
  gallery(fw, w, y, h, c, gd); gallery(bw, w, y, h, c, gd); gallery(lw, d, y, h, c, gd); gallery(rw, d, y, h, c, gd);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(p, shade(c, 0.9), sx * w / 2, y, sz * d / 2, gd * 1.4, h + 0.02, gd * 1.4);
    if (tower > 0) prasat(p, sx * w / 2, y + h + 0.02, sz * d / 2, gd * 0.55, tower, c);
  }
  box(p, shade(c, 0.9), 0, y, d / 2, gd * 1.8, h + 0.026, gd * 1.5);
  roof(p, { z: d / 2, y: y + h + 0.026, w: gd * 1.9, d: gd * 1.6, h: gd * 0.8, ridge: gd * 0.5, lift: 0, k: -0.3, nr: 3, step: 0.016, tile: shade(c, 1.02), eave: shade(c, 0.8), hipR: 0.002, ridgeH: 0.004, th: 0.004 });
  box(p, '#2b2620', 0, y + 0.012, d / 2 + gd * 0.76, gd * 0.5, h * 0.75, 0.002);
}
const angkor: Builder = (gp, r) => {
  const S = r.color ?? '#8f8470';
  const moat = (x: number, z: number) => (x ** 4 + z ** 4) ** 0.25;
  const hf: HFn = (x, z) => {
    const m = moat(x, z);
    if (m > 0.365 && m < 0.43) return 0.002;
    if (Math.abs(Math.abs(x) - 0.13) < 0.055 && z > 0.155 && z < 0.255) return 0.003;
    return 0.014 + 0.003 * fbm(x * 20, 0, z * 20);
  };
  island(gp, 0.5, hf, '#6f8a45', (x, y, z, _nx, ny) => {
    const t = y - 0.035;
    if (t < 0.0045 && ny > 0.97) {
      const m = moat(x, z), lily = hash3(Math.floor(x * 70), 2, Math.floor(z * 70)) > (m < 0.36 ? 0.7 : 0.9);
      return lily ? (hash3(Math.floor(x * 70), 3, Math.floor(z * 70)) > 0.93 ? '#e8a0b8' : '#4f7a3a') : (ripple('#3f7f86')(x, y, z, 0, 1, 0) ?? '#3f7f86');
    }
    if (ny < 0.9) return mix('#7a6a4a', '#6f8a45', fbm(x * 30, y * 30, z * 30) * 0.6);
    return hash3(Math.floor(x * 60), 1, Math.floor(z * 60)) > 0.75 ? '#5f7d3a' : mix('#6f8a45', '#8a9a55', fbm(x * 10, 0, z * 10));
  }, { rings: 30, segs: 80, side: strataSide(['#8a5a3a', '#9a6a44', '#7a4e32']) });
  const G = 0.049;
  // Western causeway across the moat with naga balustrades, then the processional avenue to the temple
  box(gp, shade(S, 0.9), 0, 0.03, 0.4, 0.05, G - 0.03 + 0.004, 0.12);
  for (const sx of [-1, 1]) rail(gp, [sx * 0.026, 0.46], [sx * 0.026, 0.34], G + 0.004, 0.006, shade(S, 0.95), 0.03);
  box(gp, shade(S, 0.92), 0, G - 0.004, 0.2, 0.034, 0.008, 0.24);
  for (const sx of [-1, 1]) rail(gp, [sx * 0.018, 0.31], [sx * 0.018, 0.1], G + 0.004, 0.005, shade(S, 0.95), 0.03);
  // Outer laterite enclosure wall with the western entrance gopura
  const OW = 0.29, wallC = '#8a6a50';
  for (const [a, b] of [[[-OW, OW], [-0.09, OW]], [[0.09, OW], [OW, OW]], [[OW, OW], [OW, -OW]], [[OW, -OW], [-OW, -OW]], [[-OW, -OW], [-OW, OW]]] as [[number, number], [number, number]][]) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    box(gp, wallC, (a[0] + b[0]) / 2, G - 0.004, (a[1] + b[1]) / 2, Math.hypot(dx, dz) + 0.006, 0.018, 0.006, -Math.atan2(dz, dx));
  }
  const gw = grp(gp, 0, OW);
  gallery(gw, 0.18, G - 0.004, 0.022, S, 0.03, 0.015);
  for (const x of [-0.06, 0, 0.06]) prasat(gp, x, G + 0.03, OW, x ? 0.012 : 0.016, x ? 0.05 : 0.07, S);
  // Libraries and the twin reflecting pools
  for (const sx of [-1, 1]) {
    box(gp, shade(S, 0.9), sx * 0.2, G - 0.004, 0.22, 0.05, 0.012, 0.04);
    box(gp, S, sx * 0.2, G + 0.008, 0.22, 0.04, 0.02, 0.03);
    roof(gp, { x: sx * 0.2, z: 0.22, y: G + 0.028, w: 0.048, d: 0.036, h: 0.02, ridge: 0.012, lift: 0, k: -0.3, nr: 3, tile: S, eave: shade(S, 0.8), hipR: 0.002, ridgeH: 0.003, th: 0.003 });
    for (let k = 0; k < 2; k++) palm(gp, sx * (0.06 + k * 0.17), G - 0.004, 0.3 - k * 0.015, 0.075 + k * 0.01, sx * 3 + k);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, rr = 0.455;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (z > 0.3 && Math.abs(x) < 0.12) continue;
    palm(gp, x, gy0(hf, x, z), z, 0.08 + hash3(i, 2, 2) * 0.03, i);
  }
  for (const [x, z] of [[-0.24, 0.12], [0.25, 0.08], [-0.25, -0.22], [0.24, -0.24]]) palm(gp, x, G - 0.004, z, 0.07, x * 10);
  // Temple: three concentric terraces of galleries, the central Bakan with steep stairs and five prasats
  const TZ = -0.07;
  const t1 = grp(gp, 0, TZ);
  box(t1, shade(S, 0.82), 0, G - 0.004, 0, 0.44, 0.012, 0.36);
  enclosure(t1, 0.42, 0.34, G + 0.008, 0.03, S, 0.034, 0.05);
  for (const [w, d, y0, h] of [[0.29, 0.24, G + 0.008, 0.045], [0.2, 0.17, G + 0.053, 0.075]] as const) {
    box(t1, shade(S, 0.84), 0, y0, 0, w + 0.03, h * 0.35, d + 0.03);
    tbox(t1, w + 0.02, d + 0.02, w, d, h * 0.65, shade(S, 0.9), 0, y0 + h * 0.35, 0);
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const sg = grp(t1, 0, 0, ry);
      const half = ry % Math.PI === 0 ? d / 2 : w / 2;
      flight(sg, 0, half + 0.02 + h * 0.15, y0, y0 + h, 0.028, 0.02 + h * 0.15, shade(S, 0.95), 7);
    }
  }
  const t2 = G + 0.053;
  enclosure(grp(t1, 0, 0), 0.27, 0.22, t2, 0.03, S, 0.03, 0.0);
  const t3 = t2 + 0.075;
  enclosure(grp(t1, 0, 0), 0.18, 0.15, t3, 0.03, S, 0.026, 0.0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) prasat(t1, sx * 0.09, t3 + 0.05, sz * 0.075, 0.026, 0.17, S);
  prasat(t1, 0, t3 + 0.03, 0, 0.038, 0.26, S);
  const pc = ['#f97316', '#f8fafc', '#1f2937', '#facc15'];
  for (let i = 0; i < 8; i++) person(gp, (hash3(i, 5, 1) - 0.5) * 0.03, G + 0.004, 0.12 + hash3(i, 5, 2) * 0.28, pc[i % 4], 0.9);
};
const gy0 = (hf: HFn, x: number, z: number) => 0.035 + hf(x, z) - 0.003;


// ---------------------------------------------------------------------------------------------------------
// Skyscraper kit: banded curtain-wall lofts over arbitrary plans
type Plan = (s: number) => [number, number][];
/**
 * Lofts `plan` from y0 to y1 while scaling s0→s1, with horizontal bands every `step` (spandrel `a` colour
 * for the first `frac` of each band, vision glass `b` for the rest). Returns the mesh.
 */
function bandLoft(p: THREE.Object3D, plan: Plan, x: number, z: number, y0: number, y1: number, s0: number, s1: number, step: number, frac: number, a: string, b: string, o: { caps?: boolean; metal?: number } = {}): THREE.Mesh {
  const n = Math.max(1, Math.round((y1 - y0) / step)), st = (y1 - y0) / n;
  const ys: number[] = [];
  for (let k = 0; k < n; k++) ys.push(y0 + k * st, y0 + k * st + st * frac);
  ys.push(y1);
  const rings = ys.map(y => {
    const sc = s0 + ((s1 - s0) * (y - y0)) / (y1 - y0);
    return plan(sc).map(([px, pz]) => [x + px, y, z + pz] as V3);
  });
  return skin(p, rings, b, {
    flat: true, caps: o.caps ?? true, metal: o.metal, rough: 0.35,
    paint: (_x, y, _z, _nx, ny) => (Math.abs(ny) > 0.85 ? a : ((y - y0) / st) % 1 < frac ? a : null),
  });
}

// Taipei 101 — eight flared "bamboo" segments of eight floors over a tapered base, ruyi & coin ornaments
const notched: Plan = sc => {
  const A = 0.5 * sc, n = 0.085 * sc, out: [number, number][] = [];
  for (let q = 0; q < 4; q++) {
    const c = Math.cos((q * Math.PI) / 2), s = Math.sin((q * Math.PI) / 2);
    for (const [u, v] of [[A, A - 2 * n], [A - n, A - 2 * n], [A - n, A - n], [A - 2 * n, A - n], [A - 2 * n, A]] as const) out.push([u * c - v * s, u * s + v * c]);
  }
  return out;
};
const taipei101: Builder = (gp, r) => {
  const GL = r.color ?? '#5f9a8a', glass = mix(shade(GL, 0.7), '#2f8a92', 0.3), line = mix(GL, '#e6f2ee', 0.45), trim = '#c9d4cf';
  const hf: HFn = (x, z) => 0.006 + 0.2 * sstep(0.18, 0.5, -z * 0.8 + x * 0.6) * (0.7 + 0.3 * fbm(x * 6, 1, z * 6)) * sstep(0.2, 0.36, Math.hypot(x, z));
  const road = (x: number, z: number) => Math.abs(z - 0.17) < 0.022 || Math.abs(x + 0.17) < 0.018;
  island(gp, 0.5, hf, '#8d8f92', (x, y, z, _nx, ny) => {
    if (y - 0.035 > 0.016) return ny < 0.8 ? '#4b6b3a' : mix('#3f6f3a', '#5a8a45', fbm(x * 12, y * 9, z * 12));
    if (road(x, z)) return '#3f444b';
    if (Math.hypot(x, z - 0.02) < 0.15) return (Math.floor(x * 80) + Math.floor(z * 80)) % 2 ? '#b8b2a6' : '#c9c3b6';
    return mix('#8d8f92', '#6f9a55', sstep(0.3, 0.45, Math.hypot(x, z)));
  }, { rings: 34, segs: 90, side: strataSide(['#5b5f66', '#4b5058']) });
  const G = 0.041, gy = onGround(hf);
  // City blocks and street trees
  const pal = ['#a3a8b0', '#c2bcb0', '#8d939b', '#b8a58c', '#7c8a96', '#d0d4d8'];
  scatter(70, 101, (x, z, i) => {
    if (road(x, z) || Math.hypot(x, z - 0.02) < 0.2 || hf(x, z) > 0.012 || (x > 0.02 && z < -0.08 && x < 0.3)) return;
    const h = 0.02 + hash3(i, 1, 1) ** 2 * 0.13, w = 0.03 + hash3(i, 2, 1) * 0.025, c = pal[i % pal.length];
    if (i % 4 === 0) { lowball(gp, '#4f8a45', x, G + 0.01, z, 0.022, 0.02, 0.022); return; }
    bandLoft(gp, sqPlan, x, z, G, G + h, w, w, 0.008, 0.6, c, '#4b5563', { metal: 0.15 });
  }, 0.46);
  for (let i = 0; i < 9; i++) lowball(gp, '#4f8a45', -0.4 + i * 0.07 + 0.02 * hash3(i, 3, 3), G + 0.008, 0.2, 0.018, 0.018, 0.018);
  // Xiangshan (Elephant Mountain) forest
  scatter(60, 7, (x, z, i) => { if (hf(x, z) > 0.03) lowball(gp, ['#2f5a3a', '#3d6b42', '#4a7a46'][i % 3], x, gy(x, z) + 0.008, z, 0.03, 0.026, 0.03); }, 0.48);
  // Taipei 101 Mall podium wrapping the tower base (east side), with sloped glass atrium
  const MX = 0.1, MZ = -0.08;
  box(gp, '#cfd6d4', MX, G, MZ, 0.2, 0.05, 0.16);
  for (let k = 0; k < 5; k++) box(gp, '#5b7f7a', MX, G + 0.006 + k * 0.009, MZ, 0.202, 0.004, 0.162);
  box(gp, '#e5eae8', MX, G + 0.05, MZ, 0.205, 0.004, 0.165);
  box(gp, '#7fb3ad', MX + 0.02, G + 0.054, MZ, 0.1, 0.012, 0.08);
  // Tower: tapered base (floors 1–26), coins & ruyi, then 8 × 8-floor flared segments
  const TX = -0.04, TZ = 0.02, fl = 0.0085;
  box(gp, '#d6dbd9', TX, G, TZ, 0.17, 0.008, 0.17);
  let y = G + 0.008;
  bandLoft(gp, notched, TX, TZ, y, y + 0.2, 0.15, 0.12, fl, 0.22, line, glass, { metal: 0.25 });
  y += 0.2;
  for (let f = 0; f < 4; f++) {
    const fg = grp(gp, TX, TZ, (f * Math.PI) / 2);
    const coin = cyl(fg, '#d7b45a', 0, y - 0.045, 0.071, 0.017, 0.004, 14);
    coin.rotation.x = Math.PI / 2; coin.position.y = y - 0.03;
    box(fg, '#5a4a2a', 0, y - 0.034, 0.0735, 0.009, 0.009, 0.002);
    const ru = slab(fg, [[-0.03, 0], [0.03, 0], [0.026, 0.012], [0.014, 0.018], [0.006, 0.012], [0, 0.02], [-0.006, 0.012], [-0.014, 0.018], [-0.026, 0.012]], 0.004, trim, 0.001, true);
    ru.position.set(0, y - 0.004, 0.062);
  }
  box(gp, trim, TX, y - 0.002, TZ, 0.13, 0.004, 0.13);
  for (let sgi = 0; sgi < 8; sgi++) {
    const h = 8 * fl;
    bandLoft(gp, notched, TX, TZ, y, y + h, 0.112, 0.134, fl, 0.22, line, glass, { metal: 0.25 });
    box(gp, trim, TX, y + h - 0.003, TZ, 0.136, 0.004, 0.136);
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2 + Math.PI / 4, d = 0.064;
      const orn = slab(gp, [[-0.006, 0], [0.006, 0], [0.008, 0.008], [0.002, 0.012], [-0.004, 0.009]], 0.003, trim, 0, true);
      orn.position.set(TX + Math.cos(a) * d, y + h - 0.012, TZ + Math.sin(a) * d); orn.rotation.y = -a + Math.PI / 2;
    }
    y += h;
  }
  // Crown floors, the dish-like 91st floor platform and the spire
  bandLoft(gp, notched, TX, TZ, y, y + 0.028, 0.1, 0.09, fl, 0.25, line, glass, { metal: 0.25 });
  y += 0.028;
  box(gp, trim, TX, y, TZ, 0.1, 0.004, 0.1);
  bandLoft(gp, notched, TX, TZ, y + 0.004, y + 0.026, 0.07, 0.064, fl, 0.25, line, glass, { metal: 0.25 });
  y += 0.026;
  box(gp, trim, TX, y, TZ, 0.07, 0.005, 0.07);
  box(gp, '#8fa6a1', TX, y + 0.005, TZ, 0.036, 0.022, 0.036);
  y += 0.027;
  lathe(gp, [[0.012, 0], [0.011, 0.02], [0.008, 0.022], [0.008, 0.045], [0.006, 0.047], [0.005, 0.075], [0.0035, 0.077], [0.003, 0.1], [0.0012, 0.12], [0, 0.125]], '#c7d0d4', TX, y, TZ, 8);
  add(gp, SPHL(), mat('#ef4444', { emissive: '#ef4444' }), TX, y + 0.125, TZ, 0.004, 0.004, 0.004);
};

// Petronas Towers — Rub el Hizb star plans, stainless-steel ribbon bands, setbacks, skybridge and pinnacles
const star: Plan = sc => {
  const out: [number, number][] = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    const sq = (u: number) => 1 / Math.max(Math.abs(Math.cos(u)), Math.abs(Math.sin(u)));
    const rr = Math.max(sq(t), sq(t + Math.PI / 4), 1.16) * sc;
    out.push([Math.cos(t) * rr, Math.sin(t) * rr]);
  }
  return out;
};
const sqPlan: Plan = sc => [[sc / 2, -sc / 2], [sc / 2, sc / 2], [-sc / 2, sc / 2], [-sc / 2, -sc / 2]];
const circ = (n: number): Plan => sc => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * sc, Math.sin((i / n) * Math.PI * 2) * sc]);
const petronas: Builder = (gp, r) => {
  const ST = mix(r.color ?? '#c7d0dc', '#eef2f6', 0.5), GLS = '#6d7f96', G = 0.041;
  // KLCC Park lake in front, Suria KLCC mall around the base, city around
  island(gp, 0.5, () => 0.006, '#9ca3af', (x, y, z) => mix('#9ca3af', '#aeb4bb', fbm(x * 14, y, z * 14)), { rings: 22, segs: 72, side: strataSide(['#5b5f66', '#4b5058']) });
  // KLCC Park (overlaid as smooth meshes so the edges stay crisp): lawn segment, sand rim, lake, roads
  const park = new THREE.Shape(), z0 = 0.15, R = 0.497, a0 = Math.asin(z0 / R);
  park.moveTo(Math.cos(a0) * R, -z0);
  for (let i = 0; i <= 28; i++) { const a = a0 + ((Math.PI - 2 * a0) * i) / 28; park.lineTo(Math.cos(a) * R, -Math.sin(a) * R); }
  const pg = new THREE.ShapeGeometry(park); pg.rotateX(-Math.PI / 2);
  add(gp, pg, mat('#5f8f4a'), 0, G + 0.0004, 0, 1, 1, 1);
  const disc = new THREE.CylinderGeometry(1, 1, 1, 40);
  add(gp, disc, mat('#d6cdb6'), 0.02, G + 0.0012, 0.3, 0.236, 0.0016, 0.112);
  add(gp, disc, mat('#3f7a8c', { metal: 0.2, rough: 0.15 }), 0.02, G + 0.002, 0.3, 0.2, 0.0016, 0.09);
  box(gp, '#d6cdb6', 0.02, G, 0.19, 0.024, 0.0014, 0.08);
  box(gp, '#3f444b', 0, G, 0.13, 0.95, 0.001, 0.04);
  box(gp, '#3f444b', 0.36, G, 0.0, 0.04, 0.001, 0.66);
  for (let i = 0; i < 7; i++) { const x = -0.1 + i * 0.03; cyl(gp, '#e0f2fe', x, G - 0.004, 0.3, 0.002, 0.012 + (i % 2) * 0.008, 5).material = mat('#e0f2fe', { transparent: 0.7 }); }
  scatter(110, 17, (x, z, i) => {
    if (z > 0.17 && z < 0.46 && Math.abs(x - 0.36) > 0.03 && ((x - 0.02) / 0.24) ** 2 + ((z - 0.3) / 0.115) ** 2 > 1) lowball(gp, ['#2f6a3a', '#3d7a42', '#4a8a46'][i % 3], x, G + 0.012, z, 0.026, 0.024, 0.026);
  }, 0.46);
  const pal = ['#a3a8b0', '#c2bcb0', '#8d939b', '#b8a58c', '#7c8a96'];
  scatter(46, 23, (x, z, i) => {
    if (z > 0.1 || Math.abs(x) < 0.3 && z > -0.25 || Math.abs(z - 0.13) < 0.03 || Math.abs(x - 0.36) < 0.03) return;
    const h = 0.03 + hash3(i, 1, 1) ** 2 * 0.16, w = 0.035 + hash3(i, 2, 1) * 0.02;
    bandLoft(gp, sqPlan, x, z, G, G + h, w, w, 0.009, 0.6, pal[i % pal.length], '#4b5563', { metal: 0.15 });
  }, 0.47);
  // Suria KLCC podium
  box(gp, '#d9d4c7', 0, G, -0.02, 0.5, 0.03, 0.16);
  for (let k = 0; k < 3; k++) box(gp, '#5d6f86', 0, G + 0.006 + k * 0.008, -0.02, 0.502, 0.003, 0.162);
  box(gp, '#e9e5da', 0, G + 0.03, -0.02, 0.51, 0.004, 0.17);
  lathe(gp, [[0.05, 0], [0.045, 0.015], [0.02, 0.026], [0, 0.028]], '#9fb3c8', 0, G + 0.034, 0.02, 12);
  const H = 0.78, A = 0.044, X = 0.11, TZ = -0.03;
  const tiers: [number, number, number][] = [[0, 0.6, 1], [0.6, 0.7, 0.86], [0.7, 0.78, 0.74], [0.78, 0.85, 0.6], [0.85, 0.91, 0.48], [0.91, 0.96, 0.36]];
  for (const sx of [-1, 1]) {
    const x = sx * X;
    // Bustle annex: 44-storey circular tower on the outer side
    bandLoft(gp, circ(16), x + sx * 0.06, TZ - 0.05, G + 0.03, G + 0.36, 0.034, 0.034, 0.018, 0.5, ST, GLS, { metal: 0.2 });
    for (const [h0, h1, sc] of tiers) {
      const y0 = G + 0.03 + H * h0, y1 = G + 0.03 + H * h1;
      bandLoft(gp, star, x, TZ, y0, y1, A * sc, A * sc * (h1 - h0 > 0.2 ? 0.97 : 1), 0.0145, 0.5, ST, GLS, { metal: 0.2 });
      box(gp, ST, x, y1 - 0.002, TZ, A * sc * 2.2, 0.003, A * sc * 2.2);
      if (h0 > 0.5) for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, rr = A * sc * 1.2;
        add(gp, BOXC(), mat(ST, { metal: 0.5, rough: 0.3 }), x + Math.cos(a) * rr, y1 - 0.012, TZ + Math.sin(a) * rr, 0.0018, 0.022, 0.0018);
      }
    }
    // Pinnacle: ring stack, sphere and mast
    const PY = G + 0.03 + H * 0.96;
    const pin = lathe(gp, [[0.014, 0], [0.012, 0.02], [0.009, 0.022], [0.009, 0.05], [0.006, 0.052], [0.006, 0.075], [0.008, 0.078], [0.008, 0.082], [0.004, 0.084], [0.0025, 0.13], [0.001, 0.17], [0, 0.175]], ST, x, PY, TZ, 10);
    pin.material = mat(ST, { metal: 0.6, rough: 0.3 });
    for (let k = 0; k < 4; k++) add(gp, CYLG(), mat(ST, { metal: 0.6, rough: 0.3 }), x, PY + 0.03 + k * 0.012, TZ, 0.03 - k * 0.004, 0.002, 0.03 - k * 0.004);
    add(gp, SPHL(), mat(ST, { metal: 0.6, rough: 0.3 }), x, PY + 0.09, TZ, 0.014, 0.014, 0.014);
    // Skybridge A-frame: a pair of hinged struts from the bridge's central bearing down to level 29
    for (const dz of [-0.0065, 0.0065]) {
      rod(gp, [sx * 0.004, G + 0.03 + H * 0.43 - 0.012, TZ + dz * 0.6], [x - sx * A * 1.12, G + 0.03 + H * 0.3, TZ + dz], 0.0022, '#c3ccd6', 6).material = mat('#c3ccd6', { metal: 0.6, rough: 0.3 });
    }
    box(gp, '#8d99a6', x - sx * A * 1.1, G + 0.03 + H * 0.3 - 0.004, TZ, 0.008, 0.008, 0.02);
  }
  // Double-deck skybridge on levels 41–42
  const BY = G + 0.03 + H * 0.43, BL = 2 * X - 2 * A * 1.05;
  mbox(gp, '#aab5c2', 0, BY - 0.003, TZ, BL, 0.024, 0.019, 0.5);
  for (const dy of [0.0035, 0.0145]) box(gp, '#3f5168', 0, BY - 0.003 + dy, TZ, BL + 0.001, 0.0055, 0.0195);
  for (let k = 0; k <= 8; k++) box(gp, '#d5dce4', -BL / 2 + (k * BL) / 8, BY - 0.003, TZ, 0.0015, 0.024, 0.0198);
  lathe(gp, [[0.013, 0], [0.011, 0.006], [0.004, 0.01], [0, 0.011]], '#c3ccd6', 0, BY + 0.021, TZ, 8);
  mbox(gp, '#8d99a6', 0, BY - 0.016, TZ, 0.016, 0.013, 0.016, 0.5);
  mbox(gp, '#c3ccd6', 0, BY - 0.009, TZ, BL, 0.005, 0.006, 0.5);
};


// ---------------------------------------------------------------------------------------------------------
// Ming Great Wall in the Yanshan (八达岭/金山岭 type, 16th c.): grey fired-brick wall on a dressed-stone footing
// following the ridge crest, crenellated outer parapet (垛口) and low inner parapet (宇墙), two-storey hollow
// 敌台 towers with arched loopholes (one carrying a tiled 楼橹), scrub oak and pine on rocky slopes, and a few
// garrison soldiers in red 胖袄 coats and bowl helmets.
const greatwall: Builder = gp => {
  const WC = '#858075', brick = shade(WC, 0.84), walk = '#938e83', STONE = '#a29b8a';
  const curve = new THREE.CatmullRomCurve3([[-0.4, 0.19], [-0.3, 0.07], [-0.18, 0.15], [-0.02, 0.0], [0.12, -0.12], [0.27, -0.03], [0.36, -0.15], [0.42, -0.08]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const N = 260, path = curve.getSpacedPoints(N);
  const ridgeH = (u: number) => 0.15 + 0.15 * Math.sin(u * 9.5 + 0.4) ** 2 + 0.03 * Math.sin(u * 23 + 2);
  // Distance-to-wall field pre-sampled on a grid (bilinear lookup) — exact search per terrain vertex is slow
  const nearX = (x: number, z: number): [number, number] => {
    let best = 1e9, bu = 0;
    for (let k = 0; k <= N; k += 2) { const q = path[k], d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < best) { best = d; bu = k / N; } }
    return [Math.sqrt(best), bu];
  };
  const GN = 84, GS = 1.08 / GN, gd = new Float32Array((GN + 1) ** 2), gu = new Float32Array((GN + 1) ** 2);
  for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) { const [d, u] = nearX(-0.54 + i * GS, -0.54 + j * GS); gd[j * (GN + 1) + i] = d; gu[j * (GN + 1) + i] = u; }
  const near = (x: number, z: number): [number, number] => {
    const fx = Math.min(GN - 1e-6, Math.max(0, (x + 0.54) / GS)), fz = Math.min(GN - 1e-6, Math.max(0, (z + 0.54) / GS));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, o = j * (GN + 1) + i;
    const d = (gd[o] * (1 - tx) + gd[o + 1] * tx) * (1 - tz) + (gd[o + GN + 1] * (1 - tx) + gd[o + GN + 2] * tx) * tz;
    return [d, gu[tx < 0.5 ? (tz < 0.5 ? o : o + GN + 1) : (tz < 0.5 ? o + 1 : o + GN + 2)]];
  };
  const hf: HFn = (x, z) => {
    const [d, u] = near(x, z);
    const main = ridgeH(u) * Math.exp(-((d / 0.15) ** 1.1)) * (1 - 0.3 * sstep(0.38, 0.5, Math.hypot(x, z)));
    const sub = 0.14 * ridged(x * 4 + 3, z * 4) ** 2 * sstep(0.06, 0.2, d) + 0.016 * fbm(x * 14, 2, z * 14);
    return Math.max(0.004, main + sub * (1 - Math.exp(-((d / 0.1) ** 2)) * 0.7));
  };
  // Pre-sample the wall line so its crest hugs the ridge exactly
  const wy = path.map(q => 0.035 + hf(q.x, q.z));
  for (let it = 0; it < 2; it++) for (let k = 1; k < N; k++) wy[k] = (wy[k - 1] + wy[k] * 2 + wy[k + 1]) / 4;
  island(gp, 0.45, hf, '#5d6644', (x, y, z, _nx, ny) => {
    const g = fbm(x * 11, y * 6, z * 11), f = fbm(x * 30 + 5, y * 30, z * 30), dw = near(x, z)[0];
    // bare granite and thin grass along the crest so the brickwork reads against the scrub
    if (dw < 0.034) return mix(f > 0.5 ? '#827b6a' : '#958d7a', '#646a48', sstep(0.02, 0.034, dw));
    if (ny < 0.55 && g > 0.42) return hash3(Math.floor(x * 70), Math.floor(y * 70), Math.floor(z * 70)) > 0.4 ? '#857f72' : '#6c675d';
    if (ny < 0.7 && f > 0.62) return '#8a8263';
    return mix(mix('#4f5a39', '#6f7550', g), '#3f4a33', sstep(0.45, 0.7, f) * 0.8);
  }, { rings: 36, segs: 100, side: strataSide(['#6b6152', '#5d5446', '#776c5b', '#524a3e']) });
  // Wall body: lofted section (outer battlement parapet, walkway, low inner parapet)
  const HW = 0.017, WH = 0.03, PH = 0.009, PT = 0.0036;
  const rings: V3[][] = [];
  const dirs: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const a = path[Math.max(0, k - 1)], b = path[Math.min(N, k + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    dirs.push([dx / L, dz / L]);
    const q = path[k], yt = wy[k] + WH, yb = Math.min(wy[k] - 0.025, 0.035 + hf(q.x + nx * HW, q.z + nz * HW) - 0.006, 0.035 + hf(q.x - nx * HW, q.z - nz * HW) - 0.006);
    const P = (o: number, y: number): V3 => [q.x + nx * o, y, q.z + nz * o];
    rings.push([P(-HW - 0.002, yb), P(-HW, yt + PH), P(-HW + PT, yt + PH), P(-HW + PT, yt), P(HW - PT, yt), P(HW - PT, yt + PH * 0.5), P(HW, yt + PH * 0.5), P(HW + 0.002, yb)]);
  }
  skin(gp, rings, WC, {
    flat: true, closed: true, caps: true,
    paint: (x, y, z, _nx, ny) => (ny > 0.8 ? (Math.floor(y * 700) % 2 ? walk : shade(walk, 0.84)) : Math.floor(y * 260 + (x + z) * 3) % 3 === 0 ? brick : hash3(Math.floor(x * 300), Math.floor(y * 300), Math.floor(z * 300)) > 0.8 ? shade(WC, 1.08) : null),
  });
  // Merlons along the outer parapet
  for (let k = 2; k < N - 1; k += 3) {
    const q = path[k], [dx, dz] = dirs[k];
    box(gp, WC, q.x + dz * (HW - PT / 2), wy[k] + WH + PH, q.z - dx * (HW - PT / 2), 0.0075, 0.0075, PT + 0.001, -Math.atan2(dz, dx));
  }
  // Watchtowers (two-storey brick towers with arched windows, crenellated roofs, two with tiled pavilions)
  const towers = [0.1, 0.27, 0.45, 0.62, 0.8, 0.94];
  for (const [ti, u] of towers.entries()) {
    const k = Math.round(u * N), q = path[k], [dx, dz] = dirs[k], ry = -Math.atan2(dz, dx);
    const tg = grp(gp, q.x, q.z, ry, wy[k] - 0.02);
    tg.scale.setScalar(1.35);
    const W = 0.044, D = 0.04, H = 0.062;
    box(tg, shade(WC, 0.95), 0, 0, 0, W, H, D);
    box(tg, STONE, 0, 0, 0, W + 0.004, 0.026, D + 0.004);
    box(tg, shade(WC, 1.06), 0, H - 0.005, 0, W + 0.005, 0.003, D + 0.005);
    box(tg, shade(WC, 1.06), 0, H - 0.018, 0, W + 0.002, 0.002, D + 0.002);
    for (const [fx, fz, len] of [[0, 1, W], [0, -1, W], [1, 0, D], [-1, 0, D]] as const) {
      const n = 3, ry = fx ? Math.PI / 2 : 0;
      for (let j = 0; j < n; j++) {
        const o = -len / 2 + ((j + 0.5) * len) / n, wx = fx ? fx * (W / 2) : o, wz = fz ? fz * (D / 2) : o;
        add(tg, ARCHW(), mat('#2a221c'), wx, H - 0.036, wz, 0.0075, 0.014, 0.003, ry);
      }
      if (fz === 1) add(tg, ARCHW(), mat('#2a221c'), 0, 0.026, D / 2, 0.009, 0.016, 0.003);
      const nm = 5;
      for (let j = 0; j < nm; j++) {
        const o = -len / 2 + 0.003 + (j * (len - 0.006)) / (nm - 1);
        box(tg, WC, fx ? fx * (W / 2 + 0.001) : o, H, fz ? fz * (D / 2 + 0.001) : o, fx ? 0.004 : 0.005, 0.007, fz ? 0.004 : 0.005);
      }
    }
    if (ti % 3 === 1) roof(tg, { y: H + 0.002, w: 0.036, d: 0.03, h: 0.022, ridge: 0.012, lift: 0.004, th: 0.004, tile: '#5d6460', eave: '#3f4542', under: '#7a3a2e', ridgeH: 0.003, hipR: 0.0018, step: 0.008, nr: 4 });
    else box(tg, '#8a8070', 0, H + 0.002, 0, 0.016, 0.01, 0.014);
  }
  // Scrub oak, thorn and scattered Chinese pine on the slopes, keeping the wall corridor clear
  scatter(420, 41, (x, z, i) => {
    const [d] = near(x, z);
    if (d < 0.045 || fbm(x * 9 + 2, 1, z * 9) < 0.38) return;
    const y = 0.035 + hf(x, z) - 0.002, s = hash3(i, 5, 5);
    if (i % 6 === 0) pine(gp, x, y, z, 0.026 + s * 0.012, '#3b4a34');
    else lowball(gp, ['#4c5638', '#58603e', '#636645', '#4a5136'][i % 4], x, y + 0.004, z, 0.02 + s * 0.014, 0.013 + s * 0.006, 0.02 + s * 0.012, s * 3);
  }, 0.41);
  // Garrison soldiers in red padded coats and bowl helmets patrolling the walkway
  for (const [i, k] of [44, 70, 150, 205].entries()) {
    const [dx, dz] = dirs[k];
    human(gp, path[k].x, wy[k] + WH, path[k].z, {
      h: 0.02, ry: Math.atan2(dx, dz) + (i % 2 ? Math.PI : 0), pose: 'walk', phase: i * 0.7, top: '#7e3a2e', bottom: '#4a3a2e', skin: '#c49a76', hair: '#1d1915',
      hat: '#4f4c47', hatStyle: 'bowl', armor: '#7e3a2e', armorTrim: '#4a4038', shoes: '#2a2420', detail: 'lo',
    });
  }
};

// ---------------------------------------------------------------------------------------------------------
// N Seoul Tower on forested Namsan — shaft, lattice rings, observation pod and antenna mast
const namsan: Builder = (gp, r) => {
  const WH = r.color ?? '#e8e8f0';
  const SX = 0, SZ = -0.04;
  const hf: HFn = (x, z) => {
    const rr = Math.hypot((x - SX) * 1.1, z - SZ);
    const m = (1 - sstep(0.27, 0.36, rr)) * 0.21 * Math.exp(-((rr / 0.24) ** 1.6)) * (1 + 0.15 * fbm(x * 7, 0, z * 7)) + 0.02 * ridged(x * 6, z * 6 + 1) * sstep(0.35, 0.1, rr);
    return Math.max(0.006, Math.min(m, 0.2)) + 0.002 * fbm(x * 20, 3, z * 20);
  };
  const H0 = 0.035 + hf(SX, SZ);
  const city = (x: number, z: number) => hf(x, z) < 0.012;
  island(gp, 0.5, hf, '#3f6b34', (x, y, z, _nx, ny) => {
    if (city(x, z)) return Math.abs(Math.hypot(x, z) - 0.43) < 0.012 ? '#3f444b' : '#9ca3af';
    if (Math.hypot(x - SX, z - SZ) < 0.06 && ny > 0.85) return '#bdb6a8';
    if (ny < 0.65) return '#7a7468';
    const g = fbm(x * 13, y * 8, z * 13), c = hash3(Math.floor(x * 95), Math.floor(y * 95), Math.floor(z * 95));
    if (c > 0.985) return c > 0.993 ? '#c27a2a' : '#a34a2a';
    return c > 0.72 ? '#284f27' : c < 0.14 ? '#5b8a45' : mix('#2f5a2e', '#4f7f3e', g);
  }, { rings: 36, segs: 100, side: strataSide(EARTH) });
  const gy = onGround(hf);
  // Forest canopy
  scatter(170, 55, (x, z, i) => {
    if (city(x, z) || Math.hypot(x - SX, z - SZ) < 0.08) return;
    const c = i % 11 === 0 ? '#c27a2a' : i % 13 === 0 ? '#a34a2a' : ['#2f5a2e', '#3d6b36', '#4a7a3e', '#355e30'][i % 4];
    lowball(gp, c, x, gy(x, z) + 0.008, z, 0.03 + hash3(i, 5, 5) * 0.012, 0.024, 0.03, i);
  }, 0.34);
  // Seoul around the foot of the mountain
  const pal = ['#a3a8b0', '#c2bcb0', '#8d939b', '#d0d4d8', '#b8a58c'];
  for (let i = 0; i < 66; i++) {
    const a = (i / 66) * Math.PI * 2 + hash3(i, 1, 1) * 0.05, rr = i % 3 === 0 ? 0.462 : 0.38 + hash3(i, 2, 2) * 0.025;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!city(x, z) || Math.abs(Math.hypot(x, z) - 0.43) < 0.02) continue;
    const h = 0.015 + hash3(i, 3, 3) ** 2 * 0.09, w = i % 3 === 0 ? 0.02 : 0.022 + hash3(i, 4, 4) * 0.014;
    const bg = grp(gp, x, z, -a);
    bandLoft(bg, sqPlan, 0, 0, 0.039, 0.039 + h, w, w, 0.008, 0.55, pal[i % pal.length], '#4b5563', { metal: 0.15 });
  }
  // Hanyangdoseong fortress wall climbing the ridge
  const wall: V3[] = [];
  for (let k = 0; k <= 30; k++) { const t = k / 30, x = -0.34 + t * 0.3, z = 0.12 - t * 0.12 + 0.03 * Math.sin(t * 5); wall.push([x, gy(x, z) + 0.006, z]); }
  for (let k = 0; k < wall.length - 1; k++) {
    const [ax, ay, az] = wall[k], [bx, by, bz] = wall[k + 1];
    box(gp, '#c9c0ae', (ax + bx) / 2, Math.min(ay, by) - 0.004, (az + bz) / 2, Math.hypot(bx - ax, bz - az) + 0.002, Math.abs(by - ay) + 0.01, 0.006, -Math.atan2(bz - az, bx - ax));
  }
  // Palgakjeong octagonal pavilion and the Namsan cable car
  const pvx = SX + 0.07, pvz = SZ + 0.06, pvy = gy(pvx, pvz);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cyl(gp, '#a33a2e', pvx + Math.cos(a) * 0.012, pvy, pvz + Math.sin(a) * 0.012, 0.0015, 0.016, 5); }
  box(gp, '#b8b0a0', pvx, pvy - 0.003, pvz, 0.032, 0.004, 0.032);
  roof(gp, { x: pvx, z: pvz, y: pvy + 0.016, w: 0.04, d: 0.04, h: 0.016, ridge: 0, lift: 0.004, th: 0.004, tile: '#4f5a55', eave: '#2f6a4a', under: '#2f7a5a', step: 0.008, nr: 4, hipR: 0.0015, ridgeH: 0.002 });
  const ca: V3 = [0.36, 0.06, 0.2], cb: V3 = [SX + 0.05, H0 - 0.02, SZ + 0.02];
  rod(gp, ca, cb, 0.0007, '#334155', 4);
  box(gp, '#d9d4c7', ca[0], 0.039, ca[2], 0.03, 0.022, 0.024);
  for (const t of [0.35, 0.7]) {
    const q: V3 = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    box(gp, t < 0.5 ? '#ef4444' : '#facc15', q[0], q[1] - 0.012, q[2], 0.01, 0.009, 0.008);
  }
  // Summit plaza and N Seoul Tower Plaza: a round, glazed multi-storey drum wrapped around the shaft foot
  const TX = SX, TZ = SZ - 0.03, STEEL = '#59616b', DARK = '#2c3238';
  box(gp, '#cfc8b8', SX, H0 - 0.01, SZ, 0.15, 0.012, 0.13);
  cyl(gp, '#e6e2d8', TX, H0, TZ, 0.064, 0.006, 24);
  bandLoft(gp, circ(24), TX, TZ, H0 + 0.006, H0 + 0.04, 0.058, 0.056, 0.0085, 0.22, '#e9edf0', '#5d8f9c', { metal: 0.3 });
  cyl(gp, '#f2f0ea', TX, H0 + 0.04, TZ, 0.06, 0.003, 24);
  box(gp, '#e6e2d8', SX + 0.035, H0, SZ + 0.035, 0.05, 0.02, 0.03);
  bandLoft(gp, circ(12), SX - 0.06, SZ + 0.02, H0, H0 + 0.022, 0.02, 0.02, 0.0075, 0.25, '#e9edf0', '#5d8f9c', { metal: 0.3 });
  // Shaft: white, slightly tapering reinforced-concrete column
  const TY = H0 + 0.04, TH = 0.3;
  lathe(gp, [[0.0235, -0.005], [0.022, 0.03], [0.019, 0.15], [0.0165, TH]], WH, TX, TY, TZ, 18);
  // Two steel transmission rings: radial lattice dishes and a glazed equipment cage between them
  const ring = (y: number, R: number) => {
    lathe(gp, [[0.02, -0.012], [R * 0.75, -0.004], [R, -0.0005], [R, 0.0025], [0.02, 0.0025]], STEEL, TX, y, TZ, 20).material = mat(STEEL, { metal: 0.5, rough: 0.45 });
    lathe(gp, [[R + 0.0005, 0], [R + 0.0005, 0.004], [R - 0.001, 0.004]], '#9aa3ad', TX, y + 0.0025, TZ, 20);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      rod(gp, [TX + c * 0.019, y - 0.013, TZ + s * 0.019], [TX + c * R, y - 0.001, TZ + s * R], 0.0009, '#b4bcc6', 3);
    }
  };
  const R1 = TY + TH * 0.3, R2 = TY + TH * 0.42;
  ring(R1, 0.048); ring(R2, 0.046);
  bandLoft(gp, circ(14), TX, TZ, R1 + 0.0025, R2 - 0.012, 0.028, 0.027, 0.006, 0.3, '#9aa3ad', '#3d4d5a', { metal: 0.4 });
  for (const [dy, a] of [[0.012, 0.6], [0.022, 2.4], [0.016, 4.1]] as const) {
    const dish = cyl(gp, '#e5e7eb', TX + Math.cos(a) * 0.03, R1 + dy, TZ + Math.sin(a) * 0.03, 0.006, 0.002, 10);
    dish.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2, 'YXZ');
  }
  // Observation pod: dark flared underside, dark glass decks with mullions, crown with petal fins
  const PY = TY + TH;
  lathe(gp, [[0.016, -0.034], [0.024, -0.026], [0.036, -0.012], [0.043, -0.002], [0.044, 0]], DARK, TX, PY, TZ, 24).material = mat(DARK, { metal: 0.3, rough: 0.6 });
  cyl(gp, '#4a525b', TX, PY, TZ, 0.0445, 0.003, 24);
  bandLoft(gp, circ(24), TX, TZ, PY + 0.003, PY + 0.033, 0.042, 0.04, 0.0075, 0.18, '#7d868f', '#26333d', { metal: 0.35 });
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    box(gp, '#9aa3ad', TX + Math.cos(a) * 0.0405, PY + 0.003, TZ + Math.sin(a) * 0.0405, 0.0012, 0.03, 0.0012, -a);
  }
  lathe(gp, [[0.0415, 0], [0.04, 0.004], [0.033, 0.008], [0.024, 0.011], [0.016, 0.012]], '#59616b', TX, PY + 0.033, TZ, 24);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const fin = slab(grp(gp, TX, TZ, -a, PY + 0.04), [[0.012, 0], [0.034, 0], [0.026, 0.008], [0.016, 0.02]], 0.0012, '#a7b5b0', 0, true);
    fin.rotation.y = Math.PI / 2;
  }
  // Antenna: steel lattice mast in red/white sections with platform rings, a mid-height bulb and beacon
  const AY = PY + 0.045;
  cyl(gp, '#6b7280', TX, AY, TZ, 0.013, 0.012, 10);
  for (let k = 0; k < 7; k++) {
    const y0 = AY + 0.012 + k * 0.021, r0 = 0.0095 - k * 0.0011, r1 = r0 - 0.0011;
    lathe(gp, [[r0, 0], [r1, 0.021]], k % 2 ? '#d94a3a' : '#e8e8e8', TX, y0, TZ, 6).material = mat(k % 2 ? '#d94a3a' : '#e8e8e8', { metal: 0.3, rough: 0.5, flat: true });
    if (k === 1 || k === 3) cyl(gp, '#9aa3ad', TX, y0 + 0.02, TZ, r0 + 0.006, 0.0025, 10);
  }
  add(gp, SPHL(), mat('#8b939c', { metal: 0.4 }), TX, AY + 0.07, TZ, 0.022, 0.016, 0.022);
  cyl(gp, '#9aa3ad', TX, AY + 0.159, TZ, 0.0015, 0.03, 5);
  add(gp, SPHL(), mat('#ef4444', { emissive: '#ef4444' }), TX, AY + 0.19, TZ, 0.005, 0.005, 0.005);
  // Visitors on the plaza
  const pc = ['#ef4444', '#2563eb', '#f8fafc', '#facc15'];
  for (let i = 0; i < 6; i++) person(gp, SX - 0.05 + i * 0.02, H0 + 0.002, SZ + 0.052, pc[i % 4], 0.8);
};

export const ASIA: Record<string, Builder> = { forbidden, gyeongbok, kinkakuji, angkor, taipei101, petronas, greatwall, namsan };
