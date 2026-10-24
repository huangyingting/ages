import * as THREE from 'three';
import { type Builder, type V3, type Paint, add, mat, box, cyl, cone, ball, lathe, rod, strut, skin, slab, gable, tbox, panel, archPath, shade, mix, hash3, fbm, paintFaces, plinth, tree } from '../prims.ts';
import { grp } from '../timber.ts';
import { human, type HumanOpts, type HumanRig } from '../human.ts';

// Site-specific hero models, pack "sites-b" (one model ↔ one subject): Jiayuguan, Shanhaiguan, the Canton Thirteen
// Factories, the Yuanmingyuan Dashuifa, the Wuchang Red House (1911), the Nanchang Jiangxi Grand Hotel (1927), the
// Shenzhen fishing village of 1979 and the Lop Nur 596 test tower (1964). Front faces +z, base at y=0, footprint within
// ±0.45 on a round ground disc, overall height ~0.3–0.5; vertical scale is mildly exaggerated so they read at 45° tilt.
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

const C = {
  gobi: '#b49c72', earth: '#c4a46c', earthDk: '#a98a58', brick: '#7d7f7f', brickLt: '#9a9b98', tile: '#55595c',
  vermilion: '#9c3a2e', timber: '#7a3a2c', green: '#3f6f5c', plaster: '#d9d0bd', stone: '#b9b2a2', marble: '#e2ddd0',
  water: '#4f6f78', sea: '#46676f', river: '#6b7a62', mud: '#7c6c52', grass: '#7c8752', redBrick: '#8e4535', white: '#e6e2d8',
  red: '#a8322c', blue: '#2a3a66', gold: '#c9a04a', skin: '#c99a76', black: '#2b2b2e', olive: '#5d6440', steel: '#5e6266',
};

// ---- shared kit ------------------------------------------------------------------------------------------------

/** The shared museum plinth (dark walnut side) with a finely painted site top; returns the top height. */
function ground(p: THREE.Object3D, top: string, _side: string, paint?: Paint, R = 0.46, h = 0.035): number {
  plinth(p, top, { R, h });
  if (!paint) return h + 0.0015;
  const geo = new THREE.RingGeometry(0.002, R * 0.965, 120, 30);
  geo.rotateX(-Math.PI / 2);
  add(p, paintFaces(geo, top, paint), mat('#ffffff', { vc: true, rough: 0.92 }), 0, h + 0.0018, 0, 1, 1, 1);
  return h + 0.0018;
}

/** Subdivided box with per-face paint (paint receives box-local coordinates, y from 0 at the bottom). */
function pbox(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, paint: Paint, seg: [number, number, number] = [4, 4, 4], ry = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(sx, sy, sz, ...seg);
  geo.translate(0, sy / 2, 0);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1, ry);
}

/** Group whose local +z runs from a to b (plan points [x, z]); returns the group and the segment length. */
function along(p: THREE.Object3D, a: [number, number], b: [number, number], y = 0): [THREE.Group, number] {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  return [grp(p, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(dx, dz), y), Math.hypot(dx, dz)];
}

interface WallO { h: number; d0: number; d1: number; c: string; top?: string; bands?: number; ext?: number; merlon?: string | null; parapet?: string | null; ms?: number }
/**
 * Battered city wall between plan points a→b: stacked trapezoid courses (alternate shade = rammed-earth lifts or brick
 * courses), a walkway top, battlements (垛口) on the outer side (+x local = LEFT of a→b) and a low parapet (女墙) inside.
 */
function wall(p: THREE.Object3D, a: [number, number], b: [number, number], y: number, o: WallO): void {
  const [q, L0] = along(p, a, b, y), ext = o.ext ?? o.d0 * 0.5, L = L0 + ext * 2, n = o.bands ?? 3;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, w0 = o.d0 + (o.d1 - o.d0) * t0, w1 = o.d0 + (o.d1 - o.d0) * t1;
    slab(q, [[-w0 / 2, o.h * t0], [w0 / 2, o.h * t0], [w1 / 2, o.h * t1], [-w1 / 2, o.h * t1]], L, i % 2 ? shade(o.c, 0.93) : o.c, 0, false);
  }
  box(q, o.top ?? shade(o.c, 1.08), 0, o.h - 0.0006, 0, o.d1 * 0.94, 0.0012, L);
  const ms = o.ms ?? 0.007, mc = o.merlon === undefined ? shade(o.c, 0.96) : o.merlon;
  if (mc) {
    box(q, mc, o.d1 / 2 - ms * 0.3, o.h, 0, ms * 0.6, ms * 0.45, L);
    const k = Math.max(1, Math.round(L / (ms * 1.9)));
    for (let i = 0; i < k; i++) box(q, mc, o.d1 / 2 - ms * 0.3, o.h + ms * 0.45, -L / 2 + (i + 0.5) * (L / k), ms * 0.6, ms * 0.55, ms);
  }
  const pc = o.parapet === undefined ? shade(o.c, 0.9) : o.parapet;
  if (pc) box(q, pc, -o.d1 / 2 + ms * 0.22, o.h, 0, ms * 0.44, ms * 0.5, L);
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
  tile: string; k?: number; lift?: number; rib?: string | null; under?: string; fascia?: string; edge?: string;
  /** skirt (腰檐) mode: stop where the slope meets a wall of this [w, d]; h is then the rise to that wall. */
  inner?: [number, number];
  /** half-hip (歇山): stop the hip at this fraction and finish with a gable. */
  xie?: number;
  ridge?: string | null; th?: number; gableC?: string;
}
/** Concave Chinese hip / half-hip / skirt roof over eaves w×d with upswept corners (after capitals.ts). */
function roof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: RoofO): number {
  const hx0 = w / 2, hz0 = d / 2, rz = Math.min(0.004, hz0 * 0.04), ins = hz0 - rz;
  const k = o.k ?? 0.35, lift = o.lift ?? 0, th = o.th ?? 0.005;
  const f = (t: number) => t * (1 - k) + k * t * t;
  let tTop = 1;
  if (o.inner) tTop = clamp((hz0 - o.inner[1] / 2) / ins, 0.05, 1);
  else if (o.xie) tTop = o.xie;
  const H = o.inner ? h / f(tTop) : h;
  const T = [0, 0.1, 0.22, 0.37, 0.55, 0.76, 1].map(t => t * tTop);
  const Lz = Math.min(hz0, hx0) * 0.95, sp = 0.0105;
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
  const tile = o.tile, rib = o.rib === undefined ? shade(tile, 1.14) : o.rib, fascia = o.fascia ?? shade(tile, 0.68), under = o.under ?? shade(tile, 0.55);
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, a = R[i][j], b = R[i][j1], c = R[i + 1][j1], e = R[i + 1][j];
    const col = i === 0 ? fascia : i === 1 && o.edge ? o.edge : rib && j % 2 ? rib : tile;
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
    for (const sx of [-1, 1]) slab(grp(p, x + sx * (gw / 2 - 0.002), z, Math.PI / 2, top), [[-gd * 0.42, 0.002], [gd * 0.42, 0.002], [0, gh * 0.84]], 0.004, o.gableC ?? shade(tile, 0.75), 0, false);
    top += gh;
    if (ridge) {
      box(p, ridge, x, top - 0.005, z, gw + 0.008, 0.008, 0.008);
      for (const sx of [-1, 1]) box(p, ridge, x + sx * (gw / 2 + 0.002), top - 0.004, z, 0.004, 0.01, 0.006);
    }
    return top + 0.003;
  }
  const rl = Math.max(0.02, w - d + 2 * rz);
  if (ridge) {
    box(p, ridge, x, top - 0.0045, z, rl + 0.01, 0.009, 0.01);
    top += 0.0045;
  }
  return top;
}

interface LouO { wall: string; col: string; tile: string; door?: string; ov?: number; sh?: number; rh?: number; lift?: number; gableC?: string; front?: (q: THREE.Object3D, i: number, w: number, d: number, y: number, h: number) => void }
/**
 * Multi-storey timber gate tower (楼): storeys of height hs shrink by `sh` per floor (equal margins so the skirt eaves
 * fit), columns and lattice doors on the long faces, skirt eaves between floors and a half-hip (歇山) top roof.
 */
function lou(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, hs: number[], o: LouO): number {
  const sh = o.sh ?? 0.008, ov = o.ov ?? 0.014;
  let yy = y;
  for (let i = 0; i < hs.length; i++) {
    const ww = w - i * sh, dd = d - i * sh, h = hs[i];
    box(p, o.wall, x, yy, z, ww, h, dd);
    const n = Math.max(3, Math.round(ww / 0.013));
    for (let k = 0; k <= n; k++) for (const sz of [-1, 1]) box(p, o.col, x - ww / 2 + (k * ww) / n, yy, z + sz * (dd / 2 + 0.0008), 0.0024, h, 0.0018);
    for (const sx of [-1, 1]) box(p, o.col, x + sx * (ww / 2 + 0.0008), yy, z, 0.0018, h, 0.0024);
    for (const sz of [-1, 1]) box(p, o.door ?? shade(o.wall, 0.62), x, yy + h * 0.08, z + sz * (dd / 2 + 0.0004), ww * 0.62, h * 0.66, 0.0012);
    box(p, o.col, x, yy + h - 0.0035, z, ww + 0.003, 0.0035, dd + 0.003);
    if (o.front) o.front(p, i, ww, dd, yy, h);
    yy += h;
    const W = ww + 2 * ov, D = dd + 2 * ov;
    if (i < hs.length - 1) roof(p, x, yy - 0.004, z, W, D, ov * 0.42, { tile: o.tile, inner: [ww - sh, dd - sh], lift: o.lift ?? 1, k: 0.3 });
    else return roof(p, x, yy - 0.003, z, W, D, o.rh ?? d * 0.42, { tile: o.tile, xie: 0.48, lift: o.lift ?? 1.2, k: 0.38, gableC: o.gableC });
  }
  return yy;
}

// ---- flags -----------------------------------------------------------------------------------------------------

type FlagFn = (u: number, v: number) => string;
/** Pole with a cloth hanging from its top towards local +x (u 0→1 hoist→fly, v 0→1 top→bottom), in a 'flap' group. */
function flag(p: THREE.Object3D, x: number, y: number, z: number, ph: number, w: number, h: number, fn: FlagFn, ry = 0, nu = 14, nv = 9, pole = '#4a3f33', pr = 0.0011): void {
  cyl(p, pole, x, y, z, pr, ph, 5);
  ball(p, shade(pole, 1.4), x, y + ph + 0.001, z, pr * 2.6);
  const q = grp(p, x, z, ry, y + ph - 0.0015);
  q.name = 'flap';
  q.userData = { phase: x * 40 + z * 17, amp: 0.1 };
  const M = tris();
  const P = (u: number, v: number, dz: number): V3 => [u * w + pr, -v * h, Math.sin(u * 4.2 + v * 0.8) * w * 0.07 * u + dz];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv, col = fn((i + 0.5) / nu, (j + 0.5) / nv);
    for (const dz of [0.0002, -0.0002]) {
      const a = P(u0, v0, dz), b = P(u1, v0, dz), c = P(u1, v1, dz), d = P(u0, v1, dz);
      if (dz > 0) { M.t(a, d, c, col); M.t(a, c, b, col); } else { M.t(a, c, d, col); M.t(a, b, c, col); }
    }
  }
  polyMesh(q, M.pos, M.col);
}

const FL: Record<string, FlagFn> = {
  dk: (u, v) => ((u > 0.31 && u < 0.41) || (v > 0.43 && v < 0.57) ? '#e8e4dc' : '#a8323a'),
  se: (u, v) => ((u > 0.31 && u < 0.41) || (v > 0.42 && v < 0.58) ? '#d8b23e' : '#2f5c92'),
  nl: (_u, v) => (v < 1 / 3 ? '#a8323a' : v < 2 / 3 ? '#e8e4dc' : '#2a4078'),
  es: (_u, v) => (v < 0.25 || v > 0.75 ? '#a8323a' : '#d8b23e'),
  us: (u, v) => {
    if (u < 0.42 && v < 7 / 13) return Math.floor(u * 28) % 2 && Math.floor(v * 26) % 2 ? '#e8e4dc' : '#2a3a6a';
    return Math.floor(v * 13) % 2 ? '#e8e4dc' : '#a8323a';
  },
  gb: (u, v) => {
    const X = u * 2 - 1, Y = v - 0.5, ax = Math.abs(X), ay = Math.abs(Y);
    if (ax < 0.1 || ay < 0.1) return '#b3283a';
    if (ax < 0.167 || ay < 0.167) return '#e8e4dc';
    const dd = Math.min(Math.abs(Y - X / 2), Math.abs(Y + X / 2)) / 1.118;
    return dd < 0.035 ? '#b3283a' : dd < 0.1 ? '#e8e4dc' : '#24305e';
  },
  /** 鐵血十八星旗: red field, black nine-angled star, 18 yellow dots (9 in the tips, 9 in the inner angles). */
  xh: (u, v) => {
    const X = (u - 0.5) * 1.5, Y = 0.5 - v, r = Math.hypot(X, Y), a = Math.atan2(Y, X) - Math.PI / 2, seg = TAU / 9;
    const t = ((((a / seg) % 1) + 1) % 1), tip = Math.abs(t - 0.5) * 2;
    for (let i = 0; i < 9; i++) {
      const at = Math.PI / 2 + i * seg, ai = at + seg / 2;
      if (Math.hypot(X - Math.cos(at) * 0.3, Y - Math.sin(at) * 0.3) < 0.05 || Math.hypot(X - Math.cos(ai) * 0.15, Y - Math.sin(ai) * 0.15) < 0.045) return '#d9b437';
    }
    return r < 0.22 + (1 - tip) * 0.2 ? '#1f1d1f' : '#b02a2a';
  },
  /** plain Qing / unit banners */
  red: () => '#a8322c', yel: () => '#c9a43e', blk: () => '#2b2b2e',
};

// ---- people ----------------------------------------------------------------------------------------------------

function localOf(rig: HumanRig, v: V3): THREE.Vector3 {
  rig.group.updateMatrix();
  return new THREE.Vector3(...v).applyMatrix4(rig.group.matrix.clone().invert());
}
/** Cloth band round the upper arm (left by default), in the figure's unit space. */
function armband(rig: HumanRig, c = '#ecebe4', left = true): void {
  const hl = localOf(rig, left ? rig.handL : rig.handR), sx = Math.sign(hl.x) || 1;
  const pt = new THREE.Vector3(sx * 0.1, 0.79, 0).lerp(hl, 0.3);
  ball(rig.group, c, pt.x, pt.y, pt.z, 0.075, 0.05, 0.075);
}
/** Neckerchief knotted at the throat. */
function kerchief(rig: HumanRig, c = '#b0302a'): void {
  ball(rig.group, c, 0, 0.815, 0.025, 0.13, 0.045, 0.09);
  ball(rig.group, c, 0, 0.775, 0.058, 0.045, 0.07, 0.02);
}
/** Rifle from butt a to muzzle b (parent space), wooden stock and dark barrel. */
function gun(p: THREE.Object3D, a: V3, b: V3, h: number, bayonet = false): void {
  const r = Math.max(0.00045, h * 0.016), m: V3 = [a[0] + (b[0] - a[0]) * 0.62, a[1] + (b[1] - a[1]) * 0.62, a[2] + (b[2] - a[2]) * 0.62];
  rod(p, a, m, r * 1.3, '#5a3f28', 4);
  rod(p, m, b, r * 0.8, '#2e2f31', 4);
  if (bayonet) rod(p, b, [b[0] + (b[0] - a[0]) * 0.2, b[1] + (b[1] - a[1]) * 0.2, b[2] + (b[2] - a[2]) * 0.2], r * 0.5, '#b8bcbf', 3);
}
type GunMode = 'order' | 'raise' | 'port' | 'aim' | null;
interface SoldierO extends Partial<HumanOpts> { gunMode?: GunMode; band?: string; scarf?: string; bayonet?: boolean }
/** Figure with an optional rifle (order arms / raised / across the chest / aimed), armband and neckerchief. */
function trooper(p: THREE.Object3D, x: number, y: number, z: number, h: number, ry: number, o: SoldierO): HumanRig {
  const mode = o.gunMode === undefined ? 'order' : o.gunMode;
  const pose = o.pose ?? (mode === 'raise' ? 'cheer' : mode === 'aim' ? 'photo' : mode === 'port' ? 'carry' : 'stand');
  const rig = human(p, x, y, z, { top: '#4a5560', ...o, h, ry, pose });
  const R = rig.handR, L = rig.handL, sx = Math.sin(ry), cz = Math.cos(ry);
  if (mode === 'order') gun(p, [R[0], y + h * 0.01, R[2] + cz * h * 0.03], [R[0] + sx * h * 0.02, y + h * 0.82, R[2] + cz * h * 0.05], h, o.bayonet);
  else if (mode === 'raise') gun(p, [R[0], R[1] - h * 0.25, R[2]], [R[0] + sx * h * 0.05, R[1] + h * 0.5, R[2] + cz * h * 0.05], h, o.bayonet);
  else if (mode === 'port') gun(p, [R[0] - (L[0] - R[0]) * 0.6, R[1] - h * 0.12, R[2] - (L[2] - R[2]) * 0.6], [L[0] + (L[0] - R[0]) * 1.2, L[1] + h * 0.35, L[2] + (L[2] - R[2]) * 1.2], h, o.bayonet);
  else if (mode === 'aim') gun(p, [rig.head[0] - sx * h * 0.06, rig.head[1] - h * 0.1, rig.head[2] - cz * h * 0.06], [rig.head[0] + sx * h * 0.55, rig.head[1] - h * 0.06, rig.head[2] + cz * h * 0.55], h, o.bayonet);
  if (o.band) armband(rig, o.band);
  if (o.scarf) kerchief(rig, o.scarf);
  return rig;
}

