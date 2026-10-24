import * as THREE from 'three';
import { type Builder, type V3, add, mat, box, rbox, cyl, cone, ellip, lathe, rod, skin, slab, gable, tbox, shade, hash3 } from '../prims.ts';
import { grp, minipine } from '../timber.ts';
import { soldier, banner } from '../rich.ts';

// Dynastic capitals, one per architectural period (pack "capitals"): Erlitou/Shang rammed-earth courtyard palace, a Zhou
// terrace hall, the Qin–Han terrace palace with que towers, the Tang Hanyuan Hall, the Song Xuande Gate and Yuan Dadu's
// Daming Hall. Ming–Qing keep `palace`, modern capitals `monument`. Front faces +z, base at y=0, footprint ≈ ±0.45, same
// overall size and height (~0.4) as `palace` so they read as one family on the map.

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

/** A guard standing on a raised surface. */
function guard(p: THREE.Object3D, x: number, y: number, z: number, h: number, c: string, arm: 'spear' | 'ji' = 'ji'): void {
  soldier(grp(p, 0, 0, 0, y), x, z, h, c, { detail: 'lo', shield: false, arm });
}

/** Deciduous tree with a lumpy low-poly crown. */
function tree(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#5f7f3e'): void {
  cyl(p, C.darkwood, x, y, z, s * 0.09, s * 0.55, 5);
  for (let i = 0; i < 3; i++) ellip(p, i ? shade(c, 1 + (hash3(x, i, z) - 0.5) * 0.2) : c, x + (i - 1) * s * 0.18, y + s * (0.7 + (i % 2) * 0.16), z + (hash3(z, i, x) - 0.5) * s * 0.3, s * 0.32, s * 0.28, s * 0.3);
}

// ---- builders ---------------------------------------------------------------------------------------------------

/**
 * 二里头一号宫殿 / 偃师商城 / 殷墟 palace: a rammed-earth platform enclosed by thatched post corridors with a three-passage
 * gate, the long thatched four-slope (四阿) hall on its own raised base at the back.
 * Refs: https://commons.wikimedia.org/wiki/File:二里头一号宫殿复原图.png ,
 * https://commons.wikimedia.org/wiki/File:Model_of_Shang_Palace_(10197649246).jpg ,
 * https://commons.wikimedia.org/wiki/File:20240817_Model_of_Shang_Dynasty_Palace.jpg
 */
const cap_erlitou: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.78, '#9c8a62');
  const yp = earth(gp, 0, y0, 0, 0.86, 0.72, 0.84, 0.7, 0.04, C.earth, 3, C.earthTop);
  const W = 0.8, D = 0.64, cd = 0.06, ch = 0.04;
  // enclosing corridors (廊庑): daub back wall, timber posts, thatched hip roofs
  const thatch: RoofO = { tile: C.straw, thatch: true, k: 0.05, ridge: shade(C.straw, 0.82), under: '#8a7448', fascia: shade(C.straw, 0.82) };
  for (const sz of [-1, 1]) {
    const zc = (sz * (D - cd)) / 2;
    if (sz < 0) {
      body(gp, 0, yp, zc, W, cd, ch, { wall: C.daub, col: C.darkwood, sp: 0.036, cr: 0.004 });
      roof(gp, 0, yp + ch, zc, W + 0.035, cd + 0.035, 0.04, thatch);
    } else for (const sx of [-1, 1]) {
      const x0 = sx * 0.12, x1 = (sx * W) / 2, xc = (x0 + x1) / 2, ww = Math.abs(x1 - x0);
      body(gp, xc, yp, zc, ww, cd, ch, { wall: C.daub, col: C.darkwood, sp: 0.036, cr: 0.004 });
      roof(gp, xc, yp + ch, zc, ww + 0.035, cd + 0.035, 0.04, thatch);
    }
  }
  for (const sx of [-1, 1]) {
    const xc = (sx * (W - cd)) / 2;
    body(gp, xc, yp, 0, cd, D - cd * 2, ch, { wall: C.daub, col: C.darkwood, sp: 0.036, cr: 0.004 });
    roof(grp(gp, xc, 0, Math.PI / 2), 0, yp + ch, 0, D - cd * 2 + 0.02, cd + 0.035, 0.04, thatch);
  }
  // the gate (大门): three passages under a larger thatched roof
  const gz = (D - cd) / 2;
  body(gp, 0, yp, gz, 0.24, cd + 0.02, 0.05, { wall: C.daub, col: C.darkwood, sp: 0.03, cr: 0.0045 });
  for (const x of [-0.07, 0, 0.07]) box(gp, '#2a2018', x, yp, gz + (cd + 0.02) / 2 - 0.004, 0.036, 0.042, 0.012);
  roof(gp, 0, yp + 0.05, gz, 0.29, cd + 0.065, 0.06, thatch);
  steps(gp, 0, y0, 0.39, 0.14, yp - y0, 0.03, C.earth, 3);
  // courtyard floor and the main hall on its own rammed-earth base
  box(gp, '#cdb084', 0, yp, 0.02, W - cd * 2, 0.002, D - cd * 2);
  const hz = -0.1, yb = earth(gp, 0, yp, hz, 0.5, 0.24, 0.48, 0.22, 0.05, C.earth, 2, C.earthTop);
  steps(gp, -0.1, yp, hz + 0.15, 0.05, 0.05, 0.04, C.earth, 4);
  steps(gp, 0.1, yp, hz + 0.15, 0.05, 0.05, 0.04, C.earth, 4);
  const et = body(gp, 0, yb, hz, 0.42, 0.16, 0.08, { wall: C.daub, col: C.darkwood, sp: 0.03, cr: 0.0055, door: '#3a2a1a', doorN: 3 });
  roof(gp, 0, et, hz, 0.52, 0.27, 0.16, { ...thatch, k: 0.12, th: 0.018 });
  // a bronze ding and guards with dagger-axes
  lathe(gp, [[0, 0.012], [0.02, 0.012], [0.022, 0.03], [0.018, 0.034], [0, 0.034]], C.bronze, 0, yp, 0.1, 10);
  for (const sx of [-1, 1]) { rod(gp, [sx * 0.012, yp, 0.1], [sx * 0.012, yp + 0.014, 0.1], 0.003, C.bronze, 4); guard(gp, sx * 0.13, y0, 0.37, 0.1, '#7a5a3a'); }
  tree(gp, -0.38, y0, 0.36, 0.09);
  tree(gp, 0.39, y0, -0.36, 0.08);
};

