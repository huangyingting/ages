import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, box, cone, cyl, g, lathe, mat, prism, rbox, rod, shade, sweep, tube } from '../prims.ts';
import { figure, figureBase, type FigureAnchors } from '../figure.ts';

// Famous people B: artists, writers, poets and musicians. Each is a figurine diorama (base r≈0.46, figure ≈0.6 tall)
// with the props and a miniature scene that make them recognisable.

const WOOD = '#8b5a2b', PAPER = '#f3ead6', INK = '#1d1a17', GOLD = '#d6b25e', BRASS = '#d9a93a';

/** Low-poly smooth ellipsoid (the prims version is 616 tris; these small parts don't need it). */
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, g('pb-sph', () => new THREE.SphereGeometry(1, 12, 8)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);

/** figure.ts uses 616-tri spheres for every small part: swap small ones for lighter spheres (same look, far fewer tris). */
function lighten(root: THREE.Object3D): void {
  const hi = g('esph', () => new THREE.SphereGeometry(1, 22, 15));
  const lo = g('pb-sph', () => new THREE.SphereGeometry(1, 12, 8)), tiny = g('pb-sph6', () => new THREE.SphereGeometry(1, 8, 6));
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const r = Math.max(m.scale.x, m.scale.y, m.scale.z);
    if (m.geometry === hi && r < 0.05) m.geometry = r < 0.014 ? tiny : lo;
    else if (m.geometry === lo && r < 0.012) m.geometry = tiny;
  });
}

/** Very light ellipsoid for flat paint dabs, petals and other tiny bits. */
const dab = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, g('pb-sph6', () => new THREE.SphereGeometry(1, 8, 6)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);

const lp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const off = (a: V3, dx: number, dy: number, dz: number): V3 => [a[0] + dx, a[1] + dy, a[2] + dz];
/** offset in the figure's own frame (turned by its facing `ry`) */
const offR = (a: V3, ry: number, dx: number, dy: number, dz: number): V3 =>
  [a[0] + dx * Math.cos(ry) + dz * Math.sin(ry), a[1] + dy, a[2] - dx * Math.sin(ry) + dz * Math.cos(ry)];

function grp(p: THREE.Object3D, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Group {
  const q = new THREE.Group();
  q.position.set(x, y, z);
  q.rotation.set(rx, ry, rz);
  p.add(q);
  return q;
}

/** Group at `at` whose +z axis points along `dir` (for trumpets, violins, quills). */
function aim(p: THREE.Object3D, at: V3, dir: V3, roll = 0): THREE.Group {
  const q = new THREE.Group();
  q.position.set(...at);
  q.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize());
  if (roll) q.rotateZ(roll);
  p.add(q);
  return q;
}

/** Flat elliptical disc (pond, rug, plate). */
function disc(p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, rz: number, h = 0.008, seg = 24): THREE.Mesh {
  const m = cyl(p, c, x, y, z, rx, h, seg);
  m.scale.z *= rz / rx;
  return m;
}

function glow(m: THREE.Mesh, c: string, e: string): THREE.Mesh {
  m.material = mat(c, { emissive: e, flat: false });
  return m;
}

/** Painter's easel; returns a group at the canvas face centre (paint at z≈0.002, x∈±w/2, y∈±h/2). */
function easel(p: THREE.Object3D, x: number, y: number, z: number, ry: number, w: number, h: number, frame = '#7a5230'): THREE.Group {
  const e = grp(p, x, y, z, ry);
  const top = h * 1.55;
  for (const s of [-1, 1]) rod(e, [s * w * 0.42, 0, 0.012], [s * w * 0.1, top, -0.012], 0.0075, WOOD);
  rod(e, [0, 0, -h * 0.55], [0, top * 0.93, -0.018], 0.0065, shade(WOOD, 0.85));
  const ly = h * 0.36;
  box(e, shade(WOOD, 0.9), 0, ly, 0.012, w * 1.1, 0.014, 0.034);
  const c = grp(e, 0, ly + 0.014 + h / 2, 0.02, 0, -0.08);
  box(c, frame, 0, -h / 2 - 0.007, -0.011, w + 0.014, h + 0.014, 0.01);
  box(c, '#efe8d8', 0, -h / 2, -0.004, w, h, 0.008);
  box(c, shade(WOOD, 0.8), 0, h / 2 - 0.004, -0.012, w * 0.28, 0.02, 0.02);
  return c;
}
/** paint rectangle / blob on a canvas group */
const pr = (c: THREE.Object3D, col: string, x: number, y: number, w: number, h: number, rz = 0) => box(c, col, x, y - h / 2, 0.0012, w, h, 0.003, 0, 0, rz);
const pe = (c: THREE.Object3D, col: string, x: number, y: number, rx: number, ry: number, rz = 0, z = 0.0015) => dab(c, col, x, y, z, rx, ry, 0.0025, 0, 0, rz);

/** Open book held/lying: group with pages facing +y; text lines in grey. */
function openBook(p: THREE.Object3D, at: V3, cover: string, s = 1, rx = -0.9, ry = 0): THREE.Group {
  const b = grp(p, at[0], at[1], at[2], ry, rx);
  for (const sx of [-1, 1]) {
    box(b, cover, sx * 0.031 * s, -0.004 * s, 0, 0.064 * s, 0.004 * s, 0.084 * s, 0, 0, sx * 0.16);
    box(b, PAPER, sx * 0.029 * s, -0.0005 * s, 0, 0.057 * s, 0.005 * s, 0.076 * s, 0, 0, sx * 0.16);
    for (let i = 0; i < 5; i++) box(b, '#8d8577', sx * 0.03 * s, 0.0045 * s + sx * 0.03 * s * 0.16, (-0.026 + i * 0.013) * s, 0.04 * s, 0.0008, 0.0025 * s, 0, 0, sx * 0.16);
  }
  return b;
}

/** Closed book lying flat (spine on -x). */
function book(p: THREE.Object3D, x: number, y: number, z: number, cover: string, w = 0.07, d = 0.09, t = 0.018, ry = 0): void {
  const b = grp(p, x, y, z, ry);
  box(b, cover, 0, 0, 0, w, t, d);
  box(b, PAPER, w * 0.03, t * 0.15, 0, w * 0.96, t * 0.7, d * 0.94);
  box(b, GOLD, -w * 0.3, t * 0.98, 0, w * 0.06, 0.002, d * 0.8);
}

/** Feather quill from the hand `base` toward `tip`. */
function quill(p: THREE.Object3D, base: V3, tip: V3, c = '#f7f3ea'): void {
  rod(p, lp(base, tip, -0.12), lp(base, tip, 0.3), 0.0022, '#cfc4ad');
  sweep(p, [
    { p: lp(base, tip, 0.22), w: 0.002, h: 0.0012 }, { p: lp(base, tip, 0.45), w: 0.013, h: 0.0016 },
    { p: lp(base, tip, 0.8), w: 0.011, h: 0.0016 }, { p: tip, w: 0.0015, h: 0.001 },
  ], c, { radial: 6, sub: 3 });
}

/** Writing / painting brush held in the hand: handle from a to b with a tapered tip beyond b. */
function brush(p: THREE.Object3D, a: V3, b: V3, tip = INK, handle = '#c9a86a', r = 0.0035): void {
  rod(p, a, b, r, handle);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  tube(p, [b, off(b, d.x * 0.012, d.y * 0.012, d.z * 0.012), off(b, d.x * 0.024, d.y * 0.024, d.z * 0.024)], r * 1.5, r * 0.3, tip, { radial: 6, sub: 2 });
}

/** Artist's palette in the hand with paint dabs. */
function palette(p: THREE.Object3D, at: V3, ry = 0.4, cols = ['#d93b2b', '#f2c12e', '#2f6fd0', '#3f9b4a', '#f4f1ea']): void {
  const q = grp(p, at[0], at[1], at[2] + 0.01, ry, 0.5);
  ellip(q, '#c8955a', 0.02, 0, 0, 0.055, 0.004, 0.038);
  cols.forEach((c, i) => {
    const a = -1.2 + i * 0.55;
    ellip(q, c, 0.02 + Math.cos(a) * 0.036, 0.004, Math.sin(a) * 0.024, 0.009, 0.004, 0.008);
  });
  ellip(q, '#8c6239', -0.022, 0.003, 0.006, 0.008, 0.004, 0.008);
}

/** Scatter a ring of small rocks / pebbles around (x, z). */
function rocks(p: THREE.Object3D, x: number, y: number, z: number, rx: number, rz: number, n: number, c = '#8e8a80', s = 0.022): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const k = 0.8 + ((i * 37) % 7) / 14;
    ellip(p, shade(c, 0.88 + (i % 3) * 0.08), x + Math.cos(a) * rx, y + 0.004, z + Math.sin(a) * rz, s * k, s * 0.55 * k, s * 0.85 * k, a);
  }
}

/** Water surface with a few lighter ripple rings. */
function pond(p: THREE.Object3D, x: number, y: number, z: number, rx: number, rz: number, c = '#3f7397'): void {
  disc(p, c, x, y, z, rx, rz, 0.01, 28);
  for (let i = 0; i < 3; i++) {
    const m = add(p, g('pb-ring', () => new THREE.TorusGeometry(1, 0.06, 4, 24)), mat(shade(c, 1.35)), x + (i - 1) * rx * 0.35, y + 0.0105, z + ((i * 5) % 3 - 1) * rz * 0.3, rx * 0.16, rx * 0.16, rz * 0.12, 0, Math.PI / 2);
    m.castShadow = false;
  }
}

/** Ruff collar (Elizabethan / Spanish) around the figure's neck. */
function ruff(p: THREE.Object3D, a: FigureAnchors, R = 1.25, c = '#f6f3ec'): void {
  const u = a.u, cy = a.head[1] - 0.115 * u;
  const n = 18;
  add(p, g('pb-ruff', () => new THREE.TorusGeometry(1, 0.42, 8, 26)), mat(c, { flat: false }), a.head[0], cy, a.head[2], a.headR * R * 0.78, a.headR * R * 0.78, a.headR * 0.42, 0, Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    ellip(p, shade(c, i % 2 ? 0.93 : 1), a.head[0] + Math.cos(t) * a.headR * R * 0.86, cy, a.head[2] + Math.sin(t) * a.headR * R * 0.82, a.headR * 0.26, a.headR * 0.2, a.headR * 0.26, -t);
  }
}

/** Tiny floating music note (head + stem + flag). */
function note(p: THREE.Object3D, x: number, y: number, z: number, s = 1, c = '#1f2937', ry = 0): void {
  const q = grp(p, x, y, z, ry, 0, 0.2);
  ellip(q, c, 0, 0, 0, 0.014 * s, 0.01 * s, 0.008 * s, 0, 0, 0.4);
  box(q, c, 0.012 * s, 0, 0, 0.0035 * s, 0.05 * s, 0.0035 * s);
  box(q, c, 0.02 * s, 0.038 * s, 0, 0.016 * s, 0.006 * s, 0.0035 * s, 0, 0, -0.5);
}

