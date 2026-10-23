import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import {
  type Builder, type V3, mat, box, tbox, cyl, cone, rbox, rod, skin, slab, lathe, prism, gable, tube, shade, hash3, sweep, add, g,
} from './prims.ts';
import { human, type HumanOpts, type HumanPose } from './human.ts';
import { figure, figureBase } from './figure.ts';
import { costume } from './costume.ts';
import { eraOf } from '../../shared/data/era.ts';
import type { PersonRole } from '../../shared/data/heroes.ts';
import { horse } from './animals.ts';
import { grp, proof, storey, hall, gourd, minipine } from './timber.ts';

// Detailed history models for Ages, built with the pocket-planet kit. Front faces +z, base at y=0, footprint ≈ ±0.45
// (kit.ts scales them to the atlas' model size). Animated parts are named groups (see scene/animate.ts).

const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
const tint = (c: string, d: number) => shade(c, 1 + d);
/** ellipsoid with segment count scaled to its size (prims' ellip is heavy for tiny parts). */
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz), s = r > 0.05 ? 14 : r > 0.025 ? 10 : 7;
  return add(p, g('rich:sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(4, Math.round(s * 0.6)))), mat(c), x, y, z, rx, ry, rz, roty, rotx, rotz);
};
function anim(p: THREE.Object3D, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}

// ---- palette ------------------------------------------------------------------------------------------------
const P = {
  vermilion: '#a8352a', lacquer: '#7a2318', glaze: '#c99a2e', tile: '#4a4f57', jade: '#3f7f6d', stone: '#bdb4a2', rammed: '#b89b6e',
  wood: '#7a5536', darkwood: '#4a3222', bronze: '#8a6a3a', patina: '#4f8a7a', gold: '#d6a840', iron: '#4b5058', silk: '#e9dcc0',
  paper: '#efe3c4', ink: '#22201c', earth: '#8a7458', grass: '#6f8a4a', water: '#3f6f86', white: '#e8e2d4',
};

// ---- small parts --------------------------------------------------------------------------------------------
/** A Chinese war banner: pole with a spear finial and a cloth of `n` flapping segments with a darker serrated edge. */
export function banner(p: THREE.Object3D, x: number, y: number, z: number, h: number, color: string, w = h * 0.42, ry = 0): void {
  const b = grp(p, x, z, ry, y);
  rod(b, [0, 0, 0], [0, h, 0], h * 0.012, P.darkwood, 5);
  cone(b, P.gold, 0, h, 0, h * 0.022, h * 0.07, 5);
  ellip(b, '#b91c1c', 0, h * 0.985, 0, h * 0.02, h * 0.012, h * 0.02);
  let parent: THREE.Object3D = b;
  const n = 4, sw = w / n, fh = w * 1.15, edge = shade(color, 0.6);
  for (let i = 0; i < n; i++) {
    const seg = anim(parent, 'flap', i === 0 ? 0 : sw, i === 0 ? h * 0.93 : 0, 0, { phase: i * 0.7, amp: 0.18 + i * 0.07 });
    box(seg, color, sw / 2, -fh / 2, 0, sw, fh, h * 0.006);
    box(seg, edge, sw / 2, -fh + fh * 0.04, 0, sw, fh * 0.08, h * 0.008);
    box(seg, edge, sw / 2, -fh * 0.02, 0, sw, fh * 0.05, h * 0.008);
    if (i === n - 1) for (let k = 0; k < 4; k++) cone(seg, edge, sw, -fh * (0.15 + k * 0.22), 0, fh * 0.05, sw * 0.5, 3).rotation.z = -Math.PI / 2;
    if (i === 1) ellip(seg, P.paper, sw * 0.9, -fh * 0.45, 0, sw * 0.75, sw * 0.75, h * 0.006);
    parent = seg;
  }
}

/** A foot soldier (lamellar coat in the side's colour) with spear or halberd and a shield; returns nothing. */
export function soldier(p: THREE.Object3D, x: number, z: number, h: number, color: string, o: { ry?: number; pose?: HumanPose; phase?: number; arm?: 'spear' | 'ji' | 'bow' | 'none'; shield?: boolean; detail?: HumanOpts['detail'] } = {}): void {
  const r = human(p, x, 0, z, {
    h, ry: o.ry ?? 0, pose: o.pose ?? 'stand', phase: o.phase ?? 0, top: color, bottom: '#3a3128', skin: '#d9a77c', hair: '#1c1714',
    hat: P.iron, hatStyle: 'helmet', shoes: '#2a2018', detail: o.detail ?? 'lo', build: 1.05,
  });
  const arm = o.arm ?? 'spear';
  const [hx, hy, hz] = r.handR;
  if (arm === 'spear' || arm === 'ji') {
    rod(p, [hx, hy - h * 0.35, hz], [hx, hy + h * 0.75, hz], h * 0.012, P.darkwood, 4);
    cone(p, '#a8adb3', hx, hy + h * 0.75, hz, h * 0.022, h * 0.1, 4);
    if (arm === 'ji') box(p, '#a8adb3', hx, hy + h * 0.68, hz + h * 0.03, h * 0.01, h * 0.02, h * 0.07);
    box(p, '#b91c1c', hx, hy + h * 0.72, hz, h * 0.02, h * 0.04, h * 0.02);
  } else if (arm === 'bow') {
    tube(p, [[hx, hy - h * 0.25, hz], [hx, hy, hz + h * 0.08], [hx, hy + h * 0.25, hz]], h * 0.01, h * 0.008, P.darkwood, { radial: 4, sub: 3 });
  }
  if (o.shield ?? true) {
    const [lx, ly, lz] = r.handL, ry = o.ry ?? 0;
    const sh = ellip(p, shade(color, 0.75), lx + Math.sin(ry) * h * 0.04, ly + h * 0.04, lz + Math.cos(ry) * h * 0.04, h * 0.1, h * 0.15, h * 0.02, ry);
    sh.rotation.y = ry;
    ellip(p, P.bronze, lx + Math.sin(ry) * h * 0.055, ly + h * 0.04, lz + Math.cos(ry) * h * 0.055, h * 0.03, h * 0.03, h * 0.012, ry);
  }
}

/** Horse and armoured rider. Built in a child group (faces +z) at (x, z) turned by ry. Returns the group. */
export function cavalry(p: THREE.Object3D, x: number, z: number, ry: number, coat: string, robe: string, o: { s?: number; lance?: boolean; flag?: string; hat?: HumanOpts['hatStyle'] } = {}): THREE.Group {
  const G = grp(p, x, z, ry);
  const s = o.s ?? 1;
  G.scale.setScalar(s);
  const seat = horse(G, coat, shade(coat, 0.45), { cloth: shade(robe, 0.85) });
  const h = 0.5;
  const r = human(G, 0, seat - h * 0.45, -0.02, {
    h, pose: 'sit', top: robe, bottom: '#3a3128', skin: '#d9a77c', hair: '#1c1714', hat: P.iron, hatStyle: o.hat ?? 'helmet', shoes: '#2a2018', detail: 'lo',
    feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.1, 0.42, 0.3], [0.12, 0.45, 0.25]],
  });
  for (const sx of [-1, 1]) box(G, P.darkwood, sx * 0.07, seat - 0.13, 0.03, 0.01, 0.02, 0.03);
  rod(G, r.handL, [0, seat + 0.05, 0.26], 0.002, '#2a1a10', 3);
  if (o.lance ?? true) {
    const [hx, hy, hz] = r.handR;
    rod(G, [hx, hy - 0.12, hz - 0.12], [hx, hy + 0.3, hz + 0.18], 0.004, P.darkwood, 4);
    cone(G, '#a8adb3', hx, hy + 0.3, hz + 0.18, 0.007, 0.035, 4).rotation.x = 0.62;
  }
  if (o.flag) banner(G, -0.05, seat - 0.05, -0.12, 0.42, o.flag, 0.11);
  return G;
}

function wheel(p: THREE.Object3D, x: number, y: number, z: number, R: number, c = P.darkwood, spokes = 12): void {
  const w = anim(p, 'spin', x, y, z, { axis: 'x', speed: 3 });
  const rim = add(w, g('rich:torus' + spokes, () => new THREE.TorusGeometry(1, 0.08, 5, 18)), mat(c), 0, 0, 0, R, R, R, Math.PI / 2);
  rim.rotation.set(0, Math.PI / 2, 0);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    rod(w, [0, 0, 0], [0, Math.cos(a) * R, Math.sin(a) * R], R * 0.04, c, 3);
  }
  cyl(w, P.bronze, 0, 0, 0, R * 0.18, R * 0.5, 8).rotation.z = Math.PI / 2;
}

function ground(p: THREE.Object3D, R: number, top: string, side = shade(top, 0.7), h = 0.03): number {
  lathe(p, [[0, 0], [R, 0], [R * 0.98, h * 0.8], [R * 0.95, h], [0, h]], side, 0, 0, 0, 40);
  lathe(p, [[0, h], [R * 0.95, h], [0, h + 0.002]], top, 0, 0, 0, 40);
  return h;
}

