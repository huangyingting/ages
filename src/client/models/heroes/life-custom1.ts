import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, rbox, cyl, cone, gable, lathe, rod, strut, sweep, skin, tube,
  shade, hash3, fbm, paintFaces, plinth, tree, SITE,
} from '../prims.ts';
import { human, type HumanOpts, type HumanRig } from '../human.ts';
import { horse } from '../animals.ts';
import { hall, proof } from '../timber.ts';

// Ancient Chinese people & customs I (pack life-custom1): Peking Man at Zhoukoudian, fire-drilling, Shang bronze
// wine vessels, the well-field system, the Zhou archery rite, pitch-pot, the Sword of Goujian, King Wuling's
// mounted archers, ancient coinage, cuju football, Han acrobatics and Laozi leaving through Hangu Pass.
// Each is a small realistic diorama on a round base (radius ≈0.46). Front faces +z, base at y=0.

type O = THREE.Object3D;
const TAU = Math.PI * 2;
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);

// ---- shared helpers -------------------------------------------------------------------------------------------

function anim(p: O, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}
/** Child group at (x,y,z) turned by ry (and optionally rx, rz), uniformly scaled by s. */
function grp(p: O, x: number, y: number, z: number, ry = 0, s = 1, rx = 0, rz = 0): THREE.Group {
  const q = new THREE.Group();
  q.position.set(x, y, z);
  q.rotation.set(rx, ry, rz);
  q.scale.setScalar(s);
  p.add(q);
  return q;
}
const S8 = () => g('lc1-s8', () => new THREE.SphereGeometry(1, 8, 6));
const S14 = () => g('lc1-s14', () => new THREE.SphereGeometry(1, 14, 10));
/** smooth ellipsoid (light sphere for tiny parts) */
const el = (p: O, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) =>
  add(p, Math.max(rx, ry, rz) < 0.014 ? S8() : S14(), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
const dot = (p: O, c: string, x: number, y: number, z: number, r: number) => add(p, S8(), mat(c), x, y, z, r, r, r);
const glowDot = (p: O, c: string, e: string, x: number, y: number, z: number, r: number) => add(p, S8(), mat(c, { emissive: e }), x, y, z, r, r, r);
/** centred box */
const cb = (p: O, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
  add(p, g('lc1-box', () => new THREE.BoxGeometry(1, 1, 1)), mat(c), x, y, z, sx, sy, sz, ry, rx, rz);
/** torus (ring of radius R, tube t·R) lying in the local XY plane */
const torus = (p: O, c: string, x: number, y: number, z: number, R: number, t: number, ry = 0, rx = 0, rz = 0, arc = TAU) =>
  add(p, g(`lc1-tor${t.toFixed(3)}-${arc.toFixed(2)}`, () => new THREE.TorusGeometry(1, t, 6, arc < TAU ? 12 : 24, arc)), mat(c), x, y, z, R, R, R, ry, rx, rz);
const fw = (ry: number): V3 => [Math.sin(ry), 0, Math.cos(ry)];
const off = (a: V3, ry: number, f: number, up: number, side = 0): V3 =>
  [a[0] + Math.sin(ry) * f + Math.cos(ry) * side, a[1] + up, a[2] + Math.cos(ry) * f - Math.sin(ry) * side];

/** Noise-displaced rock (cached per seed/colour) with layered limestone strata painted on. */
function rock(p: O, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, seed = 0, ry = 0, strata = true): THREE.Mesh {
  const geo = g(`lc1-rock${seed % 6}-${c}-${strata}`, () => {
    const geo0 = new THREE.IcosahedronGeometry(1, 2);
    const pos = geo0.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const k = 0.72 + 0.55 * fbm(px * 1.6 + seed * 3.7, py * 1.6 + seed, pz * 1.6 - seed * 1.3, 3);
      pos.setXYZ(i, px * k, py * k * (1 + (strata ? Math.round(py * 3) * 0.03 : 0)), pz * k);
    }
    geo0.computeVertexNormals();
    return paintFaces(geo0, c, (px, py, pz, _nx, ny) => {
      const n = fbm(px * 3 + seed, py * 3, pz * 3, 2);
      if (strata && Math.floor(py * 7 + n * 0.8) % 3 === 0) return shade(c, 0.86);
      if (ny < -0.4) return shade(c, 0.7);
      return n > 0.62 ? shade(c, 1.1) : n < 0.36 ? shade(c, 0.92) : null;
    });
  });
  return add(p, geo, mat('#ffffff', { vc: true }), x, y, z, sx, sy, sz, ry);
}

/**
 * The shared museum plinth (uniform dark side, see prims.plinth) with a finely ringed painted top laid over it
 * (so `paint` can draw paths, fields and patches). `_side` is ignored: every diorama uses PLINTH_SIDE. Returns top height.
 */
function ground(p: O, R: number, top: string, _side?: string, h = 0.035, paint?: Paint): number {
  h = Math.max(h, 0.035);
  plinth(p, top, { R, h });
  const rings: [number, number][] = [[0, h + 0.002]];
  for (let i = 1; i <= 14; i++) rings.push([R * 0.965 * (i / 14), h + 0.002]);
  const lg = new THREE.LatheGeometry(rings.reverse().map(([r, y]) => new THREE.Vector2(r, y)), 56);
  lg.computeVertexNormals();
  const pg = paintFaces(lg, top, paint ?? ((x, _y, z) => {
    const n = fbm(x * 9, 0, z * 9, 3);
    return n > 0.62 ? shade(top, 1.07) : n < 0.38 ? shade(top, 0.93) : null;
  }));
  add(p, pg, mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
  return h + 0.002;
}

/** Lathe with painted faces; the profile is resampled every `step` so bands can carry patterns. */
function plathe(p: O, pts: [number, number][], base: string, paint: Paint | undefined, x = 0, y = 0, z = 0, seg = 28, step = 0.012, o: { metal?: number; rough?: number } = {}): THREE.Mesh {
  const fine: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i], [r1, y1] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / step));
    for (let k = 0; k < n; k++) fine.push([r0 + (r1 - r0) * (k / n), y0 + (y1 - y0) * (k / n)]);
  }
  fine.push(pts[pts.length - 1]);
  const lg = new THREE.LatheGeometry(fine.map(([r, yy]) => new THREE.Vector2(r, yy)), seg);
  lg.computeVertexNormals();
  return add(p, paintFaces(lg, base, paint), mat('#ffffff', { vc: true, flat: false, ...o }), x, y, z, 1, 1, 1);
}

/** Flame tongues in a 'flicker' group + embers + a 'smoke' column. */
const FLAME = () => g('lc1-flame', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0));
const ICO = () => g('lc1-ico', () => new THREE.IcosahedronGeometry(1, 0));
function fire(p: O, x: number, y: number, z: number, s: number, smoke = true): void {
  const f = anim(p, 'flicker', x, y, z);
  add(f, FLAME(), mat('#ff9a3c', { emissive: '#ff6a10' }), 0, 0, 0, s, s * 1.7, s);
  add(f, FLAME(), mat('#ffd36a', { emissive: '#ffb020' }), s * 0.05, 0, s * 0.05, s * 0.55, s * 1.25, s * 0.55);
  add(f, FLAME(), mat('#ff9a3c', { emissive: '#ff6a10' }), s * 0.28, 0, -s * 0.1, s * 0.45, s * 0.95, s * 0.45, 0, 0.1, -0.25);
  add(f, FLAME(), mat('#ff9a3c', { emissive: '#ff6a10' }), -s * 0.25, 0, s * 0.12, s * 0.42, s * 1.0, s * 0.42, 0, -0.1, 0.25);
  for (let i = 0; i < 5; i++) glowDot(p, '#ff5a1a', '#e5300a', x + Math.cos(i * 1.3) * s * 0.45, y + 0.004, z + Math.sin(i * 1.3) * s * 0.45, s * 0.12);
  if (smoke) {
    const sm = anim(p, 'smoke', x, y + s * 1.6, z, { size: s * 0.45 });
    for (let i = 0; i < 6; i++) add(sm, ICO(), mat('#cfcac2', { transparent: 0.5 }), 0, 0, 0, 0.01, 0.01, 0.01);
  }
}

/** A person (small diorama figure) with sensible defaults. */
function man(p: O, x: number, y: number, z: number, o: Partial<HumanOpts> & { h: number; top: string }): HumanRig {
  return human(p, x, y, z, { skin: '#d9a77c', hair: '#1c1714', shoes: '#2a2018', detail: 'hi', ...o });
}
/** 跽坐 kneeling-sitting on the heels, robe spread (Zhou/Han manner of sitting on mats). */
function seiza(p: O, x: number, y: number, z: number, o: Partial<HumanOpts> & { h: number; top: string }): HumanRig {
  return man(p, x, y, z, {
    dress: 'ankle', hipY: 0.17, feet: [[-0.07, 0.03, -0.2], [0.07, 0.03, -0.2]],
    hands: [[-0.07, 0.24, 0.17], [0.07, 0.24, 0.17]], ...o,
  });
}
/** Long white (or dark) beard hanging from the chin of a human rig. */
function beard(p: O, r: HumanRig, ry: number, h: number, c: string, len = 1): void {
  const a = off(r.head, ry, 0.045 * h, -0.05 * h - 0.03 * h * len);
  el(p, c, a[0], a[1], a[2], 0.034 * h, 0.05 * h * len, 0.024 * h, ry, 0.15);
  const m = off(r.head, ry, 0.058 * h, -0.025 * h);
  el(p, c, m[0], m[1], m[2], 0.03 * h, 0.009 * h, 0.012 * h, ry);
}
/** Arrow (shaft, bronze head at b, fletching at a). */
function arrow(p: O, a: V3, b: V3, s = 1, fletch = '#e9e2cf'): void {
  rod(p, a, b, 0.0022 * s, '#a07a48', 4);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const tip = strut(p, b, [b[0] + d.x * 0.016 * s, b[1] + d.y * 0.016 * s, b[2] + d.z * 0.016 * s], 0.005 * s, 0.0005, '#8a6a3a', 4);
  tip.castShadow = false;
  rod(p, a, [a[0] + d.x * 0.03 * s, a[1] + d.y * 0.03 * s, a[2] + d.z * 0.03 * s], 0.005 * s, fletch, 3);
}
/** A recurved composite bow held at `hand`, string drawn to `pull`; `up` is the bow's long axis, `out` points away from the archer. */
function bow(p: O, hand: V3, pull: V3, up: V3, out: V3, L = 0.11, c = '#3b2416'): void {
  const P = (k: number, o: number): V3 => [hand[0] + up[0] * k + out[0] * o, hand[1] + up[1] * k + out[1] * o, hand[2] + up[2] * k + out[2] * o];
  const pts: V3[] = [P(-L, -0.02 * L / 0.11), P(-L * 0.8, 0.004), P(-L * 0.4, 0.016), P(0, 0.014), P(L * 0.4, 0.016), P(L * 0.8, 0.004), P(L, -0.02 * L / 0.11)];
  sweep(p, pts.map(q => ({ p: q, w: 0.0035 })), c, { radial: 5, sub: 3 });
  rod(p, pts[0], pull, 0.0007, '#efe6cf', 3);
  rod(p, pts[6], pull, 0.0007, '#efe6cf', 3);
}