// ---------------------------------------------------------------- Li Bai: raising a cup to the moon
const libai: Builder = gp => {
  const Y = figureBase(gp, '#cbc5a4', '#55654a');
  // misty Sichuan peaks with the full moon rising behind them
  lathe(gp, [[0, 0], [0.16, 0], [0.12, 0.1], [0.075, 0.22], [0.035, 0.33], [0, 0.36]], '#7f927a', -0.24, Y, -0.24, 9);
  lathe(gp, [[0, 0], [0.12, 0], [0.085, 0.09], [0.045, 0.18], [0, 0.21]], '#9aab90', -0.05, Y, -0.32, 8);
  ellip(gp, '#f3f1e6', -0.24, Y + 0.33, -0.24, 0.03, 0.012, 0.03);
  glow(ellip(gp, '#fff4c2', -0.3, Y + 0.44, -0.36, 0.1, 0.1, 0.018), '#fff4c2', '#e8cf7a');
  // pine leaning over a moonlit pond
  tube(gp, [[0.3, Y, -0.2], [0.27, Y + 0.14, -0.2], [0.33, Y + 0.26, -0.16], [0.24, Y + 0.36, -0.1]], 0.024, 0.012, '#5b4636', { radial: 7, sub: 3 });
  for (const [px, py, pz, s] of [[0.24, 0.38, -0.1, 1], [0.34, 0.29, -0.14, 0.8], [0.18, 0.33, -0.05, 0.7], [0.3, 0.42, -0.16, 0.75]])
    ellip(gp, shade('#3f6b45', 0.9 + s * 0.15), px, Y + py, pz, 0.075 * s, 0.022 * s, 0.06 * s);
  pond(gp, 0.17, Y, 0.21, 0.17, 0.12, '#355f80');
  glow(ellip(gp, '#fff4c2', 0.2, Y + 0.011, 0.22, 0.035, 0.002, 0.026), '#fff4c2', '#d9c070');
  rocks(gp, 0.17, Y, 0.21, 0.18, 0.13, 9, '#8d8b84', 0.02);
  // wine jar with a red paper label
  lathe(gp, [[0, 0], [0.035, 0], [0.055, 0.04], [0.05, 0.075], [0.025, 0.095], [0.022, 0.105], [0, 0.105]], '#6b4a32', -0.2, Y, 0.17, 14);
  ellip(gp, '#c9b48a', -0.2, Y + 0.108, 0.17, 0.03, 0.012, 0.03);
  box(gp, '#c0262d', -0.2, Y + 0.035, 0.222, 0.036, 0.036, 0.004, 0, 0, Math.PI / 4);
  const a = figure(gp, {
    y: Y, z: -0.03, ry: -0.2, top: '#eeeadf', accent: '#3d6a8f', outfit: 'robe', wideSleeves: true, hair: '#1f1a17', hairStyle: 'short',
    hat: 'futou', hatColor: '#1b1b1d', beard: 'goatee', beardColor: '#1f1a17', shoes: '#2b2b2b',
    armR: { fwd: 2.0, side: 1.0, bend: 0.2 }, armL: { fwd: 0.45, side: 0.22, bend: 0.55, inward: 0.1 },
  });
  // wine cup raised toward the moon, gourd flask in the other hand
  lathe(gp, [[0.004, 0], [0.012, 0.004], [0.024, 0.028], [0.021, 0.03], [0.009, 0.013], [0, 0.013]], BRASS, a.handR[0], a.handR[1] + 0.022, a.handR[2], 14);
  rod(gp, a.handL, off(a.handL, 0, -0.035, 0.01), 0.002, '#c0262d');
  ellip(gp, '#c98a3a', a.handL[0], a.handL[1] - 0.055, a.handL[2] + 0.012, 0.018, 0.02, 0.018);
  ellip(gp, '#c98a3a', a.handL[0], a.handL[1] - 0.095, a.handL[2] + 0.012, 0.028, 0.03, 0.028);
};

// ---------------------------------------------------------------- Qu Yuan: poet on the riverbank, dragon boat, zongzi
const quyuan: Builder = gp => {
  const Y = figureBase(gp, '#c3c49f', '#4f6b55');
  const river: [number, number][] = [];
  for (let i = 0; i <= 20; i++) { const t = 0.06 * Math.PI + (i / 20) * 0.88 * Math.PI; river.push([Math.cos(t) * 0.445, Math.sin(t) * 0.445]); }
  prism(gp, river, Y, 0.01, '#3c7896');
  for (let i = 0; i < 6; i++) box(gp, '#7fb2c8', -0.3 + i * 0.12, Y + 0.01, 0.36 - (i % 2) * 0.05, 0.05, 0.002, 0.006);
  // dragon boat with rowers and a drummer
  const bz = 0.27, by = Y + 0.012;
  sweep(gp, [
    { p: [-0.25, by + 0.03, bz], w: 0.006, h: 0.006 }, { p: [-0.17, by + 0.015, bz], w: 0.026, h: 0.018 },
    { p: [0, by + 0.012, bz], w: 0.034, h: 0.022 }, { p: [0.17, by + 0.015, bz], w: 0.026, h: 0.018 }, { p: [0.24, by + 0.03, bz], w: 0.006, h: 0.006 },
  ], '#b8281f', { radial: 10, sub: 4, squash: 0.7 });
  box(gp, '#e2b13c', -0.18, by + 0.03, bz + 0.029, 0.36, 0.006, 0.004);
  box(gp, '#e2b13c', -0.18, by + 0.03, bz - 0.029, 0.36, 0.006, 0.004);
  tube(gp, [[0.23, by + 0.03, bz], [0.265, by + 0.07, bz], [0.27, by + 0.1, bz]], 0.012, 0.015, '#d9a62e', { radial: 8, sub: 3 });
  ellip(gp, '#d9a62e', 0.285, by + 0.108, bz, 0.028, 0.017, 0.016);
  ellip(gp, '#b8281f', 0.31, by + 0.1, bz, 0.012, 0.006, 0.011);
  for (const s of [-1, 1]) {
    rod(gp, [0.27, by + 0.12, bz + s * 0.008], [0.255, by + 0.15, bz + s * 0.016], 0.003, '#e2b13c');
    ellip(gp, '#ffffff', 0.297, by + 0.115, bz + s * 0.011, 0.005);
    ellip(gp, INK, 0.3, by + 0.115, bz + s * 0.014, 0.003);
  }
  tube(gp, [[-0.24, by + 0.03, bz], [-0.28, by + 0.07, bz], [-0.26, by + 0.1, bz]], 0.01, 0.004, '#d9a62e', { radial: 6, sub: 3 });
  const shirts = ['#f2c12e', '#2f6fd0', '#f2c12e', '#2f6fd0'];
  for (let i = 0; i < 4; i++) {
    const x = -0.13 + i * 0.065;
    cyl(gp, shirts[i], x, by + 0.03, bz, 0.011, 0.028, 8);
    ellip(gp, '#e9b993', x, by + 0.068, bz, 0.01);
    rod(gp, [x + 0.005, by + 0.05, bz + 0.012], [x - 0.02, by - 0.004, bz + 0.05], 0.0022, '#8b5a2b');
  }
  cyl(gp, '#b8281f', 0.15, by + 0.03, bz, 0.016, 0.022, 12);
  cyl(gp, '#efe2c4', 0.15, by + 0.052, bz, 0.016, 0.002, 12);
  // zongzi on leaves, and fragrant orchids on the bank
  disc(gp, '#4f8a3a', -0.26, Y, -0.04, 0.07, 0.05, 0.004);
  for (const [zx, zz, r] of [[-0.28, -0.05, 0], [-0.24, -0.03, 1.1], [-0.26, -0.01, 2.3]]) {
    add(gp, g('pb-tet', () => new THREE.TetrahedronGeometry(1)), mat('#5d9a3c'), zx, Y + 0.022, zz, 0.024, 0.024, 0.024, r, 0.6);
    rod(gp, [zx - 0.015, Y + 0.022, zz], [zx + 0.015, Y + 0.022, zz], 0.0018, '#d9c48a');
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6, bx = 0.22 + Math.sin(i * 2.3) * 0.05, bzz = -0.12 + Math.cos(i * 1.7) * 0.04;
    tube(gp, [[bx, Y, bzz], [bx + 0.01 + t * 0.02, Y + 0.08, bzz + 0.01], [bx + 0.04, Y + 0.13 + t * 0.03, bzz + 0.02]], 0.004, 0.0015, '#4d7c2f', { radial: 5, sub: 2 });
    if (i % 2 === 0) ellip(gp, '#c9a0dc', bx + 0.04, Y + 0.135 + t * 0.03, bzz + 0.02, 0.009, 0.007, 0.009);
  }
  const a = figure(gp, {
    y: Y, z: -0.1, x: -0.02, top: '#3e5c4a', accent: '#b8862e', outfit: 'robe', wideSleeves: true, hair: '#1c1917', hairStyle: 'topknot',
    beard: 'long', beardColor: '#1c1917', armR: { fwd: 1.55, side: 0.4, bend: 0.55 }, armL: { fwd: 0.35, side: 0.15, bend: 0.55, inward: 0.35 },
  });
  // tall slanted "cloud-cutting" hat
  box(gp, '#1d1d1f', a.top[0], a.top[1] - 0.012, a.top[2] - 0.01, a.headR * 0.55, a.headR * 1.4, a.headR * 0.85, 0, -0.32);
  rod(gp, off(a.top, -a.headR * 0.8, 0.03, -0.01), off(a.top, a.headR * 0.8, 0.03, -0.01), 0.003, GOLD);
  // sword at the hip
  rod(gp, off(a.handL, -0.005, 0.0, -0.01), off(a.handL, -0.02, -0.2, -0.09), 0.006, '#4b5563');
  box(gp, GOLD, a.handL[0] - 0.02, a.handL[1] - 0.02, a.handL[2] - 0.01, 0.04, 0.008, 0.012);
  // rolled poem scroll raised as he recites
  const s0 = off(a.handR, 0, 0.0, 0.012);
  cyl(gp, '#8b5a2b', s0[0], s0[1] - 0.04, s0[2], 0.009, 0.08, 8);
  box(gp, PAPER, s0[0] + 0.012, s0[1] - 0.11, s0[2] + 0.004, 0.05, 0.1, 0.002);
  for (let i = 0; i < 4; i++) box(gp, INK, s0[0] + 0.0 + i * 0.011, s0[1] - 0.1, s0[2] + 0.006, 0.003, 0.075, 0.001);
};

// ---------------------------------------------------------------- Wang Xizhi: calligraphy at the Orchid Pavilion, geese
function goose(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const q = grp(p, x, y, z, ry);
  ellip(q, '#f7f5ef', 0, 0.035 * s, 0, 0.026 * s, 0.024 * s, 0.045 * s);
  ellip(q, '#ece8de', 0, 0.042 * s, -0.035 * s, 0.014 * s, 0.014 * s, 0.022 * s, 0, 0.5);
  tube(q, [[0, 0.05 * s, 0.03 * s], [0, 0.08 * s, 0.045 * s], [0, 0.105 * s, 0.04 * s]], 0.009 * s, 0.008 * s, '#f7f5ef', { radial: 7, sub: 3 });
  ellip(q, '#f7f5ef', 0, 0.112 * s, 0.048 * s, 0.012 * s, 0.012 * s, 0.016 * s);
  ellip(q, '#e88a1a', 0, 0.108 * s, 0.07 * s, 0.005 * s, 0.005 * s, 0.012 * s);
  ellip(q, '#e88a1a', 0, 0.118 * s, 0.059 * s, 0.005 * s);
  for (const sx of [-1, 1]) {
    ellip(q, INK, sx * 0.01 * s, 0.116 * s, 0.054 * s, 0.002 * s);
    rod(q, [sx * 0.01 * s, 0.015 * s, 0], [sx * 0.01 * s, 0, 0.005 * s], 0.0025 * s, '#e88a1a');
  }
}