/** Stepped stone platform (须弥座) with balustrade; returns the top height. */
function terrace(p: THREE.Object3D, w: number, d: number, steps: number, h: number, c = P.white, rails = true): number {
  let y = 0;
  for (let i = 0; i < steps; i++) {
    const k = 1 - i * 0.12;
    rbox(p, i % 2 ? shade(c, 0.92) : c, 0, y, 0, w * k, h, d * k, 0.004);
    if (rails) {
      const W = w * k, D = d * k, n = Math.max(4, Math.round(W / 0.05));
      for (let j = 0; j <= n; j++) for (const sz of [-1, 1]) box(p, c, -W / 2 + (j / n) * W, y + h, sz * D / 2 * 0.98, 0.006, 0.022, 0.006);
      for (const sz of [-1, 1]) box(p, c, 0, y + h + 0.016, sz * D / 2 * 0.98, W, 0.004, 0.004);
    }
    y += h;
  }
  // front stair
  for (let i = 0; i < 6; i++) box(p, shade(c, 0.95), 0, (i / 6) * y, d / 2 + 0.06 - i * 0.012, w * 0.18, y / 6, 0.016);
  ellip(p, '#c9b98f', 0, y * 0.5, d / 2 + 0.035, w * 0.04, y * 0.4, 0.02, 0, -0.9);
  return y;
}

// ---- builders ----------------------------------------------------------------------------------------------
const army: Builder = (gp, r) => {
  const c = str(r.color, '#a8352a');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
    const x = -0.3 + j * 0.15 + (i % 2) * 0.04, z = 0.16 - i * 0.13;
    soldier(gp, x, z, 0.24, c, { pose: 'walk', phase: ((i + j) % 3) / 3, arm: i === 3 ? 'ji' : 'spear', shield: i < 2 });
  }
  cavalry(gp, 0.04, 0.34, 0, '#8a5a32', shade(c, 0.85), { s: 0.5, lance: false });
  banner(gp, -0.36, 0, 0.3, 0.62, c, 0.22);
  banner(gp, 0.38, 0, -0.32, 0.5, c, 0.17);
  // war drum
  cyl(gp, '#7f1d1d', 0.36, 0.09, 0.24, 0.05, 0.08, 14).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) rod(gp, [0.36 + sx * 0.04, 0, 0.24], [0.36 + sx * 0.02, 0.09, 0.24], 0.005, P.darkwood, 4);
};

const rider: Builder = (gp, r) => {
  cavalry(gp, 0, 0.02, 0, str(r.color, '#6b4426'), str(r.robe, '#a8352a'), { s: 1.0, flag: str(r.flag, '#a8352a') });
};

const warrior: Builder = (gp, r) => {
  const y = figureBase(gp, '#b8a888', '#6e5a40');
  // a terracotta-like rank: armoured kneeling archer + standing officer + horse
  const clay = str(r.color, '#a98c6c');
  const plate = shade(clay, 0.82);
  for (let i = 0; i < 3; i++) {
    const x = -0.24 + i * 0.24, z = -0.04 + (i === 1 ? 0.12 : 0), kneel = i === 2, h = 0.5;
    const rg = human(gp, x, y, z, { h, pose: kneel ? 'kneel' : 'stand', top: shade(clay, 1.02), bottom: shade(clay, 0.92), skin: shade(clay, 1.08), hair: shade(clay, 0.78), shoes: shade(clay, 0.85), dress: 'knee', build: 1.08, detail: 'hi' });
    // topknot, armour vest and rivets
    ellip(gp, shade(clay, 0.78), rg.head[0] + 0.012, rg.head[1] + h * 0.075, rg.head[2] - 0.01, 0.022, 0.018, 0.02);
    const cy = y + h * (kneel ? 0.5 : 0.66);
    rbox(gp, plate, x, cy, z + 0.004, h * 0.23, h * 0.15, h * 0.12, 0.012);
    for (let k = 0; k < 3; k++) box(gp, shade(clay, 0.7), x, cy - h * 0.05 + k * h * 0.05, z + 0.004 + h * 0.061, h * 0.21, 0.004, 0.003);
  }
  const H = grp(gp, -0.02, -0.3, Math.PI / 2, y);
  H.scale.setScalar(0.7);
  horse(H, shade(clay, 0.95), shade(clay, 0.75), { cloth: shade(clay, 0.88), saddle: shade(clay, 0.8) });
};

const chariot: Builder = (gp, r) => {
  const c = str(r.color, P.lacquer);
  // two-wheeled Shang/Zhou chariot pulled by a pair of horses
  const y = 0.11;
  for (const sx of [-1, 1]) wheel(gp, sx * 0.13, y, -0.12, 0.11, P.darkwood, 16);
  rod(gp, [-0.16, y, -0.12], [0.16, y, -0.12], 0.008, P.darkwood, 5);
  rbox(gp, c, 0, y + 0.01, -0.12, 0.2, 0.012, 0.14, 0.004);
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) box(gp, P.darkwood, sx * 0.1, y + 0.02, -0.18 + k * 0.03, 0.006, 0.07, 0.006);
  box(gp, P.darkwood, 0, y + 0.09, -0.12, 0.2, 0.006, 0.006).position.z = -0.05;
  tube(gp, [[0, y, -0.06], [0, y + 0.02, 0.12], [0, y + 0.1, 0.3]], 0.008, 0.006, P.darkwood, { radial: 5, sub: 4 });
  rod(gp, [-0.12, y + 0.1, 0.3], [0.12, y + 0.1, 0.3], 0.006, P.darkwood, 4);
  // canopy
  rod(gp, [0.04, y, -0.12], [0.04, y + 0.32, -0.12], 0.004, P.darkwood, 4);
  lathe(gp, [[0, 0.03], [0.1, 0], [0.11, -0.005], [0, 0.035]], tint(c, 0.1), 0.04, y + 0.32, -0.12, 14);
  for (const sx of [-1, 1]) {
    const H = grp(gp, sx * 0.07, 0.22, 0);
    H.scale.setScalar(0.62);
    horse(H, sx > 0 ? '#5a3a22' : '#7a5232', '#2a1a10', { cloth: c });
  }
  human(gp, -0.04, y + 0.01, -0.12, { h: 0.24, pose: 'stand', top: tint(c, -0.1), bottom: '#3a3128', hat: P.iron, hatStyle: 'helmet', detail: 'lo', hands: [[-0.1, 0.5, 0.25], [0.1, 0.5, 0.25]] });
  human(gp, 0.06, y + 0.01, -0.16, { h: 0.25, pose: 'stand', top: P.bronze, bottom: '#3a3128', hat: P.iron, hatStyle: 'helmet', detail: 'lo' });
  banner(gp, 0.1, y, -0.2, 0.42, c, 0.12);
};

const camel: Builder = (gp, r) => {
  const c = str(r.color, '#b48a5a'), d = tint(c, -0.22);
  const G = grp(gp, 0, 0, -Math.PI / 2);
  // Bactrian camel with silk bales (after pocket-planet's Silk Road camel); local +x is forward
  sweep(G, [{ p: [-0.24, 0.42, 0], w: 0.06, h: 0.07 }, { p: [-0.12, 0.43, 0], w: 0.11, h: 0.11 }, { p: [0.06, 0.43, 0], w: 0.12, h: 0.12 }, { p: [0.2, 0.42, 0], w: 0.08, h: 0.09 }], c, { radial: 12, sub: 4 });
  for (const hx of [-0.1, 0.08]) ellip(G, d, hx, 0.53, 0, 0.075, 0.09, 0.065);
  for (const sz of [-1, 1]) for (const lx of [-0.15, 0.14]) {
    tube(G, [[lx, 0.4, sz * 0.06], [lx + 0.015, 0.21, sz * 0.06], [lx, 0.02, sz * 0.06]], 0.045, 0.024, c, { radial: 6, sub: 3 });
    ellip(G, d, lx + 0.015, 0.21, sz * 0.06, 0.026, 0.026, 0.024);
    ellip(G, d, lx + 0.015, 0.012, sz * 0.06, 0.032, 0.012, 0.026);
  }
  tube(G, [[0.18, 0.44, 0], [0.28, 0.44, 0], [0.33, 0.56, 0], [0.35, 0.66, 0]], 0.06, 0.04, c, { radial: 8, sub: 4 });
  for (let i = 0; i < 4; i++) ellip(G, d, 0.24 + i * 0.03, 0.4 + i * 0.05, 0, 0.03, 0.04, 0.04);
  ellip(G, c, 0.39, 0.68, 0, 0.075, 0.042, 0.042, 0, 0, -0.2);
  ellip(G, tint(c, -0.12), 0.45, 0.66, 0, 0.03, 0.03, 0.034);
  for (const sz of [-1, 1]) { ellip(G, '#1f1a17', 0.4, 0.7, sz * 0.036, 0.01); ellip(G, c, 0.36, 0.72, sz * 0.03, 0.012, 0.02, 0.008); }
  tube(G, [[-0.23, 0.44, 0], [-0.27, 0.32, 0]], 0.012, 0.008, d, { radial: 4, sub: 2 });
  box(G, '#9b1c1c', -0.01, 0.5, 0, 0.09, 0.012, 0.25);
  for (const sz of [-1, 1]) {
    cyl(G, sz > 0 ? '#2f4f8a' : '#d6a840', 0, 0.38, sz * 0.14, 0.045, 0.14, 10).rotation.z = Math.PI / 2;
    box(G, '#7c5a3a', 0, 0.4, sz * 0.14, 0.012, 0.095, 0.095);
  }
  rod(G, [0.43, 0.66, 0], [0.5, 0.4, 0.16], 0.003, '#7c5a3a', 3);
  if (r.rider !== false) {
    human(G, -0.01, 0.52 - 0.42 * 0.45, 0, { h: 0.42, ry: Math.PI / 2, pose: 'sit', top: str(r.robe, '#5d4a7a'), bottom: '#3a3128', hat: '#e9dcc0', hatStyle: 'turban', detail: 'lo', feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]] });
  }
  // a walking driver in front
  human(G, 0.5, 0, 0.18, { h: 0.42, ry: Math.PI / 2, pose: 'walk', phase: 0.3, top: '#6b5a3e', bottom: '#4a3e2c', hat: '#3a3128', hatStyle: 'brim', detail: 'lo' });
};