// ---------------------------------------------------------------------------------------------------------------
// 北京人 PEKING MAN at Zhoukoudian (default): Locality 1 "Ape-man Cave" (猿人洞) is a big collapsed limestone cave in
// Longgu Hill; its 40 m of deposits hold ash layers, quartz choppers and burnt deer bones (Wikipedia "Peking Man",
// "Zhoukoudian"; Zhoukoudian Site Museum reconstructions: naked, dark-skinned, heavy brow, low skull).
// r.style 'yuanmou' — 元谋人 (Yuanmou Man, c. 1.7 Ma, Yunnan): no cave; the dry-hot Yuanmou basin with its red/ochre
// earth-pillar badlands (元谋土林), open grass savanna and a small group knapping crude stone choppers and scrapers
// (Baidu Baike "元谋人", "元谋土林").
// ---------------------------------------------------------------------------------------------------------------
const HIDE = '#6a5038', HSKIN = '#7a5236';
function hominin(p: O, x: number, y: number, z: number, ry: number, h: number, o: Partial<HumanOpts> = {}): HumanRig {
  // bare torso and limbs (the body hair is not modelled as a fur suit), a hide wrap round the hips
  const r = man(p, x, y, z, { h, ry, top: HSKIN, bottom: HIDE, shorts: true, sleeve: 0, skin: HSKIN, hair: '#2a1d14', shoes: HSKIN, build: 1.15, ...o });
  // heavy brow ridge, receding forehead and jaw, low long braincase
  const b = off(r.head, ry, 0.05 * h, 0.016 * h), j = off(r.head, ry, 0.04 * h, -0.032 * h);
  el(p, shade(HSKIN, 0.85), b[0], b[1], b[2], 0.05 * h, 0.014 * h, 0.02 * h, ry);
  el(p, HSKIN, j[0], j[1], j[2], 0.04 * h, 0.028 * h, 0.028 * h, ry);
  const m = off(r.head, ry, -0.02 * h, 0.014 * h);
  el(p, '#2a1d14', m[0], m[1], m[2], 0.06 * h, 0.046 * h, 0.066 * h, ry, -0.3);
  return r;
}
function bone(p: O, a: V3, b: V3, r: number, c = '#d8cdb2'): void {
  rod(p, a, b, r, c, 5);
  for (const q of [a, b]) { dot(p, c, q[0] + r * 0.9, q[1], q[2], r * 1.4); dot(p, c, q[0] - r * 0.9, q[1], q[2], r * 1.4); }
}
function antler(p: O, x: number, y: number, z: number, ry: number, s: number, c = '#b8a580'): void {
  const A = grp(p, x, y, z, ry, s);
  tube(A, [[0, 0.01, 0], [0.05, 0.02, 0.01], [0.1, 0.035, 0.0], [0.15, 0.06, -0.02]], 0.008, 0.004, c, { radial: 5, sub: 3 });
  for (const [t, dx, dy, dz] of [[0.03, 0.01, 0.04, 0.02], [0.08, 0.015, 0.045, 0.025], [0.125, 0.02, 0.04, -0.01]]) rod(A, [t, 0.02 + t * 0.2, 0], [t + dx, 0.02 + t * 0.2 + dy, dz], 0.004, c, 4);
}
/** Flaked stone chopper / scraper (grey quartz or chert). */
const flake = (p: O, x: number, y: number, z: number, s: number, seed: number, c = '#8f8a80') => rock(p, c, x, y + s * 0.4, z, s, s * 0.55, s * 0.8, seed, seed, false);
/** 土林 earth pillar: an eroded, fluted column of layered red, ochre and pale sediment with a darker cap. */
function earthPillar(p: O, x: number, y: number, z: number, r: number, h: number, seed: number): void {
  const geo = g(`lc1-pillar${seed}`, () => {
    const c0 = new THREE.CylinderGeometry(1, 1, 1, 14, 14, false);
    c0.translate(0, 0.5, 0);
    const pos = c0.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), a = Math.atan2(pz, px);
      // wide skirt of washed-down sediment, a slowly tapering fluted column and a rounded, slightly hooded top
      const prof = py < 0.12 ? 1.25 - py * 2.6 : py > 0.86 ? 0.5 * Math.sqrt(Math.max(0, 1 - ((py - 0.86) / 0.14) ** 2)) + 0.04 : 0.95 - py * 0.5;
      const flute = 1 - 0.16 * Math.abs(Math.sin(a * 4 + seed)) - 0.14 * fbm(a * 2 + seed, py * 5, seed, 2);
      const lean = 0.06 * py * Math.sin(seed);
      pos.setXYZ(i, px * prof * flute + lean, py, pz * prof * flute);
    }
    c0.computeVertexNormals();
    return paintFaces(c0, '#b5643c', (px, py, pz) => {
      const n = fbm(px * 4 + seed, py * 6, pz * 4, 2), band = Math.floor(py * 7 + n * 0.8);
      if (py > 0.9) return '#7a5a3e';
      return ['#a85f3c', '#b97a4c', '#c9a77c', '#9c5538', '#b06a44'][band % 5];
    });
  });
  add(p, geo, mat('#ffffff', { vc: true }), x, y, z, r, h, r * (0.85 + hash3(seed, 1, 2) * 0.3), seed);
}
/** A clump of dry savanna grass. */
function tussock(p: O, x: number, y: number, z: number, s: number, c = '#a39258'): void {
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26, l = s * (0.8 + hash3(i, x * 9, z * 9) * 0.5);
    strut(p, [x, y, z], [x + Math.cos(a) * l * 0.35, y + l, z + Math.sin(a) * l * 0.35], s * 0.08, 0.0008, i % 2 ? c : shade(c, 0.85), 3);
  }
}
const lf_pekingman: Builder = (gp, r) => {
  if (str(r.style, '') === 'yuanmou') {
    const Y = ground(gp, 0.46, '#a8744a', '#6e4a30', 0.03, (x, _y, z) => {
      const n = fbm(x * 8, 0, z * 8, 3);
      return n > 0.62 ? '#a39a62' : n > 0.55 ? '#9a8a58' : n < 0.36 ? '#965f3c' : null;
    });
    // the earth forest rising behind: a cluster of tall pillars with lower eroded mounds in front of them
    const P: [number, number, number, number][] = [
      [-0.3, -0.25, 0.06, 0.34], [-0.19, -0.32, 0.055, 0.42], [-0.07, -0.36, 0.05, 0.3], [0.04, -0.33, 0.06, 0.46],
      [0.16, -0.3, 0.045, 0.33], [0.28, -0.23, 0.055, 0.38], [-0.38, -0.07, 0.045, 0.2], [0.37, -0.05, 0.04, 0.17],
      [-0.12, -0.22, 0.035, 0.17], [0.1, -0.2, 0.032, 0.14],
    ];
    P.forEach(([x, z, rr, h], i) => earthPillar(gp, x, Y - 0.005, z, rr, h, i));
    for (const [x, z, s] of [[-0.25, -0.15, 0.07], [0.24, -0.14, 0.06], [0.0, -0.25, 0.08]] as [number, number, number][]) earthPillar(gp, x, Y - 0.01, z, s, s * 0.9, 11 + Math.round(s * 100));
    rock(gp, '#a8603e', 0, Y, -0.36, 0.36, 0.08, 0.08, 2, 0, true);
    // two thin acacia-like savanna trees
    for (const [x, z, s] of [[0.36, 0.12, 1], [-0.38, 0.16, 0.8]] as [number, number, number][]) {
      tube(gp, [[x, Y, z], [x + 0.01 * s, Y + 0.12 * s, z], [x - 0.02 * s, Y + 0.22 * s, z + 0.01]], 0.007 * s, 0.004 * s, '#4a3a2a', { radial: 5, sub: 3 });
      for (const [dx, dz, dy] of [[-0.04, 0.0, 0], [0.025, 0.025, 0.01], [0.0, -0.03, -0.006], [0.035, -0.02, 0.004]]) rock(gp, '#5f6640', x - 0.02 * s + dx * s, Y + (0.235 + dy) * s, z + dz * s, 0.035 * s, 0.012 * s, 0.03 * s, 3, dx * 20, false);
    }
    // the band: a knapper squatting at a cobble anvil, a second carrying a long digging stick, a third with a chopper
    const h = 0.2;
    const K = hominin(gp, -0.06, Y, 0.1, 0.5, h * 0.95, { pose: 'crouch' });
    rock(gp, '#7f7a70', K.handL[0] + 0.012, Y + 0.012, K.handL[2] + 0.02, 0.028, 0.016, 0.022, 3, 0, false);
    flake(gp, K.handR[0], K.handR[1] - 0.008, K.handR[2], 0.012, 2);
    for (let i = 0; i < 7; i++) flake(gp, -0.02 + hash3(i, 2, 1) * 0.1, Y, 0.16 + hash3(i, 7, 3) * 0.06, 0.006 + hash3(i, 1, 1) * 0.005, i, i % 3 ? '#9a948a' : '#c2b8a4');
    const S = hominin(gp, 0.16, Y, 0.04, -0.5, h, { pose: 'walk', phase: 0.3, lean: 0.1 });
    rod(gp, [S.handR[0] - 0.02, S.handR[1] - 0.06, S.handR[2] + 0.03], [S.handR[0] + 0.03, S.handR[1] + 0.12, S.handR[2] - 0.05], 0.003, '#6a5036', 5);
    const C = hominin(gp, 0.06, Y, 0.27, 2.6, h * 0.9, { pose: 'stand', hands: [[-0.15, 0.46, 0.05], [0.17, 0.5, 0.14]] });
    flake(gp, C.handR[0], C.handR[1] - 0.006, C.handR[2], 0.013, 5);
    // remains of a meal: a split long bone and a deer antler (Yuanmou fauna includes deer and horse)
    bone(gp, [-0.28, Y + 0.006, 0.26], [-0.2, Y + 0.006, 0.3], 0.004);
    antler(gp, 0.25, Y, 0.26, -2.0, 0.7);
    for (let i = 0; i < 16; i++) tussock(gp, -0.42 + hash3(i, 3, 8) * 0.84, Y, -0.1 + hash3(i, 9, 2) * 0.5, 0.025 + hash3(i, 5, 5) * 0.015);
    return;
  }
  const Y = ground(gp, 0.46, '#7d6e56', '#544637', 0.03, (x, _y, z) => {
    const n = fbm(x * 9, 0, z * 9, 3);
    return Math.hypot(x - 0.06, z - 0.16) < 0.12 ? (n > 0.5 ? '#4e4740' : '#5c544a') : n > 0.62 ? '#86775e' : n < 0.38 ? '#706250' : null;
  });
  const LS = '#a29d92';
  // a broad, low limestone cave mouth: dark interior, two buttresses and a long overhanging roof
  el(gp, '#151310', 0, 0.17, -0.3, 0.3, 0.17, 0.08);
  rock(gp, LS, -0.34, 0.17, -0.2, 0.15, 0.22, 0.16, 1);
  rock(gp, LS, 0.35, 0.16, -0.19, 0.14, 0.21, 0.17, 2, 0.6);
  rock(gp, shade(LS, 0.9), 0, 0.26, -0.37, 0.44, 0.28, 0.09, 4);
  rock(gp, shade(LS, 0.96), 0.0, 0.37, -0.23, 0.44, 0.1, 0.19, 3);
  rock(gp, LS, -0.14, 0.46, -0.3, 0.2, 0.06, 0.12, 0, 1);
  rock(gp, shade(LS, 1.03), 0.16, 0.45, -0.28, 0.18, 0.05, 0.11, 2, 2);
  // sparse scrub (thorny jujube, grass) clinging to the hill above the cave
  // (Commons "Zhoukoudian-5.jpg": pale, fractured grey limestone crag with shrubs and small trees on its top)
  for (const [x, z, sc] of [[-0.22, -0.3, 1], [-0.04, -0.36, 0.8], [0.12, -0.3, 0.9], [0.28, -0.3, 0.75], [0.36, -0.2, 0.6], [-0.34, -0.18, 0.7]] as [number, number, number][]) tree(gp, x, 0.45 + (x * x) * -0.5, z, 0.075 * sc, '#5f6e45', false);
  for (const [x, z] of [[-0.12, -0.2], [0.22, -0.2], [0.42, -0.08]] as const) rock(gp, '#5c6046', x, 0.47 - x * x * 0.8 - (x > 0.4 ? 0.3 : 0), z, 0.03, 0.014, 0.026, 3, x * 9, false);
  rock(gp, shade(LS, 0.92), -0.4, 0.05, -0.02, 0.06, 0.05, 0.06, 5);
  rock(gp, shade(LS, 0.95), 0.41, 0.04, 0.04, 0.05, 0.04, 0.05, 1);
  for (const [sx, l] of [[-0.1, 0.05], [0.0, 0.035], [0.12, 0.06], [-0.2, 0.03]]) {
    const c = cone(gp, shade(LS, 0.88), sx, 0.29 - l, -0.17, 0.01, l, 5);
    c.rotation.x = Math.PI;
  }
  // hearth on its ash bed, with burnt logs and a low fire
  const fx = 0.06, fz = 0.16;
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; rock(gp, '#7b746a', fx + Math.cos(a) * 0.055, Y + 0.006, fz + Math.sin(a) * 0.055, 0.014, 0.011, 0.013, i, a, false); }
  for (let i = 0; i < 4; i++) { const a = i * 0.8; rod(gp, [fx - Math.cos(a) * 0.04, Y + 0.005, fz - Math.sin(a) * 0.04], [fx + Math.cos(a) * 0.028, Y + 0.022, fz + Math.sin(a) * 0.028], 0.005, '#2e241a', 5); }
  fire(gp, fx, Y + 0.008, fz, 0.035);
  // standing hunter with a quartz chopper at the cave mouth; a second squats feeding the fire
  const h = 0.22;
  const A = hominin(gp, -0.17, Y, 0.02, 0.45, h, { lean: 0.22, hands: [[-0.14, 0.44, 0.08], [0.15, 0.43, 0.14]] });
  flake(gp, A.handR[0], A.handR[1] - 0.008, A.handR[2] + 0.004, 0.014, 2, '#b8b2a6');
  const B = hominin(gp, 0.2, Y, 0.14, -1.35, h * 0.95, { pose: 'crouch' });
  rod(gp, B.handL, [fx + 0.02, Y + 0.015, fz], 0.003, '#3e2c1c', 4);
  // a third, younger one sitting against the wall
  hominin(gp, -0.02, Y, -0.12, 0.2, h * 0.85, { pose: 'sitGround' });
  // burnt and split deer bones, antlers and stone flakes on the floor
  bone(gp, [-0.3, Y + 0.006, 0.22], [-0.21, Y + 0.006, 0.27], 0.005);
  bone(gp, [0.17, Y + 0.006, 0.3], [0.25, Y + 0.006, 0.27], 0.004, '#4a3e32');
  bone(gp, [-0.06, Y + 0.005, 0.33], [0.0, Y + 0.005, 0.37], 0.0035);
  antler(gp, -0.36, Y, 0.1, 0.6, 0.85);
  antler(gp, 0.28, Y, -0.02, -2.2, 0.75);
  for (let i = 0; i < 8; i++) flake(gp, -0.38 + hash3(i, 1, 1) * 0.76, Y, 0.08 + hash3(i, 5, 2) * 0.3, 0.007 + hash3(i, 2, 2) * 0.005, i, i % 3 ? '#8f897e' : '#c2bcae');
};

// ---------------------------------------------------------------------------------------------------------------
// 钻木取火 MAKING FIRE: a kneeling man spins a hand-drill (钻) into a hearth board over a tinder nest — the 燧人氏
// legend set in the Palaeolithic, when Zhoukoudian's ash layers show fire was kept. Ethnographic hand-drill
// technique (Wikipedia "Fire drill"); hide clothing after the Upper Palaeolithic Shandingdong bone needle. A
// stone-ringed hearth, a modest haunch roasting on a forked-stake spit, firewood and a dead tree.
// ---------------------------------------------------------------------------------------------------------------
// Ref (photo sheet): Commons Zhoukoudian cave views — hearth ash lenses in a grey limestone cave mouth.
const lf_fire: Builder = gp => {
  const Y = ground(gp, 0.46, '#7d6e52', '#56493a', 0.03, (x, _y, z) => {
    const n = fbm(x * 8, 0, z * 8, 3);
    return n > 0.62 ? '#7a7650' : n > 0.56 ? '#857a58' : n < 0.35 ? '#6e604a' : null;
  });
  const SK = '#a87a56', HD = '#7a5e40';
  const dress = { skin: SK, hair: '#241a12', shoes: SK, sleeve: 0, shorts: true, top: SK, bottom: HD } as const;
  // the fire-maker: kneeling, palms pressed round the drill
  const FG = grp(gp, -0.15, Y, 0.1, 0.55);
  const h = 0.24, bz = 0.075;
  man(FG, 0, 0, 0, { h, pose: 'kneel', lean: 0.35, ...dress, hands: [[-0.03, 0.4, bz / h], [0.03, 0.43, bz / h]] });
  el(FG, HD, 0, 0.6 * h, -0.05 * h, 0.07 * h, 0.1 * h, 0.035 * h, 0, 0.2); // hide cape over the back
  cb(FG, '#8e7048', 0, 0.004, bz, 0.09, 0.008, 0.026, 0.15);
  cyl(FG, '#2a1c12', 0.012, 0.008, bz + 0.003, 0.005, 0.001, 8);
  rod(FG, [0.012, 0.008, bz], [0.012, 0.47 * h, bz], 0.0028, '#a8865a', 5);
  glowDot(FG, '#ff7a2a', '#ff4a10', 0.012, 0.01, bz, 0.004);
  const sm = anim(FG, 'smoke', 0.012, 0.016, bz, { size: 0.01 });
  for (let i = 0; i < 4; i++) add(sm, ICO(), mat('#d8d3cb', { transparent: 0.5 }), 0, 0, 0, 0.01, 0.01, 0.01);
  // tinder nest of dry grass and shredded bark
  for (let i = 0; i < 9; i++) { const a = i * 0.7; rod(FG, [0.05 + Math.cos(a) * 0.016, 0.004, bz + 0.016 + Math.sin(a) * 0.012], [0.05 - Math.cos(a) * 0.016, 0.01, bz + 0.016 - Math.sin(a) * 0.012], 0.0015, '#b8a468', 3); }
  el(FG, '#a8965e', 0.05, 0.007, bz + 0.016, 0.017, 0.008, 0.014);
  // hearth: ash bed, ring of river cobbles, a low wood fire
  const hx = 0.12, hz = -0.04;
  cyl(gp, '#4a443c', hx, Y - 0.001, hz, 0.075, 0.003, 18);
  for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU; rock(gp, i % 2 ? '#857f74' : '#726c63', hx + Math.cos(a) * 0.072, Y + 0.008, hz + Math.sin(a) * 0.072, 0.016, 0.013, 0.015, i, a, false); }
  for (let i = 0; i < 5; i++) { const a = i * 1.25; rod(gp, [hx - Math.cos(a) * 0.05, Y + 0.004, hz - Math.sin(a) * 0.05], [hx + Math.cos(a) * 0.008, Y + 0.032, hz + Math.sin(a) * 0.008], 0.005, '#2e2218', 5); }
  fire(gp, hx, Y + 0.008, hz, 0.04);
  // forked stakes, spit and a small skinned haunch, browned and charred
  const sy = Y + 0.13;
  for (const sx of [-1, 1]) {
    const x = hx + sx * 0.1;
    rod(gp, [x, Y, hz], [x, sy - 0.008, hz], 0.004, '#5a4630', 5);
    rod(gp, [x, sy - 0.01, hz], [x - 0.01, sy + 0.014, hz], 0.0028, '#5a4630', 4);
    rod(gp, [x, sy - 0.01, hz], [x + 0.01, sy + 0.014, hz], 0.0028, '#5a4630', 4);
  }
  rod(gp, [hx - 0.13, sy, hz], [hx + 0.13, sy, hz], 0.0025, '#6b5236', 5);
  sweep(gp, [
    { p: [hx - 0.045, sy, hz], w: 0.016, h: 0.019 }, { p: [hx - 0.015, sy - 0.002, hz], w: 0.018, h: 0.02 },
    { p: [hx + 0.015, sy - 0.003, hz], w: 0.011, h: 0.012 }, { p: [hx + 0.045, sy - 0.002, hz], w: 0.005, h: 0.006 },
  ], '#6e3e24', { radial: 9, sub: 3, paint: (x, y) => (x > hx + 0.03 ? '#cfc2a4' : y > sy + 0.01 ? '#4a2a18' : hash3(Math.floor(x * 300), Math.floor(y * 300), 1) > 0.7 ? '#7e4a2c' : null) });
  // a woman sitting by the fire, warming her hands
  man(gp, 0.27, Y, 0.15, { h: 0.22, ry: -2.2, pose: 'sitGround', ...dress, hands: [[-0.06, 0.25, 0.28], [0.06, 0.25, 0.28]] });
  // firewood stack, scattered cobbles and a dead, bare tree
  for (let i = 0; i < 6; i++) rod(gp, [-0.33 + i * 0.01, Y + 0.006 + (i % 2) * 0.009, -0.22 - i * 0.008], [-0.16 + i * 0.01, Y + 0.006 + (i % 2) * 0.009, -0.28 - i * 0.008], 0.006, i % 2 ? '#6b5236' : '#5a4630', 5);
  for (let i = 0; i < 7; i++) rock(gp, '#8a8378', -0.42 + hash3(i, 9, 1) * 0.84, Y + 0.004, -0.38 + hash3(i, 3, 7) * 0.3, 0.016, 0.011, 0.014, i, i * 0.7, false);
  tube(gp, [[0.33, Y, -0.24], [0.335, Y + 0.14, -0.255], [0.32, Y + 0.28, -0.27]], 0.009, 0.004, '#5a4a3a', { radial: 6, sub: 3 });
  for (const [bx, by, ex, ey, ez] of [[0.334, 0.12, 0.07, 0.07, 0.02], [0.33, 0.18, -0.06, 0.08, -0.02], [0.326, 0.23, 0.04, 0.07, -0.04], [0.33, 0.09, -0.04, 0.05, 0.03]]) rod(gp, [bx, Y + by, -0.255], [bx + ex, Y + by + ey, -0.255 + ez], 0.0025, '#5a4a3a', 4);
  for (let i = 0; i < 12; i++) tussock(gp, -0.42 + hash3(i, 1, 4) * 0.84, Y, -0.2 + hash3(i, 6, 2) * 0.6, 0.022, '#8c8458');
};

