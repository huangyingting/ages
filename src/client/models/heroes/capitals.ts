import * as THREE from 'three';
import { type Builder, type V3, add, mat, g, box, rbox, cyl, cone, ellip, lathe, rod, skin, slab, gable, tbox, prism, shade, hash3 } from '../prims.ts';
import { grp } from '../timber.ts';
import { human, type HumanOpts } from '../human.ts';

// Dynastic capitals, one model per capital (pack "capitals"): Erlitou, Shang Yinxu, the Western Zhou Fengchu courtyard,
// Eastern Zhou Luoyi (天子驾六), Qin Xianyang, Western Han Weiyang, Eastern Han Luoyang (灵台/太学), Wei–Jin Luoyang 太极殿,
// Six Dynasties Jiankang, the Tang Hanyuan Hall, the Song Xuande Gate, Southern Song Lin'an, Yuan Dadu's Daming Hall and the
// ROC Nanjing gateway. Ming–Qing keep `palace`. Front faces +z, base at y=0, footprint ≈ ±0.45, same overall size and
// height (~0.4) as `palace` so they read as one family on the map.
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const C = {
  earth: '#b8925e', earthTop: '#c7a574', loess: '#a88a5e', straw: '#cdb173', wood: '#6b4a30', darkwood: '#43301f', daub: '#dccaa0',
  plaster: '#e8e0cc', vermilion: '#a8352a', grey: '#5b5f66', greyTile: '#6c6f72', black: '#2c2d31', marble: '#e4ded0', jade: '#2f7d6d',
  green: '#3f8a62', blue: '#2f7a8f', gold: '#d6a840', stone: '#a7a297', paving: '#c3b9a4', grass: '#7d8a52', bronze: '#8a6a3a',
};

// ---- shared kit -----------------------------------------------------------------------------------------------

/** Low rectangular ground plinth every capital stands on; returns its top height. */
function plinth(p: THREE.Object3D, w: number, d: number, top: string, side = shade(top, 0.72)): number {
  rbox(p, side, 0, 0, 0, w, 0.014, d, 0.006);
  box(p, top, 0, 0.014, 0, w - 0.012, 0.003, d - 0.012);
  return 0.017;
}

/** Rammed-earth (夯土) block, tapered, with the horizontal tamping layers painted as bands. */
function earth(p: THREE.Object3D, x: number, y: number, z: number, w0: number, d0: number, w1: number, d1: number, h: number, c: string, bands = 3, top = shade(c, 1.08)): number {
  const rings: V3[][] = [];
  for (let i = 0; i <= bands; i++) {
    const t = i / bands, hw = (w0 + (w1 - w0) * t) / 2, hd = (d0 + (d1 - d0) * t) / 2, yy = y + h * t;
    rings.push([[x - hw, yy, z - hd], [x + hw, yy, z - hd], [x + hw, yy, z + hd], [x - hw, yy, z + hd]]);
  }
  skin(p, rings, c, { caps: true, flat: true, paint: (_x, py, _z, _nx, ny) => (ny > 0.6 ? top : Math.floor(((py - y) / h) * bands) % 2 ? shade(c, 0.9) : c) });
  return y + h;
}

function tris(): { pos: number[]; col: number[]; t: (a: V3, b: V3, c: V3, color: string) => void } {
  const pos: number[] = [], col: number[] = [], tmp = new THREE.Color();
  return {
    pos, col,
    t(a, b, c, color) {
      tmp.set(color);
      pos.push(...a, ...b, ...c);
      for (let k = 0; k < 3; k++) col.push(tmp.r, tmp.g, tmp.b);
    },
  };
}
function polyMesh(p: THREE.Object3D, pos: number[], col: number[]): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return add(p, geo, mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
}

interface RoofO {
  tile: string; k?: number; lift?: number; rib?: string | null; under?: string; fascia?: string; edge?: string; thatch?: boolean;
  /** skirt (腰檐/副阶) mode: stop where the slope meets a wall of this [w, d]; h is then the rise to that wall. */
  inner?: [number, number];
  /** half-hip (歇山): stop the hip at this fraction and finish with a gable. */
  xie?: number;
  ridge?: string | null; chi?: string; chiH?: number; th?: number;
}
/**
 * Hip roof (庑殿/四阿) over eaves w×d with a concave slope (k), upswept corners (lift) and tile ribs painted as narrow
 * alternating columns. Also makes skirts (inner) and half-hip roofs (xie). Returns the top height.
 */
function roof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: RoofO): number {
  const hx0 = w / 2, hz0 = d / 2, rz = Math.min(0.004, hz0 * 0.04), ins = hz0 - rz;
  const k = o.k ?? 0.35, lift = o.lift ?? 0, th = o.th ?? (o.thatch ? 0.014 : 0.006);
  const f = (t: number) => t * (1 - k) + k * t * t;
  let tTop = 1;
  if (o.inner) tTop = clamp((hz0 - o.inner[1] / 2) / ins, 0.05, 1);
  else if (o.xie) tTop = o.xie;
  const H = o.inner ? h / f(tTop) : h;
  const T = [0, 0.1, 0.22, 0.37, 0.55, 0.76, 1].map(t => t * tTop);
  const Lz = Math.min(hz0, hx0) * 0.95;
  const sp = o.thatch ? 0.03 : 0.0115;
  const nx = Math.max(4, Math.round(w / sp)), nz = Math.max(3, Math.round(d / sp));
  const per: [number, number][] = [];
  for (const [s, n] of [[0, nx], [1, nz], [2, nx], [3, nz]]) for (let i = 0; i < n; i++) per.push([s, i / n]);
  const P = (s: number, u: number, t: number, dy: number): V3 => {
    const hx = hx0 - t * ins, hz = hz0 - t * ins;
    let px: number, pz: number, L: number;
    if (s === 0) { px = -hx + 2 * hx * u; pz = hz; L = w; } else if (s === 1) { px = hx; pz = hz - 2 * hz * u; L = d; } else if (s === 2) { px = hx - 2 * hx * u; pz = -hz; L = w; } else { px = -hx; pz = -hz + 2 * hz * u; L = d; }
    const c = Math.max(0, 1 - (Math.min(u, 1 - u) * L) / Lz) ** 2 * (1 - t) ** 1.5, o2 = c * lift * hz0 * 0.16;
    return [x + px + Math.sign(px) * o2, y + H * f(t) + dy + c * lift * hz0 * 0.42, z + pz + Math.sign(pz) * o2];
  };
  const R = [per.map(([s, u]) => P(s, u, 0, -th)), ...T.map(t => per.map(([s, u]) => P(s, u, t, 0)))];
  const n = per.length, M = tris();
  const tile = o.tile, rib = o.rib === undefined ? shade(tile, 1.16) : o.rib, fascia = o.fascia ?? shade(tile, 0.68), under = o.under ?? shade(tile, 0.55);
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, a = R[i][j], b = R[i][j1], c = R[i + 1][j1], e = R[i + 1][j];
    const col = i === 0 ? fascia : o.thatch ? (i % 2 ? tile : shade(tile, 0.9)) : i === 1 && o.edge ? o.edge : rib && j % 2 ? rib : tile;
    M.t(a, b, c, col);
    M.t(a, c, e, col);
  }
  const cen = (r: V3[]): V3 => { let sx = 0, sy = 0, sz = 0; for (const v of r) { sx += v[0]; sy += v[1]; sz += v[2]; } return [sx / r.length, sy / r.length, sz / r.length]; };
  const r0 = R[0], c0 = cen(r0);
  for (let j = 0; j < n; j++) M.t(c0, r0[(j + 1) % n], r0[j], under);
  const rt = R[R.length - 1], ct = cen(rt);
  if (!o.inner) for (let j = 0; j < n; j++) M.t(ct, rt[j], rt[(j + 1) % n], tile);
  polyMesh(p, M.pos, M.col);
  let top = y + H * f(tTop);
  if (o.inner) return top;
  const ridge = o.ridge === undefined ? shade(tile, 0.8) : o.ridge;
  if (o.xie) {
    const gw = 2 * (hx0 - tTop * ins), gd = 2 * (hz0 - tTop * ins), gh = gd * 0.55;
    gable(p, gw, gh, gd, tile, x, top, z);
    for (const sx of [-1, 1]) slab(grp(p, x + sx * (gw / 2 - 0.002), z, Math.PI / 2, top), [[-gd * 0.42, 0.002], [gd * 0.42, 0.002], [0, gh * 0.84]], 0.004, o.thatch ? shade(tile, 0.8) : C.plaster, 0, false);
    top += gh;
    if (ridge) box(p, ridge, x, top - 0.006, z, gw + 0.008, 0.01, 0.01);
    return top + 0.004;
  }
  const rl = Math.max(0.02, w - d + 2 * rz);
  if (ridge) {
    const rh = o.thatch ? 0.016 : 0.011;
    box(p, ridge, x, top - rh * 0.5, z, rl + 0.01, rh, o.thatch ? 0.02 : 0.012);
    top += rh * 0.5;
  }
  if (o.chi) for (const sx of [-1, 1]) chiwei(p, x + sx * (rl / 2 + 0.002), top - 0.004, z, sx, o.chiH ?? 0.03, o.chi);
  return top;
}

/** Owl-tail ridge finial (鸱尾) of Tang–Song roofs, curling inwards; sx = +1 for the right end. */
function chiwei(p: THREE.Object3D, x: number, y: number, z: number, sx: number, s: number, c: string): void {
  const out: [number, number][] = [[-0.45, 0], [0.4, 0], [0.55, 0.35], [0.45, 0.72], [0.18, 1], [-0.12, 0.98], [-0.05, 0.78], [-0.3, 0.62], [-0.45, 0.32]];
  const m = slab(grp(p, x, z, 0, y), out.map(([u, v]) => [u * s * 0.55 * sx, v * s] as [number, number]), s * 0.22, c, 0, true);
  m.castShadow = true;
}

interface BodyO { wall: string; col: string; beam?: string; bracket?: string; door?: string; doorN?: number; sp?: number; cr?: number; back?: boolean }
/** Timber hall body: wall core, columns all round, lintel band, optional bracket (斗拱) row and doors; returns the eave height. */
function body(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: BodyO): number {
  const cr = o.cr ?? 0.0045, sp = o.sp ?? 0.04;
  box(p, o.wall, x, y, z, w - cr * 2.4, h, d - cr * 2.4);
  const nW = Math.max(2, Math.round(w / sp)), nD = Math.max(1, Math.round(d / sp));
  for (let i = 0; i <= nW; i++) for (const sz of o.back === false ? [1] : [-1, 1]) cyl(p, o.col, x - w / 2 + (i * w) / nW, y, z + (sz * d) / 2, cr, h, 6);
  for (let i = 1; i < nD; i++) for (const sx of [-1, 1]) cyl(p, o.col, x + (sx * w) / 2, y, z - d / 2 + (i * d) / nD, cr, h, 6);
  const bh = Math.min(0.01, h * 0.14);
  box(p, o.beam ?? o.col, x, y + h - bh, z, w + 0.004, bh, d + 0.004);
  if (o.door) {
    const nd = Math.min(nW, o.doorN ?? nW), i0 = Math.floor((nW - nd) / 2), bw = w / nW;
    for (let i = i0; i < i0 + nd; i++) box(p, o.door, x - w / 2 + (i + 0.5) * bw, y, z + d / 2 - cr, bw * 0.72, h * 0.72, 0.004);
  }
  let top = y + h;
  if (o.bracket) {
    const bk = Math.min(0.012, h * 0.16);
    for (let i = 0; i <= nW; i++) for (const sz of [-1, 1]) box(p, o.bracket, x - w / 2 + (i * w) / nW, top, z + (sz * d) / 2, 0.011, bk, 0.011);
    for (let i = 0; i <= nD; i++) for (const sx of [-1, 1]) box(p, o.bracket, x + (sx * w) / 2, top, z - d / 2 + (i * d) / nD, 0.011, bk, 0.011);
    box(p, shade(o.bracket, 0.85), x, top + bk * 0.25, z, w - 0.006, bk * 0.7, d - 0.006);
    top += bk;
  }
  return top;
}

/** Balustrade around a w×d edge (posts + top rail), leaving a gap of `gap` in the front for stairs. */
function rail(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, c: string, gap = 0, h = 0.018, sides = [true, true, true, true]): void {
  const post = (px: number, pz: number) => box(p, c, px, y, pz, 0.006, h, 0.006);
  const bar = (x0: number, x1: number, pz: number) => x1 - x0 > 0.01 && box(p, c, (x0 + x1) / 2, y + h - 0.006, pz, x1 - x0, 0.005, 0.005);
  const barZ = (px: number, z0: number, z1: number) => box(p, c, px, y + h - 0.006, (z0 + z1) / 2, 0.005, 0.005, z1 - z0);
  const nW = Math.max(3, Math.round(w / 0.05)), nD = Math.max(2, Math.round(d / 0.05));
  if (sides[0]) {
    for (let i = 0; i <= nW; i++) { const px = x - w / 2 + (i * w) / nW; if (Math.abs(px - x) >= gap / 2) post(px, z + d / 2); }
    bar(x - w / 2, x - gap / 2, z + d / 2); bar(x + gap / 2, x + w / 2, z + d / 2);
  }
  if (sides[2]) { for (let i = 0; i <= nW; i++) post(x - w / 2 + (i * w) / nW, z - d / 2); bar(x - w / 2, x + w / 2, z - d / 2); }
  for (const [si, sx] of [[1, 1], [3, -1]] as const) if (sides[si]) {
    for (let i = 1; i < nD; i++) post(x + (sx * w) / 2, z - d / 2 + (i * d) / nD);
    barZ(x + (sx * w) / 2, z - d / 2, z + d / 2);
  }
}

/** Solid staircase rising towards -z: bottom edge at zf on y0, top at y0+h after `run`. */
function steps(p: THREE.Object3D, x: number, y0: number, zf: number, w: number, h: number, run: number, c: string, n = 6): void {
  for (let i = 0; i < n; i++) box(p, i % 2 ? shade(c, 0.94) : c, x, y0, zf - (run * (i + 0.5)) / n, w, (h * (i + 1)) / n, run / n);
}

/** Sloping ramp (慢道) rising towards -z. */
function ramp(p: THREE.Object3D, x: number, y0: number, zf: number, w: number, h: number, run: number, c: string): void {
  tbox(p, w, run, w, 0.002, h, c, x, y0, zf - run / 2, 0, -run / 2 + 0.001);
}

