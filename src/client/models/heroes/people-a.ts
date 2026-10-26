import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, BOX, CYL, g, hash3, lathe, mat, plinth, rbox, rod, shade, SITE, tree, tube } from '../prims.ts';
import { figure, type FigureAnchors, type FigureOpts } from '../figure.ts';
import { human } from '../human.ts';

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

// ---- props
/** closed book lying in its local XY plane (w × h, thickness t along z) */
function book(p: O, c: string, x: number, y: number, z: number, w: number, h: number, t: number, ry = 0, rx = 0, rz = 0): THREE.Group {
  const q = grp(p, x, y, z, ry, rx, rz);
  for (const sz of [-1, 1]) cb(q, c, 0, 0, sz * t * 0.42, w, h, t * 0.16);
  cb(q, shade(c, 0.85), -w / 2 + t * 0.06, 0, 0, t * 0.14, h, t);
  cb(q, '#f2e8d0', t * 0.04, 0, 0, w * 0.95, h * 0.92, t * 0.7);
  cb(q, '#c4ab70', -w / 2 + t * 0.06, h * 0.3, 0, t * 0.16, h * 0.06, t * 1.02);
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
function scroll(p: O, x: number, y: number, z: number, len: number, r: number, ry = 0, paper = '#e8e0c9', knob = '#734c33'): void {
  const q = grp(p, x, y, z, ry);
  cc(q, paper, 0, 0, 0, r, len, 8, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) cc(q, knob, sx * len * 0.55, 0, 0, r * 0.45, len * 0.12, 6, 0, 0, Math.PI / 2);
  cc(q, '#9a3b3b', 0, 0, 0, r * 1.05, len * 0.06, 8, 0, 0, Math.PI / 2);
}
/** table with four legs; returns the group (top surface at local y = h) */
function table(p: O, x: number, y: number, z: number, w: number, d: number, h: number, c: string, ry = 0): THREE.Group {
  const q = grp(p, x, y, z, ry);
  rbox(q, c, 0, h - 0.016, 0, w, 0.016, d, 0.005);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cb(q, shade(c, 0.82), sx * (w / 2 - 0.014), (h - 0.016) / 2, sz * (d / 2 - 0.014), 0.014, h - 0.016, 0.014);
  return q;
}
function tuft(p: O, x: number, y: number, z: number, s: number, c = '#609d4b'): void {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + x * 7;
    add(p, g('pa-blade', () => new THREE.ConeGeometry(0.5, 1, 4)), mat(shade(c, 0.9 + i * 0.08)), x + Math.cos(a) * s * 0.25, y + s * 0.45, z + Math.sin(a) * s * 0.25, s * 0.35, s, s * 0.2, a, Math.cos(a) * 0.35, Math.sin(a) * 0.35);
  }
}
/** a broad-leaf tree (shared prims `tree`) about h tall, with optional fruit dotted over the canopy */
function canopyTree(p: O, x: number, y: number, z: number, h: number, leaf: string, dots?: string, nDots = 0): void {
  const s = h * 0.62;
  tree(p, x, y, z, s, leaf);
  for (let i = 0; i < nDots && dots; i++) {
    const a = i * 2.39996, t = 0.25 + (i % 5) * 0.14, rr = s * (0.95 - Math.abs(t - 0.45) * 0.9);
    bl(p, dots, x + Math.cos(a) * rr, y + s * (0.62 + t * 0.6), z + Math.sin(a) * rr, s * 0.055);
  }
}
/** Erlenmeyer flask with (optionally glowing) liquid */
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
/**
 * Zhang Heng's 候风地动仪 after 王振铎's reconstruction: a patinated bronze 酒尊-shaped jar with a domed lid, eight
 * dragons running down from the lid with a bronze ball in each mouth, eight squatting toads below with mouths open
 * upward. One dragon (facing the viewer) has just dropped its ball into the toad's mouth.
 */
