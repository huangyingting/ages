import * as THREE from 'three';
import type { Builder, MatOpts, Paint, V3 } from '../prims.ts';
import { g, add, mat, box, cyl, rbox, rod, sweep, slab, lathe, gable, tree, paintFaces, shade, mix, fbm, hash3, PLINTH_SIDE } from '../prims.ts';
import { sstep } from '../nature.ts';
import { human, type HumanOpts, type HumanPose } from '../human.ts';

// Archaeological dig dioramas (keys ar_*): each find sits in its excavation — a terraced ground disc (radius 0.5)
// with cut pits whose sides show the soil layers, grid strings, tools, tents and tiny archaeologists for scale.
// The artefact itself is deliberately enlarged so it reads at globe size. Front is +z, base at y=0.

// ---- local helpers -------------------------------------------------------------------------------------
const LO = (s = 8) => g('ar:sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(5, Math.round(s * 0.7))));
/** Cheap smooth ellipsoid with semi-axes (rx, ry, rz). */
function blob(p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0, s = 8, o: MatOpts = {}): THREE.Mesh {
  return add(p, LO(s), mat(c, { flat: false, ...o }), x, y, z, rx, ry, rz, roty, rotx, rotz);
}
function grp(p: THREE.Object3D, x = 0, y = 0, z = 0, ry = 0, s = 1): THREE.Group {
  const q = new THREE.Group(); q.position.set(x, y, z); q.rotation.y = ry; q.scale.setScalar(s); p.add(q); return q;
}
const GOLD = '#d9a93a';
const gold = (c = GOLD) => mat(c, { metal: 0.65, rough: 0.32, flat: false });

/** Triangle soup with per-face colours; `want` orients each face's normal along that direction. */
class Mesher {
  pos: number[] = [];
  col: number[] = [];
  private c = new THREE.Color();
  private cache = new Map<string, [number, number, number]>();
  tri(a: V3, b: V3, d: V3, color: string, want?: V3): void {
    let q1 = b, q2 = d;
    if (want) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { q1 = d; q2 = b; }
    }
    let k = this.cache.get(color);
    if (!k) { this.c.set(color); k = [this.c.r, this.c.g, this.c.b]; this.cache.set(color, k); }
    for (const q of [a, q1, q2]) { this.pos.push(q[0], q[1], q[2]); this.col.push(k[0], k[1], k[2]); }
  }
  quad(a: V3, b: V3, d: V3, e: V3, color: string, want?: V3): void { this.tri(a, b, d, color, want); this.tri(a, d, e, color, want); }
  build(p: THREE.Object3D, o: MatOpts = {}): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeVertexNormals();
    return add(p, geo, mat('#ffffff', { vc: true, rough: 0.9, ...o }), 0, 0, 0, 1, 1, 1);
  }
}

type H2 = (x: number, z: number) => number;
/** One terrace of the dig ground: cells whose centre passes `in` take height `h` and colour `c`. */
interface Lvl { in?: (x: number, z: number) => boolean; h: H2; c: (x: number, y: number, z: number) => string }
const rect = (x0: number, x1: number, z0: number, z1: number) => (x: number, z: number) => x > x0 && x < x1 && z > z0 && z < z1;
/** Soil-layer colouring for cut faces: bands by height, wobbling with noise so the layers look natural. */
const strata = (pal: string[], k = 70) => (x: number, y: number, z: number) => {
  const v = y * k + (fbm(x * 14, y * 4, z * 14) - 0.5) * 2.2;
  const c = pal[((Math.floor(v) % pal.length) + pal.length) % pal.length];
  return hash3(Math.floor(x * 260), Math.floor(y * 260), Math.floor(z * 260)) > 0.93 ? shade(c, 0.82) : c;
};

/**
 * Terraced dig ground on a square grid clipped to a disc: every cell belongs to the last level that contains it,
 * and vertical faces are cut wherever neighbouring levels differ (pit sides, steps), painted with `wall` so the soil
 * layers line up; the outer rim is the shared walnut plinth side (PLINTH_SIDE). Returns the surface height function.
 */
