import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, box, cyl, g, gable, lathe, mat, plinth, prism, rbox, rod, shade, SITE, skin, slab, tube } from '../prims.ts';
import { figure, type FigureAnchors, type FigureOpts } from '../figure.ts';

// ---------------------------------------------------------------- shared helpers (explorers, aviators, athletes...)

const metal = (m: THREE.Mesh, c: string, k = 0.6, rough = 0.35) => { m.material = mat(c, { metal: k, rough }); return m; };
/** lighten (+) / darken (−) a colour by a relative amount. */
const tint = (c: string, d: number) => shade(c, 1 + d);
const glow = (m: THREE.Mesh, c: string, e = c) => { m.material = mat(c, { emissive: e }); return m; };
/** ellipsoid with segment count scaled to its size (prims' ellip is 600+ tris, too heavy for dozens of tiny parts). */
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz);
  const s = r > 0.05 ? 16 : r > 0.028 ? 12 : r > 0.012 ? 8 : 6;
  return add(p, g('pc-sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(4, Math.round(s * 0.7)))), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
};

const bodyOf = (a: FigureAnchors) => a.group.children[0] as THREE.Group;

/** Blocky 3×5 letters (CCCP, USA, 10, 733) — readable on the big turntable and baked like the rest. */

/** Flag cloth hanging from a pole top at (x,y,z): w wide (+x), h tall; `paint` adds the design on the given group. */
// design layers are slightly thicker than the cloth so they show on both sides

/** Snowy / grassy mound: a smooth lathe hill. */
function mound(p: THREE.Object3D, c: string, x: number, y: number, z: number, r: number, h: number, seg = 16): THREE.Mesh {
  return lathe(p, [[r, 0], [r * 0.85, h * 0.25], [r * 0.55, h * 0.75], [r * 0.25, h * 0.97], [0, h]], c, x, y, z, seg);
}

/** Simple pebbles / rocks scattered by a fixed pattern. */
function rocks(p: THREE.Object3D, c: string, pts: [number, number, number][], y: number): void {
  pts.forEach(([x, z, s], i) => ellip(p, tint(c, (i % 3) * 0.06 - 0.04), x, y + s * 0.3, z, s, s * 0.6, s * 0.8, i * 1.3));
}

// ---------------------------------------------------------------- ship / vehicles / props

/** Ming treasure ship (宝船) after the Nanjing Treasure-Shipyard replica: a 福船-type hull with a flat transom bow and a
 *  high square stern, dark planking under a vermilion upper strake, bow eyes, a stern deckhouse, a deep rudder and six
 *  masts with battened junk sails. Seen broadside, bow toward −x. */
function baochuan(p: THREE.Object3D, cx: number, cy: number, cz: number, L: number): void {
  const W = L * 0.1, D = L * 0.07, n = 16;
  const sheer = (t: number) => D * (0.8 + 0.6 * Math.pow(Math.max(0, 1 - 2.5 * t), 2) + 1.3 * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2));
  const half = (t: number) => W * (t < 0.4 ? 0.62 + 0.38 * Math.sin((t / 0.4) * Math.PI / 2) : 1 - 0.22 * Math.pow((t - 0.4) / 0.6, 2));
  const X = (t: number) => cx + (t - 0.5) * L;
  const rings: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = X(t), w = half(t), s = sheer(t), d = D * (0.3 + 0.7 * Math.sin(Math.PI * t));
    rings.push([[x, cy + s, cz - w], [x, cy + s * 0.2, cz - w], [x, cy - d * 0.55, cz - w * 0.8], [x, cy - d, cz - w * 0.3],
      [x, cy - d, cz + w * 0.3], [x, cy - d * 0.55, cz + w * 0.8], [x, cy + s * 0.2, cz + w], [x, cy + s, cz + w]]);
  }
  skin(p, rings, '#3a2a1e', {
    caps: true, flat: true,
    paint: (x, y, _z, _nx, ny) => {
      const s = cy + sheer(Math.min(1, Math.max(0, (x - cx) / L + 0.5)));
      if (ny > 0.8) return '#8a7052';
      if (y > s - D * 0.3) return '#6d372f';
      if (y > s - D * 0.38) return '#a6894e';
      if (y < cy + D * 0.08) return '#2a211b';
      return Math.floor((y - cy) * 220) % 2 ? '#3d2c20' : '#463324';
    },
  });
  // painted eyes (龙目) on the bow
  const ex = X(0.05), ey = cy + sheer(0.05) * 0.55, ez = cz + half(0.05) + 0.002;
  ellip(p, '#e3dac4', ex, ey, ez, 0.016, 0.011, 0.004);
  ellip(p, '#1a1614', ex - 0.002, ey, ez + 0.002, 0.007, 0.007, 0.004);
  // low forecastle and the two-storey stern castle (舵楼) with windows and a tiled roof
  box(p, '#583a2a', X(0.08), cy + sheer(0.12) - 0.004, cz, L * 0.09, 0.02, half(0.08) * 1.8);
  const xs = X(0.9), ys = cy + sheer(0.83) - 0.004;
  box(p, '#63392d', xs, ys, cz, L * 0.17, 0.042, half(0.9) * 1.9);
  for (let i = 0; i < 6; i++) box(p, '#241b15', xs - L * 0.07 + i * L * 0.028, ys + 0.016, cz + half(0.9) * 0.95 + 0.001, 0.01, 0.014, 0.003);
  box(p, '#a6894e', xs, ys + 0.04, cz, L * 0.175, 0.004, half(0.9) * 1.95);
  box(p, '#63392d', xs + L * 0.02, ys + 0.044, cz, L * 0.1, 0.028, half(0.9) * 1.4);
  gable(p, L * 0.13, 0.022, half(0.9) * 1.7, '#3a3430', xs + L * 0.02, ys + 0.072, cz);
  // deep stern rudder and its tiller
  box(p, '#2e231a', X(1) + 0.012, cy - D * 0.9, cz, 0.018, D * 2.2, 0.006);
  rod(p, [X(1) + 0.012, cy + D * 1.3, cz], [X(0.94), cy + sheer(0.94) + 0.006, cz], 0.003, '#2e231a', 4);
  // six masts carrying battened mat sails; sheets fan from the batten ends to the deck
  const H = L * 0.58;
  const masts: [number, number][] = [[0.08, 0.5], [0.23, 0.78], [0.41, 1], [0.58, 0.84], [0.73, 0.64], [0.86, 0.46]];
  masts.forEach(([t, k], i) => {
    const h = H * k, mx = X(t), my = cy + sheer(t), sw = h * 0.5, hs = h * 0.82, sb = my + h * 0.13, sz = cz + 0.008 + (i % 2) * 0.007;
    rod(p, [mx, my, cz], [mx, my + h, cz], 0.003 + 0.003 * k, '#3a2a1d', 6);
    const leech = (f: number) => (f < 0.55 ? 0.68 + 0.1 * f / 0.55 : 0.78 - 0.14 * (f - 0.55) / 0.45) * sw;
    const luff = -0.32 * sw, topL = 0.86;
    const sail = slab(p, [[luff, 0], [leech(0), 0], [leech(0.55), 0.55 * hs], [leech(1), hs], [luff, topL * hs]], 0.003, tint('#a78050', (i % 2) * 0.05 - 0.02), 0, false);
    sail.position.set(mx, sb, sz);
    for (let j = 0; j <= 7; j++) {
      const f = j / 7;
      rod(p, [mx + luff - 0.004, sb + f * topL * hs, sz + 0.004], [mx + leech(f) + 0.006, sb + f * hs, sz + 0.004], j === 0 || j === 7 ? 0.0028 : 0.0015, '#3b2a1d', 4);
    }
    for (const f of [0.25, 0.5, 0.75]) rod(p, [mx + leech(f) + 0.005, sb + f * hs, sz + 0.004], [mx + leech(0) + 0.025, my + 0.004, sz], 0.003, '#2e241c', 3);
  });
  // swallow-tailed pennant on the mainmast
  const mm = X(0.41), mt = cy + sheer(0.41) + H;
  slab(p, [[0, 0], [0.06, 0.004], [0.045, -0.008], [0.06, -0.02], [0, -0.016]], 0.002, '#7e4236', 0, false).position.set(mm, mt, cz);
}

