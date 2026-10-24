import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import {
  type Builder, type V3, mat, box, tbox, cyl, cone, rbox, rod, skin, slab, lathe, gable, tube, shade, hash3, sweep, add, g,
} from './prims.ts';
import { human, type HumanOpts, type HumanPose } from './human.ts';
import { figure, figureBase, headwear, type Hat } from './figure.ts';
import { costume } from './costume.ts';
import { eraOf } from '../../shared/data/era.ts';
import type { PersonRole } from '../../shared/data/heroes.ts';
import { horse } from './animals.ts';
import { grp, proof, storey, hall, gourd, minipine } from './timber.ts';
import { RICH2 } from './rich2.ts';
import { slab as holed } from './lite.ts';

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
  cyl(w, P.bronze, 0, -R * 0.25, 0, R * 0.18, R * 0.5, 8).rotation.z = Math.PI / 2;
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
  // the carved 丹陛 slab dividing the stair
  const ramp = Math.hypot(y, 0.072);
  box(p, shade(c, 0.9), 0, y / 2 - ramp / 2, d / 2 + 0.024, w * 0.07, ramp, 0.006, 0, Math.atan2(0.072, y));
  return y;
}

// ---- architecture (realism pass) ------------------------------------------------------------------------------
type RoofKind = 'hip' | 'xieshan' | 'gable' | 'pyramid';
interface RoofOpts { kind?: RoofKind; ov?: number; lift?: number; ridge?: string; gableC?: string; under?: string; ry?: number; beasts?: boolean; plain?: boolean }
/**
 * Concave Chinese roof over a w×d plan: 庑殿 'hip', 歇山 'xieshan' (hip skirt below a gable with a 山花 pediment), 悬山
 * 'gable' or 攒尖 'pyramid'. Tile channels, upturned eave corners and a main ridge with 鸱吻 end ornaments. Returns the
 * ridge top.
 */
function roof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, tile: string, o: RoofOpts = {}): number {
  const G = grp(p, x, z, o.ry ?? 0, y);
  const kind = o.kind ?? 'hip', ov = o.ov ?? Math.min(w, d) * 0.22, lift = o.lift ?? 0.4;
  const A = w / 2 + ov, B = d / 2 + ov;
  const rA = kind === 'pyramid' ? 0 : kind === 'gable' ? A : kind === 'xieshan' ? Math.max(A - B * 0.6, A * 0.42) : Math.max(A - B, A * 0.3);
  const S = Math.max(8, Math.min(32, Math.round((2 * A) / 0.022))), Sd = Math.max(4, Math.round((S * B) / A));
  const T = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1];
  const ya = (t: number) => h * Math.pow(t, 1.45);
  const aAt = (t: number) => (kind === 'xieshan' ? A - (A - rA) * Math.min(1, t / 0.42) : kind === 'pyramid' ? A * (1 - t) : kind === 'gable' ? A : A - (A - rA) * t);
  const bAt = (t: number) => B * (1 - t);
  const reach = B * 0.85;
  const ring = (t: number, dy: number): V3[] => {
    const a = Math.max(aAt(t), 1e-4), b = Math.max(bAt(t), 1e-4), out: V3[] = [];
    const sides: [number, number, number, number, number][] = [[-a, b, a, b, S], [a, b, a, -b, Sd], [a, -b, -a, -b, S], [-a, -b, -a, b, Sd]];
    for (const [x0, z0, x1, z1, n] of sides) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let i = 0; i < n; i++) {
        const u = i / n, px = x0 + (x1 - x0) * u, pz = z0 + (z1 - z0) * u;
        const dc = Math.min(u, 1 - u) * len;
        const gableEnd = (kind === 'gable' || (kind === 'xieshan' && t > 0.42)) && n === Sd;
        const c = gableEnd ? 0 : Math.max(0, 1 - dc / reach) ** 2 * (1 - t) ** 1.6;
        const k = 1 + c * lift * 0.12;
        out.push([px * k, ya(t) + dy + c * lift * B * 0.3, pz * k]);
      }
    }
    return out;
  };
  const th = Math.max(0.006, B * 0.06);
  const rings = [ring(0, -th), ...T.map(t => ring(t, 0))];
  const under = o.under ?? '#3a2a20', gableC = o.gableC ?? '#8a2e22', dark = shade(tile, 0.72), rib = shade(tile, 1.16);
  skin(G, rings, tile, {
    caps: true, flat: true,
    paint: (px, py, pz, nx, ny, nz) => {
      if (ny < -0.3) return under;
      if (Math.abs(ny) < 0.3) return (kind === 'xieshan' || kind === 'gable') && Math.abs(nx) > 0.8 && py > h * 0.3 ? gableC : dark;
      const t = Math.min(1, Math.max(0, py / h)) ** (1 / 1.45);
      if (Math.abs(nz) >= Math.abs(nx)) return Math.floor(((px / Math.max(aAt(t), 1e-3) + 1) / 2) * S) % 2 ? rib : tile;
      return Math.floor(((pz / Math.max(bAt(t), 1e-3) + 1) / 2) * Sd) % 2 ? rib : tile;
    },
  });
  const ridge = o.ridge ?? shade(tile, 0.85), rh = Math.max(0.008, h * 0.09);
  if (kind === 'pyramid') {
    lathe(G, [[0, 0], [rh * 0.9, 0], [rh * 0.7, rh * 1.2], [rh * 1.1, rh * 1.6], [0, rh * 2.6]], o.ridge ?? P.gold, 0, h - rh * 0.3, 0, 10);
    return y + h + rh * 2.3;
  }
  box(G, ridge, 0, h - rh * 0.4, 0, rA * 2 + rh, rh, Math.max(0.006, rh * 0.8));
  if (!o.plain) for (const s of [-1, 1]) {
    // 鸱吻: tall curled ridge-end beast with its tail rolled inward
    slab(grp(G, s * (rA + rh * 0.2), 0, s > 0 ? 0 : Math.PI, h - rh * 0.5), [[-rh * 0.9, 0], [rh * 0.6, 0], [rh * 0.7, rh * 1.6], [rh * 0.1, rh * 2.6], [-rh * 0.5, rh * 2.3], [-rh * 0.2, rh * 1.6], [-rh * 0.9, rh * 1.1]], Math.max(0.006, rh * 0.7), ridge, 0, true);
  }
  if (kind !== 'gable') {
    // hip ridges (垂脊/戗脊) running down to the upturned corners, with a file of small ridge beasts on yellow roofs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const t0 = kind === 'xieshan' ? 0.42 : 1;
      const top: V3 = [sx * aAt(t0), ya(t0) + rh * 0.3, sz * bAt(t0)], bot: V3 = [sx * A * (1 + lift * 0.12), lift * B * 0.3 + rh * 0.3, sz * B * (1 + lift * 0.12)];
      rod(G, top, bot, Math.max(0.0035, rh * 0.35), ridge, 4);
      if (o.beasts) for (let k = 1; k <= 3; k++) {
        const f = 0.62 + k * 0.08;
        ellip(G, ridge, top[0] + (bot[0] - top[0]) * f, top[1] + (bot[1] - top[1]) * f + rh * 0.45, top[2] + (bot[2] - top[2]) * f, rh * 0.35);
      }
    }
  }
  return y + h + rh * 0.6;
}

/**
 * Timber hall body on a podium: `nb` front bays of red columns (柱) on stone bases, lattice doors (隔扇) in the
 * central bays and windows to the sides, a blue-green painted architrave (额枋) and a row of bracket sets (斗拱).
 * Returns the eave height.
 */
function hallBody(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, nb: number, o: { col?: string; wall?: string; door?: string; beam?: string; bracket?: boolean; ry?: number; open?: boolean } = {}): number {
  const G = grp(p, x, z, o.ry ?? 0, y);
  const col = o.col ?? P.vermilion, wall = o.wall ?? '#9a3326', door = o.door ?? '#8a3a22', beam = o.beam ?? '#2f6f6a';
  const cr = Math.max(0.0035, Math.min(0.012, (w / nb) * 0.09));
  // walls set back half a bay behind the front colonnade (廊)
  const inset = Math.min(d * 0.18, (w / nb) * 0.5);
  box(G, wall, 0, 0, -inset / 2, w - cr * 2, h, d - inset);
  for (let i = 0; i <= nb; i++) {
    const cx = -w / 2 + (i / nb) * w;
    for (const cz of [d / 2 - cr, -d / 2 + cr]) {
      cyl(G, '#c9c2b2', cx, 0, cz, cr * 1.5, cr * 0.8, 8);
      cyl(G, col, cx, 0, cz, cr, h, 8);
    }
  }
  if (!o.open) for (let i = 0; i < nb; i++) {
    const cx = -w / 2 + ((i + 0.5) / nb) * w, bw = (w / nb) * 0.86, centre = Math.abs(i - (nb - 1) / 2) <= Math.max(0, (nb - 5) / 2) + 1;
    const fz = d / 2 - inset + 0.0015;
    const dh = centre ? h * 0.84 : h * 0.5, dy = centre ? 0 : h * 0.3;
    box(G, door, cx, dy, fz, bw, dh, 0.004);
    // lattice: vertical mullions over the leaves and a lighter panel band
    for (let k = 1; k < 4; k++) box(G, shade(door, 0.7), cx - bw / 2 + (k / 4) * bw, dy, fz + 0.002, Math.max(0.003, bw * 0.04), dh, 0.003);
    box(G, shade(door, 1.25), cx, dy + dh * 0.62, fz + 0.003, bw * 0.96, Math.max(0.004, dh * 0.08), 0.003);
  }
  const bh = Math.max(0.006, h * 0.12);
  box(G, beam, 0, h - bh, 0, w + cr * 2, bh, d + cr * 0.4);
  box(G, '#c9a24a', 0, h - bh * 0.55, d / 2 + cr * 0.25, w, Math.max(0.003, bh * 0.15), 0.003);
  if (o.bracket ?? true) {
    const n = Math.max(nb * 2, Math.round(w / 0.03));
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) box(G, i % 2 ? beam : shade(beam, 0.75), -w / 2 + (i / n) * w, h, s * (d / 2 + cr * 0.2), Math.max(0.006, (w / n) * 0.5), Math.max(0.006, h * 0.08), Math.max(0.006, cr * 2));
  }
  return y + h + Math.max(0.006, h * 0.08);
}

/** Bronze metal material (dark green patina with a little lustre) applied to a mesh. */
const bronze = (m: THREE.Mesh, c = '#5a6b55') => { m.material = mat(c, { metal: 0.55, rough: 0.5 }); return m; };

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
  // A mounted warrior facing +z (fx carries it at the head of a route as the general). Default: a Tang–Song armoured
  // cavalryman (cf. the 昭陵 / 敦煌 murals and Song 武经总要) — iron lamellar 札甲 over a coat in the side's colour, helmet
  // with neck flaps, a long 马槊 lance with a red horsehair tassel and a swallow-tailed pennant, bow case (弓韬) and
  // quiver (胡禄) slung from a high-pommelled saddle with stirrups and a leather 障泥. r.style 'heavy': 南北朝 甲骑具装 — the
  // horse in lamellar barding too (Northern Wei, Jin 铁浮屠); 'nomad': a steppe horse archer (Xiongnu–Mongol) in a fur hat
  // and belted robe on a small stocky horse, composite bow in hand; 'qing': a Qing bannerman in studded 棉甲 and a
  // spiked helmet with bow and quiver. r.color: the side's colour.
  const style = str(r.style, ''), team = str(r.color, style === 'nomad' ? '#3e4a6a' : '#a8352a');
  const nomad = style === 'nomad', qing = style === 'qing', heavy = style === 'heavy';
  const iron = '#5d5f62', leather = '#4a3020';
  const k = nomad ? 0.88 : 1;
  const M = grp(gp, 0, 0, 0);
  M.scale.setScalar(k);
  const coat = str(r.coat, nomad ? '#8a7258' : qing ? '#e6e0d4' : '#5a3a24');
  const top = horse(M, coat, nomad ? '#3a2e24' : '#1c1410', { cloth: leather, saddle: '#3a2216' }) - 0.01;
  // high pommel and cantle of the saddle, stirrups on leathers
  for (const [z, hh] of [[0.065, 0.022], [-0.065, 0.026]] as const) rbox(M, '#5a3420', 0, top - 0.005, z, 0.045, hh, 0.01, 0.003);
  for (const sx of [-1, 1]) {
    rod(M, [sx * 0.07, top + 0.005, 0.0], [sx * 0.105, top - 0.17, 0.03], 0.0025, '#2a1a10', 3);
    add(M, g('rich:stirrup', () => new THREE.TorusGeometry(1, 0.22, 4, 8)), mat('#3a3a3a', { metal: 0.5 }), sx * 0.105, top - 0.18, 0.03, 0.016, 0.014, 0.016, Math.PI / 2);
  }
  // breast strap and crupper with red tassels (Tang 杏叶 pendants)
  rod(M, [-0.08, top - 0.05, 0.05], [0, top - 0.11, 0.22], 0.004, leather, 3);
  rod(M, [0.08, top - 0.05, 0.05], [0, top - 0.11, 0.22], 0.004, leather, 3);
  rod(M, [-0.075, top - 0.04, -0.07], [-0.07, top - 0.08, -0.22], 0.004, leather, 3);
  rod(M, [0.075, top - 0.04, -0.07], [0.07, top - 0.08, -0.22], 0.004, leather, 3);
  if (!nomad) for (const [x, y, z] of [[-0.06, top - 0.09, 0.15], [0.06, top - 0.09, 0.15], [-0.075, top - 0.07, -0.16], [0.075, top - 0.07, -0.16]] as const) {
    cone(M, '#b02a22', x, y - 0.025, z, 0.008, 0.025, 5).rotation.x = Math.PI;
  }
  if (heavy) {
    // 具装: lamellar barding — a skirt over the barrel and quarters (身甲, 搭后) and a chest guard (当胸)
    for (const sx of [-1, 1]) {
      const rings: V3[][] = [];
      for (let i = 0; i <= 18; i++) {
        const z = -0.23 + (i / 18) * 0.43, bulge = Math.sin((i / 18) * Math.PI) * 0.012;
        const prof: V3[] = [];
        for (let j = 0; j <= 10; j++) {
          const a = (j / 10) * (Math.PI / 2), sa = Math.sin(a), ca = Math.cos(a);
          prof.push([sx * sa * (0.105 + bulge + (1 - ca) * 0.02), top - 0.01 - (1 - ca) * 0.17, z]);
        }
        rings.push(prof);
      }
      skin(M, rings, shade(iron, 0.9), {
        closed: false, flat: true,
        paint: (_x, y, z) => (Math.floor((top - y) * 45) % 2 ? (Math.floor(z * 45) % 2 ? shade(iron, 0.85) : iron) : (Math.floor(z * 45 + 0.5) % 2 ? shade(iron, 0.7) : shade(iron, 0.8))),
      });
    }
    for (const sx of [-1, 1]) box(M, team, sx * 0.123, top - 0.19, -0.02, 0.004, 0.012, 0.42);
    skin(M, [0, 1, 2, 3, 4].map(i => {
      const y = top - 0.04 - i * 0.04, w = 0.07 + i * 0.006;
      return [-1, -0.5, 0, 0.5, 1].map(u => [u * w, y, 0.2 + (1 - u * u) * 0.04] as V3);
    }), shade(iron, 0.8), { closed: false, flat: true });
  }
  // the rider
  const h = 0.5 * k, seat = top * k + 0.01;
  const hands: [V3, V3] = nomad || qing ? [[-0.16, 0.55, 0.36], [0.12, 0.47, 0.22]] : [[-0.1, 0.42, 0.3], [0.13, 0.5, 0.18]];
  const R = human(gp, 0, seat - h * 0.45, -0.02 * k, {
    h, pose: 'sit', top: nomad ? team : qing ? shade(team, 0.85) : team, bottom: nomad ? '#4a3a2a' : '#3a3128', skin: '#c99872', hair: '#1c1714',
    hat: nomad ? '#4a3524' : qing ? '#3a3a3a' : iron, hatStyle: nomad ? 'fur' : qing ? 'plume' : 'helmet', shoes: '#2a2018',
    armor: nomad ? undefined : qing ? team : iron, armorTrim: nomad ? undefined : qing ? '#d6b04a' : shade(team, 0.8),
    detail: 'lo', build: 1.08, feet: [[-0.21, 0.04, 0.1], [0.21, 0.04, 0.1]], hands,
  });
  rod(gp, R.handL, [0, top * k + 0.06, 0.28 * k], 0.002, '#2a1a10', 3);
  if (nomad || qing) {
    // composite recurved bow held up in the left hand, quiver on the right hip
    const [lx, ly, lz] = R.handL, bh = 0.13;
    tube(gp, [[lx, ly - bh, lz - 0.01], [lx - 0.005, ly - bh * 0.55, lz + 0.03], [lx, ly, lz + 0.035], [lx - 0.005, ly + bh * 0.55, lz + 0.03], [lx, ly + bh, lz - 0.01]], 0.004, 0.003, '#5a3a1e', { radial: 4, sub: 3 });
    rod(gp, [lx, ly - bh, lz - 0.01], [lx, ly + bh, lz - 0.01], 0.0008, '#e8e0cc', 3);
    rbox(gp, nomad ? '#6a4a2a' : '#3a2a1e', 0.085, seat - 0.05, -0.04, 0.022, 0.1, 0.034, 0.006).rotation.x = -0.3;
    for (let a = 0; a < 4; a++) rod(gp, [0.08 + a * 0.004, seat + 0.05, -0.07], [0.08 + a * 0.004, seat + 0.09, -0.085], 0.002, '#d8d0c0', 3);
  } else {
    // 马槊: long lance, leaf blade, red horsehair tassel and a swallow-tailed pennant in the side's colour
    const [hx, hy, hz] = R.handR;
    const a: V3 = [hx + 0.01, hy - 0.2, hz - 0.3], b: V3 = [hx - 0.01, hy + 0.36, hz + 0.32];
    rod(gp, a, b, 0.0045, '#5a3a22', 5);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const tip = cone(gp, '#b8bcc2', b[0], b[1], b[2], 0.008, 0.06, 4);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    for (let q = 0; q < 5; q++) ellip(gp, '#b02a22', b[0] + Math.cos(q * 1.3) * 0.008, b[1] - 0.012 - (q % 2) * 0.006, b[2] + Math.sin(q * 1.3) * 0.008, 0.008, 0.012, 0.008);
    const F = anim(gp, 'flap', b[0], b[1] - 0.03, b[2] - 0.03, { amp: 0.35 });
    F.rotation.y = Math.PI / 2;
    slab(F, [[0, 0], [0.14, -0.012], [0.11, -0.03], [0.14, -0.05], [0, -0.06]], 0.003, team, 0, false);
    // bow case on the left, quiver on the right
    rbox(M, '#4a2a18', -0.1, top - 0.13, -0.12, 0.016, 0.1, 0.07, 0.008).rotation.x = 0.5;
    rbox(M, '#3a2216', 0.1, top - 0.15, -0.1, 0.026, 0.1, 0.03, 0.008).rotation.x = -0.25;
    for (let q = 0; q < 4; q++) rod(M, [0.095 + q * 0.004, top - 0.05, -0.115], [0.095 + q * 0.004, top - 0.02, -0.125], 0.002, '#d8d0c0', 3);
  }
};

const warrior: Builder = (gp, r) => {
  // A section of Terracotta Army Pit 1 (秦始皇兵马俑一号坑): rammed-earth partition walls (隔梁) between corridors
  // paved with grey bricks; in each corridor a file of life-size grey clay infantry in lamellar armour, hair in a
  // side topknot, facing east (+z) four abreast; a kneeling archer from Pit 2 at the front, the rear of the pit still
  // under collapsed earth with broken figures being excavated. r.color sets the clay tone.
  const clay = str(r.color, '#968b7d');
  const earth = '#a8916a', brick = '#857e72';
  const top = 0.12;
  // pit floor of grey brick, earthen rim and three corridors separated by rammed-earth walls with log-roof scars
  const fy = 0.035;
  box(gp, '#9c8664', 0, 0, 0, 0.94, fy - 0.004, 0.9);
  box(gp, brick, 0, fy - 0.004, 0.0, 0.86, 0.004, 0.82);
  for (let i = 0; i < 14; i++) box(gp, shade(brick, 0.88), 0, fy - 0.0035, -0.37 + i * 0.057, 0.86, 0.001, 0.003);
  for (const [x, z, w, d] of [[0, -0.43, 0.94, 0.04], [0, 0.43, 0.94, 0.04], [-0.45, 0, 0.04, 0.9], [0.45, 0, 0.04, 0.9]] as const) box(gp, '#9c8664', x, 0, z, w, top, d);
  for (const wx of [-0.145, 0.145]) {
    box(gp, earth, wx, fy, -0.02, 0.05, 0.075, 0.78);
    for (let k = 0; k < 4; k++) box(gp, shade(earth, 0.88), wx, fy + 0.012 + k * 0.016, -0.02, 0.052, 0.002, 0.78);
    for (let k = 0; k < 9; k++) cyl(gp, '#5a4630', wx, fy + 0.075, -0.38 + k * 0.09, 0.004, 0.003, 5);
  }
  // infantry ranks
  const fig = (x: number, z: number, k: number, kneel = false) => {
    const tone = shade(clay, 0.94 + hash3(k, 3, 7) * 0.12);
    human(gp, x, fy, z, {
      h: kneel ? 0.17 : 0.17, pose: kneel ? 'kneel' : 'stand', top: tone, bottom: shade(tone, 0.95), skin: shade(tone, 1.04), hair: shade(tone, 0.8), hat: shade(tone, 0.8), hatStyle: 'knot',
      armor: shade(tone, 0.88), armorTrim: shade(tone, 0.72), shoes: shade(tone, 0.85), build: 1.1, detail: 'lo', ry: (hash3(k, 1, 9) - 0.5) * 0.06,
      hands: kneel ? undefined : [[-0.12, 0.42, 0.06], [0.1, 0.46, 0.14]],
    });
  };
  let k = 0;
  for (const cx of [-0.29, 0, 0.29]) for (let row = 0; row < 3; row++) for (const dx of [-0.075, -0.025, 0.025, 0.075]) {
    if (row === 2 && Math.abs(dx) > 0.05 && cx !== 0) continue;
    fig(cx + dx, 0.3 - row * 0.12, k++);
  }
  // kneeling archer at the front of the right corridor, an officer (军吏) with a long cap in the centre
  fig(0.29, 0.36, 99, true);
  human(gp, 0, fy, 0.36, { h: 0.18, pose: 'stand', top: shade(clay, 1.04), bottom: shade(clay, 0.97), skin: shade(clay, 1.06), hair: shade(clay, 0.82), hat: shade(clay, 0.78), hatStyle: 'cap', armor: shade(clay, 0.9), shoes: shade(clay, 0.85), build: 1.12, detail: 'lo', hands: [[-0.06, 0.38, 0.12], [0.06, 0.38, 0.12]] });
  // unexcavated rear: collapsed earth with broken torsos and a toppled figure
  for (const cx of [-0.29, 0, 0.29]) {
    const m = lathe(gp, [[0, 0], [0.12, 0], [0.09, 0.04], [0.03, 0.06], [0, 0.06]], '#9c8664', cx, fy, -0.24, 10);
    m.scale.set(1, 1, 1.5);
    ellip(gp, shade(clay, 0.9), cx - 0.04, fy + 0.035, -0.11, 0.022, 0.03, 0.018, 0.4);
    ellip(gp, shade(clay, 0.95), cx - 0.04, fy + 0.07, -0.11, 0.012);
    cyl(gp, shade(clay, 0.85), cx + 0.05, fy + 0.012, -0.08, 0.014, 0.07, 6).rotation.set(Math.PI / 2, 0, 0.6);
  }
};

/**
 * Draught horse in animals.ts horse() units (faces +z, withers ≈0.53, chest ≈z 0.22) at a quarter of its triangles,
 * so a four-horse team fits the model budget. Chariot horses wear the hogged (cropped) mane and knotted tail seen on
 * the 秦陵 bronze chariot and terracotta horses. `step` swings one diagonal pair of legs forward.
 */
function teamHorse(H: THREE.Object3D, coat: string, mane: string, step = 1): void {
  const dk = shade(coat, 0.72), hoof = '#1c1917';
  sweep(H, [
    { p: [0, 0.45, -0.25], w: 0.04, h: 0.05 }, { p: [0, 0.44, -0.2], w: 0.08, h: 0.095 }, { p: [0, 0.42, -0.08], w: 0.088, h: 0.105 },
    { p: [0, 0.42, 0.06], w: 0.09, h: 0.11 }, { p: [0, 0.44, 0.17], w: 0.075, h: 0.105 }, { p: [0, 0.45, 0.23], w: 0.045, h: 0.07 },
  ], coat, { radial: 14, sub: 3, squash: 0.92 });
  // neck rising to the poll, then the long head angled down to the muzzle
  sweep(H, [{ p: [0, 0.47, 0.16], w: 0.05, h: 0.085 }, { p: [0, 0.55, 0.25], w: 0.04, h: 0.066 }, { p: [0, 0.63, 0.31], w: 0.03, h: 0.048 }, { p: [0, 0.67, 0.33], w: 0.028, h: 0.036 }], coat, { radial: 10, sub: 3 });
  sweep(H, [{ p: [0, 0.68, 0.325], w: 0.028, h: 0.032 }, { p: [0, 0.66, 0.36], w: 0.032, h: 0.04 }, { p: [0, 0.615, 0.415], w: 0.025, h: 0.03 }, { p: [0, 0.58, 0.45], w: 0.022, h: 0.026 }], coat, { radial: 10, sub: 2 });
  ellip(H, dk, 0, 0.574, 0.452, 0.022, 0.022, 0.018);
  // bronze 当卢 frontlet on the brow-band
  bronze(box(H, '#8a7a4a', 0, 0.646, 0.41, 0.026, 0.044, 0.006, 0, -0.885), '#6a6a48');
  for (const sx of [-1, 1]) {
    ellip(H, '#120e0a', sx * 0.03, 0.655, 0.37, 0.007, 0.008, 0.009);
    cone(H, coat, sx * 0.016, 0.7, 0.315, 0.009, 0.04, 5).rotation.x = -0.25;
  }
  // hogged mane: a short stiff crest from poll to withers, with the forelock tuft
  sweep(H, [{ p: [0, 0.695, 0.315], w: 0.008, h: 0.012 }, { p: [0, 0.66, 0.28], w: 0.01, h: 0.02 }, { p: [0, 0.59, 0.21], w: 0.012, h: 0.022 }, { p: [0, 0.535, 0.13], w: 0.01, h: 0.016 }], mane, { radial: 6, sub: 2 });
  // tail tied up in a knot, its end hanging
  ellip(H, mane, 0, 0.43, -0.275, 0.022, 0.026, 0.022);
  sweep(H, [{ p: [0, 0.455, -0.245], w: 0.014 }, { p: [0, 0.43, -0.275], w: 0.016 }, { p: [0, 0.36, -0.29], w: 0.016 }, { p: [0, 0.3, -0.28], w: 0.01 }], mane, { radial: 6, sub: 2 });
  // legs: forearm–knee–cannon–fetlock in front, gaskin–hock behind
  for (const sx of [-1, 1]) {
    const x = sx * 0.05;
    for (const fore of [true, false]) {
      const fw = (sx > 0) === fore ? step : -step, z = (fore ? 0.15 : -0.17), s = fw * 0.03;
      const st = fore
        ? [{ p: [x, 0.38, z] as V3, w: 0.04 }, { p: [x, 0.25, z + 0.01 + s * 0.4] as V3, w: 0.024 }, { p: [x, 0.13, z + s * 0.8] as V3, w: 0.016 }, { p: [x, 0.045, z + s] as V3, w: 0.016 }]
        : [{ p: [x, 0.41, z + 0.02] as V3, w: 0.05 }, { p: [x, 0.28, z - 0.03 + s * 0.3] as V3, w: 0.03 }, { p: [x, 0.2, z - 0.06 + s * 0.6] as V3, w: 0.02 }, { p: [x, 0.11, z - 0.045 + s * 0.8] as V3, w: 0.016 }, { p: [x, 0.045, z - 0.03 + s] as V3, w: 0.016 }];
      sweep(H, st, coat, { radial: 8, sub: 3 });
      const [hx, , hz] = st[st.length - 1].p;
      cyl(H, hoof, hx, 0, hz + 0.004, 0.019, 0.035, 8);
    }
  }
}

const chariot: Builder = (gp, r) => {
  // Western Zhou / Spring-and-Autumn war chariot (cf. the 张家坡 and 虢国 chariot pits, 殷墟 车马坑): four horses
  // abreast, the inner pair (服) under a yoke beam (衡) with inverted-V yoke saddles (軛), the outer pair (骖) on traces;
  // one curved draught pole (辀); a single axle centred under a small rectangular lacquered box (舆, ≈1.3 × 0.9 m,
  // open at the back) carried on two large wheels (≈1.4 m, 18–26 spokes, ≈2.2 m track) with long hubs and bronze axle
  // caps (軎); a crew of three in bronze helmets and lacquered leather armour — archer (车左), driver (御) and 戈
  // halberdier (车右). No canopy (the parasol is a Qin–Han carriage feature). ≈0.17 units/m. r.color tints the box.
  const c = str(r.color, '#5a1f16'), blk = '#241a14', wood = '#6a4a30';
  ground(gp, 0.47, '#8a7a5a');
  // driving obliquely across the base so that wheels, box and team all read from the front
  const G = grp(gp, 0.02, 0.04, 0.75, 0.03);
  const R = 0.12, ay = R, tr = 0.19, bz = -0.22;
  // wheels, axle with 軎 caps
  for (const sx of [-1, 1]) {
    wheel(G, sx * tr, ay, bz, R, '#4a3222', 20);
    const cap = cyl(G, '#7a6a3a', sx * (tr + 0.045), ay, bz, 0.009, 0.03, 8);
    cap.rotation.z = Math.PI / 2;
    bronze(cap, '#6a6a48');
  }
  rod(G, [-tr - 0.04, ay, bz], [tr + 0.04, ay, bz], 0.007, wood, 6);
  // the box: floor frame, low railings with a raised front bar (軾), open at the rear
  const fy = ay + 0.012, bw = 0.22, bd = 0.15, rh = 0.07;
  rbox(G, c, 0, fy, bz, bw, 0.01, bd, 0.003);
  const rail = (a: V3, b: V3) => rod(G, a, b, 0.0035, c, 4);
  for (const sx of [-1, 1]) {
    rail([sx * bw / 2, fy + rh, bz - bd / 2], [sx * bw / 2, fy + rh, bz + bd / 2]);
    for (let k = 0; k <= 4; k++) rail([sx * bw / 2, fy, bz - bd / 2 + (k / 4) * bd], [sx * bw / 2, fy + rh, bz - bd / 2 + (k / 4) * bd]);
    rail([sx * bw / 2, fy + rh, bz - bd / 2], [sx * 0.04, fy + rh, bz - bd / 2]);
    rail([sx * 0.04, fy, bz - bd / 2], [sx * 0.04, fy + rh, bz - bd / 2]);
  }
  rail([-bw / 2, fy + rh, bz + bd / 2], [bw / 2, fy + rh, bz + bd / 2]);
  for (let k = 1; k < 6; k++) rail([-bw / 2 + (k / 6) * bw, fy, bz + bd / 2], [-bw / 2 + (k / 6) * bw, fy + rh, bz + bd / 2]);
  rod(G, [-bw / 2 + 0.01, fy + rh + 0.02, bz + bd / 2 - 0.03], [bw / 2 - 0.01, fy + rh + 0.02, bz + bd / 2 - 0.03], 0.004, blk, 4);
  for (const sx of [-1, 1]) rod(G, [sx * (bw / 2 - 0.01), fy + rh, bz + bd / 2 - 0.03], [sx * (bw / 2 - 0.01), fy + rh + 0.02, bz + bd / 2 - 0.03], 0.003, blk, 3);
  // side panels of lacquered leather in the lower rails
  for (const sx of [-1, 1]) box(G, shade(c, 0.8), sx * bw / 2, fy, bz, 0.003, rh * 0.55, bd);
  box(G, shade(c, 0.8), 0, fy, bz + bd / 2, bw, rh * 0.55, 0.003);
  // the draught pole (辀): under the box, rising in a long curve to the yoke
  // small ancient Chinese horses (≈1.3 m at the withers, about the wheel's diameter)
  const hs = 0.43, hz = 0.16;
  const yokeY = 0.215;
  tube(G, [[0, fy - 0.004, bz - bd / 2 - 0.02], [0, fy - 0.006, bz + bd / 2], [0, fy + 0.02, -0.02], [0, yokeY - 0.03, 0.16], [0, yokeY - 0.005, 0.25]], 0.008, 0.006, wood, { radial: 6, sub: 6 });
  // horses: inner pair under the yoke, outer pair a little behind on traces
  const coats = ['#6a4630', '#8a5a36', '#5a3a26', '#7a5232'];
  ([[-0.15, hz - 0.03], [-0.05, hz], [0.05, hz], [0.15, hz - 0.03]] as const).forEach(([x, z], i) => {
    const H = grp(G, x, z, 0, 0);
    H.scale.setScalar(hs);
    // bare-backed draught horses with a breast strap
    teamHorse(H, coats[i], '#1e1610', i % 2 ? 1 : -1);
    rod(H, [-0.09, 0.36, 0.17], [0.09, 0.36, 0.17], 0.012, blk, 4);
    rod(H, [-0.085, 0.36, 0.17], [-0.085, 0.4, 0.0], 0.008, blk, 3);
    rod(H, [0.085, 0.36, 0.17], [0.085, 0.4, 0.0], 0.008, blk, 3);
  });
  // yoke beam with two inverted-V 軛 on the inner horses, bronze 銮 bells on the yoke, reins to the driver
  const yz = 0.235;
  rod(G, [-0.11, yokeY, yz], [0.11, yokeY, yz], 0.006, blk, 5);
  for (const sx of [-1, 1]) {
    const x = sx * 0.05;
    rod(G, [x, yokeY, yz], [x - 0.025, yokeY - 0.06, yz], 0.004, blk, 4);
    rod(G, [x, yokeY, yz], [x + 0.025, yokeY - 0.06, yz], 0.004, blk, 4);
    bronze(ellip(G, '#6a6a48', sx * 0.1, yokeY + 0.015, yz, 0.008) as THREE.Mesh, '#6a6a48');
    rod(G, [sx * 0.15, yokeY - 0.04, yz - 0.03], [sx * 0.1, fy + 0.004, bz + bd / 2], 0.0015, '#2a1a10', 3);
  }
  // crew of three
  const crew = (x: number, z: number, top: string, hands: [V3, V3]) => human(G, x, fy + 0.01, z, {
    h: 0.28, pose: 'stand', top, bottom: '#3a3128', skin: '#c99a72', hair: '#1c1714', hat: '#7a6a3a', hatStyle: 'helmet', armor: '#4a2a1e', armorTrim: '#7a5a2a', shoes: '#2a2018', detail: 'lo', hands,
  });
  const drv = crew(0, bz + 0.01, '#7a5536', [[-0.12, 0.5, 0.3], [0.12, 0.5, 0.3]]);
  for (const sx of [-1, 1]) rod(G, sx < 0 ? drv.handL : drv.handR, [sx * 0.07, yokeY - 0.02, yz - 0.08], 0.0012, '#2a1a10', 3);
  const left = crew(-0.068, bz - 0.03, '#5a4a3a', [[-0.05, 0.62, 0.35], [0.12, 0.6, 0.0]]);
  const [lx, ly, lz] = left.handL;
  tube(G, [[lx, ly - 0.09, lz - 0.005], [lx - 0.015, ly, lz + 0.01], [lx, ly + 0.09, lz - 0.005]], 0.0025, 0.0025, blk, { radial: 4, sub: 4 });
  const right = crew(0.068, bz - 0.03, '#5a4a3a', [[-0.05, 0.5, 0.2], [0.1, 0.5, 0.15]]);
  // 戈 dagger-axe: long shaft held upright, bronze blade at right angles near the top
  const [rx, ry, rz] = right.handR;
  rod(G, [rx, ry - 0.12, rz], [rx, ry + 0.24, rz + 0.02], 0.003, blk, 4);
  const blade = box(G, '#8a7a4a', rx, ry + 0.2, rz + 0.025, 0.004, 0.012, 0.045);
  blade.rotation.x = 0.1;
  // the clan pennant (旂) on a pole set in the box's rear corner
  banner(G, -bw / 2 + 0.01, fy, bz - bd / 2 + 0.01, 0.34, str(r.flag, '#a8352a'), 0.08);
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
  if (r.driver !== false) human(G, 0.5, 0, 0.18, { h: 0.42, ry: Math.PI / 2, pose: 'walk', phase: 0.3, top: '#6b5a3e', bottom: '#4a3e2c', hat: '#3a3128', hatStyle: 'brim', detail: 'lo' });
};

