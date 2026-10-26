import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, box, cone, cyl, g, lathe, mat, plinth, prism, rbox, rod, shade, SITE, sweep, tree, tube } from '../prims.ts';
import { figure } from '../figure.ts';
import { human } from '../human.ts';

// Famous people B: artists, writers, poets and musicians. Each is a figurine diorama on the shared museum plinth (figure ≈0.53 tall after settle)
// with the props and a miniature scene that make them recognisable.

const PAPER = '#eadfc6', INK = '#241e18';

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
/** paint rectangle / blob on a canvas group */

/** Open book held/lying: group with pages facing +y; text lines in grey. */

/** Closed book lying flat (spine on -x). */

/** Feather quill from the hand `base` toward `tip`. */

/** Writing / painting brush held in the hand: handle from a to b with a tapered tip beyond b. */
function brush(p: THREE.Object3D, a: V3, b: V3, tip = INK, handle = '#c0a573', r = 0.0035): void {
  rod(p, a, b, r, handle);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  tube(p, [b, off(b, d.x * 0.012, d.y * 0.012, d.z * 0.012), off(b, d.x * 0.024, d.y * 0.024, d.z * 0.024)], r * 1.5, r * 0.3, tip, { radial: 6, sub: 2 });
}

/** Artist's palette in the hand with paint dabs. */

/** Scatter a ring of small rocks / pebbles around (x, z). */
function rocks(p: THREE.Object3D, x: number, y: number, z: number, rx: number, rz: number, n: number, c = '#8e8a80', s = 0.022): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const k = 0.8 + ((i * 37) % 7) / 14;
    ellip(p, shade(c, 0.88 + (i % 3) * 0.08), x + Math.cos(a) * rx, y + 0.004, z + Math.sin(a) * rz, s * k, s * 0.55 * k, s * 0.85 * k, a);
  }
}

/** Water surface with a few lighter ripple rings. */
function pond(p: THREE.Object3D, x: number, y: number, z: number, rx: number, rz: number, c = '#447292'): void {
  disc(p, c, x, y, z, rx, rz, 0.01, 28);
  for (let i = 0; i < 3; i++) {
    const m = add(p, g('pb-ring', () => new THREE.TorusGeometry(1, 0.06, 4, 24)), mat(shade(c, 1.35)), x + (i - 1) * rx * 0.35, y + 0.0105, z + ((i * 5) % 3 - 1) * rz * 0.3, rx * 0.16, rx * 0.16, rz * 0.12, 0, Math.PI / 2);
    m.castShadow = false;
  }
}

/** Ruff collar (Elizabethan / Spanish) around the figure's neck. */

/** Tiny floating music note (head + stem + flag). */

