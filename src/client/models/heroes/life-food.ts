import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, slab, rod, sweep, shade, hash3, panel, archPath, fbm, SPH, paintFaces,
} from '../prims.ts';
import { human, type HumanOpts, type HumanRig } from '../human.ts';
import { figure, type FigureOpts, type FigureAnchors } from '../figure.ts';
import { hall } from '../timber.ts';
import { horse } from '../animals.ts';

// Food & cooking dioramas ("tabletop" scale): a low round base (table top, mat, earth or stove) with the signature dish or
// vessel deliberately oversized so it reads from far away on the map, period vessels around it and usually a small cook or
// diner for scale. Hot food steams (rising 'smoke' puffs), fires flicker. Front faces +z, base at y = 0.

const TAU = Math.PI * 2;
const ANIM = new Set(['spin', 'flap', 'sway', 'bob', 'flicker', 'smoke']);
const Y = 0.04;

// ---- shared helpers -------------------------------------------------------------------------------------

function grp(p: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1): THREE.Group {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = ry;
  f.scale.setScalar(s);
  p.add(f);
  return f;
}
const dot = (p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, seg = 8) =>
  add(p, SPH(seg), mat(c), x, y, z, r * 2, r * 2, r * 2);
const ELG = () => g('lf-el', () => new THREE.SphereGeometry(1, 14, 10));
const el = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, ELG(), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
/** Glossy (sauced, glazed, lacquered) ellipsoid. */
const gloss = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, ELG(), mat(c, { flat: false, rough: 0.22, metal: 0.05 }), x, y, z, rx, ry, rz, roty, rotx, rotz);
const glow = (m: THREE.Mesh, c: string, e: string) => { m.material = mat(c, { emissive: e }); return m; };
const vcm = (rough?: number, metal?: number) => mat('#ffffff', { vc: true, flat: false, rough, metal });

/** Painted lathe (vertex colours): pts are [radius, y]. */
function plathe(p: THREE.Object3D, pts: [number, number][], base: string, paint: Paint | null, x: number, y: number, z: number, seg = 28, rough?: number, metal?: number): THREE.Mesh {
  const geo = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  return add(p, paintFaces(geo, base, paint ?? undefined), vcm(rough, metal), x, y, z, 1, 1, 1);
}
/** Interpolated outer radius of a profile at height h. */
function rAt(o: [number, number][], h: number): number {
  for (let i = 1; i < o.length; i++) if (o[i][1] >= h) { const [r0, y0] = o[i - 1], [r1, y1] = o[i]; return r0 + (r1 - r0) * ((h - y0) / ((y1 - y0) || 1)); }
  return o[o.length - 1][0];
}
/** Densify a profile so painted patterns have enough rows. */
function dense(o: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [o[0]];
  for (let i = 1; i < o.length; i++) {
    const [r0, y0] = o[i - 1], [r1, y1] = o[i], n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([r0 + (r1 - r0) * (k / n), y0 + (y1 - y0) * (k / n)]);
  }
  return out;
}
/**
 * Open vessel (bowl, jar, pot) with a wall of thickness t: outer profile from the foot [r, 0] up to the rim, then back
 * down the inside to a floor. Returns the mesh; contents go at `rAt(outer, h) - t`.
 */
function vessel(p: THREE.Object3D, outer: [number, number][], t: number, c: string, paint: Paint | null, x: number, y: number, z: number, seg = 28, rough?: number, metal?: number): THREE.Mesh {
  const floor = Math.max(t, outer[0][1] + t);
  const inner = outer.slice().reverse().map(([r, h]) => [Math.max(0.002, r - t), h] as [number, number]).filter(([, h]) => h > floor + 1e-4);
  return plathe(p, [[0, 0], ...outer, ...inner, [0, floor]], c, paint, x, y, z, seg, rough, metal);
}
/** Flat round surface (soup, grain, sauce) of radius r at height y. */
const fill = (p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, seg = 24, rough?: number) =>
  add(p, g('lf-fill' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg)), mat(c, { flat: false, rough }), x, y - 0.002, z, r, 0.004, r);
/** Heaped surface (grain, rice, sand) as a shallow dome. */
function heap(p: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, c: string, paint?: Paint, seg = 20): THREE.Mesh {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([r * Math.cos((t * Math.PI) / 2), h * Math.sin((t * Math.PI) / 2)]); }
  pts.push([0, h]);
  return plathe(p, [[0, 0], ...pts], c, paint ?? ((px, py, pz) => shade(c, 0.86 + hash3(Math.floor(px * 300), Math.floor(py * 300), Math.floor(pz * 300)) * 0.3)), x, y, z, seg);
}

/** Rising steam: a 'smoke' group (puffs pre-placed as a column for still renders). */
function steam(p: THREE.Object3D, x: number, y: number, z: number, size = 0.03, n = 6, c = '#f5f5f2', op = 0.34): THREE.Group {
  const s = grp(p, x, y, z);
  s.name = 'smoke';
  s.userData.size = size;
  for (let i = 0; i < n; i++) {
    const k = i / n, r = size * (0.5 + k * 1.4);
    add(s, g('lf-ico', () => new THREE.IcosahedronGeometry(1, 1)), mat(c, { transparent: op }), Math.sin(k * 5 + i) * size * 0.6, k * size * 7, Math.cos(k * 4 + i) * size * 0.4, r, r, r);
  }
  return s;
}
/** Wood fire: crossed logs, glowing embers and a flickering flame cluster (size s ≈ flame height). */
function fire(p: THREE.Object3D, x: number, y: number, z: number, s = 0.08, logs = true): void {
  if (logs) for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + 0.4;
    rod(p, [x + Math.cos(a) * s * 0.75, y + 0.006, z + Math.sin(a) * s * 0.75], [x - Math.cos(a) * s * 0.15, y + s * 0.2, z - Math.sin(a) * s * 0.15], s * 0.09, k % 2 ? '#4a2e1a' : '#5e3b22', 6);
  }
  glow(add(p, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#ff7a1a'), x, y + 0.004, z, s * 0.5, 0.008, s * 0.5), '#ff9440', '#ff4d00');
  const f = grp(p, x, y + 0.006, z);
  f.name = 'flicker';
  const CN = g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7));
  for (const [dx, dz, r, h, c, e] of [[0, 0, 0.42, 1, '#ff8a2a', '#ff5a00'], [0.18, 0.1, 0.25, 0.7, '#ff9a3a', '#ff6a10'], [-0.2, -0.05, 0.25, 0.75, '#ff9a3a', '#ff6a10'], [0, 0.04, 0.24, 0.62, '#ffe27a', '#ffc21a']] as const) {
    add(f, CN, mat(c, { emissive: e }), dx * s, (h * s) / 2, dz * s, r * s, h * s, r * s);
  }
}

/** Emissive meshes are not baked by kit.ts: merge them (outside animated groups) into one mesh per material. */
function fuse(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const kill: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    for (const ch of o.children) {
      if (ANIM.has(ch.name)) continue;
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        const mt = m.material as THREE.MeshStandardMaterial;
        if (!mt.transparent && mt.emissive && mt.emissive.getHex() !== 0) {
          let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
          if (!geo.getAttribute('normal')) geo.computeVertexNormals();
          geo = geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
          (buckets.get(mt) ?? buckets.set(mt, []).get(mt)!).push(geo);
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

/** Round base: a square grid top (cells 2R/n, so planks/tiles paint per cell) clipped to a circle, with a skirt. */
function base(gp: THREE.Object3D, paint: Paint, side = '#5a3e2a', R = 0.46, h = Y, n = 56): void {
  const cs = (R * 2) / n, pos: number[] = [];
  const clamp = (x: number, z: number): [number, number] => { const d = Math.hypot(x, z); return d > R ? [(x / d) * R, (z / d) * R] : [x, z]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -R + i * cs, z0 = -R + j * cs;
    if (Math.hypot(x0 + cs / 2, z0 + cs / 2) > R + cs * 0.75) continue;
    const a = clamp(x0, z0), b = clamp(x0 + cs, z0), c = clamp(x0 + cs, z0 + cs), d = clamp(x0, z0 + cs);
    pos.push(a[0], h, a[1], d[0], h, d[1], c[0], h, c[1], a[0], h, a[1], c[0], h, c[1], b[0], h, b[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  add(gp, paintFaces(geo, '#ffffff', paint), mat('#ffffff', { vc: true, flat: true, rough: 0.8 }), 0, 0, 0, 1, 1, 1);
  const sk = new THREE.CylinderGeometry(R, R * 0.97, h, 64, 1, true);
  sk.translate(0, h / 2, 0);
  add(gp, paintFaces(sk, side, (_x, y) => (y > h * 0.6 ? side : shade(side, 0.78))), mat('#ffffff', { vc: true, flat: true }), 0, 0, 0, 1, 1, 1);
}
const earth = (c: string, k = 22): Paint => (x, _y, z) => shade(c, 0.84 + fbm(x * k, 3, z * k, 3) * 0.3 + (hash3(Math.floor(x * 120), 1, Math.floor(z * 120)) > 0.93 ? -0.12 : 0));
/** Table planks running along x, width w. */
const planks = (c: string, w = 0.07): Paint => (x, _y, z) => {
  const k = Math.floor(z / w + 0.5), f = z / w + 0.5 - k;
  return shade(c, (f < 0.07 ? 0.72 : 1) * (0.9 + hash3(k, 2, 5) * 0.18 + (fbm(x * 6 + k * 3, k, z * 60, 2) - 0.5) * 0.22));
};
/** Woven reed / bamboo mat: alternating strips. */
const matting = (c: string, s = 0.018): Paint => (x, _y, z) => {
  const u = Math.floor(x / s), v = Math.floor(z / s), d = (u + v) % 2 === 0;
  return shade(c, (d ? 1.04 : 0.86) + hash3(u, v, 9) * 0.06);
};
/** Square floor tiles / flagstones of size s with grout lines. */
const tiles = (c: string, s = 0.07, run = true): Paint => (x, _y, z) => {
  const v = z / s, u = x / s + (run ? (Math.floor(v) % 2) * 0.5 : 0), fu = u - Math.floor(u), fv = v - Math.floor(v);
  if (fu < 0.08 || fv < 0.08) return shade(c, 0.74);
  return shade(c, 0.9 + hash3(Math.floor(u), 4, Math.floor(v)) * 0.18);
};

/** A detailed little person (unit-height hand targets, see human.ts). */
const who = (p: THREE.Object3D, x: number, y: number, z: number, o: Partial<HumanOpts> & { h: number; top: string }): HumanRig =>
  human(p, x, y, z, { detail: 'hi', skin: '#d9a77e', hair: '#1f1712', ...o });
/** Collectible figurine (period hats/outfits) — see figure.ts. */
const fig = (p: THREE.Object3D, o: FigureOpts): FigureAnchors => figure(p, { skin: '#e2b48c', hair: '#1c1714', ...o });

/** Low table with four legs; returns the top height. */
function table(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, c: string, ry = 0, leg = '#3a2416'): number {
  const t = grp(p, x, y, z, ry);
  rbox(t, c, 0, h - 0.016, 0, w, 0.016, d, 0.004);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(t, leg, sx * (w / 2 - 0.018), 0, sz * (d / 2 - 0.016), 0.016, h - 0.016, 0.016);
  return y + h;
}
/** Chopsticks pair. */
function chopsticks(p: THREE.Object3D, x: number, y: number, z: number, ry: number, c = '#6b3a1f', L = 0.12): void {
  const a = grp(p, x, y, z, ry);
  for (const dz of [-0.006, 0.006]) rod(a, [-L / 2, 0.003, dz], [L / 2, 0.003, dz * 0.4], 0.0022, c, 5);
}
/** Clay / brick cooking stove (灶) with a glowing fire mouth at the front; returns the top height. */
function stove(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, c = '#b9a48a', ry = 0, hole = 0): number {
  const s = grp(p, x, y, z, ry);
  rbox(s, c, 0, 0, 0, w, h, d, 0.01);
  rbox(s, shade(c, 0.8), 0, h - 0.008, 0, w + 0.012, 0.012, d + 0.012, 0.004);
  // brick courses on the front face
  for (let i = 1; i < 4; i++) box(s, shade(c, 0.82), 0, (h * i) / 4, d / 2 + 0.001, w * 0.98, 0.003, 0.002);
  box(s, '#2a1a12', 0, 0.012, d / 2 - 0.004, w * 0.36, h * 0.38, 0.012);
  glow(box(s, '#ff8a2a', 0, 0.014, d / 2 + 0.003, w * 0.3, h * 0.3, 0.004), '#ffa040', '#ff5a00');
  const f = grp(s, 0, 0.014, d / 2 - 0.01);
  f.name = 'flicker';
  for (const [dx, r, hh] of [[0, 0.018, 0.05], [-0.02, 0.012, 0.035], [0.02, 0.012, 0.035]] as const) add(f, g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7)), mat('#ffb347', { emissive: '#ff7a1a' }), dx, hh / 2, 0, r, hh, r);
  if (hole) cyl(s, '#1a1410', 0, h + 0.002, 0, hole, 0.002, 18);
  return y + h;
}
/** Bamboo steamer tray (蒸笼): open slatted ring; returns floor height. */
function steamerRing(p: THREE.Object3D, x: number, y: number, z: number, R: number, H: number): number {
  const bam = '#d6b26e';
  plathe(p, [[0, 0], [R, 0], [R, H], [R - 0.007, H], [R - 0.007, 0.006], [0, 0.006]], bam, (px, py, pz) => {
    if (py < 0.0065 && Math.hypot(px, pz) < R - 0.008) return Math.sin(px * 260) > 0.6 ? '#a8823e' : '#c9a35e';
    if (py > H - 0.006 || py < 0.006) return '#a07a3a';
    return hash3(Math.floor(Math.atan2(pz, px) * 30), 0, 0) > 0.85 ? '#c49a52' : bam;
  }, x, y, z, 32);
  return y + 0.006;
}
/** Bamboo steamer lid: shallow dome with woven rings. */
function steamerLid(p: THREE.Object3D, x: number, y: number, z: number, R: number, rx = 0, rz = 0): void {
  const l = plathe(p, [[0, 0.03], [R * 0.6, 0.025], [R, 0.012], [R, 0], [R - 0.006, 0], [R - 0.006, 0.01], [0, 0.022]], '#d4ae68', (px, py, pz) => {
    const r = Math.hypot(px, pz);
    return r > R - 0.007 ? '#a07a3a' : Math.sin(r * 300) > 0.4 ? '#b88f4c' : null;
  }, x, y, z, 32);
  l.rotation.set(rx, 0, rz);
}

/** Pleated crescent dumpling (饺子) of length ≈2s, belly toward +z. */
function jiaozi(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, c = '#f5f0e2'): void {
  const d = grp(p, x, y, z, ry);
  const st = [], top: V3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, a = (t - 0.5) * 2.3, k = Math.sin(t * Math.PI);
    const px = Math.sin(a) * s, pz = Math.cos(a) * s * 0.55 - s * 0.35;
    st.push({ p: [px, s * 0.22 * (0.4 + 0.6 * k), pz] as V3, w: s * (0.12 + 0.3 * k), h: s * (0.1 + 0.26 * k) });
    top.push([px, s * 0.22 * (0.4 + 0.6 * k) + s * (0.1 + 0.26 * k) * 0.95, pz - s * 0.03 * k]);
  }
  sweep(d, st, c, { radial: 10, sub: 3, squash: 0.45 });
  sweep(d, top.map((q, i) => ({ p: q, w: s * 0.05 * (0.5 + Math.sin((i / 6) * Math.PI)), h: s * 0.07 })), shade(c, 0.97), { radial: 6, sub: 3, paint: (px) => (Math.sin(px * 180 / s * 0.06) > 0.2 ? shade(c, 0.86) : null) });
}

/** Pottery paint helper: angle around the axis. */
const ang = (x: number, z: number) => Math.atan2(z, x);

// ---------------------------------------------------------------------------------------------------------
// PALAEOLITHIC FORAGING — leaf-littered earth: a coiled basket heaped with nuts, berries and roots, river fish
// roasting on sticks over a stone-ringed fire, a grinding slab with hand-stone and meal, shells, and a forager
// in hides crouching at the slab.
// ---------------------------------------------------------------------------------------------------------
function fish(p: THREE.Object3D, c: string, belly: string): void {
  // along +x (head), centred at the origin, length ≈0.1
  sweep(p, [
    { p: [-0.05, 0, 0], w: 0.003, h: 0.006 }, { p: [-0.03, 0, 0], w: 0.008, h: 0.014 }, { p: [0, 0, 0], w: 0.012, h: 0.022 },
    { p: [0.03, 0.001, 0], w: 0.01, h: 0.018 }, { p: [0.05, 0, 0], w: 0.004, h: 0.008 },
  ], c, { radial: 10, sub: 3, up: [0, 0, 1], paint: (_x, y) => (y < -0.004 ? belly : null) });
  const t = slab(p, [[-0.048, 0], [-0.075, 0.018], [-0.068, 0], [-0.075, -0.018]], 0.002, shade(c, 0.85), 0, false);
  t.rotation.x = Math.PI / 2;
  dot(p, '#111', 0.04, 0.007, 0.004, 0.0025, 5);
  dot(p, '#111', 0.04, 0.007, -0.004, 0.0025, 5);
}
function onStick(p: THREE.Object3D, a: V3, b: V3, t: number, c: string, belly: string): void {
  rod(p, a, b, 0.0035, '#6b4a2a', 5);
  const f = new THREE.Group();
  f.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  f.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize());
  f.scale.setScalar(1.8);
  p.add(f);
  fish(f, c, belly);
}
const lf_forage: Builder = gp => {
  base(gp, (x, y, z, nx, ny, nz) => {
    const leaf = hash3(Math.floor(x * 70), 5, Math.floor(z * 70));
    if (leaf > 0.95) return ['#8a6a3a', '#7a5228', '#9a7a44'][Math.floor(leaf * 100) % 3];
    return earth('#6e5236', 18)(x, y, z, nx, ny, nz);
  }, '#4a3626');
  // coiled basket heaped with nuts, berries and roots
  const B = grp(gp, -0.17, Y, 0.06);
  const bo: [number, number][] = [[0.07, 0], [0.1, 0.025], [0.125, 0.07], [0.13, 0.1]];
  vessel(B, dense(bo, 0.01), 0.008, '#a8844c', (x, y, z) => {
    const u = Math.floor(((ang(x, z) + Math.PI) / TAU) * 40), v = Math.floor(y / 0.011);
    return y > 0.094 ? '#7a5a2e' : (u + v) % 2 ? '#b8935a' : '#8e6c3a';
  }, 0, 0, 0, 40);
  heap(B, 0, 0.085, 0, 0.12, 0.05, '#6b4524');
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4, r = 0.02 + ((i * 37) % 10) / 10 * 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r, yy = 0.086 + 0.05 * Math.cos((r / 0.12) * Math.PI / 2);
    if (i % 3 === 0) dot(B, i % 2 ? '#c8182a' : '#5a1838', x, yy + 0.01, z, 0.014, 8);
    else { el(B, '#9a6432', x, yy + 0.01, z, 0.018, 0.015, 0.018); el(B, '#5a3a1c', x, yy + 0.022, z, 0.015, 0.007, 0.015); }
  }
  for (const [a, l] of [[0.6, 0.12], [2.2, 0.1], [4.0, 0.11]] as const) {
    const sx = Math.cos(a) * 0.05, sz = Math.sin(a) * 0.05;
    sweep(B, [{ p: [sx, 0.12, sz], w: 0.014 }, { p: [sx * 2, 0.13, sz * 2], w: 0.011 }, { p: [sx * 2 + Math.cos(a) * l * 0.5, 0.1, sz * 2 + Math.sin(a) * l * 0.5], w: 0.006 }], '#b86a32', { radial: 8, sub: 3 });
  }
  // stone hearth with fish on sticks
  const fx = 0.16, fz = 0.02;
  for (let k = 0; k < 9; k++) { const a = k * TAU / 9; el(gp, k % 2 ? '#7d776c' : '#8f897d', fx + Math.cos(a) * 0.075, Y + 0.012, fz + Math.sin(a) * 0.075, 0.025, 0.018, 0.022, a); }
  fill(gp, '#3a3430', fx, Y + 0.002, fz, 0.065, 16);
  fire(gp, fx, Y, fz, 0.075);
  onStick(gp, [0.33, Y, 0.16], [0.13, Y + 0.2, -0.0], 0.62, '#7a8a8c', '#e0d8c4');
  onStick(gp, [0.32, Y, -0.13], [0.12, Y + 0.18, 0.06], 0.62, '#8a7a5a', '#e8dcc0');
  // grinding slab with hand-stone and meal; forager in hides crouching behind it
  const sz0 = -0.18;
  el(gp, '#8c867a', 0.0, Y + 0.008, sz0, 0.14, 0.03, 0.085);
  el(gp, '#9a948a', 0.0, Y + 0.026, sz0, 0.12, 0.012, 0.07);
  heap(gp, -0.06, Y + 0.034, sz0 + 0.01, 0.035, 0.012, '#d8c69c');
  el(gp, '#6f6a62', 0.03, Y + 0.05, sz0 + 0.01, 0.04, 0.02, 0.028, 0.3);
  for (let i = 0; i < 5; i++) el(gp, '#7a4a24', 0.09 + (i % 3) * 0.02, Y + 0.04, sz0 - 0.02 + Math.floor(i / 3) * 0.02, 0.009, 0.008, 0.009);
  who(gp, 0.01, Y, -0.34, { h: 0.34, pose: 'crouch', top: '#7a5a3a', bottom: '#6a4c30', sleeve: 0, shorts: true, skin: '#b5835c', hair: '#241a12', build: 1.08,
    hands: [[-0.05, 0.15, 0.38], [0.09, 0.15, 0.4]] });
  // shells and a bone at the front
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, x = 0.08 + Math.cos(a) * 0.06 + i * 0.012, z = 0.3 + Math.sin(a) * 0.04;
    const sh = add(gp, g('lf-dome', () => new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2)), mat(i % 2 ? '#e8d6c0' : '#d8b8a8', { flat: false }), x, Y, z, 0.022, 0.012, 0.026, a);
    sh.material = vcm();
    sh.geometry = paintFaces(sh.geometry.clone(), i % 2 ? '#e8d6c0' : '#d8b8a8', (px, _py, pz) => (Math.sin(Math.atan2(pz, px) * 9) > 0.5 ? (i % 2 ? '#c9a78a' : '#b88c7c') : null));
  }
  for (let i = 0; i < 3; i++) cone(gp, '#c4a47a', -0.06 + i * 0.03, Y, 0.34 - i * 0.015, 0.011, 0.03, 8).rotation.z = 1.4;
  rod(gp, [-0.32, Y + 0.008, 0.22], [-0.2, Y + 0.008, 0.3], 0.007, '#e6dcc4', 6);
  for (const e of [[-0.32, 0.22], [-0.2, 0.3]] as const) el(gp, '#e6dcc4', e[0], Y + 0.01, e[1], 0.014, 0.01, 0.012);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// YANGSHAO PAINTED POTTERY & MILLET — loess ground: the Banpo face-and-fish basin (人面鱼纹盆) propped on a stand,
