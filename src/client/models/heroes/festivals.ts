import { human, type HumanOpts, type HumanRig } from '../human.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, gable, slab, lathe, rod, sweep,
  shade, hash3, fbm, SPH, paintFaces, plinth, PLINTH_SIDE, SITE,
} from '../prims.ts';
import { island, sstep } from '../nature.ts';
import { horse } from '../animals.ts';

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
/** Pull a candy colour toward a museum-miniature pigment: saturation above `smax` is compressed, bright saturated tones darkened. */
/** Mute every material / vertex colour under `root` (call before fuse); materials and painted geometry are cloned, never the shared caches. */
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
 * Round plaza on the shared museum plinth (prims.plinth, uniform PLINTH_SIDE skirt): square-grid top (cells of R*2/n, so paving/tiles paint cleanly per cell) clipped to a circle,
 * with a vertical skirt. Paint is evaluated per triangle centroid.
 */
function plaza(gp: THREE.Object3D, R: number, h: number, n: number, paint: Paint, _side?: string): void {
  const cs = (R * 2) / n, pos: number[] = [], Rc = R * 0.965;
  const clamp = (x: number, z: number): [number, number] => { const d = Math.hypot(x, z); return d > Rc ? [(x / d) * Rc, (z / d) * Rc] : [x, z]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -R + i * cs, z0 = -R + j * cs;
    if (Math.hypot(x0 + cs / 2, z0 + cs / 2) > Rc + cs * 0.5) continue;
    const a = clamp(x0, z0), b = clamp(x0 + cs, z0), c = clamp(x0 + cs, z0 + cs), d = clamp(x0, z0 + cs);
    pos.push(a[0], h, a[1], d[0], h, d[1], c[0], h, c[1], a[0], h, a[1], c[0], h, c[1], b[0], h, b[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  add(gp, paintFaces(geo, '#ffffff', paint), mat('#ffffff', { vc: true, flat: true }), 0, 0, 0, 1, 1, 1);
  plinth(gp, SITE.paving, { R, h: h - 0.002 });
}

/**
 * Round base with a painted top (rings × segs polar grid). Flat sites sit on the shared museum plinth; sculpted
 * ones (hf given) keep their terrain with the same PLINTH_SIDE skirt. `_side` is ignored (one base for every model).
 */
function base(gp: THREE.Object3D, R: number, top: string, paint: Paint, _side?: string, h = 0.035, hf?: (x: number, z: number) => number, rings = 14, segs = 64): void {
  if (!hf) {
    plinth(gp, top, { R, h: h - 0.002 });
    island(gp, R * 0.965, () => 0, top, paint, { rings, segs, base: h, side: () => PLINTH_SIDE });
    return;
  }
  island(gp, R, hf, top, paint, { rings, segs, base: h, side: (y) => (y > h * 0.55 ? PLINTH_SIDE : shade(PLINTH_SIDE, 0.85)) });
}

/** Mortar-less stones for plaza(): s should be a multiple of the plaza cell so each stone is whole cells. */
const stones = (c: string, s: number, k = 0.2): Paint => (x, _y, z) => {
  const v = Math.floor(z / s + 1e-4), u = Math.floor(x / s + (v % 2) * 0.5 + 1e-4);
  return shade(c, 1 - k / 2 + hash3(u, 7, v) * k);
};
const grass = (c: string, k = 30): Paint => (x, _y, z) => shade(c, 0.88 + fbm(x * k, 0, z * k, 2) * 0.28);


/** Chibi festival-goer (≈0.12 tall at s=1): legs, rounded torso, big head with hair, arms reaching to hand targets. */

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
// Ref: Commons "清明上河图" Qing court version market scenes — red couplets, lanterns and crowds before tiled gateways.
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
// Ref: Commons "Ming Emperor Xianzong Enjoying the Lantern Festival (Ming Dynasty).jpg" — lantern towers, red silk, courtiers.
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
  base(gp, 0.5, '#958468', paint, '#5a4636', 0.035, undefined, 18, 64);
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
// Ref: Commons "Dragon boat race" photos — long narrow hull, carved dragon head and tail, paddlers in pairs, drummer at the bow.
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
// Ref: Commons "Teisai Hokuba - Woman Looking at the Moon" and Song moon-viewing pavilion paintings — muted night palette.
const fs_midautumn: Builder = (gp) => {
  const Y = 0.035, PX = 0.22, PZ = 0.22;
  const pond = (x: number, z: number) => Math.hypot((x - PX) / 0.16, (z - PZ) / 0.105);
  const gr = grass('#5e6a46', 26);
  base(gp, 0.5, '#5e6a46', (x, y, z, nx, ny, nz) => (pond(x, z) < 1 ? shade('#2e3a3a', 0.9 + fbm(x * 30, 0, z * 30, 2) * 0.15) : gr(x, y, z, nx, ny, nz)), '#5a4a3a', 0.035, undefined, 40, 120);
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
// Ref: Commons "Naadam 2023 - Horse racing 06/11.jpg" — small stocky horses ridden by boys in coloured silks on green steppe.
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
export const H_FESTIVALS: Record<string, Builder> = { fs_springfestival, fs_lantern, fs_dragonboat, fs_midautumn, fs_naadam };