const flag: Builder = (gp, r) => {
  // A Chinese war banner (牙旗) planted in a cairn of stones: a vertical silk field in the side's colour laced to the
  // pole, its fly and foot edged with the flame-tooth border (火焰牙) in a darker shade, a leaf-bladed spear finial with a
  // red horsehair tassel (缨). Built of 'flap' segments that wave in the wind. r.style 'modern': a plain rectangular
  // (3:2) flag on a pale staff with a gilt ball finial for 19th–20th-century events. r.color: the field.
  const c = str(r.color, '#a8352a'), modern = r.style === 'modern', edge = shade(c, 0.55);
  ground(gp, 0.1, '#8a7a5a');
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, d = 0.025 + (i % 3) * 0.012;
    ellip(gp, shade('#8f887a', 0.9 + hash3(i, 2, 5) * 0.2), Math.cos(a) * d, 0.035, Math.sin(a) * d, 0.022, 0.016, 0.018, a);
  }
  const H = 0.9, Fh = modern ? 0.24 : 0.34, Fw = modern ? 0.36 : 0.27, n = 5, sw = Fw / n;
  rod(gp, [0, 0.02, 0], [0, H, 0], 0.008, modern ? '#d8d2c4' : P.darkwood, 6);
  if (modern) ellip(gp, P.gold, 0, H + 0.012, 0, 0.014);
  else {
    const blade = lathe(gp, [[0, 0], [0.012, 0.012], [0.014, 0.03], [0.008, 0.06], [0, 0.08]], '#b8bcc2', 0, H + 0.01, 0, 4);
    blade.scale.z = 0.35;
    lathe(gp, [[0, 0], [0.012, 0], [0.012, 0.012], [0, 0.012]], '#c9a24a', 0, H, 0, 8);
    for (let q = 0; q < 7; q++) ellip(gp, '#b02a22', Math.cos(q * 0.9) * 0.012, H - 0.015 - (q % 3) * 0.008, Math.sin(q * 0.9) * 0.012, 0.01, 0.018, 0.01);
  }
  const top = H - (modern ? 0.02 : 0.04);
  if (!modern) for (let k = 0; k < 4; k++) cyl(gp, '#3a2a1e', 0, top - Fh * (0.1 + k * 0.28), 0, 0.011, 0.008, 6);
  let parent: THREE.Object3D = gp;
  for (let i = 0; i < n; i++) {
    const seg = anim(parent, 'flap', i === 0 ? 0.004 : sw, i === 0 ? top : 0, 0, { phase: i * 0.7, amp: 0.12 + i * 0.05 });
    seg.rotation.y = i === 0 ? -0.25 : i % 2 ? 0.4 : -0.4; // a ripple at rest, so stills show silk rather than a board
    box(seg, c, sw / 2, -Fh, 0, sw * 1.02, Fh, 0.003);
    if (!modern) {
      // flame teeth along the foot of each segment, and down the fly on the last one
      slab(seg, [[0, -Fh], [sw, -Fh], [sw * 0.75, -Fh - 0.03], [sw * 0.5, -Fh - 0.012], [sw * 0.25, -Fh - 0.03]], 0.004, edge, 0, false);
      box(seg, edge, sw / 2, -Fh, 0, sw * 1.02, 0.012, 0.0045);
      box(seg, edge, sw / 2, -0.012, 0, sw * 1.02, 0.012, 0.0045);
      if (i === n - 1) {
        box(seg, edge, sw - 0.006, -Fh, 0, 0.012, Fh, 0.0045);
        for (let k = 0; k < 5; k++) {
          const y0 = -Fh + (k / 5) * Fh;
          slab(seg, [[sw, y0], [sw + 0.03, y0 + Fh * 0.05], [sw + 0.012, y0 + Fh * 0.1], [sw + 0.03, y0 + Fh * 0.15], [sw, y0 + Fh / 5]], 0.004, edge, 0, false);
        }
      }
    }
    parent = seg;
  }
};

/** Smoke column (an animated 'smoke' group) with its puffs pre-placed as the rig would at t = 0 so stills show it too. */
function smoke(p: THREE.Object3D, x: number, y: number, z: number, size: number, n = 7, c = '#6b6560'): void {
  const sm = anim(p, 'smoke', x, y, z, { size });
  for (let i = 0; i < n; i++) {
    const k = i / n;
    add(sm, g('rich:ico', () => new THREE.IcosahedronGeometry(1, 0)), mat(shade(c, 1 + k * 0.25), { transparent: 0.72 }), Math.sin(k * 5 + i) * size * 0.6, k * size * 7, Math.cos(k * 4 + i) * size * 0.4, 1, 1, 1)
      .scale.setScalar(size * (0.6 + k * 2.2) * (k > 0.85 ? (1 - k) / 0.15 : 1));
  }
}
/** Small open fire: flickering orange/yellow tongues. */
function fire(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const f = anim(p, 'flicker', x, y, z);
  const geo = g('rich:cone8', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0));
  add(f, geo, mat('#ea580c', { emissive: '#ea580c' }), 0, 0, 0, s, s * 1.6, s);
  add(f, geo, mat('#fbbf24', { emissive: '#f59e0b' }), s * 0.15, 0, s * 0.1, s * 0.6, s * 1.1, s * 0.6);
  add(f, geo, mat('#f97316', { emissive: '#f97316' }), -s * 0.25, 0, -s * 0.1, s * 0.5, s * 1.2, s * 0.5);
}
/**
 * Terrain mound of radius R: a polar heightfield 0.03 + h(x, z) (faded to the rim) skinned with grass on gentle slopes
 * and bare `rock` on steep ones. Returns the surface height function.
 */
function hill(p: THREE.Object3D, R: number, h: (x: number, z: number) => number, grass: string, rock: string): (x: number, z: number) => number {
  const H = (x: number, z: number) => 0.03 + h(x, z) * Math.max(0, 1 - (Math.hypot(x, z) / R) ** 6);
  const rings: V3[][] = [];
  const NR = 16, NA = 44;
  for (let i = 1; i <= NR; i++) {
    const r = (i / NR) * R, ring: V3[] = [];
    for (let j = 0; j < NA; j++) { const a = (j / NA) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; ring.push([x, H(x, z), z]); }
    rings.push(ring);
  }
  rings.push(rings[NR - 1].map(([x, , z]) => [x * 0.97, 0, z * 0.97] as V3));
  skin(p, rings, grass, {
    caps: true, flat: true,
    paint: (x, y, z, _nx, ny) => {
      if (y < 0.03 && ny < 0.6) return shade(rock, 0.72);
      const n = hash3(Math.round(x * 50), Math.round(z * 50), 3);
      return ny < 0.62 ? (n > 0.5 ? rock : shade(rock, 0.9)) : n > 0.72 ? shade(grass, 1.1) : n < 0.15 ? shade(grass, 0.88) : grass;
    },
  });
  return H;
}

const beacon: Builder = gp => {
  // 烽燧 after the Han frontier towers at Dunhuang and Juyan (玉门关 / 甲渠候官 sites): a square tower of rammed earth
  // ≈7–8 m high, battered on all sides and laid with a mat of reeds (芦苇) every few courses; on top a breastwork, a
  // little guard shelter, a smoke oven (烟灶) and a lever pole (桔槔) that hoists the signal basket (蓬); a rope ladder
  // down to a walled yard (坞) with the garrison's huts, and rows of brushwood stacks (积薪) waiting to be fired. Smoke
  // by day (烽), fire by night (燧). ≈0.05 units/m.
  const earth = P.rammed, reed = '#cdbb8a', soot = '#3a322a';
  const H = hill(gp, 0.47, (x, z) => 0.05 * Math.exp(-((x + 0.08) ** 2 + (z + 0.06) ** 2) / 0.06), '#a49464', '#9a845a');
  const tx = -0.1, tz = -0.09, y0 = H(tx, tz) - 0.01, TH = 0.34, b0 = 0.11, b1 = 0.08, L = 0.011;
  const n = Math.round(TH / L), rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, R = b0 + (b1 - b0) * t, y = y0 + t * TH;
    rings.push([[tx - R, y, tz - R], [tx + R, y, tz - R], [tx + R, y, tz + R], [tx - R, y, tz + R]]);
  }
  skin(gp, rings, earth, {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      if (ny > 0.9) return shade(earth, 0.92);
      const k = Math.floor((y - y0) / L);
      return k % 5 === 4 ? reed : (k + Math.round(x * 30)) % 2 ? earth : shade(earth, 0.94);
    },
  });
  const top = y0 + TH;
  // breastwork with a gap at the ladder, guard shelter with a mud lean-to roof, smoke oven and the lever pole
  const B = grp(gp, tx, tz, 0, top);
  for (const [x, z, w, d] of [[0, -b1 + 0.006, b1 * 2, 0.012], [-b1 + 0.006, 0, 0.012, b1 * 2], [b1 - 0.006, -0.02, 0.012, b1 * 2 - 0.04], [-0.03, b1 - 0.006, b1 * 2 - 0.06, 0.012]] as const) box(B, shade(earth, 0.96), x, 0, z, w, 0.03, d);
  box(B, shade(earth, 0.9), -0.035, 0, -0.04, 0.07, 0.05, 0.06);
  slab(grp(B, -0.035, -0.04, Math.PI / 2, 0.05), [[-0.04, 0.012], [0.04, -0.006], [0.04, 0], [-0.04, 0.018]], 0.085, shade(reed, 0.75), 0, false);
  box(B, '#2a2420', -0.035, 0.0, -0.009, 0.018, 0.03, 0.002);
  box(B, shade(earth, 0.85), 0.04, 0, -0.04, 0.04, 0.025, 0.04);
  cyl(B, soot, 0.04, 0.025, -0.04, 0.012, 0.04, 6);
  fire(B, 0.04, 0.062, -0.04, 0.018);
  smoke(B, 0.04, 0.09, -0.04, 0.045, 8);
  rod(B, [0.055, 0, 0.04], [0.055, 0.14, 0.04], 0.004, P.darkwood, 5);
  rod(B, [0.0, 0.1, 0.06], [0.13, 0.2, 0.0], 0.003, P.darkwood, 4);
  rod(B, [0.13, 0.2, 0.0], [0.13, 0.16, 0.0], 0.0012, '#2a1a10', 3);
  lathe(B, [[0, 0], [0.012, 0.002], [0.016, 0.02], [0, 0.02]], '#7a5a34', 0.13, 0.14, 0, 8);
  box(B, '#2a1a10', -0.004, 0.08, 0.06, 0.01, 0.02, 0.01);
  const guard = grp(B, 0.02, 0.04, 0.4, 0);
  soldier(guard, 0, 0, 0.075, '#6a3a2a', { detail: 'lo', shield: false });
  // rope ladder down the front face to the yard
  for (const sx of [-1, 1]) rod(gp, [tx + 0.055 + sx * 0.012, top, tz + b1], [tx + 0.055 + sx * 0.012, y0 + 0.005, tz + b0 + 0.004], 0.0015, '#5a4630', 3);
  for (let k = 1; k < 12; k++) { const t = k / 12; box(gp, '#6a5238', tx + 0.055, top - t * TH, tz + b1 + (b0 - b1) * t + 0.002, 0.026, 0.003, 0.003); }
  // the yard (坞): a low earthen enclosure with a gate, two flat-roofed huts and a horse at the trough
  const yw = 0.32, yd = 0.2, yx = tx + 0.12, yz = tz + b0 + yd / 2, wh = 0.05;
  const Y = grp(gp, yx, yz, 0, H(yx, yz) - 0.012);
  for (const [x, z, w, d] of [[-yw / 2, 0, 0.014, yd], [yw / 2, 0, 0.014, yd], [-yw / 2 + 0.08, yd / 2, 0.16, 0.014], [yw / 2 - 0.06, yd / 2, 0.12, 0.014], [yw / 2 - 0.05, -yd / 2, 0.1, 0.014]] as const) box(Y, shade(earth, 0.95), x, 0, z, w, wh, d);
  for (const sx of [-1, 1]) box(Y, shade(earth, 0.88), 0.03 + sx * 0.035, 0, yd / 2, 0.014, wh + 0.012, 0.018);
  for (const [x, z, w] of [[0.08, -0.04, 0.1], [0.08, 0.04, 0.07]] as const) {
    box(Y, shade(earth, 1.03), x, 0, z, w, 0.04, 0.06);
    box(Y, '#8f7854', x, 0.04, z, w + 0.006, 0.008, 0.066);
    for (let k = 0; k < 3; k++) cyl(Y, P.darkwood, x - w / 2 + (k + 0.5) * (w / 3), 0.044, z + 0.034, 0.003, 0.006, 4).rotation.x = Math.PI / 2;
    box(Y, '#2a2420', x - w * 0.2, 0, z + 0.0305, 0.014, 0.026, 0.002);
  }
  const hz = grp(Y, -0.07, 0.03, 0.3, 0);
  hz.scale.setScalar(0.17);
  horse(hz, '#7a5232', '#2a1a10', { cloth: '#7a5232', saddle: '#4a3020' });
  box(Y, P.darkwood, -0.07, 0, 0.09, 0.06, 0.012, 0.014);
  human(Y, -0.02, 0, 0.05, { h: 0.075, pose: 'walk', top: '#7a5536', bottom: '#4a3e2c', skin: '#c99a72', hair: '#1c1714', hat: '#3a3128', hatStyle: 'knot', detail: 'lo', ry: 2.4 });
  // brushwood stacks (积薪) laid out beside the tower
  for (let i = 0; i < 6; i++) {
    const x = -0.36 + (i % 2) * 0.07, z = -0.14 + Math.floor(i / 2) * 0.1, y = H(x, z) - 0.006;
    tbox(gp, 0.05, 0.05, 0.034, 0.034, 0.045, i % 3 ? reed : shade(reed, 0.88), x, y, z);
    for (let k = 0; k < 3; k++) box(gp, shade(reed, 0.7), x, y + 0.008 + k * 0.014, z, 0.051 - k * 0.006, 0.002, 0.051 - k * 0.006);
  }
  // scrub on the loess
  for (let k = 0; k < 9; k++) {
    const a = hash3(k, 4, 1) * Math.PI * 2, d = 0.3 + hash3(k, 5, 1) * 0.13, x = Math.cos(a) * d, z = Math.sin(a) * d;
    ellip(gp, k % 2 ? '#7a7a48' : '#8a8452', x, H(x, z), z, 0.022, 0.014, 0.02);
  }
};

const wall: Builder = (gp, r) => {
  // Default: an Eastern Zhou / Qin frontier wall (齐长城 on the Shandong hills, 秦长城 at 固阳): on the ridges a
  // dry-laid wall of rough local stone ≈3–4 m high and as thick at the base, battered, with an earth walkway behind a
  // low breastwork; a square rammed-earth beacon platform on the summit and a pass (关) with a small timber gatehouse
  // in the saddle. r.style 'ming' (or r.year ≥ 1368): the 八达岭 Ming wall — grey fired brick on a dressed-granite
  // footing, crenellated outer parapet (垛口) and plain inner 女墙, a stepped walkway, hollow two-storey 敌楼 with
  // arched windows and a timber 铺房. ≈0.03 units/m (heights exaggerated ×1.5).
  const ming = r.style === 'ming' || (typeof r.year === 'number' && r.year >= 1368);
  const zc = (x: number) => Math.sin(x * 5.2 + 0.4) * 0.07;
  const amp = ming ? 0.26 : 0.2;
  const crest = (x: number) => amp * (Math.exp(-((x - 0.18) ** 2) / 0.05) * 1 + Math.exp(-((x + 0.33) ** 2) / 0.02) * 0.6 + 0.18);
  const H = hill(gp, 0.47, (x, z) => crest(x) * Math.exp(-((z - zc(x)) ** 2) / 0.07) + (hash3(Math.round(x * 20), Math.round(z * 20), 9) - 0.5) * 0.012,
    ming ? '#6d7a45' : '#7a8450', ming ? '#8a8270' : '#8f8672');
  const N = 30, pts: V3[] = [];
  for (let i = 0; i <= N; i++) { const x = -0.43 + (i / N) * 0.86, z = zc(x); pts.push([x, H(x, z), z]); }
  const stone = '#958c7c', brick = '#8b8780', granite = '#b3ab9a', path = ming ? '#7f7b74' : '#857658';
  const Hw = ming ? 0.075 : 0.06, w0 = ming ? 0.062 : 0.058, w1 = ming ? 0.058 : 0.04;
  const gateAt = 9, towers = ming ? [6, 21] : [21];
  const skip = (i: number) => towers.some(t => i === t || i === t - 1) || (!ming && (i === gateAt || i === gateAt - 1));
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = -Math.atan2(b[2] - a[2], b[0] - a[0]);
    const S = grp(gp, (a[0] + b[0]) / 2, (a[2] + b[2]) / 2, ry, (a[1] + b[1]) / 2);
    S.rotation.z = Math.atan2(b[1] - a[1], len);
    const L = Math.hypot(len, b[1] - a[1]) + 0.012, c = shade(ming ? brick : stone, 0.95 + hash3(i, 1, 1) * 0.1);
    if (skip(i)) continue;
    if (ming) {
      box(S, granite, 0, -0.06, 0, L, 0.08, w0 + 0.004);
      box(S, c, 0, 0.02, 0, L, Hw - 0.02, w1);
      for (let k = 1; k < 5; k++) for (const sz of [-1, 1]) box(S, shade(c, 0.86), 0, 0.02 + k * 0.012, sz * (w1 / 2 + 0.0005), L, 0.0015, 0.001);
      box(S, path, 0, Hw, 0, L, 0.003, w1 - 0.02);
      parapet(S, 0, Hw, -w1 / 2 + 0.007, L, 0, c, true, 0.9);
      parapet(S, 0, Hw, w1 / 2 - 0.007, L, 0, c, false, 0.7);
      if (Math.abs(b[1] - a[1]) / len > 0.25) for (let k = 0; k < 3; k++) box(S, shade(path, 0.8), -L / 2 + ((k + 0.5) / 3) * L, Hw + 0.003, 0, 0.002, 0.002, w1 - 0.022);
    } else {
      tbox(S, L, w0, L, w1, Hw + 0.05, c, 0, -0.05, 0);
      for (let k = 0; k < 4; k++) {
        const y = 0.0 + k * 0.014, t = (y + 0.05) / (Hw + 0.05), wd = w0 + (w1 - w0) * t;
        for (const sz of [-1, 1]) box(S, shade(c, 0.8 + hash3(i, k, sz) * 0.12), (hash3(i, k, 7) - 0.5) * L * 0.4, y, sz * wd / 2, L * 0.7, 0.003, 0.002);
      }
      box(S, path, 0, Hw, 0.004, L, 0.004, w1 - 0.012);
      box(S, c, 0, Hw, -w1 / 2 + 0.005, L, 0.016, 0.01);
      if (i % 3 === 0) for (const sz of [-1, 1]) box(S, shade(stone, 0.8), (hash3(i, 2, sz) - 0.5) * L, -0.02, sz * (w0 / 2 + 0.008), 0.014, 0.01, 0.012, hash3(i, sz, 3) * 3);
    }
  }
  const seg = (i: number) => {
    const a = pts[i - 1], b = pts[i + 1];
    return { p: pts[i], ry: -Math.atan2(b[2] - a[2], b[0] - a[0]) };
  };
  if (ming) {
    // 敌楼: hollow brick towers, granite base, three arched windows a side, crenellated roof platform
    towers.forEach((ti, j) => {
      const { p: [x, y, z], ry } = seg(ti), T = grp(gp, x, z, ry, y - 0.07);
      const tw = 0.12, th = Hw + 0.1 + 0.07;
      box(T, granite, 0, 0, 0, tw, 0.1, tw);
      box(T, brick, 0, 0.1, 0, tw - 0.004, th - 0.1, tw - 0.004);
      for (let k = 1; k < 7; k++) box(T, shade(brick, 0.86), 0, 0.1 + k * 0.013, 0, tw - 0.002, 0.0015, tw - 0.002);
      for (let s = 0; s < 4; s++) {
        const F = grp(T, 0, 0, (s * Math.PI) / 2, 0);
        for (let k = -1; k <= 1; k++) slab(grp(F, k * 0.035, tw / 2 - 0.0005, 0, th - 0.065), archLine(0.015, 0.01, 6), 0.003, '#24201c', 0, false);
      }
      box(T, shade(brick, 0.92), 0, th, 0, tw + 0.006, 0.006, tw + 0.006);
      for (let s = 0; s < 4; s++) parapet(T, Math.sin((s * Math.PI) / 2) * (tw / 2 - 0.004), th + 0.006, Math.cos((s * Math.PI) / 2) * (tw / 2 - 0.004), tw, (s * Math.PI) / 2, brick, true, 0.9);
      if (j === 1) {
        const e = hallBody(T, 0, th + 0.006, -0.01, 0.06, 0.045, 0.028, 3, { col: '#6a4a30', wall: '#8a8070', door: '#5a3a26', beam: '#4a5a5a', bracket: false });
        roof(T, 0, e, -0.01, 0.06, 0.045, 0.026, P.tile, { kind: 'xieshan', plain: true, gableC: '#7a756c' });
        banner(T, 0.045, th + 0.006, 0.04, 0.2, str(r.color, '#a8352a'), 0.06);
      } else {
        soldier(grp(T, 0.02, 0.02, 0.6, th + 0.006), 0, 0, 0.07, '#7a2a20', { detail: 'lo' });
      }
    });
  } else {
    // pass (关) in the saddle: stone abutments, timber lintel and a small tiled gatehouse
    const { p: [gx, gy, gz], ry } = seg(gateAt), Gt = grp(gp, gx, gz, ry, gy - 0.04);
    for (const sx of [-1, 1]) tbox(Gt, 0.03, 0.07, 0.026, 0.06, Hw + 0.05, stone, sx * 0.03, 0, 0);
    box(Gt, P.darkwood, 0, Hw + 0.01, 0, 0.09, 0.012, 0.064);
    for (const sx of [-1, 1]) box(Gt, '#4a3222', sx * 0.008, 0.0, 0.026, 0.016, Hw + 0.01, 0.004, sx * 0.4);
    const e = hallBody(Gt, 0, Hw + 0.022, 0, 0.07, 0.045, 0.03, 3, { col: '#5a3a26', wall: '#a08a64', door: '#4a3222', beam: '#4a3a2a', bracket: false });
    roof(Gt, 0, e, 0, 0.07, 0.045, 0.026, '#55585c', { kind: 'hip', plain: true, lift: 0.15 });
    banner(Gt, -0.04, Hw + 0.022, 0.02, 0.13, str(r.color, '#a8352a'), 0.04);
    // beacon platform on the summit
    const { p: [bx, by, bz], ry: bry } = seg(towers[0]), Bt = grp(gp, bx, bz, bry, by - 0.04);
    tbox(Bt, 0.1, 0.1, 0.075, 0.075, Hw + 0.1, P.rammed, 0, 0, 0);
    for (let k = 1; k < 9; k++) { const t = k / 9; box(Bt, shade(P.rammed, 0.88), 0, t * (Hw + 0.1), 0, 0.1 - t * 0.025 + 0.002, 0.0015, 0.1 - t * 0.025 + 0.002); }
    for (const [x, z] of [[-0.02, -0.015], [0.02, 0.01]] as const) tbox(Bt, 0.022, 0.022, 0.012, 0.012, 0.025, '#b8a070', x, Hw + 0.1, z);
    soldier(grp(Bt, 0.015, -0.02, 0.4, Hw + 0.1), 0, 0, 0.07, '#5a3a2a', { detail: 'lo', arm: 'ji' });
    soldier(grp(gp, pts[13][0], pts[13][2], 1.4, pts[13][1] + Hw), 0, 0, 0.07, '#5a3a2a', { detail: 'lo', arm: 'ji' });
  }
  // trees on the slopes, kept off the wall line
  for (let k = 0; k < 16; k++) {
    const x = -0.4 + hash3(k, 1, 2) * 0.8, side = k % 2 ? 1 : -1, z = zc(x) + side * (0.09 + hash3(k, 2, 2) * 0.22);
    if (Math.hypot(x, z) > 0.44) continue;
    const y = H(x, z);
    if (k % 3) minipine(gp, x, y, z, 0.05 + hash3(k, 3, 2) * 0.03, ming ? '#3a5a30' : '#355a2e');
    else { cyl(gp, '#5b4030', x, y, z, 0.003, 0.02, 4); ellip(gp, ming ? '#8a7a3a' : '#5a7a3a', x, y + 0.03, z, 0.022, 0.018, 0.022); }
  }
};

/** Arched outline (rectangle of width w, springing at hs, semicircular head) for slab(). */
const archLine = (w: number, hs: number, n = 8): [number, number][] => {
  const out: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; out.push([Math.cos(a) * w / 2, hs + Math.sin(a) * w / 2]); }
  return out;
};
/** Brick parapet along local x (length len) at (x, y, z) turned ry: a breast wall with `merlons` (垛口) or a plain 女墙. */
function parapet(p: THREE.Object3D, x: number, y: number, z: number, len: number, ry: number, c: string, merlons = true, s = 1): void {
  const G = grp(p, x, z, ry, y);
  box(G, c, 0, 0, 0, len, 0.014 * s, 0.014 * s);
  if (!merlons) return;
  const n = Math.max(2, Math.round(len / (0.04 * s)));
  for (let i = 0; i < n; i++) box(G, c, -len / 2 + ((i + 0.5) / n) * len, 0.014 * s, 0, (len / n) * 0.62, 0.016 * s, 0.014 * s);
}