/** Kneeling Bactrian camel with silk bales — used for Marco Polo. Faces +x locally. */
function camel(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number): void {
  // standing two-humped Bactrian camel of the Silk Road, head toward +x
  const c = '#b28a5c', d = tint(c, -0.22), grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(s); p.add(grp);
  ellip(grp, c, 0, 0.42, 0, 0.24, 0.1, 0.11);
  for (const hx of [-0.1, 0.08]) ellip(grp, d, hx, 0.52, 0, 0.075, 0.09, 0.065);
  for (const sz of [-1, 1]) for (const lx of [-0.15, 0.14]) {
    tube(grp, [[lx, 0.4, sz * 0.06], [lx + 0.015, 0.21, sz * 0.06], [lx, 0.02, sz * 0.06]], 0.045, 0.024, c, { radial: 6, sub: 3 });
    ellip(grp, d, lx + 0.015, 0.21, sz * 0.06, 0.026, 0.026, 0.024);
    ellip(grp, d, lx + 0.015, 0.012, sz * 0.06, 0.032, 0.012, 0.026);
  }
  tube(grp, [[0.18, 0.44, 0], [0.28, 0.44, 0], [0.33, 0.56, 0], [0.35, 0.66, 0]], 0.06, 0.04, c, { radial: 8, sub: 4 });
  for (let i = 0; i < 4; i++) ellip(grp, d, 0.24 + i * 0.03, 0.4 + i * 0.05, 0, 0.03, 0.04, 0.04);
  ellip(grp, c, 0.39, 0.68, 0, 0.075, 0.042, 0.042, 0, 0, -0.2);
  ellip(grp, tint(c, -0.12), 0.45, 0.66, 0, 0.03, 0.03, 0.034);
  for (const sz of [-1, 1]) { ellip(grp, '#1f1a17', 0.4, 0.7, sz * 0.036, 0.01); ellip(grp, c, 0.36, 0.72, sz * 0.03, 0.012, 0.02, 0.008); }
  tube(grp, [[-0.23, 0.44, 0], [-0.27, 0.32, 0]], 0.012, 0.008, d, { radial: 4, sub: 2 });
  // felt saddle cloth between the humps and felt-wrapped bales lashed on both flanks
  box(grp, '#693d31', -0.01, 0.5, 0, 0.09, 0.012, 0.25);
  for (const sz of [-1, 1]) {
    const b1 = cyl(grp, sz > 0 ? '#8c7a5c' : '#9a8460', 0, 0.38, sz * 0.14, 0.045, 0.14, 10); b1.rotation.z = Math.PI / 2;
    box(grp, '#4a3a2a', 0, 0.4, sz * 0.14, 0.012, 0.095, 0.095);
  }
  rod(grp, [0.43, 0.66, 0], [0.5, 0.35, 0.12], 0.003, '#7b5a3b', 3);
}

/** Date palm. */

/** Small husky lying / standing. Faces +x. */

/** Lunar module (descent stage in gold foil, faceted ascent stage). */

/** Vostok rocket on its pad: R-7 core + four tapering boosters, Vostok sphere on top. */

