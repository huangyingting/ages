import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, ellip, rod, strut, lathe, skin, slab, sweep, tube, tbox, gable,
  paintFaces, shade, mix, hash3, fbm, tree, PLINTH_SIDE,
} from '../prims.ts';
import { grp } from '../timber.ts';
import { human, type HumanOpts, type HumanRig } from '../human.ts';
import { horse } from '../animals.ts';

// Site-specific dioramas, part A (st_*): one model per historical subject — the Qin wall at Guyang, the Eastern Jin
// crossing of the Yangtze, a Japanese envoy ship, the Jokhang, Nalanda, Tōshōdaiji, a Khitan camp, the Western Xia
// tombs and the 868 Diamond Sutra. Front faces +z, base at y=0, footprint radius ≈0.45, height ≈0.3–0.5.

// ---------------------------------------------------------------------------------------------------------
// Shared kit

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pick = <T>(arr: T[], h: number): T => arr[Math.floor(h * arr.length) % arr.length];
const SKIN = '#c99a74', HAIR = '#1d1915', INK = '#1b1917';

const ICO = () => g('sa:ico', () => new THREE.IcosahedronGeometry(1, 1));
function blob(p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0): THREE.Mesh {
  return add(p, ICO(), mat(c), x, y, z, sx, sy, sz, ry);
}
/** Low-poly ellipsoid for small details (hats, bundles, fronds) — `ellip` picks its resolution from the unscaled radius. */
const LSPH = () => g('sa:lsph', () => new THREE.SphereGeometry(1, 10, 7));
function el(p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0): THREE.Mesh {
  return add(p, LSPH(), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx);
}
function anim(p: THREE.Object3D, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}

type HF = (x: number, z: number) => number;
/**
 * Round plinth whose top is a polar heightfield painted per face (ridges, banks, paddies, paving). `hf` is the height
 * above the plinth top `y0`; it fades out towards the rim. Returns the surface height function.
 */
function land(p: THREE.Object3D, R: number, y0: number, hf: HF, paint: Paint, _side: string, nr = 24, ns = 84): HF {
  lathe(p, [[0, 0], [R * 0.97, 0], [R, y0 * 0.18], [R, y0 * 0.7], [R * 0.985, y0 * 0.92], [R * 0.965, y0], [R * 0.95, y0 - 0.004], [0, y0 - 0.004]], PLINTH_SIDE, 0, 0, 0, 56);
  const Rt = R * 0.965;
  const Y = (x: number, z: number) => y0 + hf(x, z) * (1 - sstep(0.86, 1, Math.hypot(x, z) / Rt));
  const pos: number[] = [0, Y(0, 0), 0];
  for (let i = 1; i <= nr; i++) for (let j = 0; j < ns; j++) {
    const a = (j / ns) * TAU, r = (Rt * i) / nr, x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, Y(x, z), z);
  }
  const V = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * ns + (j % ns));
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    const ax = pos[a * 3], az = pos[a * 3 + 2], bx = pos[b * 3] - ax, bz = pos[b * 3 + 2] - az, cx = pos[c * 3] - ax, cz = pos[c * 3 + 2] - az;
    if (bz * cx - bx * cz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  for (let j = 0; j < ns; j++) tri(0, V(1, j), V(1, j + 1));
  for (let i = 1; i < nr; i++) for (let j = 0; j < ns; j++) {
    const a = V(i, j), b = V(i, j + 1), c = V(i + 1, j), d = V(i + 1, j + 1);
    tri(a, b, d); tri(a, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  add(p, paintFaces(geo, '#8a8a6a', paint), mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
  return Y;
}

/** Subdivided box with a per-face painter (brick courses, plaster, sails). Paint coords are local, y from 0..h. */
function pbox(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, h: number, d: number, paint: Paint, cell = 0.008, ry = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(h / cell)), Math.max(1, Math.round(d / cell)));
  geo.translate(0, h / 2, 0);
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y, z, 1, 1, 1, ry);
}

/** Rammed-earth (夯土) frustum with the tamping layers painted as horizontal bands; returns its top height. */
function earth(p: THREE.Object3D, x: number, y: number, z: number, w0: number, d0: number, w1: number, d1: number, h: number, c: string, layer = 0.007, ry = 0): number {
  const gr = grp(p, x, z, ry, y);
  const n = Math.max(2, Math.round(h / layer)), rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, hw = (w0 + (w1 - w0) * t) / 2, hd = (d0 + (d1 - d0) * t) / 2, yy = h * t;
    rings.push([[-hw, yy, -hd], [hw, yy, -hd], [hw, yy, hd], [-hw, yy, hd]]);
  }
  skin(gr, rings, c, {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      if (ny > 0.6) return shade(c, 1.06);
      const k = Math.floor(py / layer), n2 = fbm(px * 40, py * 12, pz * 40, 2);
      return shade(c, (k % 2 ? 0.96 : 0.99) + (n2 - 0.5) * 0.14 + (fbm(px * 90 + pz * 90, 0, 3, 2) - 0.5) * 0.06);
    },
  });
  return y + h;
}

/** Group holding a person in unit space (feet at 0, ~1 tall, facing +z) so props can be placed in figure units. */
function person(p: THREE.Object3D, x: number, y: number, z: number, h: number, ry: number, o: Partial<HumanOpts> & { top: string }): { G: THREE.Group; rig: HumanRig } {
  const G = grp(p, x, z, ry, y);
  G.scale.setScalar(h);
  const rig = human(G, 0, 0, 0, { h: 1, detail: 'lo', skin: SKIN, hair: HAIR, shoes: '#2a2420', ...o });
  return { G, rig };
}
/** Tang black gauze cap (幞头) with its two soft tails hanging behind; `hd` = rig.head (figure units). */
function futou(G: THREE.Object3D, hd: V3): void {
  const [x, y, z] = hd;
  el(G, INK, x, y + 0.026, z - 0.006, 0.074, 0.06, 0.078);
  el(G, INK, x, y + 0.075, z - 0.004, 0.05, 0.05, 0.055, 0, 0.35);
  for (const sx of [-1, 1]) el(G, INK, x + sx * 0.026, y - 0.03, z - 0.075, 0.016, 0.07, 0.01, 0, 0.25);
}
/** Khitan 髡发: shaved crown with a short fringe and two locks hanging at the temples (Liao tomb murals). */
function kunfa(G: THREE.Object3D, hd: V3): void {
  const [x, y, z] = hd;
  for (const sx of [-1, 1]) el(G, HAIR, x + sx * 0.058, y - 0.03, z, 0.016, 0.055, 0.02);
  el(G, HAIR, x, y + 0.048, z + 0.048, 0.024, 0.01, 0.014);
}
/** Eastern Jin gentleman's small black cap (小冠) over the topknot. */
function xiaoguan(G: THREE.Object3D, hd: V3): void {
  el(G, INK, hd[0], hd[1] + 0.06, hd[2] - 0.006, 0.03, 0.03, 0.04);
}
/** Eastern Jin lady's high chignon. */
function bun(G: THREE.Object3D, hd: V3): void {
  el(G, HAIR, hd[0], hd[1] + 0.095, hd[2] - 0.012, 0.03, 0.045, 0.028);
}

/** Spoked wheel standing in the local yz-plane (axle along x) at (x, y=hub height, z). */
function wheel(p: THREE.Object3D, x: number, y: number, z: number, r: number, c: string, spokes = 12, w = r * 0.12): void {
  add(p, g('sa:torus', () => new THREE.TorusGeometry(1, 0.075, 4, 24)), mat(c), x, y, z, r, r, w / 0.15, Math.PI / 2);
  add(p, CYLX(), mat(shade(c, 0.85)), x, y, z, r * 0.3, w * 1.8, r * 0.3, 0, 0, Math.PI / 2);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * TAU;
    rod(p, [x, y, z], [x, y + Math.sin(a) * r * 0.95, z + Math.cos(a) * r * 0.95], Math.max(0.0016, r * 0.045), c, 4);
  }
}
const CYLX = () => g('sa:cyl10', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10));

/** Ox (unit: ~1 tall at the poll, 1.5 long), facing +z; s scales it. */
function ox(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number, coat = '#6b4a30'): THREE.Group {
  const G = grp(p, x, z, ry, y);
  G.scale.setScalar(s);
  sweep(G, [
    { p: [0, 0.66, -0.66], w: 0.17, h: 0.2 }, { p: [0, 0.7, -0.4], w: 0.25, h: 0.27 }, { p: [0, 0.72, 0.0], w: 0.27, h: 0.29 },
    { p: [0, 0.76, 0.32], w: 0.25, h: 0.3 }, { p: [0, 0.74, 0.52], w: 0.17, h: 0.22 },
  ], coat, { radial: 10, sub: 3 });
  ellip(G, shade(coat, 0.95), 0, 0.88, 0.36, 0.11, 0.1, 0.16);
  ellip(G, shade(coat, 0.9), 0, 0.55, 0.5, 0.07, 0.14, 0.1);
  sweep(G, [{ p: [0, 0.76, 0.52], w: 0.13, h: 0.15 }, { p: [0, 0.7, 0.72], w: 0.1, h: 0.11 }, { p: [0, 0.58, 0.86], w: 0.075, h: 0.075 }], coat, { radial: 8, sub: 3 });
  ellip(G, shade(coat, 0.6), 0, 0.55, 0.9, 0.06, 0.05, 0.05);
  for (const sx of [-1, 1]) {
    tube(G, [[sx * 0.05, 0.76, 0.72], [sx * 0.15, 0.8, 0.7], [sx * 0.18, 0.88, 0.74]], 0.018, 0.008, '#cfc4a8');
    ellip(G, shade(coat, 0.85), sx * 0.085, 0.72, 0.7, 0.04, 0.018, 0.025);
    for (const fz of [-0.5, 0.36]) {
      tube(G, [[sx * 0.13, 0.6, fz], [sx * 0.12, 0.32, fz + 0.02], [sx * 0.12, 0.05, fz]], 0.055, 0.035, coat, { radial: 6, sub: 2 });
      ellip(G, '#2a2420', sx * 0.12, 0.03, fz + 0.015, 0.04, 0.03, 0.045);
    }
  }
  tube(G, [[0, 0.7, -0.66], [0, 0.45, -0.72], [0, 0.25, -0.7]], 0.018, 0.01, coat);
  return G;
}

/** Horse from animals.ts wrapped in a placed group; s = scale (horse ≈0.72 tall, 0.82 long at s = 1). */
function steed(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number, coat: string, mane: string, o: { stride?: number; saddle?: string; cloth?: string } = {}): THREE.Group {
  const G = grp(p, x, z, ry, y);
  G.scale.setScalar(s);
  horse(G, coat, mane, o);
  return G;
}

/** Half-cylinder shell along local x (boat awnings, felt cart canopies), visible from both sides; ribs painted. */
function vault(p: THREE.Object3D, x: number, y: number, z: number, L: number, W: number, H: number, c: string, rib: string, ry = 0, nRib = 5): void {
  const gr = grp(p, x, z, ry, y), rings: V3[][] = [], nx = 12, na = 9;
  for (let i = 0; i <= nx; i++) {
    const px = -L / 2 + (i / nx) * L, ring: V3[] = [];
    for (let j = 0; j <= na; j++) { const a = (j / na) * Math.PI; ring.push([px, Math.sin(a) * H, Math.cos(a) * W / 2]); }
    rings.push(ring);
  }
  const paint: Paint = px => { const u = ((px + L / 2) / L) * nRib; return Math.abs(u - Math.round(u)) < 0.12 ? rib : null; };
  skin(gr, rings, c, { closed: false, flat: true, paint });
  skin(gr, rings, shade(c, 0.7), { closed: false, flat: true, inward: true, paint: () => shade(c, 0.6) });
}

/** Clump of reeds: a few tall tapering blades with pale plumes. */
function reeds(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number): void {
  for (let i = 0; i < 9; i++) {
    const a = hash3(seed, i, 1) * TAU, r = hash3(seed, i, 2) * s * 0.4, h = s * (0.6 + hash3(seed, i, 3) * 0.5);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, lx = (hash3(seed, i, 4) - 0.5) * h * 0.5, lz = (hash3(seed, i, 5) - 0.5) * h * 0.5;
    strut(p, [px, y, pz], [px + lx, y + h, pz + lz], Math.max(0.003, s * 0.06), 0.0008, pick(['#6f7a45', '#7d8550', '#8f8e5c'], hash3(seed, i, 6)), 4);
    if (i % 3 === 0) el(p, '#a99d78', px + lx * 0.95, y + h * 0.95, pz + lz * 0.95, s * 0.035, s * 0.09, s * 0.035);
  }
}

/** Broadleaf tree — the shared atlas tree (seed kept for call compatibility). */
function broadTree(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, _seed: number, _trunk = '#5a4636'): void {
  tree(p, x, y, z, s * 0.55, c);
}

// ---------------------------------------------------------------------------------------------------------
// Hulls

interface HullO {
  L: number; W: number; H: number;
  /** rise of the gunwale at the ends (× u²), extra rise at the bow (× u³ for u > 0) */
  sheer: number; bowLift?: number;
  /** bottom rocker at the ends, end width fraction (transom) */
  rocker?: number; endW?: number;
  bulwark?: number; th?: number;
  paint: Paint; c?: string;
}
/** Flat-bottomed plank hull along local x (bow at +x) with a recessed deck and bulwarks; base (keel) at y = 0. */
function hull(p: THREE.Object3D, o: HullO): { deckY: (x: number) => number; halfW: (x: number) => number } {
  const n = 26, rk = o.rocker ?? o.H * 0.5, ew = o.endW ?? 0.45, bw = o.bulwark ?? o.H * 0.28, th = o.th ?? o.W * 0.05;
  const halfW = (x: number) => { const u = clamp((2 * x) / o.L, -1, 1); return (o.W / 2) * (ew + (1 - ew) * (1 - Math.abs(u) ** 3)); };
  const top = (x: number) => { const u = clamp((2 * x) / o.L, -1, 1); return o.H + o.sheer * u * u + (o.bowLift ?? 0) * Math.max(0, u) ** 3; };
  const bot = (x: number) => { const u = clamp((2 * x) / o.L, -1, 1); return rk * Math.max(0, Math.abs(u) - 0.45) ** 2 / 0.3; };
  const deckY = (x: number) => Math.max(bot(x) + o.H * 0.3, top(x) - bw);
  const rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const x = -o.L / 2 + (i / n) * o.L, w = halfW(x), yt = top(x), yb = bot(x), yd = deckY(x);
    rings.push([[x, yt, -w], [x, yb + o.H * 0.12, -w * 0.9], [x, yb, -w * 0.7], [x, yb, w * 0.7], [x, yb + o.H * 0.12, w * 0.9], [x, yt, w], [x, yt, w - th], [x, yd, w - th], [x, yd, -w + th], [x, yt, -w + th]]);
  }
  skin(p, rings, o.c ?? '#6b5038', { caps: true, flat: true, paint: o.paint });
  return { deckY, halfW };
}

// ---------------------------------------------------------------------------------------------------------
// Roofs and walls

function polyMesh(p: THREE.Object3D, pos: number[], col: number[]): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return add(p, geo, mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
}
interface HipO { tile: string; k?: number; lift?: number; rib?: string | null; fascia?: string; under?: string; ridge?: string | null; th?: number; sp?: number }
/**
 * Hip roof (寄棟/庑殿) over eaves w×d (ridge along x) with a concave slope (k), slightly lifted corners and tile rows
 * painted as alternating columns; returns the ridge height and length.
 */