/**
 * 西周凤雏 / 东周高台建筑: a courtyard (with the earliest known screen wall 影壁 before the gate) whose hall stands on a
 * two-step rammed-earth terrace (台榭), under an early grey tile hip roof with straight eaves; side wings with gable roofs.
 * Refs: https://commons.wikimedia.org/wiki/File:陕历博第一展厅06.jpg (凤雏 courtyard model, Shaanxi History Museum),
 * https://commons.wikimedia.org/wiki/File:Model_of_Restored_Xianyang_Qin_Palace_Made_in_1992_(9910397415).jpg
 */
const cap_zhou: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.8, '#8f8a5c');
  const yp = earth(gp, 0, y0, -0.02, 0.84, 0.66, 0.82, 0.64, 0.03, C.loess, 2, '#c2a77a');
  const tile = C.greyTile;
  // rammed-earth enclosure walls with tile copings
  const W = 0.8, D = 0.6, zc = -0.02, wt = 0.022, wh = 0.055;
  const wallSeg = (x: number, z: number, w: number, d: number) => {
    earth(gp, x, yp, z, w, d, w, d, wh, C.loess, 2, shade(C.loess, 1.05));
    gable(gp, Math.max(w, d) + 0.01, 0.014, Math.min(w, d) + 0.016, tile, x, yp + wh, z, w > d ? 0 : Math.PI / 2);
  };
  wallSeg(0, zc - D / 2, W, wt);
  for (const sx of [-1, 1]) wallSeg((sx * W) / 2, zc, wt, D);
  for (const sx of [-1, 1]) wallSeg(sx * 0.255, zc + D / 2, 0.29, wt);
  // gate house (门塾) and the screen wall (屏/影壁) in front of it
  const gz = zc + D / 2;
  body(gp, 0, yp, gz, 0.2, 0.07, 0.05, { wall: C.plaster, col: C.darkwood, sp: 0.04 });
  box(gp, '#2a2220', 0, yp, gz + 0.03, 0.05, 0.04, 0.012);
  gable(gp, 0.25, 0.04, 0.11, tile, 0, yp + 0.05, gz);
  box(gp, shade(tile, 0.8), 0, yp + 0.086, gz, 0.25, 0.008, 0.008);
  earth(gp, 0, y0, 0.375, 0.16, 0.02, 0.16, 0.02, 0.05, C.loess, 2);
  gable(gp, 0.17, 0.012, 0.034, tile, 0, y0 + 0.05, 0.375);
  steps(gp, 0, y0, gz + 0.075, 0.08, yp - y0, 0.02, C.loess, 2);
  // east and west wings (厢房)
  for (const sx of [-1, 1]) {
    const x = sx * 0.3, z = 0.07;
    body(gp, x, yp, z, 0.08, 0.26, 0.05, { wall: C.plaster, col: C.darkwood, sp: 0.045 });
    gable(gp, 0.3, 0.045, 0.12, tile, x, yp + 0.05, z, Math.PI / 2);
    box(gp, shade(tile, 0.8), x, yp + 0.091, z, 0.008, 0.008, 0.3);
  }
  // the hall (前堂) on a two-step rammed-earth terrace
  const hz = -0.16;
  const t1 = earth(gp, 0, yp, hz, 0.52, 0.3, 0.5, 0.28, 0.07, C.loess, 4, '#c2a77a');
  const t2 = earth(gp, 0, t1, hz - 0.01, 0.4, 0.21, 0.38, 0.19, 0.055, C.loess, 3, '#c2a77a');
  steps(gp, 0, yp, hz + 0.21, 0.07, t1 - yp, 0.06, C.loess, 6);
  steps(gp, 0, t1, hz + 0.085, 0.06, t2 - t1, 0.04, C.loess, 5);
  const et = body(gp, 0, t2, hz - 0.01, 0.3, 0.14, 0.085, { wall: C.plaster, col: C.darkwood, beam: '#3a2a20', sp: 0.05, cr: 0.0055, door: '#5a3a26', doorN: 2 });
  roof(gp, 0, et, hz - 0.01, 0.41, 0.25, 0.12, { tile, k: 0.12, lift: 0.04, ridge: shade(tile, 0.75) });
  for (const sx of [-1, 1]) guard(gp, sx * 0.07, y0, 0.36, 0.1, '#5a4636');
  tree(gp, -0.15, yp, 0.13, 0.08, '#6f8a42');
  tree(gp, 0.39, y0, -0.37, 0.08);
  minipine(gp, -0.4, y0, -0.36, 0.09);
};

