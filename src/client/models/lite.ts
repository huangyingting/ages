import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';

/**
 * Modelling primitives. Convention: a model is ~1 unit tall (or long), base at y = 0, front facing +z.
 * Static parts are merged by bakeStaticMeshes (pp-kit.ts); parts under a node named in ANIM_NAMES stay separate so the scene can animate them.
 */
export type Builder = (root: THREE.Group, r: ModelRecipe) => void;
export type V3 = [number, number, number];

/** Node names the scene animates (see scene/animate.ts). Subtrees under these names are never merged. */
export const ANIM_NAMES = ['spin', 'flap', 'flicker', 'sway', 'smoke', 'bob'] as const;
export type AnimName = typeof ANIM_NAMES[number];

export const C = {
  vermilion: '#b03a2e', red: '#c0392b', wood: '#8b5a2b', darkwood: '#5d3a1a', thatch: '#c8a96a', tile: '#3f4f5a',
  gold: '#d4a017', glaze: '#d9a520', stone: '#b3aba0', grey: '#8e9196', earth: '#a0825a', bronze: '#4f8a76', bronzeGold: '#b08d57',
  jade: '#7fb59a', paper: '#efe3c4', ink: '#2b2b2b', white: '#f2efe6', iron: '#4a4f55', steel: '#9aa3ab', sail: '#d8c7a0', water: '#4f86a6',
  skin: '#e0b48a', terracotta: '#a86b47', black: '#26262a', green: '#3f7d4e', blue: '#2e5f8a', smoke: '#d8d8d8',
} as const;

const mats = new Map<string, THREE.Material>();
export interface MatOpts { emissive?: boolean; opacity?: number; metal?: number; rough?: number; smooth?: boolean }
export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(o);
  let m = mats.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0.05, flatShading: !o.smooth });
    if (o.emissive) { m.emissive = new THREE.Color(color); m.emissiveIntensity = 1; m.toneMapped = false; }
    if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
    mats.set(k, m);
  }
  return m;
}

const geos = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geos.get(key) as T | undefined;
  if (!g) geos.set(key, (g = make()));
  return g;
}
const BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
const CYL = (s: number) => geo('cyl' + s, () => new THREE.CylinderGeometry(0.5, 0.5, 1, s));
const CONE = (s: number) => geo('cone' + s, () => new THREE.ConeGeometry(0.5, 1, s));
const SPH = (s: number) => geo('sph' + s, () => new THREE.SphereGeometry(0.5, s, Math.max(5, Math.round(s * 0.6))));

export function place(p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.set(rx, ry, rz);
  p.add(mesh);
  return mesh;
}

/** Axis-aligned box resting on y (its base is at y). */
export const box = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, o?: MatOpts) =>
  place(p, BOX(), mat(c, o), x, y + sy / 2, z, sx, sy, sz, ry);
/** Box centred on (x, y, z) with a full rotation. */
export const cbox = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0, o?: MatOpts) =>
  place(p, BOX(), mat(c, o), x, y, z, sx, sy, sz, ry, rx, rz);
export const cyl = (p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, h: number, s = 10, o?: MatOpts) =>
  place(p, CYL(s), mat(c, o), x, y + h / 2, z, r * 2, h, r * 2);
export const cone = (p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, h: number, s = 10, o?: MatOpts) =>
  place(p, CONE(s), mat(c, o), x, y + h / 2, z, r * 2, h, r * 2);
export const ball = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, o?: MatOpts) =>
  place(p, SPH(12), mat(c, o), x, y, z, sx, sy, sz);

/** A rod from a to b with radius r. */
export function rod(p: THREE.Object3D, c: string, a: V3, b: V3, r: number, s = 6, o?: MatOpts): THREE.Mesh {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = place(p, CYL(s), mat(c, o), 0, 0, 0, r * 2, len, r * 2);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

/** Surface of revolution from (radius, y) pairs. */
export function lathe(p: THREE.Object3D, c: string, pts: [number, number][], x = 0, y = 0, z = 0, seg = 16, o?: MatOpts): THREE.Mesh {
  const key = 'lathe' + seg + JSON.stringify(pts);
  const g = geo(key, () => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), seg));
  return place(p, g, mat(c, o), x, y, z, 1, 1, 1);
}

/** Extruded 2D outline (x, y) with depth d along z, centred on z. */
export function slab(p: THREE.Object3D, c: string, outline: [number, number][], d: number, x = 0, y = 0, z = 0, ry = 0, holes: [number, number][][] = [], o?: MatOpts): THREE.Mesh {
  const key = 'slab' + d + JSON.stringify(outline) + JSON.stringify(holes);
  const g = geo(key, () => {
    const s = new THREE.Shape(outline.map(([a, b]) => new THREE.Vector2(a, b)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
    const eg = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 });
    eg.translate(0, 0, -d / 2);
    return eg;
  });
  return place(p, g, mat(c, o), x, y, z, 1, 1, 1, ry);
}

/**
 * Chinese hip roof with upturned eaves: a frustum whose corners curl up. w × d footprint at height y, rise h,
 * overhang ov. The ridge is (1 - ridge) narrower than the eaves.
 */