const gate: Builder = (gp, r) => {
  // Ming city gate (cf. 嘉峪关 光化楼, Xi'an 永宁门, 山海关): a battered grey-brick gate platform (墩台) on a dressed-stone
  // plinth, one round-arched passage with a stone frame and studded doors, a name plaque, crenellated parapet and a
  // two-storey timber gate tower (城楼) with a pent eave and a grey-tile 歇山 roof. r.color tints the banners.
  // r.style 'tiananmen': 天安门 — red platform with five arches on a marble base, 9-bay double-eave yellow 歇山 tower
  // with red lanterns, the Golden Water bridges and a pair of 华表 in front.
  const flagC = str(r.color, '#a8352a');
  if (r.style === 'tiananmen') {
    const red = '#9c2e24', marble = '#ddd7c8', yellow = '#d6a530';
    const zc = -0.1, W = 0.86, D = 0.3, H = 0.12;
    tbox(gp, W + 0.04, D + 0.04, W + 0.03, D + 0.03, 0.02, marble, 0, 0, zc);
    tbox(gp, W, D, W - 0.024, D - 0.024, H, red, 0, 0.02, zc);
    box(gp, shade(red, 0.8), 0, 0.02 + H - 0.008, zc, W - 0.022, 0.008, D - 0.022);
    const face = zc + D / 2 - 0.002, bat = Math.atan2(0.012, H);
    for (const [ax, aw, ah] of [[0, 0.055, 0.0525], [-0.13, 0.045, 0.0425], [0.13, 0.045, 0.0425], [-0.26, 0.04, 0.035], [0.26, 0.04, 0.035]] as const) {
      const A = grp(gp, ax, face, 0, 0.02);
      A.rotation.x = -bat;
      slab(A, archLine(aw, ah), 0.006, '#2a1a14', 0, false);
      const dr = slab(A, archLine(aw * 0.84, ah * 0.92), 0.006, '#7a2a1c', 0, false);
      dr.position.z = 0.002;
      for (let k = 0; k < 4; k++) for (let j = -2; j <= 2; j++) ellip(A, '#d6a840', j * aw * 0.16, ah * (0.2 + k * 0.22), 0.0085, 0.0018);
    }
    // the portrait frame above the central gate
    const pf = grp(gp, 0, face + 0.004, 0, 0.02 + 0.072 + 0.01);
    pf.rotation.x = -bat;
    box(pf, '#3a2e26', 0, 0, 0, 0.034, 0.042, 0.004);
    box(pf, '#b8a58e', 0, 0.004, 0.002, 0.026, 0.034, 0.003);
    // marble balustrade round the top
    const yT = 0.02 + H;
    for (const [x, z, len, ry] of [[0, zc + D / 2 - 0.016, W - 0.04, 0], [0, zc - D / 2 + 0.016, W - 0.04, 0], [-W / 2 + 0.016, zc, D - 0.04, Math.PI / 2], [W / 2 - 0.016, zc, D - 0.04, Math.PI / 2]] as const) {
      const G = grp(gp, x, z, ry, yT);
      box(G, marble, 0, 0.016, 0, len, 0.004, 0.006);
      const n = Math.round(len / 0.03);
      for (let i = 0; i <= n; i++) box(G, marble, -len / 2 + (i / n) * len, 0, 0, 0.005, 0.022, 0.005);
    }
    // the tower: 9 × 5 bays, double-eave 歇山, yellow glazed tile
    const zt = zc - 0.01;
    rbox(gp, marble, 0, yT, zt, 0.66, 0.012, 0.25, 0.002);
    const e1 = hallBody(gp, 0, yT + 0.012, zt, 0.6, 0.21, 0.085, 9, { col: '#a8352a', wall: '#9a3326', beam: '#2f6f6a' });
    roof(gp, 0, e1, zt, 0.6, 0.21, 0.035, yellow, { kind: 'hip', ov: 0.04, lift: 0.35, ridge: '#c08f22', plain: true });
    const e2 = hallBody(gp, 0, e1 + 0.016, zt, 0.52, 0.15, 0.04, 9, { open: true, wall: '#9a3326', beam: '#2f6f6a' });
    roof(gp, 0, e2, zt, 0.52, 0.15, 0.085, yellow, { kind: 'xieshan', ov: 0.045, lift: 0.4, ridge: '#c08f22', beasts: true });
    // eight great red lanterns hung under the lower eave
    for (let i = 0; i < 8; i++) {
      const lx = -0.28 + (i + (i >= 4 ? 1 : 0)) * 0.0622, lz = zt + 0.125;
      rod(gp, [lx, e1 - 0.004, lz], [lx, e1 - 0.016, lz], 0.0012, '#2a1a14', 3);
      ellip(gp, '#d42a1e', lx, e1 - 0.028, lz, 0.013, 0.014, 0.013);
      box(gp, '#d6a840', lx, e1 - 0.046, lz, 0.004, 0.006, 0.004);
    }
    // the Golden Water river, five marble bridges and a pair of 华表 columns with crouching 犼
    box(gp, '#d4ccb8', 0, 0, 0.18, 0.92, 0.004, 0.26);
    box(gp, '#3f6f86', 0, 0.002, 0.2, 0.92, 0.004, 0.05);
    for (const bx of [-0.24, -0.12, 0, 0.12, 0.24]) {
      const bw = bx === 0 ? 0.06 : 0.045;
      const bridgeG = grp(gp, bx, 0.2, Math.PI / 2, 0);
      slab(bridgeG, [[-0.05, 0], [0.05, 0], [0.04, 0.012], [0, 0.016], [-0.04, 0.012]], bw, marble, 0, false);
      for (const sx of [-1, 1]) box(gp, marble, bx + sx * bw / 2, 0.014, 0.2, 0.004, 0.012, 0.09);
    }
    for (const sx of [-1, 1]) {
      const hx = sx * 0.36, hz = 0.33;
      tbox(gp, 0.05, 0.05, 0.044, 0.044, 0.02, marble, hx, 0, hz);
      cyl(gp, marble, hx, 0.02, hz, 0.009, 0.15, 8);
      for (let k = 0; k < 4; k++) ellip(gp, shade(marble, 0.92), hx + Math.cos(k * 1.7) * 0.007, 0.05 + k * 0.026, hz + Math.sin(k * 1.7) * 0.007, 0.007, 0.01, 0.004, k * 1.7);
      box(gp, marble, hx, 0.13, hz, 0.045, 0.007, 0.01);
      cyl(gp, marble, hx, 0.17, hz, 0.018, 0.007, 10);
      ellip(gp, marble, hx, 0.185, hz, 0.007, 0.01, 0.01);
      // stone lions on the near side of the bridges
      rbox(gp, marble, sx * 0.17, 0, 0.28, 0.03, 0.02, 0.03, 0.003);
      ellip(gp, shade(marble, 0.95), sx * 0.17, 0.035, 0.28, 0.011, 0.016, 0.012);
      ellip(gp, shade(marble, 0.9), sx * 0.17, 0.056, 0.286, 0.01);
    }
    return;
  }
  const brick = '#8a867d', stone = '#b0a894', zc = -0.05, W = 0.86, D = 0.3, H = 0.2;
  // stone plinth and battered brick platform
  tbox(gp, W + 0.03, D + 0.03, W + 0.02, D + 0.02, 0.03, stone, 0, 0, zc);
  const sk = skin(gp, [0, 1].map(t => {
    const w = W / 2 - t * 0.024, d = D / 2 - t * 0.024, y = 0.03 + t * H;
    return [[-w, y, -d], [w, y, -d], [w, y, d], [-w, y, d]] as V3[];
  }), brick, { caps: true, flat: true });
  sk.position.z = zc;
  for (let k = 1; k < 7; k++) {
    // a few darker brick courses read as coursed masonry
    const t = k / 7, y = 0.03 + t * H, w = W / 2 - t * 0.024, d = D / 2 - t * 0.024;
    box(gp, shade(brick, 0.9), 0, y, zc + d + 0.0005, w * 2, 0.0025, 0.001);
  }
  const yT = 0.03 + H, face = zc + D / 2 - 0.004, bat = Math.atan2(0.024, H);
  // arched passage: stone voussoirs, dark vault and the iron-studded doors set back inside
  const A = grp(gp, 0, face, 0, 0.03);
  A.rotation.x = -bat;
  slab(A, archLine(0.13, 0.085), 0.008, '#a49c8a', 0, false);
  slab(A, archLine(0.1, 0.075), 0.008, '#1e1915', 0, false).position.z = 0.002;
  const dr = slab(A, archLine(0.08, 0.07), 0.006, '#5a2a1c', 0, false);
  dr.position.z = 0.004;
  box(A, '#2a1a14', 0, 0, 0.0105, 0.002, 0.1, 0.002);
  for (let k = 0; k < 5; k++) for (const j of [-3, -2, -1, 1, 2, 3]) ellip(A, '#2a2420', j * 0.0105, 0.012 + k * 0.016, 0.01, 0.0017);
  // the stone name plaque (石匾) above the arch
  const pq = grp(gp, 0, face + 0.002, 0, 0.03 + 0.15);
  pq.rotation.x = -bat;
  box(pq, '#c9c0aa', 0, 0, 0, 0.08, 0.026, 0.004);
  for (let k = 0; k < 3; k++) box(pq, '#2a2420', -0.022 + k * 0.022, 0.006, 0.0025, 0.012, 0.014, 0.001);
  // walkway paving and crenellated parapets (垛口 outside, low 女墙 on the city side)
  const w2 = W / 2 - 0.024, d2 = D / 2 - 0.024;
  box(gp, '#9a968c', 0, yT, zc, w2 * 2, 0.004, d2 * 2);
  parapet(gp, 0, yT, zc + d2 - 0.007, w2 * 2, 0, brick);
  parapet(gp, -w2 + 0.007, yT, zc, d2 * 2, Math.PI / 2, brick);
  parapet(gp, w2 - 0.007, yT, zc, d2 * 2, Math.PI / 2, brick);
  parapet(gp, 0, yT, zc - d2 + 0.007, w2 * 2, 0, brick, false);
  // gate tower: five-bay ground storey with a pent eave (腰檐), balcony storey above, grey-tile 歇山 roof
  const zt = zc - 0.015;
  rbox(gp, '#a49c8a', 0, yT, zt, 0.54, 0.012, 0.2, 0.002);
  const e1 = hallBody(gp, 0, yT + 0.012, zt, 0.48, 0.16, 0.085, 5, { col: '#8a2e22', wall: '#8a3326', beam: '#2f5f5a' });
  roof(gp, 0, e1, zt, 0.48, 0.16, 0.035, '#4e5157', { kind: 'hip', ov: 0.035, lift: 0.3, plain: true });
  const y2 = e1 + 0.014;
  for (const [x, z, len, ry] of [[0, zt + 0.07, 0.44, 0], [0, zt - 0.07, 0.44, 0], [-0.22, zt, 0.14, Math.PI / 2], [0.22, zt, 0.14, Math.PI / 2]] as const) {
    const G = grp(gp, x, z, ry, y2);
    box(G, '#7a2a1e', 0, 0.012, 0, len, 0.003, 0.004);
    const n = Math.round(len / 0.025);
    for (let i = 0; i <= n; i++) box(G, '#7a2a1e', -len / 2 + (i / n) * len, 0, 0, 0.003, 0.014, 0.003);
  }
  const e2 = hallBody(gp, 0, y2, zt, 0.4, 0.12, 0.06, 5, { col: '#8a2e22', wall: '#8a3326', beam: '#2f5f5a' });
  roof(gp, 0, e2, zt, 0.4, 0.12, 0.08, '#4e5157', { kind: 'xieshan', ov: 0.045, lift: 0.45 });
  // garrison banners on the corners and sentries at the parapet and gate
  const top = grp(gp, 0, 0, 0, yT);
  for (const sx of [-1, 1]) {
    banner(gp, sx * (w2 - 0.03), yT, zc + d2 - 0.03, 0.2, flagC, 0.07);
    soldier(top, sx * 0.3, zc + d2 - 0.03, 0.07, '#7f1d1d', { detail: 'lo', shield: false });
    soldier(gp, sx * 0.1, face + 0.04, 0.1, '#7f1d1d', { detail: 'lo', shield: false });
  }
};

const palace: Builder = (gp, r) => {
  // An imperial main hall for its period. r.style (or r.year) chooses:
  //  'ming' (default, 960+): 太和殿 — 11 × 5 bays on a three-tier white-marble 须弥座 terrace, double-eave 庑殿 roof in
  //    yellow glazed tile with ridge beasts, bronze incense burners, sundial (日晷) and grain measure (嘉量);
  //  'tang' (400–960): 含元殿 — hall on a high brick-faced platform reached by a long ramp (龙尾道), single-eave grey hip
  //    roof with 鸱尾, white walls and red columns, flanking towers (翔鸾阁 / 栖凤阁) linked by galleries;
  //  'han' (−1000–400): 未央宫前殿 — 高台 terrace of rammed earth in two tiers, a straight grey-tile hip roof, twin
  //    阙 gate towers in front;
  //  'early' (< −1000): 二里头 / Xia–Shang palace — 茅茨土阶, a thatched hip roof on timber posts over a low
  //    rammed-earth platform inside a walled courtyard with a gate house. r.roof overrides the tile colour.
  const yr = typeof r.year === 'number' ? r.year : undefined;
  const style = str(r.style, yr === undefined ? 'ming' : yr < -1000 ? 'early' : yr < 400 ? 'han' : yr < 960 ? 'tang' : 'ming');
  if (style === 'early') {
    const earth = '#b39a6c', thatch = str(r.roof, '#a88a52');
    ground(gp, 0.47, '#9a8a62');
    // walled courtyard with a corridor (廊庑) along the enclosure and a gate house at the front
    const R = 0.42;
    for (const [x, z, len, ry] of [[0, -R, 2 * R, 0], [-R, 0, 2 * R, Math.PI / 2], [R, 0, 2 * R, Math.PI / 2], [-0.26, R, 0.32, 0], [0.26, R, 0.32, 0]] as const) {
      const G = grp(gp, x, z, ry, 0.03);
      box(G, earth, 0, 0, 0, len, 0.045, 0.024);
      roof(G, 0, 0.045, 0, len, 0.024, 0.02, thatch, { kind: 'gable', ov: 0.01, lift: 0, plain: true, ridge: shade(thatch, 0.8) });
    }
    tbox(gp, 0.18, 0.08, 0.17, 0.075, 0.02, earth, 0, 0.03, R);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(gp, '#6a4a30', sx * 0.06, 0.05, R + sz * 0.03, 0.005, 0.06, 6);
    roof(gp, 0, 0.11, R, 0.14, 0.07, 0.04, thatch, { kind: 'hip', ov: 0.02, lift: 0, plain: true, ridge: shade(thatch, 0.8) });
    // the hall: a low rammed-earth platform (土阶) with earthen steps, posts and wattle walls, steep thatched hip roof
    const zc = -0.13;
    tbox(gp, 0.62, 0.32, 0.6, 0.3, 0.05, earth, 0, 0.03, zc);
    for (let i = 0; i < 4; i++) box(gp, shade(earth, 0.93), 0, 0.03 + i * 0.0125, zc + 0.16 + 0.04 - i * 0.012, 0.12, 0.0125, 0.012);
    const y = 0.08, W = 0.52, D = 0.22, h = 0.09;
    box(gp, '#b8a582', 0, y, zc - 0.012, W - 0.02, h, D - 0.04);
    for (let i = 0; i <= 8; i++) for (const sz of [-1, 1]) cyl(gp, '#6a4a30', -W / 2 + (i / 8) * W, y, zc + sz * (D / 2 - 0.006), 0.006, h, 6);
    for (const dx of [-0.13, 0, 0.13]) box(gp, '#3a2a1c', dx, y, zc + D / 2 - 0.031, 0.045, h * 0.8, 0.002);
    box(gp, '#6a4a30', 0, y + h - 0.006, zc, W + 0.01, 0.008, D + 0.006);
    roof(gp, 0, y + h, zc, W, D, 0.16, thatch, { kind: 'hip', ov: 0.05, lift: 0.05, plain: true, ridge: shade(thatch, 0.75), under: '#5a4630' });
    // a bronze 爵 vessel and the ruler's attendants in the court
    for (let k = 0; k < 4; k++) human(gp, -0.15 + k * 0.1, 0.03, 0.15 + (k % 2) * 0.04, { h: 0.11, pose: 'stand', top: k ? '#8a6a42' : '#5a3a2a', bottom: '#6b5a3e', hair: '#1c1714', detail: 'min', dress: 'ankle', ry: Math.PI });
    return;
  }
  if (style === 'han') {
    const earth = '#b39a6c', tile = str(r.roof, '#45484d');
    ground(gp, 0.47, '#8a7a5a');
    const zc = -0.1;
    // two-tier rammed-earth 高台 with timber-laced layers, stairs up the front
    tbox(gp, 0.82, 0.5, 0.78, 0.46, 0.08, earth, 0, 0.03, zc);
    tbox(gp, 0.62, 0.36, 0.58, 0.32, 0.07, earth, 0, 0.11, zc - 0.02);
    for (const [y, w, d, z] of [[0.06, 0.8, 0.48, zc], [0.08, 0.79, 0.47, zc], [0.14, 0.6, 0.34, zc - 0.02], [0.16, 0.59, 0.33, zc - 0.02]] as const) box(gp, shade(earth, 0.88), 0, y, z, w, 0.003, d);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 8; i++) box(gp, shade(earth, 0.95), sx * 0.12, 0.03 + i * 0.01, zc + 0.25 + 0.06 - i * 0.008, 0.06, 0.01, 0.01);
      for (let i = 0; i < 7; i++) box(gp, shade(earth, 0.95), sx * 0.12, 0.11 + i * 0.01, zc + 0.16 + 0.06 - i * 0.009, 0.06, 0.01, 0.01);
    }
    const y = 0.18, W = 0.5, D = 0.24;
    const e = hallBody(gp, 0, y, zc - 0.03, W, D, 0.1, 7, { col: '#6a1f16', wall: '#d9cdb0', door: '#5a2418', beam: '#3a2a20' });
    roof(gp, 0, e, zc - 0.03, W, D, 0.085, tile, { kind: 'hip', ov: 0.05, lift: 0.06 });
    // twin 阙 towers flanking the approach
    for (const sx of [-1, 1]) {
      const qx = sx * 0.33, qz = 0.3;
      tbox(gp, 0.1, 0.07, 0.09, 0.06, 0.16, '#cfc3a8', qx, 0.03, qz);
      box(gp, '#6a1f16', qx, 0.15, qz, 0.092, 0.012, 0.062);
      const t1 = roof(gp, qx, 0.19, qz, 0.09, 0.06, 0.025, tile, { kind: 'hip', ov: 0.018, lift: 0.05, plain: true });
      box(gp, '#cfc3a8', qx, t1 - 0.006, qz, 0.05, 0.03, 0.035);
      roof(gp, qx, t1 + 0.024, qz, 0.05, 0.035, 0.02, tile, { kind: 'hip', ov: 0.014, lift: 0.05, plain: true });
      tbox(gp, 0.05, 0.05, 0.045, 0.045, 0.1, '#cfc3a8', qx + sx * 0.07, 0.03, qz);
      roof(gp, qx + sx * 0.07, 0.13, qz, 0.045, 0.045, 0.02, tile, { kind: 'hip', ov: 0.012, lift: 0.05, plain: true });
    }
    for (let k = 0; k < 3; k++) human(gp, -0.08 + k * 0.08, 0.03, 0.34, { h: 0.1, pose: 'walk', phase: k / 3, top: ['#2a2420', '#7a2318', '#2a2420'][k], bottom: '#2a2420', hair: '#1c1714', detail: 'min', dress: 'ankle', ry: Math.PI });
    return;
  }
  if (style === 'tang') {
    const tile = str(r.roof, '#3f4248'), plat = '#c4b89e';
    ground(gp, 0.47, '#9a8f74');
    const zc = -0.1, W = 0.58, D = 0.36, H = 0.13;
    tbox(gp, W, D, W - 0.02, D - 0.02, H, plat, 0, 0.03, zc);
    box(gp, '#e2dccd', 0, 0.03 + H, zc, W - 0.02, 0.006, D - 0.02);
    for (const [x, z, len, ry] of [[0, zc + D / 2 - 0.012, W - 0.03, 0], [-W / 2 + 0.012, zc, D - 0.03, Math.PI / 2], [W / 2 - 0.012, zc, D - 0.03, Math.PI / 2]] as const) {
      const G = grp(gp, x, z, ry, 0.03 + H);
      box(G, '#8a2e22', 0, 0.012, 0, len, 0.003, 0.004);
      const n = Math.round(len / 0.03);
      for (let i = 0; i <= n; i++) box(G, '#8a2e22', -len / 2 + (i / n) * len, 0, 0, 0.003, 0.015, 0.003);
    }
    // 龙尾道: the long dragon-tail ramp climbing in three flights with landings (side profile extruded across)
    const f0 = zc + D / 2, v = (k: number) => 0.03 + (H * k) / 3;
    const prof: [number, number][] = [[f0 - 0.01, 0.03], [0.45, 0.03], [0.43, v(1)], [0.37, v(1)], [0.3, v(2)], [0.24, v(2)], [f0 + 0.04, v(3)], [f0 - 0.01, v(3)]];
    for (const sx of [-1, 1]) {
      const rg = grp(gp, sx * 0.11, 0, -Math.PI / 2, 0);
      slab(rg, prof, 0.05, '#b8ac92', 0, false);
      for (const ex of [-0.025, 0.025]) {
        rod(gp, [sx * 0.11 + ex, 0.045, 0.45], [sx * 0.11 + ex, v(1) + 0.012, 0.43], 0.002, '#e2dccd', 3);
        rod(gp, [sx * 0.11 + ex, v(1) + 0.012, 0.37], [sx * 0.11 + ex, v(2) + 0.012, 0.3], 0.002, '#e2dccd', 3);
        rod(gp, [sx * 0.11 + ex, v(2) + 0.012, 0.24], [sx * 0.11 + ex, v(3) + 0.012, f0 + 0.04], 0.002, '#e2dccd', 3);
      }
    }
    const y = 0.036 + H;
    rbox(gp, '#cfc6b2', 0, y, zc - 0.02, 0.48, 0.012, 0.24, 0.002);
    const e = hallBody(gp, 0, y + 0.012, zc - 0.02, 0.44, 0.2, 0.1, 11, { col: '#a8352a', wall: '#ece4d2', door: '#8a3a22', beam: '#a8352a' });
    roof(gp, 0, e, zc - 0.02, 0.44, 0.2, 0.08, tile, { kind: 'hip', ov: 0.06, lift: 0.18, ridge: '#2f6f5a' });
    // 翔鸾阁 / 栖凤阁 on tall bases, joined to the hall by covered galleries
    for (const sx of [-1, 1]) {
      const qx = sx * 0.36, qz = 0.14;
      tbox(gp, 0.11, 0.11, 0.1, 0.1, 0.17, plat, qx, 0.03, qz);
      const e2 = hallBody(gp, qx, 0.2, qz, 0.08, 0.08, 0.05, 3, { col: '#a8352a', wall: '#ece4d2', beam: '#a8352a' });
      roof(gp, qx, e2, qz, 0.08, 0.08, 0.04, tile, { kind: 'hip', ov: 0.025, lift: 0.18, ridge: '#2f6f5a' });
      const gx = sx * 0.3;
      box(gp, '#ece4d2', gx, 0.03 + H + 0.005, zc + 0.02, 0.016, 0.035, 0.22).rotation.y = 0;
      roof(gp, gx, 0.03 + H + 0.04, zc + 0.04, 0.03, 0.26, 0.018, tile, { kind: 'gable', ov: 0.008, lift: 0.05, plain: true, ry: Math.PI / 2 });
    }
    for (let k = 0; k < 4; k++) human(gp, -0.15 + k * 0.1, 0.03, 0.36 - (k % 2) * 0.03, { h: 0.1, pose: 'stand', top: ['#7a2318', '#2f4f8a', '#4a6a3a', '#7a2318'][k], bottom: '#2a2420', hair: '#1c1714', detail: 'min', dress: 'ankle', ry: Math.PI });
    return;
  }
  // 太和殿
  const tile = str(r.roof, '#d6a530'), ridgeC = shade(tile, 0.82);
  const y = terrace(gp, 0.9, 0.62, 3, 0.04);
  const zc = -0.05, W = 0.6, D = 0.28;
  rbox(gp, '#d8d0be', 0, y, zc, W + 0.05, 0.012, D + 0.05, 0.002);
  const e1 = hallBody(gp, 0, y + 0.012, zc, W, D, 0.105, 11, { col: '#a8352a', wall: '#9a3326', door: '#a8452a', beam: '#2f6f6a' });
  roof(gp, 0, e1, zc, W, D, 0.04, tile, { kind: 'hip', ov: 0.05, lift: 0.35, ridge: ridgeC, plain: true });
  const e2 = hallBody(gp, 0, e1 + 0.016, zc, W * 0.86, D * 0.7, 0.035, 9, { open: true, wall: '#9a3326', beam: '#2f6f6a' });
  roof(gp, 0, e2, zc, W * 0.86, D * 0.7, 0.12, tile, { kind: 'hip', ov: 0.05, lift: 0.4, ridge: ridgeC, beasts: true });
  // the plaque under the upper eave
  box(gp, '#1f3f6a', 0, e2 - 0.03, zc + D * 0.35 + 0.012, 0.05, 0.025, 0.003);
  box(gp, '#d6a840', 0, e2 - 0.026, zc + D * 0.35 + 0.014, 0.04, 0.017, 0.002);
  // on the terrace: bronze tripod censers, a sundial, the grain measure, bronze crane and tortoise
  const ty = y, fz = zc + D / 2 + 0.06;
  for (const sx of [-1, 1]) {
    for (const cx of [0.08, 0.18]) {
      const m = lathe(gp, [[0, 0], [0.008, 0.003], [0.009, 0.012], [0.006, 0.015], [0.008, 0.02], [0.005, 0.023], [0.0025, 0.03], [0, 0.031]], '#4a4a3e', sx * cx, ty, fz, 10);
      bronze(m, '#4a5048');
    }
    // bronze crane on a stand
    bronze(add(gp, g('rich:sph7', () => new THREE.SphereGeometry(1, 7, 4)), mat('#4a5048'), sx * 0.28, ty + 0.022, fz, 0.007, 0.008, 0.012) as THREE.Mesh);
    for (const lx of [-0.003, 0.003]) rod(gp, [sx * 0.28 + lx, ty, fz], [sx * 0.28 + lx, ty + 0.018, fz], 0.0012, '#4a5048', 3);
    rod(gp, [sx * 0.28, ty + 0.026, fz + 0.008], [sx * 0.28, ty + 0.045, fz + 0.012], 0.0015, '#4a5048', 3);
  }
  tbox(gp, 0.03, 0.03, 0.026, 0.026, 0.035, '#d8d0be', -0.34, ty, fz);
  cyl(gp, '#d8d0be', -0.34, ty + 0.04, fz, 0.024, 0.004, 14).rotation.x = -0.7;
  tbox(gp, 0.03, 0.03, 0.026, 0.026, 0.03, '#d8d0be', 0.34, ty, fz);
  rbox(gp, '#4a5048', 0.34, ty + 0.03, fz, 0.02, 0.016, 0.02, 0.003);
  roof(gp, 0.34, ty + 0.046, fz, 0.022, 0.022, 0.016, tile, { kind: 'pyramid', ov: 0.006, lift: 0.2 });
  // the paved court and a pair of guards at the foot of the stairs
  box(gp, '#cfc6b0', 0, 0, 0.42, 0.9, 0.002, 0.1);
  for (const sx of [-1, 1]) {
    const f = figure(gp, { h: 0.1, x: sx * 0.08, y: 0, z: 0.42, top: '#7f1d1d', accent: '#d6a840', hat: 'doumou', hatColor: '#3a3a3a', outfit: 'robe', armR: { fwd: 0.4, bend: 0.4 } });
    rod(gp, [f.handR[0], 0.01, f.handR[2]], [f.handR[0], 0.15, f.handR[2]], 0.002, P.darkwood, 3);
  }
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

const temple: Builder = (gp, r) => {
  // Chinese Buddhist monastery on the 伽蓝七堂 axis (cf. 白马寺, 少林寺 in their Ming–Qing form): red enclosure wall with a
  // three-arched 山门, bell and drum towers (钟楼 / 鼓楼) left and right, a bronze incense burner smoking in the court,
  // the 大雄宝殿 on a stone terrace under a grey-tile 歇山 roof with a gilded Buddha visible through the open doors,
  // old cypresses and monks in ochre and grey. r.style 'grotto': a Yungang / Longmen cliff with a colossal seated
  // Buddha in an open niche and rows of small niches; 'tibet': a Lhasa monastery (大昭寺 / 布达拉宫) with whitewashed
  // battered walls, black-framed windows, a red 边玛 frieze, gilded roofs and prayer flags.
  const style = str(r.style, '');
  if (style === 'grotto') {
    const rock = '#b39a74', dk = '#8a7458';
    ground(gp, 0.47, '#8a7a5a');
    // the cliff: a ragged sandstone wall facing +z
    const cl: V3[][] = [];
    for (let j = 0; j <= 6; j++) {
      const v = j / 6, row: V3[] = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, x = -0.46 + u * 0.92;
        const top = 0.5 + Math.sin(u * 7.3) * 0.04 + hash3(i, 3, 1) * 0.03;
        row.push([x, 0.03 + v * top, -0.08 - v * 0.08 + hash3(i, j, 5) * 0.012 * Math.sin(v * Math.PI) - 0.02 * Math.sin(u * 9)]);
      }
      cl.push(row);
    }
    cl.push(cl[6].map(([x, y]) => [x, y, -0.36] as V3));
    cl.push(cl[0].map(([x]) => [x, 0.03, -0.36] as V3));
    skin(gp, cl, rock, { closed: false, flat: true, paint: (_x, y, _z, _nx, ny) => (ny > 0.6 ? '#9a8a5a' : Math.floor(y * 40) % 3 === 0 ? dk : null) });
    // colossal seated Buddha (cf. Yungang cave 20, 13.7 m) in an open arched niche, with mandorla and flame halo
    const N = grp(gp, 0, -0.1, 0, 0.03);
    slab(N, archLine(0.36, 0.2, 10), 0.01, '#5a4a38', 0, false).position.z = 0.0;
    slab(N, [[-0.14, 0.02], [0.14, 0.02], [0.15, 0.2], [0.1, 0.33], [0, 0.39], [-0.1, 0.33], [-0.15, 0.2]], 0.006, '#a08a66', 0, true).position.z = 0.012;
    slab(N, [[-0.07, 0.24], [0.07, 0.24], [0.08, 0.32], [0, 0.37], [-0.08, 0.32]], 0.004, '#8a6e52', 0, true).position.z = 0.019;
    // the Buddha: crossed legs, robe draped over the left shoulder (袒右肩), hands in dhyāna mudrā, long ears, uṣṇīṣa
    const stoneB = '#b8a07a', robeB = '#a88e68';
    const lg = ellip(N, robeB, 0, 0.045, 0.06, 0.14, 0.045, 0.085);
    lg.scale.y = 0.04;
    lathe(N, [[0, 0], [0.085, 0], [0.09, 0.05], [0.095, 0.11], [0.085, 0.15], [0.05, 0.168], [0.022, 0.172], [0, 0.172]], robeB, 0, 0.05, 0.05, 16).scale.z = 0.62;
    const sash = box(N, shade(robeB, 0.85), -0.02, 0.06, 0.106, 0.02, 0.15, 0.006);
    sash.rotation.z = -0.55;
    for (const sx of [-1, 1]) tube(N, [[sx * 0.085, 0.18, 0.05], [sx * 0.1, 0.12, 0.07], [sx * 0.05, 0.085, 0.1]], 0.022, 0.016, sx < 0 ? robeB : stoneB, { radial: 8, sub: 4 });
    ellip(N, stoneB, 0, 0.085, 0.105, 0.045, 0.014, 0.024);
    cyl(N, stoneB, 0, 0.215, 0.05, 0.02, 0.025, 10);
    ellip(N, stoneB, 0, 0.27, 0.055, 0.04, 0.05, 0.042);
    ellip(N, shade(stoneB, 0.85), 0, 0.318, 0.05, 0.026, 0.02, 0.025);
    for (const sx of [-1, 1]) ellip(N, stoneB, sx * 0.042, 0.255, 0.05, 0.007, 0.028, 0.01);
    for (const sx of [-1, 1]) box(N, '#6a5640', sx * 0.015, 0.275, 0.094, 0.016, 0.0025, 0.002);
    box(N, '#6a5640', 0, 0.247, 0.095, 0.014, 0.002, 0.002);
    // rows of small niches with seated Buddhas either side, and two cave mouths with lintel windows
    for (const sx of [-1, 1]) for (let row = 0; row < 3; row++) for (let k = 0; k < 3; k++) {
      const x = sx * (0.24 + k * 0.065), y = 0.1 + row * 0.12, z = -0.1 - row * 0.03 - 0.015 * Math.sin(x * 9) + 0.012;
      const M = grp(gp, x, z, 0, y);
      slab(M, archLine(0.04, 0.035, 6), 0.004, '#6a5640', 0, false);
      ellip(M, '#a8906c', 0, 0.015, 0.004, 0.012, 0.012, 0.006);
      ellip(M, '#a8906c', 0, 0.035, 0.004, 0.007, 0.008, 0.005);
    }
    // a pilgrim and two monks below
    for (let k = 0; k < 3; k++) figure(gp, { h: 0.1, x: -0.1 + k * 0.1, z: 0.25 + (k % 2) * 0.05, ry: Math.PI + (k - 1) * 0.3, top: k === 1 ? '#3f5f7a' : '#a8642a', accent: k === 1 ? '#2a2420' : '#7a3a1a', hair: k === 1 ? '#1c1714' : undefined, hairStyle: k === 1 ? 'topknot' : 'bald', outfit: 'robe', wideSleeves: true, armL: { fwd: 0.8, bend: 1.4, inward: 0.6 }, armR: { fwd: 0.8, bend: 1.4, inward: 0.6 } });
    return;
  }
  if (style === 'tibet') {
    const white = '#ece6d8', red = '#7a2a22', gold = '#d6a840';
    ground(gp, 0.47, '#9a8a62');
    const block = (x: number, z: number, w: number, d: number, y0: number, h: number, c: string) => {
      tbox(gp, w, d, w - h * 0.16, d - h * 0.16, h, c, x, y0, z);
      return y0 + h;
    };
    const win = (x: number, y: number, z: number, s: number) => {
      // trapezoid window: black frame (wider at the bottom) with a small red awning
      slab(grp(gp, x, z, 0, y), [[-s * 0.75, 0], [s * 0.75, 0], [s * 0.5, s * 1.3], [-s * 0.5, s * 1.3]], 0.003, '#1c1a18', 0, false);
      box(gp, '#5a3a2a', x, y + s * 0.15, z + 0.002, s * 0.7, s * 1.0, 0.002);
      box(gp, red, x, y + s * 1.35, z + 0.003, s * 1.2, s * 0.15, 0.008);
    };
    // the lower white palace on its rock: a battered whitewashed mass with rows of windows and zigzag stairs
    lathe(gp, [[0, 0], [0.46, 0], [0.44, 0.03], [0.4, 0.045], [0, 0.05]], '#8a7a62', 0, 0, -0.04, 20).scale.z = 0.75;
    const y1 = block(0, -0.05, 0.8, 0.5, 0.03, 0.18, white);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const st = box(gp, '#c9c0ae', sx * (0.22 + (k % 2) * 0.12) - sx * 0.06, 0.035 + k * 0.05, 0.2 - (0.035 + k * 0.05) * 0.08 + 0.006, 0.15, 0.008, 0.008);
      st.rotation.z = (k % 2 ? 1 : -1) * sx * 0.32;
    }
    for (let i = 0; i < 9; i++) for (let k = 0; k < 2; k++) win(-0.32 + i * 0.08, 0.06 + k * 0.08, 0.2 - (0.06 + k * 0.08) * 0.08 + 0.003, 0.016);
    // central red hall with the 边玛 frieze (brown tamarisk band with gilt mirrors) and gilded roofs
    const y2 = block(0, -0.12, 0.42, 0.28, y1, 0.14, red);
    box(gp, '#4a2a1e', 0, y2 - 0.035, -0.12, 0.42 - 0.14 * 0.16 + 0.004, 0.03, 0.28 - 0.14 * 0.16 + 0.004);
    for (let i = 0; i < 6; i++) ellip(gp, gold, -0.15 + i * 0.06, y2 - 0.02, -0.12 + 0.13, 0.008, 0.008, 0.002);
    for (let i = 0; i < 5; i++) win(-0.14 + i * 0.07, y1 + 0.03, -0.12 + 0.14 - 0.006, 0.014);
    for (const sx of [-1, 1]) {
      const y3 = block(sx * 0.3, -0.04, 0.16, 0.18, y1, 0.1, white);
      box(gp, '#4a2a1e', sx * 0.3, y3 - 0.025, -0.04, 0.16 - 0.016 + 0.004, 0.022, 0.18 - 0.016 + 0.004);
      win(sx * 0.3, y1 + 0.03, -0.04 + 0.09 - 0.008, 0.014);
    }
    // gilt 金顶 pavilions and the Dharma wheel with deer
    for (const gx of [-0.1, 0.1]) {
      box(gp, red, gx, y2, -0.16, 0.07, 0.025, 0.07);
      roof(gp, gx, y2 + 0.025, -0.16, 0.07, 0.07, 0.04, gold, { kind: 'hip', ov: 0.02, lift: 0.5, ridge: '#e8c05a' });
      lathe(gp, [[0, 0], [0.008, 0], [0.006, 0.02], [0.01, 0.024], [0, 0.04]], gold, gx, y2 + 0.07, -0.16, 8);
    }
    const wy = y2;
    add(gp, g('rich:ring', () => new THREE.TorusGeometry(1, 0.14, 5, 12)), mat(gold, { metal: 0.6 }), 0, wy + 0.028, 0.0, 0.022, 0.022, 0.022);
    for (const sx of [-1, 1]) ellip(gp, gold, sx * 0.035, wy + 0.01, 0.0, 0.012, 0.01, 0.006);
    for (const sx of [-1, 1]) { rod(gp, [sx * 0.2, y1, 0.0], [sx * 0.2, y1 + 0.09, 0.0], 0.006, '#2a2420', 5); ellip(gp, '#2a2420', sx * 0.2, y1 + 0.08, 0.0, 0.012, 0.03, 0.012); }
    // prayer-flag lines (wind horse colours) and pilgrims
    const cols = ['#2f5fae', '#ece6d8', '#b91c1c', '#3f8a4a', '#e0b23a'];
    for (const sx of [-1, 1]) {
      rod(gp, [sx * 0.42, 0.03, 0.3], [sx * 0.42, 0.33, 0.3], 0.004, P.darkwood, 4);
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9, x = sx * 0.42 - sx * t * 0.2, y = 0.33 - t * 0.12 - Math.sin(t * Math.PI) * 0.02;
        box(gp, cols[i % 5], x, y - 0.025, 0.3, 0.018, 0.025, 0.002);
      }
      rod(gp, [sx * 0.42, 0.33, 0.3], [sx * 0.22, y1 + 0.02, 0.24 - 0.06], 0.001, '#3a3128', 3);
    }
    for (let k = 0; k < 3; k++) figure(gp, { h: 0.1, x: -0.1 + k * 0.1, z: 0.33, ry: Math.PI, top: k === 1 ? '#7a2a22' : '#4a3a2a', accent: '#d6a840', hair: k === 1 ? undefined : '#1c1714', hairStyle: k === 1 ? 'bald' : 'long', outfit: 'robe', armR: { fwd: 0.6, bend: 0.8 } });
    return;
  }
  ground(gp, 0.47, '#a99a7a');
  const tile = '#4e5157', redW = '#9a3326';
  box(gp, '#cbc1a6', 0, 0.03, 0, 0.84, 0.002, 0.84);
  // enclosure wall with tiled coping, opening at the gate
  for (const [x, z, w, d] of [[0, -0.42, 0.86, 0.022], [-0.42, 0, 0.022, 0.84], [0.42, 0, 0.022, 0.84], [-0.29, 0.42, 0.28, 0.022], [0.29, 0.42, 0.28, 0.022]] as const) {
    box(gp, redW, x, 0.03, z, w, 0.06, d);
    box(gp, tile, x, 0.09, z, w + 0.01, 0.008, d + 0.012);
  }
  // 山门: a brick gate hall with three arched doorways under a hip roof
  box(gp, redW, 0, 0.03, 0.41, 0.3, 0.11, 0.07);
  for (const ax of [-0.09, 0, 0.09]) slab(grp(gp, ax, 0.4455, 0, 0.03), archLine(ax === 0 ? 0.045 : 0.035, ax === 0 ? 0.04 : 0.032), 0.003, '#2a1a14', 0, false);
  box(gp, '#2a2a2a', 0, 0.115, 0.4455, 0.06, 0.016, 0.003);
  box(gp, '#d6a840', 0, 0.118, 0.447, 0.048, 0.01, 0.002);
  roof(gp, 0, 0.14, 0.41, 0.3, 0.07, 0.05, tile, { kind: 'xieshan', ov: 0.03, lift: 0.4 });
  // bell tower (east, left of the axis as one enters) and drum tower: brick base, open timber upper storey
  for (const sx of [-1, 1]) {
    const tx = sx * 0.28, tz = 0.17;
    tbox(gp, 0.11, 0.11, 0.1, 0.1, 0.08, '#8a867d', tx, 0.03, tz);
    slab(grp(gp, tx, tz + 0.05, 0, 0.03), archLine(0.03, 0.03), 0.003, '#2a1a14', 0, false);
    const e = hallBody(gp, tx, 0.11, tz, 0.08, 0.08, 0.055, 3, { open: true, wall: '#9a3326', beam: '#2f5f5a' });
    roof(gp, tx, e, tz, 0.08, 0.08, 0.045, tile, { kind: 'xieshan', ov: 0.025, lift: 0.45 });
    if (sx < 0) { const bm = lathe(gp, [[0, 0.03], [0.014, 0.025], [0.017, 0], [0.019, -0.003], [0, -0.003]], '#4a5048', tx, 0.13, tz, 10); bronze(bm, '#4a5048'); }
    else { const dm = cyl(gp, '#8a2e1e', tx, 0.15, tz - 0.015, 0.018, 0.03, 12); dm.rotation.x = Math.PI / 2; }
  }
  // main hall (大雄宝殿) on a stone terrace
  const zc = -0.2;
  tbox(gp, 0.48, 0.28, 0.46, 0.26, 0.05, '#c8bfaa', 0, 0.03, zc);
  for (let i = 0; i < 4; i++) box(gp, '#bdb4a2', 0, 0.03 + i * 0.0125, zc + 0.14 + 0.04 - i * 0.012, 0.12, 0.0125, 0.012);
  const e = hallBody(gp, 0, 0.08, zc, 0.4, 0.2, 0.1, 5, { col: '#a8352a', wall: redW, door: '#a8452a', beam: '#2f6f6a' });
  // a gilded Buddha glimpsed through the opened central doors
  box(gp, '#1e1612', 0, 0.08, zc + 0.1 - 0.035 + 0.003, 0.06, 0.084, 0.002);
  ellip(gp, '#d6a840', 0, 0.105, zc + 0.065, 0.016, 0.022, 0.008);
  ellip(gp, '#d6a840', 0, 0.135, zc + 0.065, 0.009, 0.01, 0.006);
  roof(gp, 0, e, zc, 0.4, 0.2, 0.1, tile, { kind: 'xieshan', ov: 0.05, lift: 0.45 });
  box(gp, '#1f3f3a', 0, e - 0.03, zc + 0.111, 0.05, 0.02, 0.003);
  // incense burner (香炉) with smoke, cypresses, monks and a lay worshipper
  const ib = lathe(gp, [[0, 0], [0.011, 0], [0.008, 0.012], [0.016, 0.015], [0.017, 0.03], [0.013, 0.034], [0, 0.034]], '#4a5048', 0, 0.03, 0.04, 12);
  bronze(ib, '#4a5048');
  for (const sx of [-1, 1]) rod(gp, [sx * 0.007, 0.064, 0.04], [sx * 0.007, 0.07, 0.04], 0.0015, '#4a5048', 3);
  roof(gp, 0, 0.07, 0.04, 0.018, 0.018, 0.02, '#4a5048', { kind: 'pyramid', ov: 0.006, lift: 0.4 });
  const sm = anim(gp, 'smoke', 0, 0.11, 0.04, { size: 0.02 });
  for (let i = 0; i < 5; i++) add(sm, g('rich:ico', () => new THREE.IcosahedronGeometry(1, 0)), mat('#d6d0c4', { transparent: 0.5 }), 0, 0, 0, 0.01, 0.01, 0.01);
  for (const [x, z] of [[-0.33, -0.08], [0.33, -0.08], [-0.33, -0.33], [0.33, -0.33]] as const) {
    cyl(gp, '#5b4030', x, 0.03, z, 0.006, 0.06, 5);
    for (let k = 0; k < 3; k++) ellip(gp, k % 2 ? '#2f4a2a' : '#35502e', x + (k - 1) * 0.008, 0.09 + k * 0.035, z, 0.035 - k * 0.008, 0.03, 0.035 - k * 0.008);
  }
  for (let i = 0; i < 4; i++) {
    const monk = i !== 2;
    figure(gp, { h: 0.1, x: -0.12 + i * 0.08, y: 0.03, z: 0.18 - (i % 2) * 0.05, ry: Math.PI + (i - 1.5) * 0.4, top: monk ? (i % 2 ? '#a8642a' : '#6a6a64') : '#3f5f7a', accent: monk ? '#7a3a1a' : '#2a2420', hair: monk ? undefined : '#1c1714', hairStyle: monk ? 'bald' : 'topknot', outfit: 'robe', wideSleeves: true, armL: { fwd: 0.8, bend: 1.4, inward: 0.6 }, armR: { fwd: 0.8, bend: 1.4, inward: 0.6 } });
  }
};

