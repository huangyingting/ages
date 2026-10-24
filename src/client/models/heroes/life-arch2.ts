import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, ellip, rod, strut, lathe, prism, skin, panel, archPath, tbox, gable,
  paintFaces, shade, mix, hash3, fbm, sweep, slab, tree, plinth, SITE,
} from '../prims.ts';
import { grp, minipine, proof, storey, hall, gourd } from '../timber.ts';
import { human } from '../human.ts';

// Realistic Chinese architecture dioramas, part 2 (lf_*). Front faces +z, base at y=0, footprint radius ≈0.47.

// ---------------------------------------------------------------------------------------------------------
// Shared kit

const TAU = Math.PI * 2;
const Y0 = 0.034;
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const C = {
  tile: '#4a4d52', white: '#ece8dc', ver: '#a8352a', wood: '#5a3a28', water: '#4f8496', stone: '#b9b2a2', gold: '#e2b23a',
  jade: '#2f7d6d', dark: '#2a211a', grass: '#6f8c4c', earth: '#6b5a44',
};
const ICO = () => g('la2:ico', () => new THREE.IcosahedronGeometry(1, 1));
function blob(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0): THREE.Mesh {
  return add(p, ICO(), mat(c), x, y, z, sx, sy, sz, ry);
}
function anim(p: THREE.Object3D, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}
/** The shared museum plinth (dark side, site-coloured top) whose top sits at the land height Y0. */
function ground(p: THREE.Object3D, top: string, paint?: Paint): number {
  return plinth(p, top, { R: 0.46, h: Y0, paint });
}
type HF = (x: number, z: number) => number;
/** Polar heightfield disc (hills, slopes, lake shores) painted per face; returns the surface height function. */
function land(p: THREE.Object3D, R: number, hf: HF, paint: Paint, nr = 22, ns = 80): HF {
  const Y = (x: number, z: number) => Y0 + hf(x, z) * (1 - sstep(0.86, 1, Math.hypot(x, z) / R));
  const pos: number[] = [0, Y(0, 0), 0];
  for (let i = 1; i <= nr; i++) for (let j = 0; j < ns; j++) {
    const a = (j / ns) * TAU, r = (R * i) / nr, x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, Y(x, z), z);
  }
  const V = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * ns + (j % ns));
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    const ax = pos[a * 3], az = pos[a * 3 + 2], bx = pos[b * 3] - ax, bz = pos[b * 3 + 2] - az, cx = pos[c * 3] - ax, cz = pos[c * 3 + 2] - az;
    if (bz * cx - bx * cz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  for (let j = 0; j < ns; j++) tri(0, V(1, j), V(1, j + 1));
  for (let i = 1; i < nr; i++) for (let j = 0; j < ns; j++) {
    const a = V(i, j), b = V(i, j + 1), c = V(i + 1, j), d = V(i + 1, j + 1);
    tri(a, b, d); tri(a, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  add(p, paintFaces(geo, '#7a8a5a', paint), mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
  return Y;
}
/** Regular n-gon prism / frustum (pagoda bodies, plinths) aligned with timber.ts proof() corners; optional face painter. */
function poly(p: THREE.Object3D, n: number, R0: number, R1: number, h: number, x: number, y: number, z: number, c: string, paint?: Paint, vs = 1, sub = 1): THREE.Mesh {
  const rot = Math.PI / n + Math.PI / 2, rings: V3[][] = [];
  for (let l = 0; l <= vs; l++) {
    const t = l / vs, R = R0 + (R1 - R0) * t, ring: V3[] = [];
    for (let i = 0; i < n; i++) for (let s = 0; s < sub; s++) {
      const u = s / sub, a0 = rot + (i / n) * TAU, a1 = rot + ((i + 1) / n) * TAU;
      ring.push([x + (Math.cos(a0) * (1 - u) + Math.cos(a1) * u) * R, y + t * h, z + (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * R]);
    }
    rings.push(ring);
  }
  return skin(p, rings, c, { caps: true, flat: true, paint });
}
/** Subdivided box with a per-face painter (brick, lattice, paving). Paint coords are local: y from 0..h. */
function pbox(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, h: number, d: number, paint: Paint, cell: number | [number, number, number] = 0.008, ry = 0): THREE.Mesh {
  const [cx, cy, cz] = typeof cell === 'number' ? [cell, cell, cell] : cell;
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / cx)), Math.max(1, Math.round(h / cy)), Math.max(1, Math.round(d / cz)));
  geo.translate(0, h / 2, 0);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1, ry);
}
/** Painted vertical panel facing +z (lattice fronts on walls): a single subdivided face at local z = dz instead of a thin box. */
function pfront(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, h: number, dz: number, paint: Paint, cell: number, ry = 0): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(h / cell)));
  geo.translate(0, h / 2, dz);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1, ry);
}
/** Painted horizontal surface (paving) — one subdivided top face instead of a whole subdivided box. Paint coords: x, z centred, y = 0. */
function ptop(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, d: number, paint: Paint, cx: number, cz = cx): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / cx)), Math.max(1, Math.round(d / cz)));
  geo.rotateX(-Math.PI / 2);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1);
}
/** Grey-tile gable roof (硬山) with concave slope, tile ribs, slightly upturned eaves and a ridge; ridge along local x. */
function groof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, c: string, ry = 0, ov = 0.012): number {
  const gr = grp(p, x, z, ry, y);
  const W = w + ov * 2, D = d / 2 + ov, N = 6, th = Math.max(0.003, d * 0.035), step = 0.0055;
  const nx = Math.max(2, Math.round(W / step));
  const prof: [number, number][] = [];
  for (let i = -N; i <= N; i++) {
    const v = Math.abs(i) / N;
    prof.push([(i / N) * D, h * (1 - v) ** 1.3 + (v > 0.7 ? h * 0.1 * ((v - 0.7) / 0.3) ** 2 : 0) - th * 0.5]);
  }
  const rings: V3[][] = [];
  for (let k = 0; k <= nx; k++) {
    const X = -W / 2 + (k / nx) * W;
    rings.push([...prof.map(([pz, py]) => [X, py, pz] as V3), ...prof.slice().reverse().map(([pz, py]) => [X, py - th, pz] as V3)]);
  }
  const rib = shade(c, 1.22), under = shade(c, 0.55);
  skin(gr, rings, c, {
    caps: true, flat: true,
    paint: (px, _py, _pz, nxx, ny) => (ny < -0.2 ? under : Math.abs(nxx) > 0.7 ? shade(c, 0.75) : Math.floor((px + W / 2) / step) % 2 ? rib : null),
  });
  box(gr, shade(c, 0.72), 0, h - th * 0.9, 0, W * 0.98, 0.008, 0.009);
  for (const sx of [-1, 1]) box(gr, shade(c, 0.72), sx * W * 0.49, h - th * 0.4, 0, 0.012, 0.01, 0.009, 0, 0, sx * 0.5);
  return y + h;
}
/** Lattice window / door panel painter for the +z face. */
const lattice = (bar: string, cols = 3, rows = 4): Paint => (x, y, _z, _nx, _ny, nz) =>
  nz < 0.5 ? null : (Math.floor((x + 10) / 0.006) % cols === 0 || Math.floor(y / 0.006) % rows === 0 ? bar : null);
/** Single-storey hall with grey gable roof: plinth, wall, optional lattice front & dark door. */
function house(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, ry: number,
  o: { wall?: string; roof?: string; front?: string; bar?: string; rh?: number; door?: string; col?: string } = {}): THREE.Group {
  const gr = grp(p, x, z, ry, y);
  const wall = o.wall ?? '#8f8d88';
  box(gr, shade(wall, 0.82), 0, 0, 0, w + 0.012, 0.01, d + 0.012);
  box(gr, wall, 0, 0.01, 0, w, h, d);
  if (o.front) {
    pfront(gr, o.front, 0, 0.01, d / 2 + 0.002, w * 0.84, h * 0.86, 0.002, lattice(o.bar ?? '#2b211b'), 0.006);
    box(gr, o.door ?? '#2a1d16', 0, 0.01, d / 2 + 0.0045, w * 0.13, h * 0.72, 0.002);
    const n = Math.max(2, Math.round(w / 0.05));
    for (let i = 0; i <= n; i++) cyl(gr, o.col ?? '#7a2a1f', -w * 0.43 + (i / n) * w * 0.86, 0.01, d / 2 + 0.006, 0.003, h, 5);
  }
  const rh = o.rh ?? d * 0.38;
  gable(gr, w, rh * 0.78, d, wall, 0, 0.01 + h, 0);
  groof(gr, 0, 0.01 + h, 0, w, d, rh, o.roof ?? C.tile);
  return gr;
}
/** Wall segment from (x0,z0) to (x1,z1) with a small tiled coping. */
function wallSeg(p: THREE.Object3D, x0: number, z0: number, x1: number, z1: number, y: number, h: number, c: string, cap = C.tile, t = 0.018): void {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), a = Math.atan2(-dz, dx), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  box(p, c, mx, y, mz, len, h, t, a);
  gable(p, len + 0.008, 0.012, t + 0.016, cap, mx, y + h, mz, a);
}
function lantern(p: THREE.Object3D, x: number, y: number, z: number, s = 0.012): void {
  add(p, g('la2:sph', () => new THREE.SphereGeometry(0.5, 10, 8)), mat('#e0402a', { emissive: '#b02010' }), x, y, z, s, s * 1.15, s);
  box(p, '#2a1d16', x, y + s * 0.55, z, s * 0.5, s * 0.2, s * 0.5);
}
/** Deciduous tree (shared natural clump), overall height ≈ 1.1·s. */
const leafy = (p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, _seed = 0) => tree(p, x, y, z, s * 0.78, c);
/** Weeping willow: the shared clump in the pale sage of willow foliage. */
const willow = (p: THREE.Object3D, x: number, y: number, z: number, s: number, _seed = 0) => tree(p, x, y, z, s * 0.72, '#7d8a52');
function bamboo(p: THREE.Object3D, x: number, y: number, z: number, s: number, n = 5, seed = 0): void {
  for (let i = 0; i < n; i++) {
    const a = seed + i * 2.4, d = s * 0.08 * Math.sqrt(i), bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    const tx = bx + Math.cos(a) * s * 0.12, tz = bz + Math.sin(a) * s * 0.12, th = s * (0.85 + hash3(i, seed, 2) * 0.3);
    rod(p, [bx, y, bz], [tx, y + th, tz], s * 0.012, i % 2 ? '#74804c' : '#66733f', 4);
    blob(p, i % 2 ? '#52663a' : '#5c7042', tx, y + th * 0.82, tz, s * 0.1, s * 0.2, s * 0.1, a);
  }
}
/** Paint helper: masonry courses with random brick shading and optional plaster patches. */
const brickPaint = (base: string, patch?: string, course = 0.0055): Paint => (x, y, z, _nx, ny) => {
  if (Math.abs(ny) > 0.6) return null;
  const c = Math.floor(y / course), a = Math.atan2(z, x);
  if (patch && fbm(a * 2.5 + 7, y * 22, 1.3) > 0.62) return patch;
  return shade(base, 0.9 + hash3(c, Math.floor(a * 9 + (c % 2) * 0.5), 3) * 0.2);
};
const ringPaint = (dark: string, n = 48): Paint => (x, _y, z, _nx, ny) =>
  Math.abs(ny) > 0.5 ? null : Math.floor(((Math.atan2(z, x) + TAU) / TAU) * n) % 2 ? dark : null;

interface XRoof {
  x?: number; z?: number; y: number; w: number; d: number; h: number;
  /** ridge half-length: 0 = pyramidal (攒尖), w/2-d/2 = hip (庑殿); with `gable` < 1 a hip-and-gable (歇山) */
  ridge: number; gable?: number; upto?: number; lift?: number; spanF?: number; k?: number; step?: number; nr?: number; th?: number;
  tile: string; rib?: string; eave?: string; under?: string; gableC?: string; ridgeC?: string; ridgeH?: number; hipR?: number;
}
/** Curved Chinese roof (庑殿 / 歇山 / 攒尖, or the lower skirt of a double-eave roof via `upto`) with tile ribs and ridges. */
function xroof(p: THREE.Object3D, o: XRoof): number {
  const X = o.x ?? 0, Z = o.z ?? 0, W = o.w, D = o.d, gb = o.gable ?? 1, upto = o.upto ?? 1, k = o.k ?? 0.6;
  const step = o.step ?? 0.0075, nr = o.nr ?? 7, lift = o.lift ?? 0.012, th = o.th ?? 0.005;
  const span = Math.min(W, D) * (o.spanF ?? 0.42);
  const hwAt = (t: number) => W / 2 - (W / 2 - o.ridge) * Math.min(1, t / gb);
  const hdAt = (t: number) => (D / 2) * (1 - t);
  const yAt = (t: number) => o.y + o.h * (t * (1 - k) + k * t * t);
  const nf = Math.max(2, Math.round(W / step)), ns = Math.max(2, Math.round(D / step));
  const P = (t: number, x: number, z: number, dy = 0): V3 => {
    const hw = hwAt(t), hd = hdAt(t), dc = Math.hypot(hw - Math.abs(x), hd - Math.abs(z));
    const c = Math.max(0, 1 - dc / span) ** 2 * Math.max(0, 1 - t / Math.max(0.3, gb)) ** 1.4, o2 = lift * 0.55 * c;
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
  const tile = o.tile, rib = o.rib ?? shade(tile, 1.14), ch = shade(tile, 0.88);
  const eave = o.eave ?? shade(tile, 0.62), under = o.under ?? shade(tile, 0.5), gc = o.gableC ?? eave;
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
  const rc = o.ridgeC ?? shade(tile, 0.8), hr = o.hipR ?? 0.003, tEnd = Math.min(gb, upto);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const st: { p: V3; w: number }[] = [];
    for (let i = 0; i <= 4; i++) { const t = (tEnd * i) / 4; st.push({ p: P(t, sx * hwAt(t), sz * hdAt(t), hr * 0.6), w: hr }); }
    sweep(p, st, rc, { radial: 5, sub: 2, flat: true });
  }
  const top = yAt(upto);
  if (upto >= 1 && o.ridge > 0.001) {
    const rh = o.ridgeH ?? 0.007;
    box(p, rc, X, top - rh * 0.3, Z, o.ridge * 2 + 0.006, rh, hr * 2.4);
    for (const sx of [-1, 1]) box(p, rc, X + sx * (o.ridge + 0.002), top - rh * 0.3, Z, 0.005, rh * 1.7, hr * 2.4, 0, 0, sx * 0.35);
  }
  return top;
}
/** Timber hall: walls set back behind a colonnade, painted architrave and an xroof ('hip' | 'xs' 歇山 | 'pyr' | 'xs2'/'hip2' double eave). */
function xhall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: {
  ry?: number; roof?: 'hip' | 'xs' | 'pyr' | 'xs2' | 'hip2'; tile: string; wall: string; col?: string; band?: string; front?: string; bar?: string;
  rh?: number; ov?: number; lift?: number; base?: string; baseH?: number; rib?: string; eave?: string; under?: string; ncol?: number;
}): number {
  const gr = grp(p, x, z, o.ry ?? 0, y);
  let yb = 0;
  if (o.baseH) { box(gr, o.base ?? '#a9a394', 0, 0, 0, w + 0.02, o.baseH, d + 0.02); yb = o.baseH; }
  const col = o.col ?? '#5a3a28', cr = Math.min(0.0036, w * 0.04);
  box(gr, o.wall, 0, yb, -0.002, w - 0.008, h, d - 0.012);
  if (o.front) pfront(gr, o.front, 0, yb, d / 2 - 0.0055, w - 0.012, h * 0.9, 0.0015, lattice(o.bar ?? '#2b211b'), 0.006);
  const n = o.ncol ?? Math.max(2, Math.round(w / 0.03));
  for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) cyl(gr, col, -w / 2 + (i / n) * w, yb, sz * (d / 2 - cr), cr, h, 6);
  const bh = Math.min(0.007, h * 0.16);
  box(gr, o.band ?? shade(col, 0.8), 0, yb + h - bh, 0, w + 0.003, bh, d + 0.003);
  const ov = o.ov ?? Math.min(0.02, d * 0.22), W = w + ov * 2, D = d + ov * 2, rh = o.rh ?? d * 0.45, kind = o.roof ?? 'xs';
  const rt = { tile: o.tile, rib: o.rib, eave: o.eave, under: o.under, lift: o.lift ?? Math.min(0.012, D * 0.12) };
  let top: number;
  if (kind === 'pyr') top = xroof(gr, { y: yb + h, w: W, d: D, h: rh, ridge: 0, ...rt });
  else if (kind === 'hip') top = xroof(gr, { y: yb + h, w: W, d: D, h: rh, ridge: Math.max(0.004, (W - D) / 2), ...rt });
  else if (kind === 'xs') top = xroof(gr, { y: yb + h, w: W, d: D, h: rh, ridge: Math.max(0.004, W / 2 - D * 0.3), gable: 0.5, ...rt });
  else {
    // double eave: a lower skirt round the hall, a short clerestory, then the upper roof
    xroof(gr, { y: yb + h, w: W, d: D, h: rh * 0.55, ridge: W / 2 - D / 2, upto: 0.5, ...rt });
    const w2 = w * 0.8, d2 = d * 0.7, y2 = yb + h + rh * 0.24;
    box(gr, o.wall, 0, y2, 0, w2, rh * 0.32, d2);
    box(gr, o.band ?? shade(col, 0.8), 0, y2 + rh * 0.32 - bh, 0, w2 + 0.003, bh, d2 + 0.003);
    const W2 = w2 + ov * 2, D2 = d2 + ov * 2;
    top = xroof(gr, { y: y2 + rh * 0.32, w: W2, d: D2, h: rh * 0.8, ridge: kind === 'xs2' ? W2 / 2 - D2 * 0.3 : Math.max(0.004, (W2 - D2) / 2), gable: kind === 'xs2' ? 0.5 : 1, ...rt });
  }
  return y + top;
}