// ---- animals, boats, lettering, terrain --------------------------------------------------------------------------

/** Bactrian camel (two humps) facing local +z, body length ~s; optional pack load between the humps. */
function camel(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number, c = '#a07a4c', load?: string): void {
  const q = grp(p, x, z, ry, y), lh = 0.62 * s, cd = shade(c, 0.85);
  ball(q, c, 0, lh + 0.14 * s, 0, 0.36 * s, 0.34 * s, 0.82 * s);
  for (const hz of [-0.17, 0.15]) ball(q, cd, 0, lh + 0.33 * s, hz * s, 0.22 * s, 0.26 * s, 0.22 * s);
  if (load) { box(q, load, 0, lh + 0.2 * s, -0.01 * s, 0.46 * s, 0.16 * s, 0.14 * s); ball(q, shade(load, 0.85), 0, lh + 0.32 * s, -0.01 * s, 0.2 * s, 0.12 * s, 0.12 * s); }
  for (const lx of [-0.11, 0.11]) for (const lz of [-0.28, 0.27]) strut(q, [lx * s, lh + 0.08 * s, lz * s], [lx * s * 1.05, 0, lz * s + 0.02 * s], 0.055 * s, 0.032 * s, c, 5);
  strut(q, [0, lh + 0.18 * s, 0.34 * s], [0, lh + 0.06 * s, 0.56 * s], 0.09 * s, 0.065 * s, c, 6);
  strut(q, [0, lh + 0.06 * s, 0.56 * s], [0, lh + 0.4 * s, 0.68 * s], 0.065 * s, 0.05 * s, cd, 6);
  ball(q, c, 0, lh + 0.42 * s, 0.75 * s, 0.1 * s, 0.1 * s, 0.22 * s);
  for (const ex of [-1, 1]) ball(q, cd, ex * 0.035 * s, lh + 0.48 * s, 0.7 * s, 0.03 * s, 0.05 * s, 0.03 * s);
  strut(q, [0, lh + 0.2 * s, -0.4 * s], [0, lh - 0.05 * s, -0.46 * s], 0.025 * s, 0.015 * s, cd, 4);
}

/** Small hull (sampan / junk body) along local +z; returns the deck height. */
function hull(q: THREE.Object3D, L: number, W: number, H: number, c: string, sheer = 0.25): number {
  const st = [-0.5, -0.36, -0.1, 0.18, 0.4, 0.5];
  const rings: V3[][] = st.map(t => {
    const e = Math.abs(t) * 2, hw = W / 2 * (1 - e ** 3 * 0.85), top = H + H * sheer * e ** 2, bot = H * 0.15 + H * 0.5 * e ** 2;
    return [[-hw, top, t * L], [-hw * 0.55, bot, t * L], [hw * 0.55, bot, t * L], [hw, top, t * L]];
  });
  skin(q, rings, c, { caps: true, flat: true, paint: (_x, y, _z, _nx, ny) => (ny > 0.7 ? shade(c, 1.15) : y < H * 0.45 ? shade(c, 0.7) : null) });
  return H;
}
/** Sampan with a woven mat canopy (乌篷) and a sculler. */
function sampan(p: THREE.Object3D, x: number, y: number, z: number, ry: number, L: number, crew = true): void {
  const q = grp(p, x, z, ry, y), W = L * 0.28, d = hull(q, L, W, L * 0.1, '#6a5136');
  ball(q, '#7d6a48', 0, d, -0.04 * L, W * 0.86, L * 0.2, L * 0.36);
  if (crew) {
    human(q, 0, d, -0.36 * L, { h: L * 0.36, top: '#46505a', bottom: '#2f3338', hat: '#b7a271', hatStyle: 'conical', pose: 'row', detail: 'min' });
    rod(q, [0.02 * L, d + L * 0.2, -0.42 * L], [0.03 * L, y - 0.004, -0.66 * L], 0.0006, '#6b553b', 3);
  }
}

/** Pseudo-hanzi of strokes (horizontal, vertical, sweeping) on a plane facing +z, cell s×s centred at (x, y). */
function glyph(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number, c: string, t = 0.13): void {
  const r = (k: number) => hash3(seed * 7.13, k * 3.7, 1.7);
  const nh = 2 + Math.floor(r(1) * 2), nv = 1 + Math.floor(r(2) * 2), sw = s * t, d = sw * 0.6;
  for (let i = 0; i < nh; i++) {
    const yy = y - s * 0.42 + ((i + 0.5) / nh) * s * 0.84, l = s * (0.45 + r(10 + i) * 0.5), xx = x + (r(20 + i) - 0.5) * (s - l) * 0.9;
    box(p, c, xx, yy - sw / 2, z, l, sw, d);
  }
  for (let i = 0; i < nv; i++) {
    const xx = x + (nv === 1 ? (r(30) - 0.5) * s * 0.3 : (i - 0.5) * s * 0.5), l = s * (0.5 + r(40 + i) * 0.45);
    box(p, c, xx, y + s * 0.45 - l, z, sw, l, d);
  }
  for (let i = 0; i < 2; i++) if (r(50 + i) > 0.35) box(p, c, x + (i ? 0.22 : -0.22) * s, y - s * 0.3, z, sw, s * 0.42, d, 0, 0, (i ? -1 : 1) * 0.75);
}

/** Snow-capped mountain band on an arc behind the plinth (θ in radians from +x, counter-clockwise towards −z). */
function range(p: THREE.Object3D, th0: number, th1: number, r0: number, r1: number, hmax: number, y0: number, rock: string, snow: string, snowY: number, seed: number, nT = 72, nR = 12): void {
  const pt = (i: number, j: number): V3 => {
    const t = i / nT, s = j / nR, th = th0 + (th1 - th0) * t, r = r0 + (r1 - r0) * s;
    const env = Math.sin(Math.PI * s) ** 0.7 * Math.min(1, Math.sin(Math.PI * t) * 2.2);
    const pk = 0.55 + 0.45 * Math.abs(Math.sin(t * 9.5 + seed)) * (0.6 + 0.4 * fbm(t * 6 + seed, s * 2, 0.3));
    const hh = Math.max(0, env * pk * hmax * (0.75 + 0.5 * fbm(t * 14, s * 4 + seed, 1.1)));
    return [r * Math.cos(th), y0 + hh, -r * Math.sin(th)];
  };
  const G: V3[][] = [];
  for (let i = 0; i <= nT; i++) { G.push([]); for (let j = 0; j <= nR; j++) G[i].push(pt(i, j)); }
  const M = tris();
  for (let i = 0; i < nT; i++) for (let j = 0; j < nR; j++) {
    const a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1];
    for (const [u, v, w] of [[a, d, c], [a, c, b]] as V3[][]) {
      const my = (u[1] + v[1] + w[1]) / 3 - y0, n = fbm(u[0] * 14 + seed, u[2] * 14, 0.7, 2);
      const col = my > snowY * (0.8 + n * 0.45) ? snow : my > snowY * (0.62 + n * 0.3) ? mix(snow, rock, 0.55) : mix(shade(rock, 0.84), rock, clamp(my / snowY));
      M.t(u, v, w, col);
    }
  }
  polyMesh(p, M.pos, M.col);
}

/** Round-headed opening (gate tunnel / window) of width w and height h, as a thin slab facing local +z. */
function arch(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, h: number, dep: number, ry = 0): void {
  const r = w / 2, pts: [number, number][] = [[-r, 0], [r, 0]];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push([Math.cos(a) * r, h - r + Math.sin(a) * r]); }
  slab(grp(p, x, z, ry, y), pts, dep, c, 0, false);
}
/** Plain Chinese house: wall box with a pitched tile roof (ridge along local x) and a dark door. */
function house(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, ry = 0, wall = '#b8a98c', tile = '#5d6063', rh = d * 0.38): void {
  const q = grp(p, x, z, ry, y);
  box(q, wall, 0, 0, 0, w, h, d);
  gable(q, w + 0.006, rh, d + 0.008, tile, 0, h, 0);
  box(q, shade(tile, 0.8), 0, h + rh - 0.002, 0, w + 0.008, 0.003, 0.003);
  box(q, '#3a2e26', 0, 0, d / 2 + 0.0005, Math.min(0.008, w * 0.3), h * 0.7, 0.001);
}
/** Grey dust / gravel speckle paint for desert ground discs. */
const gravel = (base: string, seed: number): Paint => (x, _y, z) => {
  const n = hash3(Math.floor(x * 260), Math.floor(z * 260), seed), f = fbm(x * 9 + seed, z * 9, 0.5, 3);
  return n > 0.95 ? shade(base, 0.88) : n < 0.04 ? shade(base, 1.06) : f > 0.62 ? shade(base, 0.97) : f < 0.36 ? shade(base, 1.02) : null;
};

// ---- 1. Jiayuguan ------------------------------------------------------------------------------------------------

// 嘉峪关 (Ming 1372; gate towers 1506): rammed-earth inner city with 柔远楼/光化楼 and 瓮城, brick-faced 罗城 with 嘉峪关楼,
// corner towers, outer earth wall, Qilian snow range — ref. Wikipedia "Jiayu Pass", Baidu Baike 嘉峪关关城 (plan & photos).
// Orientation: the outward (west) face is the model front (+z), so north is −x and the 瓮城 doors (south) face +x.
const st_jiayuguan: Builder = gp => {
  const y0 = ground(gp, C.gobi, '#8c7654', (x, y, z) => (Math.abs(x + Math.sin(z * 11) * 0.012) < 0.02 && z > 0.3 ? '#c9b48a' : gravel(C.gobi, 3)(x, y, z, 0, 1, 0)));
  range(gp, 0.62, 2.52, 0.335, 0.448, 0.25, y0, '#6f6658', '#eceae4', 0.13, 1.3);
  const E = C.earth, H = 0.05, BR = '#a39a88', DK = '#2b2622';
  const T: LouO = { wall: '#8b3a2d', col: '#6a2a22', tile: '#4d5154', door: '#5b2c24', sh: 0.009, ov: 0.012, gableC: '#7b3328' };
  const W = (pts: [number, number][], o: WallO, closed = false) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) wall(gp, pts[i], pts[(i + 1) % pts.length], y0, o); };
  const earthW: WallO = { h: H, d0: 0.04, d1: 0.028, c: E, bands: 4, ms: 0.0062 };
  // inner city (内城), trapezoid, west wall longest
  W([[0.175, 0.1], [-0.175, 0.1], [-0.16, -0.17], [0.16, -0.17]], earthW, true);
  // barbicans (瓮城) in front of the west and east gates, doors on their south (+x) side
  W([[0.07, 0.1], [0.07, 0.172], [-0.07, 0.172], [-0.07, 0.1]], { ...earthW, h: H * 0.88 });
  W([[-0.07, -0.17], [-0.07, -0.242], [0.07, -0.242], [0.07, -0.17]], { ...earthW, h: H * 0.88 });
  for (const zz of [0.136, -0.206]) {
    box(gp, BR, 0.0905, y0, zz, 0.004, 0.032, 0.026);
    arch(gp, DK, 0.093, y0, zz, 0.016, 0.026, 0.002, Math.PI / 2);
    lou(gp, 0.07, y0 + H * 0.88, zz, 0.034, 0.03, [0.014], { ...T, ov: 0.008 });
  }
  // the 罗城: grey-brick-faced front wall in 凸 plan with the 嘉峪关 gate at its centre
  const LH = 0.056, brickW: WallO = { h: LH, d0: 0.042, d1: 0.03, c: BR, bands: 2, ms: 0.0062, merlon: '#9a917f' };
  W([[0.31, 0.22], [0.11, 0.22], [0.11, 0.27], [-0.11, 0.27], [-0.11, 0.22], [-0.31, 0.22]], brickW);
  // outer earth wall (外城) and Great Wall wings running north and south to the hills
  const outerW: WallO = { h: 0.034, d0: 0.03, d1: 0.02, c: shade(E, 0.95), bands: 3, ms: 0.0055 };
  W([[0.1, -0.27], [0.3, -0.2], [0.31, 0.22]], outerW);
  W([[-0.31, 0.22], [-0.3, -0.2], [-0.1, -0.27]], outerW);
  W([[0.31, 0.22], [0.415, 0.152]], { ...outerW, merlon: null });
  W([[-0.415, 0.152], [-0.31, 0.22]], { ...outerW, merlon: null });
  // gate platforms with tunnels and the three three-storey, three-eave towers
  const gate = (z: number, y: number, h: number, c: string, sz: number) => {
    box(gp, c, 0, y, z, 0.1, h, 0.05);
    box(gp, '#8e877a', 0, y, z + sz * 0.0252, 0.03, h * 0.72, 0.001);
    arch(gp, DK, 0, y, z + sz * 0.0262, 0.02, h * 0.6, 0.002);
  };
  gate(0.1, y0, H, E, 1);
  gate(-0.17, y0, H, E, -1);
  gate(0.27, y0, LH, BR, 1);
  const hs = [0.026, 0.021, 0.018];
  lou(gp, 0, y0 + H, 0.1, 0.085, 0.056, hs, T); // 柔远楼 (west gate)
  lou(gp, 0, y0 + H, -0.17, 0.085, 0.056, hs, T); // 光化楼 (east gate)
  lou(gp, 0, y0 + LH, 0.27, 0.085, 0.056, hs, T); // 嘉峪关楼 over the 罗城 gate
  box(gp, '#2d3a4a', 0, y0 + LH + 0.03, 0.27 + 0.03, 0.018, 0.007, 0.002); // name board
  // brick corner towers (角楼) and the 敌楼 on the north and south walls
  const corner = (x: number, z: number, y: number, c: string) => {
    box(gp, c, x, y, z, 0.034, 0.024, 0.034);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = -1; k <= 1; k++) box(gp, c, x + dx * 0.0155 + dz * k * 0.011, y + 0.024, z + dz * 0.0155 + dx * k * 0.011, dz ? 0.006 : 0.003, 0.005, dx ? 0.006 : 0.003);
      box(gp, DK, x + dx * 0.0172, y + 0.009, z + dz * 0.0172, dz ? 0.005 : 0.001, 0.007, dx ? 0.005 : 0.001);
    }
  };
  for (const [x, z] of [[0.175, 0.1], [-0.175, 0.1], [0.16, -0.17], [-0.16, -0.17]]) corner(x, z, y0 + H, shade(E, 0.97));
  for (const x of [0.31, -0.31]) corner(x, 0.22, y0 + LH, BR);
  for (const sx of [-1, 1]) lou(grp(gp, sx * 0.168, -0.035, Math.PI / 2, y0 + H), 0, 0, 0, 0.05, 0.03, [0.016], { ...T, ov: 0.009 });
  // inside: 游击将军府 courtyard, barracks, well; outside the east gate 文昌阁 and the 关帝庙 with its stage
  house(gp, -0.02, y0, -0.06, 0.07, 0.035, 0.02);
  house(gp, -0.075, y0, -0.025, 0.04, 0.026, 0.017, Math.PI / 2);
  house(gp, 0.035, y0, -0.025, 0.04, 0.026, 0.017, Math.PI / 2);
  house(gp, 0.09, y0, 0.03, 0.06, 0.026, 0.017);
  house(gp, -0.1, y0, 0.04, 0.06, 0.026, 0.017);
  box(gp, '#9a8f7c', -0.02, y0, -0.01, 0.04, 0.0012, 0.03);
  lou(gp, 0.225, y0, -0.09, 0.05, 0.036, [0.017, 0.014], { ...T, ov: 0.009, sh: 0.006 });
  house(gp, -0.23, y0, -0.1, 0.05, 0.03, 0.018, 0, '#a8524a', '#4d5154');
  house(gp, -0.23, y0, -0.03, 0.035, 0.026, 0.014, 0, '#a8524a', '#4d5154');
  // beacon towers (烽燧) out in the Gobi
  tbox(gp, 0.026, 0.026, 0.016, 0.016, 0.045, shade(E, 0.92), -0.37, y0, -0.06);
  tbox(gp, 0.022, 0.022, 0.014, 0.014, 0.036, shade(E, 0.92), 0.385, y0, 0.0);
  // camel caravan arriving at the pass, a drover, Ming guards (bowl helmets, red jackets) at the gate and on the wall
  const camels: [number, number, string | undefined][] = [[0.006, 0.35, '#7d6a52'], [0.024, 0.392, '#8a7a5c']];
  for (const [x, z, load] of camels) camel(gp, x, y0, z, Math.PI + 0.12, 0.034, '#a27c4e', load);
  camel(gp, -0.17, y0, 0.35, 2.1, 0.034, '#94704a', '#6f5f4a');
  camel(gp, 0.15, y0, 0.33, -0.6, 0.034, '#a8845a');
  human(gp, -0.008, y0, 0.33, { h: 0.02, ry: Math.PI, pose: 'walk', top: '#6b5a44', bottom: '#4a4038', hat: '#3a3530', hatStyle: 'fur', detail: 'lo' });
  rod(gp, [-0.004, y0 + 0.012, 0.328], [0.003, y0 + 0.016, 0.338], 0.0004, '#3a2e26', 3);
  const guard = (x: number, y: number, z: number, ry: number) => {
    const g = human(gp, x, y, z, { h: 0.02, ry, pose: 'stand', top: '#8c2f28', bottom: '#3a3a3e', hat: '#3b3b3e', hatStyle: 'bowl', detail: 'lo' });
    rod(gp, [g.handR[0], y, g.handR[2]], [g.handR[0], y + 0.03, g.handR[2]], 0.0005, '#4a3a2a', 3);
  };
  guard(0.028, y0, 0.302, 0);
  guard(-0.028, y0, 0.302, 0);
  for (const x of [0.2, -0.2, 0.06]) guard(x, y0 + LH, x === 0.06 ? 0.273 : 0.222, 0);
  for (const [x, z] of [[0.3, 0.226], [-0.3, 0.226]]) flag(gp, x, y0 + LH + 0.024, z, 0.03, 0.022, 0.015, FL.yel, x > 0 ? -0.4 : Math.PI + 0.4, 8, 6);
};