// ---------------------------------------------------------------- Li Bai: chanting as he strolls under the moon
// Ref: 梁楷《李白行吟图》 (Southern Song, Tokyo National Museum; Commons "Liang Kai - Li Bai Strolling.jpg"): a lone
// figure in a plain, loose ankle-length robe, hair in a simple topknot, no cap, hands behind the back, head tipped up as
// he chants. Setting after 《月下独酌》: a rock ledge with the full moon rising behind, an old pine, a still pool holding
// the moon, the stoneware wine jar and a cup on a rush mat.
const libai: Builder = gp => {
  const Y = base(gp, SITE.grass);
  // weathered rock ledge behind, the full moon just clearing it
  for (const [x, y, z, sx, sy, sz, c] of [[-0.25, 0.06, -0.27, 0.15, 0.09, 0.1, '#6b6b64'], [-0.17, 0.035, -0.2, 0.1, 0.05, 0.08, '#77766d'], [-0.3, 0.15, -0.29, 0.09, 0.07, 0.07, '#626259'], [-0.06, 0.03, -0.3, 0.09, 0.04, 0.07, '#7a796f']] as const)
    ellip(gp, c, x, Y + y, z, sx, sy, sz, x * 7);
  const moon = cyl(gp, '#e9e4ce', -0.36, Y + 0.29, -0.25, 0.055, 0.006, 28);
  moon.rotation.x = Math.PI / 2;
  glow(moon, '#e4dec6', '#6e6650');
  // an old pine leaning over the pool
  tree(gp, 0.3, Y, -0.18, 0.34, '#4f6a46', true);
  pond(gp, 0.17, Y, 0.21, 0.17, 0.12, '#3e5868');
  disc(gp, '#a9ab9c', 0.12, Y + 0.0102, 0.2, 0.024, 0.016, 0.002); // the moon in the water
  rocks(gp, 0.17, Y, 0.21, 0.18, 0.13, 9, '#7d7b72', 0.02);
  // rush mat with a stoneware wine jar (cloth-tied lid) and a small celadon cup
  rbox(gp, '#a28f62', -0.22, Y, 0.17, 0.16, 0.006, 0.12, 0.003, 0.3);
  lathe(gp, [[0, 0], [0.032, 0], [0.05, 0.035], [0.048, 0.07], [0.026, 0.092], [0.022, 0.1], [0, 0.1]], '#4a3a2c', -0.25, Y + 0.006, 0.16, 14);
  ellip(gp, '#b8a888', -0.25, Y + 0.104, 0.16, 0.028, 0.012, 0.028);
  cyl(gp, '#7a6a4a', -0.25, Y + 0.094, 0.16, 0.024, 0.006, 12);
  lathe(gp, [[0.006, 0], [0.012, 0.004], [0.022, 0.024], [0.02, 0.026], [0.009, 0.012], [0, 0.012]], '#9fae96', -0.16, Y + 0.006, 0.2, 14);
  const a = figure(gp, {
    y: Y, z: -0.02, x: 0.0, ry: -0.35, lean: -0.05, top: '#c6bea8', accent: '#5a5246', bottom: '#a8a08a', outfit: 'robe', wideSleeves: true,
    hair: '#1f1a17', hairStyle: 'topknot', beard: 'goatee', beardColor: '#1f1a17', shoes: '#2b2622',
    armR: { fwd: -0.6, side: 0.1, bend: 1.1, inward: 0.9 }, armL: { fwd: -0.6, side: 0.1, bend: 1.1, inward: 0.9 },
  });
  // the wine gourd tied at his hip
  const hip = offR([a.group.position.x, a.group.position.y, a.group.position.z], -0.35, 0.1 * a.u, 0.5 * a.u, 0.03 * a.u);
  ellip(gp, '#a7844f', hip[0], hip[1] - 0.012, hip[2], 0.013, 0.015, 0.013);
  ellip(gp, '#a7844f', hip[0], hip[1] - 0.04, hip[2], 0.02, 0.022, 0.02);
};