/**
 * A Zhou bronze bell hanging from (x, y, z): `yong` 甬钟 with a long shank, hung obliquely, or `niu` 钮钟 with a loop,
 * hung straight. Almond (合瓦形) section with pointed edges (铣), an upward-arched mouth (于) and a boss panel (枚) on
 * each face either side of the plain central strip (钲). Body height Hb; faces ±z, edges ±x.
 */
function zhong(p: THREE.Object3D, x: number, y: number, z: number, Hb: number, type: 'yong' | 'niu' | 'bo', o: { ry?: number; tilt?: number } = {}): void {
  const G = grp(p, x, z, o.ry ?? 0, y);
  G.rotation.order = 'YXZ';
  G.rotation.x = o.tilt ?? 0;
  const c = '#5d6b50', boss = '#7a8a64', inner = '#232a20';
  const shank = type === 'yong' ? Hb * 0.45 : Hb * 0.16, bot = -shank - Hb;
  const Wm = Hb * (type === 'bo' ? 0.78 : 0.66), Dm = Hb * (type === 'bo' ? 0.6 : 0.44), N = 16;
  const rings: V3[][] = [];
  for (const v of [0, 0.12, 0.35, 0.6, 0.85, 1]) {
    const W = Wm * (1 - 0.3 * v), Dd = Dm * (1 - 0.22 * v), ring: V3[] = [];
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2, s = Math.sin(a), cc = Math.cos(a);
      const arch = type === 'bo' ? 0 : Hb * 0.13 * s * s * Math.max(0, 1 - v / 0.3);
      const zz = type === 'bo' ? (Dd / 2) * s : (Dd / 2) * Math.sign(s) * Math.pow(Math.abs(s), 1.4);
      ring.push([(W / 2) * cc, bot + v * Hb + arch, zz]);
    }
    rings.push(ring);
  }
  skin(G, rings, c, {
    caps: true, flat: true, metal: 0.5, rough: 0.5,
    paint: (px, py, _pz, _nx, ny) => {
      if (ny < -0.5) return inner;
      const v = (py - bot) / Hb;
      return type !== 'bo' && v > 0.42 && v < 0.95 && Math.abs(px) > Wm * 0.12 && Math.abs(px) < Wm * 0.36 ? boss : null;
    },
  });
  if (type === 'yong') {
    bronze(lathe(G, [[0, 0], [Hb * 0.075, 0], [Hb * 0.06, shank * 0.9], [Hb * 0.07, shank], [0, shank]], c, 0, -shank, 0, 8));
    bronze(cyl(G, boss, 0, -shank * 0.45, 0, Hb * 0.08, Math.max(0.004, Hb * 0.05), 8), boss);
  } else {
    const ring = add(G, g('rich:loop', () => new THREE.TorusGeometry(1, 0.28, 5, 10, Math.PI)), mat(c, { metal: 0.5, rough: 0.5 }), 0, -shank, 0, Hb * 0.16, shank, Hb * 0.16);
    ring.rotation.y = 0;
    if (type === 'bo') for (const s of [-1, 1]) bronze(ellip(G, boss, s * Hb * 0.16, -shank * 0.4, 0, Hb * 0.08, shank * 0.5, Hb * 0.06, 0, 0, s * 0.6), boss);
  }
  // bosses (枚) on the big bells: 3 rows × 3 on each panel, front and back
  if (Hb > 0.1) for (const fz of [-1, 1]) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const v = 0.5 + i * 0.16, W = Wm * (1 - 0.3 * v), Dd = Dm * (1 - 0.22 * v), px = sx * W * (0.2 + j * 0.075);
    const zz = (Dd / 2) * Math.pow(Math.max(0, 1 - (px / (W / 2)) ** 2), 0.7);
    const b = cone(G, boss, px, bot + v * Hb, fz * zz, Hb * 0.035, Hb * 0.06, 5);
    b.rotation.x = fz * Math.PI / 2;
  }
}

const bell: Builder = gp => {
  // 曾侯乙编钟 (Marquis Yi of Zeng, 433 BC; Hubei Provincial Museum): an L-shaped rack 7.48 m × 3.35 m, 2.73 m high, of
  // black-lacquered beams painted in red with bronze end sleeves, the lower and middle beams held up by six bronze
  // sword-bearing caryatids (1.17 m and 0.57 m). 65 bells: 19 niuzhong on top, 33 yongzhong in the middle, 12 large
  // yongzhong and the Chu king's bo below. Players strike them with T-shaped mallets and long poles. ≈0.11 units/m.
  const y0 = figureBase(gp, '#7d6a50', '#4a3a2a');
  const lac = '#1d1814', red = '#a8352a', brz = '#6a6a48';
  const xl = -0.4, xr = 0.42, zb = -0.15, zf = 0.23;
  const yL = y0 + 0.17, yM = y0 + 0.245, yT = y0 + 0.305;
  // a lacquered beam from a to b with painted bands and bronze end sleeves
  const beam = (a: [number, number], b: [number, number], yy: number, s: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const G = grp(gp, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ry, yy);
    box(G, lac, 0, 0, 0, len, s, s * 1.1);
    for (let k = 1; k < Math.floor(len / 0.05); k++) for (const fz of [-1, 1]) box(G, red, -len / 2 + k * 0.05, s * 0.25, fz * s * 0.56, 0.02, s * 0.5, 0.002);
    for (const e of [-1, 1]) bronze(rbox(G, brz, e * (len / 2 - 0.012), -s * 0.08, 0, 0.032, s * 1.16, s * 1.26, 0.003), brz);
  };
  // bronze caryatid: a sword-bearing warrior in a long robe on a drum base, both arms raised to the beam
  const caryatid = (x: number, z: number, yy: number, h: number, ry: number) => {
    bronze(lathe(gp, [[0, 0], [h * 0.26, 0], [h * 0.24, h * 0.12], [h * 0.12, h * 0.18], [0, h * 0.18]], brz, x, yy, z, 12), brz);
    const r = human(gp, x, yy + h * 0.16, z, { h, ry, pose: 'stand', top: brz, bottom: brz, skin: brz, hair: brz, hat: brz, hatStyle: 'cap', shoes: brz, dress: 'ankle', detail: 'lo', build: 1.15, hands: [[-0.1, 1.08, 0.0], [0.1, 1.08, 0.0]] });
    r.group.traverse(o => { if ((o as THREE.Mesh).isMesh) bronze(o as THREE.Mesh, brz); });
    rod(gp, [x + Math.cos(ry) * h * 0.1, yy + h * 0.66, z - Math.sin(ry) * h * 0.1], [x + Math.cos(ry) * h * 0.14, yy + h * 0.3, z - Math.sin(ry) * h * 0.1 + h * 0.02], Math.max(0.003, h * 0.02), brz, 4);
  };
  // lower tier: caryatids at the corner and both ends, a bronze column mid-way along the long side
  caryatid(xl, zb, y0, 0.122, 0);
  caryatid(xr - 0.02, zb, y0, 0.122, 0);
  caryatid(xl, zf - 0.02, y0, 0.122, Math.PI / 2);
  bronze(cyl(gp, brz, 0.087, y0, zb, 0.012, 0.17, 10), brz);
  beam([xl - 0.02, zb], [xr + 0.02, zb], yL, 0.026);
  beam([xl, zb - 0.02], [xl, zf + 0.02], yL + 0.002, 0.026);
  // middle tier: small caryatids standing on the lower beams
  caryatid(xl, zb, yL + 0.026, 0.05, 0);
  caryatid(xr - 0.02, zb, yL + 0.026, 0.05, 0);
  caryatid(xl, zf - 0.02, yL + 0.026, 0.05, Math.PI / 2);
  beam([xl - 0.02, zb], [xr + 0.02, zb], yM, 0.022);
  beam([xl, zb - 0.02], [xl, zf + 0.02], yM + 0.002, 0.022);
  // top tier: three short beams on round posts
  for (const [a, b] of [[[xl, zb + 0.02], [xl, zf]], [[xl + 0.03, zb], [-0.08, zb]], [[-0.04, zb], [0.24, zb]]] as [number, number][][]) {
    for (const e of [a, b]) cyl(gp, lac, e[0], yM + 0.022, e[1], 0.008, yT - yM - 0.022, 8);
    beam(a, b, yT, 0.016);
  }
  // bells: big yongzhong + the bo (centre) on the lower tier, graded yongzhong in the middle, niuzhong on top
  // place a graded row of bells along +x (long side) or +z (short side) from `s`, spaced by their widths
  const row = (sizes: number[], type: 'yong' | 'niu', yy: number, s: number, along: 'x' | 'z', gap: number, tilt = 0) => {
    let u = s;
    for (const hb of sizes) {
      const w = hb * 0.66;
      u += w / 2;
      if (along === 'x') zhong(gp, u, yy, zb + 0.016, hb, type, { tilt }); else zhong(gp, xl + 0.016, yy, u, hb, type, { ry: Math.PI / 2, tilt });
      u += w / 2 + gap;
    }
  };
  const grade = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => a + (b - a) * (i / Math.max(1, n - 1)));
  row(grade(3, 0.16, 0.14), 'yong', yL, xl + 0.04, 'x', 0.012, -0.3);
  zhong(gp, 0.032, yL, zb + 0.012, 0.12, 'bo');
  row(grade(3, 0.13, 0.11), 'yong', yL, 0.1, 'x', 0.012, -0.3);
  row(grade(3, 0.15, 0.13), 'yong', yL, zb + 0.04, 'z', 0.006, -0.3);
  row(grade(10, 0.072, 0.05), 'yong', yM, xl + 0.035, 'x', 0.004, -0.28);
  row(grade(9, 0.05, 0.034), 'yong', yM, 0.09, 'x', 0.004, -0.28);
  row(grade(9, 0.065, 0.045), 'yong', yM, zb + 0.035, 'z', 0.004, -0.28);
  row(grade(7, 0.046, 0.03), 'niu', yT, zb + 0.04, 'z', 0.012);
  row(grade(6, 0.042, 0.03), 'niu', yT, xl + 0.04, 'x', 0.012);
  row(grade(6, 0.036, 0.026), 'niu', yT, -0.03, 'x', 0.012);
  // musicians in Warring States robes: a T-mallet on the middle tier, a long pole for the big bells
  const a = figure(gp, { h: 0.18, x: 0.2, y: y0, z: 0.05, ry: Math.PI + 0.25, top: '#5a2a20', accent: '#1c1714', hairStyle: 'topknot', hat: 'none', outfit: 'robe', wideSleeves: true, armR: { fwd: 1.5, bend: 0.6 }, armL: { fwd: 0.4, bend: 0.3 }, stance: 'stand' });
  rod(gp, a.handR, [a.handR[0] + 0.01, a.handR[1] + 0.012, a.handR[2] - 0.05], 0.003, P.darkwood, 4);
  rod(gp, [a.handR[0] - 0.012, a.handR[1] + 0.012, a.handR[2] - 0.05], [a.handR[0] + 0.03, a.handR[1] + 0.012, a.handR[2] - 0.05], 0.006, P.darkwood, 6);
  const b = figure(gp, { h: 0.18, x: -0.16, y: y0, z: 0.12, ry: Math.PI - 0.4, top: '#3a2a22', accent: '#8a2e22', hairStyle: 'topknot', hat: 'none', outfit: 'robe', wideSleeves: true, armR: { fwd: 1.0, bend: 0.5 }, armL: { fwd: 1.0, bend: 0.5 }, stance: 'wide' });
  rod(gp, [b.handR[0] + 0.05, b.handR[1] + 0.01, b.handR[2] + 0.08], [b.handR[0] - 0.08, b.handR[1] - 0.03, b.handR[2] - 0.16], 0.005, '#7a5a3a', 5);
};

const ding: Builder = gp => {
  // 后母戊鼎 (late Shang, National Museum of China): 133 cm tall, mouth 110×79 cm, 832.84 kg. Rectangular body with a
  // plain central field framed by taotie / kui-dragon bands on a cloud-and-thunder ground, flanges on the corners and
  // centre lines, two upright ears on the short sides (tigers flanking a human head), four hollow columnar legs with
  // beast masks and raised string bands; dark green-grey patina. Scale ≈ 0.48 units per metre, on a museum plinth.
  const y0 = figureBase(gp, '#a49e92', '#4e4a45');
  const c = '#56654f', hi = '#6a7b62', lo = '#3a4535';
  const W = 0.53, D = 0.38, legH = 0.22, bodyH = 0.27, yb = y0 + legH, yr = yb + bodyH;
  const B = (m: THREE.Mesh, col = c) => bronze(m, col);
  // legs: hollow bronze columns, beast mask on the outer face of the top and two string bands lower down
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (W / 2 - 0.075), lz = sz * (D / 2 - 0.07);
    B(lathe(gp, [[0, 0], [0.05, 0], [0.047, 0.03], [0.045, 0.12], [0.05, legH - 0.02], [0.056, legH + 0.02], [0, legH + 0.02]], c, lx, y0, lz, 16));
    for (const by of [0.07, 0.1]) B(cyl(gp, hi, lx, y0 + by, lz, 0.049, 0.008, 16), hi);
    const ox = lx + sx * 0.03, oz = lz + sz * 0.03;
    const face = grp(gp, ox, oz, Math.atan2(sx, sz), y0 + legH - 0.07);
    B(box(face, hi, 0, 0, 0.022, 0.012, 0.075, 0.016), hi);
    for (const ex of [-1, 1]) {
      B(ellip(face, hi, ex * 0.022, 0.045, 0.026, 0.01, 0.008, 0.006), hi);
      B(ellip(face, lo, ex * 0.022, 0.045, 0.031, 0.006, 0.005, 0.003), lo);
      B(box(face, hi, ex * 0.028, 0.012, 0.022, 0.016, 0.008, 0.008, 0, 0, ex * 0.5), hi);
    }
  }
  // body: straight-walled rectangular basin with a thickened, everted rim; dark interior
  B(rbox(gp, c, 0, yb, 0, W, bodyH, D, 0.008));
  B(rbox(gp, c, 0, yr - 0.004, 0, W + 0.02, 0.022, D + 0.02, 0.004));
  box(gp, '#1f241d', 0, yr + 0.014, 0, W - 0.04, 0.004, D - 0.04);
  // décor bands framing the plain centre on every face (raised relief: kui dragons in pairs meeting at a flange = taotie)
  const faces: [number, number, number, number][] = [[0, D / 2, 0, W], [0, -D / 2, Math.PI, W], [W / 2, 0, Math.PI / 2, D], [-W / 2, 0, -Math.PI / 2, D]];
  for (const [fx, fz, ry, span] of faces) {
    const F = grp(gp, fx, fz, ry, yb);
    const bw = 0.05, top = bodyH - 0.06;
    for (const [bx, by, sw, sh] of [[0, top, span - 0.03, 0.05], [0, 0.015, span - 0.03, 0.035], [-(span / 2 - 0.015 - bw / 2), 0.05, bw, top - 0.05], [span / 2 - 0.015 - bw / 2, 0.05, bw, top - 0.05]] as const) {
      B(box(F, lo, bx, by, 0.002, sw, sh, 0.006), lo);
      // cloud-and-thunder ground: a lattice of small raised squares
      const nx = Math.max(1, Math.floor(sw / 0.0135)), ny = Math.max(1, Math.floor(sh / 0.0135));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if ((i + j) % 2 === 0) B(box(F, hi, bx - sw / 2 + (i + 0.5) * (sw / nx), by + j * (sh / ny) + 0.003, 0.006, Math.max(0.006, sw / nx * 0.6), Math.max(0.006, sh / ny * 0.55), 0.004), hi);
    }
    // taotie mask in the top band: centre flange with a pair of bulging eyes and horns either side
    B(box(F, hi, 0, top - 0.004, 0.008, 0.012, 0.058, 0.014), hi);
    for (const ex of [-1, 1]) {
      B(ellip(F, hi, ex * 0.04, top + 0.024, 0.01, 0.012, 0.01, 0.007), hi);
      B(ellip(F, lo, ex * 0.04, top + 0.024, 0.016, 0.006, 0.005, 0.003), lo);
      B(box(F, hi, ex * 0.075, top + 0.03, 0.008, 0.05, 0.01, 0.006, 0, 0, ex * 0.25), hi);
    }
    // corner flanges (扉棱) with notched profile
    for (const ex of [-1, 1]) for (let k = 0; k < 4; k++) B(box(F, hi, ex * (span / 2 + 0.002), 0.02 + k * 0.06, 0.004, 0.01, 0.045, 0.012), hi);
  }
  // two upright ears on the short sides, outer faces with tigers flanking a human head
  for (const sx of [-1, 1]) {
    const E = grp(gp, sx * (W / 2 - 0.012), 0, sx > 0 ? 0 : Math.PI, yr + 0.016);
    for (const ez of [-1, 1]) B(box(E, c, 0, 0, ez * 0.085, 0.034, 0.15, 0.032));
    B(box(E, c, 0, 0.122, 0, 0.034, 0.03, 0.2));
    B(box(E, hi, 0.018, 0.124, 0, 0.004, 0.022, 0.16), hi);
    for (const ez of [-1, 1]) {
      B(ellip(E, hi, 0.019, 0.07, ez * 0.085, 0.006, 0.05, 0.012, 0, 0, 0), hi);
      B(ellip(E, hi, 0.019, 0.122, ez * 0.05, 0.006, 0.012, 0.03), hi);
    }
    B(ellip(E, hi, 0.02, 0.132, 0, 0.008, 0.016, 0.014), hi);
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

const printing: Builder = (gp, r) => {
  // Default: a Tang–Five Dynasties woodblock printing shop (雕版印刷: the 868 Diamond Sutra, 冯道's Nine Classics,
  // 932–953). A pear-wood block (梨木版) with the text cut in mirror-image relief lies on a low table; the kneeling printer
  // has inked it with a round brush, laid a sheet over it and rubs the back with a palm-fibre pad (棕擦); a carver
  // cuts the next block at a second table, printed sheets dry on a line and finished blocks stand in a rack.
  // r.style 'movable': 毕昇's clay movable type (c. 1040, 沈括《梦溪笔谈》): single fired-clay sorts set in an iron
  // forme (铁范) on an iron plate coated with pine resin, wax and paper ash, warmed over a brazier to fix them; a second
  // plate being set; sorts kept in labelled wooden cases ordered by rhyme (以韵为次). r.style 'press': a 1910s
  // Shanghai print shop (《新青年》, 1915) — a cast-iron Albion-type hand press, a sloping type case and bundled
  // magazines.
  const style = str(r.style, '');
  const floor = ground(gp, 0.45, style === 'press' ? '#8a8378' : '#9a8a6c');
  const wood = '#5a3e2a', pear = '#c9a06a', ink = '#1e1a17', paper = '#efe6cf', skin = '#c99a72';
  const table = (x: number, z: number, w: number, d: number, h: number, ry = 0) => {
    const T = grp(gp, x, z, ry, floor);
    box(T, wood, 0, h - 0.008, 0, w, 0.008, d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(T, shade(wood, 0.85), sx * (w / 2 - 0.008), 0, sz * (d / 2 - 0.008), 0.008, h - 0.008, 0.008);
    return T;
  };
  /** a sheet with columns of characters */
  const sheet = (p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, cols: number, ry = 0, rx = 0) => {
    const S = grp(p, x, z, ry, y);
    S.rotation.x = rx;
    box(S, paper, 0, 0, 0, w, 0.0015, d);
    for (let k = 0; k < cols; k++) {
      const len = d * (k % 3 === 1 ? 0.55 : 0.8);
      box(S, '#3a3430', -w / 2 + ((k + 0.5) / cols) * w, 0.0015, -d * 0.4 + len / 2, Math.min(0.0018, (w / cols) * 0.3), 0.0006, len);
    }
    return S;
  };
  if (style === 'press') {
    // cast-iron hand press: two cheeks with an arched crown, platen on a screw/toggle, bed on rails with an open tympan
    const iron = '#2c2f33', Pr = grp(gp, -0.04, -0.06, -0.75, floor);
    for (const sz of [-1, 1]) {
      box(Pr, iron, 0, 0, sz * 0.06, 0.03, 0.26, 0.016);
      box(Pr, iron, 0, 0, sz * 0.06, 0.08, 0.02, 0.02);
    }
    slab(grp(Pr, 0, 0, Math.PI / 2, 0.24), [[-0.075, 0], [0.075, 0], [0.06, 0.03], [0.02, 0.05], [-0.02, 0.05], [-0.06, 0.03]], 0.026, iron, 0, true);
    box(Pr, shade(iron, 1.2), 0, 0.14, 0, 0.07, 0.016, 0.11);
    cyl(Pr, '#7a6a3a', 0, 0.156, 0, 0.012, 0.06, 8);
    rod(Pr, [0.015, 0.165, 0.0], [0.035, 0.15, 0.13], 0.005, iron, 5);
    ellip(Pr, '#7a5a3a', 0.036, 0.15, 0.14, 0.009, 0.009, 0.016);
    // carriage rails and bed running out to the right, tympan and frisket hinged up
    for (const sz of [-1, 1]) box(Pr, iron, 0.06, 0.08, sz * 0.045, 0.28, 0.01, 0.01);
    for (const x of [0.17]) for (const sz of [-1, 1]) box(Pr, iron, x, 0, sz * 0.045, 0.012, 0.08, 0.012);
    box(Pr, shade(iron, 1.3), 0.08, 0.09, 0, 0.11, 0.012, 0.1);
    box(Pr, '#3a3a3a', 0.08, 0.102, 0, 0.08, 0.004, 0.07);
    const ty = grp(Pr, 0.135, 0, 0, 0.104);
    ty.rotation.z = 1.15;
    box(ty, '#c9b98a', 0.045, 0, 0, 0.09, 0.004, 0.09);
    rod(Pr, [0.2, 0.1, 0.0], [0.2, 0.1, 0.05], 0.004, iron, 5);
    cyl(Pr, '#5a3e2a', 0.2, 0.1, 0.06, 0.015, 0.004, 10).rotation.x = Math.PI / 2;
    // pressman pulling the bar, compositor at the sloping case
    human(Pr, 0.045, 0, 0.23, { h: 0.2, pose: 'stand', hands: [[-0.04, 0.74, 0.36], [0.06, 0.72, 0.34]], top: '#3a4a5a', bottom: '#2a2a2a', skin, hair: '#1c1714', hatStyle: 'peaked', hat: '#3a3a3a', detail: 'lo', ry: Math.PI + 0.15, sleeve: 0.4 });
    const C = grp(gp, 0.24, -0.2, -0.5, floor);
    for (const sx of [-1, 1]) box(C, wood, sx * 0.08, 0, 0, 0.012, 0.14, 0.06);
    const tray = grp(C, 0, 0.0, 0, 0.14);
    tray.rotation.x = 0.5;
    box(tray, wood, 0, 0, 0, 0.18, 0.012, 0.1);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) box(tray, (i + j) % 3 ? '#8a8a86' : '#6a6a66', -0.08 + i * 0.02, 0.012, -0.04 + j * 0.02, 0.016, 0.002, 0.016);
    human(gp, 0.27, floor, -0.06, { h: 0.2, pose: 'stand', top: '#6a6a72', bottom: '#2a2a2a', skin, hair: '#1c1714', detail: 'lo', ry: Math.PI - 0.5, dress: 'ankle', hands: [[-0.1, 0.55, 0.22], [0.1, 0.58, 0.25]] });
    // bundles of the magazine with twine, and a stack of fresh sheets
    for (let k = 0; k < 4; k++) {
      const x = -0.3 + (k % 2) * 0.09, z = 0.14 + Math.floor(k / 2) * 0.08, y = floor;
      box(gp, '#d8cfb6', x, y, z, 0.07, 0.04 + (k % 3) * 0.01, 0.05);
      box(gp, '#a8352a', x, y + 0.04 + (k % 3) * 0.01, z, 0.05, 0.002, 0.016);
      box(gp, '#6a5a3a', x, y, z, 0.072, 0.042 + (k % 3) * 0.01, 0.004);
    }
    table(-0.28, -0.12, 0.12, 0.1, 0.09);
    for (let k = 0; k < 5; k++) box(gp, paper, -0.28, floor + 0.09 + k * 0.003, -0.12, 0.09, 0.0025, 0.07, k * 0.04);
    return;
  }
  // main low table, with the printer kneeling behind it facing the viewer
  const T = table(0, 0.0, 0.3, 0.13, 0.065);
  const ty = 0.065;
  if (style === 'movable') {
    // iron plate with a forme of clay sorts, half inked; a second plate warming on the brazier
    const plate = (p: THREE.Object3D, x: number, z: number, fill: number) => {
      box(p, '#3a3d42', x, ty, z, 0.11, 0.004, 0.08);
      for (const [fx, fz, w, d] of [[0, 0.036, 0.1, 0.006], [0, -0.036, 0.1, 0.006], [0.047, 0, 0.006, 0.07], [-0.047, 0, 0.006, 0.07]] as const) box(p, '#2c2f33', x + fx, ty + 0.004, z + fz, w, 0.01, d);
      for (let i = 0; i < 11; i++) for (let j = 0; j < 8; j++) {
        if (i / 11 > fill) continue;
        box(p, i < 5 ? ink : (i + j) % 2 ? '#b8946c' : '#a8845e', x - 0.04 + i * 0.008, ty + 0.004, z - 0.028 + j * 0.008, 0.007, 0.007, 0.007);
      }
    };
    plate(T, -0.06, 0, 1);
    sheet(T, 0.08, ty, 0.0, 0.1, 0.075, 9);
    // brazier with the second forme warming over the coals
    const bx = 0.26, bz = 0.1;
    cyl(gp, '#3a3530', bx, floor, bz, 0.04, 0.05, 10);
    cyl(gp, '#8a2a12', bx, floor + 0.05, bz, 0.035, 0.004, 10);
    fire(gp, bx, floor + 0.054, bz, 0.01);
    const W = grp(gp, bx, bz, 0.3, floor + 0.056 - ty);
    plate(W, 0, 0, 0.6);
    // type cases ordered by rhyme: shallow drawers with paper labels
    const K = grp(gp, -0.02, -0.27, 0, floor);
    box(K, wood, 0, 0, 0, 0.42, 0.15, 0.07);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
      const cx = -0.18 + i * 0.052, cy = 0.012 + j * 0.035;
      box(K, '#2a1e16', cx, cy, 0.0352, 0.044, 0.028, 0.001);
      box(K, paper, cx, cy + 0.016, 0.0362, 0.014, 0.008, 0.001);
    }
    human(gp, -0.03, floor, -0.13, { h: 0.2, pose: 'kneel', top: '#6a5a44', bottom: '#4a3e2c', skin, hair: '#1c1714', hat: ink, hatStyle: 'cap', detail: 'lo', dress: 'knee', hands: [[-0.12, 0.38, 0.32], [0.08, 0.4, 0.34]] });
    sheet(gp, -0.3, floor, 0.12, 0.09, 0.07, 8, 0.2);
    sheet(gp, -0.29, floor + 0.002, 0.13, 0.09, 0.07, 8, -0.1);
    return;
  }
  // the carved block: inked relief characters in columns, a sheet laid over its right half being rubbed
  box(T, pear, -0.02, ty, 0, 0.13, 0.012, 0.08);
  for (let i = 0; i < 11; i++) for (let j = 0; j < 7; j++) box(T, ink, -0.075 + i * 0.01, ty + 0.012, -0.03 + j * 0.01, 0.006, 0.002, 0.007);
  const sh = sheet(T, 0.025, ty + 0.0145, 0, 0.07, 0.085, 0);
  sh.rotation.z = 0.06;
  lathe(T, [[0, 0], [0.018, 0], [0.022, 0.012], [0.02, 0.014], [0, 0.006]], '#6a5a4a', -0.115, ty, 0.02, 10);
  cyl(T, ink, -0.115, ty + 0.006, 0.02, 0.017, 0.002, 10);
  cyl(T, '#7a5a34', -0.11, ty, -0.035, 0.012, 0.012, 8);
  cyl(T, '#3a2a1a', -0.11, ty + 0.012, -0.035, 0.008, 0.016, 6);
  for (let k = 0; k < 4; k++) box(T, paper, 0.11, ty + k * 0.002, -0.01, 0.06, 0.0018, 0.08, k * 0.05);
  const pr = human(gp, 0, floor, -0.12, { h: 0.2, pose: 'kneel', top: '#6b5a3e', bottom: '#4a3e2c', skin, hair: '#1c1714', hat: ink, hatStyle: 'cap', detail: 'lo', dress: 'knee', hands: [[-0.1, 0.36, 0.3], [0.06, 0.38, 0.36]] });
  ellip(gp, '#5a3a20', pr.handR[0], pr.handR[1] - 0.004, pr.handR[2], 0.012, 0.007, 0.016);
  // the carver at a second table with a half-cut block and his knife
  const T2 = table(-0.27, 0.12, 0.12, 0.09, 0.055, 0.5);
  box(T2, pear, 0, 0.055, 0, 0.09, 0.012, 0.06);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) box(T2, '#a8804a', -0.03 + i * 0.01, 0.067, -0.025 + j * 0.01, 0.006, 0.002, 0.007);
  box(T2, paper, 0.02, 0.067, 0, 0.04, 0.0015, 0.055);
  const cv = human(gp, -0.37, floor, 0.06, { h: 0.19, pose: 'kneel', top: '#7a6a52', bottom: '#4a3e2c', skin, hair: '#1c1714', hatStyle: 'knot', detail: 'lo', dress: 'knee', ry: 2.07, hands: [[-0.06, 0.34, 0.3], [0.08, 0.36, 0.3]] });
  rod(gp, cv.handR, [cv.handR[0] + 0.01, cv.handR[1] - 0.025, cv.handR[2] + 0.01], 0.002, '#9aa0a6', 4);
  // drying line with printed sheets, and a rack of finished blocks
  for (const x of [0.14, 0.4]) rod(gp, [x, floor, -0.26], [x, floor + 0.22, -0.26], 0.005, wood, 5);
  rod(gp, [0.14, floor + 0.21, -0.26], [0.4, floor + 0.21, -0.26], 0.0012, '#6a5a3a', 3);
  for (let k = 0; k < 4; k++) {
    const S = grp(gp, 0.18 + k * 0.06, -0.26, 0.05 * (k - 1.5), floor + 0.21);
    box(S, paper, 0, -0.085, 0, 0.05, 0.085, 0.0015);
    for (let c = 0; c < 6; c++) box(S, ink, -0.02 + c * 0.008, -0.075, 0.001, 0.003, 0.065, 0.0005);
  }
  const R = grp(gp, 0.32, 0.14, -0.6, floor);
  for (const sx of [-1, 1]) box(R, wood, sx * 0.06, 0, 0, 0.01, 0.1, 0.06);
  for (const y of [0.0, 0.05]) {
    box(R, wood, 0, y, 0, 0.13, 0.006, 0.06);
    for (let k = 0; k < 6; k++) box(R, shade(pear, 0.85 + (k % 3) * 0.06), -0.045 + k * 0.018, y + 0.006, 0, 0.012, 0.04, 0.05);
  }
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
  // Mongol ger (蒙古包) camp after Rubruck's and Carpini's accounts and surviving gers: a lattice wall (哈那) ≈1.5 m
  // high and 5–6 m across, a shallow conical roof of straight poles (乌尼) to the crown ring (陶脑) with its smoke-flap,
  // all wrapped in whitened felt and bound by hair ropes; a low painted wooden door facing south. Beside it a smaller
  // ger, a high-wheeled 勒勒车 ox cart, horses at a tether line, sheep, and the 苏勒德 spirit banner (a trident with a
  // black horse-hair tassel). ≈0.035 units/m.
  const floor = ground(gp, 0.47, '#8a9658');
  const felt = '#e8e1d0', rope = '#5a4a3a', door = '#c2512a';
  const ger = (x: number, z: number, R: number, ry: number) => {
    const G = grp(gp, x, z, ry, floor);
    const wh = R * 0.5, rise = R * 0.5, cr = R * 0.2;
    lathe(G, [[0, 0], [R, 0], [R * 1.01, wh * 0.5], [R, wh], [R * 0.96, wh + R * 0.03], [cr * 1.1, wh + rise], [cr, wh + rise + R * 0.02], [0, wh + rise + R * 0.02]], felt, 0, 0, 0, 24);
    // hair-rope girdles round the wall and the roof skirt, radial roof ropes, crown ring with a folded smoke flap
    for (const t of [0.22, 0.62]) lathe(G, [[R * 1.012, wh * t], [R * 1.016, wh * t + R * 0.025], [R * 1.012, wh * t + R * 0.05]], rope, 0, 0, 0, 24);
    lathe(G, [[R * 0.975, wh + R * 0.02], [R * 0.96, wh + R * 0.05], [R * 0.9, wh + R * 0.08]], rope, 0, 0, 0, 24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
      rod(G, [ca * cr * 1.15, wh + rise + 0.002, sa * cr * 1.15], [ca * R * 0.98, wh + R * 0.035, sa * R * 0.98], 0.0022, rope, 3);
    }
    lathe(G, [[cr * 0.7, 0], [cr * 1.05, 0], [cr * 1.05, R * 0.04], [cr * 0.7, R * 0.04]], '#7a5a3a', 0, wh + rise, 0, 14);
    const fl = grp(G, 0, -cr * 0.5, 0, wh + rise + R * 0.03);
    fl.rotation.x = -0.5;
    box(fl, shade(felt, 0.9), 0, 0, -cr * 0.6, cr * 2.2, 0.004, cr * 1.4);
    // south door: painted frame, double leaves, a rolled felt curtain above
    const dw = R * 0.32, dh = wh * 0.88;
    box(G, door, 0, 0, R * 0.995, dw + 0.01, dh + 0.006, 0.008);
    box(G, shade(door, 0.8), -dw * 0.24, 0.004, R * 1.0, dw * 0.44, dh - 0.004, 0.006);
    box(G, shade(door, 0.8), dw * 0.24, 0.004, R * 1.0, dw * 0.44, dh - 0.004, 0.006);
    box(G, '#d6a840', 0, dh * 0.5, R * 1.005, dw * 0.9, 0.003, 0.004);
    cyl(G, shade(felt, 0.85), 0, dh + 0.01, R * 1.01, R * 0.03, dw + 0.012, 8).rotation.z = Math.PI / 2;
    box(G, '#7a6a52', 0, 0, R * 1.08, dw + 0.02, 0.004, R * 0.12);
    return wh + rise;
  };
  const top = ger(-0.08, -0.06, 0.19, 0);
  smoke(gp, -0.08, floor + top + 0.01, -0.06, 0.03, 6, '#9a948c');
  ger(0.24, -0.2, 0.12, -0.35);
  // 勒勒车: two high wheels, a shaft pair and a felt-covered box
  const Cr = grp(gp, -0.33, -0.18, 0.9, floor);
  for (const sz of [-1, 1]) wheel(Cr, 0, 0.065, sz * 0.055, 0.065, '#5a4030', 14);
  rod(Cr, [0, 0.065, -0.07], [0, 0.065, 0.07], 0.005, '#4a3222', 5);
  box(Cr, '#6a4a32', 0.0, 0.07, 0, 0.13, 0.008, 0.08);
  for (const sz of [-1, 1]) rod(Cr, [-0.06, 0.075, sz * 0.03], [0.2, 0.01, sz * 0.03], 0.004, '#4a3222', 4);
  const cov = lathe(Cr, [[0, 0], [0.042, 0], [0.04, 0.03], [0.02, 0.048], [0, 0.052]], shade(felt, 0.92), 0, 0.078, 0, 10);
  cov.scale.set(1.5, 1, 1);
  // tether line with two horses, the spirit banner, sheep and a herder
  for (const x of [0.06, 0.36]) rod(gp, [x, floor, 0.24], [x, floor + 0.08, 0.24], 0.004, '#4a3222', 4);
  rod(gp, [0.06, floor + 0.075, 0.24], [0.36, floor + 0.075, 0.24], 0.0012, rope, 3);
  ([[0.14, '#6a4630', 0.2], [0.27, '#c8b89a', -0.2]] as const).forEach(([x, coat, ry]) => {
    const H = grp(gp, x, 0.2, Math.PI + ry, floor);
    H.scale.setScalar(0.26);
    horse(H, coat, '#2a1a10', { cloth: '#8a2a20', saddle: '#4a3020' });
  });
  const S = grp(gp, 0.12, 0.05, 0, floor);
  rod(S, [0, 0, 0], [0, 0.32, 0], 0.004, '#4a3222', 5);
  for (const dx of [-0.012, 0, 0.012]) rod(S, [dx, 0.31, 0], [dx * 1.2, 0.345, 0], 0.0018, '#9aa0a6', 3);
  box(S, '#9aa0a6', 0, 0.31, 0, 0.026, 0.003, 0.003);
  lathe(S, [[0.003, 0], [0.018, -0.005], [0.022, -0.04], [0.012, -0.06], [0, -0.062]], '#1a1614', 0, 0.305, 0, 10);
  lathe(S, [[0, 0], [0.024, 0], [0.024, 0.014], [0, 0.016]], '#bdb4a2', 0, 0, 0, 8);
  for (let k = 0; k < 7; k++) {
    const x = -0.3 + hash3(k, 1, 4) * 0.22, z = 0.15 + hash3(k, 2, 4) * 0.2, a = hash3(k, 3, 4) * 6;
    const W = grp(gp, x, z, a, floor);
    ellip(W, k % 4 ? '#e2dccc' : '#5a4a3a', 0, 0.022, 0, 0.014, 0.012, 0.022);
    ellip(W, k % 3 ? '#2a221c' : '#e2dccc', 0, 0.028, 0.022, 0.006, 0.007, 0.009);
    for (const [lx, lz] of [[-0.007, 0.012], [0.007, 0.012], [-0.007, -0.012], [0.007, -0.012]]) rod(W, [lx, 0, lz], [lx, 0.014, lz], 0.0018, '#3a3028', 3);
  }
  human(gp, -0.08, floor, 0.2, { h: 0.12, pose: 'walk', top: '#2f4f7a', bottom: '#3a3128', skin: '#c08a62', hair: '#1c1714', hat: '#8a2a20', hatStyle: 'fur', detail: 'lo', dress: 'knee', ry: 0.6 });
};

