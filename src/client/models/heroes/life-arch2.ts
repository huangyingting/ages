import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, ellip, rod, strut, tube, lathe, prism, skin, panel, archPath, tbox, gable,
  paintFaces, shade, mix, hash3, fbm,
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
function ground(p: THREE.Object3D, R: number, top: string, side = shade(top, 0.7), h = 0.03): number {
  lathe(p, [[0, 0], [R, 0], [R * 0.98, h * 0.8], [R * 0.95, h], [0, h]], side, 0, 0, 0, 40);
  lathe(p, [[0, h], [R * 0.95, h], [0, h + 0.002]], top, 0, 0, 0, 40);
  return h;
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
function pbox(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, h: number, d: number, paint: Paint, cell = 0.008, ry = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(h / cell)), Math.max(1, Math.round(d / cell)));
  geo.translate(0, h / 2, 0);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1, ry);
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
    pbox(gr, o.front, 0, 0.01, d / 2 + 0.002, w * 0.84, h * 0.86, 0.004, lattice(o.bar ?? '#2b211b'), 0.006);
    box(gr, o.door ?? '#2a1d16', 0, 0.01, d / 2 + 0.0045, w * 0.13, h * 0.72, 0.002);
    const n = Math.max(2, Math.round(w / 0.05));
    for (let i = 0; i <= n; i++) cyl(gr, o.col ?? '#7a2a1f', -w * 0.43 + (i / n) * w * 0.86, 0.01, d / 2 + 0.006, 0.003, h, 5);
  }
  const rh = o.rh ?? d * 0.38;
  gable(gr, w, rh, d, wall, 0, 0.01 + h, 0);
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
function leafy(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, seed = 0): void {
  strut(p, [x, y, z], [x + (hash3(seed, 1, 1) - 0.5) * s * 0.2, y + s * 0.85, z], s * 0.07, s * 0.04, '#5a4030', 5);
  for (let i = 0; i < 4; i++) {
    const a = seed * 2.1 + i * 1.9, d = i ? s * 0.3 : 0;
    blob(p, shade(c, 0.88 + hash3(seed, i, 3) * 0.26), x + Math.cos(a) * d, y + s * (i ? 0.82 : 1.02) + hash3(i, seed, 1) * s * 0.15, z + Math.sin(a) * d, s * (i ? 0.3 : 0.4), s * (i ? 0.26 : 0.34), s * (i ? 0.3 : 0.4), a);
  }
}
function willow(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed = 0): void {
  strut(p, [x, y, z], [x + s * 0.12, y + s * 0.8, z], s * 0.07, s * 0.04, '#5a4532', 5);
  blob(p, '#8fb04c', x + s * 0.12, y + s * 0.92, z, s * 0.34, s * 0.2, s * 0.34);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + seed, r = s * 0.27;
    ellip(p, i % 2 ? '#9cbd55' : '#86a846', x + s * 0.12 + Math.cos(a) * r, y + s * 0.62, z + Math.sin(a) * r, s * 0.07, s * 0.28, s * 0.07);
  }
}
function bamboo(p: THREE.Object3D, x: number, y: number, z: number, s: number, n = 5, seed = 0): void {
  for (let i = 0; i < n; i++) {
    const a = seed + i * 2.4, d = s * 0.08 * Math.sqrt(i), bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    const tx = bx + Math.cos(a) * s * 0.12, tz = bz + Math.sin(a) * s * 0.12, th = s * (0.85 + hash3(i, seed, 2) * 0.3);
    rod(p, [bx, y, bz], [tx, y + th, tz], s * 0.012, i % 2 ? '#6f9a3c' : '#5d8a34', 4);
    blob(p, i % 2 ? '#4f7f2e' : '#5e9036', tx, y + th * 0.82, tz, s * 0.1, s * 0.2, s * 0.1, a);
  }
}
/** Open timber pavilion (亭) with n columns, bench rails, painted beam band and an upswept roof. */
function pavilion(p: THREE.Object3D, x: number, y: number, z: number, R: number, h: number, tile: string, col = C.ver, n = 6): number {
  poly(p, n, R * 1.3, R * 1.25, 0.014, x, y, z, '#c9c2b2');
  const yb = y + 0.014, rot = Math.PI / n + Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, b = rot + ((i + 1) / n) * TAU, fc = rot + ((i + 0.5) / n) * TAU;
    const ax = x + Math.cos(a) * R, az = z + Math.sin(a) * R, bx = x + Math.cos(b) * R, bz = z + Math.sin(b) * R;
    cyl(p, col, ax, yb, az, R * 0.06, h, 6);
    if (Math.sin(fc) < 0.95) rod(p, [ax, yb + h * 0.28, az], [bx, yb + h * 0.28, bz], R * 0.03, shade(col, 0.8), 4);
  }
  poly(p, n, R * 1.05, R * 1.05, h * 0.12, x, yb + h * 0.86, z, '#2f6d63');
  const top = proof(p, x, yb + h, z, { n, R0: R * 1.75, R1: R * 0.08, h: R * 1.15, lift: 0.75, tile });
  gourd(p, x, top - 0.004, z, R * 0.16, '#c9a24a');
  return top;
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

// ---------------------------------------------------------------------------------------------------------
// 虎丘塔 — the leaning brick pagoda of Yunyan Temple on Tiger Hill, Suzhou (959)

const lf_huqiu: Builder = gp => {
  ground(gp, 0.47, '#5f7d3e', C.earth);
  const hf: HF = (x, z) => {
    const r = Math.hypot(x, z), m = Math.max(0, 1 - r / 0.45);
    const n = (fbm(x * 8 + 3, 1, z * 8) - 0.5) * 0.07 * sstep(0.13, 0.2, r);
    return Math.min(0.13, 0.21 * m ** 1.3) + n * m;
  };
  const Y = land(gp, 0.448, hf, (x, _y, z, _nx, ny) => {
    const r = Math.hypot(x, z);
    if (r < 0.125) return hash3(Math.floor(x * 70), 0, Math.floor(z * 70)) > 0.5 ? '#b6ad9c' : '#a69d8c';
    if (Math.abs(x) < 0.03 && z > 0) return '#a39b8a';
    if (ny < 0.74 || fbm(x * 14, 2, z * 14) > 0.63) return mix('#8b857a', '#6a655c', hash3(x * 99, 1, z * 99));
    return mix('#5f8a3e', '#46702f', fbm(x * 10, 5, z * 10));
  });
  // stone steps up the front slope and the Yuan-dynasty second gate (二山门)
  for (let i = 0; i < 13; i++) {
    const z = 0.43 - i * 0.024, y = Y(0, z);
    box(gp, i % 2 ? '#aaa291' : '#9e9684', 0, y - 0.012, z, 0.05, 0.014, 0.026);
  }
  const yg = Y(0, 0.3) + 0.004;
  box(gp, '#9a927f', 0, Y(0, 0.36) - 0.01, 0.3, 0.15, yg - Y(0, 0.36) + 0.01, 0.075);
  hall(gp, 0, yg, 0.3, 0.13, 0.055, 0.038, '#45484d', 0, '#e6dfcf', { col: '#5a3a28', band: '#3d2c22', rh: 0.034, lift: 0.3 });
  box(gp, C.dark, 0, yg, 0.3 + 0.0285, 0.026, 0.03, 0.003);
  // the leaning tower: octagonal brick imitation of a timber pagoda, 7 storeys, finial long gone
  const tw = grp(gp, 0, -0.02, 0, Y0 + 0.13);
  tw.rotation.set(0.03, 0, -0.06);
  poly(tw, 8, 0.118, 0.112, 0.022, 0, -0.01, 0, '#a59c8c');
  const brick = '#9a8166', bp = brickPaint(brick, '#b9ab92');
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
        box(tw, '#231b15', fx * 1.012, y + h * 0.12, fz * 1.012, R * 0.28, h * 0.54, 0.006, ry);
      } else box(tw, '#77634f', fx, y + h * 0.32, fz, R * 0.3, h * 0.34, 0.005, ry);
    }
    // brick bracket course, short corbelled eave, then the balcony (平座) of the next storey
    poly(tw, 8, R * 1.02, R * 1.08, 0.012, 0, y + h, 0, '#b49d7c', ringPaint('#6e5a45', 64), 1, 8);
    const ey = proof(tw, 0, y + h + 0.012, 0, { n: 8, R0: R * 1.42, R1: R * 0.97, h: 0.016, lift: 0.14, k: 0.25, tile: '#5c4b3c', rib: '#6b5847', under: '#8c7760' });
    if (i < 6) {
      const Rn = 0.084 - (i + 1) * 0.0046;
      poly(tw, 8, Rn * 1.14, Rn * 1.16, 0.009, 0, ey - 0.002, 0, '#a89274', ringPaint('#7a6650', 64), 1, 8);
      y = ey + 0.007;
    } else {
      // truncated crown: a stub of broken brickwork with weeds
      poly(tw, 8, R * 0.95, R * 0.9, 0.016, 0, ey - 0.003, 0, brick, bp, 3, 2);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + 0.3;
        blob(tw, k % 3 ? shade(brick, 0.85) : '#4f7a32', Math.cos(a) * R * 0.7, ey + 0.014, Math.sin(a) * R * 0.7, 0.008 + (k % 3) * 0.003, 0.007, 0.008);
      }
    }
  }
  // trees and rocks of the hill
  for (let k = 0; k < 16; k++) {
    const a = k * 2.39 + 0.4, r = 0.19 + hash3(k, 2, 1) * 0.21, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 0.09 && z > 0.05) continue;
    if (k % 4 === 0) minipine(gp, x, Y(x, z) + 0.004, z, 0.1, '#2f5a32');
    else leafy(gp, x, Y(x, z) - 0.004, z, 0.075 + hash3(k, 1, 4) * 0.04, k % 3 ? '#4f7f36' : '#6a8f3a', k);
  }
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + 0.2, r = 0.16 + (k % 3) * 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r;
    blob(gp, '#8b857a', x, Y(x, z), z, 0.03, 0.018, 0.024, a);
  }
  human(gp, 0.012, Y(0, 0.4) - 0.005, 0.4, { h: 0.055, pose: 'walk', ry: Math.PI, top: '#4a6a8a', bottom: '#3a3128', hair: '#1c1714', detail: 'lo' });
  human(gp, -0.014, Y(0, 0.2) - 0.005, 0.2, { h: 0.055, pose: 'walk', phase: 0.5, ry: Math.PI, top: '#c7b38a', bottom: '#4a3e2c', hair: '#1c1714', detail: 'lo', dress: 'ankle' });
};

// ---------------------------------------------------------------------------------------------------------
// 开封铁塔 — the "Iron Pagoda" of Youguo Temple, Kaifeng (1049): rust-brown glazed bricks, 13 storeys