// ---- 2. Shanhaiguan ----------------------------------------------------------------------------------------------

// 山海关 镇东楼 (Ming 1381): two-storey grey-brick arrow tower with rows of arrow windows, double-eave 歇山 roof and the
// white "天下第一关" board on a 12 m gate platform in the massive east wall; the wall runs south to the sea at 老龙头 and
// north to 角山 — ref. Wikipedia "Shanhai Pass", Baidu Baike 镇东楼 (19.7×10.1 m, 68 arrow windows on the E/N/S faces).
// Orientation: east (outside) is the front; looking west, the sea (south) lies to the front-left, 角山 (north) back-right.
const st_shanhaiguan: Builder = gp => {
  const sea = (x: number, z: number) => -0.7 * x + 0.7 * z - 0.27 + Math.sin(x * 30) * 0.008;
  const y0 = ground(gp, '#a39a7c', '#7b725a', (x, y, z) => {
    const s = sea(x, z);
    if (s > 0.02) return hash3(Math.floor(x * 120), Math.floor(z * 300), 5) > 0.9 ? '#7d9aa0' : s > 0.08 ? C.sea : '#577c84';
    if (s > -0.012) return '#cbbd94';
    return gravel('#9d9677', 7)(x, y, z, 0, 1, 0) ?? (fbm(x * 14, z * 14, 2) > 0.6 ? '#8d8f66' : null);
  });
  range(gp, 0.22, 1.25, 0.31, 0.448, 0.14, y0, '#6f7560', '#8a8c76', 1, 2.2, 40, 7);
  const BR = '#7d7f7f', BRL = '#8d8e8b', DK = '#262624', TILE = '#53575a', H = 0.11, ZW = -0.03;
  const mainW: WallO = { h: H, d0: 0.1, d1: 0.074, c: BR, bands: 5, ms: 0.009, merlon: '#868784' };
  wall(gp, [0.375, ZW], [-0.22, ZW], y0, mainW);
  wall(gp, [-0.22, ZW], [-0.29, 0.1], y0, { ...mainW, h: 0.07, d0: 0.06, d1: 0.045, ms: 0.007 });
  wall(gp, [-0.29, 0.1], [-0.325, 0.168], y0 - 0.004, { ...mainW, h: 0.05, d0: 0.05, d1: 0.042, ms: 0.007 }); // 老龙头 入海石城
  box(gp, '#9a968a', -0.328, y0 - 0.006, 0.172, 0.05, 0.048, 0.03, 0.46);
  lou(grp(gp, -0.29, 0.1, 0.46, y0 + 0.07), 0, 0, 0, 0.05, 0.034, [0.02, 0.016], { wall: '#8a3a2e', col: '#6a2a22', tile: TILE, sh: 0.006, ov: 0.008 }); // 澄海楼
  // moat (护城河) in front of the east gate with a stone bridge, the road out to the east
  box(gp, '#4f6a6c', 0.105, y0 - 0.0004, 0.122, 0.61, 0.001, 0.03);
  box(gp, '#b9ad8e', 0, y0 - 0.0004, 0.06, 0.036, 0.001, 0.07);
  box(gp, '#b9ad8e', 0, y0 - 0.0004, 0.27, 0.036, 0.001, 0.24);
  box(gp, '#a49f92', 0, y0, 0.122, 0.034, 0.0035, 0.046);
  for (const sx of [-1, 1]) box(gp, '#8f8a7e', sx * 0.016, y0 + 0.0035, 0.122, 0.003, 0.004, 0.046);
  for (const [x, z] of [[0.13, 0.2], [0.2, 0.15], [0.28, 0.24], [-0.09, 0.2], [0.36, 0.1], [0.12, 0.34]] as [number, number][]) {
    tree(gp, x, y0, z, 0.055, '#6f7d4e');
  }
  // stone base course and wall stairs (马道) on the inside
  box(gp, '#9e9a8e', 0.1, y0, ZW + 0.046, 0.6, 0.008, 0.012);
  // gate platform with the tunnel
  const PW = 0.26, PD = 0.13, PH = 0.116;
  pbox(gp, BR, 0, y0, ZW, PW, PH, PD, (_x, y, _z, _nx, ny) => (ny > 0.5 ? '#8e8c86' : y < 0.012 ? '#9e9a8e' : Math.floor(y / 0.0105) % 2 ? shade(BR, 0.95) : null), [6, 10, 2]);
  box(gp, '#9e9a8e', 0, y0, ZW + PD / 2 + 0.0005, 0.06, 0.07, 0.002);
  arch(gp, DK, 0, y0, ZW + PD / 2 + 0.0016, 0.042, 0.064, 0.002);
  for (const sx of [-1, 1]) for (let k = 0; k < 9; k++) box(gp, '#868784', sx * (PW / 2 - 0.004), y0 + PH, ZW + PD / 2 - 0.008 - k * 0.0145, 0.008, 0.007, 0.008);
  for (let k = 0; k < 15; k++) box(gp, '#868784', -PW / 2 + 0.008 + k * 0.0174, y0 + PH, ZW + PD / 2 - 0.004, 0.008, 0.007, 0.008);
  // 镇东楼: brick arrow tower, lower storey + skirt eave + upper storey + 歇山 top roof
  const tw = 0.19, td = 0.096, h1 = 0.054, h2 = 0.04, sh = 0.012, yb = y0 + PH, ov = 0.014;
  const AW = (x0: number, x1: number, y: number, z: number, n: number, ry = 0) => {
    for (let i = 0; i < n; i++) {
      const xx = x0 + ((i + 0.5) * (x1 - x0)) / n, ww = 0.0068, hh = 0.0078;
      const px = ry ? z : xx, pz = ry ? xx : z;
      box(gp, '#8d3a2e', px, y - 0.0012, pz, ry ? 0.0012 : ww + 0.0026, hh + 0.0024, ry ? ww + 0.0026 : 0.0012);
      box(gp, DK, px + (ry ? Math.sign(z) * 0.0006 : 0), y, pz + (ry ? 0 : Math.sign(z) * 0.0006), ry ? 0.0012 : ww, hh, ry ? ww : 0.0012);
    }
  };
  pbox(gp, BRL, 0, yb, ZW, tw, h1, td, (_x, y, _z, _nx, ny) => (ny > 0.5 ? null : Math.floor(y / 0.0062) % 2 ? shade(BRL, 0.95) : null), [8, 9, 2]);
  box(gp, '#9e9a8e', 0, yb, ZW, tw + 0.004, 0.004, td + 0.004);
  for (const yy of [0.012, 0.031]) {
    AW(-tw / 2 + 0.01, tw / 2 - 0.01, yb + yy, ZW + td / 2 + 0.0006, 9);
    for (const sx of [-1, 1]) AW(ZW - td / 2 + 0.01, ZW + td / 2 - 0.01, yb + yy, sx * (tw / 2 + 0.0006), 3, 1);
  }
  box(gp, '#6c2c24', 0, yb, ZW - td / 2 - 0.0008, tw * 0.6, h1 * 0.7, 0.0016); // timber doors on the city (west) side
  const y1 = yb + h1;
  roof(gp, 0, y1 - 0.004, ZW, tw + 2 * ov, td + 2 * ov, ov * 0.5, { tile: TILE, inner: [tw - sh, td - sh], lift: 1, k: 0.3 });
  const tw2 = tw - sh, td2 = td - sh;
  pbox(gp, BRL, 0, y1, ZW, tw2, h2, td2, (_x, y, _z, _nx, ny) => (ny > 0.5 ? null : Math.floor(y / 0.0062) % 2 ? shade(BRL, 0.95) : null), [8, 7, 2]);
  AW(-tw2 / 2 + 0.012, -0.03, y1 + 0.017, ZW + td2 / 2 + 0.0006, 3);
  AW(0.03, tw2 / 2 - 0.012, y1 + 0.017, ZW + td2 / 2 + 0.0006, 3);
  for (const sx of [-1, 1]) AW(ZW - td2 / 2 + 0.012, ZW + td2 / 2 - 0.012, y1 + 0.017, sx * (tw2 / 2 + 0.0006), 2, 1);
  box(gp, '#6a2a22', 0, y1 + h2 - 0.005, ZW, tw2 + 0.003, 0.005, td2 + 0.003);
  // the white "天下第一关" board with black characters, red frame
  const pz = ZW + td2 / 2 + 0.002;
  box(gp, '#7a2c24', 0, y1 + 0.011, pz, 0.058, 0.019, 0.002);
  box(gp, '#ece8de', 0, y1 + 0.0125, pz + 0.0012, 0.053, 0.016, 0.001);
  for (let i = 0; i < 5; i++) {
    const cx = -0.02 + i * 0.01, cy = y1 + 0.0205;
    if (i === 3) box(gp, '#1c1c1c', cx, cy - 0.001, pz + 0.0018, 0.0075, 0.0016, 0.0006); // 一
    else glyph(gp, cx, cy, pz + 0.0018, 0.0085, i * 3 + 11, '#1c1c1c', 0.16);
  }
  roof(gp, 0, y1 + h2 - 0.003, ZW, tw2 + 2 * ov, td2 + 2 * ov, 0.034, { tile: TILE, xie: 0.5, lift: 1.3, k: 0.4, gableC: '#7b3328' });
  // arrow towers along the wall: 临闾楼 (north) and 靖边楼 (south corner)
  const arrowTower = (x: number, z: number, ry: number) => {
    const q = grp(gp, x, z, ry, y0 + H);
    box(q, BRL, 0, 0, 0, 0.07, 0.034, 0.05);
    for (let i = 0; i < 4; i++) box(q, DK, -0.024 + i * 0.016, 0.012, 0.0256, 0.006, 0.007, 0.001);
    roof(q, 0, 0.032, 0, 0.088, 0.068, 0.024, { tile: TILE, xie: 0.5, lift: 1, k: 0.38, gableC: '#7b3328' });
  };
  arrowTower(0.3, ZW, 0);
  arrowTower(-0.22, ZW, -0.5);
  // the walled town behind (west): grey courtyard houses
  for (let i = 0; i < 9; i++) {
    const x = -0.24 + (i % 5) * 0.11 + (hash3(i, 2, 3) - 0.5) * 0.02, z = -0.2 - Math.floor(i / 5) * 0.075;
    if (Math.hypot(x, z) < 0.4) house(gp, x, y0, z, 0.06 + hash3(i, 1, 1) * 0.02, 0.03, 0.016, 0, '#a59c88', '#4f5355');
  }
  // Ming garrison at the gate and on the wall, banners on the platform
  const ming = (x: number, z: number, ry: number, pose: HumanOpts['pose'] = 'stand', y = y0, red = true) => {
    const g = human(gp, x, y, z, { h: 0.024, ry, pose, top: red ? '#8c2f28' : '#3f4a5c', bottom: '#3a3a3e', hat: '#3b3b3e', hatStyle: 'bowl', detail: 'lo' });
    if (pose === 'stand') rod(gp, [g.handR[0], y, g.handR[2]], [g.handR[0], y + 0.036, g.handR[2]], 0.0005, '#4a3a2a', 3);
  };
  ming(-0.035, ZW + 0.085, 0);
  ming(0.035, ZW + 0.085, 0);
  ming(-0.01, 0.1, Math.PI, 'walk', y0 + 0.0035, false);
  ming(0.012, 0.17, Math.PI, 'walk');
  ming(0.06, 0.09, -0.6, 'point', y0, false);
  ming(-0.004, 0.24, Math.PI, 'walk', y0, false);
  ming(-0.12, y0 + H, -0.04, 'stand', y0 + H);
  ming(0.15, y0 + H, -0.04, 'stand', y0 + H);
  for (const x of [-0.11, 0.11]) flag(gp, x, y0 + PH + 0.007, ZW + PD / 2 - 0.006, 0.05, 0.03, 0.02, FL.red, x > 0 ? 0.3 : Math.PI - 0.3, 9, 6);
  flag(gp, 0.2, y0 + H + 0.008, ZW + 0.03, 0.04, 0.026, 0.018, FL.yel, 0.2, 8, 6);
  flag(gp, -0.18, y0 + H + 0.008, ZW + 0.03, 0.04, 0.026, 0.018, FL.blk, Math.PI - 0.2, 8, 6);
  // fishing boats on the Bohai shore
  sampan(gp, -0.17, y0, 0.33, 0.9, 0.06);
  sampan(gp, -0.31, y0, 0.27, 2.2, 0.05, false);
};

// ---- 3. Canton Thirteen Factories ----------------------------------------------------------------------------------

/** Ocean junk (广船) with battened lug sails, hull along local x; sails face ±z. */
function junk(p: THREE.Object3D, x: number, y: number, z: number, ry: number, L: number, sail = '#8b5e3c'): void {
  const q = grp(p, x, z, ry, y), h = grp(q, 0, 0, Math.PI / 2, 0), d = hull(h, L, L * 0.26, L * 0.12, '#5b4330', 0.9);
  box(q, '#4a3626', -0.36 * L, d, 0, L * 0.18, L * 0.08, L * 0.2); // stern castle
  box(q, '#8a3a2c', -0.46 * L, d + L * 0.02, 0, 0.002, L * 0.07, L * 0.16);
  for (const [mx, mh, sw] of [[0.12, 0.85, 0.42], [-0.12, 0.7, 0.34], [0.38, 0.45, 0.2]] as [number, number, number][]) {
    rod(q, [mx * L, d, 0], [mx * L, d + mh * L, 0], 0.0011, '#3e3024', 4);
    const sh = mh * L * 0.82, w = sw * L, pts: [number, number][] = [[-w * 0.35, 0], [w * 0.55, 0], [w * 0.62, sh * 0.95], [-w * 0.3, sh]];
    slab(grp(q, mx * L, 0.0035, 0, d + mh * L * 0.12), pts, 0.0012, sail, 0, false);
    for (let k = 1; k < 6; k++) box(q, '#3e3024', mx * L + w * 0.12, d + mh * L * 0.12 + (sh * k) / 6, 0.0045, w * 0.95, 0.0011, 0.0008);
  }
}
/** One Western factory (夷馆) front, x0→x1, `n` storeys of height sh, verandas/arcades by style; depth dd back from z. */
function factory(p: THREE.Object3D, x0: number, x1: number, z: number, y: number, n: number, sh: number, dd: number, wallC: string, style: 'arcade' | 'veranda' | 'plain' | 'pediment', roofC: string | null): number {
  const w = x1 - x0, cx = (x0 + x1) / 2, H = n * sh, DK = '#3a3a38', SH = '#4c6a58';
  box(p, wallC, cx, y, z - dd / 2, w, H, dd);
  box(p, shade(wallC, 0.9), cx, y, z + 0.0006, w + 0.002, 0.006, 0.002);
  const nb = Math.max(3, Math.round(w / 0.016)), bw = w / nb;
  for (let f = 0; f < n; f++) {
    const fy = y + f * sh;
    if (f > 0) box(p, shade(wallC, 0.92), cx, fy - 0.0015, z + 0.0012, w, 0.003, 0.003);
    const ver = (style === 'veranda' || style === 'pediment') && f > 0, arc = style === 'arcade' && f === 0;
    if (ver) {
      box(p, '#5b5a55', cx, fy + 0.002, z - 0.008, w - 0.004, sh - 0.004, 0.002);
      for (let i = 0; i <= nb; i++) cyl(p, wallC, x0 + 0.002 + i * ((w - 0.004) / nb), fy, z + 0.006, 0.0018, sh - 0.002, 6);
      box(p, wallC, cx, fy + sh - 0.003, z + 0.004, w, 0.003, 0.016);
      box(p, shade(wallC, 0.95), cx, fy, z + 0.006, w - 0.002, 0.006, 0.0012);
      for (let i = 0; i < nb; i++) box(p, SH, x0 + (i + 0.5) * bw, fy + sh * 0.18, z - 0.0066, bw * 0.4, sh * 0.6, 0.001);
    } else if (arc) {
      for (let i = 0; i < nb; i++) arch(p, '#4a4a46', x0 + (i + 0.5) * bw, fy, z + 0.0012, bw * 0.62, sh * 0.82, 0.002);
    } else {
      for (let i = 0; i < nb; i++) {
        const wx = x0 + (i + 0.5) * bw;
        box(p, DK, wx, fy + sh * 0.25, z + 0.0012, bw * 0.34, sh * 0.5, 0.0012);
        for (const sx of [-1, 1]) box(p, SH, wx + sx * bw * 0.27, fy + sh * 0.25, z + 0.0016, bw * 0.17, sh * 0.5, 0.0012);
      }
    }
  }
  // cornice, parapet or low hip roof
  box(p, shade(wallC, 1.04), cx, y + H, z - dd / 2, w + 0.004, 0.003, dd + 0.004);
  if (style === 'pediment') {
    slab(grp(p, cx, z + 0.006, 0, y + H), [[-w * 0.4, 0], [w * 0.4, 0], [0, 0.024]], 0.004, shade(wallC, 1.03), 0, false);
    box(p, '#a6a296', cx, y + H, z - 0.004, w * 0.82, 0.004, 0.02);
  }
  if (roofC) roof(p, cx, y + H + 0.002, z - dd / 2, w - 0.002, dd - 0.004, 0.022, { tile: roofC, k: 0.1, lift: 0, rib: null, ridge: shade(roofC, 0.85) });
  else for (let i = 0; i < nb * 2; i++) box(p, shade(wallC, 0.97), x0 + (i + 0.5) * (w / (nb * 2)), y + H + 0.003, z - 0.002, 0.0016, 0.006, 0.0016);
  if (!roofC) {
    box(p, shade(wallC, 1.03), cx, y + H + 0.009, z - 0.002, w, 0.0022, 0.003);
    box(p, '#b4ad9e', cx, y + H, z - dd / 2 - 0.003, w - 0.004, 0.0035, dd - 0.01);
  }
  return y + H;
}