const flag: Builder = (gp, r) => {
  const c = str(r.color, '#a8352a');
  ground(gp, 0.12, '#8a7a5a');
  for (let i = 0; i < 4; i++) box(gp, P.stone, Math.cos(i * 1.6) * 0.06, 0.03, Math.sin(i * 1.6) * 0.06, 0.05, 0.03, 0.04, i);
  banner(gp, 0, 0.03, 0, 0.9, c, 0.36);
};

const beacon: Builder = gp => {
  // 烽火台: tapered rammed-earth tower with crenellations, a brazier and rising smoke
  ground(gp, 0.36, '#9a8a62');
  const H = 0.46;
  skin(gp, [0, 1].map(t => { const R = 0.2 - t * 0.06; return [[-R, t * H, -R], [R, t * H, -R], [R, t * H, R], [-R, t * H, R]] as V3[]; }), P.rammed, {
    caps: true, flat: true, paint: (_x, y) => (Math.floor(y * 90) % 2 ? P.rammed : tint(P.rammed, -0.06)),
  });
  for (let i = 0; i < 4; i++) for (let k = -2; k <= 2; k++) {
    const a = (i * Math.PI) / 2, R = 0.14;
    box(gp, tint(P.rammed, -0.04), Math.cos(a) * R + -Math.sin(a) * k * 0.055, H + 0.03, Math.sin(a) * R + Math.cos(a) * k * 0.055, 0.03, 0.05, 0.03, a);
  }
  cyl(gp, P.iron, 0, H, 0, 0.06, 0.05, 10);
  const f = anim(gp, 'flicker', 0, H + 0.05, 0);
  add(f, g('rich:cone8', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)), mat('#f59e0b', { emissive: '#f97316' }), 0, 0, 0, 0.09, 0.16, 0.09);
  const sm = anim(gp, 'smoke', 0, H + 0.15, 0, { size: 0.05 });
  for (let i = 0; i < 6; i++) add(sm, g('rich:ico', () => new THREE.IcosahedronGeometry(1, 0)), mat('#5b5550', { transparent: 0.7 }), 0, 0, 0, 0.01, 0.01, 0.01);
  // ladder and a guard
  for (let k = 0; k < 8; k++) box(gp, P.darkwood, 0.15, 0.04 + k * 0.05, 0.19, 0.06, 0.006, 0.006);
  for (const sx of [-1, 1]) rod(gp, [0.15 + sx * 0.03, 0, 0.2], [0.15 + sx * 0.03, H, 0.16], 0.004, P.darkwood, 4);
  soldier(gp, -0.06, 0.06, 0.12, '#7f1d1d', { detail: 'lo' });
  gp.children[gp.children.length - 1].position.y = H;
};

const wall: Builder = gp => {
  // a stretch of the Ming Great Wall climbing a ridge with two watchtowers
  const N = 22, pts: V3[] = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([-0.46 + t * 0.92, 0.04 + Math.sin(t * Math.PI) * 0.14 + Math.sin(t * 9) * 0.015, Math.sin(t * 5) * 0.08]); }
  // ridge
  sweep(gp, pts.map(q => ({ p: [q[0], q[1] * 0.5, q[2]] as V3, w: 0.13, h: q[1] * 0.55 + 0.02 })), '#6f7d4a', { radial: 10, sub: 2, flat: true });
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = -Math.atan2(b[2] - a[2], b[0] - a[0]);
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const seg = grp(gp, m[0], m[2], ry, m[1]);
    box(seg, '#b5aa94', 0, -0.02, 0, len + 0.01, 0.1, 0.07);
    box(seg, '#a49880', 0, 0.08, 0, len + 0.01, 0.006, 0.07);
    for (const sz of [-1, 1]) for (let k = 0; k < 2; k++) box(seg, '#b5aa94', -len / 4 + k * len / 2, 0.095, sz * 0.032, len * 0.32, 0.03, 0.008);
  }
  for (const i of [4, 15]) {
    const [x, y, z] = pts[i];
    rbox(gp, '#c2b79f', x, y - 0.05, z, 0.13, 0.2, 0.13, 0.004);
    for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (let k = -1; k <= 1; k += 2) slab(grp(gp, x + sx * 0.066, z + sz * 0.066, Math.atan2(sx, sz), y + 0.03), [[-0.012, 0], [0.012, 0], [0.012, 0.03], [0, 0.04], [-0.012, 0.03]], 0.004, '#2a2420', 0, false).position.x = k * 0.03;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(gp, '#c2b79f', x + Math.cos(a) * 0.06, y + 0.17, z + Math.sin(a) * 0.06, 0.02, 0.025, 0.02, a); }
    if (i === 4) hall(gp, x, y + 0.15, z, 0.07, 0.06, 0.035, '#3f4248', 0, '#9a8e78', { col: '#7a5536', band: '#7a5536' });
  }
  banner(gp, pts[15][0], pts[15][1] + 0.15, pts[15][2], 0.22, '#a8352a', 0.08);
  for (let k = 0; k < 7; k++) minipine(gp, -0.4 + hash3(k, 1, 2) * 0.8, 0.02, 0.15 + hash3(k, 2, 2) * 0.2, 0.06);
};

const gate: Builder = (gp, r) => {
  // city gate: brick wall with three arched passages and a two-eaved gate tower (城楼)
  const c = str(r.color, P.vermilion);
  prism(gp, [[-0.46, -0.16], [0.46, -0.16], [0.44, 0.16], [-0.44, 0.16]], 0, 0.24, '#8c8478');
  for (let i = 0; i < 24; i++) box(gp, '#7d766b', -0.45 + i * 0.039, 0.24, 0.155, 0.022, 0.03, 0.01);
  for (const x of [-0.18, 0, 0.18]) {
    const w = x === 0 ? 0.1 : 0.07;
    slab(grp(gp, x, 0.162), [[-w / 2, 0], [w / 2, 0], [w / 2, w * 0.9], [0, w * 1.4], [-w / 2, w * 0.9]], 0.01, '#1f1a16', 0, false);
  }
  const y = 0.24;
  rbox(gp, P.white, 0, y, 0, 0.62, 0.025, 0.24, 0.003);
  const t1 = hall(gp, 0, y + 0.025, 0, 0.54, 0.18, 0.1, P.glaze, 0, c, { col: c, band: P.jade, rh: 0.05, ov: 1.45 });
  hall(gp, 0, t1 - 0.02, 0, 0.42, 0.12, 0.07, P.glaze, 0, c, { col: c, band: P.jade, rh: 0.07, ov: 1.5 });
  for (const sx of [-1, 1]) banner(gp, sx * 0.4, 0.24, 0.12, 0.22, '#a8352a', 0.07);
  for (const sx of [-1, 1]) soldier(gp, sx * 0.08, 0.24, 0.1, '#7f1d1d', { detail: 'lo', shield: false });
};

