import { human, type HumanOpts, type HumanRig } from '../human.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, gable, slab, lathe, rod, sweep,
  shade, mix, hash3, fbm, SPH, paintFaces,
} from '../prims.ts';
import { island, ripple, sstep } from '../nature.ts';
import { pblob, horse } from '../animals.ts';

// Festival dioramas: each is a tiny, instantly readable celebration scene on a round base (radius ≈0.5) —
// the festival's signature props first (lanterns, boats, masks, powder clouds, lamps), then crowd figures for
// scale. Glowing parts (lanterns, flames, ice) use emissive materials and are fused into one draw per material.
// Front faces +z, base at y=0.

const TAU = Math.PI * 2;

// ---- shared helpers -------------------------------------------------------------------------------------

/** Child group at (x,y,z) turned by ry, uniformly scaled by s. */
function grp(p: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1): THREE.Group {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = ry;
  f.scale.setScalar(s);
  p.add(f);
  return f;
}

/** Low-poly sphere (beads, studs, tomatoes, petals) — far cheaper than prims.ellip for tiny parts. */
const dot = (p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, seg = 8) =>
  add(p, SPH(seg), mat(c), x, y, z, r * 2, r * 2, r * 2);
const dotE = (p: THREE.Object3D, c: string, e: string, x: number, y: number, z: number, r: number, seg = 8) =>
  add(p, SPH(seg), mat(c, { emissive: e }), x, y, z, r * 2, r * 2, r * 2);
/** Smooth ellipsoid on a lighter cached sphere than prims.ellip (festival crowds use hundreds). */
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, Math.max(rx, ry, rz) < 0.012 ? g('fs-el8', () => new THREE.SphereGeometry(1, 8, 6)) : g('fs-el', () => new THREE.SphereGeometry(1, 12, 8)),
    mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
const ellipL = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, g('fs-el8', () => new THREE.SphereGeometry(1, 8, 6)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
/** prims.tube twin whose ball end caps use the lighter local ellipsoid. */
function tube(p: THREE.Object3D, pts: V3[], r0: number, r1: number, c: string, o: Parameters<typeof sweep>[3] = {}): THREE.Mesh {
  const m = sweep(p, pts.map((pt, i) => ({ p: pt, w: r0 + (r1 - r0) * (i / Math.max(1, pts.length - 1)) })), c, { radial: 8, sub: 4, ...o });
  ellip(p, c, ...pts[0], r0 * 0.98);
  ellip(p, c, ...pts[pts.length - 1], r1 * 0.98);
  return m;
}
/** Emissive version of any mesh. */
const glow = (m: THREE.Mesh, c: string, e: string) => { m.material = mat(c, { emissive: e }); return m; };

/**
 * Emissive / transparent meshes are not baked by kit.ts, so each would stay its own draw call. Merge every such
 * mesh under `root` (outside 'spin' groups) into one mesh per material; 'spin' groups are fused on their own.
 */
function fuse(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const kill: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    for (const ch of o.children) {
      if (ch.name === 'spin') { fuseAll(ch); continue; }
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        const mt = m.material as THREE.MeshStandardMaterial;
        if (mt.transparent || (mt.emissive && mt.emissive.getHex() !== 0)) {
          (buckets.get(mt) ?? buckets.set(mt, []).get(mt)!).push(flatGeo(m, inv, false));
          kill.push(m);
        }
      }
      walk(ch);
    }
  };
  walk(root);
  for (const m of kill) m.parent?.remove(m);
  for (const [mt, list] of buckets) {
    const merged = mergeGeometries(list, false);
    if (merged) { const mesh = add(root, merged, mt, 0, 0, 0, 1, 1, 1); mesh.castShadow = false; }
  }
}
/** Mesh geometry → non-indexed position/normal(/color) copy in the frame of `inv`. */
function flatGeo(m: THREE.Mesh, inv: THREE.Matrix4, keepColor: boolean): THREE.BufferGeometry {
  let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && !(keepColor && k === 'color')) geo.deleteAttribute(k);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  geo = geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
  if (m.matrixWorld.determinant() < 0) {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (const a of [p, geo.getAttribute('normal') as THREE.BufferAttribute]) for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) {
      const t = a.array[(i + 1) * 3 + k]; a.array[(i + 1) * 3 + k] = a.array[(i + 2) * 3 + k]; a.array[(i + 2) * 3 + k] = t;
    }
  }
  return geo;
}
/** Fuse every mesh of an animated group (all of them stay live) into one mesh per material. */
function fuseAll(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const kill: THREE.Mesh[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mt = m.material as THREE.Material;
    (buckets.get(mt) ?? buckets.set(mt, []).get(mt)!).push(flatGeo(m, inv, true));
    kill.push(m);
  });
  for (const m of kill) m.parent?.remove(m);
  for (const [mt, list] of buckets) {
    const hasCol = list.some(x => x.getAttribute('color'));
    const merged = mergeGeometries(hasCol ? list.filter(x => x.getAttribute('color')) : list, false);
    if (merged) add(root, merged, mt, 0, 0, 0, 1, 1, 1);
  }
}

/**
 * Round plaza: square-grid top (cells of R*2/n, so paving/tiles paint cleanly per cell) clipped to a circle,
 * with a vertical skirt. Paint is evaluated per triangle centroid.
 */