/** Covered corridor (廊) from (x1,z1) to (x2,z2): posts both sides, optional back wall, gable roof. */
function corridor(p: THREE.Object3D, x1: number, z1: number, x2: number, z2: number, y: number, h: number, dep: number, roofC: string, colC: string, o: { wall?: string; rh?: number; ov?: number } = {}): number {
  const L = Math.hypot(x2 - x1, z2 - z1), gr = grp(p, (x1 + x2) / 2, (z1 + z2) / 2, -Math.atan2(z2 - z1, x2 - x1), y);
  const n = Math.max(1, Math.round(L / 0.04));
  for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) cyl(gr, colC, -L / 2 + (i * L) / n, 0, (sz * dep) / 2, 0.0035, h, 5);
  if (o.wall) box(gr, o.wall, 0, 0, 0, L, h, dep * 0.25);
  box(gr, colC, 0, h - 0.006, 0, L, 0.006, dep + 0.004);
  const rh = o.rh ?? dep * 0.45, ov = o.ov ?? 0.022;
  gable(gr, L + ov, rh, dep + ov * 1.6, roofC, 0, h, 0);
  box(gr, shade(roofC, 0.78), 0, h + rh - 0.004, 0, L + ov, 0.008, 0.008);
  return y + h + rh;
}

/** Open covered gallery (廊) running along z from z0 to z1: two rows of posts and a hip roof with the given options. */
function galleryZ(p: THREE.Object3D, x: number, y: number, z0: number, z1: number, dep: number, h: number, rise: number, col: string, o: RoofO, wall?: string): void {
  const L = Math.abs(z1 - z0), zm = (z0 + z1) / 2, n = Math.max(1, Math.round(L / 0.04));
  for (let i = 0; i <= n; i++) for (const sx of [-1, 1]) cyl(p, col, x + (sx * dep) / 2, y, Math.min(z0, z1) + (i * L) / n, 0.0035, h, 5);
  if (wall) box(p, wall, x, y, zm, dep * 0.25, h, L);
  for (const sx of [-1, 1]) box(p, col, x + (sx * dep) / 2, y + h - 0.006, zm, 0.007, 0.006, L);
  roof(grp(p, x, zm, Math.PI / 2, 0), 0, y + h, 0, L + 0.02, dep + 0.03, rise, o);
}

/**
 * A period figure about one storey (~3 m at diorama scale) tall in an ankle-length robe. Hand-held weapons are left out
 * on purpose: at this size a spear shaft would be a hairline.
 */
function figure(p: THREE.Object3D, x: number, y: number, z: number, h: number, robe: string, o: { hat?: HumanOpts['hatStyle']; hatC?: string; ry?: number; armor?: string; pose?: HumanOpts['pose']; phase?: number } = {}): void {
  human(p, x, y, z, {
    h, ry: o.ry ?? 0, pose: o.pose ?? 'stand', phase: o.phase ?? 0, top: robe, bottom: shade(robe, 0.8), skin: '#c49a76', hair: '#1d1915',
    hat: o.hatC ?? '#24211e', hatStyle: o.hat ?? 'knot', dress: 'ankle', shoes: '#2a2420', detail: 'lo',
    ...(o.armor ? { armor: o.armor, armorTrim: shade(o.armor, 0.7) } : {}),
  });
}

/** Free-standing ring of columns (a 副阶 / veranda) with nx × nz bays and a lintel ring on top. */
function colonnade(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, nx: number, nz: number, c: string, r = 0.004): void {
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) cyl(p, c, x - w / 2 + (i * w) / nx, y, z + (sz * d) / 2, r, h, 6);
  for (let j = 1; j < nz; j++) for (const sx of [-1, 1]) cyl(p, c, x + (sx * w) / 2, y, z - d / 2 + (j * d) / nz, r, h, 6);
  for (const sz of [-1, 1]) box(p, c, x, y + h - 0.006, z + (sz * d) / 2, w + 0.006, 0.006, 0.007);
  for (const sx of [-1, 1]) box(p, c, x + (sx * w) / 2, y + h - 0.006, z, 0.007, 0.006, d);
}

/** Straight run of balustrade along x from x0 to x1 at z (posts + rail), optional gilt post caps. */
function railRun(p: THREE.Object3D, x0: number, x1: number, y: number, z: number, c: string, cap?: string, h = 0.016): void {
  const n = Math.max(1, Math.round((x1 - x0) / 0.04));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    box(p, c, x, y, z, 0.006, h, 0.006);
    if (cap) box(p, cap, x, y + h, z, 0.008, 0.004, 0.008);
  }
  box(p, c, (x0 + x1) / 2, y + h - 0.006, z, x1 - x0, 0.005, 0.005);
}

/** Deciduous tree with a lumpy low-poly crown. */
function tree(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#5f7f3e'): void {
  cyl(p, C.darkwood, x, y, z, s * 0.09, s * 0.55, 5);
  for (let i = 0; i < 3; i++) ellip(p, i ? shade(c, 1 + (hash3(x, i, z) - 0.5) * 0.2) : c, x + (i - 1) * s * 0.18, y + s * (0.7 + (i % 2) * 0.16), z + (hash3(z, i, x) - 0.5) * s * 0.3, s * 0.32, s * 0.28, s * 0.3);
}

// ---- builders ---------------------------------------------------------------------------------------------------

const GRASS = '#7c7858', GRASS_SIDE = '#5d5842', PAVE = '#a39b8a', PAVE_SIDE = '#7d7668';

/**
 * 二里头一号宫殿 (c. 1700 BC; also stands for the Shang palaces of 偃师/郑州/殷墟): a ~108×100 m rammed-earth platform with
 * its NE corner cut back, ringed by thatched corridors (廊庑) with a three-passage south gate; the 8×3-bay hall (30.4×11.4 m)
 * on its own earth base at the north under a double-eaved thatched hip roof (四阿重屋). Walls are wattle-and-daub.
 * Refs: 中国社科院考古所《偃师二里头》(1999); 杨鸿勋《宫殿考古通论》 reconstruction; https://zh.wikipedia.org/wiki/二里头遗址
 */
const cap_erlitou: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, GRASS, GRASS_SIDE);
  const E = '#9f8762', TOP = '#ad9671', TH = '#75684f', DAUB = '#b8a684', WD = '#46372a';
  const X0 = -0.42, X1 = 0.42, Z0 = -0.39, Z1 = 0.39, NX = 0.25, NZ = -0.27;
  const plan: [number, number][] = [[X0, Z1], [X1, Z1], [X1, NZ], [NX, NZ], [NX, Z0], [X0, Z0]];
  const inset = (k: number) => plan.map(([x, z]) => [x * k, z * k] as [number, number]);
  prism(gp, plan, y0, 0.011, shade(E, 0.9));
  prism(gp, inset(0.994), y0 + 0.011, 0.01, E);
  prism(gp, inset(0.99), y0 + 0.021, 0.002, TOP);
  const yp = y0 + 0.023;
  const th: RoofO = { tile: TH, thatch: true, k: 0.05, ridge: shade(TH, 0.78), under: '#5b4e38', fascia: shade(TH, 0.8), th: 0.01 };
  // 廊庑: an outer daub wall with a single row of posts on the court side, under a thatched roof
  const dep = 0.046, ch = 0.028, o = dep / 2 + 0.006;
  // ea/eb: how far the outer wall runs past each end (+ at outer corners, − at the inner corner of the notch, 0 at the gate)
  const range = (a: [number, number], b: [number, number], ea: number, eb: number) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = grp(gp, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), yp);
    box(g, DAUB, (eb - ea) / 2, 0, dep / 2 - 0.006, L + ea + eb, ch, 0.01);
    const n = Math.max(1, Math.round(L / 0.034));
    for (let i = 0; i <= n; i++) cyl(g, WD, -L / 2 + (i * L) / n, 0, -dep / 2 + 0.006, 0.0035, ch, 5);
    box(g, WD, 0, ch - 0.006, -dep / 2 + 0.006, L, 0.006, 0.007);
    const ra = Math.max(ea, 0) + 0.01, rb = Math.max(eb, 0) + 0.01;
    roof(g, (rb - ra) / 2, ch, 0, L + ra + rb, dep + 0.028, 0.026, th);
  };
  const gw = 0.19, cx = dep / 2, cc = -dep / 2 + 0.012;
  const inner: [number, number][] = [[X0 + o, Z1 - o], [X1 - o, Z1 - o], [X1 - o, NZ + o], [NX - o, NZ + o], [NX - o, Z0 + o], [X0 + o, Z0 + o]];
  range(inner[0], [-gw / 2, Z1 - o], cx, 0);
  range([gw / 2, Z1 - o], inner[1], 0, cx);
  range(inner[1], inner[2], cx, cx);
  range(inner[2], inner[3], cx, cc);
  range(inner[3], inner[4], cc, cx);
  range(inner[4], inner[5], cx, cx);
  range(inner[5], inner[0], cx, cx);
  // the south gate: three passages between daub piers (the outer two piers are the 塾 rooms)
  const gz = Z1 - o, gd = dep + 0.012, gh = ch + 0.008;
  for (const x of [-0.077, -0.025, 0.025, 0.077]) box(gp, DAUB, x, yp, gz, Math.abs(x) > 0.05 ? 0.036 : 0.016, gh, gd * 0.8);
  for (const x of [-0.095, -0.059, -0.025, 0.025, 0.059, 0.095]) for (const sz of [-1, 1]) cyl(gp, WD, x, yp, gz + (sz * gd) / 2, 0.004, gh, 5);
  box(gp, WD, 0, yp + gh - 0.006, gz, gw + 0.006, 0.006, gd + 0.006);
  roof(gp, 0, yp + gh, gz, gw + 0.045, gd + 0.04, 0.042, { ...th, k: 0.08 });
  steps(gp, 0, y0, Z1 + 0.035, 0.12, 0.023, 0.035, E, 3);
  // the hall (殿) on its own earth base, 8 × 3 bays, double-eaved thatched hip roof
  const hz = -0.2, yb = earth(gp, 0, yp, hz, 0.35, 0.2, 0.34, 0.19, 0.022, E, 2, TOP);
  const bw = 0.28, bd = 0.105, bh = 0.044;
  body(gp, 0, yb, hz, bw, bd, bh, { wall: DAUB, col: WD, beam: WD, sp: 0.035, cr: 0.0045, door: '#2b2219', doorN: 3 });
  roof(gp, 0, yb + bh, hz, bw + 0.06, bd + 0.06, 0.024, { ...th, inner: [bw - 0.05, bd - 0.03] });
  box(gp, DAUB, 0, yb + bh, hz, bw - 0.05, 0.036, bd - 0.03);
  roof(gp, 0, yb + bh + 0.036, hz, bw + 0.012, bd + 0.05, 0.085, { ...th, k: 0.1, th: 0.014 });
  for (const sx of [-1, 1]) steps(gp, sx * 0.07, yp, hz + 0.095 + 0.03, 0.04, 0.022, 0.03, E, 3);
  // court life: attendants in undyed hemp
  const robes = ['#6f604a', '#80705a', '#5d5040', '#74674f', '#685a46'];
  figure(gp, -0.03, yp, 0.27, 0.028, robes[0], { ry: Math.PI });
  figure(gp, 0.05, yp, 0.06, 0.028, robes[1], { pose: 'walk', phase: 0.3, ry: -2.6 });
  figure(gp, -0.12, yp, 0.0, 0.028, robes[2], { ry: 0.6 });
  figure(gp, 0.07, yb, hz + 0.075, 0.028, robes[3]);
  figure(gp, 0.03, y0, 0.425, 0.028, robes[4], { pose: 'walk', ry: Math.PI, phase: 0.6 });
  tree(gp, 0.34, y0, -0.35, 0.075, '#5f7340');
  tree(gp, 0.4, y0, -0.31, 0.06, '#66784a');
};

/**
 * 岐山凤雏甲组建筑 (Western Zhou, c. 11th c. BC), the earliest known two-court 四合院: a 32.5×45.2 m rammed-earth platform
 * 1.3 m high — screen wall (影壁) before the gate and its two 塾 rooms, front court, the 6-bay front hall (前堂, 17.2×6.1 m)
 * with three stairs, a 过廊 to the rear rooms (后室) and full-length east/west wings. Thatched roofs, tiles only on ridges.
 * Refs: 陕西周原考古队《陕西岐山凤雏村西周建筑基址发掘简报》(文物1979.10); 傅熹年 reconstruction; https://zh.wikipedia.org/wiki/凤雏遗址
 */
