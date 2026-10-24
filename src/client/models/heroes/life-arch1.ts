import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, ball, ellip, rod, lathe, prism, skin, slab, gable,
  paintFaces, shade, mix, hash3, fbm, tree, SITE, PLINTH_SIDE, CYL, CONE, SPH, BOX,
} from '../prims.ts';
import { grp, minipine, proof, storey } from '../timber.ts';
import { human } from '../human.ts';
import { horse } from '../animals.ts';
import { sstep } from '../nature.ts';
import type { ModelRecipe } from '../../../shared/data/types.ts';

// Realistic early Chinese architecture dioramas, part 1 (lf_*): Neolithic → Tang.
// Front faces +z, base at y=0, footprint radius ≈0.46.

// ---------------------------------------------------------------------------------------------------------
// Shared kit

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ICO = () => g('la1:ico', () => new THREE.IcosahedronGeometry(1, 1));
const GOLD = () => mat('#e2b240', { metal: 0.75, rough: 0.3 });
const FIRE = () => mat('#ffb347', { emissive: '#ff7a1a' });

function anim(p: THREE.Object3D, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}
function flame(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const f = anim(p, 'flicker', x, y, z);
  add(f, CONE(6), FIRE(), 0, s * 0.5, 0, s * 0.55, s, s * 0.55);
  add(f, CONE(5), mat('#ffe08a', { emissive: '#ffb020' }), 0, s * 0.33, 0, s * 0.3, s * 0.66, s * 0.3, 0.6);
}
function smoke(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const sm = anim(p, 'smoke', x, y, z, { size: s });
  for (let i = 0; i < 4; i++) add(sm, ICO(), mat('#eeeeee', { transparent: 0.5 }), (hash3(i, 3, 7) - 0.5) * s, i * s * 1.3, (hash3(i, 5, 1) - 0.5) * s, s * (0.55 + i * 0.22), s * (0.5 + i * 0.2), s * (0.55 + i * 0.22));
}

/** Flat-shaded vertex-coloured triangle soup (terrain, cliffs, water). */
class Soup {
  pos: number[] = [];
  col: number[] = [];
  private cc = new Map<string, THREE.Color>();
  tri(a: V3, b: V3, c: V3, hex: string, want?: V3): void {
    if (want) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { const t = b; b = c; c = t; }
    }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    let k = this.cc.get(hex);
    if (!k) { k = new THREE.Color(hex); this.cc.set(hex, k); }
    for (let i = 0; i < 3; i++) this.col.push(k.r, k.g, k.b);
  }
  quad(a: V3, b: V3, c: V3, d: V3, hex: string, want?: V3): void { this.tri(a, b, c, hex, want); this.tri(a, c, d, hex, want); }
  build(p: THREE.Object3D, o: { rough?: number; metal?: number } = {}): void {
    if (!this.pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeVertexNormals();
    add(p, geo, mat('#ffffff', { vc: true, rough: o.rough ?? 0.9, metal: o.metal ?? 0.02 }), 0, 0, 0, 1, 1, 1);
  }
}

type HF = (x: number, z: number) => number;
/** Polar heightfield disc (absolute heights) with the shared dark plinth skirt (PLINTH_SIDE) down to y=0. */
function land(p: THREE.Object3D, R: number, hf: HF, paint: (x: number, y: number, z: number, slope: number) => string, nr = 22, ns = 72): void {
  const s = new Soup();
  const P = (i: number, j: number): V3 => { const r = (R * i) / nr, a = (j / ns) * TAU, x = Math.sin(a) * r, z = Math.cos(a) * r; return [x, hf(x, z), z]; };
  for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) {
    const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j);
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const slope = 1 - Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
    const col = paint((a[0] + c[0]) / 2, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + c[2]) / 2, slope);
    if (i === 0) s.tri(a, c, d, col, [0, 1, 0]); else s.quad(a, b, c, d, col, [0, 1, 0]);
  }
  for (let j = 0; j < ns; j++) {
    const a = P(nr, j), b = P(nr, j + 1);
    s.quad(a, b, [b[0], 0, b[2]], [a[0], 0, a[2]], PLINTH_SIDE, [a[0], 0, a[2]]);
  }
  s.build(p);
}
/** Flat water sheet over the polar cells that pass `test`, with a rim skirt where it meets the disc edge. */
function waterSurf(p: THREE.Object3D, R: number, y: number, test: (x: number, z: number) => boolean, c: string, nr = 22, ns = 72): void {
  const s = new Soup();
  const rp = (x: number, z: number) => { const n = fbm(x * 16, 0, z * 16); return hash3(Math.floor(x * 70), 0, Math.floor(z * 70)) > 0.975 ? mix(c, '#d6f0ff', 0.06) : shade(c, 0.95 + n * 0.1); };
  const P = (i: number, j: number): V3 => { const r = (R * i) / nr, a = (j / ns) * TAU; return [Math.sin(a) * r, y, Math.cos(a) * r]; };
  for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) {
    const a = P(i, j), b = P(i, j + 1), c2 = P(i + 1, j + 1), d = P(i + 1, j);
    const cx = (a[0] + b[0] + c2[0] + d[0]) / 4, cz = (a[2] + b[2] + c2[2] + d[2]) / 4;
    if (!test(cx, cz)) continue;
    const col = rp(cx, cz);
    if (i === 0) s.tri(a, c2, d, col, [0, 1, 0]); else s.quad(a, b, c2, d, col, [0, 1, 0]);
    if (i === nr - 1) s.quad(d, c2, [c2[0], 0.002, c2[2]], [d[0], 0.002, d[2]], shade(c, 0.72), [d[0], 0, d[2]]);
  }
  s.build(p, { rough: 0.25, metal: 0.1 });
}

/** Box subdivided into ~cw × ch cells, painted in cell coordinates (bricks, ashlar, rammed layers). y = bottom. */
function pbox(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, paint: Paint, cw = 0.012, ch = 0.006, ry = 0): THREE.Mesh {
  const nx = Math.max(1, Math.round(sx / cw)), ny = Math.max(1, Math.round(sy / ch)), nz = Math.max(1, Math.round(sz / cw));
  const geo = new THREE.BoxGeometry(nx, ny, nz, nx, ny, nz);
  geo.translate(0, ny / 2, 0);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, sx / nx, sy / ny, sz / nz, ry);
}
/** Tapered (battered) block w0×d0 → w1×d1 over height h, painted in cell coordinates. y = bottom. */
function ptaper(p: THREE.Object3D, c: string, x: number, y: number, z: number, w0: number, d0: number, w1: number, d1: number, h: number, paint: Paint, cw = 0.012, ch = 0.006): THREE.Mesh {
  const nx = Math.max(1, Math.round(w0 / cw)), ny = Math.max(1, Math.round(h / ch)), nz = Math.max(1, Math.round(d0 / cw));
  const geo = new THREE.BoxGeometry(nx, ny, nz, nx, ny, nz);
  geo.translate(0, ny / 2, 0);
  const pg = paintFaces(geo, c, paint), pos = pg.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / ny;
    pos.setXYZ(i, (pos.getX(i) / nx) * (w0 + (w1 - w0) * t), t * h, (pos.getZ(i) / nz) * (d0 + (d1 - d0) * t));
  }
  pg.computeVertexNormals();
  return add(p, pg, mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1);
}
const brickP = (c: string): Paint => (x, y, z, nx, ny, nz) => {
  if (Math.abs(ny) > 0.7) return shade(c, 0.96);
  const row = Math.floor(y + 1e-4), u = Math.abs(nx) > Math.abs(nz) ? z : x;
  const col = Math.floor((u + (row % 2)) / 2), h = hash3(col, row, Math.round(nx * 3 + nz * 7));
  return h > 0.86 ? shade(c, 0.84) : h < 0.12 ? shade(c, 1.1) : row % 2 ? shade(c, 0.97) : c;
};
const ashlarP = (c: string): Paint => (x, y, z, nx, ny, nz) => {
  if (Math.abs(ny) > 0.7) return hash3(Math.floor(x / 2), 0, Math.floor(z / 2)) > 0.6 ? shade(c, 1.05) : c;
  const row = Math.floor(y + 1e-4), u = Math.abs(nx) > Math.abs(nz) ? z : x;
  const col = Math.floor((u + (row % 2) * 1.5) / 3), h = hash3(col, row, Math.round(nx * 3 + nz * 7) + 9);
  return shade(c, 0.88 + h * 0.2);
};
const rammedP = (c: string): Paint => (x, y, z, _nx, ny) => {
  if (ny > 0.7) return shade(c, 1.04 + (fbm(x * 0.2, 0, z * 0.2) - 0.5) * 0.12);
  const layer = Math.floor(y + 1e-4);
  return shade(c, (layer % 2 ? 0.9 : 1.02) + (fbm(x * 0.25, y * 0.6, z * 0.25) - 0.5) * 0.16 + (hash3(layer, 4, 2) - 0.5) * 0.06);
};

