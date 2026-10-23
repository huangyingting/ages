import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, rbox, cyl, cone, lathe, rod, strut, sweep, skin, tube,
  shade, hash3, fbm, paintFaces,
} from '../prims.ts';
import { human, type HumanOpts, type HumanRig } from '../human.ts';
import { horse } from '../animals.ts';
import { hall } from '../timber.ts';

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

/** Round plinth: side ring + a finely ringed top (so `paint` can draw paths, fields and patches). Returns top height. */
function ground(p: O, R: number, top: string, side = shade(top, 0.7), h = 0.03, paint?: Paint): number {
  lathe(p, [[0, 0], [R, 0], [R * 0.98, h * 0.8], [R * 0.95, h], [0, h]], side, 0, 0, 0, 40);
  const rings: [number, number][] = [[0, h + 0.002]];
  for (let i = 1; i <= 14; i++) rings.push([R * 0.95 * (i / 14), h + 0.002]);
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

// ---- bronze patina & taotie banding ---------------------------------------------------------------------------
const PAT = '#55836c', PAT_DK = '#32524a', PAT_HI = '#8aa784', BRZ = '#a37b41';
/** Bronze patina mottling with taotie (饕餮) mask bands between the given local heights. */
function bronzePaint(bands: [number, number][], N = 4, base = PAT): Paint {
  return (x, y, z) => {
    for (const [a, b] of bands) if (y >= a && y <= b) {
      const fv = (y - a) / (b - a);
      if (fv < 0.12 || fv > 0.88) return PAT_HI;
      const u = ((Math.atan2(z, x) / TAU + 1) % 1) * N, fu = u - Math.floor(u);
      const ex = Math.min(Math.abs(fu - 0.33), Math.abs(fu - 0.67));
      if (ex < 0.06 && Math.abs(fv - 0.55) < 0.17) return '#1d2b26';
      if (ex < 0.11 && Math.abs(fv - 0.55) < 0.26) return PAT_HI;
      if (Math.abs(fu - 0.5) < 0.035 || fu < 0.03 || fu > 0.97) return PAT_HI;
      return (Math.floor(fu * 16) + Math.floor(fv * 5)) % 2 ? PAT_DK : base;
    }
    const n = hash3(Math.floor(x * 80), Math.floor(y * 80), Math.floor(z * 80));
    return n > 0.86 ? BRZ : n > 0.6 ? shade(base, 1.12) : n < 0.15 ? shade(base, 0.85) : base;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 北京人 PEKING MAN at Zhoukoudian: limestone cave mouth, a stooped hairy Homo erectus with a stone chopper and a
// second crouching at the fire; bones and antlers of hunted deer litter the cave floor.
// ---------------------------------------------------------------------------------------------------------------
const FUR = '#5e4029', HSKIN = '#8a5c3c';
function hominin(p: O, x: number, y: number, z: number, ry: number, h: number, o: Partial<HumanOpts> = {}): HumanRig {
  const r = man(p, x, y, z, { h, ry, top: FUR, bottom: FUR, skin: HSKIN, hair: '#3a2515', shoes: '#6e4a30', build: 1.2, ...o });
  // heavy brow ridge, sloping forehead, prognathous jaw, shaggy mane over the nape and shoulders
  const b = off(r.head, ry, 0.052 * h, 0.018 * h), j = off(r.head, ry, 0.045 * h, -0.03 * h);
  el(p, shade(HSKIN, 0.85), b[0], b[1], b[2], 0.056 * h, 0.017 * h, 0.022 * h, ry);
  el(p, HSKIN, j[0], j[1], j[2], 0.045 * h, 0.032 * h, 0.03 * h, ry);
  const m = off(r.head, ry, -0.025 * h, 0.012 * h), n = off(r.head, ry, -0.035 * h, -0.075 * h);
  el(p, '#3a2515', m[0], m[1], m[2], 0.066 * h, 0.05 * h, 0.066 * h, ry, -0.4);
  el(p, '#4a3020', n[0], n[1], n[2], 0.1 * h, 0.07 * h, 0.06 * h, ry);
  return r;
}
function bone(p: O, a: V3, b: V3, r: number, c = '#e4dac2'): void {
  rod(p, a, b, r, c, 5);
  for (const q of [a, b]) { dot(p, c, q[0] + r * 0.9, q[1], q[2], r * 1.4); dot(p, c, q[0] - r * 0.9, q[1], q[2], r * 1.4); }
}
function antler(p: O, x: number, y: number, z: number, ry: number, s: number, c = '#c9b48a'): void {
  const A = grp(p, x, y, z, ry, s);
  tube(A, [[0, 0.01, 0], [0.05, 0.02, 0.01], [0.1, 0.035, 0.0], [0.15, 0.06, -0.02]], 0.008, 0.004, c, { radial: 5, sub: 3 });
  for (const [t, dx, dy, dz] of [[0.03, 0.01, 0.04, 0.02], [0.08, 0.015, 0.045, 0.025], [0.125, 0.02, 0.04, -0.01]]) rod(A, [t, 0.02 + t * 0.2, 0], [t + dx, 0.02 + t * 0.2 + dy, dz], 0.004, c, 4);
}
const lf_pekingman: Builder = gp => {
  const Y = ground(gp, 0.46, '#8a785b', '#5b4c3a');
  const LS = '#a39d90';
  // cave: two buttresses, a heavy overhang and the dark recess behind
  el(gp, '#15120f', 0, 0.2, -0.29, 0.22, 0.22, 0.08);
  rock(gp, LS, -0.29, 0.17, -0.22, 0.17, 0.23, 0.16, 1);
  rock(gp, LS, 0.3, 0.16, -0.21, 0.16, 0.22, 0.17, 2, 0.6);
  rock(gp, shade(LS, 0.96), 0.01, 0.43, -0.24, 0.42, 0.14, 0.2, 3);
  rock(gp, LS, -0.17, 0.53, -0.32, 0.25, 0.15, 0.12, 4, 1);
  rock(gp, LS, 0.19, 0.55, -0.33, 0.23, 0.13, 0.11, 0, 2);
  rock(gp, shade(LS, 1.05), -0.38, 0.06, -0.05, 0.07, 0.06, 0.07, 5);
  rock(gp, shade(LS, 0.95), 0.4, 0.05, 0.02, 0.06, 0.05, 0.06, 1);
  for (const [sx, l] of [[-0.08, 0.06], [0.02, 0.04], [0.1, 0.07], [-0.15, 0.035]]) {
    const c = cone(gp, shade(LS, 0.9), sx, 0.31 - l, -0.17, 0.012, l, 5);
    c.rotation.x = Math.PI;
  }
  // moss / soot on the overhang edge
  for (let i = 0; i < 6; i++) dot(gp, '#5f6b45', -0.3 + i * 0.12, 0.5 + hash3(i, 2, 3) * 0.04, -0.13, 0.025);
  // hearth with ash ring, logs and fire
  const fx = 0.06, fz = 0.2;
  cyl(gp, '#4a4038', fx, Y - 0.001, fz, 0.075, 0.004, 16);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; rock(gp, '#7b746a', fx + Math.cos(a) * 0.07, Y + 0.008, fz + Math.sin(a) * 0.07, 0.018, 0.014, 0.016, i, a, false); }
  for (let i = 0; i < 4; i++) { const a = i * 0.8; rod(gp, [fx - Math.cos(a) * 0.05, Y + 0.006, fz - Math.sin(a) * 0.05], [fx + Math.cos(a) * 0.035, Y + 0.03, fz + Math.sin(a) * 0.035], 0.006, '#3a2a1c', 5); }
  fire(gp, fx, Y + 0.01, fz, 0.05);
  // standing hunter with a stone chopper, looking out of the cave
  const A = hominin(gp, -0.17, Y, 0.06, 0.45, 0.32, { lean: 0.28, hands: [[-0.14, 0.44, 0.08], [0.15, 0.43, 0.14]] });
  rock(gp, '#8a8274', A.handR[0], A.handR[1] - 0.01, A.handR[2] + 0.008, 0.024, 0.02, 0.011, 2, 0.45, false);
  // crouching one feeding the fire
  const B = hominin(gp, 0.24, Y, 0.17, -1.35, 0.3, { pose: 'crouch' });
  rod(gp, B.handL, [fx + 0.03, Y + 0.02, fz], 0.004, '#4a3220', 4);
  // the day's catch: bones, antlers and a deer skull
  bone(gp, [-0.3, Y + 0.008, 0.25], [-0.2, Y + 0.008, 0.31], 0.006);
  bone(gp, [0.18, Y + 0.008, 0.33], [0.27, Y + 0.008, 0.29], 0.005);
  bone(gp, [-0.06, Y + 0.006, 0.36], [0.0, Y + 0.006, 0.4], 0.004);
  antler(gp, -0.36, Y, 0.12, 0.6, 1);
  antler(gp, 0.25, Y, -0.04, -2.2, 0.9);
  el(gp, '#ddd2b8', 0.33, Y + 0.018, 0.12, 0.022, 0.018, 0.034, 0.9);
  dot(gp, '#3a3028', 0.345, Y + 0.022, 0.13, 0.006);
  for (let i = 0; i < 6; i++) rock(gp, '#8f897e', -0.4 + hash3(i, 1, 1) * 0.8, Y + 0.005, 0.1 + hash3(i, 5, 2) * 0.32, 0.012, 0.008, 0.012, i, i, false);
};

// ---------------------------------------------------------------------------------------------------------------
// 钻木取火 MAKING FIRE: a kneeling hunter spins a fire-drill into a board, a stone-ringed hearth blazes with a deer
// haunch roasting on a forked spit, tinder and firewood piled near; a second person warms by the fire.
// ---------------------------------------------------------------------------------------------------------------
const lf_fire: Builder = gp => {
  const Y = ground(gp, 0.46, '#7f6c4a', '#584a34', 0.03, (x, _y, z) => {
    const n = fbm(x * 8, 0, z * 8, 3);
    return n > 0.6 ? '#6f7d45' : n > 0.54 ? '#7d7a4a' : n < 0.35 ? '#735f40' : null;
  });
  // the fire-maker
  const FG = grp(gp, -0.16, Y, 0.1, 0.55);
  const h = 0.3;
  man(FG, 0, 0, 0, {
    h, pose: 'kneel', lean: 0.32, top: '#8b6a45', bottom: '#6e5236', skin: '#b07a52', hair: '#2a1d14', shoes: '#9c6e48',
    sleeve: 0, shorts: true, hands: [[-0.024, 0.42, 0.3], [0.024, 0.45, 0.3]],
  });
  el(FG, '#2a1d14', 0, 0.42 * h, -0.02 * h, 0.07 * h, 0.06 * h, 0.07 * h); // shaggy hair
  box(FG, '#9a7448', 0, 0, 0.3 * h, 0.13, 0.008, 0.032, 0.2);
  for (const k of [-0.035, 0.035]) cyl(FG, '#2a1c12', k, 0.008, 0.3 * h + 0.004, 0.007, 0.001, 8);
  rod(FG, [0, 0.008, 0.3 * h], [0, 0.49 * h, 0.3 * h], 0.0035, '#a8865a', 5);
  glowDot(FG, '#ff7a2a', '#ff4a10', 0, 0.01, 0.3 * h, 0.006);
  const sm = anim(FG, 'smoke', 0, 0.02, 0.3 * h, { size: 0.012 });
  for (let i = 0; i < 4; i++) add(sm, ICO(), mat('#d8d3cb', { transparent: 0.5 }), 0, 0, 0, 0.01, 0.01, 0.01);
  // tinder nest
  for (let i = 0; i < 10; i++) { const a = i * 0.63; rod(FG, [0.05 + Math.cos(a) * 0.02, 0.004, 0.3 * h + 0.02 + Math.sin(a) * 0.015], [0.05 - Math.cos(a) * 0.02, 0.012, 0.3 * h + 0.02 - Math.sin(a) * 0.015], 0.002, '#d6bf72', 3); }
  el(FG, '#c9ae62', 0.05, 0.008, 0.3 * h + 0.02, 0.022, 0.01, 0.018);
  // hearth
  const hx = 0.13, hz = -0.04;
  cyl(gp, '#3d352e', hx, Y - 0.001, hz, 0.1, 0.004, 18);
  for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU; rock(gp, i % 2 ? '#8a847a' : '#76706a', hx + Math.cos(a) * 0.095, Y + 0.012, hz + Math.sin(a) * 0.095, 0.024, 0.02, 0.022, i, a, false); }
  for (let i = 0; i < 5; i++) { const a = i * 1.25; rod(gp, [hx - Math.cos(a) * 0.065, Y + 0.006, hz - Math.sin(a) * 0.065], [hx + Math.cos(a) * 0.01, Y + 0.05, hz + Math.sin(a) * 0.01], 0.008, '#3b2a1b', 5); }
  fire(gp, hx, Y + 0.01, hz, 0.065);
  // forked stakes and a spit with a deer haunch
  const sy = Y + 0.2;
  for (const sx of [-1, 1]) {
    const x = hx + sx * 0.15;
    rod(gp, [x, Y, hz], [x, sy - 0.01, hz], 0.006, '#5a4028', 5);
    rod(gp, [x, sy - 0.015, hz], [x - 0.015, sy + 0.02, hz], 0.004, '#5a4028', 4);
    rod(gp, [x, sy - 0.015, hz], [x + 0.015, sy + 0.02, hz], 0.004, '#5a4028', 4);
  }
  rod(gp, [hx - 0.19, sy, hz], [hx + 0.19, sy, hz], 0.004, '#6b4a2c', 5);
  sweep(gp, [
    { p: [hx - 0.09, sy, hz], w: 0.034, h: 0.04 }, { p: [hx - 0.04, sy - 0.004, hz], w: 0.036, h: 0.042 },
    { p: [hx + 0.01, sy - 0.006, hz], w: 0.022, h: 0.024 }, { p: [hx + 0.06, sy - 0.004, hz], w: 0.011, h: 0.012 },
    { p: [hx + 0.1, sy - 0.002, hz], w: 0.008, h: 0.009 },
  ], '#7a3417', { radial: 10, sub: 3, paint: (x, y) => (x > hx + 0.03 ? '#8a6a48' : y > sy + 0.02 ? '#5e2410' : hash3(Math.floor(x * 200), Math.floor(y * 200), 1) > 0.7 ? '#9a4a22' : null) });
  el(gp, '#2a2018', hx + 0.11, sy - 0.003, hz, 0.012, 0.009, 0.008);
  // a second person warming hands
  man(gp, 0.31, Y, 0.17, { h: 0.27, ry: -2.1, pose: 'sitGround', top: '#7d5c3c', bottom: '#5e4630', skin: '#b07a52', sleeve: 0, shorts: true, hair: '#2a1d14', shoes: '#9c6e48', hands: [[-0.06, 0.25, 0.28], [0.06, 0.25, 0.28]] });
  // firewood pile, stones, a bare sapling
  for (let i = 0; i < 6; i++) rod(gp, [-0.33 + i * 0.012, Y + 0.008 + (i % 2) * 0.012, -0.22 - i * 0.01], [-0.12 + i * 0.012, Y + 0.008 + (i % 2) * 0.012, -0.3 - i * 0.01], 0.008, i % 2 ? '#6b4b2e' : '#5a3d24', 5);
  for (let i = 0; i < 7; i++) rock(gp, '#8c8578', -0.42 + hash3(i, 9, 1) * 0.84, Y + 0.006, -0.38 + hash3(i, 3, 7) * 0.3, 0.02, 0.014, 0.018, i, i * 0.7, false);
  rod(gp, [0.33, Y, -0.24], [0.34, Y + 0.3, -0.27], 0.007, '#4a3624', 5);
  for (const [dx, dy, dz] of [[0.06, 0.08, 0.02], [-0.05, 0.1, -0.03], [0.03, 0.12, -0.05]]) rod(gp, [0.335, Y + 0.18, -0.25], [0.335 + dx, Y + 0.18 + dy, -0.25 + dz], 0.003, '#4a3624', 4);
  for (let i = 0; i < 6; i++) dot(gp, '#6f8a46', 0.33 + Math.cos(i) * 0.05, Y + 0.28 + (i % 3) * 0.02, -0.26 + Math.sin(i) * 0.05, 0.022);
};

// ---------------------------------------------------------------------------------------------------------------
// 青铜礼器 SHANG BRONZE WINE VESSELS: tripod jue cups (spout, tail, capped posts, handle), a jia and a slender gu on a
// black-and-red lacquered offering table — green patina with taotie mask bands.
// ---------------------------------------------------------------------------------------------------------------
/** Open trough (spout / tail) along a polyline: an outer bronze shell and a dark inner surface. */
function trough(p: O, pts: V3[], w0: number, w1: number, c: string): void {
  const rings = (k: number): V3[][] => pts.map((q, i) => {
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) * k, out: V3[] = [];
    for (let j = 0; j <= 6; j++) { const a = (j / 6) * Math.PI; out.push([q[0], q[1] - Math.sin(a) * w * 0.85, q[2] + Math.cos(a) * w]); }
    return out;
  });
  skin(p, rings(1), c, { closed: false, flat: true });
  skin(p, rings(0.9), '#1d2622', { closed: false, inward: true, flat: true });
}
function jue(p: O, x: number, y: number, z: number, s: number, ry: number): void {
  const J = grp(p, x, y, z, ry, s);
  const by = 0.27;
  const body = plathe(J, [[0, 0], [0.06, 0.012], [0.11, 0.06], [0.13, 0.13], [0.135, 0.22], [0.14, 0.27], [0.13, 0.27], [0.12, 0.2], [0.0, 0.18]], PAT, bronzePaint([[0.1, 0.2]], 3), 0, by, 0, 26, 0.015);
  body.scale.set(1.08, 1, 0.92);
  // spout (流) rising forward to +x, pointed tail (尾) to −x
  trough(J, [[0.08, by + 0.26, 0], [0.22, by + 0.28, 0], [0.36, by + 0.31, 0], [0.42, by + 0.33, 0]], 0.06, 0.042, shade(PAT, 1.05));
  trough(J, [[-0.08, by + 0.255, 0], [-0.2, by + 0.28, 0], [-0.3, by + 0.31, 0], [-0.34, by + 0.335, 0]], 0.055, 0.004, shade(PAT, 1.05));
  // capped posts (柱) at the spout root
  for (const sz of [-1, 1]) {
    cyl(J, PAT, 0.1, by + 0.24, sz * 0.07, 0.011, 0.13, 6);
    lathe(J, [[0, 0], [0.026, 0.0], [0.03, 0.02], [0.016, 0.042], [0, 0.048]], shade(PAT, 1.1), 0.1, by + 0.37, sz * 0.07, 10);
  }
  // handle (鋬) on the side and three blade legs
  tube(J, [[0, by + 0.21, -0.12], [0, by + 0.2, -0.19], [0, by + 0.12, -0.2], [0, by + 0.07, -0.12]], 0.016, 0.014, PAT, { radial: 6, sub: 3 });
  for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) {
    const tx = Math.cos(a) * 0.08, tz = Math.sin(a) * 0.07;
    strut(J, [tx, by + 0.04, tz], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.15], 0.032, 0.006, shade(PAT, 0.95), 3);
  }
  dot(J, PAT_DK, 0, by + 0.012, 0, 0.05);
}
function jia(p: O, x: number, y: number, z: number, s: number, ry: number): void {
  const J = grp(p, x, y, z, ry, s);
  const by = 0.22;
  plathe(J, [[0, 0], [0.15, 0], [0.17, 0.03], [0.17, 0.14], [0.14, 0.2], [0.135, 0.26], [0.17, 0.36], [0.2, 0.42], [0.185, 0.42], [0.12, 0.3], [0, 0.3]], PAT,
    bronzePaint([[0.04, 0.14], [0.22, 0.32]], 3), 0, by, 0, 30, 0.015);
  for (const sz of [-1, 1]) {
    cyl(J, PAT, 0.0, by + 0.37, sz * 0.15, 0.014, 0.15, 6);
    lathe(J, [[0, 0], [0.034, 0.0], [0.04, 0.025], [0.022, 0.055], [0, 0.065]], shade(PAT, 1.1), 0.0, by + 0.5, sz * 0.15, 10);
  }
  tube(J, [[-0.17, by + 0.3, 0], [-0.25, by + 0.28, 0], [-0.25, by + 0.14, 0], [-0.17, by + 0.08, 0]], 0.018, 0.016, PAT, { radial: 6, sub: 3 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 3;
    strut(J, [Math.cos(a) * 0.12, by + 0.02, Math.sin(a) * 0.12], [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], 0.04, 0.016, shade(PAT, 0.95), 3);
  }
}
function gu(p: O, x: number, y: number, z: number, s: number): void {
  const G = grp(p, x, y, z, 0, s);
  plathe(G, [[0, 0], [0.12, 0], [0.12, 0.03], [0.085, 0.12], [0.06, 0.26], [0.055, 0.32], [0.06, 0.46], [0.07, 0.52], [0.12, 0.72], [0.17, 0.9], [0.16, 0.9], [0.06, 0.55], [0, 0.55]], PAT,
    bronzePaint([[0.04, 0.2], [0.33, 0.47]], 4), 0, 0, 0, 30, 0.015);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    cb(G, PAT, Math.cos(a) * 0.075, 0.14, Math.sin(a) * 0.075, 0.016, 0.16, 0.04, -a);
    cb(G, PAT, Math.cos(a) * 0.065, 0.4, Math.sin(a) * 0.065, 0.014, 0.14, 0.034, -a);
  }
}
const lf_jue: Builder = gp => {
  const Y = ground(gp, 0.46, '#4a3b2e', '#2e241c', 0.03, (x, _y, z) => (Math.floor((x + 1) * 12) + Math.floor((z + 1) * 12)) % 2 ? '#3f3226' : null);
  // lacquered offering table (案): black top, vermilion border and cloud scroll, curved feet
  const T = 0.13, W = 0.8, D = 0.42;
  rbox(gp, '#1b1512', 0, Y + T - 0.03, 0, W, 0.03, D, 0.006);
  for (const [w, d] of [[W - 0.02, 0.012], [0.012, D - 0.02]] as const) for (const s of [-1, 1]) {
    if (d === 0.012) cb(gp, '#9c2b1c', 0, Y + T + 0.001, s * (D / 2 - 0.02), w - 0.03, 0.002, d);
    else cb(gp, '#9c2b1c', s * (W / 2 - 0.02), Y + T + 0.001, 0, w, 0.002, d - 0.03);
  }
  for (let i = 0; i < 12; i++) cb(gp, '#9c2b1c', -0.36 + i * 0.065, Y + T - 0.015, D / 2 + 0.0005, 0.03, 0.006, 0.002, 0, 0, i % 2 ? 0.5 : -0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    tube(gp, [[sx * 0.34, Y + T - 0.03, sz * 0.17], [sx * 0.355, Y + 0.05, sz * 0.18], [sx * 0.37, Y + 0.01, sz * 0.19]], 0.016, 0.012, '#1b1512', { radial: 6, sub: 3 });
  }
  const TY = Y + T + 0.002;
  // vessels: three jue, a jia and a gu
  jue(gp, -0.08, TY, 0.06, 0.6, 0.35);
  jue(gp, 0.1, TY, 0.08, 0.5, 0.15);
  jue(gp, 0.02, TY, -0.1, 0.48, 0.55);
  jia(gp, 0.27, TY, -0.05, 0.6, 0.2);
  gu(gp, -0.28, TY, -0.04, 0.55);
  // a bronze ladle and a mat-woven runner on the floor in front
  rod(gp, [-0.25, TY + 0.004, 0.13], [-0.15, TY + 0.004, 0.16], 0.004, PAT, 5);
  plathe(gp, [[0, 0], [0.02, 0.0], [0.024, 0.014], [0.02, 0.016], [0, 0.006]], PAT, undefined, -0.265, TY, 0.125, 12);
  for (let i = 0; i < 9; i++) cb(gp, i % 2 ? '#a88e5c' : '#97804f', 0, Y + 0.002, 0.3 + (i - 4) * 0.012, 0.6, 0.004, 0.012);
};

