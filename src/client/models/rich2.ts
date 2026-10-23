import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, tbox, cyl, cone, rbox, rod, skin, slab, lathe, prism, gable, tube, sweep, shade, mix,
  hash3, fbm, paintFaces, panel,
} from './prims.ts';
import { human, type HumanOpts } from './human.ts';
import { grp, hall, minipine } from './timber.ts';

// Detailed replacements for the last crude lite models (prehistory → modern China). Same conventions as rich.ts:
// front faces +z, base at y=0, footprint ≈ ±0.45, animated parts are named groups (see scene/animate.ts).

const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz), s = r > 0.05 ? 14 : r > 0.025 ? 10 : 7;
  return add(p, g('r2:sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(4, Math.round(s * 0.6)))), mat(c), x, y, z, rx, ry, rz, roty, rotx, rotz);
};
function anim(p: THREE.Object3D, name: 'spin' | 'flap' | 'sway' | 'bob' | 'flicker' | 'smoke', x = 0, y = 0, z = 0, data: Record<string, unknown> = {}): THREE.Group {
  const gr = new THREE.Group();
  gr.name = name;
  gr.position.set(x, y, z);
  Object.assign(gr.userData, data);
  p.add(gr);
  return gr;
}

const P = {
  wood: '#7a5536', darkwood: '#4a3222', bronze: '#8a6a3a', patina: '#4f8a6e', gold: '#d6a840', iron: '#4b5058', water: '#3f6f86',
  stone: '#bdb4a2', tile: '#4a4f57', vermilion: '#a8352a', thatch: '#b39a5e', bone: '#e6dcc2', lacquer: '#6e1c14', concrete: '#c9c4b8',
};

function ground(p: THREE.Object3D, R: number, top: string, side = shade(top, 0.7), h = 0.03): number {
  lathe(p, [[0, 0], [R, 0], [R * 0.98, h * 0.8], [R * 0.95, h], [0, h]], side, 0, 0, 0, 40);
  lathe(p, [[0, h], [R * 0.95, h], [0, h + 0.002]], top, 0, 0, 0, 40);
  return h;
}
const FCONE = () => g('r2:fcone', () => new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0));
const ICO = () => g('r2:ico', () => new THREE.IcosahedronGeometry(1, 0));
function flame(p: THREE.Object3D, x: number, y: number, z: number, s: number): THREE.Group {
  const f = anim(p, 'flicker', x, y, z);
  add(f, FCONE(), mat('#f59e0b', { emissive: '#f97316' }), 0, 0, 0, s * 0.7, s, s * 0.7);
  add(f, FCONE(), mat('#fde68a', { emissive: '#fbbf24' }), 0, 0, 0, s * 0.36, s * 0.62, s * 0.36);
  return f;
}
function smoke(p: THREE.Object3D, x: number, y: number, z: number, size: number, c = '#d6d0c4', n = 5, op = 0.55): THREE.Group {
  const sm = anim(p, 'smoke', x, y, z, { size });
  for (let i = 0; i < n; i++) add(sm, ICO(), mat(c, { transparent: op }), 0, 0, 0, 0.01, 0.01, 0.01);
  return sm;
}
/** Polygon points pushed back inside radius R (keeps water/plazas on the round base). */
const clipR = (pts: [number, number][], R: number): [number, number][] => pts.map(([x, z]) => { const d = Math.hypot(x, z); return d > R ? [x * R / d, z * R / d] : [x, z]; });
/** Part of a disc of radius R with z ≥ zMin (front) or z ≤ zMin (back = true). */
function discPart(R: number, zMin: number, back = false, n = 24): [number, number][] {
  const a0 = Math.asin(Math.max(-1, Math.min(1, zMin / R))), out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = back ? Math.PI - a0 + (i / n) * (Math.PI + 2 * a0) : a0 + (i / n) * (Math.PI - 2 * a0);
    out.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  return out;
}
function water(p: THREE.Object3D, plan: [number, number][], y: number, c = P.water, h = 0.004): THREE.Mesh {
  const m = prism(p, plan, y, h, c);
  m.material = mat(c, { rough: 0.18, metal: 0.15 });
  return m;
}

/** Box subdivided into cells and painted per face (bricks, mats, glazing). Paint gets geometry-local coords. */
function pbox(p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, seg: V3, c: string, paint: Paint, ry = 0, o: { rough?: number; metal?: number } = {}): THREE.Mesh {
  const geo = paintFaces(new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]), c, paint);
  return add(p, geo, mat('#ffffff', { vc: true, ...o }), x, y + h / 2, z, 1, 1, 1, ry);
}
const brickPaint = (c: string, row = 0.012, col = 0.026): Paint => (x, y, z) => {
  const r = Math.floor((y + 10) / row), k = Math.floor((x + z + 10 + (r % 2) * col * 0.5) / col);
  return shade(c, 0.86 + hash3(r, k, 3) * 0.24);
};

/** Lathe with per-face paint (local coords), e.g. banded chimneys or rocket stages. */
function plathe(p: THREE.Object3D, pts: [number, number][], c: string, paint: Paint, x: number, y: number, z: number, seg = 16, o: { rough?: number; metal?: number } = {}): THREE.Mesh {
  const lg = new THREE.LatheGeometry(pts.map(([r, py]) => new THREE.Vector2(r, py)), seg);
  lg.computeVertexNormals();
  return add(p, paintFaces(lg, c, paint), mat('#ffffff', { vc: true, ...o }), x, y, z, 1, 1, 1);
}

interface LumpOpts { seed?: number; rough?: number; detail?: number; carve?: (d: THREE.Vector3) => number; paint?: Paint; freq?: number }
/** Craggy rock/hill: noise-displaced icosphere (flat bottom), vertex-painted. Paint gets unit-space coords. */
function lump(p: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string, o: LumpOpts = {}): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, o.detail ?? 3);
  const pos = geo.getAttribute('position'), v = new THREE.Vector3(), seed = o.seed ?? 0, rough = o.rough ?? 0.22, f = o.freq ?? 2.4;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1 + rough * (fbm(v.x * f + seed * 7.1, v.y * f + seed, v.z * f, 4) - 0.5) * 2.2;
    if (o.carve) r *= o.carve(v);
    pos.setXYZ(i, v.x * r, Math.max(0, v.y * r), v.z * r);
  }
  geo.computeVertexNormals();
  return add(p, paintFaces(geo, c, o.paint), mat('#ffffff', { vc: true, flat: true }), x, y, z, sx, sy, sz);
}
const rockPaint = (rock: string, green: string, seed = 0): Paint => (x, y, z, _nx, ny) => {
  const n = fbm(x * 4 + seed, y * 4, z * 4, 3);
  if (ny > 0.5 && n > 0.42) return shade(green, 0.85 + n * 0.4);
  return shade(rock, 0.78 + 0.3 * n + 0.08 * Math.sin(y * 30 + n * 6));
};

/** Diorama person with sensible defaults. */
const person = (p: THREE.Object3D, x: number, y: number, z: number, o: Partial<HumanOpts> & { top: string; h: number }) =>
  human(p, x, y, z, { hair: '#1c1714', bottom: '#3a3128', detail: o.h > 0.09 ? 'lo' : 'min', ...o });

// ==== prehistory ================================================================================================
const cave: Builder = gp => {
  // Zhoukoudian (周口店) Dragon Bone Hill: a limestone crag with a deep cave mouth, a hearth, Peking Man and bones
  const h0 = ground(gp, 0.46, '#8f7d5a', '#6a5a40');
  const mouth = (d: THREE.Vector3) => {
    const u = Math.atan2(d.x, d.z), v = Math.asin(Math.max(-1, Math.min(1, d.y)));
    return (u / 0.5) ** 2 + (v / 0.62) ** 2;
  };
  lump(gp, 0, h0, -0.13, 0.43, 0.46, 0.3, '#a39d90', {
    seed: 3, rough: 0.2, detail: 4,
    carve: d => { const e = mouth(d); return e < 1 ? 1 - 0.62 * Math.sqrt(1 - e) : 1; },
    paint: (x, y, z, nx, ny, nz) => {
      const d = new THREE.Vector3(x, y, z).normalize();
      const e = mouth(d);
      if (e < 0.95 && z > 0) return mix('#1a1410', '#4a3e32', Math.min(1, e * e));
      return rockPaint('#a8a194', '#6f7d44', 3)(x, y, z, nx, ny, nz);
    },
  });
  // fallen boulders and scree
  for (const [x, z, s, k] of [[-0.34, 0.14, 0.09, 1], [0.33, 0.12, 0.07, 2], [0.38, -0.12, 0.1, 3], [-0.26, 0.28, 0.04, 4], [0.24, 0.3, 0.035, 5]] as const) {
    lump(gp, x, h0, z, s, s * 0.75, s * 0.85, '#9a9384', { seed: k, detail: 1, rough: 0.3, paint: rockPaint('#9d968a', '#6f7d44', k) });
  }
  for (const [x, z, s] of [[-0.12, -0.3, 0.07], [0.15, -0.28, 0.06], [0.28, -0.05, 0.05]] as const) ellip(gp, '#4f6a32', x, h0 + 0.36 - Math.abs(x) * 0.6, z, s, s * 0.6, s);
  minipine(gp, -0.2, h0 + 0.32, -0.2, 0.14, '#3f5f30');
  minipine(gp, 0.06, h0 + 0.4, -0.25, 0.12, '#3f5f30');
  // hearth: ring of stones, crossed branches, fire and smoke
  const fx = 0.04, fz = 0.25;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ellip(gp, '#6d6558', fx + Math.cos(a) * 0.045, h0 + 0.008, fz + Math.sin(a) * 0.035, 0.014, 0.01, 0.012, a); }
  ellip(gp, '#2a2420', fx, h0 + 0.002, fz, 0.04, 0.004, 0.03);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI + 0.3; rod(gp, [fx + Math.cos(a) * 0.04, h0 + 0.004, fz + Math.sin(a) * 0.03], [fx - Math.cos(a) * 0.01, h0 + 0.03, fz - Math.sin(a) * 0.008], 0.004, '#3b2a1c', 4); }
  flame(gp, fx, h0 + 0.004, fz, 0.07);
  smoke(gp, fx, h0 + 0.08, fz - 0.01, 0.03, '#6b645c', 5, 0.5);
  // Peking Man: hide wraps, barefoot, heavy build
  const hom = { skin: '#a8754e', hair: '#2a1d14', top: '#6b4a2e', bottom: '#6b4a2e', shoes: '#8a5a3a', sleeve: 0, shorts: true, build: 1.15 };
  person(gp, 0.13, h0, 0.27, { ...hom, h: 0.13, pose: 'crouch', ry: -1.9 });
  const st = person(gp, -0.17, h0, 0.22, { ...hom, h: 0.15, pose: 'relax', ry: 0.5 });
  rod(gp, [st.handR[0], h0 + 0.005, st.handR[2] + 0.01], [st.handR[0] + 0.01, st.handR[1] + 0.12, st.handR[2]], 0.0035, '#6b4a2a', 4);
  cone(gp, '#5a5048', st.handR[0] + 0.01, st.handR[1] + 0.115, st.handR[2], 0.005, 0.02, 4);
  person(gp, -0.04, h0, 0.36, { ...hom, top: '#7a5634', h: 0.11, pose: 'sitGround', ry: 2.6 });
  // bones, antler, stone tools
  const bone = (x: number, z: number, L: number, a: number) => {
    const dx = Math.cos(a) * L / 2, dz = Math.sin(a) * L / 2;
    rod(gp, [x - dx, h0 + 0.006, z - dz], [x + dx, h0 + 0.006, z + dz], 0.004, P.bone, 5);
    for (const s of [-1, 1]) ellip(gp, P.bone, x + s * dx, h0 + 0.007, z + s * dz, 0.007, 0.006, 0.007);
  };
  bone(0.2, 0.22, 0.06, 0.4); bone(0.24, 0.27, 0.05, 2.1); bone(-0.08, 0.2, 0.045, 1.2); bone(0.16, 0.36, 0.05, -0.5);
  ellip(gp, P.bone, 0.27, h0 + 0.012, 0.2, 0.016, 0.012, 0.02, 0.4);
  tube(gp, [[0.3, h0 + 0.004, 0.32], [0.33, h0 + 0.02, 0.3], [0.37, h0 + 0.035, 0.28]], 0.004, 0.002, '#cbb994', { radial: 5, sub: 3 });
  tube(gp, [[0.33, h0 + 0.02, 0.3], [0.33, h0 + 0.04, 0.32]], 0.003, 0.002, '#cbb994', { radial: 5, sub: 2 });
  for (let i = 0; i < 4; i++) ellip(gp, '#4a4540', -0.1 + i * 0.03, h0 + 0.004, 0.3 + (i % 2) * 0.02, 0.01, 0.004, 0.007, i);
};

