import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, ellip, lathe, rod, tube, skin, sweep, slab, CYL,
  shade, mix, hash3, fbm, SPH, paintFaces, plinth, tree, PLINTH_SIDE, SITE,
} from '../prims.ts';
import { proof } from '../timber.ts';
import { banner } from '../rich.ts';
import { human, type HumanOpts, type HumanRig } from '../human.ts';
import { horse } from '../animals.ts';
import { island } from '../nature.ts';

// Dioramas of Chinese customs II (pack life-custom2): the wooden ox on a plank road, the Seven Sages, the Orchid
// Pavilion, the examination hall, Tang polo and sancai, Han Xizai's night revels, a Song entertainment quarter,
// kilns and porcelain, opera stages and Huang Daopo's cotton spinning. Front faces +z, base at y=0, radius ≈0.47.

const TAU = Math.PI * 2;
const Y0 = 0.035;

// ---- shared kit -----------------------------------------------------------------------------------------

/** Child group at (x, y, z) turned by ry, uniformly scaled by s. */
function grp(p: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1): THREE.Group {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = ry;
  f.scale.setScalar(s);
  p.add(f);
  return f;
}
function anim(p: THREE.Object3D, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}
const ICO = () => g('cus2:ico', () => new THREE.IcosahedronGeometry(1, 1));
/** Faceted boulder / foliage lump. */
const blob = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0) =>
  add(p, ICO(), mat(c, { rough: 0.9 }), x, y, z, sx, sy, sz, ry);
/** Cheap low-poly sphere. */
const dot = (p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, seg = 8) =>
  add(p, SPH(seg), mat(c), x, y, z, r * 2, r * 2, r * 2);
const ell8 = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, g('cus2:el8', () => new THREE.SphereGeometry(1, 10, 7)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
/** Emissive flame / lamp glow. */
const glow = (c: string, e: string) => mat(c, { emissive: e });

/** Rising smoke / steam: a 'smoke' group of a few translucent puffs. */
function smoke(p: THREE.Object3D, x: number, y: number, z: number, size: number, c = '#e6e2da', n = 5): void {
  const sm = anim(p, 'smoke', x, y, z, { size });
  for (let i = 0; i < n; i++) add(sm, g('cus2:puff', () => new THREE.IcosahedronGeometry(1, 1)), mat(c, { transparent: 0.5 }), 0, 0, 0, 0.01, 0.01, 0.01);
}
/** Candle / lamp flame that flickers. */
function flame(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const f = anim(p, 'flicker', x, y, z);
  add(f, SPH(8), glow('#ffd27a', '#ff8c1a'), 0, s * 0.9, 0, s * 1.1, s * 2.2, s * 1.1);
  add(f, SPH(6), glow('#fff3c4', '#ffd166'), 0, s * 0.7, 0, s * 0.55, s * 1.1, s * 0.55);
}
/** Red silk lantern with black caps and a tassel. */
function lantern(p: THREE.Object3D, x: number, y: number, z: number, r: number, c = '#84302a'): void {
  add(p, SPH(10), glow(c, '#341008'), x, y, z, r * 2, r * 1.7, r * 2);
  cyl(p, '#1c1917', x, y + r * 0.72, z, r * 0.55, r * 0.25, 8);
  cyl(p, '#1c1917', x, y - r * 0.95, z, r * 0.55, r * 0.25, 8);
  rod(p, [x, y - r * 0.95, z], [x, y - r * 1.9, z], r * 0.12, '#a8863a', 3);
}

/**
 * Emissive / transparent meshes are not baked by kit.ts, so each would stay its own draw call. Merge every such
 * mesh under `root` (outside animated groups) into one mesh per material.
 */
function fuse(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const kill: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    for (const ch of o.children) {
      if (['spin', 'flap', 'sway', 'bob', 'flicker', 'smoke'].includes(ch.name)) continue;
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        const mt = m.material as THREE.MeshStandardMaterial;
        if (mt.transparent || (mt.emissive && mt.emissive.getHex() !== 0)) {
          (buckets.get(mt) ?? buckets.set(mt, []).get(mt)!).push(flatGeo(m, inv));
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
function flatGeo(m: THREE.Mesh, inv: THREE.Matrix4): THREE.BufferGeometry {
  let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  geo = geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
  if (m.matrixWorld.determinant() < 0) {
    const pa = geo.getAttribute('position') as THREE.BufferAttribute;
    for (const a of [pa, geo.getAttribute('normal') as THREE.BufferAttribute]) for (let i = 0; i < pa.count; i += 3) for (let k = 0; k < 3; k++) {
      const t = a.array[(i + 1) * 3 + k]; a.array[(i + 1) * 3 + k] = a.array[(i + 2) * 3 + k]; a.array[(i + 2) * 3 + k] = t;
    }
  }
  return geo;
}

/**
 * Round diorama base. Flat sites stand on the shared museum plinth (prims.plinth: uniform PLINTH_SIDE skirt) with a
 * finely gridded painted top laid over it; sculpted sites (hf given) keep their displaced terrain but with the same
 * PLINTH_SIDE skirt. `_side` is ignored so every diorama shares one base.
 */
function land(gp: THREE.Object3D, top: string, paint: Paint, hf?: (x: number, z: number) => number, _side?: string, R = 0.46): void {
  if (!hf) {
    plinth(gp, top, { R, h: Y0 - 0.002 });
    island(gp, R * 0.965, () => 0, top, paint, { rings: 26, segs: 80, base: Y0, side: () => PLINTH_SIDE });
    return;
  }
  island(gp, R, hf, top, paint, { rings: 26, segs: 80, base: Y0, side: y => (y > Y0 * 0.55 ? PLINTH_SIDE : shade(PLINTH_SIDE, 0.85)) });
}
const grassP = (c: string, k = 14): Paint => (x, _y, z) => shade(c, 0.86 + fbm(x * k, 0.3, z * k, 3) * 0.3);
/** Running-bond bricks / paving on any axis-aligned face (uses the face normal to pick the in-plane axes). */
const bricks = (c: string, bw = 0.024, bh = 0.011, mortar = 0.14, joint = shade(c, 0.78)): Paint => (x, y, z, nx, ny) => {
  if (Math.abs(ny) > 0.7) {
    const v = z / bh / 1.6, u = x / bw + (Math.floor(v) % 2) * 0.5, fu = u - Math.floor(u), fv = v - Math.floor(v);
    return fu < mortar || fv < mortar ? joint : shade(c, 0.93 + hash3(Math.floor(u), 3, Math.floor(v)) * 0.14);
  }
  const h = Math.abs(nx) > 0.7 ? z : x;
  const v = y / bh, u = h / bw + (Math.floor(v) % 2) * 0.5, fu = u - Math.floor(u), fv = v - Math.floor(v);
  return fu < mortar * 0.6 || fv < mortar ? joint : shade(c, 0.92 + hash3(Math.floor(u), Math.floor(v), 7) * 0.15);
};
/** Painted (subdivided) box: paint receives coordinates in the parent's frame (ignoring ry). */
function pbox(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, paint: Paint, cell = 0.012, ry = 0, rough?: number): THREE.Mesh {
  const n = (s: number) => Math.max(1, Math.min(48, Math.round(s / cell)));
  const geo = new THREE.BoxGeometry(sx, sy, sz, n(sx), n(sy), n(sz));
  const pg = paintFaces(geo, c, (px, py, pz, nx, ny, nz) => paint(px + x, py + y + sy / 2, pz + z, nx, ny, nz));
  return add(p, pg, mat('#ffffff', { vc: true, flat: true, rough }), x, y + sy / 2, z, 1, 1, 1, ry);
}
/** Grey tile roof: two pitched slabs with painted tile ribs, a ridge and upturned ridge ends; ridge along X. */
function tileRoof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, tile = '#55585e', ry = 0, ends = true): void {
  const G = grp(p, x, y, z, ry);
  const half = d / 2, L = Math.hypot(half, h), a = Math.atan2(h, half);
  const rib = (px: number) => (Math.floor((px + w) / 0.0075) % 2 ? shade(tile, 1.18) : tile);
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(w, 0.006, L + 0.008, Math.max(2, Math.round(w / 0.0075)), 1, 1);
    const pg = paintFaces(geo, tile, (px, _py, _pz, _nx, ny) => (ny < -0.5 ? shade(tile, 0.62) : rib(px)));
    add(G, pg, mat('#ffffff', { vc: true, flat: true }), 0, h / 2, (s * half) / 2, 1, 1, 1, 0, s * a, 0);
  }
  box(G, shade(tile, 0.7), 0, h - 0.004, 0, w + 0.006, 0.01, 0.012);
  if (ends) for (const s of [-1, 1]) {
    const e = add(G, g('cus2:ridgeEnd', () => new THREE.ConeGeometry(0.5, 1, 4)), mat(shade(tile, 0.7)), s * (w / 2 + 0.004), h + 0.008, 0, 0.012, 0.022, 0.01);
    e.rotation.z = -s * 0.5;
  }
}

/** Leaf blades (bamboo, orchids, reeds, grass) built into one vertex-coloured, double-sided mesh. */
interface Blade { o: V3; d: V3; L: number; w: number; c: string; droop?: number }
function blades(p: THREE.Object3D, list: Blade[]): void {
  if (!list.length) return;
  const pos: number[] = [], col: number[] = [];
  const C = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), D = new THREE.Vector3(), S = new THREE.Vector3();
  for (const b of list) {
    D.set(...b.d).normalize();
    S.crossVectors(D, up);
    if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
    S.normalize().multiplyScalar(b.w);
    const dr = b.droop ?? 0.35;
    const o = b.o, m: V3 = [o[0] + D.x * b.L * 0.45, o[1] + D.y * b.L * 0.45, o[2] + D.z * b.L * 0.45];
    const t: V3 = [o[0] + D.x * b.L, o[1] + D.y * b.L - dr * b.L, o[2] + D.z * b.L];
    const l: V3 = [m[0] - S.x, m[1] - S.y, m[2] - S.z], r: V3 = [m[0] + S.x, m[1] + S.y, m[2] + S.z];
    const tris: V3[] = [o, r, l, l, r, t, o, l, r, l, t, r];
    for (const v of tris) pos.push(...v);
    C.set(b.c);
    for (let i = 0; i < 12; i++) col.push(C.r, C.g, C.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  add(p, geo, mat('#ffffff', { vc: true, flat: true, rough: 0.8 }), 0, 0, 0, 1, 1, 1);
}

/** Bamboo culm: one lathe with swollen nodes, leaning; leafy twigs pushed into `leaves`. */
function bamboo(p: THREE.Object3D, x: number, y: number, z: number, H: number, r: number, lx: number, lz: number, seed: number, leaves: Blade[], c = '#6a9a45'): void {
  const n = Math.max(4, Math.round(H / 0.075)), sh: [number, number][] = [[0, 0]];
  for (let i = 0; i < n; i++) {
    const y0 = (i / n) * H, y1 = ((i + 1) / n) * H, rr = r * (1 - (i / n) * 0.45);
    sh.push([rr, y0 + 0.002], [rr * 0.96, (y0 + y1) / 2], [rr, y1 - 0.004], [rr * 1.22, y1 - 0.001]);
  }
  sh.push([0, H + 0.004]);
  const tone = shade(c, 0.85 + hash3(seed, 1, 2) * 0.3);
  const m = lathe(p, sh, tone, x, y, z, 7);
  m.rotation.set(lz, 0, -lx);
  const E = new THREE.Euler(lz, 0, -lx);
  const at = (h: number): V3 => { const v = new THREE.Vector3(0, h, 0).applyEuler(E); return [x + v.x, y + v.y, z + v.z]; };
  for (let i = Math.floor(n * 0.45); i < n; i++) {
    const a = hash3(seed, i, 3) * TAU, base = at(((i + 1) / n) * H), len = 0.035 + hash3(seed, i, 4) * 0.04;
    const tip: V3 = [base[0] + Math.cos(a) * len, base[1] + 0.012, base[2] + Math.sin(a) * len];
    rod(p, base, tip, 0.0015, shade(tone, 0.8), 3);
    const k = 5 + Math.floor(hash3(seed, i, 5) * 3);
    for (let j = 0; j < k; j++) {
      const b = a + (j / k - 0.5) * 2.2 + hash3(seed, i, j) * 0.4;
      leaves.push({ o: tip, d: [Math.cos(b), -0.15 - hash3(i, j, seed) * 0.5, Math.sin(b)], L: 0.04 + hash3(j, i, 9) * 0.02, w: 0.0045, droop: 0.25, c: shade(j % 3 ? '#4d7438' : '#6d8d4c', 0.85 + hash3(seed, j, i) * 0.3) });
    }
  }
}

/** Orchid clump: arching strap leaves with a few small flowers on a spike. */
function orchid(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number, leaves: Blade[], flower = '#e9d8f2'): void {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + hash3(seed, i, 1);
    leaves.push({ o: [x, y, z], d: [Math.cos(a) * 0.8, 1.1, Math.sin(a) * 0.8], L: s * (0.8 + hash3(seed, i, 2) * 0.5), w: s * 0.035, droop: 0.9, c: shade('#3f6d32', 0.85 + hash3(seed, i, 3) * 0.3) });
  }
  rod(p, [x, y, z], [x + s * 0.12, y + s * 0.6, z + s * 0.05], s * 0.012, '#6a8a40', 3);
  for (let k = 0; k < 3; k++) dot(p, flower, x + s * (0.06 + k * 0.03), y + s * (0.38 + k * 0.1), z + s * 0.03, s * 0.04, 6);
}

// ---- people ----------------------------------------------------------------------------------------------

type Head = 'none' | 'futou' | 'wusha' | 'topknot' | 'jin' | 'bun' | 'highbun' | 'scarf' | 'gaomao' | 'helmet' | 'flowerbun' | 'guapi';
interface PO extends Omit<HumanOpts, 'h' | 'top'> {
  h: number; top: string;
  head?: Head; hc?: string;
  /** beard colour ('long' adds a long flowing beard) */
  beard?: string; longBeard?: boolean;
  /** seated cross-legged: a robe drape over the knees */
  lap?: boolean;
  /** wide hanging sleeves at the wrists */
  sleeves?: boolean;
  /** bare chest (open robe) */
  chest?: boolean;
  /** painted opera face colour */
  face?: string;
}
/** Period person: the shared human rig plus Chinese headwear, beards, laps and wide sleeves. */
function man(p: THREE.Object3D, x: number, y: number, z: number, o: PO): HumanRig {
  const { head = 'none', hc = '#1c1917', beard, longBeard, lap, sleeves, chest, face, ...ho } = o;
  const r = human(p, x, y, z, { skin: '#e2b48c', hair: '#1c1714', shoes: '#2a2018', bottom: o.top, detail: 'lo', ...ho } as HumanOpts);
  const ry = o.ry ?? 0, h = o.h;
  const H = grp(p, r.head[0], r.head[1], r.head[2], ry, h);
  switch (head) {
    case 'futou':
      ell8(H, hc, 0, 0.028, -0.01, 0.062, 0.052, 0.067);
      ell8(H, hc, 0, 0.075, -0.016, 0.04, 0.04, 0.042);
      for (const s of [-1, 1]) tube(H, [[s * 0.022, 0.04, -0.06], [s * 0.035, -0.01, -0.085], [s * 0.04, -0.07, -0.08]], 0.009, 0.007, hc, { radial: 5, sub: 2 });
      break;
    case 'wusha':
      ell8(H, hc, 0, 0.028, -0.01, 0.063, 0.052, 0.068);
      ell8(H, hc, 0, 0.068, -0.03, 0.052, 0.045, 0.042);
      for (const s of [-1, 1]) ell8(H, hc, s * 0.09, 0.06, -0.05, 0.048, 0.022, 0.006);
      break;
    case 'topknot':
    case 'jin':
      ell8(H, head === 'jin' ? hc : '#1c1714', 0, 0.09, -0.012, 0.028, 0.032, 0.03);
      rod(H, [-0.045, 0.092, -0.012], [0.045, 0.092, -0.012], 0.005, '#d6b25e', 4);
      if (head === 'jin') ell8(H, hc, 0, 0.035, -0.015, 0.064, 0.05, 0.068);
      break;
    case 'bun':
      ell8(H, hc, 0, 0.05, -0.06, 0.038, 0.036, 0.034);
      dot(H, '#d6b25e', 0.03, 0.06, -0.05, 0.008, 5);
      break;
    case 'highbun':
    case 'flowerbun':
      ell8(H, hc, 0, 0.115, -0.01, 0.045, 0.05, 0.035);
      ell8(H, hc, 0.03, 0.14, -0.005, 0.03, 0.03, 0.025);
      ell8(H, hc, 0, 0.02, -0.01, 0.066, 0.055, 0.068);
      if (head === 'flowerbun') for (let k = 0; k < 3; k++) dot(H, ['#b4606a', '#c8a85a', '#b4606a'][k], -0.04 + k * 0.035, 0.11 + (k % 2) * 0.03, 0.025, 0.014, 6);
      else dot(H, '#e8c24a', -0.035, 0.1, 0.02, 0.012, 5);
      break;
    case 'scarf':
      ell8(H, hc, 0, 0.022, -0.012, 0.067, 0.062, 0.07);
      ell8(H, hc, 0, 0.0, -0.075, 0.03, 0.025, 0.02);
      break;
    case 'gaomao':
      ell8(H, hc, 0, 0.03, -0.01, 0.063, 0.05, 0.067);
      cyl(H, hc, 0, 0.04, -0.012, 0.05, 0.13, 10);
      break;
    case 'guapi': // Qing skullcap (瓜皮帽) with a knotted button, shaved forehead and a long queue
      ell8(H, hc, 0, 0.034, -0.012, 0.066, 0.05, 0.069);
      dot(H, '#7a2e24', 0, 0.084, -0.012, 0.011, 5);
      tube(H, [[0, 0.0, -0.068], [0, -0.12, -0.082], [0.006, -0.3, -0.07], [0.004, -0.42, -0.064]], 0.013, 0.005, '#1c1714', { radial: 5, sub: 3 });
      break;
    case 'helmet':
      ell8(H, hc, 0, 0.03, -0.006, 0.07, 0.062, 0.072);
      ell8(H, shade(hc, 0.8), 0, -0.01, -0.03, 0.076, 0.026, 0.074);
      ell8(H, '#7a3026', 0, 0.1, -0.01, 0.02, 0.032, 0.02);
      break;
    default:
  }
  if (face) {
    ell8(H, face, 0, -0.002, 0.026, 0.054, 0.062, 0.042);
    for (const s of [-1, 1]) ell8(H, face === '#f5f1e8' ? '#1c1917' : '#f5f1e8', s * 0.022, 0.012, 0.064, 0.014, 0.008, 0.004);
  }
  if (beard) {
    ell8(H, beard, 0, -0.058, 0.042, 0.03, 0.03, 0.022);
    if (longBeard) ell8(H, beard, 0, -0.11, 0.05, 0.032, 0.07, 0.016);
  }
  const B = grp(p, x, y, z, ry, h);
  if (lap) {
    const hy = (o.hipY ?? 0.08) + 0.03;
    ell8(B, o.top, 0, hy, 0.08, 0.17, 0.055, 0.15);
    ell8(B, o.top, 0, hy * 0.5, 0.0, 0.16, hy * 0.5 + 0.01, 0.13);
  }
  if (chest) ell8(B, o.skin ?? '#e2b48c', 0, (o.hipY ?? 0.5) + 0.21, 0.058, 0.03, 0.05, 0.014);
  if (sleeves) for (const hd of [r.handL, r.handR]) ell8(p, o.top, hd[0], hd[1] - h * 0.035, hd[2], h * 0.04, h * 0.06, h * 0.04);
  return r;
}
/** Feet / hands targets for sitting cross-legged on a mat (unit-height space). */
const CROSS: Pick<HumanOpts, 'hipY' | 'feet' | 'pose'> = { pose: 'sit', hipY: 0.08, feet: [[0.06, 0.035, 0.15], [-0.06, 0.035, 0.17]] };

/** Low lacquered table (案) with four short legs. */
function table(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, c = '#5a1f17', ry = 0): THREE.Group {
  const T = grp(p, x, y, z, ry);
  rbox(T, c, 0, h - 0.008, 0, w, 0.008, d, 0.003);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(T, shade(c, 0.8), sx * (w / 2 - 0.006), 0, sz * (d / 2 - 0.006), 0.006, h - 0.008, 0.006);
  return T;
}
/** Small cup / bowl on a surface. */
const cup = (p: THREE.Object3D, x: number, y: number, z: number, r: number, c = '#e9e3d0') =>
  lathe(p, [[0, 0], [r * 0.6, 0], [r * 0.65, r * 0.12], [r, r * 0.9], [r * 0.9, r * 0.95], [0, r * 0.25]], c, x, y, z, 10);
/** Wine jar (酒坛) with a cloth-and-clay stopper. */
function jar(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#6b3a1e'): THREE.Mesh {
  const m = lathe(p, [[0, 0], [s * 0.55, 0], [s * 0.9, s * 0.35], [s, s * 0.6], [s * 0.75, s * 0.95], [s * 0.42, s * 1.08], [s * 0.45, s * 1.18], [0, s * 1.18]], c, x, y, z, 12);
  m.material = mat(c, { rough: 0.35, flat: false });
  ell8(p, '#8a4a36', x, y + s * 1.2, z, s * 0.5, s * 0.12, s * 0.5);
  return m;
}

// =========================================================================================================
// 木牛流马 — Zhuge Liang's wooden ox hauling grain along a cliff plank road (栈道) above a gorge
// =========================================================================================================
function woodenOx(p: THREE.Object3D, x: number, y: number, z: number, ry: number): THREE.Group {
  const O = grp(p, x, y, z, ry);
  const W = '#a87443', D = '#5e3d22', IRON = '#3b3a38';
  // box body housing the wheel, with plank seams and iron straps
  pbox(O, W, 0, 0.072, 0, 0.074, 0.05, 0.17, (_x, py, pz, nx) => (Math.abs(nx) > 0.5 && Math.abs(((py - 0.072) / 0.0125) % 1) < 0.14 ? shade(W, 0.7) : shade(W, 0.94 + hash3(Math.floor(pz * 60), Math.floor(py * 80), 1) * 0.12)), 0.006);
  for (const bz of [-0.06, 0.0, 0.06]) box(O, IRON, 0, 0.07, bz, 0.078, 0.054, 0.006);
  // neck and head with horns, eyes and a muzzle
  rbox(O, W, 0, 0.1, 0.095, 0.04, 0.035, 0.05, 0.006).rotation.x = -0.45;
  const Hd = grp(O, 0, 0.12, 0.135);
  rbox(Hd, W, 0, 0, 0, 0.044, 0.04, 0.05, 0.007);
  rbox(Hd, shade(W, 0.85), 0, -0.012, 0.03, 0.036, 0.026, 0.024, 0.006);
  for (const s of [-1, 1]) {
    tube(Hd, [[s * 0.018, 0.036, -0.012], [s * 0.04, 0.05, -0.01], [s * 0.05, 0.068, 0.006]], 0.005, 0.0025, shade(W, 0.75), { radial: 5, sub: 3 });
    box(Hd, W, s * 0.028, 0.022, -0.016, 0.016, 0.008, 0.01);
    box(Hd, shade(W, 0.55), s * 0.0225, 0.022, 0.0115, 0.006, 0.002, 0.003);
    box(Hd, shade(W, 0.55), s * 0.01, -0.006, 0.0425, 0.004, 0.003, 0.002);
  }
  // four wooden legs as a frame (resting just clear of the planks while rolling) with hoof blocks
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    rod(O, [sx * 0.03, 0.08, sz * 0.065], [sx * 0.034, 0.016, sz * 0.075 + 0.006], 0.0065, W, 4);
    box(O, D, sx * 0.034, 0.008, sz * 0.075 + 0.006, 0.016, 0.01, 0.018);
  }
  // single wheel under the belly
  const wh = anim(O, 'spin', 0, 0.05, 0, { axis: 'x', speed: 2.5 });
  const rim = add(wh, g('cus2:torus', () => new THREE.TorusGeometry(1, 0.1, 5, 20)), mat(D), 0, 0, 0, 0.048, 0.048, 0.048);
  rim.rotation.y = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; rod(wh, [0, 0, 0], [0, Math.cos(a) * 0.046, Math.sin(a) * 0.046], 0.003, D, 3); }
  cyl(wh, IRON, 0, 0, 0, 0.01, 0.03, 8).rotation.z = Math.PI / 2;
  // grain sacks under a rope
  const sack = '#a8946c';
  for (const [sx, sy, sz] of [[0, 0.136, -0.05], [0, 0.136, 0.005], [0, 0.136, 0.058], [0, 0.162, -0.022], [0, 0.162, 0.032]] as const) {
    rbox(O, shade(sack, 0.9 + hash3(sz * 50, 1, 2) * 0.2), sx, sy, sz, 0.084, 0.026, 0.05, 0.011);
    for (const s of [-1, 1]) box(O, shade(sack, 0.7), s * 0.043, sy + 0.013, sz, 0.004, 0.006, 0.012);
  }
  for (const rz of [-0.03, 0.04]) box(O, '#7a5a34', 0, 0.12, rz, 0.08, 0.075, 0.004);
  // rear handles (the ox's "tail" shafts)
  for (const s of [-1, 1]) rod(O, [s * 0.03, 0.105, -0.08], [s * 0.042, 0.12, -0.17], 0.0045, D, 5);
  return O;
}
// Ref: 《三国志·诸葛亮传》 (231–234) wooden ox on the 褒斜/祁山 plank roads (栈道: beams socketed into the cliff, posts
// to the riverbed — cf. surviving 古栈道 holes at 明月峡); ox after the 王湔 / 刘仙洲 single-wheel barrow reconstructions.
// Ref: Commons "Syoku sendo zu (Shu plank road view)" — beams socketed in cliff holes over a gorge, carts and porters.
const lf_muniu: Builder = (gp) => {
  const rz = (x: number) => 0.12 + Math.sin(x * 6 + 0.5) * 0.035;
  const hf = (x: number, z: number) => {
    const d = Math.abs(z - rz(x));
    return d < 0.15 ? -0.018 * (1 - d / 0.15) : (fbm(x * 9, 0, z * 9) - 0.5) * 0.03 + Math.max(0, z - 0.3) * 0.12;
  };
  land(gp, '#7d7466', (x, _y, z, _nx, ny) => {
    const d = Math.abs(z - rz(x));
    if (d < 0.12) return Math.sin(x * 70 + z * 30 + fbm(x * 20, 1, z * 20) * 6) > 0.985 ? '#a9b4b0' : shade('#4d6c6c', 0.9 + fbm(x * 30, 2, z * 30) * 0.2);
    if (d < 0.15) return shade('#8a8274', 0.85 + hash3(Math.floor(x * 90), 1, Math.floor(z * 90)) * 0.3);
    if (z > 0.27) return ny > 0.9 ? shade('#68784a', 0.85 + fbm(x * 18, 0, z * 18) * 0.3) : '#6b5a44';
    return shade('#776c5c', 0.85 + fbm(x * 18, 0, z * 18) * 0.3);
  }, hf, '#5d5246');
  // cliff: a rock wall (front face leaning back) closing the back of the gorge, strata-banded with moss on ledges
  const zf = -0.145, rings: V3[][] = [];
  for (let i = 0; i <= 26; i++) {
    const x = -0.41 + (i / 26) * 0.82;
    const H = 0.6 + Math.sin(x * 5 + 1) * 0.09 + (fbm(x * 7, 1, 0) - 0.5) * 0.14 - Math.pow(Math.abs(x) / 0.41, 4) * 0.22;
    const zb = Math.min(-0.24, -Math.sqrt(Math.max(0, 0.455 * 0.455 - x * x)));
    const ring: V3[] = [[x, 0, zb]];
    for (let j = 0; j <= 12; j++) {
      const y = (j / 12) * H;
      ring.push([x, y, zf - y * 0.05 + (fbm(x * 10, y * 10, 3) - 0.5) * 0.06 - (j === 12 ? 0.02 : 0)]);
    }
    ring.push([x, H + 0.02, zf - 0.09], [x, H * 0.82, (zf + zb) / 2 - 0.03]);
    rings.push(ring);
  }
  const ROCK = ['#8c8577', '#7a7366', '#968b78', '#6d675d', '#857a69'];
  skin(gp, rings, ROCK[0], {
    caps: true, flat: true, rough: 0.92,
    paint: (x, y, z, _nx, ny) => ny > 0.55 && y > 0.1 ? shade('#5e6c44', 0.8 + fbm(x * 30, y * 30, z * 30) * 0.4)
      : shade(ROCK[Math.abs(Math.floor(y * 30 + fbm(x * 6, y * 2, z * 6) * 2.4)) % ROCK.length], 0.9 + hash3(Math.floor(x * 70), Math.floor(y * 70), 2) * 0.16),
  });
  // pines on the crest and clinging to the face
  for (const [px, py, pz, s] of [[-0.3, 0.5, -0.22, 0.12], [-0.12, 0.66, -0.25, 0.14], [0.08, 0.6, -0.24, 0.11], [0.26, 0.58, -0.22, 0.13], [0.34, 0.38, -0.18, 0.08], [-0.36, 0.33, -0.19, 0.08]] as const) tree(gp, px, py - 0.02, pz, s * 0.85, '#3e5a42', true);
  // the plank road: square beams socketed into the rock, planks, outer posts down to the riverbed, a rail
  const ry = (x: number) => 0.2 + (x + 0.4) * 0.075, slope = Math.atan(0.075);
  const z0 = -0.16, z1 = 0.08;
  for (let x = -0.38; x <= 0.39; x += 0.095) {
    const y = ry(x);
    box(gp, '#4a3524', x, y - 0.018, (z0 + z1) / 2 - 0.02, 0.014, 0.014, z1 - z0 + 0.04);
    dot(gp, '#2a211a', x, y - 0.011, zf - y * 0.05 + 0.012, 0.012, 6);
    rod(gp, [x, Y0 - 0.02, z1 - 0.004], [x, y - 0.004, z1 - 0.004], 0.0055, '#5a412b', 5);
    rod(gp, [x, y - 0.012, z1 - 0.004], [x + 0.02, y - 0.09, z1 - 0.004], 0.003, '#5a412b', 4);
    blob(gp, '#6f6a62', x, Y0 - 0.012, z1, 0.022, 0.014, 0.02, x * 9);
    rod(gp, [x, y, z1 + 0.004], [x, y + 0.055, z1 + 0.004], 0.0035, '#5a412b', 4);
  }
  for (let x = -0.4; x <= 0.4; x += 0.0215) {
    const k = hash3(Math.floor(x * 200), 3, 1);
    box(gp, shade('#a07a4e', 0.85 + k * 0.25), x, ry(x) - 0.011, (z0 + z1) / 2 + 0.005, 0.019, 0.006, z1 - z0 + 0.012, 0, 0, slope);
  }
  for (const yy of [0.052, 0.03]) rod(gp, [-0.4, ry(-0.4) + yy, z1 + 0.004], [0.4, ry(0.4) + yy, z1 + 0.004], 0.0028, '#5a412b', 4);
  // the wooden ox, pushed by a Shu soldier, and a second soldier leading with the Han banner
  const ox = 0.08, O = woodenOx(gp, ox, ry(ox) - 0.008, -0.04, Math.PI / 2);
  O.rotation.order = 'YXZ';
  O.rotation.x = -slope;
  const sx = ox - 0.235;
  const s = man(gp, sx, ry(sx) - 0.008, -0.035, {
    h: 0.17, ry: Math.PI / 2, pose: 'walk', phase: 0.2, lean: 0.25, top: '#86382c', bottom: '#4a3b2e', armor: '#5b4a3a', head: 'helmet', hc: '#4a4a4c',
    hands: [[-0.1, 0.62, 0.32], [0.1, 0.62, 0.32]],
  });
  O.updateMatrix();
  for (const [sg, hd] of [[-1, s.handL], [1, s.handR]] as const) {
    const v = new THREE.Vector3(sg * 0.042, 0.12, -0.17).applyMatrix4(O.matrix);
    rod(gp, [v.x, v.y, v.z], hd, 0.004, '#5e3d22', 4);
  }
  const lx = 0.33;
  const L = man(gp, lx, ry(lx) - 0.008, -0.05, {
    h: 0.165, ry: Math.PI / 2 + 0.5, pose: 'walk', phase: 0.6, top: '#86382c', bottom: '#4a3b2e', armor: '#5b4a3a', head: 'helmet', hc: '#4a4a4c',
  });
  const [hx, hy, hz] = L.handR;
  rod(gp, [hx, hy - 0.06, hz], [hx, hy + 0.2, hz], 0.003, '#4a3524', 4);
  const F = grp(gp, hx, hy + 0.19, hz, 0.4);
  for (let i = 0; i < 3; i++) {
    const seg = anim(F, 'flap', i * 0.03, 0, 0, { phase: i * 0.8, amp: 0.25 });
    box(seg, '#8a2e24', 0.015, -0.07, 0, 0.03, 0.07, 0.002);
    if (i === 1) box(seg, '#cdbb8e', 0.015, -0.05, 0.0015, 0.016, 0.024, 0.001);
  }
  fuse(gp);
};

