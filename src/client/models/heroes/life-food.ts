import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, plinth, SITE, box, rbox, cyl, cone, slab, rod, sweep, shade, hash3, panel, archPath, fbm, SPH, paintFaces,
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
const Y = 0.035;

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

/**
 * The shared museum plinth (walnut side `PLINTH_SIDE`, profile from prims.ts) with a finer painted top: a square grid
 * (cells 2R/n, so planks/tiles paint per cell) clipped to the plinth's top radius.
 */
function base(gp: THREE.Object3D, paint: Paint, R = 0.46, h = Y, n = 56): void {
  plinth(gp, SITE.earth, { R, h });
  gp.remove(gp.children[gp.children.length - 1]); // the plain top: replaced by the painted grid
  const Rt = R * 0.965, cs = (Rt * 2) / n, pos: number[] = [], top = h + 0.0005;
  const clamp = (x: number, z: number): [number, number] => { const d = Math.hypot(x, z); return d > Rt ? [(x / d) * Rt, (z / d) * Rt] : [x, z]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -Rt + i * cs, z0 = -Rt + j * cs;
    if (Math.hypot(x0 + cs / 2, z0 + cs / 2) > Rt + cs * 0.75) continue;
    const a = clamp(x0, z0), b = clamp(x0 + cs, z0), c = clamp(x0 + cs, z0 + cs), d = clamp(x0, z0 + cs);
    pos.push(a[0], top, a[1], d[0], top, d[1], c[0], top, c[1], a[0], top, a[1], c[0], top, c[1], b[0], top, b[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  add(gp, paintFaces(geo, '#ffffff', paint), mat('#ffffff', { vc: true, flat: true, rough: 0.85 }), 0, 0, 0, 1, 1, 1);
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
  for (const dz of [-0.006, 0.006]) rod(a, [-L / 2, 0.003, dz], [L / 2, 0.003, dz * 0.4], 0.003, c, 5);
}
/**
 * Han-style kitchen range (灶) after the pottery tomb models (明器陶灶): a long clay block, the fire door with a raised
 * fire-screen (挡火墙) at the +z end, two pot holes on top and a chimney at the back. Returns the group, the top height
 * (local) and the z of the big and small holes.
 */
function hanZao(p: THREE.Object3D, x: number, z: number, ry: number, L = 0.3, Wd = 0.14, H = 0.09, c = '#8e7c66'): { G: THREE.Group; top: number; zBig: number; zSmall: number } {
  const G = grp(p, x, Y, z, ry);
  rbox(G, c, 0, 0, 0, Wd, H, L, 0.008);
  rbox(G, shade(c, 0.86), 0, H - 0.006, 0, Wd + 0.01, 0.008, L + 0.01, 0.003);
  box(G, shade(c, 0.9), 0, H, L / 2 - 0.006, Wd + 0.01, 0.04, 0.012);
  box(G, '#1e1612', 0, 0.006, L / 2 + 0.001, Wd * 0.4, H * 0.5, 0.004);
  glow(box(G, '#7a3412', 0, 0.006, L / 2 + 0.003, Wd * 0.26, H * 0.26, 0.002), '#8a3a14', '#5a1c00');
  const f = grp(G, 0, 0.008, L / 2 - 0.008); f.name = 'flicker';
  for (const [dx, hh] of [[0, 0.034], [-0.012, 0.022], [0.012, 0.024]] as const) add(f, g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7)), mat('#e8862a', { emissive: '#c84a00' }), dx, hh / 2, 0, 0.008, hh, 0.008);
  const zBig = L * 0.2, zSmall = -L * 0.2;
  cyl(G, '#1a1410', 0, H + 0.002, zBig, Wd * 0.36, 0.002, 18);
  cyl(G, '#1a1410', 0, H + 0.002, zSmall, Wd * 0.26, 0.002, 16);
  plathe(G, [[0.02, 0], [0.018, 0.1], [0.022, 0.104], [0.014, 0.104], [0.012, 0.004]], shade(c, 0.9), null, 0, H, -L / 2 + 0.03, 12);
  return { G, top: H, zBig, zSmall };
}
/** Round-bottomed pottery or bronze cauldron (釜) sitting in a stove hole, filled at `fillY` with `soup`. Returns the soup height. */
function fu(p: THREE.Object3D, x: number, y: number, z: number, R: number, c: string, soup: string): number {
  vessel(p, dense([[R * 0.3, -R * 0.5], [R * 0.85, -R * 0.15], [R, R * 0.2], [R * 0.86, R * 0.5], [R * 0.9, R * 0.56]], R * 0.12), R * 0.06, c, null, x, y, z, 24, 0.7, 0.2);
  fill(p, soup, x, y + R * 0.4, z, R * 0.86, 20, 0.15);
  return y + R * 0.4;
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
// PALAEOLITHIC FORAGING — leaf-littered earth: a hide spread with gathered acorns, hackberries, wild-plum stones and
// tubers; two river fish roasting on sticks over a stone-ringed hearth (as at 周口店); a small sandstone grinding slab
// and hand-stone with acorn meal (柿子滩); river-mussel shells and a split long bone; a forager in sewn hides crouching
// to grind.
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
  f.scale.setScalar(0.85);
  p.add(f);
  fish(f, c, belly);
}
const lf_forage: Builder = gp => {
  base(gp, (x, y, z, nx, ny, nz) => {
    const leaf = hash3(Math.floor(x * 70), 5, Math.floor(z * 70));
    if (leaf > 0.95) return ['#8a6a3a', '#7a5228', '#9a7a44'][Math.floor(leaf * 100) % 3];
    return earth(SITE.earth, 18)(x, y, z, nx, ny, nz);
  });
  // ref: 周口店 hearths and 山顶洞 bone needles/shell ornaments; 柿子滩 (Shizitan) grinding slabs with acorn/grass-seed starch
  // gathered food on a spread hide
  const Hd = grp(gp, -0.2, Y + 0.002, 0.08, 0.4, 1.4);
  slab(Hd, [[-0.08, -0.05], [-0.04, -0.07], [0.05, -0.065], [0.085, -0.03], [0.08, 0.04], [0.03, 0.065], [-0.05, 0.06], [-0.09, 0.02]], 0.003, '#8a6a4a', 0, false).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 30; i++) {
    const a = i * 2.4, r = 0.01 + ((i * 37) % 10) / 10 * 0.045, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.7;
    if (i % 4 === 0) dot(Hd, i % 8 ? '#4a2a2e' : '#5a3a2a', x, 0.006, z, 0.004, 6);
    else { el(Hd, '#7a5a34', x, 0.006, z, 0.006, 0.005, 0.0045, a); el(Hd, '#4e3a22', x + 0.002, 0.009, z, 0.004, 0.002, 0.004); }
  }
  for (const [a, l] of [[0.6, 0.05], [2.2, 0.045], [4.0, 0.05]] as const) {
    const sx = -0.05 + Math.cos(a) * 0.01, sz = Math.sin(a) * 0.01 + 0.03;
    sweep(Hd, [{ p: [sx, 0.008, sz], w: 0.008 }, { p: [sx + Math.cos(a) * l * 0.5, 0.008, sz + Math.sin(a) * l * 0.3], w: 0.007 }, { p: [sx + Math.cos(a) * l, 0.005, sz + Math.sin(a) * l * 0.5], w: 0.003 }], '#7e6040', { radial: 7, sub: 3 });
  }
  // stone hearth with fish on sticks
  const fx = 0.16, fz = 0.02;
  for (let k = 0; k < 9; k++) { const a = k * TAU / 9; el(gp, k % 2 ? '#7d776c' : '#8f897d', fx + Math.cos(a) * 0.06, Y + 0.01, fz + Math.sin(a) * 0.06, 0.02, 0.014, 0.018, a); }
  fill(gp, '#3a3430', fx, Y + 0.002, fz, 0.052, 16);
  fire(gp, fx, Y, fz, 0.05);
  onStick(gp, [0.28, Y, 0.12], [0.13, Y + 0.12, 0.0], 0.95, '#6e6a58', '#c8c0a8');
  onStick(gp, [0.27, Y, -0.1], [0.13, Y + 0.11, 0.05], 0.95, '#7a6e54', '#cfc4aa');
  // small sandstone grinding slab with hand-stone and acorn meal; forager in sewn hides crouching to grind
  const sz0 = -0.12, sx0 = -0.02;
  el(gp, '#8c867a', sx0, Y + 0.006, sz0, 0.055, 0.014, 0.034, 0.2);
  el(gp, '#9a948a', sx0, Y + 0.016, sz0, 0.046, 0.005, 0.028, 0.2);
  heap(gp, sx0 - 0.025, Y + 0.019, sz0 + 0.004, 0.012, 0.004, '#c8b48a');
  el(gp, '#6f6a62', sx0 + 0.01, Y + 0.026, sz0, 0.016, 0.008, 0.011, 0.3);
  for (let i = 0; i < 5; i++) el(gp, '#6a4a2a', sx0 + 0.05 + (i % 3) * 0.009, Y + 0.004, sz0 - 0.01 + Math.floor(i / 3) * 0.01, 0.005, 0.004, 0.004);
  who(gp, sx0, Y, sz0 - 0.1, { h: 0.33, pose: 'crouch', top: '#6e5236', bottom: '#5e4630', sleeve: 0.5, dress: 'knee', skin: '#a8784e', hair: '#241a12', build: 1.05, lean: 0.2,
    hands: [[-0.03, 0.12, 0.3], [0.06, 0.12, 0.3]] });
  // a second forager returning with a fire-hardened wooden spear
  const H2 = who(gp, 0.3, Y, -0.24, { h: 0.34, pose: 'stand', ry: -2.4, top: '#5e4630', bottom: '#4e3a26', sleeve: 0.3, dress: 'knee', skin: '#9e7048', hair: '#1e160e', build: 1.1,
    hands: [[-0.13, 0.42, 0.02], [0.15, 0.6, 0.1]] });
  { const [hx, hy, hz] = H2.handR, dx = (hx - 0.3) * 0.15, dz = (hz + 0.24) * 0.15;
    rod(gp, [hx - dx, Y + 0.003, hz - dz], [hx + dx * 1.2, Y + 0.44, hz + dz * 1.2], 0.004, '#6e5434', 6); void hy; }
  // river-mussel shells and a split long bone at the front
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, x = 0.08 + Math.cos(a) * 0.04 + i * 0.01, z = 0.28 + Math.sin(a) * 0.03;
    el(gp, i % 2 ? '#4e4a3e' : '#5a5446', x, Y + 0.002, z, 0.012, 0.004, 0.007, a);
    if (i % 2) el(gp, '#c8c0ae', x + 0.004, Y + 0.004, z + 0.012, 0.011, 0.002, 0.006, a + 0.4);
  }
  rod(gp, [-0.24, Y + 0.005, 0.26], [-0.17, Y + 0.005, 0.3], 0.005, '#d6ccb4', 6);
  for (const e of [[-0.24, 0.26], [-0.17, 0.3]] as const) el(gp, '#d6ccb4', e[0], Y + 0.006, e[1], 0.009, 0.007, 0.008);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// YANGSHAO PAINTED POTTERY & MILLET (Banpo, c. 4500 BC) — loess ground: the face-and-fish basin (人面鱼纹盆) set