// a black-painted Majiayao jar, a pointed-bottom amphora, a jar heaped with yellow millet, drooping millet plants,
// and a woman grinding grain on a footed saddle quern.
// ---------------------------------------------------------------------------------------------------------
const RED = '#b4532c', INK = '#221510';
/** Banpo basin interior painter: two faces (up = −z) and two net-fish, rim dashes. */
const banpo: Paint = (x, y, z, nx, ny, nz) => {
  const r = Math.hypot(x, z);
  if (ny > 0.8 && r > 0.165) return Math.floor(((ang(x, z) + Math.PI) / TAU) * 32) % 4 === 0 ? INK : null;
  const inside = nx * x + nz * z < -0.0001 * r || (ny > 0.95 && r < 0.15);
  if (!inside) return null;
  for (const cz of [-0.085, 0.085]) {
    const u = x, v = -(z - cz), rf = 0.042, d = Math.hypot(u, v);
    if (d < rf) {
      if (d > rf * 0.88) return INK;
      if (v > rf * 0.35 && !(Math.abs(u) < rf * 0.22 && v < rf * 0.7)) return INK;
      if (Math.abs(v - rf * 0.05) < rf * 0.08 && Math.abs(u) > rf * 0.18 && Math.abs(u) < rf * 0.6) return INK;
      if (Math.abs(u) < rf * 0.06 && v < rf * 0.05 && v > -rf * 0.3) return INK;
      if (v < -rf * 0.42 && Math.abs(u) < rf * 0.6) return INK;
      return null;
    }
    if (v > rf * 0.8 && v < rf * 1.7 && Math.abs(u) < (rf * 1.7 - v) * 0.8) return INK;
    // fish swimming out of the mouth corners and ears
    const su = Math.abs(u);
    if (su > rf * 0.9 && su < rf * 1.9 && Math.abs(v + rf * 0.45 + (su - rf) * 0.55) < rf * 0.13 * (1.9 - su / rf)) return INK;
    if (su > rf * 0.95 && su < rf * 1.35 && Math.abs(v - rf * 0.15) < rf * 0.09) return INK;
  }
  for (const cx of [-0.095, 0.095]) {
    const u = z, v = x - cx, L = 0.06, W = 0.022;
    const q = Math.abs(u) / L + Math.abs(v) / W;
    if (q < 1) {
      if (q > 0.82) return INK;
      if (u * Math.sign(cx) > L * 0.45) return INK;
      return Math.sin((u + v) * 260) > 0.55 || Math.sin((u - v) * 260) > 0.55 ? INK : null;
    }
    const tu = u * Math.sign(cx);
    if (tu < -L && tu > -L * 1.35 && Math.abs(v) < (-L - tu) * 0.9) return INK;
  }
  return null;
};
function millet(p: THREE.Object3D, x: number, z: number, h: number, a: number): void {
  const top: V3 = [x + Math.cos(a) * 0.02, Y + h, z + Math.sin(a) * 0.02];
  sweep(p, [{ p: [x, Y, z], w: 0.004 }, { p: [x + Math.cos(a) * 0.01, Y + h * 0.6, z + Math.sin(a) * 0.01], w: 0.0035 }, { p: top, w: 0.003 }], '#8a9a3a', { radial: 5, sub: 3 });
  for (const [k, s] of [[0.3, 1], [0.55, -1]] as const) {
    const lx = x + Math.cos(a + s) * 0.01, lz = z + Math.sin(a + s) * 0.01, ly = Y + h * k;
    sweep(p, [{ p: [lx, ly, lz], w: 0.005, h: 0.0012 }, { p: [lx + Math.cos(a + s) * 0.05, ly + 0.04, lz + Math.sin(a + s) * 0.05], w: 0.007, h: 0.0012 }, { p: [lx + Math.cos(a + s) * 0.09, ly + 0.02, lz + Math.sin(a + s) * 0.09], w: 0.002, h: 0.001 }], '#7f9a3a', { radial: 4, sub: 3 });
  }
  const d = [Math.cos(a), Math.sin(a)];
  sweep(p, [
    { p: top, w: 0.008 }, { p: [top[0] + d[0] * 0.035, top[1] + 0.015, top[2] + d[1] * 0.035], w: 0.014 },
    { p: [top[0] + d[0] * 0.07, top[1] - 0.02, top[2] + d[1] * 0.07], w: 0.014 }, { p: [top[0] + d[0] * 0.08, top[1] - 0.07, top[2] + d[1] * 0.08], w: 0.006 },
  ], '#d6a83c', { radial: 8, sub: 4, paint: (px, py, pz) => (hash3(Math.floor(px * 400), Math.floor(py * 400), Math.floor(pz * 400)) > 0.6 ? '#c08a2a' : null) });
}
const lf_pottery: Builder = gp => {
  base(gp, earth('#c49a62', 16), '#8a6440');
  // Banpo basin on a wooden prop, tilted toward the viewer
  const sx = 0.1, sz = -0.13;
  for (const dx of [-0.07, 0.07]) rod(gp, [sx + dx, Y, sz - 0.05], [sx + dx, Y + 0.09, sz - 0.03], 0.008, '#6b4a2a', 6);
  rod(gp, [sx - 0.09, Y + 0.09, sz - 0.03], [sx + 0.09, Y + 0.09, sz - 0.03], 0.007, '#6b4a2a', 6);
  const Bn = grp(gp, sx, Y + 0.035, sz + 0.03);
  Bn.rotation.x = 0.85;
  vessel(Bn, dense([[0.07, 0], [0.11, 0.012], [0.15, 0.04], [0.162, 0.062], [0.19, 0.07]], 0.006), 0.007, RED, banpo, 0, 0, 0, 96, 0.75);
  // painted jar with black sawtooth and swirl bands
  const J = grp(gp, -0.3, Y, -0.14);
  vessel(J, dense([[0.045, 0], [0.08, 0.03], [0.11, 0.09], [0.1, 0.14], [0.06, 0.175], [0.045, 0.185], [0.052, 0.2]], 0.008), 0.006, '#c0643a', (x, y, z) => {
    const a = (ang(x, z) + Math.PI) / TAU;
    if (y > 0.185) return INK;
    if (Math.abs(y - 0.088) < 0.004 || Math.abs(y - 0.17) < 0.004) return INK;
    if (y > 0.09 && y < 0.168) { const f = (a * 10) % 1, t = (y - 0.09) / 0.078; if (Math.abs(f - 0.5) * 2 < t * 0.9 - 0.15 && Math.abs(f - 0.5) * 2 > t * 0.9 - 0.4) return INK; if (Math.hypot(f - 0.5, t - 0.2) < 0.08) return INK; }
    if (y > 0.05 && y < 0.085 && Math.sin(a * TAU * 18 + y * 200) > 0.6) return INK;
    return null;
  }, 0, 0, 0, 48, 0.7);
  for (const s of [-1, 1]) add(J, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#c0643a'), s * 0.105, 0.08, 0, 0.018, 0.018, 0.018, 0, Math.PI / 2, s * Math.PI / 2);
  // pointed-bottom amphora (尖底瓶) leaning in the earth
  const A = grp(gp, 0.36, Y - 0.02, 0.0);
  A.rotation.z = 0.22;
  plathe(A, [[0, 0], [0.018, 0.03], [0.042, 0.11], [0.05, 0.17], [0.045, 0.23], [0.022, 0.27], [0.016, 0.3], [0.024, 0.31], [0.012, 0.315], [0, 0.315]], '#b65a32', (x, y, z) => (Math.sin(y * 260 + ang(x, z) * 6) > 0.7 ? '#9a4a28' : null), 0, 0, 0, 20);
  for (const s of [-1, 1]) add(A, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#b65a32'), s * 0.05, 0.15, 0, 0.012, 0.012, 0.012, 0, Math.PI / 2, s * Math.PI / 2);
  // millet jar heaped with grain, a spill and a scoop
  const M = grp(gp, 0.22, Y, 0.2);
  const mo: [number, number][] = [[0.05, 0], [0.085, 0.04], [0.095, 0.08], [0.085, 0.11], [0.09, 0.12]];
  vessel(M, mo, 0.007, '#8a7a6a', (x, y, z) => (Math.abs(y - 0.1) < 0.004 || (y < 0.09 && Math.sin(y * 300 + ang(x, z) * 3) > 0.85) ? '#6a5a4a' : null), 0, 0, 0, 30);
  heap(M, 0, 0.105, 0, 0.083, 0.045, '#e3bd45');
  heap(gp, 0.1, Y, 0.3, 0.06, 0.02, '#e3bd45');
  const sc = grp(gp, 0.08, Y + 0.014, 0.3, 0.6);
  vessel(sc, [[0.015, 0], [0.025, 0.012], [0.028, 0.02]], 0.003, '#7a5a3a', null, 0, 0, 0, 14);
  rod(sc, [0.025, 0.014, 0], [0.07, 0.03, 0], 0.004, '#6b4a2a', 5);
  // millet plants
  for (let i = 0; i < 6; i++) millet(gp, -0.38 + (i % 3) * 0.07, -0.02 + Math.floor(i / 3) * 0.07 + (i % 2) * 0.02, 0.24 + (i % 3) * 0.03, -0.6 + i * 0.9);
  // footed saddle quern with roller; woman kneeling to grind
  const Q = grp(gp, -0.1, Y, 0.2);
  for (const qx of [-0.08, 0.08]) for (const qz of [-0.025, 0.025]) cyl(Q, '#7d766a', qx, 0, qz, 0.01, 0.022, 7);
  rbox(Q, '#8e877b', 0, 0.02, 0, 0.22, 0.022, 0.08, 0.008);
  heap(Q, -0.07, 0.042, 0, 0.03, 0.01, '#ead79a');
  const roll = cyl(Q, '#6e685e', 0.02, 0.052, 0, 0.011, 0.11, 10);
  roll.rotation.x = Math.PI / 2;
  roll.position.set(0.02, 0.054, 0);
  for (let i = 0; i < 8; i++) dot(Q, '#e3bd45', -0.05 + i * 0.012, 0.043, (i % 3 - 1) * 0.015, 0.004, 5);
  who(gp, -0.1, Y, 0.04, { h: 0.32, pose: 'kneel', top: '#a8875e', bottom: '#8a6c48', dress: 'knee', skin: '#c99068', hair: '#1c140e', lean: 0.35,
    hands: [[-0.07, 0.25, 0.44], [0.07, 0.25, 0.44]] });
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// RICE PADDIES (稻作) — mirror-flat flooded plots split by earth bunds; rows of green seedlings, a raised back
// terrace of golden ripe rice, a farmer in a straw hat bent to transplant, a water buffalo. style 'modern' swaps
// the buffalo for a hybrid-rice test plot sign and an agronomist in a white shirt (袁隆平) holding up an ear.
// ---------------------------------------------------------------------------------------------------------
function clipRect(x0: number, x1: number, z0: number, z1: number, R: number): [number, number][] {
  const pts: [number, number][] = [], n = 14;
  const side = (ax: number, az: number, bx: number, bz: number) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t]); } };
  side(x0, z0, x1, z0); side(x1, z0, x1, z1); side(x1, z1, x0, z1); side(x0, z1, x0, z0);
  return pts.map(([x, z]) => { const d = Math.hypot(x, z); return d > R ? [(x / d) * R, (z / d) * R] : [x, z]; });
}
function water(p: THREE.Object3D, plan: [number, number][], y: number, c = '#7fb0c0'): void {
  const pts = plan.map(([x, z]) => new THREE.Vector2(x, -z));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
  geo.rotateX(-Math.PI / 2);
  add(p, paintFaces(geo, c), mat('#ffffff', { vc: true, rough: 0.06, metal: 0.35 }), 0, y, 0, 1, 1, 1);
}
function buffalo(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number): void {
  const b = grp(p, x, y, z, ry, s);
  const C = '#43434a', D = '#2e2e33';
  sweep(b, [{ p: [0, 0.2, -0.19], w: 0.06, h: 0.06 }, { p: [0, 0.22, -0.1], w: 0.09, h: 0.09 }, { p: [0, 0.23, 0.04], w: 0.095, h: 0.095 }, { p: [0, 0.24, 0.13], w: 0.08, h: 0.085 }, { p: [0, 0.22, 0.18], w: 0.05, h: 0.06 }], C, { radial: 12, sub: 4, squash: 0.85 });
  for (const [lx, lz] of [[-0.05, -0.15], [0.05, -0.15], [-0.055, 0.11], [0.055, 0.11]] as const) sweep(b, [{ p: [lx, 0.2, lz], w: 0.026 }, { p: [lx, 0.1, lz + 0.005], w: 0.018 }, { p: [lx, 0.0, lz], w: 0.014 }], D, { radial: 7, sub: 2 });
  // head hanging low and forward, with crescent horns swept back
  sweep(b, [{ p: [0, 0.23, 0.17], w: 0.045 }, { p: [0, 0.2, 0.24], w: 0.04 }, { p: [0, 0.16, 0.29], w: 0.032, h: 0.036 }], C, { radial: 10, sub: 3 });
  el(b, '#2a2a2e', 0, 0.15, 0.31, 0.03, 0.026, 0.022);
  for (const sx of [-1, 1]) {
    sweep(b, [{ p: [sx * 0.025, 0.21, 0.25], w: 0.014 }, { p: [sx * 0.09, 0.23, 0.23], w: 0.012 }, { p: [sx * 0.13, 0.25, 0.16], w: 0.009 }, { p: [sx * 0.1, 0.28, 0.1], w: 0.004 }], '#6e6458', { radial: 7, sub: 4 });
    el(b, '#2a2a2e', sx * 0.045, 0.2, 0.24, 0.02, 0.01, 0.012, 0, 0, sx * 0.4);
    dot(b, '#0d0d0f', sx * 0.03, 0.19, 0.28, 0.006, 6);
  }
  sweep(b, [{ p: [0, 0.23, -0.19], w: 0.008 }, { p: [0, 0.16, -0.22], w: 0.006 }, { p: [0.01, 0.1, -0.22], w: 0.004 }], C, { radial: 5, sub: 3 });
}
const lf_rice: Builder = (gp, r) => {
  const modern = r.style === 'modern';
  base(gp, earth('#6e5a3e', 20), '#4e3c28');
  const R = 0.43, W = Y + 0.012;
  // back terrace (raised) with golden rice
  const T = clipRect(-0.5, 0.5, -0.5, -0.12, R + 0.01);
  const tp = add(gp, new THREE.ExtrudeGeometry(new THREE.Shape(T.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 0.07, bevelEnabled: false }), mat('#6a5236'), 0, Y, 0, 1, 1, 1);
  tp.rotation.x = -Math.PI / 2;
  water(gp, clipRect(-0.5, 0.5, -0.5, -0.135, R - 0.01), Y + 0.065, '#8a9a7a');
  for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) {
    const x = -0.36 + i * 0.065 + (j % 2) * 0.02, z = -0.17 - j * 0.05;
    if (Math.hypot(x, z) > R - 0.04) continue;
    const yy = Y + 0.066, k = hash3(i, j, 3);
    cone(gp, '#b8a040', x, yy, z, 0.014, 0.09 + k * 0.02, 5);
    el(gp, k > 0.5 ? '#e0b43a' : '#d4a332', x + 0.012, yy + 0.08, z + 0.01, 0.01, 0.022, 0.01, 0, 0.3, -0.5);
    el(gp, '#e6bd48', x - 0.01, yy + 0.085, z - 0.006, 0.008, 0.02, 0.008, 0, -0.2, 0.5);
  }
  // bunds and flooded plots
  box(gp, '#7a6242', 0.04, Y, 0.12, 0.03, 0.022, 0.62);
  water(gp, clipRect(-0.5, 0.025, -0.12, 0.5, R), W);
  water(gp, clipRect(0.055, 0.5, -0.12, 0.5, R), W, '#86b4c2');
  // edge lip
  add(gp, new THREE.TorusGeometry(R + 0.008, 0.012, 6, 64), mat('#6e5a3e'), 0, Y + 0.004, 0, 1, 1, 1, 0, Math.PI / 2);
  // seedling rows in the left plot (the front row still bare where the farmer works)
  for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) {
    const x = -0.37 + i * 0.048, z = -0.09 + j * 0.052;
    if (Math.hypot(x, z) > R - 0.03 || (z > 0.2 && x > -0.2)) continue;
    const k = hash3(i, j, 1);
    cone(gp, k > 0.5 ? '#5aa03a' : '#4c9234', x, W - 0.004, z, 0.008, 0.05 + k * 0.015, 4);
    cone(gp, '#68b046', x + 0.004, W - 0.004, z + 0.002, 0.006, 0.04, 4).rotation.z = -0.3;
  }
  // farmer bent over, planting, with a bundle of seedlings
  const rig = who(gp, -0.1, Y, 0.27, { h: 0.3, ry: -0.3, pose: 'stand', lean: 1.0, hipY: 0.47, top: '#5a7a96', bottom: '#2e3440', shorts: true, sleeve: 0.45, skin: '#a8754e', hat: '#d8bf7a', hatStyle: 'conical',
    feet: [[-0.08, 0.032, 0.06], [0.08, 0.032, -0.04]], hands: [[-0.06, 0.18, 0.36], [0.06, 0.1, 0.42]] });
  const [hx, hy, hz] = rig.handL;
  for (let k = 0; k < 5; k++) rod(gp, [hx, hy, hz], [hx - 0.015 + k * 0.008, hy + 0.05, hz - 0.01], 0.003, '#5aa03a', 4);
  for (let k = 0; k < 4; k++) cone(gp, '#5aa03a', -0.15 + k * 0.035, W - 0.004, 0.33 - k * 0.01, 0.008, 0.045, 4);
  if (modern) {
    rod(gp, [0.18, Y, -0.02], [0.18, Y + 0.2, -0.02], 0.006, '#e6e2d8', 6);
    rbox(gp, '#f4f2ea', 0.18, Y + 0.13, -0.015, 0.16, 0.08, 0.008, 0.003);
    box(gp, '#b91c1c', 0.18, Y + 0.198, -0.009, 0.16, 0.012, 0.002);
    for (let k = 0; k < 6; k++) box(gp, k < 4 ? '#b91c1c' : '#1f2937', 0.12 + (k % 4) * 0.035, Y + 0.165 - Math.floor(k / 4) * 0.03, -0.009, k < 4 ? 0.024 : 0.06, k < 4 ? 0.022 : 0.006, 0.002);
    const y2 = who(gp, 0.26, Y, 0.12, { h: 0.33, ry: -0.4, pose: 'stand', top: '#f4f4f0', bottom: '#5a5a58', sleeve: 0.45, skin: '#b8865e', hair: '#9a9a96', shoes: '#3a2a1a',
      hands: [[-0.12, 0.47, 0.05], [0.08, 0.72, 0.2]] });
    const [ex, ey, ez] = y2.handR;
    rod(gp, [ex, ey - 0.01, ez], [ex + 0.01, ey + 0.06, ez], 0.002, '#b89a30', 4);
    el(gp, '#e0b43a', ex + 0.016, ey + 0.065, ez, 0.008, 0.02, 0.008, 0, 0, -0.5);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = 0.14 + i * 0.06, z = 0.16 + j * 0.055;
      if (Math.hypot(x, z) > R - 0.04 || (x > 0.2 && z < 0.2)) continue;
      cone(gp, '#3f8a2c', x, W - 0.004, z, 0.012, 0.08, 4);
      el(gp, '#d4b23a', x + 0.008, W + 0.07, z, 0.006, 0.016, 0.006, 0, 0, -0.4);
    }
  } else {
    buffalo(gp, 0.22, W - 0.012, 0.12, -0.6, 0.55);
    // a few seedling bundles waiting in the right plot
    for (const [bx, bz] of [[0.12, 0.33], [0.3, 0.26]] as const) for (let k = 0; k < 4; k++) rod(gp, [bx, W, bz], [bx - 0.012 + k * 0.008, W + 0.05, bz + 0.004], 0.0035, '#5aa03a', 4);
  }
};