// =========================================================================================================
// 竹林七贤 — the Seven Sages of the Bamboo Grove: loose-robed Wei–Jin recluses on mats among tall bamboo
// =========================================================================================================
/** Straw mat (席) with a dark woven border. */
function mat2(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, ry: number): void {
  const M = grp(p, x, y, z, ry);
  box(M, '#4a3a26', 0, 0, 0, w, 0.004, d);
  pbox(M, '#cbb27a', 0, 0.001, 0, w - 0.01, 0.004, d - 0.01, (px, _py, pz) => shade('#cbb27a', Math.floor((px + pz * 0.2) * 260) % 2 ? 0.92 : 1.04), 0.004);
}
// Ref: 南京西善桥 南朝墓 brick relief 《竹林七贤与荣启期》 (5th c., Nanjing Museum): sages barefoot on mats in loose
// 宽袍大袖 with 巾 or bare topknots — 嵇康 at the guqin, 阮咸 with his round lute, 刘伶 at the wine, 王戎 with a ruyi.
// Ref: Commons "Seven Sages of the Bamboo Grove 1/2, Nanjing Museum" brick relief — sages seated on mats among trees.
const lf_qixian: Builder = (gp) => {
  land(gp, '#7d8150', (x, _y, z) => {
    const n = fbm(x * 16, 0.5, z * 16, 3);
    if (hash3(Math.floor(x * 140), 7, Math.floor(z * 140)) > 0.82) return shade('#b59a5a', 0.85 + n * 0.3); // fallen leaves
    return shade(n > 0.55 ? '#6f7a45' : '#86804f', 0.88 + n * 0.25);
  }, (x, z) => (fbm(x * 5, 2, z * 5) - 0.5) * 0.012, '#5c4a36');
  const leaves: Blade[] = [];
  // the grove: tall culms around the back and sides, leaving the front open
  let k = 0;
  for (let i = 0; i < 44; i++) {
    const a = Math.PI * 0.62 + (i / 44) * Math.PI * 1.76 + (hash3(i, 1, 1) - 0.5) * 0.12;
    const d = 0.33 + hash3(i, 2, 1) * 0.11;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z > 0.2) continue;
    const H = 0.55 + hash3(i, 3, 1) * 0.35 - Math.max(0, z) * 0.6;
    bamboo(gp, x, Y0, z, H, 0.0085 + hash3(i, 4, 1) * 0.004, -x * 0.12, z * 0.1, i, leaves, k++ % 3 ? '#677f48' : '#7f8f5a');
  }
  for (let i = 0; i < 14; i++) { const a = hash3(i, 9, 2) * TAU, d = 0.3 + hash3(i, 8, 2) * 0.15; if (Math.sin(a) * d < 0.15) dot(gp, '#6b5a3c', Math.cos(a) * d, Y0, Math.sin(a) * d, 0.008, 5); }
  // central low table with wine
  const T = table(gp, 0, Y0, 0.03, 0.12, 0.07, 0.035, '#4a1c14');
  jar(T, -0.03, 0.035, 0, 0.022, '#5a3420');
  for (const [cx, cz] of [[0.015, -0.015], [0.04, 0.012], [0.01, 0.022]]) cup(T, cx, 0.035, cz, 0.009, '#2b1d16');
  lathe(T, [[0, 0], [0.02, 0], [0.024, 0.006], [0, 0.006]], '#d6c7a1', 0.035, 0.035, -0.02, 10);
  for (let i = 0; i < 4; i++) dot(T, ['#9a4836', '#b89650', '#76844a', '#9a4836'][i], 0.03 + (i % 2) * 0.008, 0.044, -0.022 + (i > 1 ? 0.007 : 0), 0.004, 5);
  const h = 0.16, Ym = Y0 + 0.005;
  const sage = (x: number, z: number, ry: number, o: Partial<PO>, matW = 0.11): HumanRig => {
    mat2(gp, x, Y0, z, matW, 0.1, ry);
    return man(gp, x, Ym, z, { h, ry, ...CROSS, top: '#e6dfcd', head: 'jin', hc: '#2b2622', beard: '#2a211c', lap: true, sleeves: true, ...o } as PO);
  };
  // 嵇康 Ji Kang plays the guqin on a low stand
  const jk = { x: 0, z: -0.17, ry: 0 };
  sage(jk.x, jk.z, jk.ry, { top: '#ece6d4', hands: [[-0.16, 0.23, 0.3], [0.17, 0.23, 0.3]] }, 0.13);
  const Q = grp(gp, jk.x, Ym, jk.z + 0.3 * h, 0, h);
  for (const s of [-1, 1]) box(Q, '#3a2418', s * 0.33, 0, 0, 0.05, 0.14, 0.18);
  rbox(Q, '#231511', 0, 0.14, 0, 0.82, 0.05, 0.2, 0.02);
  for (let i = 0; i < 7; i++) box(Q, '#e8dcc0', 0, 0.191, -0.07 + i * 0.023, 0.76, 0.004, 0.004);
  for (let i = 0; i < 13; i++) dot(Q, '#f3efe4', -0.3 + i * 0.045, 0.19, 0.095, 0.007, 4);
  // 阮咸 Ruan Xian plays the round-bodied lute named after him
  const rx = -0.21, rzz = -0.08, rr = 0.75;
  sage(rx, rzz, rr, { top: '#b9c3c6', hands: [[-0.17, 0.5, 0.18], [0.04, 0.3, 0.2]], beard: undefined });
  const R = grp(gp, rx, Ym, rzz, rr, h);
  const rb = cyl(R, '#8a5a2b', 0.02, 0.3, 0.14, 0.11, 0.035, 14); rb.rotation.x = Math.PI / 2; rb.position.set(0.02, 0.3, 0.14);
  dot(R, '#3a2418', 0.02, 0.3, 0.16, 0.025, 6);
  rod(R, [0.02, 0.3, 0.15], [-0.22, 0.6, 0.15], 0.02, '#5a3820', 4);
  box(R, '#3a2418', -0.23, 0.6, 0.15, 0.05, 0.06, 0.03, 0, 0, 0.7);
  // 山涛 Shan Tao, the eldest, with a white beard and a wine cup
  const st = sage(0.21, -0.08, -0.75, { top: '#6f5d48', beard: '#e8e4dc', longBeard: true, hands: [[-0.1, 0.26, 0.18], [0.12, 0.42, 0.22]] });
  cup(gp, st.handR[0], st.handR[1] - 0.004, st.handR[2], 0.008, '#2b1d16');
  // 刘伶 Liu Ling, bare-chested, drinks straight from the jar
  const ll = { x: 0.3, z: 0.12, ry: -1.25 };
  const L = sage(ll.x, ll.z, ll.ry, { top: '#d8c79f', chest: true, sleeves: false, beard: '#2a211c', hands: [[-0.08, 0.58, 0.2], [0.08, 0.58, 0.2]] });
  const J = grp(gp, (L.handL[0] + L.handR[0]) / 2, (L.handL[1] + L.handR[1]) / 2, (L.handL[2] + L.handR[2]) / 2, ll.ry);
  const jm = lathe(J, [[0, -0.03], [0.012, -0.03], [0.02, -0.018], [0.022, -0.005], [0.016, 0.012], [0.008, 0.02], [0.009, 0.026], [0, 0.026]], '#5a3420', 0, 0, 0, 12);
  jm.material = mat('#5a3420', { rough: 0.35, flat: false });
  J.rotation.x = -1.9;
  jar(gp, ll.x - 0.03, Y0, ll.z + 0.07, 0.024, '#6b3a1e');
  // 阮籍 Ruan Ji reclines on his side against a bolster, cup in hand
  const ruan = { x: -0.27, z: 0.13 };
  mat2(gp, ruan.x + 0.02, Y0, ruan.z, 0.17, 0.09, 0.15);
  ell8(gp, '#8a5a3a', ruan.x - 0.06, Y0 + 0.02, ruan.z - 0.01, 0.03, 0.018, 0.022, 0.15);
  const RJ = grp(gp, ruan.x + 0.07, Y0 + 0.016, ruan.z, 0.15);
  const RL = grp(RJ, 0, 0, 0);
  RL.rotation.z = Math.PI / 2 - 0.22;
  const rj = man(RL, 0, 0, 0, { h, top: '#9fb3a2', bottom: '#9fb3a2', head: 'jin', hc: '#2b2622', beard: '#2a211c', sleeves: true, hipY: 0.48,
    feet: [[-0.03, 0.03, 0.06], [0.09, 0.15, 0.14]], hands: [[-0.2, 0.78, 0.06], [0.16, 0.47, 0.17]] });
  RJ.updateMatrixWorld(true);
  cup(RL, (rj.handR[0]), rj.handR[1], rj.handR[2], 0.008, '#2b1d16');
  // 向秀 Xiang Xiu reads a scroll; 王戎 Wang Rong, the youngest, holds a ruyi
  const xx = sage(-0.11, 0.24, 0.35, { top: '#c7b089', hands: [[-0.1, 0.3, 0.24], [0.1, 0.3, 0.24]] });
  rod(gp, xx.handL, xx.handR, 0.007, '#efe6cc', 8);
  for (const hd of [xx.handL, xx.handR]) cyl(gp, '#5a3420', hd[0], hd[1] - 0.009, hd[2], 0.004, 0.018, 6);
  const wr = sage(0.13, 0.25, -0.3, { top: '#8ea0b4', beard: undefined, hands: [[-0.1, 0.28, 0.2], [0.13, 0.42, 0.25]] });
  tube(gp, [wr.handR, [wr.handR[0] + 0.01, wr.handR[1] + 0.03, wr.handR[2] + 0.012], [wr.handR[0] + 0.006, wr.handR[1] + 0.05, wr.handR[2] + 0.025]], 0.002, 0.002, '#cfe0c2', { radial: 4, sub: 3 });
  ell8(gp, '#cfe0c2', wr.handR[0] + 0.006, wr.handR[1] + 0.055, wr.handR[2] + 0.028, 0.008, 0.006, 0.01);
  blades(gp, leaves);
};

// =========================================================================================================
// 兰亭雅集 曲水流觞 — the Orchid Pavilion gathering: wine cups float down a winding brook past seated poets
// =========================================================================================================
/** Flat water ribbon along a polyline (streams, channels). */
function ribbon(p: THREE.Object3D, pts: [number, number][], w: number, y: number, c: string): void {
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w, nz = (dx / l) * w;
    const a: V3 = [x0 - nx, y, z0 - nz], b: V3 = [x0 + nx, y, z0 + nz], c2: V3 = [x1 - nx, y, z1 - nz], d: V3 = [x1 + nx, y, z1 + nz];
    pos.push(...a, ...b, ...c2, ...b, ...d, ...c2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const n = geo.getAttribute('normal');
  if (n.getY(0) < 0) { for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; } geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); }
  add(p, paintFaces(geo, c, (x, _y, z) => (Math.sin(x * 120 + z * 60) > 0.9 ? mix(c, '#e6f6fb', 0.4) : c)), mat('#ffffff', { vc: true, flat: true, rough: 0.12 }), 0, 0, 0, 1, 1, 1);
}
// Ref: Wang Xizhi's 《兰亭集序》 (353) — "崇山峻岭，茂林修竹…引以为流觞曲水，列坐其次"; Jin wide-sleeved robes and gauze caps
// after the Nanjing 竹林七贤 brick relief; lacquered ear-cups (耳杯). No Qing stele pavilion or goose pond (later additions).
// Ref: Commons "LantingXu.jpg" (Feng Chengsu copy) and the Orchid Pavilion gathering — wine cups floated down a stream.
const lf_lanting: Builder = (gp) => {
  const sx = (z: number) => 0.04 + 0.11 * Math.sin(z * 7.5 + 0.4);
  // lofty hills close in behind, cut by the brook's ravine
  const hill = (x: number, z: number) => {
    const d = Math.abs(x - sx(z)), k = Math.min(1, Math.max(0, (-0.29 - z) / 0.15)), gap = Math.min(1, Math.max(0, (d - 0.03) / 0.07));
    return k * k * (3 - 2 * k) * (0.11 + (fbm(x * 7, 3, z * 7) - 0.5) * 0.1 + Math.sin(x * 9 + 1) * 0.02) * gap;
  };
  const hf = (x: number, z: number) => {
    const d = Math.abs(x - sx(z));
    let h = (fbm(x * 6, 1, z * 6) - 0.5) * 0.014 + hill(x, z);
    if (d < 0.05) h -= 0.012 * (1 - d / 0.05);
    return h;
  };
  const gy = (x: number, z: number) => Y0 + hf(x, z) - 0.004;
  land(gp, '#7d8a58', (x, y, z, _nx, ny) => {
    const d = Math.abs(x - sx(z));
    if (d < 0.045) return shade('#8f897c', 0.8 + hash3(Math.floor(x * 120), 2, Math.floor(z * 120)) * 0.4);
    if (ny < 0.75 && y > Y0 + 0.02) return shade(['#7f776a', '#8c8576', '#6f695e'][Math.abs(Math.floor(y * 60 + fbm(x * 8, y * 3, z * 8) * 2)) % 3], 0.9 + hash3(Math.floor(x * 80), Math.floor(y * 80), 1) * 0.15);
    return grassP(y > Y0 + 0.03 ? '#61704a' : '#76854f', 16)(x, 0, z, 0, 1, 0);
  }, hf, '#5d4a35');
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) { const z = -0.47 + (i / 40) * 0.94; pts.push([sx(z), z]); }
  ribbon(gp, pts.filter(([x, z]) => Math.hypot(x, z) < 0.462), 0.03, Y0 - 0.006, '#5d8890');
  // floating cups (觞): lacquered ear-cups riding on lotus leaves
  for (const z of [-0.3, -0.06, 0.12, 0.3]) {
    const x = sx(z);
    const B = anim(gp, 'bob', x, Y0 - 0.004, z);
    ell8(B, '#56703f', 0, 0, 0, 0.022, 0.003, 0.02);
    const c = lathe(B, [[0, 0], [0.006, 0], [0.011, 0.007], [0.0095, 0.008], [0, 0.003]], '#7a2a1e', 0, 0.002, 0, 10);
    c.scale.set(1.35, 1, 1);
    for (const s of [-1, 1]) box(B, '#1c1210', 0, 0.007, s * 0.0105, 0.012, 0.002, 0.005);
  }
  // a plain timber pavilion (亭) on a low stone base
  const px = -0.27, pz = -0.24;
  pbox(gp, '#a9a397', px, Y0 - 0.006, pz, 0.12, 0.022, 0.12, bricks('#a9a397', 0.03, 0.011), 0.01);
  for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(gp, '#6e3a28', px + a * 0.048, Y0 + 0.016, pz + b * 0.048, 0.005, 0.105, 8);
  box(gp, '#5e3426', px, Y0 + 0.113, pz, 0.106, 0.01, 0.106);
  const top = proof(gp, px, Y0 + 0.121, pz, { n: 4, R0: 0.1, R1: 0.01, h: 0.065, lift: 0.3, tile: '#55585c', rot: Math.PI / 4 });
  lathe(gp, [[0, 0], [0.008, 0], [0.009, 0.01], [0.003, 0.02], [0, 0.024]], '#55585c', px, top - 0.004, pz, 8);
  const leaves: Blade[] = [];
  // lush bamboo on the hills behind, and orchids along the brook
  for (let i = 0; i < 22; i++) {
    const a = Math.PI * 1.06 + (i / 22) * Math.PI * 0.88, d = 0.36 + hash3(i, 1, 6) * 0.08;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x - sx(z)) < 0.05 || Math.hypot(x - px, z - pz) < 0.1) continue;
    bamboo(gp, x, gy(x, z), z, 0.36 + hash3(i, 2, 6) * 0.24, 0.007, -x * 0.1, 0.05, i + 50, leaves, i % 3 ? '#6e9048' : '#80985a');
  }
  for (const [ox, oz] of [[-0.36, 0.05], [-0.33, 0.24], [0.36, 0.03], [0.28, 0.32], [-0.08, 0.4], [0.4, -0.08], [0.2, -0.27]]) orchid(gp, ox, gy(ox, oz), oz, 0.07, ox * 100 + oz * 10, leaves, hash3(ox, oz, 1) > 0.5 ? '#efe3f5' : '#f5ecc8');
  for (let i = 0; i < 14; i++) { const z = -0.4 + i * 0.06, s = i % 2 ? 1 : -1; blob(gp, '#8d877a', sx(z) + s * 0.048, Y0, z, 0.012 + hash3(i, 4, 4) * 0.008, 0.009, 0.011, i); }
  // poets seated along both banks: writing, drinking, musing, fishing a cup out of the water
  const h = 0.15;
  const poet = (z: number, side: number, o: Partial<PO>, desk = true): HumanRig => {
    const x = sx(z) + side * 0.105, ry = -side * Math.PI / 2 + side * 0.55;
    mat2(gp, x, Y0, z, 0.1, 0.09, ry);
    if (desk) {
      const T = table(gp, x + Math.sin(ry) * 0.045, Y0, z + Math.cos(ry) * 0.045, 0.07, 0.04, 0.03, '#3a2418', ry);
      box(T, '#f3ecd8', 0, 0.03, 0, 0.05, 0.002, 0.03);
      dot(T, '#1c1917', 0.027, 0.033, -0.012, 0.004, 5);
    }
    return man(gp, x, Y0 + 0.005, z, { h, ry, ...CROSS, top: '#e8e2d2', head: 'jin', hc: '#2b2622', beard: '#2a211c', lap: true, sleeves: true, ...o } as PO);
  };
  const w = poet(0.22, -1, { top: '#f1ece0', hands: [[-0.12, 0.22, 0.24], [0.06, 0.24, 0.3]] });
  rod(gp, w.handR, [w.handR[0], w.handR[1] + 0.025, w.handR[2]], 0.0015, '#5a3820', 3);
  poet(-0.17, -1, { top: '#a9b8b0', hands: [[-0.12, 0.24, 0.26], [0.1, 0.24, 0.27]] });
  const d1 = poet(0.0, 1, { top: '#c4a77c', hands: [[-0.1, 0.26, 0.2], [0.1, 0.5, 0.22]] }, false);
  cup(gp, d1.handR[0], d1.handR[1] - 0.004, d1.handR[2], 0.008, '#7a2a1e');
  poet(-0.26, 1, { top: '#8c9cb0', hands: [[-0.1, 0.24, 0.26], [0.1, 0.24, 0.26]] });
  poet(0.3, 1, { top: '#d7cfb8', beard: '#e2ddd2', hands: [[-0.11, 0.24, 0.26], [0.11, 0.24, 0.26]] });
  const zr = 0.06, xr = sx(zr) - 0.085;
  mat2(gp, xr, Y0, zr, 0.1, 0.09, Math.PI / 2);
  man(gp, xr, Y0, zr, { h, ry: Math.PI / 2 - 0.2, pose: 'kneel', top: '#a39c8c', head: 'jin', hc: '#2b2622', hands: [[-0.1, 0.36, 0.2], [0.05, 0.12, 0.3]], lean: 0.3 });
  blades(gp, leaves);
};