// ---------------------------------------------------------------------------------------------------------------
// 二里头铜爵 THE ERLITOU JUE: the 乳钉纹铜爵 ("China's first jue", Erlitou Xia capital site museum) — 26.5 cm tall,
// 31.5 cm spout to tail, walls ~1 mm: a long narrow spout, a long pointed tail, two short nail posts, a slender
// waisted flat-bottomed body with a band of five nipple studs between raised lines, a side handle and three thin
// conical legs; undecorated, no taotie yet. Beside it a plain Erlitou 斝 and a white-pottery 盉 (bag-legged ewer),
// set out on a reed mat on the rammed-earth floor (Erlitou tombs: bronze, white pottery and cinnabar).
// ---------------------------------------------------------------------------------------------------------------
/** Open trough (spout / tail) along a polyline: an outer bronze shell and a dark inner surface. */
function trough(p: O, pts: V3[], w0: number, w1: number, c: string, d0 = 0.85, d1 = 0.85): void {
  const rings = (k: number): V3[][] => pts.map((q, i) => {
    const t = i / (pts.length - 1), w = (w0 + (w1 - w0) * t) * k, dd = d0 + (d1 - d0) * t, out: V3[] = [];
    for (let j = 0; j <= 6; j++) { const a = (j / 6) * Math.PI; out.push([q[0], q[1] - Math.sin(a) * w * dd, q[2] + Math.cos(a) * w]); }
    return out;
  });
  skin(p, rings(1), c, { closed: false, flat: true });
  skin(p, rings(0.9), '#3e463a', { closed: false, inward: true, flat: true });
}
const PAT_E = '#6b7a63';
/** Excavated bronze: dull grey-green patina with earthy encrustation, no polished spots. */
const erPaint: Paint = (x, y, z) => {
  const n = fbm(x * 0.9, y * 0.9, z * 0.9, 2);
  return n > 0.64 ? '#7e7a5e' : n > 0.58 ? '#74806a' : n < 0.34 ? '#56654f' : null;
};
/** Erlitou nipple-stud jue, modelled in centimetres (s = model units per cm); spout points +x, studs face +z. */
function erlitouJue(p: O, x: number, y: number, z: number, s: number, ry: number): void {
  const J = grp(p, x, y, z, ry, s);
  const pt = erPaint, by = 11;
  // three thin conical legs splaying out from the flat bottom
  for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) strut(J, [Math.cos(a) * 1.8, by + 0.3, Math.sin(a) * 1.5], [Math.cos(a) * 4.6, 0, Math.sin(a) * 3.8], 0.75, 0.12, shade(PAT_E, 0.92), 6);
  // slender waisted body, oval in plan, thin-lipped at the top
  const body = plathe(J, [[0, 0], [3.4, 0], [3.6, 0.6], [3.2, 3.5], [3.0, 5.5], [3.2, 8.2], [3.7, 10.2], [3.5, 10.2], [2.9, 8], [0, 7.5]], PAT_E, pt, 0, by, 0, 24, 0.5);
  body.scale.set(1.15, 1, 0.82);
  // two raised lines and the five studs between them on the front face
  for (const ly of [4.4, 6.8]) torus(J, shade(PAT_E, 1.06), 0, by + ly, 0, 3.05, 0.035, 0, Math.PI / 2).scale.set(3.05 * 1.15, 3.05 * 0.82, 3.05);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i - 2) * 0.32, cx = Math.cos(a) * 3.12 * 1.15, cz = Math.sin(a) * 3.12 * 0.82;
    dot(J, shade(PAT_E, 1.08), cx, by + 5.6, cz, 0.38);
  }
  // long narrow spout rising forward, long pointed tail behind
  // (deep where they leave the body, shallowing towards the tips)
  trough(J, [[2.2, by + 10, 0], [7, by + 10.8, 0], [12, by + 12, 0], [16.5, by + 13.2, 0]], 1.5, 0.9, shade(PAT_E, 1.03), 2.2, 0.6);
  trough(J, [[-2.2, by + 10, 0], [-7, by + 11.2, 0], [-11, by + 12.6, 0], [-14.5, by + 14, 0]], 1.5, 0.12, shade(PAT_E, 1.03), 2.0, 0.5);
  // short nail-like posts at the root of the spout
  for (const sz of [-1, 1]) {
    cyl(J, PAT_E, 3.4, by + 9.6, sz * 1.9, 0.32, 2.2, 6);
    lathe(J, [[0, 0], [0.55, 0], [0.6, 0.25], [0.3, 0.6], [0, 0.65]], shade(PAT_E, 1.06), 3.4, by + 11.8, sz * 1.9, 8);
  }
  // flat strap handle (鋬) on the back, opposite the studs
  tube(J, [[0, by + 8.6, -2.5], [0, by + 8.4, -4.6], [0, by + 5, -5], [0, by + 2.2, -2.9]], 0.45, 0.4, PAT_E, { radial: 6, sub: 3 }).scale.x = 1.8;
}
/** Plain Erlitou 斝: flaring mouth with two posts, waisted body, flat bottom, three hollow conical legs, side handle. */
function erlitouJia(p: O, x: number, y: number, z: number, s: number, ry: number): void {
  const J = grp(p, x, y, z, ry, s);
  const pt = erPaint, by = 8;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 3;
    strut(J, [Math.cos(a) * 3, by + 0.5, Math.sin(a) * 3], [Math.cos(a) * 5.6, 0, Math.sin(a) * 5.6], 1.5, 0.15, shade(PAT_E, 0.92), 6);
  }
  plathe(J, [[0, 0], [4.6, 0], [5, 0.8], [5, 4], [4.2, 6.5], [4.4, 9.5], [6.2, 13], [6.0, 13], [4.0, 9.6], [0, 9]], PAT_E, pt, 0, by, 0, 26, 0.5);
  torus(J, shade(PAT_E, 1.06), 0, by + 3, 0, 5.02, 0.04, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i - 2) * 0.3; dot(J, shade(PAT_E, 1.08), Math.cos(a) * 5.05, by + 2.2, Math.sin(a) * 5.05, 0.4); }
  for (const sz of [-1, 1]) {
    cyl(J, PAT_E, 0, by + 11.6, sz * 4.9, 0.35, 2.8, 6);
    lathe(J, [[0, 0], [0.7, 0], [0.75, 0.3], [0.35, 0.75], [0, 0.8]], shade(PAT_E, 1.06), 0, by + 14.3, sz * 4.9, 8);
  }
  tube(J, [[-4.3, by + 8, 0], [-6.6, by + 7.6, 0], [-6.6, by + 3, 0], [-4.8, by + 1.8, 0]], 0.5, 0.45, PAT_E, { radial: 6, sub: 3 });
}
/** Erlitou white-pottery 盉: three plump bag legs, a domed top with a mouth and an upturned tubular spout, a handle. */
function whiteHe(p: O, x: number, y: number, z: number, s: number, ry: number): void {
  const H = grp(p, x, y, z, ry, s);
  const C = '#cdbf9f', pt: Paint = (px, py, pz) => (hash3(Math.floor(px * 3), Math.floor(py * 3), Math.floor(pz * 3)) > 0.8 ? '#c4b89e' : null);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    el(H, C, Math.cos(a) * 2.6, 5.2, Math.sin(a) * 2.6, 2.7, 5.8, 2.7, 0, Math.sin(a) * 0.3, -Math.cos(a) * 0.3);
    cone(H, C, Math.cos(a) * 3.5, -0.2, Math.sin(a) * 3.5, 0.9, 2.4, 6).rotation.x = Math.PI;
  }
  plathe(H, [[0, 0], [5.2, 0], [5.6, 2], [5.2, 6], [4.2, 9.5], [2.6, 12.2], [1.6, 13.4], [0, 13.6]], C, pt, 0, 7, 0, 20, 0.6);
  cyl(H, shade(C, 0.95), -1.4, 19, 0, 1.7, 1.6, 12);
  cyl(H, '#3a342a', -1.4, 20.5, 0, 1.4, 0.15, 12);
  tube(H, [[1.6, 18, 0], [4.2, 21, 0], [6.2, 24, 0]], 1.0, 0.75, C, { radial: 8, sub: 3 });
  tube(H, [[-4.2, 16, 0], [-6.8, 15, 0], [-7.2, 10.5, 0], [-5.2, 8.6, 0]], 0.75, 0.75, C, { radial: 6, sub: 3 }).scale.z = 1.6;
}
// Ref: Commons "Bronze jue, Erlitou culture" / Shang jia photos — tall blade legs, long spout, grey-green patina.
const lf_jue: Builder = gp => {
  const Y = ground(gp, 0.46, '#8a7456', '#5e4c38', 0.03, (x, _y, z) => {
    const n = fbm(x * 10, 0, z * 10, 2);
    return Math.abs(x) < 0.38 && Math.abs(z - 0.02) < 0.25 ? null : n > 0.62 ? '#94805e' : n < 0.36 ? '#7c684c' : null;
  });
  // reed mat (席) in twill weave with a bound edge, a sprinkle of cinnabar at one side
  const MW = 0.72, MD = 0.46;
  for (let i = 0; i < 48; i++) {
    const x = -MW / 2 + (i + 0.5) * (MW / 48);
    cb(gp, i % 2 ? '#9e885f' : '#98835b', x, Y + 0.003, 0.02, MW / 48, 0.003, MD);
    for (let j = 0; j < 8; j++) if ((i + j) % 4 === 0) cb(gp, '#a48e66', x, Y + 0.0045, -MD / 2 + 0.02 + (j + 0.5) * (MD / 8), MW / 48 * 0.9, 0.0004, MD / 8 * 0.9);
  }
  for (const sz of [-1, 1]) cb(gp, '#7d6844', 0, Y + 0.004, 0.02 + sz * MD / 2, MW + 0.01, 0.005, 0.012);
  for (const sx of [-1, 1]) cb(gp, '#7d6844', sx * MW / 2, Y + 0.004, 0.02, 0.012, 0.005, MD + 0.01);
  for (let i = 0; i < 5; i++) cyl(gp, i % 2 ? '#8a4030' : '#7e3a2a', 0.34 + hash3(i, 1, 2) * 0.05, Y + 0.0005, -0.2 + hash3(i, 4, 3) * 0.1, 0.02 + hash3(i, 7, 7) * 0.015, 0.002, 9);
  const MY = Y + 0.006;
  erlitouJue(gp, 0.0, MY, 0.08, 0.0158, 0.2);
  erlitouJia(gp, -0.24, MY, -0.1, 0.0125, 0.6);
  whiteHe(gp, 0.25, MY, -0.08, 0.0118, -0.5);
};

// ---------------------------------------------------------------------------------------------------------------
// 井田制 WELL-FIELD SYSTEM: nine squares like the character 井 (《孟子·滕文公上》 "方里而井，井九百亩，其中为公田，八家
// 皆私百亩") — eight private plots around the central public field with its well and shaduf (桔槔); ridged furrows
// of millet, raised field paths (阡陌), peasants working with wooden 耒 and stone-bladed hoes, and the hamlet's
// semi-subterranean round houses with steep conical thatch (Western Zhou sites, e.g. 沣西 / 周原 dwellings).
// ---------------------------------------------------------------------------------------------------------------
function hut(p: O, x: number, y: number, z: number, ry: number, s = 1): void {
  const H = grp(p, x, y, z, ry, s);
  // low earth bank round the sunken floor, then a steep thatch cone almost to the ground
  plathe(H, [[0, 0], [0.058, 0], [0.054, 0.012], [0, 0.012]], '#8a7556', undefined, 0, 0, 0, 14, 0.01);
  plathe(H, [[0, 0.03], [0.048, 0.008], [0.056, 0.008], [0.052, 0.018], [0.03, 0.06], [0.012, 0.094], [0, 0.1]], '#a08a5c', (_x, py) => (Math.floor(py * 220) % 2 ? '#94804f' : null), 0, 0, 0, 16, 0.006);
  // sloping entrance passage with its little gable hood
  cb(H, '#2a2018', 0, 0.012, 0.05, 0.018, 0.022, 0.012);
  gable(H, 0.03, 0.02, 0.03, '#9a8456', 0, 0.022, 0.058, 0);
  rod(H, [0, 0.096, 0], [0, 0.112, 0], 0.003, '#6e5a3c', 4);
}
// Ref: Commons Han/Song well-field and rice-terrace paintings — a 3×3 grid of fields round a shared well, olive crops.
const lf_jingtian: Builder = gp => {
  const Y = ground(gp, 0.47, '#86744f', '#5c4d33', 0.03);
  const F = 0.18, P = 0.2;
  // raised field paths: 阡 (north–south) and 陌 (east–west), grassed
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const L = Math.abs(k) > 1 ? 0.5 : 0.62;
    cb(gp, '#7e7a52', k * P, Y + 0.006, 0, 0.016, 0.012, L);
    cb(gp, '#7e7a52', 0, Y + 0.006, k * P, L, 0.012, 0.016);
  }
  // nine fields: millet ripening, young millet, one freshly ploughed; the public field is cropped round the well
  const kinds = ['ripe', 'green', 'ripe', 'green', 'pub', 'plough', 'green', 'ripe', 'green'];
  for (let i = 0; i < 9; i++) {
    const cx = ((i % 3) - 1) * P, cz = (Math.floor(i / 3) - 1) * P, kind = kinds[i], along = (i % 2) === 0;
    const soil = kind === 'plough' ? '#6a5236' : '#76603f';
    cb(gp, soil, cx, Y + 0.002, cz, F, 0.003, F);
    const n = 9;
    for (let r = 0; r < n; r++) {
      const o = -F / 2 + (r + 0.5) * (F / n);
      if (kind === 'pub' && Math.abs(o) < 0.04) continue;
      const rx = along ? cx + o : cx, rz = along ? cz : cz + o, sx = along ? 0.011 : F * 0.94, sz = along ? F * 0.94 : 0.011;
      cb(gp, shade(soil, 1.1), rx, Y + 0.005, rz, sx, 0.005, sz);
      if (kind === 'plough') continue;
      const ripe = kind === 'ripe' || kind === 'pub';
      cb(gp, ripe ? '#9c8c56' : '#66744a', rx, Y + 0.012, rz, along ? 0.008 : F * 0.9, 0.012, along ? F * 0.9 : 0.008);
      cb(gp, ripe ? '#b09a5c' : '#74824e', rx, Y + 0.02, rz, along ? 0.01 : F * 0.88, 0.004, along ? F * 0.88 : 0.01);
    }
  }
  // the public field's well: stone curb and a shaduf with a stone counterweight
  cyl(gp, '#8d877c', 0, Y, 0, 0.02, 0.016, 12);
  cyl(gp, '#2e3a3a', 0, Y + 0.0155, 0, 0.015, 0.001, 12);
  const px = 0.035, pz = 0.018, py = Y + 0.085;
  rod(gp, [px, Y, pz], [px, py, pz], 0.0035, '#6b4a2c', 5);
  rod(gp, [px - 0.006, py - 0.008, pz], [px + 0.006, py + 0.008, pz], 0.0025, '#6b4a2c', 4);
  const a: V3 = [0.0, Y + 0.06, 0.0], b: V3 = [0.09, Y + 0.12, 0.028];
  rod(gp, a, b, 0.0025, '#7a5532', 5);
  rock(gp, '#7c766c', b[0], b[1] - 0.008, b[2], 0.011, 0.01, 0.011, 3, 0, false);
  rod(gp, a, [0, Y + 0.025, 0], 0.0008, '#3a2a1c', 3);
  plathe(gp, [[0, 0], [0.007, 0], [0.009, 0.012], [0.008, 0.012], [0, 0.003]], '#7a5532', undefined, 0, Y + 0.02, 0, 10);
  // peasants in undyed hemp: hoeing, digging with a two-pronged 耒, carrying water
  const H = 0.08, HEMP = ['#9a8f74', '#8a7a5e', '#a39470', '#7d6a52'];
  const hoer = (x: number, z: number, ry: number, top: string) => {
    const r = man(gp, x, Y + 0.004, z, { h: H, ry, lean: 0.45, top, bottom: '#5b4a36', hair: '#1c1714', hat: '#a08a5a', hatStyle: 'conical', sleeve: 0.45, shoes: '#6e5236', detail: 'lo', hands: [[-0.03, 0.55, 0.2], [0.03, 0.42, 0.24]] });
    const f = fw(ry), tip: V3 = [r.handR[0] + f[0] * 0.03, Y + 0.008, r.handR[2] + f[2] * 0.03];
    rod(gp, [r.handL[0] - f[0] * 0.01, r.handL[1] + 0.015, r.handL[2] - f[2] * 0.01], tip, 0.0013, '#7a5532', 4);
    cb(gp, '#7a766a', tip[0], tip[1], tip[2], 0.011, 0.002, 0.008, ry);
  };
  hoer(0.21, 0.19, 0.6, HEMP[0]);
  hoer(-0.2, -0.04, -0.4, HEMP[1]);
  hoer(0.14, 0.03, 2.6, HEMP[3]);
  hoer(-0.24, 0.24, 1.2, HEMP[2]);
  const dg = man(gp, 0.22, Y + 0.004, -0.2, { h: H, ry: -0.5, lean: 0.3, top: HEMP[1], bottom: '#5b4a36', hat: '#a08a5a', hatStyle: 'conical', sleeve: 0.45, detail: 'lo', hands: [[-0.02, 0.5, 0.18], [0.02, 0.62, 0.18]] });
  rod(gp, [dg.handR[0], dg.handR[1] + 0.008, dg.handR[2]], [dg.handR[0] + 0.006, Y + 0.004, dg.handR[2] + 0.02], 0.0012, '#7a5532', 4);
  const cr = man(gp, -0.03, Y + 0.004, 0.27, { h: H, ry: 0.3, pose: 'carry', top: HEMP[2], bottom: '#5b4a36', hat: '#a08a5a', hatStyle: 'conical', sleeve: 0.45, detail: 'lo' });
  const sh = off([cr.head[0], cr.head[1] - 0.012, cr.head[2]], 0.3, 0, 0, 0);
  rod(gp, [sh[0] - 0.035, sh[1], sh[2] + 0.01], [sh[0] + 0.035, sh[1], sh[2] - 0.01], 0.0015, '#7a5532', 4);
  for (const s of [-1, 1]) plathe(gp, [[0, 0], [0.008, 0], [0.01, 0.012], [0.009, 0.012], [0, 0.002]], '#8a6e4a', undefined, sh[0] + s * 0.033, sh[1] - 0.03, sh[2] - s * 0.009, 10);
  // the hamlet: semi-sunken thatched round houses and a few elms at the field edge
  hut(gp, -0.13, Y, -0.39, 0.1);
  hut(gp, 0.08, Y, -0.41, -0.2, 0.9);
  hut(gp, 0.41, Y, -0.06, -1.4, 0.85);
  hut(gp, -0.41, Y, 0.08, 1.4, 0.8);
  for (const [x, z, s] of [[-0.02, -0.42, 0.09], [0.38, 0.14, 0.08], [-0.37, -0.17, 0.085]]) tree(gp, x, Y, z, s, '#5d6b42');
};