function plaza(gp: THREE.Object3D, R: number, h: number, n: number, paint: Paint, side = '#6b4f3a'): void {
  const cs = (R * 2) / n, pos: number[] = [];
  const clamp = (x: number, z: number): [number, number] => { const d = Math.hypot(x, z); return d > R ? [(x / d) * R, (z / d) * R] : [x, z]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -R + i * cs, z0 = -R + j * cs;
    if (Math.hypot(x0 + cs / 2, z0 + cs / 2) > R + cs * 0.5) continue;
    const a = clamp(x0, z0), b = clamp(x0 + cs, z0), c = clamp(x0 + cs, z0 + cs), d = clamp(x0, z0 + cs);
    pos.push(a[0], h, a[1], d[0], h, d[1], c[0], h, c[1], a[0], h, a[1], c[0], h, c[1], b[0], h, b[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  add(gp, paintFaces(geo, '#ffffff', paint), mat('#ffffff', { vc: true, flat: true }), 0, 0, 0, 1, 1, 1);
  const sk = new THREE.CylinderGeometry(R, R * 0.985, h, 64, 1, true);
  sk.translate(0, h / 2, 0);
  add(gp, paintFaces(sk, side, (_x, y) => (y > h * 0.55 ? side : shade(side, 0.8))), mat('#ffffff', { vc: true, flat: true }), 0, 0, 0, 1, 1, 1);
}

/** Round base with a painted top (rings × segs polar grid) and an earth skirt. */
function base(gp: THREE.Object3D, R: number, top: string, paint: Paint, side = '#6b4f3a', h = 0.035, hf: (x: number, z: number) => number = () => 0, rings = 14, segs = 64): void {
  island(gp, R, hf, top, paint, { rings, segs, base: h, side: (y) => (y > h * 0.55 ? side : shade(side, 0.8)) });
}

/** Mortar-less stones for plaza(): s should be a multiple of the plaza cell so each stone is whole cells. */
const stones = (c: string, s: number, k = 0.2): Paint => (x, _y, z) => {
  const v = Math.floor(z / s + 1e-4), u = Math.floor(x / s + (v % 2) * 0.5 + 1e-4);
  return shade(c, 1 - k / 2 + hash3(u, 7, v) * k);
};
const grass = (c: string, k = 30): Paint => (x, _y, z) => shade(c, 0.88 + fbm(x * k, 0, z * k, 2) * 0.28);

interface Fig {
  shirt: string; pants?: string; skin?: string; hair?: string; shoes?: string;
  /** hand targets (local, figure ≈0.12 tall): [left, right] */
  hands?: [V3, V3];
  dress?: boolean; hat?: (f: THREE.Group) => void; sit?: boolean;
}
const SKINS = ['#f1c7a3', '#d9a27a', '#b9805a', '#8d5a3b', '#f5d0b5'];
const HAIRS = ['#2b1d14', '#3b2a1f', '#1c1917', '#6b4226', '#a16207'];
const DOWN: [V3, V3] = [[-0.03, 0.04, 0.006], [0.03, 0.04, 0.006]];
const UP: [V3, V3] = [[-0.034, 0.135, 0.004], [0.034, 0.135, 0.004]];
const FWD: [V3, V3] = [[-0.016, 0.07, 0.04], [0.016, 0.07, 0.04]];
const THROW: [V3, V3] = [[-0.02, 0.07, 0.035], [0.036, 0.13, -0.012]];

/** Chibi festival-goer (≈0.12 tall at s=1): legs, rounded torso, big head with hair, arms reaching to hand targets. */
function kid(p: THREE.Object3D, x: number, y: number, z: number, ry: number, o: Fig, s = 1): THREE.Group {
  const f = grp(p, x, y, z, ry, s);
  const sk = o.skin ?? SKINS[Math.floor(hash3(x * 31, z * 17, 3) * 4)], hr = o.hair ?? HAIRS[Math.floor(hash3(x * 13, z * 7, 5) * 5)];
  // seated kids keep their gestures, lowered with the torso
  const H = 0.12, dy = o.sit ? -0.425 : 0, hands = (o.hands ?? DOWN).map(([hx, hy, hz]) => [hx / H, hy / H + dy, hz / H]) as [V3, V3];
  const rig = human(f, 0, 0, 0, {
    h: H, detail: s >= 0.9 ? 'hi' : 'lo', top: o.shirt, bottom: o.pants ?? '#334155', shoes: o.shoes ?? '#1f2937', skin: sk, hair: hr,
    pose: o.sit ? 'sitGround' : 'stand', hands: o.sit && !o.hands ? undefined : hands, dress: o.dress ? 'knee' : undefined, sleeve: 0.4, build: 1.05,
  });
  if (o.hat) {
    // hats were authored for a head centred at (0, 0.1, 0) of radius ≈0.02: map that frame onto the rig's head
    const k = 0.4, hf = new THREE.Group();
    hf.position.set(rig.head[0], rig.head[1] - 0.1 * k, rig.head[2]);
    hf.scale.setScalar(k);
    f.add(hf);
    o.hat(hf);
  }
  return f;
}

/** Double-sided open surface through rings of points, per-face painted & flat shaded (roofs, cloths, banners). */
function sheet(p: THREE.Object3D, rings: V3[][], c: string, paint?: Paint): void {
  const n = rings[0].length, pos: number[] = [], idx: number[] = [];
  for (const r of rings) for (const v of r) pos.push(...v);
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + 1, c2 = a + n, d = c2 + 1;
    idx.push(a, b, c2, b, d, c2, a, c2, b, b, c2, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const ng = geo.toNonIndexed();
  ng.computeVertexNormals();
  const cols: number[] = [], P = ng.getAttribute('position'), col = new THREE.Color();
  for (let t = 0; t < P.count; t += 3) {
    const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, cy = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, cz = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3;
    col.set((paint && paint(cx, cy, cz, 0, 1, 0)) ?? c);
    for (let k = 0; k < 3; k++) cols.push(col.r, col.g, col.b);
  }
  ng.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  add(p, ng, mat('#ffffff', { vc: true, flat: true }), 0, 0, 0, 1, 1, 1);
}

/** Chinese roof with upturned eave corners: tiled surface, ridge, curled ridge-end ornaments. */
function cnRoof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, c: string, ry = 0): void {
  const f = grp(p, x, y, z, ry);
  const nx = 16, nz = 8, rings: V3[][] = [];
  for (let i = 0; i <= nx; i++) {
    const u = (i / nx) * 2 - 1, X = (u * w) / 2, lift = Math.pow(Math.abs(u), 5) * h * 0.6;
    const ring: V3[] = [];
    for (let j = 0; j <= nz; j++) {
      const v = (j / nz) * 2 - 1, k = 1 - Math.abs(v);
      ring.push([X, h * (k * k * 0.45 + k * 0.55) + lift * v * v, (v * d) / 2]);
    }
    rings.push(ring);
  }
  sheet(f, rings, c, (x2) => (Math.sin(x2 * 300) > 0.5 ? shade(c, 0.75) : shade(c, 1.08)));
  rod(f, [(-w / 2) * 0.8, h + 0.004, 0], [(w / 2) * 0.8, h + 0.004, 0], 0.01, shade(c, 0.85), 8);
  for (const sx of [-1, 1]) tube(f, [[sx * w * 0.4, h, 0], [sx * w * 0.44, h + 0.025, 0], [sx * w * 0.41, h + 0.04, 0]], 0.009, 0.004, shade(c, 0.85));
}

/** Round Chinese paper lantern (glowing red) with gold caps and tassel, hanging from (x,y,z) = top. */
function redLantern(p: THREE.Object3D, x: number, y: number, z: number, r: number, c = '#ef2b2b', e = '#c81e1e'): void {
  cyl(p, '#d4a017', x, y - r * 0.32, z, r * 0.45, r * 0.3, 8);
  glow(ellip(p, c, x, y - r * 1.15, z, r, r * 0.85, r), c, e);
  cyl(p, '#d4a017', x, y - r * 2.15, z, r * 0.45, r * 0.3, 8);
  cone(p, '#facc15', x, y - r * 3.3, z, r * 0.28, r * 1.1, 6).rotation.x = Math.PI;
}

// ---------------------------------------------------------------------------------------------------------
// SPRING FESTIVAL 春节 — late-Qing Guangzhou, 西关: the grey-brick front of a 西关大屋 with wok-ear gables (镬耳墙),
// the granite door frame and three-layer entrance (脚门 half-doors, 趟栊 sliding bar-gate, tall 大门 with printed
// door gods 门神), red-paper couplets (春联), 横批 and 挥春, a pair of silk lanterns and a string of firecrackers
// going off from a bamboo pole; in front a stall of the 迎春花市 (the New-Year flower fair held in Guangzhou since
// the 19th c.) with peach-blossom branches, potted kumquats and narcissus bowls. Men in 长衫 under a 马褂, with
// skullcap (瓜皮帽) and queue; a woman in an 袄 jacket and skirt; host and visitor exchange the New-Year 拱手 at the door.
// Refs: 西关大屋 (Baidu Baike: 趟栊门 / 脚门 / 镬耳屋), 广州迎春花市 (Baike), late-Qing export paintings of Canton streets.
// ---------------------------------------------------------------------------------------------------------
/** Qing man's skullcap (瓜皮帽) with its knot button, and the queue down his back. */
function guapi(p: THREE.Object3D, r: HumanRig, ry: number, h: number): void {
  const [x, y, z] = r.head, bx = -Math.sin(ry), bz = -Math.cos(ry);
  ellip(p, '#1c1a18', x + bx * 0.004 * h, y + 0.028 * h, z + bz * 0.004 * h, 0.061 * h, 0.05 * h, 0.065 * h, ry);
  dot(p, '#6e2a22', x, y + 0.078 * h, z, 0.011 * h, 5);
  tube(p, [[x + bx * 0.058 * h, y - 0.01 * h, z + bz * 0.058 * h], [x + bx * 0.074 * h, y - 0.16 * h, z + bz * 0.074 * h], [x + bx * 0.07 * h, y - 0.4 * h, z + bz * 0.07 * h]], 0.013 * h, 0.006 * h, '#1a1612', { radial: 4, sub: 3 });
}
/** Woman's low bun at the nape. */
function nape(p: THREE.Object3D, r: HumanRig, ry: number, h: number): void {
  const [x, y, z] = r.head, bx = -Math.sin(ry), bz = -Math.cos(ry);
  ellip(p, '#1a1512', x + bx * 0.06 * h, y - 0.005 * h, z + bz * 0.06 * h, 0.04 * h, 0.032 * h, 0.03 * h, ry);
  dot(p, '#9a8a5a', x + bx * 0.07 * h, y + 0.01 * h, z + bz * 0.07 * h, 0.006 * h, 4);
}
/** Muted red silk lantern hanging below (x,y,z). */
function hongLantern(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  rod(p, [x, y, z], [x, y - r * 0.6, z], r * 0.06, '#2a201a', 3);
  cyl(p, '#2a201a', x, y - r * 0.85, z, r * 0.5, r * 0.25, 8);
  glow(ellip(p, '#9a3e2c', x, y - r * 1.65, z, r, r * 0.85, r), '#9a3e2c', '#5a1c10');
  cyl(p, '#2a201a', x, y - r * 2.65, z, r * 0.5, r * 0.25, 8);
  cone(p, '#7a2a20', x, y - r * 3.7, z, r * 0.25, r * 1.0, 5).rotation.x = Math.PI;
}
/** A cut peach-blossom branch from a to b: dark twigs studded with pink flowers and buds. */
function peachBranch(p: THREE.Object3D, a: V3, b: V3, seed: number): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  rod(p, a, b, 0.0022, '#3e2c22', 4);
  for (let k = 0; k < 5; k++) {
    const o = at(0.35 + k * 0.14), an = seed * 1.7 + k * 2.3, tl = L * (0.28 - k * 0.035);
    const e: V3 = [o[0] + Math.cos(an) * tl, o[1] + tl * 0.5, o[2] + Math.sin(an) * tl];
    rod(p, o, e, 0.001, '#3e2c22', 3);
    for (let j = 0; j < 4; j++) {
      const u = 0.3 + j * 0.22;
      dot(p, (j + k + seed) % 3 ? '#d8a8aa' : '#c48890', o[0] + (e[0] - o[0]) * u + (hash3(k, j, seed) - 0.5) * 0.006, o[1] + (e[1] - o[1]) * u + 0.002, o[2] + (e[2] - o[2]) * u + (hash3(j, k, seed) - 0.5) * 0.006, 0.0038, 5);
    }
  }
  for (let j = 0; j < 5; j++) { const q = at(0.3 + j * 0.15); dot(p, '#d8a8aa', q[0] + 0.003, q[1], q[2], 0.0036, 5); }
}
const HALFDISC = () => g('fs-halfdisc', () => { const c = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); return c; });
const fs_springfestival: Builder = (gp) => {
  const Y = 0.035, pv = stones('#8c887f', 1 / 24, 0.2), TIP: V3 = [0.21, Y + 0.24, 0.13];
  // granite-flag street (麻石街) strewn with red paper from the firecrackers
  plaza(gp, 0.5, Y, 48, (x, y, z, nx, ny, nz) => {
    const d = Math.hypot(x - TIP[0], z - TIP[2]);
    return d < 0.05 && hash3(Math.floor(x * 48), 2, Math.floor(z * 48)) > 0.5 + d * 8 ? shade('#7a3a2e', 1.1) : pv(x, y, z, nx, ny, nz);
  }, '#5e5448');
  const G = grp(gp, 0, Y, -0.21);
  const WALL = '#67645f', GR = '#9e9a90', FD = 0.13, OW = 0.15, OH = 0.2, WH = 0.27, SW = 0.3 - OW / 2, SX = OW / 2 + SW / 2;
  // grey-brick front on a granite plinth, the entrance recessed (凹斗门)
  for (const sx of [-1, 1]) {
    box(G, WALL, sx * SX, 0, -FD / 2, SW, WH, FD);
    for (let k = 1; k < 14; k++) box(G, '#77746e', sx * SX, 0.028 + k * 0.0165, 0.0005, SW, 0.0012, 0.001);
  }
  box(G, WALL, 0, OH, -FD / 2, OW, WH - OH, FD);
  box(G, '#55524d', 0, 0, -0.0825, OW, OH, FD - 0.035);
  box(G, GR, 0, 0, -FD / 2, 0.604, 0.028, FD + 0.004);
  // granite door frame and the tall 大门 with printed door gods
  const ZB = -0.035;
  for (const sx of [-1, 1]) box(G, GR, sx * 0.05, 0.028, ZB, 0.014, 0.16, 0.006);
  box(G, GR, 0, 0.188, ZB, 0.114, 0.014, 0.006);
  for (const sx of [-1, 1]) {
    box(G, '#3a2a1e', sx * 0.022, 0.028, ZB, 0.042, 0.16, 0.004);
    box(G, '#b49868', sx * 0.022, 0.085, ZB + 0.0025, 0.026, 0.075, 0.001);
    box(G, '#7a3426', sx * 0.022, 0.09, ZB + 0.003, 0.02, 0.046, 0.001);
    box(G, '#4a5a5a', sx * 0.022, 0.1, ZB + 0.0034, 0.012, 0.02, 0.001);
    box(G, '#c8a07a', sx * 0.022, 0.141, ZB + 0.003, 0.008, 0.009, 0.001);
    box(G, '#2a2420', sx * 0.022, 0.15, ZB + 0.003, 0.012, 0.006, 0.001);
    dot(G, '#8a7a5a', sx * 0.005, 0.1, ZB + 0.004, 0.0025, 5);
  }
  // 趟栊: the sliding gate of round horizontal bars, drawn half open
  const ZT = -0.02;
  box(G, '#3e2c1e', -0.068, 0.028, ZT, 0.008, 0.17, 0.008);
  box(G, '#3e2c1e', -0.004, 0.028, ZT, 0.008, 0.17, 0.008);
  box(G, '#3e2c1e', 0, 0.192, ZT, 0.144, 0.007, 0.008);
  for (let k = 0; k < 13; k++) rod(G, [-0.066, 0.036 + k * 0.012, ZT], [-0.002, 0.036 + k * 0.012, ZT], 0.0022, '#4a3424', 5);
  // 脚门: half-height outer doors with fretwork tops and 福 on red paper, the right leaf swung open
  for (const sx of [-1, 1]) {
    const L = grp(G, sx * 0.07, 0.03, -0.004, sx > 0 ? 1.1 : 0);
    box(L, '#3a2a1e', -sx * 0.035, 0, 0, 0.068, 0.1, 0.006);
    box(L, '#5a4430', -sx * 0.035, 0.066, 0.0035, 0.056, 0.026, 0.001);
    for (let k = 0; k < 4; k++) box(L, '#2a1e16', -sx * (0.014 + k * 0.014), 0.064, 0.004, 0.002, 0.03, 0.001);
    box(L, '#953428', -sx * 0.035, 0.026, 0.004, 0.02, 0.02, 0.001, 0, 0, Math.PI / 4);
    box(L, '#2a1a14', -sx * 0.035, 0.032, 0.005, 0.007, 0.01, 0.001);
  }
  // couplets flanking the door, the 横批 over it and 挥春 diamonds on the wall
  for (const sx of [-1, 1]) {
    box(G, '#953428', sx * 0.093, 0.035, 0.0008, 0.02, 0.15, 0.001);
    for (let k = 0; k < 7; k++) box(G, '#2a1a14', sx * 0.093, 0.046 + k * 0.02, 0.0016, 0.009, 0.011, 0.0008);
    box(G, '#953428', sx * 0.2, 0.14, 0.0008, 0.03, 0.03, 0.001, 0, 0, Math.PI / 4);
    box(G, '#2a1a14', sx * 0.2, 0.147, 0.0016, 0.012, 0.016, 0.0008);
  }
  box(G, '#953428', 0, 0.206, 0.0008, 0.1, 0.022, 0.001);
  for (let k = 0; k < 4; k++) box(G, '#2a1a14', -0.033 + k * 0.022, 0.211, 0.0016, 0.012, 0.012, 0.0008);
  // eave: painted frieze under a fascia board, grey-tiled roof laid in rows, ridge
  box(G, '#aaa496', 0, 0.233, 0.0004, 0.6, 0.03, 0.001);
  for (let k = 0; k < 8; k++) box(G, ['#6a7466', '#8a6a4a', '#5a6470'][k % 3], -0.26 + k * 0.074, 0.239, 0.0012, 0.05, 0.018, 0.001);
  box(G, '#3a2e24', 0, WH - 0.004, 0.006, 0.6, 0.012, 0.012);
  gable(G, 0.58, 0.075, 0.2, '#4a4844', 0, WH, -0.055);
  for (let i = 0; i < 27; i++) { const x = -0.27 + i * 0.0208; rod(G, [x, WH + 0.003, 0.045], [x, WH + 0.077, -0.055], 0.0026, '#3c3a37', 4); }
  rod(G, [-0.28, WH + 0.078, -0.055], [0.28, WH + 0.078, -0.055], 0.0065, '#34322f', 6);
  // wok-ear gables (镬耳墙) rising above the roof at both ends, with dark copings
  for (const sx of [-1, 1]) {
    box(G, WALL, sx * 0.3, WH - 0.01, -0.055, 0.024, 0.09, 0.2);
    add(G, HALFDISC(), mat('#2e2c2a'), sx * 0.3, WH + 0.08, -0.055, 0.02, 0.108, 0.108);
    add(G, HALFDISC(), mat(WALL), sx * 0.3, WH + 0.08, -0.055, 0.026, 0.097, 0.097);
  }
  for (const sx of [-1, 1]) hongLantern(G, sx * 0.115, WH - 0.01, 0.03, 0.015);
  // firecrackers on a bamboo pole, the bottom of the string going off in flashes and smoke
  const fr = folk(gp, 0.37, Y, 0.06, -1.13, 0.1, '#4a4e56', { dress: undefined, bottom: '#3a3a3e', pose: 'stand', hands: [[0.03, 0.5, 0.2], [0.05, 0.62, 0.27]] });
  guapi(gp, fr, -1.13, 0.1);
  rod(gp, [fr.handL[0] - (TIP[0] - fr.handL[0]) * 0.1, fr.handL[1] - (TIP[1] - fr.handL[1]) * 0.1, fr.handL[2] - (TIP[2] - fr.handL[2]) * 0.1], TIP, 0.0022, '#9a8c5a', 5);
  for (let k = 0; k < 40; k++) {
    const yy = TIP[1] - 0.012 - k * 0.0046;
    if (yy < Y + 0.09) break;
    for (const s of [-1, 1]) cyl(gp, k % 7 === 6 ? '#a8884a' : '#8a2e24', TIP[0] + s * 0.003, yy, TIP[2], 0.0015, 0.008, 5).rotation.z = s * 1.1;
  }
  rod(gp, TIP, [TIP[0], Y + 0.09, TIP[2]], 0.0007, '#2a201a', 3);
  for (let i = 0; i < 6; i++) dotE(gp, '#f2dca8', '#e0a040', TIP[0] + (hash3(i, 1, 2) - 0.5) * 0.05, Y + 0.04 + hash3(i, 3, 4) * 0.04, TIP[2] + (hash3(i, 5, 6) - 0.5) * 0.04, 0.0035, 5);
  const smoke = mat('#b8b4ac', { transparent: 0.42 });
  for (let i = 0; i < 7; i++) {
    const r = 0.018 + hash3(i, 9, 1) * 0.016;
    add(gp, SPH(8), smoke, TIP[0] + (hash3(i, 2, 7) - 0.5) * 0.06, Y + 0.03 + i * 0.012, TIP[2] + (hash3(i, 4, 3) - 0.5) * 0.06, r * 2, r * 1.5, r * 2);
  }
  for (let i = 0; i < 60; i++) { const a = hash3(i, 3, 5) * TAU, d = Math.pow(hash3(i, 6, 1), 0.7) * 0.11; cb0(gp, i % 3 ? '#8a2e24' : '#9a4030', TIP[0] + Math.cos(a) * d, Y + 0.0006 + (i % 4) * 0.0002, TIP[2] + Math.sin(a) * d * 0.8, hash3(i, 1, 9) * 3); }
  // a boy covering his ears
  folk(gp, 0.33, Y, 0.27, -2.4, 0.07, '#7a3a2e', { dress: undefined, bottom: '#3a3e4a', hair: '#1c1714', hands: [[-0.08, 0.9, 0.02], [0.08, 0.9, 0.02]] });
  // flower-fair stall: bamboo frame, palm-matting awning, peach branches, kumquats and narcissus
  const S = grp(gp, -0.25, Y, 0.06, 0.3);
  for (const [px, pz] of [[-0.1, -0.06], [0.1, -0.06], [-0.1, 0.06], [0.1, 0.06]]) rod(S, [px, 0, pz], [px, 0.17, pz], 0.0035, '#9a8a5a', 5);
  for (const pz of [-0.06, 0.06]) rod(S, [-0.105, 0.17, pz], [0.105, 0.17, pz], 0.003, '#9a8a5a', 5);
  gable(S, 0.25, 0.035, 0.165, '#8a7a56', 0, 0.17, 0);
  box(S, '#953428', 0.06, 0.12, 0.062, 0.016, 0.045, 0.001);
  for (let k = 0; k < 3; k++) box(S, '#2a1a14', 0.06, 0.128 + k * 0.012, 0.0628, 0.008, 0.008, 0.0006);
  // stepped bench of potted kumquats at the back
  box(S, '#4a3828', 0, 0, -0.045, 0.19, 0.03, 0.03);
  box(S, '#4a3828', 0, 0, -0.022, 0.19, 0.015, 0.02);
  for (let i = 0; i < 5; i++) {
    const kx = -0.08 + i * 0.04, ky = i % 2 ? 0.015 : 0.03, kz = i % 2 ? -0.022 : -0.045;
    cyl(S, '#6e5240', kx, ky, kz, 0.011, 0.016, 8);
    ellipL(S, '#3e5034', kx, ky + 0.036, kz, 0.02, 0.022, 0.02);
    for (let j = 0; j < 9; j++) { const a = j * 2.4 + i, e = 0.3 + hash3(i, j, 4) * 0.8; dot(S, '#c08030', kx + Math.cos(a) * Math.cos(e) * 0.019, ky + 0.036 + Math.sin(e) * 0.016 - 0.006, kz + Math.sin(a) * Math.cos(e) * 0.019, 0.0032, 5); }
  }
  // the seller on a stool behind a low table of narcissus bowls
  box(S, '#4a3626', 0.0, 0, 0.0, 0.026, 0.035, 0.024);
  const sl = folk(S, 0.0, 0.035 - 0.27 * 0.095, 0.0, 0, 0.095, '#5a4e40', { dress: undefined, bottom: '#3e3a36', pose: 'sit', hands: [[-0.06, 0.38, 0.22], [0.08, 0.36, 0.24]] });
  guapi(S, sl, 0, 0.095);
  box(S, '#4a3828', 0, 0, 0.042, 0.14, 0.028, 0.035);
  for (let i = 0; i < 4; i++) {
    const nx = -0.05 + i * 0.033, nz = 0.042;
    cyl(S, '#9aa4a0', nx, 0.028, nz, 0.011, 0.007, 10);
    for (let j = 0; j < 3; j++) dot(S, '#d8d0b8', nx + (j - 1) * 0.005, 0.036, nz, 0.004, 5);
    for (let j = 0; j < 7; j++) { const a = j * 0.9 + i; rod(S, [nx + Math.cos(a) * 0.003, 0.035, nz + Math.sin(a) * 0.003], [nx + Math.cos(a) * 0.008, 0.062 + hash3(i, j, 2) * 0.01, nz + Math.sin(a) * 0.008], 0.0011, '#4e6a3e', 3); }
    for (let j = 0; j < 4; j++) { const a = j * 1.6 + i; dot(S, '#e8e2d0', nx + Math.cos(a) * 0.006, 0.066, nz + Math.sin(a) * 0.006, 0.0028, 5); dot(S, '#c8a040', nx + Math.cos(a) * 0.006, 0.067, nz + Math.sin(a) * 0.006 + 0.002, 0.0012, 4); }
  }
  // tall basket of peach branches beside the stall
  cyl(S, '#8a7a50', 0.14, 0, -0.02, 0.022, 0.06, 10);
  for (let i = 0; i < 4; i++) peachBranch(S, [0.14 + (i - 1.5) * 0.006, 0.05, -0.02], [0.14 + (i - 1.5) * 0.03, 0.2 + hash3(i, 3, 3) * 0.04, -0.02 + (i % 2 ? 0.02 : -0.02)], i);
  // host and visitor exchange the New-Year 拱手 at the door
  const GH: [[number, number, number], [number, number, number]] = [[-0.03, -0.155, 0], [-0.01, -0.05, Math.PI]];
  GH.forEach(([x, z, ry], i) => {
    const r = folk(gp, x, Y, z, ry, 0.1, i ? '#3a2e28' : '#2a2826', { bottom: i ? '#6a6458' : '#4a5462', hands: [[-0.02, 0.62, 0.17], [0.02, 0.62, 0.17]] });
    guapi(gp, r, ry, 0.1);
  });
  // a family walking home from the fair, the father shouldering a peach branch
  const fa = folk(gp, -0.08, Y, 0.25, 0.9, 0.1, '#2a2826', { bottom: '#5a5040', pose: 'walk', phase: 0.2, hands: [[-0.13, 0.47, 0.04], [0.07, 0.68, 0.06]] });
  guapi(gp, fa, 0.9, 0.1);
  const bx = -Math.sin(0.9), bz = -Math.cos(0.9);
  peachBranch(gp, [fa.handR[0] - bx * 0.03, fa.handR[1] - 0.04, fa.handR[2] - bz * 0.03], [fa.handR[0] + bx * 0.08, fa.handR[1] + 0.13, fa.handR[2] + bz * 0.08], 7);
  const mo = folk(gp, 0.04, Y, 0.33, 1.1, 0.092, '#4a4a5a', { bottom: '#2e2e36', hair: '#1a1512', pose: 'walk', phase: 0.7, hands: [[-0.12, 0.47, 0.02], [0.13, 0.46, 0.02]] });
  nape(gp, mo, 1.1, 0.092);
  folk(gp, 0.06, Y, 0.4, 1.1, 0.066, '#8a3a2e', { dress: undefined, bottom: '#3a3e4a', hair: '#1c1714', pose: 'walk', phase: 0.4 });
  fuse(gp);
};
/** A torn scrap of red paper lying flat. */
function cb0(p: THREE.Object3D, c: string, x: number, y: number, z: number, ry: number): void { box(p, c, x, y, z, 0.0045, 0.0005, 0.003, ry); }

// ---------------------------------------------------------------------------------------------------------
// LANTERN FESTIVAL 上元灯会. Default — Tang Chang'an: 《朝野佥载》 records that for 上元 in 先天二年 (713) a 灯轮
// 20 丈 high, dressed in brocade and silk and hung with 50,000 lamps, was raised outside 安福门, and that palace
// women danced the 踏歌 beneath it for three nights. Here the many-tiered timber wheel stands in the street before
// a rammed-earth city wall and gate tower; women in high-waisted skirts and high buns dance in a ring, men in
// round-collared robes and black 幞头 watch.
// r.style 'qinhuai' — Ming 秦淮灯会, Nanjing: lantern boats strung with lamps "like strings of pearls" on the
// Qinhuai (张岱《陶庵梦忆·秦淮河房》), white-walled black-tiled river houses with lanterns along their water
// balconies, the red walls of the Confucius Temple 夫子庙 and an arched stone bridge (文德桥).
// ---------------------------------------------------------------------------------------------------------
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
/** Period townsperson on the realistic human rig (≈7 heads), muted natural-dye dress. */
function folk(p: THREE.Object3D, x: number, y: number, z: number, ry: number, h: number, top: string, o: Partial<HumanOpts> = {}): HumanRig {
  return human(p, x, y, z, { h, ry, top, bottom: shade(top, 0.8), skin: '#c99c78', hair: '#1c1714', shoes: '#2a2018', dress: 'ankle', detail: h >= 0.09 ? 'hi' : 'lo', ...o });
}
/** Black gauze 幞头 (Tang–Ming men's cap): close cap with two stiff tails behind. */
function futou(p: THREE.Object3D, r: HumanRig, ry: number, h: number, wide = false): void {
  const [x, y, z] = r.head, bx = -Math.sin(ry), bz = -Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
  ellip(p, '#1c1a18', x, y + 0.035 * h, z, 0.05 * h, 0.05 * h, 0.05 * h, ry);
  ellip(p, '#1c1a18', x + bx * 0.02 * h, y + 0.075 * h, z + bz * 0.02 * h, 0.03 * h, 0.03 * h, 0.03 * h, ry);
  for (const k of [-1, 1]) {
    const a: V3 = [x + bx * 0.05 * h, y + 0.04 * h, z + bz * 0.05 * h];
    rod(p, a, wide ? [a[0] + sx * k * 0.14 * h, a[1] + 0.005 * h, a[2] + sz * k * 0.14 * h] : [a[0] + bx * 0.03 * h + sx * k * 0.02 * h, a[1] - 0.09 * h, a[2] + bz * 0.03 * h + sz * k * 0.02 * h], 0.006 * h, '#1c1a18', 4);
  }
}
/** Tang/Ming woman's high bun (高髻), optionally with a hairpin. */
function bun(p: THREE.Object3D, r: HumanRig, ry: number, h: number): void {
  const [x, y, z] = r.head, bx = -Math.sin(ry) * 0.015 * h, bz = -Math.cos(ry) * 0.015 * h;
  ellip(p, '#1a1512', x + bx, y + 0.085 * h, z + bz, 0.035 * h, 0.05 * h, 0.03 * h, ry, 0, 0.3);
  dot(p, '#b8a060', x + bx, y + 0.12 * h, z + bz, 0.008 * h, 5);
}
/** Small silk lantern (warm glow) hanging below (x,y,z). */
function silkLamp(p: THREE.Object3D, x: number, y: number, z: number, r: number, c = '#f2d7a4', e = '#d9822b'): void {
  rod(p, [x, y, z], [x, y - r * 0.8, z], r * 0.08, '#3a2a1e', 3);
  add(p, g('fs-silk', () => new THREE.CylinderGeometry(0.42, 0.42, 1, 6, 1)), mat(c, { emissive: e }), x, y - r * 1.8, z, r * 2, r * 2, r * 2);
}
/** Weeping willow: leaning trunk, a thin crown and long strands hanging from its rim. */
function willow(p: THREE.Object3D, x: number, y: number, z: number, s: number, lean = 0.2): void {
  const top: V3 = [x + lean * 0.12 * s, y + 0.17 * s, z];
  tube(p, [[x, y, z], [x + lean * 0.05 * s, y + 0.09 * s, z], top], 0.011 * s, 0.006 * s, '#4a3a2c', { radial: 6, sub: 3 });
  const tips: V3[] = [];
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + 0.4, tip: V3 = [top[0] + Math.cos(a) * 0.06 * s, top[1] + 0.045 * s, top[2] + Math.sin(a) * 0.05 * s];
    tube(p, [top, [top[0] + Math.cos(a) * 0.03 * s, top[1] + 0.035 * s, top[2] + Math.sin(a) * 0.025 * s], tip], 0.005 * s, 0.002 * s, '#4a3a2c', { radial: 4, sub: 2 });
    for (let j = 0; j < 3; j++) ellipL(p, j % 2 ? '#5a6642' : '#66724a', tip[0] + Math.cos(a + j * 2.1) * 0.016 * s, tip[1] + (0.002 + j * 0.004) * s, tip[2] + Math.sin(a + j * 2.1) * 0.016 * s, 0.02 * s, 0.016 * s, 0.018 * s, a + j);
    tips.push(tip);
  }
  // long thin hanging withies
  for (let i = 0; i < 44; i++) {
    const t = tips[i % 4], a = i * 2.4, rr = (0.005 + hash3(i, x * 7, 3) * 0.032) * s, sx = t[0] + Math.cos(a) * rr, sz = t[2] + Math.sin(a) * rr;
    const l = (0.07 + hash3(i, 5, z * 9) * 0.08) * s;
    tube(p, [[sx, t[1] + 0.006 * s, sz], [sx + Math.cos(a) * 0.01 * s, t[1] - l * 0.4, sz + Math.sin(a) * 0.01 * s], [sx + Math.cos(a) * 0.012 * s, t[1] - l, sz + Math.sin(a) * 0.012 * s]], 0.0032 * s, 0.0012 * s, i % 3 ? '#6a764a' : '#7a8456', { radial: 3, sub: 2 });
  }
}
/** Timber hall body: plastered walls, ochre-red columns, a tiled roof. */
function hallBody(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, ry: number, wall: string, roof: string, rh = 0.05, col = '#7e3424'): THREE.Group {
  const H = grp(p, x, y, z, ry);
  box(H, wall, 0, 0, 0, w, h, d);
  const n = Math.max(2, Math.round(w / 0.06));
  for (let i = 0; i <= n; i++) box(H, col, -w / 2 + (i * w) / n, 0, d / 2 + 0.002, 0.008, h, 0.006);
  box(H, col, 0, h - 0.012, d / 2 + 0.003, w, 0.012, 0.006);
  cnRoof(H, 0, h, 0, w + 0.06, d + 0.06, rh, roof);
  return H;
}
function lanternWheel(p: THREE.Object3D, x: number, y: number, z: number): void {
  const W = grp(p, x, y, z);
  // stone footing, four raking timber props and the brocade-wrapped mast
  cyl(W, '#8a8378', 0, 0, 0, 0.05, 0.016, 8);
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; rod(W, [Math.cos(a) * 0.075, 0.0, Math.sin(a) * 0.075], [0, 0.14, 0], 0.004, '#5a3e2a', 5); }
  cyl(W, '#5a3e2a', 0, 0.016, 0, 0.011, 0.6, 8);
  for (let i = 0; i < 12; i++) cyl(W, i % 2 ? '#8a3a2a' : '#a8884a', 0, 0.06 + i * 0.045, 0, 0.0122, 0.012, 8);
  const tiers = 6;
  for (let k = 0; k < tiers; k++) {
    const ty = 0.15 + k * 0.08, R = 0.2 - k * 0.028, n = 18 - k * 2;
    // the wheel rim and its spokes
    const rim: V3[] = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; rim.push([Math.cos(a) * R, ty, Math.sin(a) * R]); }
    for (let i = 0; i < n; i++) rod(W, rim[i], rim[i + 1], 0.0022, '#4a3424', 3);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + k * 0.3; rod(W, [0, ty + 0.03, 0], [Math.cos(a) * R, ty, Math.sin(a) * R], 0.0018, '#4a3424', 3); }
    // silk festoons between the rim posts and the lamps hanging under them
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * TAU, m: V3 = [Math.cos(a) * R * 0.99, ty - 0.014, Math.sin(a) * R * 0.99];
      tube(W, [rim[i], m, rim[i + 1]], 0.0016, 0.0016, (i + k) % 2 ? '#9a3a2c' : '#b39250', { radial: 3, sub: 2 });
      silkLamp(W, rim[i][0], ty, rim[i][2], 0.0075, (i + k) % 3 ? '#f2d7a4' : '#e8b88a');
    }
  }
  // gilt finial
  cone(W, '#a8884a', 0, 0.616, 0, 0.014, 0.05, 8);
  dot(W, '#c8a85a', 0, 0.672, 0, 0.008, 6);
}
function lanternBoat(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number): void {
  const B = grp(p, x, y, z, ry, s);
  // a flat-bottomed pleasure boat (画舫): dark-oiled hull, a cabin with lattice windows and a tiled-roof canopy
  sweep(B, [
    { p: [-0.17, 0.016, 0], w: 0.012, h: 0.01 }, { p: [-0.14, 0.008, 0], w: 0.034, h: 0.014 }, { p: [0.1, 0.008, 0], w: 0.036, h: 0.014 },
    { p: [0.16, 0.016, 0], w: 0.014, h: 0.01 },
  ], '#4a3426', { squash: 0.6, radial: 10, sub: 4 });
  box(B, '#6a4a32', -0.01, 0.018, 0, 0.28, 0.004, 0.06);
  box(B, '#5a3e2a', -0.02, 0.022, 0, 0.17, 0.05, 0.055);
  for (let i = 0; i < 6; i++) glow(box(B, '#f0cf98', -0.09 + i * 0.028, 0.034, 0.0, 0.02, 0.026, 0.057), '#f0cf98', '#c87a2a');
  box(B, '#3a2a1e', -0.02, 0.072, 0, 0.19, 0.006, 0.07);
  gable(B, 0.2, 0.026, 0.074, '#34322f', -0.02, 0.078, 0, 0);
  // strings of lamps from the canopy to bow and stern posts, and rows along the eaves
  for (const [px, ph] of [[-0.15, 0.1], [0.14, 0.1]] as const) rod(B, [px, 0.018, 0], [px, 0.018 + ph, 0], 0.002, '#3a2a1e', 4);
  for (const sz of [-0.037, 0.037]) for (let i = 0; i < 9; i++) silkLamp(B, -0.11 + i * 0.023, 0.075, sz, 0.0065, '#f0c890', '#d9741f');
  for (const [px, ph] of [[-0.15, 0.1], [0.14, 0.1]] as const) for (let i = 1; i <= 5; i++) {
    const t = i / 6, xx = px + (-0.02 - px) * t, yy = 0.018 + ph + (0.1 - ph) * t - Math.sin(t * Math.PI) * 0.02;
    silkLamp(B, xx, yy, 0, 0.0065, i % 2 ? '#e8b88a' : '#f0d6a0', '#c86a28');
  }
  // boatman poling at the stern
  const r = folk(B, -0.15, 0.02, 0.0, Math.PI / 2, 0.075, '#4e5560', { dress: undefined, hatStyle: 'conical', hat: '#8a7a58', pose: 'stand', hands: [[0.1, 0.62, 0.2], [0.14, 0.8, 0.22]], lean: 0.15 });
  rod(B, [r.handR[0] + 0.01, r.handR[1] + 0.05, r.handR[2]], [r.handR[0] - 0.02, -0.04, r.handR[2] + 0.04], 0.0018, '#7a6040', 4);
}
const fs_lantern: Builder = (gp, rc) => {
  if (str(rc.style, '') === 'qinhuai') {
    const inRiver = (z: number) => z > -0.13 && z < 0.17;
    const hf = (x: number, z: number) => (inRiver(z) ? 0 : z < 0 ? 0.045 : 0.035) + fbm(x * 9, 2, z * 9, 2) * 0.002;
    const pv = stones('#8c877e', 0.03, 0.2);
    const water: Paint = (x, _y, z) => shade('#2e3c3a', 0.9 + fbm(x * 40, 0, z * 12, 2) * 0.2);
    const paint: Paint = (x, y, z, nx, ny, nz) => {
      if (y < 0.038) return water(x, y, z, nx, ny, nz);
      if (ny < 0.8) return shade('#7a766e', 0.85 + hash3(Math.floor(x * 60), Math.floor(y * 120), 1) * 0.2);
      return pv(x, y, z, nx, ny, nz);
    };
    base(gp, 0.5, '#2e3c3a', paint, '#4e4034', 0.035, hf, 26, 72);
    const YB = 0.08, YF = 0.07, YW = 0.036;
    // north bank: river houses (河房) on stone footings with timber water-balconies, then the temple's red walls
    for (const [hx, hw, hh, seed] of [[-0.31, 0.15, 0.2, 0], [-0.15, 0.15, 0.16, 1], [0.01, 0.14, 0.19, 2]] as const) {
      const H = grp(gp, hx, YB, -0.27);
      box(H, '#dcd7cb', 0, 0, 0, hw, hh, 0.14);
      box(H, '#3e3a36', 0, 0, 0.071, hw, 0.012, 0.002);
      // upper storey of lattice windows opening onto a balcony that overhangs the river
      box(H, '#4e3626', 0, hh * 0.52, 0.071, hw * 0.9, hh * 0.36, 0.004);
      for (let i = 0; i < 5; i++) glow(box(H, '#e9c88e', -hw * 0.36 + i * hw * 0.18, hh * 0.56, 0.073, hw * 0.13, hh * 0.27, 0.002), '#e9c88e', '#b8681e');
      box(H, '#4e3626', 0, hh * 0.46, 0.1, hw, 0.006, 0.06);
      for (const sx of [-1, 1]) for (const zz of [0.13]) cyl(H, '#3a2a1e', sx * hw * 0.45, -0.045, zz, 0.004, hh * 0.46 + 0.045, 5);
      for (let i = 0; i < 7; i++) rod(H, [-hw / 2 + (i * hw) / 6, hh * 0.47, 0.13], [-hw / 2 + (i * hw) / 6, hh * 0.47 + 0.025, 0.13], 0.0015, '#3a2a1e', 3);
      rod(H, [-hw / 2, hh * 0.47 + 0.025, 0.13], [hw / 2, hh * 0.47 + 0.025, 0.13], 0.002, '#3a2a1e', 3);
      cnRoof(H, 0, hh, 0, hw + 0.03, 0.2, 0.06, '#33312e');
      for (let i = 0; i < 4; i++) redLantern(H, -hw * 0.36 + i * hw * 0.24, hh + 0.005, 0.1, 0.008, '#b8452e', '#9a2e1a');
      // stepped horse-head gable wall (马头墙) between houses
      if (seed < 2) for (let k = 0; k < 3; k++) { box(H, '#dcd7cb', hw / 2 + 0.006, 0, 0.0 - 0.05 + k * 0.05, 0.012, hh + 0.08 - k * 0.03, 0.05); box(H, '#2e2c2a', hw / 2 + 0.006, hh + 0.08 - k * 0.03, -0.05 + k * 0.05, 0.02, 0.008, 0.054); }
    }
    // 夫子庙: red-walled hall with a double-eaved roof and a stone 棂星门 gateway in front
    const T = hallBody(gp, 0.25, YB, -0.3, 0.2, 0.12, 0.11, -0.25, '#8a3a2a', '#3a3835', 0.05);
    cnRoof(T, 0, 0.17, 0, 0.18, 0.1, 0.06, '#3a3835');
    box(T, '#5a2a20', 0, 0.11, 0, 0.16, 0.06, 0.08);
    const LG = grp(gp, 0.22, YB, -0.15, -0.25);
    for (const sx of [-0.06, -0.02, 0.02, 0.06]) cyl(LG, '#c8c2b4', sx, 0, 0, 0.005, 0.1, 6);
    box(LG, '#c8c2b4', 0, 0.075, 0, 0.14, 0.008, 0.008);
    box(LG, '#c8c2b4', 0, 0.06, 0, 0.13, 0.005, 0.006);
    // stone embankments with railings along both banks
    for (const [z0, yy] of [[-0.14, YB], [0.175, YF]] as const) for (let i = 0; i < 19; i++) {
      const xx = -0.45 + i * 0.05;
      if (Math.hypot(xx, z0) > 0.48) continue;
      box(gp, '#a8a296', xx, yy, z0, 0.006, 0.022, 0.006);
      if (Math.hypot(xx + 0.05, z0) < 0.48) box(gp, '#a8a296', xx + 0.025, yy + 0.016, z0, 0.05, 0.004, 0.004);
    }
    // 文德桥: a single-arched stone bridge at the left
    const Br = grp(gp, -0.37, 0, 0.02);
    const arch: V3[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; arch.push([0, YW + 0.045 + (1 - t * t) * 0.045, t * 0.17]); }
    for (let i = 0; i < 10; i++) { const a = arch[i], b = arch[i + 1]; box(Br, '#9a948a', 0, Math.min(a[1], b[1]) - 0.012, (a[2] + b[2]) / 2, 0.075, Math.abs(b[1] - a[1]) + 0.012, Math.abs(b[2] - a[2]) + 0.002); }
    for (const sz of [-1, 1]) box(Br, '#8a847a', 0, 0.035, sz * 0.12, 0.08, 0.05, 0.04);
    const ring = cyl(Br, '#1c2422', 0, 0, 0, 0.055, 0.078, 14); ring.rotation.z = Math.PI / 2; ring.position.set(0, YW + 0.012, 0.0); ring.scale.z *= 1.3;
    for (const sx of [-1, 1]) tube(Br, arch.map(([, y2, z2]) => [sx * 0.035, y2 + 0.012, z2] as V3), 0.003, 0.003, '#b0aa9e', { radial: 4, sub: 2 });
    // the lantern boats and floating river lamps (河灯)
    lanternBoat(gp, 0.0, YW - 0.004, 0.03, 0.05, 1.05);
    lanternBoat(gp, 0.27, YW - 0.004, 0.09, -0.15, 0.8);
    for (let i = 0; i < 12; i++) {
      const lx = -0.28 + hash3(i, 3, 1) * 0.6, lz = -0.1 + hash3(i, 7, 2) * 0.24;
      if (Math.abs(lz - 0.03) < 0.05 && Math.abs(lx) < 0.2) continue;
      cyl(gp, '#4a5a3a', lx, YW, lz, 0.012, 0.003, 7);
      add(gp, g('fs-silk', () => new THREE.CylinderGeometry(0.42, 0.42, 1, 6, 1)), mat('#f2c48a', { emissive: '#d4741f' }), lx, YW + 0.009, lz, 0.014, 0.012, 0.014);
    }
    for (let i = 0; i < 18; i++) {
      const lx = -0.32 + i * 0.038, lz = -0.12 + hash3(i, 2, 9) * 0.03;
      glow(ellip(gp, '#5a4630', lx, YW + 0.0005, lz + 0.04, 0.003, 0.0005, 0.02), '#5a4630', '#4a2e14');
    }
    // south bank: willows and Ming townsfolk (方巾 / 网巾 caps, 道袍; women in jackets over long skirts)
    willow(gp, -0.27, YF, 0.24, 0.8, 0.3);
    willow(gp, 0.38, YF, 0.22, 0.75, -0.3);
    const P: [number, number, number, string, boolean][] = [[-0.08, 0.25, 2.9, '#4e5a66', false], [-0.03, 0.27, 3.4, '#8a6e4e', true], [0.12, 0.22, 3.0, '#5e6a50', false], [0.17, 0.3, 2.6, '#7a4a3a', true], [-0.3, 0.32, 0.5, '#5c5048', false], [0.06, 0.38, 0.2, '#6a5a72', true]];
    P.forEach(([px, pz, ry, c, f], i) => {
      const h = f ? 0.068 : 0.074;
      const r = folk(gp, px, YF, pz, ry, h, c, { hair: f ? '#1a1512' : null, hat: f ? undefined : '#1c1a18', hatStyle: f ? undefined : 'cap', pose: i === 2 ? 'point' : 'stand', bottom: f ? shade(c, 0.7) : shade(c, 0.9) });
      if (f) bun(gp, r, ry, h);
      if (i === 4 || i === 1) { rod(gp, r.handR, [r.handR[0], r.handR[1] + 0.03, r.handR[2] + 0.015], 0.0012, '#3a2a1e', 3); silkLamp(gp, r.handR[0], r.handR[1] + 0.03, r.handR[2] + 0.015, 0.006, '#f0c890', '#d9741f'); }
    });
    fuse(gp);
    return;
  }
  // Tang Chang'an: a rammed-earth street before the city wall and its gate tower
  const paint: Paint = (x, _y, z) => {
    if (z < -0.33) return shade('#8a7a62', 0.9 + fbm(x * 30, 0, z * 30, 2) * 0.2);
    return shade('#958468', 0.88 + fbm(x * 24, 0, z * 24, 2) * 0.22);
  };
  base(gp, 0.5, '#958468', paint, '#5a4636', 0.035, () => 0, 18, 64);
  const Y = 0.035;
  const WL = grp(gp, -0.08, Y, -0.33);
  // battered rammed-earth wall with brick-faced gate passage
  for (const sx of [-1, 1]) { box(WL, '#9c8a6c', sx * 0.16, 0, 0, 0.18, 0.15, 0.08); box(WL, '#8c7a5e', sx * 0.16, 0.15, 0, 0.18, 0.004, 0.08); for (let i = 0; i < 5; i++) box(WL, '#968466', sx * (0.1 + i * 0.033), 0.154, 0.034, 0.02, 0.016, 0.01); }
  box(WL, '#7a7266', 0, 0, 0, 0.14, 0.15, 0.078);
  box(WL, '#1e1a16', 0, 0, 0.035, 0.06, 0.09, 0.012);
  box(WL, '#5a3a26', 0, 0, 0.04, 0.003, 0.09, 0.004);
  // the gate tower: an ochre-red colonnaded hall with white walls and a broad grey-tiled hip-gable roof
  hallBody(WL, 0, 0.15, 0, 0.26, 0.08, 0.075, 0, '#d8cfbe', '#45433f', 0.06);
  box(WL, '#8c7a5e', 0, 0.148, 0, 0.32, 0.006, 0.1);
  for (let i = 0; i < 5; i++) silkLamp(WL, -0.1 + i * 0.05, 0.225, 0.07, 0.008, '#e8b88a', '#c8642a');
  lanternWheel(gp, 0.1, Y, -0.04);
  // 踏歌: women link arms and stamp in a ring under the wheel
  const SK = ['#8a3a30', '#5a6a4c', '#a07a3e', '#4a5468', '#7a4a5a', '#8a3a30', '#a07a3e', '#5a6a4c', '#4a5468'];
  SK.forEach((c, i) => {
    const a = (i / SK.length) * TAU + 0.2, R = 0.13, x = 0.1 + Math.cos(a) * R, z = -0.04 + Math.sin(a) * R, ry = Math.atan2(Math.cos(a), Math.sin(a)), h = 0.072;
    const r = folk(gp, x, Y, z, ry, h, '#d6c7a6', { bottom: c, hair: '#1a1512', pose: 'walk', phase: i % 2 ? 0.25 : 0.75, hands: [[-0.26, 0.48, 0.0], [0.26, 0.48, 0.0]], build: 0.9 });
    bun(gp, r, ry, h);
    // 披帛 shawl over the shoulders
    tube(gp, [r.handL, [x - Math.sin(ry) * 0.006, Y + h * 0.82, z - Math.cos(ry) * 0.006], r.handR], 0.0012, 0.0012, i % 2 ? '#c8b07a' : '#a8b4a0', { radial: 3, sub: 4 });
  });
  // men in round-collared robes (圆领袍) and 幞头 watching, a boy on his father's shoulders
  const MEN: [number, number, number, string, string?][] = [[-0.3, 0.22, 0.5, '#7a6440'], [-0.22, 0.3, 0.2, '#4c5a48', 'point'], [0.26, 0.26, -0.4, '#5a5e70'], [0.34, 0.12, -0.9, '#c2b494'], [0.08, 0.34, 0.0, '#8a4a36'], [-0.36, 0.06, 1.0, '#6a5a48']];
  for (const [mx, mz, ry, c, pose] of MEN) {
    const h = 0.08, r = folk(gp, mx, Y, mz, ry + Math.PI, h, c, { hair: null, pose: (pose as 'point') ?? 'stand', bottom: shade(c, 0.85), hands: pose ? undefined : [[-0.06, 0.55, 0.1], [0.06, 0.55, 0.1]] });
    futou(gp, r, ry + Math.PI, h);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DRAGON BOAT 竞渡 — Chu, on the Yangtze at Jingzhou (《荆楚岁时记》: "五月五日竞渡，俗为屈原投汨罗日…故并命舟楫以拯之";
// the oldest picture of a racing crew is the Warring States 羽人竞渡纹铜钺 from Yin county, Ningbo): a long narrow plank
// boat with a carved dragon head and tail lacquered black, red and ochre in the Chu manner, seven pairs of paddlers in
// hemp tunics stroking together, a drummer beating time on a barrel drum and a steersman with a long sweep-oar; on the
// reedy bank people in wrapped robes (曲裾深衣) watch, one casting rice in a bamboo tube (筒粽, 《续齐谐记》) to the river.
// ---------------------------------------------------------------------------------------------------------
const BL = '#2a2420', RD = '#7e2e22', OC = '#a8884a';
/** Seated paddler facing +x in the boat frame; `side` = which world-z side the paddle goes in. Returns the blade point. */
function paddler(p: THREE.Object3D, x: number, y: number, z: number, side: number, top: string, ph: number): V3 {
  const f = grp(p, x, y, z, Math.PI / 2);
  const out = -side, h = 0.088, y0 = 0.004 - 0.2 * h;
  // hands in rig space: top hand over the inboard knee at brow height, lower hand outboard by the hip
  const topU: V3 = [out * 0.04, 0.66 - ph * 0.06, 0.34 - ph * 0.1], lowU: V3 = [out * 0.27, 0.3, 0.28 - ph * 0.12];
  const F = (v: V3): V3 => [v[0] * h, v[1] * h + y0, v[2] * h];
  const tp = F(topU), lw = F(lowU);
  const d = [lw[0] - tp[0], lw[1] - tp[1], lw[2] - tp[2]], t = (-0.04 - tp[1]) / d[1];
  const grip: V3 = [tp[0] - d[0] * 0.15, tp[1] - d[1] * 0.15, tp[2] - d[2] * 0.15];
  const blade: V3 = [tp[0] + d[0] * t, -0.04, tp[2] + d[2] * t];
  rod(f, grip, blade, 0.002, '#6a5038', 5);
  ellip(f, '#5a4430', blade[0], blade[1] + 0.01, blade[2], 0.0028, 0.014, 0.008);
  const rig = human(f, 0, y0, 0, {
    h, pose: 'row', top, bottom: '#4a4238', skin: '#b98a62', hair: '#1c1714', hat: '#1c1714', hatStyle: 'knot', sleeve: 0.2, detail: 'lo',
    hands: out > 0 ? [topU, lowU] : [lowU, topU], feet: [[-0.07, 0.03, 0.3], [0.07, 0.03, 0.3]],
  });
  cyl(f, '#5a2a22', rig.head[0], rig.head[1] - 0.0005, rig.head[2], 0.0066, 0.002, 8); // headband
  return [x + blade[2], y + blade[1], z - blade[0]];
}
/** A clump of reeds: thin stems, some with pale plumes. */
function reeds(p: THREE.Object3D, x: number, y: number, z: number, n: number, s: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 1) * TAU, rr = hash3(i, seed, 2) * 0.03 * s, h = (0.06 + hash3(i, seed, 3) * 0.05) * s;
    const b: V3 = [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr], t: V3 = [b[0] + Math.cos(a) * h * 0.25, y + h, b[2] + Math.sin(a) * h * 0.2];
    rod(p, b, t, 0.0011, ['#7a7a4e', '#8e8a5a', '#6a6e44'][i % 3], 3);
    if (i % 3 === 0) ellipL(p, '#a89a78', t[0], t[1] + 0.006, t[2], 0.0028, 0.009, 0.0028);
  }
}
const fs_dragonboat: Builder = (gp) => {
  const bank = (x: number, z: number) => sstep(-0.21, -0.29, z) * (0.045 + fbm(x * 8, 1, z * 8, 2) * 0.008);
  const paint: Paint = (x, y, z) => {
    if (y < 0.038) {
      return shade('#47574f', 0.9 + fbm(x * 30, 0, z * 9, 2) * 0.18);
    }
    if (y < 0.07) return shade('#6a5e48', 0.9 + fbm(x * 40, y * 40, z * 40, 2) * 0.2);
    return shade('#6e7048', 0.85 + fbm(x * 30, 0, z * 30, 2) * 0.28);
  };
  base(gp, 0.5, '#47574f', paint, '#5a4636', 0.035, bank, 44, 128);
  const W = 0.036, YB = 0.035 + 0.045;
  // hull: narrow plank boat, lacquered black with a red-and-ochre band under the gunwale
  const B = grp(gp, 0, 0, 0.06, 0.06);
  const hullPaint: Paint = (x, y) => {
    if (y > 0.057) return BL;
    if (y > 0.049) { const u = Math.floor(x * 140); return u % 4 === 0 ? OC : u % 4 === 2 ? BL : RD; }
    return y > 0.04 ? '#2e2824' : '#262220';
  };
  sweep(B, [
    { p: [-0.38, 0.058, 0], w: 0.008, h: 0.01 }, { p: [-0.34, 0.05, 0], w: 0.026, h: 0.016 }, { p: [-0.2, 0.046, 0], w: 0.04, h: 0.02 },
    { p: [0.12, 0.046, 0], w: 0.04, h: 0.02 }, { p: [0.3, 0.05, 0], w: 0.028, h: 0.017 }, { p: [0.36, 0.058, 0], w: 0.01, h: 0.012 },
  ], BL, { paint: hullPaint, squash: 0.7, radial: 16, sub: 5 });
  box(B, '#5a4634', -0.03, 0.058, 0, 0.6, 0.004, 0.064);
  for (const sz of [-1, 1]) {
    const rail: V3[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = -0.36 + t * 0.7; rail.push([x, 0.062 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.006, sz * (0.04 - Math.pow(Math.abs(t - 0.45) * 2, 2.2) * 0.028)]); }
    tube(B, rail, 0.0025, 0.0025, BL, { radial: 5, sub: 3 });
  }
  // seven pairs of paddlers stroking in time, small splashes where the blades bite
  const spl = mat('#9aa8a2', { transparent: 0.55 });
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
    const bp = paddler(B, -0.25 + i * 0.07, 0.06, side * 0.02, side, ['#8e7e60', '#7a6c52', '#94886a'][(i + (side > 0 ? 1 : 0)) % 3], 0.3);
    add(B, SPH(8), spl, bp[0], W + 0.001, bp[2], 0.026, 0.004, 0.012);
  }
  // drummer at the bow facing the crew, beating a lacquered barrel drum
  const D = grp(B, 0.255, 0.06, 0, -Math.PI / 2);
  cyl(D, RD, 0, 0, 0.045, 0.019, 0.034, 12);
  for (const yy of [0.004, 0.026]) cyl(D, BL, 0, yy, 0.045, 0.0195, 0.004, 12);
  cyl(D, '#b8a888', 0, 0.034, 0.045, 0.017, 0.002, 12);
  const dh = 0.088, dr = human(D, 0, 0.004 - 0.2 * dh, 0, {
    h: dh, pose: 'row', top: '#6a4a36', bottom: '#4a4238', skin: '#b98a62', hair: '#1c1714', hat: '#1c1714', hatStyle: 'knot', sleeve: 0.3, detail: 'lo',
    hands: [[-0.12, 0.62, 0.38], [0.1, 0.78, 0.34]], feet: [[-0.1, 0.03, 0.26], [0.1, 0.03, 0.26]],
  });
  rod(D, dr.handL, [0.004, 0.036, 0.04], 0.0012, '#4a3424', 4);
  rod(D, dr.handR, [dr.handR[0] - 0.006, dr.handR[1] + 0.02, dr.handR[2] - 0.004], 0.0012, '#4a3424', 4);
  // steersman standing at the stern on the long sweep-oar
  const sr = human(B, -0.33, 0.06, 0, {
    h: 0.09, ry: Math.PI / 2, pose: 'stand', top: '#5a4a3a', bottom: '#4a4238', skin: '#b98a62', hair: '#1c1714', hat: '#1c1714', hatStyle: 'knot', sleeve: 0.4,
    hands: [[0.12, 0.66, 0.08], [0.16, 0.46, -0.14]], lean: 0.1,
  });
  {
    const a = sr.handL, b = sr.handR, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = (0.025 - a[1]) / d[1];
    const end: V3 = [a[0] + d[0] * t, 0.025, a[2] + d[2] * t];
    rod(B, [a[0] - d[0] * 0.2, a[1] - d[1] * 0.2, a[2] - d[2] * 0.2], end, 0.0024, '#6a5038', 5);
    ellip(B, '#5a4430', end[0], end[1], end[2], 0.016, 0.004, 0.009, Math.atan2(-d[2], d[0]));
  }
  // dragon head on an arching neck: carved, lacquered black with red and ochre
  sweep(B, [{ p: [0.35, 0.056, 0], w: 0.016, h: 0.014 }, { p: [0.385, 0.085, 0], w: 0.014, h: 0.013 }, { p: [0.405, 0.122, 0], w: 0.013, h: 0.013 }, { p: [0.42, 0.148, 0], w: 0.014, h: 0.014 }],
    BL, { paint: (_x, y) => { const k = Math.floor(y * 170); return k % 4 === 0 ? RD : k % 8 === 2 ? OC : BL; }, radial: 10, sub: 4 });
  const Hd = grp(B, 0.42, 0.152, 0);
  sweep(Hd, [{ p: [-0.012, 0.004, 0], w: 0.016, h: 0.015 }, { p: [0.02, 0.004, 0], w: 0.013, h: 0.01 }, { p: [0.048, 0.001, 0], w: 0.008, h: 0.006 }, { p: [0.062, 0.004, 0], w: 0.005, h: 0.005 }],
    BL, { radial: 10, sub: 3, paint: (x, y) => (y > 0.008 && Math.floor(x * 150) % 3 === 0 ? RD : BL) });
  tube(Hd, [[0.06, 0.004, 0], [0.07, 0.012, 0], [0.068, 0.021, 0]], 0.0045, 0.0028, RD, { radial: 6, sub: 2 });
  sweep(Hd, [{ p: [0.0, -0.011, 0], w: 0.011, h: 0.005 }, { p: [0.028, -0.019, 0], w: 0.008, h: 0.004 }, { p: [0.045, -0.021, 0], w: 0.005, h: 0.003 }], BL, { radial: 8, sub: 3 });
  ellip(Hd, '#5a2018', 0.02, -0.008, 0, 0.024, 0.005, 0.008);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) cone(Hd, '#cfc6b0', 0.012 + i * 0.01, -0.0065, s * 0.0065, 0.0014, 0.005, 4).rotation.x = Math.PI;
  for (const s of [-1, 1]) {
    ellip(Hd, OC, 0.008, 0.011, s * 0.012, 0.0055, 0.0045, 0.004);
    ellip(Hd, '#141210', 0.01, 0.011, s * 0.0145, 0.0026, 0.0028, 0.002);
    ellip(Hd, RD, 0.005, 0.018, s * 0.01, 0.01, 0.003, 0.005, 0, 0, 0.2);
    tube(Hd, [[-0.005, 0.015, s * 0.007], [-0.024, 0.033, s * 0.013], [-0.048, 0.042, s * 0.017]], 0.0032, 0.0014, OC, { radial: 5, sub: 3 });
    tube(Hd, [[0.052, 0.0, s * 0.005], [0.066, -0.01, s * 0.018], [0.062, -0.028, s * 0.026]], 0.0009, 0.0006, BL, { radial: 3, sub: 2 });
  }
  for (let k = 0; k < 5; k++) { const t = k / 4; cone(B, RD, 0.408 - t * 0.06, 0.15 - t * 0.085, 0, 0.005, 0.02, 4).rotation.z = 0.9; }
  // the upswept tail with a red fin
  tube(B, [[-0.37, 0.056, 0], [-0.405, 0.075, 0], [-0.43, 0.11, 0], [-0.435, 0.145, 0], [-0.425, 0.168, 0]], 0.011, 0.003, BL, { radial: 8, sub: 4 });
  for (let k = 0; k < 3; k++) cyl(B, RD, -0.41 - k * 0.009, 0.08 + k * 0.025, 0, 0.0095 - k * 0.0018, 0.004, 8);
  for (let k = 0; k < 4; k++) tube(B, [[-0.426, 0.164, 0], [-0.44 - k * 0.004, 0.172 + k * 0.004, (k - 1.5) * 0.004], [-0.458 - k * 0.006, 0.17 + k * 0.012, (k - 1.5) * 0.008]], 0.0028, 0.0008, k % 2 ? OC : RD, { radial: 4, sub: 2 });
  // the reedy bank, a willow and onlookers in wrapped robes
  for (const [rx, rz, n] of [[-0.42, -0.2, 14], [-0.3, -0.24, 12], [0.33, -0.23, 14], [0.42, -0.14, 10], [0.12, -0.24, 8], [-0.44, 0.12, 10], [0.4, 0.22, 10]] as const) reeds(gp, rx, Math.abs(rz) > 0.22 ? 0.06 : W, rz, n, 1, rx * 10);
  willow(gp, -0.3, YB, -0.36, 0.95, 0.35);
  const ON: [number, number, number, string, string?][] = [[-0.16, -0.32, 0.1, '#5a4232'], [-0.09, -0.35, -0.1, '#7a4a3a', 'f'], [0.02, -0.31, 0.05, '#3a3230', 't'], [0.1, -0.36, -0.2, '#6a5a44'], [0.2, -0.33, -0.3, '#4e4a40', 'f'], [0.27, -0.38, 0.0, '#5a4a3a']];
  for (const [ox, oz, ry, c, k] of ON) {
    const f = k === 'f', h = f ? 0.08 : 0.086;
    const r = folk(gp, ox, YB, oz, ry, h, c, {
      hair: f ? '#1a1512' : '#1c1714', hat: f ? undefined : '#1c1a18', hatStyle: f ? undefined : 'knot', bottom: shade(c, 0.85),
      pose: k === 't' ? 'stand' : ox > 0.15 ? 'point' : 'stand', hands: k === 't' ? [[-0.1, 0.5, 0.08], [0.08, 0.98, 0.18]] : undefined,
    });
    if (f) nape(gp, r, ry, h);
    // a red-bordered collar of the 曲裾
    ellip(gp, RD, r.head[0], r.head[1] - 0.1 * h, r.head[2], 0.05 * h, 0.012 * h, 0.05 * h, ry);
  }
  // the bamboo tube of rice tumbling toward the water
  cyl(gp, '#7a7a48', 0.04, 0.13, -0.2, 0.0045, 0.028, 6).rotation.set(0.5, 0, 0.9);
  for (let i = 0; i < 3; i++) cyl(gp, '#5a5a34', 0.04 + (i - 1) * 0.008, 0.136 + (i - 1) * 0.0055, -0.2 + (i - 1) * 0.004, 0.0048, 0.0015, 6).rotation.set(0.5, 0, 0.9);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// MID-AUTUMN 中秋玩月 — Northern Song (《东京梦华录·中秋》: "中秋夜，贵家结饰台榭，民间争占酒楼玩月…是时螯蟹新出，石榴、