// ---------------------------------------------------------------------------------------------------------
// 虎丘塔 — the leaning brick pagoda of Yunyan Temple on Tiger Hill, Suzhou (959–961). Ref: Baidu/zh.wikipedia 云岩寺塔:
// octagonal, 7 storeys, 47.7 m, brick imitating timber (corbelled eaves, 壶门 arched doors), leans ~3°59′ to the NNE,
// crown lost; reached up the hill through the Yuan-dynasty 二山门.

const lf_huqiu: Builder = gp => {
  ground(gp, SITE.grass);
  const hf: HF = (x, z) => {
    const r = Math.hypot(x, z), m = Math.max(0, 1 - r / 0.45);
    const n = (fbm(x * 8 + 3, 1, z * 8) - 0.5) * 0.07 * sstep(0.13, 0.2, r);
    return Math.min(0.13, 0.21 * m ** 1.3) + n * m;
  };
  const Y = land(gp, 0.444, hf, (x, _y, z, _nx, ny) => {
    const r = Math.hypot(x, z);
    if (r < 0.125) return hash3(Math.floor(x * 70), 0, Math.floor(z * 70)) > 0.5 ? '#b6ad9c' : '#a69d8c';
    if (Math.abs(x) < 0.03 && z > 0) return '#a39b8a';
    if (ny < 0.74 || fbm(x * 14, 2, z * 14) > 0.63) return mix('#8b857a', '#6a655c', hash3(x * 99, 1, z * 99));
    return mix(SITE.grass, shade(SITE.grass, 0.86), fbm(x * 10, 5, z * 10));
  });
  // stone steps up the front slope and the Yuan-dynasty second gate (二山门)
  for (let i = 0; i < 13; i++) {
    const z = 0.43 - i * 0.024, y = Y(0, z);
    box(gp, i % 2 ? '#aaa291' : '#9e9684', 0, y - 0.012, z, 0.05, 0.014, 0.026);
  }
  const yg = Y(0, 0.3) + 0.004;
  box(gp, '#9a927f', 0, Y(0, 0.36) - 0.01, 0.3, 0.15, yg - Y(0, 0.36) + 0.01, 0.075);
  hall(gp, 0, yg, 0.3, 0.13, 0.055, 0.038, '#4f5458', 0, '#d6cebc', { col: '#5a3a28', band: '#3d2c22', rh: 0.034, lift: 0.3 });
  box(gp, C.dark, 0, yg, 0.3 + 0.0285, 0.026, 0.03, 0.003);
  // the leaning tower: octagonal brick imitation of a timber pagoda, 7 storeys, finial long gone
  const tw = grp(gp, 0, -0.02, 0, Y0 + 0.13);
  tw.rotation.set(-0.055, 0, -0.035);
  poly(tw, 8, 0.118, 0.112, 0.022, 0, -0.01, 0, '#a59c8c');
  const brick = '#8f7c66', bp = brickPaint(brick, '#ada08a');
  let y = 0.012;
  for (let i = 0; i < 7; i++) {
    const R = 0.084 - i * 0.0046, h = i === 0 ? 0.072 : 0.056 - i * 0.0015;
    poly(tw, 8, R, R * 0.985, h, 0, y, 0, brick, bp, Math.max(2, Math.round(h / 0.0055)), 2);
    const ap = R * Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const va = (k * Math.PI) / 4 + Math.PI / 8, fa = (k * Math.PI) / 4, ry = Math.PI / 2 - fa;
      cyl(tw, '#ae9677', Math.cos(va) * R, y, Math.sin(va) * R, 0.0045, h, 6);
      const fx = Math.cos(fa) * ap, fz = Math.sin(fa) * ap;
      if ((k + i) % 2 === 0) {
        box(tw, '#b8a587', fx, y + h * 0.1, fz, R * 0.44, h * 0.66, 0.006, ry);
        box(tw, '#231b15', fx * 1.012, y + h * 0.12, fz * 1.012, R * 0.24, h * 0.4, 0.006, ry);
        ellip(tw, '#231b15', fx * 1.012, y + h * 0.52, fz * 1.012, R * 0.12, h * 0.16, 0.003, ry);
      } else box(tw, '#77634f', fx, y + h * 0.32, fz, R * 0.3, h * 0.34, 0.005, ry);
    }
    // brick bracket course, short corbelled eave, then the balcony (平座) of the next storey
    poly(tw, 8, R * 1.02, R * 1.08, 0.012, 0, y + h, 0, '#b49d7c', ringPaint('#6e5a45', 64), 1, 8);
    const ey = proof(tw, 0, y + h + 0.012, 0, { n: 8, R0: R * 1.3, R1: R * 0.97, h: 0.014, lift: 0.08, k: 0.25, tile: '#6a5c4c', rib: '#77685a', under: '#8a7862' });
    if (i < 6) {
      const Rn = 0.084 - (i + 1) * 0.0046;
      poly(tw, 8, Rn * 1.14, Rn * 1.16, 0.009, 0, ey - 0.002, 0, '#a89274', ringPaint('#7a6650', 64), 1, 8);
      y = ey + 0.007;
    } else {
      // truncated crown: a stub of broken brickwork with weeds
      poly(tw, 8, R * 0.95, R * 0.9, 0.016, 0, ey - 0.003, 0, brick, bp, 3, 2);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + 0.3;
        blob(tw, k % 3 ? shade(brick, 0.85) : '#5a6e40', Math.cos(a) * R * 0.7, ey + 0.014, Math.sin(a) * R * 0.7, 0.008 + (k % 3) * 0.003, 0.007, 0.008);
      }
    }
  }
  // trees and rocks of the hill
  for (let k = 0; k < 16; k++) {
    const a = k * 2.39 + 0.4, r = 0.19 + hash3(k, 2, 1) * 0.21, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 0.09 && z > 0.05) continue;
    if (k % 4 === 0) minipine(gp, x, Y(x, z) + 0.004, z, 0.1, '#2f5a32');
    else leafy(gp, x, Y(x, z) - 0.004, z, 0.075 + hash3(k, 1, 4) * 0.04, k % 3 ? '#4a6a38' : '#5a7440', k);
  }
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + 0.2, r = 0.16 + (k % 3) * 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r;
    blob(gp, '#8b857a', x, Y(x, z), z, 0.03, 0.018, 0.024, a);
  }
  human(gp, 0.012, Y(0, 0.4) - 0.005, 0.4, { h: 0.03, pose: 'walk', ry: Math.PI, top: '#4a5868', bottom: '#3a3128', hair: '#1c1714', detail: 'lo' });
  human(gp, -0.014, Y(0, 0.2) - 0.005, 0.2, { h: 0.03, pose: 'walk', phase: 0.5, ry: Math.PI, top: '#9a8a6a', bottom: '#4a3e2c', hair: '#1c1714', detail: 'lo', dress: 'ankle' });
};

// ---------------------------------------------------------------------------------------------------------
// 开封铁塔 — the "Iron Pagoda" of Youguo Temple, Kaifeng (1049). Ref: Baidu/zh.wikipedia 开封铁塔: octagonal, 13 storeys,
// 55.88 m, slender; brown "iron-coloured" glazed relief bricks, glazed brackets under short eaves, small doors alternating;
// stands on a stone terrace in today's Tieta Park among old trees. Ref: Commons "Iron Pagoda Park" (2025 photos).

const lf_tieta: Builder = gp => {
  ground(gp, SITE.grass);
  poly(gp, 8, 0.22, 0.22, 0.004, 0, 0.03, -0.07, '#aaa497');
  const pg = grp(gp, 0, -0.07, 0, 0.034);
  poly(pg, 8, 0.12, 0.115, 0.012, 0, 0, 0, '#a8a090');
  poly(pg, 8, 0.1, 0.096, 0.026, 0, 0.012, 0, '#b3ab9a', ringPaint('#9a9282', 32), 1, 4);
  const glaze = '#674330';
  const gpaint: Paint = (x, y, z, _nx, ny) => {
    if (Math.abs(ny) > 0.6) return null;
    const c = Math.floor(y / 0.0048), a = Math.atan2(z, x), b = Math.floor(a * 14 + (c % 2) * 0.5);
    const hsh = hash3(c, b, 7);
    return hsh > 0.86 ? '#7a4c2e' : hsh < 0.14 ? '#4a2c1a' : shade(glaze, 0.92 + hsh * 0.16);
  };
  let y = 0.038;
  for (let i = 0; i < 13; i++) {
    const R = 0.072 - i * 0.0019, h = i === 0 ? 0.06 : 0.04 - i * 0.0008;
    poly(pg, 8, R, R * 0.99, h, 0, y, 0, glaze, gpaint, Math.max(2, Math.round(h / 0.0048)), 3);
    const ap = R * Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const va = (k * Math.PI) / 4 + Math.PI / 8, fa = (k * Math.PI) / 4, ry = Math.PI / 2 - fa;
      cyl(pg, '#5c3420', Math.cos(va) * R, y, Math.sin(va) * R, 0.0035, h, 6);
      if ((k + i) % 2 === 0) {
        const fx = Math.cos(fa) * ap * 1.01, fz = Math.sin(fa) * ap * 1.01;
        box(pg, '#1f1510', fx, y + h * 0.2, fz, 0.013, h * 0.45, 0.004, ry);
        ellip(pg, '#1f1510', fx, y + h * 0.65, fz, 0.0065, 0.006, 0.002, ry);
      }
    }
    poly(pg, 8, R * 1.02, R * 1.06, 0.007, 0, y + h, 0, '#6e4329', ringPaint('#4a2a18', 64), 1, 8);
    y = proof(pg, 0, y + h + 0.007, 0, { n: 8, R0: R * 1.4, R1: R * 0.98, h: 0.011, lift: 0.18, tile: '#54321f', rib: '#6a4128', under: '#3e2416' }) + 0.002;
  }
  lathe(pg, [[0, 0], [0.03, 0], [0.034, 0.012], [0.022, 0.026], [0, 0.03]], '#5a3a24', 0, y - 0.002, 0, 8);
  gourd(pg, 0, y + 0.026, 0, 0.016, '#8a6a3a');
  // stone balustrade round the terrace, a paved path from the south and the stone stele
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * TAU + Math.PI / 8, a1 = a0 + TAU / 8, R = 0.215;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R - 0.07, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R - 0.07;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (mz > 0.1 && Math.abs(mx) < 0.03) continue;
    const ry = -Math.atan2(z1 - z0, x1 - x0), L = Math.hypot(x1 - x0, z1 - z0);
    box(gp, '#7e6152', mx, 0.034, mz, L, 0.013, 0.011, ry);
    box(gp, '#8f877a', mx, 0.047, mz, L, 0.004, 0.013, ry);
    cyl(gp, '#7a5d4e', x0, 0.034, z0, 0.008, 0.02, 6);
  }
  pbox(gp, SITE.paving, 0, 0.03, 0.31, 0.06, 0.005, 0.3, (x, _y, z, _nx, ny) => (ny < 0.5 ? null : hash3(Math.floor(x / 0.02), 4, Math.floor(z / 0.015)) > 0.5 ? '#aca69a' : '#9d978a'), 0.015);
  box(gp, '#8a8478', 0.13, 0.034, 0.22, 0.03, 0.01, 0.016);
  box(gp, '#9a958a', 0.13, 0.044, 0.22, 0.022, 0.05, 0.007);
  ellip(gp, '#9a958a', 0.13, 0.094, 0.22, 0.012, 0.008, 0.004);
  // the park: cypress rows along the approach, old pines and broadleaf trees behind
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = sx * 0.075, z = 0.24 + k * 0.075;
    tree(gp, x, 0.034, z, 0.055, '#3c5a3a', true);
  }
  for (const [x, z, s] of [[-0.33, -0.1, 0.1], [0.33, -0.12, 0.11], [-0.3, -0.28, 0.09], [0.28, -0.3, 0.1], [-0.3, 0.22, 0.09], [0.31, 0.24, 0.1]] as const) leafy(gp, x, 0.034, z, s, '#4f6a3c', x * 10);
  for (const [x, z] of [[-0.36, 0.06], [0.37, 0.05], [-0.18, 0.35], [0.2, 0.36]] as const) minipine(gp, x, 0.034, z, 0.1);
  human(gp, 0.02, 0.034, 0.36, { h: 0.028, pose: 'walk', ry: Math.PI, top: '#4a5868', bottom: '#2f2c2a', hair: '#1c1714', detail: 'lo' });
  human(gp, -0.04, 0.038, 0.1, { h: 0.028, pose: 'point', ry: Math.PI * 0.9, top: '#7a6a52', bottom: '#3a3128', hair: '#1c1714', detail: 'lo', dress: 'ankle' });
};

// ---------------------------------------------------------------------------------------------------------
// 岳麓书院 — Yuelu Academy, Changsha (founded 976; present buildings Ming–Qing). Ref: Baidu/zh.wikipedia 岳麓书院, 湖南大学
// site plan: central axis 赫曦台 (stage) → 大门 (悬山, "岳麓书院" plaque) → 二门 → 讲堂 (5-bay 歇山, open front) → 御书楼
// (double-eave 歇山); 教学斋/半学斋 dormitories flank the court; whitewashed walls, grey tile, bow-shaped 封火山墙, dark timber.