/** Han-style que (阙) gate tower with a lower subsidiary que (子阙) on the outer side; sx = which side. */
function que(p: THREE.Object3D, x: number, y: number, z: number, sx: number, tile: string, s = 1): void {
  const body0 = '#b9a684', band = '#3a3430';
  const qw = 0.075 * s, qd = 0.06 * s, qh = 0.2 * s;
  earth(p, x, y, z, qw * 1.12, qd * 1.12, qw, qd, qh, body0, 4, body0);
  box(p, C.vermilion, x, y + qh, z, qw + 0.008, 0.012 * s, qd + 0.008);
  box(p, band, x, y + qh + 0.012 * s, z, qw + 0.02, 0.012 * s, qd + 0.02);
  roof(p, x, y + qh + 0.024 * s, z, qw + 0.06 * s, qd + 0.055 * s, 0.045 * s, { tile, k: 0.25, lift: 0.18, ridge: shade(tile, 0.7) });
  const sx2 = x + sx * (qw / 2 + 0.024 * s), sh = qh * 0.6;
  earth(p, sx2, y, z, 0.05 * s, qd * 0.95, 0.045 * s, qd * 0.85, sh, body0, 3, body0);
  box(p, band, sx2, y + sh, z, 0.055 * s, 0.01 * s, qd * 0.85 + 0.012);
  roof(p, sx2 + sx * 0.004, y + sh + 0.01 * s, z, 0.085 * s, qd + 0.04 * s, 0.03 * s, { tile, k: 0.25, lift: 0.15, ridge: shade(tile, 0.7) });
}

/**
 * 咸阳宫 / 未央宫前殿: a very tall stepped rammed-earth terrace wrapped in tiled galleries (台榭), the great hall on top
 * with a dark grey hip roof and only slightly curved eaves, red columns, and a pair of que towers flanking the approach.
 * Refs: https://commons.wikimedia.org/wiki/File:Model_of_Restored_Xianyang_Qin_Palace_Made_in_1992_(9910397415).jpg ,
 * https://commons.wikimedia.org/wiki/File:A_Model_of_the_Site_of_Xianyang_Palace_I_01_2012-09.JPG ,
 * https://commons.wikimedia.org/wiki/File:Gaoyi_Que(Front).jpg
 */