const palace: Builder = (gp, r) => {
  // Hall of Supreme Harmony–style main hall on a three-tier marble terrace with a double-eaved hip roof
  const roof = str(r.roof, P.glaze);
  const y = terrace(gp, 0.86, 0.6, 3, 0.04);
  const W = 0.6, D = 0.3;
  rbox(gp, '#c9c0ae', 0, y, -0.03, W + 0.04, 0.01, D + 0.04, 0.002);
  const t = hall(gp, 0, y + 0.01, -0.03, W, D, 0.12, roof, 0, P.vermilion, { col: P.vermilion, band: P.jade, rh: 0.045, ov: 1.25, lift: 0.4 });
  hall(gp, 0, t - 0.01, -0.03, W * 0.82, D * 0.72, 0.045, roof, 0, P.vermilion, { col: P.vermilion, band: P.jade, rh: 0.11, ov: 1.4, lift: 0.45 });
  // doors / lattice windows on the front
  for (let i = 0; i < 9; i++) box(gp, i % 2 ? '#7a2318' : '#c38b2c', -W / 2 + 0.03 + i * ((W - 0.06) / 8), y + 0.03, -0.03 + D / 2 + 0.002, 0.035, 0.08, 0.002);
  // bronze cauldrons, incense burners and guards
  for (const sx of [-1, 1]) {
    lathe(gp, [[0, 0], [0.025, 0], [0.03, 0.025], [0.022, 0.05], [0, 0.05]], P.bronze, sx * 0.3, y, 0.22, 10);
    soldier(gp, sx * 0.14, 0.38, 0.12, '#7f1d1d', { detail: 'lo', shield: false, arm: 'ji' });
    minipine(gp, sx * 0.4, 0.0, 0.38, 0.1);
  }
  ellip(gp, '#d4c8b0', 0, 0.001, 0.4, 0.12, 0.002, 0.08);
};

const pagoda: Builder = (gp, r) => {
  // octagonal brick-and-timber pagoda (e.g. 释迦塔) with nine eaves and a gourd finial
  ground(gp, 0.3, '#a99a7a');
  let y = terrace(gp, 0.42, 0.42, 1, 0.035, P.white, false) + 0.03;
  const wall = str(r.color, '#d9cdb4'), tile = str(r.roof, '#3f4248');
  for (let i = 0; i < 7; i++) {
    const R = 0.15 - i * 0.012, h = i === 0 ? 0.09 : 0.06;
    storey(gp, 0, y, 0, 8, R, h, P.vermilion, wall);
    y = proof(gp, 0, y + h, 0, { n: 8, R0: R * 1.5, R1: R * 0.9, h: 0.03, lift: 0.5, tile, rib: shade(tile, 1.3) }) - 0.005;
  }
  lathe(gp, [[0, 0], [0.04, 0], [0.02, 0.03], [0, 0.03]], P.bronze, 0, y, 0, 8);
  gourd(gp, 0, y + 0.03, 0, 0.03, P.gold);
  rod(gp, [0, y, 0], [0, y + 0.16, 0], 0.003, P.gold, 4);
  for (let k = 0; k < 5; k++) minipine(gp, Math.cos(k * 1.3 + 0.5) * 0.26, 0.03, Math.sin(k * 1.3 + 0.5) * 0.26, 0.08);
};

const temple: Builder = gp => {
  // Buddhist temple courtyard: gate, incense pavilion, main hall and a pair of pagodas
  ground(gp, 0.47, '#a99a7a');
  prism(gp, [[-0.42, -0.4], [0.42, -0.4], [0.42, 0.42], [-0.42, 0.42]], 0.03, 0.002, '#cbbf9e');
  for (const [x, z, w, d] of [[0, -0.41, 0.86, 0.02], [0, 0.42, 0.86, 0.02], [-0.42, 0, 0.02, 0.84], [0.42, 0, 0.02, 0.84]]) box(gp, '#a8352a', x, 0.03, z, w, 0.06, d);
  for (const [x, z, w, d] of [[0, -0.41, 0.88, 0.03], [0, 0.42, 0.88, 0.03], [-0.42, 0, 0.03, 0.86], [0.42, 0, 0.03, 0.86]]) box(gp, P.tile, x, 0.09, z, w, 0.012, d);
  const y = 0.03 + terrace(grp(gp, 0, -0.18, 0, 0.03), 0.42, 0.24, 2, 0.03, P.white, true);
  hall(gp, 0, y, -0.18, 0.34, 0.16, 0.1, '#3f4248', 0, P.vermilion, { col: P.vermilion, band: P.jade, rh: 0.08, lift: 0.5 });
  hall(gp, 0, 0.03, 0.4, 0.16, 0.08, 0.07, '#3f4248', 0, P.vermilion, { col: P.vermilion, band: P.jade, rh: 0.05 });
  lathe(gp, [[0, 0], [0.03, 0], [0.035, 0.03], [0.02, 0.06], [0.03, 0.08], [0, 0.1]], P.bronze, 0, 0.03, 0.1, 10);
  const sm = anim(gp, 'smoke', 0, 0.15, 0.1, { size: 0.02 });
  for (let i = 0; i < 5; i++) add(sm, g('rich:ico', () => new THREE.IcosahedronGeometry(1, 0)), mat('#d6d0c4', { transparent: 0.5 }), 0, 0, 0, 0.01, 0.01, 0.01);
  for (const sx of [-1, 1]) {
    let py = 0.03;
    for (let i = 0; i < 5; i++) {
      const R = 0.045 - i * 0.004;
      storey(gp, sx * 0.3, py, 0.12, 6, R, 0.04, P.vermilion, '#e2d8c0');
      py = proof(gp, sx * 0.3, py + 0.04, 0.12, { n: 6, R0: R * 1.6, R1: R, h: 0.015, lift: 0.5, tile: '#3f4248' });
    }
    gourd(gp, sx * 0.3, py, 0.12, 0.012, P.gold);
    minipine(gp, sx * 0.3, 0.03, -0.32, 0.09);
  }
  for (let i = 0; i < 4; i++) human(gp, -0.12 + i * 0.08, 0.03, 0.22 - (i % 2) * 0.05, { h: 0.08, pose: i === 1 ? 'pray' : 'walk', phase: i / 4, top: i % 2 ? '#c2410c' : '#e9dcc0', bottom: '#4a3e2c', hair: i % 2 ? null : '#1c1714', detail: 'min', dress: 'ankle' });
};

const bell: Builder = gp => {
  // bronze bianzhong chime set on a lacquered rack
  ground(gp, 0.4, '#8a7458');
  const W = 0.7, H = 0.5;
  for (const sx of [-1, 1]) box(gp, P.lacquer, sx * W / 2, 0.03, 0, 0.04, H, 0.06);
  for (const yy of [H * 0.55, H]) { box(gp, P.lacquer, 0, yy, 0, W + 0.08, 0.03, 0.05); box(gp, P.gold, 0, yy + 0.03, 0, W + 0.08, 0.004, 0.05); }
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 0.07 + i * ((W - 0.14) / 5), s = (row ? 0.05 : 0.07) * (1 - i * 0.07), top = row ? H * 0.55 : H;
    rod(gp, [x, top, 0], [x, top - 0.03, 0], 0.003, P.darkwood, 3);
    lathe(gp, [[0, 0], [s * 0.55, 0], [s * 0.8, -s * 0.9], [s, -s * 1.6], [s * 0.9, -s * 1.7], [0, -s * 1.5]], P.patina, x, top - 0.03, 0, 10);
  }
  human(gp, 0.1, 0.03, 0.2, { h: 0.3, pose: 'reach', top: '#3f5f7a', bottom: '#2a2a2a', hat: P.ink, hatStyle: 'cap', detail: 'lo', ry: Math.PI });
};

const ding: Builder = gp => {
  // 后母戊鼎: rectangular bronze cauldron with four legs and two handles, on a plinth
  rbox(gp, '#5a5048', 0, 0, 0, 0.6, 0.06, 0.5, 0.006);
  const y = 0.06, c = '#6f7d5a';
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tube(gp, [[sx * 0.17, y, sz * 0.12], [sx * 0.17, y + 0.08, sz * 0.12], [sx * 0.165, y + 0.16, sz * 0.12]], 0.025, 0.035, c, { radial: 8, sub: 3 });
  rbox(gp, c, 0, y + 0.15, 0, 0.42, 0.24, 0.32, 0.01);
  rbox(gp, tint(c, -0.15), 0, y + 0.38, 0, 0.44, 0.02, 0.34, 0.004);
  for (let i = 0; i < 6; i++) box(gp, tint(c, 0.15), -0.17 + i * 0.068, y + 0.3, 0.161, 0.04, 0.04, 0.004);
  for (const sz of [-1, 1]) box(gp, tint(c, 0.2), 0, y + 0.22, sz * 0.161, 0.1, 0.07, 0.004);
  for (const sx of [-1, 1]) {
    const hnd = add(gp, g('rich:handle', () => new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI)), mat(c), sx * 0.14, y + 0.4, 0, 1, 1.4, 1);
    hnd.rotation.y = Math.PI / 2;
  }
};

