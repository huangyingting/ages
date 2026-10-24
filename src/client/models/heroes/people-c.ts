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

/** Ming treasure ship (宝船) after the Nanjing Treasure-Shipyard replica: a 福船-type hull with a flat transom bow and a
 *  high square stern, dark planking under a vermilion upper strake, bow eyes, a stern deckhouse, a deep rudder and six
 *  masts with battened junk sails. Seen broadside, bow toward −x. */
function baochuan(p: THREE.Object3D, cx: number, cy: number, cz: number, L: number): void {
  const W = L * 0.1, D = L * 0.07, n = 16;
  const sheer = (t: number) => D * (0.8 + 0.6 * Math.pow(Math.max(0, 1 - 2.5 * t), 2) + 1.3 * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2));
  const half = (t: number) => W * (t < 0.4 ? 0.62 + 0.38 * Math.sin((t / 0.4) * Math.PI / 2) : 1 - 0.22 * Math.pow((t - 0.4) / 0.6, 2));
  const X = (t: number) => cx + (t - 0.5) * L;
  const rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = X(t), w = half(t), s = sheer(t), d = D * (0.3 + 0.7 * Math.sin(Math.PI * t));
    rings.push([[x, cy + s, cz - w], [x, cy + s * 0.2, cz - w], [x, cy - d * 0.55, cz - w * 0.8], [x, cy - d, cz - w * 0.3],
      [x, cy - d, cz + w * 0.3], [x, cy - d * 0.55, cz + w * 0.8], [x, cy + s * 0.2, cz + w], [x, cy + s, cz + w]]);
  }
  skin(p, rings, '#3a2a1e', {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      const s = cy + sheer(Math.min(1, Math.max(0, (x - cx) / L + 0.5)));
      if (ny > 0.8) return '#8a7052';
      if (y > s - D * 0.3) return '#7a2e22';
      if (y > s - D * 0.38) return '#a88a4c';
      if (y < cy + D * 0.08) return '#2a211b';
      return Math.floor((y - cy) * 220) % 2 ? '#3d2c20' : '#463324';
    },
  });
  // painted eyes (龙目) on the bow
  const ex = X(0.05), ey = cy + sheer(0.05) * 0.55, ez = cz + half(0.05) + 0.002;
  ellip(p, '#e3dac4', ex, ey, ez, 0.016, 0.011, 0.004);
  ellip(p, '#1a1614', ex - 0.002, ey, ez + 0.002, 0.007, 0.007, 0.004);
  // low forecastle and the two-storey stern castle (舵楼) with windows and a tiled roof
  box(p, '#5a3a28', X(0.08), cy + sheer(0.12) - 0.004, cz, L * 0.09, 0.02, half(0.08) * 1.8);
  const xs = X(0.9), ys = cy + sheer(0.83) - 0.004;
  box(p, '#6a3626', xs, ys, cz, L * 0.17, 0.042, half(0.9) * 1.9);
  for (let i = 0; i < 6; i++) box(p, '#241b15', xs - L * 0.07 + i * L * 0.028, ys + 0.016, cz + half(0.9) * 0.95 + 0.001, 0.01, 0.014, 0.003);
  box(p, '#a88a4c', xs, ys + 0.04, cz, L * 0.175, 0.004, half(0.9) * 1.95);
  box(p, '#6a3626', xs + L * 0.02, ys + 0.044, cz, L * 0.1, 0.028, half(0.9) * 1.4);
  gable(p, L * 0.13, 0.022, half(0.9) * 1.7, '#3a3430', xs + L * 0.02, ys + 0.072, cz);
  // deep stern rudder and its tiller
  box(p, '#2e231a', X(1) + 0.012, cy - D * 0.9, cz, 0.018, D * 2.2, 0.006);
  rod(p, [X(1) + 0.012, cy + D * 1.3, cz], [X(0.94), cy + sheer(0.94) + 0.006, cz], 0.003, '#2e231a', 4);
  // six masts carrying battened mat sails; sheets fan from the batten ends to the deck
  const H = L * 0.58;
  const masts: [number, number][] = [[0.08, 0.5], [0.23, 0.78], [0.41, 1], [0.58, 0.84], [0.73, 0.64], [0.86, 0.46]];
  masts.forEach(([t, k], i) => {
    const h = H * k, mx = X(t), my = cy + sheer(t), sw = h * 0.5, hs = h * 0.82, sb = my + h * 0.13, sz = cz + 0.008 + (i % 2) * 0.007;
    rod(p, [mx, my, cz], [mx, my + h, cz], 0.003 + 0.003 * k, '#3a2a1d', 6);
    const leech = (f: number) => (f < 0.55 ? 0.68 + 0.1 * f / 0.55 : 0.78 - 0.14 * (f - 0.55) / 0.45) * sw;
    const luff = -0.32 * sw, topL = 0.86;
    const sail = slab(p, [[luff, 0], [leech(0), 0], [leech(0.55), 0.55 * hs], [leech(1), hs], [luff, topL * hs]], 0.003, tint('#a8804f', (i % 2) * 0.05 - 0.02), 0, false);
    sail.position.set(mx, sb, sz);
    for (let j = 0; j <= 7; j++) {
      const f = j / 7;
      rod(p, [mx + luff - 0.004, sb + f * topL * hs, sz + 0.004], [mx + leech(f) + 0.006, sb + f * hs, sz + 0.004], j === 0 || j === 7 ? 0.0028 : 0.0015, '#3b2a1d', 4);
    }
    for (const f of [0.25, 0.5, 0.75]) rod(p, [mx + leech(f) + 0.005, sb + f * hs, sz + 0.004], [mx + leech(0) + 0.025, my + 0.004, sz], 0.0007, '#2e241c', 3);
  });
  // swallow-tailed pennant on the mainmast
  const mm = X(0.41), mt = cy + sheer(0.41) + H;
  slab(p, [[0, 0], [0.06, 0.004], [0.045, -0.008], [0.06, -0.02], [0, -0.016]], 0.002, '#8a3a2a', 0, false).position.set(mm, mt, cz);
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
  // felt saddle cloth between the humps and felt-wrapped bales lashed on both flanks
  box(grp, '#6e3a2c', -0.01, 0.5, 0, 0.09, 0.012, 0.25);
  for (const sz of [-1, 1]) {
    const b1 = cyl(grp, sz > 0 ? '#8c7a5c' : '#9a8460', 0, 0.38, sz * 0.14, 0.045, 0.14, 10); b1.rotation.z = Math.PI / 2;
    box(grp, '#4a3a2a', 0, 0.4, sz * 0.14, 0.012, 0.095, 0.095);
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

/** Rammed-earth beacon tower (烽燧) of the Hexi corridor / Dunhuang frontier: a battered square tower laid in earth
 *  courses with reed layers, a low parapet and the beacon poles on top. */
function beacon(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = 0.35; grp.scale.setScalar(s); p.add(grp);
  const E = '#b39871', r0 = 0.15, r1 = 0.1, h = 0.42;
  lathe(grp, [[0, 0], [r0, 0], [r1, h], [0, h]], E, 0, 0, 0, 4).rotation.y = Math.PI / 4;
  // darker reed courses between the rammed layers
  for (let k = 1; k < 9; k++) {
    const yy = (k / 9) * h, rr = r0 + (r1 - r0) * (k / 9) + 0.002;
    lathe(grp, [[0, yy], [rr, yy], [rr - 0.001, yy + 0.006], [0, yy + 0.006]], '#8a7556', 0, 0, 0, 4).rotation.y = Math.PI / 4;
  }
  // eroded corner and a parapet with a gap
  ellip(grp, tint(E, -0.12), r1 * 0.7, h * 0.55, r1 * 0.7, 0.03, 0.06, 0.03);
  const q = r1 * 0.71;
  for (const [bx, bz, bw, bd] of [[0, -q, 2 * q, 0.02], [-q, 0, 0.02, 2 * q], [q, -q * 0.35, 0.02, q * 1.3], [-q * 0.45, q, q * 1.1, 0.02]] as const)
    box(grp, tint(E, 0.04), bx, h, bz, bw, 0.035, bd);
  for (const [px, pz] of [[-0.02, -0.02], [0.03, 0.01]]) rod(grp, [px, h, pz], [px + 0.01, h + 0.12, pz], 0.004, '#5a4632', 4);
  // brushwood heaps (积薪) at the foot, ready to be fired
  for (const [px, pz] of [[0.2, 0.05], [0.16, 0.16]]) {
    for (let k = 0; k < 7; k++) rod(grp, [px + Math.cos(k) * 0.035, 0, pz + Math.sin(k) * 0.035], [px, 0.07, pz], 0.004, k % 2 ? '#6e5a40' : '#7d6a4c', 3);
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
  /** Admiral Zheng He (Ming, 1405–33 voyages) on the Longjiang shipyard quay at Nanjing, his six-masted treasure ship
   *  behind. Ref: Nanjing 宝船厂 replica (福船 hull, battened junk sails); Ming eunuch official in red 圆领袍 and 乌纱帽. */
  pp_zhenghe: gp => {
    const y = figureBase(gp, '#4f6c74', '#4e4034');
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.14 + (i % 5) * 0.06; ellip(gp, '#6f8c92', Math.cos(a) * r, y + 0.001, -Math.abs(Math.sin(a)) * r - 0.04, 0.028, 0.0025, 0.006, a); }
    const quay: [number, number][] = [];
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; quay.push([Math.cos(a) * 0.445, 0.02 + Math.sin(a) * 0.425]); }
    prism(gp, quay, y, 0.03, '#a59c88');
    for (let i = 0; i < 9; i++) box(gp, tint('#a59c88', (i % 2) * -0.08), -0.4 + i * 0.1, y, 0.01, 0.098, 0.031, 0.025);
    for (const bx of [-0.3, 0.3]) { cyl(gp, '#4b4540', bx, y + 0.03, 0.06, 0.016, 0.03, 8); ellip(gp, '#4b4540', bx, y + 0.06, 0.06, 0.02, 0.01, 0.02); }
    tube(gp, [[0.3, y + 0.05, 0.06], [0.28, y + 0.03, -0.04], [0.22, y + 0.03, -0.17]], 0.004, 0.004, '#9a8460', { radial: 4, sub: 3 });
    // cargo on the quay: lashed crates and a stack of porcelain jars
    rbox(gp, '#6b5038', 0.3, y + 0.03, 0.2, 0.08, 0.05, 0.06, 0.004);
    box(gp, '#4a3a2a', 0.3, y + 0.03, 0.2, 0.082, 0.052, 0.008);
    for (const [jx, jz] of [[0.2, 0.28], [0.25, 0.32]] as const) lathe(gp, [[0, 0], [0.018, 0], [0.026, 0.03], [0.02, 0.05], [0.01, 0.055], [0.012, 0.062], [0, 0.062]], '#d9d6cc', jx, y + 0.03, jz, 10);
    for (const [jx, jz] of [[0.2, 0.28], [0.25, 0.32]] as const) lathe(gp, [[0.0255, 0.026], [0.0262, 0.026], [0.0245, 0.04], [0.0225, 0.04]], '#4a5e7a', jx, y + 0.03, jz, 10);
    baochuan(gp, 0.0, y + 0.006, -0.25, 0.76);
    const yf = y + 0.03, o: FigureOpts = {
      y: yf, x: -0.12, z: 0.17, top: '#8c3328', accent: '#2a2420', outfit: 'roundrobe', wideSleeves: true, hair: '#1c1917', hat: 'wusha', hatColor: '#1c1917',
      badge: '#a88a4c', skin: '#d6a47c', shoes: '#1f1a17',
      armL: { fwd: 0.75, side: 0.15, bend: 0.8, inward: 0.4 }, armR: { fwd: 1.2, side: 0.55, bend: 0.1 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // stiff hoop belt (革带) hanging loose at the hips with jade plaques
    lathe(b, [[0.128 * u, 0.465 * u], [0.136 * u, 0.465 * u], [0.136 * u, 0.49 * u], [0.128 * u, 0.49 * u]], '#2a2420', 0, 0, 0, 20).scale.z = 0.8;
    for (const sx of [-0.06, -0.02, 0.02, 0.06]) box(b, '#8e8a72', sx * u, 0.468 * u, 0.106 * u - Math.abs(sx) * 0.12 * u, 0.026 * u, 0.018 * u, 0.006 * u);
    // dry compass (旱罗盘) in a wooden case in the left hand
    const [lx, ly, lz] = a.handL;
    rbox(gp, '#5a3e28', lx + 0.01, ly + 0.008, lz + 0.02, 0.06, 0.012, 0.06, 0.004);
    metal(cyl(gp, '#8a6a3a', lx + 0.01, ly + 0.02, lz + 0.02, 0.022, 0.003, 14), '#8a6a3a', 0.5, 0.5);
    box(gp, '#2a2420', lx + 0.01, ly + 0.0235, lz + 0.02, 0.003, 0.002, 0.034, 0.5);
    // rolled sea chart in the outstretched hand
    const [rx, ry, rz] = a.handR;
    const sc = cyl(gp, '#d9ccaa', rx, ry - 0.045, rz + 0.01, 0.011, 0.09, 8); sc.rotation.z = 0.2;
    for (const d of [-1, 1]) ellip(gp, '#3a2a1e', rx - d * 0.009, ry + d * 0.045, rz + 0.01, 0.013, 0.005, 0.013);
  },

  /** Xuanzang (Tang, 629–645) on the frontier road west, carrying his bamboo book-frame (笈) with a canopy and hanging
   *  lamp, fly-whisk and sutra in hand. Ref: 玄奘三藏像 (Tokyo National Museum) / Dunhuang 行脚僧图; Hexi 烽燧. */
  pp_xuanzang: gp => {
    const y = figureBase(gp, '#cdb48a', '#7a5f42');
    mound(gp, '#c8ab7c', -0.08, y, -0.34, 0.15, 0.045);
    // the caravan road: packed earth with cart ruts, winding away to the back right
    const P: [number, number][] = [[-0.06, 0.45], [-0.02, 0.26], [0.04, 0.06], [0.14, -0.12], [0.24, -0.3]], wl: [number, number][] = [], wr: [number, number][] = [];
    P.forEach(([px, pz], i) => {
      const [qx, qz] = P[Math.min(i + 1, P.length - 1)], [ox, oz] = P[Math.max(i - 1, 0)], dx = qx - ox, dz = qz - oz, l = Math.hypot(dx, dz), w = 0.075 - i * 0.008;
      wl.push([px - (dz / l) * w, pz + (dx / l) * w]); wr.push([px + (dz / l) * w, pz - (dx / l) * w]);
    });
    prism(gp, [...wl, ...wr.reverse()], y, 0.002, '#b8a07c', 0, true);
    for (const off of [-0.025, 0.025]) tube(gp, P.map(([px, pz]) => [px + off, y + 0.0025, pz] as V3), 0.0025, 0.0025, '#a08a68', { radial: 3, sub: 3 });
    beacon(gp, -0.26, y, -0.2, 0.75);
    rocks(gp, '#8f7b63', [[0.3, 0.22, 0.03], [0.34, 0.15, 0.02], [-0.33, 0.14, 0.025], [-0.25, 0.28, 0.018]], y);
    // camel-thorn (骆驼刺) tussocks
    for (const [tx, tz] of [[-0.36, 0.02], [0.38, 0.04], [0.2, 0.33], [-0.18, 0.36]]) for (let k = 0; k < 7; k++)
      rod(gp, [tx, y, tz], [tx + Math.cos(k * 0.9) * 0.025, y + 0.03 + (k % 3) * 0.006, tz + Math.sin(k * 0.9) * 0.025], 0.0025, k % 2 ? '#7d8455' : '#8f8a5c', 3);
    const o: FigureOpts = {
      y, x: 0.0, z: 0.1, ry: 0.25, skin: '#d4a27c', top: '#7a6046', bottom: '#5c4a38', accent: '#4a3a2a', outfit: 'tunic', hair: '#5a4a3c', hairStyle: 'bald',
      shoes: '#a8925e', socks: '#d4c8ac', stance: 'walk', lean: 0.05,
      armL: { fwd: 0.6, side: 0.12, bend: 0.75, inward: 0.35 }, armR: { fwd: 0.9, side: 0.3, bend: 0.9, inward: 0.15 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // knee-length monk's robe (褊衫/直裰) over the trousers, crossed collar
    lathe(b, [[0.168 * u, 0.27 * u], [0.174 * u, 0.27 * u], [0.152 * u, 0.36 * u], [0.13 * u, 0.45 * u], [0.12 * u, 0.5 * u], [0, 0.5 * u]], '#7a6046', 0, 0, 0, 20).scale.z = 0.8;
    box(b, '#4a3a2a', -0.018 * u, 0.765 * u, 0.094 * u, 0.016 * u, 0.13 * u, 0.008 * u, 0, 0, 0.42);
    box(b, '#4a3a2a', 0.022 * u, 0.79 * u, 0.092 * u, 0.016 * u, 0.09 * u, 0.008 * u, 0, 0, -0.42);
    // bamboo book-frame (笈): four posts, rails and shelves of wrapped sutra rolls and a lacquered sutra box
    const xw = 0.13 * u, z0 = -0.11 * u, z1 = -0.27 * u, yb = 0.28 * u, yt = 1.1 * u, BAM = '#9a8150';
    for (const sx of [-1, 1]) for (const zz of [z0, z1]) rod(b, [sx * xw, yb, zz], [sx * xw, yt, zz], 0.008 * u, BAM, 5);
    for (const sy of [0.3, 0.52, 0.76, 1.0]) {
      for (const zz of [z0, z1]) rod(b, [-xw, sy * u, zz], [xw, sy * u, zz], 0.006 * u, BAM, 4);
      for (const sx of [-1, 1]) rod(b, [sx * xw, sy * u, z0], [sx * xw, sy * u, z1], 0.006 * u, BAM, 4);
    }
    const wraps = ['#5a4030', '#c8b48a', '#6e5236', '#8a6a48'];
    for (const [r, sy] of [[0, 0.3], [2, 0.76]] as const) for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) {
      const sc = cyl(b, wraps[(k + j + r) % 4], 0, 0, 0, 0.032 * u, xw * 1.85, 8);
      sc.rotation.z = Math.PI / 2; sc.position.set(0, (sy + 0.04 + k * 0.066) * u, z0 - 0.042 * u - j * 0.078 * u);
    }
    rbox(b, '#3a2a22', 0, 0.53 * u, (z0 + z1) / 2, xw * 1.8, 0.2 * u, (z0 - z1) * 0.9, 0.008 * u);
    box(b, '#8a6a3a', 0, 0.62 * u, z1 + 0.012 * u, xw * 1.0, 0.025 * u, 0.006 * u);
    // the canopy (笈盖) over his head: a bamboo-mat board with a cloth fringe, and the little lamp hanging in front
    const cz0 = (z1 + 0.16 * u) / 2, cd = 0.16 * u - z1;
    const can = box(b, '#8a7a58', 0, yt, cz0, 0.3 * u, 0.01 * u, cd); can.rotation.x = -0.1;
    for (let i = 0; i < 8; i++) box(b, i % 2 ? '#6e4a32' : '#5e3e2a', (-0.14 + i * 0.04) * u, yt - 0.045 * u, 0.16 * u - 0.002 * u, 0.036 * u, 0.045 * u, 0.006 * u);
    for (const sx of [-1, 1]) {
      box(b, '#5e3e2a', sx * 0.16 * u, yt - 0.04 * u, cz0, 0.006 * u, 0.04 * u, cd * 0.95);
      rod(b, [sx * xw, yt - 0.1 * u, z0], [sx * 0.15 * u, yt, 0.14 * u], 0.005 * u, BAM, 4);
    }
    rod(b, [-0.15 * u, yt, 0.14 * u], [-0.2 * u, yt + 0.03 * u, 0.24 * u], 0.005 * u, BAM, 4);
    rod(b, [-0.2 * u, yt + 0.03 * u, 0.24 * u], [-0.2 * u, yt - 0.1 * u, 0.24 * u], 0.0015 * u, '#2e241c', 3);
    lathe(b, [[0, 0], [0.018 * u, 0.004 * u], [0.024 * u, 0.02 * u], [0.02 * u, 0.022 * u], [0, 0.01 * u]], '#5a4a32', -0.2 * u, yt - 0.125 * u, 0.24 * u, 8);
    glow(ellip(b, '#ffd98a', -0.2 * u, yt - 0.095 * u, 0.24 * u, 0.006 * u, 0.012 * u, 0.006 * u), '#ffd98a', '#e8a040');
    // shoulder straps
    for (const sx of [-1, 1]) tube(b, [[sx * 0.07 * u, 0.62 * u, 0.09 * u], [sx * 0.09 * u, 0.79 * u, 0.06 * u], [sx * 0.1 * u, 0.83 * u, -0.02 * u], [sx * 0.11 * u, 0.78 * u, z0]], 0.01 * u, 0.01 * u, '#4a3a2a', { radial: 5, sub: 4 });
    // horsehair fly-whisk (拂子) in the right hand, sutra roll in the left
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.012, rz], [rx + 0.012, ry + 0.07, rz + 0.02], 0.004, '#4a2e1e', 5);
    for (let k = 0; k < 5; k++) tube(gp, [[rx + 0.012, ry + 0.07, rz + 0.02], [rx + 0.02 + k * 0.003, ry + 0.062, rz + 0.03 + (k % 2) * 0.004], [rx + 0.024 + k * 0.004, ry - 0.005 - (k % 3) * 0.006, rz + 0.034 + (k - 2) * 0.004]], 0.004, 0.002, '#e2dccb', { radial: 4, sub: 3 });
    const [lx, ly, lz] = a.handL;
    const sl = cyl(gp, '#d8ccaa', 0, 0, 0, 0.012, 0.09, 8); sl.rotation.z = Math.PI / 2; sl.position.set(lx + 0.02, ly + 0.004, lz + 0.012);
    box(gp, '#5a4030', lx + 0.02, ly - 0.008, lz + 0.012, 0.012, 0.025, 0.027);
  },

  /** Hua Tuo (Eastern Han physician, d. 208) in his herb yard: drying trays on a bamboo rack, a Han pottery stove
   *  brewing a decoction, a bronze mortar and the 五禽戏 drawn on a silk scroll. Ref: Han 陶灶 tomb models, Mawangdui 导引图. */
  pp_huatuo: gp => {
    const y = figureBase(gp, '#aea07c', '#6b5640');
    for (let i = 0; i < 5; i++) ellip(gp, tint('#9c9070', (i % 2) * 0.06), 0.02 + Math.sin(i) * 0.03, y + 0.003, 0.42 - i * 0.075, 0.04, 0.006, 0.03, i);
    // bamboo drying rack with three round sieve trays of sliced roots, bark and leaves; tied bundles below
    const RX = -0.14, RZ = -0.3, BAM = '#9a8150';
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.06, 0.06]) rod(gp, [RX + sx, y, RZ + sz], [RX + sx, y + 0.13, RZ + sz], 0.005, BAM, 4);
    for (const yy of [0.06, 0.13]) for (const sz of [-0.06, 0.06]) rod(gp, [RX - 0.21, y + yy, RZ + sz], [RX + 0.21, y + yy, RZ + sz], 0.004, BAM, 4);
    const herbs = [['#8a6a44', '#a07c4e'], ['#5e6a44', '#6e7a50'], ['#6e4a32', '#9a7048']];
    herbs.forEach(([c1, c2], i) => {
      const t = new THREE.Group(); t.position.set(RX - 0.13 + i * 0.13, y + 0.135, RZ); t.rotation.x = 0.28; gp.add(t);
      lathe(t, [[0, 0], [0.062, 0], [0.066, 0.012], [0.06, 0.012], [0, 0.004]], '#b09868', 0, 0, 0, 16);
      for (let k = 0; k < 9; k++) ellip(t, k % 2 ? c1 : c2, Math.cos(k * 2.1) * 0.035 * ((k % 3) / 2 + 0.3), 0.008, Math.sin(k * 2.1) * 0.035 * ((k % 3) / 2 + 0.3), 0.012, 0.003, 0.008, k);
    });
    for (let i = 0; i < 4; i++) {
      const bx = RX - 0.15 + i * 0.1, bd = cyl(gp, i % 2 ? '#7a7048' : '#8a6a48', 0, 0, 0, 0.014, 0.07, 6);
      bd.rotation.z = Math.PI / 2; bd.position.set(bx, y + 0.075, RZ); box(gp, '#4a3a2a', bx, y + 0.06, RZ, 0.005, 0.03, 0.03);
    }
    // Han pottery stove (陶灶): firebox with a stoke-hole, a cauldron (釜) with a lid, and a chimney
    const SX = 0.27, SZ = -0.14;
    rbox(gp, '#857868', SX, y, SZ, 0.11, 0.07, 0.15, 0.01, -0.5);
    const door = new THREE.Group(); door.position.set(SX, y, SZ); door.rotation.y = -0.5; gp.add(door);
    box(door, '#241c18', 0, 0.008, 0.076, 0.04, 0.03, 0.004);
    glow(box(door, '#8a3a1a', 0, 0.01, 0.075, 0.03, 0.012, 0.004), '#8a3a1a', '#7a2a10');
    cyl(door, '#857868', 0, 0.07, -0.06, 0.012, 0.09, 8);
    lathe(door, [[0, 0], [0.03, 0.005], [0.042, 0.025], [0.034, 0.045], [0.03, 0.05], [0, 0.05]], '#3e3630', 0, 0.06, 0.02, 14);
    lathe(door, [[0, 0], [0.034, 0], [0.02, 0.012], [0.006, 0.016], [0, 0.016]], '#4a4038', 0, 0.11, 0.02, 12);
    for (let k = 0; k < 4; k++) rod(gp, [SX + 0.08 + k * 0.012, y + 0.004, SZ + 0.1 - k * 0.01], [SX + 0.02 + k * 0.01, y + 0.008, SZ + 0.16], 0.004, '#5a4632', 3);
    // bronze mortar (臼) and pestle
    lathe(gp, [[0, 0], [0.032, 0], [0.042, 0.03], [0.038, 0.05], [0.031, 0.05], [0.027, 0.02], [0, 0.015]], '#5e5a44', 0.2, y, 0.24, 14);
    rod(gp, [0.2, y + 0.03, 0.24], [0.23, y + 0.1, 0.22], 0.006, '#4a4436');
    // low table (案) with the silk 五禽戏 chart, bamboo slips and a bowl of decoction
    const ax = -0.24, az = 0.16;
    box(gp, '#3e2a1e', ax, y + 0.05, az, 0.17, 0.012, 0.09, 0.4);
    for (const sx of [-1, 1]) box(gp, '#3e2a1e', ax + Math.cos(0.4) * sx * 0.07, y, az - Math.sin(0.4) * sx * 0.07, 0.012, 0.05, 0.08, 0.4);
    const sk = new THREE.Group(); sk.position.set(ax, y + 0.062, az); sk.rotation.y = 0.4; gp.add(sk);
    box(sk, '#d4c6a2', -0.025, 0, 0, 0.09, 0.002, 0.06);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      const fx = -0.06 + i * 0.018, fz = -0.014 + j * 0.028;
      rod(sk, [fx, 0.003, fz - 0.008], [fx, 0.003, fz + 0.004], 0.0015, '#5a4030', 3);
      rod(sk, [fx - 0.005, 0.003, fz - 0.002], [fx + 0.005, 0.003, fz - 0.004 + j * 0.004], 0.0012, '#5a4030', 3);
      ellip(sk, '#5a4030', fx, 0.003, fz + 0.007, 0.003, 0.0015, 0.003);
    }
    for (let i = 0; i < 5; i++) box(sk, tint('#b89a62', (i % 2) * 0.06), 0.045 + i * 0.008, 0, 0.0, 0.007, 0.004, 0.06);
    lathe(sk, [[0, 0], [0.012, 0], [0.02, 0.014], [0.018, 0.016], [0, 0.006]], '#3a2420', 0.05, 0.004, 0.035, 12);
    // mugwort and other medicinal plants by the yard edge
    for (const [px, pz] of [[-0.37, -0.06], [-0.34, 0.02], [0.38, 0.08]]) for (let k = 0; k < 4; k++) {
      const tx = px + Math.cos(k * 1.6) * 0.018, tz = pz + Math.sin(k * 1.6) * 0.018, hh = 0.07 + (k % 2) * 0.02;
      rod(gp, [tx, y, tz], [tx, y + hh, tz], 0.002, '#5a6a40', 3);
      for (let j = 0; j < 3; j++) ellip(gp, j % 2 ? '#6a7a4c' : '#7a8658', tx + (j % 2 ? 0.008 : -0.008), y + hh * (0.45 + j * 0.2), tz, 0.011, 0.003, 0.006, k, 0, j % 2 ? -0.5 : 0.5);
    }
    const o: FigureOpts = {
      y, x: 0.02, z: 0.06, top: '#bdb091', accent: '#5a4a3a', bottom: '#a89c80', outfit: 'robe', wideSleeves: true, hair: '#cfcac0', hairStyle: 'topknot',
      beard: 'long', beardColor: '#e4e0d6', skin: '#d9a982', shoes: '#2e2620',
      armL: { fwd: 0.4, side: 0.2, bend: 0.7, inward: 0.1 }, armR: { fwd: 1.25, side: 0.35, bend: 0.9 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR;
    // Han commoner's head-cloth (帻) wrapped round the head below the topknot
    lathe(b, [[hr * 1.05, 0], [hr * 1.07, 0], [hr * 1.03, hr * 0.4], [hr * 0.9, hr * 0.64], [hr * 0.5, hr * 0.76], [0, hr * 0.8]], '#2e2a26', 0, 0.93 * u + hr * 0.28, -hr * 0.06, 16);
    ellip(b, '#2e2a26', 0, 0.93 * u + hr * 1.18, -hr * 0.1, hr * 0.4, hr * 0.38, hr * 0.4);
    // medicine gourd on the belt
    ellip(b, '#a8844c', 0.14 * u, 0.42 * u, 0.07 * u, 0.038 * u, 0.042 * u, 0.038 * u);
    ellip(b, '#a8844c', 0.14 * u, 0.48 * u, 0.07 * u, 0.026 * u);
    box(b, '#5a4030', 0.14 * u, 0.505 * u, 0.07 * u, 0.01 * u, 0.03 * u, 0.01 * u);
    // a freshly cut herb held up
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.02, rz], [rx + 0.01, ry + 0.09, rz + 0.01], 0.003, '#4e5a36', 4);
    for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? '#5e6e40' : '#6e7c4c', rx + (k % 2 ? 0.013 : -0.011), ry + 0.02 + k * 0.012, rz + 0.01, 0.013, 0.005, 0.007, 0, 0, k % 2 ? -0.6 : 0.6);
    // bamboo herb basket in the left hand
    const [lx, ly, lz] = a.handL;
    lathe(gp, [[0, 0], [0.04, 0], [0.05, 0.035], [0.047, 0.04], [0.038, 0.01], [0, 0.008]], '#9a8150', lx, ly - 0.06, lz + 0.02, 12);
    ring(gp, '#7a6440', lx, ly - 0.015, lz + 0.02, 0.04, 0, 0, 0, 0.08);
    for (let k = 0; k < 5; k++) ellip(gp, k % 2 ? '#6a5236' : '#5e6a44', lx + Math.cos(k * 1.3) * 0.022, ly - 0.025, lz + 0.02 + Math.sin(k * 1.3) * 0.022, 0.016, 0.008, 0.01);
  },

  /** Marco Polo, Venetian merchant at the Yuan court (1275–92): 13th-c. Italian gown, mantle and coif, holding the gold
   *  paiza (牌子) of Kublai Khan; a laden Bactrian camel and a felt ger at Shangdu. Ref: Met paiza, 13th-c. Italian dress. */
  pp_marcopolo: gp => {
    const y = figureBase(gp, '#aaa47c', '#6e6046');
    for (let i = 0; i < 14; i++) { const a2 = i * 2.2, r = 0.16 + (i % 4) * 0.07; ellip(gp, tint('#8e9064', (i % 3) * 0.05), Math.cos(a2) * r, y + 0.002, Math.sin(a2) * r, 0.03, 0.004, 0.02, a2); }
    // Mongol felt ger with lattice band, roof ropes and a painted wooden door
    const GX = 0.24, GZ = -0.2;
    lathe(gp, [[0, 0], [0.15, 0], [0.152, 0.09], [0.14, 0.1], [0.03, 0.17], [0, 0.17]], '#d6ccb4', GX, y, GZ, 22);
    lathe(gp, [[0.026, 0.168], [0.034, 0.168], [0.034, 0.18], [0.026, 0.18]], '#6b5a46', GX, y, GZ, 12);
    for (const yy of [0.03, 0.075]) lathe(gp, [[0.151, yy], [0.155, yy], [0.155, yy + 0.006], [0.151, yy + 0.006]], '#6b5a46', GX, y, GZ, 22);
    const dg = new THREE.Group(); dg.position.set(GX, y, GZ); dg.rotation.y = -0.45; gp.add(dg);
    box(dg, '#7a4a2e', 0, 0, 0.15, 0.05, 0.08, 0.01);
    box(dg, '#a88a4c', 0, 0.035, 0.156, 0.03, 0.004, 0.002);
    camel(gp, -0.15, y, -0.2, 0.5, Math.PI + 0.4);
    // trade goods: felt-wrapped bales and a bolt of silk
    for (const [bx, bz, br] of [[0.3, 0.12, 0.3], [0.33, 0.22, -0.2]] as const) {
      rbox(gp, '#8c7a5c', bx, y, bz, 0.08, 0.045, 0.06, 0.012, br);
      box(gp, '#4a3a2a', bx, y, bz, 0.008, 0.047, 0.062, br);
    }
    const bolt = cyl(gp, '#6e4a52', 0, 0, 0, 0.018, 0.07, 10); bolt.rotation.set(Math.PI / 2, 0, 0.7); bolt.position.set(0.22, y + 0.018, 0.26);
    const o: FigureOpts = {
      y, x: -0.03, z: 0.1, top: '#6e2c24', accent: '#3a2a20', bottom: '#4a2a22', outfit: 'dress', cape: '#3d4656', hair: '#5a3a22', hairStyle: 'short',
      beard: 'short', beardColor: '#5a3a22', skin: '#e0b896', shoes: '#2a201a',
      armL: { fwd: 0.35, side: 0.25, bend: 0.5, inward: 0.1 }, armR: { fwd: 1.0, side: 0.12, bend: 0.75, inward: 0.35 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR;
    // soft round felt cap with a rolled brim
    lathe(b, [[hr * 1.06, 0], [hr * 1.12, hr * 0.1], [hr * 1.06, hr * 0.24], [hr * 0.96, hr * 0.27], [hr * 0.92, hr * 0.5], [hr * 0.6, hr * 0.72], [0, hr * 0.78]], '#3e3228', 0, 0.93 * u + hr * 0.42, -hr * 0.04, 16);
    // leather purse (escarcelle) and knife on the belt
    rbox(b, '#4a3424', -0.1 * u, 0.44 * u, 0.09 * u, 0.05 * u, 0.06 * u, 0.02 * u, 0.006 * u);
    rod(b, [0.11 * u, 0.5 * u, 0.08 * u], [0.13 * u, 0.4 * u, 0.09 * u], 0.008 * u, '#2a201a', 4);
    // travelling staff in the left hand
    const [lx, ly, lz] = a.handL;
    rod(gp, [lx - 0.01, y, lz + 0.01], [lx + 0.006, ly + 0.2, lz - 0.004], 0.006, '#5a4632', 6);
    // gold paiza: a round-topped tablet with a hanging ring, held up to show
    const [rx, ry, rz] = a.handR, pz = new THREE.Group(); pz.position.set(rx, ry + 0.045, rz + 0.015); gp.add(pz);
    metal(box(pz, '#b8954a', 0, -0.035, 0, 0.026, 0.06, 0.004), '#b8954a', 0.7, 0.35);
    const disc = metal(cyl(pz, '#b8954a', 0, 0, 0, 0.013, 0.004, 14), '#b8954a', 0.7, 0.35); disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.025, 0);
    ring(pz, '#8a6a3a', 0, 0.042, 0, 0.007, Math.PI / 2, 0, 0, 0.2);
    for (let k = 0; k < 3; k++) box(pz, '#6e5226', -0.006 + k * 0.006, -0.03, 0.0025, 0.002, 0.045, 0.001);
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
const BIAS: Record<string, number> = { pp_amundsen: 1.25 };

export const H_PEOPLE_C: Record<string, Builder> = Object.fromEntries(
  Object.entries(BUILDERS).map(([k, f]) => [k, ((gp, r) => { f(gp, r); slim(gp, BIAS[k]); }) as Builder]),
);
