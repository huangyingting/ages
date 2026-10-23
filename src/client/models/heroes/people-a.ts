import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, archPath, BOX, cone, CYL, g, gable, hash3, lathe, mat, panel, paintFaces, rbox, rod, shade, strut, tube } from '../prims.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { figure, figureBase, type FigureAnchors, type FigureOpts } from '../figure.ts';

// Famous thinkers, scientists, inventors and doctors as collectible figurine dioramas: the shared figurine on a round
// base, holding signature props, with a tiny themed scene around it. Camera-facing side is front-left (-x, +z).

type O = THREE.Object3D;
const LO = () => g('pa-sph', () => new THREE.SphereGeometry(1, 12, 8));
const TINY = () => g('pa-sph6', () => new THREE.SphereGeometry(1, 8, 6));
const ROCK = () => g('pa-rock', () => new THREE.IcosahedronGeometry(1, 0));
/** light smooth ellipsoid */
const bl = (p: O, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, Math.max(rx, ry, rz) < 0.016 ? TINY() : LO(), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
/** centred box */
const cb = (p: O, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
  add(p, BOX(), mat(c), x, y, z, sx, sy, sz, ry, rx, rz);
/** centred cylinder (axis = local y) */
const cc = (p: O, c: string, x: number, y: number, z: number, r: number, h: number, s = 10, ry = 0, rx = 0, rz = 0) =>
  add(p, CYL(s), mat(c), x, y, z, r * 2, h, r * 2, ry, rx, rz);
/** torus ring in the XY plane (normal +z) with tube = t × radius */
const ring = (p: O, c: string, x: number, y: number, z: number, R: number, t: number, ry = 0, rx = 0, rz = 0, m?: THREE.Material) =>
  add(p, g('pa-tor' + t.toFixed(2), () => new THREE.TorusGeometry(1, t, 6, 28)), m ?? mat(c, { metal: 0.5, rough: 0.35 }), x, y, z, R, R, R, ry, rx, rz);
const glow = (c: string, e = c) => mat(c, { emissive: e });
const glass = () => mat('#dbeafe', { transparent: 0.38, rough: 0.12, metal: 0.1 });
const metal = (c: string) => mat(c, { metal: 0.55, rough: 0.35, flat: false });
const rock = (p: O, c: string, x: number, y: number, z: number, s: number, sy = 0.7) =>
  add(p, ROCK(), mat(c), x, y, z, s, s * sy, s * 0.9, hash3(x * 9, y, z * 9) * 6);

function grp(p: O, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, name = ''): THREE.Group {
  const q = new THREE.Group();
  q.position.set(x, y, z);
  q.rotation.set(rx, ry, rz);
  if (name) q.name = name;
  p.add(q);
  return q;
}
/** flat stroke between two points in the parent's XY plane */
function seg(p: O, c: string | THREE.Material, x0: number, y0: number, x1: number, y1: number, w: number, d = 0.004, z = 0): THREE.Mesh {
  const L = Math.hypot(x1 - x0, y1 - y0);
  return add(p, BOX(), typeof c === 'string' ? mat(c) : c, (x0 + x1) / 2, (y0 + y1) / 2, z, L + w, w, d, 0, 0, Math.atan2(y1 - y0, x1 - x0));
}

// ---- tiny stroke font for blackboards, slates and steles
type Stroke = [number, number, number, number];
const SEG7: Record<string, Stroke> = { a: [0, 1, 0.6, 1], b: [0.6, 1, 0.6, 0.5], c: [0.6, 0.5, 0.6, 0], d: [0, 0, 0.6, 0], e: [0, 0, 0, 0.5], f: [0, 0.5, 0, 1], g: [0, 0.5, 0.6, 0.5] };
const DIG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const GL: Record<string, Stroke[]> = {
  E: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0, 0.5, 0.45, 0.5], [0, 0, 0.6, 0]],
  '=': [[0, 0.3, 0.6, 0.3], [0, 0.66, 0.6, 0.66]],
  m: [[0, 0, 0, 0.6], [0, 0.6, 0.6, 0.6], [0.3, 0.6, 0.3, 0], [0.6, 0.6, 0.6, 0]],
  c: [[0.55, 0.6, 0, 0.6], [0, 0.6, 0, 0], [0, 0, 0.55, 0]],
  p: [[0, 0.62, 0, 0.62], [0.05, 0.72, 0.65, 0.72], [0.18, 0.72, 0.14, 0], [0.48, 0.72, 0.53, 0]], // π
  '.': [[0.08, 0, 0.1, 0]],
  R: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0.6, 1, 0.6, 0.5], [0.6, 0.5, 0, 0.5], [0.25, 0.5, 0.6, 0]],
  a: [[0, 0.6, 0.6, 0.6], [0.6, 0.6, 0.6, 0], [0.6, 0, 0, 0], [0, 0, 0, 0.3], [0, 0.3, 0.6, 0.3]],
  P: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0.6, 1, 0.6, 0.5], [0.6, 0.5, 0, 0.5]],
  o: [[0, 0, 0, 0.6], [0, 0.6, 0.6, 0.6], [0.6, 0.6, 0.6, 0], [0.6, 0, 0, 0]],
  '+': [[0, 0.5, 0.6, 0.5], [0.3, 0.2, 0.3, 0.8]],
  x: [[0, 0, 0.6, 0.6], [0, 0.6, 0.6, 0]],
  ' ': [],
};
for (let i = 0; i < 10; i++) GL[String(i)] = [...DIG[i]].map(k => SEG7[k]);
/** Writes text in the parent's XY plane (facing +z), centred on x with baseline y. '^' makes the next glyph a superscript. */
function write(p: O, text: string, x: number, y: number, z: number, s: number, c: string | THREE.Material, w = 0.13): void {
  const items: { ch: string; sup: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '^') { items.push({ ch: text[++i], sup: true }); continue; }
    items.push({ ch: text[i], sup: false });
  }
  const adv = (it: { ch: string; sup: boolean }) => (it.ch === '.' ? 0.38 : 0.95) * s * (it.sup ? 0.6 : 1);
  let cx = x - items.reduce((a, it) => a + adv(it), 0) / 2 + s * 0.1;
  for (const it of items) {
    const k = it.sup ? s * 0.6 : s, oy = it.sup ? y + s * 0.62 : y;
    for (const [x0, y0, x1, y1] of GL[it.ch] ?? []) seg(p, c, cx + x0 * k, oy + y0 * k, cx + x1 * k, oy + y1 * k, s * w, 0.003, z);
    cx += adv(it);
  }
}

// ---- props
/** closed book lying in its local XY plane (w × h, thickness t along z) */
function book(p: O, c: string, x: number, y: number, z: number, w: number, h: number, t: number, ry = 0, rx = 0, rz = 0): THREE.Group {
  const q = grp(p, x, y, z, ry, rx, rz);
  for (const sz of [-1, 1]) cb(q, c, 0, 0, sz * t * 0.42, w, h, t * 0.16);
  cb(q, shade(c, 0.85), -w / 2 + t * 0.06, 0, 0, t * 0.14, h, t);
  cb(q, '#f2e8d0', t * 0.04, 0, 0, w * 0.95, h * 0.92, t * 0.7);
  cb(q, '#d6b25e', -w / 2 + t * 0.06, h * 0.3, 0, t * 0.16, h * 0.06, t * 1.02);
  return q;
}
/** open book: two page blocks in the local XY plane facing +z, with printed lines */
function openBook(p: O, x: number, y: number, z: number, w: number, h: number, c: string, ry = 0, rx = 0, ink = '#57534e'): THREE.Group {
  const q = grp(p, x, y, z, ry, rx);
  cb(q, c, 0, 0, -0.004, w * 2.08, h * 1.04, 0.005);
  for (const sx of [-1, 1]) {
    const pg = grp(q, sx * w * 0.5, 0, 0.004, -sx * 0.16);
    cb(pg, '#f5eedb', 0, 0, 0, w * 0.98, h, 0.01);
    for (let i = 0; i < 5; i++) cb(pg, ink, 0, h * (0.32 - i * 0.15), 0.0055, w * (i === 4 ? 0.5 : 0.75), h * 0.035, 0.002);
  }
  return q;
}
/** rolled scroll along local x */
function scroll(p: O, x: number, y: number, z: number, len: number, r: number, ry = 0, paper = '#efe3c2', knob = '#7c4a2a'): void {
  const q = grp(p, x, y, z, ry);
  cc(q, paper, 0, 0, 0, r, len, 8, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) cc(q, knob, sx * len * 0.55, 0, 0, r * 0.45, len * 0.12, 6, 0, 0, Math.PI / 2);
  cc(q, '#b91c1c', 0, 0, 0, r * 1.05, len * 0.06, 8, 0, 0, Math.PI / 2);
}
/** table with four legs; returns the group (top surface at local y = h) */
function table(p: O, x: number, y: number, z: number, w: number, d: number, h: number, c: string, ry = 0): THREE.Group {
  const q = grp(p, x, y, z, ry);
  rbox(q, c, 0, h - 0.016, 0, w, 0.016, d, 0.005);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cb(q, shade(c, 0.82), sx * (w / 2 - 0.014), (h - 0.016) / 2, sz * (d / 2 - 0.014), 0.014, h - 0.016, 0.014);
  return q;
}
function tuft(p: O, x: number, y: number, z: number, s: number, c = '#5f9e4a'): void {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + x * 7;
    add(p, g('pa-blade', () => new THREE.ConeGeometry(0.5, 1, 4)), mat(shade(c, 0.9 + i * 0.08)), x + Math.cos(a) * s * 0.25, y + s * 0.45, z + Math.sin(a) * s * 0.25, s * 0.35, s, s * 0.2, a, Math.cos(a) * 0.35, Math.sin(a) * 0.35);
  }
}
/** a broad-leaf tree with optional fruit/blossom colours on the canopy */
function canopyTree(p: O, x: number, y: number, z: number, h: number, leaf: string[], dots?: string, nDots = 0, trunk = '#6b4a32'): void {
  tube(p, [[x, y, z], [x + h * 0.03, y + h * 0.4, z + h * 0.02], [x - h * 0.04, y + h * 0.66, z]], h * 0.06, h * 0.035, trunk, { radial: 7, sub: 3 });
  rod(p, [x, y + h * 0.5, z], [x + h * 0.2, y + h * 0.72, z + h * 0.06], h * 0.025, trunk, 5);
  rod(p, [x, y + h * 0.45, z], [x - h * 0.22, y + h * 0.68, z - h * 0.04], h * 0.025, trunk, 5);
  const blobs: [number, number, number, number][] = [[0, 0.8, 0, 0.3], [0.22, 0.72, 0.08, 0.22], [-0.22, 0.7, -0.04, 0.23], [0.04, 0.72, 0.2, 0.22], [-0.06, 0.95, -0.06, 0.2], [0.1, 0.68, -0.2, 0.2]];
  blobs.forEach(([bx, by, bz, r], i) => bl(p, leaf[i % leaf.length], x + bx * h, y + by * h, z + bz * h, r * h, r * h * 0.85, r * h));
  for (let i = 0; i < nDots && dots; i++) {
    const a = i * 2.39996, yy = 0.62 + (i % 5) * 0.075;
    const rr = (0.3 - Math.abs(yy - 0.8) * 0.6) * h;
    bl(p, dots, x + Math.cos(a) * rr, y + yy * h, z + Math.sin(a) * rr, h * 0.035);
  }
}
/** Erlenmeyer flask with (optionally glowing) liquid */
function flask(p: O, x: number, y: number, z: number, s: number, liquid: string, glowC?: string): void {
  add(p, g('pa-flask', () => { const lg = new THREE.LatheGeometry([[0, 0], [0.5, 0], [0.52, 0.06], [0.2, 0.62], [0.16, 0.66], [0.16, 0.95], [0.2, 1]].map(([r, h]) => new THREE.Vector2(r, h)), 12); lg.computeVertexNormals(); return lg; }), glass(), x, y, z, s, s, s);
  add(p, g('pa-flask-liq', () => { const lg = new THREE.LatheGeometry([[0, 0.01], [0.47, 0.01], [0.49, 0.06], [0.33, 0.4], [0, 0.4]].map(([r, h]) => new THREE.Vector2(r, h)), 12); lg.computeVertexNormals(); return lg; }), glowC ? glow(liquid, glowC) : mat(liquid), x, y, z, s * 0.96, s, s * 0.96);
}
/** shrink small hi-res ellipsoids (figure eyes, hands, tube caps...) to a lighter sphere: same look, far fewer triangles */
function lighten(root: O): void {
  const hi = g('esph', () => new THREE.SphereGeometry(1, 22, 15));
  root.traverse(o => {
    const m = o as THREE.Mesh;
    const r = Math.max(m.scale.x, m.scale.y, m.scale.z);
    if (m.isMesh && m.geometry === hi && r < 0.05) m.geometry = r < 0.016 ? TINY() : LO();
  });
}
/** figure.ts tints a few hair ellipsoids with shade(hair, ~0), i.e. near-black: restore the intended slightly darker hair tone */
function fixHair(a: FigureAnchors, hair: string): void {
  const bad = new Map<string, number>();
  for (const f of [0, 0.04, 0.05, 0.08, 0.1, 0.12]) bad.set(new THREE.Color(shade(hair, f)).getHexString(), f);
  a.group.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Math.min(m.scale.x, m.scale.y, m.scale.z) < a.headR * 0.15) return;
    const f = bad.get((m.material as THREE.MeshStandardMaterial).color.getHexString());
    if (f !== undefined) m.material = mat(shade(hair, 1 - f * 1.5), { flat: false });
  });
}
const person = (p: O, y: number, o: FigureOpts): FigureAnchors => {
  const a = figure(p, { y, ...o });
  if (o.hair) fixHair(a, o.hair);
  return a;
};
/** point offset from a hand anchor */
const at = (h: V3, dx = 0, dy = 0, dz = 0): V3 => [h[0] + dx, h[1] + dy, h[2] + dz];
/** a hand-held object group placed at the hand and aimed with euler angles */
const held = (p: O, h: V3, ry = 0, rx = 0, rz = 0) => grp(p, h[0], h[1], h[2], ry, rx, rz);