// ---------------------------------------------------------------- Qu Yuan: wandering by the Miluo
// 陈洪绶《屈子行吟图》 (1616): gaunt, stooping, the tall slanted 切云冠 and the long sword (长铗) at his waist, hands in
// his sleeves; 《渔父》: "行吟泽畔，颜色憔悴" — a reedy bank of the Miluo with orchids (兰) and the fisherman's skiff.
const quyuan: Builder = gp => {
  const Y = base(gp, SITE.grass);
  const river: [number, number][] = [];
  for (let i = 0; i <= 20; i++) { const t = 0.06 * Math.PI + (i / 20) * 0.88 * Math.PI; river.push([Math.cos(t) * 0.445, Math.sin(t) * 0.445]); }
  river.push([-0.3, 0.2], [0.3, 0.2]);
  prism(gp, river.map(([x, z]) => [x, z]), Y, 0.008, '#4b6a6c');
  for (let i = 0; i < 5; i++) box(gp, '#6f8c8a', -0.26 + i * 0.13, Y + 0.008, 0.34 - (i % 2) * 0.05, 0.05, 0.002, 0.006);
  // the fisherman's skiff drifting on the river
  const sk = grp(gp, 0.17, Y + 0.008, 0.33, -0.25);
  sweep(sk, [
    { p: [-0.13, 0.024, 0], w: 0.008, h: 0.008 }, { p: [-0.08, 0.012, 0], w: 0.04, h: 0.024 },
    { p: [0.04, 0.01, 0], w: 0.046, h: 0.026 }, { p: [0.11, 0.016, 0], w: 0.03, h: 0.02 }, { p: [0.14, 0.026, 0], w: 0.01, h: 0.008 },
  ], '#5a4632', { radial: 10, sub: 4, squash: 0.7 });
  box(sk, '#6e5a40', 0, 0.024, 0, 0.17, 0.004, 0.034);
  human(sk, -0.04, 0.026, 0, { h: 0.26, ry: Math.PI / 2, pose: 'sit', top: '#7a7462', bottom: '#5e5a4c', hair: '#2a2420', hat: '#a08a5a', hatStyle: 'conical', detail: 'lo', hipY: 0.12, feet: [[-0.07, 0.03, 0.22], [0.07, 0.03, 0.21]] });
  rod(sk, [0.0, 0.12, 0.02], [0.1, -0.02, 0.06], 0.005, '#6b5034');
  // reeds and orchids on the bank
  const reed = (x: number, z: number, h: number) => {
    for (let i = 0; i < 4; i++) {
      const t = i * 1.9 + x * 13, dx = Math.cos(t) * 0.012, dz = Math.sin(t) * 0.012, hh = h * (0.75 + (i % 3) * 0.15);
      tube(gp, [[x + dx, Y, z + dz], [x + dx * 1.5, Y + hh * 0.6, z + dz * 1.5], [x + dx * 2.5 + 0.01, Y + hh, z + dz * 2.5]], 0.004, 0.003, i % 2 ? '#7d7c4e' : '#6a7448', { radial: 4, sub: 2 });
      if (i % 2 === 0) ellip(gp, '#b3a27c', x + dx * 2.5 + 0.01, Y + hh + 0.012, z + dz * 2.5, 0.007, 0.018, 0.007, 0, 0, -0.2);
    }
  };
  for (const [rx, rz, h] of [[-0.34, 0.16, 0.2], [-0.28, 0.2, 0.16], [0.36, 0.12, 0.19], [0.3, 0.19, 0.14], [-0.05, 0.22, 0.12]]) reed(rx, rz, h);
  const orchid = (x: number, z: number) => {
    for (let i = 0; i < 6; i++) {
      const t = i * 1.05 + x * 7, c = Math.cos(t), s = Math.sin(t);
      tube(gp, [[x, Y, z], [x + c * 0.03, Y + 0.05, z + s * 0.03], [x + c * 0.07, Y + 0.035, z + s * 0.07]], 0.0045, 0.002, '#3e5a34', { radial: 4, sub: 2 });
    }
    for (let i = 0; i < 3; i++) ellip(gp, '#d5cfa7', x + Math.cos(i * 2.1) * 0.015, Y + 0.06 + i * 0.008, z + Math.sin(i * 2.1) * 0.015, 0.007, 0.005, 0.007);
  };
  orchid(0.2, -0.12); orchid(-0.25, -0.05); orchid(0.3, -0.25);
  rocks(gp, -0.22, Y, -0.24, 0.07, 0.05, 5, '#7d7b70', 0.03);
  const a = figure(gp, {
    y: Y, z: -0.06, x: -0.02, ry: 0.15, lean: 0.07, top: '#5b6656', accent: '#2a2a24', bottom: '#3e463b', outfit: 'robe', wideSleeves: true, hair: '#2a2622', hairStyle: 'topknot',
    beard: 'long', beardColor: '#3a3632', armR: { fwd: 0.6, side: 0.02, bend: 1.25, inward: 0.62 }, armL: { fwd: 0.6, side: 0.02, bend: 1.25, inward: 0.62 },
  });
  const body = a.group.children[0] as THREE.Group, u = a.u, hr = a.headR, ty = 0.93 * u + hr * 0.95;
  // 切云冠: a tall black cap rising and slanting back from the topknot, with a hairpin
  const hat = grp(body, 0, ty - hr * 0.15, -hr * 0.2, 0, -0.5);
  box(hat, '#1d1c1a', 0, 0, 0, hr * 0.9, hr * 1.8, hr * 1.05);
  box(hat, '#2b2926', 0, hr * 1.8, 0, hr * 1.0, hr * 0.14, hr * 1.2);
  rod(body, [-hr * 1.0, ty + hr * 0.35, -hr * 0.2], [hr * 1.0, ty + hr * 0.35, -hr * 0.2], 0.004, '#b29758');
  // 长铗: the long sword slung at the left hip, hilt forward, scabbard trailing behind
  const H: V3 = [-0.15 * u, 0.6 * u, 0.15 * u], T: V3 = [-0.2 * u, 0.1 * u, -0.3 * u];
  const sw = aim(body, H, [T[0] - H[0], T[1] - H[1], T[2] - H[2]]), L = Math.hypot(T[0] - H[0], T[1] - H[1], T[2] - H[2]);
  box(sw, '#4a3a28', 0, 0, 0.05 * u, 0.018 * u, 0.018 * u, 0.1 * u);
  box(sw, '#83723c', 0, 0, 0.105 * u, 0.04 * u, 0.034 * u, 0.012 * u);
  box(sw, '#2a2420', 0, 0, (0.11 * u + L) / 2, 0.02 * u, 0.026 * u, L - 0.11 * u);
  box(sw, '#83723c', 0, 0, L, 0.024 * u, 0.03 * u, 0.02 * u);
};