/** Red Lockheed Vega 5B: round monocoque fuselage, thick high wing, NACA cowl, spatted wheels. Nose +x. */

const ring = (p: THREE.Object3D, c: string, x: number, y: number, z: number, R: number, rx = 0, ry = 0, rz = 0, k = 0.12) =>
  add(p, g('pc-torus' + k, () => new THREE.TorusGeometry(1, k, 6, 18)), mat(c), x, y, z, R, R, R, ry, rx, rz);

/** Rammed-earth beacon tower (烽燧) of the Hexi corridor / Dunhuang frontier: a battered square tower laid in earth
 *  courses with reed layers, a low parapet and the beacon poles on top. */
function beacon(p: THREE.Object3D, x: number, y: number, z: number, s: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = 0.35; grp.scale.setScalar(s); p.add(grp);
  const E = '#b39871', r0 = 0.15, r1 = 0.1, h = 0.42;
  lathe(grp, [[0, 0], [r0, 0], [r1, h], [0, h]], E, 0, 0, 0, 4).rotation.y = Math.PI / 4;
  // darker reed courses between the rammed layers
  for (let k = 1; k < 9; k++) {
    const yy = (k / 9) * h, rr = r0 + (r1 - r0) * (k / 9) + 0.002;
    lathe(grp, [[0, yy], [rr, yy], [rr - 0.001, yy + 0.006], [0, yy + 0.006]], '#8a7556', 0, 0, 0, 4).rotation.y = Math.PI / 4;
  }
  // eroded corner and a parapet with a gap
  ellip(grp, tint(E, -0.12), r1 * 0.7, h * 0.55, r1 * 0.7, 0.03, 0.06, 0.03);
  const q = r1 * 0.71;
  for (const [bx, bz, bw, bd] of [[0, -q, 2 * q, 0.02], [-q, 0, 0.02, 2 * q], [q, -q * 0.35, 0.02, q * 1.3], [-q * 0.45, q, q * 1.1, 0.02]] as const)
    box(grp, tint(E, 0.04), bx, h, bz, bw, 0.035, bd);
  for (const [px, pz] of [[-0.02, -0.02], [0.03, 0.01]]) rod(grp, [px, h, pz], [px + 0.01, h + 0.12, pz], 0.004, '#5a4632', 4);
  // brushwood heaps (积薪) at the foot, ready to be fired
  for (const [px, pz] of [[0.2, 0.05], [0.16, 0.16]]) {
    for (let k = 0; k < 7; k++) rod(grp, [px + Math.cos(k) * 0.035, 0, pz + Math.sin(k) * 0.035], [px, 0.07, pz], 0.004, k % 2 ? '#6e5a40' : '#7d6a4c', 3);
  }
}

/** Sankore mosque miniature: mud-brick walls and a stepped pyramidal tower bristling with wooden toron. */

// ---------------------------------------------------------------- builders

/** Shared museum plinth (walnut side, site-coloured top); its meshes are tagged so `settle` leaves them alone. */
function base(gp: THREE.Object3D, top: string): number {
  const n = gp.children.length, h = plinth(gp, top);
  for (const c of gp.children.slice(n)) c.userData.plinth = true;
  return h;
}
/**
 * Scales the scene above the plinth (figure, props, scenery) by k about the plinth top: the hero, authored at the
 * figure.ts default 0.62, ends up ≈0.53 tall, in scale with the map's building dioramas, and stays inside the rim.
 */
function settle(gp: THREE.Object3D, k = 0.85): void {
  const top = 0.035, s = new THREE.Group();
  s.position.y = top;
  s.scale.setScalar(k);
  for (const c of [...gp.children]) if (!c.userData.plinth) { c.position.y -= top; s.add(c); }
  gp.add(s);
}