const cap_zhou: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, GRASS, GRASS_SIDE);
  const L = '#a38b66', LT = '#b09a76', TH = '#75684f', RT = '#5c5f62', PL = '#cfc4a9', WD = '#4a3a2b', DOOR = '#2e261d';
  const s = 0.016, W = 32.5 * s, D = 45.2 * s, zc = -0.03, zs = zc + D / 2;
  const M = (m: number) => zs - m * s;
  const yp = earth(gp, 0, y0, zc, W + 0.01, D + 0.01, W, D, 0.022, L, 2, LT);
  /** 悬山 thatched roof with a tile-capped ridge; ridge along x (ry = 0) or z (ry = π/2). */
  const thatch = (x: number, y: number, z: number, len: number, dep: number, rise: number, ry = 0) => {
    gable(gp, len, rise, dep, TH, x, y, z, ry);
    box(gp, shade(TH, 0.78), x, y - 0.004, z, ry ? dep : len, 0.004, ry ? len : dep);
    box(gp, RT, x, y + rise - 0.006, z, ry ? 0.012 : len + 0.004, 0.009, ry ? len + 0.004 : 0.012);
  };
  const eh = 0.045, wx = W / 2;
  // east and west wings (厢房): rammed-earth outer wall, rooms, a veranda on the court side, eight doors each
  for (const sx of [-1, 1]) {
    box(gp, L, sx * (wx - 0.006), yp, zc, 0.012, eh, D);
    box(gp, PL, sx * (wx - 0.04), yp, zc, 0.056, eh, D - 0.01);
    for (let i = 0; i < 8; i++) box(gp, DOOR, sx * (wx - 0.068), yp, zs - 0.12 - (i * (D - 0.24)) / 7, 0.004, 0.03, 0.02);
    const n = 16;
    for (let i = 0; i <= n; i++) cyl(gp, WD, sx * (wx - 0.09), yp, zs - 0.005 - (i * (D - 0.01)) / n, 0.0035, eh, 5);
    box(gp, WD, sx * (wx - 0.09), yp + eh - 0.006, zc, 0.007, 0.006, D - 0.01);
    thatch(sx * (wx - 0.048), yp + eh, zc, D + 0.02, 0.112, 0.042, Math.PI / 2);
  }
  // south range: the gate passage (门道, 3 m) between the two 塾 rooms, one roof over all
  const gz = M(3), iw = wx - 0.096;
  for (const sx of [-1, 1]) {
    box(gp, PL, sx * (0.024 + (iw - 0.024) / 2), yp, gz, iw - 0.024, eh, 0.07);
    box(gp, DOOR, sx * 0.06, yp, gz - 0.036, 0.022, 0.03, 0.004);
  }
  for (let i = 0; i <= 7; i++) for (const sz of [-1, 1]) cyl(gp, WD, -iw + (i * 2 * iw) / 7, yp, gz + sz * 0.042, 0.0035, eh, 5);
  thatch(0, yp + eh, gz, 2 * iw + 0.02, 0.118, 0.044);
  steps(gp, 0, y0, zs + 0.032, 0.05, 0.022, 0.032, L, 3);
  // the screen wall (影壁) 4 m in front of the gate: lime-plastered rammed earth with a small thatched coping
  earth(gp, 0, y0, zs + 0.072, 0.08, 0.02, 0.077, 0.018, 0.034, PL, 1, PL);
  gable(gp, 0.088, 0.012, 0.032, TH, 0, y0 + 0.034, zs + 0.072);
  // the front hall (前堂): 6 × 3 bays with a veranda all round, on a slightly raised base; three stairs in front
  const hz = M(23), yh = yp + 0.012;
  earth(gp, 0, yp, hz, 0.322, 0.15, 0.316, 0.144, 0.012, L, 1, LT);
  box(gp, PL, 0, yh, hz, 0.262, eh + 0.008, 0.088);
  for (let i = 0; i < 6; i++) if (i === 2 || i === 3) box(gp, DOOR, -0.131 + (i + 0.5) * 0.0437, yh, hz + 0.045, 0.026, 0.036, 0.004);
  colonnade(gp, 0, yh, hz, 0.296, 0.126, eh + 0.008, 6, 3, WD, 0.004);
  roof(gp, 0, yh + eh + 0.008, hz, 0.352, 0.182, 0.088, { tile: TH, thatch: true, k: 0.08, ridge: RT, under: '#5b4e38', fascia: shade(TH, 0.8), th: 0.012 });
  for (const x of [-0.09, 0, 0.09]) steps(gp, x, yp, hz + 0.075 + 0.018, 0.03, 0.012, 0.018, L, 2);
  // 过廊 to the rear range and the rear rooms (后室) along the north edge
  const rz = M(42.1);
  corridor(gp, 0, hz - 0.075, 0, rz + 0.04, yp, eh - 0.004, 0.048, TH, WD, { rh: 0.03, ov: 0.016 });
  box(gp, PL, 0, yp, rz, 2 * iw, eh, 0.07);
  for (let i = 0; i < 5; i++) box(gp, DOOR, -iw + 0.03 + (i * (2 * iw - 0.06)) / 4, yp, rz + 0.036, 0.022, 0.03, 0.004);
  for (let i = 0; i <= 8; i++) cyl(gp, WD, -iw + (i * 2 * iw) / 8, yp, rz + 0.046, 0.0035, eh, 5);
  thatch(0, yp + eh, rz - 0.004, 2 * iw + 0.02, 0.118, 0.044);
  // people in Zhou robes and topknots
  figure(gp, 0.06, y0, zs + 0.05, 0.03, '#5b4c3c', { pose: 'walk', ry: Math.PI, phase: 0.2 });
  figure(gp, -0.02, yp, gz - 0.07, 0.03, '#3f3832', { ry: 0.3 });
  figure(gp, 0.07, yp, M(13), 0.03, '#6e604c', { ry: -0.8 });
  figure(gp, -0.08, yp, M(15), 0.03, '#7a6b55', { pose: 'walk', ry: Math.PI * 0.9, phase: 0.55 });
  figure(gp, 0.03, yh, hz + 0.07, 0.03, '#4a3f34');
  tree(gp, -0.36, y0, 0.18, 0.085, '#5f7340');
  tree(gp, 0.37, y0, -0.12, 0.09, '#66784a');
  tree(gp, -0.37, y0, -0.3, 0.08, '#5a6e44');
};

/** Han-style que (阙) gate tower: plastered rammed-earth shaft with timber-framed eaves, a lower 子阙 on the outer side. */
function que(p: THREE.Object3D, x: number, y: number, z: number, sx: number, tile: string, s = 1): void {
  const body0 = '#cbc2ad', band = '#3a3430', red = '#8a3a2c';
  const qw = 0.075 * s, qd = 0.06 * s, qh = 0.2 * s;
  earth(p, x, y, z, qw * 1.12, qd * 1.12, qw, qd, qh, body0, 1, body0);
  box(p, red, x, y + qh, z, qw + 0.008, 0.012 * s, qd + 0.008);
  box(p, band, x, y + qh + 0.012 * s, z, qw + 0.02, 0.012 * s, qd + 0.02);
  roof(p, x, y + qh + 0.024 * s, z, qw + 0.06 * s, qd + 0.055 * s, 0.04 * s, { tile, k: 0.15, lift: 0.05, ridge: shade(tile, 0.7) });
  const sx2 = x + sx * (qw / 2 + 0.024 * s), sh = qh * 0.6;
  earth(p, sx2, y, z, 0.05 * s, qd * 0.95, 0.045 * s, qd * 0.85, sh, body0, 1, body0);
  box(p, band, sx2, y + sh, z, 0.055 * s, 0.01 * s, qd * 0.85 + 0.012);
  roof(p, sx2 + sx * 0.004, y + sh + 0.01 * s, z, 0.085 * s, qd + 0.04 * s, 0.028 * s, { tile, k: 0.15, lift: 0.05, ridge: shade(tile, 0.7) });
}

/**
 * 西汉长安未央宫前殿 (200 BC): a rammed-earth terrace about 350 × 200 m rising northwards in three great steps on the 龙首原
 * — a gate hall and side halls on the lowest, a hall on the middle step reached by the paired 左墄右平 stairs (stepped east,
 * ramped west), and the front hall itself on the highest step: a long hall under a grey tile hip roof with straight eaves,
 * no ridge finials yet, white-plastered walls and red posts. The paired 阙 stand before the approach.
 * Refs: 中国社科院考古所《汉长安城未央宫：1980–1989年考古发掘报告》(1996); 刘庆柱、李毓芳《汉长安城》(2003).
 */
const cap_qinhan: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, '#8a8370', '#6a6454');
  const tile = '#45484e', PL = '#d3cab6', TOP = '#a8957a', RED = '#8e3a2c', E = '#b09a78', SC = '#b3a283', ZB = -0.405;
  // three steps rising north, each back-aligned
  const T: [number, number, number][] = [[0.8, 0.27, 0.035], [0.66, 0.09, 0.04], [0.54, -0.09, 0.042]];
  const tops: number[] = [];
  let y = y0;
  for (const [w, zf, h] of T) {
    const d = zf - ZB, z = (zf + ZB) / 2;
    y = earth(gp, 0, y, z, w + 0.008, d + 0.008, w, d, h, E, 2, TOP);
    box(gp, PL, 0, y - h, zf + 0.004 - 0.0005, w - 0.04, h * 0.7, 0.002);
    tops.push(y);
  }
  // lowest step: the hall gate (殿门) and two side halls
  const g1 = body(gp, 0, tops[0], 0.2, 0.14, 0.06, 0.04, { wall: PL, col: RED, beam: '#3a3430', sp: 0.035, cr: 0.004, door: '#2e2a28', doorN: 3 });
  roof(gp, 0, g1, 0.2, 0.19, 0.11, 0.045, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  for (const sx of [-1, 1]) {
    const e = body(gp, sx * 0.25, tops[0], 0.17, 0.12, 0.07, 0.04, { wall: PL, col: RED, beam: '#3a3430', sp: 0.03, cr: 0.004 });
    roof(gp, sx * 0.25, e, 0.17, 0.165, 0.12, 0.045, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  }
  // middle step: a hall, with the east stairs (墄) and the west ramp (平) running up beside it
  const mz = 0.0;
  const e2 = body(gp, 0, tops[1], mz, 0.22, 0.08, 0.048, { wall: PL, col: RED, beam: '#3a3430', sp: 0.04, cr: 0.0045, door: '#2e2a28', doorN: 3 });
  roof(gp, 0, e2, mz, 0.29, 0.15, 0.06, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  steps(gp, 0, tops[0], 0.09 + 0.05, 0.06, tops[1] - tops[0], 0.05, SC, 5);
  for (const sx of [-1, 1]) {
    const x = sx * 0.19;
    if (sx > 0) steps(gp, x, tops[1], -0.09 + 0.06, 0.045, tops[2] - tops[1], 0.06, SC, 6);
    else ramp(gp, x, tops[1], -0.09 + 0.06, 0.045, tops[2] - tops[1], 0.06, SC);
  }
  // the front hall on the top step, wrapped by a gallery
  const hz = -0.26;
  rbox(gp, TOP, 0, tops[2], hz, 0.46, 0.008, 0.2, 0.003);
  const yh = tops[2] + 0.008;
  const et = body(gp, 0, yh, hz, 0.38, 0.13, 0.08, { wall: PL, col: RED, beam: '#3a3430', bracket: '#3a3430', sp: 0.038, cr: 0.0058, door: '#2e2a28', doorN: 5 });
  colonnade(gp, 0, yh, hz, 0.42, 0.17, 0.045, 11, 4, RED, 0.0045);
  roof(gp, 0, yh + 0.045, hz, 0.45, 0.2, 0.016, { tile, inner: [0.38, 0.13], k: 0.06, lift: 0.03 });
  roof(gp, 0, et, hz, 0.47, 0.22, 0.11, { tile, k: 0.15, lift: 0.05, ridge: shade(tile, 0.72) });
  // the paired que before the approach and Han officials
  for (const sx of [-1, 1]) que(gp, sx * 0.355, y0, 0.37, sx, tile, 0.66);
  steps(gp, 0, y0, 0.27 + 0.05, 0.08, tops[0] - y0, 0.05, SC, 5);
  for (const sx of [-1, 1]) figure(gp, sx * 0.07, y0, 0.37, 0.028, '#5a2a24', { armor: '#4a4540' });
  figure(gp, -0.12, y0, 0.3, 0.028, '#2f2a2e', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.3 });
  figure(gp, 0.06, tops[0], 0.13, 0.028, '#6a3a30', { hat: 'cap', pose: 'walk', ry: Math.PI * 0.9, phase: 0.6 });
  figure(gp, -0.08, tops[1], 0.06, 0.028, '#3a3040', { hat: 'cap', ry: 0.3 });
};


/** Tang pavilion (阁) on a brick pier with two stepped-down 子阙 on the outer side (三出阙); sx = outer side. */
function tangQue(p: THREE.Object3D, x: number, y: number, z: number, sx: number, tile: string, edge: string, base: string): void {
  const h = 0.14, red = '#8e3a2c', pl = '#e2dccb', rl = '#bdb7aa';
  tbox(p, 0.12, 0.12, 0.11, 0.11, h, base, x, y, z);
  box(p, shade(base, 1.12), x, y + h - 0.004, z, 0.112, 0.004, 0.112);
  rail(p, x, y + h, z, 0.104, 0.104, rl, 0, 0.012);
  const et = body(p, x, y + h, z, 0.075, 0.075, 0.042, { wall: pl, col: red, bracket: '#7a4a32', sp: 0.025, cr: 0.004 });
  const mid = roof(p, x, et - 0.012, z, 0.115, 0.115, 0.022, { tile, edge, inner: [0.06, 0.06], k: 0.3, lift: 0.3 });
  const et2 = body(p, x, mid - 0.004, z, 0.058, 0.058, 0.03, { wall: pl, col: red, sp: 0.03, cr: 0.0035 });
  roof(p, x, et2, z, 0.105, 0.105, 0.05, { tile, edge, k: 0.32, lift: 0.3, chi: '#34473c', chiH: 0.016, ridge: shade(tile, 0.75) });
  for (let i = 1; i <= 2; i++) {
    const xx = x + sx * (0.06 + i * 0.03), hh = h - i * 0.03, dd = 0.1 - i * 0.012;
    tbox(p, 0.035, dd, 0.03, dd - 0.01, hh, base, xx, y, z + i * 0.004);
    roof(p, xx, y + hh, z + i * 0.004, 0.05, dd + 0.02, 0.016, { tile, edge, k: 0.3, lift: 0.25, ridge: null });
  }
}

/**
 * 唐大明宫含元殿 (663): an 11-bay hall wrapped by a 副阶 (13 bays, base 75.9×41.3 m) under a double-eaved hip roof — dark
 * grey tile with green-glazed edging (剪边) and 鸱尾 — white walls, red columns; on a three-tier brick-faced 大台. The 龙尾道
 * climb in stages on both sides of the front (1995–96 excavation), and the 翔鸾阁 / 栖凤阁 stand forward on 三出阙 piers,
 * joined to the terrace by corridors on walls. Refs: 傅熹年《对含元殿遗址及原状的再探讨》(文物1998.4); 《唐大明宫含元殿遗址
 * 1995—1996年发掘报告》(考古学报1997.3); 杨鸿勋《大明宫》.
 */
const cap_tang: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, PAVE, PAVE_SIDE);
  const tile = '#4c5056', edge = '#4a6e5a', BR = '#8f897e', BRT = '#a7a194', PL = '#e2dccb', RED = '#8e3a2c', ST = '#bdb7aa';
  // three-tier brick-faced platform (大台)
  const tier = (y: number, w: number, d: number, h: number, z: number) => {
    earth(gp, 0, y, z, w + 0.008, d + 0.008, w, d, h, BR, Math.max(1, Math.round(h / 0.012)), BRT);
    return y + h;
  };
  const y1 = tier(y0, 0.7, 0.4, 0.05, -0.18), y2 = tier(y1, 0.56, 0.31, 0.035, -0.205), y3 = tier(y2, 0.5, 0.235, 0.02, -0.2225);
  // balustrades along the tier fronts, open where the stairs arrive
  for (const [a, b] of [[-0.345, -0.23], [-0.17, 0.17], [0.23, 0.345]]) railRun(gp, a, b, y1, 0.016, ST, undefined, 0.014);
  for (const [a, b] of [[-0.275, -0.145], [-0.095, 0.095], [0.145, 0.275]]) railRun(gp, a, b, y2, -0.054, ST, undefined, 0.014);
  // 龙尾道: two long ramps in front, each in two flights with a landing, then stairs up the upper tiers
  for (const sx of [-1, 1]) {
    const x = sx * 0.2, w = 0.05;
    ramp(gp, x, y0, 0.27, w, 0.025, 0.12, ST);
    box(gp, BR, x, y0, 0.12, w + 0.012, 0.025, 0.06);
    box(gp, ST, x, y0 + 0.025, 0.12, w, 0.002, 0.06);
    box(gp, BR, x, y0, 0.055, w + 0.012, 0.025, 0.07);
    ramp(gp, x, y0 + 0.025, 0.09, w, 0.025, 0.07, ST);
    for (const s of [-1, 1]) {
      const px = x + s * (w / 2 + 0.003);
      box(gp, BR, px, y0, 0.21, 0.006, 0.006, 0.12);
      ramp(gp, px, y0 + 0.006, 0.27, 0.006, 0.025, 0.12, BRT);
      box(gp, BRT, px, y0 + 0.025, 0.12, 0.006, 0.008, 0.06);
      box(gp, BR, px, y0, 0.055, 0.006, 0.033, 0.07);
      ramp(gp, px, y0 + 0.033, 0.09, 0.006, 0.025, 0.07, BRT);
    }
    steps(gp, x, y1, 0.0, 0.05, y2 - y1, 0.05, ST, 4);
    steps(gp, sx * 0.12, y2, -0.054, 0.04, y3 - y2, 0.05, ST, 3);
  }
  // the hall: 11 × 4 bays inside, a 13 × 6 bay 副阶 colonnade round it, double-eaved hip roof
  const hz = -0.225, bw = 0.4, bd = 0.15, bh = 0.1;
  const et = body(gp, 0, y3, hz, bw, bd, bh, { wall: PL, col: RED, bracket: '#7a4a32', beam: RED, sp: bw / 11, cr: 0.0055 });
  for (let i = 0; i < 11; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / 11);
    if (Math.abs(i - 5) <= 3) box(gp, '#7a3026', x, y3, hz + bd / 2 - 0.002, 0.026, 0.068, 0.004);
    else box(gp, '#4a4640', x, y3 + 0.036, hz + bd / 2 - 0.002, 0.024, 0.03, 0.004);
  }
  colonnade(gp, 0, y3, hz, 0.46, 0.205, 0.052, 13, 6, RED, 0.0048);
  roof(gp, 0, y3 + 0.052, hz, 0.5, 0.245, 0.024, { tile, edge, inner: [bw, bd], k: 0.2, lift: 0.25 });
  roof(gp, 0, et, hz, 0.5, 0.25, 0.112, { tile, edge, k: 0.3, lift: 0.25, chi: '#34473c', chiH: 0.032, ridge: shade(tile, 0.75) });
  // 翔鸾阁 (east) and 栖凤阁 (west) with the corridors on walls back to the terrace
  for (const sx of [-1, 1]) {
    const qx = sx * 0.3, qz = 0.2;
    tangQue(gp, qx, y0, qz, sx, tile, edge, BR);
    earth(gp, qx, y0, 0.08, 0.044, 0.12, 0.04, 0.12, 0.05, BR, 4, BRT);
    corridor(gp, qx, 0.14, qx, -0.2, y1, 0.032, 0.04, tile, RED, { wall: PL });
  }
  // officials in rank colours (purple, red, green) and guards with plumed helmets
  figure(gp, -0.05, y0, 0.33, 0.026, '#5a4762', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.2 });
  figure(gp, 0.03, y0, 0.36, 0.026, '#8a4034', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.7 });
  figure(gp, 0.08, y0, 0.3, 0.026, '#566a50', { hat: 'cap', ry: -2.8 });
  for (const sx of [-1, 1]) for (const dx of [-0.04, 0.04]) figure(gp, sx * 0.2 + dx, y0, 0.3, 0.026, '#7a3a30', { hat: 'plume', hatC: '#5a5650', armor: '#6b6258' });
};