// ---------------------------------------------------------------- Wang Xizhi: the Orchid Pavilion, watching geese
// 钱选《王羲之观鹅图》 (Met), 《兰亭集序》 (353) and the 《历代名臣像》 portrait (soft grey-brown 幅巾, celadon-grey robe with a
// dark blue collar, long beard): an Eastern Jin scholar in 褒衣博带 by the
// pavilion, a winding stream (曲水) with a floating 羽觞 wine cup, Chinese geese, 茂林修竹, a low 案 with his writing.
function goose(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const q = grp(p, x, y, z, ry);
  ellip(q, '#eae6dc', 0, 0.035 * s, 0, 0.026 * s, 0.024 * s, 0.045 * s);
  ellip(q, '#e2ded2', 0, 0.042 * s, -0.035 * s, 0.014 * s, 0.014 * s, 0.022 * s, 0, 0.5);
  tube(q, [[0, 0.05 * s, 0.03 * s], [0, 0.08 * s, 0.045 * s], [0, 0.105 * s, 0.04 * s]], 0.009 * s, 0.008 * s, '#eae6dc', { radial: 7, sub: 3 });
  ellip(q, '#eae6dc', 0, 0.112 * s, 0.048 * s, 0.012 * s, 0.012 * s, 0.016 * s);
  ellip(q, '#b88852', 0, 0.108 * s, 0.07 * s, 0.005 * s, 0.005 * s, 0.012 * s);
  ellip(q, '#aa7946', 0, 0.12 * s, 0.059 * s, 0.006 * s); // the knob at the base of the bill of the Chinese goose
  for (const sx of [-1, 1]) {
    ellip(q, INK, sx * 0.01 * s, 0.116 * s, 0.054 * s, 0.002 * s);
    rod(q, [sx * 0.01 * s, 0.015 * s, 0], [sx * 0.01 * s, 0, 0.005 * s], 0.0025 * s, '#b4874e');
  }
}