const tent: Builder = (gp, r) => {
  // A Tang–Song field headquarters (幕府 / 帐) after Dunhuang murals and Song paintings (《中兴瑞应图》): a large
  // rectangular cloth tent on a pole frame, straight side walls and a hipped roof, a painted valance (帐额) with a
  // scalloped edge under the eaves, the front curtains tied back on the commander's seat and screen, guy ropes to
  // pegs; outside a weapon rack (兰锜) of spears, a war drum on its stand, a guard and the side's banners. r.color dyes
  // the banners and valance. Also used for camp props beside armies, so it stays compact.
  const c = str(r.color, '#a8352a'), cloth = '#d6cab0', dk = '#2a1e18';
  const floor = ground(gp, 0.44, '#8a8a5a');
  const W = 0.34, D = 0.24, wh = 0.1, rh = 0.21, rx = 0.07;
  const T = grp(gp, 0, -0.04, 0, floor);
  // walls with the front opening, roof of four sloped cloth planes on a ridge pole
  const hw = W / 2, hd = D / 2;
  box(T, cloth, 0, 0, -hd, W, wh, 0.004);
  for (const sx of [-1, 1]) box(T, cloth, sx * hw, 0, 0, 0.004, wh, D);
  for (const sx of [-1, 1]) box(T, cloth, sx * (hw - 0.05), 0, hd, 0.1, wh, 0.004);
  box(T, dk, 0, 0, hd - 0.004, W - 0.2, wh, 0.002);
  const roofP = (rings: V3[][]) => skin(T, rings, cloth, { flat: true, caps: true, paint: (_x, _y, _z, nx, ny, nz) => (ny < -0.2 ? shade(cloth, 0.6) : Math.abs(nx) > Math.abs(nz) ? shade(cloth, 0.95) : cloth) });
  roofP([
    [[-hw - 0.012, wh, -hd - 0.012], [hw + 0.012, wh, -hd - 0.012], [hw + 0.012, wh, hd + 0.012], [-hw - 0.012, wh, hd + 0.012]],
    [[-rx, rh, -0.002], [rx, rh, -0.002], [rx, rh, 0.002], [-rx, rh, 0.002]],
  ]);
  rod(T, [-rx - 0.03, rh + 0.004, 0], [rx + 0.03, rh + 0.004, 0], 0.004, P.darkwood, 5);
  // sewn panel seams running from the ridge to the eaves
  for (const sz of [-1, 1]) for (let k = -2; k <= 2; k++) rod(T, [k * rx * 0.5, rh, sz * 0.003], [k * (hw + 0.012) * 0.5, wh + 0.001, sz * (hd + 0.013)], 0.0012, shade(cloth, 0.78), 3);
  for (const sx of [-1, 1]) ellip(T, P.gold, sx * (rx + 0.032), rh + 0.004, 0, 0.007);
  // 帐额: valance round the eaves in the side colour with a scalloped lower edge
  const val = (x: number, z: number, len: number, ry: number) => {
    const V = grp(T, x, z, ry, wh - 0.03);
    box(V, c, 0, 0, 0, len, 0.03, 0.003);
    box(V, P.gold, 0, 0.022, 0.002, len, 0.003, 0.002);
    const n = Math.round(len / 0.03);
    for (let i = 0; i < n; i++) slab(grp(V, -len / 2 + ((i + 0.5) / n) * len, 0, 0, 0), [[-len / n / 2, 0], [len / n / 2, 0], [0, -0.012]], 0.003, c, 0, false);
  };
  val(0, hd + 0.014, W + 0.028, 0);
  val(0, -hd - 0.014, W + 0.028, Math.PI);
  for (const sx of [-1, 1]) val(sx * (hw + 0.014), 0, D + 0.028, sx * Math.PI / 2);
  // tied-back door curtains, the commander's couch and screen within
  for (const sx of [-1, 1]) {
    const cu = tbox(T, 0.012, 0.006, 0.05, 0.004, wh - 0.03, shade(cloth, 0.92), sx * 0.075, 0, hd + 0.004);
    cu.rotation.z = sx * 0.12;
  }
  box(T, '#6a2a20', 0, 0, -hd + 0.03, 0.12, 0.08, 0.008);
  rbox(T, '#3a2a1e', 0, 0, -hd + 0.06, 0.08, 0.025, 0.04, 0.003);
  // guy ropes from the eave corners and wall mid-points to pegs
  const pegs: [V3, V3][] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pegs.push([[sx * hw, wh, sz * hd], [sx * (hw + 0.07), 0, sz * (hd + 0.07)]]);
  for (const sx of [-1, 1]) pegs.push([[sx * hw, wh, 0], [sx * (hw + 0.09), 0, 0]]);
  pegs.push([[0, wh, -hd], [0, 0, -hd - 0.09]]);
  for (const [a, b] of pegs) { rod(T, a, b, 0.0012, '#6a5a44', 3); box(T, P.darkwood, b[0], 0, b[2], 0.006, 0.014, 0.006); }
  // weapon rack with spears and halberds, a war drum on a frame, the guard and two banners
  const Rk = grp(gp, -0.28, 0.2, 0.5, floor);
  for (const sx of [-1, 1]) box(Rk, P.darkwood, sx * 0.05, 0, 0, 0.008, 0.07, 0.008);
  box(Rk, P.darkwood, 0, 0.06, 0, 0.11, 0.008, 0.012);
  box(Rk, P.darkwood, 0, 0.0, 0, 0.11, 0.008, 0.03);
  for (let k = 0; k < 5; k++) {
    const x = -0.04 + k * 0.02;
    rod(Rk, [x, 0.004, 0], [x, 0.24, 0.008], 0.0025, '#4a3222', 4);
    cone(Rk, '#a8adb3', x, 0.24, 0.008, 0.004, 0.022, 4);
    if (k % 2) box(Rk, '#a8adb3', x + 0.006, 0.225, 0.008, 0.012, 0.004, 0.002);
    box(Rk, c, x, 0.225, 0.008, 0.005, 0.01, 0.005);
  }
  const Dr = grp(gp, 0.27, 0.2, -0.5, floor);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(Dr, [sx * 0.06, 0, sz * 0.03], [sx * 0.046, 0.085, 0], 0.0035, P.darkwood, 4);
  for (const sx of [-1, 1]) box(Dr, P.darkwood, sx * 0.046, 0.07, 0, 0.006, 0.02, 0.012);
  const dr = lathe(Dr, [[0, -0.03], [0.034, -0.03], [0.042, 0], [0.034, 0.03], [0, 0.03]], '#8a2a1e', 0, 0.075, 0, 14);
  dr.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) cyl(Dr, '#d8c8a0', 0, 0.075, s * 0.0305, 0.034, 0.002, 14).rotation.x = Math.PI / 2;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ellip(Dr, P.gold, Math.cos(a) * 0.04, 0.075 + Math.sin(a) * 0.04, 0, 0.003); }
  soldier(grp(gp, 0.1, 0.17, 0.2, floor), 0, 0, 0.15, c, { shield: false, arm: 'ji' });
  for (const sx of [-1, 1]) banner(gp, sx * 0.25, floor, 0.06, 0.34, c, 0.1);
};

const hut: Builder = (gp, r) => {
  // Default: a Yangshao round house at 半坡 (c. 4800 BCE, after the excavated floors and the Banpo Museum
  // reconstruction): a floor dug ≈0.5 m into the loess, a low wattle-and-daub wall and a conical roof of poles thatched
  // and plastered with grass-mud (草泥) reaching almost to the ground, a smoke hole under a thatch cap, and a small
  // gabled porch over a sloping entrance passage. Around it a square house, a storage pit (窖穴), red pottery — the
  // pointed-base amphora (尖底瓶) and a painted fish basin — and villagers with a stone hoe. r.style 'farm': a 1970s
  // Anhui farmhouse (小岗村, 1978) — sun-dried mud-brick walls, a straw-thatched gable roof, a wooden door and barred
  // window, a threshing floor with a stone roller and a straw stack.
  if (r.style === 'farm') {
    const floor = ground(gp, 0.45, '#9a8a62');
    const adobe = '#a88a62', straw = '#a8925e';
    const F = grp(gp, -0.04, -0.1, 0, floor);
    const W = 0.36, D = 0.18, Hh = 0.14;
    box(F, '#7a6a52', 0, 0, 0, W + 0.01, 0.015, D + 0.01);
    box(F, adobe, 0, 0.015, 0, W, Hh - 0.015, D);
    for (let k = 1; k < 9; k++) box(F, shade(adobe, 0.9), 0, 0.015 + k * 0.014, D / 2 + 0.0005, W, 0.0015, 0.001);
    const rp = 0.105, sp = D / 2 + 0.03;
    for (const sx of [-1, 1]) slab(grp(F, sx * W / 2, 0, Math.PI / 2, Hh), [[-D / 2, 0], [D / 2, 0], [0, rp * (D / 2) / sp]], 0.004, adobe, 0, false);
    // thatched roof: two steep planes of straw with a ridge roll and ragged eave tufts
    for (const sz of [-1, 1]) {
      const pl = grp(F, 0, sz * sp / 2, 0, Hh + rp / 2 - 0.006);
      pl.rotation.x = sz * Math.atan2(rp, sp);
      box(pl, straw, 0, -0.012, 0, W + 0.05, 0.024, Math.hypot(sp, rp) + 0.01);
      for (let k = 0; k < 3; k++) box(pl, shade(straw, 0.86), 0, 0.012, (k - 1) * 0.035, W + 0.05, 0.002, 0.005);
      for (let k = 0; k < 14; k++) box(pl, shade(straw, k % 2 ? 0.8 : 0.92), -W / 2 - 0.02 + k * ((W + 0.04) / 13), -0.02, sz * (Math.hypot(sp, rp) / 2 + 0.004), 0.022, 0.012, 0.008);
    }
    rod(F, [-W / 2 - 0.03, Hh + rp + 0.002, 0], [W / 2 + 0.03, Hh + rp + 0.002, 0], 0.012, shade(straw, 0.78), 6);
    box(F, '#5a3e2a', -0.06, 0.015, D / 2, 0.05, 0.095, 0.006);
    box(F, '#3a2a1e', -0.06, 0.11, D / 2 + 0.001, 0.07, 0.008, 0.008);
    for (const wx of [0.06, 0.13]) {
      box(F, '#2a2018', wx, 0.06, D / 2, 0.04, 0.035, 0.004);
      for (let k = 0; k < 4; k++) box(F, '#6a4a30', wx - 0.015 + k * 0.01, 0.06, D / 2 + 0.002, 0.003, 0.035, 0.003);
    }
    box(F, '#c8352a', -0.06, 0.118, D / 2 + 0.005, 0.03, 0.014, 0.001);
    box(F, '#c8352a', -0.06 - 0.032, 0.03, D / 2 + 0.005, 0.01, 0.055, 0.001);
    box(F, '#c8352a', -0.06 + 0.032, 0.03, D / 2 + 0.005, 0.01, 0.055, 0.001);
    // threshing floor, stone roller, straw stack, hoe, chickens and the farmer in a faded blue jacket
    lathe(gp, [[0, 0], [0.16, 0], [0.16, 0.003], [0, 0.003]], '#b0a07a', 0.12, floor, 0.22, 20);
    const roll = cyl(gp, '#8a8580', 0.16, floor + 0.022, 0.22, 0.022, 0.07, 10);
    roll.rotation.z = Math.PI / 2;
    lathe(gp, [[0, 0], [0.07, 0], [0.075, 0.05], [0.06, 0.1], [0.02, 0.13], [0, 0.135]], straw, -0.3, floor, 0.2, 12);
    rod(gp, [-0.3, floor + 0.13, 0.2], [-0.3, floor + 0.16, 0.2], 0.003, '#5a3e2a', 4);
    rod(gp, [0.27, floor, 0.03], [0.24, floor + 0.15, 0.03], 0.003, '#6a4a30', 4);
    box(gp, '#5a5a5a', 0.27, floor, 0.035, 0.03, 0.03, 0.004);
    for (let k = 0; k < 3; k++) {
      const x = -0.1 + k * 0.05, z = 0.2 + (k % 2) * 0.04;
      ellip(gp, k ? '#b07a3a' : '#e8e0d0', x, floor + 0.012, z, 0.01, 0.009, 0.014);
      ellip(gp, '#c8352a', x, floor + 0.022, z + 0.012, 0.003, 0.004, 0.002);
    }
    human(gp, 0.05, floor, 0.16, { h: 0.14, pose: 'relax', top: '#4a5a7a', bottom: '#3a3a3a', skin: '#b8865c', hair: '#1c1714', detail: 'lo', ry: -0.3 });
    return;
  }
  const floor = ground(gp, 0.45, '#9a845a');
  const thatch = '#a88a52', mud = '#8f7650', loess = '#a08458';
  // the round house: low mud wall ring, grass-mud cone with thatch bands, smoke-hole cap
  const Hx = -0.04, Hz = -0.04, R = 0.2, hR = 0.33;
  lathe(gp, [[R * 1.05, 0], [R * 1.02, 0.03], [R * 0.98, 0.035], [0, 0.035]], mud, Hx, floor, Hz, 24);
  const cone_ = lathe(gp, [[R * 1.12, 0.02], [R * 1.08, 0.045], [R * 0.56, 0.045 + (hR - 0.075) * 0.55], [R * 0.12, hR - 0.035], [0, hR - 0.03]], thatch, Hx, floor, Hz, 24);
  cone_.material = mat(thatch, { flat: true });
  for (const [t, rr] of [[0.075, 0.9], [0.135, 0.67], [0.195, 0.44]] as const) lathe(gp, [[R * rr * 1.03, t], [R * rr * 1.03 - 0.004, t + 0.008]], shade(thatch, 0.8), Hx, floor, Hz, 24);
  lathe(gp, [[R * 1.13, 0.012], [R * 1.13, 0.026], [R * 1.08, 0.03]], shade(thatch, 0.85), Hx, floor, Hz, 24);
  const cap = lathe(gp, [[0, 0], [0.05, 0], [0.04, 0.02], [0, 0.04]], shade(thatch, 0.9), Hx, floor + hR - 0.045, Hz, 10);
  cap.material = mat(shade(thatch, 0.9), { flat: true });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; rod(gp, [Hx + Math.cos(a) * 0.02, floor + hR - 0.03, Hz + Math.sin(a) * 0.02], [Hx + Math.cos(a) * 0.045, floor + hR - 0.05, Hz + Math.sin(a) * 0.045], 0.004, '#3a2a1a', 3); }
  smoke(gp, Hx, floor + hR, Hz, 0.02, 5, '#a8a29a');
  // gabled porch over the sunken entrance passage
  const Pz = Hz + R * 0.95;
  const Po = grp(gp, Hx, Pz, 0, floor);
  for (const sx of [-1, 1]) {
    const pl = grp(Po, sx * 0.03, 0, 0, 0.1);
    pl.rotation.z = -sx * 0.85;
    box(pl, thatch, 0, -0.008, 0.0, 0.085, 0.014, 0.12);
  }
  box(Po, '#2a1e14', 0, 0.0, 0.035, 0.05, 0.07, 0.004);
  slab(grp(Po, 0, 0.055, 0, 0.0), [[-0.04, 0], [0.04, 0], [0, 0.085]], 0.04, shade(thatch, 0.92), 0, false);
  box(Po, '#2a1e14', 0, 0.0, 0.074, 0.045, 0.06, 0.002);
  for (let k = 0; k < 3; k++) box(Po, shade(loess, 0.85 - k * 0.05), 0, 0.0, 0.1 + k * 0.016, 0.05, 0.002, 0.016);
  // a smaller square house with a pyramidal thatch roof behind
  const Sq = grp(gp, 0.26, -0.24, -0.4, floor);
  box(Sq, mud, 0, 0, 0, 0.14, 0.03, 0.14);
  const pr = lathe(Sq, [[0.11, 0], [0.105, 0.015], [0, 0.17]], thatch, 0, 0.02, 0, 4);
  pr.rotation.y = Math.PI / 4;
  pr.material = mat(thatch, { flat: true });
  box(Sq, '#2a1e14', 0, 0.0, 0.072, 0.03, 0.04, 0.002);
  // storage pit, pottery, a hearth outside, villagers
  lathe(gp, [[0, 0], [0.04, 0], [0.045, 0.006], [0.0, 0.006]], '#3a2e22', 0.22, floor - 0.004, 0.06, 14);
  lathe(gp, [[0.045, 0.0], [0.05, 0.006], [0.042, 0.008]], loess, 0.22, floor, 0.06, 14);
  const amph = (x: number, z: number, tilt: number) => {
    const A = lathe(gp, [[0, 0], [0.006, 0.01], [0.016, 0.035], [0.018, 0.05], [0.012, 0.065], [0.005, 0.07], [0.006, 0.078], [0, 0.078]], '#b0563a', x, floor, z, 10);
    A.rotation.z = tilt;
    return A;
  };
  amph(0.12, 0.22, 0.0);
  amph(0.15, 0.24, 0.5);
  lathe(gp, [[0, 0], [0.025, 0.002], [0.04, 0.02], [0.042, 0.024], [0.038, 0.024], [0, 0.006]], '#b0563a', 0.2, floor, 0.18, 14);
  for (let k = 0; k < 3; k++) box(gp, '#2a1e18', 0.2 - 0.02 + k * 0.02, floor + 0.012, 0.18 + 0.038, 0.012, 0.004, 0.002);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ellip(gp, '#8a8278', -0.27 + Math.cos(a) * 0.035, floor + 0.006, 0.2 + Math.sin(a) * 0.035, 0.012, 0.008, 0.01); }
  fire(gp, -0.27, floor + 0.004, 0.2, 0.018);
  human(gp, 0.06, floor, 0.24, { h: 0.17, pose: 'carry', top: '#9a7a52', bottom: '#9a7a52', skin: '#b8865c', hair: '#1c1714', detail: 'lo', dress: 'knee', sleeve: 0.4, ry: -0.4 });
  const mn = human(gp, -0.18, floor, 0.12, { h: 0.18, pose: 'stand', top: '#8a6a42', bottom: '#8a6a42', skin: '#b07a52', hair: '#1c1714', detail: 'lo', dress: 'knee', sleeve: 0, ry: 0.5, hands: [[-0.12, 0.47, 0.02], [0.12, 0.62, 0.12]] });
  const [hx, hy, hz] = mn.handR;
  rod(gp, [hx, hy - 0.1, hz], [hx, hy + 0.05, hz], 0.003, '#6a4a30', 4);
  box(gp, '#7a7470', hx, hy + 0.05, hz + 0.006, 0.006, 0.026, 0.02);
  // millet patch beyond the houses
  for (let k = 0; k < 18; k++) { const x = -0.38 + (k % 6) * 0.03, z = -0.22 + Math.floor(k / 6) * 0.04; rod(gp, [x, floor, z], [x + 0.004, floor + 0.05, z], 0.0018, '#8a8a3a', 3); ellip(gp, '#c8a84a', x + 0.006, floor + 0.05, z, 0.004, 0.008, 0.004, 0, 0, -0.4); }
};

// ---- ships ----------------------------------------------------------------------------------------------------
/** Translucent patch of sea with foam at the bow and a wake astern (outside any bobbing group). */
function seaPatch(p: THREE.Object3D, rx: number, rz: number): void {
  const m = lathe(p, [[0, 0], [1, 0], [1, 0.008], [0, 0.01]], P.water, 0, 0, 0, 36);
  m.scale.set(rx, 1, rz);
  m.material = mat('#3f6f86', { transparent: 0.72, rough: 0.25 });
  for (let i = 0; i < 12; i++) {
    const s = i % 2 ? 1 : -1, k = Math.floor(i / 2) / 6;
    ellip(p, '#dfeef0', s * (0.04 + k * rx * 0.5), 0.009, -rz * (0.35 + k * 0.6), 0.03 + k * 0.02, 0.003, 0.008, s * 0.35);
  }
  for (const s of [-1, 1]) ellip(p, '#eef6f6', s * 0.05, 0.009, rz * 0.82, 0.05, 0.003, 0.01, -s * 0.6);
}

function waves(p: THREE.Object3D, R: number): void {
  const m = lathe(p, [[0, 0], [R, 0], [R, 0.01], [0, 0.012]], P.water, 0, 0, 0, 32);
  m.material = mat(P.water, { rough: 0.25 });
  for (let i = 0; i < 14; i++) { const a = hash3(i, 1, 1) * Math.PI * 2, d = R * (0.5 + hash3(i, 2, 1) * 0.45); ellip(p, '#9cc3d0', Math.cos(a) * d, 0.012, Math.sin(a) * d, 0.04, 0.003, 0.008, a); }
}

/**
 * Junk lug sail (平衡纵帆) on a mast at (x, y, z) of the parent: mat/cloth panels stiffened by full-length bamboo battens,
 * a third of the sail forward of the mast, fan-shaped leech, peaked yard. Sheeted `trim` radians off the centreline.
 */
function lugSail(p: THREE.Object3D, x: number, y: number, z: number, H: number, Sw: number, trim: number, c: string, battens = 7): void {
  const T = grp(p, x, z, Math.PI / 2 + trim, y);
  const s = anim(T, 'sway', 0, 0, 0, { amp: 0.035, speed: 1.1 });
  // local +x runs aft along the boom, y up
  const out: [number, number][] = [[-0.3 * Sw, 0], [0.62 * Sw, 0], [0.76 * Sw, 0.4 * H], [0.74 * Sw, 0.72 * H], [0.6 * Sw, H], [-0.3 * Sw, 0.74 * H]];
  slab(s, out, 0.004, c, 0, false).position.z = 0.008;
  const lx = -0.3 * Sw, rx = (v: number) => (v < 0.4 ? 0.62 + 0.14 * (v / 0.4) : 0.76 - 0.02 * ((v - 0.4) / 0.32)) * Sw;
  for (let k = 0; k < battens; k++) {
    // battens fan out: level at the foot, rising aft towards the head
    const v = (k / battens) * 0.74, x1 = rx(v), fan = (k / battens) * 0.16;
    box(s, '#4a3826', (lx + x1) / 2, v * H - 0.003 + Math.tan(fan) * (x1 - lx) / 2, 0.008, (x1 - lx) / Math.cos(fan) + 0.01, 0.006, 0.012, 0, 0, fan);
  }
  // yard along the peaked head
  const hx0 = lx, hy0 = 0.74 * H, hx1 = 0.6 * Sw, hy1 = H;
  box(s, '#4a3826', (hx0 + hx1) / 2, (hy0 + hy1) / 2 - 0.004, 0.008, Math.hypot(hx1 - hx0, hy1 - hy0) + 0.01, 0.008, 0.014, 0, 0, Math.atan2(hy1 - hy0, hx1 - hx0));
}