// 榅桲、梨、枣、栗、孛萄、弄色枨橘，皆新上市"): a family on the stone terrace of a garden pavilion, a black-lacquer high
// table (Song furniture) with crabs, pomegranates, pears, jujubes and oranges and a qingbai 注子温碗 (ewer in its
// warming bowl); the host in a round-collared robe and long-winged 幞头, his wife in a 褙子 over a skirt, a maid with a
// tray, a flautist by the lotus pond; an osmanthus tree in bloom, a whitewashed garden wall and a pale full moon,
// mirrored in the pond. (Mooncakes only became the festival food in the Ming, so there are none.)
// ---------------------------------------------------------------------------------------------------------
/** Song yoke-back chair (官帽椅 ancestor) facing +z in its own frame. */
function songChair(p: THREE.Object3D, x: number, y: number, z: number, ry: number): void {
  const C = grp(p, x, y, z, ry), c = '#3a2a20';
  box(C, c, 0, 0.04, 0, 0.034, 0.004, 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(C, [sx * 0.015, 0, sz * 0.013], [sx * 0.015, 0.04, sz * 0.013], 0.0016, c, 4);
  for (const sx of [-1, 1]) rod(C, [sx * 0.015, 0.04, -0.013], [sx * 0.015, 0.085, -0.016], 0.0016, c, 4);
  rod(C, [-0.024, 0.086, -0.016], [0.024, 0.086, -0.016], 0.0018, c, 4);
  box(C, c, 0, 0.05, -0.015, 0.012, 0.032, 0.002);
}
const fs_midautumn: Builder = (gp) => {
  const Y = 0.035, PX = 0.22, PZ = 0.22;
  const pond = (x: number, z: number) => Math.hypot((x - PX) / 0.16, (z - PZ) / 0.105);
  const gr = grass('#5e6a46', 26);
  base(gp, 0.5, '#5e6a46', (x, y, z, nx, ny, nz) => (pond(x, z) < 1 ? shade('#2e3a3a', 0.9 + fbm(x * 30, 0, z * 30, 2) * 0.15) : gr(x, y, z, nx, ny, nz)), '#5a4a3a', 0.035, () => 0, 40, 120);
  // whitewashed garden wall with a grey-tiled coping
  box(gp, '#d2ccbe', 0, Y, -0.37, 0.6, 0.11, 0.02);
  gable(gp, 0.62, 0.02, 0.05, '#4a4844', 0, Y + 0.11, -0.37);
  // the stone terrace (台) with a balustrade and front steps
  const TY = Y + 0.03;
  box(gp, '#a29e94', -0.06, Y, -0.07, 0.48, 0.03, 0.3);
  for (let i = 0; i <= 12; i++) {
    const x = -0.295 + i * 0.0475;
    if (x > -0.11 && x < -0.01) continue;
    box(gp, '#b4b0a6', x, TY, 0.074, 0.007, 0.03, 0.007);
    if (i < 12 && !(x + 0.0475 > -0.11 && x < -0.01)) { box(gp, '#b4b0a6', x + 0.024, TY + 0.022, 0.074, 0.0475, 0.005, 0.004); box(gp, '#b4b0a6', x + 0.024, TY + 0.006, 0.074, 0.0475, 0.003, 0.003); }
  }
  for (let k = 0; k < 2; k++) box(gp, '#9a968c', -0.06, Y, 0.09 + k * 0.012 - 0.006, 0.09, 0.02 - k * 0.01, 0.012 + (1 - k) * 0.012);
  // open pavilion (亭) with a hip-gable roof, a painted screen inside and a lantern at the eave
  const P = grp(gp, -0.15, TY, -0.15);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl(P, '#9a968c', sx * 0.1, 0, sz * 0.065, 0.008, 0.006, 8); cyl(P, '#5a2e24', sx * 0.1, 0.006, sz * 0.065, 0.0055, 0.15, 8); }
  box(P, '#4a3a2e', 0, 0.145, 0, 0.21, 0.012, 0.142);
  cnRoof(P, 0, 0.156, 0, 0.29, 0.21, 0.075, '#4a4844');
  for (let k = 0; k < 3; k++) {
    box(P, '#3a2a20', -0.06 + k * 0.06, 0, -0.05, 0.058, 0.1, 0.006);
    box(P, '#d8d0bc', -0.06 + k * 0.06, 0.012, -0.0465, 0.05, 0.08, 0.001);
    // ink-wash hills painted on the panel
    const S = grp(P, -0.06 + k * 0.06, 0.03, -0.0462);
    slab(S, [[-0.024, 0], [-0.014, 0.012 + k * 0.004], [-0.006, 0.006], [0.004, 0.022 - k * 0.003], [0.014, 0.008], [0.024, 0.004], [0.024, 0]], 0.0004, '#9a9c90', 0, true);
    slab(S, [[-0.024, 0], [-0.01, 0.005], [0.002, 0.009], [0.016, 0.004], [0.024, 0.006], [0.024, 0]], 0.0004, '#7e8276', 0, true);
  }
  silkLamp(P, 0.1, 0.145, 0.065, 0.009);
  // the high table with the autumn fruit, crabs and the ewer in its warming bowl
  const T = grp(gp, -0.03, TY, -0.02);
  box(T, '#2a2420', 0, 0.044, 0, 0.1, 0.005, 0.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(T, [sx * 0.045, 0, sz * 0.025], [sx * 0.045, 0.044, sz * 0.025], 0.0022, '#2a2420', 4);
  const ty = 0.049, plate = (x: number, z: number) => cyl(T, '#8e9c86', x, ty, z, 0.013, 0.002, 12);
  plate(-0.03, 0.012);
  for (const [cx, cz, r] of [[-0.034, 0.008, 0.3], [-0.025, 0.017, -0.5]] as const) {
    const Cr = grp(T, cx, ty + 0.003, cz, r);
    ellip(Cr, '#a0503a', 0, 0, 0, 0.0065, 0.0022, 0.005);
    for (const s of [-1, 1]) for (let l = 0; l < 3; l++) rod(Cr, [s * 0.004, 0, -0.002 + l * 0.002], [s * 0.009, -0.002, -0.003 + l * 0.003], 0.0006, '#a0503a', 3);
    for (const s of [-1, 1]) ellip(Cr, '#a8583e', s * 0.004, 0, 0.007, 0.0018, 0.0012, 0.0026);
  }
  plate(0.012, -0.012);
  for (let i = 0; i < 4; i++) dot(T, '#8a3a2e', 0.006 + (i % 2) * 0.01, ty + 0.006 + (i > 1 ? 0.006 : 0), -0.015 + (i >> 1) * 0.004 + (i % 2) * 0.002, 0.0055, 7);
  plate(0.034, 0.014);
  for (let i = 0; i < 3; i++) ellip(T, '#c4b070', 0.03 + (i - 1) * 0.008, ty + 0.007, 0.014 + (i % 2) * 0.005, 0.0042, 0.006, 0.0042);
  for (let i = 0; i < 3; i++) dot(T, '#c8842e', 0.022 + i * 0.008, ty + 0.005, -0.016, 0.0046, 7);
  for (let i = 0; i < 7; i++) ellip(T, '#6a2a1e', -0.008 + hash3(i, 1, 1) * 0.016, ty + 0.0035, 0.018 + hash3(i, 2, 2) * 0.008, 0.0026, 0.0018, 0.0018);
  const E = grp(T, -0.04, ty, -0.016);
  lathe(E, [[0.001, 0], [0.008, 0.001], [0.012, 0.008], [0.0125, 0.013]], '#b8c8c0', 0, 0, 0, 12);
  lathe(E, [[0.001, 0.004], [0.0075, 0.008], [0.0085, 0.018], [0.004, 0.026], [0.0032, 0.03], [0.0045, 0.033], [0.001, 0.036]], '#c4d2ca', 0, 0, 0, 12);
  tube(E, [[0.007, 0.014, 0], [0.012, 0.022, 0], [0.015, 0.03, 0]], 0.0014, 0.0009, '#c4d2ca', { radial: 4, sub: 2 });
  tube(E, [[-0.007, 0.012, 0], [-0.012, 0.022, 0], [-0.005, 0.029, 0]], 0.001, 0.001, '#c4d2ca', { radial: 4, sub: 3 });
  for (const [ux, uz] of [[0.0, 0.018], [0.045, -0.018]]) lathe(T, [[0.001, 0], [0.003, 0], [0.0055, 0.006]], '#c4d2ca', ux, ty, uz, 8);
  // the host and his wife on chairs, turned toward the moon and the pond
  const h = 0.1, seat = TY + 0.044 - 0.27 * h;
  songChair(gp, -0.1, TY, -0.04, 0.6);
  const ho = folk(gp, -0.1, seat, -0.04, 0.6, h, '#4a5262', { pose: 'sit', hands: [[-0.09, 0.32, 0.2], [0.1, 0.5, 0.28]] });
  futou(gp, ho, 0.6, h, true);
  ellip(gp, '#1c1714', ho.head[0] + Math.sin(0.6) * 0.05 * h, ho.head[1] - 0.06 * h, ho.head[2] + Math.cos(0.6) * 0.05 * h, 0.012 * h, 0.03 * h, 0.01 * h, 0.6);
  songChair(gp, 0.04, TY, -0.1, 0.2);
  const wf = folk(gp, 0.04, seat, -0.1, 0.2, 0.094, '#8a7a66', { pose: 'sit', bottom: '#4a4e5a', hair: '#1a1512', hands: [[-0.04, 0.36, 0.22], [0.04, 0.37, 0.22]] });
  bun(gp, wf, 0.2, 0.094);
  // 褙子: the long open-fronted over-jacket, trimmed at the edges
  for (const s of [-1, 1]) ellip(gp, '#5a4a3e', wf.head[0] + s * 0.012 * Math.cos(0.2), wf.head[1] - 0.24 * 0.094, wf.head[2] + 0.034 + s * -0.012 * Math.sin(0.2), 0.004, 0.035, 0.003, 0.2);
  const md = folk(gp, 0.1, TY, 0.01, -0.6, 0.095, '#6a6a58', { bottom: '#5a5448', hair: '#1a1512', hands: [[-0.06, 0.6, 0.22], [0.06, 0.6, 0.22]] });
  bun(gp, md, -0.6, 0.095);
  const tr = [(md.handL[0] + md.handR[0]) / 2, (md.handL[1] + md.handR[1]) / 2, (md.handL[2] + md.handR[2]) / 2];
  box(gp, '#3a2a20', tr[0], tr[1] - 0.002, tr[2], 0.04, 0.003, 0.028, -0.6);
  lathe(gp, [[0.001, 0], [0.004, 0], [0.006, 0.006]], '#c4d2ca', tr[0], tr[1] + 0.001, tr[2], 8);
  // osmanthus (桂) in bloom and a lake rock
  const OX = -0.37, OZ = 0.15;
  tube(gp, [[OX, Y, OZ], [OX + 0.01, Y + 0.08, OZ], [OX + 0.02, Y + 0.15, OZ - 0.01]], 0.012, 0.006, '#4a3a2c', { radial: 6, sub: 3 });
  rod(gp, [OX + 0.008, Y + 0.08, OZ], [OX - 0.04, Y + 0.16, OZ + 0.02], 0.004, '#4a3a2c', 5);
  const CL: [number, number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, rr = 0.012 + hash3(i, 1, 7) * 0.05, dy = 0.15 + hash3(i, 2, 7) * 0.11;
    CL.push([0.01 + Math.cos(a) * rr * (1.3 - (dy - 0.15) * 4), dy, Math.sin(a) * rr * (1.3 - (dy - 0.15) * 4), 0.026 + hash3(i, 3, 7) * 0.016]);
  }
  CL.forEach(([dx, dy, dz, r], i) => {
    ellip(gp, ['#3e4c34', '#46553a', '#36442e'][i % 3], OX + dx, Y + dy, OZ + dz, r, r * 0.75, r, i);
    for (let j = 0; j < 8; j++) {
      const a = hash3(i, j, 1) * TAU, e = (hash3(j, i, 2) - 0.3) * 1.4;
      dot(gp, '#c8b070', OX + dx + Math.cos(a) * Math.cos(e) * r * 0.96, Y + dy + Math.sin(e) * r * 0.74, OZ + dz + Math.sin(a) * Math.cos(e) * r * 0.96, 0.0018, 4);
    }
  });
  // a tall pierced Taihu rock (太湖石) on a low stone base
  box(gp, '#7a776e', -0.25, Y, 0.21, 0.05, 0.008, 0.035);
  const rock = g('fs-rock', () => new THREE.IcosahedronGeometry(1, 0));
  for (let i = 0; i < 7; i++) {
    const t = i / 6, w = 0.024 - t * 0.01 + (i % 2) * 0.004;
    add(gp, rock, mat(i % 3 ? '#8e8b82' : '#86837a'), -0.25 + Math.sin(i * 2.1) * 0.008, Y + 0.016 + i * 0.019, 0.21 + Math.cos(i * 1.7) * 0.004, w, 0.016, w * 0.7, i * 1.3, 0.2 * Math.sin(i), 0.3 * Math.cos(i * 1.9));
  }
  for (const [dx, dy] of [[0.006, 0.045], [-0.006, 0.08], [0.004, 0.105], [-0.01, 0.03]] as const) ellipL(gp, '#3e3c36', -0.25 + dx, Y + dy, 0.224, 0.004, 0.005, 0.003);
  // the lotus pond: stone rim, autumn leaves, the moon's reflection and a flautist on the bank
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU, x = PX + Math.cos(a) * 0.175, z = PZ + Math.sin(a) * 0.115;
    if (Math.hypot(x, z) > 0.47) continue;
    ellipL(gp, ['#8a867c', '#7a766c', '#96928a'][i % 3], x, Y + 0.004, z, 0.016, 0.008, 0.012, a);
  }
  for (let i = 0; i < 7; i++) {
    const lx = PX - 0.1 + hash3(i, 3, 3) * 0.2, lz = PZ - 0.06 + hash3(i, 4, 4) * 0.12;
    if (pond(lx, lz) > 0.85 || Math.hypot(lx - PX - 0.03, lz - PZ + 0.02) < 0.04) continue;
    cyl(gp, i % 3 ? '#4e5a38' : '#7a6a44', lx, Y + 0.001, lz, 0.012 + hash3(i, 5, 5) * 0.006, 0.0015, 9);
  }
  glow(ellip(gp, '#d8d4c0', PX + 0.03, Y + 0.001, PZ - 0.02, 0.026, 0.0006, 0.016), '#d8d4c0', '#8a8468');
  for (let i = 0; i < 3; i++) glow(ellip(gp, '#c8c4b0', PX + 0.03 + (i - 1) * 0.006, Y + 0.0012, PZ + 0.008 + i * 0.008, 0.016 - i * 0.004, 0.0005, 0.002), '#c8c4b0', '#6a6650');
  const fl = folk(gp, 0.17, Y, 0.38, 2.6, 0.098, '#5a5a48', { bottom: '#4a4a3e', pose: 'stand', hands: [[-0.06, 0.86, 0.12], [0.14, 0.86, 0.12]] });
  futou(gp, fl, 2.6, 0.098);
  { const a = fl.handL, b = fl.handR, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; rod(gp, [a[0] - d[0] * 0.3, a[1] - d[1] * 0.3, a[2] - d[2] * 0.3], [b[0] + d[0] * 0.3, b[1] + d[1] * 0.3, b[2] + d[2] * 0.3], 0.0013, '#8a7a4a', 5); }
  // a pale full moon low over the wall
  const M = grp(gp, 0.28, 0.42, -0.36);
  M.rotation.x = -0.25;
  const disc = cyl(M, '#e4dec8', 0, 0, 0, 0.048, 0.004, 32);
  disc.rotation.x = Math.PI / 2;
  glow(disc, '#e4dec8', '#9a9478');
  // faint maria, irregular and low-contrast
  for (const [mx, my, mr, sx] of [[-0.014, 0.012, 0.012, 1.4], [0.012, 0.016, 0.008, 1.2], [0.006, -0.01, 0.01, 1.6], [-0.02, -0.014, 0.006, 1]] as const) {
    const c2 = cyl(M, '#d8d2bc', mx, my - 0.002, 0.003, mr, 0.0015, 12);
    c2.rotation.x = Math.PI / 2;
    c2.scale.x *= sx;
    glow(c2, '#d8d2bc', '#908a70');
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// HARBIN ICE AND SNOW — a castle sawn from Songhua River ice: stepped tiers of glowing blue-white blocks
// (running bond with dark joints), lilac/green/pink-lit corner towers with spires, an arched ice gate and
// crenellations, plus a long ice slide, a snowman and bundled-up visitors on the trampled snow.
// ---------------------------------------------------------------------------------------------------------
const ICE: [string, string][] = [['#e6f8ff', '#3aa0e8'], ['#c4ecff', '#1f7fd6'], ['#e4dcff', '#7c4ee6'], ['#d4fff0', '#18b07a'], ['#ffe0f0', '#e0559b']];
const iceMat = (k: number) => mat(ICE[k][0], { emissive: ICE[k][1], transparent: 0.86 });
/** Rectangular ring of ice blocks (w×d footprint, rows of height bh) with running-bond joints. */
function iceTier(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, rows: number, bh: number, tint: number, seed: number): void {
  const geo = g('fs-iceblock', () => new THREE.BoxGeometry(1, 1, 1));
  const bw = 0.05, gap = 0.004;
  for (let r = 0; r < rows; r++) {
    const yy = y + r * bh + bh / 2;
    for (const [len, ox, oz, alongX] of [[w, 0, d / 2, true], [w, 0, -d / 2, true], [d, w / 2, 0, false], [d, -w / 2, 0, false]] as const) {
      const n = Math.max(1, Math.round(len / bw)), seg = len / n, off = (r % 2) * seg * 0.5;
      for (let i = 0; i < n; i++) {
        let a = -len / 2 + i * seg + off, b = a + seg;
        if (a < -len / 2) a = -len / 2;
        b = Math.min(b, len / 2);
        const L = b - a - gap, c = (a + b) / 2;
        const k = hash3(i + seed, r, oz * 100 + ox * 37) > 0.82 ? tint : hash3(i, r, seed) > 0.5 ? 0 : 1;
        if (alongX) add(p, geo, iceMat(k), x + c, yy, z + oz, L, bh - gap, 0.03);
        else add(p, geo, iceMat(k), x + ox, yy, z + c, 0.03, bh - gap, L);
      }
    }
  }
  add(p, geo, mat('#7cc4f5', { emissive: '#2a7bd4' }), x, y + (rows * bh) / 2, z, w - 0.02, rows * bh, d - 0.02);
}
function iceTower(p: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, tint: number, spire: number): void {
  const rows = Math.round(h / 0.03);
  for (let i = 0; i < rows; i++) add(p, CYLG(10), iceMat(i % 3 === 2 ? tint : i % 2), x, y + i * 0.03 + 0.0145, z, r * 2, 0.027, r * 2, i * 0.3);
  add(p, CYLG(10), mat('#7cc4f5', { emissive: '#2a7bd4' }), x, y + h / 2, z, r * 1.9, h, r * 1.9);
  add(p, CYLG(10), iceMat(tint), x, y + h + 0.008, z, r * 2.5, 0.016, r * 2.5);
  add(p, g('fs-cone10', () => new THREE.ConeGeometry(0.5, 1, 10)), iceMat(tint), x, y + h + 0.016 + spire / 2, z, r * 2.1, spire, r * 2.1);
  dotE(p, '#fff7cc', '#ffcf4a', x, y + h + 0.02 + spire, z, r * 0.3, 6);
}
const CYLG = (s: number) => g('fs-cyl' + s, () => new THREE.CylinderGeometry(0.5, 0.5, 1, s));
const fs_harbin: Builder = (gp) => {
  plaza(gp, 0.5, 0.035, 40, (x, _y, z) => shade('#eef4fb', 0.9 + fbm(x * 18, 0, z * 18, 2) * 0.12 + (Math.abs(x) < 0.08 && z > 0.05 ? -0.06 : 0)), '#8aa3bf');
  const Y = 0.035;
  const C = grp(gp, 0, Y, -0.1);
  iceTier(C, 0, 0, 0, 0.5, 0.32, 3, 0.03, 0, 1);
  // crenellations on the base wall
  for (let i = 0; i < 11; i++) for (const sz of [-1, 1]) add(C, BOXG(), iceMat(i % 2), -0.225 + i * 0.045, 0.098, sz * 0.16, 0.022, 0.016, 0.03);
  iceTier(C, 0, 0.09, -0.02, 0.3, 0.22, 5, 0.03, 2, 2);
  iceTier(C, 0, 0.24, -0.02, 0.18, 0.14, 4, 0.03, 3, 3);
  iceTower(C, 0, 0.36, -0.02, 0.05, 0.09, 3, 0.17);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) iceTower(C, sx * 0.25, 0, sz * 0.16, 0.042, 0.17, sz > 0 ? 2 : 3, 0.1);
  for (const sx of [-1, 1]) iceTower(C, sx * 0.15, 0.09, 0.09, 0.034, 0.16, 4, 0.09);
  // arched gate with warm glow
  add(C, BOXG(), mat('#ffd98a', { emissive: '#f59e0b' }), 0, 0.045, 0.162, 0.07, 0.07, 0.006);
  add(C, CYLG(16), mat('#ffd98a', { emissive: '#f59e0b' }), 0, 0.08, 0.162, 0.07, 0.006, 0.07, 0, Math.PI / 2);
  for (const sx of [-1, 1]) add(C, BOXG(), iceMat(2), sx * 0.045, 0.06, 0.17, 0.016, 0.12, 0.02);
  add(C, BOXG(), iceMat(2), 0, 0.125, 0.17, 0.11, 0.016, 0.02);
  // glowing windows on the tiers
  for (let i = 0; i < 4; i++) add(C, BOXG(), mat('#fff1c1', { emissive: '#fbbf24' }), -0.09 + i * 0.06, 0.16, 0.093, 0.016, 0.03, 0.004);
  for (let i = 0; i < 2; i++) add(C, BOXG(), mat('#ffe0f0', { emissive: '#ec4899' }), -0.03 + i * 0.06, 0.3, 0.053, 0.014, 0.028, 0.004);
  // ice slide down to the right
  const S = grp(gp, 0.32, Y, 0.12, -0.3);
  const ramp = add(S, BOXG(), iceMat(1), 0, 0.09, 0, 0.06, 0.012, 0.3, 0, 0.55);
  ramp.position.set(0, 0.075, 0);
  for (const sx of [-1, 1]) add(S, BOXG(), iceMat(0), sx * 0.032, 0.085, 0, 0.008, 0.03, 0.3, 0, 0.55);
  add(S, BOXG(), iceMat(1), 0, 0.08, -0.15, 0.08, 0.16, 0.06);
  kid(S, 0, 0.08, 0.03, 0, { shirt: '#ef4444', pants: '#1e3a8a', sit: true, hands: UP, hat: (f) => { cone(f, '#facc15', 0, 0.1, -0.002, 0.022, 0.03, 10); dot(f, '#ffffff', 0, 0.132, -0.002, 0.007, 6); } }, 0.8);
  // snowman
  const SM = grp(gp, -0.3, Y, 0.2, 0.4);
  ellip(SM, '#ffffff', 0, 0.04, 0, 0.05, 0.045, 0.05);
  ellip(SM, '#ffffff', 0, 0.11, 0, 0.036, 0.034, 0.036);
  ellip(SM, '#ffffff', 0, 0.165, 0, 0.026, 0.025, 0.026);
  cone(SM, '#f97316', 0, 0.163, 0.035, 0.005, 0.022, 6).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) dot(SM, '#111827', sx * 0.009, 0.173, 0.022, 0.004, 6);
  for (let k = 0; k < 3; k++) dot(SM, '#111827', 0, 0.09 + k * 0.018, 0.035 - Math.abs(k - 1) * 0.003, 0.004, 6);
  cyl(SM, '#dc2626', 0, 0.135, 0, 0.03, 0.01, 12);
  box(SM, '#dc2626', 0.015, 0.1, 0.024, 0.012, 0.035, 0.006, 0, 0.1);
  cyl(SM, '#111827', 0, 0.186, 0, 0.026, 0.004, 12);
  cyl(SM, '#111827', 0, 0.19, 0, 0.017, 0.03, 12);
  for (const sx of [-1, 1]) rod(SM, [sx * 0.032, 0.115, 0], [sx * 0.07, 0.15, 0.005], 0.0025, '#6b4a33');
  // visitors in puffy coats and bobble hats
  const hatOf = (c: string) => (f: THREE.Group) => { ellip(f, c, 0, 0.115, -0.002, 0.021, 0.014, 0.02); dot(f, '#ffffff', 0, 0.13, -0.002, 0.007, 6); };
  kid(gp, -0.12, Y, 0.3, 0.3, { shirt: '#2563eb', pants: '#1f2937', hat: hatOf('#ef4444'), hands: FWD }, 1.05);
  kid(gp, 0.06, Y, 0.34, -0.2, { shirt: '#f97316', pants: '#334155', hat: hatOf('#22c55e'), hands: UP }, 0.95);
  kid(gp, -0.4, Y, -0.05, 0.9, { shirt: '#be185d', pants: '#1f2937', hat: hatOf('#facc15') }, 0.95);
  fuse(gp);
};
const BOXG = () => g('fs-iceblock', () => new THREE.BoxGeometry(1, 1, 1));