// =========================================================================================================
// 科举 — the Sui–Tang jinshi examination in the Ministry of Rites compound (礼部贡院): a rammed-earth enclosure topped
// with thorn brush (棘闱), candidates in white hemp robes (麻衣如雪) and black futou sitting on mats at low desks in the
// open corridors (廊下席地而坐), each with an exam basket and candle (三条烛), the examiner on the terrace of a Tang hall.
// Refs: 《唐摭言》《封氏闻见记》 on 棘围/廊下/三条烛; Tang halls after 南禅寺·佛光寺 (no Ming 号舍 cells — those are later).
// =========================================================================================================
// Ref: Commons "Prüfungszellen-Nanking.jpg" (Jiangnan Gongyuan) — rows of open whitewashed cells with two board shelves.
const lf_keju: Builder = (gp) => {
  const EARTH = '#b19b78', ROOF = '#585b60', COL = '#8a3d2a', PLASTER = '#dcd4c2', STONE = '#a8a296', ROBE = '#e3dccb';
  const WX = 0.326, WZ0 = -0.3, WZ1 = 0.27, WH = 0.13, WT = 0.02;
  const inside = (x: number, z: number) => Math.abs(x) < WX && z > WZ0 && z < WZ1;
  land(gp, '#a59a84', (x, _y, z) => {
    const n = fbm(x * 18, 0.4, z * 18, 3);
    if (inside(x, z)) return shade('#ad9c7e', 0.9 + n * 0.16);
    return shade(mix('#7a8058', '#8d8865', n), 0.92 + n * 0.12);
  }, undefined, '#6b5a44');
  pbox(gp, STONE, 0, Y0, (-0.105 + WZ1) / 2, 0.06, 0.003, WZ1 + 0.105, bricks(STONE, 0.03, 0.02, 0.1), 0.008);
  pbox(gp, STONE, 0, Y0, WZ1 + 0.06, 0.07, 0.003, 0.12, bricks(STONE, 0.03, 0.02, 0.1), 0.008);
  // rammed-earth walls (夯土) with tamped layers, a tile coping, and brushwood of jujube thorns along the top
  const layered = (x: number, y: number, z: number) => shade(EARTH, (Math.floor((y - Y0) / 0.011) % 2 ? 0.93 : 1.02) + (fbm(x * 30, y * 60, z * 30, 2) - 0.5) * 0.12);
  const thorns: [number, number, number, number][] = [];
  const wall = (x: number, z: number, lx: number, lz: number) => {
    pbox(gp, EARTH, x, Y0, z, lx, WH, lz, layered, 0.011);
    const along = lx > lz;
    tileRoof(gp, x, Y0 + WH - 0.002, z, (along ? lx : lz) + 0.008, WT + 0.016, 0.012, ROOF, along ? 0 : Math.PI / 2, false);
    thorns.push([x, z, along ? lx : lz, along ? 0 : 1]);
  };
  wall(0, WZ0, WX * 2 + WT, WT);
  for (const s of [-1, 1]) {
    wall(s * WX, (WZ0 + WZ1) / 2, WT, WZ1 - WZ0);
    wall(s * (0.07 + (WX - 0.07) / 2), WZ1, WX - 0.07 + WT / 2, WT);
  }
  for (const [cx, cz, len, ax] of thorns) {
    const n = Math.round(len / 0.022);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (i + 0.2 + hash3(i, cx * 5, cz * 5) * 0.6) * (len / n), x = ax ? cx : cx + t, z = ax ? cz + t : cz, y = Y0 + WH + 0.01;
      // a bundle of thorny jujube switches laid along the coping, tips splaying outwards
      for (let k = 0; k < 3; k++) {
        const a = (k / 3 + hash3(i, k, cx * 7 + cz * 3) * 0.3) * TAU, l = 0.014 + hash3(k, i, 2) * 0.016, e = 0.002 + hash3(i, k, 5) * 0.012;
        const tip: V3 = [x + Math.cos(a) * l, y + e, z + Math.sin(a) * l];
        rod(gp, [x - Math.cos(a) * 0.006, y - 0.004, z - Math.sin(a) * 0.006], tip, 0.0022, k % 2 ? '#4a3a2b' : '#5d4834', 3);
        if (k < 1) rod(gp, [(x + tip[0]) / 2, (y + tip[1]) / 2, (z + tip[2]) / 2], [tip[0] + Math.cos(a + 1) * 0.008, tip[1] + 0.006, tip[2] + Math.sin(a + 1) * 0.008], 0.0016, '#4a3a2b', 3);
      }
    }
  }
  // the examination hall on its stone terrace: seven columns, plastered walls, a plank door and lattice windows,
  // the red-and-white lintel (七朱八白), bracket blocks and a gently pitched hip roof with owl-tail ridge ends (鸱尾)
  const hz = -0.235, hw = 0.25, hd = 0.08, hh = 0.13, ty = 0.022, hy = Y0 + ty;
  pbox(gp, STONE, 0, Y0, -0.2, 0.3, ty, 0.18, bricks(STONE, 0.03, 0.011), 0.01);
  for (let i = 0; i < 3; i++) box(gp, shade(STONE, 0.95), 0, Y0 + i * 0.0073, -0.105 + 0.007 - i * 0.007, 0.07, 0.0073, 0.014);
  const bay = hw / 6;
  pbox(gp, PLASTER, 0, hy, hz - 0.006, hw, hh, hd - 0.012, (x, y, _z, _nx, _ny, nz) => {
    if (nz < 0.5) return PLASTER;
    const b = Math.floor((x + hw / 2) / bay), yy = y - hy;
    if (b >= 2 && b <= 3 && yy < hh * 0.82) return Math.abs(x) < 0.0015 ? '#3a1d14' : shade('#6e3426', hash3(Math.floor(yy * 160), b, 3) > 0.85 ? 1.15 : 1);
    if ((b === 1 || b === 4) && yy > hh * 0.3 && yy < hh * 0.72) return Math.floor(x * 420) % 2 ? '#3b2a20' : '#6e3426';
    return PLASTER;
  }, 0.005);
  for (let i = 0; i <= 6; i++) {
    const x = -hw / 2 + i * bay;
    cyl(gp, COL, x, hy, hz + hd / 2 - 0.004, 0.0048, hh, 8);
    box(gp, '#6b3324', x, hy + hh + 0.002, hz + hd / 2 - 0.004, 0.014, 0.009, 0.014);
  }
  pbox(gp, COL, 0, hy + hh - 0.012, hz + hd / 2 - 0.004, hw + 0.01, 0.01, 0.007, (x, _y, _z, _nx, _ny, nz) => (nz > 0.5 && ((x + 1) / 0.0075 | 0) % 3 === 0 ? '#e6dccb' : COL), 0.0035);
  const R0 = (hd / 2 + 0.038) / Math.SQRT1_2, sx = (hw / 2 + 0.038) / (hd / 2 + 0.038);
  const top = proof(gp, 0, hy + hh + 0.006, hz, { n: 4, R0, R1: 0.024, h: 0.052, lift: 0.22, tile: ROOF, sx });
  box(gp, shade(ROOF, 0.7), 0, top, hz, 0.024 * Math.SQRT1_2 * sx * 2 + 0.01, 0.009, 0.01);
  for (const s of [-1, 1]) tube(gp, [[s * 0.044, top, hz], [s * 0.047, top + 0.016, hz], [s * 0.04, top + 0.028, hz]], 0.006, 0.0035, shade(ROOF, 0.7), { radial: 5, sub: 3 });
  // the examiner (知贡举, a fourth-rank official in vermilion) at his desk on the terrace, an aide in green
  table(gp, 0, hy, -0.13, 0.08, 0.035, 0.026, '#3a2418');
  box(gp, '#efe7d2', -0.012, hy + 0.027, -0.13, 0.04, 0.002, 0.024);
  box(gp, '#2a2622', 0.024, hy + 0.027, -0.132, 0.012, 0.004, 0.016);
  mat2(gp, 0, hy, -0.165, 0.07, 0.05, 0);
  man(gp, 0, hy + 0.004, -0.168, { h: 0.115, ...CROSS, top: '#8e3b2e', head: 'futou', beard: '#2a211c', lap: true, sleeves: true, hands: [[-0.09, 0.26, 0.28], [0.08, 0.26, 0.28]] });
  const aide = man(gp, 0.085, hy, -0.15, { h: 0.12, ry: -0.5, top: '#5c6e50', head: 'futou', dress: 'ankle', pose: 'stand', hands: [[-0.07, 0.62, 0.17], [0.07, 0.62, 0.17]] });
  rod(gp, aide.handL, aide.handR, 0.0045, '#e8dfc8', 6);
  // two open corridors (廊庑) facing south across the court: a paved floor, plastered back wall, columns, tile roof
  const ch = 0.125, cz = 0.02, cw = 0.235;
  for (const s of [-1, 1]) {
    const cx = s * (0.08 + cw / 2);
    pbox(gp, STONE, cx, Y0, cz + 0.004, cw + 0.01, 0.007, 0.108, bricks(STONE, 0.026, 0.01), 0.01);
    pbox(gp, PLASTER, cx, Y0 + 0.007, -0.03, cw, ch - 0.007, 0.008, (_x, y) => (y < Y0 + 0.022 ? '#9a8f7e' : PLASTER), 0.01);
    for (let i = 0; i <= 4; i++) cyl(gp, COL, s * (0.08 + (i / 4) * cw), Y0 + 0.007, 0.07, 0.0042, ch - 0.007, 7);
    pbox(gp, COL, cx, Y0 + ch - 0.011, 0.07, cw + 0.008, 0.01, 0.007, (x, _y, _z, _nx, _ny, nz) => (nz > 0.5 && ((x + 1) / 0.0075 | 0) % 3 === 0 ? '#e6dccb' : COL), 0.0035);
    tileRoof(gp, cx, Y0 + ch - 0.004, cz, cw + 0.03, 0.15, 0.04, ROOF);
    // candidates, three to a corridor, writing at low desks
    for (let i = 0; i < 3; i++) {
      const x = s * (0.12 + i * 0.075), z = 0.012, v = hash3(i, s + 3, 7), Ym = Y0 + 0.007;
      mat2(gp, x, Ym, z, 0.06, 0.05, 0);
      const T = table(gp, x, Ym, z + 0.036, 0.05, 0.026, 0.02, '#4a3020');
      box(T, '#efe7d2', 0.004, 0.02, 0, 0.032, 0.0015, 0.02);
      box(T, '#262320', -0.019, 0.02, 0.002, 0.009, 0.004, 0.012);
      if (v > 0.35) { cyl(T, '#e9e0c8', 0.02, 0.02, -0.008, 0.0024, 0.012, 6); if (v > 0.75) flame(T, 0.02, 0.032, -0.008, 0.0028); }
      const think = i === 1 && s > 0;
      const r = man(gp, x, Ym + 0.004, z, {
        h: 0.11, ...CROSS, top: shade(ROBE, 0.94 + v * 0.1), head: 'futou', hc: '#1c1917', lap: true, sleeves: true, beard: v > 0.6 ? '#2a211c' : undefined,
        lean: think ? -0.05 : 0.22,
        hands: think ? [[-0.09, 0.26, 0.26], [0.03, 0.6, 0.14]] : [[-0.07, 0.24, 0.3], [0.06, 0.26, 0.33]],
      });
      if (!think) rod(gp, r.handR, [r.handR[0], r.handR[1] + 0.013, r.handR[2]], 0.0016, '#3a2418', 3);
      // the exam basket (考篮) set beside the mat
      const bx = x + 0.03, bz = z - 0.012;
      pbox(gp, '#9a7a4c', bx, Ym, bz, 0.014, 0.013, 0.016, (x2, y2) => (Math.floor((x2 + y2) * 420) % 2 ? '#9a7a4c' : '#836537'), 0.004);
      tube(gp, [[bx, Ym + 0.013, bz - 0.006], [bx, Ym + 0.024, bz], [bx, Ym + 0.013, bz + 0.006]], 0.0013, 0.0013, '#6b5030', { radial: 3, sub: 3 });
    }
  }
  // the gatehouse (门屋): three bays, the middle one open, double plank doors swung inward
  const gz = WZ1;
  pbox(gp, PLASTER, 0, Y0, gz, 0.15, 0.13, 0.044, (x, y, _z, _nx, _ny, nz) => {
    if (Math.abs(nz) > 0.5 && Math.abs(x) < 0.024 && y < Y0 + 0.105) return '#2c2622';
    return y < Y0 + 0.012 ? '#9a8f7e' : PLASTER;
  }, 0.008);
  for (const x of [-0.075, -0.025, 0.025, 0.075]) cyl(gp, COL, x, Y0, gz + 0.024, 0.0042, 0.13, 7);
  pbox(gp, COL, 0, Y0 + 0.12, gz + 0.024, 0.16, 0.009, 0.006, (x, _y, _z, _nx, _ny, nz) => (nz > 0.5 && ((x + 1) / 0.0075 | 0) % 3 === 0 ? '#e6dccb' : COL), 0.0035);
  for (const s of [-1, 1]) box(gp, '#6e3426', s * 0.024, Y0, gz - 0.034, 0.004, 0.104, 0.022, s * 0.35);
  const gR0 = (0.022 + 0.032) / Math.SQRT1_2;
  const gt = proof(gp, 0, Y0 + 0.132, gz, { n: 4, R0: gR0, R1: 0.012, h: 0.036, lift: 0.22, tile: ROOF, sx: (0.075 + 0.032) / (0.022 + 0.032) });
  box(gp, shade(ROOF, 0.7), 0, gt, gz, 0.04, 0.007, 0.008);
  // a clerk carrying the candles and paper to the corridors
  const ck = man(gp, 0.0, Y0, 0.13, { h: 0.12, ry: Math.PI - 0.3, top: '#6d6a5c', head: 'futou', pose: 'walk', phase: 0.3, hands: [[-0.06, 0.6, 0.18], [0.06, 0.6, 0.18]] });
  box(gp, '#ece3cc', (ck.handL[0] + ck.handR[0]) / 2, ck.handL[1] + 0.004, (ck.handL[2] + ck.handR[2]) / 2, 0.022, 0.01, 0.016, Math.PI - 0.3);
  // outside the gate a guard in lamellar armour searches a candidate's basket; another waits his turn
  const gd = man(gp, 0.045, Y0, 0.36, { h: 0.12, ry: -0.8, top: '#7a4a32', bottom: '#4a3d30', armor: '#5d554a', hat: '#4a4a48', hatStyle: 'helmet', pose: 'crouch', lean: 0.1, hands: [[-0.06, 0.18, 0.3], [0.06, 0.2, 0.32]] });
  const bx = gd.handL[0] - 0.006, bz = gd.handL[2] + 0.004;
  pbox(gp, '#9a7a4c', bx, Y0, bz, 0.02, 0.016, 0.015, (x2, y2) => (Math.floor((x2 + y2) * 420) % 2 ? '#9a7a4c' : '#836537'), 0.004);
  box(gp, '#836537', bx + 0.016, Y0, bz + 0.01, 0.02, 0.003, 0.015, 0.4);
  box(gp, '#efe7d2', bx + 0.022, Y0 + 0.003, bz + 0.012, 0.012, 0.004, 0.009, 0.3);
  man(gp, -0.025, Y0, 0.385, { h: 0.12, ry: 0.9, top: ROBE, head: 'futou', dress: 'ankle', pose: 'stand', hands: [[-0.07, 0.6, 0.15], [0.07, 0.6, 0.15]] });
  const w2 = man(gp, -0.15, Y0, 0.37, { h: 0.12, ry: 0.5, top: shade(ROBE, 0.95), head: 'futou', dress: 'ankle', pose: 'carry', beard: '#2a211c', hands: [[-0.12, 0.45, 0.04], [0.13, 0.45, 0.04]] });
  pbox(gp, '#9a7a4c', w2.handR[0], w2.handR[1] - 0.018, w2.handR[2], 0.018, 0.014, 0.013, (x2, y2) => (Math.floor((x2 + y2) * 420) % 2 ? '#9a7a4c' : '#836537'), 0.004);
  fuse(gp);
};

// =========================================================================================================
// 马球 — Tang polo: two riders in round-collar robes and futou gallop after the ball, watched from a pavilion
// Ref: the polo mural from Prince Zhanghuai's tomb (章怀太子墓, 706): futou, narrow-sleeved round-collar robes, black
// boots, crescent-headed sticks, horses' tails tied in a knot; an oiled earth field (油洒地) ringed by a low wall (矮墙).
// =========================================================================================================
/** Replace the flowing tail horse() gives with the short knotted tail of Tang polo ponies. */
function knotTail(G: THREE.Object3D, mane: string): void {
  const k = G.children, end = k.length - 2, mh = new THREE.Color(mane).getHex();
  let i = end - 1;
  while (i > 0 && ((k[i] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex() === mh) i--;
  const sw = k[i] as THREE.Mesh;
  sw.updateMatrix();
  sw.geometry.computeBoundingBox();
  const bb = sw.geometry.boundingBox!.clone().applyMatrix4(sw.matrix);
  const root: V3 = [0, bb.max.y - 0.014, bb.max.z - 0.004];
  for (const m of k.slice(i, end)) G.remove(m);
  const a: V3 = [0, root[1] - 0.035, root[2] - 0.035], b: V3 = [0, root[1] - 0.075, root[2] - 0.04];
  tube(G, [root, a], 0.014, 0.012, mane, { radial: 7, sub: 2 });
  ell8(G, mane, a[0], a[1], a[2], 0.02, 0.018, 0.022);
  tube(G, [a, b], 0.011, 0.006, mane, { radial: 6, sub: 2 });
}
// Ref: Commons "Tang Dynasty Polo (48792911158).jpg" (Prince Zhanghuai tomb mural) — riders in futou on chestnut/white horses.
const lf_polo: Builder = (gp) => {
  land(gp, '#c9a978', (x, _y, z) => {
    const r = Math.hypot(x, z);
    if (r > 0.43) return grassP('#7a8a52', 14)(x, 0, z, 0, 1, 0);
    return shade('#b99d74', 0.9 + fbm(x * 22, 1, z * 22, 3) * 0.2 - (hash3(Math.floor(x * 90), 1, Math.floor(z * 90)) > 0.9 ? 0.08 : 0));
  }, undefined, '#6b4f3a');
  // the low rammed-earth wall (矮墙) ringing the field, open at the front
  const fx = 0.37;
  for (let i = 0; i < 30; i++) {
    const a0 = Math.PI * 0.62 + (i / 30) * Math.PI * 1.76, a1 = Math.PI * 0.62 + ((i + 1) / 30) * Math.PI * 1.76, am = (a0 + a1) / 2;
    if (Math.abs(Math.cos(am)) < 0.42 && Math.sin(am) < 0) continue;
    const R = 0.445, L = R * (a1 - a0) + 0.002, x = Math.cos(am) * R, z = Math.sin(am) * R;
    box(gp, shade('#b29a76', 0.94 + hash3(i, 2, 3) * 0.1), x, Y0, z, L, 0.03, 0.014, -am + Math.PI / 2);
    box(gp, '#5a5a5c', x, Y0 + 0.03, z, L, 0.005, 0.02, -am + Math.PI / 2);
  }
  // goals: a painted board with a round hole and a net bag behind
  const goal = (x: number, s: number) => {
    const G = grp(gp, x, Y0, 0.05, s * Math.PI / 2);
    for (const k of [-1, 1]) { cyl(G, '#7a3a2a', k * 0.05, 0, 0, 0.005, 0.15, 8); dot(G, '#8a7040', k * 0.05, 0.152, 0, 0.007, 6); }
    pbox(G, '#7a3a2a', 0, 0.075, 0, 0.1, 0.06, 0.006, (px, py) => (Math.hypot(px, py - 0.105) < 0.016 ? '#1a1412' : Math.abs(Math.hypot(px, py - 0.105) - 0.02) < 0.004 ? '#8a7040' : '#7a3a2a'), 0.004);
    box(G, '#5a3a26', 0, 0.137, 0, 0.11, 0.006, 0.008);
    ell8(G, '#6b5a40', 0, 0.092, -0.016, 0.016, 0.024, 0.014).material = mat('#6b5a40', { transparent: 0.55 });
  };
  goal(-fx + 0.01, 1); goal(fx - 0.01, -1);
  // riders: futou caps, round-collar robes hitched up, crescent-headed mallets
  const S = 0.32, hb = 0.6;
  const rider = (x: number, z: number, ry: number, coat: string, robe: string, stride: number, handR: V3, head: V3) => {
    const G = grp(gp, x, Y0, z, ry, S);
    const seat = horse(G, coat, shade(coat, 0.4), { stride, cloth: '#6e3a2a', saddle: '#3b2414' });
    knotTail(G, shade(coat, 0.4));
    const r = man(G, 0, seat - hb * 0.45, -0.02, {
      h: hb, pose: 'sit', top: robe, bottom: '#e9dcc0', shoes: '#1c1917', head: 'futou', lean: 0.25, detail: 'hi',
      feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.08, 0.5, 0.32], handR],
    });
    rod(G, r.handL, [0, seat + 0.05, 0.26], 0.002, '#2a1a10', 3);
    const [hx, hy, hz] = r.handR, d = new THREE.Vector3(head[0] - hx, head[1] - hy, head[2] - hz).normalize();
    rod(G, r.handR, head, 0.006, '#8a5a2b', 5);
    const side = new THREE.Vector3(d.z, 0, -d.x).normalize();
    tube(G, [head, [head[0] + side.x * 0.035 + d.x * 0.01, head[1] - 0.008, head[2] + side.z * 0.035 + d.z * 0.01], [head[0] + side.x * 0.06 - d.x * 0.012, head[1] + 0.004, head[2] + side.z * 0.06 - d.z * 0.012]], 0.009, 0.006, '#5a3a1e', { radial: 5, sub: 3 });
    for (let i = 0; i < 3; i++) blob(gp, '#c9b48e', x - Math.sin(ry) * (0.1 + i * 0.03), Y0 + 0.008 + i * 0.005, z - Math.cos(ry) * (0.1 + i * 0.03), 0.014 + i * 0.004, 0.008 + i * 0.002, 0.014 + i * 0.004, i).material = mat('#c9b48e', { transparent: 0.22 - i * 0.06 });
    return G;
  };
  rider(-0.14, 0.1, Math.PI / 2 - 0.25, '#8a5530', '#9a4a38', 0.08, [0.22, 0.32, 0.38], [0.32, 0.02, 0.62]);
  rider(0.2, -0.05, -Math.PI / 2 - 0.4, '#d9d2c4', '#4d5f74', 0.07, [0.18, 0.95, -0.05], [0.28, 1.12, -0.3]);
  dot(gp, '#a8543a', 0.05, Y0 + 0.006, 0.15, 0.007, 8);
  // spectator pavilion with the emperor, court ladies and a scoring drum
  const pz = -0.33;
  pbox(gp, '#b9b3a6', 0, Y0, pz, 0.34, 0.03, 0.11, bricks('#b9b3a6', 0.03, 0.01), 0.008);
  for (let i = 0; i < 3; i++) box(gp, '#a39d90', 0, Y0 + i * 0.01, pz + 0.064 + i * 0.008, 0.06, 0.01, 0.008);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cyl(gp, '#8a3d2a', -0.15 + i * 0.06, Y0 + 0.03, pz + s * 0.045, 0.005, 0.1, 8);
  box(gp, '#8a3d2a', 0, Y0 + 0.13, pz, 0.32, 0.01, 0.1);
  for (let i = 0; i < 5; i++) box(gp, '#7a3526', -0.12 + i * 0.06, Y0 + 0.042, pz + 0.045, 0.054, 0.012, 0.003);
  proof(gp, 0, Y0 + 0.138, pz, { n: 4, R0: 0.11, R1: 0.035, h: 0.06, lift: 0.45, tile: '#3e4b55', sx: 1.9 });
  man(gp, 0, Y0 + 0.03, pz - 0.005, { h: 0.11, top: '#b48a3a', bottom: '#b48a3a', head: 'futou', pose: 'sit', beard: '#1c1714', hipY: 0.3 });
  box(gp, '#5a1f17', 0, Y0 + 0.03, pz - 0.01, 0.06, 0.03, 0.04);
  ['#a8706a', '#71806a', '#b89a5e', '#76809a'].forEach((c, i) => {
    const x = [-0.12, -0.065, 0.065, 0.12][i];
    man(gp, x, Y0 + 0.03, pz + 0.01, { h: 0.1, top: c, bottom: shade(c, 0.8), head: 'highbun', dress: 'ankle', ry: -x * 2, pose: i % 2 ? 'cheer' : 'relax' });
  });
  const dr = grp(gp, -0.3, Y0, -0.18, 0.6);
  for (const s of [-1, 1]) rod(dr, [s * 0.025, 0, 0], [s * 0.022, 0.06, 0], 0.003, '#3a2418', 4);
  const drum = cyl(dr, '#7a3526', 0, 0.06, 0, 0.026, 0.03, 14); drum.rotation.z = Math.PI / 2; drum.position.set(0, 0.075, 0);
  for (const s of [-1, 1]) add(dr, CYL(14), mat('#e6d3a8'), s * 0.016, 0.075, 0, 0.05, 0.002, 0.05, 0, 0, Math.PI / 2);
  man(gp, -0.33, Y0, -0.12, { h: 0.12, ry: 2.2, top: '#6a4a2a', head: 'futou', pose: 'cheer' });
  // banners at the corners and a few grooms holding spare horses
  for (const [bx, bz, c] of [[-0.36, -0.2, '#8e4434'], [0.36, -0.2, '#4d5f74'], [-0.33, 0.27, '#8e4434'], [0.33, 0.27, '#4d5f74']] as const) banner(gp, bx, Y0, bz, 0.16, c, 0.05);
  const sp = grp(gp, -0.22, Y0, 0.33, Math.PI / 2 - 0.2, 0.3);
  horse(sp, '#3a2a20', '#1c1410', { cloth: '#4d5f74' });
  knotTail(sp, '#1c1410');
  man(gp, -0.06, Y0, 0.36, { h: 0.15, ry: -1.4, top: '#a3826a', head: 'futou', pose: 'carry', hands: [[-0.1, 0.55, 0.25], [0.1, 0.5, 0.15]] });
  fuse(gp);
};