const junk: Builder = (gp, r) => {
  // 福船-type ocean-going junk (Song–Ming; cf. the 1974 Quanzhou ship, c. 34 m × 11 m, and the Tiangong Kaiwu): a hull
  // "flat above like a balance beam, sharp below like a blade", raised bow with painted oculi (龙目), high square
  // transom stern with a poop house and a deep hanging rudder, three masts (raked foremast, tall main, mizzen) with
  // brown battened lug sails. Bow +z, ≈0.025 units/m. r.color only tints the masthead pennant (fleets pass route colours).
  seaPatch(gp, 0.3, 0.47);
  const b = anim(gp, 'bob');
  const L = 0.84, Wm = 0.12, wl = 0.012;
  const zt = (t: number) => -L / 2 + t * L;
  const wAt = (t: number) => Wm * (t < 0.42 ? 0.8 + 0.2 * Math.sin((Math.PI / 2) * (t / 0.42)) : 1 - 0.7 * ((t - 0.42) / 0.58) ** 1.7);
  const sAt = (t: number) => wl + 0.058 + 0.07 * (1 - t) ** 3 + 0.075 * t ** 3.5;
  const dAt = (t: number) => 0.045 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
  const rings: V3[][] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = wAt(t), s = sAt(t), d = dAt(t), z = zt(t);
    // vertices sit on the paint lines (rail band, white stripe, boot-top) so each face takes one colour
    const side: [number, number][] = [[1, s], [1.004, s - 0.022], [1.006, s - 0.03], [1.01, wl + (s - wl) * 0.4], [0.97, wl + 0.006], [0.95, wl - 0.003], [0.62, wl - d * 0.6]];
    rings.push([...side.map(([k, y]) => [-w * k, y, z] as V3), [0, wl - d, z], ...side.slice().reverse().map(([k, y]) => [w * k, y, z] as V3)]);
  }
  skin(b, rings, '#3a2c22', {
    caps: true, flat: true,
    paint: (_x, y, z, _nx, ny, nz) => {
      const t = Math.min(1, Math.max(0, (z + L / 2) / L)), s = sAt(t);
      if (ny > 0.6 && y > s - 0.004) return '#9a7a52';
      if (nz < -0.8) return y > s - 0.035 ? '#8a2e1e' : y > s - 0.045 ? '#e0c060' : '#3a2c22';
      if (nz > 0.8) return '#8a2e1e';
      if (y < wl - 0.003) return '#cfc7b2';
      if (y < wl + 0.006) return '#ece6d6';
      if (y > s - 0.0225) return '#8a2e1e';
      if (y > s - 0.0305) return '#e8e0cc';
      return null;
    },
  });
  // bulwarks (舷墙) along both sides, red with a dark capping rail
  for (const sx of [-1, 1]) {
    const bw: V3[][] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = wAt(t), s = sAt(t), z = zt(t), bh = 0.022 + 0.01 * t ** 4;
      bw.push([[sx * w, s - 0.002, z], [sx * w, s + bh, z], [sx * (w - 0.007), s + bh, z], [sx * (w - 0.007), s - 0.002, z]]);
    }
    skin(b, bw, '#8a2e1e', { caps: true, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny > 0.8 ? '#2a201a' : null) });
  }
  // oculi on the bow
  for (const sx of [-1, 1]) {
    const t = 0.9, w = wAt(t), s = sAt(t);
    ellip(b, '#f2ecdc', sx * (w + 0.004), s - 0.016, zt(t), 0.004, 0.012, 0.018);
    ellip(b, '#141414', sx * (w + 0.007), s - 0.016, zt(t) + 0.003, 0.003, 0.007, 0.008);
  }
  // stern: tall flared transom board with a painted bird, poop house with a curved roof, hanging rudder and tiller
  const s0 = sAt(0), w0 = wAt(0), zs = zt(0) - 0.002;
  slab(grp(b, 0, zs, 0, 0), [[-w0, s0 - 0.01], [w0, s0 - 0.01], [w0 * 1.22, s0 + 0.085], [w0 * 0.6, s0 + 0.1], [-w0 * 0.6, s0 + 0.1], [-w0 * 1.22, s0 + 0.085]], 0.008, '#8a2e1e', 0, false);
  ellip(b, '#e0c060', 0, s0 + 0.04, zs - 0.006, 0.03, 0.024, 0.004);
  ellip(b, '#2f5f4a', 0, s0 + 0.04, zs - 0.008, 0.016, 0.013, 0.003);
  rbox(b, '#6a4a30', 0, sAt(0.08) + 0.01, zt(0.11), w0 * 1.6, 0.06, 0.13, 0.004);
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) box(b, '#2a201a', sx * w0 * 0.8, sAt(0.08) + 0.03, zt(0.06) + k * 0.035, 0.002, 0.02, 0.02);
  roof(b, 0, sAt(0.08) + 0.07, zt(0.11), w0 * 1.5, 0.12, 0.03, '#5a4a3a', { kind: 'gable', ov: 0.012, lift: 0.2, ry: Math.PI / 2, gableC: '#6a4a30' });
  box(b, '#2a201a', 0, wl - 0.07, zs - 0.012, 0.012, s0 - wl + 0.05, 0.05);
  rod(b, [0, s0 + 0.01, zs - 0.01], [0, s0 + 0.02, zt(0.1)], 0.004, '#2a201a', 4);
  // windlass and anchor at the bow
  cyl(b, '#5a4030', 0, sAt(0.93) + 0.006, zt(0.93), 0.012, 0.004, 6).rotation.z = Math.PI / 2;
  rod(b, [wAt(0.96) * 0.6, sAt(0.96) + 0.01, zt(0.96)], [wAt(0.99) * 0.9, wl + 0.01, zt(1) + 0.02], 0.004, '#2a201a', 4);
  // masts and sails
  const sail = '#9c6b3e';
  const masts: [number, number, number, number, number][] = [[0.82, 0.38, 0.17, 0.16, 0.6], [0.5, 0.56, 0.26, 0, 0.55], [0.17, 0.34, 0.15, 0, 0.5]];
  for (const [t, h, sw, rake, trim] of masts) {
    const y = sAt(t), z = zt(t);
    const top: V3 = [0, y + h, z + Math.sin(rake) * h];
    rod(b, [0, y, z], top, 0.006, '#3b2a1d', 6);
    lugSail(b, 0, y + h * 0.12, z + Math.sin(rake) * h * 0.12, h * 0.84, sw, trim, sail, Math.max(5, Math.round(h / 0.06)));
    box(b, '#3b2a1d', 0, top[1] - 0.004, top[2], 0.016, 0.012, 0.016);
  }
  const pen = anim(b, 'flap', 0, sAt(0.5) + 0.56, zt(0.5), { amp: 0.3 });
  slab(pen, [[0, 0], [0, -0.04], [-0.1, -0.02]], 0.003, str(r.color, '#a8352a'), 0, false).rotation.y = Math.PI / 2;
  // a few crew on deck
  for (const [x, t, ph] of [[0.04, 0.62, 0.1], [-0.05, 0.33, 0.5], [0.0, 0.14, 0.8]] as const) {
    human(b, x, sAt(t), zt(t), { h: 0.045, pose: t === 0.14 ? 'stand' : 'carry', phase: ph, top: '#4a4a52', bottom: '#2a2a2a', hat: '#c8a96a', hatStyle: 'conical', detail: 'min', ry: Math.PI });
  }
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

/**
 * Flat-bottomed Chinese river/canal hull (漕船 / 舢板 type): transom ends, hard chine, sheer rising to a high stern and a
 * lifted square bow, tung-oiled planking with a dark wale and a wet band at the waterline. Bow +z. Returns sheer(t), z(t),
 * half-beam(t) for fitting out.
 */
function riverHull(p: THREE.Object3D, L: number, W: number, wl: number, c: string, stern = 0.05, bow = 0.035) {
  const zt = (t: number) => -L / 2 + t * L;
  const wAt = (t: number) => W * (0.5 + 0.5 * Math.sin(Math.PI * (0.08 + t * 0.84)) ** 0.7);
  const sAt = (t: number) => wl + 0.035 + stern * (1 - t) ** 3 + bow * t ** 3;
  const bAt = (t: number) => wl - 0.022 + 0.03 * Math.max(0, (t - 0.78) / 0.22) ** 2 + 0.02 * Math.max(0, (0.18 - t) / 0.18) ** 2;
  const rings: V3[][] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = wAt(t), s = sAt(t), b = bAt(t), z = zt(t);
    const side: [number, number][] = [[1, s], [1.0, s - 0.008], [0.99, Math.max(b + 0.016, wl + 0.004)], [0.96, b + 0.012]];
    rings.push([...side.map(([k, y]) => [-w * k, y, z] as V3), [-w * 0.8, b, z], [w * 0.8, b, z], ...side.slice().reverse().map(([k, y]) => [w * k, y, z] as V3)]);
  }
  skin(p, rings, c, {
    caps: true, flat: true,
    paint: (_x, y, z, _nx, ny, nz) => {
      const t = Math.min(1, Math.max(0, (z + L / 2) / L)), s = sAt(t);
      if (ny > 0.6 && y > s - 0.004) return shade(c, 1.25);
      if (Math.abs(nz) > 0.8) return y > s - 0.012 ? shade(c, 0.6) : shade(c, 0.85);
      if (y > s - 0.0085) return shade(c, 0.55);
      if (y < wl + 0.004) return '#2e2620';
      return null;
    },
  });
  // gunwale rails and thwart beams across the deck
  for (const sx of [-1, 1]) {
    const bw: V3[][] = [];
    for (let i = 0; i <= N; i++) { const t = i / N, w = wAt(t), s = sAt(t), z = zt(t); bw.push([[sx * w, s - 0.002, z], [sx * w, s + 0.008, z], [sx * (w - 0.006), s + 0.008, z], [sx * (w - 0.006), s - 0.002, z]]); }
    skin(p, bw, shade(c, 0.6), { caps: true, flat: true });
  }
  for (const t of [0.12, 0.3, 0.7, 0.88]) box(p, shade(c, 0.7), 0, sAt(t), zt(t), wAt(t) * 2 - 0.004, 0.006, 0.01);
  return { zt, wAt, sAt };
}

const boat: Builder = (gp, r) => {
  // River and canal boat (漕船 / 乌篷 type, Qin–Republican): a flat-bottomed transom-ended hull of oiled planks, a low
  // arched cabin of black bamboo matting (篷) in telescoping sections, a mast stepped forward with a battened lug sail,
  // a stern-sculling oar (橹) worked by a standing boatman, a poleman with a bamboo quant (篙) at the bow and sacks of
  // tax grain (漕粮) amidships. Bow +z, ≈0.065 units/m (a 12 m boat). r.color only tints the masthead pennant, so
  // fleets (渡江 1949) keep realistic wood.
  seaPatch(gp, 0.22, 0.44);
  const b = anim(gp, 'bob');
  const wood = '#7a5a3a', wl = 0.012;
  const { zt, wAt, sAt } = riverHull(b, 0.78, 0.085, wl, wood);
  // telescoping mat cabin (乌篷): three arched sections, the middle one largest, open ends dark inside
  const mat_ = '#3a3028';
  for (const [t0, t1, k] of [[0.3, 0.42, 0.94], [0.41, 0.56, 1], [0.55, 0.64, 0.9]] as const) {
    const arcs: V3[][] = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (i / 8), w = wAt((t0 + t1) / 2) * k + 0.006, y0 = sAt((t0 + t1) / 2) + 0.004;
      arcs.push([[-Math.cos(a) * w, y0 + Math.sin(a) * 0.085 * k, zt(t0)], [-Math.cos(a) * w, y0 + Math.sin(a) * 0.085 * k, zt(t1)]]);
    }
    skin(b, [arcs.map(q => q[0]), arcs.map(q => q[1])], mat_, { caps: false, closed: false, flat: true, paint: (x, y) => (Math.floor((x + y) * 160) % 3 ? null : '#4a4034') });
    const ang: V3[] = arcs.map(q => q[0]);
    for (const q of [ang, arcs.map(a => a[1])]) for (let i = 0; i < q.length - 1; i++) rod(b, q[i], q[i + 1], 0.003, '#2a221c', 3);
  }
  box(b, '#141210', 0, sAt(0.47), zt(0.47), wAt(0.47) * 1.3, 0.055, (zt(0.62) - zt(0.32)));
  // mast and battened lug sail of matting, forward of the cabin
  const tm = 0.72, ym = sAt(tm), zm = zt(tm);
  rod(b, [0, ym, zm], [0, ym + 0.44, zm + 0.01], 0.005, '#3b2a1d', 6);
  lugSail(b, 0, ym + 0.07, zm, 0.34, 0.17, 0.45, '#a8865a', 6);
  const pen = anim(b, 'flap', 0, ym + 0.44, zm + 0.01, { amp: 0.3 });
  slab(pen, [[0, 0], [0, -0.03], [-0.08, -0.015]], 0.003, str(r.color, '#a8352a'), 0, false).rotation.y = Math.PI / 2;
  // grain sacks and a covered bale between mast and cabin; a basket at the bow
  for (let k = 0; k < 5; k++) ellip(b, k % 2 ? '#b8a07a' : '#a48c66', -0.035 + (k % 3) * 0.035, sAt(0.66) + 0.016 + (k > 2 ? 0.02 : 0), zt(0.665) + (k % 2) * 0.012, 0.022, 0.015, 0.016, k * 0.6);
  cyl(b, '#8a6a3a', 0.03, sAt(0.88), zt(0.88), 0.016, 0.025, 8);
  // stern-sculling oar (橹) on its pivot, blade trailing in the water; boatman leaning on the handle
  const zs = zt(0.03), ys = sAt(0.03);
  const o = anim(b, 'sway', 0.015, ys + 0.01, zs, { amp: 0.3, speed: 1.8 });
  rod(o, [0, 0, 0], [0.02, wl - ys - 0.012, -0.17], 0.004, '#5a4030', 4);
  box(o, '#5a4030', 0.022, wl - ys - 0.02, -0.18, 0.004, 0.012, 0.045);
  rod(o, [0, 0, 0], [-0.005, 0.045, 0.1], 0.003, '#5a4030', 4);
  rod(o, [-0.005, 0.045, 0.1], [0.0, 0.0, 0.0], 0.001, '#c8b88a', 3);
  human(b, -0.005, sAt(0.18), zt(0.19), { h: 0.11, pose: 'stand', hands: [[0.05, 0.62, -0.28], [-0.05, 0.6, -0.26]], ry: Math.PI, top: '#3f4a5a', bottom: '#2e2a26', skin: '#a8764c', hat: '#c8a96a', hatStyle: 'conical', detail: 'lo' });
  // poleman with a bamboo quant at the bow
  human(b, 0.02, sAt(0.8), zt(0.8), { h: 0.105, pose: 'stand', hands: [[0.24, 0.62, 0.12], [0.3, 0.42, 0.22]], ry: 0.3, top: '#5a5248', bottom: '#2e2a26', skin: '#a8764c', hat: '#c8a96a', hatStyle: 'conical', detail: 'lo' });
  rod(b, [0.05, sAt(0.8) + 0.13, zt(0.77)], [0.12, wl - 0.01, zt(0.92)], 0.0025, '#b8a060', 4);
};

const fireship: Builder = (gp, r) => {
  // 赤壁 (208): one of Huang Gai's (黄盖) Han war galleys (斗舰 / 蒙冲) packed with dry reeds and brushwood soaked in oil,
  // screened with curtains and flying a dragon-tooth banner, set alight as the south-east wind drives it into Cao Cao's
  // chained fleet; the crew escape in the light boat (走舸) towed astern. Bow +z. r.color: banner.
  // r.style 'humen': Lin Zexu's 1839 opium destruction at 虎门 — not a fire: opium was broken into seawater-and-salt
  // pits, then lime was thrown in to make it seethe, and at ebb tide the sluice flushed it to the sea.
  if (r.style === 'humen') { humen(gp); return; }
  seaPatch(gp, 0.26, 0.47);
  const b = anim(gp, 'bob');
  const wood = '#4e3a28', wl = 0.012;
  const { zt, wAt, sAt } = riverHull(b, 0.74, 0.1, wl, wood, 0.06, 0.04);
  // 女墙: plank bulwark with oar ports along both sides, oars trailing abandoned
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const t = 0.18 + k * 0.1, w = wAt(t), s = sAt(t);
      box(b, '#6a4a30', sx * (w - 0.004), s + 0.008, zt(t), 0.006, 0.03, 0.068);
      box(b, '#1a1410', sx * (w - 0.001), s + 0.012, zt(t) + 0.03, 0.002, 0.008, 0.01);
      if (k % 2 === 0) rod(b, [sx * w, s + 0.016, zt(t) + 0.03], [sx * (w + 0.13), wl - 0.01, zt(t) - 0.02], 0.003, '#5a4030', 3);
    }
  }
  // the fire cargo: bundles of reeds and brushwood heaped under oiled curtains (帷幕)
  const dy = sAt(0.5);
  for (let k = 0; k < 14; k++) {
    const t = 0.2 + (k % 7) * 0.09, x = (k < 7 ? -0.035 : 0.035), y = dy + 0.012 + (k % 3) * 0.008;
    cyl(b, k % 2 ? '#b89a5a' : '#a08850', x, y, zt(t) - 0.035, 0.016, 0.07, 6).rotation.x = Math.PI / 2;
  }
  for (let k = 0; k < 5; k++) cyl(b, '#9a8048', 0, dy + 0.034, zt(0.24 + k * 0.12) - 0.035, 0.018, 0.07, 6).rotation.x = Math.PI / 2;
  slab(grp(b, -0.06, zt(0.5), 0, dy + 0.01), [[-0.12, 0], [0.12, 0], [0.1, 0.045], [-0.1, 0.05]], 0.004, '#6a2a1e', 0, false).rotation.y = Math.PI / 2;
  // mast with a mat sail driving before the wind, its foot already burning
  const tm = 0.58, ym = sAt(tm), zm = zt(tm);
  rod(b, [0, ym, zm], [0, ym + 0.42, zm], 0.006, '#2e2218', 6);
  lugSail(b, 0, ym + 0.1, zm, 0.3, 0.18, 0.15, '#7a6248', 6);
  // dragon-tooth war banner (牙旗) at the stern
  rod(b, [0, sAt(0.05), zt(0.05)], [0, sAt(0.05) + 0.3, zt(0.05)], 0.004, '#2e2218', 5);
  const fl = anim(b, 'flap', 0, sAt(0.05) + 0.3, zt(0.05), { amp: 0.25 });
  const fc = str(r.color, '#a8352a');
  const fo: [number, number][] = [[0, 0], [0, -0.09]];
  for (let k = 0; k <= 6; k++) fo.push([-0.02 - (k / 6) * 0.1, -0.09 + (k % 2 ? -0.012 : 0) + (k / 6) * 0.02]);
  fo.push([-0.13, -0.035], [-0.12, 0]);
  slab(fl, fo, 0.003, fc, 0, false).rotation.y = Math.PI / 2;
  // fire along the cargo and dense smoke rolling downwind
  for (const [t, x, s] of [[0.3, -0.03, 0.06], [0.42, 0.03, 0.08], [0.52, -0.02, 0.09], [0.64, 0.03, 0.07], [0.74, -0.01, 0.06], [0.84, 0.02, 0.045], [0.22, 0.02, 0.045]] as const) fire(b, x, dy + 0.03, zt(t), s);
  smoke(b, 0, dy + 0.18, zt(0.55), 0.05, 8, '#3a3430');
  smoke(b, 0.03, dy + 0.14, zt(0.35), 0.035, 6, '#4a4440');
  // 走舸 towed astern with two oarsmen pulling away
  const zb = zt(0) - 0.16;
  const B = grp(b, 0.04, zb, 0.15, 0);
  const sh: V3[][] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6, w = 0.032 * (0.35 + 0.65 * Math.sin(Math.PI * t)), z = (t - 0.5) * 0.2; sh.push([[-w, wl + 0.022, z], [-w * 0.8, wl - 0.008, z], [w * 0.8, wl - 0.008, z], [w, wl + 0.022, z]]); }
  skin(B, sh, '#5a4030', { caps: true, flat: true, paint: (_x, _y, _z, _nx, ny) => (ny > 0.6 ? '#7a5a3a' : null) });
  for (const [z, ph] of [[0.035, 0.1], [-0.03, 0.55]] as const) {
    human(B, 0, wl + 0.012, z, { h: 0.075, pose: 'row', phase: ph, top: '#5a3a2a', bottom: '#2e2a26', skin: '#a8764c', hair: '#1c1714', detail: 'min', ry: Math.PI });
    for (const sx of [-1, 1]) rod(B, [sx * 0.03, wl + 0.03, z], [sx * 0.09, wl - 0.01, z - 0.03], 0.002, '#5a4030', 3);
  }
  rod(b, [0, sAt(0.02) + 0.005, zt(0.01)], [0.04, wl + 0.03, zb + 0.1], 0.0015, '#c8b88a', 3);
};

/** 虎门销烟 (June 1839): two seawater pits on the beach at Humen with sluices to the sea, labourers breaking opium balls
 * and raking lime into the seething brine from plank walkways, chests of confiscated opium stacked by the pits, and Lin
 * Zexu with officials watching from a matshed pavilion under Qing yellow dragon banners. */
function humen(gp: THREE.Group): void {
  const floor = ground(gp, 0.46, '#c8b88a');
  // the sea (Pearl River mouth) along the left edge
  const sea: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.72 + (i / 12) * 0.56); sea.push([Math.cos(a) * 0.455, Math.sin(a) * 0.455]); }
  const sw = slab(gp, sea, 0.006, '#3f6f86', 0, false);
  sw.rotation.x = Math.PI / 2; sw.position.y = floor + 0.004;
  for (let k = 0; k < 5; k++) ellip(gp, '#dfeef0', -0.36 - (k % 2) * 0.03, floor + 0.006, -0.18 + k * 0.09, 0.005, 0.002, 0.035);
  // two pits: timber-lined, brine clouded with lime, sluice channels running out to the sea
  for (const pz of [-0.07, 0.15]) {
    const P_ = grp(gp, -0.02, pz, Math.PI / 2, floor);
    const w = 0.2, d = 0.17, sl = 0.2;
    for (const sz of [-1, 1]) box(P_, '#6a4a30', 0, -0.004, sz * (d / 2 + 0.006), w + 0.024, 0.012, 0.012);
    for (const sx of [-1, 1]) box(P_, '#6a4a30', sx * (w / 2 + 0.006), -0.004, 0, 0.012, 0.012, d);
    box(P_, '#8f897a', 0, -0.002, 0, w, 0.004, d);
    for (let k = 0; k < 9; k++) ellip(P_, k % 3 ? '#e4e0d4' : '#5a4a3a', -w / 2 + 0.02 + hash3(k, 3, pz) * (w - 0.04), 0.002, -d / 2 + 0.02 + hash3(k, 4, pz) * (d - 0.04), 0.012 + hash3(k, 5, 1) * 0.012, 0.002, 0.01);
    box(P_, '#4a5a5a', 0, -0.002, -d / 2 - sl / 2, 0.022, 0.004, sl);
    for (const sx of [-1, 1]) box(P_, '#6a4a30', sx * 0.016, -0.002, -d / 2 - sl / 2, 0.006, 0.01, sl);
    box(P_, '#5a3e2a', 0, 0, -d / 2 - 0.01, 0.034, 0.03, 0.006);
    // plank walkway across with a labourer raking lime into the brine
    box(P_, '#8a6a48', 0.02, 0.004, 0, 0.03, 0.006, d + 0.04);
    human(P_, 0.02, 0.01, 0.02, { h: 0.1, pose: 'stand', hands: [[0.12, 0.45, 0.22], [0.1, 0.62, 0.12]], top: '#5a5248', bottom: '#2e2a26', skin: '#a8764c', hair: '#1c1714', hatStyle: 'conical', hat: '#c8a96a', detail: 'lo', ry: -0.6 });
    rod(P_, [0.0, 0.07, 0.05], [-0.06, -0.002, 0.08], 0.0018, '#5a4030', 3);
    smoke(P_, 0.04, 0.0, -0.03, 0.015, 4, '#e8e6e0');
  }
  // lime heaps and chests of confiscated opium; a labourer carrying a chest to the pits
  for (let k = 0; k < 3; k++) cone(gp, '#ecebe4', 0.2 + k * 0.06, floor, -0.06 + (k % 2) * 0.04, 0.032, 0.035, 8);
  for (let k = 0; k < 8; k++) box(gp, '#6e4a2c', 0.18 + (k % 3) * 0.045, floor + Math.floor(k / 3) * 0.03, 0.14 + (k % 2) * 0.006, 0.04, 0.03, 0.035, 0.05 * k);
  human(gp, 0.12, floor, 0.3, { h: 0.1, pose: 'carry', top: '#5a5248', bottom: '#2e2a26', skin: '#a8764c', hair: '#1c1714', detail: 'lo', ry: -1.2 });
  box(gp, '#6e4a2c', 0.12, floor + 0.098, 0.3, 0.04, 0.03, 0.035, -1.2);
  // matshed pavilion (礼台) behind the pits: plank platform, posts, a yellow awning; Lin Zexu and officials in Qing robes
  const T = grp(gp, 0.1, -0.3, 0, floor);
  box(T, '#7a5a3a', 0, 0, 0, 0.3, 0.03, 0.12);
  for (let k = 0; k < 3; k++) box(T, '#6a4a30', 0, 0, 0.065 + k * 0.012, 0.08, 0.03 - k * 0.01, 0.012);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(T, [sx * 0.14, 0.03, sz * 0.05], [sx * 0.14, 0.17, sz * 0.05], 0.004, '#3a2a1e', 4);
  roof(T, 0, 0.17, 0, 0.3, 0.12, 0.04, '#c8a040', { kind: 'gable', ov: 0.015, lift: 0.1, plain: true });
  box(T, '#a8352a', 0, 0.16, 0.061, 0.3, 0.012, 0.002);
  for (const [x, c, hat] of [[0, '#2a3a5a', '#a8352a'], [-0.08, '#3a3a4a', '#a8352a'], [0.08, '#3a3a4a', '#a8352a']] as const) {
    human(T, x, 0.03, 0.0, { h: 0.11, pose: x === 0 ? 'point' : 'stand', top: c, bottom: c, dress: 'ankle', skin: '#b8865c', hair: '#1c1714', hatStyle: 'qing', hat, detail: 'lo', ry: x === 0 ? -0.3 : x > 0 ? -0.3 : 0.3 });
  }
  // Qing yellow triangular dragon banners
  for (const bx of [-0.1, 0.3]) {
    rod(gp, [bx, floor, -0.22], [bx, floor + 0.32, -0.22], 0.004, '#3a2a1e', 5);
    const fl = anim(gp, 'flap', bx, floor + 0.32, -0.22, { amp: 0.25 });
    slab(fl, [[0, 0], [0, -0.1], [-0.12, -0.01]], 0.003, '#d8b030', 0, false).rotation.y = Math.PI / 2;
    ellip(fl, '#2f5fa0', 0, -0.035, -0.035, 0.003, 0.012, 0.016);
  }
}

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

/** Points along a circular arch of chord `span` and rise `f` springing at (x0 ± span/2, y0), left to right; `off` grows the radius. */
function segArc(x0: number, y0: number, span: number, f: number, off = 0, n = 16): [number, number][] {
  const R = (span * span / 4 + f * f) / (2 * f), cy = y0 + f - R, a0 = Math.asin(Math.min(1, span / 2 / R));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = -a0 + (2 * a0 * i) / n; out.push([x0 + Math.sin(a) * (R + off), cy + Math.cos(a) * (R + off)]); }
  return out;
}

/** Stone arch ring (券) of thickness t, extruded `depth` along z, with voussoir joints scored on both faces. */
function ringBand(p: THREE.Object3D, x0: number, y0: number, span: number, f: number, t: number, depth: number, c: string, joints = 0): void {
  const n = Math.max(8, joints);
  const outer = segArc(x0, y0, span, f, t, n), inner = segArc(x0, y0, span, f, 0, n);
  slab(p, [...outer, ...inner.slice().reverse()], depth, c, 0, false);
  for (let i = 1; i < joints; i++) {
    const [ox, oy] = outer[i], [ix, iy] = inner[i], a = Math.atan2(ox - ix, oy - iy);
    for (const sz of [-1, 1]) box(p, shade(c, 0.72), (ox + ix) / 2, (oy + iy) / 2 - t / 2, sz * (depth / 2 + 0.0004), 0.0012, t, 0.0008, 0, 0, -a);
  }
}

/** A river strip running along z between x0 and x1, clipped to the base disc of radius R. */
function riverStrip(p: THREE.Object3D, x0: number, x1: number, R: number, y: number, c = '#4f7f8f'): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) { const x = x0 + ((x1 - x0) * i) / 8; pts.push([x, -Math.sqrt(Math.max(0, R * R - x * x))]); }
  for (let i = 8; i >= 0; i--) { const x = x0 + ((x1 - x0) * i) / 8; pts.push([x, Math.sqrt(Math.max(0, R * R - x * x))]); }
  const w = slab(p, pts, 0.004, c, 0, false);
  w.rotation.x = Math.PI / 2; w.position.y = y;
  w.material = mat(c, { transparent: 0.85, rough: 0.25 });
  for (let k = 0; k < 6; k++) ellip(p, '#9cc3d0', x0 + 0.05 + hash3(k, 7, 2) * (x1 - x0 - 0.1), y + 0.001, -0.3 + k * 0.12, 0.004, 0.0015, 0.03);
}

