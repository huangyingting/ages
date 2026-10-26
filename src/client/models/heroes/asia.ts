import { human } from '../human.ts';
import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, mat, box, cyl, ball, rbox, rod, sweep, lathe, slab, skin, 
  shade, mix, fbm, hash3,
} from '../prims.ts';
import { type HFn, island, sstep, ridged, strataSide, scatter, pine } from '../nature.ts';

// Hero builders for: forbidden, gyeongbok, kinkakuji, angkor, taipei101, petronas, greatwall, namsan.

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
const SPHL = () => g7();
let _g7: THREE.SphereGeometry | null = null;
function g7(): THREE.SphereGeometry { return (_g7 ??= new THREE.SphereGeometry(0.5, 6, 4)); }
/** Low-poly blob (shrubs, canopies, rocks). */
const lowball = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0) => add(p, SPHL(), mat(c), x, y, z, sx, sy, sz, ry);
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
export const ASIA: Record<string, Builder> = { forbidden, greatwall };