// ---------------------------------------------------------------------------------------------------------------
// 井田制 WELL-FIELD SYSTEM: nine squares like the character 井 — eight private plots around the central public field
// with its well and shaduf (桔槔); ridged furrows of millet, raised field paths (阡陌), farmers hoeing, thatched huts.
// ---------------------------------------------------------------------------------------------------------------
function hut(p: O, x: number, y: number, z: number, ry: number, s = 1): void {
  const H = grp(p, x, y, z, ry, s);
  plathe(H, [[0, 0], [0.042, 0], [0.04, 0.04], [0, 0.04]], '#b39466', (px, py) => (Math.floor(py * 120) % 3 === 0 ? '#a3845a' : hash3(Math.floor(px * 90), Math.floor(py * 90), 0) > 0.8 ? '#c4a676' : null), 0, 0, 0, 14, 0.01);
  plathe(H, [[0, 0.11], [0.03, 0.085], [0.058, 0.045], [0.062, 0.036], [0.05, 0.036], [0, 0.05]], '#c6a35a', (_x, py) => (Math.floor(py * 160) % 2 ? '#b08f4c' : null), 0, 0, 0, 16, 0.008);
  cb(H, '#2a2018', 0, 0.018, 0.04, 0.02, 0.032, 0.006);
  cyl(H, '#8a6a3a', 0, 0.105, 0, 0.006, 0.012, 6);
}
const lf_jingtian: Builder = gp => {
  const Y = ground(gp, 0.47, '#86744f', '#5c4d33', 0.03);
  const F = 0.18, P = 0.2;
  // raised field paths: 阡 (north–south) and 陌 (east–west)
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const L = Math.abs(k) > 1 ? 0.5 : 0.62;
    cb(gp, '#8f9a5a', k * P, Y + 0.008, 0, 0.018, 0.016, L);
    cb(gp, '#8f9a5a', 0, Y + 0.008, k * P, L, 0.016, 0.018);
  }
  // nine fields
  const kinds = ['ripe', 'green', 'ripe', 'green', 'pub', 'plough', 'green', 'ripe', 'green'];
  for (let i = 0; i < 9; i++) {
    const cx = ((i % 3) - 1) * P, cz = (Math.floor(i / 3) - 1) * P, kind = kinds[i], along = (i % 2) === 0;
    const soil = kind === 'plough' ? '#6e5434' : '#7a6040';
    cb(gp, soil, cx, Y + 0.002, cz, F, 0.004, F);
    const n = 6;
    for (let r = 0; r < n; r++) {
      const o = -F / 2 + (r + 0.5) * (F / n);
      if (kind === 'pub' && Math.abs(o) < 0.05) continue;
      const rx = along ? cx + o : cx, rz = along ? cz : cz + o, sx = along ? 0.016 : F * 0.92, sz = along ? F * 0.92 : 0.016;
      cb(gp, shade(soil, 1.15), rx, Y + 0.008, rz, sx, 0.008, sz);
      if (kind === 'plough') continue;
      const ripe = kind === 'ripe', top = ripe ? '#c9a640' : '#5f8f3a';
      cb(gp, ripe ? '#9a9a46' : '#4f7f34', rx, Y + 0.022, rz, along ? 0.01 : F * 0.86, 0.026, along ? F * 0.86 : 0.01);
      cb(gp, top, rx, Y + 0.037, rz, along ? 0.014 : F * 0.84, 0.01, along ? F * 0.84 : 0.014);
      if (ripe) for (let k = 0; k < 6; k++) {
        const t = -F * 0.38 + k * F * 0.152;
        el(gp, '#d8b34a', along ? rx + 0.006 : rx + t, Y + 0.042, along ? rz + t : rz + 0.006, 0.007, 0.006, 0.01, along ? 0 : Math.PI / 2, 0.6);
      }
    }
  }
  // the public field's well: stone curb, wooden frame and a shaduf with a counterweight
  cyl(gp, '#8d877c', 0, Y, 0, 0.032, 0.03, 14);
  cyl(gp, '#2a4450', 0, Y + 0.029, 0, 0.024, 0.002, 12);
  for (let i = 0; i < 4; i++) cb(gp, '#9a9488', Math.cos(i * Math.PI / 2) * 0.03, Y + 0.032, Math.sin(i * Math.PI / 2) * 0.03, 0.02, 0.008, 0.02, i * Math.PI / 2);
  const px = 0.06, pz = 0.03, py = Y + 0.17;
  rod(gp, [px, Y, pz], [px, py, pz], 0.006, '#6b4a2c', 5);
  rod(gp, [px - 0.01, py - 0.012, pz], [px + 0.01, py + 0.012, pz], 0.004, '#6b4a2c', 4);
  const a: V3 = [0.0, Y + 0.12, 0.0], b: V3 = [0.17, Y + 0.24, 0.05];
  rod(gp, a, b, 0.0045, '#7a5532', 5);
  rock(gp, '#7c766c', b[0], b[1] - 0.015, b[2], 0.02, 0.018, 0.02, 3, 0, false);
  rod(gp, [b[0], b[1], b[2]], [b[0], b[1] - 0.015, b[2]], 0.002, '#3a2a1c', 3);
  rod(gp, a, [0, Y + 0.05, 0], 0.0015, '#3a2a1c', 3);
  plathe(gp, [[0, 0], [0.012, 0], [0.015, 0.02], [0.013, 0.02], [0, 0.004]], '#7a5532', undefined, 0, Y + 0.035, 0, 10);
  // farmers hoeing (bronze-tipped wooden hoes)
  const hoer = (x: number, z: number, ry: number, top: string) => {
    const r = man(gp, x, Y + 0.004, z, { h: 0.15, ry, lean: 0.45, top, bottom: '#5b4a36', hair: '#1c1714', hat: '#c9ad6a', hatStyle: 'conical', sleeve: 0.45, shoes: '#6e5236', hands: [[-0.03, 0.55, 0.2], [0.03, 0.42, 0.24]] });
    const f = fw(ry), tip: V3 = [r.handR[0] + f[0] * 0.06, Y + 0.012, r.handR[2] + f[2] * 0.06];
    rod(gp, [r.handL[0] - f[0] * 0.02, r.handL[1] + 0.03, r.handL[2] - f[2] * 0.02], tip, 0.0025, '#7a5532', 4);
    cb(gp, '#6a6a5c', tip[0], tip[1], tip[2], 0.022, 0.004, 0.016, ry);
  };
  hoer(0.21, 0.19, 0.6, '#9a8f74');
  hoer(-0.2, -0.04, -0.4, '#7d6a52');
  hoer(0.12, 0.04, 2.6, '#8a7a5e');
  man(gp, -0.04, Y + 0.004, 0.27, { h: 0.15, ry: 0.3, pose: 'carry', top: '#a39470', bottom: '#5b4a36', hat: '#c9ad6a', hatStyle: 'conical', sleeve: 0.45 });
  rod(gp, [-0.085, Y + 0.1, 0.29], [0.005, Y + 0.1, 0.3], 0.003, '#7a5532', 4);
  for (const s of [-1, 1]) plathe(gp, [[0, 0], [0.016, 0], [0.02, 0.024], [0.018, 0.024], [0, 0.004]], '#a88f58', undefined, -0.04 + s * 0.05, Y + 0.05, 0.3, 10);
  // hamlet of thatched huts and trees at the edge
  hut(gp, -0.12, Y, -0.395, 0.1);
  hut(gp, 0.09, Y, -0.4, -0.2, 0.9);
  hut(gp, 0.4, Y, -0.06, -1.4, 0.85);
  hut(gp, -0.4, Y, 0.08, 1.4, 0.8);
  for (const [x, z] of [[-0.02, -0.41], [0.38, 0.12], [-0.37, -0.16]]) {
    rod(gp, [x, Y, z], [x, Y + 0.09, z], 0.006, '#5b4030', 5);
    el(gp, '#4f7a3c', x, Y + 0.11, z, 0.04, 0.035, 0.04);
  }
};