const wangxizhi: Builder = gp => {
  const Y = figureBase(gp, '#d2c8a6', '#6e5a40');
  // the Orchid Pavilion
  const px = -0.24, pz = -0.22;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(gp, '#9b2f25', px + dx * 0.065, Y, pz + dz * 0.065, 0.008, 0.16, 8);
  cyl(gp, '#a8a196', px, Y, pz, 0.095, 0.012, 4).rotation.y = Math.PI / 4;
  cone(gp, '#4b5a5e', px, Y + 0.16, pz, 0.13, 0.09, 4, Math.PI / 4);
  ellip(gp, GOLD, px, Y + 0.255, pz, 0.01, 0.016, 0.01);
  box(gp, '#2f3b3e', px, Y + 0.155, pz, 0.15, 0.012, 0.15);
  // bamboo
  for (const [bx, bz, h] of [[0.3, -0.24, 0.42], [0.35, -0.16, 0.34], [0.25, -0.3, 0.36]]) {
    cyl(gp, '#6f9a3a', bx, Y, bz, 0.009, h, 7);
    for (let k = 1; k < 5; k++) cyl(gp, '#56782c', bx, Y + h * k / 5, bz, 0.0105, 0.006, 7);
    for (let k = 0; k < 4; k++) ellip(gp, '#5a8f3c', bx + (k % 2 ? 0.025 : -0.025), Y + h * (0.55 + k * 0.12), bz + 0.01, 0.028, 0.004, 0.008, k % 2 ? 0.4 : -0.4, 0, k % 2 ? -0.5 : 0.5);
  }
  // pond with geese
  pond(gp, -0.2, Y, 0.22, 0.17, 0.12, '#4a7f9a');
  rocks(gp, -0.2, Y, 0.22, 0.18, 0.13, 8, '#8e8a80', 0.018);
  goose(gp, -0.24, Y + 0.002, 0.2, 0.5, 0.95);
  goose(gp, -0.13, Y + 0.002, 0.26, -0.3, 0.8);
  goose(gp, -0.05, Y, 0.08, 0.2, 0.85);
  // writing table with paper, inkstone and calligraphy
  const tx = 0.17, tz = 0.12, ty = Y + 0.2;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(gp, '#3b2a20', tx + dx * 0.1, Y, tz + dz * 0.055, 0.014, 0.2, 0.014);
  rbox(gp, '#4a3427', tx, ty, tz, 0.24, 0.016, 0.14, 0.005);
  box(gp, PAPER, tx + 0.015, ty + 0.016, tz + 0.005, 0.15, 0.002, 0.11);
  for (let c = 0; c < 5; c++) for (let r = 0; r < 4; r++)
    box(gp, INK, tx + 0.07 - c * 0.027, ty + 0.018, tz - 0.035 + r * 0.024, 0.014, 0.001, 0.004 + ((c + r) % 3) * 0.003, (c * r) % 2 ? 0.6 : -0.3);
  rbox(gp, '#2b2d30', tx - 0.09, ty + 0.016, tz - 0.02, 0.035, 0.01, 0.05, 0.003);
  const a = figure(gp, {
    y: Y, z: -0.06, x: -0.04, ry: 0.25, top: '#5c84ad', accent: '#4f8a68', outfit: 'robe', wideSleeves: true, hair: '#1c1917', hairStyle: 'topknot',
    beard: 'goatee', beardColor: '#1c1917', armR: { fwd: 1.05, side: 0.12, bend: 0.25, inward: 0.15 }, armL: { fwd: 0.6, side: 0.1, bend: 0.8, inward: 0.55 },
  });
  // soft grey scholar's head-cloth with ribbons
  ellip(gp, '#8f949a', a.top[0], a.top[1] - a.headR * 0.25, a.top[2] - a.headR * 0.1, a.headR * 1.1, a.headR * 0.7, a.headR * 1.12);
  ellip(gp, '#9aa0a6', a.top[0], a.top[1] + a.headR * 0.2, a.top[2] - a.headR * 0.2, a.headR * 0.6, a.headR * 0.5, a.headR * 0.6);
  for (const s of [-1, 1]) box(gp, '#8f949a', a.top[0] + s * a.headR * 0.4, a.top[1] - a.headR * 1.6, a.top[2] - a.headR * 1.05, a.headR * 0.3, a.headR * 1.3, 0.004, 0, 0, s * 0.15);
  // brush poised over the paper
  brush(gp, off(a.handR, 0, 0.05, 0), off(a.handR, 0.004, -0.04, 0.01));
};

// ---------------------------------------------------------------- Murasaki Shikibu: Heian court lady writing Genji
const murasaki: Builder = gp => {
  const Y = figureBase(gp, '#d7caa9', '#5a4636');
  rbox(gp, '#cbbf86', 0, Y, 0, 0.62, 0.008, 0.62, 0.003);
  for (const s of [-1, 1]) { box(gp, '#2d3b2a', s * 0.31, Y + 0.008, 0, 0.012, 0.002, 0.62); box(gp, '#2d3b2a', 0, Y + 0.008, s * 0.31, 0.62, 0.002, 0.012); }
  const Yf = Y + 0.008;
  // gold folding screen painted with wisteria and a stream
  for (let i = 0; i < 5; i++) {
    const x = -0.26 + i * 0.13, ry = i % 2 ? 0.32 : -0.32;
    const sc = grp(gp, x, Yf, -0.3 + (i % 2) * 0.02, ry);
    box(sc, '#4a2c1e', 0, 0, 0, 0.135, 0.34, 0.012);
    box(sc, '#dcb84f', 0, 0.012, 0.004, 0.115, 0.316, 0.008);
    for (let k = 0; k < 4; k++) {
      ellip(sc, k % 2 ? '#8e5bb5' : '#a77cc9', -0.035 + k * 0.024, 0.25 - (k % 2) * 0.03, 0.01, 0.009, 0.034, 0.003);
      ellip(sc, '#5d8a3c', -0.035 + k * 0.024, 0.3, 0.01, 0.016, 0.006, 0.003, 0, 0, 0.4);
    }
    ellip(sc, '#4f7fb0', 0.0, 0.06 + (i % 2) * 0.02, 0.0095, 0.06, 0.012, 0.002, 0, 0, i % 2 ? 0.25 : -0.25);
  }
  // low lacquered writing desk with paper, inkstone and brush
  const dx = 0.22, dz = 0.14;
  for (const s of [-1, 1]) box(gp, '#1b1515', dx + s * 0.08, Yf, dz, 0.012, 0.07, 0.09);
  rbox(gp, '#1d1717', dx, Yf + 0.07, dz, 0.2, 0.014, 0.11, 0.004);
  box(gp, '#a3241f', dx, Yf + 0.073, dz + 0.056, 0.2, 0.006, 0.002);
  box(gp, PAPER, dx + 0.02, Yf + 0.084, dz, 0.11, 0.002, 0.08);
  for (let c = 0; c < 6; c++) box(gp, INK, dx + 0.065 - c * 0.018, Yf + 0.086, dz - 0.005, 0.003, 0.0008, 0.055);
  rbox(gp, '#2f3033', dx - 0.07, Yf + 0.084, dz, 0.03, 0.01, 0.045, 0.003);
  rod(gp, [dx - 0.04, Yf + 0.09, dz + 0.03], [dx + 0.02, Yf + 0.09, dz + 0.04], 0.0025, '#c9a86a');
  // pooled layers of the twelve-layer robe
  const layers = ['#f1ece0', '#2f7d4f', '#e3b53c', '#c0392b', '#7d4aa6'];
  layers.forEach((c, i) => {
    const r = 0.25 - i * 0.017;
    const m = lathe(gp, [[0, 0], [r, 0], [r - 0.004, 0.012 + i * 0.006], [r - 0.06, 0.03 + i * 0.008], [0, 0.04]], c, 0, Yf, -0.04, 26);
    m.scale.z = 0.72;
  });
  const a = figure(gp, {
    y: Yf + 0.02, z: -0.04, top: '#6e3f94', accent: '#c0392b', outfit: 'robe', wideSleeves: true, hair: '#141212', hairStyle: 'long',
    armL: { fwd: 0.95, side: 0.15, bend: 0.6, inward: 0.45 }, armR: { fwd: 1.05, side: 0.25, bend: 0.75, inward: 0.15 },
  });
  // floor-length hair down the back
  tube(gp, [off(a.head, 0, -a.headR * 0.2, -a.headR * 0.85), off(a.head, 0, -0.2, -a.headR * 1.25), [a.head[0], Yf + 0.06, a.head[2] - a.headR * 1.6], [a.head[0], Yf + 0.03, a.head[2] - a.headR * 2.4]], a.headR * 0.7, a.headR * 0.55, '#141212', { radial: 9, sub: 4 });
  // layered sleeve cuffs in the robe colours
  for (const h of [a.handL, a.handR]) layers.slice(1).forEach((c, i) => ellip(gp, c, h[0], h[1] - 0.03 + i * 0.006, h[2] - 0.012 - i * 0.004, 0.06 - i * 0.006, 0.02, 0.04 - i * 0.004));
  // writing on a long sheet of paper with a slim brush
  box(gp, PAPER, a.handL[0] - 0.01, a.handL[1] - 0.005, a.handL[2] + 0.01, 0.075, 0.003, 0.05, 0, -0.5);
  for (let c = 0; c < 4; c++) box(gp, INK, a.handL[0] - 0.035 + c * 0.016, a.handL[1] + 0.0, a.handL[2] + 0.012, 0.002, 0.002, 0.035, 0, -0.5);
  brush(gp, off(a.handR, 0.005, 0.04, -0.01), off(a.handR, -0.005, -0.03, 0.015), INK, '#7a3b2a', 0.0028);
};

// ---------------------------------------------------------------- Hokusai: old master, the Great Wave in 3D and on the easel
function greatWavePrint(c: THREE.Object3D, w: number, h: number): void {
  pr(c, '#e8dcc0', 0, 0, w, h);
  pr(c, '#c9b48e', 0, h * 0.45, w, h * 0.1);
  pe(c, '#1f3f6e', -w * 0.12, -h * 0.05, w * 0.32, h * 0.33, 0.3);
  pe(c, '#e8dcc0', -w * 0.02, -h * 0.02, w * 0.2, h * 0.2, 0.3, 0.0025);
  pe(c, '#2c5d94', w * 0.28, -h * 0.3, w * 0.22, h * 0.14, 0, 0.002);
  pe(c, '#1f3f6e', -w * 0.25, -h * 0.38, w * 0.3, h * 0.1, 0, 0.002);
  for (let i = 0; i < 7; i++) pe(c, '#f8f6ef', -w * 0.28 + i * w * 0.07, h * 0.23 - Math.abs(i - 3) * h * 0.035, w * 0.03, h * 0.025, 0, 0.0032);
  box(c, '#3b6ea8', w * 0.16, -h * 0.2 - h * 0.08, 0.0012, w * 0.17, h * 0.16, 0.003);
  pe(c, '#3b6ea8', w * 0.16, -h * 0.13, w * 0.085, h * 0.04, 0, 0.0018);
  pe(c, '#f8f6ef', w * 0.16, -h * 0.07, w * 0.035, h * 0.025, 0, 0.0028);
  pr(c, '#b03a2e', -w * 0.38, h * 0.38, w * 0.07, h * 0.12);
}

const hokusai: Builder = gp => {
  const Y = figureBase(gp, '#d6ccb2', '#4e3f30');
  // a curling great wave rising from the sea, little Mount Fuji in the trough
  pond(gp, -0.17, Y, 0.17, 0.25, 0.2, '#2a5683');
  const wz = 0.18;
  tube(gp, [[-0.38, Y + 0.01, wz], [-0.33, Y + 0.12, wz], [-0.24, Y + 0.23, wz + 0.01], [-0.14, Y + 0.25, wz + 0.02], [-0.08, Y + 0.2, wz + 0.02], [-0.1, Y + 0.15, wz + 0.02], [-0.135, Y + 0.17, wz + 0.02]],
    0.06, 0.012, '#24508a', { radial: 12, sub: 5, paint: (x, y) => (y > Y + 0.2 ? '#3b74b3' : y < Y + 0.07 ? '#1d3f6c' : null) });
  for (let i = 0; i < 9; i++) {
    const t = i / 8, ang = Math.PI * (0.9 - t * 1.4);
    ellip(gp, '#f7f6f0', -0.17 + Math.cos(ang) * 0.075, Y + 0.18 + Math.sin(ang) * 0.06, wz + 0.035 + (i % 2) * 0.01, 0.013, 0.01, 0.012);
  }
  for (let i = 0; i < 5; i++) ellip(gp, '#f7f6f0', -0.3 + i * 0.04, Y + 0.1 + i * 0.03, wz + 0.05, 0.011, 0.008, 0.01);
  ellip(gp, '#2f62a0', -0.02, Y + 0.02, 0.24, 0.07, 0.03, 0.05);
  cone(gp, '#3b5a7a', 0.03, Y + 0.008, 0.33, 0.045, 0.04, 10);
  cone(gp, '#f8f6ef', 0.03, Y + 0.034, 0.33, 0.018, 0.016, 10);
  sweep(gp, [{ p: [-0.12, Y + 0.02, 0.3], w: 0.003 }, { p: [-0.05, Y + 0.015, 0.31], w: 0.012, h: 0.007 }, { p: [0.02, Y + 0.02, 0.32], w: 0.003 }], '#e7d3a8', { radial: 8, sub: 3 });
  // easel with the print
  const c = easel(gp, 0.25, Y, 0.02, -0.55, 0.17, 0.12);
  greatWavePrint(c, 0.17, 0.12);
  const a = figure(gp, {
    y: Y, z: -0.12, x: -0.02, ry: -0.2, top: '#6f6250', accent: '#3a3128', outfit: 'robe', wideSleeves: true, hair: '#cfcac0', hairStyle: 'bald',
    shoes: '#5a4a3a', armL: { fwd: 0.55, side: 0.25, bend: 0.25 }, armR: { fwd: 1.2, side: 0.35, bend: 0.35 }, lean: 0.06,
  });
  // checked pattern on the robe
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++)
    ellip(gp, '#4b4034', a.head[0] + (k - 0.5) * 0.07 - 0.02, a.head[1] - 0.22 - i * 0.07, a.head[2] + 0.12 - i * 0.01, 0.018, 0.018, 0.004, -0.2);
  ellip(gp, '#cfcac0', a.head[0], a.head[1] + a.headR * 1.0, a.head[2] - a.headR * 0.3, a.headR * 0.28);
  // walking stick and brush
  rod(gp, off(a.handL, 0, 0.03, 0), [a.handL[0] - 0.02, Y, a.handL[2] + 0.02], 0.006, '#7a5a3a');
  brush(gp, off(a.handR, -0.01, -0.02, -0.03), off(a.handR, 0.03, 0.03, 0.06), '#1f3f6e');
};