/** A red-crowned crane, standing (wings folded) or flying; faces +x when ry = 0. */
function crane(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, fly = false): void {
  const c = grp(p, x, z, ry, y);
  ellip(c, '#ece9e1', 0, s * 0.55, 0, s * 0.32, s * 0.2, s * 0.17);
  ellip(c, '#1e1c1c', -s * 0.3, s * 0.52, 0, s * 0.16, s * 0.1, s * 0.12);
  rod(c, [s * 0.22, s * 0.6, 0], [s * (fly ? 0.62 : 0.32), s * (fly ? 0.62 : 1.05), 0], s * 0.045, '#ece9e1', 4);
  ellip(c, '#a8241e', s * (fly ? 0.66 : 0.34), s * (fly ? 0.64 : 1.09), 0, s * 0.06);
  if (fly) {
    for (const sz of [-1, 1]) {
      const wing = slab(grp(c, 0, 0, 0, s * 0.6), [[-0.1 * s, 0], [0.18 * s, 0], [0.05 * s, 0.75 * s], [-0.22 * s, 0.7 * s]], s * 0.04, '#ece9e1', 0, false);
      wing.rotation.x = sz * (Math.PI / 2 - 0.25);
    }
    rod(c, [-s * 0.2, s * 0.55, 0], [-s * 0.62, s * 0.5, 0], s * 0.03, '#2a2420', 3);
  } else for (const sz of [-1, 1]) rod(c, [0, s * 0.4, sz * s * 0.06], [0, 0, sz * s * 0.06], s * 0.025, '#2a2420', 3);
}

/**
 * 北宋东京宣德门 (宣德楼) as painted in 赵佶《瑞鹤图》(1112) and described in 《东京梦华录》 ("门皆金钉朱漆，壁皆砖石间甃…
 * 覆以琉璃瓦…曲尺朵楼，朱栏彩槛，下列两阙亭相对"): a 凹-shaped brick-and-stone 墩台 with three trapezoidal gateways (five
 * only after 1118), the 7-bay gate tower under a single-eave hip roof of grey tile with dark green glazed ridges and edges,
 * strongly upswept corners and 鸱吻 on which two cranes perch, side 朵楼, corridors forward to the 阙亭.
 * Refs: 瑞鹤图 (辽宁省博物馆, https://commons.wikimedia.org/wiki/File:瑞鹤图（亮版）.jpg); 傅熹年《中国古代建筑史·宋辽金》.
 */
const cap_song: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, PAVE, PAVE_SIDE);
  const tile = '#5b6064', glaze = '#3d5e4f', wall = '#a39b8d', RED = '#923a2d', DOOR = '#7f2c23', PL = '#e2dccb', BK = '#4f7068', bh = 0.12;
  // 凹-shaped platform: main block and two forward wings, brick and stone courses
  const mz = -0.17, md = 0.2;
  earth(gp, 0, y0, mz, 0.86, md + 0.012, 0.84, md, bh, wall, 6, shade(wall, 1.06));
  for (const sx of [-1, 1]) earth(gp, sx * 0.345, y0, mz + md / 2 + 0.15, 0.17, 0.33, 0.16, 0.32, bh, wall, 6, shade(wall, 1.06));
  // three trapezoidal gateways with red, gold-studded doors
  const fz = mz + md / 2 + 0.003;
  for (const x of [-0.12, 0, 0.12]) {
    const w = x ? 0.05 : 0.062, h = x ? 0.07 : 0.082;
    slab(grp(gp, x, fz, 0, y0), [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.78], [w * 0.28, h], [-w * 0.28, h], [-w / 2, h * 0.78]], 0.008, '#2e2620', 0, false);
    for (const s of [-1, 1]) box(gp, DOOR, x + (s * w) / 4.4, y0, fz + 0.003, w * 0.42, h * 0.74, 0.004);
    for (let r = 0; r < 3; r++) box(gp, '#a88a4a', x, y0 + h * (0.18 + r * 0.2), fz + 0.0055, w * 0.8, 0.003, 0.002);
  }
  const yt = y0 + bh;
  rail(gp, 0, yt, mz, 0.84, md, RED, 0, 0.016, [false, true, true, true]);
  railRun(gp, -0.26, 0.26, yt, mz + md / 2 - 0.004, RED);
  for (const sx of [-1, 1]) rail(gp, sx * 0.345, yt, mz + md / 2 + 0.15, 0.16, 0.32, RED, 0, 0.016, [true, sx < 0, false, sx > 0]);
  // the 7-bay gate tower (门楼): red columns, white walls with red lattice doors, blue-green painted brackets
  const et = body(gp, 0, yt, mz, 0.42, 0.13, 0.072, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.06, cr: 0.0055, door: DOOR, doorN: 5 });
  const top = roof(gp, 0, et, mz, 0.54, 0.25, 0.11, { tile, edge: glaze, ridge: glaze, k: 0.5, lift: 0.6, chi: glaze, chiH: 0.036 });
  const rl = 0.54 - 0.25 + 0.008;
  for (const sx of [-1, 1]) crane(gp, sx * (rl / 2 + 0.002), top + 0.03, mz, 0.045, sx > 0 ? Math.PI : 0);
  // 曲尺朵楼 at both ends, corridors forward along the wings, and the 阙亭 at their front corners
  for (const sx of [-1, 1]) {
    const ox = sx * 0.345;
    const e2 = body(gp, ox, yt, mz, 0.11, 0.11, 0.05, { wall: PL, col: RED, bracket: BK, sp: 0.036, cr: 0.0045 });
    roof(gp, ox, e2, mz, 0.17, 0.16, 0.075, { tile, edge: glaze, ridge: glaze, k: 0.45, lift: 0.6, xie: 0.55 });
    galleryZ(gp, ox, yt, mz + 0.07, 0.17, 0.05, 0.04, 0.026, RED, { tile, edge: glaze, k: 0.4, lift: 0.3, ridge: glaze }, PL);
    const qz = 0.22;
    const e3 = body(gp, ox, yt, qz, 0.1, 0.1, 0.05, { wall: PL, col: RED, bracket: BK, sp: 0.033, cr: 0.0045 });
    const m = roof(gp, ox, e3 - 0.004, qz, 0.15, 0.15, 0.02, { tile, edge: glaze, inner: [0.07, 0.07], k: 0.4, lift: 0.6 });
    const e4 = body(gp, ox, m, qz, 0.07, 0.07, 0.035, { wall: PL, col: RED, sp: 0.035, cr: 0.0038 });
    roof(gp, ox, e4, qz, 0.13, 0.13, 0.06, { tile, edge: glaze, k: 0.45, lift: 0.6, ridge: glaze, chi: glaze, chiH: 0.018 });
  }
  // the auspicious cranes of 1112 circling over the gate
  for (const [x, y, z, ry] of [[-0.2, 0.4, -0.22, 0.4], [0.07, 0.43, -0.26, -0.3], [0.25, 0.38, -0.16, Math.PI - 0.5]] as const) crane(gp, x, y, z, 0.04, ry, true);
  // palace guards and officials on the 御街
  for (const x of [-0.165, -0.075, 0.075, 0.165]) figure(gp, x, y0, -0.02, 0.026, '#8a3a30', { hat: 'plume', hatC: '#4f4b45', armor: '#6b6258' });
  figure(gp, -0.04, y0, 0.2, 0.026, '#5a4762', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.3 });
  figure(gp, 0.05, y0, 0.27, 0.026, '#566a50', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.8 });
};

/** Mongol ger / ordo tent: white felt walls and dome bound with dark bands, a gilt crown and a red door. */
function ger(p: THREE.Object3D, x: number, y: number, z: number, r: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y), gold = '#b8954a';
  lathe(g0, [[0, 0], [r, 0], [r, r * 0.55], [r * 0.98, r * 0.6], [0, r * 0.6]], '#e6e0d2', 0, 0, 0, 16);
  lathe(g0, [[r * 1.02, r * 0.58], [r * 0.7, r * 0.82], [r * 0.3, r * 0.98], [0, r * 1.02]], '#ebe6da', 0, 0, 0, 16);
  for (const yy of [0.18, 0.42]) lathe(g0, [[r * 1.005, r * yy], [r * 1.005, r * (yy + 0.05)]], '#5a5048', 0, 0, 0, 16);
  lathe(g0, [[r * 0.99, r * 0.54], [r * 1.0, r * 0.6]], gold, 0, 0, 0, 16);
  lathe(g0, [[0, r * 0.98], [r * 0.28, r * 0.98], [r * 0.2, r * 1.12], [0, r * 1.18]], gold, 0, 0, 0, 10);
  ellip(g0, gold, 0, r * 1.26, 0, r * 0.1);
  box(g0, '#8a3a2c', 0, 0, r * 0.97, r * 0.42, r * 0.46, 0.006);
  box(g0, gold, 0, r * 0.46, r * 0.98, r * 0.5, r * 0.05, 0.006);
}

/**
 * 元大都大明殿 (1273) per 陶宗仪《南村辍耕录》卷21〈宫阙制度〉: the 11-bay front hall (200×120 尺, 90 尺 high) joined by a 7-bay
 * 柱廊 (240×44 尺) to the 5-bay 寝室 with its east/west 夹 (140×50 尺) — a 工-shaped plan on a two-tier white-stone terrace
 * with "重陛朱阑，涂金冒楯" (red balustrades with gilt caps), 丹楹 red columns, 彤壁 red walls, 朱琐窗, and "檐脊皆饰琉璃瓦"
 * (glazed tile on eaves and ridges over grey tile). A white felt ordo (斡耳朵) stands beside it.
 * Refs: 辍耕录 卷21; 朱偰《元大都宫殿图考》(1936); 傅熹年《元大都大内宫殿的复原研究》.
 */
const cap_yuan: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, PAVE, PAVE_SIDE);
  const tile = '#585c61', glaze = '#3b6763', m = '#d9d4c6', ms = shade(m, 0.93), RED = '#8a2f25', WALL = '#9a4636', RAIL = '#9a3a2c', GOLD = '#b8954a', BK = '#4c6b66';
  // 工-shaped two-tier terrace: front block, waist under the corridor, rear block
  const tierI = (y: number, h: number, c: string, k: number) => {
    rbox(gp, c, 0, y, 0.205 - k / 2, 0.46 - 2 * k, h, 0.27 - k, 0.003);
    rbox(gp, c, 0, y, -0.08, 0.12 - 2 * k, h, 0.32, 0.003);
    rbox(gp, c, 0, y, -0.295 + k / 2, 0.4 - 2 * k, h, 0.13 - k, 0.003);
    return y + h;
  };
  const y1 = tierI(y0, 0.03, m, 0), y2 = tierI(y1, 0.025, ms, 0.02);
  railRun(gp, -0.225, -0.05, y1, 0.336, RAIL, GOLD);
  railRun(gp, 0.05, 0.225, y1, 0.336, RAIL, GOLD);
  railRun(gp, -0.205, -0.04, y2, 0.316, RAIL, GOLD);
  railRun(gp, 0.04, 0.205, y2, 0.316, RAIL, GOLD);
  steps(gp, 0, y0, 0.4, 0.09, y1 - y0, 0.06, m, 4);
  steps(gp, 0, y1, 0.336, 0.07, y2 - y1, 0.02, ms, 3);
  // 大明殿: 11 bays inside a 13-bay 副阶, double-eaved hip roof
  const hz = 0.2, bw = 0.27, bd = 0.13, bh = 0.075;
  const et = body(gp, 0, y2, hz, bw, bd, bh, { wall: WALL, col: RED, beam: RED, bracket: BK, sp: bw / 11, cr: 0.005 });
  for (let i = 0; i < 11; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / 11);
    if (Math.abs(i - 5) <= 2) box(gp, '#6e2219', x, y2, hz + bd / 2 - 0.002, 0.018, 0.052, 0.004);
    else box(gp, '#7a2a20', x, y2 + 0.026, hz + bd / 2 - 0.002, 0.017, 0.026, 0.004);
  }
  colonnade(gp, 0, y2, hz, 0.3, 0.16, 0.04, 13, 6, RED, 0.0045);
  roof(gp, 0, y2 + 0.04, hz, 0.335, 0.195, 0.02, { tile, edge: glaze, inner: [bw, bd], k: 0.25, lift: 0.3 });
  roof(gp, 0, et, hz, 0.33, 0.19, 0.075, { tile, edge: glaze, k: 0.35, lift: 0.3, ridge: glaze, chi: glaze, chiH: 0.024 });
  // 柱廊 (open pillared corridor) and the 寝室 with its east/west 夹
  const bz = -0.29;
  galleryZ(gp, 0, y2, hz - 0.08, bz + 0.035, 0.062, 0.045, 0.03, RED, { tile, edge: glaze, k: 0.35, lift: 0.2, ridge: glaze });
  const e2 = body(gp, 0, y2, bz, 0.2, 0.075, 0.06, { wall: WALL, col: RED, beam: RED, bracket: BK, sp: 0.04, cr: 0.0045, door: '#6e2219', doorN: 3 });
  roof(gp, 0, e2, bz, 0.25, 0.125, 0.058, { tile, edge: glaze, k: 0.35, lift: 0.3, ridge: glaze, chi: glaze, chiH: 0.018 });
  for (const sx of [-1, 1]) {
    const e3 = body(gp, sx * 0.14, y2, bz + 0.005, 0.07, 0.06, 0.045, { wall: WALL, col: RED, sp: 0.023, cr: 0.004 });
    roof(gp, sx * 0.14, e3, bz + 0.005, 0.1, 0.095, 0.04, { tile, edge: glaze, k: 0.35, lift: 0.3, ridge: glaze });
  }
  // the khan's ordo tent and Mongol guards in fur-brimmed hats
  ger(gp, -0.34, y0, 0.3, 0.06, 0.4);
  for (const x of [-0.13, -0.075, 0.075, 0.13]) figure(gp, x, y0, 0.405, 0.026, '#5f5242', { hat: 'fur', hatC: '#4a3a2c', armor: '#5e5850' });
  figure(gp, -0.26, y0, 0.36, 0.026, '#6b4a3a', { hat: 'fur', hatC: '#4a3a2c', pose: 'walk', ry: -1.2, phase: 0.4 });
};