// =========================================================================================================
// 唐三彩 — Tang sancai: a camel carrying a band of musicians and a horse, in dripping amber/green/cream lead glazes
// =========================================================================================================
const GZ = { amber: '#c5832e', green: '#3d7a3c', cream: '#eee0bb', brown: '#7c4a20' } as const;
type GzK = keyof typeof GZ;
/** Lead glaze: a base colour with vertical runs of the other glazes and pooled, darker drip ends. */
const glazeP = (k: GzK): Paint => (x, y, z) => {
  const run = fbm(x * 90 + z * 20, y * 5, z * 90 - x * 20, 2), n = fbm(x * 10 + 5, y * 3, z * 10, 3);
  const others: GzK[] = k === 'amber' ? ['cream', 'green'] : k === 'green' ? ['amber', 'cream'] : k === 'cream' ? ['amber', 'green'] : ['amber', 'cream'];
  // mostly the body glaze with soft tonal pooling; only thin vertical runs pick up a neighbouring glaze
  if (run > 0.74) return mix(GZ[k], GZ[others[0]], Math.min(0.8, (run - 0.74) * 5));
  if (run < 0.2 && n > 0.62) return mix(GZ[k], GZ[others[1]], 0.45);
  return shade(GZ[k], 0.9 + n * 0.16 + (run - 0.5) * 0.08);
};
const NEAR = (hex: string): GzK | null => {
  const c = new THREE.Color(hex);
  let best: GzK | null = null, bd = 0.2;
  for (const k of Object.keys(GZ) as GzK[]) {
    const t = new THREE.Color(GZ[k]), d = Math.hypot(c.r - t.r, c.g - t.g, c.b - t.b);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
};
/** Re-glaze every mesh under G whose colour is near a sancai glaze (painted in G's frame so runs line up). */
function glazeAll(G: THREE.Object3D, pick: (hex: string) => Paint | null = h => { const k = NEAR(h); return k ? glazeP(k) : null; }): void {
  G.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(G.matrixWorld).invert();
  const list: THREE.Mesh[] = [];
  G.traverse(o => { if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh); });
  for (const m of list) {
    if (m.userData.noGlaze) continue;
    const mt = m.material as THREE.MeshStandardMaterial, col = mt.color.clone();
    const ca = m.geometry.getAttribute('color');
    if (mt.vertexColors && ca) col.multiply(new THREE.Color(ca.getX(0), ca.getY(0), ca.getZ(0)));
    const hex = '#' + col.getHexString(), paint = pick(hex);
    if (!paint) continue;
    const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const geo = m.geometry.clone();
    for (const a of Object.keys(geo.attributes)) if (a !== 'position' && a !== 'normal') geo.deleteAttribute(a);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    geo.applyMatrix4(M);
    // per-vertex colours so the glazes blend and run into each other like melted lead glaze
    const pa = geo.getAttribute('position'), na = geo.getAttribute('normal'), cols = new Float32Array(pa.count * 3), C = new THREE.Color();
    for (let i = 0; i < pa.count; i++) {
      C.set(paint(pa.getX(i), pa.getY(i), pa.getZ(i), na.getX(i), na.getY(i), na.getZ(i)) ?? hex);
      cols[i * 3] = C.r; cols[i * 3 + 1] = C.g; cols[i * 3 + 2] = C.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.applyMatrix4(M.clone().invert());
    m.geometry = geo;
    m.material = mat('#ffffff', { vc: true, rough: 0.2, flat: false });
  }
}
// 唐三彩 — after the camel carrying musicians from the 中堡村 tomb, Xi'an (Shaanxi History Museum): a roaring white-glazed
// Bactrian with amber hair on crown, throat, humps and forearms, a striped fringed carpet on a platform, seven seated
// musicians in futou facing outwards and a standing woman singer; beside it an amber 三花 horse (cf. 鲜于庭诲墓 pieces).
// Ref: Commons sancai camel with musicians (Shaanxi History Museum) — cream/amber/green lead glazes on a museum plinth.
const lf_sancai: Builder = (gp, r) => {
  if (r?.style === 'liao') {
    // 鸡冠壶与辽三彩 — Khitan Leather-Bag Cockscomb Flask (绿釉皮囊鸡冠壶) with imitation stitched leather seams,
    // tubular spout & arched handle, paired with a Liao sancai stamped floral dish (辽三彩印花盘) and a tall
    // white-glazed vase on a museum plinth.
    const BY = plinth(gp, SITE.paving, { R: 0.46, h: 0.0435 }) + 0.0015, Y = BY;
    // Wooden museum display stands
    pbox(gp, '#3c2418', -0.11, Y, 0.02, 0.24, 0.022, 0.18, (x, _y, z) => shade('#3c2418', 0.92 + fbm(x * 30, 1, z * 30) * 0.16), 0.012).userData.noGlaze = true;
    // 1. Khitan green-glazed leather-bag cockscomb flask (绿釉鸡冠壶): flat oval pouch body that flares from a
    // ringed foot to a broad shoulder, raised stitched leatherwelt ribs, upright spout, and arched cockscomb loop
    const JG = grp(gp, -0.11, Y + 0.022, 0.02, 0.25);
    lathe(JG, [[0, 0], [0.056, 0], [0.052, 0.016], [0.078, 0.09], [0.086, 0.18], [0.068, 0.24], [0.025, 0.26], [0, 0.26]], GZ.green, 0, 0, 0, 20);
    JG.scale.z = 0.68; // flattened leather-pouch cross-section
    // Imitation stitched leather seam ridges (仿皮囊缝合线) along the flanks and shoulder
    for (const sx of [-1, 1]) {
      tube(JG, [[sx * 0.052, 0.02, 0], [sx * 0.082, 0.11, 0], [sx * 0.088, 0.19, 0], [sx * 0.062, 0.245, 0]], 0.006, 0.005, GZ.cream, { radial: 6, sub: 3 });
    }
    // Vertical tubular drinking spout (流) at front (+x) & arched cockscomb crest handle (鸡冠形提梁) with finger hole
    cyl(JG, GZ.green, 0.038, 0.245, 0, 0.013, 0.042, 10);
    lathe(JG, [[0.01, 0], [0.016, 0.006], [0.012, 0.012]], GZ.cream, 0.038, 0.282, 0, 10);
    tube(JG, [[-0.048, 0.235, 0], [-0.042, 0.305, 0], [-0.01, 0.325, 0], [0.018, 0.295, 0], [0.015, 0.25, 0]], 0.011, 0.009, GZ.amber, { radial: 8, sub: 4 });
    // Cockscomb serrated notches along top of the arch
    for (let i = 0; i < 5; i++) ell8(JG, GZ.amber, -0.038 + i * 0.013, 0.318 + Math.sin((i / 4) * Math.PI) * 0.012, 0, 0.006, 0.01, 0.005);
    glazeAll(JG);
    // 2. Liao sancai stamped peony dish (辽三彩印花盘) tilted on a display easel at front-right
    const D = grp(gp, 0.16, Y + 0.095, 0.08, -0.45);
    D.rotation.x = 1.05;
    lathe(D, [[0, 0], [0.055, 0], [0.095, 0.018], [0.115, 0.026], [0.11, 0.028], [0, 0.012]], GZ.cream, 0, 0, 0, 24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ell8(D, i % 2 ? GZ.green : GZ.amber, Math.cos(a) * 0.062, 0.018, Math.sin(a) * 0.062, 0.018, 0.005, 0.024, a);
    }
    ell8(D, GZ.amber, 0, 0.019, 0, 0.024, 0.006, 0.024);
    glazeAll(D);
    rod(gp, [0.12, Y, 0.12], [0.16, Y + 0.14, 0.04], 0.004, '#3c2418', 4);
    rod(gp, [0.2, Y, 0.04], [0.16, Y + 0.14, 0.04], 0.004, '#3c2418', 4);
    // 3. Tall Liao amber-glazed long-necked phoenix vase at back-right + Khitan nobleman admiring the glazed wares
    const V = grp(gp, 0.12, Y, -0.15);
    lathe(V, [[0, 0], [0.036, 0], [0.068, 0.07], [0.064, 0.14], [0.022, 0.2], [0.02, 0.28], [0.034, 0.31], [0, 0.31]], GZ.amber, 0, 0, 0, 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ell8(V, GZ.green, Math.cos(a) * 0.064, 0.105, Math.sin(a) * 0.064, 0.012, 0.022, 0.006, -a);
    }
    glazeAll(V);
    man(gp, -0.26, Y, -0.14, { h: 0.22, ry: 0.65, top: '#2e5945', head: 'futou', hc: '#d97706', skin: '#dfb995', hands: [[-0.08, 0.45, 0.14], [0.09, 0.52, 0.18]] });
    return;
  }
  // shared museum plinth with a pale stone top
  const BY = plinth(gp, SITE.paving, { R: 0.46, h: 0.0435 }) + 0.0015, Y = BY;
  // ---- the camel: local +z forward, standing square on its rectangular base ----
  const C = grp(gp, -0.15, Y, -0.04, 0.55, 0.78);
  pbox(C, '#6f7f4f', 0, 0, 0, 0.15, 0.016, 0.36, (x, _y, z) => shade('#6f7f4f', 0.9 + fbm(x * 30, 1, z * 30, 2) * 0.2), 0.012).userData.noGlaze = true;
  const B0 = 0.016, CR = GZ.cream, BR = GZ.brown, AM = GZ.amber;
  // legs: thick forearm / gaskin, slim cannon, broad soft foot-pads; amber hair "sleeves" on the forearms
  for (const sx of [-1, 1]) {
    const x = sx * 0.042;
    tube(C, [[x, 0.28, 0.105], [x * 1.08, 0.2, 0.11], [x * 1.05, 0.13, 0.112]], 0.03, 0.018, CR, { radial: 9, sub: 3 });
    tube(C, [[x * 1.05, 0.13, 0.112], [x, 0.07, 0.112], [x, B0 + 0.014, 0.115]], 0.014, 0.011, CR, { radial: 8, sub: 3 });
    ell8(C, CR, x * 1.05, 0.13, 0.112, 0.016, 0.015, 0.016);
    ell8(C, BR, x * 1.1, 0.225, 0.113, 0.027, 0.045, 0.027);
    ell8(C, BR, x * 1.1, 0.185, 0.115, 0.022, 0.016, 0.022);
    tube(C, [[x, 0.28, -0.11], [x * 1.08, 0.2, -0.13], [x * 1.04, 0.125, -0.142]], 0.034, 0.019, CR, { radial: 9, sub: 3 });
    tube(C, [[x * 1.04, 0.125, -0.142], [x, 0.07, -0.128], [x, B0 + 0.014, -0.12]], 0.015, 0.011, CR, { radial: 8, sub: 3 });
    ell8(C, CR, x * 1.04, 0.125, -0.142, 0.017, 0.016, 0.017);
    for (const fz of [0.122, -0.112]) ell8(C, CR, x, B0 + 0.008, fz, 0.022, 0.009, 0.03);
  }
  // barrel body, humps, short tail
  sweep(C, [{ p: [0, 0.29, -0.165], w: 0.045, h: 0.05 }, { p: [0, 0.3, -0.12], w: 0.074, h: 0.08 }, { p: [0, 0.305, 0.0], w: 0.08, h: 0.088 }, { p: [0, 0.31, 0.1], w: 0.07, h: 0.082 }, { p: [0, 0.315, 0.15], w: 0.045, h: 0.06 }], CR, { radial: 14, sub: 5 });
  for (const hz of [-0.07, 0.065]) ell8(C, BR, 0, 0.37, hz, 0.04, 0.05, 0.045);
  tube(C, [[0, 0.3, -0.17], [0, 0.26, -0.185], [0, 0.22, -0.18]], 0.009, 0.006, CR, { radial: 6, sub: 3 });
  // S-curved neck rising to a head flung back, mouth open; shaggy amber-brown mane hanging under the throat
  const neck: V3[] = [[0, 0.31, 0.13], [0, 0.295, 0.19], [0, 0.33, 0.245], [0, 0.42, 0.262], [0, 0.51, 0.25]];
  tube(C, neck, 0.036, 0.024, CR, { radial: 10, sub: 4 });
  // the shaggy throat mane: one hanging fleece along the lower neck, ragged at its lower edge
  tube(C, [[0, 0.27, 0.19], [0, 0.29, 0.24], [0, 0.35, 0.275], [0, 0.43, 0.28]], 0.03, 0.018, BR, { radial: 8, sub: 4 });
  for (let i = 0; i < 4; i++) ell8(C, shade(BR, 0.92 + i * 0.05), 0, 0.255 + i * 0.03, 0.215 + i * 0.02, 0.02, 0.022, 0.016, 0, 0.4);
  const HD = grp(C, 0, 0.52, 0.25);
  HD.rotation.x = -0.85;
  ell8(HD, CR, 0, 0, 0.0, 0.026, 0.027, 0.04);
  ell8(HD, CR, 0, 0.006, 0.05, 0.017, 0.015, 0.04, 0, 0.12);
  ell8(HD, CR, 0, -0.03, 0.04, 0.014, 0.008, 0.034, 0, -0.5);
  ell8(HD, '#5a2418', 0, -0.014, 0.06, 0.011, 0.01, 0.022, 0, -0.2);
  for (const s2 of [-1, 1]) {
    ell8(HD, CR, s2 * 0.021, 0.022, -0.022, 0.006, 0.013, 0.005, 0, 0, s2 * 0.5);
    ell8(HD, '#2a1d14', s2 * 0.022, 0.014, 0.018, 0.0045, 0.004, 0.004);
    ell8(HD, '#2a1d14', s2 * 0.008, 0.012, 0.088, 0.003, 0.002, 0.004);
  }
  ell8(HD, BR, 0, 0.026, -0.008, 0.022, 0.013, 0.028);
  // platform and striped, fringed carpet over the humps
  const PY = 0.415, PW = 0.16, PL = 0.27;
  box(C, '#6b4a2a', 0, PY - 0.014, 0, PW - 0.01, 0.012, PL - 0.01);
  const STR = [AM, '#3e5d86', CR, GZ.green];
  pbox(C, CR, 0, PY - 0.006, 0, PW, 0.008, PL, (_x, _y, z) => STR[Math.floor((z + 1) / 0.022) % 4], 0.008).userData.noGlaze = true;
  for (const s2 of [-1, 1]) {
    pbox(C, CR, s2 * (PW / 2 + 0.002), PY - 0.07, 0, 0.004, 0.064, PL * 0.86, (_x, y, z) => (y < PY - 0.06 ? AM : STR[Math.floor((z + 1) / 0.022) % 4]), 0.008).userData.noGlaze = true;
    for (let i = 0; i < 12; i++) rod(C, [s2 * (PW / 2 + 0.002), PY - 0.07, -PL * 0.4 + i * PL * 0.073], [s2 * (PW / 2 + 0.003), PY - 0.084, -PL * 0.4 + i * PL * 0.073], 0.0022, AM, 3);
  }
  // seven musicians sitting cross-legged, facing out: pipa, sheng, harp, panpipes, flute, clappers, bili
  const mus: [number, number, number, string, string][] = [
    [-0.052, 0.085, -Math.PI / 2 + 0.3, GZ.green, 'pipa'], [-0.055, 0.0, -Math.PI / 2, CR, 'sheng'], [-0.052, -0.085, -Math.PI / 2 - 0.3, AM, 'harp'],
    [0.052, 0.085, Math.PI / 2 - 0.3, AM, 'pan'], [0.055, 0.0, Math.PI / 2, GZ.green, 'flute'], [0.052, -0.085, Math.PI / 2 + 0.3, CR, 'clap'],
    [0, -0.115, Math.PI, GZ.green, 'bili'],
  ];
  for (const [mx, mz, ry, robe, ins] of mus) {
    const r = man(C, mx, PY, mz, { h: 0.11, ry, ...CROSS, top: robe, head: 'futou', hc: '#1c1714', skin: '#e3c4a6', lap: true, hands: [[-0.08, 0.32, 0.22], [0.08, 0.34, 0.22]] });
    const I = grp(C, (r.handL[0] + r.handR[0]) / 2, (r.handL[1] + r.handR[1]) / 2, (r.handL[2] + r.handR[2]) / 2, ry);
    if (ins === 'pipa') { ell8(I, AM, 0, -0.006, 0.006, 0.011, 0.016, 0.005, 0, 0, 0.6); rod(I, [0, 0, 0.006], [-0.016, 0.022, 0.006], 0.0025, BR, 4); }
    else if (ins === 'flute') rod(I, [-0.02, 0.004, 0.004], [0.02, 0.006, 0.006], 0.0025, BR, 4);
    else if (ins === 'bili') rod(I, [0, -0.004, 0.004], [0, 0.012, 0.02], 0.0026, BR, 4);
    else if (ins === 'sheng') { for (let k = 0; k < 5; k++) rod(I, [-0.006 + k * 0.003, 0, 0.004], [-0.006 + k * 0.003, 0.02 + (k % 2) * 0.004, 0.004], 0.0018, CR, 3); }
    else if (ins === 'pan') box(I, AM, 0, -0.006, 0.004, 0.016, 0.014, 0.003);
    else if (ins === 'harp') tube(I, [[0, -0.012, 0.004], [0.007, 0.01, 0.006], [0, 0.026, 0.004]], 0.0025, 0.0025, BR, { radial: 4, sub: 3 });
    else box(I, BR, 0, 0, 0.006, 0.012, 0.018, 0.003);
  }
  // the woman singer standing in the middle: high chignon, green bodice, pale skirt with blue flowers, one hand raised
  const sh = 0.15;
  man(C, 0, PY, 0.01, { h: sh, top: GZ.green, dress: 'ankle', head: 'highbun', hc: '#1c1714', skin: '#e3c4a6', hands: [[-0.08, 0.66, 0.12], [0.1, 0.84, 0.14]] });
  // her high-waisted Tang skirt, tied under the bust
  lathe(C, [[0, sh * 0.015], [sh * 0.18, sh * 0.015], [sh * 0.13, sh * 0.4], [sh * 0.1, sh * 0.68], [0, sh * 0.68]], CR, 0, PY, 0.01 + sh * 0.01, 10);
  glazeAll(C);
  for (let i = 0; i < 7; i++) { const a = i * 1.9, yy = 0.015 + (i % 4) * 0.022; dot(C, '#46628a', Math.cos(a) * (0.026 - yy * 0.1), PY + yy, 0.01 + Math.sin(a) * (0.026 - yy * 0.1), 0.0035, 5); }
  // ---- standing horse, four-square on its slab, amber with a clipped mane in three tufts (三花马), green saddle-cloth ----
  const Hs = grp(gp, 0.23, Y, 0.08, -0.7, 1);
  pbox(Hs, '#6f7f4f', 0, 0, 0, 0.1, 0.014, 0.2, (x, _y, z) => shade('#6f7f4f', 0.9 + fbm(x * 30, 1, z * 30, 2) * 0.2), 0.01);
  const HG = grp(Hs, 0, 0.014, 0, 0, 0.5);
  horse(HG, '#b67a35', '#a86e30', { stride: 0, cloth: GZ.green, saddle: GZ.cream });
  for (let i = 0; i < 3; i++) ell8(HG, GZ.cream, 0, 0.56 + i * 0.035, 0.15 + i * 0.045, 0.012, 0.022, 0.016);
  glazeAll(HG, hex => { const k = NEAR(hex); if (k) return glazeP(k); const c = new THREE.Color(hex); return c.r + c.g + c.b > 0.25 ? glazeP('amber') : null; });
  // a small bowl and a label plaque
  const W = grp(gp, 0, Y, 0);
  lathe(W, [[0, 0], [0.025, 0], [0.03, 0.006], [0.05, 0.03], [0.046, 0.031], [0, 0.01]], GZ.green, -0.3, 0, 0.2, 18);
  lathe(W, [[0, 0], [0.024, 0], [0.04, 0.03], [0.046, 0.06], [0.036, 0.09], [0.022, 0.1], [0.024, 0.11], [0, 0.11]], GZ.amber, 0.04, 0, 0.25, 18);
  lathe(W, [[0, 0], [0.03, 0], [0.026, 0.01], [0.008, 0.02], [0.01, 0.03], [0, 0.032]], GZ.green, 0.04, 0.11, 0.25, 14);
  glazeAll(W);
  box(gp, '#d9c79a', 0, BY, 0.34, 0.12, 0.024, 0.006, -0.0, -0.4);
};
// =========================================================================================================
// 韩熙载夜宴图 — The Night Revels of Han Xizai: candlelit hall, couch, pipa, the Green Waist dance and a drum
// =========================================================================================================
/** Silk landscape painting (mountains, mist, water) for screens; u/v are 0…1 across the panel. */
const scape = (u: number, v: number): string => {
  const far = 0.62 + Math.sin(u * 9 + 1) * 0.08 + Math.sin(u * 23) * 0.03;
  const near = 0.42 + Math.sin(u * 6 + 3) * 0.12 + Math.sin(u * 17 + 1) * 0.04;
  if (v < 0.18) return mix('#b9c9bd', '#e8dcc0', 0.4 + Math.sin(u * 60) * 0.1);
  if (v < near) return shade(mix('#3e6b56', '#6a8a5e', v), 0.85 + hash3(Math.floor(u * 40), Math.floor(v * 40), 2) * 0.25);
  if (v < far) return mix('#7d9aa0', '#e3d7bb', (v - near) / (far - near) * 0.6);
  return '#e8dcc0';
};
/** Standing screen (屏风) with a painted landscape on its front face, black frame and feet. */
function screen(p: THREE.Object3D, x: number, z: number, w: number, h: number, ry: number, y = Y0): void {
  const S = grp(p, x, y, z, ry);
  for (const s of [-1, 1]) box(S, '#1c1512', s * (w / 2 - 0.01), 0, 0, 0.012, 0.012, 0.05);
  pbox(S, '#1c1512', 0, 0.012, 0, w, h, 0.008, (px, py, _pz, _nx, _ny, nz) => {
    const u = (px + w / 2) / w, v = (py - 0.012) / h;
    if (Math.abs(nz) < 0.5 || u < 0.03 || u > 0.97 || v < 0.04 || v > 0.96) return '#1c1512';
    return scape(nz > 0 ? u : 1 - u, (v - 0.04) / 0.92);
  }, 0.006);
}
function chair(p: THREE.Object3D, x: number, z: number, ry: number, h: number, c = '#3a1f16'): void {
  const C = grp(p, x, Y0, z, ry);
  const sy = h * 0.27;
  box(C, c, 0, sy - 0.004, 0, h * 0.26, 0.005, h * 0.24);
  for (const a of [-1, 1]) for (const b of [-1, 1]) box(C, shade(c, 0.85), a * h * 0.11, 0, b * h * 0.1, 0.005, sy - 0.004, 0.005);
  for (const a of [-1, 1]) box(C, c, a * h * 0.11, sy, -h * 0.1, 0.005, h * 0.3, 0.005);
  box(C, c, 0, sy + h * 0.27, -h * 0.1, h * 0.28, 0.006, 0.006);
}
/** Tall candle stand: tripod foot, column, drip saucer, candle and flickering flame. */
function candle(p: THREE.Object3D, x: number, z: number, H: number, y = Y0): void {
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; rod(p, [x, y + 0.012, z], [x + Math.cos(a) * 0.018, y, z + Math.sin(a) * 0.018], 0.0025, '#2a1d14', 3); }
  rod(p, [x, y + 0.01, z], [x, y + H, z], 0.0025, '#2a1d14', 5);
  lathe(p, [[0, 0], [0.014, 0.002], [0.012, 0.005], [0, 0.004]], '#8a6a3a', x, y + H, z, 10);
  cyl(p, '#f1ead8', x, y + H + 0.004, z, 0.004, 0.022, 6);
  flame(p, x, y + H + 0.026, z, 0.005);
}
// Ref: 顾闳中《韩熙载夜宴图》(Southern Tang, 10th c.; Song copy, Palace Museum): Han Xizai in a tall black hat on a
// 榻 couch, 状元 郎粲 in red, 李姬 on pipa, 王屋山 dancing the 六幺 in pale blue with long sleeves, tall candle stands,
// landscape screens, early high chairs and low tables of fruit, ewer-and-warming-bowl.
// Ref: Commons "The Night Revels of Han Xizai" (Gu Hongzhong, Song copy) — screens, couch, candle stands, pipa and dancer.
const lf_yeyan: Builder = (gp) => {
  land(gp, SITE.court, (x, _y, z) => {
    const k = Math.floor(z * 32 + 50), off = hash3(k, 1, 1) * 0.2;
    return shade('#a8946f', 0.93 + hash3(k, Math.floor((x + off) * 6), 3) * 0.1 + fbm(x * 40, 1, z * 4, 2) * 0.06);
  });
  const h = 0.15;
  // the large landscape screen across the back and a second one closing the left
  screen(gp, 0.02, -0.36, 0.42, 0.24, 0);
  screen(gp, -0.37, -0.12, 0.2, 0.2, Math.PI / 2 - 0.25);
  // Han Xizai on his couch (榻) with a red-robed guest; quilt piled behind
  const cx = -0.17, cz = -0.22, ch = 0.045;
  pbox(gp, '#1e1410', cx, Y0, cz, 0.22, ch, 0.13, (_x, y) => (y < Y0 + 0.012 ? '#2a1d14' : '#1e1410'), 0.01, 0, 0.35);
  pbox(gp, '#1e1410', cx, Y0 + ch, cz - 0.06, 0.22, 0.05, 0.008, (px, py) => scape((px - cx + 0.11) / 0.22, (py - Y0 - ch) / 0.05), 0.006);
  for (const s of [-1, 1]) box(gp, '#1e1410', cx + s * 0.106, Y0 + ch, cz, 0.008, 0.035, 0.12);
  ell8(gp, '#7e3a30', cx + 0.07, Y0 + ch + 0.02, cz - 0.03, 0.04, 0.022, 0.03);
  ell8(gp, '#a08a5a', cx + 0.07, Y0 + ch + 0.035, cz - 0.03, 0.03, 0.01, 0.022);
  man(gp, cx - 0.04, Y0 + ch, cz + 0.01, { h, ...CROSS, top: '#4a4038', head: 'gaomao', hc: '#141210', beard: '#2a211c', longBeard: true, lap: true, sleeves: true, ry: 0.35, hands: [[-0.1, 0.25, 0.22], [0.1, 0.25, 0.22]] });
  man(gp, cx + 0.04, Y0 + ch, cz + 0.02, { h: h * 0.95, ...CROSS, top: '#94392c', head: 'futou', lap: true, sleeves: true, ry: 0.5, hands: [[-0.08, 0.27, 0.22], [0.08, 0.27, 0.22]] });
  // the banquet tables with plates of fruit, an ewer warming in its bowl and wine cups
  const dishes = (T: THREE.Object3D, hh: number) => {
    for (const [dx, dz, c] of [[-0.03, -0.01, '#a4523a'], [0, 0.012, '#bc9a52'], [0.03, -0.008, '#7a8650'], [-0.005, -0.018, '#8e4434']] as const) {
      lathe(T, [[0, 0], [0.011, 0], [0.013, 0.004], [0, 0.003]], '#e8e2d2', dx, hh, dz, 10);
      for (let k = 0; k < 4; k++) dot(T, c, dx + (k % 2) * 0.006 - 0.003, hh + 0.005 + (k > 1 ? 0.003 : 0), dz + (k > 1 ? 0 : 0.004) - 0.002, 0.0035, 5);
    }
    lathe(T, [[0, 0], [0.012, 0], [0.016, 0.012], [0, 0.012]], '#cfd8c8', 0.045, hh, 0.01, 10);
    lathe(T, [[0, 0], [0.006, 0], [0.01, 0.01], [0.006, 0.02], [0.003, 0.028], [0, 0.028]], '#d6dccb', 0.045, hh + 0.004, 0.01, 10);
    for (const dx of [-0.045, 0.02]) cup(T, dx, hh, 0.02, 0.006, '#d6dccb');
  };
  const t1 = table(gp, -0.09, Y0, -0.03, 0.13, 0.06, 0.06, '#2a1a12', 0.1); dishes(t1, 0.06);
  const t2 = table(gp, 0.17, Y0, -0.18, 0.13, 0.06, 0.06, '#2a1a12', -0.3); dishes(t2, 0.06);
  // guests on chairs; a monk with hands clasped
  const guest = (x: number, z: number, ry: number, o: Partial<PO>) => { chair(gp, x, z, ry, h); return man(gp, x, Y0, z, { h, ry, pose: 'sit', top: '#5c4d3c', head: 'futou', sleeves: true, ...o } as PO); };
  guest(-0.12, -0.11, 0.2, { top: '#3d4a6a', beard: '#2a211c', hands: [[-0.08, 0.36, 0.2], [0.09, 0.36, 0.2]] });
  guest(0.04, -0.07, -0.6, { top: '#6a5a40', hands: [[-0.02, 0.6, 0.24], [0.02, 0.6, 0.24]] });
  guest(0.26, -0.1, -1.2, { head: 'none', hair: null, top: '#8a6a3a', hands: [[-0.012, 0.56, 0.18], [0.012, 0.56, 0.18]] });
  guest(0.12, -0.27, 0.2, { top: '#2f4a3a', beard: '#2a211c' });
  // 李姬 plays the pipa
  const px = 0.2, pz = 0.04, pr = -0.9;
  cyl(gp, '#3a1f16', px, Y0, pz, 0.02, h * 0.27, 10);
  man(gp, px, Y0, pz, { h, ry: pr, pose: 'sit', top: '#c4b49a', bottom: '#7a3c34', head: 'highbun', hands: [[-0.1, 0.5, 0.18], [0.05, 0.36, 0.2]] });
  const PP = grp(gp, px, Y0, pz, pr, h);
  const pb = ell8(PP, '#a0602a', 0.0, 0.37, 0.2, 0.07, 0.1, 0.022, 0, 0, 0.7);
  pb.material = mat('#a0602a', { rough: 0.35, flat: false });
  rod(PP, [-0.04, 0.42, 0.2], [-0.15, 0.58, 0.2], 0.014, '#5a3018', 5);
  box(PP, '#2a1a10', -0.16, 0.6, 0.2, 0.03, 0.05, 0.02, 0, 0, 0.6);
  // 绿腰 the Green Waist dance: 王屋山 in pale blue, back half-turned, long sleeves flicked
  const dz = 0.17, dx = -0.06;
  const dn = man(gp, dx, Y0, dz, { h: h * 0.92, ry: -2.6, top: '#90a8b6', bottom: '#90a8b6', dress: 'ankle', head: 'highbun', hands: [[-0.05, 0.55, -0.14], [0.2, 0.86, -0.04]], lean: -0.08 });
  // the long sleeves (长袖) hanging and swinging from both wrists
  for (const [hd, k] of [[dn.handL, -1], [dn.handR, 1]] as const) tube(gp, [hd, [hd[0] + k * 0.006, hd[1] - 0.022, hd[2] + 0.004], [hd[0] + k * 0.014, hd[1] - 0.045, hd[2]]], 0.005, 0.008, '#a6b8c2', { radial: 6, sub: 3 });
  ell8(gp, '#8a6a48', dx, Y0 + h * 0.6, dz, 0.022, 0.006, 0.02);
  // the red drum on its stand, beaten by a guest; a clapper keeps time
  const D = grp(gp, -0.2, Y0, 0.1, 0.6);
  for (const a of [0, 2.1, 4.2]) rod(D, [0, 0.05, 0], [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03], 0.003, '#2a1a10', 4);
  const drum = lathe(D, [[0, -0.025], [0.022, -0.025], [0.028, 0], [0.022, 0.025], [0, 0.025]], '#8a3028', 0, 0.075, 0, 14);
  drum.rotation.x = 1.1;
  for (const s of [-1, 1]) add(D, CYL(14), mat('#e9d7aa'), 0, 0.075 + Math.cos(1.1) * s * 0.025, -Math.sin(1.1) * s * 0.025 * -1, 0.044, 0.002, 0.044, 0, 1.1);
  const dm = man(gp, -0.25, Y0, 0.17, { h, ry: 2.6, top: '#7a5a3e', sleeves: true, head: 'futou', hands: [[-0.04, 0.62, 0.22], [0.12, 0.82, 0.12]], pose: 'stand' });
  rod(gp, dm.handR, [dm.handR[0] + 0.01, dm.handR[1] + 0.03, dm.handR[2] + 0.01], 0.0018, '#3a2418', 3);
  rod(gp, dm.handL, [dm.handL[0] + 0.02, dm.handL[1] - 0.01, dm.handL[2] - 0.02], 0.0018, '#3a2418', 3);
  const cl = man(gp, 0.06, Y0, 0.14, { h: h * 0.96, ry: -0.6, top: '#3d4a6a', head: 'futou', pose: 'pray', beard: '#2a211c' });
  box(gp, '#6a4020', cl.handL[0], cl.handL[1] + 0.006, cl.handL[2], 0.004, 0.026, 0.012, -0.6);
  // the bed with drawn curtains at the back right and a folding screen
  const bx = 0.3, bz = -0.29;
  box(gp, '#1e1410', bx, Y0, bz, 0.16, 0.04, 0.1, 0.4);
  ell8(gp, '#a3302a', bx, Y0 + 0.05, bz, 0.06, 0.016, 0.035, 0.4);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const ox = a * 0.075, oz = b * 0.045; rod(gp, [bx + ox * Math.cos(0.4) + oz * Math.sin(0.4), Y0 + 0.04, bz - ox * Math.sin(0.4) + oz * Math.cos(0.4)], [bx + ox * Math.cos(0.4) + oz * Math.sin(0.4), Y0 + 0.2, bz - ox * Math.sin(0.4) + oz * Math.cos(0.4)], 0.003, '#1e1410', 4); }
  const cur = box(gp, '#d4c3a2', bx, Y0 + 0.2, bz, 0.165, 0.008, 0.105, 0.4);
  cur.material = mat('#d4c3a2', { rough: 0.9 });
  for (let i = 0; i < 4; i++) { const t = (i - 1.5) * 0.04; const P = grp(gp, bx + t * Math.cos(0.4) + 0.052 * Math.sin(0.4), Y0 + 0.04, bz - t * Math.sin(0.4) + 0.052 * Math.cos(0.4), 0.4); pbox(P, '#d4c3a2', 0, 0, 0, 0.036, 0.16, 0.003, (_x, py) => shade('#d4c3a2', 0.9 + Math.sin(py * 200) * 0.06), 0.006); P.rotation.z = (i % 2 ? 1 : -1) * 0.04; }
  for (let i = 0; i < 4; i++) screen(gp, 0.38 - (i % 2) * 0.012, -0.03 + i * 0.07, 0.07, 0.17, -Math.PI / 2 + (i % 2 ? 0.5 : -0.5));
  for (const [x, z, H] of [[-0.3, -0.24, 0.15], [0.02, -0.28, 0.17], [0.3, 0.2, 0.15], [-0.32, 0.26, 0.14], [0.07, 0.3, 0.12]] as const) candle(gp, x, z, H);
  fuse(gp);
};