// ---------------------------------------------------------------- Leonardo da Vinci: Mona Lisa on the easel, flying machine
function monaLisa(c: THREE.Object3D, w: number, h: number): void {
  pr(c, '#8c9a76', 0, h * 0.18, w, h * 0.64);
  pr(c, '#5f6c48', 0, -h * 0.32, w, h * 0.36);
  pe(c, '#a4b08e', -w * 0.3, h * 0.12, w * 0.15, h * 0.05, 0.4, 0.002);
  pe(c, '#6c7a5a', w * 0.3, h * 0.05, w * 0.15, h * 0.08, -0.3, 0.002);
  box(c, '#2b2419', 0, -h * 0.5, 0.0025, w * 0.7, h * 0.5, 0.003);
  pe(c, '#2b2419', 0, -h * 0.02, w * 0.2, h * 0.14, 0, 0.0028);
  pe(c, '#d6a679', 0, h * 0.2, w * 0.13, h * 0.15, 0, 0.0035);
  pe(c, '#d6a679', 0, -h * 0.05, w * 0.12, h * 0.045, 0, 0.0034);
  pe(c, '#3a2617', -w * 0.15, h * 0.12, w * 0.06, h * 0.2, 0, 0.0032);
  pe(c, '#3a2617', w * 0.15, h * 0.12, w * 0.06, h * 0.2, 0, 0.0032);
  pe(c, '#3a2617', 0, h * 0.34, w * 0.13, h * 0.05, 0, 0.003);
  pe(c, '#d6a679', w * 0.04, -h * 0.3, w * 0.13, h * 0.05, 0.1, 0.0036);
  pe(c, '#6b2d1d', 0, h * 0.13, w * 0.03, h * 0.008, 0, 0.0042);
  for (const s of [-1, 1]) pe(c, INK, s * w * 0.045, h * 0.22, w * 0.014, h * 0.01, 0, 0.0042);
  for (const s of [-1, 1]) { box(c, GOLD, s * (w / 2 + 0.004), -h / 2 - 0.008, 0.0, 0.01, h + 0.016, 0.008); box(c, GOLD, 0, s * (h / 2 + 0.004) - 0.005, 0.0, w + 0.018, 0.01, 0.008); }
}

const davinci: Builder = gp => {
  const Y = figureBase(gp, '#d3c19d', '#6b5236');
  const c = easel(gp, 0.24, Y, 0.06, -0.6, 0.14, 0.19);
  monaLisa(c, 0.14, 0.19);
  // ornithopter model on a trestle stand
  const sx = -0.24, sz = -0.2;
  for (const s of [-1, 1]) rod(gp, [sx + s * 0.05, Y, sz], [sx, Y + 0.2, sz], 0.007, WOOD);
  const fm = grp(gp, sx, Y + 0.22, sz, 0.5, 0, 0);
  rod(fm, [0, 0, -0.08], [0, 0, 0.09], 0.008, '#a07a4a');
  rod(fm, [0, -0.02, 0], [0, 0.04, 0], 0.005, '#a07a4a');
  for (const s of [-1, 1]) {
    const wg = grp(fm, s * 0.01, 0.01, 0, 0, 0, s * 0.3);
    const outline: [number, number][] = [[0, 0.05], [0.07, 0.06], [0.15, 0.04], [0.2, 0.0], [0.17, -0.02], [0.13, -0.005], [0.1, -0.04], [0.06, -0.02], [0.02, -0.05], [0, -0.04]];
    const m = prism(wg, outline.map(([x, z]) => [s * x, z] as [number, number]), 0, 0.004, '#e9dcb6');
    m.position.y = 0;
    for (let k = 0; k < 4; k++) rod(wg, [0, 0.004, 0.0], [s * (0.06 + k * 0.045), 0.004, 0.05 - k * 0.025], 0.0025, '#7a5230');
  }
  cyl(fm, '#a07a4a', 0, -0.01, -0.09, 0.012, 0.004, 10);
  // notebook with mirror writing
  openBook(gp, [-0.2, Y + 0.012, 0.22], '#7a4b2a', 1.1, 0, 0.3);
  const a = figure(gp, {
    y: Y, z: -0.04, x: -0.03, ry: -0.15, top: '#6e2a24', accent: '#3b2a1e', outfit: 'robe', hair: '#ddd7cc', hairStyle: 'long',
    beard: 'long', beardColor: '#ddd7cc', hat: 'beret', hatColor: '#2b2523', shoes: '#3b2a1e',
    armR: { fwd: 1.15, side: 0.45, bend: 0.3 }, armL: { fwd: 0.85, side: 0.1, bend: 0.7, inward: 0.4 },
  });
  brush(gp, off(a.handR, -0.02, -0.01, -0.03), off(a.handR, 0.035, 0.012, 0.05), '#5f6c48', '#6b4a2b', 0.003);
  book(gp, a.handL[0], a.handL[1] - 0.012, a.handL[2] + 0.02, '#5a3a22', 0.06, 0.08, 0.014, 0.3);
};

// ---------------------------------------------------------------- William Shakespeare: quill, ruff, the Globe Theatre
function globeTheatre(p: THREE.Object3D, x: number, y: number, z: number, R: number): void {
  const n = 16;
  lathe(p, [[R * 0.7, 0], [R, 0], [R, R * 0.85], [R * 0.7, R * 0.85]], '#f2ead8', x, y, z, n);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    box(p, '#4a3324', x + Math.cos(t) * R * 1.003, y, z + Math.sin(t) * R * 1.003, 0.006, R * 0.85, 0.006, -t);
  }
  for (const k of [0.3, 0.58]) lathe(p, [[R * 1.002, R * k], [R * 1.01, R * k], [R * 1.01, R * k + 0.005], [R * 1.002, R * k + 0.005]], '#4a3324', x, y, z, n);
  lathe(p, [[R * 1.06, R * 0.83], [R * 1.08, R * 0.85], [R * 0.82, R * 1.08], [R * 0.66, R * 0.95], [R * 0.66, R * 0.85]], '#c9a45a', x, y, z, n);
  const hz = z + R * 0.55;
  box(p, '#f2ead8', x, y, hz, R * 0.5, R * 1.15, R * 0.3);
  const gm = grp(p, x, y + R * 1.15, hz, Math.PI / 2);
  add(gm, g('pb-gable', () => { const b = new THREE.ConeGeometry(0.5, 1, 4); b.rotateY(Math.PI / 4); return b; }), mat('#c9a45a'), 0, R * 0.18, 0, R * 0.45, R * 0.36, R * 0.62);
  rod(p, [x, y + R * 1.2, hz], [x, y + R * 1.75, hz], 0.003, '#4a3324');
  box(p, '#d33a2c', x + 0.025, y + R * 1.58, hz, 0.045, 0.028, 0.003);
  box(p, '#4a3324', x, y, z + R * 0.995, R * 0.3, R * 0.5, 0.01);
}

const shakespeare: Builder = gp => {
  const Y = figureBase(gp, '#cdbf9e', '#5a4632');
  globeTheatre(gp, -0.23, Y, -0.2, 0.16);
  // writing desk with candle, inkwell and books
  const tx = 0.22, tz = 0.12, ty = Y + 0.17;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(gp, '#4a3324', tx + dx * 0.07, Y, tz + dz * 0.05, 0.008, 0.17, 6);
  rbox(gp, '#6b4630', tx, ty, tz, 0.18, 0.014, 0.13, 0.004);
  cyl(gp, '#2b2b2b', tx - 0.04, ty + 0.014, tz + 0.03, 0.014, 0.022, 10);
  quill(gp, [tx - 0.04, ty + 0.03, tz + 0.03], [tx - 0.07, ty + 0.13, tz - 0.0]);
  book(gp, tx + 0.04, ty + 0.014, tz - 0.02, '#7f1d1d', 0.07, 0.09, 0.02, 0.2);
  book(gp, tx + 0.045, ty + 0.034, tz - 0.02, '#1e3a5f', 0.06, 0.08, 0.016, -0.1);
  cyl(gp, GOLD, tx + 0.05, ty + 0.014, tz + 0.045, 0.018, 0.004, 10);
  cyl(gp, '#f3ede0', tx + 0.05, ty + 0.018, tz + 0.045, 0.008, 0.05, 8);
  glow(ellip(gp, '#ffd36b', tx + 0.05, ty + 0.078, tz + 0.045, 0.006, 0.012, 0.006), '#ffd36b', '#ffb02e');
  const a = figure(gp, {
    y: Y, z: -0.02, x: -0.03, top: '#25242b', bottom: '#2f2d36', accent: '#25242b', shirt: '#f6f3ec', outfit: 'suit', hair: '#4a3020', hairStyle: 'bald',
    beard: 'goatee', beardColor: '#4a3020', shoes: '#1b1b1b', armR: { fwd: 1.4, side: 0.4, bend: 0.85 }, armL: { fwd: 0.85, side: 0.1, bend: 0.7, inward: 0.45 },
  });
  ruff(gp, a, 1.15);
  for (const s of [-1, 1]) ellip(gp, '#4a3020', a.head[0] + s * a.headR * 0.95, a.head[1] - a.headR * 0.15, a.head[2] - a.headR * 0.15, a.headR * 0.3, a.headR * 0.65, a.headR * 0.55);
  ellip(gp, GOLD, a.head[0] - a.headR * 1.02, a.head[1] - a.headR * 0.3, a.head[2] + 0.004, a.headR * 0.09);
  for (let i = 0; i < 5; i++) ellip(gp, GOLD, a.head[0], a.head[1] - 0.17 - i * 0.03, a.head[2] + 0.068 - i * 0.002, 0.004);
  quill(gp, off(a.handR, 0, -0.01, 0), off(a.handR, -0.03, 0.11, -0.02));
  const s = grp(gp, a.handL[0], a.handL[1], a.handL[2] + 0.015, 0.2, -0.6);
  box(s, PAPER, 0.01, -0.06, 0, 0.07, 0.09, 0.003);
  cyl(s, '#c9b48a', 0.01, 0.025, 0.0, 0.007, 0.02, 8).rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) box(s, '#6b6458', 0.01, -0.02 - i * 0.011, 0.002, 0.05, 0.002, 0.001);
};

// ---------------------------------------------------------------- Mozart: red coat, powdered wig, violin and harpsichord
function keyboardKeys(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, n: number, ry = 0): void {
  const q = grp(p, x, y, z, ry);
  box(q, '#f4efe2', 0, 0, 0, w, 0.006, d);
  for (let i = 0; i < n; i++) if ([1, 3, 6, 8, 10].includes(i % 12 % 12) && i % 7 !== 4) box(q, INK, -w / 2 + (i + 0.5) * (w / n), 0.006, -d * 0.18, w / n * 0.55, 0.005, d * 0.6);
  for (let i = 1; i < n; i++) box(q, '#cfc6b2', -w / 2 + i * (w / n), 0.0055, d * 0.2, 0.0012, 0.001, d * 0.55);
}