// ---- per-capital kit ----------------------------------------------------------------------------------------------

/** Flat ribbon (river, moat, bank) of width w along a centre line, clipped to the plinth top. */
function ribbon(p: THREE.Object3D, pts: [number, number][], w: number, y: number, h: number, c: string): void {
  const L: [number, number][] = [], R: [number, number][] = [];
  const cl = (x: number, z: number): [number, number] => [clamp(x, -0.443, 0.443), clamp(z, -0.423, 0.423)];
  pts.forEach(([x, z], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    L.push(cl(x + (nx * w) / 2, z + (nz * w) / 2));
    R.push(cl(x - (nx * w) / 2, z - (nz * w) / 2));
  });
  prism(p, [...L, ...R.reverse()], y, h, c);
}

/** Rounded, slightly irregular hill mound rx × rz, h high (vertex-coloured, darker towards the foot). */
function hill(p: THREE.Object3D, x: number, y: number, z: number, rx: number, rz: number, h: number, c: string): void {
  const N = 20, K = 6, M = tris(), ring: V3[][] = [];
  for (let i = 0; i < K; i++) {
    const t = i / K, r = Math.cos((t * Math.PI) / 2) ** 0.7, yy = y + h * Math.sin((t * Math.PI) / 2) ** 1.4, row: V3[] = [];
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2, n = 1 + (hash3(x + j, i, z) - 0.5) * 0.08;
      row.push([clamp(x + Math.cos(a) * rx * r * n, -0.443, 0.443), yy + (i && (hash3(j, x, i) - 0.5) * h * 0.05), clamp(z + Math.sin(a) * rz * r * n, -0.423, 0.423)]);
    }
    ring.push(row);
  }
  const top: V3 = [x, y + h, z];
  for (let i = 0; i < K; i++) for (let j = 0; j < N; j++) {
    const j1 = (j + 1) % N, col = shade(c, 0.88 + (i / K) * 0.16 + (hash3(i, j, x) - 0.5) * 0.04);
    if (i < K - 1) { M.t(ring[i][j], ring[i + 1][j], ring[i + 1][j1], col); M.t(ring[i][j], ring[i + 1][j1], ring[i][j1], col); }
    else M.t(ring[i][j], top, ring[i][j1], col);
  }
  polyMesh(p, M.pos, M.col);
}

/** Thatched Shang hall on its own low rammed-earth base; ry turns the front (+z) to face the court. */
function shangHall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y), E = '#9f8762', TH = '#75684f', WD = '#46372a';
  earth(g0, 0, 0, 0, w + 0.032, d + 0.03, w + 0.026, d + 0.024, 0.014, E, 1, '#ad9671');
  const et = body(g0, 0, 0.014, 0, w, d, 0.032, { wall: '#b8a684', col: WD, beam: WD, sp: 0.03, cr: 0.0035, door: '#2b2219', doorN: Math.max(1, Math.round(w / 0.1)) });
  roof(g0, 0, et, 0, w + 0.036, d + 0.04, Math.min(0.048, d * 0.55 + 0.014), { tile: TH, thatch: true, k: 0.06, ridge: shade(TH, 0.78), under: '#5b4e38', fascia: shade(TH, 0.8), th: 0.009 });
  steps(g0, 0, 0, d / 2 + 0.03, 0.03, 0.014, 0.016, E, 2);
}

/**
 * 殷墟宫殿宗庙区 (Anyang, c. 1300–1046 BC): no city wall, the 洹河 bending round the north and east of the zone; the 甲 group
 * of single halls by the river, the 乙 group of long halls on rammed-earth bases round a court open to the south (乙二十
 * reconstruction), the 丙 group of small altar platforms with rows of sacrificial pits, and pit YH127 where 17,000 inscribed
 * oracle bones were stored. Walls of wattle and daub, thatched 四阿 roofs, posts on stone footings.
 * Refs: 石璋如《小屯·殷墟建筑遗存》(1959); 中国社科院考古所《殷墟的发现与研究》(2001); 殷墟宫殿宗庙遗址 reconstruction.
 */
const cap_yinxu: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, '#7f7a58', GRASS_SIDE);
  const E = '#9f8762', BANK = '#8a7a5c', WATER = '#5f7268', BONE = '#d2c6a8', PIT = '#4a3d2e';
  // 洹河: an arc round the back and the east side
  const arc: [number, number][] = [];
  for (let i = 0; i <= 28; i++) { const a = (125 - (145 * i) / 28) * (Math.PI / 180); arc.push([-0.15 + 0.52 * Math.cos(a), 0.17 - 0.52 * Math.sin(a)]); }
  ribbon(gp, arc, 0.11, y0, 0.0015, BANK);
  ribbon(gp, arc, 0.07, y0, 0.003, WATER);
  // 甲 group: free-standing halls by the river
  shangHall(gp, -0.25, y0, -0.265, 0.15, 0.04);
  shangHall(gp, 0.0, y0, -0.255, 0.11, 0.04);
  // 乙 group: the long north hall and the east/west halls framing a court, a gate hall at its open south side
  shangHall(gp, -0.04, y0, -0.12, 0.32, 0.06);
  shangHall(gp, -0.28, y0, 0.07, 0.18, 0.05, Math.PI / 2);
  shangHall(gp, 0.2, y0, 0.07, 0.18, 0.05, -Math.PI / 2);
  shangHall(gp, -0.04, y0, 0.22, 0.1, 0.04);
  // 丙 group: square altar platforms and rows of sacrificial pits (a few with remains)
  for (const [x, z] of [[-0.38, 0.27], [-0.31, 0.34], [-0.39, 0.38]] as [number, number][]) earth(gp, x, y0, z, 0.05, 0.05, 0.044, 0.044, 0.014, E, 1, '#ad9671');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const x = -0.25 + j * 0.03, z = 0.29 + i * 0.033;
    box(gp, PIT, x, y0, z, 0.016, 0.0012, 0.026);
    if (hash3(i, j, 3) > 0.5) ellip(gp, BONE, x, y0 + 0.0014, z, 0.004, 0.0012, 0.009);
  }
  // pit YH127 with its mass of turtle plastrons
  const ox = 0.17, oz = 0.28;
  cyl(gp, shade(E, 0.85), ox, y0, oz, 0.036, 0.003, 16);
  cyl(gp, PIT, ox, y0, oz, 0.029, 0.0035, 16);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4, r = 0.02 * Math.sqrt(i / 26);
    ellip(gp, i % 3 ? '#c9b994' : '#b8a27a', ox + Math.cos(a) * r, y0 + 0.004 + (i % 4) * 0.0008, oz + Math.sin(a) * r, 0.0045, 0.0012, 0.0055, a);
  }
  // diviner and attendants in undyed hemp and dark silk
  figure(gp, ox + 0.045, y0, oz, 0.028, '#4a3d34', { ry: -Math.PI / 2 });
  figure(gp, -0.04, y0, 0.06, 0.028, '#6f604a', { ry: 0.4 });
  figure(gp, 0.04, y0, 0.0, 0.028, '#5d5040', { pose: 'walk', ry: -2.4, phase: 0.3 });
  figure(gp, -0.15, y0, 0.33, 0.028, '#74674f', { ry: 2.6 });
  figure(gp, 0.06, y0, 0.35, 0.028, '#685a46', { pose: 'walk', ry: Math.PI, phase: 0.7 });
  tree(gp, 0.33, y0, 0.38, 0.07, '#5f7340');
  tree(gp, -0.4, y0, 0.0, 0.065, '#66784a');
};

/** Horse skeleton lying on its side in a burial pit, head towards +z (as the 天子驾六 horses lie). */
function boneHorse(p: THREE.Object3D, x: number, y: number, z: number, side: number, c: string): void {
  ellip(p, c, x, y + 0.003, z, 0.0055, 0.0028, 0.011);
  rod(p, [x, y + 0.003, z + 0.009], [x + side * 0.002, y + 0.003, z + 0.02], 0.0022, c, 4);
  ellip(p, c, x + side * 0.003, y + 0.003, z + 0.025, 0.0028, 0.002, 0.006, side * 0.3);
  for (const dz of [-0.008, 0.007]) for (const k of [0, 1]) rod(p, [x + side * 0.003, y + 0.002, z + dz + k * 0.003], [x + side * 0.015, y + 0.0015, z + dz + k * 0.004 - 0.002], 0.0011, c, 3);
}

/** Decayed chariot as excavated: wheel casts standing in the earth, box, axle, pole and yoke. */
function chariotTrace(p: THREE.Object3D, x: number, y: number, z: number, s: number, pole: number): void {
  const W = '#4b3c2c';
  for (const sx of [-1, 1]) cyl(p, W, x + sx * 0.0135 * s, y + 0.006 - 0.0008, z, 0.0095 * s, 0.0016, 14).rotation.z = Math.PI / 2;
  rod(p, [x - 0.017 * s, y + 0.006, z], [x + 0.017 * s, y + 0.006, z], 0.0012, W, 4);
  box(p, '#5a4836', x, y + 0.004, z - 0.002, 0.021 * s, 0.006, 0.014);
  rod(p, [x, y + 0.004, z], [x, y + 0.004, z + pole], 0.0013, W, 4);
  rod(p, [x - 0.012 * s, y + 0.004, z + pole - 0.004], [x + 0.012 * s, y + 0.004, z + pole - 0.004], 0.0012, W, 4);
}

/**
 * 东周王城 (洛邑, Luoyang, 770–256 BC): the rammed-earth city wall, a hall on a stepped earth terrace (台榭) under a grey tile
 * hip roof with half-round eave tiles, and the royal chariot pit ZK5 found in 2002 under 王城广场 — 26 chariots in two files
 * heading south with 70 horses laid on their sides, the six-horse chariot of the Son of Heaven (天子驾六) in the middle.
 * Refs: 洛阳市文物工作队《洛阳东周王城》; 《洛阳王城广场东周墓》(2009); 洛阳周王城天子驾六博物馆.
 */
const cap_luoyi: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, '#8a7f63', '#685f4a');
  const L = '#a38b66', LT = '#b09a76', G = '#958563', SOIL = '#7d6447', BONE = '#c2b28c', tile = '#55585c', PL = '#d6ccb6', RED = '#7e3428', BLK = '#2d2a27';
  // ground level raised round the open pit
  const hg = 0.02, yg = y0 + hg, X0 = 0.07, X1 = 0.31, Z0 = -0.2, Z1 = 0.37, XE = 0.444, ZE = 0.424;
  box(gp, G, (-XE + X0) / 2, y0, 0, X0 + XE, hg, 2 * ZE);
  box(gp, G, (X1 + XE) / 2, y0, 0, XE - X1, hg, 2 * ZE);
  box(gp, G, (X0 + X1) / 2, y0, (-ZE + Z0) / 2, X1 - X0, hg, Z0 + ZE);
  box(gp, G, (X0 + X1) / 2, y0, (Z1 + ZE) / 2, X1 - X0, hg, ZE - Z1);
  box(gp, SOIL, (X0 + X1) / 2, y0, (Z0 + Z1) / 2, X1 - X0, 0.001, Z1 - Z0);
  // ZK5: two files of chariots with paired / four-horse teams, the six-horse team in the middle
  const yb = y0 + 0.001, rows: [number, number, number][] = [];
  for (const [z, n] of [[0.29, 2], [0.215, 4], [0.03, 2], [-0.045, 4], [-0.12, 2]] as [number, number][]) for (const x of [0.13, 0.25]) rows.push([x, z, x < 0.2 ? n : 6 - n]);
  for (const [x, z, n] of rows) {
    chariotTrace(gp, x, yb, z, 1, 0.042);
    for (let k = 0; k < n; k++) boneHorse(gp, x + (k - (n - 1) / 2) * 0.016 - 0.004, yb, z + 0.024, 1, BONE);
  }
  chariotTrace(gp, 0.19, yb, 0.11, 1.2, 0.046);
  for (let k = 0; k < 6; k++) boneHorse(gp, 0.19 + (k - 2.5) * 0.017 - 0.005, yb, 0.135, 1, '#cbbb95');
  for (const [x, z] of [[0.1, -0.17], [0.28, 0.33], [0.24, -0.08]] as [number, number][]) ellip(gp, BONE, x, yb + 0.002, z, 0.006, 0.002, 0.0035, 0.5);
  // rammed-earth city wall along the north and west, a gap for the road
  earth(gp, 0.06, yg, -0.385, 0.76, 0.07, 0.74, 0.05, 0.065, L, 5, LT);
  earth(gp, -0.39, yg, -0.385, 0.08, 0.07, 0.06, 0.05, 0.065, L, 5, LT);
  earth(gp, -0.4, yg, 0.03, 0.07, 0.76, 0.05, 0.74, 0.065, L, 5, LT);
  // 台榭: two-stepped earth terrace, galleries round its foot, a seven-bay hall on top
  const hx = -0.15, hz = -0.13;
  const t1 = earth(gp, hx, yg, hz, 0.36, 0.26, 0.35, 0.25, 0.035, L, 2, LT);
  const t2 = earth(gp, hx, t1, hz - 0.01, 0.27, 0.17, 0.26, 0.16, 0.028, L, 2, LT);
  for (const [x, z, w, d] of [[hx, hz + 0.126, 0.34, 0.003], [hx, hz - 0.126, 0.34, 0.003], [hx - 0.176, hz, 0.003, 0.24], [hx + 0.176, hz, 0.003, 0.24]] as [number, number, number, number][]) box(gp, PL, x, yg, z, w, 0.028, d);
  for (let i = 0; i < 4; i++) box(gp, '#3a2a20', hx - 0.12 + i * 0.08, yg, hz + 0.128, 0.018, 0.022, 0.003);
  colonnade(gp, hx, yg, hz, 0.4, 0.3, 0.03, 10, 7, BLK, 0.0035);
  roof(gp, hx, yg + 0.03, hz, 0.42, 0.32, 0.012, { tile, inner: [0.355, 0.255], k: 0.05 });
  const et = body(gp, hx, t2, hz - 0.01, 0.2, 0.09, 0.05, { wall: PL, col: RED, beam: BLK, sp: 0.2 / 7, cr: 0.0045, door: '#3a2a20', doorN: 3 });
  roof(gp, hx, et, hz - 0.01, 0.27, 0.16, 0.075, { tile, k: 0.12, lift: 0.04, ridge: shade(tile, 0.72) });
  steps(gp, hx, yg, hz + 0.155, 0.06, t1 - yg, 0.03, L, 4);
  steps(gp, hx, t1, hz + 0.075, 0.05, t2 - t1, 0.02, L, 3);
  // Zhou court in dark robes
  figure(gp, hx - 0.03, yg, hz + 0.2, 0.028, '#3d3530', { ry: 0.2 });
  figure(gp, hx + 0.05, yg, hz + 0.24, 0.028, '#5a3a30', { pose: 'walk', ry: Math.PI, phase: 0.4 });
  figure(gp, hx + 0.03, t2, hz + 0.05, 0.028, '#2f2a28');
  figure(gp, -0.06, yg, 0.3, 0.028, '#6a5a46', { pose: 'walk', ry: 1.4, phase: 0.1 });
  tree(gp, -0.3, yg, 0.32, 0.07, '#5f7340');
  tree(gp, 0.38, yg, -0.3, 0.07, '#66784a');
};