// ---------------------------------------------------------------------------------------------------------------
// 射礼 ZHOU ARCHERY RITE (《仪礼·乡射礼》/《大射》): from the open front of the hall (堂) a pair of robed archers
// shoot in turn at the hemp-cloth target (侯) with its leather centre (鹄) set up across the court; the marker
// (获者) waits behind his screen (乏) with a flag, an attendant brings arrows and a drummer keeps the music's
// rhythm. Rammed-earth platform, timber columns, a thatch-and-tile hip roof as at Western Zhou 凤雏 / 召陈.
// ---------------------------------------------------------------------------------------------------------------
function archer(p: O, x: number, y: number, z: number, ry: number, h: number, top: string, accent: string): void {
  const A = grp(p, x, y, z, ry);
  const r = man(A, 0, 0, 0, {
    h, dress: 'ankle', top, hair: '#1c1714', hat: '#1f1a17', hatStyle: 'knot',
    hands: [[-0.06, 0.8, 0.31], [0.07, 0.8, 0.02]], lean: -0.03,
  });
  el(A, accent, 0, 0.53 * h, 0.0, 0.085 * h, 0.014 * h, 0.065 * h); // sash
  const pull = r.handR, hand = r.handL;
  bow(A, hand, [pull[0], pull[1], pull[2]], [0, 1, 0.12], [0, 0, 1], 0.32 * h);
  arrow(A, [pull[0], pull[1], pull[2]], [hand[0] + 0.0, hand[1], hand[2] + 0.05], h / 0.27);
}
function target(p: O, x: number, y: number, z: number, ry: number, s: number): void {
  const T = grp(p, x, y, z, ry, s);
  for (const sx of [-1, 1]) {
    rod(T, [sx * 0.16, 0, 0], [sx * 0.16, 0.4, 0], 0.007, '#5a3d24', 6);
    rod(T, [sx * 0.16, 0.4, 0], [sx * 0.19, 0, -0.12], 0.0015, '#b8a684', 3);
  }
  rod(T, [-0.18, 0.38, 0], [0.18, 0.38, 0], 0.005, '#5a3d24', 5);
  rod(T, [-0.18, 0.1, 0], [0.18, 0.1, 0], 0.005, '#5a3d24', 5);
  // 侯: undyed hemp cloth with top and bottom "tongues" (舌), a leather 鹄 square in the middle
  cb(T, '#d2c6a8', 0, 0.24, 0, 0.28, 0.26, 0.006);
  cb(T, '#d2c6a8', 0, 0.37, 0, 0.32, 0.03, 0.006);
  cb(T, '#d2c6a8', 0, 0.11, 0, 0.32, 0.03, 0.006);
  for (const yy of [0.385, 0.095]) cb(T, '#7a4a32', 0, yy, 0.002, 0.32, 0.006, 0.006);
  for (const sz of [-1, 1]) {
    cb(T, '#a07c52', 0, 0.24, sz * 0.004, 0.1, 0.1, 0.004);
    cb(T, '#6e4a30', 0, 0.24, sz * 0.006, 0.04, 0.04, 0.002);
  }
  for (const [ax, ay] of [[0.02, 0.25], [-0.05, 0.2], [0.06, 0.3]]) arrow(T, [ax + 0.01, ay + 0.004, 0.16], [ax, ay, 0.0], 1.4, '#d8d0b8');
}
// Ref: Commons "Earthenware architecture models, Eastern Han Dynasty" — Han tiled pavilion (射宫) proportions, ochre earth.
const lf_archery: Builder = gp => {
  const Y = ground(gp, 0.46, '#a8986e', '#74654a', 0.03, (x, _y, z) => {
    const n = fbm(x * 10, 0, z * 10, 2);
    return n > 0.6 ? '#b0a078' : n < 0.38 ? '#9c8c66' : null;
  });
  // the hall (堂) at the north of the court, open to the south: rammed-earth platform with the host's east stair
  // (阼阶) and the guests' west stair, timber columns on two rows, a mud back wall and a low hip roof
  const TH = 0.035, hx = -0.06, hz = -0.24, HW = 0.42, HD = 0.24, h = 0.13;
  rbox(gp, '#9a8a6c', hx, Y, hz, HW, TH, HD, 0.004);
  for (const sx of [-0.11, 0.11]) for (let i = 0; i < 3; i++) cb(gp, '#a89878', hx + sx, Y + TH * (i / 3) + TH / 6, hz + HD / 2 + 0.012 + (2 - i) * 0.012, 0.05, TH / 3, 0.012);
  const CH = 0.17, TY = Y + TH;
  for (const cx of [-0.18, -0.09, 0, 0.09, 0.18]) for (const cz of [-0.085, 0.085]) cyl(gp, '#6a4a32', hx + cx, TY, hz + cz, 0.0065, CH, 8);
  cb(gp, '#b8aa8a', hx, TY + CH / 2, hz - 0.095, 0.38, CH, 0.012);
  for (const sx of [-1, 1]) cb(gp, '#b8aa8a', hx + sx * 0.19, TY + CH / 2, hz - 0.04, 0.012, CH, 0.11);
  for (const cz of [-0.085, 0.085]) cb(gp, '#5a4030', hx, TY + CH - 0.006, hz + cz, 0.39, 0.012, 0.014);
  proof(gp, hx, TY + CH, hz, { n: 4, R0: 0.19, R1: 0.05, h: 0.075, lift: 0.04, tile: '#5c5a52', sx: 1.75, sz: 1.0 });
  // the pair of archers on the front edge of the hall, the target across the court to the south-east
  const tx = 0.25, tz = 0.24;
  const aim = (x: number, z: number) => Math.atan2(tx - x, tz - z);
  for (const [ax, top] of [[-0.12, '#7a3a2c'], [0.02, '#3e4a5a']] as const) archer(gp, hx + ax, TY, hz + 0.1, aim(hx + ax, hz + 0.1), h, top, '#a88a50');
  target(gp, tx, Y, tz, Math.atan2(hx - tx, hz - tz), 0.5);
  // attendant with a bundle of arrows at the foot of the west stair
  const at = man(gp, hx - 0.17, Y, hz + 0.2, { h, ry: 0.5, dress: 'ankle', top: '#5e6448', hat: '#1f1a17', hatStyle: 'knot', pose: 'carry' });
  for (let i = 0; i < 4; i++) arrow(gp, [at.handL[0] + i * 0.003 - 0.005, at.handL[1] - 0.03, at.handL[2]], [at.handL[0] + i * 0.003 - 0.005, at.handL[1] + 0.045, at.handL[2] + 0.004], 0.5);
  // the marker (获者) beside the target behind his hide screen (乏), flag in hand
  const mx = 0.38, mz = 0.08;
  cb(gp, '#7a6448', mx - 0.03, Y + 0.03, mz + 0.03, 0.06, 0.06, 0.008, -0.9);
  const mk = man(gp, mx, Y, mz, { h: h * 0.98, ry: -0.9, pose: 'crouch', top: '#7e705a', hat: '#1f1a17', hatStyle: 'knot' });
  rod(gp, mk.handR, [mk.handR[0] - 0.008, mk.handR[1] + 0.09, mk.handR[2] + 0.008], 0.0018, '#5a3d24', 4);
  cb(gp, '#8a4a34', mk.handR[0] - 0.02, mk.handR[1] + 0.078, mk.handR[2] + 0.02, 0.03, 0.02, 0.002, -0.9);
  // drum on its frame with a drummer, on the west side of the court
  const dx = -0.3, dz = 0.12;
  for (const s of [-1, 1]) rod(gp, [dx, Y, dz + s * 0.026], [dx, Y + 0.072, dz + s * 0.026], 0.0028, '#3a2a1c', 5);
  const drum = plathe(gp, [[0, -0.022], [0.026, -0.022], [0.031, 0], [0.026, 0.022], [0, 0.022]], '#6a3a26', (_x, yy) => (Math.abs(Math.abs(yy) - 0.019) < 0.003 ? '#8a7048' : null), dx, Y + 0.068, dz, 16, 0.008);
  drum.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const m = cyl(gp, '#cfc2a0', 0, 0, 0, 0.022, 0.002, 14); m.position.set(dx, Y + 0.068, dz + s * 0.022); m.rotation.x = Math.PI / 2; }
  const dr = man(gp, dx + 0.065, Y, dz + 0.035, { h, ry: -2.2, dress: 'ankle', top: '#6a5038', hat: '#1f1a17', hatStyle: 'knot', hands: [[-0.06, 0.62, 0.3], [0.08, 0.72, 0.26]] });
  for (const hnd of [dr.handL, dr.handR]) { const f = fw(-2.2); rod(gp, hnd, [hnd[0] + f[0] * 0.03, hnd[1] + 0.006, hnd[2] + f[2] * 0.03], 0.0018, '#3a2a1c', 4); }
};