function ground(p: THREE.Object3D, levels: Lvl[], wall: (x: number, y: number, z: number) => string, N = 60, R = 0.5, maxBands = 12): H2 {
  const cs = (2 * R) / N, vx = (i: number) => -R + i * cs;
  const inside = (i: number, j: number) => Math.hypot(vx(i), vx(j)) <= R + 1e-9;
  const P = (i: number, j: number): [number, number] => { const x = vx(i), z = vx(j), r = Math.hypot(x, z); return r > R ? [(x * R) / r, (z * R) / r] : [x, z]; };
  const incl = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && (inside(i, j) || inside(i + 1, j) || inside(i, j + 1) || inside(i + 1, j + 1));
  const lv = new Int16Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cx = vx(i) + cs / 2, cz = vx(j) + cs / 2;
    let L = 0;
    for (let k = 1; k < levels.length; k++) if (levels[k].in?.(cx, cz)) L = k;
    lv[i * N + j] = L;
  }
  const m = new Mesher();
  const Y: V3 = [0, 1, 0];
  const NV = (N + 1) * (N + 1), hc = new Float32Array(NV * levels.length).fill(NaN);
  const H = (L: number, i: number, j: number, x: number, z: number) => {
    const k = L * NV + i * (N + 1) + j;
    let h = hc[k];
    if (h !== h) h = hc[k] = levels[L].h(x, z);
    return h;
  };
  const corner: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const face = (A: [number, number], B: [number, number], tA: number, tB: number, bA: number, bB: number, want: V3, band = 0.0075, col = wall) => {
    const k = Math.min(maxBands, Math.max(1, Math.ceil(Math.max(tA - bA, tB - bB) / band)));
    for (let s = 0; s < k; s++) {
      const a0 = tA - ((tA - bA) * s) / k, a1 = tA - ((tA - bA) * (s + 1)) / k, b0 = tB - ((tB - bB) * s) / k, b1 = tB - ((tB - bB) * (s + 1)) / k;
      m.quad([A[0], a0, A[1]], [B[0], b0, B[1]], [B[0], b1, B[1]], [A[0], a1, A[1]], col((A[0] + B[0]) / 2, (a0 + a1 + b0 + b1) / 4, (A[1] + B[1]) / 2), want);
    }
  };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (!incl(i, j)) continue;
    const li = lv[i * N + j], L = levels[li];
    const c = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
    const v = c.map(([x, z], q) => [x, H(li, i + corner[q][0], j + corner[q][1], x, z), z] as V3);
    const ce = (a: V3, b: V3, d: V3) => L.c((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3);
    m.tri(v[0], v[1], v[2], ce(v[0], v[1], v[2]), Y);
    m.tri(v[0], v[2], v[3], ce(v[0], v[2], v[3]), Y);
    const cx = vx(i) + cs / 2, cz = vx(j) + cs / 2;
    const edges: [number, number, number, number][] = [[0, 1, i, j - 1], [1, 2, i + 1, j], [2, 3, i, j + 1], [3, 0, i - 1, j]];
    for (const [a, b, ni, nj] of edges) {
      const A = c[a], B = c[b];
      if (!incl(ni, nj)) {
        const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
        face(A, B, v[a][1], v[b][1], 0, 0, [mx, 0, mz], 1, () => PLINTH_SIDE);
        continue;
      }
      const L2 = lv[ni * N + nj];
      if (L2 === lv[i * N + j]) continue;
      const bA = H(L2, i + corner[a][0], j + corner[a][1], A[0], A[1]), bB = H(L2, i + corner[b][0], j + corner[b][1], B[0], B[1]);
      if (v[a][1] + v[b][1] <= bA + bB) continue;
      face(A, B, v[a][1], v[b][1], bA, bB, [vx(ni) + cs / 2 - cx, 0, vx(nj) + cs / 2 - cz]);
    }
  }
  m.build(p, { flat: true });
  return (x, z) => {
    const i = Math.min(N - 1, Math.max(0, Math.floor((x + R) / cs))), j = Math.min(N - 1, Math.max(0, Math.floor((z + R) / cs)));
    return levels[lv[i * N + j]].h(x, z);
  };
}

/** String grid over a trench (x0..x1, z0..z1) at height y, with stakes along the rim. */
function strings(p: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, y: number, step: number, c = '#e2ddd0'): void {
  for (let x = x0 + step; x < x1 - step * 0.4; x += step) { box(p, c, x, y, (z0 + z1) / 2, 0.0026, 0.0026, z1 - z0); box(p, '#a0603e', x, y - 0.012, z0 - 0.004, 0.0035, 0.016, 0.0035); box(p, '#a0603e', x, y - 0.012, z1 + 0.004, 0.0035, 0.016, 0.0035); }
  for (let z = z0 + step; z < z1 - step * 0.4; z += step) { box(p, c, (x0 + x1) / 2, y, z, x1 - x0, 0.0026, 0.0026); box(p, '#a0603e', x0 - 0.004, y - 0.012, z, 0.0035, 0.016, 0.0035); box(p, '#a0603e', x1 + 0.004, y - 0.012, z, 0.0035, 0.016, 0.0035); }
}

type Pose = 'stand' | 'kneel' | 'bend' | 'carry' | 'point';
/** Tiny archaeologist (~0.065 tall) facing local +z: sun hat, shirt, trousers; pose decides the limbs. */