const stilt: Builder = gp => {
  // Hemudu (河姆渡) 干栏式 long house on piles over the marsh, mortise-and-tenon frame, thatched gable roof
  const h0 = ground(gp, 0.46, '#6f7546', '#5a4a34');
  water(gp, discPart(0.44, 0.06), h0, '#4f7a78');
  // reeds along the water edge
  for (let i = 0; i < 14; i++) {
    const x = -0.4 + hash3(i, 2, 7) * 0.12 + (i > 6 ? 0.7 : 0), z = 0.08 + hash3(i, 5, 1) * 0.12;
    cone(gp, i % 3 ? '#8a9a4a' : '#a8a05a', x, h0, z, 0.006, 0.06 + hash3(i, 1, 1) * 0.04, 4);
  }
  // rice paddy (wet field with tufts) at the front left
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = -0.3 + i * 0.04, z = 0.2 + j * 0.04;
    cone(gp, '#7ea33e', x, h0 + 0.004, z, 0.008, 0.035, 5);
    ellip(gp, '#d9b44a', x + 0.003, h0 + 0.036, z, 0.004, 0.008, 0.004, 0, 0, 0.5);
  }
  const L = 0.6, zc = -0.08, D = 0.28, Fy = h0 + 0.15;
  const H = grp(gp, 0.02, zc, -0.3);
  // piles, beams with protruding tenons, joists and plank floor
  for (let i = 0; i < 10; i++) for (const z of [-0.13, 0, 0.13]) {
    const x = -L / 2 + 0.02 + i * ((L - 0.04) / 9);
    cyl(H, shade(P.darkwood, 0.9 + hash3(i, z, 2) * 0.25), x, h0 - 0.01, z, 0.0075, Fy - h0 - 0.004, 6);
  }
  for (let i = 0; i < 10; i++) {
    const x = -L / 2 + 0.02 + i * ((L - 0.04) / 9);
    box(H, '#5e4128', x, Fy - 0.016, 0, 0.012, 0.012, D + 0.02);
    for (const s of [-1, 1]) box(H, '#6e4f30', x, Fy - 0.014, s * (D / 2 + 0.016), 0.007, 0.008, 0.012);
  }
  for (const z of [-0.13, 0, 0.13]) box(H, '#5a3e26', 0, Fy - 0.006, z, L + 0.02, 0.008, 0.01);
  for (let k = 0; k < 15; k++) box(H, k % 2 ? '#8a6a44' : '#7c5d3a', 0, Fy, -D / 2 + (k + 0.5) * (D / 15), L, 0.006, D / 15 - 0.001);
  // walls: plank back/sides, front wall with doors
  const wy = Fy + 0.006, wh = 0.1, wz0 = -D / 2 + 0.01, wz1 = 0.04;
  pbox(H, 0, wy, wz0, L - 0.04, wh, 0.01, [26, 1, 1], '#8a6640', (x) => shade('#8a6640', 0.85 + hash3(Math.floor(x * 40), 1, 1) * 0.3));
  for (const s of [-1, 1]) box(H, '#7d5c3a', s * (L / 2 - 0.025), wy, (wz0 + wz1) / 2, 0.01, wh, wz1 - wz0);
  const door = (cx: number) => { const pth = new THREE.Path(); pth.moveTo(cx - 0.025, 0); pth.lineTo(cx + 0.025, 0); pth.lineTo(cx + 0.025, 0.075); pth.lineTo(cx - 0.025, 0.075); pth.closePath(); return pth; };
  panel(H, L - 0.04, wh, 0.01, '#8f6b43', [door(-0.14), door(0.12)], 0, wy, wz1);
  for (const cx of [-0.14, 0.12]) box(H, '#1e1610', cx, wy, wz1 - 0.008, 0.05, 0.075, 0.004);
  for (let i = 0; i < 9; i++) box(H, '#5a3e26', -L / 2 + 0.03 + i * ((L - 0.06) / 8), wy, wz1 + 0.006, 0.01, wh, 0.01);
  box(H, '#5a3e26', 0, wy + wh - 0.01, wz1 + 0.006, L - 0.04, 0.01, 0.012);
  // veranda railing (gap for the ladder)
  for (let i = 0; i < 12; i++) { const x = -L / 2 + 0.02 + i * ((L - 0.04) / 11); if (Math.abs(x - 0.2) > 0.03) box(H, '#5e4128', x, Fy, D / 2 - 0.006, 0.006, 0.045, 0.006); }
  for (const [a, b] of [[-L / 2 + 0.02, 0.17], [0.23, L / 2 - 0.02]]) box(H, '#6e4f30', (a + b) / 2, Fy + 0.04, D / 2 - 0.006, b - a, 0.006, 0.008);
  // steep thatched gable roof: two thick thatch slabs with straw streaks, thatch-filled gable ends, ridge roll and
  // crossed barge poles
  const Ry = wy + wh, RW = L + 0.06, RD = D + 0.08, RH = 0.2, zr = -0.01;
  gable(H, RW - 0.03, RH - 0.01, RD - 0.06, shade(P.thatch, 0.78), 0, Ry, zr);
  const sl = Math.atan2(RH, RD / 2), sLen = Math.hypot(RH, RD / 2) + 0.03;
  const straw: Paint = (x, _y, z, _nx, ny) => ny < -0.5 ? shade(P.thatch, 0.55)
    : shade(P.thatch, (0.82 + hash3(Math.floor(x * 140), 1, 2) * 0.22) * (Math.abs(z) > sLen * 0.42 ? 0.86 : 1) * (Math.floor((z + 1) * 22) % 3 === 0 ? 0.92 : 1));
  for (const s of [-1, 1]) {
    const geo = paintFaces(new THREE.BoxGeometry(RW, 0.022, sLen, 48, 1, 8), P.thatch, straw);
    add(H, geo, mat('#ffffff', { vc: true }), 0, Ry + RH / 2 - 0.006, zr + s * (RD / 4 + 0.006), 1, 1, 1, 0, s * sl);
  }
  const ridge = cyl(H, '#8f7a48', 0, 0, zr, 0.016, RW + 0.01, 8);
  ridge.rotation.z = Math.PI / 2; ridge.position.set(0, Ry + RH + 0.004, zr);
  for (let k = 0; k < 7; k++) { const b2 = cyl(H, '#5e4a2c', 0, 0, zr, 0.018, 0.006, 8); b2.rotation.z = Math.PI / 2; b2.position.set(-RW / 2 + 0.04 + k * ((RW - 0.08) / 6), Ry + RH + 0.004, zr); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) rod(H, [s * (RW / 2 - 0.01), Ry + RH - 0.04, zr - t * 0.04], [s * (RW / 2 - 0.01), Ry + RH + 0.06, zr + t * 0.06], 0.004, '#4a3222', 4);
  // sheaves of rice hanging under the eaves
  for (let i = 0; i < 4; i++) cone(H, '#d4b04a', -0.27 + i * 0.03, Fy + 0.02, D / 2 + 0.03, 0.008, 0.04, 5).rotation.x = Math.PI;
  // ladder from the marsh to the veranda
  const lx = 0.2, lz0 = D / 2 + 0.1;
  for (const s of [-1, 1]) rod(H, [lx + s * 0.018, h0, lz0], [lx + s * 0.018, Fy + 0.02, D / 2], 0.004, '#5e4128', 4);
  for (let k = 1; k < 6; k++) { const t = k / 6; box(H, '#6e4f30', lx, h0 + (Fy - h0) * t, lz0 + (D / 2 - lz0) * t, 0.036, 0.005, 0.006); }
  // people: woman on the veranda, man at the mortar husking rice, fisher in a dugout
  person(H, -0.06, Fy, 0.1, { h: 0.1, pose: 'relax', top: '#9a8456', bottom: '#7a6a44', dress: 'ankle', sleeve: 0.4 });
  const mx = -0.05, mz = 0.2;
  lathe(H, [[0, 0], [0.018, 0], [0.02, 0.03], [0.012, 0.03], [0, 0.02]], '#6b4a2a', mx, h0 - 0.003, mz, 10);
  const m = person(H, mx + 0.04, h0, mz, { h: 0.11, pose: 'reach', top: '#8a6a42', bottom: '#6b5434', sleeve: 0.4, ry: -Math.PI / 2 });
  rod(H, [mx, h0 + 0.03, mz], [m.handR[0] - 0.004, m.handR[1] + 0.03, m.handR[2]], 0.004, '#8a6a42', 4);
  lathe(H, [[0, 0], [0.02, 0.003], [0.026, 0.02], [0.016, 0.034], [0.018, 0.038]], '#2a2622', -0.12, Fy, 0.05, 10);
  const canoe = grp(gp, 0.05, 0.33, 0.25, h0 + 0.004);
  sweep(canoe, [{ p: [-0.16, 0.014, 0], w: 0.004, h: 0.006 }, { p: [-0.12, 0.01, 0], w: 0.022, h: 0.012 }, { p: [0.1, 0.01, 0], w: 0.024, h: 0.012 }, { p: [0.16, 0.014, 0], w: 0.004, h: 0.006 }], '#5a3a22', { radial: 10, squash: 0.6 });
  ellip(canoe, '#2e1f14', 0, 0.02, 0, 0.12, 0.003, 0.016);
  const f = person(canoe, -0.02, 0.01, 0, { h: 0.09, pose: 'kneel', top: '#7a6a44', bottom: '#5a4a34', sleeve: 0.4, ry: Math.PI / 2 });
  rod(canoe, [f.handR[0], f.handR[1], f.handR[2]], [f.handR[0] + 0.04, -0.01, f.handR[2] + 0.04], 0.003, '#6e4f30', 4);
  for (const [x, z] of [[-0.36, -0.22], [0.36, -0.24]]) { const tr = grp(gp, x, z, 0, h0); cyl(tr, '#5b4030', 0, 0, 0, 0.012, 0.16, 6); ellip(tr, '#4d7a3a', 0, 0.2, 0, 0.08, 0.07, 0.08); ellip(tr, '#5a8a44', 0.03, 0.25, 0.02, 0.05); }
};

/** Translucent-looking jade: milky green with cloudy whitish and deeper-green patches and rare brown calcification. */
const jadePaint = (base: string, seed = 0): Paint => (x, y, z) => {
  const n = fbm(x * 18 + seed, y * 18, z * 18, 3), m = fbm(x * 6 - seed, y * 6, z * 6, 2);
  if (m > 0.68) return mix(base, '#a8875a', (m - 0.68) * 2.5);
  return n > 0.55 ? mix(base, '#dfe9d2', (n - 0.55) * 2.2) : mix(base, shade(base, 0.7), (0.55 - n) * 1.6);
};
const jadeMat = () => mat('#ffffff', { vc: true, rough: 0.22, metal: 0, flat: false });
function jadeGeo(p: THREE.Object3D, geo: THREE.BufferGeometry, base: string, x: number, y: number, z: number, seed = 0): THREE.Mesh {
  geo.computeVertexNormals();
  return add(p, paintFaces(geo, base, jadePaint(base, seed)), jadeMat(), x, y, z, 1, 1, 1);
}

const jade: Builder = (gp, r) => {
  // Liangzhu (良渚) ritual jades: a tiered cong with masked faces, a bi disc on a lacquer stand and a yue axe
  const J = str(r.color, '#7fa98a');
  const h0 = ground(gp, 0.46, '#3e2c22', '#2a1d16');
  // red-and-black lacquer display table
  rbox(gp, P.lacquer, 0, h0, -0.04, 0.78, 0.035, 0.44, 0.008);
  rbox(gp, '#1e1612', 0, h0 + 0.035, -0.04, 0.8, 0.008, 0.46, 0.003);
  for (const s of [-1, 1]) box(gp, '#b8862e', s * 0.37, h0 + 0.012, 0.18, 0.04, 0.006, 0.002);
  const T = h0 + 0.043;
  // ---- cong 琮: 4 tapering tiers, corner masks (eyes, nose bar, feather-crown bands), round collars and bore
  const C = grp(gp, -0.1, -0.02, Math.PI / 4, T);
  const n = 4, th = 0.074, gap = 0.006;
  rbox(C, '#2a1a12', 0, 0, 0, 0.17, 0.012, 0.17, 0.004);
  let y = 0.012;
  lathe(C, [[0.05, 0], [0.072, 0], [0.072, 0.014], [0.05, 0.014]], shade(J, 0.9), 0, y, 0, 24);
  y += 0.012;
  for (let i = 0; i < n; i++) {
    const W = 0.17 + i * 0.008, w2 = W / 2;
    jadeGeo(C, new THREE.BoxGeometry(W, th, W, 6, 4, 6), J, 0, y + th / 2, 0, i * 3.1);
    if (i < n - 1) box(C, shade(J, 0.62), 0, y + th, 0, W - 0.012, gap, W - 0.012);
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2, cx = Math.sin(a), cz = Math.cos(a);
      // vertical groove in the middle of each face
      box(C, shade(J, 0.68), cx * (w2 + 0.0005), y, cz * (w2 + 0.0005), cz !== 0 ? 0.012 : 0.003, th, cz !== 0 ? 0.003 : 0.012);
    }
    for (let c = 0; c < 4; c++) {
      const sx = c & 1 ? 1 : -1, sz = c & 2 ? 1 : -1, ca = Math.atan2(sx, sz);
      // two crown bands straddling the corner edge
      for (const dy of [th - 0.012, th - 0.02]) box(C, shade(J, 1.18), sx * w2, y + dy, sz * w2, 0.064, 0.003, 0.006, ca);
      // nose bar
      box(C, shade(J, 1.1), sx * w2, y + th * 0.18, sz * w2, 0.034, 0.008, 0.008, ca);
      // eyes: ringed circles on both faces next to the corner
      for (const [ex, ez, ny] of [[sx * (w2 - 0.024), sz * (w2 + 0.0015), 0], [sx * (w2 + 0.0015), sz * (w2 - 0.024), 1]] as const) {
        const e = ellip(C, shade(J, 1.2), ex, y + th * 0.45, ez, 0.011, 0.011, 0.003);
        if (ny) e.rotation.y = Math.PI / 2;
        const d = ellip(C, '#3d5a48', ex + (ny ? sx * 0.002 : 0), y + th * 0.45, ez + (ny ? 0 : sz * 0.002), 0.005, 0.005, 0.002);
        if (ny) d.rotation.y = Math.PI / 2;
      }
    }
    y += th + gap;
  }
  lathe(C, [[0.05, 0], [0.074, 0], [0.074, 0.018], [0.05, 0.018]], shade(J, 1.05), 0, y - gap, 0, 24);
  cyl(C, '#1a2a22', 0, y - gap + 0.012, 0, 0.049, 0.008, 20);
  // ---- bi 璧 disc standing in a lacquer bracket
  const B = grp(gp, 0.2, -0.14, -0.25, T);
  rbox(B, '#1e1612', 0, 0, 0, 0.2, 0.02, 0.07, 0.006);
  for (const s of [-1, 1]) { rbox(B, P.lacquer, s * 0.06, 0.02, 0, 0.018, 0.07, 0.04, 0.004); box(B, '#b8862e', s * 0.06, 0.07, 0.021, 0.012, 0.004, 0.002); }
  const prof: [number, number][] = [];
  for (let i = 0; i <= 8; i++) prof.push([0.032 + (i / 8) * 0.125, -0.009]);
  prof.push([0.16, 0], [0.157, 0.009]);
  for (let i = 8; i >= 0; i--) prof.push([0.032 + (i / 8) * 0.125, 0.009]);
  prof.push([0.03, 0], [0.032, -0.009]);
  const bi = jadeGeo(B, new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 48), shade(J, 0.92), 0, 0.175, 0, 7);
  bi.rotation.x = Math.PI / 2;
  // ---- yue 钺 axe: jade blade with drilled hole hafted on a lacquered handle with jade cap and end piece
  const Y0 = grp(gp, 0.04, 0.04, -Math.PI / 2 - 0.12, T + 0.008), Y = new THREE.Group();
  Y.rotation.x = -Math.PI / 2; Y0.add(Y);
  rod(Y, [0, 0.014, 0], [0, 0.33, 0], 0.007, P.lacquer, 8);
  for (let k = 0; k < 6; k++) cyl(Y, '#c99a3a', 0, 0.05 + k * 0.045, 0, 0.0075, 0.004, 8);
  lathe(Y, [[0, 0], [0.012, 0], [0.014, 0.02], [0.006, 0.03], [0, 0.032]], shade(J, 1.05), 0, 0.33, 0, 10);
  lathe(Y, [[0, 0], [0.011, 0], [0.012, 0.02], [0, 0.022]], shade(J, 1.05), 0, 0.014, 0, 10);
  const sh = new THREE.Shape([[0.0, -0.045], [0.12, -0.065], [0.13, 0], [0.12, 0.065], [0, 0.045]].map(([a, b]) => new THREE.Vector2(a, b)));
  const hole = new THREE.Path(); hole.absarc(0.04, 0, 0.012, 0, Math.PI * 2, true); sh.holes.push(hole);
  const yg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 });
  yg.translate(0, 0, -0.003);
  add(Y, yg, mat(shade(J, 0.85), { rough: 0.22, metal: 0 }), 0.004, 0.26, 0, 1, 1, 1);
  // ---- string of jade tubes and beads, and a small three-pronged ornament
  for (let i = 0; i < 15; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 14)), x = Math.cos(a) * 0.13 - 0.2, z = 0.13 + Math.sin(a) * 0.06;
    if (i % 3 === 1) { const t = cyl(gp, shade(J, 1.05), x, T + 0.006, z, 0.007, 0.018, 8); t.rotation.set(Math.PI / 2, 0, 0); t.rotation.z = a; t.position.y = T + 0.007; }
    else ellip(gp, shade(J, 0.95 + hash3(i, 1, 1) * 0.2), x, T + 0.007, z, 0.007);
  }
  const tp = new THREE.Shape([[-0.04, 0], [0.04, 0], [0.04, 0.035], [0.026, 0.035], [0.026, 0.012], [0.007, 0.012], [0.007, 0.045], [-0.007, 0.045], [-0.007, 0.012], [-0.026, 0.012], [-0.026, 0.035], [-0.04, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)));
  const tg = new THREE.ExtrudeGeometry(tp, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 });
  const t3 = add(gp, tg, mat(shade(J, 1.1), { rough: 0.22, metal: 0 }), -0.3, T + 0.004, -0.2, 1, 1, 1, 0.3, -Math.PI / 2);
  t3.rotation.order = 'YXZ';
};