// ---------------------------------------------------------------------------------------------------------------
// 投壶 PITCH-POT (《礼记·投壶》): in the hall host and guest kneel on their own mats and toss headless sticks of
// barked 柘 wood ("矢以柘若棘，毋去其皮") into an earless long-necked bronze pot (pre-Qin pots had no ears — those
// came in the Jin) two and a half arrow-lengths away; the referee (司射) counts tallies (算) into a kneeling-deer
// holder (鹿中), a musician plays the 瑟 for the 《狸首》 air, the loser's 觯 cups wait on a lacquer stand.
// ---------------------------------------------------------------------------------------------------------------
const TH_S = 0.0012; // model units per cm: figures 0.2 ≈ 165 cm
/** Earless bronze 投壶 in cm: ring foot, globular belly with cast bands, long straight neck. */
function pot(p: O, x: number, y: number, z: number, s: number): void {
  const P = grp(p, x, y, z, 0, s);
  plathe(P, [[0, 0], [7, 0], [7.2, 3], [6.2, 3.6], [9.5, 6.5], [12, 11], [12.2, 14], [10.5, 19], [6, 23], [3.2, 25.5], [2.8, 32], [2.9, 40], [3.4, 43.5], [2.9, 43.5], [2.4, 41], [0, 40]], PAT_E,
    (px, py, pz) => {
      if ((py > 9 && py < 10) || (py > 17.5 && py < 18.5) || (py > 25.5 && py < 26.3)) return '#56654f';
      if (py > 10 && py < 17.5) return (Math.floor((Math.atan2(pz, px) / TAU + 1) * 36) + Math.floor(py * 0.8)) % 3 === 0 ? '#5a6852' : erPaint(px, py, pz, 0, 1, 0);
      return erPaint(px, py, pz, 0, 1, 0);
    }, 0, 0, 0, 24, 1.0, { metal: 0.3, rough: 0.6 });
}
/** Headless pitch-pot stick with its bark on. */
const stick = (p: O, a: V3, b: V3) => rod(p, a, b, 0.0012, '#6e5236', 4);
/** Bronze tally holder in the form of a kneeling deer, the tallies standing in the hollow of its back (cm). */
function deerHolder(p: O, x: number, y: number, z: number, ry: number, s: number): void {
  const D = grp(p, x, y, z, ry, s);
  const C = shade(PAT_E, 0.95);
  el(D, C, 0, 7, 0, 5.5, 5.5, 13);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) el(D, C, sx * 4, 2.2, sz * 7, 2.6, 2.2, 6, 0, 0.1 * sz);
  tube(D, [[0, 10, 10], [0, 15, 13], [0, 19, 14]], 2.6, 2.0, C, { radial: 8, sub: 2 });
  el(D, C, 0, 20, 16, 2.4, 2.6, 4.2, 0, 0.35);
  for (const sx of [-1, 1]) el(D, C, sx * 2.2, 22.8, 13.5, 0.7, 2, 0.5, 0, 0, sx * 0.6);
  cyl(D, '#3c4436', 0, 11.8, -1, 3.2, 0.6, 12);
  for (let i = 0; i < 8; i++) rod(D, [(i % 4 - 1.5) * 1.2, 10, -1 + (Math.floor(i / 4) - 0.5) * 1.6], [(i % 4 - 1.5) * 1.6, 34, -1 + (Math.floor(i / 4) - 0.5) * 2.8], 0.35, '#b8a47c', 3);
}
// Ref: Commons "Touhu pot" (bronze, Warring States–Han) — bulbous dark-bronze pot with a long neck, arrows tossed on a mat.
const lf_touhu: Builder = gp => {
  const Y = ground(gp, 0.46, '#7e6c50', '#56483a', 0.03, (x, _y, z) => {
    const n = fbm(x * 9, 0, z * 9, 2);
    return n > 0.62 ? '#86745a' : n < 0.36 ? '#746248' : null;
  });
  const S = TH_S, H = 0.2;
  // the hall: plastered back wall with two timber columns
  cb(gp, '#b0a084', 0, Y + 0.09, -0.33, 0.56, 0.18, 0.016);
  cb(gp, '#6e4a32', 0, Y + 0.012, -0.325, 0.56, 0.024, 0.02);
  for (const sx of [-1, 1]) cyl(gp, '#5e4430', sx * 0.25, Y, -0.31, 0.009, 0.22, 8);
  cb(gp, '#5e4430', 0, Y + 0.22, -0.31, 0.56, 0.014, 0.02);
  // the great floor mat (筵) with a dark cloth border, and each player's own 席 on it
  const rug = (cx: number, cz: number, w: number, d: number, n: number, edge = '#3e3428', yo = 0) => {
    cb(gp, edge, cx, Y + 0.0015 + yo, cz, w, 0.003, d);
    for (let i = 0; i < n; i++) cb(gp, i % 2 ? '#a08c64' : '#94805a', cx, Y + 0.0025 + yo, cz - d / 2 + 0.008 + (i + 0.5) * ((d - 0.016) / n), w - 0.016, 0.003, (d - 0.016) / n);
  };
  rug(0, 0.0, 0.68, 0.5, 28);
  const potX = 0, potZ = 0.19, PS = S * 1.25;
  pot(gp, potX, Y + 0.004, potZ, PS);
  const mouthY = Y + 0.004 + 43.5 * PS;
  // sticks already in the pot, one has missed and lies on the mat
  for (const [lx, lz] of [[0.012, -0.03], [-0.016, 0.02], [0.02, 0.025]]) stick(gp, [potX + lx, mouthY + 0.03, potZ + lz], [potX - lx * 0.2, mouthY - 0.02, potZ - lz * 0.2]);
  stick(gp, [potX + 0.05, Y + 0.006, potZ + 0.03], [potX + 0.09, Y + 0.006, potZ - 0.02]);
  // host (east) and guest (west) kneeling on their mats, each with four sticks laid before him
  const aimAt = (x: number, z: number) => Math.atan2(potX - x, potZ - z);
  const pl = [[0.13, -0.07, '#6e3a2c'], [-0.13, -0.07, '#3e4a5a']] as const;
  pl.forEach(([px, pz, top], k) => {
    const ry = aimAt(px, pz);
    rug(px, pz - Math.sign(px) * 0.004, 0.13, 0.15, 7, '#2e2620', 0.0025);
    const r = seiza(gp, px, Y + 0.005, pz, {
      h: H, ry, top, hat: '#1f1a17', hatStyle: 'knot',
      hands: k === 0 ? [[-0.07, 0.24, 0.17], [0.08, 0.6, 0.26]] : [[-0.07, 0.24, 0.17], [0.07, 0.24, 0.17]],
    });
    const f = fw(ry), sd: V3 = [Math.cos(ry), 0, -Math.sin(ry)];
    if (k === 0) stick(gp, [r.handR[0] - f[0] * 0.02, r.handR[1] - 0.008, r.handR[2] - f[2] * 0.02], [r.handR[0] + f[0] * 0.035, r.handR[1] + 0.012, r.handR[2] + f[2] * 0.035]);
    for (let i = 0; i < (k === 0 ? 3 : 4); i++) {
      const c = off([px, Y + 0.006, pz], ry, 0.07, 0, (i - 1.5) * 0.008);
      stick(gp, [c[0] - sd[0] * 0.028, c[1], c[2] - sd[2] * 0.028], [c[0] + sd[0] * 0.028, c[1], c[2] + sd[2] * 0.028]);
    }
  });
  // referee (司射) standing with tallies in hand, by the deer holder
  const rf = man(gp, 0.31, Y + 0.004, 0.06, { h: H, ry: -1.3, dress: 'ankle', top: '#5b4a3a', hat: '#1f1a17', hatStyle: 'knot', pose: 'carry' });
  beard(gp, rf, -1.3, H, '#2a211b', 0.6);
  for (let i = 0; i < 5; i++) rod(gp, [rf.handL[0] + i * 0.002, rf.handL[1] - 0.012, rf.handL[2]], [rf.handL[0] + i * 0.002 + 0.006, rf.handL[1] + 0.022, rf.handL[2] + 0.006], 0.0009, '#b8a47c', 3);
  deerHolder(gp, 0.22, Y + 0.004, 0.17, -0.9, S * 1.5);
  // the musician with his 瑟 (black lacquer, red-painted ends, many strings), on the west
  const sx0 = -0.3, sz0 = 0.08;
  seiza(gp, sx0 - 0.01, Y + 0.005, sz0 - 0.065, { h: H, ry: 0.15, top: '#4e4a3e', hat: '#1f1a17', hatStyle: 'knot', hands: [[-0.1, 0.24, 0.3], [0.1, 0.24, 0.3]] });
  const SE = grp(gp, sx0, Y + 0.004, sz0, 1.45);
  rbox(SE, '#1c1612', 0, 0, 0, 0.05, 0.012, 0.19, 0.003);
  for (const e of [-1, 1]) cb(SE, '#7a3024', 0, 0.0122, e * 0.085, 0.048, 0.0005, 0.016);
  for (let i = 0; i < 9; i++) rod(SE, [(i - 4) * 0.005, 0.0135, -0.08], [(i - 4) * 0.005, 0.0135, 0.08], 0.0003, '#d8ceb0', 3);
  for (let i = 0; i < 9; i++) cb(SE, '#c8bc9a', (i - 4) * 0.005, 0.0135, -0.02 + ((i * 37) % 9) * 0.008, 0.002, 0.003, 0.002);
  // lacquer stand with the forfeit wine: a bronze 壶 and two 觯 cups, a ladle
  const wx = 0.24, wz = -0.2;
  rbox(gp, '#1c1612', wx, Y + 0.004, wz, 0.14, 0.012, 0.07, 0.003);
  cb(gp, '#6e2a20', wx, Y + 0.0165, wz, 0.13, 0.0006, 0.06);
  plathe(gp, [[0, 0], [5, 0], [5.2, 2], [9, 9], [9.4, 14], [7, 21], [4.4, 25], [4.6, 30], [4.1, 30], [0, 29]], PAT_E, erPaint, wx - 0.035, Y + 0.017, wz, 18, 1.2).scale.multiplyScalar(S);
  for (const cx of [0.0, 0.035]) {
    const c = plathe(gp, [[0, 0], [2.4, 0], [2.6, 1.2], [3.4, 5], [3.2, 9], [3.8, 13], [3.4, 13], [0, 11.5]], PAT_E, erPaint, wx + cx, Y + 0.017, wz + 0.005, 14, 1.2);
    c.scale.multiplyScalar(S);
  }
};

// ---------------------------------------------------------------------------------------------------------------
// 越王勾践剑 SWORD OF GOUJIAN (Hubei Provincial Museum; 1965 Jiangling Wangshan tomb 1): 55.7 cm long, blade 4.6 cm
// wide and slightly waisted two-thirds along, pale bronze with a fine dark rhombus pattern, eight bird-script characters
// in two columns by the guard ("越王鸠浅自作用剑"), guard inlaid with blue glass and turquoise, silk-bound grip and an
// eleven-ring pommel — shown on a black display cradle with its black lacquered wooden scabbard and a label.
// (Proportions from the museum's published dimensions; the rhombus is scaled up slightly so it reads.)
// ---------------------------------------------------------------------------------------------------------------
const lf_sword: Builder = gp => {
  // (Commons "Sword of Goujian, 2019-06-15 04.jpg": pale greenish-gold blade with a dark rhombus lattice, lying on
  // low cradles over the slate-blue cloth of the Hubei museum case)
  const Y = ground(gp, 0.46, SITE.stone);
  cb(gp, '#3c4148', 0, Y + 0.002, 0.02, 0.8, 0.004, 0.4);
  cb(gp, '#454a52', 0, Y + 0.0045, 0.02, 0.76, 0.002, 0.36);
  // stand: lacquered plinth with vermilion trim
  rbox(gp, '#141010', 0, Y + 0.004, -0.04, 0.74, 0.035, 0.18, 0.006);
  rbox(gp, '#141010', 0, Y + 0.004, 0.13, 0.74, 0.02, 0.14, 0.005);
  for (const zz of [0.049, -0.131]) cb(gp, '#8c2318', 0, Y + 0.03, zz, 0.7, 0.004, 0.003);
  // the sword: local x runs pommel → tip, blade faces +z
  const L = 0.6, S = new THREE.Group();
  S.position.set(-0.02, Y + 0.22, -0.04);
  S.rotation.set(-0.5, 0, 0.3);
  S.scale.setScalar(0.88);
  gp.add(S);
  const B = grp(S, -0.214, 0, 0);
  const wAt = (x: number) => x < 0.38 ? 0.029 - 0.0055 * (x / 0.38) : x < 0.48 ? 0.0235 + 0.002 * ((x - 0.38) / 0.1) : 0.0255 * Math.sqrt(Math.max(0, 1 - ((x - 0.48) / (L - 0.48)) ** 2));
  const rings: V3[][] = [];
  for (let i = 0; i <= 160; i++) {
    const x = (i / 160) * L, w = Math.max(0.0015, wAt(x)), t = 0.009 * (1 - 0.5 * (x / L)), r: V3[] = [];
    for (let j = 0; j < 48; j++) {
      const front = j <= 24, k = front ? j / 24 : (j - 24) / 24;
      const y = front ? w * (1 - 2 * k) : -w + 2 * w * k;
      r.push([x, y, (front ? 1 : -1) * t * (1 - Math.abs(y) / w)]);
    }
    rings.push(r);
  }
  const fr = (v: number) => v - Math.floor(v);
  skin(B, rings, '#a8996a', {
    flat: true, metal: 0.5, rough: 0.4,
    paint: (x, y) => {
      const w = Math.max(0.002, wAt(x)), ay = Math.abs(y);
      if (ay > w * 0.84) return '#bcae7e';
      if (ay < w * 0.08) return '#b2a272';
      if (x > 0.03 && x < 0.15 && ay < w * 0.42) {
        const slot = Math.floor((x - 0.03) / 0.03), lx = (x - 0.03) - slot * 0.03;
        if (lx > 0.004 && lx < 0.026 && ay > w * 0.1) return hash3(Math.floor(x * 300), Math.floor(y * 300), slot) > 0.5 ? '#3a3022' : '#a8996a';
        return null;
      }
      if (x > 0.53) return null;
      const u = x / 0.028 + 0.25, v = y / 0.012, a = fr(u + v), b = fr(u - v);
      if (a < 0.22 || b < 0.22) return '#a8996a';
      if (Math.abs(a - 0.61) < 0.3 && Math.abs(b - 0.61) < 0.3) return Math.abs(a - 0.61) < 0.1 && Math.abs(b - 0.61) < 0.1 ? '#5a5640' : '#3e3c30';
      return null;
    },
  });
  // guard (格) with turquoise and blue glass inlay on both faces
  rbox(B, '#6a5432', -0.012, -0.033, 0, 0.022, 0.066, 0.03, 0.004);
  for (const sz of [-1, 1]) {
    cb(B, '#34406a', -0.012, 0, sz * 0.016, 0.013, 0.02, 0.003);
    for (const sy of [-1, 1]) {
      cb(B, '#5a9a8c', -0.012, sy * 0.021, sz * 0.016, 0.012, 0.014, 0.003);
      cb(B, '#34406a', -0.012, sy * 0.0105, sz * 0.016, 0.008, 0.004, 0.0032);
    }
  }
  // grip (茎) with two hoops and silk cord wrapping
  add(B, g('lc1-cyl12', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12)), mat('#5a4426'), -0.09, 0, 0, 0.028, 0.15, 0.028, 0, 0, Math.PI / 2);
  for (let i = 0; i < 16; i++) torus(B, '#1e1a16', -0.03 - i * 0.0072, 0, 0, 0.0148, 0.16, Math.PI / 2, 0, 0.2);
  for (const hx of [-0.055, -0.115]) torus(B, '#7a5a2c', hx, 0, 0, 0.0158, 0.26, Math.PI / 2);
  // round pommel (首) with eleven-ring concentric circles
  add(B, g('lc1-cyl24', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24)), mat('#6a5432'), -0.172, 0, 0, 0.048, 0.012, 0.048, 0, 0, Math.PI / 2);
  for (let i = 1; i <= 5; i++) torus(B, i % 2 ? '#9a7c48' : '#4a3a24', -0.1785, 0, 0, i * 0.0044, 0.1, Math.PI / 2);
  // cradle supports under the grip and the blade
  S.updateMatrix();
  for (const t of [-0.07, 0.45]) {
    const q = new THREE.Vector3(t - 0.214, -(t < 0 ? 0.014 : wAt(t)), 0).applyMatrix4(S.matrix);
    const top = q.y - 0.016, by = Y + 0.039;
    rbox(gp, '#141010', q.x, by, q.z, 0.03, top - by, 0.05, 0.004);
    add(gp, g('lc1-cradle', () => new THREE.TorusGeometry(1, 0.22, 6, 12, Math.PI)), mat('#141010'), q.x, top + 0.024, q.z, 0.03, 0.03, 0.03, Math.PI / 2, 0, Math.PI);
    cb(gp, '#8c2318', q.x, top - 0.012, q.z + 0.026, 0.026, 0.004, 0.002);
  }
  // scabbard lying in front: black lacquer over wood, bronze mouth band and chape
  const sz0 = 0.15, sy0 = Y + 0.024 + 0.012;
  sweep(gp, [
    { p: [-0.33, sy0, sz0], w: 0.009, h: 0.036 }, { p: [-0.05, sy0, sz0], w: 0.009, h: 0.033 },
    { p: [0.22, sy0, sz0], w: 0.008, h: 0.033 }, { p: [0.3, sy0, sz0], w: 0.007, h: 0.02 },
  ], '#1e1814', { radial: 10, sub: 4, up: [0, 0, 1], paint: x => (Math.floor(x * 60) % 9 === 0 ? '#3a1c16' : null) });
  rbox(gp, '#8a6a34', -0.34, sy0 - 0.013, sz0, 0.02, 0.026, 0.064, 0.004);
  cone(gp, '#8a6a34', 0.31, sy0, sz0, 0.014, 0.03, 8).rotation.z = -Math.PI / 2;
  // museum label plate
  const lb = grp(gp, 0.28, Y + 0.01, 0.33, -0.25, 1, -0.9);
  cb(lb, '#e8e0cc', 0, 0, 0, 0.12, 0.07, 0.006);
  for (let i = 0; i < 4; i++) cb(lb, i === 0 ? '#8c2318' : '#3a3530', -0.005 + (i === 0 ? -0.02 : 0), 0.022 - i * 0.014, 0.004, i === 0 ? 0.06 : 0.09, 0.006, 0.002);
};