const cap_qinhan: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.82, '#8d8a5a');
  const tile = '#45484e', zc = -0.1;
  const tiers: [number, number, number][] = [[0.76, 0.5, 0.075], [0.6, 0.38, 0.065], [0.46, 0.27, 0.055]];
  let y = y0;
  tiers.forEach(([w, d, h], i) => {
    const z = zc - i * 0.012;
    const top = earth(gp, 0, y, z, w, d, w - 0.01, d - 0.01, h, C.earth, 3, C.earthTop);
    if (i < 2) {
      // gallery skirt roof around the foot of the next tier, on red posts
      const [nw, nd] = tiers[i + 1], nz = zc - (i + 1) * 0.012, gw = nw + 0.075, gd = nd + 0.075, gh = tiers[i + 1][2] * 0.62;
      const n = Math.round(gw / 0.04);
      for (let k = 0; k <= n; k++) cyl(gp, C.vermilion, -gw / 2 + 0.008 + (k * (gw - 0.016)) / n, top, nz + gd / 2 - 0.008, 0.0035, gh, 5);
      for (const sx of [-1, 1]) for (let k = 0; k <= 3; k++) cyl(gp, C.vermilion, sx * (gw / 2 - 0.008), top, nz - gd / 2 + 0.008 + (k * (gd - 0.016)) / 3, 0.0035, gh, 5);
      roof(gp, 0, top + gh, nz, gw + 0.012, gd + 0.012, 0.018, { tile, inner: [nw - 0.004, nd - 0.004], k: 0.1, lift: 0.08 });
    }
    y = top;
  });
  // the front hall
  const hz = zc - 0.03;
  rbox(gp, C.earthTop, 0, y, hz, 0.4, 0.008, 0.22, 0.003);
  const et = body(gp, 0, y + 0.008, hz, 0.36, 0.17, 0.085, { wall: C.plaster, col: C.vermilion, beam: C.black, bracket: '#3a3430', sp: 0.04, cr: 0.0058, door: C.black, doorN: 5 });
  roof(gp, 0, et, hz, 0.48, 0.29, 0.12, { tile, k: 0.22, lift: 0.14, ridge: shade(tile, 0.72) });
  for (const sx of [-1, 1]) box(gp, shade(tile, 0.72), sx * 0.1, et + 0.115, hz, 0.012, 0.018, 0.012);
  // one long central stair climbing all three tiers
  const fz = zc + 0.25;
  steps(gp, 0, y0, fz + 0.06, 0.08, 0.075, 0.06, shade(C.earth, 1.05), 6);
  steps(gp, 0, y0 + 0.075, fz - 0.06 + 0.012 + 0.016, 0.07, 0.065, 0.045, shade(C.earth, 1.05), 5);
  steps(gp, 0, y0 + 0.14, fz - 0.12 + 0.024 + 0.022, 0.06, 0.055, 0.04, shade(C.earth, 1.05), 5);
  // que towers
  for (const sx of [-1, 1]) que(gp, sx * 0.29, y0, 0.31, sx, tile);
  for (const sx of [-1, 1]) guard(gp, sx * 0.1, y0, 0.36, 0.1, C.black);
  banner(gp, -0.42, y0, 0.04, 0.3, '#1f1f22', 0.09);
  banner(gp, 0.42, y0, 0.04, 0.3, '#1f1f22', 0.09);
};

/** Tang pavilion on a stepped 三出阙-style pier: returns nothing. sx = side (outer steps go outwards). */
function tangQue(p: THREE.Object3D, x: number, y: number, z: number, sx: number, tile: string, base: string): void {
  const h = 0.14;
  tbox(p, 0.12, 0.12, 0.11, 0.11, h, base, x, y, z);
  rail(p, x, y + h, z, 0.11, 0.11, C.marble, 0, 0.014);
  const et = body(p, x, y + h, z, 0.075, 0.075, 0.045, { wall: C.plaster, col: C.vermilion, bracket: '#6a5038', sp: 0.025, cr: 0.004 });
  const mid = roof(p, x, et - 0.012, z, 0.115, 0.115, 0.022, { tile, inner: [0.06, 0.06], k: 0.3, lift: 0.4 });
  const et2 = body(p, x, mid - 0.004, z, 0.058, 0.058, 0.03, { wall: C.plaster, col: C.vermilion, sp: 0.03, cr: 0.0035 });
  roof(p, x, et2, z, 0.105, 0.105, 0.05, { tile, k: 0.32, lift: 0.4, chi: '#4a4e55', chiH: 0.016, ridge: shade(tile, 0.75) });
  for (let i = 1; i <= 2; i++) {
    const xx = x + sx * (0.06 + i * 0.03), hh = h - i * 0.03, dd = 0.1 - i * 0.012;
    tbox(p, 0.035, dd, 0.03, dd - 0.01, hh, base, xx, y, z + i * 0.004);
    roof(p, xx, y + hh, z + i * 0.004, 0.05, dd + 0.02, 0.016, { tile, k: 0.3, lift: 0.3, ridge: null });
  }
}