/**
 * 秦咸阳宫一号宫殿遗址 (咸阳原, Qin, 4th–3rd c. BC): a 60×45 m rammed-earth platform about 6 m high wrapped by rooms and
 * galleries (回廊) on its lower level, the two-storey main hall (楼堂) on top; it is the western half of a symmetrical pair
 * joined across a gully by an elevated covered way (飞阁). Vermilion posts, black-lacquered beams, white-plastered walls over
 * dark painted dados (the excavated chariot-procession murals), grey tile, no ridge finials. The Wei river below to the south.
 * Refs: 陶复《秦咸阳宫第一号遗址复原问题的初步探讨》(文物1976.11); 秦都咸阳考古工作站《秦都咸阳第一号宫殿建筑遗址简报》(文物1976.11).
 */
const cap_xianyang: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, '#8f8468', '#6a6454');
  const tile = '#46494e', PL = '#dad1bd', RED = '#922f22', BLK = '#2a2826', E = '#a88f6c', ET = '#b39b78', DADO = '#4a3a33';
  // the Wei river along the front edge, a loess bank above it
  box(gp, '#8d7c5c', 0, y0, 0.37, 0.888, 0.0015, 0.108);
  box(gp, '#5d6e66', 0, y0, 0.392, 0.888, 0.003, 0.064);
  // the gully between the twin platforms
  box(gp, '#7a6a50', 0.255, y0, -0.03, 0.14, 0.0015, 0.66);
  // main platform: lower terrace, then the core wrapped by rooms and a gallery under a skirt roof
  const cx = -0.12, cz = -0.08;
  const y1 = earth(gp, cx, y0, cz, 0.5, 0.38, 0.49, 0.37, 0.035, E, 2, ET);
  const kw = 0.3, kd = 0.22, kx = cx + 0.01, kz = cz - 0.03, kh = 0.055;
  earth(gp, kx, y1, kz, kw, kd, kw - 0.006, kd - 0.006, kh, PL, 1, ET);
  for (const [w, d, x, z] of [[kw + 0.002, 0.002, kx, kz + kd / 2], [0.002, kd + 0.002, kx - kw / 2, kz], [0.002, kd + 0.002, kx + kw / 2, kz]] as [number, number, number, number][]) box(gp, DADO, x, y1, z, w, 0.016, d);
  for (let i = 0; i < 6; i++) box(gp, '#3b2a22', kx - 0.11 + i * 0.044, y1, kz + kd / 2 + 0.002, 0.02, 0.03, 0.003);
  colonnade(gp, kx, y1, kz, kw + 0.07, kd + 0.07, 0.034, 9, 6, RED, 0.0038);
  roof(gp, kx, y1 + 0.034, kz, kw + 0.09, kd + 0.09, 0.016, { tile, inner: [kw, kd], k: 0.05 });
  // two-storey 楼堂 on top of the core
  const y2 = y1 + kh, hx = kx - 0.045, hz = kz - 0.01;
  const e1 = body(gp, hx, y2, hz, 0.2, 0.12, 0.048, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0045, door: '#3a2a20', doorN: 3 });
  const m = roof(gp, hx, e1, hz, 0.25, 0.17, 0.016, { tile, inner: [0.16, 0.09], k: 0.06 });
  const e2 = body(gp, hx, m - 0.004, hz, 0.16, 0.09, 0.036, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.004 });
  roof(gp, hx, e2, hz, 0.22, 0.16, 0.07, { tile, k: 0.12, lift: 0.04, ridge: shade(tile, 0.72) });
  // a side pavilion on the east end of the core and the lower east wing
  const e3 = body(gp, kx + 0.1, y2, kz + 0.04, 0.05, 0.05, 0.032, { wall: PL, col: RED, beam: BLK, sp: 0.025, cr: 0.0035 });
  roof(gp, kx + 0.1, e3, kz + 0.04, 0.078, 0.078, 0.036, { tile, k: 0.12, ridge: shade(tile, 0.72) });
  const e4 = body(gp, cx - 0.218, y1, cz + 0.06, 0.042, 0.16, 0.034, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0035 });
  roof(gp, cx - 0.218, e4, cz + 0.06, 0.062, 0.19, 0.03, { tile, k: 0.1, ridge: shade(tile, 0.72) });
  // stairs up the south face
  steps(gp, cx + 0.05, y0, cz + 0.19 + 0.04, 0.05, y1 - y0, 0.04, ET, 4);
  steps(gp, kx - 0.08, y1, kz + kd / 2 + 0.035 + 0.035, 0.04, kh, 0.035, ET, 5);
  // 飞阁: covered way on tall posts across the gully to the eastern twin (its edge only)
  const tz = -0.12, y3 = y0 + 0.07;
  earth(gp, 0.405, y0, tz, 0.08, 0.3, 0.075, 0.29, 0.07, E, 3, ET);
  const e5 = body(gp, 0.41, y3, tz, 0.06, 0.16, 0.04, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0035, back: true });
  roof(gp, 0.41, e5, tz, 0.09, 0.2, 0.04, { tile, k: 0.1, ridge: shade(tile, 0.72) });
  for (let x = 0.2; x <= 0.33; x += 0.033) for (const sz of [-1, 1]) cyl(gp, RED, x, y0, tz + sz * 0.018, 0.0035, y3 - y0, 5);
  box(gp, BLK, 0.255, y3 - 0.004, tz, 0.17, 0.006, 0.044);
  box(gp, PL, 0.255, y3 + 0.002, tz, 0.17, 0.008, 0.042);
  corridor(gp, 0.165, tz, 0.38, tz, y3 + 0.01, 0.026, 0.04, tile, RED, { rh: 0.02 });
  // Qin officials and guards in black (水德)
  figure(gp, cx + 0.04, y0, 0.24, 0.028, '#262422', { armor: '#4a4540' });
  figure(gp, cx + 0.1, y0, 0.24, 0.028, '#262422', { armor: '#4a4540' });
  figure(gp, -0.02, y0, 0.29, 0.028, '#2f2a2e', { hat: 'cap', pose: 'walk', ry: -2.6, phase: 0.3 });
  figure(gp, kx - 0.04, y1, kz + kd / 2 + 0.06, 0.028, '#3a2f2a', { hat: 'cap', ry: 0.4 });
  figure(gp, 0.25, y0, 0.22, 0.028, '#4a4038', { pose: 'walk', ry: Math.PI, phase: 0.6 });
};

/** Bronze armillary sphere (浑仪) on a cross stand. */
function armillary(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  const B = '#6f5a36', tor = g('cap:torus', () => new THREE.TorusGeometry(1, 0.06, 4, 20));
  box(p, B, x, y, z, r * 2.2, r * 0.2, r * 0.25);
  box(p, B, x, y, z, r * 0.25, r * 0.2, r * 2.2);
  cyl(p, B, x, y, z, r * 0.12, r * 0.9, 5);
  for (const [ry, rx] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2 - 0.6]]) add(p, tor, mat(B), x, y + r * 1.3, z, r, r, r, ry, rx, 0);
}

/**
 * 东汉洛阳南郊 (25–190): the 灵台 observatory (56 AD), excavated 1974–75 — a square rammed-earth terrace in a walled precinct
 * with two storeys of rooms round it whose walls were painted by direction (east blue, south red, west white, north black),
 * instruments on the summit where 张衡 worked; beside it the 太学 with the 熹平石经 (175–183), 46 stone tablets of the
 * classics set up in a row at the academy gate under a shelter, scholars copying them.
 * Refs: 中国社科院考古所洛阳工作队《汉魏洛阳城南郊的灵台遗址》(考古1978.1); 《后汉书·蔡邕传》; 《洛阳伽蓝记》卷三.
 */
const cap_luoyang: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, GRASS, GRASS_SIDE);
  const tile = '#4a4d52', E = '#a99272', ET = '#b7a283', PL = '#d6cdb8', RED = '#8a3a2c', ST = '#9c978c', RD = '#a59a80';
  // road between the two precincts
  box(gp, RD, 0.115, y0, 0, 0.07, 0.0015, 0.848);
  // 灵台 precinct wall with a south gate
  const lx = -0.17, lz = 0.0, hw = 0.255, wh = 0.03;
  const wall = (x: number, z: number, w: number, d: number) => earth(gp, x, y0, z, w, d, w - 0.004, d - 0.004, wh, E, 2, ET);
  wall(lx, lz - hw, 2 * hw, 0.018);
  wall(lx - hw, lz, 0.018, 2 * hw);
  wall(lx + hw, lz, 0.018, 2 * hw);
  for (const sx of [-1, 1]) wall(lx + sx * (hw + 0.035) / 2, lz + hw, hw - 0.035, 0.018);
  for (const sx of [-1, 1]) box(gp, E, lx + sx * 0.04, y0, lz + hw, 0.014, 0.042, 0.022);
  roof(gp, lx, y0 + 0.042, lz + hw, 0.12, 0.05, 0.022, { tile, k: 0.1, ridge: shade(tile, 0.72) });
  // the terrace: lower tier wrapped by rooms (walls painted by direction), upper tier with its own gallery, summit
  const s1 = 0.2, s2 = 0.13, h1 = 0.04, h2 = 0.035;
  const y1 = earth(gp, lx, y0, lz, s1, s1, s1 - 0.006, s1 - 0.006, h1, E, 2, ET);
  for (const [x, z, w, d, c] of [[lx, lz + s1 / 2, s1 - 0.01, 0.003, '#8a3a2c'], [lx, lz - s1 / 2, s1 - 0.01, 0.003, '#2c2b2a'], [lx + s1 / 2, lz, 0.003, s1 - 0.01, '#3e6764'], [lx - s1 / 2, lz, 0.003, s1 - 0.01, '#ddd6c6']] as [number, number, number, number, string][]) box(gp, c, x, y0, z, w, h1 * 0.7, d);
  colonnade(gp, lx, y0, lz, s1 + 0.036, s1 + 0.036, h1 * 0.75, 6, 6, RED, 0.0035);
  roof(gp, lx, y0 + h1 * 0.75, lz, s1 + 0.05, s1 + 0.05, 0.012, { tile, inner: [s1, s1], k: 0.05 });
  const y2 = earth(gp, lx, y1, lz, s2, s2, s2 - 0.006, s2 - 0.006, h2, E, 2, ET);
  for (const [x, z, w, d, c] of [[lx, lz + s2 / 2, s2 - 0.01, 0.003, '#8a3a2c'], [lx, lz - s2 / 2, s2 - 0.01, 0.003, '#2c2b2a'], [lx + s2 / 2, lz, 0.003, s2 - 0.01, '#3e6764'], [lx - s2 / 2, lz, 0.003, s2 - 0.01, '#ddd6c6']] as [number, number, number, number, string][]) box(gp, c, x, y1, z, w, h2 * 0.85, d);
  railRun(gp, lx - s2 / 2 + 0.004, lx + s2 / 2 - 0.004, y2, lz + s2 / 2 - 0.004, RED, undefined, 0.01);
  armillary(gp, lx - 0.02, y2, lz - 0.01, 0.016);
  box(gp, '#6f5a36', lx + 0.035, y2, lz + 0.02, 0.012, 0.012, 0.012);
  box(gp, '#6f5a36', lx + 0.035, y2, lz + 0.035, 0.009, 0.007, 0.009);
  steps(gp, lx, y0, lz + s1 / 2 + 0.06 + 0.035, 0.036, h1, 0.06, ET, 6);
  steps(gp, lx, y1, lz + s2 / 2 + 0.035, 0.03, h2, 0.035, ET, 4);
  // 太学: the 熹平石经 tablets in a row under a long shelter, the lecture hall behind
  const tx = 0.3;
  for (const [z, n] of [[-0.17, 7], [-0.03, 7], [0.11, 7]] as [number, number][]) for (let i = 0; i < n; i++) {
    const x = tx - 0.12 + i * 0.04;
    box(gp, '#7a766e', x, y0, z, 0.03, 0.005, 0.012);
    box(gp, ST, x, y0 + 0.005, z, 0.024, 0.026, 0.005);
    for (let r = 0; r < 4; r++) box(gp, '#85817a', x, y0 + 0.009 + r * 0.0045, z + 0.0026, 0.019, 0.0018, 0.0004);
  }
  const e = body(gp, tx, y0, -0.33, 0.2, 0.07, 0.045, { wall: PL, col: RED, beam: '#3a3430', sp: 0.04, cr: 0.0042, door: '#2e2a28', doorN: 3 });
  roof(gp, tx, e, -0.33, 0.25, 0.12, 0.055, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  // scholars in dark robes reading and copying at the tablets, an astronomer on the terrace
  for (let i = 0; i < 6; i++) figure(gp, tx - 0.1 + (i % 3) * 0.09 + (i > 2 ? 0.03 : 0), y0, i > 2 ? 0.15 : 0.01, 0.027, ['#3a3532', '#4a3f38', '#2f2c2a', '#5a4a3c'][i % 4], { hat: 'cap', ry: Math.PI + (i - 2.5) * 0.15 });
  figure(gp, lx + 0.035, y2, lz - 0.03, 0.027, '#3a3532', { hat: 'cap', ry: -0.6 });
  figure(gp, lx, y0, lz + hw + 0.06, 0.027, '#4a3f38', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.4 });
  figure(gp, 0.12, y0, 0.2, 0.027, '#5a4a3c', { pose: 'walk', ry: Math.PI, phase: 0.1 });
  tree(gp, 0.12, y0, -0.3, 0.07, '#5f7340');
};