// ---------------------------------------------------------------------------------------------------------
// GRAIN WINE BREWING (杜康酿酒) — courtyard of big cloth-sealed fermentation jars, an open vat of mash stirred by the
// brewer, a wooden steamer over a stove for the grain, bronze jue cups on a low table and heaps of sorghum & millet.
// ---------------------------------------------------------------------------------------------------------
function jue(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const j = grp(p, x, y, z, ry, s), C = '#8c7a46';
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + Math.PI / 2; rod(j, [Math.cos(a) * 0.012, 0.035, Math.sin(a) * 0.012], [Math.cos(a) * 0.026, 0, Math.sin(a) * 0.026], 0.0025, C, 4); }
  vessel(j, [[0.012, 0.03], [0.016, 0.045], [0.017, 0.07], [0.02, 0.078]], 0.002, C, (_x, yy) => (Math.abs(yy - 0.055) < 0.006 ? '#55583a' : null), 0, 0, 0, 16, 0.4, 0.5);
  sweep(j, [{ p: [0.012, 0.075, 0], w: 0.008, h: 0.004 }, { p: [0.035, 0.078, 0], w: 0.007, h: 0.004 }, { p: [0.05, 0.083, 0], w: 0.004, h: 0.002 }], C, { radial: 6, sub: 2, squash: 0.2 });
  cone(j, C, -0.025, 0.074, 0, 0.006, 0.012, 5).rotation.z = Math.PI / 2;
  for (const sz of [-1, 1]) { rod(j, [0.008, 0.077, sz * 0.012], [0.008, 0.092, sz * 0.012], 0.0015, C, 4); dot(j, C, 0.008, 0.094, sz * 0.012, 0.004, 6); }
  add(j, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat(C), 0, 0.055, -0.017, 0.01, 0.01, 0.01, Math.PI / 2, 0, -Math.PI / 2);
}
function sealedJar(p: THREE.Object3D, x: number, z: number, s: number, cloth: string): void {
  const j = grp(p, x, Y, z, 0, s);
  const jo: [number, number][] = [[0.07, 0], [0.11, 0.04], [0.135, 0.12], [0.125, 0.19], [0.08, 0.235], [0.065, 0.25]];
  plathe(j, [[0, 0], ...dense(jo, 0.02), [0, 0.25]], '#6a4630', (xx, y, zz) => (y < 0.06 ? '#9a6a46' : Math.abs(y - 0.17) < 0.004 || Math.abs(y - 0.1) < 0.003 ? '#4e3220' : null), 0, 0, 0, 30, 0.45);
  plathe(j, [[0, 0.278], [0.05, 0.272], [0.085, 0.25], [0.1, 0.22], [0.112, 0.175], [0.104, 0.172], [0.085, 0.215], [0, 0.25]], cloth, (xx, _y, zz) => (Math.sin(ang(xx, zz) * 11) > 0.6 ? shade(cloth, 0.86) : null), 0, 0, 0, 24);
  add(j, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#6a4a28'), 0, 0.236, 0, 0.083, 0.083, 0.083, 0, Math.PI / 2);
}
const lf_wine: Builder = gp => {
  base(gp, tiles('#9a8a72', 0.082), '#5e4a36');
  sealedJar(gp, -0.3, -0.22, 1, '#d8ccb0');
  sealedJar(gp, -0.06, -0.3, 1.05, '#b0402c');
  sealedJar(gp, -0.37, 0.05, 0.85, '#b0402c');
  // open mash vat being stirred
  const V = grp(gp, -0.12, Y, 0.05);
  const vo: [number, number][] = [[0.07, 0], [0.11, 0.04], [0.13, 0.1], [0.125, 0.15], [0.13, 0.16]];
  vessel(V, dense(vo, 0.02), 0.008, '#6a4630', (_x, y) => (y < 0.05 ? '#9a6a46' : null), 0, 0, 0, 30, 0.45);
  heap(V, 0, 0.13, 0, rAt(vo, 0.13) - 0.008, 0.012, '#cfae6a', (x, _y, z) => { const n = fbm(x * 90, 1, z * 90, 2); return n > 0.62 ? '#e6cf96' : n < 0.36 ? '#a8783e' : null; });
  for (let i = 0; i < 5; i++) dot(V, '#efe2b8', Math.cos(i * 2.3) * 0.06, 0.143, Math.sin(i * 2.3) * 0.06, 0.006, 6);
  const br = who(gp, -0.14, Y, -0.13, { h: 0.36, ry: 0.15, pose: 'stand', lean: 0.25, top: '#8a7458', bottom: '#5a4a38', dress: 'knee', hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot', skin: '#c8916a',
    hands: [[-0.02, 0.6, 0.3], [0.03, 0.78, 0.26]] });
  const [ax, ay, az] = br.handR, [bx2, by2, bz2] = br.handL, dir = new THREE.Vector3(bx2 - ax, by2 - ay, bz2 - az).normalize();
  rod(gp, [ax - dir.x * 0.04, ay - dir.y * 0.04, az - dir.z * 0.04], [ax + dir.x * 0.2, ay + dir.y * 0.2, az + dir.z * 0.2], 0.005, '#7a5a34', 6);
  const pe: V3 = [ax + dir.x * 0.2, ay + dir.y * 0.2, az + dir.z * 0.2];
  rbox(gp, '#7a5a34', pe[0] - 0.012, pe[1] - 0.03, pe[2] - 0.004, 0.024, 0.04, 0.008, 0.003);
  // grain steamer (甑) on a stove
  const sy = stove(gp, 0.22, Y, -0.12, 0.24, 0.2, 0.12, '#a89276', 0, 0.07);
  const S = grp(gp, 0.22, sy, -0.12);
  plathe(S, [[0, 0], [0.085, 0], [0.09, 0.14], [0.095, 0.15], [0, 0.15]], '#a8804e', (x, y, z) => (Math.abs(y - 0.03) < 0.006 || Math.abs(y - 0.11) < 0.006 ? '#3a2a1c' : Math.sin(ang(x, z) * 36) > 0.8 ? '#8e6a3e' : null), 0, 0, 0, 30);
  plathe(S, [[0, 0.17], [0.05, 0.165], [0.098, 0.152], [0.098, 0.146], [0, 0.146]], '#b08a56', null, 0, 0, 0, 30);
  rod(S, [-0.03, 0.172, 0], [0.03, 0.172, 0], 0.006, '#6b4a2a', 6);
  steam(S, 0.03, 0.17, 0, 0.028, 6);
  // low table with bronze jue cups
  const ty = table(gp, 0.07, Y, 0.22, 0.24, 0.12, 0.07, '#5a2a1a');
  jue(gp, 0.0, ty, 0.22, 0.4, 1.5);
  jue(gp, 0.13, ty, 0.22, -0.5, 1.5);
  // heaps of sorghum and millet on mats; a sheaf of red sorghum heads
  for (const [hx, hz, c] of [[0.33, 0.12, '#8e3a22'], [0.25, 0.32, '#e0b844']] as const) {
    cyl(gp, '#b89a62', hx, Y, hz, 0.1, 0.004, 16);
    heap(gp, hx, Y + 0.004, hz, 0.085, 0.06, c);
  }
  for (let k = 0; k < 7; k++) {
    const a = (k - 3) * 0.07, bx = -0.25 + k * 0.012, top: V3 = [bx + Math.sin(a) * 0.12 - 0.05, Y + 0.3, 0.27 + Math.cos(k) * 0.02];
    rod(gp, [bx, Y, 0.3], top, 0.0035, '#b0a258', 4);
    sweep(gp, [{ p: top, w: 0.008 }, { p: [top[0] + 0.02, top[1] + 0.02, top[2]], w: 0.016 }, { p: [top[0] + 0.045, top[1] - 0.01, top[2]], w: 0.014 }, { p: [top[0] + 0.05, top[1] - 0.05, top[2]], w: 0.006 }], '#8e2e1e',
      { radial: 7, sub: 3, paint: (px, py, pz) => (hash3(Math.floor(px * 400), Math.floor(py * 400), Math.floor(pz * 400)) > 0.6 ? '#6e1e14' : null) });
  }
  add(gp, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#c9a46a'), -0.22, Y + 0.12, 0.3, 0.02, 0.02, 0.02, 0, Math.PI / 2);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SHANG DING COOKING — a big bronze tripod ding (立耳 handles, taotie band and flanges) straddling a log fire, meat
// stew steaming inside, a cook with a long bronze ladle, a lobed-leg 鬲 with its steamer on top, a chopping board.
// ---------------------------------------------------------------------------------------------------------
const BRZ = '#7a7650', BRZD = '#4e5238';
const taotie: Paint = (x, y, z) => {
  const a = ang(x, z), u = ((a + Math.PI) / TAU) * 3 % 1;
  if (y > 0.15 && y < 0.165 && Math.abs(Math.sin(a * 36 + Math.sin(y * 500) * 1.5)) > 0.5) return BRZD;
  if (y > 0.11 && y < 0.15) {
    const du = (u - 0.5) * 6, dv = (y - 0.13) * 140;
    if (Math.hypot(Math.abs(du) - 0.8, dv - 0.3) < 0.32) return '#2e3226';
    if (Math.abs(Math.sin(du * 4) * Math.cos(dv * 4)) > 0.45) return BRZD;
  }
  return null;
};
function ding(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, legH = 0.12): number {
  const d = grp(p, x, y, z, ry, s);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3 + Math.PI / 2;
    sweep(d, [{ p: [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], w: 0.016 }, { p: [Math.cos(a) * 0.12, legH * 0.6, Math.sin(a) * 0.12], w: 0.014 }, { p: [Math.cos(a) * 0.11, legH + 0.03, Math.sin(a) * 0.11], w: 0.02 }], BRZ, { radial: 8, sub: 2 });
  }
  const o: [number, number][] = [[0.04, 0], [0.11, 0.015], [0.155, 0.06], [0.168, 0.11], [0.17, 0.16], [0.18, 0.168], [0.182, 0.175]];
  vessel(d, dense(o, 0.008), 0.008, BRZ, taotie, 0, legH, 0, 60, 0.45, 0.45);
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; const fl = box(d, BRZD, Math.cos(a) * 0.168, legH + 0.11, Math.sin(a) * 0.168, 0.006, 0.05, 0.012); fl.rotation.y = -a; }
  for (const sx of [-1, 1]) {
    for (const dz of [-0.035, 0.035]) box(d, BRZ, sx * 0.165, legH + 0.17, dz, 0.012, 0.06, 0.012);
    box(d, BRZ, sx * 0.165, legH + 0.225, 0, 0.012, 0.012, 0.082);
  }
  return legH + 0.15;
}
function liSteamer(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#8a8070'): void {
  const l = grp(p, x, y, z, 0, s);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + Math.PI / 2; el(l, c, Math.cos(a) * 0.035, 0.05, Math.sin(a) * 0.035, 0.04, 0.05, 0.04, -a, 0, 0); cone(l, c, Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, 0.012, 0.03, 6).rotation.x = Math.PI; }
  plathe(l, [[0.05, 0.05], [0.07, 0.08], [0.055, 0.1], [0.06, 0.11], [0, 0.11]], c, (_x, yy) => (yy > 0.08 && Math.sin(yy * 600) > 0.5 ? shade(c, 0.85) : null), 0, 0, 0, 20);
  vessel(l, [[0.04, 0.1], [0.07, 0.14], [0.085, 0.19], [0.09, 0.2]], 0.005, c, (xx, yy, zz) => (Math.sin(yy * 400 + ang(xx, zz) * 4) > 0.8 ? shade(c, 0.82) : null), 0, 0, 0, 24);
  for (const sx of [-1, 1]) add(l, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat(c), sx * 0.085, 0.2, 0, 0.018, 0.018, 0.018, Math.PI / 2);
  steam(l, 0, 0.2, 0, 0.02, 6);
}
const lf_cauldron: Builder = gp => {
  base(gp, earth('#8a6c4c', 18), '#5a4430');
  // hearth: ash, stones, ding over the fire
  fill(gp, '#4a4038', 0.0, Y + 0.003, 0.02, 0.17, 24);
  for (let k = 0; k < 12; k++) { const a = k * TAU / 12; el(gp, k % 2 ? '#7d776c' : '#8f897d', Math.cos(a) * 0.19, Y + 0.01, 0.02 + Math.sin(a) * 0.19, 0.03, 0.02, 0.024, a); }
  fire(gp, 0, Y, 0.02, 0.1);
  const top = ding(gp, 0, Y, 0.02, 1.12, 0.3, 0.15);
  const sy = Y + top * 1.12;
  fill(gp, '#6a3a1a', 0, sy, 0.02, 0.18, 30, 0.3);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, r = 0.03 + ((i * 7) % 6) * 0.025;
    gloss(gp, i % 4 ? '#8a4a26' : '#c89a6a', Math.cos(a) * r, sy + 0.006, 0.02 + Math.sin(a) * r, 0.022, 0.012, 0.018, a);
  }
  rod(gp, [-0.06, sy + 0.012, 0.0], [0.03, sy + 0.04, 0.06], 0.008, '#ece2cc', 6);
  for (let i = 0; i < 6; i++) dot(gp, '#4a7a2a', Math.cos(i) * 0.12, sy + 0.004, 0.02 + Math.sin(i) * 0.1, 0.008, 5);
  steam(gp, -0.04, sy + 0.01, 0.0, 0.03, 7);
  steam(gp, 0.06, sy + 0.01, 0.06, 0.025, 5);
  // cook with a long ladle
  const ck = who(gp, 0.31, Y, -0.12, { h: 0.38, ry: -1.1, pose: 'stand', lean: 0.15, top: '#7a5a3c', bottom: '#4a3a2a', dress: 'knee', hat: '#1c140e', hatStyle: 'knot', skin: '#c08a62',
    hands: [[-0.02, 0.62, 0.32], [0.06, 0.74, 0.22]] });
  const [ax, ay, az] = ck.handR;
  const tip: V3 = [0.07, sy + 0.02, 0.03];
  rod(gp, [ax, ay + 0.02, az], tip, 0.004, BRZ, 5);
  vessel(grp(gp, tip[0], tip[1] - 0.012, tip[2]), [[0.008, 0], [0.018, 0.01], [0.02, 0.015]], 0.002, BRZ, null, 0, 0, 0, 12);
  // 鬲 with steamer, on its own small fire
  fire(gp, -0.32, Y, 0.14, 0.05);
  liSteamer(gp, -0.32, Y, 0.14, 1.2, '#9a7458');
  // board with meat and bronze knife; firewood
  rbox(gp, '#8a6a44', 0.25, Y, 0.24, 0.18, 0.02, 0.11, 0.004);
  for (let i = 0; i < 3; i++) gloss(gp, '#a8443a', 0.2 + i * 0.045, Y + 0.03, 0.24, 0.02, 0.012, 0.03, 0.3);
  el(gp, '#f0e4d0', 0.2, Y + 0.04, 0.24, 0.008, 0.008, 0.02);
  box(gp, BRZ, 0.31, Y + 0.02, 0.27, 0.06, 0.004, 0.018, 0.4);
  for (let k = 0; k < 5; k++) rod(gp, [-0.22 + k * 0.012, Y + 0.012 + (k % 2) * 0.012, -0.3], [-0.06 + k * 0.012, Y + 0.012 + (k % 2) * 0.012, -0.35], 0.011, k % 2 ? '#6b4a2a' : '#7c5634', 6);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DUANWU ZONGZI (粽子) — on a plank table: a blue-and-white plate piled with green leaf pyramids tied with string, one