interface HipO { k?: number; lift?: number; th?: number; freq?: number; thatch?: boolean; ridge?: string; chiwei?: string; under?: string; rib?: string; ridgeH?: number; hips?: boolean }
/** Hip roof (庑殿) w × d (w ≥ d; w = d gives a pyramid) with concave slopes, lifted corners, ridge and hip ribs. y = eave. */
function hip(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, c: string, o: HipO = {}): number {
  if (w < d) return hip(grp(p, x, z, Math.PI / 2), 0, y, 0, d, w, h, c, o);
  const k = o.k ?? 0.4, lift = o.lift ?? 0.12, th = o.th ?? d * 0.045, reach = d * 0.38;
  const sw = Math.max(3, Math.round(w * 60)), sd = Math.max(3, Math.round(d * 60));
  const yAt = (t: number) => y + h * (t * (1 - k) + k * t * t);
  const ring = (t: number, dy: number): V3[] => {
    const hw = w / 2 - (t * d) / 2, hd = d / 2 - (t * d) / 2, out: V3[] = [];
    const sides: [number, number, number, number, number, number][] = [
      [-hw, hd, hw, hd, sw, w], [hw, hd, hw, -hd, sd, d], [hw, -hd, -hw, -hd, sw, w], [-hw, -hd, -hw, hd, sd, d],
    ];
    for (const [ax, az, bx, bz, n, L] of sides) for (let i = 0; i < n; i++) {
      const u = i / n, px = ax + (bx - ax) * u, pz = az + (bz - az) * u;
      const cf = Math.max(0, 1 - (Math.min(u, 1 - u) * L) / reach) ** 2 * (1 - t) ** 1.5;
      const sc = 1 + cf * lift * 0.12;
      out.push([x + px * sc, yAt(t) + dy + cf * lift * d * 0.45, z + pz * sc]);
    }
    return out;
  };
  const rib = o.rib ?? shade(c, 1.13), under = o.under ?? '#5a4334';
  skin(p, [ring(0, -th), ...[0, 0.12, 0.3, 0.55, 0.8, 1].map(t => ring(t, 0))], c, {
    caps: true, flat: true,
    paint: (px, _py, pz, nx, ny, nz) => {
      if (ny < -0.3) return under;
      if (ny < 0.3) return shade(c, 0.7);
      if (o.thatch) return shade(c, 0.86 + hash3(Math.floor(px * 160), Math.floor(pz * 160), 3) * 0.26);
      const u = Math.abs(nx) > Math.abs(nz) ? pz : px;
      return Math.floor(u * 170 + 100) % 2 ? rib : c;
    },
  });
  const top = yAt(1), rh = o.ridgeH ?? Math.max(0.005, h * 0.14), ridge = o.ridge ?? (o.thatch ? shade(c, 0.75) : shade(c, 0.72));
  const half = (w - d) / 2;
  if (half > 0.002) box(p, ridge, x, top - rh * 0.3, z, w - d + rh, rh, rh * 0.9);
  else ball(p, ridge, x, top, z, rh * 0.8);
  if (o.hips ?? !o.thatch) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pt = (t: number): V3 => [x + sx * (w / 2 - (t * d) / 2) * (1 + (1 - t) ** 1.5 * lift * 0.12), yAt(t) + (1 - t) ** 1.5 * lift * d * 0.45 + rh * 0.3, z + sz * (d / 2 - (t * d) / 2) * (1 + (1 - t) ** 1.5 * lift * 0.12)];
    const ts = [0, 0.35, 0.7, 1];
    for (let i = 0; i < 3; i++) rod(p, pt(ts[i]), pt(ts[i + 1]), rh * 0.42, ridge, 4);
  }
  if (o.chiwei) for (const dir of [-1, 1]) chiwei(p, x + dir * half, top - rh * 0.2, z, h * 0.42, dir, o.chiwei);
  return top + rh * 0.7;
}
/** Owl-tail ridge finial (鸱尾): a tall fin curling inward. */
function chiwei(p: THREE.Object3D, x: number, y: number, z: number, s: number, dir: number, c: string): void {
  const pts: [number, number][] = [[-0.3, 0], [0.22, 0], [0.3, 0.35], [0.2, 0.75], [-0.04, 1], [-0.14, 0.86], [-0.02, 0.72], [-0.2, 0.56], [-0.1, 0.42], [-0.3, 0.22]];
  const m = slab(p, pts.map(([a, b]) => [a * s * dir, b * s] as [number, number]), s * 0.22, c, 0, false);
  m.position.set(x, y, z);
}
/** Flight of n steps rising from y0 (at local z0+run) to y1 (at z0), turned by ry. */
function stairs(p: THREE.Object3D, x: number, y0: number, y1: number, z0: number, w: number, run: number, c: string, n = 6, ry = 0, cheek?: string): void {
  const gs = grp(p, x, 0, ry);
  const cs = Math.cos(ry), sn = Math.sin(ry);
  gs.position.set(x + sn * z0, 0, cs * z0);
  for (let i = 0; i < n; i++) box(gs, i % 2 ? shade(c, 0.95) : c, 0, y0, (run * (i + 0.5)) / n, w, ((y1 - y0) * (n - i)) / n, run / n);
  if (cheek) for (const sx of [-1, 1]) {
    const m = box(gs, cheek, sx * (w / 2 + 0.004), y0, run / 2, 0.008, 0.001, Math.hypot(run, y1 - y0));
    m.rotation.x = Math.atan2(y1 - y0, run);
    m.position.set(sx * (w / 2 + 0.004), (y0 + y1) / 2, run / 2);
    m.scale.y = 0.012;
  }
}
/** Bracket set (斗栱): bearing block, two tiers of arms with small blocks. ry turns the arms. */
function dougong(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, ry = 0): void {
  const gd = grp(p, x, z, ry, y);
  box(gd, c, 0, 0, 0, s * 0.5, s * 0.32, s * 0.5);
  box(gd, shade(c, 1.08), 0, s * 0.32, 0, s * 1.7, s * 0.24, s * 0.28);
  box(gd, shade(c, 1.08), 0, s * 0.32, 0, s * 0.28, s * 0.24, s * 1.2);
  for (const sx of [-0.7, 0, 0.7]) box(gd, c, sx * s, s * 0.56, 0, s * 0.3, s * 0.2, s * 0.32);
  box(gd, shade(c, 1.08), 0, s * 0.76, 0, s * 2.4, s * 0.22, s * 0.28);
}
/** Spoked wheel in the YZ plane (axle along x). */
function wheel(p: THREE.Object3D, x: number, y: number, z: number, R: number, c: string, n = 8): void {
  add(p, g('la1:tor', () => new THREE.TorusGeometry(1, 0.1, 4, 16)), mat(c), x, y, z, R, R, R, Math.PI / 2);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; rod(p, [x, y, z], [x, y + Math.sin(a) * R, z + Math.cos(a) * R], R * 0.05, c, 3); }
  add(p, CYL(6), mat(shade(c, 0.8)), x, y, z, R * 0.36, R * 0.5, R * 0.36, 0, 0, Math.PI / 2);
}
/** Convex thatched cone roof (eave at y). */
function thatch(p: THREE.Object3D, x: number, y: number, z: number, R: number, h: number, c: string): void {
  const n = 22, ring = (r: number, yy: number): V3[] => Array.from({ length: n }, (_, i) => [x + Math.sin((i / n) * TAU) * r, yy, z + Math.cos((i / n) * TAU) * r] as V3);
  const rings = [ring(R * 0.94, y - R * 0.05), ...[0, 0.2, 0.45, 0.7, 0.88, 1].map(t => ring(R * (1 - t), y + h * (1 - (1 - t) ** 1.3)))];
  skin(p, rings, c, { caps: true, flat: true, paint: (px, py, pz, _nx, ny) => (ny < -0.2 ? shade(c, 0.6) : shade(c, 0.84 + hash3(Math.floor(Math.atan2(px - x, pz - z) * 24), Math.floor(py * 120), 5) * 0.3)) });
}
/** Wide-shouldered painted pottery jar (Yangshao), optional dark painted band. */
function jar(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, band?: string): void {
  lathe(p, ([[0, 0], [0.28, 0], [0.48, 0.32], [0.5, 0.5], [0.36, 0.8], [0.22, 0.9], [0.25, 1]] as [number, number][]).map(([r, v]) => [r * s, v * s] as [number, number]), c, x, y, z, 10);
  if (band) lathe(p, [[0.505 * s, 0.4 * s], [0.47 * s, 0.68 * s]], band, x, y, z, 10);
}
/** Rounded-rectangle (superellipse) ring at height y, starting at +z. */
function oval(cx: number, y: number, cz: number, hw: number, hd: number, m = 16, e = 0.6): V3[] {
  return Array.from({ length: m }, (_, i) => { const a = (i / m) * TAU, c = Math.cos(a), s = Math.sin(a); return [cx + Math.sign(s) * Math.abs(s) ** e * hw, y, cz + Math.sign(c) * Math.abs(c) ** e * hd] as V3; });
}
/** Carved seated Buddha in meditation (scale s ≈ total height), facing +z. robe: 'left' = over the left shoulder (Yungang), 'both' = covering both (Longmen). */
function seated(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, robe: 'left' | 'both' = 'left'): void {
  const gs = grp(p, x, z, 0, y), u = (v: number) => v * s, dk = shade(c, 0.8), lt = shade(c, 1.07);
  if (s < 0.08) {
    ellip(gs, c, 0, u(0.08), u(0.05), u(0.3), u(0.08), u(0.15));
    ellip(gs, c, 0, u(0.32), 0, u(0.17), u(0.21), u(0.1));
    ellip(gs, lt, 0, u(0.62), u(0.01), u(0.085), u(0.1), u(0.08));
    ellip(gs, dk, 0, u(0.72), 0, u(0.05), u(0.04), u(0.05));
    return;
  }
  // crossed legs: one broad lap with rounded knees, the right sole upturned on top
  const L: [number, number, number][] = [[0, 0.3, 0.14], [0.05, 0.335, 0.165], [0.11, 0.31, 0.15], [0.16, 0.22, 0.115], [0.172, 0.15, 0.09]];
  skin(gs, L.map(([yy, hw, hd]) => oval(0, u(yy), u(0.07), u(hw), u(hd), 20, 0.75)), c, {
    caps: true, flat: true, paint: (px, py, pz) => (Math.floor((pz / s) * 30 + Math.abs(px / s) * 8) % 2 ? shade(c, 0.94) : c),
  });
  ellip(gs, lt, u(0.09), u(0.155), u(0.15), u(0.07), u(0.018), u(0.034), 0.25);
  const T: [number, number, number, number][] = [[0.12, 0.17, 0.1, 0.01], [0.22, 0.16, 0.1, 0.012], [0.32, 0.17, 0.098, 0.01], [0.4, 0.19, 0.092, 0.004], [0.455, 0.2, 0.082, -0.004], [0.495, 0.17, 0.07, -0.01], [0.522, 0.1, 0.058, -0.01], [0.535, 0.046, 0.046, -0.004], [0.57, 0.044, 0.044, 0]];
  skin(gs, T.map(([yy, hw, hd, dz]) => oval(0, u(yy), u(dz), u(hw), u(hd), 20, 0.8)), c, {
    caps: true, flat: true,
    paint: (px, py) => {
      const X = px / s, Yy = py / s;
      if (robe === 'left' && X < -0.02 && Yy > 0.3 && Yy > 0.35 + X * 0.9 && Yy < 0.5) return lt;
      const f = robe === 'left' ? Yy * 34 + X * 22 : (Yy + Math.abs(X) * 0.9) * 34;
      return Math.floor(f) % 2 ? shade(c, 0.93) : c;
    },
  });
  // arms in the dhyāna mudrā: upper arms close to the flanks, forearms resting on the lap, hands joined
  for (const sx of [-1, 1]) {
    rod(gs, [sx * u(0.175), u(0.45), u(-0.005)], [sx * u(0.2), u(0.27), u(0.03)], u(0.05), c, 10);
    ellip(gs, c, sx * u(0.2), u(0.27), u(0.03), u(0.05));
    rod(gs, [sx * u(0.2), u(0.27), u(0.03)], [sx * u(0.06), u(0.18), u(0.14)], u(0.042), c, 10);
  }
  ellip(gs, lt, 0, u(0.18), u(0.14), u(0.07), u(0.04), u(0.05));
  // head: oval face, hair, uṣṇīṣa, long ears, nose, lowered eyes
  ellip(gs, lt, 0, u(0.64), u(0.008), u(0.086), u(0.106), u(0.09));
  ellip(gs, dk, 0, u(0.672), u(-0.006), u(0.09), u(0.084), u(0.09));
  ellip(gs, dk, 0, u(0.75), u(-0.01), u(0.056), u(0.05), u(0.056));
  for (const sx of [-1, 1]) {
    ellip(gs, c, sx * u(0.088), u(0.61), u(-0.004), u(0.016), u(0.06), u(0.03));
    box(gs, shade(c, 0.7), sx * u(0.034), u(0.648), u(0.09), u(0.03), u(0.005), u(0.006));
  }
  ellip(gs, lt, 0, u(0.62), u(0.094), u(0.012), u(0.026), u(0.012));
}
type SKind = 'buddha' | 'disciple' | 'bodhi' | 'king' | 'lishi';
/** Standing cave-temple figure of height h, facing +z turned by ry. */
function statue(p: THREE.Object3D, x: number, y: number, z: number, h: number, c: string, kind: SKind, ry = 0): void {
  const gs = grp(p, x, z, ry, y), u = (v: number) => v * h, dk = shade(c, 0.8), lt = shade(c, 1.07);
  const guard = kind === 'king' || kind === 'lishi';
  const prof: [number, number, number][] = kind === 'lishi'
    ? [[0, 0.15, 0.07], [0.06, 0.16, 0.075], [0.3, 0.14, 0.07], [0.42, 0.1, 0.06], [0.5, 0.11, 0.065], [0.62, 0.15, 0.07], [0.7, 0.19, 0.065], [0.745, 0.12, 0.055], [0.77, 0.045, 0.045], [0.8, 0.04, 0.04]]
    : kind === 'king'
      ? [[0, 0.15, 0.075], [0.08, 0.15, 0.08], [0.32, 0.13, 0.075], [0.44, 0.125, 0.07], [0.6, 0.155, 0.075], [0.7, 0.185, 0.07], [0.745, 0.12, 0.055], [0.77, 0.045, 0.045], [0.8, 0.04, 0.04]]
      : [[0, 0.115, 0.075], [0.05, 0.12, 0.08], [0.3, 0.11, 0.072], [0.45, 0.115, 0.068], [0.6, 0.135, 0.068], [0.7, 0.145, 0.064], [0.745, 0.11, 0.055], [0.77, 0.04, 0.04], [0.8, 0.038, 0.038]];
  skin(gs, prof.map(([yy, hw, hd]) => oval(0, u(yy), 0, u(hw), u(hd), 16, 0.6)), c, {
    caps: true, flat: true,
    paint: (px, py) => {
      const X = px / h, Yy = py / h;
      if (kind === 'lishi' && Yy > 0.45) return lt;
      if (kind === 'king' && Yy > 0.5 && Yy < 0.7) return Math.floor(Yy * 60 + Math.abs(X) * 30) % 2 ? dk : c;
      return Math.floor((Yy + Math.abs(X) * (kind === 'bodhi' ? 1.4 : 0.6)) * 40) % 2 ? shade(c, 0.93) : c;
    },
  });
  // arms
  for (const sx of [-1, 1]) {
    const sh: V3 = [sx * u(0.16), u(0.69), 0];
    if (kind === 'lishi' && sx < 0) { rod(gs, sh, [sx * u(0.27), u(0.8), u(0.03)], u(0.045), lt, 6); ellip(gs, lt, sx * u(0.28), u(0.86), u(0.03), u(0.04), u(0.045), u(0.04)); continue; }
    if (guard) {
      rod(gs, sh, [sx * u(0.24), u(0.55), u(0.02)], u(0.045), kind === 'lishi' ? lt : c, 6);
      rod(gs, [sx * u(0.24), u(0.55), u(0.02)], [sx * u(0.13), u(0.46), u(0.06)], u(0.04), kind === 'lishi' ? lt : c, 6);
      continue;
    }
    rod(gs, sh, [sx * u(0.17), u(0.5), u(0.02)], u(0.042), c, 6);
    rod(gs, [sx * u(0.17), u(0.5), u(0.02)], [sx * u(0.08), u(0.5), u(0.08)], u(0.036), c, 6);
    ellip(gs, lt, sx * u(0.07), u(0.5), u(0.09), u(0.025), u(0.03), u(0.02));
    ellip(gs, shade(c, 0.95), sx * u(0.16), u(0.42), u(0.01), u(0.04), u(0.12), u(0.05));
  }
  if (kind === 'king') ellip(gs, dk, 0, u(0.03), u(0.06), u(0.16), u(0.045), u(0.08));
  // head, headgear and halo
  ellip(gs, lt, 0, u(0.87), u(0.01), u(0.056), u(0.07), u(0.06));
  if (kind === 'buddha') ellip(gs, dk, 0, u(0.945), 0, u(0.04), u(0.035), u(0.04));
  if (kind === 'bodhi') { box(gs, dk, 0, u(0.92), 0, u(0.085), u(0.06), u(0.05)); cone(gs, dk, 0, u(0.975), 0, u(0.03), u(0.04), 5); }
  if (kind === 'king') { ellip(gs, dk, 0, u(0.9), 0, u(0.066), u(0.06), u(0.066)); cone(gs, dk, 0, u(0.95), 0, u(0.012), u(0.04), 5); }
  if (kind === 'disciple') ellip(gs, shade(c, 1.02), 0, u(0.9), 0, u(0.056), u(0.05), u(0.058));
  if (!guard) add(gs, CYL(18), mat(dk), 0, u(0.88), -u(0.07), u(0.24), u(0.012), u(0.24), 0, Math.PI / 2);
}
/** Han carriage (轺车) with horse, umbrella and driver, nominal horse scale 0.17 × q, facing +z. */
function carriage(p: THREE.Object3D, x: number, z: number, ry: number, q: number, y = 0, canopy = '#7a2a20'): void {
  const gc = grp(p, x, z, ry, y);
  gc.scale.setScalar(q);
  const hg = grp(gc, 0, 0.065, 0);
  hg.scale.setScalar(0.17);
  horse(hg, '#5a3a24', '#22160e');
  const wd = '#4a3020';
  box(gc, '#6a4630', 0, 0.03, -0.05, 0.07, 0.006, 0.058);
  box(gc, '#7a2a20', 0, 0.036, -0.075, 0.07, 0.02, 0.006);
  for (const sx of [-1, 1]) { box(gc, '#7a2a20', sx * 0.034, 0.036, -0.05, 0.004, 0.012, 0.05); wheel(gc, sx * 0.042, 0.03, -0.055, 0.03, wd, 10); }
  rod(gc, [-0.046, 0.03, -0.055], [0.046, 0.03, -0.055], 0.002, wd, 4);
  for (const sx of [-1, 1]) rod(gc, [sx * 0.012, 0.033, -0.025], [sx * 0.012, 0.06, 0.07], 0.0022, wd, 4);
  rod(gc, [-0.03, 0.06, 0.07], [0.03, 0.06, 0.07], 0.0025, wd, 4);
  rod(gc, [0, 0.036, -0.06], [0, 0.11, -0.06], 0.0016, wd, 4);
  lathe(gc, [[0, 0.112], [0.05, 0.1], [0.052, 0.096], [0, 0.105]], canopy, 0, 0, -0.06, 14);
  human(gc, 0, 0.036, -0.045, { h: 0.055, pose: 'kneel', top: '#3f4b5a', bottom: '#2a2f38', hair: '#1a1410', hatStyle: 'knot', dress: 'ankle', detail: 'lo' });
}
/** Gilded bronze sparrow (铜雀) with spread wings on a ball, height ≈ s. */
function sparrow(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const G = GOLD();
  add(p, SPH(10), G, x, y + s * 0.08, z, s * 0.22, s * 0.16, s * 0.22);
  add(p, SPH(10), G, x, y + s * 0.42, z, s * 0.34, s * 0.3, s * 0.52, 0, -0.5);
  add(p, SPH(10), G, x, y + s * 0.68, z + s * 0.16, s * 0.18, s * 0.18, s * 0.18);
  add(p, CONE(5), G, x, y + s * 0.68, z + s * 0.3, s * 0.05, s * 0.12, s * 0.05, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    const w = slab(p, [[0, 0], [0.55 * sx, 0.18], [0.9 * sx, 0.5], [0.6 * sx, 0.36], [0.3 * sx, 0.3]].map(([a, b]) => [a * s, b * s] as [number, number]), s * 0.05, '#e2b240', 0, false);
    w.material = G;
    w.position.set(x + sx * s * 0.08, y + s * 0.42, z);
    w.rotation.y = sx * 0.3;
  }
  const t = slab(p, [[-0.12, 0], [0.12, 0], [0.22, 0.4], [-0.22, 0.4]].map(([a, b]) => [a * s, b * s] as [number, number]), s * 0.04, '#e2b240', 0, false);
  t.material = G;
  t.position.set(x, y + s * 0.36, z - s * 0.12);
  t.rotation.x = -2.3;
}
/** Deciduous tree (shared natural clump), overall height ≈ s. */
const broadleaf = (p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#5f6b40', _seed = 0) => tree(p, x, y, z, s * 0.66, c);
/** Temple / tomb cypress (柏) as the shared layered conifer, height ≈ s. */
const cypress = (p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#46573a') => tree(p, x, y, z, s * 0.9, c, true);
/** Balustrade along a straight line (posts + top rail). */
function rail(p: THREE.Object3D, x0: number, z0: number, x1: number, z1: number, y: number, h: number, c: string, n: number): void {
  for (let i = 0; i <= n; i++) { const t = i / n; box(p, c, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, h * 0.3, h, h * 0.3); }
  rod(p, [x0, y + h * 0.85, z0], [x1, y + h * 0.85, z1], h * 0.12, c, 4);
}

// ---------------------------------------------------------------------------------------------------------
// 半坡 Banpo Neolithic village (Yangshao, c. 4800–4300 BC), Xi'an. A defended settlement ringed by a 5–6 m wide, mostly dry
// ditch: round (4–6 m) and square semi-subterranean wattle-and-daub houses with conical / pyramidal thatch and sloping
// entries facing a central plaza, the 'big house' (F1, ~160 m²), storage pits; the pottery kilns lay OUTSIDE the ditch to
// the east (cemetery to the north). Ref: 《西安半坡》(1963); 杨鸿勋 reconstructions; Banpo Museum.

const LINEN = '#cdbb94', HIDE = '#8a6a48', HAIR = '#1a1410';
function lf_banpo(gp: THREE.Group): void {
  const R = 0.46, dIn = 0.305, dOut = 0.36;
  const hf: HF = (x, z) => {
    const r = Math.hypot(x, z), dd = sstep(dIn - 0.012, dIn + 0.012, r) * (1 - sstep(dOut - 0.012, dOut + 0.012, r));
    return 0.04 + (fbm(x * 8, 0, z * 8) - 0.5) * 0.01 - dd * 0.034 + (r > dOut ? 0.003 : 0);
  };
  land(gp, R, hf, (x, y, z, sl) => {
    const r = Math.hypot(x, z), n = fbm(x * 14, 2, z * 14);
    if (y < 0.022 || sl > 0.3) return mix('#6e5236', '#5a4a30', n);
    if (r < 0.3) return mix('#a88a5e', '#94784e', n + (hash3(Math.floor(x * 90), 1, Math.floor(z * 90)) - 0.5) * 0.4);
    return mix(SITE.meadow, SITE.loess, n * 0.7);
  });
  waterSurf(gp, R, 0.019, (x, z) => { const r = Math.hypot(x, z); return r > dIn + 0.004 && r < dOut - 0.004; }, '#6f6a48');
  // log bridge over the ditch
  for (const sx of [-1, 1]) rod(gp, [sx * 0.012, 0.043, dIn - 0.02], [sx * 0.012, 0.043, dOut + 0.02], 0.0045, '#6a4a30', 5);
  for (let i = 0; i < 6; i++) rod(gp, [-0.02, 0.047, dIn - 0.008 + i * 0.014], [0.02, 0.047, dIn - 0.008 + i * 0.014], 0.0025, '#7d5a3a', 4);
  // round semi-subterranean huts facing the plaza
  const daub = '#8d6b48', straw = '#b39a5e';
  const hut = (x: number, z: number, s: number) => {
    const gh = grp(gp, x, z, Math.atan2(-x, 0.04 - z), 0.038);
    cyl(gh, daub, 0, -0.004, 0, s, 0.016, 14);
    thatch(gh, 0, 0.011, 0, s * 1.18, s * 1.25, straw);
    gable(gh, 0.05, 0.026, 0.034, shade(straw, 0.92), 0, 0, s * 1.1, Math.PI / 2);
    box(gh, '#2a1d14', 0, 0, s * 1.31, 0.016, 0.02, 0.003);
    box(gh, daub, 0, -0.004, s * 1.37, 0.03, 0.004, 0.022);
  };
  hut(-0.21, 0.07, 0.054);
  hut(0.21, 0.0, 0.052);
  hut(-0.12, 0.2, 0.048);
  hut(0.17, 0.16, 0.046);
  hut(0.185, -0.16, 0.048);
  hut(-0.19, -0.15, 0.046);
  // square semi-subterranean house (方形房屋): sunken floor, low daub wall, pyramidal thatch, sloping entry
  box(gp, daub, 0.03, 0.034, 0.17, 0.08, 0.012, 0.075);
  hip(gp, 0.03, 0.044, 0.17, 0.095, 0.09, 0.055, straw, { thatch: true, k: 0.05, lift: 0, th: 0.005 });
  box(gp, '#2a1d14', 0.03, 0.036, 0.2085, 0.014, 0.016, 0.003);
  // storage pits (窖穴) and drying racks
  for (const [x, z] of [[-0.08, 0.13], [0.1, 0.06], [-0.1, -0.03], [0.09, -0.04]] as P2[]) { cyl(gp, '#3a2a1c', x, 0.0395, z, 0.011, 0.0012, 10); cyl(gp, '#8a6a46', x, 0.039, z, 0.0135, 0.001, 10); }
  // the "big house" (大房子): square, low daub walls, thatched hip roof
  box(gp, daub, 0, 0.032, -0.15, 0.2, 0.026, 0.17);
  hip(gp, 0, 0.056, -0.15, 0.24, 0.205, 0.12, straw, { thatch: true, k: 0.1, lift: 0, th: 0.006 });
  gable(gp, 0.05, 0.03, 0.04, shade(straw, 0.92), 0, 0.04, -0.045, Math.PI / 2);
  box(gp, '#2a1d14', 0, 0.038, -0.064, 0.02, 0.024, 0.003);
  // pottery kiln (横穴窑): dome, firing mouth, fire and smoke
  // pottery kilns (横穴窑) in the potters' quarter OUTSIDE the ditch, to the east
  for (const [kx, kz, ks] of [[0.405, 0.04, 1], [0.39, -0.1, 0.8]] as V3[]) {
    ellip(gp, '#8a6a4a', kx, 0.042, kz, 0.026 * ks, 0.018 * ks, 0.026 * ks);
    cyl(gp, '#3a2618', kx, 0.058 * ks + 0.002, kz, 0.005 * ks, 0.003, 8);
    box(gp, '#1e140e', kx - 0.024 * ks, 0.036, kz, 0.012, 0.01, 0.012, 0);
    if (ks === 1) { flame(gp, kx - 0.03, 0.036, kz, 0.012); smoke(gp, kx, 0.062, kz, 0.009); }
  }
  for (let i = 0; i < 4; i++) rod(gp, [0.4 + i * 0.004, 0.043, 0.085], [0.43 + i * 0.002, 0.043, 0.1], 0.0025, '#6a4a2e', 4);
  // painted pottery: jars with black bands and a pointed-bottom amphora (尖底瓶)
  const red = '#b5653a';
  jar(gp, 0.415, 0.044, -0.03, 0.014, red, '#2a1d16');
  jar(gp, 0.43, 0.044, -0.01, 0.012, '#c07445', '#2a1d16');
  jar(gp, 0.4, 0.044, -0.015, 0.01, red);
  jar(gp, -0.05, 0.04, 0.12, 0.012, red, '#2a1d16');
  const amph = lathe(gp, ([[0, 0], [0.12, 0.12], [0.3, 0.5], [0.26, 0.76], [0.08, 0.9], [0.1, 1]] as [number, number][]).map(([r, v]) => [r * 0.03, v * 0.03] as [number, number]), '#c27a4a', -0.035, 0.04, 0.115, 10);
  amph.rotation.z = 0.35;
  // central hearth
  for (let i = 0; i < 8; i++) ball(gp, '#7a7468', Math.sin((i / 8) * TAU) * 0.018, 0.041, 0.04 + Math.cos((i / 8) * TAU) * 0.018, 0.006);
  flame(gp, 0, 0.04, 0.04, 0.02);
  for (let i = 0; i < 3; i++) rod(gp, [Math.sin(i * 2.1) * 0.014, 0.042, 0.04 + Math.cos(i * 2.1) * 0.014], [-Math.sin(i * 2.1) * 0.01, 0.046, 0.04 - Math.cos(i * 2.1) * 0.01], 0.002, '#4a3020', 3);
  // villagers in linen and hide
  human(gp, 0.395, 0.043, 0.075, { h: 0.04, pose: 'crouch', top: HIDE, bottom: HIDE, hair: HAIR, dress: 'knee', ry: -1.9, detail: 'lo' });
  human(gp, -0.06, 0.04, 0.16, { h: 0.042, pose: 'carry', top: LINEN, bottom: LINEN, hair: HAIR, dress: 'ankle', ry: 0.6, detail: 'lo' });
  jar(gp, -0.06 + Math.sin(0.6) * 0.009, 0.04 + 0.042 * 0.6, 0.16 + Math.cos(0.6) * 0.009, 0.011, red);
  human(gp, 0.04, 0.04, 0.0, { h: 0.04, pose: 'sitGround', top: LINEN, bottom: HIDE, hair: HAIR, ry: 2.6, detail: 'lo' });
  human(gp, -0.03, 0.04, 0.02, { h: 0.04, pose: 'sitGround', top: HIDE, bottom: LINEN, hair: HAIR, ry: 0.9, detail: 'lo' });
  human(gp, 0.005, 0.047, dIn + 0.03, { h: 0.042, pose: 'walk', phase: 0.3, top: HIDE, bottom: HIDE, hair: HAIR, dress: 'knee', ry: Math.PI, detail: 'lo' });
  // woods beyond the ditch
  for (let i = 0; i < 10; i++) {
    const a = 2.0 + (i / 9) * (TAU - 3.2), s = 0.09 + hash3(i, 2, 9) * 0.05, r = 0.41 + hash3(i, 3, 9) * 0.02;
    broadleaf(gp, Math.sin(a) * r, 0.042, Math.cos(a) * r, s, i % 3 ? '#5f7238' : '#6f7a44', i * 7);
  }
}

// ---------------------------------------------------------------------------------------------------------
// 夯土高台宫殿 Erlitou rammed-earth palace (Xia/early Shang, c. 1700 BC)
// ref: 二里头 1号宫殿 excavation report (中国社科院考古所) and 杨鸿勋's reconstruction — ~108 × 100 m terrace with the NE
// corner stepped in, galleries on all sides, an 8-bay south gate with three passages, an 8 × 3-bay main hall on its own base
// in the north of the court; rammed earth, timber posts, wattle-and-daub walls and thatch (no tile, no bronze cauldrons yet)

function lf_hangtu(gp: THREE.Group): void {
  const R = 0.46, Y = 0.03, earth = '#a08660', wood = '#5a4030', straw = '#857654', wattle = '#9a8566', floor = '#b39d78';
  land(gp, R, (x, z) => Y + (fbm(x * 7, 4, z * 7) - 0.5) * 0.008, (x, _y, z) => mix(SITE.grass, SITE.meadow, fbm(x * 12, 3, z * 12)));
  const ram = rammedP(earth);
  // the ~108 × 100 m terrace, its north-east corner stepped in (the excavated plan's notch)
  const hx = 0.27, hz = 0.25, zc = 0, nx0 = 0.12, nz0 = -0.13;
  const block = (c: string, y: number, h: number, m: number) => {
    pbox(gp, c, (-hx - m + nx0) / 2, y, zc, nx0 + hx + m, h, hz * 2 + 2 * m, ram, 0.014, 0.0065);
    pbox(gp, c, (nx0 + hx + m) / 2, y, (nz0 + hz + m) / 2, hx + m - nx0, h, hz + m - nz0, ram, 0.014, 0.0065);
  };
  block(earth, Y - 0.004, 0.034, 0.03);
  const T1 = Y + 0.03;
  block(shade(earth, 1.04), T1, 0.03, 0.012);
  const T2 = T1 + 0.03;
  pbox(gp, floor, (-hx + nx0) / 2, T2 - 0.001, zc, nx0 + hx - 0.02, 0.0012, hz * 2 - 0.02, (x, _y, z, _nx, ny) => (ny > 0.5 ? shade(floor, 0.97 + fbm(x * 0.4, 1, z * 0.4) * 0.06) : null), 0.03, 0.002);
  pbox(gp, floor, (nx0 + hx) / 2, T2 - 0.001, (nz0 + hz) / 2, hx - nx0 - 0.02, 0.0012, hz - nz0 - 0.02, (x, _y, z, _nx, ny) => (ny > 0.5 ? shade(floor, 0.97 + fbm(x * 0.4, 2, z * 0.4) * 0.06) : null), 0.03, 0.002);
  // enclosing corridor (廊庑): rammed-earth wall with a post-and-thatch gallery on its inner side; gate in the south
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const gs = grp(gp, (x0 + x1) / 2, (z0 + z1) / 2, ry, T2);
    pbox(gs, earth, 0, 0, 0, L + 0.012, 0.03, 0.012, ram, 0.012, 0.006);
    const n = Math.max(2, Math.round(L / 0.04));
    for (let i = 0; i <= n; i++) cyl(gs, wood, -L / 2 + (i / n) * L, 0, -0.026, 0.0028, 0.03, 5);
    gable(gs, L + 0.03, 0.02, 0.058, straw, 0, 0.03, -0.012);
  };
  const w = hx - 0.01, s0 = hz - 0.01, g0 = 0.085;
  side(-w, s0, -g0, s0);
  side(g0, s0, w, s0);
  side(w, s0, w, nz0 + 0.01);
  side(w, nz0 + 0.01, nx0 + 0.01, nz0 + 0.01);
  side(nx0 + 0.01, nz0 + 0.01, nx0 + 0.01, -s0);
  side(nx0 + 0.01, -s0, -w, -s0);
  side(-w, -s0, -w, s0);
  // south gate: an eight-bay gatehouse with flanking 塾 rooms and three passages
  const gz = s0;
  for (let i = 0; i <= 8; i++) for (const sz of [-1, 1]) cyl(gp, wood, -g0 + (i / 8) * g0 * 2, T2, gz + sz * 0.022, 0.0032, 0.04, 5);
  for (const sx of [-1, 1]) {
    box(gp, wattle, sx * (g0 - 0.022), T2, gz, 0.04, 0.04, 0.04);
    box(gp, earth, sx * 0.022, T2, gz, 0.006, 0.04, 0.044);
  }
  box(gp, wood, 0, T2 + 0.04, gz, g0 * 2 + 0.008, 0.005, 0.05);
  hip(gp, 0, T2 + 0.045, gz, g0 * 2 + 0.04, 0.08, 0.035, straw, { thatch: true, k: 0.2, lift: 0 });
  // dais and the great hall: 8 × 3 bays, eave posts outside wattle-and-daub walls, hipped thatch (四阿) with a double eave (重屋)
  const dz = -0.1, hcx = -0.06;
  pbox(gp, shade(earth, 1.08), hcx, T2, dz, 0.3, 0.026, 0.15, ram, 0.012, 0.0065);
  const D = T2 + 0.026, hw = 0.12, hd = 0.052, ph = 0.06;
  const nb = 8;
  for (let i = 0; i <= nb; i++) for (const sz of [-1, 1]) cyl(gp, wood, hcx - hw + (i / nb) * hw * 2, D, dz + sz * hd, 0.0042, ph, 6);
  for (const sx of [-1, 1]) for (const zz of [-hd / 3, hd / 3]) cyl(gp, wood, hcx + sx * hw, D, dz + zz, 0.0042, ph, 6);
  box(gp, wattle, hcx, D, dz - 0.004, hw * 2 - 0.016, ph * 0.86, hd * 2 - 0.012);
  for (const x of [-0.06, 0, 0.06]) box(gp, '#2a1d14', hcx + x, D, dz + hd - 0.0045, 0.018, 0.04, 0.002);
  box(gp, wood, hcx, D + ph - 0.006, dz, hw * 2 + 0.01, 0.007, hd * 2 + 0.01);
  const e1 = D + ph;
  hip(gp, hcx, e1 - 0.004, dz, 0.33, 0.19, 0.045, straw, { thatch: true, k: 0.15, lift: 0, th: 0.006 });
  box(gp, wattle, hcx, e1 + 0.01, dz, 0.18, 0.03, 0.076);
  hip(gp, hcx, e1 + 0.036, dz, 0.25, 0.135, 0.08, straw, { thatch: true, k: 0.12, lift: 0, th: 0.006 });
  // stairs: ground → terrace → court → dais
  stairs(gp, 0, Y, T1, hz + 0.042, 0.07, 0.035, shade(earth, 0.95), 4);
  stairs(gp, 0, T1, T2, hz + 0.012, 0.06, 0.03, shade(earth, 0.98), 4);
  stairs(gp, hcx, T2, D, dz + 0.075, 0.05, 0.03, shade(earth, 1.02), 3);
  for (const sx of [-1, 1]) stairs(gp, hcx + sx * 0.1, T2, D, dz + 0.075, 0.03, 0.025, shade(earth, 1.02), 3);
  // court figures: lord on the dais, kneeling attendants, guards with dagger-axes (戈) at the gate
  const robe = '#6a5a48', robe2 = '#8a7a5c';
  human(gp, hcx, D, dz + 0.064, { h: 0.042, pose: 'stand', top: '#5a3a2c', bottom: '#3a2a20', hair: HAIR, hatStyle: 'knot', dress: 'ankle', detail: 'lo' });
  human(gp, hcx - 0.03, T2, 0.03, { h: 0.04, pose: 'kneel', top: robe2, bottom: robe2, hair: HAIR, dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, hcx + 0.03, T2, 0.03, { h: 0.04, pose: 'kneel', top: robe2, bottom: robe2, hair: HAIR, dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, 0.1, T2, 0.12, { h: 0.04, pose: 'walk', phase: 0.6, top: robe, bottom: robe, hair: HAIR, dress: 'ankle', ry: -2.6, detail: 'lo' });
  for (const sx of [-1, 1]) {
    human(gp, sx * 0.04, T1, hz + 0.032, { h: 0.04, pose: 'stand', top: '#5a4a3a', bottom: '#3a3028', hair: HAIR, hatStyle: 'knot', dress: 'knee', detail: 'lo' });
    rod(gp, [sx * 0.047, T1, hz + 0.036], [sx * 0.047, T1 + 0.058, hz + 0.036], 0.0012, '#4a3020', 3);
    box(gp, '#7a7a68', sx * 0.047 + 0.005, T1 + 0.053, hz + 0.036, 0.01, 0.0025, 0.0018);
  }
  for (let i = 0; i < 9; i++) {
    const a = 0.75 + (i / 8) * (TAU - 1.5), x = Math.sin(a) * 0.42, z = Math.cos(a) * 0.42;
    if (Math.abs(x) < 0.33 && Math.abs(z) < 0.31) continue;
    broadleaf(gp, x, Y, z, 0.08 + hash3(i, 2, 3) * 0.025, '#5a6c3a', i * 3);
  }
}

// ---------------------------------------------------------------------------------------------------------
// 汉阙 Han tomb que: Gaoyi que 高颐阙, Ya'an (Eastern Han, 209). A pair of solid red-sandstone towers carved to imitate
// timber: the mother que (~6 m, 1.6 × 0.9 m, 13 courses) is a plain ashlar shaft, then a jettied 楼部 of relief friezes,
// corner brackets and beam ends under a heavy double-eaved hip roof with a bird on the ridge; a lower child que (3.4 m,
// single eave) clings to the outer side. They mark the spirit road (神道) to Gao Yi's mound, flanked by winged stone beasts
// (天禄/辟邪, ~2.2 m long) and the 高颐碑 stele (rounded head, square base). Ref: zh.wikipedia「高颐阙」; Commons "Gaoyi Que".

const reliefP = (c: string): Paint => (x, y, z, _nx, ny) => (ny > 0.7 ? c : shade(c, 0.8 + fbm(x * 0.9, y * 0.9, z * 0.9) * 0.45));
function hanQue(gp: THREE.Group, x: number, z: number, Y: number, dir: number): void {
  const x0 = x;
  const st = '#86604a', dk = shade(st, 0.8), lt = shade(st, 1.08), ash = ashlarP(st), rel = reliefP(st);
  const beams = (y: number, w: number, d: number, n: number, x = x0) => {
    for (let i = 0; i < n; i++) for (const sz of [-1, 1]) box(gp, dk, x - w / 2 + ((i + 0.5) * w) / n, y, z + sz * (d / 2 + 0.003), 0.0045, 0.0045, 0.008);
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(gp, dk, x + sx * (w / 2 + 0.003), y, z - d / 2 + ((i + 0.5) * d) / 3, 0.008, 0.0045, 0.0045);
  };
  // mother que (母阙): base, ashlar shaft with a slight batter
  pbox(gp, shade(st, 0.88), x, Y, z, 0.1, 0.012, 0.064, ash, 0.02, 0.006);
  ptaper(gp, st, x, Y + 0.012, z, 0.082, 0.048, 0.078, 0.045, 0.165, ash, 0.019, 0.0127);
  let y = Y + 0.177;
  // jettied storey (楼部): plate, beam ends, relief frieze with corner brackets, second frieze
  pbox(gp, lt, x, y, z, 0.086, 0.006, 0.05, ash, 0.02, 0.006); y += 0.006;
  beams(y, 0.086, 0.05, 6); pbox(gp, st, x, y, z, 0.088, 0.008, 0.052, rel, 0.01, 0.008); y += 0.008;
  pbox(gp, st, x, y, z, 0.094, 0.028, 0.058, rel, 0.008, 0.007);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(gp, dk, x + sx * 0.049, y + 0.004, z + sz * 0.031, 0.008, 0.02, 0.008);
    box(gp, dk, x + sx * 0.052, y + 0.022, z + sz * 0.034, 0.014, 0.006, 0.014);
  }
  y += 0.028;
  pbox(gp, lt, x, y, z, 0.106, 0.006, 0.07, ash, 0.02, 0.006); y += 0.006;
  beams(y, 0.104, 0.068, 8); y += 0.006;
  // lower eave of the double roof
  hip(gp, x, y, z, 0.13, 0.092, 0.012, dk, { k: 0.08, lift: 0.005, under: dk, hips: false }); y += 0.008;
  pbox(gp, st, x, y, z, 0.1, 0.022, 0.064, rel, 0.008, 0.007); y += 0.022;
  for (let i = 0; i < 5; i++) for (const sz of [-1, 1]) dougong(gp, x - 0.04 + i * 0.02, y - 0.004, z + sz * 0.034, 0.009, dk);
  pbox(gp, lt, x, y, z, 0.12, 0.007, 0.082, ash, 0.02, 0.007); y += 0.007;
  const top = hip(gp, x, y, z, 0.17, 0.12, 0.036, shade(st, 0.72), { k: 0.08, lift: 0.005, under: dk, ridge: shade(st, 0.6) });
  // the bird on the ridge, wings half-spread
  const bq = grp(gp, x, z, dir > 0 ? 0.3 : -0.3, top - 0.003);
  ellip(bq, dk, 0, 0.008, 0, 0.006, 0.006, 0.01, 0, -0.4);
  ellip(bq, dk, 0, 0.016, 0.008, 0.004);
  for (const sx of [-1, 1]) box(bq, dk, sx * 0.008, 0.01, 0, 0.012, 0.002, 0.008, 0, 0, sx * 0.5);
  // child que (子阙) on the outer side, single eave
  const cx = x + dir * 0.07;
  pbox(gp, shade(st, 0.88), cx, Y, z, 0.06, 0.01, 0.046, ash, 0.02, 0.006);
  ptaper(gp, st, cx, Y + 0.01, z, 0.052, 0.036, 0.048, 0.034, 0.09, ash, 0.019, 0.0129);
  let cy = Y + 0.1;
  pbox(gp, lt, cx, cy, z, 0.055, 0.005, 0.038, ash, 0.02, 0.005); cy += 0.005;
  pbox(gp, st, cx, cy, z, 0.058, 0.018, 0.042, rel, 0.008, 0.007); cy += 0.018;
  beams(cy, 0.06, 0.044, 4, cx); cy += 0.005;
  pbox(gp, lt, cx, cy, z, 0.068, 0.005, 0.05, ash, 0.02, 0.005); cy += 0.005;
  hip(gp, cx, cy, z, 0.098, 0.074, 0.022, shade(st, 0.72), { k: 0.08, lift: 0.005, under: dk, ridge: shade(st, 0.6) });
}
/** Han winged stone beast (天禄/辟邪) striding, facing +z, length ≈ s. */
function bixie(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, c: string): void {
  const gb = grp(p, x, z, ry, y), u = (v: number) => v * s, dk = shade(c, 0.82);
  box(gb, shade(c, 0.85), 0, 0, 0, u(0.42), u(0.06), u(0.95));
  y = u(0.06);
  for (const [lx, lz, a] of [[-1, 0.3, -0.25], [1, 0.22, 0.2], [-1, -0.28, 0.2], [1, -0.32, -0.25]] as V3[]) rod(gb, [lx * u(0.09), y, u(lz)], [lx * u(0.09), y + u(0.3), u(lz - a * 0.3)], u(0.045), c, 7);
  ellip(gb, c, 0, y + u(0.34), 0, u(0.12), u(0.11), u(0.44), 0, 0.1);
  ellip(gb, c, 0, y + u(0.46), u(0.3), u(0.13), u(0.15), u(0.16), 0, -0.5);
  ellip(gb, c, 0, y + u(0.6), u(0.44), u(0.085), u(0.09), u(0.16), 0, 0.25);
  ellip(gb, dk, 0, y + u(0.54), u(0.55), u(0.06), u(0.035), u(0.08), 0, 0.5);
  rod(gb, [0, y + u(0.66), u(0.4)], [0, y + u(0.74), u(0.3)], u(0.02), dk, 5);
  rod(gb, [0, y + u(0.42), u(-0.38)], [0, y + u(0.28), u(-0.55)], u(0.04), c, 6);
  for (const sx of [-1, 1]) {
    const w = slab(gb, [[0, 0], [0.22, 0.04], [0.34, 0.14], [0.2, 0.1], [0.1, 0.12]].map(([a, b]) => [-a * s, b * s] as [number, number]), u(0.025), dk, 0, false);
    w.position.set(sx * u(0.15), y + u(0.42), u(0.22));
    w.rotation.set(0, Math.PI / 2, sx * -0.15);
  }
}
function lf_que(gp: THREE.Group): void {
  const R = 0.46, Y = 0.03;
  // tomb mound (封土) at the head of the spirit road
  const mz = -0.3, mR = 0.17, mH = 0.085;
  land(gp, R, (x, z) => {
    const d = Math.hypot(x, (z - mz) * 1.15) / mR;
    return Y + (fbm(x * 6, 1, z * 6) - 0.5) * 0.006 * sstep(0.08, 0.14, Math.abs(x)) + (d < 1 ? mH * (0.5 + 0.5 * Math.cos(Math.PI * d)) ** 0.8 : 0);
  }, (x, y, z) => (y > Y + 0.01 ? mix(shade(SITE.grass, 0.92), '#86825a', fbm(x * 18, 3, z * 18)) : Math.abs(x) < 0.07 && z > -0.16 ? mix('#928a74', '#857d68', fbm(x * 30, 0, z * 30)) : mix(SITE.grass, SITE.meadow, fbm(x * 10, 2, z * 10))), 26, 80);
  // spirit road (神道)
  pbox(gp, '#9a9284', 0, Y - 0.002, 0.15, 0.09, 0.004, 0.6, (x, _y, z, _nx, ny) => (ny > 0.5 ? shade('#9a9284', 0.9 + hash3(Math.floor(x), 0, Math.floor(z)) * 0.2) : null), 0.016, 0.004);
  for (const dir of [-1, 1]) hanQue(gp, dir * 0.13, 0.17, Y, dir);
  // winged beasts flanking the road, facing south
  for (const sx of [-1, 1]) { box(gp, '#8a8276', sx * 0.085, Y, -0.02, 0.05, 0.006, 0.1); bixie(gp, sx * 0.085, Y + 0.006, -0.02, 0.1, 0, '#8c7e70'); }
  // Gao Yi stele: square base, slab with rounded head
  const sx0 = 0.12, sz0 = -0.12, sc = '#7e7468';
  box(gp, shade(sc, 0.85), sx0, Y, sz0, 0.06, 0.014, 0.04);
  const sl = slab(gp, [[-0.022, 0], [0.022, 0], [0.022, 0.1], [0.012, 0.118], [0, 0.122], [-0.012, 0.118], [-0.022, 0.1]], 0.009, sc, 0.001, false);
  sl.position.set(sx0, Y + 0.014, sz0 - 0.0045);
  add(gp, CYL(16), mat(shade(sc, 0.75)), sx0, Y + 0.12, sz0 + 0.0052, 0.008, 0.001, 0.008, 0, Math.PI / 2);
  // offering altar before the mound
  box(gp, '#8a8276', 0, Y, -0.15, 0.05, 0.016, 0.026);
  // visitors: an official's carriage and mourners in Han robes; cypresses along the road
  carriage(gp, 0.01, 0.32, 0, 0.75, Y);
  human(gp, -0.035, Y, 0.05, { h: 0.06, pose: 'walk', phase: 0.2, top: '#2e2a30', bottom: '#2e2a30', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, -0.01, Y, 0.09, { h: 0.058, pose: 'walk', phase: 0.7, top: '#d6d0c2', bottom: '#c4bdad', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, 0.02, Y, -0.12, { h: 0.058, pose: 'pray', top: '#d6d0c2', bottom: '#c4bdad', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  for (const sx of [-1, 1]) for (const z of [-0.16, -0.06, 0.04]) cypress(gp, sx * 0.16, Y, z + (sx > 0 ? 0.02 : 0), 0.11);
  for (const [x, z] of [[-0.37, 0.12], [0.36, 0.15], [-0.33, 0.27], [0.32, 0.29], [0.38, -0.12], [-0.38, -0.1]] as [number, number][]) broadleaf(gp, x, Y, z, 0.13, '#5a6a3a', x * 50 + z);
}

// ---------------------------------------------------------------------------------------------------------
// 明堂辟雍 Han/Xin Mingtang-Biyong ritual complex (Chang'an, 4 AD): round moat, square court, 天圆地方 hall
// ref: 1956–57 excavation (大土门遗址) and 王世仁《汉长安城南郊礼制建筑(大土门村遗址)原状的推测》/杨鸿勋 reconstruction —
// ~360 m round ditch, 235 m square court with central gates and L-shaped corner rooms, 62 m round platform,
// 亞-plan 台榭 centre: four wing halls (明堂/青阳/总章/玄堂) + corner rooms round a ~17 m 太室 with 五室 on top; grey tile, no gilding

function lf_mingtang(gp: THREE.Group): void {
  const R = 0.46, Y = 0.03, m0 = 0.355, m1 = 0.425;
  const tile = '#55585a', white = '#d8d1c0', col = '#8a3424', earth = '#b08c5c', st = '#a8a196';
  land(gp, R, (x, z) => { const r = Math.hypot(x, z); return Y - 0.024 * sstep(m0 - 0.006, m0 + 0.006, r) * (1 - sstep(m1 - 0.006, m1 + 0.006, r)); },
    (x, y, z) => (y < Y - 0.004 ? '#5a5040' : mix(SITE.grass, SITE.meadow, fbm(x * 10, 3, z * 10))), 26, 80);
  waterSurf(gp, R, Y - 0.012, (x, z) => { const r = Math.hypot(x, z); return r > m0 && r < m1; }, '#58715f', 26, 80);
  for (const r of [m0, m1]) lathe(gp, [[r - 0.004, Y - 0.014], [r + 0.004, Y - 0.014], [r + 0.004, Y + 0.002], [r - 0.004, Y + 0.002], [r - 0.004, Y - 0.014]], st, 0, 0, 0, 64);
  for (let i = 0; i < 4; i++) {
    const gb = grp(gp, 0, 0, (i * Math.PI) / 2);
    box(gb, st, 0, Y - 0.006, 0.39, 0.042, 0.01, 0.1);
    for (const sx of [-1, 1]) rail(gb, sx * 0.02, 0.345, sx * 0.02, 0.435, Y + 0.004, 0.01, shade(st, 1.06), 6);
  }
  // square court: paving, enclosure wall, four gatehouses, corner halls
  const H = 0.235;
  pbox(gp, '#a89e8a', 0, Y - 0.002, 0, H * 2, 0.004, H * 2, (x, _y, z, _nx, ny) => (ny > 0.5 ? shade('#a89e8a', 0.92 + hash3(Math.floor(x), 2, Math.floor(z)) * 0.14) : null), 0.02, 0.004);
  for (let i = 0; i < 4; i++) {
    const gw = grp(gp, 0, 0, (i * Math.PI) / 2);
    for (const sx of [-1, 1]) {
      pbox(gw, white, sx * 0.135, Y, H, 0.17, 0.034, 0.012, (x, y) => (y < 1 ? '#8e8678' : hash3(Math.floor(x), Math.floor(y), 4) > 0.9 ? shade(white, 0.94) : null), 0.02, 0.011);
      gable(gw, 0.18, 0.012, 0.026, tile, sx * 0.135, Y + 0.034, H);
    }
    box(gw, st, 0, Y, H, 0.1, 0.012, 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(gw, col, sx * 0.038, Y + 0.012, H + sz * 0.018, 0.0035, 0.04, 6);
    for (const sx of [-1, 1]) box(gw, white, sx * 0.03, Y + 0.012, H, 0.016, 0.04, 0.034);
    box(gw, col, 0, Y + 0.05, H, 0.09, 0.006, 0.044);
    hip(gw, 0, Y + 0.056, H, 0.12, 0.07, 0.04, tile, { k: 0.15, lift: 0.03 });
    // L-shaped corner halls (曲尺形配房)
    const cgr = grp(gw, H - 0.025, H - 0.025, 0);
    box(cgr, white, 0, Y, 0, 0.04, 0.03, 0.04);
    hip(cgr, 0, Y + 0.03, 0, 0.058, 0.058, 0.03, tile, { k: 0.15, lift: 0.03 });
    cypress(gw, 0.13, Y, 0.13, 0.08);
  }
  // round earthen platform (圆坛) and square terrace
  lathe(gp, [[0, Y], [0.172, Y], [0.17, Y + 0.03], [0, Y + 0.03]], earth, 0, 0, 0, 48);
  lathe(gp, [[0.17, Y + 0.0299], [0.175, Y + 0.03], [0.175, Y + 0.034], [0, Y + 0.034]], st, 0, 0, 0, 48);
  const P1 = Y + 0.034;
  pbox(gp, st, 0, P1, 0, 0.22, 0.034, 0.22, ashlarP(st), 0.016, 0.0085);
  const D = P1 + 0.034;
  for (let i = 0; i < 4; i++) {
    stairs(gp, 0, Y, P1, 0.168, 0.05, 0.03, '#9c9282', 4, (i * Math.PI) / 2);
    stairs(gp, 0, P1, D, 0.11, 0.04, 0.032, st, 4, (i * Math.PI) / 2);
    // cross-shaped wing halls facing the four quarters
    const gw = grp(gp, 0, 0, (i * Math.PI) / 2);
    box(gw, white, 0, D, 0.07, 0.07, 0.042, 0.04);
    for (let c = 0; c <= 4; c++) cyl(gw, col, -0.04 + c * 0.02, D, 0.093, 0.003, 0.042, 6);
    box(gw, '#3a2a20', 0, D, 0.0905, 0.02, 0.03, 0.002);
    box(gw, col, 0, D + 0.042, 0.072, 0.09, 0.006, 0.05);
    hip(gw, 0, D + 0.046, 0.075, 0.11, 0.07, 0.028, tile, { k: 0.15, lift: 0.03 });
  }
  // central 太室 (~17 m square): a square rammed-earth core faced in timber and plaster, its top a terrace (台榭) carrying
  // the five rooms (五室) — four square corner pavilions and the round central room under a round roof (上圆下方)
  box(gp, white, 0, D, 0, 0.1, 0.06, 0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(gp, col, sx * 0.05, D, sz * 0.05, 0.004, 0.06, 6);
  box(gp, col, 0, D + 0.058, 0, 0.11, 0.006, 0.11);
  const UT = D + 0.064;
  box(gp, st, 0, UT, 0, 0.104, 0.004, 0.104);
  rail(gp, -0.05, 0.05, 0.05, 0.05, UT + 0.004, 0.008, shade(col, 0.9), 8);
  rail(gp, -0.05, -0.05, 0.05, -0.05, UT + 0.004, 0.008, shade(col, 0.9), 8);
  for (const sx of [-1, 1]) rail(gp, sx * 0.05, -0.05, sx * 0.05, 0.05, UT + 0.004, 0.008, shade(col, 0.9), 8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * 0.033, cz = sz * 0.033;
    box(gp, white, cx, UT + 0.004, cz, 0.024, 0.024, 0.024);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) cyl(gp, col, cx + ax * 0.012, UT + 0.004, cz + az * 0.012, 0.0022, 0.024, 5);
    hip(gp, cx, UT + 0.028, cz, 0.036, 0.036, 0.016, tile, { k: 0.15, lift: 0.02 });
  }
  const RY = UT + 0.004;
  storey(gp, 0, RY, 0, 12, 0.026, 0.04, col, white);
  lathe(gp, [[0.03, RY + 0.038], [0.031, RY + 0.042], [0, RY + 0.042]], col, 0, 0, 0, 16);
  const top = proof(gp, 0, RY + 0.042, 0, { n: 16, R0: 0.046, R1: 0.008, h: 0.034, lift: 0, k: 0.15, tile, sub: 2 });
  lathe(gp, [[0, 0], [0.007, 0], [0.006, 0.006], [0.002, 0.012], [0, 0.014]], '#6a645c', 0, top - 0.002, 0, 10);
  // four corner rooms (夹室) between the wing halls make the 亞-shaped plan
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(gp, white, sx * 0.07, D, sz * 0.07, 0.035, 0.034, 0.035);
    hip(gp, sx * 0.07, D + 0.034, sz * 0.07, 0.048, 0.048, 0.018, tile, { k: 0.15, lift: 0.02 });
  }
  // procession of officials on the south axis
  for (let i = 0; i < 5; i++) human(gp, (i % 2 ? 1 : -1) * 0.011, Math.abs(0.2 + i * 0.034 - H) < 0.025 ? Y + 0.012 : Y, 0.2 + i * 0.034, { h: 0.036, pose: 'walk', phase: i * 0.27, top: i === 0 ? '#7a2a20' : '#2e2a30', bottom: '#2a2428', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: Math.PI, detail: 'lo' });
}

// ---------------------------------------------------------------------------------------------------------
// 铜雀台 Cao Cao's Bronze Sparrow Terrace (Ye 邺城, 210 AD)
// Three high rammed-earth (夯土) terraces built on the north-west city wall of Ye in a N–S line — 金虎台 and 冰井台 (8 丈)
// flanking the 10-丈 铜雀台 — joined by elevated covered galleries (阁道); the earth cores were laced with timber beams (纴木)
// and carried multi-storey halls, the top one crowned by a great bronze sparrow. Ref: 《水经注·浊漳水》; 邺城考古队 excavations.

function flag(p: THREE.Object3D, x: number, y: number, z: number, h: number, c: string): void {
  rod(p, [x, y, z], [x, y + h, z], h * 0.016, '#4a3020', 4);
  const fg = anim(p, 'sway', x, y + h, z);
  box(fg, c, h * 0.13, -h * 0.4, 0, h * 0.26, h * 0.38, 0.002);
}
function lf_tongque(gp: THREE.Group): void {
  const R = 0.46, Y = 0.03, brick = '#a88a64', wood = '#5a3a26', col = '#8e2f22', white = '#e6dfcf', tile = '#4f4c4a';
  land(gp, R, (x, z) => Y + (fbm(x * 6, 5, z * 6) - 0.5) * 0.006, (x, _y, z) => (Math.abs(x) < 0.1 && z > 0 ? mix('#a08a66', '#94805e', fbm(x * 30, 0, z * 30)) : mix(SITE.meadow, '#9a8c62', fbm(x * 10, 7, z * 10))));
  const bp = rammedP(brick), zc = -0.07, H = 0.28, T = Y + H;
  // Ye's west city wall (rammed earth with a parapet), on which the three terraces stand in a north–south line
  ptaper(gp, brick, 0, Y, zc, 0.86, 0.1, 0.84, 0.075, 0.1, bp, 0.02, 0.0065);
  for (let i = 0; i < 22; i++) { const x = -0.42 + i * 0.04; if (Math.abs(x) < 0.2 || Math.abs(Math.abs(x) - 0.33) < 0.09) continue; box(gp, shade(brick, 0.95), x, Y + 0.1, zc - 0.03, 0.026, 0.014, 0.012); }
  ptaper(gp, brick, 0, Y, zc, 0.36, 0.28, 0.3, 0.23, H, bp, 0.02, 0.0065);
  for (const t of [0.34, 0.67]) {
    const w = 0.36 - 0.06 * t, d = 0.28 - 0.05 * t;
    box(gp, wood, 0, Y + H * t, zc, w + 0.006, 0.006, d + 0.006);
  }
  box(gp, shade(brick, 0.9), 0, T, zc, 0.31, 0.008, 0.24);
  const ty = T + 0.008;
  rail(gp, -0.15, zc + 0.115, -0.05, zc + 0.115, ty, 0.012, col, 6);
  rail(gp, 0.05, zc + 0.115, 0.15, zc + 0.115, ty, 0.012, col, 6);
  rail(gp, -0.15, zc - 0.115, 0.15, zc - 0.115, ty, 0.012, col, 14);
  for (const sx of [-1, 1]) { rail(gp, sx * 0.15, zc - 0.115, sx * 0.15, zc - 0.06, ty, 0.012, col, 3); rail(gp, sx * 0.15, zc + 0.03, sx * 0.15, zc + 0.115, ty, 0.012, col, 4); }
  // long front stair with parapets
  stairs(gp, 0, Y, ty, zc + 0.115, 0.06, 0.29, '#9c8c72', 22, 0, shade(brick, 0.88));
  // three-storey pavilion crowned by the gilded sparrow
  const storeyBox = (y: number, w: number, d: number, h: number) => {
    box(gp, white, 0, y, zc, w - 0.012, h, d - 0.012);
    const nx = Math.round(w / 0.03), nz = Math.round(d / 0.03);
    for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) cyl(gp, col, -w / 2 + (i / nx) * w, y, zc + (sz * d) / 2, 0.004, h, 6);
    for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) cyl(gp, col, (sx * w) / 2, y, zc - d / 2 + (i / nz) * d, 0.004, h, 6);
    for (let i = 0; i < nx; i++) box(gp, i % 2 ? '#3a2a20' : '#6a3a26', -w / 2 + ((i + 0.5) / nx) * w, y + 0.004, zc + d / 2 - 0.005, 0.018, h * 0.72, 0.002);
    box(gp, '#6a3a26', 0, y + h, zc, w + 0.008, 0.007, d + 0.008);
  };
  storeyBox(ty, 0.17, 0.13, 0.055);
  hip(gp, 0, ty + 0.062, zc, 0.23, 0.18, 0.026, tile, { k: 0.2, lift: 0.12 });
  storeyBox(ty + 0.072, 0.13, 0.1, 0.045);
  rail(gp, -0.08, zc + 0.065, 0.08, zc + 0.065, ty + 0.072, 0.01, col, 10);
  hip(gp, 0, ty + 0.124, zc, 0.18, 0.14, 0.022, tile, { k: 0.2, lift: 0.12 });
  storeyBox(ty + 0.132, 0.095, 0.075, 0.04);
  const top = hip(gp, 0, ty + 0.179, zc, 0.15, 0.115, 0.055, tile, { k: 0.35, lift: 0.14 });
  sparrow(gp, 0, top - 0.004, zc, 0.075);
  // side terraces (金虎台 / 冰井台) linked by covered flying bridges (飞阁)
  const SH = 0.22, sx0 = 0.33, sz0 = -0.06;
  for (const sx of [-1, 1]) {
    const x = sx * sx0;
    ptaper(gp, brick, x, Y, sz0, 0.15, 0.15, 0.12, 0.12, SH, bp, 0.02, 0.0065);
    box(gp, wood, x, Y + SH * 0.5, sz0, 0.14, 0.006, 0.14);
    const sT = Y + SH;
    box(gp, white, x, sT, sz0, 0.07, 0.04, 0.06);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) cyl(gp, col, x + ax * 0.037, sT, sz0 + az * 0.032, 0.0035, 0.04, 6);
    box(gp, '#6a3a26', x, sT + 0.04, sz0, 0.082, 0.006, 0.072);
    hip(gp, x, sT + 0.045, sz0, 0.11, 0.095, 0.04, tile, { k: 0.3, lift: 0.12 });
    rail(gp, x - 0.058, sz0 + 0.058, x + 0.058, sz0 + 0.058, sT, 0.01, col, 6);
    const x0 = sx * 0.15, y0 = ty + 0.004, x1 = sx * (sx0 - 0.06), y1 = sT + 0.004, L = Math.hypot(x1 - x0, y1 - y0);
    const gb = grp(gp, (x0 + x1) / 2, sz0, 0, (y0 + y1) / 2);
    gb.rotation.z = -sx * Math.atan2(y0 - y1, Math.abs(x1 - x0));
    box(gb, wood, 0, -0.008, 0, L + 0.01, 0.008, 0.04);
    for (let i = 0; i <= 5; i++) for (const sz of [-1, 1]) cyl(gb, col, -L / 2 + (i / 5) * L, 0, sz * 0.017, 0.0025, 0.032, 5);
    for (const sz of [-1, 1]) box(gb, col, 0, 0.008, sz * 0.017, L, 0.006, 0.002);
    gable(gb, L + 0.012, 0.016, 0.05, tile, 0, 0.032, 0);
    for (const t of [0.3, 0.7]) { const px = x0 + (x1 - x0) * t; box(gp, wood, px, Y, sz0, 0.008, y0 + (y1 - y0) * t - Y - 0.01, 0.008); }
  }
  // court on the terrace, guards and banners at the foot
  human(gp, 0, ty, zc + 0.09, { h: 0.05, pose: 'point', top: '#3a2a3a', bottom: '#2a2028', hair: HAIR, hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  human(gp, -0.05, ty, zc + 0.085, { h: 0.048, pose: 'stand', top: '#7a2a20', bottom: '#4a2020', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: 0.4, detail: 'lo' });
  human(gp, 0.06, ty, zc + 0.08, { h: 0.048, pose: 'pray', top: '#4a5a6a', bottom: '#2a3038', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: -0.5, detail: 'lo' });
  for (const sx of [-1, 1]) {
    for (const z of [0.38, 0.32]) human(gp, sx * 0.055, Y, z, { h: 0.054, pose: 'stand', top: '#6a2a20', bottom: '#2a2420', hair: HAIR, hatStyle: 'helmet', armor: '#3a3632', dress: 'knee', detail: 'lo' });
    flag(gp, sx * 0.075, Y, 0.35, 0.11, '#a82a20');
  }
  for (const [x, z] of [[-0.3, 0.2], [0.3, 0.22], [-0.2, 0.3], [0.21, 0.31], [0.0, -0.33], [-0.2, -0.3], [0.2, -0.29]] as [number, number][]) broadleaf(gp, x, Y, z, 0.1 + hash3(x * 9, z * 9, 1) * 0.03, '#5f6e3a', x * 20 + z);
}

// ---------------------------------------------------------------------------------------------------------
// 灵渠 Qin Lingqu canal (214 BC): ploughshare spillway, ∧ weirs, south canal with a lock gate
// ref: zh.wikipedia 灵渠; 广西兴安灵渠 survey data (铧嘴 ~171 × 23 m; 大天平 344 m, 小天平 ~130 m, ∧ at ~108°, 鱼鳞石 apron;
// 陡门 = paired half-round ashlar 陡盘 ~5–6 m apart, closed with 陡杠 bars and 陡簟 bamboo mats); 兴安 karst hills, bamboo

type P2 = [number, number];
function segDist(x: number, z: number, a: P2, b: P2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
const polyDist = (x: number, z: number, pl: P2[]) => { let d = 9; for (let i = 0; i < pl.length - 1; i++) d = Math.min(d, segDist(x, z, pl[i], pl[i + 1])); return d; };
function lf_lingqu(gp: THREE.Group): void {
  const R = 0.46, BANK = 0.07, BED = 0.032, UP = 0.057, DOWN = 0.046, rhw = 0.165, chw = 0.028;
  const stone = '#9d978a', wood = '#5a3a24';
  const south: P2[] = [[-0.165, -0.045], [-0.235, 0.02], [-0.272, 0.15], [-0.29, 0.6]];
  const north: P2[] = [[0.16, 0.0], [0.24, -0.05], [0.33, -0.15], [0.55, -0.27]];
  // 小天平 (~130 m) runs to the south-canal bank, 大天平 (~344 m) to the north bank, ~108° apart
  const apex: P2 = [-0.08, -0.04], wl: P2 = [-0.172, 0.02], wr: P2 = [0.168, 0.15];
  const weirZ = (x: number) => (x < apex[0] ? apex[1] + ((apex[0] - x) / (apex[0] - wl[0])) * (wl[1] - apex[1]) : apex[1] + ((x - apex[0]) / (wr[0] - apex[0])) * (wr[1] - apex[1]));
  const mask = (d: number, hw: number) => 1 - sstep(hw - 0.008, hw + 0.01, d);
  const hf: HF = (x, z) => {
    const m = Math.max(mask(Math.abs(x), rhw), mask(polyDist(x, z, south), chw), mask(polyDist(x, z, north), chw));
    const base = BANK + (fbm(x * 9, 1, z * 9) - 0.5) * 0.008;
    return base - m * (base - BED);
  };
  land(gp, R, hf, (x, y, z, sl) => {
    if (y < BED + 0.006) return mix('#6a6450', '#5a5444', fbm(x * 20, 0, z * 20));
    if (sl > 0.25) return shade(stone, 0.86 + hash3(Math.floor(x * 70), Math.floor(y * 140), Math.floor(z * 70)) * 0.24);
    return mix(SITE.grass, SITE.meadow, fbm(x * 11, 4, z * 11));
  }, 30, 100);
  const inCanal = (x: number, z: number) => polyDist(x, z, south) < chw + 0.012 || polyDist(x, z, north) < chw + 0.012;
  waterSurf(gp, R, UP, (x, z) => (Math.abs(x) < rhw + 0.012 && z < weirZ(x) + 0.006) || inCanal(x, z), '#58715f', 30, 100);
  waterSurf(gp, R, DOWN, (x, z) => Math.abs(x) < rhw + 0.012 && z > weirZ(x) - 0.006 && !inCanal(x, z), '#58715f', 30, 100);
  // 铧嘴: a long, low ashlar ploughshare (~171 × 23 m, ~2 m above water) pointing upstream just ahead of the weir apex,
  // splitting the Xiang roughly 3:7 between the south and north channels
  const plan: P2[] = [[-0.08, -0.235], [-0.07, -0.205], [-0.064, -0.15], [-0.066, -0.095], [-0.08, -0.07], [-0.094, -0.095], [-0.096, -0.15], [-0.09, -0.205]];
  prism(gp, plan, BED, UP + 0.006 - BED, stone);
  prism(gp, plan.map(([x, z]) => [-0.08 + (x + 0.08) * 0.8, -0.15 + (z + 0.15) * 0.94] as P2), UP + 0.006, 0.002, shade(stone, 1.08));
  for (let i = 0; i < 3; i++) add(gp, ICO(), mat('#c6cfcb', { transparent: 0.5 }), -0.08 + (i - 1) * 0.008, UP, -0.238 + Math.abs(i - 1) * 0.006, 0.006, 0.0012, 0.01, (i - 1) * 0.6);
  // 大天平 / 小天平: low stone weirs in a ∧; water spills over the whole crest down a 鱼鳞石 apron (stones set on edge)
  const scaleP: Paint = (x, _y, z, _nx, ny) => (ny > 0.7 ? shade(stone, 0.8 + hash3(Math.floor(x), Math.floor(z + (Math.floor(x) & 1) * 0.5), 9) * 0.3) : null);
  for (const end of [wl, wr]) {
    const dx = end[0] - apex[0], dz = end[1] - apex[1], L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), ds = Math.cos(ry) > 0 ? 1 : -1;
    const gw = grp(gp, (apex[0] + end[0]) / 2, (apex[1] + end[1]) / 2, ry);
    pbox(gw, stone, 0, BED, 0, L + 0.01, UP + 0.003 - BED, 0.016, ashlarP(stone), 0.012, 0.006);
    const ga = grp(gw, 0, ds * 0.022, 0, (UP + DOWN) / 2 - 0.003);
    ga.rotation.x = ds * 0.32;
    pbox(ga, stone, 0, 0, 0, L, 0.003, 0.03, scaleP, 0.0045, 0.003);
    add(ga, BOX(), mat('#b7c2bd', { transparent: 0.35 }), 0, 0.0038, 0, L, 0.0008, 0.03);
    add(gw, BOX(), mat('#b7c2bd', { transparent: 0.3 }), 0, UP + 0.0035, 0, L, 0.0008, 0.016);
    for (let i = 0; i < Math.round(L / 0.012); i++) {
      const u = hash3(i, Math.round(L * 100), 5);
      add(gw, ICO(), mat('#c6cfcb', { transparent: 0.6 }), -L / 2 + (i + 0.3 + u * 0.4) * 0.012, DOWN + 0.0005, ds * (0.04 + u * 0.006), 0.006 + u * 0.003, 0.001, 0.003, u);
    }
  }
  // stone embankment walls along the south canal (the river side), lock gate (陡门) and a canal boat
  for (let i = 0; i < south.length - 1; i++) {
    const a = south[i], b = [south[i + 1][0], Math.min(south[i + 1][1], 0.37)] as P2;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    const nx = dz / L, nz = -dx / L;
    for (const s of [1, -1]) {
      if (i === 0 && s < 0) continue;
      const gw = grp(gp, (a[0] + b[0]) / 2 + nx * s * (chw + 0.004), (a[1] + b[1]) / 2 + nz * s * (chw + 0.004), ry);
      pbox(gw, stone, 0, BED, 0, L, BANK + 0.004 - BED, 0.008, ashlarP(stone), 0.012, 0.006);
    }
  }
  {
    const a = south[1], b = south[2], ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const gl = grp(gp, a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, ry);
    // 陡门: two half-round ashlar abutments (陡盘) pinch the canal to a ~5 m gap, closed by timber bars (陡杠) and bamboo mats (陡簟)
    for (const sx of [-1, 1]) {
      pbox(gl, shade(stone, 1.04), sx * (chw + 0.004), BED, 0, 0.016, BANK + 0.004 - BED, 0.032, ashlarP(stone), 0.008, 0.006);
      cyl(gl, shade(stone, 1.04), sx * (chw - 0.004), BED, 0, 0.016, BANK + 0.004 - BED, 14);
      cyl(gl, shade(stone, 0.95), sx * (chw - 0.004), BANK + 0.004, 0, 0.0165, 0.002, 14);
      cyl(gl, stone, sx * (chw + 0.02), BANK, -0.03, 0.0035, 0.016, 6);
    }
    for (const y of [BED + 0.004, UP - 0.004, UP + 0.006]) box(gl, wood, 0, y, -0.017, 0.024, 0.0035, 0.004);
    const mt = box(gl, '#a08a56', 0, 0, 0, 0.018, 0.02, 0.002);
    mt.position.set(0, UP - 0.008, -0.014);
    mt.rotation.x = -0.2;
    for (let i = 0; i < 4; i++) box(gl, wood, chw + 0.024, BANK + i * 0.0035, 0.03 + (i & 1) * 0.002, 0.004, 0.0035, 0.034);
    // boat with a woven canopy and a punting boatman
    const gb = grp(gl, 0, 0.075, 0, UP);
    lathe(gb, [[0, -0.004], [0.011, -0.002], [0.012, 0.006], [0, 0.006]], '#6a4a2e', 0, 0, 0, 10).scale.set(1, 1, 3.4);
    add(gb, g('la1:hcyl', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, -Math.PI / 2, Math.PI)), mat('#8a7048', { flat: true }), 0, 0.006, -0.006, 0.011, 0.028, 0.011, 0, -Math.PI / 2);
    human(gb, 0, 0.006, 0.022, { h: 0.04, pose: 'reach', top: '#4a5a6a', bottom: '#3a3a3a', hair: HAIR, hat: '#c8b070', hatStyle: 'conical', detail: 'lo' });
    rod(gb, [0.012, -0.012, 0.03], [0.004, 0.06, 0.018], 0.0012, '#7a5a3a', 3);
  }
  // karst peaks of Guangxi, trees, people on the embankment
  const peak = (x: number, z: number, s: number) => {
    const n = 12, rings: V3[][] = [];
    for (const t of [0, 0.15, 0.35, 0.55, 0.72, 0.85, 0.94, 1]) {
      const rr = s * 0.28 * (t < 0.85 ? 1 - 0.25 * t : Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) * 0.79) + 0.001;
      rings.push(Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU, k = 1 + (hash3(i, Math.round(t * 20), Math.round(x * 100)) - 0.5) * 0.35; return [x + Math.sin(a) * rr * k, BANK - 0.01 + t * s, z + Math.cos(a) * rr * k] as V3; }));
    }
    skin(gp, rings, '#8a8676', { caps: true, flat: true, paint: (px, py, pz, _nx, ny) => (ny > 0.45 || fbm(px * 40, py * 40, pz * 40) > 0.62 ? mix('#4f7440', '#668a4c', hash3(Math.floor(px * 90), Math.floor(py * 90), 1)) : shade('#8a8676', 0.85 + hash3(Math.floor(px * 80), Math.floor(py * 120), 2) * 0.25)) });
  };
  peak(-0.3, -0.22, 0.28);
  peak(-0.215, -0.33, 0.2);
  peak(0.245, -0.3, 0.22);
  peak(-0.385, -0.06, 0.15);
  const bamboo = (x: number, z: number, s: number) => {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + x * 50, lean = 0.12 + hash3(i, Math.round(x * 100), 3) * 0.2, h = s * (0.75 + hash3(i, 3, Math.round(z * 100)) * 0.25);
      const tx = x + Math.sin(a) * lean * h, tz = z + Math.cos(a) * lean * h;
      rod(gp, [x + Math.sin(a) * 0.003, BANK, z + Math.cos(a) * 0.003], [tx, BANK + h, tz], 0.002, '#74804c', 3);
      add(gp, ICO(), mat(shade('#5c7042', 0.9 + hash3(i, 5, 5) * 0.2), { flat: true }), (x + tx) / 2 + (tx - x) * 0.25, BANK + h * 0.8, (z + tz) / 2 + (tz - z) * 0.25, 0.012, h * 0.28, 0.012, a);
    }
  };
  broadleaf(gp, 0.24, BANK, 0.12, 0.07, '#4f6e3a', 1);
  broadleaf(gp, 0.27, BANK, 0.26, 0.08, '#56743c', 2);
  broadleaf(gp, -0.36, BANK, -0.05, 0.065, '#4f6e3a', 3);
  broadleaf(gp, 0.36, BANK, 0.05, 0.07, '#56743c', 4);
  bamboo(-0.21, 0.3, 0.07);
  bamboo(0.19, 0.37, 0.065);
  bamboo(-0.36, 0.12, 0.06);
  human(gp, -0.2, BANK, 0.2, { h: 0.042, pose: 'walk', phase: 0.3, top: '#4a4038', bottom: '#2a2420', hair: HAIR, hatStyle: 'knot', dress: 'knee', ry: Math.PI - 0.3, detail: 'lo' });
  human(gp, -0.215, BANK, 0.25, { h: 0.042, pose: 'carry', top: '#6a5a40', bottom: '#3a3020', hair: HAIR, hat: '#c8b070', hatStyle: 'conical', ry: Math.PI - 0.3, detail: 'lo' });
  human(gp, 0.2, BANK, 0.18, { h: 0.042, pose: 'point', top: '#2e2a30', bottom: '#2a2428', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: -1.2, detail: 'lo' });
}