// 广州十三行 (Canton System 1757–1842): the row of Western factories on the Pearl River waterfront with national flagpoles
// (left→right Danish, Spanish, American, Swedish, British, Dutch), Chinese hong buildings beside, junks and sampans — ref.
// export paintings "The Foreign Factories at Canton" (c. 1820–40, e.g. Peabody Essex Museum; Wikipedia "Thirteen Factories").
const st_canton: Builder = gp => {
  const river = (x: number, z: number) => z - 0.095 - Math.sin(x * 7) * 0.006;
  const y0 = ground(gp, '#a99d82', '#6f6450', (x, _y, z) => {
    const r = river(x, z);
    if (r > 0.012) return hash3(Math.floor(x * 90), Math.floor(z * 300), 4) > 0.96 ? '#7f8c7b' : r > 0.1 ? shade(C.river, 0.92) : C.river;
    if (r > -0.02) return Math.floor(x * 140) % 2 ? '#b5ad9c' : '#aaa292';
    if (z > -0.015) return hash3(Math.floor(x * 200), Math.floor(z * 200), 2) > 0.9 ? '#9c9079' : '#b0a488';
    return null;
  });
  // the factory row (each a long building running back from the square)
  const F: [number, number, number, string, 'arcade' | 'veranda' | 'plain' | 'pediment', string | null, string][] = [
    [-0.33, -0.25, 2, '#ddd5c2', 'plain', '#6b6a66', 'dk'],
    [-0.245, -0.17, 2, '#e3dccb', 'arcade', null, 'es'],
    [-0.162, -0.07, 3, '#e6e2d8', 'veranda', null, 'us'],
    [-0.062, 0.0, 2, '#d8cdb3', 'plain', '#6b6a66', 'se'],
    [0.012, 0.15, 3, '#ebe7dd', 'pediment', null, 'gb'],
    [0.16, 0.25, 2, '#e0d8c4', 'arcade', '#6b6a66', 'nl'],
    [0.258, 0.33, 2, '#d6ccb4', 'plain', '#6b6a66', ''],
  ];
  const ZF = -0.02, SH = 0.031;
  for (const [x0, x1, n, c, st, rc, fl] of F) {
    const dd = 0.2 - Math.max(0, Math.abs((x0 + x1) / 2) - 0.2) * 0.8;
    factory(gp, x0, x1, ZF, y0, n, SH, dd, c, st, rc);
    if (fl) flag(gp, (x0 + x1) / 2 - 0.012, y0, ZF + 0.05, 0.2, 0.05, 0.033, FL[fl], 0.15, fl === 'gb' || fl === 'us' ? 22 : 14, fl === 'gb' || fl === 'us' ? 13 : 9, '#e6e2d8', 0.0014);
  }
  // Chinese hongs at both ends: grey brick, 镬耳 (wok-ear) gables, tile roofs
  const hong = (x: number, z: number, w: number, d: number) => {
    box(gp, '#7f817f', x, y0, z, w, 0.045, d);
    gable(gp, w + 0.004, 0.02, d + 0.006, '#55585a', x, y0 + 0.045, z, Math.PI / 2);
    for (const sz of [-1, 1]) slab(grp(gp, x, z + sz * (d / 2 + 0.001), 0, y0 + 0.04), [[-w / 2, 0], [w / 2, 0], [w / 2, 0.012], [w * 0.3, 0.03], [-w * 0.3, 0.03], [-w / 2, 0.012]], 0.003, '#6c6e6c', 0, true);
    box(gp, '#3a2e26', x, y0, z + d / 2 + 0.0006, w * 0.35, 0.026, 0.001);
  };
  hong(-0.375, -0.06, 0.05, 0.07);
  hong(0.37, -0.06, 0.05, 0.07);
  hong(-0.37, -0.15, 0.05, 0.07);
  hong(0.36, -0.15, 0.05, 0.07);
  // the Chinese suburb behind
  for (let i = 0; i < 12; i++) {
    const x = -0.3 + (i % 6) * 0.12 + (hash3(i, 5, 5) - 0.5) * 0.03, z = -0.29 - Math.floor(i / 6) * 0.065;
    if (Math.hypot(x, z) < 0.41) house(gp, x, y0, z, 0.07, 0.04, 0.02, 0, '#8a8a84', '#55585a', 0.014);
  }
  // square: railings, a few trees, quay steps
  for (let i = 0; i < 26; i++) box(gp, '#d8d2c2', -0.33 + i * 0.0264, y0, 0.085, 0.002, 0.008, 0.002);
  box(gp, '#d8d2c2', 0, y0 + 0.007, 0.085, 0.66, 0.0018, 0.0018);
  for (const x of [-0.29, -0.03, 0.21]) tree(gp, x, y0, 0.06, 0.052, '#5f7448');
  for (const x of [-0.12, 0.08]) for (let k = 0; k < 3; k++) box(gp, '#b2aa98', x, y0 - 0.002 - k * 0.002, 0.098 + k * 0.006, 0.04, 0.003, 0.007);
  // traders on the square: Western merchants (dark coats, top hats), Chinese hong merchants and porters with tea chests
  const west = (x: number, z: number, ry: number, pose: HumanOpts['pose'] = 'stand') => human(gp, x, y0, z, { h: 0.023, ry, pose, top: '#2e3440', bottom: '#d8d2c0', hat: '#1f1f22', hatStyle: 'brim', hair: '#7a5a3a', detail: 'lo' });
  const chin = (x: number, z: number, ry: number, top: string, pose: HumanOpts['pose'] = 'stand') => human(gp, x, y0, z, { h: 0.022, ry, pose, top, bottom: '#2f3136', dress: 'ankle', hat: '#2b2b2e', hatStyle: 'qing', detail: 'lo' });
  west(-0.14, 0.04, 0.4); chin(-0.12, 0.05, -2.2, '#2f4a6a', 'point');
  west(0.06, 0.03, 2.6, 'walk'); west(0.085, 0.045, -0.8);
  chin(0.12, 0.06, 0.2, '#5a4a6a');
  for (const [x, z, ry] of [[-0.06, 0.07, 1.5], [-0.035, 0.065, 1.4], [0.27, 0.07, -1.6]] as V3[]) {
    const g = human(gp, x, y0, z, { h: 0.021, ry, pose: 'carry', top: '#7b8590', bottom: '#3a3a3e', hat: '#b7a271', hatStyle: 'conical', sleeve: 0.4, shorts: true, detail: 'lo' });
    rod(gp, [g.handL[0] - Math.cos(ry) * 0.016, g.handL[1] + 0.003, g.handL[2] + Math.sin(ry) * 0.016], [g.handL[0] + Math.cos(ry) * 0.016, g.handL[1] + 0.003, g.handL[2] - Math.sin(ry) * 0.016], 0.0005, '#7a5a38', 3);
    for (const s2 of [-1, 1]) box(gp, '#8a6a44', g.handL[0] + s2 * Math.cos(ry) * 0.015, g.handL[1] - 0.009, g.handL[2] - s2 * Math.sin(ry) * 0.015, 0.0065, 0.0065, 0.0065);
  }
  for (let i = 0; i < 4; i++) box(gp, '#8a6a44', 0.2 + (i % 2) * 0.008, y0 + Math.floor(i / 2) * 0.007, 0.07, 0.0075, 0.007, 0.0075);
  // the river: a big junk, a covered chop boat, sampans
  junk(gp, -0.08, y0 - 0.002, 0.27, 0.06, 0.15);
  junk(gp, 0.22, y0 - 0.002, 0.33, -0.1, 0.1, '#7a5638');
  sampan(gp, 0.1, y0, 0.16, 1.4, 0.055);
  sampan(gp, -0.27, y0, 0.18, 1.8, 0.05);
  sampan(gp, -0.3, y0, 0.3, 1.2, 0.055, false);
  const chop = grp(gp, 0.3, 0.17, 1.7, y0 - 0.002), cd = hull(chop, 0.09, 0.026, 0.008, '#5b4330');
  box(chop, '#6f5a3c', 0, cd, 0, 0.022, 0.012, 0.05);
  gable(chop, 0.026, 0.008, 0.052, '#7d6a48', 0, cd + 0.012, 0, Math.PI / 2);
};

// ---- 4. Yuanmingyuan Dashuifa ----------------------------------------------------------------------------------------

/** Deer / hound statue: body ball, struts for legs, neck and head, facing local +z. */
function beast(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number, c: string, deer: boolean): THREE.Group {
  const q = grp(p, x, z, ry, y), lh = (deer ? 0.55 : 0.36) * s;
  ball(q, c, 0, lh + 0.1 * s, 0, 0.3 * s, 0.3 * s, 0.75 * s);
  for (const lx of [-0.08, 0.08]) for (const lz of [-0.26, 0.26]) strut(q, [lx * s, lh + 0.08 * s, lz * s], [lx * s, 0, lz * s], 0.045 * s, 0.025 * s, c, 4);
  const nk: V3 = deer ? [0, lh + 0.55 * s, 0.4 * s] : [0, lh + 0.25 * s, 0.48 * s];
  strut(q, [0, lh + 0.15 * s, 0.28 * s], nk, 0.08 * s, 0.05 * s, c, 5);
  ball(q, c, nk[0], nk[1], nk[2] + 0.06 * s, 0.11 * s, 0.11 * s, 0.24 * s);
  return q;
}