/** Balustrade along a deck profile y(x) at z: posts every `step`, panels between; `cap` decorates each post head. */
function balustrade(p: THREE.Object3D, x0: number, x1: number, z: number, y: (x: number) => number, step: number, h: number, c: string, cap?: (x: number, y: number) => void): void {
  const n = Math.max(1, Math.round((x1 - x0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    box(p, c, x, y(x), z, 0.006, h, 0.006);
    if (cap) cap(x, y(x) + h);
    if (i < n) {
      const xb = x0 + ((x1 - x0) * (i + 1)) / n, mx = (x + xb) / 2, a = Math.atan2(y(xb) - y(x), xb - x);
      box(p, shade(c, 0.93), mx, y(mx) + 0.001, z, (xb - x) / Math.cos(a) - 0.005, h * 0.62, 0.0035, 0, 0, a);
    }
  }
}

const bridge: Builder = (gp, r) => {
  // Default 赵州桥 / 安济桥 (Li Chun, 595–605): the world's oldest open-spandrel segmental stone arch — 37 m span with a
  // 7.2 m rise (≈1:5), 28 parallel ring courses, two small arches on each shoulder to lighten it and pass floods, a gently
  // humped deck 9 m wide with carved stone balustrades. ≈0.018 units/m. r.style 'hongqiao': the Song timber "rainbow
  // bridge" of 清明上河图 (Bianliang, c. 1120) — interlocking log arch systems, no piers, crowds and stalls on the deck.
  // r.style 'lugou': 卢沟桥 (Jin, 1192) — eleven stone arches on piers with iron-shod cutwaters, lion-topped posts.
  const style = str(r.style, '');
  if (style === 'hongqiao') { hongqiao(gp); return; }
  if (style === 'lugou') { lugou(gp); return; }
  const floor = ground(gp, 0.47, '#7a8a52');
  riverStrip(gp, -0.31, 0.31, 0.455, floor + 0.002);
  for (const sx of [-1, 1]) box(gp, '#8a8070', sx * 0.32, floor - 0.002, 0, 0.03, 0.006, 0.64);
  const st = '#bdb6a6', W = 0.16, S = 0.68, f = 0.13, t = 0.026, half = 0.47, base = floor;
  const R = (S * S / 4 + f * f) / (2 * f), cy = base + f - R;
  const yc = base + f + t + 0.016, k = (yc - base - 0.05) / (half * half);
  const deckY = (x: number) => yc - k * x * x;
  const ext = (x: number) => cy + Math.sqrt((R + t) ** 2 - x * x);
  const xs = S / 2 * (R + t) / R, ys = base + (R - f) / R * t;
  const notches: [number, number][] = [[-0.275, 0.036], [-0.19, 0.025], [0.19, 0.025], [0.275, 0.036]];
  // spandrel walls and deck mass, the four shoulder arches cut out of it
  const out: [number, number][] = [[-half, base], [-S / 2, base], [-xs, ys]];
  let x = -xs + 0.02;
  for (const [c, rr] of notches) {
    for (; x < c - rr; x += 0.02) out.push([x, ext(x)]);
    const sy = Math.max(ext(c - rr), ext(c + rr));
    out.push([c - rr, ext(c - rr)], [c - rr, sy]);
    for (let i = 1; i < 10; i++) { const a = Math.PI - (Math.PI * i) / 10; out.push([c + Math.cos(a) * rr, sy + Math.sin(a) * rr]); }
    out.push([c + rr, sy], [c + rr, ext(c + rr)]);
    x = c + rr + 0.02;
  }
  for (; x < xs; x += 0.02) out.push([x, ext(x)]);
  out.push([xs, ys], [S / 2, base], [half, base]);
  for (let i = 0; i <= 24; i++) { const xx = half - (2 * half * i) / 24; out.push([xx, deckY(xx)]); }
  slab(gp, out, W, st, 0, false);
  // the main ring and the shoulder rings stand slightly proud, joints scored; iron cramps (腰铁) across the courses
  ringBand(gp, 0, base, S, f, t, W + 0.006, shade(st, 0.94), 30);
  for (const [c, rr] of notches) ringBand(gp, c, Math.max(ext(c - rr), ext(c + rr)), rr * 2, rr, 0.007, W + 0.005, shade(st, 0.94), 9);
  for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25, px = Math.sin(a) * (R + t * 0.5); box(gp, '#3a3a3a', px, cy + Math.cos(a) * (R + t * 0.5) - 0.002, W / 2 + 0.0035, 0.008, 0.004, 0.001, 0, 0, -a); }
  // deck paving and carved balustrades; steps down to the banks
  for (let i = 0; i < 24; i++) { const xx = -half + 0.02 + i * 0.039; box(gp, shade(st, 0.88), xx, deckY(xx), 0, 0.001, 0.0008, W - 0.02); }
  for (const sz of [-1, 1]) balustrade(gp, -half + 0.02, half - 0.02, sz * (W / 2 - 0.004), deckY, 0.04, 0.022, '#cbc5b6', (px, py) => ellip(gp, '#cbc5b6', px, py + 0.002, sz * (W / 2 - 0.004), 0.004, 0.004, 0.004));
  // travellers: a porter with a shoulder pole, a walker, a man leading a donkey
  const tr = (xx: number, z: number, o: Partial<HumanOpts>) => human(gp, xx, deckY(xx), z, { h: 0.05, detail: 'lo', skin: '#b08458', hair: '#1c1714', bottom: '#3a3128', ...o } as HumanOpts);
  tr(-0.1, 0.03, { pose: 'carry', top: '#5a6a7a', hatStyle: 'conical', hat: '#c8a96a', ry: Math.PI / 2 });
  tr(0.06, -0.035, { pose: 'walk', top: '#7a5a3a', ry: -Math.PI / 2 });
  tr(0.22, 0.02, { pose: 'walk', top: '#4a4a52', hatStyle: 'knot', ry: -Math.PI / 2, phase: 0.4 });
  const D = grp(gp, 0.3, 0.02, -Math.PI / 2, deckY(0.3));
  D.scale.setScalar(0.11);
  horse(D, '#6a5a4a');
  // willows and fields on the banks
  for (const [tx, tz] of [[-0.38, -0.2], [-0.4, 0.15], [0.38, -0.22], [0.4, 0.2], [-0.36, -0.32]] as const) {
    rod(gp, [tx, floor, tz], [tx, floor + 0.07, tz], 0.006, '#5a4a3a', 5);
    for (let k = 0; k < 5; k++) ellip(gp, k % 2 ? '#7a9a4a' : '#6a8a42', tx + Math.cos(k * 1.3) * 0.02, floor + 0.05 + (k % 3) * 0.02, tz + Math.sin(k * 1.3) * 0.02, 0.025, 0.04, 0.025);
  }
};

/** 虹桥 of 清明上河图 (Northern Song Bianliang): a pierless woven-timber arch (编木拱) of two interlocking systems of
 * logs (three-segment and four-segment) lashed to cross-beams, a planked deck with railings and the four tall marker
 * posts (华表) at the ends, vendors' parasols and crowds on top, a grain boat lowering its mast to pass beneath. */
function hongqiao(gp: THREE.Group): void {
  const floor = ground(gp, 0.47, '#8a8a62');
  riverStrip(gp, -0.29, 0.29, 0.455, floor + 0.002, '#5f8a8a');
  for (const sx of [-1, 1]) {
    box(gp, '#9a9080', sx * 0.305, floor - 0.01, 0, 0.03, 0.03, 0.66);
    for (let k = 0; k < 5; k++) box(gp, '#7a7264', sx * 0.321, floor + 0.004 * (k % 2), -0.26 + k * 0.13, 0.002, 0.016, 0.1);
  }
  const wd = '#6a4a30', S = 0.6, f = 0.14, W = 0.2, base = floor + 0.005;
  const ay = (x: number) => base + f * (1 - (x / (S / 2)) ** 2);
  // two interlocking arch systems: 3-segment logs (A) and 4-segment logs (B), alternating across the width
  const A = [-0.3, -0.12, 0.12, 0.3], B = [-0.25, -0.2, -0.07, 0.07, 0.2, 0.25];
  const ya = (x: number) => (Math.abs(x) > 0.29 ? base : ay(x));
  const yb = (x: number) => (Math.abs(x) > 0.24 ? base + 0.03 : ay(x) + 0.012);
  for (let j = 0; j < 9; j++) {
    const z = -W / 2 + 0.01 + j * ((W - 0.02) / 8), sys = j % 2 ? B.slice(1, -1) : A, y = j % 2 ? yb : ya;
    const pts = j % 2 ? [-0.3, ...sys, 0.3] : sys;
    for (let i = 0; i < pts.length - 1; i++) rod(gp, [pts[i], j % 2 && i === 0 ? base : y(pts[i]), z], [pts[i + 1], j % 2 && i === pts.length - 2 ? base : y(pts[i + 1]), z], 0.0065, j % 2 ? shade(wd, 0.9) : wd, 5);
  }
  for (const xx of [-0.12, 0.12, -0.2, -0.07, 0.07, 0.2]) {
    const yy = A.includes(xx) ? ya(xx) : yb(xx);
    rod(gp, [xx, yy + 0.004, -W / 2 - 0.012], [xx, yy + 0.004, W / 2 + 0.012], 0.007, '#4a3424', 5);
  }
  // planked deck humped over the arch, ramps to the banks
  const top = (x: number) => (Math.abs(x) <= 0.3 ? ay(x) * 0.85 + (base + f) * 0.15 + 0.03 : base + 0.03 - (Math.abs(x) - 0.3) * 0.15);
  const prof: [number, number][] = [];
  for (let i = 0; i <= 22; i++) { const xx = -0.42 + (0.84 * i) / 22; prof.push([xx, top(xx)]); }
  for (let i = 22; i >= 0; i--) { const xx = -0.42 + (0.84 * i) / 22; prof.push([xx, top(xx) - 0.008]); }
  slab(gp, prof, W, '#8a6a48', 0, false);
  for (let i = 0; i < 28; i++) { const xx = -0.41 + i * 0.03; box(gp, '#6a5038', xx, top(xx), 0, 0.001, 0.0008, W); }
  for (const sz of [-1, 1]) balustrade(gp, -0.4, 0.4, sz * (W / 2 - 0.004), top, 0.04, 0.024, '#5a3e2a');
  // 华表 marker posts with cross-boards at the four corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * 0.37, pz = sz * (W / 2 + 0.02);
    rod(gp, [px, floor, pz], [px, floor + 0.28, pz], 0.004, '#4a3424', 5);
    box(gp, '#5a3e2a', px, floor + 0.24, pz, 0.004, 0.006, 0.04);
    ellip(gp, '#e8e0d0', px, floor + 0.285, pz, 0.006, 0.004, 0.012);
  }
  // vendors' parasols and the crowd
  for (const [xx, z, c] of [[-0.2, -0.06, '#c8b88a'], [0.17, 0.065, '#b8a87a']] as const) {
    rod(gp, [xx, top(xx), z], [xx, top(xx) + 0.1, z], 0.0025, '#3a2a1e', 4);
    cone(gp, c, xx, top(xx) + 0.08, z, 0.06, 0.035, 10);
    box(gp, '#7a5a3a', xx + 0.02, top(xx), z, 0.04, 0.02, 0.025);
    human(gp, xx - 0.02, top(xx), z, { h: 0.055, pose: 'sit', top: '#5a5248', bottom: '#3a3128', skin: '#b08458', hair: '#1c1714', detail: 'min' });
  }
  const tops = ['#3f5f7a', '#7a5a3a', '#e0d8c4', '#5a6a4a', '#8a3a2a', '#4a4a52', '#c8b088', '#3a3a3a'];
  for (let k = 0; k < 9; k++) {
    const xx = -0.33 + k * 0.08 + hash3(k, 1, 9) * 0.02, z = (hash3(k, 2, 9) - 0.5) * 0.12, pose = k % 3 === 0 ? 'carry' : k % 4 === 1 ? 'point' : 'walk';
    human(gp, xx, top(xx), z, { h: 0.055, pose, phase: k * 0.3, top: tops[k % 8], bottom: '#3a3128', skin: '#b08458', hair: '#1c1714', hatStyle: k % 2 ? 'knot' : 'conical', hat: '#c8a96a', detail: 'min', ry: k % 2 ? Math.PI / 2 : -Math.PI / 2 });
  }
  // grain boat passing under with its mast lowered, crew poling
  const Bt = grp(gp, -0.02, 0.27, 0.12, floor + 0.002);
  const { sAt, zt } = riverHull(Bt, 0.36, 0.05, 0.004, '#6a4a30', 0.03, 0.02);
  rod(Bt, [0, sAt(0.55) + 0.01, zt(0.55)], [0.01, sAt(0.1) + 0.05, zt(-0.3)], 0.004, '#3b2a1d', 5);
  rbox(Bt, '#3a3028', 0, sAt(0.4), zt(0.4), 0.07, 0.03, 0.08, 0.01);
  human(Bt, 0.02, sAt(0.75), zt(0.75), { h: 0.055, pose: 'stand', hands: [[0.25, 0.6, 0.1], [0.3, 0.4, 0.2]], top: '#5a5248', bottom: '#2e2a26', skin: '#a8764c', hair: '#1c1714', detail: 'min' });
  rod(Bt, [0.03, sAt(0.75) + 0.05, zt(0.75)], [0.08, 0, zt(0.95)], 0.0018, '#b8a060', 3);
}

/** 卢沟桥 (Jin 1189–1192, 266 m): eleven segmental stone arches on boat-shaped piers whose upstream noses carry iron
 * "dragon-slaying swords" against ice, a nearly level deck lined with lion-topped posts, 华表 and a stele at the ends. */
function lugou(gp: THREE.Group): void {
  const floor = ground(gp, 0.47, '#9a9070');
  riverStrip(gp, -0.34, 0.34, 0.455, floor + 0.002, '#6a8a88');
  for (const [x0, z0] of [[-0.2, 0.22], [0.12, -0.25]] as const) ellip(gp, '#c8b890', x0, floor + 0.002, z0, 0.08, 0.004, 0.035);
  const st = '#b8b2a4', W = 0.075, L = 0.88, base = floor;
  const spans = [0.044, 0.048, 0.052, 0.056, 0.059, 0.062, 0.059, 0.056, 0.052, 0.048, 0.044], pier = 0.024;
  const total = spans.reduce((a, b) => a + b, 0) + pier * 10;
  const deck = (x: number) => base + 0.068 + 0.012 * (1 - (x / (L / 2)) ** 2);
  const out: [number, number][] = [[-L / 2, base]];
  const arches: [number, number][] = [];
  let x = -total / 2;
  for (let i = 0; i < 11; i++) {
    const s = spans[i], sp = base + 0.01;
    out.push([x, base], [x, sp]);
    for (let k = 1; k < 10; k++) { const a = Math.PI - (Math.PI * k) / 10; out.push([x + s / 2 + Math.cos(a) * s / 2, sp + Math.sin(a) * s * 0.42]); }
    out.push([x + s, sp], [x + s, base]);
    arches.push([x + s / 2, s]);
    x += s + pier;
  }
  out.push([L / 2, base]);
  for (let i = 0; i <= 20; i++) { const xx = L / 2 - (L * i) / 20; out.push([xx, deck(xx)]); }
  slab(gp, out, W, st, 0, false);
  for (const [c, s] of arches) ringBand(gp, c, base + 0.01, s, s * 0.42, 0.006, W + 0.004, shade(st, 0.93), 9);
  // upstream cutwaters with iron blades, rounded downstream ends
  for (let i = 0; i < 10; i++) {
    let px = -total / 2;
    for (let j = 0; j <= i; j++) px += spans[j] + (j < i ? pier : 0);
    px += pier / 2;
    const N = grp(gp, px, -W / 2, 0, base + 0.025);
    N.rotation.x = -Math.PI / 2;
    slab(N, [[-pier / 2, 0], [pier / 2, 0], [0, 0.03]], 0.05, shade(st, 0.95), 0, false);
    box(gp, '#3a3a3e', px, base + 0.01, -W / 2 - 0.03, 0.002, 0.03, 0.006);
    cyl(gp, shade(st, 0.95), px, base, W / 2, pier / 2, 0.05, 8);
  }
  // deck and lion-post balustrades
  for (const sz of [-1, 1]) balustrade(gp, -L / 2 + 0.01, L / 2 - 0.01, sz * (W / 2 - 0.003), deck, 0.024, 0.016, '#cbc5b6', (px, py) => ellip(gp, '#a8a090', px, py + 0.003, sz * (W / 2 - 0.003), 0.0035, 0.004, 0.003));
  // 华表 pairs and a stele pavilion at the east end; travellers and a camel-like caravan horse
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hx = sx * (L / 2 - 0.02), hz = sz * (W / 2 + 0.025);
    cyl(gp, '#d8d2c4', hx, floor, hz, 0.006, 0.12, 8);
    box(gp, '#d8d2c4', hx, floor + 0.1, hz, 0.004, 0.006, 0.03);
    cyl(gp, '#d8d2c4', hx, floor + 0.12, hz, 0.01, 0.006, 8);
    ellip(gp, '#c8c2b4', hx, floor + 0.13, hz, 0.005);
  }
  const Pv = grp(gp, 0.39, 0.15, 0, floor);
  box(Pv, '#cfc8b8', 0, 0, 0, 0.06, 0.012, 0.06);
  box(Pv, '#8a8478', 0, 0.012, 0, 0.012, 0.04, 0.008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(Pv, '#a8352a', sx * 0.022, 0.012, sz * 0.022, 0.003, 0.05, 6);
  roof(Pv, 0, 0.062, 0, 0.05, 0.05, 0.03, '#d6a840', { kind: 'pyramid', ov: 0.012 });
  for (let k = 0; k < 4; k++) {
    const xx = -0.3 + k * 0.17;
    human(gp, xx, deck(xx), (k % 2 ? 1 : -1) * 0.014, { h: 0.04, pose: 'walk', phase: k * 0.3, top: ['#3f5f7a', '#7a5a3a', '#5a6a4a', '#4a4a52'][k], bottom: '#3a3128', skin: '#b08458', hair: '#1c1714', detail: 'min', ry: k % 2 ? Math.PI / 2 : -Math.PI / 2 });
  }
}

const cannon: Builder = (gp, r) => {
  // Default: a Qing 红衣大炮 (cf. the bronze 神威无敌大将军 of 1676, 2.5 m, ≈1 t, used against Albazin/雅克萨 in 1685):
  // a tapering muzzle-loader with reinforcing rings, trunnions and a cascabel, the red cloth (红衣) that named the type
  // draped over its breech, on a two-wheeled timber carriage with a long trail behind a rammed-earth breastwork; Qing
  // gunners in 号衣 with linstock and rammer, a stack of iron shot and powder kegs. Points +z (battle props aim it at the
  // enemy). r.color: banner. r.style 'field': a 1900s Krupp-pattern 75 mm field gun (Hanyang-arsenal copy) of the
  // 1911 Wuchang / 1927 Nanchang risings — steel barrel on a recoil cradle, shield, box trail, New Army crew in grey with
  // white armbands behind sandbags, and the eighteen-star iron-and-blood flag (铁血十八星旗) unless r.color is given.
  if (r.style === 'field') { fieldGun(gp, r); return; }
  const floor = ground(gp, 0.44, '#8a7a5a');
  // rammed-earth breastwork curving round the front, an embrasure cut for the muzzle
  for (const [a0, a1] of [[-1.15, 0.16], [0.44, 1.2]] as const) {
    const rings: V3[][] = [];
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10, sa = Math.sin(a), ca = Math.cos(a);
      rings.push(([[0.36, 0], [0.345, 0.05], [0.315, 0.05], [0.29, 0]] as const).map(([rr, y]) => [sa * rr, floor + y, ca * rr - 0.02] as V3));
    }
    skin(gp, rings, '#9a845e', { caps: true, flat: true, paint: (_x, y, _z, _nx, ny) => (ny > 0.8 ? '#8a7a52' : Math.floor((y - floor) * 90) % 2 ? null : '#8e7854') });
  }
  const C = grp(gp, 0.02, -0.02, 0.3, floor);
  // carriage: two cheeks running down into a long trail, axle-tree and spoked wheels
  const wd = '#5a3e2a';
  for (const sx of [-1, 1]) slab(grp(C, sx * 0.03, 0, Math.PI / 2, 0), [[0.08, 0.05], [0.07, 0.11], [-0.03, 0.105], [-0.24, 0.0], [-0.26, 0.0], [-0.24, 0.022], [-0.02, 0.07], [0.04, 0.05]], 0.012, wd, 0, false).rotation.y = -Math.PI / 2;
  box(C, shade(wd, 0.85), 0, 0.055, 0.03, 0.12, 0.02, 0.03);
  for (const sx of [-1, 1]) { wheel(C, sx * 0.075, 0.068, 0.03, 0.068, wd, 12); cyl(C, '#2a2a2a', sx * 0.075, 0.068, 0.03, 0.012, 0.012, 8).rotation.z = Math.PI / 2; }
  for (const z of [-0.06, -0.14]) box(C, '#2a2a2a', 0, 0.06 + z * 0.3, z, 0.07, 0.006, 0.006);
  // the barrel along +z: breech, rings, taper, muzzle swell; cascabel knob behind; trunnions on the cheeks
  const br = '#4e4232';
  const B = grp(C, 0, 0.0, 0, 0.115);
  B.rotation.x = Math.PI / 2 - 0.06;
  const prof: [number, number][] = [[0, -0.215], [0.012, -0.214], [0.013, -0.2], [0.008, -0.195], [0.03, -0.19], [0.042, -0.178], [0.043, -0.12], [0.046, -0.115], [0.046, -0.105], [0.04, -0.1], [0.038, -0.02], [0.041, -0.015], [0.041, -0.005], [0.035, 0], [0.03, 0.12], [0.033, 0.125], [0.033, 0.135], [0.028, 0.14], [0.026, 0.2], [0.033, 0.21], [0.034, 0.225], [0.016, 0.227], [0.016, 0.2]];
  const bar = lathe(B, prof, br, 0, 0, 0, 16);
  bar.material = mat(br, { metal: 0.55, rough: 0.4 });
  for (const sx of [-1, 1]) cyl(B, br, sx * 0.03, -0.035, 0, 0.011, 0.025, 8).rotation.z = Math.PI / 2;
  ellip(B, '#1a1612', 0, 0.226, 0, 0.012, 0.002, 0.012);
  // the red cloth over the breech, its fringed ends hanging
  const drape: V3[][] = [];
  for (let i = 0; i <= 4; i++) {
    const zz = -0.16 + i * 0.03, ring: V3[] = [];
    for (let j = 0; j <= 10; j++) { const a = Math.PI * (j / 10), rr = 0.047 + 0.002 * Math.sin(i * 2); ring.push([Math.cos(a) * rr * (1 + 0.15 * Math.abs(Math.cos(a))), zz, -Math.sin(a) * rr]); }
    ring.unshift([ring[0][0] + 0.006, zz, 0.035]); ring.push([ring[ring.length - 1][0] - 0.006, zz, 0.035]);
    drape.push(ring);
  }
  skin(B, drape, '#b0302a', { closed: false, flat: true });
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) box(B, '#d8b030', sx * 0.053, -0.155 + k * 0.028, 0.035, 0.002, 0.004, 0.006);
  // iron shot stacked in a pyramid, powder kegs, rammer and sponge
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3 - l; i++) for (let j = 0; j < 3 - l; j++) ellip(gp, '#2a2a2e', -0.25 + (i + l * 0.5) * 0.026, floor + 0.013 + l * 0.021, 0.02 + (j + l * 0.5) * 0.026, 0.013);
  for (let k = 0; k < 3; k++) { const kx = 0.22 + (k % 2) * 0.05, kz = -0.12 + k * 0.045; lathe(gp, [[0, 0], [0.02, 0], [0.024, 0.025], [0.02, 0.05], [0, 0.05]], '#6a4a2c', kx, floor, kz, 10); for (const y of [0.01, 0.04]) lathe(gp, [[0.023, y], [0.0235, y + 0.004]], '#2a2a2a', kx, floor, kz, 10); }
  // Qing gunners: red-bordered tunics with the round 兵 patch, warm-weather hats
  const crew = (x: number, z: number, ry: number, o: Partial<HumanOpts>) => {
    const H = grp(gp, x, z, ry, floor);
    human(H, 0, 0, 0, { h: 0.2, top: '#2f4a7a', bottom: '#2a2620', skin: '#b08458', hair: '#1c1714', hatStyle: 'qing', hat: '#3a2a1e', detail: 'lo', ...o } as HumanOpts);
    return H;
  };
  const g1 = crew(-0.14, -0.16, 0.6, { pose: 'stand', hands: [[0.2, 0.55, 0.35], [-0.12, 0.45, 0.05]] });
  rod(g1, [0.04, 0.11, 0.07], [0.09, 0.15, 0.13], 0.003, wd, 4);
  ellip(g1, '#ea580c', 0.09, 0.152, 0.13, 0.004);
  // loader at the muzzle driving the charge home with the rammer
  crew(0.25, 0.26, -Math.PI / 2 - 0.15, { pose: 'stand', hands: [[0.08, 0.58, 0.32], [-0.08, 0.56, 0.18]] });
  rod(gp, [0.075, floor + 0.12, 0.19], [0.34, floor + 0.1, 0.25], 0.0035, wd, 4);
  cyl(gp, '#4a3a2a', 0.34, floor + 0.088, 0.25, 0.012, 0.024, 8).rotation.z = Math.PI / 2;
  crew(-0.2, 0.08, 0.2, { pose: 'carry' });
  // banner: square with a flame-tooth border on a tall pole
  const fc = str(r.color, '#d8b030');
  rod(gp, [-0.33, floor, -0.15], [-0.33, floor + 0.42, -0.15], 0.005, '#3a2a1e', 5);
  const fl = anim(gp, 'flap', -0.33, floor + 0.42, -0.15, { amp: 0.25 });
  slab(fl, [[0, 0], [0, -0.13], [-0.12, -0.13], [-0.12, 0]], 0.003, fc, 0, false).rotation.y = Math.PI / 2;
  for (let k = 0; k < 5; k++) slab(fl, [[-0.12, -0.005 - k * 0.026], [-0.12, -0.021 - k * 0.026], [-0.138, -0.013 - k * 0.026]], 0.003, '#a8352a', 0, false).rotation.y = Math.PI / 2;
};

/** Krupp-pattern 75 mm field gun of the 1911 revolution, crewed behind sandbags (see `cannon`). */
function fieldGun(gp: THREE.Group, r: ModelRecipe): void {
  const floor = ground(gp, 0.44, '#7a7458');
  // sandbag emplacement curving round the front
  for (let row = 0; row < 3; row++) for (let i = 0; i < 11 - row; i++) {
    const a = -0.95 + (i + row * 0.5) * 0.19, R = 0.29;
    ellip(gp, row % 2 ? '#b0a07a' : '#a49470', Math.sin(a) * R, floor + 0.012 + row * 0.02, Math.cos(a) * R - 0.04, 0.03, 0.012, 0.018, a);
  }
  const G = grp(gp, 0, -0.06, 0.25, floor);
  const steel = '#4a5048', wd = '#5a4030';
  // box trail to a spade, axle, two wooden artillery wheels
  rod(G, [0, 0.07, 0.02], [0, 0.008, -0.27], 0.014, steel, 4);
  box(G, steel, 0, 0, -0.275, 0.05, 0.02, 0.008);
  for (const sx of [-1, 1]) wheel(G, sx * 0.085, 0.078, 0.02, 0.078, wd, 12);
  rod(G, [-0.09, 0.078, 0.02], [0.09, 0.078, 0.02], 0.008, steel, 6);
  // shield with a sight notch, cradle with recoil cylinder, slim barrel, breech and sight
  const sh = grp(G, 0, 0.06, 0, 0.045);
  sh.rotation.x = -0.12;
  slab(sh, [[-0.1, 0], [0.1, 0], [0.1, 0.12], [0.02, 0.12], [0.02, 0.095], [-0.02, 0.095], [-0.02, 0.12], [-0.1, 0.12]], 0.004, steel, 0, false);
  for (const sx of [-1, 1]) box(sh, shade(steel, 0.8), sx * 0.1, 0, 0, 0.006, 0.12, 0.006);
  const Bb = grp(G, 0, 0.0, 0, 0.11);
  Bb.rotation.x = -0.08;
  rod(Bb, [0, -0.012, -0.1], [0, -0.012, 0.12], 0.016, shade(steel, 1.1), 10);
  rod(Bb, [0, 0.008, -0.12], [0, 0.008, 0.3], 0.011, steel, 10);
  ellip(Bb, steel, 0, 0.008, 0.3, 0.013, 0.013, 0.006);
  box(Bb, shade(steel, 0.8), 0, -0.01, -0.15, 0.035, 0.035, 0.05);
  box(Bb, '#2a2a2a', -0.03, 0.01, -0.06, 0.006, 0.03, 0.006);
  // ammunition chest with brass shells
  box(gp, '#5a5a42', -0.24, floor, -0.12, 0.09, 0.04, 0.06, 0.3);
  for (let k = 0; k < 4; k++) cyl(gp, '#c8a040', -0.27 + k * 0.02, floor + 0.04, -0.12, 0.007, 0.03, 8);
  // New Army crew: grey uniforms, peaked caps, white armbands of the revolution
  const crew = (x: number, z: number, ry: number, o: Partial<HumanOpts>) => {
    const H = grp(gp, x, z, ry, floor);
    human(H, 0, 0, 0, { h: 0.2, top: '#5c6156', bottom: '#4a4e46', skin: '#b08458', hair: '#1c1714', hatStyle: 'peaked', hat: '#4a4e46', detail: 'lo', ...o } as HumanOpts);
  };
  crew(-0.12, -0.2, 0.5, { pose: 'crouch' });
  crew(0.14, -0.22, -0.4, { pose: 'kneel' });
  crew(-0.25, -0.02, 0.6, { pose: 'point' });
  // flag: eighteen-star iron-and-blood flag (red, black nine-pointed star, yellow discs) unless a colour is given
  rod(gp, [0.3, floor, -0.2], [0.3, floor + 0.44, -0.2], 0.005, '#3a2a1e', 5);
  const fl = anim(gp, 'flap', 0.3, floor + 0.44, -0.2, { amp: 0.25 });
  const F = grp(fl, 0, 0, Math.PI / 2, 0);
  slab(F, [[0, 0], [0, -0.13], [-0.19, -0.13], [-0.19, 0]], 0.003, str(r.color, '#b8282a'), 0, false);
  if (!r.color) {
    const star: [number, number][] = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = i % 2 ? 0.024 : 0.055; star.push([-0.095 + Math.sin(a) * rr, -0.065 + Math.cos(a) * rr]); }
    slab(F, star, 0.004, '#141414', 0, false);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      for (const rr of [0.04, 0.018]) ellip(F, '#e8c040', -0.095 + Math.sin(a + (rr < 0.03 ? 0.35 : 0)) * rr, -0.065 + Math.cos(a + (rr < 0.03 ? 0.35 : 0)) * rr, 0, 0.004, 0.004, 0.0035);
    }
  }
}

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
  // 人民英雄纪念碑 (1958, Tiananmen Square; 37.94 m): a 海棠-shaped lower terrace and a square upper terrace, both ringed
  // with white-marble balustrades and stairs; a double 须弥座 — the lower one with the ten 汉白玉 relief panels in its
  // waist, the upper one with garlands of peony, lotus and chrysanthemum; a granite shaft whose front (north) face carries
  // Mao's eight gilt characters 人民英雄永垂不朽 on a single stone 14.7 m tall, the back the 150-character inscription; a small
  // 庑殿 cap. Wreaths and flower baskets at the foot, visitors on the square. Horizontal plan compressed to fit the disc.
  // r.style 'zunyi': the 1935 遵义会议会址; 'shikumen': the 1921 中共一大会址 in a Shanghai 石库门 terrace. r.color: stone tint.
  if (r.style === 'zunyi') { zunyiHouse(gp); return; }
  if (r.style === 'shikumen') { shikumen(gp); return; }
  const gran = str(r.color, '#d6d0c2'), marble = '#eeebe2', joint = shade(gran, 0.86);
  const floor = ground(gp, 0.47, '#bdb7a8');
  // paving joints of the square
  for (let k = -4; k <= 4; k++) {
    const w = 2 * Math.sqrt(Math.max(0, 0.44 ** 2 - (k * 0.1) ** 2));
    box(gp, '#aaa496', 0, floor, k * 0.1, w, 0.001, 0.003);
    box(gp, '#aaa496', k * 0.1, floor, 0, 0.003, 0.001, w);
  }
  // lower terrace: a 海棠 plan (rectangle with concave-cut corners)
  const plate = (y: number, W: number, D: number, h: number, c: string, notch: number) => {
    const P2: [number, number][] = [];
    const a = W / 2, b = D / 2;
    const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 4; i++) { const t = a0 - (i / 4) * (Math.PI / 2); P2.push([cx + Math.cos(t) * notch, cy + Math.sin(t) * notch]); } };
    if (notch > 0) { corner(a, b, -Math.PI / 2); corner(-a, b, 0); corner(-a, -b, Math.PI / 2); corner(a, -b, Math.PI); }
    else P2.push([a, b], [-a, b], [-a, -b], [a, -b]);
    const G = grp(gp, 0, 0, 0, y + h / 2);
    G.rotation.x = -Math.PI / 2;
    slab(G, P2, h, c, 0, false);
  };
  const rail = (y: number, W: number, D: number, gapX: number, gapZ: number, cut = 0) => {
    // 汉白玉 balustrade: posts with capitals and a top rail, broken by the stairs
    const runs: [number, number, number, number][] = [];
    for (const s of [-1, 1]) {
      runs.push([-W / 2 + cut, -gapX, s * D / 2, 0], [gapX, W / 2 - cut, s * D / 2, 0]);
      runs.push([-D / 2 + cut, -gapZ, s * W / 2, 1], [gapZ, D / 2 - cut, s * W / 2, 1]);
    }
    for (const [u0, u1, v, ax] of runs) {
      const n = Math.max(1, Math.round((u1 - u0) / 0.028));
      for (let j = 0; j <= n; j++) {
        const u = u0 + ((u1 - u0) * j) / n;
        const [x, z] = ax ? [v, u] : [u, v];
        box(gp, marble, x, y, z, 0.006, 0.022, 0.006);
        ellip(gp, marble, x, y + 0.024, z, 0.0045);
      }
      const L = u1 - u0, m = (u0 + u1) / 2;
      const [x, z] = ax ? [v, m] : [m, v];
      box(gp, marble, x, y + 0.015, z, ax ? 0.003 : L, 0.004, ax ? L : 0.003);
      box(gp, shade(marble, 0.93), x, y + 0.002, z, ax ? 0.0025 : L, 0.008, ax ? L : 0.0025);
    }
  };
  const stairs = (y0: number, h: number, w: number, z0: number, dir: number, ax: 0 | 1, run = 0.012) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const d = (n - i) * run, zc = z0 + dir * d / 2;
      if (ax) box(gp, marble, zc, y0, 0, d, ((i + 1) / n) * h, w); else box(gp, marble, 0, y0, zc, w, ((i + 1) / n) * h, d);
    }
  };
  const W1 = 0.5, D1 = 0.62, h1 = 0.028;
  plate(floor, W1, D1, h1, '#cbc5b6', 0.05);
  const y1 = floor + h1;
  for (const s of [-1, 1]) { stairs(floor, h1, 0.12, s * D1 / 2, s, 0); stairs(floor, h1, 0.07, s * W1 / 2, s, 1); }
  rail(y1, W1 - 0.012, D1 - 0.012, 0.06, 0.035, 0.05);
  const W2 = 0.32, h2 = 0.032;
  plate(y1, W2, W2 + 0.04, h2, '#d2ccbe', 0);
  const y2 = y1 + h2;
  for (const s of [-1, 1]) stairs(y1, h2, 0.08, s * (W2 + 0.04) / 2, s, 0, 0.011);
  rail(y2, W2 - 0.01, W2 + 0.03, 0.04, 0);
  // lower 须弥座 with the relief panels set in its waist
  let y = y2;
  const tier = (w: number, d: number, h: number, c: string) => { rbox(gp, c, 0, y, 0, w, h, d, 0.002); y += h; };
  tier(0.2, 0.18, 0.012, gran); tier(0.19, 0.17, 0.006, joint);
  const waist = y;
  tier(0.178, 0.158, 0.042, gran);
  for (const [nx, nz, len] of [[0, 1, 0.15], [0, -1, 0.15], [1, 0, 0.13], [-1, 0, 0.13]] as const) {
    const ax = nx !== 0, n = ax ? 2 : 3, pw = (len - (n - 1) * 0.006) / n;
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + pw / 2 + k * (pw + 0.006);
      const px = ax ? nx * 0.0895 : u, pz = ax ? u : nz * 0.0795;
      box(gp, marble, px, waist + 0.006, pz, ax ? 0.003 : pw, 0.03, ax ? pw : 0.003);
      // crowds of figures in low relief
      for (let f = 0; f < 6; f++) {
        const fu = u - pw / 2 + ((f + 0.5) / 6) * pw, fh = 0.012 + hash3(k, f, nx + nz * 3) * 0.008;
        box(gp, '#dcd8ce', ax ? nx * 0.0915 : fu, waist + 0.008, ax ? fu : nz * 0.0815, ax ? 0.002 : 0.004, fh, ax ? 0.004 : 0.002);
      }
    }
  }
  tier(0.19, 0.17, 0.006, joint); tier(0.2, 0.18, 0.01, gran);
  // upper 须弥座 hung with garlands
  tier(0.15, 0.13, 0.008, gran);
  const gy = y;
  tier(0.136, 0.116, 0.026, gran);
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) for (const u of [-0.032, 0.032]) {
    const ax = nx !== 0;
    for (let k = 0; k < 7; k++) {
      const t = (k / 6) * 2 - 1, du = u + t * 0.026, dy = gy + 0.018 - (1 - t * t) * 0.01;
      ellip(gp, k % 2 ? '#e2ddd0' : '#ebe7dc', ax ? nx * 0.069 : du, dy, ax ? du : nz * 0.059, 0.006, 0.005, 0.006);
    }
  }
  tier(0.15, 0.13, 0.008, gran);
  // the shaft, very slightly tapered, with a raised border round each face
  const H = 0.36, sw = 0.1, sd = 0.078;
  tbox(gp, sw, sd, sw * 0.93, sd * 0.93, H, gran, 0, y, 0);
  for (const s of [-1, 1]) {
    for (const sx of [-1, 1]) box(gp, shade(gran, 1.04), sx * 0.04, y, s * 0.038, 0.012, H * 0.97, 0.006);
    // carved bands at the foot and head of the shaft (pines, flags and stars)
    box(gp, shade(gran, 0.92), 0, y + 0.006, s * 0.039, 0.096, 0.012, 0.004);
    box(gp, shade(gran, 0.92), 0, y + H - 0.022, s * 0.0365, 0.09, 0.012, 0.004);
  }
  // 碑心 front stone with the eight gilt characters 人民英雄永垂不朽 in one column
  const cy = y + 0.05, ch = 0.25;
  box(gp, '#bdb6a8', 0, cy, 0.0385, 0.044, ch, 0.004);
  for (let k = 0; k < 8; k++) {
    const ky = cy + ch - 0.024 - k * 0.0285;
    box(gp, '#d8b24a', 0, ky, 0.041, 0.022, 0.018, 0.002);
    // a few brush strokes per character so the column reads as calligraphy rather than tiles
    for (let q = 0; q < 3; q++) {
      const hz = hash3(k, q, 7), vt = hash3(k, q, 9) > 0.5;
      box(gp, '#8a6a22', (hz - 0.5) * 0.012, ky + 0.003 + hash3(q, k, 5) * 0.011, 0.0422, vt ? 0.0022 : 0.008 + hz * 0.008, vt ? 0.006 + hz * 0.006 : 0.0022, 0.001);
    }
  }
  // back: the long inscription in gilt columns
  box(gp, '#bdb6a8', 0, cy + 0.04, -0.0385, 0.07, 0.16, 0.004);
  for (let k = 0; k < 9; k++) box(gp, '#c9a448', -0.03 + k * 0.0075, cy + 0.05 + (k % 3) * 0.004, -0.041, 0.003, 0.13 - (k === 8 ? 0.06 : 0), 0.002);
  y += H;
  // cornice and 庑殿 cap
  rbox(gp, joint, 0, y, 0, sw * 0.98, 0.008, sd * 0.98, 0.002);
  rbox(gp, gran, 0, y + 0.008, 0, sw * 1.04, 0.01, sd * 1.06, 0.002);
  roof(gp, 0, y + 0.018, 0, sw * 0.94, sd * 0.94, 0.04, shade(gran, 0.97), { kind: 'hip', plain: true, ov: 0.012, lift: 0.12, ridge: gran, under: joint });
  // flower baskets and wreaths laid at the foot
  for (const [x, c] of [[-0.05, '#c8282c'], [0.05, '#e8b830'], [0, '#d8383a']] as const) {
    const bz = 0.13;
    cone(gp, '#8a6a3a', x, y2, bz, 0.016, 0.03, 8);
    for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? c : '#f2efe6', x + Math.cos(k * 1.05) * 0.01, y2 + 0.034 + (k % 2) * 0.004, bz + Math.sin(k * 1.05) * 0.01, 0.009);
    rod(gp, [x - 0.012, y2 + 0.026, bz + 0.012], [x + 0.012, y2 + 0.026, bz + 0.016], 0.002, '#c8282c', 3);
  }
  // visitors: a Young Pioneer group with red scarves on the square, a family on the lower terrace
  const P0: [number, number, number, number, string, string][] = [
    [-0.08, 0.38, Math.PI, 0.1, '#f2f0ea', '#2a3a6a'], [-0.03, 0.39, Math.PI, 0.1, '#f2f0ea', '#2a3a6a'], [0.02, 0.385, Math.PI, 0.1, '#f2f0ea', '#2a3a6a'],
    [0.07, 0.4, Math.PI - 0.3, 0.14, '#3a4a5a', '#2a2a2a'], [0.18, 0.22, Math.PI + 0.6, 0.13, '#8a3a3a', '#3a3a4a'], [-0.18, 0.2, Math.PI - 0.5, 0.14, '#4a5a4a', '#2a2a2a'],
  ];
  for (const [x, z, ry, h, top, bottom] of P0) {
    const fy = Math.abs(z) > D1 / 2 ? floor : y1;
    human(gp, x, fy, z, { h, pose: 'stand', top, bottom, skin: '#d8ae86', hair: '#1c1714', detail: 'min', ry });
    if (h === 0.1) box(gp, '#d82a2a', x, fy + h * 0.78, z - 0.012, 0.022, 0.006, 0.01, ry);
  }
  // clipped pines on the east and west lawns
  for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) minipine(gp, sx * 0.36, floor, k * 0.16, 0.09, '#355a2e');
};