const scroll: Builder = (gp, r) => {
  // a scholar at a low desk unrolling a handscroll, with brush, inkstone and books
  const y = figureBase(gp, '#c9b58e', '#6e5a40');
  rbox(gp, P.lacquer, 0, y, 0.02, 0.5, 0.1, 0.22, 0.006);
  for (const sx of [-1, 1]) box(gp, P.lacquer, sx * 0.23, y, 0.02, 0.03, 0.1, 0.2);
  const ty = y + 0.1;
  box(gp, str(r.color, P.paper), 0.0, ty + 0.002, 0.04, 0.36, 0.004, 0.12);
  for (let k = 0; k < 7; k++) box(gp, P.ink, -0.14 + k * 0.045, ty + 0.005, 0.04, 0.004, 0.002, 0.09);
  for (const sx of [-1, 1]) { cyl(gp, P.darkwood, sx * 0.19, ty + 0.012, 0.04, 0.012, 0.14, 8).rotation.x = Math.PI / 2; }
  rbox(gp, '#2a2a2a', 0.2, ty, -0.05, 0.06, 0.012, 0.04, 0.003);
  for (let k = 0; k < 3; k++) rbox(gp, ['#3f5f7a', '#7a5536', '#5d4a7a'][k], -0.2, ty + k * 0.014, -0.05, 0.08, 0.014, 0.06, 0.002);
  figure(gp, { h: 0.5, x: 0, y, z: -0.17, top: str(r.robe, '#3f5f7a'), accent: P.gold, hair: '#1c1714', hairStyle: 'topknot', hat: 'scholar', hatColor: P.ink, beard: 'long', beardColor: '#2a2420', outfit: 'robe', wideSleeves: true, armR: { fwd: 1.1, bend: 0.5 }, armL: { fwd: 1.0, bend: 0.6 }, stance: 'kneel' });
};

const printing: Builder = gp => {
  // Bi Sheng's movable type: a type tray, iron forme, paper sheets and the printer
  const y = figureBase(gp, '#c9b58e', '#6e5a40');
  rbox(gp, P.wood, 0.0, y, 0.04, 0.52, 0.12, 0.26, 0.006);
  const ty = y + 0.12;
  box(gp, P.iron, -0.1, ty, 0.06, 0.2, 0.012, 0.14);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) box(gp, i % 3 ? '#c8b48a' : '#b49e72', -0.185 + i * 0.024, ty + 0.012, 0.012 + j * 0.024, 0.02, 0.012, 0.02);
  for (let k = 0; k < 4; k++) box(gp, P.paper, 0.13, ty + k * 0.004, 0.06, 0.16, 0.003, 0.12, k * 0.05);
  for (let k = 0; k < 6; k++) box(gp, P.ink, 0.08 + k * 0.02, ty + 0.017, 0.06, 0.006, 0.001, 0.09);
  // type cases
  for (const sx of [-1, 1]) {
    rbox(gp, P.darkwood, sx * 0.34, y, -0.2, 0.14, 0.3, 0.08, 0.004);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) box(gp, '#c8b48a', sx * 0.34 - 0.045 + j * 0.045, y + 0.04 + i * 0.07, -0.159, 0.035, 0.05, 0.002);
  }
  figure(gp, { h: 0.56, x: 0, y, z: -0.16, top: '#6b5a3e', accent: '#3a3128', hair: '#1c1714', hairStyle: 'topknot', hat: 'futou', hatColor: P.ink, beard: 'short', outfit: 'robe', armR: { fwd: 1.2, bend: 0.4 }, armL: { fwd: 1.0, bend: 0.5 }, stance: 'stand' });
};

const compass: Builder = gp => {
  // 司南: a lodestone spoon on a bronze diviner's board
  rbox(gp, P.lacquer, 0, 0, 0, 0.6, 0.06, 0.6, 0.01);
  rbox(gp, P.bronze, 0, 0.06, 0, 0.52, 0.02, 0.52, 0.004);
  lathe(gp, [[0, 0], [0.2, 0], [0.2, 0.012], [0, 0.012]], tint(P.bronze, 0.15), 0, 0.08, 0, 32);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; box(gp, P.ink, Math.cos(a) * 0.17, 0.093, Math.sin(a) * 0.17, 0.02, 0.002, 0.006, -a); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; box(gp, P.gold, Math.cos(a) * 0.23, 0.081, Math.sin(a) * 0.23, 0.03, 0.002, 0.012, -a); }
  const sp = anim(gp, 'spin', 0, 0.1, 0, { axis: 'y', speed: 0.3 });
  ellip(sp, '#2a2a2e', 0, 0.02, -0.03, 0.06, 0.03, 0.07);
  tube(sp, [[0, 0.02, 0.02], [0, 0.03, 0.12], [0, 0.035, 0.2]], 0.014, 0.008, '#2a2a2e', { radial: 6, sub: 3 });
};

const seismoscope: Builder = gp => {
  // 候风地动仪: domed bronze urn, eight dragons with balls over eight toads
  ground(gp, 0.42, '#8a7458');
  const c = P.patina;
  lathe(gp, [[0, 0], [0.2, 0], [0.24, 0.08], [0.25, 0.2], [0.22, 0.32], [0.16, 0.4], [0.08, 0.44], [0, 0.45]], c, 0, 0.03, 0, 24);
  lathe(gp, [[0.07, 0], [0.09, 0.03], [0.04, 0.07], [0, 0.08]], tint(c, -0.15), 0, 0.47, 0, 12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    tube(gp, [[ca * 0.2, 0.38, sa * 0.2], [ca * 0.27, 0.36, sa * 0.27], [ca * 0.3, 0.3, sa * 0.3], [ca * 0.31, 0.26, sa * 0.31]], 0.022, 0.012, tint(c, -0.1), { radial: 6, sub: 3 });
    ellip(gp, P.gold, ca * 0.315, 0.245, sa * 0.315, 0.014);
    ellip(gp, tint(c, -0.2), ca * 0.33, 0.06, sa * 0.33, 0.04, 0.035, 0.04);
    ellip(gp, '#1f2a24', ca * 0.33, 0.09, sa * 0.33, 0.016, 0.01, 0.016);
  }
};

const yurt: Builder = gp => {
  // Mongol ger encampment: two felt yurts, a cart and a horse
  ground(gp, 0.47, '#8a9a5a');
  const ger = (x: number, z: number, R: number) => {
    lathe(gp, [[0, 0], [R, 0], [R, R * 0.62], [R * 1.04, R * 0.66], [R * 0.2, R * 1.05], [0, R * 1.08]], '#ece6d8', x, 0.03, z, 18);
    for (const yy of [0.1, 0.42]) lathe(gp, [[R * 1.006, R * yy], [R * 1.006, R * (yy + 0.06)]], '#7a2318', x, 0.03, z, 18);
    box(gp, '#d6a840', x, 0.03, z + R * 0.98, R * 0.4, R * 0.5, 0.01);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rod(gp, [x + Math.cos(a) * R * 1.02, 0.03 + R * 0.66, z + Math.sin(a) * R * 1.02], [x + Math.cos(a) * R * 0.25, 0.03 + R * 1.04, z + Math.sin(a) * R * 0.25], 0.003, '#3f5f7a', 3); }
    cyl(gp, '#5b4636', x, 0.03 + R * 1.06, z, R * 0.2, R * 0.05, 10);
  };
  ger(-0.12, -0.08, 0.2);
  ger(0.22, -0.2, 0.13);
  const H = grp(gp, 0.25, 0.22, -0.7, 0.03);
  H.scale.setScalar(0.6);
  horse(H, '#8a6a42', '#2a1a10', { cloth: '#2f4f8a' });
  banner(gp, -0.36, 0.03, 0.2, 0.4, '#e9dcc0', 0.1);
  human(gp, 0.0, 0.03, 0.28, { h: 0.18, pose: 'walk', top: '#2f4f8a', bottom: '#3a3128', hat: '#7a2318', hatStyle: 'conical', detail: 'lo' });
};

const tent: Builder = (gp, r) => {
  // a field headquarters: command tent with banners and a guard
  const c = str(r.color, '#e9dcc0');
  ground(gp, 0.44, '#8a8a5a');
  const H = 0.26;
  skin(gp, [[[-0.2, 0, -0.16], [0.2, 0, -0.16], [0.2, 0, 0.16], [-0.2, 0, 0.16]], [[-0.2, 0.12, -0.16], [0.2, 0.12, -0.16], [0.2, 0.12, 0.16], [-0.2, 0.12, 0.16]], [[-0.12, H, 0], [0.12, H, 0], [0.12, H, 0.001], [-0.12, H, 0.001]]].map(ring => ring.map(([x, y, z]) => [x, y + 0.03, z] as V3)), c, { caps: true, flat: true });
  box(gp, '#7a2318', 0, 0.03, 0.161, 0.1, 0.1, 0.004);
  for (const sx of [-1, 1]) banner(gp, sx * 0.3, 0.03, 0.12, 0.42, sx > 0 ? '#a8352a' : '#2f4f8a', 0.12);
  soldier(gp, 0.12, 0.26, 0.16, '#7f1d1d', { shield: false, arm: 'ji' });
  // map table
  rbox(gp, P.darkwood, -0.16, 0.03, 0.3, 0.14, 0.05, 0.08, 0.003);
  box(gp, P.paper, -0.16, 0.08, 0.3, 0.12, 0.002, 0.07);
};