const oracle: Builder = gp => {
  // Shang divination (甲骨占卜) at Yinxu: a diviner (贞人) applies a hot rod to a turtle plastron; an ox scapula,
  // a bronze fangding and a brazier
  const h0 = ground(gp, 0.46, '#7a6648', '#56462f');
  const mat0 = h0 + 0.004;
  pbox(gp, 0.02, h0, 0.02, 0.7, 0.004, 0.52, [20, 1, 16], '#b89a62', (x, _y, z) => shade('#b89a62', ((Math.floor((x + 1) * 28) + Math.floor((z + 1) * 28)) % 2 ? 0.9 : 1.05)));
  const glyph = (p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number, c: string, flat = true) => {
    for (let k = 0; k < 3; k++) {
      const hx = hash3(seed, k, 1) - 0.5, hz = hash3(seed, k, 2) - 0.5, horiz = hash3(seed, k, 3) > 0.5;
      if (flat) box(p, c, x + hx * s, y, z + hz * s, horiz ? s : s * 0.18, 0.0015, horiz ? s * 0.18 : s, hash3(seed, k, 4) * 0.6);
      else box(p, c, x + hx * s, y + hz * s, z, horiz ? s : s * 0.18, horiz ? s * 0.18 : s, 0.0015, 0, 0, hash3(seed, k, 4) * 0.6);
    }
  };
  // ---- turtle plastron 龟腹甲 lying on the mat
  const PL = grp(gp, 0.06, 0.06, 0.12, mat0);
  const out: [number, number][] = [[0, 0.19], [0.04, 0.2], [0.09, 0.19], [0.12, 0.13], [0.13, 0.06], [0.145, 0.03], [0.145, -0.05], [0.13, -0.08], [0.115, -0.15], [0.08, -0.2], [0.035, -0.21], [0, -0.185]];
  const full: [number, number][] = [...out, ...out.slice(1, -1).reverse().map(([a, b]) => [-a, b] as [number, number])];
  const pl = slab(PL, full, 0.01, '#e2d3ae', 0.006);
  pl.rotation.x = -Math.PI / 2; pl.position.y = 0.011;
  const top = 0.023;
  box(PL, '#8a6a42', 0, top, 0, 0.003, 0.0015, 0.38);
  for (const z of [-0.13, -0.06, 0.03, 0.11]) box(PL, '#a08458', 0, top, z, 0.26 - Math.abs(z) * 0.4, 0.0015, 0.003, 0, 0, 0);
  for (const s of [-1, 1]) for (let row = 0; row < 4; row++) for (let k = 0; k < 2; k++) {
    const x = s * (0.03 + k * 0.045), z = -0.15 + row * 0.085;
    ellip(PL, '#4a2e18', x, top, z, 0.008, 0.002, 0.012);
    box(PL, '#2a1a0e', x + s * 0.004, top, z - 0.022, 0.002, 0.0015, 0.03);
    box(PL, '#2a1a0e', x + s * 0.012, top, z - 0.01, 0.018, 0.0015, 0.002, s * 0.4);
    if ((row + k) % 2 === 0) glyph(PL, x + s * 0.022, top, z + 0.025, 0.012, row * 7 + k + (s > 0 ? 40 : 0), (row + k) % 4 ? '#3a2a1a' : '#a3301e');
  }
  // ---- ox scapula 牛肩胛骨 leaning on a wooden rack
  const SC = grp(gp, 0.28, -0.2, -0.45, mat0);
  box(SC, P.darkwood, 0, 0, -0.05, 0.16, 0.012, 0.02);
  for (const s of [-1, 1]) rod(SC, [s * 0.07, 0, -0.05], [s * 0.07, 0.24, -0.09], 0.006, P.darkwood, 5);
  rod(SC, [-0.08, 0.22, -0.085], [0.08, 0.22, -0.085], 0.005, P.darkwood, 5);
  const S2 = grp(SC, 0, 0.02, 0, 0.0); S2.rotation.x = -0.3;
  const sp = slab(S2, [[-0.028, 0.3], [0.028, 0.3], [0.034, 0.24], [0.07, 0.12], [0.1, 0.02], [0.085, -0.01], [-0.06, -0.012], [-0.075, 0.02], [-0.05, 0.12], [-0.034, 0.24]], 0.008, '#e6d8b4', 0.004);
  sp.position.y = 0.015;
  ellip(S2, '#d8c8a0', 0, 0.325, 0, 0.034, 0.022, 0.018);
  for (let row = 0; row < 4; row++) for (let k = 0; k < 2; k++) {
    const x = -0.035 + k * 0.05 + row * 0.006, yy = 0.05 + row * 0.055;
    ellip(S2, '#4a2e18', x, yy, 0.0085, 0.006, 0.01, 0.002);
    box(S2, '#2a1a0e', x + 0.012, yy + 0.002, 0.0085, 0.02, 0.0018, 0.0015, 0, 0, 0.25);
    glyph(S2, x + 0.02, yy - 0.018, 0.009, 0.011, row * 5 + k + 90, row % 2 ? '#3a2a1a' : '#a3301e', false);
  }
  // ---- brazier with glowing charcoal and the hot rod
  const bx = -0.13, bz = 0.25;
  lathe(gp, [[0, 0], [0.045, 0.004], [0.06, 0.03], [0.064, 0.04], [0.058, 0.04], [0, 0.03]], P.patina, bx, mat0, bz, 16);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; cyl(gp, P.patina, bx + Math.cos(a) * 0.04, mat0 - 0.002, bz + Math.sin(a) * 0.04, 0.006, 0.01, 5); }
  for (let i = 0; i < 7; i++) { const a = i * 2.4, d = 0.03 * Math.sqrt(i / 7); ellip(gp, i % 2 ? '#2a1d18' : '#3a2620', bx + Math.cos(a) * d, mat0 + 0.036, bz + Math.sin(a) * d, 0.011, 0.007, 0.011); }
  ellip(gp, '#ff7a1a', bx, mat0 + 0.039, bz, 0.03, 0.004, 0.03).material = mat('#ff9a3a', { emissive: '#ff5a00' });
  flame(gp, bx, mat0 + 0.036, bz, 0.04);
  // ---- the diviner kneels on the mat and touches a glowing rod to a hollow; a wisp rises where the bone cracks
  const dv = person(gp, -0.2, mat0, 0.03, {
    h: 0.19, pose: 'kneel', ry: Math.PI / 2 - 0.15, top: '#6e3b24', bottom: '#4a2e1c', dress: 'knee', hat: '#2a201a', hatStyle: 'cap',
    hands: [[-0.1, 0.33, 0.16], [0.1, 0.42, 0.3]], detail: 'lo',
  });
  for (const [ox, oz] of [[0.0, 0.0]]) {
    const tip: V3 = [0.0 + ox, mat0 + 0.026, 0.04 + oz];
    rod(gp, dv.handR, tip, 0.003, '#5a3a1e', 4);
    ellip(gp, '#ff8a2a', ...tip, 0.005).material = mat('#ffb347', { emissive: '#ff6a00' });
    smoke(gp, tip[0], tip[1] + 0.01, tip[2], 0.018, '#cfc8bc', 4, 0.45);
  }
  // the Shang king, standing behind, awaits the omen
  person(gp, -0.08, mat0, -0.2, { h: 0.21, pose: 'stand', top: '#b8862e', bottom: '#6e3b24', dress: 'ankle', hat: '#1c1714', hatStyle: 'cap', ry: 0.3 });
  // ---- bronze fangding 方鼎 with flanges, taotie relief and loop handles
  const D = grp(gp, 0.3, 0.24, -0.4, mat0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(D, P.patina, x * 0.032, 0, z * 0.024, 0.007, 0.04, 8);
  rbox(D, P.patina, 0, 0.038, 0, 0.09, 0.06, 0.07, 0.004);
  rbox(D, shade(P.patina, 0.8), 0, 0.094, 0, 0.096, 0.006, 0.076, 0.002);
  for (const sz of [-1, 1]) {
    box(D, '#3f7060', 0, 0.05, sz * 0.036, 0.05, 0.025, 0.004);
    for (const sx of [-1, 1]) ellip(D, '#a08a4a', sx * 0.012, 0.064, sz * 0.0385, 0.005, 0.005, 0.002);
    for (const sx of [-1, 1]) { box(D, P.patina, sx * 0.046, 0.04, sz * 0.036, 0.004, 0.055, 0.006); }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) rod(D, [sx * 0.03, 0.1, sz * 0.006], [sx * 0.03, 0.125, sz * 0.006], 0.0035, P.patina, 5);
    rod(D, [sx * 0.03, 0.125, -0.006], [sx * 0.03, 0.125, 0.006], 0.0035, P.patina, 5);
  }
  // spare bones in a basket and a bronze carving knife
  lathe(gp, [[0, 0], [0.05, 0.004], [0.06, 0.04], [0.055, 0.045], [0, 0.03]], '#8a6a3a', -0.32, mat0, -0.16, 14);
  for (let i = 0; i < 3; i++) ellip(gp, '#e2d3ae', -0.32 + (i - 1) * 0.022, mat0 + 0.045, -0.16 + (i % 2) * 0.01, 0.02, 0.008, 0.028, i);
  box(gp, '#9a7a3a', 0.15, mat0, 0.3, 0.07, 0.003, 0.008, 0.5);
  box(gp, P.darkwood, 0.115, mat0, 0.32, 0.03, 0.005, 0.009, 0.5);
};