/** 遵义会议会址: 柏辉章's 1930s two-storey brick-and-timber house, 中西合璧 — grey brick, a veranda round both floors with
 * round arches below, 赭红 (red-ochre) doors, windows and balustrades, a hipped-gable grey-tile roof with dormers (老虎窗);
 * the courtyard gate in front carries Mao's 1964 plaque 遵义会议会址 in gold on black. */
function zunyiHouse(gp: THREE.Group): void {
  const floor = ground(gp, 0.47, '#8a8a74');
  const brick = '#8e908a', plaster = '#d8d4c8', ochre = '#8a3a26', tile = '#55585a';
  const W = 0.52, D = 0.3, h = 0.11, z0 = -0.07, ver = 0.045;
  box(gp, '#a8a69a', 0, floor, z0, W + 0.02, 0.012, D + 0.02);
  const fy = floor + 0.012;
  // inner walls with red-ochre doors and shuttered windows on both floors
  box(gp, '#9a9c96', 0, fy, z0, W - ver * 2, h * 2, D - ver * 2);
  for (let f = 0; f < 2; f++) for (let i = 0; i < 5; i++) {
    const x = -0.17 + i * 0.085, wy = fy + f * h + (f ? 0.025 : 0.0);
    const tall = f === 0 && i === 2;
    box(gp, ochre, x, wy + (f || tall ? 0 : 0.025), z0 + D / 2 - ver + 0.002, 0.036, tall ? 0.085 : 0.06, 0.004);
    box(gp, '#3a2a20', x, wy + (f || tall ? 0 : 0.025) + 0.01, z0 + D / 2 - ver + 0.005, 0.002, tall ? 0.07 : 0.045, 0.002);
    if (!tall) box(gp, '#6e8a9a', x, wy + (f ? 0.03 : 0.055), z0 + D / 2 - ver + 0.005, 0.03, 0.012, 0.002);
  }
  // the arcades: one holed slab per face per floor (round arches below, segmental above)
  const arcade = (y: number, len: number, n: number, z: number, x: number, ry: number, round: boolean) => {
    const pw = 0.016, ow = (len - pw * (n + 1)) / n, spring = round ? h * 0.55 : h * 0.62, holes: [number, number][][] = [];
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + pw + ow / 2 + i * (ow + pw), hole: [number, number][] = [[cx + ow / 2, 0], [cx + ow / 2, spring]];
      const rise = round ? ow / 2 : ow * 0.18;
      for (let k = 1; k < 10; k++) { const t = k / 10; hole.push([cx + ow / 2 - t * ow, spring + Math.sin(t * Math.PI) * rise]); }
      hole.push([cx - ow / 2, spring], [cx - ow / 2, 0]);
      holes.push(hole);
    }
    holed(gp, brick, [[-len / 2, 0], [len / 2, 0], [len / 2, h], [-len / 2, h]], 0.014, x, y, z, ry, holes);
    // white-plastered arch heads and string course
    const G = grp(gp, x, z, ry, y);
    box(G, plaster, 0, h - 0.012, 0.0075, len, 0.006, 0.002);
    for (let i = 0; i <= n; i++) box(G, shade(brick, 0.92), -len / 2 + pw / 2 + i * (ow + pw), 0, 0.0072, pw * 0.8, h * 0.08, 0.0015);
    if (!round) for (let i = 0; i < n; i++) {
      // red-ochre balustrade between the upper piers
      const cx = -len / 2 + pw + ow / 2 + i * (ow + pw);
      box(G, ochre, cx, 0.03, 0.0, ow, 0.004, 0.006);
      for (let k = 0; k < 5; k++) box(G, ochre, cx - ow / 2 + ((k + 0.5) / 5) * ow, 0, 0, 0.003, 0.03, 0.003);
    }
  };
  for (let f = 0; f < 2; f++) {
    const y = fy + f * h, round = f === 0;
    arcade(y, W, 5, z0 + D / 2 - 0.007, 0, 0, round);
    arcade(y, W, 5, z0 - D / 2 + 0.007, 0, Math.PI, round);
    for (const s of [-1, 1]) arcade(y, D - 0.014, 3, z0, s * (W / 2 - 0.007), s * Math.PI / 2, round);
    box(gp, '#7a6a58', 0, y + h - 0.004, z0, W - 0.01, 0.006, D - 0.01);
  }
  // hipped-gable grey-tile roof with two dormers on the front slope
  const ry = fy + 2 * h;
  box(gp, plaster, 0, ry, z0, W + 0.012, 0.01, D + 0.012);
  roof(gp, 0, ry + 0.01, z0, W, D, 0.11, tile, { kind: 'xieshan', plain: true, ov: 0.03, lift: 0.08, gableC: '#7a7c78', under: '#4a3a30' });
  for (const sx of [-1, 1]) {
    const dx = sx * 0.12, dz = z0 + 0.075, dy = ry + 0.055;
    box(gp, plaster, dx, dy, dz, 0.04, 0.032, 0.04);
    box(gp, '#6e8a9a', dx, dy + 0.006, dz + 0.0205, 0.026, 0.018, 0.002);
    roof(gp, dx, dy + 0.032, dz - 0.004, 0.036, 0.04, 0.016, tile, { kind: 'gable', plain: true, ov: 0.006, lift: 0, ry: Math.PI / 2 });
  }
  // courtyard wall and gate with the plaque
  const wz = 0.3, wh = 0.07, gw = 0.09;
  for (const s of [-1, 1]) {
    const x0 = s * (gw / 2 + 0.02), x1 = s * 0.38, len = Math.abs(x1 - x0);
    box(gp, brick, (x0 + x1) / 2, floor, wz, len, wh, 0.016);
    box(gp, tile, (x0 + x1) / 2, floor + wh, wz, len + 0.004, 0.008, 0.026);
    box(gp, brick, s * (gw / 2 + 0.01), floor, wz, 0.022, 0.13, 0.03);
  }
  box(gp, '#2a2420', 0, floor, wz - 0.004, gw, 0.095, 0.004);
  box(gp, ochre, 0, floor, wz + 0.002, gw - 0.01, 0.09, 0.004);
  box(gp, '#3a2a20', 0, floor, wz + 0.005, 0.002, 0.09, 0.002);
  box(gp, brick, 0, floor + 0.095, wz, gw + 0.044, 0.035, 0.03);
  box(gp, '#141414', 0, floor + 0.1, wz + 0.017, 0.085, 0.024, 0.004);
  for (let k = 0; k < 6; k++) box(gp, '#d8b24a', -0.0325 + k * 0.013, floor + 0.105, wz + 0.0195, 0.009, 0.014, 0.001);
  roof(gp, 0, floor + 0.13, wz, gw + 0.06, 0.04, 0.03, tile, { kind: 'gable', plain: true, ov: 0.01, lift: 0.1 });
  // old trees in the courtyard, visitors and a guide by the gate
  for (const [tx, tz] of [[-0.33, 0.17], [0.34, 0.16]] as const) {
    rod(gp, [tx, floor, tz], [tx, floor + 0.12, tz], 0.008, '#4a3a2c', 5);
    for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? '#4a6a38' : '#55773e', tx + Math.cos(k * 1.1) * 0.035, floor + 0.13 + (k % 3) * 0.02, tz + Math.sin(k * 1.1) * 0.03, 0.04, 0.03, 0.04);
  }
  for (const [x, z, rot, top] of [[-0.1, 0.4, Math.PI, '#3a4a5a'], [-0.05, 0.41, Math.PI + 0.2, '#8a3a3a'], [0.1, 0.39, Math.PI - 0.5, '#4a5a4a'], [0.15, 0.4, -Math.PI / 2, '#d8d4c8']] as const) {
    human(gp, x, floor, z, { h: 0.13, pose: 'stand', top, bottom: '#2a2a30', skin: '#d8ae86', hair: '#1c1714', detail: 'min', ry: rot });
  }
}

/** 中共一大会址 (兴业路 76–78号, Shanghai 1921): a terrace of two-storey 石库门 houses in grey brick banded with red brick and
 * pointed in white, each door in a stone frame (石库) with black-lacquered leaves and a carved red pediment over the
 * lintel, timber casements above, black-tile roof behind; plane trees, a rickshaw and passers-by in 长衫 on the lane. */
function shikumen(gp: THREE.Group): void {
  const floor = ground(gp, 0.47, '#8a8478');
  const grey = '#7c7f80', red = '#9a4a38', stone = '#bdb6a6', tile = '#3a3c3e';
  const W = 0.64, H = 0.26, z = -0.02, D = 0.2, n = 3, uw = W / n;
  // street paving and kerb
  box(gp, '#6e6a62', 0, floor, z + D / 2 + 0.12, 0.7, 0.002, 0.2);
  // facade wall: grey brick with red-brick bands every few courses and white pointing
  box(gp, grey, 0, floor, z, W, H, D);
  for (const k of [0, 1, 3, 5]) box(gp, red, 0, floor + 0.03 + k * 0.042, z + D / 2, W, 0.007, 0.003);
  box(gp, red, 0, floor + H - 0.016, z + D / 2, W + 0.004, 0.016, 0.006);
  for (let i = 0; i < n; i++) {
    const cx = -W / 2 + uw * (i + 0.5), fz = z + D / 2;
    // 石库 door frame, black doors, brass rings, a carved pediment over the lintel
    box(gp, stone, cx, floor, fz + 0.003, 0.07, 0.12, 0.006);
    box(gp, '#151515', cx, floor, fz + 0.006, 0.05, 0.105, 0.004);
    box(gp, '#3a3a3a', cx, floor, fz + 0.0085, 0.0015, 0.105, 0.001);
    for (const sx of [-1, 1]) ellip(gp, '#c9a24a', cx + sx * 0.006, floor + 0.06, fz + 0.009, 0.0035, 0.0035, 0.001);
    box(gp, stone, cx, floor + 0.12, fz + 0.003, 0.084, 0.012, 0.01);
    const G = grp(gp, cx, fz + 0.006, 0, floor + 0.132);
    slab(G, [[-0.042, 0], [0.042, 0], [0.04, 0.012], [0.02, 0.028], [0, 0.034], [-0.02, 0.028], [-0.04, 0.012]], 0.008, '#a8503a', 0, false);
    box(G, '#c87a4a', 0, 0.008, 0.0045, 0.05, 0.012, 0.002);
    // upper casements with timber frames
    for (const sx of [-1, 1]) {
      const wx = cx + sx * 0.045;
      box(gp, '#5a3a28', wx, floor + 0.165, fz + 0.002, 0.036, 0.06, 0.004);
      box(gp, '#7a9aa8', wx, floor + 0.17, fz + 0.0045, 0.028, 0.05, 0.002);
      box(gp, '#5a3a28', wx, floor + 0.17, fz + 0.006, 0.002, 0.05, 0.002);
      box(gp, stone, wx, floor + 0.161, fz + 0.004, 0.042, 0.005, 0.01);
    }
    box(gp, '#5a3a28', cx, floor + 0.17, fz + 0.002, 0.024, 0.05, 0.004);
    box(gp, '#7a9aa8', cx, floor + 0.175, fz + 0.0045, 0.018, 0.04, 0.002);
  }
  // the site plaque beside the first door
  box(gp, '#ece8dc', -W / 2 + uw * 0.5 - 0.075, floor + 0.05, z + D / 2 + 0.002, 0.04, 0.05, 0.003);
  for (let k = 0; k < 3; k++) box(gp, '#a83228', -W / 2 + uw * 0.5 - 0.085 + k * 0.01, floor + 0.056, z + D / 2 + 0.004, 0.003, 0.038, 0.001);
  // black-tile roof with gable walls stepped up at the ends
  roof(gp, 0, floor + H, z - 0.01, W - 0.01, D - 0.02, 0.09, tile, { kind: 'gable', plain: true, ov: 0.02, lift: 0, gableC: grey });
  for (const s of [-1, 1]) {
    const G = grp(gp, s * (W / 2 - 0.005), z - 0.01, Math.PI / 2, floor + H);
    slab(G, [[-D / 2 - 0.02, 0], [D / 2 + 0.02, 0], [D / 2 + 0.02, 0.02], [0.05, 0.1], [0.02, 0.115], [-0.02, 0.115], [-0.05, 0.1], [-D / 2 - 0.02, 0.02]], 0.014, grey, 0, false);
  }
  // plane trees along the lane
  for (const tx of [-0.38, 0.38]) {
    const tz = 0.25;
    rod(gp, [tx, floor, tz], [tx, floor + 0.16, tz], 0.008, '#8a8070', 5);
    for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? '#5a7a3a' : '#6a8a44', tx + Math.cos(k * 1.1) * 0.04, floor + 0.17 + (k % 3) * 0.02, tz + Math.sin(k * 1.1) * 0.035, 0.045, 0.03, 0.045);
  }
  // a rickshaw (黄包车) waiting with its puller, and men in 长衫 at the doors
  const R = grp(gp, 0.2, 0.26, -Math.PI / 2 + 0.3, floor);
  for (const sx of [-1, 1]) wheel(R, sx * 0.04, 0.035, 0, 0.035, '#2a2420', 12);
  rbox(R, '#1e1e1e', 0, 0.045, -0.005, 0.07, 0.03, 0.04, 0.004);
  rbox(R, '#1e1e1e', 0, 0.06, -0.025, 0.07, 0.05, 0.01, 0.004);
  for (const sx of [-1, 1]) rod(R, [sx * 0.03, 0.05, 0.01], [sx * 0.025, 0.02, 0.15], 0.0025, '#3a2a1e', 4);
  human(R, 0, 0, 0.17, { h: 0.12, pose: 'stand', top: '#d8d0bc', bottom: '#3a3a40', skin: '#b08458', hair: '#1c1714', detail: 'min', hands: [[-0.25, 0.4, 0.05], [0.25, 0.4, 0.05]] });
  for (const [x, zz, rot, top] of [[-0.2, 0.17, Math.PI - 0.4, '#3a4252'], [-0.13, 0.19, Math.PI + 0.6, '#5a5a62'], [0.02, 0.2, Math.PI, '#4a3e34']] as const) {
    human(gp, x, floor, zz, { h: 0.13, pose: 'stand', top, bottom: top, skin: '#d8ae86', hair: '#1c1714', hatStyle: 'brim', hat: '#3a3a3a', detail: 'min', ry: rot });
  }
}

const statue: Builder = (gp, r) => {
  // a seated sage statue on a plinth
  const y = terrace(gp, 0.5, 0.5, 2, 0.06, '#bdb4a2', false);
  figure(gp, { h: 0.6, x: 0, y, z: 0, top: str(r.color, '#8a7a5a'), bottom: str(r.color, '#8a7a5a'), skin: tint(str(r.color, '#8a7a5a'), 0.1), hair: tint(str(r.color, '#8a7a5a'), -0.2), hairStyle: 'topknot', beard: 'long', beardColor: tint(str(r.color, '#8a7a5a'), -0.2), outfit: 'robe', wideSleeves: true, hat: 'scholar', hatColor: tint(str(r.color, '#8a7a5a'), -0.2), armL: { fwd: 0.6, bend: 1.4, inward: 0.5 }, armR: { fwd: 0.6, bend: 1.4, inward: 0.5 } });
};

/**
 * A journey traveller dressed for their period (`r.year`) and role (`r.role`, see `costume`): a Han envoy in 进贤冠
 * holding the 节 staff of his mission, a Tang pilgrim monk on foot under a bamboo 笈 book-frame, a Tang poet in 软脚幞头
 * with sword and wine gourd, a Song scholar in a tall 东坡巾 on a donkey, a Ming official in 乌纱帽 …
 * `r.mount`: 'horse' | 'donkey' | 'camel' | 'foot'; `r.gear`: 'jie' | 'ji' | 'sword' | 'scroll'; `r.hat` overrides the
 * period headwear; `r.pack` adds a laden pack camel behind.
 */
const traveller: Builder = (gp, r) => {
  const role = str(r.role, 'scholar') as PersonRole;
  const era = eraOf(typeof r.year === 'number' ? r.year : 1000);
  const look = costume(role, era);
  const robe = str(r.robe, look.top), trim = str(r.trim, look.accent ?? shade(robe, 0.6));
  const hat = str(r.hat, look.hat ?? 'none') as Hat, hatC = look.hatColor ?? '#1c1917';
  const mount = str(r.mount, 'horse'), gear = str(r.gear, ''), monk = role === 'monk';
  const skin = '#dcae86', hair = monk ? null : '#1c1714';

  if (mount === 'foot') {
    // walking pilgrim: robe, staff in hand and (for 'ji') a bamboo book-frame with a canopy over the head
    const h = 0.78;
    const a = figure(gp, {
      ...look, h, top: robe, accent: trim, skin, hair: hair ?? undefined, beardColor: '#2a2420', stance: 'walk', lean: 0.06,
      armR: { fwd: 0.45, side: 0.12, bend: 0.7 }, armL: { fwd: -0.2, bend: 0.4 }, hat: monk ? 'none' : hat, hatColor: hatC,
    });
    const [hx, hy, hz] = a.handR;
    rod(gp, [hx, 0.01, hz + 0.05], [hx, hy + 0.3, hz - 0.01], 0.006, P.darkwood, 5);
    if (monk) { // 锡杖 rings
      const ring = add(gp, g('rich:ring', () => new THREE.TorusGeometry(1, 0.14, 5, 12)), mat('#c9a24a', { metal: 0.6 }), hx, hy + 0.33, hz - 0.01, 0.03, 0.03, 0.03);
      ring.rotation.y = Math.PI / 2;
    }
    if (gear === 'ji') {
      const bz = -0.11 * h / 0.62, top = h * 1.12;
      for (const sx of [-1, 1]) rod(gp, [sx * 0.07, h * 0.25, bz - 0.02], [sx * 0.07, top, bz - 0.02], 0.007, '#8a6a3a', 4);
      rbox(gp, '#b08a4e', 0, h * 0.6, bz - 0.04, 0.15, h * 0.42, 0.09, 0.01);
      for (let k = 0; k < 4; k++) box(gp, '#6e5226', 0, h * 0.42 + k * h * 0.11, bz + 0.006, 0.152, 0.008, 0.008);
      for (let k = 0; k < 3; k++) cyl(gp, ['#e8dcc0', '#c9b58e', '#e8dcc0'][k], -0.04 + k * 0.04, h * 0.84, bz - 0.04, 0.016, 0.07, 6).rotation.z = Math.PI / 2;
      // canopy arching over the head, with a small lamp hanging from its front edge
      const cz = bz + 0.1;
      rbox(gp, '#c9a86a', 0, top + 0.01, cz, 0.24, 0.012, 0.26, 0.004).rotation.x = -0.18;
      for (const sx of [-1, 1]) rod(gp, [sx * 0.11, top + 0.01, cz + 0.12], [sx * 0.11, top - 0.04, cz + 0.13], 0.003, '#7a1f1f', 3);
      rod(gp, [0, top - 0.01, cz + 0.12], [0, top - 0.08, cz + 0.12], 0.002, '#3a2a1a', 3);
      ellip(gp, '#f5c542', 0, top - 0.1, cz + 0.12, 0.016, 0.022, 0.016);
    }
    return;
  }

  // mounted: a horse, a small long-eared donkey or a Bactrian camel, all facing +z
  let seat: number;
  if (mount === 'camel') {
    const C = grp(gp, 0, 0.0, 0);
    camel(C, { kind: 'camel', rider: false, driver: false, color: '#b48a5a' });
    seat = 0.55;
  } else {
    const donkey = mount === 'donkey', M = grp(gp, 0, 0, 0);
    const k = donkey ? 0.8 : 1;
    M.scale.setScalar(k);
    const coat = str(r.coat, donkey ? '#7d746a' : '#f1ece2');
    seat = horse(M, coat, donkey ? '#3a332c' : '#cfc6b6', { cloth: shade(trim, 0.9), saddle: '#3b2414', donkey }) * k;
  }
  const h = 0.5;
  const rg = human(gp, 0, seat - h * 0.45, -0.02, {
    h, pose: 'sit', top: robe, bottom: '#2f2a25', skin, hair, shoes: '#1c1714', detail: 'hi',
    feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: gear === 'jie' ? [[-0.1, 0.42, 0.3], [0.13, 0.5, 0.18]] : [[-0.1, 0.42, 0.3], [0.1, 0.42, 0.3]],
  });
  // a sash in the trim colour and the period headwear
  const waistY = seat - h * 0.45 + h * 0.33;
  cyl(gp, trim, 0, waistY, -0.02, h * 0.105, h * 0.04, 12);
  const head = new THREE.Group();
  head.position.set(...rg.head);
  gp.add(head);
  headwear(head, hat, hatC, h * 0.074, { beard: look.beard && look.beard !== 'none' ? look.beard : undefined, badge: look.hatBadge });
  rod(gp, rg.handL, [0, seat + 0.03, 0.26], 0.002, '#2a1a10', 3);
  const [hx, hy, hz] = rg.handR;
  if (gear === 'jie') {
    // 节: the envoy's staff of office, crowned with three tiers of yak-tail tassels
    rod(gp, [hx, hy - 0.2, hz], [hx, hy + 0.5, hz - 0.02], 0.006, P.darkwood, 5);
    for (let k = 0; k < 3; k++) {
      const ty = hy + 0.46 - k * 0.09;
      add(gp, g('rich:cone8', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)), mat(k === 1 ? '#c2410c' : '#9b1c1c'), hx, ty - 0.07, hz - 0.02, 0.05, 0.08, 0.05);
      cyl(gp, '#d6b25e', hx, ty + 0.005, hz - 0.02, 0.012, 0.012, 6);
    }
  } else if (gear === 'sword') {
    // a sword slung at the left hip, hilt forward, and a wine gourd at the saddle
    rod(gp, [-0.1, waistY + 0.03, 0.07], [-0.13, waistY - 0.1, -0.24], 0.006, '#2a2420', 4);
    box(gp, '#d6b25e', -0.1, waistY + 0.02, 0.04, 0.04, 0.008, 0.008);
    gourd(gp, 0.1, seat - 0.13, -0.1, 0.035, '#d9a441');
  } else if (gear === 'scroll') {
    cyl(gp, P.paper, hx, hy, hz + 0.01, 0.012, 0.1, 8).rotation.z = Math.PI / 2;
  }
  if (r.pack) {
    // a laden pack camel following behind
    const B = grp(gp, 0.26, -0.62, 0);
    B.scale.setScalar(0.78);
    camel(B, { kind: 'camel', rider: false, driver: false, color: '#b48a5a' });
  }
};

export const RICH: Record<string, Builder> = {
  army, rider, warrior, chariot, camel, flag, beacon, wall, gate, palace, pagoda, temple, bell, ding, scroll, printing, compass, seismoscope,
  yurt, tent, hut, junk, warship, boat, fireship, redboat, bridge, cannon, trebuchet, monument, statue, traveller, ...RICH2,
};

/**
 * A generic historical person for a person card, dressed for their role and period (`r.year`): 冕服 for early
 * emperors, 圆领袍 and 幞头 for Tang/Song officials, 乌纱帽 with a rank badge in the Ming, 马褂 and queue in the Qing …
 */
export function personModel(gp: THREE.Group, r: ModelRecipe): void {
  const role = str(r.role, 'scholar') as PersonRole;
  const era = eraOf(typeof r.year === 'number' ? r.year : 1000);
  // `bare`: standing straight on the map (scenery) rather than on a card's plinth
  const y = r.bare ? 0 : figureBase(gp, '#c9b58e', '#6e5a40');
  let look = costume(role, era);
  // `female`: an empress (武则天) or a heroine in armour (花木兰) — the role's dress without a beard
  if (r.female) {
    const w = costume('woman', era);
    look = role === 'ruler' ? { ...w, top: '#d6a62a', accent: '#a8321f', hat: 'crown', hatColor: P.gold, cape: '#a8321f' }
      : role === 'general' ? { ...look, beard: 'none', hat: 'none', hairStyle: 'bun' } : w;
  }
  const common = { h: 0.62, x: 0, y, z: 0, hair: '#1c1714', beardColor: '#2a2420', accent: P.gold, ...look, top: str(r.color, look.top) };
  const modern = era === 'minguo' || era === 'modern';
  const prop = typeof r.prop === 'string' ? r.prop : '';
  if (prop) {
    // a signature object in the right hand (羽扇, 青龙刀, 琵琶 …), the left hand resting
    const two = prop === 'pipa' || prop === 'bow';
    const a = figure(gp, { ...common, armR: two ? { fwd: 0.7, side: 0.1, bend: 1.3, inward: 0.5 } : { fwd: 0.55, side: 0.15, bend: 0.9 }, armL: two ? { fwd: 0.6, bend: 1.0, inward: 0.3 } : { fwd: 0.15, bend: 0.3 } });
    holdProp(gp, prop, a.handR, a.handL);
  } else if (role === 'ruler') figure(gp, { ...common, armL: { fwd: 0.5, bend: 1.2, inward: 0.4 }, armR: { fwd: 0.5, bend: 1.2, inward: 0.4 } });
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

/** Props a named person is remembered by, held in the right hand (two-handed ones span both). */
function holdProp(gp: THREE.Group, prop: string, R: V3, L: V3): void {
  const [x, y, z] = R;
  switch (prop) {
    case 'fan': { // 羽扇: white crane-feather fan on a short handle
      rod(gp, [x, y - 0.02, z + 0.01], [x, y + 0.04, z + 0.02], 0.004, P.darkwood, 4);
      for (let i = 0; i < 9; i++) {
        const a = -0.7 + i * 0.175;
        ellip(gp, i % 2 ? '#f4f1ea' : '#e6e1d6', x + Math.sin(a) * 0.05, y + 0.05 + Math.cos(a) * 0.065, z + 0.022, 0.018, 0.06, 0.003, 0, 0, -a);
      }
      ellip(gp, '#3a2f2a', x, y + 0.05, z + 0.024, 0.011, 0.011, 0.005);
      break;
    }
    case 'sword': { // 剑 raised before the chest
      rod(gp, [x, y - 0.03, z + 0.01], [x, y + 0.02, z + 0.01], 0.006, '#3a2a1c', 5);
      box(gp, P.gold, x, y + 0.025, z + 0.01, 0.04, 0.008, 0.012);
      box(gp, '#c9ced4', x, y + 0.12, z + 0.01, 0.012, 0.18, 0.003);
      cone(gp, '#c9ced4', x, y + 0.215, z + 0.01, 0.007, 0.02, 4);
      break;
    }
    case 'guandao': { // 青龙偃月刀: long pole with a crescent blade and a red tassel
      rod(gp, [x, 0.02, z], [x, y + 0.36, z], 0.007, '#3a2a1c', 5);
      slab(gp, [[0, 0], [0.012, 0.13], [0.04, 0.16], [0.05, 0.1], [0.035, 0.02]], 0.004, '#c9ced4').position.set(x - 0.004, y + 0.33, z);
      box(gp, P.gold, x, y + 0.33, z, 0.022, 0.012, 0.022);
      ellip(gp, '#b91c1c', x, y + 0.31, z, 0.012, 0.022, 0.012);
      break;
    }
    case 'brush': { // 毛笔 and an open scroll in the other hand
      rod(gp, [x, y - 0.01, z + 0.01], [x + 0.01, y + 0.08, z + 0.02], 0.0035, '#5a3a22', 4);
      cone(gp, '#1c1917', x - 0.001, y - 0.022, z + 0.009, 0.005, 0.02, 5).rotation.x = Math.PI;
      cyl(gp, P.paper, L[0], L[1], L[2] + 0.01, 0.012, 0.11, 8).rotation.z = Math.PI / 2;
      break;
    }
    case 'book': box(gp, '#3a5a7a', x, y, z + 0.012, 0.05, 0.07, 0.014); box(gp, '#f1ece0', x, y, z + 0.02, 0.046, 0.066, 0.004); break;
    case 'cup': { // 酒杯 raised, a wine gourd at the hip
      lathe(gp, [[0, 0], [0.012, 0.004], [0.018, 0.022], [0, 0.022]], P.bronze, x, y + 0.005, z + 0.01, 8);
      lathe(gp, [[0, 0], [0.02, 0.01], [0.018, 0.03], [0.01, 0.04], [0.016, 0.055], [0.006, 0.07], [0, 0.07]], '#b8862e', L[0], L[1] - 0.06, L[2] + 0.02, 8);
      break;
    }
    case 'staff': { // 节杖 envoy's staff with yak-tail tufts (张骞, 苏武) or a walking staff
      rod(gp, [x, 0.01, z], [x, y + 0.42, z], 0.005, '#5a3a22', 5);
      for (let i = 0; i < 3; i++) ellip(gp, '#c0262d', x, y + 0.4 - i * 0.05, z, 0.016, 0.024, 0.016);
      break;
    }
    case 'spade': { // 耒耜: Yu the Great's digging spade
      rod(gp, [x, 0.03, z + 0.01], [x, y + 0.2, z], 0.006, '#6b4a2e', 5);
      slab(gp, [[-0.025, 0], [0.025, 0], [0.02, 0.05], [-0.02, 0.05]], 0.006, '#8a7458').position.set(x, 0.0, z + 0.006);
      break;
    }
    case 'axe': { // 钺: Fu Hao's bronze ceremonial axe
      rod(gp, [x, y - 0.1, z], [x, y + 0.2, z], 0.006, '#4a3222', 5);
      slab(gp, [[0, -0.035], [0.06, -0.045], [0.07, 0], [0.06, 0.045], [0, 0.035]], 0.006, P.patina).position.set(x, y + 0.16, z - 0.003);
      break;
    }
    case 'herbs': { // a basket of herbs on the arm and a sprig in hand
      lathe(gp, [[0, 0], [0.03, 0], [0.04, 0.035], [0, 0.035]], '#a8834e', L[0], L[1] - 0.03, L[2] + 0.02, 10);
      for (let i = 0; i < 5; i++) ellip(gp, i % 2 ? '#5f8f3e' : '#7aa04a', L[0] - 0.02 + i * 0.01, L[1] + 0.01, L[2] + 0.02, 0.012, 0.008, 0.012);
      rod(gp, [x, y, z + 0.01], [x, y + 0.05, z + 0.015], 0.002, '#4a6a2a', 3);
      ellip(gp, '#6f9a3e', x, y + 0.055, z + 0.015, 0.012, 0.016, 0.004);
      break;
    }
    case 'pipa': { // 琵琶 held upright across the body
      const cx = (x + L[0]) / 2, cy = (y + L[1]) / 2 - 0.02, cz = Math.max(z, L[2]) + 0.02;
      ellip(gp, '#9a5a2a', cx, cy - 0.02, cz, 0.06, 0.08, 0.014);
      box(gp, '#5a3418', cx, cy + 0.1, cz, 0.014, 0.12, 0.01);
      box(gp, '#3a2210', cx, cy + 0.16, cz - 0.004, 0.02, 0.025, 0.012);
      break;
    }
    case 'bow': { // 弓 drawn
      tube(gp, [[L[0], L[1] - 0.12, L[2] + 0.02], [L[0], L[1], L[2] + 0.06], [L[0], L[1] + 0.12, L[2] + 0.02]], 0.004, 0.004, '#4a3222', { radial: 4, sub: 4 });
      rod(gp, [L[0], L[1] - 0.12, L[2] + 0.02], [x, y, z], 0.001, '#e8e2d4', 3);
      rod(gp, [L[0], L[1] + 0.12, L[2] + 0.02], [x, y, z], 0.001, '#e8e2d4', 3);
      break;
    }
    case 'scroll': cyl(gp, P.paper, x, y, z + 0.01, 0.012, 0.12, 8).rotation.z = Math.PI / 2; break;
  }
}