// down to dry, a painted jar, a pointed-bottom amphora (尖底瓶), a grey storage jar of foxtail millet, millet plants,
// and a woman kneeling to grind on a saddle quern (磨盘磨棒), all at life scale beside her.
// ---------------------------------------------------------------------------------------------------------
const RED = '#a65a38', INK = '#2a1a12';
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
  sweep(p, [{ p: [x, Y, z], w: 0.004 }, { p: [x + Math.cos(a) * 0.01, Y + h * 0.6, z + Math.sin(a) * 0.01], w: 0.0035 }, { p: top, w: 0.003 }], '#8a8a4a', { radial: 5, sub: 3 });
  for (const [k, s] of [[0.3, 1], [0.55, -1]] as const) {
    const lx = x + Math.cos(a + s) * 0.01, lz = z + Math.sin(a + s) * 0.01, ly = Y + h * k;
    sweep(p, [{ p: [lx, ly, lz], w: 0.005, h: 0.0012 }, { p: [lx + Math.cos(a + s) * 0.05, ly + 0.04, lz + Math.sin(a + s) * 0.05], w: 0.007, h: 0.0012 }, { p: [lx + Math.cos(a + s) * 0.09, ly + 0.02, lz + Math.sin(a + s) * 0.09], w: 0.002, h: 0.001 }], '#7e8448', { radial: 4, sub: 3 });
  }
  const d = [Math.cos(a), Math.sin(a)];
  sweep(p, [
    { p: top, w: 0.005 }, { p: [top[0] + d[0] * 0.022, top[1] + 0.01, top[2] + d[1] * 0.022], w: 0.009 },
    { p: [top[0] + d[0] * 0.045, top[1] - 0.012, top[2] + d[1] * 0.045], w: 0.009 }, { p: [top[0] + d[0] * 0.052, top[1] - 0.045, top[2] + d[1] * 0.052], w: 0.004 },
  ], '#b89a52', { radial: 8, sub: 4, paint: (px, py, pz) => (hash3(Math.floor(px * 400), Math.floor(py * 400), Math.floor(pz * 400)) > 0.6 ? '#a08444' : null) });
}
const lf_pottery: Builder = gp => {
  // ref: 西安半坡 人面鱼纹彩陶盆 (D 44 cm) and 尖底瓶 (National Museum / Banpo Museum); 磁山/裴李岗 querns; carbonised 粟 at Banpo
  base(gp, earth(SITE.loess, 16));
  const Bn = grp(gp, 0.1, Y, -0.1, 0.4, 0.34);
  vessel(Bn, dense([[0.07, 0], [0.11, 0.012], [0.15, 0.04], [0.162, 0.062], [0.19, 0.07]], 0.006), 0.007, RED, banpo, 0, 0, 0, 96, 0.75);
  // painted jar with black sawtooth and swirl bands
  const J = grp(gp, -0.26, Y, -0.16, 0, 0.5);
  vessel(J, dense([[0.045, 0], [0.08, 0.03], [0.11, 0.09], [0.1, 0.14], [0.06, 0.175], [0.045, 0.185], [0.052, 0.2]], 0.008), 0.006, '#ae6a46', (x, y, z) => {
    const a = (ang(x, z) + Math.PI) / TAU;
    if (y > 0.185) return INK;
    if (Math.abs(y - 0.088) < 0.004 || Math.abs(y - 0.17) < 0.004) return INK;
    if (y > 0.09 && y < 0.168) { const f = (a * 10) % 1, t = (y - 0.09) / 0.078; if (Math.abs(f - 0.5) * 2 < t * 0.9 - 0.15 && Math.abs(f - 0.5) * 2 > t * 0.9 - 0.4) return INK; if (Math.hypot(f - 0.5, t - 0.2) < 0.08) return INK; }
    if (y > 0.05 && y < 0.085 && Math.sin(a * TAU * 18 + y * 200) > 0.6) return INK;
    return null;
  }, 0, 0, 0, 48, 0.7);
  for (const s of [-1, 1]) add(J, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#ae6a46'), s * 0.105, 0.08, 0, 0.018, 0.018, 0.018, 0, Math.PI / 2, s * Math.PI / 2);
  // pointed-bottom amphora (尖底瓶) leaning in the earth
  const A = grp(gp, 0.33, Y - 0.01, -0.14, 0, 0.45);
  A.rotation.z = 0.22;
  plathe(A, [[0, 0], [0.018, 0.03], [0.042, 0.11], [0.05, 0.17], [0.045, 0.23], [0.022, 0.27], [0.016, 0.3], [0.024, 0.31], [0.012, 0.315], [0, 0.315]], '#a65a38', (x, y, z) => (Math.sin(y * 260 + ang(x, z) * 6) > 0.7 ? '#8e4a2c' : null), 0, 0, 0, 20);
  for (const s of [-1, 1]) add(A, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#a65a38'), s * 0.05, 0.15, 0, 0.012, 0.012, 0.012, 0, Math.PI / 2, s * Math.PI / 2);
  // millet jar heaped with grain, a spill and a scoop
  const M = grp(gp, 0.22, Y, 0.18, 0, 0.6);
  const mo: [number, number][] = [[0.05, 0], [0.085, 0.04], [0.095, 0.08], [0.085, 0.11], [0.09, 0.12]];
  vessel(M, mo, 0.007, '#8a7a6a', (x, y, z) => (Math.abs(y - 0.1) < 0.004 || (y < 0.09 && Math.sin(y * 300 + ang(x, z) * 3) > 0.85) ? '#6a5a4a' : null), 0, 0, 0, 30);
  heap(M, 0, 0.105, 0, 0.083, 0.04, '#c8aa5e');
  heap(gp, 0.14, Y, 0.27, 0.03, 0.008, '#c8aa5e');
  const sc = grp(gp, 0.13, Y + 0.006, 0.27, 0.6, 0.45);
  vessel(sc, [[0.015, 0], [0.025, 0.012], [0.028, 0.02]], 0.003, '#7a5a3a', null, 0, 0, 0, 14);
  rod(sc, [0.025, 0.014, 0], [0.07, 0.03, 0], 0.004, '#6b4a2a', 5);
  // millet plants
  for (let i = 0; i < 6; i++) millet(gp, -0.38 + (i % 3) * 0.07, -0.02 + Math.floor(i / 3) * 0.07 + (i % 2) * 0.02, 0.24 + (i % 3) * 0.03, -0.6 + i * 0.9);
  // footed saddle quern with roller; woman kneeling to grind
  const Q = grp(gp, -0.1, Y, 0.2, 0, 0.6);
  for (const qx of [-0.08, 0.08]) for (const qz of [-0.025, 0.025]) cyl(Q, '#7d766a', qx, 0, qz, 0.01, 0.022, 7);
  rbox(Q, '#8e877b', 0, 0.02, 0, 0.22, 0.022, 0.08, 0.008);
  heap(Q, -0.07, 0.042, 0, 0.03, 0.01, '#d6c494');
  const roll = cyl(Q, '#6e685e', 0.02, 0.052, 0, 0.011, 0.11, 10);
  roll.rotation.x = Math.PI / 2;
  roll.position.set(0.02, 0.054, 0);
  // sand-tempered cooking jar of millet gruel on a small hearth
  for (let k = 0; k < 7; k++) { const a = k * TAU / 7; el(gp, '#7d776c', 0.26 + Math.cos(a) * 0.045, Y + 0.008, 0.02 + Math.sin(a) * 0.045, 0.014, 0.01, 0.012, a); }
  fire(gp, 0.26, Y, 0.02, 0.03);
  const Cj = grp(gp, 0.26, Y + 0.012, 0.02);
  vessel(Cj, dense([[0.012, 0], [0.03, 0.02], [0.036, 0.045], [0.03, 0.06], [0.032, 0.066]], 0.006), 0.003, '#5a5048', (x, y, z) => (Math.sin(y * 500 + ang(x, z) * 9) > 0.7 ? '#4a4038' : null), 0, 0, 0, 20, 0.9);
  fill(Cj, '#b8a070', 0, 0.056, 0, 0.028, 16, 0.3);
  steam(Cj, 0, 0.066, 0, 0.01, 4, '#f5f5f2', 0.22);
  for (let i = 0; i < 8; i++) dot(Q, '#c8aa5e', -0.05 + i * 0.012, 0.043, (i % 3 - 1) * 0.015, 0.004, 5);
  who(gp, -0.1, Y, 0.08, { h: 0.32, pose: 'kneel', top: '#8a7656', bottom: '#76603e', dress: 'knee', skin: '#b88660', hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot', lean: 0.45,
    hands: [[-0.07, 0.17, 0.4], [0.07, 0.17, 0.4]] });
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// RICE FARMING (稻作) — Neolithic Yangtze rice (河姆渡 / 田螺山, c. 5000 BC): small marshy plots of direct-sown rice
// below a raised bed of ripening grain; a woman cropping ears one by one with a stone knife into a basket, a man turning
// mud with a bone spade (骨耜) lashed to a wooden haft, and the corner of a 干栏 stilt house on piles over the wet ground.
// style 'modern' (1973, 袁隆平): transplanted rows, a farmer in a straw hat and the agronomist holding up an ear by the
// hybrid-rice test-plot sign.
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
const lf_rice: Builder = (gp, r) => {
  const modern = r.style === 'modern';
  // ref: 河姆渡/田螺山 paddies, 骨耜, 干栏 piles and carbonised rice (Zhejiang Provincial Museum); 1973 三系杂交稻 (袁隆平, Anjiang)
  base(gp, earth(SITE.earth, 20));
  const R = 0.43, W = Y + 0.012;
  // back raised bed with ripening rice
  const T = clipRect(-0.5, 0.5, -0.5, -0.12, R + 0.01);
  const tp = add(gp, new THREE.ExtrudeGeometry(new THREE.Shape(T.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 0.07, bevelEnabled: false }), mat('#5e4c34'), 0, Y, 0, 1, 1, 1);
  tp.rotation.x = -Math.PI / 2;
  water(gp, clipRect(-0.5, 0.5, -0.5, -0.135, R - 0.01), Y + 0.065, '#7a7c62');
  for (let i = 0; i < 14; i++) for (let j = 0; j < 5; j++) {
    const k = hash3(i, j, 3), x = -0.38 + i * 0.056 + (modern ? (j % 2) * 0.02 : (k - 0.5) * 0.04), z = -0.17 - j * 0.05 + (modern ? 0 : (hash3(j, i, 5) - 0.5) * 0.03);
    if (Math.hypot(x, z) > R - 0.04) continue;
    const yy = Y + 0.066, hh = (modern ? 0.09 : 0.11) + k * 0.02;
    cone(gp, '#9a9050', x, yy, z, 0.012, hh, 5);
    el(gp, k > 0.5 ? '#bfa458' : '#b39a50', x + 0.01, yy + hh - 0.01, z + 0.008, 0.007, 0.02, 0.007, 0, 0.3, -0.6);
    el(gp, '#c4aa5e', x - 0.008, yy + hh - 0.006, z - 0.006, 0.006, 0.018, 0.006, 0, -0.2, 0.6);
  }
  // bund and two flooded plots of muddy water
  box(gp, '#6e5a3e', 0.04, Y, 0.12, 0.03, 0.022, 0.62);
  water(gp, clipRect(-0.5, 0.025, -0.12, 0.5, R), W, '#7a8a80');
  water(gp, clipRect(0.055, 0.5, -0.12, 0.5, R), W, '#76867c');
  add(gp, new THREE.TorusGeometry(R + 0.008, 0.012, 6, 64), mat('#5e4e36'), 0, Y + 0.004, 0, 1, 1, 1, 0, Math.PI / 2);
  if (modern) {
    // transplanted rows, the farmer bent to plant
    for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) {
      const x = -0.37 + i * 0.048, z = -0.09 + j * 0.052;
      if (Math.hypot(x, z) > R - 0.03 || (z > 0.2 && x > -0.2)) continue;
      const k = hash3(i, j, 1);
      cone(gp, k > 0.5 ? '#5e8a3e' : '#557e38', x, W - 0.004, z, 0.008, 0.05 + k * 0.015, 4);
      cone(gp, '#678f46', x + 0.004, W - 0.004, z + 0.002, 0.006, 0.04, 4).rotation.z = -0.3;
    }
    const rig = who(gp, -0.1, Y, 0.27, { h: 0.31, ry: -0.3, pose: 'stand', lean: 1.0, hipY: 0.47, top: '#4e6274', bottom: '#2e3440', shorts: true, sleeve: 0.45, skin: '#a8754e', hat: '#c8b07a', hatStyle: 'conical',
      feet: [[-0.08, 0.032, 0.06], [0.08, 0.032, -0.04]], hands: [[-0.06, 0.18, 0.36], [0.06, 0.1, 0.42]] });
    const [hx, hy, hz] = rig.handL;
    for (let k = 0; k < 5; k++) rod(gp, [hx, hy, hz], [hx - 0.015 + k * 0.008, hy + 0.05, hz - 0.01], 0.003, '#5e8a3e', 4);
    for (let k = 0; k < 4; k++) cone(gp, '#5e8a3e', -0.15 + k * 0.035, W - 0.004, 0.33 - k * 0.01, 0.008, 0.045, 4);
    rod(gp, [0.18, Y, -0.02], [0.18, Y + 0.2, -0.02], 0.005, '#8a7a5a', 6);
    rbox(gp, '#e2ddce', 0.18, Y + 0.13, -0.015, 0.14, 0.07, 0.006, 0.002);
    box(gp, '#8e2a22', 0.18, Y + 0.188, -0.011, 0.14, 0.01, 0.002);
    for (let k = 0; k < 6; k++) box(gp, k < 4 ? '#8e2a22' : '#2a2a2a', 0.13 + (k % 4) * 0.03, Y + 0.16 - Math.floor(k / 4) * 0.026, -0.011, k < 4 ? 0.02 : 0.05, k < 4 ? 0.018 : 0.005, 0.002);
    const y2 = who(gp, 0.26, Y, 0.12, { h: 0.33, ry: -0.4, pose: 'stand', top: '#e6e4dc', bottom: '#4e4e4c', sleeve: 0.45, skin: '#a8784e', hair: '#8a8a86', shoes: '#3a2a1a',
      hands: [[-0.12, 0.47, 0.05], [0.08, 0.72, 0.2]] });
    const [ex, ey, ez] = y2.handR;
    rod(gp, [ex, ey - 0.01, ez], [ex + 0.01, ey + 0.05, ez], 0.003, '#a89048', 4);
    el(gp, '#bfa458', ex + 0.014, ey + 0.055, ez, 0.006, 0.016, 0.006, 0, 0, -0.5);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = 0.14 + i * 0.06, z = 0.16 + j * 0.055;
      if (Math.hypot(x, z) > R - 0.04 || (x > 0.2 && z < 0.2)) continue;
      cone(gp, '#4a7a34', x, W - 0.004, z, 0.011, 0.08, 4);
      el(gp, '#b39a50', x + 0.008, W + 0.07, z, 0.005, 0.014, 0.005, 0, 0, -0.4);
    }
    return;
  }
  // direct-sown rice, irregular clumps
  for (let i = 0; i < 70; i++) {
    const x = -0.4 + hash3(i, 1, 7) * 0.42, z = -0.09 + hash3(i, 2, 7) * 0.5, k = hash3(i, 3, 7);
    if (Math.hypot(x, z) > R - 0.03 || Math.hypot(x + 0.2, z - 0.24) < 0.08) continue;
    cone(gp, k > 0.5 ? '#6a8644' : '#5e7a3c', x, W - 0.004, z, 0.007, 0.045 + k * 0.03, 4);
    cone(gp, '#72904a', x + 0.004, W - 0.004, z + 0.002, 0.005, 0.04, 4).rotation.z = -0.35;
  }
  // woman cropping ears with a stone knife, basket at her side
  const hv = who(gp, -0.16, Y + 0.01, -0.05, { h: 0.31, ry: Math.PI + 0.2, pose: 'stand', lean: 0.25, top: '#8a7a5c', bottom: '#7a6a4e', dress: 'knee', sleeve: 0.5, skin: '#b07a52', hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot',
    hands: [[-0.08, 0.5, 0.3], [0.05, 0.52, 0.32]] });
  const [kx, ky, kz] = hv.handR;
  rbox(gp, '#5e5a52', kx - 0.008, ky - 0.004, kz, 0.018, 0.008, 0.003, 0.002);
  const Bk = grp(gp, -0.06, Y + 0.012, -0.05);
  vessel(Bk, [[0.022, 0], [0.032, 0.02], [0.036, 0.045]], 0.003, '#8e7a50', (x, y, z) => (Math.sin(ang(x, z) * 20 + y * 300) > 0.4 ? '#7a6642' : null), 0, 0, 0, 16);
  for (let i = 0; i < 6; i++) el(Bk, '#bfa458', Math.cos(i * 1.1) * 0.016, 0.044, Math.sin(i * 1.1) * 0.016, 0.006, 0.014, 0.006, 0, i, 1.2);
  // man working the mud with a bone spade
  const dg = who(gp, -0.22, W - 0.006, 0.24, { h: 0.32, ry: 0.5, pose: 'stand', lean: 0.2, top: '#7a6a50', bottom: '#6a5a44', dress: 'knee', sleeve: 0.4, skin: '#a8724c', hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot',
    feet: [[-0.07, 0.03, 0.0], [0.08, 0.14, 0.14]], hands: [[0.0, 0.62, 0.22], [0.02, 0.45, 0.24]] });
  const [ux, uy, uz] = dg.handL, [lx, ly, lz] = dg.handR;
  const sd = new THREE.Vector3(lx - ux, ly - uy, lz - uz).normalize(), tipY = W - 0.002, t = (uy - tipY) / -sd.y;
  const tip: V3 = [ux + sd.x * t, tipY, uz + sd.z * t];
  rod(gp, [ux - sd.x * 0.02, uy - sd.y * 0.02, uz - sd.z * 0.02], tip, 0.004, '#6a5034', 5);
  const sp = rbox(gp, '#d8ccb0', tip[0], tip[1] - 0.012, tip[2], 0.03, 0.045, 0.006, 0.003);
  sp.rotation.y = 0.5;
  // corner of a stilt house: piles, plank floor, reed wall, thatched roof with the gable to the front
  const H = grp(gp, 0.25, Y, 0.04), FY = 0.1;
  for (const px of [-0.12, 0, 0.12]) for (const pz of [-0.1, 0.1]) cyl(H, '#4e3a26', px, 0, pz, 0.007, FY, 6);
  rbox(H, '#6a5236', 0, FY, 0, 0.29, 0.012, 0.25, 0.002);
  for (let i = 0; i < 7; i++) box(H, '#5a4430', -0.13 + i * 0.043, FY + 0.012, 0, 0.002, 0.001, 0.25);
  box(H, '#8a7a56', 0, FY + 0.012, -0.11, 0.27, 0.17, 0.012);
  for (let i = 0; i < 20; i++) box(H, '#7a6a48', -0.13 + i * 0.0137, FY + 0.012, -0.103, 0.003, 0.17, 0.002);
  const ROOF = '#8e7c54', a = 0.68, L = 0.2, RY = FY + 0.27;
  for (const sx of [-1, 1]) {
    const sl = add(H, paintFaces(new THREE.BoxGeometry(L, 0.022, 0.3, 6, 1, 8), ROOF, (_x, _y, z) => (Math.sin(z * 260) > 0.6 ? '#7a6a46' : null)), mat('#ffffff', { vc: true, rough: 1 }), sx * Math.cos(a) * L / 2, RY - Math.sin(a) * L / 2, 0, 1, 1, 1);
    sl.rotation.z = -sx * a;
  }
  rod(H, [0, RY + 0.008, -0.15], [0, RY + 0.008, 0.15], 0.008, '#6e5e3e', 6);
  rod(H, [-0.07, 0, 0.17], [-0.06, FY, 0.11], 0.007, '#4e3a26', 5);
  const Fu = grp(H, 0.06, FY + 0.012, 0.02);
  vessel(Fu, dense([[0.012, 0], [0.03, 0.012], [0.038, 0.03], [0.034, 0.036], [0.042, 0.042]], 0.006), 0.003, '#2e2a26', null, 0, 0, 0, 18, 0.85);
  for (let i = 0; i < 8; i++) el(H, '#bfa458', -0.06 + Math.cos(i) * 0.02, FY + 0.018, 0.04 + Math.sin(i * 1.7) * 0.02, 0.006, 0.004, 0.018, 0, i * 0.7);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// GRAIN WINE BREWING (杜康酿酒, Xia / Erlitou) — a rammed-earth yard of big mud-sealed pottery fermentation jars, an
// open vat of millet mash stirred by the brewer, a grey pottery 甗 steaming the grain over a wood fire, the earliest
// bronze jue cups on a low lacquer table, millet heaped on mats and a sheaf of 秫 (glutinous millet).
// ---------------------------------------------------------------------------------------------------------
function jue(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s = 1): void {
  const j = grp(p, x, y, z, ry, s), C = '#8c7a46';
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + Math.PI / 2; rod(j, [Math.cos(a) * 0.012, 0.035, Math.sin(a) * 0.012], [Math.cos(a) * 0.026, 0, Math.sin(a) * 0.026], 0.003, C, 4); }
  vessel(j, [[0.012, 0.03], [0.016, 0.045], [0.017, 0.07], [0.02, 0.078]], 0.002, C, (_x, yy) => (Math.abs(yy - 0.055) < 0.006 ? '#55583a' : null), 0, 0, 0, 16, 0.4, 0.5);
  sweep(j, [{ p: [0.012, 0.075, 0], w: 0.008, h: 0.004 }, { p: [0.035, 0.078, 0], w: 0.007, h: 0.004 }, { p: [0.05, 0.083, 0], w: 0.004, h: 0.002 }], C, { radial: 6, sub: 2, squash: 0.2 });
  cone(j, C, -0.025, 0.074, 0, 0.006, 0.012, 5).rotation.z = Math.PI / 2;
  for (const sz of [-1, 1]) { rod(j, [0.008, 0.077, sz * 0.012], [0.008, 0.092, sz * 0.012], 0.003, C, 4); dot(j, C, 0.008, 0.094, sz * 0.012, 0.004, 6); }
  add(j, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat(C), 0, 0.055, -0.017, 0.01, 0.01, 0.01, Math.PI / 2, 0, -Math.PI / 2);
}
function sealedJar(p: THREE.Object3D, x: number, z: number, s: number, seal: string): void {
  const j = grp(p, x, Y, z, 0, s);
  const jo: [number, number][] = [[0.07, 0], [0.11, 0.04], [0.135, 0.12], [0.125, 0.19], [0.08, 0.235], [0.065, 0.25]];
  plathe(j, [[0, 0], ...dense(jo, 0.02), [0, 0.25]], '#6a4630', (xx, y, zz) => (y < 0.06 ? '#9a6a46' : Math.abs(y - 0.17) < 0.004 || Math.abs(y - 0.1) < 0.003 ? '#4e3220' : null), 0, 0, 0, 30, 0.45);
  plathe(j, [[0, 0.272], [0.04, 0.268], [0.07, 0.255], [0.082, 0.24], [0.078, 0.232], [0, 0.24]], seal, (xx, y, zz) => (hash3(Math.floor(xx * 300), Math.floor(y * 300), Math.floor(zz * 300)) > 0.7 ? shade(seal, 0.85) : null), 0, 0, 0, 20, 1);
}
const lf_wine: Builder = gp => {
  // ref: 二里头 bronze 爵 and pottery 大口尊/甗; 《说文》“杜康作秫酒”; mud-sealed jars as at 贾湖/大汶口 brewing sites
  base(gp, earth(SITE.earth, 16));
  sealedJar(gp, -0.3, -0.22, 0.6, '#7a6a52');
  sealedJar(gp, -0.16, -0.3, 0.65, '#827058');
  sealedJar(gp, -0.37, -0.05, 0.55, '#76664e');
  // open mash vat being stirred
  const V = grp(gp, -0.12, Y, 0.05, 0, 0.7);
  const vo: [number, number][] = [[0.07, 0], [0.11, 0.04], [0.13, 0.1], [0.125, 0.15], [0.13, 0.16]];
  vessel(V, dense(vo, 0.02), 0.008, '#6a4630', (_x, y) => (y < 0.05 ? '#9a6a46' : null), 0, 0, 0, 30, 0.45);
  heap(V, 0, 0.13, 0, rAt(vo, 0.13) - 0.008, 0.012, '#b89c66', (x, _y, z) => { const n = fbm(x * 90, 1, z * 90, 2); return n > 0.62 ? '#ccb486' : n < 0.36 ? '#96784a' : null; });
  for (let i = 0; i < 5; i++) dot(V, '#d8caa4', Math.cos(i * 2.3) * 0.06, 0.143, Math.sin(i * 2.3) * 0.06, 0.006, 6);
  const br = who(gp, -0.13, Y, -0.08, { h: 0.33, ry: 0.15, pose: 'stand', lean: 0.25, top: '#7e6c52', bottom: '#5e4e3a', dress: 'knee', hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot', skin: '#c8916a',
    hands: [[-0.02, 0.55, 0.3], [0.03, 0.72, 0.26]] });
  const [ax, ay, az] = br.handR, [bx2, by2, bz2] = br.handL, dir = new THREE.Vector3(bx2 - ax, by2 - ay, bz2 - az).normalize();
  rod(gp, [ax - dir.x * 0.04, ay - dir.y * 0.04, az - dir.z * 0.04], [ax + dir.x * 0.15, ay + dir.y * 0.15, az + dir.z * 0.15], 0.004, '#7a5a34', 6);
  const pe: V3 = [ax + dir.x * 0.15, ay + dir.y * 0.15, az + dir.z * 0.15];
  rbox(gp, '#7a5a34', pe[0] - 0.008, pe[1] - 0.02, pe[2] - 0.003, 0.016, 0.026, 0.006, 0.002);
  // grey pottery 甗 steaming millet over a wood fire on three stones
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.3; el(gp, '#7a756a', 0.22 + Math.cos(a) * 0.055, Y + 0.012, -0.12 + Math.sin(a) * 0.055, 0.022, 0.018, 0.02, a); }
  fire(gp, 0.22, Y, -0.12, 0.05);
  liSteamer(gp, 0.22, Y + 0.006, -0.12, 0.8, '#7e786c');
  // low table with bronze jue cups
  const ty = table(gp, 0.07, Y, 0.22, 0.2, 0.1, 0.05, '#2e1a14');
  jue(gp, 0.03, ty, 0.22, 0.4, 0.6);
  jue(gp, 0.11, ty, 0.22, -0.5, 0.6);
  // millet heaped on reed mats and a sheaf of ripe 秫 leaning by the jars
  for (const [hx, hz, c] of [[0.33, 0.1, '#c8ae6a'], [0.26, 0.3, '#b89c5c']] as const) {
    cyl(gp, '#a89062', hx, Y, hz, 0.07, 0.004, 16);
    heap(gp, hx, Y + 0.004, hz, 0.06, 0.035, c);
  }
  for (let k = 0; k < 7; k++) millet(gp, -0.27 + k * 0.012, 0.28 + (k % 2) * 0.012, 0.2 + (k % 3) * 0.02, -1.2 + k * 0.35);
  for (let k = 0; k < 6; k++) rod(gp, [-0.24, Y + 0.05, 0.29], [-0.24 + Math.cos(k) * 0.01, Y + 0.07, 0.29 + Math.sin(k) * 0.01], 0.003, '#7a6a40', 3);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SHANG DING COOKING (鼎烹) — a life-size bronze tripod cooking ding (立耳, taotie band, flanges; ≈0.8 m) straddling a
// small wood fire in an ash-ringed hearth, joints of meat stewing; a cook in a knee-length belted tunic with a bronze
// 匕 ladle, a kneeling helper feeding the fire, a grey pottery 甗 steaming grain on its own fire, a wooden 俎 with meat
// and a bronze knife, a water jar and stacked firewood.
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
  base(gp, earth(SITE.earth, 18));
  // ref: 殷墟 妇好墓 bronze ding and 三联甗 (soot on the legs shows they were cooked over fire); 伊尹负鼎俎 (《史记·殷本纪》); 安阳 jade figures for dress
  fill(gp, '#4a4038', 0.0, Y + 0.002, 0.0, 0.1, 24);
  for (let k = 0; k < 11; k++) { const a = k * TAU / 11; el(gp, k % 2 ? '#7d776c' : '#8f897d', Math.cos(a) * 0.105, Y + 0.006, Math.sin(a) * 0.105, 0.016, 0.011, 0.013, a); }
  fire(gp, 0, Y, 0.0, 0.035);
  const S = 0.42, sy = Y + ding(gp, 0, Y, 0.0, S, 0.3, 0.15) * S;
  fill(gp, '#5a4028', 0, sy, 0.0, 0.17 * S, 24, 0.3);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.012 + (i % 3) * 0.014;
    gloss(gp, i % 3 ? '#7a5440' : '#8e6a52', Math.cos(a) * r, sy + 0.003, Math.sin(a) * r, 0.011, 0.006, 0.008, a);
  }
  rod(gp, [-0.025, sy + 0.004, -0.01], [0.01, sy + 0.012, 0.02], 0.003, '#d8ccb4', 5);
  steam(gp, -0.01, sy + 0.005, 0.0, 0.018, 5, '#f0eee8', 0.28);
  // cook with a long bronze 匕
  const ck = who(gp, 0.17, Y, -0.1, { h: 0.33, ry: -1.0, pose: 'stand', lean: 0.15, top: '#6e5a40', bottom: '#4a3c2a', dress: 'knee', sleeve: 0.85, hat: '#1c140e', hatStyle: 'knot', skin: '#c08a62', hair: '#1c140e',
    hands: [[-0.06, 0.5, 0.28], [0.05, 0.56, 0.24]] });
  const [ax, ay, az] = ck.handR, tip: V3 = [0.025, sy + 0.012, 0.0];
  rod(gp, [ax + (ax - tip[0]) * 0.15, ay + (ay - tip[1]) * 0.15, az + (az - tip[2]) * 0.15], tip, 0.0025, BRZ, 5);
  el(gp, BRZ, tip[0], tip[1] - 0.004, tip[2], 0.01, 0.003, 0.007, 0.4);
  // kneeling helper pushing a branch into the fire
  const hp = who(gp, -0.17, Y, 0.08, { h: 0.32, ry: 2.1, pose: 'crouch', lean: 0.3, top: '#7a6a50', bottom: '#5a4c38', dress: 'knee', sleeve: 0.7, hat: '#1c140e', hatStyle: 'knot', skin: '#b88058', hair: '#1c140e',
    hands: [[-0.03, 0.22, 0.28], [0.04, 0.24, 0.3]] });
  { const [hx, hy, hz] = hp.handR; rod(gp, [hx, hy, hz], [-0.03, Y + 0.012, 0.015], 0.004, '#6b4a2a', 5); }
  // grey pottery 甗 steaming millet on its own fire
  fire(gp, -0.22, Y, -0.2, 0.025);
  liSteamer(gp, -0.22, Y, -0.2, 0.55, '#7e786c');
  // wooden 俎 with joints of meat and a bronze knife
  const zy = table(gp, 0.22, Y, 0.2, 0.13, 0.06, 0.04, '#5a3a24', 0.4, '#4a2e1c');
  const Zu = grp(gp, 0.22, zy, 0.2, 0.4);
  gloss(Zu, '#8a4a3a', -0.03, 0.006, 0, 0.022, 0.008, 0.016, 0.2);
  gloss(Zu, '#7e4436', 0.0, 0.005, 0.005, 0.016, 0.007, 0.012, 0.6);
  el(Zu, '#d8ccb4', -0.045, 0.008, 0.0, 0.006, 0.004, 0.004);
  box(Zu, BRZ, 0.035, 0.002, 0.0, 0.036, 0.002, 0.009, 0.2);
  // grey water jar and stacked firewood
  const Jr = grp(gp, -0.2, Y, 0.27, 0, 0.5);
  vessel(Jr, dense([[0.04, 0], [0.09, 0.06], [0.1, 0.11], [0.08, 0.17], [0.05, 0.19], [0.055, 0.21]], 0.012), 0.006, '#7e786c', (x, y, z) => (Math.sin(y * 300 + ang(x, z) * 6) > 0.75 ? '#6e685e' : null), 0, 0, 0, 22, 0.9);
  fill(Jr, '#3a4a4a', 0, 0.2, 0, 0.05, 16, 0.1);
  for (let k = 0; k < 9; k++) { const x0 = 0.22 + (k % 3) * 0.012, y0 = Y + 0.006 + Math.floor(k / 3) * 0.011; rod(gp, [x0, y0, -0.3], [x0 + 0.1, y0, -0.2], 0.006, k % 2 ? '#6b4a2a' : '#7c5634', 6); }
  // grey pottery 豆 and a 簋-shaped bowl of millet set out for the meal
  for (const [bx, bz] of [[-0.06, 0.26], [0.02, 0.3]] as const) { const Bw = grp(gp, bx, Y, bz, 0, 0.45); plathe(Bw, [[0, 0], [0.035, 0], [0.025, 0.01], [0.016, 0.05], [0.04, 0.06], [0.07, 0.09], [0.062, 0.092], [0, 0.07]], '#7e786c', null, 0, 0, 0, 20); heap(Bw, 0, 0.082, 0, 0.06, 0.02, bx < 0 ? '#c8ae6a' : '#7a5440'); }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DUANWU ZONGZI (粽子), Warring States Chu — by the Miluo river where Qu Yuan drowned: a Chu woman in a wrapped