// ---- signature machines
/** Zhang Heng's Houfeng seismoscope: bronze urn, eight dragons holding balls, eight open-mouthed toads */
function seismoscope(p: O, x: number, y: number, z: number, s: number): void {
  const q = grp(p, x, y, z);
  const bronze = '#a8873a', dark = '#6f5a25', green = '#7b8b4a';
  lathe(q, [[0, 0], [0.16 * s, 0], [0.16 * s, 0.018 * s], [0, 0.018 * s]], shade(bronze, 0.75), 0, 0, 0, 16);
  const urn = lathe(q, [[0, 0.018], [0.06, 0.018], [0.085, 0.045], [0.1, 0.1], [0.1, 0.16], [0.088, 0.205], [0.062, 0.228], [0.064, 0.24], [0.072, 0.248], [0.05, 0.278], [0.016, 0.29], [0, 0.292]].map(([r, h]) => [r * s, h * s] as [number, number]), bronze, 0, 0, 0, 16);
  urn.material = metal(bronze);
  for (const yy of [0.1, 0.16]) ring(q, dark, 0, yy * s, 0, 0.101 * s, 0.05, 0, Math.PI / 2);
  bl(q, dark, 0, 0.298 * s, 0, 0.016 * s);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const P = (r: number, h: number): V3 => [ca * r * s, h * s, sa * r * s];
    // coiled dragon on the shoulder of the urn, head down with a ball in its mouth
    bl(q, green, ...P(0.094, 0.236), 0.015 * s, 0.017 * s, 0.013 * s, -a);
    const hd = P(0.112, 0.206);
    bl(q, green, hd[0], hd[1], hd[2], 0.019 * s, 0.017 * s, 0.017 * s, -a);
    bl(q, shade(green, 1.1), ...P(0.128, 0.194), 0.013 * s, 0.009 * s, 0.011 * s, -a);
    rod(q, P(0.1, 0.222), P(0.112, 0.25), 0.004 * s, '#d4b45a', 3);
    bl(q, '#e3c25e', ...P(0.134, 0.178), 0.01 * s); // ball in the mouth
    // toad below, mouth open upward
    const t = P(0.14, 0.03);
    bl(q, green, t[0], t[1], t[2], 0.022 * s, 0.016 * s, 0.022 * s);
    bl(q, '#2a2410', ...P(0.15, 0.055), 0.01 * s, 0.004 * s, 0.01 * s);
  }
}

/** group at A whose local +y runs toward B; returns the group and the distance */
function axis(p: O, A: V3, B: V3, name = ''): { q: THREE.Group; L: number } {
  const d = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
  const q = grp(p, A[0], A[1], A[2], 0, 0, 0, name);
  const L = d.length();
  q.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return { q, L };
}
/** a little songbird facing local +z */
function finch(p: O, x: number, y: number, z: number, ry: number, s: number, c = '#5b4632'): void {
  const q = grp(p, x, y, z, ry);
  bl(q, c, 0, s * 0.5, 0, s * 0.45, s * 0.42, s * 0.6, 0, -0.3);
  bl(q, shade(c, 1.15), 0, s * 0.95, s * 0.35, s * 0.32);
  add(q, g('pa-beak', () => new THREE.ConeGeometry(0.5, 1, 5)), mat('#3f3a32'), 0, s * 0.92, s * 0.72, s * 0.28, s * 0.36, s * 0.28, 0, Math.PI / 2);
  cb(q, shade(c, 0.8), 0, s * 0.45, -s * 0.65, s * 0.3, s * 0.06, s * 0.5, 0, -0.35);
  for (const k of [-1, 1]) bl(q, '#111', k * s * 0.2, s * 1.0, s * 0.5, s * 0.06);
}
/** wedge-shaped glass prism with its edge along local z */
const PRISM = () => g('pa-prism', () => { const sh = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.87)]); const eg = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); eg.translate(0, 0, -0.5); return eg; });
/** brass-banded wooden telescope from A (eyepiece) to B (objective) */
function telescope(p: O, A: V3, B: V3, r: number): void {
  strut(p, A, B, r * 0.75, r, '#7c4a24', 10);
  const { q, L } = axis(p, A, B);
  for (const t of [0.04, 0.4, 0.97]) cc(q, '#c9a24a', 0, L * t, 0, r * (1.05 + t * 0.35), L * 0.035, 10);
  cc(q, '#1f2937', 0, L * 0.99, 0, r * 1.05, 0.004, 10);
}

/** fluted Greek column with Ionic scrolls, height ≈ h */
function ionicColumn(p: O, x: number, y: number, z: number, h: number, ry = 0): void {
  const col = grp(p, x, y, z, ry);
  rbox(col, '#e8e1d0', 0, 0, 0, 0.1, 0.02, 0.1, 0.004);
  cc(col, '#efe9dc', 0, 0.02 + (h - 0.06) / 2, 0, 0.032, h - 0.06, 12);
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2 + 0.13; cb(col, '#d9d1bf', Math.cos(t) * 0.031, 0.02 + (h - 0.06) / 2, Math.sin(t) * 0.031, 0.004, h - 0.08, 0.004, -t); }
  rbox(col, '#e8e1d0', 0, h - 0.04, 0, 0.1, 0.018, 0.07, 0.004);
  for (const sx of [-1, 1]) cc(col, '#e2dac8', sx * 0.045, h - 0.035, 0, 0.014, 0.072, 10, 0, Math.PI / 2);
  rbox(col, '#efe9dc', 0, h - 0.022, 0, 0.11, 0.02, 0.11, 0.004);
}
/** jagged spark from A to B, returned as segment geometries to merge into one glowing mesh */
function bolt(A: V3, B: V3, n: number, jit: number, seed: number, r = 0.0045): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), qt = new THREE.Quaternion();
  let prev = new THREE.Vector3(...A);
  for (let i = 1; i <= n; i++) {
    const t = i / n, j = i === n ? 0 : jit;
    const P = new THREE.Vector3(A[0] + (B[0] - A[0]) * t + (hash3(i, seed, 1) - 0.5) * j, A[1] + (B[1] - A[1]) * t + (hash3(i, seed, 2) - 0.5) * j, A[2] + (B[2] - A[2]) * t + (hash3(i, seed, 3) - 0.5) * j);
    const d = P.clone().sub(prev), L = d.length();
    qt.setFromUnitVectors(up, d.normalize());
    m.compose(prev.clone().add(P).multiplyScalar(0.5), qt, new THREE.Vector3(r * 2, L + r, r * 2));
    out.push(new THREE.CylinderGeometry(0.5, 0.5, 1, 4).applyMatrix4(m));
    prev = P;
  }
  return out;
}
/** glowing incandescent bulb (glass globe, bright filament, threaded brass base) pointing up from its local origin */
function bulb(p: O, x: number, y: number, z: number, s: number, rz = 0): void {
  const q = grp(p, x, y, z, 0, 0, rz);
  for (let i = 0; i < 3; i++) cc(q, '#b08d3c', 0, s * (0.1 + i * 0.12), 0, s * (0.2 - i * 0.004), s * 0.1, 10);
  cc(q, '#1c1917', 0, s * 0.02, 0, s * 0.1, s * 0.05, 8);
  add(q, LO(), mat('#fffbe6', { emissive: '#fde68a', transparent: 0.55 }), 0, s * 0.68, 0, s * 0.36, s * 0.38, s * 0.36);
  ring(q, '', 0, s * 0.62, 0, s * 0.1, 0.18, 0, 0, 0, glow('#fff7c2', '#fbbf24'));
  for (const k of [-1, 1]) rod(q, [k * s * 0.06, s * 0.36, 0], [k * s * 0.09, s * 0.6, 0], s * 0.012, '#57534e', 4);
}
/** slate / chalkboard tablet in local XY facing +z */
function slate(p: O, w: number, h: number, text: string, ts: number, ry = 0, x = 0, y = 0, z = 0, rx = 0): THREE.Group {
  const q = grp(p, x, y, z, ry, rx);
  cb(q, '#8b5a2b', 0, 0, 0, w, h, 0.008);
  cb(q, '#27303a', 0, 0, 0.0045, w - 0.016, h - 0.016, 0.002);
  write(q, text, 0, -ts * 0.5, 0.0065, ts, '#f8fafc', 0.14);
  return q;
}