const lf_tieta: Builder = gp => {
  ground(gp, 0.47, '#6f8c4c', C.earth);
  poly(gp, 8, 0.22, 0.22, 0.004, 0, 0.03, -0.07, '#bdb5a3');
  const pg = grp(gp, 0, -0.07, 0, 0.034);
  poly(pg, 8, 0.12, 0.115, 0.012, 0, 0, 0, '#a8a090');
  poly(pg, 8, 0.1, 0.096, 0.026, 0, 0.012, 0, '#b3ab9a', ringPaint('#9a9282', 32), 1, 4);
  const glaze = '#7b4a2c';
  const gpaint: Paint = (x, y, z, _nx, ny) => {
    if (Math.abs(ny) > 0.6) return null;
    const c = Math.floor(y / 0.0048), a = Math.atan2(z, x), b = Math.floor(a * 14 + (c % 2) * 0.5);
    const hsh = hash3(c, b, 7);
    return hsh > 0.86 ? '#9a6238' : hsh < 0.14 ? '#5c3420' : shade(glaze, 0.92 + hsh * 0.16);
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
    poly(pg, 8, R * 1.02, R * 1.06, 0.007, 0, y + h, 0, '#8a5532', ringPaint('#4a2a18', 64), 1, 8);
    y = proof(pg, 0, y + h + 0.007, 0, { n: 8, R0: R * 1.4, R1: R * 0.98, h: 0.011, lift: 0.4, tile: '#6b3b22', rib: '#83502e', under: '#4a2a18' }) + 0.002;
  }
  lathe(pg, [[0, 0], [0.03, 0], [0.034, 0.012], [0.022, 0.026], [0, 0.03]], '#5a3a24', 0, y - 0.002, 0, 8);
  gourd(pg, 0, y + 0.026, 0, 0.016, '#8a6a3a');
  // lotus pond with a hexagonal pavilion in front
  const pond: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, w = 1 + (hash3(i, 3, 1) - 0.5) * 0.25;
    pond.push([-0.13 + Math.cos(a) * 0.15 * w, 0.27 + Math.sin(a) * 0.1 * w]);
  }
  prism(gp, pond.map(([x, z]) => [(x + 0.13) * 1.08 - 0.13, (z - 0.27) * 1.14 + 0.27] as [number, number]), 0.03, 0.007, '#a59d8c', 0, true);
  prism(gp, pond, 0.032, 0.006, C.water, 0, true);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3, r = 0.03 + hash3(i, 1, 9) * 0.07;
    cyl(gp, i % 2 ? '#4f8a3a' : '#5e9a44', -0.16 + Math.cos(a) * r * 1.3, 0.038, 0.27 + Math.sin(a) * r * 0.7, 0.012, 0.002, 8);
    if (i % 3 === 0) ellip(gp, '#f0a0b8', -0.16 + Math.cos(a) * r * 1.3, 0.046, 0.27 + Math.sin(a) * r * 0.7, 0.006, 0.007, 0.006);
  }
  pavilion(gp, 0.17, 0.03, 0.26, 0.042, 0.05, '#45484d');
  for (const [x, z, s] of [[-0.33, -0.1, 0.1], [0.33, -0.12, 0.11], [-0.3, -0.28, 0.09], [0.28, -0.3, 0.1]] as const) leafy(gp, x, 0.032, z, s, '#4f7f36', x * 10);
  for (const [x, z] of [[-0.36, 0.12], [0.37, 0.08]] as const) minipine(gp, x, 0.034, z, 0.1);
  willow(gp, -0.31, 0.032, 0.3, 0.12, 1);
  human(gp, 0.05, 0.034, 0.12, { h: 0.06, pose: 'point', ry: Math.PI * 0.9, top: '#8a3a2a', bottom: '#3a3128', hair: '#1c1714', detail: 'lo' });
  human(gp, 0.1, 0.034, 0.15, { h: 0.055, pose: 'stand', ry: Math.PI, top: '#d9c7a1', bottom: '#4a3e2c', hair: '#1c1714', detail: 'lo', dress: 'ankle' });
};

// ---------------------------------------------------------------------------------------------------------
// 书院 — a Song academy of classical learning (岳麓书院 / 白鹿洞书院): gate, lecture hall, library pavilion