function seismoscope(p: O, x: number, y: number, z: number, s: number): void {
  const q = grp(p, x, y, z);
  const bronze = '#62603f', dark = '#46452f', ball = '#9a8248';
  const S = (pts: number[][]) => pts.map(([r, h]) => [r * s, h * s] as [number, number]);
  lathe(q, S([[0, 0], [0.24, 0], [0.24, 0.016], [0, 0.016]]), '#7d7869', 0, 0, 0, 24);
  const jar = lathe(q, S([[0, 0.016], [0.108, 0.016], [0.112, 0.03], [0.102, 0.045], [0.106, 0.1], [0.118, 0.2], [0.122, 0.262], [0.116, 0.29],
    [0.108, 0.3], [0.112, 0.31], [0.098, 0.338], [0.07, 0.366], [0.035, 0.381], [0, 0.384]]), bronze, 0, 0, 0, 24);
  jar.material = metal(bronze);
  // cast relief bands (篆文 and mountain/animal patterns) as darker rings
  for (const [yy, r] of [[0.06, 0.104], [0.15, 0.114], [0.24, 0.122], [0.303, 0.11]]) ring(q, '', 0, yy * s, 0, r * s, 0.05, 0, Math.PI / 2, 0, metal(dark));
  lathe(q, S([[0, 0.38], [0.016, 0.38], [0.02, 0.4], [0.01, 0.415], [0, 0.418]]), dark, 0, 0, 0, 10).material = metal(dark);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI * 0.75, ca = Math.cos(a), sa = Math.sin(a);
    const P = (r: number, h: number): V3 => [ca * r * s, h * s, sa * r * s];
    const dm = metal(dark);
    // dragon body: from the lid down the shoulder to the head jutting out and down
    tube(q, [P(0.03, 0.384), P(0.072, 0.37), P(0.104, 0.338), P(0.12, 0.3), P(0.13, 0.282)], 0.007 * s, 0.012 * s, bronze, { radial: 6, sub: 3 }).material = metal(shade(bronze, 0.88));
    const hd = grp(q, ...P(0.142, 0.27), -a + Math.PI / 2);
    bl(hd, dark, 0, 0, 0, 0.016 * s, 0.015 * s, 0.022 * s, 0, 0.45).material = dm;
    bl(hd, dark, 0, -0.008 * s, 0.018 * s, 0.01 * s, 0.006 * s, 0.014 * s, 0, 0.7).material = dm; // lower jaw
    for (const sx of [-1, 1]) rod(hd, [sx * 0.008 * s, 0.01 * s, -0.008 * s], [sx * 0.012 * s, 0.024 * s, -0.022 * s], 0.0035 * s, dark, 4).material = dm; // horns
    if (i !== 0) bl(hd, ball, 0, -0.01 * s, 0.026 * s, 0.011 * s).material = metal(ball);
    // toad squatting on the ground below, head up, mouth open to catch the ball
    const td = grp(q, ...P(0.152, 0.016), -a + Math.PI / 2);
    bl(td, bronze, 0, 0.018 * s, 0, 0.03 * s, 0.02 * s, 0.032 * s).material = metal(bronze);
    bl(td, bronze, 0, 0.034 * s, 0.02 * s, 0.022 * s, 0.018 * s, 0.018 * s, 0, -0.6).material = metal(bronze);
    for (const sx of [-1, 1]) bl(td, dark, sx * 0.026 * s, 0.01 * s, 0.012 * s, 0.01 * s, 0.01 * s, 0.016 * s).material = dm;
    cc(td, '#1f1d14', 0, 0.047 * s, 0.024 * s, 0.011 * s, 0.006 * s, 8, 0, 0.3);
    if (i === 0) bl(td, ball, 0, 0.052 * s, 0.024 * s, 0.011 * s).material = metal(ball);
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
/** wedge-shaped glass prism with its edge along local z */
/** brass-banded wooden telescope from A (eyepiece) to B (objective) */

/** fluted Greek column with Ionic scrolls, height ≈ h */
/** jagged spark from A to B, returned as segment geometries to merge into one glowing mesh */
/** glowing incandescent bulb (glass globe, bright filament, threaded brass base) pointing up from its local origin */
/** slate / chalkboard tablet in local XY facing +z */

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

// ---- builders
const BUILDERS: Record<string, Builder> = {
  // 孔子行教像 (attrib. 吴道子, Qufu stele): hands joined in 拱手, broad-sleeved 深衣 with dark edging, a sword at the
  // waist, long beard; teaching at the 杏坛 to disciples kneeling (跽坐) on mats, bamboo-slip books on a low 几.
  pp_confucius: gp => {
    const Y = base(gp, SITE.loess);
    // the Apricot Altar (杏坛): a low dressed-stone dais with a step
    rbox(gp, '#a99d86', 0.02, Y, -0.08, 0.34, 0.03, 0.26, 0.006);
    rbox(gp, '#b4a891', 0.02, Y, 0.065, 0.22, 0.015, 0.05, 0.004);
    const D = Y + 0.03;
    // old apricot tree in leaf behind the dais
    canopyTree(gp, -0.25, Y, -0.27, 0.42, '#5f7444');
    const a = person(gp, D, {
      top: '#6a5a44', accent: '#2b2420', bottom: '#3a3128', outfit: 'robe', wideSleeves: true, hair: '#8a8580', hairStyle: 'topknot',
      hat: 'scholar', hatColor: '#1f1b18', beard: 'long', beardColor: '#cfcac2', z: -0.07, x: 0.02, h: 0.6,
      armL: { fwd: 0.62, side: 0.02, bend: 1.25, inward: 0.62 }, armR: { fwd: 0.62, side: 0.02, bend: 1.25, inward: 0.62 },
    });
    // the long sword hanging at the left hip, hilt forward
    const body = a.group.children[0] as THREE.Group, u = a.u;
    const sw = axis(body, [-0.2 * u, 0.6 * u, 0.13 * u], [-0.19 * u, 0.2 * u, -0.27 * u]).q;
    cc(sw, '#2a2420', 0, 0.3 * u, 0, 0.011 * u * 1.3, 0.42 * u, 6);
    cc(sw, '#83723c', 0, 0.075 * u, 0, 0.022 * u, 0.012 * u, 8);
    cc(sw, '#5a4a30', 0, 0.03 * u, 0, 0.012 * u, 0.07 * u, 6);
    // low desk (几) with rolled bamboo-slip books and an inkstone
    const tb = table(gp, 0.27, Y, -0.17, 0.15, 0.08, 0.075, '#3e2a1e', -0.45);
    for (let i = 0; i < 3; i++) scroll(tb, -0.02 + i * 0.002, 0.083 + i * 0.012, -0.012 + (i % 2) * 0.014, 0.09, 0.011, 0, '#b69964', '#58402a');
    cb(tb, '#27272a', 0.05, 0.079, 0.02, 0.03, 0.007, 0.025);
    // two disciples kneeling (跽坐) on rush mats, turned toward the master
    const disc = (x: number, z: number, ry: number, top: string, slip: boolean) => {
      rbox(gp, '#a89466', x, Y, z, 0.11, 0.006, 0.12, 0.003, ry);
      const r = human(gp, x, Y + 0.006, z, {
        h: 0.5, ry, pose: 'kneel', top, bottom: shade(top, 0.85), hair: '#1f1a17', hat: '#1f1a17', hatStyle: 'knot', detail: 'hi', shoes: '#2a221c',
        hipY: 0.18, lean: 0.06, feet: [[-0.06, 0.035, -0.05], [0.06, 0.035, -0.05]], hands: [[-0.07, 0.28, 0.17], [0.07, 0.28, 0.17]],
      });
      if (slip) {
        // an unrolled bamboo-slip book held open in front
        const q = grp(gp, (r.handL[0] + r.handR[0]) / 2, (r.handL[1] + r.handR[1]) / 2 + 0.015, (r.handL[2] + r.handR[2]) / 2, ry, -0.5);
        for (let i = 0; i < 7; i++) cb(q, shade('#bda26f', 0.92 + (i % 2) * 0.08), -0.033 + i * 0.011, 0, 0, 0.01, 0.07, 0.004);
        for (const yy of [-0.02, 0.02]) cb(q, '#58402a', 0, yy, 0.003, 0.08, 0.003, 0.002);
      }
    };
    disc(-0.27, 0.17, 2.3, '#7a6e58', true);
    disc(0.3, 0.17, -2.35, '#5d5a4a', false);
    // a bronze ritual tripod (鼎) by the step
    const dq = grp(gp, -0.08, Y, 0.3);
    lathe(dq, [[0, 0.03], [0.034, 0.03], [0.04, 0.045], [0.038, 0.07], [0.042, 0.074], [0, 0.074]], '#5a5a3e', 0, 0, 0, 12).material = metal('#5d5c3e');
    for (let i = 0; i < 3; i++) { const t = (i / 3) * Math.PI * 2; rod(dq, [Math.cos(t) * 0.026, 0.035, Math.sin(t) * 0.026], [Math.cos(t) * 0.032, 0, Math.sin(t) * 0.032], 0.006, '#4f4f36', 4); }
    for (const sx of [-1, 1]) cb(dq, '#5a5a3e', sx * 0.028, 0.084, 0, 0.007, 0.02, 0.016);
    for (const [px, pz] of [[0.38, -0.05], [-0.38, -0.04], [0.15, 0.36]]) tuft(gp, px, Y, pz, 0.03, '#6c7f45');
    lighten(gp);
  },

  // 《后汉书·张衡传》: 候风地动仪 "以精铜铸成，员径八尺，合盖隆起，形似酒尊…外有八龙，首衔铜丸，下有蟾蜍张口承之";
  // shape after 王振铎's 1951 reconstruction. He wears the Han official 进贤冠 and a dark 袍.
  pp_zhangheng: gp => {
    const Y = base(gp, SITE.paving);
    rbox(gp, '#a99a7c', 0.19, Y, -0.1, 0.4, 0.012, 0.4, 0.004);
    seismoscope(gp, 0.19, Y + 0.012, -0.1, 0.78);
    const a = person(gp, Y, {
      x: -0.2, z: 0.12, ry: 0.35, top: '#33302c', accent: '#7a5a3a', bottom: '#26231f', outfit: 'robe', wideSleeves: true, hair: '#1f1b18', hairStyle: 'topknot',
      hat: 'jinxian', hatColor: '#141414', beard: 'goatee', beardColor: '#1f1b18',
      armR: { fwd: 0.6, side: 0.55, bend: 0.3 }, armL: { fwd: 0.5, bend: 1.05, inward: 0.4 },
    });
    // pointing at the dragon whose ball has dropped
    const d = new THREE.Vector3(...a.handR).sub(new THREE.Vector3(...a.head)).setY(0).normalize();
    rod(gp, a.handR, at(a.handR, d.x * 0.03, 0.004, d.z * 0.03), 0.006, '#cea98d', 5);
    // a rolled record of the tremor in the other hand
    scroll(gp, a.handL[0], a.handL[1], a.handL[2] + 0.01, 0.09, 0.011, 0.45, '#d5c7a4', '#4a3424');
    for (const [px, pz] of [[-0.36, -0.12], [0.36, 0.22], [-0.05, -0.38]]) tuft(gp, px, Y, pz, 0.03, '#6c7f45');
    lighten(gp);
  },

  // 蔡伦, 中常侍/尚方令 (a palace eunuch, so beardless) in the Han 武冠 with the 貂蝉 (gold plaque and sable tail) of his
  // rank; papermaking after 《天工开物·杀青》: pulp vat (纸槽), bamboo mould, pounding 碓, sheets dried on boards.
  pp_cailun: gp => {
    const Y = base(gp, SITE.earth);
    rbox(gp, '#ad9d7a', -0.05, Y, -0.02, 0.62, 0.008, 0.5, 0.004);
    // rectangular wooden vat of milky pulp
    const vt = grp(gp, -0.25, Y, 0.15, 0.35);
    for (const sx of [-1, 1]) cb(vt, '#6e5236', sx * 0.08, 0.045, 0, 0.014, 0.09, 0.13);
    for (const sz of [-1, 1]) cb(vt, '#6e5236', 0, 0.045, sz * 0.058, 0.174, 0.09, 0.014);
    cb(vt, '#e9e3d0', 0, 0.075, 0, 0.15, 0.006, 0.105);
    for (let i = 0; i < 4; i++) bl(vt, '#efe9d7', -0.05 + i * 0.033, 0.079, (hash3(i, 2, 2) - 0.5) * 0.06, 0.016, 0.003, 0.014);
    for (const sz of [-1, 1]) cb(vt, '#5a422b', 0, 0.09, sz * 0.058, 0.18, 0.006, 0.02);
    const a = person(gp, Y, {
      x: 0.02, z: 0.0, top: '#572e27', accent: '#1f1a17', bottom: '#2a201c', outfit: 'robe', wideSleeves: true, hair: '#1a1714', hairStyle: 'topknot',
      beard: 'none', armL: { fwd: 0.75, side: 0.1, bend: 0.75, inward: 0.25 }, armR: { fwd: 0.75, side: 0.1, bend: 0.75, inward: 0.25 },
    });
    // 武冠 with 貂蝉: a black lacquered-gauze cap, a gold plaque with a cicada in front, a sable tail on the left
    const body = a.group.children[0] as THREE.Group, u = a.u, hr = a.headR, ty = 0.93 * u + hr * 0.95;
    bl(body, '#1c1a18', 0, ty + hr * 0.05, -hr * 0.12, hr * 1.06, hr * 0.62, hr * 1.1);
    cb(body, '#1c1a18', 0, ty + hr * 0.55, -hr * 0.2, hr * 1.5, hr * 0.7, hr * 1.4);
    cb(body, '#b89c5b', 0, ty + hr * 0.25, hr * 0.86, hr * 0.55, hr * 0.6, hr * 0.08);
    bl(body, '#574929', 0, ty + hr * 0.26, hr * 0.92, hr * 0.12, hr * 0.2, hr * 0.06);
    tube(body, [[-hr * 0.9, ty + hr * 0.3, -hr * 0.2], [-hr * 1.15, ty + hr * 1.1, -hr * 0.5], [-hr * 1.1, ty + hr * 1.7, -hr * 1.2], [-hr * 0.95, ty + hr * 1.8, -hr * 1.8]], hr * 0.3, hr * 0.12, '#4a3626', { radial: 6, sub: 3 });
    // bamboo papermaking mould (帘床) lifted out of the vat with a fresh wet sheet
    const mx = (a.handL[0] + a.handR[0]) / 2, my = (a.handL[1] + a.handR[1]) / 2;
    const md = grp(gp, mx, my + 0.01, a.handL[2] + 0.04, 0, -0.75);
    const wM = a.handR[0] - a.handL[0] + 0.05;
    for (const sz of [-1, 1]) cb(md, '#7a5c3a', 0, 0, sz * 0.06, wM, 0.01, 0.012);
    for (const sx of [-1, 1]) cb(md, '#7a5c3a', sx * wM / 2, 0, 0, 0.012, 0.01, 0.13);
    cb(md, '#b9a06e', 0, -0.002, 0, wM - 0.01, 0.003, 0.11);
    cb(md, '#efeadb', 0, 0.002, 0, wM - 0.03, 0.003, 0.095);
    // sheets drying on two wooden boards propped on a trestle
    const dr = grp(gp, 0.17, Y, -0.25, -0.35);
    for (const sx of [-1, 1]) { rod(dr, [sx * 0.15, 0, 0.02], [sx * 0.15, 0.2, -0.03], 0.008, '#5a422b', 5); }
    rod(dr, [-0.16, 0.19, -0.025], [0.16, 0.19, -0.025], 0.007, '#5a422b', 5);
    for (const sx of [-1, 1]) {
      const bd = grp(dr, sx * 0.075, 0.005, 0.03, 0, -0.22);
      cb(bd, '#8a6a46', 0, 0.095, 0, 0.14, 0.19, 0.01);
      for (let i = 0; i < 2; i++) cb(bd, i ? '#efe9d7' : '#eae3d1', 0, 0.05 + i * 0.09, 0.006, 0.11, 0.075, 0.003, 0, 0, (hash3(i, sx, 3) - 0.5) * 0.05);
    }
    // stack of finished paper tied with hemp cord
    for (let i = 0; i < 8; i++) cb(gp, i % 2 ? '#f1ecdc' : '#e5dec9', 0.27, Y + 0.004 + i * 0.006, 0.17, 0.11, 0.005, 0.08, (hash3(i, 7, 1) - 0.5) * 0.12);
    cb(gp, '#9a8458', 0.27, Y + 0.004, 0.17, 0.01, 0.052, 0.082);
    // raw materials: tree bark, hemp ends, rags and an old fishing net
    for (let i = 0; i < 3; i++) cc(gp, '#5e4430', -0.34 + i * 0.026, Y + 0.012, -0.1 + i * 0.012, 0.012, 0.12, 6, 0.3, Math.PI / 2);
    cc(gp, '#b9a473', 0.36, Y + 0.02, -0.04, 0.022, 0.12, 8, 1.1, Math.PI / 2);
    cc(gp, '#664a2f', 0.36, Y + 0.02, -0.04, 0.024, 0.012, 8, 1.1, Math.PI / 2);
    const net = grp(gp, -0.37, Y + 0.012, 0.04);
    bl(net, '#7d7a68', 0, 0, 0, 0.045, 0.016, 0.04);
    for (let i = 0; i < 4; i++) { cb(net, '#4b4b40', -0.027 + i * 0.018, 0.013, 0, 0.004, 0.004, 0.07, 0, 0.1); cb(net, '#4b4b40', 0, 0.013, -0.027 + i * 0.018, 0.08, 0.004, 0.004); }
    for (let i = 0; i < 3; i++) bl(gp, ['#8a7d66', '#6f6a5c', '#9b8f78'][i], -0.33 + i * 0.03, Y + 0.012, 0.0 - i * 0.01, 0.022, 0.009, 0.018, i);
    // stone mortar with a wooden pestle for pounding the soaked fibres
    lathe(gp, [[0, 0], [0.045, 0], [0.05, 0.05], [0.036, 0.05], [0.03, 0.02], [0, 0.02]], '#7d8078', -0.2, Y, -0.24, 12);
    cc(gp, '#a49e88', -0.2, Y + 0.035, -0.24, 0.032, 0.006, 10);
    rod(gp, [-0.2, Y + 0.03, -0.24], [-0.23, Y + 0.18, -0.21], 0.012, '#8a6a46', 6);
    lighten(gp);
  },

  // 祖冲之 (429–500, Liu Song/Southern Qi): π between 3.1415926 and 3.1415927 by 割圆术 (cutting the circle into
  // polygons, after 刘徽); numbers set out with 算筹 rods (纵横 alternating), Southern-dynasties 褒衣博带 and a small cap.
  pp_zuchongzhi: gp => {
    const Y = base(gp, SITE.court);
    // a sheet of paper on the ground with the circle-cutting figure in ink: a circle, inscribed hexagon and 12-gon
    const cx = 0.16, cz = 0.18;
    const sh = grp(gp, cx, Y + 0.003, cz, 0.15);
    cb(sh, '#e6dec9', 0, 0, 0, 0.27, 0.004, 0.27);
    const cd = grp(sh, 0, 0.0035, 0, 0, -Math.PI / 2);
    const ink = mat('#2a2622');
    ring(cd, '', 0, 0, 0, 0.1, 0.05, 0, 0, 0, ink);
    for (const N of [6, 12]) for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      seg(cd, ink, Math.cos(a0) * 0.1, Math.sin(a0) * 0.1, Math.cos(a1) * 0.1, Math.sin(a1) * 0.1, 0.004, 0.002, 0.001);
      if (N === 6) seg(cd, ink, 0, 0, Math.cos(a0) * 0.1, Math.sin(a0) * 0.1, 0.003, 0.002, 0.001);
    }
    bl(cd, '#2a2622', 0, 0, 0.002, 0.006, 0.006, 0.002);
    // inkstone and a brush at the sheet's edge
    cb(gp, '#2e2e30', cx + 0.1, Y + 0.008, cz - 0.13, 0.04, 0.01, 0.028, 0.15);
    rod(gp, [cx + 0.06, Y + 0.012, cz - 0.15], [cx + 0.13, Y + 0.012, cz - 0.17], 0.005, '#664a2f', 5);
    // low desk (案) with the counting-rod numerals of 3.1415926: units upright (纵), tens lying (横), alternating
    const tb = table(gp, 0.22, Y, -0.17, 0.26, 0.12, 0.1, '#493123', -0.45);
    const rodC = '#ddd3b4';
    [3, 1, 4, 1, 5, 9, 2, 6].forEach((dgt, k) => {
      const x0 = -0.105 + k * 0.03, up = k % 2 === 0, n = dgt % 5;
      for (let i = 0; i < n; i++)
        if (up) cb(tb, rodC, x0 - 0.008 + i * 0.006, 0.104, 0.012, 0.004, 0.004, 0.032);
        else cb(tb, rodC, x0, 0.104, 0.0 + i * 0.007, 0.024, 0.004, 0.004);
      if (dgt >= 5) { if (up) cb(tb, rodC, x0, 0.108, -0.01, 0.026, 0.004, 0.004); else cb(tb, rodC, x0 - 0.013, 0.108, 0.01, 0.004, 0.004, 0.026); }
    });
    for (let i = 0; i < 6; i++) cc(tb, rodC, -0.09 + i * 0.006, 0.106, -0.04, 0.0025, 0.06, 4, 0.05, Math.PI / 2);
    scroll(tb, 0.08, 0.111, -0.035, 0.07, 0.01, 0.3, '#d5c7a4', '#4a3424');
    const a = person(gp, Y, {
      x: -0.1, z: 0.02, ry: 0.4, top: '#6e6a58', accent: '#2e2a24', bottom: '#4a473b', outfit: 'robe', wideSleeves: true, hair: '#2e2a26', hairStyle: 'topknot',
      hat: 'scholar', hatColor: '#1c1917', beard: 'long', beardColor: '#3a3430',
      armR: { fwd: 0.8, side: 0.45, bend: 0.15 }, armL: { fwd: 0.55, bend: 1.05, inward: 0.4 },
    });
    // a bundle of counting rods in the left hand, the right gesturing at the figure on the sheet
    const hb = held(gp, a.handL, 0.35, 0.3, 0.5);
    for (let i = 0; i < 7; i++) cc(hb, rodC, Math.cos(i * 2.4) * 0.008, 0, Math.sin(i * 2.4) * 0.008, 0.003, 0.11, 4);
    cc(hb, '#58402a', 0, 0, 0, 0.013, 0.012, 8);
    rod(gp, a.handR, at(a.handR, 0.022, -0.02, 0.022), 0.006, '#cea98d', 5);
    for (const [px, pz] of [[-0.36, 0.16], [0.4, 0.02], [-0.3, -0.25]]) tuft(gp, px, Y, pz, 0.03, '#6c7f45');
    lighten(gp);
  },

  // 李时珍 (1518–1593) after 蒋兆和's portrait: Ming 四方平定巾 and a 道袍 with white collar, gathering herbs in the
  // mountains with a back basket and a hoe; a thread-bound volume of the 《本草纲目》.
  pp_lishizhen: gp => {
    const Y = base(gp, SITE.grass);
    // mountain rocks, a pine and a couple of lingzhi brackets
    rock(gp, '#7f837a', -0.25, Y + 0.05, -0.22, 0.13, 0.85);
    rock(gp, '#8e9289', -0.09, Y + 0.03, -0.3, 0.09, 0.7);
    rock(gp, '#767a71', 0.3, Y + 0.02, -0.2, 0.08, 0.6);
    const px = -0.3, pz = -0.27, py = Y + 0.13;
    tree(gp, px, py - 0.02, pz, 0.18, '#4a6a48', true);
    for (const [lx, lz, r] of [[-0.14, -0.2, 0.026], [-0.115, -0.175, 0.019]]) { bl(gp, '#523124', lx, Y + 0.045, lz, r, 0.007, r * 0.8); bl(gp, '#825b3a', lx, Y + 0.049, lz, r * 0.55, 0.004, r * 0.45); cc(gp, '#442c1e', lx, Y + 0.022, lz, 0.005, 0.045, 5); }
    // medicinal herbs: 菊 (chrysanthemum), 桔梗 (balloon flower), 金银花 (honeysuckle) in muted field colours
    const herb = (x: number, z: number, s: number, fl: string) => {
      for (let i = 0; i < 4; i++) { const t = i * 1.7 + x * 5; rod(gp, [x, Y, z], [x + Math.cos(t) * s * 0.3, Y + s * (0.7 + (i % 2) * 0.3), z + Math.sin(t) * s * 0.3], s * 0.05, '#4f6b3a', 4); bl(gp, '#5d7a44', x + Math.cos(t) * s * 0.25, Y + s * 0.5, z + Math.sin(t) * s * 0.25, s * 0.14, s * 0.05, s * 0.08, t); bl(gp, fl, x + Math.cos(t) * s * 0.3, Y + s * (0.72 + (i % 2) * 0.3), z + Math.sin(t) * s * 0.3, s * 0.06); }
    };
    herb(0.26, 0.12, 0.12, '#b8a15b');
    herb(-0.3, 0.06, 0.11, '#7d71a0');
    herb(0.14, 0.28, 0.09, '#e6e0cc');
    herb(0.34, -0.04, 0.1, '#b8a15b');
    // the Compendium lying open on a flat stone
    rock(gp, '#8e9289', -0.22, Y + 0.01, 0.22, 0.09, 0.35);
    openBook(gp, -0.22, Y + 0.036, 0.22, 0.05, 0.075, '#4a5670', -0.5, -Math.PI / 2 + 0.25, '#3a3632');
    // herb hoe (药锄) leaning on the rock
    rod(gp, [0.2, Y + 0.0, -0.1], [0.27, Y + 0.24, -0.17], 0.007, '#664a2f', 5);
    cb(gp, '#5a5e60', 0.275, Y + 0.24, -0.172, 0.04, 0.012, 0.03, -0.8, 0, 0.6);
    const a = person(gp, Y, {
      x: -0.03, z: 0.04, ry: 0.2, top: '#56606a', accent: '#e4e0d4', bottom: '#3e464e', outfit: 'robe', wideSleeves: true, hair: '#8a8a8a', hairStyle: 'topknot',
      hat: 'fangjin', hatColor: '#1c1917', beard: 'long', beardColor: '#bdbab2', armR: { fwd: 0.85, side: 0.15, bend: 1.0, inward: 0.15 }, armL: { fwd: 0.3, side: 0.08, bend: 0.5 },
    });
    // bamboo herb basket on his back (between waist and shoulders) with leafy herbs poking out, straps over the shoulders
    const u = a.u;
    const bk = grp(a.group, 0, 0.44 * u, -0.13 * u - 0.05, 0, -0.12);
    lathe(bk, [[0, 0], [0.045, 0], [0.06, 0.17], [0.054, 0.17], [0.04, 0.012], [0, 0.012]], '#a88a58', 0, 0, 0, 12);
    for (const yy of [0.04, 0.09, 0.14]) ring(bk, '', 0, yy, 0, 0.049 + yy * 0.08, 0.06, 0, Math.PI / 2, 0, mat('#7b623a'));
    for (let i = 0; i < 6; i++) { const t = i * 1.05; rod(bk, [Math.cos(t) * 0.02, 0.12, Math.sin(t) * 0.02], [Math.cos(t) * 0.045, 0.22 + (i % 3) * 0.02, Math.sin(t) * 0.035 - 0.01], 0.004, '#4f6b3a', 4); bl(bk, i % 2 ? '#5d7a44' : '#4f6b3a', Math.cos(t) * 0.045, 0.22 + (i % 3) * 0.02, Math.sin(t) * 0.035 - 0.01, 0.02, 0.012, 0.014, t); }
    for (const sx of [-1, 1]) tube(a.group, [[sx * 0.075 * u, 0.7 * u, -0.1 * u], [sx * 0.085 * u, 0.835 * u, -0.02 * u], [sx * 0.08 * u, 0.8 * u, 0.1 * u], [sx * 0.07 * u, 0.62 * u, 0.1 * u]], 0.006, 0.006, '#4e3a2a', { radial: 5, sub: 3 });
    // freshly picked sprig held up for a closer look
    const sp = held(gp, a.handR, 0, 0, -0.2);
    rod(sp, [0, 0, 0], [0, 0.09, 0], 0.004, '#4f6b3a', 4);
    for (let i = 0; i < 4; i++) bl(sp, '#5d7a44', (i % 2 ? 1 : -1) * 0.012, 0.03 + i * 0.015, 0, 0.012, 0.005, 0.006, 0, 0, (i % 2 ? -1 : 1) * 0.6);
    for (let i = 0; i < 3; i++) bl(sp, '#7d71a0', Math.cos(i * 2.1) * 0.006, 0.095, Math.sin(i * 2.1) * 0.006, 0.008);
    book(gp, '#4a5670', a.handL[0] - 0.005, a.handL[1] + 0.03, a.handL[2] + 0.015, 0.06, 0.085, 0.022, 0.2 + Math.PI / 2);
    lighten(gp);
  },
};

export const H_PEOPLE_A: Record<string, Builder> = Object.fromEntries(
  Object.entries(BUILDERS).map(([k, f]) => [k, ((gp, r) => { f(gp, r); settle(gp); }) as Builder]),
);