/**
 * 魏晋洛阳太极殿 (235, rebuilt by Northern Wei 493), excavated 2012–16: one immense hall on a rammed-earth terrace about
 * 100 × 60 m, 12 bays wide, flanked by the smaller 东堂 and 西堂 (≈ 48 × 22 m) in a row — the 太极殿–东西堂 system of the
 * Wei–Jin–Southern Dynasties — and, far in front, the 阊阖门 gate on its platform with two que joined to it in a 凹 plan.
 * Grey tile, 鸱尾 on the ridges, red posts, white walls.
 * Refs: 中国社科院考古所洛阳汉魏城队《河南洛阳市汉魏故城太极殿遗址的发掘》(考古2016.7); 《北魏洛阳城宫城阊阖门遗址》(考古2003.7).
 */
const cap_taiji: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, PAVE, PAVE_SIDE);
  const tile = '#4b4f55', PL = '#e0d8c6', RED = '#8a3a2c', BR = '#9a8c70', BRT = '#ae9f82', ST = '#b9b3a5', BK = '#7a4a32', CHI = '#3a3d42';
  // 太极殿 terrace and the 12-bay hall
  const hz = -0.2, y1 = earth(gp, 0, y0, hz, 0.54, 0.26, 0.52, 0.245, 0.05, BR, 4, BRT);
  railRun(gp, -0.25, -0.16, y1, hz + 0.118, ST, undefined, 0.012);
  railRun(gp, -0.08, 0.08, y1, hz + 0.118, ST, undefined, 0.012);
  railRun(gp, 0.16, 0.25, y1, hz + 0.118, ST, undefined, 0.012);
  const bw = 0.42, bd = 0.15;
  const et = body(gp, 0, y1, hz - 0.01, bw, bd, 0.085, { wall: PL, col: RED, bracket: BK, beam: RED, sp: bw / 12, cr: 0.0055 });
  for (let i = 0; i < 12; i++) box(gp, Math.abs(i - 5.5) < 4 ? '#7a3026' : '#4a4640', -bw / 2 + (i + 0.5) * (bw / 12), y1, hz - 0.01 + bd / 2 - 0.002, 0.022, 0.06, 0.004);
  roof(gp, 0, et, hz - 0.01, 0.52, 0.25, 0.115, { tile, k: 0.25, lift: 0.12, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.03 });
  for (const sx of [-1, 1]) steps(gp, sx * 0.12, y0, hz + 0.13 + 0.05, 0.05, y1 - y0, 0.05, ST, 5);
  // 东堂 / 西堂 on their own lower terraces
  for (const sx of [-1, 1]) {
    const x = sx * 0.365, yb = earth(gp, x, y0, hz + 0.01, 0.15, 0.13, 0.145, 0.125, 0.026, BR, 2, BRT);
    const e = body(gp, x, yb, hz + 0.01, 0.11, 0.07, 0.05, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.022, cr: 0.0042, door: '#7a3026', doorN: 3 });
    roof(gp, x, e, hz + 0.01, 0.15, 0.115, 0.06, { tile, k: 0.25, lift: 0.12, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.017 });
    steps(gp, x, y0, hz + 0.075 + 0.03, 0.04, 0.026, 0.03, ST, 3);
  }
  // 阊阖门: platform with three passages, a seven-bay gate tower, walls running forward to the two que
  const gz = 0.2, gh = 0.05;
  earth(gp, 0, y0, gz, 0.3, 0.08, 0.29, 0.075, gh, BR, 4, BRT);
  for (const x of [-0.07, 0, 0.07]) box(gp, '#2e2620', x, y0, gz + 0.038, 0.034, 0.036, 0.004);
  for (const sx of [-1, 1]) box(gp, BR, sx * 0.3, y0, gz, 0.3, 0.035, 0.03);
  const eg = body(gp, 0, y0 + gh, gz, 0.22, 0.06, 0.042, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.22 / 7, cr: 0.0045 });
  roof(gp, 0, eg, gz, 0.29, 0.12, 0.055, { tile, k: 0.25, lift: 0.12, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.018 });
  for (const sx of [-1, 1]) {
    box(gp, BR, sx * 0.2, y0, gz + 0.075, 0.025, 0.035, 0.11);
    que(gp, sx * 0.24, y0, 0.34, sx, tile, 0.62);
  }
  // court officials in Jin robes and gauze caps; guards at the gate
  for (const x of [-0.035, 0.035]) figure(gp, x, y0, gz + 0.065, 0.027, '#6a2e26', { armor: '#5e5850', hat: 'helmet' });
  figure(gp, -0.06, y0, 0.0, 0.027, '#2f2c30', { hat: 'cap', pose: 'walk', ry: 0.1, phase: 0.2 });
  figure(gp, 0.05, y0, -0.02, 0.027, '#4a3a42', { hat: 'cap', pose: 'walk', ry: -0.1, phase: 0.7 });
  figure(gp, 0.0, y0, 0.32, 0.027, '#5a4a3c', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.4 });
};

/** Southern Dynasties stone 辟邪 (winged lion of the 南朝陵墓石刻): striding, chest thrust out, head high, wings on the flank. */
function bixie(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y), S = '#8c877c', B = shade(S, 0.85);
  box(g0, B, 0, 0, 0, s * 0.42, s * 0.08, s * 1.15);
  for (const [lx, lz] of [[-0.12, 0.34], [0.12, 0.2], [-0.12, -0.3], [0.12, -0.38]]) box(g0, S, lx * s, s * 0.08, lz * s, s * 0.12, s * 0.32, s * 0.14);
  ellip(g0, S, 0, s * 0.52, 0, s * 0.2, s * 0.17, s * 0.45, 0, -0.25);
  ellip(g0, S, 0, s * 0.68, s * 0.34, s * 0.17, s * 0.22, s * 0.16, 0, 0.5);
  ellip(g0, S, 0, s * 0.86, s * 0.45, s * 0.14, s * 0.13, s * 0.14);
  box(g0, B, 0, s * 0.74, s * 0.56, s * 0.17, s * 0.1, s * 0.06);
  for (const sx of [-1, 1]) slab(grp(g0, sx * s * 0.2, 0, Math.PI / 2, 0), [[s * 0.25, s * 0.5], [-s * 0.15, s * 0.42], [-s * 0.05, s * 0.66], [s * 0.22, s * 0.68]], s * 0.03, B, 0, false);
  ellip(g0, B, 0, s * 0.6, -s * 0.48, s * 0.05, s * 0.18, s * 0.05, 0, 0.4);
}

/**
 * 东晋南朝建康台城 (330–589): the palace city behind a rammed-earth wall faced with grey brick (brick facing of the city walls
 * is attested from the Southern Dynasties), a gate with three timber-lintelled passages and a gate tower; inside the
 * 太极殿 with 鸱尾 and the 华林园 with its 天渊池; north of the wall the nine-storey wooden pagoda of 同泰寺; in front the
 * 秦淮河 crossed by the 朱雀航 pontoon bridge, and a pair of the Southern Dynasties stone 辟邪.
 * Refs: 南京市考古研究所《南京六朝建康城遗址考古》(2008–2015 台城城墙/城门); 贺云翱《六朝瓦当与六朝都城》(2005); 《建康实录》.
 */
const cap_jiankang: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, GRASS, GRASS_SIDE);
  const tile = '#4c5056', BR = '#7d7b76', BRT = '#8d8a83', PL = '#ddd5c2', RED = '#8a3a2c', BK = '#4a4038', CHI = '#3a3d42', WATER = '#58706c';
  // 秦淮河 and the pontoon bridge of boats
  ribbon(gp, [[-0.46, 0.34], [-0.2, 0.37], [0.1, 0.36], [0.46, 0.38]], 0.09, y0, 0.0015, '#8a8468');
  ribbon(gp, [[-0.46, 0.34], [-0.2, 0.37], [0.1, 0.36], [0.46, 0.38]], 0.065, y0, 0.003, WATER);
  for (let i = 0; i < 5; i++) ellip(gp, '#4e4034', 0, y0 + 0.004, 0.335 + i * 0.012, 0.022, 0.004, 0.0055);
  box(gp, '#7a6448', 0, y0 + 0.007, 0.36, 0.03, 0.002, 0.075);
  for (const sx of [-1, 1]) bixie(gp, sx * 0.08, y0, 0.27, 0.05, -sx * Math.PI / 2);
  // the brick-faced wall of the 台城 with a parapet; return walls at the sides
  const wz = 0.16, wh = 0.065;
  const seg = (x: number, z: number, w: number, d: number) => {
    const t = earth(gp, x, y0, z, w, d, w - 0.008, d - 0.008, wh, BR, 7, BRT);
    return t;
  };
  for (const sx of [-1, 1]) {
    seg(sx * 0.27, wz, 0.34, 0.04);
    seg(sx * 0.42, wz - 0.12, 0.04, 0.2);
    for (let i = 0; i < 9; i++) box(gp, BR, sx * (0.12 + i * 0.036), y0 + wh, wz + 0.016, 0.018, 0.008, 0.006);
  }
  // gate: base with three rectangular passages, a five-bay tower above
  const gy = earth(gp, 0, y0, wz, 0.22, 0.07, 0.215, 0.065, 0.075, BR, 7, BRT);
  for (const x of [-0.06, 0, 0.06]) {
    box(gp, '#2a2420', x, y0, wz + 0.033, x ? 0.03 : 0.036, x ? 0.042 : 0.048, 0.005);
    box(gp, '#5a4634', x, y0 + (x ? 0.042 : 0.048), wz + 0.035, (x ? 0.03 : 0.036) + 0.004, 0.004, 0.003);
  }
  const eg = body(gp, 0, gy, wz, 0.16, 0.05, 0.04, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.032, cr: 0.004, door: '#6e2a22', doorN: 3 });
  roof(gp, 0, eg, wz, 0.21, 0.1, 0.05, { tile, k: 0.3, lift: 0.2, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.016 });
  railRun(gp, -0.1, 0.1, gy, wz + 0.033, RED, undefined, 0.01);
  // 太极殿 on a brick-edged terrace
  const hz = -0.1, ty = earth(gp, 0, y0, hz, 0.36, 0.17, 0.35, 0.16, 0.03, BR, 3, BRT);
  const et = body(gp, 0, ty, hz, 0.28, 0.1, 0.065, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.028, cr: 0.005, door: '#6e2a22', doorN: 6 });
  roof(gp, 0, et, hz, 0.36, 0.18, 0.09, { tile, k: 0.3, lift: 0.2, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.026 });
  steps(gp, 0, y0, hz + 0.085 + 0.04, 0.06, 0.03, 0.04, '#9a968c', 4);
  // 华林园: the 天渊池 with willows and a lakeside pavilion
  const px = -0.3, pz = -0.29;
  prism(gp, [[px - 0.12, pz - 0.08], [px + 0.06, pz - 0.1], [px + 0.12, pz - 0.02], [px + 0.07, pz + 0.07], [px - 0.08, pz + 0.08], [px - 0.13, pz + 0.01]], y0, 0.003, WATER, 0, true);
  const ep = body(gp, px + 0.07, y0, pz + 0.075, 0.05, 0.05, 0.03, { wall: PL, col: RED, sp: 0.025, cr: 0.0035 });
  roof(gp, px + 0.07, ep, pz + 0.075, 0.08, 0.08, 0.035, { tile, k: 0.3, lift: 0.3 });
  for (const [x, z] of [[-0.42, -0.2], [-0.2, -0.38], [-0.42, -0.38], [-0.18, -0.2]] as [number, number][]) tree(gp, x, y0, z, 0.065, '#6f8048');
  // 同泰寺 pagoda (527), square, nine storeys, wooden, beyond the north wall
  const ox = 0.3, oz = -0.3;
  rbox(gp, BRT, ox, y0, oz, 0.09, 0.014, 0.09, 0.003);
  let py = y0 + 0.014;
  for (let i = 0; i < 9; i++) {
    const w = 0.06 - i * 0.0035, h = i ? 0.02 : 0.03;
    box(gp, i % 2 ? '#7a3a2c' : RED, ox, py, oz, w * 0.7, h, w * 0.7);
    roof(gp, ox, py + h, oz, w + 0.018, w + 0.018, 0.008, { tile, inner: [w * 0.7 - 0.01, w * 0.7 - 0.01], k: 0.1, lift: 0.3 });
    py += h + 0.004;
  }
  cyl(gp, '#6f5a36', ox, py, oz, 0.0025, 0.05, 5);
  for (let i = 0; i < 5; i++) cyl(gp, '#8a7040', ox, py + 0.012 + i * 0.007, oz, 0.008, 0.002, 8);
  // gate guards; officials in wide-sleeved robes and gauze caps
  for (const x of [-0.035, 0.035]) figure(gp, x, y0, wz + 0.06, 0.027, '#6a2e26', { armor: '#5e5850', hat: 'helmet' });
  figure(gp, -0.15, y0, 0.24, 0.027, '#2f3a40', { hat: 'cap', pose: 'walk', ry: 0.5, phase: 0.3 });
  figure(gp, 0.17, y0, 0.25, 0.027, '#5e5048', { hat: 'cap', ry: -2.6 });
  figure(gp, 0.04, y0, 0.05, 0.027, '#3a3040', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.5 });
};

/** Pine: dark umbrella crowns on a crooked trunk (the 凤凰山 / 西湖 hillsides). */
function pine(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  cyl(p, '#4a3a2c', x, y, z, s * 0.06, s * 0.7, 5);
  for (let i = 0; i < 3; i++) ellip(p, shade('#4a5a3c', 0.92 + i * 0.07), x + (hash3(x, z, i) - 0.5) * s * 0.3, y + s * (0.55 + i * 0.18), z + (hash3(z, x, i) - 0.5) * s * 0.3, s * (0.34 - i * 0.07), s * 0.1, s * (0.3 - i * 0.06));
}

/**
 * 南宋临安皇城 (1138–1276) on the eastern slopes of 凤凰山 above the 钱塘江, the West Lake just to the north-west: no
 * axial court of a northern capital but halls on terraces climbing the hillside (垂拱殿, 崇政殿 in modest five-bay
 * form), a red-washed palace wall following the slope, the northern gate 和宁门 opening on the 御街, grey-tiled 歇山 roofs
 * with 鸱吻, pines and the hills all round; the 雷峰塔 (975) on the lake shore.
 * Refs: 杭州市文物考古所《南宋临安城考古》(2008); 《咸淳临安志》皇城图; 《梦粱录》卷八〈大内〉; 傅伯星《南宋皇城探秘》.
 */