// =========================================================================================================
// 瓦舍勾栏 — a Song entertainment quarter: a railed theatre enclosure with stage and crowd, a teahouse with flags
// =========================================================================================================
// Ref: 孟元老《东京梦华录》(1147) on Kaifeng's 瓦舍勾栏 (board-fenced theatres, 招子 playbills, storytellers, acrobats);
// teahouse 欢门 and hanging flags after 张择端《清明上河图》; muted mineral/vegetable-dyed cloth.
// Ref: Commons "Along the River During the Qingming Festival (detail of original)" — fenced wasi stage, crowd, teahouse flags.
const lf_washe: Builder = (gp) => {
  land(gp, '#b9a17a', (x, _y, z) => (Math.abs(x - 0.26) < 0.2 && z > -0.05 ? bricks('#a8a296', 0.03, 0.015, 0.1)(x, 0, z, 0, 1, 0) : shade('#b9a17a', 0.9 + fbm(x * 18, 0, z * 18, 3) * 0.2)), undefined, '#6b5a40');
  const WOOD = '#6a4a30', RED = '#86382a';
  // the 勾栏: a board fence enclosing the theatre, with a gate hung with playbills (招子)
  const X0 = -0.4, X1 = 0.12, Z0 = -0.36, Z1 = 0.13, FH = 0.075;
  const fence = (ax: number, az: number, bx: number, bz: number) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 0.012), ry = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) { const t = i / n; box(gp, shade(WOOD, 0.85 + hash3(i, ax * 10, az * 10) * 0.25), ax + (bx - ax) * t, Y0, az + (bz - az) * t, 0.01, FH - 0.006 * (i % 2), 0.004, ry + Math.PI / 2); }
    box(gp, RED, (ax + bx) / 2, Y0 + FH * 0.7, (az + bz) / 2, 0.006, 0.006, L, ry);
    box(gp, RED, (ax + bx) / 2, Y0 + FH, (az + bz) / 2, 0.008, 0.006, L, ry);
  };
  const clip = (x: number, z: number): [number, number] => { const r = Math.hypot(x, z); return r > 0.44 ? [x * 0.44 / r, z * 0.44 / r] : [x, z]; };
  const c00 = clip(X0, Z0), c10 = clip(X1, Z0), c01 = clip(X0, Z1), c11 = clip(X1, Z1);
  fence(...c00, ...c10); fence(...c10, ...c11); fence(...c00, ...c01);
  const gx0 = -0.2, gx1 = -0.11;
  fence(...c01, gx0, Z1); fence(gx1, Z1, ...c11);
  for (const gx of [gx0, gx1]) { cyl(gp, RED, gx, Y0, Z1, 0.006, 0.15, 8); }
  box(gp, RED, (gx0 + gx1) / 2, Y0 + 0.145, Z1, gx1 - gx0 + 0.03, 0.012, 0.012);
  box(gp, '#1c1a18', (gx0 + gx1) / 2, Y0 + 0.125, Z1 + 0.006, 0.06, 0.02, 0.003);
  for (const [px, c] of [[-0.25, '#e4dac0'], [-0.06, '#c8b07a'], [0.03, '#e4dac0']] as const) {
    rod(gp, [px, Y0, Z1 + 0.012], [px, Y0 + 0.14, Z1 + 0.012], 0.0025, '#3a2418', 4);
    pbox(gp, c, px, Y0 + 0.04, Z1 + 0.016, 0.03, 0.09, 0.003, (x, y) => (Math.abs(x - px) < 0.006 && Math.floor(y * 220) % 3 === 0 ? '#2a1a12' : c), 0.004);
  }
  // the stage (戏台) at the back: a raised platform, painted posts, curtained backdrop with two doors, tile roof
  const sz = -0.24, sx = -0.14, SW = 0.26, SD = 0.13, SH = 0.045;
  pbox(gp, '#8a6a48', sx, Y0, sz, SW, SH, SD, (x, y) => (y > Y0 + SH - 0.004 ? '#8a6a48' : Math.floor((x + 1) * 60) % 2 ? '#7a5a3c' : '#6a4a30'), 0.006);
  for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(gp, RED, sx + a * (SW / 2 - 0.01), Y0 + SH, sz + b * (SD / 2 - 0.01), 0.006, 0.13, 8);
  pbox(gp, '#843a2e', sx, Y0 + SH, sz - SD / 2 + 0.008, SW - 0.02, 0.12, 0.006, (x, y, _z, _nx, _ny, nz) => {
    if (nz < 0.5) return '#7a2a20';
    const u = x - sx;
    if (Math.abs(Math.abs(u) - 0.08) < 0.025 && y < Y0 + SH + 0.085) return '#1c1410';
    return Math.floor(u * 120 + 50) % 2 ? '#8a3a2e' : '#7a3228';
  }, 0.005);
  box(gp, '#5a3a26', sx, Y0 + SH + 0.13, sz, SW + 0.01, 0.012, SD + 0.01);
  proof(gp, sx, Y0 + SH + 0.142, sz, { n: 4, R0: 0.1, R1: 0.03, h: 0.06, lift: 0.5, tile: '#4f535a', sx: 1.6 });
  // on stage: a storyteller with fan and gavel at his table, a drummer, and an acrobat in a handstand
  const st = table(gp, sx - 0.07, Y0 + SH, sz + 0.01, 0.05, 0.03, 0.04, '#3a1f16');
  box(st, '#a08a5c', 0, 0.04, 0, 0.05, 0.006, 0.03);
  const sr = man(gp, sx - 0.07, Y0 + SH, sz - 0.02, { h: 0.14, top: '#3d4a6a', head: 'jin', beard: '#2a211c', pose: 'point', hands: [[-0.1, 0.5, 0.2], [0.16, 0.8, 0.3]] });
  ell8(gp, '#efe6cc', sr.handR[0], sr.handR[1] + 0.01, sr.handR[2], 0.004, 0.016, 0.014);
  box(gp, '#3a1f16', sr.handL[0], sr.handL[1] - 0.004, sr.handL[2], 0.012, 0.006, 0.006);
  const AC = grp(gp, sx + 0.04, Y0 + SH + 0.13, sz + 0.02, 0.3);
  AC.rotation.z = Math.PI;
  man(AC, 0, 0, 0, { h: 0.13, top: '#94483a', bottom: '#a89060', head: 'none', pose: 'stand', feet: [[-0.1, 0.03, -0.08], [0.1, 0.06, 0.1]], hands: [[-0.1, 0.995, 0.02], [0.1, 0.995, -0.02]] });
  man(gp, sx + 0.1, Y0 + SH, sz - 0.03, { h: 0.13, ry: -0.5, top: '#5a7a4a', head: 'futou', pose: 'sit', hipY: 0.2, hands: [[-0.08, 0.32, 0.18], [0.06, 0.4, 0.2]] });
  cyl(gp, '#863228', sx + 0.1 - 0.012, Y0 + SH, sz - 0.008, 0.012, 0.022, 10);
  // benches along the sides and a standing crowd
  for (const [bx, bz, ry] of [[-0.33, -0.12, Math.PI / 2], [-0.33, 0.0, Math.PI / 2], [0.07, -0.12, -Math.PI / 2], [0.07, 0.0, -Math.PI / 2]] as const) {
    box(gp, WOOD, bx, Y0 + 0.022, bz, 0.08, 0.005, 0.016, ry + Math.PI / 2);
    for (const s of [-1, 1]) box(gp, WOOD, bx, Y0, bz + s * 0.032, 0.012, 0.022, 0.005, ry + Math.PI / 2);
    for (const s of [-1, 1]) man(gp, bx, Y0, bz + s * 0.02, { h: 0.13, ry: ry + (bz < -0.05 ? 0.4 : 0.8) * (bx < 0 ? 1 : -1), pose: 'sit', top: ['#6a7a8c', '#8a6a4a', '#5a6a4a', '#9a8a6a'][Math.floor(hash3(bx, bz, s) * 4)], head: hash3(bz, bx, s) > 0.5 ? 'futou' : 'jin', detail: 'min', hipY: 0.18 });
  }
  const tops = ['#6a7a8c', '#8a6a4a', '#5a6a4a', '#9a8a6a', '#7a5a5a', '#4a5a6a', '#a89a7a'];
  for (let i = 0; i < 18; i++) {
    const x = -0.27 + (i % 6) * 0.06 + (hash3(i, 1, 4) - 0.5) * 0.03, z = -0.1 + Math.floor(i / 6) * 0.065 + (hash3(i, 2, 4) - 0.5) * 0.02;
    const kid = hash3(i, 3, 4) > 0.85;
    man(gp, x, Y0, z, { h: kid ? 0.09 : 0.14, ry: Math.PI + Math.atan2(x - sx, z - sz) + (hash3(i, 5, 4) - 0.5) * 0.4, top: tops[i % tops.length], bottom: '#4a4038', head: kid ? 'bun' : (['futou', 'jin', 'scarf'] as const)[i % 3], hc: i % 3 === 2 ? '#6a5a48' : '#1c1917', detail: 'min', pose: i % 5 === 0 ? 'cheer' : i % 4 === 0 ? 'point' : 'relax' });
  }
  // the teahouse (茶坊): open-fronted hall, customers, a stove with a steaming kettle, a 欢门 gateway and flags
  const tx = 0.28, tz = 0.02;
  pbox(gp, '#a8a296', tx, Y0, tz, 0.2, 0.012, 0.15, bricks('#a8a296', 0.02, 0.01), 0.008);
  pbox(gp, '#c9b89a', tx, Y0 + 0.012, tz - 0.07, 0.2, 0.1, 0.01, (x, y) => (Math.abs(((x - tx) * 25 + 50) % 1) < 0.1 || y > Y0 + 0.1 ? '#5a3a24' : '#cdbd9f'), 0.008);
  for (const s of [-1, 1]) pbox(gp, '#c9b89a', tx + s * 0.095, Y0 + 0.012, tz, 0.01, 0.1, 0.15, () => '#c9b89a', 0.02);
  for (const s of [-1, 0, 1]) cyl(gp, '#5a3a24', tx + s * 0.095, Y0 + 0.012, tz + 0.07, 0.005, 0.1, 6);
  tileRoof(gp, tx, Y0 + 0.11, tz, 0.24, 0.2, 0.05, '#55585e');
  for (const [cx2, cz2] of [[tx - 0.05, tz + 0.01], [tx + 0.045, tz + 0.02]]) {
    const T = table(gp, cx2, Y0 + 0.012, cz2, 0.05, 0.04, 0.04, '#5a3a24');
    cup(T, -0.01, 0.04, 0, 0.006); cup(T, 0.012, 0.04, 0.006, 0.006);
    for (const s of [-1, 1]) man(gp, cx2 + s * 0.04, Y0 + 0.012, cz2, { h: 0.13, ry: -s * Math.PI / 2, pose: 'sit', top: tops[(s + 3) % 7], head: 'futou', detail: 'lo', hands: [[-0.08, 0.4, 0.22], [0.08, 0.42, 0.24]] });
  }
  cyl(gp, '#6a5a50', tx + 0.07, Y0 + 0.012, tz - 0.045, 0.016, 0.04, 8);
  const kt = lathe(gp, [[0, 0], [0.012, 0.002], [0.014, 0.012], [0.008, 0.02], [0, 0.022]], '#3a3a38', tx + 0.07, Y0 + 0.052, tz - 0.045, 10);
  kt.material = mat('#3a3a38', { rough: 0.4, metal: 0.4, flat: false });
  smoke(gp, tx + 0.07, Y0 + 0.08, tz - 0.045, 0.02, '#f2f0ea', 4);
  // 欢门: the festooned gateway of lashed poles with coloured streamers
  const hz = tz + 0.12;
  for (const s of [-1, 1]) rod(gp, [tx + s * 0.1, Y0, hz], [tx + s * 0.1, Y0 + 0.2, hz], 0.004, '#6a4a30', 5);
  for (const yy of [0.15, 0.19]) rod(gp, [tx - 0.11, Y0 + yy, hz], [tx + 0.11, Y0 + yy, hz], 0.003, '#6a4a30', 4);
  for (const s of [-1, 1]) rod(gp, [tx + s * 0.1, Y0 + 0.19, hz], [tx, Y0 + 0.24, hz], 0.003, '#6a4a30', 4);
  for (let i = 0; i < 7; i++) { const x = tx - 0.09 + i * 0.03; box(gp, ['#8e4634', '#b09a62', '#4e6656', '#56667e'][i % 4], x, Y0 + 0.11, hz + 0.003, 0.014, 0.04, 0.002); }
  for (const s of [-1, 1]) lantern(gp, tx + s * 0.06, Y0 + 0.135, hz + 0.004, 0.01);
  // the 茶 flag hanging from a tall pole
  const fp = tx + 0.15;
  rod(gp, [fp, Y0, tz + 0.08], [fp, Y0 + 0.33, tz + 0.08], 0.004, '#5a3a24', 5);
  rod(gp, [fp, Y0 + 0.32, tz + 0.08], [fp - 0.07, Y0 + 0.32, tz + 0.08], 0.0025, '#5a3a24', 4);
  const FL = anim(gp, 'sway', fp - 0.035, Y0 + 0.318, tz + 0.08, { amp: 0.08 });
  pbox(FL, '#e4dac2', 0, -0.12, 0, 0.05, 0.12, 0.003, (x, y) => {
    const u = x / 0.05 + 0.5, v = (y + 0.12) / 0.12;
    if (v < 0.08) return '#34506a';
    const glyph = (Math.abs(v - 0.8) < 0.035 && Math.abs(u - 0.5) < 0.38) || (Math.abs(u - 0.5) < 0.05 && v > 0.15 && v < 0.75) || (Math.abs(v - 0.55) < 0.035 && Math.abs(u - 0.5) < 0.3) || (Math.abs((u - 0.5) + (v - 0.7) * 0.6) < 0.05 && v > 0.55 && v < 0.75);
    return glyph ? '#1c1917' : '#e4dac2';
  }, 0.004);
  // a hawker with his carrying pole outside
  const hk = man(gp, 0.2, Y0, 0.3, { h: 0.14, ry: -1.9, top: '#8a7a5a', bottom: '#5a4a38', head: 'scarf', hc: '#5a4a3a', pose: 'walk', phase: 0.3, hands: [[-0.1, 0.5, 0.05], [0.1, 0.84, 0.0]] });
  const sh = hk.head, fx = Math.sin(-1.9), fz = Math.cos(-1.9), py = sh[1] - 0.028;
  rod(gp, [sh[0] - fx * 0.085, py, sh[2] - fz * 0.085], [sh[0] + fx * 0.085, py, sh[2] + fz * 0.085], 0.002, '#6a4a30', 4);
  for (const s of [-1, 1]) {
    const ex = sh[0] + s * fx * 0.08, ez = sh[2] + s * fz * 0.08;
    rod(gp, [ex, py, ez], [ex, Y0 + 0.035, ez], 0.0008, '#3a2418', 3);
    lathe(gp, [[0, 0], [0.016, 0], [0.02, 0.025], [0, 0.025]], '#a8834e', ex, Y0 + 0.008, ez, 10);
    dot(gp, s > 0 ? '#b08c4e' : '#8e4a36', ex, Y0 + 0.033, ez, 0.012, 6);
  }
  fuse(gp);
};
// =========================================================================================================
// 龙窑 / 青花 — kilns and porcelain: a Longquan dragon kiln up a hillside, or a Jingdezhen egg kiln and blue-and-white
// =========================================================================================================
/** Glossy porcelain lathe: smooth, low roughness, optional vertex-painted decoration (paint gets local coords). */
function porcelain(p: THREE.Object3D, pts: [number, number][], c: string, x: number, y: number, z: number, paint?: Paint, seg = 28): THREE.Mesh {
  const geo = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  return add(p, paint ? paintFaces(geo, c, paint) : geo, paint ? mat('#ffffff', { vc: true, rough: 0.12, flat: false }) : mat(c, { rough: 0.14, flat: false }), x, y, z, 1, 1, 1);
}
const VASE: [number, number][] = [[0, 0], [0.3, 0], [0.32, 0.03], [0.42, 0.2], [0.58, 0.5], [0.66, 0.72], [0.6, 0.84], [0.36, 0.93], [0.2, 0.96], [0.2, 1.02], [0.24, 1.04], [0.16, 1.05], [0, 1.0]];
const MEIPING: [number, number][] = [[0, 0], [0.34, 0], [0.36, 0.03], [0.32, 0.12], [0.36, 0.32], [0.5, 0.6], [0.6, 0.76], [0.56, 0.85], [0.36, 0.93], [0.18, 0.96], [0.17, 1.0], [0.21, 1.02], [0.14, 1.03], [0, 0.99]];
const BOWL: [number, number][] = [[0, 0], [0.32, 0], [0.32, 0.08], [0.45, 0.12], [0.85, 0.42], [1, 0.62], [0.95, 0.63], [0.8, 0.45], [0, 0.18]];
const sc = (pr: [number, number][], s: number, h = s): [number, number][] => pr.map(([r, y]) => [r * s, y * h]);
/** Subdivide a lathe profile so painted decoration has enough faces. */
const dense = (pr: [number, number][], n: number): [number, number][] => pr.flatMap(([r, y], i) => (i === pr.length - 1 ? [[r, y]] : Array.from({ length: n }, (_, k) => [r + (pr[i + 1][0] - r) * (k / n), y + (pr[i + 1][1] - y) * (k / n)] as [number, number])));
const CELADON = '#9db89c', CEL2 = '#aec3ac';
/** Dragon-kiln vault paint: brick courses along the slope, soot towards the flue end. */
const vaultP = (t: (x: number, z: number) => number): Paint => (x, y, z) => {
  const u = t(x, z) * 90, v = y * 140, fu = u - Math.floor(u), fv = v - Math.floor(v);
  const soot = Math.max(0, t(x, z) - 0.6) * 1.4;
  if (fu < 0.12 || fv < 0.15) return shade('#6e4a36', 1 - soot * 0.4);
  return shade(mix('#a8603e', '#3a2a24', soot), 0.88 + hash3(Math.floor(u), Math.floor(v), 2) * 0.2);
};
// Ref: Southern Song Longquan dragon kilns (大窑/金村龙窑 excavations): a sloping brick vault 30–80 m long under a
// timber shed (窑棚), side stoke holes, saggars; 粉青/梅子青 glaze — a soft grey-green, not mint.
function celadonYard(gp: THREE.Group): void {
  const slope = (z: number) => Math.min(1, Math.max(0, (0.1 - z) / 0.5));
  const hf = (x: number, z: number) => 0.2 * slope(z) ** 1.3 + (fbm(x * 6, 3, z * 6) - 0.5) * 0.012 * slope(z);
  land(gp, '#7a8a55', (x, y, z) => (slope(z) + (fbm(x * 3, 1, z * 3, 2) - 0.5) * 0.08 < 0.05 ? shade('#a08c72', 0.9 + fbm(x * 20, 0, z * 20, 2) * 0.2) : grassP('#6c7d4e', 14)(x, y, z, 0, 1, 0)), hf, '#6b5a40');
  // the dragon kiln climbing the hill: a long brick vault with stoke holes, a firebox at the foot and a flue at the top
  const A: [number, number] = [-0.02, 0.12], B: [number, number] = [-0.2, -0.37];
  const at = (t: number): V3 => { const x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t; return [x, Y0 + hf(x, z), z]; };
  const tOf = (x: number, z: number) => { const dx = B[0] - A[0], dz = B[1] - A[1]; return ((x - A[0]) * dx + (z - A[1]) * dz) / (dx * dx + dz * dz); };
  const N = 10, st: { p: V3; w: number; h: number }[] = [];
  for (let i = 0; i <= N; i++) { const p = at(i / N); st.push({ p: [p[0], p[1] - 0.004, p[2]], w: 0.062, h: 0.06 }); }
  sweep(gp, st, '#a8603e', { radial: 24, sub: 8, squash: 0.05, paint: vaultP(tOf), caps: true });
  const dir = new THREE.Vector3(B[0] - A[0], 0, B[1] - A[1]).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 1; i < 10; i++) for (const s of [-1, 1]) {
    const p = at(i / 10 + 0.02), q: V3 = [p[0] + side.x * s * 0.05, p[1] + 0.034, p[2] + side.z * s * 0.05];
    dot(gp, '#2a1a12', q[0], q[1], q[2], 0.0085, 6);
    if ((i + (s > 0 ? 0 : 1)) % 3 === 0) add(gp, SPH(6), glow('#c8742e', '#8a3a10'), q[0] + side.x * s * 0.003, q[1], q[2] + side.z * s * 0.003, 0.009, 0.009, 0.009);
  }
  // the kiln shed (窑棚): stepped tile roofs on timber posts running up the vault's upper reach
  const ang = -Math.atan2(dir.z, dir.x);
  for (let i = 0; i < 5; i++) {
    const t = 0.32 + i * 0.145, c = at(t), y = c[1] + 0.105;
    tileRoof(gp, c[0], y, c[2], 0.115, 0.17, 0.035, '#5a5c5e', ang, false);
    for (const s of [-1, 1]) for (const dt of [-0.06, 0.06]) {
      const q = at(t + dt), px = q[0] + side.x * s * 0.075, pz = q[2] + side.z * s * 0.075;
      rod(gp, [px, Y0 + hf(px, pz) - 0.004, pz], [px, y + 0.004, pz], 0.0042, '#5e4630', 5);
    }
  }
  const f = at(-0.04);
  pbox(gp, '#9a5a3a', f[0], f[1] - 0.004, f[2], 0.1, 0.075, 0.06, bricks('#9a5a3a', 0.014, 0.007), 0.006, Math.atan2(dir.x, dir.z));
  add(gp, SPH(10), glow('#c8742e', '#8a3a10'), f[0] - dir.x * 0.03, f[1] + 0.022, f[2] - dir.z * 0.03, 0.03, 0.035, 0.012, Math.atan2(dir.x, dir.z));
  const e = at(1.02);
  pbox(gp, '#7a4a32', e[0], e[1] - 0.01, e[2], 0.07, 0.11, 0.05, bricks('#6a4030', 0.014, 0.007), 0.006, Math.atan2(dir.x, dir.z));
  smoke(gp, e[0], e[1] + 0.11, e[2], 0.03, '#d8d4cc', 6);
  smoke(gp, at(0.55)[0], at(0.55)[1] + 0.06, at(0.55)[2], 0.018, '#e2ded6', 4);
  // a stoker feeding pine billets at the foot; a woodpile
  man(gp, f[0] - dir.x * 0.08 + side.x * 0.07, Y0, f[2] - dir.z * 0.08 + side.z * 0.07, { h: 0.14, ry: Math.atan2(dir.x * 0.05 - side.x * 0.07, dir.z * 0.05 - side.z * 0.07), top: '#5a6a7a', bottom: '#3a3a3a', head: 'scarf', hc: '#4a3a2c', pose: 'carry', lean: 0.3 });
  for (let i = 0; i < 12; i++) { const r = cyl(gp, shade('#8a6a48', 0.85 + hash3(i, 1, 1) * 0.3), -0.2 + (i % 4) * 0.0, Y0 + 0.008 + Math.floor(i / 4) * 0.013, 0.05 + (i % 4) * 0.014, 0.007, 0.09, 6); r.rotation.z = Math.PI / 2; r.position.x = -0.2; }
  // the workshop: a potter throwing at the wheel, drying racks, saggars and a table of finished celadon
  const wx = 0.12, wz = 0.16;
  const WH = anim(gp, 'spin', wx, Y0 + 0.03, wz, { axis: 'y', speed: 4 });
  cyl(WH, '#5a3a24', 0, -0.006, 0, 0.045, 0.008, 18);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; box(WH, '#3a2418', Math.cos(a) * 0.03, -0.004, Math.sin(a) * 0.03, 0.004, 0.005, 0.004); }
  lathe(WH, [[0, 0], [0.018, 0], [0.024, 0.018], [0.02, 0.034], [0.012, 0.042], [0.014, 0.048], [0, 0.044]], '#b8a083', 0, 0.002, 0, 12);
  cyl(gp, '#3a2418', wx, Y0, wz, 0.006, 0.025, 6);
  box(gp, '#6a4a30', wx, Y0, wz - 0.08, 0.05, 0.03, 0.03);
  man(gp, wx, Y0 + 0.01, wz - 0.075, { h: 0.15, top: '#7a8a9a', bottom: '#4a4a48', head: 'jin', beard: '#2a211c', pose: 'sit', hipY: 0.15, lean: 0.4, hands: [[-0.05, 0.3, 0.42], [0.05, 0.3, 0.42]], feet: [[-0.1, 0.03, 0.26], [0.1, 0.03, 0.26]] });
  // drying rack of unfired greenware
  const R = grp(gp, 0.3, Y0, -0.02, -0.9);
  for (const a of [-1, 1]) for (const b of [-1, 1]) box(R, '#6a4a30', a * 0.07, 0, b * 0.025, 0.006, 0.13, 0.006);
  for (let k = 0; k < 3; k++) {
    box(R, '#8a6a48', 0, 0.025 + k * 0.045, 0, 0.15, 0.005, 0.06);
    for (let i = 0; i < 5; i++) {
      const px = -0.055 + i * 0.027, py = 0.03 + k * 0.045;
      if (k === 2) lathe(R, sc(BOWL, 0.012, 0.016), '#c9b79a', px, py, 0, 10);
      else lathe(R, sc(VASE, 0.014, 0.036), '#c9b79a', px, py, 0, 10);
    }
  }
  // saggar stacks (匣钵)
  for (const [sx, sz, n] of [[0.24, -0.16, 5], [0.31, -0.2, 4], [0.19, -0.24, 3], [0.06, -0.12, 4]] as const)
    for (let i = 0; i < n; i++) lathe(gp, [[0, 0], [0.026, 0], [0.026, 0.024], [0.022, 0.024], [0.022, 0.004], [0, 0.004]], shade('#8a7a6a', 0.9 + hash3(sx, i, 1) * 0.2), sx, Y0 + hf(sx, sz) + i * 0.024, sz, 12);
  man(gp, 0.12, Y0 + hf(0.12, -0.02), -0.02, { h: 0.15, ry: -2.4, top: '#8a7a5a', bottom: '#4a4a48', head: 'scarf', hc: '#5a4a3a', pose: 'carry', hands: [[-0.1, 0.62, 0.18], [0.1, 0.62, 0.18]] });
  // the display table of jade-green Longquan celadon: phoenix-eared vase, meiping, bowls, a lotus dish
  const T = table(gp, -0.2, Y0, 0.27, 0.2, 0.08, 0.05, '#4a2a1c', 0.25);
  porcelain(T, sc(VASE, 0.014, 0.042), CELADON, -0.065, 0.05, 0);
  for (const s of [-1, 1]) tube(T, [[s * 0.007, 0.082, 0], [s * 0.015, 0.085, 0], [s * 0.017, 0.075, 0]], 0.0018, 0.0014, CELADON, { radial: 5, sub: 2 });
  porcelain(T, sc(MEIPING, 0.017, 0.045), CEL2, -0.03, 0.05, 0.005);
  for (const [bx, bz, br] of [[0.0, -0.015, 0.013], [0.012, 0.018, 0.011], [0.03, -0.01, 0.012]] as const) porcelain(T, sc(BOWL, br, br * 1.15), (bx * 100) % 2 ? CEL2 : CELADON, bx, 0.05, bz);
  porcelain(T, sc([[0, 0], [0.4, 0], [0.5, 0.05], [1, 0.12], [0.95, 0.14], [0.45, 0.07], [0, 0.06]], 0.02, 0.035), CELADON, 0.06, 0.05, 0.005);
  for (const [x, z, s] of [[-0.31, 0.12, 0.018], [-0.35, 0.18, 0.015]] as const) porcelain(gp, sc(VASE, s, s * 3), CELADON, x, Y0, z);
  for (const [x, z] of [[0.3, -0.33], [0.36, -0.22], [0.1, -0.4]] as const) tree(gp, x, Y0 + hf(x, z), z, 0.1, '#3d5a40', true);
}
// Ref: Ming Jingdezhen — the egg-shaped (蛋形) kiln and its chimney, painters decorating blanks with cobalt (《天工开物·陶埏》),
// porters carrying boards of blanks; wares at true size (a meiping ≈ 40 cm, a large dish ≈ 45 cm across).
function qinghuaYard(gp: THREE.Group): void {
  land(gp, '#9a968e', (x, _y, z) => shade('#9a968e', 0.95 + fbm(x * 12, 4, z * 12, 2) * 0.1), undefined, '#66635d');
  const BLUE = '#1f3f8f', WHITE = '#f3f5f7';
  // the egg-shaped kiln (蛋形窑) and its tall chimney, in a kiln house
  const kx = -0.05, kz = -0.24;
  const eg = new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2);
  const kp: Paint = (x, y, z) => {
    const a = Math.atan2(z, x), u = a * 14, v = y * 9, fu = u - Math.floor(u + (Math.floor(v) % 2) * 0.5), fv = v - Math.floor(v);
    return fu < 0.1 || fv < 0.14 ? '#6a4632' : shade('#a26444', 0.88 + hash3(Math.floor(u), Math.floor(v), 4) * 0.2);
  };
  const egg = add(gp, paintFaces(eg, '#a26444', kp), mat('#ffffff', { vc: true }), kx, Y0, kz, 0.17, 0.15, 0.13);
  egg.scale.set(0.13, 0.15, 0.2);
  pbox(gp, '#7a4a32', kx, Y0, kz + 0.17, 0.08, 0.08, 0.04, bricks('#7a4a32', 0.014, 0.007), 0.006);
  add(gp, SPH(10), glow('#c8742e', '#8a3a10'), kx, Y0 + 0.03, kz + 0.191, 0.04, 0.05, 0.006);
  const ch = new THREE.LatheGeometry([new THREE.Vector2(0.05, 0), new THREE.Vector2(0.028, 0.3), new THREE.Vector2(0.031, 0.31), new THREE.Vector2(0, 0.31)], 10);
  add(gp, paintFaces(ch, '#8a5238', (x, y, z) => { const v = y * 90, u = Math.atan2(z, x) * 5; return v - Math.floor(v) < 0.15 || (u - Math.floor(u + (Math.floor(v) % 2) * 0.5)) < 0.1 ? '#5a3a2a' : shade('#8a5238', 0.9 + hash3(Math.floor(u), Math.floor(v), 1) * 0.2 - Math.max(0, y - 0.22) * 3); }), mat('#ffffff', { vc: true }), kx, Y0, kz - 0.15, 1, 1, 1);
  smoke(gp, kx, Y0 + 0.33, kz - 0.15, 0.03, '#cfcac2', 6);
  for (const s of [-1, 1]) for (const zz of [-0.02, 0.18]) cyl(gp, '#5a3a24', kx + s * 0.16, Y0, kz + zz, 0.006, 0.2, 6);
  tileRoof(gp, kx, Y0 + 0.2, kz + 0.08, 0.36, 0.3, 0.07, '#4f535a');
  // stacks of firewood and a carrier with a board of white blanks on his shoulder
  for (let i = 0; i < 15; i++) { const r = cyl(gp, shade('#8a6a48', 0.85 + hash3(i, 2, 1) * 0.3), 0.18 + (i % 5) * 0.0, Y0 + 0.008 + Math.floor(i / 5) * 0.014, -0.3 + (i % 5) * 0.015, 0.007, 0.1, 6); r.rotation.z = Math.PI / 2; }
  const cr = man(gp, 0.2, Y0, -0.12, { h: 0.15, ry: -2.2, top: '#4a5a7a', bottom: '#3a3a3a', head: 'scarf', hc: '#e8e2d2', pose: 'walk', phase: 0.25, hands: [[-0.1, 0.5, 0.05], [0.08, 0.95, 0.04]] });
  const BD = grp(gp, cr.head[0] + 0.01, cr.head[1] - 0.005, cr.head[2] - 0.01, -2.2 + Math.PI / 2);
  box(BD, '#8a6a48', 0, 0, 0, 0.2, 0.004, 0.022);
  for (let i = 0; i < 8; i++) lathe(BD, sc(BOWL, 0.01, 0.012), WHITE, -0.085 + i * 0.024, 0.002, 0, 10);
  // a finished meiping (梅瓶): cobalt lotus panels at the foot, a dragon among clouds, ruyi collar on the shoulder
  const H = 0.055;
  const mp: Paint = (x, y, z) => {
    const t = y / H, a = Math.atan2(z, x), u = ((a / TAU) % 1 + 1) % 1;
    if (t < 0.035 || t > 0.97) return WHITE;
    if (t < 0.17) { const k = (u * 10) % 1, w = 0.42 * (1 - (t - 0.035) / 0.15); return Math.abs(Math.abs(k - 0.5) - w) < 0.07 || t < 0.05 ? BLUE : Math.abs(k - 0.5) < w - 0.12 ? '#9fb6dc' : WHITE; }
    if (Math.abs(t - 0.185) < 0.012 || Math.abs(t - 0.72) < 0.012) return BLUE;
    if (t < 0.71) {
      const d = Math.abs(t - (0.44 + 0.12 * Math.sin(a * 2 + 0.6)));
      if (d < 0.028) return Math.sin(a * 60) > 0.2 ? BLUE : '#3a5aa8';
      if (d < 0.04 && Math.sin(a * 30) > 0.6) return BLUE;
      const cl = fbm(Math.cos(a) * 3, t * 7, Math.sin(a) * 3, 2);
      return cl > 0.66 ? BLUE : cl > 0.6 ? '#6f8cc8' : WHITE;
    }
    if (t < 0.9) { const k = (u * 4) % 1, edge = 0.9 - 0.15 * Math.cos((k - 0.5) * Math.PI * 1.6); return t < edge ? (t > edge - 0.025 ? BLUE : t > 0.735 && fbm(a * 4, t * 30, 1, 2) > 0.58 ? BLUE : '#c8d4ec') : WHITE; }
    return Math.abs(t - 0.93) < 0.01 ? BLUE : WHITE;
  };
  // the merchant's table of finished wares at the front of the yard
  const MT = table(gp, -0.04, Y0, 0.2, 0.22, 0.07, 0.045, '#4a2a1c');
  const geo = new THREE.LatheGeometry(dense(sc(MEIPING, 0.1 * H / 0.24 * 1.15, H), 8).map(([r, y]) => new THREE.Vector2(r, y)), 64);
  add(MT, paintFaces(geo, WHITE, mp), mat('#ffffff', { vc: true, rough: 0.1, flat: false }), -0.07, 0.045, 0, 1, 1, 1);
  porcelain(MT, sc(VASE, 0.02, 0.05), WHITE, -0.025, 0.045, -0.008, (x, y, z) => (Math.abs(y - 0.042) < 0.002 || Math.abs(y - 0.006) < 0.002 || (y > 0.014 && y < 0.034 && fbm(Math.atan2(z, x) * 3, y * 120, 1, 2) > 0.55) ? BLUE : WHITE));
  // dishes on small stands: cobalt rims, a central lotus pond motif
  const dish = (x: number, z: number, R: number, ry: number) => {
    const D = grp(MT, x, 0.045, z, ry);
    box(D, '#3a1a12', 0, 0, -0.008, 0.016, 0.004, 0.012);
    rod(D, [0, 0.004, -0.01], [0, R * 1.1, -0.012], 0.0018, '#3a1a12', 4);
    const dg = new THREE.LatheGeometry(dense([[0, 0.0], [R * 0.45, 0], [R * 0.5, R * 0.03], [R, R * 0.12], [R * 0.97, R * 0.15], [R * 0.48, R * 0.07], [0, R * 0.06]], 8).map(([a, b]) => new THREE.Vector2(a, b)), 64);
    const pd = paintFaces(dg, WHITE, (px, py, pz) => {
      const r = Math.hypot(px, pz) / R, a = Math.atan2(pz, px);
      if (py < R * 0.05 && r < 0.46) return WHITE;
      if (r > 0.9) return BLUE;
      if (r > 0.55) return Math.sin(a * 16) * Math.sin(r * 30) > 0.3 ? BLUE : WHITE;
      if (Math.abs(r - 0.5) < 0.025) return BLUE;
      const pet = Math.abs(Math.sin(a * 4)) * 0.3;
      return r < 0.12 || (r < 0.32 && r > pet && Math.sin(a * 8) > 0.4) ? BLUE : fbm(px * 200, 1, pz * 200, 2) > 0.62 ? '#6f8cc8' : WHITE;
    });
    add(D, pd, mat('#ffffff', { vc: true, rough: 0.1, flat: false }), 0, R * 1.05, 0.0, 1, 1, 1, 0, Math.PI / 2 - 0.25);
  };
  dish(0.03, 0.0, 0.024, 0.15);
  dish(0.08, 0.004, 0.02, -0.2);
  // the painter at his bench decorating a blank with cobalt; shelves of white blanks
  const px = 0.2, pz = 0.06;
  box(gp, '#6a4a30', px - 0.005, Y0, pz, 0.03, 0.03, 0.04);
  const pr = man(gp, px, Y0 + 0.004, pz, { h: 0.15, ry: -Math.PI / 2 + 0.3, top: '#3a4a6a', bottom: '#3a3a3a', head: 'jin', beard: '#2a211c', pose: 'sit', hipY: 0.2, lean: 0.25, hands: [[-0.06, 0.4, 0.26], [0.06, 0.44, 0.28]] });
  const T = table(gp, px - 0.08, Y0, pz + 0.02, 0.07, 0.06, 0.05, '#5a3a24', 0.3);
  porcelain(T, sc(VASE, 0.022, 0.065), WHITE, 0, 0.05, 0, (x, y, z) => (Math.abs(y - 0.035) < 0.004 || (y > 0.015 && y < 0.03 && Math.atan2(z, x) > 0.5 && Math.sin(Math.atan2(z, x) * 12 + y * 400) > 0.3) ? BLUE : WHITE));
  lathe(T, sc(BOWL, 0.01, 0.01), WHITE, 0.025, 0.05, 0.02, 10);
  dot(T, BLUE, 0.025, 0.054, 0.02, 0.006, 6);
  rod(gp, pr.handR, [pr.handR[0] - 0.012, pr.handR[1] + 0.008, pr.handR[2]], 0.0014, '#3a2418', 3);
  const SH = grp(gp, -0.3, Y0, 0.0, 1.2);
  for (const a of [-1, 1]) box(SH, '#5a3a24', a * 0.08, 0, 0, 0.008, 0.15, 0.04);
  for (let k = 0; k < 3; k++) {
    box(SH, '#7a5a3c', 0, 0.02 + k * 0.05, 0, 0.17, 0.005, 0.045);
    for (let i = 0; i < 5; i++) porcelain(SH, k === 1 ? sc(BOWL, 0.015, 0.018) : sc(VASE, 0.012, 0.035), WHITE, -0.06 + i * 0.03, 0.025 + k * 0.05, 0, k === 0 && i % 2 ? (_x, y) => (Math.abs(y - 0.02) < 0.004 ? BLUE : WHITE) : undefined, 14);
  }
  for (const [x, z] of [[-0.12, 0.3], [0.04, 0.32]] as const) {
    const b = porcelain(gp, sc(VASE, 0.02, 0.055), WHITE, x, Y0, z, (px2, py) => (py > 0.015 && py < 0.04 && Math.sin(px2 * 600 + py * 450) > 0.2 ? BLUE : Math.abs(py - 0.043) < 0.003 ? BLUE : WHITE));
    b.rotation.y = x * 10;
  }
}
// Ref: Commons "Vase with two fish-dragon handles, Longquan kilns" / "Ming Jingdezhen Porcelain, Hongzhi Reign 03" — glaze colours.
const lf_kiln: Builder = (gp, r) => {
  if (r.style === 'qinghua') qinghuaYard(gp); else celadonYard(gp);
  fuse(gp);
};

