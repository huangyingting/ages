import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, box, cone, cyl, ellip as ellipHi, g, gable, lathe, mat, panel, archPath, prism, rbox, rod, shade, skin, slab, tube } from '../prims.ts';
import { figure, figureBase, type FigureAnchors, type FigureOpts } from '../figure.ts';

// ---------------------------------------------------------------- shared helpers (explorers, aviators, athletes...)

const metal = (m: THREE.Mesh, c: string, k = 0.6, rough = 0.35) => { m.material = mat(c, { metal: k, rough }); return m; };
/** lighten (+) / darken (−) a colour by a relative amount. */
const tint = (c: string, d: number) => shade(c, 1 + d);
const glow = (m: THREE.Mesh, c: string, e = c) => { m.material = mat(c, { emissive: e }); return m; };
/** ellipsoid with segment count scaled to its size (prims' ellip is 600+ tris, too heavy for dozens of tiny parts). */
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz);
  const s = r > 0.05 ? 16 : r > 0.028 ? 12 : r > 0.012 ? 8 : 6;
  return add(p, g('pc-sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(4, Math.round(s * 0.7)))), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
};

const bodyOf = (a: FigureAnchors) => a.group.children[0] as THREE.Group;

/** Blocky 3×5 letters (CCCP, USA, 10, 733) — readable on the big turntable and baked like the rest. */
const GLYPH: Record<string, number[][]> = {
  C: [[0, 0, 1, 5], [0, 4, 3, 1], [0, 0, 3, 1]],
  P: [[0, 0, 1, 5], [0, 4, 3, 1], [0, 2, 3, 1], [2, 2, 1, 3]],
  '1': [[1, 0, 1, 5], [0, 3, 1, 1]],
  '0': [[0, 0, 1, 5], [2, 0, 1, 5], [0, 4, 3, 1], [0, 0, 3, 1]],
  '7': [[0, 4, 3, 1], [2, 0, 1, 5]],
  '3': [[2, 0, 1, 5], [0, 4, 3, 1], [0, 2, 3, 1], [0, 0, 3, 1]],
  U: [[0, 0, 1, 5], [2, 0, 1, 5], [0, 0, 3, 1]],
  S: [[0, 4, 3, 1], [0, 2, 1, 3], [0, 2, 3, 1], [2, 0, 1, 3], [0, 0, 3, 1]],
  A: [[0, 0, 1, 5], [2, 0, 1, 5], [0, 4, 3, 1], [0, 2, 3, 1]],
};
function letters(p: THREE.Object3D, s: string, c: string, x: number, y: number, z: number, cell: number, ry = 0, rx = 0, depth = cell * 0.5): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.set(rx, ry, 0, 'YXZ');
  p.add(grp);
  const W = s.length * 4 - 1;
  [...s].forEach((ch, i) => {
    for (const [gx, gy, gw, gh] of GLYPH[ch] ?? []) box(grp, c, (i * 4 + gx + gw / 2 - W / 2) * cell, (gy - 2.5) * cell, 0, gw * cell, gh * cell, depth);
  });
  return grp;
}

/** Flag cloth hanging from a pole top at (x,y,z): w wide (+x), h tall; `paint` adds the design on the given group. */
function flag(p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, base: string, paint?: (f: THREE.Group, w: number, h: number) => void, ry = 0): THREE.Group {
  const f = new THREE.Group();
  f.position.set(x, y - h, z);
  f.rotation.y = ry;
  p.add(f);
  box(f, base, w / 2, 0, 0, w, h, 0.004);
  paint?.(f, w, h);
  return f;
}
// design layers are slightly thicker than the cloth so they show on both sides
const band = (f: THREE.Group, c: string, x: number, y: number, w: number, h: number) => box(f, c, x, y, 0, w, h, 0.0055);
const NO = (f: THREE.Group, w: number, h: number) => {
  band(f, '#ffffff', w * 0.36, 0, w * 0.16, h); band(f, '#ffffff', w / 2, h * 0.4, w, h * 0.2);
  box(f, '#1e3a8a', w * 0.36, 0, 0, w * 0.08, h, 0.0068); box(f, '#1e3a8a', w / 2, h * 0.45, 0, w, h * 0.1, 0.0068);
};
const US = (f: THREE.Group, w: number, h: number) => {
  for (let i = 0; i < 7; i += 2) band(f, '#ffffff', w / 2, h * (i + 0.5) / 7.5, w, h / 7.5);
  box(f, '#1e3a8a', w * 0.2, h * 0.47, 0, w * 0.4, h * 0.53, 0.0068);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) box(f, '#ffffff', w * (0.06 + j * 0.095), h * (0.56 + i * 0.14), 0, w * 0.03, w * 0.03, 0.0075);
};

/** Snowy / grassy mound: a smooth lathe hill. */
function mound(p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, h: number, seg = 16): THREE.Mesh {
  return lathe(p, [[r, 0], [r * 0.85, h * 0.25], [r * 0.55, h * 0.75], [r * 0.25, h * 0.97], [0, h]], c, x, y, z, seg);
}

/** Simple pebbles / rocks scattered by a fixed pattern. */
function rocks(p: THREE.Object3D, c: string, pts: [number, number, number][], y: number): void {
  pts.forEach(([x, z, s], i) => ellip(p, tint(c, (i % 3) * 0.06 - 0.04), x, y + s * 0.3, z, s, s * 0.6, s * 0.8, i * 1.3));
}

// ---------------------------------------------------------------- ship / vehicles / props

/** Ming treasure ship (宝船): bluff hull, high stern castle, five battened red sails, eye on the bow. */
function treasureShip(p: THREE.Object3D, cx: number, cy: number, cz: number, L: number): void {
  const W = L * 0.12, D = L * 0.085, n = 10;
  const sheer = (t: number) => D * (0.5 + 0.7 * Math.pow(Math.abs(2 * t - 1), 2.4) + (t > 0.5 ? 0.45 * (2 * t - 1) : 0));
  const rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = cx + (t - 0.5) * L, w = W * (0.6 + 0.4 * Math.sin(Math.PI * t)), s = sheer(t), d = D * (0.3 + 0.7 * Math.sin(Math.PI * t));
    rings.push([[x, cy + s, cz - w], [x, cy + s * 0.25, cz - w * 0.98], [x, cy - d * 0.6, cz - w * 0.72], [x, cy - d, cz], [x, cy - d * 0.6, cz + w * 0.72], [x, cy + s * 0.25, cz + w * 0.98], [x, cy + s, cz + w]]);
  }
  skin(p, rings, '#5b3a23', {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      const t = (x - cx) / L + 0.5, s = cy + sheer(Math.min(1, Math.max(0, t)));
      if (ny > 0.75) return '#b08254';
      if (y > s - D * 0.28) return '#a3321f';
      if (y > s - D * 0.42) return '#e0b44c';
      return Math.floor((y - cy) * 160) % 2 ? '#5b3a23' : '#4d311e';
    },
  });
  // bow eye on the visible flank
  const bx = cx - L * 0.43, by = cy + sheer(0.07) * 0.45;
  ellip(p, '#f5f0e1', bx, by, cz + W * 0.62, 0.022, 0.014, 0.008);
  ellip(p, '#111827', bx + 0.004, by, cz + W * 0.66, 0.009, 0.009, 0.006);
  // stern castle with gallery and a curved roof
  const sx = cx + L * 0.37, sy = cy + sheer(0.87);
  rbox(p, '#8a2e1e', sx, sy, cz, L * 0.16, 0.05, W * 1.6, 0.006);
  for (let i = 0; i < 5; i++) box(p, '#e0b44c', sx - L * 0.06 + i * L * 0.03, sy + 0.012, cz + W * 0.8, 0.008, 0.022, 0.004);
  gable(p, L * 0.19, 0.03, W * 1.9, '#3f3a36', sx, sy + 0.05, cz);
  rbox(p, '#8a2e1e', cx - L * 0.4, cy + sheer(0.1), cz, L * 0.1, 0.025, W * 1.4, 0.005);
  box(p, '#4d311e', cx + L * 0.5, cy - D * 0.6, cz, 0.012, D * 1.3, 0.008); // rudder
  // masts & sails (fore-and-aft battened junk sails seen broadside)
  const masts: [number, number, number][] = [[0.14, 0.2, 0.08], [0.3, 0.3, 0.11], [0.48, 0.36, 0.13], [0.65, 0.3, 0.11], [0.8, 0.22, 0.085]];
  masts.forEach(([t, h, sw], i) => {
    const mx = cx + (t - 0.5) * L, my = cy + sheer(t);
    rod(p, [mx, my, cz], [mx, my + h, cz], 0.0045, '#3b2a1d', 5);
    const sail = slab(p, [[-sw * 0.62, 0], [sw * 0.38, 0], [sw * 0.42, h * 0.8], [-sw * 0.05, h * 0.86], [-sw * 0.58, h * 0.74]], 0.004, tint('#b5452b', (i % 2) * 0.06), 0, false);
    sail.position.set(mx, my + h * 0.12, cz + 0.006);
    for (let k = 1; k <= 5; k++) box(p, '#4a2a1b', mx - sw * 0.1, my + h * 0.12 + (h * 0.78) * (k / 6), cz + 0.006, sw * 0.98, 0.0035, 0.009);
    box(p, '#e0b44c', mx + 0.012, my + h - 0.02, cz, 0.024, 0.014, 0.003);
  });
}

/** Kneeling Bactrian camel with silk bales — used for Marco Polo. Faces +x locally. */
function camel(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number): void {
  // standing two-humped Bactrian camel of the Silk Road, head toward +x
  const c = '#b48a5a', d = tint(c, -0.22), grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  ellip(grp, c, 0, 0.42, 0, 0.24, 0.1, 0.11);
  for (const hx of [-0.1, 0.08]) ellip(grp, d, hx, 0.52, 0, 0.075, 0.09, 0.065);
  for (const sz of [-1, 1]) for (const lx of [-0.15, 0.14]) {
    tube(grp, [[lx, 0.4, sz * 0.06], [lx + 0.015, 0.21, sz * 0.06], [lx, 0.02, sz * 0.06]], 0.045, 0.024, c, { radial: 6, sub: 3 });
    ellip(grp, d, lx + 0.015, 0.21, sz * 0.06, 0.026, 0.026, 0.024);
    ellip(grp, d, lx + 0.015, 0.012, sz * 0.06, 0.032, 0.012, 0.026);
  }
  tube(grp, [[0.18, 0.44, 0], [0.28, 0.44, 0], [0.33, 0.56, 0], [0.35, 0.66, 0]], 0.06, 0.04, c, { radial: 8, sub: 4 });
  for (let i = 0; i < 4; i++) ellip(grp, d, 0.24 + i * 0.03, 0.4 + i * 0.05, 0, 0.03, 0.04, 0.04);
  ellip(grp, c, 0.39, 0.68, 0, 0.075, 0.042, 0.042, 0, 0, -0.2);
  ellip(grp, tint(c, -0.12), 0.45, 0.66, 0, 0.03, 0.03, 0.034);
  for (const sz of [-1, 1]) { ellip(grp, '#1f1a17', 0.4, 0.7, sz * 0.036, 0.01); ellip(grp, c, 0.36, 0.72, sz * 0.03, 0.012, 0.02, 0.008); }
  tube(grp, [[-0.23, 0.44, 0], [-0.27, 0.32, 0]], 0.012, 0.008, d, { radial: 4, sub: 2 });
  // red saddle cloth between the humps and blue/gold bales of silk on both flanks
  box(grp, '#9b1c1c', -0.01, 0.5, 0, 0.09, 0.012, 0.25);
  for (const sz of [-1, 1]) {
    const b1 = cyl(grp, sz > 0 ? '#2563eb' : '#e0b44c', 0, 0.38, sz * 0.14, 0.045, 0.14, 10); b1.rotation.z = Math.PI / 2;
    box(grp, '#7c5a3a', 0, 0.4, sz * 0.14, 0.012, 0.095, 0.095);
  }
  rod(grp, [0.43, 0.66, 0], [0.5, 0.35, 0.12], 0.003, '#7c5a3a', 3);
}

/** Date palm. */
function palm(p: THREE.Object3D, x: number, y: number, z: number, h: number): void {
  tube(p, [[x, y, z], [x + h * 0.06, y + h * 0.5, z], [x + h * 0.02, y + h, z]], h * 0.05, h * 0.035, '#8a6a45', { radial: 7, sub: 6 });
  for (let i = 0; i < 4; i++) ellip(p, '#6b4f35', x + h * 0.05, y + h * (0.2 + i * 0.2), z, h * 0.055, h * 0.02, h * 0.055);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, tx = x + h * 0.02, ty = y + h;
    tube(p, [[tx, ty, z], [tx + Math.cos(a) * h * 0.22, ty + h * 0.08, z + Math.sin(a) * h * 0.22], [tx + Math.cos(a) * h * 0.4, ty - h * 0.08, z + Math.sin(a) * h * 0.4]], h * 0.045, h * 0.008, i % 2 ? '#4d7c2f' : '#5d8f38', { radial: 4, sub: 4, squash: 0.25 });
  }
  for (let i = 0; i < 3; i++) ellip(p, '#b45309', x + h * 0.02 + Math.cos(i * 2) * h * 0.05, y + h * 0.93, z + Math.sin(i * 2) * h * 0.05, h * 0.03);
}

/** Small husky lying / standing. Faces +x. */
function husky(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, c = '#6b7280'): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  ellip(grp, c, 0, 0.2, 0, 0.2, 0.09, 0.085);
  ellip(grp, '#f1f5f9', 0.02, 0.16, 0, 0.17, 0.06, 0.07);
  for (const lx of [-0.13, 0.12]) for (const sz of [-1, 1]) tube(grp, [[lx, 0.16, sz * 0.05], [lx, 0.02, sz * 0.05]], 0.03, 0.025, '#e5e7eb', { radial: 6, sub: 1 });
  ellip(grp, c, 0.22, 0.3, 0, 0.08, 0.075, 0.07);
  ellip(grp, '#f1f5f9', 0.3, 0.27, 0, 0.06, 0.035, 0.04);
  ellip(grp, '#111827', 0.355, 0.285, 0, 0.015);
  for (const sz of [-1, 1]) { cone(grp, c, 0.2, 0.35, sz * 0.04, 0.025, 0.06, 4); ellip(grp, '#1e3a8a', 0.28, 0.32, sz * 0.035, 0.01); }
  tube(grp, [[-0.18, 0.24, 0], [-0.26, 0.34, 0], [-0.2, 0.4, 0]], 0.035, 0.02, c, { radial: 7, sub: 4 });
}