const lf_academy: Builder = gp => {
  ground(gp, 0.47, '#71874c', C.earth);
  const pave: Paint = (x, _y, z, _nx, ny) => (ny < 0.5 ? null : hash3(Math.floor(x / 0.02), 0, Math.floor(z / 0.02)) > 0.5 ? '#c9c2b0' : '#bdb5a2');
  pbox(gp, '#c4bca9', 0, 0.03, -0.02, 0.52, 0.004, 0.7, pave, 0.02);
  const wall = '#ece8dc', tile = '#46494e', woodc = '#6a2e22';
  // compound walls with tiled coping, front wall split by the gate
  wallSeg(gp, -0.26, -0.36, 0.26, -0.36, Y0, 0.07, wall, tile);
  for (const sx of [-1, 1]) {
    wallSeg(gp, sx * 0.26, -0.36, sx * 0.26, 0.33, Y0, 0.07, wall, tile);
    wallSeg(gp, sx * 0.08, 0.33, sx * 0.26, 0.33, Y0, 0.07, wall, tile);
  }
  // gate hall (头门) with black plaque
  hall(gp, 0, Y0, 0.33, 0.17, 0.07, 0.075, tile, 0, wall, { col: '#4a3226', band: '#3a2a20', rh: 0.05, lift: 0.3 });
  box(gp, '#2a1d16', 0, Y0, 0.33 + 0.036, 0.04, 0.055, 0.003);
  box(gp, '#1c1a18', 0, Y0 + 0.058, 0.33 + 0.039, 0.05, 0.014, 0.003);
  box(gp, C.gold, 0, Y0 + 0.062, 0.33 + 0.041, 0.036, 0.006, 0.001);
  for (let i = 0; i < 2; i++) box(gp, '#a59d8c', 0, 0.03, 0.385 + i * 0.016, 0.1 - i * 0.02, 0.012 - i * 0.006, 0.02);
  // dormitory wings (斋舍) facing the front court
  for (const sx of [-1, 1]) house(gp, sx * 0.2, Y0, 0.17, 0.2, 0.07, 0.045, sx * -Math.PI / 2, { wall, roof: tile, front: '#7a4a30', bar: '#3a2418', col: woodc });
  // lecture hall (讲堂): open front, dark interior, white gable walls
  rbox(gp, '#a8a08e', 0, 0.03, -0.03, 0.42, 0.03, 0.2, 0.004);
  for (let i = 0; i < 3; i++) box(gp, '#a8a08e', 0, 0.03, 0.08 + i * 0.012, 0.1, 0.03 - i * 0.01, 0.014);
  const yl = 0.06;
  hall(gp, 0, yl, -0.04, 0.34, 0.15, 0.085, tile, 0, '#3b2a20', { col: woodc, band: '#2f3d3a', rh: 0.075, lift: 0.45 });
  for (const sx of [-1, 1]) box(gp, wall, sx * 0.16, yl, -0.04, 0.025, 0.085, 0.152);
  box(gp, '#1c1a18', 0, yl + 0.064, 0.038, 0.07, 0.016, 0.003);
  box(gp, C.gold, 0, yl + 0.069, 0.04, 0.05, 0.006, 0.001);
  // the master on a dais with a low desk, students on mats in the courtyard
  box(gp, '#5a3a28', 0, yl, 0.05, 0.08, 0.008, 0.035);
  human(gp, 0, yl + 0.008, 0.045, { h: 0.06, pose: 'sitGround', top: '#efe8d8', bottom: '#d9cfb9', hair: '#d8d8d8', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'hi' });
  box(gp, '#4a2e1e', 0, yl + 0.008, 0.07, 0.05, 0.012, 0.016);
  box(gp, '#e8dfc4', 0.008, yl + 0.02, 0.07, 0.018, 0.003, 0.012);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
    const x = -0.105 + i * 0.07, z = 0.14 + r * 0.06;
    box(gp, '#c9b98f', x, 0.034, z, 0.042, 0.002, 0.04);
    box(gp, '#5a3a28', x, 0.034, z - 0.022, 0.03, 0.01, 0.01);
    human(gp, x, 0.036, z, { h: 0.05, pose: 'sitGround', ry: Math.PI, top: (i + r) % 2 ? '#e9e2d0' : '#c9d2d8', bottom: '#4a4a52', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'knot', dress: 'ankle', detail: 'lo' });
  }
  // two-storey library pavilion (御书楼)
  const zl = -0.26;
  rbox(gp, '#a8a08e', 0, 0.03, zl, 0.3, 0.025, 0.14, 0.004);
  const y1 = 0.055;
  box(gp, wall, 0, y1, zl, 0.24, 0.06, 0.1);
  box(gp, '#3a2618', 0, y1, zl + 0.051, 0.04, 0.045, 0.002);
  for (const sx of [-1, 1]) pbox(gp, '#7a4a30', sx * 0.075, y1 + 0.02, zl + 0.051, 0.04, 0.025, 0.002, lattice('#3a2418'), 0.004);
  const ov = 1.45, R0 = ((0.1 / 2) * ov) / Math.SQRT1_2;
  const y2 = proof(gp, 0, y1 + 0.06, zl, { n: 4, R0, R1: R0 * 0.72, h: 0.018, lift: 0.4, tile, sx: (0.24 + 0.1 * (ov - 1)) / (0.1 * ov) });
  poly(gp, 4, 0.13, 0.13, 0.004, 0, y2 - 0.004, zl, '#5a3a28');
  for (let i = 0; i <= 12; i++) box(gp, '#5a3a28', -0.09 + i * 0.015, y2, zl + 0.052, 0.003, 0.014, 0.003);
  box(gp, '#5a3a28', 0, y2 + 0.012, zl + 0.052, 0.185, 0.003, 0.003);
  hall(gp, 0, y2, zl, 0.19, 0.08, 0.055, tile, 0, '#7a4a30', { col: woodc, band: '#2f3d3a', rh: 0.06, lift: 0.5 });
  // ginkgo and maple trees, a pair of pines by the library
  for (const [x, z, c, s] of [[-0.36, 0.14, '#e3b33c', 0.13], [-0.35, -0.16, '#d9a830', 0.12], [0.36, 0.12, '#b8452e', 0.12], [0.35, -0.18, '#c4562e', 0.12], [-0.15, 0.4, '#e3b33c', 0.08], [0.16, 0.4, '#b8452e', 0.08]] as const) leafy(gp, x, 0.03, z, s, c, x * 7 + z);
  for (const sx of [-1, 1]) minipine(gp, sx * 0.2, 0.034, -0.17, 0.09);
  human(gp, -0.06, 0.034, 0.28, { h: 0.055, pose: 'walk', ry: Math.PI, top: '#e9e2d0', bottom: '#4a4a52', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 登封观星台 — Guo Shoujing's gnomon observatory (1276) with its 量天尺 sky-measuring scale

const lf_guanxing: Builder = gp => {
  ground(gp, 0.47, '#b3a283', '#7a6a50');
  const brick = '#9c8873', zc = -0.2, H = 0.25, B = 0.13, T = 0.075, gap = 0.032;
  // truncated pyramid in two halves with a vertical slot (直槽) facing the scale
  for (const sx of [-1, 1]) {
    const b0 = B - gap / 2, b1 = T - gap / 2, xb = sx * (gap / 2 + b0 / 2), xt = sx * (gap / 2 + b1 / 2);
    tbox(gp, b0, 2 * B, b1, 2 * T, H, brick, xb, Y0, zc, xt - xb, 0);
  }
  box(gp, shade(brick, 0.7), 0, Y0, zc + T - 0.03, gap, H, 0.06);
  for (let k = 1; k < 6; k++) {
    const yy = Y0 + (k / 6) * H, half = B - (B - T) * (k / 6);
    box(gp, shade(brick, 0.86), 0, yy, zc + half - 0.001, 2 * half + 0.004, 0.003, 0.004);
    for (const sx of [-1, 1]) box(gp, shade(brick, 0.86), sx * (half - 0.001), yy, zc, 0.004, 0.003, 2 * half + 0.004);
  }
  const top = Y0 + H;
  // parapet and the two little rooms on top, joined by the gnomon crossbar
  for (const sx of [-1, 1]) {
    box(gp, shade(brick, 1.08), sx * (T - 0.003), top, zc, 0.006, 0.012, 2 * T);
    const rx = sx * (gap / 2 + (T - gap / 2) / 2);
    box(gp, '#a89580', rx, top, zc + 0.005, 0.034, 0.038, 0.06);
    box(gp, C.dark, rx, top, zc + 0.036, 0.012, 0.024, 0.002);
    const rr = proof(gp, rx, top + 0.038, zc + 0.005, { n: 4, R0: 0.03 / Math.SQRT1_2 * 1.5, R1: 0.008, h: 0.022, lift: 0.45, tile: '#4a4d52', sx: 0.75 });
    gourd(gp, rx, rr - 0.003, zc + 0.005, 0.005, '#7a6a50');
  }
  box(gp, shade(brick, 1.08), 0, top, zc - T + 0.003, 2 * T, 0.012, 0.006);
  rod(gp, [-gap / 2 - 0.004, top + 0.032, zc + T - 0.012], [gap / 2 + 0.004, top + 0.032, zc + T - 0.012], 0.0035, '#4a3a2a', 6);
  // stair ramps hugging the side walls, then turning along the back to the top
  const sideX = (yy: number) => B - (B - T) * ((yy - Y0) / H), backZ = (yy: number) => zc - B + (B - T) * ((yy - Y0) / H);
  const sw = 0.034, st = '#a8957e';
  for (const sx of [-1, 1]) {
    const N1 = 10, N2 = 8, y1 = Y0 + H * 0.55;
    for (let k = 0; k < N1; k++) {
      const t = (k + 1) / N1, yt = Y0 + (y1 - Y0) * t, z = zc + B - 0.01 - ((k + 0.5) / N1) * (2 * B - 0.01);
      const x = sx * (sideX(yt) + sw / 2 - 0.004), len = (2 * B) / N1 + 0.002;
      box(gp, st, x, Y0, z, sw, yt - Y0, len);
      box(gp, shade(st, 0.9), x + sx * sw / 2, yt, z, 0.005, 0.014, len);
    }
    for (let k = 0; k < N2; k++) {
      const t = (k + 1) / N2, yt = y1 + (top - y1) * t, x = sx * (B + sw - ((k + 0.5) / N2) * (B + sw - gap / 2 - 0.006));
      const z = backZ(yt) - sw / 2 + 0.004, len = (B + sw) / N2 + 0.002;
      box(gp, st, x, Y0, z, len, yt - Y0, sw);
      box(gp, shade(st, 0.9), x, yt, z - sw / 2, len, 0.014, 0.005);
    }
  }
  // the 量天尺: long stone gnomon bed with twin water-level channels and graduations
  const z0 = zc + T - 0.005, z1 = 0.44, L = z1 - z0, zm = (z0 + z1) / 2;
  box(gp, '#d2ccbe', 0, 0.03, zm, 0.07, 0.016, L);
  for (const sx of [-1, 1]) box(gp, '#3f6f8a', sx * 0.024, 0.046, zm, 0.006, 0.0015, L - 0.01);
  for (let k = 0; k < 17; k++) box(gp, '#5a5246', 0, 0.046, z0 + 0.02 + k * (L - 0.04) / 16, 0.03, 0.0012, 0.002);
  // astronomers: one measuring the noon shadow with a sighting frame, one on top
  human(gp, 0.06, 0.034, 0.2, { h: 0.06, pose: 'crouch', ry: -Math.PI / 2, top: '#7a5a3a', bottom: '#3a3128', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'knee', detail: 'hi' });
  box(gp, '#6a4a2a', 0.0, 0.046, 0.2, 0.02, 0.016, 0.004);
  human(gp, -0.07, 0.034, 0.3, { h: 0.06, pose: 'point', ry: Math.PI * 0.8, top: '#4a5a7a', bottom: '#3a3128', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  human(gp, 0.02, top, zc - 0.02, { h: 0.045, pose: 'stand', top: '#8a3a2a', bottom: '#3a3128', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'lo' });
  for (const [x, z] of [[-0.33, 0.1], [0.34, 0.06], [-0.32, -0.22], [0.31, -0.26], [0.22, 0.32]] as const) minipine(gp, x, 0.032, z, 0.1, '#335a32');
  leafy(gp, -0.24, 0.032, 0.3, 0.1, '#5a8a3a', 2);
};

// ---------------------------------------------------------------------------------------------------------
// 妙应寺白塔 — the Yuan white dagoba of Beijing (1279), designed by Araniko

/** 亚-shaped plan: a square of half-size s with two-step recessed corners of depth k. */
function yaPlan(s: number, k: number): [number, number][] {
  const out: [number, number][] = [];
  const q: [number, number][] = [[s, s - 2 * k], [s - k, s - 2 * k], [s - k, s - k], [s - 2 * k, s - k], [s - 2 * k, s]];
  for (const [sx, sz, rev] of [[1, 1, false], [-1, 1, true], [-1, -1, false], [1, -1, true]] as const) {
    const pts = q.map(([a, b]) => (rev ? [sx * a, sz * b] : [sx * a, sz * b]) as [number, number]);
    out.push(...(rev ? pts.reverse() : pts));
  }
  return out;
}
/** 须弥座 plinth on a 亚 plan: base, recessed waist and top cornice. */
function sumeru(p: THREE.Object3D, s: number, k: number, y: number, h: number, c: string): number {
  prism(p, yaPlan(s, k), y, h * 0.25, c);
  prism(p, yaPlan(s * 0.93, k * 0.93), y + h * 0.25, h * 0.5, shade(c, 0.9));
  prism(p, yaPlan(s, k), y + h * 0.75, h * 0.25, c);
  return y + h;
}
const lf_baita: Builder = gp => {
  ground(gp, 0.47, '#b9b2a2', '#7a7262');
  const white = '#f2f0ea', red = '#a8352a', tile = '#4a4d52';
  // temple enclosure: red walls, corner pavilions, front gate
  for (const [x0, z0, x1, z1] of [[-0.3, -0.3, 0.3, -0.3], [-0.3, -0.3, -0.3, 0.3], [0.3, -0.3, 0.3, 0.3], [-0.3, 0.3, -0.07, 0.3], [0.07, 0.3, 0.3, 0.3]] as const) wallSeg(gp, x0, z0, x1, z1, 0.03, 0.06, red, tile, 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(gp, red, sx * 0.3, 0.03, sz * 0.3, 0.05, 0.065, 0.05);
    proof(gp, sx * 0.3, 0.095, sz * 0.3, { n: 4, R0: 0.05, R1: 0.004, h: 0.035, lift: 0.5, tile, rot: Math.PI / 4 });
  }
  hall(gp, 0, 0.03, 0.3, 0.14, 0.06, 0.06, tile, 0, red, { col: red, band: C.jade, rh: 0.045, lift: 0.4 });
  box(gp, C.dark, 0, 0.03, 0.331, 0.035, 0.045, 0.003);
  // stone platform and the double 亚-shaped sumeru base
  rbox(gp, '#d9d4c8', 0, 0.03, -0.02, 0.5, 0.03, 0.5, 0.004);
  const sg = grp(gp, 0, -0.02);
  for (let i = 0; i < 4; i++) box(sg, '#cfc9bc', 0, 0.03 + i * 0.0075, 0.25 + 0.024 - i * 0.008, 0.1, 0.0075, 0.012);
  let y = 0.06;
  y = sumeru(sg, 0.21, 0.035, y, 0.075, white);
  y = sumeru(sg, 0.17, 0.028, y, 0.075, '#eeebe3');
  // lotus petals and the five vajra rings
  const petals: [number, number][] = [[0, 0], [0.15, 0]];
  for (let i = 0; i < 3; i++) petals.push([0.16 - i * 0.004, 0.006 + i * 0.006], [0.148 - i * 0.004, 0.009 + i * 0.006]);
  petals.push([0.14, 0.026], [0, 0.026]);
  lathe(sg, petals, '#e9e5dc', 0, y, 0, 32);
  y += 0.026;
  for (let i = 0; i < 5; i++) lathe(sg, [[0, 0], [0.137 - i * 0.003, 0], [0.141 - i * 0.003, 0.003], [0.137 - i * 0.003, 0.006], [0, 0.006]], i % 2 ? white : '#e4e0d6', 0, y + i * 0.005, 0, 32);
  y += 0.026;
  // the inverted-bowl body (覆钵): narrower below, broad rounded shoulders above
  lathe(sg, [[0, 0], [0.125, 0], [0.13, 0.02], [0.142, 0.06], [0.152, 0.1], [0.154, 0.125], [0.145, 0.15], [0.12, 0.172], [0.08, 0.183], [0, 0.186]], white, 0, y, 0, 40);
  // the 7 bronze "eye" medallion bands under the shoulder
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, r = 0.153;
    ellip(sg, '#c8a24a', Math.cos(a) * r, y + 0.118, Math.sin(a) * r, 0.006, 0.006, 0.003, Math.PI / 2 - a);
  }
  y += 0.18;
  // small 亚 base for the spire
  y = sumeru(sg, 0.075, 0.012, y, 0.04, white);
  // the conical spire of 13 rings (十三天)
  const ring: [number, number][] = [[0, 0]];
  const sh = 0.17, dh = sh / 13;
  for (let k = 0; k < 13; k++) {
    const r = 0.06 - (0.034 * k) / 13, yy = k * dh;
    ring.push([r, yy], [r + 0.006, yy + dh * 0.3], [r + 0.006, yy + dh * 0.65], [r - 0.001, yy + dh]);
  }
  ring.push([0.026, sh + 0.004], [0, sh + 0.004]);
  lathe(sg, ring, white, 0, y, 0, 24);
  y += sh + 0.004;
  // bronze canopy (华盖) with hanging plaques and wind-bells
  const bronze = '#6f5e3e';
  lathe(sg, [[0, 0], [0.085, 0], [0.09, 0.008], [0.07, 0.02], [0.03, 0.03], [0, 0.032]], bronze, 0, y, 0, 24);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, r = 0.084;
    box(sg, '#7d6a44', Math.cos(a) * r, y - 0.022, Math.sin(a) * r, 0.01, 0.022, 0.002, Math.PI / 2 - a);
    if (i % 2 === 0) cone(sg, '#8a7448', Math.cos(a) * (r + 0.004), y - 0.032, Math.sin(a) * (r + 0.004), 0.004, 0.008, 6);
  }
  y += 0.03;
  // gilded small stupa on top
  lathe(sg, [[0, 0], [0.024, 0], [0.024, 0.006], [0.018, 0.008], [0.022, 0.02], [0.016, 0.03], [0.006, 0.034], [0.006, 0.05], [0.01, 0.055], [0, 0.07]], '#e1b33a', 0, y, 0, 16);
  // pilgrims and juniper trees
  for (const [x, z] of [[-0.22, 0.22], [0.22, 0.22], [-0.23, -0.24], [0.23, -0.24]] as const) minipine(gp, x, 0.06, z, 0.07, '#3a5a34');
  human(gp, 0.05, 0.034, 0.38, { h: 0.055, pose: 'pray', ry: Math.PI, top: '#8a2a2a', bottom: '#5a2020', hair: null, detail: 'lo', dress: 'ankle' });
  human(gp, -0.06, 0.034, 0.4, { h: 0.055, pose: 'walk', ry: Math.PI, top: '#3a5a7a', bottom: '#3a3128', hair: '#1c1714', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 永定土楼 — a Hakka round earthen fortress-house of Fujian

/** Continuous ring roof (outer eave → ridge → inner eave) with radial tile ribs. */
function ringRoof(p: THREE.Object3D, Ro: number, Rr: number, Ri: number, y: number, h: number, tile: string, seg = 160): void {
  const circ = (R: number, yy: number): V3[] => Array.from({ length: seg }, (_, j) => [Math.cos((j / seg) * TAU) * R, yy, Math.sin((j / seg) * TAU) * R] as V3);
  const rib = shade(tile, 1.22);
  skin(p, [circ(Ro, y - 0.004), circ((Ro + Rr) / 2, y + h * 0.62), circ(Rr, y + h), circ((Rr + Ri) / 2, y + h * 0.55), circ(Ri, y - 0.004)], tile, {
    flat: true,
    paint: (x, _y, z, _nx, ny) => (ny < 0 ? shade(tile, 0.55) : Math.floor(((Math.atan2(z, x) + TAU) / TAU) * seg) % 2 ? rib : null),
  });
  lathe(p, [[Rr - 0.004, y + h - 0.002], [Rr + 0.004, y + h - 0.002], [Rr + 0.003, y + h + 0.005], [Rr - 0.003, y + h + 0.005], [Rr - 0.004, y + h - 0.002]], shade(tile, 0.75), 0, 0, 0, 64);
}
const lf_tulou: Builder = gp => {
  ground(gp, 0.47, '#6f8f45', C.earth);
  const Y = Y0 - 0.002, H = 0.21, RO = 0.3, RI = 0.2, fl = H / 4, seg = 120;
  const tile = '#55575a';
  lathe(gp, [[0, 0], [RI, 0], [RI, 0.004], [0, 0.004]], '#a8a296', 0, Y - 0.002, 0, 40);
  // rammed-earth outer wall with stone footing, tapering upward
  const rings: V3[][] = [];
  for (let l = 0; l <= 20; l++) {
    const t = l / 20, r = RO + 0.008 * (1 - t);
    rings.push(Array.from({ length: seg }, (_, j) => [Math.cos((j / seg) * TAU) * r, Y + t * H, Math.sin((j / seg) * TAU) * r] as V3));
  }
  skin(gp, rings, '#c4925a', {
    paint: (x, yy, z) => {
      const v = yy - Y, a = Math.atan2(z, x);
      if (v < 0.02) return hash3(Math.floor(a * 40), Math.floor(v / 0.007), 1) > 0.5 ? '#9a948a' : '#85807a';
      const layer = Math.floor(v / 0.0105);
      return shade('#c4925a', 0.9 + hash3(layer, Math.floor(a * 6), 1) * 0.1 + (fbm(a * 4, v * 30, 2) - 0.5) * 0.22);
    },
  });
  // timber inner façade: earthen ground floor with doors, galleries of rooms above
  const inner: V3[][] = [];
  for (let l = 0; l <= 24; l++) inner.push(Array.from({ length: seg }, (_, j) => [Math.cos((j / seg) * TAU) * RI, Y + (l / 24) * H, Math.sin((j / seg) * TAU) * RI] as V3));
  skin(gp, inner, '#7a5236', {
    inward: true,
    paint: (x, yy, z) => {
      const v = yy - Y, f = Math.floor(v / fl), u = (v % fl) / fl, bay = Math.floor(((Math.atan2(z, x) + TAU) / TAU) * 60);
      if (f === 0) return u < 0.7 && bay % 3 === 0 ? '#2a1d14' : '#b58a5a';
      if (u > 0.82) return '#5a3a24';
      return u > 0.15 && bay % 2 === 0 ? '#3a2618' : null;
    },
  });
  for (let f = 1; f < 4; f++) {
    const yb = Y + f * fl;
    lathe(gp, [[RI - 0.018, yb - 0.004], [RI, yb - 0.004], [RI, yb], [RI - 0.018, yb], [RI - 0.018, yb - 0.004]], '#6b4a30', 0, 0, 0, 60);
    const rr = RI - 0.017;
    skin(gp, [0, 0.014].map(dy => Array.from({ length: seg }, (_, j) => [Math.cos((j / seg) * TAU) * rr, yb + dy, Math.sin((j / seg) * TAU) * rr] as V3)), '#8a6040', {
      inward: true, paint: (x, _yy, z) => (Math.floor(((Math.atan2(z, x) + TAU) / TAU) * seg) % 2 ? '#4a3020' : null),
    });
  }
  ringRoof(gp, RO + 0.036, (RO + RI) / 2 + 0.005, RI - 0.03, Y + H, 0.05, tile);
  // small windows only on the upper two floors (a fortress below)
  for (const f of [2, 3]) for (let k = 0; k < 30; k++) {
    const a = (k / 30) * TAU + (f === 3 ? 0.1 : 0), yy = Y + (f + 0.35) * fl, r = RO + 0.008 * (1 - (yy - Y) / H) + 0.001;
    if (Math.abs(Math.sin(a) - 1) < 0.01) continue;
    box(gp, '#2b211a', Math.cos(a) * r, yy, Math.sin(a) * r, 0.011, 0.015, 0.006, Math.PI / 2 - a);
  }
  // the single granite-framed arched gate
  const gz = RO + 0.006;
  box(gp, '#b9b2a2', 0, Y, gz, 0.066, 0.078, 0.018);
  box(gp, '#2a1f18', 0, Y, gz + 0.002, 0.04, 0.054, 0.018);
  ellip(gp, '#2a1f18', 0, Y + 0.054, gz + 0.002, 0.02, 0.016, 0.009);
  box(gp, '#2a1d16', 0, Y + 0.082, gz + 0.004, 0.05, 0.016, 0.004);
  box(gp, C.gold, 0, Y + 0.086, gz + 0.006, 0.036, 0.007, 0.001);
  for (const sx of [-1, 1]) {
    box(gp, '#c0302a', sx * 0.027, Y + 0.01, gz + 0.0095, 0.008, 0.05, 0.001);
    lantern(gp, sx * 0.045, Y + 0.07, gz + 0.018, 0.012);
  }
  // inner one-storey ring and the ancestral hall in the courtyard
  const ri: V3[][] = [0, 0.045].map(dy => Array.from({ length: 80 }, (_, j) => [Math.cos((j / 80) * TAU) * 0.125, Y + dy, Math.sin((j / 80) * TAU) * 0.125] as V3));
  skin(gp, ri, '#d8cdb4', { paint: (x, _yy, z) => (Math.floor(((Math.atan2(z, x) + TAU) / TAU) * 40) % 4 === 0 ? '#3a2618' : null) });
  ringRoof(gp, 0.14, 0.115, 0.09, Y + 0.045, 0.025, tile, 120);
  hall(gp, 0, Y, 0, 0.08, 0.055, 0.04, tile, 0, '#7a4a30', { col: '#8f2a1f', band: C.jade, rh: 0.035, lift: 0.4 });
  // a stone path, tea terraces and bamboo
  box(gp, '#a8a296', 0, 0.03, 0.39, 0.05, 0.004, 0.16);
  for (const [a0, a1, r] of [[0.2, 1.3, 0.37], [0.25, 1.28, 0.42], [1.85, 2.95, 0.37], [1.88, 2.9, 0.42]] as const) {
    const pts: V3[] = [];
    for (let i = 0; i <= 8; i++) { const a = a0 + ((a1 - a0) * i) / 8; pts.push([Math.cos(a) * r, Y + 0.012, Math.sin(a) * r]); }
    tube(gp, pts, 0.013, 0.013, r > 0.4 ? '#3f6f2e' : '#4a7d34', { radial: 6 });
  }
  for (const a of [3.6, 4.2, 4.8, 5.4, 6.0]) bamboo(gp, Math.cos(a) * 0.39, Y, Math.sin(a) * 0.39, 0.22, 5, a);
  human(gp, 0.06, Y, 0.37, { h: 0.055, pose: 'carry', ry: Math.PI, top: '#3a5a7a', bottom: '#2a2a2a', hair: '#1c1714', hat: '#c8a96a', hatStyle: 'conical', detail: 'lo' });
  human(gp, 0.03, Y, 0.05, { h: 0.04, pose: 'run', top: '#c0302a', bottom: '#2a2a2a', hair: '#1c1714', detail: 'lo' });
};

// ---------------------------------------------------------------------------------------------------------
// 颐和园 — the Summer Palace: Longevity Hill, Tower of Buddhist Incense, Kunming Lake, Seventeen-Arch Bridge

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
  const water = '#5b93a8';
  ground(gp, 0.47, water, '#6b6a5a');
  const yellow = '#e0b23a', ver = C.ver;
  const hf: HF = (x, z) => {
    const isl = Math.max(0, 1 - Math.hypot(x - 0.09, z - 0.33) / 0.06);
    if (z > 0.0 && x < 0.37) return isl > 0 ? 0.004 + sstep(0, 0.4, isl) * 0.016 : 0;
    if (z > 0.0) return 0.012;
    const s = sstep(-0.005, -0.25, z), ridge = Math.max(0, 1 - (x / 0.5) ** 2);
    return 0.012 + s * 0.26 * ridge * (0.85 + 0.3 * fbm(x * 6, 1, z * 6));
  };
  const Y = land(gp, 0.448, hf, (x, y, z, _nx, ny) => {
    if (y < 0.0365) return hash3(Math.floor(x * 40), 1, Math.floor(z * 60)) > 0.85 ? '#7fb2c4' : water;
    if (y < 0.05 && (z > -0.06 || x > 0.36)) return '#cfc8b6';
    if (ny < 0.6) return '#7a7d5a';
    return mix('#4f7a36', '#3c6a2e', fbm(x * 12, 3, z * 12));
  });
  // Tower of Buddhist Incense on its great stone terrace
  const zt = -0.17, yt = Y0 + 0.22;
  pbox(gp, '#b4ab98', 0, 0.1, zt, 0.17, yt - 0.1, 0.15, (_x, yy, _z, _nx, ny) => (ny > 0.5 ? '#cfc8b6' : Math.floor(yy / 0.012) % 2 ? '#a9a08c' : null), 0.012);
  for (let i = 0; i < 8; i++) box(gp, '#c4bba8', 0, Y(0, -0.06) - 0.01 + i * 0.012, -0.075 - i * 0.002, 0.04, 0.014, 0.012);
  for (let i = 0; i <= 10; i++) for (const sz of [-1, 1]) box(gp, '#e8e4da', -0.08 + i * 0.016, yt, zt + sz * 0.074, 0.003, 0.012, 0.003);
  const tw = grp(gp, 0, zt, 0, yt);
  poly(tw, 8, 0.068, 0.066, 0.012, 0, 0, 0, '#e8e4da');
  let y = 0.012;
  const tiers: [number, number, number, number][] = [[0.052, 0.04, 0.088, 0.72], [0.048, 0.024, 0.08, 0.86], [0.042, 0.036, 0.072, 0.84], [0.034, 0.032, 0.062, 0.1]];
  tiers.forEach(([R, h, R0, k1], i) => {
    storey(tw, 0, y, 0, 8, R, h, ver, i === 1 ? '#7a2a1f' : '#a33a2c');
    poly(tw, 8, R * 1.04, R * 1.04, 0.006, 0, y + h - 0.006, 0, C.jade, ringPaint('#d9b44a', 32), 1, 4);
    y = proof(tw, 0, y + h, 0, { n: 8, R0, R1: R0 * k1, h: i === 3 ? 0.06 : 0.022, lift: 0.55, tile: yellow, rib: '#c99a2a', under: '#2f6d6a' }) - (i === 3 ? 0.004 : 0.002);
    if (i < 3) poly(tw, 8, tiers[i + 1][0] * 1.12, tiers[i + 1][0] * 1.12, 0.006, 0, y, 0, '#8a2a1f');
    if (i < 3) y += 0.006;
  });
  gourd(tw, 0, y, 0, 0.014, C.gold);
  // Hall of Dispelling Clouds below, Long Corridor and its gate along the shore
  const zh = -0.06, yh = Y(0, zh) + 0.006;
  box(gp, '#c4bba8', 0, 0.04, zh, 0.21, yh - 0.04, 0.07);
  hall(gp, 0, yh, zh, 0.16, 0.045, 0.034, yellow, 0, ver, { col: ver, band: C.jade, rh: 0.03, lift: 0.4 });
  for (const sx of [-1, 1]) hall(gp, sx * 0.13, Y(sx * 0.13, -0.1) + 0.004, -0.1, 0.06, 0.04, 0.03, yellow, 0, ver, { col: ver, band: C.jade, rh: 0.025 });
  hall(gp, 0, 0.046, -0.015, 0.07, 0.03, 0.03, yellow, 0, ver, { col: ver, band: C.jade, rh: 0.024, lift: 0.45 });
  for (const [x0, x1] of [[-0.42, -0.05], [0.05, 0.42]] as const) {
    const w = x1 - x0, xm = (x0 + x1) / 2, n = Math.round(w / 0.025);
    box(gp, '#d9d3c4', xm, 0.034, -0.022, w, 0.012, 0.04);
    for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) cyl(gp, ver, x0 + (i / n) * w, 0.046, -0.022 + sz * 0.012, 0.0025, 0.022, 5);
    for (const sz of [-1, 1]) box(gp, '#2f7d5d', xm, 0.05, -0.022 + sz * 0.012, w, 0.003, 0.002);
    box(gp, '#2f6d63', xm, 0.064, -0.022, w, 0.005, 0.028);
    groof(gp, xm, 0.068, -0.022, w, 0.028, 0.012, '#4f5a58', 0, 0.006);
  }
  // Seventeen-Arch Bridge to Nanhu Island
  const bg = grp(gp, 0.26, 0.16, Math.PI / 4, 0.03);
  const top = archBridge(bg, 0.4, 0.05, 0.03, 17, '#eeebe3');
  for (let i = 0; i <= 20; i++) {
    const x = -0.2 + (i / 20) * 0.4;
    for (const sz of [-1, 1]) box(bg, '#f6f4ee', x, top(x), sz * 0.0135, 0.004, 0.01, 0.004);
  }
  for (const sz of [-1, 1]) for (let i = 0; i < 10; i++) {
    const xa = -0.2 + (i / 10) * 0.4, xb = xa + 0.04;
    rod(bg, [xa, top(xa) + 0.007, sz * 0.0135], [xb, top(xb) + 0.007, sz * 0.0135], 0.0018, '#f6f4ee', 4);
  }
  hall(gp, 0.09, Y(0.09, 0.33), 0.34, 0.06, 0.035, 0.025, '#3f6f5a', 0, ver, { col: ver, band: C.jade, rh: 0.022 });
  leafy(gp, 0.05, Y(0.05, 0.31) - 0.004, 0.31, 0.05, '#3c6a2e', 1);
  // Marble Boat and a rowing boat
  const mb = grp(gp, -0.28, 0.08, 0.15, 0.03);
  rbox(mb, '#e8e4da', 0, 0, 0, 0.15, 0.022, 0.045, 0.006);
  box(mb, '#efe9dc', 0, 0.022, 0, 0.11, 0.025, 0.034);
  groof(mb, 0, 0.047, 0, 0.11, 0.034, 0.008, '#4a4d52', 0, 0.006);
  box(mb, '#efe9dc', 0.01, 0.055, 0, 0.07, 0.02, 0.028);
  groof(mb, 0.01, 0.075, 0, 0.07, 0.028, 0.009, '#4a4d52', 0, 0.006);
  for (let i = 0; i < 5; i++) box(mb, '#4a6a7a', -0.04 + i * 0.02, 0.03, 0.0175, 0.01, 0.012, 0.001);
  const bt = anim(gp, 'bob', -0.08, 0.034, 0.26);
  rbox(bt, '#7a4a2c', 0, 0, 0, 0.06, 0.01, 0.022, 0.004);
  human(bt, 0, 0.004, 0, { h: 0.045, pose: 'row', ry: Math.PI / 2, top: '#d9c7a1', bottom: '#4a3e2c', hair: '#1c1714', hat: '#c8a96a', hatStyle: 'conical', detail: 'lo' });
  // pines and cypresses on Longevity Hill
  for (let k = 0; k < 22; k++) {
    const x = -0.4 + hash3(k, 1, 3) * 0.8, z = -0.07 - hash3(k, 2, 3) * 0.33;
    if (Math.abs(x) < 0.17 && z > -0.28) continue;
    if (Math.hypot(x, z) > 0.42) continue;
    if (k % 3) blob(gp, k % 2 ? '#2f5a32' : '#3a6a3a', x, Y(x, z) + 0.02, z, 0.035, 0.03, 0.035, k);
    else minipine(gp, x, Y(x, z), z, 0.08, '#2f5a32');
  }
  for (const [x, z] of [[-0.38, 0.02], [-0.2, 0.01], [0.2, 0.01], [0.4, 0.06]] as const) willow(gp, x, 0.046, z, 0.07, x * 9);
};

// ---------------------------------------------------------------------------------------------------------
// 四合院 — a northern courtyard house; style 'pingyao' turns the street range into the Rishengchang bank (日升昌票号)

const lf_siheyuan: Builder = (gp, r) => {
  const pingyao = str(r.style, 'beijing') === 'pingyao';
  rbox(gp, '#6f6a60', 0, 0, 0, 0.9, 0.03, 0.9, 0.006);
  pbox(gp, '#9a968e', 0, 0.03, 0, 0.88, 0.004, 0.88, (x, _y, z, _nx, ny) => (ny < 0.5 ? null : hash3(Math.floor(x / 0.03), 2, Math.floor(z / 0.015)) > 0.5 ? '#a19d94' : null), 0.015);
  const brick = '#8e8d88', tile = '#4a4c50', red = '#9b2d24', front = '#7a2a1f', y0 = Y0;
  const bp: Paint = (_x, yy, _z, _nx, ny) => (Math.abs(ny) > 0.5 ? null : shade(brick, 0.93 + hash3(Math.floor(yy / 0.006), Math.floor(_x / 0.012 + _z / 0.012), 1) * 0.12));
  // courtyard paving with cross walks
  pbox(gp, '#b3afa6', 0, y0, -0.03, 0.42, 0.003, 0.36, (x, _y, z, _nx, ny) => (ny < 0.5 ? null : Math.abs(x) < 0.025 || Math.abs(z + 0.03) < 0.02 ? '#cdc8bd' : (Math.floor(x / 0.02) + Math.floor(z / 0.02)) % 2 ? '#a9a59c' : null), 0.01);
  // outer brick walls
  for (const sx of [-1, 1]) pbox(gp, brick, sx * 0.36, y0, -0.05, 0.02, 0.075, 0.66, bp, 0.01);
  pbox(gp, brick, 0, y0, -0.38, 0.74, 0.075, 0.02, bp, 0.01);
  // north main hall (正房) on a platform, flanked by side rooms (耳房)
  box(gp, '#a5a097', 0, y0, -0.29, 0.44, 0.02, 0.17);
  for (let i = 0; i < 3; i++) box(gp, '#a5a097', 0, y0, -0.2 + i * 0.012, 0.08, 0.02 - i * 0.007, 0.012);
  house(gp, 0, y0 + 0.02, -0.29, 0.4, 0.14, 0.1, 0, { wall: brick, roof: tile, front: red, bar: '#2f5a4a', rh: 0.06, col: front });
  for (const sx of [-1, 1]) house(gp, sx * 0.29, y0, -0.3, 0.14, 0.12, 0.08, 0, { wall: brick, roof: tile, front: '#8a3a2a', bar: '#2f3a3a', rh: 0.045 });
  for (const sx of [-1, 1]) lantern(gp, sx * 0.07, y0 + 0.11, -0.205, 0.014);
  // east and west wings (厢房)
  for (const sx of [-1, 1]) house(gp, sx * 0.27, y0, -0.07, 0.24, 0.13, 0.085, -sx * Math.PI / 2, { wall: brick, roof: tile, front: red, bar: '#2f5a4a', rh: 0.05, col: front });
  // south range (倒座房) facing the courtyard, its blank back to the street
  house(gp, -0.06, y0, 0.22, 0.52, 0.11, 0.08, Math.PI, { wall: brick, roof: tile, front: '#8a3a2a', bar: '#2f3a3a', rh: 0.042 });
  // the gate in the south-east corner, with stone drums and lanterns
  const gx = 0.29, gz = 0.22;
  box(gp, '#a5a097', gx, y0, gz, 0.12, 0.012, 0.13);
  pbox(gp, brick, gx, y0 + 0.012, gz - 0.01, 0.12, 0.085, 0.09, bp, 0.01);
  box(gp, '#3a2a20', gx, y0 + 0.012, gz + 0.035, 0.06, 0.08, 0.004);
  for (const sx of [-1, 1]) box(gp, red, gx + sx * 0.0135, y0 + 0.012, gz + 0.038, 0.026, 0.065, 0.003);
  for (const sx of [-1, 1]) ellip(gp, '#7c7a74', gx + sx * 0.035, y0 + 0.024, gz + 0.05, 0.009, 0.012, 0.009);
  gable(gp, 0.12, 0.05, 0.13, brick, gx, y0 + 0.097, gz);
  groof(gp, gx, y0 + 0.097, gz, 0.12, 0.13, 0.05, tile, 0, 0.014);
  for (const sx of [-1, 1]) lantern(gp, gx + sx * 0.04, y0 + 0.085, gz + 0.072, 0.013);
  // screen wall (影壁) facing the gate inside
  pbox(gp, brick, gx, y0, 0.1, 0.11, 0.09, 0.018, bp, 0.01);
  box(gp, '#c9c4b8', gx, y0 + 0.025, 0.1, 0.07, 0.05, 0.022);
  ellip(gp, '#8a8680', gx, y0 + 0.05, 0.112, 0.012, 0.012, 0.002);
  groof(gp, gx, y0 + 0.09, 0.1, 0.11, 0.022, 0.012, tile, 0, 0.008);
  // courtyard life: scholar tree, pomegranate tubs, fish jar, family
  leafy(gp, -0.12, y0, 0.06, 0.17, '#4f7f36', 3);
  for (const sx of [-1, 1]) {
    lathe(gp, [[0, 0], [0.016, 0], [0.02, 0.022], [0, 0.022]], '#6a4a30', sx * 0.08, y0, -0.17, 10);
    blob(gp, '#3f7a34', sx * 0.08, y0 + 0.04, -0.17, 0.02);
    for (let i = 0; i < 3; i++) ellip(gp, '#d9402a', sx * 0.08 + Math.cos(i * 2) * 0.016, y0 + 0.04 + (i - 1) * 0.008, -0.17 + Math.sin(i * 2) * 0.016, 0.004);
  }
  lathe(gp, [[0, 0], [0.018, 0], [0.026, 0.02], [0.024, 0.03], [0, 0.03]], '#5a4a3a', 0.12, y0, -0.02, 14);
  cyl(gp, '#3f6f7a', 0.12, y0 + 0.028, -0.02, 0.022, 0.002, 14);
  human(gp, 0.05, y0, -0.1, { h: 0.065, pose: 'stand', top: '#3a3f4a', bottom: '#2a2a2a', hair: '#bbbbbb', hat: '#1f1d1b', hatStyle: 'cap', dress: 'ankle', detail: 'hi' });
  human(gp, -0.02, y0, 0.0, { h: 0.045, pose: 'run', phase: 0.3, top: '#c0302a', bottom: '#2a2a5a', hair: '#1c1714', detail: 'lo' });
  human(gp, -0.2, y0, -0.12, { h: 0.06, pose: 'walk', ry: Math.PI / 2, top: '#6a7a9a', bottom: '#2a2a2a', hair: '#1c1714', dress: 'ankle', detail: 'lo' });
  if (pingyao) {
    // shop-front opening onto the street, black-and-gold signboard, red banner
    pbox(gp, '#4a3020', -0.06, y0, 0.278, 0.42, 0.075, 0.006, lattice('#2a1a10', 3, 5), 0.006);
    for (let i = 0; i < 6; i++) cyl(gp, '#3a2216', -0.27 + i * 0.084, y0, 0.284, 0.004, 0.08, 6);
    box(gp, '#1a1816', -0.06, y0 + 0.086, 0.285, 0.18, 0.03, 0.006);
    for (let i = 0; i < 3; i++) box(gp, C.gold, -0.11 + i * 0.05, y0 + 0.091, 0.289, 0.022, 0.02, 0.002);
    for (let i = 0; i < 4; i++) lantern(gp, -0.22 + i * 0.106, y0 + 0.074, 0.3, 0.012);
    box(gp, '#5a3a28', -0.06, y0, 0.32, 0.18, 0.03, 0.03);
    const px = -0.33, pz = 0.36;
    cyl(gp, '#3a2a20', px, y0, pz, 0.005, 0.34, 6);
    const fl = anim(gp, 'flap', px, y0 + 0.17, pz, { amp: 0.18 });
    box(fl, '#c8281e', 0.034, 0, 0, 0.06, 0.16, 0.003);
    box(fl, '#e8c040', 0.034, 0.158, 0, 0.064, 0.008, 0.004);
    for (let i = 0; i < 2; i++) box(fl, '#f2e2a0', 0.034, 0.05 + i * 0.05, 0.002, 0.03, 0.03, 0.001);
    human(gp, 0.05, y0, 0.36, { h: 0.065, pose: 'point', ry: Math.PI * 0.9, top: '#2f3a4a', bottom: '#2a2a2a', hair: '#1c1714', hat: '#1f1d1b', hatStyle: 'qing', dress: 'ankle', detail: 'lo' });
    human(gp, -0.16, y0, 0.37, { h: 0.065, pose: 'carry', ry: Math.PI / 2, top: '#6a5a4a', bottom: '#3a3128', hair: '#1c1714', detail: 'lo' });
  } else {
    for (let i = 0; i < 5; i++) box(gp, '#3a3a3a', -0.26 + i * 0.1, y0 + 0.07, 0.276, 0.022, 0.012, 0.004);
    leafy(gp, -0.3, y0, 0.37, 0.12, '#4f7f36', 5);
    human(gp, 0.18, y0, 0.36, { h: 0.065, pose: 'walk', ry: -Math.PI / 2, top: '#3a5a7a', bottom: '#2a2a2a', hair: '#1c1714', detail: 'lo' });
  }
};

// ---------------------------------------------------------------------------------------------------------
// 中山陵 — Sun Yat-sen Mausoleum on Purple Mountain, Nanjing (1929)

const lf_zhongshanling: Builder = gp => {
  ground(gp, 0.47, '#4f7a36', C.earth);
  const blue = '#2c5d9e', granite = '#eeece6';
  // stair profile: flights and landings from the archway up to the sacrificial hall
  const segs: [number, number, boolean][] = [[0.3, 0.22, true], [0.22, 0.16, false], [0.16, 0.07, true], [0.07, 0.04, false], [0.04, -0.06, true], [-0.06, -0.09, false], [-0.09, -0.13, true]];
  const rise = 0.27, flightLen = segs.reduce((s, [a, b, f]) => s + (f ? a - b : 0), 0);
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
    const base = z > 0.3 ? 0 : z > -0.13 ? sy(z) : rise + Math.max(0, -0.3 - z) * 0.9;
    const k = sstep(0.075, 0.16, Math.abs(x));
    return base - 0.004 + k * (0.015 + Math.max(0, 0.3 - z) * 0.08 + (fbm(x * 9, 4, z * 9) - 0.5) * 0.04) * (z < 0.36 ? 1 : 0.3);
  };
  const Y = land(gp, 0.448, hf, (x, _y, z, _nx, ny) => (Math.abs(x) < 0.07 && z < 0.3 && z > -0.3 ? '#d9d6cc' : ny < 0.7 ? '#5d6a44' : mix('#5a8a3e', '#3f6f30', fbm(x * 11, 2, z * 11))));
  // flights of white granite steps with side walls, broad landings
  for (const [a, b, f] of segs) {
    if (f) {
      const n = Math.round((a - b) / 0.012);
      for (let i = 0; i < n; i++) {
        const z = a - (i + 0.5) * ((a - b) / n), yt = Y0 + sy(a - (i + 1) * ((a - b) / n));
        box(gp, i % 2 ? granite : '#e4e1d8', 0, Y0 + sy(a) - 0.01, z, 0.13, yt - (Y0 + sy(a)) + 0.01, (a - b) / n + 0.001);
      }
    } else box(gp, '#e8e5dc', 0, Y0 + sy(a) - 0.01, (a + b) / 2, 0.15, 0.01, a - b);
    for (const sx of [-1, 1]) {
      const ya = Y0 + sy(a), yb = Y0 + sy(b);
      strut(gp, [sx * 0.07, ya + 0.004, a], [sx * 0.07, yb + 0.004, b], 0.006, 0.006, '#d9d6cc', 4);
    }
  }
  // the gate (陵门) on the first landing
  const yg = Y0 + sy(0.2);
  box(gp, granite, 0, yg, 0.19, 0.17, 0.05, 0.045);
  for (const x of [-0.05, 0, 0.05]) { box(gp, '#2a2a2e', x, yg, 0.2125, 0.022, 0.03, 0.002); ellip(gp, '#2a2a2e', x, yg + 0.03, 0.2125, 0.011, 0.01, 0.001); }
  hall(gp, 0, yg + 0.05, 0.19, 0.17, 0.045, 0.004, blue, 0, granite, { col: granite, band: granite, rh: 0.035, lift: 0.35 });
  // sacrificial hall: white granite with corner bastions and a double-eaved blue roof
  const zh = -0.21, yh = Y0 + rise;
  box(gp, '#e4e1d8', 0, yh - 0.01, zh, 0.3, 0.012, 0.18);
  box(gp, granite, 0, yh, zh, 0.2, 0.075, 0.1);
  for (const sx of [-1, 1]) box(gp, '#f4f2ec', sx * 0.09, yh, zh + 0.005, 0.03, 0.072, 0.105);
  for (const x of [-0.045, 0, 0.045]) { box(gp, '#2a2a2e', x, yh, zh + 0.051, 0.022, 0.035, 0.002); ellip(gp, '#2a2a2e', x, yh + 0.035, zh + 0.051, 0.011, 0.01, 0.001); }
  box(gp, '#2a2a2e', 0, yh + 0.055, zh + 0.051, 0.06, 0.012, 0.002);
  box(gp, C.gold, 0, yh + 0.058, zh + 0.052, 0.04, 0.006, 0.001);
  const ov = 1.4, R0 = ((0.1 / 2) * ov) / Math.SQRT1_2;
  const y2 = proof(gp, 0, yh + 0.075, zh, { n: 4, R0, R1: R0 * 0.7, h: 0.016, lift: 0.3, tile: blue, rib: '#3a6fb5', under: '#d9d6cc', sx: (0.2 + 0.1 * (ov - 1)) / (0.1 * ov) });
  hall(gp, 0, y2, zh, 0.16, 0.07, 0.02, blue, 0, granite, { col: granite, band: '#d9d6cc', rh: 0.045, lift: 0.35 });
  // the domed tomb chamber behind
  const yt = Y(0, -0.34);
  cyl(gp, granite, 0, yt - 0.01, -0.34, 0.05, 0.05, 20);
  lathe(gp, [[0, 0], [0.054, 0], [0.05, 0.015], [0.035, 0.03], [0, 0.038]], '#3a6aa8', 0, yt + 0.04, -0.34, 20);
  // memorial archway (博爱坊) with three blue roofs
  const za = 0.37;
  for (const x of [-0.08, -0.03, 0.03, 0.08]) { cyl(gp, granite, x, Y0, za, 0.006, 0.075, 8); box(gp, '#d9d6cc', x, Y0, za, 0.016, 0.01, 0.016); }
  box(gp, granite, 0, Y0 + 0.06, za, 0.17, 0.008, 0.008);
  for (const [x, w, yy] of [[0, 0.06, 0.068], [-0.055, 0.05, 0.06], [0.055, 0.05, 0.06]] as const) {
    box(gp, granite, x, Y0 + yy, za, w, 0.012, 0.01);
    proof(gp, x, Y0 + yy + 0.012, za, { n: 4, R0: 0.02, R1: 0.004, h: 0.014, lift: 0.4, tile: blue, sx: (w + 0.01) / 0.028 });
  }
  // pine and cypress groves on both sides
  for (let k = 0; k < 26; k++) {
    const sx = k % 2 ? 1 : -1, x = sx * (0.12 + hash3(k, 1, 2) * 0.24), z = 0.36 - hash3(k, 3, 2) * 0.72;
    if (Math.hypot(x, z) > 0.42 || (z < -0.12 && Math.abs(x) < 0.17)) continue;
    minipine(gp, x, Y(x, z), z, 0.07 + hash3(k, 5, 1) * 0.04, k % 3 ? '#2f5a32' : '#3a6a3a');
  }
  for (let i = 0; i < 4; i++) {
    const z = 0.27 - i * 0.1;
    human(gp, (i % 2 ? 1 : -1) * 0.03, Y0 + sy(z), z, { h: 0.04, pose: 'walk', ry: Math.PI, top: ['#2f3a4a', '#d9d6cc', '#5a3a2a', '#3a5a7a'][i], bottom: '#2a2a2a', hair: '#1c1714', detail: 'min' });
  }
};

// ---------------------------------------------------------------------------------------------------------
// 北大红楼 — the Red Building of Peking University (1918), cradle of the May Fourth Movement

const lf_honglou: Builder = gp => {
  ground(gp, 0.47, '#a9a59b', '#6f6a60');
  pbox(gp, '#9c988e', 0, 0.03, 0.2, 0.62, 0.003, 0.3, (x, _y, _z, _nx, ny) => (ny > 0.5 && Math.floor(x / 0.03) % 2 ? '#a39f95' : null), 0.03);
  const red = '#a8432f', zc = -0.06, D = 0.16, W = 0.76, sh = 0.06, n = 4, yb = Y0 + 0.02, Ht = n * sh + 0.012;
  const bp: Paint = (x, yy, z, _nx, ny) => (Math.abs(ny) > 0.5 ? null : shade(red, 0.9 + hash3(Math.floor(yy / 0.005), Math.floor((x + z) / 0.012), 4) * 0.18));
  box(gp, '#8a8680', 0, Y0, zc, W + 0.02, 0.02, D + 0.02);
  pbox(gp, red, 0, yb, zc, W, Ht, D, bp, 0.01);
  // projecting end bays and central entrance bay
  for (const sx of [-1, 1]) pbox(gp, red, sx * (W / 2 - 0.04), yb, zc, 0.08, Ht + 0.006, D + 0.02, bp, 0.01);
  pbox(gp, red, 0, yb, zc + 0.012, 0.11, Ht, D, bp, 0.01);
  for (let s = 1; s <= n; s++) box(gp, '#e8e2d4', 0, yb + s * sh - 0.002, zc, W + 0.004, 0.004, D + 0.024);
  box(gp, '#e8e2d4', 0, yb + Ht - 0.004, zc, W + 0.012, 0.008, D + 0.03);
  // rows of white-framed windows
  for (let s = 0; s < n; s++) for (let i = 0; i < 17; i++) {
    const x = -0.36 + i * 0.045, wy = yb + s * sh + 0.014;
    if (s === 0 && i === 8) continue;
    const zf = zc + D / 2 + (Math.abs(x) > W / 2 - 0.085 ? 0.01 : Math.abs(x) < 0.06 ? 0.012 : 0);
    box(gp, '#f2eee4', x, wy, zf + 0.001, 0.026, 0.036, 0.004);
    box(gp, '#2b3440', x, wy + 0.004, zf + 0.0025, 0.018, 0.028, 0.002);
    box(gp, '#f2eee4', x, wy + 0.016, zf + 0.004, 0.018, 0.002, 0.001);
    box(gp, '#3a4450', x, wy + 0.004, zc - D / 2 - (Math.abs(x) > W / 2 - 0.085 ? 0.01 : 0) - 0.001, 0.02, 0.028, 0.003);
  }
  for (let s = 0; s < n; s++) for (const sx of [-1, 1]) for (const dz of [-0.04, 0.04]) box(gp, '#2b3440', sx * (W / 2 + 0.001), yb + s * sh + 0.018, zc + dz, 0.004, 0.028, 0.018);
  // arched central entrance with steps
  const zf = zc + D / 2 + 0.012;
  box(gp, '#e8e2d4', 0, yb, zf + 0.002, 0.05, 0.05, 0.004);
  box(gp, '#2a1d16', 0, yb, zf + 0.004, 0.034, 0.034, 0.002);
  ellip(gp, '#2a1d16', 0, yb + 0.034, zf + 0.004, 0.017, 0.012, 0.001);
  for (let i = 0; i < 3; i++) box(gp, '#a8a49a', 0, Y0, zf + 0.012 + i * 0.01, 0.07, 0.02 - i * 0.0065, 0.012);
  // pitched grey hip roof with dormers and chimneys
  const ry0 = yb + Ht + 0.004;
  tbox(gp, W + 0.02, D + 0.03, W - D + 0.02, 0.004, 0.07, '#5a5d61', 0, ry0, zc);
  for (const sx of [-1, 1]) tbox(gp, 0.1, D + 0.05, 0.02, 0.004, 0.075, '#55585c', sx * (W / 2 - 0.04), ry0, zc);
  for (const x of [-0.2, 0, 0.2]) {
    box(gp, red, x, ry0 + 0.01, zc + 0.05, 0.03, 0.025, 0.03);
    gable(gp, 0.04, 0.014, 0.036, '#4a4d52', x, ry0 + 0.035, zc + 0.05, Math.PI / 2);
    box(gp, '#f2eee4', x, ry0 + 0.013, zc + 0.066, 0.016, 0.016, 0.002);
  }
  for (const sx of [-1, 1]) box(gp, red, sx * 0.29, ry0 + 0.02, zc - 0.02, 0.02, 0.06, 0.02);
  // students in long gowns and a poster board for the May Fourth Movement
  box(gp, '#5a3a28', 0.16, Y0, 0.12, 0.004, 0.07, 0.004);
  box(gp, '#5a3a28', 0.24, Y0, 0.12, 0.004, 0.07, 0.004);
  box(gp, '#7a5a3a', 0.2, Y0 + 0.035, 0.12, 0.09, 0.04, 0.004);
  for (let i = 0; i < 3; i++) {
    box(gp, '#f2eee4', 0.17 + i * 0.03, Y0 + 0.039, 0.1225, 0.024, 0.032, 0.001);
    for (let j = 0; j < 3; j++) box(gp, j ? '#1a1a1a' : '#c0302a', 0.17 + i * 0.03, Y0 + 0.062 - j * 0.009, 0.1235, 0.016, 0.004, 0.001);
  }
  const gowns = ['#2f3a5a', '#4a4f57', '#3a4a6a', '#5a6470', '#2a2a2a'];
  const spots: [number, number, number, 'stand' | 'walk' | 'point' | 'wave' | 'reach'][] = [[0.18, 0.2, Math.PI, 'stand'], [0.24, 0.19, Math.PI * 1.1, 'point'], [-0.12, 0.2, 0.3, 'walk'], [-0.05, 0.15, Math.PI, 'wave'], [0.2, 0.135, Math.PI, 'reach']];
  spots.forEach(([x, z, ry, pose], i) => human(gp, x, Y0, z, { h: 0.07, pose, ry, phase: i / 5, top: gowns[i], bottom: '#1f1f1f', hair: '#1c1714', dress: 'ankle', detail: i < 2 ? 'hi' : 'lo' }));
  for (const sx of [-1, 1]) leafy(gp, sx * 0.36, Y0, 0.2, 0.16, '#4f7f36', sx * 3);
  leafy(gp, -0.3, Y0, 0.34, 0.1, '#5a8a3a', 7);
};

// ---------------------------------------------------------------------------------------------------------
// Classical garden — 拙政园 (Suzhou, default) or 金谷园 (Shi Chong's Jin-dynasty villa garden, r.style 'jingu')

function taihu(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number): void {
  const n = 4 + Math.floor(hash3(seed, 1, 1) * 3);
  let yy = y;
  for (let i = 0; i < n; i++) {
    const w = s * (0.35 + hash3(seed, i, 2) * 0.3) * (i === n - 1 ? 0.8 : 1), hh = s * (0.25 + hash3(seed, i, 3) * 0.2);
    const ox = (hash3(seed, i, 4) - 0.5) * s * 0.4, oz = (hash3(seed, i, 5) - 0.5) * s * 0.3;
    blob(p, mix('#9a9a94', '#7d7f7c', hash3(seed, i, 6)), x + ox, yy + hh * 0.5, z + oz, w * 0.5, hh * 0.6, w * 0.4, hash3(seed, i, 7) * 3);
    if (i % 2) ellip(p, '#3d3f3e', x + ox + w * 0.12, yy + hh * 0.5, z + oz + w * 0.38, w * 0.1, hh * 0.18, w * 0.04);
    yy += hh * 0.8;
  }
}

const lf_pavilion: Builder = (gp, r) => {
  const jingu = str(r.style, 'zhuozheng') === 'jingu';
  ground(gp, 0.47, jingu ? '#7a9a52' : '#6f8f4e', C.earth);
  // irregular pond with a rough stone rim, lotus pads and blossoms
  const plan: [number, number][] = jingu
    ? [[-0.28, 0.14], [-0.2, 0.3], [0.02, 0.33], [0.22, 0.28], [0.32, 0.12], [0.26, -0.02], [0.08, -0.05], [-0.12, -0.02], [-0.26, 0.02]]
    : [[-0.26, 0.12], [-0.2, 0.27], [0, 0.29], [0.2, 0.24], [0.3, 0.06], [0.26, -0.12], [0.08, -0.19], [-0.1, -0.15], [-0.25, -0.04]];
  prism(gp, plan, Y0 - 0.003, 0.0035, '#3f7f7a', 0, true);
  const curve = new THREE.CatmullRomCurve3(plan.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  curve.getSpacedPoints(46).slice(0, -1).forEach((v, i) => blob(gp, mix('#a8a59c', '#8c8a84', hash3(i, 9, 1)), v.x, Y0 + 0.002, v.z, 0.014 + hash3(i, 2, 1) * 0.008, 0.008, 0.011, i));
  for (let i = 0; i < 26; i++) {
    const x = -0.2 + hash3(i, 4, 4) * 0.22, z = (jingu ? 0.06 : -0.08) + hash3(i, 5, 5) * 0.22;
    cyl(gp, i % 3 ? '#4f8a3a' : '#5e9a42', x, Y0 + 0.001 + (i % 4) * 0.0003, z, 0.01 + hash3(i, 6, 6) * 0.006, 0.0015, 10);
    if (i % 5 === 0) { rod(gp, [x, Y0, z], [x, Y0 + 0.02, z], 0.0012, '#4f7a30', 3); cone(gp, '#f0a0b4', x, Y0 + 0.018, z, 0.006, 0.01, 6); }
  }
  // zigzag stone bridge (九曲桥) with low posts and rails
  const zz: [number, number][] = jingu ? [[-0.05, 0.38], [0.0, 0.27], [0.1, 0.24], [0.06, 0.13], [0.0, 0.02]] : [[-0.07, 0.36], [-0.03, 0.25], [0.07, 0.21], [0.03, 0.11], [0.11, 0.03]];
  const yb = Y0 + 0.01;
  for (let i = 0; i < zz.length - 1; i++) {
    const [ax, az] = zz[i], [bx, bz] = zz[i + 1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    box(gp, '#c9c4b8', (ax + bx) / 2, yb - 0.004, (az + bz) / 2, 0.034, 0.004, len + 0.034, ry);
    for (const t of [0.33, 0.66]) cyl(gp, '#a39f95', ax + (bx - ax) * t, Y0 - 0.002, az + (bz - az) * t, 0.004, yb - Y0 - 0.002, 6);
    for (const sd of [-1, 1]) {
      const ox = Math.cos(ry) * 0.016 * sd, oz = -Math.sin(ry) * 0.016 * sd;
      rod(gp, [ax + ox, yb + 0.012, az + oz], [bx + ox, yb + 0.012, bz + oz], 0.0018, '#d9d6cc', 3);
    }
  }
  for (const [x, z] of zz) for (const sd of [-1, 1]) cyl(gp, '#d9d6cc', x + sd * 0.016, yb, z, 0.0025, 0.014, 5);
  // white wall with grey tile coping; moon gate in the Suzhou garden
  const zw = -0.31, wh = 0.11, ww = 0.66;
  panel(gp, ww, wh, 0.018, '#efede6', jingu ? [] : [new THREE.Path().absarc(-0.12, 0.056, 0.045, 0, TAU, true)], 0, Y0 - 0.002, zw);
  groof(gp, 0, Y0 + wh - 0.002, zw, ww + 0.01, 0.03, 0.014, C.tile);
  box(gp, '#8a8a86', 0, Y0 - 0.002, zw, ww + 0.004, 0.008, 0.022);
  if (!jingu) {
    const ring = new THREE.Shape().absarc(0, 0, 0.05, 0, TAU, false);
    ring.holes.push(new THREE.Path().absarc(0, 0, 0.045, 0, TAU, true));
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.022, bevelEnabled: false, curveSegments: 24 });
    rg.translate(0, 0, -0.011);
    add(gp, rg, mat('#7d7f7c'), -0.12, Y0 + 0.054, zw, 1, 1, 1);
    for (const [x, s] of [[0.15, 0.03], [0.25, 0.03]] as const) {
      box(gp, '#3d3f3e', x, Y0 + 0.05, zw + 0.0095, s, s * 0.8, 0.002);
      for (let k = 0; k < 3; k++) box(gp, '#efede6', x, Y0 + 0.05 + k * s * 0.27, zw + 0.0105, s, 0.002, 0.002);
    }
    taihu(gp, -0.3, Y0, 0.04, 0.09, 3);
    taihu(gp, -0.24, Y0, -0.16, 0.12, 5);
    taihu(gp, -0.33, Y0, -0.08, 0.07, 8);
    taihu(gp, 0.3, Y0, -0.2, 0.08, 11);
    // hexagonal pavilion on a stone base out in the water
    poly(gp, 6, 0.072, 0.072, 0.012, 0.15, Y0 - 0.002, -0.06, '#b7b2a6');
    const pt = pavilion(gp, 0.15, Y0 + 0.01, -0.06, 0.048, 0.07, '#4f5357');
    box(gp, '#2a1d16', 0.15, pt - 0.07, -0.06 + 0.075, 0.03, 0.01, 0.002);
    human(gp, 0.15, Y0 + 0.024, -0.05, { h: 0.055, pose: 'stand', ry: Math.PI * 0.9, top: '#5a6a7a', bottom: '#3a3a3a', hair: '#1c1714', hatStyle: 'knot', dress: 'ankle', detail: 'lo' });
    human(gp, -0.04, yb, 0.235, { h: 0.055, pose: 'point', ry: 2.2, top: '#c8a0a0', bottom: '#6a4a5a', hair: '#1c1714', dress: 'ankle', detail: 'lo' });
    for (let k = 0; k < 4; k++) bamboo(gp, -0.1 + (k - 1.5) * 0.06, Y0, -0.37 - (k % 2) * 0.02, 0.17, 5, k);
    bamboo(gp, 0.33, Y0, -0.1, 0.13, 6, 9);
  } else {
    // terrace and a timber hall where musicians play for guests
    box(gp, '#b7b2a6', 0, Y0 - 0.002, -0.17, 0.4, 0.028, 0.2);
    for (let i = 0; i < 3; i++) box(gp, '#a39f95', 0, Y0 - 0.002, -0.06 + i * 0.008, 0.12, 0.026 - i * 0.009, 0.01);
    for (const sx of [-1, 1]) rod(gp, [sx * 0.2, Y0 + 0.036, -0.07], [sx * 0.07, Y0 + 0.036, -0.07], 0.002, '#a33a2a', 3);
    const yt = Y0 + 0.026;
    hall(gp, 0, yt, -0.22, 0.28, 0.1, 0.075, '#4f5357', 0, '#a33a2a', { rh: 0.06, lift: 0.4 });
    const mus: [number, number, string][] = [[-0.14, -0.1, '#7a3a5a'], [-0.08, -0.12, '#3a5a7a'], [0.09, -0.12, '#6a5a2a'], [0.15, -0.1, '#3a6a5a']];
    mus.forEach(([x, z, c], i) => {
      human(gp, x, yt, z, { h: 0.055, pose: 'sitGround', ry: Math.PI * (i < 2 ? 0.15 : -0.15), top: c, bottom: shade(c, 0.7), hair: '#1c1714', hatStyle: i % 2 ? 'knot' : undefined, dress: 'ankle', detail: 'lo' });
      if (i === 0) box(gp, '#3a2418', x + 0.004, yt + 0.008, z + 0.024, 0.05, 0.005, 0.014, 0.4);
      if (i === 1) ellip(gp, '#9a6a3a', x + 0.01, yt + 0.024, z + 0.016, 0.009, 0.014, 0.004);
      if (i === 2) rod(gp, [x - 0.01, yt + 0.032, z + 0.015], [x + 0.02, yt + 0.03, z + 0.015], 0.0015, '#c9a24a', 3);
      if (i === 3) for (let k = 0; k < 3; k++) cyl(gp, '#8a6a2a', x - 0.012 + k * 0.012, yt, z + 0.022, 0.004, 0.012, 8);
    });
    human(gp, 0, yt, -0.1, { h: 0.065, pose: 'cheer', ry: 0, top: '#d84a5a', bottom: '#f0d0d8', hair: '#1c1714', dress: 'ankle', detail: 'hi' });
    human(gp, 0.06, yb, 0.25, { h: 0.06, pose: 'stand', ry: Math.PI, top: '#5a3a6a', bottom: '#3a2a3a', hair: '#1c1714', hatStyle: 'knot', dress: 'ankle', detail: 'lo' });
    for (const [x, z, s] of [[-0.3, -0.05, 0.12], [0.31, -0.06, 0.12], [-0.28, -0.22, 0.1], [0.27, -0.24, 0.1]] as const) leafy(gp, x, Y0, z, s, '#e8a0b4', Math.floor(x * 50));
    taihu(gp, -0.3, Y0, 0.2, 0.08, 4);
  }
  willow(gp, 0.33, Y0, 0.18, 0.2, 2);
  willow(gp, -0.33, Y0, jingu ? 0.32 : 0.22, 0.17, 6);
  if (!jingu) leafy(gp, 0.3, Y0, -0.36, 0.09, '#5a8a3a', 4);
};

export const H_LIFE_ARCH2: Record<string, Builder> = {
  lf_huqiu, lf_tieta, lf_academy, lf_guanxing, lf_baita, lf_tulou, lf_yiheyuan, lf_siheyuan, lf_zhongshanling, lf_honglou, lf_pavilion,
};