// 曲裾 robe kneels at a black-and-red lacquer table wrapping millet in wild-rice (菰) leaves (角黍, the oldest zongzi),
// a pottery 釜 boils more over three stones, a basin of soaking leaves, mugwort hung to dry, a dugout on the river.
// ---------------------------------------------------------------------------------------------------------
function zongzi(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, tilt = 0, c = '#5f9a3a', rice = false): void {
  const zg = grp(p, x, y, z, ry, s);
  zg.rotation.z = tilt;
  const H = 0.08, R = 0.055;
  const geo = paintFaces(new THREE.ConeGeometry(R, H, 3, 3), c, rice
    ? (px, py, pz) => shade(c, hash3(Math.floor(px * 600), Math.floor(py * 600), Math.floor(pz * 600)) > 0.6 ? 0.88 : 1)
    : (px, py, pz) => (Math.sin((px + pz) * 180 + py * 60) > 0.7 ? shade(c, 0.78) : Math.sin((px - pz) * 90) > 0.85 ? shade(c, 1.15) : null));
  add(zg, geo, mat('#ffffff', { vc: true, flat: true, rough: rice ? 0.8 : 0.45 }), 0, H / 2, 0, 1, 1, 1);
  if (rice) return;
  for (const h of [0.022, 0.048]) {
    const rr = R * (1 - h / H) * 0.52 + 0.002, pts: V3[] = [];
    for (let k = 0; k <= 3; k++) { const a = (k / 3) * TAU; pts.push([Math.sin(a) * rr * 2, h, Math.cos(a) * rr * 2]); }
    for (let k = 0; k < 3; k++) rod(zg, pts[k], pts[k + 1], 0.003, '#c9a46a', 4);
  }
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
  // ref: 周处《风土记》"以菰叶裹黏米…谓之角黍"; Chu lacquer 漆案/漆盘 and 曲裾 robes from 马山一号楚墓 / 包山楚墓
  const LQ = '#2a1a16', LQR = '#7a2a1c';
  base(gp, earth(SITE.earth, 18));
  water(gp, clipRect(-0.5, 0.5, -0.5, -0.26, 0.45), Y + 0.003, '#5a6e6a');
  const Bt = grp(gp, 0.14, Y + 0.004, -0.34, 0.12);
  sweep(Bt, [{ p: [-0.13, 0.016, 0], w: 0.008, h: 0.01 }, { p: [-0.09, 0.012, 0], w: 0.032, h: 0.02 }, { p: [0.08, 0.012, 0], w: 0.032, h: 0.02 }, { p: [0.13, 0.016, 0], w: 0.01, h: 0.01 }], '#5a4430', { radial: 10, sub: 3, squash: 1, paint: (_x, py) => (py > 0.02 ? '#3a2a1c' : null) });
  rod(gp, [0.04, Y + 0.02, -0.3], [0.2, Y + 0.004, -0.42], 0.003, '#6a5034', 4);
  // lacquer table (案): black with a red border, on it a lacquer dish of leaf-wrapped 角黍 and one opened
  const ty = Y + 0.05;
  const T = grp(gp, 0.04, Y, 0.1, -0.1);
  rbox(T, LQ, 0, 0.042, 0, 0.24, 0.008, 0.12, 0.003);
  box(T, LQR, 0, 0.05, 0, 0.226, 0.0006, 0.106);
  box(T, LQ, 0, 0.0505, 0, 0.21, 0.0008, 0.09);
  for (const sx of [-1, 1]) { box(T, LQ, sx * 0.1, 0, 0, 0.012, 0.042, 0.1); box(T, LQ, sx * 0.1, 0, 0, 0.03, 0.006, 0.11); }
  const dp = (x: number, z: number, R: number) => { plathe(T, [[0, 0], [R * 0.7, 0], [R, 0.012], [R * 0.95, 0.013], [R * 0.66, 0.004], [0, 0.004]], LQ, (px, py, pz) => { const r = Math.hypot(px, pz); return r > R * 0.88 || Math.abs(r - R * 0.5) < 0.002 ? LQR : null; }, x, ty - Y, z, 28, 0.25); return ty - Y + 0.004; };
  const py = dp(-0.04, 0, 0.055);
  const ring: [number, number, number][] = [[-0.022, 0.012, 0.3], [0.0, 0.026, 1.2], [0.022, 0.01, 2.0], [-0.012, -0.018, 0.8], [0.018, -0.018, 2.6]];
  for (const [x, z, ry] of ring) zongzi(T, -0.04 + x, py, z, 0.42, ry, 0, '#5c7440');
  zongzi(T, -0.042, py + 0.012, 0.004, 0.42, 0.5, 0.25, '#667c48');
  const uy = dp(0.065, 0.01, 0.034);
  for (const a of [0.4, 2.3, 4.2]) { const lf = slab(grp(T, 0.065, uy + 0.001, 0.01, a), [[0, -0.01], [0.03, -0.013], [0.06, 0], [0.03, 0.013], [0, 0.01]], 0.001, '#5c7440', 0, true); lf.rotation.x = Math.PI / 2; }
  zongzi(T, 0.065, uy + 0.001, 0.01, 0.5, 0.3, 0, '#d8c48a', true);
  el(T, '#5a1a14', 0.068, uy + 0.017, 0.018, 0.006, 0.007, 0.004);
  // Chu woman kneeling behind the table, wrapping a leaf cone of millet
  const wm = seiza(gp, 0.06, -0.03, { h: 0.32, ry: -0.1, top: '#6a4a36', bottom: '#4a3226', dress: 'ankle', hair: '#1c1410', hat: '#1c1410', hatStyle: 'knot', skin: '#d8a882', lean: 0.15,
    hands: [[-0.04, 0.32, 0.22], [0.05, 0.32, 0.22]] });
  const [hx, hy, hz] = wm.handL;
  zongzi(gp, hx + 0.012, hy - 0.006, hz + 0.004, 0.4, 0.3, Math.PI, '#5c7440');
  for (let k = 0; k < 5; k++) { const lf = slab(grp(gp, -0.08 + k * 0.006, ty + 0.001 + k * 0.001, 0.15, 0.3 + k * 0.1), [[0, -0.008], [0.04, -0.011], [0.08, 0], [0.04, 0.011], [0, 0.008]], 0.001, '#5c7440', 0, true); lf.rotation.x = Math.PI / 2; }
  // pottery 釜 on three stones over a fire, zongzi bobbing
  const P = grp(gp, -0.23, Y, -0.08);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.3; el(P, '#7a746a', Math.cos(a) * 0.05, 0.016, Math.sin(a) * 0.05, 0.022, 0.018, 0.02, a); }
  fire(P, 0, 0, 0, 0.04);
  const po: [number, number][] = dense([[0.0, 0.03], [0.04, 0.036], [0.062, 0.06], [0.058, 0.09], [0.05, 0.1], [0.056, 0.106]], 0.008);
  vessel(P, po, 0.004, '#6a5a4a', (_x, y) => (y < 0.06 ? '#3a302a' : null), 0, 0, 0, 24, 0.85);
  fill(P, '#a89a7a', 0, 0.096, 0, 0.05, 20, 0.2);
  for (let k = 0; k < 3; k++) { const a = k * 2.1; zongzi(P, Math.cos(a) * 0.022, 0.088, Math.sin(a) * 0.022, 0.35, a, 0.3, '#56683c'); }
  steam(P, 0, 0.1, 0, 0.018, 5);
  // basin of soaking leaves
  const Bs = grp(gp, -0.22, Y, 0.2);
  vessel(Bs, [[0.03, 0], [0.05, 0.02], [0.055, 0.03]], 0.003, '#7a6a58', null, 0, 0, 0, 20, 0.85);
  fill(Bs, '#5a6a5a', 0, 0.024, 0, 0.05, 20, 0.15);
  for (let k = 0; k < 6; k++) { const lf = slab(grp(Bs, 0, 0.026, 0, k * 0.5), [[-0.04, -0.008], [0, -0.011], [0.04, 0], [0, 0.011], [-0.04, 0.008]], 0.001, '#5c7440', 0, true); lf.rotation.x = Math.PI / 2; }
  // mugwort bundle hung on a post, tied with hemp
  const M = grp(gp, 0.3, Y, -0.12, 0.2);
  rod(M, [0, 0, 0], [0, 0.26, 0], 0.006, '#5a4430', 5);
  for (let k = 0; k < 7; k++) {
    const ox = (k - 3) * 0.004, tp: V3 = [0.02 + ox * 2, 0.08, 0.02 + (k % 3 - 1) * 0.008];
    rod(M, [0.008, 0.24, 0.006], tp, 0.002, '#6a7a52', 4);
    el(M, k % 2 ? '#6e8058' : '#7e8e68', tp[0], tp[1] + 0.03, tp[2], 0.008, 0.026, 0.006, k);
  }
  add(M, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#a8946a'), 0.008, 0.235, 0.006, 0.012, 0.012, 0.016, 0, Math.PI / 2);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// TOFU MAKING (豆腐, Western Han, Liu An legend) — a flagstone yard laid out like the Eastern Han tofu-making mural
// at 打虎亭 (Mixian): a man in a Han 帻 kneels turning a small two-stone hand mill set in a stone basin, soy milk
// running from the spout into a pottery basin; a clay range boils the milk in a 釜; a draining board with a freshly
// pressed block (frame lifted off), a second press still weighted with a stone; a tray of cut cubes, a hemp sack
// and a basket of soaked beans — all at life size.
// ---------------------------------------------------------------------------------------------------------
const GRANITE = '#9a968c', SOY = '#cdb474', TOFU = '#ebe5d2', MILK = '#e6e0cc';
const granite = (c: string): Paint => (x, y, z) => shade(c, 0.86 + hash3(Math.floor(x * 300), Math.floor(y * 300), Math.floor(z * 300)) * 0.22);
function sack(p: THREE.Object3D, x: number, z: number, s: number, ry: number, beans: string, c = '#c4a676'): void {
  const k = grp(p, x, Y, z, ry, s);
  plathe(k, [[0, 0], [0.07, 0.004], [0.088, 0.04], [0.09, 0.1], [0.08, 0.14], [0.09, 0.155], [0.084, 0.158], [0.072, 0.14], [0, 0.14]], c,
    (px, py, pz) => (Math.abs(py - 0.145) < 0.006 ? shade(c, 0.8) : (Math.floor(px * 220) + Math.floor(py * 220) + Math.floor(pz * 220)) % 2 ? shade(c, 0.92) : null), 0, 0, 0, 22);
  heap(k, 0, 0.138, 0, 0.074, 0.03, beans);
  for (let i = 0; i < 7; i++) el(k, shade(beans, 0.95 + (i % 3) * 0.05), Math.cos(i * 2.1) * 0.04, 0.158 + (i % 2) * 0.006, Math.sin(i * 2.1) * 0.04, 0.009, 0.007, 0.009);
}
const lf_tofu: Builder = gp => {
  base(gp, tiles(SITE.paving, 0.07));
  // ref: 打虎亭汉墓 东汉 豆腐作坊 mural (浸豆、磨豆、滤浆、点卤、压榨); Han stone hand mills (满城汉墓) and 陶灶 models
  // clay range boiling the soy milk
  const Z = hanZao(gp, -0.24, -0.16, 0.5, 0.26, 0.13, 0.08);
  const my = fu(Z.G, 0, Z.top, Z.zBig, 0.05, '#4a4038', MILK);
  add(Z.G, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#d8d0b8'), 0, my + 0.001, Z.zBig, 0.03, 0.03, 0.03, Math.PI / 2);
  steam(Z.G, 0, my + 0.01, Z.zBig, 0.016, 5, '#f0eee8', 0.26);
  fu(Z.G, 0, Z.top, Z.zSmall, 0.036, '#5a5046', '#7a6a4a');
  // small two-stone hand mill (≈0.6 m) set in a stone basin with a spout, beans in the feed hole, upright turning peg
  const mx = 0.0, mz = 0.08, M = grp(gp, mx, Y, mz, 0, 0.45);
  plathe(M, [[0, 0], [0.11, 0], [0.1, 0.05], [0, 0.05]], GRANITE, granite(GRANITE), 0, 0, 0, 24);
  vessel(M, [[0.15, 0.05], [0.165, 0.065], [0.17, 0.085]], 0.012, GRANITE, granite('#8e8a80'), 0, 0, 0, 36);
  fill(M, MILK, 0, 0.072, 0, 0.155, 30, 0.15);
  rbox(M, '#8e8a80', -0.022, 0.06, 0.15, 0.044, 0.022, 0.07, 0.006);
  box(M, MILK, -0.014, 0.08, 0.15, 0.028, 0.003, 0.068);
  plathe(M, [[0, 0.07], [0.105, 0.07], [0.105, 0.11], [0, 0.11]], '#a8a498', granite('#a8a498'), 0, 0, 0, 28);
  plathe(M, [[0, 0.112], [0.105, 0.112], [0.104, 0.165], [0.09, 0.17], [0, 0.17]], '#b0ab9f', (px, py, pz) => {
    const r = Math.hypot(px, pz);
    if (py > 0.168 && r < 0.03) return '#3a3630';
    if (py > 0.112 && py < 0.118) return '#6e6a62';
    return granite('#b0ab9f')(px, py, pz, 0, 0, 0);
  }, 0, 0, 0, 28);
  for (let i = 0; i < 6; i++) el(M, SOY, Math.cos(i * 1.7) * 0.016, 0.172, Math.sin(i * 1.7) * 0.016, 0.009, 0.007, 0.009);
  add(M, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat(MILK), 0, 0.11, 0, 0.106, 0.106, 0.08, 0, Math.PI / 2);
  rod(M, [0.0, 0.14, -0.105], [0.0, 0.14, -0.13], 0.01, '#6b4a2a', 6);
  rod(M, [0.0, 0.14, -0.13], [0.0, 0.24, -0.13], 0.011, '#7a5634', 6);
  sweep(M, [{ p: [-0.022, 0.085, 0.185], w: 0.016, h: 0.008 }, { p: [-0.022, 0.07, 0.21], w: 0.014 }, { p: [-0.022, 0.04, 0.225], w: 0.012 }, { p: [-0.022, 0.03, 0.23], w: 0.012 }], MILK, { radial: 8, sub: 4 });
  const Bs = grp(M, -0.022, 0, 0.28);
  vessel(Bs, [[0.05, 0], [0.075, 0.03], [0.085, 0.05]], 0.006, '#8a8478', (px, py, pz) => (Math.sin(py * 500 + ang(px, pz) * 3) > 0.85 ? '#7a7468' : null), 0, 0, 0, 24, 0.85);
  fill(Bs, MILK, 0, 0.038, 0, 0.074, 24, 0.15);
  // the miller in a Han 帻 headcloth, short 襦 and trousers, kneeling to turn the peg
  seiza(gp, mx - 0.01, mz - 0.13, { h: 0.33, ry: 0.05, top: '#7a6a54', bottom: '#4e4436', dress: 'knee', sleeve: 0.6, hat: '#2a2622', hatStyle: 'turban', skin: '#c8916a', hair: '#1c140e', lean: 0.3,
    hands: [[-0.02, 0.33, 0.22], [0.03, 0.34, 0.22]] });
  // draining board: fresh tofu block, press frame lifted off, cloth
  const D = grp(gp, 0.22, Y, -0.1, -0.35, 0.55);
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
  const P2 = grp(gp, 0.18, Y, -0.3, 0.4, 0.55);
  rbox(P2, '#8a6a44', 0, 0, 0, 0.16, 0.04, 0.14, 0.005);
  for (const [fx, fz, w, d] of [[0, -0.055, 0.14, 0.012], [0, 0.055, 0.14, 0.012], [-0.065, 0, 0.012, 0.1], [0.065, 0, 0.012, 0.1]] as const) box(P2, '#a07a4c', fx, 0.04, fz, w, 0.06, d);
  rbox(P2, '#b08a5a', 0, 0.1, 0, 0.13, 0.014, 0.1, 0.003);
  el(P2, '#7d786e', 0, 0.14, 0, 0.055, 0.035, 0.045, 0.4);
  // tray of cut cubes and a knife
  const T = grp(gp, 0.24, Y, 0.18, 0.3, 0.6);
  vessel(T, [[0.12, 0], [0.13, 0.025]], 0.006, '#c8a468', (px, py, pz) => (Math.sin(ang(px, pz) * 40) > 0.6 ? '#a8844c' : null), 0, 0, 0, 32);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i === 2 && j === 0)) rbox(T, i === 1 && j === 1 ? '#f3eedc' : TOFU, -0.05 + i * 0.05, 0.007, -0.05 + j * 0.05, 0.044, 0.04, 0.044, 0.005, (i + j) * 0.04);
  box(T, '#5e5a50', 0.06, 0.007, -0.055, 0.06, 0.002, 0.024, 0.3);
  rod(T, [0.0, 0.009, -0.07], [-0.04, 0.009, -0.085], 0.006, '#5a3a22', 6);
  // a hemp sack of dry soybeans and a basket of soaked beans
  sack(gp, -0.3, 0.12, 0.55, 0.2, SOY, '#a8946e');
  const Sb = grp(gp, -0.17, Y, 0.27, 0, 0.6);
  vessel(Sb, [[0.05, 0], [0.07, 0.02], [0.075, 0.04]], 0.005, '#9a7a4a', (px, py, pz) => ((Math.floor(ang(px, pz) * 8) + Math.floor(py * 120)) % 2 ? '#7e6038' : null), 0, 0, 0, 24);
  heap(Sb, 0, 0.034, 0, 0.068, 0.02, '#c8b47a');
  for (let i = 0; i < 6; i++) el(gp, SOY, -0.27 + (i % 3) * 0.014 + hash3(i, 1, 1) * 0.01, Y + 0.003, 0.2 + Math.floor(i / 3) * 0.014, 0.004, 0.003, 0.004);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DUMPLINGS (饺子 / 娇耳), Eastern Han — Zhang Zhongjing's "ear-warming soup": a Han clay range with a 釜 of mutton
// broth and dumplings boiling, a woman in a 曲裾 kneeling at a low table folding them, Zhang in a 进贤冠 holding out a
// bowl, grey pottery bowls set out for the frost-bitten poor.
// ---------------------------------------------------------------------------------------------------------
const lf_jiaozi: Builder = gp => {
  // ref: Han 陶灶 tomb models and the 庖厨图 kitchen reliefs (诸城前凉台, 打虎亭); Zhang Zhongjing's 祛寒娇耳汤 legend
  base(gp, earth(SITE.earth, 20));
  const GREY = '#8a8478';
  // clay range: big 釜 of mutton broth with 娇耳 dumplings bobbing, a small pot of herbs simmering behind
  const Z = hanZao(gp, -0.17, -0.1, 0.25, 0.3, 0.14, 0.09);
  const sy = fu(Z.G, 0, Z.top, Z.zBig, 0.055, '#4a4038', '#c8b48a');
  for (let i = 0; i < 6; i++) { const a = i * 1.05; jiaozi(Z.G, Math.cos(a) * 0.028, sy - 0.004, Z.zBig + Math.sin(a) * 0.028, 0.012, a); }
  steam(Z.G, 0, sy + 0.01, Z.zBig, 0.018, 5, '#f0eee8', 0.26);
  const hy = fu(Z.G, 0, Z.top, Z.zSmall, 0.04, '#5a5046', '#6a5a3a');
  for (let i = 0; i < 5; i++) dot(Z.G, i % 2 ? '#4a5a2a' : '#7a3a20', Math.cos(i * 1.3) * 0.02, hy + 0.001, Z.zSmall + Math.sin(i * 1.3) * 0.02, 0.004, 5);
  // low table (案) with the kneading board: dough log, rolled wrappers, a grey pottery bowl of chopped mutton & herbs
  const ty = table(gp, 0.12, Y, 0.12, 0.24, 0.12, 0.05, '#4a3020', -0.2, '#3a2416');
  const B = grp(gp, 0.12, ty, 0.12, -0.2);
  rbox(B, '#b89a6e', -0.02, 0, 0, 0.14, 0.006, 0.09, 0.002);
  sweep(B, [{ p: [-0.07, 0.012, -0.03], w: 0.007 }, { p: [-0.03, 0.012, -0.032], w: 0.008 }, { p: [0.0, 0.012, -0.028], w: 0.007 }], '#ece4d2', { radial: 10, sub: 3 });
  for (let i = 0; i < 4; i++) cyl(B, '#efe8d8', -0.04 + (i % 2) * 0.004, 0.007 + i * 0.0012, 0.01, 0.014, 0.0012, 14);
  rod(B, [-0.08, 0.011, 0.025], [-0.01, 0.011, 0.04], 0.004, '#b8986a', 6);
  for (let i = 0; i < 4; i++) jiaozi(B, -0.065 + i * 0.016, 0.006, 0.0, 0.009, 0);
  vessel(B, [[0.012, 0], [0.024, 0.012], [0.028, 0.02]], 0.0025, GREY, null, 0.075, 0, 0.0, 18, 0.85);
  heap(B, 0.075, 0.012, 0.0, 0.024, 0.008, '#8a5a44', (px, py, pz) => (hash3(Math.floor(px * 500), Math.floor(py * 500), Math.floor(pz * 500)) > 0.72 ? '#4a6a2a' : null));
  // woman in a Han 曲裾 kneeling at the table, folding a dumpling
  const wm = seiza(gp, 0.1, -0.0, { h: 0.32, ry: -0.2, top: '#6e4034', bottom: '#4a2c24', dress: 'ankle', hair: '#1c1410', hat: '#1c1410', hatStyle: 'knot', skin: '#d8a882', lean: 0.18,
    hands: [[-0.03, 0.33, 0.24], [0.04, 0.33, 0.24]] });
  jiaozi(gp, (wm.handL[0] + wm.handR[0]) / 2, (wm.handL[1] + wm.handR[1]) / 2, (wm.handL[2] + wm.handR[2]) / 2 + 0.006, 0.01, -0.2);
  // Zhang Zhongjing in a 进贤冠 and dark robe, holding out a bowl of the soup
  const zz = fig(gp, { h: 0.35, x: 0.27, y: Y, z: -0.12, ry: -0.7, outfit: 'robe', wideSleeves: true, top: '#3a3430', bottom: '#2a2420', accent: '#6a5a48', hat: 'jinxian', hatColor: '#1a1612', beard: 'long',
    armR: { fwd: 0.9, side: 0.1, bend: 0.9, inward: 0.3 }, armL: { fwd: 0.85, side: 0.12, bend: 0.95, inward: 0.35 } });
  const bx = (zz.handL[0] + zz.handR[0]) / 2, by = (zz.handL[1] + zz.handR[1]) / 2, bz = (zz.handL[2] + zz.handR[2]) / 2;
  vessel(gp, [[0.01, 0], [0.018, 0.01], [0.021, 0.016]], 0.002, GREY, null, bx, by - 0.006, bz, 16, 0.85);
  fill(gp, '#c8b48a', bx, by + 0.008, bz, 0.018, 14);
  // grey pottery bowls of soup set out on the floor for the queue
  for (const [x, z] of [[-0.02, 0.3], [0.08, 0.32], [-0.13, 0.26]] as const) {
    vessel(gp, [[0.01, 0], [0.018, 0.01], [0.021, 0.016]], 0.002, GREY, null, x, Y, z, 16, 0.85);
    fill(gp, '#c8b48a', x, Y + 0.013, z, 0.018, 14);
    jiaozi(gp, x, Y + 0.009, z, 0.008, x * 10);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// STEAMED BUNS (馒头), Three Kingdoms — the legend has Zhuge Liang replace human offerings to the Lu river with
// "barbarian heads" (蛮头) of dough stuffed with meat. A camp kitchen after the Han–Jin 庖厨 reliefs: a clay range with
// a grey pottery steamer (甑) set on its 釜, the cook in a hemp short robe and dark 帻 headcloth lifting the wooden lid
// on big plain buns; a basket of finished buns, a kneading board and a grain jar.
// ---------------------------------------------------------------------------------------------------------
const DOME = () => g('lf-dome', () => new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2));
function mantou(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  add(p, DOME(), mat('#ece4d2', { flat: false, rough: 0.8 }), x, y, z, r, r * 0.78, r);
}
const lf_mantou: Builder = gp => {
  // ref: 《事物纪原》 on 蛮头; Han–Jin pottery 甑 on 釜 over a 灶 (嘉峪关魏晋墓 kitchen bricks)
  base(gp, earth(SITE.earth, 20));
  const GREY = '#86807a';
  const Z = hanZao(gp, -0.12, -0.12, 0.35, 0.32, 0.15, 0.09);
  fu(Z.G, 0, Z.top, Z.zBig, 0.06, '#4a4038', '#c8c0aa');
  // pottery 甑: a deep basin with a perforated floor seated on the cauldron
  const zy = Z.top + 0.03;
  vessel(Z.G, dense([[0.04, 0], [0.06, 0.03], [0.07, 0.06], [0.074, 0.064]], 0.008), 0.004, GREY, (_x, py) => (Math.abs(py - 0.05) < 0.003 ? shade(GREY, 0.85) : null), 0, zy, Z.zBig, 28, 0.85);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mantou(Z.G, Math.cos(a) * 0.04, zy + 0.03 + 0.012, Z.zBig + Math.sin(a) * 0.04, 0.022); }
  mantou(Z.G, 0, zy + 0.03 + 0.016, Z.zBig, 0.022);
  steam(Z.G, -0.01, zy + 0.07, Z.zBig, 0.022, 6, '#f0eee8', 0.28);
  fu(Z.G, 0, Z.top, Z.zSmall, 0.04, '#5a5046', '#b8a888');
  // cook lifting the wooden lid
  const ck = who(gp, 0.12, Y, -0.16, { h: 0.35, ry: -1.0, pose: 'stand', top: '#9a8c70', bottom: '#5a4c3a', dress: 'knee', sleeve: 0.85, hair: '#1c140e', hat: '#2a2622', hatStyle: 'turban', skin: '#c8916a',
    hands: [[-0.05, 0.62, 0.26], [0.1, 0.55, 0.2]] });
  const [lx, ly, lz] = ck.handL;
  const lid = grp(gp, lx - 0.04, ly - 0.01, lz + 0.01);
  plathe(lid, [[0, 0.016], [0.06, 0.008], [0.074, 0], [0.07, -0.004], [0, 0.008]], '#7a5a3a', null, 0, 0, 0, 24, 0.7);
  box(lid, '#5a3e26', 0, 0.018, 0, 0.05, 0.008, 0.01);
  lid.rotation.set(0.7, 0.9, -0.3);
  // basket of finished buns on the floor, a kneading board with dough
  const K = grp(gp, 0.14, Y, 0.18);
  vessel(K, dense([[0.07, 0], [0.09, 0.02], [0.095, 0.03]], 0.01), 0.004, '#a88a58', (px, py, pz) => (Math.sin(ang(px, pz) * 40 + py * 300) > 0.4 ? '#8a6e44' : null), 0, 0, 0, 32, 0.9);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; mantou(K, Math.cos(a) * 0.05, 0.018, Math.sin(a) * 0.05, 0.024); }
  mantou(K, 0, 0.02, 0, 0.025);
  const D = grp(gp, -0.22, Y, 0.17, 0.4);
  rbox(D, '#a8875e', 0, 0, 0, 0.16, 0.012, 0.1, 0.003);
  add(D, DOME(), mat('#e4dcc8', { flat: false }), -0.02, 0.012, 0, 0.04, 0.026, 0.034);
  for (let i = 0; i < 3; i++) mantou(D, 0.05, 0.012, -0.03 + i * 0.03, 0.014);
  // grain jar with a cloth-tied mouth
  const J = grp(gp, 0.33, Y, -0.08);
  plathe(J, dense([[0, 0], [0.03, 0], [0.05, 0.04], [0.05, 0.07], [0.028, 0.1], [0.026, 0.11], [0, 0.11]], 0.01), GREY, null, 0, 0, 0, 20, 0.85);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SOUP CAKES (汤饼), Western Jin — Shu Xi's 《饼赋》 praises 汤饼 in winter: dough kneaded, then pulled and torn into thin
// pieces straight into the boiling pot (the ancestor of 面片 / 馎饦, not long noodles). The cook in a short robe tears
// pieces over a 釜 on a clay range; on a low table, Yue celadon bowls of the pieces in broth and a chicken-head ewer.
// ---------------------------------------------------------------------------------------------------------
const CELADON = '#9ab79a';
const lf_noodles: Builder = gp => {
  // ref: 束皙《饼赋》; 贾思勰《齐民要术》 水引/馎饦 recipes; Western Jin Yue-ware 青瓷 bowls and 鸡首壶
  base(gp, earth(SITE.earth, 20));
  const piece = (p: THREE.Object3D, x: number, y: number, z: number, s: number, k: number) => el(p, '#e6d8b0', x, y, z, s, s * 0.14, s * 0.7, k * 1.3, Math.sin(k) * 0.4, Math.cos(k * 1.7) * 0.4);
  const Z = hanZao(gp, -0.16, -0.12, 0.3, 0.3, 0.14, 0.09);
  const sy = fu(Z.G, 0, Z.top, Z.zBig, 0.06, '#3e3832', '#d4c8a8');
  for (let i = 0; i < 9; i++) piece(Z.G, Math.cos(i * 2.3) * 0.03, sy + 0.001, Z.zBig + Math.sin(i * 2.3) * 0.03, 0.012, i);
  steam(Z.G, 0, sy + 0.01, Z.zBig, 0.02, 6, '#f0eee8', 0.28);
  fu(Z.G, 0, Z.top, Z.zSmall, 0.04, '#5a5046', '#8a7a5a');
  // cook tearing dough over the pot: lump in the left hand, a piece pinched in the right, pieces dropping
  const ck = who(gp, 0.05, Y, -0.2, { h: 0.35, ry: -1.25, pose: 'stand', lean: 0.12, top: '#8c8270', bottom: '#4a4034', dress: 'knee', sleeve: 0.85, hair: '#1c140e', hat: '#2a2622', hatStyle: 'turban', skin: '#c8916a',
    hands: [[-0.06, 0.6, 0.24], [0.06, 0.62, 0.3]] });
  el(gp, '#e6d8b0', ck.handL[0], ck.handL[1] + 0.006, ck.handL[2], 0.02, 0.015, 0.017);
  const [rx, ry2, rz] = ck.handR;
  piece(gp, rx, ry2 - 0.004, rz, 0.01, 1);
  const pot: V3 = [Z.G.position.x + Math.sin(0.3) * Z.zBig, Y + sy, Z.G.position.z + Math.cos(0.3) * Z.zBig];
  for (let k = 1; k < 4; k++) { const t = k / 4; piece(gp, rx + (pot[0] - rx) * t, ry2 + (pot[1] - ry2) * t + 0.02 * Math.sin(t * Math.PI), rz + (pot[2] - rz) * t, 0.009, k + 3); }
  // low lacquer table: two Yue celadon bowls of 汤饼 and a chicken-head ewer
  const ty = table(gp, 0.1, Y, 0.16, 0.24, 0.11, 0.05, '#3a2418', -0.15, '#2a1a12');
  const T = grp(gp, 0.1, ty, 0.16, -0.15);
  for (const [x, z] of [[-0.06, 0.0], [0.02, 0.012]] as const) {
    vessel(T, dense([[0.012, 0], [0.014, 0.004], [0.026, 0.014], [0.032, 0.026], [0.033, 0.028]], 0.004), 0.002, CELADON, (_px, py) => (py < 0.004 ? '#a8987a' : null), x, 0, z, 28, 0.2);
    fill(T, '#cdb684', x, 0.023, z, 0.029, 20, 0.15);
    for (let i = 0; i < 5; i++) piece(T, x + Math.cos(i * 1.3) * 0.012, 0.024, z + Math.sin(i * 1.3) * 0.012, 0.009, i);
    dot(T, '#5a6a3a', x + 0.008, 0.025, z - 0.01, 0.003, 4);
  }
  for (const dz of [-0.003, 0.003]) rod(T, [-0.03, 0.002, 0.03 + dz], [0.04, 0.002, 0.04 + dz], 0.003, '#2a1a12', 4);
  const E = grp(T, 0.08, 0, -0.01);
  plathe(E, dense([[0, 0], [0.012, 0], [0.02, 0.012], [0.024, 0.03], [0.018, 0.042], [0.009, 0.046], [0.009, 0.056], [0.012, 0.058]], 0.004), CELADON, null, 0, 0, 0, 20, 0.2);
  sweep(E, [{ p: [0, 0.036, 0.016], w: 0.004 }, { p: [0, 0.046, 0.024], w: 0.004 }, { p: [0, 0.05, 0.028], w: 0.005 }], CELADON, { radial: 6, sub: 2 });
  sweep(E, [{ p: [0, 0.04, -0.017], w: 0.003 }, { p: [0, 0.062, -0.018], w: 0.003 }, { p: [0, 0.056, -0.01], w: 0.003 }], CELADON, { radial: 5, sub: 2 });
  // dough board on the floor: a kneaded lump under a cloth, flour
  const D = grp(gp, -0.24, Y, 0.2, 0.4);
  rbox(D, '#a8875e', 0, 0, 0, 0.15, 0.012, 0.1, 0.003);
  add(D, DOME(), mat('#e6d8b0', { flat: false }), -0.02, 0.012, 0, 0.04, 0.026, 0.034);
  rbox(D, '#b8ac90', 0.045, 0.012, 0.0, 0.05, 0.003, 0.06, 0.002, 0.3);
  heap(D, 0.04, 0.012, -0.035, 0.022, 0.004, '#ece6d8');
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// TANG HU-BING BAKERY (胡饼) — Chang'an's Western Market: a clay tannur oven (as still used for naan) with sesame
// flatbreads slapped on its hot inner wall, a stack of sesame breads on a cloth, dough balls on a board, and a Sogdian
// baker in a felt cap with upturned brim, lapelled kaftan and boots, reaching in with a bread cushion.
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
  // ref: 白居易《寄胡饼与杨万州》; Tang tomb figurines of Sogdian merchants (胡帽, 翻领袍); Xinjiang 馕坑 tannur ovens
  base(gp, tiles(SITE.court, 0.1));
  // tannur: thick clay drum, glowing interior, breads on the inner wall
  const ox = -0.08, oz = -0.04, O = grp(gp, ox, Y, oz, 0, 0.65);
  const oo: [number, number][] = [[0.17, 0], [0.185, 0.06], [0.18, 0.14], [0.16, 0.2], [0.14, 0.235], [0.128, 0.24]];
  plathe(O, [[0, 0], ...dense(oo, 0.015), [0.11, 0.24]], '#b07a4e', (px, py, pz) => {
    if (py > 0.235) return '#5a3420';
    return shade('#b07a4e', 0.86 + fbm(px * 30, py * 30, pz * 30, 2) * 0.28);
  }, 0, 0, 0, 36);
  const inner = new THREE.LatheGeometry([[0.03, 0.06], [0.11, 0.07], [0.13, 0.14], [0.112, 0.238]].map(([a, b]) => new THREE.Vector2(a, b)), 28, 0, TAU);
  inner.scale(-1, 1, 1);
  glow(add(O, inner, mat('#8a4a26'), 0, 0, 0, 1, 1, 1), '#8a4a26', '#5a2008');
  glow(add(O, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#7a3412'), 0, 0.064, 0, 0.06, 0.008, 0.06), '#7a3412', '#5a1c00');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3, rr = 0.118, yy = 0.19 - (i % 2) * 0.045;
    const w = grp(O, Math.cos(a) * rr, yy, Math.sin(a) * rr);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(a), 0.35, -Math.sin(a)).normalize());
    bing(w, 0, 0, 0, 0.04);
  }
  // fire port at the front
  box(O, '#3a1e12', -0.03, 0.0, 0.17, 0.06, 0.05, 0.03);
  glow(box(O, '#7a3412', -0.03, 0.004, 0.182, 0.046, 0.036, 0.006), '#7a3412', '#5a1c00');
  const fl = grp(O, -0.03, 0.006, 0.19);
  fl.name = 'flicker';
  for (const [dx, r, hh] of [[0, 0.014, 0.04], [-0.012, 0.009, 0.028], [0.012, 0.009, 0.028]] as const) add(fl, g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7)), mat('#c87a3a', { emissive: '#8a3a08' }), dx, hh / 2, 0, r, hh, r);
  steam(O, 0.0, 0.245, 0.0, 0.026, 5, '#d8d0c4', 0.22);
  // stack of sesame breads on a cloth
  slab(grp(gp, 0.18, Y + 0.002, 0.2, 0.3), [[-0.06, -0.05], [0.06, -0.055], [0.055, 0.05], [-0.06, 0.05]], 0.002, '#cfc2a2', 0, false).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 6; i++) bing(gp, 0.18 + Math.sin(i * 2.1) * 0.003, Y + 0.003 + i * 0.0065, 0.2 + Math.cos(i * 1.7) * 0.003, 0.028, i);
  bing(gp, 0.12, Y + 0.016, 0.24, 0.026, 0.4, -1.1, 0);
  // board of dough balls
  const T = grp(gp, -0.2, Y, 0.22, 0.3);
  rbox(T, '#8a6a46', 0, 0, 0, 0.09, 0.008, 0.06, 0.002);
  for (let i = 0; i < 6; i++) add(T, DOME(), mat('#e2d4b4', { flat: false }), -0.028 + (i % 3) * 0.028, 0.008, -0.014 + Math.floor(i / 3) * 0.028, 0.011, 0.009, 0.011);
  // Sogdian baker: felt cap with upturned brim, lapelled kaftan, boots, beard
  const bk = who(gp, 0.12, Y, -0.14, { h: 0.33, ry: -1.9, pose: 'stand', lean: 0.35, top: '#6e4a36', bottom: '#4a3a2a', dress: 'knee', shoes: '#2a1c14', skin: '#c8966e', hair: '#3a2416',
    hands: [[-0.06, 0.52, 0.3], [0.08, 0.56, 0.34]] });
  const [hx, hy, hz] = bk.head;
  cone(gp, '#b8a888', hx, hy + 0.012, hz, 0.016, 0.034, 10);
  add(gp, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#8a7a5e'), hx, hy + 0.014, hz, 0.017, 0.017, 0.03, Math.PI / 2, 0, 0);
  el(gp, '#3a2416', hx - 0.014, hy - 0.016, hz + 0.004, 0.01, 0.013, 0.009);
  const [px2, py2, pz2] = bk.handR;
  el(gp, '#a89a7a', px2, py2, pz2, 0.018, 0.007, 0.018, 0, 0, 1.0);
  bing(gp, px2 + 0.004, py2 + 0.004, pz2, 0.02, 0, 0, 1.0);
  // sacks of flour and sesame, a water jar
  sack(gp, -0.3, -0.18, 0.6, 0.4, '#d8d0c0', '#c4b89e');
  sack(gp, -0.2, -0.27, 0.5, 1.2, '#d4c8ac', '#a89068');
  const Wj = grp(gp, 0.3, Y, -0.04, 0, 0.6);
  vessel(Wj, dense([[0.04, 0], [0.065, 0.05], [0.06, 0.1], [0.035, 0.13], [0.04, 0.14]], 0.012), 0.005, '#7a5a3e', (px, py, pz) => (Math.abs(py - 0.09) < 0.004 ? '#4e3626' : null), 0, 0, 0, 22, 0.4);
  fill(Wj, '#3a4a4e', 0, 0.12, 0, 0.034, 16, 0.05);
  fuse(gp);
};