/** Lunar module (descent stage in gold foil, faceted ascent stage). */
function lunarModule(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, cx = Math.cos(a), cz = Math.sin(a);
    rod(grp, [cx * 0.2, 0.3, cz * 0.2], [cx * 0.42, 0.04, cz * 0.42], 0.016, '#c9c9c9');
    rod(grp, [cx * 0.25, 0.16, cz * 0.25], [cx * 0.4, 0.07, cz * 0.4], 0.009, '#9ca3af');
    cyl(grp, '#d1d5db', cx * 0.43, 0, cz * 0.43, 0.06, 0.02, 10);
  }
  metal(cyl(grp, '#d4a52c', 0, 0.13, 0, 0.27, 0.22, 8), '#d6a83a', 0.55, 0.3);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    metal(box(grp, '#b8862a', Math.cos(a) * 0.255, 0.15, Math.sin(a) * 0.255, 0.04, 0.18, 0.02, -a + Math.PI / 2), '#a87b25', 0.6, 0.25);
  }
  box(grp, '#111111', 0, 0.35, 0, 0.36, 0.02, 0.34);
  // ascent stage
  const asc = '#b8bcc2';
  prism(grp, [[-0.17, 0.12], [0.17, 0.12], [0.2, 0], [0.17, -0.14], [-0.17, -0.14], [-0.2, 0]], 0.37, 0.2, asc);
  prism(grp, [[-0.12, 0.2], [0.12, 0.2], [0.15, 0.12], [-0.15, 0.12]], 0.4, 0.15, tint(asc, 0.06));
  for (const sx of [-1, 1]) box(grp, '#111827', sx * 0.06, 0.48, 0.196, 0.06, 0.05, 0.01, 0, 0, sx * 0.3);
  box(grp, '#3f3f46', 0, 0.4, 0.2, 0.08, 0.07, 0.01);
  rod(grp, [0.1, 0.57, -0.05], [0.18, 0.68, -0.05], 0.008, '#d1d5db');
  const dish = lathe(grp, [[0, 0], [0.06, 0.02], [0.065, 0.025], [0, 0.008]], '#e5e7eb', 0.18, 0.68, -0.05, 10);
  dish.rotation.z = -0.8;
  // ladder down the front leg
  for (let i = 0; i < 5; i++) box(grp, '#c9c9c9', 0.24, 0.06 + i * 0.05, 0.24, 0.06, 0.008, 0.008, -Math.PI / 4);
}

/** Vostok rocket on its pad: R-7 core + four tapering boosters, Vostok sphere on top. */
function vostokRocket(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.scale.set(s * 1.25, s, s * 1.25); p.add(grp);
  const W = '#e5e7eb', G = '#6b7280';
  cyl(grp, '#9ca3af', 0, 0, 0, 0.13, 0.025, 14);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, bx = Math.cos(a) * 0.052, bz = Math.sin(a) * 0.052;
    lathe(grp, [[0, 0.035], [0.034, 0.035], [0.036, 0.06], [0.03, 0.2], [0.018, 0.33], [0.008, 0.37], [0, 0.375]], W, bx, 0, bz, 10);
    lathe(grp, [[0.031, 0.1], [0.0345, 0.1], [0.033, 0.13], [0.03, 0.13]], G, bx, 0, bz, 10);
    for (let j = 0; j < 2; j++) cyl(grp, '#374151', bx + Math.cos(a + j * 1.6) * 0.012, 0.022, bz + Math.sin(a + j * 1.6) * 0.012, 0.009, 0.015, 6);
  }
  lathe(grp, [[0, 0.03], [0.03, 0.03], [0.028, 0.15], [0.036, 0.36], [0.036, 0.5], [0, 0.5]], W, 0, 0, 0, 12);
  lathe(grp, [[0.0365, 0.44], [0.0375, 0.44], [0.0375, 0.47], [0.0365, 0.47]], G, 0, 0, 0, 12);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; rod(grp, [Math.cos(a) * 0.033, 0.5, Math.sin(a) * 0.033], [Math.cos(a + 0.5) * 0.033, 0.53, Math.sin(a + 0.5) * 0.033], 0.003, '#374151', 4); }
  lathe(grp, [[0, 0.53], [0.036, 0.53], [0.036, 0.6], [0.03, 0.62], [0, 0.62]], W, 0, 0, 0, 12);
  // the Vostok sphere and its nose
  ellip(grp, '#cbd5e1', 0, 0.665, 0, 0.045);
  ellip(grp, '#1f2937', 0, 0.67, 0.042, 0.012, 0.012, 0.006);
  cone(grp, W, 0, 0.705, 0, 0.022, 0.07, 10);
  rod(grp, [0, 0.77, 0], [0, 0.82, 0], 0.003, '#9ca3af', 4);
  // service tower
  for (const sx of [-1, 1]) rod(grp, [sx * 0.11, 0.02, -0.08], [sx * 0.11, 0.58, -0.08], 0.006, '#b91c1c', 4);
  for (let i = 0; i < 6; i++) rod(grp, [-0.11, 0.06 + i * 0.1, -0.08], [0.11, 0.06 + i * 0.1, -0.08], 0.004, '#b91c1c', 4);
  for (let i = 0; i < 2; i++) rod(grp, [0.11, 0.3 + i * 0.2, -0.08], [0.04, 0.3 + i * 0.2, -0.02], 0.004, '#b91c1c', 4);
}

/** Red Lockheed Vega 5B: round monocoque fuselage, thick high wing, NACA cowl, spatted wheels. Nose +x. */
function vega(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  const R = '#c81e1e', GOLD = '#e8b931';
  const fus = lathe(grp, [[0, -0.5], [0.012, -0.5], [0.03, -0.38], [0.06, -0.15], [0.078, 0.05], [0.082, 0.2], [0.075, 0.33], [0.07, 0.36], [0, 0.36]], R, 0, 0, 0, 16);
  fus.rotation.z = -Math.PI / 2; fus.position.y = 0.2;
  // gold speed stripe on both flanks
  for (const sz of [-1, 1]) ellip(grp, GOLD, -0.02, 0.2, sz * 0.074, 0.38, 0.016, 0.01);
  // cowl, engine, propeller
  const cowl = lathe(grp, [[0.06, 0.34], [0.085, 0.36], [0.088, 0.42], [0.07, 0.44], [0.04, 0.44]], '#2b2b2b', 0, 0, 0, 16);
  cowl.rotation.z = -Math.PI / 2; cowl.position.y = 0.2;
  ellip(grp, '#9ca3af', 0.46, 0.2, 0, 0.03);
  for (const k of [0, 1]) metal(box(grp, '#a1a1aa', 0.475, 0.2, 0, 0.012, 0.3, 0.03, 0, k * 1.2, 0), '#c0c0c0');
  // high cantilever wing with rounded tips
  rbox(grp, R, 0.08, 0.275, 0, 0.17, 0.03, 0.9, 0.012);
  for (const sz of [-1, 1]) ellip(grp, R, 0.08, 0.29, sz * 0.45, 0.085, 0.016, 0.03);
  for (const sz of [-1, 1]) ellip(grp, GOLD, 0.08, 0.305, sz * 0.25, 0.07, 0.004, 0.15);
  // windows
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) box(grp, '#1e293b', 0.18 - i * 0.07, 0.22, sz * 0.077, 0.04, 0.03, 0.01);
  box(grp, '#1e293b', 0.27, 0.25, 0, 0.03, 0.035, 0.1, 0, 0, 0.5);
  // tail
  const fin = slab(grp, [[0, 0], [0.12, 0], [0.04, 0.13], [-0.02, 0.14]], 0.012, R, 0, false); fin.position.set(-0.52, 0.22, 0);
  box(grp, R, -0.48, 0.22, 0, 0.09, 0.012, 0.3);
  // landing gear with streamlined spats
  for (const sz of [-1, 1]) {
    rod(grp, [0.18, 0.15, sz * 0.05], [0.18, 0.06, sz * 0.13], 0.008, '#3f3f46');
    ellip(grp, R, 0.18, 0.05, sz * 0.14, 0.06, 0.04, 0.022);
    const w = cyl(grp, '#111827', 0.18, 0, sz * 0.14, 0.022, 0.014, 10); w.rotation.x = Math.PI / 2; w.position.y = 0.022;
  }
  rod(grp, [-0.42, 0.16, 0], [-0.44, 0.03, 0], 0.005, '#3f3f46', 4);
  ellip(grp, '#111827', -0.44, 0.02, 0, 0.018, 0.018, 0.008);
}

const ring = (p: THREE.Object3D, c: string, x: number, y: number, z: number, R: number, rx = 0, ry = 0, rz = 0, k = 0.12) =>
  add(p, g('pc-torus' + k, () => new THREE.TorusGeometry(1, k, 6, 18)), mat(c), x, y, z, R, R, R, ry, rx, rz);

/** Seven-storey square brick pagoda (Big Wild Goose Pagoda in Xi'an). */
function goosePagoda(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.scale.setScalar(s); p.add(grp);
  const B = '#c7a77c';
  box(grp, tint(B, -0.1), 0, 0, 0, 0.34, 0.06, 0.34);
  let yy = 0.06;
  for (let i = 0; i < 7; i++) {
    const w = 0.26 * (1 - i * 0.075), h = (i === 0 ? 0.14 : 0.1) * (1 - i * 0.03);
    box(grp, tint(B, (i % 2) * 0.04), 0, yy, 0, w, h, w);
    for (const [ax, az, ry] of [[0, w / 2, 0], [w / 2, 0, Math.PI / 2], [0, -w / 2, 0], [-w / 2, 0, Math.PI / 2]] as const)
      box(grp, '#3a2a20', ax, yy + h * 0.25, az, w * 0.16, h * 0.5, 0.012, ry);
    for (const sx of [-1, 1]) box(grp, tint(B, -0.06), sx * w * 0.32, yy, w / 2 + 0.003, 0.012, h, 0.008);
    box(grp, '#8a6a4a', 0, yy + h, 0, w + 0.05, 0.016, w + 0.05);
    box(grp, '#9c7a56', 0, yy + h + 0.016, 0, w + 0.02, 0.01, w + 0.02);
    yy += h + 0.026;
  }
  cone(grp, '#8a6a4a', 0, yy, 0, 0.06, 0.06, 4, Math.PI / 4);
  cyl(grp, '#6b5640', 0, yy + 0.05, 0, 0.012, 0.08, 6);
  ellip(grp, '#c9a24a', 0, yy + 0.14, 0, 0.022);
}

/** Tiny stylised animals for Hua Tuo's Five Animal Frolics (五禽戏). Each faces +x, ~0.1 tall at s = 1. */
function frolic(p: THREE.Object3D, kind: 'tiger' | 'deer' | 'bear' | 'monkey' | 'crane', x: number, y: number, z: number, s: number, ry: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  const legs = (c: string, h: number, xs: number[], zs: number, r: number) => { for (const lx of xs) for (const sz of [-1, 1]) cyl(grp, c, lx, 0, sz * zs, r, h, 6); };
  if (kind === 'tiger') {
    const O = '#e07a1f';
    ellip(grp, O, 0, 0.09, 0, 0.11, 0.045, 0.045);
    ellip(grp, '#f8efe0', 0.01, 0.07, 0, 0.09, 0.025, 0.035);
    legs(O, 0.07, [-0.07, 0.07], 0.025, 0.014);
    ellip(grp, O, 0.12, 0.11, 0, 0.045, 0.042, 0.042);
    ellip(grp, '#f8efe0', 0.155, 0.1, 0, 0.022, 0.018, 0.026);
    ellip(grp, '#111827', 0.175, 0.105, 0, 0.007);
    for (const sz of [-1, 1]) { ellip(grp, O, 0.11, 0.15, sz * 0.025, 0.013); ellip(grp, '#111827', 0.15, 0.125, sz * 0.017, 0.006); }
    for (let i = 0; i < 5; i++) box(grp, '#1f1a17', -0.08 + i * 0.035, 0.07, 0, 0.008, 0.05, 0.094);
    for (let i = 0; i < 2; i++) box(grp, '#1f1a17', 0.105 + i * 0.012, 0.135, 0, 0.004, 0.012, 0.05);
    tube(grp, [[-0.1, 0.1, 0], [-0.16, 0.13, 0], [-0.18, 0.19, 0]], 0.012, 0.008, O, { radial: 6, sub: 4 });
    ellip(grp, '#1f1a17', -0.18, 0.195, 0, 0.01);
  } else if (kind === 'deer') {
    const D = '#a8693a';
    ellip(grp, D, 0, 0.13, 0, 0.09, 0.04, 0.038);
    legs(D, 0.11, [-0.06, 0.06], 0.02, 0.008);
    tube(grp, [[0.06, 0.14, 0], [0.1, 0.22, 0]], 0.022, 0.016, D, { radial: 7, sub: 2 });
    ellip(grp, D, 0.12, 0.235, 0, 0.035, 0.022, 0.02, 0, 0, -0.3);
    ellip(grp, '#2b211b', 0.15, 0.225, 0, 0.007);
    for (const sz of [-1, 1]) {
      rod(grp, [0.1, 0.25, sz * 0.01], [0.09, 0.32, sz * 0.04], 0.004, '#7c5a3a', 4);
      rod(grp, [0.095, 0.29, sz * 0.03], [0.12, 0.33, sz * 0.03], 0.003, '#7c5a3a', 4);
      ellip(grp, D, 0.09, 0.26, sz * 0.025, 0.015, 0.008, 0.006);
    }
    for (let i = 0; i < 5; i++) ellip(grp, '#f5e6c8', -0.05 + i * 0.022, 0.15 + (i % 2) * 0.012, 0.035, 0.006);
    ellip(grp, '#f5e6c8', -0.09, 0.15, 0, 0.012);
  } else if (kind === 'bear') {
    const Bc = '#4a3222';
    ellip(grp, Bc, 0, 0.09, 0, 0.1, 0.07, 0.07);
    legs(Bc, 0.05, [-0.055, 0.055], 0.04, 0.02);
    ellip(grp, Bc, 0.1, 0.13, 0, 0.05);
    ellip(grp, '#c9a27a', 0.145, 0.12, 0, 0.022, 0.018, 0.022);
    ellip(grp, '#111827', 0.165, 0.125, 0, 0.007);
    for (const sz of [-1, 1]) { ellip(grp, Bc, 0.09, 0.175, sz * 0.03, 0.016); ellip(grp, '#111827', 0.135, 0.145, sz * 0.02, 0.006); }
  } else if (kind === 'monkey') {
    const M = '#8b5a2b';
    ellip(grp, M, 0, 0.07, 0, 0.04, 0.055, 0.04);
    ellip(grp, M, 0.005, 0.15, 0, 0.038);
    ellip(grp, '#e8c39e', 0.035, 0.145, 0, 0.015, 0.025, 0.026);
    for (const sz of [-1, 1]) { ellip(grp, '#e8c39e', 0.0, 0.16, sz * 0.04, 0.012, 0.016, 0.006); ellip(grp, '#111827', 0.045, 0.155, sz * 0.01, 0.005); }
    for (const sz of [-1, 1]) tube(grp, [[0.0, 0.1, sz * 0.035], [0.04, 0.08, sz * 0.04], [0.06, 0.12, sz * 0.03]], 0.011, 0.009, M, { radial: 6, sub: 3 });
    for (const sz of [-1, 1]) ellip(grp, M, 0.03, 0.02, sz * 0.025, 0.035, 0.018, 0.018);
    tube(grp, [[-0.03, 0.03, 0], [-0.1, 0.01, 0.02], [-0.12, 0.05, 0.05], [-0.09, 0.08, 0.06]], 0.008, 0.006, M, { radial: 5, sub: 6 });
  } else {
    const W = '#f8fafc';
    ellip(grp, W, 0, 0.17, 0, 0.065, 0.04, 0.035, 0, 0, 0.15);
    ellip(grp, '#1f2937', -0.065, 0.17, 0, 0.035, 0.025, 0.03, 0, 0, 0.3);
    for (const sz of [-1, 1]) rod(grp, [0.0, 0.14, sz * 0.012], [0.0, 0, sz * 0.012], 0.004, '#1f2937', 4);
    tube(grp, [[0.04, 0.18, 0], [0.07, 0.24, 0], [0.06, 0.3, 0]], 0.012, 0.009, W, { radial: 6, sub: 4 });
    ellip(grp, W, 0.07, 0.31, 0, 0.016, 0.014, 0.013);
    ellip(grp, '#dc2626', 0.068, 0.322, 0, 0.007);
    cone(grp, '#9a7b4f', 0.1, 0.305, 0, 0.005, 0.05, 5).rotation.z = -Math.PI / 2;
    const wing = slab(grp, [[0, 0], [0.06, 0.02], [0.02, 0.1], [-0.05, 0.06]], 0.006, W, 0, false);
    wing.position.set(0, 0.18, 0.035); wing.rotation.x = -0.4;
  }
}