const weir: Builder = gp => {
  // Dujiangyan (都江堰): the Fish Mouth splits the Min into the outer and inner rivers; bamboo gabions, the Feishayan
  // spillway, the Baopingkou cut between Yulei hill and the Lidui rock, the Anlan rope bridge and Erwang temple
  const h0 = ground(gp, 0.46, '#6f8a4a', '#5a4a34');
  const wy = h0 + 0.001, RIV = '#5f9aa2';
  water(gp, clipR([[-0.38, -0.3], [-0.2, -0.44], [0.2, -0.44], [0.215, -0.1], [0.205, 0.16], [0.19, 0.3], [0.19, 0.46], [0.11, 0.46], [0.115, 0.3],
    [0.02, 0.36], [-0.05, 0.42], [-0.2, 0.42], [-0.35, 0.26], [-0.4, 0]], 0.445), wy, RIV);
  const top = wy + 0.004;
  // flow streaks and foam
  for (let i = 0; i < 22; i++) {
    const x = -0.32 + hash3(i, 1, 3) * 0.5, z = -0.38 + hash3(i, 2, 3) * 0.78;
    if (x > -0.01 && x < 0.09 && z > -0.24 && z < 0.22) continue;
    if (z > 0.24 && x > -0.06 && x < 0.11) continue;
    ellip(gp, '#9fcbd1', x, top, z, 0.003, 0.0012, 0.012 + hash3(i, 3, 3) * 0.016, (hash3(i, 4, 4) - 0.5) * 0.3);
  }
  // ---- levee island (金刚堤) with the Fish Mouth tip, split by the Feishayan spillway
  const lev = (plan: [number, number][], h: number) => prism(gp, plan, top - 0.002, h, '#9a8a68');
  lev([[0.035, -0.25], [0.07, -0.14], [0.075, -0.02], [0.075, 0.05], [0.0, 0.05], [0.0, -0.02], [0.0, -0.14]], 0.024);
  lev([[0.075, 0.13], [0.075, 0.21], [0.0, 0.21], [0.0, 0.13]], 0.024);
  prism(gp, [[0.0, -0.13], [0.07, -0.13], [0.072, 0.04], [0.003, 0.04]], top + 0.022, 0.003, '#6f8a4a');
  prism(gp, [[0.005, 0.135], [0.07, 0.135], [0.07, 0.205], [0.005, 0.205]], top + 0.022, 0.003, '#6f8a4a');
  box(gp, '#8a7d62', 0.037, top - 0.002, 0.09, 0.075, 0.008, 0.08);
  for (let k = 0; k < 7; k++) ellip(gp, '#eef6f7', -0.006 - (k % 2) * 0.012, top + 0.003, 0.058 + k * 0.011, 0.016, 0.004, 0.006, 0.2);
  for (let k = 0; k < 4; k++) ellip(gp, '#eef6f7', 0.035 + (k - 1.5) * 0.012, top + 0.002, -0.262 - (k % 2) * 0.01, 0.01, 0.003, 0.02, (k - 1.5) * 0.4);
  // bamboo gabions 竹笼 (woven cylinders packed with river stones) lining both banks of the levee
  const gab = (x: number, z: number) => {
    const c = cyl(gp, '#c7a660', x, 0, z, 0.0105, 0.05, 8);
    c.rotation.x = Math.PI / 2; c.position.y = top + 0.008;
    for (const dz of [-0.016, 0, 0.016]) { const b = cyl(gp, '#8f733c', x, 0, z + dz, 0.0115, 0.004, 8); b.rotation.x = Math.PI / 2; b.position.y = top + 0.008; }
    ellip(gp, '#8a8680', x, top + 0.017, z, 0.006, 0.004, 0.012);
  };
  for (let k = 0; k < 6; k++) { const z = -0.12 + k * 0.032 + (k > 4 ? 0 : 0); if (z < 0.05) { gab(-0.008, z); gab(0.083, z); } }
  for (const z of [0.155, 0.19]) { gab(-0.008, z); gab(0.083, z); }
  gab(0.02, -0.19); gab(0.055, -0.19);
  // wooden macha tripods (杩槎) used to build cofferdams at the Fish Mouth
  for (const [x, z] of [[-0.02, -0.28], [0.09, -0.28]]) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    rod(gp, [x + Math.cos(a) * 0.022, top, z + Math.sin(a) * 0.022], [x, top + 0.05, z], 0.003, '#6b4a2a', 4);
  }
  // willows on the levee
  for (const z of [-0.08, 0.0, 0.17]) { cyl(gp, '#5b4030', 0.037, top + 0.024, z, 0.004, 0.03, 5); ellip(gp, '#7aa04a', 0.037, top + 0.064, z, 0.024, 0.026, 0.024); }
  // ---- mountains: Yulei hill (right), the Lidui rock with Fulong pavilion, back ranges
  const green = '#557a3a';
  lump(gp, -0.36, h0, -0.2, 0.15, 0.3, 0.2, green, { seed: 1, rough: 0.25, paint: rockPaint('#8a826e', green, 1) });
  lump(gp, 0.37, h0, -0.27, 0.12, 0.3, 0.15, green, { seed: 2, rough: 0.22, paint: rockPaint('#8a826e', green, 2) });
  lump(gp, 0.33, h0, 0.17, 0.13, 0.2, 0.17, green, { seed: 5, rough: 0.25, paint: rockPaint('#8f8672', green, 5) });
  lump(gp, 0.04, h0, 0.31, 0.075, 0.1, 0.07, '#8f8672', { seed: 8, rough: 0.2, detail: 2, paint: rockPaint('#8f8672', green, 8) });
  hall(gp, 0.04, h0 + 0.085, 0.31, 0.06, 0.04, 0.025, '#3f4248', 0, P.vermilion, { col: P.vermilion, band: '#2f7d6d', rh: 0.025, lift: 0.5 });
  // Erwang temple 二王庙 on a terrace cut into the right hillside, with steps
  const tx = 0.3, tz = -0.1;
  rbox(gp, '#a39a86', tx, h0, tz, 0.13, 0.09, 0.07, 0.004);
  rbox(gp, '#a39a86', tx + 0.02, h0, tz - 0.06, 0.12, 0.15, 0.06, 0.004);
  hall(gp, tx, h0 + 0.09, tz, 0.09, 0.045, 0.03, '#3f4248', 0, P.vermilion, { col: P.vermilion, band: '#2f7d6d', rh: 0.03, lift: 0.5 });
  hall(gp, tx + 0.02, h0 + 0.15, tz - 0.06, 0.1, 0.045, 0.034, '#3f4248', 0, P.vermilion, { col: P.vermilion, band: '#2f7d6d', rh: 0.032, lift: 0.5 });
  for (let k = 0; k < 6; k++) box(gp, '#c9c0ae', tx - 0.08, h0 + k * 0.015, tz + 0.03 - k * 0.006, 0.025, 0.015, 0.012);
  for (const [x, z] of [[-0.42, 0.05], [0.42, 0.04], [-0.3, -0.36], [0.2, 0.38]]) minipine(gp, x, h0, z, 0.08, '#3f6a32');
  // ---- Anlan rope bridge 安澜索桥 across both rivers, resting on timber frames
  const A: V3 = [-0.42, 0, -0.06], M: V3 = [0.037, 0, -0.07], Bp: V3 = [0.28, 0, -0.07];
  const dh = top + 0.075;
  const frame = (x: number, z: number, y0: number) => {
    for (const s of [-1, 1]) rod(gp, [x, y0, z + s * 0.02], [x, dh + 0.035, z + s * 0.02], 0.004, '#5a3e26', 5);
    box(gp, '#5a3e26', x, dh + 0.03, z, 0.012, 0.008, 0.055);
    gable(gp, 0.03, 0.014, 0.06, '#3f4248', x, dh + 0.038, z, Math.PI / 2);
  };
  frame(A[0], A[2], h0); frame(M[0], M[2], top + 0.024); frame(Bp[0], Bp[2], h0 + 0.09);
  const span = (a: V3, b: V3) => {
    const pts: V3[] = [], n = 8;
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t, dh - 0.03 * Math.sin(Math.PI * t), a[2] + (b[2] - a[2]) * t]); }
    sweep(gp, pts.map(pt => ({ p: pt, w: 0.016, h: 0.002 })), '#8a6a42', { radial: 4, sub: 2 });
    for (const s of [-1, 1]) tube(gp, pts.map(([x, y, z]) => [x, y + 0.028, z + s * 0.018] as V3), 0.0015, 0.0015, '#6b5434', { radial: 4, sub: 2 });
    for (let i = 1; i < n; i++) for (const s of [-1, 1]) rod(gp, pts[i], [pts[i][0], pts[i][1] + 0.028, pts[i][2] + s * 0.018], 0.001, '#6b5434', 3);
  };
  span(A, M); span(M, Bp);
  // people: gabion builders carrying stone baskets, a traveller on the bridge, Li Bing pointing at the river
  for (const [x, z, ph] of [[0.02, -0.06, 0.1], [0.05, 0.0, 0.6]] as const) {
    const w = person(gp, x, top + 0.024, z, { h: 0.06, pose: 'carry', phase: ph, top: '#5a6a4a', bottom: '#3a3128', hat: '#c8a96a', hatStyle: 'conical', ry: Math.PI });
    ellip(gp, '#b39b6a', w.head[0], w.head[1] + 0.012, w.head[2], 0.012, 0.008, 0.012);
  }
  person(gp, -0.2, dh - 0.028, -0.065, { h: 0.06, pose: 'walk', top: '#3f5f7a', ry: Math.PI / 2 });
  person(gp, 0.0, top + 0.024, 0.18, { h: 0.075, pose: 'point', top: '#2c3e50', bottom: '#2c3e50', dress: 'ankle', hat: '#1c1714', hatStyle: 'knot', ry: -0.6 });
};

// ==== modern ===================================================================================================
const CYLX = (s = 12) => g('r2:cylx' + s, () => new THREE.CylinderGeometry(0.5, 0.5, 1, s).rotateX(Math.PI / 2));
/** Rail wheel seen from the side (axis along z): steel tyre, painted centre, hub. */
function rwheel(p: THREE.Object3D, x: number, y: number, z: number, R: number, c: string): void {
  const s = Math.sign(z) || 1;
  add(p, CYLX(14), mat('#9aa0a6', { metal: 0.6, rough: 0.4 }), x, y, z, R * 2, R * 2, 0.008);
  add(p, CYLX(12), mat(c), x, y, z + s * 0.002, R * 1.7, R * 1.7, 0.008);
  add(p, CYLX(8), mat('#2a2a2a'), x, y, z + s * 0.004, R * 0.5, R * 0.5, 0.008);
}
/** Straight track along x: ballast bank, sleepers, rails. Returns rail-top height. */
function track(p: THREE.Object3D, y: number, z: number, L: number, gauge: number): number {
  tbox(p, L, gauge * 2.8, L, gauge * 1.9, 0.02, '#8b8378', 0, y, z);
  const n = Math.round(L / 0.03);
  for (let i = 0; i < n; i++) box(p, '#5a4434', -L / 2 + (i + 0.5) * (L / n), y + 0.02, z, 0.012, 0.006, gauge * 1.6);
  for (const s of [-1, 1]) box(p, '#7d838b', 0, y + 0.026, z + s * gauge / 2, L, 0.007, 0.006);
  return y + 0.033;
}