// 圆明园 西洋楼 大水法 (1759, Giuseppe Castiglione / Michel Benoist; burned 1860): Baroque stone niche-gateway with the great
// arch and shell niche, lion-head cascade, oval basin with the bronze deer chased by ten hounds (猎狗逐鹿), the two 13-tier
// fountain towers and, facing it, the 观水法 throne with its carved stone screen — ref. the 1786 copper engravings
// 《西洋楼铜版画》 "大水法正面", Baidu Baike 大水法 / 观水法. Shown intact; r.style === '1860' adds smoke from the burning.
const st_yuanmingyuan: Builder = (gp, r) => {
  const y0 = ground(gp, '#7d8a58', '#6c6650', (x, _y, z) => {
    const e = (x / 0.24) ** 2 + ((z + 0.03) / 0.15) ** 2;
    if (e < 1 || (z > 0.22 && z < 0.4 && Math.abs(x) < 0.2) || (Math.abs(x) < 0.03 && z > -0.03)) return hash3(Math.floor(x * 120), Math.floor(z * 120), 1) > 0.5 ? '#c8c2b2' : '#bdb6a5';
    return fbm(x * 6, z * 6, 4, 2) > 0.6 ? '#78864f' : null;
  });
  const M = '#e2ddd0', M2 = '#cfc9ba', MG = '#b9b3a4', BZ = '#5c4a32', WT = '#d6eaee', WS = '#86a9b2';
  // pines and the terrace of 远瀛观 behind
  for (const [x, z, s] of [[-0.3, -0.27, 1], [0.31, -0.26, 1.1], [-0.4, 0.05, 0.9], [0.4, 0.06, 0.9], [-0.37, 0.2, 0.8], [0.36, 0.22, 0.8], [-0.2, -0.36, 0.9], [0.2, -0.36, 0.9]] as V3[]) {
    tree(gp, x, y0, z, 0.085 * s, '#46623f', true);
  }
  box(gp, M2, 0, y0, -0.33, 0.24, 0.05, 0.08);
  for (let i = 0; i < 8; i++) cyl(gp, M, -0.1 + i * 0.0286, y0 + 0.05, -0.292, 0.004, 0.05, 8);
  box(gp, M, 0, y0 + 0.1, -0.33, 0.24, 0.008, 0.08);
  // 大水法 façade
  const F = grp(gp, 0, -0.17, 0, y0);
  box(F, MG, 0, 0, 0.005, 0.44, 0.012, 0.07);
  panel(F, 0.15, 0.16, 0.03, M, [archPath(0, 0.012, 0.082, 0.13)], 0, 0.012, 0.0);
  box(F, shade(M2, 0.92), 0, 0.012, -0.018, 0.09, 0.14, 0.006);
  for (let k = 0; k < 9; k++) {
    const a = (k / 8) * Math.PI;
    box(F, M2, Math.cos(a) * 0.019, 0.101 + Math.sin(a) * 0.019, -0.0145, 0.0035, 0.038, 0.002, 0, 0, a - Math.PI / 2);
  }
  ball(F, M2, 0, 0.101, -0.014, 0.012, 0.012, 0.004);
  ball(F, BZ, 0, 0.07, -0.012, 0.016, 0.014, 0.012); // lion head spout
  // crown: great semicircular arch frame with finials
  slab(grp(F, 0, 0, 0, 0.172), (() => { const pts: [number, number][] = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI; pts.push([Math.cos(a) * 0.075, Math.sin(a) * 0.075]); } for (let k = 16; k >= 0; k--) { const a = (k / 16) * Math.PI; pts.push([Math.cos(a) * 0.05, Math.sin(a) * 0.05]); } return pts; })(), 0.026, M, 0, false);
  box(F, M2, 0, 0.165, 0.0, 0.17, 0.008, 0.036);
  for (const [x, y, sz] of [[0, 0.252, 0.016], [-0.075, 0.178, 0.012], [0.075, 0.178, 0.012]] as V3[]) {
    lathe(F, [[0, 0], [sz * 0.5, 0], [sz * 0.3, sz * 0.4], [sz * 0.55, sz * 0.9], [sz * 0.4, sz * 1.4], [0, sz * 1.6]], M, x, y, 0, 10);
  }
  ball(F, M2, 0, 0.21, 0.01, 0.03, 0.022, 0.012); // cartouche
  // paired columns with pedestals and capitals
  for (const sx of [-1, 1]) for (const cx of [0.058, 0.07]) {
    box(F, MG, sx * cx, 0.012, 0.022, 0.012, 0.03, 0.012);
    cyl(F, M, sx * cx, 0.042, 0.022, 0.0042, 0.11, 10);
    box(F, M2, sx * cx, 0.152, 0.022, 0.012, 0.008, 0.012);
  }
  // side wings with niches and balustrades, pyramids/obelisks at their ends
  for (const sx of [-1, 1]) {
    const Wg = grp(F, sx * 0.135, 0.005, -sx * 0.22, 0.012);
    panel(Wg, 0.12, 0.085, 0.022, M2, [archPath(-0.03, 0.012, 0.024, 0.055), archPath(0.03, 0.012, 0.024, 0.055)], 0, 0, 0);
    for (const nx of [-0.03, 0.03]) { box(Wg, MG, nx, 0.012, -0.008, 0.026, 0.06, 0.004); ball(Wg, M, nx, 0.03, -0.004, 0.012, 0.03, 0.01); }
    box(Wg, M, 0, 0.085, 0, 0.126, 0.005, 0.026);
    for (let k = 0; k < 12; k++) box(Wg, M, -0.055 + k * 0.01, 0.09, 0.008, 0.003, 0.009, 0.003);
    box(Wg, M, 0, 0.099, 0.008, 0.124, 0.003, 0.006);
    const ox = sx * 0.205;
    box(F, MG, ox, 0.012, 0.03, 0.03, 0.03, 0.03);
    tbox(F, 0.022, 0.022, 0.006, 0.006, 0.12, M, ox, 0.042, 0.03);
    ball(F, M2, ox, 0.168, 0.03, 0.012);
  }
  // seven-step cascade from the lion head into the basin
  for (let k = 0; k < 7; k++) {
    const yy = 0.012 + (6 - k) * 0.008, zz = 0.022 + k * 0.012;
    box(F, MG, 0, 0, zz, 0.06 - k * 0.001, yy + 0.008, 0.012);
    box(F, WS, 0, yy + 0.008, zz, 0.044, 0.0012, 0.012);
    box(F, WT, 0, yy, zz + 0.0062, 0.044, 0.0085, 0.0012);
  }
  rod(F, [0, 0.068, -0.004], [0, 0.07, 0.016], 0.003, WT, 6);
  // 13-tier fountain towers
  for (const sx of [-1, 1]) {
    const tx = sx * 0.33, tz = -0.1;
    box(gp, MG, tx, y0, tz, 0.08, 0.008, 0.08);
    for (let k = 0; k < 13; k++) {
      const w = 0.064 - k * 0.0034, yy = y0 + 0.008 + k * 0.0125;
      box(gp, k % 2 ? M2 : M, tx, yy, tz, w, 0.0105, w);
      box(gp, M, tx, yy + 0.0105, tz, w + 0.004, 0.002, w + 0.004);
      if (k % 3 === 0) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) rod(gp, [tx + dx * w / 2, yy + 0.008, tz + dz * w / 2], [tx + dx * (w / 2 + 0.012), yy - 0.006, tz + dz * (w / 2 + 0.012)], 0.0009, WT, 3);
    }
    rod(gp, [tx, y0 + 0.17, tz], [tx, y0 + 0.215, tz], 0.0018, WT, 5);
  }
  // oval basin with the bronze deer and ten hounds, jets from the antlers and the hounds' mouths
  const B = grp(gp, 0, -0.03, 0, y0);
  B.scale.set(1, 1, 0.6);
  lathe(B, [[0.16, 0], [0.168, 0], [0.168, 0.012], [0.158, 0.014], [0.154, 0.006], [0, 0.006]], M, 0, 0, 0, 40);
  cyl(B, WS, 0, 0.0065, 0, 0.155, 0.0012, 40);
  box(gp, MG, 0, y0, -0.03, 0.03, 0.012, 0.02);
  const deer = beast(gp, 0, y0 + 0.012, -0.03, Math.PI / 2, 0.05, BZ, true);
  for (let k = 0; k < 8; k++) {
    const a = (k / 7 - 0.5) * 1.6, sx = k < 4 ? -1 : 1;
    rod(deer, [sx * 0.01, 0.075, 0.03], [sx * 0.018 + Math.sin(a) * 0.012, 0.1, 0.02 + Math.cos(a) * 0.006], 0.0009, BZ, 3);
    rod(deer, [sx * 0.018 + Math.sin(a) * 0.012, 0.1, 0.02], [sx * 0.025 + Math.sin(a) * 0.02, 0.14, 0.02], 0.0008, WT, 3);
  }
  for (let k = 0; k < 10; k++) {
    const sx = k < 5 ? -1 : 1, t = (k % 5) / 4, a = sx < 0 ? Math.PI * (0.75 + t * 0.5) : Math.PI * (0.25 - t * 0.5);
    const hx = Math.cos(a) * 0.13, hz = -0.03 + Math.sin(a) * 0.075, ry = Math.atan2(-hx, -(hz + 0.03));
    beast(gp, hx, y0 + 0.007, hz, ry, 0.026, BZ, false);
    rod(gp, [hx * 0.88, y0 + 0.02, -0.03 + (hz + 0.03) * 0.88], [hx * 0.35, y0 + 0.04, -0.03 + (hz + 0.03) * 0.35], 0.0008, WT, 3);
  }
  // 观水法: throne terrace and the five-panel carved stone screen (with trophies of arms), Baroque gates at both ends
  const G = grp(gp, 0, 0.33, Math.PI, y0);
  box(G, MG, 0, 0, 0, 0.22, 0.012, 0.06);
  for (const [x, w, h] of [[0, 0.048, 0.085], [-0.05, 0.044, 0.072], [0.05, 0.044, 0.072], [-0.096, 0.042, 0.062], [0.096, 0.042, 0.062]] as V3[]) {
    box(G, M, x, 0.012, -0.022, w, h, 0.008);
    slab(grp(G, x, -0.022, 0, 0.012 + h), [[-w / 2, 0], [w / 2, 0], [w * 0.35, w * 0.18], [0, w * 0.3], [-w * 0.35, w * 0.18]], 0.008, M2, 0, false);
    for (const sz of [-1, 1]) {
      ball(G, M2, x, 0.012 + h * 0.55, -0.022 + sz * 0.004, w * 0.42, h * 0.42, 0.004);
      box(G, MG, x, 0.012 + h * 0.2, -0.022 + sz * 0.0045, 0.003, h * 0.62, 0.002, 0, 0, 0.6);
      box(G, MG, x, 0.012 + h * 0.2, -0.022 + sz * 0.0045, 0.003, h * 0.62, 0.002, 0, 0, -0.6);
    }
  }
  box(G, '#c9a04a', 0, 0.012, 0.008, 0.02, 0.014, 0.014);
  box(G, '#c9a04a', 0, 0.026, 0.0015, 0.02, 0.016, 0.003);
  for (const sx of [-1, 1]) {
    tbox(G, 0.018, 0.018, 0.008, 0.008, 0.09, M, sx * 0.13, 0.012, -0.01);
    ball(G, M2, sx * 0.13, 0.106, -0.01, 0.009);
    panel(G, 0.046, 0.06, 0.012, M, [archPath(0, 0, 0.022, 0.044)], sx * 0.17, 0, -0.005);
    slab(grp(G, sx * 0.17, -0.005, 0, 0.06), [[-0.023, 0], [0.023, 0], [0.01, 0.012], [0, 0.018], [-0.01, 0.012]], 0.012, M2, 0, false);
  }
  // Qianlong's court: the emperor and officials viewing the fountains
  const q = (x: number, z: number, ry: number, top: string, pose: HumanOpts['pose'] = 'stand') => human(gp, x, y0 + (z > 0.28 ? 0.012 : 0), z, { h: 0.028, ry, pose, top, bottom: shade(top, 0.8), dress: 'ankle', hat: '#2b2b2e', hatStyle: 'qing', detail: 'lo' });
  q(0, 0.315, Math.PI, '#c9a43e', 'sit');
  q(-0.04, 0.3, Math.PI - 0.2, '#2f3f5a');
  q(0.045, 0.3, Math.PI + 0.3, '#2f3f5a', 'point');
  q(0.13, 0.15, Math.PI - 0.6, '#3e4a3a');
  if (r.style === '1860') {
    for (const [x, z] of [[-0.12, -0.28], [0.1, -0.33], [0.3, -0.18]]) {
      const sm = grp(gp, x, z, 0, y0 + 0.05);
      sm.name = 'smoke';
      sm.userData = { size: 0.02 };
      for (let k = 0; k < 6; k++) ball(sm, k % 2 ? '#4a4744' : '#5d5955', 0, 0, 0, 1);
    }
  }
};

// ---- 5. Wuchang Red House --------------------------------------------------------------------------------------------

/** Brick façade bays along local x on the face z (group-local): windows with white surrounds, string courses per storey. */
function bays(p: THREE.Object3D, x0: number, x1: number, z: number, y: number, n: number, sh: number, nb: number, o: { trim: string; glass: string; archTop?: boolean; ry?: number }): void {
  const bw = (x1 - x0) / nb, s = Math.sign(z) || 1;
  for (let f = 0; f < n; f++) for (let i = 0; i < nb; i++) {
    const wx = x0 + (i + 0.5) * bw, wy = y + f * sh + sh * 0.22, ww = Math.min(bw * 0.46, 0.012), wh = sh * 0.55;
    box(p, o.trim, wx, wy - 0.0015, z + s * 0.0006, ww + 0.003, wh + 0.004, 0.0012);
    if (o.archTop) arch(p, o.glass, wx, wy, z + s * 0.0012, ww, wh, 0.0012);
    else box(p, o.glass, wx, wy, z + s * 0.0012, ww, wh, 0.0012);
    box(p, o.trim, wx, wy - 0.0025, z + s * 0.0016, ww + 0.004, 0.0018, 0.003);
  }
  for (let f = 1; f <= n; f++) box(p, o.trim, (x0 + x1) / 2, y + f * sh - 0.002, z, x1 - x0, 0.003, 0.003);
}
/** Field cannon on a two-wheeled carriage pointing along local +z. */
function cannon(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number): void {
  const q = grp(p, x, z, ry, y), wd = '#4a3a2a', ir = '#2f3133';
  for (const sx of [-1, 1]) {
    const w = grp(q, sx * 0.22 * s, 0, Math.PI / 2, 0.3 * s);
    lathe(w, [[0.3 * s, -0.03 * s], [0.3 * s, 0.03 * s], [0.04 * s, 0.03 * s], [0.04 * s, -0.03 * s]].map(([a, b]) => [a, b] as [number, number]), wd, 0, 0, 0, 12).rotation.x = Math.PI / 2;
  }
  box(q, wd, 0, 0.18 * s, -0.25 * s, 0.14 * s, 0.1 * s, 0.75 * s, 0, -0.28);
  strut(q, [0, 0.38 * s, -0.25 * s], [0, 0.42 * s, 0.6 * s], 0.09 * s, 0.06 * s, ir, 8);
  ball(q, ir, 0, 0.37 * s, -0.3 * s, 0.17 * s);
}

// 武昌起义 1911: 湖北军政府旧址 "红楼" (Hubei Provincial Assembly, 1909–10): two-storey red-brick building in 山-shaped plan
// with white trim, granite base, central portico and pediment under the clock tower with its dome, the 18-star iron-blood
// flag (鐵血十八星旗) on the roof, New Army insurgents with white armbands and a captured Qing field gun — ref. Wikipedia
// "Wuchang Uprising", Baidu Baike 湖北军政府旧址 / 鄂军都督府 (photos of 红楼 and the 1911 flag).
const st_wuchang: Builder = gp => {
  const y0 = ground(gp, '#a9a08a', '#6f6754', (x, _y, z) => {
    if (z > 0.1 && Math.abs(x) < 0.06) return '#bdb4a0';
    if (z > 0.13 && (Math.abs(x) > 0.1 && Math.abs(x) < 0.36)) return fbm(x * 9, z * 9, 2) > 0.6 ? '#73834c' : '#77874f';
    return hash3(Math.floor(x * 150), Math.floor(z * 150), 6) > 0.92 ? '#9d9480' : null;
  });
  const RB = C.redBrick, TR = '#e2ddcf', GL = '#3b3f44', BASE = '#9a958a', RT = '#7e3a2e', SH = 0.046, ZF = 0.045;
  const block = (x: number, z: number, w: number, d: number, faces: ('f' | 'b' | 'l' | 'r')[], nbF: number, nbS: number) => {
    box(gp, BASE, x, y0, z, w + 0.004, 0.01, d + 0.004);
    box(gp, RB, x, y0 + 0.01, z, w, 2 * SH, d);
    for (const fc of faces) {
      if (fc === 'f' || fc === 'b') {
        const q = grp(gp, x, z, fc === 'f' ? 0 : Math.PI, 0);
        bays(q, -w / 2 + 0.004, w / 2 - 0.004, d / 2, y0 + 0.01, 2, SH, nbF, { trim: TR, glass: GL, archTop: true });
      } else {
        const q = grp(gp, x, z, fc === 'r' ? Math.PI / 2 : -Math.PI / 2, 0);
        bays(q, -d / 2 + 0.004, d / 2 - 0.004, w / 2, y0 + 0.01, 2, SH, nbS, { trim: TR, glass: GL, archTop: true });
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(gp, TR, x + sx * (w / 2 - 0.002), y0 + 0.01, z + sz * (d / 2 - 0.002), 0.0055, 2 * SH, 0.0055);
    box(gp, TR, x, y0 + 0.01 + 2 * SH, z, w + 0.006, 0.005, d + 0.006);
    roof(gp, x, y0 + 0.015 + 2 * SH, z, w + 0.004, d + 0.004, 0.04, { tile: RT, k: 0.05, lift: 0, rib: null, ridge: shade(RT, 0.85), th: 0.003 });
  };
  // 山-plan: long front range, end wings and the central assembly-hall wing running back
  block(0, ZF - 0.05, 0.6, 0.1, ['f'], 20, 3);
  for (const sx of [-1, 1]) block(sx * 0.255, -0.17, 0.09, 0.14, [sx > 0 ? 'r' : 'l'], 3, 5);
  block(0, -0.19, 0.11, 0.18, ['l', 'r'], 3, 6);
  // central portico: arcade below, colonnaded loggia above, pediment
  const PX = 0.075, PZ = ZF + 0.03;
  box(gp, BASE, 0, y0, PZ - 0.015, 2 * PX + 0.006, 0.012, 0.036);
  for (let k = 0; k < 3; k++) box(gp, BASE, 0, y0, PZ + 0.004 + k * 0.006, 0.05, 0.012 - k * 0.004, 0.006);
  box(gp, RB, 0, y0 + 0.012, PZ - 0.018, 2 * PX, 2 * SH, 0.03);
  for (let i = 0; i < 5; i++) {
    const x = -PX + 0.012 + i * ((2 * PX - 0.024) / 4);
    arch(gp, '#40362f', x, y0 + 0.012, PZ - 0.0025, 0.016, SH * 0.8, 0.002);
    cyl(gp, TR, x + 0.016, y0 + 0.012 + SH, PZ - 0.002, 0.0028, SH - 0.004, 8);
    if (i === 0) cyl(gp, TR, x - 0.016, y0 + 0.012 + SH, PZ - 0.002, 0.0028, SH - 0.004, 8);
  }
  box(gp, '#3e3833', 0, y0 + 0.012 + SH, PZ - 0.012, 2 * PX - 0.008, SH - 0.004, 0.002);
  box(gp, TR, 0, y0 + 0.012 + SH - 0.003, PZ - 0.002, 2 * PX + 0.004, 0.004, 0.006);
  for (let i = 0; i < 18; i++) box(gp, TR, -PX + 0.006 + i * 0.0082, y0 + 0.012 + SH, PZ + 0.0, 0.0016, 0.008, 0.0016);
  box(gp, TR, 0, y0 + 0.012 + 2 * SH - 0.004, PZ - 0.016, 2 * PX + 0.006, 0.007, 0.036);
  slab(grp(gp, 0, PZ - 0.004, 0, y0 + 0.008 + 2 * SH + 0.007), [[-PX - 0.003, 0], [PX + 0.003, 0], [0, 0.03]], 0.012, TR, 0, false);
  slab(grp(gp, 0, PZ + 0.0025, 0, y0 + 0.012 + 2 * SH + 0.007), [[-PX + 0.012, 0], [PX - 0.012, 0], [0, 0.021]], 0.002, RB, 0, false);
  // clock tower with the melon-rib dome and lookout
  const TY = y0 + 0.012 + 2 * SH + 0.012, TZ = ZF - 0.04;
  box(gp, RB, 0, TY, TZ, 0.05, 0.05, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(gp, TR, sx * 0.023, TY, TZ + sz * 0.023, 0.006, 0.05, 0.006);
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0]]) {
    const cx = dx * 0.0256, cz = TZ + dz * 0.0256, ry = dx ? Math.PI / 2 : 0;
    const face = grp(gp, cx, cz, ry, TY + 0.026);
    lathe(face, [[0, 0], [0.0125, 0], [0.0125, 0.0015], [0, 0.0015]], TR, 0, 0, 0, 16).rotation.x = Math.PI / 2;
    box(face, '#2a2a2a', 0, 0, 0.0018, 0.0012, 0.009, 0.0008, 0, 0, 0.2);
    box(face, '#2a2a2a', 0.002, 0.001, 0.0018, 0.0012, 0.006, 0.0008, 0, 0, -1.2);
  }
  box(gp, TR, 0, TY + 0.05, TZ, 0.058, 0.005, 0.058);
  const ribs = 12, dome: V3[][] = [];
  for (let k = 0; k <= 6; k++) {
    const t = k / 6, rr = 0.024 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.001, ring: V3[] = [];
    for (let j = 0; j < ribs * 2; j++) { const a = (j / (ribs * 2)) * TAU, rj = rr * (j % 2 ? 0.94 : 1); ring.push([Math.cos(a) * rj, TY + 0.055 + t * 0.032, TZ + Math.sin(a) * rj]); }
    dome.push(ring);
  }
  skin(gp, dome, '#4e5a5a', { closed: true, caps: true, flat: true });
  cyl(gp, TR, 0, TY + 0.086, TZ, 0.006, 0.012, 8);
  cone(gp, '#4e5a5a', 0, TY + 0.098, TZ, 0.008, 0.01, 8);
  flag(gp, 0, TY + 0.108, TZ, 0.085, 0.072, 0.048, FL.xh, 0.25, 30, 20, '#3a3532', 0.0014);
  // trees and the front gate posts
  for (const [x, z] of [[-0.22, 0.2], [0.22, 0.2], [-0.33, 0.12], [0.33, 0.12], [-0.13, 0.33], [0.13, 0.33]] as [number, number][]) {
    tree(gp, x, y0, z, 0.068, '#55693f');
  }
  for (const sx of [-1, 1]) { box(gp, BASE, sx * 0.07, y0, 0.37, 0.016, 0.04, 0.016); ball(gp, TR, sx * 0.07, y0 + 0.044, 0.37, 0.01); }
  // New Army insurgents: dark grey-blue uniforms, peaked caps, white armbands, rifles; the Qing cannon in front
  cannon(gp, 0.06, y0, 0.16, 0.25, 0.06);
  const NA: Partial<HumanOpts> = { top: '#3d4757', bottom: '#353d4a', hat: '#353d4a', hatStyle: 'peaked', detail: 'lo' };
  const h = 0.032;
  trooper(gp, -0.04, y0, 0.15, h, 0.1, { ...NA, band: '#ecebe4', gunMode: 'raise', bayonet: true });
  trooper(gp, -0.075, y0, 0.18, h, 0.3, { ...NA, band: '#ecebe4', gunMode: 'order', bayonet: true });
  trooper(gp, 0.11, y0, 0.2, h, -0.3, { ...NA, band: '#ecebe4', gunMode: 'raise' });
  trooper(gp, 0.0, y0, 0.24, h, Math.PI + 0.1, { ...NA, band: '#ecebe4', gunMode: 'port', pose: 'run' });
  trooper(gp, -0.12, y0, 0.25, h, 0.6, { ...NA, band: '#ecebe4', gunMode: null, pose: 'point' });
  trooper(gp, 0.16, y0, 0.27, h, -0.5, { ...NA, band: '#ecebe4', gunMode: 'aim' });
  trooper(gp, -0.02, y0 + 0.012, 0.09, h, 0, { ...NA, band: '#ecebe4', gunMode: 'order', bayonet: true });
  trooper(gp, 0.02, y0 + 0.012, 0.09, h, 0, { ...NA, band: '#ecebe4', gunMode: 'order', bayonet: true });
  for (const sx of [-1, 1]) flag(gp, sx * 0.07, y0 + 0.044, 0.37, 0.05, 0.04, 0.027, FL.xh, sx > 0 ? -0.3 : Math.PI + 0.3, 20, 13, '#3a3532', 0.0011);
};