// ---------------------------------------------------------------------------------------------------------
// 石窟 Buddhist cave-temple cliff: Yungang Cave 20 (云冈, 460s) or Longmen Fengxian group (龙门奉先寺, 675)

interface Niche { cx: number; y0: number; y1: number; hw: number; D: number; arch?: boolean; dark?: boolean }
interface CliffO { XW: number; Y: number; Ht: number; base: (x: number) => number; lean: number; niches: Niche[]; c: string; top: string }
function nicheQ(n: Niche, x: number, y: number): number {
  const u = Math.abs(x - n.cx) / n.hw, v = (y - n.y0) / (n.y1 - n.y0);
  if (v < 0 || v > 1 || u > 1) return 1;
  if (n.arch) { const vs = 0.55; return v <= vs ? u : Math.hypot(u, (v - vs) / (1 - vs)); }
  return (u ** 8 + Math.abs(2 * v - 1) ** 8) ** 0.125;
}
/** Sculpted cliff: a front heightfield (z = f(x, y)) with carved niches, a scrubby top, back and side walls. Returns the face function. */
function cliff(gp: THREE.Group, o: CliffO): (x: number, y: number) => number {
  const R = 0.455, back = (x: number) => -Math.sqrt(R * R - x * x) + 0.012;
  const carve = (x: number, y: number) => {
    let d = 0, dark = false, small = false;
    for (const n of o.niches) {
      const q = nicheQ(n, x, y);
      if (q >= 1) continue;
      const dd = n.D * Math.min(1, (1 - q) * 6) ** 0.5;
      if (dd > d) { d = dd; dark = !!n.dark && q < 0.86; small = n.D < 0.035; }
    }
    return { d, dark, small };
  };
  const front = (x: number, y: number) => {
    const t = (y - o.Y) / (o.Ht - o.Y), cv = carve(x, y);
    return o.base(x) - o.lean * t - cv.d + (fbm(x * 9, y * 9, 1) - 0.5) * 0.026 * (cv.d > 0.03 ? 0.25 : 1);
  };
  const s = new Soup(), NX = 76, NY = 56, c = o.c;
  const P = (i: number, j: number): V3 => { const x = -o.XW + (2 * o.XW * i) / NX, y = o.Y - 0.012 + ((o.Ht - o.Y + 0.012) * j) / NY; return [x, y, front(x, y)]; };
  const stone = (x: number, y: number, z: number) => shade(c, 0.9 + 0.07 * Math.sin(y * 95 + fbm(x * 5, y * 3, z * 5) * 6) + hash3(Math.floor(x * 120), Math.floor(y * 120), 3) * 0.08);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
    const cx = (a[0] + cc[0]) / 2, cy = (a[1] + cc[1]) / 2, cz = (a[2] + cc[2]) / 2, cv = carve(cx, cy);
    s.quad(a, b, cc, d, cv.dark ? '#2b241e' : cv.small ? shade(stone(cx, cy, cz), 0.8) : stone(cx, cy, cz), [0, 0, 1]);
  }
  const NT = 4;
  for (let i = 0; i < NX; i++) {
    const x0 = -o.XW + (2 * o.XW * i) / NX, x1 = -o.XW + (2 * o.XW * (i + 1)) / NX;
    const T = (x: number, k: number): V3 => { const zf = front(x, o.Ht), t = k / NT; return [x, o.Ht + (k > 0 ? 0.004 + (fbm(x * 14, k, 2) - 0.3) * 0.02 : 0), zf + (back(x) - zf) * t]; };
    for (let k = 0; k < NT; k++) s.quad(T(x0, k), T(x1, k), T(x1, k + 1), T(x0, k + 1), k === 0 ? stone(x0, o.Ht, 0) : mix(o.top, shade(o.top, 0.8), hash3(i, k, 5)), [0, 1, 0]);
    const b0 = T(x0, NT), b1 = T(x1, NT);
    s.quad(b0, b1, [x1, 0, back(x1)], [x0, 0, back(x0)], shade(c, 0.78), [(x0 + x1) / 2, 0, back(x0)]);
  }
  for (const sx of [-1, 1]) {
    const x = sx * o.XW, zb = back(x);
    for (let j = -1; j < NY; j++) {
      const y0 = j < 0 ? 0 : P(0, j)[1], y1 = P(0, j + 1)[1];
      const za = j < 0 ? front(x, o.Y - 0.012) : front(x, y0), zb1 = front(x, y1);
      s.quad([x, y0, za], [x, y1, zb1], [x, y1, zb], [x, y0, zb], shade(stone(x, y0, za), 0.9), [sx, 0, 0]);
    }
    const tz = front(x, o.Ht);
    for (let k = 0; k < NT; k++) {
      const z0 = tz + ((zb - tz) * k) / NT, z1 = tz + ((zb - tz) * (k + 1)) / NT, h0 = k > 0 ? 0.004 + (fbm(x * 14, k, 2) - 0.3) * 0.02 : 0, h1 = 0.004 + (fbm(x * 14, k + 1, 2) - 0.3) * 0.02;
      s.quad([x, o.Ht, z0], [x, o.Ht, z1], [x, o.Ht + (k + 1 < NT ? h1 : h1), z1], [x, o.Ht + h0, z0], shade(c, 0.85), [sx, 0, 0]);
    }
  }
  s.build(gp, { rough: 0.95 });
  return front;
}
function lf_grotto(gp: THREE.Group, r: ModelRecipe): void {
  const longmen = r.style === 'longmen';
  const R = 0.46;
  if (!longmen) {
    // Yungang Cave 20 (昙曜五窟, c. 460–465): the front wall and timber porch collapsed early, so the 13.7 m seated Buddha
    // (robe over the left shoulder, dhyāna mudrā) sits in the open air before a flame-patterned mandorla carved with small
    // Buddhas; the standing Buddha survives on its east (+x) side, the west one has fallen. Weathered pink-buff sandstone,
    // overhanging bedded cliff top. Neighbours: Cave 19 (east) and 21 (west) show the usual door + light-window (门+明窗).
    // Ref: Commons "Yungang Grottoes Cave 20"; 云冈石窟研究院.
    const Y = 0.034, c = '#b8987a', sc = '#b39072';
    land(gp, R, (x, z) => Y + (fbm(x * 8, 2, z * 8) - 0.5) * 0.006, (x, _y, z) => mix('#ad9573', '#a08a6c', fbm(x * 16, 1, z * 16)));
    const niches: Niche[] = [
      { cx: 0.01, y0: Y + 0.0, y1: Y + 0.5, hw: 0.29, D: 0.12, arch: true },
      { cx: 0.345, y0: Y - 0.005, y1: Y + 0.13, hw: 0.04, D: 0.09, arch: true, dark: true },
      { cx: 0.345, y0: Y + 0.18, y1: Y + 0.27, hw: 0.034, D: 0.07, dark: true },
      { cx: -0.35, y0: Y - 0.005, y1: Y + 0.09, hw: 0.03, D: 0.07, arch: true, dark: true },
      { cx: -0.35, y0: Y + 0.14, y1: Y + 0.2, hw: 0.026, D: 0.06, dark: true },
    ];
    const small: [number, number][] = [];
    for (const x of [-0.385, -0.335]) for (const y of [0.29, 0.36, 0.43]) small.push([x, Y + y]);
    for (const x of [0.32, 0.375]) for (const y of [0.35, 0.42]) small.push([x, Y + y]);
    for (const x of [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2]) small.push([x, Y + 0.545]);
    for (const [x, y] of small) niches.push({ cx: x, y0: y - 0.026, y1: y + 0.026, hw: 0.019, D: 0.02, arch: true });
    const face = cliff(gp, { XW: 0.42, Y, Ht: Y + 0.62, base: x => -0.03 - 0.09 * (x / 0.42) ** 2, lean: -0.02, niches, c, top: '#8a8456' });
    // bedded, overhanging ledges at the top of the cliff
    for (let i = 0; i < 9; i++) {
      const x = -0.36 + i * 0.09 + (hash3(i, 1, 7) - 0.5) * 0.03, yy = Y + 0.56 + hash3(i, 2, 7) * 0.05;
      box(gp, shade(c, 0.85 + hash3(i, 3, 7) * 0.12), x, yy, face(x, yy) + 0.004, 0.07 + hash3(i, 4, 7) * 0.05, 0.022, 0.035, (hash3(i, 5, 7) - 0.5) * 0.3);
    }
    // flame-pattern mandorla with a band of small seated Buddhas behind the great Buddha
    const bx = -0.02, bz = -0.115, my = Y + 0.04;
    const arch = (w: number, h: number): P2[] => { const o: P2[] = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; o.push([Math.cos(a) * w, h * 0.55 + Math.sin(a) * h * 0.45 * (1 + 0.25 * Math.sin(a) ** 6)]); } o.push([-w, 0], [w, 0]); return o; };
    for (const [w, h, cc, d] of [[0.25, 0.47, shade(c, 0.86), 0.004], [0.2, 0.42, shade(c, 0.96), 0.008], [0.14, 0.36, shade(c, 0.88), 0.012]] as [number, number, string, number][]) {
      const m = slab(gp, arch(w, h), 0.004, cc, 0, false);
      m.position.set(bx, my, face(bx, my + 0.25) + d);
    }
    for (let i = 0; i < 9; i++) {
      const a = 0.25 + (i / 8) * (Math.PI - 0.5), xx = bx + Math.cos(a) * 0.175, yy = my + 0.21 + Math.sin(a) * 0.17;
      seated(gp, xx, yy - 0.014, face(bx, my + 0.25) + 0.014, 0.03, shade(sc, 0.95));
    }
    box(gp, shade(sc, 0.88), bx, Y, bz + 0.01, 0.34, 0.03, 0.16);
    seated(gp, bx, Y + 0.03, bz, 0.47, sc);
    // surviving east standing Buddha with its own halo; rubble where the west one fell
    const ex = 0.215, ez = face(ex, Y + 0.15) + 0.04;
    add(gp, CYL(20), mat(shade(c, 0.9)), ex, Y + 0.25, ez - 0.05, 0.06, 0.005, 0.06, 0, Math.PI / 2);
    statue(gp, ex, Y + 0.012, ez, 0.27, sc, 'buddha', -0.15);
    for (let i = 0; i < 7; i++) {
      const x = -0.235 + (hash3(i, 1, 9) - 0.5) * 0.08, z = face(-0.235, Y + 0.05) + 0.03 + hash3(i, 2, 9) * 0.05;
      ellip(gp, shade(sc, 0.8 + hash3(i, 3, 9) * 0.2), x, Y + 0.008, z, 0.012 + hash3(i, 4, 9) * 0.014, 0.01, 0.012, hash3(i, 5, 9));
    }
    for (const [x, y] of small) if (hash3(x * 100, y * 100, 1) > 0.2) seated(gp, x, y - 0.022, face(x, y) + 0.006, 0.036, sc);
    // monks, a pilgrim, incense burner, pines and elms on the river terrace
    lathe(gp, [[0, 0], [0.012, 0], [0.008, 0.02], [0.02, 0.03], [0.018, 0.045], [0, 0.04]], '#4e463c', bx, Y, 0.1, 10);
    smoke(gp, bx, Y + 0.05, 0.1, 0.008);
    human(gp, -0.07, Y, 0.17, { h: 0.045, pose: 'pray', top: '#6e5a44', bottom: '#4e4034', hair: null, dress: 'ankle', ry: Math.PI, detail: 'lo' });
    human(gp, 0.04, Y, 0.19, { h: 0.045, pose: 'stand', top: '#6a6560', bottom: '#4a4642', hair: null, dress: 'ankle', ry: Math.PI + 0.3, detail: 'lo' });
    human(gp, 0.17, Y, 0.31, { h: 0.045, pose: 'walk', phase: 0.4, top: '#5a4a3a', bottom: '#3a2a20', hair: HAIR, hatStyle: 'knot', dress: 'knee', ry: Math.PI - 0.4, detail: 'lo' });
    for (const [x, z, k] of [[-0.3, 0.2, 0], [-0.37, 0.07, 1], [0.38, 0.08, 0], [0.32, 0.25, 1], [-0.2, 0.36, 0]] as V3[]) {
      if (k) cypress(gp, x, Y, z, 0.11, '#3e5034'); else broadleaf(gp, x, Y, z, 0.1, '#6a7444', x * 31);
    }
    return;
  }
  // Longmen Fengxian-si group (奉先寺, 672–675): a U-shaped open niche ~36 m wide cut into grey limestone above the Yi river.
  // Vairocana (卢舍那, 17.14 m, robe over both shoulders, on an octagonal lotus throne) before a huge flame mandorla; along the
  // back wall disciples Kāśyapa/Ānanda and two bodhisattvas, on the side walls, turned inward, a heavenly king and a vajra
  // guardian (力士) each. Ref: Commons "Longmen Fengxiansi"; 龙门石窟研究院.
  const TY = 0.07, c = '#9a968c', sc = '#a39d90';
  land(gp, R, (x, z) => (z < 0.1 ? TY : z < 0.2 ? 0.036 : 0.008) + (fbm(x * 8, 3, z * 8) - 0.5) * 0.004,
    (x, y, z) => (y > 0.06 ? mix('#a39d90', '#979184', hash3(Math.floor(x * 50), 0, Math.floor(z * 50))) : y > 0.03 ? mix('#9a9478', '#8a8a62', fbm(x * 20, 0, z * 20)) : '#6a6a58'));
  waterSurf(gp, R, 0.024, (_x, z) => z > 0.2, '#536f6c');
  pbox(gp, '#8f8a80', 0, 0.03, 0.1, 0.8, TY - 0.03 + 0.002, 0.012, ashlarP('#8f8a80'), 0.016, 0.008);
  stairs(gp, 0, 0.036, TY, 0.106, 0.07, 0.05, '#99948a', 5, 0);
  const niches: Niche[] = [{ cx: 0, y0: TY + 0.005, y1: TY + 0.52, hw: 0.36, D: 0.19 }];
  const tiny: [number, number][] = [];
  for (let i = 0; i < 10; i++) tiny.push([-0.33 + i * 0.073, TY + 0.565 + (i % 2) * 0.03]);
  for (const sx of [-1, 1]) for (const y of [0.06, 0.16, 0.26, 0.36, 0.46]) tiny.push([sx * 0.395, TY + y + (sx > 0 ? 0.04 : 0)]);
  for (const [x, y] of tiny) niches.push({ cx: x, y0: y - 0.018, y1: y + 0.018, hw: 0.014, D: 0.016, arch: true });
  const face = cliff(gp, { XW: 0.42, Y: TY, Ht: TY + 0.64, base: x => 0.0 - 0.05 * (x / 0.42) ** 2, lean: 0.025, niches, c, top: '#6f7f4a' });
  // Vairocana on an octagonal lotus throne, with great halo and mandorla
  const vz = -0.15;
  lathe(gp, [[0, 0], [0.11, 0], [0.115, 0.012], [0.085, 0.022], [0.09, 0.03], [0.125, 0.05], [0, 0.05]], shade(sc, 0.92), 0, TY, vz, 8).rotation.y = Math.PI / 8;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ellip(gp, shade(sc, 0.97), Math.sin(a) * 0.115, TY + 0.042, vz + Math.cos(a) * 0.115, 0.03, 0.012, 0.018, a); }
  seated(gp, 0, TY + 0.05, vz, 0.42, sc, 'both');
  const hy = TY + 0.05 + 0.29;
  add(gp, CYL(32), mat(shade(c, 0.9)), 0, hy, face(0, hy) + 0.005, 0.25, 0.008, 0.25, 0, Math.PI / 2);
  add(gp, CYL(32), mat(shade(c, 1.04)), 0, hy, face(0, hy) + 0.009, 0.15, 0.006, 0.15, 0, Math.PI / 2);
  add(gp, CYL(32), mat(shade(c, 0.85)), 0, TY + 0.24, face(0, TY + 0.24) + 0.003, 0.44, 0.006, 0.5, 0, Math.PI / 2);
  // [x, kind, height, z, turn toward the centre]
  const set: [number, SKind, number, number, number][] = [[0.16, 'disciple', 0.25, -0.18, 0.2], [0.235, 'bodhi', 0.31, -0.165, 0.35], [0.3, 'king', 0.29, -0.115, 1.0], [0.31, 'lishi', 0.26, -0.045, 1.25]];
  for (const sx of [-1, 1]) for (const [x, kind, h, z, t] of set) {
    box(gp, shade(sc, 0.9), sx * x, TY, z, 0.05, 0.018, 0.045, -sx * t);
    statue(gp, sx * x, TY + 0.018, z, h, sc, kind, -sx * t);
  }
  for (const [x, y] of tiny) if (hash3(x * 100, y * 100, 2) > 0.4) seated(gp, x, y - 0.016, face(x, y) + 0.006, 0.026, sc);
  // pilgrims on the terrace and the riverside path, a boat on the Yi
  human(gp, -0.06, TY, 0.06, { h: 0.045, pose: 'pray', top: '#8a3a2a', bottom: '#5a2a20', hair: HAIR, hatStyle: 'cap', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, 0.07, TY, 0.07, { h: 0.045, pose: 'stand', top: '#6e5a44', bottom: '#4e4034', hair: null, dress: 'ankle', ry: Math.PI + 0.4, detail: 'lo' });
  human(gp, 0.2, 0.036, 0.15, { h: 0.045, pose: 'walk', phase: 0.2, top: '#3a5a6a', bottom: '#2a2a30', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: -1.57, detail: 'lo' });
  const gb = grp(gp, -0.15, 0.32, 1.4, 0.024);
  lathe(gb, [[0, -0.004], [0.011, -0.002], [0.012, 0.006], [0, 0.006]], '#6a4a2e', 0, 0, 0, 10).scale.set(1, 1, 3.4);
  human(gb, 0, 0.004, 0.018, { h: 0.04, pose: 'row', top: '#5a5040', bottom: '#3a3a30', hair: HAIR, hat: '#c8b070', hatStyle: 'conical', detail: 'lo' });
  for (const [x, y, z] of [[-0.3, TY + 0.64, -0.2], [0.1, TY + 0.64, -0.25], [0.3, TY + 0.64, -0.15], [-0.1, TY + 0.64, -0.3]] as V3[]) ellip(gp, '#5f7a40', x, y + 0.01, z, 0.04, 0.022, 0.035);
}