// ---------------------------------------------------------------------------------------------------------
// RIO CARNIVAL — the Sambadrome runway between packed stands: a towering float with a giant golden macaw
// spreading a rainbow feather fan above sequinned tiers of dancers, led by passistas in huge feather
// back-pieces, a flag-bearer couple and a white-clad drum section.
// ---------------------------------------------------------------------------------------------------------
/** Fan of feathers in the local XY plane (facing +z), centred at (x,y,z), spanning ±spread radians from up. */
function featherFan(p: THREE.Object3D, x: number, y: number, z: number, R: number, n: number, cols: string[], ry = 0, spread = 1.3, w = 0.012): THREE.Group {
  const f = grp(p, x, y, z, ry);
  for (let i = 0; i < n; i++) {
    const a = -spread + (i / Math.max(1, n - 1)) * spread * 2, c = cols[i % cols.length];
    const L = R * (0.85 + 0.15 * Math.cos(a * 1.5));
    ellipL(f, c, Math.sin(a) * L * 0.5, Math.cos(a) * L * 0.5, -Math.abs(a) * 0.004, w * (R / 0.12), L * 0.5, 0.003, 0, 0, -a);
    dot(f, shade(c, 1.2), Math.sin(a) * L * 0.92, Math.cos(a) * L * 0.92, 0.002, w * 0.7 * (R / 0.12), 6);
  }
  return f;
}
const fs_rio: Builder = (gp) => {
  const crowd = (x: number, y: number, z: number) => ['#f43f5e', '#facc15', '#22c55e', '#3b82f6', '#f97316', '#ffffff', '#a855f7', '#0ea5e9'][Math.floor(hash3(Math.floor(x * 70), Math.floor(y * 70), Math.floor(z * 70)) * 8)];
  plaza(gp, 0.5, 0.035, 40, (x, _y, z) => (Math.abs(z - 0.04) < 0.003 + 0.01 && Math.floor(x * 20) % 2 ? '#f8fafc' : z < -0.22 ? '#9ca3af' : shade('#6b7280', 0.92 + hash3(Math.floor(x * 40), 0, Math.floor(z * 40)) * 0.1)), '#4b5563');
  const Y = 0.035;
  // stands at the back: stepped concrete with a confetti crowd
  for (let s = 0; s < 3; s++) {
    const geo = new THREE.BoxGeometry(0.86 - s * 0.06, 0.05, 0.06, 24, 2, 1);
    geo.translate(0, 0.025, 0);
    add(gp, paintFaces(geo, '#9ca3af', (x, y, z, _nx, ny) => (ny > 0.5 || y > 0.03 ? crowd(x, y + s, z) : '#9ca3af')), mat('#ffffff', { vc: true, flat: true }), 0, Y + s * 0.05, -0.31 - s * 0.055, 1, 1, 1);
  }
  // the float
  const F = grp(gp, -0.02, Y, -0.05);
  rbox(F, '#1e293b', 0, 0.0, 0, 0.5, 0.03, 0.2, 0.01);
  const skirt = new THREE.BoxGeometry(0.52, 0.05, 0.22, 26, 2, 10);
  skirt.translate(0, 0.055, 0);
  add(F, paintFaces(skirt, '#f5b301', (x, y) => (Math.floor(x * 50 + y * 40) % 3 === 0 ? '#16a34a' : Math.floor(x * 50 - y * 40) % 4 === 0 ? '#fde047' : '#e8a00c')), mat('#ffffff', { vc: true, flat: true, metal: 0.4 }), 0, 0, 0, 1, 1, 1);
  rbox(F, '#22c55e', 0, 0.08, -0.02, 0.36, 0.04, 0.16, 0.012);
  rbox(F, '#facc15', 0, 0.12, -0.03, 0.22, 0.04, 0.12, 0.012);
  // giant golden macaw with rainbow fan
  const BIRD = grp(F, 0, 0.16, -0.04);
  featherFan(BIRD, 0, 0.05, -0.03, 0.34, 15, ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'], 0, 1.45, 0.016);
  pblob(BIRD, '#f5b301', 0, 0.09, 0.0, 0.07, 0.09, 0.06, (_x, y) => (y > 0.13 ? '#dc2626' : '#f5b301'), [0, 0, 0], 16);
  ellip(BIRD, '#dc2626', 0, 0.2, 0.02, 0.045, 0.045, 0.045);
  ellip(BIRD, '#ffffff', 0, 0.2, 0.05, 0.03, 0.022, 0.012);
  for (const sx of [-1, 1]) { dot(BIRD, '#111827', sx * 0.022, 0.21, 0.052, 0.007, 6); }
  ellip(BIRD, '#1f2937', 0, 0.185, 0.07, 0.016, 0.024, 0.016, 0, 0.6, 0);
  for (let k = 0; k < 5; k++) ellip(BIRD, ['#facc15', '#ef4444', '#22c55e'][k % 3], -0.02 + k * 0.01, 0.255 + Math.sin(k) * 0.005, 0.0, 0.006, 0.03, 0.004, 0, -0.3, (k - 2) * 0.25);
  for (const sx of [-1, 1]) featherFan(BIRD, sx * 0.07, 0.1, 0.0, 0.14, 6, ['#3b82f6', '#22c55e', '#facc15'], sx * 0.3, 0.6).rotation.z = -sx * 1.0;
  // dancers on the float tiers
  for (let i = 0; i < 4; i++) {
    const dx = -0.2 + i * 0.133 + (i > 1 ? 0.0 : 0), dz = 0.06;
    const d = kid(F, i < 2 ? dx : dx + 0.01, 0.12, dz, 0, { shirt: ['#ec4899', '#facc15', '#22c55e', '#06b6d4'][i], pants: '#f5b301', hands: UP }, 0.75);
    featherFan(d, 0, 0.12, -0.02, 0.06, 7, ['#ffffff', '#fde047'], 0, 1.1, 0.008);
  }
  // passistas with big feather back-pieces on the runway
  const PAS: [number, number, string, string[]][] = [[-0.26, 0.25, '#ec4899', ['#f472b6', '#fde047', '#ffffff']], [0.02, 0.3, '#facc15', ['#22c55e', '#facc15', '#ffffff']], [0.28, 0.24, '#06b6d4', ['#3b82f6', '#a855f7', '#ffffff']]];
  for (const [px, pz, c, fc] of PAS) {
    const d = kid(gp, px, Y, pz, -0.15 + px * 0.5, { shirt: c, pants: '#f5d0b5', skin: '#b9805a', hands: [[-0.04, 0.12, 0.01], [0.04, 0.09, 0.02]] }, 1.15);
    featherFan(d, 0, 0.07, -0.025, 0.12, 13, fc, 0, 1.35, 0.01);
    for (let k = 0; k < 5; k++) ellipL(d, fc[k % fc.length], -0.016 + k * 0.008, 0.13, -0.002, 0.004, 0.025, 0.003, 0, -0.2, (k - 2) * 0.2);
  }
  // drum section (bateria) in white with bass drums
  for (let i = 0; i < 3; i++) {
    const bx = -0.35 + i * 0.07, bz = 0.38 - i * 0.03;
    kid(gp, bx, Y, bz, 0.6, { shirt: '#f8fafc', pants: '#f8fafc', hands: FWD, hat: (f) => cyl(f, '#f8fafc', 0, 0.115, -0.002, 0.02, 0.012, 10) }, 0.9);
    const dr = cyl(gp, '#94a3b8', bx + 0.022, Y + 0.05, bz + 0.026, 0.02, 0.03, 12); dr.rotation.z = Math.PI / 2; dr.position.set(bx + 0.025, Y + 0.06, bz + 0.03);
  }
  // flag-bearer with the school flag
  kid(gp, 0.38, Y, 0.06, -0.6, { shirt: '#22c55e', dress: true, hands: [[-0.02, 0.07, 0.03], [0.03, 0.13, 0.01]] }, 1.0);
  rod(gp, [0.4, Y + 0.05, 0.07], [0.42, Y + 0.3, 0.07], 0.003, '#d4d4d8');
  slab(grp(gp, 0.42, Y + 0.24, 0.07, -0.6), [[0, 0], [0.11, 0.0], [0.11, 0.065], [0, 0.065]], 0.003, '#16a34a', 0, false);
  ellip(gp, '#facc15', 0.42 + 0.05 * Math.cos(-0.6), Y + 0.272, 0.07 - 0.05 * Math.sin(-0.6) + 0.003, 0.025, 0.017, 0.002, -0.6);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// VENICE CARNIVAL — a canal-side scene: pink Gothic palazzo with pointed white-trimmed windows and a balcony,
// striped mooring poles, a black gondola with silver ferro and a gondolier in a striped shirt and straw hat;
// on the quay, costumed revellers in capes, tricorns and gold-and-white masks, plus a mask-seller's stand.
// ---------------------------------------------------------------------------------------------------------
function mask(p: THREE.Object3D, x: number, y: number, z: number, s: number, face: string, trim: string, plume: string[] = [], ry = 0): THREE.Group {
  const f = grp(p, x, y, z, ry, s);
  ellip(f, face, 0, 0, 0, 0.024, 0.026, 0.009);
  ellip(f, trim, 0, 0.012, 0.004, 0.026, 0.008, 0.008);
  for (const sx of [-1, 1]) { ellip(f, '#111827', sx * 0.009, 0.004, 0.008, 0.006, 0.0035, 0.002, 0, 0, sx * 0.3); ellip(f, trim, sx * 0.013, -0.012, 0.007, 0.004, 0.004, 0.002); }
  ellip(f, '#be123c', 0, -0.016, 0.008, 0.005, 0.0025, 0.002);
  plume.forEach((c, i) => ellip(f, c, -0.012 + i * 0.012, 0.035, -0.004, 0.006, 0.024, 0.003, 0, -0.2, (1 - i) * 0.35));
  return f;
}
function masker(p: THREE.Object3D, x: number, y: number, z: number, ry: number, cape: string, face: string, trim: string, hat: 'tricorn' | 'plume', plume: string[]): void {
  const f = grp(p, x, y, z, ry);
  cone(f, cape, 0, 0, 0, 0.042, 0.09, 12);
  ellip(f, shade(cape, 1.15), 0, 0.085, 0, 0.026, 0.016, 0.02);
  cyl(f, '#f8fafc', 0, 0.094, 0, 0.022, 0.006, 12);
  ellip(f, '#f1c7a3', 0, 0.118, 0, 0.019, 0.021, 0.018);
  mask(f, 0, 0.12, 0.016, 0.8, face, trim);
  if (hat === 'tricorn') {
    add(f, g('fs-tri', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 3)), mat('#111827'), 0, 0.137, -0.002, 0.06, 0.012, 0.06, Math.PI);
    ellip(f, '#111827', 0, 0.142, -0.002, 0.016, 0.01, 0.016);
  } else {
    ellip(f, trim, 0, 0.138, -0.002, 0.021, 0.012, 0.02);
    plume.forEach((c, i) => ellip(f, c, -0.012 + i * 0.012, 0.165, -0.01, 0.006, 0.028, 0.004, 0, -0.3, (1 - i) * 0.4));
  }
  for (const sx of [-1, 1]) {
    rod(f, [sx * 0.024, 0.08, 0], [sx * 0.035, 0.05, 0.02], 0.006, cape, 6);
    dot(f, '#f8fafc', sx * 0.036, 0.048, 0.022, 0.007, 6);
  }
  for (let k = 0; k < 5; k++) dot(f, trim, Math.sin(k * 1.3) * 0.03, 0.01 + k * 0.014, Math.cos(k * 1.3) * 0.03 + 0.012, 0.0035, 6);
}
const fs_venice: Builder = (gp) => {
  const water = ripple('#3a8a8c'), st = stones('#c9bfae', 1 / 24, 0.22);
  plaza(gp, 0.5, 0.035, 48, (x, y, z, nx, ny, nz) => (z > 0.02 ? water(x, y, z, nx, ny, nz) : st(x, y, z, nx, ny, nz)), '#6b5a48');
  const Y = 0.035;
  // quay edge
  box(gp, '#e7e0d2', 0, Y, 0.018, 0.96, 0.008, 0.02);
  // palazzo facade at the back
  const Pz = grp(gp, 0, Y, -0.36);
  box(Pz, '#e9a8a0', 0, 0, 0, 0.76, 0.42, 0.12);
  box(Pz, '#f3eee4', 0, 0.42, 0, 0.8, 0.02, 0.14);
  for (let fl = 0; fl < 3; fl++) box(Pz, '#f3eee4', 0, 0.13 + fl * 0.13, 0.062, 0.76, 0.008, 0.008);
  const winRow = (yy: number, n: number, w: number, hgt: number, x0: number, dx: number) => {
    for (let i = 0; i < n; i++) {
      const wx = x0 + i * dx;
      box(Pz, '#1f2937', wx, yy, 0.061, w, hgt, 0.004);
      add(Pz, g('fs-ptarch', () => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.quadraticCurveTo(-0.5, 0.6, 0, 1); s.quadraticCurveTo(0.5, 0.6, 0.5, 0); s.lineTo(-0.5, 0); const e = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 }); e.translate(0, 0, -0.5); return e; }),
        mat('#1f2937'), wx, yy + hgt, 0.061, w, w * 0.9, 0.004);
      box(Pz, '#f8fafc', wx, yy - 0.006, 0.064, w + 0.012, 0.006, 0.01);
      for (const sx of [-1, 1]) box(Pz, '#f8fafc', wx + sx * (w / 2 + 0.003), yy, 0.064, 0.005, hgt + 0.01, 0.006);
    }
  };
  winRow(0.03, 5, 0.06, 0.07, -0.28, 0.14);
  winRow(0.16, 6, 0.045, 0.07, -0.3, 0.12);
  winRow(0.29, 6, 0.045, 0.07, -0.3, 0.12);
  // central balcony with arcade
  box(Pz, '#f8fafc', 0, 0.15, 0.08, 0.28, 0.01, 0.04);
  for (let i = 0; i < 9; i++) cyl(Pz, '#f8fafc', -0.13 + i * 0.0325, 0.16, 0.097, 0.004, 0.03, 6);
  box(Pz, '#f8fafc', 0, 0.19, 0.097, 0.28, 0.006, 0.008);
  // giant gilded carnival mask hung on the facade
  rbox(Pz, '#7c2d12', 0, 0.225, 0.066, 0.2, 0.15, 0.01, 0.01);
  mask(Pz, 0, 0.29, 0.085, 3.4, '#fbbf24', '#dc2626', ['#7c3aed', '#16a34a', '#dc2626']);
  // carnival bunting across the facade
  for (let i = 0; i < 12; i++) {
    const t = i / 11, bx = -0.36 + t * 0.72, by = 0.4 - Math.sin(t * Math.PI) * 0.04;
    slab(grp(Pz, bx, by, 0.075), [[-0.018, 0], [0.018, 0], [0, -0.032]], 0.002, ['#dc2626', '#facc15', '#16a34a', '#7c3aed'][i % 4], 0, false);
  }
  // striped mooring poles (paline)
  for (const [px, pz] of [[0.34, 0.12], [0.4, 0.06], [-0.4, 0.14]] as const) {
    for (let k = 0; k < 6; k++) cyl(gp, k % 2 ? '#2563eb' : '#f8fafc', px, Y - 0.005 + k * 0.035, pz, 0.008, 0.035, 8);
    cone(gp, '#facc15', px, Y + 0.205, pz, 0.01, 0.02, 8);
  }
  // gondola
  const G = grp(gp, 0.0, Y, 0.27, 0.08);
  const hull: V3[][] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = -0.36 + t * 0.7, e = Math.abs(t - 0.5) * 2;
    const wv = 0.05 * (1 - Math.pow(e, 2.2)) + 0.003, top = 0.03 + Math.pow(e, 3) * 0.08 * (t > 0.5 ? 1.1 : 0.8), bot = 0.0 + Math.pow(e, 3) * 0.05;
    hull.push([[x, top, -wv], [x, (top + bot) / 2, -wv * 1.05], [x, bot, -wv * 0.6], [x, bot - 0.004, 0], [x, bot, wv * 0.6], [x, (top + bot) / 2, wv * 1.05], [x, top, wv]]);
  }
  sheet(G, hull, '#111827', (_x, y) => (y > 0.026 ? '#1f2937' : '#0b0f19'));
  box(G, '#3b2314', -0.02, 0.022, 0, 0.42, 0.006, 0.085);
  rbox(G, '#b91c1c', -0.02, 0.026, 0, 0.1, 0.028, 0.07, 0.01);
  rbox(G, '#7f1d1d', -0.02, 0.05, -0.028, 0.1, 0.03, 0.014, 0.006);
  for (const sx of [-1, 1]) dot(G, '#d4a017', -0.07 + sx * 0.05 + 0.05, 0.05, 0.036 * sx, 0.006, 6);
  // ferro on the prow
  const fe = grp(G, 0.345, 0.1, 0);
  slab(fe, [[0, 0], [0.012, 0.0], [0.016, 0.07], [0.0, 0.075], [-0.006, 0.04]], 0.004, '#e5e7eb', 0, false).material = mat('#e5e7eb', { metal: 0.7, rough: 0.3 });
  for (let k = 0; k < 6; k++) box(fe, '#e5e7eb', 0.024, 0.006 + k * 0.01, 0, 0.018, 0.004, 0.004);
  cone(G, '#e5e7eb', -0.36, 0.08, 0, 0.006, 0.03, 6);
  // gondolier at the stern: striped shirt, straw boater, oar on the forcola
  const GD = kid(G, -0.26, 0.03, 0, Math.PI / 2, { shirt: '#f8fafc', pants: '#111827', hands: [[-0.01, 0.07, 0.04], [0.02, 0.09, 0.04]], hat: (f) => { cyl(f, '#f5deb3', 0, 0.118, -0.002, 0.03, 0.004, 14); cyl(f, '#f5deb3', 0, 0.12, -0.002, 0.019, 0.014, 14); cyl(f, '#dc2626', 0, 0.121, -0.002, 0.0195, 0.004, 14); } }, 0.95);
  for (let k = 0; k < 4; k++) cyl(GD, '#1d4ed8', 0, 0.044 + k * 0.009, 0, 0.0218, 0.0035, 12);
  rod(G, [-0.24, 0.125, 0.03], [-0.15, -0.01, 0.08], 0.003, '#a16207');
  ellip(G, '#a16207', -0.15, 0.0, 0.08, 0.004, 0.022, 0.012, 0, 0, 0.6);
  // revellers in masks and capes on the quay
  masker(gp, -0.22, Y, -0.14, 0.3, '#7c3aed', '#f8fafc', '#d4a017', 'plume', ['#facc15', '#7c3aed', '#facc15']);
  masker(gp, -0.07, Y, -0.1, -0.1, '#b91c1c', '#facc15', '#f8fafc', 'tricorn', []);
  masker(gp, 0.12, Y, -0.13, -0.35, '#0f766e', '#f8fafc', '#d4a017', 'plume', ['#ffffff', '#ec4899', '#ffffff']);
  // mask-seller's stand
  const MS = grp(gp, 0.33, Y, -0.13, -0.6);
  box(MS, '#7c2d12', 0, 0, 0, 0.14, 0.05, 0.06);
  box(MS, '#5b4636', 0, 0.05, -0.025, 0.14, 0.12, 0.01);
  for (const [i, [f0, t0]] of ([['#facc15', '#dc2626'], ['#f8fafc', '#d4a017'], ['#1d4ed8', '#facc15'], ['#dc2626', '#facc15'], ['#f8fafc', '#7c3aed'], ['#22c55e', '#facc15']] as const).entries()) {
    mask(MS, -0.045 + (i % 3) * 0.045, 0.085 + Math.floor(i / 3) * 0.05, -0.012, 0.75, f0, t0);
  }
  for (let k = 0; k < 3; k++) mask(MS, -0.045 + k * 0.045, 0.06, 0.02, 0.7, ['#f8fafc', '#facc15', '#dc2626'][k], '#d4a017', [], 0).rotation.x = -1.2;
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// HOLI — Mathura: a cream-and-saffron temple with a beehive shikhara and marigold garlands; in front, kids in
// white kurtas splattered with colour hurl gulal that bursts into big rainbow powder clouds; brass bowls piled
// with powder cones and a squirt gun (pichkari) spraying.
// ---------------------------------------------------------------------------------------------------------
const GULAL = ['#ff3d9a', '#ffd21f', '#22d37a', '#2f7bff', '#a24dff', '#ff7a1a'];
/** Powder cloud: a soft cluster of slightly see-through puffs growing from (x,y,z) along direction d. */
function powder(p: THREE.Object3D, x: number, y: number, z: number, d: V3, c: string, n: number, r: number, seed: number): void {
  const m = mat(c, { transparent: 0.82 });
  for (let i = 0; i < n; i++) {
    // puffs fan out along d and billow sideways: small at the hand, big soft cloud at the far end
    const t = Math.pow(i / Math.max(1, n - 1), 0.7), rr = r * (0.3 + t * 0.9) * (0.75 + hash3(i, seed, 1) * 0.5);
    const j = (k: number, f: number) => (hash3(i, seed, k) - 0.5) * r * f * (0.3 + t);
    add(p, SPH(8), m, x + d[0] * t + j(2, 2.4), y + d[1] * t + j(3, 1.2), z + d[2] * t + j(4, 2.4), rr * 2.2, rr * 1.7, rr * 2.2);
  }
}
const fs_holi: Builder = (gp) => {
  const st = stones('#d9c7a6', 1 / 24, 0.18);
  plaza(gp, 0.5, 0.035, 48, (x, y, z, nx, ny, nz) => {
    const blot = fbm(x * 9, 3, z * 9, 2);
    if (blot > 0.62 && z > -0.2) return shade(GULAL[Math.floor(hash3(Math.floor(x * 7), 0, Math.floor(z * 7)) * 6)], 0.9 + hash3(Math.floor(x * 48), 1, Math.floor(z * 48)) * 0.2);
    return st(x, y, z, nx, ny, nz);
  }, '#8a6a4a');
  const Y = 0.035;
  // temple: plinth with steps, pillared porch, beehive shikhara with amalaka, kalash and saffron flag
  const T = grp(gp, -0.04, Y, -0.3);
  box(T, '#c2703d', 0, 0, 0, 0.5, 0.05, 0.22);
  for (let k = 0; k < 3; k++) box(T, '#d08a55', 0, 0, 0.11 + k * 0.016, 0.16, 0.05 - k * 0.016, 0.016);
  box(T, '#f3e2bf', 0, 0.05, -0.02, 0.4, 0.13, 0.15);
  for (let i = 0; i < 6; i++) {
    const px = -0.17 + i * 0.068;
    cyl(T, '#fff4dc', px, 0.05, 0.07, 0.01, 0.12, 8);
    box(T, '#e25822', px, 0.165, 0.07, 0.03, 0.012, 0.03);
  }
  box(T, '#b8452a', 0, 0.075, 0.056, 0.08, 0.09, 0.004);
  box(T, '#ffe8a3', 0, 0.075, 0.059, 0.06, 0.07, 0.003);
  box(T, '#f6d9a6', 0, 0.175, 0.0, 0.44, 0.018, 0.2);
  for (let i = 0; i < 11; i++) box(T, i % 2 ? '#e25822' : '#ffd166', -0.2 + i * 0.04, 0.193, 0.09, 0.03, 0.012, 0.012);
  // corner chhatris
  for (const sx of [-1, 1]) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) cyl(T, '#fff4dc', sx * 0.17 + dx * 0.022, 0.193, dz * 0.022, 0.004, 0.04, 6);
    lathe(T, [[0.035, 0], [0.034, 0.012], [0.024, 0.03], [0.008, 0.042], [0, 0.045]], '#f3e2bf', sx * 0.17, 0.233, 0, 12);
    dot(T, '#f5b301', sx * 0.17, 0.282, 0, 0.006, 6);
  }
  lathe(T, [[0.1, 0], [0.1, 0.03], [0.096, 0.08], [0.084, 0.13], [0.062, 0.18], [0.036, 0.215], [0.012, 0.232], [0, 0.235]], '#f0d29b', 0, 0.193, -0.02, 10);
  const SHK: [number, number][] = [[0.1, 0], [0.1, 0.03], [0.096, 0.08], [0.084, 0.13], [0.062, 0.18], [0.036, 0.215], [0.012, 0.232], [0, 0.235]];
  const shR = (h: number) => { for (let i = 1; i < SHK.length; i++) if (h <= SHK[i][1]) { const [r0, h0] = SHK[i - 1], [r1, h1] = SHK[i]; return r0 + ((h - h0) / (h1 - h0)) * (r1 - r0); } return 0; };
  for (let k = 0; k < 6; k++) {
    const yy = 0.21 + k * 0.032, rr = shR(yy - 0.193 + 0.002) + 0.004;
    cyl(T, '#e8a656', 0, yy, -0.02, rr, 0.004, 10);
  }
  lathe(T, [[0, 0], [0.03, 0.002], [0.034, 0.01], [0.03, 0.018], [0, 0.02]], '#e8c27a', 0, 0.426, -0.02, 10);
  lathe(T, [[0, 0], [0.012, 0.004], [0.014, 0.014], [0.006, 0.024], [0.004, 0.032], [0, 0.036]], '#f5b301', 0, 0.446, -0.02, 10);
  rod(T, [0, 0.46, -0.02], [0, 0.56, -0.02], 0.0025, '#78350f');
  slab(grp(T, 0.002, 0.555, -0.02), [[0, 0], [0.08, -0.02], [0, -0.045]], 0.002, '#ff7a1a', 0, false);
  // marigold garlands draped across the porch
  for (let gi = 0; gi < 5; gi++) {
    const x0 = -0.17 + gi * 0.068;
    for (let k = 0; k <= 6; k++) { const t = k / 6; dot(T, k % 2 ? '#ff9f1a' : '#ffcc00', x0 + t * 0.068, 0.155 - Math.sin(t * Math.PI) * 0.025, 0.082, 0.006, 6); }
  }
  // brass bowls with powder cones on a low cart (left)
  const Cb = grp(gp, -0.33, Y, 0.02, 0.5);
  box(Cb, '#8b5a2b', 0, 0.03, 0, 0.18, 0.016, 0.1);
  for (const sx of [-1, 1]) { const w = cyl(Cb, '#5b3a1e', sx * 0.07, 0.0, 0.052, 0.022, 0.01, 12); w.rotation.x = Math.PI / 2; w.position.set(sx * 0.07, 0.022, 0.052); }
  for (let i = 0; i < 6; i++) {
    const bx = -0.06 + (i % 3) * 0.06, bz = i < 3 ? -0.022 : 0.024;
    lathe(Cb, [[0, 0], [0.018, 0.002], [0.026, 0.012], [0.028, 0.02], [0.026, 0.021]], '#d4a017', bx, 0.046, bz, 12);
    cone(Cb, GULAL[i], bx, 0.062, bz, 0.025, 0.035, 12);
  }
  // squirt gun stream
  const kid1 = kid(gp, 0.33, Y, 0.0, -0.9, { shirt: '#f8fafc', pants: '#f8fafc', hands: FWD }, 1.1);
  rod(kid1, [0, 0.07, 0.02], [0, 0.075, 0.07], 0.007, '#22c55e', 8);
  tube(kid1, [[0, 0.077, 0.07], [0, 0.1, 0.16], [0, 0.09, 0.24], [0, 0.05, 0.3]], 0.006, 0.012, '#ff3d9a', { radial: 6, sub: 4 });
  powder(kid1, 0, 0.05, 0.3, [0, 0.03, 0.06], '#ff3d9a', 6, 0.035, 9);
  // throwers with rainbow clouds arcing overhead
  const KIDS: [number, number, number, [V3, V3], number][] = [
    [-0.16, 0.06, 0.4, THROW, 0], [0.02, 0.2, -0.3, UP, 1], [0.18, 0.03, 0.2, THROW, 2], [-0.08, 0.28, 0.1, FWD, 3], [0.17, 0.32, -0.6, UP, 4], [-0.3, 0.26, 0.6, THROW, 5],
  ];
  for (const [kx, kz, ry, hands, ci] of KIDS) {
    const f = kid(gp, kx, Y, kz, ry, { shirt: '#f8fafc', pants: '#f1f5f9', hands, dress: ci === 1 || ci === 4 }, 1.15);
    for (let k = 0; k < 5; k++) dot(f, GULAL[(ci + k) % 6], (hash3(k, ci, 1) - 0.5) * 0.03, 0.04 + hash3(k, ci, 2) * 0.04, 0.012 + hash3(k, ci, 7) * 0.004, 0.006, 6);
    dot(f, GULAL[(ci + 2) % 6], 0.006, 0.098, 0.017, 0.006, 6);
    dot(f, GULAL[(ci + 3) % 6], -0.008, 0.115, 0.01, 0.009, 6);
  }
  powder(gp, -0.12, Y + 0.16, 0.06, [0.14, 0.07, -0.02], GULAL[0], 11, 0.055, 1);
  powder(gp, 0.05, Y + 0.17, 0.2, [0.12, 0.06, -0.06], GULAL[1], 11, 0.055, 2);
  powder(gp, 0.21, Y + 0.16, 0.02, [-0.1, 0.08, -0.04], GULAL[2], 10, 0.055, 3);
  powder(gp, -0.26, Y + 0.16, 0.25, [0.12, 0.05, -0.08], GULAL[4], 10, 0.05, 4);
  powder(gp, 0.15, Y + 0.17, 0.33, [0.1, 0.06, -0.02], GULAL[3], 9, 0.05, 5);
  powder(gp, -0.05, Y + 0.02, 0.16, [0.1, 0.01, 0.03], GULAL[5], 7, 0.04, 7);
  powder(gp, 0.12, Y + 0.02, 0.12, [-0.06, 0.01, 0.08], GULAL[4], 6, 0.035, 8);
  powder(gp, -0.04, Y + 0.24, -0.02, [0.08, 0.06, 0.0], GULAL[5], 8, 0.05, 6);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DIWALI — Varanasi: sandstone ghat steps lined with hundreds of glowing clay diyas run down to the Ganges,