// ---- builders
export const H_PEOPLE_A: Record<string, Builder> = {
  pp_confucius: gp => {
    const Y = figureBase(gp, '#cdbb98', '#6b5640');
    // the Apricot Altar (杏坛) where he taught: a stone dais with steps
    rbox(gp, '#b7ab95', 0, Y, -0.02, 0.36, 0.035, 0.3, 0.008);
    rbox(gp, '#c4b8a1', 0, Y, 0.15, 0.22, 0.018, 0.06, 0.005);
    const D = Y + 0.035;
    canopyTree(gp, -0.24, Y, -0.22, 0.44, ['#f6c1cf', '#f3a9bd', '#fbd5df'], '#fff1f4', 14, '#5b3b28');
    for (let i = 0; i < 6; i++) bl(gp, '#f6b6c8', -0.2 + hash3(i, 2, 3) * 0.5, Y + 0.004, -0.05 + hash3(i, 5, 1) * 0.35, 0.012, 0.003, 0.012); // fallen petals
    const a = person(gp, D, {
      top: '#6e3b22', accent: '#d6b25e', outfit: 'robe', wideSleeves: true, hair: '#7a7a7a', hairStyle: 'topknot', hat: 'scholar', hatColor: '#1c1917',
      beard: 'long', beardColor: '#cfcfcf', z: -0.02, h: 0.6, armL: { fwd: 0.55, side: 0.05, bend: 0.95, inward: 0.45 }, armR: { fwd: 0.55, side: 0.05, bend: 0.95, inward: 0.45 },
    });
    // open bamboo-slip book (竹简) between the hands
    const [lx, ly, lz] = a.handL, [rx] = a.handR;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), xx = lx - 0.02 + (rx - lx + 0.04) * t;
      cb(gp, shade('#cfae6e', 0.92 + (i % 2) * 0.1), xx, ly + 0.02, lz + 0.03 - Math.sin(t * Math.PI) * 0.012, 0.011, 0.12, 0.004);
      cb(gp, '#3f2a1a', xx, ly + 0.05, lz + 0.033 - Math.sin(t * Math.PI) * 0.012, 0.004, 0.04, 0.001);
    }
    for (const yy of [-0.025, 0.065]) cb(gp, '#7c4a2a', (lx + rx) / 2, ly + yy, lz + 0.026, rx - lx + 0.05, 0.004, 0.003);
    // low lacquered desk with rolled bamboo books and an inkstone
    const tb = table(gp, 0.28, Y, -0.1, 0.15, 0.1, 0.07, '#4a1d16', -0.5);
    for (let i = 0; i < 3; i++) scroll(tb, -0.02, 0.078 + i * 0.012, -0.02 + (i % 2) * 0.01, 0.1, 0.011, 0, '#c9a86a', '#6b4a2a');
    cb(tb, '#27272a', 0.045, 0.074, 0.025, 0.035, 0.008, 0.03);
    // kneeling mats for students and a bronze incense burner (鼎)
    for (const [mx, mz] of [[-0.27, 0.16], [0.06, 0.33], [0.3, 0.14]]) rbox(gp, '#a3864f', mx, Y, mz, 0.1, 0.008, 0.075, 0.003, mx);
    const dq = grp(gp, -0.16, Y, 0.33);
    lathe(dq, [[0, 0.03], [0.04, 0.03], [0.045, 0.05], [0.04, 0.075], [0.046, 0.08], [0, 0.08]], '#7a6a35', 0, 0, 0, 12).material = metal('#8a7535');
    for (let i = 0; i < 3; i++) { const t = (i / 3) * Math.PI * 2; rod(dq, [Math.cos(t) * 0.03, 0.04, Math.sin(t) * 0.03], [Math.cos(t) * 0.036, 0, Math.sin(t) * 0.036], 0.005, '#6f5f2e', 4); }
    for (const sx of [-1, 1]) cb(dq, '#7a6a35', sx * 0.03, 0.09, 0, 0.006, 0.022, 0.016);
    lighten(gp);
  },

  pp_zhangheng: gp => {
    const Y = figureBase(gp, '#c9b48a', '#5e4a34');
    rbox(gp, '#b5a07a', 0.22, Y, -0.06, 0.36, 0.012, 0.36, 0.004);
    seismoscope(gp, 0.27, Y + 0.012, -0.1, 0.92);
    const a = person(gp, Y, {
      x: -0.2, z: 0.1, ry: 0.3, top: '#24525a', accent: '#c8a04a', outfit: 'robe', wideSleeves: true, hair: '#1f1b18', hairStyle: 'topknot',
      hat: 'scholar', hatColor: '#141414', beard: 'goatee', beardColor: '#1f1b18',
      armR: { fwd: 0.55, side: 0.6, bend: 0.25 }, armL: { fwd: 0.5, bend: 1.0, inward: 0.35 },
    });
    // Han-style slanted crown plate on the cap (进贤冠)
    cb(gp, '#141414', a.top[0] - 0.01, a.top[1] + 0.03, a.top[2] - 0.01, 0.05, 0.004, 0.07, 0.45, -0.6);
    // pointing finger toward the dragons
    const d = new THREE.Vector3(...a.handR).sub(new THREE.Vector3(...a.head)).setY(0).normalize();
    rod(gp, a.handR, at(a.handR, d.x * 0.035, 0.005, d.z * 0.035), 0.007, '#e9b993', 5);
    // a scroll of star notes in the other hand
    scroll(gp, a.handL[0], a.handL[1], a.handL[2] + 0.01, 0.1, 0.012, 0.45);
    // water-driven armillary sphere (浑天仪) at the back
    const am = grp(gp, -0.22, Y, -0.24);
    lathe(am, [[0, 0], [0.06, 0], [0.05, 0.03], [0.015, 0.05], [0.012, 0.16], [0, 0.16]], '#6f5a25', 0, 0, 0, 10).material = metal('#7d6830');
    const ao = grp(am, 0, 0.22, 0, 0.5);
    ring(ao, '', 0, 0, 0, 0.075, 0.07, 0, 0, 0, metal('#b08d3c'));
    ring(ao, '', 0, 0, 0, 0.075, 0.07, Math.PI / 2, 0, 0, metal('#b08d3c'));
    ring(ao, '', 0, 0, 0, 0.072, 0.07, 0, Math.PI / 2, 0, metal('#9c7b30'));
    ring(ao, '', 0, 0, 0, 0.07, 0.06, 0, Math.PI / 2 - 0.41, 0.3, metal('#c9a24a'));
    bl(ao, '#3b82f6', 0, 0, 0, 0.02);
    for (const [px, pz] of [[-0.3, 0.2], [0.33, 0.24], [-0.05, -0.36]]) tuft(gp, px, Y, pz, 0.035, '#6f8f3a');
    lighten(gp);
  },
  pp_cailun: gp => {
    const Y = figureBase(gp, '#c8b893', '#5e4a34');
    rbox(gp, '#b3a37f', -0.05, Y, -0.02, 0.62, 0.008, 0.5, 0.004);
    // wooden vat of milky paper pulp, bound with iron hoops
    const vx = -0.26, vz = 0.12;
    lathe(gp, [[0, 0], [0.095, 0], [0.104, 0.1], [0.094, 0.1], [0.086, 0.088], [0, 0.088]], '#8b6a43', vx, Y, vz, 16);
    for (const yy of [0.025, 0.075]) ring(gp, '#3f3f46', vx, Y + yy, vz, 0.1 + yy * 0.09, 0.04, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) bl(gp, '#f3eedf', vx - 0.05 + hash3(i, 1, 1) * 0.1, Y + 0.09, vz - 0.04 + hash3(i, 2, 2) * 0.08, 0.02, 0.004, 0.02);
    cc(gp, '#e6dfca', vx, Y + 0.088, vz, 0.088, 0.003, 16);
    rod(gp, [vx + 0.04, Y + 0.07, vz - 0.03], [vx + 0.1, Y + 0.2, vz - 0.09], 0.006, '#7c5a3a', 5); // stirring paddle
    const a = person(gp, Y, {
      x: 0.02, z: 0.0, top: '#8b2a23', accent: '#1f1a17', outfit: 'robe', wideSleeves: true, hair: '#1a1714', hairStyle: 'topknot', hat: 'scholar', hatColor: '#141414',
      beard: 'goatee', beardColor: '#1a1714', armL: { fwd: 0.75, side: 0.1, bend: 0.75, inward: 0.25 }, armR: { fwd: 0.75, side: 0.1, bend: 0.75, inward: 0.25 },
    });
    // bamboo papermaking mould with a fresh wet sheet, tilted to show the paper
    const mx = (a.handL[0] + a.handR[0]) / 2, my = (a.handL[1] + a.handR[1]) / 2;
    const md = grp(gp, mx, my + 0.01, a.handL[2] + 0.04, 0, -0.75);
    const wM = a.handR[0] - a.handL[0] + 0.05;
    for (const sz of [-1, 1]) cb(md, '#8b6a43', 0, 0, sz * 0.06, wM, 0.01, 0.012);
    for (const sx of [-1, 1]) cb(md, '#8b6a43', sx * wM / 2, 0, 0, 0.012, 0.01, 0.13);
    cb(md, '#c9b07a', 0, -0.002, 0, wM - 0.01, 0.003, 0.11);
    cb(md, '#fbf8ee', 0, 0.002, 0, wM - 0.03, 0.003, 0.095);
    // drying wall with sheets of paper and a tiled coping
    const wl = grp(gp, -0.13, Y, -0.27, 0.25);
    cb(wl, '#ece4d4', 0, 0.12, 0, 0.32, 0.24, 0.04);
    cb(wl, '#9a8f7e', 0, 0.01, 0, 0.33, 0.02, 0.05);
    const roof = new THREE.Group(); roof.position.set(0, 0.24, 0); wl.add(roof);
    for (const sz of [-1, 1]) cb(roof, '#4b5563', 0, 0.018, sz * 0.022, 0.36, 0.008, 0.05, 0, sz * 0.55);
    cb(roof, '#374151', 0, 0.03, 0, 0.37, 0.012, 0.012);
    for (let i = 0; i < 4; i++) cb(wl, i % 2 ? '#fffdf5' : '#f6efdc', -0.105 + (i % 2) * 0.13 + (i > 1 ? 0.07 : 0), i > 1 ? 0.07 : 0.165, 0.022, 0.1, 0.085, 0.003, 0, 0, (hash3(i, 3, 3) - 0.5) * 0.12);
    // stack of finished paper
    for (let i = 0; i < 8; i++) cb(gp, i % 2 ? '#fbf7ea' : '#efe7d1', 0.27, Y + 0.004 + i * 0.006, 0.17, 0.11, 0.005, 0.08, (hash3(i, 7, 1) - 0.5) * 0.25);
    cb(gp, '#b91c1c', 0.27, Y + 0.004, 0.17, 0.012, 0.052, 0.082);
    // raw materials: bark, hemp and an old fishing net
    for (let i = 0; i < 3; i++) cc(gp, '#6b4a32', -0.31 + i * 0.03, Y + 0.012, -0.12 + i * 0.01, 0.012, 0.12, 6, 0.3, Math.PI / 2);
    cc(gp, '#c8b27a', 0.33, Y + 0.02, -0.02, 0.022, 0.12, 8, 1.1, Math.PI / 2);
    cc(gp, '#7c4a2a', 0.33, Y + 0.02, -0.02, 0.024, 0.012, 8, 1.1, Math.PI / 2);
    const net = grp(gp, -0.36, Y + 0.02, 0.0);
    bl(net, '#8a8a7a', 0, 0, 0, 0.05, 0.02, 0.045);
    for (let i = 0; i < 4; i++) { cb(net, '#4b4b40', -0.03 + i * 0.02, 0.018, 0, 0.003, 0.003, 0.08, 0, 0.1); cb(net, '#4b4b40', 0, 0.018, -0.03 + i * 0.02, 0.09, 0.003, 0.003); }
    // stone mortar and wooden pestle for pounding fibres
    lathe(gp, [[0, 0], [0.045, 0], [0.05, 0.05], [0.036, 0.05], [0.03, 0.02], [0, 0.02]], '#8a8f86', 0.24, Y, -0.2, 12);
    rod(gp, [0.24, Y + 0.03, -0.2], [0.27, Y + 0.17, -0.17], 0.012, '#9a7350', 6);
    lighten(gp);
  },

  pp_zuchongzhi: gp => {
    const Y = figureBase(gp, '#cdbf9f', '#5e4a34');
    // stone disc with the circle-cutting diagram: a 24-sided polygon squeezing in on the circle
    const cx = 0.17, cz = 0.17;
    cc(gp, '#d9cfb9', cx, Y + 0.005, cz, 0.15, 0.01, 24);
    const cd = grp(gp, cx, Y + 0.0105, cz, 0, -Math.PI / 2);
    ring(cd, '', 0, 0, 0, 0.12, 0.03, 0, 0, 0, mat('#57534e'));
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      seg(cd, '#b91c1c', Math.cos(a0) * 0.12, Math.sin(a0) * 0.12, Math.cos(a1) * 0.12, Math.sin(a1) * 0.12, 0.005, 0.003, 0.001);
      if (i % 2 === 0) seg(cd, '#78716c', 0, 0, Math.cos(a0) * 0.12, Math.sin(a0) * 0.12, 0.003, 0.002, 0.001);
    }
    for (let i = 0; i < 6; i++) { const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2; seg(cd, '#1d4ed8', Math.cos(a0) * 0.12, Math.sin(a0) * 0.12, Math.cos(a1) * 0.12, Math.sin(a1) * 0.12, 0.005, 0.003, 0.002); }
    bl(cd, '#1c1917', 0, 0, 0.003, 0.008, 0.008, 0.003);
    // stone stele carved with π ≈ 3.1415926
    const st = grp(gp, -0.22, Y, -0.2, 0.45);
    rbox(st, '#8b8478', 0, 0, 0, 0.2, 0.03, 0.08, 0.008);
    rbox(st, '#a8a29e', 0, 0.03, 0, 0.16, 0.22, 0.035, 0.006);
    cc(st, '#a8a29e', 0, 0.25, 0, 0.08, 0.035, 16, 0, Math.PI / 2);
    write(st, 'p', 0, 0.17, 0.019, 0.055, '#7f1d1d', 0.16);
    write(st, '3.1415926', 0, 0.09, 0.019, 0.017, '#7f1d1d', 0.16);
    // low desk with counting rods laid out as numbers
    const tb = table(gp, 0.26, Y, -0.14, 0.2, 0.13, 0.08, '#6b4226', -0.5);
    const rodC = '#efe2b8';
    [3, 1, 4, 1, 5, 9].forEach((dgt, k) => {
      // rod numerals alternate upright and lying digits; a crossing rod counts five
      const x0 = -0.075 + k * 0.03, up = k % 2 === 0, n = dgt % 5;
      for (let i = 0; i < n; i++)
        if (up) cb(tb, rodC, x0 - 0.008 + i * 0.006, 0.084, 0.01, 0.003, 0.003, 0.034);
        else cb(tb, rodC, x0, 0.084, 0.002 + i * 0.006, 0.024, 0.003, 0.003);
      if (dgt >= 5) { if (up) cb(tb, rodC, x0, 0.087, -0.012, 0.026, 0.003, 0.003); else cb(tb, rodC, x0 - 0.014, 0.087, 0.01, 0.003, 0.003, 0.026); }
    });
    for (let i = 0; i < 6; i++) cc(tb, rodC, -0.07 + i * 0.004, 0.086, -0.045, 0.002, 0.06, 4, 0.05, Math.PI / 2);
    scroll(tb, 0.06, 0.09, -0.04, 0.07, 0.01, 0.3);
    const a = person(gp, Y, {
      x: -0.06, z: 0.0, ry: 0.4, top: '#a3b5c4', accent: '#2f3e4c', outfit: 'robe', wideSleeves: true, hair: '#2a2420', hairStyle: 'topknot', hat: 'scholar', hatColor: '#141414',
      beard: 'long', beardColor: '#3a3430', armR: { fwd: 0.8, side: 0.45, bend: 0.15 }, armL: { fwd: 0.55, bend: 1.05, inward: 0.4 },
    });
    // a bundle of counting rods in the left hand
    const hb = held(gp, a.handL, 0.35, 0.3, 0.5);
    for (let i = 0; i < 7; i++) cc(hb, rodC, Math.cos(i * 2.4) * 0.008, 0, Math.sin(i * 2.4) * 0.008, 0.0028, 0.11, 4);
    cc(hb, '#7f1d1d', 0, 0, 0, 0.013, 0.012, 8);
    rod(gp, a.handR, at(a.handR, 0.025, -0.02, 0.025), 0.006, '#e9b993', 5);
    for (const [px, pz] of [[-0.34, 0.16], [0.38, 0.06], [0.0, 0.36]]) tuft(gp, px, Y, pz, 0.035, '#7a9a45');
    lighten(gp);
  },

  pp_lishizhen: gp => {
    const Y = figureBase(gp, '#a9b67f', '#5d4a33');
    // mountain rocks, a pine and lingzhi mushrooms
    rock(gp, '#8a8f86', -0.25, Y + 0.05, -0.22, 0.13, 0.85);
    rock(gp, '#9aa096', -0.09, Y + 0.03, -0.3, 0.09, 0.7);
    rock(gp, '#7d837a', 0.3, Y + 0.02, -0.2, 0.08, 0.6);
    const px = -0.3, pz = -0.27, py = Y + 0.13;
    cc(gp, '#5b3b28', px, py + 0.05, pz, 0.012, 0.12, 6);
    for (let i = 0; i < 3; i++) cone(gp, shade('#2f5e3f', 1 + i * 0.08), px, py + 0.05 + i * 0.05, pz, 0.075 - i * 0.02, 0.08, 7);
    for (const [lx, lz, r] of [[-0.14, -0.2, 0.03], [-0.11, -0.17, 0.022]]) { bl(gp, '#8a3b1d', lx, Y + 0.05, lz, r, 0.008, r * 0.8); bl(gp, '#c2410c', lx, Y + 0.054, lz, r * 0.6, 0.005, r * 0.5); cc(gp, '#6b3a1e', lx, Y + 0.025, lz, 0.004, 0.05, 5); }
    // medicinal herbs in flower
    const herb = (x: number, z: number, s: number, fl: string) => {
      for (let i = 0; i < 4; i++) { const t = i * 1.7 + x * 5; rod(gp, [x, Y, z], [x + Math.cos(t) * s * 0.3, Y + s * (0.7 + (i % 2) * 0.3), z + Math.sin(t) * s * 0.3], s * 0.03, '#4d7c3a', 4); bl(gp, '#5f9e4a', x + Math.cos(t) * s * 0.25, Y + s * 0.5, z + Math.sin(t) * s * 0.25, s * 0.14, s * 0.05, s * 0.08, t); bl(gp, fl, x + Math.cos(t) * s * 0.3, Y + s * (0.72 + (i % 2) * 0.3), z + Math.sin(t) * s * 0.3, s * 0.07); }
    };
    herb(0.26, 0.12, 0.12, '#facc15');
    herb(-0.3, 0.06, 0.11, '#a78bfa');
    herb(0.14, 0.28, 0.09, '#f8fafc');
    herb(0.33, -0.06, 0.1, '#f472b6');
    // the Compendium lying open on a flat stone
    rock(gp, '#9ca3af', -0.22, Y + 0.01, 0.22, 0.09, 0.35);
    openBook(gp, -0.22, Y + 0.036, 0.22, 0.05, 0.075, '#1e3a8a', -0.5, -Math.PI / 2 + 0.25);
    // herb hoe leaning on the rock
    rod(gp, [0.2, Y + 0.0, -0.1], [0.27, Y + 0.24, -0.17], 0.007, '#8b5a2b', 5);
    cb(gp, '#6b7280', 0.275, Y + 0.24, -0.172, 0.04, 0.012, 0.03, -0.8, 0, 0.6);
    const a = person(gp, Y, {
      x: -0.03, z: 0.04, ry: 0.2, top: '#34508a', accent: '#e8e4d8', outfit: 'robe', wideSleeves: true, hair: '#8a8a8a', hairStyle: 'topknot', hat: 'scholar', hatColor: '#1c1917',
      beard: 'long', beardColor: '#c4c4c4', armR: { fwd: 0.85, side: 0.15, bend: 1.0, inward: 0.15 }, armL: { fwd: 0.3, side: 0.08, bend: 0.5 },
    });
    // bamboo herb basket on his back with leafy herbs poking out
    const bk = grp(a.group, 0, 0.3, -0.13, 0, -0.12);
    lathe(bk, [[0, 0], [0.045, 0], [0.062, 0.17], [0.056, 0.17], [0.04, 0.012], [0, 0.012]], '#b8925a', 0, 0, 0, 12);
    for (const yy of [0.04, 0.09, 0.14]) ring(bk, '', 0, yy, 0, 0.05 + yy * 0.08, 0.06, 0, Math.PI / 2, 0, mat('#8b6a3a'));
    for (let i = 0; i < 6; i++) { const t = i * 1.05; rod(bk, [Math.cos(t) * 0.02, 0.12, Math.sin(t) * 0.02], [Math.cos(t) * 0.05, 0.23 + (i % 3) * 0.02, Math.sin(t) * 0.04 - 0.01], 0.003, '#4d7c3a', 4); bl(bk, i % 2 ? '#5f9e4a' : '#4d7c3a', Math.cos(t) * 0.05, 0.23 + (i % 3) * 0.02, Math.sin(t) * 0.04 - 0.01, 0.02, 0.012, 0.014, t); }
    for (const sx of [-1, 1]) tube(a.group, [[sx * 0.05, 0.43, -0.09], [sx * 0.07, 0.47, -0.02], [sx * 0.062, 0.42, 0.055]], 0.005, 0.005, '#5b3b28', { radial: 5, sub: 3 });
    // freshly picked herb sprig held up for a closer look
    const sp = held(gp, a.handR, 0, 0, -0.2);
    rod(sp, [0, 0, 0], [0, 0.09, 0], 0.003, '#4d7c3a', 4);
    for (let i = 0; i < 4; i++) bl(sp, '#65a30d', (i % 2 ? 1 : -1) * 0.012, 0.03 + i * 0.015, 0, 0.012, 0.005, 0.006, 0, 0, (i % 2 ? -1 : 1) * 0.6);
    for (let i = 0; i < 3; i++) bl(sp, '#c084fc', Math.cos(i * 2.1) * 0.006, 0.095, Math.sin(i * 2.1) * 0.006, 0.008);
    book(gp, '#1e3a8a', a.handL[0] - 0.005, a.handL[1] + 0.03, a.handL[2] + 0.015, 0.06, 0.085, 0.022, 0.2 + Math.PI / 2);
    lighten(gp);
  },

  pp_archimedes: gp => {
    const Y = figureBase(gp, '#dccb9e', '#7a6448');
    ionicColumn(gp, 0.27, Y, -0.24, 0.34);
    // Archimedes screw lifting water from a pool into a channel (turns slowly)
    cb(gp, '#2d7fb5', -0.3, Y + 0.004, 0.02, 0.16, 0.008, 0.18);
    for (let i = 0; i < 4; i++) cb(gp, '#bfe3f5', -0.33 + hash3(i, 1, 1) * 0.1, Y + 0.009, -0.04 + i * 0.035, 0.03, 0.002, 0.004);
    for (const [x, z, w, d] of [[-0.3, 0.115, 0.18, 0.012], [-0.3, -0.075, 0.18, 0.012], [-0.384, 0.02, 0.012, 0.18], [-0.216, 0.02, 0.012, 0.18]] as const) cb(gp, '#b9a77f', x, Y + 0.012, z, w, 0.024, d);
    const A = new THREE.Vector3(-0.3, Y + 0.035, 0.0), Bv = new THREE.Vector3(-0.16, Y + 0.3, -0.27);
    const dir = Bv.clone().sub(A), L = dir.length();
    const sc = grp(gp, (A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2, 0, 0, 0, 'spin');
    sc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
    cc(sc, '#8b6a43', 0, 0, 0, 0.014, L, 8, 0, Math.PI / 2);
    const hp: V3[] = [];
    for (let i = 0; i <= 56; i++) { const t = i / 56, th = t * Math.PI * 2 * 4; hp.push([Math.cos(th) * 0.034, Math.sin(th) * 0.034, (t - 0.5) * L * 0.9]); }
    tube(sc, hp, 0.009, 0.009, '#a47a4a', { radial: 5, sub: 1 });
    for (const sz of [-1, 1]) cc(sc, '#5b4632', 0, 0, sz * L * 0.5, 0.005, 0.03, 6, 0, Math.PI / 2);
    // stone channel at the top, on a post
    rod(gp, [Bv.x, Y, Bv.z], [Bv.x, Bv.y - 0.02, Bv.z], 0.012, '#9a8f7e', 6);
    cb(gp, '#b9a77f', Bv.x + 0.06, Bv.y - 0.03, Bv.z, 0.16, 0.025, 0.05);
    cb(gp, '#3b8fd0', Bv.x + 0.06, Bv.y - 0.004, Bv.z, 0.15, 0.004, 0.03);
    // lever on a fulcrum lifting a little Earth
    const P0: V3 = [0.05, Y + 0.012, 0.3], P1: V3 = [0.35, Y + 0.13, 0.19];
    const fx = 0.28;
    const fy = P0[1] + (P1[1] - P0[1]) * ((fx - P0[0]) / (P1[0] - P0[0]));
    add(gp, g('pa-fulcrum', () => { const s = new THREE.Shape([new THREE.Vector2(-0.06, 0), new THREE.Vector2(0.06, 0), new THREE.Vector2(0, 1)]); const eg = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); eg.translate(0, 0, -0.025); return eg; }), mat('#78716c'), fx, Y, P0[2] + (P1[2] - P0[2]) * ((fx - P0[0]) / (P1[0] - P0[0])), 0.6, fy - Y - 0.008, 1, Math.atan2(P0[2] - P1[2], P1[0] - P0[0]));
    rod(gp, P0, P1, 0.011, '#7c4a24', 6);
    add(gp, g('pa-earth', () => paintFaces(new THREE.SphereGeometry(1, 16, 11), '#2563eb', (x, y, z) => (Math.sin(x * 5) * Math.cos(z * 4) + Math.sin(y * 6 + x * 2) > 0.7 ? '#4d9a4a' : null))), mat('#ffffff', { vc: true, flat: false }), P1[0] - 0.01, P1[1] + 0.055, P1[2] + 0.01, 0.06, 0.06, 0.06);
    // sphere-in-a-cylinder, the shape he was proudest of
    const sx0 = -0.1, sz0 = 0.3;
    rbox(gp, '#c9b98f', sx0, Y, sz0, 0.08, 0.02, 0.08, 0.004);
    add(gp, CYL(16), glass(), sx0, Y + 0.02 + 0.03, sz0, 0.06, 0.06, 0.06);
    bl(gp, '#d6b25e', sx0, Y + 0.05, sz0, 0.028);
    const a = person(gp, Y, {
      x: -0.06, z: 0.06, ry: 0.15, top: '#efe6d2', accent: '#b45309', cape: '#a33b2b', outfit: 'robe', skin: '#e2ad84', hairStyle: 'bald', hair: '#c8c8c8',
      beard: 'full', beardColor: '#d4d4d4', shoes: '#8b5a2b', armR: { fwd: 2.3, side: 0.55, bend: 0.15 }, armL: { fwd: 0.85, side: 0.45, bend: 0.2 },
    });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) bl(a.group, '#d4d4d4', s * (0.068 + i * 0.002), 0.565 - i * 0.022, -0.02 - i * 0.012, 0.022);
    // "Eureka!" finger raised
    rod(gp, a.handR, at(a.handR, 0, 0.035, 0), 0.006, '#e2ad84', 5);
    lighten(gp);
  },
  pp_galileo: gp => {
    const Y = figureBase(gp, '#d8c7a6', '#6b5640');
    // Venetian terrace of checkered marble
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.hypot(i, j) < 2.6) cb(gp, (i + j) % 2 ? '#e9dfcc' : '#a8754f', i * 0.09, Y + 0.003, j * 0.09, 0.09, 0.006, 0.09);
    const bal = grp(gp, -0.2, Y, -0.28, 0.45);
    cb(bal, '#e7e0d0', 0, 0.01, 0, 0.32, 0.02, 0.05);
    cb(bal, '#efe9dc', 0, 0.125, 0, 0.34, 0.018, 0.055);
    for (let i = 0; i < 7; i++) lathe(bal, [[0, 0], [0.012, 0], [0.018, 0.03], [0.01, 0.07], [0.013, 0.096], [0, 0.096]], '#ece5d6', -0.135 + i * 0.045, 0.02, 0, 8);
    // swinging pendulum, the clock idea he had while watching a lamp in church
    const pq = grp(gp, -0.31, Y, 0.1, -0.6);
    rbox(pq, '#6b4226', -0.02, 0, 0, 0.1, 0.015, 0.06, 0.004);
    cc(pq, '#6b4226', -0.06, 0.15, 0, 0.007, 0.3, 6);
    cc(pq, '#6b4226', 0, 0.295, 0, 0.006, 0.13, 6, 0, 0, Math.PI / 2);
    const sw = grp(pq, 0.035, 0.29, 0, 0, 0, 0, 'flap');
    cc(sw, '#d6d3d1', 0, -0.1, 0, 0.0016, 0.2, 4);
    add(sw, LO(), metal('#b08d3c'), 0, -0.205, 0, 0.018, 0.018, 0.018);
    // Jupiter with its four moons, the ones he discovered
    const jx = 0.31, jz = -0.12, jy = Y + 0.25;
    lathe(gp, [[0, 0], [0.05, 0], [0.04, 0.02], [0.01, 0.03], [0, 0.03]], '#6f5a25', jx, Y, jz, 10);
    rod(gp, [jx, Y, jz], [jx, jy, jz], 0.005, '#8a7535', 5);
    add(gp, g('pa-jup', () => paintFaces(new THREE.SphereGeometry(1, 16, 11), '#ead2ad', (x, y) => (x > 0.35 && y > -0.42 && y < -0.2 ? '#c2410c' : Math.sin(y * 10) > 0.3 ? '#b7794a' : null))), mat('#ffffff', { vc: true }), jx, jy, jz, 0.05, 0.05, 0.05);
    const orb = grp(gp, jx, jy, jz, 0, -Math.PI / 2, 0, 'spin');
    ['#f1d36b', '#e7e5e4', '#a8a29e', '#78716c'].forEach((c, i) => {
      const r = 0.075 + i * 0.024, t = i * 1.9 + 0.4;
      ring(orb, '', 0, 0, 0, r, 0.012, 0, 0, 0, metal('#c9a24a'));
      bl(orb, c, Math.cos(t) * r, Math.sin(t) * r, 0, i === 2 ? 0.012 : 0.009);
    });
    // his drawings of the cratered Moon on a writing table
    const tb = table(gp, 0.24, Y, 0.2, 0.16, 0.1, 0.08, '#5b3b28', -0.6);
    const sh = grp(tb, 0, 0.09, 0, 0, -1.0);
    cb(sh, '#efe3c2', 0, 0, 0, 0.13, 0.085, 0.003);
    for (const [mx, r, k] of [[-0.03, 0.026, 0.4], [0.035, 0.02, -0.5]] as const) {
      cc(sh, '#d6d3d1', mx, 0, 0.002, r, 0.002, 16, 0, Math.PI / 2);
      cc(sh, '#57534e', mx + k * r * 0.9, 0, 0.0028, r * 0.92, 0.002, 16, 0, Math.PI / 2);
      for (let i = 0; i < 3; i++) cc(sh, '#9ca3af', mx - k * r * 0.4 + (hash3(i, r * 99, 1) - 0.5) * r * 0.6, (hash3(i, 2, r * 99) - 0.5) * r, 0.0034, r * 0.14, 0.002, 6, 0, Math.PI / 2);
    }
    rod(tb, [0.05, 0.09, 0.03], [0.09, 0.16, 0.0], 0.0025, '#f8fafc', 4);
    for (let i = 0; i < 3; i++) book(gp, ['#7f1d1d', '#1e3a8a', '#365314'][i], -0.15, Y + 0.012 + i * 0.024, 0.22, 0.07, 0.095, 0.022, 0.4 + i * 0.2, -Math.PI / 2);
    const a = person(gp, Y, {
      x: -0.02, z: 0.02, ry: 0.25, top: '#1f1d1d', accent: '#f5f5f4', shirt: '#f5f5f4', outfit: 'robe', hair: '#a1a1aa', hairStyle: 'short',
      beard: 'full', beardColor: '#a8a29e', shoes: '#111111', armL: { fwd: 1.6, side: 0.3, bend: 0.5, inward: 0.1 }, armR: { fwd: 0.85, side: 0.45, bend: 0.2 },
    });
    bl(gp, '#f5f5f4', a.head[0], a.head[1] - a.headR * 1.2, a.head[2], a.headR * 0.95, a.headR * 0.16, a.headR * 0.8);
    telescope(gp, at(a.handL, 0.03, -0.07, -0.03), at(a.handL, -0.09, 0.2, 0.09), 0.016);
    rod(gp, a.handR, at(a.handR, 0.03, 0.01, -0.02), 0.006, '#e9b993', 5);
    lighten(gp);
  },

  pp_newton: gp => {
    const Y = figureBase(gp, '#9fbf6a', '#5d4a33');
    canopyTree(gp, -0.26, Y, -0.17, 0.48, ['#4d8a3a', '#5f9e4a', '#3f7a35'], '#dc2626', 16, '#5b3b28');
    for (const [ax, az] of [[-0.15, 0.06], [-0.34, 0.04], [-0.2, -0.02]]) bl(gp, '#dc2626', ax, Y + 0.018, az, 0.018);
    // Woolsthorpe Manor, his family's stone farmhouse
    const mh = grp(gp, 0.35, Y, -0.04, -0.75);
    cb(mh, '#d9c9a3', 0, 0.05, 0, 0.18, 0.1, 0.09);
    gable(mh, 0.19, 0.06, 0.1, '#6b6f76', 0, 0.1, 0);
    for (const sx of [-1, 1]) cb(mh, '#c9b88f', sx * 0.08, 0.15, 0, 0.022, 0.06, 0.025);
    for (const wx of [-0.055, 0.055]) for (const wy of [0.03, 0.072]) cb(mh, '#3a4250', wx, wy, 0.046, 0.024, 0.022, 0.004);
    cb(mh, '#5b3b28', 0, 0.022, 0.046, 0.022, 0.044, 0.004);
    // carved sundial
    const sd = grp(gp, -0.28, Y, 0.2, -0.6);
    lathe(sd, [[0, 0], [0.04, 0], [0.03, 0.02], [0.02, 0.03], [0.02, 0.09], [0.035, 0.1], [0, 0.1]], '#b8b0a0', 0, 0, 0, 10);
    cc(sd, '#c9a24a', 0, 0.104, 0, 0.04, 0.006, 16);
    for (let i = 0; i < 12; i++) cb(sd, '#3f3a32', Math.cos(i * 0.52) * 0.032, 0.108, Math.sin(i * 0.52) * 0.032, 0.008, 0.002, 0.002, -i * 0.52);
    add(sd, PRISM(), metal('#a8873a'), 0, 0.107, 0, 0.05, 0.05, 0.004, Math.PI / 2);
    // a prism splitting a sunbeam into a rainbow
    const tb = table(gp, 0.21, Y, 0.21, 0.24, 0.1, 0.08, '#6b4226', -0.6);
    cb(tb, '#3f2a1d', -0.11, 0.125, 0, 0.006, 0.09, 0.06);
    add(tb, BOX(), glow('#fffbe6'), -0.055, 0.112, 0, 0.11, 0.006, 0.004);
    add(tb, PRISM(), glass(), 0, 0.08, 0, 0.05, 0.055, 0.03);
    cb(tb, '#f8fafc', 0.105, 0.125, 0, 0.006, 0.09, 0.06);
    ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#4f46e5', '#a855f7'].forEach((c, i) => {
      const m = glow(c), ty = 0.155 - i * 0.011;
      seg(tb, m, 0.012, 0.106, 0.1, ty, 0.004, 0.004);
      cb(tb, c, 0.1, ty, 0, 0.002, 0.01, 0.04).material = m;
    });
    const a = person(gp, Y, {
      x: 0.02, z: 0.03, ry: 0.15, top: '#6b4423', outfit: 'coat', shirt: '#f5f5f4', accent: '#f5f5f4', bottom: '#3f2a1d', shoes: '#1c1917',
      hair: '#d6d0c4', hairStyle: 'long', armR: { fwd: 0.85, side: 0.5, bend: 0.2 }, armL: { fwd: 0.55, bend: 1.0, inward: 0.4 },
    });
    bl(gp, '#f8fafc', a.head[0] + 0.01, a.head[1] - a.headR * 1.45, a.head[2] + a.headR * 0.65, a.headR * 0.35, a.headR * 0.4, a.headR * 0.2);
    book(gp, '#7f1d1d', a.handL[0] + 0.01, a.handL[1] + 0.02, a.handL[2] + 0.015, 0.06, 0.085, 0.02, 0.15 + Math.PI / 2);
    // the famous apple, mid-fall toward his head
    const ap = at(a.top, -0.045, 0.06, 0.03);
    bl(gp, '#dc2626', ap[0], ap[1], ap[2], 0.022);
    rod(gp, at(ap, 0, 0.018, 0), at(ap, 0.003, 0.032, 0), 0.0025, '#5b3b28', 4);
    bl(gp, '#4d8a3a', ap[0] + 0.01, ap[1] + 0.03, ap[2], 0.01, 0.004, 0.006);
    for (const k of [-1, 0, 1]) cb(gp, '#f8fafc', ap[0] + k * 0.01, ap[1] + 0.06 - Math.abs(k) * 0.008, ap[2], 0.003, 0.035, 0.003);
    rod(gp, a.handR, at(a.handR, 0.03, 0.0, 0.0), 0.006, '#e9b993', 5);
    lighten(gp);
  },

  pp_curie: gp => {
    const Y = figureBase(gp, '#cbbfae', '#5b4a3a');
    for (let i = 0; i < 7; i++) cb(gp, i % 2 ? '#b08a62' : '#a47e57', -0.27 + i * 0.09, Y + 0.003, 0, 0.088, 0.006, 0.5);
    // lab bench with glowing test tubes, flasks and element tiles
    const tb = table(gp, -0.22, Y, -0.2, 0.3, 0.12, 0.15, '#5b3b28', 0.5);
    cb(tb, '#7c5a3a', -0.08, 0.175, 0, 0.09, 0.006, 0.035);
    for (const sx of [-1, 1]) cb(tb, '#7c5a3a', -0.08 + sx * 0.042, 0.16, 0, 0.006, 0.03, 0.035);
    for (let i = 0; i < 4; i++) {
      const x = -0.11 + i * 0.02;
      add(tb, CYL(8), glass(), x, 0.18, 0, 0.012, 0.06, 0.012);
      add(tb, CYL(8), i % 2 ? glow('#bef264', '#a3e635') : glow('#67e8f9', '#22d3ee'), x, 0.165, 0, 0.009, 0.028, 0.009);
    }
    flask(tb, 0.01, 0.15, 0.01, 0.055, '#93c5fd');
    flask(tb, 0.07, 0.15, -0.01, 0.04, '#bef264', '#a3e635');
    for (const [k, txt] of [[0, 'Ra'], [1, 'Po']] as const) {
      const tl = grp(tb, 0.08 + k * 0.05 - 0.05, 0.15, 0.045, 0, -0.25);
      cb(tl, '#1e3a8a', 0, 0.025, 0, 0.042, 0.05, 0.006);
      write(tl, txt, 0, 0.012, 0.0035, 0.019, '#f8fafc', 0.16);
    }
    // Bunsen burner warming a beaker on a tripod
    const t2 = table(gp, 0.29, Y, -0.04, 0.14, 0.11, 0.12, '#5b3b28', -0.5);
    cc(t2, '#374151', 0, 0.125, 0, 0.02, 0.008, 10);
    cc(t2, '#9ca3af', 0, 0.15, 0, 0.007, 0.05, 8);
    add(t2, g('pa-flame', () => new THREE.ConeGeometry(0.5, 1, 8)), mat('#93c5fd', { emissive: '#3b82f6', transparent: 0.8 }), 0, 0.195, 0, 0.016, 0.04, 0.016);
    for (let i = 0; i < 3; i++) { const t = i * 2.09; rod(t2, [Math.cos(t) * 0.035, 0.12, Math.sin(t) * 0.035], [Math.cos(t) * 0.028, 0.225, Math.sin(t) * 0.028], 0.003, '#3f3f46', 4); }
    cc(t2, '#52525b', 0, 0.226, 0, 0.034, 0.004, 12);
    add(t2, CYL(12), glass(), 0, 0.256, 0, 0.05, 0.055, 0.05);
    add(t2, CYL(12), mat('#fda4af'), 0, 0.243, 0, 0.044, 0.028, 0.044);
    // stool with her notebook
    const st = grp(gp, -0.27, Y, 0.17);
    cc(st, '#6b4226', 0, 0.1, 0, 0.05, 0.014, 12);
    for (let i = 0; i < 3; i++) { const t = i * 2.09 + 0.3; rod(st, [Math.cos(t) * 0.035, 0.095, Math.sin(t) * 0.035], [Math.cos(t) * 0.05, 0, Math.sin(t) * 0.05], 0.005, '#5b3b28', 4); }
    openBook(st, 0, 0.11, 0, 0.035, 0.05, '#3f3f46', -0.6, -Math.PI / 2 + 0.2);
    const a = person(gp, Y, {
      x: 0.01, z: 0.05, ry: 0.15, top: '#1c1917', outfit: 'dress', accent: '#3f3f46', hair: '#8a8178', hairStyle: 'bun', shoes: '#1c1917',
      armR: { fwd: 1.35, side: 0.35, bend: 0.55 }, armL: { fwd: 0.55, bend: 1.0, inward: 0.35 },
    });
    // a softly glowing flask held up to the light
    flask(gp, a.handR[0], a.handR[1] - 0.01, a.handR[2], 0.05, '#d9f99d', '#a3e635');
    add(gp, LO(), mat('#ecfccb', { emissive: '#bef264', transparent: 0.22 }), a.handR[0], a.handR[1] + 0.012, a.handR[2], 0.05, 0.05, 0.05);
    book(gp, '#57534e', a.handL[0] + 0.01, a.handL[1] + 0.02, a.handL[2] + 0.015, 0.055, 0.075, 0.016, 0.15 + Math.PI / 2);
    lighten(gp);
  },

  pp_einstein: gp => {
    const Y = figureBase(gp, '#c9b48f', '#5b4632');
    for (let i = 0; i < 7; i++) cb(gp, i % 2 ? '#9c7a55' : '#a8845c', -0.27 + i * 0.09, Y + 0.003, 0, 0.088, 0.006, 0.5);
    // chalkboard on an easel
    const eb = grp(gp, 0.27, Y, -0.1, -0.5);
    for (const sx of [-1, 1]) rod(eb, [sx * 0.11, 0, 0.03], [sx * 0.085, 0.42, -0.01], 0.006, '#6b4226', 5);
    rod(eb, [0, 0, -0.12], [0, 0.4, -0.02], 0.006, '#6b4226', 5);
    const bd = grp(eb, 0, 0.27, 0.018, 0, -0.08);
    cb(bd, '#6b4226', 0, 0, 0, 0.28, 0.19, 0.012);
    cb(bd, '#1f3b2d', 0, 0, 0.006, 0.26, 0.17, 0.004);
    write(bd, 'E=mc^2', 0, -0.01, 0.0095, 0.045, '#f8fafc', 0.12);
    seg(bd, '#e5e7eb', -0.11, 0.06, -0.06, 0.07, 0.003, 0.002, 0.0095);
    seg(bd, '#e5e7eb', -0.11, 0.045, -0.04, 0.045, 0.003, 0.002, 0.0095);
    write(bd, '3+4', 0.07, 0.04, 0.0095, 0.02, '#fde68a', 0.12);
    seg(bd, '#e5e7eb', -0.1, -0.06, 0.1, -0.06, 0.003, 0.002, 0.0095);
    cb(bd, '#6b4226', 0, -0.1, 0.018, 0.26, 0.008, 0.03);
    for (const cx of [-0.06, -0.03]) cb(bd, '#f8fafc', cx, -0.093, 0.02, 0.02, 0.006, 0.006);
    // violin resting on a stool
    const st = grp(gp, -0.26, Y, -0.17);
    cc(st, '#6b4226', 0, 0.11, 0, 0.055, 0.014, 12);
    for (let i = 0; i < 3; i++) { const t = i * 2.09 + 0.3; rod(st, [Math.cos(t) * 0.04, 0.105, Math.sin(t) * 0.04], [Math.cos(t) * 0.055, 0, Math.sin(t) * 0.055], 0.005, '#5b3b28', 4); }
    const v = grp(st, 0, 0.13, 0, 0.9, -Math.PI / 2 + 0.25);
    bl(v, '#b45309', 0, -0.03, 0, 0.04, 0.048, 0.013);
    bl(v, '#b45309', 0, 0.035, 0, 0.032, 0.038, 0.013);
    bl(v, '#7c2d12', 0, 0.0, 0, 0.026, 0.02, 0.012);
    cb(v, '#1c1917', 0, 0.1, 0.012, 0.012, 0.09, 0.006);
    bl(v, '#7c2d12', 0, 0.15, 0.008, 0.01, 0.014, 0.01);
    cb(v, '#d6d3d1', 0, -0.035, 0.016, 0.022, 0.004, 0.006);
    for (let i = 0; i < 4; i++) cb(v, '#e7e5e4', -0.006 + i * 0.004, 0.04, 0.0155, 0.0008, 0.15, 0.001);
    rod(st, [-0.07, 0.125, 0.05], [0.07, 0.13, -0.06], 0.0025, '#5b3b28', 4);
    // a pile of papers and books
    for (let i = 0; i < 3; i++) book(gp, ['#1e3a8a', '#7f1d1d', '#57534e'][i], -0.2, Y + 0.012 + i * 0.022, 0.22, 0.07, 0.095, 0.02, 0.3 + i * 0.25, -Math.PI / 2);
    for (let i = 0; i < 4; i++) cb(gp, '#f8fafc', 0.05 + hash3(i, 1, 2) * 0.15, Y + 0.008, 0.25 + hash3(i, 3, 1) * 0.1, 0.05, 0.002, 0.065, hash3(i, 5, 5) * 3);
    const a = person(gp, Y, {
      x: -0.08, z: 0.06, ry: 0.35, top: '#6b6f76', outfit: 'suit', shirt: '#f5f5f4', accent: '#4b5563', bottom: '#5b5f66', shoes: '#1c1917',
      hair: '#f5f5f4', hairStyle: 'wild', beard: 'moustache', beardColor: '#e7e5e4', armR: { fwd: 1.45, side: 0.55, bend: 0.3 }, armL: { fwd: 0.3, side: 0.1, bend: 0.6 },
    });
    rod(gp, a.handR, at(a.handR, 0.015, 0.028, 0.0), 0.005, '#ffffff', 5);
    lighten(gp);
  },

  pp_darwin: gp => {
    const Y = figureBase(gp, '#d9c99c', '#6b5640');
    for (const [x, z, s] of [[0.06, -0.33, 0.06], [0.24, 0.29, 0.05], [-0.36, -0.02, 0.045], [0.16, 0.33, 0.035]]) rock(gp, '#3f3a36', x, Y + s * 0.3, z, s);
    // the sea with HMS Beagle
    const sea = grp(gp, 0.31, Y, 0.0, -0.6);
    bl(sea, '#9fd3ea', 0, 0.001, 0, 0.15, 0.004, 0.11);
    bl(sea, '#2b7fb8', 0, 0.003, 0, 0.135, 0.004, 0.095);
    const sp = grp(sea, -0.01, 0.006, 0, 0.3);
    bl(sp, '#3b2a1d', 0, 0.012, 0, 0.06, 0.016, 0.018);
    cb(sp, '#5b3b28', 0, 0.022, 0, 0.11, 0.008, 0.03);
    for (const [mx, mh] of [[-0.035, 0.09], [0.0, 0.11], [0.035, 0.085]]) {
      cc(sp, '#3b2a1d', mx, 0.026 + mh / 2, 0, 0.002, mh, 5);
      for (const k of [0.4, 0.75]) cb(sp, '#f5f0e1', mx, 0.026 + mh * k, 0, 0.004, mh * 0.3, 0.04 - k * 0.012);
    }
    cb(sp, '#b91c1c', 0.0, 0.026 + 0.115, 0, 0.002, 0.008, 0.016);
    // giant Galápagos tortoise
    const tt = grp(gp, -0.23, Y, 0.17, 0.5);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cc(tt, '#7a6e5c', lx * 0.06, 0.02, lz * 0.06, 0.02, 0.04, 7);
    bl(tt, '#3f3424', 0, 0.04, 0, 0.09, 0.02, 0.105);
    bl(tt, '#5a4a33', 0, 0.05, 0, 0.085, 0.06, 0.1);
    for (const [sx, sz] of [[0, 0], [0, 0.05], [0, -0.05], [0.04, 0.02], [-0.04, 0.02], [0.04, -0.03], [-0.04, -0.03]]) bl(tt, '#6e5b3e', sx, 0.05 + Math.sqrt(Math.max(0, 1 - (sx / 0.085) ** 2 - (sz / 0.1) ** 2)) * 0.058, sz, 0.02, 0.006, 0.02);
    rod(tt, [0, 0.045, 0.09], [0, 0.075, 0.14], 0.016, '#8a7d68', 6);
    bl(tt, '#8a7d68', 0, 0.08, 0.155, 0.022, 0.018, 0.028);
    for (const k of [-1, 1]) bl(tt, '#111', k * 0.016, 0.088, 0.165, 0.004);
    // prickly-pear cactus with a finch on top
    const cx = -0.27, cz = -0.2;
    cc(gp, '#7a6a4a', cx, Y + 0.06, cz, 0.018, 0.12, 7);
    for (const [px, py, pz, rz, ry] of [[0, 0.17, 0, 0.1, 0.5], [-0.05, 0.24, 0.0, 0.6, 0.6], [0.05, 0.25, 0.01, -0.5, 0.4], [0.0, 0.31, -0.01, 0.05, 0.6], [0.08, 0.33, 0, -0.3, 0.5]]) {
      bl(gp, '#5f9e4a', cx + px, Y + py, cz + pz, 0.04, 0.055, 0.012, ry, 0, rz);
      bl(gp, '#facc15', cx + px - Math.sin(rz) * -0.05, Y + py + 0.052, cz + pz, 0.012);
    }
    finch(gp, cx + 0.0, Y + 0.355, cz - 0.01, -0.4, 0.032, '#3f3a32');
    const a = person(gp, Y, {
      x: 0.03, z: 0.04, ry: 0.1, top: '#2a2a2e', outfit: 'coat', shirt: '#f5f5f4', accent: '#e7e5e4', bottom: '#3a3a3e', shoes: '#1c1917',
      hairStyle: 'bald', hair: '#d6d3d1', beard: 'long', beardColor: '#ececec', armR: { fwd: 1.0, side: 0.45, bend: 0.6 }, armL: { fwd: 0.55, bend: 1.0, inward: 0.4 },
    });
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) bl(a.group, '#e7e5e4', s * (0.068 + i * 0.002), 0.565 - i * 0.022, -0.02 - i * 0.012, 0.02);
    finch(gp, a.handR[0], a.handR[1] + 0.01, a.handR[2], -0.6, 0.055, '#6b4a2a');
    book(gp, '#3f6212', a.handL[0] + 0.01, a.handL[1] + 0.02, a.handL[2] + 0.015, 0.055, 0.075, 0.016, 0.15 + Math.PI / 2);
    lighten(gp);
  },
  pp_tesla: gp => {
    const Y = figureBase(gp, '#a8a29e', '#4b4540');
    for (let i = 0; i < 7; i++) cb(gp, i % 2 ? '#6b625a' : '#756b62', -0.27 + i * 0.09, Y + 0.003, 0, 0.088, 0.006, 0.5);
    // Tesla coil: copper-striped secondary, primary rings and a shiny toroid throwing sparks
    const tc = grp(gp, 0.3, Y, -0.07);
    rbox(tc, '#3f3f46', 0, 0, 0, 0.13, 0.04, 0.13, 0.006);
    for (let i = 0; i < 3; i++) ring(tc, '', 0, 0.05 + i * 0.012, 0, 0.055, 0.06, 0, Math.PI / 2, 0, metal('#c2702d'));
    add(tc, g('pa-coil', () => paintFaces(new THREE.CylinderGeometry(1, 1, 1, 12, 24), '#e7c58a', (_x, y) => (Math.floor((y + 0.5) * 24) % 2 ? '#b45309' : null))), mat('#ffffff', { vc: true }), 0, 0.17, 0, 0.022, 0.26, 0.022);
    ring(tc, '', 0, 0.31, 0, 0.05, 0.42, 0, Math.PI / 2, 0, metal('#d4d4d8'));
    add(tc, LO(), metal('#e4e4e7'), 0, 0.325, 0, 0.018, 0.018, 0.018);
    const sparks = [[-0.17, 0.4, 0.08], [0.05, 0.5, 0.06], [0.14, 0.38, 0.0], [-0.08, 0.48, -0.06], [0.12, 0.44, -0.1]].flatMap(([dx, dy, dz], i) => bolt([Math.sign(dx) * 0.06, 0.31, dz * 0.5], [dx, dy, dz], 5, 0.05, i + 3));
    const sp = new THREE.Mesh(mergeGeometries(sparks), mat('#f5d0fe', { emissive: '#d946ef' }));
    tc.add(sp);
    // AC induction motor with a spinning rotor
    const mo = grp(gp, -0.26, Y, 0.16, -0.6);
    rbox(mo, '#57534e', 0, 0, 0, 0.12, 0.02, 0.1, 0.004);
    for (const sx of [-1, 1]) cb(mo, '#44403c', sx * 0.04, 0.035, 0, 0.012, 0.03, 0.06);
    cc(mo, '#4b5563', 0, 0.075, -0.005, 0.05, 0.07, 14, 0, Math.PI / 2);
    ring(mo, '', 0, 0.075, 0.032, 0.04, 0.2, 0, 0, 0, metal('#c2702d'));
    const rt = grp(mo, 0, 0.075, 0.04, 0, 0, 0, 'spin');
    cc(rt, '#9ca3af', 0, 0, 0, 0.008, 0.03, 8, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) cb(rt, '#d4d4d8', 0, 0, 0.012, 0.07, 0.008, 0.004, 0, 0, (i * Math.PI) / 4);
    // a white pigeon friend
    finch(gp, 0.12, Y + 0.004, 0.29, 0.9, 0.05, '#e5e7eb');
    const a = person(gp, Y, {
      x: -0.08, z: 0.04, ry: 0.3, h: 0.65, top: '#1c1c20', outfit: 'suit', shirt: '#f5f5f4', accent: '#7f1d1d', bottom: '#1c1c20', shoes: '#111111',
      hair: '#111111', hairStyle: 'short', beard: 'moustache', beardColor: '#111111', armL: { fwd: 1.5, side: 0.4, bend: 0.45 }, armR: { fwd: 0.6, side: 0.55, bend: 0.2 },
    });
    // a bulb lighting up in his hand with no wires at all
    bulb(gp, a.handL[0], a.handL[1] - 0.01, a.handL[2], 0.08);
    add(gp, LO(), mat('#fef9c3', { emissive: '#fde047', transparent: 0.2 }), a.handL[0], a.handL[1] + 0.045, a.handL[2], 0.055, 0.055, 0.055);
    lighten(gp);
  },

  pp_edison: gp => {
    const Y = figureBase(gp, '#c9b48f', '#5b4632');
    for (let i = 0; i < 7; i++) cb(gp, i % 2 ? '#a8845c' : '#9c7a55', -0.27 + i * 0.09, Y + 0.003, 0, 0.088, 0.006, 0.5);
    // phonograph with a big brass horn
    const tb = table(gp, 0.29, Y, 0.06, 0.18, 0.12, 0.1, '#5b3b28', -0.7);
    rbox(tb, '#4a2e1c', 0, 0.1, 0, 0.12, 0.035, 0.08, 0.005);
    cc(tb, '#3f2a1d', 0, 0.152, 0, 0.02, 0.075, 12, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) cb(tb, '#b08d3c', sx * 0.042, 0.145, 0, 0.006, 0.03, 0.006);
    rod(tb, [0.045, 0.152, 0], [0.065, 0.152, 0], 0.003, '#b08d3c', 4);
    rod(tb, [0.065, 0.152, 0], [0.065, 0.125, 0.012], 0.003, '#b08d3c', 4);
    const hornM = mat('#c9a24a', { metal: 0.51, rough: 0.36, flat: false });
    hornM.side = THREE.DoubleSide;
    const { q: hq } = axis(tb, [0, 0.165, 0], [-0.06, 0.3, 0.1]);
    rod(tb, [0, 0.15, 0], [0, 0.17, 0], 0.005, '#b08d3c', 5);
    lathe(hq, [[0.007, 0], [0.011, 0.07], [0.022, 0.14], [0.045, 0.2], [0.085, 0.235], [0.1, 0.24]], '#c9a24a', 0, 0, 0, 16).material = hornM;
    // workbench with battery jars and a test lamp
    const wb = table(gp, -0.22, Y, -0.21, 0.28, 0.12, 0.14, '#5b3b28', 0.5);
    for (let i = 0; i < 3; i++) {
      const x = -0.1 + i * 0.045;
      add(wb, CYL(10), glass(), x, 0.17, 0, 0.034, 0.06, 0.034);
      cb(wb, '#52525b', x - 0.006, 0.18, 0, 0.004, 0.06, 0.02);
      cb(wb, '#c2702d', x + 0.006, 0.18, 0, 0.004, 0.06, 0.02);
      if (i < 2) rod(wb, [x + 0.006, 0.21, 0], [x + 0.039, 0.21, 0], 0.0018, '#b45309', 3);
    }
    rod(wb, [0.06, 0.14, 0], [0.06, 0.22, 0], 0.004, '#3f3f46', 5);
    bulb(wb, 0.06, 0.22, 0, 0.045);
    book(wb, '#1e3a8a', 0.11, 0.146, 0.01, 0.05, 0.07, 0.012, 0.3, -Math.PI / 2);
    const a = person(gp, Y, {
      x: -0.03, z: 0.05, ry: 0.2, top: '#2b2b30', outfit: 'suit', shirt: '#f5f5f4', accent: '#1c1917', bottom: '#2b2b30', shoes: '#1c1917',
      hair: '#e7e5e4', hairStyle: 'short', armR: { fwd: 1.75, side: 0.35, bend: 0.3 }, armL: { fwd: 0.4, side: 0.12, bend: 0.6 },
    });
    const nk = at(a.head, 0, -a.headR * 1.42, a.headR * 0.62);
    for (const k of [-1, 1]) bl(gp, '#1c1917', nk[0] + k * 0.012, nk[1], nk[2], 0.012, 0.008, 0.005, 0, 0, k * 0.3);
    bl(gp, '#1c1917', nk[0], nk[1], nk[2] + 0.002, 0.005);
    // his big idea: a long-lasting light bulb
    bulb(gp, a.handR[0], a.handR[1] - 0.01, a.handR[2], 0.1);
    add(gp, LO(), mat('#fef9c3', { emissive: '#fde047', transparent: 0.2 }), a.handR[0], a.handR[1] + 0.058, a.handR[2], 0.065, 0.065, 0.065);
    lighten(gp);
  },

  pp_ibnsina: gp => {
    const Y = figureBase(gp, '#d7c39a', '#6b5640');
    // Persian carpet
    const cp = grp(gp, 0, Y, 0.05);
    rbox(cp, '#9f1239', 0, 0, 0, 0.4, 0.008, 0.3, 0.003);
    for (const [w, d, c] of [[0.36, 0.26, '#1e3a8a'], [0.32, 0.22, '#9f1239']] as const) rbox(cp, c, 0, 0.0005, 0, w, 0.0085, d, 0.002);
    bl(cp, '#facc15', 0, 0.009, 0, 0.06, 0.002, 0.045);
    bl(cp, '#1e3a8a', 0, 0.01, 0, 0.035, 0.002, 0.026);
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) cb(cp, '#f5f0e1', sx * 0.205, 0.003, -0.125 + i * 0.05, 0.012, 0.002, 0.004);
    // tiled iwan of Bukhara with a turquoise dome behind
    const iw = grp(gp, -0.2, Y, -0.27, 0.45);
    panel(iw, 0.28, 0.36, 0.04, '#d6c09a', [archPath(0, 0.02, 0.15, 0.25, true)]);
    cb(iw, '#1e3a5f', 0, 0.14, -0.012, 0.16, 0.27, 0.012);
    for (const sx of [-1, 1]) cb(iw, '#2563eb', sx * 0.11, 0.16, 0.021, 0.02, 0.3, 0.003);
    cb(iw, '#2563eb', 0, 0.315, 0.021, 0.24, 0.022, 0.003);
    cb(iw, '#1e3a8a', 0, 0.35, 0.002, 0.29, 0.02, 0.045);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) cb(iw, i % 2 ? '#facc15' : '#14b8a6', sx * 0.065, 0.29 - i * 0.012, 0.021, 0.012, 0.008, 0.003, 0, 0, Math.PI / 4);
    cc(iw, '#d6c09a', 0, 0.34, -0.1, 0.075, 0.05, 14);
    bl(iw, '#14b8a6', 0, 0.365, -0.1, 0.078, 0.085, 0.078);
    rod(iw, [0, 0.44, -0.1], [0, 0.48, -0.1], 0.004, '#d6b25e', 4);
    // blue-and-white medicine jars on a low shelf
    const sh = table(gp, 0.3, Y, -0.08, 0.17, 0.08, 0.08, '#6b4226', -0.6);
    [['#1d4ed8', 1], ['#0f766e', 0.85], ['#1d4ed8', 0.7]].forEach(([c, s], i) => {
      const k = s as number, x = -0.05 + i * 0.05;
      lathe(sh, [[0, 0], [0.022, 0], [0.02, 0.01], [0.017, 0.035], [0.02, 0.055], [0.014, 0.065], [0.016, 0.072], [0, 0.072]].map(([r, h]) => [r * (0.9 + k * 0.2), h * (0.7 + k * 0.4)] as [number, number]), c as string, x, 0.08, 0, 12);
      cc(sh, '#f5f0e1', x, 0.08 + 0.035 * (0.7 + k * 0.4), 0, 0.018 * (0.9 + k * 0.2), 0.012, 12);
    });
    // brass mortar and pestle with herbs
    const mx = 0.18, mz = 0.29;
    lathe(gp, [[0, 0], [0.032, 0], [0.028, 0.012], [0.036, 0.05], [0.03, 0.05], [0.024, 0.02], [0, 0.02]], '#b08d3c', mx, Y, mz, 12).material = metal('#b08d3c');
    rod(gp, [mx, Y + 0.03, mz], [mx + 0.03, Y + 0.1, mz - 0.02], 0.007, '#8a7535', 6);
    for (let i = 0; i < 4; i++) bl(gp, '#65a30d', mx - 0.07 + i * 0.012, Y + 0.008, mz + 0.03 - i * 0.01, 0.012, 0.004, 0.006, i);
    const a = person(gp, Y + 0.008, {
      x: 0.0, z: 0.03, ry: 0.15, top: '#2f6b4f', accent: '#d6b25e', cape: '#7c4a2a', outfit: 'robe', wideSleeves: true, hat: 'turban', hatColor: '#f5f5f4',
      hair: '#1c1917', hairStyle: 'short', beard: 'full', beardColor: '#1c1917', skin: '#d9a47c', shoes: '#7c2d12',
      armL: { fwd: 0.85, side: 0.12, bend: 0.55, inward: 0.3 }, armR: { fwd: 0.85, side: 0.12, bend: 0.55, inward: 0.3 },
    });
    // The Canon of Medicine, held open for us to see
    const bx = (a.handL[0] + a.handR[0]) / 2, by = (a.handL[1] + a.handR[1]) / 2, bz = (a.handL[2] + a.handR[2]) / 2;
    const ob = openBook(gp, bx, by + 0.035, bz + 0.03, 0.06, 0.085, '#14532d', 0.15, -0.35, '#7f1d1d');
    cb(ob, '#d6b25e', 0, 0, -0.008, 0.125, 0.004, 0.003);
    lighten(gp);
  },

  pp_ramanujan: gp => {
    const Y = figureBase(gp, '#d9b98a', '#6b4a2a');
    // colourful temple gopuram of Kumbakonam
    const gq = grp(gp, -0.22, Y, -0.25, 0.45);
    cb(gq, '#efe6d2', 0, 0.035, 0, 0.21, 0.07, 0.1);
    cb(gq, '#3f2a1d', 0, 0.03, 0.051, 0.05, 0.06, 0.002);
    const tiers = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#f472b6'];
    tiers.forEach((c, i) => {
      const w = 0.19 - i * 0.032, d = 0.09 - i * 0.012, y0 = 0.07 + i * 0.05;
      cb(gq, c, 0, y0 + 0.02, 0, w, 0.04, d);
      cb(gq, shade(c, 0.75), 0, y0 + 0.044, 0, w + 0.012, 0.008, d + 0.012);
      for (let k = 0; k < 4 - (i >> 1); k++) cb(gq, tiers[(i + k + 2) % 5], -w / 2 + (k + 0.75) * (w / (4.5 - (i >> 1))), y0 + 0.02, d / 2 + 0.003, 0.01, 0.024, 0.004);
    });
    cc(gq, '#f59e0b', 0, 0.35, 0, 0.028, 0.08, 10, 0, 0, Math.PI / 2);
    for (let k = -1; k <= 1; k++) cone(gq, '#d6b25e', k * 0.025, 0.37, 0, 0.007, 0.03, 6);
    // brass oil lamp (kuthuvilakku) with little flames
    const lp = grp(gp, 0.33, Y, -0.06);
    const brass = metal('#c9a24a');
    lathe(lp, [[0, 0], [0.04, 0], [0.04, 0.01], [0.012, 0.02], [0.008, 0.12], [0.03, 0.14], [0.034, 0.15], [0, 0.15]], '#c9a24a', 0, 0, 0, 12).material = brass;
    lathe(lp, [[0, 0.15], [0.006, 0.15], [0.004, 0.19], [0.012, 0.2], [0, 0.22]], '#c9a24a', 0, 0, 0, 8).material = brass;
    for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; add(lp, g('pa-flame', () => new THREE.ConeGeometry(0.5, 1, 8)), mat('#fde68a', { emissive: '#f59e0b' }), Math.cos(t) * 0.03, 0.165, Math.sin(t) * 0.03, 0.01, 0.026, 0.01); }
    // golden infinity sign
    const inf = grp(gp, 0.2, Y, 0.28, -0.6);
    rod(inf, [0, 0, 0], [0, 0.05, 0], 0.005, '#78716c', 5);
    rbox(inf, '#57534e', 0, 0, 0, 0.07, 0.012, 0.05, 0.003);
    for (const sx of [-1, 1]) ring(inf, '', sx * 0.033, 0.087, 0, 0.034, 0.22, 0, 0, 0, metal('#e0b43a'));
    // notebooks full of formulas
    for (let i = 0; i < 3; i++) book(gp, ['#7f1d1d', '#365314', '#1e3a8a'][i], -0.23, Y + 0.012 + i * 0.024, 0.2, 0.07, 0.095, 0.022, 0.5 + i * 0.25, -Math.PI / 2);
    const a = person(gp, Y, {
      x: -0.02, z: 0.03, ry: 0.15, skin: '#9a6644', top: '#2d2d33', outfit: 'coat', shirt: '#f5f5f4', accent: '#f5f5f4', bottom: '#f5f5f4', shoes: '#3f2a1d',
      hair: '#111111', hairStyle: 'short', armL: { fwd: 0.95, side: 0.1, bend: 0.45, inward: 0.25 }, armR: { fwd: 1.05, side: 0.35, bend: 0.55, inward: 0.1 },
    });
    // slate with the taxicab number 1729
    slate(gp, 0.17, 0.11, '1729', 0.034, -0.35, a.handL[0] + 0.04, a.handL[1] + 0.045, a.handL[2] + 0.025, -0.1);
    rod(gp, a.handR, at(a.handR, -0.01, 0.025, 0.012), 0.005, '#ffffff', 5);
    lighten(gp);
  },

  pp_hypatia: gp => {
    const Y = figureBase(gp, '#e3d3a8', '#7a6448');
    rbox(gp, '#efe6d2', 0, Y, 0, 0.5, 0.008, 0.42, 0.004);
    // scroll shelves of the great Library
    const lb = grp(gp, -0.21, Y, -0.25, 0.45);
    cb(lb, '#6b4226', 0, 0.16, -0.035, 0.27, 0.32, 0.01);
    for (const sx of [-1, 1]) cb(lb, '#7c4a2a', sx * 0.13, 0.16, 0, 0.014, 0.32, 0.08);
    for (let r = 0; r <= 4; r++) cb(lb, '#7c4a2a', 0, 0.005 + r * 0.077, 0, 0.27, 0.01, 0.08);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      cb(lb, '#7c4a2a', -0.043 + c * 0.086 - 0.043, 0.04 + r * 0.077, 0, c === 0 ? 0 : 0.008, 0.067, 0.078);
      for (let k = 0; k < 3; k++) {
        const x = -0.086 + c * 0.086 + (k - 1) * 0.022, y = 0.026 + r * 0.077 + (k === 1 ? 0.026 : 0);
        cc(lb, k === 1 ? '#e8d9b0' : '#efe3c2', x, y, 0.005, 0.011, 0.07, 8, 0, Math.PI / 2);
        cc(lb, '#7c4a2a', x, y, 0.041, 0.005, 0.004, 6, 0, Math.PI / 2);
        if ((r + c + k) % 3 === 0) cb(lb, '#b91c1c', x + 0.006, y - 0.012, 0.038, 0.006, 0.016, 0.002);
      }
    }
    ionicColumn(gp, 0.33, Y, -0.1, 0.38);
    // celestial globe on a stand
    const cg = grp(gp, 0.25, Y, 0.2, -0.6);
    lathe(cg, [[0, 0], [0.04, 0], [0.035, 0.012], [0.008, 0.03], [0.008, 0.07], [0, 0.07]], '#b08d3c', 0, 0, 0, 10);
    add(cg, g('pa-sky', () => paintFaces(new THREE.SphereGeometry(1, 16, 11), '#1e3a8a', (x, y, z) => (hash3(x * 13, y * 13, z * 13) > 0.86 ? '#facc15' : null))), mat('#ffffff', { vc: true }), 0, 0.125, 0, 0.05, 0.05, 0.05);
    ring(cg, '', 0, 0.125, 0, 0.058, 0.07, 0, 0, 0.4, metal('#c9a24a'));
    ring(cg, '', 0, 0.1, 0, 0.06, 0.06, 0, Math.PI / 2, 0, metal('#b08d3c'));
    const a = person(gp, Y + 0.008, {
      x: -0.02, z: 0.04, ry: 0.2, top: '#efe6d2', outfit: 'dress', accent: '#d6b25e', cape: '#3b5b9a', hair: '#5b3a24', hairStyle: 'bun', shoes: '#8b5a2b',
      armR: { fwd: 1.3, side: 0.45, bend: 0.35 }, armL: { fwd: 0.6, bend: 0.9, inward: 0.3 },
    });
    // gold band in her hair
    ring(gp, '', a.head[0], a.head[1] + a.headR * 0.45, a.head[2] - a.headR * 0.12, a.headR * 1.05, 0.07, 0, Math.PI / 2 + 0.2, 0, metal('#e0b43a'));
    // brass astrolabe held up to the stars
    const as = grp(gp, a.handR[0], a.handR[1] + 0.06, a.handR[2] + 0.01, -0.45);
    const br = metal('#c9a24a');
    add(as, CYL(20), br, 0, 0, 0, 0.1, 0.006, 0.1, 0, Math.PI / 2);
    add(as, CYL(20), metal('#8a6d2a'), 0, 0, 0.0035, 0.085, 0.002, 0.085, 0, Math.PI / 2);
    ring(as, '', 0, 0, 0.005, 0.034, 0.1, 0, 0, 0, br);
    ring(as, '', 0, 0.01, 0.006, 0.022, 0.12, 0, 0, 0, br);
    for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; seg(as, br, 0, 0, Math.cos(t) * 0.04, Math.sin(t) * 0.04, 0.003, 0.002, 0.006); }
    cb(as, '#e0b43a', 0, 0, 0.008, 0.095, 0.006, 0.002, 0, 0, 0.6);
    ring(as, '', 0, 0.06, 0, 0.012, 0.2, 0, Math.PI / 2, 0, br);
    cb(as, '#c9a24a', 0, 0.05, 0, 0.016, 0.012, 0.006);
    scroll(gp, a.handL[0], a.handL[1] + 0.01, a.handL[2] + 0.015, 0.11, 0.013, 0.2);
    lighten(gp);
  },
};