/** Re-material a vertex-coloured mesh (sweep, plathe) as glossy / glazed. */
const shine = (m: THREE.Mesh, rough = 0.22, metal = 0.05) => { m.material = mat('#ffffff', { vc: true, flat: false, rough, metal }); return m; };
/** A person kneeling back on the heels (正坐), unit-space hand targets. */
const seiza = (p: THREE.Object3D, x: number, z: number, o: Partial<HumanOpts> & { h: number; top: string }): HumanRig =>
  who(p, x, Y, z, { pose: 'kneel', hipY: 0.2, feet: [[-0.07, 0.032, -0.06], [0.07, 0.032, -0.06]], ...o });

// ---------------------------------------------------------------------------------------------------------
// TEA CULTURE — 'tang' (default): Lu Yu's boiled tea (煎茶) on a reed mat, after the 《茶经》 utensil list and the
// tea-boiling corner of 《萧翼赚兰亭图》: a small three-legged bronze 风炉 with a draught window, the square-eared iron
// 鍑 frothing, Lu Yu kneeling with bamboo tongs, a boy bringing a Yue celadon bowl on its stand, the 具列 stand, a water
// jar with gourd ladle, the wooden 碾 and a pressed tea cake. 'song': whisked tea (点茶) after Liu Songnian's 《撵茶图》:
// a servant turning a stone tea mill, another pouring from a tall 汤瓶 into Jian hare's-fur bowls on lacquer stands at
// a high table, a bamboo whisk (茶筅) and the ewer re-heating on a floor brazier.
// ---------------------------------------------------------------------------------------------------------
const JIAN = '#1e1612';
const hareFur: Paint = (x, y, z) => (y > 0.004 && Math.sin(ang(x, z) * 70 + y * 30) > 0.55 ? '#6a3a1c' : null);
function jianBowl(p: THREE.Object3D, x: number, y: number, z: number, s: number, froth = true, stand = true): void {
  const b = grp(p, x, y, z, 0, s);
  if (stand) {
    plathe(b, [[0, 0], [0.04, 0], [0.034, 0.02], [0.03, 0.03], [0.06, 0.032], [0.062, 0.04], [0, 0.04]], '#5e2418', null, 0, 0, 0, 24, 0.3);
  }
  const by = stand ? 0.04 : 0;
  vessel(b, dense([[0.022, by], [0.024, by + 0.008], [0.05, by + 0.03], [0.068, by + 0.052], [0.07, by + 0.056]], 0.006), 0.004, JIAN, (px, py, pz) => (py < by + 0.008 ? '#8a6a4a' : hareFur(px, py - by, pz, 0, 0, 0)), 0, 0, 0, 30, 0.12);
  if (froth) heap(b, 0, by + 0.046, 0, 0.062, 0.008, '#e8e4d6', (px, py, pz) => (hash3(Math.floor(px * 500), Math.floor(py * 500), Math.floor(pz * 500)) > 0.8 ? '#d8d0bc' : null), 24);
}
function whisk(p: THREE.Object3D, x: number, y: number, z: number, s: number, rx = 0, rz = 0): void {
  const w = grp(p, x, y, z, 0, s);
  w.rotation.set(rx, 0, rz);
  cyl(w, '#c8a868', 0, 0.035, 0, 0.007, 0.05, 8);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; rod(w, [Math.cos(a) * 0.005, 0.035, Math.sin(a) * 0.005], [Math.cos(a) * 0.016, 0.0, Math.sin(a) * 0.016], 0.003, '#e0c890', 3); }
}
function ewer(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, c = '#d8dcd0'): void {
  const e = grp(p, x, y, z, ry, s);
  plathe(e, dense([[0, 0], [0.03, 0], [0.042, 0.04], [0.04, 0.07], [0.02, 0.1], [0.012, 0.13], [0.016, 0.135], [0, 0.135]], 0.01), c, null, 0, 0, 0, 22, 0.25);
  sweep(e, [{ p: [0.035, 0.05, 0], w: 0.009 }, { p: [0.06, 0.08, 0], w: 0.006 }, { p: [0.07, 0.11, 0], w: 0.004 }], c, { radial: 7, sub: 4 });
  sweep(e, [{ p: [-0.014, 0.12, 0], w: 0.004 }, { p: [-0.05, 0.11, 0], w: 0.004 }, { p: [-0.045, 0.06, 0], w: 0.004 }, { p: [-0.035, 0.045, 0], w: 0.004 }], c, { radial: 5, sub: 4 });
}
function yueBowl(p: THREE.Object3D, x: number, y: number, z: number, R: number, stand = false): void {
  const b = grp(p, x, y, z, 0, R / 0.05);
  const by = stand ? 0.012 : 0;
  if (stand) plathe(b, [[0, 0], [0.026, 0], [0.024, 0.006], [0.044, 0.008], [0.046, 0.012], [0, 0.012]], CELADON, null, 0, 0, 0, 20, 0.2);
  vessel(b, dense([[0.02, by], [0.025, by + 0.005], [0.045, by + 0.025], [0.05, by + 0.034]], 0.006), 0.003, CELADON, null, 0, 0, 0, 22, 0.15);
  fill(b, '#8e8650', 0, by + 0.028, 0, 0.044, 18, 0.1);
  heap(b, 0, by + 0.028, 0, 0.026, 0.003, '#ddd6c0', undefined, 14);
}
const lf_tea: Builder = (gp, r) => {
  if (r.style === 'song') {
    // ref: 刘松年《撵茶图》; 蔡襄《茶录》, 赵佶《大观茶论》 (建盏, 汤瓶, 茶筅); 审安老人《茶具图赞》 (石转运 tea mill)
    base(gp, tiles(SITE.paving, 0.1, false));
    const tz = -0.12, ty = table(gp, -0.02, Y, tz, 0.28, 0.12, 0.15, '#3e281a', 0, '#3e281a');
    jianBowl(gp, -0.1, ty, tz + 0.01, 0.25);
    jianBowl(gp, -0.05, ty, tz - 0.025, 0.25);
    jianBowl(gp, 0.03, ty, tz + 0.02, 0.25);
    whisk(gp, 0.08, ty, tz - 0.02, 0.45);
    const cad = grp(gp, 0.1, ty, tz + 0.025);
    plathe(cad, [[0, 0], [0.01, 0], [0.011, 0.016], [0.008, 0.02], [0.003, 0.022], [0, 0.023]], '#3a2018', null, 0, 0, 0, 14, 0.25);
    // standing servant pouring from the 汤瓶 into a bowl
    const sv = who(gp, 0.0, Y, -0.28, { h: 0.33, ry: 0.15, pose: 'stand', top: '#6e6a5a', bottom: '#4e4a3e', dress: 'ankle', hat: '#1a1612', hatStyle: 'turban', skin: '#d0a07a',
      hands: [[-0.1, 0.47, 0.12], [0.02, 0.58, 0.36]] });
    const [hx, hy, hz] = sv.handR;
    const eg = grp(gp, hx, hy - 0.035, hz, Math.PI);
    eg.rotation.z = -0.55;
    ewer(eg, 0, 0, 0, 0.3, 0, '#d4d6cc');
    // seated servant turning the stone tea mill
    const st = grp(gp, 0.26, Y, 0.12);
    rbox(st, '#4a3424', 0, 0.075, 0, 0.07, 0.01, 0.06, 0.003);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(st, '#3e2a1c', sx * 0.028, 0, sz * 0.022, 0.008, 0.075, 0.008);
    const gr = who(gp, 0.26, Y, 0.12, { h: 0.33, ry: -1.35, pose: 'sit', hipY: 0.26, top: '#7a7262', bottom: '#5a5446', dress: 'knee', hat: '#1a1612', hatStyle: 'turban', skin: '#c8966e', lean: 0.25,
      hands: [[-0.04, 0.36, 0.3], [0.06, 0.4, 0.33]] });
    const MX = 0.135, MZ = 0.15;
    rbox(gp, '#4a3424', MX, Y, MZ, 0.08, 0.075, 0.08, 0.004);
    plathe(gp, [[0, 0], [0.04, 0], [0.04, 0.006], [0.034, 0.008], [0, 0.008]], '#8a8478', null, MX, Y + 0.075, MZ, 20, 0.8);
    cyl(gp, '#8e887c', MX, Y + 0.083, MZ, 0.028, 0.014, 18);
    cyl(gp, '#848074', MX, Y + 0.098, MZ, 0.028, 0.016, 18);
    const [gx, gy, gz] = gr.handR;
    rod(gp, [MX + 0.02, Y + 0.106, MZ + 0.012], [gx, gy, gz], 0.003, '#5a4028', 5);
    rod(gp, [MX + 0.02, Y + 0.104, MZ + 0.012], [MX + 0.02, Y + 0.12, MZ + 0.012], 0.003, '#5a4028', 5);
    heap(gp, MX - 0.03, Y + 0.077, MZ + 0.02, 0.012, 0.004, '#a8ae8a');
    // tea powder in a white bowl and a whisk set aside on the floor mat
    const pw = grp(gp, -0.08, Y, 0.14);
    vessel(pw, [[0.012, 0], [0.02, 0.01], [0.023, 0.015]], 0.002, '#e2ddcf', null, 0, 0, 0, 18, 0.25);
    heap(pw, 0, 0.011, 0, 0.019, 0.006, '#a8ae8a');
    // ewer re-heating on a small floor brazier
    const bx = -0.25, bz = 0.08;
    plathe(gp, [[0, 0], [0.034, 0], [0.038, 0.04], [0.03, 0.046], [0, 0.046]], '#4e4a42', null, bx, Y, bz, 20, 0.6, 0.2);
    glow(cyl(gp, '#7a3412', bx, Y + 0.044, bz, 0.026, 0.004, 12), '#7a3412', '#5a1c00');
    ewer(gp, bx, Y + 0.047, bz, 0.3, -2.2, '#d4d6cc');
    steam(gp, bx + 0.01, Y + 0.09, bz, 0.01, 4, '#f5f5f2', 0.22);
    rod(gp, [bx + 0.05, Y + 0.002, bz + 0.03], [bx + 0.11, Y + 0.002, bz + 0.06], 0.003, '#3a3634', 4);
  } else {
    // ref: 陆羽《茶经》四之器 (风炉, 鍑, 竹筴, 碾, 具列); 阎立本《萧翼赚兰亭图》 tea-boiling servants; 法门寺 Tang tea set; 越窑 bowls
    base(gp, matting('#b49a66', 0.02));
    const B = grp(gp, 0.03, Y, 0.04);
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + Math.PI / 2; sweep(B, [{ p: [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03], w: 0.007 }, { p: [Math.cos(a) * 0.029, 0.022, Math.sin(a) * 0.029], w: 0.008 }], BRZ, { radial: 6, sub: 2 }); }
    vessel(B, dense([[0.028, 0.018], [0.034, 0.028], [0.036, 0.07], [0.04, 0.075]], 0.006), 0.004, BRZ, (px, py, pz) => (Math.abs(py - 0.064) < 0.003 && Math.sin(ang(px, pz) * 24) > 0 ? BRZD : null), 0, 0, 0, 24, 0.45, 0.45);
    box(B, '#2a1a12', 0, 0.03, 0.033, 0.018, 0.018, 0.008);
    glow(box(B, '#7a3412', 0, 0.032, 0.037, 0.014, 0.013, 0.002), '#7a3412', '#5a1c00');
    glow(add(B, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#7a3412'), 0, 0.068, 0, 0.03, 0.005, 0.03), '#7a3412', '#5a1c00');
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; box(B, BRZD, Math.cos(a) * 0.035, 0.075, Math.sin(a) * 0.035, 0.008, 0.008, 0.008); }
    const K = grp(B, 0, 0.083, 0);
    vessel(K, dense([[0.018, 0], [0.04, 0.008], [0.048, 0.022], [0.046, 0.032], [0.05, 0.035]], 0.006), 0.003, '#3a3634', null, 0, 0, 0, 28, 0.6, 0.3);
    for (const sx of [-1, 1]) { box(K, '#3a3634', sx * 0.048, 0.032, -0.008, 0.005, 0.014, 0.004); box(K, '#3a3634', sx * 0.048, 0.032, 0.008, 0.005, 0.014, 0.004); box(K, '#3a3634', sx * 0.048, 0.045, 0, 0.005, 0.004, 0.02); }
    fill(K, '#7e7648', 0, 0.029, 0, 0.044, 24, 0.1);
    heap(K, 0, 0.028, 0, 0.026, 0.004, '#ddd6bc', (px, py, pz) => (hash3(Math.floor(px * 800), Math.floor(py * 800), Math.floor(pz * 800)) > 0.75 ? '#c8c0a0' : null));
    steam(K, 0.005, 0.035, 0, 0.012, 5, '#f5f5f2', 0.24);
    // Lu Yu kneeling at the brazier, stirring the froth with bamboo tongs
    const L = seiza(gp, -0.12, -0.08, { h: 0.33, ry: 0.95, top: '#857a62', bottom: '#6a604c', dress: 'ankle', hat: '#1a1612', hatStyle: 'turban', skin: '#d0a07a', lean: 0.3,
      hands: [[-0.04, 0.34, 0.26], [0.06, 0.4, 0.32]] });
    const [hx, hy, hz] = L.handR;
    rod(gp, [hx, hy, hz], [0.025, Y + 0.115, 0.04], 0.003, '#b89a5e', 4);
    rod(gp, [hx + 0.003, hy, hz], [0.03, Y + 0.115, 0.043], 0.003, '#b89a5e', 4);
    // boy bringing a celadon bowl on its stand
    const by = who(gp, 0.22, Y, -0.04, { h: 0.27, ry: -1.6, pose: 'stand', lean: 0.15, top: '#7a6e58', bottom: '#5a5040', dress: 'knee', hat: '#1a1612', hatStyle: 'knot', skin: '#d0a07a',
      hands: [[-0.06, 0.5, 0.26], [0.06, 0.5, 0.26]] });
    const tx = (by.handL[0] + by.handR[0]) / 2, ty2 = (by.handL[1] + by.handR[1]) / 2 + 0.004, tz2 = (by.handL[2] + by.handR[2]) / 2;
    rbox(gp, '#3a2018', tx, ty2, tz2, 0.04, 0.004, 0.05, 0.0015);
    yueBowl(gp, tx, ty2 + 0.004, tz2, 0.018, true);
    // 具列 utensil stand: bowls, salt box, cooled-water bowl
    const J = grp(gp, -0.04, Y, -0.27, 0.15);
    rbox(J, '#3e2a1c', 0, 0.035, 0, 0.2, 0.008, 0.07, 0.002);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(J, '#3e2a1c', sx * 0.092, 0, sz * 0.028, 0.008, 0.035, 0.008);
    for (const cx of [-0.07, -0.035]) yueBowl(J, cx, 0.043, 0, 0.016, true);
    plathe(J, [[0, 0], [0.013, 0], [0.014, 0.018], [0.01, 0.02], [0, 0.021]], '#8a8070', null, 0.02, 0.043, 0, 14);
    vessel(J, [[0.012, 0], [0.018, 0.008], [0.019, 0.016]], 0.002, '#4a4038', null, 0.06, 0.043, 0, 16, 0.4);
    // water jar with a gourd ladle
    const W = grp(gp, 0.26, Y, -0.22);
    vessel(W, dense([[0.022, 0], [0.034, 0.02], [0.034, 0.045], [0.026, 0.058], [0.028, 0.062]], 0.008), 0.003, '#6e6a5e', null, 0, 0, 0, 20, 0.35);
    fill(W, '#4a5a5e', 0, 0.054, 0, 0.024, 14, 0.05);
    rod(W, [0.0, 0.055, 0], [0.03, 0.09, 0.01], 0.003, '#a88a54', 4);
    el(W, '#a88a54', 0.004, 0.057, 0, 0.012, 0.007, 0.01);
    // wooden roller (碾) with its wheel, and a pressed tea cake with a hole on paper
    const T = grp(gp, 0.22, Y, 0.17, -0.5, 0.7);
    sweep(T, [{ p: [-0.06, 0.012, 0], w: 0.012, h: 0.012 }, { p: [-0.03, 0.016, 0], w: 0.026, h: 0.026 }, { p: [0.03, 0.016, 0], w: 0.026, h: 0.026 }, { p: [0.06, 0.012, 0], w: 0.012, h: 0.012 }], '#4a3626', { radial: 8, sub: 3, squash: 1 });
    box(T, '#2a2018', 0, 0.027, 0, 0.09, 0.002, 0.008);
    const wh = cyl(T, '#5a4a3a', 0.015, 0.038, 0, 0.018, 0.005, 18);
    wh.rotation.x = Math.PI / 2; wh.position.set(0.015, 0.038, 0);
    rod(T, [0.015, 0.038, -0.035], [0.015, 0.038, 0.035], 0.003, '#6b4a2a', 5);
    heap(T, -0.03, 0.027, 0, 0.007, 0.002, '#6a7040');
    slab(grp(gp, 0.0, Y + 0.002, 0.24, 0.2), [[-0.04, -0.035], [0.04, -0.035], [0.04, 0.035], [-0.04, 0.035]], 0.0015, '#d8ccac', 0, false).rotation.x = -Math.PI / 2;
    plathe(gp, [[0.004, 0], [0.024, 0], [0.026, 0.004], [0.024, 0.007], [0.004, 0.007]], '#3e3220', (px, py, pz) => (py > 0.006 && hash3(Math.floor(px * 600), 1, Math.floor(pz * 600)) > 0.7 ? '#584a2e' : null), -0.005, Y + 0.0035, 0.24, 24);
    el(gp, '#3e3220', 0.03, Y + 0.007, 0.25, 0.01, 0.003, 0.008, 0.6);
    // tray of Yue bowls by Lu Yu
    rbox(gp, '#3a2018', -0.24, Y, 0.1, 0.1, 0.006, 0.07, 0.002, 0.3);
    for (const [cx, cz] of [[-0.26, 0.09], [-0.22, 0.11]] as const) yueBowl(gp, cx, Y + 0.006, cz, 0.016);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// DONGPO PORK (东坡肉), Northern Song — Su Shi's 《猪肉颂》: "慢着火，少着水，火候足时他自美". A sand-pot of braised
// pork-belly squares on a clay charcoal brazier; on a Song high table a Ding-ware dish with a served square, a qingbai
// ewer in its warming bowl (注子注碗) and cup; Su Shi in his tall 东坡巾 by West Lake, stone bridge and willows behind.
// ---------------------------------------------------------------------------------------------------------
function porkCube(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0): void {
  const P = grp(p, x, y, z, ry, s);
  const geo = g('lf-pork', () => paintFaces(new THREE.BoxGeometry(1, 1, 1, 3, 8, 3), '#ffffff', (_px, py, _pz, _nx, ny) => {
    if (ny > 0.7) return '#6a2e16';
    const t = py + 0.5;
    if (t > 0.86) return '#743418';
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
      k % 3 ? '#7e9a5a' : '#6e8a4c', { radial: 4, sub: 3 });
  }
}
const lf_dongpo: Builder = gp => {
  // ref: 苏轼《猪肉颂》; Song 注子注碗 (qingbai ewer & warming bowl) and high tables after 《清明上河图》 / 《韩熙载夜宴图》
  base(gp, tiles(SITE.paving, 0.075));
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
  // clay charcoal brazier and the sand pot (砂锅) of pork, about 40 cm across
  const sx = -0.08, sz = 0.1;
  plathe(gp, [[0, 0], [0.05, 0], [0.056, 0.05], [0.05, 0.06], [0, 0.06]], '#7a6450', (px, py, pz) => (py > 0.056 ? '#4a3424' : Math.sin(ang(px, pz) * 12) > 0.9 ? '#6a5440' : null), sx, Y, sz, 24, 0.85);
  box(gp, '#1e1410', sx, Y + 0.012, sz + 0.05, 0.03, 0.02, 0.012);
  glow(box(gp, '#7a3412', sx, Y + 0.014, sz + 0.056, 0.022, 0.014, 0.002), '#8a3a14', '#5a1c00');
  const P = grp(gp, sx, Y + 0.06, sz);
  vessel(P, dense([[0.026, 0], [0.05, 0.01], [0.064, 0.03], [0.066, 0.044], [0.07, 0.048]], 0.006), 0.004, '#4a3a32', (_px, py) => (py > 0.044 ? '#9a8a78' : null), 0, 0, 0, 30, 0.75);
  for (const s2 of [-1, 1]) add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#4a3a32'), s2 * 0.066, 0.04, 0, 0.01, 0.01, 0.01, Math.PI / 2);
  fill(P, '#4a1e10', 0, 0.036, 0, 0.062, 26, 0.12);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) porkCube(P, (i - 1) * 0.034, 0.022, (j - 1) * 0.034, 0.028, (i + j) * 0.08 - 0.1);
  // the lid set aside, leaning on the brazier
  const Ld = plathe(gp, [[0, 0.012], [0.05, 0.006], [0.068, 0], [0.064, -0.003], [0, 0.007]], '#4a3a32', null, sx - 0.085, Y + 0.035, sz + 0.03, 24, 0.75);
  Ld.rotation.set(0, 0, 1.2);
  steam(P, -0.01, 0.06, -0.01, 0.014, 5, '#f0eee8', 0.26);
  // Song high table: Ding-ware dish with a served square and greens, a qingbai ewer in its warming bowl, a cup
  const DING = '#e8e0cc', QB = '#d4e0d8';
  const ty = table(gp, 0.14, Y, 0.12, 0.2, 0.12, 0.16, '#5a3a24', -0.2, '#3e2818');
  const T = grp(gp, 0.14, ty, 0.12, -0.2);
  const py = plate(T, -0.04, 0, 0.0, 0.034, null, DING) - 0;
  for (let i = 0; i < 4; i++) el(T, '#4a6a34', -0.04 + Math.cos(i * 1.5) * 0.02, py + 0.002, Math.sin(i * 1.5) * 0.02, 0.01, 0.002, 0.005, -i * 1.5);
  porkCube(T, -0.04, py, 0.0, 0.026, 0.3);
  fill(T, '#4a1e10', -0.04, py + 0.001, 0, 0.022, 18, 0.1);
  for (const dz of [-0.003, 0.003]) rod(T, [-0.01, 0.002, 0.04 + dz], [0.06, 0.002, 0.045 + dz], 0.003, '#2a1a12', 4);
  const E = grp(T, 0.05, 0, -0.01);
  vessel(E, dense([[0.012, 0], [0.016, 0.004], [0.026, 0.016], [0.028, 0.028]], 0.004), 0.002, QB, null, 0, 0, 0, 24, 0.2);
  plathe(E, dense([[0, 0.008], [0.014, 0.012], [0.019, 0.026], [0.016, 0.04], [0.007, 0.046], [0.006, 0.056], [0.008, 0.058]], 0.004), QB, null, 0, 0, 0, 20, 0.2);
  sweep(E, [{ p: [0.016, 0.03, 0], w: 0.003 }, { p: [0.03, 0.046, 0], w: 0.0025 }], QB, { radial: 5, sub: 2 });
  vessel(T, [[0.006, 0], [0.011, 0.008], [0.012, 0.01]], 0.0012, QB, null, 0.02, 0, 0.035, 14, 0.2);
  // Su Shi in his tall cap, raising a cup
  const su = fig(gp, { x: 0.3, y: Y, z: -0.06, ry: -0.9, h: 0.34, outfit: 'robe', top: '#c4bca4', accent: '#3a4a5a', hat: 'fangjin', hatColor: '#1a1612', beard: 'long', beardColor: '#2a221a', wideSleeves: true,
    armL: { fwd: 0.3, side: 0.1, bend: 0.4 }, armR: { fwd: 1.1, side: 0.2, bend: 1.5 } });
  vessel(gp, [[0.006, 0], [0.011, 0.008], [0.012, 0.01]], 0.0012, QB, null, su.handR[0], su.handR[1] + 0.006, su.handR[2], 14, 0.2);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SWEET RICE BALLS (汤圆 / 浮圆子), Southern Song — Zhou Bida's poem on boiling 浮圆子 for the Lantern Festival: a woman
// in a Song 褙子 wraps glutinous-rice balls at a high table (qingbai bowls, a tray of raw balls, black-sesame filling),
// a pot of them simmers on a clay brazier, and a paper lantern hangs from a bamboo pole.
// ---------------------------------------------------------------------------------------------------------
function tangyuan(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  add(p, ELG(), mat('#f2eee4', { flat: false, rough: 0.25 }), x, y, z, r, r * 0.88, r);
}
const lf_tangyuan: Builder = gp => {
  // ref: 周必大《元宵煮浮圆子》; Song qingbai (景德镇青白瓷) bowls, 褙子 dress after 《歌乐图》; Song lanterns in 《武林旧事》
  base(gp, tiles(SITE.paving, 0.07));
  const QB = '#d4e0d8';
  const bowl = (p: THREE.Object3D, x: number, y: number, z: number, R: number, n: number) => {
    const b = grp(p, x, y, z);
    vessel(b, dense([[R * 0.35, 0], [R * 0.4, R * 0.1], [R * 0.8, R * 0.4], [R, R * 0.7]], R * 0.15), R * 0.06, QB, (px, py, pz) => (py < R * 0.1 ? '#c8b89a' : Math.sin(ang(px, pz) * 12) > 0.85 && py > R * 0.3 ? shade(QB, 0.93) : null), 0, 0, 0, 28, 0.15);
    fill(b, '#e8dcc0', 0, R * 0.58, 0, R * 0.86, 20, 0.08);
    for (let i = 0; i < n; i++) tangyuan(b, Math.cos(i * 2.1) * R * 0.4 * (i ? 1 : 0), R * 0.6, Math.sin(i * 2.1) * R * 0.4 * (i ? 1 : 0), R * 0.24);
    return b;
  };
  // Song high table with bowls, the raw-ball tray and sesame filling
  const ty = table(gp, 0.06, Y, 0.1, 0.24, 0.13, 0.16, '#5a3a24', 0.1, '#3e2818');
  const T = grp(gp, 0.06, ty, 0.1, 0.1);
  bowl(T, -0.07, 0, 0.02, 0.04, 4);
  bowl(T, 0.0, 0, 0.035, 0.032, 3);
  const Tr = grp(T, 0.06, 0, -0.01);
  vessel(Tr, [[0.042, 0], [0.046, 0.008]], 0.002, '#a8884e', (px, py, pz) => (Math.sin(ang(px, pz) * 40) > 0.6 ? '#8a6c3a' : null), 0, 0, 0, 28, 0.9);
  for (let i = 0; i < 10; i++) { const a = i * 2.4, rr = 0.008 + (i % 4) * 0.009; tangyuan(Tr, Math.cos(a) * rr, 0.009, Math.sin(a) * rr, 0.008); }
  const Sp = grp(T, -0.02, 0, -0.04);
  vessel(Sp, [[0.01, 0], [0.016, 0.008], [0.018, 0.012]], 0.0015, QB, null, 0, 0, 0, 18, 0.15);
  heap(Sp, 0, 0.008, 0, 0.016, 0.005, '#221c18');
  // woman wrapping a ball (one half open showing the black filling in her hand)
  const wm = fig(gp, { x: 0.04, y: Y, z: -0.04, ry: 0.1, h: 0.33, outfit: 'dress', top: '#7a6a58', bottom: '#cfc6b2', accent: '#5a4a3a', hairStyle: 'highbun', hair: '#1a1410',
    armL: { fwd: 0.8, side: 0.1, bend: 1.3, inward: 0.4 }, armR: { fwd: 0.8, side: 0.1, bend: 1.3, inward: 0.4 } });
  const hx = (wm.handL[0] + wm.handR[0]) / 2, hy = (wm.handL[1] + wm.handR[1]) / 2, hz = (wm.handL[2] + wm.handR[2]) / 2;
  tangyuan(gp, hx, hy + 0.004, hz + 0.004, 0.009);
  dot(gp, '#221c18', hx, hy + 0.011, hz + 0.004, 0.004, 5);
  // clay brazier and pot of simmering balls
  const sx = -0.24, sz = 0.06;
  plathe(gp, [[0, 0], [0.05, 0], [0.055, 0.05], [0.05, 0.06], [0, 0.06]], '#7a6450', (px, py, pz) => (py > 0.056 ? '#4a3424' : Math.sin(ang(px, pz) * 12) > 0.9 ? '#6a5440' : null), sx, Y, sz, 24, 0.85);
  box(gp, '#1e1410', sx, Y + 0.012, sz + 0.05, 0.03, 0.02, 0.012);
  glow(box(gp, '#7a3412', sx, Y + 0.014, sz + 0.056, 0.022, 0.014, 0.002), '#8a3a14', '#5a1c00');
  const P = grp(gp, sx, Y + 0.06, sz);
  vessel(P, dense([[0.026, 0], [0.05, 0.01], [0.062, 0.03], [0.064, 0.044], [0.068, 0.048]], 0.006), 0.004, '#3a3632', null, 0, 0, 0, 28, 0.6, 0.3);
  fill(P, '#ddd6c4', 0, 0.038, 0, 0.06, 24, 0.1);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.012 + (i % 3) * 0.014; tangyuan(P, Math.cos(a) * rr, 0.04, Math.sin(a) * rr, 0.009); }
  steam(P, 0, 0.05, 0, 0.016, 5, '#f0eee8', 0.28);
  // bowls on a low stool at the front
  bowl(gp, -0.16, Y, 0.28, 0.04, 4);
  vessel(gp, [[0.006, 0], [0.01, 0.004], [0.012, 0.006]], 0.0012, QB, null, -0.09, Y, 0.3, 14, 0.15).scale.set(1.6, 1, 1);
  // paper lantern on a bamboo pole
  rod(gp, [0.32, Y, -0.24], [0.33, Y + 0.44, -0.23], 0.006, '#8a7a4a', 6);
  rod(gp, [0.33, Y + 0.42, -0.23], [0.2, Y + 0.44, -0.18], 0.004, '#8a7a4a', 5);
  const L = grp(gp, 0.21, Y + 0.33, -0.18);
  rod(L, [0, 0.105, 0], [0, 0.04, 0], 0.003, '#3a2a1a', 3);
  glow(add(L, g('lf-lant', () => new THREE.SphereGeometry(1, 16, 10)), mat('#e0c08a'), 0, 0, 0, 0.034, 0.042, 0.034), '#e8c890', '#9a6420');
  for (const s2 of [-1, 1]) cyl(L, '#3a2a1a', 0, s2 > 0 ? 0.036 : -0.046, 0, 0.016, 0.008, 12);
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; rod(L, [Math.cos(a) * 0.034, 0, Math.sin(a) * 0.034], [Math.cos(a) * 0.022, 0.034, Math.sin(a) * 0.022], 0.003, '#7a5a3a', 3); }
  rod(L, [0, -0.05, 0], [0, -0.08, 0], 0.003, '#8a2a1a', 3);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// HOTPOT — 'mutton' (default): Liao/Khitan steppe meal after the Kangyingzi tomb mural (Aohan Banner, 10th c.) —
// diners kneeling on felt around a three-legged bronze 鍑 over a charcoal pit, with thin-cut mutton and a wine ewer.
// 'chongqing': a wide iron pot of red chilli oil divided by a 九宫格 grid, chillies and Sichuan peppercorns bobbing,
// plates of tripe, beef, lotus root and duck blood, a cup of skewers and oil-and-garlic dipping bowls.
// ---------------------------------------------------------------------------------------------------------
const SLICE = () => g('lf-slice', () => paintFaces(new THREE.SphereGeometry(1, 12, 6), '#b8404a', (x, _y, z) => { const v = Math.sin(x * 11 + Math.sin(z * 5) * 1.6); return v > 0.82 ? '#f4e0da' : v < -0.9 ? '#e8c4c0' : null; }));
const slice = (p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, rx = 0.25, c = '#ffffff') =>
  add(p, SLICE(), mat(c, { vc: true, flat: false, rough: 0.5 }), x, y, z, s, s * 0.08, s * 0.65, ry, rx, 0);
function slicePlate(p: THREE.Object3D, x: number, z: number, R: number, n: number, ry = 0, c = '#ffffff', paint: Paint | null = bwPaint(R)): void {
  const py = plate(p, x, Y, z, R, paint, '#ecebe6');
  for (let i = 0; i < n; i++) { const a = ry + (i / n) * Math.PI * 1.6 - 0.8; slice(p, x + Math.cos(a) * R * 0.45, py + 0.008 + i * 0.002, z + Math.sin(a) * R * 0.45, R * 0.5, -a + Math.PI / 2, 0.25, c); }
}
function dipBowl(p: THREE.Object3D, x: number, z: number, sauce: string, top: string[]): void {
  const b = grp(p, x, Y, z);
  vessel(b, [[0.022, 0], [0.04, 0.018], [0.046, 0.03]], 0.003, '#ecebe6', null, 0, 0, 0, 22, 0.25);
  fill(b, sauce, 0, 0.026, 0, 0.04, 20, 0.2);
  top.forEach((c, i) => { for (let k = 0; k < 3; k++) dot(b, c, Math.cos(i * 2 + k * 2.1) * 0.02, 0.028, Math.sin(i * 2 + k * 2.1) * 0.02, 0.006 - i * 0.001, 5); });
}
const lf_hotpot: Builder = (gp, r) => {
  if (r.style === 'chongqing') {
    base(gp, planks('#6a4a32', 0.09));
    // ring stove and the wide pot
    const P = grp(gp, 0, Y, 0.0);
    plathe(P, [[0, 0], [0.16, 0], [0.17, 0.03], [0.15, 0.04], [0, 0.04]], '#3a3836', null, 0, 0, 0, 30, 0.4, 0.4);
    glow(add(P, g('lf-ember', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), mat('#3a5a9a'), 0, 0.042, 0, 0.12, 0.004, 0.12), '#4a6aa0', '#1a3a8a');
    const R = 0.26;
    vessel(P, dense([[0.2, 0.04], [0.24, 0.05], [R, 0.1], [R + 0.006, 0.105]], 0.01), 0.006, '#2e2c2a', null, 0, 0, 0, 48, 0.35, 0.5);
    for (const s of [-1, 1]) add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#2e2c2a'), s * (R + 0.01), 0.095, 0, 0.026, 0.026, 0.026, Math.PI / 2);
    const oy = 0.09;
    add(P, g('lf-fill40', () => new THREE.CylinderGeometry(1, 1, 1, 40)), mat('#8e2410', { flat: false, rough: 0.12, metal: 0.1 }), 0, oy - 0.002, 0, R - 0.01, 0.004, R - 0.01);
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
      if (i % 3 !== 2) { gloss(P, i % 4 ? '#9a2214' : '#6e1a0e', x, oy + 0.004, z, 0.022, 0.007, 0.008, a * 3); dot(P, '#4a5a2a', x + Math.cos(a * 3) * 0.022, oy + 0.006, z - Math.sin(a * 3) * 0.022, 0.004, 4); }
      else dot(P, '#5a1a10', x, oy + 0.003, z, 0.006, 5);
    }
    for (let i = 0; i < 30; i++) dot(P, '#3a1208', Math.cos(i * 1.7) * (0.04 + (i % 7) * 0.03), oy + 0.003, Math.sin(i * 1.7) * (0.04 + (i % 7) * 0.03), 0.0045, 4);
    gloss(P, '#c8a868', 0.0, oy + 0.004, 0.0, 0.03, 0.006, 0.03);
    steam(P, -0.1, oy + 0.03, -0.08, 0.025, 5, '#f0e8e0', 0.24);
    steam(P, 0.1, oy + 0.03, 0.06, 0.02, 4, '#f0e8e0', 0.22);
    // plates: tripe, beef, lotus root, duck blood
    const tripePy = plate(gp, -0.3, Y, 0.24, 0.1, null, '#e2ded4');
    for (let i = 0; i < 6; i++) {
      const m = el(gp, '#d8cfb8', -0.3 + Math.cos(i * 1.05) * 0.04, tripePy + 0.008 + i * 0.002, 0.24 + Math.sin(i * 1.05) * 0.04, 0.045, 0.004, 0.02, i * 1.05);
      m.geometry = paintFaces(m.geometry.clone(), '#d8cfb8', (x, _y, z) => (Math.sin(x * 40) * Math.sin(z * 40) > 0.3 ? '#a89e88' : null));
      m.material = vcm(0.6);
    }
    slicePlate(gp, 0.3, 0.24, 0.1, 8, 0.4, '#c8a8a0', null);
    const lp = plate(gp, 0.36, Y, -0.06, 0.08, null, '#e2ded4');
    for (let i = 0; i < 5; i++) {
      const m = cyl(gp, '#f2ecd8', 0.36 + (i - 2) * 0.022, lp + 0.002, -0.06 + (i % 2) * 0.01, 0.03, 0.008, 16);
      m.geometry = paintFaces(m.geometry.clone(), '#f2ecd8', (x, y, z) => (y > 0.4 && [0, 1, 2, 3, 4, 5].some(k => Math.hypot(x - Math.cos(k * 1.05) * 0.28, z - Math.sin(k * 1.05) * 0.28) < 0.11) ? '#8a7a5a' : null));
      m.material = vcm(0.6); m.rotation.z = 0.5;
    }
    const dp = plate(gp, -0.36, Y, -0.06, 0.08, null, '#e2ded4');
    for (let i = 0; i < 6; i++) rbox(gp, '#5a1018', -0.38 + (i % 3) * 0.028, dp + 0.001, -0.075 + Math.floor(i / 3) * 0.03, 0.024, 0.024, 0.024, 0.004, i * 0.2);
    // a basket of greens (napa cabbage, crown daisy) instead of the old skewer cup
    const gpY = plate(gp, 0.0, Y, 0.34, 0.08, null, '#ecebe6');
    for (let i = 0; i < 7; i++) el(gp, i % 2 ? '#c8d0a0' : '#6a8a44', (i - 3) * 0.016, gpY + 0.01, 0.34 + Math.sin(i * 2) * 0.012, 0.012, 0.007, 0.045, 0.3 + i * 0.1);
    dipBowl(gp, -0.15, 0.33, '#b89a50', ['#e8e0c8', '#5a7a3a']);
    dipBowl(gp, 0.16, 0.33, '#b89a50', ['#e8e0c8', '#5a7a3a']);
    dipBowl(gp, -0.2, -0.33, '#b89a50', ['#e8e0c8', '#8a2a1a']);
    chopsticks(gp, 0.22, Y + 0.002, -0.32, 0.3);
    chopsticks(gp, -0.06, Y + 0.002, -0.36, -0.2);
  } else {
    // Yuan/Khitan steppe meal after the Liao tomb mural at Kangyingzi, Aohan Banner (10th c.): diners kneel on felt around
    // a three-legged bronze cauldron (鍑) over a charcoal pit, with a plate of thin-cut mutton and a long-necked wine ewer.
    const FELT = '#a8987a';
    base(gp, (x, _y, z) => {
      // a square felt rug laid on the steppe turf (straight edges follow the paint grid, so no ragged rim)
      if (Math.max(Math.abs(x), Math.abs(z)) > 0.3) return shade(SITE.meadow, 0.94 + fbm(x * 12, 2, z * 12, 2) * 0.1);
      return shade(FELT, 0.88 + fbm(x * 30, 4, z * 30, 3) * 0.2);
    });
    // stone-ringed charcoal pit
    const P = grp(gp, 0, Y, -0.02);
    for (let k = 0; k < 11; k++) { const a = k * TAU / 11; el(P, shade('#7a746a', 0.85 + (k % 3) * 0.08), Math.cos(a) * 0.075, 0.008, Math.sin(a) * 0.075, 0.016, 0.011, 0.013, a); }
    plathe(P, [[0, 0], [0.066, 0], [0.066, 0.004], [0, 0.004]], '#2a2420', null, 0, 0, 0, 20);
    for (let i = 0; i < 16; i++) { const a = i * 2.4, rr = 0.012 + (i % 5) * 0.011; const m = el(P, i % 3 ? '#2a2420' : '#c84a14', Math.cos(a) * rr, 0.008, Math.sin(a) * rr, 0.009, 0.006, 0.008, a); if (i % 3 === 0) glow(m, '#c8541a', '#a02a00'); }
    const f = grp(P, 0, 0.008, 0); f.name = 'flicker';
    for (const [dx, dz, h] of [[0, 0, 0.03], [0.018, 0.01, 0.022], [-0.016, -0.01, 0.024]] as const) add(f, g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7)), mat('#e8862a', { emissive: '#c84a00' }), dx, h / 2, dz, 0.01, h, 0.01);
    // three-legged bronze cauldron: about 55 cm across, the legs stand in the coals
    const legH = 0.034, R = 0.055;
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.5; rod(P, [Math.cos(a) * R * 0.62, legH + 0.006, Math.sin(a) * R * 0.62], [Math.cos(a) * R * 0.8, 0.002, Math.sin(a) * R * 0.8], 0.006, BRZD, 6); }
    vessel(P, dense([[0.02, legH], [0.045, legH + 0.008], [R, legH + 0.026], [R - 0.002, legH + 0.046], [R + 0.004, legH + 0.05]], 0.006), 0.003, '#4a4a38', (_x, py) => (py > legH + 0.043 ? '#6a6648' : py < legH + 0.012 ? '#2a2620' : null), 0, 0, 0, 30, 0.6, 0.45);
    for (const sx of [-1, 1]) add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#4a4a38'), sx * (R + 0.001), legH + 0.058, 0, 0.012, 0.012, 0.012, Math.PI / 2, 0, 0);
    const by = legH + 0.044;
    add(P, g('lf-fill24', () => new THREE.CylinderGeometry(1, 1, 1, 24)), mat('#bcae8c', { flat: false, rough: 0.15 }), 0, by - 0.002, 0, R - 0.004, 0.004, R - 0.004);
    for (let i = 0; i < 6; i++) { const a = i * 1.1; slice(P, Math.cos(a) * 0.028, by + 0.001, Math.sin(a) * 0.028, 0.016, -a, 0.5, '#a89488'); }
    steam(P, 0, by + 0.01, 0, 0.012, 5, '#f0ece4', 0.26);
    // wooden tray: plate of thin-cut raw mutton, a joint on a board with a knife, wooden bowls of salt and wild leek
    const T = grp(gp, 0.02, Y, 0.2);
    rbox(T, '#5e3e26', 0, 0, 0, 0.22, 0.012, 0.11, 0.004);
    const wp = (x: number, z: number, R2: number) => plathe(T, [[0, 0.012], [R2 * 0.7, 0.012], [R2, 0.02], [R2 * 0.94, 0.022], [0, 0.016]], '#7a5232', null, x, 0, z, 24, 0.6);
    wp(-0.05, 0, 0.045);
    for (let i = 0; i < 7; i++) { const a = i * 0.8; slice(T, -0.05 + Math.cos(a) * 0.016, 0.019 + i * 0.0012, Math.sin(a) * 0.016, 0.02, -a + Math.PI / 2, 0.15, '#c8a49c'); }
    rbox(T, '#8a6a46', 0.055, 0.012, 0, 0.08, 0.008, 0.06, 0.003);
    el(T, '#8a3a2c', 0.05, 0.03, 0, 0.03, 0.013, 0.017, 0.3);
    el(T, '#e2d6c0', 0.072, 0.03, 0.004, 0.009, 0.01, 0.01, 0.3);
    rod(T, [0.03, 0.022, 0.024], [0.075, 0.022, 0.026], 0.003, '#a8a8a0', 4);
    for (const [x, z, c] of [[-0.08, -0.03, '#e8e4dc'], [-0.0, -0.04, '#5a7a3a']] as const) { plathe(T, [[0, 0.012], [0.008, 0.012], [0.014, 0.022], [0.0135, 0.024], [0, 0.02]], '#6a4428', null, x, 0, z, 16); el(T, c, x, 0.022, z, 0.011, 0.003, 0.011); }
    // long-necked wine ewer (執壺) and cups on the felt
    const E = grp(gp, -0.2, Y, 0.12);
    plathe(E, dense([[0, 0], [0.012, 0], [0.02, 0.012], [0.022, 0.026], [0.015, 0.042], [0.007, 0.056], [0.0065, 0.074], [0.009, 0.078]], 0.006), '#c8c0a8', null, 0, 0, 0, 20, 0.3);
    rod(E, [0.016, 0.02, 0], [0.028, 0.05, 0], 0.003, '#c8c0a8', 5);
    for (const [x, z] of [[0.04, 0.02], [0.05, -0.02]]) vessel(E, [[0.006, 0], [0.012, 0.01], [0.013, 0.012]], 0.0015, '#c8c0a8', null, x, 0, z, 14, 0.3);
    // three diners in robes kneeling round the pot (Khitan/Mongol 袍 belted, low felt caps)
    const D: [number, number, number, string, string][] = [[-0.18, -0.05, Math.PI / 2 - 0.15, '#4a4a40', '#3a3028'], [0.19, -0.04, -Math.PI / 2 + 0.15, '#6a4a30', '#2a2420'], [0.02, -0.25, 0, '#3a4450', '#4a3a2a']];
    D.forEach(([x, z, ry, top, hat], i) => {
      const d = grp(gp, x, 0, z, ry);
      const rg = seiza(d, 0, 0, { h: 0.31, top, bottom: shade(top, 0.8), dress: 'ankle', hat, hatStyle: i === 2 ? 'fur' : 'turban', skin: '#c99a74', lean: 0.18, shoes: '#2a2018',
        hands: i === 0 ? [[-0.06, 0.32, 0.18], [0.03, 0.4, 0.3]] : i === 1 ? [[-0.05, 0.34, 0.22], [0.06, 0.3, 0.16]] : [[-0.08, 0.3, 0.16], [0.08, 0.3, 0.16]] });
      if (i === 0) for (const dz of [-0.003, 0.003]) rod(d, [rg.handR[0], rg.handR[1] + 0.004, rg.handR[2] + dz], [rg.handR[0] - 0.01, rg.handR[1] - 0.03, rg.handR[2] + 0.07 + dz], 0.003, '#7a5a3a', 4);
    });
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// PEKING ROAST DUCK (北京烤鸭), Ming — Bianyifang (便宜坊, 1416) roasted in a closed 焖炉: a grey-brick oven heated with
// sorghum stalks, the fire then raked out and the ducks hung inside to cook in the stored heat. At the front a Ming
// cook in a short jacket, apron and 六合一统 skullcap carves at a work table; blue-and-white dishes of sliced skin,
// thin pancakes, scallion and sweet bean sauce.
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
    rod(d, [0, 0.0, 0.005], [0, 0.05, 0.0], 0.003, '#2a2a2a', 4);
  } else {
    gloss(d, DUCK, 0, 0.04, 0, 0.075, 0.042, 0.048);
    gloss(d, '#a04a1c', 0.02, 0.06, 0, 0.05, 0.022, 0.032);
    shine(sweep(d, [{ p: [0.065, 0.045, 0], w: 0.016 }, { p: [0.1, 0.05, 0], w: 0.012 }, { p: [0.13, 0.04, 0], w: 0.012 }], DUCK, { radial: 7, sub: 3 }));
    gloss(d, '#7a2e10', 0.14, 0.042, 0, 0.018, 0.014, 0.014);
    for (const sz of [-1, 1]) gloss(d, '#7a2e10', -0.05, 0.06, sz * 0.035, 0.03, 0.018, 0.016, 0, 0, 0.5);
  }
}
const lf_duck: Builder = gp => {
  // ref: 便宜坊焖炉烤鸭 (Baidu Baike); Ming commoner 小帽 + 短衣 after 《三才图会》 and the Ming 《南都繁会图》 street cooks
  base(gp, tiles(SITE.paving, 0.08));
  const BRK = '#7e7a74', MOR = '#a6a198';
  // grey-brick closed oven (焖炉): squat block with a small arched mouth, the iron door swung aside, stored-heat glow inside
  const O = grp(gp, -0.06, Y, -0.24);
  const W = 0.4, H = 0.28, D = 0.07;
  panel(O, W, H, D, BRK, [archPath(0, 0.03, 0.17, 0.17)], 0, 0, 0.1);
  const hw = (y: number) => (y < 0.03 ? 0 : y < 0.115 ? 0.085 : y < 0.2 ? Math.sqrt(Math.max(0, 0.085 ** 2 - (y - 0.115) ** 2)) + 0.004 : 0);
  for (let i = 1; i * 0.022 < H; i++) {
    const y = i * 0.022, w = hw(y), segs: [number, number][] = w > 0 ? [[-W / 2, -w], [w, W / 2]] : [[-W / 2, W / 2]];
    for (const [a0, a1] of segs) box(O, MOR, (a0 + a1) / 2, y, 0.1 + D / 2, a1 - a0, 0.0025, 0.002);
    for (let x = -W / 2 + ((i % 2) * 0.024) + 0.024; x < W / 2 - 0.01; x += 0.048) if (Math.abs(x) > hw(y - 0.011) + 0.005 && Math.abs(x) > hw(y) + 0.005) box(O, MOR, x, y - 0.022, 0.1 + D / 2, 0.0025, 0.022, 0.002);
  }
  for (let k = 0; k < 7; k++) { const a = Math.PI * (k + 0.5) / 7; box(O, shade(BRK, 0.9), Math.cos(a) * 0.095, 0.115 + Math.sin(a) * 0.095 - 0.01, 0.1 + D / 2 + 0.001, 0.026, 0.02, 0.004, 0, 0, a - Math.PI / 2); }
  for (const sx of [-1, 1]) box(O, shade(BRK, 0.92), sx * (W / 2 - 0.02), 0, -0.04, 0.04, H, 0.2);
  box(O, shade(BRK, 0.7), 0, H, -0.04, W + 0.01, 0.02, 0.21);
  box(O, '#6a6660', 0, 0, 0.14, 0.18, 0.012, 0.04);
  glow(box(O, '#8a3a1a', 0, 0.01, -0.12, W - 0.1, 0.16, 0.01), '#9a4a24', '#5a1800');
  rbox(O, '#3a2a20', 0, 0, -0.06, W - 0.08, 0.012, 0.14, 0.004);
  for (let i = 0; i < 10; i++) { const m = el(O, '#5a2a14', -0.1 + i * 0.022, 0.014, -0.08 + (i % 3) * 0.02, 0.008, 0.004, 0.007); if (i % 2) glow(m, '#8a3412', '#6a1800'); }
  rod(O, [-0.1, 0.17, 0.0], [0.1, 0.17, 0.0], 0.003, '#2a2a2a', 5);
  for (let k = 0; k < 3; k++) duck(O, -0.05 + k * 0.05, 0.165, 0.0, 0.5, 0.3 * (k - 1), true);
  // iron door leaning against the facade, sorghum-stalk fuel bundle
  rbox(O, '#2e2c2a', 0.15, 0, 0.17, 0.12, 0.15, 0.012, 0.004, 0.25);
  for (let i = 0; i < 9; i++) rod(gp, [-0.3 + i * 0.006, Y + 0.004, -0.02 - (i % 3) * 0.006], [-0.24 + i * 0.006, Y + 0.004 + (i % 3) * 0.006, -0.16], 0.004, i % 2 ? '#b8a070' : '#a08a5a', 4);
  // work table with a carving board, a roast duck, sliced skin and a cleaver
  const ty = table(gp, 0.12, Y, 0.1, 0.24, 0.12, 0.15, '#7a5a3a', -0.2, '#4a3422');
  const B = grp(gp, 0.12, ty, 0.1, -0.2);
  rbox(B, '#b8986a', 0.0, 0, 0, 0.12, 0.012, 0.075, 0.004);
  duck(B, -0.03, 0.012, 0, 0.45, 0);
  for (let i = 0; i < 4; i++) shine(sweep(B, [{ p: [0.03 + i * 0.008, 0.015, -0.02 + i * 0.01], w: 0.008, h: 0.002 }, { p: [0.045 + i * 0.008, 0.015, -0.014 + i * 0.01], w: 0.008, h: 0.002 }], '#7a3a18', { radial: 6, sub: 2, paint: (_x, py) => (py < 0.0145 ? '#e8d8bc' : null) }));
  const sp = plate(B, 0.08, 0, 0.028, 0.032, bwPaint(0.032));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; shine(sweep(B, [{ p: [0.08 + Math.cos(a) * 0.006, sp + 0.003, 0.028 + Math.sin(a) * 0.006], w: 0.008, h: 0.002 }, { p: [0.08 + Math.cos(a) * 0.022, sp + 0.004, 0.028 + Math.sin(a) * 0.022], w: 0.009, h: 0.002 }], '#7a3a18', { radial: 6, sub: 2 })); }
  // Ming cook: undyed cotton short jacket, dark trousers, apron, black 六合一统 skullcap
  const ck = fig(gp, { h: 0.35, x: 0.1, y: Y, z: -0.02, ry: -0.2, outfit: 'tunic', top: '#8a8676', bottom: '#3a3632', accent: '#5a564c', hat: 'guapi', hatColor: '#24201c', hatBadge: '#24201c',
    hairStyle: 'topknot', stance: 'stand', lean: 0.12, armL: { fwd: 0.7, side: 0.15, bend: 1.2, inward: 0.3 }, armR: { fwd: 0.85, side: 0.2, bend: 1.0, inward: 0.25 } });
  const A = grp(gp, 0.1, Y, -0.02, -0.2);
  box(A, '#c8c0aa', 0, 0.09, 0.06, 0.1, 0.13, 0.004, 0.1);
  const [kx, ky, kz] = ck.handR;
  rbox(gp, '#9aa0a4', kx, ky - 0.012, kz + 0.012, 0.004, 0.022, 0.034, 0.002, -0.2);
  // low side table: pancakes in a steamer, scallion, sweet bean sauce
  const sy = table(gp, -0.22, Y, 0.18, 0.18, 0.12, 0.09, '#6a4a30', 0.3, '#3a2a1c');
  const S = grp(gp, -0.22, sy, 0.18, 0.3);
  const pk = steamerRing(S, -0.04, 0, 0, 0.032, 0.022);
  for (let i = 0; i < 5; i++) cyl(S, '#ece2c8', -0.04, pk - sy + i * 0.002 + sy - sy, 0, 0.027, 0.002, 18);
  const vp = plate(S, 0.03, 0, -0.02, 0.028, bwPaint(0.028));
  for (let i = 0; i < 5; i++) rod(S, [0.018 + i * 0.006, vp + 0.003, -0.035], [0.028 + i * 0.006, vp + 0.003, -0.005], 0.003, i % 2 ? '#e2e6d0' : '#7a9a5a', 4);
  const sd = grp(S, 0.04, 0, 0.035);
  vessel(sd, [[0.01, 0], [0.017, 0.008], [0.018, 0.012]], 0.0015, BW, (_x, py) => (Math.abs(py - 0.007) < 0.0015 ? COB : null), 0, 0, 0, 18, 0.25);
  fill(sd, '#3a2216', 0, 0.01, 0, 0.016, 18, 0.15);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// MANCHU-HAN FEAST (满汉全席), Qing — the great official banquet recorded in Li Dou's 《扬州画舫录》: a long rosewood