// ---- 6. Nanchang Jiangxi Grand Hotel ------------------------------------------------------------------------------

// 八一南昌起义总指挥部旧址 江西大旅社 (1924; HQ of the 1 Aug 1927 uprising): four-storey grey-brick hotel round a courtyard
// (回-plan) with galleries, arched windows, the central balcony, the Baroque crowning gable and the arched brick entrance,
// rooftop teahouse; insurgents in grey with red neckerchiefs and white armbands — ref. Baidu Baike 八一南昌起义纪念馆 /
// 江西大旅社, Wikipedia "Nanchang Uprising" (photos of the Zhongshan Road façade).
const st_nanchang: Builder = gp => {
  const y0 = ground(gp, '#8f8c84', '#5f5d57', (x, _y, z) => {
    if (z > 0.14 && z < 0.3) return Math.floor(x * 60) % 2 ? '#86827a' : '#8a867e';
    if (z >= 0.3) return '#a09a8c';
    return hash3(Math.floor(x * 120), Math.floor(z * 120), 8) > 0.9 ? '#858179' : null;
  });
  const GR = '#9a9a96', GRD = '#828380', TR = '#d8d5cc', GL = '#33373b', SH = 0.042, N = 4, H = N * SH;
  const X0 = 0.19, Z0 = 0.11, Z1 = -0.2, cx0 = 0.095, cz0 = 0.0, cz1 = -0.11;
  const wing = (x: number, z: number, w: number, d: number) => {
    pbox(gp, GR, x, y0, z, w, H, d, (_x, y, _z, _nx, ny) => (ny > 0.5 ? '#77756f' : y < 0.008 ? GRD : Math.floor(y / 0.0105) % 2 ? shade(GR, 0.96) : null), [4, 16, 4]);
    box(gp, TR, x, y0 + H - 0.005, z, w + 0.004, 0.004, d + 0.004);
  };
  wing(0, (Z0 + cz0) / 2, 2 * X0, Z0 - cz0);
  wing(0, (cz1 + Z1) / 2, 2 * X0, cz1 - Z1);
  for (const sx of [-1, 1]) wing(sx * (X0 + cx0) / 2, (cz0 + cz1) / 2, X0 - cx0, cz0 - cz1);
  // street façade: pilasters, arched windows, cornices
  bays(gp, -X0 + 0.006, X0 - 0.006, Z0, y0, N, SH, 11, { trim: TR, glass: GL, archTop: true });
  for (let i = 0; i <= 11; i++) box(gp, '#a7a7a2', -X0 + 0.006 + i * ((2 * X0 - 0.012) / 11), y0, Z0 + 0.0012, 0.005, H, 0.0028);
  for (const sx of [-1, 1]) {
    const q = grp(gp, sx * X0, (Z0 + Z1) / 2, sx * Math.PI / 2, 0);
    bays(q, -(Z0 - Z1) / 2 + 0.006, (Z0 - Z1) / 2 - 0.006, 0, y0, N, SH, 9, { trim: TR, glass: GL, archTop: true });
  }
  // central bay: arched brick entrance, stacked balconies, crowning Baroque gable with the name board
  box(gp, '#a5a5a0', 0, y0, Z0 + 0.002, 0.07, H + 0.01, 0.004);
  arch(gp, '#7e4a38', 0, y0, Z0 + 0.0042, 0.04, 0.036, 0.002);
  arch(gp, '#2e2a27', 0, y0, Z0 + 0.0054, 0.03, 0.03, 0.002);
  for (const f of [1, 2]) {
    const by = y0 + f * SH;
    box(gp, TR, 0, by, Z0 + 0.012, 0.06, 0.003, 0.02);
    for (let k = 0; k < 9; k++) box(gp, TR, -0.028 + k * 0.007, by + 0.003, Z0 + 0.021, 0.0016, 0.008, 0.0016);
    box(gp, TR, 0, by + 0.011, Z0 + 0.021, 0.06, 0.0018, 0.0022);
  }
  const gy = y0 + H + 0.004;
  slab(grp(gp, 0, Z0 + 0.002, 0, gy), (() => { const pts: [number, number][] = [[-0.05, 0], [0.05, 0], [0.05, 0.012]]; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; pts.push([Math.cos(a) * 0.036, 0.012 + Math.sin(a) * 0.03]); } pts.push([-0.05, 0.012]); return pts; })(), 0.006, '#a5a5a0', 0, false);
  box(gp, '#2c2c2e', 0, gy + 0.016, Z0 + 0.0055, 0.04, 0.011, 0.001);
  for (let i = 0; i < 5; i++) glyph(gp, -0.016 + i * 0.008, gy + 0.0215, Z0 + 0.006, 0.0065, 40 + i, '#c9a04a', 0.16);
  ball(gp, TR, 0, gy + 0.044, Z0 + 0.002, 0.008);
  // parapet with balusters round the roof, the rooftop teahouse (摘星茶社)
  for (const [a, b] of [[[-X0, Z0], [X0, Z0]], [[X0, Z0], [X0, Z1]], [[X0, Z1], [-X0, Z1]], [[-X0, Z1], [-X0, Z0]]] as [number, number][][]) {
    const [q, L] = along(gp, a, b, y0 + H);
    box(q, TR, 0, 0.0095, 0, 0.004, 0.0025, L);
    for (let k = 0; k < Math.round(L / 0.01); k++) box(q, TR, 0, 0.004, -L / 2 + (k + 0.5) * (L / Math.round(L / 0.01)), 0.0025, 0.006, 0.0025);
  }
  box(gp, '#b9b4a8', 0, y0 + H, -0.155, 0.12, 0.034, 0.06);
  for (let i = 0; i < 6; i++) box(gp, GL, -0.05 + i * 0.02, y0 + H + 0.01, -0.124, 0.011, 0.016, 0.001);
  roof(gp, 0, y0 + H + 0.034, -0.155, 0.13, 0.07, 0.016, { tile: '#585c5e', k: 0.15, lift: 0.3, rib: null });
  // courtyard: galleries with railings on each floor, paving and the four water vats
  box(gp, '#9c968a', 0, y0, (cz0 + cz1) / 2, 2 * cx0, 0.002, cz0 - cz1);
  for (let f = 1; f < N; f++) {
    const yy = y0 + f * SH;
    for (const [a, b] of [[[-cx0, cz0], [cx0, cz0]], [[cx0, cz0], [cx0, cz1]], [[cx0, cz1], [-cx0, cz1]], [[-cx0, cz1], [-cx0, cz0]]] as [number, number][][]) {
      const [q, L] = along(gp, a, b, yy);
      box(q, '#5a5550', 0.0015, -SH + 0.004, 0, 0.002, SH - 0.008, L);
      box(q, TR, 0.005, 0, 0, 0.012, 0.002, L);
      box(q, TR, 0.01, 0.007, 0, 0.0018, 0.0016, L);
      for (let k = 0; k < Math.round(L / 0.012); k++) box(q, TR, 0.01, 0.0, -L / 2 + (k + 0.5) * (L / Math.round(L / 0.012)), 0.0014, 0.007, 0.0014);
    }
  }
  for (const [x, z] of [[-0.06, -0.025], [0.06, -0.025], [-0.06, -0.085], [0.06, -0.085]]) lathe(gp, [[0, 0], [0.007, 0], [0.009, 0.004], [0.0085, 0.01], [0.007, 0.01], [0.007, 0.002], [0, 0.002]], '#4a4038', x, y0 + 0.002, z, 10);
  // the street: insurgents in grey with red neckerchiefs and white armbands, rifles; street lamps
  const IN: Partial<HumanOpts> = { top: '#6c6f6a', bottom: '#5d605b', hat: '#5d605b', hatStyle: 'peaked', detail: 'lo' };
  const h = 0.032;
  trooper(gp, -0.02, y0, 0.135, h, 0, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'order', bayonet: true });
  trooper(gp, 0.02, y0, 0.135, h, 0, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'order', bayonet: true });
  trooper(gp, -0.1, y0, 0.2, h, 1.4, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'port', pose: 'run' });
  trooper(gp, -0.15, y0, 0.215, h, 1.5, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'port', pose: 'run' });
  trooper(gp, 0.09, y0, 0.22, h, -0.4, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: null, pose: 'point' });
  trooper(gp, 0.14, y0, 0.25, h, -0.2, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'aim' });
  trooper(gp, 0.04, y0, 0.27, h, Math.PI - 0.2, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'raise' });
  trooper(gp, -0.04, y0, 0.31, h, 0.3, { ...IN, band: '#ecebe4', scarf: '#b0302a', gunMode: 'order' });
  for (const x of [-0.25, 0.25]) {
    cyl(gp, '#2f3133', x, y0, 0.15, 0.0018, 0.07, 6);
    box(gp, '#2f3133', x, y0 + 0.068, 0.15, 0.002, 0.002, 0.012);
    ball(gp, '#e8d9a8', x, y0 + 0.062, 0.157, 0.008, 0.01, 0.008);
  }
  for (const [x, z] of [[-0.3, 0.33], [0.3, 0.33], [-0.36, 0.2], [0.36, 0.2]] as [number, number][]) {
    cyl(gp, '#4f3f30', x, y0, z, 0.0035, 0.025, 5);
    ball(gp, '#4f6a3c', x, y0 + 0.035, z, 0.046, 0.036, 0.044);
  }
};

// ---- 7. Shenzhen 1979 ------------------------------------------------------------------------------------------------