// ---------------------------------------------------------------------------------------------------------------
// 胡服骑射 KING WULING'S MOUNTED ARCHERS (307 BC, 《战国策·赵策二》/《史记·赵世家》): Zhao horse archers in the
// nomad dress the king adopted — short narrow-sleeved tunic, belt with a hook (带钩), trousers and boots, leather cap —
// riding small steppe horses on a felt pad with NO stirrups (not used in China until the 4th c. AD; cf. the unstirruped
// cavalry mounts of the Qin terracotta army) and shooting at a straw-and-hide butt on a dry northern grassland.
// ---------------------------------------------------------------------------------------------------------------
function horseArcher(p: O, x: number, y: number, z: number, ry: number, s: number, coat: string, mane: string, tunic: string, trousers: string): void {
  const H = grp(p, x, y, z, ry, s);
  const seat = horse(H, coat, mane, { stride: 0.09, cloth: '#4e3a2c', saddle: '#5a4632' });
  const h = 0.56, y0 = seat - h * 0.45;
  const r = man(H, 0, y0, -0.02, {
    h, pose: 'sit', top: tunic, bottom: trousers, socks: '#1d1712', shoes: '#1d1712', skin: '#c8956a', hair: '#1c1714',
    hat: '#3a2a1e', hatStyle: 'cap', sleeve: 1, build: 1.05,
    feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.39, 0.62, 0.08], [-0.02, 0.64, 0.03]],
  });
  // belt with a gold hook (带钩) and a short tunic skirt
  el(H, '#2a1d14', 0, y0 + 0.37 * h, -0.02, 0.085 * h, 0.016 * h, 0.066 * h);
  dot(H, '#9a7a44', 0, y0 + 0.37 * h, -0.02 + 0.066 * h, 0.01 * h);
  el(H, tunic, 0, y0 + 0.31 * h, -0.02, 0.1 * h, 0.05 * h, 0.08 * h);
  bow(H, r.handL, r.handR, [0, 1, 0.1], [-1, 0, 0], 0.15);
  arrow(H, r.handR, [r.handL[0] - 0.06, r.handL[1] + 0.006, r.handL[2]], 2);
  cb(H, '#3a2618', 0.07, seat - 0.02, -0.12, 0.03, 0.1, 0.04, 0, 0.5); // quiver
  for (let i = 0; i < 4; i++) rod(H, [0.07 + (i - 1.5) * 0.006, seat + 0.03, -0.1], [0.07 + (i - 1.5) * 0.006, seat + 0.06, -0.08], 0.003, '#e9e2cf', 3);
}
// Ref: Commons "Mounted archer, China, Han dynasty, c. 50 BC - 50 AD, glazed earthenware - ROM" — rider turning to shoot, short coat.
const lf_hufu: Builder = gp => {
  const Y = ground(gp, 0.46, '#8c8a5e', '#5c5840', 0.03, (x, _y, z) => {
    const n = fbm(x * 7, 0, z * 7, 3);
    if (Math.abs(z - 0.06 - Math.sin(x * 4) * 0.03) < 0.08 + n * 0.03) return n > 0.5 ? '#9c8c68' : '#948462';
    return n > 0.62 ? '#949268' : n < 0.36 ? '#7c7c52' : null;
  });
  horseArcher(gp, -0.04, Y, 0.06, -Math.PI / 2 + 0.22, 0.5, '#6e4a30', '#2a1a10', '#6e4a34', '#3e3a34');
  horseArcher(gp, 0.26, Y, 0.27, -Math.PI / 2 + 0.3, 0.48, '#8a7a62', '#3a342c', '#4e5448', '#4a3a2a');
  // the butt: a bundle of straw bound with rope on a timber trestle, a square of hide pegged on its face
  const T = grp(gp, -0.3, Y, -0.28, 0.45);
  for (const sx of [-1, 1]) {
    rod(T, [sx * 0.06, 0, 0.03], [sx * 0.05, 0.13, 0], 0.005, '#5a4630', 5);
    rod(T, [sx * 0.06, 0, -0.03], [sx * 0.05, 0.13, 0], 0.005, '#5a4630', 5);
  }
  const bale = plathe(T, [[0, -0.07], [0.05, -0.07], [0.058, -0.05], [0.06, 0], [0.058, 0.05], [0.05, 0.07], [0, 0.07]], '#a8945e',
    (_x, py) => (Math.abs(Math.abs(py) - 0.035) < 0.004 ? '#6e5a3a' : hash3(Math.floor(py * 300), 1, 2) > 0.7 ? '#9a8654' : null), 0, 0.15, 0, 14, 0.006);
  bale.rotation.z = Math.PI / 2;
  cb(T, '#7a6248', 0, 0.15, 0.058, 0.06, 0.06, 0.003);
  cb(T, '#5e4632', 0, 0.15, 0.06, 0.022, 0.022, 0.002);
  for (const [ax, ay] of [[0.01, 0.16], [-0.02, 0.14], [0.03, 0.17]]) arrow(T, [ax + 0.02, ay + 0.01, 0.15], [ax, ay, 0.05], 1.0, '#cfc6b0');
  // a spent arrow in the grass, tussocks and a few stones of the dry steppe
  arrow(gp, [-0.12, Y + 0.004, -0.3], [-0.02, Y + 0.002, -0.27], 1.0, '#cfc6b0');
  for (let i = 0; i < 12; i++) {
    const a = hash3(i, 3, 1) * TAU, rr = 0.3 + hash3(i, 1, 4) * 0.12;
    tussock(gp, Math.cos(a) * rr, Y, Math.sin(a) * rr - 0.04, 0.02 + hash3(i, 5, 5) * 0.015, '#8c8656');
  }
  for (let i = 0; i < 5; i++) rock(gp, '#7e786a', -0.35 + hash3(i, 7, 1) * 0.7, Y, 0.3 + hash3(i, 2, 8) * 0.08, 0.012, 0.007, 0.01, i, i, false);
};

// ---------------------------------------------------------------------------------------------------------------
// ANCIENT CURRENCY on a display table. r.style:
//   'banliang' (default) — Qin 半两: rimless, slightly irregular cast coins with 半 right and 两 left of the hole,
//                          strung and piled, with the standardised 度量衡: a bronze 权 weight, Shang Yang's 方升
//                          measure (Shanghai Museum) and a bronze ruler;
//   'knife'              — Wang Mang's gold-inlaid 金错刀 knife money ("一刀平五千"), rimmed 货泉 coins and the
//                          square-footed 货布 spade (not the Warring States pointed-foot 布);
//   'jiaozi'             — Song 交子 paper notes with red seals, a bronze printing plate and strings of 通宝 cash.
// ---------------------------------------------------------------------------------------------------------------
const COIN = () => g('lc1-coin', () => {
  const sq = (s: number) => { const q = new THREE.Path(); q.moveTo(-s, -s); q.lineTo(s, -s); q.lineTo(s, s); q.lineTo(-s, s); q.lineTo(-s, -s); return q; };
  const ex = (sh: THREE.Shape, d: number) => { const e = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 16 }); e.translate(0, 0, -d / 2); return e; };
  const face = new THREE.Shape(); face.absarc(0, 0, 0.9, 0, TAU, false); face.holes.push(sq(0.27));
  const rim = new THREE.Shape(); rim.absarc(0, 0, 1, 0, TAU, false); const rh = new THREE.Path(); rh.absarc(0, 0, 0.86, 0, TAU, true); rim.holes.push(rh);
  const sr = new THREE.Shape(); sr.moveTo(-0.38, -0.38); sr.lineTo(0.38, -0.38); sr.lineTo(0.38, 0.38); sr.lineTo(-0.38, 0.38); sr.lineTo(-0.38, -0.38); sr.holes.push(sq(0.27));
  const m = mergeGeometries([ex(face, 0.1), ex(rim, 0.17), ex(sr, 0.17)], false)!;
  m.computeVertexNormals();
  return m;
});
/** Qin 半两: no outer or inner rim, a slightly irregular cast blank (the mould flash is never filed round). */
const COIN_BL = () => g('lc1-coin-bl', () => {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU, r = 1 + 0.018 * Math.sin(a * 3 + 0.7) + 0.012 * Math.sin(a * 5); sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const h = new THREE.Path(); h.moveTo(-0.24, -0.25); h.lineTo(0.25, -0.24); h.lineTo(0.24, 0.26); h.lineTo(-0.25, 0.25); h.lineTo(-0.24, -0.25); sh.holes.push(h);
  const e = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1 });
  e.translate(0, 0, -0.045);
  return e;
});
type Stroke = [number, number, number, number];
const GLYPH: Record<string, Stroke[]> = {
  ban: [[0.28, 0.95, 0.36, 0.8], [0.72, 0.95, 0.64, 0.8], [0.15, 0.66, 0.85, 0.66], [0.05, 0.4, 0.95, 0.4], [0.5, 1, 0.5, 0]],
  liang: [[0.02, 0.95, 0.98, 0.95], [0.5, 0.95, 0.5, 0.55], [0.1, 0.75, 0.1, 0], [0.1, 0.75, 0.9, 0.75], [0.9, 0.75, 0.9, 0], [0.34, 0.58, 0.26, 0.22], [0.66, 0.58, 0.74, 0.22]],
  huo: [[0.32, 1, 0.12, 0.76], [0.24, 0.86, 0.24, 0.6], [0.56, 1, 0.56, 0.66], [0.56, 0.66, 0.86, 0.7], [0.86, 0.96, 0.56, 0.8], [0.2, 0.52, 0.2, 0.12], [0.2, 0.52, 0.8, 0.52], [0.8, 0.52, 0.8, 0.12], [0.5, 0.42, 0.5, 0.22], [0.32, 0.04, 0.14, -0.04], [0.68, 0.04, 0.86, -0.04]],
  quan: [[0.25, 0.95, 0.25, 0.62], [0.25, 0.95, 0.75, 0.95], [0.75, 0.95, 0.75, 0.62], [0.25, 0.78, 0.75, 0.78], [0.25, 0.62, 0.75, 0.62], [0.5, 0.56, 0.5, 0], [0.45, 0.4, 0.14, 0.12], [0.55, 0.4, 0.86, 0.1], [0.18, 0.46, 0.38, 0.4]],
  yi: [[0.05, 0.5, 0.95, 0.5]],
  dao: [[0.1, 0.85, 0.85, 0.85], [0.85, 0.85, 0.8, 0.05], [0.5, 0.85, 0.42, 0.4], [0.42, 0.4, 0.1, 0.05]],
};
/** Raised glyph strokes in a group's XY plane (cell centred at cx, cy, size s), standing proud by z. */
function glyph(p: O, k: string, cx: number, cy: number, s: number, z: number, c: string, w = 0.12): void {
  for (const [x0, y0, x1, y1] of GLYPH[k]) {
    const ax = cx + (x0 - 0.5) * s, ay = cy + (y0 - 0.5) * s, bx = cx + (x1 - 0.5) * s, by = cy + (y1 - 0.5) * s;
    const Ls = Math.hypot(bx - ax, by - ay);
    cb(p, c, (ax + bx) / 2, (ay + by) / 2, z, Ls + s * w, s * w, s * 0.05, 0, 0, Math.atan2(by - ay, bx - ax));
  }
}
/** A cast round coin with square hole and raised rims; `marks` = glyph keys right/left of the hole (or top/bottom/right/left). */
function coin(p: O, x: number, y: number, z: number, R: number, rot: V3, c = '#8a6a3a', marks: string[] = [], thick = 1, rim = true): THREE.Group {
  const C = grp(p, x, y, z, rot[1], 1, rot[0], rot[2]);
  add(C, rim ? COIN() : COIN_BL(), mat(c, { metal: 0.4, rough: 0.6 }), 0, 0, 0, R, R, R * thick);
  const gc = shade(c, 1.18), gz = R * (rim ? 0.07 : 0.07), gs = R * (rim ? 0.36 : 0.42);
  const at: [number, number][] = marks.length === 2 ? [[0.6, 0], [-0.6, 0]] : [[0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0]];
  marks.forEach((k, i) => { if (GLYPH[k]) glyph(C, k, at[i][0] * R, at[i][1] * R, gs, gz, gc); });
  return C;
}
const FLAT: V3 = [-Math.PI / 2, 0, 0];
/** A string of cash (贯): coins threaded edge-to-edge along a curve. */
function cashString(p: O, pts: V3[], R: number, c: string, rim = true): void {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  const n = Math.floor(curve.getLength() / (R * 0.32));
  for (let i = 0; i <= n; i++) {
    const t = i / n, q = curve.getPointAt(t), d = curve.getTangentAt(t);
    const m = add(p, rim ? COIN() : COIN_BL(), mat(i % 3 ? c : shade(c, 0.85), { metal: 0.4, rough: 0.6 }), q.x, q.y, q.z, R, R, R * 1.4);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  }
  for (const q of [pts[0], pts[pts.length - 1]]) { dot(p, '#7a6248', q[0], q[1], q[2], R * 0.5); rod(p, q, [q[0], q[1] - R * 0.3, q[2] + R * 1.5], R * 0.1, '#7a6248', 3); }
}
const lf_coins: Builder = (gp, r) => {
  const style = str(r.style, 'banliang');
  // (Commons "Ban Liang (半两) cash coins - Lars Bo Christensen": thin, irregular, dark green-brown patinated cast
  // bronze with a square hole and the two characters either side)
  const Y = ground(gp, 0.46, SITE.paving);
  // display table with a silk cloth
  rbox(gp, '#3a2216', 0, Y, 0, 0.7, 0.04, 0.52, 0.008);
  const silk = style === 'jiaozi' ? '#3a4a52' : style === 'knife' ? '#4e4436' : '#56382e';
  cb(gp, silk, 0, Y + 0.041, 0.0, 0.67, 0.003, 0.49);
  cb(gp, '#8a7a5a', 0, Y + 0.042, 0.0, 0.64, 0.002, 0.46);
  cb(gp, silk, 0, Y + 0.043, 0.0, 0.62, 0.002, 0.44);
  const TY = Y + 0.045;
  // a lacquered rack at the back holds the showpieces upright
  const rack = (w: number) => {
    rbox(gp, '#1d1310', 0, TY, -0.18, w, 0.03, 0.1, 0.005);
    for (const sx of [-1, 1]) rbox(gp, '#1d1310', sx * (w / 2 - 0.02), TY, -0.2, 0.025, 0.3, 0.03, 0.004);
    cb(gp, '#1d1310', 0, TY + 0.3, -0.2, w, 0.018, 0.03);
    cb(gp, '#5a2a20', 0, TY + 0.028, -0.13, w - 0.02, 0.004, 0.003);
  };
  const BRONZE = '#6e5a3e', GREEN = '#56685a';
  if (style === 'knife') {
    rack(0.7);
    // 金错刀: a ring head (square-holed) and a long blade; gold-inlaid 一刀, cast 平五千
    for (const [kx, tilt] of [[-0.16, 0.06], [0.04, -0.04]]) {
      const K = grp(gp, kx, TY + 0.035, -0.17, 0, 1, 0, tilt);
      rbox(K, BRONZE, 0, 0, 0, 0.05, 0.16, 0.012, 0.003);
      cb(K, shade(BRONZE, 1.1), 0, 0.08, 0.0065, 0.044, 0.15, 0.002);
      for (let i = 0; i < 3; i++) cb(K, '#4a3a20', 0, 0.035 + i * 0.04, 0.008, 0.026, 0.026, 0.002);
      const C = coin(K, 0, 0.21, 0, 0.055, [0, 0, 0], BRONZE);
      glyph(C, 'yi', 0, 0.034, 0.03, 0.007, '#c8a44e', 0.2);
      glyph(C, 'dao', 0, -0.034, 0.03, 0.007, '#c8a44e', 0.2);
    }
    // Wang Mang's 货布: a square-footed spade with a round hole in the head, a central ridge and rims
    const Sp = grp(gp, 0.24, TY + 0.035, -0.17);
    const sh = new THREE.Shape([[-0.014, 0.25], [0.014, 0.25], [0.016, 0.19], [0.042, 0.18], [0.045, 0.0], [0.008, 0.0], [0.008, 0.07], [-0.008, 0.07], [-0.008, 0.0], [-0.045, 0.0], [-0.042, 0.18], [-0.016, 0.19]].map(([a, b]) => new THREE.Vector2(a, b)));
    const hole = new THREE.Path(); hole.absarc(0, 0.226, 0.006, 0, TAU, true); sh.holes.push(hole);
    const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 });
    add(Sp, sg, mat(GREEN, { metal: 0.4, rough: 0.6 }), 0, 0, 0, 1, 1, 1);
    cb(Sp, shade(GREEN, 1.12), 0, 0.125, 0.009, 0.003, 0.11, 0.002);
    for (const s of [-1, 1]) { cb(Sp, shade(GREEN, 1.12), s * 0.026, 0.13, 0.009, 0.012, 0.012, 0.002); cb(Sp, shade(GREEN, 1.12), s * 0.026, 0.1, 0.009, 0.004, 0.03, 0.002); }
    // 货泉 coins standing and spread
    coin(gp, -0.22, TY + 0.05, 0.08, 0.05, [-0.25, 0.1, 0], BRONZE, ['huo', 'quan']);
    for (let i = 0; i < 7; i++) coin(gp, 0.04 + (i % 4) * 0.075, TY + 0.004 + Math.floor(i / 4) * 0.0, 0.08 + Math.floor(i / 4) * 0.1 + (i % 2) * 0.01, 0.034, [-Math.PI / 2, 0, i * 0.4], i % 3 ? BRONZE : GREEN, ['huo', 'quan', '', '']);
    // a small spade coin lying flat and a pile of loose cash
    const Sp2 = grp(gp, -0.06, TY + 0.006, 0.18, 0.4, 0.6, -Math.PI / 2);
    add(Sp2, sg, mat(GREEN, { metal: 0.4, rough: 0.6 }), 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < 6; i++) coin(gp, -0.3 + (i % 3) * 0.04, TY + 0.004 + Math.floor(i / 3) * 0.006, 0.2 + (i % 2) * 0.02, 0.026, [-Math.PI / 2, 0, i], BRONZE);
  } else if (style === 'jiaozi') {
    // two printed notes in a frame: border, printed scene, text columns and three vermilion seals
    const note = (x: number, y: number, z: number, rx: number, ry: number, s = 1) => {
      const N = grp(gp, x, y, z, ry, s, rx);
      cb(N, '#d9c9a0', 0, 0.14, 0, 0.16, 0.28, 0.003);
      cb(N, '#2a2622', 0, 0.14, 0.0018, 0.15, 0.27, 0.001);
      cb(N, '#d9c9a0', 0, 0.14, 0.0024, 0.136, 0.256, 0.001);
      for (let i = 0; i < 10; i++) cb(N, '#3a3530', -0.06 + i * 0.0133, 0.264, 0.003, 0.006, 0.006, 0.001);
      cb(N, '#4a4038', 0, 0.075, 0.003, 0.11, 0.06, 0.001);
      cb(N, '#d9c9a0', 0, 0.075, 0.0034, 0.1, 0.05, 0.001);
      for (let i = 0; i < 3; i++) { cb(N, '#4a4038', -0.03 + i * 0.03, 0.068, 0.0038, 0.022, 0.02, 0.001); cb(N, '#4a4038', -0.03 + i * 0.03, 0.082, 0.0038, 0.028, 0.006, 0.001, 0, 0, 0.3 * (i - 1)); }
      for (let c = 0; c < 7; c++) for (let k = 0; k < 3; k++) cb(N, '#3a3530', -0.054 + c * 0.018, 0.14 + k * 0.036, 0.003, 0.0045, 0.03 - hash3(c, k, 2) * 0.01, 0.001);
      for (const [sx, sy, ss] of [[0.04, 0.2, 0.03], [-0.04, 0.12, 0.026], [0.035, 0.03, 0.022]]) cb(N, '#94402e', sx, sy, 0.0042, ss, ss, 0.001);
    };
    rack(0.5);
    note(-0.1, TY + 0.03, -0.165, -0.08, 0.05);
    note(0.1, TY + 0.03, -0.165, -0.08, -0.05);
    note(-0.25, TY + 0.003, 0.1, -Math.PI / 2, 0.3, 0.9);
    // bronze printing plate (钞版) on a wooden back, relief face up, and an ink brush
    const P = grp(gp, 0.08, TY, 0.12, -0.2);
    rbox(P, '#5a3d24', 0, 0, 0, 0.13, 0.03, 0.2, 0.004);
    cb(P, '#4f6a5a', 0, 0.03, 0, 0.12, 0.006, 0.19);
    cb(P, '#2e3f36', 0, 0.036, 0, 0.11, 0.002, 0.18);
    // relief like the 千斯仓 plate: a row of ten cash at the head, columns of text, a granary scene at the foot
    for (let i = 0; i < 6; i++) cyl(P, '#6a7e70', -0.045 + i * 0.018, 0.036, -0.075, 0.006, 0.003, 8);
    for (let i = 0; i < 7; i++) for (let k = 0; k < 2; k++) cb(P, '#6a7e70', -0.045 + i * 0.015, 0.037, -0.035 + k * 0.045, 0.004, 0.003, 0.038 - hash3(i, k, 5) * 0.012);
    cb(P, '#6a7e70', 0, 0.037, 0.06, 0.09, 0.003, 0.003);
    for (let i = 0; i < 3; i++) { cb(P, '#6a7e70', -0.03 + i * 0.03, 0.037, 0.075, 0.016, 0.003, 0.016); cb(P, '#6a7e70', -0.03 + i * 0.03, 0.038, 0.064, 0.022, 0.003, 0.004); }
    rod(gp, [0.2, TY + 0.006, 0.24], [0.3, TY + 0.006, 0.18], 0.004, '#5a3d24', 5);
    cone(gp, '#1a1714', 0.19, TY + 0.006, 0.245, 0.006, 0.02, 6).rotation.z = Math.PI / 2;
    // strings of 通宝 cash
    cashString(gp, [[0.18, TY + 0.012, -0.02], [0.3, TY + 0.012, 0.02], [0.33, TY + 0.012, 0.12], [0.26, TY + 0.012, 0.2]], 0.024, BRONZE);
    cashString(gp, [[-0.32, TY + 0.012, 0.22], [-0.18, TY + 0.012, 0.24], [-0.06, TY + 0.012, 0.22]], 0.024, '#7a5a30');
    for (let i = 0; i < 5; i++) coin(gp, -0.08 + i * 0.04, TY + 0.004, 0.02 + (i % 2) * 0.03, 0.022, FLAT, BRONZE);
  } else {
    rack(0.62);
    // three showpiece 半两 coins standing in the rack
    coin(gp, 0, TY + 0.15, -0.19, 0.105, [0, 0, 0], BRONZE, ['ban', 'liang'], 1, false);
    coin(gp, -0.2, TY + 0.13, -0.19, 0.08, [0, 0.1, 0], GREEN, ['ban', 'liang'], 1, false);
    coin(gp, 0.2, TY + 0.13, -0.19, 0.08, [0, -0.1, 0], shade(BRONZE, 0.9), ['ban', 'liang'], 1, false);
    // a string of cash and stacks of coins
    cashString(gp, [[-0.32, TY + 0.03, 0.04], [-0.2, TY + 0.03, 0.06], [-0.08, TY + 0.03, 0.04]], 0.03, BRONZE, false);
    for (let s = 0; s < 3; s++) for (let i = 0; i < 6 - s; i++) coin(gp, -0.26 + s * 0.07 + (hash3(s, i, 1) - 0.5) * 0.006, TY + 0.004 + i * 0.0062, 0.18 + (s % 2) * 0.03, 0.03, [-Math.PI / 2, 0, i * 0.5], i % 2 ? BRONZE : GREEN, [], 1, false);
    for (let i = 0; i < 4; i++) coin(gp, -0.04 + i * 0.03, TY + 0.004, 0.19 - (i % 2) * 0.03, 0.03, [-Math.PI / 2, 0, i], BRONZE, ['ban', 'liang'], 1, false);
    // 权: Qin bronze weight with a nose loop
    plathe(gp, [[0, 0], [0.06, 0], [0.064, 0.012], [0.056, 0.05], [0.036, 0.074], [0.016, 0.082], [0, 0.084]], '#6e5a3a',
      (px, yy, pz) => (Math.abs(yy - 0.03) < 0.012 && Math.abs(Math.atan2(px, pz)) < 0.8 && hash3(Math.floor(px * 400), Math.floor(yy * 400), 1) > 0.6 ? '#5a4a30' : null), 0.1, TY, 0.02, 20, 0.008, { metal: 0.4, rough: 0.6 });
    torus(gp, '#6e5a3a', 0.1, TY + 0.094, 0.02, 0.014, 0.3);
    // 方升: Shang Yang's standard measure with a hollow handle
    const M = grp(gp, 0.24, TY, 0.16, -0.35);
    cb(M, '#7a6a42', 0, 0.003, 0, 0.13, 0.006, 0.07);
    for (const [x, z, w, d] of [[0, 0.032, 0.13, 0.006], [0, -0.032, 0.13, 0.006], [0.062, 0, 0.006, 0.07], [-0.062, 0, 0.006, 0.07]]) cb(M, '#7a6a42', x, 0.026, z, w, 0.046, d);
    cb(M, '#2a2420', 0, 0.007, 0, 0.118, 0.002, 0.058);
    add(M, g('lc1-cyl8', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8)), mat('#7a6a42'), -0.11, 0.025, 0, 0.022, 0.09, 0.022, 0, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) cb(M, '#3e3424', -0.045 + i * 0.022, 0.016 + k * 0.012, 0.0355, 0.012, 0.007, 0.002);
    // bronze ruler with incised graduations
    cb(gp, '#8a6a3a', 0.02, TY + 0.003, 0.245, 0.23, 0.005, 0.02);
    for (let i = 0; i <= 10; i++) cb(gp, '#3a2c18', -0.095 + i * 0.023, TY + 0.0082, 0.241, 0.002, 0.001, i % 5 ? 0.008 : 0.014);
  }
};