export function roof(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, d: number, h: number, curl = 0.25, ridge = 0.3): THREE.Mesh {
  const key = `roof${w},${d},${h},${curl},${ridge}`;
  const g = geo(key, () => {
    const n = 6; // subdivisions per side for the sagging curve
    const pos: number[] = [];
    const eave = (t: number, side: number): V3 => {
      // point along the perimeter of the eave rectangle, side 0..3, t 0..1, with corners lifted
      const hw = w / 2, hd = d / 2;
      const corners: [number, number][] = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
      const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
      const lift = curl * h * (Math.pow(Math.abs(t * 2 - 1), 3));
      return [ax + (bx - ax) * t, lift, az + (bz - az) * t];
    };
    const top = (t: number, side: number): V3 => {
      const hw = (w / 2) * ridge, hd = (d / 2) * ridge * 0.15;
      const corners: [number, number][] = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
      const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
      return [ax + (bx - ax) * t, h, az + (bz - az) * t];
    };
    const mid = (a: V3, b: V3, sag: number): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const e0 = eave(t0, s), e1 = eave(t1, s), u0 = top(t0, s), u1 = top(t1, s);
        const m0 = mid(e0, u0, h * 0.12), m1 = mid(e1, u1, h * 0.12);
        pos.push(...e0, ...e1, ...m1, ...e0, ...m1, ...m0, ...m0, ...m1, ...u1, ...m0, ...u1, ...u0);
      }
    }
    // ridge cap
    const hw = (w / 2) * ridge, hd = (d / 2) * ridge * 0.15;
    pos.push(-hw, h, hd, hw, h, hd, hw, h, -hd, -hw, h, hd, hw, h, -hd, -hw, h, -hd);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // the winding above faces outward for sides 0..3 going counter-clockwise seen from above; make it double-sided-safe
    bg.computeVertexNormals();
    return bg;
  });
  const m = place(p, g, mat(c, { rough: 0.6 }), x, y, z, 1, 1, 1);
  (m.material as THREE.Material).side = THREE.DoubleSide;
  // ridge beam with end ornaments
  box(p, shadeHex(c, 0.7), x, y + h - 0.01, z, w * ridge * 1.05, h * 0.12, Math.max(0.03, d * 0.05));
  return m;
}

/** A simple gabled (A-frame) roof along x. */
export function gable(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, d: number, h: number, ry = 0): THREE.Mesh {
  return slab(p, c, [[-d / 2, 0], [d / 2, 0], [0, h]], w, x, y, z, ry + Math.PI / 2);
}

/** A standing person (robe, head, hat); ~0.5 tall at s = 1. */
export function person(p: THREE.Object3D, x: number, z: number, s: number, robe: string, hat: string | null = C.black, ry = 0, skin: string = C.skin): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.scale.setScalar(s);
  cone(g, robe, 0, 0, 0, 0.13, 0.36, 8);
  cyl(g, robe, 0, 0.22, 0, 0.07, 0.13, 8);
  ball(g, skin, 0, 0.4, 0, 0.11);
  if (hat) cyl(g, hat, 0, 0.45, 0, 0.06, 0.06, 8);
  p.add(g);
  return g;
}

/** Named group helper for animated parts. `data` lands in userData (e.g. axis, speed, phase). */
export function anim(p: THREE.Object3D, name: AnimName, x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  Object.assign(g.userData, data);
  p.add(g);
  return g;
}

/** A waving flag: a pole plus cloth segments that `flap`. */
export function flag(p: THREE.Object3D, x: number, y: number, z: number, h: number, color: string, w = h * 0.5, pole: string = C.darkwood): void {
  rod(p, pole, [x, y, z], [x, y + h, z], h * 0.015);
  let parent: THREE.Object3D = p;
  const n = 4;
  const segW = w / n, fh = w * 0.62;
  for (let i = 0; i < n; i++) {
    const seg = anim(parent, 'flap', i === 0 ? x : segW, i === 0 ? y + h - fh / 2 : 0, i === 0 ? z : 0, { phase: i * 0.7, amp: 0.25 + i * 0.08 });
    box(seg, color, segW / 2, -fh / 2, 0, segW, fh, h * 0.008);
    parent = seg;
  }
}

/** Smoke puffs that rise and fade (animated by the scene). */
export function smoke(p: THREE.Object3D, x: number, y: number, z: number, s = 0.12, color: string = C.smoke): void {
  const g = anim(p, 'smoke', x, y, z, { size: s });
  for (let i = 0; i < 5; i++) {
    const b = ball(g, color, 0, 0, 0, s, s, s, { opacity: 0.55, smooth: true });
    b.userData.puff = i / 5;
  }
}

/** A flickering flame (emissive cones). */
export function fire(p: THREE.Object3D, x: number, y: number, z: number, s = 0.1): void {
  const g = anim(p, 'flicker', x, y, z);
  cone(g, '#ff8a1e', 0, 0, 0, s * 0.6, s * 1.6, 6, { emissive: true });
  cone(g, '#ffd23f', 0, 0, 0, s * 0.35, s, 6, { emissive: true });
}

/** A spoked wheel in the yz plane (axle along x) that spins. */
export function wheel(p: THREE.Object3D, x: number, y: number, z: number, r: number, c: string = C.darkwood, spokes = 8, speed = 2): THREE.Group {
  const g = anim(p, 'spin', x, y, z, { axis: 'x', speed });
  const rim = new THREE.Mesh(geo('torus' + spokes, () => new THREE.TorusGeometry(1, 0.08, 4, 18)), mat(c));
  rim.scale.setScalar(r);
  rim.rotation.y = Math.PI / 2;
  g.add(rim);
  for (let i = 0; i < spokes / 2; i++) cbox(g, c, 0, 0, 0, r * 0.08, r * 2, r * 0.08, 0, (i / (spokes / 2)) * Math.PI);
  cyl(g, c, 0, -r * 0.1, 0, r * 0.18, r * 0.2, 8).rotation.z = Math.PI / 2;
  return g;
}

export function shadeHex(hex: string, f: number): string {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}
export const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
export const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