const hut: Builder = gp => {
  // Neolithic semi-subterranean round house (半坡) with thatched cone roof, pottery and fire
  ground(gp, 0.4, '#8a7a52');
  lathe(gp, [[0, 0], [0.22, 0], [0.22, 0.06], [0.2, 0.08], [0, 0.08]], '#9c7d58', 0, 0.03, 0, 18);
  const roof = lathe(gp, [[0.27, 0], [0.22, 0.06], [0.08, 0.28], [0, 0.34]], '#b89a5a', 0, 0.11, 0, 18);
  roof.material = mat('#b89a5a', { flat: true });
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; rod(gp, [Math.cos(a) * 0.27, 0.11, Math.sin(a) * 0.27], [Math.cos(a) * 0.02, 0.46, Math.sin(a) * 0.02], 0.004, '#8a6a3a', 3); }
  box(gp, '#3a2a1a', 0, 0.03, 0.2, 0.08, 0.12, 0.08);
  gable(gp, 0.1, 0.06, 0.12, '#b89a5a', 0, 0.15, 0.22);
  for (let i = 0; i < 3; i++) lathe(gp, [[0, 0], [0.02, 0.005], [0.03, 0.03], [0.015, 0.05], [0.017, 0.055]], i ? '#b0563a' : '#a0482e', 0.28 + i * 0.05, 0.03, 0.1 - i * 0.04, 10);
  const f = anim(gp, 'flicker', -0.25, 0.03, 0.22);
  add(f, g('rich:cone8', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)), mat('#f59e0b', { emissive: '#f97316' }), 0, 0, 0, 0.05, 0.08, 0.05);
  human(gp, -0.15, 0.03, 0.3, { h: 0.18, pose: 'crouch', top: '#8a6a42', bottom: '#8a6a42', hair: '#1c1714', detail: 'lo', sleeve: 0.4, ry: -2 });
};

// ---- ships ----------------------------------------------------------------------------------------------------
/** Zheng He's treasure ship (after pocket-planet's people-c), rotated so the bow faces +z. */
function treasureShip(p: THREE.Object3D, L: number, hullC = '#5b3a23', sailC = '#b5452b'): void {
  const G = grp(p, 0, 0, Math.PI / 2);
  const cx = 0, cy = 0.06, cz = 0;
  const W = L * 0.12, D = L * 0.085, n = 10;
  const sheer = (t: number) => D * (0.5 + 0.7 * Math.pow(Math.abs(2 * t - 1), 2.4) + (t > 0.5 ? 0.45 * (2 * t - 1) : 0));
  const rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = cx + (t - 0.5) * L, w = W * (0.6 + 0.4 * Math.sin(Math.PI * t)), s = sheer(t), d = D * (0.3 + 0.7 * Math.sin(Math.PI * t));
    rings.push([[x, cy + s, cz - w], [x, cy + s * 0.25, cz - w * 0.98], [x, cy - d * 0.6, cz - w * 0.72], [x, cy - d, cz], [x, cy - d * 0.6, cz + w * 0.72], [x, cy + s * 0.25, cz + w * 0.98], [x, cy + s, cz + w]]);
  }
  skin(G, rings, hullC, {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      const t = (x - cx) / L + 0.5, s = cy + sheer(Math.min(1, Math.max(0, t)));
      if (ny > 0.75) return '#b08254';
      if (y > s - D * 0.28) return '#a3321f';
      if (y > s - D * 0.42) return '#e0b44c';
      return Math.floor((y - cy) * 160) % 2 ? hullC : tint(hullC, -0.15);
    },
  });
  for (const sz of [-1, 1]) {
    const bx = cx - L * 0.43, by = cy + sheer(0.07) * 0.45;
    ellip(G, '#f5f0e1', bx, by, cz + sz * W * 0.62, 0.022 * L / 0.62, 0.014 * L / 0.62, 0.008);
    ellip(G, '#111827', bx + 0.004, by, cz + sz * W * 0.66, 0.009 * L / 0.62, 0.009 * L / 0.62, 0.006);
  }
  const sx = cx + L * 0.37, sy = cy + sheer(0.87);
  rbox(G, '#8a2e1e', sx, sy, cz, L * 0.16, 0.05 * L / 0.62, W * 1.6, 0.006);
  for (let i = 0; i < 5; i++) box(G, '#e0b44c', sx - L * 0.06 + i * L * 0.03, sy + 0.012, cz + W * 0.8, 0.008, 0.022, 0.004);
  gable(G, L * 0.19, 0.03 * L / 0.62, W * 1.9, '#3f3a36', sx, sy + 0.05 * L / 0.62, cz);
  rbox(G, '#8a2e1e', cx - L * 0.4, cy + sheer(0.1), cz, L * 0.1, 0.025, W * 1.4, 0.005);
  box(G, '#4d311e', cx + L * 0.5, cy - D * 0.6, cz, 0.012, D * 1.3, 0.008);
  const k = L / 0.62;
  const masts: [number, number, number][] = [[0.14, 0.2, 0.08], [0.3, 0.3, 0.11], [0.48, 0.36, 0.13], [0.65, 0.3, 0.11], [0.8, 0.22, 0.085]];
  masts.forEach(([t, h0, sw0], i) => {
    const h = h0 * k, sw = sw0 * k, mx = cx + (t - 0.5) * L, my = cy + sheer(t);
    rod(G, [mx, my, cz], [mx, my + h, cz], 0.0045 * k, '#3b2a1d', 5);
    const sail = anim(G, 'sway', mx, my + h * 0.12, cz, { amp: 0.04, speed: 1.2 });
    slab(sail, [[-sw * 0.62, 0], [sw * 0.38, 0], [sw * 0.42, h * 0.8], [-sw * 0.05, h * 0.86], [-sw * 0.58, h * 0.74]], 0.004, tint(sailC, (i % 2) * 0.06), 0, false).position.z = 0.006;
    for (let q = 1; q <= 5; q++) box(sail, '#4a2a1b', -sw * 0.1, (h * 0.78) * (q / 6), 0.006, sw * 0.98, 0.0035, 0.009);
    box(G, '#e0b44c', mx + 0.012, my + h - 0.02, cz, 0.024, 0.014, 0.003);
  });
}

function waves(p: THREE.Object3D, R: number): void {
  const m = lathe(p, [[0, 0], [R, 0], [R, 0.01], [0, 0.012]], P.water, 0, 0, 0, 32);
  m.material = mat(P.water, { rough: 0.25 });
  for (let i = 0; i < 14; i++) { const a = hash3(i, 1, 1) * Math.PI * 2, d = R * (0.5 + hash3(i, 2, 1) * 0.45); ellip(p, '#9cc3d0', Math.cos(a) * d, 0.012, Math.sin(a) * d, 0.04, 0.003, 0.008, a); }
}

const junk: Builder = (gp, r) => {
  const b = anim(gp, 'bob');
  treasureShip(b, 0.95, str(r.color, '#5b3a23'), str(r.sail, '#b5452b'));
};

const warship: Builder = (gp, r) => {
  // 楼船: a multi-storey war galley with oars, shields, crossbowmen and banners
  const b = anim(gp, 'bob');
  const c = str(r.color, '#5b3a23');
  const L = 0.9, W = 0.11;
  const rings: V3[][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, z = (t - 0.5) * L, w = W * (0.55 + 0.45 * Math.sin(Math.PI * t)), s = 0.08 + 0.04 * Math.pow(Math.abs(2 * t - 1), 2);
    rings.push([[-w, s, z], [-w * 0.95, 0.04, z], [-w * 0.6, 0.0, z], [0, -0.01, z], [w * 0.6, 0.0, z], [w * 0.95, 0.04, z], [w, s, z]]);
  }
  skin(b, rings, c, { caps: true, flat: true, paint: (_x, y, _z, _nx, ny) => (ny > 0.7 ? '#a07850' : y > 0.065 ? '#7a2318' : null) });
  let y = 0.09;
  for (let i = 0; i < 3; i++) {
    const w = 0.2 - i * 0.04, d = 0.56 - i * 0.14;
    rbox(b, i % 2 ? '#7a2318' : '#5b3a23', 0, y, -0.02, w, 0.06, d, 0.004);
    for (const sx of [-1, 1]) for (let k = 0; k < Math.round(d / 0.05); k++) ellip(b, k % 2 ? '#d6a840' : '#a8352a', sx * (w / 2 + 0.004), y + 0.035, -0.02 - d / 2 + 0.03 + k * 0.05, 0.003, 0.018, 0.016);
    y += 0.06;
    box(b, '#3f3a36', 0, y, -0.02, w + 0.03, 0.008, d + 0.03);
    y += 0.008;
  }
  hall(b, 0, y, -0.02, 0.08, 0.1, 0.05, '#3f4248', 0, '#7a2318', { rh: 0.03 });
  for (const sx of [-1, 1]) {
    const o = anim(b, 'sway', sx * 0.11, 0.05, 0, { amp: 0.35, speed: 2.4 });
    for (let k = 0; k < 9; k++) rod(o, [0, 0, -0.3 + k * 0.07], [sx * 0.12, -0.07, -0.3 + k * 0.07 - 0.02], 0.004, P.darkwood, 3);
  }
  banner(b, 0, y + 0.05, -0.02, 0.3, str(r.flag, '#a8352a'), 0.1);
  for (const z of [0.3, -0.3]) banner(b, 0, 0.08, z, 0.22, '#d6a840', 0.07);
  for (let k = 0; k < 4; k++) human(b, -0.06 + (k % 2) * 0.12, 0.15, 0.12 - (k >> 1) * 0.28, { h: 0.1, pose: 'stand', top: '#7f1d1d', bottom: '#3a3128', hat: P.iron, hatStyle: 'helmet', detail: 'min' });
};