// unwrapped to show sticky rice and a red date, a pot steaming more, mugwort bundles tied in red, a little dragon boat
// and a grandmother wrapping.
// ---------------------------------------------------------------------------------------------------------
function zongzi(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, tilt = 0, c = '#5f9a3a', rice = false): void {
  const zg = grp(p, x, y, z, ry, s);
  zg.rotation.z = tilt;
  const H = 0.08, R = 0.055;
  const geo = paintFaces(new THREE.ConeGeometry(R, H, 3, 3), c, rice
    ? (px, py, pz) => (hash3(Math.floor(px * 600), Math.floor(py * 600), Math.floor(pz * 600)) > 0.7 ? '#e8e2d2' : '#f8f5ec')
    : (px, py, pz) => (Math.sin((px + pz) * 180 + py * 60) > 0.7 ? shade(c, 0.78) : Math.sin((px - pz) * 90) > 0.85 ? shade(c, 1.15) : null));
  add(zg, geo, mat('#ffffff', { vc: true, flat: true, rough: rice ? 0.8 : 0.45 }), 0, H / 2, 0, 1, 1, 1);
  if (rice) return;
  for (const h of [0.022, 0.048]) {
    const rr = R * (1 - h / H) * 0.52 + 0.002, pts: V3[] = [];
    for (let k = 0; k <= 3; k++) { const a = (k / 3) * TAU; pts.push([Math.sin(a) * rr * 2, h, Math.cos(a) * rr * 2]); }
    for (let k = 0; k < 3; k++) rod(zg, pts[k], pts[k + 1], 0.0022, '#c9a46a', 4);
  }
}
function dragonBoat(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number): void {
  const b = grp(p, x, y, z, ry, s);
  sweep(b, [{ p: [-0.09, 0.025, 0], w: 0.004, h: 0.006 }, { p: [-0.06, 0.016, 0], w: 0.018, h: 0.012 }, { p: [0.03, 0.014, 0], w: 0.02, h: 0.013 }, { p: [0.08, 0.022, 0], w: 0.008, h: 0.008 }], '#c0262a', { radial: 10, sub: 3, squash: 1, paint: (_x, py) => (py > 0.02 ? '#e8b830' : null) });
  sweep(b, [{ p: [0.08, 0.022, 0], w: 0.008 }, { p: [0.1, 0.045, 0], w: 0.008 }, { p: [0.115, 0.06, 0], w: 0.01 }], '#e8b830', { radial: 8, sub: 3 });
  el(b, '#c0262a', 0.125, 0.062, 0, 0.014, 0.009, 0.009);
  for (const sz of [-1, 1]) { rod(b, [0.115, 0.07, sz * 0.004], [0.1, 0.085, sz * 0.008], 0.0015, '#e8b830', 4); dot(b, '#111', 0.128, 0.068, sz * 0.007, 0.002, 5); }
  sweep(b, [{ p: [-0.09, 0.025, 0], w: 0.006 }, { p: [-0.11, 0.04, 0], w: 0.008 }, { p: [-0.115, 0.055, 0], w: 0.003 }], '#e8b830', { radial: 6, sub: 3 });
  for (let k = 0; k < 4; k++) for (const sz of [-1, 1]) rod(b, [-0.05 + k * 0.03, 0.024, sz * 0.012], [-0.06 + k * 0.03, 0.0, sz * 0.03], 0.0015, '#7a4a24', 4);
  for (let k = 0; k < 4; k++) dot(b, ['#1d4ed8', '#e5e7eb', '#f59e0b', '#16a34a'][k], -0.045 + k * 0.03, 0.03, 0, 0.006, 6);
  rod(b, [0.06, 0.02, 0], [0.06, 0.06, 0], 0.0015, '#5a3a22', 4);
  box(b, '#e8b830', 0.068, 0.045, 0, 0.016, 0.012, 0.001);
}
const BW = '#f4f6f8', COB = '#2a4b9a';
const bwPaint = (rimR: number): Paint => (x, y, z) => {
  const r = Math.hypot(x, z), a = ang(x, z);
  if (r > rimR * 0.9) return Math.sin(a * 24) > 0.2 ? COB : null;
  if (r > rimR * 0.82) return null;
  if (r < rimR * 0.4 && Math.sin(x * 120) * Math.cos(z * 120) > 0.5) return COB;
  return Math.abs(r - rimR * 0.62) < 0.004 ? COB : null;
};
function plate(p: THREE.Object3D, x: number, y: number, z: number, R: number, paint: Paint | null = null, c = BW): number {
  plathe(p, [[0, 0], [R * 0.55, 0], [R * 0.6, 0.006], [R, 0.018], [R * 0.97, 0.02], [R * 0.6, 0.009], [0, 0.009]], c, paint, x, y, z, 36, 0.25);
  return y + 0.009;
}
const lf_zongzi: Builder = gp => {
  base(gp, planks('#9a6a40'), '#5a3a22');
  const py = plate(gp, 0.0, Y, 0.06, 0.2, bwPaint(0.2));
  const ring: [number, number, number][] = [[-0.09, 0.03, 0.3], [0.0, 0.11, 1.2], [0.09, 0.04, 2.0], [-0.04, -0.06, 0.8], [0.06, -0.06, 2.6]];
  for (const [x, z, ry] of ring) zongzi(gp, x, py, 0.06 + z, 1.15, ry, 0, '#5f9a3a');
  zongzi(gp, -0.03, py + 0.035, 0.07, 1.1, 0.5, 0.25, '#6aa444');
  zongzi(gp, 0.05, py + 0.035, 0.04, 1.1, 1.9, -0.2, '#558f34');
  // unwrapped: rice pyramid with a red date, leaves peeled open
  const uy = plate(gp, 0.25, Y, 0.24, 0.12, null, '#e8e4da');
  for (const a of [0.4, 2.3, 4.2]) {
    const lf = slab(grp(gp, 0.25, uy + 0.002, 0.24, a), [[0, -0.026], [0.08, -0.032], [0.16, 0], [0.08, 0.032], [0, 0.026]], 0.002, '#4f8a32', 0, true);
    lf.rotation.x = Math.PI / 2;
  }
  zongzi(gp, 0.25, uy + 0.004, 0.24, 1.55, 0.3, 0, '#f6f2e6', true);
  el(gp, '#8a1a18', 0.255, uy + 0.045, 0.268, 0.018, 0.022, 0.012);
  chopsticks(gp, 0.36, uy, 0.14, 1.1);
  // steaming pot on a charcoal brazier
  const P = grp(gp, -0.24, Y, -0.2);
  plathe(P, [[0, 0], [0.07, 0], [0.085, 0.05], [0.07, 0.06], [0, 0.06]], '#5a4a3e', null, 0, 0, 0, 20);
  glow(cyl(P, '#ff7a1a', 0, 0.045, 0.06, 0.03, 0.012, 8), '#ff9a40', '#ff4a00');
  const po: [number, number][] = [[0.07, 0.06], [0.1, 0.08], [0.11, 0.13], [0.115, 0.14]];
  vessel(P, po, 0.006, '#3a3634', null, 0, 0, 0, 30, 0.4, 0.4);
  fill(P, '#c8b88a', 0, 0.13, 0, 0.1, 24, 0.2);
  for (let k = 0; k < 4; k++) { const a = k * 1.6; zongzi(P, Math.cos(a) * 0.05, 0.11, Math.sin(a) * 0.05, 0.8, a, 0.2); }
  for (const sx of [-1, 1]) add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#3a3634'), sx * 0.115, 0.14, 0, 0.02, 0.02, 0.02, Math.PI / 2);
  steam(P, 0, 0.14, 0, 0.028, 6);
  // mugwort bundles leaning at the back right
  for (const [bx, bz, a] of [[0.24, -0.27, 0.2], [0.33, -0.18, -0.15]] as const) {
    const M = grp(gp, bx, Y, bz, a);
    M.rotation.z = 0.25;
    for (let k = 0; k < 7; k++) {
      const ox = (k - 3) * 0.006, tp: V3 = [ox * 3, 0.3, (k % 3 - 1) * 0.012];
      rod(M, [ox, 0, 0], tp, 0.0025, '#7a8a5a', 4);
      for (let l = 0; l < 3; l++) el(M, l % 2 ? '#7f9a6a' : '#91a87c', tp[0] * (0.6 + l * 0.2) + (l - 1) * 0.012, 0.18 + l * 0.045, tp[2], 0.018, 0.006, 0.01, l, 0, (l - 1) * 0.8);
    }
    add(M, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#d01c1c'), 0, 0.1, 0, 0.022, 0.022, 0.03, 0, Math.PI / 2);
  }
  dragonBoat(gp, -0.24, Y, 0.24, 0.25, 1.25);
  // grandmother wrapping a leaf cone
  const gm = who(gp, 0.04, Y, -0.3, { h: 0.32, pose: 'stand', lean: 0.12, top: '#4a5a7a', bottom: '#2a2a38', hair: '#c8c4bc', skin: '#d8a882',
    hands: [[-0.04, 0.62, 0.22], [0.04, 0.62, 0.22]] });
  const [hx, hy, hz] = gm.handL;
  zongzi(gp, hx + 0.012, hy - 0.02, hz + 0.01, 0.55, 0.3, Math.PI, '#5f9a3a');
  for (let k = 0; k < 6; k++) { const lf = slab(grp(gp, -0.12 + k * 0.012, Y + 0.002 + k * 0.002, -0.14, 0.3 + k * 0.1), [[0, -0.015], [0.08, -0.02], [0.15, 0], [0.08, 0.02], [0, 0.015]], 0.002, '#5a9238', 0, true); lf.rotation.x = Math.PI / 2; }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// TOFU MAKING (豆腐, Liu An legend) — flagstone workshop: a two-stone hand mill on a basin, white soy milk pouring
// from the spout into a bucket, a draining board with a fresh pressed block (the press frame lifted off beside it,
// a second press still weighted with a stone), a tray of cut cubes, sacks of yellow soybeans, the cook at the mill.
// ---------------------------------------------------------------------------------------------------------
const GRANITE = '#9a968c', SOY = '#e8c860', TOFU = '#f7f3e6';
const granite = (c: string): Paint => (x, y, z) => shade(c, 0.86 + hash3(Math.floor(x * 300), Math.floor(y * 300), Math.floor(z * 300)) * 0.22);
function sack(p: THREE.Object3D, x: number, z: number, s: number, ry: number, beans: string, c = '#c4a676'): void {
  const k = grp(p, x, Y, z, ry, s);
  plathe(k, [[0, 0], [0.07, 0.004], [0.088, 0.04], [0.09, 0.1], [0.08, 0.14], [0.09, 0.155], [0.084, 0.158], [0.072, 0.14], [0, 0.14]], c,
    (px, py, pz) => (Math.abs(py - 0.145) < 0.006 ? shade(c, 0.8) : (Math.floor(px * 220) + Math.floor(py * 220) + Math.floor(pz * 220)) % 2 ? shade(c, 0.92) : null), 0, 0, 0, 22);
  heap(k, 0, 0.138, 0, 0.074, 0.03, beans);
  for (let i = 0; i < 7; i++) el(k, shade(beans, 0.95 + (i % 3) * 0.05), Math.cos(i * 2.1) * 0.04, 0.158 + (i % 2) * 0.006, Math.sin(i * 2.1) * 0.04, 0.009, 0.007, 0.009);
}
const lf_tofu: Builder = gp => {
  base(gp, tiles('#8e877a', 0.09), '#5a5046');
  // stone mill: pedestal, basin with spout, lower + upper stones, feed hole with beans, turning peg
  const mx = -0.12, mz = 0.0, M = grp(gp, mx, Y, mz);
  plathe(M, [[0, 0], [0.11, 0], [0.1, 0.05], [0, 0.05]], GRANITE, granite(GRANITE), 0, 0, 0, 24);
  vessel(M, [[0.15, 0.05], [0.165, 0.065], [0.17, 0.085]], 0.012, GRANITE, granite('#8e8a80'), 0, 0, 0, 36);
  fill(M, '#f6f2e4', 0, 0.072, 0, 0.155, 30, 0.15);
  rbox(M, '#8e8a80', -0.022, 0.06, 0.15, 0.044, 0.022, 0.07, 0.006);
  box(M, '#f6f2e4', -0.014, 0.08, 0.15, 0.028, 0.003, 0.068);
  plathe(M, [[0, 0.07], [0.105, 0.07], [0.105, 0.11], [0, 0.11]], '#a8a498', granite('#a8a498'), 0, 0, 0, 28);
  plathe(M, [[0, 0.112], [0.105, 0.112], [0.104, 0.165], [0.09, 0.17], [0, 0.17]], '#b0ab9f', (px, py, pz) => {
    const r = Math.hypot(px, pz);
    if (py > 0.168 && r < 0.03) return '#3a3630';
    if (py > 0.112 && py < 0.118) return '#6e6a62';
    return granite('#b0ab9f')(px, py, pz, 0, 0, 0);
  }, 0, 0, 0, 28);
  for (let i = 0; i < 6; i++) el(M, SOY, Math.cos(i * 1.7) * 0.016, 0.172, Math.sin(i * 1.7) * 0.016, 0.008, 0.006, 0.008);
  // a thin white seam where the milk oozes between the stones
  add(M, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#f6f2e4'), 0, 0.11, 0, 0.106, 0.106, 0.08, 0, Math.PI / 2);
  rod(M, [0.0, 0.14, -0.105], [0.0, 0.14, -0.13], 0.008, '#6b4a2a', 6);
  rod(M, [0.0, 0.14, -0.13], [0.0, 0.23, -0.13], 0.009, '#7a5634', 6);
  // milk pouring from the spout into a wooden bucket
  const bx = mx - 0.022, bz = mz + 0.28;
  sweep(gp, [{ p: [bx, Y + 0.085, mz + 0.185], w: 0.012, h: 0.006 }, { p: [bx, Y + 0.075, mz + 0.205], w: 0.01, h: 0.008 }, { p: [bx, Y + 0.05, mz + 0.215], w: 0.009 }, { p: [bx, Y + 0.02, mz + 0.22], w: 0.009 }],
    '#f8f5ea', { radial: 8, sub: 4 });
  const Bk = grp(gp, bx, Y, bz);
  vessel(Bk, [[0.065, 0], [0.072, 0.07]], 0.006, '#9a6c3e', (px, py, pz) => (Math.abs(py - 0.015) < 0.004 || Math.abs(py - 0.06) < 0.004 ? '#3a3632' : Math.sin(ang(px, pz) * 22) > 0.9 ? '#7a5228' : null), 0, 0, 0, 24);
  fill(Bk, '#f8f5ea', 0, 0.05, 0, 0.066, 24, 0.15);
  // cook turning the peg
  who(gp, mx, Y, -0.21, { h: 0.36, pose: 'stand', lean: 0.32, top: '#5a6e86', bottom: '#2e3440', dress: 'knee', sleeve: 0.5, hat: '#e8e2d2', hatStyle: 'turban', skin: '#c8916a',
    hands: [[-0.02, 0.62, 0.3], [0.02, 0.66, 0.31]] });
  // draining board: fresh tofu block, press frame lifted off, cloth
  const D = grp(gp, 0.18, Y, -0.08, -0.25);
  rbox(D, '#8a6a44', 0, 0.0, 0, 0.26, 0.05, 0.2, 0.006);
  for (let i = 0; i < 6; i++) box(D, '#6e5234', -0.11 + i * 0.044, 0.05, 0, 0.006, 0.002, 0.19);
  slab(D, [[-0.1, -0.08], [0.1, -0.08], [0.11, 0.08], [-0.1, 0.085]], 0.003, '#e8e2cc', 0, false).rotation.x = -Math.PI / 2;
  D.children[D.children.length - 1].position.y = 0.052;
  rbox(D, TOFU, 0, 0.054, 0, 0.17, 0.065, 0.13, 0.008);
  for (let i = 0; i < 4; i++) box(D, '#ece6d4', -0.064 + i * 0.043, 0.118, 0, 0.002, 0.002, 0.128);
  // the lifted frame leaning against the board
  const F = grp(D, 0.0, 0.05, 0.16);
  F.rotation.x = -1.0;
  for (const [fx, fz, w, d] of [[0, -0.07, 0.19, 0.012], [0, 0.07, 0.19, 0.012], [-0.09, 0, 0.012, 0.15], [0.09, 0, 0.012, 0.15]] as const) box(F, '#a07a4c', fx, 0, fz, w, 0.07, d);
  // second press, still weighted
  const P2 = grp(gp, 0.3, Y, -0.29, 0.5);
  rbox(P2, '#8a6a44', 0, 0, 0, 0.16, 0.04, 0.14, 0.005);
  for (const [fx, fz, w, d] of [[0, -0.055, 0.14, 0.012], [0, 0.055, 0.14, 0.012], [-0.065, 0, 0.012, 0.1], [0.065, 0, 0.012, 0.1]] as const) box(P2, '#a07a4c', fx, 0.04, fz, w, 0.06, d);
  rbox(P2, '#b08a5a', 0, 0.1, 0, 0.13, 0.014, 0.1, 0.003);
  el(P2, '#7d786e', 0, 0.14, 0, 0.055, 0.035, 0.045, 0.4);
  // tray of cut cubes and a knife
  const T = grp(gp, 0.2, Y, 0.22, 0.3);
  vessel(T, [[0.12, 0], [0.13, 0.025]], 0.006, '#c8a468', (px, py, pz) => (Math.sin(ang(px, pz) * 40) > 0.6 ? '#a8844c' : null), 0, 0, 0, 32);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i === 2 && j === 0)) rbox(T, i === 1 && j === 1 ? '#f3eedc' : TOFU, -0.05 + i * 0.05, 0.007, -0.05 + j * 0.05, 0.044, 0.04, 0.044, 0.005, (i + j) * 0.04);
  box(T, '#c8ccd0', 0.06, 0.007, -0.055, 0.06, 0.002, 0.024, 0.3);
  rod(T, [0.0, 0.009, -0.07], [-0.04, 0.009, -0.085], 0.006, '#5a3a22', 6);
  // soybean sacks, a basket of soaked beans and spilled beans
  sack(gp, -0.34, -0.12, 1.15, 0.2, SOY);
  sack(gp, -0.3, 0.12, 1.0, 1.4, SOY);
  const Sb = grp(gp, 0.02, Y, 0.3);
  vessel(Sb, [[0.05, 0], [0.07, 0.02], [0.075, 0.04]], 0.005, '#b08a52', (px, py, pz) => ((Math.floor(ang(px, pz) * 8) + Math.floor(py * 120)) % 2 ? '#8e6c3a' : null), 0, 0, 0, 24);
  heap(Sb, 0, 0.034, 0, 0.068, 0.02, '#d8c070');
  for (let i = 0; i < 14; i++) el(gp, SOY, -0.25 + (i % 5) * 0.03 + hash3(i, 1, 1) * 0.02, Y + 0.004, 0.27 + Math.floor(i / 5) * 0.03, 0.008, 0.006, 0.008);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DUMPLINGS (饺子 / 娇耳) — a family table: a big bamboo steamer, lid off, full of pleated crescents and steaming;
// a flour-dusted board with rolling pin, dough log, cut pieces and round wrappers; a bowl of filling; a bowl of
// dumpling soup steaming; a vinegar dish; mother wrapping one in her hands.
// ---------------------------------------------------------------------------------------------------------
const flour: Paint = (x, _y, z) => (fbm(x * 40, 2, z * 40, 2) > 0.52 ? '#ece6d8' : null);
const lf_jiaozi: Builder = gp => {
  base(gp, planks('#8a5a34', 0.085), '#4e3220');
  // steamer full of dumplings
  const sx = -0.1, sz = 0.0, sR = 0.18;
  const fy = steamerRing(gp, sx, Y, sz, sR, 0.065);
  fill(gp, '#b9cf8c', sx, fy + 0.002, sz, sR - 0.012, 30);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.2; jiaozi(gp, sx + Math.cos(a) * 0.112, fy + 0.002, sz + Math.sin(a) * 0.112, 0.048, Math.PI / 2 - a); }
  for (let i = 0; i < 2; i++) { const a = i * Math.PI + 0.9; jiaozi(gp, sx + Math.cos(a) * 0.03, fy + 0.002, sz + Math.sin(a) * 0.03, 0.044, Math.PI / 2 - a); }
  steamerLid(gp, -0.33, Y, -0.2, 0.13, 0, 0);
  steam(gp, sx - 0.04, fy + 0.04, sz - 0.05, 0.022, 5, '#f5f5f2', 0.26);
  // board with rolling pin, dough log, pieces and wrappers
  const B = grp(gp, 0.2, Y, 0.12, -0.35);
  plathe(B, [[0, 0], [0.15, 0], [0.15, 0.018], [0, 0.018]], '#c8a272', (px, py, pz) => (py > 0.017 ? flour(px, py, pz, 0, 1, 0) ?? (Math.sin(px * 120 + Math.sin(pz * 30)) > 0.85 ? '#b08a5a' : null) : '#9a764a'), 0, 0, 0, 32);
  const rp = sweep(B, [{ p: [-0.11, 0.03, 0.05], w: 0.006 }, { p: [-0.07, 0.03, 0.05], w: 0.012 }, { p: [0.07, 0.03, 0.05], w: 0.012 }, { p: [0.11, 0.03, 0.05], w: 0.006 }], '#d8b482', { radial: 10, sub: 3 });
  rp.rotation.y = 0.3;
  sweep(B, [{ p: [-0.08, 0.034, -0.08], w: 0.017 }, { p: [0.0, 0.034, -0.085], w: 0.018 }, { p: [0.06, 0.034, -0.07], w: 0.016 }], '#f2ece0', { radial: 10, sub: 3 });
  for (let i = 0; i < 5; i++) el(B, '#efe8da', -0.06 + i * 0.022, 0.026, -0.04, 0.012, 0.008, 0.01);
  for (let i = 0; i < 6; i++) cyl(B, '#f4efe4', 0.07 + (i % 2) * 0.008, 0.018 + i * 0.0025, -0.01 + (i % 3) * 0.004, 0.032, 0.0022, 18);
  // a filled wrapper waiting to be folded and a row of finished ones
  cyl(B, '#f4efe4', -0.05, 0.018, 0.0, 0.032, 0.0022, 18);
  el(B, '#a8705a', -0.05, 0.024, 0.0, 0.014, 0.008, 0.012);
  for (let i = 0; i < 3; i++) jiaozi(B, -0.04 + i * 0.05, 0.018, 0.1, 0.03, 0);
  // filling bowl
  const Fb = grp(gp, 0.0, Y, -0.26);
  vessel(Fb, [[0.04, 0], [0.07, 0.03], [0.085, 0.055]], 0.005, BW, (px, py, pz) => (Math.abs(py - 0.045) < 0.004 ? COB : null), 0, 0, 0, 28, 0.25);
  heap(Fb, 0, 0.042, 0, 0.074, 0.02, '#a8705a', (px, py, pz) => (hash3(Math.floor(px * 400), Math.floor(py * 400), Math.floor(pz * 400)) > 0.75 ? '#5a8a3a' : null));
  rod(Fb, [0.02, 0.06, 0], [0.09, 0.1, 0.03], 0.003, '#6b3a1f', 4);
  // dumpling soup bowl
  const S = grp(gp, -0.22, Y, 0.26);
  const so: [number, number][] = [[0.04, 0], [0.075, 0.025], [0.098, 0.065], [0.1, 0.07]];
  vessel(S, dense(so, 0.01), 0.005, BW, (px, py, pz) => (py > 0.058 && Math.sin(ang(px, pz) * 20) > 0.3 ? COB : Math.abs(py - 0.035) < 0.004 ? COB : null), 0, 0, 0, 32, 0.22);
  fill(S, '#d8b878', 0, 0.06, 0, 0.09, 28, 0.15);
  for (let i = 0; i < 4; i++) { const a = i * 1.6; jiaozi(S, Math.cos(a) * 0.045, 0.05, Math.sin(a) * 0.045, 0.03, Math.PI / 2 - a); }
  for (let i = 0; i < 8; i++) dot(S, '#4a9a3a', Math.cos(i * 2.2) * 0.07, 0.062, Math.sin(i * 2.2) * 0.07, 0.005, 5);
  steam(S, 0, 0.07, 0, 0.02, 5, '#f5f5f2', 0.28);
  // vinegar dish
  const Vd = grp(gp, 0.04, Y, 0.31);
  vessel(Vd, [[0.025, 0], [0.04, 0.012], [0.045, 0.016]], 0.004, BW, null, 0, 0, 0, 20);
  fill(Vd, '#4a2a18', 0, 0.012, 0, 0.038, 20, 0.1);
  chopsticks(gp, 0.1, Y, 0.31, 0.3);
  // mother wrapping a dumpling
  const m = who(gp, 0.2, Y, -0.26, { h: 0.34, ry: -0.3, pose: 'stand', lean: 0.15, top: '#b23a3a', bottom: '#2a2a38', skin: '#e0b08a', hair: '#1a1410',
    hands: [[-0.035, 0.6, 0.24], [0.035, 0.6, 0.24]] });
  const hx = (m.handL[0] + m.handR[0]) / 2, hy = (m.handL[1] + m.handR[1]) / 2, hz = (m.handL[2] + m.handR[2]) / 2;
  jiaozi(gp, hx, hy + 0.004, hz + 0.01, 0.03, -0.3);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// STEAMED BUNS (馒头) — kitchen: a brick stove with a glowing fire mouth, a wok carrying a tower of bamboo steamers;
// the cook lifts the top lid in a cloud of steam to reveal white domed buns; a tray of buns cooling on the table,
// a kneading board with dough, a flour sack.
// ---------------------------------------------------------------------------------------------------------
const DOME = () => g('lf-dome', () => new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2));
function mantou(p: THREE.Object3D, x: number, y: number, z: number, r: number, mark = false): void {
  add(p, DOME(), mat('#fbf8f0', { flat: false, rough: 0.7 }), x, y, z, r, r * 0.82, r);
  if (mark) dot(p, '#d01c1c', x, y + r * 0.82, z, r * 0.14, 6);
}
const lf_mantou: Builder = gp => {
  base(gp, tiles('#9a8c78', 0.08), '#5a4c3c');
  const top = stove(gp, -0.06, Y, -0.1, 0.38, 0.3, 0.14, '#b49a7c', 0, 0.12);
  const S = grp(gp, -0.06, top, -0.1);
  plathe(S, [[0, 0], [0.09, 0.01], [0.135, 0.04], [0.15, 0.05], [0.142, 0.052], [0.125, 0.04], [0, 0.01]], '#2e2c2a', null, 0, 0, 0, 30, 0.45, 0.4);
  const R = 0.13, H = 0.06;
  let fy = 0;
  for (let k = 0; k < 3; k++) fy = steamerRing(S, 0, 0.04 + k * H, 0, R, H);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mantou(S, Math.cos(a) * 0.075, fy, Math.sin(a) * 0.075, 0.038, i === 2); }
  mantou(S, 0, fy, 0, 0.04);
  steam(S, -0.05, fy + 0.05, -0.03, 0.026, 6, '#f7f7f4', 0.26);
  // cook lifting the lid
  const ck = who(gp, 0.25, Y, -0.24, { h: 0.37, ry: -0.9, pose: 'stand', top: '#f0ece2', bottom: '#3a3a44', sleeve: 0.5, hat: '#f4f2ea', hatStyle: 'cap', skin: '#c8916a',
    hands: [[-0.07, 0.95, 0.24], [0.1, 0.62, 0.22]] });
  const [lx, ly, lz] = ck.handL;
  steamerLid(gp, lx - 0.05, ly - 0.02, lz + 0.04, R, 0.9, -0.4);
  // tray of cooling buns on the table at the front
  const fx = 0.1, fz = 0.2;
  const ty = steamerRing(gp, fx, Y, fz, 0.15, 0.045);
  fill(gp, '#efe8d8', fx, ty + 0.002, fz, 0.138, 28);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; mantou(gp, fx + Math.cos(a) * 0.09, ty + 0.002, fz + Math.sin(a) * 0.09, 0.042, i === 0); }
  mantou(gp, fx, ty + 0.002, fz, 0.045);
  steam(gp, fx - 0.03, ty + 0.04, fz, 0.02, 4, '#f7f7f4', 0.24);
  // kneading board, dough and flour sack
  const B = grp(gp, -0.26, Y, 0.18, 0.4);
  rbox(B, '#c8a272', 0, 0, 0, 0.2, 0.016, 0.15, 0.004);
  add(B, DOME(), mat('#f2ece0', { flat: false }), -0.02, 0.016, 0, 0.06, 0.04, 0.05);
  for (let i = 0; i < 3; i++) add(B, DOME(), mat('#f4efe4', { flat: false }), 0.06, 0.016, -0.04 + i * 0.04, 0.018, 0.016, 0.018);
  heap(B, -0.07, 0.016, 0.05, 0.03, 0.006, '#f0ebe0');
  sack(gp, -0.35, -0.05, 1.05, 0.5, '#f2ede2', '#d8ccae');
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// NOODLE SOUP (汤饼, Jin) — a huge celadon bowl of long noodles in broth with greens, chopsticks lifting a skein; behind,
// the cook stretches a hank of dough strands between his hands; a cauldron of noodles boiling on a stove; dough board.
// ---------------------------------------------------------------------------------------------------------
const CELADON = '#9ab79a';
function noodleTangle(p: THREE.Object3D, y: number, R: number, n: number, seed: number, c = '#f0e2b8'): void {
  for (let k = 0; k < n; k++) {
    const pts: { p: V3; w: number }[] = [];
    let a = hash3(k, seed, 1) * TAU, r = R * (0.2 + hash3(k, seed, 2) * 0.6);
    for (let i = 0; i < 7; i++) {
      a += 0.6 + hash3(k, i, seed) * 0.5;
      r = Math.min(R * 0.92, Math.max(R * 0.15, r + (hash3(i, k, seed + 3) - 0.5) * R * 0.4));
      pts.push({ p: [Math.cos(a) * r, y + 0.004 + hash3(i, k, 9) * 0.006, Math.sin(a) * r], w: 0.0055 });
    }
    sweep(p, pts, c, { radial: 5, sub: 3 });
  }
}
const lf_noodles: Builder = gp => {
  base(gp, planks('#7a5232', 0.08), '#4a3020');
  // big bowl
  const B = grp(gp, -0.04, Y, 0.08);
  const bo: [number, number][] = [[0.07, 0], [0.075, 0.012], [0.13, 0.04], [0.18, 0.09], [0.19, 0.1]];
  vessel(B, dense(bo, 0.01), 0.007, CELADON, (px, py, pz) => (py < 0.013 ? '#b8a888' : py > 0.04 && py < 0.085 && Math.sin(ang(px, pz) * 16) > 0.75 ? '#88a68a' : null), 0, 0, 0, 40, 0.18);
  fill(B, '#d6a858', 0, 0.084, 0, 0.17, 32, 0.12);
  noodleTangle(B, 0.082, 0.16, 16, 3);
  for (let i = 0; i < 3; i++) {
    const a = 0.8 + i * 0.7, x = Math.cos(a) * 0.09, z = Math.sin(a) * 0.09;
    el(B, '#3e8a2e', x, 0.092, z, 0.04, 0.006, 0.02, -a);
    el(B, '#e8eccc', x - Math.cos(a) * 0.035, 0.092, z - Math.sin(a) * 0.035, 0.018, 0.007, 0.014, -a);
  }
  for (let i = 0; i < 4; i++) gloss(B, '#8a4a2a', Math.cos(3.6 + i * 0.4) * 0.1, 0.09, Math.sin(3.6 + i * 0.4) * 0.1, 0.022, 0.006, 0.016, i);
  for (let i = 0; i < 14; i++) dot(B, '#5aaa3a', Math.cos(i * 2.4) * 0.12 * ((i % 3) / 3 + 0.3), 0.093, Math.sin(i * 2.4) * 0.12 * ((i % 3) / 3 + 0.3), 0.005, 5);
  // chopsticks lifting a skein of noodles
  const c0: V3 = [0.02, 0.27, 0.06], c1: V3 = [0.14, 0.2, -0.02];
  rod(B, c0, [-0.02, 0.1, 0.02], 0.0035, '#3a2416', 5);
  rod(B, [c0[0] + 0.012, c0[1], c0[2] + 0.01], [-0.01, 0.1, 0.03], 0.0035, '#3a2416', 5);
  for (let k = 0; k < 6; k++) {
    const dx = (k - 2.5) * 0.007;
    sweep(B, [{ p: [-0.015 + dx, 0.105, 0.03], w: 0.005 }, { p: [-0.02 + dx * 1.5, 0.095 + 0.0, 0.045], w: 0.005 }, { p: [-0.01 + dx * 2, 0.088, 0.07 + k * 0.006], w: 0.005 }], '#f0e2b8', { radial: 5, sub: 3 });
  }
  void c1;
  steam(B, 0.04, 0.1, -0.03, 0.026, 6, '#f5f5f2', 0.28);
  // cauldron on a stove at the back left
  const sy = stove(gp, -0.26, Y, -0.2, 0.22, 0.2, 0.12, '#a89276', 0.3, 0.075);
  const C = grp(gp, -0.26, sy, -0.2);
  vessel(C, [[0.04, -0.03], [0.075, 0.0], [0.09, 0.04], [0.088, 0.07], [0.095, 0.075]], 0.006, '#3a3634', null, 0, 0, 0, 30, 0.4, 0.4);
  fill(C, '#e8dcc0', 0, 0.06, 0, 0.083, 24, 0.1);
  noodleTangle(C, 0.058, 0.075, 6, 7);
  for (const sx of [-1, 1]) add(C, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#3a3634'), sx * 0.095, 0.075, 0, 0.018, 0.018, 0.018, Math.PI / 2);
  steam(C, 0, 0.07, 0, 0.03, 6, '#f5f5f2', 0.3);
  // cook stretching strands of dough between his hands
  const ck = who(gp, 0.18, Y, -0.22, { h: 0.37, ry: -0.35, pose: 'stand', top: '#d8d0bc', bottom: '#5a4a3a', dress: 'knee', sleeve: 0.5, hat: '#2a2018', hatStyle: 'knot', skin: '#c8916a',
    hands: [[-0.3, 0.68, 0.22], [0.3, 0.68, 0.22]] });
  const [ax, ay, az] = ck.handL, [bx, by, bz] = ck.handR;
  for (let k = 0; k < 7; k++) {
    const sag = 0.06 + k * 0.006, o = (k - 3) * 0.004;
    sweep(gp, [{ p: [ax, ay + o, az], w: 0.004 }, { p: [ax + (bx - ax) * 0.25, (ay + by) / 2 - sag * 0.75 + o, az + (bz - az) * 0.25 + o], w: 0.0035 },
      { p: [(ax + bx) / 2, (ay + by) / 2 - sag + o, (az + bz) / 2 + o], w: 0.0035 }, { p: [ax + (bx - ax) * 0.75, (ay + by) / 2 - sag * 0.75 + o, az + (bz - az) * 0.75 + o], w: 0.0035 }, { p: [bx, by + o, bz], w: 0.004 }],
      '#f2e8cc', { radial: 5, sub: 3 });
  }
  el(gp, '#f2e8cc', ax, ay, az, 0.016, 0.014, 0.014);
  el(gp, '#f2e8cc', bx, by, bz, 0.016, 0.014, 0.014);
  // dough board at the front right
  const D = grp(gp, 0.27, Y, 0.17, -0.4);
  rbox(D, '#c8a272', 0, 0, 0, 0.17, 0.016, 0.13, 0.004);
  add(D, DOME(), mat('#f2e8cc', { flat: false }), -0.03, 0.016, 0, 0.045, 0.03, 0.04);
  for (let k = 0; k < 5; k++) sweep(D, [{ p: [0.02, 0.02, -0.04 + k * 0.012], w: 0.004 }, { p: [0.05, 0.022, -0.035 + k * 0.012], w: 0.004 }, { p: [0.075, 0.02, -0.04 + k * 0.014], w: 0.004 }], '#f2e8cc', { radial: 5, sub: 3 });
  heap(D, 0.04, 0.016, 0.045, 0.03, 0.005, '#f0ebe0');
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// TANG HU-BING BAKERY (胡饼) — a round clay tannur oven glowing inside, sesame flatbreads slapped on its inner wall, a
// stack of golden sesame breads on a cloth, dough balls on a tray, and a Sogdian baker in a pointed felt cap and
// lapelled kaftan reaching in with a bread cushion; a resting camel with saddle bags behind.
// ---------------------------------------------------------------------------------------------------------
function bing(p: THREE.Object3D, x: number, y: number, z: number, r: number, ry = 0, rx = 0, rz = 0): void {
  const geo = g('lf-bing', () => {
    const pts: [number, number][] = [[0, 0], [0.8, 0], [0.98, 0.2], [1, 0.5], [0.93, 0.85], [0.82, 0.9], [0.75, 0.6], [0, 0.55]];
    return paintFaces(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 20), '#ffffff', (px, py, pz) => {
      const rr = Math.hypot(px, pz);
      if (py > 0.5 && rr < 0.74) return hash3(Math.floor(px * 14), Math.floor(pz * 14), 3) > 0.55 ? '#f4e6c0' : '#dcc29a';
      return py > 0.7 ? '#a85e24' : '#cfa070';
    });
  });
  add(p, geo, mat('#ffffff', { vc: true, flat: false, rough: 0.6 }), x, y, z, r, r * 0.22, r, ry, rx, rz);
}
const lf_hubing: Builder = gp => {
  base(gp, tiles('#b59a76', 0.1), '#6e5638');
  // tannur: thick clay drum, glowing interior, breads on the inner wall
  const ox = -0.08, oz = -0.04, O = grp(gp, ox, Y, oz);
  const oo: [number, number][] = [[0.17, 0], [0.185, 0.06], [0.18, 0.14], [0.16, 0.2], [0.14, 0.235], [0.128, 0.24]];
  plathe(O, [[0, 0], ...dense(oo, 0.015), [0.11, 0.24]], '#b07a4e', (px, py, pz) => {
    if (py > 0.235) return '#5a3420';
    return shade('#b07a4e', 0.86 + fbm(px * 30, py * 30, pz * 30, 2) * 0.28);
  }, 0, 0, 0, 36);
  const inner = new THREE.LatheGeometry([[0.03, 0.06], [0.11, 0.07], [0.13, 0.14], [0.112, 0.238]].map(([a, b]) => new THREE.Vector2(a, b)), 28, 0, TAU);
  inner.scale(-1, 1, 1);
  glow(add(O, inner, mat('#ff8a3a'), 0, 0, 0, 1, 1, 1), '#ff9a4a', '#e05a10');
  glow(add(O, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#ff7a1a'), 0, 0.064, 0, 0.06, 0.008, 0.06), '#ffb050', '#ff5a00');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3, rr = 0.118, yy = 0.19 - (i % 2) * 0.045;
    const w = grp(O, Math.cos(a) * rr, yy, Math.sin(a) * rr);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(a), 0.35, -Math.sin(a)).normalize());
    bing(w, 0, 0, 0, 0.04);
  }
  // fire port at the front
  box(O, '#3a1e12', -0.03, 0.0, 0.17, 0.06, 0.05, 0.03);
  glow(box(O, '#ff8a2a', -0.03, 0.004, 0.182, 0.046, 0.036, 0.006), '#ffa040', '#ff5a00');
  const fl = grp(O, -0.03, 0.006, 0.19);
  fl.name = 'flicker';
  for (const [dx, r, hh] of [[0, 0.014, 0.04], [-0.012, 0.009, 0.028], [0.012, 0.009, 0.028]] as const) add(fl, g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7)), mat('#ffb347', { emissive: '#ff7a1a' }), dx, hh / 2, 0, r, hh, r);
  steam(O, 0.0, 0.245, 0.0, 0.026, 5, '#d8d0c4', 0.22);
  // stack of sesame breads on a cloth
  slab(grp(gp, 0.2, Y + 0.002, 0.2, 0.3), [[-0.13, -0.11], [0.13, -0.12], [0.12, 0.12], [-0.13, 0.11]], 0.003, '#d8c8a2', 0, false).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 6; i++) bing(gp, 0.2 + Math.sin(i * 2.1) * 0.006, Y + 0.005 + i * 0.016, 0.2 + Math.cos(i * 1.7) * 0.006, 0.07, i);
  bing(gp, 0.08, Y + 0.04, 0.28, 0.065, 0.4, -1.1, 0);
  // tray of dough balls
  const T = grp(gp, -0.24, Y, 0.24, 0.3);
  rbox(T, '#9a764a', 0, 0, 0, 0.16, 0.014, 0.12, 0.004);
  for (let i = 0; i < 6; i++) add(T, DOME(), mat('#f0e2c4', { flat: false }), -0.05 + (i % 3) * 0.05, 0.014, -0.025 + Math.floor(i / 3) * 0.05, 0.02, 0.016, 0.02);
  // Sogdian baker: pointed felt cap, lapelled red kaftan, boots, beard
  const bk = who(gp, 0.17, Y, -0.17, { h: 0.37, ry: -1.9, pose: 'stand', lean: 0.3, top: '#9a2e24', bottom: '#4a3a2a', dress: 'knee', shoes: '#2a1c14', skin: '#d2a07a', hair: '#3a2416',
    hands: [[-0.06, 0.6, 0.32], [0.08, 0.66, 0.36]] });
  const [hx, hy, hz] = bk.head;
  cone(gp, '#e8dcc0', hx, hy + 0.02, hz, 0.026, 0.07, 10);
  el(gp, '#3a2416', hx - 0.022, hy - 0.022, hz + 0.008, 0.016, 0.02, 0.014);
  const [px2, py2, pz2] = bk.handR;
  el(gp, '#e0d0a8', px2, py2, pz2, 0.032, 0.012, 0.032, 0, 0, 1.0);
  // sacks of flour and sesame, a water jar
  sack(gp, -0.33, -0.2, 1.0, 0.4, '#f0ebe0', '#d8ccae');
  sack(gp, -0.2, -0.32, 0.85, 1.2, '#efe6cc', '#c4a676');
  const Wj = grp(gp, 0.33, Y, -0.04);
  vessel(Wj, dense([[0.04, 0], [0.065, 0.05], [0.06, 0.1], [0.035, 0.13], [0.04, 0.14]], 0.012), 0.005, '#7a5a3e', (px, py, pz) => (Math.abs(py - 0.09) < 0.004 ? '#4e3626' : null), 0, 0, 0, 22, 0.4);
  fill(Wj, '#3a5a6a', 0, 0.12, 0, 0.034, 16, 0.05);
  fuse(gp);
};