// ---------------------------------------------------------------------------------------------------------------
// 射礼 ZHOU ARCHERY RITE: on a raised hall terrace two robed archers draw their bows at the cloth target (侯) with its
// painted bear-head bullseye; an attendant holds the arrows, the marker (获者) shelters by the target, and a drummer
// keeps the rhythm of the rite.
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
  arrow(A, [pull[0], pull[1], pull[2]], [hand[0] + 0.0, hand[1], hand[2] + 0.05], 1.1);
  cb(A, '#3a2a1c', 0.1 * h, 0.5 * h, -0.07 * h, 0.03 * h, 0.16 * h, 0.03 * h, 0, 0.2); // quiver
}
function target(p: O, x: number, y: number, z: number, ry: number): void {
  const T = grp(p, x, y, z, ry);
  for (const sx of [-1, 1]) {
    rod(T, [sx * 0.16, 0, 0], [sx * 0.16, 0.4, 0], 0.007, '#5a3d24', 6);
    rod(T, [sx * 0.16, 0.4, 0], [sx * 0.19, 0, -0.12], 0.0015, '#c9b48a', 3);
  }
  rod(T, [-0.18, 0.38, 0], [0.18, 0.38, 0], 0.005, '#5a3d24', 5);
  rod(T, [-0.18, 0.1, 0], [0.18, 0.1, 0], 0.005, '#5a3d24', 5);
  // 侯: hemp cloth with wide top and bottom "tongues", red border, leather 鹄 square with a bear's head
  cb(T, '#e6dcc4', 0, 0.24, 0, 0.28, 0.26, 0.006);
  cb(T, '#e6dcc4', 0, 0.37, 0, 0.32, 0.03, 0.006);
  cb(T, '#e6dcc4', 0, 0.11, 0, 0.32, 0.03, 0.006);
  for (const yy of [0.385, 0.095]) cb(T, '#9c2b1c', 0, yy, 0.002, 0.32, 0.008, 0.006);
  for (const sx of [-1, 1]) cb(T, '#9c2b1c', sx * 0.14, 0.24, 0.002, 0.008, 0.26, 0.006);
  cb(T, '#c79a52', 0, 0.24, 0.004, 0.12, 0.12, 0.004);
  cb(T, '#7a2a1a', 0, 0.24, 0.006, 0.1, 0.1, 0.002);
  el(T, '#4a3020', 0, 0.235, 0.008, 0.038, 0.034, 0.004);
  for (const sx of [-1, 1]) { el(T, '#4a3020', sx * 0.03, 0.27, 0.008, 0.013, 0.013, 0.004); dot(T, '#f2e6c8', sx * 0.014, 0.245, 0.012, 0.006); }
  el(T, '#d9b98a', 0, 0.222, 0.011, 0.016, 0.011, 0.003);
  dot(T, '#1a1410', 0, 0.228, 0.014, 0.004);
  // arrows that found the mark
  for (const [ax, ay] of [[0.02, 0.25], [-0.05, 0.2], [0.06, 0.3], [-0.09, 0.29]]) arrow(T, [ax + 0.01, ay + 0.004, 0.13], [ax, ay, 0.0], 1.1);
}
const lf_archery: Builder = gp => {
  const Y = ground(gp, 0.46, '#b6a27a', '#7a6a4c');
  // the hall terrace (堂) with steps
  const TH = 0.05;
  rbox(gp, '#a89a80', -0.2, Y, 0.05, 0.36, TH, 0.42, 0.006);
  for (let i = 0; i < 3; i++) cb(gp, '#b8aa8e', -0.2, Y + TH * (i / 3) + TH / 6, 0.27 + (2 - i) * 0.018, 0.12, TH / 3, 0.02);
  for (let i = 0; i < 5; i++) cyl(gp, '#8f2a1c', -0.36 + i * 0.08, Y + TH, -0.13, 0.008, 0.2, 8);
  cb(gp, '#3e4048', -0.2, Y + TH + 0.205, -0.13, 0.4, 0.014, 0.05);
  const TY = Y + TH;
  const tx = 0.28, tz = -0.2;
  const aim = (x: number, z: number) => Math.atan2(tx - x, tz - z);
  archer(gp, -0.2, TY, 0.12, aim(-0.2, 0.12), 0.27, '#7b2a20', '#d8b04a');
  archer(gp, -0.28, TY, -0.04, aim(-0.28, -0.04), 0.27, '#2f4a6a', '#d8b04a');
  target(gp, tx, Y, tz, -0.6);
  // attendant with a bundle of arrows
  const at = man(gp, -0.08, TY, -0.05, { h: 0.24, ry: -0.6, dress: 'ankle', top: '#5b6b4a', hat: '#1f1a17', hatStyle: 'knot', pose: 'carry' });
  for (let i = 0; i < 5; i++) arrow(gp, [at.handL[0] + i * 0.004 - 0.008, at.handL[1] - 0.06, at.handL[2]], [at.handL[0] + i * 0.004 - 0.008, at.handL[1] + 0.08, at.handL[2] + 0.004], 0.9);
  // marker crouched behind his screen (乏) beside the target, with a signal flag
  cb(gp, '#8a6a42', 0.14, Y + 0.05, -0.29, 0.1, 0.1, 0.012, 0.9);
  const mk = man(gp, 0.1, Y, -0.34, { h: 0.2, ry: 0.9, pose: 'crouch', top: '#8a7a5e', hat: '#1f1a17', hatStyle: 'knot' });
  rod(gp, mk.handR, [mk.handR[0] + 0.02, mk.handR[1] + 0.18, mk.handR[2] + 0.02], 0.003, '#5a3d24', 4);
  cb(gp, '#c0392b', mk.handR[0] + 0.045, mk.handR[1] + 0.16, mk.handR[2] + 0.02, 0.05, 0.035, 0.003, 0.9);
  // drum on a stand with a drummer
  const dx = 0.27, dz = 0.22;
  for (const s of [-1, 1]) rod(gp, [dx + s * 0.05, Y, dz], [dx + s * 0.05, Y + 0.14, dz], 0.005, '#3a2a1c', 5);
  const drum = plathe(gp, [[0, -0.04], [0.048, -0.04], [0.058, 0], [0.048, 0.04], [0, 0.04]], '#8c2a1c', (_x, yy) => (Math.abs(Math.abs(yy) - 0.035) < 0.004 ? '#d6b25e' : null), dx, Y + 0.13, dz, 18, 0.01);
  drum.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { const m = cyl(gp, '#e6d6b0', 0, 0, 0, 0.042, 0.002, 16); m.position.set(dx + s * 0.04, Y + 0.13, dz); m.rotation.z = Math.PI / 2; }
  const dr = man(gp, dx - 0.13, Y, dz + 0.02, { h: 0.23, ry: Math.PI / 2, dress: 'ankle', top: '#6a4a2a', hat: '#1f1a17', hatStyle: 'knot', hands: [[-0.06, 0.62, 0.3], [0.08, 0.74, 0.26]] });
  for (const hnd of [dr.handL, dr.handR]) rod(gp, hnd, [hnd[0] + 0.05, hnd[1] + 0.01, hnd[2]], 0.003, '#3a2a1c', 4);
};