const boat: Builder = (gp, r) => {
  // sampan / river barge with a woven-mat cabin, sculling oar and boatman
  const b = anim(gp, 'bob');
  const c = str(r.color, P.wood);
  const rings: V3[][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, z = (t - 0.5) * 0.8, w = 0.13 * (0.4 + 0.6 * Math.sin(Math.PI * t)), s = 0.07 + 0.06 * Math.pow(Math.abs(2 * t - 1), 2.5);
    rings.push([[-w, s, z], [-w * 0.9, 0.02, z], [0, 0, z], [w * 0.9, 0.02, z], [w, s, z]]);
  }
  skin(b, rings, c, { caps: true, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny > 0.7 ? tint(c, 0.25) : null) });
  // arched cabin
  const cab: V3[][] = [];
  for (let i = 0; i <= 6; i++) { const a = Math.PI * (i / 6); cab.push([[-Math.cos(a) * 0.1, 0.07 + Math.sin(a) * 0.11, -0.1], [-Math.cos(a) * 0.1, 0.07 + Math.sin(a) * 0.11, 0.12]]); }
  skin(b, [cab.map(q => q[0]), cab.map(q => q[1])], '#8a6a3a', { caps: false, flat: true, paint: (_x, _y, z) => (Math.floor(z * 60) % 2 ? '#8a6a3a' : '#6e5230') });
  const o = anim(b, 'sway', 0, 0.1, -0.36, { amp: 0.3, speed: 1.8 });
  rod(o, [0, 0, 0], [0.04, -0.12, -0.2], 0.005, P.darkwood, 4);
  human(b, 0, 0.07, -0.28, { h: 0.2, pose: 'row', ry: Math.PI, top: '#3f5f7a', bottom: '#3a3128', hat: '#c8a96a', hatStyle: 'conical', detail: 'lo' });
  for (let k = 0; k < 3; k++) rbox(b, ['#c8a96a', '#a07850', '#d6c49a'][k], -0.04 + k * 0.04, 0.07, 0.24, 0.05, 0.04, 0.05, 0.004);
};

const fireship: Builder = gp => {
  // 火船 at Red Cliffs: a fire raft loaded with reeds, burning
  const b = anim(gp, 'bob');
  for (let i = 0; i < 7; i++) cyl(b, i % 2 ? P.wood : P.darkwood, -0.18 + i * 0.06, 0.02, 0, 0.03, 0.7, 8).rotation.x = Math.PI / 2;
  for (let i = 0; i < 10; i++) cone(b, '#b89a5a', -0.12 + (i % 4) * 0.08, 0.05, -0.24 + Math.floor(i / 4) * 0.2, 0.06, 0.14, 6);
  for (let i = 0; i < 4; i++) {
    const f = anim(b, 'flicker', -0.1 + (i % 2) * 0.2, 0.12, -0.2 + i * 0.13);
    add(f, g('rich:cone8', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)), mat('#f59e0b', { emissive: '#f97316' }), 0, 0, 0, 0.12, 0.3, 0.12);
  }
  const sm = anim(b, 'smoke', 0, 0.35, 0, { size: 0.07 });
  for (let i = 0; i < 6; i++) add(sm, g('rich:ico', () => new THREE.IcosahedronGeometry(1, 0)), mat('#3a3430', { transparent: 0.7 }), 0, 0, 0, 0.01, 0.01, 0.01);
  rod(b, [0, 0.03, 0.15], [0, 0.45, 0.15], 0.006, P.darkwood, 4);
  const s = anim(b, 'sway', 0, 0.1, 0.15, { amp: 0.06 });
  slab(s, [[-0.14, 0], [0.14, 0], [0.12, 0.3], [-0.12, 0.3]], 0.004, '#b5452b', 0, false).rotation.y = Math.PI / 2;
};

const redboat: Builder = gp => {
  // the Red Boat on South Lake (嘉兴南湖红船)
  waves(gp, 0.46);
  const b = anim(gp, 'bob', 0, 0.01, 0);
  const rings: V3[][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, z = (t - 0.5) * 0.7, w = 0.11 * (0.45 + 0.55 * Math.sin(Math.PI * t)), s = 0.06 + 0.05 * Math.pow(Math.abs(2 * t - 1), 2.5);
    rings.push([[-w, s, z], [-w * 0.9, 0.02, z], [0, 0, z], [w * 0.9, 0.02, z], [w, s, z]]);
  }
  skin(b, rings, '#8a2e1e', { caps: true, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny > 0.7 ? '#a07850' : null) });
  rbox(b, '#a8352a', 0, 0.06, 0, 0.18, 0.1, 0.36, 0.004);
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) box(b, '#e9dcc0', sx * 0.091, 0.09, -0.14 + k * 0.07, 0.002, 0.04, 0.04);
  gable(b, 0.22, 0.06, 0.4, '#3f3a36', 0, 0.16, 0);
  for (const z of [-0.2, 0.2]) box(b, '#d6a840', 0, 0.06, z, 0.18, 0.02, 0.01);
};

const bridge: Builder = gp => {
  // 赵州桥: open-spandrel segmental stone arch over a stream
  ground(gp, 0.47, '#6f8a4a');
  const s = slab(grp(gp, 0, 0), [[-0.46, -0.04], [0.46, -0.04], [0.46, 0.04], [-0.46, 0.04]], 0.24, P.water, 0, false);
  s.rotation.x = -Math.PI / 2; s.position.y = 0.032;
  const st = '#bdb4a2', W = 0.12;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16, x = -0.4 + t * 0.8; pts.push([x, 0.03 + 0.14 * Math.sin(Math.PI * t) ** 0.7]); }
  const outline: [number, number][] = [[-0.46, 0.03], ...pts.map(([x, y]) => [x, y + 0.05] as [number, number]), [0.46, 0.03], [0.4, 0.03], ...pts.slice().reverse().map(([x, y]) => [x * 0.9, y - 0.005] as [number, number]).slice(1, -1), [-0.4, 0.03]];
  const deck = slab(gp, outline, W, st, 0, false);
  deck.position.y = 0;
  for (const sx of [-1, 1]) for (const xx of [0.25, 0.33]) {
    const sp = slab(grp(gp, sx * xx, 0.0, 0, 0.12), [[-0.025, 0], [0.025, 0], [0.025, 0.02], [0, 0.04], [-0.025, 0.02]], W + 0.004, '#3a3a36', 0, false);
    sp.position.z = 0;
  }
  for (const sz of [-1, 1]) for (let i = 0; i <= 16; i++) {
    const [x, y] = pts[i];
    box(gp, '#c9c0ae', x, y + 0.05, sz * W / 2, 0.012, 0.03, 0.012);
    if (i < 16) box(gp, '#c9c0ae', x + 0.025, y + 0.07, sz * W / 2, 0.05, 0.006, 0.008);
  }
  human(gp, 0.08, 0.2, 0, { h: 0.1, pose: 'walk', top: '#3f5f7a', bottom: '#3a3128', hat: '#c8a96a', hatStyle: 'conical', detail: 'lo', ry: Math.PI / 2 });
  for (let k = 0; k < 5; k++) minipine(gp, -0.35 + k * 0.17, 0.03, -0.3 + (k % 2) * 0.05, 0.07, '#4a7a3a');
};

const cannon: Builder = gp => {
  // a Qing coastal bronze cannon on a wheeled carriage behind a battlement
  ground(gp, 0.44, '#8a7a5a');
  for (let i = 0; i < 5; i++) box(gp, '#9a907e', -0.32 + i * 0.16, 0.03, 0.28, 0.12, 0.1, 0.08);
  const C = grp(gp, 0, 0.0, 0, 0.03);
  rbox(C, P.darkwood, 0, 0.04, -0.02, 0.14, 0.05, 0.3, 0.004);
  for (const sx of [-1, 1]) for (const z of [0.08, -0.1]) wheel(C, sx * 0.09, 0.05, z, 0.05, P.darkwood, 8);
  const barrel = tube(C, [[0, 0.11, -0.16], [0, 0.12, 0.05], [0, 0.135, 0.3]], 0.05, 0.03, P.bronze, { radial: 12, sub: 3 });
  barrel.material = mat(P.bronze, { metal: 0.6, rough: 0.35 });
  for (const z of [-0.08, 0.06, 0.2]) cyl(C, tint(P.bronze, -0.15), 0, 0.12 + z * 0.06, z, 0.045 - z * 0.04, 0.02, 12).rotation.x = Math.PI / 2;
  for (let k = 0; k < 4; k++) ellip(gp, '#2a2a2e', 0.26 + (k % 2) * 0.04, 0.05 + (k >> 1) * 0.04, -0.1, 0.022);
  human(gp, -0.2, 0.03, -0.18, { h: 0.24, pose: 'carry', top: '#2f4f8a', bottom: '#3a3128', hat: '#3a3128', hatStyle: 'cap', detail: 'lo' });
  const sm = anim(gp, 'smoke', 0, 0.2, 0.36, { size: 0.04 });
  for (let i = 0; i < 5; i++) add(sm, g('rich:ico', () => new THREE.IcosahedronGeometry(1, 0)), mat('#cfc8bc', { transparent: 0.6 }), 0, 0, 0, 0.01, 0.01, 0.01);
};