// 深圳 1979: 渔民村 on the Shenzhen River mouth / Shenzhen Bay — low grey-tile brick houses, stilt shacks (棚屋), sampans
// and nets, the Luohu steel-truss railway bridge to Hong Kong, the first tower crane, and the 蛇口 billboard
// 「时间就是金钱 效率就是生命」 being put up (historically 1981, Shekou Industrial Zone) — ref. Baidu Baike 渔民村 /
// 时间就是金钱，效率就是生命 / 罗湖桥, Wikipedia "Shenzhen" & "Lo Wu Bridge" (1970s–80s photographs).
const st_shenzhen79: Builder = gp => {
  const shore = (x: number) => 0.105 + 0.02 * Math.sin(x * 7 + 1) + 0.01 * Math.sin(x * 19 + 2);
  const RX = 0.31;
  const y0 = ground(gp, '#9b916c', '#6c6248', (x, _y, z) => {
    const d = z - shore(x);
    if (d > -0.035) return d > -0.014 ? '#7b6d55' : '#8b7e60';
    if (Math.abs(x - RX) < 0.03) return '#8d8577';
    if (z < -0.15 && x < -0.18) {
      const c = Math.floor((x + 0.5) * 26) + Math.floor((z + 0.5) * 20) * 7;
      return hash3(c, 3, 5) > 0.5 ? '#7d8b4c' : hash3(c, 4, 5) > 0.5 ? '#8e9858' : '#6f7d45';
    }
    return gravel('#9b916c', 11)(x, _y, z, 0, 1, 0);
  });
  // the bay: a vertex-coloured water sheet from the shoreline out to the rim, muddy near the shore
  const WY = y0 + 0.0014, RR = 0.437, W = tris(), NX = 90, NZ = 12;
  for (let i = 0; i < NX; i++) {
    const xa = -RR + (2 * RR * i) / NX, xb = -RR + (2 * RR * (i + 1)) / NX;
    const ra = Math.sqrt(Math.max(0, RR * RR - xa * xa)), rb = Math.sqrt(Math.max(0, RR * RR - xb * xb));
    const sa = Math.min(shore(xa), ra), sb = Math.min(shore(xb), rb);
    if (ra - sa < 1e-4 && rb - sb < 1e-4) continue;
    for (let j = 0; j < NZ; j++) {
      const t0 = j / NZ, t1 = (j + 1) / NZ;
      const a: V3 = [xa, WY, sa + (ra - sa) * t0], b: V3 = [xa, WY, sa + (ra - sa) * t1], c: V3 = [xb, WY, sb + (rb - sb) * t1], d: V3 = [xb, WY, sb + (rb - sb) * t0];
      const col = shade(mix('#74786a', '#587270', clamp((t0 + t1) * 0.9) ** 0.7), 0.985 + hash3(i, j, 9) * 0.03);
      W.t(a, b, d, col); W.t(b, c, d, col);
    }
  }
  polyMesh(gp, W.pos, W.col);
  for (let k = 0; k < 16; k++) {
    const x = -0.36 + hash3(k, 1, 2) * 0.6, z = shore(x) + 0.04 + hash3(k, 2, 2) * 0.22;
    if (x * x + z * z < 0.41 * 0.41) box(gp, '#83958e', x, WY, z, 0.02 + hash3(k, 3, 2) * 0.04, 0.0003, 0.0012);
  }
  range(gp, 0.42 * Math.PI, 0.95 * Math.PI, 0.385, 0.447, 0.055, y0, '#5f6f45', '#6d7a50', 1, 4, 72, 10);

  // 渔民村: rows of low grey-brick, grey-tile houses facing the water, a few two-storey
  const HW = ['#b4a58a', '#bfb196', '#a99f8e', '#c2b397'];
  for (const [row, z] of [-0.125, -0.055, 0.015].entries()) {
    for (let x = -0.39 + row * 0.022, k = 0; x < 0.035; x += 0.066, k++) {
      const jx = (hash3(row, k, 1) - 0.5) * 0.012, jz = (hash3(row, k, 2) - 0.5) * 0.01, hx = x + jx, hz = z + jz;
      if (hx * hx + hz * hz > 0.37 * 0.37 || (Math.abs(hx + 0.07) < 0.05 && hz > -0.02)) continue;
      const two = hash3(row, k, 3) > 0.82;
      house(gp, hx, y0, hz, 0.048, 0.034, two ? 0.042 : 0.024, (hash3(row, k, 4) - 0.5) * 0.12, HW[(row + k) % 4], two ? '#4c5052' : '#55585b', 0.017);
      box(gp, '#3e4448', hx - 0.014, y0 + (two ? 0.026 : 0.01), hz + 0.0172, 0.008, 0.007, 0.001);
      if (two) box(gp, '#3e4448', hx + 0.012, y0 + 0.026, hz + 0.0172, 0.008, 0.007, 0.001);
    }
  }
  // stilt shacks over the tide line with plank walkways
  for (const [i, x] of [-0.355, -0.285, -0.215, -0.145].entries()) {
    const q = grp(gp, x, shore(x) + 0.012, (hash3(i, 2, 3) - 0.5) * 0.3, y0);
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) cyl(q, '#5a4a38', sx * 0.016, 0, sz * 0.012, 0.0011, 0.012, 4);
    box(q, '#6e5a44', 0, 0.012, 0, 0.04, 0.002, 0.03);
    box(q, i % 2 ? '#7d6a52' : '#857560', -0.003, 0.014, -0.002, 0.03, 0.018, 0.022);
    gable(q, 0.034, 0.007, 0.027, i % 2 ? '#5d5a52' : '#6a5e4c', -0.003, 0.032, -0.002);
    box(q, '#3a2e26', -0.003, 0.014, 0.0092, 0.007, 0.012, 0.001);
    box(q, '#6e5a44', 0.012, 0.011, -0.03, 0.008, 0.0015, 0.04);
  }
  // the banyan (大榕树) by the shore, banana clumps, lychee trees
  const lychee = (x: number, z: number, s: number, c: string) => tree(gp, x, y0, z, 0.06 * s, c);
  cyl(gp, '#5e5040', -0.07, y0, 0.03, 0.006, 0.032, 7);
  for (const [dx, dy, dz, s] of [[0, 0.05, 0, 0.07], [-0.03, 0.04, 0.01, 0.05], [0.032, 0.042, -0.006, 0.052], [0.008, 0.042, 0.03, 0.045], [-0.01, 0.045, -0.03, 0.05]]) ball(gp, dx ? '#4f6a3a' : '#48613a', -0.07 + dx, y0 + dy, 0.03 + dz, s, s * 0.62, s);
  for (const [dx, dz] of [[-0.03, 0.012], [0.028, -0.01], [0.022, 0.02]]) rod(gp, [-0.07 + dx, y0 + 0.034, 0.03 + dz], [-0.07 + dx * 1.1, y0, 0.03 + dz * 1.1], 0.0009, '#6a5a48', 3);
  const banana = (x: number, z: number) => {
    cyl(gp, '#7d8a4a', x, y0, z, 0.0018, 0.016, 5);
    for (let k = 0; k < 6; k++) box(gp, k % 2 ? '#6f8a3c' : '#7c9645', x, y0 + 0.014, z, 0.006, 0.02, 0.0008, (k / 6) * TAU, 0, 0.95);
  };
  for (const [x, z] of [[-0.33, -0.02], [-0.2, -0.09], [0.0, -0.07], [-0.12, 0.06], [0.05, 0.04], [-0.26, 0.05]] as [number, number][]) banana(x, z);
  for (const [x, z] of [[-0.3, -0.19], [-0.17, -0.2], [0.07, -0.13], [-0.38, -0.08], [0.2, 0.07]] as [number, number][]) lychee(x, z, 1, '#556b3d');
  // nets drying on bamboo poles
  for (const [x, z, ry] of [[0.02, 0.08, 0.1], [-0.33, 0.085, -0.2]]) {
    const q = grp(gp, x, z, ry, y0);
    for (const sx of [-0.028, 0.028]) cyl(q, '#b59a62', sx, 0, 0, 0.001, 0.036, 4);
    rod(q, [-0.028, 0.034, 0], [0.028, 0.034, 0], 0.0005, '#6b5a40', 3);
    box(q, '#4f544a', 0, 0.012, 0, 0.054, 0.022, 0.0006);
  }

  // the bay: sampans with their scullers, a motor fishing junk
  sampan(gp, -0.24, WY, 0.21, 1.25, 0.06);
  sampan(gp, -0.08, WY, 0.29, -0.45, 0.056);
  sampan(gp, 0.09, WY, 0.21, 1.9, 0.058, false);
  sampan(gp, -0.33, WY, 0.17, 0.35, 0.05, false);
  sampan(gp, 0.06, WY, 0.36, 0.9, 0.05);
  {
    const q = grp(gp, -0.19, 0.33, 1.35, WY), d = hull(q, 0.12, 0.036, 0.012, '#5d4a36');
    box(q, '#8a7a62', 0, d, -0.03, 0.026, 0.016, 0.034);
    gable(q, 0.03, 0.006, 0.038, '#5c564c', 0, d + 0.016, -0.03);
    rod(q, [0, d, 0.02], [0, d + 0.07, 0.02], 0.0009, '#6b553b', 4);
    rod(q, [0, d + 0.055, 0.02], [0, d + 0.01, 0.055], 0.0005, '#6b553b', 3);
    human(q, 0.006, d, 0.03, { h: 0.024, top: '#46505a', bottom: '#2f3338', hat: '#b7a271', hatStyle: 'conical', pose: 'reach', detail: 'lo', ry: 0.4 });
  }

  // the railway to Luohu: ballast embankment, rails and sleepers, a diesel train, the steel-truss border bridge
  const z0r = -Math.sqrt(0.437 ** 2 - RX * RX) + 0.01, z1r = shore(RX) - 0.01, Lr = z1r - z0r;
  box(gp, '#8a8274', RX, y0, (z0r + z1r) / 2, 0.034, 0.005, Lr);
  for (let k = 0; k < Math.floor(Lr / 0.007); k++) box(gp, '#5e5246', RX, y0 + 0.005, z0r + 0.004 + k * 0.007, 0.016, 0.0008, 0.0022);
  const RT = y0 + 0.0058;
  for (const sx of [-1, 1]) box(gp, '#46484a', RX + sx * 0.0055, RT, (z0r + z1r) / 2, 0.0012, 0.0012, Lr);
  const car = (z: number, L: number, loco: boolean) => {
    const c = loco ? '#3c5a3e' : '#3f5f4a';
    box(gp, '#2e2f30', RX, RT + 0.0012, z, 0.014, 0.004, L - 0.006);
    box(gp, c, RX, RT + 0.005, z, 0.019, loco ? 0.017 : 0.019, L);
    box(gp, '#d2c79c', RX, RT + 0.011, z, 0.0194, 0.0012, L + 0.0004);
    if (!loco) for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) box(gp, '#2f3538', RX + sx * 0.0096, RT + 0.0135, z - L / 2 + 0.006 + k * ((L - 0.012) / 6), 0.0006, 0.005, 0.005);
    if (loco) { box(gp, '#2f3538', RX, RT + 0.015, z + L / 2 - 0.004, 0.016, 0.005, 0.0006); box(gp, shade(c, 0.85), RX, RT + 0.022, z, 0.017, 0.002, L - 0.004); }
    else ball(gp, '#6f7270', RX, RT + 0.024, z, 0.019, 0.004, L);
  };
  car(-0.065, 0.055, true); car(-0.125, 0.062, false); car(-0.19, 0.062, false);
  const bz0 = z1r, bz1 = 0.305, DY = RT, TH = 0.026, nb = 10;
  for (const pz of [bz0 + (bz1 - bz0) * 0.38, bz0 + (bz1 - bz0) * 0.76]) box(gp, '#8f8b82', RX, WY - 0.001, pz, 0.026, DY - WY - 0.001, 0.012);
  box(gp, '#6a665e', RX, DY - 0.003, (bz0 + bz1) / 2, 0.026, 0.003, bz1 - bz0);
  for (const sx of [-1, 1]) box(gp, '#46484a', RX + sx * 0.0055, DY, (bz0 + bz1) / 2, 0.0012, 0.0012, bz1 - bz0);
  const BC = '#3f4a4e';
  for (const sx of [-1, 1]) {
    const X = RX + sx * 0.015, P = (t: number, top: boolean): V3 => [X, DY + (top ? TH : 0), bz0 + (bz1 - bz0) * t];
    rod(gp, P(0, false), P(1, false), 0.0012, BC, 4);
    rod(gp, P(1 / nb, true), P(1 - 1 / nb, true), 0.0013, BC, 4);
    rod(gp, P(0, false), P(1 / nb, true), 0.0012, BC, 4);
    rod(gp, P(1, false), P(1 - 1 / nb, true), 0.0012, BC, 4);
    for (let k = 1; k < nb; k++) {
      rod(gp, P(k / nb, false), P(k / nb, true), 0.0007, BC, 3);
      if (k < nb - 1) rod(gp, k < nb / 2 ? P(k / nb, true) : P((k + 1) / nb, true), k < nb / 2 ? P((k + 1) / nb, false) : P(k / nb, false), 0.0006, BC, 3);
    }
  }
  for (let k = 1; k < nb; k += 2) rod(gp, [RX - 0.015, DY + TH, bz0 + (bz1 - bz0) * (k / nb)], [RX + 0.015, DY + TH, bz0 + (bz1 - bz0) * (k / nb)], 0.0006, BC, 3);
  box(gp, '#a59f8e', RX - 0.032, y0, z1r - 0.02, 0.014, 0.022, 0.014);
  gable(gp, 0.018, 0.006, 0.018, '#5a6a4a', RX - 0.032, y0 + 0.022, z1r - 0.02);
  trooper(gp, RX - 0.032, y0, z1r - 0.004, 0.026, 0.3, { top: C.olive, bottom: C.olive, hat: C.olive, hatStyle: 'cap', hatBadge: '#b0302a', detail: 'lo', gunMode: 'order' });

  // the first tower crane (faded yellow lattice mast, jib, counter-jib) over a rising concrete frame
  const YC = '#c4a24a', CX = -0.1, CZ = -0.27, MH = 0.25, a = 0.0065, ns = 16, cy0 = y0 + 0.006;
  box(gp, '#8d8a83', CX, y0, CZ, 0.03, 0.006, 0.03);
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const cr = (i: number, c: [number, number]): V3 => [CX + c[0] * a, cy0 + (MH * i) / ns, CZ + c[1] * a];
  for (const c of corners) rod(gp, cr(0, c), cr(ns, c), 0.0008, YC, 4);
  for (let i = 0; i < ns; i++) for (let k = 0; k < 4; k++) {
    const A = corners[k], B = corners[(k + 1) % 4];
    rod(gp, cr(i, A), cr(i, B), 0.00045, YC, 3);
    rod(gp, cr(i, i % 2 ? A : B), cr(i + 1, i % 2 ? B : A), 0.00045, YC, 3);
  }
  const TY = cy0 + MH, apex: V3 = [CX, TY + 0.042, CZ];
  cyl(gp, '#8a7a4a', CX, TY, CZ, 0.009, 0.004, 10);
  for (const c of corners) rod(gp, [CX + c[0] * a, TY + 0.004, CZ + c[1] * a], apex, 0.0006, YC, 3);
  box(gp, '#d9d2bb', CX + 0.004, TY + 0.004, CZ + 0.011, 0.01, 0.011, 0.01);
  box(gp, '#3a4650', CX + 0.004, TY + 0.008, CZ + 0.0162, 0.008, 0.005, 0.0006);
  const JY = TY + 0.006, JL = 0.2, nj = 16, J0 = CX + a;
  const jb = (t: number, s: number): V3 => [J0 + JL * t, JY, CZ + s * 0.0042];
  const jt = (t: number): V3 => [J0 + JL * t, JY + 0.011 * (1 - t * 0.45), CZ];
  for (const s of [-1, 1]) rod(gp, jb(0, s), jb(1, s), 0.0006, YC, 4);
  rod(gp, jt(0), jt(1), 0.0006, YC, 4);
  for (let i = 0; i < nj; i++) {
    const t0 = i / nj, t1 = (i + 1) / nj;
    for (const s of [-1, 1]) { rod(gp, jb(t0, s), jt(t1), 0.0004, YC, 3); rod(gp, jt(t1), jb(t1, s), 0.0004, YC, 3); }
    rod(gp, jb(t0, -1), jb(t0, 1), 0.0004, YC, 3);
  }
  const KL = 0.07;
  for (const s of [-1, 1]) rod(gp, [CX - a, JY, CZ + s * 0.005], [CX - a - KL, JY, CZ + s * 0.005], 0.0007, YC, 4);
  for (let k = 0; k <= 5; k++) rod(gp, [CX - a - (KL * k) / 5, JY, CZ - 0.005], [CX - a - (KL * k) / 5, JY, CZ + 0.005], 0.0004, YC, 3);
  box(gp, '#8e8b84', CX - a - KL + 0.008, JY - 0.014, CZ, 0.014, 0.016, 0.012);
  box(gp, '#6b6a5e', CX - a - 0.03, JY + 0.0005, CZ, 0.016, 0.007, 0.009);
  rod(gp, apex, jt(0.62), 0.0004, '#55524a', 3);
  rod(gp, apex, [CX - a - KL + 0.006, JY + 0.002, CZ], 0.0004, '#55524a', 3);
  const trol = J0 + JL * 0.58;
  box(gp, '#6b6a5e', trol, JY - 0.004, CZ, 0.008, 0.004, 0.01);
  rod(gp, [trol, JY - 0.004, CZ], [trol, y0 + 0.078, CZ], 0.0003, '#2f2f2f', 3);
  box(gp, '#3a3a38', trol, y0 + 0.074, CZ, 0.004, 0.004, 0.003);
  for (let k = 0; k < 6; k++) rod(gp, [trol - 0.022, y0 + 0.064 + (k % 3) * 0.0015, CZ - 0.003 + Math.floor(k / 3) * 0.006], [trol + 0.022, y0 + 0.064 + (k % 3) * 0.0015, CZ - 0.003 + Math.floor(k / 3) * 0.006], 0.0006, '#5b4636', 3);
  for (const s of [-1, 1]) rod(gp, [trol, y0 + 0.074, CZ], [trol + s * 0.016, y0 + 0.066, CZ], 0.0002, '#2f2f2f', 3);
  // the concrete frame going up under the jib, brick stacks, a Jiefang truck, workers in rattan helmets
  const FX0 = -0.03, FX1 = 0.1, FZ0 = -0.31, FZ1 = -0.235, FS = 0.028, CC = '#aaa69c';
  box(gp, '#86704f', (FX0 + FX1) / 2, y0, (FZ0 + FZ1) / 2, FX1 - FX0 + 0.03, 0.0012, FZ1 - FZ0 + 0.03);
  for (let f = 0; f < 3; f++) {
    for (let i = 0; i < 4; i++) for (const z of [FZ0, (FZ0 + FZ1) / 2, FZ1]) {
      const x = FX0 + (i * (FX1 - FX0)) / 3;
      if (f === 2 && (i > 1 || z === FZ0)) { rod(gp, [x, y0 + 2 * FS + 0.003, z], [x, y0 + 2 * FS + 0.014, z], 0.0004, '#5b4636', 3); continue; }
      box(gp, CC, x, y0 + f * FS + (f ? 0.003 : 0), z, 0.0036, FS - (f ? 0.003 : 0), 0.0036);
    }
    if (f < 2) box(gp, CC, (FX0 + FX1) / 2, y0 + (f + 1) * FS, (FZ0 + FZ1) / 2, FX1 - FX0 + 0.006, 0.003, FZ1 - FZ0 + 0.006);
  }
  for (const [x, z] of [[0.13, -0.27], [0.135, -0.24], [-0.05, -0.2]] as [number, number][]) box(gp, '#9a5a42', x, y0, z, 0.016, 0.008, 0.01);
  {
    const q = grp(gp, 0.0, -0.175, Math.PI / 2 + 0.1, y0), TC = '#4b5a3c';
    for (const z of [-0.016, 0.018]) for (const sx of [-1, 1]) cyl(q, '#262626', sx * 0.008, 0.003, z, 0.003, 0.003, 8).rotation.z = Math.PI / 2;
    box(q, TC, 0, 0.004, 0.017, 0.016, 0.011, 0.014);
    box(q, '#2f3538', 0, 0.01, 0.0242, 0.013, 0.004, 0.0006);
    box(q, shade(TC, 0.9), 0, 0.004, -0.008, 0.018, 0.008, 0.034);
    box(q, '#9a5a42', 0, 0.012, -0.008, 0.015, 0.004, 0.03);
  }
  const WK: Partial<HumanOpts> = { top: '#3c4e6b', bottom: '#33404f', hat: '#c9a65a', hatStyle: 'helmet', detail: 'lo' };
  const hp = 0.026;
  human(gp, 0.02, y0 + FS + 0.003, -0.25, { ...WK, h: hp, pose: 'carry', ry: 0.4 } as HumanOpts);
  human(gp, 0.07, y0 + 2 * FS + 0.003, -0.26, { ...WK, h: hp, pose: 'point', ry: -0.6 } as HumanOpts);
  human(gp, 0.12, y0, -0.255, { ...WK, h: hp, pose: 'reach', ry: -1.2, top: '#d6d2c6' } as HumanOpts);

  // the billboard 「时间就是金钱 效率就是生命」: white board, red characters, bamboo scaffold and the sign-painters
  const bb = grp(gp, 0.15, -0.05, -0.12, y0), BW = 0.17, BH = 0.054, BY = 0.045;
  for (const sx of [-0.07, -0.025, 0.025, 0.07]) {
    box(bb, '#6b6660', sx, 0, -0.004, 0.004, BY + BH, 0.004);
    rod(bb, [sx, BY + BH * 0.6, -0.006], [sx, 0, -0.04], 0.0012, '#6b6660', 4);
  }
  box(bb, '#e9e7df', 0, BY, 0, BW, BH, 0.003);
  box(bb, '#a8302a', 0, BY - 0.002, 0, BW + 0.004, 0.002, 0.0036);
  box(bb, '#a8302a', 0, BY + BH, 0, BW + 0.004, 0.002, 0.0036);
  for (let r2 = 0; r2 < 2; r2++) for (let k = 0; k < 6; k++) glyph(bb, -0.0675 + k * 0.027, BY + BH / 2 + 0.0125 - r2 * 0.025, 0.0019, 0.02, 600 + r2 * 6 + k, '#b8302a', 0.15);
  const BAM = '#b59a62';
  for (const x of [0.026, 0.056, 0.086]) for (const z of [0.012, 0.03]) rod(bb, [x, 0, z], [x, BY + BH + 0.012, z], 0.0008, BAM, 4);
  for (const y of [BY - 0.004, BY + 0.024]) {
    for (const z of [0.012, 0.03]) rod(bb, [0.022, y, z], [0.09, y, z], 0.0006, BAM, 3);
    box(bb, '#8a7350', 0.056, y, 0.021, 0.066, 0.0012, 0.014);
  }
  rod(bb, [0.026, 0.002, 0.012], [0.086, BY + BH, 0.012], 0.0005, BAM, 3);
  human(bb, 0.046, BY - 0.0028, 0.021, { h: hp, top: '#d6d2c6', bottom: '#33404f', hair: '#1f1b18', pose: 'reach', ry: Math.PI, detail: 'lo' });
  human(bb, 0.072, BY + 0.0252, 0.022, { h: hp, top: '#3c4e6b', bottom: '#33404f', hat: '#d6cfb6', hatStyle: 'cap', pose: 'reach', ry: Math.PI + 0.3, detail: 'lo' });
  human(bb, -0.01, 0, 0.05, { h: hp, top: '#5a6068', bottom: '#2f3338', hair: '#1f1b18', pose: 'point', ry: Math.PI - 0.5, detail: 'lo' });
  human(bb, 0.105, 0, 0.04, { h: hp, top: '#3c4e6b', bottom: '#33404f', hat: '#c9a65a', hatStyle: 'helmet', pose: 'carry', ry: -0.8, detail: 'lo' });

  // villagers: net menders, a fisherwoman with a carrying pole, a cyclist
  const VI: Partial<HumanOpts> = { bottom: '#2f3338', hat: '#b7a271', hatStyle: 'conical', detail: 'lo' };
  human(gp, 0.0, y0, 0.09, { ...VI, h: hp, top: '#46505a', pose: 'sitGround', ry: 0.2 } as HumanOpts);
  human(gp, 0.04, y0, 0.085, { ...VI, h: hp, top: '#5a5f66', pose: 'sitGround', ry: -0.5 } as HumanOpts);
  const fw = human(gp, -0.17, y0, 0.06, { ...VI, h: hp, top: '#3e4f6a', pose: 'carry', ry: 1.4 } as HumanOpts);
  rod(gp, [fw.head[0], fw.head[1] - hp * 0.16, fw.head[2] - 0.016], [fw.head[0], fw.head[1] - hp * 0.16, fw.head[2] + 0.016], 0.0005, BAM, 3);
  for (const s of [-1, 1]) cyl(gp, '#8a7350', fw.head[0], y0 + 0.004, fw.head[2] + s * 0.016, 0.004, 0.005, 6);
  human(gp, -0.25, y0, 0.0, { h: hp, top: '#d6d2c6', bottom: '#33404f', hair: '#1f1b18', pose: 'walk', ry: 0.3, detail: 'lo' });
  human(gp, -0.06, y0, -0.1, { h: hp * 0.75, top: '#a8443a', bottom: '#33404f', hair: '#1f1b18', pose: 'run', ry: 1.0, detail: 'lo' });
};