// ---------------------------------------------------------------------------------------------------------------
// 投壶 PITCH-POT: host and guest kneel on a reed mat tossing arrows into a tall bronze pot with two ear tubes; the
// referee (司射) keeps score with counting tallies in a deer-shaped holder (中); wine cups wait on a low table.
// ---------------------------------------------------------------------------------------------------------------
function pot(p: O, x: number, y: number, z: number, s: number): void {
  const P = grp(p, x, y, z, 0, s);
  plathe(P, [[0, 0], [0.09, 0], [0.09, 0.03], [0.07, 0.04], [0.13, 0.12], [0.14, 0.2], [0.1, 0.3], [0.05, 0.36], [0.045, 0.55], [0.06, 0.62], [0.05, 0.62], [0.035, 0.56], [0, 0.56]], '#8a6a3a',
    (px, py, pz) => {
      if (py > 0.13 && py < 0.22) return (Math.floor(((Math.atan2(pz, px) / TAU) + 1) * 24) + Math.floor(py * 70)) % 2 ? '#5a7a5a' : '#9a7a44';
      if (Math.abs(py - 0.5) < 0.012 || Math.abs(py - 0.04) < 0.01) return '#c9a35a';
      return hash3(Math.floor(px * 60), Math.floor(py * 60), Math.floor(pz * 60)) > 0.8 ? '#6a8a6a' : null;
    }, 0, 0, 0, 24, 0.02, { metal: 0.45, rough: 0.45 });
  for (const sx of [-1, 1]) {
    plathe(P, [[0, 0], [0.03, 0], [0.032, 0.13], [0.024, 0.13], [0, 0.12]], '#8a6a3a', (_x, py) => (py > 0.115 ? '#1a1410' : null), sx * 0.075, 0.43, 0, 12, 0.03);
    cb(P, '#8a6a3a', sx * 0.055, 0.49, 0, 0.03, 0.02, 0.02);
  }
}
const lf_touhu: Builder = gp => {
  const Y = ground(gp, 0.46, '#8a6a46', '#5a4430', 0.03, (x, _y, z) => (Math.floor((x + 1) * 14) % 2 ? '#7f6140' : null));
  // reed mat (席) with a dark border
  cb(gp, '#3f5a3a', 0, Y, 0.0, 0.64, 0.004, 0.56);
  cb(gp, '#cdb27a', 0, Y + 0.001, 0.0, 0.6, 0.004, 0.52);
  for (let i = 0; i < 14; i++) cb(gp, '#bfa36a', -0.273 + i * 0.042, Y + 0.0045, 0.0, 0.006, 0.001, 0.51);
  const potX = 0, potZ = 0.2;
  pot(gp, potX, Y + 0.005, potZ, 0.48);
  // arrows in the pot, in an ear and on the mat
  const mouthY = Y + 0.005 + 0.48 * 0.6;
  for (const [dx, dz, lx, lz] of [[0.006, 0, 0.05, -0.02], [-0.006, 0.004, -0.04, 0.03], [0, -0.006, 0.01, -0.06], [0.004, 0.006, -0.02, 0.05]]) arrow(gp, [potX + dx + lx, mouthY + 0.13, potZ + dz + lz], [potX + dx, mouthY - 0.08, potZ + dz], 0.9, '#c0392b');
  arrow(gp, [potX + 0.036 + 0.05, mouthY + 0.07, potZ - 0.02], [potX + 0.036, mouthY - 0.07, potZ], 0.9, '#c0392b');
  for (const [ax, az, ry] of [[0.17, 0.27, 0.4], [-0.15, 0.3, -0.9], [0.1, 0.36, 1.6]]) arrow(gp, [ax - Math.cos(ry) * 0.08, Y + 0.008, az + Math.sin(ry) * 0.08], [ax + Math.cos(ry) * 0.08, Y + 0.008, az - Math.sin(ry) * 0.08], 0.9, '#c0392b');
  // host and guest
  const aimAt = (x: number, z: number) => Math.atan2(potX - x, potZ - z);
  const hx = -0.2, hz = -0.1, gx = 0.2, gz = -0.1;
  const H = seiza(gp, hx, Y + 0.005, hz, { h: 0.27, ry: aimAt(hx, hz), top: '#7b2a20', hat: '#1f1a17', hatStyle: 'knot', hands: [[-0.08, 0.24, 0.16], [0.13, 0.62, 0.2]] });
  arrow(gp, [H.handR[0] - 0.03, H.handR[1] + 0.03, H.handR[2] - 0.05], [H.handR[0] + 0.04, H.handR[1] - 0.01, H.handR[2] + 0.06], 0.9, '#c0392b');
  for (let i = 0; i < 3; i++) arrow(gp, [hx - 0.1, Y + 0.008 + i * 0.004, hz + 0.06 - i * 0.01], [hx - 0.02, Y + 0.008 + i * 0.004, hz + 0.1 - i * 0.01], 0.9, '#c0392b');
  seiza(gp, gx, Y + 0.005, gz, { h: 0.27, ry: aimAt(gx, gz), top: '#2f4a6a', hat: '#1f1a17', hatStyle: 'knot' });
  for (let i = 0; i < 3; i++) arrow(gp, [gx + 0.1, Y + 0.008 + i * 0.004, gz + 0.06 - i * 0.01], [gx + 0.02, Y + 0.008 + i * 0.004, gz + 0.1 - i * 0.01], 0.9, '#c0392b');
  // low table with lacquer ear-cups (耳杯) and a wine vessel
  const tz = -0.3;
  rbox(gp, '#1d1512', 0, Y + 0.035, tz, 0.26, 0.014, 0.1, 0.004);
  for (const sx of [-1, 1]) cb(gp, '#1d1512', sx * 0.11, Y + 0.0175, tz, 0.012, 0.035, 0.08);
  for (const cx of [-0.08, 0.08]) {
    const cup = plathe(gp, [[0, 0], [0.016, 0], [0.024, 0.012], [0.021, 0.012], [0, 0.004]], '#1d1512', (_x, yy, _z, _nx, ny) => (ny > 0.3 && yy > 0.006 ? '#a4291c' : null), cx, Y + 0.05, tz, 14, 0.006);
    cup.scale.set(1.3, 1, 0.9);
    for (const s of [-1, 1]) cb(gp, '#a4291c', cx, Y + 0.06, tz + s * 0.022, 0.016, 0.003, 0.008);
  }
  plathe(gp, [[0, 0], [0.025, 0], [0.035, 0.03], [0.03, 0.055], [0.022, 0.06], [0.026, 0.07], [0, 0.065]], '#8a6a3a', bronzePaint([[0.02, 0.04]], 3), 0, Y + 0.05, tz, 14, 0.008);
  // referee with tallies, beside the bronze deer tally-holder (中)
  const rf = man(gp, 0.34, Y + 0.005, 0.02, { h: 0.27, ry: -1.2, dress: 'ankle', top: '#5b4a3a', hat: '#1f1a17', hatStyle: 'knot', pose: 'carry' });
  beard(gp, rf, -1.2, 0.27, '#2a211b', 0.6);
  for (let i = 0; i < 6; i++) rod(gp, [rf.handL[0] + i * 0.003, rf.handL[1] - 0.02, rf.handL[2]], [rf.handL[0] + i * 0.003 + 0.01, rf.handL[1] + 0.05, rf.handL[2] + 0.01], 0.0018, '#d9c08a', 3);
  const D = grp(gp, 0.3, Y + 0.005, 0.18, -0.6);
  el(D, '#8a6a3a', 0, 0.03, 0, 0.022, 0.018, 0.038);
  el(D, '#8a6a3a', 0, 0.05, 0.036, 0.012, 0.014, 0.016);
  for (const s of [-1, 1]) { rod(D, [s * 0.006, 0.062, 0.036], [s * 0.016, 0.085, 0.03], 0.002, '#8a6a3a', 3); }
  cb(D, '#8a6a3a', 0, 0.006, 0, 0.04, 0.012, 0.07);
  for (let i = 0; i < 8; i++) rod(D, [(i % 4 - 1.5) * 0.004, 0.04, (Math.floor(i / 4) - 0.5) * 0.006], [(i % 4 - 1.5) * 0.006, 0.12, (Math.floor(i / 4) - 0.5) * 0.01], 0.0018, '#d9c08a', 3);
};