const trebuchet: Builder = (gp, r) => {
  // a traction trebuchet (砲): timber A-frames carry a pivoting throwing arm; a crew hauls the ropes, a stone waits in the sling
  const c = str(r.color, '#7a2318');
  ground(gp, 0.44, '#8a7a5a');
  const wd = P.darkwood, py = 0.46;
  rbox(gp, wd, 0, 0.03, 0, 0.36, 0.04, 0.42, 0.006);
  for (const sx of [-1, 1]) {
    rod(gp, [sx * 0.12, 0.07, -0.17], [sx * 0.07, py, 0], 0.014, wd, 5);
    rod(gp, [sx * 0.12, 0.07, 0.17], [sx * 0.07, py, 0], 0.014, wd, 5);
    rod(gp, [sx * 0.11, 0.2, -0.11], [sx * 0.11, 0.2, 0.11], 0.008, wd, 4);
  }
  rod(gp, [-0.1, py, 0], [0.1, py, 0], 0.016, P.iron, 6);
  // the arm: long end swung up behind, short end down in front where the crew pull
  const back: [number, number, number] = [0, py + 0.34, -0.36], front: [number, number, number] = [0, py - 0.12, 0.16];
  rod(gp, front, back, 0.016, tint(wd, 0.1), 6);
  for (const t of [0.25, 0.5, 0.75]) cyl(gp, c, 0, py + 0.22 * (t - 0.35), -0.52 * (t - 0.3), 0.02, 0.012, 8);
  rod(gp, back, [0, py + 0.12, -0.42], 0.003, '#c8b88a', 3);
  ellip(gp, '#8a8478', 0, py + 0.1, -0.42, 0.035);
  for (let k = 0; k < 4; k++) {
    const x = -0.15 + k * 0.1, z = 0.32 + (k % 2) * 0.04;
    rod(gp, front, [x, 0.2, z], 0.003, '#c8b88a', 3);
    human(gp, x, 0.03, z, { h: 0.2, pose: 'carry', top: k % 2 ? tint(c, -0.1) : '#6b5a3e', bottom: '#3a3128', hat: '#3a3128', hatStyle: 'cap', detail: 'lo', ry: Math.PI });
  }
  for (let k = 0; k < 3; k++) ellip(gp, '#8a8478', 0.24 + (k % 2) * 0.05, 0.06, 0.05 + k * 0.05, 0.035);
  banner(gp, -0.3, 0.03, -0.25, 0.4, c, 0.1);
};

const monument: Builder = (gp, r) => {
  // a memorial: stele tower on a two-tier granite platform (Monument to the People's Heroes style)
  const c = str(r.color, '#d8d2c4');
  const y = terrace(gp, 0.8, 0.6, 2, 0.05, '#cfc8b8');
  rbox(gp, shade(c, 0.95), 0, y, 0, 0.26, 0.08, 0.2, 0.004);
  for (let i = 0; i < 6; i++) box(gp, shade(c, 0.8), -0.1 + i * 0.04, y + 0.02, 0.101, 0.028, 0.04, 0.003);
  tbox(gp, 0.14, 0.1, 0.11, 0.08, 0.5, c, 0, y + 0.08, 0);
  box(gp, P.gold, 0, y + 0.25, 0.041, 0.04, 0.18, 0.004);
  proof(gp, 0, y + 0.58, 0, { n: 4, R0: 0.1, R1: 0.03, h: 0.05, lift: 0.1, tile: shade(c, 0.85) });
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) minipine(gp, sx * (0.32 + k * 0.03), 0.0, -0.25 + k * 0.2, 0.1);
  for (let k = 0; k < 3; k++) human(gp, -0.15 + k * 0.15, y, 0.24, { h: 0.12, pose: 'stand', top: ['#2f4f8a', '#4a5a3a', '#6b5a3e'][k], bottom: '#2a2a2a', detail: 'min', ry: Math.PI });
};

const statue: Builder = (gp, r) => {
  // a seated sage statue on a plinth
  const y = terrace(gp, 0.5, 0.5, 2, 0.06, '#bdb4a2', false);
  figure(gp, { h: 0.6, x: 0, y, z: 0, top: str(r.color, '#8a7a5a'), bottom: str(r.color, '#8a7a5a'), skin: tint(str(r.color, '#8a7a5a'), 0.1), hair: tint(str(r.color, '#8a7a5a'), -0.2), hairStyle: 'topknot', beard: 'long', beardColor: tint(str(r.color, '#8a7a5a'), -0.2), outfit: 'robe', wideSleeves: true, hat: 'scholar', hatColor: tint(str(r.color, '#8a7a5a'), -0.2), armL: { fwd: 0.6, bend: 1.4, inward: 0.5 }, armR: { fwd: 0.6, bend: 1.4, inward: 0.5 } });
};

export const RICH: Record<string, Builder> = {
  army, rider, warrior, chariot, camel, flag, beacon, wall, gate, palace, pagoda, temple, bell, ding, scroll, printing, compass, seismoscope,
  yurt, tent, hut, junk, warship, boat, fireship, redboat, bridge, cannon, trebuchet, monument, statue,
};

/**
 * A generic historical person for a person card, dressed for their role and period (`r.year`): 冕服 for early
 * emperors, 圆领袍 and 幞头 for Tang/Song officials, 乌纱帽 with a rank badge in the Ming, 马褂 and queue in the Qing …
 */
export function personModel(gp: THREE.Group, r: ModelRecipe): void {
  const role = str(r.role, 'scholar') as PersonRole;
  const era = eraOf(typeof r.year === 'number' ? r.year : 1000);
  const y = figureBase(gp, '#c9b58e', '#6e5a40');
  const look = costume(role, era);
  const common = { h: 0.62, x: 0, y, z: 0, hair: '#1c1714', beardColor: '#2a2420', accent: P.gold, ...look, top: str(r.color, look.top) };
  const modern = era === 'minguo' || era === 'modern';
  if (role === 'ruler') figure(gp, { ...common, armL: { fwd: 0.5, bend: 1.2, inward: 0.4 }, armR: { fwd: 0.5, bend: 1.2, inward: 0.4 } });
  else if (role === 'general') {
    const a = figure(gp, { ...common, armR: { fwd: 0.3, side: 0.2, bend: 0.3 } });
    const [hx, hy, hz] = a.handR;
    if (!modern) {
      rod(gp, [hx, hy - 0.25, hz], [hx, hy + 0.35, hz], 0.006, P.darkwood, 4);
      cone(gp, '#a8adb3', hx, hy + 0.35, hz, 0.012, 0.06, 4);
      if (era === 'xianqin' || era === 'qinhan') box(gp, '#a8adb3', hx, hy + 0.3, hz + 0.018, 0.004, 0.012, 0.03); // 戟 blade
      else box(gp, '#b91c1c', hx, hy + 0.3, hz, 0.014, 0.028, 0.014); // red tassel under the spearhead
    }
  } else if (role === 'monk') figure(gp, { ...common, armL: { fwd: 0.9, bend: 1.3, inward: 0.8 }, armR: { fwd: 0.9, bend: 1.3, inward: 0.8 } });
  else if (role === 'woman') figure(gp, { ...common, armL: { fwd: 0.4, bend: 0.8 }, armR: { fwd: 0.4, bend: 0.8 } });
  else {
    const a = figure(gp, { ...common, armR: { fwd: 0.8, bend: 1.0 }, armL: { fwd: 0.2, bend: 0.3 } });
    if (modern) box(gp, '#f1ece0', a.handR[0], a.handR[1], a.handR[2] + 0.01, 0.05, 0.065, 0.012); // a book
    else if (era === 'ming' || era === 'qing') box(gp, '#e8dcc0', a.handR[0], a.handR[1], a.handR[2] + 0.01, 0.022, 0.1, 0.006); // 笏 tablet
    else cyl(gp, P.paper, a.handR[0], a.handR[1], a.handR[2] + 0.01, 0.012, 0.12, 8).rotation.z = Math.PI / 2;
  }
}