const mozart: Builder = gp => {
  const Y = figureBase(gp, '#e3d6bb', '#7a5a3a');
  for (let i = 0; i < 7; i++) { const x = -0.3 + i * 0.1; box(gp, '#cdbb98', x, Y, 0, 0.002, 0.001, 2 * Math.sqrt(0.43 * 0.43 - x * x)); }
  // harpsichord (wing-shaped, painted green with a red lid interior)
  const hx = 0.17, hz = -0.12;
  const plan: [number, number][] = [[-0.1, 0.1], [0.1, 0.1], [0.1, 0.0], [0.07, -0.14], [0.03, -0.26], [-0.02, -0.33], [-0.1, -0.35]];
  const hg = grp(gp, hx, Y, hz, -0.5);
  for (const [lx, lz] of [[-0.085, 0.085], [0.085, 0.085], [-0.08, -0.3]]) { cyl(hg, GOLD, lx, 0, lz, 0.008, 0.16, 8); ellip(hg, GOLD, lx, 0.09, lz, 0.012); }
  prism(hg, plan, 0.16, 0.05, '#2f5d4a');
  prism(hg, plan.map(([x, z]) => [x * 0.9, z * 0.92 + 0.008] as [number, number]), 0.165, 0.046, '#c79b62');
  box(hg, GOLD, 0, 0.16, 0.1, 0.2, 0.05, 0.004);
  keyboardKeys(hg, 0, 0.19, 0.12, 0.18, 0.04, 22);
  box(hg, '#2f5d4a', 0, 0.16, 0.135, 0.2, 0.03, 0.006);
  const lid = grp(hg, -0.1, 0.212, 0.0, 0, 0, 0.9);
  prism(lid, plan.map(([x, z]) => [x + 0.1, z] as [number, number]), 0, 0.006, '#9b2f25');
  rod(hg, [0.0, 0.21, -0.12], [-0.045, 0.3, -0.12], 0.003, GOLD);
  // music stand with notes
  rod(gp, [-0.25, Y, 0.14], [-0.25, Y + 0.28, 0.14], 0.005, '#3b2a1e');
  for (const s of [0, 2.1, 4.2]) rod(gp, [-0.25, Y + 0.02, 0.14], [-0.25 + Math.cos(s) * 0.05, Y, 0.14 + Math.sin(s) * 0.05], 0.004, '#3b2a1e');
  const ms = grp(gp, -0.25, Y + 0.3, 0.145, 0.6, -0.35);
  box(ms, '#3b2a1e', 0, -0.04, 0, 0.13, 0.09, 0.006);
  box(ms, PAPER, 0, -0.035, 0.004, 0.115, 0.08, 0.003);
  for (let i = 0; i < 4; i++) { box(ms, '#7d766a', 0, 0.025 - i * 0.018, 0.006, 0.1, 0.0012, 0.001); for (let k = 0; k < 5; k++) ellip(ms, INK, -0.04 + k * 0.02, 0.028 - i * 0.018 + (k % 3) * 0.003, 0.0065, 0.003, 0.0025, 0.001); }
  note(gp, 0.05, Y + 0.6, 0.12, 1.1);
  note(gp, -0.2, Y + 0.56, -0.02, 0.9, '#7f1d1d');
  const a = figure(gp, {
    y: Y, z: 0.0, x: -0.04, top: '#b42a2e', accent: GOLD, shirt: '#f8f5ee', bottom: '#efe3c8', outfit: 'coat', hair: '#efebe3', hairStyle: 'wig',
    shoes: '#1b1b1b', armL: { fwd: 1.4, side: 0.65, bend: 0.45, inward: 0.25 }, armR: { fwd: 1.05, side: 0.55, bend: 0.75, inward: 0.45 },
  });
  for (let i = 0; i < 3; i++) ellip(gp, '#fbfaf6', a.head[0], a.head[1] - 0.14 - i * 0.022, a.head[2] + 0.07 + i * 0.002, 0.022 - i * 0.003, 0.014, 0.012);
  // golden embroidery along the coat front
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) ellip(gp, GOLD, a.head[0] + s * 0.034, a.head[1] - 0.17 - i * 0.04, a.head[2] + 0.067 + (i > 3 ? 0.012 : 0), 0.008, 0.012, 0.004);
  // violin from the chin to the left hand, bow in the right
  const chin = off(a.head, -0.04, -0.09, 0.03);
  const dir = new THREE.Vector3(a.handL[0] - chin[0], a.handL[1] - chin[1], a.handL[2] - chin[2]);
  const L = dir.length();
  const v = aim(gp, chin, [dir.x, dir.y, dir.z], 0);
  v.rotateZ(-0.9);
  ellip(v, '#a2531f', 0, 0, 0.0, 0.032, 0.012, 0.042);
  ellip(v, '#a2531f', 0, 0, 0.055, 0.025, 0.012, 0.03);
  ellip(v, '#7a3a14', 0, 0.006, 0.028, 0.012, 0.008, 0.008);
  rod(v, [0, 0.012, 0.0], [0, 0.012, L - 0.01], 0.005, INK);
  ellip(v, '#5a2a10', 0, 0.01, L + 0.005, 0.008, 0.01, 0.012);
  for (const s of [-1, 1]) rod(v, [s * 0.003, 0.0145, -0.02], [s * 0.0015, 0.0145, L - 0.02], 0.0006, '#e5e7eb', 3);
  const bow0 = off(a.handR, 0.0, 0.0, 0.0), bow1 = lp(a.handR, off(chin, -0.04, 0.0, 0.08), 1.8);
  rod(gp, bow0, bow1, 0.0028, '#5a2a10');
  rod(gp, off(bow0, 0, -0.008, 0), off(bow1, 0, -0.008, 0), 0.0012, '#f4efe2', 3);
};

// ---------------------------------------------------------------- Beethoven: wild hair, red scarf, manuscript, grand piano
function grandPiano(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const q = grp(p, x, y, z, ry);
  q.scale.setScalar(s);
  const plan: [number, number][] = [[-0.12, 0.1], [0.12, 0.1], [0.12, 0.02], [0.1, -0.06], [0.05, -0.12], [0.03, -0.2], [0.02, -0.3], [-0.03, -0.36], [-0.09, -0.36], [-0.12, -0.32]];
  for (const [lx, lz] of [[-0.1, 0.08], [0.1, 0.08], [-0.08, -0.3]]) { cyl(q, '#141416', lx, 0, lz, 0.011, 0.15, 8); cyl(q, GOLD, lx, 0, lz, 0.013, 0.008, 8); }
  prism(q, plan, 0.15, 0.06, '#161618');
  prism(q, plan.map(([px, pz]) => [px * 0.92, pz * 0.94 + 0.005] as [number, number]), 0.205, 0.006, '#b88a4a');
  keyboardKeys(q, 0, 0.17, 0.125, 0.22, 0.05, 30);
  box(q, '#161618', 0, 0.15, 0.15, 0.24, 0.02, 0.01);
  for (const sx of [-1, 1]) box(q, '#161618', sx * 0.115, 0.15, 0.125, 0.012, 0.05, 0.05);
  prism(q, plan.map(([px, pz]) => [px * 1.02, pz * 1.01] as [number, number]), 0.21, 0.006, '#1c1c1f');
  box(q, '#161618', 0, 0.21, 0.09, 0.12, 0.05, 0.006);
  box(q, PAPER, -0.02, 0.215, 0.094, 0.05, 0.045, 0.002);
  box(q, PAPER, 0.03, 0.215, 0.094, 0.05, 0.045, 0.002);
  rod(q, [0, 0.17, 0.1], [0, 0.03, 0.06], 0.004, GOLD);
  box(q, GOLD, 0, 0.02, 0.055, 0.06, 0.008, 0.02);
}

const beethoven: Builder = gp => {
  const Y = figureBase(gp, '#cbbd9f', '#4a3b2e');
  grandPiano(gp, -0.17, Y, -0.05, 0.85, 1.05);
  // candlestick on the piano and scattered score pages on the floor
  const cx = -0.24, cz = -0.21, cyy = Y + 0.225;
  cyl(gp, GOLD, cx, cyy, cz, 0.016, 0.005, 10);
  cyl(gp, GOLD, cx, cyy, cz, 0.004, 0.05, 6);
  cyl(gp, '#f3ede0', cx, cyy + 0.05, cz, 0.006, 0.035, 8);
  glow(ellip(gp, '#ffd36b', cx, cyy + 0.095, cz, 0.005, 0.01, 0.005), '#ffd36b', '#ffb02e');
  for (const [px, pz, r] of [[0.12, 0.26, 0.3], [0.25, 0.18, -0.5], [0.05, 0.33, 1.1], [0.3, 0.02, 0.2]]) {
    box(gp, PAPER, px, Y, pz, 0.06, 0.002, 0.08, r);
    for (let i = 0; i < 4; i++) box(gp, '#6b6458', px + Math.sin(r) * (i - 1.5) * 0.015, Y + 0.002, pz + Math.cos(r) * (i - 1.5) * 0.015, 0.05, 0.0008, 0.002, r + Math.PI / 2);
  }
  const a = figure(gp, {
    y: Y, z: 0.04, x: 0.08, ry: -0.15, top: '#2a2e3a', accent: '#2a2e3a', shirt: '#f6f3ec', bottom: '#2b2b30', outfit: 'coat', hair: '#6d6862', hairStyle: 'short',
    shoes: '#141414', armL: { fwd: 0.9, side: 0.1, bend: 0.55, inward: 0.4 }, armR: { fwd: 1.0, side: 0.3, bend: 0.65, inward: 0.25 },
  });
  // stormy, wild grey hair: a wide bushy mass swept back, with unruly tufts
  const hr = a.headR, H = a.head;
  const bush: [number, number, number, number][] = [
    [0, 0.75, -0.25, 0.85], [-0.7, 0.55, -0.35, 0.62], [0.7, 0.6, -0.35, 0.62], [-1.0, 0.1, -0.25, 0.55], [1.0, 0.15, -0.25, 0.55],
    [-0.85, -0.35, -0.3, 0.45], [0.85, -0.3, -0.3, 0.45], [0, 0.35, -0.8, 0.75], [-0.55, -0.1, -0.75, 0.55], [0.55, -0.05, -0.75, 0.55],
    [-0.35, 0.95, 0.15, 0.45], [0.35, 0.92, 0.2, 0.42], [0, 1.0, 0.0, 0.5],
  ];
  bush.forEach(([bx, by, bz, r], i) => ellip(gp, shade('#8c877f', 0.86 + (i % 4) * 0.07), H[0] + bx * hr * 1.15, H[1] + by * hr * 1.05, H[2] + bz * hr, r * hr * 1.2, r * hr * 0.95, r * hr * 1.1, i * 0.7, i * 0.4));
  for (let i = 0; i < 12; i++) {
    const t = Math.PI * (-0.15 + i * 0.12);
    const b: V3 = [H[0] - Math.cos(t) * hr * 0.95, H[1] + hr * (0.25 + Math.sin(t) * 0.75), H[2] - hr * (0.3 + (i % 3) * 0.2)];
    const d = 0.45 + (i % 3) * 0.12, c = Math.cos(t + 0.3 * Math.sin(i * 3)), sn = Math.sin(t);
    const mid: V3 = [b[0] - c * hr * d * 0.6, b[1] + sn * hr * d * 0.6 + hr * 0.12, b[2] - hr * 0.15];
    tube(gp, [b, mid, [b[0] - c * hr * d, b[1] + sn * hr * d * 0.8 + hr * 0.05, b[2] - hr * 0.3]], hr * 0.3, hr * 0.1, i % 2 ? '#9a958c' : '#7a756e', { radial: 6, sub: 2 });
  }
  for (const s of [-1, 1]) box(gp, '#3a3633', H[0] + s * hr * 0.34, H[1] + hr * 0.36, H[2] + hr * 0.93, hr * 0.34, hr * 0.08, hr * 0.06, 0, 0, s * 0.3);
  for (const s of [-1, 1]) ellip(gp, '#6d6862', H[0] + s * hr * 0.95, H[1] - hr * 0.35, H[2] + hr * 0.25, hr * 0.12, hr * 0.38, hr * 0.12);
  // red scarf and high white collar
  for (const s of [-1, 1]) ellip(gp, '#f6f3ec', a.head[0] + s * hr * 0.42, a.head[1] - hr * 0.95, a.head[2] + hr * 0.45, hr * 0.28, hr * 0.32, hr * 0.12, 0, 0, s * 0.5);
  ellip(gp, '#c0262d', a.head[0], a.head[1] - hr * 1.3, a.head[2] + hr * 0.6, hr * 0.42, hr * 0.32, hr * 0.3);
  ellip(gp, '#a81e25', a.head[0] + hr * 0.1, a.head[1] - hr * 1.85, a.head[2] + hr * 0.72, hr * 0.22, hr * 0.5, hr * 0.12, 0, 0, -0.2);
  // manuscript and pencil
  const m = grp(gp, a.handL[0] + 0.02, a.handL[1] + 0.005, a.handL[2] + 0.02, -0.3, -0.9);
  box(m, PAPER, 0, 0, 0, 0.08, 0.01, 0.1);
  for (let i = 0; i < 5; i++) box(m, '#5d564b', 0, 0.0105, -0.035 + i * 0.017, 0.065, 0.0008, 0.0015);
  for (let i = 0; i < 8; i++) ellip(m, INK, -0.028 + i * 0.008, 0.011, -0.03 + (i % 5) * 0.017, 0.0025, 0.001, 0.002);
  rod(gp, off(a.handR, -0.01, -0.015, 0), off(a.handR, 0.01, 0.045, -0.005), 0.0025, '#b8862e');
};