function steam(gp: THREE.Group, body: string): void {
  // a Jing-Zhang railway (京张铁路, 1909) train at Badaling: black locomotive with red wheels, tender, two coaches
  const h0 = ground(gp, 0.46, '#8f8a5a', '#5a4a34');
  lump(gp, 0, h0, -0.33, 0.33, 0.15, 0.1, '#6f7a44', { seed: 4, rough: 0.25, paint: rockPaint('#8a826e', '#6f7a44', 4) });
  // a stretch of the Great Wall along the ridge
  for (let i = 0; i < 9; i++) {
    const x = -0.26 + i * 0.065, y = h0 + 0.115 + Math.sin(i * 0.8) * 0.02 - Math.abs(x) * 0.18;
    box(gp, '#a39a8c', x, y - 0.02, -0.33, 0.066, 0.04, 0.03, 0, 0, Math.cos(i * 0.8) * 0.25);
    box(gp, '#8f877b', x - 0.015, y + 0.02, -0.318, 0.012, 0.01, 0.006); box(gp, '#8f877b', x + 0.015, y + 0.02, -0.318, 0.012, 0.01, 0.006);
  }
  box(gp, '#a39a8c', 0.08, h0 + 0.1, -0.33, 0.05, 0.08, 0.05); box(gp, '#8f877b', 0.08, h0 + 0.18, -0.33, 0.056, 0.01, 0.056);
  for (const [x, z] of [[-0.38, -0.12], [0.38, -0.14], [-0.3, 0.3], [0.33, 0.28]]) minipine(gp, x, h0, z, 0.09, '#3f6a32');
  const zt = 0.04, G = 0.06, rt = track(gp, h0, zt, 0.88, G);
  const red = '#8a1c16', wz = G / 2 + 0.006;
  // ---- locomotive (front = +x)
  const by = rt + 0.098;
  box(gp, red, 0.27, rt + 0.03, zt, 0.28, 0.014, G + 0.01);
  box(gp, body, 0.27, rt + 0.054, zt, 0.26, 0.006, 0.112);
  for (const s of [-1, 1]) box(gp, red, 0.27, rt + 0.054, zt + s * 0.056, 0.26, 0.004, 0.002);
  const boil = add(gp, CYLX(16), mat(body, { metal: 0.3, rough: 0.45 }), 0.29, by, zt, 0.072, 0.072, 0.17); boil.rotation.y = Math.PI / 2;
  for (const x of [0.23, 0.29, 0.34]) { const b = add(gp, CYLX(16), mat('#b8a060', { metal: 0.6 }), x, by, zt, 0.075, 0.075, 0.004); b.rotation.y = Math.PI / 2; }
  const sbx = add(gp, CYLX(16), mat('#2c2e31', { metal: 0.3 }), 0.39, by, zt, 0.078, 0.078, 0.04); sbx.rotation.y = Math.PI / 2;
  const door = add(gp, CYLX(16), mat('#3a3d41', { metal: 0.4 }), 0.411, by, zt, 0.06, 0.06, 0.004); door.rotation.y = Math.PI / 2;
  box(gp, '#d6a840', 0.414, by - 0.012, zt, 0.002, 0.012, 0.024);
  lathe(gp, [[0.012, 0], [0.012, 0.03], [0.018, 0.045], [0.019, 0.05], [0, 0.05]], '#26282b', 0.39, by + 0.028, zt, 12);
  lathe(gp, [[0.02, 0], [0.018, 0.012], [0.012, 0.022], [0, 0.026]], body, 0.3, by + 0.03, zt, 12);
  lathe(gp, [[0.018, 0], [0.016, 0.01], [0.01, 0.018], [0, 0.021]], '#b8a060', 0.255, by + 0.03, zt, 12);
  rod(gp, [0.27, by + 0.04, zt], [0.27, by + 0.06, zt], 0.003, '#d6a840', 5);
  box(gp, '#2a2a2a', 0.405, by + 0.04, zt, 0.022, 0.024, 0.024);
  add(gp, CYLX(10), mat('#fff3c4', { emissive: '#ffd27a' }), 0.418, by + 0.052, zt, 0.016, 0.016, 0.004).rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    const c = add(gp, CYLX(10), mat('#2c2e31'), 0.375, rt + 0.04, zt + s * 0.05, 0.034, 0.034, 0.05); c.rotation.y = Math.PI / 2;
    rod(gp, [0.22, by + 0.025, zt + s * 0.038], [0.39, by + 0.025, zt + s * 0.038], 0.0018, '#c9ccd1', 4);
    box(gp, '#c9ccd1', 0.255, rt + 0.024, zt + s * (wz + 0.006), 0.11, 0.005, 0.003);
  }
  // pilot (cowcatcher) and red buffer beam
  tbox(gp, 0.006, 0.08, 0.03, 0.08, 0.035, red, 0.425, rt - 0.004, zt, -0.012, 0);
  box(gp, red, 0.415, rt + 0.03, zt, 0.012, 0.022, 0.11);
  for (const s of [-1, 1]) { const bf = add(gp, CYLX(8), mat('#2a2a2a'), 0.425, rt + 0.04, zt + s * 0.04, 0.012, 0.012, 0.01); bf.rotation.y = Math.PI / 2; }
  // cab with windows, overhanging roof, and the driver
  box(gp, body, 0.165, rt + 0.054, zt, 0.08, 0.1, 0.11);
  for (const s of [-1, 1]) {
    box(gp, '#3a4048', 0.168, rt + 0.1, zt + s * 0.0555, 0.03, 0.03, 0.002);
    box(gp, red, 0.165, rt + 0.075, zt + s * 0.0555, 0.075, 0.004, 0.002);
  }
  box(gp, '#3a4048', 0.206, rt + 0.11, zt + 0.03, 0.002, 0.022, 0.02); box(gp, '#3a4048', 0.206, rt + 0.11, zt - 0.03, 0.002, 0.022, 0.02);
  rbox(gp, '#2a2c2f', 0.165, rt + 0.154, zt, 0.1, 0.008, 0.126, 0.003);
  person(gp, 0.165, rt + 0.065, zt + 0.045, { h: 0.075, pose: 'stand', top: '#2c3e50', hat: '#2c3e50', hatStyle: 'cap', ry: Math.PI / 2 });
  // wheels: pony truck, three coupled drivers with side rods, trailing truck
  for (const s of [-1, 1]) {
    for (const x of [0.2, 0.257, 0.314]) rwheel(gp, x, rt + 0.027, zt + s * wz, 0.027, red);
    rwheel(gp, 0.375, rt + 0.016, zt + s * wz, 0.016, red);
    rwheel(gp, 0.15, rt + 0.016, zt + s * wz, 0.016, red);
    box(gp, '#c9ccd1', 0.257, rt + 0.02, zt + s * (wz + 0.008), 0.125, 0.006, 0.003);
  }
  // ---- tender with coal
  box(gp, red, 0.05, rt + 0.03, zt, 0.12, 0.012, G + 0.01);
  rbox(gp, body, 0.05, rt + 0.042, zt, 0.12, 0.07, 0.104, 0.004);
  box(gp, red, 0.05, rt + 0.1, zt, 0.122, 0.004, 0.106);
  for (let i = 0; i < 7; i++) ellip(gp, '#151515', 0.01 + (i % 4) * 0.025, rt + 0.112, zt + (i > 3 ? 0.018 : -0.015), 0.022, 0.012, 0.02);
  for (const s of [-1, 1]) for (const x of [0.012, 0.038, 0.062, 0.088]) rwheel(gp, x, rt + 0.016, zt + s * wz, 0.016, red);
  box(gp, '#2a2a2a', 0.115, rt + 0.035, zt, 0.012, 0.008, 0.01);
  // ---- two Qing-era wooden coaches with clerestory roofs and open end platforms
  for (const [cx, c] of [[-0.12, '#2f4a3a'], [-0.33, '#6a2a22']] as const) {
    const Lc = 0.18;
    box(gp, '#2a2a2a', cx, rt + 0.03, zt, Lc + 0.02, 0.01, G + 0.01);
    rbox(gp, c, cx, rt + 0.04, zt, Lc - 0.03, 0.075, 0.1, 0.003);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) box(gp, '#e3d6a2', cx - Lc / 2 + 0.03 + k * ((Lc - 0.06) / 5), rt + 0.075, zt + s * 0.0505, 0.016, 0.022, 0.002);
      box(gp, '#d6a840', cx, rt + 0.064, zt + s * 0.0505, Lc - 0.03, 0.003, 0.002);
      box(gp, '#d6a840', cx, rt + 0.102, zt + s * 0.0505, Lc - 0.03, 0.003, 0.002);
      for (const sx of [-1, 1]) {
        box(gp, '#3a3a3a', cx + sx * (Lc / 2 - 0.004), rt + 0.04, zt + s * 0.045, 0.003, 0.03, 0.003);
        box(gp, '#3a3a3a', cx + sx * (Lc / 2 - 0.004), rt + 0.068, zt, 0.003, 0.003, 0.09);
      }
      for (const x of [cx - 0.06, cx - 0.035, cx + 0.035, cx + 0.06]) rwheel(gp, x, rt + 0.014, zt + s * wz, 0.014, '#2a2a2a');
    }
    rbox(gp, '#3d3a36', cx, rt + 0.115, zt, Lc, 0.008, 0.114, 0.004);
    rbox(gp, '#4a4640', cx, rt + 0.123, zt, Lc - 0.04, 0.016, 0.05, 0.004);
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) box(gp, '#e3d6a2', cx - Lc / 2 + 0.03 + k * ((Lc - 0.06) / 7), rt + 0.126, zt + s * 0.0255, 0.008, 0.007, 0.002);
    box(gp, '#2a2a2a', cx + Lc / 2 + 0.005, rt + 0.035, zt, 0.012, 0.008, 0.01);
  }
  // smoke from the stack, steam at the cylinders
  smoke(gp, 0.39, by + 0.09, zt, 0.04, '#e8e6e2', 7, 0.6);
  for (let i = 0; i < 4; i++) ellip(gp, '#f2f2f2', 0.39 - i * 0.04, by + 0.09 + i * 0.02 - i * i * 0.004, zt - i * 0.01, 0.025 + i * 0.008, 0.02 + i * 0.006, 0.025 + i * 0.008).material = mat('#f2f2f2', { transparent: 0.6 });
  for (const s of [-1, 1]) ellip(gp, '#ffffff', 0.4, rt + 0.03, zt + s * 0.07, 0.018, 0.01, 0.015).material = mat('#ffffff', { transparent: 0.55 });
  // Zhan Tianyou (詹天佑) style engineer by the line and a semaphore signal
  person(gp, 0.05, h0, 0.2, { h: 0.12, pose: 'point', top: '#2a2a3a', bottom: '#2a2a3a', dress: 'ankle', hat: '#1c1714', hatStyle: 'qing', hatBadge: '#b91c1c', ry: -0.4 });
  person(gp, -0.1, h0, 0.24, { h: 0.11, pose: 'wave', top: '#3a5a7a', bottom: '#2a2a2a', hat: '#2a2a2a', hatStyle: 'cap', ry: 0.2 });
  rod(gp, [0.3, h0, 0.2], [0.3, h0 + 0.2, 0.2], 0.004, '#3a3a3a', 5);
  box(gp, '#b91c1c', 0.32, h0 + 0.17, 0.2, 0.04, 0.012, 0.003, 0, 0, -0.5);
  ellip(gp, '#fff3c4', 0.3, h0 + 0.15, 0.204, 0.006, 0.006, 0.003).material = mat('#ffef9a', { emissive: '#ffd24a' });
}

function crh(gp: THREE.Group): void {
  // a white CRH380A high-speed train on a box-girder viaduct across fields
  const h0 = ground(gp, 0.46, '#7d9a4f', '#5a4a34');
  for (let i = 0; i < 6; i++) prism(gp, clipR([[-0.44, -0.44 + i * 0.15], [0.44, -0.44 + i * 0.15], [0.44, -0.37 + i * 0.15], [-0.44, -0.37 + i * 0.15]], 0.44), h0, 0.002, i % 2 ? '#8fb05a' : '#c9b25a');
  const zt = 0.0, dy = h0 + 0.12;
  for (const x of [-0.33, -0.11, 0.11, 0.33]) {
    tbox(gp, 0.04, 0.05, 0.03, 0.06, dy - 0.04 - h0, P.concrete, x, h0, zt);
    tbox(gp, 0.04, 0.06, 0.05, 0.12, 0.02, P.concrete, x, dy - 0.04, zt);
  }
  tbox(gp, 0.9, 0.07, 0.9, 0.13, 0.02, '#d8d4ca', 0, dy - 0.02, zt);
  box(gp, '#b8b4aa', 0, dy, zt, 0.9, 0.006, 0.13);
  for (const s of [-1, 1]) box(gp, '#e4e0d6', 0, dy, zt + s * 0.063, 0.9, 0.014, 0.006);
  for (const s of [-1, 1]) box(gp, '#7d838b', 0, dy + 0.006, zt + s * 0.024, 0.9, 0.005, 0.005);
  const ry0 = dy + 0.012;
  // catenary masts and contact wire
  for (const x of [-0.42, -0.21, 0, 0.21, 0.42]) {
    rod(gp, [x, dy, zt - 0.058], [x, dy + 0.15, zt - 0.058], 0.0035, '#8a8f96', 5);
    rod(gp, [x, dy + 0.14, zt - 0.058], [x, dy + 0.14, zt + 0.01], 0.002, '#8a8f96', 4);
  }
  rod(gp, [-0.44, dy + 0.128, zt], [0.44, dy + 0.128, zt], 0.0008, '#3a3a3a', 3);
  // the train
  const W = 0.04, Hh = 0.085, y0 = ry0 + 0.008;
  const ring = (x: number, w: number, h: number, yb: number, e: number): V3[] => {
    const out: V3[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const px = Math.sign(c) * Math.abs(c) ** (2 / e), py = Math.sign(sn) * Math.abs(sn) ** (2 / e);
      out.push([x, yb + h / 2 + py * h / 2, zt + px * w]);
    }
    return out;
  };
  const paint: Paint = (x, y, _z, _nx, ny, nz) => {
    const t = (y - y0) / Hh;
    if (ny < -0.6) return '#3a3d42';
    if (Math.abs(nz) > 0.45 && t > 0.24 && t < 0.31) return '#1d4f9a';
    if (Math.abs(nz) > 0.6 && t > 0.55 && t < 0.7 && ((x + 2) * 40) % 1 < 0.6) return '#28313b';
    return '#f2f4f5';
  };
  const nosePaint = (dir: number, x0: number): Paint => (x, y, z, nx, ny, nz) => {
    const u = (x - x0) * dir;
    if (ny > 0.25 && u > 0.02 && u < 0.065 && Math.abs(z - zt) < 0.03) return '#1e2833';
    return paint(x, y, z, nx, ny, nz);
  };
  const car = (xa: number, xb: number) => {
    const rings: V3[][] = [];
    for (let i = 0; i <= 16; i++) rings.push(ring(xa + (xb - xa) * (i / 16), W, Hh, y0, 4));
    skin(gp, rings, '#f2f4f5', { caps: true, paint });
  };
  const nose = (x0: number, dir: number, len: number) => {
    const rings: V3[][] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, w = W * (1 - 0.82 * t ** 2.6), h = Hh * (1 - 0.72 * t ** 1.4), e = 4 - 2 * t;
      rings.push(ring(x0 + dir * len * t, Math.max(0.004, w), Math.max(0.006, h), y0 + 0.004 * t, e));
    }
    skin(gp, rings, '#f2f4f5', { caps: true, paint: nosePaint(dir, x0) });
    ellip(gp, '#fff3c4', x0 + dir * len * 0.72, y0 + 0.016, zt + 0.018, 0.006, 0.003, 0.004).material = mat('#ffffff', { emissive: '#fff3c4' });
    ellip(gp, '#fff3c4', x0 + dir * len * 0.72, y0 + 0.016, zt - 0.018, 0.006, 0.003, 0.004).material = mat('#ffffff', { emissive: '#fff3c4' });
  };
  car(0.12, 0.3); nose(0.3, 1, 0.14);
  car(-0.1, 0.112);
  car(-0.3, -0.108); nose(-0.3, -1, 0.14);
  for (const x of [0.116, -0.104]) box(gp, '#2a2d31', x, y0 + 0.006, zt, 0.008, Hh - 0.014, W * 1.7);
  for (const x of [-0.27, -0.13, -0.07, 0.08, 0.15, 0.27]) box(gp, '#2a2d31', x, ry0, zt, 0.04, 0.012, W * 1.6);
  // pantograph
  const px = 0.0, pt = y0 + Hh;
  box(gp, '#5a5f66', px, pt, zt, 0.03, 0.006, 0.03);
  rod(gp, [px - 0.012, pt + 0.006, zt], [px + 0.008, pt + 0.028, zt], 0.0015, '#5a5f66', 3);
  rod(gp, [px + 0.008, pt + 0.028, zt], [px - 0.004, pt + 0.042, zt], 0.0015, '#5a5f66', 3);
  box(gp, '#3a3a3a', px - 0.004, pt + 0.042, zt, 0.004, 0.003, 0.04);
  for (const [x, z] of [[-0.35, -0.24], [0.36, -0.22], [-0.3, 0.28], [0.25, 0.32], [0.0, -0.36]]) { cyl(gp, '#5b4030', x, h0, z, 0.006, 0.03, 5); ellip(gp, '#4d7a3a', x, h0 + 0.05, z, 0.035, 0.032, 0.035); }
}

const train: Builder = (gp, r) => (r.style === 'crh' ? crh(gp) : steam(gp, str(r.color, '#1f2124')));