// ---------------------------------------------------------------------------------------------------------
// 嵩岳寺塔 Songyue Pagoda, Dengfeng (Northern Wei, 523) — the only DODECAGONAL Chinese pagoda, the oldest brick one.
// ~37 m: 0.85 m 12-sided plinth; tall body (plain lower half with 4 arched doors, upper half with corner pilasters, flame-arch
// openings and 8 pagoda-shaped niches); 15 dense corbelled (叠涩) eaves with short walls and tiny windows in a parabolic
// outline; stone finial (lotus, 7 rings, jewel). Brick under weathered buff lime plaster. Ref: zh.wikipedia「嵩岳寺塔」; Commons "Pagoda of Songyue Temple".

function lf_songyue(gp: THREE.Group): void {
  const R = 0.46, Y = 0.03, n = 12, rot = Math.PI / n, plaster = '#c29a64', eave = '#aea692', st = '#9d978a', dark = '#2e261e';
  land(gp, R, (x, z) => Y + (fbm(x * 7, 6, z * 7) - 0.5) * 0.01 * sstep(0.24, 0.32, Math.hypot(x, z)),
    (x, _y, z) => {
      const r = Math.hypot(x, z);
      if (r < 0.22 || (Math.abs(x) < 0.045 && z > 0)) return shade('#9a948a', 0.9 + hash3(Math.floor(x * 70), 1, Math.floor(z * 70)) * 0.14);
      return mix(SITE.meadow, SITE.grass, fbm(x * 10, 1, z * 10));
    });
  const ngon = (r: number, y: number): V3[] => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * TAU; return [Math.sin(a) * r, y, Math.cos(a) * r] as V3; });
  const L = (pts: [number, number][], c: string, y: number) => { lathe(gp, pts, c, 0, y, 0, n).rotation.y = rot; };
  /** group standing on face i (0 = +z), local +z outward at the apothem of radius r */
  const face = (i: number, r: number, y = 0) => { const a = (i / n) * TAU; return grp(gp, Math.sin(a) * r * Math.cos(Math.PI / n), Math.cos(a) * r * Math.cos(Math.PI / n), a, y); };
  // plinth (台基) and stair to the south door
  L([[0, 0], [0.15, 0], [0.15, 0.012], [0, 0.012]], shade(st, 1.02), Y);
  for (let i = 0; i < 3; i++) box(gp, shade(st, 1.05 - i * 0.03), 0, Y, 0.155 + (2 - i) * 0.009, 0.05, 0.004 * (i + 1), 0.01);
  // body, lower half: plain plastered wall with arched doors on the four cardinal faces
  const B0 = Y + 0.012, r0 = 0.1, H1 = 0.1, H2 = 0.095;
  skin(gp, [ngon(r0, B0), ngon(r0, B0 + H1)], plaster, { caps: false, flat: true, paint: () => shade(plaster, 1.02) });
  const pointed = (w: number, h: number): [number, number][] => [[-w, 0], [w, 0], [w, h], [w * 0.8, h + w * 0.55], [w * 0.4, h + w * 0.95], [0, h + w * 1.35], [-w * 0.4, h + w * 0.95], [-w * 0.8, h + w * 0.55], [-w, h]];
  for (const i of [0, 3, 6, 9]) {
    const gf = face(i, r0, B0);
    slab(gf, pointed(0.02, 0.05), 0.003, shade(plaster, 1.12), 0, false).position.z = 0.0005;
    slab(gf, pointed(0.014, 0.048), 0.003, dark, 0, false).position.z = 0.002;
  }
  // waist band (腰檐) between the two halves
  skin(gp, [ngon(r0, B0 + H1), ngon(r0 + 0.004, B0 + H1), ngon(r0 + 0.004, B0 + H1 + 0.004), ngon(r0 + 0.008, B0 + H1 + 0.004), ngon(r0 + 0.008, B0 + H1 + 0.009), ngon(r0, B0 + H1 + 0.011)], plaster,
    { caps: false, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny < -0.5 ? shade(plaster, 0.62) : ny > 0.3 ? shade(eave, 0.9) : shade(plaster, 1.08)) });
  // body, upper half: corner pilasters with lotus capitals, flame-arch openings and pagoda-shaped niches (塔形龛)
  const U0 = B0 + H1 + 0.011;
  skin(gp, [ngon(r0, U0), ngon(r0, U0 + H2)], plaster, { caps: false, flat: true, paint: () => plaster });
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, x = Math.sin(a) * (r0 + 0.002), z = Math.cos(a) * (r0 + 0.002);
    cyl(gp, shade(plaster, 1.08), x, U0 + 0.004, z, 0.0042, H2 - 0.014, 6);
    ball(gp, shade(plaster, 1.12), x, U0 + H2 - 0.008, z, 0.0062, 0.005, 0.0062);
    box(gp, shade(plaster, 1.06), x, U0, z, 0.009, 0.005, 0.009, a);
  }
  for (let i = 0; i < n; i++) {
    const gf = face(i, r0, U0);
    if (i % 3 === 0) {
      slab(gf, pointed(0.017, 0.042), 0.003, shade(plaster, 1.12), 0, false).position.set(0, 0.012, 0.0005);
      slab(gf, pointed(0.011, 0.04), 0.003, dark, 0, false).position.set(0, 0.012, 0.002);
      continue;
    }
    // single-storey pagoda relief: base, body with a dark arched niche, eave, dome and finial
    box(gf, shade(plaster, 0.92), 0, 0.012, 0.002, 0.03, 0.008, 0.005);
    box(gf, shade(plaster, 1.06), 0, 0.02, 0.002, 0.024, 0.034, 0.004);
    slab(gf, archP(0.006, 0.016), 0.002, '#3a3026', 0, false).position.set(0, 0.026, 0.004);
    box(gf, shade(plaster, 0.86), 0, 0.054, 0.003, 0.032, 0.005, 0.006);
    ellip(gf, shade(plaster, 1.08), 0, 0.061, 0.002, 0.009, 0.007, 0.003);
    cone(gf, shade(plaster, 1.05), 0, 0.066, 0.002, 0.003, 0.016, 4);
    for (const sx of [-1, 1]) ellip(gf, shade(plaster, 0.92), sx * 0.016, 0.017, 0.003, 0.004, 0.006, 0.003);
  }
  // 15 dense corbelled eaves, short walls between them, parabolic outline
  const NS = 15, rings: V3[][] = [], levels: number[] = [];
  const rw = (t: number) => r0 * (1 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * (1 - 0.6 * t ** 1.8);
  const pr = (t: number) => 0.017 * (1 - 0.35 * t);
  let y = U0 + H2;
  rings.push(ngon(r0, y));
  for (let k = 0; k < NS; k++) {
    const t = k / NS, h = 0.035 * (1 - 0.45 * t), w0 = rw(t), re = w0 + pr(t), wn = k < NS - 1 ? rw((k + 1) / NS) : rw(1) * 0.6;
    levels.push(y);
    if (k > 0) rings.push(ngon(w0, y));
    rings.push(ngon(w0, y + h * 0.36));
    let r = w0, yy = y + h * 0.36;
    for (let s = 1; s <= 4; s++) {
      const rs = w0 + (re - w0) * (s / 4) ** 0.85;
      rings.push(ngon(rs, yy));
      yy += h * 0.105;
      rings.push(ngon(rs, yy));
      r = rs;
    }
    rings.push(ngon(r - 0.002, yy + h * 0.06), ngon(wn + 0.003, y + h));
    y += h;
  }
  levels.push(y);
  const levelOf = (py: number) => { let k = 0; while (k < NS - 1 && py >= levels[k + 1]) k++; return k; };
  skin(gp, rings, plaster, {
    caps: true, flat: true,
    paint: (_px, py, _pz, _nx, ny) => {
      const k = levelOf(py), f = (py - levels[k]) / (levels[k + 1] - levels[k]);
      if (ny < -0.5) return shade(plaster, 0.55 + f * 0.1);
      if (ny > 0.3) return shade(mix(plaster, eave, 0.55), 0.78 + hash3(k, Math.floor(py * 900), 3) * 0.08);
      if (f < 0.37) return shade(plaster, 0.98 + hash3(k, 1, 5) * 0.05);
      return shade(mix(plaster, eave, 0.2 + hash3(Math.floor(py * 2000), k, 1) * 0.25), 0.92);
    },
  });
  // tiny windows (most of them blind) on alternate faces of each short wall
  for (let k = 0; k < NS; k++) {
    const t = k / NS, h = levels[k + 1] - levels[k], w0 = rw(t);
    for (let i = k % 2; i < n; i += 2) {
      const gf = face(i, w0, levels[k] + h * 0.05);
      box(gf, dark, 0, 0, 0.0008, 0.011 * (1 - 0.3 * t), h * 0.26, 0.002);
    }
  }
  // stone finial: 12-sided base, inverted and upright lotus, seven rings (相轮), jewel
  L([[0, 0], [0.032, 0], [0.032, 0.007], [0.026, 0.01], [0, 0.01]], st, y);
  lathe(gp, [[0, 0], [0.018, 0], [0.025, 0.007], [0.022, 0.013], [0.014, 0.015], [0, 0.015]], shade(st, 1.06), 0, y + 0.01, 0, 12);
  lathe(gp, [[0, 0], [0.009, 0], [0.019, 0.007], [0.022, 0.013], [0, 0.011]], shade(st, 1.1), 0, y + 0.025, 0, 12);
  let fy = y + 0.038;
  for (let i = 0; i < 7; i++) { cyl(gp, shade(st, i % 2 ? 0.96 : 1.08), 0, fy, 0, 0.0125 - i * 0.001, 0.0045, 12); fy += 0.0052; }
  cyl(gp, st, 0, y + 0.038, 0, 0.0035, fy - y - 0.038 + 0.008, 6);
  ellip(gp, shade(st, 1.12), 0, fy + 0.012, 0, 0.009, 0.013, 0.009);
  // temple court: ginkgo and cypress, a bronze censer, monks in grey-brown 海青 and a pilgrim
  for (const [x, z, s, k] of [[-0.33, 0.12, 0.2, 0], [0.31, 0.19, 0.17, 1], [0.32, -0.2, 0.19, 2], [-0.28, -0.25, 0.2, 3], [-0.06, -0.37, 0.18, 4]] as [number, number, number, number][]) broadleaf(gp, x, Y, z, s, k % 2 ? '#5d6e38' : '#66733c', k);
  for (const [x, z] of [[-0.12, 0.33], [0.12, 0.33], [-0.2, 0.28], [0.2, 0.28], [0.38, 0.02], [-0.39, -0.04], [0.15, -0.36]] as P2[]) cypress(gp, x, Y, z, 0.13);
  const bz = '#5e5a46';
  lathe(gp, [[0, 0], [0.008, 0], [0.006, 0.012], [0.014, 0.016], [0.015, 0.026], [0.012, 0.028], [0, 0.026]], bz, 0, Y, 0.26, 10);
  for (const sx of [-1, 1]) box(gp, bz, sx * 0.011, Y + 0.026, 0.26, 0.003, 0.008, 0.003);
  smoke(gp, 0, Y + 0.03, 0.26, 0.006);
  human(gp, 0.05, Y, 0.215, { h: 0.048, pose: 'pray', top: '#6e655a', bottom: '#5a5248', hair: null, dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, -0.075, Y, 0.3, { h: 0.048, pose: 'walk', phase: 0.5, top: '#8a6a3e', bottom: '#5a4a34', hair: null, dress: 'ankle', ry: Math.PI - 0.5, detail: 'lo' });
  human(gp, 0.02, Y, 0.37, { h: 0.047, pose: 'walk', phase: 0.1, top: '#4c5560', bottom: '#3a3a40', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: Math.PI, detail: 'lo' });
}

// ---------------------------------------------------------------------------------------------------------
// 赵州桥 Zhaozhou (Anji) Bridge, Li Chun, Sui c. 605: open-spandrel segmental stone arch
// Span 37.02 m, rise 7.23 m (≈1:5), 9 m wide, 28 parallel arch rings, two small spandrel arches on each haunch, low gently
// cambered deck with carved stone balustrade; grey limestone over the Xiao river. Ref: Liang Sicheng 1934 survey; zh.wikipedia「赵州桥」.

/** Riverside willow: the shared tree in willow sage, swaying gently. */
function willow(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  tree(anim(p, 'sway', x, y, z, { amp: 0.03, speed: 0.8 }), x * 0.01, 0, z * 0.01, s * 0.62, '#7f8c55');
}
function lf_zhaozhou(gp: THREE.Group): void {
  const R = 0.46, WL = 0.04, st = '#aaa69c', W = 0.12, hw = W / 2, XE = 0.45, RI = 0.435, RO = 0.463, CY = -0.26;
  const bankH: HF = (x, z) => 0.015 + 0.105 * sstep(0.26 - 0.08 * sstep(0.12, 0.32, Math.abs(z)), 0.4 - 0.06 * sstep(0.12, 0.32, Math.abs(z)), Math.abs(x + (fbm(z * 4, 2, 1) - 0.5) * 0.05 * sstep(0.1, 0.3, Math.abs(z)))) + (fbm(x * 9, 3, z * 9) - 0.5) * 0.01 * sstep(0.3, 0.4, Math.abs(x));
  land(gp, R, bankH, (x, y, z, sl) => {
    if (y < WL + 0.004) return mix('#6a5e44', '#5c5240', fbm(x * 20, 0, z * 20));
    if (y < 0.1 || sl > 0.3) return Math.abs(z) < 0.1 ? shade(st, 0.8 + hash3(Math.floor(x * 90), Math.floor(y * 150), Math.floor(z * 90)) * 0.2) : mix('#8a7a56', '#76824a', fbm(x * 14, 2, z * 14));
    if (Math.abs(z) < 0.05 && Math.abs(x) > 0.36) return mix('#a8946c', '#9a8660', hash3(Math.floor(x * 60), 1, Math.floor(z * 60)));
    return mix(SITE.grass, SITE.meadow, fbm(x * 11, 4, z * 11));
  }, 28, 96);
  waterSurf(gp, R, WL, (x, z) => bankH(x, z) < WL + 0.003, '#58715f', 28, 96);
  // the arch body: front/back faces, intrados of 28 parallel arch rings, two open spandrel arches per haunch
  const deck = (x: number) => 0.215 - 0.085 * (x / 0.44) ** 2;
  const extr = (x: number) => CY + Math.sqrt(Math.max(0, RO * RO - x * x));
  const bot = (x: number) => (Math.abs(x) <= 0.3 ? CY + Math.sqrt(RI * RI - x * x) : 0.055 - (Math.abs(x) - 0.3) * 0.3);
  const holes = [[0.302, 0.029], [0.235, 0.022], [-0.235, 0.022], [-0.302, 0.029]].map(([xc, rr]) => ({ xc, rr, ys: deck(xc) - 0.012 - rr }));
  const hb = (x: number) => extr(x) + 0.006;
  const xs: number[] = [-0.3, 0.3];
  for (let i = 0; i <= 180; i++) xs.push(-XE + (i / 180) * XE * 2);
  for (const h of holes) xs.push(h.xc - h.rr, h.xc + h.rr);
  xs.sort((a, b) => a - b);
  const X = xs.filter((v, i) => i === 0 || v - xs[i - 1] > 1e-4);
  const faceCol = (x: number, y: number) => {
    const r = Math.hypot(x, y - CY);
    if (Math.abs(x) < 0.31 && r > RI - 0.002 && r < RO) { const k = Math.floor(Math.atan2(x, y - CY) * 30); return shade(st, (k % 2 ? 0.92 : 1.0) + hash3(k, 1, 4) * 0.06); }
    if (Math.abs(x) < 0.33 && r >= RO && r < RO + 0.007) return shade(st, 1.1);
    if (y > deck(x) - 0.008) return shade(st, 1.07);
    const row = Math.floor(y / 0.009), col = Math.floor((x + (row % 2) * 0.009) / 0.018);
    return shade(st, 0.84 + hash3(col, row, 5) * 0.14);
  };
  const s = new Soup(), NZ = 14;
  const skinZ = (x0: number, y0: number, x1: number, y1: number, want: V3, col: (x: number, zi: number) => string) => {
    for (let k = 0; k < NZ; k++) {
      const za = -hw + (W * k) / NZ, zb = -hw + (W * (k + 1)) / NZ;
      s.quad([x0, y0, za], [x1, y1, za], [x1, y1, zb], [x0, y0, zb], col((x0 + x1) / 2, k), want);
    }
  };
  const underC = (x: number, k: number) => shade(st, (k % 2 ? 0.8 : 0.88) + hash3(Math.floor(x * 60), k, 2) * 0.08);
  const deckC = (x: number, k: number) => (k === 3 || k === 10 ? shade(st, 0.8) : shade(st, 0.95 + hash3(Math.floor(x * 45), Math.floor(k / 2), 6) * 0.1));
  for (let c = 0; c < X.length - 1; c++) {
    const x0 = X[c], x1 = X[c + 1], xm = (x0 + x1) / 2;
    const h = holes.find(o => Math.abs(xm - o.xc) < o.rr);
    const ht = (x: number) => (h ? h.ys + Math.sqrt(Math.max(0, h.rr * h.rr - (x - h.xc) ** 2)) : 0);
    const iv: [(x: number) => number, (x: number) => number][] = h ? [[bot, hb], [ht, deck]] : [[bot, deck]];
    iv.forEach(([fa, fb], j) => {
      const a0 = fa(x0), a1 = fa(x1), b0 = fb(x0), b1 = fb(x1);
      const n = Math.max(1, Math.round((b0 + b1 - a0 - a1) / 2 / 0.005));
      for (let k = 0; k < n; k++) {
        const ya0 = a0 + ((b0 - a0) * k) / n, ya1 = a1 + ((b1 - a1) * k) / n, yb0 = a0 + ((b0 - a0) * (k + 1)) / n, yb1 = a1 + ((b1 - a1) * (k + 1)) / n;
        const col = faceCol(xm, (ya0 + ya1 + yb0 + yb1) / 4);
        for (const sz of [-1, 1]) s.quad([x0, ya0, sz * hw], [x1, ya1, sz * hw], [x1, yb1, sz * hw], [x0, yb0, sz * hw], col, [0, 0, sz]);
      }
      skinZ(x0, a0, x1, a1, [0, -1, 0], j === 0 ? underC : (x, k) => underC(x, k + 1));
      skinZ(x0, b0, x1, b1, [0, 1, 0], h && j === 0 ? underC : deckC);
    });
  }
  for (const h of holes) for (const e of [-1, 1]) {
    const xe = h.xc + e * h.rr, y0 = hb(xe);
    s.quad([xe, y0, -hw], [xe, y0, hw], [xe, h.ys, hw], [xe, h.ys, -hw], shade(st, 0.85), [-e, 0, 0]);
  }
  for (const e of [-1, 1]) s.quad([e * XE, bot(XE), -hw], [e * XE, bot(XE), hw], [e * XE, deck(XE), hw], [e * XE, deck(XE), -hw], shade(st, 0.9), [e, 0, 0]);
  s.build(gp, { rough: 0.85 });
  // keystone beast-mask (吸水兽) on both faces
  for (const sz of [-1, 1]) {
    box(gp, shade(st, 0.97), 0, extr(0) - 0.02, sz * (hw + 0.0015), 0.016, 0.02, 0.003);
    ellip(gp, shade(st, 0.88), 0, extr(0) - 0.012, sz * (hw + 0.003), 0.006, 0.006, 0.002);
    for (const sx of [-1, 1]) ellip(gp, shade(st, 0.7), sx * 0.003, extr(0) - 0.009, sz * (hw + 0.0045), 0.0013, 0.001, 0.0008);
  }
  // balustrade: posts, panels and handrail
  const pc = shade(st, 1.1), NP = 22, rz = hw - 0.004;
  for (const sz of [-1, 1]) for (let i = 0; i <= NP; i++) {
    const x = -0.44 + (i / NP) * 0.88, y = deck(x);
    box(gp, pc, x, y - 0.003, sz * rz, 0.0065, 0.031, 0.0065);
    ball(gp, pc, x, y + 0.031, sz * rz, 0.0075, 0.009, 0.0075);
    if (i === NP) continue;
    const xn = -0.44 + ((i + 1) / NP) * 0.88, xm = (x + xn) / 2, ym = deck(xm), ang = Math.atan2(deck(xn) - y, xn - x), L = Math.hypot(xn - x, deck(xn) - y) - 0.006;
    box(gp, shade(st, 1.03), xm, ym - 0.003, sz * rz, L, 0.02, 0.0045, 0, 0, ang);
    box(gp, pc, xm, ym + 0.021, sz * rz, L, 0.0035, 0.0055, 0, 0, ang);
  }
  // donkey cart with sacks, crossing toward the crown
  {
    const x = 0.12, gc = grp(gp, x, -0.018, -Math.PI / 2, deck(x + 0.02));
    const hg = grp(gc, 0, 0.032, 0);
    hg.scale.setScalar(0.085);
    horse(hg, '#7d7468', '#3a342e', { donkey: true });
    const wd = '#4a3020';
    box(gc, '#6a4630', 0, 0.016, -0.032, 0.04, 0.004, 0.048);
    for (const sx of [-1, 1]) {
      wheel(gc, sx * 0.025, 0.016, -0.036, 0.016, wd, 8);
      rod(gc, [sx * 0.01, 0.019, -0.01], [sx * 0.01, 0.028, 0.032], 0.0016, wd, 4);
    }
    for (let k = 0; k < 3; k++) ellip(gc, k % 2 ? '#c8b48a' : '#b8a27a', (k - 1) * 0.011, 0.027, -0.032 + (k % 2) * 0.01, 0.007, 0.008, 0.011);
    human(gc, 0.026, 0, 0.03, { h: 0.038, pose: 'walk', phase: 0.2, top: '#4a5560', bottom: '#2e3238', hair: HAIR, hatStyle: 'knot', dress: 'knee', detail: 'lo' });
  }
  human(gp, -0.09, deck(-0.09), 0.02, { h: 0.038, pose: 'walk', phase: 0.6, top: '#8a5a3a', bottom: '#4a3a2a', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: Math.PI / 2, detail: 'lo' });
  human(gp, -0.24, deck(-0.24), -0.02, { h: 0.038, pose: 'carry', top: '#5a6a5a', bottom: '#3a3a30', hair: HAIR, hat: '#c8b070', hatStyle: 'conical', ry: Math.PI / 2, detail: 'lo' });
  // river life: a sampan, a fisherman on the bank, willows
  {
    const gb = grp(gp, 0.08, 0.27, 0.25, WL);
    lathe(gb, [[0, -0.004], [0.012, -0.002], [0.013, 0.006], [0, 0.006]], '#6a4a2e', 0, 0, 0, 10).scale.set(1, 1, 3.6);
    add(gb, g('la1:hcyl', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, -Math.PI / 2, Math.PI)), mat('#8a7048', { flat: true }), 0, 0.006, -0.008, 0.012, 0.03, 0.012, 0, -Math.PI / 2);
    human(gb, 0, 0.006, 0.026, { h: 0.036, pose: 'row', top: '#4a5a6a', bottom: '#3a3a3a', hair: HAIR, hat: '#c8b070', hatStyle: 'conical', detail: 'lo' });
  }
  {
    const fx = -0.36, fz = 0.21, fy = bankH(fx, fz);
    human(gp, fx, fy, fz, { h: 0.038, pose: 'sitGround', top: '#6a6050', bottom: '#3a3428', hair: HAIR, hat: '#c8b070', hatStyle: 'conical', ry: Math.PI / 2, detail: 'lo' });
    rod(gp, [fx + 0.01, fy + 0.02, fz], [fx + 0.1, fy + 0.07, fz + 0.02], 0.0012, '#6a5030', 3);
    rod(gp, [fx + 0.1, fy + 0.07, fz + 0.02], [fx + 0.1, WL, fz + 0.02], 0.0004, '#dddddd', 3);
  }
  {
    const gb = grp(gp, -0.1, -0.3, 0.1, WL);
    lathe(gb, [[0, -0.004], [0.014, -0.002], [0.015, 0.007], [0, 0.007]], '#5e4228', 0, 0, 0, 10).scale.set(1, 1, 4);
    for (let k = 0; k < 4; k++) ellip(gb, k % 2 ? '#c8b48a' : '#a88a5a', 0, 0.01, -0.03 + k * 0.016, 0.01, 0.007, 0.008);
    human(gb, 0, 0.006, 0.04, { h: 0.036, pose: 'row', top: '#5a4a3a', bottom: '#3a3a3a', hair: HAIR, hatStyle: 'knot', ry: Math.PI, detail: 'lo' });
  }
  for (let i = 0; i < 26; i++) {
    const sx = i % 2 ? 1 : -1, z = -0.36 + hash3(i, 4, 4) * 0.72;
    if (Math.abs(z) < 0.12) continue;
    let x = sx * 0.17;
    while (Math.abs(x) < 0.4 && bankH(x, z) < WL + 0.004) x += sx * 0.004;
    if (Math.hypot(x, z) > 0.44) continue;
    cone(gp, i % 3 ? '#7f9448' : '#9aa456', x - sx * 0.004, WL - 0.002, z, 0.005, 0.03 + hash3(i, 2, 9) * 0.02, 4);
  }
  for (const [x, z, k] of [[-0.39, 0.13, 0.13], [-0.4, -0.15, 0.14], [-0.33, -0.29, 0.12], [0.39, 0.16, 0.14], [0.38, -0.2, 0.13], [0.3, 0.32, 0.12]]) willow(gp, x, bankH(x, z), z, k);
}