/**
 * 大明宫含元殿 after the 傅熹年 / 杨鸿勋 reconstructions: the double-eaved hall on a high red-plastered brick platform with
 * white balustrades, three long dragon-tail ramps (龙尾道), and the 翔鸾阁 / 栖凤阁 pavilions on stepped que piers joined by
 * corridors — a broad U opening forward. Grey tile roofs with deep, gently curved eaves and owl-tail ridge ends.
 * Refs: https://commons.wikimedia.org/wiki/File:Reconstruction_Model_of_Hanyuan_Hall_of_Daming_Palace.jpg ,
 * https://commons.wikimedia.org/wiki/File:陕历博含元殿.jpg ,
 * https://commons.wikimedia.org/wiki/File:Daming_Palace_National_Heritage_Park_-_Palace_Model_01.jpg
 */
const cap_tang: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.84, C.paving, '#8f8676');
  const tile = '#5a5e66', base = '#b25a48', zc = -0.18;
  // two-tier platform
  const y1 = y0 + 0.085;
  tbox(gp, 0.66, 0.3, 0.64, 0.29, 0.085, base, 0, y0, zc);
  box(gp, '#c9c2b2', 0, y1 - 0.004, zc, 0.65, 0.006, 0.295);
  rail(gp, 0, y1, zc, 0.62, 0.27, C.marble, 0.2);
  const y2 = y1 + 0.035;
  tbox(gp, 0.52, 0.22, 0.51, 0.215, 0.035, base, 0, y1, zc - 0.015);
  rail(gp, 0, y2, zc - 0.015, 0.5, 0.21, C.marble, 0.08);
  steps(gp, 0, y1, zc - 0.015 + 0.13, 0.07, 0.035, 0.025, '#b9b4a8', 4);
  // the hall: inner body with a surrounding 副阶 skirt (double eaves)
  const hz = zc - 0.03;
  const et = body(gp, 0, y2, hz, 0.4, 0.15, 0.115, { wall: C.plaster, col: C.vermilion, bracket: '#6a5038', beam: C.vermilion, sp: 0.036, cr: 0.0055 });
  for (let i = -4; i <= 4; i++) box(gp, i % 2 ? '#3f6f5a' : C.vermilion, i * 0.04, y2, hz + 0.075, 0.03, 0.06, 0.004);
  const outer = body(gp, 0, y2, hz, 0.46, 0.19, 0.055, { wall: C.plaster, col: C.vermilion, sp: 0.038, cr: 0.0048, back: true });
  void outer;
  roof(gp, 0, y2 + 0.06, hz, 0.56, 0.29, 0.02, { tile, inner: [0.4, 0.15], k: 0.2, lift: 0.22 });
  roof(gp, 0, et, hz, 0.54, 0.28, 0.115, { tile, k: 0.32, lift: 0.22, chi: '#43474e', chiH: 0.034, ridge: shade(tile, 0.72) });
  // 龙尾道: three long ramps with a landing
  for (const x of [-0.1, 0, 0.1]) {
    const w = x ? 0.035 : 0.05;
    ramp(gp, x, y0, 0.38, w, 0.04, 0.12, '#b9b4a8');
    box(gp, '#b9b4a8', x, y0, 0.2, w, 0.04, 0.12);
    ramp(gp, x, y0 + 0.04, 0.14, w, 0.045, 0.09, '#b9b4a8');
    for (const s of [-1, 1]) box(gp, C.marble, x + (s * w) / 2, y0 + 0.04, 0.2, 0.004, 0.012, 0.12);
  }
  // 翔鸾阁 and 栖凤阁 with their corridors
  for (const sx of [-1, 1]) {
    const qx = sx * 0.34, qz = 0.13;
    tangQue(gp, qx, y0, qz, sx, tile, base);
    tbox(gp, 0.04, 0.2, 0.036, 0.2, 0.06, base, qx, y0, zc + 0.15 + 0.035);
    corridor(gp, qx, zc + 0.08, qx, qz - 0.06, y0 + 0.06, 0.035, 0.04, tile, C.vermilion, { wall: C.plaster });
    corridor(gp, sx * 0.25, zc + 0.08, qx + sx * 0.02, zc + 0.08, y0 + 0.085, 0.035, 0.04, tile, C.vermilion, { wall: C.plaster });
  }
  for (const sx of [-1, 1]) guard(gp, sx * 0.2, y0, 0.36, 0.1, '#8a2a22');
  tree(gp, -0.17, y0, 0.31, 0.07, '#6f8a42');
  tree(gp, 0.18, y0, 0.31, 0.07, '#6f8a42');
};