// ---------------------------------------------------------------------------------------------------------------
// 蹴鞠 CUJU in the Western Han: a match in a walled 鞠城, as described by 李尤《鞠城铭》 — "圆鞠方墙，仿象阴阳。法月衡对，
// 二六相当。建长立平…" — a square-walled court with six crescent goal-chambers (鞠室) facing each other at either end,
// two teams of six in short jackets and trousers (cf. Han stone reliefs of 蹴鞠), a referee (长) and his deputy (平),
// and the patrons watching from a raised stand. The ball is stitched leather stuffed with hair. No Song net or poles.
// ---------------------------------------------------------------------------------------------------------------
function leatherBall(p: O, x: number, y: number, z: number, r: number): void {
  el(p, '#7a5634', x, y, z, r);
  for (const [ry, rx] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) torus(p, '#3a2414', x, y, z, r * 1.01, 0.05, ry, rx);
}
function kicker(p: O, x: number, y: number, z: number, ry: number, h: number, top: string, kick: number): HumanRig {
  // kick: 0 = ready stance, 1 = high instep kick with the right foot, 2 = knee trap with the left, 3 = running
  const feet: [V3, V3] = kick === 1 ? [[-0.06, 0.032, -0.02], [0.08, 0.36, 0.26]] : kick === 2 ? [[-0.05, 0.22, 0.12], [0.07, 0.032, -0.03]] : [[-0.1, 0.032, 0.03], [0.1, 0.032, -0.02]];
  const r = man(p, x, y, z, {
    h, ry, top, bottom: '#5a4c3c', dress: 'knee', sleeve: 1, hair: '#1c1714', hat: '#1c1714', hatStyle: 'knot', shoes: '#2a2018', socks: '#5a4c3c', detail: 'lo',
    ...(kick === 3 ? { pose: 'run' as const } : {
      feet, hands: kick ? [[-0.24, 0.62, -0.02], [0.22, 0.58, 0.06]] as [V3, V3] : [[-0.16, 0.5, 0.12], [0.16, 0.5, 0.12]] as [V3, V3], lean: kick === 1 ? -0.12 : 0.1,
      hipY: kick === 1 ? 0.47 : kick === 2 ? 0.48 : 0.45,
    }),
  });
  const b = off(r.head, ry, 0, -0.27 * h);
  el(p, '#3a2a1e', b[0], b[1], b[2], 0.088 * h, 0.012 * h, 0.07 * h, ry);
  return r;
}
// Ref: Commons "Emperor Taizu play Cuju.jpg", "Chujutu.jpg" — the stitched red leather ball kicked by men in short robes.
const lf_cuju: Builder = gp => {
  const Y = ground(gp, 0.46, '#8a7c58', '#5e5238', 0.03, (x, _y, z) => {
    const n = fbm(x * 9, 1, z * 9, 3);
    return n > 0.6 ? '#928460' : n < 0.38 ? '#7e7050' : null;
  });
  // the court: beaten earth inside low rammed-earth walls with a tiled coping
  const CW = 0.66, CD = 0.4, WH = 0.05, WT = 0.018, cz = 0.04;
  cb(gp, '#a8946c', 0, Y + 0.001, cz, CW, 0.002, CD);
  const wall = (x: number, z: number, w: number, d: number) => {
    rbox(gp, '#9a8662', x, Y, z, w, WH, d, 0.003);
    cb(gp, '#55534c', x, Y + WH + 0.003, z, w + 0.008, 0.006, d + 0.008);
  };
  wall(0, cz - CD / 2 - WT / 2, CW + 2 * WT, WT);
  for (const s of [-1, 1]) wall(s * (CW / 2 + WT / 2), cz, WT, CD);
  for (const s of [-1, 1]) wall(s * 0.19, cz + CD / 2 + WT / 2, CW / 2 - 0.08 + WT, WT); // front wall with a gate gap
  // six crescent goal-chambers (鞠室) along the inside of each end wall, facing the other end
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    const gz = cz - CD / 2 + (i + 0.5) * (CD / 6), gx = s * (CW / 2 - 0.004);
    const G = grp(gp, gx, Y, gz, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    add(G, g('lc1-jushi', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2)), mat('#2a221a'), 0, 0, 0.002, 0.021, 0.021, 0.004);
    torus(G, '#a8946c', 0, 0, 0.004, 0.022, 0.14, 0, 0, 0, Math.PI);
  }
  // two teams of six (dull red and indigo-grey) and the leather ball in play
  const H = 0.1, A = '#7a4434', B = '#4a5262';
  const team: [number, number, number, string, number][] = [
    [0.03, 0.06, -Math.PI / 2 + 0.3, A, 1], [0.12, 0.15, -Math.PI / 2, A, 0], [0.16, -0.08, -Math.PI / 2 + 0.6, A, 3], [0.25, 0.08, -Math.PI / 2, A, 0], [0.08, -0.04, -Math.PI / 2 - 0.3, A, 2], [0.22, 0.2, -2.0, A, 3],
    [-0.06, 0.02, Math.PI / 2 - 0.2, B, 0], [-0.1, 0.16, Math.PI / 2 + 0.4, B, 3], [-0.15, -0.07, Math.PI / 2 - 0.5, B, 0], [-0.24, 0.07, Math.PI / 2, B, 2], [-0.03, -0.1, Math.PI / 2 + 0.2, B, 3], [-0.26, -0.1, 0.8, B, 0],
  ];
  for (const [x, z, ry, c, k] of team) kicker(gp, x, Y + 0.002, cz + z, ry, H, c, k);
  const f = fw(-Math.PI / 2 + 0.3);
  leatherBall(gp, 0.03 + f[0] * 0.04, Y + 0.06, cz + 0.06 + f[2] * 0.04, 0.009);
  // the referee (长) and his deputy (平), in long robes, at the gate side
  for (const [x, z, ry, c] of [[0.0, 0.17, Math.PI, '#4e4636'], [-0.12, -0.15, 0.3, '#5a5040']] as const) man(gp, x, Y + 0.002, cz + z, { h: H, ry, dress: 'ankle', top: c, hat: '#1f1a17', hatStyle: 'cap', detail: 'lo', hands: [[-0.08, 0.5, 0.14], [0.08, 0.5, 0.14]] });
  // the patrons' stand behind the far wall: a low timber platform with a canopy, two kneeling officials
  const sz = cz - CD / 2 - 0.09;
  rbox(gp, '#6a5038', 0, Y, sz, 0.24, 0.04, 0.09, 0.003);
  for (const sx of [-0.11, 0.11]) for (const dz of [-0.035, 0.035]) cyl(gp, '#4a3626', sx, Y + 0.04, sz + dz, 0.004, 0.1, 6);
  proof(gp, 0, Y + 0.14, sz, { n: 4, R0: 0.12, R1: 0.03, h: 0.04, lift: 0.04, tile: '#5c5a52', sx: 1.4, sz: 0.65 });
  for (const [x, c] of [[-0.05, '#5e3a2e'], [0.05, '#3e4a44']] as const) {
    cb(gp, '#8a7a58', x, Y + 0.042, sz, 0.05, 0.002, 0.05);
    seiza(gp, x, Y + 0.043, sz, { h: H, top: c, hat: '#1f1a17', hatStyle: 'cap', detail: 'lo' });
  }
};