// =========================================================================================================
// 戏台 — opera stages: a Yuan temple stage, a Kunqu garden water pavilion, or an ornate Peking-opera stage
// =========================================================================================================
const CLOTH = ['#6a7a8c', '#8a6a4a', '#5a6a4a', '#9a8a6a', '#7a5a5a', '#4a5a6a', '#a89a7a', '#3d4a6a'];
/** Long white water sleeves (水袖) falling and flaring from a wrist towards (dx, dz). */
function waterSleeve(p: THREE.Object3D, w: V3, dx: number, dz: number, L: number): void {
  tube(p, [w, [w[0] + dx * 0.3, w[1] - L * 0.35, w[2] + dz * 0.3], [w[0] + dx * 0.8, w[1] - L * 0.7, w[2] + dz * 0.8], [w[0] + dx, w[1] - L, w[2] + dz]], 0.004, 0.009, '#ebe7dc', { radial: 6, sub: 4 });
}
/** Pheasant-feather plumes (翎子) arcing up and out from a general's helmet. */
function lingzi(p: THREE.Object3D, hd: V3, ry: number, h: number): void {
  const H = grp(p, hd[0], hd[1], hd[2], ry, h);
  for (const s of [-1, 1]) {
    tube(H, [[s * 0.03, 0.08, -0.01], [s * 0.1, 0.34, -0.08], [s * 0.26, 0.54, -0.06], [s * 0.44, 0.56, 0.04], [s * 0.56, 0.44, 0.14]], 0.02, 0.01, '#9a6a34', { radial: 5, sub: 4 });
    dot(H, '#f1e8d2', s * 0.56, 0.44, 0.14, 0.022, 5);
  }
}
/** Four triangular back flags (靠旗) fanned behind a stage general's shoulders. */
function kaoqi(p: THREE.Object3D, x: number, y: number, z: number, ry: number, h: number, c: string): void {
  const B = grp(p, x, y, z, ry, h);
  for (const a of [-0.6, -0.22, 0.22, 0.6]) {
    const s = Math.sign(a), F = grp(B, s * 0.03, 0.68, -0.1);
    F.rotation.set(-0.3, 0, -a);
    rod(F, [0, 0, 0], [0, 0.62, 0], 0.014, '#2a2018', 4);
    slab(F, [[0, 0.6], [0, 0.22], [s * 0.22, 0.56]], 0.012, c, 0, false);
    slab(F, [[0, 0.6], [0, 0.5], [s * 0.1, 0.58]], 0.016, '#b89a52', 0, false);
    dot(F, '#b89a52', 0, 0.63, 0, 0.025, 5);
  }
}
/** Stage weapon planted upright: shaft from the floor through the hand, with a crescent blade or a spear tip. */
function weapon(p: THREE.Object3D, x: number, y: number, z: number, L: number, ry: number, kind: 'dao' | 'spear'): void {
  const G = grp(p, x, y, z, ry);
  rod(G, [0, 0, 0], [0, L, 0], 0.0022, kind === 'dao' ? '#7a2a20' : '#1c1917', 5);
  if (kind === 'dao') {
    slab(G, [[0.002, L * 0.82], [0.03, L * 0.86], [0.036, L * 0.98], [0.014, L * 1.12], [0.004, L * 0.98]], 0.002, '#c9ccd2').material = mat('#c9ccd2', { metal: 0.7, rough: 0.3, flat: false });
    dot(G, '#2f6a3a', 0.004, L * 0.83, 0, 0.007, 6);
  } else cone(G, '#c9ccd2', 0, L, 0, 0.004, 0.025, 6);
  for (let k = 0; k < 5; k++) rod(G, [0, L * 0.8, 0], [Math.cos(k * 1.3) * 0.008, L * 0.8 - 0.018, Math.sin(k * 1.3) * 0.008], 0.0016, '#9a3226', 3);
}
/** Rows of spectators facing (tx, tz): seated on long benches, or standing with a few children. */
function spectators(gp: THREE.Object3D, rows: number[], cols: number, x0: number, x1: number, tx: number, tz: number, seed: number, bench: boolean): void {
  for (const [ri, z] of rows.entries()) {
    if (bench) {
      box(gp, '#6a4a30', (x0 + x1) / 2, Y0 + 0.024, z, x1 - x0 + 0.04, 0.005, 0.016);
      for (const t of [0, 0.5, 1]) box(gp, '#5a3a24', x0 - 0.015 + (x1 - x0 + 0.03) * t, Y0, z, 0.005, 0.024, 0.014);
    }
    for (let i = 0; i < cols; i++) {
      const x = x0 + ((x1 - x0) * i) / Math.max(1, cols - 1) + (bench ? 0 : (hash3(i, ri, seed) - 0.5) * 0.035);
      const zz = z + (bench ? 0 : (hash3(ri, i, seed) - 0.5) * 0.035);
      const kid = !bench && hash3(i, seed, ri) > 0.8;
      const head = kid ? 'bun' : (['futou', 'jin', 'scarf', 'topknot'] as const)[(i + ri * 2 + seed) % 4];
      man(gp, x, Y0, zz, {
        h: kid ? 0.09 : 0.135, ry: Math.atan2(tx - x, tz - zz) + (hash3(seed, i, ri) - 0.5) * 0.4, top: CLOTH[(i * 3 + ri + seed) % CLOTH.length],
        bottom: '#4a4038', head, hc: head === 'scarf' ? '#4a3a2c' : '#1c1917', detail: 'min',
        ...(bench ? { pose: 'sit' as const, hipY: 0.2 } : { pose: hash3(i, ri, seed + 1) > 0.82 ? 'point' as const : 'relax' as const }),
      });
    }
  }
}
/** Seated tea drinkers on stools around a square table (八仙桌), turned towards (tx, tz). */
function teaTable(gp: THREE.Object3D, x: number, z: number, tx: number, tz: number, seed: number, women = false, qing = false): void {
  const T = table(gp, x, Y0, z, 0.065, 0.065, 0.055, '#4a2416');
  const tp = lathe(T, [[0, 0], [0.01, 0], [0.014, 0.01], [0.009, 0.019], [0.004, 0.021], [0, 0.023]], '#5a4a40', 0.012, 0.055, -0.01, 10);
  tp.material = mat('#5a4a40', { rough: 0.3, flat: false });
  rod(T, [0.022, 0.065, -0.01], [0.032, 0.074, -0.01], 0.0018, '#5a4a40', 4);
  for (const [cx, cz] of [[-0.015, 0.012], [0.02, 0.018], [-0.02, -0.015]]) cup(T, cx, 0.055, cz, 0.006, '#eef0ea');
  for (const [k, [dx, dz]] of ([[-0.055, 0], [0.055, 0], [0, 0.055]] as const).entries()) {
    const px = x + dx, pz = z + dz, h = 0.13, w = women && k === 1;
    cyl(gp, '#5a3424', px, Y0, pz, 0.012, h * 0.27, 8);
    man(gp, px, Y0, pz, { h: w ? h * 0.95 : h, ry: Math.atan2(tx - px, tz - pz) + (hash3(seed, k, 2) - 0.5) * 0.3, pose: 'sit', top: w ? '#9a7a7e' : CLOTH[(seed + k * 3) % CLOTH.length], head: w ? 'highbun' : qing ? 'guapi' : (['jin', 'gaomao', 'jin'] as const)[(seed + k) % 3], hc: '#1c1917', sleeves: !w, beard: k === 0 && seed % 2 ? '#2a211c' : undefined, detail: 'lo', hands: [[-0.08, 0.42, 0.2], [0.08, 0.44, 0.22]] });
  }
}
/** Bracket set (斗拱): bearing block, crossed arms and three small blocks; local +z points outwards. */
function dougong(p: THREE.Object3D, x: number, y: number, z: number, ry: number, c = '#7a5a3c'): void {
  const G = grp(p, x, y, z, ry);
  box(G, c, 0, 0, 0, 0.013, 0.008, 0.013);
  box(G, shade(c, 0.88), 0, 0.008, 0, 0.042, 0.006, 0.009);
  box(G, shade(c, 0.88), 0, 0.008, 0.008, 0.009, 0.006, 0.032);
  for (const s of [-1, 0, 1]) box(G, c, s * 0.017, 0.014, 0, 0.009, 0.006, 0.009);
  box(G, c, 0, 0.014, 0.02, 0.009, 0.006, 0.009);
}

// Ref: Yuan temple stages — 山西临汾 魏村牛王庙戏台 (1283) and the 广胜寺 明应王殿 杂剧 mural (1324): square ashlar
// platform, four corner columns, heavy lintels, bracket sets and a hip roof open on three sides.
function yuanStage(gp: THREE.Group): void {
  land(gp, '#a89878', (x, _y, z) => (z > -0.02 && Math.abs(x) < 0.055 ? bricks('#9a968c', 0.03, 0.015, 0.1)(x, 0, z, 0, 1, 0) : shade('#a89878', 0.9 + fbm(x * 16, 2, z * 16, 3) * 0.2)), undefined, '#6b5a40');
  const SX = 0, SZ = -0.17, W = 0.3, D = 0.24, PH = 0.06, T = Y0 + PH, CH = 0.2, TIM = '#5a3e2a';
  // the high ashlar platform (台基), coping stones and side steps
  pbox(gp, '#a39d92', SX, Y0, SZ, W + 0.03, PH, D + 0.03, bricks('#a39d92', 0.04, 0.018, 0.08), 0.01);
  box(gp, '#8a847a', SX, T - 0.005, SZ, W + 0.04, 0.007, D + 0.04);
  for (let i = 0; i < 4; i++) box(gp, '#9a948a', SX + W / 2 + 0.03 + i * 0.016, Y0, SZ - 0.05, 0.016, PH * (0.8 - i * 0.2), 0.06);
  // four massive corner columns on stone bases, heavy lintels (阑额), the flat board (普拍枋) and bracket sets
  const cx = W / 2 - 0.015, cz = D / 2 - 0.015;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cyl(gp, '#8a847a', SX + a * cx, T, SZ + b * cz, 0.02, 0.008, 10);
    cyl(gp, TIM, SX + a * cx, T + 0.008, SZ + b * cz, 0.014, CH - 0.008, 10);
  }
  for (const b of [-1, 1]) {
    box(gp, '#6a4a30', SX, T + CH - 0.028, SZ + b * cz, W + 0.012, 0.028, 0.024);
    box(gp, '#6a4a30', SX + b * cx, T + CH - 0.028, SZ, 0.024, 0.028, D + 0.012);
  }
  box(gp, TIM, SX, T + CH, SZ, W + 0.04, 0.008, D + 0.04);
  const by = T + CH + 0.008;
  for (const t of [-1, -0.33, 0.33, 1]) {
    dougong(gp, SX + t * cx, by, SZ + cz, 0);
    dougong(gp, SX + t * cx, by, SZ - cz, Math.PI);
    if (Math.abs(t) < 1) { dougong(gp, SX + cx, by, SZ + t * cz, Math.PI / 2); dougong(gp, SX - cx, by, SZ + t * cz, -Math.PI / 2); }
  }
  // the 歇山 hip-and-gable roof: a hipped lower skirt, a gabled top with ridge horns and gable boards
  box(gp, '#4a3424', SX, by + 0.02, SZ, W + 0.07, 0.008, D + 0.07);
  const rt = proof(gp, SX, by + 0.028, SZ, { n: 4, R0: 0.255, R1: 0.12, h: 0.05, lift: 0.25, tile: '#5a5d62' });
  tileRoof(gp, SX, rt - 0.014, SZ, 0.18, 0.16, 0.055, '#5a5d62');
  for (const s of [-1, 1]) slab(grp(gp, SX + s * 0.08, rt - 0.012, SZ, Math.PI / 2), [[-0.072, 0], [0.072, 0], [0, 0.05]], 0.004, '#6a4a30', 0, false);
  // plastered back and rear side walls, and the curtain (幕) with its two doors and a valance (帐额)
  pbox(gp, '#c9b99a', SX, T, SZ - cz, 2 * cx - 0.02, CH - 0.028, 0.012, (x, y) => shade('#c9b99a', 0.92 + fbm(x * 30, y * 30, 1, 2) * 0.12), 0.01);
  for (const a of [-1, 1]) pbox(gp, '#c9b99a', SX + a * cx, T, SZ - cz / 2, 0.012, CH - 0.028, cz, (_x, y, z) => shade('#c9b99a', 0.92 + fbm(z * 30, y * 30, 2, 2) * 0.12), 0.01);
  pbox(gp, '#8f2a22', SX, T, SZ - 0.01, 2 * cx - 0.02, CH - 0.03, 0.006, (x, y) => {
    const u = x - SX, v = y - T;
    if (Math.abs(Math.abs(u) - 0.08) < 0.022 && v < 0.085) return '#2a1a12';
    if (v > CH - 0.07) return Math.floor(u * 70 + 50) % 2 ? '#d9b44a' : '#2f6f62';
    return shade('#8f2a22', 0.9 + Math.sin(u * 300) * 0.08);
  }, 0.005);
  // the troupe (as in the 忠都秀 mural): a red-robed bearded lead, a dan in white, a white-faced clown, and the band
  const h = 0.13;
  man(gp, SX - 0.02, T, SZ + 0.05, { h, ry: 0.2, top: '#b0302a', dress: 'ankle', head: 'wusha', beard: '#1c1714', longBeard: true, sleeves: true, pose: 'point' });
  man(gp, SX + 0.075, T, SZ + 0.06, { h: h * 0.94, ry: -0.6, top: '#ece6d6', bottom: '#ece6d6', dress: 'ankle', head: 'highbun', sleeves: true, pose: 'pray' });
  man(gp, SX - 0.1, T, SZ + 0.07, { h: h * 0.94, ry: 0.6, top: '#3d6a8a', face: '#f5f1e8', head: 'futou', pose: 'cheer', lean: 0.12 });
  const dr = man(gp, SX - 0.105, T, SZ + 0.005, { h, ry: 0.5, top: '#6a5a40', head: 'jin', hands: [[-0.02, 0.6, 0.24], [0.1, 0.62, 0.22]] });
  const dk: V3 = [SX - 0.09, T, SZ + 0.035];
  for (const a of [0.3, 2.4, 4.5]) rod(gp, [dk[0], T + 0.05, dk[2]], [dk[0] + Math.cos(a) * 0.016, T, dk[2] + Math.sin(a) * 0.016], 0.0018, '#3a2418', 3);
  lathe(gp, [[0, 0], [0.015, 0], [0.018, 0.009], [0.015, 0.018], [0, 0.018]], '#a3281e', dk[0], T + 0.05, dk[2], 12);
  cyl(gp, '#e9d7aa', dk[0], T + 0.068, dk[2], 0.0152, 0.002, 12);
  for (const hd of [dr.handL, dr.handR]) rod(gp, hd, [dk[0] + (hd[0] - dk[0]) * 0.2, T + 0.072, dk[2] + (hd[2] - dk[2]) * 0.2], 0.0014, '#3a2418', 3);
  const fl = man(gp, SX + 0.11, T, SZ + 0.005, { h, ry: -0.4, top: '#4a5a6a', head: 'jin', hands: [[-0.06, 0.82, 0.16], [0.06, 0.83, 0.14]] });
  rod(gp, [fl.handL[0] - 0.012, fl.handL[1], fl.handL[2]], [fl.handR[0] + 0.018, fl.handR[1] - 0.002, fl.handR[2] - 0.006], 0.0018, '#b89a5a', 4);
  // a bronze incense burner (香炉) in the yard, and the villagers watching on benches and standing behind
  const ix = 0, iz = 0.04;
  for (const a of [0.5, 2.6, 4.7]) rod(gp, [ix, Y0 + 0.02, iz], [ix + Math.cos(a) * 0.022, Y0, iz + Math.sin(a) * 0.022], 0.003, '#4a4a30', 4);
  const bz = lathe(gp, [[0, 0], [0.018, 0.002], [0.026, 0.016], [0.024, 0.032], [0.028, 0.036], [0, 0.034]], '#5a5638', ix, Y0 + 0.012, iz, 14);
  bz.material = mat('#5a5638', { metal: 0.5, rough: 0.4, flat: false });
  for (const s of [-1, 1]) box(gp, '#5a5638', ix + s * 0.02, Y0 + 0.046, iz, 0.004, 0.014, 0.012);
  for (const s of [-1, 0, 1]) rod(gp, [ix + s * 0.008, Y0 + 0.046, iz], [ix + s * 0.008, Y0 + 0.064, iz], 0.0012, '#c23a2a', 3);
  smoke(gp, ix, Y0 + 0.07, iz, 0.012, '#ece8de', 4);
  spectators(gp, [0.13, 0.21], 6, -0.24, 0.24, SX, SZ, 1, true);
  spectators(gp, [0.3, 0.37], 7, -0.3, 0.3, SX, SZ, 4, false);
  for (const [x, z] of [[-0.36, -0.02], [0.37, 0.06]] as const) tree(gp, x, Y0, z, 0.12, '#3c5240', true);
  fuse(gp);
}