const factory: Builder = gp => {
  // Dasheng cotton mill (大生纱厂, Nantong 1899): brick sawtooth weaving sheds, boiler house with a tall chimney,
  // a clock-tower office and the walled gate with its signboard
  const h0 = ground(gp, 0.46, '#8c8576', '#5d564a');
  prism(gp, clipR([[-0.44, 0.18], [0.44, 0.18], [0.44, 0.44], [-0.44, 0.44]], 0.45), h0, 0.002, '#a59d8c');
  const brick = '#9a4a32', bp = brickPaint(brick, 0.01, 0.022);
  const win: Paint = (x, y, z, nx, ny, nz) => {
    if (Math.abs(ny) > 0.5) return '#5a4a40';
    const u = Math.abs(nz) > 0.5 ? x : z, k = ((u + 4) / 0.05) % 1;
    if (y > 0.025 && y < 0.075 && k > 0.3 && k < 0.7 && (y < 0.065 || Math.abs(k - 0.5) < 0.12)) return '#2f3a42';
    if (y > 0.018 && y < 0.024 && k > 0.25 && k < 0.75) return '#cfc7b4';
    return bp(x, y, z, nx, ny, nz);
  };
  // ---- sawtooth shed: brick walls, 6 north-light teeth (steep glazing facing back, sloped slate to the front)
  const sx = -0.1, sz = -0.12, SW = 0.5, SD = 0.3, wh = 0.1, nT = 6, tH = 0.07;
  pbox(gp, sx, h0, sz, SW, wh, SD, [20, 6, 12], brick, win);
  const td = SD / nT;
  for (let i = 0; i < nT; i++) {
    const z0 = sz - SD / 2 + i * td;
    const G = new THREE.Group(); G.position.set(sx, h0 + wh, z0); gp.add(G);
    const sh = slab(G, [[0, 0], [td, 0], [0.004, tH], [0, tH]], SW, '#4a4e55', 0, false);
    sh.rotation.y = -Math.PI / 2;
    // glazing on the vertical back face
    box(G, '#7f9fb0', 0, 0.008, -0.001, SW - 0.02, tH - 0.016, 0.002).material = mat('#9fc0cc', { rough: 0.15, metal: 0.4 });
    for (let k = 0; k < 12; k++) box(G, '#3a3a3a', -SW / 2 + 0.02 + k * ((SW - 0.04) / 11), 0.006, -0.002, 0.003, tH - 0.012, 0.003);
    for (const s of [-1, 1]) { const gt = slab(G, [[0, 0], [td, 0], [0, tH + 0.006]], 0.012, brick, 0, false); gt.rotation.y = -Math.PI / 2; gt.position.x = s * (SW / 2 + 0.002); }
  }
  // ---- boiler house with tall tapered brick chimney (banded, dark smoke)
  const cx = 0.3, cz = -0.25;
  pbox(gp, 0.25, h0, -0.2, 0.14, 0.14, 0.13, [8, 6, 8], brick, win);
  gable(gp, 0.15, 0.04, 0.14, '#4a4e55', 0.25, h0 + 0.14, -0.2);
  tbox(gp, 0.07, 0.07, 0.07, 0.07, 0.04, shade(brick, 0.85), cx, h0, cz);
  const CH = 0.56;
  plathe(gp, [[0.034, 0], [0.018, CH], [0, CH]], brick, (x, y, z) => {
    const t = y / CH;
    if (Math.abs(t - 0.97) < 0.025 || Math.abs(t - 0.6) < 0.008 || Math.abs(t - 0.3) < 0.008) return '#6a2e20';
    return bp(x, y, z, 0, 0, 1);
  }, cx, h0 + 0.04, cz, 14);
  lathe(gp, [[0.021, 0], [0.024, 0.01], [0.024, 0.02], [0.016, 0.02], [0.016, 0.005], [0, 0.005]], '#3a2a24', cx, h0 + 0.04 + CH - 0.01, cz, 12);
  smoke(gp, cx, h0 + CH + 0.07, cz, 0.06, '#4a4a4a', 7, 0.6);
  for (let i = 0; i < 4; i++) ellip(gp, '#5a5856', cx - 0.03 - i * 0.05, h0 + CH + 0.08 + i * 0.025, cz + i * 0.01, 0.03 + i * 0.012, 0.022 + i * 0.008, 0.03 + i * 0.01).material = mat('#55524f', { transparent: 0.55 - i * 0.08 });
  // ---- two-storey office with a clock tower (front right)
  const ox = 0.24, oz = 0.07;
  pbox(gp, ox, h0, oz, 0.16, 0.13, 0.1, [10, 8, 6], '#b85a3a', (x, y, z, nx, ny, nz) => {
    if (Math.abs(ny) > 0.5) return '#5a4a40';
    const u = Math.abs(nz) > 0.5 ? x : z, k = ((u + 4) / 0.032) % 1, fy = (y % 0.065) / 0.065;
    if (k > 0.3 && k < 0.7 && fy > 0.3 && fy < 0.82) return fy > 0.74 ? '#e6dcc6' : '#2f3a42';
    if (Math.abs(y - 0.065) < 0.004) return '#e6dcc6';
    return brickPaint('#b85a3a', 0.008, 0.02)(x, y, z, nx, ny, nz);
  });
  tbox(gp, 0.17, 0.11, 0.1, 0.04, 0.04, '#4a4e55', ox, h0 + 0.13, oz);
  pbox(gp, ox, h0 + 0.13, oz + 0.035, 0.05, 0.1, 0.05, [3, 6, 3], '#e6dcc6', bp);
  for (const [nx2, nz2] of [[0, 1], [1, 0]] as const) {
    const cf = cyl(gp, '#f5f1e6', 0, 0, 0, 0.016, 0.003, 14);
    cf.rotation.set(nz2 ? Math.PI / 2 : 0, 0, nx2 ? Math.PI / 2 : 0);
    cf.position.set(ox + nx2 * 0.026, h0 + 0.205, oz + 0.035 + nz2 * 0.026);
    box(gp, '#1a1a1a', ox + nx2 * 0.028, h0 + 0.2, oz + 0.035 + nz2 * 0.028, 0.002, 0.012, 0.002);
  }
  tbox(gp, 0.056, 0.056, 0.0, 0.0, 0.05, '#4a4e55', ox, h0 + 0.23, oz + 0.035);
  rod(gp, [ox, h0 + 0.27, oz + 0.035], [ox, h0 + 0.31, oz + 0.035], 0.002, '#3a3a3a', 4);
  // ---- compound wall, gate piers, iron gate and signboard 大生纱厂
  const gz = 0.2;
  for (const s of [-1, 1]) {
    pbox(gp, -0.06 + s * 0.22, h0, gz, 0.26, 0.05, 0.014, [10, 2, 1], brick, bp);
    pbox(gp, -0.06 + s * 0.08, h0, gz, 0.035, 0.13, 0.035, [2, 6, 2], '#c9bfae', brickPaint('#c9bfae', 0.012, 0.03));
    lathe(gp, [[0.006, 0], [0.012, 0.012], [0, 0.022]], '#c9bfae', -0.06 + s * 0.08, h0 + 0.13, gz, 8);
    for (let k = 0; k < 6; k++) rod(gp, [-0.06 + s * (0.012 + k * 0.009), h0, gz], [-0.06 + s * (0.012 + k * 0.009), h0 + 0.075 + Math.sin(k * 0.5) * 0.008, gz], 0.0015, '#2a2a2a', 3);
    box(gp, '#2a2a2a', -0.06 + s * 0.035, h0 + 0.06, gz, 0.06, 0.003, 0.003);
  }
  box(gp, '#1c1c1c', -0.06, h0 + 0.13, gz + 0.005, 0.15, 0.04, 0.006);
  for (let k = 0; k < 4; k++) box(gp, '#e9c46a', -0.06 - 0.051 + k * 0.034, h0 + 0.138, gz + 0.009, 0.022, 0.024, 0.002);
  // cotton bales, a hand cart, workers
  for (const [x, z, y] of [[0.08, 0.27, 0], [0.13, 0.27, 0], [0.105, 0.27, 0.035], [0.08, 0.31, 0]] as const) rbox(gp, '#ece7da', x, h0 + y, z, 0.045, 0.035, 0.035, 0.006);
  for (const [x, z] of [[0.08, 0.27], [0.13, 0.27]]) box(gp, '#7a6a50', x, h0 + 0.017, z, 0.046, 0.003, 0.036);
  box(gp, '#7a5536', -0.22, h0 + 0.03, 0.3, 0.09, 0.008, 0.05, 0.3);
  for (const s of [-1, 1]) { const w = cyl(gp, '#4a3222', -0.22, h0 + 0.03, 0.3 + s * 0.03, 0.028, 0.006, 12); w.rotation.set(Math.PI / 2, 0.3, 0); }
  rbox(gp, '#ece7da', -0.22, h0 + 0.038, 0.3, 0.06, 0.03, 0.04, 0.006, 0.3);
  person(gp, -0.29, h0, 0.33, { h: 0.11, pose: 'carry', top: '#3a5a7a', bottom: '#2a2a2a', hat: '#2a2a2a', hatStyle: 'cap', ry: 1.2 });
  person(gp, 0.0, h0, 0.3, { h: 0.11, pose: 'walk', top: '#e8e3d6', bottom: '#3a5a7a', hair: '#1c1714', ry: -0.3, dress: 'ankle' });
  person(gp, 0.04, h0, 0.36, { h: 0.105, pose: 'walk', phase: 0.5, top: '#7a8a9a', bottom: '#3a3a3a', ry: 0.4 });
  person(gp, 0.18, h0, 0.33, { h: 0.12, pose: 'point', top: '#2a2a3a', bottom: '#2a2a3a', dress: 'ankle', hat: '#1c1714', hatStyle: 'bowl', ry: -0.6 });
  for (const [x, z] of [[-0.38, 0.1], [0.4, -0.02], [-0.4, -0.18], [0.37, 0.24]]) { cyl(gp, '#5b4030', x, h0, z, 0.007, 0.05, 5); ellip(gp, '#4d7a3a', x, h0 + 0.075, z, 0.045, 0.04, 0.045); }
};

const rocket: Builder = (gp, r) => {
  // Long March 2F (长征二号F) on the Jiuquan pad: white core with stages and fairing, escape tower, four boosters,
  // red umbilical tower with swing arms, flame trench; r.style 'launch' (or r.launch) shows lift-off
  const launch = r.style === 'launch' || r.launch === true;
  const h0 = ground(gp, 0.46, '#b9ab8c', '#8a7a5e');
  tbox(gp, 0.6, 0.5, 0.56, 0.46, 0.025, P.concrete, 0.02, h0, -0.02);
  const pt = h0 + 0.025, rx = 0.07, rz = 0.0;
  box(gp, '#2a2a2a', rx, pt - 0.004, rz, 0.18, 0.006, 0.08);
  tbox(gp, 0.16, 0.06, 0.16, 0.06, 0.004, '#3a3a3a', rx, pt - 0.002, rz + 0.12);
  // trench walls and the launch table
  for (const s of [-1, 1]) box(gp, '#9a958a', rx + s * 0.075, pt, rz + 0.12, 0.012, 0.006, 0.07);
  pbox(gp, rx, pt, rz, 0.13, 0.03, 0.13, [3, 1, 3], '#7d838b', (_x, _y, _z, _nx, ny) => ny > 0.5 ? '#6a7078' : '#7d838b');
  for (const s of [-1, 1]) for (const t of [-1, 1]) box(gp, '#8a8f96', rx + s * 0.05, pt + 0.03, rz + t * 0.05, 0.02, 0.025, 0.02);
  const by = pt + 0.055, R = 0.034;
  // ---- core stage: white with grey roll-pattern bands, stage rings, fairing with escape tower
  plathe(gp, [[0.024, -0.02], [R, 0], [R, 0.5], [R * 0.82, 0.53], [R * 0.82, 0.6], [R * 1.02, 0.63], [R * 1.02, 0.7], [R * 0.85, 0.74], [R * 0.55, 0.79], [R * 0.2, 0.82], [0, 0.825]], '#f2f2ef', (x, y, z) => {
    const a = Math.atan2(z, x), q = ((a / (Math.PI / 2)) % 1 + 1) % 1;
    if (y > 0.47 && y < 0.5) return '#2a2c30';
    if (Math.abs(y - 0.2) < 0.005 || Math.abs(y - 0.4) < 0.004) return '#c9cdd2';
    if (y > 0.04 && y < 0.1 && q < 0.25) return '#2a2c30';
    if (y > 0.6 && y < 0.62) return '#2a2c30';
    if (y > 0.25 && y < 0.38 && z > 0.02 && Math.abs(x) < 0.01) return '#c81e1e';
    if (y > 0.65 && y < 0.69 && z > 0.025 && Math.abs(x) < 0.006) return '#c81e1e';
    return '#f2f2ef';
  }, rx, by, rz, 24, { rough: 0.5 });
  // escape tower with grid fins
  rod(gp, [rx, by + 0.82, rz], [rx, by + 0.94, rz], 0.0045, '#d8d8d4', 6);
  lathe(gp, [[0.006, 0], [0.006, 0.02], [0, 0.04]], '#d8d8d4', rx, by + 0.94, rz, 8);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; box(gp, '#9a9a9a', rx + Math.cos(a) * 0.022, by + 0.69, rz + Math.sin(a) * 0.022, 0.012, 0.014, 0.003, -a + Math.PI / 2); }
  // red flag on the core (front)
  box(gp, '#d42a1e', rx, by + 0.42, rz + R + 0.0005, 0.024, 0.016, 0.001);
  for (let k = 0; k < 5; k++) box(gp, '#ffd23f', rx - 0.008 + (k ? 0.006 + (k % 2) * 0.002 : 0), by + 0.427 - (k ? (k - 1) * 0.003 : 0), rz + R + 0.0012, k ? 0.002 : 0.005, k ? 0.002 : 0.005, 0.001);
  // engines
  for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lathe(gp, [[0.006, 0], [0.012, -0.03], [0.011, -0.03], [0.005, 0]], '#4a4a4a', rx + s[0] * 0.012, by - 0.005, rz + s[1] * 0.012, 10);
  // ---- four liquid boosters with conical noses and fins
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, bx = rx + Math.cos(a) * (R + 0.021), bz = rz + Math.sin(a) * (R + 0.021);
    plathe(gp, [[0.012, -0.012], [0.02, 0], [0.02, 0.26], [0.016, 0.3], [0.006, 0.33], [0, 0.335]], '#f2f2ef', (_x, y) => (y > 0.03 && y < 0.07) || (y > 0.2 && y < 0.215) ? '#2a2c30' : '#f2f2ef', bx, by, bz, 14, { rough: 0.5 });
    box(gp, '#f2f2ef', bx + Math.cos(a) * 0.024, by + 0.01, bz + Math.sin(a) * 0.024, 0.002, 0.04, 0.02, -a);
    lathe(gp, [[0.006, 0], [0.012, -0.026], [0.011, -0.026], [0.005, 0]], '#4a4a4a', bx, by - 0.012, bz, 10);
    rod(gp, [bx, by + 0.29, bz], [rx + Math.cos(a) * R, by + 0.29, rz + Math.sin(a) * R], 0.002, '#9a9a9a', 3);
  }
  // ---- umbilical / service tower: red lattice with white-trimmed floors and swing arms
  const tx = -0.15, tz = -0.02, TW = 0.11, TH = 0.98, nF = 12;
  for (const s of [-1, 1]) for (const t of [-1, 1]) rod(gp, [tx + s * TW / 2, pt, tz + t * TW / 2], [tx + s * TW / 2, pt + TH, tz + t * TW / 2], 0.0045, '#b3261e', 4);
  for (let i = 0; i <= nF; i++) {
    const y = pt + (i / nF) * TH;
    for (const s of [-1, 1]) {
      box(gp, '#b3261e', tx, y, tz + s * TW / 2, TW, 0.004, 0.004);
      box(gp, '#b3261e', tx + s * TW / 2, y, tz, 0.004, 0.004, TW);
    }
    if (i % 2 === 0) box(gp, '#d8d4ca', tx, y - 0.002, tz, TW - 0.01, 0.003, TW - 0.01);
    if (i < nF) {
      const y1 = pt + ((i + 1) / nF) * TH, f = i % 2 ? 1 : -1;
      for (const s of [-1, 1]) {
        rod(gp, [tx - f * TW / 2, y, tz + s * TW / 2], [tx + f * TW / 2, y1, tz + s * TW / 2], 0.0018, '#b3261e', 3);
        rod(gp, [tx + s * TW / 2, y, tz - f * TW / 2], [tx + s * TW / 2, y1, tz + f * TW / 2], 0.0018, '#b3261e', 3);
      }
    }
  }
  rbox(gp, '#d8d4ca', tx, pt + TH, tz, TW + 0.02, 0.04, TW + 0.02, 0.003);
  rod(gp, [tx, pt + TH + 0.04, tz], [tx, pt + TH + 0.1, tz], 0.002, '#3a3a3a', 4);
  // swing arms (folded back to the tower at launch)
  const armL = rx - R - 0.012 - (tx + TW / 2);
  for (const [y, w] of [[0.3, 0.02], [0.52, 0.02], [0.66, 0.035], [0.74, 0.03]] as const) {
    const ay = by + y;
    if (launch) { box(gp, '#d8d4ca', tx + TW / 2 + 0.003, ay, tz + 0.06, 0.012, w, armL * 0.8); continue; }
    box(gp, '#d8d4ca', tx + TW / 2 + armL / 2, ay, tz, armL, w, 0.03);
    for (const s of [-1, 1]) rod(gp, [tx + TW / 2, ay + w / 2, tz + s * 0.015], [tx + TW / 2 + armL, ay + w / 2, tz + s * 0.015], 0.0012, '#b3261e', 3);
  }
  // lightning masts and a distant assembly building
  for (const [x, z] of [[-0.33, -0.28], [0.34, -0.26], [0.3, 0.27]]) {
    rod(gp, [x, h0, z], [x, h0 + 0.62, z], 0.005, '#d8d4ca', 5);
    for (let k = 1; k < 7; k++) box(gp, '#c81e1e', x, h0 + k * 0.1, z, 0.012, 0.01, 0.012);
  }
  pbox(gp, -0.33, h0, 0.18, 0.12, 0.2, 0.1, [4, 6, 4], '#e4e0d6', (_x, y, _z, _nx, ny, nz) => ny > 0.5 ? '#9a9a9a' : nz > 0.5 && y < 0.17 && y > 0.01 && Math.abs(_x) < 0.03 ? '#4a4e55' : '#e4e0d6');
  for (const [x, z, ry] of [[0.3, 0.2, -0.6], [0.34, 0.15, -0.9], [-0.18, 0.3, 0.3]] as const) person(gp, x, h0, z, { h: 0.06, pose: x < 0 ? 'wave' : 'stand', top: '#2a5a9a', bottom: '#2a5a9a', hat: '#e8e8e8', hatStyle: 'helmet', ry });
  if (launch) {
    const fl = flame(gp, rx, by - 0.04, rz, 0.0);
    fl.rotation.x = Math.PI;
    fl.scale.set(1, 1, 1);
    fl.clear();
    add(fl, FCONE(), mat('#f59e0b', { emissive: '#f97316' }), 0, 0, 0, 0.07, 0.14, 0.07);
    add(fl, FCONE(), mat('#fff3c4', { emissive: '#ffe08a' }), 0, 0, 0, 0.035, 0.09, 0.035);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, d = 0.1 + (i % 3) * 0.04;
      ellip(gp, '#f1efea', rx + Math.cos(a) * d * 1.2, pt + 0.03 + (i % 2) * 0.02, rz + 0.08 + Math.sin(a) * d * 0.6, 0.06 + (i % 3) * 0.015, 0.045, 0.05).material = mat('#f1efea', { transparent: 0.85 });
    }
    smoke(gp, rx, pt + 0.06, rz + 0.12, 0.08, '#eeeae4', 8, 0.7);
  } else {
    // venting vapour from the upper stage
    for (let i = 0; i < 3; i++) ellip(gp, '#ffffff', rx + 0.035 + i * 0.012, by + 0.5 - i * 0.02, rz + 0.01, 0.012 + i * 0.006, 0.01 + i * 0.004, 0.012).material = mat('#ffffff', { transparent: 0.5 });
  }
};