/** A red-crowned crane, standing (wings folded) or flying; faces +x when ry = 0. */
function crane(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, fly = false): void {
  const c = grp(p, x, z, ry, y);
  ellip(c, '#f4f2ec', 0, s * 0.55, 0, s * 0.32, s * 0.2, s * 0.17);
  ellip(c, '#1e1c1c', -s * 0.3, s * 0.52, 0, s * 0.16, s * 0.1, s * 0.12);
  rod(c, [s * 0.22, s * 0.6, 0], [s * (fly ? 0.62 : 0.32), s * (fly ? 0.62 : 1.05), 0], s * 0.045, '#f4f2ec', 4);
  ellip(c, '#c81e1e', s * (fly ? 0.66 : 0.34), s * (fly ? 0.64 : 1.09), 0, s * 0.06);
  if (fly) {
    for (const sz of [-1, 1]) {
      const wing = slab(grp(c, 0, 0, 0, s * 0.6), [[-0.1 * s, 0], [0.18 * s, 0], [0.05 * s, 0.75 * s], [-0.22 * s, 0.7 * s]], s * 0.03, '#f4f2ec', 0, false);
      wing.rotation.x = sz * (Math.PI / 2 - 0.25);
    }
  } else for (const sz of [-1, 1]) rod(c, [0, s * 0.4, sz * s * 0.06], [0, 0, sz * s * 0.06], s * 0.025, '#2a2420', 3);
}

/**
 * 北宋东京宣德门 as painted in Huizong's 《瑞鹤图》 and described in 《东京梦华录》: a U-shaped (凹) gate platform pierced by five
 * doorways, the main gate tower with a green-glazed hip roof and elegant upswept eaves, side towers (朵楼), corridors
 * forward to the corner que towers, and cranes on the owl-tail ridge ends.
 * Refs: https://commons.wikimedia.org/wiki/File:瑞鹤图（亮版）.jpg ,
 * https://commons.wikimedia.org/wiki/File:Bianjing_city_gate.JPG (清明上河图 gate), https://zh.wikipedia.org/wiki/宣德門
 */
const cap_song: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.84, C.paving, '#8f8676');
  const tile = C.green, wall = '#c9bba0', foot = '#9a8e78', bh = 0.13;
  // 凹-shaped platform: main block and two forward wings
  const mz = -0.17, md = 0.2;
  tbox(gp, 0.86, md + 0.01, 0.84, md, bh, wall, 0, y0, mz);
  box(gp, foot, 0, y0, mz + 0.002, 0.865, 0.016, md + 0.014);
  for (const sx of [-1, 1]) {
    tbox(gp, 0.17, 0.33, 0.16, 0.32, bh, wall, sx * 0.345, y0, mz + md / 2 + 0.15);
    box(gp, foot, sx * 0.345, y0, mz + md / 2 + 0.15, 0.175, 0.016, 0.335);
  }
  // five doorways with red doors (trapezoidal Song openings)
  const fz = mz + md / 2;
  for (const x of [-0.18, -0.09, 0, 0.09, 0.18]) {
    const w = x ? 0.042 : 0.05, h = x ? 0.07 : 0.08;
    slab(grp(gp, x, fz + 0.004, 0, y0), [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.78], [w * 0.28, h], [-w * 0.28, h], [-w / 2, h * 0.78]], 0.008, '#3a2a22', 0, false);
    for (const s of [-1, 1]) box(gp, '#9a2e26', x + (s * w) / 4.4, y0, fz + 0.007, w * 0.42, h * 0.74, 0.004);
  }
  const yt = y0 + bh;
  rail(gp, 0, yt, mz, 0.84, md, '#a3302a', 0, 0.016, [false, true, true, true]);
  for (const sx of [-1, 1]) rail(gp, sx * 0.345, yt, mz + md / 2 + 0.15, 0.16, 0.32, '#a3302a', 0, 0.016, [true, sx < 0, false, sx > 0]);
  // the main gate tower (门楼)
  const et = body(gp, 0, yt, mz, 0.42, 0.13, 0.075, { wall: '#b8463a', col: C.vermilion, beam: C.vermilion, bracket: '#5e7a63', sp: 0.042, cr: 0.0055, door: '#7a2a22', doorN: 7 });
  roof(gp, 0, et, mz, 0.54, 0.25, 0.11, { tile, k: 0.5, lift: 0.6, chi: '#2f6e4e', chiH: 0.036, ridge: shade(tile, 0.75) });
  const rl = 0.54 - 0.25 + 0.008, ryTop = et + 0.11 + 0.0055;
  for (const sx of [-1, 1]) crane(gp, sx * (rl / 2 + 0.002), ryTop + 0.026, mz, 0.045, sx > 0 ? Math.PI : 0);
  // 朵楼 at both ends, corridors forward along the wings, and the corner que towers
  for (const sx of [-1, 1]) {
    const ox = sx * 0.345;
    const e2 = body(gp, ox, yt, mz, 0.11, 0.11, 0.05, { wall: '#b8463a', col: C.vermilion, bracket: '#5e7a63', sp: 0.036, cr: 0.0045 });
    roof(gp, ox, e2, mz, 0.17, 0.16, 0.075, { tile, k: 0.45, lift: 0.6, xie: 0.55, ridge: shade(tile, 0.75) });
    corridor(gp, ox, mz + 0.08, ox, 0.18, yt, 0.04, 0.05, tile, C.vermilion, { wall: '#b8463a' });
    const qz = 0.22;
    const e3 = body(gp, ox, yt, qz, 0.1, 0.1, 0.05, { wall: '#b8463a', col: C.vermilion, bracket: '#5e7a63', sp: 0.033, cr: 0.0045 });
    const m = roof(gp, ox, e3 - 0.004, qz, 0.15, 0.15, 0.02, { tile, inner: [0.07, 0.07], k: 0.4, lift: 0.6 });
    const e4 = body(gp, ox, m, qz, 0.07, 0.07, 0.035, { wall: '#b8463a', col: C.vermilion, sp: 0.035, cr: 0.0038 });
    roof(gp, ox, e4, qz, 0.13, 0.13, 0.06, { tile, k: 0.45, lift: 0.6, ridge: shade(tile, 0.75), chi: '#2f6e4e', chiH: 0.018 });
  }
  for (const sx of [-1, 1]) guard(gp, sx * 0.07, y0, 0.12, 0.1, '#8a2a22');
};