// ---------------------------------------------------------------------------------------------------------------
// 越王勾践剑 SWORD OF GOUJIAN: the golden bronze blade with its dark rhombus pattern and bird-script inscription,
// turquoise & blue-glass inlaid guard, cord-bound grip and concentric-ringed pommel, displayed diagonally on a black
// lacquered stand with its scabbard and a museum label.
// ---------------------------------------------------------------------------------------------------------------
const lf_sword: Builder = gp => {
  const Y = ground(gp, 0.46, '#2b2522', '#1a1614');
  cb(gp, '#b8902e', 0, Y + 0.002, 0.02, 0.84, 0.004, 0.4);
  cb(gp, '#d4ad48', 0, Y + 0.0045, 0.02, 0.8, 0.002, 0.36);
  // stand: lacquered plinth with vermilion trim
  rbox(gp, '#141010', 0, Y + 0.004, -0.04, 0.74, 0.035, 0.18, 0.006);
  rbox(gp, '#141010', 0, Y + 0.004, 0.13, 0.74, 0.02, 0.14, 0.005);
  for (const zz of [0.049, -0.131]) cb(gp, '#8c2318', 0, Y + 0.03, zz, 0.7, 0.004, 0.003);
  // the sword: local x runs pommel → tip, blade faces +z
  const L = 0.6, S = new THREE.Group();
  S.position.set(-0.02, Y + 0.25, -0.04);
  S.rotation.set(-0.5, 0, 0.3);
  gp.add(S);
  const B = grp(S, -0.214, 0, 0);
  const wAt = (x: number) => x < 0.38 ? 0.046 - 0.006 * (x / 0.38) : x < 0.5 ? 0.04 + 0.002 * ((x - 0.38) / 0.12) : 0.042 * Math.sqrt(Math.max(0, 1 - ((x - 0.5) / (L - 0.5)) ** 2));
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
  skin(B, rings, '#c99e48', {
    flat: true, metal: 0.55, rough: 0.35,
    paint: (x, y) => {
      const w = Math.max(0.002, wAt(x)), ay = Math.abs(y);
      if (ay > w * 0.84) return '#e3c378';
      if (ay < w * 0.08) return '#d6ae5a';
      if (x > 0.03 && x < 0.15 && ay < w * 0.42) {
        const slot = Math.floor((x - 0.03) / 0.03), lx = (x - 0.03) - slot * 0.03;
        if (lx > 0.004 && lx < 0.026 && ay > w * 0.1) return hash3(Math.floor(x * 260), Math.floor(y * 260), slot) > 0.45 ? '#2b241a' : '#c99e48';
        return null;
      }
      if (x > 0.53) return null;
      const u = x / 0.06 + 0.25, v = y / 0.03, a = fr(u + v), b = fr(u - v);
      if (a < 0.14 || b < 0.14) return '#c99e48';
      if (Math.abs(a - 0.57) < 0.3 && Math.abs(b - 0.57) < 0.3) return Math.abs(a - 0.57) < 0.12 && Math.abs(b - 0.57) < 0.12 ? '#3a3122' : '#2a241b';
      return null;
    },
  });
  // guard (格) with turquoise and blue glass inlay on both faces
  rbox(B, '#6e5228', -0.012, -0.052, 0, 0.026, 0.104, 0.036, 0.004);
  for (const sz of [-1, 1]) {
    cb(B, '#2a3a8a', -0.012, 0, sz * 0.019, 0.016, 0.03, 0.003);
    for (const sy of [-1, 1]) {
      cb(B, '#3fb3a6', -0.012, sy * 0.032, sz * 0.019, 0.014, 0.022, 0.003);
      cb(B, '#2a3a8a', -0.012, sy * 0.016, sz * 0.019, 0.01, 0.006, 0.0032);
    }
  }
  // grip (茎) with two hoops and silk cord wrapping
  add(B, g('lc1-cyl12', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12)), mat('#5a4426'), -0.09, 0, 0, 0.028, 0.15, 0.028, 0, 0, Math.PI / 2);
  for (let i = 0; i < 16; i++) torus(B, '#1e1a16', -0.03 - i * 0.0072, 0, 0, 0.0148, 0.16, Math.PI / 2, 0, 0.2);
  for (const hx of [-0.055, -0.115]) torus(B, '#7a5a2c', hx, 0, 0, 0.0158, 0.26, Math.PI / 2);
  // round pommel (首) with eleven-ring concentric circles
  add(B, g('lc1-cyl24', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24)), mat('#6e5228'), -0.172, 0, 0, 0.068, 0.014, 0.068, 0, 0, Math.PI / 2);
  for (let i = 1; i <= 5; i++) torus(B, i % 2 ? '#b08a44' : '#4a3a20', -0.18, 0, 0, i * 0.0062, 0.12, Math.PI / 2);
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
    { p: [-0.33, sy0, sz0], w: 0.012, h: 0.03 }, { p: [-0.05, sy0, sz0], w: 0.011, h: 0.028 },
    { p: [0.22, sy0, sz0], w: 0.01, h: 0.026 }, { p: [0.3, sy0, sz0], w: 0.008, h: 0.018 },
  ], '#1e1814', { radial: 10, sub: 4, up: [0, 0, 1], paint: x => (Math.floor(x * 40) % 6 === 0 ? '#5a2018' : null) });
  rbox(gp, '#8a6a34', -0.34, sy0 - 0.013, sz0, 0.02, 0.026, 0.064, 0.004);
  cone(gp, '#8a6a34', 0.31, sy0, sz0, 0.014, 0.03, 8).rotation.z = -Math.PI / 2;
  // museum label plate
  const lb = grp(gp, 0.28, Y + 0.01, 0.33, -0.25, 1, -0.9);
  cb(lb, '#e8e0cc', 0, 0, 0, 0.12, 0.07, 0.006);
  for (let i = 0; i < 4; i++) cb(lb, i === 0 ? '#8c2318' : '#3a3530', -0.005 + (i === 0 ? -0.02 : 0), 0.022 - i * 0.014, 0.004, i === 0 ? 0.06 : 0.09, 0.006, 0.002);
};

// ---------------------------------------------------------------------------------------------------------------
// 胡服骑射 KING WULING'S MOUNTED ARCHERS: Zhao horse archers in short tunics, trousers, belts and boots draw their
// bows from galloping horses at a target post on the steppe.
// ---------------------------------------------------------------------------------------------------------------
function horseArcher(p: O, x: number, y: number, z: number, ry: number, s: number, coat: string, mane: string, tunic: string, trousers: string): void {
  const H = grp(p, x, y, z, ry, s);
  const seat = horse(H, coat, mane, { stride: 0.09, cloth: '#7a2a1c' });
  const h = 0.5, y0 = seat - h * 0.45;
  const r = man(H, 0, y0, -0.02, {
    h, pose: 'sit', top: tunic, bottom: trousers, socks: '#1d1712', shoes: '#1d1712', skin: '#c8956a', hair: '#1c1714',
    hat: '#4a3424', hatStyle: 'fur', sleeve: 1, build: 1.05,
    feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.39, 0.62, 0.08], [-0.02, 0.64, 0.03]],
  });
  // belt with a gold hook (带钩) and a short tunic skirt
  el(H, '#2a1d14', 0, y0 + 0.37 * h, -0.02, 0.085 * h, 0.016 * h, 0.066 * h);
  dot(H, '#d6a840', 0, y0 + 0.37 * h, -0.02 + 0.066 * h, 0.01 * h);
  el(H, tunic, 0, y0 + 0.31 * h, -0.02, 0.1 * h, 0.05 * h, 0.08 * h);
  bow(H, r.handL, r.handR, [0, 1, 0.1], [-1, 0, 0], 0.17);
  arrow(H, r.handR, [r.handL[0] - 0.06, r.handL[1] + 0.006, r.handL[2]], 2);
  cb(H, '#3a2618', 0.07, seat - 0.02, -0.12, 0.03, 0.1, 0.04, 0, 0.5); // quiver
  for (let i = 0; i < 4; i++) rod(H, [0.07 + (i - 1.5) * 0.006, seat + 0.03, -0.1], [0.07 + (i - 1.5) * 0.006, seat + 0.06, -0.08], 0.003, '#e9e2cf', 3);
}
const lf_hufu: Builder = gp => {
  const Y = ground(gp, 0.46, '#8e9a5a', '#5f6440', 0.03, (x, _y, z) => {
    const n = fbm(x * 7, 0, z * 7, 3);
    if (Math.abs(z - 0.06 - Math.sin(x * 4) * 0.03) < 0.09 + n * 0.03) return n > 0.5 ? '#ab9468' : '#9e8760';
    return n > 0.62 ? '#a3ad66' : n < 0.36 ? '#7d8a4c' : null;
  });
  horseArcher(gp, -0.04, Y, 0.06, -Math.PI / 2 + 0.22, 0.52, '#7a4626', '#2a1a10', '#8a3a22', '#3b3a4a');
  horseArcher(gp, 0.26, Y, 0.27, -Math.PI / 2 + 0.3, 0.46, '#cfc6b4', '#8a8478', '#3d5a6a', '#4a3a2a');
  // target post: straw butt with painted rings, struck by arrows
  const tx = -0.3, tz = -0.3, T = grp(gp, tx, Y, tz, 0.35);
  rod(T, [0, 0, 0], [0, 0.26, 0], 0.008, '#5a3d24', 6);
  rod(T, [0, 0.1, 0], [0.05, 0, -0.03], 0.005, '#5a3d24', 5);
  rod(T, [0, 0.1, 0], [-0.05, 0, -0.03], 0.005, '#5a3d24', 5);
  const disc = plathe(T, [[0, -0.012], [0.09, -0.012], [0.095, 0], [0.09, 0.012], [0, 0.012]], '#d9c58a', (px, py, pz) => {
    if (py < 0.006) return null;
    const rr = Math.hypot(px, pz);
    return rr < 0.022 ? '#b8322a' : rr < 0.045 ? '#f0e6cc' : rr < 0.068 ? '#2a2420' : null;
  }, 0, 0.22, 0.012, 24, 0.008);
  disc.rotation.x = Math.PI / 2;
  for (const [ax, ay] of [[0.01, 0.23], [-0.03, 0.2], [0.04, 0.25]]) arrow(T, [ax + 0.02, ay + 0.01, 0.12], [ax, ay, 0.02], 1.2);
  // dust kicked up by the hooves
  for (const [dx, dz, s] of [[0.14, 0.08, 0.03], [0.18, 0.04, 0.022], [0.42, 0.28, 0.025], [0.38, 0.22, 0.02]]) add(gp, S14(), mat('#c9b48e', { transparent: 0.55, flat: false }), dx, Y + s * 0.6, dz, s * 1.3, s, s);
  for (let i = 0; i < 8; i++) dot(gp, '#6f7d42', -0.42 + hash3(i, 3, 1) * 0.84, Y + 0.006, -0.42 + hash3(i, 1, 4) * 0.25, 0.018);
};