const cap_linan: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, GRASS, GRASS_SIDE);
  const tile = '#55595e', HG = '#5f6b47', HG2 = '#6d7752', ST = '#8f8a7e', STT = '#a29c8e', PL = '#e3dccb', RED = '#8e3a2c', WALL = '#9c4a3a', BK = '#4f6a62', WATER = '#5c7470';
  // 凤凰山 and its spurs behind and to the west
  hill(gp, -0.1, y0, -0.42, 0.36, 0.14, 0.15, HG);
  hill(gp, 0.25, y0, -0.43, 0.26, 0.1, 0.1, HG2);
  hill(gp, -0.44, y0, -0.16, 0.12, 0.24, 0.09, HG2);
  hill(gp, 0.44, y0, -0.2, 0.1, 0.2, 0.06, HG);
  for (const [x, z, yy] of [[-0.32, -0.36, 0.06], [-0.22, -0.38, 0.11], [-0.03, -0.39, 0.13], [0.13, -0.385, 0.09], [0.24, -0.4, 0.08], [0.34, -0.39, 0.05], [-0.41, -0.24, 0.06], [-0.41, -0.06, 0.06], [0.42, -0.14, 0.04], [0.4, -0.3, 0.035], [-0.16, -0.33, 0.04]] as [number, number, number][])
    pine(gp, x, y0 + yy, z, 0.065);
  // three stone-faced terraces climbing the slope, each with its hall
  const T: [number, number, number, number, number][] = [[0.03, 0.07, 0.4, 0.15, 0.02], [-0.07, -0.11, 0.32, 0.13, 0.05], [0.07, -0.27, 0.26, 0.12, 0.085]];
  const H: [number, number, number, number][] = [[0.24, 0.08, 0.05, 0.11], [0.2, 0.07, 0.045, 0.1], [0.15, 0.065, 0.045, 0.09]];
  T.forEach(([x, z, w, d, h], i) => {
    const ty = earth(gp, x, y0, z, w, d, w - 0.006, d - 0.006, h, ST, Math.max(1, Math.round(h / 0.012)), STT);
    railRun(gp, x - w / 2 + 0.005, x - 0.03, ty, z + d / 2 - 0.004, RED, undefined, 0.011);
    railRun(gp, x + 0.03, x + w / 2 - 0.005, ty, z + d / 2 - 0.004, RED, undefined, 0.011);
    const [bw, bd, bh, rh] = H[i], hz = z - 0.01;
    const et = body(gp, x, ty, hz, bw, bd, bh, { wall: PL, col: RED, beam: RED, bracket: BK, sp: bw / 5, cr: 0.0045, door: '#7a2e25', doorN: 5 });
    roof(gp, x, et, hz, bw + 0.07, bd + 0.07, rh * 0.6, { tile, k: 0.45, lift: 0.55, xie: 0.72 });
    steps(gp, x, y0, z + d / 2 + (i ? 0.035 : 0.04), 0.04, h, i ? 0.035 : 0.04, STT, 3 + i * 2);
  });
  // red palace wall along the front with 和宁门 (gate base, single gate tower under a 歇山 roof)
  const wz = 0.24, wh = 0.04;
  for (const sx of [-1, 1]) {
    box(gp, WALL, sx * 0.24, y0, wz, 0.32, wh, 0.018);
    roof(gp, sx * 0.24, y0 + wh, wz, 0.33, 0.032, 0.012, { tile, k: 0.2, ridge: shade(tile, 0.75) });
  }
  const gy = earth(gp, 0, y0, wz, 0.16, 0.06, 0.155, 0.055, 0.055, WALL, 1, shade(WALL, 1.1));
  for (const x of [-0.04, 0.04]) slab(grp(gp, x, wz + 0.028, 0, y0), [[-0.016, 0], [0.016, 0], [0.016, 0.03], [0.009, 0.038], [-0.009, 0.038], [-0.016, 0.03]], 0.006, '#2a2420', 0, false);
  const eg = body(gp, 0, gy, wz, 0.13, 0.045, 0.038, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.026, cr: 0.004 });
  roof(gp, 0, eg, wz, 0.19, 0.1, 0.055, { tile, k: 0.45, lift: 0.55, xie: 0.72 });
  // 御街 leading north, the 钱塘江 in the south-east and the West Lake with 雷峰塔 to the west
  box(gp, '#a49c8a', 0, y0, 0.34, 0.06, 0.0015, 0.17);
  prism(gp, [[0.18, 0.43], [0.443, 0.25], [0.443, 0.423], [0.18, 0.423]], y0, 0.003, WATER);
  ellip(gp, '#4e4034', 0.36, y0 + 0.004, 0.37, 0.025, 0.004, 0.007, 0.6);
  slab(grp(gp, 0.36, 0.37, 0.6 + Math.PI / 2, y0 + 0.006), [[-0.006, 0], [0.012, 0], [0, 0.03]], 0.002, '#cfc4a8', 0, false);
  prism(gp, [[-0.443, 0.1], [-0.3, 0.12], [-0.25, 0.22], [-0.3, 0.36], [-0.443, 0.4]], y0, 0.003, WATER, 0, true);
  const lx = -0.37, lz = 0.13;
  let ly = y0;
  for (let i = 0; i < 5; i++) {
    const r = 0.022 - i * 0.002, h = i ? 0.02 : 0.026;
    cyl(gp, i ? '#8a6e52' : '#7a604a', lx, ly, lz, r * 0.75, h, 8);
    roof(gp, lx, ly + h, lz, r * 2.2, r * 2.2, 0.006, { tile, inner: [r * 1.4, r * 1.4], k: 0.2, lift: 0.4 });
    ly += h + 0.003;
  }
  cone(gp, '#5f5a50', lx, ly, lz, 0.008, 0.02, 8);
  // court officials in Song robes with long-winged caps, guards at the gate
  for (const x of [-0.03, 0.03]) figure(gp, x, y0, wz + 0.05, 0.026, '#8a3a30', { hat: 'plume', hatC: '#4f4b45', armor: '#6b6258' });
  figure(gp, -0.02, y0, 0.36, 0.026, '#4f5f4a', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.3 });
  figure(gp, 0.15, y0 + T[0][4], 0.12, 0.026, '#5a4762', { hat: 'cap', ry: -0.4 });
};

/** Doric-to-Ionic column on a pedestal: shaft, volute capital and base. */
function column(p: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, c: string): void {
  box(p, c, x, y, z, r * 3.2, r * 1.6, r * 3.2);
  cyl(p, c, x, y + r * 1.6, z, r, h - r * 2.8, 8);
  box(p, c, x, y + h - r * 1.2, z, r * 3.2, r * 0.5, r * 2.2);
  for (const sx of [-1, 1]) cyl(grp(p, x + sx * r * 1.3, z + r * 0.9, 0, y + h - r * 1.25), shade(c, 0.95), 0, 0, 0, r * 0.45, r * 0.25, 6).rotation.set(Math.PI / 2, 0, 0);
  box(p, c, x, y + h - r * 0.7, z, r * 3.2, r * 0.7, r * 3.2);
}

/**
 * 南京国民政府 / 总统府 (1912–1949): the 1929 gateway on 长江路 by 姚彬 — a cement-rendered neoclassical front 26.8 m wide and
 * 14 m high with three round-arched openings closed by black iron gates, eight Ionic columns in pairs, an entablature and an
 * attic bearing the name plaque, the 青天白日满地红 flag on the pole above; behind it the axis of the old 两江总督署:
 * the grey-tiled 大堂, the five-storey 子超楼 (1935) in grey render, and to the west the 煦园 pond with its stone boat 不系舟.
 * Refs: 南京中国近代史遗址博物馆 (总统府) site; 刘先觉《南京近代建筑》; 《首都计划》(1929).
 */
const cap_nanjing_roc: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, PAVE, PAVE_SIDE);
  const CEM = '#b9b3a3', CEMD = '#a29c8d', tile = '#55595e', WATER = '#5c7470', RED = '#8a3a2c', PL = '#e0d8c6';
  // 长江路 with plane trees
  box(gp, '#5f5d58', 0, y0, 0.36, 0.888, 0.0015, 0.1);
  for (const x of [-0.4, -0.25, 0.25, 0.4]) tree(gp, x, y0, 0.29, 0.07, '#6c7a48');
  // the gateway: 0.012 per metre
  const gz = 0.22, gw = 0.32, gd = 0.065, gh = 0.12, fz = gz + gd / 2;
  box(gp, CEM, 0, y0, gz, gw, gh, gd);
  box(gp, CEMD, 0, y0, gz, gw + 0.004, 0.008, gd + 0.004);
  const arches: [number, number, number][] = [[-0.095, 0.042, 0.068], [0, 0.056, 0.085], [0.095, 0.042, 0.068]];
  for (const [x, w, h] of arches) {
    const out: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; out.push([(Math.cos(a) * w) / 2, h - w / 2 + (Math.sin(a) * w) / 2]); }
    slab(grp(gp, x, fz, 0, y0), out, 0.006, '#2b2a28', 0, false);
    for (let i = 1; i < 8; i++) box(gp, '#1e1e1e', x - w / 2 + (i * w) / 8, y0, fz + 0.0035, 0.0018, h - w / 2, 0.0018);
    box(gp, '#1e1e1e', x, y0 + (h - w / 2) * 0.45, fz + 0.0035, w, 0.002, 0.002);
    box(gp, '#9a8040', x, y0 + h - w / 2, fz + 0.0035, w, 0.0025, 0.002);
  }
  for (const x of [-0.145, -0.048, 0.048, 0.145]) for (const s of [-1, 1]) column(gp, x + s * 0.008, y0, fz + 0.005, 0.0035, 0.088, CEM);
  box(gp, CEMD, 0, y0 + 0.088, gz + 0.004, gw + 0.01, 0.012, gd + 0.012);
  box(gp, CEM, 0, y0 + 0.1, gz + 0.004, gw + 0.016, 0.005, gd + 0.016);
  box(gp, CEM, 0, y0 + 0.105, gz, 0.2, 0.02, gd * 0.8);
  box(gp, '#3a3a36', 0, y0 + 0.108, fz - 0.005, 0.11, 0.014, 0.002);
  for (let i = 0; i < 6; i++) box(gp, '#b99a50', -0.045 + i * 0.018, y0 + 0.111, fz - 0.0035, 0.01, 0.008, 0.001);
  // flagpole and the 青天白日满地红 flag
  const fy = y0 + 0.125;
  cyl(gp, '#d8d4c8', 0, fy, gz, 0.0018, 0.11, 5);
  ellip(gp, '#b99a50', 0, fy + 0.111, gz, 0.0035);
  const fl = grp(gp, 0.002, gz, 0, fy + 0.07);
  box(fl, '#b02a24', 0.03, 0, 0, 0.06, 0.038, 0.0015);
  box(fl, '#1f3d8a', 0.015, 0.019, 0, 0.03, 0.019, 0.002);
  cyl(fl, '#f2efe6', 0.015, 0.0285, 0, 0.005, 0.003, 10).rotation.set(Math.PI / 2, 0, 0);
  // court behind: the 大堂 (grey-tiled Qing hall of the old 督署) and the 子超楼
  box(gp, '#a59d8c', 0, y0, 0.0, 0.05, 0.0015, 0.36);
  const hz = 0.02, et = body(gp, 0, y0 + 0.012, hz, 0.2, 0.08, 0.045, { wall: PL, col: RED, beam: '#3c4a46', sp: 0.04, cr: 0.0042, door: '#5a2a22', doorN: 3 });
  rbox(gp, '#a39d90', 0, y0, hz, 0.23, 0.012, 0.11, 0.003);
  roof(gp, 0, et, hz, 0.25, 0.13, 0.05, { tile, k: 0.35, lift: 0.15, xie: 0.7 });
  box(gp, '#2a2e3a', 0, et - 0.012, hz + 0.042, 0.05, 0.012, 0.002);
  const zx = 0.05, zz = -0.28, zb = 0.26, zd = 0.08, fh = 0.026;
  box(gp, '#8f8a80', zx, y0, zz, zb, 0.012, zd);
  box(gp, '#a7a196', zx, y0 + 0.012, zz, zb - 0.006, fh * 5, zd - 0.006);
  for (let f = 0; f < 5; f++) for (let i = 0; i < 12; i++) box(gp, '#3a3c3c', zx - zb / 2 + 0.014 + i * ((zb - 0.028) / 11), y0 + 0.012 + f * fh + 0.007, zz + zd / 2 - 0.002, 0.01, 0.014, 0.002);
  box(gp, '#8f8a80', zx, y0 + 0.012 + fh * 5, zz, zb + 0.004, 0.005, zd + 0.004);
  box(gp, '#a7a196', zx, y0 + 0.017 + fh * 5, zz, 0.06, 0.03, 0.05);
  cyl(gp, '#d8d4c8', zx, y0 + 0.047 + fh * 5, zz, 0.0014, 0.04, 5);
  // 煦园: the pond and the stone boat 不系舟, a pavilion, willows
  prism(gp, [[-0.41, -0.05], [-0.25, -0.08], [-0.2, 0.0], [-0.24, 0.1], [-0.36, 0.12], [-0.42, 0.06]], y0, 0.003, WATER, 0, true);
  box(gp, '#b9b4a8', -0.31, y0, 0.02, 0.024, 0.01, 0.08);
  const eb = body(gp, -0.31, y0 + 0.01, 0.015, 0.018, 0.05, 0.018, { wall: PL, col: '#5a3a2c', sp: 0.025, cr: 0.0025 });
  gable(gp, 0.026, 0.012, 0.06, tile, -0.31, eb, 0.015, Math.PI / 2);
  const ep = body(gp, -0.22, y0, -0.17, 0.05, 0.05, 0.028, { wall: PL, col: RED, sp: 0.025, cr: 0.0032 });
  roof(gp, -0.22, ep, -0.17, 0.08, 0.08, 0.035, { tile, k: 0.4, lift: 0.5 });
  for (const [x, z] of [[-0.4, -0.15], [-0.4, 0.17], [-0.18, 0.13], [0.3, 0.05], [0.38, -0.08], [-0.33, -0.33]] as [number, number][]) tree(gp, x, y0, z, 0.065, '#6c7a48');
  // sentries in peaked caps and khaki, people in 长衫
  for (const x of [-0.06, 0.06]) human(gp, x, y0, fz + 0.03, { h: 0.027, top: '#6b6a4a', bottom: '#5e5d40', skin: '#c49a76', hair: '#1d1915', hat: '#5e5d40', hatStyle: 'peaked', shoes: '#2a2420', detail: 'lo' });
  figure(gp, -0.17, y0, 0.36, 0.027, '#3a4450', { pose: 'walk', ry: Math.PI / 2, phase: 0.3 });
  figure(gp, 0.2, y0, 0.37, 0.027, '#5a5a5a', { pose: 'walk', ry: -Math.PI / 2, phase: 0.7 });
  figure(gp, 0.02, y0, 0.12, 0.027, '#2e3440', { pose: 'walk', ry: Math.PI, phase: 0.5 });
};

export const H_CAPITALS: Record<string, Builder> = {
  cap_erlitou, cap_yinxu, cap_zhou, cap_luoyi, cap_xianyang, cap_qinhan, cap_luoyang, cap_taiji, cap_jiankang, cap_tang, cap_song, cap_linan, cap_yuan, cap_nanjing_roc,
};