// where leaf-boat diyas float; on top a big colourful rangoli, an ochre riverside haveli with star lanterns and
// fairy lights, a girl carrying an aarti plate and a boy waving a sparkler.
// ---------------------------------------------------------------------------------------------------------
/** Clay diya with an emissive teardrop flame. */
function diya(p: THREE.Object3D, x: number, y: number, z: number, s = 1): void {
  add(p, SPH(6), mat('#b45309'), x, y + 0.004 * s, z, 0.022 * s, 0.01 * s, 0.016 * s);
  add(p, SPH(6), mat('#ffd36b', { emissive: '#ff9a1a' }), x, y + 0.012 * s, z, 0.008 * s, 0.018 * s, 0.008 * s);
}
const fs_diwali: Builder = (gp) => {
  const water = ripple('#2a5f8a');
  // ghat steps descend toward the river at the front
  plaza(gp, 0.5, 0.035, 48, (x, y, z, nx, ny, nz) => {
    const n = hash3(Math.floor(x * 50), 0, Math.floor(z * 50));
    if (z > 0.18) {
      const w = water(x, y, z, nx, ny, nz);
      return Math.abs(x + 0.02) < 0.06 + (z - 0.18) * 0.3 && n > 0.9 ? mix(w ?? '#2a5f8a', '#ffc46b', 0.6) : w;
    }
    return shade('#d6b48a', 0.9 + n * 0.12);
  }, '#6b5040');
  const Y = 0.035;
  const ST = '#d9b98f';
  for (let k = 0; k < 6; k++) {
    const z0 = -0.06 + k * 0.04, h = 0.15 - k * 0.025;
    const halfW = Math.sqrt(Math.max(0, 0.25 - (z0 + 0.04) ** 2)) - 0.005;
    box(gp, k % 2 ? ST : shade(ST, 0.94), 0, Y, z0 + 0.02, halfW * 2, h, 0.04);
    const nd = Math.round(halfW * 26);
    for (let i = 0; i < nd; i++) {
      const dx = -halfW + 0.035 + (i / (nd - 1)) * (halfW * 2 - 0.07);
      diya(gp, dx, Y + h, z0 + 0.028, 1.35);
    }
  }
  // the top terrace (back) with the rangoli
  {
    // terrace = the circle segment behind z=-0.06, extruded up 0.15 (shape y = -world z)
    const sh = new THREE.Shape(), a0 = Math.asin(0.06 / 0.495);
    for (let i = 0; i <= 24; i++) { const a = a0 + (i / 24) * (Math.PI - 2 * a0); i ? sh.lineTo(Math.cos(a) * 0.495, Math.sin(a) * 0.495) : sh.moveTo(Math.cos(a) * 0.495, Math.sin(a) * 0.495); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.15, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    add(gp, geo, mat(ST), 0, Y, 0, 1, 1, 1);
  }
  const rg = new THREE.RingGeometry(0.004, 0.13, 48, 9);
  rg.rotateX(-Math.PI / 2);
  const RANG = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#a21caf', '#facc15', '#ffffff'];
  const rgp = paintFaces(rg, '#ffffff', (x, _y, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    const petal = Math.abs(Math.cos(a * 4)) ** 0.5, star = Math.abs(Math.cos(a * 8));
    if (r < 0.02) return '#facc15';
    if (r < 0.045) return r < 0.03 + petal * 0.015 ? '#e11d48' : '#ffffff';
    if (r < 0.08) return r < 0.05 + petal * 0.028 ? '#f59e0b' : '#2563eb';
    if (r < 0.11) return r < 0.085 + star * 0.022 ? '#16a34a' : '#a21caf';
    return RANG[Math.floor(((a + Math.PI) / TAU) * 32) % 2 ? 4 : 5];
  });
  add(gp, rgp, mat('#ffffff', { vc: true }), -0.12, Y + 0.151, -0.24, 1, 1, 1);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; diya(gp, -0.12 + Math.cos(a) * 0.145, Y + 0.15, -0.24 + Math.sin(a) * 0.145, 1.2); }
  // ochre haveli at the back right with arched windows, star lanterns and fairy lights
  const Hv = grp(gp, 0.22, Y + 0.15, -0.33, -0.25);
  box(Hv, '#e0a54a', 0, 0, 0, 0.26, 0.3, 0.14);
  box(Hv, '#c9822f', 0, 0.3, 0, 0.28, 0.016, 0.16);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
    const wx = -0.08 + i * 0.08, wy = 0.05 + r * 0.13;
    box(Hv, '#5b2a12', wx, wy, 0.07, 0.04, 0.06, 0.004);
    const a = cyl(Hv, '#5b2a12', wx, wy + 0.06, 0.07, 0.02, 0.004, 10); a.rotation.x = Math.PI / 2; a.position.set(wx, wy + 0.06, 0.071);
    box(Hv, '#fff3d6', wx, wy - 0.008, 0.074, 0.05, 0.008, 0.012);
    glow(box(Hv, '#ffd88a', wx, wy + 0.004, 0.0725, 0.026, 0.04, 0.002), '#ffd88a', '#ff9f1a');
  }
  for (const sx of [-1, 1]) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) cyl(Hv, '#f3dcb0', sx * 0.09 + dx * 0.02, 0.316, dz * 0.02, 0.004, 0.04, 6);
    lathe(Hv, [[0.032, 0], [0.03, 0.012], [0.02, 0.028], [0, 0.04]], '#f3dcb0', sx * 0.09, 0.356, 0, 12);
  }
  for (let i = 0; i <= 14; i++) { const t = i / 14; dotE(Hv, '#fff6c2', '#ffcc33', -0.14 + t * 0.28, 0.29 - Math.sin(t * Math.PI * 3) ** 2 * 0.02, 0.08, 0.0045, 6); }
  // star lanterns (akash kandil) on a cord
  for (const [lx, c, e] of [[-0.06, '#ff5fa2', '#e0306f'], [0.06, '#ffd84a', '#f59e0b']] as const) {
    rod(Hv, [lx, 0.29, 0.1], [lx, 0.24, 0.1], 0.0012, '#1f2937');
    glow(add(Hv, g('fs-oct', () => new THREE.OctahedronGeometry(1, 0)), mat(c), lx, 0.22, 0.1, 0.022, 0.022, 0.012, 0, 0, Math.PI / 4), c, e);
    for (let k = 0; k < 3; k++) rod(Hv, [lx - 0.006 + k * 0.006, 0.2, 0.1], [lx - 0.008 + k * 0.008, 0.17, 0.1], 0.0015, c, 4);
  }
  // little shrine with a bell tower on the left terrace
  const Sh = grp(gp, -0.36, Y + 0.15, -0.2, 0.5);
  box(Sh, '#f3e2bf', 0, 0, 0, 0.08, 0.07, 0.08);
  lathe(Sh, [[0.05, 0], [0.048, 0.03], [0.035, 0.07], [0.015, 0.1], [0, 0.11]], '#e25822', 0, 0.07, 0, 8);
  dot(Sh, '#f5b301', 0, 0.185, 0, 0.007, 6);
  glow(box(Sh, '#ffd88a', 0, 0.01, 0.041, 0.03, 0.045, 0.002), '#ffd88a', '#ff9f1a');
  // floating leaf-boat diyas on the river
  for (let i = 0; i < 9; i++) {
    const fx = -0.3 + i * 0.075 + (hash3(i, 1, 1) - 0.5) * 0.04, fz = 0.27 + hash3(i, 2, 2) * 0.15;
    if (Math.hypot(fx, fz) > 0.46) continue;
    add(gp, SPH(6), mat('#4d7c0f'), fx, Y + 0.002, fz, 0.04, 0.008, 0.03);
    for (let k = 0; k < 4; k++) dot(gp, ['#ff9f1a', '#ffcc00'][k % 2], fx - 0.012 + (k % 2) * 0.024, Y + 0.006, fz - 0.008 + (k >> 1) * 0.016, 0.0045, 6);
    diya(gp, fx, Y + 0.004, fz, 0.9);
  }
  // people: girl in sari with an aarti plate, boy with a sparkler
  const Gi = kid(gp, -0.08, Y + 0.15, -0.1, 0.2, { shirt: '#db2777', pants: '#db2777', dress: true, hands: FWD }, 1.1);
  cyl(Gi, '#d4a017', 0, 0.072, 0.045, 0.026, 0.004, 14);
  for (let k = 0; k < 3; k++) diya(Gi, -0.012 + k * 0.012, 0.076, 0.045, 0.6);
  ellip(Gi, '#f59e0b', 0.0, 0.07, -0.005, 0.024, 0.04, 0.012, 0, 0, 0.5);
  const Bo = kid(gp, 0.08, Y + 0.15, -0.14, -0.3, { shirt: '#f59e0b', pants: '#f8fafc', hands: [[-0.03, 0.04, 0.006], [0.032, 0.13, 0.02]] }, 1.05);
  rod(Bo, [0.032, 0.13, 0.02], [0.05, 0.2, 0.03], 0.0015, '#6b7280', 4);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU, b = hash3(k, 4, 4) * 1.2;
    rod(Bo, [0.05, 0.2, 0.03], [0.05 + Math.cos(a) * 0.03 * Math.cos(b), 0.2 + Math.sin(a) * 0.03, 0.03 + Math.sin(b) * 0.02], 0.0012, '#fff3a3', 3);
    dotE(Bo, '#fff8d6', '#ffd23f', 0.05 + Math.cos(a) * 0.032 * Math.cos(b), 0.2 + Math.sin(a) * 0.032, 0.03 + Math.sin(b) * 0.02, 0.003, 4);
  }
  dotE(Bo, '#ffffff', '#ffe066', 0.05, 0.2, 0.03, 0.007, 6);
  kid(gp, 0.26, Y + 0.05, 0.13, -0.5, { shirt: '#16a34a', pants: '#f8fafc', hands: FWD, sit: true }, 1.0);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SONGKRAN — Chiang Mai: the old red-brick Tha Phae Gate with its big teak doors; a decorated elephant sprays a