// ---------------------------------------------------------------- Vincent van Gogh: straw hat, palette, Sunflowers
function sunflowersPainting(c: THREE.Object3D, w: number, h: number): void {
  pr(c, '#e9c84a', 0, h * 0.1, w, h * 0.8);
  pr(c, '#d9952a', 0, -h * 0.4, w, h * 0.2);
  pr(c, '#e8b23c', 0, -h * 0.22, w * 0.3, h * 0.26);
  pr(c, '#2f6fd0', 0, -h * 0.17, w * 0.3, h * 0.015);
  const heads: [number, number, number][] = [[-0.3, 0.2, 1], [0.0, 0.3, 1.1], [0.3, 0.18, 0.95], [-0.15, 0.02, 0.9], [0.17, 0.0, 0.9], [-0.33, -0.08, 0.8], [0.35, -0.06, 0.8]];
  for (const [hx, hy, s] of heads) {
    pe(c, '#f39c12', hx * w, hy * h, w * 0.1 * s, w * 0.1 * s, 0, 0.0022);
    pe(c, '#f1c40f', hx * w + w * 0.01, hy * h + w * 0.01, w * 0.075 * s, w * 0.075 * s, 0, 0.0028);
    pe(c, '#7a4a1a', hx * w, hy * h, w * 0.04 * s, w * 0.04 * s, 0, 0.0034);
  }
  for (let i = 0; i < 5; i++) pe(c, '#5f8f2a', (-0.2 + i * 0.1) * w, -h * 0.05, w * 0.012, h * 0.08, 0.3 - i * 0.15, 0.0018);
}

function sunflower(p: THREE.Object3D, x: number, y: number, z: number, h: number, lean = 0, s = 1): void {
  const top: V3 = [x + lean, y + h, z + 0.02];
  tube(p, [[x, y, z], [x + lean * 0.4, y + h * 0.5, z], top], 0.006, 0.005, '#4f7d2a', { radial: 6, sub: 3 });
  for (let k = 0; k < 2; k++) ellip(p, '#5a8f30', x + lean * 0.3 + (k ? 0.03 : -0.03), y + h * (0.35 + k * 0.2), z + 0.005, 0.03, 0.006, 0.018, 0, 0, k ? -0.4 : 0.4);
  const q = grp(p, top[0], top[1], top[2], 0, -0.25);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    dab(q, i % 2 ? '#f6c524' : '#f2a516', Math.cos(t) * 0.038 * s, Math.sin(t) * 0.038 * s, 0, 0.02 * s, 0.009 * s, 0.004, 0, 0, t);
  }
  ellip(q, '#6b3d14', 0, 0, 0.004, 0.026 * s, 0.026 * s, 0.009);
}

const vangogh: Builder = gp => {
  const Y = figureBase(gp, '#d8c27e', '#6b5a2a');
  for (let i = 0; i < 26; i++) {
    const t = i / 26 * Math.PI * 1.1 + Math.PI * 0.95, r = 0.33 + (i % 3) * 0.035;
    const x = Math.cos(t) * r, z = Math.sin(t) * r * 0.9;
    if (z > -0.1) continue;
    rod(gp, [x, Y, z], [x + 0.005, Y + 0.08 + (i % 4) * 0.015, z], 0.0035, '#c9a23a');
    dab(gp, '#e0b84a', x + 0.005, Y + 0.09 + (i % 4) * 0.015, z, 0.006, 0.014, 0.006);
  }
  sunflower(gp, -0.28, Y, -0.16, 0.36, 0.02, 1.05);
  sunflower(gp, -0.19, Y, -0.24, 0.42, 0.03, 1.1);
  sunflower(gp, -0.34, Y, -0.04, 0.27, -0.02, 0.95);
  const c = easel(gp, 0.24, Y, 0.06, -0.6, 0.14, 0.18);
  sunflowersPainting(c, 0.14, 0.18);
  // the yellow chair
  const chx = -0.22, chz = 0.2, sy = Y + 0.09;
  const ch = grp(gp, chx, 0, chz, 0.5);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(ch, '#c99a3b', dx * 0.04, Y, dz * 0.04, 0.005, 0.09 + (dz < 0 ? 0.1 : 0), 6);
  box(ch, '#d9a93a', 0, sy, 0, 0.095, 0.01, 0.095);
  for (const k of [0.04, 0.075]) box(ch, '#c99a3b', 0, sy + k, -0.04, 0.085, 0.008, 0.008);
  const a = figure(gp, {
    y: Y, z: -0.04, x: -0.02, ry: -0.2, top: '#3e6fb3', accent: '#2e5690', shirt: '#e8e2d0', bottom: '#4a5466', outfit: 'coat', hair: '#c4622d', hairStyle: 'short',
    beard: 'full', beardColor: '#b8571f', shoes: '#4a3524', armR: { fwd: 1.2, side: 0.45, bend: 0.3 }, armL: { fwd: 0.85, side: 0.25, bend: 0.65, inward: 0.3 },
  });
  // straw hat
  const hr = a.headR, ty = a.head[1] + hr * 0.82;
  cyl(gp, '#e6c56a', a.head[0], ty, a.head[2], hr * 1.85, hr * 0.08, 20);
  cyl(gp, '#e9cc76', a.head[0], ty, a.head[2], hr * 0.98, hr * 0.62, 16);
  cyl(gp, '#3e6fb3', a.head[0], ty + hr * 0.08, a.head[2], hr * 1.0, hr * 0.14, 16);
  palette(gp, a.handL, 0.6);
  brush(gp, off(a.handR, -0.02, -0.015, -0.03), off(a.handR, 0.035, 0.02, 0.05), '#f2a516', '#7a5230', 0.003);
};

// ---------------------------------------------------------------- Frida Kahlo: flower crown, Blue House, self-portrait
function fridaPortrait(c: THREE.Object3D, w: number, h: number): void {
  pr(c, '#3f7d3a', 0, 0, w, h);
  for (let i = 0; i < 8; i++) pe(c, i % 2 ? '#5aa04a' : '#2f6a2c', (-0.4 + (i % 4) * 0.27) * w, (i < 4 ? 0.3 : -0.3) * h, w * 0.1, h * 0.05, i * 0.7, 0.002);
  box(c, '#7a2a3a', 0, -h * 0.5, 0.0025, w * 0.6, h * 0.36, 0.003);
  pe(c, '#c88a5a', 0, h * 0.02, w * 0.14, h * 0.17, 0, 0.0035);
  pe(c, '#1a1414', 0, h * 0.18, w * 0.17, h * 0.08, 0, 0.003);
  for (const [fx, col] of [[-0.12, '#d93b4b'], [0, '#f2c12e'], [0.12, '#e05a9a']] as [number, string][]) pe(c, col, fx * w, h * 0.26, w * 0.05, w * 0.05, 0, 0.0042);
  box(c, '#1a1414', 0, h * 0.06, 0.0042, w * 0.16, h * 0.012, 0.001);
  for (const s of [-1, 1]) pe(c, INK, s * w * 0.05, h * 0.035, w * 0.016, h * 0.012, 0, 0.0044);
  pe(c, '#a3243a', 0, -h * 0.06, w * 0.03, h * 0.01, 0, 0.0044);
}

const frida: Builder = gp => {
  const Y = figureBase(gp, '#d99f78', '#7a3b2a');
  for (let i = 0; i < 6; i++) { const x = -0.3 + i * 0.12; box(gp, '#c9876a', x, Y, 0, 0.002, 0.001, 2 * Math.sqrt(0.43 * 0.43 - x * x)); }
  // corner of the cobalt-blue house with green windows and a red base band
  const wy = Y, H = 0.34;
  box(gp, '#2b5fb8', -0.05, wy, -0.33, 0.6, H, 0.04);
  box(gp, '#2b5fb8', -0.33, wy, -0.13, 0.04, H * 0.8, 0.4);
  box(gp, '#2f7d4f', -0.307, wy, 0.0, 0.006, 0.16, 0.07);
  box(gp, '#a83a2a', -0.33, wy + H * 0.8, -0.13, 0.05, 0.014, 0.42);
  box(gp, '#a83a2a', -0.05, wy, -0.308, 0.6, 0.04, 0.006);
  box(gp, '#a83a2a', -0.308, wy, -0.13, 0.006, 0.04, 0.4);
  box(gp, '#a83a2a', -0.05, wy + H, -0.33, 0.62, 0.014, 0.05);
  for (const wx of [-0.18, 0.12]) {
    box(gp, '#2f7d4f', wx, wy + 0.1, -0.308, 0.075, 0.17, 0.006);
    box(gp, '#183a2a', wx, wy + 0.115, -0.304, 0.055, 0.14, 0.004);
    box(gp, '#2f7d4f', wx, wy + 0.18, -0.3, 0.06, 0.006, 0.004);
  }
  box(gp, '#2f7d4f', -0.306, wy + 0.08, -0.17, 0.006, 0.15, 0.07);
  // cacti in clay pots and a bright flower bush
  for (const [px, pz, h] of [[0.3, -0.2, 0.26], [0.36, -0.1, 0.18], [0.24, -0.26, 0.2]]) {
    cyl(gp, '#4f8a4a', px, Y, pz, 0.022, h, 8);
    ellip(gp, '#4f8a4a', px, Y + h, pz, 0.022, 0.012, 0.022);
    for (let k = 0; k < 4; k++) box(gp, '#3d7039', px + Math.cos(k * 1.57) * 0.021, Y + 0.01, pz + Math.sin(k * 1.57) * 0.021, 0.004, h - 0.02, 0.004);
  }
  lathe(gp, [[0, 0], [0.04, 0], [0.05, 0.06], [0.045, 0.065], [0, 0.065]], '#b8613a', -0.26, Y, 0.18, 12);
  for (let k = 0; k < 4; k++) ellip(gp, '#5d9a3c', -0.26 + (k - 1.5) * 0.02, Y + 0.09 + (k % 2) * 0.03, 0.18, 0.02, 0.028, 0.008, 0, 0, (k - 1.5) * 0.4);
  for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? '#e05a9a' : '#d93b4b', -0.27 + Math.cos(k) * 0.05, Y + 0.32 + Math.sin(k * 2) * 0.02, -0.29, 0.016);
  const c = easel(gp, 0.24, Y, 0.08, -0.6, 0.13, 0.16);
  fridaPortrait(c, 0.13, 0.16);
  const a = figure(gp, {
    y: Y, z: -0.02, x: -0.04, ry: -0.15, top: '#a3243a', accent: '#f2c12e', outfit: 'dress', hair: '#1a1414', hairStyle: 'bun',
    skin: '#d9a07a', shoes: '#3a2a20', armR: { fwd: 1.15, side: 0.45, bend: 0.3 }, armL: { fwd: 0.85, side: 0.25, bend: 0.65, inward: 0.3 },
  });
  // long ruffled Tehuana skirt over the dress
  const u = a.u, base = a.group.position;
  const sk = lathe(gp, [[0, 0.004], [0.205 * u, 0.004], [0.21 * u, 0.04 * u], [0.18 * u, 0.16 * u], [0.15 * u, 0.3 * u], [0.13 * u, 0.42 * u], [0, 0.42 * u]], '#2f7d55', base.x, base.y, base.z, 22);
  sk.scale.z = 0.82;
  const rf = lathe(gp, [[0.2 * u, 0.004], [0.215 * u, 0.004], [0.216 * u, 0.05 * u], [0.2 * u, 0.05 * u]], '#f4efe2', base.x, base.y, base.z, 22);
  rf.scale.z = 0.82;
  for (let i = 0; i < 7; i++) {
    const t = -0.9 + i * 0.3;
    ellip(gp, i % 2 ? '#f2c12e' : '#e05a9a', base.x + Math.sin(t) * 0.16 * u, base.y + 0.18 * u, base.z + Math.cos(t) * 0.155 * u * 0.82, 0.012, 0.012, 0.006, t);
  }
  // braided crown with flowers, joined brows, gold earrings
  const hr = a.headR;
  add(gp, g('pb-braid', () => new THREE.TorusGeometry(1, 0.28, 8, 20)), mat('#1a1414', { flat: false }), a.head[0], a.head[1] + hr * 0.7, a.head[2] - hr * 0.1, hr * 0.85, hr * 0.85, hr * 0.85, 0, Math.PI / 2 + 0.25);
  for (const [fx, col, s] of [[-0.6, '#d93b4b', 1], [-0.15, '#f2c12e', 0.85], [0.3, '#e05a9a', 1], [0.75, '#d93b4b', 0.8]] as [number, string, number][]) {
    ellip(gp, col, a.head[0] + fx * hr, a.head[1] + hr * 0.95 + (1 - Math.abs(fx)) * hr * 0.1, a.head[2] + hr * 0.2, hr * 0.32 * s, hr * 0.24 * s, hr * 0.3 * s);
    ellip(gp, shade(col, 0.7), a.head[0] + fx * hr, a.head[1] + hr * 1.0 + (1 - Math.abs(fx)) * hr * 0.1, a.head[2] + hr * 0.42, hr * 0.1 * s);
  }
  for (const s of [-1, 1]) ellip(gp, '#4d8a3a', a.head[0] + s * hr * 0.95, a.head[1] + hr * 0.8, a.head[2] + hr * 0.1, hr * 0.25, hr * 0.08, hr * 0.15, 0, 0, s * 0.5);
  box(gp, '#1a1414', a.head[0], a.head[1] + hr * 0.33, a.head[2] + hr * 0.93, hr * 0.85, hr * 0.065, hr * 0.06);
  for (const s of [-1, 1]) ellip(gp, GOLD, a.head[0] + s * hr * 1.0, a.head[1] - hr * 0.35, a.head[2] + 0.004, hr * 0.08, hr * 0.14, hr * 0.06);
  palette(gp, a.handL, 0.6, ['#d93b4b', '#f2c12e', '#2b5fb8', '#3f9b4a', '#e05a9a']);
  brush(gp, off(a.handR, -0.02, -0.015, -0.03), off(a.handR, 0.035, 0.02, 0.05), '#d93b4b', '#7a5230', 0.003);
};