const stadium: Builder = gp => {
  // Beijing National Stadium (鸟巢, 2008): saddle-shaped elliptical bowl wrapped in an interwoven steel lattice,
  // red inner facade, translucent roof membrane, red seating bowl and the field, set on a stone plaza
  const h0 = ground(gp, 0.46, '#c9c4b8', '#8f8a80');
  const A = 0.39, B = 0.3, N = 64;
  const H = (t: number) => 0.15 * (1 + 0.2 * Math.cos(2 * t));
  const S = (t: number, s: number): V3 => {
    let f: number, y: number;
    if (s <= 0.62) { const u = s / 0.62; f = 0.9 + 0.1 * Math.sin(u * Math.PI / 2); y = H(t) * u; }
    else { const u = (s - 0.62) / 0.38; f = 1 - 0.44 * u ** 0.9; y = H(t) + 0.018 * Math.sin(Math.PI * u * 0.75) - 0.012 * u; }
    return [A * f * Math.cos(t), h0 + y, B * f * Math.sin(t)];
  };
  const rings: V3[][] = [];
  for (const s of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.56, 0.6, 0.62, 0.65, 0.7, 0.78, 0.86, 0.94, 1]) {
    const ring: V3[] = [];
    for (let i = 0; i < N; i++) ring.push(S((i / N) * Math.PI * 2, s));
    rings.push(ring);
  }
  skin(gp, rings, '#8a2a24', {
    closed: true,
    paint: (x, y, z, _nx, ny) => ny > 0.45 ? shade('#d9dcdc', 0.92 + hash3(Math.floor(x * 60), Math.floor(z * 60), 1) * 0.1)
      : shade('#9a2e26', 0.55 + 0.6 * ((y - h0) / 0.2)),
  });
  // inner lip of the roof opening (dark rim)
  const lip: V3[][] = [0, 1].map(k => Array.from({ length: N }, (_, i) => { const p = S((i / N) * Math.PI * 2, 1); return [p[0], p[1] - k * 0.03, p[2]] as V3; }));
  skin(gp, lip, '#4a4a4a', { closed: true });
  // seating bowl, track and pitch (seen through the roof opening)
  const bowl: V3[][] = [];
  for (let j = 0; j <= 8; j++) {
    const u = j / 8, ring: V3[] = [];
    for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; ring.push([(0.17 + 0.15 * u) * Math.cos(t), h0 + 0.012 + 0.1 * u ** 1.15, (0.11 + 0.13 * u) * Math.sin(t)]); }
    bowl.push(ring);
  }
  skin(gp, bowl, '#b3261e', { closed: true, inward: true, paint: (_x, y) => shade('#b3261e', 0.75 + (y - h0) * 3) });
  prism(gp, Array.from({ length: 32 }, (_, i) => { const t = (i / 32) * Math.PI * 2; return [0.17 * Math.cos(t), 0.11 * Math.sin(t)] as [number, number]; }), h0, 0.01, '#a8483a');
  prism(gp, Array.from({ length: 32 }, (_, i) => { const t = (i / 32) * Math.PI * 2; return [0.13 * Math.cos(t), 0.072 * Math.sin(t)] as [number, number]; }), h0, 0.0115, '#4f8a3a');
  // the nest: primary members spiral both ways over wall and roof, a slightly irregular weave
  const steel = '#8c9096', off = 0.006;
  const member = (t0: number, k: number, s0: number, s1: number, w: number) => {
    const st: { p: V3; w: number }[] = [];
    for (let i = 0; i <= 10; i++) {
      const s = s0 + (s1 - s0) * (i / 10), t = t0 + k * s;
      const p = S(t, s), q = S(t, Math.min(1, s + 0.02)), r2 = Math.hypot(p[0], p[2]);
      const up = s > 0.6 ? 1 : 0.2;
      st.push({ p: [p[0] + (p[0] / r2) * off * (1 - up * 0.5), p[1] + off * up, p[2] + (p[2] / r2) * off * (1 - up * 0.5)], w });
      void q;
    }
    sweep(gp, st, steel, { radial: 4, sub: 2 });
  };
  for (let i = 0; i < 30; i++) {
    const t0 = (i / 30) * Math.PI * 2 + Math.sin(i * 1.7) * 0.05;
    member(t0, 1.1, 0, 1, 0.0055);
    member(t0 + 0.08, -1.1, 0, 1, 0.0055);
  }
  for (let i = 0; i < 30; i++) member((i / 30) * Math.PI * 2 + 0.13, (i % 2 ? 0.5 : -0.6) * (1 + (i % 3) * 0.3), 0.05 + (i % 3) * 0.15, 0.5 + (i % 4) * 0.15, 0.0032);
  // wide raked columns at the base
  for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2 + 0.06; member(t, 0.35, 0, 0.6, 0.006); }
  // plaza: paving bands, lamps, trees, visitors
  for (const [x, z] of [[-0.26, 0.32], [-0.09, 0.37], [0.09, 0.37], [0.26, 0.32]]) { rod(gp, [x, h0, z], [x, h0 + 0.09, z], 0.002, '#4a4a4a', 4); ellip(gp, '#fff3c4', x, h0 + 0.092, z, 0.006).material = mat('#fff3c4', { emissive: '#ffe08a' }); }
  for (const [x, z] of [[-0.42, 0.1], [0.42, 0.08], [-0.4, -0.18], [0.4, -0.2], [-0.24, -0.38], [0.22, -0.39]]) { cyl(gp, '#5b4030', x, h0, z, 0.005, 0.03, 5); ellip(gp, '#4d7a3a', x, h0 + 0.045, z, 0.03, 0.028, 0.03); }
  const vis = [['#d94f3a', 0.0], ['#2f6fb0', 0.5], ['#e8c13a', 0.2], ['#3a8a5a', 0.7], ['#f2f2f2', 0.4]] as const;
  for (let i = 0; i < 8; i++) { const [c, ph] = vis[i % 5]; person(gp, -0.28 + i * 0.08, h0, 0.31 + (i % 3) * 0.03, { h: 0.05, pose: i % 3 ? 'walk' : 'photo', phase: ph, top: c, bottom: '#2a2a3a', ry: (i % 2 ? 1 : -1) * 0.6 + Math.PI }); }
};

/** Glass tower facade: floor bands and mullions, lit lobby, roof plant. Local coords from pbox. */
const glass = (c: string, fh = 0.012, mw = 0.016): Paint => (x, y, z, _nx, ny, nz) => {
  if (ny > 0.5) return '#6a6e74';
  if (ny < -0.5) return '#333';
  const u = Math.abs(nz) > 0.5 ? x : z, fy = ((y + 10) / fh) % 1, fu = ((u + 10) / mw) % 1;
  if (fy < 0.18) return shade(c, 0.7);
  if (fu < 0.1) return shade(c, 0.8);
  return shade(c, 1 + (hash3(Math.floor(y / fh), Math.floor(u / mw), 5) - 0.5) * 0.12);
};