/** 太湖石: a tall, waisted, grey limestone rock, wrinkled and pierced (瘦漏透皱) — dark hollows painted into it. */
function taihu(p: THREE.Object3D, x: number, z: number, h: number, w: number, seed: number): void {
  const geo = new THREE.IcosahedronGeometry(1, 3), pos = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = (v.y + 1) / 2, waist = 1 - 0.38 * Math.sin(t * Math.PI * 1.6 + seed) ** 2;
    const n = fbm(v.x * 2.2 + seed, v.y * 2.6, v.z * 2.2, 3);
    v.x *= waist * (0.75 + n * 0.6); v.z *= waist * (0.75 + n * 0.6);
    v.y += (fbm(v.x * 3, seed, v.z * 3, 2) - 0.5) * 0.25;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const pg = paintFaces(geo.toNonIndexed(), '#8e8b84', (px, py, pz) => {
    const n = fbm(px * 5 + seed, py * 4, pz * 5, 3);
    if (n > 0.63) return '#3e3d3a';
    if (n > 0.59) return '#6a6862';
    return shade('#8e8b84', 0.86 + fbm(px * 2, py * 14, pz * 2, 2) * 0.25);
  });
  pg.computeVertexNormals();
  add(p, pg, mat('#ffffff', { vc: true, rough: 0.95 }), x, Y0 + h / 2 - 0.004, z, w, h / 2, w * 0.8, seed);
}
// Ref: late-Ming Kunqu 堂会 in a Suzhou garden (e.g. 拙政园 卅六鸳鸯馆 / 留园 water pavilions): 《牡丹亭》(1598) 生 and 旦,
// flute (笛) and clappers, guests at tea; 太湖石 rocks and willows by a lotus pond.
function kunquStage(gp: THREE.Group): void {
  const PX = 0.0, PZ = -0.22, RX = 0.4, RZ = 0.17;
  const pd = (x: number, z: number) => Math.hypot((x - PX) / RX, (z - PZ) / RZ);
  land(gp, '#6d844c', (x, _y, z) => {
    const d = pd(x, z);
    if (d < 1.12) return shade('#9a968a', 0.8 + hash3(Math.floor(x * 90), 1, Math.floor(z * 90)) * 0.35);
    if (z > -0.03 && Math.abs(x) < 0.33) return shade('#aaa498', 0.92 + hash3(Math.floor(x / 0.04), 2, Math.floor(z / 0.04)) * 0.12);
    return grassP('#6d844c', 16)(x, 0, z, 0, 1, 0);
  }, (x, z) => { const d = pd(x, z); return d < 1.1 ? -0.012 * Math.min(1, (1.1 - d) * 4) : 0; }, '#5d4a35');
  const pp: THREE.Vector2[] = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; pp.push(new THREE.Vector2(PX + Math.cos(a) * RX * 1.02, -(PZ + Math.sin(a) * RZ * 1.02))); }
  const wg = new THREE.ShapeGeometry(new THREE.Shape(pp));
  wg.rotateX(-Math.PI / 2);
  add(gp, paintFaces(wg, '#5b7c7a'), mat('#ffffff', { vc: true, rough: 0.08 }), 0, Y0 - 0.005, 0, 1, 1, 1);
  // the water pavilion stage (水榭戏台) on stone piers: plank floor, red rug, slender posts, lattice backdrop
  const SX = -0.03, SZ = -0.23, W = 0.24, D = 0.15, FY = Y0 + 0.022;
  for (const a of [-1, 0, 1]) for (const b of [-1, 1]) cyl(gp, '#8f8a7e', SX + a * (W / 2 - 0.02), Y0 - 0.014, SZ + b * (D / 2 - 0.02), 0.012, FY - Y0 + 0.006, 8);
  pbox(gp, '#8a6a48', SX, FY - 0.008, SZ, W, 0.008, D, (x) => (Math.floor((x + 1) * 90) % 2 ? '#8a6a48' : '#7a5a3c'), 0.006);
  box(gp, '#7e3a2e', SX, FY, SZ + 0.01, W - 0.05, 0.002, D - 0.05);
  for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(gp, '#4a2a1e', SX + a * (W / 2 - 0.006), FY, SZ + b * (D / 2 - 0.006), 0.006, 0.17, 8);
  for (const a of [-1, 1]) {
    box(gp, '#5a3424', SX + a * (W / 2 - 0.006), FY, SZ - 0.01, 0.004, 0.028, D - 0.03);
    box(gp, '#5a3424', SX + a * (W / 2 - 0.006), FY + 0.028, SZ - 0.01, 0.012, 0.004, D - 0.03);
  }
  pbox(gp, '#4a2a1e', SX, FY, SZ - D / 2 + 0.006, W - 0.012, 0.165, 0.006, (x, y, _z, _nx, _ny, nz) => {
    const u = x - SX, v = y - FY;
    if (nz < 0.5) return '#4a2a1e';
    if (Math.abs(u) < 0.06 && v > 0.03 && v < 0.15) return scape((u + 0.06) / 0.12, (v - 0.03) / 0.12);
    const fu = ((u * 70) % 1 + 1) % 1, fv = ((v * 70) % 1 + 1) % 1;
    return v < 0.035 ? '#5a3424' : fu < 0.22 || fv < 0.22 ? '#4a2a1e' : '#eadfc4';
  }, 0.003);
  pbox(gp, '#4a2a1e', SX, FY + 0.152, SZ + D / 2 - 0.006, W - 0.012, 0.018, 0.004, (x, y) => (((x * 120) % 1 + 1) % 1 < 0.3 || ((y * 120) % 1 + 1) % 1 < 0.3 ? '#4a2a1e' : '#c9a24a'), 0.003);
  box(gp, '#4a2a1e', SX, FY + 0.17, SZ, W + 0.012, 0.01, D + 0.012);
  proof(gp, SX, FY + 0.18, SZ, { n: 4, R0: 0.165, R1: 0.035, h: 0.08, lift: 0.55, tile: '#4a4e55', sx: 1.5 });
  // 牡丹亭: the scholar 柳梦梅 with a folding fan, 杜丽娘 with long water sleeves; flute and clapper at the sides
  const h = 0.13;
  const sh = man(gp, SX - 0.045, FY, SZ + 0.02, { h, ry: 0.55, top: '#b4c4cc', bottom: '#b4c4cc', dress: 'ankle', head: 'jin', hc: '#2a3a5a', sleeves: true, hands: [[-0.12, 0.5, 0.08], [0.15, 0.8, 0.2]] });
  const fan: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 8; i++) { const a = 0.35 + (i / 8) * (Math.PI - 0.7); fan.push([Math.cos(a) * 0.026, Math.sin(a) * 0.026]); }
  const FN = grp(gp, sh.handR[0], sh.handR[1] - 0.004, sh.handR[2], 0.55);
  slab(FN, fan, 0.0015, '#f4efe2', 0, false);
  slab(FN, fan.map(([a, b]) => [a * 0.45, b * 0.45]), 0.0025, '#6a4a30', 0, false);
  const dn = man(gp, SX + 0.045, FY, SZ + 0.035, { h: h * 0.96, ry: -0.7, top: '#dcbcbc', bottom: '#dcbcbc', dress: 'ankle', head: 'flowerbun', hands: [[-0.17, 0.8, 0.1], [0.12, 0.5, 0.18]], lean: -0.05 });
  waterSleeve(gp, dn.handL, -0.02, -0.01, 0.045);
  waterSleeve(gp, dn.handR, 0.018, 0.022, 0.06);
  const mus = (x: number, z: number, ry: number) => { cyl(gp, '#5a3424', x, FY, z, 0.011, h * 0.27, 8); return man(gp, x, FY, z, { h, ry, pose: 'sit', top: '#5a6a5a', head: 'jin', hands: [[-0.08, 0.63, 0.16], [0.06, 0.64, 0.17]] }); };
  const f1 = mus(SX + 0.095, SZ - 0.035, -1.0);
  rod(gp, [f1.handL[0] - 0.006, f1.handL[1], f1.handL[2] + 0.004], [f1.handR[0] + 0.02, f1.handR[1] - 0.003, f1.handR[2] - 0.01], 0.0016, '#b89a5a', 4);
  const f2 = man(gp, SX - 0.095, FY, SZ - 0.035, { h, ry: 1.0, pose: 'sit', top: '#5a6a5a', head: 'jin', hands: [[-0.06, 0.4, 0.22], [0.06, 0.42, 0.22]] });
  cyl(gp, '#5a3424', SX - 0.095, FY, SZ - 0.035, 0.011, h * 0.27, 8);
  cyl(gp, '#8a2a20', (f2.handL[0] + f2.handR[0]) / 2, FY, (f2.handL[2] + f2.handR[2]) / 2, 0.011, f2.handL[1] - FY - 0.004, 8);
  // the zigzag stone bridge (九曲桥) from the bank to the stage
  const BR: [number, number][] = [[0.25, 0.04], [0.25, -0.08], [0.16, -0.12], [0.16, -0.2], [SX + W / 2 - 0.01, -0.2]];
  for (let i = 0; i < BR.length - 1; i++) {
    const [ax, az] = BR[i], [bx, bz] = BR[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    box(gp, '#b0aa9e', mx, Y0 + 0.004, mz, 0.035, 0.008, L + 0.035, ry);
    for (const s of [-1, 1]) box(gp, '#9a948a', mx + Math.cos(ry) * 0.016 * s, Y0 + 0.012, mz - Math.sin(ry) * 0.016 * s, 0.003, 0.012, L, ry);
    cyl(gp, '#8f8a7e', ax, Y0 - 0.014, az, 0.01, 0.018, 6);
  }
  // lotus pads and buds, Taihu rocks and a weeping willow
  for (const [x, z, f] of [[-0.28, -0.12, 1], [-0.22, -0.1, 0], [-0.3, -0.2, 0], [-0.24, -0.27, 1], [0.3, -0.2, 0], [0.33, -0.14, 1], [0.27, -0.3, 0]] as const) {
    ell8(gp, '#55703f', x, Y0 - 0.004, z, 0.02, 0.002, 0.017, x * 9);
    if (f) { rod(gp, [x + 0.008, Y0 - 0.004, z], [x + 0.008, Y0 + 0.03, z], 0.0012, '#4f7a3a', 3); ell8(gp, '#d4a4a8', x + 0.008, Y0 + 0.035, z, 0.006, 0.01, 0.006); }
  }
  const leaves: Blade[] = [];
  for (const [rx, rz, rh] of [[-0.38, 0.04, 0.16], [-0.33, 0.12, 0.09], [0.37, 0.16, 0.1], [-0.33, -0.07, 0.07]] as const) {
    taihu(gp, rx, rz, rh, 0.026 + rh * 0.08, rx * 7 + rz * 3);
  }
  const wx = 0.38, wz = 0.0;
  tube(gp, [[wx, Y0, wz], [wx - 0.02, Y0 + 0.12, wz - 0.03], [wx - 0.05, Y0 + 0.24, wz - 0.08]], 0.012, 0.007, '#5a4a3a', { radial: 6, sub: 3 });
  const top: V3 = [wx - 0.05, Y0 + 0.24, wz - 0.08];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.3, r = 0.07 + hash3(k, 7, 2) * 0.04, tip: V3 = [top[0] + Math.cos(a) * r, top[1] + 0.01, top[2] + Math.sin(a) * r * 0.8];
    tube(gp, [top, [top[0] + Math.cos(a) * r * 0.5, top[1] + 0.035, top[2] + Math.sin(a) * r * 0.4], tip], 0.003, 0.0012, '#5a4a3a', { radial: 4, sub: 3 });
    for (let i = 0; i < 9; i++) {
      const t = 0.35 + (i / 9) * 0.65, o: V3 = [top[0] + Math.cos(a) * r * t + (hash3(k, i, 1) - 0.5) * 0.01, top[1] + 0.03 * Math.sin(t * Math.PI) + 0.01 * t, top[2] + Math.sin(a) * r * 0.8 * t];
      leaves.push({ o, d: [(hash3(i, k, 1) - 0.5) * 0.15, -1, (hash3(i, k, 2) - 0.5) * 0.15], L: 0.06 + hash3(i, k, 3) * 0.1, w: 0.0022, droop: 0, c: shade('#7d9455', 0.8 + hash3(i, k, 4) * 0.3) });
    }
  }
  blades(gp, leaves);
  // connoisseurs at tea tables on the bank
  teaTable(gp, -0.2, 0.1, SX, SZ, 1, true);
  teaTable(gp, 0.03, 0.13, SX, SZ, 2);
  teaTable(gp, -0.09, 0.31, SX, SZ, 3);
  teaTable(gp, 0.17, 0.3, SX, SZ, 4, true);
  fuse(gp);
}

// Ref: late-Qing Beijing tea-garden stage (茶园戏楼, cf. 正乙祠 / 湖广会馆 / 恭王府 戏楼) after the 1790 Anhui troupes:
// lacquered posts, 旋子彩画 beams, 守旧 backdrop with 出将/入相 doors, 武场 band at the side, audience at 八仙桌.
function jingjuStage(gp: THREE.Group): void {
  land(gp, '#8f8a82', (x, _y, z) => shade('#8f8a82', 0.9 + hash3(Math.floor(x / 0.05), 3, Math.floor(z / 0.05)) * 0.12 + fbm(x * 20, 1, z * 20, 2) * 0.06), undefined, '#5a5650');
  const SX = 0, SZ = -0.2, W = 0.34, D = 0.2, PH = 0.05, T = Y0 + PH, CH = 0.22, RED = '#86281e', GOLD = '#b0944c';
  // red lacquered platform with gold panels, and the red stage rug (氍毹)
  pbox(gp, RED, SX, Y0, SZ, W, PH, D, (x, y, z, nx, ny) => {
    if (ny > 0.5) return '#7a1a14';
    const u = (Math.abs(nx) > 0.5 ? z : x) - SX, v = y - Y0;
    if (v < 0.006 || v > PH - 0.006) return GOLD;
    return ((u * 25) % 1 + 1) % 1 < 0.08 ? GOLD : shade(RED, 0.9 + Math.sin(u * 160) * 0.05);
  }, 0.004);
  box(gp, '#8e2c22', SX, T, SZ + 0.01, W - 0.03, 0.002, D - 0.04);
  // red columns with gold rings and couplet boards (楹联)
  const cx = W / 2 - 0.012, cz = D / 2 - 0.012;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cyl(gp, RED, SX + a * cx, T, SZ + b * cz, 0.009, CH, 10);
    for (const yy of [0, CH - 0.04]) cyl(gp, GOLD, SX + a * cx, T + yy, SZ + b * cz, 0.0105, 0.006, 10);
  }
  for (const a of [-1, 1]) pbox(gp, '#1c1917', SX + a * cx, T + 0.02, SZ + cz + 0.011, 0.012, 0.1, 0.003, (_x, y) => (Math.floor(y * 150) % 3 === 0 ? GOLD : '#1c1917'), 0.003);
  // painted beams (旋子彩画) across the front and sides, gold sparrow braces and a plaque
  const BY = T + CH - 0.034, BH = 0.034;
  const caihua = (u0: number): Paint => (x, y, z, nx) => {
    const u = (Math.abs(nx) > 0.5 ? z : x) - u0, v = (y - BY) / BH;
    if (v < 0.12 || v > 0.88) return GOLD;
    const f = Math.abs(u) / 0.17;
    if (f < 0.42) return Math.abs(v - 0.5) < 0.22 ? '#2e4c72' : '#22564a';
    const k = Math.floor(f * 24);
    return k % 3 === 0 ? GOLD : k % 2 ? '#2e4c72' : '#2f6656';
  };
  pbox(gp, '#2c5a8f', SX, BY, SZ + cz, W + 0.02, BH, 0.016, caihua(SX), 0.004);
  pbox(gp, '#2c5a8f', SX, BY, SZ - cz, W + 0.02, BH, 0.016, caihua(SX), 0.004);
  for (const a of [-1, 1]) pbox(gp, '#2c5a8f', SX + a * cx, BY, SZ, 0.016, BH, D + 0.02, caihua(SZ), 0.004);
  for (const a of [-1, 1]) slab(grp(gp, SX + a * cx, BY, SZ + cz + 0.002), [[0, 0], [-a * 0.055, 0], [0, -0.032]], 0.006, GOLD, 0, false);
  pbox(gp, '#1a2f5a', SX, BY + 0.01, SZ + cz + 0.012, 0.1, 0.034, 0.004, (x, y) => {
    const u = x - SX, v = y - BY - 0.01;
    if (Math.abs(u) > 0.044 || v < 0.005 || v > 0.029) return GOLD;
    return Math.abs(Math.abs(u) - 0.018) < 0.006 && v > 0.01 && v < 0.024 ? GOLD : '#1a2f5a';
  }, 0.003);
  box(gp, '#5a1a14', SX, T + CH, SZ, W + 0.03, 0.01, D + 0.03);
  proof(gp, SX, T + CH + 0.01, SZ, { n: 4, R0: 0.2, R1: 0.05, h: 0.07, lift: 0.3, tile: '#4a4d50', sx: 1.4 });
  // the backdrop (守旧): red brocade with a gold medallion, embroidered door curtains (出将 / 入相)
  pbox(gp, RED, SX, T, SZ - cz + 0.004, 2 * cx - 0.01, CH - BH, 0.006, (x, y, _z, _nx, _ny, nz) => {
    if (nz < 0.5) return '#5a1a14';
    const u = x - SX, v = y - T - 0.1, r = Math.hypot(u, v);
    if (Math.abs(r - 0.042) < 0.004 || (r < 0.032 && Math.abs(Math.sin(Math.atan2(v, u) * 6)) > 0.45 + r * 10)) return GOLD;
    return shade('#8e2a20', 0.92 + Math.sin(u * 220) * Math.sin(y * 220) * 0.06);
  }, 0.003);
  for (const a of [-1, 1]) {
    pbox(gp, '#963028', SX + a * 0.11, T, SZ - cz + 0.01, 0.05, 0.095, 0.003, (x, y) => {
      const u = x - SX - a * 0.11, v = y - T;
      if (Math.abs(u) > 0.021 || v > 0.088) return GOLD;
      return Math.hypot(u, v - 0.05) < 0.012 ? GOLD : Math.abs(v - 0.02) < 0.004 ? '#2f5a52' : '#963028';
    }, 0.003);
    pbox(gp, GOLD, SX + a * 0.11, T + 0.1, SZ - cz + 0.01, 0.04, 0.014, 0.003, (x) => (Math.abs(((x * 140) % 1 + 1) % 1 - 0.5) < 0.18 ? '#1c1917' : GOLD), 0.003);
  }
  // the players: black-faced 张飞, red-faced 关羽 with his crescent blade, 穆桂英 with plumes and back flags, white-faced 曹操
  const h = 0.14;
  const zf = man(gp, SX - 0.12, T, SZ + 0.02, { h, ry: 0.5, top: '#2a2a2e', armor: '#3a3a40', armorTrim: GOLD, face: '#1c1917', head: 'helmet', hc: '#1c1917', beard: '#1c1714', longBeard: true, build: 1.15, hands: [[-0.2, 0.55, 0.1], [0.18, 0.7, 0.12]] });
  weapon(gp, zf.handR[0], T, zf.handR[2], 0.2, 0, 'spear');
  const gy = man(gp, SX - 0.04, T, SZ + 0.045, { h, ry: 0.25, top: '#2f5a40', dress: 'ankle', face: '#a8342a', head: 'helmet', hc: '#2f6a3a', beard: '#1c1714', longBeard: true, sleeves: true, hands: [[-0.05, 0.76, 0.2], [0.14, 0.6, 0.14]] });
  weapon(gp, gy.handR[0], T, gy.handR[2], 0.19, 0.25, 'dao');
  const mg = man(gp, SX + 0.05, T, SZ + 0.05, { h: h * 0.95, ry: -0.2, top: '#b86a76', bottom: '#b86a76', armor: '#b89a52', armorTrim: '#8e3a36', head: 'helmet', hc: '#b89a52', hands: [[-0.16, 0.95, 0.06], [0.15, 0.55, 0.15]] });
  lingzi(gp, mg.head, -0.2, h * 0.95);
  kaoqi(gp, SX + 0.05, T, SZ + 0.05, -0.2, h * 0.95, '#a85a66');
  weapon(gp, mg.handR[0], T, mg.handR[2], 0.19, 0, 'spear');
  man(gp, SX + 0.125, T, SZ + 0.015, { h, ry: -0.6, top: '#4e3050', dress: 'ankle', face: '#ece6da', head: 'wusha', beard: '#3a3530', longBeard: true, sleeves: true, pose: 'point' });
  // the band beside the stage: drum (单皮鼓), jinghu fiddle and a hand gong
  const dr = man(gp, 0.27, Y0, -0.15, { h: 0.13, ry: -1.3, pose: 'sit', top: '#3d4a6a', head: 'guapi', hands: [[-0.05, 0.52, 0.2], [0.07, 0.54, 0.2]] });
  cyl(gp, '#5a3424', 0.27, Y0, -0.15, 0.012, 0.035, 8);
  const dk: V3 = [0.245, Y0, -0.145];
  for (const a of [0.4, 2.5, 4.6]) rod(gp, [dk[0], Y0 + 0.058, dk[2]], [dk[0] + Math.cos(a) * 0.016, Y0, dk[2] + Math.sin(a) * 0.016], 0.0016, '#2a1a10', 3);
  lathe(gp, [[0, 0], [0.012, 0], [0.014, 0.008], [0.004, 0.012], [0, 0.012]], '#4a1a14', dk[0], Y0 + 0.058, dk[2], 12);
  for (const hd of [dr.handL, dr.handR]) rod(gp, hd, [dk[0] + (hd[0] - dk[0]) * 0.3, Y0 + 0.072, dk[2] + (hd[2] - dk[2]) * 0.3], 0.0012, '#3a2418', 3);
  const jh = man(gp, 0.33, Y0, -0.07, { h: 0.13, ry: -1.4, pose: 'sit', top: '#5a4a3a', head: 'guapi', hands: [[-0.05, 0.6, 0.18], [0.14, 0.38, 0.22]] });
  cyl(gp, '#5a3424', 0.33, Y0, -0.07, 0.012, 0.035, 8);
  const rb: V3 = [jh.handL[0], Y0 + 0.048, jh.handL[2]];
  add(gp, CYL(8), mat('#3a2418'), rb[0], rb[1], rb[2], 0.012, 0.016, 0.012, 0, 0, Math.PI / 2);
  rod(gp, rb, [jh.handL[0], jh.handL[1] + 0.03, jh.handL[2]], 0.0014, '#2a1a10', 4);
  rod(gp, [jh.handR[0], jh.handR[1], jh.handR[2]], [rb[0] + (rb[0] - jh.handR[0]) * 0.3, rb[1] + 0.004, rb[2] + (rb[2] - jh.handR[2]) * 0.3], 0.0008, '#c9a36a', 3);
  const gg = man(gp, 0.31, Y0, -0.21, { h: 0.13, ry: -1.0, top: '#6a5a40', head: 'guapi', hands: [[-0.1, 0.7, 0.2], [0.1, 0.72, 0.18]] });
  ellip(gp, '#c9a03a', gg.handL[0], gg.handL[1] + 0.005, gg.handL[2] + 0.01, 0.018, 0.018, 0.003, -1.0).material = mat('#c9a03a', { metal: 0.6, rough: 0.3, flat: false });
  // lanterns at the eaves and on posts around the hall, and the audience at tea tables
  for (const a of [-1, 1]) {
    rod(gp, [SX + a * (cx + 0.035), T + CH + 0.01, SZ + cz + 0.03], [SX + a * (cx + 0.035), BY - 0.01, SZ + cz + 0.03], 0.001, '#1c1917', 3);
    lantern(gp, SX + a * (cx + 0.035), BY - 0.024, SZ + cz + 0.03, 0.013);
  }
  for (const [x, z] of [[-0.4, 0.05], [0.4, 0.05], [-0.34, 0.27], [0.34, 0.27]] as const) {
    rod(gp, [x, Y0, z], [x, Y0 + 0.22, z], 0.003, '#3a2418', 5);
    rod(gp, [x, Y0 + 0.21, z], [x * 0.92, Y0 + 0.21, z], 0.002, '#3a2418', 3);
    lantern(gp, x * 0.92, Y0 + 0.185, z, 0.013);
  }
  // (women were barred from Beijing tea-garden theatres until the very end of the Qing)
  teaTable(gp, -0.22, 0.09, SX, SZ, 5, false, true);
  teaTable(gp, 0.0, 0.12, SX, SZ, 6, false, true);
  teaTable(gp, 0.22, 0.09, SX, SZ, 7, false, true);
  teaTable(gp, -0.12, 0.3, SX, SZ, 8, false, true);
  teaTable(gp, 0.12, 0.3, SX, SZ, 9, false, true);
  fuse(gp);
}

// Ref: Commons "Theatre actors, Yuan Dynasty.jpg" (Guangshengsi mural), "Battle of Changban Peking Opera 3.jpg" — costumes.
function jinBrickStage(gp: THREE.Group): void {
  // 山西侯马金代董氏墓彩绘戏台砖雕与五名杂剧演员砖俑 (1210 AD, Shanxi Museum):
  // Carved grey-and-terracotta tomb brick wall framing a recessed imitation-timber stage pavilion (仿木构砖雕戏台)
  // with polychrome red/green dougong brackets, glazed hip-and-gable roof, carved peony panels, and the 5 iconic
  // Jin yuanben / zaju actor figurines (末泥, 装孤, 副净, 副末, 装旦) standing on the stage dais.
  land(gp, '#9c8d74', (x, _y, z) => (Math.abs(x) < 0.28 && z > -0.02 ? bricks('#8e887f', 0.035, 0.018, 0.1)(x, 0, z, 0, 1, 0) : shade('#9c8d74', 0.9 + fbm(x * 16, 2, z * 16, 3) * 0.2)), undefined, '#5c4d38');
  const SX = 0, SZ = -0.1, W = 0.36, D = 0.2, PH = 0.068, T = Y0 + PH, CH = 0.195;
  const BRK = '#78756e', TERRA = '#b55438', GREEN = '#2d6e5e', GOLD = '#d4a238';
  // High carved-brick须弥座 base with waist relief panels (束腰牡丹砖雕)
  pbox(gp, BRK, SX, Y0, SZ, W + 0.05, PH, D + 0.03, (x, y) => {
    const v = y - Y0;
    if (v > 0.018 && v < PH - 0.016 && Math.abs((x * 18) % 1) > 0.25) return TERRA;
    return bricks(BRK, 0.036, 0.016, 0.08)(x, y, 0, 0, 1, 0);
  }, 0.008);
  box(gp, '#66635c', SX, T - 0.006, SZ, W + 0.06, 0.008, D + 0.04);
  // Flanking carved-brick screen walls (八字砖雕影壁) with diagonal lattice (斜方格纹)
  for (const s of [-1, 1]) {
    pbox(gp, BRK, SX + s * (W / 2 + 0.045), Y0, SZ + 0.02, 0.065, PH + CH * 0.82, 0.024, (x, y) => {
      const d = ((x + y) * 65) % 1, e = ((x - y) * 65) % 1;
      return Math.abs(d) < 0.18 || Math.abs(e) < 0.18 ? TERRA : BRK;
    }, 0.006);
  }
  // Stage columns (imitation timber in painted red brick) & rear/side brick walls
  const cx = W / 2 - 0.018, cz = D / 2 - 0.016;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cyl(gp, '#66635c', SX + a * cx, T, SZ + b * cz, 0.02, 0.009, 10);
    cyl(gp, '#943224', SX + a * cx, T + 0.009, SZ + b * cz, 0.014, CH - 0.009, 10);
  }
  pbox(gp, BRK, SX, T, SZ - cz, 2 * cx - 0.01, CH - 0.024, 0.014, bricks(BRK, 0.032, 0.015, 0.08), 0.008);
  for (const a of [-1, 1]) pbox(gp, BRK, SX + a * cx, T, SZ, 0.014, CH - 0.024, D - 0.02, bricks(BRK, 0.032, 0.015, 0.08), 0.008);
  // Polychrome brick lintel (阑额),普拍枋, and dense Jin-style brick dougong bracket sets (砖雕斗拱)
  box(gp, TERRA, SX, T + CH - 0.026, SZ + cz, W + 0.016, 0.026, 0.026);
  box(gp, GREEN, SX, T + CH, SZ, W + 0.04, 0.009, D + 0.04);
  const by = T + CH + 0.009;
  for (const t of [-1, -0.5, 0, 0.5, 1]) {
    dougong(gp, SX + t * cx, by, SZ + cz, 0, t % 1 === 0 ? TERRA : GREEN);
  }
  // Carved brick plaque and floral arch spandrels under the eaves
  pbox(gp, TERRA, SX, T + CH - 0.042, SZ + cz + 0.004, 2 * cx - 0.02, 0.018, 0.008, (x) => (Math.floor(x * 80) % 2 ? TERRA : GOLD), 0.004);
  // Jin hip-and-gable tile roof (歇山顶) with peacock-green glazed ridge and 鸱吻
  box(gp, '#4a3424', SX, by + 0.02, SZ, W + 0.07, 0.008, D + 0.07);
  const rt = proof(gp, SX, by + 0.028, SZ, { n: 4, R0: 0.275, R1: 0.13, h: 0.052, lift: 0.28, tile: '#4e555a' });
  tileRoof(gp, SX, rt - 0.014, SZ, 0.2, 0.16, 0.058, '#4e555a');
  box(gp, GREEN, SX, rt + 0.042, SZ, 0.2, 0.009, 0.012);
  for (const s of [-1, 1]) box(gp, GOLD, SX + s * 0.1, rt + 0.046, SZ, 0.014, 0.022, 0.014);
  // The 5 Houma Jin Tomb painted terracotta zaju actor figurines (五名杂剧彩绘砖俑) standing in a row on stage!
  const h = 0.138, az = SZ + 0.025;
  // 1. 副末 (Fumo, far left): ochre coat, black futou, holding clapper (拍板)
  const fm = man(gp, SX - 0.125, T, az + 0.01, { h: h * 0.94, ry: 0.28, top: '#c28848', dress: 'ankle', head: 'futou', hands: [[-0.08, 0.68, 0.18], [0.08, 0.7, 0.18]] });
  box(gp, '#5a3820', fm.handR[0], fm.handR[1], fm.handR[2] + 0.008, 0.01, 0.026, 0.005);
  // 2. 末泥 (Moni, center-left): crimson round-collar robe, spread-wing futou, holding fan
  const mn = man(gp, SX - 0.062, T, az, { h, ry: 0.12, top: '#a82c22', dress: 'ankle', head: 'futou', sleeves: true, hands: [[-0.1, 0.56, 0.14], [0.12, 0.72, 0.2]] });
  ell8(gp, '#f3ead8', mn.handR[0], mn.handR[1] + 0.01, mn.handR[2] + 0.01, 0.016, 0.018, 0.003);
  // 3. 装孤 (Zhuanggu / official, center): vermilion court robe, belt, holding hu tablet (笏)
  const zg = man(gp, SX, T, az - 0.01, { h: h * 1.02, ry: 0, top: '#b83426', dress: 'ankle', head: 'wusha', beard: '#1c1714', sleeves: true, hands: [[-0.06, 0.68, 0.18], [0.06, 0.68, 0.18]] });
  box(gp, '#efe6cf', (zg.handL[0] + zg.handR[0]) * 0.5, zg.handL[1] + 0.012, zg.handL[2] + 0.01, 0.01, 0.034, 0.003, -0.2);
  // 4. 副净 (Fujing / comic role, center-right): open green/ochre tunic, painted face, comical dance pose
  man(gp, SX + 0.062, T, az + 0.008, { h: h * 0.96, ry: -0.18, top: '#2f6a56', face: '#f5f1e8', head: 'jin', hc: '#8a2a20', pose: 'cheer', lean: 0.12 });
  // 5. 装旦 (Zhuangdan / female role, far right): green Song-Jin beizi jacket over crimson skirt, high bun
  man(gp, SX + 0.125, T, az + 0.012, { h: h * 0.93, ry: -0.28, top: '#3a725e', bottom: '#9e2a22', dress: 'ankle', head: 'highbun', sleeves: true, pose: 'pray' });
  // Pair of carved-brick guardian lions in front of the stage platform
  for (const s of [-1, 1]) {
    box(gp, '#8a847a', s * 0.14, Y0, 0.08, 0.036, 0.022, 0.042);
    ell8(gp, '#78736a', s * 0.14, Y0 + 0.038, 0.08, 0.016, 0.022, 0.02);
    ell8(gp, TERRA, s * 0.14, Y0 + 0.058, 0.088, 0.015, 0.015, 0.015);
  }
  fuse(gp);
}

const lf_opera: Builder = (gp, r) => {
  if (r.style === 'kunqu') kunquStage(gp);
  else if (r.style === 'jingju') jingjuStage(gp);
  else if (r.style === 'jin') jinBrickStage(gp);
  else yuanStage(gp);
};