/** Hunan-style bow-topped fire gable (弓形封火山墙) in the local YZ plane at x, standing on y; d = building depth. */
function bowGable(p: THREE.Object3D, x: number, y: number, z: number, d: number, h: number, rise: number, wall: string, cap: string, ry = 0): void {
  const gr = grp(p, x, z, ry, y), D = d / 2 + 0.006, n = 14;
  const arc = (o: number) => Array.from({ length: n + 1 }, (_, i) => {
    const u = D - (i * 2 * D) / n;
    return [u, h + rise * Math.sin((Math.PI * i) / n) ** 0.85 + o] as [number, number];
  });
  const m = slab(gr, [[-D, 0], [D, 0], ...arc(0)], 0.008, wall, 0, false);
  m.rotation.y = Math.PI / 2;
  const c = slab(gr, [...arc(0.005), ...arc(-0.001).reverse()], 0.013, cap, 0, false);
  c.rotation.y = Math.PI / 2;
}
const lf_academy: Builder = gp => {
  ground(gp, SITE.grass);
  const wall = '#dcd7cb', tile = '#5d6266', col = '#7a3528', dark = '#33261e';
  const pave: Paint = (x, _y, z, _nx, ny) => (ny < 0.5 ? null : Math.abs(x) < 0.025 ? '#9a9488' : hash3(Math.floor(x / 0.02), 0, Math.floor(z / 0.02)) > 0.5 ? SITE.paving : '#a19c90');
  pbox(gp, SITE.paving, 0, 0.03, 0, 0.43, 0.004, 0.76, pave, 0.02);
  // lawns and clipped cypresses in the lecture-hall court
  for (const sx of [-1, 1]) {
    box(gp, SITE.grass, sx * 0.065, 0.034, -0.005, 0.07, 0.002, 0.08);
    tree(gp, sx * 0.065, 0.036, -0.005, 0.05, '#3e5a3a', true);
  }
  // compound wall (whitewash, grey coping); the gate hall sits in the front wall
  wallSeg(gp, -0.21, -0.39, 0.21, -0.39, Y0, 0.05, wall, tile, 0.012);
  for (const sx of [-1, 1]) {
    wallSeg(gp, sx * 0.21, -0.39, sx * 0.21, 0.2, Y0, 0.05, wall, tile, 0.012);
    wallSeg(gp, sx * 0.1, 0.2, sx * 0.21, 0.2, Y0, 0.05, wall, tile, 0.012);
  }
  // 赫曦台: an open stage facing the gate, its back a white wall
  box(gp, '#a49c8b', 0, Y0, 0.34, 0.13, 0.016, 0.075);
  xhall(gp, 0, Y0 + 0.016, 0.34, 0.11, 0.06, 0.04, { ry: Math.PI, roof: 'xs', tile, wall: '#3b2c22', col, band: '#3e3a32', rh: 0.03 });
  box(gp, wall, 0, Y0 + 0.016, 0.366, 0.112, 0.04, 0.008);
  for (const sx of [-1, 1]) box(gp, wall, sx * 0.054, Y0 + 0.016, 0.34, 0.008, 0.04, 0.06);
  // 大门 (悬山) with the black-and-gold plaque, on a stepped base
  box(gp, '#a49c8b', 0, Y0, 0.2, 0.2, 0.012, 0.075);
  for (let i = 0; i < 3; i++) box(gp, '#a49c8b', 0, Y0, 0.244 + i * 0.008, 0.07, 0.012 - (i + 1) * 0.0035, 0.009);
  house(gp, 0, Y0 + 0.012, 0.2, 0.18, 0.055, 0.046, 0, { wall, roof: tile, rh: 0.026 });
  box(gp, dark, 0, Y0 + 0.022, 0.2 + 0.028, 0.03, 0.034, 0.002);
  box(gp, '#1c1a18', 0, Y0 + 0.06, 0.2 + 0.0285, 0.05, 0.011, 0.002);
  box(gp, '#b39248', 0, Y0 + 0.0635, 0.2 + 0.0295, 0.036, 0.004, 0.001);
  for (const sx of [-1, 1]) for (const c of [0, 1]) cyl(gp, col, sx * (0.03 + c * 0.05), Y0 + 0.012, 0.2 + 0.032, 0.0032, 0.046, 6);
  // 二门
  house(gp, 0, Y0 + 0.006, 0.06, 0.14, 0.045, 0.04, 0, { wall, roof: tile, rh: 0.022 });
  box(gp, '#a49c8b', 0, Y0, 0.06, 0.15, 0.006, 0.055);
  box(gp, dark, 0, Y0 + 0.016, 0.06 + 0.023, 0.026, 0.03, 0.002);
  // 教学斋 / 半学斋: long dormitory wings with bow gables, lattice fronts facing the court
  for (const sx of [-1, 1]) {
    const hg = house(gp, sx * 0.165, Y0, -0.04, 0.2, 0.055, 0.04, sx * -Math.PI / 2, { wall, roof: tile, front: '#5a3c2c', bar: '#2a1e17', col, rh: 0.024 });
    for (const ex of [-1, 1]) bowGable(hg, ex * 0.104, 0.01, 0, 0.055, 0.04, 0.032, wall, tile);
  }
  // 讲堂: five-bay 歇山 hall open to the court, white gable walls, plaque under the eave
  box(gp, '#a49c8b', 0, Y0, -0.15, 0.27, 0.018, 0.14);
  for (let i = 0; i < 3; i++) box(gp, '#a49c8b', 0, Y0, -0.074 + i * 0.008, 0.08, 0.018 - (i + 1) * 0.0055, 0.009);
  const yl = Y0 + 0.018;
  xhall(gp, 0, yl, -0.155, 0.23, 0.11, 0.052, { roof: 'xs', tile, wall: dark, col, band: '#3e3a32', rh: 0.04, ncol: 5 });
  for (const sx of [-1, 1]) box(gp, wall, sx * 0.112, yl, -0.16, 0.008, 0.052, 0.1);
  box(gp, '#1c1a18', 0, yl + 0.04, -0.1, 0.05, 0.01, 0.002);
  box(gp, '#b39248', 0, yl + 0.0435, -0.0988, 0.036, 0.004, 0.001);
  // 御书楼: two storeys, double eave
  const zl = -0.325;
  box(gp, '#a49c8b', 0, Y0, zl, 0.21, 0.014, 0.1);
  const y1 = Y0 + 0.014;
  box(gp, wall, 0, y1, zl, 0.18, 0.046, 0.07);
  pfront(gp, '#5a3c2c', 0, y1, zl + 0.0355, 0.12, 0.04, 0.001, lattice('#2a1e17'), 0.004);
  const ys = y1 + 0.046;
  xroof(gp, { z: zl, y: ys, w: 0.215, d: 0.105, h: 0.026, ridge: 0.215 / 2 - 0.105 / 2, upto: 0.5, tile, lift: 0.008 });
  xhall(gp, 0, ys + 0.008, zl, 0.15, 0.06, 0.036, { roof: 'xs', tile, wall: '#5a3c2c', front: '#5a3c2c', bar: '#2a1e17', col, band: '#3e3a32', rh: 0.034 });
  // camphor, pine and a muted maple outside the walls; scholars in long gowns
  for (const [x, z, c, s] of [[-0.31, 0.18, '#3f5c36', 0.12], [-0.32, -0.12, '#465f38', 0.13], [0.31, 0.16, '#425e37', 0.12], [0.32, -0.15, '#7a5236', 0.1], [-0.26, -0.33, '#3f5c36', 0.1], [0.27, -0.32, '#465f38', 0.1]] as const) leafy(gp, x, 0.034, z, s, c, x * 7 + z);
  for (const [x, z] of [[-0.17, 0.33], [0.17, 0.33]] as const) minipine(gp, x, 0.034, z, 0.08);
  for (const [x, z, t, ry, pose] of [[-0.04, 0.0, '#d8d0bc', 0.4, 'stand'], [0.035, -0.01, '#4a5466', -2.4, 'point'], [0.02, 0.28, '#5a5048', Math.PI, 'walk']] as const)
    human(gp, x, Y0, z, { h: 0.03, pose, ry, top: t, bottom: shade(t, 0.8), hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 登封观星台 — Gaocheng Observatory, Dengfeng (Guo Shoujing, 1276). Ref: zh.wikipedia 登封观星台 / Baidu 观星台: brick 覆斗 tower
// 9.46 m high, base ≈16 m, top ≈8 m square, a vertical slot (高表) in the north wall, two Ming rooms on top (total 12.62 m);
// the 量天尺 stone gnomon 31.2 m long × 0.53 m of 36 blue-stone slabs with twin water channels runs due north from the slot.

/** Four-sided frustum from bottom/top corner lists [x,z] (counter-clockwise) with an optional face painter. */
function frust(p: THREE.Object3D, bot: [number, number][], top: [number, number][], y: number, h: number, c: string, paint?: Paint, vs = 1): THREE.Mesh {
  const rings: V3[][] = [];
  for (let l = 0; l <= vs; l++) {
    const t = l / vs;
    rings.push(bot.map(([x, z], i) => [x + (top[i][0] - x) * t, y + h * t, z + (top[i][1] - z) * t] as V3));
  }
  return skin(p, rings, c, { caps: true, flat: true, paint });
}
const lf_guanxing: Builder = gp => {
  ground(gp, SITE.grass);
  const pave: Paint = (x, _y, z, _nx, ny) => (ny < 0.5 ? null : hash3(Math.floor(x / 0.016), 3, Math.floor(z / 0.011)) > 0.5 ? '#9c978c' : '#928d82');
  pbox(gp, SITE.paving, 0, Y0 - 0.001, 0.07, 0.12, 0.003, 0.74, pave, 0.011);
  pbox(gp, SITE.paving, 0, Y0 - 0.001, -0.24, 0.4, 0.003, 0.34, pave, 0.011);
  // the tower is turned so its north face (slot + 量天尺 gauge) faces the viewer, as in the classic photographs
  const gq = grp(gp, 0, 0, Math.PI, -0.005);
  gq.scale.setScalar(1.15);
  const brick = '#7f7a71', zc = 0.2, B = 0.11, T = 0.056, H = 0.135, gap = 0.024, sd = 0.03, y0 = 0.033;
  const bp: Paint = (x, yy, z, _nx, ny) => (Math.abs(ny) > 0.7 ? '#8e887c' : shade(brick, 0.9 + hash3(Math.floor(yy / 0.0045), Math.floor((x + z) / 0.014), 5) * 0.18));
  // the truncated-pyramid tower in two halves either side of the north slot, plus the block behind the slot
  for (const sx of [-1, 1]) {
    const q = (a: number, b: number): [number, number][] => [[sx * gap / 2, zc - a], [sx * b, zc - a], [sx * b, zc + a], [sx * gap / 2, zc + a]];
    frust(gq, q(B, B), q(T, T), y0, H, brick, bp, 20);
  }
  frust(gq, [[-gap / 2, zc - B + sd], [gap / 2, zc - B + sd], [gap / 2, zc + B], [-gap / 2, zc + B]], [[-gap / 2, zc - T + sd], [gap / 2, zc - T + sd], [gap / 2, zc + T], [-gap / 2, zc + T]], y0, H, shade(brick, 0.8), bp, 20);
  const top = y0 + H;
  // brick parapet round the top (open over the slot)
  for (const sx of [-1, 1]) {
    box(gq, '#9d958a', sx * (T - 0.003), top, zc, 0.006, 0.011, 2 * T);
    box(gq, '#9d958a', sx * (gap / 2 + (T - gap / 2) / 2), top, zc - T + 0.003, T - gap / 2, 0.011, 0.006);
  }
  box(gq, '#9d958a', 0, top, zc + T - 0.003, 2 * T, 0.011, 0.006);
  // two small flat-roofed brick rooms on top flanking the slot (arched windows, grey-tile coping), joined by the gnomon crossbar
  for (const sx of [-1, 1]) {
    const rx = sx * (gap / 2 + 0.021), rz = zc - T + 0.034, rb = '#9a8b72';
    pbox(gq, rb, rx, top, rz, 0.036, 0.034, 0.05, brickPaint(rb), 0.006);
    for (const fz of [-1, 1]) {
      box(gq, '#2a241e', rx, top + 0.016, rz + fz * 0.0255, 0.01, 0.01, 0.002);
      ellip(gq, '#2a241e', rx, top + 0.026, rz + fz * 0.0255, 0.005, 0.005, 0.001);
    }
    box(gq, '#5d6266', rx, top + 0.034, rz, 0.04, 0.004, 0.054);
    gable(gq, 0.04, 0.004, 0.054, '#5d6266', rx, top + 0.038, rz, 0);
  }
  box(gq, '#4a4038', 0, top + 0.028, zc - T + 0.012, gap + 0.012, 0.006, 0.008);
  // stairways: entrances on the north side, climbing south along the east and west faces to the top
  const faceX = (yy: number) => B - (B - T) * ((yy - y0) / H), sw = 0.024, N = 12, st = '#9e9789';
  for (const sx of [-1, 1]) for (let k = 0; k < N; k++) {
    const yt = y0 + (H * (k + 1)) / N, z = zc - B + 0.012 + ((k + 0.5) / N) * (2 * B - 0.024), len = (2 * B - 0.024) / N + 0.001;
    const x = sx * (faceX(yt) + sw / 2 - 0.003);
    box(gq, st, x, y0, z, sw, yt - y0, len);
    box(gq, '#a39b8e', x + sx * (sw / 2 - 0.003), yt, z, 0.006, 0.011, len);
  }
  // 量天尺: blue-stone gnomon bed starting inside the slot, with twin water channels and graduations
  const z0 = zc - B + sd - 0.004, L = 0.42, zm = z0 - L / 2;
  const gpaint: Paint = (x, _y, z, _nx, ny) => {
    if (ny < 0.5) return null;
    if (Math.abs(Math.abs(x) - 0.0055) < 0.0015) return '#3d4a52';
    return Math.floor((z0 - z) / 0.0117) % 2 ? '#8a8e8c' : (Math.abs((z0 - z) % 0.0117) < 0.0012 ? '#5a5e5c' : null);
  };
  pbox(gq, '#939795', 0, 0.033, zm, 0.018, 0.009, L, gpaint, 0.0015);
  box(gq, '#3d4a52', 0, 0.034, z0 - L + 0.004, 0.022, 0.009, 0.008);
  // the Tang 周公测景台: a stone gnomon pillar on a stepped base south of the tower
  box(gq, '#9a968a', 0.19, 0.033, 0.3, 0.034, 0.012, 0.034);
  tbox(gq, 0.024, 0.024, 0.016, 0.016, 0.014, '#a6a296', 0.19, 0.045, 0.3);
  box(gq, '#a6a296', 0.19, 0.059, 0.3, 0.008, 0.026, 0.008);
  // astronomers in Yuan robes: one kneeling to read the noon shadow on the scale, one on the tower
  human(gq, 0.022, 0.036, -0.08, { h: 0.026, pose: 'kneel', ry: -Math.PI / 2, top: '#6a5a44', bottom: '#4a3e30', hair: '#1c1714', hat: '#2a2622', hatStyle: 'cap', dress: 'ankle', detail: 'hi' });
  human(gq, -0.03, 0.036, -0.02, { h: 0.026, pose: 'point', ry: Math.PI * 0.15, top: '#4a4a52', bottom: '#3a3530', hair: '#1c1714', hat: '#2a2622', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  human(gq, 0.03, top, zc + 0.02, { h: 0.026, pose: 'stand', ry: Math.PI, top: '#5a4a3a', bottom: '#3a3128', hair: '#1c1714', hat: '#2a2622', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  // old cypresses of the temple courtyard
  for (const [x, z, s] of [[-0.3, 0.2, 0.12], [0.31, 0.22, 0.11], [-0.3, -0.16, 0.13], [0.31, -0.14, 0.12], [-0.2, -0.36, 0.1], [0.22, -0.35, 0.11], [-0.34, 0.03, 0.1], [0.35, 0.05, 0.1]] as const) {
    tree(gp, x, Y0, z, s * 0.85, '#3e5a3a', true);
  }
};

// ---------------------------------------------------------------------------------------------------------
// 妙应寺白塔 — the White Dagoba of Miaoying Temple, Beijing (Yuan 1279, by Araniko). Ref: zh.wikipedia / Baidu 妙应寺白塔,
// 中国大百科全书: 50.9 m; 2 m T-shaped terrace; 9 m three-tier base (wall + two 亚-plan sumeru); lotus seat and 5 vajra rings;
// whitewashed inverted-bowl body Ø18.4 m; 亚 neck; conical 13-ring spire; bronze canopy Ø9.7 m with 36 pierced plaques and
// 36 bells; 5 m gilt-bronze small stupa on top. The tower yard is walled in red with grey-tiled halls.

/** 亚-shaped plan: a square of half-size s with two-step recessed corners of depth k. */
function yaPlan(s: number, k: number): [number, number][] {
  const out: [number, number][] = [];
  const q: [number, number][] = [[s, s - 2 * k], [s - k, s - 2 * k], [s - k, s - k], [s - 2 * k, s - k], [s - 2 * k, s]];
  for (const [sx, sz, rev] of [[1, 1, false], [-1, 1, true], [-1, -1, false], [1, -1, true]] as const) {
    const pts = q.map(([a, b]) => [sx * a, sz * b] as [number, number]);
    out.push(...(rev ? pts.reverse() : pts));
  }
  return out;
}
/** 须弥座 on a 亚 plan: plinth, recessed waist (束腰) between mouldings, top cornice. */
function sumeru(p: THREE.Object3D, s: number, k: number, y: number, h: number, c: string): number {
  prism(p, yaPlan(s, k), y, h * 0.22, c);
  prism(p, yaPlan(s * 0.97, k * 0.97), y + h * 0.22, h * 0.1, shade(c, 0.95));
  prism(p, yaPlan(s * 0.92, k * 0.92), y + h * 0.32, h * 0.38, shade(c, 0.88));
  prism(p, yaPlan(s * 0.97, k * 0.97), y + h * 0.7, h * 0.1, shade(c, 0.95));
  prism(p, yaPlan(s * 1.01, k), y + h * 0.8, h * 0.2, c);
  return y + h;
}
const lf_baita: Builder = gp => {
  ground(gp, SITE.paving);
  const white = '#e0dccf', red = '#9a3a2c', tile = '#55585b', bronze = '#5e5844', gilt = '#c9a043';
  const pave: Paint = (x, _y, z, _nx, ny) => (ny < 0.5 ? null : hash3(Math.floor(x / 0.02), 1, Math.floor(z / 0.02)) > 0.5 ? '#b2ac9e' : null);
  pbox(gp, '#aaa496', 0, 0.03, 0, 0.62, 0.003, 0.62, pave, 0.02);
  // tower-yard enclosure: red walls with grey coping, small corner halls, the front hall
  for (const [x0, z0, x1, z1] of [[-0.3, -0.3, 0.3, -0.3], [-0.3, -0.3, -0.3, 0.3], [0.3, -0.3, 0.3, 0.3], [-0.3, 0.3, -0.1, 0.3], [0.1, 0.3, 0.3, 0.3]] as const) wallSeg(gp, x0, z0, x1, z1, 0.03, 0.048, red, tile, 0.016);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) xhall(gp, sx * 0.27, 0.03, sz * 0.27, 0.05, 0.05, 0.034, { roof: 'pyr', tile, wall: red, col: red, rh: 0.026 });
  xhall(gp, 0, 0.03, 0.3, 0.2, 0.06, 0.045, { roof: 'xs', tile, wall: red, col: '#7a2a20', band: '#3f6a5e', front: '#7a3a2a', bar: '#3a2a20', rh: 0.034, baseH: 0.01 });
  // T-shaped brick terrace with steps on its projecting front
  const sg = grp(gp, 0, -0.03);
  box(sg, '#c9c4b8', 0, 0.033, 0, 0.47, 0.026, 0.45);
  box(sg, '#c9c4b8', 0, 0.033, 0.25, 0.2, 0.026, 0.06);
  for (let i = 0; i < 3; i++) box(sg, '#bdb8ab', 0, 0.033, 0.288 + i * 0.008, 0.07, 0.026 - (i + 1) * 0.0068, 0.009);
  let y = 0.059;
  // three-tier base: plain wall, then two 亚-plan sumeru
  prism(sg, yaPlan(0.205, 0.03), y, 0.035, '#dad5c9');
  y = sumeru(sg, 0.19, 0.028, y + 0.035, 0.048, white);
  y = sumeru(sg, 0.165, 0.024, y, 0.048, white);
  // lotus seat and the five vajra rings
  const pet: [number, number][] = [[0, 0], [0.13, 0], [0.142, 0.006], [0.146, 0.013], [0.138, 0.02], [0.13, 0.022], [0, 0.022]];
  lathe(sg, pet, '#dcd8cc', 0, y, 0, 32);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    ellip(sg, '#e4e0d4', Math.cos(a) * 0.14, y + 0.012, Math.sin(a) * 0.14, 0.012, 0.01, 0.006, Math.PI / 2 - a);
  }
  y += 0.022;
  for (let i = 0; i < 5; i++) lathe(sg, [[0, 0], [0.122 - i * 0.002, 0], [0.126 - i * 0.002, 0.0025], [0.122 - i * 0.002, 0.005], [0, 0.005]], i % 2 ? '#d8d4c8' : white, 0, y + i * 0.005, 0, 32);
  y += 0.025;
  // the inverted-bowl body (塔肚): slightly flared foot, widest high up, broad flattened shoulders
  const bowl: [number, number][] = [[0, 0], [0.112, 0], [0.114, 0.012], [0.12, 0.04], [0.128, 0.075], [0.134, 0.105], [0.135, 0.12], [0.13, 0.138], [0.118, 0.152], [0.098, 0.162], [0.072, 0.168], [0, 0.17]];
  lathe(sg, bowl, white, 0, y, 0, 28);
  // the arched niche (眼光门) on the south face
  const ny = y + 0.07;
  box(sg, '#d9d4c8', 0, ny - 0.03, 0.127, 0.03, 0.044, 0.012);
  ellip(sg, '#d9d4c8', 0, ny + 0.014, 0.127, 0.015, 0.012, 0.006);
  y += 0.168;
  // 亚-plan neck sumeru carrying the spire
  y = sumeru(sg, 0.068, 0.012, y, 0.045, white);
  // conical spire of thirteen rings (十三天)
  const ring: [number, number][] = [[0, 0]];
  const sh = 0.165, dh = sh / 13;
  for (let k = 0; k < 13; k++) {
    const r = 0.058 - (0.024 * k) / 12, yy = k * dh;
    ring.push([r - 0.002, yy], [r + 0.002, yy + dh * 0.25], [r + 0.002, yy + dh * 0.7], [r - 0.002, yy + dh]);
  }
  ring.push([0.03, sh + 0.004], [0, sh + 0.004]);
  lathe(sg, ring, '#dfdbd0', 0, y, 0, 24);
  y += sh + 0.004;
  // bronze canopy (华盖) with a ring of pierced plaques (华鬘) and wind-bells
  lathe(sg, [[0, 0], [0.07, 0], [0.072, 0.006], [0.062, 0.016], [0.035, 0.026], [0, 0.03]], bronze, 0, y, 0, 36);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU, r = 0.069;
    box(sg, i % 2 ? '#6c6448' : '#78704f', Math.cos(a) * r, y - 0.019, Math.sin(a) * r, 0.011, 0.02, 0.003, Math.PI / 2 - a);
    if (i % 3 === 0) cone(sg, '#7a6c45', Math.cos(a) * (r + 0.002), y - 0.028, Math.sin(a) * (r + 0.002), 0.0035, 0.007, 6);
  }
  y += 0.028;
  // gilt-bronze small stupa (宝顶) on top
  lathe(sg, [[0, 0], [0.02, 0], [0.02, 0.006], [0.014, 0.008], [0.019, 0.022], [0.014, 0.033], [0.006, 0.036], [0.005, 0.048], [0.009, 0.052], [0.006, 0.062], [0, 0.072]], gilt, 0, y, 0, 16);
  // juniper trees and a few visitors
  for (const [x, z] of [[-0.266, 0.13], [0.266, 0.13], [-0.266, -0.1], [0.266, -0.1]] as const) {
    tree(gp, x, Y0, z, 0.07, '#3e5a3a', true);
  }
  human(gp, 0.06, 0.033, 0.4, { h: 0.032, pose: 'pray', ry: Math.PI, top: '#7a2a24', bottom: '#6a2620', hair: null, detail: 'lo', dress: 'ankle' });
  human(gp, -0.05, 0.033, 0.4, { h: 0.032, pose: 'walk', ry: Math.PI, top: '#4a5260', bottom: '#2f2c2a', hair: '#1c1714', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 承启楼 — the "king of tulou", Gaotou, Yongding, Fujian (Hakka, 1628–1709). Ref: Baidu/zh.wikipedia 承启楼, UNESCO 福建土楼:
// outer ring Ø ≈ 73 m, 4 storeys / 16.4 m of rammed earth on a stone footing, 72 rooms per floor, no windows on the lower two
// floors, wide grey-tile eaves; 2nd ring 2 storeys, 3rd ring 1 storey, ancestral hall in the centre; one granite arched gate.

/** Continuous ring roof (outer eave → ridge → inner eave) with radial tile ribs. */
function ringRoof(p: THREE.Object3D, Ro: number, Rr: number, Ri: number, y: number, h: number, tile: string, seg = 160): void {
  const circ = (R: number, yy: number): V3[] => Array.from({ length: seg }, (_, j) => [Math.cos((j / seg) * TAU) * R, yy, Math.sin((j / seg) * TAU) * R] as V3);
  const rib = shade(tile, 1.18);
  skin(p, [circ(Ro, y - 0.003), circ((Ro + Rr) / 2, y + h * 0.58), circ(Rr, y + h), circ((Rr + Ri) / 2, y + h * 0.55), circ(Ri, y - 0.003)], tile, {
    flat: true,
    paint: (x, _y, z, _nx, ny) => (ny < 0 ? shade(tile, 0.5) : Math.floor(((Math.atan2(z, x) + TAU) / TAU) * seg) % 2 ? rib : null),
  });
  lathe(p, [[Rr - 0.003, y + h - 0.002], [Rr + 0.003, y + h - 0.002], [Rr + 0.0025, y + h + 0.004], [Rr - 0.0025, y + h + 0.004], [Rr - 0.003, y + h - 0.002]], shade(tile, 0.75), 0, 0, 0, 64);
}
/** Cylindrical wall from y to y+h at radius R (optionally tapering by `taper`), painted per face. */
function ringWall(p: THREE.Object3D, R: number, y: number, h: number, c: string, paint: Paint, inward = false, seg = 120, vs = 12, taper = 0): void {
  const rings: V3[][] = [];
  for (let l = 0; l <= vs; l++) {
    const t = l / vs, r = R + taper * (1 - t);
    rings.push(Array.from({ length: seg }, (_, j) => [Math.cos((j / seg) * TAU) * r, y + t * h, Math.sin((j / seg) * TAU) * r] as V3));
  }
  skin(p, rings, c, { paint, inward });
}
const lf_tulou: Builder = gp => {
  ground(gp, SITE.grass);
  const Y = Y0 - 0.002, RO = 0.33, RI = 0.262, H = 0.15, fl = H / 4, tile = '#555a5e', earth = '#b98f57', timber = '#6a4a32';
  const ang = (x: number, z: number) => (Math.atan2(z, x) + TAU) / TAU;
  lathe(gp, [[0, 0], [RI, 0], [RI, 0.004], [0, 0.004]], '#a39d90', 0, Y - 0.002, 0, 48);
  // outer ring: stone footing, rammed-earth wall in pour layers, windows only on the 3rd and 4th floors
  ringWall(gp, RO, Y, H, earth, (x, yy, z) => {
    const v = yy - Y, a = Math.atan2(z, x);
    if (v < 0.018) return hash3(Math.floor(a * 50), Math.floor(v / 0.006), 1) > 0.5 ? '#8f8a80' : '#7d786f';
    return shade(earth, 0.92 + hash3(Math.floor(v / 0.008), Math.floor(a * 7), 1) * 0.08 + (fbm(a * 4, v * 30, 2) - 0.5) * 0.18);
  }, false, 144, 24, 0.007);
  for (const f of [2, 3]) for (let k = 0; k < 36; k++) {
    const a = (k / 36) * TAU + (f === 3 ? 0.087 : 0), yy = Y + (f + 0.3) * fl, r = RO + 0.007 * (1 - (yy - Y) / H) + 0.0005;
    if (Math.abs(a - Math.PI / 2) < 0.12) continue;
    box(gp, '#2b211a', Math.cos(a) * r, yy, Math.sin(a) * r, 0.007, 0.011, 0.004, Math.PI / 2 - a);
  }
  // inner timber façade: earthen ground floor with doors, galleried upper floors with continuous railings
  ringWall(gp, RI, Y, H, '#7a5638', (x, yy, z) => {
    const v = yy - Y, f = Math.floor(v / fl), u = (v % fl) / fl, bay = Math.floor(ang(x, z) * 72);
    if (f === 0) return u < 0.7 && bay % 2 === 0 ? '#2e2218' : '#a68660';
    if (u > 0.85) return '#4e3524';
    return u > 0.2 && bay % 2 === 0 ? '#3a2a1e' : null;
  }, true, 144, 24);
  for (let f = 1; f < 4; f++) {
    const yb = Y + f * fl;
    lathe(gp, [[RI - 0.012, yb - 0.003], [RI, yb - 0.003], [RI, yb], [RI - 0.012, yb], [RI - 0.012, yb - 0.003]], '#5e4230', 0, 0, 0, 72);
    ringWall(gp, RI - 0.011, yb, 0.01, timber, (x, _y, z) => (Math.floor(ang(x, z) * 288) % 2 ? '#4a3424' : null), true, 288, 1);
  }
  ringRoof(gp, RO + 0.03, (RO + RI) / 2 + 0.004, RI - 0.022, Y + H, 0.034, tile, 180);
  // 2nd ring (two storeys) and 3rd ring (one storey)
  const R2o = 0.2, R2i = 0.16, H2 = fl * 2, R3o = 0.125, R3i = 0.095, H3 = fl * 1.05;
  ringWall(gp, R2o, Y, H2, '#b9ab92', (x, yy, z) => {
    const u = ((yy - Y) % fl) / fl;
    return u > 0.35 && u < 0.7 && Math.floor(ang(x, z) * 40) % 2 === 0 ? '#3a2e24' : null;
  });
  ringWall(gp, R2i, Y, H2, '#7a5638', (x, yy, z) => {
    const u = ((yy - Y) % fl) / fl;
    return u < 0.72 && Math.floor(ang(x, z) * 40) % 2 === 0 ? '#3a2a1e' : u > 0.86 ? '#4e3524' : null;
  }, true, 100);
  ringRoof(gp, R2o + 0.018, (R2o + R2i) / 2, R2i - 0.016, Y + H2, 0.026, tile, 140);
  ringWall(gp, R3o, Y, H3, '#c8bea9', (x, yy, z) => ((yy - Y) / H3 > 0.3 && (yy - Y) / H3 < 0.65 && Math.floor(ang(x, z) * 32) % 2 === 0 ? '#3a2e24' : null), false, 96);
  ringWall(gp, R3i, Y, H3, '#7a5638', (x, yy, z) => ((yy - Y) / H3 < 0.75 && Math.floor(ang(x, z) * 32) % 2 === 0 ? '#3a2a1e' : null), true, 96);
  ringRoof(gp, R3o + 0.014, (R3o + R3i) / 2, R3i - 0.012, Y + H3, 0.02, tile, 120);
  // gaps (passages) through the inner rings on the axis
  for (const [r, h] of [[0.18, H2], [0.11, H3]] as const) box(gp, '#2e2218', 0, Y, r + (r > 0.15 ? 0.02 : 0.015), 0.018, h * (r > 0.15 ? 0.32 : 0.62), 0.004);
  // central ancestral hall (祖堂) with a small paved court
  lathe(gp, [[0, 0], [R3i, 0], [R3i, 0.003], [0, 0.003]], '#b3ad9f', 0, Y, 0, 40);
  house(gp, 0, Y + 0.003, -0.012, 0.09, 0.06, 0.034, 0, { wall: '#d8d0c0', roof: tile, front: '#5a3c2a', bar: '#2e2019', col: '#4a2c20', rh: 0.022 });
  // the granite-framed arched gate with its name board, a stone path and tea terraces, bamboo behind
  const gz = RO + 0.004;
  box(gp, '#d2c9b6', 0, Y, gz - 0.001, 0.085, 0.078, 0.012);
  box(gp, '#9a5a48', 0, Y + 0.074, gz + 0.0002, 0.088, 0.006, 0.014);
  box(gp, '#a39d90', 0, Y, gz, 0.05, 0.056, 0.016);
  box(gp, '#2a1f18', 0, Y, gz + 0.002, 0.03, 0.04, 0.014);
  ellip(gp, '#2a1f18', 0, Y + 0.04, gz + 0.002, 0.015, 0.012, 0.007);
  box(gp, '#2a1d16', 0, Y + 0.06, gz + 0.003, 0.04, 0.012, 0.004);
  box(gp, '#b8963e', 0, Y + 0.063, gz + 0.0052, 0.028, 0.005, 0.001);
  for (const sx of [-1, 1]) box(gp, '#8a3a2c', sx * 0.0195, Y + 0.008, gz + 0.0072, 0.006, 0.034, 0.001);
  box(gp, '#a39d90', 0, 0.03, 0.39, 0.04, 0.004, 0.09);
  for (const [a0, a1, r] of [[0.25, 1.3, 0.385], [0.28, 1.28, 0.43], [1.85, 2.9, 0.385], [1.88, 2.86, 0.43]] as const) {
    const n = Math.round(((a1 - a0) * r) / 0.011);
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; blob(gp, shade(r > 0.41 ? '#3c5a30' : '#466636', 0.92 + hash3(i, r * 100, 1) * 0.14), Math.cos(a) * r, Y + 0.006, Math.sin(a) * r, 0.008, 0.007, 0.008, a); }
  }
  for (const a of [3.7, 4.3, 4.9, 5.5]) bamboo(gp, Math.cos(a) * 0.39, Y, Math.sin(a) * 0.39, 0.21, 5, a);
  human(gp, 0.05, Y, 0.38, { h: 0.026, pose: 'carry', ry: Math.PI, top: '#3a4656', bottom: '#2a2a2a', hair: '#1c1714', hat: '#b89e6a', hatStyle: 'conical', detail: 'lo' });
  human(gp, -0.03, Y + 0.003, 0.22, { h: 0.025, pose: 'walk', ry: 0.4, top: '#4a4a52', bottom: '#2a2a2a', hair: '#1c1714', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 颐和园 — the Summer Palace (Qing, rebuilt 1888): Longevity Hill with the Tower of Buddhist Incense 佛香阁 (octagonal,
// 3 storeys / 4 eaves, yellow glazed tile, on a 21 m stone terrace) above the Hall of Dispelling Clouds 排云殿, the Long
// Corridor 长廊 (red columns, green benches, painted beams, grey tile) on the shore, the 云辉玉宇 pailou, Kunming Lake,
// the white-marble Seventeen-Arch Bridge 十七孔桥 to Nanhu Island, the Marble Boat 清晏舫 (two-storey Western-style cabin, 1893)
// and the glazed-tile 智慧海 on the summit. Refs: 颐和园 official site / Wikipedia "Summer Palace", "Tower of Buddhist Incense".

/** Humped multi-arch stone bridge in local frame (x along span, y up, z across). */
function archBridge(p: THREE.Object3D, L: number, H: number, W: number, n: number, c: string): (x: number) => number {
  const top = (x: number) => H - H * 0.45 * ((2 * x) / L) ** 2;
  const sh = new THREE.Shape();
  sh.moveTo(-L / 2, 0);
  sh.lineTo(L / 2, 0);
  for (let i = 24; i >= 0; i--) { const x = -L / 2 + (i / 24) * L; sh.lineTo(x, top(x)); }
  const pitch = L / n;
  for (let i = 0; i < n; i++) {
    const cx = -L / 2 + (i + 0.5) * pitch, f = 1 - Math.abs(cx) / (L / 2), w = pitch * (0.55 + 0.32 * f);
    sh.holes.push(archPath(cx, 0.0015, w, Math.min(w * 0.95, top(cx) - 0.008)));
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -W / 2);
  geo.computeVertexNormals();
  add(p, geo, mat(c), 0, 0, 0, 1, 1, 1);
  return top;
}
const lf_yiheyuan: Builder = gp => {
  const water = '#4f7684';
  ground(gp, SITE.water);
  const yellow = '#c9a13a', ver = '#9a3328', marble = '#d8d3c6', green = '#2f5a50';
  const hf: HF = (x, z) => {
    const isl = Math.max(0, 1 - Math.hypot(x - 0.09, z - 0.33) / 0.06);
    if (z > 0.016 && x < 0.37) return isl > 0 ? 0.004 + sstep(0, 0.4, isl) * 0.016 : 0;
    if (z > 0.0) return 0.012;
    const s = sstep(-0.005, -0.25, z), ridge = Math.max(0, 1 - (x / 0.5) ** 2);
    return 0.012 + s * 0.24 * ridge * (0.85 + 0.3 * fbm(x * 6, 1, z * 6));
  };
  const Y = land(gp, 0.444, hf, (x, y, z, _nx, ny) => {
    if (y < 0.0365) return hash3(Math.floor(x * 30), 1, Math.floor(z * 50)) > 0.94 ? '#5c8592' : water;
    if (z > 0.2 && y > 0.042) return '#56703e';
    if (y < 0.05 && z > -0.06 && x < 0.36) return '#bdb7a8';
    if (ny < 0.6) return '#77775e';
    return mix('#56703e', '#435f34', fbm(x * 12, 3, z * 12));
  });
  // Tower of Buddhist Incense on its great stone terrace, with the stair up from the Hall of Dispelling Clouds
  const zt = -0.17, yt = Y0 + 0.2;
  pbox(gp, '#b4ab98', 0, 0.1, zt, 0.17, yt - 0.1, 0.15, (_x, yy, _z, _nx, ny) => (ny > 0.5 ? '#c2bcac' : Math.floor(yy / 0.012) % 2 ? '#a9a08c' : null), 0.012);
  for (let i = 0; i < 8; i++) box(gp, '#c4bba8', 0, Y(0, -0.06) - 0.01 + i * 0.012, -0.075 - i * 0.002, 0.04, 0.014, 0.012);
  for (let i = 0; i <= 10; i++) for (const sz of [-1, 1]) box(gp, marble, -0.08 + i * 0.016, yt, zt + sz * 0.074, 0.003, 0.01, 0.003);
  for (const sz of [-1, 1]) box(gp, marble, 0, yt + 0.008, zt + sz * 0.074, 0.165, 0.002, 0.003);
  const tw = grp(gp, 0, zt, 0, yt);
  poly(tw, 8, 0.064, 0.062, 0.01, 0, 0, 0, marble);
  let y = 0.01;
  // [radius, storey height, eave radius, eave top ratio, eave height]: storey 1 with a skirt eave (副阶), storeys 2-3, crowning 攒尖
  const tiers: [number, number, number, number, number][] = [[0.05, 0.03, 0.076, 0.74, 0.018], [0.044, 0.013, 0.068, 0.86, 0.015], [0.04, 0.026, 0.062, 0.84, 0.015], [0.032, 0.022, 0.054, 0.08, 0.042]];
  tiers.forEach(([R, h, R0, k1, rh], i) => {
    storey(tw, 0, y, 0, 8, R, h, ver, i === 1 ? '#6e2a20' : '#8a3226');
    poly(tw, 8, R * 1.04, R * 1.04, 0.005, 0, y + h - 0.005, 0, green, ringPaint('#b8963e', 32), 1, 4);
    y = proof(tw, 0, y + h, 0, { n: 8, R0, R1: R0 * k1, h: rh, lift: 0.5, tile: yellow, rib: '#b88f2c', under: green }) - (i === 3 ? 0.004 : 0.002);
    if (i < 3) { poly(tw, 8, tiers[i + 1][0] * 1.1, tiers[i + 1][0] * 1.1, 0.005, 0, y, 0, '#7a2c22'); y += 0.005; }
  });
  gourd(tw, 0, y, 0, 0.012, C.gold);
  // 智慧海: glazed-tile beamless hall on the summit
  const zs = -0.33, ys = Y(0, zs);
  xhall(gp, 0, ys - 0.004, zs, 0.08, 0.035, 0.03, { roof: 'xs', tile: yellow, wall: '#b39a4e', col: '#b39a4e', band: green, under: green, rh: 0.02, ncol: 2 });
  // Hall of Dispelling Clouds (double eave), its flanking halls and gate, the Long Corridor along the shore
  const zh = -0.06, yh = Y(0, zh) + 0.006;
  box(gp, '#c4bba8', 0, 0.04, zh, 0.21, yh - 0.04, 0.07);
  xhall(gp, 0, yh, zh, 0.14, 0.05, 0.03, { roof: 'xs2', tile: yellow, wall: ver, col: ver, band: green, under: green, front: '#7a2c22', bar: '#c9a24a', rh: 0.04, baseH: 0.006, base: marble });
  for (const sx of [-1, 1]) xhall(gp, sx * 0.13, Y(sx * 0.13, -0.1) + 0.002, -0.1, 0.055, 0.035, 0.026, { roof: 'xs', tile: yellow, wall: ver, col: ver, band: green, under: green, rh: 0.024 });
  xhall(gp, 0, 0.046, -0.015, 0.065, 0.028, 0.026, { roof: 'xs', tile: yellow, wall: ver, col: ver, band: green, under: green, front: '#7a2c22', rh: 0.022 });
  for (const [x0, x1] of [[-0.42, -0.04], [0.04, 0.42]] as const) {
    const w = x1 - x0, xm = (x0 + x1) / 2, n = Math.round(w / 0.022);
    box(gp, '#d2ccbc', xm, 0.034, -0.022, w, 0.012, 0.036);
    for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) cyl(gp, ver, x0 + (i / n) * w, 0.046, -0.022 + sz * 0.012, 0.0022, 0.02, 5);
    for (const sz of [-1, 1]) box(gp, '#3e5e48', xm, 0.05, -0.022 + sz * 0.012, w, 0.003, 0.003);
    box(gp, '#3b5a58', xm, 0.062, -0.022, w, 0.005, 0.027);
    groof(gp, xm, 0.066, -0.022, w, 0.027, 0.011, '#55595a', 0, 0.006);
    box(gp, marble, xm, 0.046, 0.014, w, 0.005, 0.003);
  }
  // 云辉玉宇 pailou on the lakeside jetty before the gate
  box(gp, '#d2ccbc', 0, 0.03, 0.032, 0.1, 0.016, 0.036);
  for (const x of [-0.036, -0.012, 0.012, 0.036]) cyl(gp, ver, x, 0.046, 0.034, 0.0025, 0.036, 6);
  box(gp, green, 0, 0.074, 0.034, 0.08, 0.006, 0.006);
  for (const [x, w, yy] of [[0, 0.028, 0.08], [-0.024, 0.024, 0.074], [0.024, 0.024, 0.074]] as const) {
    box(gp, green, x, yy - 0.004, 0.034, w, 0.006, 0.006);
    xroof(gp, { x, z: 0.034, y: yy + 0.002, w: w + 0.008, d: 0.016, h: 0.008, ridge: w / 2 - 0.003, tile: yellow, under: green, lift: 0.003 });
  }
  // Seventeen-Arch Bridge to Nanhu Island
  const bg = grp(gp, 0.26, 0.16, Math.PI / 4, 0.03);
  const top = archBridge(bg, 0.4, 0.05, 0.03, 17, '#d4cfc2');
  for (let i = 0; i <= 20; i++) {
    const x = -0.2 + (i / 20) * 0.4;
    for (const sz of [-1, 1]) box(bg, '#d8d3c6', x, top(x), sz * 0.0135, 0.005, 0.01, 0.005);
  }
  for (const sz of [-1, 1]) for (let i = 0; i < 10; i++) {
    const xa = -0.2 + (i / 10) * 0.4, xb = xa + 0.04;
    rod(bg, [xa, top(xa) + 0.007, sz * 0.0135], [xb, top(xb) + 0.007, sz * 0.0135], 0.003, '#d8d3c6', 4);
  }
  xhall(gp, 0.09, Y(0.09, 0.33), 0.34, 0.055, 0.032, 0.022, { roof: 'xs', tile: '#4f5a55', wall: ver, col: ver, band: green, under: green, rh: 0.02 });
  leafy(gp, 0.05, Y(0.05, 0.31) - 0.004, 0.31, 0.045, '#3f5f34', 1);
  // Marble Boat 清晏舫: stone hull, two-storey Western-style cabin with coloured-glass windows
  const mb = grp(gp, -0.28, 0.08, 0.15, 0.03);
  rbox(mb, marble, 0, 0, 0, 0.15, 0.022, 0.045, 0.006);
  const win = (wx: number, wy: number): Paint => (x, yy, z, nx, ny) => {
    if (Math.abs(ny) > 0.5) return null;
    const u = Math.abs(nx) > 0.5 ? z : x;
    return Math.abs(((u + 1) % 0.014) - 0.007) < wx && yy > 0.004 && yy < 0.004 + wy ? '#4e6170' : null;
  };
  pbox(mb, '#dcd6c8', 0, 0.022, 0, 0.11, 0.022, 0.032, win(0.0035, 0.013), 0.0035);
  box(mb, '#d8d1c0', 0, 0.044, 0, 0.116, 0.003, 0.038);
  pbox(mb, '#dcd6c8', 0.006, 0.047, 0, 0.074, 0.018, 0.027, win(0.0035, 0.01), 0.0035);
  box(mb, '#d8d1c0', 0.006, 0.065, 0, 0.08, 0.003, 0.032);
  box(mb, '#c9c1ae', 0.006, 0.068, 0, 0.06, 0.004, 0.02);
  for (let i = 0; i <= 12; i++) for (const sz of [-1, 1]) box(mb, '#d8d1c0', -0.055 + i * 0.0092, 0.047, sz * 0.018, 0.002, 0.005, 0.002);
  // a rowing boat on the lake
  const bt = anim(gp, 'bob', -0.08, 0.034, 0.26);
  rbox(bt, '#6a4630', 0, 0, 0, 0.045, 0.008, 0.016, 0.003);
  human(bt, 0, 0.003, 0, { h: 0.025, pose: 'row', ry: Math.PI / 2, top: '#8a8676', bottom: '#3e382c', hair: '#1c1714', hat: '#b49a64', hatStyle: 'conical', detail: 'lo' });
  // pines and cypresses on Longevity Hill
  for (let k = 0; k < 24; k++) {
    const x = -0.4 + hash3(k, 1, 3) * 0.8, z = -0.07 - hash3(k, 2, 3) * 0.33;
    if (Math.abs(x) < 0.17 && z > -0.28) continue;
    if (Math.abs(x) < 0.07) continue;
    if (Math.hypot(x, z) > 0.42) continue;
    tree(gp, x, Y(x, z), z, k % 3 ? 0.05 : 0.065, k % 2 ? '#3a5a38' : '#45603c', k % 3 === 0);
  }
  for (const [x, z] of [[-0.38, 0.006], [-0.2, 0.006], [0.2, 0.006], [0.4, 0.07]] as const) willow(gp, x, 0.046, z, 0.06, x * 9);
};

// ---------------------------------------------------------------------------------------------------------
// 四合院 — a northern courtyard house (Beijing type, default). style 'pingyao' builds 日升昌票号, the first Shanxi draft bank
// (1823), 西大街, Pingyao. Ref: Baidu/zh.wikipedia 日升昌, 平遥古城 surveys: narrow deep plot, timber shop front (铺面) on the
// street with the black-and-gold "日升昌" plaque, then courtyards in series with single-slope (单坡) wing roofs draining
// inward behind high blank grey-brick walls, a 过厅 between courtyards and a 窑洞-arched main range with a storey above.

/** Pingyao single-slope wing range: rooms facing the court (−sx side) under a roof rising to a high outer wall at +sx. */
const BRC: [number, number, number] = [0.016, 0.008, 0.016];
function slopeWing(p: THREE.Object3D, x: number, z: number, len: number, dep: number, hIn: number, hOut: number, sx: number, brick: string, bp: Paint, tile: string): void {
  const y0 = Y0;
  box(p, brick, x, y0, z, dep - 0.012, hIn, len);
  pbox(p, brick, x + sx * (dep / 2 - 0.006), y0, z, 0.012, hOut, len + 0.002, bp, BRC);
  pfront(p, '#5a3c2a', x - sx * (dep / 2 - 0.007), y0, z, len * 0.9, hIn * 0.85, 0.0015, lattice('#2e2019', 3, 4), 0.006, -sx * Math.PI / 2);
  for (let i = 0; i < 3; i++) box(p, '#2e2019', x - sx * (dep / 2 - 0.005), y0, z - len * 0.3 + i * len * 0.3, 0.003, hIn * 0.7, 0.014);
  const ov = 0.01, dx = dep + ov - 0.012, dh = hOut - hIn, L = Math.hypot(dx, dh);
  const rg = grp(p, x + sx * (0.006 - ov / 2), z, 0, y0 + hIn + dh / 2);
  rg.rotation.z = sx * Math.atan2(dh, dx);
  pbox(rg, tile, 0, -0.002, 0, L, 0.004, len + 0.008, (_x, _y, zz, _nx, ny) => (ny < 0.5 ? null : Math.floor((zz + 1) / 0.0055) % 2 ? shade(tile, 1.18) : null), [L, 0.004, 0.0055]);
  box(p, shade(tile, 0.75), x + sx * (dep / 2 - 0.006), y0 + hOut, z, 0.016, 0.006, len + 0.006);
}
function rishengchang(gp: THREE.Object3D): void {
  // stone-paved 西大街 across the front of the plinth (with its drain line), lane paving elsewhere
  ground(gp, '#9a968e', (x, _y, z) => {
    const dz = z - 0.307;
    if (Math.abs(dz) < 0.054) return Math.abs(dz) < 0.003 ? '#5f5c56' : hash3(Math.floor(x / 0.025), 7, Math.floor(z / 0.015)) > 0.5 ? '#827d74' : '#78746c';
    return hash3(Math.floor(x / 0.018), 2, Math.floor(z / 0.0135)) > 0.5 ? '#8f8a80' : '#878279';
  });
  // the street block is built at 0.82 so its square plots sit inside the round plinth
  const S = 0.82, g = grp(gp, 0, 0, 0, Y0 * (1 - S));
  g.scale.setScalar(S);
  const brick = '#8c8a84', tile = '#555a5e', wood = '#4a3224', y0 = Y0;
  const bp: Paint = (_x, yy, _z, _nx, ny) => (Math.abs(ny) > 0.5 ? null : shade(brick, 0.92 + hash3(Math.floor(yy / 0.004), Math.floor(_x / 0.01 + _z / 0.01), 1) * 0.14));
  /** One street plot: shop front, courtyards with single-slope wings, cross halls and a back range. */
  const plot = (cx: number, w: number, main: boolean) => {
    const wd = main ? 0.06 : 0.055;
    // shop front: one-storey 硬山 range with timber shutters
    house(g, cx, y0, 0.26, w, 0.075, 0.05, 0, { wall: brick, roof: tile, front: wood, bar: '#2a1c14', col: '#3a2418', rh: 0.03 });
    for (const sx of [-1, 1]) pbox(g, brick, cx + sx * (w / 2 + 0.004), y0, 0.26, 0.01, 0.085, 0.085, bp, BRC);
    // courtyards in series
    const courts = main ? [[0.21, 0.04], [-0.02, -0.19]] : [[0.21, -0.12]];
    for (const [z1, z0] of courts) {
      box(g, '#a39f96', cx, y0, (z0 + z1) / 2, w - 2 * wd + 0.002, 0.003, z1 - z0);
      ptop(g, '#a39f96', cx, y0 + 0.0033, (z0 + z1) / 2, w - 2 * wd + 0.002, z1 - z0, (x, _y, z) => ((Math.floor(x / 0.016) + Math.floor(z / 0.016)) % 2 ? '#aaa69c' : null), 0.016);
      for (const sx of [-1, 1]) slopeWing(g, cx + sx * (w / 2 - wd / 2), (z0 + z1) / 2, z1 - z0, wd, 0.045, 0.072, sx, brick, bp, tile);
    }
    if (main) {
      // 过厅 between the two courtyards
      box(g, '#a5a097', cx, y0, 0.01, w - 0.01, 0.008, 0.07);
      house(g, cx, y0 + 0.008, 0.01, w - 0.02, 0.06, 0.048, 0, { wall: brick, roof: tile, front: wood, bar: '#2a1c14', col: '#3a2418', rh: 0.028 });
      // back range: brick-vaulted 窑洞 ground floor with arched lattice openings, a timber storey above
      const zb = -0.27, db = 0.13, hb = 0.056;
      box(g, '#a5a097', cx, y0, zb, w, 0.01, db + 0.01);
      pbox(g, brick, cx, y0 + 0.01, zb, w, hb, db, bp, BRC);
      for (let i = 0; i < 5; i++) {
        const ax = cx - w * 0.36 + i * w * 0.18, af = zb + db / 2;
        box(g, '#5a3c2a', ax, y0 + 0.012, af + 0.001, 0.036, 0.028, 0.003);
        ellip(g, '#5a3c2a', ax, y0 + 0.04, af + 0.001, 0.018, 0.016, 0.0015);
        pfront(g, '#5a3c2a', ax, y0 + 0.016, af + 0.0026, 0.03, 0.03, 0.0005, lattice('#2e2019', 3, 3), 0.005);
        box(g, '#2e2019', ax, y0 + 0.012, af + 0.0032, 0.01, 0.026, 0.001);
      }
      box(g, '#7a7670', cx, y0 + 0.01 + hb, zb, w + 0.004, 0.004, db + 0.004);
      for (let i = 0; i <= 16; i++) box(g, '#3a2418', cx - w / 2 + 0.01 + i * ((w - 0.02) / 16), y0 + 0.07, zb + db / 2 - 0.004, 0.002, 0.012, 0.002);
      box(g, '#3a2418', cx, y0 + 0.081, zb + db / 2 - 0.004, w - 0.02, 0.002, 0.003);
      house(g, cx, y0 + 0.066, zb - 0.02, w * 0.72, 0.065, 0.04, 0, { wall: brick, roof: tile, front: wood, bar: '#2a1c14', col: '#3a2418', rh: 0.028 });
      for (const sx of [-1, 1]) pbox(g, brick, cx + sx * w * 0.42, y0 + 0.066, zb - 0.02, w * 0.16, 0.03, 0.065, bp, BRC);
    } else {
      house(g, cx, y0, -0.2, w, 0.12, 0.05, 0, { wall: brick, roof: tile, front: wood, bar: '#2a1c14', col: '#3a2418', rh: 0.04 });
    }
    // high blank side walls running the depth of the plot
    for (const sx of [-1, 1]) pbox(g, brick, cx + sx * (w / 2 + 0.004), y0, main ? -0.06 : -0.03, 0.008, 0.074, main ? 0.53 : 0.46, bp, BRC);
    pbox(g, brick, cx, y0, main ? -0.345 : -0.27, w + 0.016, 0.06, 0.012, bp, BRC);
  };
  plot(0, 0.32, true);
  plot(-0.3, 0.24, false);
  plot(0.3, 0.24, false);
  // the 日升昌 signboard and the bank's raised entrance
  const zf = 0.26 + 0.0375;
  box(g, '#a5a097', 0, y0, zf + 0.012, 0.32, 0.006, 0.024);
  box(g, '#1a1714', 0, y0 + 0.054, zf + 0.012, 0.13, 0.02, 0.004);
  box(g, '#b8963e', 0, y0 + 0.054, zf + 0.0144, 0.134, 0.0016, 0.0012);
  box(g, '#b8963e', 0, y0 + 0.0724, zf + 0.0144, 0.134, 0.0016, 0.0012);
  for (let i = 0; i < 3; i++) box(g, '#c4a048', -0.036 + i * 0.036, y0 + 0.058, zf + 0.0145, 0.018, 0.012, 0.001);
  for (const sx of [-1, 1]) cyl(g, '#3a2418', sx * 0.068, y0 + 0.006, zf + 0.012, 0.003, 0.048, 6);
  // neighbours' hanging shop signs (幌子)
  for (const sx of [-1, 1]) {
    box(g, '#3a2418', sx * 0.3, y0 + 0.05, zf + 0.022, 0.003, 0.003, 0.03);
    box(g, '#2a1c14', sx * 0.3, y0 + 0.016, zf + 0.034, 0.012, 0.034, 0.003);
    box(g, '#b8963e', sx * 0.3, y0 + 0.022, zf + 0.0358, 0.006, 0.022, 0.001);
  }
  // merchants and a porter in the street, a clerk in the first courtyard
  human(g, 0.04, y0, 0.36, { h: 0.032, pose: 'point', ry: Math.PI * 0.9, top: '#2f3440', bottom: '#2a2a2a', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  human(g, -0.02, y0, 0.37, { h: 0.031, pose: 'stand', ry: Math.PI * 0.1, top: '#4a4038', bottom: '#2a2420', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  human(g, -0.2, y0, 0.39, { h: 0.031, pose: 'carry', ry: Math.PI / 2, top: '#6a5a48', bottom: '#3a3128', hair: '#1c1714', detail: 'lo' });
  human(g, 0.02, y0, 0.12, { h: 0.03, pose: 'walk', ry: Math.PI, top: '#3a4250', bottom: '#2a2a2a', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
}
const lf_siheyuan: Builder = (gp, r) => {
  if (str(r.style, 'beijing') === 'pingyao') { rishengchang(gp); return; }
  // hutong paving round the compound
  ground(gp, SITE.paving, (x, _y, z) => (hash3(Math.floor(x / 0.03), 2, Math.floor(z / 0.015)) > 0.5 ? '#8f8a80' : '#878279'));
  // the compound is built at 0.82 so its square walls sit inside the round plinth
  const S = 0.82, g = grp(gp, 0, 0, 0, Y0 * (1 - S));
  g.scale.setScalar(S);
  const brick = '#8e8d88', tile = '#5d6266', red = '#9a3b2c', front = '#7a2e22', y0 = Y0;
  const bp: Paint = (_x, yy, _z, _nx, ny) => (Math.abs(ny) > 0.5 ? null : shade(brick, 0.93 + hash3(Math.floor(yy / 0.006), Math.floor(_x / 0.012 + _z / 0.012), 1) * 0.12));
  // courtyard paving with cross walks
  pbox(g, '#b3afa6', 0, y0, -0.03, 0.42, 0.003, 0.36, (x, _y, z, _nx, ny) => (ny < 0.5 ? null : Math.abs(x) < 0.025 || Math.abs(z + 0.03) < 0.02 ? '#cdc8bd' : (Math.floor(x / 0.02) + Math.floor(z / 0.02)) % 2 ? '#a9a59c' : null), 0.01);
  // outer brick walls
  for (const sx of [-1, 1]) pbox(g, brick, sx * 0.36, y0, -0.05, 0.02, 0.075, 0.66, bp, 0.01);
  pbox(g, brick, 0, y0, -0.38, 0.74, 0.075, 0.02, bp, 0.01);
  // north main hall (正房) on a platform, flanked by side rooms (耳房)
  box(g, '#a5a097', 0, y0, -0.29, 0.44, 0.02, 0.17);
  for (let i = 0; i < 3; i++) box(g, '#a5a097', 0, y0, -0.2 + i * 0.012, 0.08, 0.02 - i * 0.007, 0.012);
  house(g, 0, y0 + 0.02, -0.29, 0.4, 0.14, 0.1, 0, { wall: brick, roof: tile, front: red, bar: '#2f5a4a', rh: 0.06, col: front });
  for (const sx of [-1, 1]) house(g, sx * 0.29, y0, -0.3, 0.14, 0.12, 0.08, 0, { wall: brick, roof: tile, front: '#8a3a2a', bar: '#2f3a3a', rh: 0.045 });
  for (const sx of [-1, 1]) lantern(g, sx * 0.07, y0 + 0.11, -0.205, 0.014);
  // east and west wings (厢房)
  for (const sx of [-1, 1]) house(g, sx * 0.27, y0, -0.07, 0.24, 0.13, 0.085, -sx * Math.PI / 2, { wall: brick, roof: tile, front: red, bar: '#2f5a4a', rh: 0.05, col: front });
  // south range (倒座房) facing the courtyard, its blank back to the street
  house(g, -0.06, y0, 0.22, 0.52, 0.11, 0.08, Math.PI, { wall: brick, roof: tile, front: '#8a3a2a', bar: '#2f3a3a', rh: 0.042 });
  // the gate in the south-east corner, with stone drums and lanterns
  const gx = 0.29, gz = 0.22;
  box(g, '#a5a097', gx, y0, gz, 0.12, 0.012, 0.13);
  pbox(g, brick, gx, y0 + 0.012, gz - 0.01, 0.12, 0.085, 0.09, bp, 0.01);
  box(g, '#3a2a20', gx, y0 + 0.012, gz + 0.035, 0.06, 0.08, 0.004);
  for (const sx of [-1, 1]) box(g, red, gx + sx * 0.0135, y0 + 0.012, gz + 0.038, 0.026, 0.065, 0.003);
  for (const sx of [-1, 1]) ellip(g, '#7c7a74', gx + sx * 0.035, y0 + 0.024, gz + 0.05, 0.009, 0.012, 0.009);
  gable(g, 0.12, 0.05, 0.13, brick, gx, y0 + 0.097, gz);
  groof(g, gx, y0 + 0.097, gz, 0.12, 0.13, 0.05, tile, 0, 0.014);
  for (const sx of [-1, 1]) lantern(g, gx + sx * 0.04, y0 + 0.085, gz + 0.072, 0.013);
  // screen wall (影壁) facing the gate inside
  pbox(g, brick, gx, y0, 0.1, 0.11, 0.09, 0.018, bp, 0.01);
  box(g, '#c9c4b8', gx, y0 + 0.025, 0.1, 0.07, 0.05, 0.022);
  ellip(g, '#8a8680', gx, y0 + 0.05, 0.112, 0.012, 0.012, 0.002);
  groof(g, gx, y0 + 0.09, 0.1, 0.11, 0.022, 0.012, tile, 0, 0.008);
  // courtyard life: scholar tree, pomegranate tubs, fish jar, family
  leafy(g, -0.12, y0, 0.06, 0.17, '#4a6a38', 3);
  for (const sx of [-1, 1]) {
    lathe(g, [[0, 0], [0.016, 0], [0.02, 0.022], [0, 0.022]], '#6a4a30', sx * 0.08, y0, -0.17, 10);
    add(g, ICO(), mat('#4f6e3c'), sx * 0.08, y0 + 0.04, -0.17, 0.02, 0.02, 0.02);
    for (let i = 0; i < 3; i++) ellip(g, '#d9402a', sx * 0.08 + Math.cos(i * 2) * 0.016, y0 + 0.04 + (i - 1) * 0.008, -0.17 + Math.sin(i * 2) * 0.016, 0.004);
  }
  lathe(g, [[0, 0], [0.018, 0], [0.026, 0.02], [0.024, 0.03], [0, 0.03]], '#5a4a3a', 0.12, y0, -0.02, 14);
  cyl(g, '#3f6f7a', 0.12, y0 + 0.028, -0.02, 0.022, 0.002, 14);
  human(g, 0.05, y0, -0.1, { h: 0.042, pose: 'stand', top: '#3a3f4a', bottom: '#2a2a2a', hair: '#bbbbbb', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'hi' });
  human(g, -0.02, y0, 0.0, { h: 0.03, pose: 'run', phase: 0.3, top: '#7a4a3a', bottom: '#2a2a5a', hair: '#1c1714', detail: 'lo' });
  human(g, -0.2, y0, -0.12, { h: 0.04, pose: 'walk', ry: Math.PI / 2, top: '#6a7a9a', bottom: '#2a2a2a', hair: '#1c1714', dress: 'ankle', detail: 'lo' });
  for (let i = 0; i < 5; i++) box(g, '#3a3a3a', -0.26 + i * 0.1, y0 + 0.07, 0.276, 0.022, 0.012, 0.004);
  leafy(g, -0.3, y0, 0.37, 0.12, '#4a6a38', 5);
  human(g, 0.18, y0, 0.36, { h: 0.04, pose: 'walk', ry: -Math.PI / 2, top: '#3a5a7a', bottom: '#2a2a2a', hair: '#1c1714', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 中山陵 — Sun Yat-sen Mausoleum on Purple Mountain, Nanjing (Lü Yanzhi, 1926–29). Axis from the south: 博爱坊 (granite
// pailou, 3 bays / 4 columns, blue glazed roof) → cedar-lined 墓道 → 陵门 (granite, 3 arched doors, single-eave 歇山 blue
// tile) → 碑亭 (square, double-eave 歇山, great stele) → 392 granite steps in flights with 8 landings → 祭堂 (white granite,
// 4 corner bastions, 3 arched doors, double-eave 歇山 of blue glazed tile) on a broad terrace → domed 墓室 behind.
// Refs: Wikipedia "Sun Yat-sen Mausoleum"; 中山陵园管理局 site descriptions.

const lf_zhongshanling: Builder = gp => {
  ground(gp, SITE.grass);
  const blue = '#2e4f7c', rib = '#3a5c88', granite = '#d8d4c9', stone = '#cbc6ba', dark = '#26262a';
  // stair profile: [from z, to z, is-flight]: gate step, gate/stele court, then flights and landings up to the hall terrace
  const segs: [number, number, boolean][] = [[0.255, 0.24, true], [0.24, 0.115, false], [0.115, 0.06, true], [0.06, 0.035, false], [0.035, -0.025, true], [-0.025, -0.05, false], [-0.05, -0.11, true]];
  const rise = 0.25, flightLen = segs.reduce((s, [a, b, f]) => s + (f ? a - b : 0), 0);
  const sy = (z: number): number => {
    let y = 0;
    for (const [a, b, f] of segs) {
      if (z >= a) return y;
      const d = Math.min(a, Math.max(b, z)), part = a - d;
      if (f) y += (part / flightLen) * rise;
      if (z > b) return y;
    }
    return y;
  };
  const hf: HF = (x, z) => {
    const base = z > 0.255 ? 0 : z > -0.11 ? sy(z) : rise + Math.max(0, -0.3 - z) * 0.9;
    const k = sstep(0.085, 0.17, Math.abs(x));
    return base - 0.004 + k * (0.015 + Math.max(0, 0.3 - z) * 0.08 + (fbm(x * 9, 4, z * 9) - 0.5) * 0.04) * (z < 0.3 ? 1 : 0.3);
  };
  const Y = land(gp, 0.444, hf, (x, _y, z, _nx, ny) => {
    if (Math.abs(x) < 0.03 && z > 0.255) return '#cfcabd';
    if (Math.abs(x) < 0.08 && z < 0.255 && z > -0.3) return '#d6d2c6';
    return ny < 0.7 ? '#5a6244' : mix('#4f6e3c', '#3b5a32', fbm(x * 11, 2, z * 11));
  });
  // flights of granite steps between low side walls, broad landings
  for (const [a, b, f] of segs) {
    const W = f ? 0.13 : 0.15;
    if (f) {
      const n = Math.max(2, Math.round((a - b) / 0.006));
      for (let i = 0; i < n; i++) {
        const z = a - (i + 0.5) * ((a - b) / n), yt = Y0 + sy(a - (i + 1) * ((a - b) / n));
        box(gp, i % 2 ? granite : stone, 0, Y0 + sy(a) - 0.01, z, W, yt - (Y0 + sy(a)) + 0.01, (a - b) / n + 0.001);
      }
    } else box(gp, '#d2cec3', 0, Y0 + sy(a) - 0.01, (a + b) / 2, W, 0.01, a - b);
    for (const sx of [-1, 1]) {
      const ya = Y0 + sy(a), yb = Y0 + sy(b);
      strut(gp, [sx * (W / 2 + 0.003), ya + 0.004, a], [sx * (W / 2 + 0.003), yb + 0.004, b], 0.004, 0.004, stone, 4);
    }
  }
  const arches = (x0: number, y: number, z: number, n: number, gap: number, w: number, h: number) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + (i - (n - 1) / 2) * gap;
      box(gp, dark, x, y, z, w, h - w / 2, 0.002);
      ellip(gp, dark, x, y + h - w / 2, z, w / 2, w / 2, 0.001);
    }
  };
  // 陵门: granite gatehouse with three arched doors and a single-eave blue 歇山 roof
  const yg = Y0 + sy(0.2), zg = 0.205;
  xhall(gp, 0, yg, zg, 0.13, 0.04, 0.04, { roof: 'xs', tile: blue, rib, wall: granite, col: granite, band: stone, under: '#b9b6ae', rh: 0.026, ncol: 1, baseH: 0.004, base: stone });
  arches(0, yg + 0.004, zg + 0.0125, 3, 0.036, 0.016, 0.026);
  box(gp, '#1f2a3e', 0, yg + 0.034, zg + 0.0125, 0.03, 0.006, 0.002);
  // 碑亭: square stele pavilion with double eaves
  const zb = 0.15;
  xhall(gp, 0, yg, zb, 0.05, 0.05, 0.036, { roof: 'xs2', tile: blue, rib, wall: granite, col: granite, band: stone, under: '#b9b6ae', rh: 0.03, ncol: 1, baseH: 0.004, base: stone });
  arches(0, yg + 0.004, zb + 0.0175, 1, 0, 0.016, 0.024);
  // 祭堂 on its terrace: granite mass, corner bastions, three arched doors, double-eave blue roof
  const zh = -0.2, yh = Y0 + rise;
  box(gp, '#d2cec3', 0, yh - 0.01, zh + 0.01, 0.3, 0.012, 0.2);
  for (let i = 0; i <= 24; i++) box(gp, granite, -0.15 + i * 0.0125, yh, zh + 0.109, 0.003, 0.008, 0.003);
  xhall(gp, 0, yh, zh, 0.17, 0.1, 0.06, { roof: 'xs2', tile: blue, rib, wall: granite, col: granite, band: stone, under: '#b9b6ae', rh: 0.06, ncol: 1, baseH: 0.006, base: stone, lift: 0.014 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(gp, '#dcd8ce', sx * 0.07, yh + 0.006, zh + sz * 0.038, 0.04, 0.057, 0.036);
  arches(0, yh + 0.006, zh + 0.0425, 3, 0.03, 0.015, 0.034);
  box(gp, '#1f2a3e', 0, yh + 0.049, zh + 0.0425, 0.05, 0.008, 0.002);
  box(gp, C.gold, 0, yh + 0.051, zh + 0.0435, 0.036, 0.004, 0.001);
  // the domed tomb chamber behind
  const zt = -0.335, yt = Y(0, zt);
  cyl(gp, granite, 0, yt - 0.01, zt, 0.045, 0.045, 24);
  lathe(gp, [[0, 0], [0.05, 0], [0.046, 0.014], [0.032, 0.028], [0, 0.035]], blue, 0, yt + 0.035, zt, 24);
  box(gp, granite, 0, yt - 0.01, zt + 0.04, 0.04, 0.035, 0.05);
  // 博爱坊: granite memorial archway, three bays and four columns, blue glazed roofs
  const za = 0.37;
  for (const x of [-0.07, -0.025, 0.025, 0.07]) { box(gp, granite, x, Y0, za, 0.008, 0.06, 0.008); box(gp, stone, x, Y0, za, 0.016, 0.01, 0.018); }
  box(gp, stone, 0, Y0 + 0.046, za, 0.15, 0.007, 0.007);
  for (const [x, w, yy] of [[0, 0.05, 0.058], [-0.0475, 0.045, 0.052], [0.0475, 0.045, 0.052]] as const) {
    box(gp, granite, x, Y0 + yy, za, w, 0.01, 0.008);
    xroof(gp, { x, z: za, y: Y0 + yy + 0.01, w: w + 0.01, d: 0.02, h: 0.01, ridge: w / 2 - 0.003, tile: blue, rib, under: '#b9b6ae', lift: 0.004 });
  }
  // cedars along the 墓道, forest on Purple Mountain
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) {
    const z = 0.335 - i * 0.02;
    minipine(gp, sx * 0.058, Y0, z, 0.034, '#2e4e34');
  }
  for (let k = 0; k < 64; k++) {
    const sx = k % 2 ? 1 : -1, x = sx * (0.12 + hash3(k, 1, 2) * 0.26), z = 0.36 - hash3(k, 3, 2) * 0.74;
    if (Math.hypot(x, z) > 0.42 || (z < -0.1 && Math.abs(x) < 0.2)) continue;
    if (k % 3 === 2) tree(gp, x, Y(x, z), z, 0.05, k % 2 ? '#425e3a' : '#4a643e');
    else minipine(gp, x, Y(x, z), z, 0.06 + hash3(k, 5, 1) * 0.03, k % 4 ? '#2c4c30' : '#365a38');
  }
  // visitors climbing the stairs (≈ one storey of the gatehouse)
  for (let i = 0; i < 5; i++) {
    const z = [0.3, 0.09, 0.0, -0.035, -0.08][i];
    human(gp, [-0.012, 0.03, -0.035, 0.015, -0.02][i], Y0 + sy(z), z, { h: 0.022, pose: 'walk', ry: Math.PI, top: ['#2f3a4a', '#4a4440', '#3a3026', '#6a6a66', '#2a3440'][i], bottom: '#2a2a2a', hair: '#1c1714', detail: 'min' });
  }
};

// ---------------------------------------------------------------------------------------------------------
// 北大红楼 — the Red Building of Peking University (1918), cradle of the May Fourth Movement. Ref: Baidu/zh.wikipedia 北京大学
// 红楼: 工-shaped plan, main block ≈100 × 14 m facing south with 34 m east/west wings, four storeys over a semi-basement,
// red brick over a grey-brick ground floor, white-trimmed windows, red-tile hipped roof; arched central entrance.
// Commons "Red Building of Peking University".

const lf_honglou: Builder = gp => {
  ground(gp, SITE.paving);
  pbox(gp, '#9c988e', 0, 0.03, 0.2, 0.52, 0.003, 0.16, (x, _y, z, _nx, ny) => (ny > 0.5 && (Math.floor(x / 0.025) + Math.floor(z / 0.025)) % 2 ? '#a19d93' : null), 0.025);
  const red = '#a05a4a', grey = '#8a877f', trim = '#bfb7a7', glass = '#2b3138', rtile = '#7a3a2c';
  // grey-brick ground floor, red brick above
  const bp: Paint = (x, yy, z, _nx, ny) => (Math.abs(ny) > 0.5 ? null : shade(yy < Y0 + 0.044 ? grey : red, 0.92 + hash3(Math.floor(yy / 0.004), Math.floor((x + z) / 0.01), 4) * 0.14));
  const zc = -0.03, W = 0.72, D = 0.106, ww = 0.106, wz0 = -0.16, wz1 = 0.1, sh = 0.03, nS = 4, bh = 0.016, yb = Y0;
  const H = bh + nS * sh + 0.008, wx = W / 2 - ww / 2;
  // brick masses: main block and the two end wings
  pbox(gp, red, 0, yb, zc, W - 2 * ww + 0.002, H, D, bp, 0.008);
  for (const sx of [-1, 1]) pbox(gp, red, sx * wx, yb, (wz0 + wz1) / 2, ww, H, wz1 - wz0, bp, 0.008);
  // stone-faced semi-basement plinth, belt course and cornice
  const band = (y: number, h: number, o: number, c: string) => {
    box(gp, c, 0, y, zc, W - 2 * ww + 0.004, h, D + o);
    for (const sx of [-1, 1]) box(gp, c, sx * wx, y, (wz0 + wz1) / 2, ww + o, h, wz1 - wz0 + o);
  };
  band(yb, bh, 0.003, '#8f8a80');
  band(yb + bh + sh - 0.002, 0.003, 0.003, trim);
  band(yb + H - 0.007, 0.007, 0.006, trim);
  // windows: tall sashes with white lintels and sills on every face
  const win = (x: number, y: number, z: number, ry: number, h = 0.019) => {
    const gw = grp(gp, x, z, ry, y);
    box(gw, trim, 0, -0.0015, 0.0012, 0.013, 0.002, 0.003);
    box(gw, trim, 0, h, 0.0012, 0.014, 0.003, 0.003);
    box(gw, glass, 0, 0, 0.0006, 0.01, h, 0.002);
    box(gw, '#e8e2d4', 0, h * 0.62, 0.0018, 0.01, 0.0012, 0.001);
  };
  const rows = (x0: number, x1: number, n: number, z: number, ry: number, axisX: boolean, skip?: (i: number, s: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      const t = x0 + ((i + 0.5) / n) * (x1 - x0);
      for (let s = 0; s < nS; s++) if (!skip?.(i, s)) {
        const y = yb + bh + s * sh + 0.006;
        if (axisX) win(t, y, z, ry); else win(z, y, t, ry);
      }
      const yy = yb + 0.004;
      if (axisX) box(gp, glass, t, yy, z + Math.cos(ry) * 0.0016, 0.01, 0.007, 0.002, ry); else box(gp, glass, z + Math.sin(ry) * 0.0016, yy, t, 0.01, 0.007, 0.002, ry);
    }
  };
  const xm = W / 2 - ww;
  rows(-xm, xm, 18, zc + D / 2, 0, true, (i, s) => s === 0 && (i === 8 || i === 9));
  rows(-xm, xm, 18, zc - D / 2, Math.PI, true);
  for (const sx of [-1, 1]) {
    rows(sx * wx - ww / 2, sx * wx + ww / 2, 3, wz1, 0, true);
    rows(sx * wx - ww / 2, sx * wx + ww / 2, 3, wz0, Math.PI, true);
    rows(wz0, wz1, 8, sx * (W / 2), (sx * Math.PI) / 2, false);
    rows(wz1, zc + D / 2, 1, sx * (wx - ww / 2), (-sx * Math.PI) / 2, false);
  }
  // central entrance: stone surround, round-arched door, steps
  const zf = zc + D / 2;
  box(gp, trim, 0, yb, zf + 0.002, 0.05, 0.05, 0.005);
  box(gp, '#3a2a20', 0, yb + 0.006, zf + 0.0045, 0.026, 0.026, 0.002);
  ellip(gp, '#3a2a20', 0, yb + 0.032, zf + 0.0045, 0.013, 0.012, 0.001);
  for (let i = 0; i < 3; i++) box(gp, '#a8a49a', 0, 0.03, zf + 0.01 + i * 0.008, 0.06, 0.012 - i * 0.004 + Y0 - 0.03, 0.009);
  // red-tile hipped roofs, the wings' ridges crossing the main ridge; chimneys
  const ry0 = yb + H;
  tbox(gp, W - 2 * ww + 0.01, D + 0.012, W - 2 * ww - D + 0.01, 0.004, 0.04, rtile, 0, ry0, zc);
  for (const sx of [-1, 1]) tbox(gp, ww + 0.012, wz1 - wz0 + 0.012, 0.004, wz1 - wz0 - ww, 0.04, shade(rtile, 0.96), sx * wx, ry0, (wz0 + wz1) / 2);
  for (const x of [-0.2, -0.07, 0.07, 0.2]) {
    box(gp, red, x, ry0 + 0.01, zc - 0.012, 0.012, 0.042, 0.01);
    box(gp, '#6e3326', x, ry0 + 0.052, zc - 0.012, 0.015, 0.003, 0.013);
  }
  // 1919: students gather in front with white banners; locust trees by the street
  const gowns = ['#2f3a4a', '#4a4f57', '#3a4250', '#5a5f66', '#2a2a2a', '#4a4038'];
  for (let i = 0; i < 9; i++) {
    const x = -0.14 + (i % 5) * 0.035 + (i > 4 ? 0.017 : 0), z = 0.17 + (i > 4 ? 0.035 : 0);
    human(gp, x, 0.033, z, { h: 0.022, pose: i === 2 ? 'wave' : i % 3 ? 'walk' : 'stand', phase: i / 7, ry: Math.PI * 0.9, top: gowns[i % 6], bottom: '#1f1f1f', hair: '#1c1714', dress: 'ankle', detail: 'lo' });
  }
  for (const x of [-0.11, 0.0]) {
    box(gp, '#5a4a38', x - 0.022, 0.033, 0.16, 0.002, 0.04, 0.002);
    box(gp, '#5a4a38', x + 0.022, 0.033, 0.16, 0.002, 0.04, 0.002);
    box(gp, '#dcd6c8', x, 0.06, 0.16, 0.042, 0.012, 0.002);
  }
  for (const [x, z] of [[-0.33, 0.24], [0.33, 0.24], [-0.22, 0.34], [0.22, 0.34]] as const) leafy(gp, x, 0.033, z, 0.08, '#4a6a3a', x * 9 + z);
};

// ---------------------------------------------------------------------------------------------------------
// lf_pavilion — two gardens. style 'zhuozheng' 拙政园 (Ming, Suzhou, 1509–): Ref: Baidu/zh.wikipedia 拙政园, 《园冶》: central pond
// with lotus, 远香堂 (single-eave 歇山 hall with lattice all round), hexagonal 荷风四面亭 on an islet, zigzag stone bridge,
// whitewashed walls with grey coping, 漏窗 and moon gate, Taihu rockery, chestnut-lacquered timber (栗壳色), grey tiles. Commons "Humble Administrator's Garden".
// style 'jingu' 金谷园 (Western Jin, Shi Chong's villa at Luoyang): Ref: 石崇《金谷诗序》, Jin/N. Wei architecture (rammed-earth
// terraces, straight-eaved hip roofs, red columns, whitewashed walls) and Han–Jin pottery tower models for the 崇绮楼.

function taihu(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number): void {
  // a perforated limestone pile: a few tall, leaning, overhanging lumps with dark hollows
  const n = 3 + Math.floor(hash3(seed, 1, 1) * 3);
  let yy = y, ox = 0, oz = 0;
  for (let i = 0; i < n; i++) {
    const w = s * (0.32 + hash3(seed, i, 2) * 0.22) * (1 - i * 0.08), hh = s * (0.34 + hash3(seed, i, 3) * 0.3);
    ox += (hash3(seed, i, 4) - 0.5) * s * 0.35; oz += (hash3(seed, i, 5) - 0.5) * s * 0.2;
    const ry = hash3(seed, i, 7) * 3;
    blob(p, mix('#8b8a84', '#6a6b66', hash3(seed, i, 6)), x + ox, yy + hh * 0.45, z + oz, w * 0.5, hh * 0.55, w * 0.3, ry);
    if (hash3(seed, i, 8) > 0.35) ellip(p, '#363735', x + ox + Math.sin(ry) * w * 0.05, yy + hh * 0.45, z + oz + w * 0.26, w * 0.09, hh * 0.13, w * 0.04);
    yy += hh * 0.7;
  }
}
/** Irregular pond: bank, water surface and a rim of stones (`rim` = stone colour, or null for an earthen bank). */
function pond(p: THREE.Object3D, plan: [number, number][], water: string, rim: string | null): void {
  const c = new THREE.CatmullRomCurve3(plan.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const pts = c.getSpacedPoints(48).slice(0, -1);
  const cx = plan.reduce((a, v) => a + v[0], 0) / plan.length, cz = plan.reduce((a, v) => a + v[1], 0) / plan.length;
  prism(p, pts.map(v => [cx + (v.x - cx) * 1.06, cz + (v.z - cz) * 1.06] as [number, number]), Y0 - 0.002, 0.003, rim ? '#6f6a5e' : '#7a6a50', 0, true);
  prism(p, pts.map(v => [v.x, v.z] as [number, number]), Y0 - 0.002, 0.0035, water, 0, true);
  if (rim) pts.forEach((v, i) => {
    const dx = v.x - cx, dz = v.z - cz, l = Math.hypot(dx, dz) || 1, o = 0.004 + hash3(i, 4, 1) * 0.006, big = hash3(i, 5, 1) > 0.75;
    box(p, mix(rim, shade(rim, 0.7), hash3(i, 9, 1)), v.x + (dx / l) * o, Y0 - 0.002, v.z + (dz / l) * o, 0.012 + hash3(i, 2, 1) * 0.012, 0.006 + hash3(i, 3, 1) * 0.005 + (big ? 0.006 : 0), 0.009 + (big ? 0.004 : 0), Math.atan2(dx, dz) + Math.PI / 2 + (hash3(i, 6, 1) - 0.5) * 0.6);
  });
}
function lotus(p: THREE.Object3D, x0: number, z0: number, rx: number, rz: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 4) * TAU, r = Math.sqrt(hash3(i, seed, 5)), x = x0 + Math.cos(a) * r * rx, z = z0 + Math.sin(a) * r * rz;
    cyl(p, i % 3 ? '#4d6b3a' : '#587540', x, Y0 + 0.0016 + (i % 4) * 0.0003, z, 0.008 + hash3(i, seed, 6) * 0.005, 0.0012, 9);
    if (i % 7 === 0) {
      rod(p, [x, Y0, z], [x, Y0 + 0.014, z], 0.001, '#4f6a34', 3);
      cone(p, i % 14 ? '#e2c8c4' : '#ece6da', x, Y0 + 0.013, z, 0.0035, 0.006, 6);
    }
  }
}
/** Suzhou hexagonal pavilion: chestnut columns, low 美人靠 benches, steep grey roof with strongly upswept corners. */
function suPavilion(p: THREE.Object3D, x: number, y: number, z: number, R: number, h: number, wood: string, tile: string): number {
  poly(p, 6, R * 1.25, R * 1.2, 0.01, x, y, z, '#a8a293');
  const yb = y + 0.01, rot = Math.PI / 6 + Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU, b = rot + ((i + 1) / 6) * TAU, fc = rot + ((i + 0.5) / 6) * TAU;
    const ax = x + Math.cos(a) * R, az = z + Math.sin(a) * R, bx = x + Math.cos(b) * R, bz = z + Math.sin(b) * R;
    cyl(p, wood, ax, yb, az, Math.max(0.0028, R * 0.06), h, 6);
    if (Math.sin(fc) < 0.95) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
      box(p, shade(wood, 0.9), mx, yb + h * 0.18, mz, L, h * 0.06, R * 0.18, ry);
      box(p, shade(wood, 0.8), mx, yb, mz, L, h * 0.18, R * 0.05, ry);
    }
  }
  poly(p, 6, R * 1.04, R * 1.04, h * 0.1, x, yb + h * 0.88, z, shade(wood, 0.8));
  const top = proof(p, x, yb + h, z, { n: 6, R0: R * 1.7, R1: R * 0.08, h: R * 1.2, lift: 0.8, tile, rib: shade(tile, 1.15), under: '#5a4a3e' });
  cone(p, shade(tile, 0.9), x, top - 0.004, z, R * 0.12, R * 0.3, 6);
  return top;
}
const lf_pavilion: Builder = (gp, r) => {
  const jingu = str(r.style, 'zhuozheng') === 'jingu';
  const tile = '#5d6266', wallc = '#dcd7cb';
  if (!jingu) {
    ground(gp, SITE.grass);
    const wood = '#5b3a2a';
    // back wall with 漏窗 and a moon gate
    const zw = -0.36, ww = 0.5, wh = 0.065;
    panel(gp, ww, wh, 0.014, wallc, [new THREE.Path().absarc(0.15, 0.03, 0.026, 0, TAU, true)], 0, Y0 - 0.002, zw);
    groof(gp, 0, Y0 + wh - 0.002, zw, ww, 0.024, 0.01, tile, 0, 0.006);
    box(gp, '#8a8680', 0, Y0 - 0.002, zw, ww, 0.006, 0.016);
    for (const x of [-0.2, -0.12, 0.03, 0.22]) {
      box(gp, '#555752', x, Y0 + 0.026, zw + 0.0072, 0.022, 0.022, 0.002);
      for (let k = 0; k < 4; k++) box(gp, wallc, x, Y0 + 0.0285 + k * 0.0055, zw + 0.0085, 0.022, 0.0012, 0.001);
      for (let k = 0; k < 4; k++) box(gp, wallc, x - 0.0083 + k * 0.0055, Y0 + 0.026, zw + 0.0085, 0.0012, 0.022, 0.001);
    }
    for (const sx of [-1, 1]) {
      const x0 = sx * 0.25;
      wallSeg(gp, x0, zw, sx * 0.36, -0.2, Y0 - 0.002, wh, wallc, tile, 0.014);
    }
    // the pond, lotus and the zigzag bridge
    const plan: [number, number][] = [[-0.3, 0.06], [-0.24, 0.24], [-0.06, 0.3], [0.16, 0.27], [0.32, 0.1], [0.3, -0.07], [0.12, -0.11], [-0.08, -0.08], [-0.24, -0.06]];
    pond(gp, plan, '#4e655c', '#8f8572');
    lotus(gp, -0.15, 0.13, 0.11, 0.09, 40, 1);
    lotus(gp, 0.22, 0.17, 0.06, 0.06, 14, 2);
    const zz: [number, number][] = [[-0.09, 0.4], [-0.06, 0.29], [0.04, 0.25], [0.01, 0.16], [0.1, 0.12], [0.13, 0.05]];
    const yb = Y0 + 0.006;
    for (let i = 0; i < zz.length - 1; i++) {
      const [ax, az] = zz[i], [bx, bz] = zz[i + 1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      box(gp, '#a39d90', (ax + bx) / 2, yb - 0.004, (az + bz) / 2, 0.024, 0.004, len + 0.024, ry);
      cyl(gp, '#8f8a7e', (ax + bx) / 2, Y0 - 0.002, (az + bz) / 2, 0.004, yb - Y0 - 0.002, 6);
      for (const sd of [-1, 1]) {
        const ox = Math.cos(ry) * 0.011 * sd, oz = -Math.sin(ry) * 0.011 * sd;
        box(gp, '#aaa497', (ax + bx) / 2 + ox, yb, (az + bz) / 2 + oz, 0.003, 0.006, len, ry);
      }
    }
    // 荷风四面亭 on a rocky islet
    poly(gp, 6, 0.07, 0.074, 0.006, 0.17, Y0 - 0.002, 0.02, '#8f8a7e');
    suPavilion(gp, 0.17, Y0 + 0.004, 0.02, 0.04, 0.046, wood, tile);
    // 远香堂: lattice on all four sides, stone terrace and balustrade on the pond side
    box(gp, '#a8a293', -0.09, Y0 - 0.002, -0.2, 0.25, 0.012, 0.15);
    for (let i = 0; i <= 12; i++) cyl(gp, '#b8b2a4', -0.21 + i * 0.02, Y0 + 0.01, -0.126, 0.0025, 0.01, 5);
    box(gp, '#b8b2a4', -0.09, Y0 + 0.018, -0.126, 0.24, 0.003, 0.005);
    xhall(gp, -0.09, Y0 + 0.01, -0.215, 0.19, 0.095, 0.046, { roof: 'xs', tile, wall: '#3e2b20', front: wood, bar: '#2e2019', col: wood, band: shade(wood, 0.8), rh: 0.038, lift: 0.014 });
    for (const sx of [-1, 1]) pbox(gp, wood, -0.09 + sx * 0.094, Y0 + 0.01, -0.217, 0.003, 0.04, 0.08, (_x, _y, _z, nx) => (Math.abs(nx) < 0.5 ? null : Math.floor((_z + 1) / 0.006) % 3 === 0 || Math.floor(_y / 0.006) % 4 === 0 ? '#2e2019' : null), 0.006);
    // rockeries, pines, bamboo along the wall, willows on the bank
    taihu(gp, -0.29, Y0, -0.16, 0.1, 5);
    taihu(gp, -0.31, Y0, -0.02, 0.07, 8);
    taihu(gp, 0.3, Y0, -0.18, 0.08, 11);
    taihu(gp, 0.23, Y0, 0.05, 0.05, 3);
    minipine(gp, 0.1, Y0, -0.24, 0.1, '#33533a');
    for (let k = 0; k < 3; k++) bamboo(gp, 0.18 + k * 0.035, Y0, -0.32 - (k % 2) * 0.01, 0.13, 5, k);
    willow(gp, 0.33, Y0, 0.22, 0.17, 2);
    willow(gp, -0.32, Y0, 0.24, 0.16, 6);
    leafy(gp, -0.36, Y0, -0.25, 0.09, '#46603a', 4);
    human(gp, -0.053, yb, 0.27, { h: 0.03, pose: 'point', ry: 2.4, top: '#3e4a58', bottom: '#2c2c2c', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
    human(gp, 0.165, Y0 + 0.014, 0.03, { h: 0.028, pose: 'stand', ry: Math.PI * 0.85, top: '#a59a86', bottom: '#5a5048', hair: '#1c1714', dress: 'ankle', detail: 'lo' });
  } else {
    ground(gp, SITE.meadow);
    const red = '#8e3a2a', earth = '#a48a66';
    const ep: Paint = (_x, y, _z, _nx, ny) => (Math.abs(ny) > 0.5 ? null : Math.floor(y / 0.006) % 2 ? shade(earth, 0.93) : null);
    // the stream-fed pond (金谷涧) with earthen banks
    const plan: [number, number][] = [[-0.34, 0.1], [-0.27, 0.27], [-0.08, 0.31], [0.08, 0.26], [0.04, 0.15], [-0.06, 0.08], [-0.2, 0.04]];
    pond(gp, plan, '#4e655c', null);
    lotus(gp, -0.17, 0.2, 0.08, 0.05, 14, 3);
    // rammed-earth terrace and its straight-eaved hip-roof hall
    pbox(gp, earth, -0.04, Y0 - 0.002, -0.23, 0.36, 0.036, 0.16, ep, 0.006);
    for (let i = 0; i < 5; i++) box(gp, '#9a8262', -0.04, Y0 - 0.002, -0.146 + i * 0.008, 0.06, 0.036 - (i + 1) * 0.0072, 0.009);
    const yt = Y0 + 0.034;
    xhall(gp, -0.04, yt, -0.245, 0.27, 0.1, 0.045, { roof: 'hip', tile, wall: wallc, front: '#6a3a2a', bar: '#3a2418', col: red, band: '#6a2e22', rh: 0.034, lift: 0.002 });
    // 崇绮楼: three-storey tower with balconies on its own high terrace
    const tx = 0.25, tz = -0.13;
    pbox(gp, earth, tx, Y0 - 0.002, tz, 0.11, 0.05, 0.11, ep, 0.006);
    let y = Y0 + 0.048;
    for (let s = 0; s < 3; s++) {
      const w = 0.072 - s * 0.008, h = 0.032;
      box(gp, wallc, tx, y, tz, w, h, w);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(gp, red, tx + sx * w / 2, y, tz + sz * w / 2, 0.0028, h, 6);
      box(gp, '#3a2418', tx, y + 0.006, tz + w / 2 + 0.001, w * 0.4, h * 0.6, 0.002);
      box(gp, '#6a2e22', tx, y + h - 0.005, tz, w + 0.004, 0.005, w + 0.004);
      if (s < 2) {
        xroof(gp, { x: tx, z: tz, y: y + h, w: w + 0.03, d: w + 0.03, h: 0.022, ridge: 0, upto: 0.5, tile, lift: 0.002, k: 0.2 });
        y += h + 0.012;
        box(gp, '#7a5a42', tx, y - 0.002, tz, w + 0.012, 0.003, w + 0.012);
        for (const sx of [-1, 1]) {
          box(gp, red, tx, y + 0.006, tz + sx * (w / 2 + 0.006), w + 0.012, 0.002, 0.002);
          box(gp, red, tx + sx * (w / 2 + 0.006), y + 0.006, tz, 0.002, 0.002, w + 0.012);
        }
      } else xroof(gp, { x: tx, z: tz, y: y + h, w: w + 0.026, d: w + 0.026, h: 0.032, ridge: 0.004, tile, lift: 0.002, k: 0.2 });
    }
    // a feast on the terrace: guests on mats, musicians with zither and pipes, a dancer
    box(gp, '#b9a77e', -0.04, yt, -0.17, 0.2, 0.0015, 0.035);
    const ppl: [number, number, string, 'sitGround' | 'wave' | 'stand'][] = [[-0.12, -0.17, '#5a2a24', 'sitGround'], [-0.08, -0.17, '#3a3a40', 'sitGround'], [0.0, -0.17, '#6a5a40', 'sitGround'], [0.04, -0.17, '#3e4a40', 'sitGround'], [-0.04, -0.17, '#8a3a32', 'wave']];
    ppl.forEach(([x, z, c, pose]) => human(gp, x, yt + 0.0015, z, { h: 0.03, pose, ry: Math.PI * 0.02, top: c, bottom: shade(c, 0.75), hair: '#1c1714', hatStyle: pose === 'wave' ? undefined : 'knot', dress: 'ankle', detail: 'lo' }));
    box(gp, '#3a2418', -0.12, yt + 0.004, -0.152, 0.035, 0.003, 0.009, 0.2);
    human(gp, 0.12, Y0, 0.12, { h: 0.03, pose: 'walk', ry: -2.4, top: '#2f2f35', bottom: '#2a2420', hair: '#1c1714', hatStyle: 'knot', dress: 'ankle', detail: 'lo' });
    // cypress and fruit-tree groves, bamboo by the water
    for (const [x, z] of [[-0.3, -0.12], [-0.33, -0.02], [0.33, 0.06], [0.2, 0.3], [0.31, 0.2]] as const) {
      tree(gp, x, Y0, z, 0.075, '#3e5a3a', true);
    }
    for (const [x, z, s] of [[-0.25, -0.32, 0.09], [0.12, -0.33, 0.09], [0.36, -0.22, 0.08], [0.16, 0.08, 0.08]] as const) leafy(gp, x, Y0, z, s, '#4f6a3a', x * 13 + z);
    // the stream leaving the pond, crossed by a plank bridge
    const st: [number, number][] = [[0.05, 0.25], [0.1, 0.3], [0.12, 0.36], [0.18, 0.41]];
    for (let i = 0; i < st.length - 1; i++) {
      const [ax, az] = st[i], [bx, bz] = st[i + 1], ry = Math.atan2(bx - ax, bz - az), L = Math.hypot(bx - ax, bz - az);
      box(gp, '#7a6a50', (ax + bx) / 2, Y0 - 0.002, (az + bz) / 2, 0.034, 0.003, L + 0.02, ry);
      box(gp, '#4e655c', (ax + bx) / 2, Y0 - 0.002, (az + bz) / 2, 0.024, 0.0035, L + 0.02, ry);
    }
    box(gp, '#6a4a32', 0.11, Y0 + 0.002, 0.33, 0.05, 0.003, 0.016, 0.5);
    bamboo(gp, -0.36, Y0, 0.2, 0.12, 6, 2);
    willow(gp, 0.22, Y0, 0.3, 0.15, 3);
  }
};

export const H_LIFE_ARCH2: Record<string, Builder> = {
  lf_huqiu, lf_tieta, lf_academy, lf_guanxing, lf_baita, lf_tulou, lf_yiheyuan, lf_siheyuan, lf_zhongshanling, lf_honglou, lf_pavilion,
};