/** Sankore mosque miniature: mud-brick walls and a stepped pyramidal tower bristling with wooden toron. */
function sankore(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  const A = '#b77d48', T = '#6b4a2b';
  rbox(grp, A, -0.08, 0, 0.02, 0.4, 0.12, 0.26, 0.012);
  for (let i = 0; i < 9; i++) { cone(grp, tint(A, -0.04), -0.26 + i * 0.045, 0.12, 0.15, 0.012, 0.035, 5); cone(grp, tint(A, -0.04), -0.26 + i * 0.045, 0.12, -0.11, 0.012, 0.035, 5); }
  for (let i = 0; i < 3; i++) box(grp, '#3a2a1c', -0.2 + i * 0.1, 0.0, 0.151, 0.04, 0.06, 0.01);
  for (let i = 0; i < 5; i++) rod(grp, [-0.25 + i * 0.09, 0.09, 0.15], [-0.25 + i * 0.09, 0.09, 0.19], 0.004, T, 4);
  const tower = lathe(grp, [[0, 0], [0.13, 0], [0.11, 0.12], [0.085, 0.26], [0.065, 0.36], [0, 0.36]], A, 0.17, 0, 0, 4);
  tower.rotation.y = Math.PI / 4;
  cone(grp, tint(A, 0.05), 0.17, 0.36, 0, 0.045, 0.07, 4, Math.PI / 4);
  ellip(grp, tint(A, 0.05), 0.17, 0.44, 0, 0.018);
  // toron rows on the two visible faces
  for (let r = 0; r < 5; r++) {
    const ty = 0.05 + r * 0.065, half = 0.13 - (ty / 0.36) * 0.065;
    for (let i = -2; i <= 2; i++) {
      const off = (i / 2.5) * half * 0.8;
      rod(grp, [0.17 + off, ty, half * 0.68], [0.17 + off, ty, half * 0.68 + 0.04], 0.004, T, 4);
      rod(grp, [0.17 + half * 0.68, ty, off], [0.17 + half * 0.68 + 0.04, ty, off], 0.004, T, 4);
    }
  }
}

// ---------------------------------------------------------------- builders