// ---------------------------------------------------------------------------------------------------------
// 大雁塔 Giant Wild Goose Pagoda, Da Ci'en Temple, Chang'an (652, rebuilt 701–704; Ming brick casing 1604)
// Square 7-storey 楼阁式 brick pagoda, ~64 m, on a 4.2 m brick podium; storeys diminish steadily, each face articulated by
// brick pilasters (9/9/7/7/5/5/5 bays) with an arched opening on every side, corbelled (叠涩) eaves with a sawtooth course;
// grey-buff brick, low pyramidal top and a small stupa finial. Ref: zh.wikipedia「大雁塔」; Liang Sicheng's survey drawings.

const archP = (w: number, h: number): [number, number][] => [[-w, 0], [w, 0], ...Array.from({ length: 7 }, (_, k) => { const t = (k / 6) * Math.PI; return [Math.cos(t) * w, h + Math.sin(t) * w] as [number, number]; })];
function lf_dayan(gp: THREE.Group): void {
  const R = 0.46, Y = 0.03, brick = '#b39876', st = '#a39b8c', tile = '#5d6266', col = '#9a3b2c', wall = '#d6cbb4', PZ = -0.075;
  land(gp, R, (x, z) => Y + (fbm(x * 7, 8, z * 7) - 0.5) * 0.008 * sstep(0.3, 0.38, Math.hypot(x, z)),
    (x, _y, z) => (Math.hypot(x, z - 0.02) < 0.32 + (fbm(x * 9, 5, z * 9) - 0.5) * 0.04 ? shade(SITE.paving, 0.94 + hash3(Math.floor(x * 40), 2, Math.floor(z * 40)) * 0.08) : shade(SITE.grass, 0.93 + fbm(x * 10, 1, z * 10) * 0.14)));
  // brick podium with a south stair
  pbox(gp, brick, 0, Y, PZ, 0.42, 0.05, 0.42, brickP(brick), 0.012, 0.006);
  box(gp, shade(brick, 0.9), 0, Y + 0.05, PZ, 0.43, 0.005, 0.43);
  const B = Y + 0.055;
  // low brick parapet with pierced panels and posts round the podium edge (front gap for the stair)
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2, gf = grp(gp, Math.sin(a) * 0.205, PZ + Math.cos(a) * 0.205, a, B);
    for (const [x0, x1] of (f === 0 ? [[-0.205, -0.045], [0.045, 0.205]] : [[-0.205, 0.205]])) {
      box(gf, shade(brick, 0.86), (x0 + x1) / 2, 0, 0, x1 - x0, 0.014, 0.008);
      box(gf, shade(brick, 0.96), (x0 + x1) / 2, 0.014, 0, x1 - x0 + 0.004, 0.004, 0.011);
      for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / Math.round((x1 - x0) / 0.04)) box(gf, shade(brick, 0.82), x, 0, 0, 0.009, 0.021, 0.011);
    }
  }
  stairs(gp, 0, Y, B, PZ + 0.215, 0.08, 0.07, shade(st, 1.05), 7, 0, st);
  // seven storeys: battered brick walls, pilaster strips, arched windows, corbelled (叠涩) eaves with a sawtooth course
  const saw = '#5f5444', band = '#8f8270';
  const sawP: Paint = (x, _y, z, nx, ny) => (Math.abs(ny) > 0.7 ? shade(brick, 0.9) : ((Math.floor(Math.abs(nx) > 0.5 ? z : x) % 2) + 2) % 2 ? saw : shade(brick, 1.05));
  const bays = [9, 9, 7, 7, 5, 5, 5];
  let y = B, w = 0.25;
  for (let i = 0; i < 7; i++) {
    const hb = 0.078 * 0.92 ** i, sc = 0.94 ** i, wt = w - 0.004, wn = i < 6 ? 0.25 * (1 - 0.075 * (i + 1)) : 0;
    ptaper(gp, brick, 0, y, PZ, w, w, wt, wt, hb, brickP(brick), 0.009, 0.0045);
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2, gf = grp(gp, Math.sin(a) * (w / 2 - 0.001), PZ + Math.cos(a) * (w / 2 - 0.001), a, y);
      const nb = bays[i];
      for (let k = 1; k < nb; k++) box(gf, shade(brick, 1.07), -w / 2 + (k * w) / nb, 0, 0.0012, 0.0045, hb * 0.86, 0.0035);
      box(gf, shade(brick, 1.1), 0, hb * 0.82, 0.0014, w - 0.004, 0.005, 0.004);
      box(gf, shade(brick, 1.1), 0, hb * 0.66, 0.0014, w - 0.004, 0.003, 0.004);
      const aw = (w / nb) * 0.34, door = i === 0, ay = door ? 0 : hb * 0.18, ah = door ? hb * 0.36 : hb * 0.24;
      slab(gf, archP(aw * 1.45, ah), 0.003, shade(brick, 1.14), 0, false).position.set(0, ay, 0.0028);
      slab(gf, archP(aw, ah), 0.003, '#2a2019', 0, false).position.set(0, ay, 0.0045);
      if (door) box(gf, st, 0, ah + aw + 0.003, 0.003, aw * 3.4, 0.005, 0.004);
      if (door && f === 0) for (const sx of [-1, 1]) {
        box(gf, '#8a8478', sx * w * 0.3, 0.004, 0.004, 0.022, 0.042, 0.004);
        box(gf, '#6a645a', sx * w * 0.3, 0.046, 0.004, 0.026, 0.008, 0.006);
      }
    }
    let ey = y + hb;
    const steps: [number, number, boolean][] = [[0.005, 0.0035, false], [0.01, 0.0035, false], [0.015, 0.0045, true], [0.02, 0.0035, false], [0.024, 0.004, false]];
    for (const [o, t, sw] of steps) {
      const ww = wt + o * 2 * sc;
      if (sw) pbox(gp, brick, 0, ey, PZ, ww, t * sc, ww, sawP, 0.005, t * sc);
      else box(gp, shade(band, 0.96 + o * 3), 0, ey, PZ, ww, t * sc, ww);
      ey += t * sc;
    }
    if (i < 6) {
      for (let k = 1; k <= 3; k++) { const ww = wt + 0.048 * sc + (wn + 0.004 - wt - 0.048 * sc) * (k / 3.4); box(gp, shade(band, 0.9 + k * 0.04), 0, ey, PZ, ww, 0.003 * sc, ww); ey += 0.003 * sc; }
      y = ey;
      w = wn;
    } else {
      // low pyramidal top and a stupa-shaped finial (塔刹)
      cone(gp, shade(band, 0.92), 0, ey, PZ, ((wt + 0.048 * sc) / 2) * Math.SQRT2, 0.035, 4, Math.PI / 4);
      y = ey + 0.026;
    }
  }
  box(gp, st, 0, y, PZ, 0.035, 0.008, 0.035);
  lathe(gp, [[0, 0], [0.018, 0], [0.024, 0.012], [0.02, 0.024], [0.01, 0.03], [0.012, 0.036], [0.007, 0.05], [0.009, 0.056], [0.004, 0.066], [0, 0.072]], shade(st, 1.08), 0, y + 0.008, PZ, 10);
  // the main hall (大雄宝殿) to the south
  const HZ = 0.3, hy = Y + 0.02;
  pbox(gp, st, 0, Y, HZ, 0.27, 0.02, 0.11, ashlarP(st), 0.014, 0.007);
  stairs(gp, 0, Y, hy, HZ + 0.055, 0.06, 0.03, shade(st, 1.06), 3);
  const hwd = 0.11, hdp = 0.035, ch = 0.045;
  for (let k = 0; k <= 6; k++) for (const sz of [-1, 1]) cyl(gp, col, -hwd + (k * hwd) / 3, hy, HZ + sz * hdp, 0.0042, ch, 6);
  box(gp, wall, 0, hy, HZ - 0.003, hwd * 2, ch, hdp * 2 - 0.004);
  for (let k = 0; k < 6; k++) box(gp, k === 0 || k === 5 ? '#3a2a20' : '#7a3020', -hwd + ((k + 0.5) * hwd) / 3, hy, HZ + hdp - 0.001, 0.026, k === 0 || k === 5 ? 0.02 : 0.034, 0.003);
  box(gp, col, 0, hy + ch - 0.006, HZ, hwd * 2 + 0.01, 0.006, hdp * 2 + 0.008);
  for (let k = 0; k <= 6; k++) dougong(gp, -hwd + (k * hwd) / 3, hy + ch, HZ + hdp + 0.002, 0.009, '#7a4a2a');
  hip(gp, 0, hy + ch + 0.012, HZ, 0.3, 0.125, 0.055, tile, { chiwei: '#4a4d52', lift: 0.18, k: 0.4 });
  // courtyard: incense burner, pilgrims, monks, trees
  lathe(gp, [[0, 0], [0.012, 0], [0.008, 0.02], [0.02, 0.03], [0.018, 0.045], [0, 0.04]], '#5a4a3a', 0, Y, 0.205, 10);
  smoke(gp, 0, Y + 0.05, 0.205, 0.008);
  human(gp, 0.05, Y, 0.2, { h: 0.05, pose: 'pray', top: '#7a6a5a', bottom: '#5a4a3a', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, -0.05, Y, 0.22, { h: 0.05, pose: 'walk', phase: 0.4, top: '#5e4a3a', bottom: '#463a30', hair: null, dress: 'ankle', ry: Math.PI - 0.6, detail: 'lo' });
  human(gp, 0.015, B - 0.012, PZ + 0.25, { h: 0.05, pose: 'walk', phase: 0.1, top: '#5a6a7a', bottom: '#3a3a40', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, -0.17, B, PZ + 0.18, { h: 0.05, pose: 'point', top: '#8a3a2a', bottom: '#4a2a20', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: 0.4, detail: 'lo' });
  for (let i = 0; i < 12; i++) {
    const a = 0.75 + (i / 11) * (TAU - 1.5), rr = 0.37 + hash3(i, 1, 2) * 0.05, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
    if (i % 3 === 0) minipine(gp, x, Y, z, 0.11 + hash3(i, 2, 3) * 0.04, '#2c5634');
    else if (i % 3 === 1) cypress(gp, x, Y, z, 0.1 + hash3(i, 2, 3) * 0.03);
    else broadleaf(gp, x, Y, z, 0.11 + hash3(i, 2, 3) * 0.03, i % 2 ? '#5d7238' : '#6a7a42', i * 3);
  }
}

// ---------------------------------------------------------------------------------------------------------
// 佛光寺东大殿 Foguang Temple East Hall, Mount Wutai (Tang, 857)
// 7 × 4 bays (34 × 17.7 m) on a high terrace cut into the hillside, reached by a long steep stair; single-eave 庑殿 roof of
// gentle pitch (~1:4.8) with deep eaves carried on huge 七铺作 bracket sets (双抄双下昂) — almost half the column height;
// unpainted, weathered timber with traces of red ochre, white plastered walls, grey tile, ceramic chiwei; Tang 经幢 (877)
// before the hall. Ref: Liang Sicheng 1937 survey; zh.wikipedia「佛光寺东大殿」; Commons "Foguang Temple East Hall".

/** Tang column-top bracket set (七铺作: two tiers of arms + two slanting cantilevers 下昂), projecting toward local +z. */
function tangSet(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number, c: string, blk: string): void {
  const gs = grp(p, x, z, ry, y), u = (v: number) => v * s;
  box(gs, blk, 0, 0, 0, u(0.018), u(0.009), u(0.018));
  box(gs, c, 0, u(0.009), 0, u(0.056), u(0.006), u(0.007));
  box(gs, c, 0, u(0.009), u(0.006), u(0.007), u(0.006), u(0.036));
  box(gs, blk, 0, u(0.015), u(0.02), u(0.01), u(0.005), u(0.01));
  box(gs, c, 0, u(0.02), u(0.016), u(0.007), u(0.006), u(0.056));
  box(gs, c, 0, u(0.02), u(0.02), u(0.044), u(0.005), u(0.006));
  box(gs, blk, 0, u(0.026), u(0.04), u(0.01), u(0.005), u(0.01));
  for (const k of [0, 1]) rod(gs, [0, u(0.05 + k * 0.009), u(-0.012)], [0, u(0.024 + k * 0.009), u(0.066 + k * 0.004)], u(0.0035), c, 4);
  box(gs, c, 0, u(0.042), u(0.068), u(0.06), u(0.005), u(0.006));
  for (const sx of [-1, 1]) box(gs, blk, sx * u(0.024), u(0.047), u(0.068), u(0.009), u(0.004), u(0.009));
}
function lf_foguang(gp: THREE.Group): void {
  const R = 0.46, stone = '#948f85', col = '#8a4632', wood = '#6e4a32', blk = '#5e3e2e', wall = '#d4cab4', tile = '#5d6266';
  const TT = 0.19, TX = 0.31, TZ0 = -0.3, TZ1 = 0.09;
  const hf: HF = (x, z) => {
    const h = 0.035 + 0.15 * sstep(0.16, -0.1, z) + 0.07 * sstep(-0.28, -0.42, z) + (fbm(x * 8, 7, z * 8) - 0.5) * 0.02 * sstep(0.12, -0.05, z);
    return Math.abs(x) < TX + 0.01 && z > TZ0 - 0.01 && z < TZ1 + 0.01 ? Math.min(h, TT - 0.008) : h;
  };
  land(gp, R, hf, (x, y, z, sl) => {
    if (Math.abs(x) < 0.06 && z > TZ1) return shade(SITE.paving, 0.9 + hash3(Math.floor(x * 50), 1, Math.floor(z * 50)) * 0.1);
    if (sl > 0.32) return shade('#857d6e', 0.88 + hash3(Math.floor(x * 70), Math.floor(y * 90), Math.floor(z * 70)) * 0.18);
    return shade(mix(SITE.grass, '#6f7a4c', fbm(x * 10, 2, z * 10)), 0.95 + fbm(x * 20, 4, z * 20) * 0.1);
  }, 26, 90);
  // terrace cut into the hillside: ashlar retaining wall and the long steep stair
  pbox(gp, stone, 0, 0.02, (TZ0 + TZ1) / 2, TX * 2, TT - 0.02, TZ1 - TZ0, ashlarP(stone), 0.018, 0.01);
  box(gp, shade(stone, 1.08), 0, TT - 0.002, (TZ0 + TZ1) / 2, TX * 2 + 0.006, 0.004, TZ1 - TZ0 + 0.006);
  stairs(gp, 0, 0.035, TT, TZ1, 0.08, 0.23, shade(stone, 1.05), 16, 0, shade(stone, 0.9));
  // pierced-brick (花墙) parapets along the terrace edge either side of the stair
  const lattice: Paint = (px, py, _pz, _nx, ny) => (Math.abs(ny) > 0.7 ? shade(stone, 1.04) : py >= 1 && py < 4 && (Math.floor(px) % 2 === 1) !== (Math.floor(py) % 2 === 0) ? '#3a342c' : shade(stone, 0.95));
  for (const sx of [-1, 1]) {
    pbox(gp, stone, sx * (TX + 0.05) / 2, TT, TZ1 - 0.006, TX - 0.05, 0.03, 0.01, lattice, 0.0062, 0.006);
    pbox(gp, stone, sx * TX, TT, (TZ0 + TZ1) / 2 + 0.03, 0.01, 0.03, TZ1 - TZ0 - 0.06, lattice, 0.0062, 0.006);
    for (const x of [0.05, TX * 0.5, TX]) box(gp, shade(stone, 0.9), sx * x, TT, TZ1 - 0.006, 0.016, 0.036, 0.016);
  }
  // hall plinth, 7 × 4 bays
  const HZ = -0.12, W = 0.44, D = 0.21, P = TT + 0.022, Hc = 0.068, y0 = P + Hc;
  pbox(gp, stone, 0, TT, HZ, W + 0.07, P - TT, D + 0.07, ashlarP(stone), 0.014, 0.007);
  box(gp, shade(stone, 1.1), 0, P - 0.002, HZ, W + 0.074, 0.003, D + 0.074);
  stairs(gp, 0, TT, P, HZ + D / 2 + 0.035, 0.07, 0.03, shade(stone, 1.04), 3);
  const xs = Array.from({ length: 8 }, (_, i) => -W / 2 + (i * W) / 7), zs = Array.from({ length: 5 }, (_, i) => HZ - D / 2 + (i * D) / 4);
  const ring: [number, number, number][] = [];
  for (const x of xs) { ring.push([x, zs[4], 0]); ring.push([x, zs[0], Math.PI]); }
  for (let i = 1; i < 4; i++) { ring.push([W / 2, zs[i], Math.PI / 2]); ring.push([-W / 2, zs[i], -Math.PI / 2]); }
  for (const [x, z, ry] of ring) {
    const corner = Math.abs(Math.abs(x) - W / 2) < 1e-6 && (z === zs[0] || z === zs[4]);
    cyl(gp, col, x, P, z, 0.0062, Hc, 8);
    if (z === zs[4]) cyl(gp, shade(stone, 1.1), x, P, z, 0.01, 0.004, 8);
    tangSet(gp, x, y0, z, corner ? Math.atan2(Math.sign(x), z === zs[4] ? 1 : -1) : ry, 0.72, wood, blk);
  }
  // walls, doors and lattice windows
  const fz = zs[4];
  box(gp, wall, 0, P, HZ, W, Hc - 0.004, D);
  for (let i = 1; i < 6; i++) {
    const xc = (xs[i] + xs[i + 1]) / 2;
    pbox(gp, '#6e4030', xc, P, fz + 0.001, 0.046, Hc * 0.86, 0.003, (px, _py, _pz, _nx, _ny, nz) => (Math.abs(nz) > 0.7 && Math.floor(px) % 2 ? '#62382a' : '#6e4030'), 0.006, 0.01);
    box(gp, '#8a7a5a', xc, P + Hc * 0.42, fz + 0.003, 0.002, 0.004, 0.002);
  }
  for (const i of [0, 6]) {
    const xc = (xs[i] + xs[i + 1]) / 2;
    box(gp, '#2a2018', xc, P + Hc * 0.35, fz + 0.001, 0.044, Hc * 0.4, 0.003);
    for (let k = 0; k < 7; k++) box(gp, '#6e4030', xc - 0.018 + k * 0.006, P + Hc * 0.35, fz + 0.0025, 0.0025, Hc * 0.4, 0.002);
  }
  for (const sz of [-1, 1]) box(gp, col, 0, y0 - 0.009, HZ + sz * D / 2, W + 0.008, 0.009, 0.008);
  for (const sx of [-1, 1]) box(gp, col, sx * W / 2, y0 - 0.009, HZ, 0.008, 0.009, D + 0.008);
  // bracket-zone wall plates (柱头枋) and plastered panels, small intermediate sets (补间)
  for (const sz of [-1, 1]) {
    box(gp, wall, 0, y0 + 0.004, HZ + sz * D / 2, W, 0.03, 0.004);
    for (let k = 0; k < 3; k++) box(gp, wood, 0, y0 + 0.0065 + k * 0.009, HZ + sz * (D / 2 + 0.002), W + 0.03, 0.004, 0.004);
  }
  for (const sx of [-1, 1]) {
    box(gp, wall, sx * W / 2, y0 + 0.004, HZ, 0.004, 0.03, D);
    for (let k = 0; k < 3; k++) box(gp, wood, sx * (W / 2 + 0.002), y0 + 0.0065 + k * 0.009, HZ, 0.004, 0.004, D + 0.03);
  }
  for (let i = 0; i < 7; i++) {
    const xc = (xs[i] + xs[i + 1]) / 2;
    box(gp, blk, xc, y0 + 0.02, fz + 0.004, 0.008, 0.005, 0.008);
    box(gp, wood, xc, y0 + 0.025, fz + 0.012, 0.005, 0.005, 0.022);
    box(gp, wood, xc, y0 + 0.03, fz + 0.022, 0.03, 0.004, 0.005);
  }
  // eave purlins resting on the bracket tips, then the great low hip roof with chiwei
  const po = 0.049, py = y0 + 0.034;
  for (const sz of [-1, 1]) box(gp, wood, 0, py, HZ + sz * (D / 2 + po), W + po * 2 + 0.008, 0.006, 0.007);
  for (const sx of [-1, 1]) box(gp, wood, sx * (W / 2 + po), py, HZ, 0.007, 0.006, D + po * 2 + 0.008);
  hip(gp, 0, py + 0.012, HZ, W + 0.112, D + 0.112, 0.072, tile, { chiwei: '#4a4d52', lift: 0.06, k: 0.25, under: '#6e5040' });
  // Tang dhāraṇī pillar (经幢, 877) in front of the hall
  {
    const jx = 0.16, jz = 0.055, sc2 = '#9d978a', gj = grp(gp, jx, jz, 0, TT);
    gj.scale.setScalar(0.7);
    lathe(gj, [[0, 0], [0.02, 0], [0.02, 0.008], [0.014, 0.012], [0.017, 0.02], [0, 0.02]], sc2, 0, 0, 0, 8);
    cyl(gj, sc2, 0, 0.02, 0, 0.008, 0.06, 8);
    lathe(gj, [[0, 0], [0.018, 0.002], [0.016, 0.008], [0, 0.01]], sc2, 0, 0.08, 0, 8);
    cyl(gj, sc2, 0, 0.09, 0, 0.007, 0.016, 8);
    lathe(gj, [[0, 0], [0.013, 0], [0.006, 0.01], [0.004, 0.02], [0, 0.026]], sc2, 0, 0.106, 0, 8);
  }
  // monks on the stair, a pilgrim below, pines on the slopes
  const stairY = (z: number) => TT - ((z - TZ1) / 0.23) * (TT - 0.035);
  human(gp, 0.012, stairY(0.17), 0.17, { h: 0.05, pose: 'walk', phase: 0.3, top: '#6a5240', bottom: '#4e3e30', hair: null, dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, -0.015, stairY(0.25), 0.25, { h: 0.05, pose: 'walk', phase: 0.7, top: '#6a6a6a', bottom: '#4a4a4a', hair: null, dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, 0.04, 0.035, 0.37, { h: 0.05, pose: 'pray', top: '#5a4a6a', bottom: '#3a3040', hair: HAIR, hatStyle: 'knot', dress: 'ankle', ry: Math.PI, detail: 'lo' });
  human(gp, -0.1, TT, 0.05, { h: 0.05, pose: 'stand', top: '#6a5240', bottom: '#4e3e30', hair: null, dress: 'ankle', ry: 0.5, detail: 'lo' });
  for (let i = 0; i < 24; i++) {
    const ps = 0.075 + hash3(i, 5, 5) * 0.04, a = (i / 24) * TAU + hash3(i, 3, 1) * 0.2, rr = Math.min(0.34 + hash3(i, 4, 2) * 0.09, 0.452 - ps * 0.42), x = Math.sin(a) * rr, z = Math.cos(a) * rr;
    if (Math.abs(x) < TX + 0.03 && z > TZ0 - 0.04 && z < TZ1 + 0.02) continue;
    if (Math.abs(x) < 0.12 && z > 0) continue;
    minipine(gp, x, hf(x, z), z, ps, i % 2 ? '#2c5634' : '#355e3a');
  }
  // the great old pines on the slope behind the hall, two spreading trees before the terrace
  for (const [x, z, ps] of [[-0.2, -0.38, 0.2], [0.05, -0.41, 0.22], [0.25, -0.35, 0.18]] as [number, number, number][]) minipine(gp, x, hf(x, z), z, ps, '#2f5636');
  for (const sx of [-1, 1]) broadleaf(gp, sx * 0.21, hf(sx * 0.21, 0.19), 0.19, 0.16, sx < 0 ? '#4f6a3c' : '#56703e');
}


export const H_LIFE_ARCH1: Record<string, Builder> = {
  lf_banpo, lf_hangtu,
  lf_que, lf_mingtang, lf_tongque, lf_lingqu,
  lf_grotto, lf_songyue, lf_zhaozhou, lf_dayan, lf_foguang,
};