// ---------------------------------------------------------------- Hans Christian Andersen: top hat, storybook, mermaid & swan
const andersen: Builder = gp => {
  const Y = figureBase(gp, '#c4ccb0', '#4f5f4a');
  pond(gp, 0, Y, 0.24, 0.36, 0.17, '#3e7896');
  // the Little Mermaid on her rock
  const mx = -0.22, mz = 0.25;
  ellip(gp, '#7d7a72', mx, Y + 0.02, mz, 0.075, 0.05, 0.06);
  ellip(gp, '#8c897f', mx + 0.03, Y + 0.035, mz - 0.02, 0.05, 0.04, 0.04);
  tube(gp, [[mx - 0.01, Y + 0.075, mz - 0.01], [mx + 0.04, Y + 0.065, mz + 0.02], [mx + 0.07, Y + 0.04, mz + 0.05], [mx + 0.05, Y + 0.03, mz + 0.08]], 0.02, 0.008, '#2fa58a', { radial: 8, sub: 3 });
  ellip(gp, '#3ec0a0', mx + 0.05, Y + 0.028, mz + 0.095, 0.022, 0.006, 0.014, 0.6);
  ellip(gp, '#f0c6a0', mx - 0.012, Y + 0.105, mz - 0.01, 0.018, 0.03, 0.015);
  ellip(gp, '#f0c6a0', mx - 0.012, Y + 0.15, mz - 0.005, 0.017);
  tube(gp, [[mx - 0.015, Y + 0.165, mz - 0.015], [mx - 0.025, Y + 0.13, mz - 0.025], [mx - 0.02, Y + 0.095, mz - 0.025]], 0.014, 0.008, '#d9541e', { radial: 7, sub: 2 });
  ellip(gp, '#d9541e', mx - 0.012, Y + 0.162, mz - 0.01, 0.018, 0.012, 0.017);
  // the swan and the little grey duckling
  goose(gp, 0.2, Y + 0.004, 0.24, -0.6, 0.9);
  const dk = grp(gp, 0.08, Y + 0.004, 0.31, -0.3);
  ellip(dk, '#9c968a', 0, 0.018, 0, 0.018, 0.015, 0.025);
  ellip(dk, '#a8a294', 0, 0.042, 0.016, 0.012);
  ellip(dk, '#d9a12e', 0, 0.04, 0.03, 0.005, 0.003, 0.007);
  const a = figure(gp, {
    h: 0.66, y: Y, z: -0.08, x: 0.0, top: '#6a4a30', accent: '#6a4a30', shirt: '#f6f3ec', bottom: '#3b2f28', outfit: 'coat', hair: '#6b4a2f', hairStyle: 'short',
    hat: 'tophat', hatColor: '#1c1c1e', shoes: '#1b1b1b', armL: { fwd: 0.95, side: 0.1, bend: 0.6, inward: 0.45 }, armR: { fwd: 1.5, side: 0.55, bend: 0.35 },
  });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) ellip(gp, '#6b4a2f', a.head[0] + s * a.headR * 1.0, a.head[1] - a.headR * (0.1 + k * 0.25), a.head[2] - a.headR * 0.2, a.headR * 0.2);
  box(gp, '#1c1c1e', a.head[0], a.head[1] - a.headR * 1.42, a.head[2] + a.headR * 0.62, a.headR * 0.5, a.headR * 0.14, a.headR * 0.08);
  openBook(gp, off(a.handL, 0.01, 0.012, 0.02), '#2f5d8a', 1.05, -0.9, 0.0);
  // a paper-cut chain of little dancers hanging from his raised hand
  for (let i = 0; i < 4; i++) {
    const py = a.handR[1] - 0.03 - i * 0.042, px = a.handR[0] + 0.005;
    ellip(gp, '#fbfaf6', px, py, a.handR[2], 0.008, 0.008, 0.002);
    box(gp, '#fbfaf6', px, py - 0.034, a.handR[2], 0.02, 0.026, 0.002);
    box(gp, '#fbfaf6', px, py - 0.012, a.handR[2], 0.034, 0.004, 0.002);
  }
};

// ---------------------------------------------------------------- Rabindranath Tagore: white beard, robe, tree school
const tagore: Builder = gp => {
  const Y = figureBase(gp, '#8fb36a', '#4f6b3a');
  // open-air classroom under a big shade tree (Santiniketan)
  const tx = -0.26, tz = -0.18;
  tube(gp, [[tx, Y, tz], [tx + 0.01, Y + 0.18, tz], [tx - 0.01, Y + 0.3, tz + 0.01]], 0.035, 0.022, '#6b4a2f', { radial: 8, sub: 3 });
  for (const [bx, bz, s] of [[-0.06, 0.02, 1.0], [0.07, 0.03, 0.9], [0.0, -0.06, 0.95], [0.02, 0.08, 0.8], [-0.1, -0.05, 0.75]]) {
    ellip(gp, shade('#3f7d3a', 0.9 + bx * 2), tx + bx, Y + 0.36 + (1 - s) * 0.05, tz + bz, 0.11 * s, 0.075 * s, 0.1 * s);
  }
  // a child reading under the tree
  const k = figure(gp, { h: 0.26, y: Y, x: tx + 0.05, z: tz + 0.12, ry: 0.5, top: '#f2c12e', outfit: 'tunic', bottom: '#f4efe2', hair: '#1a1414', skin: '#b07a52', armL: { fwd: 0.9, bend: 0.5, inward: 0.5 }, armR: { fwd: 0.9, bend: 0.5, inward: 0.5 } });
  openBook(gp, lp(k.handL, k.handR, 0.5), '#c0392b', 0.5, -0.9, 0.5);
  // lotus pond
  pond(gp, 0.22, Y, 0.2, 0.15, 0.11, '#3f8a8a');
  for (const [lx, lz] of [[0.18, 0.18], [0.28, 0.23], [0.22, 0.12]]) {
    disc(gp, '#4f9a4a', lx, Y + 0.01, lz, 0.025, 0.025, 0.003, 12);
    for (let i = 0; i < 6; i++) ellip(gp, i % 2 ? '#f6b4c8' : '#f08aa8', lx + Math.cos(i) * 0.008, Y + 0.022, lz + Math.sin(i) * 0.008, 0.007, 0.012, 0.005, i, 0.4);
  }
  const a = figure(gp, {
    y: Y, z: 0.0, x: 0.02, ry: -0.1, top: '#2c3550', accent: '#c9a86a', bottom: '#2c3550', outfit: 'robe', wideSleeves: true, skin: '#c08a60', hair: '#f1efea', hairStyle: 'long',
    beard: 'long', beardColor: '#f4f2ee', shoes: '#3a2a20', armL: { fwd: 0.95, side: 0.1, bend: 0.6, inward: 0.45 }, armR: { fwd: 1.1, side: 0.35, bend: 0.4 },
  });
  // longer flowing beard and swept-back white hair
  const hr = a.headR;
  ellip(gp, '#f4f2ee', a.head[0], a.head[1] - hr * 1.45, a.head[2] + hr * 0.75, hr * 0.62, hr * 0.95, hr * 0.38);
  ellip(gp, '#ebe8e2', a.head[0], a.head[1] - hr * 2.2, a.head[2] + hr * 0.82, hr * 0.42, hr * 0.6, hr * 0.28);
  for (const s of [-1, 1]) ellip(gp, '#ece9e3', a.head[0] + s * hr * 0.32, a.head[1] - hr * 0.55, a.head[2] + hr * 0.92, hr * 0.32, hr * 0.12, hr * 0.12, 0, 0, s * 0.35);
  openBook(gp, off(a.handL, 0.01, 0.012, 0.02), '#8a2a2a', 0.95, -0.9, 0);
  quill(gp, off(a.handR, -0.005, -0.02, 0), off(a.handR, 0.02, 0.08, 0.01));
};

// ---------------------------------------------------------------- Louis Armstrong: trumpet, hanky, French Quarter balcony
const satchmo: Builder = gp => {
  const Y = figureBase(gp, '#b9a487', '#4a3b2e');
  // French Quarter façade with a lacy iron balcony
  const fz = -0.32;
  box(gp, '#e7a8a0', -0.05, Y, fz, 0.66, 0.5, 0.05);
  for (const dx of [-0.24, -0.04, 0.16]) {
    box(gp, '#2f5a4a', dx, Y, fz + 0.026, 0.09, 0.2, 0.006);
    box(gp, '#f4efe2', dx, Y + 0.2, fz + 0.026, 0.11, 0.012, 0.008);
    box(gp, '#2f5a4a', dx, Y + 0.28, fz + 0.026, 0.08, 0.16, 0.006);
  }
  box(gp, '#1f2421', -0.05, Y + 0.25, fz + 0.025, 0.66, 0.012, 0.08);
  box(gp, '#1f2421', -0.05, Y + 0.33, fz + 0.06, 0.66, 0.007, 0.007);
  for (let i = 0; i < 23; i++) cyl(gp, '#1f2421', -0.37 + i * 0.03, Y + 0.262, fz + 0.06, 0.0025, 0.07, 4);
  for (let i = 0; i < 11; i++) add(gp, g('pb-ring', () => new THREE.TorusGeometry(1, 0.06, 4, 24)), mat('#1f2421'), -0.35 + i * 0.06, Y + 0.3, fz + 0.06, 0.012, 0.012, 0.012);
  for (const dx of [-0.36, 0.26]) cyl(gp, '#1f2421', dx, Y, fz + 0.06, 0.005, 0.25, 6);
  for (let i = 0; i < 5; i++) ellip(gp, i % 2 ? '#e05a9a' : '#5d9a3c', -0.3 + i * 0.12, Y + 0.275, fz + 0.045, 0.025, 0.018, 0.02);
  // gas street lamp
  cyl(gp, '#1f2421', 0.3, Y, -0.06, 0.008, 0.36, 8);
  cyl(gp, '#1f2421', 0.3, Y, -0.06, 0.02, 0.02, 8);
  glow(ellip(gp, '#ffe2a0', 0.3, Y + 0.385, -0.06, 0.022, 0.03, 0.022), '#ffe2a0', '#ffb84a');
  cone(gp, '#1f2421', 0.3, Y + 0.41, -0.06, 0.03, 0.03, 8);
  // music floating out of the bell
  for (const [nx, ny, nz, s] of [[0.27, 0.5, 0.18, 1.1], [0.36, 0.58, 0.05, 0.9], [0.2, 0.62, 0.0, 0.8]]) note(gp, nx, Y + ny, nz, s, '#1f2937', -0.4);
  const a = figure(gp, {
    y: Y, z: 0.04, x: -0.06, ry: 0.35, top: '#8fb4d9', accent: '#8fb4d9', shirt: '#f6f3ec', bottom: '#8fb4d9', outfit: 'suit', skin: '#6a4231', hair: '#1a1414', hairStyle: 'short',
    shoes: '#f4efe2', armL: { fwd: 1.45, side: 0.1, bend: 1.0, inward: 0.55 }, armR: { fwd: 1.45, side: 0.35, bend: 1.0, inward: 0.15 }, lean: -0.08,
  });
  const RY = 0.35, tie = offR(a.head, RY, 0, -a.headR * 1.95, a.headR * 0.62);
  box(gp, '#c0262d', tie[0], tie[1], tie[2], a.headR * 0.22, a.headR * 0.6, a.headR * 0.08, RY);
  // trumpet: mouthpiece at the lips, bell up and out to the right
  const hr = a.headR;
  const mouth: V3 = offR(a.head, RY, 0, -hr * 0.45, hr * 0.95);
  const dir: V3 = [0.55, 0.3, 0.78];
  const t = aim(gp, mouth, dir);
  cyl(t, BRASS, 0, 0, 0, 0.004, 0.01, 8).rotation.x = Math.PI / 2;
  for (const [z0, z1, r] of [[0.0, 0.14, 0.006]] as [number, number, number][]) rod(t, [0, 0, z0], [0, 0, z1], r, BRASS);
  lathe(t, [[0.006, 0], [0.012, 0.03], [0.025, 0.055], [0.034, 0.062], [0.031, 0.062], [0.02, 0.05], [0.004, 0.02]], BRASS, 0, 0, 0.14, 18).rotation.x = Math.PI / 2;
  rod(t, [0, -0.02, 0.03], [0, -0.02, 0.12], 0.006, BRASS);
  for (const z of [0.03, 0.12]) rod(t, [0, 0, z], [0, -0.02, z], 0.005, BRASS);
  for (const z of [0.06, 0.075, 0.09]) { rod(t, [0, -0.025, z], [0, 0.022, z], 0.0045, BRASS); ellip(t, '#f4efe2', 0, 0.025, z, 0.006, 0.003, 0.006); }
  t.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat(BRASS, { metal: 0.8, rough: 0.3 }); });
  // white handkerchief
  ellip(gp, '#fbfaf6', a.handL[0] - 0.01, a.handL[1] - 0.025, a.handL[2], 0.018, 0.03, 0.01, 0, 0, 0.3);
  // puffed cheeks
  for (const s of [-1, 1]) ellip(gp, '#6a4231', ...offR(a.head, RY, s * hr * 0.5, -hr * 0.3, hr * 0.62), hr * 0.32, hr * 0.28, hr * 0.28);
};