/** Re-material a vertex-coloured mesh (sweep, plathe) as glossy / glazed. */
const shine = (m: THREE.Mesh, rough = 0.22, metal = 0.05) => { m.material = mat('#ffffff', { vc: true, flat: false, rough, metal }); return m; };
/** A person kneeling back on the heels (正坐), unit-space hand targets. */
const seiza = (p: THREE.Object3D, x: number, z: number, o: Partial<HumanOpts> & { h: number; top: string }): HumanRig =>
  who(p, x, Y, z, { pose: 'kneel', hipY: 0.2, feet: [[-0.07, 0.032, -0.06], [0.07, 0.032, -0.06]], ...o });

// ---------------------------------------------------------------------------------------------------------
// TEA CULTURE — 'tang' (default): Lu Yu's boiled tea (煎茶) on a reed mat: a three-legged bronze brazier (风炉) with
// a glowing window, the flat iron kettle (鍑) boiling with froth, a tea cake and the boat-shaped roller (茶碾), Yue
// celadon bowls, a water jar and the kneeling scholar stirring. 'song': a Song tea contest (斗茶): black Jian hare's-fur
// bowls brimming with white whisked froth on red lacquer stands, a slender ewer on a brazier, bamboo whisks (茶筅)
// and two scholars whisking against each other.
// ---------------------------------------------------------------------------------------------------------
const JIAN = '#1e1612';
const hareFur: Paint = (x, y, z) => (y > 0.004 && Math.sin(ang(x, z) * 70 + y * 30) > 0.55 ? '#6a3a1c' : null);
function jianBowl(p: THREE.Object3D, x: number, y: number, z: number, s: number, froth = true, stand = true): void {
  const b = grp(p, x, y, z, 0, s);
  if (stand) {
    plathe(b, [[0, 0], [0.04, 0], [0.034, 0.02], [0.03, 0.03], [0.06, 0.032], [0.062, 0.04], [0, 0.04]], '#9a1c18', null, 0, 0, 0, 24, 0.3);
  }
  const by = stand ? 0.04 : 0;
  vessel(b, dense([[0.022, by], [0.024, by + 0.008], [0.05, by + 0.03], [0.068, by + 0.052], [0.07, by + 0.056]], 0.006), 0.004, JIAN, (px, py, pz) => (py < by + 0.008 ? '#8a6a4a' : hareFur(px, py - by, pz, 0, 0, 0)), 0, 0, 0, 30, 0.12);
  if (froth) heap(b, 0, by + 0.046, 0, 0.062, 0.008, '#f6f2e6', (px, py, pz) => (hash3(Math.floor(px * 500), Math.floor(py * 500), Math.floor(pz * 500)) > 0.8 ? '#e4dccb' : '#faf7ee'), 24);
}
function whisk(p: THREE.Object3D, x: number, y: number, z: number, s: number, rx = 0, rz = 0): void {
  const w = grp(p, x, y, z, 0, s);
  w.rotation.set(rx, 0, rz);
  cyl(w, '#c8a868', 0, 0.035, 0, 0.007, 0.05, 8);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; rod(w, [Math.cos(a) * 0.005, 0.035, Math.sin(a) * 0.005], [Math.cos(a) * 0.016, 0.0, Math.sin(a) * 0.016], 0.0012, '#e0c890', 3); }
}
function ewer(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, c = '#d8dcd0'): void {
  const e = grp(p, x, y, z, ry, s);
  plathe(e, dense([[0, 0], [0.03, 0], [0.042, 0.04], [0.04, 0.07], [0.02, 0.1], [0.012, 0.13], [0.016, 0.135], [0, 0.135]], 0.01), c, null, 0, 0, 0, 22, 0.25);
  sweep(e, [{ p: [0.035, 0.05, 0], w: 0.009 }, { p: [0.06, 0.08, 0], w: 0.006 }, { p: [0.07, 0.11, 0], w: 0.004 }], c, { radial: 7, sub: 4 });
  sweep(e, [{ p: [-0.014, 0.12, 0], w: 0.004 }, { p: [-0.05, 0.11, 0], w: 0.004 }, { p: [-0.045, 0.06, 0], w: 0.004 }, { p: [-0.035, 0.045, 0], w: 0.004 }], c, { radial: 5, sub: 4 });
}
const lf_tea: Builder = (gp, r) => {
  if (r.style === 'song') {
    base(gp, tiles('#8a7f70', 0.1, false), '#4e463c');
    // low table with the contest set
    const ty = table(gp, 0, Y, -0.08, 0.42, 0.18, 0.1, '#5a2418');
    jianBowl(gp, -0.1, ty, -0.08, 1.2);
    jianBowl(gp, 0.1, ty, -0.08, 1.2);
    whisk(gp, 0.0, ty, -0.04, 1.4, 0, 0.0);
    const cad = grp(gp, -0.17, ty, -0.12);
    plathe(cad, [[0, 0], [0.025, 0], [0.026, 0.04], [0.02, 0.05], [0.006, 0.055], [0, 0.058]], '#5a2a1a', null, 0, 0, 0, 16, 0.25);
    // the hero bowl on the floor-front: brimming froth, whisk resting
    jianBowl(gp, 0.0, Y, 0.2, 2.0);
    whisk(gp, 0.12, Y + 0.004, 0.27, 1.6, 0, 1.35);
    // ewer heating on a small brazier
    const bx = 0.3, bz = 0.12;
    plathe(gp, [[0, 0], [0.06, 0], [0.065, 0.06], [0.05, 0.07], [0, 0.07]], '#5a564c', null, bx, Y, bz, 20, 0.4, 0.3);
    glow(cyl(gp, '#ff7a1a', bx, Y + 0.066, bz, 0.04, 0.006, 12), '#ff9a40', '#ff4a00');
    ewer(gp, bx, Y + 0.07, bz, 1.0, -2.2, '#d8d8cc');
    steam(gp, bx - 0.04, Y + 0.18, bz - 0.04, 0.016, 4, '#f5f5f2', 0.24);
    // spare whisk stand, a small ewer and tea powder bowl at the left
    const pw = grp(gp, -0.28, Y, 0.16);
    vessel(pw, [[0.03, 0], [0.05, 0.02], [0.055, 0.03]], 0.004, '#e8e4d8', null, 0, 0, 0, 20, 0.25);
    heap(pw, 0, 0.022, 0, 0.048, 0.014, '#7a9a4a');
    whisk(gp, -0.2, Y, 0.28, 1.4);
    // two contestants in Song dress, each whisking a bowl
    for (const sx of [-1, 1]) {
      const a = fig(gp, { x: sx * 0.22, y: Y, z: -0.27, ry: -sx * 0.45, h: 0.37, outfit: 'robe', top: sx < 0 ? '#3a5a7a' : '#6a4a6a', accent: '#d8cba8', hat: 'futou', hatColor: '#1a1612', beard: sx < 0 ? 'long' : 'short', beardColor: '#1a1410', wideSleeves: true,
        armL: { fwd: 1.0, side: 0.25, bend: 1.2, inward: 0.3 }, armR: { fwd: 0.9, side: 0.15, bend: 1.3, inward: 0.4 } });
      const [lx, ly, lz] = a.handL, [rx, ry, rz] = a.handR;
      const mx = (lx + rx) / 2, mz = (lz + rz) / 2;
      jianBowl(gp, mx, Math.min(ly, ry) - 0.03, mz, 0.85, true, false);
      whisk(gp, rx, ry - 0.04, rz, 0.9, 0, 0.3 * sx);
    }
  } else {
    base(gp, matting('#c2a46a', 0.022), '#6a5232');
    // brazier: three legs, drum body with a glowing window, fu kettle on top
    const B = grp(gp, -0.02, Y, -0.02);
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + Math.PI / 2; sweep(B, [{ p: [Math.cos(a) * 0.085, 0, Math.sin(a) * 0.085], w: 0.012 }, { p: [Math.cos(a) * 0.08, 0.04, Math.sin(a) * 0.08], w: 0.014 }], BRZ, { radial: 7, sub: 2 }); }
    vessel(B, dense([[0.075, 0.035], [0.09, 0.05], [0.095, 0.13], [0.105, 0.14]], 0.01), 0.008, BRZ, (px, py, pz) => (Math.abs(py - 0.12) < 0.006 && Math.sin(ang(px, pz) * 30) > 0 ? BRZD : null), 0, 0, 0, 32, 0.4, 0.45);
    box(B, '#2a1a12', 0, 0.06, 0.088, 0.05, 0.045, 0.02);
    glow(box(B, '#ff8a2a', 0, 0.064, 0.097, 0.042, 0.036, 0.004), '#ffa040', '#ff5a00');
    glow(add(B, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#ff7a1a'), 0, 0.12, 0, 0.07, 0.01, 0.07), '#ff9440', '#ff4d00');
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; box(B, BRZD, Math.cos(a) * 0.09, 0.14, Math.sin(a) * 0.09, 0.02, 0.016, 0.02); }
    const K = grp(B, 0, 0.155, 0);
    vessel(K, dense([[0.05, 0], [0.11, 0.02], [0.125, 0.05], [0.12, 0.07], [0.13, 0.075]], 0.008), 0.006, '#3a3634', null, 0, 0, 0, 36, 0.45, 0.4);
    for (const sx of [-1, 1]) { box(K, '#3a3634', sx * 0.12, 0.07, -0.015, 0.012, 0.03, 0.006); box(K, '#3a3634', sx * 0.12, 0.07, 0.015, 0.012, 0.03, 0.006); box(K, '#3a3634', sx * 0.12, 0.096, 0, 0.012, 0.006, 0.036); }
    fill(K, '#8a8a4a', 0, 0.064, 0, 0.115, 30, 0.1);
    heap(K, 0, 0.062, 0, 0.06, 0.01, '#f2eedc', (px, py, pz) => (hash3(Math.floor(px * 500), Math.floor(py * 500), Math.floor(pz * 500)) > 0.75 ? '#d8d4b0' : null));
    for (let i = 0; i < 6; i++) dot(K, '#f4f0e0', Math.cos(i * 1.1) * 0.085, 0.066, Math.sin(i * 1.1) * 0.085, 0.008, 6);
    steam(K, 0.01, 0.08, 0, 0.022, 5, '#f5f5f2', 0.26);
    // scholar kneeling, stirring with bamboo tongs
    const sc = seiza(gp, -0.22, -0.24, { h: 0.34, ry: 0.65, top: '#6a7a5a', bottom: '#4a4a3a', dress: 'knee', hat: '#1a1612', hatStyle: 'cap', skin: '#d8a882', lean: 0.2,
      hands: [[-0.06, 0.48, 0.3], [0.08, 0.55, 0.36]] });
    const [hx, hy, hz] = sc.handR;
    rod(gp, [hx, hy, hz], [-0.0, Y + 0.24, 0.0], 0.003, '#c8a868', 4);
    // tea roller (茶碾) and wheel, with ground tea
    const T = grp(gp, 0.24, Y, 0.17, -0.5);
    rbox(T, '#5a5450', 0, 0, 0, 0.2, 0.04, 0.055, 0.008);
    box(T, '#2e2a26', 0, 0.039, 0, 0.17, 0.003, 0.016);
    heap(T, -0.05, 0.04, 0, 0.012, 0.004, '#6a7a3a');
    const wh = cyl(T, '#6a6460', 0.03, 0.06, 0, 0.032, 0.012, 20);
    wh.rotation.x = Math.PI / 2; wh.position.set(0.03, 0.06, 0);
    rod(T, [0.03, 0.06, -0.05], [0.03, 0.06, 0.05], 0.005, '#6b4a2a', 6);
    // tea cake with a hole, a broken piece, on a paper
    slab(grp(gp, 0.02, Y + 0.002, 0.27, 0.2), [[-0.09, -0.07], [0.09, -0.07], [0.09, 0.07], [-0.09, 0.07]], 0.002, '#e6dcc0', 0, false).rotation.x = -Math.PI / 2;
    plathe(gp, [[0.012, 0], [0.06, 0], [0.065, 0.008], [0.06, 0.016], [0.012, 0.016]], '#4a3a22', (px, py, pz) => (py > 0.015 && hash3(Math.floor(px * 300), 1, Math.floor(pz * 300)) > 0.7 ? '#6a5a32' : null), -0.01, Y + 0.004, 0.27, 28);
    el(gp, '#4a3a22', 0.07, Y + 0.012, 0.29, 0.025, 0.008, 0.018, 0.6);
    // Yue celadon bowls on a tray, a water jar with a gourd ladle
    rbox(gp, '#4a2418', -0.25, Y, 0.16, 0.2, 0.012, 0.13, 0.004, 0.3);
    for (const [cx, cz] of [[-0.3, 0.13], [-0.21, 0.12], [-0.26, 0.2]] as const) {
      vessel(gp, dense([[0.02, 0], [0.025, 0.005], [0.045, 0.025], [0.05, 0.034]], 0.006), 0.003, CELADON, null, cx, Y + 0.012, cz, 26, 0.15);
      fill(gp, '#a8a050', cx, Y + 0.04, cz, 0.044, 20, 0.08);
      heap(gp, cx, Y + 0.04, cz, 0.025, 0.004, '#f2eedc');
    }
    const W = grp(gp, 0.25, Y, -0.22);
    vessel(W, dense([[0.04, 0], [0.065, 0.04], [0.065, 0.09], [0.05, 0.12], [0.052, 0.125]], 0.012), 0.005, '#7a8a6a', null, 0, 0, 0, 24, 0.25);
    fill(W, '#4a6a7a', 0, 0.11, 0, 0.045, 16, 0.05);
    rod(W, [0.0, 0.11, 0], [0.06, 0.19, 0.02], 0.003, '#c8a868', 4);
    el(W, '#c8a060', 0.01, 0.112, 0, 0.022, 0.012, 0.018);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DONGPO PORK (东坡肉) — a lidded sand-pot on a little charcoal stove, packed with glossy red-brown braised pork-belly
// squares tied with straw (skin, fat and lean in layers), a single square served on a plate with greens, a jar of
// yellow wine; behind, a corner of West Lake with a stone arch bridge and willows and Su Shi in his tall cap.
// ---------------------------------------------------------------------------------------------------------
function porkCube(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0): void {
  const P = grp(p, x, y, z, ry, s);
  const geo = g('lf-pork', () => paintFaces(new THREE.BoxGeometry(1, 1, 1, 3, 8, 3), '#ffffff', (_px, py, _pz, _nx, ny) => {
    if (ny > 0.7) return '#7a2a10';
    const t = py + 0.5;
    if (t > 0.86) return '#8a3010';
    if (t > 0.7) return '#e8c08a';
    if (t > 0.52) return '#9a4a26';
    if (t > 0.38) return '#e0b080';
    if (t > 0.16) return '#8a3e20';
    return '#d8a672';
  }));
  add(P, geo, mat('#ffffff', { vc: true, flat: false, rough: 0.2, metal: 0.05 }), 0, 0.5, 0, 1, 1, 1);
  for (const [a, b] of [[0, 1], [Math.PI / 2, 1]] as const) {
    add(P, g('lf-strw', () => new THREE.TorusGeometry(0.58, 0.035, 4, 4)), mat('#d8b860'), 0, 0.5, 0, 1, b * 1.18, 1, a, 0, Math.PI / 4).rotation.set(0, a, Math.PI / 4);
  }
  dot(P, '#d8b860', 0, 1.02, 0, 0.06, 6);
}
function willow(p: THREE.Object3D, x: number, z: number, h: number): void {
  sweep(p, [{ p: [x, Y, z], w: 0.02 }, { p: [x + 0.015, Y + h * 0.45, z], w: 0.014 }, { p: [x - 0.005, Y + h * 0.8, z + 0.01], w: 0.011 }], '#4e3a28', { radial: 7, sub: 3 });
  const top: V3 = [x - 0.005, Y + h * 0.8, z + 0.01];
  for (let k = 0; k < 5; k++) { const a = k * 1.3; rod(p, top, [top[0] + Math.cos(a) * 0.06, top[1] + 0.05, top[2] + Math.sin(a) * 0.05], 0.004, '#4e3a28', 4); }
  for (let k = 0; k < 22; k++) {
    const a = k * 2.4, rr = 0.025 + (k % 4) * 0.018, sx = top[0] + Math.cos(a) * rr, sz = top[2] + Math.sin(a) * rr, sy = top[1] + 0.06 - rr * 0.5;
    const L = h * (0.45 + hash3(k, 3, 1) * 0.3);
    sweep(p, [{ p: [sx, sy, sz], w: 0.005 }, { p: [sx + Math.cos(a) * 0.025, sy - 0.01, sz + Math.sin(a) * 0.025], w: 0.006 }, { p: [sx + Math.cos(a) * 0.035, sy - L * 0.5, sz + Math.sin(a) * 0.035], w: 0.005 }, { p: [sx + Math.cos(a) * 0.04, sy - L, sz + Math.sin(a) * 0.04], w: 0.002 }],
      k % 3 ? '#9cc85a' : '#86b648', { radial: 4, sub: 3 });
  }
}
const lf_dongpo: Builder = gp => {
  base(gp, planks('#6a3a22', 0.09), '#3e2214');
  // West Lake corner (back left): water, arch bridge, willows
  water(gp, clipRect(-0.5, -0.02, -0.5, -0.2, 0.44), Y + 0.003, '#8ab0a8');
  const Br = grp(gp, -0.2, Y, -0.32, 0.2);
  const hole = archPath(0, -0.01, 0.12, 0.07);
  const sh = new THREE.Shape([new THREE.Vector2(-0.14, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0.1, 0.07), new THREE.Vector2(0.05, 0.085), new THREE.Vector2(-0.05, 0.085), new THREE.Vector2(-0.1, 0.07)]);
  sh.holes.push(hole);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 10 });
  bg.translate(0, 0, -0.025);
  add(Br, bg, mat('#b8b0a0'), 0, 0, 0, 1, 1, 1);
  for (let k = 0; k < 7; k++) cyl(Br, '#a8a090', -0.09 + k * 0.03, 0.08 - Math.abs(k - 3) * 0.004, 0.022, 0.004, 0.02, 5);
  willow(gp, -0.37, -0.12, 0.26);
  willow(gp, 0.02, -0.4, 0.24);
  // charcoal stove and the sand pot of pork
  const sx = 0.04, sz = 0.04;
  plathe(gp, [[0, 0], [0.12, 0], [0.13, 0.06], [0.12, 0.075], [0, 0.075]], '#8a6a4a', (px, py, pz) => (py > 0.07 ? '#5a3a24' : Math.sin(ang(px, pz) * 12) > 0.9 ? '#6e5038' : null), sx, Y, sz, 28);
  box(gp, '#2a1a12', sx, Y + 0.015, sz + 0.118, 0.06, 0.03, 0.02);
  glow(box(gp, '#ff8a2a', sx, Y + 0.018, sz + 0.128, 0.05, 0.024, 0.004), '#ffa040', '#ff5a00');
  const P = grp(gp, sx, Y + 0.075, sz);
  const po: [number, number][] = [[0.08, 0], [0.13, 0.02], [0.165, 0.06], [0.17, 0.09], [0.178, 0.1]];
  vessel(P, dense(po, 0.01), 0.008, '#4a3a32', (px, py, pz) => (py > 0.092 ? '#c8b8a0' : Math.abs(py - 0.05) < 0.004 ? '#2e2420' : null), 0, 0, 0, 36, 0.55);
  for (const s2 of [-1, 1]) add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#4a3a32'), s2 * 0.172, 0.08, 0, 0.022, 0.022, 0.022, Math.PI / 2);
  fill(P, '#6a1e0c', 0, 0.075, 0, 0.16, 30, 0.12);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i !== 1 && j !== 1)) porkCube(P, (i - 1) * 0.085, 0.052, (j - 1) * 0.085, 0.074, (i + j) * 0.08 - 0.1);
  for (const [cx, cz] of [[-0.075, -0.075], [0.08, 0.075], [-0.08, 0.08], [0.075, -0.08]] as const) porkCube(P, cx, 0.048, cz, 0.066, cx * 3);
  for (let i = 0; i < 6; i++) dot(P, '#3a7a2a', Math.cos(i * 1.3) * 0.13, 0.078, Math.sin(i * 1.3) * 0.13, 0.006, 5);
  steam(P, -0.03, 0.14, -0.02, 0.022, 5, '#f5f5f2', 0.26);
  // a served square on a plate with greens
  const py = plate(gp, -0.2, Y, 0.24, 0.1, bwPaint(0.1));
  for (let i = 0; i < 5; i++) el(gp, '#3e8a2e', -0.2 + Math.cos(i * 1.25) * 0.055, py + 0.004, 0.24 + Math.sin(i * 1.25) * 0.055, 0.028, 0.005, 0.014, -i * 1.25);
  porkCube(gp, -0.2, py, 0.24, 0.085, 0.3);
  fill(gp, '#6a1e0c', -0.2, py + 0.001, 0.24, 0.07, 20, 0.1);
  chopsticks(gp, -0.08, Y, 0.33, 0.2);
  // yellow wine jar and cup
  const J = grp(gp, 0.3, Y, 0.18);
  vessel(J, dense([[0.035, 0], [0.06, 0.04], [0.055, 0.09], [0.03, 0.11], [0.034, 0.12]], 0.012), 0.005, '#6a4a32', (_px, py2) => (py2 > 0.06 && py2 < 0.09 ? '#c83a2a' : null), 0, 0, 0, 22, 0.4);
  vessel(gp, [[0.012, 0], [0.022, 0.02], [0.024, 0.024]], 0.002, BW, null, 0.2, Y, 0.32, 16, 0.25);
  // Su Shi in his tall cap, holding up a cup
  fig(gp, { x: 0.28, y: Y, z: -0.26, ry: -0.5, h: 0.33, outfit: 'robe', top: '#e8e0cc', accent: '#3a4a5a', hat: 'fangjin', hatColor: '#1a1612', beard: 'long', beardColor: '#2a221a', wideSleeves: true,
    armL: { fwd: 0.3, side: 0.1, bend: 0.4 }, armR: { fwd: 1.3, side: 0.2, bend: 1.4 } });
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SWEET RICE BALLS (汤圆/元宵) — Lantern Festival table: a big blue-and-white bowl of glossy white balls floating in
// osmanthus-sweet soup, a spoon holding a ball cut in half to show the black sesame filling, more bowls, a tray of
// raw balls and the sesame paste; a frame of glowing red lanterns with gold tassels above.
// ---------------------------------------------------------------------------------------------------------
function lantern(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  const L = grp(p, x, y, z);
  glow(add(L, g('lf-lant', () => new THREE.SphereGeometry(1, 16, 10)), mat('#e8302a'), 0, 0, 0, r, r * 0.85, r), '#ff4a3a', '#c81e1e');
  for (const s of [-1, 1]) cyl(L, '#e8b23a', 0, s > 0 ? r * 0.8 : -r * 0.95, 0, r * 0.45, r * 0.15, 12);
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; rod(L, [Math.cos(a) * r * 0.2, -r * 0.95, Math.sin(a) * r * 0.2], [Math.cos(a) * r * 0.3, -r * 1.9, Math.sin(a) * r * 0.3], r * 0.06, '#e8b23a', 3); }
  rod(L, [0, r * 0.95, 0], [0, r * 1.5, 0], r * 0.05, '#3a2a1a', 3);
}
function tangyuan(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  add(p, ELG(), mat('#fbfaf4', { flat: false, rough: 0.18 }), x, y, z, r, r * 0.88, r);
}
const lf_tangyuan: Builder = gp => {
  base(gp, planks('#7a2a1e', 0.08), '#4a1a12');
  // hero bowl
  const B = grp(gp, -0.04, Y, 0.06);
  const bo: [number, number][] = [[0.07, 0], [0.075, 0.012], [0.12, 0.04], [0.16, 0.09], [0.168, 0.1]];
  vessel(B, dense(bo, 0.008), 0.006, BW, (px, py, pz) => {
    if (py < 0.013) return COB;
    if (py > 0.085) return Math.sin(ang(px, pz) * 22) > 0.2 ? COB : null;
    const a = ang(px, pz), f = Math.sin(a * 5) * 0.012;
    if (Math.abs(py - 0.05 - f) < 0.006) return COB;
    if (py > 0.02 && py < 0.08 && Math.sin(a * 15 + py * 120) > 0.92) return COB;
    return null;
  }, 0, 0, 0, 44, 0.2);
  fill(B, '#e8d6a6', 0, 0.084, 0, 0.152, 32, 0.08);
  const balls: [number, number][] = [[0, 0], [0.07, 0.03], [-0.06, 0.05], [-0.03, -0.07], [0.05, -0.06], [0.1, -0.02], [-0.1, -0.01], [0.02, 0.1]];
  for (const [bx, bz] of balls) tangyuan(B, bx, 0.088, bz, 0.034);
  for (let i = 0; i < 14; i++) dot(B, '#f0a020', Math.cos(i * 2.2) * 0.12 * (0.3 + (i % 4) / 4), 0.087, Math.sin(i * 2.2) * 0.12 * (0.3 + (i % 4) / 4), 0.004, 5);
  steam(B, -0.02, 0.11, -0.02, 0.022, 5, '#f5f5f2', 0.26);
  // porcelain spoon with a ball cut in half (black sesame)
  const S = grp(gp, 0.22, Y, 0.24, -0.6, 1.4);
  vessel(S, [[0.02, 0], [0.03, 0.01], [0.034, 0.018]], 0.003, BW, null, 0, 0, 0, 20, 0.2).scale.set(1.2, 1, 0.9);
  sweep(S, [{ p: [0.03, 0.015, 0], w: 0.012, h: 0.005 }, { p: [0.08, 0.03, 0], w: 0.01, h: 0.005 }, { p: [0.1, 0.035, 0], w: 0.008, h: 0.004 }], BW, { radial: 6, sub: 3 });
  const C = grp(S, -0.002, 0.026, 0);
  C.rotation.set(0.45, 0.6, 0);
  add(C, new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, Math.PI / 2), mat('#fbfaf4', { flat: false, rough: 0.2 }), 0, 0, 0, 0.03, 0.026, 0.03, 0, Math.PI, 0);
  add(C, new THREE.CircleGeometry(0.66, 24), mat('#1a1614', { flat: false, rough: 0.35 }), 0, 0.0012, 0, 0.03, 0.03, 0.03, 0, -Math.PI / 2, 0);
  add(C, new THREE.RingGeometry(0.64, 1, 24, 1), mat('#fbfaf4', { flat: false, rough: 0.3 }), 0, 0.001, 0, 0.03, 0.03, 0.03, 0, -Math.PI / 2, 0);
  sweep(C, [{ p: [0.012, 0.002, 0.004], w: 0.006 }, { p: [0.028, -0.004, 0.006], w: 0.005 }, { p: [0.032, -0.014, 0.006], w: 0.003 }], '#1a1614', { radial: 5, sub: 3 });
  // two more bowls and the raw-ball tray, sesame paste bowl
  for (const [bx, bz, rr] of [[0.25, -0.05, 0.085], [-0.28, 0.2, 0.085]] as const) {
    const b2 = grp(gp, bx, Y, bz);
    vessel(b2, dense([[0.04, 0], [0.07, 0.025], [rr, 0.055]], 0.008), 0.005, BW, (px, py, pz) => (py > 0.045 && Math.sin(ang(px, pz) * 18) > 0.3 ? COB : Math.abs(py - 0.025) < 0.004 ? COB : null), 0, 0, 0, 28, 0.2);
    fill(b2, '#f0d8c4', 0, 0.045, 0, rr - 0.01, 24, 0.08);
    for (let i = 0; i < 4; i++) tangyuan(b2, Math.cos(i * 1.6) * 0.035, 0.048, Math.sin(i * 1.6) * 0.035, 0.022);
  }
  const T = grp(gp, -0.26, Y, -0.08, 0.3);
  vessel(T, [[0.1, 0], [0.11, 0.02]], 0.005, '#c8a468', (px, py, pz) => (Math.sin(ang(px, pz) * 40) > 0.6 ? '#a8844c' : null), 0, 0, 0, 30);
  heap(T, 0, 0.004, 0, 0.1, 0.006, '#f2eee4');
  for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = 0.025 + (i % 4) * 0.02; tangyuan(T, Math.cos(a) * rr, 0.026, Math.sin(a) * rr, 0.018); }
  const Sp = grp(gp, 0.09, Y, -0.2);
  vessel(Sp, [[0.03, 0], [0.05, 0.02], [0.055, 0.03]], 0.004, '#e8e4d8', null, 0, 0, 0, 20, 0.25);
  heap(Sp, 0, 0.02, 0, 0.05, 0.014, '#221c18');
  // lantern frame
  for (const sx of [-1, 1]) cyl(gp, '#5a2a1a', sx * 0.36, Y, -0.3, 0.01, 0.42, 8);
  rod(gp, [-0.38, Y + 0.42, -0.3], [0.38, Y + 0.42, -0.3], 0.008, '#5a2a1a', 6);
  for (const [lx, ly, lr] of [[-0.2, 0.32, 0.05], [0.0, 0.3, 0.06], [0.2, 0.32, 0.05]] as const) { rod(gp, [lx, Y + 0.42, -0.3], [lx, Y + ly + lr * 1.4, -0.3], 0.002, '#3a2a1a', 3); lantern(gp, lx, Y + ly, -0.3, lr); }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// HOTPOT — 'mutton' (default): old-Beijing 涮羊肉: a brass chimney pot with glowing charcoal and smoke, broth with