const skyline: Builder = gp => {
  // Shanghai Lujiazui (陆家嘴) seen across the Huangpu: Oriental Pearl Tower, Jin Mao, the SWFC "bottle opener",
  // the twisting Shanghai Tower and a field of glass towers; riverside promenade and a tour boat
  const h0 = ground(gp, 0.46, '#8a8f86', '#5a5e58');
  water(gp, clipR([[-0.46, 0.1], [-0.2, 0.14], [0.1, 0.13], [0.46, 0.08], [0.46, 0.3], [0.1, 0.33], [-0.2, 0.33], [-0.46, 0.3]], 0.455), h0, '#4a6f7f');
  prism(gp, clipR([[-0.46, 0.06], [-0.2, 0.1], [0.1, 0.09], [0.46, 0.04], [0.46, 0.08], [0.1, 0.13], [-0.2, 0.14], [-0.46, 0.1]], 0.455), h0, 0.008, '#b8b2a6');
  for (let i = 0; i < 16; i++) { const x = -0.4 + i * 0.053; cyl(gp, '#3e6a32', x, h0 + 0.008, 0.095 - Math.max(0, x) * 0.08 + 0.01, 0.009, 0.022, 6); }
  // the Bund side promenade in front
  prism(gp, clipR([[-0.46, 0.33], [0.46, 0.3], [0.46, 0.46], [-0.46, 0.46]], 0.455), h0, 0.012, '#a8a294');
  box(gp, '#d8d4ca', 0, h0 + 0.012, 0.335, 0.6, 0.012, 0.006);
  for (let i = 0; i < 6; i++) person(gp, -0.25 + i * 0.1, h0 + 0.012, 0.37 + (i % 2) * 0.025, { h: 0.045, pose: i % 3 === 1 ? 'photo' : 'relax', top: ['#d94f3a', '#2f6fb0', '#f2f2f2', '#3a8a5a', '#e8c13a', '#6a4a8a'][i], bottom: '#2a2a3a', ry: Math.PI + (i % 2 ? 0.3 : -0.3) });
  // tour boat
  const bt = grp(gp, 0.18, 0.22, 0.12);
  skin(bt, [-1, -0.6, 0, 0.6, 1].map(t => { const w = 0.022 * (1 - Math.abs(t) ** 3 * 0.7); return [[t * 0.1, h0 + 0.004, -w * 0.7], [t * 0.1, h0 + 0.014, -w], [t * 0.1, h0 + 0.014, w], [t * 0.1, h0 + 0.004, w * 0.7]] as V3[]; }), '#f2f2f2', { caps: true });
  pbox(bt, -0.01, h0 + 0.014, 0, 0.13, 0.016, 0.036, [8, 1, 2], '#f2f2f2', (_x, y, _z, _nx, ny) => ny > 0.5 ? '#c81e1e' : y > -0.004 && y < 0.005 ? '#ffd27a' : '#f2f2f2');
  pbox(bt, -0.01, h0 + 0.03, 0, 0.1, 0.012, 0.03, [6, 1, 2], '#f2f2f2', (_x, y, _z, _nx, ny) => ny > 0.5 ? '#c81e1e' : Math.abs(y) < 0.003 ? '#ffd27a' : '#f2f2f2');
  // ---- Oriental Pearl Tower (东方明珠): three columns, three raked legs, pink spheres
  const ox = -0.22, oz = -0.02, pink = '#c8507a';
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + Math.PI / 2;
    rod(gp, [ox + Math.cos(a) * 0.016, h0, oz + Math.sin(a) * 0.016], [ox + Math.cos(a) * 0.012, h0 + 0.38, oz + Math.sin(a) * 0.012], 0.0065, '#e4e0d6', 8);
    rod(gp, [ox + Math.cos(a + Math.PI / 3) * 0.075, h0, oz + Math.sin(a + Math.PI / 3) * 0.075], [ox + Math.cos(a + Math.PI / 3) * 0.02, h0 + 0.09, oz + Math.sin(a + Math.PI / 3) * 0.02], 0.005, '#e4e0d6', 6);
    ellip(gp, pink, ox + Math.cos(a) * 0.014, h0 + 0.24, oz + Math.sin(a) * 0.014, 0.011).material = mat(pink, { metal: 0.5, rough: 0.25 });
  }
  for (const [y, r2] of [[0.1, 0.045], [0.33, 0.036], [0.465, 0.014]] as const) {
    ellip(gp, pink, ox, h0 + y, oz, r2).material = mat(pink, { metal: 0.5, rough: 0.25 });
    cyl(gp, '#cfd3d6', ox, h0 + y - 0.004, oz, r2 * 1.03, 0.008, 16);
  }
  rod(gp, [ox, h0 + 0.36, oz], [ox, h0 + 0.46, oz], 0.007, '#e4e0d6', 8);
  rod(gp, [ox, h0 + 0.47, oz], [ox, h0 + 0.62, oz], 0.0035, '#d8d4ca', 6);
  // ---- Jin Mao Tower (金茂): stepped pagoda-like setbacks and a spire
  const jx = 0.0, jz = -0.16, jm = '#6f7a78';
  let jy = h0, jw = 0.06;
  for (let i = 0; i < 13; i++) {
    const th = i < 4 ? 0.07 : 0.045 - i * 0.002;
    const oct: [number, number][] = [];
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; oct.push([jx + Math.cos(a) * jw / 2 / Math.cos(Math.PI / 8), jz + Math.sin(a) * jw / 2 / Math.cos(Math.PI / 8)]); }
    pbox(gp, jx, jy, jz, jw, th, jw, [4, Math.round(th / 0.008), 4], jm, glass(jm, 0.008, 0.008));
    prism(gp, oct.map(([x, z]) => [jx + (x - jx) * 1.12, jz + (z - jz) * 1.12] as [number, number]), jy + th - 0.003, 0.004, '#b8b4aa');
    jy += th; jw *= i < 4 ? 0.95 : 0.9;
  }
  lathe(gp, [[jw * 0.6, 0], [jw * 0.4, 0.03], [0.003, 0.09], [0, 0.1]], '#9aa0a6', jx, jy, jz, 8);
  // ---- Shanghai World Financial Center (环球金融中心): square base tapering to a blade with the trapezoid opening
  const sx = 0.13, sz = -0.13, SH = 0.64;
  const swfc: V3[][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * 0.86, ex = 0.048 * (1 - 0.08 * t), ez = 0.048 * (1 - 0.9 * t), c = 0.012 * (1 - t);
    swfc.push([[ex, ez - c], [ex - c, ez], [-ex + c, ez], [-ex, ez - c], [-ex, -ez + c], [-ex + c, -ez], [ex - c, -ez], [ex, -ez + c]].map(([x, z]) => {
      const a = Math.PI / 4 - 0.4, ca = Math.cos(a), sa = Math.sin(a);
      return [sx + x * ca - z * sa, h0 + t * SH, sz + x * sa + z * ca] as V3;
    }));
  }
  skin(gp, swfc, '#8fa6b5', { caps: true, paint: (_x, y) => ((y - h0) * 90) % 1 < 0.15 ? '#6f8494' : '#a6bccb', metal: 0.4, rough: 0.2 });
  {
    const a = Math.PI / 4 - 0.4, top = grp(gp, sx, sz, -a, h0 + 0.86 * SH), ex = 0.048 * (1 - 0.08 * 0.86), oh = SH * 0.14;
    for (const s of [-1, 1]) box(top, '#9fb5c4', s * (ex - 0.01), 0, 0, 0.02, oh, 0.0062);
    box(top, '#9fb5c4', 0, oh - 0.012, 0, ex * 2 - 0.004, 0.012, 0.0062);
  }
  // ---- Shanghai Tower (上海中心): rounded triangle twisting 120° as it tapers, notch up one side
  const tx = 0.05, tz = -0.03, TH = 0.82;
  const tw: V3[][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, rot = t * Math.PI * 2 / 3, R0 = 0.052 * (1 - 0.42 * t), ring: V3[] = [];
    for (let k = 0; k < 30; k++) {
      const ph = (k / 30) * Math.PI * 2;
      const dn = ((ph - rot - Math.PI / 3 + Math.PI * 4) % (Math.PI * 2)) - Math.PI;
      const r2 = R0 * (1 + 0.11 * Math.cos(3 * (ph - rot))) * (1 - 0.18 * Math.exp(-(dn * dn) * 30));
      ring.push([tx + Math.cos(ph) * r2, h0 + t * TH, tz + Math.sin(ph) * r2]);
    }
    tw.push(ring);
  }
  skin(gp, tw, '#9db3c0', { caps: true, metal: 0.45, rough: 0.2, paint: (_x, y) => ((y - h0) * 60) % 1 < 0.12 ? '#7a909d' : '#b2c6d2' });
  // ---- the rest of the glass city
  const towers: [number, number, number, number, number, string][] = [
    [-0.36, -0.2, 0.06, 0.26, 0.05, '#6f8a9a'], [-0.3, -0.33, 0.05, 0.34, 0.05, '#8a9aa6'], [-0.12, -0.3, 0.06, 0.4, 0.05, '#5f7a8a'],
    [-0.07, -0.05, 0.05, 0.22, 0.05, '#9aa6ad'], [0.25, -0.26, 0.05, 0.36, 0.05, '#7d8f9e'], [0.32, -0.08, 0.06, 0.28, 0.06, '#5c7486'],
    [0.21, 0.0, 0.05, 0.18, 0.04, '#a3b1b8'], [-0.36, 0.0, 0.06, 0.15, 0.05, '#b8b0a2'], [0.38, -0.25, 0.05, 0.22, 0.05, '#8a9aa6'],
    [-0.2, -0.22, 0.05, 0.3, 0.05, '#7f97a6'], [0.08, -0.32, 0.06, 0.3, 0.05, '#6c8292'], [-0.27, 0.06, 0.05, 0.1, 0.04, '#c9c2b2'],
  ];
  for (const [x, z, w, h, d, c] of towers) {
    pbox(gp, x, h0, z, w, h, d, [4, Math.round(h / 0.012), 4], c, glass(c), 0.15, { metal: 0.35, rough: 0.25 });
    box(gp, '#5a5e64', x, h0 + h, z, w * 0.6, 0.008, d * 0.6);
  }
};

const dam: Builder = gp => {
  // Three Gorges Dam (三峡大坝): straight concrete gravity dam across the Yangtze gorge, central spillway with white
  // jets, powerhouses at both toes, crest gantry cranes, the reservoir behind and the five-step double ship lock
  const h0 = ground(gp, 0.46, '#6f7a50', '#5a4a34');
  const WL = 0.16, CR = 0.18, zd = -0.04, x0 = -0.17, x1 = 0.43;
  // mountains framing the gorge
  lump(gp, -0.31, h0, -0.29, 0.14, 0.3, 0.13, '#6b7a4a', { seed: 1, rough: 0.25, paint: rockPaint('#8a826e', '#5a7040', 1) });
  lump(gp, 0.32, h0, -0.28, 0.12, 0.32, 0.14, '#6b7a4a', { seed: 2, rough: 0.25, paint: rockPaint('#8a826e', '#5a7040', 2) });
  lump(gp, 0.04, h0, -0.42, 0.22, 0.22, 0.06, '#6b7a4a', { seed: 5, rough: 0.25, paint: rockPaint('#8a826e', '#5a7040', 5) });
  lump(gp, 0.34, h0, 0.2, 0.08, 0.16, 0.12, '#6b7a4a', { seed: 3, rough: 0.25, paint: rockPaint('#8a826e', '#5a7040', 3) });
  lump(gp, -0.39, h0, 0.17, 0.05, 0.14, 0.1, '#6b7a4a', { seed: 4, rough: 0.25, paint: rockPaint('#8a826e', '#5a7040', 4) });
  // reservoir and the downstream river
  water(gp, clipR([[x0 - 0.02, zd - 0.03], [x1, zd - 0.03], [0.46, -0.2], [0.2, -0.38], [-0.1, -0.4], [-0.34, -0.2], [-0.34, zd - 0.03]], 0.455), h0, '#3f6f7f', WL);
  water(gp, clipR([[x0, zd + 0.1], [0.38, zd + 0.1], [0.32, 0.25], [0.2, 0.46], [-0.05, 0.46], [-0.12, 0.25]], 0.455), h0, '#4f7f86', 0.012);
  // dam body: vertical upstream face, sloped downstream face (profile in the YZ plane, extruded along x)
  const DL = x1 - x0, xm = (x0 + x1) / 2;
  const D = grp(gp, xm, zd, Math.PI / 2);
  const body = slab(D, [[0.012, 0], [0.012, CR], [-0.012, CR], [-0.012, CR - 0.02], [-0.13, 0]], DL, P.concrete, 0, false);
  body.geometry = paintFaces(body.geometry, P.concrete, (x, y, z, _nx, ny) => ny > 0.3 && ny < 0.95 ? shade(P.concrete, 0.88 + 0.12 * (Math.floor((z + 2) * 60) % 2)) : shade(P.concrete, 0.95 + hash3(Math.floor(x * 50), Math.floor(y * 50), 2) * 0.08));
  body.material = mat('#ffffff', { vc: true });
  // crest road, parapets, lamp posts, gantry cranes
  box(gp, '#9a968c', xm, h0 + CR, zd, DL + 0.01, 0.006, 0.03);
  for (const s of [-1, 1]) box(gp, '#e4e0d6', xm, h0 + CR + 0.006, zd + s * 0.014, DL, 0.006, 0.003);
  for (const x of [0.0, 0.1, 0.27]) {
    for (const s of [-1, 1]) for (const t of [-1, 1]) rod(gp, [x + s * 0.015, h0 + CR, zd + t * 0.012], [x + s * 0.015, h0 + CR + 0.05, zd + t * 0.012], 0.0025, '#d9a62a', 4);
    box(gp, '#d9a62a', x, h0 + CR + 0.05, zd, 0.04, 0.008, 0.032);
    box(gp, '#b3261e', x, h0 + CR + 0.058, zd, 0.018, 0.012, 0.018);
  }
  // central spillway: 23 deep outlets with white jets plunging into a foaming stilling basin
  const sx0 = 0.04, sx1 = 0.24, slope = Math.atan2(CR - 0.02, 0.13 - 0.012);
  for (let i = 0; i < 9; i++) {
    const x = sx0 + (i + 0.5) * ((sx1 - sx0) / 9);
    box(gp, '#2a2e33', x, h0 + 0.09, zd + 0.06, 0.012, 0.016, 0.004, 0, -(Math.PI / 2 - slope));
    const jet = tube(gp, [[x, h0 + 0.095, zd + 0.068], [x, h0 + 0.08, zd + 0.1], [x, h0 + 0.045, zd + 0.13], [x, h0 + 0.015, zd + 0.15]], 0.006, 0.01, '#f4f8f8', { radial: 6, sub: 3 });
    jet.material = mat('#f4f8f8', { transparent: 0.8 });
  }
  for (let i = 0; i < 14; i++) {
    const x = sx0 + (i / 13) * (sx1 - sx0);
    ellip(gp, '#ffffff', x, h0 + 0.014, zd + 0.15 + (i % 3) * 0.02, 0.022, 0.012 + (i % 2) * 0.006, 0.018).material = mat('#ffffff', { transparent: 0.85 });
  }
  smoke(gp, (sx0 + sx1) / 2, h0 + 0.03, zd + 0.17, 0.05, '#ffffff', 6, 0.45);
  // powerhouses at the left and right toe (bays of generator units with blue-grey roofs)
  for (const [xa, xb] of [[x0 + 0.01, sx0 - 0.01], [sx1 + 0.01, x1 - 0.02]] as const) {
    const w = xb - xa;
    pbox(gp, (xa + xb) / 2, h0, zd + 0.13, w, 0.05, 0.05, [Math.round(w / 0.02), 3, 2], '#d8d4ca', (x, y, _z, _nx, ny, nz) => ny > 0.5 ? '#5a7a8f' : nz > 0.5 && y > -0.005 && ((x + 4) / 0.024) % 1 < 0.5 ? '#6a8aa0' : '#d8d4ca');
    for (let k = 0; k < Math.round(w / 0.03); k++) box(gp, '#3a3e44', xa + 0.015 + k * 0.03, h0 + 0.002, zd + 0.158, 0.012, 0.012, 0.003);
  }
  // five-step double-lane ship lock (五级船闸) on the left bank, water stepping down from reservoir to river
  const lx = [-0.3, -0.24], LZ0 = -0.22, LZ1 = 0.28, nS = 5, cl = (LZ1 - LZ0) / nS;
  prism(gp, clipR([[-0.4, LZ0], [-0.18, LZ0], [-0.18, LZ1], [-0.36, LZ1 + 0.02], [-0.4, LZ1]], 0.455), h0, 0.08, '#7a7a58');
  for (let i = 0; i < nS; i++) {
    const z = LZ0 + (i + 0.5) * cl, wl = WL - (i + 0.5) * (WL - 0.012) / nS;
    for (const x of lx) {
      water(gp, [[x - 0.024, z - cl / 2], [x + 0.024, z - cl / 2], [x + 0.024, z + cl / 2], [x - 0.024, z + cl / 2]], h0, '#3f6f7f', wl);
      box(gp, '#2a2e33', x, h0, z - cl / 2, 0.048, CR * 0.95 - i * 0.02, 0.006);
    }
    for (const x of [-0.327, -0.27, -0.213]) box(gp, P.concrete, x, h0, z, 0.006 + (x === -0.27 ? 0.008 : 0), CR - i * 0.025, cl);
    if (i % 2 === 0) for (const [k, x] of lx.entries()) {
      const sy = h0 + wl;
      rbox(gp, k ? '#2f5a8a' : '#b3261e', x, sy, z + 0.004, 0.028, 0.008, 0.07, 0.003);
      box(gp, '#f2f2f2', x, sy + 0.008, z + 0.024, 0.02, 0.012, 0.014);
    }
  }
  // a river cruiser below the dam
  rbox(gp, '#f2f2f2', 0.12, h0 + 0.008, 0.32, 0.03, 0.012, 0.09, 0.004);
  rbox(gp, '#f2f2f2', 0.12, h0 + 0.02, 0.31, 0.024, 0.014, 0.05, 0.003);
};

export const RICH2: Record<string, Builder> = { cave, stilt, jade, oracle, weir, train, factory, rocket, stadium, skyline, dam };