const BUILDERS: Record<string, Builder> = {
  /** Admiral Zheng He (Ming, 1405–33 voyages) on the Longjiang shipyard quay at Nanjing, his six-masted treasure ship
   *  behind. Ref: Nanjing 宝船厂 replica (福船 hull, battened junk sails) and the Treasure Boat Shipyard / Melaka statues
   *  (scroll chart in hand, red 圆领袍 with 补子, 乌纱帽, jade belt). */
  pp_zhenghe: gp => {
    const y = base(gp, SITE.water);
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.14 + (i % 5) * 0.06; ellip(gp, '#6f8c92', Math.cos(a) * r, y + 0.001, -Math.abs(Math.sin(a)) * r - 0.04, 0.028, 0.0025, 0.006, a); }
    const quay: [number, number][] = [];
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; quay.push([Math.cos(a) * 0.445, 0.02 + Math.sin(a) * 0.425]); }
    prism(gp, quay, y, 0.03, '#a59c88');
    for (let i = 0; i < 9; i++) box(gp, tint('#a59c88', (i % 2) * -0.08), -0.4 + i * 0.1, y, 0.01, 0.098, 0.031, 0.025);
    for (const bx of [-0.3, 0.3]) { cyl(gp, '#4b4540', bx, y + 0.03, 0.06, 0.016, 0.03, 8); ellip(gp, '#4b4540', bx, y + 0.06, 0.06, 0.02, 0.01, 0.02); }
    tube(gp, [[0.3, y + 0.05, 0.06], [0.28, y + 0.03, -0.04], [0.22, y + 0.03, -0.17]], 0.004, 0.004, '#9a8460', { radial: 4, sub: 3 });
    // cargo on the quay: lashed crates and a stack of porcelain jars
    rbox(gp, '#6b5038', 0.3, y + 0.03, 0.2, 0.08, 0.05, 0.06, 0.004);
    box(gp, '#4a3a2a', 0.3, y + 0.03, 0.2, 0.082, 0.052, 0.008);
    for (const [jx, jz] of [[0.2, 0.28], [0.25, 0.32]] as const) lathe(gp, [[0, 0], [0.018, 0], [0.026, 0.03], [0.02, 0.05], [0.01, 0.055], [0.012, 0.062], [0, 0.062]], '#d9d6cc', jx, y + 0.03, jz, 10);
    for (const [jx, jz] of [[0.2, 0.28], [0.25, 0.32]] as const) lathe(gp, [[0.0255, 0.026], [0.0262, 0.026], [0.0245, 0.04], [0.0225, 0.04]], '#4a5e7a', jx, y + 0.03, jz, 10);
    baochuan(gp, 0.0, y + 0.006, -0.25, 0.76);
    const yf = y + 0.03, o: FigureOpts = {
      y: yf, x: -0.2, z: 0.17, h: 0.56, top: '#773f35', accent: '#2a2420', outfit: 'roundrobe', wideSleeves: true, hair: '#1c1917', hat: 'wusha', hatColor: '#1c1917',
      badge: '#a6894e', skin: '#d6a47c', shoes: '#1f1a17',
      armL: { fwd: 0.75, side: 0.15, bend: 0.8, inward: 0.4 }, armR: { fwd: 1.2, side: 0.55, bend: 0.1 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // stiff hoop belt (革带) hanging loose at the hips with jade plaques
    lathe(b, [[0.128 * u, 0.465 * u], [0.136 * u, 0.465 * u], [0.136 * u, 0.49 * u], [0.128 * u, 0.49 * u]], '#2a2420', 0, 0, 0, 20).scale.z = 0.8;
    for (const sx of [-0.06, -0.02, 0.02, 0.06]) box(b, '#8e8a72', sx * u, 0.468 * u, 0.106 * u - Math.abs(sx) * 0.12 * u, 0.026 * u, 0.018 * u, 0.006 * u);
    // dry compass (旱罗盘) in a wooden case in the left hand
    const [lx, ly, lz] = a.handL;
    rbox(gp, '#583e2a', lx + 0.01, ly + 0.008, lz + 0.02, 0.06, 0.012, 0.06, 0.004);
    metal(cyl(gp, '#86693e', lx + 0.01, ly + 0.02, lz + 0.02, 0.022, 0.003, 14), '#86693e', 0.5, 0.5);
    box(gp, '#2a2420', lx + 0.01, ly + 0.0235, lz + 0.02, 0.003, 0.002, 0.034, 0.5);
    // rolled sea chart in the outstretched hand
    const [rx, ry, rz] = a.handR;
    const sc = cyl(gp, '#d8cbab', rx, ry - 0.045, rz + 0.01, 0.011, 0.09, 8); sc.rotation.z = 0.2;
    for (const d of [-1, 1]) ellip(gp, '#3a2a1e', rx - d * 0.009, ry + d * 0.045, rz + 0.01, 0.013, 0.005, 0.013);
  },

  /** Xuanzang (Tang, 629–645) on the frontier road west, carrying his bamboo book-frame (笈) with a canopy and hanging
   *  lamp, fly-whisk and sutra in hand. Ref: 玄奘三藏像 (Tokyo National Museum) / Dunhuang 行脚僧图; Hexi 烽燧; the Met's
   *  Kamakura "Portrait of Xuanzang with Attendant" for the shaven head and brown robe. */
  pp_xuanzang: gp => {
    const y = base(gp, SITE.sand);
    mound(gp, '#c4aa80', -0.08, y, -0.34, 0.15, 0.045);
    // the caravan road: packed earth with cart ruts, winding away to the back right
    const P: [number, number][] = [[-0.06, 0.45], [-0.02, 0.26], [0.04, 0.06], [0.14, -0.12], [0.24, -0.3]], wl: [number, number][] = [], wr: [number, number][] = [];
    P.forEach(([px, pz], i) => {
      const [qx, qz] = P[Math.min(i + 1, P.length - 1)], [ox, oz] = P[Math.max(i - 1, 0)], dx = qx - ox, dz = qz - oz, l = Math.hypot(dx, dz), w = 0.075 - i * 0.008;
      wl.push([px - (dz / l) * w, pz + (dx / l) * w]); wr.push([px + (dz / l) * w, pz - (dx / l) * w]);
    });
    prism(gp, [...wl, ...wr.reverse()], y, 0.002, '#b8a07c', 0, true);
    for (const off of [-0.025, 0.025]) tube(gp, P.map(([px, pz]) => [px + off, y + 0.0025, pz] as V3), 0.0025, 0.0025, '#a08a68', { radial: 3, sub: 3 });
    beacon(gp, -0.26, y, -0.2, 0.75);
    rocks(gp, '#8f7b63', [[0.3, 0.22, 0.03], [0.34, 0.15, 0.02], [-0.33, 0.14, 0.025], [-0.25, 0.28, 0.018]], y);
    // camel-thorn (骆驼刺) tussocks
    for (const [tx, tz] of [[-0.36, 0.02], [0.38, 0.04], [0.2, 0.33], [-0.18, 0.36]]) for (let k = 0; k < 7; k++)
      rod(gp, [tx, y, tz], [tx + Math.cos(k * 0.9) * 0.025, y + 0.03 + (k % 3) * 0.006, tz + Math.sin(k * 0.9) * 0.025], 0.003, k % 2 ? '#7d8455' : '#8f8a5c', 3);
    const o: FigureOpts = {
      y, x: 0.0, z: 0.1, ry: 0.25, skin: '#d4a27c', top: '#7a6046', bottom: '#5c4a38', accent: '#4a3a2a', outfit: 'tunic', hair: '#5a4a3c', hairStyle: 'bald',
      shoes: '#a8925e', socks: '#d4c8ac', stance: 'walk', lean: 0.05,
      armL: { fwd: 0.6, side: 0.12, bend: 0.75, inward: 0.35 }, armR: { fwd: 0.9, side: 0.3, bend: 0.9, inward: 0.15 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u;
    // knee-length monk's robe (褊衫/直裰) over the trousers, crossed collar
    lathe(b, [[0.168 * u, 0.27 * u], [0.174 * u, 0.27 * u], [0.152 * u, 0.36 * u], [0.13 * u, 0.45 * u], [0.12 * u, 0.5 * u], [0, 0.5 * u]], '#7a6046', 0, 0, 0, 20).scale.z = 0.8;
    box(b, '#4a3a2a', -0.018 * u, 0.765 * u, 0.094 * u, 0.016 * u, 0.13 * u, 0.008 * u, 0, 0, 0.42);
    box(b, '#4a3a2a', 0.022 * u, 0.79 * u, 0.092 * u, 0.016 * u, 0.09 * u, 0.008 * u, 0, 0, -0.42);
    // bamboo book-frame (笈): four posts, rails and shelves of wrapped sutra rolls and a lacquered sutra box
    const xw = 0.13 * u, z0 = -0.11 * u, z1 = -0.27 * u, yb = 0.28 * u, yt = 1.1 * u, BAM = '#9a8150';
    for (const sx of [-1, 1]) for (const zz of [z0, z1]) rod(b, [sx * xw, yb, zz], [sx * xw, yt, zz], 0.008 * u, BAM, 5);
    for (const sy of [0.3, 0.52, 0.76, 1.0]) {
      for (const zz of [z0, z1]) rod(b, [-xw, sy * u, zz], [xw, sy * u, zz], 0.006 * u, BAM, 4);
      for (const sx of [-1, 1]) rod(b, [sx * xw, sy * u, z0], [sx * xw, sy * u, z1], 0.006 * u, BAM, 4);
    }
    const wraps = ['#5a4030', '#c7b48b', '#6e5236', '#8a6a48'];
    for (const [r, sy] of [[0, 0.3], [2, 0.76]] as const) for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) {
      const sc = cyl(b, wraps[(k + j + r) % 4], 0, 0, 0, 0.032 * u, xw * 1.85, 8);
      sc.rotation.z = Math.PI / 2; sc.position.set(0, (sy + 0.04 + k * 0.066) * u, z0 - 0.042 * u - j * 0.078 * u);
    }
    rbox(b, '#3a2a22', 0, 0.53 * u, (z0 + z1) / 2, xw * 1.8, 0.2 * u, (z0 - z1) * 0.9, 0.008 * u);
    box(b, '#86693e', 0, 0.62 * u, z1 + 0.012 * u, xw * 1.0, 0.025 * u, 0.006 * u);
    // the canopy (笈盖) over his head: a bamboo-mat board with a cloth fringe, and the little lamp hanging in front
    const cz0 = (z1 + 0.16 * u) / 2, cd = 0.16 * u - z1;
    const can = box(b, '#8a7a58', 0, yt, cz0, 0.3 * u, 0.01 * u, cd); can.rotation.x = -0.1;
    for (let i = 0; i < 8; i++) box(b, i % 2 ? '#6c4a34' : '#5c3e2c', (-0.14 + i * 0.04) * u, yt - 0.045 * u, 0.16 * u - 0.002 * u, 0.036 * u, 0.045 * u, 0.006 * u);
    for (const sx of [-1, 1]) {
      box(b, '#5c3e2c', sx * 0.16 * u, yt - 0.04 * u, cz0, 0.006 * u, 0.04 * u, cd * 0.95);
      rod(b, [sx * xw, yt - 0.1 * u, z0], [sx * 0.15 * u, yt, 0.14 * u], 0.005 * u, BAM, 4);
    }
    rod(b, [-0.15 * u, yt, 0.14 * u], [-0.2 * u, yt + 0.03 * u, 0.24 * u], 0.005 * u, BAM, 4);
    rod(b, [-0.2 * u, yt + 0.03 * u, 0.24 * u], [-0.2 * u, yt - 0.1 * u, 0.24 * u], 0.0015 * u, '#2e241c', 3);
    lathe(b, [[0, 0], [0.018 * u, 0.004 * u], [0.024 * u, 0.02 * u], [0.02 * u, 0.022 * u], [0, 0.01 * u]], '#5a4a32', -0.2 * u, yt - 0.125 * u, 0.24 * u, 8);
    glow(ellip(b, '#e2cfa7', -0.2 * u, yt - 0.095 * u, 0.24 * u, 0.006 * u, 0.012 * u, 0.006 * u), '#e2cfa7', '#c59b63');
    // shoulder straps
    for (const sx of [-1, 1]) tube(b, [[sx * 0.07 * u, 0.62 * u, 0.09 * u], [sx * 0.09 * u, 0.79 * u, 0.06 * u], [sx * 0.1 * u, 0.83 * u, -0.02 * u], [sx * 0.11 * u, 0.78 * u, z0]], 0.01 * u, 0.01 * u, '#4a3a2a', { radial: 5, sub: 4 });
    // horsehair fly-whisk (拂子) in the right hand, sutra roll in the left
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.012, rz], [rx + 0.012, ry + 0.07, rz + 0.02], 0.004, '#472f21', 5);
    for (let k = 0; k < 5; k++) tube(gp, [[rx + 0.012, ry + 0.07, rz + 0.02], [rx + 0.02 + k * 0.003, ry + 0.062, rz + 0.03 + (k % 2) * 0.004], [rx + 0.024 + k * 0.004, ry - 0.005 - (k % 3) * 0.006, rz + 0.034 + (k - 2) * 0.004]], 0.004, 0.002, '#e2dccb', { radial: 4, sub: 3 });
    const [lx, ly, lz] = a.handL;
    const sl = cyl(gp, '#d7ccab', 0, 0, 0, 0.012, 0.09, 8); sl.rotation.z = Math.PI / 2; sl.position.set(lx + 0.02, ly + 0.004, lz + 0.012);
    box(gp, '#5a4030', lx + 0.02, ly - 0.008, lz + 0.012, 0.012, 0.025, 0.027);
  },

  /** Hua Tuo (Eastern Han physician, d. 208) in his herb yard: drying trays on a bamboo rack, a Han pottery stove
   *  brewing a decoction, a bronze mortar and the 五禽戏 drawn on a silk scroll. Ref: Han 陶灶 tomb models, Mawangdui 导引图;
   *  the Wellcome "Famous medical figures" woodcut of 良医华佗 (light robe with dark collar, topknot, long beard). */
  pp_huatuo: gp => {
    const y = base(gp, SITE.earth);
    for (let i = 0; i < 5; i++) ellip(gp, tint('#9c9070', (i % 2) * 0.06), 0.02 + Math.sin(i) * 0.03, y + 0.003, 0.42 - i * 0.075, 0.04, 0.006, 0.03, i);
    // bamboo drying rack with three round sieve trays of sliced roots, bark and leaves; tied bundles below
    const RX = -0.14, RZ = -0.3, BAM = '#9a8150';
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.06, 0.06]) rod(gp, [RX + sx, y, RZ + sz], [RX + sx, y + 0.13, RZ + sz], 0.005, BAM, 4);
    for (const yy of [0.06, 0.13]) for (const sz of [-0.06, 0.06]) rod(gp, [RX - 0.21, y + yy, RZ + sz], [RX + 0.21, y + yy, RZ + sz], 0.004, BAM, 4);
    const herbs = [['#8a6a44', '#a07c4e'], ['#5e6a44', '#6e7a50'], ['#6c4a34', '#997049']];
    herbs.forEach(([c1, c2], i) => {
      const t = new THREE.Group(); t.position.set(RX - 0.13 + i * 0.13, y + 0.135, RZ); t.rotation.x = 0.28; gp.add(t);
      lathe(t, [[0, 0], [0.062, 0], [0.066, 0.012], [0.06, 0.012], [0, 0.004]], '#b09868', 0, 0, 0, 16);
      for (let k = 0; k < 9; k++) ellip(t, k % 2 ? c1 : c2, Math.cos(k * 2.1) * 0.035 * ((k % 3) / 2 + 0.3), 0.008, Math.sin(k * 2.1) * 0.035 * ((k % 3) / 2 + 0.3), 0.012, 0.003, 0.008, k);
    });
    for (let i = 0; i < 4; i++) {
      const bx = RX - 0.15 + i * 0.1, bd = cyl(gp, i % 2 ? '#7a7048' : '#8a6a48', 0, 0, 0, 0.014, 0.07, 6);
      bd.rotation.z = Math.PI / 2; bd.position.set(bx, y + 0.075, RZ); box(gp, '#4a3a2a', bx, y + 0.06, RZ, 0.005, 0.03, 0.03);
    }
    // Han pottery stove (陶灶): firebox with a stoke-hole, a cauldron (釜) with a lid, and a chimney
    const SX = 0.27, SZ = -0.14;
    rbox(gp, '#857868', SX, y, SZ, 0.11, 0.07, 0.15, 0.01, -0.5);
    const door = new THREE.Group(); door.position.set(SX, y, SZ); door.rotation.y = -0.5; gp.add(door);
    box(door, '#241c18', 0, 0.008, 0.076, 0.04, 0.03, 0.004);
    glow(box(door, '#76432e', 0, 0.01, 0.075, 0.03, 0.012, 0.004), '#76432e', '#643526');
    cyl(door, '#857868', 0, 0.07, -0.06, 0.012, 0.09, 8);
    lathe(door, [[0, 0], [0.03, 0.005], [0.042, 0.025], [0.034, 0.045], [0.03, 0.05], [0, 0.05]], '#3e3630', 0, 0.06, 0.02, 14);
    lathe(door, [[0, 0], [0.034, 0], [0.02, 0.012], [0.006, 0.016], [0, 0.016]], '#4a4038', 0, 0.11, 0.02, 12);
    for (let k = 0; k < 4; k++) rod(gp, [SX + 0.08 + k * 0.012, y + 0.004, SZ + 0.1 - k * 0.01], [SX + 0.02 + k * 0.01, y + 0.008, SZ + 0.16], 0.004, '#5a4632', 3);
    // bronze mortar (臼) and pestle
    lathe(gp, [[0, 0], [0.032, 0], [0.042, 0.03], [0.038, 0.05], [0.031, 0.05], [0.027, 0.02], [0, 0.015]], '#5e5a44', 0.2, y, 0.24, 14);
    rod(gp, [0.2, y + 0.03, 0.24], [0.23, y + 0.1, 0.22], 0.006, '#4a4436');
    // low table (案) with the silk 五禽戏 chart, bamboo slips and a bowl of decoction
    const ax = -0.24, az = 0.16;
    box(gp, '#3e2a1e', ax, y + 0.05, az, 0.17, 0.012, 0.09, 0.4);
    for (const sx of [-1, 1]) box(gp, '#3e2a1e', ax + Math.cos(0.4) * sx * 0.07, y, az - Math.sin(0.4) * sx * 0.07, 0.012, 0.05, 0.08, 0.4);
    const sk = new THREE.Group(); sk.position.set(ax, y + 0.062, az); sk.rotation.y = 0.4; gp.add(sk);
    box(sk, '#d3c6a3', -0.025, 0, 0, 0.09, 0.002, 0.06);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      const fx = -0.06 + i * 0.018, fz = -0.014 + j * 0.028;
      rod(sk, [fx, 0.003, fz - 0.008], [fx, 0.003, fz + 0.004], 0.003, '#5a4030', 3);
      rod(sk, [fx - 0.005, 0.003, fz - 0.002], [fx + 0.005, 0.003, fz - 0.004 + j * 0.004], 0.003, '#5a4030', 3);
      ellip(sk, '#5a4030', fx, 0.003, fz + 0.007, 0.003, 0.0015, 0.003);
    }
    for (let i = 0; i < 5; i++) box(sk, tint('#b69964', (i % 2) * 0.06), 0.045 + i * 0.008, 0, 0.0, 0.007, 0.004, 0.06);
    lathe(sk, [[0, 0], [0.012, 0], [0.02, 0.014], [0.018, 0.016], [0, 0.006]], '#3a2420', 0.05, 0.004, 0.035, 12);
    // mugwort and other medicinal plants by the yard edge
    for (const [px, pz] of [[-0.37, -0.06], [-0.34, 0.02], [0.38, 0.08]]) for (let k = 0; k < 4; k++) {
      const tx = px + Math.cos(k * 1.6) * 0.018, tz = pz + Math.sin(k * 1.6) * 0.018, hh = 0.07 + (k % 2) * 0.02;
      rod(gp, [tx, y, tz], [tx, y + hh, tz], 0.003, '#5a6a40', 3);
      for (let j = 0; j < 3; j++) ellip(gp, j % 2 ? '#6a7a4c' : '#7a8658', tx + (j % 2 ? 0.008 : -0.008), y + hh * (0.45 + j * 0.2), tz, 0.011, 0.003, 0.006, k, 0, j % 2 ? -0.5 : 0.5);
    }
    const o: FigureOpts = {
      y, x: 0.02, z: 0.06, top: '#bdb091', accent: '#5a4a3a', bottom: '#a89c80', outfit: 'robe', wideSleeves: true, hair: '#cfcac0', hairStyle: 'topknot',
      beard: 'long', beardColor: '#e4e0d6', skin: '#d9a982', shoes: '#2e2620',
      armL: { fwd: 0.4, side: 0.2, bend: 0.7, inward: 0.1 }, armR: { fwd: 1.25, side: 0.35, bend: 0.9 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR;
    // Han commoner's head-cloth (帻) wrapped round the head below the topknot
    lathe(b, [[hr * 1.05, 0], [hr * 1.07, 0], [hr * 1.03, hr * 0.4], [hr * 0.9, hr * 0.64], [hr * 0.5, hr * 0.76], [0, hr * 0.8]], '#2e2a26', 0, 0.93 * u + hr * 0.28, -hr * 0.06, 16);
    ellip(b, '#2e2a26', 0, 0.93 * u + hr * 1.18, -hr * 0.1, hr * 0.4, hr * 0.38, hr * 0.4);
    // medicine gourd on the belt
    ellip(b, '#a6834e', 0.14 * u, 0.42 * u, 0.07 * u, 0.038 * u, 0.042 * u, 0.038 * u);
    ellip(b, '#a6834e', 0.14 * u, 0.48 * u, 0.07 * u, 0.026 * u);
    box(b, '#5a4030', 0.14 * u, 0.505 * u, 0.07 * u, 0.01 * u, 0.03 * u, 0.01 * u);
    // a freshly cut herb held up
    const [rx, ry, rz] = a.handR;
    rod(gp, [rx, ry - 0.02, rz], [rx + 0.01, ry + 0.09, rz + 0.01], 0.003, '#4e5a36', 4);
    for (let k = 0; k < 6; k++) ellip(gp, k % 2 ? '#5e6e40' : '#6e7c4c', rx + (k % 2 ? 0.013 : -0.011), ry + 0.02 + k * 0.012, rz + 0.01, 0.013, 0.005, 0.007, 0, 0, k % 2 ? -0.6 : 0.6);
    // bamboo herb basket in the left hand
    const [lx, ly, lz] = a.handL;
    lathe(gp, [[0, 0], [0.04, 0], [0.05, 0.035], [0.047, 0.04], [0.038, 0.01], [0, 0.008]], '#9a8150', lx, ly - 0.06, lz + 0.02, 12);
    ring(gp, '#7a6440', lx, ly - 0.015, lz + 0.02, 0.04, 0, 0, 0, 0.08);
    for (let k = 0; k < 5; k++) ellip(gp, k % 2 ? '#6a5236' : '#5e6a44', lx + Math.cos(k * 1.3) * 0.022, ly - 0.025, lz + 0.02 + Math.sin(k * 1.3) * 0.022, 0.016, 0.008, 0.01);
  },

  /** Marco Polo, Venetian merchant at the Yuan court (1275–92): 13th-c. Italian gown, mantle and coif, holding the gold
   *  paiza (牌子) of Kublai Khan; a laden Bactrian camel and a felt ger at Shangdu. Ref: Met paiza, 13th-c. Italian dress;
   *  Palazzo Doria-Tursi mosaic (red gown, dark cap, full beard). */
  pp_marcopolo: gp => {
    const y = base(gp, SITE.loess);
    for (let i = 0; i < 14; i++) { const a2 = i * 2.2, r = 0.16 + (i % 4) * 0.07; ellip(gp, tint('#a09868', (i % 3) * 0.04), Math.cos(a2) * r, y + 0.002, Math.sin(a2) * r, 0.03, 0.004, 0.02, a2); }
    // Mongol felt ger with lattice band, roof ropes and a painted wooden door
    const GX = 0.24, GZ = -0.2;
    lathe(gp, [[0, 0], [0.15, 0], [0.152, 0.09], [0.14, 0.1], [0.03, 0.17], [0, 0.17]], '#d6ccb4', GX, y, GZ, 22);
    lathe(gp, [[0.026, 0.168], [0.034, 0.168], [0.034, 0.18], [0.026, 0.18]], '#6b5a46', GX, y, GZ, 12);
    for (const yy of [0.03, 0.075]) lathe(gp, [[0.151, yy], [0.155, yy], [0.155, yy + 0.006], [0.151, yy + 0.006]], '#6b5a46', GX, y, GZ, 22);
    const dg = new THREE.Group(); dg.position.set(GX, y, GZ); dg.rotation.y = -0.45; gp.add(dg);
    box(dg, '#744c34', 0, 0, 0.15, 0.05, 0.08, 0.01);
    box(dg, '#a6894e', 0, 0.035, 0.156, 0.03, 0.004, 0.002);
    camel(gp, -0.2, y, -0.17, 0.7, Math.PI + 0.35);
    // trade goods: felt-wrapped bales and a bolt of silk
    for (const [bx, bz, br] of [[0.3, 0.12, 0.3], [0.33, 0.22, -0.2]] as const) {
      rbox(gp, '#8c7a5c', bx, y, bz, 0.08, 0.045, 0.06, 0.012, br);
      box(gp, '#4a3a2a', bx, y, bz, 0.008, 0.047, 0.062, br);
    }
    const bolt = cyl(gp, '#6e4a52', 0, 0, 0, 0.018, 0.07, 10); bolt.rotation.set(Math.PI / 2, 0, 0.7); bolt.position.set(0.22, y + 0.018, 0.26);
    const o: FigureOpts = {
      y, x: 0.06, z: 0.15, top: '#65332d', accent: '#3a2a20', bottom: '#492a23', outfit: 'dress', cape: '#3d4656', hair: '#553b27', hairStyle: 'short',
      beard: 'short', beardColor: '#553b27', skin: '#e0b896', shoes: '#2a201a',
      armL: { fwd: 0.35, side: 0.25, bend: 0.5, inward: 0.1 }, armR: { fwd: 1.0, side: 0.12, bend: 0.75, inward: 0.35 },
    };
    const a = figure(gp, o), b = bodyOf(a), u = a.u, hr = a.headR;
    // soft round felt cap with a rolled brim
    lathe(b, [[hr * 1.06, 0], [hr * 1.12, hr * 0.1], [hr * 1.06, hr * 0.24], [hr * 0.96, hr * 0.27], [hr * 0.92, hr * 0.5], [hr * 0.6, hr * 0.72], [0, hr * 0.78]], '#3e3228', 0, 0.93 * u + hr * 0.42, -hr * 0.04, 16);
    // leather purse (escarcelle) and knife on the belt
    rbox(b, '#4a3424', -0.1 * u, 0.44 * u, 0.09 * u, 0.05 * u, 0.06 * u, 0.02 * u, 0.006 * u);
    rod(b, [0.11 * u, 0.5 * u, 0.08 * u], [0.13 * u, 0.4 * u, 0.09 * u], 0.008 * u, '#2a201a', 4);
    // travelling staff in the left hand
    const [lx, ly, lz] = a.handL;
    rod(gp, [lx - 0.01, y, lz + 0.01], [lx + 0.006, ly + 0.2, lz - 0.004], 0.006, '#5a4632', 6);
    // gold paiza: a round-topped tablet with a hanging ring, held up to show
    const [rx, ry, rz] = a.handR, pz = new THREE.Group(); pz.position.set(rx, ry + 0.045, rz + 0.015); gp.add(pz);
    metal(box(pz, '#b09252', 0, -0.035, 0, 0.026, 0.06, 0.004), '#b09252', 0.7, 0.35);
    const disc = metal(cyl(pz, '#b09252', 0, 0, 0, 0.013, 0.004, 14), '#b09252', 0.7, 0.35); disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.025, 0);
    ring(pz, '#86693e', 0, 0.042, 0, 0.007, Math.PI / 2, 0, 0, 0.2);
    for (let k = 0; k < 3; k++) box(pz, '#66502e', -0.006 + k * 0.006, -0.03, 0.0025, 0.002, 0.045, 0.001);
  },
};