const wangxizhi: Builder = gp => {
  const Y = base(gp, SITE.grass);
  // the Orchid Pavilion: a square open pavilion with a hipped pyramid roof on a stone platform
  const px = -0.24, pz = -0.22;
  rbox(gp, '#9c968a', px, Y, pz, 0.17, 0.014, 0.17, 0.004);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(gp, '#693d31', px + dx * 0.065, Y + 0.014, pz + dz * 0.065, 0.008, 0.15, 8);
  box(gp, '#563228', px, Y + 0.15, pz, 0.15, 0.014, 0.15);
  cone(gp, '#4a4f4c', px, Y + 0.16, pz, 0.135, 0.09, 4, Math.PI / 4);
  cone(gp, '#3d423f', px, Y + 0.24, pz, 0.012, 0.03, 6);
  // 茂林修竹: a bamboo grove behind
  for (const [bx, bz, h] of [[0.3, -0.24, 0.42], [0.35, -0.16, 0.34], [0.25, -0.3, 0.38], [0.16, -0.34, 0.33], [0.38, -0.05, 0.28]]) {
    cyl(gp, '#6d8545', bx, Y, bz, 0.008, h, 7);
    for (let k = 1; k < 5; k++) cyl(gp, '#556731', bx, Y + h * k / 5, bz, 0.0095, 0.006, 7);
    for (let k = 0; k < 4; k++) ellip(gp, '#4f6e3a', bx + (k % 2 ? 0.025 : -0.025), Y + h * (0.55 + k * 0.12), bz + 0.01, 0.03, 0.005, 0.009, k % 2 ? 0.4 : -0.4, 0, k % 2 ? -0.5 : 0.5);
  }
  // 曲水: a winding stream across the front with a floating lacquer 羽觞 and geese
  const st: V3[] = [[-0.44, 0, 0.08], [-0.25, 0, 0.2], [-0.05, 0, 0.14], [0.12, 0, 0.27], [0.3, 0, 0.24], [0.44, 0, 0.1]];
  for (let i = 0; i < st.length; i++) {
    disc(gp, '#4b6a72', st[i][0], Y, st[i][2], 0.035, 0.035, 0.007, 16);
    if (i === 0) continue;
    const [x0, , z0] = st[i - 1], [x1, , z1] = st[i];
    box(gp, '#4b6a72', (x0 + x1) / 2, Y, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0), 0.007, 0.07, Math.atan2(-(z1 - z0), x1 - x0));
  }
  rocks(gp, -0.05, Y, 0.14, 0.06, 0.06, 4, '#86827a', 0.018);
  rocks(gp, 0.3, Y, 0.24, 0.06, 0.06, 4, '#86827a', 0.018);
  const cup = grp(gp, 0.05, Y + 0.008, 0.2, 0.6);
  ellip(cup, '#2a1a14', 0, 0, 0, 0.022, 0.008, 0.014);
  ellip(cup, '#6a352c', 0, 0.004, 0, 0.017, 0.004, 0.01);
  for (const sx of [-1, 1]) box(cup, '#2a1a14', 0, 0.006, sx * 0.016, 0.018, 0.003, 0.008);
  goose(gp, -0.26, Y + 0.002, 0.19, 0.9, 0.95);
  goose(gp, -0.14, Y + 0.002, 0.2, 1.6, 0.8);
  goose(gp, 0.2, Y, 0.37, -2.4, 0.85);
  // low writing table (案) on a mat: paper with columns of characters, inkstone, brush rest
  const tx = 0.2, tz = 0.02;
  rbox(gp, '#9a8a62', tx, Y, tz, 0.2, 0.005, 0.14, 0.002, -0.3);
  const tb = grp(gp, tx, Y + 0.005, tz, -0.3);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(tb, '#2e221a', dx * 0.075, 0, dz * 0.04, 0.012, 0.06, 0.012);
  rbox(tb, '#3a2a20', 0, 0.06, 0, 0.18, 0.012, 0.1, 0.004);
  box(tb, PAPER, 0.01, 0.072, 0.005, 0.13, 0.002, 0.08);
  for (let c = 0; c < 6; c++) for (let r = 0; r < 5; r++)
    box(tb, INK, 0.06 - c * 0.02, 0.0735, -0.026 + r * 0.013, 0.008, 0.001, 0.007 + ((c + r) % 3) * 0.002, 0, (c * r) % 2 ? 0.5 : -0.3);
  rbox(tb, '#2b2d30', -0.07, 0.072, -0.01, 0.026, 0.008, 0.04, 0.003);
  const a = figure(gp, {
    y: Y, z: -0.06, x: -0.04, ry: -0.35, top: '#9ea690', accent: '#34404e', bottom: '#848a76', outfit: 'robe', wideSleeves: true, hair: '#1c1917', hairStyle: 'topknot',
    hat: 'scholar', hatColor: '#5e544a', beard: 'long', beardColor: '#2a2522', armR: { fwd: 0.75, side: 0.25, bend: 0.9, inward: 0.1 }, armL: { fwd: 0.55, side: 0.02, bend: 1.2, inward: 0.6 },
  });
  // brush just lifted from the paper
  brush(gp, off(a.handR, 0, 0.05, 0), off(a.handR, 0.004, -0.035, 0.01));
};

/** Shared museum plinth (walnut side, site-coloured top); its meshes are tagged so `settle` leaves them alone. */
function base(gp: THREE.Object3D, top: string): number {
  const n = gp.children.length, h = plinth(gp, top);
  for (const c of gp.children.slice(n)) c.userData.plinth = true;
  return h;
}
/**
 * Scales the scene above the plinth (figure, props, scenery) by k about the plinth top: the hero, authored at the
 * figure.ts default 0.62, ends up ≈0.53 tall, in scale with the map's building dioramas, and stays inside the rim.
 */
function settle(gp: THREE.Object3D, k = 0.85): void {
  const top = 0.035, s = new THREE.Group();
  s.position.y = top;
  s.scale.setScalar(k);
  for (const c of [...gp.children]) if (!c.userData.plinth) { c.position.y -= top; s.add(c); }
  gp.add(s);
}

/** lighten every diorama after building */
const lite = (b: Builder): Builder => (gp, r) => {
  b(gp, r);
  settle(gp);
  lighten(gp);
};

export const H_PEOPLE_B: Record<string, Builder> = { pp_libai: lite(libai), pp_quyuan: lite(quyuan), pp_wangxizhi: lite(wangxizhi) };