// ---------------------------------------------------------------- Miguel de Cervantes: ruff, quill, Don Quixote & windmill
function windmill(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const q = grp(p, x, y, z, ry);
  q.scale.setScalar(s);
  lathe(q, [[0, 0], [0.075, 0], [0.065, 0.24], [0, 0.24]], '#f4f1ea', 0, 0, 0, 14);
  cone(q, '#3b3b42', 0, 0.24, 0, 0.078, 0.07, 14);
  box(q, '#3b4a6a', 0, 0, 0.068, 0.035, 0.07, 0.01);
  box(q, '#3b4a6a', 0, 0.13, 0.064, 0.025, 0.035, 0.008);
  const hub = grp(q, 0, 0.25, 0.085, 0, 0, 0.35);
  cyl(hub, WOOD, 0, -0.012, 0, 0.012, 0.024, 8).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const arm = grp(hub, 0, 0, 0.01, 0, 0, (i * Math.PI) / 2);
    box(arm, WOOD, 0, 0, 0, 0.008, 0.2, 0.006);
    box(arm, '#efe6cf', 0.022, 0.05, 0, 0.034, 0.14, 0.003);
    for (let k = 0; k < 4; k++) box(arm, '#8b6a3b', 0.022, 0.06 + k * 0.035, 0.002, 0.036, 0.003, 0.003);
  }
}

function quixote(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const q = grp(p, x, y, z, ry);
  q.scale.setScalar(s);
  // Rocinante: thin, bony horse
  const H = '#c9b48f';
  for (const [lx, lz] of [[-0.02, 0.06], [0.02, 0.06], [-0.02, -0.06], [0.02, -0.06]]) cyl(q, H, lx, 0, lz, 0.007, 0.11, 6);
  ellip(q, H, 0, 0.13, 0, 0.032, 0.03, 0.085);
  tube(q, [[0, 0.14, 0.07], [0, 0.19, 0.1], [0, 0.205, 0.13]], 0.016, 0.012, H, { radial: 7, sub: 2 });
  ellip(q, H, 0, 0.2, 0.15, 0.014, 0.016, 0.03, 0, 0.5);
  for (const sx of [-1, 1]) cone(q, H, sx * 0.008, 0.215, 0.125, 0.005, 0.016, 5);
  tube(q, [[0, 0.15, -0.08], [0, 0.11, -0.11], [0, 0.06, -0.11]], 0.008, 0.003, '#8a7558', { radial: 5, sub: 2 });
  box(q, '#8a2a2a', 0, 0.155, 0, 0.068, 0.006, 0.06);
  // the knight: tall and thin, armour, shaving-basin helmet, lance
  box(q, '#9aa0a8', 0, 0.16, -0.005, 0.034, 0.08, 0.026);
  for (const sx of [-1, 1]) rod(q, [sx * 0.022, 0.165, 0], [sx * 0.03, 0.12, 0.02], 0.006, '#9aa0a8');
  ellip(q, '#e2b893', 0, 0.26, 0, 0.015, 0.018, 0.015);
  ellip(q, '#bcb6ad', 0, 0.245, 0.01, 0.009, 0.012, 0.007);
  lathe(q, [[0, 0.0], [0.024, 0.0], [0.024, 0.003], [0.017, 0.006], [0.016, 0.018], [0, 0.02]], GOLD, 0, 0.268, 0, 12);
  for (const sx of [-1, 1]) rod(q, [sx * 0.022, 0.23, 0], [sx * 0.026, 0.19, 0.02], 0.005, '#9aa0a8');
  rod(q, [0.03, 0.19, -0.08], [0.03, 0.29, 0.24], 0.004, WOOD);
  cone(q, '#c9ced6', 0.03, 0.29, 0.24, 0.006, 0.03, 6).rotation.x = 1.25;
  ellip(q, '#c9ced6', -0.03, 0.18, 0.02, 0.006, 0.03, 0.025);
}

const cervantes: Builder = gp => {
  const Y = figureBase(gp, '#d9b56e', '#7a5a2a');
  for (let i = 0; i < 9; i++) ellip(gp, '#9a9a5a', -0.3 + ((i * 37) % 60) / 100, Y, -0.32 + ((i * 53) % 30) / 100 * 0.5, 0.025, 0.012, 0.02);
  windmill(gp, -0.24, Y, -0.2, 0.5, 1.15);
  quixote(gp, 0.27, Y, 0.17, -1.85, 0.85);
  const a = figure(gp, {
    y: Y, z: 0.02, x: -0.04, ry: 0.15, top: '#1f1d22', accent: '#1f1d22', shirt: '#f6f3ec', bottom: '#1f1d22', outfit: 'suit', hair: '#6b5a48', hairStyle: 'bald',
    beard: 'full', beardColor: '#8a7558', shoes: '#141414', armL: { fwd: 0.95, side: 0.1, bend: 0.6, inward: 0.45 }, armR: { fwd: 1.05, side: 0.35, bend: 0.45 },
  });
  ruff(gp, a, 1.3);
  book(gp, a.handL[0], a.handL[1] + 0.005, a.handL[2] + 0.01, '#8a1f24', 0.06, 0.08, 0.02, 0.2);
  quill(gp, off(a.handR, -0.005, -0.02, 0), off(a.handR, 0.02, 0.09, 0.0));
  // moustache over the beard and a little bit of hair at the sides
  const hr = a.headR;
  for (const s of [-1, 1]) ellip(gp, '#7a6650', a.head[0] + s * hr * 0.3, a.head[1] - hr * 0.42, a.head[2] + hr * 0.9, hr * 0.32, hr * 0.09, hr * 0.1, 0, 0, s * -0.25);
  for (const s of [-1, 1]) ellip(gp, '#6b5a48', a.head[0] + s * hr * 0.92, a.head[1] + hr * 0.05, a.head[2] - hr * 0.2, hr * 0.18, hr * 0.32, hr * 0.38);
};

// ---------------------------------------------------------------- Gabriela Mistral: teacher-poet, chalkboard, children, Andes
const mistral: Builder = gp => {
  const Y = figureBase(gp, '#b7a77d', '#5a4a33');
  // the Elqui valley: Andes behind
  for (const [mx, mz, h, r] of [[-0.24, -0.3, 0.32, 0.16], [0.02, -0.34, 0.4, 0.18], [0.27, -0.26, 0.28, 0.15]]) {
    cone(gp, '#8a7a6a', mx, Y, mz, r, h, 9);
    cone(gp, '#f4f2ee', mx, Y + h * 0.72, mz, r * 0.28, h * 0.28 + 0.001, 9);
  }
  // chalkboard on a stand
  const bx = 0.21, bz = -0.08;
  const b = grp(gp, bx, Y, bz, -0.55);
  for (const s of [-1, 1]) box(b, WOOD, s * 0.085, 0, 0, 0.01, 0.3, 0.01);
  box(b, WOOD, 0, 0.13, 0, 0.18, 0.13, 0.012);
  box(b, '#2c4a3a', 0, 0.135, 0.007, 0.164, 0.115, 0.004);
  for (const [lx, ly, w] of [[-0.03, 0.22, 0.09], [-0.01, 0.2, 0.12], [-0.035, 0.18, 0.08], [0.0, 0.16, 0.12]]) box(b, '#f1efe8', lx, ly, 0.0095, w, 0.004, 0.001);
  box(b, '#f1efe8', 0.05, 0.145, 0.0095, 0.012, 0.012, 0.001);
  box(b, '#f1efe8', 0.065, 0.145, 0.0095, 0.012, 0.012, 0.001);
  // little school desk with an apple
  const d = grp(gp, -0.22, Y, 0.16, 0.6);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(d, WOOD, lx * 0.045, 0, lz * 0.03, 0.008, 0.1, 0.008);
  box(d, '#a8743f', 0, 0.1, 0, 0.11, 0.01, 0.075);
  ellip(d, '#c0262d', 0.02, 0.122, 0, 0.012);
  rod(d, [0.02, 0.132, 0], [0.022, 0.142, 0], 0.0015, '#4a3524');
  book(d, -0.025, 0.11, 0, '#2f6fd0', 0.04, 0.05, 0.01, 0.3);
  // two pupils listening
  const kids: [number, number, number, string, string][] = [[-0.2, 0.0, 0.6, '#e85d4a', 'bun'], [0.04, 0.24, -0.15, '#3f8ab0', 'short']];
  for (const [kx, kz, kr, c, hs] of kids) figure(gp, { h: 0.3, y: Y, x: kx, z: kz, ry: kr + Math.PI, top: c, outfit: hs === 'bun' ? 'dress' : 'tunic', bottom: '#3b4a6a', hair: '#2a1d14', hairStyle: hs as 'bun', skin: '#c99670', armL: { fwd: 0.2 }, armR: { fwd: hs === 'bun' ? 2.6 : 0.2, side: 0.2 } });
  const a = figure(gp, {
    y: Y, z: -0.06, x: -0.02, ry: 0.35, top: '#3a3a44', accent: '#3a3a44', bottom: '#3a3a44', outfit: 'dress', hair: '#8f8a84', hairStyle: 'bob', skin: '#d6a882',
    shoes: '#1b1b1b', armL: { fwd: 0.95, side: 0.1, bend: 0.6, inward: 0.45 }, armR: { fwd: 1.55, side: 0.75, bend: 0.1 },
  });
  for (const s of [-1, 1]) ellip(gp, '#f1efe8', ...offR(a.head, 0.35, s * a.headR * 0.38, -a.headR * 1.4, a.headR * 0.55), a.headR * 0.4, a.headR * 0.12, a.headR * 0.25, 0.35, 0, s * 0.4);
  openBook(gp, off(a.handL, 0.01, 0.012, 0.02), '#6b2a3a', 0.95, -0.9, 0);
};

/** lighten every diorama after building */
const lite = (b: Builder): Builder => (gp, r) => {
  b(gp, r);
  lighten(gp);
};

export const H_PEOPLE_B: Record<string, Builder> = {
  pp_libai: lite(libai), pp_quyuan: lite(quyuan), pp_wangxizhi: lite(wangxizhi), pp_murasaki: lite(murasaki), pp_hokusai: lite(hokusai), pp_davinci: lite(davinci), pp_shakespeare: lite(shakespeare), pp_mozart: lite(mozart),
  pp_beethoven: lite(beethoven), pp_vangogh: lite(vangogh), pp_frida: lite(frida), pp_andersen: lite(andersen), pp_tagore: lite(tagore), pp_satchmo: lite(satchmo), pp_cervantes: lite(cervantes), pp_mistral: lite(mistral),
};