const BUILDERS: Record<string, Builder> = {
  /** Admiral Zheng He on a stone quay, a five-masted treasure ship behind him. */
  pp_zhenghe: gp => {
    const y = figureBase(gp, '#3d8ec4', '#5b4636');
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.14 + (i % 5) * 0.06; ellip(gp, '#a5d8f3', Math.cos(a) * r, y + 0.001, -Math.abs(Math.sin(a)) * r - 0.04, 0.028, 0.0025, 0.006, a); }
    const quay: [number, number][] = [];
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; quay.push([Math.cos(a) * 0.445, 0.02 + Math.sin(a) * 0.425]); }
    prism(gp, quay, y, 0.03, '#bfae8c');
    for (let i = 0; i < 9; i++) box(gp, tint('#bfae8c', (i % 2) * -0.08), -0.4 + i * 0.1, y, 0.01, 0.098, 0.031, 0.025);
    for (const bx of [-0.3, 0.3]) { cyl(gp, '#4b4038', bx, y + 0.03, 0.06, 0.016, 0.03, 8); ellip(gp, '#4b4038', bx, y + 0.06, 0.06, 0.02, 0.01, 0.02); }
    tube(gp, [[0.3, y + 0.05, 0.06], [0.28, y + 0.03, -0.04], [0.22, y + 0.02, -0.15]], 0.004, 0.004, '#c8a46a', { radial: 4, sub: 3 });
    treasureShip(gp, 0.02, y + 0.012, -0.24, 0.62);
    const yf = y + 0.03, o: FigureOpts = {
      y: yf, x: -0.03, z: 0.2, top: '#b3261e', accent: '#e4b54a', outfit: 'robe', wideSleeves: true, hair: '#1c1917', hat: 'futou', hatColor: '#1c1917',
      armL: { fwd: 0.75, side: 0.15, bend: 0.8, inward: 0.4 }, armR: { fwd: 1.3, side: 0.5, bend: 0.05 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // mandarin-square rank badge and jade belt plaques
    box(b, '#e4b54a', 0, 0.55 * u, 0.082 * u, 0.11 * u, 0.1 * u, 0.008 * u);
    box(b, '#1e40af', 0, 0.57 * u, 0.087 * u, 0.08 * u, 0.06 * u, 0.004 * u);
    ellip(b, '#f8fafc', 0.0, 0.6 * u, 0.09 * u, 0.02 * u, 0.012 * u, 0.004 * u);
    for (const sx of [-0.06, 0, 0.06]) box(b, '#4ade80', sx * u, 0.51 * u, 0.088 * u, 0.025 * u, 0.025 * u, 0.006 * u);
    // brass compass (luopan) in the left hand
    const [lx, ly, lz] = a.handL;
    rbox(gp, '#8b4513', lx + 0.01, ly + 0.012, lz + 0.02, 0.07, 0.012, 0.07, 0.004);
    metal(cyl(gp, '#d4a72c', lx + 0.01, ly + 0.024, lz + 0.02, 0.028, 0.004, 14), '#d4a72c');
    box(gp, '#dc2626', lx + 0.01, ly + 0.029, lz + 0.02, 0.004, 0.003, 0.04, 0.5);
    // rolled sea chart in the pointing hand
    const [rx, ry, rz] = a.handR;
    const sc = cyl(gp, '#efe2c0', rx, ry - 0.045, rz + 0.01, 0.012, 0.09, 8); sc.rotation.z = 0.2;
    for (const d of [-1, 1]) ellip(gp, '#7c2d12', rx - d * 0.009, ry + d * 0.045, rz + 0.01, 0.014, 0.006, 0.014);
  },

  /** The monk Xuanzang walking west with his bamboo book-frame, Big Wild Goose Pagoda behind. */
  pp_xuanzang: gp => {
    const y = figureBase(gp, '#dcc492', '#7a5b3a');
    mound(gp, '#d2b57c', -0.27, y, -0.2, 0.17, 0.07);
    mound(gp, '#cdae74', -0.08, y, -0.33, 0.11, 0.04);
    for (let i = 0; i < 6; i++) ellip(gp, tint('#a8957a', (i % 3) * 0.05), -0.05 + Math.sin(i * 1.7) * 0.05, y + 0.003, 0.4 - i * 0.07, 0.035, 0.006, 0.025, i);
    rocks(gp, '#8f7b63', [[0.3, 0.22, 0.03], [0.34, 0.15, 0.02], [-0.33, 0.12, 0.025], [-0.25, 0.26, 0.018]], y);
    for (const [tx, tz] of [[-0.36, 0.0], [0.38, 0.05], [0.2, 0.33]]) for (let k = 0; k < 5; k++) rod(gp, [tx, y, tz], [tx + Math.cos(k * 1.3) * 0.02, y + 0.04, tz + Math.sin(k * 1.3) * 0.02], 0.003, '#8a9a4a', 3);
    goosePagoda(gp, 0.25, y, -0.2, 0.5);
    const o: FigureOpts = {
      y, x: -0.04, z: 0.1, skin: '#e3b48b', top: '#7f7c3f', accent: '#2c4a7c', outfit: 'robe', wideSleeves: true, hair: '#b88d6c', hairStyle: 'bald',
      armL: { fwd: 0.7, side: 0.1, bend: 0.85, inward: 0.45 }, armR: { fwd: 0.85, side: 0.35, bend: 0.25 },
    };
    const a = figure(gp, o), F = a.group, b = bodyOf(a), u = a.u;
    // prayer beads
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2, cz = Math.cos(t);
      ellip(b, i % 4 ? '#6b3f1d' : '#c08a3e', Math.sin(t) * 0.1 * u, 0.765 * u - 0.075 * u * Math.max(0, cz), cz * 0.08 * u, 0.016 * u);
    }
    // bamboo book-frame (笈) on his back, with sutra scrolls and boxes and a canopy
    const xw = 0.14 * u, z0 = -0.1 * u, z1 = -0.28 * u, yb = 0.16 * u, yt = 1.16 * u, BAM = '#a8873f';
    for (const sx of [-1, 1]) for (const zz of [z0, z1]) rod(F, [sx * xw, yb, zz], [sx * xw, yt, zz], 0.009 * u, BAM, 5);
    for (const sy of [0.3, 0.56, 0.82, 1.08]) {
      for (const zz of [z0, z1]) rod(F, [-xw, sy * u, zz], [xw, sy * u, zz], 0.007 * u, BAM, 4);
      for (const sx of [-1, 1]) rod(F, [sx * xw, sy * u, z0], [sx * xw, sy * u, z1], 0.007 * u, BAM, 4);
    }
    const cols = ['#9b2c2c', '#1e40af', '#efe2c0', '#2f6b4f'];
    for (let r = 0; r < 3; r++) {
      const sy = [0.3, 0.56, 0.82][r] * u;
      if (r === 1) { rbox(F, '#7c2d12', 0, sy, (z0 + z1) / 2, xw * 1.8, 0.2 * u, (z0 - z1) * 0.9, 0.01 * u); box(F, '#e4b54a', 0, sy + 0.08 * u, z1 - 0.004, xw * 1.2, 0.03 * u, 0.006 * u); continue; }
      for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) {
        const sc = cyl(F, cols[(k + j + r) % 4], 0, sy + 0.045 * u + k * 0.075 * u, z0 - 0.045 * u - j * 0.09 * u, 0.035 * u, xw * 1.9, 8);
        sc.rotation.z = Math.PI / 2; sc.position.x = 0; sc.position.y = sy + 0.045 * u + k * 0.075 * u;
      }
    }
    const can = box(F, '#5f7a3a', 0, yt, -0.06 * u, 0.4 * u, 0.018 * u, 0.42 * u); can.rotation.x = -0.12;
    for (let i = 0; i < 9; i++) box(F, i % 2 ? '#9b2c2c' : '#2f6b4f', (-0.18 + i * 0.045) * u, yt - 0.06 * u, 0.15 * u, 0.04 * u, 0.06 * u, 0.008 * u);
    rod(F, [-0.16 * u, yt, 0.1 * u], [-0.34 * u, yt + 0.08 * u, 0.3 * u], 0.007 * u, BAM, 4);
    rod(F, [-0.34 * u, yt + 0.08 * u, 0.3 * u], [-0.34 * u, yt - 0.04 * u, 0.3 * u], 0.002 * u, '#3f2d1f', 3);
    glow(cyl(F, '#ffd27a', -0.34 * u, yt - 0.12 * u, 0.3 * u, 0.03 * u, 0.07 * u, 6), '#ffd27a', '#f59e0b');
    cone(F, '#c9a24a', -0.34 * u, yt - 0.05 * u, 0.3 * u, 0.045 * u, 0.04 * u, 6);
    for (const sx of [-1, 1]) tube(b, [[sx * 0.07 * u, 0.78 * u, 0.06 * u], [sx * 0.1 * u, 0.8 * u, -0.03 * u], [sx * 0.12 * u, 0.62 * u, -0.1 * u]], 0.012 * u, 0.012 * u, '#3f2d1f', { radial: 5, sub: 4 });
    // fly-whisk and sutra scroll
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.01, rz], [rx + 0.02, ry + 0.08, rz + 0.03], 0.005, '#7c2d12', 5);
    tube(gp, [[rx + 0.02, ry + 0.08, rz + 0.03], [rx + 0.045, ry + 0.06, rz + 0.06], [rx + 0.05, ry - 0.02, rz + 0.07]], 0.012, 0.004, '#f3f4f6', { radial: 6, sub: 4 });
    const [lx, ly, lz] = a.handL;
    const sc = cyl(gp, '#efe2c0', lx + 0.03, ly - 0.005, lz + 0.015, 0.014, 0.1, 8); sc.rotation.z = Math.PI / 2; sc.position.set(lx + 0.03, ly, lz + 0.015);
    box(gp, '#9b2c2c', lx + 0.03, ly - 0.015, lz + 0.015, 0.01, 0.03, 0.031);
  },

  /** Hua Tuo, the healer, with herbs, a medicine gourd and the five animals of his exercises around him. */
  pp_huatuo: gp => {
    const y = figureBase(gp, '#9dbf6c', '#6b5640');
    for (let i = 0; i < 5; i++) ellip(gp, tint('#b9ad94', (i % 2) * 0.06), 0.02 + Math.sin(i) * 0.03, y + 0.003, 0.42 - i * 0.075, 0.04, 0.006, 0.03, i);
    // herb beds
    for (const [hx, hz] of [[-0.18, -0.3], [0.05, -0.36], [0.22, -0.32]] as const) {
      ellip(gp, '#6b4a2f', hx, y, hz, 0.075, 0.012, 0.05);
      for (let k = 0; k < 4; k++) { ellip(gp, k % 2 ? '#4d7c2f' : '#65a30d', hx + (k - 1.5) * 0.03, y + 0.025, hz, 0.018, 0.022, 0.016); }
      ellip(gp, '#dc2626', hx + 0.02, y + 0.045, hz + 0.01, 0.006);
    }
    // bronze mortar & pestle, drying basket
    lathe(gp, [[0, 0], [0.035, 0], [0.045, 0.03], [0.04, 0.05], [0.033, 0.05], [0.03, 0.02], [0, 0.015]], '#8b6b3a', 0.14, y, 0.3, 14);
    rod(gp, [0.14, y + 0.03, 0.3], [0.17, y + 0.1, 0.28], 0.007, '#6b5640');
    lathe(gp, [[0, 0], [0.07, 0], [0.075, 0.015], [0.068, 0.015], [0, 0.005]], '#c39b5f', -0.14, y, 0.3, 16);
    for (let k = 0; k < 5; k++) ellip(gp, k % 2 ? '#a16207' : '#65a30d', -0.14 + Math.cos(k * 1.3) * 0.035, y + 0.014, 0.3 + Math.sin(k * 1.3) * 0.03, 0.015, 0.005, 0.01);
    // the five animals
    frolic(gp, 'tiger', 0.3, y, 0.05, 0.85, Math.PI * 0.85);
    frolic(gp, 'deer', -0.32, y, -0.05, 0.85, 0.3);
    frolic(gp, 'bear', 0.26, y, -0.2, 0.85, Math.PI * 0.7);
    frolic(gp, 'monkey', -0.3, y, 0.18, 0.9, -0.4);
    frolic(gp, 'crane', -0.12, y, -0.26, 0.85, -0.3);
    const o: FigureOpts = {
      y, x: 0.02, z: 0.06, top: '#ddd5c1', accent: '#46586a', bottom: '#cfc6b0', outfit: 'robe', wideSleeves: true, hair: '#d6d3d1', hairStyle: 'topknot',
      beard: 'long', beardColor: '#f1efe9', skin: '#e2b088',
      armL: { fwd: 0.4, side: 0.2, bend: 0.7, inward: 0.1 }, armR: { fwd: 1.25, side: 0.35, bend: 0.9 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // medicine gourd on the belt
    ellip(b, '#c27c2c', 0.14 * u, 0.42 * u, 0.07 * u, 0.04 * u, 0.045 * u, 0.04 * u);
    ellip(b, '#c27c2c', 0.14 * u, 0.49 * u, 0.07 * u, 0.028 * u);
    box(b, '#dc2626', 0.14 * u, 0.515 * u, 0.07 * u, 0.012 * u, 0.04 * u, 0.012 * u);
    // herb sprig held up
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.02, rz], [rx + 0.01, ry + 0.09, rz + 0.01], 0.0035, '#3f6212', 4);
    for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? '#4d7c0f' : '#65a30d', rx + (k % 2 ? 0.014 : -0.012), ry + 0.02 + k * 0.012, rz + 0.01, 0.014, 0.006, 0.008, 0, 0, k % 2 ? -0.6 : 0.6);
    ellip(gp, '#f472b6', rx + 0.01, ry + 0.095, rz + 0.01, 0.01);
    // woven herb basket in the left hand
    const [lx, ly, lz] = a.handL;
    lathe(gp, [[0, 0], [0.04, 0], [0.05, 0.035], [0.047, 0.04], [0.038, 0.01], [0, 0.008]], '#b08850', lx, ly - 0.06, lz + 0.02, 12);
    ring(gp, '#8a6a3e', lx, ly - 0.015, lz + 0.02, 0.04, 0, 0, 0, 0.08);
    for (let k = 0; k < 5; k++) ellip(gp, k % 2 ? '#4d7c0f' : '#84cc16', lx + Math.cos(k * 1.3) * 0.022, ly - 0.025, lz + 0.02 + Math.sin(k * 1.3) * 0.022, 0.016, 0.01, 0.012);
  },

  /** Marco Polo with his travel book and quill, a laden Bactrian camel and a Venetian mooring post behind. */
  pp_marcopolo: gp => {
    const y = figureBase(gp, '#dcc394', '#7a5b3a');
    // a corner of a Venetian canal with a gondola and striped mooring posts
    const wat = lathe(gp, [[0, 0], [0.17, 0], [0.17, 0.004], [0, 0.004]], '#2f7fb5', 0.25, y, -0.2, 20); wat.scale.z = 0.75;
    for (let i = 0; i < 7; i++) box(gp, '#a8957a', 0.25 + Math.cos(Math.PI * 0.55 + i * 0.32) * 0.175, y, -0.2 + Math.sin(Math.PI * 0.55 + i * 0.32) * 0.13, 0.04, 0.012, 0.02, -(Math.PI * 0.55 + i * 0.32));
    const gon = ellip(gp, '#111827', 0.26, y + 0.012, -0.21, 0.11, 0.012, 0.022, 0.5);
    void gon;
    metal(box(gp, '#d1d5db', 0.26 - Math.cos(0.5) * 0.11, y + 0.012, -0.21 + Math.sin(0.5) * 0.11, 0.004, 0.03, 0.016, 0.5), '#d1d5db');
    for (const [px, pz] of [[0.12, -0.08], [0.16, -0.06]] as const) for (let k = 0; k < 4; k++) cyl(gp, k % 2 ? '#f8fafc' : '#b91c1c', px, y + k * 0.04, pz, 0.01, 0.04, 8);
    camel(gp, -0.22, y, -0.16, 0.52, 0.35);
    // trade goods
    rbox(gp, '#7c4a1e', 0.3, y, 0.15, 0.1, 0.06, 0.07, 0.006);
    metal(box(gp, '#d4a72c', 0.3, y + 0.03, 0.186, 0.02, 0.02, 0.004), '#d4a72c');
    for (const [sx, sc] of [[0.2, '#c2410c'], [0.25, '#a16207']] as const) { lathe(gp, [[0, 0], [0.03, 0], [0.033, 0.04], [0.02, 0.06], [0.008, 0.07], [0, 0.07]], sc, sx, y, 0.28, 10); }
    const o: FigureOpts = {
      y, x: -0.02, z: 0.1, top: '#8f1d1d', accent: '#d4b26a', bottom: '#5a1414', outfit: 'robe', cape: '#5a1414', hair: '#5a3a22', hairStyle: 'short',
      beard: 'full', beardColor: '#5a3a22', armL: { fwd: 0.85, side: 0.12, bend: 0.65, inward: 0.3 }, armR: { fwd: 0.85, side: 0.2, bend: 0.75, inward: 0.45 },
    };
    const a = figure(gp, o), hr = a.headR;
    // tall Venetian cap with a fur brim
    const [hx, hy, hz] = a.head;
    lathe(gp, [[0, 0], [hr * 1.02, 0], [hr * 1.06, hr * 0.4], [hr * 0.92, hr * 0.9], [hr * 0.55, hr * 1.18], [0, hr * 1.22]], '#b91c1c', hx, hy + hr * 0.42, hz - hr * 0.08, 16);
    lathe(gp, [[hr * 1.0, 0], [hr * 1.16, 0.0], [hr * 1.18, hr * 0.12], [hr * 1.14, hr * 0.26], [hr * 1.0, hr * 0.26]], '#7c5a3a', hx, hy + hr * 0.4, hz - hr * 0.08, 16);
    // open travel journal
    const [lx, ly, lz] = a.handL, [rx, rY, rz] = a.handR;
    const cx = (lx + rx) / 2 - 0.01, cy = Math.max(ly, rY) + 0.01, cz = (lz + rz) / 2 + 0.03;
    box(gp, '#5b3a1d', cx, cy - 0.006, cz, 0.13, 0.006, 0.09, 0, -0.5);
    for (const sx of [-1, 1]) { box(gp, '#f5ecd6', cx + sx * 0.031, cy, cz, 0.058, 0.006, 0.082, 0, -0.5, sx * 0.12); for (let k = 0; k < 4; k++) box(gp, '#6b5640', cx + sx * 0.031, cy + 0.0035, cz - 0.02 + k * 0.012 - 0.006, 0.04, 0.003, 0.003, 0, -0.5, sx * 0.12); }
    // quill
    const q = slab(gp, [[0, 0], [0.012, 0.03], [0.008, 0.09], [-0.002, 0.1], [-0.006, 0.04]], 0.003, '#f8fafc', 0, true);
    q.position.set(rx + 0.005, rY, rz + 0.01); q.rotation.z = -0.4;
  },

  /** Ibn Battuta from Tangier: turban, travelling staff and a map of his routes, a city gate and palm behind. */
  pp_ibnbattuta: gp => {
    const y = figureBase(gp, '#e2c690', '#8a6a45');
    mound(gp, '#d8b77c', 0.25, y, 0.2, 0.15, 0.03);
    // Moroccan city gate (bab) with horseshoe arch and green tile band
    const gz = -0.27, gate = '#c97b4a';
    panel(gp, 0.42, 0.3, 0.07, gate, [archPath(0, 0, 0.13, 0.22, true)], -0.04, y, gz);
    box(gp, '#2f8f7a', -0.04, y + 0.235, gz + 0.036, 0.22, 0.03, 0.004);
    for (let i = 0; i < 9; i++) box(gp, i % 2 ? '#1d4ed8' : '#f8fafc', -0.04 - 0.088 + i * 0.022, y + 0.242, gz + 0.039, 0.01, 0.014, 0.003);
    for (let i = 0; i < 8; i++) box(gp, tint(gate, 0.06), -0.04 - 0.19 + i * 0.054, y + 0.3, gz, 0.03, 0.035, 0.07);
    for (const sx of [-1, 1]) { box(gp, tint(gate, -0.05), -0.04 + sx * 0.2, y, gz, 0.07, 0.36, 0.09); for (let i = 0; i < 2; i++) box(gp, tint(gate, 0.06), -0.04 + sx * 0.2 - 0.02 + i * 0.04, y + 0.36, gz, 0.025, 0.03, 0.09); }
    lathe(gp, [[0.07, 0], [0.075, 0], [0.075, 0.012], [0.07, 0.012]], '#e4b54a', -0.04, y + 0.15, gz + 0.04, 18).rotation.x = Math.PI / 2;
    palm(gp, 0.3, y, -0.08, 0.36);
    // water jar and travel bags
    lathe(gp, [[0, 0], [0.02, 0], [0.035, 0.03], [0.032, 0.06], [0.015, 0.08], [0.018, 0.09], [0, 0.09]], '#b45f3a', -0.3, y, 0.18, 12);
    rbox(gp, '#7c4a1e', -0.24, y, 0.27, 0.07, 0.045, 0.05, 0.012);
    box(gp, '#b91c1c', -0.24, y + 0.02, 0.296, 0.07, 0.008, 0.004);
    const o: FigureOpts = {
      y, x: -0.03, z: 0.08, top: '#efe6cf', accent: '#8a6a3e', outfit: 'robe', cape: '#7a4e2d', hair: '#2b211b', hat: 'turban', hatColor: '#f4f1e8',
      beard: 'full', beardColor: '#2b211b', skin: '#d39c74', armL: { fwd: 1.0, side: 0.1, bend: 0.5, inward: 0.25 }, armR: { fwd: 0.3, side: 0.3, bend: 0.5 },
    };
    const a = figure(gp, o);
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, y, rz], [rx, ry + 0.2, rz], 0.008, '#7a5230', 6);
    ellip(gp, '#5b3a1d', rx, ry + 0.205, rz, 0.014);
    // the map: parchment with seas, coasts and a dotted route
    const [lx, ly, lz] = a.handL;
    const m = new THREE.Group(); m.position.set(lx + 0.05, ly + 0.02, lz + 0.02); m.rotation.set(-0.35, -0.25, 0); gp.add(m);
    box(m, '#ecdcae', 0, -0.045, 0, 0.13, 0.09, 0.004);
    box(m, '#7fb3d5', -0.03, -0.035, 0.003, 0.05, 0.05, 0.002); box(m, '#7fb3d5', 0.04, -0.03, 0.003, 0.04, 0.04, 0.002);
    box(m, '#9cbf6c', 0.01, -0.04, 0.0035, 0.02, 0.07, 0.002); box(m, '#9cbf6c', -0.05, -0.04, 0.0035, 0.02, 0.03, 0.002);
    for (let i = 0; i < 7; i++) box(m, '#b91c1c', -0.055 + i * 0.018, -0.02 + Math.sin(i) * 0.012, 0.004, 0.007, 0.007, 0.002);
    for (const sx of [-1, 1]) { const r2 = cyl(m, '#d9c08a', sx * 0.068, -0.045, 0, 0.007, 0.095, 6); r2.position.y = 0; }
  },

  /** Mansa Musa of Mali with golden sceptre and nugget, the Sankore mosque of Timbuktu and his treasures. */
  pp_mansamusa: gp => {
    const y = figureBase(gp, '#d9a868', '#7a4a26');
    mound(gp, '#d09a5c', -0.25, y, -0.28, 0.16, 0.04);
    sankore(gp, 0.06, y, -0.24, 0.62, -0.2);
    // gold bars, an open chest and manuscripts of Timbuktu
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) metal(rbox(gp, '#e0b23c', -0.3 + i * 0.045 + r * 0.022, y + r * 0.022, 0.16, 0.04, 0.022, 0.06, 0.004), '#e0b23c', 0.75, 0.3);
    rbox(gp, '#7c2d12', 0.28, y, 0.14, 0.11, 0.06, 0.08, 0.008);
    box(gp, '#7c2d12', 0.28, y + 0.06, 0.1, 0.11, 0.06, 0.012, 0, -0.5);
    for (let k = 0; k < 6; k++) metal(ellip(gp, '#f2c94c', 0.25 + (k % 3) * 0.03, y + 0.065, 0.13 + Math.floor(k / 3) * 0.025, 0.017), '#f2c94c', 0.75, 0.3);
    for (let k = 0; k < 4; k++) rbox(gp, ['#7c2d12', '#e8dcc0', '#14532d', '#e8dcc0'][k], -0.2, y + k * 0.018, 0.32, 0.08, 0.017, 0.06, 0.004);
    const o: FigureOpts = {
      y, x: 0.0, z: 0.06, skin: '#5b3a24', top: '#f3ead6', accent: '#d4a017', bottom: '#e8dcc0', outfit: 'robe', cape: '#9a3412', hair: '#1c1917',
      hat: 'crown', beard: 'short', beardColor: '#1c1917', wideSleeves: true,
      armL: { fwd: 1.2, side: 0.45, bend: 0.6 }, armR: { fwd: 0.35, side: 0.25, bend: 0.5 },
    };
    const a = figure(gp, o);
    const [rx, ry, rz] = a.handR, G = '#e0b23c';
    metal(rod(gp, [rx, y + 0.005, rz], [rx, ry + 0.22, rz], 0.008, G, 6), G, 0.8, 0.3);
    metal(ellip(gp, G, rx, ry + 0.235, rz, 0.02), G, 0.8, 0.3);
    for (const d of [-1, 0, 1]) metal(cone(gp, G, rx + d * 0.018, ry + 0.245 + (d ? 0 : 0.01), rz, 0.008, d ? 0.03 : 0.045, 6), G, 0.8, 0.3);
    const [lx, ly, lz] = a.handL;
    metal(ellip(gp, '#f2c94c', lx, ly + 0.035, lz + 0.01, 0.03, 0.028, 0.028), '#f2c94c', 0.85, 0.25);
  },

  /** Roald Amundsen on skis in his fur anorak, Polheim tent with the Norwegian flag and a dog sled at the Pole. */
  pp_amundsen: gp => {
    const y = figureBase(gp, '#eef4f8', '#8fa4b8');
    for (let i = 0; i < 7; i++) ellip(gp, i % 2 ? '#e2eaf1' : '#f8fbfd', Math.cos(i * 2.2) * 0.33, y, Math.sin(i * 2.2) * 0.3, 0.08, 0.018, 0.035, i * 0.9);
    // Polheim tent + flag
    const tx = -0.22, tz = -0.2;
    cone(gp, '#a8a29e', tx, y, tz, 0.13, 0.25, 8);
    slab(gp, [[-0.035, 0], [0.035, 0], [0, 0.1]], 0.004, '#3f3a36', 0, false).position.set(tx + 0.0, y, tz + 0.115);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; rod(gp, [tx + Math.cos(a) * 0.04, y + 0.18, tz + Math.sin(a) * 0.04], [tx + Math.cos(a) * 0.19, y, tz + Math.sin(a) * 0.19], 0.002, '#57534e', 3); }
    rod(gp, [tx, y + 0.24, tz], [tx, y + 0.38, tz], 0.004, '#6b5640', 5);
    flag(gp, tx + 0.004, y + 0.375, tz, 0.1, 0.07, '#c8102e', NO);
    // sled with two huskies
    const sx0 = 0.22, sz0 = -0.16;
    for (const d of [-1, 1]) tube(gp, [[sx0 - 0.15, y + 0.006, sz0 + d * 0.05], [sx0 + 0.12, y + 0.006, sz0 + d * 0.05], [sx0 + 0.16, y + 0.03, sz0 + d * 0.05]], 0.005, 0.005, '#7c5a3a', { radial: 5, sub: 4 });
    for (let i = 0; i < 6; i++) box(gp, '#a07a4f', sx0 - 0.13 + i * 0.045, y + 0.02, sz0, 0.025, 0.006, 0.12);
    rbox(gp, '#5b4636', sx0 - 0.05, y + 0.026, sz0, 0.16, 0.06, 0.1, 0.01);
    box(gp, '#c8b48a', sx0 - 0.05, y + 0.086, sz0, 0.17, 0.01, 0.11);
    husky(gp, 0.3, y, 0.05, 0.42, -Math.PI / 2 + 0.3, '#6b7280');
    husky(gp, 0.17, y, 0.16, 0.38, -Math.PI / 2 - 0.4, '#3f3f46');
    tube(gp, [[sx0 + 0.15, y + 0.03, sz0], [0.27, y + 0.06, 0.0]], 0.002, 0.002, '#57534e', { radial: 3, sub: 2 });
    // skis under the figure
    const fx = -0.03, fz = 0.1;
    for (const d of [-1, 1]) {
      box(gp, '#9a6b3c', fx + d * 0.035, y, fz - 0.03, 0.024, 0.006, 0.42);
      box(gp, '#9a6b3c', fx + d * 0.035, y + 0.006, fz + 0.19, 0.024, 0.005, 0.05, 0, -0.5);
    }
    const o: FigureOpts = {
      y: y + 0.006, x: fx, z: fz, top: '#8b7355', bottom: '#5b4a3a', accent: '#6b5640', shirt: '#d8ccb8', outfit: 'coat', shoes: '#4a3b2f',
      hair: '#d4d4d4', hairStyle: 'short', skin: '#e2b391',
      armL: { fwd: 0.45, side: 0.35, bend: 0.35 }, armR: { fwd: 0.45, side: 0.35, bend: 0.35 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR;
    // fur ruff around the face (hood), fur cuffs and hem
    const hy = 0.9 * u;
    ellip(b, '#7a6650', 0, hy + 0.1 * hr, -0.25 * hr, 1.25 * hr, 1.3 * hr, 1.0 * hr);
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      ellip(b, tint('#e4d9c6', (i % 3) * -0.05), Math.cos(t) * 1.12 * hr, hy + Math.sin(t) * 1.2 * hr - 0.05 * hr, 0.35 * hr, 0.34 * hr, 0.3 * hr, 0.3 * hr, t);
    }
    for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; ellip(b, '#d8ccb8', Math.cos(t) * 0.14 * u, 0.25 * u, Math.sin(t) * 0.1 * u, 0.035 * u, 0.025 * u, 0.035 * u); }
    for (const h of [a.handL, a.handR]) {
      ellip(gp, '#4a3b2f', h[0], h[1], h[2], 0.028, 0.032, 0.028);
      rod(gp, [h[0], h[1] + 0.03, h[2]], [h[0] + Math.sign(h[0] - fx) * 0.05, y, h[2] + 0.03], 0.0035, '#3f3a36', 4);
      ring(gp, '#3f3a36', h[0] + Math.sign(h[0] - fx) * 0.047, y + 0.025, h[2] + 0.028, 0.02, Math.PI / 2, 0, 0, 0.1);
    }
  },

  /** Edmund Hillary at base camp: anorak, oxygen bottles, ice axe and rope, an Everest-like peak and a tent behind. */
  pp_hillary: gp => {
    const y = figureBase(gp, '#eef2f6', '#7f8ea3');
    // Himalayan peak with snow
    const pk = lathe(gp, [[0, 0], [0.22, 0], [0.16, 0.12], [0.09, 0.27], [0.03, 0.38], [0, 0.4]], '#6b7280', 0.1, y, -0.26, 5); pk.rotation.y = 0.3;
    const sn = lathe(gp, [[0, 0.2], [0.115, 0.2], [0.09, 0.27], [0.032, 0.38], [0, 0.405]], '#f8fafc', 0.1, y + 0.002, -0.26, 5); sn.rotation.y = 0.3; sn.scale.set(1.04, 1, 1.04);
    const p2 = lathe(gp, [[0, 0], [0.15, 0], [0.08, 0.15], [0, 0.24]], '#78716c', -0.15, y, -0.3, 5); p2.rotation.y = 1.1;
    const s2 = lathe(gp, [[0, 0.12], [0.1, 0.12], [0.05, 0.19], [0, 0.245]], '#f1f5f9', -0.15, y + 0.002, -0.3, 5); s2.rotation.y = 1.1; s2.scale.set(1.05, 1, 1.05);
    for (let i = 0; i < 6; i++) ellip(gp, '#e2e8f0', Math.cos(i * 2.1) * 0.32, y, Math.sin(i * 2.1) * 0.2 + 0.1, 0.07, 0.016, 0.04, i);
    // orange ridge tent and supplies
    const tent = new THREE.Group(); tent.position.set(-0.28, y, -0.02); tent.rotation.y = 0.6; gp.add(tent);
    prism(tent, [[-0.07, -0.1], [0.07, -0.1], [0.07, 0.1], [-0.07, 0.1]], 0, 0.005, '#c2410c');
    const t1 = slab(tent, [[-0.08, 0], [0.08, 0], [0, 0.11]], 0.2, '#ea580c', 0, false); void t1;
    box(tent, '#7c2d12', 0, 0, 0.101, 0.04, 0.07, 0.004);
    for (let i = 0; i < 3; i++) metal(cyl(gp, '#f97316', 0.3 + (i % 2) * 0.02, y, 0.05 + i * 0.045, 0.018, 0.08, 10), '#f97316', 0.4, 0.4).rotation.z = i ? Math.PI / 2 : 0;
    rbox(gp, '#8b6b3a', 0.3, y, 0.22, 0.09, 0.06, 0.07, 0.006);
    ring(gp, '#d97706', 0.2, y + 0.012, 0.3, 0.045, Math.PI / 2, 0, 0, 0.16);
    const o: FigureOpts = {
      y, x: 0.0, z: 0.1, top: '#356fb3', accent: '#1e3a5f', bottom: '#5b5048', shoes: '#2b211b', outfit: 'tunic', hair: '#4a3426', hairStyle: 'short',
      armL: { fwd: 0.6, side: 0.2, bend: 0.4, inward: 0.15 }, armR: { fwd: 0.3, side: 0.3, bend: 0.4 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    // woolly hat + goggles pushed up
    ellip(b, '#b91c1c', 0, hy + 0.45 * hr, -0.06 * hr, 1.1 * hr, 0.8 * hr, 1.1 * hr);
    lathe(b, [[1.08 * hr, 0], [1.14 * hr, 0], [1.14 * hr, 0.25 * hr], [1.06 * hr, 0.25 * hr]], '#f8fafc', 0, hy + 0.25 * hr, -0.04 * hr, 16);
    ellip(b, '#f8fafc', 0, hy + 1.3 * hr, -0.1 * hr, 0.3 * hr);
    for (const sx of [-1, 1]) { ellip(b, '#1f2937', sx * 0.36 * hr, hy + 0.72 * hr, 0.92 * hr, 0.26 * hr, 0.2 * hr, 0.1 * hr); ellip(b, '#7dd3fc', sx * 0.36 * hr, hy + 0.72 * hr, 0.98 * hr, 0.17 * hr, 0.12 * hr, 0.06 * hr); }
    // oxygen set on his back with a hose
    rbox(b, '#6b5640', 0, 0.48 * u, -0.13 * u, 0.24 * u, 0.3 * u, 0.06 * u, 0.012);
    for (const sx of [-1, 1]) { metal(cyl(b, '#f97316', sx * 0.055 * u, 0.44 * u, -0.17 * u, 0.045 * u, 0.36 * u, 12), '#f97316', 0.45, 0.4); ellip(b, '#9ca3af', sx * 0.055 * u, 0.81 * u, -0.17 * u, 0.025 * u); }
    tube(b, [[0.05 * u, 0.8 * u, -0.16 * u], [0.15 * u, 0.72 * u, 0.02 * u], [0.08 * u, 0.6 * u, 0.1 * u]], 0.01 * u, 0.01 * u, '#1f2937', { radial: 5, sub: 4 });
    // ice axe planted beside him
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx + 0.02, y, rz + 0.02], [rx, ry + 0.04, rz], 0.006, '#8b5a2b', 6);
    metal(box(gp, '#9ca3af', rx, ry + 0.035, rz, 0.012, 0.012, 0.09, 0.2), '#a1a1aa');
    metal(cone(gp, '#a1a1aa', rx + 0.02, y, rz + 0.02, 0.006, 0.02, 5), '#a1a1aa');
    // rope coil over the left shoulder
    ring(gp, '#d97706', a.handL[0] + 0.01, a.handL[1] + 0.02, a.handL[2] + 0.01, 0.045, 0.2, 0, 0.3, 0.16);
    ring(b, '#d97706', -0.02 * u, 0.62 * u, 0.0, 0.17 * u, 0.15, 0, -0.8, 0.12);
  },

  /** Tenzing Norgay on the summit, ice axe raised with four flags, prayer flags fluttering behind. */
  pp_tenzing: gp => {
    const y = figureBase(gp, '#e9eff5', '#7f8ea3');
    const top = 0.11;
    const prof: [number, number][] = [[0.43, 0], [0.4, 0.025], [0.3, 0.06], [0.2, 0.085], [0.1, 0.104], [0, top]];
    lathe(gp, prof, '#f8fafc', 0, y, 0, 18);
    const hAt = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      for (let i = 1; i < prof.length; i++) if (r >= prof[i][0]) { const t = (r - prof[i][0]) / (prof[i - 1][0] - prof[i][0]); return y + prof[i][1] + (prof[i - 1][1] - prof[i][1]) * t; }
      return y + top;
    };
    // dark rock ridges breaking through the snow, with snow caps
    for (const [rx0, rz0, rh, rr, rot] of [[-0.3, -0.12, 0.13, 0.07, 0.3], [-0.22, -0.26, 0.09, 0.055, 1.1], [0.3, -0.02, 0.1, 0.06, 0.7], [0.24, 0.24, 0.06, 0.045, 0.2]] as const) {
      const yb = hAt(rx0, rz0) - 0.01;
      cone(gp, '#4b4f57', rx0, yb, rz0, rr, rh, 5, rot);
      cone(gp, '#f1f5f9', rx0, yb + rh * 0.55, rz0, rr * 0.5, rh * 0.47, 5, rot);
    }
    // bootprints climbing to the top, a spent oxygen bottle and a coil of rope
    for (let i = 0; i < 7; i++) {
      const t = i / 7, px = 0.06 - t * 0.02 + (i % 2 ? 0.025 : -0.025), pz = 0.38 - t * 0.3;
      ellip(gp, '#cbd5e1', px, hAt(px, pz) + 0.001, pz, 0.012, 0.003, 0.02);
    }
    const ob = cyl(gp, '#f97316', -0.18, 0, 0.22, 0.02, 0.1, 10); ob.rotation.set(0, 0.5, Math.PI / 2); ob.position.y = hAt(-0.18, 0.22) + 0.015;
    ring(gp, '#ca8a04', 0.2, hAt(0.2, 0.12) + 0.006, 0.12, 0.035, Math.PI / 2, 0, 0, 0.18);
    // prayer flags strung from a pole to a rock cairn
    const A: V3 = [-0.36, y + 0.34, -0.12], B: V3 = [0.36, y + 0.12, -0.2];
    rod(gp, [A[0], y, A[2]], [A[0], A[1] + 0.02, A[2]], 0.005, '#6b5640', 5);
    rocks(gp, '#6b7280', [[0.36, -0.2, 0.04], [0.33, -0.17, 0.03]], y);
    const PF = ['#1d4ed8', '#f8fafc', '#dc2626', '#16a34a', '#facc15'];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N, sag = Math.sin(Math.PI * t) * 0.08;
      const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t - sag, pz = A[2] + (B[2] - A[2]) * t;
      if (i < N) { const t2 = (i + 1) / N; rod(gp, [px, py, pz], [A[0] + (B[0] - A[0]) * t2, A[1] + (B[1] - A[1]) * t2 - Math.sin(Math.PI * t2) * 0.08, A[2] + (B[2] - A[2]) * t2], 0.0015, '#57534e', 3); }
      if (i > 0 && i < N) box(gp, PF[i % 5], px, py - 0.04, pz, 0.032, 0.036, 0.003, Math.atan2(B[2] - A[2], B[0] - A[0]) * -1, 0, Math.sin(i) * 0.15);
    }
    const o: FigureOpts = {
      y: y + top - 0.004, x: 0.0, z: 0.0, h: 0.58, top: '#d9541e', accent: '#7c2d12', bottom: '#3f3f46', shoes: '#1f2937', outfit: 'tunic', hair: '#1c1917',
      skin: '#c98d62', armL: { fwd: 0.4, side: 0.3, bend: 0.5 }, armR: { fwd: 2.75, side: 0.25, bend: -0.05, inward: -0.1 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    // quilted down suit bands
    for (const by of [0.58, 0.66]) { const q = lathe(b, [[0.122 * u, by * u], [0.127 * u, by * u], [0.127 * u, (by + 0.012) * u], [0.122 * u, (by + 0.012) * u]], '#b8441a', 0, 0, 0, 18); q.scale.z = 0.72; }
    // knitted Sherpa cap with ear flaps, goggles, oxygen mask hanging at the chest
    ellip(b, '#efe7d6', 0, hy + 0.42 * hr, -0.06 * hr, 1.1 * hr, 0.82 * hr, 1.1 * hr);
    lathe(b, [[1.07 * hr, 0], [1.13 * hr, 0], [1.13 * hr, 0.18 * hr], [1.07 * hr, 0.18 * hr]], '#b91c1c', 0, hy + 0.32 * hr, -0.04 * hr, 16);
    for (const sx of [-1, 1]) {
      ellip(b, '#efe7d6', sx * 1.0 * hr, hy - 0.25 * hr, -0.05 * hr, 0.22 * hr, 0.45 * hr, 0.35 * hr);
      ellip(b, '#1f2937', sx * 0.36 * hr, hy + 0.74 * hr, 0.92 * hr, 0.26 * hr, 0.2 * hr, 0.1 * hr); ellip(b, '#a5f3fc', sx * 0.36 * hr, hy + 0.74 * hr, 0.98 * hr, 0.17 * hr, 0.12 * hr, 0.06 * hr);
    }
    ellip(b, '#374151', 0.02 * u, 0.67 * u, 0.1 * u, 0.04 * u, 0.035 * u, 0.03 * u);
    tube(b, [[0.03 * u, 0.65 * u, 0.1 * u], [0.12 * u, 0.6 * u, 0.04 * u], [0.1 * u, 0.7 * u, -0.12 * u]], 0.009 * u, 0.009 * u, '#1f2937', { radial: 5, sub: 4 });
    for (const sx of [-1, 1]) metal(cyl(b, '#f97316', sx * 0.05 * u, 0.45 * u, -0.14 * u, 0.042 * u, 0.32 * u, 12), '#f97316', 0.45, 0.4);
    // raised ice axe with UN, British, Nepalese and Indian flags
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.05, rz], [rx, ry + 0.24, rz], 0.006, '#8b5a2b', 6);
    metal(box(gp, '#a1a1aa', rx, ry + 0.235, rz, 0.012, 0.012, 0.09), '#a1a1aa');
    const fw = 0.075, fh = 0.042;
    flag(gp, rx + 0.004, ry + 0.225, rz, fw, fh, '#60a5fa', (f, w, h) => { ring(f, '#f8fafc', w / 2, h / 2, 0, h * 0.28, 0, 0, 0, 0.16); });
    flag(gp, rx + 0.004, ry + 0.175, rz, fw, fh, '#1e3a8a', (f, w, h) => {
      band(f, '#f8fafc', w / 2, h * 0.36, w, h * 0.28); band(f, '#f8fafc', w / 2, 0, w * 0.2, h);
      box(f, '#c8102e', w / 2, h * 0.42, 0, w, h * 0.16, 0.007); box(f, '#c8102e', w / 2, 0, 0, w * 0.1, h, 0.007);
    });
    const np = slab(gp, [[0, 0], [0.05, 0.016], [0.02, 0.02], [0.05, 0.04], [0, 0.05]], 0.005, '#dc143c', 0, false);
    np.position.set(rx + 0.004, ry + 0.075, rz);
    ellip(gp, '#f8fafc', rx + 0.014, ry + 0.11, rz, 0.005, 0.005, 0.004); ellip(gp, '#f8fafc', rx + 0.014, ry + 0.088, rz, 0.006, 0.006, 0.004);
    flag(gp, rx + 0.004, ry + 0.07, rz, fw, fh, '#f8fafc', (f, w, h) => {
      band(f, '#ff9933', w / 2, h * 0.667, w, h * 0.333); band(f, '#138808', w / 2, 0, w, h * 0.333);
      ring(f, '#000080', w / 2, h / 2, 0, h * 0.12, 0, 0, 0, 0.2);
    });
  },

  /** Neil Armstrong on the Moon: gold visor, life-support pack, the Eagle lander, flag and bootprints. */
  pp_armstrong: gp => {
    const y = figureBase(gp, '#a3a29d', '#55554f');
    for (const [cx, cz, r] of [[0.28, 0.2, 0.07], [-0.3, 0.2, 0.05], [0.05, -0.36, 0.045]] as const) {
      lathe(gp, [[r * 0.7, 0], [r, 0.012], [r * 1.35, 0]], '#b4b3ae', cx, y, cz, 16);
      ellip(gp, '#8b8a85', cx, y, cz, r * 0.8, 0.003, r * 0.8);
    }
    rocks(gp, '#7c7b76', [[0.36, -0.02, 0.022], [-0.36, -0.02, 0.018], [0.18, 0.36, 0.015], [-0.12, 0.38, 0.012]], y);
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      ellip(gp, '#6f6e69', -0.13 + t * 0.12 + (i % 2) * 0.03, y + 0.001, -0.08 + t * 0.12, 0.014, 0.002, 0.024, 0.6);
    }
    lunarModule(gp, -0.22, y, -0.2, 0.46, 0.5);
    // Apollo flag with its top crossbar
    const fx = 0.27, fz = -0.14;
    rod(gp, [fx, y, fz], [fx, y + 0.44, fz], 0.004, '#e5e7eb', 5);
    rod(gp, [fx, y + 0.43, fz], [fx + 0.16, y + 0.43, fz], 0.003, '#e5e7eb', 4);
    flag(gp, fx + 0.002, y + 0.428, fz, 0.16, 0.1, '#b22234', US);
    const o: FigureOpts = {
      y, x: 0.0, z: 0.1, top: '#f1f1ef', bottom: '#ebebe8', accent: '#cbd5e1', shoes: '#d4d4d8', outfit: 'tunic', hairStyle: 'bald', hair: '#d6b08a',
      armL: { fwd: 0.35, side: 0.4, bend: 0.5 }, armR: { fwd: 0.9, side: 0.35, bend: 0.4 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    ellipHi(b, '#f4f4f2', 0, hy + 0.08 * hr, -0.04 * hr, 1.42 * hr, 1.4 * hr, 1.42 * hr);
    metal(ellipHi(b, '#d4a017', 0, hy - 0.02 * hr, 0.3 * hr, 1.18 * hr, 1.0 * hr, 1.18 * hr), '#d9a520', 0.85, 0.18);
    ellip(b, '#f4f4f2', 0, hy + 0.95 * hr, 0.25 * hr, 1.0 * hr, 0.35 * hr, 1.1 * hr);
    cyl(b, '#9ca3af', 0, 0.74 * u, 0, 0.1 * u, 0.04 * u, 16);
    // life-support backpack, chest control box, hoses, gloves, shoulder flag
    rbox(b, '#f4f4f2', 0, 0.48 * u, -0.17 * u, 0.25 * u, 0.36 * u, 0.13 * u, 0.02);
    rbox(b, '#e5e7eb', 0, 0.85 * u, -0.17 * u, 0.22 * u, 0.06 * u, 0.12 * u, 0.012);
    rbox(b, '#a1a1aa', 0, 0.56 * u, 0.08 * u, 0.13 * u, 0.08 * u, 0.05 * u, 0.008);
    for (const [kx, kc] of [[-0.035, '#dc2626'], [0, '#1f2937'], [0.035, '#2563eb']] as const) cyl(b, kc, kx * u, 0.64 * u, 0.1 * u, 0.008 * u, 0.012 * u, 8);
    for (const [sx, hc] of [[-1, '#2563eb'], [1, '#dc2626']] as const) tube(b, [[sx * 0.04 * u, 0.58 * u, 0.1 * u], [sx * 0.09 * u, 0.52 * u, 0.1 * u], [sx * 0.08 * u, 0.48 * u, 0.08 * u]], 0.01 * u, 0.01 * u, hc, { radial: 5, sub: 3 });
    for (const h of [a.handL, a.handR]) ellip(gp, '#64748b', h[0], h[1], h[2], 0.025, 0.03, 0.025);
    const pf = flag(b, -0.17 * u, 0.73 * u, 0.02 * u, 0.05 * u, 0.032 * u, '#b22234', US, -Math.PI / 2 + 0.2); pf.position.x = -0.165 * u;
  },

  /** Yuri Gagarin waving in his orange SK-1 suit and white CCCP helmet, the Vostok rocket on its pad behind. */
  pp_gagarin: gp => {
    const y = figureBase(gp, '#a7b47f', '#5b5f4a');
    lathe(gp, [[0.18, 0], [0.18, 0.006], [0, 0.006]], '#b9bcbf', 0.22, y, -0.2, 20);
    for (let i = 0; i < 8; i++) box(gp, i % 2 ? '#facc15' : '#1f2937', 0.22 + Math.cos(i * 0.785) * 0.165, y + 0.006, -0.2 + Math.sin(i * 0.785) * 0.165, 0.03, 0.002, 0.012, -i * 0.785);
    vostokRocket(gp, 0.22, y + 0.006, -0.2, 0.74);
    for (const [tx, tz] of [[-0.3, 0.2], [-0.22, 0.3], [0.3, 0.18], [-0.36, -0.05], [0.12, 0.34]]) for (let k = 0; k < 4; k++) cone(gp, k % 2 ? '#6b8e3a' : '#7f9f45', tx + Math.cos(k * 1.7) * 0.012, y, tz + Math.sin(k * 1.7) * 0.012, 0.007, 0.035 + (k % 3) * 0.01, 4);
    const o: FigureOpts = {
      y, x: -0.12, z: 0.12, top: '#ea6a1f', bottom: '#e36414', accent: '#9a3412', shoes: '#3f2a1c', outfit: 'tunic', hair: '#3b2a20', skin: '#ebbd98',
      armL: { fwd: 0.6, side: 0.15, bend: 0.5, inward: 0.15 }, armR: { fwd: 1.25, side: 0.6, bend: 1.55, inward: -0.25 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    // open-faced white helmet with dark face rim and red CCCP
    const R = 1.4 * hr, C: V3 = [0, hy + 0.12 * hr, -0.1 * hr], open = 0.98;
    const shell = add(b, g('pc-helm', () => {
      const s = new THREE.SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, Math.PI - open);
      s.rotateX(-(Math.PI / 2 - 0.25));
      return s;
    }), mat('#f6f6f4', { flat: false }), C[0], C[1], C[2], R, R, R);
    void shell;
    const ax = new THREE.Vector3(0, -Math.sin(0.25), Math.cos(0.25));
    const rc = ax.clone().multiplyScalar(R * Math.cos(open));
    ring(b, '#3f3f46', C[0] + rc.x, C[1] + rc.y, C[2] + rc.z, R * Math.sin(open) * 0.98, 0.25, 0, 0, 0.07);
    const el = 0.82, az = [-0.3, -0.1, 0.1, 0.3];
    'CCCP'.split('').forEach((ch, i) => {
      const d = new THREE.Vector3(Math.sin(az[i]) * Math.cos(el), Math.sin(el), Math.cos(az[i]) * Math.cos(el)).multiplyScalar(R * 1.005);
      letters(b, ch, '#d61f1f', C[0] + d.x, C[1] + d.y, C[2] + d.z, 0.045 * hr, az[i], -el, 0.03 * hr);
    });
    cyl(b, '#d4d4d8', 0, 0.74 * u, 0, 0.1 * u, 0.035 * u, 16);
    for (const h of [a.handL, a.handR]) ellip(gp, '#f5f5f4', h[0], h[1], h[2], 0.022, 0.026, 0.022);
    // the little ventilation case cosmonauts carried to the bus
    const [lx, ly, lz] = a.handL;
    rbox(gp, '#a5b4c4', lx, ly - 0.07, lz, 0.07, 0.06, 0.035, 0.008);
    tube(gp, [[lx, ly - 0.01, lz], [lx + 0.03, ly + 0.02, lz + 0.01], [lx + 0.06, ly + 0.05, lz - 0.02]], 0.004, 0.004, '#57534e', { radial: 4, sub: 3 });
  },

  /** Amelia Earhart, hands on hips in leather flying gear, in front of her red Lockheed Vega. */
  pp_earhart: gp => {
    const y = figureBase(gp, '#8fbf62', '#5b4636');
    const rw = box(gp, '#c9b48a', 0.08, y, -0.08, 0.14, 0.002, 0.8); rw.rotation.y = -0.55 + Math.PI / 2;
    vega(gp, 0.12, y, -0.1, 0.56, -0.55);
    // windsock
    rod(gp, [-0.33, y, -0.16], [-0.33, y + 0.22, -0.16], 0.004, '#e5e7eb', 5);
    for (let i = 0; i < 4; i++) { const c = cyl(gp, i % 2 ? '#f8fafc' : '#f97316', -0.33 + 0.018 + i * 0.03, y + 0.2, 0.16, 0.022 - i * 0.003, 0.03, 10); c.rotation.z = Math.PI / 2; c.position.y = y + 0.2 - i * 0.006; c.position.z = -0.16; }
    for (let i = 0; i < 6; i++) ellip(gp, '#a3cc75', Math.cos(i * 2.3) * 0.3, y, 0.2 + Math.sin(i * 2.3) * 0.12, 0.03, 0.012, 0.02);
    const o: FigureOpts = {
      y, x: -0.2, z: 0.16, ry: 0.25, top: '#6b4226', bottom: '#c8b28a', accent: '#3b2416', shirt: '#e8dcc6', shoes: '#3b2416', outfit: 'coat', hair: '#9a7048', hairStyle: 'curly',
      armL: { fwd: -0.15, side: 0.65, bend: 1.4, inward: 0.85 }, armR: { fwd: -0.15, side: 0.65, bend: 1.4, inward: 0.85 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    // leather flying cap with ear flaps and goggles on the forehead
    ellip(b, '#5a3a22', 0, hy + 0.32 * hr, -0.1 * hr, 1.1 * hr, 0.92 * hr, 1.08 * hr);
    for (const sx of [-1, 1]) {
      ellip(b, '#5a3a22', sx * 0.98 * hr, hy - 0.2 * hr, -0.05 * hr, 0.22 * hr, 0.55 * hr, 0.42 * hr);
      ring(b, '#b08d57', sx * 0.38 * hr, hy + 0.78 * hr, 0.86 * hr, 0.22 * hr, -0.35, 0, 0, 0.22);
      ellip(b, '#7dd3fc', sx * 0.38 * hr, hy + 0.78 * hr, 0.86 * hr, 0.2 * hr, 0.2 * hr, 0.06 * hr, 0, -0.35);
    }
    box(b, '#3b2416', 0, hy + 0.72 * hr, 0.9 * hr, 0.3 * hr, 0.08 * hr, 0.06 * hr);
    // silk scarf
    ellip(b, '#f3e9d2', 0, 0.76 * u, 0.04 * u, 0.08 * u, 0.03 * u, 0.06 * u);
    tube(b, [[0.03 * u, 0.75 * u, 0.08 * u], [0.06 * u, 0.68 * u, 0.1 * u], [0.05 * u, 0.6 * u, 0.1 * u]], 0.022 * u, 0.012 * u, '#f3e9d2', { radial: 6, sub: 3, squash: 0.4 });
    void hr;
  },

  /** Florence Nightingale, the Lady with the Lamp, on a ward with a sleeping soldier and her rose diagram. */
  pp_nightingale: gp => {
    const y = figureBase(gp, '#a9845a', '#5b4636');
    for (let i = -4; i <= 4; i++) { const z = i * 0.09, w = 2 * Math.sqrt(Math.max(0, 0.445 * 0.445 - z * z)); box(gp, '#7a5a3a', 0, y, z, w, 0.0015, 0.004); }
    // iron bed with a sleeping soldier
    const bx = -0.2, bz = -0.24;
    for (const [ex, eh] of [[-0.17, 0.16], [0.17, 0.11]] as const) {
      for (const sz of [-1, 1]) rod(gp, [bx + ex, y, bz + sz * 0.08], [bx + ex, y + eh, bz + sz * 0.08], 0.006, '#374151', 5);
      rod(gp, [bx + ex, y + eh, bz - 0.08], [bx + ex, y + eh, bz + 0.08], 0.005, '#374151', 5);
      for (let k = -1; k <= 1; k++) rod(gp, [bx + ex, y + 0.06, bz + k * 0.04], [bx + ex, y + eh, bz + k * 0.04], 0.003, '#4b5563', 4);
    }
    rbox(gp, '#f5f5f4', bx, y + 0.05, bz, 0.34, 0.035, 0.16, 0.01);
    rbox(gp, '#8394ad', bx + 0.04, y + 0.075, bz, 0.25, 0.022, 0.165, 0.01);
    box(gp, '#f8fafc', bx + 0.04 - 0.11, y + 0.093, bz, 0.03, 0.004, 0.166);
    ellip(gp, '#ffffff', bx - 0.13, y + 0.1, bz, 0.035, 0.018, 0.055);
    ellip(gp, '#e9b993', bx - 0.12, y + 0.12, bz, 0.03, 0.028, 0.03);
    ellip(gp, '#5b3a1d', bx - 0.135, y + 0.13, bz, 0.024, 0.022, 0.03);
    box(gp, '#f8fafc', bx - 0.12, y + 0.135, bz, 0.05, 0.012, 0.062);
    // bedside table with water jug, medicine bottle and a book
    const tx = 0.14, tz = -0.27;
    box(gp, '#6b4a2f', tx, y + 0.1, tz, 0.11, 0.012, 0.09);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(gp, '#5b3a22', tx + sx * 0.045, y, tz + sz * 0.035, 0.01, 0.1, 0.01);
    lathe(gp, [[0, 0], [0.018, 0], [0.022, 0.03], [0.012, 0.05], [0.016, 0.055], [0, 0.055]], '#e7e5e4', tx - 0.02, y + 0.112, tz, 10);
    cyl(gp, '#1e3a8a', tx + 0.025, y + 0.112, tz - 0.01, 0.01, 0.035, 8);
    rbox(gp, '#7f1d1d', tx + 0.02, y + 0.112, tz + 0.025, 0.05, 0.012, 0.035, 0.003);
    // easel with her famous "rose" (polar area) diagram
    const ex = 0.33, ez = -0.14, E = new THREE.Group(); E.position.set(ex, y, ez); E.rotation.y = -0.6; gp.add(E);
    for (const sx of [-1, 1]) rod(E, [sx * 0.05, 0, 0.02], [sx * 0.03, 0.28, 0], 0.004, '#6b4a2f', 4);
    rod(E, [0, 0, -0.06], [0, 0.26, 0], 0.004, '#6b4a2f', 4);
    box(E, '#f5ecd6', 0, 0.1, 0.008, 0.13, 0.15, 0.006);
    const cols = ['#60a5fa', '#f87171', '#9ca3af'];
    for (let i = 0; i < 12; i++) {
      const r = 0.025 + ((i * 7) % 5) * 0.008 + (i < 6 ? 0.012 : 0);
      const w = add(E, g('pc-wedge', () => new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, 0, Math.PI / 6)), mat(cols[i % 3]), 0, 0.175, 0.013, r, 0.003, r, 0, Math.PI / 2, (i * Math.PI) / 6);
      void w;
    }
    const o: FigureOpts = {
      y, x: 0.0, z: 0.1, top: '#2b2d42', accent: '#3b3d55', outfit: 'dress', hair: '#4a3426', hairStyle: 'bun',
      armL: { fwd: 0.3, side: 0.12, bend: 0.6, inward: 0.3 }, armR: { fwd: 1.05, side: 0.3, bend: 0.25 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    // white apron, lace collar and cap
    box(b, '#f8f6f0', 0, 0.05 * u, 0.13 * u, 0.17 * u, 0.42 * u, 0.006 * u, 0, -0.135);
    box(b, '#f8f6f0', 0, 0.49 * u, 0.087 * u, 0.11 * u, 0.16 * u, 0.006 * u);
    for (const sx of [-1, 1]) rod(b, [sx * 0.05 * u, 0.645 * u, 0.088 * u], [sx * 0.07 * u, 0.75 * u, 0.02 * u], 0.006 * u, '#f8f6f0', 4);
    for (let i = 0; i < 9; i++) { const t = (i / 8) * Math.PI; ellip(b, '#fbfaf6', Math.cos(t) * 0.085 * u, 0.765 * u - Math.sin(t) * 0.01 * u, 0.035 * u + Math.sin(t) * 0.05 * u, 0.03 * u, 0.008 * u, 0.025 * u); }
    ellip(b, '#fbfaf6', 0, hy + 0.35 * hr, -0.35 * hr, 1.0 * hr, 0.85 * hr, 0.8 * hr);
    for (let i = 0; i < 11; i++) { const t = (i / 10) * Math.PI; ellip(b, '#ffffff', Math.cos(t) * 1.02 * hr, hy + 0.15 * hr + Math.sin(t) * 0.75 * hr, 0.3 * hr, 0.18 * hr, 0.14 * hr, 0.12 * hr); }
    // the lamp: a glowing Turkish lantern hanging from her hand
    const [rx, ry, rz] = a.handR, ly = ry - 0.1;
    ring(gp, '#b08d57', rx, ry - 0.008, rz, 0.02, 0, Math.PI / 2, 0, 0.12);
    metal(cyl(gp, '#b08d57', rx, ly + 0.07, rz, 0.02, 0.012, 10), '#b08d57');
    metal(cone(gp, '#b08d57', rx, ly + 0.082, rz, 0.02, 0.016, 10), '#b08d57');
    glow(cyl(gp, '#fff1c2', rx, ly, rz, 0.024, 0.07, 12), '#fff1c2', '#ffb347');
    for (let k = 1; k < 4; k++) lathe(gp, [[0.0245, ly + k * 0.0175], [0.026, ly + k * 0.0175], [0.026, ly + k * 0.0175 + 0.003], [0.0245, ly + k * 0.0175 + 0.003]], '#c8a05a', rx, 0, rz, 12);
    metal(cyl(gp, '#b08d57', rx, ly - 0.01, rz, 0.02, 0.012, 10), '#b08d57');
    add(gp, g('pc-halo', () => new THREE.SphereGeometry(1, 16, 12)), mat('#ffd98a', { transparent: 0.18, emissive: '#ffb347' }), rx, ly + 0.035, rz, 0.075, 0.075, 0.075);
    // a small notebook in the other hand
    const [lx, lyy, lz] = a.handL;
    rbox(gp, '#7f1d1d', lx + 0.01, lyy - 0.03, lz + 0.01, 0.04, 0.055, 0.012, 0.003);
  },

  /** Pelé in the yellow number 10, kicking the ball in front of a goal, the Jules Rimet trophy beside him. */
  pp_pele: gp => {
    const y = figureBase(gp, '#4f9d3a', '#2f4a25');
    for (let i = -4; i <= 4; i += 2) { const z = i * 0.09, w = 2 * Math.sqrt(Math.max(0, 0.44 * 0.44 - (Math.abs(z) + 0.045) ** 2)); box(gp, '#5fb048', 0, y, z, w, 0.0012, 0.09); }
    const gx = 0.2, gz0 = -0.27, gz1 = -0.38, gh = 0.17, NET = '#e5e7eb';
    box(gp, '#f8fafc', 0, y + 0.0015, gz0, 0.76, 0.001, 0.008);
    for (const sx of [-1, 1]) { box(gp, '#f8fafc', sx * 0.14, y + 0.0015, gz0 + 0.07, 0.008, 0.001, 0.14); }
    box(gp, '#f8fafc', 0, y + 0.0015, gz0 + 0.14, 0.288, 0.001, 0.008);
    for (const sx of [-1, 1]) cyl(gp, '#f8fafc', sx * gx, y, gz0, 0.008, gh, 8);
    rod(gp, [-gx, y + gh, gz0], [gx, y + gh, gz0], 0.008, '#f8fafc', 8);
    for (const sx of [-1, 1]) { rod(gp, [sx * gx, y + gh, gz0], [sx * gx, y + gh * 0.6, gz1], 0.003, NET, 4); rod(gp, [sx * gx, y + gh * 0.6, gz1], [sx * gx, y, gz1], 0.003, NET, 4); }
    for (let i = 0; i <= 8; i++) { const x = -gx + (i / 8) * gx * 2; rod(gp, [x, y + gh, gz0], [x, y + gh * 0.6, gz1], 0.0018, NET, 3); rod(gp, [x, y + gh * 0.6, gz1], [x, y, gz1], 0.0018, NET, 3); }
    for (let j = 1; j < 4; j++) rod(gp, [-gx, y + (gh * 0.6 * j) / 4, gz1], [gx, y + (gh * 0.6 * j) / 4, gz1], 0.0018, NET, 3);
    for (const sx of [-1, 1]) for (let j = 1; j < 3; j++) rod(gp, [sx * gx, y + (gh * j) / 3, gz0], [sx * gx, y + (gh * 0.6 * j) / 3, gz1], 0.0018, NET, 3);
    // Jules Rimet trophy on a little plinth
    const jx = -0.3, jz = 0.15, G = '#e0b23c';
    rbox(gp, '#1e3a8a', jx, y, jz, 0.07, 0.04, 0.07, 0.006);
    metal(lathe(gp, [[0, 0], [0.03, 0], [0.026, 0.01], [0.012, 0.03], [0.02, 0.06], [0.04, 0.08], [0.042, 0.09], [0, 0.085]], G, jx, y + 0.04, jz, 8), G, 0.8, 0.3);
    metal(ellip(gp, G, jx, y + 0.075, jz + 0.01, 0.012, 0.03, 0.012), G, 0.8, 0.3);
    for (const sx of [-1, 1]) metal(slab(gp, [[0, 0], [sx * 0.03, 0.02], [sx * 0.025, 0.05], [0, 0.02]], 0.004, G, 0, false), G, 0.8, 0.3).position.set(jx, y + 0.075, jz + 0.012);
    const o: FigureOpts = {
      y, x: 0.0, z: 0.0, skin: '#6b4630', top: '#facc15', accent: '#15803d', outfit: 'tunic', hair: '#111111', hairStyle: 'short',
      armL: { fwd: 0.35, side: 0.75, bend: 0.4 }, armR: { fwd: -0.45, side: 0.55, bend: 0.5 }, lean: -0.05,
      stance: 'kick', sleeve: 0.45, shorts: true, bottom: '#1d4ed8', socks: '#f8fafc', shoes: '#111111',
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // collar & cuffs, crest, number 10 on the back
    ellip(b, '#16a34a', 0, 0.77 * u, 0.02 * u, 0.075 * u, 0.018 * u, 0.06 * u);
    ellip(b, '#1d4ed8', -0.055 * u, 0.67 * u, 0.088 * u, 0.02 * u, 0.024 * u, 0.008 * u);
    letters(b, '10', '#1e40af', 0, 0.62 * u, -0.093 * u, 0.017 * u, Math.PI, 0, 0.008 * u);
    letters(b, '10', '#1e40af', 0.05 * u, 0.69 * u, 0.087 * u, 0.006 * u, 0, 0, 0.006 * u);
    // the ball at his kicking foot
    const bxp = a.group.position.x + 0.078 * u, bzp = a.group.position.z + 0.37 * u, br = 0.04;
    ellip(gp, '#f8fafc', bxp, y + br, bzp, br);
    for (let i = 0; i < 10; i++) {
      const t = i * 2.4, ph = Math.acos(1 - (2 * (i + 0.5)) / 10);
      ellip(gp, '#111111', bxp + Math.sin(ph) * Math.cos(t) * br * 0.96, y + br + Math.cos(ph) * br * 0.96, bzp + Math.sin(ph) * Math.sin(t) * br * 0.96, br * 0.28, br * 0.28, br * 0.28);
    }
  },

  /** Jesse Owens sprinting down the track in 1936 with bib 733, his four gold medals and an oak sapling behind. */
  pp_owens: gp => {
    const y = figureBase(gp, '#b4533a', '#5b3a2a');
    for (const z of [-0.35, -0.21, -0.07, 0.07, 0.21, 0.35]) { const l = 2 * Math.sqrt(Math.max(0, 0.44 * 0.44 - z * z)); box(gp, '#f8fafc', 0, y, z, l, 0.0015, 0.006); }
    box(gp, '#f8fafc', 0.3, y, 0, 0.02, 0.0016, 0.6);
    // medal rack with four gold medals
    const mx = 0.12, mz = -0.3;
    for (const sx of [-1, 1]) rod(gp, [mx + sx * 0.1, y, mz], [mx + sx * 0.1, y + 0.2, mz], 0.006, '#e5e7eb', 5);
    rod(gp, [mx - 0.1, y + 0.2, mz], [mx + 0.1, y + 0.2, mz], 0.005, '#e5e7eb', 5);
    for (let i = 0; i < 4; i++) {
      const x = mx - 0.066 + i * 0.044;
      for (const sx of [-1, 1]) box(gp, '#1d4ed8', x + sx * 0.008, y + 0.13, mz + 0.005, 0.008, 0.07, 0.003, 0, 0, -sx * 0.2);
      metal(cyl(gp, '#e0b23c', x, y + 0.11, mz + 0.008, 0.018, 0.005, 14), '#e0b23c', 0.8, 0.3).rotation.x = Math.PI / 2;
    }
    // potted oak sapling (each winner in 1936 received one)
    const ox = -0.3, oz = -0.18;
    lathe(gp, [[0, 0], [0.04, 0], [0.05, 0.06], [0.053, 0.065], [0, 0.065]], '#a0522d', ox, y, oz, 12);
    tube(gp, [[ox, y + 0.06, oz], [ox + 0.005, y + 0.15, oz], [ox - 0.01, y + 0.22, oz]], 0.007, 0.004, '#6b4a2f', { radial: 5, sub: 3 });
    for (let k = 0; k < 9; k++) ellip(gp, k % 2 ? '#3f7d2c' : '#4f9a37', ox + Math.cos(k * 2.3) * 0.045, y + 0.17 + (k % 3) * 0.03, oz + Math.sin(k * 2.3) * 0.04, 0.035, 0.025, 0.03);
    const o: FigureOpts = {
      y, x: -0.04, z: 0.07, ry: 1.15, skin: '#5d3b26', top: '#f8fafc', accent: '#1e3a8a', outfit: 'tunic', hair: '#111111', hairStyle: 'short', lean: 0.14,
      armL: { fwd: -0.7, side: 0.15, bend: 1.3 }, armR: { fwd: 0.95, side: 0.12, bend: 1.2 },
      stance: 'run', sleeve: 0, shorts: true, bottom: '#f1f5f9', shoes: '#1f2937',
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // race bib 733 and US shield
    box(b, '#f1ead8', 0, 0.56 * u, 0.087 * u, 0.13 * u, 0.09 * u, 0.006 * u);
    letters(b, '733', '#111111', 0, 0.595 * u, 0.091 * u, 0.0085 * u, 0, 0, 0.004 * u);
    box(b, '#1e3a8a', 0, 0.68 * u, 0.088 * u, 0.04 * u, 0.018 * u, 0.006 * u);
    for (let i = 0; i < 3; i++) box(b, i % 2 ? '#f8fafc' : '#b91c1c', (-0.012 + i * 0.012) * u, 0.65 * u, 0.088 * u, 0.012 * u, 0.03 * u, 0.006 * u);
  },

  /** Wangari Maathai planting trees: seedling in her hands, rows of saplings, an acacia and Mount Kenya behind. */
  pp_maathai: gp => {
    const y = figureBase(gp, '#7aa64a', '#5b4636');
    // Mount Kenya
    const mk = lathe(gp, [[0.2, 0], [0.13, 0.1], [0.06, 0.24], [0.02, 0.32], [0, 0.33]], '#6b7280', 0.33, y, -0.16, 6); mk.rotation.y = 0.4;
    const ms = lathe(gp, [[0, 0.2], [0.075, 0.2], [0.035, 0.28], [0, 0.335]], '#f8fafc', 0.33, y + 0.002, -0.16, 6); ms.rotation.y = 0.4; ms.scale.set(1.05, 1, 1.05);
    cone(gp, '#57534e', 0.39, y + 0.15, -0.15, 0.02, 0.14, 5);
    // umbrella acacia
    tube(gp, [[-0.26, y, -0.2], [-0.25, y + 0.18, -0.2], [-0.2, y + 0.3, -0.18]], 0.018, 0.01, '#5b4030', { radial: 6, sub: 4 });
    tube(gp, [[-0.25, y + 0.18, -0.2], [-0.32, y + 0.28, -0.22]], 0.01, 0.007, '#5b4030', { radial: 5, sub: 2 });
    ellip(gp, '#4f7a2f', -0.25, y + 0.33, -0.2, 0.17, 0.035, 0.13);
    ellip(gp, '#5f8f39', -0.24, y + 0.36, -0.19, 0.12, 0.025, 0.09);
    // rows of seedlings in fresh soil
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const sx = -0.34 + i * 0.075 + r * 0.03, sz = 0.12 + r * 0.12;
      ellip(gp, '#6b4a2f', sx, y, sz, 0.03, 0.012, 0.025);
      rod(gp, [sx, y, sz], [sx, y + 0.05 + (i % 2) * 0.01, sz], 0.003, '#5b4030', 3);
      for (let k = 0; k < 3; k++) ellip(gp, k % 2 ? '#65a30d' : '#4d7c0f', sx + Math.cos(k * 2.1) * 0.012, y + 0.045 + k * 0.008, sz + Math.sin(k * 2.1) * 0.012, 0.014, 0.006, 0.01, k * 2.1);
    }
    // watering can and spade
    const wx = 0.3, wz = 0.18;
    metal(cyl(gp, '#15803d', wx, y, wz, 0.035, 0.06, 12), '#15803d', 0.4, 0.4);
    rod(gp, [wx + 0.025, y + 0.02, wz], [wx + 0.08, y + 0.07, wz], 0.006, '#15803d', 5);
    ring(gp, '#15803d', wx - 0.01, y + 0.07, wz, 0.025, 0, 0, Math.PI / 2, 0.15);
    rod(gp, [0.22, y + 0.02, 0.3], [0.2, y + 0.2, 0.28], 0.006, '#8b5a2b', 5);
    metal(box(gp, '#9ca3af', 0.222, y - 0.02, 0.3, 0.04, 0.05, 0.006), '#9ca3af');
    const o: FigureOpts = {
      y, x: 0.02, z: 0.04, skin: '#4a2e1f', top: '#d9480f', accent: '#facc15', outfit: 'dress', hair: '#1c1917', hat: 'turban', hatColor: '#f59e0b',
      armL: { fwd: 0.9, side: 0.1, bend: 0.5, inward: 0.5 }, armR: { fwd: 0.9, side: 0.1, bend: 0.5, inward: 0.5 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR, hy = 0.9 * u;
    // African print: dots and chevrons on the dress, a patterned knot on the headwrap
    const prof: [number, number][] = [[0.03, 0.192], [0.14, 0.17], [0.3, 0.145], [0.44, 0.124]];
    const rAt = (h: number) => { for (let i = 1; i < prof.length; i++) if (h <= prof[i][0]) { const t = (h - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]); return prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t; } return 0.124; };
    for (let r = 0; r < 4; r++) for (let i = -2; i <= 2; i++) {
      const h = 0.08 + r * 0.1, th = i * 0.32 + (r % 2) * 0.16, rr = rAt(h) * u;
      ellip(b, r % 2 ? '#facc15' : '#14532d', Math.sin(th) * rr, h * u, Math.cos(th) * rr * 0.8, 0.017 * u, 0.017 * u, 0.008 * u, th);
    }
    for (let i = -2; i <= 2; i++) box(b, '#facc15', i * 0.035 * u, 0.68 * u, 0.088 * u, 0.02 * u, 0.008 * u, 0.006 * u, 0, 0, 0.6 * (i % 2 ? 1 : -1));
    ellip(b, '#d9480f', 0.3 * hr, hy + 1.35 * hr, -0.2 * hr, 0.45 * hr, 0.35 * hr, 0.4 * hr, 0, 0, -0.4);
    ellip(b, '#facc15', -0.3 * hr, hy + 1.3 * hr, -0.25 * hr, 0.38 * hr, 0.3 * hr, 0.36 * hr, 0, 0, 0.4);
    // seedling pot between her hands
    const [lx, ly, lz] = a.handL, [rx, , rz] = a.handR;
    const px = (lx + rx) / 2, pz = (lz + rz) / 2 + 0.015;
    lathe(gp, [[0, 0], [0.026, 0], [0.034, 0.04], [0.036, 0.045], [0, 0.045]], '#b45f3a', px, ly - 0.03, pz, 12);
    ellip(gp, '#5b4030', px, ly + 0.013, pz, 0.03, 0.006, 0.03);
    rod(gp, [px, ly + 0.01, pz], [px, ly + 0.09, pz], 0.0035, '#3f6212', 4);
    for (let k = 0; k < 5; k++) ellip(gp, k % 2 ? '#65a30d' : '#4d7c0f', px + Math.cos(k * 1.26) * 0.02, ly + 0.05 + k * 0.009, pz + Math.sin(k * 1.26) * 0.02, 0.02, 0.007, 0.012, -k * 1.26);
  },
};

/** Swap the shared 22×15 ellipsoid for lighter spheres on small parts (eyes, hands, buttons, hair puffs) — the figurine
 *  alone would otherwise use ~20k triangles. Large parts (heads, helmets) keep the smooth version. */
function slim(gp: THREE.Group, bias = 1): void {
  const lod = (s: number) => g('pc-sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(4, Math.round(s * 0.7))));
  const spheres = new Set<THREE.BufferGeometry>([g('esph', () => new THREE.SphereGeometry(1, 22, 15)), lod(6), lod(8), lod(12), lod(16)]);
  const v = new THREE.Vector3();
  gp.updateMatrixWorld(true);
  gp.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !spheres.has(m.geometry)) return;
    m.getWorldScale(v);
    const raw = Math.max(v.x, v.y, v.z), r = raw / bias;
    if (raw < 0.075) m.geometry = lod(r > 0.05 || raw > 0.06 ? 16 : r > 0.028 ? 12 : r > 0.012 ? 8 : 6);
  });
}

/** a few busy scenes (many small animals / fur tufts) get coarser spheres to stay inside the triangle budget */
const BIAS: Record<string, number> = { pp_huatuo: 1.5, pp_amundsen: 1.25 };

export const H_PEOPLE_C: Record<string, Builder> = Object.fromEntries(
  Object.entries(BUILDERS).map(([k, f]) => [k, ((gp, r) => { f(gp, r); slim(gp, BIAS[k]); }) as Builder]),
);