// table with a red embroidered frontal (桌围) set with famille-rose, blue-and-white and yellow-ground porcelain around a
// roast suckling pig; bird's nest in a lidded cup; a five-panel rosewood screen with ink landscapes behind; a eunuch
// in 马褂 and official hat bringing a covered dish, a palace maid with a single braid.
// ---------------------------------------------------------------------------------------------------------
const IMP = '#c8a24a', GOLD = '#b89448';
function roastPig(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0): void {
  const P = grp(p, x, y, z, ry, s);
  const C = '#8a4422';
  shine(sweep(P, [{ p: [-0.1, 0.035, 0], w: 0.03, h: 0.028 }, { p: [-0.06, 0.045, 0], w: 0.05, h: 0.045 }, { p: [0.02, 0.048, 0], w: 0.052, h: 0.046 }, { p: [0.08, 0.042, 0], w: 0.038, h: 0.036 }, { p: [0.12, 0.035, 0], w: 0.02, h: 0.02 }], C,
    { radial: 14, sub: 4, up: [0, 1, 0], paint: (_x, py) => (py > 0.075 ? '#9e5a2c' : py < 0.012 ? '#5e2a12' : null) }), 0.2);
  gloss(P, '#5e2a12', 0.132, 0.034, 0, 0.012, 0.012, 0.014);
  for (const sz of [-1, 1]) {
    cone(P, '#6e3416', 0.085, 0.07, sz * 0.02, 0.012, 0.03, 6).rotation.set(sz * 0.6, 0, -0.5);
    dot(P, '#1a0e08', 0.105, 0.052, sz * 0.018, 0.004, 5);
    for (const lx of [-0.06, 0.05]) gloss(P, '#6e3416', lx, 0.012, sz * 0.04, 0.022, 0.01, 0.012, 0, 0, 0.2);
  }
  add(P, g('lf-tor', () => new THREE.TorusGeometry(1, 0.28, 6, 10, Math.PI)), mat('#6e3416'), -0.105, 0.05, 0, 0.01, 0.01, 0.01, 0, 0, 1);
}
function famille(c: string): Paint { return (x, y, z) => { const a = ang(x, z), r = Math.hypot(x, z); return Math.sin(a * 6 + r * 80) > 0.85 ? '#c27a8a' : Math.sin(a * 9 - r * 60) > 0.9 ? '#5f8a62' : y > 0 && r > 0.05 && Math.sin(a * 30) > 0.95 ? GOLD : c === '' ? null : null; }; }
function dish(p: THREE.Object3D, x: number, y: number, z: number, R: number, ware: 'bw' | 'rose' | 'yellow', food: string, kind: 'heap' | 'pieces' | 'soup' | 'fish'): void {
  const c = ware === 'yellow' ? IMP : BW, paint = ware === 'bw' ? bwPaint(R) : ware === 'rose' ? famille('') : null;
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
  // ref: 李斗《扬州画舫录》卷四 满汉席; Qing 紫檀 screens, 桌围 and 粉彩/青花/黄地 porcelain (Palace Museum collection)
  base(gp, tiles(SITE.stone, 0.1, false));
  const RW = '#3a2218';
  // five-panel folding screen, rosewood frames with ink landscapes on silk
  const ink = (x: number, y: number): string | null => {
    const m1 = 0.17 + Math.sin(x * 40) * 0.035 + Math.sin(x * 97) * 0.012, m2 = 0.11 + Math.sin(x * 23 + 1) * 0.03;
    return y < m2 ? '#7a7a68' : y < m1 ? '#9a9a86' : null;
  };
  for (let i = 0; i < 5; i++) {
    const P = grp(gp, (i - 2) * 0.13, Y, -0.34 + (i % 2) * 0.018, (i % 2 ? 0.12 : -0.12));
    box(P, RW, 0, 0, 0, 0.13, 0.32, 0.012);
    const pg = new THREE.PlaneGeometry(0.11, 0.24, 12, 16).translate(0, 0.16, 0);
    add(P, paintFaces(pg, '#cbbd9c', (x, y) => ink(x + i * 0.13, y - 0.04)), mat('#ffffff', { vc: true, flat: false, rough: 0.9 }), 0, 0, 0.007, 1, 1, 1);
    box(P, shade(RW, 1.2), 0, 0.012, 0.007, 0.11, 0.035, 0.002);
  }
  // long table with a red embroidered frontal
  const tw = 0.56, td = 0.2, th = 0.16, tz = 0.04;
  table(gp, 0, Y, tz, tw, td, th, RW, 0, RW);
  box(gp, '#7a2a20', 0, Y + 0.02, tz + td / 2 + 0.002, tw - 0.02, th - 0.035, 0.003);
  box(gp, GOLD, 0, Y + th - 0.03, tz + td / 2 + 0.004, tw - 0.02, 0.006, 0.002);
  const ro = add(gp, new THREE.CircleGeometry(0.022, 20), mat(GOLD, { rough: 0.5 }), 0, Y + 0.075, tz + td / 2 + 0.005, 1, 1, 1);
  void ro;
  const ty = Y + th;
  const pp = plate(gp, 0, ty, tz, 0.07, famille(''), BW);
  roastPig(gp, 0, pp, tz, 0.5, 0.15);
  for (let i = 0; i < 8; i++) el(gp, '#5a7a44', Math.cos(i * 0.8) * 0.058, pp + 0.003, tz + Math.sin(i * 0.8) * 0.045, 0.01, 0.003, 0.005, i);
  const D: [number, number, number, 'bw' | 'rose' | 'yellow', string, 'heap' | 'pieces' | 'soup' | 'fish'][] = [
    [-0.22, -0.05, 0.034, 'yellow', '#a8583a', 'pieces'], [-0.13, -0.055, 0.032, 'rose', '#5a7a44', 'heap'], [0.13, -0.055, 0.032, 'bw', '#b8965a', 'soup'], [0.22, -0.05, 0.034, 'rose', '#b87a4a', 'pieces'],
    [-0.22, 0.05, 0.034, 'bw', '#8a4a2a', 'pieces'], [-0.12, 0.06, 0.036, 'bw', '#8a8a80', 'fish'], [0.12, 0.06, 0.034, 'yellow', '#e4dac0', 'soup'], [0.22, 0.05, 0.034, 'rose', '#c8a050', 'heap'],
  ];
  for (const [dx, dz, R, w, f, k] of D) dish(gp, dx, ty, tz + dz, R, w, f, k);
  const bn = grp(gp, -0.06, ty, tz + 0.075);
  vessel(bn, dense([[0.01, 0], [0.016, 0.008], [0.019, 0.02]], 0.004), 0.002, IMP, null, 0, 0, 0, 20, 0.25);
  heap(bn, 0, 0.016, 0, 0.016, 0.008, '#ece4d0', (px, py, pz) => (Math.sin(px * 900 + pz * 400) > 0.3 ? '#dcd0b6' : null));
  plathe(bn, [[0, 0.015], [0.008, 0.014], [0.022, 0.005], [0.022, 0.002], [0, 0.011]], IMP, null, 0.026, -0.003, 0.0, 20, 0.25);
  bn.children[bn.children.length - 1].rotation.z = 0.25;
  for (const cx of [-0.16, 0.06, 0.18]) { vessel(gp, [[0.005, 0], [0.009, 0.008], [0.01, 0.011]], 0.0012, BW, null, cx, ty, tz + 0.085, 14, 0.2); chopsticks(gp, cx + 0.03, ty, tz + 0.085, 1.4, '#d8ccaa', 0.05); }
  // attendants: eunuch with a covered dish, palace maid
  const e = fig(gp, { x: -0.24, y: Y, z: -0.18, ry: 0.4, h: 0.33, outfit: 'changshan', top: '#3a4a5e', jacket: '#24242a', hat: 'qingguan', hatColor: '#1a1612', hatBadge: '#8a7a50', hairStyle: 'queue',
    armL: { fwd: 1.2, side: 0.2, bend: 1.2, inward: 0.3 }, armR: { fwd: 1.2, side: 0.2, bend: 1.2, inward: 0.3 } });
  const mx = (e.handL[0] + e.handR[0]) / 2, my = (e.handL[1] + e.handR[1]) / 2 + 0.006, mz = (e.handL[2] + e.handR[2]) / 2;
  plate(gp, mx, my, mz, 0.03, bwPaint(0.03));
  plathe(gp, [[0, 0.024], [0.005, 0.024], [0.006, 0.02], [0.024, 0.012], [0.026, 0], [0, 0.0]], IMP, null, mx, my + 0.005, mz, 20, 0.25);
  fig(gp, { x: 0.26, y: Y, z: -0.18, ry: -0.4, h: 0.32, outfit: 'robe', top: '#4e6470', accent: '#2e3a40', hairStyle: 'braid', hair: '#1a1410',
    armL: { fwd: 0.5, side: 0.15, bend: 1.3, inward: 0.5 }, armR: { fwd: 0.5, side: 0.15, bend: 1.3, inward: 0.5 } });
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// WESTERN ZHOU RITUAL BANQUET (列鼎而食 / 周代八珍) — on reed mats: a row of five bronze ding of decreasing size (the
// 五鼎四簋 rank set of a 大夫), four gui tureens heaped with millet, stemmed dou of meat sauce, a roast suckling pig
// (炮豚, one of the 《礼记·内则》 Eight Delicacies) on a wooden 俎, and two nobles in 玄衣纁裳 kneeling to the feast.
// ---------------------------------------------------------------------------------------------------------
function gui(p: THREE.Object3D, x: number, z: number, s: number): void {
  const G = grp(p, x, Y, z, 0, s);
  rbox(G, BRZ, 0, 0, 0, 0.11, 0.035, 0.11, 0.006);
  plathe(G, [[0, 0.035], [0.045, 0.035], [0.042, 0.05]], BRZ, null, 0, 0, 0, 20, 0.45, 0.45);
  vessel(G, dense([[0.04, 0.05], [0.07, 0.07], [0.08, 0.1], [0.078, 0.12], [0.082, 0.125]], 0.008), 0.005, BRZ, taotie, 0, -0.01, 0, 32, 0.45, 0.45);
  for (const sx of [-1, 1]) sweep(G, [{ p: [sx * 0.07, 0.1, 0], w: 0.008 }, { p: [sx * 0.105, 0.095, 0], w: 0.01 }, { p: [sx * 0.1, 0.06, 0], w: 0.008 }, { p: [sx * 0.075, 0.055, 0], w: 0.006 }], BRZ, { radial: 6, sub: 3 });
  heap(G, 0, 0.1, 0, 0.074, 0.05, '#c8ae6a');
}
function dou(p: THREE.Object3D, x: number, z: number, s: number, food: string): void {
  const D = grp(p, x, Y, z, 0, s);
  plathe(D, [[0, 0], [0.04, 0], [0.035, 0.008], [0.012, 0.03], [0.011, 0.09], [0.03, 0.1], [0.06, 0.115], [0.065, 0.122], [0.055, 0.12], [0, 0.108]], BRZ, (_x, y) => (y > 0.098 && y < 0.115 ? BRZD : null), 0, 0, 0, 24, 0.45, 0.45);
  heap(D, 0, 0.108, 0, 0.055, 0.02, food);
}
const lf_bazhen: Builder = gp => {
  // ref: 《礼记·内则》 八珍; 列鼎 sets (e.g. 宝鸡 強国墓地, 虢国墓地 五鼎四簋); 玄衣纁裳 after 《周礼》
  base(gp, matting('#b89a5e', 0.02));
  // row of five ding, largest first
  const sc = [0.38, 0.35, 0.32, 0.29, 0.26];
  let x = -0.3;
  sc.forEach((s, i) => {
    x += 0.19 * s * (i ? 1 : 0.6);
    const top = ding(gp, x, Y, -0.2 + i * 0.005, s, 0.2, 0.12) * s + Y;
    fill(gp, '#7a3e1a', x, top - 0.005, -0.2 + i * 0.005, 0.16 * s, 22, 0.25);
    for (let k = 0; k < 3; k++) gloss(gp, '#a8603a', x + Math.cos(k * 2.1) * 0.06 * s, top, -0.2 + Math.sin(k * 2.1) * 0.06 * s, 0.03 * s, 0.015 * s, 0.025 * s, k);
    if (i < 2) steam(gp, x, top + 0.01, -0.2, 0.018, 4, '#f5f5f2', 0.24);
    x += 0.19 * s;
  });
  // gui with millet and dou with meat sauce
  for (let i = 0; i < 4; i++) gui(gp, -0.2 + i * 0.105, 0.0, 0.68);
  dou(gp, -0.34, 0.1, 0.75, '#5e2e18');
  dou(gp, 0.34, 0.08, 0.75, '#6a3a1e');
  dou(gp, 0.33, -0.04, 0.7, '#5a6a34');
  // the suckling pig on a wooden 俎 (offering stand)
  const Zu = grp(gp, 0, Y, 0.22);
  rbox(Zu, '#4a3020', 0, 0.05, 0, 0.18, 0.012, 0.07, 0.003);
  for (const sx of [-1, 1]) { box(Zu, '#3e281a', sx * 0.075, 0, 0, 0.012, 0.05, 0.06); box(Zu, '#3e281a', sx * 0.075, 0, 0, 0.02, 0.008, 0.07); }
  roastPig(gp, 0, Y + 0.062, 0.22, 0.6, 0);
  // kneeling nobles in black upper robe and russet lower skirt, hair in a capped topknot
  for (const sx of [-1, 1]) {
    seiza(gp, sx * 0.29, 0.28, { h: 0.33, ry: -sx * 1.2, top: '#2a2420', bottom: '#6a2e1e', dress: 'ankle', hat: '#1a1410', hatStyle: 'knot', skin: '#d8a882', hair: '#1a1410', lean: 0.1,
      hands: [[-0.06, 0.4, 0.2], [0.06, 0.4, 0.2]] });
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// SEASIDE SALT BOILING (煮海为盐, Qi) — the Bohai-coast salt works of Shouguang (双王城 / 大荒北央, Shang–Zhou, used on
// into Qi times): brine drawn from a shallow well, cleared in settling pits, then boiled dry in rows of grey pointed-base
// 盔形器 jars packed on a long straw-mud salt stove; the jars are broken open for the salt cakes. Workers in hemp.
// ---------------------------------------------------------------------------------------------------------
const lf_salt: Builder = gp => {
  // ref: 寿光双王城盐业遗址群 (卤水井、沉淀池、盐灶、盔形器), Baidu Baike / 《考古》2010.3
  base(gp, earth(SITE.loess, 16));
  water(gp, clipRect(-0.5, 0.5, -0.5, -0.3, 0.45), Y + 0.003, '#5e7a80');
  for (let i = 0; i < 5; i++) rod(gp, [-0.26 + i * 0.12, Y + 0.005, -0.31 - (i % 2) * 0.01], [-0.21 + i * 0.12, Y + 0.005, -0.315 - (i % 2) * 0.01], 0.003, '#c8d0cc', 4);
  // brine well: a timber-lined pit with a dark brine surface
  const wx = -0.27, wz = -0.17;
  plathe(gp, [[0.05, 0], [0.058, 0.014], [0.05, 0.014], [0.046, 0.002], [0, 0.002]], '#6a5a44', null, wx, Y, wz, 20);
  fill(gp, '#4a5452', wx, Y + 0.006, wz, 0.046, 20, 0.15);
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; rod(gp, [wx + Math.cos(a) * 0.05, Y + 0.002, wz + Math.sin(a) * 0.05], [wx + Math.cos(a) * 0.05, Y + 0.022, wz + Math.sin(a) * 0.05], 0.004, '#5a4630', 4); }
  // two settling pits with clearing brine, earth banks
  for (const [x0, x1, z0, z1, c] of [[-0.2, -0.02, -0.24, -0.12, '#7a8278'], [-0.42, -0.24, -0.08, 0.06, '#8a908a']] as const) {
    for (const [a0, a1, b0, b1] of [[x0 - 0.01, x1 + 0.01, z0 - 0.01, z0], [x0 - 0.01, x1 + 0.01, z1, z1 + 0.01], [x0 - 0.01, x0, z0, z1], [x1, x1 + 0.01, z0, z1]] as const) rbox(gp, '#8a7a5c', (a0 + a1) / 2, Y, (b0 + b1) / 2, a1 - a0, 0.01, b1 - b0, 0.003);
    water(gp, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], Y + 0.004, c);
  }
  // salt stove: a long straw-mud platform, fire tunnel open at the front, the top packed with 盔形器 jars of boiling brine
  const S = grp(gp, 0.12, Y, -0.06, -0.12);
  const L = 0.36, Wd = 0.15, Hs = 0.045;
  rbox(S, '#7e6448', 0, 0, 0, L, Hs, Wd, 0.008);
  rbox(S, '#5a3e2a', 0, Hs - 0.004, 0, L - 0.02, 0.006, Wd - 0.02, 0.002);
  box(S, '#1e1410', 0, 0.004, Wd / 2 - 0.004, 0.06, 0.03, 0.01);
  glow(box(S, '#b8501a', 0, 0.006, Wd / 2 + 0.001, 0.05, 0.022, 0.003), '#c8601e', '#8a2a00');
  const fl = grp(S, 0, 0.008, Wd / 2 + 0.006); fl.name = 'flicker';
  for (const [dx, hh] of [[0, 0.03], [-0.014, 0.02], [0.014, 0.022]] as const) add(fl, g('lf-flame', () => new THREE.ConeGeometry(1, 1, 7)), mat('#e8862a', { emissive: '#c84a00' }), dx, hh / 2, 0, 0.008, hh, 0.008);
  const KUI = dense([[0.0, 0.0], [0.006, 0.004], [0.011, 0.016], [0.013, 0.03], [0.0135, 0.038], [0.016, 0.042]], 0.006);
  for (let i = 0; i < 11; i++) for (let j = 0; j < 4; j++) {
    const x = -L / 2 + 0.03 + i * 0.03 + (j % 2) * 0.012, z = -Wd / 2 + 0.03 + j * 0.03;
    if (x > L / 2 - 0.02) continue;
    vessel(S, KUI, 0.002, shade('#7a766c', 0.9 + ((i * 7 + j * 3) % 5) * 0.04), null, x, Hs - 0.022, z, 10, 0.85);
    fill(S, (i + j) % 3 ? '#e8e6de' : '#9aa09a', x, Hs + 0.017, z, 0.012, 10, 0.6);
  }
  steam(S, -0.08, Hs + 0.03, 0, 0.022, 5, '#eeeeea', 0.24);
  steam(S, 0.08, Hs + 0.03, 0.02, 0.02, 4, '#eeeeea', 0.22);
  // broken jars, sherds and the salt cakes knocked out of them
  for (const [hx, hz, r] of [[0.28, 0.24, 0.05], [0.16, 0.3, 0.036]] as const) heap(gp, hx, Y, hz, r, r * 0.75, '#d6d2c6', (px, py, pz) => (hash3(Math.floor(px * 300), Math.floor(py * 300), Math.floor(pz * 300)) > 0.75 ? '#c8c6bc' : null));
  for (let i = 0; i < 12; i++) { const a = i * 2.2, rr = 0.06 + (i % 4) * 0.015; const m = rbox(gp, i % 3 ? '#7a766c' : '#6a665e', 0.3 + Math.cos(a) * rr, Y, 0.16 + Math.sin(a) * rr * 0.6, 0.016, 0.004, 0.012, 0.001, a); m.rotation.z = 0.3 * Math.sin(i); }
  for (const [x, z, ry] of [[0.36, 0.1, 0.4], [0.33, 0.06, 1.8]] as const) { const m = vessel(gp, KUI, 0.002, '#7a766c', null, x, Y + 0.012, z, 10, 0.85); m.rotation.set(Math.PI / 2 - 0.2, ry, 0); }
  // worker stoking the stove (crouching at the fire tunnel with a stick)
  const st = who(gp, 0.1, Y, 0.17, { h: 0.31, ry: Math.PI - 0.1, pose: 'crouch', top: '#9a8c6e', bottom: '#7a6c52', shorts: true, sleeve: 0.45, hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot', skin: '#b07850' });
  rod(gp, st.handR, [0.11, Y + 0.012, 0.03], 0.003, '#6a4a2a', 4);
  for (let i = 0; i < 6; i++) rod(gp, [-0.04 + i * 0.008, Y + 0.004, 0.16], [0.0 + i * 0.008, Y + 0.004 + (i % 2) * 0.004, 0.26], 0.004, i % 2 ? '#8a7a54' : '#a08c62', 4);
  // brine carrier: shoulder pole with two jars, walking from the well
  const cr = who(gp, -0.22, Y, 0.16, { h: 0.33, ry: 0.5, pose: 'walk', phase: 0.25, top: '#a8987a', bottom: '#8a7a5e', shorts: true, sleeve: 0.45, skin: '#b07850', hair: '#1c140e', hat: '#1c140e', hatStyle: 'knot',
    hands: [[-0.1, 0.8, 0.02], [0.12, 0.78, 0.06]] });
  const [hx, hy, hz] = cr.head, a2 = 0.5 + Math.PI / 2;
  const e1: V3 = [hx + Math.sin(a2) * 0.13, hy - 0.06, hz + Math.cos(a2) * 0.13], e2: V3 = [hx - Math.sin(a2) * 0.13, hy - 0.06, hz - Math.cos(a2) * 0.13];
  rod(gp, e1, e2, 0.004, '#7a5a34', 5);
  for (const e of [e1, e2]) {
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; rod(gp, e, [e[0] + Math.cos(a) * 0.018, Y + 0.09, e[2] + Math.sin(a) * 0.018], 0.003, '#5a4a2a', 3); }
    vessel(gp, [[0.012, 0], [0.024, 0.02], [0.022, 0.04], [0.016, 0.05], [0.018, 0.054]], 0.002, '#8a7a64', null, e[0], Y + 0.04, e[2], 14, 0.85);
  }
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// ROTARY STONE MILL (石转磨, Qin–Han) — after the Western Han mill from 满城 tomb 1 (Liu Sheng): a 54 cm two-stone mill
// set in a big bronze funnel-basin on a timber stand, wheat heaped in the feed hole, a sweep pole harnessed to a
// blindfolded donkey plodding a trodden circle; wheat sheaves, hemp sacks, and a woman in a Han 曲裾 shaking a
// horsehair sieve (箩) over a flour basket.
// ---------------------------------------------------------------------------------------------------------
const lf_mill: Builder = gp => {
  base(gp, earth(SITE.earth, 16));
  // ref: 满城汉墓 M1 石磨 with 铜漏斗 (and an animal skeleton beside it); 洛阳烧沟 Han pottery mill models
  add(gp, new THREE.RingGeometry(0.24, 0.33, 48, 1).rotateX(-Math.PI / 2), mat('#8a7254', { flat: false }), 0, Y + 0.001, -0.02, 1, 1, 1);
  const ty = table(gp, 0, Y, -0.02, 0.15, 0.15, 0.05, '#5a3a24', 0.3, '#4a2e1c');
  cone(gp, '#5e5a40', 0, ty - 0.03, -0.02, 0.02, 0.03, 12).rotation.x = Math.PI;
  const M = grp(gp, 0, ty, -0.02, 0, 0.45);
  plathe(M, [[0, 0], [0.19, 0], [0.19, 0.05], [0.2, 0.06], [0.185, 0.065], [0.16, 0.055], [0, 0.055]], '#6a664a', (px, py, pz) => (Math.sin(ang(px, pz) * 30 + py * 200) > 0.9 ? '#4e5238' : null), 0, 0, 0, 36, 0.5, 0.5);
  add(M, new THREE.RingGeometry(0.13, 0.18, 36, 1).rotateX(-Math.PI / 2), mat('#e6e0d2', { flat: false }), 0, 0.058, 0, 1, 1, 1);
  for (let i = 0; i < 8; i++) { const a = i * 0.8; heap(M, Math.cos(a) * 0.15, 0.056, Math.sin(a) * 0.15, 0.022, 0.01, '#e6e0d2'); }
  plathe(M, [[0, 0.055], [0.125, 0.055], [0.125, 0.1], [0, 0.1]], '#a8a498', granite('#a8a498'), 0, 0, 0, 30);
  plathe(M, [[0, 0.102], [0.125, 0.102], [0.124, 0.16], [0.105, 0.168], [0.05, 0.168], [0.045, 0.15], [0, 0.15]], '#b0ab9f', (px, py, pz) => (py > 0.102 && py < 0.108 ? '#6e6a62' : granite('#b0ab9f')(px, py, pz, 0, 0, 0)), 0, 0, 0, 30);
  heap(M, 0, 0.15, 0, 0.046, 0.02, '#b8945a');
  // sweep pole from the upper stone out to the donkey's harness
  const da = 0.9, dr = 0.29, dx = Math.cos(da) * dr, dz = -0.02 + Math.sin(da) * dr;
  const DS = 0.34, Dn = grp(gp, dx, Y, dz, -da + Math.PI, DS);
  const hy = horse(Dn, '#7a6e64', '#3a322c', { donkey: true, cloth: '#5a4a38', saddle: '#3a2a1c' }) * DS;
  rod(gp, [-Math.cos(da) * 0.06, ty + 0.06, -0.02 - Math.sin(da) * 0.06], [dx, Y + hy - 0.01, dz], 0.006, '#7a5634', 6);
  // wheat sheaves leaning, sacks
  for (const [sx, sz, a] of [[-0.36, -0.12, 0.2], [-0.3, -0.26, -0.3], [-0.39, 0.04, 0.5]] as const) {
    const W = grp(gp, sx, Y, sz, a);
    for (let k = 0; k < 9; k++) {
      const ox = (k % 3 - 1) * 0.01, oz = (Math.floor(k / 3) - 1) * 0.01, tp: V3 = [ox * 3.5, 0.2, oz * 3.5];
      rod(W, [ox, 0, oz], tp, 0.0022, '#b8a068', 4);
      el(W, '#b89a58', tp[0] * 1.08, tp[1] + 0.016, tp[2] * 1.08, 0.006, 0.018, 0.006, 0, oz * 8, -ox * 8);
    }
    add(W, g('lf-ring', () => new THREE.TorusGeometry(1, 0.06, 5, 24)), mat('#8a6e3a'), 0, 0.08, 0, 0.02, 0.02, 0.02, 0, Math.PI / 2);
  }
  sack(gp, 0.33, -0.22, 0.55, 0.3, '#b8945a', '#a8946e');
  sack(gp, 0.39, -0.12, 0.5, 1.2, '#e6e0d2', '#b8ab8e');
  // woman sifting flour over a basket
  const B = grp(gp, -0.12, Y, 0.3, 0, 0.6);
  vessel(B, [[0.06, 0], [0.075, 0.04], [0.08, 0.05]], 0.005, '#9a7a4a', (px, py, pz) => ((Math.floor(ang(px, pz) * 8) + Math.floor(py * 120)) % 2 ? '#7e6038' : null), 0, 0, 0, 24);
  heap(B, 0, 0.04, 0, 0.072, 0.03, '#e6e0d2');
  const w = who(gp, -0.22, Y, 0.24, { h: 0.33, ry: 1.2, pose: 'stand', lean: 0.15, top: '#6a6e58', bottom: '#4a4038', dress: 'ankle', skin: '#d8a882', hair: '#1a1410', hat: '#1a1410', hatStyle: 'knot',
    hands: [[-0.08, 0.5, 0.28], [0.08, 0.5, 0.28]] });
  const sx2 = (w.handL[0] + w.handR[0]) / 2, sy2 = (w.handL[1] + w.handR[1]) / 2, sz2 = (w.handL[2] + w.handR[2]) / 2;
  const Sv = grp(gp, sx2, sy2 - 0.012, sz2, 0, 0.6);
  plathe(Sv, [[0.07, 0], [0.072, 0], [0.072, 0.028], [0.066, 0.028], [0.066, 0.004], [0, 0.004], [0, 0.002], [0.066, 0.002]], '#a8885a', (px, py, pz) => (py < 0.005 ? ((Math.floor(px * 300) + Math.floor(pz * 300)) % 2 ? '#7e6a48' : '#d8d0bc') : null), 0, 0, 0, 28);
  for (let i = 0; i < 5; i++) dot(gp, '#e6e0d2', sx2 + Math.cos(i) * 0.02, sy2 - 0.025 - i * 0.012, sz2 + Math.sin(i) * 0.02, 0.0025, 4);
  fuse(gp);
};

// ---------------------------------------------------------------------------------------------------------
// BUDDHIST TEMPLE VEGETARIAN MEAL (寺院素斋, Liang) — after Emperor Wu's 《断酒肉文》 (518): before a timber hall
// on a stone terrace, shaven monks in dark 缁衣 with brown kasaya kneel at long low tables, each with an alms bowl (钵)
// of rice, greens and mushrooms; a novice ladles rice from a big iron pot with a wooden lid; a bronze 犍稚 bell hangs
// from a frame to call the meal.
// ---------------------------------------------------------------------------------------------------------
const ZI = '#36322e', KASAYA = '#6e4a30';
function meal(p: THREE.Object3D, x: number, y: number, z: number): void {
  const b = grp(p, x, y, z);
  vessel(b, [[0.008, 0], [0.016, 0.008], [0.018, 0.014], [0.016, 0.017]], 0.002, '#2e2a26', null, -0.012, 0, 0, 14, 0.4);
  heap(b, -0.012, 0.013, 0, 0.015, 0.006, '#e8e2d2');
  const pp = plate(b, 0.016, 0, -0.006, 0.012, null, '#8a8274');
  for (let i = 0; i < 3; i++) el(b, '#4e6a36', 0.016 + Math.cos(i * 2) * 0.004, pp + 0.002, -0.006 + Math.sin(i * 2) * 0.004, 0.006, 0.002, 0.003, i);
  const p2 = plate(b, 0.016, 0, 0.016, 0.011, null, '#8a8274');
  add(b, DOME(), mat('#5e4430', { flat: false }), 0.014, p2, 0.016, 0.006, 0.004, 0.006);
  rod(b, [-0.03, 0.002, 0.018], [-0.004, 0.002, 0.024], 0.003, '#a88a5a', 3);
}
const lf_vegetarian: Builder = gp => {
  // ref: 梁武帝《断酒肉文》; 缁衣 and 袈裟 after the 龙门/麦积山 monk figures; 过堂 refectory practice (《敕修百丈清规》, later codified)
  base(gp, tiles(SITE.paving, 0.08));
  // timber hall behind on a stone terrace
  rbox(gp, '#a8a49a', 0, Y, -0.33, 0.56, 0.03, 0.14, 0.004);
  hall(gp, 0, Y + 0.03, -0.34, 0.46, 0.1, 0.13, '#4a4a4c', 0, '#8a4a36', { col: '#6e3226', band: '#4e5a50' });
  box(gp, '#2a2420', 0, Y + 0.13, -0.285, 0.07, 0.022, 0.004);
  // two long low tables with kneeling monks behind each
  for (const [tz, mz] of [[-0.12, -0.2], [0.13, 0.05]] as const) {
    const ty = table(gp, -0.06, Y, tz, 0.5, 0.07, 0.05, '#4a2e1c');
    for (let i = 0; i < 3; i++) {
      const x = -0.24 + i * 0.18;
      meal(gp, x + 0.01, ty, tz);
      const mk = seiza(gp, x, mz, { h: 0.31, top: ZI, bottom: ZI, dress: 'ankle', hair: null, skin: '#d0a07a', lean: 0.08,
        hands: [[-0.05, 0.4, 0.2], [0.05, 0.4, 0.2]] });
      const [kx, ky, kz] = mk.head;
      sweep(gp, [{ p: [kx - 0.024, ky - 0.035, kz + 0.008], w: 0.012, h: 0.004 }, { p: [kx + 0.004, ky - 0.075, kz + 0.022], w: 0.016, h: 0.005 }, { p: [kx + 0.03, ky - 0.11, kz + 0.02], w: 0.014, h: 0.004 }], KASAYA, { radial: 6, sub: 3 });
    }
  }
  // big iron rice pot on a clay stand, novice ladling
  const P = grp(gp, 0.3, Y, 0.22, 0, 0.7);
  plathe(P, [[0, 0], [0.09, 0], [0.1, 0.05], [0.09, 0.06], [0, 0.06]], '#7a6a5a', null, 0, 0, 0, 22);
  vessel(P, dense([[0.08, 0.06], [0.11, 0.09], [0.115, 0.15], [0.12, 0.16]], 0.01), 0.006, '#3a3634', null, 0, 0, 0, 30, 0.4, 0.4);
  heap(P, 0, 0.14, 0, 0.11, 0.025, '#e8e2d2');
  plathe(P, [[0, 0.04], [0.12, 0.0], [0.12, -0.008], [0, 0.03]], '#7a5e3e', (px, _py, pz) => (Math.abs(px) < 0.004 || Math.abs(pz) < 0.004 ? '#5a4228' : null), -0.06, 0.2, -0.14, 26).rotation.x = -1.2;
  steam(P, 0.0, 0.17, 0.0, 0.026, 6, '#f5f5f2', 0.28);
  const nv = who(gp, 0.33, Y, 0.0, { h: 0.29, ry: -0.2, pose: 'stand', lean: 0.2, top: ZI, bottom: ZI, dress: 'ankle', hair: null, skin: '#d0a07a',
    hands: [[-0.05, 0.55, 0.3], [0.04, 0.62, 0.36]] });
  const [lx, ly, lz] = nv.handR;
  rod(gp, [lx, ly, lz], [0.3, Y + 0.12, 0.22], 0.003, '#7a5e3e', 4);
  vessel(grp(gp, 0.3, Y + 0.108, 0.22), [[0.006, 0], [0.013, 0.007], [0.015, 0.01]], 0.0015, '#7a5e3e', null, 0, 0, 0, 12);
  // bronze bell hanging in a wooden frame to call the meal
  const F = grp(gp, -0.34, Y, 0.24);
  for (const sx of [-1, 1]) rod(F, [sx * 0.04, 0, 0], [sx * 0.04, 0.16, 0], 0.005, '#3e2a1c', 5);
  rod(F, [-0.05, 0.16, 0], [0.05, 0.16, 0], 0.005, '#3e2a1c', 5);
  plathe(F, [[0, 0.155], [0.008, 0.15], [0.014, 0.13], [0.018, 0.1], [0.02, 0.09], [0, 0.092]], BRZ, (_x, y) => (Math.abs(y - 0.12) < 0.003 ? BRZD : null), 0, 0, 0, 16, 0.45, 0.45);
  fuse(gp);
};

export const H_LIFE_FOOD: Record<string, Builder> = {
  lf_forage, lf_pottery, lf_rice, lf_wine, lf_cauldron, lf_zongzi,
  lf_tofu, lf_jiaozi, lf_mantou, lf_noodles, lf_hubing, lf_tea, lf_dongpo, lf_tangyuan, lf_hotpot, lf_duck,
  lf_feast, lf_bazhen, lf_salt, lf_mill, lf_vegetarian,
};