/** Mongol ger / ordo tent: white felt walls and dome, a gilt crown and a coloured door. */
function ger(p: THREE.Object3D, x: number, y: number, z: number, r: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y);
  lathe(g0, [[0, 0], [r, 0], [r, r * 0.55], [r * 0.98, r * 0.6], [0, r * 0.6]], '#efe9dc', 0, 0, 0, 16);
  lathe(g0, [[r * 1.02, r * 0.58], [r * 0.7, r * 0.82], [r * 0.3, r * 0.98], [0, r * 1.02]], '#f4efe4', 0, 0, 0, 16);
  for (const yy of [0.18, 0.42]) lathe(g0, [[r * 1.005, r * yy], [r * 1.005, r * (yy + 0.05)]], '#3b5f9a', 0, 0, 0, 16);
  lathe(g0, [[r * 0.99, r * 0.54], [r * 1.0, r * 0.6]], C.gold, 0, 0, 0, 16);
  lathe(g0, [[0, r * 0.98], [r * 0.28, r * 0.98], [r * 0.2, r * 1.12], [0, r * 1.18]], C.gold, 0, 0, 0, 10);
  ellip(g0, C.gold, 0, r * 1.26, 0, r * 0.1);
  box(g0, '#a8352a', 0, 0, r * 0.97, r * 0.42, r * 0.46, 0.006);
  box(g0, C.gold, 0, r * 0.46, r * 0.98, r * 0.5, r * 0.05, 0.006);
}

/** Sülde: the Mongol spirit banner — a spear with a ring of white horsehair tassels. */
function sulde(p: THREE.Object3D, x: number, y: number, z: number, h: number): void {
  rod(p, [x, y, z], [x, y + h, z], 0.004, C.darkwood, 5);
  lathe(p, [[0, 0], [0.018, 0.004], [0.02, 0.03], [0.006, 0.05], [0, 0.05]], '#f2efe8', x, y + h - 0.06, z, 10);
  cone(p, C.gold, x, y + h - 0.012, z, 0.006, 0.04, 5);
  ellip(p, C.gold, x, y + h - 0.012, z, 0.008, 0.004, 0.008);
}

/**
 * 元大都大明殿: a 工字殿 (the double-eaved front hall and the rear hall joined by a pillared corridor) on a 工-shaped white
 * marble terrace, roofed in blue-green glaze with yellow edging, white walls and red columns; beside it a gold-crowned
 * white ordo tent (斡耳朵) and Mongol standards.
 * Refs: https://baike.baidu.com/item/大明殿/2483938 (陶宗仪《南村辍耕录·宫阙制度》 description), 朱偰《元大都宫殿图考》
 * (https://commons.wikimedia.org/wiki/File:CADAL07014111_元大都宮殿圖考.djvu)
 */
