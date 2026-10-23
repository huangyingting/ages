import { human } from '../human.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, gable, slab, lathe, rod, sweep,
  shade, mix, hash3, fbm, SPH, paintFaces,
} from '../prims.ts';
import { island, ripple, sstep } from '../nature.ts';
import { pblob } from '../animals.ts';

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

/** Paving: stones of size s in running bond with mortar lines and tonal variation. */
const pavers = (c: string, s = 0.045, mortar = 0.12): Paint => (x, _y, z) => {
  const v = z / s, u = x / s + (Math.floor(v) % 2) * 0.5;
  const fu = u - Math.floor(u), fv = v - Math.floor(v);
  if (fu < mortar || fv < mortar) return shade(c, 0.8);
  return shade(c, 0.92 + hash3(Math.floor(u), 0, Math.floor(v)) * 0.16);
};
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
// SPRING FESTIVAL — a courtyard gate dressed for New Year: red doors with gold studs and 福 diamonds, couplets
// either side, horizontal banner, upturned tiled roof hung with glowing red lanterns; a red-and-gold lion dance
// (two dancers' legs under the cloth) prances on the paving; firecracker strings dangle from bamboo poles.
// ---------------------------------------------------------------------------------------------------------
const fs_springfestival: Builder = (gp) => {
  const pv = stones('#a8a29e', 1 / 24, 0.3);
  const confetti: Paint = (x, y, z, nx, ny, nz) => (hash3(Math.floor(x * 48 + 24), 1, Math.floor(z * 48 + 24)) > 0.93 ? '#dc2626' : pv(x, y, z, nx, ny, nz));
  plaza(gp, 0.5, 0.035, 48, confetti, '#7c6a58');
  const Y = 0.035;
  // gate: grey brick wall wings, red pillars, doors
  const G = grp(gp, 0, Y, -0.2);
  for (const sx of [-1, 1]) {
    box(G, '#8f8a84', sx * 0.3, 0, -0.01, 0.2, 0.26, 0.06);
    for (let r = 1; r < 9; r++) box(G, '#78726b', sx * 0.3, r * 0.029, 0.0205, 0.2, 0.002, 0.002);
    box(G, '#57534e', sx * 0.3, 0.26, -0.01, 0.22, 0.016, 0.08);
    gable(G, 0.22, 0.025, 0.08, '#44403c', sx * 0.3, 0.276, -0.01);
  }
  box(G, '#6b6560', 0, 0, 0.02, 0.44, 0.02, 0.1);
  for (const sx of [-1, 1]) {
    box(G, '#78716c', sx * 0.17, 0, 0.03, 0.05, 0.025, 0.05);
    cyl(G, '#b91c1c', sx * 0.17, 0.02, 0.03, 0.021, 0.29, 12);
    // couplet board on the pillar
    box(G, '#dc2626', sx * 0.17, 0.06, 0.053, 0.032, 0.2, 0.004);
    for (let k = 0; k < 7; k++) box(G, '#fbbf24', sx * 0.17, 0.072 + k * 0.026, 0.056, 0.016, 0.014, 0.002);
  }
  // doors with studs and fu diamonds
  box(G, '#7f1d1d', 0, 0.02, 0.005, 0.3, 0.27, 0.02);
  for (const sx of [-1, 1]) {
    box(G, '#c81e1e', sx * 0.068, 0.025, 0.017, 0.128, 0.25, 0.01);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) dot(G, '#e0b23a', sx * (0.03 + c * 0.03), 0.05 + r * 0.03, 0.024, 0.005, 6);
    const fu = grp(G, sx * 0.068, 0.2, 0.024);
    box(fu, '#ef4444', 0, -0.025, 0, 0.05, 0.05, 0.004, 0, 0, Math.PI / 4).position.y = 0;
    box(fu, '#fbbf24', 0, -0.012, 0.003, 0.02, 0.018, 0.002);
    box(fu, '#fbbf24', 0, 0.002, 0.003, 0.026, 0.005, 0.002);
    dot(G, '#e0b23a', sx * 0.014, 0.14, 0.03, 0.009, 8);
  }
  // lintel and horizontal banner
  box(G, '#b91c1c', 0, 0.29, 0.02, 0.42, 0.04, 0.07);
  box(G, '#dc2626', 0, 0.296, 0.057, 0.2, 0.028, 0.004);
  for (let k = 0; k < 4; k++) box(G, '#fbbf24', -0.06 + k * 0.04, 0.302, 0.06, 0.016, 0.015, 0.002);
  for (let k = 0; k < 9; k++) box(G, k % 2 ? '#15803d' : '#1d4ed8', -0.19 + k * 0.0475, 0.33, 0.054, 0.04, 0.012, 0.003);
  cnRoof(G, 0, 0.345, 0.015, 0.56, 0.2, 0.09, '#3f3f46');
  for (const sx of [-1, 1]) {
    rod(G, [sx * 0.11, 0.345, 0.1], [sx * 0.11, 0.315, 0.1], 0.002, '#1f2937');
    redLantern(G, sx * 0.11, 0.315, 0.1, 0.04);
  }
  // lantern string across bamboo poles at the sides
  for (const sx of [-1, 1]) cyl(gp, '#a3a35a', sx * 0.43, Y, 0.0, 0.008, 0.42, 7);
  const pts: V3[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-0.43 + t * 0.86, Y + 0.44 - Math.sin(t * Math.PI) * 0.06, Math.sin(t * Math.PI) * 0.06]); }
  tube(gp, pts, 0.0025, 0.0025, '#1f2937', { radial: 5, sub: 3 });
  for (let i = 1; i < 10; i += 2) { const [px, py, pz] = pts[i]; redLantern(gp, px, py, pz, 0.026); }
  // firecracker strings hanging from the poles
  for (const sx of [-1, 1]) {
    const fx = sx * 0.43 - sx * 0.03;
    rod(gp, [sx * 0.43, Y + 0.38, 0], [fx, Y + 0.37, 0.02], 0.003, '#a3a35a');
    for (let k = 0; k < 18; k++) {
      const yy = Y + 0.35 - k * 0.014, a = k * 1.9;
      const m = cyl(gp, k % 6 === 5 ? '#fbbf24' : '#dc2626', fx + Math.cos(a) * 0.009, yy, 0.02 + Math.sin(a) * 0.009, 0.0045, 0.022, 6);
      m.rotation.z = Math.cos(a) * 0.9; m.rotation.x = Math.sin(a) * 0.9;
    }
    cone(gp, '#fbbf24', fx, Y + 0.09, 0.02, 0.008, 0.02, 6).rotation.x = Math.PI;
  }
  // lion dance
  const L = grp(gp, 0.02, Y, 0.14, -0.35);
  const red = '#dc2626', gold = '#f5b301';
  const scales: Paint = (x, y, z) => {
    const k = Math.floor(x * 70 + (Math.floor(y * 70) % 2) * 0.5);
    return y < 0.075 ? '#fef3c7' : (k + Math.floor(y * 70)) % 3 === 0 ? gold : (z > 0.02 ? red : shade(red, 0.9));
  };
  sweep(L, [
    { p: [0, 0.14, 0.02], w: 0.055, h: 0.05 }, { p: [0, 0.155, -0.06], w: 0.065, h: 0.06 }, { p: [0, 0.13, -0.15], w: 0.062, h: 0.055 },
    { p: [0, 0.11, -0.22], w: 0.05, h: 0.045 }, { p: [0, 0.1, -0.25], w: 0.02, h: 0.02 },
  ], red, { paint: scales, squash: 0.85 });
  for (let i = 0; i < 14; i++) {
    const t = i / 13, zz = -t * 0.24;
    for (const sx of [-1, 1]) dot(L, '#fff7ed', sx * (0.06 - Math.abs(t - 0.4) * 0.03), 0.09 + Math.sin(t * 3) * 0.012, zz, 0.012, 6);
  }
  ellip(L, '#fbbf24', 0, 0.1, -0.255, 0.02, 0.024, 0.016);
  for (const [lz, ph] of [[-0.01, 0], [-0.19, 1]] as const) for (const sx of [-1, 1]) {
    const lift = (sx > 0) === (ph > 0) ? 0.025 : 0;
    rod(L, [sx * 0.025, 0.11, lz], [sx * 0.03, 0.03 + lift, lz + 0.01], 0.013, '#fbbf24', 7);
    rod(L, [sx * 0.03, 0.03 + lift, lz + 0.01], [sx * 0.03, 0.008 + lift, lz + 0.012], 0.01, '#fde68a', 7);
    ellip(L, '#111827', sx * 0.03, 0.006 + lift, lz + 0.022, 0.011, 0.007, 0.018);
  }
  const H = grp(L, 0, 0.19, 0.06, 0);
  H.rotation.x = -0.12;
  pblob(H, red, 0, 0.03, 0, 0.085, 0.075, 0.075, (x, y) => (y > 0.08 ? gold : Math.abs(x) > 0.06 ? '#16a34a' : red), [0, 0, 0], 18);
  ellip(H, gold, 0, 0.055, 0.06, 0.07, 0.035, 0.03);
  glow(ellip(H, '#e0f2fe', 0, 0.075, 0.075, 0.015, 0.015, 0.006), '#e0f2fe', '#7dd3fc');
  cone(H, gold, 0, 0.1, 0.035, 0.012, 0.045, 8).rotation.x = 0.5;
  for (const sx of [-1, 1]) {
    ellip(H, '#ffffff', sx * 0.033, 0.035, 0.068, 0.024, 0.022, 0.016);
    ellip(H, '#111827', sx * 0.033, 0.035, 0.082, 0.012, 0.013, 0.006);
    dot(H, '#ffffff', sx * 0.033 + 0.004, 0.04, 0.088, 0.0035, 6);
    ellip(H, '#16a34a', sx * 0.034, 0.06, 0.07, 0.026, 0.008, 0.012);
    ellip(H, red, sx * 0.075, 0.07, -0.01, 0.018, 0.03, 0.01, 0, 0, sx * 0.4);
  }
  ellip(H, '#fde68a', 0, 0.002, 0.075, 0.05, 0.022, 0.03);
  ellip(H, '#7f1d1d', 0, -0.022, 0.06, 0.05, 0.015, 0.035);
  pblob(H, red, 0, -0.045, 0.055, 0.06, 0.018, 0.04, (_x, y) => (y < -0.05 ? '#ffffff' : red), [0.25, 0, 0], 14);
  for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225; dot(H, '#ffffff', Math.sin(a) * 0.075, -0.06, 0.05 + Math.cos(a) * 0.035, 0.012, 6); }
  for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; dot(H, '#ffffff', Math.sin(a) * 0.085, 0.07 + Math.cos(a) * 0.02, 0.03 + Math.cos(a) * 0.04, 0.01, 6); }
  // children cheering, one with a red envelope
  kid(gp, -0.3, Y, 0.2, 0.5, { shirt: '#dc2626', pants: '#1e3a8a', hands: [[-0.03, 0.12, 0.01], [0.028, 0.07, 0.035]] }, 1.05);
  box(gp, '#dc2626', -0.288, Y + 0.071, 0.24, 0.018, 0.025, 0.004, 0.5);
  kid(gp, 0.3, Y, 0.24, -0.6, { shirt: '#f59e0b', pants: '#7f1d1d', dress: true, hands: UP }, 1.0);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// PINGXI SKY LANTERNS — a hillside mining-village street with the little Pingxi railway running through it;