function hipRoof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: HipO): { top: number; rl: number } {
  const hx0 = w / 2, hz0 = d / 2, ins = hz0 * 0.985, k = o.k ?? 0.35, lift = o.lift ?? 0, th = o.th ?? 0.006;
  const f = (t: number) => t * (1 - k) + k * t * t, T = [0, 0.1, 0.22, 0.37, 0.55, 0.76, 1], Lz = Math.min(hx0, hz0) * 0.95;
  const sp = o.sp ?? 0.0115, nx = Math.max(4, Math.round(w / sp)), nz = Math.max(3, Math.round(d / sp)), per: [number, number][] = [];
  for (const [s, n] of [[0, nx], [1, nz], [2, nx], [3, nz]]) for (let i = 0; i < n; i++) per.push([s, i / n]);
  const P = (s: number, u: number, t: number, dy: number): V3 => {
    const hx = hx0 - t * ins, hz = hz0 - t * ins;
    let px: number, pz: number, L: number;
    if (s === 0) { px = -hx + 2 * hx * u; pz = hz; L = w; } else if (s === 1) { px = hx; pz = hz - 2 * hz * u; L = d; } else if (s === 2) { px = hx - 2 * hx * u; pz = -hz; L = w; } else { px = -hx; pz = -hz + 2 * hz * u; L = d; }
    const c = Math.max(0, 1 - (Math.min(u, 1 - u) * L) / Lz) ** 2 * (1 - t) ** 1.5, o2 = c * lift * hz0 * 0.12;
    return [x + px + Math.sign(px) * o2, y + h * f(t) + dy + c * lift * hz0 * 0.3, z + pz + Math.sign(pz) * o2];
  };
  const R = [per.map(([s, u]) => P(s, u, 0, -th)), ...T.map(t => per.map(([s, u]) => P(s, u, t, 0)))];
  const n = per.length, pos: number[] = [], col: number[] = [], tmp = new THREE.Color();
  const tri = (a: V3, b: V3, c: V3, color: string) => { tmp.set(color); pos.push(...a, ...b, ...c); for (let q = 0; q < 3; q++) col.push(tmp.r, tmp.g, tmp.b); };
  const rib = o.rib === undefined ? shade(o.tile, 1.14) : o.rib, fascia = o.fascia ?? shade(o.tile, 0.68), under = o.under ?? shade(o.tile, 0.55);
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, a = R[i][j], b = R[i][j1], c = R[i + 1][j1], e = R[i + 1][j];
    const cl = i === 0 ? fascia : rib && j % 2 ? rib : o.tile;
    tri(a, b, c, cl); tri(a, c, e, cl);
  }
  const cen = (r: V3[]): V3 => { let sx = 0, sy = 0, sz = 0; for (const v of r) { sx += v[0]; sy += v[1]; sz += v[2]; } return [sx / r.length, sy / r.length, sz / r.length]; };
  const r0 = R[0], c0 = cen(r0), rt = R[R.length - 1], ct = cen(rt);
  for (let j = 0; j < n; j++) { tri(c0, r0[(j + 1) % n], r0[j], under); tri(ct, rt[j], rt[(j + 1) % n], o.tile); }
  polyMesh(p, pos, col);
  const rl = Math.max(0.02, w - d * 0.985);
  let top = y + h;
  if (o.ridge !== null) { box(p, o.ridge ?? shade(o.tile, 0.8), x, top - 0.005, z, rl + 0.01, 0.011, 0.012); top += 0.006; }
  return { top, rl };
}
/** Owl-tail ridge finial (鴟尾/shibi) curling inwards; sx = +1 for the right end. */
function shibi(p: THREE.Object3D, x: number, y: number, z: number, sx: number, s: number, c: string): void {
  const out: [number, number][] = [[-0.45, 0], [0.4, 0], [0.55, 0.35], [0.45, 0.72], [0.18, 1], [-0.12, 0.98], [-0.05, 0.78], [-0.3, 0.62], [-0.45, 0.32]];
  const m = slab(grp(p, x, z, 0, y), out.map(([u, v]) => [u * s * 0.55 * sx, v * s] as [number, number]), s * 0.22, c, 0, true);
  m.position.z -= s * 0.11;
}
/** Battered wall block (frustum) with a per-face painter and fine subdivision for the paint. */
function frustum(p: THREE.Object3D, x: number, y: number, z: number, w0: number, d0: number, w1: number, d1: number, h: number, c: string, paint: Paint, n = 12, ry = 0): THREE.Mesh {
  const gr = grp(p, x, z, ry, y), rings: V3[][] = [], m = Math.max(4, Math.round(Math.max(w0, d0) / 0.01));
  for (let i = 0; i <= n; i++) {
    const t = i / n, hw = (w0 + (w1 - w0) * t) / 2, hd = (d0 + (d1 - d0) * t) / 2, yy = h * t, ring: V3[] = [];
    for (let s = 0; s < 4; s++) for (let j = 0; j < m; j++) {
      const u = j / m, c2: [number, number][] = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]], a = c2[s], b = c2[(s + 1) % 4];
      ring.push([a[0] + (b[0] - a[0]) * u, yy, a[1] + (b[1] - a[1]) * u]);
    }
    rings.push(ring);
  }
  return skin(gr, rings, c, { caps: true, flat: true, paint });
}

/** Shoulder pole (扁担) with a basket hanging fore and aft, on the right shoulder (figure units). */
function yoke(G: THREE.Object3D, load: string, basket = '#8a7048'): void {
  rod(G, [0.07, 0.83, -0.34], [0.07, 0.83, 0.34], 0.018, '#6e5236', 5);
  for (const z of [-0.3, 0.3]) {
    rod(G, [0.07, 0.83, z], [0.07, 0.42, z], 0.008, '#4a3b2c', 3);
    lathe(G, [[0, 0], [0.075, 0.01], [0.095, 0.12], [0, 0.12]], basket, 0.07, 0.3, z, 9);
    el(G, load, 0.07, 0.42, z, 0.08, 0.035, 0.08);
  }
}
/** Cloth bundle (包袱) slung on the back, figure units. */
function pack(G: THREE.Object3D, c: string): void {
  el(G, c, 0, 0.7, -0.12, 0.1, 0.12, 0.08);
  rod(G, [-0.08, 0.8, 0.0], [0.07, 0.6, 0.07], 0.012, shade(c, 0.7), 4);
}

/** Weeping willow: short trunk, rounded crown and long hanging fronds. */
function willow(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number, c = '#6f7e48'): void {
  tube(p, [[x, y, z], [x + s * 0.06, y + s * 0.35, z + s * 0.02], [x + s * 0.02, y + s * 0.6, z]], s * 0.07, s * 0.045, '#4f4234', { radial: 6, sub: 2 });
  for (let i = 0; i < 4; i++) {
    const a = hash3(seed, i, 3) * TAU;
    blob(p, i % 2 ? c : shade(c, 1.08), x + Math.cos(a) * s * 0.12, y + s * (0.72 + hash3(seed, i, 4) * 0.12), z + Math.sin(a) * s * 0.12, s * 0.24, s * 0.16, s * 0.24);
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + hash3(seed, i, 5), r = s * (0.2 + hash3(seed, i, 6) * 0.14), len = s * (0.2 + hash3(seed, i, 7) * 0.25);
    el(p, shade(c, 0.88 + hash3(seed, i, 8) * 0.22), x + Math.cos(a) * r, y + s * 0.76 - len * 0.5, z + Math.sin(a) * r, s * 0.028, len * 0.55, s * 0.028, a);
  }
}

/** Plank-built Chinese river boat (bow +x) with strakes, a deck and an optional woven-mat awning; returns deck height. */
function riverBoat(p: THREE.Object3D, x: number, y: number, z: number, ry: number, L: number, W: number, awn: number): { G: THREE.Group; deck: (x: number) => number } {
  const G = grp(p, x, z, ry, y), H = W * 0.32;
  const hl = hull(G, {
    L, W, H, sheer: H * 0.5, bowLift: H * 0.25, rocker: H * 0.4, endW: 0.38, bulwark: H * 0.3,
    paint: (px, py, _pz, _nx, ny) => ny > 0.7 ? (Math.floor(px / 0.012) % 2 ? '#7d6447' : '#866c4d') : shade(Math.floor(py / (H * 0.22)) % 2 ? '#6a5038' : '#5d4632', py < H * 0.3 ? 0.8 : 1),
  });
  if (awn > 0) vault(G, -L * 0.04, hl.deckY(0) - 0.001, 0, awn, W * 0.92, W * 0.48, '#8a7650', '#6a5838');
  return { G, deck: hl.deckY };
}


// ---------------------------------------------------------------------------------------------------------