const cap_yuan: Builder = gp => {
  const y0 = plinth(gp, 0.9, 0.86, '#bdb6a6', '#8a8374');
  const tile = C.blue, edge = '#d6a840', m = C.marble, mshade = shade(C.marble, 0.92);
  // 工-shaped two-tier marble terrace
  const fz = 0.08, fd = 0.3, bz = -0.29, bd = 0.2;
  const t1 = 0.045, t2 = 0.04;
  rbox(gp, m, 0, y0, fz, 0.74, t1, fd, 0.004);
  rbox(gp, m, 0, y0, bz, 0.52, t1, bd, 0.004);
  rbox(gp, m, 0, y0, (fz - fd / 2 + bz + bd / 2) / 2, 0.2, t1, fz - fd / 2 - (bz + bd / 2) + 0.02, 0.004);
  const y1 = y0 + t1;
  rail(gp, 0, y1, fz, 0.72, fd - 0.02, m, 0.12, 0.016, [true, true, false, true]);
  rbox(gp, mshade, 0, y1, fz - 0.015, 0.62, t2, 0.23, 0.004);
  rbox(gp, mshade, 0, y1, bz, 0.44, t2, 0.16, 0.004);
  rbox(gp, mshade, 0, y1, (fz - 0.13 + bz + 0.08) / 2, 0.14, t2, fz - 0.13 - (bz + 0.08) + 0.02, 0.004);
  const y2 = y1 + t2;
  rail(gp, 0, y2, fz - 0.015, 0.6, 0.21, m, 0.1, 0.016, [true, true, false, true]);
  steps(gp, 0, y0, fz + fd / 2 + 0.06, 0.1, t1, 0.06, m, 4);
  steps(gp, 0, y1, fz - 0.015 + 0.115 + 0.04, 0.08, t2, 0.04, mshade, 4);
  for (const sx of [-1, 1]) steps(gp, sx * 0.24, y0, fz + fd / 2 + 0.04, 0.05, t1, 0.04, m, 3);
  // 大明殿 (front hall), double-eaved
  const hz = fz - 0.03;
  const et = body(gp, 0, y2, hz, 0.4, 0.14, 0.11, { wall: '#efe9dc', col: C.vermilion, beam: '#2f5f8a', bracket: '#3f6a7a', sp: 0.04, cr: 0.0058, door: '#a8352a', doorN: 5 });
  body(gp, 0, y2, hz, 0.46, 0.18, 0.055, { wall: '#efe9dc', col: C.vermilion, sp: 0.04, cr: 0.0048 });
  roof(gp, 0, y2 + 0.06, hz, 0.55, 0.27, 0.022, { tile, edge, inner: [0.4, 0.14], k: 0.3, lift: 0.4 });
  roof(gp, 0, et, hz, 0.52, 0.26, 0.11, { tile, edge, k: 0.38, lift: 0.4, ridge: edge, chi: edge, chiH: 0.03 });
  // pillared corridor (柱廊) and rear hall (寝殿)
  const cz0 = hz - 0.09, cz1 = bz + 0.07;
  corridor(gp, 0, cz0, 0, cz1, y2, 0.06, 0.07, tile, C.vermilion, { wall: '#efe9dc', rh: 0.035 });
  const e2 = body(gp, 0, y2, bz, 0.34, 0.12, 0.075, { wall: '#efe9dc', col: C.vermilion, beam: '#2f5f8a', bracket: '#3f6a7a', sp: 0.04, cr: 0.005 });
  roof(gp, 0, e2, bz, 0.44, 0.21, 0.09, { tile, edge, k: 0.38, lift: 0.4, ridge: edge, chi: edge, chiH: 0.022 });
  // the ordo tent, sülde standards and banners
  ger(gp, -0.35, y0, 0.33, 0.065, 0.4);
  sulde(gp, 0.35, y0, 0.33, 0.24);
  sulde(gp, 0.41, y0, 0.25, 0.2);
  banner(gp, -0.42, y0, -0.06, 0.32, '#f0ece2', 0.09);
  banner(gp, 0.42, y0, -0.1, 0.32, '#2f4f8a', 0.09);
  for (const sx of [-1, 1]) guard(gp, sx * 0.1, y0, 0.4, 0.1, '#2f4f8a', 'spear');
};

export const H_CAPITALS: Record<string, Builder> = { cap_erlitou, cap_zhou, cap_qinhan, cap_tang, cap_song, cap_yuan };