/** Swap the shared 22×15 ellipsoid for lighter spheres on small parts (eyes, hands, buttons, hair puffs) — the figurine
 *  alone would otherwise use ~20k triangles. Large parts (heads, helmets) keep the smooth version. */
function slim(gp: THREE.Group, bias = 1): void {
  const lod = (s: number) => g('pc-sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(4, Math.round(s * 0.7))));
  const spheres = new Set<THREE.BufferGeometry>([g('esph', () => new THREE.SphereGeometry(1, 22, 15)), lod(6), lod(8), lod(12), lod(16)]);
  const v = new THREE.Vector3();
  gp.updateMatrixWorld(true);
  gp.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !spheres.has(m.geometry)) return;
    m.getWorldScale(v);
    const raw = Math.max(v.x, v.y, v.z), r = raw / bias;
    if (raw < 0.075) m.geometry = lod(r > 0.05 || raw > 0.06 ? 16 : r > 0.028 ? 12 : r > 0.012 ? 8 : 6);
  });
}

/** a few busy scenes (many small animals / fur tufts) get coarser spheres to stay inside the triangle budget */
const BIAS: Record<string, number> = { pp_amundsen: 1.25 };

export const H_PEOPLE_C: Record<string, Builder> = Object.fromEntries(
  Object.entries(BUILDERS).map(([k, f]) => [k, ((gp, r) => { f(gp, r); settle(gp); slim(gp, BIAS[k]); }) as Builder]),
);