export const SITES_A: Record<string, Builder> = {
  st_qinwall: gp => {
    // Ref: Qin Great Wall at Guyang (固阳秦长城, c. 214 BC) — dry-laid slab-stone wall on the north slopes of the Yinshan
    // ridges, 2–3 m high on a 4–5 m base, with rammed-earth beacon platforms (Baidu Baike 固阳秦长城; Wikipedia).
    const zc = (x: number) => -0.05 + 0.22 * x + 0.04 * Math.sin(5 * x);
    const BX = -0.17, BZ = zc(-0.17) + 0.1, PIT: [number, number] = [0.16, 0.2];
    const hf: HF = (x, z) => {
      const d = z - zc(x), s = d > 0 ? 0.2 : 0.1;
      return (0.15 + 0.03 * Math.sin(2.3 * x + 1.2)) * Math.exp(-((d / s) ** 2))
        + 0.025 * Math.exp(-((x - BX) ** 2 + (z - BZ) ** 2) / 0.008) + 0.014 * (fbm(x * 9, 0, z * 9, 3) - 0.5);
    };
    const paint: Paint = (x, _y, z) => {
      const n = fbm(x * 14, 0, z * 14, 3);
      return mix('#5f5d3e', '#77714c', n);
    };
    const Y = land(gp, 0.45, 0.02, hf, paint, '#7d7258');

    // The wall: dry-laid slabs in rough courses, following the crest; the eastern end is still being raised.
    const stones = ['#8a8072', '#9a8f7f', '#7a7266', '#a39886', '#6e675d', '#91877a'];
    const rings: V3[][] = [], N = 130, x0 = -0.41, x1 = 0.36, NV = 8;
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N, z = zc(x) - 0.012;
      const dz = (zc(x + 0.004) - zc(x - 0.004)) / 0.008, l = Math.hypot(1, dz), sx = -dz / l, sz = 1 / l;
      const h = 0.068 * (1 - 0.62 * sstep(0.2, 0.33, x)) + 0.004 * (hash3(i, 2, 3) - 0.5);
      const bw = 0.034, tw = 0.022, ring: V3[] = [];
      const at = (side: number, f: number): V3 => {
        const w = side * (bw + (tw - bw) * f), px = x + sx * w, pz = z + sz * w;
        return [px, Y(px, pz) - 0.008 + (h + 0.008) * f + (f > 0 ? 0.008 * (1 - f) : 0), pz];
      };
      for (let k = 0; k <= NV; k++) ring.push(at(1, k / NV));
      for (let k = NV; k >= 0; k--) ring.push(at(-1, k / NV));
      rings.push(ring);
    }
    skin(gp, rings, '#8a8072', {
      caps: true, flat: true,
      paint: (px, py, _pz, _nx, ny) => {
        if (ny > 0.75) return mix('#958a7a', '#a69b89', hash3(Math.round(px * 300), Math.round(py * 300), 5));
        const row = Math.floor(py / 0.0062), col = Math.floor(px / 0.012 + row * 0.5);
        return shade(pick(stones, hash3(row, col, 7)), 0.93 + hash3(col, row, 2) * 0.12);
      },
    });
    // loose slabs at the unfinished end, a stone heap on the slope
    for (let i = 0; i < 16; i++) {
      const x = 0.25 + hash3(i, 1, 1) * 0.13, z = zc(x) + 0.04 + hash3(i, 2, 1) * 0.05;
      box(gp, pick(stones, hash3(i, 3, 1)), x, Y(x, z) - 0.002, z, 0.013 + hash3(i, 4, 1) * 0.008, 0.005, 0.01, hash3(i, 5, 1) * 3, 0.15 * (hash3(i, 6, 1) - 0.5));
    }

    // Rammed-earth beacon platform under construction: finished tamped layers, then plank formwork for the next layer.
    const by = Y(BX, BZ) - 0.012, top = earth(gp, BX, by, BZ, 0.13, 0.13, 0.1, 0.1, 0.13, '#8a6e48', 0.006);
    box(gp, '#8c7049', BX, top, BZ, 0.096, 0.012, 0.096);
    const boardP: Paint = (_x, y) => (Math.floor(y / 0.0075) % 2 ? '#5e4a36' : '#54412f');
    for (const s of [-1, 1]) {
      pbox(gp, '#7a6045', BX, top - 0.004, BZ + s * 0.052, 0.112, 0.024, 0.005, boardP, 0.0075);
      pbox(gp, '#7a6045', BX + s * 0.052, top - 0.004, BZ, 0.005, 0.024, 0.102, boardP, 0.0075);
      for (const t of [-0.045, 0, 0.045]) {
        rod(gp, [BX + t, top - 0.012, BZ + s * 0.058], [BX + t, top + 0.03, BZ + s * 0.058], 0.0028, '#5e4a35', 5);
        rod(gp, [BX + s * 0.058, top - 0.012, BZ + t], [BX + s * 0.058, top + 0.03, BZ + t], 0.0028, '#5e4a35', 5);
      }
    }
    // earth ramp up the east side
    const RX0 = BX + 0.2, RX1 = BX + 0.05, RZ = BZ + 0.025, ramp: V3[][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, x = RX0 + (RX1 - RX0) * t, yt = Y(RX0, RZ) + (top + 0.002 - Y(RX0, RZ)) * t, w = 0.018 + 0.006 * t, j = (k: number) => (hash3(i, k, 11) - 0.5) * 0.006;
      ramp.push([[x, Y(x, RZ - w * 1.5) - 0.01, RZ - w * 1.5 + j(1)], [x, yt - 0.004 + j(2), RZ - w + j(3)], [x, yt, RZ - w * 0.6], [x, yt, RZ + w * 0.6], [x, yt - 0.004 + j(4), RZ + w + j(5)], [x, Y(x, RZ + w * 1.5) - 0.01, RZ + w * 1.5 + j(6)]]);
    }
    skin(gp, ramp, '#86704e', { caps: true, flat: true, paint: (x, y, z) => mix('#7a6446', '#8d7552', fbm(x * 60, y * 60, z * 60, 2)) });
    const rampY = (t: number) => Y(RX0, RZ) + (top + 0.002 - Y(RX0, RZ)) * t;

    // Conscripts (戍卒/刑徒) in hemp with bare topknots; a Qin officer in lamellar armour.
    const H = 0.045, hemp = ['#a8946c', '#9b8763', '#8f7f5e', '#b09c75'];
    const folk = (x: number, y: number, z: number, ry: number, i: number, o: Partial<HumanOpts> = {}) =>
      person(gp, x, y, z, H * (0.95 + hash3(i, 9, 9) * 0.08), ry, { top: pick(hemp, hash3(i, 1, 9)), bottom: '#7d6e52', dress: 'knee', hat: HAIR, hatStyle: 'knot', build: 1.05, ...o });
    // carriers on the ramp
    [0.2, 0.52, 0.82].forEach((t, i) => {
      const { G } = folk(RX0 + (RX1 - RX0) * t, rampY(t) - 0.001, RZ + (i % 2 ? 0.008 : -0.008), -Math.PI / 2, i, { pose: 'walk', phase: i * 0.37, lean: 0.12, hands: [[-0.13, 0.5, 0.05], [0.08, 0.86, 0.12]] });
      yoke(G, '#a88e66');
    });
    // tampers on the platform (夯筑)
    [[-0.022, -0.01, 0.4], [0.024, 0.016, -2.6]].forEach(([dx, dz, ry], i) => {
      const { G } = folk(BX + dx, top + 0.006, BZ + dz, ry, 10 + i, { hands: [[-0.03, 0.82, 0.16], [0.03, 0.98, 0.16]], lean: 0.08 });
      rod(G, [0, 0.12, 0.17], [0, 1.08, 0.17], 0.03, '#6e5236', 5);
      cyl(G, '#5a4632', 0, 0.06, 0.17, 0.06, 0.1, 7);
    });
    { // one emptying his baskets
      const { G } = folk(BX + 0.03, top + 0.006, BZ - 0.02, 2.2, 12, { pose: 'crouch' });
      lathe(G, [[0, 0], [0.075, 0.01], [0.095, 0.12], [0, 0.12]], '#8a7048', 0, 0.12, 0.3, 9);
    }
    // diggers at the earth pit
    [[PIT[0] - 0.02, PIT[1] - 0.012, 0.6, 'crouch'], [PIT[0] + 0.025, PIT[1] + 0.01, -2.2, 'stand']].forEach(([x, z, ry, pose], i) => {
      const { G } = folk(x as number, Y(x as number, z as number) - 0.001, z as number, ry as number, 20 + i, pose === 'stand' ? { hands: [[-0.04, 0.62, 0.2], [0.03, 0.82, 0.18]], lean: 0.25 } : { pose: 'crouch' });
      // spade (锸): wooden haft with an iron-shod blade
      if (pose === 'stand') { rod(G, [0, 0.9, 0.17], [0, 0.08, 0.36], 0.026, '#6e5236', 5); box(G, '#55524c', 0, 0.0, 0.37, 0.12, 0.12, 0.025, 0, -0.4); }
    });
    ellip(gp, '#76603f', PIT[0], Y(PIT[0], PIT[1]) - 0.001, PIT[1], 0.05, 0.003, 0.034, 0.3);
    ellip(gp, '#7a6446', PIT[0] - 0.065, Y(PIT[0] - 0.065, PIT[1] + 0.03) - 0.002, PIT[1] + 0.03, 0.026, 0.012, 0.02);
    for (let i = 0; i < 2; i++) lathe(gp, [[0, 0], [0.003, 0.0004], [0.0038, 0.0048], [0, 0.0048]], '#8a7048', PIT[0] - 0.03 + i * 0.012, Y(PIT[0], PIT[1] + 0.04), PIT[1] + 0.045, 9);
    // wallers at the unfinished end: one carrying a slab, one setting it
    {
      const x = 0.31, z = zc(0.31) + 0.045;
      const { G } = folk(x, Y(x, z) - 0.001, z, -2.6, 30, { pose: 'carry', lean: 0.15 });
      box(G, '#8f8576', 0, 0.55, 0.22, 0.32, 0.08, 0.2);
      const x2 = 0.27, z2 = zc(0.27) - 0.012;
      folk(x2, Y(x2, z2) + 0.04, z2, 0.3, 31, { pose: 'crouch' });
    }
    // Qin officer with a ji halberd
    {
      const x = 0.05, z = 0.12;
      const { G } = folk(x, Y(x, z) - 0.001, z, -1.2, 40, { top: '#4a4038', bottom: '#3e3630', armor: '#5b4e40', armorTrim: '#8a7454', hat: '#3a2f28', hatStyle: 'knot', hands: [[-0.125, 0.47, 0.03], [0.14, 0.72, 0.12]] });
      rod(G, [0.15, 0.02, 0.13], [0.15, 1.45, 0.13], 0.018, '#5a4632', 5);
      box(G, '#6f6a60', 0.15, 1.3, 0.17, 0.02, 0.05, 0.1);
    }
    // a supply cart of grain sacks and a file of newly arrived conscripts with tools on their shoulders
    {
      const cx = -0.1, cz = 0.24, G = grp(gp, cx, cz, Math.PI + 0.5, Y(cx, cz) - 0.002);
      ox(G, 0, 0, 0.07, 0, 0.034, '#4f3e2e');
      for (const sx of [-1, 1]) {
        wheel(G, sx * 0.028, 0.022, -0.02, 0.022, '#4a3a2a', 12, 0.004);
        rod(G, [sx * 0.014, 0.03, 0.01], [sx * 0.009, 0.026, 0.09], 0.0025, '#4a3a2a', 5);
      }
      pbox(G, '#5e4a36', 0, 0.026, -0.022, 0.05, 0.012, 0.07, (_x, y) => (y > 0.008 ? '#54412f' : null), 0.006);
      for (let i = 0; i < 6; i++) el(G, i % 2 ? '#8f8064' : '#9c8c6c', ((i % 2) - 0.5) * 0.022, 0.044 + (i > 3 ? 0.012 : 0), -0.045 + Math.floor(i / 2) * 0.022 - (i > 3 ? 0.03 : 0), 0.012, 0.009, 0.014);
      const d = folk(0.03, 0, 0.11, 0.1, 50, { pose: 'walk', phase: 0.3, hands: [[-0.13, 0.5, 0.05], [0.1, 0.62, 0.3]] });
      rod(d.G, [0.1, 0.6, 0.3], [0.0, 0.72, 0.85], 0.022, '#5e4a36', 5);
    }
    [[-0.27, 0.26, 0.0], [-0.31, 0.3, 0.2], [-0.25, 0.33, 0.45], [-0.3, 0.37, 0.7]].forEach(([x, z, ph], i) => {
      const { G } = folk(x, Y(x, z) - 0.001, z, Math.PI - 0.55, 60 + i, { pose: 'walk', phase: ph, hands: [[-0.13, 0.5, 0.05], [0.09, 0.84, 0.05]] });
      rod(G, [0.09, 0.84, 0.32], [0.09, 0.86, -0.42], 0.022, '#6e5236', 5);
      if (i % 2) box(G, '#55524c', 0.09, 0.8, -0.44, 0.03, 0.1, 0.1); else el(G, '#8f8064', 0.09, 0.8, 0.3, 0.06, 0.07, 0.06);
    });
    // brushwood and dung piles for the signal fires; steppe tufts and stones
    for (let i = 0; i < 3; i++) ellip(gp, i % 2 ? '#6f5a3e' : '#5d4b35', BX - 0.075 + i * 0.03, Y(BX - 0.075, BZ + 0.08) + 0.004, BZ + 0.08 - i * 0.005, 0.013, 0.01, 0.011);
    for (let i = 0; i < 14; i++) { // weathered outcrops on the ridge
      const x = -0.38 + i * 0.055 + hash3(i, 1, 5) * 0.02, z = zc(x) + 0.05 + hash3(i, 2, 5) * 0.06;
      if (Math.hypot(x - BX, z - BZ) < 0.1 || Math.hypot(x, z) > 0.4) continue;
      blob(gp, mix('#6e6a62', '#857f74', hash3(i, 3, 5)), x, Y(x, z) - 0.003, z, 0.012 + hash3(i, 4, 5) * 0.012, 0.008, 0.01, hash3(i, 5, 5) * 3);
    }
    for (let i = 0; i < 50; i++) {
      const a = hash3(i, 7, 7) * TAU, r = 0.08 + Math.sqrt(hash3(i, 8, 7)) * 0.32, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(z - zc(x)) < 0.05 || Math.hypot(x - BX, z - BZ) < 0.11 || Math.hypot(x - PIT[0], z - PIT[1]) < 0.06) continue;
      if (i % 4 === 0) blob(gp, '#77716a', x, Y(x, z), z, 0.006 + hash3(i, 1, 2) * 0.006, 0.006, 0.007, hash3(i, 3, 2) * 3);
      else cone(gp, i % 3 ? '#77744a' : '#8a8355', x, Y(x, z) - 0.001, z, 0.0065, 0.009, 5);
    }
  },
  st_nandu: gp => {
    // Ref: 衣冠南渡 (Jin court and northern clans crossing the Yangtze, 317) — Eastern Jin dress after the Seven Sages brick
    // reliefs and Gu Kaizhi's scrolls (wide sleeves, small caps, high chignons); Jin ox-carriage after tomb figurines.
    const zN = (x: number) => -0.13 + 0.025 * Math.sin(4 * x + 1), zS = (x: number) => 0.12 + 0.02 * Math.sin(3 * x - 0.5);
    const Y0 = 0.022, WL = 0.025, PX = -0.2;
    const hf: HF = (x, z) => {
      if (z < zN(x)) { const t = zN(x) - z; return -0.01 + 0.032 * sstep(0, 0.035, t) + 0.075 * sstep(0.07, 0.32, t) + 0.016 * (fbm(x * 8, 1, z * 8, 3) - 0.5) * sstep(0.03, 0.12, t); }
      if (z > zS(x)) return -0.01 + 0.018 * sstep(0, 0.025, z - zS(x));
      return -0.01;
    };
    const paddy = (x: number, z: number) => z > zS(x) + 0.03 && Math.hypot(x + 0.3, z - 0.22) > 0.08;
    const paint: Paint = (x, _y, z) => {
      const n = fbm(x * 12, 0, z * 12, 3);
      if (z > zN(x) - 0.012 && z < zS(x) + 0.012) return mix('#665a46', '#74664f', n);
      if (z > 0) {
        if (!paddy(x, z)) return mix('#6f7546', '#7f8050', n);
        if (Math.hypot(x, z) > 0.375) return mix('#6f7546', '#7f8050', n);
        const cx = Math.floor((x + 0.3) / 0.12), cz = Math.floor((z - 0.2) / 0.09), hh = hash3(cx, cz, 4);
        return hh < 0.45 ? mix('#69736a', '#717b70', n) : hh < 0.8 ? mix('#69744a', '#727d4e', n) : mix('#647046', '#6d784a', n);
      }
      if (Math.abs(x - PX + (z + 0.2) * 0.6) < 0.025 && z > -0.33) return mix('#958267', '#a08c6e', n); // path down to the landing
      return mix(mix('#6f7a48', '#84864f', n), '#7e7650', clamp(fbm(x * 4, 5, z * 4, 2) * 2 - 1));
    };
    const Y = land(gp, 0.45, Y0, hf, paint, '#6f6450');
    // the river surface, clipped to the plinth
    const wr: V3[][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -0.437 + (i / 40) * 0.874, lim = Math.sqrt(Math.max(0, 0.437 ** 2 - x * x));
      const z0 = Math.max(zN(x) - 0.03, -lim), z1 = Math.min(zS(x) + 0.03, lim), ring: V3[] = [];
      for (let k = 0; k <= 6; k++) ring.push([x, WL, z0 + ((z1 - z0) * k) / 6]);
      wr.push(ring);
    }
    skin(gp, wr, '#56695f', { closed: false, flat: true, paint: (x, _y, z) => mix('#4d5f5a', '#5f716a', clamp(fbm(x * 30, 0, z * 7, 3) * 1.4 - 0.2)) });

    // paddy bunds and a local thatched hut on the south (Jiangnan) bank
    for (const zz of [0.2, 0.29, 0.38]) for (let x = -0.42; x < 0.42; x += 0.03) if (paddy(x + 0.015, zz) && Math.hypot(x + 0.015, zz) < 0.37) box(gp, '#72714a', x + 0.015, Y(x + 0.015, zz) - 0.003, zz, 0.031, 0.008, 0.016);
    for (const xx of [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3]) for (let z = 0.12; z < 0.44; z += 0.03) if (paddy(xx, z + 0.015) && Math.hypot(xx, z + 0.015) < 0.37) box(gp, '#72714a', xx, Y(xx, z + 0.015) - 0.003, z + 0.015, 0.016, 0.008, 0.031);
    {
      const hx = -0.3, hz = 0.22, hy = Y(hx, hz) - 0.002;
      box(gp, '#857558', hx, hy, hz, 0.075, 0.036, 0.05, 0.3);
      box(gp, '#3a3028', hx + 0.006, hy, hz + 0.024, 0.016, 0.028, 0.006, 0.3);
      gable(gp, 0.1, 0.055, 0.08, '#56462f', hx, hy + 0.034, hz, 0.3);
      box(gp, '#4a3c28', hx, hy + 0.086, hz, 0.104, 0.006, 0.01, 0.3);
    }
    for (let i = 0; i < 16; i++) {
      const x = -0.4 + i * 0.053 + hash3(i, 1, 3) * 0.02;
      if (Math.abs(x - 0.25) < 0.05) continue;
      reeds(gp, x, WL - 0.004, zS(x) + 0.005 + hash3(i, 2, 3) * 0.02, 0.05, i);
    }
    for (let i = 0; i < 5; i++) { const x = 0.15 + i * 0.05; reeds(gp, x, WL - 0.004, zN(x) - 0.004, 0.045, 40 + i); }

    // north bank: willows and trees on the rising ground, the landing stage
    willow(gp, 0.06, Y(0.06, -0.24) - 0.002, -0.24, 0.17, 1);
    willow(gp, 0.29, Y(0.29, -0.2) - 0.002, -0.2, 0.15, 2);
    broadTree(gp, -0.06, Y(-0.06, -0.34) - 0.002, -0.34, 0.15, '#56653f', 3);
    broadTree(gp, 0.17, Y(0.17, -0.33) - 0.002, -0.33, 0.17, '#4f5f3a', 4);
    {
      const z0 = zN(PX) - 0.03, z1 = zN(PX) + 0.075, y = WL + 0.009;
      pbox(gp, '#7a6448', PX, y - 0.004, (z0 + z1) / 2, 0.045, 0.004, z1 - z0, (_x, _y, z) => (Math.floor(z / 0.009) % 2 ? '#7a6448' : '#6c573d'), 0.009);
      for (const sx of [-1, 1]) for (const zz of [0.3, 0.6, 0.95]) cyl(gp, '#4f3e2e', PX + sx * 0.02, WL - 0.008, z0 + (z1 - z0) * zz, 0.003, y - WL + 0.01, 5);
    }

    // Eastern Jin people: men in wide-sleeved robes with small caps, ladies with high chignons, servants in hemp
    const H = 0.055;
    const gent = (p: THREE.Object3D, x: number, y: number, z: number, ry: number, c: string, o: Partial<HumanOpts> = {}) => {
      const r = person(p, x, y, z, H, ry, { top: c, bottom: shade(c, 0.85), dress: 'ankle', build: 1.1, ...o });
      xiaoguan(r.G, r.rig.head);
      return r;
    };
    const lady = (p: THREE.Object3D, x: number, y: number, z: number, ry: number, c: string, o: Partial<HumanOpts> = {}) => {
      const r = person(p, x, y, z, H * 0.93, ry, { top: c, bottom: shade(c, 0.8), dress: 'ankle', build: 0.92, ...o });
      bun(r.G, r.rig.head);
      return r;
    };
    const servant = (p: THREE.Object3D, x: number, y: number, z: number, ry: number, i: number, o: Partial<HumanOpts> = {}) =>
      person(p, x, y, z, H * 0.97, ry, { top: pick(['#8f7f62', '#7f735c', '#9a8a6a'], hash3(i, 3, 3)), bottom: '#6d6150', dress: 'knee', hat: HAIR, hatStyle: 'knot', ...o });

    // ox-carriage of a fleeing family (牛车 with a curved roof and big wheels), the ox facing the landing
    {
      const cx = -0.32, cz = -0.27, G = grp(gp, cx, cz, 0.9, Y(cx, cz) - 0.002);
      ox(G, 0, 0, 0.06, 0, 0.045, '#5e4632');
      for (const sx of [-1, 1]) {
        wheel(G, sx * 0.03, 0.027, -0.045, 0.027, '#4a3628', 14, 0.004);
        rod(G, [sx * 0.016, 0.036, -0.02], [sx * 0.011, 0.034, 0.085], 0.0026, '#4a3628', 5);
      }
      rod(G, [-0.022, 0.035, 0.084], [0.022, 0.035, 0.084], 0.003, '#4a3628', 5);
      box(G, '#3e2c22', 0, 0.026, -0.048, 0.05, 0.006, 0.07);
      pbox(G, '#7a5c42', 0, 0.032, -0.048, 0.044, 0.036, 0.062, (x, y) => (Math.abs(x) > 0.02 || y > 0.033 ? '#3e2c22' : null), 0.006);
      box(G, '#5a3a2c', 0, 0.034, -0.0165, 0.03, 0.03, 0.002);
      vault(G, 0, 0.066, -0.05, 0.1, 0.056, 0.018, '#3e3428', '#2c241e', Math.PI / 2, 4);
    }
    const pzN = zN(PX);
    gent(gp, PX - 0.06, Y(PX - 0.06, pzN - 0.1), pzN - 0.1, 0.5, '#cfc6ae', { pose: 'point', hands: [[-0.13, 0.47, 0.03], [0.16, 0.77, 0.4]] });
    { const r = lady(gp, PX - 0.025, Y(PX - 0.025, pzN - 0.13), pzN - 0.13, 0.3, '#8f5a4a', { pose: 'walk', phase: 0.2 }); pack(r.G, '#5f6a7a'); }
    { const r = person(gp, PX + 0.003, Y(PX + 0.003, pzN - 0.135), pzN - 0.135, H * 0.6, 0.3, { top: '#a89a7a', bottom: '#8a7a62', pose: 'walk', phase: 0.6 }); r.G.name = ''; }
    { const r = servant(gp, PX - 0.11, Y(PX - 0.11, pzN - 0.15), pzN - 0.15, 0.7, 1, { pose: 'walk', phase: 0.5, lean: 0.1, hands: [[-0.13, 0.5, 0.05], [0.08, 0.86, 0.12]] }); yoke(r.G, '#5f6a7a', '#7a6448'); }
    { // old scholar with a staff
      const r = gent(gp, PX - 0.15, Y(PX - 0.15, pzN - 0.2), pzN - 0.2, 0.9, '#b7ae96', { pose: 'walk', phase: 0.1, lean: 0.15, hands: [[-0.13, 0.48, 0.05], [0.14, 0.62, 0.2]] });
      rod(r.G, [0.15, 0.0, 0.3], [0.14, 0.66, 0.2], 0.022, '#5e4a36', 5);
    }
    { const r = servant(gp, PX + 0.004, WL + 0.009, zN(PX) + 0.05, 0.2, 2, { pose: 'carry' }); box(r.G, '#5a4030', 0, 0.48, 0.2, 0.3, 0.18, 0.2); }

    // boat being loaded at the landing
    {
      const { G, deck } = riverBoat(gp, PX + 0.075, WL - 0.008, zN(PX) + 0.05, 1.35, 0.22, 0.068, 0.07);
      const d = deck(0);
      lady(G, -0.01, d, 0.012, Math.PI / 2, '#5f6f86', { pose: 'sitGround' });
      lady(G, -0.03, d, -0.012, Math.PI / 2, '#7a4f45', { pose: 'sitGround' });
      ellip(G, '#8a5a40', 0.05, d + 0.008, 0.008, 0.012, 0.008, 0.012);
      box(G, '#4e3a2c', 0.045, d, -0.014, 0.022, 0.014, 0.016);
      const b = servant(G, -0.09, deck(-0.09), 0, Math.PI / 2, 3, { hands: [[-0.06, 0.95, 0.12], [-0.02, 1.15, 0.12]] });
      rod(b.G, [-0.05, 1.3, 0.1], [-0.02, -0.4, 0.24], 0.02, '#6e5a40', 5);
    }
    // boat in mid-river, sculled across with a stern oar (櫓)
    {
      const { G, deck } = riverBoat(gp, 0.14, WL - 0.008, 0.01, -Math.PI / 2 + 0.75, 0.27, 0.078, 0.085);
      const d = deck(0);
      lady(G, -0.005, d, 0.014, Math.PI / 2, '#9a6a52', { pose: 'sitGround' });
      person(G, -0.03, d, -0.012, H * 0.55, Math.PI / 2, { top: '#a89a7a', bottom: '#8a7a62', pose: 'sitGround' });
      lady(G, -0.045, d, 0.014, Math.PI / 2 + 0.3, '#5f6a62', { pose: 'sitGround' });
      gent(G, 0.07, deck(0.07), 0.0, Math.PI / 2, '#c9c0a6', { pose: 'stand' });
      gent(G, 0.095, deck(0.095), -0.012, Math.PI / 2 - 0.4, '#a9a088', { pose: 'relax' });
      for (const [bx, bz, c] of [[0.045, 0.016, '#6a5a7a'], [0.048, -0.016, '#8a6a4a'], [0.034, 0.0, '#5f6a5a']] as const) ellip(G, c, bx, d + 0.008, bz, 0.012, 0.009, 0.011);
      const sx = -0.27 / 2 + 0.03, r = servant(G, sx, deck(sx), 0.0, Math.PI / 2, 4, { lean: 0.1, hands: [[-0.06, 0.78, -0.25], [0.06, 0.82, -0.18]] });
      rod(r.G, [0.0, 0.85, -0.12], [0.03, -0.6, -1.7], 0.022, '#6e5a40', 5);
    }
    // a Jiangnan farmer transplanting rice, watching the arrivals
    { const x = 0.12, z = 0.3; person(gp, x, Y(x, z) - 0.002, z, H, 2.8, { top: '#6f6a58', bottom: '#5e5a4a', sleeve: 0.4, dress: 'knee', hat: '#9a8558', hatStyle: 'conical', pose: 'crouch' }); }
  },
  st_kentoshi: gp => {
    // Ref: the full-size 遣唐使船 reconstruction at the Heijō Palace site, Nara (2010): flat-bottomed box hull ~30 × 9.6 m,
    // two masts with woven bamboo-mat sails (網代帆), white/vermilion deckhouses, side oar galleries, stern rudder.
    land(gp, 0.45, 0.04, () => 0, (x, _y, z) => mix('#435c64', '#536e76', clamp(fbm(x * 12, 1, z * 30, 3) * 1.4 - 0.2)), '#3b4a4e', 22, 80);
    const S = grp(gp, 0.02, 0, 0.32, 0.006); S.scale.setScalar(0.9);
    const L = 0.74, W = 0.22, HH = 0.08, sheer = 0.03, bow = 0.03;
    const top = (x: number) => { const u = clamp((2 * x) / L, -1, 1); return HH + sheer * u * u + bow * Math.max(0, u) ** 3; };
    const VER = '#9a3e2c', WHT = '#d3cbbb';
    const { deckY } = hull(S, {
      L, W, H: HH, sheer, bowLift: bow, rocker: 0.035, endW: 0.55, bulwark: 0.022, th: 0.008,
      paint: (px, py, _pz, _nx, ny) => {
        if (ny > 0.7) return py > top(px) - 0.004 ? VER : Math.floor(px / 0.014) % 2 ? '#86705a' : '#7d6852';
        if (py > top(px) - 0.016) return VER;
        if (py < 0.034) return '#3b3530';
        return Math.floor((top(px) - py) / 0.011) % 2 ? WHT : shade(WHT, 0.93);
      },
    });
    // bow and stern facings
    const bx = L / 2, sx = -L / 2;
    box(S, VER, bx + 0.002, top(bx) - 0.03, 0, 0.006, 0.034, W * 0.56);
    box(S, VER, sx - 0.002, top(sx) - 0.03, 0, 0.006, 0.034, W * 0.56);
    // rudder hung on the stern centreline
    rod(S, [sx - 0.012, 0.0, 0], [sx - 0.012, top(sx) + 0.03, 0], 0.005, '#4f3d2e', 6);
    box(S, '#5a4636', sx - 0.03, 0.0, 0, 0.04, 0.06, 0.006);
    rod(S, [sx - 0.012, top(sx) + 0.02, 0], [sx + 0.05, top(sx) + 0.015, 0], 0.003, '#4f3d2e', 5);
    // oar galleries (艫棚) along both sides with bamboo bundles lashed on them
    for (const s of [-1, 1]) {
      const z = s * (W / 2 + 0.012);
      box(S, '#6f5a44', -0.03, top(-0.03) - 0.016, z, 0.36, 0.005, 0.026);
      for (const x of [-0.19, -0.11, -0.03, 0.05, 0.13]) rod(S, [x, top(x) - 0.03, s * W * 0.48], [x, top(x) - 0.013, z + s * 0.012], 0.0028, '#5a4836', 4);
      for (const k of [0, 1]) add(S, CYLX(), mat('#8a845a'), -0.04 + k * 0.02, top(-0.03) - 0.006, z + s * (k ? 0.004 : -0.004), 0.008, 0.2, 0.008, 0, 0, Math.PI / 2);
    }

    // deckhouses (屋形): white panels in vermilion frames under cypress-bark roofs
    const house = (x0: number, x1: number, w: number, h: number, y: number) => {
      const lx = x1 - x0;
      pbox(S, WHT, (x0 + x1) / 2, y, 0, lx, h, w, (px, py, pz, nx) => {
        const u = Math.abs(nx) > 0.5 ? pz : px;
        const g2 = ((u / 0.03) % 1 + 1) % 1;
        if (py < 0.006 || py > h - 0.008 || g2 < 0.16 || Math.abs(u) > (Math.abs(nx) > 0.5 ? w : lx) / 2 - 0.005) return VER;
        return null;
      }, 0.005);
      gable(S, lx + 0.024, 0.026, w + 0.03, '#463a32', (x0 + x1) / 2, y + h, 0);
      box(S, '#3a2e27', (x0 + x1) / 2, y + h + 0.024, 0, lx + 0.03, 0.005, 0.008);
      return y + h;
    };
    house(-0.16, -0.03, 0.15, 0.048, deckY(-0.1) - 0.002);
    const sy = house(-0.35, -0.2, 0.17, 0.046, deckY(-0.28) - 0.002);
    // the stern house's upper tier
    house(-0.34, -0.25, 0.12, 0.04, sy);

    // masts, yards and woven-mat sails braced to a quartering wind
    const sail = (mx: number, mh: number, sw: number, sh: number, sb: number) => {
      const yb = deckY(mx) - 0.004;
      cyl(S, VER, mx, yb, 0, 0.0075, mh, 8);
      cyl(S, '#7a3024', mx, yb, 0, 0.011, 0.02, 8);
      const G = grp(S, mx, 0, 0.55, yb + sb);
      pbox(G, '#a48c64', 0.012, 0, 0, 0.004, sh, sw, (_x, py, pz) => {
        if ((py % 0.032) < 0.005 || py > sh - 0.004) return '#5e4a32';
        const r = Math.floor(py / 0.0065), c = Math.floor(pz / 0.0065);
        return pick(['#a48c64', '#98805a', '#ae966c', '#9c8660'], hash3(r, c, (r + c) % 2));
      }, 0.0065);
      rod(G, [0.016, sh, -sw / 2 - 0.012], [0.016, sh, sw / 2 + 0.012], 0.004, '#5a4430', 6);
      rod(G, [0.016, 0, -sw / 2 - 0.006], [0.016, 0, sw / 2 + 0.006], 0.0035, '#5a4430', 6);
      return yb + mh;
    };
    const mt = sail(0.03, 0.42, 0.26, 0.25, 0.115);
    sail(0.25, 0.32, 0.18, 0.18, 0.1);
    const fl = anim(S, 'flap', 0.03, mt - 0.006, 0);
    box(fl, '#cfc6b0', 0.035, -0.012, 0, 0.07, 0.012, 0.002, 0, 0, -0.12);

    // envoys (遣唐使) in Tang-style court robes and black futou caps, a monk, and the crew
    const H = 0.044;
    const envoy = (x: number, z: number, ry: number, c: string, y = deckY(x), o: Partial<HumanOpts> = {}) => {
      const r = person(S, x, y, z, H, ry, { top: c, bottom: shade(c, 0.85), dress: 'ankle', build: 1.05, ...o });
      futou(r.G, r.rig.head);
      return r;
    };
    envoy(0.12, 0.03, 0.4, '#5a4566');
    envoy(0.15, -0.025, 1.3, '#8a3a30', undefined, { pose: 'point', hands: [[-0.13, 0.47, 0.03], [0.16, 0.77, 0.4]] });
    envoy(0.09, -0.05, 0.9, '#4f6a4f');
    envoy(-0.3, 0.02, Math.PI / 2 + 0.6, '#5a4566', sy, { pose: 'relax' });
    person(S, -0.28, sy, -0.03, H, Math.PI / 2 + 0.3, { top: '#4a4440', bottom: '#3d3834', dress: 'ankle', hair: null, pose: 'pray' });
    const crew = (x: number, z: number, ry: number, i: number, o: Partial<HumanOpts> = {}) =>
      person(S, x, deckY(x), z, H * 0.98, ry, { top: pick(['#9a8a6a', '#8a7a5c', '#a39272'], hash3(i, 1, 4)), bottom: '#6a5e4a', dress: 'knee', sleeve: 0.4, hat: HAIR, hatStyle: 'knot', ...o });
    crew(0.0, 0.04, -0.6, 1, { pose: 'reach' });
    crew(0.05, -0.05, 2.4, 2, { lean: 0.3, hands: [[-0.05, 0.75, 0.25], [0.05, 0.85, 0.25]] });
    crew(-0.36, 0.0, Math.PI / 2 * 3, 3, { hands: [[-0.05, 0.62, 0.22], [0.06, 0.62, 0.2]] });
    crew(0.29, 0.03, 0.2, 4, { pose: 'crouch' });
    // bow wave and wake
    for (const s of [-1, 1]) {
      el(S, '#bcc5c2', bx - 0.01, 0.0345, s * W * 0.34, 0.03, 0.002, 0.012, s * 0.5);
      el(S, '#6f8489', 0.08, 0.0342, s * (W / 2 + 0.006), 0.2, 0.0015, 0.006);
      el(S, '#6a7f84', sx - 0.03, 0.0342, s * 0.03, 0.05, 0.0015, 0.01, s * 0.15);
    }
  },
  st_jokhang: gp => {
    // Ref: Jokhang (大昭寺, founded 647 by Songtsen Gampo) — whitewashed battered walls, black-framed trapezoid windows,
    // maroon penbe parapet, recessed columned porch with yak-hair curtains, dharma wheel and deer, the 823 唐蕃会盟碑
    // and the Princess Willow in front (Wikipedia "Jokhang"; Commons photos of the west facade).
    const WASH = '#d6cfbf', PEN = '#5a2a23', GOLD = '#b08a3c', DARK = '#2a221e', y0 = 0.02;
    land(gp, 0.45, y0, () => 0, (x, _y, z) => {
      return mix('#958d7f', '#a19989', fbm(x * 10, 0, z * 10, 3));
    }, '#7d7568', 24, 84);
    const wall: (h: number) => Paint = h => (px, py, pz, _nx, ny) => {
      if (ny > 0.7) return shade('#8c8274', 0.95 + fbm(px * 30, 0, pz * 30, 2) * 0.1);
      if (py > h - 0.026) return py > h - 0.004 || py < h - 0.024 ? '#3f2a22' : shade(PEN, 0.9 + hash3(Math.round(px * 400), Math.round(pz * 400), Math.round(py * 300)) * 0.2);
      if (py < 0.012) return '#8a8276';
      return shade(WASH, 0.94 + fbm(px * 40 + pz * 40, py * 10, 1, 2) * 0.08 - (py < 0.04 ? 0.04 : 0));
    };
    const H = 0.17;
    frustum(gp, 0, y0, -0.115, 0.5, 0.27, 0.488, 0.262, H, WASH, wall(H), 14);
    for (const s of [-1, 1]) frustum(gp, s * 0.17, y0, 0.04, 0.16, 0.04, 0.156, 0.036, H, WASH, wall(H), 14);
    frustum(gp, 0, y0 + 0.088, 0.04, 0.18, 0.04, 0.178, 0.036, H - 0.088, WASH, wall(H - 0.088), 8);
    // the porch: dark red columns with painted capitals, doors and a black yak-hair curtain
    box(gp, '#4a1c16', 0, y0 + 0.012, 0.0215, 0.16, 0.076, 0.003);
    box(gp, '#6e2a1e', 0, y0 + 0.012, 0.024, 0.06, 0.06, 0.003);
    box(gp, GOLD, 0, y0 + 0.04, 0.026, 0.004, 0.012, 0.002);
    for (const x of [-0.072, -0.024, 0.024, 0.072]) {
      cyl(gp, '#7a2a20', x, y0 + 0.004, 0.055, 0.0055, 0.08, 8);
      box(gp, '#5e3a2a', x, y0 + 0.078, 0.055, 0.03, 0.008, 0.012);
    }
    box(gp, '#3d6a5e', 0, y0 + 0.084, 0.058, 0.18, 0.005, 0.01);
    box(gp, DARK, 0, y0 + 0.062, 0.062, 0.17, 0.018, 0.002);
    for (let i = 0; i < 5; i++) box(gp, '#d8d0bf', -0.06 + i * 0.03, y0 + 0.066, 0.0635, 0.01, 0.006, 0.0015);
    box(gp, '#8a6a34', 0, y0 + 0.095, 0.0605, 0.12, 0.052, 0.002); // great curtain over the upper loggia
    for (let i = 0; i < 6; i++) box(gp, '#6a4f28', -0.05 + i * 0.02, y0 + 0.095, 0.0617, 0.003, 0.052, 0.001);
    box(gp, '#6a2a22', 0, y0 + 0.142, 0.0605, 0.12, 0.004, 0.003);
    // black-framed trapezoid windows on both wings and both storeys
    const win = (x: number, y: number, z: number, w: number, h: number) => {
      slab(grp(gp, x, z, 0, y), [[-w * 0.75, 0], [w * 0.75, 0], [w * 0.6, h * 1.25], [-w * 0.6, h * 1.25]], 0.002, DARK, 0, false);
      box(gp, '#6a2a1e', x, y + h * 0.15, z + 0.0015, w, h, 0.002);
      box(gp, '#2e2a26', x, y + h * 0.28, z + 0.0028, w * 0.7, h * 0.74, 0.001);
      box(gp, '#5e2a20', x, y + h * 1.25, z + 0.003, w * 1.5, 0.004, 0.004);
    };
    for (const s of [-1, 1]) for (const x of [0.13, 0.21]) for (const y of [0.035, 0.105]) win(s * x, y0 + y, 0.06, 0.024, 0.026);
    // roof: dharma wheel flanked by deer, victory banners (gyaltsen) at the corners, a modest gilt roof over the Jowo chapel
    const ry = y0 + H;
    { const G = grp(gp, 0, 0.05, 0, ry); wheel(G, 0, 0.026, 0, 0.018, GOLD, 8, 0.004); G.rotation.y = Math.PI / 2; cyl(G, GOLD, 0, 0, 0, 0.006, 0.01, 8); }
    for (const s of [-1, 1]) {
      const G = grp(gp, s * 0.03, 0.048, -s * Math.PI / 2, ry);
      el(G, GOLD, 0, 0.008, 0, 0.007, 0.006, 0.011);
      el(G, GOLD, 0, 0.017, 0.009, 0.004, 0.006, 0.005);
      for (const t of [-1, 1]) rod(G, [t * 0.0016, 0.022, 0.009], [t * 0.004, 0.028, 0.006], 0.0014, GOLD, 4);
    }
    for (const [x, z] of [[-0.24, 0.05], [0.24, 0.05], [-0.24, -0.24], [0.24, -0.24]]) {
      cyl(gp, DARK, x, ry, z, 0.008, 0.032, 8);
      cyl(gp, '#d8d0bf', x, ry + 0.02, z, 0.0085, 0.004, 8);
      cone(gp, GOLD, x, ry + 0.032, z, 0.005, 0.012, 6);
    }
    for (const [x, z, w, d] of [[0, 0.058, 0.5, 0.006], [0, -0.247, 0.488, 0.006], [-0.245, -0.095, 0.006, 0.3], [0.245, -0.095, 0.006, 0.3]]) box(gp, '#3f2a22', x, ry, z, w, 0.007, d);
    for (const s of [-1, 1]) {
      frustum(gp, s * 0.17, ry, -0.19, 0.08, 0.07, 0.078, 0.068, 0.03, WASH, wall(0.03), 4);
      cone(gp, GOLD, s * 0.17, ry + 0.03, -0.19, 0.006, 0.016, 6);
    }
    frustum(gp, 0, ry, -0.15, 0.15, 0.11, 0.148, 0.108, 0.034, WASH, wall(0.034), 4);
    box(gp, '#6a2a1e', 0, ry + 0.006, -0.094, 0.06, 0.022, 0.003);
    const gr = hipRoof(gp, 0, ry + 0.034, -0.15, 0.17, 0.13, 0.034, { tile: '#a8843a', rib: '#bb9644', fascia: '#5a2a20', lift: 0.6, k: 0.3, ridge: '#b8913f' });
    cone(gp, GOLD, 0, gr.top - 0.002, -0.15, 0.008, 0.03, 8);
    for (const s of [-1, 1]) cone(gp, GOLD, s * gr.rl / 2, gr.top - 0.002, -0.15, 0.005, 0.018, 6);

    // in front: the Tang–Tubu treaty pillar (823) and the Princess Willow inside a low walled enclosure
    {
      const ex = -0.18, ez = 0.2;
      for (const [x, z, w, d] of [[ex, ez + 0.07, 0.16, 0.008], [ex, ez - 0.07, 0.16, 0.008], [ex - 0.08, ez, 0.008, 0.14], [ex + 0.08, ez, 0.008, 0.14]]) box(gp, WASH, x, y0, z, w, 0.018, d);
      box(gp, '#8a8276', ex + 0.03, y0, ez, 0.04, 0.008, 0.026);
      tbox(gp, 0.026, 0.014, 0.022, 0.012, 0.11, '#8a8478', ex + 0.03, y0 + 0.008, ez);
      const cap = hipRoof(gp, ex + 0.03, y0 + 0.118, ez, 0.044, 0.03, 0.014, { tile: '#77716a', rib: null, ridge: '#6a645d', th: 0.004, k: 0.2 });
      el(gp, '#77716a', ex + 0.03, cap.top + 0.004, ez, 0.006, 0.008, 0.006);
      willow(gp, ex - 0.035, y0, ez - 0.01, 0.16, 7, '#7a8650');
    }
    // incense burner (桑炉) with juniper smoke
    {
      const x = 0.15, z = 0.2;
      lathe(gp, [[0, 0], [0.024, 0], [0.024, 0.012], [0.03, 0.03], [0.026, 0.05], [0.012, 0.066], [0.008, 0.085], [0, 0.085]], '#d2cbbb', x, y0, z, 14);
      box(gp, DARK, x, y0 + 0.022, z + 0.025, 0.016, 0.014, 0.008);
      anim(gp, 'smoke', x, y0 + 0.09, z, { size: 0.05 });
    }
    // pilgrims prostrating before the gate, others walking the kora clockwise with prayer wheels, monks in maroon
    const PH = 0.043, chuba = ['#5e4636', '#6e5a48', '#4f4038', '#7a5e44'];
    for (const [x, z] of [[-0.05, 0.13], [0.04, 0.12], [0.0, 0.2]]) {
      const G = grp(gp, x, z, 0, y0 + 0.003), P = grp(G, 0, 0, 0, 0);
      P.rotation.order = 'YXZ'; P.rotation.set(Math.PI / 2, Math.PI, 0);
      P.scale.setScalar(PH);
      human(P, 0, 0, 0, { h: 1, detail: 'lo', top: pick(chuba, hash3(x, z, 1)), bottom: '#3e3430', dress: 'ankle', skin: '#9a6a4a', hair: HAIR, pose: 'cheer' });
      box(G, '#3e2c24', 0, -0.002, -0.022, 0.014, 0.002, 0.046);
    }
    [[0.3, 0.24, 0], [0.24, 0.3, 0.4], [-0.02, 0.33, 0.1], [-0.08, 0.31, 0.6], [0.34, 0.12, 0.3]].forEach(([x, z, ph], i) => {
      const { G } = person(gp, x, y0, z, PH * (0.94 + hash3(i, 2, 2) * 0.08), -Math.PI / 2 - 0.2, { top: pick(chuba, hash3(i, 1, 1)), bottom: '#3e3430', dress: 'ankle', skin: '#9a6a4a', pose: 'walk', phase: ph, hands: [[-0.13, 0.5, 0.05], [0.12, 0.72, 0.22]] });
      if (i % 2 === 0) { rod(G, [0.12, 0.68, 0.22], [0.12, 0.88, 0.22], 0.012, '#4a3a2c', 4); cyl(G, GOLD, 0.12, 0.88, 0.22, 0.04, 0.06, 8); }
    });
    for (const [x, z, r] of [[0.1, 0.09, 0.3], [0.13, 0.1, -0.6]]) {
      person(gp, x, y0, z, PH, r, { top: '#6a2a26', bottom: '#5e2420', dress: 'ankle', hair: null, skin: '#9a6a4a', pose: 'relax' });
    }
  },
  st_nalanda: gp => {
    // Ref: Nalanda mahavihara, Bihar (ASI excavated remains; Xuanzang's Da Tang Xiyu Ji, c. 637): Temple Site 3 — a stepped
    // red-brick pyramid with a great staircase, corner towers with stucco-Buddha niches and votive stupas — and a
    // monastery quadrangle (Site 1) of monk cells on a verandahed courtyard with wells and hearths (Wikipedia/Commons, ASI).
    const y0 = 0.018, B1 = '#80462f', B2 = '#8c5238', B3 = '#6e3c2a';
    const hf: HF = (x, z) => 0.004 * (fbm(x * 6, 0, z * 6, 2) - 0.5);
    const Y = land(gp, 0.45, y0, hf, (x, _y, z) => {
      const n = fbm(x * 14, 2, z * 14, 3);
      return mix(mix('#7c7448', '#8a7f52', n), '#8c7658', clamp(fbm(x * 5, 4, z * 5, 2) * 2 - 0.9));
    }, '#6e5a44');
    const brick = (c: string, top = '#a0705a'): Paint => (px, py, pz, _nx, ny) => {
      if (ny > 0.7) return shade(top, 0.94 + fbm(px * 50, 0, pz * 50, 2) * 0.12);
      const k = Math.floor(py / 0.0055), b = Math.floor((px + pz) / 0.012 + k * 0.5);
      return shade(c, 0.9 + hash3(k, b, 5) * 0.16 - (fbm(px * 25 + pz * 25, py * 25, 1, 2) - 0.5) * 0.1);
    };
    const tier = (x: number, y: number, z: number, w: number, d: number, h: number, c: string) => frustum(gp, x, y, z, w, d, w - 0.006, d - 0.006, h, c, brick(c), Math.max(2, Math.round(h / 0.0055)));
    // brick paths and the monastery forecourt
    for (const [x, z, w, d, r] of [[0.0, 0.2, 0.05, 0.42, -0.5], [-0.17, 0.2, 0.06, 0.18, 0]] as const) box(gp, '#86604e', x, Y(x, z) - 0.002, z, w, 0.004, d, r);

    // ── Temple Site 3: four battered tiers, corner towers, staircase and the shrine on top
    const tx = -0.17, tz = -0.14;
    let ty = Y(tx, tz) - 0.004;
    const T = [[0.27, 0.27, 0.058, B1], [0.21, 0.21, 0.05, B2], [0.16, 0.16, 0.045, B1], [0.11, 0.11, 0.04, B3]] as const;
    T.forEach(([w, d, h, c], i) => {
      tier(tx, ty, tz, w, d, h, c);
      box(gp, shade(c, 0.8), tx, ty + h - 0.004, tz, w - 0.002, 0.004, d - 0.002); // moulded string course
      // niche row with stucco Buddhas on the two lower tiers
      if (i < 2) for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) {
        const u = k * w * 0.18;
        if (Math.abs(u) < 0.035) continue;
        for (const [nx, nz, rr] of [[tx + u, tz + s * (d / 2 - 0.002), 0], [tx + s * (w / 2 - 0.002), tz + u, Math.PI / 2]] as const) {
          box(gp, '#3e2a22', nx, ty + h * 0.3, nz, 0.014, h * 0.45, 0.006, rr);
          el(gp, '#c4ad8e', nx, ty + h * 0.42, nz, 0.004, 0.008, 0.004);
        }
      }
      ty += h;
    });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = tx + sx * 0.13, cz = tz + sz * 0.13, by = Y(cx, cz) - 0.004;
      tier(cx, by, cz, 0.05, 0.05, 0.1, B2);
      box(gp, '#3e2a22', cx, by + 0.05, cz + sz * 0.025, 0.016, 0.026, 0.004);
      el(gp, '#c4ad8e', cx, by + 0.062, cz + sz * 0.026, 0.005, 0.009, 0.004);
      box(gp, '#3e2a22', cx + sx * 0.025, by + 0.05, cz, 0.004, 0.026, 0.016);
      lathe(gp, [[0, 0], [0.018, 0], [0.018, 0.008], [0.014, 0.02], [0.004, 0.032], [0, 0.034]], B3, cx, by + 0.1, cz, 10);
    }
    // the great staircase climbing the front face to the top
    {
      const base = Y(tx, tz + 0.2) - 0.004, top = ty, z0 = tz + 0.2, z1 = tz + 0.055, N = 22;
      for (let i = 0; i < N; i++) {
        const t = (i + 1) / N, z = z0 + (z1 - z0) * (i / N), h = (top - base) * t;
        box(gp, i % 2 ? '#a66a50' : '#9c624a', tx, base, z - (z0 - z1) / N / 2, 0.05, h, (z0 - z1) / N + 0.0005);
      }
      for (const s of [-1, 1]) {
        const L = Math.hypot(z0 - z1, top - base), a = Math.atan2(top - base, z0 - z1);
        const m = box(gp, B3, tx + s * 0.03, 0, 0, 0.012, 0.016, L);
        m.position.set(tx + s * 0.03, (base + top) / 2 + 0.006, (z0 + z1) / 2); m.rotation.set(a, 0, 0);
      }
    }
    // shrine chamber and curvilinear tower (shikhara) on the summit
    tier(tx, ty, tz, 0.075, 0.075, 0.036, B2);
    box(gp, '#2e2420', tx, ty, tz + 0.038, 0.022, 0.03, 0.003);
    el(gp, '#c9b48c', tx, ty + 0.014, tz + 0.03, 0.007, 0.012, 0.005);
    {
      const rings: V3[][] = [], n = 14;
      for (let i = 0; i <= n; i++) {
        const t = i / n, hw = 0.034 * (1 - 0.72 * t ** 1.6), yy = ty + 0.036 + 0.085 * t, ring: V3[] = [];
        for (let j = 0; j < 16; j++) {
          const a = (j / 16) * TAU + Math.PI / 4, rr = hw * (j % 2 ? 0.92 : 1) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
          ring.push([tx + Math.cos(a) * Math.min(rr, hw * 1.3), yy, tz + Math.sin(a) * Math.min(rr, hw * 1.3)]);
        }
        rings.push(ring);
      }
      skin(gp, rings, B2, { caps: true, flat: true, paint: (_x, py) => shade(B2, Math.floor(py / 0.006) % 2 ? 0.92 : 1.02) });
      const tt = ty + 0.121;
      lathe(gp, [[0, 0], [0.014, 0.002], [0.016, 0.006], [0.012, 0.011], [0, 0.012]], B3, tx, tt, tz, 12);
      lathe(gp, [[0, 0], [0.006, 0], [0.008, 0.008], [0.003, 0.016], [0.0015, 0.026], [0, 0.026]], '#8a6a3a', tx, tt + 0.011, tz, 8);
    }
    // votive stupas around the base
    const stupa = (x: number, z: number, s: number) => {
      const by = Y(x, z) - 0.003;
      box(gp, B1, x, by, z, s * 1.2, s * 0.35, s * 1.2);
      lathe(gp, [[0, 0], [s * 0.42, 0], [s * 0.42, s * 0.3], [s * 0.4, s * 0.5], [s * 0.3, s * 0.72], [s * 0.15, s * 0.84], [0, s * 0.86]], B2, x, by + s * 0.35, z, 10);
      box(gp, B3, x, by + s * 1.18, z, s * 0.24, s * 0.12, s * 0.24);
      cone(gp, B3, x, by + s * 1.28, z, s * 0.08, s * 0.4, 6);
    };
    for (const [x, z, s] of [[-0.06, 0.04, 0.034], [-0.29, 0.04, 0.03], [-0.33, -0.05, 0.026], [-0.03, -0.06, 0.028], [-0.24, 0.08, 0.024], [-0.1, 0.09, 0.022], [-0.36, -0.15, 0.024]]) stupa(x, z, s);

    // ── Monastery (vihara) quadrangle: cells round a verandahed court, entrance porch, shrine opposite the gate
    const mx = 0.16, mz = 0.14, MW = 0.27, MD = 0.25, t = 0.055, HM = 0.068, my = Y(mx, mz) - 0.004;
    const top = '#7a604c';
    tier(mx, my - 0.004, mz, MW + 0.02, MD + 0.02, 0.012, B3); // plinth
    const wy = my + 0.008;
    const wingP = brick(B1, top);
    pbox(gp, B1, mx, wy, mz - MD / 2 + t / 2, MW, HM, t, wingP, 0.0055);
    pbox(gp, B1, mx - MW / 2 + t / 2, wy, mz, t, HM, MD - 2 * t + 0.001, wingP, 0.0055);
    pbox(gp, B1, mx + MW / 2 - t / 2, wy, mz, t, HM, MD - 2 * t + 0.001, wingP, 0.0055);
    for (const s of [-1, 1]) pbox(gp, B1, mx + s * (MW / 4 + 0.012), wy, mz + MD / 2 - t / 2, MW / 2 - 0.024, HM, t, wingP, 0.0055);
    // gate porch with steps
    for (const s of [-1, 1]) tier(mx + s * 0.032, wy, mz + MD / 2 + 0.004, 0.022, t + 0.02, HM + 0.012, B2);
    box(gp, B3, mx, wy + 0.046, mz + MD / 2 - t / 2 + 0.004, 0.05, 0.034, t + 0.01);
    for (let i = 0; i < 3; i++) box(gp, '#9c624a', mx, my - 0.004, mz + MD / 2 + 0.024 + i * 0.008, 0.04, 0.012 - i * 0.004, 0.008);
    // courtyard: verandah posts and roof, cell doors on two storeys, paving, a well and hearths
    const ix = MW / 2 - t, iz = MD / 2 - t;
    box(gp, '#9a6a52', mx, wy, mz, 2 * ix, 0.002, 2 * iz);
    const posts: [number, number][] = [];
    for (let k = 0; k <= 6; k++) { const u = -ix + 0.012 + (k / 6) * (2 * ix - 0.024); posts.push([mx + u, mz - iz + 0.012], [mx + u, mz + iz - 0.012]); }
    for (let k = 1; k < 5; k++) { const v = -iz + 0.012 + (k / 5) * (2 * iz - 0.024); posts.push([mx - ix + 0.012, mz + v], [mx + ix - 0.012, mz + v]); }
    for (const [x, z] of posts) cyl(gp, '#b9a68c', x, wy, z, 0.0022, 0.03, 6);
    for (const [x, z, w, d] of [[mx, mz - iz + 0.009, 2 * ix, 0.018], [mx, mz + iz - 0.009, 2 * ix, 0.018], [mx - ix + 0.009, mz, 0.018, 2 * iz - 0.036], [mx + ix - 0.009, mz, 0.018, 2 * iz - 0.036]]) {
      box(gp, '#6e4a38', x, wy + 0.03, z, w, 0.004, d);
      box(gp, B3, x, wy + 0.034, z, w, 0.004, d);
    }
    for (const fl of [0.004, 0.038]) {
      for (let k = -3; k <= 3; k++) {
        const u = k * 0.03;
        box(gp, '#2a201c', mx + u, wy + fl, mz - iz - 0.0005, 0.009, 0.017, 0.002);
        if (Math.abs(u) > 0.02 || fl > 0.01) box(gp, '#2a201c', mx + u, wy + fl, mz + iz + 0.0005, 0.009, 0.017, 0.002);
      }
      for (let k = -1; k <= 1; k++) for (const s of [-1, 1]) box(gp, '#2a201c', mx + s * (ix + 0.0005), wy + fl, mz + k * 0.03, 0.002, 0.017, 0.009);
    }
    // shrine on the back wing facing the gate, rising above the roof
    tier(mx, wy + HM, mz - MD / 2 + t / 2, 0.06, 0.04, 0.026, B2);
    box(gp, B3, mx, wy + HM + 0.026, mz - MD / 2 + t / 2, 0.064, 0.005, 0.044);
    box(gp, '#2e2420', mx, wy + 0.004, mz - iz + 0.0005, 0.02, 0.03, 0.003);
    lathe(gp, [[0, 0], [0.013, 0], [0.013, 0.008], [0, 0.008]], '#5e5048', mx - 0.04, wy + 0.002, mz + 0.02, 12);
    cyl(gp, '#1e2626', mx - 0.04, wy + 0.0085, mz + 0.02, 0.009, 0.001, 10);
    for (const s of [-1, 1]) box(gp, '#4a3428', mx + 0.05, wy + 0.002, mz + s * 0.025, 0.018, 0.008, 0.012);
    // parapet round the roof terrace
    for (const [x, z, w, d] of [[mx, mz - MD / 2 + 0.002, MW, 0.004], [mx, mz + MD / 2 - 0.002, MW, 0.004], [mx - MW / 2 + 0.002, mz, 0.004, MD], [mx + MW / 2 - 0.002, mz, 0.004, MD]]) box(gp, B3, x, wy + HM, z, w, 0.007, d);

    // a temple tank (pokhar) behind the vihara
    {
      const px = 0.22, pz = -0.24, py = Y(px, pz) - 0.002;
      for (let i = 0; i < 3; i++) {
        const w = 0.17 - i * 0.02, d = 0.12 - i * 0.02, h = 0.008 - i * 0.0015, c = i % 2 ? '#7a5040' : '#845846';
        for (const s of [-1, 1]) { box(gp, c, px, py, pz + s * (d / 2 - 0.005), w, h, 0.01); box(gp, c, px + s * (w / 2 - 0.005), py, pz, 0.01, h, d - 0.02); }
      }
      box(gp, '#46585a', px, py, pz, 0.12, 0.0045, 0.075);
    }
    for (const [x, z, s, sd] of [[0.38, -0.08, 0.13, 1], [0.0, -0.35, 0.12, 2], [-0.38, 0.17, 0.13, 3], [0.36, 0.24, 0.11, 4], [-0.15, 0.36, 0.11, 5]]) broadTree(gp, x, Y(x, z) - 0.003, z, s, '#4f5e34', sd, '#4a3a2c');

    // monks in saffron, a group seated in the court, and the Chinese pilgrim Xuanzang with his book-carrier
    const MH = 0.03, robe = ['#b8692a', '#a85a26', '#c07a34', '#9a5526'];
    const monk = (x: number, z: number, r: number, i: number, o: Partial<HumanOpts> = {}) => person(gp, x, Y(x, z) - 0.002, z, MH * (0.95 + hash3(i, 3, 1) * 0.08), r, { top: pick(robe, hash3(i, 1, 2)), bottom: pick(robe, hash3(i, 2, 2)), dress: 'ankle', hair: null, skin: '#7e5236', shoes: '#4a3428', ...o });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; monk(mx + 0.02 + Math.cos(a) * 0.028, mz + 0.01 + Math.sin(a) * 0.028, -a - Math.PI / 2, k, { pose: 'sitGround' }); }
    monk(mx + 0.02, mz - 0.03, 0, 9, { pose: 'sitGround', top: '#8e4a22' });
    [[0.0, 0.2, Math.PI * 0.85], [0.04, 0.3, Math.PI * 0.9], [-0.06, 0.12, Math.PI * 0.8], [-0.17, 0.12, Math.PI]].forEach(([x, z, r], i) => monk(x, z, r, 20 + i, { pose: 'walk', phase: i * 0.3 }));
    monk(-0.17, 0.065, Math.PI, 30, { pose: 'pray' });
    {
      const x = 0.07, z = 0.33, { G } = person(gp, x, Y(x, z) - 0.002, z, MH, Math.PI * 0.85, { top: '#6a5a48', bottom: '#5a4c3e', dress: 'ankle', hair: null, shoes: '#3a2e24', pose: 'walk', phase: 0.5 });
      box(G, '#7a5a34', 0, 0.42, -0.17, 0.3, 0.42, 0.16);
      box(G, '#5e4428', 0, 0.84, -0.17, 0.4, 0.03, 0.26);
      rod(G, [0.2, 0.86, -0.04], [0.26, 1.02, -0.2], 0.012, '#4a3a2c', 4);
    }
  },
  st_toshodaiji: gp => {
    // Ref: Tōshōdai-ji Kondō, Nara (late 8th c., Jianzhen/Ganjin's temple; National Treasure): 7×4 bays, single-eave
    // yosemune roof with a shibi at each ridge end, open front colonnade of 8 entasis columns, three-stepped brackets,
    // white plaster and weathered unpainted timber on a stone podium (Wikipedia "Tōshōdai-ji"; Commons photos).
    const y0 = 0.016, WOOD = '#5c4a3c', WOOD2 = '#6a5646', PL = '#c4bdad', STONE = '#6e6a62';
    const Y = land(gp, 0.45, y0, () => 0, (x, _y, z) => {
      const n = fbm(x * 30, 1, z * 30, 2);
      return mix('#6e6a61', '#78746a', n);
    }, '#5e5a52');
    for (let i = 0; i < 9; i++) box(gp, shade('#7c776e', 0.94 + hash3(i, 5, 5) * 0.1), 0, Y(0, 0.15) - 0.002, 0.16 + i * 0.032, 0.05, 0.004, 0.03);
    const f = 0.0205, bx = [3.3, 4.0, 4.4, 4.7, 4.4, 4.0, 3.3].map(b => b * f), bz = [3.3, 3.6, 3.6, 3.3].map(b => b * f);
    const W = bx.reduce((a, b) => a + b, 0), D = bz.reduce((a, b) => a + b, 0), cz = -0.07;
    const X = [-W / 2], Z = [cz - D / 2];
    for (const b of bx) X.push(X[X.length - 1] + b);
    for (const b of bz) Z.push(Z[Z.length - 1] + b);
    // stone podium (基壇) with front steps
    const py0 = Y(0, cz) - 0.002, PH = 0.024, py = py0 + PH;
    pbox(gp, STONE, 0, py0, cz, W + 0.075, PH, D + 0.075, (px, py2, pz, _nx, ny) => ny > 0.7 ? shade('#77736a', 0.95 + hash3(Math.floor(px / 0.03), Math.floor(pz / 0.03), 1) * 0.1) : shade(STONE, py2 > PH - 0.005 ? 0.92 : 0.97 + (hash3(Math.floor((px + pz) / 0.02), Math.floor(py2 / 0.008), 2) - 0.5) * 0.1), 0.01);
    for (let i = 0; i < 4; i++) box(gp, shade(STONE, 0.95 + (i % 2) * 0.05), 0, py0, cz + D / 2 + 0.0375 + 0.008 + i * 0.008, 0.11, PH - i * 0.006, 0.008);
    // entasis columns
    const CH = 0.104, col = (x: number, z: number) => lathe(gp, [[0, 0], [0.0088, 0], [0.0093, CH * 0.3], [0.0084, CH * 0.75], [0.0074, CH], [0, CH]], WOOD2, x, py, z, 10);
    for (let i = 0; i < X.length; i++) for (let j = 0; j < Z.length; j++) {
      const per = i === 0 || i === X.length - 1 || j === 0 || j === Z.length - 1 || j === Z.length - 2;
      if (per) { col(X[i], Z[j]); box(gp, STONE, X[i], py - 0.001, Z[j], 0.024, 0.003, 0.024); }
    }
    // walls: plaster panels with timber frames on sides/back; doors and lattice windows on the inner front row
    const panel = (x0: number, z0: number, x1: number, z1: number) => {
      const L = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(-(z1 - z0), x1 - x0), x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      box(gp, PL, x, py, z, L, CH, 0.006, r);
      for (const h of [0.004, 0.058, CH - 0.012]) box(gp, WOOD, x, py + h, z, L, h === 0.004 ? 0.006 : 0.008, 0.008, r);
    };
    for (let i = 0; i < 7; i++) panel(X[i], Z[0], X[i + 1], Z[0]);
    for (const xi of [0, 7]) for (let j = 0; j < 3; j++) panel(X[xi], Z[j], X[xi], Z[j + 1]);
    const zf = Z[3];
    for (let i = 0; i < 7; i++) {
      const x = (X[i] + X[i + 1]) / 2, w = bx[i];
      box(gp, PL, x, py + 0.062, zf, w, CH - 0.062, 0.006);
      box(gp, WOOD, x, py + 0.058, zf + 0.001, w, 0.007, 0.008);
      box(gp, WOOD, x, py, zf + 0.001, w, 0.006, 0.008);
      if (i === 0 || i === 6) {
        box(gp, PL, x, py + 0.006, zf, w, 0.024, 0.006);
        box(gp, '#2a221c', x, py + 0.03, zf, w * 0.86, 0.028, 0.006);
        for (let k = 0; k < 9; k++) box(gp, WOOD2, x - w * 0.4 + (k / 8) * w * 0.8, py + 0.03, zf + 0.0035, 0.0018, 0.028, 0.002);
      } else if (i === 3) {
        box(gp, '#1e1814', x, py + 0.006, zf - 0.002, w * 0.8, 0.052, 0.004);
        for (const s of [-1, 1]) box(gp, WOOD2, x + s * w * 0.46, py + 0.006, zf + s * 0.0 + 0.012, w * 0.38, 0.052, 0.003, s * 1.2);
        // the lacquered Rushana Buddha glimpsed within
        el(gp, '#7a6640', x, py + 0.028, zf - 0.012, 0.012, 0.016, 0.008);
        el(gp, '#5e4e32', x, py + 0.05, zf - 0.014, 0.022, 0.026, 0.004);
      } else {
        box(gp, '#4e3e32', x, py + 0.006, zf + 0.001, w * 0.86, 0.052, 0.005);
        box(gp, WOOD, x, py + 0.006, zf + 0.0036, 0.0016, 0.052, 0.002);
        for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) el(gp, '#3a2e26', x + c * w * 0.08, py + 0.016 + r * 0.011, zf + 0.0042, 0.0012, 0.0012, 0.0008);
      }
    }
    // tie beams and the three-stepped bracket sets (三手先) with plastered walls between
    const top = py + CH;
    for (const j of [0, 3, 4]) box(gp, WOOD, 0, top - 0.008, Z[j], W + 0.016, 0.012, 0.012);
    for (const i of [0, 7]) box(gp, WOOD, X[i], top - 0.008, cz, 0.012, 0.012, D + 0.016);
    for (let i = 0; i < 8; i++) box(gp, WOOD, X[i], top - 0.008, (Z[3] + Z[4]) / 2, 0.01, 0.01, bz[3]);
    const bracket = (x: number, z: number, dx: number, dz: number) => {
      const r = Math.atan2(dx, dz);
      const G = grp(gp, x, z, r, top);
      box(G, WOOD2, 0, 0, 0, 0.02, 0.009, 0.02);
      for (let s = 0; s < 3; s++) {
        box(G, WOOD, 0, 0.009 + s * 0.008, 0.01 + s * 0.012, 0.008, 0.006, 0.026 + s * 0.006);
        box(G, WOOD2, 0, 0.013 + s * 0.008, 0.02 + s * 0.012, 0.026, 0.004, 0.008);
      }
      box(G, '#b9b2a3', 0, 0.009, 0.02, 0.0045, 0.02, 0.026);
    };
    for (let i = 0; i < 8; i++) { bracket(X[i], Z[4], 0, 1); bracket(X[i], Z[0], 0, -1); }
    for (let j = 0; j < 5; j++) { bracket(X[0], Z[j], -1, 0); bracket(X[7], Z[j], 1, 0); }
    for (const [x, z] of [[X[0], Z[0]], [X[7], Z[0]], [X[0], Z[4]], [X[7], Z[4]]]) bracket(x, z, Math.sign(x), Math.sign(z - cz));
    const oy = top + 0.034, ov = 0.05;
    box(gp, PL, 0, top, Z[4] - 0.001, W, 0.034, 0.004);
    box(gp, PL, 0, top, Z[0] + 0.001, W, 0.034, 0.004);
    for (const s of [-1, 1]) box(gp, PL, s * W / 2, top, cz, 0.004, 0.034, D);
    for (const [x, z, w, d] of [[0, Z[4] + ov, W + 1.6 * ov, 0.008], [0, Z[0] - ov, W + 1.6 * ov, 0.008], [X[0] - ov, cz, 0.008, D + 1.6 * ov], [X[7] + ov, cz, 0.008, D + 1.6 * ov]]) box(gp, WOOD, x, oy - 0.008, z, w, 0.008, d);
    box(gp, '#3e3228', 0, oy - 0.006, cz, W + 1.6 * ov, 0.003, D + 1.6 * ov); // soffit with rafters
    for (let k = -26; k <= 26; k++) for (const s of [-1, 1]) box(gp, '#4a3c30', k * 0.0128, oy - 0.008, cz + s * (D / 2 + ov / 2 + 0.008), 0.004, 0.004, ov);
    // the hipped roof (寄棟造) — grey tiles, ridge and two shibi
    const rf = hipRoof(gp, 0, oy, cz, W + 2 * ov + 0.03, D + 2 * ov + 0.03, 0.13, { tile: '#5a5955', rib: '#64635e', fascia: '#4c3e32', under: '#3a3028', ridge: '#4e4d49', lift: 0.25, k: 0.3, th: 0.008, sp: 0.0105 });
    for (const s of [-1, 1]) shibi(gp, s * (rf.rl / 2 + 0.004), rf.top - 0.01, cz, s, 0.05, '#46443f');
    box(gp, '#4a4945', 0, rf.top - 0.008, cz, rf.rl, 0.012, 0.018);

    // gravel court: bronze/stone lantern on the axis, pines and visitors (monks of 759 led by Jianzhen's disciples)
    {
      const x = 0, z = 0.27, ly = Y(x, z) - 0.002, LS = '#7e796e';
      lathe(gp, [[0, 0], [0.018, 0], [0.018, 0.006], [0.01, 0.01], [0.007, 0.012], [0.006, 0.042], [0.014, 0.046], [0.014, 0.05], [0, 0.05]], LS, x, ly, z, 6);
      box(gp, '#2e2a26', x, ly + 0.05, z, 0.016, 0.016, 0.016);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(gp, LS, x + sx * 0.008, ly + 0.05, z + sz * 0.008, 0.005, 0.016, 0.005);
      cone(gp, LS, x, ly + 0.066, z, 0.024, 0.016, 6);
      el(gp, LS, x, ly + 0.086, z, 0.005, 0.007, 0.005);
    }
    const pine = (x: number, z: number, s: number, _seed: number) => tree(gp, x, Y(x, z) - 0.002, z, s * 0.62, '#3c4a32', true);
    for (const [x, z, s, sd] of [[-0.33, 0.24, 0.17, 1], [0.34, 0.2, 0.16, 2], [-0.32, -0.3, 0.2, 3], [0.33, -0.3, 0.19, 4], [0.22, 0.36, 0.13, 5], [-0.2, 0.37, 0.12, 6]]) pine(x, z, s, sd);
    const MH = 0.03;
    const monk = (x: number, z: number, r: number, i: number, o: Partial<HumanOpts> = {}) => {
      const { G, rig } = person(gp, x, Y(x, z) - 0.002, z, MH * (0.95 + hash3(i, 4, 4) * 0.08), r, { top: pick(['#3e3630', '#4a3e34', '#544636'], hash3(i, 1, 4)), bottom: '#3a322c', dress: 'ankle', hair: null, skin: SKIN, shoes: '#2a2420', ...o });
      el(G, '#7a5e36', rig.head[0] + 0.06, 0.62, 0.02, 0.15, 0.2, 0.13, 0, 0.3);
      return G;
    };
    monk(-0.02, 0.17, Math.PI, 1, { pose: 'walk', phase: 0.2 });
    monk(0.03, 0.18, Math.PI, 2, { pose: 'walk', phase: 0.7, hands: [[-0.2, 0.55, 0.15], [0.12, 0.6, 0.15]] });
    monk(0.13, 0.3, -0.4, 3, { pose: 'pray' });
    monk(-0.12, 0.3, 0.6, 4, { pose: 'relax' });
    monk(-0.16, 0.27, 2.4, 5, { pose: 'relax' });
    monk(0.2, 0.22, -1.2, 6, { pose: 'walk', phase: 0.4 });
  },
  st_khitan: gp => {
    // Ref: Khitan camp at Abaoji's founding of the Liao (916) — felt domed tents (穹庐), high-wheeled felt-covered carts
    // (奚车/毡车) and horses as in the Kulun Liao tomb murals (库伦辽墓 出行图), Khitan men with 髡发 (shaved crown, temple
    // locks) in round-collar left-lapel robes and boots; the 旗鼓 banner-and-drum as the khan's regalia (Liaoshi).
    const y0 = 0.016, FELT = '#a89c84';
    const hf: HF = (x, z) => 0.012 * (fbm(x * 3, 0, z * 3, 2) - 0.5) + 0.01 * sstep(0.1, 0.45, -z);
    const Y = land(gp, 0.45, y0, hf, (x, _y, z) => {
      const n = fbm(x * 16, 1, z * 16, 3), m = fbm(x * 4, 7, z * 4, 2);
      return mix(mix('#6e6e44', '#7a774a', n), '#7e7254', clamp(m * 2 - 1 + (Math.hypot(x - 0.03, z - 0.06) < 0.08 ? 0.4 : 0)));
    }, '#5e5640', 20, 72);
    // felt tent: lattice wall and dome skinned with felt panels, girth ropes, smoke ring and wooden door
    const yurt = (x: number, z: number, R: number, ry: number) => {
      const y = Y(x, z) - 0.004, Hw = R * 0.5, Hd = R * 0.62, prof: [number, number][] = [[R, 0], [R, Hw * 0.5], [R, Hw], [R * 0.97, Hw + R * 0.06], [R * 0.82, Hw + Hd * 0.42], [R * 0.6, Hw + Hd * 0.72], [R * 0.32, Hw + Hd * 0.93], [R * 0.14, Hw + Hd]];
      const rings: V3[][] = prof.map(([r, h]) => Array.from({ length: 22 }, (_, j) => { const a = (j / 22) * TAU; return [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r] as V3; }));
      skin(gp, rings, FELT, {
        caps: true, flat: true,
        paint: (px, py, pz) => {
          const a = Math.atan2(pz - z, px - x), k = Math.floor((a + Math.PI) / (TAU / 6)), hh = py - y;
          return shade(FELT, 0.9 + hash3(k, hh > Hw ? 1 : 0, 3) * 0.12 + (fbm(px * 60, py * 60, pz * 60, 2) - 0.5) * 0.08);
        },
      });
      for (const t of [0.3, 0.75]) cyl(gp, '#5a4c3c', x, y + Hw * t, z, R + 0.0012, 0.003, 22);
      cyl(gp, '#6e6250', x, y, z, R + 0.0015, 0.006, 22);
      cyl(gp, '#4a3a2c', x, y + Hw + Hd - 0.002, z, R * 0.15, 0.006, 10);
      const G = grp(gp, x, z, ry, y);
      box(G, '#5e4430', 0, 0, R - 0.002, 0.034, 0.05, 0.008);
      box(G, '#3e2e22', 0, 0.003, R + 0.002, 0.024, 0.042, 0.002);
      box(G, '#7a6a52', 0, 0.05, R - 0.006, 0.05, 0.03, 0.006); // rolled felt door flap
    };
    yurt(-0.06, -0.18, 0.105, 0.15);
    yurt(0.24, -0.15, 0.08, -0.5);
    // high-wheeled felt carts, unhitched with the long shafts resting on the ground
    const cart = (x: number, z: number, ry: number, s: number) => {
      const G = grp(gp, x, z, ry, Y(x, z) - 0.002);
      G.scale.setScalar(s);
      const r = 0.052;
      for (const sx of [-1, 1]) wheel(G, sx * 0.05, r, 0, r, '#4e3a2a', 16, 0.006);
      box(G, '#5a4432', 0, r - 0.004, -0.01, 0.08, 0.01, 0.15);
      vault(G, 0, r + 0.006, -0.02, 0.12, 0.084, 0.06, '#9a8c72', '#6a5a46', Math.PI / 2, 5);
      box(G, '#6a5a46', 0, r + 0.006, -0.08, 0.084, 0.06, 0.004);
      box(G, '#3a2e24', 0, r + 0.006, 0.04, 0.05, 0.045, 0.002);
      for (const sx of [-1, 1]) rod(G, [sx * 0.03, r + 0.002, 0.06], [sx * 0.026, 0.006, 0.26], 0.003, '#5a4432', 4);
      rod(G, [-0.03, 0.03, 0.17], [0.03, 0.03, 0.17], 0.0025, '#5a4432', 4);
      rod(G, [0, 0, 0.24], [0, 0.012, 0.24], 0.003, '#5a4432', 4);
    };
    cart(-0.27, -0.02, 0.9, 1);
    cart(-0.25, -0.24, 1.3, 0.9);
    // the khan's banner and drum (旗鼓)
    {
      const x = 0.1, z = -0.27, y = Y(x, z) - 0.003;
      cyl(gp, '#4e3a2a', x, y, z, 0.003, 0.26, 6);
      el(gp, '#8a7440', x, y + 0.265, z, 0.005, 0.009, 0.005);
      const F = anim(gp, 'flap', x + 0.002, y + 0.25, z);
      box(F, '#5a2c24', 0.025, -0.04, 0, 0.05, 0.04, 0.002);
      const D = grp(gp, x + 0.06, z + 0.02, -0.4, y);
      for (const sx of [-1, 1]) rod(D, [sx * 0.03, 0, 0], [sx * 0.022, 0.05, 0], 0.003, '#4e3a2a', 4);
      add(D, CYLX(), mat('#6a3a2a'), 0, 0.045, 0, 0.05, 0.034, 0.05, 0, 0, Math.PI / 2);
      for (const sx of [-1, 1]) add(D, CYLX(), mat('#b8a888'), sx * 0.0172, 0.045, 0, 0.044, 0.001, 0.044, 0, 0, Math.PI / 2);
    }
    // hearth with an iron kettle on a tripod, and its smoke
    {
      const x = 0.04, z = 0.06, y = Y(x, z) - 0.002;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; blob(gp, '#6e665a', x + Math.cos(a) * 0.022, y + 0.002, z + Math.sin(a) * 0.022, 0.006, 0.004, 0.006); }
      el(gp, '#2e2620', x, y + 0.001, z, 0.018, 0.002, 0.018);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.3; rod(gp, [x + Math.cos(a) * 0.03, y, z + Math.sin(a) * 0.03], [x, y + 0.06, z], 0.0018, '#4a3a2c', 4); }
      lathe(gp, [[0, 0], [0.008, 0.002], [0.012, 0.01], [0.011, 0.018], [0.008, 0.02], [0, 0.02]], '#2e2a26', x, y + 0.022, z, 10);
      rod(gp, [x, y + 0.042, z], [x, y + 0.06, z], 0.001, '#2e2a26', 3);
      anim(gp, 'flicker', x, y + 0.008, z).add(el(new THREE.Group(), '#c8742e', 0, 0, 0, 0.008, 0.012, 0.008));
      anim(gp, 'smoke', x, y + 0.08, z, { size: 0.05 });
    }
    // horses at the tether line
    {
      const y = (x: number, z: number) => Y(x, z) - 0.003;
      for (const [a, b] of [[[0.18, 0.04], [0.4, 0.12]]] as const) {
        cyl(gp, '#4e3a2a', a[0], y(a[0], a[1]), a[1], 0.003, 0.06, 6);
        cyl(gp, '#4e3a2a', b[0], y(b[0], b[1]), b[1], 0.003, 0.06, 6);
        rod(gp, [a[0], y(a[0], a[1]) + 0.055, a[1]], [b[0], y(b[0], b[1]) + 0.055, b[1]], 0.0012, '#3e3228', 3);
      }
      steed(gp, 0.28, y(0.28, 0.15), 0.15, -2.8, 0.105, '#6e5038', '#2a2018', { saddle: '#3a2a1c', cloth: '#5a4a3a', stride: 0.01 });
      steed(gp, -0.08, y(-0.08, 0.27), 0.27, 1.1, 0.105, '#4a3a2c', '#1e1814', { saddle: '#3a2a1c', cloth: '#6a4a34', stride: 0.03 });
    }
    // sheep grazing
    for (let i = 0; i < 6; i++) {
      const x = -0.32 + hash3(i, 1, 8) * 0.12, z = 0.14 + hash3(i, 2, 8) * 0.14, r = hash3(i, 3, 8) * TAU, G = grp(gp, x, z, r, Y(x, z) - 0.002);
      el(G, '#c2b8a2', 0, 0.018, 0, 0.011, 0.009, 0.017);
      el(G, '#3a3028', 0, 0.016, 0.018, 0.005, 0.006, 0.008, 0, 0.5);
      for (const [lx, lz] of [[-0.006, -0.01], [0.006, -0.01], [-0.006, 0.01], [0.006, 0.01]]) rod(G, [lx, 0, lz], [lx, 0.012, lz], 0.0016, '#3a3028', 3);
    }
    // Khitan men with 髡发 and a woman at the tent door
    const PH = 0.068, robes = ['#5e6250', '#6e5a44', '#4a5058', '#7a6a50', '#5a4a3e'];
    const man = (x: number, z: number, r: number, i: number, o: Partial<HumanOpts> = {}) => {
      const res = person(gp, x, Y(x, z) - 0.002, z, PH * (0.96 + hash3(i, 5, 5) * 0.06), r, { top: pick(robes, hash3(i, 1, 5)), bottom: pick(robes, hash3(i, 2, 5)), dress: 'knee', hair: null, shoes: '#1e1a18', ...o });
      kunfa(res.G, res.rig.head);
      return res;
    };
    man(0.08, 0.1, -2.4, 1, { pose: 'crouch' });
    man(0.0, 0.12, 2.2, 2, { pose: 'relax' });
    { const { G } = man(-0.02, 0.3, 1.6, 3, { pose: 'reach' }); rod(G, [0.25, 0.75, 0.3], [0.9, 0.85, 0.6], 0.01, '#2e2620', 3); }
    { const { G } = man(0.15, -0.02, 0.6, 4, { pose: 'walk', phase: 0.3, hands: [[-0.18, 0.5, 0.1], [0.18, 1.0, -0.05]] }); add(G, CYLX(), mat('#8a7c64'), 0.0, 1.05, -0.08, 0.16, 0.5, 0.16, 0, 0, Math.PI / 2); }
    { const { G } = man(0.33, -0.01, -0.3, 5, { pose: 'relax' }); tube(G, [[0.22, 0.4, 0.1], [0.3, 0.8, 0.12], [0.22, 1.2, 0.1]], 0.012, 0.008, '#3a2c20'); }
    {
      const { G, rig } = person(gp, -0.05, Y(-0.05, -0.06) - 0.002, -0.06, PH * 0.93, 0.3, { top: '#6a4a3e', bottom: '#5a4a40', dress: 'ankle', shoes: '#1e1a18', pose: 'relax' });
      el(G, '#5a3a32', rig.head[0], rig.head[1] + 0.04, rig.head[2] - 0.01, 0.075, 0.06, 0.08);
    }
  },
  st_xixia: gp => {
    // Ref: Western Xia Imperial Tombs (西夏王陵), Tomb 3 (泰陵, Li Yuanhao) below the Helan Mountains, Yinchuan — eroded
    // octagonal rammed-earth tomb tower (陵台) set off-axis in the walled 陵城 with corner platforms and gates, the 月城
    // forecourt, two stele-pavilion mounds and a pair of 阙台 at the entrance (Wikipedia/Baidu Baike "西夏陵"; Commons).
    const y0 = 0.016, LOESS = '#977f5e', DARKE = '#806a4e';
    const Y = land(gp, 0.45, y0, (x, z) => 0.003 * (fbm(x * 9, 0, z * 9, 2) - 0.5), (x, _y, z) => {
      const n = fbm(x * 18, 3, z * 18, 3);
      return mix(mix('#7c6e56', '#86775c', n), '#72654e', clamp(fbm(x * 5, 2, z * 5, 2) * 2 - 1));
    }, '#5e523e', 20, 72);
    // the Helan range as a jagged strip along the back rim
    {
      const rings: V3[][] = [], N = 60, a0 = Math.PI * 1.08, a1 = Math.PI * 1.92;
      const crest = (u: number) => (0.05 + 0.11 * fbm(u * 9, 0.5, 1.3, 4) + 0.03 * Math.abs(Math.sin(u * 23))) * (0.35 + 0.65 * Math.sin(u * Math.PI));
      for (let k = 4; k >= 0; k--) {
        const ring: V3[] = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N, a = a0 + (a1 - a0) * u, t = k / 4, r = 0.43 - t * 0.075;
          const h = k === 0 || k === 4 ? 0 : crest(u) * [0, 0.55, 1, 0.65, 0][k] * (0.9 + 0.2 * fbm(u * 19, k, 0, 2));
          ring.push([Math.cos(a) * r, Y(Math.cos(a) * r, Math.sin(a) * r) - 0.003 + Math.max(0, h), Math.sin(a) * r]);
        }
        rings.push(ring);
      }
      skin(gp, rings, '#565048', { closed: false, flat: true, paint: (_x, py, _z) => shade(py > 0.11 ? '#625a50' : '#4e4840', 0.92 + (fbm(_x * 40, py * 40, _z * 40, 2) - 0.5) * 0.16) });
    }
    // eroded rammed-earth wall: segments of uneven height with breaches
    const wallRun = (xa: number, za: number, xb: number, zb: number, h: number, th: number, seed: number) => {
      const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(L / 0.028)), r = Math.atan2(-(zb - za), xb - xa);
      for (let i = 0; i < n; i++) {
        if (hash3(seed, i, 1) < 0.1) continue;
        const t = (i + 0.5) / n, x = xa + (xb - xa) * t, z = za + (zb - za) * t, hh = h * (0.6 + hash3(seed, i, 2) * 0.45), l = L / n;
        earth(gp, x, Y(x, z) - 0.003, z, l * 1.04, th, l * (0.55 + hash3(seed, i, 3) * 0.3), th * 0.35, hh, LOESS, 0.006, r);
      }
    };
    const W0 = -0.19, W1 = 0.19, Z0 = -0.3, Z1 = 0.06, H = 0.032;
    wallRun(W0, Z0, W1, Z0, H, 0.022, 1);
    wallRun(W0, Z0, W0, Z1, H, 0.022, 2);
    wallRun(W1, Z0, W1, Z1, H, 0.022, 3);
    wallRun(W0, Z1, -0.03, Z1, H, 0.022, 4);
    wallRun(0.03, Z1, W1, Z1, H, 0.022, 5);
    for (const [x, z] of [[W0, Z0], [W1, Z0], [W0, Z1], [W1, Z1]]) earth(gp, x, Y(x, z) - 0.003, z, 0.05, 0.05, 0.03, 0.03, 0.052, DARKE, 0.006);
    for (const [x, z, ry] of [[0, Z0, 0], [W0, (Z0 + Z1) / 2, Math.PI / 2], [W1, (Z0 + Z1) / 2, Math.PI / 2]] as const) for (const s of [-1, 1]) {
      const px = x + (ry ? 0 : s * 0.03), pz = z + (ry ? s * 0.03 : 0);
      earth(gp, px, Y(px, pz) - 0.003, pz, 0.03, 0.03, 0.018, 0.018, 0.042, LOESS, 0.006);
    }
    for (const s of [-1, 1]) earth(gp, s * 0.035, Y(s * 0.035, Z1) - 0.003, Z1, 0.026, 0.034, 0.016, 0.02, 0.048, DARKE, 0.006);
    // 月城 forecourt
    wallRun(-0.1, Z1, -0.1, 0.16, H * 0.8, 0.018, 6);
    wallRun(0.1, Z1, 0.1, 0.16, H * 0.8, 0.018, 7);
    wallRun(-0.1, 0.16, -0.025, 0.16, H * 0.8, 0.018, 8);
    wallRun(0.025, 0.16, 0.1, 0.16, H * 0.8, 0.018, 9);
    // offering-hall platform and the long ridge over the tomb passage
    earth(gp, -0.01, Y(-0.01, -0.02) - 0.003, -0.02, 0.075, 0.05, 0.068, 0.044, 0.01, DARKE, 0.005);
    earth(gp, -0.02, Y(-0.02, -0.075) - 0.003, -0.075, 0.03, 0.07, 0.014, 0.06, 0.012, LOESS, 0.006, 0.05);
    // the tomb tower: octagonal, seven tiers of rammed earth, eaves long gone, rafter-hole rows and gullies of erosion
    {
      const tx = -0.035, tz = -0.18, ty = Y(tx, tz) - 0.004, TH = 0.285, R0 = 0.09, rings: V3[][] = [], NR = 42, NP = 40;
      const rad = (a: number, t: number) => {
        const oct = Math.cos(Math.PI / 8) / Math.cos(((a % (TAU / 8)) + TAU / 8) % (TAU / 8) - Math.PI / 8);
        const prof = R0 * (1 - 0.9 * t ** 1.7) ** 0.75 * (1 + 0.025 * Math.cos(t * 7 * TAU) * (1 - t));
        const gully = 1 - 0.2 * clamp(fbm(a * 3.2, t * 1.5, 0.7, 3) * 2.4 - 1) * (0.4 + t);
        return prof * (oct * (1 - t) + t) * gully;
      };
      for (let i = 0; i <= NR; i++) {
        const t = i / NR, ring: V3[] = [];
        for (let j = 0; j < NP; j++) { const a = (j / NP) * TAU, r = rad(a, t); ring.push([tx + Math.cos(a) * r, ty + TH * (t + 0.02 * Math.sin(t * Math.PI) * fbm(a, 3, 3, 2)), tz + Math.sin(a) * r]); }
        rings.push(ring);
      }
      rings.push([[tx, ty + TH * 1.012, tz]].flatMap(v => Array.from({ length: NP }, (_, j) => [v[0] + Math.cos((j / NP) * TAU) * 0.006, v[1], v[2] + Math.sin((j / NP) * TAU) * 0.006] as V3)));
      skin(gp, rings, LOESS, {
        caps: true, flat: true,
        paint: (px, py, pz) => {
          const t = (py - ty) / TH, k = t * 7, a = Math.atan2(pz - tz, px - tx);
          if (t > 0.04 && t < 0.86 && Math.abs(k - Math.round(k)) < 0.035 && hash3(Math.round(a * 24), Math.round(k), 9) < 0.55) return '#4e4232';
          const band = Math.floor((py - ty) / 0.0055) % 2 ? 0.97 : 1.0, red = t < 0.35 && fbm(a * 4, t * 6, 5, 2) > 0.62 ? 1 : 0;
          return shade(red ? '#9a6a4e' : LOESS, band + (fbm(px * 50, py * 70, pz * 50, 2) - 0.5) * 0.12 - (1 - t) * 0.04);
        },
      });
      for (let i = 0; i < 14; i++) { const a = hash3(i, 1, 6) * TAU, r = R0 * (1 + hash3(i, 2, 6) * 0.25); blob(gp, LOESS, tx + Math.cos(a) * r, ty, tz + Math.sin(a) * r, 0.012 + hash3(i, 3, 6) * 0.01, 0.005, 0.012); }
    }
    // stele-pavilion mounds and the pair of 阙 towers on the approach
    for (const s of [-1, 1]) {
      const x = s * 0.085, z = 0.25, y = Y(x, z) - 0.003;
      earth(gp, x, y, z, 0.06, 0.06, 0.05, 0.05, 0.016, DARKE, 0.005);
      for (let i = 0; i < 5; i++) box(gp, '#7e6a54', x + (hash3(i, s, 1) - 0.5) * 0.04, y + 0.016, z + (hash3(i, s, 2) - 0.5) * 0.04, 0.008, 0.004, 0.005, hash3(i, s, 3) * 3);
      const qx = s * 0.1, qz = 0.37, qy = Y(qx, qz) - 0.003;
      const top = earth(gp, qx, qy, qz, 0.05, 0.05, 0.03, 0.03, 0.09, LOESS, 0.0055);
      el(gp, DARKE, qx, top - 0.002, qz, 0.013, 0.006, 0.013);
    }
    // desert scrub on the gobi
    for (let i = 0; i < 40; i++) {
      const a = hash3(i, 7, 1) * TAU, r = 0.12 + hash3(i, 8, 1) * 0.3, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z < -0.33 || (Math.abs(x) < 0.21 && z > -0.32 && z < 0.18)) continue;
      for (let k = 0; k < 3; k++) el(gp, pick(['#4e4c3c', '#5a5642', '#48463a'], hash3(i, 9, k)), x + (hash3(i, k, 2) - 0.5) * 0.014, Y(x, z) + 0.001, z + (hash3(i, k, 3) - 0.5) * 0.014, 0.004, 0.0035, 0.004);
    }
  },
  st_diamond: gp => {
    // Ref: the Dunhuang Diamond Sutra (金刚经, dated 868, British Library Or.8210/P.2) — a 5 m handscroll on yellowed paper,
    // opening with the woodcut frontispiece of the Buddha preaching to Subhuti under a canopy, then columns of text;
    // printed from carved pear-wood blocks inked with a brush and rubbed with a pad, in a Tang timber-framed workshop.
    const y0 = 0.016, WOOD = '#5a3e2c', PAPER = '#c9b994', INKC = '#24201c', PL = '#c2b9a6';
    land(gp, 0.45, y0, () => 0, (x, _y, z) => mix('#7a6e5c', '#857866', fbm(x * 20, 1, z * 20, 2)), '#5e5446', 16, 64);
    const fy = y0 + 0.016;
    pbox(gp, '#6e5440', 0, y0, -0.01, 0.72, 0.016, 0.46, (px, py, pz, _nx, ny) => {
      if (ny < 0.7) return shade('#5a4434', 0.95 + (py > 0.012 ? 0.05 : 0));
      const k = Math.floor((pz + 0.23) / (0.46 / 13)), j = Math.floor(((px + 0.36) / (0.72 / 21) + (k % 3) * 2.3) / 7);
      return shade('#6e5440', 0.88 + hash3(k, j, 1) * 0.18);
    }, 0.035);
    // back wall and a short return wall: timber posts, beams, plaster, a vertical-bar window (直棂窗) and an eave fragment
    const BZ = -0.22, WH = 0.34;
    for (const x of [-0.34, -0.12, 0.12, 0.34]) cyl(gp, WOOD, x, fy, BZ, 0.012, WH, 10);
    cyl(gp, WOOD, -0.34, fy, 0.02, 0.012, WH, 10);
    for (const [x0, x1] of [[-0.34, -0.12], [-0.12, 0.12], [0.12, 0.34]]) {
      const x = (x0 + x1) / 2, w = x1 - x0 - 0.02;
      box(gp, PL, x, fy, BZ - 0.004, w, WH - 0.02, 0.008);
      box(gp, '#4e3626', x, fy, BZ, w, 0.04, 0.012);
      for (const h of [0.13, WH - 0.04]) box(gp, WOOD, x, fy + h, BZ, w + 0.02, 0.016, 0.014);
    }
    box(gp, PL, -0.34, fy, -0.1, 0.008, WH - 0.02, 0.22);
    box(gp, '#4e3626', -0.34, fy, -0.1, 0.012, 0.04, 0.22);
    for (const h of [0.13, WH - 0.04]) box(gp, WOOD, -0.34, fy + h, -0.1, 0.014, 0.016, 0.24);
    box(gp, '#2a2420', 0, fy + 0.165, BZ + 0.0005, 0.16, 0.11, 0.004);
    box(gp, WOOD, 0, fy + 0.158, BZ + 0.002, 0.18, 0.008, 0.012);
    box(gp, WOOD, 0, fy + 0.275, BZ + 0.002, 0.18, 0.008, 0.012);
    for (let i = 0; i < 9; i++) box(gp, '#8a6a4a', -0.07 + i * 0.0175, fy + 0.165, BZ + 0.004, 0.008, 0.11, 0.008, Math.PI / 4);
    {
      const ey = fy + WH, E = grp(gp, 0, BZ + 0.02, 0, ey);
      for (const x of [-0.34, -0.12, 0.12, 0.34]) { box(E, WOOD, x, 0, 0, 0.03, 0.012, 0.03); box(E, '#4e3626', x, 0.012, 0.02, 0.016, 0.01, 0.07); }
      const T = grp(E, 0, 0.02, 0, 0.02);
      T.rotation.x = 0.42;
      pbox(T, '#4e4c48', 0, 0, 0.01, 0.76, 0.012, 0.12, (px, _py, _pz, _nx, ny) => ny > 0.5 ? shade('#55534e', Math.floor((px + 0.4) / 0.018) % 2 ? 0.88 : 1.02) : '#3a3026', 0.018);
    }
    // a drying line of freshly printed sheets
    for (const z of [-0.18, -0.02]) cyl(gp, WOOD, -0.29, fy, z, 0.005, 0.24, 6);
    rod(gp, [-0.29, fy + 0.235, -0.18], [-0.29, fy + 0.235, -0.02], 0.002, '#4a3a2c', 4);
    for (let i = 0; i < 4; i++) {
      const z = -0.16 + i * 0.038, S = grp(gp, -0.29, z, Math.PI / 2, fy + 0.235);
      box(S, shade(PAPER, 1.02), 0, -0.07, 0, 0.032, 0.07, 0.0012);
      for (let k = 0; k < 6; k++) for (const s of [-1, 1]) box(S, INKC, -0.012 + k * 0.0048, -0.064, s * 0.0007, 0.0012, 0.056, 0.0004);
    }
    // the sutra table: the opened scroll with its frontispiece, text columns and the rolled-up remainder
    const ty = fy + 0.064, TX = 0.04, TZ = 0.0;
    box(gp, WOOD, TX, ty - 0.008, TZ, 0.44, 0.008, 0.13);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(gp, '#4e3626', TX + sx * 0.2, fy, TZ + sz * 0.05, 0.012, 0.056, 0.012);
    for (const sx of [-1, 1]) box(gp, '#4e3626', TX + sx * 0.2, fy, TZ, 0.014, 0.008, 0.11);
    const SZ = TZ + 0.005, SW = 0.072;
    box(gp, PAPER, TX - 0.005, ty, SZ, 0.33, 0.0012, SW);
    {
      const px = TX + 0.115, pw = 0.08, P = (u: number, v: number) => [px + u, ty + 0.0016, SZ + v] as const;
      box(gp, '#4a3e30', px, ty + 0.0012, SZ, pw, 0.0006, SW - 0.008);
      const lite = '#c4b48e';
      for (const [u, v, rx, rz] of [[0, -0.022, 0.034, 0.005], [-0.008, -0.026, 0.012, 0.003], [0.008, -0.026, 0.012, 0.003]]) { const [x, y, z] = P(u, v); el(gp, lite, x, y, z, rx, 0.0006, rz); }
      { const [x, y, z] = P(0, -0.004); el(gp, lite, x, y, z, 0.017, 0.0005, 0.017); el(gp, '#4a3e30', x, y + 0.0002, z, 0.0145, 0.0005, 0.0145); el(gp, lite, x, y + 0.0004, z - 0.006, 0.0045, 0.0006, 0.0045); el(gp, lite, x, y + 0.0004, z + 0.004, 0.0075, 0.0006, 0.007); }
      { const [x, y, z] = P(0, 0.018); box(gp, lite, x, y, z, 0.03, 0.0006, 0.006); }
      for (const [u, v] of [[-0.03, -0.006], [-0.026, 0.008], [0.026, 0.006], [0.031, -0.008], [-0.018, 0.022], [0.019, 0.024], [-0.032, 0.022], [0.033, 0.022]]) { const [x, y, z] = P(u, v); el(gp, lite, x, y, z, 0.0035, 0.0006, 0.0045); }
      { const [x, y, z] = P(-0.012, 0.027); el(gp, lite, x, y, z, 0.004, 0.0006, 0.004); }
    }
    for (let i = 0; i < 46; i++) {
      const x = TX + 0.07 - 0.006 - i * 0.0048, len = i % 11 === 10 ? 0.026 : 0.056 - (i % 7 === 3 ? 0.012 : 0);
      box(gp, INKC, x, ty + 0.0012, SZ - 0.028 + len / 2, 0.0016, 0.0005, len);
    }
    add(gp, CYLX(), mat(shade(PAPER, 0.92)), TX - 0.175, ty + 0.012, SZ, 0.024, SW, 0.024, Math.PI / 2, 0, Math.PI / 2);
    add(gp, CYLX(), mat('#4e3626'), TX - 0.175, ty + 0.012, SZ, 0.008, SW + 0.02, 0.008, Math.PI / 2, 0, Math.PI / 2);
    box(gp, '#6a4a2e', TX + 0.158, ty, SZ, 0.004, 0.003, SW + 0.004);
    // the printing bench: carved pear-wood block, ink bowl and brush, rubbing pad, paper stack
    const bx = -0.2, bz = 0.15, by = fy + 0.044;
    box(gp, WOOD, bx, by - 0.008, bz, 0.17, 0.008, 0.11);
    for (const sx of [-1, 1]) box(gp, '#4e3626', bx + sx * 0.075, fy, bz, 0.012, 0.036, 0.1);
    box(gp, '#8a6a46', bx + 0.01, by, bz, 0.1, 0.014, 0.06);
    box(gp, '#2a2420', bx + 0.01, by + 0.014, bz, 0.094, 0.001, 0.054);
    for (let i = 0; i < 16; i++) box(gp, '#3e342c', bx - 0.035 + i * 0.006, by + 0.015, bz, 0.002, 0.0008, 0.046);
    for (const sx of [-1, 1]) box(gp, '#7a5c3c', bx + 0.01 + sx * 0.047, by, bz, 0.004, 0.017, 0.064);
    { const S = grp(gp, bx + 0.035, bz, 0, by + 0.016); S.rotation.z = 0.5; box(S, shade(PAPER, 1.04), -0.024, 0, 0, 0.05, 0.001, 0.062); }
    lathe(gp, [[0, 0], [0.012, 0], [0.018, 0.008], [0.02, 0.016], [0.016, 0.017], [0, 0.012]], '#3a3632', bx - 0.06, by, bz - 0.03, 12);
    cyl(gp, '#141210', bx - 0.06, by + 0.013, bz - 0.03, 0.015, 0.001, 12);
    rod(gp, [bx - 0.07, by + 0.016, bz - 0.022], [bx - 0.03, by + 0.03, bz + 0.03], 0.0025, '#7a6a4a', 5);
    strut(gp, [bx - 0.07, by + 0.016, bz - 0.022], [bx - 0.076, by + 0.012, bz - 0.03], 0.0035, 0.0008, INKC, 5);
    box(gp, '#6a5a40', bx - 0.06, by, bz + 0.03, 0.03, 0.01, 0.018);
    box(gp, '#3a3028', bx - 0.06, by + 0.01, bz + 0.03, 0.02, 0.008, 0.006);
    for (let i = 0; i < 9; i++) box(gp, shade(PAPER, 0.96 + hash3(i, 1, 1) * 0.08), -0.06 + (hash3(i, 2, 1) - 0.5) * 0.004, fy + i * 0.0022, 0.17, 0.05, 0.0022, 0.064, (hash3(i, 3, 1) - 0.5) * 0.08);
    // oil lamp on a tall stand
    {
      const x = 0.27, z = -0.13;
      lathe(gp, [[0, 0], [0.022, 0], [0.02, 0.006], [0.006, 0.012], [0.004, 0.13], [0.008, 0.134], [0.018, 0.14], [0.018, 0.146], [0, 0.144]], '#5a4a36', x, fy, z, 10);
      const F = anim(gp, 'flicker', x + 0.008, fy + 0.152, z);
      el(F, '#d8a050', 0, 0, 0, 0.004, 0.009, 0.004);
    }
    // people kneeling on mats: the printer at his block, a monk reading the proof and the patron Wang Jie
    const PH = 0.26, kneelFeet: [V3, V3] = [[-0.06, 0.032, -0.05], [0.06, 0.032, -0.05]];
    const mat2 = (x: number, z: number, r: number) => box(gp, '#857246', x, fy, z, 0.12, 0.002, 0.15, r);
    mat2(-0.33, 0.15, 0); mat2(0.04, -0.11, 0); mat2(0.27, 0.13, 0.7);
    {
      const { G, rig } = person(gp, -0.33, fy + 0.002, 0.15, PH, Math.PI / 2, { top: '#6e5c46', bottom: '#5e5040', dress: 'ankle', pose: 'kneel', hipY: 0.19, feet: kneelFeet, lean: 0.3, sleeve: 0.6, hands: [[-0.1, 0.24, 0.42], [0.06, 0.24, 0.5]], detail: 'hi' });
      futou(G, rig.head);
      el(G, INK, rig.head[0], rig.head[1] - 0.045, rig.head[2] + 0.062, 0.026, 0.007, 0.01);
    }
    {
      const { G, rig } = person(gp, 0.04, fy + 0.002, -0.11, PH, 0, { top: '#4a3e34', bottom: '#3e342c', dress: 'ankle', hair: null, pose: 'kneel', hipY: 0.19, feet: kneelFeet, lean: 0.15, hands: [[-0.12, 0.25, 0.32], [0.14, 0.25, 0.34]], detail: 'hi' });
      el(G, '#7a5a34', rig.head[0] + 0.05, 0.4, 0.02, 0.14, 0.2, 0.12, 0, 0.2);
    }
    {
      const { G, rig } = person(gp, 0.27, fy + 0.002, 0.13, PH, -2.3, { top: '#48584a', bottom: '#3e4a40', dress: 'ankle', pose: 'kneel', hipY: 0.19, feet: kneelFeet, lean: 0.05, hands: [[-0.08, 0.3, 0.16], [0.08, 0.3, 0.16]], detail: 'hi' });
      futou(G, rig.head);
      el(G, INK, rig.head[0], rig.head[1] - 0.045, rig.head[2] + 0.062, 0.026, 0.007, 0.01);
      box(G, '#3a2e24', 0, 0.36, 0.06, 0.26, 0.03, 0.03);
    }
  },
};