// curling slices, plates of paper-thin marbled mutton, napa cabbage, tofu, sesame-sauce bowls, sugar garlic.
// 'chongqing': a wide iron pot of red chilli oil divided by a 九宫格 grid, chillies and Sichuan peppercorns bobbing,
// plates of tripe, beef, lotus root and duck blood, a cup of skewers and oil-and-garlic dipping bowls.
// ---------------------------------------------------------------------------------------------------------
const BRASS = '#c8963a';
const SLICE = () => g('lf-slice', () => paintFaces(new THREE.SphereGeometry(1, 12, 6), '#b8404a', (x, _y, z) => { const v = Math.sin(x * 11 + Math.sin(z * 5) * 1.6); return v > 0.82 ? '#f4e0da' : v < -0.9 ? '#e8c4c0' : null; }));
const slice = (p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, rx = 0.25, c = '#ffffff') =>
  add(p, SLICE(), mat(c, { vc: true, flat: false, rough: 0.5 }), x, y, z, s, s * 0.08, s * 0.65, ry, rx, 0);
function slicePlate(p: THREE.Object3D, x: number, z: number, R: number, n: number, ry = 0, c = '#ffffff'): void {
  const py = plate(p, x, Y, z, R, bwPaint(R));
  for (let i = 0; i < n; i++) { const a = ry + (i / n) * Math.PI * 1.6 - 0.8; slice(p, x + Math.cos(a) * R * 0.45, py + 0.008 + i * 0.002, z + Math.sin(a) * R * 0.45, R * 0.5, -a + Math.PI / 2, 0.25, c); }
}
function dipBowl(p: THREE.Object3D, x: number, z: number, sauce: string, top: string[]): void {
  const b = grp(p, x, Y, z);
  vessel(b, [[0.022, 0], [0.04, 0.018], [0.046, 0.03]], 0.003, BW, (px, py, pz) => (Math.abs(py - 0.02) < 0.003 ? COB : null), 0, 0, 0, 22, 0.25);
  fill(b, sauce, 0, 0.026, 0, 0.04, 20, 0.2);
  top.forEach((c, i) => { for (let k = 0; k < 3; k++) dot(b, c, Math.cos(i * 2 + k * 2.1) * 0.02, 0.028, Math.sin(i * 2 + k * 2.1) * 0.02, 0.006 - i * 0.001, 5); });
}
const lf_hotpot: Builder = (gp, r) => {
  base(gp, planks('#5a3420', 0.09), '#3a2014');
  if (r.style === 'chongqing') {
    // ring stove and the wide pot
    const P = grp(gp, 0, Y, 0.0);
    plathe(P, [[0, 0], [0.16, 0], [0.17, 0.03], [0.15, 0.04], [0, 0.04]], '#3a3836', null, 0, 0, 0, 30, 0.4, 0.4);
    glow(add(P, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#3a7aff'), 0, 0.042, 0, 0.12, 0.004, 0.12), '#5a9aff', '#2a5aff');
    const R = 0.26;
    vessel(P, dense([[0.2, 0.04], [0.24, 0.05], [R, 0.1], [R + 0.006, 0.105]], 0.01), 0.006, '#2e2c2a', null, 0, 0, 0, 48, 0.35, 0.5);
    for (const s of [-1, 1]) add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#2e2c2a'), s * (R + 0.01), 0.095, 0, 0.026, 0.026, 0.026, Math.PI / 2);
    const oy = 0.09;
    add(P, g('lf-fill40', () => new THREE.CylinderGeometry(1, 1, 1, 40)), mat('#b8200e', { flat: false, rough: 0.12, metal: 0.1 }), 0, oy - 0.002, 0, R - 0.01, 0.004, R - 0.01);
    // 九宫格 grid
    for (const d of [-0.06, 0.06]) {
      const L = 2 * Math.sqrt((R - 0.01) ** 2 - d * d);
      box(P, '#6a6660', d, 0.06, 0, 0.005, 0.045, L);
      box(P, '#6a6660', 0, 0.06, d, L, 0.045, 0.005);
    }
    // chillies, peppercorns, sesame & bubbles
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / 46) * (R - 0.03), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(Math.abs(x) - 0.06) < 0.012 || Math.abs(Math.abs(z) - 0.06) < 0.012) continue;
      if (i % 3 !== 2) { gloss(P, i % 4 ? '#d01a10' : '#a01208', x, oy + 0.004, z, 0.022, 0.007, 0.008, a * 3); dot(P, '#3a6a1a', x + Math.cos(a * 3) * 0.022, oy + 0.006, z - Math.sin(a * 3) * 0.022, 0.004, 4); }
      else dot(P, '#5a1a10', x, oy + 0.003, z, 0.006, 5);
    }
    for (let i = 0; i < 30; i++) dot(P, '#3a1208', Math.cos(i * 1.7) * (0.04 + (i % 7) * 0.03), oy + 0.003, Math.sin(i * 1.7) * (0.04 + (i % 7) * 0.03), 0.0045, 4);
    gloss(P, '#e8c060', 0.0, oy + 0.004, 0.0, 0.03, 0.006, 0.03);
    steam(P, -0.1, oy + 0.03, -0.08, 0.025, 5, '#f0e8e0', 0.24);
    steam(P, 0.1, oy + 0.03, 0.06, 0.02, 4, '#f0e8e0', 0.22);
    // plates: tripe, beef, lotus root, duck blood
    const tripePy = plate(gp, -0.3, Y, 0.24, 0.1, null, '#f0f0ec');
    for (let i = 0; i < 6; i++) {
      const m = el(gp, '#d8cfb8', -0.3 + Math.cos(i * 1.05) * 0.04, tripePy + 0.008 + i * 0.002, 0.24 + Math.sin(i * 1.05) * 0.04, 0.045, 0.004, 0.02, i * 1.05);
      m.geometry = paintFaces(m.geometry.clone(), '#d8cfb8', (x, _y, z) => (Math.sin(x * 40) * Math.sin(z * 40) > 0.3 ? '#a89e88' : null));
      m.material = vcm(0.6);
    }
    slicePlate(gp, 0.3, 0.24, 0.1, 8, 0.4, '#ff9a90');
    const lp = plate(gp, 0.36, Y, -0.06, 0.08, null, '#f0f0ec');
    for (let i = 0; i < 5; i++) {
      const m = cyl(gp, '#f2ecd8', 0.36 + (i - 2) * 0.022, lp + 0.002, -0.06 + (i % 2) * 0.01, 0.03, 0.008, 16);
      m.geometry = paintFaces(m.geometry.clone(), '#f2ecd8', (x, y, z) => (y > 0.4 && [0, 1, 2, 3, 4, 5].some(k => Math.hypot(x - Math.cos(k * 1.05) * 0.28, z - Math.sin(k * 1.05) * 0.28) < 0.11) ? '#8a7a5a' : null));
      m.material = vcm(0.6); m.rotation.z = 0.5;
    }
    const dp = plate(gp, -0.36, Y, -0.06, 0.08, null, '#f0f0ec');
    for (let i = 0; i < 6; i++) rbox(gp, '#5a1018', -0.38 + (i % 3) * 0.028, dp + 0.001, -0.075 + Math.floor(i / 3) * 0.03, 0.024, 0.024, 0.024, 0.004, i * 0.2);
    // skewers in a cup, dipping bowls
    const C = grp(gp, 0.0, Y, 0.33);
    vessel(C, [[0.03, 0], [0.035, 0.08]], 0.004, '#c8b890', null, 0, 0, 0, 16);
    for (let k = 0; k < 9; k++) {
      const a = k * 0.7, tx = Math.cos(a) * 0.05, tz = Math.sin(a) * 0.04 - 0.02;
      rod(C, [0, 0.01, 0], [tx, 0.22, tz], 0.0018, '#d8c08a', 3);
      for (let j = 0; j < 3; j++) el(C, ['#c8384a', '#3a8a2a', '#e8dcc0', '#8a5a3a'][(k + j) % 4], tx * (0.6 + j * 0.14), 0.15 + j * 0.026, tz * (0.6 + j * 0.14), 0.012, 0.01, 0.01);
    }
    dipBowl(gp, -0.13, 0.33, '#d8a838', ['#f4f0e0', '#3a9a3a']);
    dipBowl(gp, 0.14, 0.34, '#d8a838', ['#f4f0e0', '#3a9a3a']);
    dipBowl(gp, -0.2, -0.33, '#d8a838', ['#f4f0e0', '#c02a1a']);
    chopsticks(gp, 0.22, Y + 0.002, -0.32, 0.3);
    chopsticks(gp, -0.06, Y + 0.002, -0.36, -0.2);
  } else {
    // brass chimney pot on its pedestal
    const P = grp(gp, 0, Y, 0.0);
    plathe(P, [[0, 0], [0.11, 0], [0.115, 0.015], [0.08, 0.04], [0.075, 0.09], [0, 0.09]], BRASS, (px, py, pz) => (py > 0.045 && py < 0.08 && Math.sin(ang(px, pz) * 8) > 0.6 ? '#2a1a10' : null), 0, 0, 0, 30, 0.3, 0.6);
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; if (Math.sin(a) > 0.2) glow(box(P, '#ff6a1a', Math.cos(a) * 0.079, 0.052, Math.sin(a) * 0.079, 0.016, 0.022, 0.004, -a + Math.PI / 2), '#ff8a3a', '#ff4a00'); }
    const R = 0.21;
    vessel(P, dense([[0.07, 0.085], [0.15, 0.095], [0.2, 0.13], [R, 0.16], [R + 0.008, 0.165]], 0.01), 0.006, BRASS, (_px, py) => (py > 0.155 ? '#a87a2a' : null), 0, 0, 0, 48, 0.28, 0.65);
    add(P, new THREE.RingGeometry(0.045, R - 0.008, 40, 1).rotateX(-Math.PI / 2), mat('#e8dcc0', { flat: false, rough: 0.1 }), 0, 0.15, 0, 1, 1, 1);
    // chimney with ember mouth and smoke
    plathe(P, [[0.05, 0.09], [0.042, 0.2], [0.04, 0.3], [0.052, 0.33], [0.058, 0.34], [0.046, 0.34], [0.034, 0.32]], BRASS, null, 0, 0, 0, 24, 0.28, 0.65);
    glow(add(P, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#ff7a1a'), 0, 0.335, 0, 0.036, 0.008, 0.036), '#ffa040', '#ff3a00');
    for (let k = 0; k < 6; k++) dot(P, '#ff9a3a', Math.cos(k) * 0.02, 0.338, Math.sin(k) * 0.02, 0.008, 5);
    P.children[P.children.length - 1].visible = true;
    const sm = steam(P, 0, 0.35, 0, 0.022, 5, '#8a8480', 0.32);
    void sm;
    // curls of mutton, cabbage and goji floating
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, rr = 0.1 + (i % 3) * 0.03; slice(P, Math.cos(a) * rr, 0.155, Math.sin(a) * rr, 0.045, -a, 0.6); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 3.6, rr = 0.13; el(P, i % 2 ? '#d8e8b8' : '#8aba5a', Math.cos(a) * rr, 0.155, Math.sin(a) * rr, 0.03, 0.005, 0.016, -a); }
    for (let i = 0; i < 6; i++) dot(P, '#c8201a', Math.cos(i * 2.1) * 0.16, 0.156, Math.sin(i * 2.1) * 0.16, 0.006, 5);
    steam(P, 0.12, 0.16, 0.06, 0.018, 4, '#f5f5f2', 0.24);
    // plates of mutton, napa cabbage, tofu, sugar garlic; sesame sauce bowls
    slicePlate(gp, -0.29, 0.2, 0.11, 9, 0.2);
    slicePlate(gp, 0.29, 0.2, 0.11, 9, 0.9);
    slicePlate(gp, 0.0, 0.33, 0.1, 8, 1.6);
    const cp = plate(gp, -0.3, Y, -0.16, 0.1, bwPaint(0.1));
    for (let i = 0; i < 6; i++) el(gp, i % 2 ? '#f0f4dc' : '#a8cf7a', -0.3 + (i - 2.5) * 0.02, cp + 0.012, -0.16, 0.014, 0.008, 0.06, 0.3);
    const tp = plate(gp, 0.3, Y, -0.16, 0.09, bwPaint(0.09));
    for (let i = 0; i < 6; i++) rbox(gp, '#f6f1e2', 0.27 + (i % 3) * 0.03, tp + 0.001, -0.18 + Math.floor(i / 3) * 0.035, 0.026, 0.024, 0.026, 0.003);
    dipBowl(gp, -0.15, -0.3, '#c8925a', ['#c0301a', '#3a9a3a']);
    dipBowl(gp, 0.15, -0.3, '#c8925a', ['#c0301a', '#3a9a3a']);
    dipBowl(gp, -0.17, 0.35, '#c8925a', ['#c0301a', '#3a9a3a']);
    const gd = grp(gp, 0.17, Y, 0.37);
    vessel(gd, [[0.02, 0], [0.035, 0.015], [0.038, 0.022]], 0.003, BW, null, 0, 0, 0, 18, 0.25);
    for (let i = 0; i < 4; i++) el(gd, '#b07a8a', Math.cos(i * 1.6) * 0.012, 0.02, Math.sin(i * 1.6) * 0.012, 0.012, 0.014, 0.012);
    chopsticks(gp, 0.0, Y + 0.002, -0.3, 0.1);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// PEKING ROAST DUCK (北京烤鸭) — a brick hanging-oven (挂炉) with an arched mouth, fruit-wood fire and glowing interior,
// three glossy mahogany ducks hung on hooks; at the front the chef in whites carves a duck on a board; plates of
// sliced crisp skin, a steamer of thin pancakes, scallion and cucumber strips and sweet bean sauce.
// ---------------------------------------------------------------------------------------------------------
const DUCK = '#8a3414';
function duck(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, hang = false): void {
  const d = grp(p, x, y, z, ry, s);
  if (hang) {
    // hung by the neck: body hanging below the hook
    gloss(d, DUCK, 0, -0.1, 0, 0.042, 0.065, 0.038);
    gloss(d, '#a04a1c', 0, -0.09, 0.02, 0.03, 0.05, 0.02);
    shine(sweep(d, [{ p: [0, -0.04, 0.005], w: 0.012 }, { p: [0, -0.01, 0.012], w: 0.009 }, { p: [0, 0.01, 0.012], w: 0.009 }], DUCK, { radial: 7, sub: 3 }));
    gloss(d, '#5a200c', 0, 0.012, 0.026, 0.008, 0.008, 0.014);
    for (const sx of [-1, 1]) sweep(d, [{ p: [sx * 0.02, -0.16, 0], w: 0.008 }, { p: [sx * 0.03, -0.19, 0.005], w: 0.006 }], '#6a2a10', { radial: 5, sub: 2 });
    rod(d, [0, 0.0, 0.005], [0, 0.05, 0.0], 0.0025, '#2a2a2a', 4);
  } else {
    gloss(d, DUCK, 0, 0.04, 0, 0.075, 0.042, 0.048);
    gloss(d, '#a04a1c', 0.02, 0.06, 0, 0.05, 0.022, 0.032);
    shine(sweep(d, [{ p: [0.065, 0.045, 0], w: 0.016 }, { p: [0.1, 0.05, 0], w: 0.012 }, { p: [0.13, 0.04, 0], w: 0.012 }], DUCK, { radial: 7, sub: 3 }));
    gloss(d, '#7a2e10', 0.14, 0.042, 0, 0.018, 0.014, 0.014);
    for (const sz of [-1, 1]) gloss(d, '#7a2e10', -0.05, 0.06, sz * 0.035, 0.03, 0.018, 0.016, 0, 0, 0.5);
  }
}
const lf_duck: Builder = gp => {
  base(gp, tiles('#8e8274', 0.08), '#4e463c');
  // oven: brick facade with arched mouth, chamber with glowing back wall, fire and hanging ducks
  const O = grp(gp, -0.04, Y, -0.22);
  const W = 0.5, H = 0.34, D = 0.07;
  const fac = panel(O, W, H, D, '#a8583a', [archPath(0, 0.02, 0.28, 0.25)], 0, 0, 0.1);
  void fac;
  // mortar courses and staggered joints, skipping the arched opening
  const hw = (y: number) => (y < 0.02 ? 0 : y < 0.1325 ? 0.14 : y < 0.27 ? Math.sqrt(Math.max(0, 0.1375 ** 2 - (y - 0.1325) ** 2)) + 0.004 : 0);
  for (let i = 1; i * 0.028 < H; i++) {
    const y = i * 0.028, w = hw(y), segs: [number, number][] = w > 0 ? [[-W / 2, -w], [w, W / 2]] : [[-W / 2, W / 2]];
    for (const [a0, a1] of segs) box(O, '#7a3a26', (a0 + a1) / 2, y, 0.1 + D / 2, a1 - a0, 0.003, 0.003);
    for (let x = -W / 2 + ((i % 2) * 0.03) + 0.03; x < W / 2 - 0.01; x += 0.06) if (Math.abs(x) > hw(y - 0.014) + 0.005 && Math.abs(x) > hw(y) + 0.005) box(O, '#7a3a26', x, y - 0.028, 0.1 + D / 2, 0.003, 0.028, 0.003);
  }
  for (let k = 0; k < 9; k++) { const a = Math.PI * (k + 0.5) / 9; const ax = Math.cos(a) * 0.15, ay = 0.1325 + Math.sin(a) * 0.15; box(O, '#c86a44', ax, ay - 0.012, 0.1 + D / 2 + 0.001, 0.034, 0.024, 0.004, 0, 0, a - Math.PI / 2); }
  for (const sx of [-1, 1]) box(O, '#8a4630', sx * (W / 2 - 0.02), 0, -0.04, 0.04, H, 0.2);
  box(O, '#7a3e2a', 0, H, -0.04, W, 0.03, 0.22);
  glow(box(O, '#c84a1a', 0, 0, -0.13, W - 0.08, H - 0.02, 0.01), '#d85a20', '#9a2a00');
  rbox(O, '#2a1a12', 0, 0, -0.06, W - 0.08, 0.02, 0.14, 0.004);
  fire(O, 0, 0.02, -0.06, 0.07);
  cyl(O, '#6a3624', 0.16, H + 0.03, -0.08, 0.025, 0.1, 10);
  rod(O, [-0.12, 0.24, 0.02], [0.12, 0.24, 0.02], 0.004, '#2a2a2a', 5);
  for (let k = 0; k < 3; k++) duck(O, -0.08 + k * 0.08, 0.22, 0.02, 1.0, 0.3 * (k - 1), true);
  // carving board, duck, knife
  const B = grp(gp, 0.14, Y, 0.14, -0.3);
  rbox(B, '#b08a5a', 0, 0, 0, 0.26, 0.022, 0.15, 0.006);
  duck(B, -0.03, 0.022, 0, 1.15, 0);
  el(B, '#f0dcb8', 0.0, 0.07, 0.035, 0.04, 0.02, 0.012, 0, 0.3);
  for (let i = 0; i < 4; i++) shine(sweep(B, [{ p: [0.07 + i * 0.012, 0.03, -0.04 + i * 0.02], w: 0.012, h: 0.003 }, { p: [0.09 + i * 0.012, 0.03, -0.03 + i * 0.02], w: 0.012, h: 0.003 }], '#9a4418', { radial: 6, sub: 2, paint: (_x, py) => (py < 0.029 ? '#f0dcc0' : null) }));
  // chef in whites with a tall toque, knife in hand
  const ch = who(gp, 0.22, Y, -0.04, { h: 0.37, ry: -0.6, pose: 'stand', lean: 0.18, top: '#f6f6f2', bottom: '#2a2a30', sleeve: 0.9, skin: '#d2a07a',
    hands: [[-0.08, 0.55, 0.32], [0.08, 0.6, 0.3]] });
  const [hx, hy, hz] = ch.head;
  plathe(gp, [[0, 0], [0.032, 0], [0.036, 0.05], [0.045, 0.07], [0.04, 0.085], [0, 0.09]], '#ffffff', null, hx, hy + 0.012, hz, 16);
  const [kx, ky, kz] = ch.handR;
  box(gp, '#d0d4d8', kx, ky - 0.008, kz + 0.02, 0.008, 0.016, 0.06, -0.6);
  // plates: sliced duck fan, pancakes in a steamer, scallion & cucumber, sweet bean sauce
  const sp = plate(gp, -0.16, Y, 0.2, 0.13, bwPaint(0.13));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, rr = i % 2 ? 0.08 : 0.06;
    shine(sweep(gp, [{ p: [-0.16 + Math.cos(a) * (rr - 0.025), sp + 0.006, 0.2 + Math.sin(a) * (rr - 0.025)], w: 0.016, h: 0.004 }, { p: [-0.16 + Math.cos(a) * (rr + 0.025), sp + 0.008 + (i % 2) * 0.004, 0.2 + Math.sin(a) * (rr + 0.025)], w: 0.018, h: 0.004 }],
      '#9a4418', { radial: 6, sub: 2, paint: (_x, py) => (py < sp + 0.006 + (i % 2) * 0.002 ? '#f0dcc0' : null) }));
  }
  gloss(gp, DUCK, -0.16, sp + 0.016, 0.2, 0.03, 0.012, 0.022);
  const pk = steamerRing(gp, 0.34, Y, 0.06, 0.07, 0.04);
  for (let i = 0; i < 5; i++) cyl(gp, '#f4eedc', 0.34 + (i % 2) * 0.004, pk + i * 0.004, 0.06, 0.058, 0.003, 20);
  const vp = plate(gp, 0.05, Y, 0.33, 0.075, null, '#f0f0ec');
  for (let i = 0; i < 6; i++) rod(gp, [0.0 + i * 0.012, vp + 0.005, 0.3], [0.03 + i * 0.012, vp + 0.005, 0.37], 0.0035, i % 2 ? '#e8f0d8' : '#6aaa4a', 4);
  for (let i = 0; i < 4; i++) box(gp, '#4a8a3a', 0.06 + i * 0.012, vp, 0.32, 0.006, 0.006, 0.06, 0.4);
  const sd = grp(gp, 0.2, Y, 0.34);
  vessel(sd, [[0.02, 0], [0.034, 0.014], [0.036, 0.02]], 0.003, BW, null, 0, 0, 0, 18, 0.25);
  fill(sd, '#3a1e12', 0, 0.016, 0, 0.032, 18, 0.15);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// MANCHU-HAN IMPERIAL FEAST (满汉全席) — a long table draped in imperial yellow with gold borders and a dragon roundel,
// crowded with famille-rose, blue-and-white and yellow porcelain: a whole glossy roast suckling pig at the centre,
// bird's nest in a lidded cup, prawns, fish, greens, crab, wine cups; a red screen with a coiling gold dragon behind,
// and Qing attendants (a eunuch carrying a dish, a palace maid in a 两把头 headdress).
// ---------------------------------------------------------------------------------------------------------
const IMP = '#e8b422', GOLD = '#d8a830';
function roastPig(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0): void {
  const P = grp(p, x, y, z, ry, s);
  const C = '#a8481c';
  shine(sweep(P, [{ p: [-0.1, 0.035, 0], w: 0.03, h: 0.028 }, { p: [-0.06, 0.045, 0], w: 0.05, h: 0.045 }, { p: [0.02, 0.048, 0], w: 0.052, h: 0.046 }, { p: [0.08, 0.042, 0], w: 0.038, h: 0.036 }, { p: [0.12, 0.035, 0], w: 0.02, h: 0.02 }], C,
    { radial: 14, sub: 4, up: [0, 1, 0], paint: (_x, py) => (py > 0.075 ? '#c8642a' : py < 0.012 ? '#7a3010' : null) }), 0.2);
  gloss(P, '#7a3010', 0.132, 0.034, 0, 0.012, 0.012, 0.014);
  for (const sz of [-1, 1]) {
    cone(P, '#8a3814', 0.085, 0.07, sz * 0.02, 0.012, 0.03, 6).rotation.set(sz * 0.6, 0, -0.5);
    dot(P, '#1a0e08', 0.105, 0.052, sz * 0.018, 0.004, 5);
    for (const lx of [-0.06, 0.05]) gloss(P, '#8a3814', lx, 0.012, sz * 0.04, 0.022, 0.01, 0.012, 0, 0, 0.2);
  }
  add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#8a3814'), -0.105, 0.05, 0, 0.01, 0.01, 0.01, 0, 0, 1);
}
function famille(c: string): Paint { return (x, y, z) => { const a = ang(x, z), r = Math.hypot(x, z); return Math.sin(a * 6 + r * 80) > 0.85 ? '#d8487a' : Math.sin(a * 9 - r * 60) > 0.9 ? '#4a9a5a' : y > 0 && r > 0.05 && Math.sin(a * 30) > 0.95 ? GOLD : c === '' ? null : null; }; }
function dish(p: THREE.Object3D, x: number, y: number, z: number, R: number, ware: 'bw' | 'rose' | 'yellow', food: string, kind: 'heap' | 'pieces' | 'soup' | 'fish'): void {
  const c = ware === 'yellow' ? '#f0c42a' : BW, paint = ware === 'bw' ? bwPaint(R) : ware === 'rose' ? famille('') : null;
  if (kind === 'soup') {
    const b = grp(p, x, y, z);
    vessel(b, dense([[R * 0.5, 0], [R * 0.8, R * 0.3], [R, R * 0.6]], 0.008), 0.003, c, ware === 'bw' ? (px, py, pz) => (Math.sin(ang(px, pz) * 16) > 0.3 && py > R * 0.45 ? COB : null) : paint, 0, 0, 0, 24, 0.22);
    fill(b, food, 0, R * 0.52, 0, R * 0.9, 20, 0.1);
    for (let i = 0; i < 4; i++) dot(b, shade(food, 1.3), Math.cos(i * 1.6) * R * 0.4, R * 0.53, Math.sin(i * 1.6) * R * 0.4, R * 0.12, 5);
    return;
  }
  const py = plate(p, x, y, z, R, paint, c);
  if (kind === 'heap') heap(p, x, py, z, R * 0.62, R * 0.4, food);
  else if (kind === 'fish') {
    const f = grp(p, x, py + 0.012, z, 0.3, R * 9);
    fish(f, food, shade(food, 1.25));
    f.children.forEach(m => { if ((m as THREE.Mesh).isMesh) shine(m as THREE.Mesh); });
  } else for (let i = 0; i < 6; i++) gloss(p, food, x + Math.cos(i * 1.05) * R * 0.38, py + R * 0.12, z + Math.sin(i * 1.05) * R * 0.38, R * 0.22, R * 0.14, R * 0.16, i);
}
const lf_feast: Builder = gp => {
  base(gp, tiles('#7e715e', 0.1, false), '#4a3e30');
  // red lacquer screen with a gold dragon
  const S = grp(gp, 0, Y, -0.36);
  rbox(S, '#4a2a14', 0, 0, 0, 0.62, 0.02, 0.06, 0.004);
  rbox(S, '#a01e18', 0, 0.02, 0, 0.6, 0.3, 0.025, 0.004);
  box(S, GOLD, 0, 0.3, 0, 0.62, 0.016, 0.03);
  for (const sx of [-1, 1]) box(S, GOLD, sx * 0.3, 0.02, 0, 0.016, 0.28, 0.03);
  const dpts: { p: V3; w: number }[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; dpts.push({ p: [-0.24 + t * 0.44, 0.17 + Math.sin(t * TAU * 1.3) * 0.07, 0.016], w: 0.012 * (1 - t * 0.6) + 0.004 }); }
  shine(sweep(S, dpts, GOLD, { radial: 7, sub: 3 }), 0.25, 0.7);
  el(S, GOLD, 0.235, 0.2, 0.018, 0.022, 0.016, 0.01);
  for (const dy of [-1, 1]) rod(S, [0.25, 0.2 + dy * 0.008, 0.02], [0.275, 0.2 + dy * 0.02, 0.02], 0.002, GOLD, 3);
  for (let i = 1; i < 12; i += 3) { const q = dpts[i].p; rod(S, q, [q[0] + 0.01, q[1] - 0.03, q[2]], 0.003, GOLD, 4); }
  dot(S, '#f04a3a', 0.29, 0.24, 0.02, 0.014, 8);
  // long table under a yellow cloth
  const tw = 0.64, td = 0.26, th = 0.12, tz = 0.02;
  table(gp, 0, Y, tz, tw, td, th, '#4a2a14');
  rbox(gp, IMP, 0, Y + th - 0.004, tz, tw + 0.02, 0.008, td + 0.02, 0.003);
  box(gp, IMP, 0, Y + 0.03, tz + td / 2 + 0.008, tw + 0.02, th - 0.03, 0.004);
  box(gp, GOLD, 0, Y + 0.03, tz + td / 2 + 0.011, tw + 0.02, 0.008, 0.003);
  box(gp, GOLD, 0, Y + th - 0.02, tz + td / 2 + 0.011, tw + 0.02, 0.006, 0.003);
  const ro = add(gp, new THREE.CircleGeometry(0.03, 20), mat(GOLD, { metal: 0.6, rough: 0.3 }), 0, Y + 0.075, tz + td / 2 + 0.012, 1, 1, 1);
  void ro;
  const ty = Y + th + 0.004;
  // the pig on a big platter in the centre
  const pp = plate(gp, 0, ty, tz, 0.12, famille(''), BW);
  roastPig(gp, 0, pp, tz, 0.95, 0.15);
  for (let i = 0; i < 8; i++) el(gp, '#4a9a3a', Math.cos(i * 0.8) * 0.1, pp + 0.004, tz + Math.sin(i * 0.8) * 0.08, 0.016, 0.005, 0.008, i);
  // dishes
  const D: [number, number, number, 'bw' | 'rose' | 'yellow', string, 'heap' | 'pieces' | 'soup' | 'fish'][] = [
    [-0.26, -0.06, 0.05, 'yellow', '#e85a3a', 'pieces'], [-0.17, -0.07, 0.05, 'rose', '#4a9a3a', 'heap'], [0.17, -0.07, 0.05, 'bw', '#c8a060', 'soup'], [0.26, -0.06, 0.05, 'rose', '#f08a3a', 'pieces'],
    [-0.27, 0.07, 0.05, 'bw', '#a85a2a', 'pieces'], [-0.16, 0.08, 0.06, 'bw', '#8a9aa0', 'fish'], [0.16, 0.08, 0.055, 'yellow', '#f4e8c8', 'soup'], [0.27, 0.07, 0.05, 'rose', '#e8d040', 'heap'],
  ];
  for (const [dx, dz, R, w, f, k] of D) dish(gp, dx, ty, tz + dz, R, w, f, k);
  // bird's nest in a lidded yellow cup, wine cups and chopsticks
  const bn = grp(gp, -0.08, ty, tz + 0.1);
  vessel(bn, dense([[0.015, 0], [0.025, 0.012], [0.03, 0.032]], 0.006), 0.003, '#f0c42a', null, 0, 0, 0, 20, 0.2);
  heap(bn, 0, 0.026, 0, 0.026, 0.012, '#f4eedc', (px, py, pz) => (Math.sin(px * 600 + pz * 300) > 0.3 ? '#e8dcc0' : null));
  plathe(bn, [[0, 0.022], [0.012, 0.02], [0.034, 0.008], [0.034, 0.004], [0, 0.016]], '#f0c42a', null, 0.04, -0.004, 0.0, 20, 0.2);
  bn.children[bn.children.length - 1].rotation.z = 0.25;
  for (const cx of [-0.2, 0.08, 0.22]) { vessel(gp, [[0.008, 0], [0.014, 0.012], [0.015, 0.016]], 0.002, BW, null, cx, ty, tz + 0.11, 14, 0.2); chopsticks(gp, cx + 0.04, ty, tz + 0.11, 1.4, '#e8d8a0', 0.08); }
  // attendants: eunuch with a covered dish, palace maid
  const e = fig(gp, { x: -0.26, y: Y, z: -0.22, ry: 0.3, h: 0.33, outfit: 'changshan', top: '#3a4a6a', jacket: '#2a2a32', hat: 'qingguan', hatColor: '#1a1612', hatBadge: '#c8a030', hairStyle: 'queue',
    armL: { fwd: 1.3, side: 0.2, bend: 1.2, inward: 0.3 }, armR: { fwd: 1.3, side: 0.2, bend: 1.2, inward: 0.3 } });
  const mx = (e.handL[0] + e.handR[0]) / 2, my = (e.handL[1] + e.handR[1]) / 2 + 0.01, mz = (e.handL[2] + e.handR[2]) / 2;
  plate(gp, mx, my, mz, 0.05, bwPaint(0.05));
  plathe(gp, [[0, 0.04], [0.008, 0.04], [0.01, 0.034], [0.04, 0.02], [0.044, 0], [0, 0.0]], '#f0c42a', null, mx, my + 0.008, mz, 20, 0.2);
  fig(gp, { x: 0.26, y: Y, z: -0.22, ry: -0.3, h: 0.33, outfit: 'robe', top: '#c8487a', accent: '#f0c42a', hat: 'liangba', hatColor: '#1a1612', hairStyle: 'bun',
    armL: { fwd: 0.5, side: 0.15, bend: 1.3, inward: 0.5 }, armR: { fwd: 0.5, side: 0.15, bend: 1.3, inward: 0.5 } });
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// WESTERN ZHOU RITUAL BANQUET (列鼎而食 / 周代八珍) — on reed mats: a row of five bronze ding of decreasing size (the rank
// set), four gui tureens heaped with millet, stemmed dou of meat sauce, a low black-and-red lacquer table with a whole
// roast suckling pig (炮豚), and two nobles in dark robes and caps kneeling to the feast.
// ---------------------------------------------------------------------------------------------------------
function gui(p: THREE.Object3D, x: number, z: number, s: number): void {
  const G = grp(p, x, Y, z, 0, s);
  rbox(G, BRZ, 0, 0, 0, 0.11, 0.035, 0.11, 0.006);
  plathe(G, [[0, 0.035], [0.045, 0.035], [0.042, 0.05]], BRZ, null, 0, 0, 0, 20, 0.45, 0.45);
  vessel(G, dense([[0.04, 0.05], [0.07, 0.07], [0.08, 0.1], [0.078, 0.12], [0.082, 0.125]], 0.008), 0.005, BRZ, taotie, 0, -0.01, 0, 32, 0.45, 0.45);
  for (const sx of [-1, 1]) sweep(G, [{ p: [sx * 0.07, 0.1, 0], w: 0.008 }, { p: [sx * 0.105, 0.095, 0], w: 0.01 }, { p: [sx * 0.1, 0.06, 0], w: 0.008 }, { p: [sx * 0.075, 0.055, 0], w: 0.006 }], BRZ, { radial: 6, sub: 3 });
  heap(G, 0, 0.1, 0, 0.074, 0.05, '#e3bd45');
}
function dou(p: THREE.Object3D, x: number, z: number, s: number, food: string): void {
  const D = grp(p, x, Y, z, 0, s);
  plathe(D, [[0, 0], [0.04, 0], [0.035, 0.008], [0.012, 0.03], [0.011, 0.09], [0.03, 0.1], [0.06, 0.115], [0.065, 0.122], [0.055, 0.12], [0, 0.108]], BRZ, (_x, y) => (y > 0.098 && y < 0.115 ? BRZD : null), 0, 0, 0, 24, 0.45, 0.45);
  heap(D, 0, 0.108, 0, 0.055, 0.02, food);
}
const lf_bazhen: Builder = gp => {
  base(gp, matting('#b89a5e', 0.02), '#5a4428');
  // row of five ding, largest first
  const sc = [0.46, 0.42, 0.38, 0.34, 0.3];
  let x = -0.34;
  sc.forEach((s, i) => {
    x += 0.19 * s * (i ? 1 : 0.6);
    const top = ding(gp, x, Y, -0.2 + i * 0.005, s, 0.2, 0.12) * s + Y;
    fill(gp, '#7a3e1a', x, top - 0.005, -0.2 + i * 0.005, 0.16 * s, 22, 0.25);
    for (let k = 0; k < 3; k++) gloss(gp, '#a8603a', x + Math.cos(k * 2.1) * 0.06 * s, top, -0.2 + Math.sin(k * 2.1) * 0.06 * s, 0.03 * s, 0.015 * s, 0.025 * s, k);
    if (i < 2) steam(gp, x, top + 0.01, -0.2, 0.018, 4, '#f5f5f2', 0.24);
    x += 0.19 * s;
  });
  // gui with millet and dou with meat sauce
  for (let i = 0; i < 4; i++) gui(gp, -0.27 + i * 0.13, 0.0, 0.85);
  dou(gp, -0.36, 0.14, 1.0, '#6a2e14');
  dou(gp, 0.36, 0.12, 1.0, '#7a3a1a');
  dou(gp, 0.34, -0.02, 0.9, '#5a7a2a');
  // low lacquer table with the roast suckling pig
  const ty = table(gp, 0, Y, 0.2, 0.34, 0.14, 0.06, '#2a1410', 0, '#2a1410');
  box(gp, '#a01e18', 0, ty - 0.003, 0.2, 0.3, 0.004, 0.1);
  plathe(gp, [[0, 0], [0.12, 0], [0.13, 0.012], [0, 0.006]], BRZ, null, 0, ty, 0.2, 28, 0.4, 0.45).scale.set(1.15, 1, 0.6);
  roastPig(gp, 0, ty + 0.006, 0.2, 1.05, 0);
  // kneeling nobles at either end
  for (const sx of [-1, 1]) {
    const n = seiza(gp, sx * 0.3, 0.3, { h: 0.33, ry: -sx * 1.2, top: sx < 0 ? '#2a2420' : '#3a2a3a', bottom: '#5a1a14', dress: 'knee', hat: '#1a1410', hatStyle: 'cap', skin: '#d8a882', hair: '#1a1410', lean: 0.1,
      hands: [[-0.06, 0.42, 0.22], [0.06, 0.42, 0.22]] });
    void n;
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SEASIDE SALT BOILING (煮海为盐, Qi) — sea at the back with a beached fishing boat and a rack of drying fish; brine
// channels running into flat evaporation pans crusted white; a great shallow bronze pan boiling brine over a fire,
// heaped salt, and salt workers raking and carrying.
// ---------------------------------------------------------------------------------------------------------
const lf_salt: Builder = gp => {
  base(gp, earth('#bfa47a', 14), '#7a6444');
  // sea along the back
  water(gp, clipRect(-0.5, 0.5, -0.5, -0.24, 0.45), Y + 0.003, '#4a8aa8');
  for (let i = 0; i < 6; i++) rod(gp, [-0.3 + i * 0.11, Y + 0.005, -0.25 - (i % 2) * 0.01], [-0.24 + i * 0.11, Y + 0.005, -0.255 - (i % 2) * 0.01], 0.004, '#e8f2f4', 4);
  // brine channel and evaporation pans (left/front)
  water(gp, [[-0.06, -0.25], [-0.03, -0.25], [-0.03, -0.02], [-0.06, -0.02]], Y + 0.003, '#6aa0b8');
  water(gp, [[-0.06, -0.05], [-0.06, -0.02], [-0.42, -0.02], [-0.42, -0.05]], Y + 0.003, '#6aa0b8');
  const pans: [number, number, number, number][] = [[-0.4, -0.21, 0.0, 0.02], [-0.4, -0.21, 0.04, 0.22], [-0.19, 0.0, 0.04, 0.22]];
  for (const [x0, x1, z0, z1] of pans) {
    for (const [a0, a1, b0, b1] of [[x0 - 0.008, x1 + 0.008, z0 - 0.008, z0], [x0 - 0.008, x1 + 0.008, z1, z1 + 0.008], [x0 - 0.008, x0, z0, z1], [x1, x1 + 0.008, z0, z1]] as const) box(gp, '#9a8460', (a0 + a1) / 2, Y, (b0 + b1) / 2, a1 - a0, 0.012, b1 - b0);
  }
  for (const [x0, x1, z0, z1] of pans.slice(1)) {
    const pts = clipRect(x0, x1, z0, z1, 0.42);
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, -b))), 1);
    geo.rotateX(-Math.PI / 2);
    const sub = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 14, 12).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    void geo;
    add(gp, paintFaces(sub, '#f4f4ee', (x, _y, z) => { const n = fbm(x * 40, 2, z * 40, 2); return n < 0.42 ? '#8ab4c4' : n < 0.5 ? '#d8e4e4' : null; }), mat('#ffffff', { vc: true, rough: 0.5 }), 0, Y + 0.006, 0, 1, 1, 1);
  }
  // salt heaps
  for (const [hx, hz, r] of [[-0.3, 0.33, 0.06], [-0.17, 0.35, 0.045], [0.02, 0.36, 0.05]] as const) {
    heap(gp, hx, Y, hz, r, r * 0.9, '#f8f8f4', (px, py, pz) => (hash3(Math.floor(px * 300), Math.floor(py * 300), Math.floor(pz * 300)) > 0.7 ? '#e4e8ea' : null));
  }
  // bronze boiling pan on stones over a fire
  const bx = 0.2, bz = 0.06;
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.6; rbox(gp, '#7d776c', bx + Math.cos(a) * 0.12, Y, bz + Math.sin(a) * 0.12, 0.05, 0.08, 0.05, 0.01, a); }
  fire(gp, bx, Y, bz, 0.08);
  const P = grp(gp, bx, Y + 0.08, bz);
  vessel(P, dense([[0.12, 0], [0.17, 0.01], [0.19, 0.04], [0.195, 0.045]], 0.008), 0.006, BRZ, null, 0, 0, 0, 40, 0.4, 0.5);
  fill(P, '#7e9a94', 0, 0.032, 0, 0.18, 32, 0.1);
  add(P, new THREE.RingGeometry(0.15, 0.182, 36, 1).rotateX(-Math.PI / 2), mat('#f6f6f0', { flat: false }), 0, 0.034, 0, 1, 1, 1);
  for (let i = 0; i < 7; i++) dot(P, '#f6f6f0', Math.cos(i * 0.9) * 0.1, 0.034, Math.sin(i * 0.9) * 0.08, 0.008, 5);
  steam(P, -0.05, 0.05, -0.02, 0.028, 6, '#f5f5f2', 0.28);
  steam(P, 0.06, 0.05, 0.04, 0.024, 5, '#f5f5f2', 0.26);
  // worker raking salt in the pan
  const rk = who(gp, -0.3, Y + 0.006, 0.13, { h: 0.33, ry: 0.4, pose: 'stand', lean: 0.3, top: '#8a7a5a', bottom: '#5a4a3a', shorts: true, sleeve: 0.4, hat: '#c8b070', hatStyle: 'conical', skin: '#b07850',
    hands: [[-0.04, 0.55, 0.25], [0.05, 0.4, 0.33]] });
  const [ax, ay, az] = rk.handL, [cx, cy, cz] = rk.handR, dv = new THREE.Vector3(cx - ax, cy - ay, cz - az).normalize();
  const tip: V3 = [ax + dv.x * 0.24, Math.max(Y + 0.01, ay + dv.y * 0.24), az + dv.z * 0.24];
  rod(gp, [ax - dv.x * 0.03, ay - dv.y * 0.03, az - dv.z * 0.03], tip, 0.0035, '#7a5a34', 5);
  box(gp, '#7a5a34', tip[0], Y + 0.008, tip[2], 0.09, 0.016, 0.01, Math.atan2(dv.x, dv.z) + Math.PI / 2);
  // carrier with baskets on a shoulder pole
  const cr = who(gp, 0.04, Y, 0.22, { h: 0.33, ry: -0.6, pose: 'walk', phase: 0.25, top: '#6a7a8a', bottom: '#4a3a2a', shorts: true, sleeve: 0.4, skin: '#b07850', hat: '#c8b070', hatStyle: 'conical',
    hands: [[-0.1, 0.8, 0.02], [0.12, 0.78, 0.06]] });
  const [hx, hy, hz] = cr.head;
  const ang2 = -0.6 + Math.PI / 2;
  const e1: V3 = [hx + Math.sin(ang2) * 0.16, hy - 0.06, hz + Math.cos(ang2) * 0.16], e2: V3 = [hx - Math.sin(ang2) * 0.16, hy - 0.06, hz - Math.cos(ang2) * 0.16];
  rod(gp, e1, e2, 0.004, '#8a6a3a', 5);
  for (const e of [e1, e2]) {
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; rod(gp, e, [e[0] + Math.cos(a) * 0.03, Y + 0.08, e[2] + Math.sin(a) * 0.03], 0.0012, '#5a4a2a', 3); }
    vessel(gp, [[0.03, 0], [0.04, 0.05]], 0.004, '#b09058', null, e[0], Y + 0.03, e[2], 16);
    heap(gp, e[0], Y + 0.072, e[2], 0.036, 0.02, '#f8f8f4');
  }
  // beached boat with a fish-drying rack
  const B = grp(gp, 0.22, Y, -0.27, -0.25);
  sweep(B, [{ p: [-0.15, 0.05, 0], w: 0.004, h: 0.012 }, { p: [-0.1, 0.03, 0], w: 0.045, h: 0.03 }, { p: [0.06, 0.028, 0], w: 0.05, h: 0.03 }, { p: [0.15, 0.045, 0], w: 0.01, h: 0.015 }], '#7a5434', { radial: 12, sub: 4, squash: 1, paint: (_x, py) => (py > 0.045 ? '#5a3a22' : null) });
  rod(B, [0.0, 0.04, 0], [0.02, 0.28, 0], 0.005, '#5a3a22', 5);
  for (const sx of [-0.12, 0.12]) rod(gp, [0.22 + sx, Y, -0.13], [0.22 + sx, Y + 0.2, -0.13], 0.005, '#6a4a2a', 5);
  rod(gp, [0.09, Y + 0.2, -0.13], [0.35, Y + 0.2, -0.13], 0.004, '#6a4a2a', 5);
  for (let k = 0; k < 6; k++) {
    const f = grp(gp, 0.12 + k * 0.04, Y + 0.15, -0.13);
    f.rotation.z = Math.PI / 2;
    f.scale.setScalar(0.9);
    fish(f, k % 2 ? '#8a8a7a' : '#a89a7a', '#d8d0bc');
    rod(gp, [0.12 + k * 0.04, Y + 0.2, -0.13], [0.12 + k * 0.04, Y + 0.195, -0.13], 0.001, '#3a2a1a', 3);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// ROTARY STONE MILL (石转磨, Qin–Han) — a great two-stone mill on a round platform with a flour channel, the upper stone's
// hopper heaped with wheat and a long sweep pole harnessed to a blindfolded donkey plodding in a circle; flour drifts
// on the base; sheaves of wheat, grain sacks, and a woman shaking a sieve over a flour basket.
// ---------------------------------------------------------------------------------------------------------
const lf_mill: Builder = gp => {
  base(gp, earth('#a88a62', 16), '#6a5236');
  // trodden circular path
  add(gp, new THREE.RingGeometry(0.24, 0.34, 48, 1).rotateX(-Math.PI / 2), mat('#8e7454', { flat: false }), 0, Y + 0.001, -0.02, 1, 1, 1);
  const M = grp(gp, 0, Y, -0.02);
  plathe(M, [[0, 0], [0.19, 0], [0.19, 0.05], [0.2, 0.06], [0.185, 0.065], [0.16, 0.055], [0, 0.055]], GRANITE, granite(GRANITE), 0, 0, 0, 36);
  add(M, new THREE.RingGeometry(0.13, 0.18, 36, 1).rotateX(-Math.PI / 2), mat('#f6f2ea', { flat: false }), 0, 0.058, 0, 1, 1, 1);
  for (let i = 0; i < 10; i++) { const a = i * 0.63; heap(M, Math.cos(a) * 0.15, 0.056, Math.sin(a) * 0.15, 0.025, 0.012, '#f6f2ea'); }
  plathe(M, [[0, 0.055], [0.125, 0.055], [0.125, 0.1], [0, 0.1]], '#a8a498', granite('#a8a498'), 0, 0, 0, 30);
  plathe(M, [[0, 0.102], [0.125, 0.102], [0.124, 0.16], [0.105, 0.168], [0.05, 0.168], [0.045, 0.15], [0, 0.15]], '#b0ab9f', (px, py, pz) => (py > 0.102 && py < 0.108 ? '#6e6a62' : granite('#b0ab9f')(px, py, pz, 0, 0, 0)), 0, 0, 0, 30);
  heap(M, 0, 0.15, 0, 0.046, 0.02, '#d8a848');
  // sweep pole through the upper stone out to the donkey
  const da = 0.9, dr = 0.29, dx = Math.cos(da) * dr, dz = -0.02 + Math.sin(da) * dr;
  rod(gp, [-Math.cos(da) * 0.14, Y + 0.14, -0.02 - Math.sin(da) * 0.14], [dx, Y + 0.2, dz], 0.009, '#7a5634', 6);
  const Dn = grp(gp, dx, Y, dz, -da + Math.PI, 0.44);
  horse(Dn, '#7a6e64', '#3a322c', { donkey: true });
  rbox(Dn, '#5a3a22', 0, 0.4, 0.02, 0.14, 0.03, 0.12, 0.01);
  // wheat sheaves leaning, sacks
  for (const [sx, sz, a] of [[-0.36, -0.12, 0.2], [-0.3, -0.26, -0.3], [-0.39, 0.04, 0.5]] as const) {
    const W = grp(gp, sx, Y, sz, a);
    for (let k = 0; k < 9; k++) {
      const ox = (k % 3 - 1) * 0.01, oz = (Math.floor(k / 3) - 1) * 0.01, tp: V3 = [ox * 3.5, 0.24, oz * 3.5];
      rod(W, [ox, 0, oz], tp, 0.0028, '#d0b060', 4);
      el(W, '#d8a838', tp[0] * 1.08, tp[1] + 0.02, tp[2] * 1.08, 0.008, 0.024, 0.008, 0, oz * 8, -ox * 8);
    }
    add(W, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#9a7a3a'), 0, 0.1, 0, 0.022, 0.022, 0.022, 0, Math.PI / 2);
  }
  sack(gp, 0.33, -0.2, 1.0, 0.3, '#d8a848');
  sack(gp, 0.38, -0.04, 0.9, 1.2, '#f2ede2', '#d8ccae');
  // woman sifting flour over a basket
  const B = grp(gp, -0.1, Y, 0.31);
  vessel(B, [[0.06, 0], [0.075, 0.04], [0.08, 0.05]], 0.005, '#b08a52', (px, py, pz) => ((Math.floor(ang(px, pz) * 8) + Math.floor(py * 120)) % 2 ? '#8e6c3a' : null), 0, 0, 0, 24);
  heap(B, 0, 0.04, 0, 0.072, 0.03, '#f6f2ea');
  const w = who(gp, -0.22, Y, 0.24, { h: 0.33, ry: 1.2, pose: 'stand', lean: 0.15, top: '#7a8a6a', bottom: '#4a4038', dress: 'ankle', skin: '#d8a882', hair: '#1a1410',
    hands: [[-0.1, 0.55, 0.3], [0.1, 0.55, 0.3]] });
  const sx2 = (w.handL[0] + w.handR[0]) / 2, sy2 = (w.handL[1] + w.handR[1]) / 2, sz2 = (w.handL[2] + w.handR[2]) / 2;
  const Sv = grp(gp, sx2, sy2 - 0.02, sz2);
  plathe(Sv, [[0.07, 0], [0.072, 0], [0.072, 0.028], [0.066, 0.028], [0.066, 0.004], [0, 0.004], [0, 0.002], [0.066, 0.002]], '#c8a468', (px, py, pz) => (py < 0.005 ? ((Math.floor(px * 300) + Math.floor(pz * 300)) % 2 ? '#a8844c' : '#e8dcc0') : null), 0, 0, 0, 28);
  for (let i = 0; i < 6; i++) dot(gp, '#f6f2ea', sx2 + Math.cos(i) * 0.03, sy2 - 0.04 - i * 0.012, sz2 + Math.sin(i) * 0.03, 0.004, 4);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// BUDDHIST TEMPLE VEGETARIAN MEAL (寺院素斋, Liang Wudi) — before a red temple hall, rows of shaven monks in ochre robes
// kneel at long low tables, each with bowls of rice, tofu, mushrooms and greens; a novice ladles rice from a great
// steaming wooden-lidded pot; a bronze bell-board (云板) hangs to call the meal.
// ---------------------------------------------------------------------------------------------------------
const OCHRE = '#c8862a';
function meal(p: THREE.Object3D, x: number, y: number, z: number): void {
  const b = grp(p, x, y, z);
  vessel(b, [[0.012, 0], [0.02, 0.012], [0.022, 0.018]], 0.002, '#6a3a1e', null, -0.02, 0, 0, 14, 0.3);
  heap(b, -0.02, 0.014, 0, 0.02, 0.012, '#fbf8f0');
  const pp = plate(b, 0.018, 0, -0.008, 0.018, null, '#e8e4d8');
  rbox(b, '#f6f1e2', 0.012, pp, -0.012, 0.009, 0.008, 0.009, 0.002);
  rbox(b, '#f6f1e2', 0.022, pp, -0.004, 0.009, 0.008, 0.009, 0.002);
  const p2 = plate(b, 0.02, 0, 0.022, 0.016, null, '#e8e4d8');
  add(b, DOME(), mat('#6a4428', { flat: false }), 0.016, p2, 0.022, 0.008, 0.006, 0.008);
  el(b, '#3e8a2e', 0.025, p2 + 0.002, 0.02, 0.009, 0.003, 0.005, 0.5);
  rod(b, [-0.035, 0.002, 0.02], [0.0, 0.002, 0.028], 0.0012, '#c8a868', 3);
}
const lf_vegetarian: Builder = gp => {
  base(gp, tiles('#8a867e', 0.08), '#4e4a44');
  // temple hall behind on a stone terrace
  rbox(gp, '#a8a49a', 0, Y, -0.33, 0.56, 0.03, 0.14, 0.004);
  hall(gp, 0, Y + 0.03, -0.34, 0.46, 0.1, 0.13, '#4a4a4c', 0, '#a8322a', { col: '#8a1f1a', band: '#2f6d5d' });
  box(gp, '#e8c040', 0, Y + 0.13, -0.285, 0.08, 0.025, 0.004);
  // two long low tables with kneeling monks behind each
  for (const [tz, mz] of [[-0.12, -0.2], [0.13, 0.05]] as const) {
    const ty = table(gp, -0.06, Y, tz, 0.5, 0.07, 0.05, '#5a3420');
    for (let i = 0; i < 3; i++) {
      const x = -0.24 + i * 0.18;
      meal(gp, x + 0.01, ty, tz);
      const mk = seiza(gp, x, mz, { h: 0.3, top: OCHRE, bottom: '#a86a1e', dress: 'knee', hair: null, skin: '#d8a882', lean: 0.08,
        hands: [[-0.05, 0.42, 0.2], [0.05, 0.42, 0.2]] });
      // kasaya sash across the chest
      const [kx, ky, kz] = mk.head;
      rod(gp, [kx - 0.022, ky - 0.04, kz + 0.018], [kx + 0.028, ky - 0.1, kz + 0.026], 0.005, '#8a3a1a', 5);
    }
  }
  // great rice pot with steam, novice ladling
  const P = grp(gp, 0.3, Y, 0.2);
  plathe(P, [[0, 0], [0.09, 0], [0.1, 0.05], [0.09, 0.06], [0, 0.06]], '#7a6a5a', null, 0, 0, 0, 22);
  vessel(P, dense([[0.08, 0.06], [0.11, 0.09], [0.115, 0.15], [0.12, 0.16]], 0.01), 0.006, '#3a3634', null, 0, 0, 0, 30, 0.4, 0.4);
  heap(P, 0, 0.14, 0, 0.11, 0.025, '#fbf8f0');
  plathe(P, [[0, 0.04], [0.12, 0.0], [0.12, -0.008], [0, 0.03]], '#9a7448', (px, _py, pz) => (Math.abs(px) < 0.004 || Math.abs(pz) < 0.004 ? '#6a4a28' : null), -0.06, 0.2, -0.14, 26).rotation.x = -1.2;
  steam(P, 0.0, 0.17, 0.0, 0.026, 6, '#f5f5f2', 0.28);
  const nv = who(gp, 0.33, Y, -0.02, { h: 0.3, ry: -0.2, pose: 'stand', lean: 0.2, top: '#9a8a6a', bottom: '#6a5a40', dress: 'ankle', hair: null, skin: '#d8a882',
    hands: [[-0.05, 0.6, 0.3], [0.04, 0.7, 0.36]] });
  const [lx, ly, lz] = nv.handR;
  rod(gp, [lx, ly, lz], [0.3, Y + 0.17, 0.2], 0.003, '#9a7448', 4);
  vessel(grp(gp, 0.3, Y + 0.155, 0.2), [[0.008, 0], [0.018, 0.01], [0.02, 0.014]], 0.002, '#9a7448', null, 0, 0, 0, 12);
  // a wooden fish (木鱼) on a cushion at the front left
  el(gp, '#c8401a', -0.32, Y + 0.008, 0.3, 0.05, 0.012, 0.05);
  el(gp, '#8a3a1a', -0.32, Y + 0.035, 0.3, 0.035, 0.026, 0.03);
  box(gp, '#2a1a12', -0.32, Y + 0.035, 0.328, 0.03, 0.004, 0.004);
  fuse(gp);
};

export const H_LIFE_FOOD: Record<string, Builder> = {
  lf_forage, lf_pottery, lf_rice, lf_wine, lf_cauldron, lf_zongzi,
  lf_tofu, lf_jiaozi, lf_mantou, lf_noodles, lf_hubing, lf_tea, lf_dongpo, lf_tangyuan, lf_hotpot, lf_duck,
  lf_feast, lf_bazhen, lf_salt, lf_mill, lf_vegetarian,
};