// ---------------------------------------------------------------------------------------------------------------
// ANCIENT CURRENCY on a display table. r.style:
//   'banliang' (default) — Qin 半两 square-holed coins, strung and piled, with standardised 度量衡: a bronze 权 weight,
//                          Shang Yang's 方升 measure and a bronze ruler;
//   'knife'              — Wang Mang's gold-inlaid 金错刀 knife money, 货泉 coins and 布币 spade coins;
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
function coin(p: O, x: number, y: number, z: number, R: number, rot: V3, c = '#8a6a3a', marks: string[] = [], thick = 1): THREE.Group {
  const C = grp(p, x, y, z, rot[1], 1, rot[0], rot[2]);
  add(C, COIN(), mat(c, { metal: 0.5, rough: 0.5 }), 0, 0, 0, R, R, R * thick);
  const gc = shade(c, 1.45), gz = R * 0.07, gs = R * 0.36;
  const at: [number, number][] = marks.length === 2 ? [[0.6, 0], [-0.6, 0]] : [[0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0]];
  marks.forEach((k, i) => { if (GLYPH[k]) glyph(C, k, at[i][0] * R, at[i][1] * R, gs, gz, gc); });
  return C;
}
const FLAT: V3 = [-Math.PI / 2, 0, 0];
/** A string of cash (贯): coins threaded edge-to-edge along a curve. */
function cashString(p: O, pts: V3[], R: number, c: string): void {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  const n = Math.floor(curve.getLength() / (R * 0.32));
  for (let i = 0; i <= n; i++) {
    const t = i / n, q = curve.getPointAt(t), d = curve.getTangentAt(t);
    const m = add(p, COIN(), mat(i % 3 ? c : shade(c, 0.85), { metal: 0.5, rough: 0.5 }), q.x, q.y, q.z, R, R, R * 1.4);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  }
  for (const q of [pts[0], pts[pts.length - 1]]) { dot(p, '#b8322a', q[0], q[1], q[2], R * 0.6); rod(p, q, [q[0], q[1] - R * 0.3, q[2] + R * 1.5], R * 0.12, '#b8322a', 3); }
}
const lf_coins: Builder = (gp, r) => {
  const style = str(r.style, 'banliang');
  const Y = ground(gp, 0.46, '#4a3122', '#2e1e15');
  // display table with a silk cloth
  rbox(gp, '#3a2216', 0, Y, 0, 0.74, 0.04, 0.56, 0.008);
  cb(gp, style === 'jiaozi' ? '#2f4a5a' : '#7a2420', 0, Y + 0.041, 0.0, 0.7, 0.003, 0.52);
  cb(gp, '#c9a24a', 0, Y + 0.042, 0.0, 0.66, 0.002, 0.48);
  cb(gp, style === 'jiaozi' ? '#2f4a5a' : '#7a2420', 0, Y + 0.043, 0.0, 0.64, 0.002, 0.46);
  const TY = Y + 0.045;
  // a lacquered rack at the back holds the showpieces upright
  const rack = (w: number) => {
    rbox(gp, '#1d1310', 0, TY, -0.18, w, 0.03, 0.1, 0.005);
    for (const sx of [-1, 1]) rbox(gp, '#1d1310', sx * (w / 2 - 0.02), TY, -0.2, 0.025, 0.3, 0.03, 0.004);
    cb(gp, '#1d1310', 0, TY + 0.3, -0.2, w, 0.018, 0.03);
    cb(gp, '#8c2318', 0, TY + 0.028, -0.13, w - 0.02, 0.004, 0.003);
  };
  const BRONZE = '#8a6a3a', GREEN = '#5b7d62';
  if (style === 'knife') {
    rack(0.7);
    // 金错刀: a ring head (square-holed) and a long blade; gold-inlaid 一刀, cast 平五千
    for (const [kx, tilt] of [[-0.16, 0.06], [0.04, -0.04]]) {
      const K = grp(gp, kx, TY + 0.035, -0.17, 0, 1, 0, tilt);
      rbox(K, BRONZE, 0, 0, 0, 0.05, 0.16, 0.012, 0.003);
      cb(K, shade(BRONZE, 1.1), 0, 0.08, 0.0065, 0.044, 0.15, 0.002);
      for (let i = 0; i < 3; i++) cb(K, '#4a3a20', 0, 0.035 + i * 0.04, 0.008, 0.026, 0.026, 0.002);
      const C = coin(K, 0, 0.21, 0, 0.055, [0, 0, 0], BRONZE);
      glyph(C, 'yi', 0, 0.034, 0.03, 0.007, '#f0c14a', 0.2);
      glyph(C, 'dao', 0, -0.034, 0.03, 0.007, '#f0c14a', 0.2);
    }
    // 布币 spade coin with pointed feet
    const Sp = grp(gp, 0.24, TY + 0.035, -0.17);
    const sh = new THREE.Shape([[-0.012, 0.25], [0.012, 0.25], [0.014, 0.19], [0.06, 0.17], [0.065, 0.04], [0.06, 0], [0.02, 0.012], [0.0, 0.05], [-0.02, 0.012], [-0.06, 0], [-0.065, 0.04], [-0.06, 0.17], [-0.014, 0.19]].map(([a, b]) => new THREE.Vector2(a, b)));
    const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 });
    add(Sp, sg, mat(GREEN, { metal: 0.4, rough: 0.6 }), 0, 0, 0, 1, 1, 1);
    cb(Sp, shade(GREEN, 1.2), 0, 0.035, 0.012, 0.004, 0.13, 0.002);
    for (const s of [-1, 1]) cb(Sp, shade(GREEN, 1.2), s * 0.03, 0.1, 0.012, 0.004, 0.08, 0.002, 0, 0, s * 0.15);
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
      for (let c = 0; c < 6; c++) for (let k = 0; k < 7; k++) cb(N, '#2a2622', -0.05 + c * 0.02, 0.135 + k * 0.016, 0.003, 0.009, 0.009, 0.001);
      for (const [sx, sy, ss] of [[0.04, 0.2, 0.03], [-0.04, 0.12, 0.026], [0.035, 0.03, 0.022]]) cb(N, '#c0392b', sx, sy, 0.0042, ss, ss, 0.001);
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
    for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) cb(P, '#6a8a76', -0.045 + i * 0.018, 0.037, -0.03 + k * 0.016, 0.01, 0.003, 0.01);
    for (let i = 0; i < 3; i++) cb(P, '#6a8a76', -0.035 + i * 0.035, 0.037, -0.07, 0.025, 0.003, 0.02);
    rod(gp, [0.2, TY + 0.006, 0.24], [0.3, TY + 0.006, 0.18], 0.004, '#5a3d24', 5);
    cone(gp, '#1a1714', 0.19, TY + 0.006, 0.245, 0.006, 0.02, 6).rotation.z = Math.PI / 2;
    // strings of 通宝 cash
    cashString(gp, [[0.18, TY + 0.012, -0.02], [0.3, TY + 0.012, 0.02], [0.33, TY + 0.012, 0.12], [0.26, TY + 0.012, 0.2]], 0.024, BRONZE);
    cashString(gp, [[-0.32, TY + 0.012, 0.22], [-0.18, TY + 0.012, 0.24], [-0.06, TY + 0.012, 0.22]], 0.024, '#7a5a30');
    for (let i = 0; i < 5; i++) coin(gp, -0.08 + i * 0.04, TY + 0.004, 0.02 + (i % 2) * 0.03, 0.022, FLAT, BRONZE);
  } else {
    rack(0.62);
    // three showpiece 半两 coins standing in the rack
    coin(gp, 0, TY + 0.15, -0.19, 0.105, [0, 0, 0], BRONZE, ['ban', 'liang']);
    coin(gp, -0.2, TY + 0.13, -0.19, 0.08, [0, 0.1, 0], GREEN, ['ban', 'liang']);
    coin(gp, 0.2, TY + 0.13, -0.19, 0.08, [0, -0.1, 0], shade(BRONZE, 0.9), ['ban', 'liang']);
    // a string of cash and stacks of coins
    cashString(gp, [[-0.32, TY + 0.03, 0.04], [-0.2, TY + 0.03, 0.06], [-0.08, TY + 0.03, 0.04]], 0.03, BRONZE);
    for (let s = 0; s < 3; s++) for (let i = 0; i < 6 - s; i++) coin(gp, -0.26 + s * 0.07 + (hash3(s, i, 1) - 0.5) * 0.006, TY + 0.004 + i * 0.0062, 0.18 + (s % 2) * 0.03, 0.03, [-Math.PI / 2, 0, i * 0.5], i % 2 ? BRONZE : GREEN);
    for (let i = 0; i < 4; i++) coin(gp, -0.04 + i * 0.03, TY + 0.004, 0.19 - (i % 2) * 0.03, 0.03, [-Math.PI / 2, 0, i], BRONZE, ['ban', 'liang']);
    // 权: Qin bronze weight with a nose loop
    plathe(gp, [[0, 0], [0.06, 0], [0.064, 0.012], [0.056, 0.05], [0.036, 0.074], [0.016, 0.082], [0, 0.084]], '#6e5a3a',
      (_x, yy) => (Math.abs(yy - 0.03) < 0.012 ? (hash3(Math.floor(_x * 200), Math.floor(yy * 300), 1) > 0.5 ? '#3a3020' : '#6e5a3a') : null), 0.1, TY, 0.02, 20, 0.008, { metal: 0.4, rough: 0.6 });
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
// 蹴鞠 CUJU: a Song-style match — the 风流眼 goal (a round hole high in a net between two bamboo poles hung with
// streamers), two teams in short robes juggling and kicking the stitched leather ball over, spectators watching.
// ---------------------------------------------------------------------------------------------------------------
function streamer(p: O, x: number, y: number, z: number, c: string, ph: number): void {
  const F = anim(p, 'flap', x, y, z, { phase: ph, amp: 0.35 });
  for (let i = 0; i < 4; i++) cb(F, c, 0.014 + i * 0.02, -0.008 - i * 0.012, 0, 0.022, 0.012 - i * 0.002, 0.002, 0, 0, -0.5);
}
function leatherBall(p: O, x: number, y: number, z: number, r: number): void {
  el(p, '#9a6a34', x, y, z, r);
  for (const [ry, rx] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) torus(p, '#3a2414', x, y, z, r * 1.01, 0.05, ry, rx);
}
function kicker(p: O, x: number, y: number, z: number, ry: number, h: number, top: string, kick: number): HumanRig {
  // kick: 0 = ready stance, 1 = high instep kick with the right foot, 2 = knee juggle with the left
  const feet: [V3, V3] = kick === 1 ? [[-0.06, 0.032, -0.02], [0.08, 0.36, 0.26]] : kick === 2 ? [[-0.05, 0.22, 0.12], [0.07, 0.032, -0.03]] : [[-0.1, 0.032, 0.03], [0.1, 0.032, -0.02]];
  const r = man(p, x, y, z, {
    h, ry, top, bottom: '#e8e0cc', dress: 'knee', sleeve: 0.45, hat: '#1a1714', hatStyle: 'cap', shoes: '#1a1714', socks: '#e8e0cc',
    feet, hands: kick ? [[-0.24, 0.62, -0.02], [0.22, 0.58, 0.06]] : [[-0.16, 0.5, 0.12], [0.16, 0.5, 0.12]], lean: kick === 1 ? -0.12 : 0.1,
    hipY: kick === 1 ? 0.47 : kick === 2 ? 0.48 : 0.45,
  });
  const b = off(r.head, ry, 0, -0.27 * h);
  el(p, '#d6a840', b[0], b[1], b[2], 0.088 * h, 0.014 * h, 0.07 * h, ry);
  return r;
}
const lf_cuju: Builder = gp => {
  const Y = ground(gp, 0.46, '#b49a6c', '#7d6a4a', 0.03, (x, _y, z) => {
    const n = fbm(x * 9, 1, z * 9, 3);
    if (Math.abs(Math.hypot(x, z) - 0.4) < 0.006) return '#e8dcc0';
    return n > 0.6 ? '#c2a97a' : n < 0.38 ? '#a48a5e' : null;
  });
  // the 球门: two bamboo poles, net screen with the round 风流眼 hole near the top
  const GZ = -0.18, PX = 0.13, H0 = 0.28, H1 = 0.6, HY = 0.5, HR = 0.045;
  for (const s of [-1, 1]) {
    rod(gp, [s * PX, Y, GZ], [s * PX, Y + H1 + 0.06, GZ], 0.008, '#b8a24a', 7);
    for (let k = 1; k < 9; k++) torus(gp, '#8e7a34', s * PX, Y + k * 0.075, GZ, 0.0085, 0.25, 0, Math.PI / 2);
    cone(gp, '#c0392b', s * PX, Y + H1 + 0.06, GZ, 0.012, 0.03, 6);
    for (let k = 0; k < 3; k++) streamer(gp, s * PX + s * 0.006, Y + H1 + 0.04 - k * 0.07, GZ, ['#c0392b', '#2f6db0', '#e0b12a'][(k + (s > 0 ? 1 : 0)) % 3], k + s);
    rbox(gp, '#5a5048', s * PX, Y, GZ, 0.05, 0.02, 0.05, 0.005);
  }
  const net = g('lc1-cuju-net', () => {
    const sh = new THREE.Shape(); sh.moveTo(-PX, H0); sh.lineTo(PX, H0); sh.lineTo(PX, H1); sh.lineTo(-PX, H1); sh.lineTo(-PX, H0);
    const hole = new THREE.Path(); hole.absarc(0, HY, HR, 0, TAU, true); sh.holes.push(hole);
    return new THREE.ShapeGeometry(sh, 20);
  });
  const nm = add(gp, net, mat('#e8dcb8', { transparent: 0.45 }), 0, Y, GZ, 1, 1, 1);
  nm.material = (nm.material as THREE.MeshStandardMaterial).clone();
  (nm.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  for (const yy of [H0, H1]) cb(gp, '#6a4a2a', 0, Y + yy, GZ, PX * 2, 0.008, 0.008);
  for (let i = 1; i < 9; i++) {
    const yy = H0 + (i / 9) * (H1 - H0), dy = yy - HY;
    if (Math.abs(dy) >= HR) cb(gp, '#a89870', 0, Y + yy, GZ, PX * 2, 0.002, 0.002);
    else { const hw = Math.sqrt(HR * HR - dy * dy); for (const s of [-1, 1]) cb(gp, '#a89870', s * (hw + PX) / 2, Y + yy, GZ, PX - hw, 0.002, 0.002); }
  }
  for (let i = 1; i < 10; i++) {
    const xx = -PX + (i / 10) * PX * 2;
    if (Math.abs(xx) >= HR) cb(gp, '#a89870', xx, Y + (H0 + H1) / 2, GZ, 0.002, H1 - H0, 0.002);
    else { const hh = Math.sqrt(HR * HR - xx * xx); cb(gp, '#a89870', xx, Y + (H0 + HY - hh) / 2, GZ, 0.002, HY - hh - H0, 0.002); cb(gp, '#a89870', xx, Y + (H1 + HY + hh) / 2, GZ, 0.002, H1 - HY - hh, 0.002); }
  }
  torus(gp, '#c0392b', 0, Y + HY, GZ, HR, 0.12);
  // teams: red on the near side, blue beyond the net
  const h = 0.27;
  kicker(gp, 0.06, Y, 0.05, Math.PI + 0.2, h, '#b0302a', 1);
  kicker(gp, -0.22, Y, 0.12, Math.PI - 0.5, h, '#b0302a', 2);
  kicker(gp, 0.27, Y, 0.16, Math.PI + 0.7, h, '#b0302a', 0);
  kicker(gp, -0.08, Y, -0.36, 0.1, h, '#2f5a94', 0);
  kicker(gp, 0.24, Y, -0.32, -0.3, h, '#2f5a94', 2);
  // the ball arcing up toward the hole, with motion puffs along its path
  leatherBall(gp, 0.025, Y + 0.38, -0.06, 0.03);
  for (let i = 1; i <= 3; i++) el(gp, '#e8dcc0', 0.04 + i * 0.008, Y + 0.38 - i * 0.05, -0.04 + i * 0.03, 0.01 - i * 0.002);
  leatherBall(gp, -0.2, Y + 0.012 + 0.0, 0.19, 0.012);
  // spectators at the front corners, a seated official with a scoring flag
  man(gp, -0.36, Y, 0.24, { h: 0.27, ry: 0.9, top: '#5a6e4a', dress: 'ankle', hat: '#1a1714', hatStyle: 'cap', pose: 'cheer' });
  man(gp, -0.4, Y, 0.06, { h: 0.25, ry: 1.3, top: '#8a6a9a', dress: 'ankle', hair: '#1c1714', hatStyle: 'knot', pose: 'relax' });
  const o = man(gp, 0.38, Y, 0.0, { h: 0.27, ry: -1.3, top: '#3b3a4a', dress: 'ankle', hat: '#1a1714', hatStyle: 'cap', pose: 'point' });
  rod(gp, o.handR, [o.handR[0], o.handR[1] + 0.12, o.handR[2]], 0.003, '#5a3d24', 4);
  cb(gp, '#e0b12a', o.handR[0], o.handR[1] + 0.1, o.handR[2] + 0.02, 0.004, 0.035, 0.04);
  man(gp, 0.34, Y, 0.28, { h: 0.24, ry: -0.6, top: '#c27a3a', dress: 'ankle', hair: '#1c1714', hatStyle: 'knot', pose: 'wave' });
};

// ---------------------------------------------------------------------------------------------------------------
// 百戏 HAN ACROBATICS: a rope-walker with parasol, a strongman balancing a pole with a child doing a handstand on top,
// a ball juggler, a tumbler mid-somersault, a drummer at the feathered 建鼓, and robed spectators kneeling on mats.
// ---------------------------------------------------------------------------------------------------------------
const lf_acrobats: Builder = gp => {
  const Y = ground(gp, 0.46, '#a68a62', '#6e5a40', 0.03, (x, _y, z) => {
    const n = fbm(x * 8, 2, z * 8, 3);
    return n > 0.6 ? '#b39870' : n < 0.38 ? '#987c56' : null;
  });
  cb(gp, '#8c2a20', 0.02, Y + 0.002, 0.04, 0.5, 0.004, 0.36);
  cb(gp, '#c9a24a', 0.02, Y + 0.0045, 0.04, 0.46, 0.002, 0.32);
  cb(gp, '#8c2a20', 0.02, Y + 0.006, 0.04, 0.44, 0.002, 0.3);
  // tightrope between two braced posts at the back
  const RZ = -0.27, RY = Y + 0.36, X0 = -0.4, X1 = 0.06;
  for (const xx of [X0, X1]) {
    rod(gp, [xx, Y, RZ], [xx, RY + 0.03, RZ], 0.01, '#6a4a2c', 6);
    rod(gp, [xx, RY - 0.02, RZ], [xx + (xx < 0 ? -0.04 : 0.05), Y, RZ + 0.05], 0.004, '#c9b88a', 3);
    rod(gp, [xx, RY - 0.02, RZ], [xx + (xx < 0 ? -0.04 : 0.05), Y, RZ - 0.05], 0.004, '#c9b88a', 3);
  }
  rod(gp, [X0, RY, RZ], [(X0 + X1) / 2, RY - 0.012, RZ], 0.0025, '#d8c8a0', 3);
  rod(gp, [(X0 + X1) / 2, RY - 0.012, RZ], [X1, RY, RZ], 0.0025, '#d8c8a0', 3);
  const wx = (X0 + X1) / 2 + 0.02, rw = man(gp, wx, RY - 0.012 - 0.032 * 0.24, RZ, {
    h: 0.24, ry: 0.15, top: '#c0392b', bottom: '#e8dcc0', dress: 'knee', sleeve: 0.45, hatStyle: 'knot', shoes: '#1a1714',
    feet: [[-0.03, 0.032, -0.08], [0.03, 0.032, 0.08]], hands: [[-0.32, 0.72, 0], [0.3, 0.8, 0.02]],
  });
  // parasol in the walker's right hand
  rod(gp, rw.handR, [rw.handR[0], rw.handR[1] + 0.09, rw.handR[2]], 0.002, '#5a3d24', 3);
  plathe(gp, [[0, 0.02], [0.03, 0.012], [0.05, 0]], '#d9c58a', (px, _py, pz) => (Math.floor((Math.atan2(pz, px) / TAU) * 12 + 12) % 2 ? '#b0302a' : null), rw.handR[0], rw.handR[1] + 0.07, rw.handR[2], 12, 0.008);
  // 寻橦 pole balancing: strongman holding a tall pole, child in a handstand on the top crossbar
  const PX = 0.25, PZ = -0.1, sm = man(gp, PX, Y, PZ, {
    h: 0.3, ry: -0.2, top: '#e8dcc0', bottom: '#3a3530', dress: 'knee', sleeve: 0, build: 1.2, hatStyle: 'knot', skin: '#c48a5c',
    feet: [[-0.1, 0.032, 0.03], [0.1, 0.032, -0.02]], hands: [[-0.03, 0.9, 0.06], [0.03, 0.9, 0.06]],
  });
  const PT = Y + 0.5, hx = (sm.handL[0] + sm.handR[0]) / 2, hz = (sm.handL[2] + sm.handR[2]) / 2;
  rod(gp, [hx, sm.handL[1] - 0.04, hz], [hx, PT, hz], 0.007, '#9a7a44', 6);
  cb(gp, '#9a7a44', hx, PT, hz, 0.07, 0.008, 0.008);
  const C = grp(gp, hx, PT + 0.004, hz, 0.2, 1, 0, Math.PI);
  man(C, 0, -1.08 * 0.17, 0, {
    h: 0.17, top: '#2f6db0', bottom: '#e8dcc0', dress: 'knee', sleeve: 0, hatStyle: 'knot',
    feet: [[-0.03, 0.032, -0.06], [0.04, 0.0, 0.12]], hands: [[-0.06, 1.08, 0.0], [0.06, 1.08, 0.0]],
  });
  // juggler with five balls in the air
  const jg = man(gp, -0.2, Y + 0.006, 0.06, {
    h: 0.27, ry: 0.4, top: '#3b6a4a', bottom: '#e8dcc0', dress: 'knee', sleeve: 0.45, hatStyle: 'knot',
    hands: [[-0.14, 0.62, 0.16], [0.14, 0.6, 0.16]], feet: [[-0.08, 0.032, 0.02], [0.08, 0.032, 0.0]],
  });
  const B = anim(gp, 'bob', (jg.handL[0] + jg.handR[0]) / 2, (jg.handL[1] + jg.handR[1]) / 2, (jg.handL[2] + jg.handR[2]) / 2);
  for (let i = 0; i < 5; i++) {
    const a = 0.25 + (i / 4) * (Math.PI - 0.5);
    dot(B, ['#c0392b', '#e0b12a', '#2f6db0', '#e8dcc0', '#3b8a4a'][i], Math.cos(a) * 0.07, Math.sin(a) * 0.11 + 0.02, 0.01, 0.011);
  }
  // tumbler in a tucked somersault above the mat
  const T = grp(gp, 0.03, Y + 0.24, 0.14, 0.15, 1, 0, 2.5);
  man(T, 0, -0.5 * 0.24, 0, {
    h: 0.24, top: '#e0b12a', bottom: '#8c2a20', dress: 'knee', sleeve: 0, hatStyle: 'knot',
    feet: [[-0.2, 0.1, 0.0], [0.2, 0.12, 0.0]], hands: [[-0.26, 0.86, 0.02], [0.26, 0.86, 0.02]],
  });
  for (let i = 0; i < 3; i++) el(gp, '#c9b48e', -0.02 + i * 0.03, Y + 0.012, 0.18 + i * 0.01, 0.018 - i * 0.004, 0.008, 0.014);
  // 建鼓: drum pierced by a pole on a crouching-beast base, feather canopy and streamers, drummer with sticks
  const DX = 0.34, DZ = 0.2;
  el(gp, '#5a4a3a', DX, Y + 0.02, DZ, 0.045, 0.025, 0.04);
  rod(gp, [DX, Y, DZ], [DX, Y + 0.5, DZ], 0.006, '#8c2a20', 6);
  const D = grp(gp, DX, Y + 0.25, DZ, -0.9, 1, 0, Math.PI / 2);
  plathe(D, [[0, -0.05], [0.06, -0.05], [0.072, -0.025], [0.075, 0], [0.072, 0.025], [0.06, 0.05], [0, 0.05]], '#8c2a20', (_x, yy) => (Math.abs(yy) > 0.046 ? '#e0d2b0' : Math.abs(Math.abs(yy) - 0.035) < 0.004 ? '#e0b12a' : null), 0, 0, 0, 18, 0.008);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    rod(gp, [DX, Y + 0.48, DZ], [DX + Math.cos(a) * 0.07, Y + 0.44, DZ + Math.sin(a) * 0.07], 0.003, i % 2 ? '#3b8a4a' : '#e0b12a', 3);
  }
  cone(gp, '#c0392b', DX, Y + 0.49, DZ, 0.014, 0.04, 6);
  streamer(gp, DX + 0.006, Y + 0.45, DZ, '#c0392b', 0.5);
  const dr = man(gp, DX - 0.1, Y, DZ - 0.04, {
    h: 0.28, ry: 1.6, top: '#4a3a5a', bottom: '#e8dcc0', dress: 'knee', sleeve: 0.45, hatStyle: 'knot',
    feet: [[-0.09, 0.032, 0.03], [0.09, 0.032, -0.03]], hands: [[-0.05, 0.88, 0.22], [0.12, 0.6, 0.24]],
  });
  for (const hnd of [dr.handL, dr.handR]) rod(gp, hnd, [hnd[0] + 0.035, hnd[1] + 0.01, hnd[2] + 0.0], 0.0025, '#5a3d24', 3);
  // robed spectators kneeling on mats at the front-left
  for (const [sx, sz, ry, c] of [[-0.33, 0.2, 0.9, '#6a4a6a'], [-0.23, 0.3, 0.6, '#3b5a6a']] as [number, number, number, string][]) {
    cb(gp, '#c9b88a', sx, Y + 0.002, sz, 0.1, 0.004, 0.1, ry);
    seiza(gp, sx, Y + 0.004, sz, { h: 0.26, ry, top: c, hat: '#1a1714', hatStyle: 'cap' });
  }
};

// ---------------------------------------------------------------------------------------------------------------
// 老子出关 LAOZI LEAVES THROUGH HANGU PASS: the white-bearded sage riding a dark water buffalo westwards, whisk in hand
// and scroll in the other, the gatekeeper Yin Xi bowing before the tiled pass gate, purple qi drifting in from the
// east (紫气东来).
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
  const Y = ground(gp, 0.46, '#a08a64', '#6b5a40', 0.03, (x, _y, z) => {
    const n = fbm(x * 8, 3, z * 8, 3);
    if (Math.abs(z - 0.08) < 0.1 + n * 0.03) return n > 0.5 ? '#b8a07a' : '#ad966e';
    return n > 0.6 ? '#8a8a54' : n < 0.36 ? '#958058' : null;
  });
  // 函谷关: rammed-earth wall with a gate passage and a tiled gate tower
  const GZ = -0.3;
  for (const s of [-1, 1]) {
    rbox(gp, '#9a8a72', s * 0.27, Y, GZ, 0.36, 0.24, 0.12, 0.004);
    for (let k = 0; k < 6; k++) cb(gp, '#8a7a62', s * 0.27, Y + 0.02 + k * 0.04, GZ + 0.061, 0.36, 0.002, 0.001);
    for (let k = 0; k < 5; k++) cb(gp, '#8a7a62', s * (0.1 + k * 0.08), Y + 0.25, GZ + 0.04, 0.04, 0.025, 0.03);
  }
  rbox(gp, '#9a8a72', 0, Y + 0.17, GZ, 0.18, 0.07, 0.12, 0.004);
  cb(gp, '#1c1814', 0, Y + 0.085, GZ + 0.02, 0.1, 0.17, 0.1);
  add(gp, g('lc1-arch', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, false, -Math.PI / 2, Math.PI)), mat('#1c1814'), 0, Y + 0.17, GZ + 0.02, 0.1, 0.1, 0.1, 0, Math.PI / 2, 0);
  for (const s of [-1, 1]) cb(gp, '#5a3d24', s * 0.03, Y + 0.085, GZ + 0.066, 0.05, 0.16, 0.006, s * 0.6);
  hall(gp, 0, Y + 0.24, GZ, 0.26, 0.1, 0.09, '#3a3f44', 0, '#8c2a20', { col: '#6a1c16' });
  cb(gp, '#1a1714', 0, Y + 0.3, GZ + 0.06, 0.07, 0.03, 0.004);
  cb(gp, '#e0c060', 0, Y + 0.3, GZ + 0.0625, 0.06, 0.022, 0.002);
  // the water buffalo walking west (toward −x)
  const OX = 0.08, OZ = 0.06, Ob = grp(gp, OX, Y, OZ, -Math.PI / 2 + 0.08, 0.95);
  const back = buffalo(Ob, '#2c3340') * 0.95;
  // Laozi sitting sideways, facing the viewer, legs hanging down the near flank
  const h = 0.3, sY = Y + back - 0.006;
  const lz = man(gp, OX + 0.01, sY - 0.27 * h, OZ, {
    h, ry: 0.08, pose: 'sit', top: '#a9a48e', bottom: '#a9a48e', dress: 'knee', hair: '#f2f0ea', hatStyle: 'knot', skin: '#d6a47c', shoes: '#3a3530',
    feet: [[-0.07, -0.2, 0.16], [0.06, -0.24, 0.15]], hands: [[-0.14, 0.38, 0.14], [0.12, 0.44, 0.16]], lean: -0.04,
  });
  el(gp, '#a9a48e', OX + 0.01, sY - 0.01, OZ + 0.02, 0.06, 0.03, 0.08); // robe draped over the back
  el(gp, '#5a3a5a', OX + 0.01, sY + 0.37 * h - 0.27 * h, OZ + 0.005, 0.07 * h * 1.3, 0.016 * h, 0.06 * h * 1.3);
  for (const s of [-1, 1]) el(gp, '#9a947e', OX + 0.01 + s * 0.04, sY - 0.06, OZ + 0.06, 0.03, 0.06, 0.028);
  beard(gp, lz, 0.08, h, '#f4f2ec', 1.5);
  for (const s of [-1, 1]) { const e = off(lz.head, 0.08, 0.05 * h, 0.03 * h, s * 0.03 * h); el(gp, '#f4f2ec', e[0], e[1], e[2], 0.01 * h, 0.004 * h, 0.006 * h); }
  // whisk (拂尘) in the right hand, scroll in the left
  const wh = lz.handR;
  rod(gp, wh, [wh[0] + 0.02, wh[1] + 0.06, wh[2] + 0.01], 0.003, '#6a4a2c', 4);
  sweep(gp, [{ p: [wh[0] + 0.02, wh[1] + 0.06, wh[2] + 0.01], w: 0.004 }, { p: [wh[0] + 0.04, wh[1] + 0.05, wh[2] + 0.012], w: 0.007 }, { p: [wh[0] + 0.05, wh[1] + 0.02, wh[2] + 0.014], w: 0.005 }, { p: [wh[0] + 0.05, wh[1] - 0.01, wh[2] + 0.014], w: 0.0015 }], '#f6f4ee', { radial: 6, sub: 3 });
  const sc = lz.handL;
  add(gp, g('lc1-cyl8', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8)), mat('#d9c58a'), sc[0], sc[1], sc[2] + 0.005, 0.014, 0.06, 0.014, 0, 0, Math.PI / 2 - 0.3);
  for (const s of [-1, 1]) dot(gp, '#5a3d24', sc[0] + s * 0.03 * Math.cos(0.3), sc[1] + s * 0.03 * Math.sin(0.3), sc[2] + 0.005, 0.006);
  // halter rope and a boy leading the buffalo
  const nose: V3 = [OX - 0.335, Y + 0.2, OZ + 0.0];
  const boy = man(gp, OX - 0.42, Y, OZ + 0.06, {
    h: 0.2, ry: -1.4, pose: 'walk', phase: 0.2, top: '#4a6a8a', bottom: '#e8dcc0', dress: 'knee', sleeve: 0.45, hair: '#1c1714', hatStyle: 'knot',
  });
  tube(gp, [nose, [OX - 0.39, Y + 0.12, OZ + 0.04], boy.handR], 0.0025, 0.0025, '#8a6a3a', { radial: 5 });
  // Yin Xi, keeper of the pass, bowing in welcome before the gate
  const yx = man(gp, -0.3, Y, -0.12, { h: 0.31, ry: 1.1, pose: 'pray', lean: 0.45, top: '#2f4a6a', dress: 'ankle', hat: '#1a1714', hatStyle: 'cap' });
  beard(gp, yx, 1.1, 0.31, '#1c1714', 0.6);
  man(gp, -0.18, Y, -0.2, { h: 0.27, ry: 0.8, pose: 'stand', top: '#6a2a20', dress: 'ankle', hat: '#1a1714', hatStyle: 'cap', armor: '#3a3530' });
  // 紫气东来: purple qi rolling in from the east
  const Q = anim(gp, 'bob', 0.34, Y + 0.48, -0.12);
  for (const [qx, qy, qz, r] of [[0, 0, 0, 0.06], [0.06, -0.02, 0.03, 0.05], [-0.06, 0.01, 0.02, 0.045], [0.02, 0.04, -0.02, 0.045], [-0.12, 0.03, 0.04, 0.035], [-0.2, 0.04, 0.05, 0.025]] as [number, number, number, number][]) {
    add(Q, S14(), mat('#a070c8', { transparent: 0.55, emissive: '#3a1a5a', flat: false }), qx * 1.3, qy, qz, r * 1.6, r * 0.55, r * 0.9);
  }
  for (let i = 0; i < 4; i++) add(Q, S8(), mat('#c8a0e8', { transparent: 0.4, emissive: '#4a2a6a' }), -0.26 - i * 0.05, 0.05 - i * 0.02, 0.06 + i * 0.03, 0.02 - i * 0.003, 0.012, 0.016);
};

export const H_LIFE_CUSTOM1: Record<string, Builder> = {
  lf_pekingman, lf_fire, lf_jue, lf_jingtian, lf_archery, lf_touhu, lf_sword, lf_hufu, lf_coins, lf_cuju, lf_acrobats, lf_laozi,
};