// ---- 8. Lop Nur 596 ----------------------------------------------------------------------------------------------------

// 两弹一星 — China's first atomic test "596", 16 Oct 1964, Lop Nur: the 102 m steel test tower (铁塔) with the device
// room on top, the rising mushroom cloud, the observation bunker, effect-test targets (tank, aircraft, house), PLA soldiers
// and scientists cheering in the Gobi — ref. Baidu Baike 中国第一颗原子弹爆炸 / 596铁塔, Wikipedia "596 (nuclear test)"
// and the Xinhua photographs of 1964. Default is a composite (tower + cloud); r.style 'tower' = before the shot only,
// 'blast' = the cloud rising over the destroyed tower stump.
const st_lopnur: Builder = (gp, r) => {
  const mode = r.style === 'tower' ? 'tower' : r.style === 'blast' ? 'blast' : 'both';
  const TX = -0.11, TZ = -0.03, KX = mode === 'blast' ? TX : 0.19, KZ = mode === 'blast' ? TZ : -0.25;
  const y0 = ground(gp, '#a89878', '#77684f', (x, _y, z) => {
    if (mode !== 'tower') { const d = Math.hypot(x - KX, z - KZ); if (d < 0.07) return d < 0.04 ? '#5f5446' : '#7d6f58'; }
    if (Math.abs(z - 0.2 - 0.04 * Math.sin(x * 6)) < 0.004 && x < 0.18) return '#8f8164';
    if (Math.abs(x - TX - (z - TZ) * 0.1) < 0.003 && z > TZ) return '#968868';
    return gravel('#a89878', 21)(x, _y, z, 0, 1, 0);
  });

  // the 596 tower: four tapering steel legs, ring girders and X-bracing; device room and hoist on top
  const ST = '#4e5256', H = 0.27, b0 = 0.024, b1 = 0.0075, nl = 18;
  const legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const lp = (i: number, c: [number, number]): V3 => { const t = i / nl, hw = b0 + (b1 - b0) * t; return [TX + c[0] * hw, y0 + H * t, TZ + c[1] * hw]; };
  if (mode !== 'blast') {
    for (const c of legs) { box(gp, '#9a968c', TX + c[0] * b0, y0, TZ + c[1] * b0, 0.008, 0.004, 0.008); rod(gp, lp(0, c), lp(nl, c), 0.0011, ST, 5); }
    for (let i = 0; i < nl; i++) for (let k = 0; k < 4; k++) {
      const A = legs[k], B = legs[(k + 1) % 4];
      rod(gp, lp(i + 1, A), lp(i + 1, B), 0.0005, ST, 3);
      rod(gp, lp(i, A), lp(i + 1, B), 0.00035, ST, 3);
      rod(gp, lp(i, B), lp(i + 1, A), 0.00035, ST, 3);
    }
    for (let i = 0; i < nl; i++) rod(gp, [TX, y0 + (H * i) / nl, TZ + b0 * 0.3], [TX, y0 + (H * (i + 1)) / nl, TZ + b0 * 0.3], 0.0004, '#3c3f42', 3);
    const yt = y0 + H;
    box(gp, '#5a5d60', TX, yt, TZ, 0.026, 0.002, 0.026);
    for (const c of legs) cyl(gp, ST, TX + c[0] * 0.012, yt + 0.002, TZ + c[1] * 0.012, 0.0004, 0.006, 3);
    for (let k = 0; k < 4; k++) { const A = legs[k], B = legs[(k + 1) % 4]; rod(gp, [TX + A[0] * 0.012, yt + 0.008, TZ + A[1] * 0.012], [TX + B[0] * 0.012, yt + 0.008, TZ + B[1] * 0.012], 0.0003, ST, 3); }
    pbox(gp, '#8a8c86', TX, yt + 0.002, TZ - 0.002, 0.016, 0.014, 0.016, (_x, y, _z, _nx, ny) => (ny > 0.5 ? '#6e706b' : Math.floor(y / 0.0018) % 2 ? '#80827c' : null), [3, 6, 3]);
    box(gp, '#3a3d40', TX, yt + 0.006, TZ + 0.0062, 0.004, 0.007, 0.0008);
    rod(gp, [TX - 0.006, yt + 0.016, TZ - 0.002], [TX + 0.02, yt + 0.016, TZ - 0.002], 0.0006, ST, 3);
    rod(gp, [TX - 0.006, yt + 0.016, TZ - 0.002], [TX - 0.006, yt + 0.022, TZ - 0.002], 0.0005, ST, 3);
    rod(gp, [TX + 0.02, yt + 0.016, TZ - 0.002], [TX + 0.02, y0 + 0.1, TZ - 0.002], 0.00018, '#2f2f2f', 3);
    // the cable trench and instrument huts ringing the tower
    box(gp, '#8e8a7e', TX + 0.03, y0, TZ + 0.03, 0.022, 0.014, 0.016);
    gable(gp, 0.026, 0.005, 0.02, '#6a6c66', TX + 0.03, y0 + 0.014, TZ + 0.03);
  } else {
    for (const [k, c] of legs.entries()) { box(gp, '#5a5048', TX + c[0] * b0, y0, TZ + c[1] * b0, 0.008, 0.004, 0.008); strut(gp, [TX + c[0] * b0, y0, TZ + c[1] * b0], [TX + c[0] * b0 * (1.6 + k * 0.2), y0 + 0.012 + k * 0.004, TZ + c[1] * b0 * 1.3], 0.0012, 0.0006, '#3b3633', 4); }
  }
  // instrument posts on a ring round ground zero
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + 0.3, rr = 0.13 + (k % 2) * 0.03, x = TX + Math.cos(a) * rr, z = TZ + Math.sin(a) * rr * 0.8;
    if (x * x + z * z < 0.4 * 0.4 && Math.hypot(x - KX, z - KZ) > 0.1) { cyl(gp, '#6a6660', x, y0, z, 0.0008, 0.016, 4); box(gp, '#d8d4c6', x, y0 + 0.014, z, 0.004, 0.004, 0.003); }
  }

  // the mushroom cloud: dusty stem, condensation collar, toroidal cap lit orange from the fireball beneath, base surge
  if (mode !== 'tower') {
    const ICO = new THREE.IcosahedronGeometry(0.5, 1);
    const puff = (x: number, y: number, z: number, s: number, c: string, sy = 1) => add(gp, ICO, mat(c), x, y, z, s, s * sy, s, hash3(x * 99, y * 99, z * 99) * TAU);
    const HC = 0.39, RT = 0.064, jit = (k: number, n: number) => (hash3(k, n, 13) - 0.5);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * TAU + jit(k, 4), rr = 0.03 + Math.abs(jit(k, 1)) * 0.11;
      puff(KX + Math.cos(a) * rr, y0 + 0.004, KZ + Math.sin(a) * rr * 0.9, 0.07 + jit(k, 2) * 0.03, mix('#c4b18e', '#b19c78', hash3(k, 3, 13)), 0.32);
    }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; puff(KX + Math.cos(a) * 0.022, y0 + 0.02, KZ + Math.sin(a) * 0.022, 0.06, '#a8916e', 0.6); }
    const nS = 26, top = HC - 0.04;
    for (let i = 0; i <= nS; i++) {
      const t = i / nS, y = y0 + 0.035 + (top - 0.035) * t, s = 0.036 + 0.008 * t + (t > 0.8 ? (t - 0.8) * 0.3 : 0) + (t < 0.12 ? (0.12 - t) * 0.25 : 0);
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * TAU + i * 2.39, rr = 0.004 + Math.abs(jit(i, j)) * 0.008;
        puff(KX + Math.cos(a) * rr, y + jit(i, j + 9) * 0.008, KZ + Math.sin(a) * rr, s * (0.8 + jit(i, j + 5) * 0.3), shade(mix('#957c5e', '#cbb9a0', t ** 0.8), 0.95 + hash3(i, j, 17) * 0.1));
      }
    }
    add(gp, ICO, mat('#e07a3a', { emissive: '#9a3e16' }), KX, y0 + HC - 0.022, KZ, 0.1, 0.045, 0.1);
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU, rr = RT + jit(k, 7) * 0.012, x = KX + Math.cos(a) * rr, z = KZ + Math.sin(a) * rr;
      puff(x, y0 + HC - 0.012 + jit(k, 8) * 0.01, z, 0.058 + jit(k, 9) * 0.014, mix('#b7835a', '#c99a6e', hash3(k, 10, 13)));
      puff(x * 0.7 + KX * 0.3, y0 + HC + 0.02 + jit(k, 11) * 0.01, z * 0.7 + KZ * 0.3, 0.06 + jit(k, 12) * 0.014, mix('#ddd3c3', '#e8e0d2', hash3(k, 14, 13)));
    }
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; puff(KX + Math.cos(a) * 0.028, y0 + HC + 0.045, KZ + Math.sin(a) * 0.028, 0.055, '#ece5d8'); }
    puff(KX, y0 + HC + 0.058, KZ, 0.06, '#f0eadf');
  }

  // effect-test targets: a tank, a jet fighter, a brick house
  {
    const q = grp(gp, -0.29, 0.1, 0.7, y0), TC = '#4b5238';
    for (const sx of [-1, 1]) box(q, '#2f302c', sx * 0.011, 0, 0, 0.007, 0.008, 0.044);
    box(q, TC, 0, 0.005, 0, 0.022, 0.007, 0.04);
    ball(q, shade(TC, 1.05), 0, 0.012, -0.004, 0.02, 0.01, 0.022);
    rod(q, [0, 0.016, 0.004], [0, 0.017, 0.036], 0.0011, TC, 5);
  }
  {
    const q = grp(gp, 0.03, 0.05, 2.3, y0 + 0.002), AC = '#9a9c98';
    for (const [x, z] of [[0, 0.016], [-0.008, -0.004], [0.008, -0.004]]) cyl(q, '#2f2f2f', x, 0, z, 0.0009, 0.004, 4);
    strut(q, [0, 0.008, 0.026], [0, 0.008, -0.03], 0.0035, 0.002, AC, 8);
    for (const s of [-1, 1]) {
      box(q, AC, s * 0.014, 0.0065, -0.004, 0.026, 0.0012, 0.012);
      box(q, AC, s * 0.006, 0.0085, -0.029, 0.011, 0.001, 0.006);
    }
    box(q, AC, 0, 0.009, -0.028, 0.001, 0.012, 0.008);
    ball(q, '#3a4650', 0, 0.011, 0.014, 0.004, 0.004, 0.008);
  }
  house(gp, -0.32, y0, -0.17, 0.05, 0.034, 0.024, 0.3, '#9a5a42', '#5d6063', 0.012);
  // the observation bunker: earth-banked concrete, slit facing the tower, a red flag; the crowd cheering on top
  {
    const q = grp(gp, 0.21, 0.17, -0.6, y0);
    ball(q, '#a08d6b', 0, 0, -0.004, 0.17, 0.05, 0.1);
    box(q, '#9b978d', 0, 0, 0, 0.11, 0.024, 0.06);
    box(q, '#8a867d', 0, 0.024, 0, 0.116, 0.004, 0.066);
    box(q, '#2e2c2a', 0, 0.014, -0.0302, 0.07, 0.005, 0.001);
    box(q, '#8a867d', 0.03, 0, 0.03, 0.02, 0.016, 0.014);
    box(q, '#3a3633', 0.03, 0, 0.0372, 0.008, 0.012, 0.001);
    flag(q, -0.045, 0.028, 0.0, 0.06, 0.045, 0.03, (u, v) => {
      const X = u * 1.5, Y = v;
      const star = (cx: number, cy: number, R: number) => {
        const dx = X - cx, dy = cy - Y, rr = Math.hypot(dx, dy);
        if (rr > R) return false;
        const sec = TAU / 5, a = (((Math.atan2(dx, dy) % sec) + sec) % sec) - sec / 2, t = Math.abs(a) / (sec / 2);
        return rr < R * (1 - t) + R * 0.38 * t;
      };
      return star(0.25, 0.25, 0.15) || star(0.5, 0.1, 0.05) || star(0.6, 0.2, 0.05) || star(0.6, 0.35, 0.05) || star(0.5, 0.45, 0.05) ? '#e6c03a' : '#b8302a';
    }, 0.3, 24, 16, '#4a4a48', 0.0011);
    const SO: Partial<HumanOpts> = { top: C.olive, bottom: C.olive, hat: C.olive, hatStyle: 'cap', hatBadge: '#b0302a', detail: 'lo' };
    const SC: Partial<HumanOpts> = { top: '#4f5b6b', bottom: '#454f5c', hair: '#1f1b18', detail: 'lo' };
    const hp = 0.03, ty = 0.028;
    human(q, -0.025, ty, 0.005, { ...SO, h: hp, pose: 'cheer', ry: 2.8 } as HumanOpts);
    human(q, 0.0, ty, -0.01, { ...SC, h: hp, pose: 'cheer', ry: 3.0 } as HumanOpts);
    human(q, 0.025, ty, 0.008, { ...SC, h: hp, pose: 'wave', ry: 2.6, top: '#d8d6ce', dress: 'knee' } as HumanOpts);
    human(q, 0.045, ty, -0.012, { ...SO, h: hp, pose: 'photo', ry: 3.2 } as HumanOpts);
  }
  const SO: Partial<HumanOpts> = { top: C.olive, bottom: C.olive, hat: C.olive, hatStyle: 'cap', hatBadge: '#b0302a', detail: 'lo' };
  const hp = 0.03;
  human(gp, 0.08, y0, 0.24, { ...SO, h: hp, pose: 'cheer', ry: 2.7 } as HumanOpts);
  human(gp, 0.12, y0, 0.29, { ...SO, h: hp, pose: 'wave', ry: 3.3 } as HumanOpts);
  human(gp, 0.04, y0, 0.3, { top: '#5d6a7a', bottom: '#454f5c', hat: '#5d6a7a', hatStyle: 'peaked', h: hp, pose: 'point', ry: 3.6, detail: 'lo' });
  human(gp, -0.02, y0, 0.27, { top: '#4f5b6b', bottom: '#454f5c', hair: '#1f1b18', h: hp, pose: 'cheer', ry: 3.0, detail: 'lo' });
  // a GAZ-69 jeep on the track
  {
    const q = grp(gp, -0.14, 0.22, 1.2, y0), JC = '#5a6142';
    for (const z of [-0.011, 0.011]) for (const sx of [-1, 1]) cyl(q, '#262626', sx * 0.008, 0.0035, z, 0.0035, 0.003, 8).rotation.z = Math.PI / 2;
    box(q, JC, 0, 0.004, 0, 0.016, 0.008, 0.034);
    box(q, shade(JC, 0.92), 0, 0.012, -0.005, 0.015, 0.008, 0.018);
    box(q, '#2f3538', 0, 0.0125, 0.0045, 0.013, 0.006, 0.0006);
  }
};

export const SITES_B: Record<string, Builder> = { st_jiayuguan, st_shanhaiguan, st_canton, st_yuanmingyuan, st_wuchang, st_nanchang, st_shenzhen79, st_lopnur };