// ---------------------------------------------------------------------------------------------------------------
// 百戏 HAN ACROBATICS, after the 沂南 Han tomb 乐舞百戏 relief and the 济南无影山 painted-pottery acrobat group: on a
// rush mat performers stripped to the waist in trousers do 寻橦 (a strongman holding a pole with a child doing a
// handstand on its crossbar), 走索 (rope-walking), 跳丸 (juggling wooden balls) and somersaults, while a drummer beats
// the 建鼓 (a barrel drum pierced by a pole, with a feather canopy 羽葆 and pennants) and robed guests kneel on mats.
// ---------------------------------------------------------------------------------------------------------------
// Ref: Commons "China 2006 8-70.jpg" (Jinan Wuyingshan painted-pottery acrobats) — buff clay, bare torsos, seated musicians.
const lf_acrobats: Builder = gp => {
  const Y = ground(gp, 0.46, '#8e7c5c', '#5e5040', 0.03, (x, _y, z) => {
    const n = fbm(x * 8, 2, z * 8, 3);
    return n > 0.6 ? '#968462' : n < 0.38 ? '#867454' : null;
  });
  // the performers' rush mat with a dark cloth edge
  cb(gp, '#4a3a2c', 0.02, Y + 0.002, 0.02, 0.52, 0.004, 0.4);
  for (let i = 0; i < 24; i++) cb(gp, i % 2 ? '#9c8a62' : '#94825c', 0.02, Y + 0.0045, 0.02 - 0.19 + (i + 0.5) * (0.38 / 24), 0.5, 0.002, 0.38 / 24);
  const H = 0.17, SK = '#c08a62', TR = ['#5a4a3a', '#4a4440', '#6a5038', '#3e3a36'];
  const perf = (x: number, y: number, z: number, o: Partial<HumanOpts> & { h: number }, k: number) => man(gp, x, y, z, {
    top: SK, skin: SK, bottom: TR[k % 4], dress: undefined, sleeve: 0, hair: '#1c1714', hatStyle: 'knot', shoes: '#2a2018', ...o,
  });
  // 走索: rope stretched between two braced posts at the back, a performer walking it with arms spread
  const RZ = -0.24, RY = Y + 0.2, X0 = -0.38, X1 = 0.02;
  for (const xx of [X0, X1]) {
    rod(gp, [xx, Y, RZ], [xx, RY + 0.02, RZ], 0.006, '#5a4430', 6);
    for (const dz of [-1, 1]) rod(gp, [xx, RY - 0.01, RZ], [xx + (xx < -0.2 ? -0.03 : 0.04), Y, RZ + dz * 0.04], 0.0018, '#a89878', 3);
  }
  const mid = (X0 + X1) / 2;
  rod(gp, [X0, RY, RZ], [mid, RY - 0.008, RZ], 0.0016, '#b0a080', 3);
  rod(gp, [mid, RY - 0.008, RZ], [X1, RY, RZ], 0.0016, '#b0a080', 3);
  perf(mid + 0.02, RY - 0.008 - 0.032 * H, RZ, {
    h: H * 0.95, ry: 0.15, feet: [[-0.03, 0.032, -0.08], [0.03, 0.032, 0.08]], hands: [[-0.36, 0.74, 0], [0.36, 0.78, 0.02]],
  }, 0);
  // 寻橦: strongman holding up a pole, a child in a handstand on its crossbar
  const PX = 0.24, PZ = -0.08, sm = perf(PX, Y + 0.006, PZ, {
    h: H * 1.04, ry: -0.2, build: 1.15, feet: [[-0.1, 0.032, 0.03], [0.1, 0.032, -0.02]], hands: [[-0.03, 0.92, 0.06], [0.03, 0.92, 0.06]],
  }, 1);
  const PT = Y + 0.33, hx = (sm.handL[0] + sm.handR[0]) / 2, hz = (sm.handL[2] + sm.handR[2]) / 2;
  rod(gp, [hx, sm.handL[1] - 0.03, hz], [hx, PT, hz], 0.0045, '#8a7048', 6);
  cb(gp, '#8a7048', hx, PT, hz, 0.05, 0.005, 0.005);
  const C = grp(gp, hx, PT + 0.003, hz, 0.2, 1, 0, Math.PI);
  man(C, 0, -1.08 * H * 0.6, 0, {
    h: H * 0.6, top: SK, skin: SK, bottom: TR[2], sleeve: 0, hatStyle: 'knot', shoes: '#2a2018',
    feet: [[-0.03, 0.032, -0.06], [0.04, 0.0, 0.12]], hands: [[-0.06, 1.08, 0.0], [0.06, 1.08, 0.0]],
  });
  // 跳丸: juggler keeping seven wooden balls in the air
  const jg = perf(-0.18, Y + 0.006, 0.06, {
    h: H, ry: 0.4, hands: [[-0.14, 0.62, 0.16], [0.14, 0.6, 0.16]], feet: [[-0.08, 0.032, 0.02], [0.08, 0.032, 0.0]],
  }, 2);
  const B = anim(gp, 'bob', (jg.handL[0] + jg.handR[0]) / 2, (jg.handL[1] + jg.handR[1]) / 2, (jg.handL[2] + jg.handR[2]) / 2);
  for (let i = 0; i < 7; i++) {
    const a = 0.25 + (i / 6) * (Math.PI - 0.5);
    dot(B, i % 2 ? '#8a6a44' : '#7a5c3a', Math.cos(a) * 0.045, Math.sin(a) * 0.07 + 0.015, 0.008, 0.0055);
  }
  // tumbler in a tucked somersault above the mat
  const T = grp(gp, 0.04, Y + 0.15, 0.13, 0.15, 1, 0, 2.5);
  man(T, 0, -0.5 * H, 0, {
    h: H, top: SK, skin: SK, bottom: TR[3], sleeve: 0, hatStyle: 'knot', shoes: '#2a2018',
    feet: [[-0.2, 0.1, 0.0], [0.2, 0.12, 0.0]], hands: [[-0.26, 0.86, 0.02], [0.26, 0.86, 0.02]],
  });
  // 建鼓: barrel drum on a pole set in a crouching-beast base, feather canopy and pennants, drummer with two sticks
  const DX = 0.33, DZ = 0.2;
  el(gp, '#5a5048', DX, Y + 0.014, DZ, 0.03, 0.016, 0.026);
  rod(gp, [DX, Y, DZ], [DX, Y + 0.34, DZ], 0.004, '#4a2a20', 6);
  const D = grp(gp, DX, Y + 0.17, DZ, -0.9, 1, 0, Math.PI / 2);
  plathe(D, [[0, -0.03], [0.034, -0.03], [0.04, -0.015], [0.042, 0], [0.04, 0.015], [0.034, 0.03], [0, 0.03]], '#6a3024', (_x, yy) => (Math.abs(yy) > 0.027 ? '#c8b896' : Math.abs(Math.abs(yy) - 0.021) < 0.003 ? '#3a2a20' : null), 0, 0, 0, 18, 0.006);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    rod(gp, [DX, Y + 0.33, DZ], [DX + Math.cos(a) * 0.045, Y + 0.3, DZ + Math.sin(a) * 0.045], 0.0022, i % 2 ? '#5a5a44' : '#6e6248', 3);
  }
  for (const s of [-1, 1]) {
    rod(gp, [DX, Y + 0.32, DZ], [DX + s * 0.02, Y + 0.25, DZ + 0.01], 0.0008, '#6a3a2a', 3);
    cb(gp, '#6a3a2a', DX + s * 0.022, Y + 0.24, DZ + 0.01, 0.006, 0.03, 0.001);
  }
  const dr = man(gp, DX - 0.07, Y, DZ - 0.03, {
    h: H, ry: 1.6, top: '#5a4a3a', bottom: '#4a4038', dress: 'knee', sleeve: 1, hatStyle: 'knot',
    feet: [[-0.09, 0.032, 0.03], [0.09, 0.032, -0.03]], hands: [[-0.05, 0.88, 0.22], [0.12, 0.6, 0.24]],
  });
  for (const hnd of [dr.handL, dr.handR]) rod(gp, hnd, [hnd[0] + 0.024, hnd[1] + 0.008, hnd[2]], 0.0016, '#3a2a1c', 3);
  // robed guests kneeling on their mats at the front-left
  for (const [sx, sz, ry, c] of [[-0.33, 0.2, 0.9, '#5a3e36'], [-0.23, 0.3, 0.6, '#3e4a50'], [-0.36, 0.06, 1.2, '#5a5440']] as [number, number, number, string][]) {
    cb(gp, '#3e3228', sx, Y + 0.002, sz, 0.075, 0.004, 0.075, ry);
    cb(gp, '#94825c', sx, Y + 0.003, sz, 0.068, 0.004, 0.068, ry);
    seiza(gp, sx, Y + 0.005, sz, { h: H, ry, top: c, hat: '#1a1714', hatStyle: 'cap' });
  }
};

// ---------------------------------------------------------------------------------------------------------------
// 老子出关 LAOZI LEAVES THROUGH HANGU PASS (《史记·老子韩非列传》: "至关，关令尹喜曰…强为我著书。于是老子乃著书上下篇"):
// the old archivist, white-bearded, in a plain hemp robe, riding a dark water buffalo (青牛) westwards with a staff,
// handing the keeper Yin Xi the bundle of bamboo slips (竹简) he wrote for him; a guard with a 戈 stands by the gate.
// The pass is a Spring-and-Autumn rammed-earth wall with a timber gate tower. No purple-qi clouds, no fly-whisk.
// ---------------------------------------------------------------------------------------------------------------
/** Water buffalo facing local +z (base y=0); returns back height. */
function buffalo(p: O, c: string): number {
  const dk = shade(c, 0.75);
  sweep(p, [
    { p: [0, 0.27, -0.21], w: 0.05, h: 0.05 }, { p: [0, 0.29, -0.15], w: 0.085, h: 0.085 }, { p: [0, 0.29, -0.02], w: 0.09, h: 0.09 },
    { p: [0, 0.3, 0.1], w: 0.088, h: 0.1 }, { p: [0, 0.31, 0.16], w: 0.07, h: 0.085 }, { p: [0, 0.29, 0.21], w: 0.05, h: 0.06 },
  ], c, { radial: 14, sub: 5 });
  el(p, c, 0, 0.36, 0.11, 0.05, 0.03, 0.06); // shoulder hump
  sweep(p, [{ p: [0, 0.29, 0.19], w: 0.045, h: 0.05 }, { p: [0, 0.26, 0.26], w: 0.04, h: 0.045 }, { p: [0, 0.22, 0.31], w: 0.032, h: 0.035 }], c, { radial: 10, sub: 3 });
  el(p, dk, 0, 0.2, 0.335, 0.026, 0.024, 0.026);
  for (const s of [-1, 1]) {
    dot(p, '#0e0e10', s * 0.024, 0.25, 0.29, 0.006);
    el(p, c, s * 0.04, 0.245, 0.27, 0.016, 0.007, 0.01, 0, 0, s * 0.4);
    // crescent horns sweeping out and back
    sweep(p, [
      { p: [s * 0.022, 0.27, 0.27], w: 0.012 }, { p: [s * 0.075, 0.285, 0.25], w: 0.01 }, { p: [s * 0.11, 0.3, 0.2], w: 0.008 },
      { p: [s * 0.1, 0.33, 0.15], w: 0.005 }, { p: [s * 0.075, 0.345, 0.14], w: 0.002 },
    ], '#8a8070', { radial: 6, sub: 3 });
  }
  for (const [sx, sz, f] of [[-1, 0.14, 1], [1, 0.14, -1], [-1, -0.14, -1], [1, -0.14, 1]]) {
    const hx = sx * 0.05, sw = f * 0.03;
    sweep(p, [
      { p: [hx, 0.27, sz], w: 0.03, h: 0.04 }, { p: [hx, 0.17, sz + sw * 0.4], w: 0.019 }, { p: [hx, 0.1, sz + sw], w: 0.015 }, { p: [hx, 0.02, sz + sw * 0.6], w: 0.014 },
    ], c, { radial: 8, sub: 3 });
    el(p, '#1a1a1c', hx, 0.012, sz + sw * 0.6 + 0.004, 0.016, 0.012, 0.018);
  }
  sweep(p, [{ p: [0, 0.29, -0.22], w: 0.008 }, { p: [0, 0.2, -0.25], w: 0.005 }, { p: [0.01, 0.12, -0.24], w: 0.004 }], c, { radial: 5, sub: 3 });
  el(p, '#1a1a1c', 0.01, 0.11, -0.24, 0.008, 0.016, 0.008);
  return 0.39;
}
const lf_laozi: Builder = gp => {
  const Y = ground(gp, 0.46, '#8e7a5a', '#605038', 0.03, (x, _y, z) => {
    const n = fbm(x * 8, 3, z * 8, 3);
    if (Math.abs(z - 0.08) < 0.1 + n * 0.03) return n > 0.5 ? '#a08c6a' : '#988462';
    return n > 0.6 ? '#7e7c52' : n < 0.36 ? '#86744e' : null;
  });
  // 函谷关: rammed-earth walls in courses, a gate passage and a timber gate tower with a tiled roof
  const GZ = -0.26, WH = 0.26;
  for (const s of [-1, 1]) {
    rbox(gp, '#958468', s * 0.2, Y, GZ, 0.22, WH, 0.12, 0.004);
    for (let k = 0; k < 6; k++) cb(gp, '#85745a', s * 0.2, Y + 0.02 + k * 0.04, GZ + 0.061, 0.22, 0.002, 0.001);
    for (let k = 0; k < 4; k++) cb(gp, '#8a7a60', s * (0.12 + k * 0.06), Y + WH + 0.0125, GZ + 0.04, 0.04, 0.025, 0.03);
  }
  rbox(gp, '#958468', 0, Y + 0.2, GZ, 0.18, WH - 0.2, 0.12, 0.004);
  cb(gp, '#1c1814', 0, Y + 0.1, GZ + 0.02, 0.1, 0.2, 0.1);
  for (const s of [-1, 1]) cb(gp, '#4a3626', s * 0.03, Y + 0.095, GZ + 0.066, 0.05, 0.19, 0.006, s * 0.6);
  cb(gp, '#4a3626', 0, Y + 0.2, GZ + 0.062, 0.11, 0.012, 0.012);
  hall(gp, 0, Y + WH, GZ, 0.24, 0.09, 0.08, '#4a4844', 0, '#8a7458', { col: '#4a3626', band: '#3e3024' });
  // (cf. Chen Hongshou, "Laozi Riding an Ox", Commons: the sage in a pale robe with a white beard on a grey buffalo)
  tree(gp, 0.37, Y, -0.1, 0.1, '#5b6a44');
  tree(gp, -0.38, Y, -0.08, 0.08, '#5b6a44');
  // the water buffalo walking west (toward −x)
  const BS = 0.5, OX = 0.06, OZ = 0.08, ry = -Math.PI / 2 + 0.08, Ob = grp(gp, OX, Y, OZ, ry, BS);
  const back = buffalo(Ob, '#4a4844') * BS;
  // Laozi sitting sideways on its back, facing the viewer, legs down the near flank
  const h = 0.22, sY = Y + back - 0.004;
  const lz = man(gp, OX + 0.005, sY - 0.27 * h, OZ, {
    h, ry: 0.08, pose: 'sit', top: '#a49c86', bottom: '#a49c86', dress: 'knee', hair: '#e8e6e0', hatStyle: 'knot', skin: '#c99a74', shoes: '#3a3530',
    feet: [[-0.07, -0.2, 0.16], [0.06, -0.24, 0.15]], hands: [[-0.24, 0.42, 0.18], [0.12, 0.5, 0.16]], lean: -0.04,
  });
  el(gp, '#a49c86', OX + 0.005, sY - 0.006, OZ + 0.012, 0.042, 0.02, 0.055);
  el(gp, '#5a4c3a', OX + 0.005, sY + 0.1 * h, OZ + 0.004, 0.07 * h * 1.3, 0.014 * h, 0.06 * h * 1.3);
  beard(gp, lz, 0.08, h, '#ecebe6', 1.5);
  for (const s of [-1, 1]) { const e = off(lz.head, 0.08, 0.05 * h, 0.03 * h, s * 0.03 * h); el(gp, '#ecebe6', e[0], e[1], e[2], 0.01 * h, 0.004 * h, 0.006 * h); }
  // a plain wooden staff in the right hand, resting against the buffalo's shoulder
  const wh = lz.handR;
  rod(gp, [wh[0] - 0.012, wh[1] + 0.05, wh[2] + 0.004], [wh[0] + 0.02, Y + 0.02, wh[2] + 0.03], 0.0022, '#5a4430', 5);
  // the bundle of bamboo slips held out to Yin Xi: rolled slips tied with cord
  const sc = lz.handL;
  const roll = add(gp, g('lc1-cyl8', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8)), mat('#a08c5c'), sc[0] - 0.006, sc[1], sc[2] + 0.004, 0.014, 0.05, 0.014, 0, 0, Math.PI / 2 - 0.2);
  roll.castShadow = true;
  for (const s of [-1, 1]) torus(gp, '#4a3626', sc[0] - 0.006 + s * 0.012, sc[1] + s * 0.0024, sc[2] + 0.004, 0.0075, 0.18, Math.PI / 2, 0, -0.2);
  // halter rope and a boy leading the buffalo
  const nose: V3 = [OX - 0.335 * BS, Y + 0.2 * BS, OZ + 0.03 * BS];
  const boy = man(gp, OX - 0.25, Y, OZ + 0.05, {
    h: 0.16, ry: -1.4, pose: 'walk', phase: 0.2, top: '#7a6a50', bottom: '#5a4c3c', dress: 'knee', sleeve: 0.45, hair: '#1c1714', hatStyle: 'knot',
  });
  tube(gp, [nose, [OX - 0.215, Y + 0.06, OZ + 0.04], boy.handR], 0.0016, 0.0016, '#7a6040', { radial: 5 });
  // Yin Xi, keeper of the pass, stepping forward with both hands out to receive the slips
  const yx = man(gp, -0.2, Y, -0.06, { h, ry: 0.95, lean: 0.25, top: '#3e4450', dress: 'ankle', hat: '#1a1714', hatStyle: 'cap', hands: [[-0.06, 0.58, 0.3], [0.06, 0.58, 0.3]] });
  beard(gp, yx, 0.95, h, '#1c1714', 0.6);
  // a gate guard in leather armour with a dagger-axe (戈)
  const gd = man(gp, 0.12, Y, -0.15, { h, ry: 0.2, pose: 'stand', top: '#5a4a3a', dress: 'knee', bottom: '#4a4038', hat: '#3a2a1e', hatStyle: 'helmet', armor: '#5e4a36', hands: [[-0.16, 0.48, 0.08], [0.14, 0.5, 0.1]] });
  const gt: V3 = [gd.handR[0] + 0.005, Y + 0.3, gd.handR[2] + 0.01];
  rod(gp, [gd.handR[0], Y + 0.004, gd.handR[2]], gt, 0.0022, '#4a3626', 5);
  cb(gp, '#6e6450', gt[0] + 0.014, gt[1] - 0.02, gt[2], 0.03, 0.007, 0.002, 0.2);
};

export const H_LIFE_CUSTOM1: Record<string, Builder> = {
  lf_pekingman, lf_fire, lf_jue, lf_jingtian, lf_archery, lf_touhu, lf_sword, lf_hufu, lf_coins, lf_cuju, lf_acrobats, lf_laozi,
};