// shining arc of water over laughing kids with water guns and buckets, sand chedis with paper flags, splashes.
// ---------------------------------------------------------------------------------------------------------
const WET = () => mat('#bfe8ff', { transparent: 0.6 });
function squirt(p: THREE.Object3D, pts: V3[], r0: number, r1: number): void {
  const m = sweep(p, pts.map((pt, i) => ({ p: pt, w: r0 + (r1 - r0) * (i / (pts.length - 1)) })), '#bfe8ff', { radial: 6, sub: 5 });
  m.material = WET();
  const e = pts[pts.length - 1];
  for (let k = 0; k < 5; k++) add(p, SPH(6), WET(), e[0] + (hash3(k, e[0] * 9, 1) - 0.5) * r1 * 6, e[1] + hash3(k, 2, e[2] * 9) * r1 * 2, e[2] + (hash3(k, 3, 3) - 0.5) * r1 * 6, r1 * 2.6, r1 * 2.6, r1 * 2.6);
}
const fs_songkran: Builder = (gp) => {
  plaza(gp, 0.5, 0.035, 48, (x, _y, z) => {
    const n = hash3(Math.floor(x * 48), 0, Math.floor(z * 48));
    const wet = fbm(x * 7, 2, z * 7, 2) > 0.58;
    return wet ? mix('#7aa7c7', '#a8d4f0', n * 0.5) : shade('#b8b0a2', 0.9 + n * 0.12);
  }, '#6b5a48');
  const Y = 0.035;
  // Tha Phae Gate wall
  const brick: Paint = (x, y, _z, nx) => {
    const v = Math.floor(y * 90), u = Math.floor((Math.abs(nx) > 0.5 ? _z : x) * 45 + (v % 2) * 0.5);
    const mortar = (y * 90) % 1 < 0.14;
    return mortar ? '#9a6a55' : shade('#b5523a', 0.82 + hash3(u, v, 1) * 0.3);
  };
  const Wl = grp(gp, 0, Y, -0.32);
  for (const sx of [-1, 1]) {
    const geo = new THREE.BoxGeometry(0.3, 0.2, 0.08, 12, 10, 3);
    geo.translate(sx * 0.21, 0.1, 0);
    add(Wl, paintFaces(geo, '#b5523a', brick), mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < 5; i++) box(Wl, '#a8492f', sx * (0.08 + i * 0.065), 0.2, 0, 0.035, 0.03, 0.08);
  }
  const lintel = new THREE.BoxGeometry(0.12, 0.06, 0.08, 6, 3, 3);
  lintel.translate(0, 0.17, 0);
  add(Wl, paintFaces(lintel, '#b5523a', brick), mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
  for (const sx of [-1, 1]) {
    box(Wl, '#7c4a1e', sx * 0.03, 0, 0.0, 0.058, 0.14, 0.02);
    for (let k = 0; k < 4; k++) dot(Wl, '#3f2a14', sx * 0.03, 0.025 + k * 0.03, 0.011, 0.004, 6);
  }
  box(Wl, '#f5f5f4', 0, 0.21, 0.042, 0.1, 0.03, 0.004);
  for (let k = 0; k < 4; k++) box(Wl, '#1f2937', -0.032 + k * 0.021, 0.218, 0.045, 0.012, 0.014, 0.002);
  // marigold garland on the gate and flags on top
  for (let k = 0; k <= 10; k++) { const t = k / 10; dot(Wl, k % 2 ? '#ff9f1a' : '#facc15', -0.06 + t * 0.12, 0.14 - Math.sin(t * Math.PI) * 0.03, 0.045, 0.006, 6); }
  for (let i = 0; i < 6; i++) {
    const fx = -0.33 + i * 0.13 + (i > 2 ? 0.0 : 0), fz = 0.0;
    if (Math.abs(fx) < 0.07) continue;
    rod(Wl, [fx, 0.23, fz], [fx, 0.32, fz], 0.002, '#e7e5e4', 4);
    slab(grp(Wl, fx + 0.002, 0.3, fz), [[0, 0], [0.04, 0.0], [0.04, 0.022], [0, 0.022]], 0.002, ['#dc2626', '#facc15', '#2563eb', '#16a34a', '#a855f7', '#f97316'][i], 0, false);
  }
  // elephant (left) with a red-gold head cloth, trunk raised and spraying
  const E = grp(gp, -0.24, Y, -0.04, -0.5);
  const GR = '#8d8a88';
  sweep(E, [{ p: [-0.11, 0.13, 0], w: 0.05, h: 0.06 }, { p: [-0.06, 0.15, 0], w: 0.075, h: 0.08 }, { p: [0.03, 0.15, 0], w: 0.075, h: 0.08 }, { p: [0.09, 0.15, 0], w: 0.06, h: 0.065 }], GR, { radial: 12, sub: 4 });
  for (const [lx, lz] of [[-0.07, -0.04], [-0.07, 0.04], [0.06, -0.04], [0.06, 0.04]] as const) {
    cyl(E, GR, lx, 0, lz, 0.025, 0.12, 10);
    cyl(E, '#e7e2dc', lx, 0, lz, 0.027, 0.008, 10);
  }
  ellip(E, GR, 0.13, 0.19, 0, 0.055, 0.055, 0.05);
  for (const sz of [-1, 1]) {
    ellip(E, '#9b9795', 0.115, 0.19, sz * 0.05, 0.035, 0.045, 0.008, 0, sz * 0.25, 0);
    ellip(E, '#e8b4b8', 0.117, 0.19, sz * 0.054, 0.024, 0.032, 0.004, 0, sz * 0.25, 0);
    ellip(E, '#ffffff', 0.165, 0.205, sz * 0.03, 0.009, 0.01, 0.006);
    dot(E, '#111827', 0.172, 0.206, sz * 0.031, 0.0045, 6);
    cone(E, '#fffbeb', 0.17, 0.15, sz * 0.022, 0.006, 0.03, 6).rotation.z = -2.2;
  }
  tube(E, [[0.175, 0.18, 0], [0.21, 0.15, 0], [0.235, 0.18, 0], [0.235, 0.24, 0], [0.215, 0.28, 0]], 0.02, 0.011, GR, { radial: 10, sub: 4 });
  // saddle cloth
  sweep(E, [{ p: [-0.06, 0.2, 0], w: 0.083, h: 0.04 }, { p: [0.03, 0.2, 0], w: 0.083, h: 0.04 }], '#dc2626', { radial: 12, sub: 2 });
  for (let k = 0; k < 9; k++) dot(E, '#facc15', -0.08 + k * 0.016, 0.165, 0.078, 0.004, 6);
  ellip(E, '#dc2626', 0.155, 0.225, 0, 0.03, 0.02, 0.045);
  for (let k = 0; k < 5; k++) dot(E, '#facc15', 0.17, 0.215, -0.03 + k * 0.015, 0.004, 6);
  tube(E, [[-0.11, 0.15, 0], [-0.135, 0.1, 0], [-0.13, 0.07, 0]], 0.006, 0.004, GR, { radial: 6, sub: 3 });
  squirt(E, [[0.215, 0.29, 0], [0.24, 0.36, 0], [0.33, 0.37, 0], [0.42, 0.28, 0], [0.47, 0.14, 0]], 0.008, 0.018);
  // kids with water guns, buckets and a bowl
  const gun = (f: THREE.Group, c: string, to: V3) => {
    rbox(f, c, 0, 0.066, 0.045, 0.02, 0.024, 0.05, 0.006);
    cyl(f, '#facc15', 0, 0.09, 0.045, 0.01, 0.02, 8);
    squirt(f, [[0, 0.078, 0.07], [to[0] * 0.5, to[1] * 0.5 + 0.1, to[2] * 0.5 + 0.04], to], 0.004, 0.01);
  };
  const k1 = kid(gp, 0.12, Y, 0.22, -2.6, { shirt: '#f472b6', pants: '#1e3a8a', hands: FWD }, 1.15);
  gun(k1, '#22c55e', [0, 0.06, 0.26]);
  const k2 = kid(gp, 0.0, Y, 0.02, -1.5, { shirt: '#38bdf8', pants: '#334155', hands: FWD }, 1.1);
  gun(k2, '#f97316', [0, 0.05, 0.22]);
  const k3 = kid(gp, 0.3, Y, 0.06, -1.2, { shirt: '#facc15', pants: '#334155', hands: UP }, 1.05);
  cyl(k3, '#ef4444', 0, 0.14, 0, 0.025, 0.03, 12);
  squirt(k3, [[0, 0.17, 0.015], [0, 0.2, 0.06], [0, 0.17, 0.1], [0, 0.07, 0.15]], 0.012, 0.02);
  kid(gp, -0.06, Y, 0.34, 0.4, { shirt: '#a3e635', pants: '#1f2937', hands: UP }, 1.05);
  const k5 = kid(gp, 0.33, Y, -0.16, -0.5, { shirt: '#c084fc', dress: true, hands: FWD }, 1.0);
  lathe(k5, [[0, 0], [0.02, 0.0], [0.03, 0.02], [0.031, 0.024]], '#d4a017', 0, 0.06, 0.04, 12);
  // sand chedis with flags (right front)
  for (const [cx, cz, s] of [[0.3, 0.27, 1], [0.2, 0.37, 0.75]] as const) {
    lathe(gp, [[0.05 * s, 0], [0.045 * s, 0.02 * s], [0.032 * s, 0.035 * s], [0.03 * s, 0.05 * s], [0.016 * s, 0.08 * s], [0.004 * s, 0.11 * s], [0, 0.12 * s]], '#e2c48a', cx, Y, cz, 12);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4, fx = cx + Math.cos(a) * 0.028 * s, fz = cz + Math.sin(a) * 0.028 * s;
      rod(gp, [fx, Y + 0.04 * s, fz], [fx, Y + 0.11 * s, fz], 0.0012, '#e7e5e4', 3);
      slab(grp(gp, fx, Y + 0.1 * s, fz, a), [[0, 0], [0.022, -0.005], [0, -0.014]], 0.0015, ['#dc2626', '#facc15', '#2563eb', '#16a34a'][k], 0, false);
    }
  }
  // puddles and splashes
  for (let i = 0; i < 6; i++) {
    const px = -0.1 + hash3(i, 1, 9) * 0.4, pz = -0.05 + hash3(i, 2, 9) * 0.4;
    add(gp, SPH(6), WET(), px, Y + 0.008, pz, 0.016, 0.022, 0.016);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// OKTOBERFEST — Munich (kid-friendly): a blue-and-white striped festival hall, a Ferris wheel with glowing
// bulbs (spins), a gingerbread-heart stall, a giant pretzel sign, the blue-white maypole and kids in lederhosen
// and dirndls holding pretzels and balloons.
// ---------------------------------------------------------------------------------------------------------
function heart(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, icing = '#f472b6'): void {
  const f = grp(p, x, y, z, ry, s);
  const H: [number, number][] = [[0, -0.05], [-0.035, -0.012], [-0.048, 0.018], [-0.03, 0.038], [-0.01, 0.034], [0, 0.022], [0.01, 0.034], [0.03, 0.038], [0.048, 0.018], [0.035, -0.012]];
  slab(f, H, 0.008, '#8b4513', 0, true);
  const g2 = grp(f, 0, 0.001, 0.007, 0, 0.82);
  slab(g2, H, 0.002, icing, 0, true);
  const g3 = grp(f, 0, 0.002, 0.008, 0, 0.66);
  slab(g3, H, 0.002, '#8b4513', 0, true);
  for (let k = 0; k < 3; k++) dot(f, ['#facc15', '#ffffff', '#22c55e'][k], -0.014 + k * 0.014, 0.008, 0.011, 0.004, 6);
  rod(f, [-0.03, 0.03, 0.003], [0, 0.07, 0.003], 0.0012, '#ef4444', 4);
  rod(f, [0.03, 0.03, 0.003], [0, 0.07, 0.003], 0.0012, '#ef4444', 4);
}
function pretzel(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, rx = 0): THREE.Group {
  const f = grp(p, x, y, z, ry, s);
  f.rotation.x = rx;
  const pts: V3[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * TAU;
    // pretzel knot: a heart-like loop crossing in the middle
    const px = Math.sin(t) * 0.05 * (1 + 0.15 * Math.cos(t)), py = (Math.cos(t) * 0.035 + Math.cos(2 * t) * 0.02) - 0.005;
    pts.push([px, py, Math.sin(2 * t) * 0.004]);
  }
  sweep(f, pts.map(pt => ({ p: pt, w: 0.008 })), '#9a4e1a', { radial: 7, sub: 1, paint: (_x, yy) => (yy > 0.0 ? '#8a4313' : '#a85a20') });
  for (let k = 0; k < 7; k++) { const t = (k / 7) * TAU + 0.3; dot(f, '#ffffff', Math.sin(t) * 0.05 * (1 + 0.15 * Math.cos(t)), Math.cos(t) * 0.035 + Math.cos(2 * t) * 0.02 - 0.005 + 0.003, 0.009, 0.003, 4); }
  return f;
}
const fs_oktoberfest: Builder = (gp) => {
  const gr = grass('#5d9a45', 26), st = stones('#c8bba5', 1 / 24, 0.2);
  plaza(gp, 0.5, 0.035, 48, (x, y, z, nx, ny, nz) => (Math.abs(z - 0.08 + x * 0.1) < 0.1 || (x > -0.05 && x < 0.1) ? st(x, y, z, nx, ny, nz) : gr(x, y, z, nx, ny, nz)), '#6b5040');
  const Y = 0.035;
  // striped festival hall (back left)
  const T = grp(gp, -0.2, Y, -0.24, 0.25);
  const stripes: Paint = (x) => (Math.floor((x + 1) * 40) % 2 ? '#2563eb' : '#f8fafc');
  const wall = new THREE.BoxGeometry(0.34, 0.11, 0.2, 14, 1, 8);
  wall.translate(0, 0.055, 0);
  add(T, paintFaces(wall, '#f8fafc', (x, y, z, nx, ny, nz) => (y < 0.012 ? '#a16207' : stripes(Math.abs(nx) > 0.5 ? z : x, y, z, nx, ny, nz))), mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
  const roof = new THREE.BufferGeometry();
  {
    const P: number[] = [], w = 0.37, d = 0.23, h = 0.09, n = 16;
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (i / n) * w, x1 = -w / 2 + ((i + 1) / n) * w;
      for (const sd of [-1, 1]) {
        const A: V3 = [x0, 0, (sd * d) / 2], B: V3 = [x1, 0, (sd * d) / 2], C: V3 = [x1, h, 0], D: V3 = [x0, h, 0];
        if (sd > 0) P.push(...A, ...B, ...C, ...A, ...C, ...D); else P.push(...A, ...C, ...B, ...A, ...D, ...C);
      }
    }
    for (const sx of [-1, 1]) {
      const A: V3 = [(sx * w) / 2, 0, -d / 2], B: V3 = [(sx * w) / 2, 0, d / 2], C: V3 = [(sx * w) / 2, h, 0];
      if (sx > 0) P.push(...A, ...C, ...B); else P.push(...A, ...B, ...C);
    }
    roof.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    roof.computeVertexNormals();
  }
  add(T, paintFaces(roof, '#f8fafc', (x, _y, _z, nx) => (Math.abs(nx) > 0.5 ? '#f8fafc' : Math.floor((x + 1) * 43.2) % 2 ? '#1d4ed8' : '#f8fafc')), mat('#ffffff', { vc: true }), 0, 0.11, 0, 1, 1, 1);
  // entrance arch with a big heart and garlands
  box(T, '#a16207', 0, 0, 0.101, 0.08, 0.1, 0.012);
  box(T, '#3f2a14', 0, 0, 0.106, 0.05, 0.075, 0.004);
  heart(T, 0, 0.17, 0.12, 1.1, 0, '#facc15');
  for (let k = 0; k <= 12; k++) { const t = k / 12; dot(T, k % 2 ? '#22c55e' : '#ef4444', -0.17 + t * 0.34, 0.105 - Math.sin(t * Math.PI * 2) ** 2 * 0.015, 0.105, 0.0045, 6); }
  for (const sx of [-1, 1]) {
    rod(T, [sx * 0.17, 0.2, 0], [sx * 0.17, 0.29, 0], 0.002, '#e7e5e4', 4);
    slab(grp(T, sx * 0.17 + 0.002, 0.27, 0), [[0, 0], [0.05, 0], [0.05, 0.026], [0, 0.026]], 0.002, sx > 0 ? '#2563eb' : '#f8fafc', 0, false);
  }
  // Ferris wheel (back right): A-frame legs + spinning wheel with glowing bulbs and gondolas
  const FW = grp(gp, 0.22, Y, -0.24, -0.25);
  const HY = 0.3, R = 0.2;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) rod(FW, [sx * 0.11, 0, sz * 0.05], [0, HY, sz * 0.03], 0.006, '#e5e7eb', 6);
  rod(FW, [0, HY, -0.04], [0, HY, 0.04], 0.008, '#9ca3af', 8);
  box(FW, '#2563eb', 0, 0, 0, 0.26, 0.03, 0.12);
  const hub = new THREE.Group(); hub.position.set(0, HY, 0); hub.name = 'spin'; FW.add(hub);
  const ring = new THREE.TorusGeometry(R, 0.006, 6, 40);
  for (const sz of [-1, 1]) add(hub, ring, mat('#ef4444'), 0, 0, sz * 0.022, 1, 1, 1);
  const ring2 = new THREE.TorusGeometry(R * 0.55, 0.004, 5, 28);
  add(hub, ring2, mat('#facc15'), 0, 0, 0.022, 1, 1, 1);
  add(hub, ring2, mat('#facc15'), 0, 0, -0.022, 1, 1, 1);
  const NG = 12;
  for (let i = 0; i < NG; i++) {
    const a = (i / NG) * TAU, cx = Math.cos(a) * R, cy = Math.sin(a) * R;
    for (const sz of [-1, 1]) rod(hub, [0, 0, sz * 0.022], [cx, cy, sz * 0.022], 0.0022, '#f8fafc', 4);
    rod(hub, [cx, cy, -0.022], [cx, cy, 0.022], 0.0025, '#f8fafc', 4);
    // gondola hangs below the rim
    const gc = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#f97316'][i % 6];
    rbox(hub, gc, cx, cy - 0.045, 0, 0.034, 0.03, 0.032, 0.006);
    cone(hub, gc, cx, cy - 0.016, 0, 0.022, 0.014, 8);
    rod(hub, [cx, cy, 0], [cx, cy - 0.016, 0], 0.0015, '#6b7280', 3);
    for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) {
      const b = a + (k / 3) * (TAU / NG);
      dotE(hub, '#fff7cc', '#ffcf3a', Math.cos(b) * (R + 0.006), Math.sin(b) * (R + 0.006), sz * 0.028, 0.0045, 4);
    }
  }
  dotE(hub, '#fff7cc', '#ffcf3a', 0, 0, 0.03, 0.014, 8);
  // maypole
  const mpx = 0.02, mpz = -0.06;
  for (let k = 0; k < 12; k++) {
    const yy = Y + k * 0.032;
    const seg = cyl(gp, '#f8fafc', mpx, yy, mpz, 0.009 - k * 0.0003, 0.032, 8);
    seg.rotation.y = k * 0.4;
    const helix = cyl(gp, '#2563eb', mpx, yy + 0.008, mpz, 0.0095 - k * 0.0003, 0.012, 8);
    helix.rotation.z = 0.25;
  }
  for (let k = 0; k < 3; k++) {
    const yy = Y + 0.13 + k * 0.08;
    for (const sx of [-1, 1]) {
      rod(gp, [mpx, yy, mpz], [mpx + sx * 0.05, yy, mpz], 0.002, '#78350f', 4);
      rbox(gp, ['#ef4444', '#16a34a', '#facc15'][k], mpx + sx * 0.05, yy - 0.012, mpz, 0.02, 0.024, 0.006, 0.003);
    }
  }
  cone(gp, '#16a34a', mpx, Y + 0.385, mpz, 0.03, 0.06, 10);
  dot(gp, '#facc15', mpx, Y + 0.45, mpz, 0.007, 6);
  // gingerbread heart stall (left front)
  const S = grp(gp, -0.31, Y, 0.12, 0.7);
  box(S, '#b45309', 0, 0, 0, 0.18, 0.06, 0.07);
  for (const sx of [-1, 1]) cyl(S, '#78350f', sx * 0.085, 0.06, 0.03, 0.005, 0.11, 6);
  const awn = new THREE.BoxGeometry(0.21, 0.012, 0.1, 12, 1, 1);
  add(S, paintFaces(awn, '#ef4444', (x) => (Math.floor((x + 1) * 57) % 2 ? '#ef4444' : '#ffffff')), mat('#ffffff', { vc: true }), 0, 0.175, 0.01, 1, 1, 1, 0, 0.25);
  for (let i = 0; i < 4; i++) heart(S, -0.066 + i * 0.044, 0.12, 0.04, 0.55, 0, ['#f472b6', '#facc15', '#ffffff', '#38bdf8'][i]);
  for (let i = 0; i < 5; i++) pretzel(S, -0.07 + i * 0.035, 0.068, 0.0, 0.32, 0, -1.4);
  // giant pretzel sign on a pole (right front)
  rod(gp, [0.38, Y, 0.12], [0.38, Y + 0.18, 0.12], 0.005, '#78350f', 6);
  pretzel(gp, 0.38, Y + 0.23, 0.12, 1.4, -0.5);
  // kids in lederhosen / dirndl
  const leder = (f: THREE.Group) => { for (const sx of [-1, 1]) box(f, '#5b3a1e', sx * 0.009, 0.04, 0.013, 0.004, 0.04, 0.004, 0, 0, sx * 0.15); box(f, '#5b3a1e', 0, 0.06, 0.016, 0.02, 0.004, 0.002); };
  const hatT = (f: THREE.Group) => { cyl(f, '#166534', 0, 0.118, -0.002, 0.026, 0.004, 12); cyl(f, '#166534', 0, 0.118, -0.002, 0.017, 0.022, 12); ellip(f, '#ffffff', 0.016, 0.145, -0.006, 0.003, 0.012, 0.003, 0, 0, -0.4); };
  const k1 = kid(gp, -0.05, Y, 0.3, 0.3, { shirt: '#f8fafc', pants: '#5b3a1e', hands: FWD, hat: (f) => { leder(f); hatT(f); } }, 1.15);
  pretzel(k1, 0, 0.08, 0.05, 0.5, 0, -0.2);
  const k2 = kid(gp, 0.1, Y, 0.26, -0.3, { shirt: '#dc2626', dress: true, hands: [[-0.03, 0.04, 0.006], [0.03, 0.13, 0.01]] }, 1.1);
  ellip(k2, '#f8fafc', 0, 0.035, 0.022, 0.016, 0.022, 0.004);
  rod(k2, [0.03, 0.13, 0.01], [0.03, 0.24, 0.0], 0.0008, '#f8fafc', 3);
  ellip(k2, '#38bdf8', 0.03, 0.27, 0.0, 0.026, 0.03, 0.026);
  const k3 = kid(gp, 0.24, Y, 0.18, -0.6, { shirt: '#16a34a', dress: true, hands: FWD }, 1.0);
  ellip(k3, '#f8fafc', 0, 0.035, 0.022, 0.016, 0.022, 0.004);
  heart(k3, 0, 0.06, 0.035, 0.45);
  kid(gp, -0.2, Y, 0.3, 0.6, { shirt: '#f8fafc', pants: '#5b3a1e', hands: UP, hat: (f) => { leder(f); hatT(f); } }, 1.0);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// LA TOMATINA — Buñol: a narrow street of whitewashed houses with terracotta roofs and green shutters, the
// cobbles flooded with red pulp; a tomato truck with kids throwing from its heaped bed, tomatoes flying through
// the air, splats on the walls, goggled kids in white T-shirts and the soapy pole with a ham on top.
// ---------------------------------------------------------------------------------------------------------
const TOM = '#e5281f';
function tomato(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  dot(p, TOM, x, y, z, r, 8);
  cone(p, '#2f8f2f', x, y + r * 0.85, z, r * 0.45, r * 0.4, 5);
}
function casa(p: THREE.Object3D, x: number, z: number, w: number, h: number, ry: number, wall: string, seed: number): void {
  const H = grp(p, x, 0.035, z, ry);
  box(H, wall, 0, 0, 0, w, h, 0.12);
  gable(H, w + 0.02, 0.05, 0.14, '#c2522d', 0, h, 0);
  box(H, '#a8a29e', 0, 0, 0.061, w, 0.025, 0.003);
  const nw = Math.max(1, Math.round(w / 0.07));
  for (let fl = 0; fl < Math.round(h / 0.1); fl++) for (let i = 0; i < nw; i++) {
    const wx = -w / 2 + (i + 0.5) * (w / nw), wy = 0.035 + fl * 0.1;
    if (fl === 0 && i === Math.floor(nw / 2)) { box(H, '#5b3a1e', wx, 0, 0.061, 0.032, 0.06, 0.004); continue; }
    box(H, '#1f2937', wx, wy, 0.061, 0.022, 0.034, 0.003);
    for (const sx of [-1, 1]) box(H, '#2f7d4a', wx + sx * 0.016, wy, 0.062, 0.01, 0.036, 0.003, sx * 0.3);
    if (fl > 0) { box(H, '#1f2937', wx, wy - 0.006, 0.072, 0.034, 0.003, 0.018); box(H, '#1f2937', wx, wy + 0.008, 0.08, 0.034, 0.002, 0.002); }
  }
  // tomato splats on the wall
  for (let k = 0; k < 4; k++) {
    const sx = (hash3(k, seed, 1) - 0.5) * w * 0.85, sy = 0.03 + hash3(k, seed, 2) * (h - 0.05);
    const s = cyl(H, TOM, 0, 0, 0, 0.012 + hash3(k, seed, 3) * 0.01, 0.003, 9);
    s.rotation.x = Math.PI / 2; s.position.set(sx, sy, 0.061);
    s.scale.x *= 1.3;
  }
}
const fs_tomatina: Builder = (gp) => {
  plaza(gp, 0.5, 0.035, 48, (x, _y, z) => {
    const n = hash3(Math.floor(x * 48), 0, Math.floor(z * 48)), f = fbm(x * 8, 5, z * 8, 2);
    if (z < -0.22) return shade('#b9b2a5', 0.9 + n * 0.12);
    return f > 0.42 ? shade(n > 0.5 ? '#d1281f' : '#b91c1c', 0.9 + n * 0.15) : f > 0.36 ? '#f06a4a' : shade('#9c958a', 0.9 + n * 0.12);
  }, '#6b5040');
  const Y = 0.035;
  // houses: a back row and one on each side
  casa(gp, -0.26, -0.33, 0.2, 0.22, 0.25, '#f8f5ee', 1);
  casa(gp, -0.04, -0.38, 0.22, 0.3, 0, '#f3e9d2', 2);
  casa(gp, 0.2, -0.36, 0.2, 0.2, -0.15, '#f8f5ee', 3);
  casa(gp, 0.39, -0.12, 0.16, 0.2, -1.25, '#f6eddc', 4);
  casa(gp, -0.41, -0.09, 0.16, 0.18, 1.3, '#f8f5ee', 5);
  // tomato truck heading left with a heaped bed
  const T = grp(gp, 0.1, Y, -0.08, -0.12);
  for (const [wx, wz] of [[-0.11, -0.055], [-0.11, 0.055], [0.1, -0.055], [0.1, 0.055]] as const) {
    const w = cyl(T, '#111827', 0, 0, 0, 0.026, 0.02, 12); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.026, wz);
    const hb = cyl(T, '#d1d5db', 0, 0, 0, 0.012, 0.022, 8); hb.rotation.x = Math.PI / 2; hb.position.set(wx, 0.026, wz);
  }
  box(T, '#374151', 0, 0.026, 0, 0.3, 0.02, 0.1);
  rbox(T, '#2563eb', -0.14, 0.04, 0, 0.08, 0.09, 0.11, 0.015);
  box(T, '#bfdbfe', -0.181, 0.085, 0, 0.004, 0.035, 0.09);
  for (const sz of [-1, 1]) box(T, '#bfdbfe', -0.14, 0.085, sz * 0.056, 0.05, 0.03, 0.003);
  dot(T, '#fde68a', -0.182, 0.06, 0.035, 0.008, 6); dot(T, '#fde68a', -0.182, 0.06, -0.035, 0.008, 6);
  box(T, '#dc2626', 0.04, 0.046, 0, 0.22, 0.01, 0.11);
  for (const sz of [-1, 1]) box(T, '#dc2626', 0.04, 0.056, sz * 0.053, 0.22, 0.04, 0.005);
  box(T, '#dc2626', 0.148, 0.056, 0, 0.005, 0.04, 0.11);
  for (let i = 0; i < 40; i++) {
    const tx = -0.06 + hash3(i, 1, 1) * 0.2, tz = (hash3(i, 2, 2) - 0.5) * 0.09;
    const hh = 0.03 * (1 - Math.pow(Math.abs(tx - 0.04) / 0.11, 2)) * (1 - Math.pow(tz / 0.05, 2));
    dot(T, i % 5 ? TOM : '#c81e1e', tx, 0.072 + Math.max(0, hh) + hash3(i, 3, 3) * 0.008, tz, 0.011, 6);
  }
  kid(T, 0.0, 0.1, 0.0, 0.6, { shirt: '#f8fafc', pants: '#1e3a8a', hands: THROW, hat: (f) => { for (const sx of [-1, 1]) ellip(f, '#38bdf8', sx * 0.008, 0.102, 0.017, 0.007, 0.006, 0.003); cyl(f, '#38bdf8', 0, 0.098, -0.001, 0.0205, 0.004, 10); } }, 0.95);
  kid(T, 0.1, 0.09, -0.02, 0.9, { shirt: '#f8fafc', pants: '#1f2937', hands: UP }, 0.9);
  // goggled kids in pulp-stained T-shirts
  const gog = (c: string) => (f: THREE.Group) => { for (const sx of [-1, 1]) ellip(f, c, sx * 0.008, 0.102, 0.017, 0.007, 0.006, 0.003); cyl(f, c, 0, 0.098, -0.001, 0.0205, 0.004, 10); };
  const KD: [number, number, number, [V3, V3], string][] = [[-0.2, 0.18, 0.6, THROW, '#facc15'], [0.0, 0.28, -0.2, UP, '#22c55e'], [0.22, 0.2, -0.7, THROW, '#f472b6'], [-0.06, 0.06, 2.6, FWD, '#38bdf8'], [0.3, 0.06, -1.6, UP, '#a855f7']];
  for (const [kx, kz, ry, hands, gc] of KD) {
    const f = kid(gp, kx, Y, kz, ry, { shirt: '#f8fafc', pants: '#334155', hands, hat: gog(gc) }, 1.15);
    for (let k = 0; k < 4; k++) dot(f, TOM, (hash3(k, kx * 9, 1) - 0.5) * 0.03, 0.04 + hash3(k, kz * 9, 2) * 0.04, 0.014, 0.007, 6);
  }
  // flying tomatoes
  for (let i = 0; i < 14; i++) {
    const a = hash3(i, 7, 7) * TAU, rr = 0.1 + hash3(i, 8, 8) * 0.25;
    tomato(gp, Math.cos(a) * rr, Y + 0.17 + hash3(i, 9, 9) * 0.16, Math.sin(a) * rr * 0.8 + 0.05, 0.012);
  }
  // splats and squashed tomatoes on the ground
  for (let i = 0; i < 10; i++) { const sx = (hash3(i, 4, 1) - 0.5) * 0.7, sz = (hash3(i, 5, 1) - 0.3) * 0.5; add(gp, SPH(6), mat('#c81e1e'), sx, Y + 0.002, sz, 0.035, 0.006, 0.03); }
  // soapy pole with the ham
  rod(gp, [-0.33, Y, 0.2], [-0.33, Y + 0.4, 0.2], 0.007, '#c8a97e', 8);
  ellip(gp, '#b45309', -0.33, Y + 0.42, 0.2, 0.018, 0.035, 0.016);
  ellip(gp, '#fcd9b6', -0.33, Y + 0.45, 0.2, 0.01, 0.008, 0.01);
  rod(gp, [-0.33, Y + 0.39, 0.2], [-0.33, Y + 0.455, 0.2], 0.0015, '#78350f', 3);
  kid(gp, -0.335, Y + 0.18, 0.214, 0.0, { shirt: '#f8fafc', pants: '#1e3a8a', hands: [[-0.006, 0.17, 0.006], [0.006, 0.15, 0.008]] }, 0.85);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DAY OF THE DEAD — Oaxaca: a three-step ofrenda dressed in pink and purple under an arch of orange marigolds,
// crowded with glowing candles, photos, sugar skulls and pan de muerto; papel picado banners overhead, a path of
// marigold petals, a smiling Catrina in a flowered hat and a kid with face paint carrying marigolds.
// ---------------------------------------------------------------------------------------------------------
const MARI = ['#ff8c00', '#ffa31a', '#ffb800', '#f97316'];
function candle(p: THREE.Object3D, x: number, y: number, z: number, h: number, c = '#fef3c7'): void {
  cyl(p, c, x, y, z, 0.006, h, 7);
  add(p, SPH(6), mat('#ffd36b', { emissive: '#ff9a1a' }), x, y + h + 0.008, z, 0.008, 0.016, 0.008);
}
/** Sugar skull: white rounded skull with coloured flower eye-rims and a stitched smile. */
function calavera(p: THREE.Object3D, x: number, y: number, z: number, s: number, rim: string, ry = 0): THREE.Group {
  const f = grp(p, x, y, z, ry, s);
  ellip(f, '#fdfcf7', 0, 0.02, 0, 0.02, 0.019, 0.017);
  ellip(f, '#fdfcf7', 0, 0.006, 0.004, 0.013, 0.008, 0.012);
  for (const sx of [-1, 1]) {
    ellip(f, rim, sx * 0.008, 0.021, 0.014, 0.0075, 0.0075, 0.003);
    ellip(f, '#1f2937', sx * 0.008, 0.021, 0.016, 0.0045, 0.0048, 0.002);
  }
  ellip(f, '#1f2937', 0, 0.012, 0.017, 0.002, 0.003, 0.0015);
  box(f, '#1f2937', 0, 0.004, 0.0155, 0.014, 0.0012, 0.001);
  for (let k = 0; k < 4; k++) box(f, '#1f2937', -0.0055 + k * 0.0037, 0.002, 0.0158, 0.0008, 0.005, 0.001);
  dot(f, rim === '#ec4899' ? '#22c55e' : '#ec4899', 0, 0.035, 0.012, 0.004, 6);
  return f;
}
const fs_dayofdead: Builder = (gp) => {
  plaza(gp, 0.5, 0.035, 48, (x, _y, z) => {
    const n = hash3(Math.floor(x * 24), 0, Math.floor(z * 24));
    const path = Math.abs(x - Math.sin(z * 6) * 0.03) < 0.05 && z > -0.12;
    if (path) return hash3(Math.floor(x * 48), 1, Math.floor(z * 48)) > 0.3 ? MARI[Math.floor(n * 4)] : '#b45309';
    return (Math.floor(x * 24) + Math.floor(z * 24)) % 2 ? shade('#b5643c', 0.9 + n * 0.12) : shade('#c8794d', 0.9 + n * 0.1);
  }, '#5b3a2a');
  const Y = 0.035;
  // ofrenda tiers (pink / purple cloth with scalloped lace edges)
  const O = grp(gp, 0, Y, -0.26);
  const TIERS: [number, number, number, string][] = [[0.48, 0.18, 0, '#7c3aed'], [0.38, 0.13, -0.025, '#ec4899'], [0.28, 0.08, -0.05, '#f97316']];
  TIERS.forEach(([w, d, oz, c], i) => {
    const y0 = i * 0.07;
    box(O, c, 0, y0, oz, w, 0.07, d);
    for (let k = 0; k < Math.round(w / 0.022); k++) dot(O, '#fdf2f8', -w / 2 + 0.011 + k * 0.022, y0 + 0.064, oz + d / 2 + 0.001, 0.007, 6);
  });
  // back panel
  box(O, '#4c1d95', 0, 0, -0.1, 0.5, 0.3, 0.02);
  for (let k = 0; k < 8; k++) dot(O, '#facc15', -0.21 + k * 0.06, 0.27, -0.088, 0.006, 6);
  // photo frames
  for (const [px, py, pz, c] of [[-0.07, 0.21, -0.07, '#60a5fa'], [0.07, 0.21, -0.07, '#fbbf24'], [0, 0.23, -0.08, '#a3e635']] as const) {
    box(O, '#78350f', px, py, pz, 0.05, 0.06, 0.006, 0, -0.15);
    box(O, c, px, py + 0.008, pz + 0.004, 0.036, 0.044, 0.002, 0, -0.15);
    ellip(O, '#f1c7a3', px, py + 0.035, pz + 0.007, 0.008, 0.01, 0.002);
  }
  // sugar skulls and pan de muerto on the tiers
  calavera(O, -0.17, 0.07, 0.04, 1.2, '#ec4899', 0.2);
  calavera(O, 0.17, 0.07, 0.04, 1.2, '#22c55e', -0.2);
  calavera(O, -0.11, 0.14, 0.01, 1.0, '#38bdf8');
  calavera(O, 0.11, 0.14, 0.01, 1.0, '#facc15');
  for (const sx of [-1, 1]) {
    const px = sx * 0.07, pz = 0.05;
    ellip(O, '#c47a2c', px, 0.075, pz, 0.026, 0.018, 0.026);
    for (const a of [0, Math.PI / 2]) ellip(O, '#9a5a1e', px, 0.09, pz, 0.024, 0.004, 0.004, a);
    dot(O, '#9a5a1e', px, 0.095, pz, 0.006, 6);
  }
  // fruit and a bowl of oranges
  lathe(O, [[0, 0], [0.02, 0.002], [0.03, 0.014], [0.031, 0.018]], '#1d4ed8', 0, 0.07, 0.05, 12);
  for (let k = 0; k < 4; k++) dot(O, '#f97316', -0.012 + (k % 2) * 0.024, 0.09 + (k >> 1) * 0.012, 0.05 + ((k >> 1) ? 0 : (k % 2 ? 0.006 : -0.006)), 0.011, 6);
  // candles everywhere
  for (let i = 0; i < 7; i++) candle(O, -0.2 + i * 0.066, 0.07, 0.075, 0.03 + hash3(i, 1, 1) * 0.02);
  for (let i = 0; i < 5; i++) candle(O, -0.15 + i * 0.075, 0.14, 0.03, 0.03 + hash3(i, 2, 1) * 0.02);
  for (let i = 0; i < 4; i++) candle(O, -0.105 + i * 0.07, 0.21, -0.015, 0.035);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) candle(gp, sx * (0.07 + i * 0.03), Y, -0.08 + i * 0.03, 0.04 + i * 0.01, '#fde68a');
  // marigold arch
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * Math.PI;
    const ax = -Math.cos(a) * 0.25, ay = 0.02 + Math.sin(a) * 0.38;
    for (let k = 0; k < 2; k++) dot(O, MARI[(i + k) % 4], ax + (k - 0.5) * 0.006, ay + (hash3(i, k, 1) - 0.5) * 0.01, 0.03 + (k ? 0.012 : -0.012), 0.016, 6);
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) dot(O, MARI[k % 4], sx * 0.255, 0.02 + k * 0.012, 0.06 + (k % 2) * 0.01, 0.018, 6);
  // papel picado banners on two strings
  for (const sx of [-1, 1]) cyl(gp, '#78350f', sx * 0.36, Y, -0.33, 0.006, 0.52, 7);
  const PP = ['#ec4899', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7'];
  for (let row = 0; row < 2; row++) {
    const zz = -0.33, y0 = Y + 0.52 - row * 0.065;
    for (let i = 0; i < 10; i++) {
      const t = (i + 0.5) / 10, fx = -0.36 + t * 0.72, fy = y0 - Math.sin(t * Math.PI) * 0.04;
      const F = grp(gp, fx, fy, zz + 0.004, 0);
      slab(F, [[-0.026, 0], [0.026, 0], [0.026, -0.04], [0.013, -0.048], [0, -0.04], [-0.013, -0.048], [-0.026, -0.04]], 0.0015, PP[(i + row * 3) % 6], 0, false);
      for (const [hx, hy] of [[-0.012, -0.015], [0.012, -0.015], [0, -0.028]] as const) box(F, '#4c1d95', hx, hy, 0.0018, 0.008, 0.008, 0.0008, 0, 0, Math.PI / 4);
    }
    const pts: V3[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-0.36 + t * 0.72, y0 - Math.sin(t * Math.PI) * 0.04, zz]); }
    tube(gp, pts, 0.0015, 0.0015, '#1f2937', { radial: 4, sub: 2 });
  }
  // Catrina in a big flowered hat
  const C = kid(gp, -0.22, Y, 0.16, 0.45, { shirt: '#7c3aed', skin: '#fdfcf7', hair: '#1c1917', dress: true, hands: [[-0.03, 0.05, 0.02], [0.034, 0.1, 0.02]], hat: (f) => {
    cyl(f, '#1f2937', 0, 0.118, -0.002, 0.045, 0.004, 16);
    cyl(f, '#1f2937', 0, 0.118, -0.002, 0.022, 0.02, 12);
    for (let k = 0; k < 5; k++) dot(f, ['#ef4444', '#f97316', '#facc15', '#ec4899', '#ef4444'][k], -0.03 + k * 0.015, 0.128, 0.02 - Math.abs(k - 2) * 0.006, 0.008, 6);
    for (const sx of [-1, 1]) { ellip(f, '#1f2937', sx * 0.008, 0.101, 0.0175, 0.0065, 0.007, 0.002); ellip(f, '#ec4899', sx * 0.008, 0.109, 0.016, 0.006, 0.002, 0.002); }
    ellip(f, '#1f2937', 0, 0.093, 0.019, 0.0018, 0.0028, 0.0012);
    box(f, '#1f2937', 0, 0.087, 0.0175, 0.012, 0.0012, 0.001);
  } }, 1.35);
  cone(C, '#a855f7', 0, 0.0, 0, 0.036, 0.04, 12);
  for (let k = 0; k < 8; k++) dot(C, '#facc15', Math.cos(k * 0.8) * 0.034, 0.008, Math.sin(k * 0.8) * 0.034, 0.004, 6);
  // kid with face paint carrying marigolds
  const K = kid(gp, 0.2, Y, 0.18, -0.4, { shirt: '#16a34a', pants: '#1e3a8a', skin: '#fdfcf7', hands: FWD, hat: (f) => { for (const sx of [-1, 1]) ellip(f, '#1f2937', sx * 0.008, 0.101, 0.0175, 0.0065, 0.007, 0.002); ellip(f, '#1f2937', 0, 0.093, 0.019, 0.0018, 0.0028, 0.0012); } }, 1.15);
  for (let k = 0; k < 7; k++) dot(K, MARI[k % 4], (k % 3 - 1) * 0.012, 0.085 + Math.floor(k / 3) * 0.01, 0.05, 0.01, 6);
  rod(K, [0, 0.07, 0.045], [0, 0.085, 0.05], 0.004, '#15803d', 4);
  kid(gp, 0.33, Y, 0.0, -1.0, { shirt: '#f97316', pants: '#334155', hands: DOWN }, 1.0);
  calavera(gp, 0.08, Y, 0.34, 2.2, '#ec4899', -0.3);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// HANAMI — Kyoto: pink cherry trees in full bloom over a curving stream with a red arched bridge; families