// =========================================================================================================
// 黄道婆 — Huang Daopo's cotton revolution: treadle three-spindle wheel, cotton gin, bowing, loom and cotton field
// =========================================================================================================
/** Cotton plant: woody stem, side shoots with palmate leaves and open white bolls in brown bracts. */
function cottonPlant(p: THREE.Object3D, leaves: Blade[], x: number, z: number, s: number, seed: number): void {
  rod(p, [x, Y0, z], [x, Y0 + 0.1 * s, z], 0.0022, '#6a4a30', 4);
  for (let i = 0; i < 7; i++) {
    const a = hash3(seed, i, 1) * TAU, hh = Y0 + (0.03 + i * 0.011) * s, L = (0.025 + hash3(seed, i, 2) * 0.02) * s;
    const tip: V3 = [x + Math.cos(a) * L, hh + 0.014 * s, z + Math.sin(a) * L];
    rod(p, [x, hh, z], tip, 0.0012, '#6a4a30', 3);
    if (i % 2) {
      dot(p, '#5a3a24', tip[0], tip[1] - 0.002, tip[2], 0.0055 * s, 5);
      blob(p, '#ece8dc', tip[0], tip[1] + 0.004 * s, tip[2], 0.0075 * s, 0.0065 * s, 0.0075 * s, a);
    } else for (let j = 0; j < 3; j++) {
      const b = a + (j - 1) * 0.7;
      leaves.push({ o: tip, d: [Math.cos(b), 0.25, Math.sin(b)], L: 0.028 * s, w: 0.013 * s, droop: 0.4, c: shade('#57703f', 0.8 + hash3(seed, i, j) * 0.3) });
    }
  }
  blob(p, '#ece8dc', x, Y0 + 0.105 * s, z, 0.008 * s, 0.007 * s, 0.008 * s);
}
/** Round rush basket heaped with white cotton (seed cotton when `seeds`). */
function cottonBasket(p: THREE.Object3D, x: number, z: number, r: number, seeds = false): void {
  const b = lathe(p, [[0, 0], [r * 0.8, 0], [r, r * 0.9], [r * 1.05, r * 0.95], [r * 0.95, r * 0.95], [0, r * 0.2]], '#a8834e', x, Y0, z, 12);
  b.material = mat('#a8834e', { rough: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, q = i ? r * 0.5 : 0;
    blob(p, '#ece8dc', x + Math.cos(a) * q, Y0 + r * (i ? 0.95 : 1.15), z + Math.sin(a) * q, r * 0.5, r * 0.35, r * 0.5, a);
    if (seeds) dot(p, '#5a3a24', x + Math.cos(a) * q * 1.2, Y0 + r * 1.05, z + Math.sin(a) * q * 1.2, r * 0.12, 4);
  }
}
/** A thick, round-shouldered straw thatch (gable roof, ridge along X) of width w, half-depth d, rise h. */
function thatch(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number): void {
  const sh = new THREE.Shape();
  sh.moveTo(-d, -0.012);
  sh.quadraticCurveTo(-d * 0.45, h * 0.75, 0, h);
  sh.quadraticCurveTo(d * 0.45, h * 0.75, d, -0.012);
  sh.lineTo(d * 0.86, -0.02);
  sh.quadraticCurveTo(d * 0.4, h * 0.5, 0, h * 0.72);
  sh.quadraticCurveTo(-d * 0.4, h * 0.5, -d * 0.86, -0.02);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -w / 2);
  const straw: Paint = (px, py, pz) => {
    const n = fbm(pz * 90, py * 12, px * 90, 2), streak = hash3(Math.floor(pz * 400), Math.floor(py * 60), 3);
    const eave = py < 0.004 ? 0.72 : 1, course = ((py * 55) % 1 + 1) % 1 < 0.18 ? 0.8 : 1;
    return shade(mix('#8f7c58', '#5e5038', Math.max(0, n - 0.35) * 1.2), (0.86 + streak * 0.22) * eave * course);
  };
  add(p, paintFaces(geo, '#8a7a56', straw), mat('#ffffff', { vc: true, rough: 1 }), x, y, z, 1, 1, 1, Math.PI / 2);
  add(p, CYL(10), mat('#5a4c36', { rough: 1 }), x, y + h - 0.004, z, 0.012, w + 0.02, 0.012, 0, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) rod(p, [x - w / 2 + 0.03 + i * (w - 0.06) / 4, y + h + 0.004, z - 0.014], [x - w / 2 + 0.03 + i * (w - 0.06) / 4, y + h + 0.004, z + 0.014], 0.0016, '#4a3a28', 3);
}
// Ref: 黄道婆 (Yuan, c. 1295) brought Hainan Li cotton craft to Songjiang 乌泥泾; tools after 王祯《农书》(1313):
// 搅车 roller gin, 弹弓 cotton bow, 脚踏三锭纺车 treadle three-spindle wheel, 斜织机 loom; a thatched rural cottage.
// Ref: Wang Zhen《农书》 woodcuts and Commons "History of Inventions USNM 29 Spindle.png" — treadle wheel, cotton bow, loom.
const lf_spinning: Builder = (gp) => {
  const field = (x: number, z: number) => x < -0.26 + Math.sin(z * 9) * 0.015;
  land(gp, '#b59a74', (x, _y, z) => (field(x, z)
    ? shade(Math.sin(z * 75) > 0.2 ? '#7a5a3a' : '#8a6a46', 0.9 + fbm(x * 20, 1, z * 20, 2) * 0.2)
    : shade('#b59a74', 0.9 + fbm(x * 14, 3, z * 14, 3) * 0.2)), undefined, '#6b5038');
  const leaves: Blade[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) {
    const x = -0.41 + i * 0.055 + (hash3(i, j, 1) - 0.5) * 0.015, z = -0.24 + j * 0.068;
    if (Math.hypot(x, z) < 0.44) cottonPlant(gp, leaves, x, z, 0.72 + hash3(i, j, 2) * 0.22, i * 7 + j);
  }
  // the thatched mud house behind, with a door and a lattice window
  const hx = 0.08, hz = -0.33;
  pbox(gp, '#b8a582', hx, Y0, hz, 0.34, 0.13, 0.1, (x, y, z) => shade('#b8a582', 0.9 + fbm(x * 30, y * 30, z * 30, 2) * 0.16), 0.01);
  box(gp, '#3a2a1e', hx - 0.06, Y0, hz + 0.051, 0.04, 0.09, 0.003);
  pbox(gp, '#4a3424', hx + 0.08, Y0 + 0.05, hz + 0.051, 0.05, 0.04, 0.003, (x, y) => (((x * 150) % 1 + 1) % 1 < 0.3 || ((y * 150) % 1 + 1) % 1 < 0.3 ? '#4a3424' : '#e8dcc0'), 0.003);
  for (const s of [-1, 1]) {
    const gs = new THREE.Shape([new THREE.Vector2(-0.05, 0), new THREE.Vector2(0.05, 0), new THREE.Vector2(0, 0.075)]);
    add(gp, paintFaces(new THREE.ExtrudeGeometry(gs, { depth: 0.01, bevelEnabled: false }), '#b8a582', (x, y, z) => shade('#b8a582', 0.9 + fbm(x * 30, y * 30, z * 30, 2) * 0.16)), mat('#ffffff', { vc: true }), hx + s * 0.165 - 0.005, Y0 + 0.13, hz, 1, 1, 1, Math.PI / 2);
  }
  thatch(gp, hx, Y0 + 0.128, hz, 0.38, 0.085, 0.1);
  // 黄道婆 at her treadle three-spindle wheel (脚踏三锭纺车): big wheel, belt, three spindles, three yarns to her hand
  const S = grp(gp, -0.05, Y0, 0.1, 0.25);
  const WOOD = '#8a6a48', R = 0.058, wx = 0.035, wy = 0.076, h = 0.14;
  for (const s of [-1, 1]) {
    box(S, WOOD, -0.005, 0, s * 0.032, 0.22, 0.008, 0.008);
    box(S, WOOD, wx, 0, s * 0.024, 0.008, wy + 0.006, 0.008);
    box(S, WOOD, -0.085, 0, s * 0.032, 0.008, 0.112, 0.008);
  }
  for (const x of [-0.11, 0.1]) box(S, WOOD, x, 0, 0, 0.008, 0.008, 0.072);
  box(S, WOOD, -0.085, 0.07, 0, 0.012, 0.006, 0.072);
  add(S, CYL(8), mat(WOOD), wx, wy, 0.004, 0.008, 0.07, 0.008, 0, Math.PI / 2);
  const Wh = anim(S, 'spin', wx, wy, 0, { axis: 'z', speed: 2.5 });
  for (const z of [-0.008, 0.008]) add(Wh, g('cus2:rim', () => new THREE.TorusGeometry(1, 0.035, 5, 40)), mat('#7a5a3c'), 0, 0, z, R, R, R);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; for (const z of [-0.008, 0.008]) rod(Wh, [0, 0, z], [Math.cos(a) * R, Math.sin(a) * R, z], 0.0014, '#7a5a3c', 3); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; box(Wh, '#a8875a', Math.cos(a) * R, Math.sin(a) * R - 0.002, 0, 0.003, 0.004, 0.02).rotation.z = a; }
  add(Wh, CYL(8), mat('#6a4a30'), 0, 0, 0, 0.016, 0.026, 0.016, 0, Math.PI / 2);
  box(S, WOOD, -0.07, 0.004, 0.044, 0.15, 0.004, 0.016);
  rod(S, [wx - 0.004, 0.01, 0.044], [wx, wy, 0.044], 0.0018, WOOD, 4);
  dot(S, '#6a4a30', wx, wy, 0.044, 0.004, 6);
  const sp: V3[] = [];
  for (const sy of [0.08, 0.093, 0.106]) {
    rod(S, [-0.085, sy, -0.034], [-0.085, sy, 0.04], 0.0011, '#d8d0c0', 4);
    add(S, CYL(8), mat('#6a4a30'), -0.085, sy, 0, 0.008, 0.006, 0.008, 0, Math.PI / 2);
    ell8(S, '#f4f1ea', -0.085, sy, 0.02, 0.0045, 0.0045, 0.011);
    sp.push([-0.085, sy, 0.04]);
  }
  rod(S, [wx, wy + R, 0], [-0.085, 0.11, 0], 0.0008, '#3a2a1e', 3);
  rod(S, [wx, wy - R, 0], [-0.085, 0.076, 0], 0.0008, '#3a2a1e', 3);
  cyl(S, '#6a4a30', -0.165, 0, 0.03, 0.014, h * 0.27, 8);
  const hd = man(S, -0.165, 0, 0.03, { h, ry: Math.PI / 2, pose: 'sit', top: '#3a5a8a', bottom: '#2f3a4a', head: 'scarf', hc: '#2f4a7a', hair: '#9a9590', hands: [[-0.35, 0.74, 0.16], [0.06, 0.55, 0.3]], feet: [[-0.06, 0.04, 0.28], [0.06, 0.05, 0.3]] });
  for (const q of sp) rod(S, q, hd.handL, 0.0006, '#f7f5ef', 3);
  blob(S, '#ece8dc', hd.handL[0], hd.handL[1] - 0.004, hd.handL[2], 0.008, 0.006, 0.008);
  cottonBasket(gp, -0.24, 0.27, 0.03);
  // the cotton gin (搅车): two rollers turned by cranks; seeds drop in front, lint piles behind
  const G = grp(gp, 0.22, Y0, 0.13, -0.45);
  box(G, '#6a4a30', 0, 0.03, 0, 0.12, 0.007, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(G, '#5a3a24', sx * 0.05, 0, sz * 0.018, 0.007, 0.03, 0.007);
  for (const s of [-1, 1]) box(G, WOOD, s * 0.045, 0.035, 0, 0.01, 0.07, 0.014);
  for (const [y, s] of [[0.078, 1], [0.092, -1]] as const) {
    add(G, CYL(10), mat(s > 0 ? '#5a5a58' : '#8a6a48', { metal: s > 0 ? 0.5 : 0.1 }), 0, y, 0, 0.012, 0.11, 0.012, 0, 0, Math.PI / 2);
    rod(G, [s * 0.055, y, 0], [s * 0.055, y + 0.022, 0.01], 0.002, '#6a4a30', 4);
    rod(G, [s * 0.055, y + 0.022, 0.01], [s * 0.07, y + 0.022, 0.01], 0.002, '#6a4a30', 4);
  }
  box(G, WOOD, 0, 0.105, 0, 0.1, 0.006, 0.016);
  for (let i = 0; i < 14; i++) dot(G, '#4a3020', (hash3(i, 1, 9) - 0.5) * 0.06, 0.003, 0.04 + hash3(i, 2, 9) * 0.03, 0.004, 4);
  for (let i = 0; i < 5; i++) blob(G, '#ece8dc', (hash3(i, 3, 9) - 0.5) * 0.07, 0.04 + i * 0.002, -0.035, 0.016, 0.01, 0.014, i);
  cyl(G, '#6a4a30', 0, 0, -0.075, 0.013, 0.036, 8);
  const gm = man(G, 0, 0, -0.075, { h: 0.135, pose: 'sit', top: '#7a6a4a', bottom: '#4a4038', head: 'jin', hc: '#3a2a1e', hands: [[-0.05, 0.6, 0.38], [0.42, 0.62, 0.55]] });
  rod(G, gm.handR, [0.07, 0.1, 0.01], 0.0015, '#e2b48c', 3);
  cottonBasket(gp, 0.34, 0.03, 0.028, true);
  cottonBasket(gp, 0.12, 0.27, 0.026);
  // bowing the lint (弹棉): a long bow over a heap of cotton, struck with a mallet
  const bx = -0.15, bz = -0.19;
  box(gp, '#c9b48a', bx + 0.04, Y0, bz + 0.02, 0.1, 0.004, 0.08);
  for (let i = 0; i < 7; i++) blob(gp, '#ece8dc', bx + 0.02 + hash3(i, 4, 1) * 0.05, Y0 + 0.012, bz + hash3(i, 4, 2) * 0.05, 0.022, 0.014, 0.02, i).material = mat('#ece8dc', { rough: 1 });
  const bw = man(gp, bx - 0.03, Y0, bz, { h: 0.14, ry: 1.3, top: '#8a5a4a', bottom: '#4a3a3a', head: 'scarf', hc: '#5a3a3a', lean: 0.25, hands: [[-0.02, 0.62, 0.22], [0.12, 0.56, 0.28]] });
  const bt: V3 = [bw.handL[0] + 0.005, bw.handL[1] + 0.06, bw.handL[2]], be: V3 = [bx + 0.09, Y0 + 0.03, bz + 0.03];
  tube(gp, [bt, [(bt[0] + be[0]) / 2 + 0.01, (bt[1] + be[1]) / 2 + 0.02, (bt[2] + be[2]) / 2], be], 0.003, 0.002, '#7a5a3a', { radial: 5, sub: 4 });
  rod(gp, bt, be, 0.0006, '#efe8d6', 3);
  rod(gp, bw.handR, [bw.handR[0] + 0.02, bw.handR[1] - 0.01, bw.handR[2] + 0.01], 0.004, '#6a4a30', 5);
  // the slanted treadle loom (斜织机) in front of the house: warp sheet, heddles, reed and blue-check cloth
  const L = grp(gp, 0.06, Y0, -0.18, 0);
  const LW = '#7a5a3c', check: Paint = (x, _y, z) => ((Math.floor(x * 300) + Math.floor(z * 300)) % 2 ? '#2f4a7a' : (Math.floor(x * 150) % 2 ? '#e8e4da' : '#5a74a0'));
  for (const s of [-1, 1]) {
    box(L, LW, 0.14, 0, s * 0.05, 0.2, 0.008, 0.008);
    box(L, LW, 0.055, 0, s * 0.05, 0.008, 0.075, 0.008);
    rod(L, [0.13, 0, s * 0.05], [0.23, 0.165, s * 0.05], 0.003, LW, 4);
    box(L, LW, 0.13, 0, s * 0.05, 0.008, 0.17, 0.008);
  }
  add(L, CYL(10), mat('#2f4a7a'), 0.055, 0.06, 0, 0.022, 0.1, 0.022, 0, Math.PI / 2);
  add(L, CYL(8), mat(LW), 0.225, 0.16, 0, 0.016, 0.11, 0.016, 0, Math.PI / 2);
  const wl = Math.hypot(0.16, 0.085), wa = Math.atan2(0.085, 0.16);
  const WP = grp(L, 0.145, 0.115, 0);
  WP.rotation.z = wa;
  pbox(WP, '#efe8d6', 0, -0.001, 0, wl, 0.002, 0.09, (_x, _y, z) => (Math.floor(z * 600) % 2 ? '#efe8d6' : '#d8cfbc'), 0.004);
  const CL = grp(L, 0.065, 0.068, 0);
  CL.rotation.z = Math.atan2(0.006, 0.03);
  pbox(CL, '#2f4a7a', 0.0, -0.001, 0, 0.035, 0.002, 0.09, check, 0.002);
  box(L, LW, 0.13, 0.17, 0, 0.012, 0.008, 0.11);
  for (let i = 0; i < 8; i++) rod(L, [0.13, 0.17, -0.04 + i * 0.0115], [0.13, 0.118, -0.04 + i * 0.0115], 0.0006, '#d8cfbc', 3);
  box(L, '#5a3a24', 0.105, 0.085, 0, 0.006, 0.03, 0.1);
  for (const s of [-1, 1]) box(L, '#5a3a24', 0.12 + s * 0.02, 0.004, 0.02 * s, 0.09, 0.004, 0.014);
  box(L, '#6a4a30', -0.01, 0, 0, 0.03, 0.038, 0.06);
  const wv = man(L, -0.01, 0, 0, { h: 0.135, ry: Math.PI / 2, pose: 'sit', top: '#5a7a6a', bottom: '#3a4a4a', head: 'bun', hands: [[-0.08, 0.5, 0.32], [0.09, 0.52, 0.3]], feet: [[-0.06, 0.035, 0.32], [0.06, 0.05, 0.3]] });
  ell8(L, '#6a4a30', wv.handR[0] + 0.006, wv.handR[1], wv.handR[2], 0.004, 0.003, 0.014);
  for (let i = 0; i < 40; i++) {
    const a = hash3(i, 7, 3) * TAU, rr = 0.4 + hash3(i, 7, 4) * 0.05, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (field(x, z)) continue;
    for (let k = 0; k < 5; k++) leaves.push({ o: [x, Y0, z], d: [Math.cos(k * 1.3) * 0.4, 1, Math.sin(k * 1.3) * 0.4], L: 0.02 + hash3(i, k, 5) * 0.012, w: 0.003, droop: 0.5, c: shade('#6a8a3a', 0.8 + hash3(i, k, 6) * 0.3) });
  }
  for (const [x, z, a] of [[0.02, 0.33, 0.5], [0.07, 0.36, -1.2], [0.27, 0.22, 2]] as const) {
    // small brown farmyard hens, at true scale (~40 cm long beside 1.6 m people)
    const H = grp(gp, x, Y0, z, a);
    ell8(H, '#7a5232', 0, 0.015, 0, 0.0095, 0.009, 0.014, 0, -0.15);
    ell8(H, '#8a6040', 0, 0.023, 0.011, 0.0045, 0.0075, 0.0045, 0, 0.35);
    ell8(H, '#8a6040', 0, 0.029, 0.014, 0.004, 0.0042, 0.0048);
    box(H, '#8a3a2a', 0, 0.032, 0.014, 0.0012, 0.003, 0.005);
    cone(H, '#a08a5a', 0, 0.028, 0.0192, 0.0016, 0.004, 4).rotation.x = Math.PI / 2;
    ell8(H, '#4a3222', 0, 0.022, -0.014, 0.0035, 0.009, 0.0045, 0, -0.6);
    for (const s of [-1, 1]) rod(H, [s * 0.004, 0.008, 0], [s * 0.004, 0, 0.002], 0.0007, '#9a8050', 3);
  }
  blades(gp, leaves);
};

// =========================================================================================================
// 四时捺钵 — Liao Dynasty Seasonal Nabo Royal Camp (契丹四时捺钵 / 春水秋山): Khitan imperial felt yurt (御帐)
// with golden dragon patterns and wolf-head standard (狼头纛), mounted Khitan emperor & falconer hunting swans
// with a Gyrfalcon (海东青猎天鹅) beside a spring meltwater pond, and a bronze boiling cauldron.
// =========================================================================================================
const lf_nabo: Builder = (gp) => {
  const pond = (x: number, z: number) => Math.hypot(x - 0.16, z - 0.16) < 0.16;
  land(gp, '#7e8c54', (x, _y, z) => {
    if (pond(x, z)) return mix('#3a6e82', '#6498ab', Math.max(0, Math.min(1, (0.15 - Math.hypot(x - 0.16, z - 0.16)) / 0.13)));
    const n = fbm(x * 9, 1, z * 9, 2);
    return n > 0.58 ? '#8e9860' : n < 0.36 ? '#6c7a48' : null;
  });
  const felt = '#ede6d6', red = '#9e2e24', gold = '#d8a638', wood = '#5a3822';
  // Khitan Imperial Felt Yurt (捺钵御帐) at back-left: cylindrical lattice wall + dome roof + red-and-gold bands
  const YX = -0.14, YZ = -0.11, YR = 0.155;
  lathe(gp, [[0, 0], [YR, 0], [YR, 0.088], [YR * 0.92, 0.11], [YR * 0.55, 0.155], [0.026, 0.178], [0, 0.18]], felt, YX, Y0, YZ, 24);
  // Decorative red felt valances, golden cloud/brocade trim & wooden lattice door facing +z/+x
  cyl(gp, red, YX, Y0 + 0.078, YZ, YR * 1.01, 0.012, 24);
  cyl(gp, gold, YX, Y0 + 0.088, YZ, YR * 1.012, 0.005, 24);
  cyl(gp, red, YX, Y0 + 0.168, YZ, 0.038, 0.01, 16);
  lathe(gp, [[0, 0], [0.016, 0.008], [0.008, 0.024], [0, 0.032]], gold, YX, Y0 + 0.175, YZ, 10);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    rod(gp, [YX + Math.cos(a) * 0.032, Y0 + 0.172, YZ + Math.sin(a) * 0.032], [YX + Math.cos(a) * YR * 0.98, Y0 + 0.088, YZ + Math.sin(a) * YR * 0.98], 0.0025, red, 4);
  }
  box(gp, wood, YX + 0.06, Y0, YZ + YR * 0.88, 0.052, 0.076, 0.014, 0.42);
  box(gp, red, YX + 0.06, Y0 + 0.004, YZ + YR * 0.9, 0.042, 0.066, 0.01, 0.42);
  // Khitan Wolf-Head Royal Standard (狼头纛) beside the yurt entrance
  const bx = 0.06, bz = -0.18;
  rod(gp, [bx, Y0, bz], [bx, Y0 + 0.26, bz], 0.004, wood, 6);
  ell8(gp, gold, bx, Y0 + 0.268, bz + 0.006, 0.012, 0.009, 0.018);
  for (let k = 0; k < 3; k++) {
    tube(gp, [[bx, Y0 + 0.24 - k * 0.035, bz], [bx + 0.04, Y0 + 0.22 - k * 0.035, bz + 0.01], [bx + 0.075, Y0 + 0.19 - k * 0.035, bz]], 0.008, 0.002, k === 0 ? red : '#221c18', { radial: 6, sub: 3 });
  }
  // Mounted Khitan falconer releasing a white Gyrfalcon (海东青) toward wild swans on the spring pond
  const H = grp(gp, -0.06, Y0, 0.16, 0.65, 0.46);
  const seat = horse(H, '#6e462c', '#241810', { stride: 0.06, saddle: gold, cloth: red });
  const rh = 0.52, ry0 = seat - rh * 0.45;
  human(H, 0, ry0, -0.02, {
    h: rh, pose: 'sit', top: '#8c2820', bottom: '#2b241e', hair: '#1c1714', hat: '#3a281a', hatStyle: 'fur',
    armor: gold, feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.14, 0.52, 0.15], [0.22, 0.72, 0.18]], detail: 'hi',
  });
  // White Gyrfalcon (海东青) soaring above the rider's raised arm & two white swans on the pond
  const fx = -0.05 + 0.08, fy = Y0 + 0.27, fz = 0.16 + 0.06;
  ell8(gp, '#f4f0e6', fx, fy, fz, 0.009, 0.006, 0.018, 0.5);
  for (const s of [-1, 1]) box(gp, '#f4f0e6', fx + s * 0.018, fy + 0.003, fz, 0.024, 0.002, 0.01, 0, 0, s * 0.35);
  for (const [sx, sz, a] of [[0.18, 0.14, 0.4], [0.23, 0.21, -0.8]] as const) {
    ell8(gp, '#f4f0e6', sx, Y0 + 0.008, sz, 0.012, 0.008, 0.018, a);
    tube(gp, [[sx, Y0 + 0.01, sz + 0.01], [sx, Y0 + 0.026, sz + 0.016], [sx, Y0 + 0.03, sz + 0.01]], 0.003, 0.0025, '#f4f0e6', { radial: 5, sub: 3 });
  }
  // Campfire & tripod bronze cauldron (契丹铜釜)
  lathe(gp, [[0, 0.01], [0.024, 0.014], [0.028, 0.032], [0.022, 0.038], [0, 0.018]], '#4a3828', -0.24, Y0 + 0.01, 0.16, 12);
  flame(gp, -0.24, Y0 + 0.004, 0.16, 0.008);
  smoke(gp, -0.24, Y0 + 0.045, 0.16, 0.012);
};

// =========================================================================================================
// 西夏文与鎏金铜牛 — Western Xia Gilt-Bronze Recumbent Ox (西夏陵鎏金铜牛, 1.2 m national treasure) on a carved
// pedestal, beside a Tangut script stele (西夏文残碑) and movable-type printed sutra pages (《吉祥遍至口合本续》).
// =========================================================================================================
const lf_xixiawen: Builder = (gp) => {
  const BY = plinth(gp, SITE.paving, { R: 0.46, h: 0.0435 }) + 0.0015, Y = BY;
  const gold = '#dfa834', darkGold = '#b57e1e', stone = '#8e8678', wood = '#4a2e1e';
  // 1. Display pedestal & the Gilt-Bronze Recumbent Ox (西夏鎏金铜牛): muscular folded legs, broad chest,
  // S-curved horns, alert ears, and gleaming mercury-gilt bronze finish
  pbox(gp, '#5c221c', -0.08, Y, 0.05, 0.34, 0.032, 0.21, (x, _y, z) => shade('#5c221c', 0.9 + fbm(x * 28, 2, z * 28) * 0.2), 0.012);
  box(gp, gold, -0.08, Y + 0.03, 0.05, 0.346, 0.004, 0.216);
  const OX = grp(gp, -0.08, Y + 0.034, 0.05, 0.22);
  const giltMat = mat(gold, { metal: 0.85, rough: 0.22, flat: false });
  // Recumbent barrel body, muscular hump & hindquarters
  sweep(OX, [
    { p: [-0.11, 0.042, 0], w: 0.052, h: 0.048 },
    { p: [-0.04, 0.052, 0], w: 0.068, h: 0.062 },
    { p: [0.05, 0.058, 0], w: 0.072, h: 0.068 },
    { p: [0.11, 0.065, 0], w: 0.054, h: 0.058 },
  ], gold, { radial: 14, sub: 4 });
  // Folded forelegs and hindlegs tucked beneath the body
  for (const sz of [-1, 1]) {
    tube(OX, [[0.07, 0.028, sz * 0.052], [0.11, 0.014, sz * 0.048], [0.04, 0.01, sz * 0.042]], 0.018, 0.013, darkGold, { radial: 8, sub: 3 });
    tube(OX, [[-0.07, 0.03, sz * 0.056], [-0.02, 0.012, sz * 0.052], [-0.09, 0.01, sz * 0.044]], 0.02, 0.014, darkGold, { radial: 8, sub: 3 });
  }
  // Raised neck, broad bovine head, muzzle, and curved horns
  tube(OX, [[0.09, 0.062, 0], [0.135, 0.095, 0], [0.155, 0.12, 0]], 0.042, 0.032, gold, { radial: 10, sub: 3 });
  add(OX, SPH(12), giltMat, 0.168, 0.125, 0, 0.07, 0.058, 0.064);
  add(OX, SPH(10), giltMat, 0.205, 0.112, 0, 0.052, 0.04, 0.048);
  for (const sz of [-1, 1]) {
    tube(OX, [[0.155, 0.145, sz * 0.024], [0.145, 0.172, sz * 0.052], [0.17, 0.19, sz * 0.042]], 0.01, 0.003, darkGold, { radial: 7, sub: 3 });
    ell8(OX, gold, 0.15, 0.136, sz * 0.042, 0.008, 0.014, 0.022, 0, sz * 0.4);
    dot(OX, '#1a1410', 0.182, 0.13, sz * 0.026, 0.0045);
  }
  OX.traverse(o => { if ((o as THREE.Mesh).isMesh && o !== OX.children[OX.children.length - 1]) (o as THREE.Mesh).material = giltMat; });
  // 2. Carved Tangut Script Stele (西夏文残碑) on a tortoise/lotus base at back-right, with dense multi-stroke Tangut glyphs
  const SX = 0.19, SZ = -0.11;
  pbox(gp, stone, SX, Y, SZ, 0.14, 0.026, 0.08, (x, _y, z) => shade(stone, 0.9 + fbm(x * 35, 1, z * 35) * 0.2), 0.01);
  pbox(gp, '#34322e', SX, Y + 0.026, SZ, 0.11, 0.21, 0.032, (px, py, _pz, _nx, _ny, nz) => {
    if (Math.abs(nz) < 0.6 || Math.abs(px) > 0.044 || py < 0.018 || py > 0.185) return shade('#3a3834', 0.92 + fbm(px * 30, py * 30, 1) * 0.16);
    const gx = Math.floor((px + 0.044) / 0.011), gy = Math.floor((py - 0.018) / 0.011);
    return hash3(gx, gy, 19) > 0.35 ? '#c8bfa8' : '#2a2824';
  }, 0.004, -0.35);
  // 3. Movable-type printed Tangut sutra book (泥活字印本《吉祥遍至口合本续》) open on a wooden reading stand at front-right
  const BX = 0.18, BZ = 0.16;
  box(gp, wood, BX, Y, BZ, 0.12, 0.014, 0.09, -0.3);
  pbox(gp, '#e6dac0', BX, Y + 0.014, BZ, 0.11, 0.012, 0.08, (px, _py, pz, _nx, ny) => {
    if (ny < 0.5) return '#cbbca0';
    if (Math.abs(px) < 0.004) return '#5a4632';
    const col = Math.floor((px + 0.05) / 0.009), row = Math.floor((pz + 0.035) / 0.006);
    return Math.abs(px) < 0.046 && Math.abs(pz) < 0.032 && hash3(col, row, 7) > 0.42 ? '#241e1a' : '#e6dac0';
  }, 0.003, -0.3);
};

export const H_LIFE_CUSTOM2: Record<string, Builder> = {
  lf_muniu, lf_qixian, lf_lanting, lf_keju, lf_polo, lf_sancai, lf_yeyan, lf_washe, lf_kiln,
  lf_opera, lf_spinning, lf_nabo, lf_xixiawen,
};