// two people release a big paper lantern from the tracks while dozens more glow as they drift upward.
// ---------------------------------------------------------------------------------------------------------
const SKYL = () => g('fs-skylantern', () => { const c = new THREE.CylinderGeometry(0.5, 0.4, 1, 4, 1, false); c.rotateY(Math.PI / 4); return c; });
function skyLantern(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, e: string, ry = 0): void {
  add(p, SKYL(), mat(c, { emissive: e }), x, y + s * 0.5, z, s * 0.8, s, s * 0.8, ry);
  dotE(p, '#fff7cc', '#ffd27a', x, y - s * 0.02, z, s * 0.14, 6);
}
const fs_lantern: Builder = (gp) => {
  const hf = (x: number, z: number) => sstep(-0.05, -0.45, z) * 0.12 + fbm(x * 6, 0, z * 6, 2) * 0.02 * sstep(-0.1, -0.4, z);
  const pv = pavers('#8b8580', 0.03);
  const paint: Paint = (x, y, z, nx, ny, nz) => {
    if (Math.abs(z - 0.04) < 0.05) return pv(x, y, z, nx, ny, nz);
    return z < -0.15 ? shade('#3f6b3a', 0.85 + fbm(x * 30, 0, z * 30, 2) * 0.3) : shade('#78716c', 0.9 + hash3(Math.floor(x * 50), 0, Math.floor(z * 50)) * 0.15);
  };
  base(gp, 0.5, '#78716c', paint, '#5a4636', 0.035, hf, 18, 64);
  const Y = 0.035;
  // railway across the street: ballast, sleepers, rails
  box(gp, '#57534e', 0, Y - 0.002, 0.04, 0.98, 0.006, 0.07);
  for (let i = 0; i < 24; i++) box(gp, '#5b4636', -0.46 + i * 0.04, Y + 0.002, 0.04, 0.012, 0.004, 0.06);
  for (const dz of [-0.018, 0.018]) box(gp, '#9ca3af', 0, Y + 0.006, 0.04 + dz, 0.97, 0.005, 0.004);
  // old two-storey shophouses along the back of the street
  const HOUSES: [number, number, string, string][] = [[-0.33, 0.17, '#cbbfa8', '#7c2d12'], [-0.14, 0.2, '#a8b3b8', '#475569'], [0.07, 0.15, '#d6c7a1', '#7c2d12'], [0.27, 0.19, '#b7aa95', '#334155']];
  for (const [hx, hh, wall, roof] of HOUSES) {
    const hz = -0.12, w = 0.18;
    box(gp, wall, hx, Y, hz, w, hh, 0.12);
    for (let fl = 0; fl < 2; fl++) for (let k = 0; k < 3; k++) {
      const wy = Y + 0.03 + fl * hh * 0.48, wx = hx - w / 3 + (k * w) / 3;
      glow(box(gp, '#ffd58a', wx, wy, hz + 0.061, 0.035, 0.04, 0.003), '#ffd58a', '#f59e0b');
      box(gp, shade(wall, 0.7), wx, wy - 0.004, hz + 0.062, 0.042, 0.004, 0.006);
    }
    box(gp, '#b91c1c', hx, Y + hh * 0.5 - 0.02, hz + 0.066, w * 0.8, 0.018, 0.006);
    box(gp, roof, hx, Y + hh, hz, w + 0.02, 0.012, 0.14);
    box(gp, shade(roof, 1.15), hx, Y + 0.075, hz + 0.08, w, 0.006, 0.05);
  }
  for (let i = 0; i < 9; i++) redLantern(gp, -0.4 + i * 0.1, Y + 0.13, -0.035, 0.014);
  // two people releasing a big lantern on the tracks
  kid(gp, -0.06, Y, 0.06, 0.25, { shirt: '#2563eb', pants: '#1f2937', hands: [[-0.024, 0.11, 0.03], [0.03, 0.16, 0.04]] });
  kid(gp, 0.075, Y, 0.06, -0.25, { shirt: '#f97316', pants: '#334155', hands: [[-0.03, 0.16, 0.04], [0.024, 0.11, 0.03]] });
  skyLantern(gp, 0.008, Y + 0.12, 0.075, 0.11, '#fde68a', '#f59e0b');
  for (let k = 0; k < 4; k++) {
    const a = (k * TAU) / 4 + 0.78;
    box(gp, '#b91c1c', 0.008 + Math.cos(a) * 0.039, Y + 0.17, 0.075 + Math.sin(a) * 0.039, 0.012, 0.04, 0.012, a);
  }
  // the drifting flock: a rising, widening spiral of warm lanterns
  const TINTS: [string, string][] = [['#ffb347', '#ea7a12'], ['#ffd27a', '#f59e0b'], ['#ff8f6b', '#e5532a'], ['#ffe8a3', '#f2b233'], ['#ff9fb3', '#e85c7a']];
  for (let i = 0; i < 26; i++) {
    const t = i / 25, a = i * 2.4 + 0.5, rr = 0.06 + t * 0.32 + hash3(i, 2, 3) * 0.06;
    const [c, e] = TINTS[i % TINTS.length];
    skyLantern(gp, Math.cos(a) * rr, Y + 0.3 + t * 0.55 + hash3(i, 5, 1) * 0.05, 0.02 + Math.sin(a) * rr * 0.8, 0.075 - t * 0.04, c, e, a);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DRAGON BOAT — a long scaled racing boat with a carved dragon head (open jaws, horns, whiskers, mane) and a
// curling tail; paired paddlers dig in while a drummer at the bow beats time and the steerer leans on his oar.
// River water with ripples, a grassy bank with a red-pillared pavilion and cheering spectators behind.
// ---------------------------------------------------------------------------------------------------------
function paddler(p: THREE.Object3D, x: number, y: number, z: number, side: number, shirt: string, ph: number): void {
  // seated, facing +x; `side` = which world-z side the paddle goes in
  const f = grp(p, x, y, z, Math.PI / 2);
  const out = -side; // local x pointing outboard
  const h = 0.1, y0 = 0.004 - 0.2 * h;
  // hands in rig space: top hand over the inboard knee at brow height, lower hand outboard by the hip; phase = catch / pull
  const topU: V3 = [out * 0.04, 0.66 - ph * 0.06, 0.34 - ph * 0.1], lowU: V3 = [out * 0.27, 0.3, 0.28 - ph * 0.12];
  const F = (v: V3): V3 => [v[0] * h, v[1] * h + y0, v[2] * h];
  const top = F(topU), low = F(lowU);
  // shaft through both hands, from just above the grip down to the blade in the water
  const d = [low[0] - top[0], low[1] - top[1], low[2] - top[2]], t = (-0.04 - top[1]) / d[1];
  const grip: V3 = [top[0] - d[0] * 0.15, top[1] - d[1] * 0.15, top[2] - d[2] * 0.15];
  const blade: V3 = [top[0] + d[0] * t, -0.04, top[2] + d[2] * t];
  rod(f, grip, blade, 0.0022, '#a16207', 5);
  ellip(f, '#c2410c', blade[0], blade[1] + 0.008, blade[2], 0.003, 0.014, 0.008);
  const rig = human(f, 0, y0, 0, {
    h, pose: 'row', top: shirt, bottom: '#1f2937', skin: '#d9a27a', hair: '#1c1917', sleeve: 0.4, detail: 'lo',
    hands: out > 0 ? [topU, lowU] : [lowU, topU], feet: [[-0.07, 0.03, 0.3], [0.07, 0.03, 0.3]],
  });
  cyl(f, '#dc2626', rig.head[0], rig.head[1] - 0.0005, rig.head[2], 0.0068, 0.0022, 8); // headband
}
const fs_dragonboat: Builder = (gp) => {
  const hf = (x: number, z: number) => sstep(-0.24, -0.36, z) * (0.05 + fbm(x * 8, 1, z * 8, 2) * 0.01);
  const water = ripple('#2f8fb8');
  const paint: Paint = (x, y, z, nx, ny, nz) => {
    if (y < 0.038) return water(x, y, z, nx, ny, nz);
    if (y < 0.06 && ny < 0.8) return shade('#9ca3af', 0.85 + hash3(Math.floor(x * 60), Math.floor(y * 120), 1) * 0.2);
    return shade('#5f9a46', 0.88 + fbm(x * 30, 0, z * 30, 2) * 0.25);
  };
  base(gp, 0.5, '#2f8fb8', paint, '#5a4636', 0.035, hf, 22, 72);
  const W = 0.036;
  // pavilion on the bank and flags
  const P = grp(gp, -0.22, 0.083, -0.39, 0.1);
  box(P, '#d6d3d1', 0, 0, 0, 0.16, 0.012, 0.09);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(P, '#b91c1c', sx * 0.065, 0.012, sz * 0.032, 0.007, 0.08, 8);
  box(P, '#7f1d1d', 0, 0.09, 0, 0.15, 0.01, 0.08);
  cnRoof(P, 0, 0.095, 0, 0.21, 0.13, 0.05, '#166534');
  for (let i = 0; i < 4; i++) {
    const fx = 0.02 + i * 0.1, fz = -0.36 + (i % 2) * 0.02;
    cyl(gp, '#e7e5e4', fx, 0.08, fz, 0.003, 0.14, 5);
    slab(grp(gp, fx + 0.002, 0.18, fz), [[0, 0], [0.05, 0.005], [0.045, 0.03], [0, 0.035]], 0.002, ['#dc2626', '#facc15', '#16a34a', '#2563eb'][i], 0, false);
  }
  for (let i = 0; i < 5; i++) kid(gp, 0.07 + i * 0.075, 0.083, -0.31 - (i % 2) * 0.03, 0, { shirt: ['#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#10b981'][i], hands: i % 2 ? UP : FWD }, 0.7);
  // hull
  const B = grp(gp, 0, 0, 0.06);
  const hullPaint: Paint = (x, y) => {
    if (y > 0.058) return '#b91c1c';
    if (y > 0.053) return '#f5b301';
    const v = Math.floor(y * 220), u = Math.floor(x * 110 + (v % 2) * 0.5);
    return (u + v) % 2 ? '#0f766e' : '#14a38a';
  };
  sweep(B, [
    { p: [-0.4, 0.058, 0], w: 0.01, h: 0.01 }, { p: [-0.36, 0.05, 0], w: 0.03, h: 0.016 }, { p: [-0.2, 0.046, 0], w: 0.046, h: 0.02 },
    { p: [0.12, 0.046, 0], w: 0.046, h: 0.02 }, { p: [0.3, 0.05, 0], w: 0.032, h: 0.017 }, { p: [0.37, 0.058, 0], w: 0.012, h: 0.012 },
  ], '#0f766e', { paint: hullPaint, squash: 0.7, radial: 16, sub: 5 });
  box(B, '#8a5a35', -0.04, 0.06, 0, 0.6, 0.004, 0.07);
  for (const sz of [-1, 1]) {
    const rail: V3[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = -0.37 + t * 0.72; rail.push([x, 0.064 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.006, sz * (0.046 - Math.pow(Math.abs(t - 0.45) * 2, 2.2) * 0.033)]); }
    tube(B, rail, 0.003, 0.003, '#f5b301', { radial: 5, sub: 3 });
  }
  // paddlers in pairs (gold shirts), alternating stroke phase
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) paddler(B, -0.27 + i * 0.075, 0.062, side * 0.022, side, '#facc15', i % 2 ? 1 : 0);
  // splashes along the paddles
  for (let i = 0; i < 14; i++) dot(B, '#e0f2fe', -0.26 + (i >> 1) * 0.075 + 0.04, W + 0.002, (i % 2 ? 1 : -1) * 0.085, 0.008 + hash3(i, 3, 3) * 0.004, 6);
  // drummer at the bow, facing the crew
  const D = grp(B, 0.27, 0.062, 0, -Math.PI / 2);
  ellip(D, '#dc2626', 0, 0.026, 0, 0.017, 0.024, 0.014);
  ellip(D, '#d9a27a', 0, 0.06, 0.004, 0.014, 0.015, 0.014);
  ellip(D, '#1c1917', 0, 0.066, 0, 0.0145, 0.011, 0.014);
  cyl(D, '#7c2d12', 0, 0.0, 0.05, 0.028, 0.04, 14);
  cyl(D, '#fde68a', 0, 0.04, 0.05, 0.026, 0.004, 14);
  for (const sx of [-1, 1]) {
    rod(D, [sx * 0.016, 0.042, 0.004], [sx * 0.022, 0.07, 0.025], 0.0045, '#dc2626', 5);
    rod(D, [sx * 0.022, 0.07, 0.025], [sx * 0.012, 0.09, 0.04], 0.0025, '#78350f', 5);
    dot(D, '#facc15', sx * 0.012, 0.09, 0.04, 0.005, 6);
  }
  // steerer standing at the stern with the long oar
  kid(B, -0.34, 0.06, 0, Math.PI / 2, { shirt: '#dc2626', pants: '#1f2937', hands: [[-0.01, 0.08, 0.03], [0.012, 0.09, 0.035]] }, 0.75);
  rod(B, [-0.33, 0.13, 0.005], [-0.46, 0.02, 0.03], 0.003, '#a16207', 5);
  ellip(B, '#a16207', -0.465, 0.03, 0.03, 0.004, 0.02, 0.009, 0, 0, 0.8);
  // dragon head on an arching neck
  sweep(B, [{ p: [0.34, 0.056, 0], w: 0.018, h: 0.016 }, { p: [0.38, 0.08, 0], w: 0.016, h: 0.016 }, { p: [0.4, 0.12, 0], w: 0.017, h: 0.018 }, { p: [0.415, 0.145, 0], w: 0.02, h: 0.02 }],
    '#0f766e', { paint: (_x, y) => (Math.floor(y * 180) % 2 ? '#0f766e' : '#14a38a') });
  const Hd = grp(B, 0.42, 0.155, 0, Math.PI / 2);
  pblob(Hd, '#f5b301', 0, 0.006, 0.01, 0.03, 0.026, 0.038, (_x, y) => (y > 0.02 ? '#16a34a' : '#f5b301'), [0, 0, 0], 14);
  ellip(Hd, '#f5b301', 0, 0.006, 0.05, 0.022, 0.016, 0.032, 0, 0.15, 0);
  ellip(Hd, '#dc2626', 0, 0.014, 0.08, 0.014, 0.011, 0.01);
  ellip(Hd, '#7f1d1d', 0, -0.012, 0.045, 0.019, 0.006, 0.028);
  ellip(Hd, '#dc2626', 0, -0.024, 0.04, 0.017, 0.007, 0.03, 0, -0.3, 0);
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) cone(Hd, '#ffffff', sx * 0.012, -0.012, 0.03 + i * 0.012, 0.0028, 0.008, 5).rotation.x = Math.PI;
  for (const sx of [-1, 1]) {
    ellip(Hd, '#ffffff', sx * 0.02, 0.026, 0.02, 0.011, 0.011, 0.009);
    ellip(Hd, '#111827', sx * 0.022, 0.027, 0.027, 0.0055, 0.006, 0.004);
    ellip(Hd, '#dc2626', sx * 0.02, 0.036, 0.018, 0.013, 0.004, 0.008, 0, 0, sx * 0.25);
    tube(Hd, [[sx * 0.012, 0.03, -0.01], [sx * 0.02, 0.06, -0.03], [sx * 0.025, 0.085, -0.06]], 0.0045, 0.0025, '#d97706', { radial: 6, sub: 3 });
    tube(Hd, [[sx * 0.02, 0.06, -0.03], [sx * 0.032, 0.07, -0.02]], 0.003, 0.002, '#d97706', { radial: 6, sub: 2 });
    tube(Hd, [[sx * 0.012, 0.004, 0.075], [sx * 0.04, 0.0, 0.07], [sx * 0.06, -0.015, 0.05], [sx * 0.065, -0.035, 0.035]], 0.0018, 0.001, '#facc15', { radial: 5, sub: 3 });
    for (let k = 0; k < 4; k++) cone(Hd, k % 2 ? '#dc2626' : '#16a34a', sx * 0.022, 0.0 - k * 0.006, -0.02 - k * 0.01, 0.007, 0.03, 5).rotation.set(-1.3, 0, sx * 0.9);
  }
  for (let k = 0; k < 5; k++) cone(Hd, k % 2 ? '#dc2626' : '#16a34a', 0, 0.03 - k * 0.012, -0.015 - k * 0.012, 0.008, 0.028, 5).rotation.x = -1.0;
  ellip(Hd, '#ffffff', 0, -0.036, 0.03, 0.01, 0.014, 0.008);
  // curling tail with a fin
  tube(B, [[-0.39, 0.058, 0], [-0.43, 0.08, 0], [-0.45, 0.12, 0], [-0.44, 0.155, 0], [-0.415, 0.165, 0]], 0.012, 0.004, '#0f766e', { radial: 8, sub: 4 });
  slab(grp(B, -0.45, 0.13, 0), [[0, -0.02], [-0.035, 0.0], [-0.03, 0.03], [-0.01, 0.05], [0.0, 0.02]], 0.004, '#dc2626', 0, true);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// MID-AUTUMN — a huge glowing full moon (craters and the jade rabbit's silhouette) rises behind a garden
// party: a red lacquer table with mooncakes and tea, a white rabbit lantern on wheels pulled by a child, a
// line of lanterns (round, star, carp) strung between posts and a golden osmanthus tree.
// ---------------------------------------------------------------------------------------------------------
const fs_midautumn: Builder = (gp) => {
  const st = stones('#b8b2a7', 1 / 24, 0.25), gr = grass('#4f8a3c', 26);
  plaza(gp, 0.5, 0.035, 48, (x, y, z, nx, ny, nz) => (Math.abs(x + z * 0.3) < 0.14 && z > -0.25 ? st(x, y, z, nx, ny, nz) : gr(x, y, z, nx, ny, nz)), '#6b5040');
  const Y = 0.035;
  // moon disc with craters and rabbit silhouette
  const M = grp(gp, 0.04, 0.45, -0.36, 0, 0.8);
  const disc = cyl(M, '#fff1b8', 0, -0.012, 0, 0.27, 0.024, 40); disc.rotation.x = Math.PI / 2; disc.position.set(0, 0, 0);
  glow(disc, '#fff1b8', '#ffd76a');
  const CR: [number, number, number][] = [[-0.12, 0.1, 0.05], [0.1, 0.14, 0.035], [0.15, -0.06, 0.045], [-0.05, -0.15, 0.03], [-0.17, -0.06, 0.025], [0.04, 0.02, 0.02]];
  for (const [cx, cy, cr] of CR) { const c2 = cyl(M, '#f3d98a', 0, 0, 0, cr, 0.004, 16); c2.rotation.x = Math.PI / 2; c2.position.set(cx, cy, 0.013); glow(c2, '#f6dc8f', '#e8b94a'); }
  // jade rabbit silhouette (slightly darker gold)
  const rb = grp(M, -0.02, -0.06, 0.016);
  for (const [ex, ey, erx, ery, rz] of [[0, 0, 0.05, 0.035, 0], [0.045, 0.03, 0.025, 0.022, 0], [0.04, 0.075, 0.008, 0.03, 0.2], [0.055, 0.072, 0.008, 0.028, -0.25], [-0.05, -0.005, 0.014, 0.014, 0]] as const) {
    const e = ellip(rb, '#f0cf78', ex, ey, 0, erx, ery, 0.002, 0, 0, rz); glow(e, '#f0cf78', '#d9a43a');
  }
  // soft clouds drifting across the moon foot
  for (const [cx, cy, cs] of [[-0.2, -0.2, 0.06], [-0.12, -0.23, 0.05], [0.18, -0.2, 0.055], [0.25, -0.17, 0.04], [0.1, -0.24, 0.04]] as const) ellip(M, '#cbd5e1', cx, cy, 0.04, cs * 1.4, cs * 0.6, cs * 0.5);
  // osmanthus tree (left)
  tube(gp, [[-0.32, Y, -0.08], [-0.33, Y + 0.12, -0.08], [-0.3, Y + 0.2, -0.07]], 0.018, 0.01, '#6b4a33');
  pblob(gp, '#3f7d3a', -0.31, Y + 0.25, -0.08, 0.12, 0.1, 0.11, (x, y, z) => (hash3(Math.floor(x * 90), Math.floor(y * 90), Math.floor(z * 90)) > 0.84 ? '#fbbf24' : shade('#3f7d3a', 0.85 + fbm(x * 20, y * 20, z * 20, 2) * 0.35)), [0, 0, 0], 16, true);
  // lantern line between two posts
  for (const px of [-0.2, 0.36]) cyl(gp, '#7c4a2d', px, Y, 0.0, 0.007, 0.34, 7);
  const pts: V3[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-0.2 + t * 0.56, Y + 0.33 - Math.sin(t * Math.PI) * 0.05, 0]); }
  tube(gp, pts, 0.002, 0.002, '#1f2937', { radial: 5, sub: 3 });
  redLantern(gp, pts[2][0], pts[2][1], 0, 0.024, '#ef4444', '#dc2626');
  // star lantern
  const sx0 = pts[4][0], sy0 = pts[4][1] - 0.045;
  rod(gp, [sx0, pts[4][1], 0], [sx0, sy0 + 0.025, 0], 0.0015, '#1f2937');
  glow(add(gp, g('fs-oct', () => new THREE.OctahedronGeometry(1, 0)), mat('#fde047'), sx0, sy0, 0, 0.028, 0.028, 0.014, 0, 0, Math.PI / 4), '#fde047', '#f59e0b');
  // carp lantern
  const cx0 = pts[6][0], cy0 = pts[6][1] - 0.04;
  rod(gp, [cx0, pts[6][1], 0], [cx0, cy0 + 0.018, 0], 0.0015, '#1f2937');
  glow(ellip(gp, '#fb923c', cx0, cy0, 0, 0.034, 0.018, 0.016), '#fb923c', '#ea580c');
  glow(slab(grp(gp, cx0 - 0.03, cy0, 0), [[0, 0], [-0.03, 0.02], [-0.022, 0], [-0.03, -0.02]], 0.004, '#fdba74', 0, false), '#fdba74', '#f97316');
  dot(gp, '#111827', cx0 + 0.02, cy0 + 0.005, 0.014, 0.004, 6);
  redLantern(gp, pts[8][0], pts[8][1], 0, 0.022, '#facc15', '#f59e0b');
  // red lacquer table with mooncakes and tea
  const T = grp(gp, 0.03, Y, 0.1);
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.78; cyl(T, '#7f1d1d', Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09, 0.008, 0.07, 6); }
  cyl(T, '#b91c1c', 0, 0.07, 0, 0.13, 0.014, 28);
  cyl(T, '#f8fafc', 0.0, 0.084, 0.0, 0.07, 0.006, 22);
  const cake = (x: number, z: number) => {
    cyl(T, '#c8862e', x, 0.09, z, 0.024, 0.016, 12);
    cyl(T, '#dfa04a', x, 0.106, z, 0.019, 0.002, 12);
    dot(T, '#a96a1d', x, 0.108, z, 0.006, 6);
  };
  cake(-0.026, -0.015); cake(0.026, -0.018); cake(0.0, 0.028);
  // a cut mooncake showing the golden yolk
  const half = grp(T, -0.08, 0.084, 0.05, 0.6);
  lathe(half, [[0, 0], [0.024, 0], [0.024, 0.016], [0, 0.016]], '#c8862e', 0, 0, 0, 8).scale.set(1, 1, 0.5);
  dot(half, '#f59e0b', 0, 0.008, 0.012, 0.008, 8);
  // teapot & cups
  ellip(T, '#e0f2fe', 0.08, 0.1, 0.03, 0.024, 0.02, 0.024);
  ellip(T, '#1d4ed8', 0.08, 0.1, 0.03, 0.0245, 0.006, 0.0245);
  tube(T, [[0.1, 0.1, 0.03], [0.115, 0.112, 0.03], [0.12, 0.118, 0.03]], 0.004, 0.0025, '#e0f2fe', { radial: 6, sub: 2 });
  dot(T, '#1d4ed8', 0.08, 0.122, 0.03, 0.006, 6);
  for (const [ux, uz] of [[0.06, -0.06], [-0.06, -0.07]]) cyl(T, '#f8fafc', ux, 0.077, uz, 0.012, 0.014, 10);
  // rabbit lantern on wheels, pulled by a child
  const R = grp(gp, 0.25, Y, 0.22, -0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = cyl(R, '#dc2626', sx * 0.03, 0.012, sz * 0.035, 0.014, 0.006, 12); w.rotation.z = Math.PI / 2; w.position.y = 0.014; }
  glow(ellip(R, '#ffffff', 0, 0.06, 0, 0.042, 0.038, 0.06), '#ffffff', '#ffe4e6');
  glow(ellip(R, '#ffffff', 0, 0.1, 0.055, 0.03, 0.028, 0.03), '#ffffff', '#ffe4e6');
  for (const sx of [-1, 1]) {
    glow(ellip(R, '#ffffff', sx * 0.013, 0.15, 0.045, 0.01, 0.035, 0.007, 0, -0.2, sx * 0.15), '#ffffff', '#ffe4e6');
    ellip(R, '#f9a8d4', sx * 0.013, 0.152, 0.051, 0.005, 0.025, 0.002, 0, -0.2, sx * 0.15);
    dot(R, '#dc2626', sx * 0.016, 0.106, 0.082, 0.005, 6);
  }
  dot(R, '#fb7185', 0, 0.096, 0.086, 0.004, 6);
  glow(ellip(R, '#ffffff', 0, 0.07, -0.06, 0.014, 0.014, 0.014), '#ffffff', '#ffe4e6');
  for (let k = 0; k < 5; k++) dot(R, ['#f472b6', '#facc15', '#38bdf8'][k % 3], -0.02 + k * 0.01, 0.07 + (k % 2) * 0.012, 0.055 - Math.abs(k - 2) * 0.004, 0.005, 6);
  rod(R, [0, 0.03, 0.06], [0, 0.08, 0.17], 0.002, '#78350f');
  kid(gp, 0.17, Y, 0.37, 2.6, { shirt: '#ec4899', pants: '#1e3a8a', hands: [[-0.02, 0.06, 0.03], [0.02, 0.07, 0.04]], dress: true });
  kid(gp, -0.17, Y, 0.17, 0.4, { shirt: '#0ea5e9', pants: '#334155', hands: [[-0.02, 0.07, 0.035], [0.032, 0.13, 0.0]] });
  kid(gp, 0.2, Y, -0.05, -0.8, { shirt: '#a855f7', pants: '#1f2937', hands: FWD }, 1.1);
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
// NAADAM — Ulaanbaatar: green steppe hills with white gers, two wrestlers in red and blue zodog jackets grappling
// while a third does the eagle dance, a line of galloping horses ridden by child jockeys, an archer in a deel,
// and Mongolian flags.
// ---------------------------------------------------------------------------------------------------------
function horse(p: THREE.Object3D, x: number, y: number, z: number, ry: number, coat: string, mane: string, rider: string, s = 1.1): void {
  const H = grp(p, x, y, z, ry, s);
  sweep(H, [{ p: [-0.07, 0.11, 0], w: 0.026, h: 0.032 }, { p: [-0.01, 0.112, 0], w: 0.03, h: 0.036 }, { p: [0.05, 0.118, 0], w: 0.028, h: 0.034 }], coat, { radial: 10, sub: 3 });
  sweep(H, [{ p: [0.045, 0.125, 0], w: 0.02, h: 0.026 }, { p: [0.085, 0.152, 0], w: 0.015, h: 0.019 }, { p: [0.11, 0.172, 0], w: 0.013, h: 0.015 }], coat, { radial: 8, sub: 3 });
  ellip(H, coat, 0.132, 0.165, 0, 0.03, 0.013, 0.012, 0, 0, -0.35);
  ellip(H, shade(coat, 0.7), 0.158, 0.155, 0, 0.01, 0.009, 0.01);
  for (const sz of [-1, 1]) { cone(H, coat, 0.112, 0.183, sz * 0.007, 0.005, 0.016, 5); dot(H, '#111827', 0.135, 0.174, sz * 0.011, 0.003, 5); }
  for (let k = 0; k < 6; k++) dot(H, mane, 0.05 + k * 0.011, 0.145 + k * 0.007, 0, 0.007, 5);
  // galloping legs: fore stretched forward, hind stretched back
  const leg = (a: V3, b: V3, c: V3) => { rod(H, a, b, 0.008, coat, 6); rod(H, b, c, 0.006, coat, 6); dot(H, '#1f2937', c[0], c[1], c[2], 0.007, 5); };
  for (const sz of [-1, 1]) {
    leg([0.045, 0.1, sz * 0.016], [0.08, 0.07, sz * 0.016], [0.1 + (sz > 0 ? 0.01 : 0), 0.04, sz * 0.016]);
    leg([-0.06, 0.1, sz * 0.016], [-0.095, 0.075, sz * 0.016], [-0.13 - (sz > 0 ? 0.01 : 0), 0.055, sz * 0.016]);
  }
  tube(H, [[-0.075, 0.125, 0], [-0.11, 0.115, 0], [-0.135, 0.09, 0]], 0.008, 0.005, mane, { radial: 6, sub: 3 });
  // saddle cloth and child jockey
  box(H, '#1d4ed8', -0.01, 0.142, 0, 0.05, 0.004, 0.064);
  kid(H, -0.012, 0.13, 0, Math.PI / 2, { shirt: rider, pants: '#f8fafc', sit: true, hands: [[-0.012, 0.08, 0.05], [0.012, 0.08, 0.05]], hat: (f) => { cone(f, rider, 0, 0.115, -0.002, 0.021, 0.03, 10); dot(f, '#facc15', 0, 0.145, -0.002, 0.005, 5); } }, 0.75);
  rod(H, [0.1, 0.17, 0], [0.04, 0.17, 0], 0.001, '#1f2937', 3);
}
function ger(p: THREE.Object3D, x: number, z: number, r: number, ry: number): void {
  const G = grp(p, x, 0.035, z, ry);
  cyl(G, '#f8f7f2', 0, 0, 0, r, r * 0.7, 16);
  cyl(G, '#c2410c', 0, r * 0.08, 0, r * 1.005, r * 0.06, 16);
  cyl(G, '#c2410c', 0, r * 0.56, 0, r * 1.005, r * 0.06, 16);
  cone(G, '#f8f7f2', 0, r * 0.7, 0, r * 1.06, r * 0.45, 16);
  cyl(G, '#1d4ed8', 0, r * 0.7, 0, r * 1.07, r * 0.05, 16);
  cyl(G, '#f8f7f2', 0, r * 1.12, 0, r * 0.2, r * 0.06, 10);
  box(G, '#ea580c', 0, 0, r * 0.98, r * 0.42, r * 0.55, 0.008);
  for (let k = 0; k < 3; k++) box(G, '#1d4ed8', 0, r * (0.1 + k * 0.15), r * 0.98 + 0.005, r * 0.3, r * 0.04, 0.002);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; dot(G, '#1d4ed8', Math.sin(a) * r * 1.01, r * 0.38, Math.cos(a) * r * 1.01, r * 0.05, 5); }
}
function wrestler(p: THREE.Object3D, x: number, z: number, ry: number, jacket: string, hands: [V3, V3], s: number): THREE.Group {
  const f = kid(p, x, 0.035, z, ry, { shirt: jacket, pants: '#d9a27a', skin: '#c68b5e', shoes: '#7c2d12', hands, hat: (g2) => {
    ellip(g2, '#d9a27a', 0, 0.058, 0.012, 0.013, 0.02, 0.006);
    ellip(g2, jacket, 0, 0.034, 0.0, 0.021, 0.012, 0.016);
    cone(g2, jacket, 0, 0.118, -0.002, 0.02, 0.03, 8);
    dot(g2, '#facc15', 0, 0.148, -0.002, 0.005, 5);
  } }, s);
  for (const sx of [-1, 1]) { cyl(f, '#7c2d12', sx * 0.0105, 0.0, 0, 0.0095, 0.022, 8); cone(f, '#7c2d12', sx * 0.0105, 0.002, 0.014, 0.005, 0.012, 5).rotation.x = 1.2; }
  return f;
}
const fs_naadam: Builder = (gp) => {
  const hf = (x: number, z: number) => sstep(-0.22, -0.48, z) * (0.06 + Math.sin(x * 7) * 0.02);
  const gr = grass('#7fae4f', 22);
  const paint: Paint = (x, y, z, nx, ny, nz) => {
    const tr = Math.abs(z - 0.1 - Math.sin(x * 3) * 0.02) < 0.035;
    return tr ? shade('#b59a6b', 0.9 + hash3(Math.floor(x * 60), 0, Math.floor(z * 60)) * 0.15) : gr(x, y, z, nx, ny, nz);
  };
  base(gp, 0.5, '#7fae4f', paint, '#6b4f3a', 0.035, hf, 18, 64);
  const Y = 0.035;
  ger(gp, -0.3, -0.24, 0.085, 0.4);
  ger(gp, -0.1, -0.33, 0.07, 0.1);
  ger(gp, 0.33, -0.25, 0.075, -0.4);
  // Mongolian flags
  for (const [fx, fz] of [[0.12, -0.3], [0.2, -0.26]] as const) {
    rod(gp, [fx, Y, fz], [fx, Y + 0.3, fz], 0.003, '#e7e5e4', 5);
    const F = grp(gp, fx + 0.002, Y + 0.24, fz);
    box(F, '#c81e1e', 0.0133, 0, 0, 0.0266, 0.05, 0.002);
    box(F, '#1d4ed8', 0.04, 0, 0, 0.0266, 0.05, 0.002);
    box(F, '#c81e1e', 0.0666, 0, 0, 0.0266, 0.05, 0.002);
    dot(F, '#facc15', 0.0133, 0.035, 0.0015, 0.005, 5);
    box(F, '#facc15', 0.0133, 0.012, 0.0012, 0.008, 0.014, 0.001);
  }
  // horse race along the track
  horse(gp, -0.27, Y, 0.06, 0.1, '#7c4a2d', '#2b1d14', '#ef4444');
  horse(gp, 0.01, Y, 0.12, 0.05, '#e7e2d6', '#a8a29e', '#2563eb');
  horse(gp, 0.28, Y, 0.02, 0.15, '#3b2a1f', '#111827', '#facc15');
  for (let i = 0; i < 8; i++) dot(gp, '#cdb98f', -0.46 + i * 0.03, Y + 0.01 + hash3(i, 1, 1) * 0.02, 0.08 + (hash3(i, 2, 2) - 0.5) * 0.04, 0.012 + i * 0.001, 6);
  // wrestlers grappling + one doing the eagle dance
  wrestler(gp, -0.05, 0.3, 1.2, '#c81e1e', [[-0.01, 0.12, 0.04], [0.015, 0.1, 0.045]], 1.3);
  wrestler(gp, 0.04, 0.32, -1.9, '#1d4ed8', [[-0.015, 0.1, 0.045], [0.01, 0.12, 0.04]], 1.3);
  wrestler(gp, -0.26, 0.27, 0.5, '#c81e1e', [[-0.05, 0.11, -0.01], [0.05, 0.11, -0.01]], 1.2);
  // archer in a blue deel with a drawn bow
  const A = kid(gp, 0.27, Y, 0.3, -0.9, { shirt: '#2563eb', dress: true, hands: [[-0.004, 0.09, 0.06], [0.0, 0.09, 0.0]], hat: (f) => { cone(f, '#7c2d12', 0, 0.115, -0.002, 0.022, 0.03, 8); } }, 1.2);
  const bow: V3[] = [];
  for (let i = 0; i <= 6; i++) { const a = -0.9 + (i / 6) * 1.8; bow.push([0, 0.09 + Math.sin(a) * 0.05, 0.045 + Math.cos(a) * 0.02]); }
  tube(A, bow, 0.0025, 0.0025, '#78350f', { radial: 5, sub: 2 });
  rod(A, [0, 0.09, 0.0], [0, 0.09, 0.1], 0.0015, '#e7e5e4', 3);
  for (const e of [bow[0], bow[6]]) rod(A, e, [0, 0.09, 0.0], 0.0007, '#f8fafc', 3);
  fuse(gp);
};

export const H_FESTIVALS: Record<string, Builder> = {
  fs_springfestival, fs_lantern, fs_dragonboat, fs_midautumn, fs_harbin, fs_rio, fs_venice,
  fs_holi, fs_diwali, fs_songkran, fs_oktoberfest, fs_tomatina, fs_dayofdead, fs_hanami, fs_naadam,
};
// keep shared helpers referenced while the remaining builders are being written