/** Simple canvas field tent / sunshade on 4 poles. */
function tent(p: THREE.Object3D, x: number, y: number, z: number, ry: number, w: number, d: number, h: number, c: string): void {
  const q = grp(p, x, y, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(q, [sx * w * 0.46, 0, sz * d * 0.46], [sx * w * 0.46, h, sz * d * 0.46], 0.0018, '#6b5b4b', 4);
  gable(q, w, h * 0.32, d, c, 0, h, 0);
  box(q, shade(c, 0.9), 0, h - 0.012, -d * 0.48, w, 0.012, 0.002);
}
function bucket(p: THREE.Object3D, x: number, y: number, z: number, c = '#4a6280', s = 1): void {
  lathe(p, [[0.0001, 0], [0.0062 * s, 0], [0.0082 * s, 0.013 * s], [0.0074 * s, 0.013 * s], [0.0001, 0.003 * s]], c, x, y, z, 10);
}
function wheelbarrow(p: THREE.Object3D, x: number, y: number, z: number, ry: number, c = '#5a7a50', load?: string): void {
  const q = grp(p, x, y, z, ry);
  add(q, CYLX(), mat('#1f2937'), 0, 0.009, 0.03, 0.018, 0.005, 0.018, 0, 0, Math.PI / 2);
  const t = add(q, g('ar:tray', () => trayGeo()), mat(c), 0, 0.013, 0.004, 1, 1, 1);
  t.castShadow = true;
  if (load) blob(q, load, 0, 0.026, 0.002, 0.016, 0.006, 0.02, 0, 0, 0, 7);
  for (const sx of [-1, 1]) {
    rod(q, [sx * 0.008, 0.012, 0.03], [sx * 0.012, 0.024, -0.035], 0.0016, '#4b5563', 4);
    rod(q, [sx * 0.009, 0.014, -0.012], [sx * 0.01, 0, -0.016], 0.0014, '#4b5563', 4);
  }
}
const CYLX = () => g('ar:cyl12', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
function trayGeo(): THREE.BufferGeometry {
  const lg = new THREE.CylinderGeometry(0.02, 0.012, 0.016, 4, 1, true);
  lg.rotateY(Math.PI / 4); lg.scale(0.9, 1, 1.3); lg.translate(0, 0.008, 0);
  const bt = new THREE.BoxGeometry(0.017, 0.001, 0.022); bt.translate(0, 0, 0);
  const mg = new THREE.BufferGeometry();
  const a = lg.toNonIndexed(), b = bt.toNonIndexed();
  const pa = [...(a.getAttribute('position').array as Float32Array), ...(b.getAttribute('position').array as Float32Array)];
  mg.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
  mg.computeVertexNormals();
  return mg;
}
function shovel(p: THREE.Object3D, x: number, y: number, z: number, ry: number, lean = 0.35): void {
  const q = grp(p, x, y, z, ry);
  q.rotation.z = lean;
  rod(q, [0, 0.012, 0], [0, 0.065, 0], 0.0015, '#8b6a45', 4);
  box(q, '#6b7280', 0, 0, 0, 0.009, 0.013, 0.0015);
  box(q, '#3f3f46', 0, 0.064, 0, 0.007, 0.0025, 0.0025);
}
function ladder(p: THREE.Object3D, a: V3, b: V3, w = 0.016, c = '#9a7b55'): void {
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, px = (-dz / L) * w / 2, pz = (dx / L) * w / 2;
  rod(p, [a[0] + px, a[1], a[2] + pz], [b[0] + px, b[1], b[2] + pz], 0.0013, c, 4);
  rod(p, [a[0] - px, a[1], a[2] - pz], [b[0] - px, b[1], b[2] - pz], 0.0013, c, 4);
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.012));
  for (let i = 1; i < n; i++) {
    const t = i / n, cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t, cz = a[2] + (b[2] - a[2]) * t;
    rod(p, [cx + px, cy, cz + pz], [cx - px, cy, cz - pz], 0.001, c, 4);
  }
}
function crate(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, c = '#a8835a'): void {
  rbox(p, c, x, y, z, s, s * 0.7, s * 0.8, 0.002, ry);
  const q = grp(p, x, y, z, ry);
  for (const f of [-1, 1]) box(q, shade(c, 0.8), 0, s * 0.25, f * s * 0.401, s * 1.0, s * 0.06, s * 0.004);
}
/** Field sieve: mesh frame on splayed legs. */
function sieve(p: THREE.Object3D, x: number, y: number, z: number, ry: number): void {
  const q = grp(p, x, y, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(q, [sx * 0.012, 0.024, sz * 0.008], [sx * 0.017, 0, sz * 0.012], 0.0012, '#7c5a3a', 4);
  rbox(q, '#8a6a48', 0, 0.022, 0, 0.032, 0.005, 0.022, 0.001);
  box(q, '#55524c', 0, 0.0255, 0, 0.028, 0.0008, 0.018);
}
/** Finds tray with little sherds. */
function finds(p: THREE.Object3D, x: number, y: number, z: number, ry: number, cols: string[]): void {
  const q = grp(p, x, y, z, ry);
  box(q, '#e9e4d6', 0, 0, 0, 0.03, 0.004, 0.02);
  for (let i = 0; i < 6; i++) box(q, cols[i % cols.length], -0.01 + (i % 3) * 0.01, 0.004, -0.005 + Math.floor(i / 3) * 0.01, 0.006, 0.0015, 0.005, hash3(i, 2, 3) * 3);
}
type Pt = [number, number];
/** Closed Catmull-Rom smoothing of a control polygon with `k` samples per edge (cheaper than slab's own ×6). */
function smooth(o: Pt[], k = 2): Pt[] {
  const n = o.length, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = o[(i - 1 + n) % n], p1 = o[i], p2 = o[(i + 1) % n], p3 = o[(i + 2) % n];
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

// =========================================================================================================
// Sanxingdui: sacrificial pits with crossing elephant tusks and the giant protruding-eye bronze mask
// =========================================================================================================

/** Properly proportioned (≈7-head) excavator for the Chinese digs, ~1.7 m at the 1:28 dig scale (h 0.06). */
function digger(p: THREE.Object3D, x: number, y: number, z: number, ry: number, pose: Pose | HumanPose, top: string, o: Partial<HumanOpts> = {}): void {
  const hp = pose === 'bend' ? 'crouch' : pose;
  human(p, x, y, z, { h: 0.06, ry, pose: hp, top, bottom: '#4a4740', hair: '#1c1814', skin: '#c48e64', shoes: '#2a2420', detail: 'lo', ...o });
}
/** Broadleaf tree — the shared atlas tree so every diorama reads alike. */
function broadleaf(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#46603a'): void {
  tree(p, x, y, z, s * 0.9, c);
}

const BRONZE = '#5f6a52';
const patina = (x: number, y: number, z: number) => {
  const v = fbm(x * 9 + 3, y * 9, z * 9);
  return v > 0.64 ? '#7f8a6a' : v > 0.52 ? '#6a7a5e' : v < 0.3 ? '#4a4e40' : v < 0.36 ? '#6a5a42' : null;
};
/** The great protruding-eye bronze mask (unit ≈ 1.1 wide incl. ears, front +z). */
function sanxMask(p: THREE.Object3D, x: number, y: number, z: number, S: number, tilt: number): void {
  const q = grp(p, x, y, z, 0, S);
  q.rotation.x = -tilt;
  const o = { metal: 0.45, rough: 0.55 };
  const pm = mat('#ffffff', { ...o, vc: true, flat: true });
  const face = slab(q, [[-0.32, 0.44], [0.32, 0.44], [0.33, 0.2], [0.27, 0.05], [0.15, 0.0], [-0.15, 0.0], [-0.27, 0.05], [-0.33, 0.2]], 0.2, BRONZE, 0.02, false);
  face.geometry = paintFaces(face.geometry, BRONZE, patina); face.material = pm;
  box(q, '#2b2f24', 0, 0.37, 0.1, 0.05, 0.05, 0.012);
  for (const sx of [-1, 1]) {
    // Ears: huge flared fins with a spiral inside
    const ear = slab(q, [[0, 0.0], [0.1, -0.06], [0.24, 0.0], [0.34, 0.14], [0.4, 0.4], [0.26, 0.32], [0.12, 0.3], [0.03, 0.22]], 0.035, '#66705a', 0, false);
    ear.geometry = paintFaces(ear.geometry, '#66705a', patina); ear.material = pm;
    ear.scale.set(sx, 1, 1); ear.position.set(sx * 0.3, 0.08, 0.0); ear.rotation.y = sx * 0.25;
    const curl = slab(q, smooth([[0.06, 0.06], [0.16, 0.03], [0.25, 0.13], [0.23, 0.27], [0.12, 0.22]]), 0.045, '#4c5442', 0, false);
    curl.material = mat('#4c5442', o);
    curl.scale.set(sx, 1, 1); curl.position.set(sx * 0.31, 0.08, 0.01); curl.rotation.y = sx * 0.25;
    // Almond eye sockets with the cylinder pupils thrusting forward
    blob(q, '#545e48', sx * 0.15, 0.29, 0.1, 0.13, 0.04, 0.03, 0, 0, sx * 0.22, 10, o);
    add(q, CYLX(), mat('#6e7a5e', { ...o, flat: false }), sx * 0.15, 0.29, 0.2, 0.09, 0.22, 0.09, 0, Math.PI / 2).castShadow = true;
    add(q, CYLX(), mat('#76805f', o), sx * 0.15, 0.29, 0.305, 0.115, 0.02, 0.115, 0, Math.PI / 2);
    blob(q, '#4f4a3a', sx * 0.15, 0.29, 0.316, 0.03, 0.03, 0.006);
    // Slanted brows
    rod(q, [sx * 0.035, 0.37, 0.105], [sx * 0.29, 0.415, 0.1], 0.02, '#4a5040', 5);
  }
  // Hooked nose, wide smiling mouth
  sweep(q, [{ p: [0, 0.34, 0.1], w: 0.03, h: 0.03 }, { p: [0, 0.24, 0.15], w: 0.05, h: 0.045 }, { p: [0, 0.16, 0.135], w: 0.08, h: 0.035 }], '#66705a', { radial: 8, sub: 3 });
  const mouth: V3[] = [];
  for (let i = 0; i <= 8; i++) { const t = -1 + i / 4; mouth.push([t * 0.25, 0.075 + 0.012 * t * t * t * t, 0.105 + 0.008 * (1 - t * t)]); }
  for (let i = 0; i < mouth.length - 1; i++) rod(q, mouth[i], mouth[i + 1], 0.012, '#383c30', 5);
}

const sanxingdui: Builder = gp => {
  // Ref: Sanxingdui pits K3–K8 (Guanghan, Sichuan; late Shang, c.1100 BC), 2020–22 dig: glass climate cabins, white-suited
  // excavators on platforms over pits packed with ivory tusks above bronzes; protruding-eye mask K2②:148 (1.38 m wide, patinated bronze).
  const top = 0.075, fl = 0.018;
  const P1 = rect(-0.24, 0.24, -0.2, 0.12), P2 = rect(0.15, 0.33, 0.19, 0.33), P3 = rect(-0.38, -0.2, 0.18, 0.32);
  const soil = (x: number, _y: number, z: number) => (hash3(Math.floor(x * 80), 5, Math.floor(z * 80)) > 0.9 ? '#5a4a3a' : mix('#6b5a48', '#4a3e33', fbm(x * 20, 1, z * 20)));
  const gy = ground(gp, [
    { h: (x, z) => top + 0.003 * fbm(x * 18, 0, z * 18), c: (x, _y, z) => (hash3(Math.floor(x * 80), 1, Math.floor(z * 80)) > 0.92 ? '#7a8052' : mix('#9c8462', '#a8916f', fbm(x * 9, 0, z * 9))) },
    { in: rect(-0.26, 0.26, -0.22, 0.14), h: () => top - 0.02, c: () => '#8e7656' },
    { in: P1, h: () => fl, c: soil },
    { in: P2, h: () => 0.03, c: soil },
    { in: P3, h: () => 0.035, c: soil },
  ], strata(['#b38a58', '#9a774b', '#c8a26c', '#7d5f3f', '#a98457'], 90), 56);
  strings(gp, -0.24, 0.24, -0.2, 0.12, top + 0.012, 0.08);
  // Ivory tusks (1–1.5 m, aged yellow-brown) heaped in criss-crossing layers over the bronzes
  for (let i = 0; i < 46; i++) {
    const a = hash3(i, 1, 9) * Math.PI, cx = -0.2 + hash3(i, 2, 9) * 0.4, czz = -0.16 + hash3(i, 3, 9) * 0.24, L = 0.038 + hash3(i, 4, 9) * 0.018;
    if (Math.abs(cx + 0.02) < 0.075 && Math.abs(czz + 0.1) < 0.055) continue;
    const dx = Math.cos(a) * L / 2, dz = Math.sin(a) * L / 2, bend = (hash3(i, 5, 9) - 0.5) * 0.016, yy = fl + 0.003 + (i % 3) * 0.0025;
    sweep(gp, [{ p: [cx - dx, yy, czz - dz], w: 0.0034 }, { p: [cx - bend * Math.sin(a), yy + 0.002, czz + bend * Math.cos(a)], w: 0.003 }, { p: [cx + dx, yy, czz + dz], w: 0.0009 }], i % 3 ? '#cdbf9c' : '#b8a684', { radial: 6, sub: 3 });
  }
  // Scattered bronze fragments, jade blades and a bronze zun
  for (let i = 0; i < 16; i++) {
    const x = -0.2 + hash3(i, 6, 1) * 0.4, z = -0.16 + hash3(i, 7, 1) * 0.24, c = i % 4 ? BRONZE : '#7a8a72';
    box(gp, c, x, fl, z, 0.005 + hash3(i, 8, 1) * 0.008, 0.002, 0.004, hash3(i, 9, 1) * 3).material = mat(c, { metal: 0.35, rough: 0.65 });
  }
  lathe(gp, [[0.0001, 0], [0.006, 0], [0.007, 0.004], [0.004, 0.009], [0.005, 0.014], [0.01, 0.019], [0.0095, 0.02], [0.0001, 0.012]], BRONZE, 0.12, fl, -0.05, 9);
  // The protruding-eye mask lying face-up as found in the pit, the gold-foil bronze head and the gold mask nearby
  sanxMask(gp, -0.02, fl + 0.003, -0.105, 0.11, 0.95);
  const hd = grp(gp, -0.14, fl, 0.0, -0.5, 0.22);
  cyl(hd, BRONZE, 0, 0, 0, 0.018, 0.035, 10).material = mat(BRONZE, { metal: 0.45, rough: 0.55 });
  rbox(hd, BRONZE, 0, 0.032, 0, 0.044, 0.056, 0.042, 0.01).material = mat(BRONZE, { metal: 0.45, rough: 0.55 });
  cyl(hd, '#5d7150', 0, 0.086, 0, 0.024, 0.012, 12).material = mat('#5d7150', { metal: 0.45, rough: 0.55 });
  const gf = rbox(hd, '#c9a24a', 0, 0.036, 0.019, 0.042, 0.046, 0.008, 0.003); gf.material = gold('#c9a24a');
  for (const sx of [-1, 1]) {
    box(hd, '#2b2f24', sx * 0.011, 0.064, 0.0235, 0.015, 0.004, 0.002);
    slab(hd, [[0, 0], [0.012, -0.004], [0.016, 0.012], [0.01, 0.026], [0, 0.02]], 0.004, '#66705a', 0, false).position.set(sx * 0.02, 0.045, 0);
  }
  box(hd, '#b8923e', 0, 0.048, 0.0235, 0.006, 0.012, 0.004);
  box(hd, '#6b4a2a', 0, 0.042, 0.0235, 0.022, 0.0025, 0.002);
  const gm = grp(gp, 0.1, fl + 0.001, 0.02, -0.6, 0.16);
  const gmesh = slab(gm, [[-0.05, 0.06], [0.05, 0.06], [0.055, 0.0], [0.03, -0.045], [-0.03, -0.045], [-0.055, 0.0]], 0.004, '#cfa54a', 0, false);
  gmesh.material = gold('#cfa54a'); gmesh.rotation.x = -Math.PI / 2;
  for (const sx of [-1, 1]) box(gm, '#2b2a24', sx * 0.022, 0.003, -0.015, 0.024, 0.002, 0.008);
  // Plank bridge across the pit with archaeologists in white suits working from it
  const SUIT: Partial<HumanOpts> = { bottom: '#e2e2dc', hat: '#e2e2dc', hatStyle: 'hood', shoes: '#9aa0a2' };
  for (const sx of [-1, 1]) box(gp, '#6a6e70', sx * 0.25, top, 0.06, 0.02, 0.012, 0.03);
  box(gp, '#9a8c74', 0, top + 0.012, 0.06, 0.54, 0.004, 0.036);
  for (const sz of [-1, 1]) for (let x = -0.26; x <= 0.26; x += 0.065) box(gp, '#7a7e80', x, top + 0.016, 0.06 + sz * 0.017, 0.002, 0.03, 0.002);
  for (const sz of [-1, 1]) box(gp, '#7a7e80', 0, top + 0.044, 0.06 + sz * 0.017, 0.54, 0.002, 0.002);
  digger(gp, -0.06, top + 0.016, 0.06, Math.PI, 'kneel', '#e2e2dc', SUIT);
  digger(gp, 0.08, top + 0.016, 0.06, Math.PI + 0.3, 'kneel', '#e2e2dc', SUIT);
  digger(gp, 0.05, fl, -0.03, 2.4, 'bend', '#e2e2dc', SUIT);
  // Climate-controlled glass lab over a second pit
  const cab = grp(gp, 0.24, gy(0.24, 0.26), 0.26, 0, 0.76);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(cab, '#d4d6d4', sx * 0.135, 0, sz * 0.105, 0.006, 0.09, 0.006);
  for (const sz of [-1, 1]) box(cab, '#d4d6d4', 0, 0.09, sz * 0.105, 0.276, 0.006, 0.006);
  for (const sx of [-1, 1]) box(cab, '#d4d6d4', sx * 0.135, 0.09, 0, 0.006, 0.006, 0.216);
  const glass = mat('#c4d4d8', { transparent: 0.25 });
  box(cab, '#cbe7f2', 0, 0.093, 0, 0.27, 0.003, 0.21).material = glass;
  for (const sz of [-1, 1]) box(cab, '#cbe7f2', 0, 0, sz * 0.105, 0.27, 0.09, 0.002).material = glass;
  for (const sx of [-1, 1]) box(cab, '#cbe7f2', sx * 0.135, 0, 0, 0.002, 0.09, 0.21).material = glass;
  digger(gp, 0.21, 0.03, 0.25, 0.4, 'kneel', '#e2e2dc', SUIT);
  for (let i = 0; i < 6; i++) sweep(gp, [{ p: [0.19 + i * 0.022, 0.033, 0.24], w: 0.0032 }, { p: [0.2 + i * 0.022, 0.035, 0.265], w: 0.003 }, { p: [0.195 + i * 0.022, 0.033, 0.29], w: 0.0009 }], '#cdbf9c', { radial: 6, sub: 2 });
  // Third pit with sieving station; camp tent and finds tables
  sieve(gp, -0.3, 0.035, 0.23, 0.3);
  bucket(gp, -0.25, 0.035, 0.27, '#5c5f5c');
  digger(gp, -0.34, 0.035, 0.27, 0.6, 'bend', '#e2e2dc', SUIT);
  tent(gp, -0.26, gy(-0.26, -0.33), -0.32, 0.3, 0.14, 0.1, 0.065, '#cfccc0');
  finds(gp, -0.26, gy(-0.26, -0.33) + 0.025, -0.32, 0.3, [BRONZE, '#cdbf9c', '#b8923e']);
  box(gp, '#9a7b55', -0.26, gy(-0.26, -0.33), -0.32, 0.034, 0.025, 0.024, 0.3);
  tent(gp, 0.3, gy(0.3, -0.33), -0.31, -0.3, 0.13, 0.1, 0.07, '#cfccc0');
  crate(gp, 0.32, gy(0.32, -0.2), -0.2, 0.035, 0.2);
  wheelbarrow(gp, 0.38, gy(0.38, 0.0), 0.0, -1.2, '#56606a', '#8e7656');
  shovel(gp, 0.3, gy(0.3, 0.1), 0.1, 0.4);
  for (const [x, z] of [[-0.42, -0.1], [0.44, -0.18], [-0.38, -0.3]] as const) broadleaf(gp, x, gy(x, z), z, 0.07);
};

// =========================================================================================================
function bricks(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rows = 4, cols = 6): THREE.Mesh {
  const geo = g(`ar:brick${rows}:${cols}`, () => paintFaces(new THREE.BoxGeometry(1, 1, 1, cols, rows, Math.max(1, Math.round(cols / 3))), '#ffffff', (px, py, pz, nx, ny, nz) => {
    const r = Math.floor((py + 0.5) * rows - 1e-4), u = Math.abs(nx) > 0.5 ? pz : px, k = Math.floor((u + 0.5) * cols + (r % 2) * 0.5);
    if (ny > 0.5) return hash3(Math.floor((px + 0.5) * cols), 7, Math.floor((pz + 0.5) * cols)) > 0.5 ? '#f2f2f2' : '#dcdcdc';
    const v = hash3(r, k, Math.round(nx * 3 + nz * 5));
    return v > 0.75 ? '#c8c8c8' : v > 0.4 ? '#e8e8e8' : '#ffffff';
  }));
  const m = add(p, geo, mat(c, { vc: true }), x, y + sy / 2, z, sx, sy, sz, ry);
  return m;
}

// =========================================================================================================
// Mawangdui: the Han tomb dug open in stepped terraces — the wooden 井 chamber with nested lacquer coffins
// =========================================================================================================

const mawangdui: Builder = gp => {
  // Ref: Mawangdui Tomb 1 (Changsha; W. Han, c.168 BC), 1972 dig: stepped loess shaft sealed with charcoal and white clay round a
  // 井-plan cypress chamber (6.7×4.9 m) with four side compartments; nested black-lacquer and vermilion painted coffins; T-shaped silk banner.
  const d0 = (x: number, z: number) => Math.hypot(x, z);
  const mound: H2 = (x, z) => 0.075 + 0.055 * sstep(0.5, 0.18, d0(x, z)) + 0.004 * fbm(x * 16, 0, z * 16);
  const tiers = [[0.31, 0.28, 0.22, 0.105], [0.25, 0.22, 0.16, 0.08], [0.19, 0.16, 0.1, 0.055]] as const;
  const lv: Lvl[] = [{ h: mound, c: (x, y, z) => (y > 0.1 ? mix('#6a7f48', '#77894e', fbm(x * 12, 0, z * 12)) : mix('#7a8a52', '#8e8a5e', fbm(x * 9, 1, z * 9))) }];
  for (const [w, zb, zf, hh] of tiers) lv.push({ in: rect(-w, w, -zb, zf), h: () => hh, c: (x, _y, z) => mix('#b8956a', '#a8865c', fbm(x * 20, 2, z * 20)) });
  lv.push({ in: rect(-0.15, 0.15, -0.13, 0.07), h: () => 0.025, c: () => '#3a3330' });
  lv.push({ in: rect(-0.045, 0.045, 0.07, 0.46), h: (_x, z) => 0.03 + Math.max(0, z - 0.07) * 0.27, c: (x, _y, z) => (hash3(Math.floor(x * 90), 3, Math.floor(z * 90)) > 0.8 ? '#a08060' : '#b0906a') });
  const loess = strata(['#b8956a', '#a8845a', '#c4a47a', '#9a7a56'], 80);
  const gy = ground(gp, lv, (x, y, z) => (Math.hypot(x, z) > 0.45 ? loess(x, y, z) : y < 0.032 ? (hash3(Math.floor(x * 200), Math.floor(y * 300), Math.floor(z * 200)) > 0.85 ? '#3d3d3d' : '#222') : y < 0.05 ? '#d8d4c8' : loess(x, y, z)), 56);
  // Wooden 井-shaped outer chamber: planked walls and dividers, four side compartments round the coffin
  const WD = '#4e3826', WL = '#6a4e36', fy = 0.025, cz = -0.03, CW = 0.13, CD = 0.095, CH = 0.045;
  box(gp, WL, 0, fy, cz, CW * 2, 0.004, CD * 2);
  for (const sz of [-1, 1]) bricks(gp, WD, 0, fy, cz + sz * CD, CW * 2 + 0.008, CH, 0.008, 0, 5, 1);
  for (const sx of [-1, 1]) bricks(gp, WD, sx * CW, fy, cz, 0.008, CH, CD * 2, 0, 5, 1);
  const ix = 0.078, iz0 = cz - 0.056, iz1 = cz + 0.056;
  for (const z of [iz0, iz1]) bricks(gp, WL, 0, fy, z, CW * 2, CH * 0.9, 0.006, 0, 5, 1);
  for (const sx of [-1, 1]) bricks(gp, WL, sx * ix, fy, cz, 0.006, CH * 0.9, CD * 2, 0, 5, 1);
  // Nested coffins: open black-lacquer outer coffin with cloud scrolls, red-lacquer coffin closed inside
  const cloud: Paint = (px, py, pz) => (Math.sin(px * 30 + Math.sin(py * 14 + pz * 16) * 2.4) > 0.86 ? '#a89a7a' : Math.sin(pz * 34 - py * 11 + px * 6) > 0.93 ? '#8a3a2a' : null);
  const lattice: Paint = (px, py, pz, _nx, ny) => {
    const f = (v: number) => Math.abs((((v % 1) + 1) % 1) - 0.5) < 0.1;
    if (ny > 0.5) return Math.abs(px) > 0.42 || Math.abs(pz) > 0.4 ? '#4a3a2c' : f(px * 4) && Math.abs(pz) < 0.2 ? '#8e3a28' : null;
    return py > 0.36 ? '#4a3a2c' : f(px * 6 + py * 2) && py < 0.2 ? '#8e3a28' : null;
  };
  const cbox = (key: string, c: string, pnt: Paint, x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    add(gp, g('ar:coff:' + key, () => paintFaces(new THREE.BoxGeometry(1, 1, 1, 10, 4, 6), c, pnt)), mat('#ffffff', { vc: true }), x, y + sy / 2, z, sx, sy, sz);
  const ox = 0.07, oz = 0.05, oh = 0.036;
  cbox('blk', '#1a1816', cloud, 0, fy, cz, ox * 2, 0.004, oz * 2);
  for (const sz of [-1, 1]) cbox('blk', '#1a1816', cloud, 0, fy, cz + sz * oz, ox * 2, oh, 0.004);
  for (const sx of [-1, 1]) cbox('blk', '#1a1816', cloud, sx * ox, fy, cz, 0.004, oh, oz * 2);
  cbox('red', '#7e2a1e', lattice, 0, fy + 0.004, cz, 0.116, 0.03, 0.076);
  rbox(gp, '#1f1a17', 0.02, 0.055, 0.084, 0.13, 0.005, 0.026, 0.002);
  // Grave goods in the side compartments: lacquer ear-cups and boxes, figurines, bamboo cases, silk bundles
  const comp: [number, number, number, number][] = [[-CW + 0.006, -ix - 0.004, cz - CD + 0.006, cz + CD - 0.006], [ix + 0.004, CW - 0.006, cz - CD + 0.006, cz + CD - 0.006], [-ix + 0.004, ix - 0.004, cz - CD + 0.006, iz0 - 0.004], [-ix + 0.004, ix - 0.004, iz1 + 0.004, cz + CD - 0.006]];
  let n = 0;
  for (const [x0, x1, z0, z1] of comp) for (let k = 0; k < 9; k++, n++) {
    const x = x0 + (x1 - x0) * hash3(n, 1, 4), z = z0 + (z1 - z0) * hash3(n, 2, 4), t = hash3(n, 3, 4);
    if (t < 0.35) { blob(gp, '#7e2a1e', x, fy + 0.004, z, 0.008, 0.004, 0.006, t * 9, 0, 0, 7); blob(gp, '#1a1a1a', x, fy + 0.0075, z, 0.0055, 0.001, 0.004, t * 9, 0, 0, 6); }
    else if (t < 0.55) lathe(gp, [[0.0001, 0], [0.008, 0], [0.009, 0.008], [0.0001, 0.009]], t < 0.45 ? '#1a1a1a' : '#7e2a1e', x, fy + 0.004, z, 8);
    else if (t < 0.72) { cyl(gp, '#8a6a4a', x, fy + 0.004, z, 0.0035, 0.018, 6); blob(gp, '#b89a78', x, fy + 0.025, z, 0.0035); cyl(gp, '#1a1a1a', x, fy + 0.028, z, 0.0036, 0.002, 6); }
    else if (t < 0.86) box(gp, '#9a7a4e', x, fy + 0.004, z, 0.016, 0.01, 0.01, t * 5);
    else blob(gp, ['#a88a5e', '#6a4a4e', '#8e5a3e'][n % 3], x, fy + 0.008, z, 0.01, 0.005, 0.007, t * 7, 0, 0, 7);
  }
  // The T-shaped painted silk banner laid out on a table under an awning
  const tx = 0.3, tz = -0.3, ty = gy(tx, tz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(gp, [tx + sx * 0.045, ty, tz + sz * 0.03], [tx + sx * 0.045, ty + 0.03, tz + sz * 0.03], 0.002, '#6b4c35', 4);
  box(gp, '#8b6a45', tx, ty + 0.03, tz, 0.1, 0.004, 0.07);
  const ban = slab(gp, [[-0.035, 0.04], [0.035, 0.04], [0.035, 0.015], [0.016, 0.015], [0.016, -0.04], [-0.016, -0.04], [-0.016, 0.015], [-0.035, 0.015]], 0.002, '#8a6242', 0, false);
  ban.geometry = paintFaces(ban.geometry, '#8a6242', (px, py) => (py > 0.015 ? (Math.hypot(px - 0.022, py - 0.03) < 0.006 ? '#9a3a2a' : Math.hypot(px + 0.022, py - 0.028) < 0.005 ? '#c8bc98' : '#7a5a3c') : py > -0.01 ? (Math.abs(px) < 0.006 ? '#3a302a' : '#8e6444') : '#5a4232'));
  ban.material = mat('#ffffff', { vc: true }); ban.rotation.set(-Math.PI / 2, 0, -0.5); ban.position.set(tx, ty + 0.035, tz);
  tent(gp, tx, ty, tz, -0.5, 0.14, 0.11, 0.075, '#a89c80');
  // Diggers: carrying a find on a pole up the ramp, kneeling on the chamber, measuring on the terraces
  // 1972 crew: blue work jackets and white shirts, straw hats; a find slung from a carrying pole between two porters
  const STRAW: Partial<HumanOpts> = { hat: '#c8b48a', hatStyle: 'brim' };
  const sh = (h: number) => [[-0.125, 0.47, 0.015], [0.07, h, 0.07]] as [V3, V3];
  digger(gp, -0.004, gy(0, 0.2), 0.18, 0, 'walk', '#3d4f6a', { ...STRAW, hands: sh(0.9), bottom: '#3a3e44' });
  digger(gp, 0.004, gy(0, 0.3), 0.29, 0, 'walk', '#3d4f6a', { ...STRAW, hands: sh(0.9), bottom: '#3a3e44', phase: 0.5 });
  rod(gp, [0, gy(0, 0.2) + 0.051, 0.18], [0, gy(0, 0.3) + 0.051, 0.29], 0.0024, '#8b7a55', 4);
  for (const k of [0, 1]) rod(gp, [0, (gy(0, 0.2) + gy(0, 0.3)) / 2 + 0.05, 0.225 + k * 0.02], [0, (gy(0, 0.2) + gy(0, 0.3)) / 2 + 0.03, 0.229 + k * 0.012], 0.0016, '#6a5a40', 3);
  box(gp, '#8a6e4e', 0, (gy(0, 0.2) + gy(0, 0.3)) / 2 + 0.018, 0.235, 0.018, 0.012, 0.022);
  digger(gp, -0.1, fy + CH, cz + CD, Math.PI, 'kneel', '#d8d2c2', { ...STRAW, bottom: '#3a3e44' });
  digger(gp, 0.17, 0.055, -0.05, -1.6, 'bend', '#5b6455', STRAW);
  digger(gp, -0.22, 0.08, -0.17, 0.6, 'point', '#d8d2c2', { bottom: '#2f3540' });
  ladder(gp, [0.1, 0.025, 0.065], [0.1, 0.06, 0.1], 0.016);
  crate(gp, 0.28, gy(0.28, 0.24), 0.24, 0.04, 0.4, '#8e7454');
  crate(gp, 0.33, gy(0.33, 0.18), 0.18, 0.03, -0.2, '#8e7454');
  // Bamboo baskets and a shoulder pole for hauling spoil (no wheelbarrows on the 1972 dig)
  for (const sx of [-1, 1]) lathe(gp, [[0.0001, 0], [0.008, 0], [0.011, 0.012], [0.0105, 0.012], [0.0001, 0.002]], '#a08a5e', 0.14 + sx * 0.03, gy(0.14, 0.3), 0.3, 9);
  rod(gp, [0.1, gy(0.14, 0.3) + 0.004, 0.31], [0.18, gy(0.14, 0.3) + 0.004, 0.29], 0.0012, '#8b7a55', 4);
  shovel(gp, -0.12, gy(-0.12, 0.3), 0.3, 0.3);
  for (const [x, z, s] of [[-0.38, -0.2, 0.08], [0.42, -0.08, 0.075], [-0.32, 0.26, 0.07], [-0.1, -0.42, 0.07], [0.2, -0.4, 0.08], [-0.42, 0.06, 0.07], [0.42, 0.02, 0.07]] as const) broadleaf(gp, x, gy(x, z) - 0.004, z, s, '#40563a');
};
export const H_ARCHAEOLOGY: Record<string, Builder> = { ar_sanxingdui: sanxingdui, ar_mawangdui: mawangdui };