// picnic on blue tarps and red mats with bento boxes, paper lanterns hang between the trees, a stone lantern
// stands by the water and petals drift down.
// ---------------------------------------------------------------------------------------------------------
const SAKURA = ['#f9a8d4', '#fbcfe8', '#f472b6', '#fce7f3'];
function sakura(p: THREE.Object3D, x: number, z: number, s: number, seed: number): void {
  const T = grp(p, x, 0.035, z, seed, s);
  tube(T, [[0, 0, 0], [0.005, 0.08, 0], [-0.01, 0.15, 0.005]], 0.022, 0.013, '#4a3226', { radial: 7, sub: 3 });
  tube(T, [[0.003, 0.1, 0], [0.06, 0.16, 0.01], [0.1, 0.19, 0.0]], 0.01, 0.006, '#4a3226', { radial: 6, sub: 3 });
  tube(T, [[-0.004, 0.12, 0], [-0.07, 0.17, -0.01], [-0.11, 0.2, 0.01]], 0.01, 0.006, '#4a3226', { radial: 6, sub: 3 });
  const pt: Paint = (px, py, pz) => (hash3(Math.floor(px * 160), Math.floor(py * 160), Math.floor(pz * 160)) > 0.9 ? '#f9c2dc' : mix('#ec6fae', '#fcd3e6', Math.min(1, Math.max(0, fbm(px * 22, py * 22, pz * 22, 2) * 0.9 + (py - 0.22) * 2.5))));
  const B: [number, number, number, number][] = [[0, 0.24, 0, 0.11], [0.1, 0.21, 0.02, 0.08], [-0.11, 0.22, 0.0, 0.085], [0.03, 0.2, 0.08, 0.075], [-0.04, 0.2, -0.07, 0.075]];
  for (const [bx, by, bz, br] of B) pblob(T, SAKURA[0], bx, by, bz, br, br * 0.75, br, pt, [0, 0, 0], 13);
}
function bento(p: THREE.Object3D, x: number, y: number, z: number, ry: number): void {
  const f = grp(p, x, y, z, ry);
  box(f, '#111827', 0, 0, 0, 0.05, 0.014, 0.036);
  box(f, '#b91c1c', 0, 0.0141, 0, 0.044, 0.001, 0.03);
  for (let k = 0; k < 3; k++) dot(f, '#fafaf9', -0.014 + k * 0.009, 0.017, -0.006, 0.005, 6);
  dot(f, '#facc15', 0.012, 0.017, -0.006, 0.006, 6);
  dot(f, '#f97316', 0.012, 0.017, 0.007, 0.006, 6);
  dot(f, '#22c55e', -0.008, 0.017, 0.007, 0.006, 6);
  dot(f, '#f9a8d4', 0.0, 0.017, 0.007, 0.005, 6);
}
const fs_hanami: Builder = (gp) => {
  const water = ripple('#4a9cc4'), gr = grass('#6aa84f', 26);
  const sc = (x: number) => 0.13 + Math.sin(x * 5 + 0.5) * 0.06;
  plaza(gp, 0.5, 0.035, 48, (x, y, z, nx, ny, nz) => {
    const d = Math.abs(z - sc(x));
    if (d < 0.05) return water(x, y, z, nx, ny, nz);
    if (d < 0.065) return shade('#9ca3af', 0.85 + hash3(Math.floor(x * 60), 0, Math.floor(z * 60)) * 0.25);
    return hash3(Math.floor(x * 48), 7, Math.floor(z * 48)) > 0.86 ? '#fbcfe8' : gr(x, y, z, nx, ny, nz);
  }, '#6b5040');
  const Y = 0.035;
  sakura(gp, -0.27, -0.2, 1.05, 0.3);
  sakura(gp, 0.12, -0.3, 1.15, 1.9);
  sakura(gp, 0.33, 0.33, 0.9, 4.1);
  sakura(gp, -0.36, 0.3, 0.8, 2.3);
  // red arched bridge over the stream
  const Bx = 0.27, B = grp(gp, Bx, Y, sc(Bx), 1.3 + Math.PI / 2);
  const deck: V3[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; deck.push([0, 0.005 + Math.sin(t * Math.PI) * 0.04, -0.09 + t * 0.18]); }
  sweep(B, deck.map(p => ({ p, w: 0.03, h: 0.006 })), '#b45309', { radial: 4, sub: 2 });
  for (const sx of [-1, 1]) {
    tube(B, deck.map(([, y, z]) => [sx * 0.03, y + 0.03, z] as V3), 0.003, 0.003, '#dc2626', { radial: 5, sub: 2 });
    for (let i = 1; i < 8; i += 2) rod(B, [sx * 0.03, deck[i][1], deck[i][2]], [sx * 0.03, deck[i][1] + 0.03, deck[i][2]], 0.0025, '#dc2626', 5);
  }
  // stone lantern
  const L = grp(gp, -0.06, Y, 0.05);
  cyl(L, '#9ca3af', 0, 0, 0, 0.022, 0.012, 6);
  cyl(L, '#a8a29e', 0, 0.012, 0, 0.009, 0.05, 6);
  cyl(L, '#9ca3af', 0, 0.062, 0, 0.02, 0.01, 6);
  glow(box(L, '#fff1c1', 0, 0.072, 0, 0.022, 0.024, 0.022), '#fff1c1', '#fbbf24');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(L, '#a8a29e', sx * 0.011, 0.072, sz * 0.011, 0.006, 0.024, 0.006);
  cone(L, '#8b8b8b', 0, 0.096, 0, 0.034, 0.03, 6);
  dot(L, '#8b8b8b', 0, 0.13, 0, 0.007, 6);
  // picnic mats: blue tarp (back left), red mat (front), with families and bento
  box(gp, '#3b82f6', -0.18, Y, -0.04, 0.24, 0.003, 0.14, 0.15);
  box(gp, '#dc2626', 0.0, Y, 0.34, 0.2, 0.003, 0.12, -0.1);
  bento(gp, -0.2, Y + 0.003, -0.04, 0.2);
  bento(gp, -0.13, Y + 0.003, -0.02, -0.3);
  bento(gp, 0.01, Y + 0.003, 0.34, 0.1);
  lathe(gp, [[0, 0], [0.008, 0.0], [0.009, 0.02], [0.006, 0.03], [0.003, 0.034]], '#f8fafc', -0.16, Y + 0.003, -0.08, 8);
  cyl(gp, '#f8fafc', 0.045, Y + 0.003, 0.32, 0.009, 0.012, 8);
  cyl(gp, '#f8fafc', 0.06, Y + 0.003, 0.35, 0.009, 0.012, 8);
  // hanami dango skewers
  for (let k = 0; k < 2; k++) {
    const dx = -0.04 + k * 0.012;
    rod(gp, [dx, Y + 0.005, 0.37], [dx + 0.02, Y + 0.008, 0.33], 0.0012, '#d6a96b', 3);
    for (let j = 0; j < 3; j++) dot(gp, ['#f9a8d4', '#fafaf9', '#86efac'][j], dx + 0.005 + j * 0.006, Y + 0.012, 0.36 - j * 0.01, 0.006, 6);
  }
  kid(gp, -0.26, Y + 0.003, -0.07, 0.6, { shirt: '#f472b6', pants: '#334155', sit: true, hands: FWD }, 1.1);
  kid(gp, -0.1, Y + 0.003, -0.08, -0.4, { shirt: '#facc15', pants: '#1e3a8a', sit: true, hands: UP }, 1.0);
  kid(gp, -0.17, Y + 0.003, 0.02, Math.PI, { shirt: '#22c55e', pants: '#334155', sit: true, hands: FWD }, 1.05);
  kid(gp, -0.05, Y + 0.003, 0.33, 0.4, { shirt: '#38bdf8', pants: '#334155', sit: true, hands: FWD }, 1.1);
  kid(gp, 0.08, Y + 0.003, 0.37, -0.5, { shirt: '#c084fc', dress: true, sit: true, hands: UP }, 1.0);
  // a kid in a yukata with a pink parasol on the bridge path
  const Pk = kid(gp, 0.16, Y, -0.04, -0.2, { shirt: '#fb7185', dress: true, hands: [[-0.03, 0.04, 0.006], [0.022, 0.09, 0.02]] }, 1.05);
  rod(Pk, [0.022, 0.09, 0.02], [0.022, 0.19, 0.0], 0.0015, '#78350f', 3);
  cone(Pk, '#f9a8d4', 0.022, 0.17, 0.0, 0.06, 0.035, 12);
  // paper lanterns strung between two trees
  const pts: V3[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([-0.22 + t * 0.32, Y + 0.3 - Math.sin(t * Math.PI) * 0.05, -0.22 - t * 0.05]); }
  tube(gp, pts, 0.0015, 0.0015, '#1f2937', { radial: 4, sub: 2 });
  for (let i = 1; i < 8; i += 2) {
    const [lx, ly, lz] = pts[i];
    glow(ellip(gp, i % 4 === 1 ? '#fff7e0' : '#fecaca', lx, ly - 0.025, lz, 0.016, 0.022, 0.016), i % 4 === 1 ? '#fff7e0' : '#fecaca', i % 4 === 1 ? '#f59e0b' : '#ef4444');
    cyl(gp, '#111827', lx, ly - 0.05, lz, 0.01, 0.005, 8);
    cyl(gp, '#111827', lx, ly - 0.005, lz, 0.01, 0.005, 8);
  }
  // drifting petals
  for (let i = 0; i < 26; i++) {
    const px = (hash3(i, 1, 4) - 0.5) * 0.8, pz = (hash3(i, 2, 4) - 0.5) * 0.7, py = Y + 0.05 + hash3(i, 3, 4) * 0.25;
    add(gp, SPH(6), mat(SAKURA[i % 3]), px, py, pz, 0.012, 0.004, 0.009, hash3(i, 5, 5) * 3, hash3(i, 6, 5));
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// NAADAM 那达慕 — the "three manly games" (wrestling, archery, horse racing) on the grassland of the Yuan summer
// capital Shangdu, where the court met each summer for the 诈马宴 (jisün feast; 周伯琦《诈马行》, 《元史·舆服志》 质孙):
// white felt gers roped over their lattice walls with smoke rising from the crown, a black horse-hair standard (sülde),
// small stocky Mongol horses raced by boys, two bare-chested wrestlers in trousers and boots grappling before an elder
// judge, an archer in a 质孙 robe and round brimmed 钹笠 hat drawing a recurve bow at a felt target, and a noblewoman
// in the tall 罟罟冠 (boqta) watching, on muted late-summer steppe.
// ---------------------------------------------------------------------------------------------------------
function ger(p: THREE.Object3D, x: number, y: number, z: number, r: number, ry: number): void {
  const G = grp(p, x, y, z, ry), wh = r * 0.62, rh = r * 0.5, felt = '#d2c9b4', rope = '#6a5a48';
  // felt walls over the lattice, roof felt rising to the crown ring (toono), girth ropes and roof ropes
  cyl(G, felt, 0, 0, 0, r, wh, 22);
  add(G, g('fs-gerroof', () => new THREE.CylinderGeometry(0.18, 1.05, 1, 22, 1)), mat('#cbc1aa'), 0, wh + rh * 0.4, 0, r, rh * 0.8, r);
  cyl(G, '#5a4a3a', 0, wh + rh * 0.8, 0, r * 0.19, r * 0.04, 12);
  box(G, '#b8ae98', r * 0.08, wh + rh * 0.76, -r * 0.06, r * 0.26, 0.004, r * 0.22, 0.3, 0.25);
  for (const k of [0.2, 0.55, 0.88]) cyl(G, rope, 0, wh * k, 0, r * 1.008, 0.0025, 22);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.15; rod(G, [Math.cos(a) * r * 0.2, wh + rh * 0.8, Math.sin(a) * r * 0.2], [Math.cos(a) * r * 1.05, wh + 0.002, Math.sin(a) * r * 1.05], 0.0012, rope, 3); }
  // a low timber door-frame hung with a quilted felt door
  box(G, '#5a4632', 0, 0, r * 0.985, r * 0.42, wh * 0.86, 0.006);
  box(G, '#8a7a5e', 0, 0.002, r * 0.985 + 0.003, r * 0.34, wh * 0.8, 0.002);
  for (let k = 0; k < 4; k++) box(G, '#6e604a', 0, 0.008 + k * wh * 0.2, r * 0.985 + 0.0042, r * 0.34, 0.0012, 0.0008);
}
/** Black horse-hair standard (sülde / tug): trident head on a disc, a skirt of hair, a stone foot. */
function sulde(p: THREE.Object3D, x: number, y: number, z: number, h: number): void {
  cyl(p, '#8a8478', x, y, z, 0.016, 0.012, 8);
  rod(p, [x, y, z], [x, y + h, z], 0.0025, '#4a3a2a', 5);
  cone(p, '#8a8a80', x, y + h, z, 0.0035, 0.026, 5);
  for (const s of [-1, 1]) rod(p, [x, y + h + 0.004, z], [x + s * 0.008, y + h + 0.018, z], 0.0012, '#8a8a80', 3);
  cyl(p, '#7a7a70', x, y + h - 0.004, z, 0.009, 0.003, 10);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; rod(p, [x + Math.cos(a) * 0.007, y + h - 0.004, z + Math.sin(a) * 0.007], [x + Math.cos(a) * 0.017, y + h - 0.065, z + Math.sin(a) * 0.017], 0.0016, i % 2 ? '#1e1c1a' : '#2a2622', 3); }
}
/** A galloping horse with a boy jockey; group scale puts the withers ≈0.08 (a 13-hand Mongol horse beside 0.11 adults). */
function racer(p: THREE.Object3D, x: number, y: number, z: number, ry: number, coat: string, mane: string, robe: string, ph: number): void {
  const H = grp(p, x, y, z, ry, 0.165);
  const seat = horse(H, coat, mane, { stride: 0.11 + ph * 0.03, cloth: '#5a4a3a', saddle: '#4a3a2a' });
  const h = 0.42;
  const r = human(H, 0, seat - h * 0.2, -0.0, {
    h, pose: 'sit', top: robe, bottom: '#4a4038', shoes: '#2a201a', skin: '#c08a62', hair: '#1c1714', hat: '#3a3028', hatStyle: 'brim', sleeve: 1, lean: 0.45, detail: 'lo',
    feet: [[-0.2, 0.14, 0.1], [0.2, 0.14, 0.1]], hands: [[-0.06, 0.6, 0.42], [0.06, 0.62, 0.42]],
  });
  for (const hd of [r.handL, r.handR]) rod(H, hd, [0, seat + 0.1, 0.27], 0.003, '#2a201a', 3);
  rod(H, r.handR, [0.08, seat + 0.02, -0.12], 0.004, '#5a4632', 3); // whip
}
const fs_naadam: Builder = (gp) => {
  const hill = (x: number, z: number) => sstep(-0.3, -0.5, z) * (0.035 + Math.sin(x * 6 + 1) * 0.012);
  const gr = grass('#7a8050', 20);
  const track = (x: number, z: number) => Math.abs(z - 0.03 - Math.sin(x * 3) * 0.02) < 0.05;
  base(gp, 0.5, '#7a8050', (x, y, z, nx, ny, nz) => {
    if (track(x, z)) return shade('#8a7a5a', 0.88 + hash3(Math.floor(x * 70), 0, Math.floor(z * 70)) * 0.18);
    return fbm(x * 9, 1, z * 9, 2) > 0.62 ? shade('#848458', 0.92 + fbm(x * 30, 0, z * 30, 2) * 0.16) : gr(x, y, z, nx, ny, nz);
  }, '#5a4636', 0.035, hill, 40, 120);
  const Y = 0.035, at = (x: number, z: number) => Y + hill(x, z);
  for (const [gx, gz, r, ry] of [[-0.3, -0.26, 0.1, 0.4], [-0.07, -0.33, 0.085, 0.1], [0.3, -0.26, 0.11, -0.4]] as const) ger(gp, gx, at(gx, gz) - 0.003, gz, r, ry);
  // smoke from the crowns
  const smoke = mat('#c8c4bc', { transparent: 0.2 });
  for (const [sx, sy, sz] of [[-0.3, 0.15, -0.27], [0.3, 0.16, -0.27]] as const) for (let i = 0; i < 4; i++) add(gp, SPH(8), smoke, sx + i * 0.01, Y + sy + i * 0.016, sz - i * 0.004, 0.018 + i * 0.012, 0.022 + i * 0.008, 0.018 + i * 0.012);
  sulde(gp, 0.1, at(0.1, -0.27), -0.27, 0.27);
  // a felt-roofed cart (勒勒车) by the far ger
  {
    const C = grp(gp, -0.42, Y, -0.04, 1.2);
    for (const s of [-1, 1]) { const w = add(C, g('fs-wheel', () => new THREE.TorusGeometry(1, 0.08, 4, 14)), mat('#5a4632'), s * 0.03, 0.035, 0, 0.034, 0.034, 0.034, Math.PI / 2); w.castShadow = true; }
    rod(C, [-0.035, 0.035, 0], [0.035, 0.035, 0], 0.002, '#5a4632', 4);
    box(C, '#6a5640', 0, 0.04, 0, 0.05, 0.004, 0.07);
    ellip(C, '#b8ae98', 0, 0.056, -0.005, 0.022, 0.014, 0.03);
    for (const k of [-0.015, 0.008]) cyl(C, '#5a4a3a', 0, 0.056, k, 0.0225, 0.002, 10).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) rod(C, [s * 0.012, 0.042, 0.035], [s * 0.01, 0.01, 0.12], 0.0018, '#5a4632', 4);
  }
  // the horse race along the worn track
  racer(gp, -0.28, Y, 0.02, -Math.PI / 2, '#6e4a30', '#2a1a10', '#6a3a30', 0);
  racer(gp, -0.03, Y, 0.07, -Math.PI / 2 - 0.08, '#a89a80', '#5a5048', '#3e4a5a', 0.5);
  racer(gp, 0.23, Y, 0.0, -Math.PI / 2 + 0.05, '#4a3a2c', '#1c1612', '#7a6a4a', 1);
  // two bare-chested wrestlers grappling, the elder judge in a robe
  const WS = '#b98a62';
  for (const [wx, ry] of [[-0.25, Math.PI / 2 - 0.15], [-0.17, -Math.PI / 2 - 0.15]] as const) {
    human(gp, wx, Y, 0.26 + (wx + 0.21) * 0.15, {
      h: 0.11, ry, pose: 'stand', top: WS, bottom: '#d0c4a8', skin: WS, shoes: '#3a2a20', socks: '#3a2a20', hair: '#1c1714', sleeve: 0, build: 1.2, lean: 0.42,
      feet: [[-0.1, 0.032, -0.06], [0.1, 0.032, 0.1]], hands: [[-0.1, 0.72, 0.42], [0.1, 0.68, 0.44]],
    });
  }
  const jd = folk(gp, -0.33, Y, 0.37, 0.8, 0.105, '#4a4a40', { bottom: '#3e3a32', dress: 'ankle', hat: '#3a3028', hatStyle: 'brim', hands: [[-0.06, 0.5, 0.14], [0.06, 0.5, 0.14]] });
  ellip(gp, '#d8d4cc', jd.head[0] + Math.sin(0.8) * 0.05 * 0.105, jd.head[1] - 0.06 * 0.105, jd.head[2] + Math.cos(0.8) * 0.05 * 0.105, 0.012 * 0.105, 0.03 * 0.105, 0.01 * 0.105, 0.8);
  // the archer in a 质孙 robe and 钹笠 hat drawing a recurve bow at a felt target
  const ar = folk(gp, 0.12, Y, 0.33, Math.PI / 2 - 0.15, 0.11, '#6a4a3a', {
    dress: 'knee', bottom: '#3e3a32', hat: '#3a3028', hatStyle: 'brim', shoes: '#2a201a', socks: '#2a201a',
    hands: [[-0.03, 0.8, 0.44], [0.07, 0.82, 0.02]],
  });
  {
    const hl = ar.handL, fx = Math.sin(Math.PI / 2 - 0.15), fz = Math.cos(Math.PI / 2 - 0.15);
    const tipU: V3 = [hl[0] - fx * 0.012, hl[1] + 0.06, hl[2] - fz * 0.012], tipD: V3 = [hl[0] - fx * 0.012, hl[1] - 0.055, hl[2] - fz * 0.012];
    tube(gp, [[tipU[0] + fx * 0.006, tipU[1] + 0.006, tipU[2] + fz * 0.006], tipU, [hl[0] - fx * 0.002, hl[1] + 0.03, hl[2] - fz * 0.002], hl, [hl[0] - fx * 0.002, hl[1] - 0.03, hl[2] - fz * 0.002], tipD, [tipD[0] + fx * 0.006, tipD[1] - 0.006, tipD[2] + fz * 0.006]], 0.0018, 0.0018, '#4a3424', { radial: 4, sub: 2 });
    rod(gp, tipU, ar.handR, 0.0005, '#d8d0c0', 3);
    rod(gp, tipD, ar.handR, 0.0005, '#d8d0c0', 3);
    rod(gp, ar.handR, [hl[0] + fx * 0.012, hl[1], hl[2] + fz * 0.012], 0.0009, '#c8bca0', 3);
  }
  const TG = grp(gp, 0.42, Y, 0.2, -Math.PI / 2 + 0.3);
  for (const s of [-1, 1]) rod(TG, [s * 0.022, 0, 0], [s * 0.02, 0.07, 0], 0.0025, '#5a4632', 4);
  box(TG, '#b0a284', 0, 0.025, 0, 0.05, 0.05, 0.006);
  for (const [rr, c] of [[0.018, '#6a3a2e'], [0.008, '#d2c9b4']] as const) { const m = cyl(TG, c, 0, 0.05, 0.004, rr, 0.001, 12); m.rotation.x = Math.PI / 2; m.position.y = 0.05; }
  // spectators by the gers: a noblewoman in the tall 罟罟冠 and two men seated on felt
  const nb = folk(gp, 0.02, at(0.02, -0.18), -0.18, 0.15, 0.1, '#6a3a34', { bottom: '#5a3430', hair: '#1a1512', hands: [[-0.05, 0.5, 0.12], [0.05, 0.5, 0.12]] });
  {
    const [x, y, z] = nb.head, hh = 0.1;
    ellip(gp, '#3a2422', x, y + 0.03 * hh, z, 0.06 * hh, 0.05 * hh, 0.064 * hh);
    add(gp, g('fs-boqta', () => new THREE.CylinderGeometry(0.6, 0.4, 1, 10)), mat('#5a2a26'), x, y + 0.27 * hh, z - 0.02 * hh, 0.15 * hh, 0.38 * hh, 0.13 * hh, 0, -0.15);
    cyl(gp, '#a88a4a', x, y + 0.45 * hh, z - 0.05 * hh, 0.09 * hh, 0.012 * hh, 10);
    rod(gp, [x, y + 0.46 * hh, z - 0.05 * hh], [x - 0.003, y + 0.66 * hh, z - 0.1 * hh], 0.0010, '#3a3430', 3);
  }
  box(gp, '#a89878', -0.06, Y, 0.38, 0.08, 0.002, 0.05, -0.3);
  for (const [sx, c] of [[-0.08, '#4a5262'], [-0.04, '#5a4a3a']] as const) folk(gp, sx, Y + 0.002, 0.38 + (sx + 0.06) * 0.3, Math.PI - 0.6, 0.1, c, { pose: 'sitGround', hat: '#3a3028', hatStyle: 'brim', dress: 'knee' });
  fuse(gp);
};

export const H_FESTIVALS: Record<string, Builder> = {
  fs_springfestival, fs_lantern, fs_dragonboat, fs_midautumn, fs_harbin, fs_rio, fs_venice,
  fs_holi, fs_diwali, fs_songkran, fs_oktoberfest, fs_tomatina, fs_dayofdead, fs_hanami, fs_naadam,
};
