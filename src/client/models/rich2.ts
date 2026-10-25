import * as THREE from 'three';
import {
  type Builder, type V3, type Paint, add, g, mat, box, tbox, cyl, cone, rbox, rod, skin, slab, lathe, prism, gable, tube, sweep, shade, mix,
  hash3, fbm, paintFaces, panel, plinth, tree, SITE,
} from './prims.ts';
import { human, type HumanOpts } from './human.ts';
import { grp, minipine } from './timber.ts';

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

const SITES = Object.values(SITE);
const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
/** The SITE tone nearest to `c` (old per-model ground colours snap to the shared site palette). */
function siteTone(c: string): string {
  const a = rgb(c);
  let best: string = SITE.earth, bd = Infinity;
  for (const s of SITES) { const b = rgb(s), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = s; } }
  return best;
}
/** The shared museum plinth (prims `plinth`: dark walnut side, SITE top). Returns the top height. */
function ground(p: THREE.Object3D, R: number, top: string, _side?: string, h = 0.03, paint?: Paint): number {
  return plinth(p, siteTone(top), { R: Math.min(R, 0.46), h, paint });
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
/** Like pbox, but only the four walls are finely subdivided (cell ≈ q); top and bottom are single quads. */
function fbox(p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, q: number, c: string, paint: Paint, ry = 0): THREE.Mesh {
  const nw = Math.min(90, Math.ceil(w / q)), nh = Math.min(60, Math.ceil(h / q)), nd = Math.min(90, Math.ceil(d / q));
  const parts: THREE.BufferGeometry[] = [];
  const face = (pw: number, ph: number, sw: number, sh: number, m: THREE.Matrix4) => parts.push(new THREE.PlaneGeometry(pw, ph, sw, sh).applyMatrix4(m).toNonIndexed());
  const M = (rx: number, ryy: number, tx: number, ty: number, tz: number) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ryy, 0)).setPosition(tx, ty, tz);
  face(w, h, nw, nh, M(0, 0, 0, 0, d / 2));
  face(w, h, nw, nh, M(0, Math.PI, 0, 0, -d / 2));
  face(d, h, nd, nh, M(0, Math.PI / 2, w / 2, 0, 0));
  face(d, h, nd, nh, M(0, -Math.PI / 2, -w / 2, 0, 0));
  face(w, d, 1, 1, M(-Math.PI / 2, 0, 0, h / 2, 0));
  face(w, d, 1, 1, M(Math.PI / 2, 0, 0, -h / 2, 0));
  const n = parts.reduce((a, g2) => a + g2.getAttribute('position').count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g2 of parts) { pos.set(g2.getAttribute('position').array as Float32Array, o); nor.set(g2.getAttribute('normal').array as Float32Array, o); o += g2.getAttribute('position').count * 3; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return add(p, paintFaces(geo, c, paint), mat('#ffffff', { vc: true }), x, y + h / 2, z, 1, 1, 1, ry);
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
/** Vertical extrusion of a floor plan [x, z][] painted per face (paint gets model-local coords, y from 0 to h). */
function pprism(p: THREE.Object3D, plan: [number, number][], y: number, h: number, c: string, paint?: Paint): THREE.Mesh {
  const eg = new THREE.ExtrudeGeometry(new THREE.Shape(plan.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false, curveSegments: 4 });
  eg.rotateX(-Math.PI / 2);
  eg.computeVertexNormals();
  return add(p, paintFaces(eg, c, paint), mat('#ffffff', { vc: true, flat: true }), 0, y, 0, 1, 1, 1);
}
/** Broadleaf tree: the shared natural tree (prims `tree`), sized like the old crown. */
function leafTree(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, _seed = 0): void {
  tree(p, x, y, z, s * 0.6, c);
}
function shrub(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, seed = 0): void {
  lump(p, x, y, z, s, s * 0.6, s, c, { seed, detail: 1, rough: 0.3, paint: (px, py, pz) => shade(c, 0.78 + fbm(px * 4 + seed, py * 4, pz * 4, 2) * 0.45) });
}

const cave: Builder = gp => {
  // Zhoukoudian Locality 1 (周口店第一地点, 龙骨山 "Dragon Bone Hill", c. 700–200 ka): a hill of grey Ordovician
  // limestone in thick, slightly tilted beds, weathered buff and rust-stained; the cave opened on its east face.
  // Peking Man left ash layers (hearths), quartz flakes and deer bones (肿骨鹿) at the mouth. Ref: zh/en Wikipedia
  // "周口店北京人遗址" / "Zhoukoudian"; site museum reconstruction. Scale ≈ 0.05 / m (people ≈ 1.5 m).
  const R = 0.445, h0 = ground(gp, 0.46, '#9a8662', '#6a5a40');
  const lime = '#a7a296', xm = -0.04, mw = 0.12, mh = 0.2, depth = 0.15;
  const nL = 10, lh = 0.032;
  const hw = (yy: number) => (yy < mh ? mw * Math.sqrt(1 - (yy / mh) ** 2) : 0);
  for (let j = 0; j < nL; j++) {
    const y0 = j * lh, ym = y0 + lh / 2, tilt = (hash3(j, 3, 1) - 0.5) * 0.02;
    const fz = (x: number) => -0.02 - (x / R) ** 2 * 0.12 - ym * (0.12 + 0.9 * Math.max(0, ym - 0.18)) + tilt
      + (fbm(x * 7 + j * 0.37, j * 0.9, 2.3, 3) - 0.5) * 0.05 + x * 0.04;
    const half = hw(ym), pts: [number, number][] = [], N = 120;
    const ax = 0.47 - ym * 0.7, azb = 0.27 - ym * 0.35, zc = -0.2;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2, n = 1 + (fbm(Math.cos(th) * 2 + j * 0.3, Math.sin(th) * 2, j * 0.5, 2) - 0.5) * 0.18;
      const x = Math.cos(th) * ax * n;
      let z = zc + Math.sin(th) * (Math.sin(th) > 0 ? 0.6 : azb * n);
      const f0 = fz(x);
      if (z > f0) {
        z = f0;
        if (half > 0 && Math.abs(x - xm) < half) z -= depth * Math.sqrt(1 - ((x - xm) / half) ** 2) + 0.01;
      }
      const d = Math.hypot(x, z);
      pts.push(d > R ? [x * R / d, z * R / d] : [x, z]);
    }
    pprism(gp, pts, h0 + y0, lh + 0.002, lime, (x, y, z, _nx, ny) => {
      const front = fz(x);
      if (half > 0 && Math.abs(x - xm) < half + 0.004 && z < front - 0.012) return mix('#3a3128', '#120e0b', Math.min(1, (front - z) / depth));
      if (ny > 0.5) return mix('#8d8a5a', '#a99a72', fbm(x * 9, j, z * 9, 2));
      const n = fbm(x * 10, (y + y0) * 26, z * 10, 3), st = fbm(x * 22, y0 * 3, 1, 2);
      const band = y < lh * 0.18 ? 0.8 : 1;
      let col = shade(j % 3 === 1 ? '#b0aa9c' : lime, (0.8 + n * 0.32) * band);
      if (st > 0.6) col = mix(col, '#a07a4e', (st - 0.6) * 1.6);
      return col;
    });
  }
  // dark cave interior: floor and back
  prism(gp, [[xm - mw, -0.05], [xm + mw, -0.05], [xm + mw * 0.7, -0.18], [xm - mw * 0.7, -0.18]], h0 + 0.001, 0.004, '#2a221b');
  box(gp, '#120e0b', xm, h0, -0.2, mw * 1.6, mh * 0.9, 0.01);
  // hill crest above the cliff: soil, grass, hackberry (朴树, its seeds were found in the cave) and shrubs
  lump(gp, 0, h0 + nL * lh - 0.035, -0.23, 0.25, 0.075, 0.14, '#7d7a4e', { seed: 9, rough: 0.2, detail: 3, paint: (x, y, z) => mix('#7a7a4a', '#9a8a5e', fbm(x * 5, y * 5, z * 5, 2)) });
  leafTree(gp, -0.16, h0 + nL * lh, -0.33, 0.16, '#5f6e3a', 1);
  leafTree(gp, 0.15, h0 + nL * lh, -0.36, 0.13, '#68703e', 2);
  // ground: loess, trampled darker soil at the mouth
  ellip(gp, '#7e6c4c', -0.03, h0 + 0.0005, 0.06, 0.16, 0.002, 0.1);
  for (const [x, z, s, k] of [[-0.05, -0.24, 0.05, 3], [0.2, -0.27, 0.045, 4], [-0.24, -0.25, 0.04, 5], [0.03, -0.33, 0.04, 6]] as const) {
    shrub(gp, x, h0 + nL * lh, z, s, '#62683c', k);
  }
  // talus and fallen blocks under the face, with angular limestone
  for (const [x, z, s, k] of [[-0.3, 0.06, 0.06, 1], [0.27, 0.04, 0.05, 2], [0.36, -0.06, 0.07, 3], [-0.37, -0.04, 0.05, 4], [0.17, 0.1, 0.03, 5], [-0.2, 0.12, 0.025, 6]] as const) {
    lump(gp, x, h0, z, s, s * 0.7, s * 0.8, lime, { seed: k, detail: 0, rough: 0.25, paint: rockPaint('#a29d90', '#7a7a4a', k) });
  }
  // the hearth at the mouth: grey-white ash spread, a ring of stones, burning branches, smoke
  const fx = -0.03, fz2 = 0.08, y1 = h0 + 0.002;
  ellip(gp, '#a39d90', fx, y1, fz2, 0.045, 0.003, 0.036);
  ellip(gp, '#4a4038', fx, y1 + 0.001, fz2, 0.026, 0.003, 0.022);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; lump(gp, fx + Math.cos(a) * 0.03, y1, fz2 + Math.sin(a) * 0.025, 0.008, 0.006, 0.007, '#6d6558', { seed: i, detail: 0, rough: 0.2 }); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI + 0.3; rod(gp, [fx + Math.cos(a) * 0.03, y1 + 0.002, fz2 + Math.sin(a) * 0.024], [fx - Math.cos(a) * 0.006, y1 + 0.014, fz2 - Math.sin(a) * 0.005], 0.0032, '#3b2a1c', 4); }
  flame(gp, fx, y1 + 0.004, fz2, 0.04);
  smoke(gp, fx, y1 + 0.05, fz2 - 0.01, 0.025, '#8a847a', 5, 0.45);
  // Peking Man (Homo erectus pekinensis): ~1.5 m, robust, hide wraps, barefoot
  const hom = { skin: '#8a6244', hair: '#2a1d14', top: '#6b4f36', bottom: '#5e4530', shoes: '#7a5438', sleeve: 0, shorts: true, build: 1.15 };
  person(gp, fx + 0.05, h0, fz2 + 0.02, { ...hom, h: 0.07, pose: 'crouch', ry: -1.9 });
  const st = person(gp, -0.17, h0, 0.12, { ...hom, h: 0.078, pose: 'relax', ry: 0.6 });
  rod(gp, [st.handR[0], h0 + 0.003, st.handR[2] + 0.004], [st.handR[0] + 0.006, st.handR[1] + 0.06, st.handR[2]], 0.0025, '#6b4a2a', 4);
  person(gp, 0.08, h0, 0.17, { ...hom, top: '#75573a', h: 0.072, pose: 'sitGround', ry: -2.4 });
  // a carcass brought back: deer leg bones and the thick palmate antler of the 肿骨鹿, quartz flakes and a hammerstone
  const bone = (x: number, z: number, L: number, a: number) => {
    const dx = Math.cos(a) * L / 2, dz = Math.sin(a) * L / 2;
    rod(gp, [x - dx, h0 + 0.004, z - dz], [x + dx, h0 + 0.004, z + dz], 0.003, '#c4b592', 5);
    for (const s of [-1, 1]) ellip(gp, '#c4b592', x + s * dx, h0 + 0.005, z + s * dz, 0.0045, 0.0035, 0.004);
  };
  bone(0.16, 0.2, 0.04, 0.4); bone(0.2, 0.16, 0.035, 2.1); bone(-0.1, 0.2, 0.03, 1.2);
  const ant = grp(gp, 0.22, 0.24, -0.4, h0 + 0.004);
  tube(ant, [[0, 0, 0], [0.02, 0.006, 0.004], [0.04, 0.014, 0.0]], 0.0045, 0.006, '#bba982', { radial: 5, sub: 3 });
  ellip(ant, '#bba982', 0.05, 0.016, 0, 0.016, 0.004, 0.012, 0.3);
  for (let i = 0; i < 5; i++) lump(gp, -0.08 + i * 0.022, h0, 0.25 + (i % 2) * 0.015, 0.006, 0.004, 0.005, i % 2 ? '#e8e2d4' : '#cfc6b4', { seed: i + 20, detail: 0, rough: 0.3 });
};

const stilt: Builder = gp => {
  // Hemudu (河姆渡, c. 5000–4500 BC) 干栏式 long house: a row of piles driven into the lakeside marsh carries a floor
  // ~1 m up, mortise-and-tenon (榫卯) beams and tongue-and-groove boards, reed-mat walls, a 1.3 m front veranda and a
  // long-ridged steep thatched gable roof; rice paddies and dugouts nearby. Ref: zh Wikipedia "河姆渡遗址",
  // Baidu Baike "干栏式房屋", Hemudu site museum reconstruction. Scale ≈ 0.06 / m (people ≈ 1.6 m).
  const h0 = ground(gp, 0.46, '#6f7546', '#5a4a34');
  water(gp, discPart(0.44, 0.06), h0, '#4f7a78');
  // reeds along the water edge
  for (let i = 0; i < 14; i++) {
    const x = -0.4 + hash3(i, 2, 7) * 0.12 + (i > 6 ? 0.7 : 0), z = 0.08 + hash3(i, 5, 1) * 0.12;
    cone(gp, i % 3 ? '#8a9a4a' : '#a8a05a', x, h0, z, 0.006, 0.06 + hash3(i, 1, 1) * 0.04, 4);
  }
  // a small rice paddy (wet field with rows of ripening clumps) at the front left, bounded by a low earth bund
  prism(gp, [[-0.36, 0.17], [-0.17, 0.17], [-0.17, 0.35], [-0.3, 0.33]], h0, 0.006, '#6d6a44');
  water(gp, [[-0.35, 0.18], [-0.18, 0.18], [-0.18, 0.34], [-0.3, 0.32]], h0 + 0.002, '#5d7a62');
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const x = -0.33 + i * 0.033 + (j % 2) * 0.008, z = 0.2 + j * 0.035;
    if (x > -0.19 || (x < -0.31 && z > 0.29)) continue;
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i, lx = Math.cos(a) * 0.006, lz = Math.sin(a) * 0.006;
      rod(gp, [x, h0 + 0.006, z], [x + lx, h0 + 0.034, z + lz], 0.0022, k ? '#8a9a48' : '#9a9a50', 3);
      ellip(gp, '#c2a654', x + lx * 1.6, h0 + 0.032, z + lz * 1.6, 0.003, 0.007, 0.003, 0, lz * 60, -lx * 60);
    }
  }
  const L = 0.6, zc = -0.08, D = 0.28, Fy = h0 + 0.075;
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
  const reed: Paint = (x, y, z) => shade('#9c865a', (0.82 + hash3(Math.floor((x + z) * 260), 1, 1) * 0.2) * (Math.floor(y * 90) % 4 === 0 ? 0.86 : 1));
  pbox(H, 0, wy, wz0, L - 0.04, wh, 0.01, [60, 6, 1], '#9c865a', reed);
  for (const s of [-1, 1]) pbox(H, s * (L / 2 - 0.025), wy, (wz0 + wz1) / 2, 0.01, wh, wz1 - wz0, [1, 6, 20], '#9c865a', reed);
  const door = (cx: number) => { const pth = new THREE.Path(); pth.moveTo(cx - 0.025, 0); pth.lineTo(cx + 0.025, 0); pth.lineTo(cx + 0.025, 0.075); pth.lineTo(cx - 0.025, 0.075); pth.closePath(); return pth; };
  panel(H, L - 0.04, wh, 0.01, '#9a845a', [door(-0.14), door(0.12)], 0, wy, wz1);
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
  const straw = (s: number): Paint => (x, _y, z, _nx, ny) => {
    if (ny < -0.5) return shade(P.thatch, 0.5);
    const t = (s * z + sLen / 2) / sLen, f = (t * 7) % 1;
    return shade('#a89060', (0.72 + 0.32 * f) * (0.86 + hash3(Math.floor(x * 120), Math.floor(t * 7), 2) * 0.22));
  };
  for (const s of [-1, 1]) {
    const geo = paintFaces(new THREE.BoxGeometry(RW, 0.026, sLen, 48, 1, 28), P.thatch, straw(s));
    add(H, geo, mat('#ffffff', { vc: true }), 0, Ry + RH / 2 - 0.006, zr + s * (RD / 4 + 0.006), 1, 1, 1, 0, s * sl);
  }
  const ridge = cyl(H, '#8f7a48', 0, 0, zr, 0.016, RW + 0.01, 8);
  ridge.rotation.z = Math.PI / 2; ridge.position.set(0, Ry + RH + 0.004, zr);
  for (let k = 0; k < 7; k++) { const b2 = cyl(H, '#5e4a2c', 0, 0, zr, 0.018, 0.006, 8); b2.rotation.z = Math.PI / 2; b2.position.set(-RW / 2 + 0.04 + k * ((RW - 0.08) / 6), Ry + RH + 0.004, zr); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) rod(H, [s * (RW / 2 - 0.01), Ry + RH - 0.04, zr - t * 0.04], [s * (RW / 2 - 0.01), Ry + RH + 0.06, zr + t * 0.06], 0.004, '#4a3222', 4);
  // sheaves of rice hanging under the eaves
  for (let i = 0; i < 4; i++) cone(H, '#d4b04a', -0.27 + i * 0.03, Fy + 0.02, D / 2 + 0.03, 0.008, 0.04, 5).rotation.x = Math.PI;
  // notched-log ladder (独木梯) from the marsh to the veranda
  const lx = 0.2, lz0 = D / 2 + 0.06;
  rod(H, [lx, h0, lz0], [lx, Fy + 0.012, D / 2], 0.007, '#5e4128', 6);
  for (let k = 1; k < 4; k++) { const t = k / 4; box(H, '#3e2a1a', lx, h0 + (Fy - h0) * t, lz0 + (D / 2 - lz0) * t + 0.006, 0.012, 0.003, 0.004); }
  // people: woman on the veranda, man at the mortar husking rice, fisher in a dugout
  person(H, -0.06, Fy, 0.1, { h: 0.1, pose: 'relax', top: '#9a8456', bottom: '#7a6a44', dress: 'ankle', sleeve: 0.4 });
  const mx = -0.05, mz = 0.2;
  prism(gp, [[-0.14, 0.1], [0.3, 0.06], [0.33, 0.16], [0.12, 0.22], [-0.02, 0.27], [-0.14, 0.22]], h0, 0.006, '#6a6240', 0, true);
  lathe(H, [[0, 0], [0.018, 0], [0.02, 0.03], [0.012, 0.03], [0, 0.02]], '#6b4a2a', mx, h0 - 0.003, mz, 10);
  const m = person(H, mx + 0.04, h0, mz, { h: 0.105, pose: 'reach', top: '#8a6a42', bottom: '#6b5434', sleeve: 0.4, ry: -Math.PI / 2 });
  rod(H, [mx, h0 + 0.03, mz], [m.handR[0] - 0.004, m.handR[1] + 0.03, m.handR[2]], 0.004, '#8a6a42', 4);
  lathe(H, [[0, 0], [0.02, 0.003], [0.026, 0.02], [0.016, 0.034], [0.018, 0.038]], '#2a2622', -0.12, Fy, 0.05, 10);
  const canoe = grp(gp, 0.05, 0.33, 0.25, h0 + 0.004);
  sweep(canoe, [{ p: [-0.16, 0.014, 0], w: 0.004, h: 0.006 }, { p: [-0.12, 0.01, 0], w: 0.022, h: 0.012 }, { p: [0.1, 0.01, 0], w: 0.024, h: 0.012 }, { p: [0.16, 0.014, 0], w: 0.004, h: 0.006 }], '#5a3a22', { radial: 10, squash: 0.6 });
  ellip(canoe, '#2e1f14', 0, 0.02, 0, 0.12, 0.003, 0.016);
  const f = person(canoe, -0.02, 0.01, 0, { h: 0.09, pose: 'kneel', top: '#7a6a44', bottom: '#5a4a34', sleeve: 0.4, ry: Math.PI / 2 });
  rod(canoe, [f.handR[0], f.handR[1], f.handR[2]], [f.handR[0] + 0.04, -0.01, f.handR[2] + 0.04], 0.003, '#6e4f30', 4);
  leafTree(gp, -0.3, h0, -0.16, 0.28, '#56693a', 3);
  leafTree(gp, 0.33, h0, -0.2, 0.25, '#5d6e3c', 4);
  // a domestic pig (Hemudu pottery pigs show the type) rooting under the house
  const pig = grp(gp, -0.12, -0.02, 0.4, h0);
  ellip(pig, '#3a302a', 0, 0.022, 0, 0.032, 0.016, 0.014);
  ellip(pig, '#3a302a', 0.034, 0.02, 0, 0.012, 0.01, 0.01);
  cyl(pig, '#2a221e', 0.046, 0.014, 0, 0.005, 0.008, 6).rotation.z = Math.PI / 2;
  for (const [x, z] of [[-0.018, -0.007], [-0.018, 0.007], [0.018, -0.007], [0.018, 0.007]]) cyl(pig, '#2a221e', x, 0, z, 0.0035, 0.012, 5);
};

/** Translucent-looking jade: milky green with cloudy whitish and deeper-green patches and rare brown calcification. */
const jadePaint = (base: string, seed = 0): Paint => (x, y, z) => {
  const n = fbm(x * 18 + seed, y * 18, z * 18, 3), m = fbm(x * 6 - seed, y * 6, z * 6, 2), w = fbm(x * 9 + 3, y * 9 - seed, z * 9, 2);
  if (m > 0.64) return mix(base, '#9a7650', Math.min(1, (m - 0.64) * 3));
  if (w > 0.6) return mix(base, '#e4dfcc', Math.min(1, (w - 0.6) * 3.5));
  return n > 0.55 ? mix(base, '#d8dcc4', (n - 0.55) * 2) : mix(base, shade(base, 0.78), (0.55 - n) * 1.4);
};
const jadeMat = () => mat('#ffffff', { vc: true, rough: 0.22, metal: 0, flat: false });
function jadeGeo(p: THREE.Object3D, geo: THREE.BufferGeometry, base: string, x: number, y: number, z: number, seed = 0): THREE.Mesh {
  geo.computeVertexNormals();
  return add(p, paintFaces(geo, base, jadePaint(base, seed)), jadeMat(), x, y, z, 1, 1, 1);
}

const jade: Builder = (gp, r) => {
  // Liangzhu (良渚, c. 3300–2300 BC) ritual jades of tremolite nephrite, now mostly a milky green-white with ivory
  // "chicken-bone" whitening and brown iron stains: a 4-tier cong 琮 (square outside, round bore, collars at both ends,
  // each corner carved with the simplified 神人兽面 mask: two feather-crown bands, ringed eyes, a nose bar), a bi 璧
  // disc and a hafted yue 钺 axe, laid on the Yaoshan 瑶山 altar's three-coloured earth (red core, grey ditch, yellow
  // gravel). Ref: Zhejiang Museum / Liangzhu Museum "琮王" (Fanshan M12:98); zh Wikipedia "玉琮", "瑶山遗址".
  const J = str(r.color, '#b4b99a');
  const h0 = ground(gp, 0.46, '#5a4a38', '#3e3226');
  pbox(gp, 0, h0, 0, 0.7, 0.016, 0.5, [24, 1, 16], '#a48a5c', (x, _y, z) => shade('#a48a5c', 0.86 + hash3(Math.floor(x * 80), Math.floor(z * 80), 4) * 0.22));
  pbox(gp, 0, h0 + 0.016, 0, 0.64, 0.008, 0.44, [20, 1, 14], '#7c766a', (x, _y, z) => shade('#7c766a', 0.9 + hash3(Math.floor(x * 60), Math.floor(z * 60), 5) * 0.16));
  pbox(gp, 0, h0 + 0.024, 0, 0.56, 0.012, 0.36, [18, 1, 12], '#8e5a3e', (x, _y, z) => shade('#8e5a3e', 0.88 + fbm(x * 12, 1, z * 12, 2) * 0.24));
  const T = h0 + 0.036;
  // ---- cong 琮: 4 tapering tiers, corner masks (eyes, nose bar, feather-crown bands), round collars and bore
  const C = grp(gp, -0.1, -0.02, Math.PI / 4, T);
  const n = 4, th = 0.074, gap = 0.006;
  let y = 0;
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
      const sx = c & 1 ? 1 : -1, sz = c & 2 ? 1 : -1;
      // feather-crown bands and nose bar, wrapping round the corner (one strip on each of the two faces)
      for (const [dy, hh, c] of [[th - 0.012, 0.003, 1.18], [th - 0.02, 0.003, 1.18], [th * 0.14, 0.009, 1.08]] as const) {
        box(C, shade(J, c), sx * (w2 + 0.001), y + dy, sz * (w2 - 0.016), 0.003, hh, 0.032);
        box(C, shade(J, c), sx * (w2 - 0.016), y + dy, sz * (w2 + 0.001), 0.032, hh, 0.003);
      }
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
  // ---- bi 璧 discs, laid flat and overlapping as found in the Fanshan graves
  const prof: [number, number][] = [];
  for (let i = 0; i <= 8; i++) prof.push([0.032 + (i / 8) * 0.125, -0.008]);
  prof.push([0.16, 0], [0.157, 0.008]);
  for (let i = 8; i >= 0; i--) prof.push([0.032 + (i / 8) * 0.125, 0.008]);
  prof.push([0.03, 0], [0.032, -0.008]);
  const biGeo = () => new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 48);
  jadeGeo(gp, biGeo(), shade(J, 0.86), 0.16, T + 0.008, -0.07, 7).scale.set(0.72, 1, 0.72);
  const b2 = jadeGeo(gp, biGeo(), shade(J, 0.97), 0.1, T + 0.022, -0.03, 11);
  b2.scale.set(0.62, 1, 0.62); b2.rotation.set(0.05, 0, -0.1);
  // ---- yue 钺 axe: jade blade with drilled hole hafted on a lacquered handle with jade cap and end piece
  const Y0 = grp(gp, -0.03, 0.155, -Math.PI / 2 - 0.08, T + 0.008), Y = new THREE.Group();
  Y.rotation.x = -Math.PI / 2; Y0.add(Y);
  rod(Y, [0, 0.014, 0], [0, 0.22, 0], 0.006, '#5a2a1e', 8);
  for (let k = 0; k < 18; k++) ellip(Y, shade(J, 1.1), Math.sin(k * 2.4) * 0.005, 0.04 + k * 0.009, Math.cos(k * 2.4) * 0.005, 0.002);
  lathe(Y, [[0, 0], [0.012, 0], [0.014, 0.02], [0.006, 0.03], [0, 0.032]], shade(J, 1.05), 0, 0.22, 0, 10);
  lathe(Y, [[0, 0], [0.011, 0], [0.012, 0.02], [0, 0.022]], shade(J, 1.05), 0, 0.014, 0, 10);
  const sh = new THREE.Shape([[0.0, -0.045], [0.12, -0.065], [0.13, 0], [0.12, 0.065], [0, 0.045]].map(([a, b]) => new THREE.Vector2(a, b)));
  const hole = new THREE.Path(); hole.absarc(0.04, 0, 0.012, 0, Math.PI * 2, true); sh.holes.push(hole);
  const yg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 });
  yg.translate(0, 0, -0.003);
  yg.computeVertexNormals(); add(Y, paintFaces(yg, shade(J, 0.85), jadePaint(shade(J, 0.85), 5)), jadeMat(), -0.004, 0.15, 0, 1, 1, 1).rotation.y = Math.PI;
  // ---- string of jade tubes and beads, and a small three-pronged ornament
  for (let i = 0; i < 15; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 14)), x = Math.cos(a) * 0.1 - 0.17, z = 0.1 + Math.sin(a) * 0.04;
    if (i % 3 === 1) { const t = cyl(gp, shade(J, 1.05), x, T + 0.006, z, 0.007, 0.018, 8); t.rotation.set(Math.PI / 2, 0, 0); t.rotation.z = a; t.position.y = T + 0.007; }
    else ellip(gp, shade(J, 0.95 + hash3(i, 1, 1) * 0.2), x, T + 0.007, z, 0.007);
  }
  const tp = new THREE.Shape([[-0.04, 0], [0.04, 0], [0.04, 0.035], [0.026, 0.035], [0.026, 0.012], [0.007, 0.012], [0.007, 0.045], [-0.007, 0.045], [-0.007, 0.012], [-0.026, 0.012], [-0.026, 0.035], [-0.04, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)));
  const tg = new THREE.ExtrudeGeometry(tp, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 });
  const t3 = add(gp, tg, mat(shade(J, 1.1), { rough: 0.22, metal: 0 }), 0.215, T + 0.004, 0.08, 1, 1, 1, -0.5, -Math.PI / 2);
  t3.rotation.order = 'YXZ';
};

const oracle: Builder = gp => {
  // Shang oracle bones 甲骨 (Yinxu, c. 1250–1046 BC), shown at object scale on a herringbone reed mat: a polished
  // turtle plastron (anterior notch, sawn bridges, anal notch, scute sulci) with paired 卜-shaped heat cracks and
  // incised vertical inscriptions (some filled with cinnabar); a second plastron turned over to show rows of chiselled
  // oval 凿 hollows with drilled, scorched 钻 pits, one being burnt with a glowing thorn-wood rod from a grey-pottery
  // charcoal basin; a trimmed ox scapula (glenoid half cut away, spine shaved) also inscribed; a bronze knife and a
  // cinnabar dish. Ref: National Museum of China / Yinxu Museum plastra (e.g. 甲骨文合集 6834); zh Wikipedia "甲骨占卜".
  const h0 = ground(gp, 0.46, '#5e4c36', '#433526');
  const mat0 = h0 + 0.006;
  const mc = '#a48d62';
  pbox(gp, 0, h0, 0, 0.68, 0.006, 0.5, [56, 1, 40], mc, (x, _y, z) => {
    const col = Math.floor((x + 1) * 22), u = col % 2 ? x + z : x - z;
    return shade(mc, (Math.floor((u + 2) * 70) % 2 ? 0.86 : 1.02) * (col % 2 ? 0.97 : 1) * (Math.abs(x) > 0.32 || Math.abs(z) > 0.23 ? 0.8 : 1));
  });
  const BONE = '#cdbd98';
  const mirror = (half: [number, number][]): [number, number][] => [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number])];
  const hw = (half: [number, number][], z: number) => {
    for (let i = 0; i < half.length - 1; i++) {
      const [x0, z0] = half[i], [x1, z1] = half[i + 1];
      if ((z - z0) * (z - z1) <= 0 && z0 !== z1) return x0 + ((z - z0) / (z1 - z0)) * (x1 - x0);
    }
    return 0;
  };
  // incised strokes and 卜 cracks are flat strips laid on the bone surface
  const strip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, len: number, w: number, ry: number) => box(p, c, x, y, z, w, 0.0012, len, ry);
  const glyph = (p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number, c: string) => {
    for (let k = 0; k < 3; k++) {
      const hx = hash3(seed, k, 1) - 0.5, hz = hash3(seed, k, 2) - 0.5, horiz = hash3(seed, k, 3) > 0.55;
      strip(p, c, x + hx * s * 0.6, y, z + hz * s * 0.6, s * (0.6 + hash3(seed, k, 5) * 0.4), 0.0026, (horiz ? Math.PI / 2 : 0) + (hash3(seed, k, 4) - 0.5) * 0.7);
    }
  };
  const column = (p: THREE.Object3D, x: number, y: number, z0: number, n: number, seed: number, c: string) => {
    for (let i = 0; i < n; i++) glyph(p, x, y, z0 - i * 0.017, 0.013, seed * 13 + i, c);
  };
  const crack = (p: THREE.Object3D, x: number, y: number, z: number, side: number, c = '#3a2616') => {
    strip(p, c, x, y, z, 0.03, 0.003, 0);
    strip(p, c, x - side * 0.008, y, z + 0.006, 0.018, 0.0026, side * 1.1);
  };
  // plastron outline (half, x ≥ 0), front lobe toward +z
  const pHalf: [number, number][] = [[0, 0.138], [0.03, 0.15], [0.062, 0.14], [0.084, 0.112], [0.092, 0.075], [0.108, 0.055], [0.112, -0.03], [0.098, -0.056],
    [0.09, -0.09], [0.068, -0.13], [0.036, -0.152], [0.016, -0.128], [0, -0.12]];
  const plastron = (x: number, z: number, ry: number, c: string) => {
    const G = grp(gp, x, z, ry, mat0);
    const m = slab(G, mirror(pHalf).map(([a, b]) => [a, -b] as [number, number]), 0.012, c, 0.002, false);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01;
    return G;
  };
  const top = 0.0192;
  // ---- plastron A: front face up, sulci, cracks and inscriptions
  const A = plastron(-0.07, 0.07, 0.1, BONE);
  strip(A, '#8f7a52', 0, top, 0, 0.27, 0.003, 0);
  for (const z of [0.118, 0.07, 0.005, -0.06, -0.108]) {
    const w = hw(pHalf, z) * 0.96;
    for (const sx of [-1, 1]) strip(A, '#9a845a', sx * w / 2, top, z + sx * 0.002, w, 0.0026, Math.PI / 2 + sx * 0.06);
  }
  for (const sx of [-1, 1]) for (const [cx, cz, ins] of [[0.03, 0.1, 3], [0.068, 0.04, 4], [0.03, -0.02, 4], [0.072, -0.04, 0], [0.04, -0.085, 3]] as const) {
    crack(A, sx * cx, top + 0.0003, cz, sx);
    if (ins) column(A, sx * (cx + 0.016), top + 0.0003, cz + 0.012, ins, Math.round(cx * 1000 + cz * 100 + sx * 7), (cx + cz) * 100 % 3 < 1 ? '#8e3422' : '#3a2a1a');
  }
  // ---- plastron B: turned over, rows of 凿 hollows with scorched 钻 pits; one is being burnt now
  const B = plastron(0.2, -0.03, -0.35, shade(BONE, 0.93));
  let hot: V3 = [0, 0, 0];
  for (const sx of [-1, 1]) for (let row = 0; row < 6; row++) for (let k = 0; k < 2; k++) {
    const z = 0.105 - row * 0.042, x = sx * (0.024 + k * 0.034);
    if (Math.abs(x) + 0.012 > hw(pHalf, z) * 0.9) continue;
    ellip(B, '#6e5434', x, top - 0.0005, z, 0.0055, 0.0012, 0.0115);
    const burnt = (row * 2 + k + (sx > 0 ? 1 : 0)) % 5 !== 4;
    ellip(B, burnt ? '#1e1410' : '#7a6040', x - sx * 0.008, top, z + 0.001, 0.0052, 0.0012, 0.0052);
    if (burnt) ellip(B, '#4a3220', x - sx * 0.008, top - 0.0004, z + 0.001, 0.009, 0.001, 0.009);
    if (sx > 0 && row === 1 && k === 0) {
      const v = new THREE.Vector3(x - sx * 0.008, top, z + 0.001).applyEuler(B.rotation).add(B.position);
      hot = [v.x, v.y, v.z];
    }
  }
  // ---- ox scapula 牛肩胛骨: glenoid end trimmed, blade fanning out, cracks and an inscription down the thick border
  const S = grp(gp, -0.17, -0.19, -1.38, mat0);
  const sHalf: [number, number][] = [[-0.03, 0.19], [-0.012, 0.205], [0.014, 0.205], [0.028, 0.188], [0.032, 0.15], [0.05, 0.08], [0.09, -0.03], [0.124, -0.13], [0.13, -0.17],
    [0.08, -0.192], [0.0, -0.2], [-0.06, -0.185], [-0.072, -0.12], [-0.06, -0.02], [-0.045, 0.08], [-0.034, 0.16]];
  const sm = slab(S, sHalf.map(([a, b]) => [a, -b] as [number, number]), 0.012, shade(BONE, 1.02), 0.003);
  sm.rotation.x = -Math.PI / 2; sm.position.y = 0.01;
  ellip(S, shade(BONE, 0.9), 0.0, 0.012, 0.19, 0.03, 0.012, 0.022);
  strip(S, '#a89068', -0.04, top, -0.04, 0.24, 0.006, -0.06);
  for (let row = 0; row < 4; row++) {
    const z = 0.08 - row * 0.065, x = 0.005 + row * 0.012;
    crack(S, x, top + 0.0003, z, -1);
    column(S, x + 0.024, top + 0.0003, z + 0.012, 3, 70 + row, row % 2 ? '#3a2a1a' : '#8e3422');
  }
  // ---- grey-pottery basin of glowing charcoal and the thorn-wood rod being applied to plastron B
  const bx = 0.27, bz = 0.2;
  plathe(gp, [[0, 0], [0.05, 0.0], [0.066, 0.03], [0.072, 0.05], [0.066, 0.05], [0.0, 0.035]], '#6e6a62', (x, y, z) => shade('#6e6a62', 0.85 + fbm(x * 30, y * 30, z * 30, 2) * 0.3), bx, mat0, bz, 18);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.045 * Math.sqrt(i / 9); ellip(gp, i % 3 ? '#2a1d18' : '#3a2620', bx + Math.cos(a) * d, mat0 + 0.044, bz + Math.sin(a) * d, 0.013, 0.008, 0.012, a); }
  ellip(gp, '#ff7a1a', bx, mat0 + 0.046, bz, 0.04, 0.004, 0.04).material = mat('#ff9a3a', { emissive: '#ff5a00' });
  flame(gp, bx + 0.01, mat0 + 0.044, bz, 0.03);
  const tip: V3 = [hot[0], hot[1] + 0.003, hot[2]];
  rod(gp, [bx + 0.01, mat0 + 0.05, bz + 0.01], tip, 0.004, '#5a3a1e', 5);
  ellip(gp, '#ff8a2a', ...tip, 0.006).material = mat('#ffb347', { emissive: '#ff6a00' });
  smoke(gp, tip[0], tip[1] + 0.01, tip[2], 0.016, '#cfc8bc', 4, 0.45);
  // ---- a spare cleaned plastron, a bronze carving knife and a dish of cinnabar for filling the strokes
  const C = plastron(0.28, -0.24, 0.9, shade(BONE, 1.04));
  C.scale.setScalar(0.62);
  const K = grp(gp, 0.02, 0.27, 0.35, mat0);
  slab(K, [[-0.06, 0.0], [0.03, 0.0], [0.07, 0.006], [0.085, 0.014], [0.03, 0.012], [-0.06, 0.009]], 0.004, '#5d7a62', 0.001, false).rotation.x = -Math.PI / 2;
  K.children[K.children.length - 1].position.y = 0.003;
  plathe(gp, [[0, 0], [0.028, 0], [0.034, 0.014], [0.03, 0.016], [0, 0.008]], '#7a6a5a', (x, y, z) => shade('#7a6a5a', 0.9 + fbm(x * 40, y * 40, z * 40, 2) * 0.2), -0.22, mat0, 0.24, 14);
  ellip(gp, '#9a2e1e', -0.22, mat0 + 0.012, 0.24, 0.024, 0.003, 0.024);
};

const weir: Builder = (gp, r) => {
  if (r?.style === 'seawall') {
    // 钱氏捍海塘 (King Qian Liu of Wuyue, 910 AD, Hangzhou): the Qiantang River tidal bore (钱塘江大潮) crashing with
    // white foam crests against the tiered bamboo-cage stone seawall (竹笼石塘) anchored by rows of heavy timber piles
    // (木桩) and an octagonal iron Wave-Quelling Talisman pillar (镇海铁幢), protecting the green fields and houses of
    // Hangzhou behind the embankment.
    const h0 = ground(gp, 0.46, '#6e8650', '#5a4a34');
    const wy = h0 + 0.002;
    water(gp, clipR([[-0.45, -0.02], [0.45, -0.02], [0.45, 0.46], [-0.45, 0.46]], 0.448), wy, '#436d78');
    // surging Qiantang tidal bore wave (一线潮) rolling toward the seawall with white foam crest
    for (let i = -8; i <= 8; i++) {
      const x = i * 0.046, z = 0.16 + Math.cos(i * 0.25) * 0.015;
      ellip(gp, '#568591', x, wy + 0.012, z + 0.025, 0.036, 0.016, 0.032);
      ellip(gp, '#e6f2f2', x, wy + 0.024, z, 0.032, 0.009, 0.016);
      if (i % 2 === 0) ellip(gp, '#dceaea', x, wy + 0.008, 0.045, 0.028, 0.005, 0.014);
    }
    // stepped stone & rammed-earth seawall embankment (捍海石塘) running across z ∈ [-0.08, 0.02]
    for (let t = 0; t < 3; t++) {
      const ty = h0 + t * 0.024, tz = 0.01 - t * 0.028, tw = 0.82 - t * 0.04;
      box(gp, t % 2 ? '#989284' : '#aba496', 0, ty, tz, tw, 0.025, 0.042);
    }
    // giant woven bamboo gabion cages packed with stones (竹笼巨石) + double rows of driven timber piles (楗木桩)
    for (let i = -6; i <= 6; i++) {
      const x = i * 0.056;
      const g1 = cyl(gp, '#c29f58', x, 0, 0.035, 0.015, 0.048, 8);
      g1.rotation.z = Math.PI / 2; g1.position.y = wy + 0.014;
      for (const dx of [-0.015, 0.015]) {
        const b = cyl(gp, '#7c5d2c', x + dx, 0, 0.035, 0.0165, 0.004, 8);
        b.rotation.z = Math.PI / 2; b.position.y = wy + 0.014;
      }
      cyl(gp, '#4f3622', x - 0.02, wy, 0.056, 0.006, 0.048, 6);
      cyl(gp, '#4f3622', x + 0.02, wy, 0.02, 0.006, 0.062, 6);
    }
    // octagonal cast-iron Wave-Quelling Pillar (吴越镇海铁幢) on a lotus stone base + Wuyue banner & workmen
    const topY = h0 + 0.072;
    cyl(gp, '#c8c2b4', -0.22, topY, -0.05, 0.032, 0.014, 8);
    cyl(gp, '#32353a', -0.22, topY + 0.014, -0.05, 0.014, 0.11, 8);
    cone(gp, '#d4af37', -0.22, topY + 0.124, -0.05, 0.02, 0.028, 8);
    person(gp, -0.08, topY, -0.045, { h: 0.075, pose: 'point', top: '#8a261e', bottom: '#2b2622', dress: 'ankle', hat: '#1c1714', hatStyle: 'cap', ry: 0.2, detail: 'lo' });
    for (const [wx, wz] of [[0.08, -0.04], [0.18, -0.05]] as const) {
      person(gp, wx, topY, wz, { h: 0.068, pose: 'carry', top: '#5a6452', bottom: '#3a3228', hat: '#b89c64', hatStyle: 'conical', ry: -0.4, detail: 'lo' });
    }
    // protected Jiangnan mulberry trees and whitewashed house behind the seawall
    box(gp, '#ece6d8', 0.12, h0, -0.24, 0.14, 0.055, 0.09);
    prism(gp, [[-0.08, -0.055], [0.08, -0.055], [0.08, 0.055], [-0.08, 0.055]], h0 + 0.055, 0.03, '#4a4e54').position.set(0.12, 0, -0.24);
    for (const [tx, tz] of [[-0.26, -0.22], [-0.08, -0.28], [0.28, -0.18]] as const) minipine(gp, tx, h0, tz, 0.075, '#4c7038');
    return;
  }
  // Dujiangyan 都江堰 as built by Li Bing 李冰 (Qin, c. 256 BC), seen from downstream (north/upstream = -z, east = +x):
  // the Fish Mouth 鱼嘴 splits the grey-green Min into the outer river (west) and inner river (east); the Jingang levee
  // of bamboo gabions 竹笼 (woven cylinders of river cobbles), the low Feishayan 飞沙堰 spillway, timber macha 杩槎
  // tripods, and the Baopingkou 宝瓶口 cut through Yulei hill 玉垒山, leaving the Lidui 离堆 rock. Later temples
  // (Erwang, Fulong) and the Anlan rope bridge are omitted. Ref: zh Wikipedia "都江堰"; UNESCO WHC 1001 site plan.
  const h0 = ground(gp, 0.46, '#6b7a4c', '#5a4a34');
  const wy = h0 + 0.001, RIV = '#6a8e88';
  water(gp, clipR([[-0.38, -0.3], [-0.2, -0.44], [0.2, -0.44], [0.215, -0.1], [0.205, 0.16], [0.19, 0.3], [0.19, 0.46], [0.11, 0.46], [0.115, 0.3],
    [0.02, 0.36], [-0.05, 0.42], [-0.2, 0.42], [-0.35, 0.26], [-0.4, 0]], 0.445), wy, RIV);
  const top = wy + 0.004;
  // flow streaks and foam
  for (let i = 0; i < 14; i++) {
    const x = -0.32 + hash3(i, 1, 3) * 0.5, z = -0.38 + hash3(i, 2, 3) * 0.78;
    if (x > -0.01 && x < 0.09 && z > -0.24 && z < 0.22) continue;
    if (z > 0.24 && x > -0.06 && x < 0.11) continue;
    ellip(gp, '#8fb0a8', x, top, z, 0.006, 0.0012, 0.012 + hash3(i, 3, 3) * 0.016, (hash3(i, 4, 4) - 0.5) * 0.3);
  }
  // ---- levee island (金刚堤) with the Fish Mouth tip, split by the Feishayan spillway
  const lev = (plan: [number, number][], h: number) => prism(gp, plan, top - 0.002, h, '#9a8a68');
  lev([[0.035, -0.25], [0.07, -0.14], [0.075, -0.02], [0.075, 0.05], [0.0, 0.05], [0.0, -0.02], [0.0, -0.14]], 0.024);
  lev([[0.075, 0.13], [0.075, 0.21], [0.0, 0.21], [0.0, 0.13]], 0.024);
  prism(gp, [[0.0, -0.13], [0.07, -0.13], [0.072, 0.04], [0.003, 0.04]], top + 0.022, 0.003, '#6f8a4a');
  prism(gp, [[0.005, 0.135], [0.07, 0.135], [0.07, 0.205], [0.005, 0.205]], top + 0.022, 0.003, '#6f8a4a');
  box(gp, '#8a7d62', 0.037, top - 0.002, 0.09, 0.075, 0.008, 0.08);
  for (let k = 0; k < 7; k++) ellip(gp, '#b9c6c4', -0.006 - (k % 2) * 0.012, top + 0.003, 0.058 + k * 0.011, 0.016, 0.004, 0.006, 0.2);
  for (let k = 0; k < 4; k++) ellip(gp, '#b9c6c4', 0.035 + (k - 1.5) * 0.012, top + 0.002, -0.262 - (k % 2) * 0.01, 0.01, 0.003, 0.02, (k - 1.5) * 0.4);
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
  for (const z of [-0.08, 0.0, 0.17]) { cyl(gp, '#5b4030', 0.037, top + 0.024, z, 0.004, 0.024, 5); ellip(gp, '#77874c', 0.037, top + 0.056, z, 0.02, 0.018, 0.02); }
  // ---- mountains: Yulei hill on the east bank, cut through at Baopingkou; the Lidui rock left standing to the west
  const green = '#5a6e40', rock = '#8a8270';
  const cliff: Paint = (x, y, z) => shade(rock, (0.8 + hash3(Math.floor(x * 70), Math.floor(y * 90), Math.floor(z * 70)) * 0.25) * (Math.floor(y * 160) % 3 ? 1 : 0.9));
  for (const [x, z, sx, sy, sz, sd] of [[-0.35, -0.1, 0.07, 0.11, 0.16, 1], [-0.22, -0.28, 0.09, 0.09, 0.06, 3], [0.33, -0.19, 0.08, 0.12, 0.14, 2], [0.21, -0.34, 0.08, 0.08, 0.06, 4]] as const)
    lump(gp, x, h0, z, sx, sy, sz, green, { seed: sd, rough: 0.3, paint: rockPaint(rock, green, sd) });
  pprism(gp, clipR([[0.198, 0.2], [0.3, 0.12], [0.42, 0.14], [0.42, 0.44], [0.198, 0.44]], 0.44), h0, 0.07, rock, cliff);
  lump(gp, 0.28, h0 + 0.05, 0.24, 0.08, 0.07, 0.09, green, { seed: 5, rough: 0.25, paint: rockPaint(rock, green, 5) });
  pprism(gp, clipR([[0.02, 0.3], [0.104, 0.275], [0.104, 0.44], [0.04, 0.44], [-0.01, 0.38]], 0.44), h0, 0.06, rock, cliff);
  lump(gp, 0.055, h0 + 0.05, 0.36, 0.055, 0.05, 0.06, green, { seed: 8, rough: 0.2, detail: 2, paint: rockPaint(rock, green, 8) });
  for (let k = 0; k < 5; k++) ellip(gp, '#b9c6c4', 0.15 + (k % 2 - 0.5) * 0.03, top + 0.001, 0.3 + k * 0.03, 0.012, 0.003, 0.01);
  for (const [x, z] of [[-0.42, 0.05], [0.4, 0.04], [-0.27, -0.31], [0.33, 0.3], [0.28, 0.24], [0.06, 0.37]]) minipine(gp, x, x > 0.2 && z > 0.2 ? h0 + 0.1 : x < 0.1 && x > 0 ? h0 + 0.08 : h0, z, 0.05, '#3f5a32');
  // people at true scale are specks: gabion builders carrying cobble baskets and Li Bing at the Fish Mouth
  for (const [x, z, ph] of [[0.02, -0.06, 0.1], [0.05, 0.0, 0.6], [0.03, 0.15, 0.3]] as const) {
    const w = person(gp, x, top + 0.024, z, { h: 0.034, pose: 'carry', phase: ph, top: '#6a6450', bottom: '#3a3128', hat: '#b49a64', hatStyle: 'conical', ry: Math.PI, detail: 'lo' });
    ellip(gp, '#8a8680', w.head[0], w.head[1] + 0.007, w.head[2], 0.007, 0.005, 0.007);
  }
  person(gp, 0.04, top + 0.024, -0.2, { h: 0.04, pose: 'point', top: '#2e2a26', bottom: '#2e2a26', dress: 'ankle', hat: '#1c1714', hatStyle: 'knot', ry: Math.PI - 0.4, detail: 'lo' });
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
  // Jing-Zhang railway (京张铁路, Zhan Tianyou, opened 1909) at the Guangou pass below Badaling: an unlined black 0-6-6-0
  // Mallet articulated locomotive (two groups of three drivers, big low-pressure front cylinders) with tender and two
  // Qing-era wooden clerestory coaches; Zhan Tianyou in Qing official dress beside a semaphore. Gauge 1435 mm = 0.06.
  // Ref: en/zh Wikipedia "Beijing–Zhangjiakou railway"/"京张铁路"; 1909 同生照相馆《京张路工撮影》 photographs.
  const h0 = ground(gp, 0.46, '#8f8a5a', '#5a4a34');
  // the scene is laid out on a 0.46 disc; shrink it so the cowcatcher and track ends stay on the plinth top
  gp = grp(gp, 0, 0, 0, h0 * 0.08);
  gp.scale.setScalar(0.92);
  lump(gp, 0, h0, -0.33, 0.33, 0.15, 0.1, '#6f7a44', { seed: 4, rough: 0.25, paint: rockPaint('#8a826e', '#6f7a44', 4) });
  // a stretch of the Great Wall along the ridge
  for (let i = 0; i < 9; i++) {
    const x = -0.26 + i * 0.065, y = h0 + 0.14 + Math.sin(i * 0.8) * 0.02 - Math.abs(x) * 0.18;
    box(gp, '#9a9282', x, y - 0.05, -0.33, 0.066, 0.07, 0.03, 0, 0, Math.cos(i * 0.8) * 0.25);
    box(gp, '#8a8274', x - 0.015, y + 0.02, -0.318, 0.012, 0.01, 0.006); box(gp, '#8a8274', x + 0.015, y + 0.02, -0.318, 0.012, 0.01, 0.006);
  }
  box(gp, '#9a9282', 0.08, h0 + 0.1, -0.33, 0.05, 0.1, 0.05); box(gp, '#8a8274', 0.08, h0 + 0.2, -0.33, 0.056, 0.01, 0.056);
  for (const [x, z] of [[-0.38, -0.12], [0.38, -0.14], [-0.3, 0.3], [0.33, 0.28]]) minipine(gp, x, h0, z, 0.08, '#3f5a34');
  const zt = 0.04, G = 0.06, rt = track(gp, h0, zt, 0.88, G);
  const red = '#7a2a22', wz = G / 2 + 0.006, WH = '#1c1d1f', ST = '#8e9398';
  // ---- locomotive (front = +x)
  const by = rt + 0.098;
  box(gp, body, 0.29, rt + 0.03, zt, 0.29, 0.014, G + 0.01);
  box(gp, body, 0.27, rt + 0.054, zt, 0.26, 0.006, 0.112);
  const boil = add(gp, CYLX(16), mat(body, { metal: 0.3, rough: 0.45 }), 0.29, by, zt, 0.072, 0.072, 0.17); boil.rotation.y = Math.PI / 2;
  for (const x of [0.23, 0.29, 0.34]) { const b = add(gp, CYLX(16), mat('#3e4044', { metal: 0.5 }), x, by, zt, 0.075, 0.075, 0.004); b.rotation.y = Math.PI / 2; }
  const sbx = add(gp, CYLX(16), mat('#2c2e31', { metal: 0.3 }), 0.39, by, zt, 0.078, 0.078, 0.04); sbx.rotation.y = Math.PI / 2;
  const door = add(gp, CYLX(16), mat('#3a3d41', { metal: 0.4 }), 0.411, by, zt, 0.06, 0.06, 0.004); door.rotation.y = Math.PI / 2;
  box(gp, '#d6a840', 0.414, by - 0.012, zt, 0.002, 0.012, 0.024);
  lathe(gp, [[0.012, 0], [0.012, 0.03], [0.018, 0.045], [0.019, 0.05], [0, 0.05]], '#26282b', 0.39, by + 0.028, zt, 12);
  lathe(gp, [[0.02, 0], [0.018, 0.012], [0.012, 0.022], [0, 0.026]], body, 0.3, by + 0.03, zt, 12);
  lathe(gp, [[0.018, 0], [0.016, 0.01], [0.01, 0.018], [0, 0.021]], body, 0.255, by + 0.03, zt, 12);
  rod(gp, [0.27, by + 0.04, zt], [0.27, by + 0.06, zt], 0.003, '#d6a840', 5);
  box(gp, '#2a2a2a', 0.405, by + 0.04, zt, 0.022, 0.024, 0.024);
  add(gp, CYLX(10), mat('#fff3c4', { emissive: '#ffd27a' }), 0.418, by + 0.052, zt, 0.016, 0.016, 0.004).rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    // large low-pressure cylinders on the front engine, small high-pressure ones between the two wheel groups
    const c = add(gp, CYLX(12), mat('#2c2e31'), 0.41, rt + 0.034, zt + s * 0.05, 0.044, 0.044, 0.05); c.rotation.y = Math.PI / 2;
    const c2 = add(gp, CYLX(10), mat('#2c2e31'), 0.287, rt + 0.034, zt + s * 0.046, 0.03, 0.03, 0.036); c2.rotation.y = Math.PI / 2;
    rod(gp, [0.287, rt + 0.034, zt + s * 0.05], [0.41, rt + 0.034, zt + s * 0.054], 0.004, '#3a3c40', 6);
    rod(gp, [0.22, by + 0.025, zt + s * 0.038], [0.39, by + 0.025, zt + s * 0.038], 0.003, ST, 4);
    box(gp, body, 0.29, rt + 0.054, zt + s * 0.05, 0.25, 0.004, 0.016);
  }
  // pilot (cowcatcher) and red buffer beam
  tbox(gp, 0.006, 0.08, 0.03, 0.08, 0.035, body, 0.448, rt - 0.004, zt, -0.012, 0);
  box(gp, red, 0.438, rt + 0.03, zt, 0.012, 0.022, 0.11);
  for (const s of [-1, 1]) { const bf = add(gp, CYLX(8), mat('#2a2a2a'), 0.447, rt + 0.04, zt + s * 0.04, 0.012, 0.012, 0.01); bf.rotation.y = Math.PI / 2; }
  // cab with windows, overhanging roof, and the driver
  box(gp, body, 0.165, rt + 0.054, zt, 0.08, 0.1, 0.11);
  for (const s of [-1, 1]) {
    box(gp, '#3a4048', 0.168, rt + 0.1, zt + s * 0.0555, 0.03, 0.03, 0.002);
    box(gp, '#d8d2c0', 0.165, rt + 0.075, zt + s * 0.0555, 0.02, 0.008, 0.002);
  }
  box(gp, '#3a4048', 0.206, rt + 0.11, zt + 0.03, 0.002, 0.022, 0.02); box(gp, '#3a4048', 0.206, rt + 0.11, zt - 0.03, 0.002, 0.022, 0.02);
  rbox(gp, '#2a2c2f', 0.165, rt + 0.154, zt, 0.1, 0.008, 0.126, 0.003);
  person(gp, 0.165, rt + 0.065, zt + 0.045, { h: 0.075, pose: 'stand', top: '#2c3e50', hat: '#2c3e50', hatStyle: 'cap', ry: Math.PI / 2 });
  // wheels: two articulated groups of three coupled drivers, each with steel side rods
  for (const s of [-1, 1]) for (const g0 of [0.18, 0.322]) {
    for (let k = 0; k < 3; k++) rwheel(gp, g0 + k * 0.044, rt + 0.022, zt + s * wz, 0.022, WH);
    box(gp, ST, g0 + 0.044, rt + 0.018, zt + s * (wz + 0.008), 0.1, 0.006, 0.006);
  }
  // ---- tender with coal
  box(gp, body, 0.05, rt + 0.03, zt, 0.12, 0.012, G + 0.01);
  rbox(gp, body, 0.05, rt + 0.042, zt, 0.12, 0.07, 0.104, 0.004);
  box(gp, '#2a2b2e', 0.05, rt + 0.1, zt, 0.122, 0.004, 0.106);
  for (let i = 0; i < 7; i++) ellip(gp, '#151515', 0.01 + (i % 4) * 0.025, rt + 0.112, zt + (i > 3 ? 0.018 : -0.015), 0.022, 0.012, 0.02);
  for (const s of [-1, 1]) for (const x of [0.012, 0.038, 0.062, 0.088]) rwheel(gp, x, rt + 0.016, zt + s * wz, 0.016, WH);
  box(gp, '#2a2a2a', 0.115, rt + 0.035, zt, 0.012, 0.008, 0.01);
  // ---- two Qing-era wooden coaches with clerestory roofs and open end platforms
  for (const [cx, c] of [[-0.12, '#3a4a3c'], [-0.33, '#5a3226']] as const) {
    const Lc = 0.18;
    box(gp, '#2a2a2a', cx, rt + 0.03, zt, Lc + 0.02, 0.01, G + 0.01);
    rbox(gp, c, cx, rt + 0.04, zt, Lc - 0.03, 0.075, 0.1, 0.003);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) box(gp, '#e3d6a2', cx - Lc / 2 + 0.03 + k * ((Lc - 0.06) / 5), rt + 0.075, zt + s * 0.0505, 0.016, 0.022, 0.002);
      box(gp, '#8a7a50', cx, rt + 0.064, zt + s * 0.0505, Lc - 0.03, 0.003, 0.002);
      box(gp, '#8a7a50', cx, rt + 0.102, zt + s * 0.0505, Lc - 0.03, 0.003, 0.002);
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
  for (const s of [-1, 1]) ellip(gp, '#ffffff', 0.43, rt + 0.03, zt + s * 0.075, 0.018, 0.01, 0.015).material = mat('#ffffff', { transparent: 0.55 });
  // Zhan Tianyou (詹天佑) style engineer by the line and a semaphore signal
  person(gp, 0.05, h0, 0.2, { h: 0.072, pose: 'point', top: '#2a2a3a', bottom: '#2a2a3a', dress: 'ankle', hat: '#1c1714', hatStyle: 'qing', hatBadge: '#b91c1c', ry: -0.4 });
  person(gp, -0.1, h0, 0.22, { h: 0.07, pose: 'wave', top: '#3a4a5a', bottom: '#2a2a2a', hat: '#2a2a2a', hatStyle: 'brim', ry: 0.2 });
  rod(gp, [0.3, h0, 0.2], [0.3, h0 + 0.2, 0.2], 0.004, '#3a3a3a', 5);
  box(gp, '#b91c1c', 0.32, h0 + 0.17, 0.2, 0.04, 0.012, 0.003, 0, 0, -0.5);
  ellip(gp, '#fff3c4', 0.3, h0 + 0.15, 0.204, 0.006, 0.006, 0.003).material = mat('#ffef9a', { emissive: '#ffd24a' });
}

function crh(gp: THREE.Group): void {
  // CRH380A (China Railway High-speed, 2010): white body, long 'dragon' nose with dark windscreen, dark window band and
  // blue waist stripe, single-arm pantograph, on a standard 32 m simply-supported box-girder viaduct with catenary masts.
  // Ref: zh Wikipedia "CRH380A型电力动车组"; 京沪高速铁路 viaduct photos.
  const h0 = ground(gp, 0.46, '#7d9a4f', '#5a4a34');
  for (let i = 0; i < 6; i++) prism(gp, clipR([[-0.44, -0.44 + i * 0.15], [0.44, -0.44 + i * 0.15], [0.44, -0.37 + i * 0.15], [-0.44, -0.37 + i * 0.15]], 0.44), h0, 0.002, i % 2 ? '#7f9a52' : '#b8a65a');
  const zt = 0.0, dy = h0 + 0.15;
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
  const paint: Paint = (_x, _y, _z, _nx, ny) => {
    if (ny < -0.6) return '#3a3d42';
    return '#eef0f0';
  };
  const car = (xa: number, xb: number) => {
    const rings: V3[][] = [];
    for (let i = 0; i <= 16; i++) rings.push(ring(xa + (xb - xa) * (i / 16), W, Hh, y0, 4));
    skin(gp, rings, '#f2f4f5', { caps: true, paint });
    for (const s of [-1, 1]) {
      box(gp, '#2a3340', (xa + xb) / 2, y0 + Hh * 0.55, zt + s * (W + 0.0006), xb - xa - 0.012, Hh * 0.15, 0.002);
      box(gp, '#1f4e96', (xa + xb) / 2, y0 + Hh * 0.25, zt + s * (W + 0.0006), xb - xa, Hh * 0.06, 0.002);
    }
  };
  const nose = (x0: number, dir: number, len: number) => {
    const rings: V3[][] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, w = W * (1 - 0.82 * t ** 2.6), h = Hh * (1 - 0.72 * t ** 1.4), e = 4 - 2 * t;
      rings.push(ring(x0 + dir * len * t, Math.max(0.004, w), Math.max(0.006, h), y0 + 0.004 * t, e));
    }
    skin(gp, rings, '#f2f4f5', { caps: true, paint });
    ellip(gp, '#1e2833', x0 + dir * len * 0.3, y0 + Hh * 0.86, zt, 0.028, 0.007, 0.03, 0, 0, -dir * 0.36);
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
  for (const [x, z, k] of [[-0.35, -0.24, 1], [0.36, -0.22, 2], [-0.3, 0.28, 3], [0.25, 0.32, 4], [0.0, -0.36, 5]]) leafTree(gp, x, h0, z, 0.1, '#55703e', k);
}

const train: Builder = (gp, r) => (r.style === 'crh' ? crh(gp) : steam(gp, str(r.color, '#1f2124')));

/** Wall paint for a pbox of height h (paint y is box-centred): rows of windows every `fl`, spaced `sp` along the wall. */
const facade = (wall: string, h: number, o: { fl: number; sp: number; ww?: number; wh?: number; y0?: number; glass?: string; trim?: string; brick?: [number, number]; roof?: string; band?: string }): Paint => {
  const bp = o.brick ? brickPaint(wall, o.brick[0], o.brick[1]) : null;
  return (x, y, z, nx, ny, nz) => {
    if (ny > 0.5) return o.roof ?? shade(wall, 0.6);
    if (ny < -0.5) return shade(wall, 0.5);
    const yy = y + h / 2, u = Math.abs(nz) > 0.5 ? x : z;
    const k = ((u + 8) / o.sp) % 1, f = ((yy - (o.y0 ?? 0)) / o.fl) % 1, ww = o.ww ?? 0.45, wh = o.wh ?? 0.5;
    if (o.band && yy > 0 && f < 0.07) return o.band;
    if (yy > (o.y0 ?? 0) && Math.abs(k - 0.5) < ww / 2 && f > 0.25 && f < 0.25 + wh && yy < h - o.fl * 0.12) return o.glass ?? '#2b333a';
    if (o.trim && yy > (o.y0 ?? 0) && Math.abs(k - 0.5) < ww / 2 + 0.05 && f > 0.19 && f <= 0.25) return o.trim;
    return bp ? bp(x, y, z, nx, ny, nz) : shade(wall, 0.92 + hash3(Math.floor(u * 60), Math.floor(yy * 60), 1) * 0.12);
  };
};
/** North-light sawtooth roof over a w×d hall (teeth run along x, glazing faces -z). */
function sawtooth(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, n: number, tH: number, slate: string, gable: string): void {
  const td = d / n;
  for (let i = 0; i < n; i++) {
    const G = grp(p, x, z - d / 2 + i * td, 0, y);
    slab(G, [[0, 0], [td, 0], [0.003, tH], [0, tH]], w, slate, 0, false).rotation.y = -Math.PI / 2;
    box(G, '#7d929a', 0, 0.004, -0.001, w - 0.01, tH - 0.008, 0.002).material = mat('#8aa0a8', { rough: 0.2, metal: 0.4 });
    for (let k = 0; k <= Math.round(w / 0.03); k++) box(G, '#2e2e2e', -w / 2 + 0.005 + k * ((w - 0.01) / Math.round(w / 0.03)), 0.003, -0.0025, 0.003, tH - 0.006, 0.003);
    for (const s of [-1, 1]) { const gt = slab(G, [[0, 0], [td, 0], [0, tH + 0.004]], 0.008, gable, 0, false); gt.rotation.y = -Math.PI / 2; gt.position.x = s * (w / 2 + 0.002); }
  }
}
/** Jiefang CA10 truck (1956), olive drab, heading +x. */
function jiefang(p: THREE.Object3D, x: number, y: number, z: number, ry = 0, load = false): void {
  const T = grp(p, x, z, ry, y), O = '#55603e';
  box(T, '#2a2a2a', 0, 0.008, 0, 0.07, 0.004, 0.018);
  for (const wx of [0.024, -0.012, -0.024]) for (const s of [-1, 1]) add(T, CYLX(10), mat('#1e1e1e'), wx, 0.007, s * 0.011, 0.014, 0.014, 0.006);
  box(T, O, 0.027, 0.012, 0, 0.016, 0.011, 0.016);
  box(T, '#3a3a36', 0.0355, 0.012, 0, 0.002, 0.009, 0.012);
  for (const s of [-1, 1]) ellip(T, O, 0.024, 0.014, s * 0.011, 0.008, 0.004, 0.004);
  box(T, O, 0.011, 0.012, 0, 0.016, 0.02, 0.024);
  box(T, '#2b333a', 0.0195, 0.024, 0, 0.002, 0.006, 0.02);
  box(T, O, -0.019, 0.012, 0, 0.042, 0.003, 0.025);
  for (const s of [-1, 1]) box(T, shade(O, 0.9), -0.019, 0.015, s * 0.0118, 0.042, 0.007, 0.0016);
  box(T, shade(O, 0.9), -0.04, 0.015, 0, 0.0016, 0.007, 0.025);
  if (load) rbox(T, '#8a7a5a', -0.019, 0.015, 0, 0.036, 0.01, 0.02, 0.003);
}
/** Riveted steel lattice derrick: four tapering legs, girts and X-bracing. */
function derrick(p: THREE.Object3D, x: number, y: number, z: number, H: number, b0: number, b1: number, c: string): void {
  const n = 7, leg = (t: number) => b0 + (b1 - b0) * t;
  const P4 = (t: number): V3[] => { const b = leg(t) / 2; return [[x - b, y + H * t, z - b], [x + b, y + H * t, z - b], [x + b, y + H * t, z + b], [x - b, y + H * t, z + b]]; };
  const bot = P4(0), tp = P4(1);
  for (let i = 0; i < 4; i++) rod(p, bot[i], tp[i], 0.0045, c, 5);
  for (let l = 0; l < n; l++) {
    const a = P4(l / n), b = P4((l + 1) / n);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      if (l > 0) rod(p, a[i], a[j], 0.003, c, 4);
      if (i === 3 && l < 2) continue; // V-door on the front face
      rod(p, a[i], b[j], 0.0025, c, 4); rod(p, a[j], b[i], 0.0025, c, 4);
    }
  }
}

const factory: Builder = (gp, r) => {
  const st = str(r.style, '');
  if (st === 'soviet' || st === 'faw') return sovietPlant(gp);
  if (st === 'oil' || st === 'daqing') return oilfield(gp);
  return qingMill(gp, st === 'jiangnan' || st === 'yangwu' ? 'jiangnan' : st === 'joint' ? 'joint' : 'dasheng');
};

function qingMill(gp: THREE.Group, v: 'dasheng' | 'jiangnan' | 'joint'): void {
  // Late-Qing brick industry on a canal (1 unit ≈ 65 m; storey 0.05, people 0.028). Default = Dasheng No.1 cotton mill
  // 大生纱厂, Tangzha, Nantong (Zhang Jian 张謇, 1895/1899): grey-brick sawtooth spinning shed (清花间 1898, English
  // design), boiler house and chimney, and the 1915 five-storey red-brick clock tower (17.6 m) over the arched gate.
  // 'jiangnan' (江南制造总局 1865, 洋务运动) swaps the tower for a yamen-style gatehouse; 'joint' (1956 公私合营) adds red
  // banners. Ref: 南通史志网 "大生纱厂的建筑遗存"; Baidu Baike "大生钟楼"; zh Wikipedia "江南机器制造总局".
  const h0 = ground(gp, 0.46, '#827c6c', '#5d564a');
  const qing = '#6e706b', red = '#8c4a36', slate = '#3f4246';
  // the canal (通扬运河) along the front, stone embankment, quay paving
  water(gp, clipR([[-0.45, 0.33], [0.45, 0.33], [0.45, 0.46], [-0.45, 0.46]], 0.445), h0, '#5d706b');
  box(gp, '#8f897c', 0, h0, 0.327, 2 * Math.sqrt(0.445 ** 2 - 0.327 ** 2), 0.006, 0.01);
  prism(gp, clipR([[-0.45, 0.17], [0.45, 0.17], [0.45, 0.322], [-0.45, 0.322]], 0.44), h0, 0.002, '#9a937f');
  // ---- spinning shed: grey brick walls with tall arched-look windows, 6 north-light teeth
  const sx = -0.11, sz = -0.15, SW = 0.46, SD = 0.3, wh = 0.075;
  fbox(gp, sx, h0, sz, SW, wh, SD, 0.006, qing, facade(qing, wh, { fl: wh, sp: 0.04, ww: 0.42, wh: 0.58, y0: 0.0, trim: '#a8a598', brick: [0.006, 0.014] }));
  // the 1867 Jiangnan machine shops had plain multi-span pitched roofs; north-light sawtooth arrives with 1890s mills
  if (v === 'jiangnan') for (let k = 0; k < 3; k++) gable(gp, SW + 0.01, 0.04, SD / 3 + 0.004, slate, sx, h0 + wh, sz + (k - 1) * SD / 3);
  else sawtooth(gp, sx, h0 + wh, sz, SW, SD, 6, 0.045, slate, qing);
  // ---- boiler & engine house with the chimney
  const bx = 0.27, bz = -0.2;
  fbox(gp, bx, h0, bz, 0.13, 0.09, 0.12, 0.006, red, facade(red, 0.09, { fl: 0.09, sp: 0.032, ww: 0.4, wh: 0.55, trim: '#c8bfae', brick: [0.006, 0.014] }));
  gable(gp, 0.14, 0.035, 0.13, slate, bx, h0 + 0.09, bz);
  const cx = 0.34, cz = -0.29, CH = 0.5;
  tbox(gp, 0.06, 0.06, 0.056, 0.056, 0.035, shade(red, 0.85), cx, h0, cz);
  plathe(gp, [[0.026, 0], [0.015, CH], [0, CH]], red, (x, y, z) => (Math.abs(y / CH - 0.97) < 0.025 ? '#4a2a20' : brickPaint(red, 0.006, 0.014)(x, y, z, 0, 0, 1)), cx, h0 + 0.035, cz, 14);
  lathe(gp, [[0.017, 0], [0.02, 0.008], [0.02, 0.016], [0.013, 0.016], [0, 0.004]], '#3a2a24', cx, h0 + 0.035 + CH - 0.008, cz, 12);
  smoke(gp, cx, h0 + CH + 0.06, cz, 0.05, '#55524f', 7, 0.55);
  // ---- warehouse for raw cotton, right side
  fbox(gp, 0.3, h0, 0.02, 0.15, 0.1, 0.13, 0.006, qing, facade(qing, 0.1, { fl: 0.05, sp: 0.03, ww: 0.4, wh: 0.45, trim: '#a8a598', brick: [0.006, 0.014] }));
  gable(gp, 0.16, 0.04, 0.14, slate, 0.3, h0 + 0.1, 0.02, Math.PI / 2);
  // ---- compound wall with coping along z = 0.14, broken by the gate
  const gx = 0.03, gz = 0.14;
  for (const [a, b] of [[-0.42, gx - 0.05], [gx + 0.05, 0.39]]) {
    fbox(gp, (a + b) / 2, h0, gz, b - a, 0.04, 0.012, 0.006, qing, brickPaint(qing, 0.006, 0.014));
    box(gp, slate, (a + b) / 2, h0 + 0.04, gz, b - a, 0.005, 0.018);
  }
  if (v === 'jiangnan') {
    // yamen-style gatehouse: brick piers, timber doors, grey tiled roof, black signboard
    fbox(gp, gx, h0, gz, 0.1, 0.06, 0.04, 0.006, qing, brickPaint(qing, 0.006, 0.014));
    box(gp, '#4a2a1e', gx, h0, gz + 0.0205, 0.034, 0.045, 0.002);
    gable(gp, 0.12, 0.03, 0.06, slate, gx, h0 + 0.06, gz);
    box(gp, '#1a1a1a', gx, h0 + 0.047, gz + 0.022, 0.05, 0.012, 0.002);
    for (let k = 0; k < 4; k++) box(gp, '#c9a85a', gx - 0.018 + k * 0.012, h0 + 0.05, gz + 0.0235, 0.007, 0.006, 0.001);
  } else {
    // 1915 clock tower: red brick, grey string courses, arched gate passage, Roman-numeral clock faces, metal spire
    const TW = 0.07, TD = 0.06, TH = 0.26;
    fbox(gp, gx, h0, gz, TW, TH, TD, 0.004, red, (x, y, z, nx, ny, nz) => {
      if (Math.abs(ny) > 0.5) return shade(red, 0.6);
      const yy = y + TH / 2, u = Math.abs(nz) > 0.5 ? x : z, f = (yy / 0.052) % 1, fl = Math.floor(yy / 0.052);
      if (Math.abs(nz) > 0.5 && fl === 0 && Math.abs(x) < 0.016 && (yy < 0.03 || x * x + (yy - 0.03) ** 2 < 0.016 ** 2)) return '#1e1a16';
      if (f < 0.08 && fl > 0) return '#9a968a';
      if (fl >= 1 && fl <= 3 && Math.abs(u) < 0.008 && f > 0.25 && (f < 0.7 || u * u + ((f - 0.7) * 0.052) ** 2 < 0.008 ** 2)) return '#2b333a';
      return brickPaint(red, 0.005, 0.012)(x, y, z, nx, ny, nz);
    });
    box(gp, '#9a968a', gx, h0 + TH, gz, TW + 0.008, 0.008, TD + 0.008);
    tbox(gp, TW, TD, 0.004, 0.004, 0.06, '#4c5651', gx, h0 + TH + 0.008, gz);
    rod(gp, [gx, h0 + TH + 0.06, gz], [gx, h0 + TH + 0.085, gz], 0.003, '#3a3a3a', 4);
    for (const [nx2, nz2, d] of [[0, 1, TD / 2], [0, -1, TD / 2], [1, 0, TW / 2], [-1, 0, TW / 2]] as const) {
      const cf = cyl(gp, '#efe9da', 0, 0, 0, 0.018, 0.003, 16);
      cf.rotation.set(nz2 ? Math.PI / 2 : 0, 0, nx2 ? Math.PI / 2 : 0);
      cf.position.set(gx + nx2 * (d + 0.001), h0 + 0.235, gz + nz2 * (d + 0.001));
      box(gp, '#1a1a1a', gx + nx2 * (d + 0.003), h0 + 0.233, gz + nz2 * (d + 0.003), nx2 ? 0.002 : 0.003, 0.013, nz2 ? 0.002 : 0.003);
      box(gp, '#1a1a1a', gx + nx2 * (d + 0.003) + nz2 * 0.004, h0 + 0.233, gz + nz2 * (d + 0.003) + nx2 * 0.004, nx2 ? 0.002 : 0.01, 0.003, nz2 ? 0.002 : 0.01);
    }
    // gate signboard over the arch
    box(gp, '#1c1c1c', gx, h0 + 0.042, gz + TD / 2 + 0.001, 0.05, 0.01, 0.003);
    for (let k = 0; k < 4; k++) box(gp, v === 'joint' ? '#e8d27a' : '#c9a85a', gx - 0.018 + k * 0.012, h0 + 0.044, gz + TD / 2 + 0.003, 0.007, 0.006, 0.001);
  }
  if (v === 'joint') {
    // 1956 公私合营: red banner across the gate, red flags, drum and gong team
    box(gp, '#b3261e', gx, h0 + 0.075, gz + 0.034, 0.16, 0.014, 0.002);
    for (let k = 0; k < 6; k++) box(gp, '#f0d060', gx - 0.05 + k * 0.02, h0 + 0.079, gz + 0.036, 0.009, 0.007, 0.001);
    for (const fx of [-0.06, 0.12]) { rod(gp, [fx, h0, 0.2], [fx, h0 + 0.1, 0.2], 0.003, '#5a4a3a', 4); box(gp, '#c0241c', fx + 0.016, h0 + 0.08, 0.2, 0.03, 0.02, 0.002); }
    cyl(gp, '#a8301e', -0.02, h0 + 0.01, 0.24, 0.01, 0.012, 10);
  }
  // ---- quay: cotton bales (arsenal: cast-iron gun barrels and coal), a wooden cargo boat, a wheelbarrow and workers
  const arsenal = v === 'jiangnan';
  const bale = (x: number, y: number, z: number, ry = 0) => {
    if (!arsenal) { rbox(gp, '#dcd6c6', x, y, z, 0.026, 0.016, 0.018, 0.004, ry); return; }
    const g = grp(gp, x, z, ry, y);
    add(g, CYLX(10), mat('#2e2e30', { metal: 0.5, rough: 0.5 }), 0, 0.008, 0, 0.007, 0.007, 0.034).rotation.y = Math.PI / 2;
  };
  for (const [x, z, y] of [[-0.2, 0.25, 0], [-0.172, 0.25, 0], [-0.186, 0.25, 0.016], [-0.2, 0.272, 0], [-0.172, 0.272, 0]] as const) bale(x, h0 + y, z);
  const B = grp(gp, -0.06, 0.39, 0.06, h0);
  tbox(B, 0.2, 0.034, 0.24, 0.05, 0.016, '#5a4532', 0, 0.0, 0);
  box(B, '#3a2c20', 0, 0.016, 0, 0.24, 0.003, 0.05);
  if (arsenal) lump(B, -0.005, 0.019, 0, 0.06, 0.022, 0.02, '#26241f', { seed: 9, rough: 0.6 });
  else for (const [x, y] of [[-0.03, 0], [-0.004, 0], [0.022, 0], [-0.017, 0.016], [0.009, 0.016]] as const) rbox(B, '#dcd6c6', x, 0.019 + y, 0, 0.026, 0.016, 0.03, 0.004);
  rod(B, [0.09, 0.019, 0], [0.09, 0.11, 0], 0.0035, '#4a3a2a', 4);
  const W2 = grp(gp, 0.17, 0.25, -0.5, h0);
  add(W2, CYLX(10), mat('#4a3424'), 0.0, 0.01, 0, 0.02, 0.02, 0.004);
  box(W2, '#6a5034', -0.015, 0.008, 0, 0.034, 0.003, 0.022);
  bale(0.17 - 0.012, h0 + 0.012, 0.25, -0.5);
  const dress = v === 'joint' ? { top: '#3e4f66', bottom: '#2e3440', hat: '#3e4f66', hatStyle: 'cap' as const } : { top: '#4a4f5a', bottom: '#2e2a26', hat: '#b49a64', hatStyle: 'conical' as const };
  person(gp, 0.2, h0, 0.25, { h: 0.028, pose: 'carry', ...dress, ry: -2, detail: 'lo' });
  person(gp, -0.15, h0, 0.29, { h: 0.028, pose: 'carry', phase: 0.4, ...dress, ry: 2.6, detail: 'lo' });
  person(gp, -0.04, h0, 0.36, { h: 0.027, pose: 'stand', top: '#5a4a3a', bottom: '#2e2a26', hat: '#b49a64', hatStyle: 'conical', ry: 0.5, detail: 'lo' });
  person(gp, 0.07, h0, 0.22, v === 'jiangnan' || v === 'dasheng'
    ? { h: 0.029, pose: 'point', top: '#2a2a33', bottom: '#2a2a33', dress: 'ankle', hat: '#1c1714', hatStyle: 'qing', ry: 0.6, detail: 'lo' }
    : { h: 0.029, pose: 'wave', top: '#3e4f66', bottom: '#3e4f66', hat: '#3e4f66', hatStyle: 'cap', ry: 0.6, detail: 'lo' });
  for (const [x, z, k] of [[-0.4, 0.12, 1], [0.41, 0.15, 2], [-0.3, 0.2, 3]] as const) leafTree(gp, x, h0, z, 0.11, '#5a6e42', k);
}

function sovietPlant(gp: THREE.Group): void {
  // First Five-Year Plan heavy industry (1953–57), modelled on No.1 Motor Works 第一汽车制造厂, Changchun (Soviet-aided,
  // built 1953–56; first Jiefang CA10 trucks July 1956): long red-brick assembly halls with ribbon steel windows and
  // glazed roof monitors, a power plant with tall chimneys, a water tower, the gate with red flags and slogan board,
  // poplar-lined road and a convoy of new olive CA10 trucks. 1 unit ≈ 100 m. Ref: zh Wikipedia "中国第一汽车集团",
  // "解放CA10"; 1956 Xinhua photos of the first trucks leaving the works.
  const h0 = ground(gp, 0.46, '#85826f', '#5d564a');
  const brick = '#8a4c3c', conc = '#a8a294', roof = '#5d5f5f';
  prism(gp, clipR([[-0.46, 0.22], [0.46, 0.22], [0.46, 0.33], [-0.46, 0.33]], 0.44), h0, 0.002, '#4e4e4b');
  for (let i = 0; i < 7; i++) box(gp, '#b8b3a2', -0.3 + i * 0.1, h0 + 0.002, 0.275, 0.04, 0.002, 0.004);
  // ---- main assembly hall (long, left/back) and press shop (right)
  const hall2 = (x: number, z: number, w: number, d: number, h: number) => {
    fbox(gp, x, h0, z, w, h, d, 0.006, brick, facade(brick, h, { fl: h, sp: 0.02, ww: 0.8, wh: 0.5, y0: 0, trim: conc, brick: [0.005, 0.013], roof }));
    box(gp, conc, x, h0 + h, z, w + 0.006, 0.006, d + 0.006);
    // raised glazed monitor (天窗) along the ridge
    fbox(gp, x, h0 + h + 0.006, z, w - 0.03, 0.018, d * 0.32, 0.006, '#3a444c', (_x, _y, _z, _nx, ny) => (ny > 0.5 ? roof : '#5a6a74'));
    box(gp, roof, x, h0 + h + 0.024, z, w - 0.026, 0.004, d * 0.36);
  };
  hall2(-0.12, -0.12, 0.52, 0.22, 0.1);
  hall2(0.27, -0.03, 0.18, 0.14, 0.085);
  // ---- power plant with two tall chimneys and a water tower
  fbox(gp, 0.22, h0, -0.27, 0.14, 0.15, 0.1, 0.006, brick, facade(brick, 0.15, { fl: 0.05, sp: 0.025, ww: 0.5, wh: 0.55, trim: conc, brick: [0.005, 0.013], roof }));
  for (const [x, k] of [[0.31, 0], [0.36, 1]] as const) {
    plathe(gp, [[0.02, 0], [0.012, 0.42], [0, 0.42]], conc, (_x, y) => (Math.abs(y - 0.4) < 0.012 ? '#6a6660' : shade(conc, 0.9 + (Math.floor(y * 60) % 2) * 0.06)), x, h0, -0.3 + k * 0.03, 14);
    smoke(gp, x, h0 + 0.47, -0.3 + k * 0.03, 0.045, '#8a8782', 6, 0.5);
  }
  const wx = -0.36, wz = 0.1;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rod(gp, [wx + a * 0.022, h0, wz + b * 0.022], [wx + a * 0.016, h0 + 0.15, wz + b * 0.016], 0.0045, conc, 5);
  lathe(gp, [[0, 0], [0.035, 0.0], [0.035, 0.04], [0.03, 0.05], [0, 0.056]], conc, wx, h0 + 0.15, wz, 16);
  // ---- gate: two pylons with red stars, slogan board, red flags
  const gx = 0.05, gz = 0.2;
  for (const s of [-1, 1]) {
    pbox(gp, gx + s * 0.07, h0, gz, 0.026, 0.11, 0.026, [4, 16, 4], conc, (_x, y) => shade(conc, 0.9 + (Math.floor((y + 1) * 80) % 4 === 0 ? -0.08 : 0.04)));
    const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.006 : 0.014; i ? st.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : st.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    add(gp, new THREE.ExtrudeGeometry(st, { depth: 0.003, bevelEnabled: false }), mat('#c0241c'), gx + s * 0.07, h0 + 0.125, gz + 0.012, 1, 1, 1);
    rod(gp, [gx + s * 0.14, h0, gz + 0.01], [gx + s * 0.14, h0 + 0.12, gz + 0.01], 0.002, '#8a8a8a', 4);
    box(gp, '#c0241c', gx + s * 0.14 + 0.014, h0 + 0.1, gz + 0.01, 0.026, 0.017, 0.002);
  }
  box(gp, '#c0241c', gx, h0 + 0.085, gz, 0.12, 0.018, 0.006);
  for (let k = 0; k < 7; k++) box(gp, '#f0e0a0', gx - 0.048 + k * 0.016, h0 + 0.089, gz + 0.0032, 0.01, 0.01, 0.001);
  // ---- poplars along the road and a convoy of new CA10 trucks leaving the works
  for (let i = 0; i < 9; i++) {
    const x = -0.4 + i * 0.1;
    if (Math.abs(x - gx) < 0.1) continue;
    for (const z of [0.21, 0.345]) if (Math.hypot(x, z) < 0.42) { rod(gp, [x, h0, z], [x, h0 + 0.03, z], 0.003, '#5a4a3a', 4); ellip(gp, '#5a6c3e', x, h0 + 0.065, z, 0.014, 0.045, 0.014); }
  }
  for (const [x, z] of [[-0.18, 0.258], [-0.07, 0.258], [0.08, 0.235], [0.2, 0.258]] as const) jiefang(gp, x, h0, z, z < 0.25 ? Math.PI / 2 : 0, x < 0);
  for (const [x, z] of [[-0.02, 0.3], [0.0, 0.305], [0.13, 0.3]]) person(gp, x, h0, z, { h: 0.018, pose: 'wave', top: '#3e4f66', bottom: '#3e4f66', hat: '#3e4f66', hatStyle: 'cap', ry: Math.PI * 0.9, detail: 'min' });
}

function oilfield(gp: THREE.Group): void {
  // Daqing oil field campaign 大庆石油会战 (1960): Wang Jinxi's 1205 drilling team and their Soviet-built 贝乌-40 rig — a
  // ~41 m tapering steel lattice derrick with V-door, drill floor, doghouse, pipe rack and mud pit (Wang famously
  // jumped in to mix the mud by body) — on the snowy Songnen steppe, with gandalei 干打垒 rammed-earth dwellings, oil
  // drums, a red flag and slogan board. 1 unit ≈ 100 m. Ref: zh Wikipedia "大庆油田", "王进喜", "干打垒"; 铁人纪念馆.
  const h0 = ground(gp, 0.46, '#8d8a66', '#5d564a');
  // wind-scoured snow lying in hollows
  for (const [x, z, a, b, k] of [[-0.25, -0.25, 0.11, 0.05, 1], [0.32, 0.1, 0.07, 0.04, 2], [0.12, -0.34, 0.09, 0.035, 3], [-0.36, 0.08, 0.05, 0.04, 4]] as const) {
    const pl: [number, number][] = [];
    for (let i = 0; i < 14; i++) { const t = (i / 14) * Math.PI * 2, rr = 0.6 + hash3(k, i, 7) * 0.5; pl.push([x + Math.cos(t) * a * rr, z + Math.sin(t) * b * rr]); }
    prism(gp, clipR(pl, 0.43), h0, 0.002, '#d6d4ca');
  }
  prism(gp, clipR([[-0.15, -0.12], [0.12, -0.12], [0.12, 0.08], [-0.15, 0.08]], 0.44), h0, 0.003, '#6e6656');
  // substructure, drill floor, derrick, crown block, red flag
  const dx = -0.02, dz = -0.03, fy = h0 + 0.03;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(gp, '#4a4f55', dx + a * 0.035, h0, dz + b * 0.035, 0.012, 0.03, 0.012);
  box(gp, '#5a5048', dx, fy, dz, 0.1, 0.006, 0.1);
  derrick(gp, dx, fy + 0.006, dz, 0.4, 0.085, 0.022, '#7a7f84');
  box(gp, '#4a4f55', dx, fy + 0.406, dz, 0.03, 0.012, 0.03);
  rod(gp, [dx, fy + 0.418, dz], [dx, fy + 0.46, dz], 0.002, '#5a4a3a', 4);
  box(gp, '#c0241c', dx + 0.016, fy + 0.44, dz, 0.03, 0.018, 0.002);
  box(gp, '#4a4f55', dx, fy + 0.25, dz - 0.03, 0.04, 0.003, 0.02);
  rod(gp, [dx, fy + 0.4, dz], [dx, fy + 0.04, dz], 0.0035, '#3a3a3a', 4);
  box(gp, '#3a3d40', dx, fy + 0.03, dz, 0.016, 0.024, 0.016);
  // drawworks & engine shed, doghouse, catwalk and pipe rack
  pbox(gp, dx, h0, dz - 0.09, 0.12, 0.05, 0.06, [12, 5, 6], '#6a5a44', (x, y, _z, _nx, ny) => (ny > 0.5 ? '#4e4a44' : shade('#6a5a44', 0.85 + (Math.floor((x + 1) * 120) % 2) * 0.12 + y)));
  box(gp, '#5d6a72', dx + 0.08, h0, dz + 0.0, 0.04, 0.035, 0.04);
  box(gp, '#5a5048', dx, h0 + 0.012, dz + 0.1, 0.03, 0.004, 0.11, 0, 0.26);
  for (let k = 0; k < 7; k++) { const p = add(gp, CYLX(6), mat('#5d6268', { metal: 0.4 }), dx, h0 + 0.006 + (k % 2) * 0.006, dz + 0.14, 0.006, 0.006, 0.2); p.rotation.y = Math.PI / 2; p.position.z = dz + 0.13 + k * 0.007; }
  // mud pit with Wang Jinxi stirring it with his body, and a crew member on the floor
  prism(gp, [[0.08, 0.04], [0.18, 0.04], [0.18, 0.1], [0.08, 0.1]], h0, 0.006, '#6a6258');
  prism(gp, [[0.087, 0.047], [0.173, 0.047], [0.173, 0.093], [0.087, 0.093]], h0 + 0.001, 0.006, '#3a342c');
  person(gp, 0.13, h0 - 0.008, 0.07, { h: 0.022, pose: 'wave', top: '#3a3f44', bottom: '#2e2a26', hat: '#3a3f44', hatStyle: 'fur', ry: 0.4, detail: 'min' });
  person(gp, dx + 0.02, fy + 0.006, dz + 0.02, { h: 0.02, pose: 'stand', top: '#3a3f44', bottom: '#2e2a26', hat: '#3a3f44', hatStyle: 'fur', ry: 0.6, detail: 'min' });
  person(gp, -0.12, h0, 0.12, { h: 0.02, pose: 'carry', top: '#3a3f44', bottom: '#2e2a26', hat: '#3a3f44', hatStyle: 'fur', ry: -0.6, detail: 'min' });
  // gandalei rammed-earth dwellings with flat clay roofs and stove pipes
  for (const [x, z, w] of [[-0.3, 0.22, 0.12], [-0.13, 0.3, 0.11], [0.22, 0.28, 0.1]] as const) {
    fbox(gp, x, h0, z, w, 0.03, 0.05, 0.006, '#9a8462', facade('#9a8462', 0.03, { fl: 0.03, sp: 0.035, ww: 0.3, wh: 0.4, roof: '#7d6a50', glass: '#3a3530' }));
    box(gp, '#7d6a50', x, h0 + 0.03, z, w + 0.006, 0.006, 0.056);
    cyl(gp, '#3a3a3a', x + w * 0.35, h0 + 0.036, z - 0.01, 0.003, 0.02, 6);
  }
  smoke(gp, -0.3 + 0.042, h0 + 0.07, 0.21, 0.02, '#cfcac0', 4, 0.45);
  // oil drums, slogan board, a GAZ-style truck
  for (let k = 0; k < 5; k++) cyl(gp, k % 2 ? '#4a5a44' : '#5a4a3a', 0.24 + (k % 3) * 0.018, h0, -0.12 + Math.floor(k / 3) * 0.018, 0.008, 0.024, 8);
  box(gp, '#c0241c', 0.27, h0 + 0.03, 0.0, 0.11, 0.03, 0.004, -0.4);
  for (let k = 0; k < 6; k++) box(gp, '#f0e0a0', 0.27 - 0.04 * Math.cos(0.4) + k * 0.016 * Math.cos(0.4), h0 + 0.04, 0.0 + 0.04 * Math.sin(0.4) - k * 0.016 * Math.sin(0.4) + 0.003, 0.01, 0.01, 0.001, -0.4);
  for (const s of [-1, 1]) rod(gp, [0.27 + s * 0.05 * Math.cos(0.4), h0, -s * 0.05 * Math.sin(0.4)], [0.27 + s * 0.05 * Math.cos(0.4), h0 + 0.045, -s * 0.05 * Math.sin(0.4)], 0.003, '#5a4a3a', 4);
  jiefang(gp, -0.28, h0, -0.06, 0.6, true);
}

const cz1 = (gp: THREE.Group, launch: boolean) => {
  // 长征一号 / 东方红一号, Jiuquan pad 138, 24 Apr 1970: 29.86 m, Ø2.25 m, two liquid stages (DF-4) + small solid
  // third stage under a pointed fairing, four tail fins, white with 中国 on the first stage; grey steel service tower
  // (1 m ≈ 0.0268 → people ≈ 0.045)
  const h0 = ground(gp, 0.46, '#b4a685', '#8a7a5e');
  tbox(gp, 0.56, 0.46, 0.52, 0.42, 0.02, '#a8a397', 0.02, h0, -0.02);
  const pt = h0 + 0.02, rx = 0.08, rz = 0.02, R = 0.03;
  box(gp, '#2e2e2c', rx, pt - 0.004, rz + 0.13, 0.08, 0.006, 0.12);
  for (const s of [-1, 1]) box(gp, '#8f8a7e', rx + s * 0.044, pt, rz + 0.13, 0.008, 0.006, 0.12);
  // launch table on four legs over the deflector
  box(gp, '#6c7176', rx, pt + 0.03, rz, 0.11, 0.012, 0.11);
  for (const s of [-1, 1]) for (const t of [-1, 1]) box(gp, '#6c7176', rx + s * 0.045, pt, rz + t * 0.045, 0.014, 0.03, 0.014);
  const by = pt + 0.06;
  const prof: [number, number][] = [[R * 0.85, -0.012], [R, 0], [R, 0.477], [R * 0.97, 0.49], [R * 0.97, 0.5], [R, 0.51], [R, 0.69], [R * 0.93, 0.715], [R * 0.72, 0.75], [R * 0.42, 0.78], [R * 0.12, 0.797], [0, 0.8]];
  plathe(gp, prof, '#eeede8', (x, y, z) => {
    if (y > 0.477 && y < 0.51) return '#3a3c40';
    if (Math.abs(y - 0.69) < 0.004) return '#3a3c40';
    if (Math.abs(y - 0.25) < 0.003) return '#c8ccd0';
    return '#eeede8';
  }, rx, by, rz, 24, { rough: 0.55 });
  // 中国 in red, read top-down on the camera side of the first stage
  const zc = rz + R - 0.0003, red = '#b8261e', st = 0.003, d = 0.002;
  const y1 = by + 0.37, y2 = by + 0.338;
  box(gp, red, rx, y1 - 0.004, zc, st, 0.026, d);
  for (const yy of [y1 + 0.003, y1 + 0.013]) box(gp, red, rx, yy, zc, 0.016, st, d);
  for (const s of [-1, 1]) box(gp, red, rx + s * 0.0065, y1 + 0.003, zc, st, 0.013, d);
  for (const yy of [y2, y2 + 0.021]) box(gp, red, rx, yy, zc, 0.019, st, d);
  for (const s of [-1, 1]) box(gp, red, rx + s * 0.008, y2, zc, st, 0.024, d);
  for (const yy of [y2 + 0.005, y2 + 0.0105, y2 + 0.016]) box(gp, red, rx, yy, zc, 0.01, 0.0025, d);
  box(gp, red, rx, y2 + 0.005, zc, 0.0025, 0.013, d);
  box(gp, red, rx + 0.004, y2 + 0.007, zc, 0.0025, 0.0025, d);
  // four YF-2 nozzles and four triangular tail fins
  for (const [s, t] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lathe(gp, [[0.005, 0], [0.011, -0.03], [0.0095, -0.03], [0.004, 0]], '#3e3e3e', rx + s * 0.012, by - 0.01, rz + t * 0.012, 10);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const fin = slab(gp, [[0, -0.01], [0.032, -0.01], [0.032, 0.0], [0, 0.07]], 0.004, '#e6e5e0', 0.001);
    fin.position.set(rx + Math.cos(a) * R * 0.95, by, rz + Math.sin(a) * R * 0.95);
    fin.rotation.y = -a;
  }
  // grey steel service tower with work platforms (Pad 138 umbilical/service structure)
  const tx = -0.13, tz = 0.0, TW = 0.1, TH = 0.86, nF = 9, tc = '#7c8086';
  for (const s of [-1, 1]) for (const t of [-1, 1]) rod(gp, [tx + s * TW / 2, pt, tz + t * TW / 2], [tx + s * TW / 2, pt + TH, tz + t * TW / 2], 0.0045, tc, 4);
  for (let i = 0; i <= nF; i++) {
    const y = pt + (i / nF) * TH;
    for (const s of [-1, 1]) { box(gp, tc, tx, y, tz + s * TW / 2, TW, 0.004, 0.004); box(gp, tc, tx + s * TW / 2, y, tz, 0.004, 0.004, TW); }
    box(gp, '#6a6e72', tx, y - 0.002, tz, TW - 0.008, 0.003, TW - 0.008);
    if (i < nF) {
      const y1 = pt + ((i + 1) / nF) * TH, f = i % 2 ? 1 : -1;
      for (const s of [-1, 1]) {
        rod(gp, [tx - f * TW / 2, y, tz + s * TW / 2], [tx + f * TW / 2, y1, tz + s * TW / 2], 0.0018, tc, 3);
        rod(gp, [tx + s * TW / 2, y, tz - f * TW / 2], [tx + s * TW / 2, y1, tz + f * TW / 2], 0.0018, tc, 3);
      }
    }
  }
  // working platforms reaching the rocket (swung back at launch)
  const armL = rx - R - 0.006 - (tx + TW / 2);
  for (const y of [0.2, 0.45, 0.62, 0.74]) {
    const ay = by + y;
    if (launch) { box(gp, '#6a6e72', tx + TW / 2 + 0.004, ay, tz, 0.008, 0.006, 0.07); continue; }
    box(gp, '#6a6e72', tx + TW / 2 + armL / 2, ay, rz, armL, 0.005, 0.05);
    for (const s of [-1, 1]) rod(gp, [tx + TW / 2, ay + 0.02, rz + s * 0.024], [tx + TW / 2 + armL, ay + 0.02, rz + s * 0.024], 0.0012, '#b8261e', 3);
  }
  rod(gp, [tx, pt + TH, tz], [tx, pt + TH + 0.08, tz], 0.0025, tc, 4);
  // cable mast, low concrete bunker (blockhouse) and a trolley rail
  rod(gp, [0.34, h0, -0.24], [0.34, h0 + 0.55, -0.24], 0.004, '#8a8a84', 5);
  box(gp, '#9c968a', -0.3, h0, 0.25, 0.14, 0.05, 0.09);
  box(gp, '#8a8578', -0.27, h0 + 0.05, 0.22, 0.15, 0.008, 0.1);
  box(gp, '#3a3a38', -0.3, h0, 0.2955, 0.022, 0.03, 0.002);
  for (const s of [-1, 1]) box(gp, '#3a3a38', -0.3 + s * 0.045, h0 + 0.03, 0.2955, 0.02, 0.008, 0.002);
  for (const s of [-1, 1]) box(gp, '#5a5a58', 0.27 + s * 0.012, h0, 0.05, 0.004, 0.003, 0.38);
  // 1970 launch crew in blue work clothes and PLA green
  for (const [x, z, ry, c] of [[0.24, 0.24, -0.5, '#3a4a6a'], [0.28, 0.2, -0.9, '#4a5a3a'], [-0.18, 0.28, 0.3, '#3a4a6a']] as const)
    person(gp, x, h0, z, { h: 0.045, pose: 'stand', top: c, bottom: c, hat: c, hatStyle: 'cap', ry, detail: 'lo' });
  if (launch) {
    const fl = flame(gp, rx, by - 0.04, rz, 0.0);
    fl.rotation.x = Math.PI; fl.clear();
    add(fl, FCONE(), mat('#f59e0b', { emissive: '#f97316' }), 0, 0, 0, 0.05, 0.12, 0.05);
    add(fl, FCONE(), mat('#fff3c4', { emissive: '#ffe08a' }), 0, 0, 0, 0.025, 0.08, 0.025);
    smoke(gp, rx, pt + 0.04, rz + 0.14, 0.07, '#e4dfd4', 8, 0.7);
  }
};

const rocket: Builder = (gp, r) => {
  const launch = r.style === 'launch' || r.launch === true;
  if (r.style === 'cz2f' || r.style === 'shenzhou') cz2f(gp, launch);
  else cz1(gp, launch);
};

const cz2f = (gp: THREE.Group, launch: boolean) => {
  // Long March 2F (长征二号F) on the Jiuquan pad: white core with stages and fairing, escape tower, four boosters,
  // red umbilical tower with swing arms, flame trench (58.3 m → 1 m ≈ 0.0142, so people ≈ 0.025)
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
  for (const [x, z, ry] of [[0.3, 0.2, -0.6], [0.34, 0.15, -0.9], [-0.18, 0.3, 0.3]] as const) person(gp, x, h0, z, { h: 0.026, pose: 'stand', top: '#2a5a9a', bottom: '#2a5a9a', hat: '#e8e8e8', hatStyle: 'helmet', ry, detail: 'lo' });
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
  }
};

const stadium: Builder = gp => {
  // Beijing National Stadium (鸟巢, Herzog & de Meuron, 2008): 333 × 294 m ellipse, saddle roof 68.5 m at the middle of
  // the long E/W sides dipping to 42.8 m at the N/S ends; grey box-section steel weave, red inner wall, ETFE roof.
  // At this scale (1 m ≈ 0.0023) people are sub-pixel, so the plaza is shown empty
  const h0 = ground(gp, 0.46, '#c9c4b8', '#8f8a80');
  const A = 0.39, B = 0.3, N = 64;
  const H = (t: number) => 0.13 * (1 - 0.23 * Math.cos(2 * t));
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
  for (let j = 0; j <= 16; j++) {
    const u = j / 16, ring: V3[] = [];
    for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; ring.push([(0.17 + 0.15 * u) * Math.cos(t), h0 + 0.012 + 0.1 * u ** 1.15, (0.11 + 0.13 * u) * Math.sin(t)]); }
    bowl.push(ring);
  }
  // lower / middle / upper tiers of red seats split by grey concourse bands and radial aisles
  skin(gp, bowl, '#9e2a22', {
    closed: true, inward: true, paint: (x, y, z) => {
      const u = Math.pow(Math.max(0, (y - h0 - 0.012) / 0.1), 1 / 1.15), j = Math.floor(u * 16);
      if (j === 6 || j === 11) return '#8a857c';
      if (((Math.atan2(z / 0.24, x / 0.32) / (Math.PI * 2) * 40 + 40) % 1) < 0.12) return '#7a746c';
      return shade('#9e2a22', j % 2 ? 0.86 : 0.98);
    },
  });
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
  // plaza: granite paving rings and a few rows of young trees
  for (const k of [1.12, 1.2]) {
    const ring: [number, number][] = Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return [A * k * Math.cos(t), B * k * Math.sin(t)]; });
    prism(gp, clipR(ring, 0.44), h0, 0.0015, k > 1.15 ? '#b8b3a6' : '#d2cdc0');
  }
  for (const [x, z] of [[-0.42, 0.14], [-0.43, 0.06], [0.42, 0.12], [0.43, 0.04], [-0.38, -0.24], [0.38, -0.25], [-0.2, -0.39], [-0.12, -0.41], [0.18, -0.4], [0.1, -0.42]] as const) leafTree(gp, x * 0.9, h0, z * 0.9, 0.07, '#5d7040', Math.round(x * 50));
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

const lujiazui = (gp: THREE.Group) => {
  // Shanghai Lujiazui (陆家嘴) seen from the Bund across the Huangpu: Oriental Pearl (468 m, 1994), Jin Mao (421 m, 1999),
  // SWFC "bottle opener" (492 m, 2008), Shanghai Tower (632 m, 2015, 120° twist). 1 m ≈ 0.0013, so people are omitted
  const h0 = ground(gp, 0.46, '#8a8f86', '#5a5e58');
  water(gp, clipR([[-0.46, 0.1], [-0.2, 0.14], [0.1, 0.13], [0.46, 0.08], [0.46, 0.3], [0.1, 0.33], [-0.2, 0.33], [-0.46, 0.3]], 0.455), h0, '#56707a');
  prism(gp, clipR([[-0.46, 0.06], [-0.2, 0.1], [0.1, 0.09], [0.46, 0.04], [0.46, 0.08], [0.1, 0.13], [-0.2, 0.14], [-0.46, 0.1]], 0.455), h0, 0.005, '#b8b2a6');
  for (let i = 0; i < 16; i++) { const x = -0.4 + i * 0.053; cyl(gp, '#46613a', x, h0 + 0.005, 0.095 - Math.max(0, x) * 0.08 + 0.01, 0.008, 0.016, 6); }
  // the Bund promenade (flood wall) in front
  prism(gp, clipR([[-0.46, 0.33], [0.46, 0.3], [0.46, 0.46], [-0.46, 0.46]], 0.455), h0, 0.006, '#a8a294');
  box(gp, '#c8c3b6', 0, h0 + 0.006, 0.335, 0.6, 0.004, 0.006);
  // Huangpu sightseeing boat (≈ 50 m) and a sand barge
  const bt = grp(gp, 0.16, 0.22, 0.12, h0);
  skin(bt, [-1, -0.6, 0, 0.6, 1].map(t => { const w = 0.011 * (1 - Math.abs(t) ** 3 * 0.7); return [[t * 0.035, 0.002, -w * 0.7], [t * 0.035, 0.007, -w], [t * 0.035, 0.007, w], [t * 0.035, 0.002, w * 0.7]] as V3[]; }), '#ecebe6', { caps: true });
  pbox(bt, -0.004, 0.007, 0, 0.05, 0.008, 0.018, [6, 1, 2], '#ecebe6', (_x, y, _z, _nx, ny) => ny > 0.5 ? '#8a8e92' : Math.abs(y) < 0.0015 ? '#3e4a52' : '#ecebe6');
  pbox(bt, -0.004, 0.015, 0, 0.034, 0.006, 0.014, [4, 1, 2], '#ecebe6', (_x, y, _z, _nx, ny) => ny > 0.5 ? '#8a8e92' : Math.abs(y) < 0.0012 ? '#3e4a52' : '#ecebe6');
  const bg = grp(gp, -0.22, 0.27, -0.05, h0);
  box(bg, '#3e3a34', 0, 0, 0, 0.06, 0.005, 0.014);
  box(bg, '#8a7a5e', -0.004, 0.005, 0, 0.042, 0.003, 0.01);
  box(bg, '#e4e2dc', 0.024, 0.005, 0, 0.01, 0.007, 0.012);
  // ---- Oriental Pearl Tower (东方明珠): three columns, three raked legs, pink spheres
  const ox = -0.22, oz = -0.02, pink = '#a8607a';
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + Math.PI / 2;
    rod(gp, [ox + Math.cos(a) * 0.016, h0, oz + Math.sin(a) * 0.016], [ox + Math.cos(a) * 0.012, h0 + 0.38, oz + Math.sin(a) * 0.012], 0.0065, '#e4e0d6', 8);
    rod(gp, [ox + Math.cos(a + Math.PI / 3) * 0.075, h0, oz + Math.sin(a + Math.PI / 3) * 0.075], [ox + Math.cos(a + Math.PI / 3) * 0.02, h0 + 0.09, oz + Math.sin(a + Math.PI / 3) * 0.02], 0.005, '#e4e0d6', 6);
    ellip(gp, pink, ox + Math.cos(a) * 0.014, h0 + 0.24, oz + Math.sin(a) * 0.014, 0.011).material = mat(pink, { metal: 0.5, rough: 0.25 });
  }
  for (const [y, r2] of [[0.117, 0.034], [0.34, 0.03], [0.46, 0.011]] as const) {
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
  lathe(gp, [[jw * 0.6, 0], [jw * 0.35, 0.02], [0.002, 0.05], [0, 0.055]], '#9aa0a6', jx, jy, jz, 8);
  // ---- Shanghai World Financial Center (环球金融中心): square base tapering to a blade with the trapezoid opening
  const sx = 0.13, sz = -0.13, SH = 0.64;
  const swfc: V3[][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * 0.86, ex = 0.04 * (1 - 0.08 * t), ez = 0.04 * (1 - 0.9 * t), c = 0.01 * (1 - t);
    swfc.push([[ex, ez - c], [ex - c, ez], [-ex + c, ez], [-ex, ez - c], [-ex, -ez + c], [-ex + c, -ez], [ex - c, -ez], [ex, -ez + c]].map(([x, z]) => {
      const a = Math.PI / 4 - 0.4, ca = Math.cos(a), sa = Math.sin(a);
      return [sx + x * ca - z * sa, h0 + t * SH, sz + x * sa + z * ca] as V3;
    }));
  }
  skin(gp, swfc, '#8fa6b5', { caps: true, paint: () => '#9fb4c2', metal: 0.4, rough: 0.2 });
  {
    const a = Math.PI / 4 - 0.4, top = grp(gp, sx, sz, -a, h0 + 0.86 * SH), ex = 0.04 * (1 - 0.08 * 0.86), oh = SH * 0.14;
    for (const s of [-1, 1]) box(top, '#9fb5c4', s * (ex - 0.01), 0, 0, 0.02, oh, 0.0062);
    box(top, '#9fb5c4', 0, oh - 0.012, 0, ex * 2 - 0.004, 0.012, 0.0062);
  }
  // ---- Shanghai Tower (上海中心): rounded triangle twisting 120° as it tapers, notch up one side
  const tx = 0.05, tz = -0.03, TH = 0.82;
  const tw: V3[][] = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36, rot = t * Math.PI * 2 / 3, R0 = 0.052 * (1 - 0.42 * t), ring: V3[] = [];
    for (let k = 0; k < 30; k++) {
      const ph = (k / 30) * Math.PI * 2;
      const dn = ((ph - rot - Math.PI / 3 + Math.PI * 4) % (Math.PI * 2)) - Math.PI;
      const r2 = R0 * (1 + 0.11 * Math.cos(3 * (ph - rot))) * (1 - 0.26 * Math.exp(-(dn * dn) * 40));
      ring.push([tx + Math.cos(ph) * r2, h0 + t * TH, tz + Math.sin(ph) * r2]);
    }
    tw.push(ring);
  }
  // nine vertical zones, each topped by a darker mechanical/refuge floor (4 rings per zone keep the bands clean)
  skin(gp, tw, '#9db3c0', { caps: true, metal: 0.45, rough: 0.2, paint: (_x, y) => (((y - h0) / TH) * 9) % 1 > 0.75 ? '#8197a4' : '#b0c4cf' });
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

const shenzhen = (gp: THREE.Group) => {
  // Shenzhen in 1992 (邓小平南巡): 国贸大厦 (1985, 160 m, 53 floors, "三天一层") with its revolving restaurant and
  // helipad, 1980s white-tiled ribbon-window towers, tower cranes, 深南大道 and the 红岭路 Deng Xiaoping billboard
  // ("坚持党的基本路线一百年不动摇", 1992). 1 m ≈ 0.0028 → people omitted
  const h0 = ground(gp, 0.46, '#8e8c80', '#5e5c54');
  // Shennan Avenue with a planted median and kerb trees
  prism(gp, clipR([[-0.46, 0.17], [0.46, 0.17], [0.46, 0.3], [-0.46, 0.3]], 0.455), h0, 0.002, '#4e4e4c');
  prism(gp, clipR([[-0.46, 0.228], [0.46, 0.228], [0.46, 0.242], [-0.46, 0.242]], 0.455), h0, 0.004, '#5c7040');
  for (let i = 0; i < 18; i++) for (const zz of [0.2, 0.27]) { const x = -0.42 + i * 0.05; if (Math.hypot(x, zz) < 0.43) box(gp, '#d8d4c8', x, h0 + 0.002, zz, 0.018, 0.0008, 0.002); }
  for (let i = 0; i < 16; i++) for (const zz of [0.16, 0.31]) { const x = -0.4 + i * 0.054; if (Math.hypot(x, zz) < 0.42) leafTree(gp, x, h0, zz, 0.04, '#4f6a38', i); }
  // vehicles: buses, a Santana and a truck
  for (const [x, z, l, c] of [[-0.2, 0.205, 0.03, '#d8d0b8'], [0.08, 0.21, 0.014, '#3a3e48'], [0.25, 0.262, 0.03, '#c8382e'], [-0.05, 0.265, 0.022, '#4a6a4a']] as const) box(gp, c, x, h0 + 0.002, z, l, 0.009, 0.009);
  // 国贸大厦: square tower, white vertical piers and dark tinted glass, chamfered corners
  const gx = 0.03, gz = -0.06, GW = 0.1, GH = 0.42;
  box(gp, '#46525c', gx, h0, gz, GW, GH, GW);
  for (let k = 0; k < 7; k++) {
    const u = -GW / 2 + 0.008 + k * (GW - 0.016) / 6;
    for (const s of [-1, 1]) { box(gp, '#e2ded2', gx + u, h0, gz + s * (GW / 2 + 0.001), 0.0045, GH, 0.004); box(gp, '#e2ded2', gx + s * (GW / 2 + 0.001), h0, gz + u, 0.004, GH, 0.0045); }
  }
  for (const yy of [0.12, 0.27]) box(gp, '#d6d2c6', gx, h0 + yy, gz, GW + 0.006, 0.006, GW + 0.006);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(gp, '#d6d2c6', gx + sx * GW / 2, h0, gz + sz * GW / 2, 0.016, GH, 0.016, Math.PI / 4);
  // podium, revolving restaurant drum (49F) and helipad
  box(gp, '#3e4850', gx, h0, gz + 0.02, 0.196, 0.016, 0.166);
  box(gp, '#cfc9bb', gx, h0 + 0.016, gz + 0.02, 0.2, 0.019, 0.17);
  cyl(gp, '#cfcac0', gx, h0 + GH, gz, 0.05, 0.006, 24);
  cyl(gp, '#3e4a52', gx, h0 + GH + 0.006, gz, 0.054, 0.016, 28);
  cyl(gp, '#d8d4ca', gx, h0 + GH + 0.022, gz, 0.056, 0.004, 28);
  cyl(gp, '#9a9a94', gx, h0 + GH + 0.026, gz, 0.042, 0.012, 20);
  cyl(gp, '#5a5c5a', gx, h0 + GH + 0.038, gz, 0.046, 0.003, 24);
  for (const s of [-1, 1]) box(gp, '#e8c64a', gx + s * 0.008, h0 + GH + 0.041, gz, 0.004, 0.0006, 0.024);
  box(gp, '#e8c64a', gx, h0 + GH + 0.041, gz, 0.016, 0.0006, 0.004);
  rod(gp, [gx + 0.03, h0 + GH + 0.04, gz - 0.02], [gx + 0.03, h0 + GH + 0.08, gz - 0.02], 0.0025, '#b8b8b2', 4);
  // 1980s towers: white mosaic tile, ribbon windows, blue glass on a few
  // floors aligned to the cell grid (2 cells per storey) so per-face paint gives clean ribbon windows
  const ribbon = (c: string, g: string, h: number, n: number): Paint => (_x, y, _z, _nx, ny) => ny > 0.5 ? '#8e8c84' : (((y + h / 2) / (h / n)) % 1) < 0.5 ? g : c;
  const blk: [number, number, number, number, number, string, string][] = [
    [-0.27, -0.18, 0.09, 0.24, 0.07, '#e0dccf', '#4a5864'], [-0.15, -0.3, 0.07, 0.18, 0.07, '#d8cfbc', '#56626a'], [0.25, -0.2, 0.08, 0.27, 0.08, '#e4e2da', '#3e5a72'],
    [0.33, -0.02, 0.07, 0.14, 0.09, '#d4cbb6', '#4e5a62'], [-0.33, 0.02, 0.09, 0.1, 0.07, '#cfc6b2', '#4e5a62'], [0.16, -0.33, 0.07, 0.2, 0.06, '#e0dccf', '#4a5864'],
    [-0.14, -0.08, 0.07, 0.16, 0.07, '#d8d2c4', '#3a5068'], [0.2, 0.05, 0.08, 0.08, 0.06, '#cfc6b2', '#4e5a62'],
  ];
  for (const [x, z, w, h, d, c, g] of blk) {
    const n = Math.round(h / 0.0085);
    pbox(gp, x, h0, z, w, h, d, [3, n * 2, 3], c, ribbon(c, g, h, n), 0.12);
    box(gp, '#a8a49a', x + w * 0.2, h0 + h, z, w * 0.3, 0.012, d * 0.4);
  }
  // a tower under construction with two climbing cranes
  const cx = -0.03, cz = -0.3;
  pbox(gp, cx, h0, cz, 0.07, 0.17, 0.07, [3, 40, 3], '#9a968c', ribbon('#a8a498', '#5a5650', 0.17, 20));
  for (const [mx, mz, mh, ry] of [[cx + 0.045, cz, 0.3, 0.6], [-0.22, -0.36, 0.26, -0.4]] as const) {
    for (const s of [-1, 1]) for (const t of [-1, 1]) rod(gp, [mx + s * 0.004, h0, mz + t * 0.004], [mx + s * 0.004, h0 + mh, mz + t * 0.004], 0.0015, '#d8b02a', 3);
    const jb = grp(gp, mx, mz, ry, h0 + mh);
    box(jb, '#d8b02a', 0.05, 0, 0, 0.16, 0.006, 0.006);
    box(jb, '#d8b02a', -0.05, 0, 0, 0.05, 0.006, 0.006);
    box(jb, '#8a8a84', -0.065, -0.012, 0, 0.018, 0.012, 0.012);
    box(jb, '#3e4248', -0.006, -0.012, 0.008, 0.012, 0.01, 0.01);
    rod(jb, [0, 0, 0], [0, 0.03, 0], 0.0015, '#d8b02a', 3);
  }
  // Deng Xiaoping billboard on Hongling Road (left, facing the avenue)
  const bb = grp(gp, -0.28, 0.12, 0.25, h0);
  for (const s of [-1, 1]) box(bb, '#6a6e72', s * 0.05, 0, 0, 0.008, 0.035, 0.008);
  pbox(bb, 0, 0.035, 0, 0.15, 0.055, 0.008, [40, 16, 1], '#9ab8cc', (x, y, _z, _nx, _ny, nz) => {
    if (nz < 0.5) return '#7a7e82';
    if (Math.abs(x) > 0.071 || Math.abs(y) > 0.024) return '#e8e4da';
    const hx = x - 0.042, hy = y - 0.005;
    if (hx * hx + (hy * 0.8) ** 2 < 0.0075 ** 2) return hy > 0.005 ? '#3a3a3a' : '#c89a78';
    if (x > 0.022 && x < 0.064 && y < -0.001) return '#5a5c58';
    if (y < -0.012 && x < 0.018) return '#b8261e';
    if (y < -0.006 && x < 0.018 && Math.abs(x + 0.03) < 0.04) return ((x + 1) * 160) % 1 < 0.5 ? '#9aa6ae' : '#c6d4dc';
    if (y > 0.006 && y < 0.016 && x < 0.016 && x > -0.066) return ((x + 1) / 0.009) % 1 < 0.75 ? '#c42a1e' : '#9ab8cc';
    return '#9ab8cc';
  });
};

const skyline: Builder = (gp, r) => (r.style === 'shenzhen' ? shenzhen(gp) : lujiazui(gp));

const dam: Builder = gp => {
  // Three Gorges Dam (三峡大坝, 2006), seen from downstream: 2309 m straight concrete gravity dam, 181 m high (height
  // exaggerated ~2×), central spillway (23 deep outlets, 22 surface gates) between the left/right powerhouses, crest
  // gantry cranes; on the left (north) bank the five-step double-lane ship lock cut into granite with a central rock pier
  const h0 = ground(gp, 0.46, '#6c7454', '#5a4a34');
  const CR = 0.12, WL = 0.112, TW = 0.022, zd = -0.07, x0 = -0.42, x1 = 0.25;
  const rock = (k: number) => rockPaint('#8a8676', '#566a40', k);
  // gorge mountains (upstream, partly drowned by the reservoir) and the right-bank shoulder
  lump(gp, -0.23, h0, -0.24, 0.13, 0.24, 0.09, '#5f6e44', { seed: 1, rough: 0.25, paint: rock(1) });
  lump(gp, 0.04, h0, -0.36, 0.22, 0.2, 0.06, '#5f6e44', { seed: 5, rough: 0.25, paint: rock(5) });
  lump(gp, 0.26, h0, -0.23, 0.11, 0.22, 0.09, '#5f6e44', { seed: 2, rough: 0.25, paint: rock(2) });
  // banks below the dam (raised above the tailwater) and the right-bank abutment
  const bank = (pl: [number, number][], h: number, c: string) => prism(gp, clipR(pl, 0.455), h0, h, c);
  bank([[-0.46, zd - 0.008], [x0 + 0.004, zd - 0.008], [x0 + 0.004, zd + 0.06], [-0.46, zd + 0.06]], CR + 0.005, '#7f7a6a');
  bank([[-0.46, zd + 0.06], [-0.36, zd + 0.06], [-0.28, 0.22], [-0.16, 0.46], [-0.46, 0.46]], TW + 0.008, '#66704a');
  bank([[0.08, 0.46], [0.16, 0.36], [0.3, 0.3], [0.38, 0.2], [0.46, 0.2], [0.46, 0.46]], TW + 0.008, '#66704a');
  lump(gp, -0.33, h0 + TW + 0.008, 0.15, 0.05, 0.08, 0.1, '#5f6e44', { seed: 4, rough: 0.25, paint: rock(4) });
  lump(gp, 0.26, h0 + TW + 0.008, 0.3, 0.06, 0.05, 0.05, '#5f6e44', { seed: 6, rough: 0.25, paint: rock(6) });
  // reservoir (175 m pool) behind the dam
  water(gp, clipR([[-0.46, zd - 0.008], [0.46, zd - 0.008], [0.46, -0.46], [-0.46, -0.46]], 0.455), h0, '#3e6670', WL);
  // downstream Yangtze and the lock's lower approach channel
  water(gp, clipR([[-0.36, zd + 0.06], [0.24, zd + 0.06], [0.25, 0.2], [0.38, 0.2], [0.3, 0.3], [0.16, 0.36], [0.08, 0.46], [-0.16, 0.46], [-0.28, 0.22]], 0.455), h0, '#56787a', TW);
  // ---- dam body: vertical upstream face, 0.75 downstream slope, extruded along x
  const DL = x1 - x0, xm = (x0 + x1) / 2, toe = 0.085;
  const D = grp(gp, xm, zd, Math.PI / 2);
  const body = slab(D, [[0.008, 0], [0.008, CR], [-0.008, CR], [-0.008, CR - 0.012], [-toe, 0]], DL, P.concrete, 0, false);
  body.geometry = paintFaces(body.geometry, P.concrete, (x, y, _z, _nx, ny) => shade('#a9a69c', (ny > 0.3 && ny < 0.95 ? 0.92 : 1) + (hash3(Math.floor(x * 30), Math.floor(y * 40), 2) - 0.5) * 0.06));
  body.material = mat('#ffffff', { vc: true, rough: 0.9 });
  // block joints every ~20 m down the face (vertical seams)
  for (let x = x0 + 0.03; x < x1 - 0.01; x += 0.03) {
    const g = grp(gp, x, zd + 0.008, 0, h0);
    const sl = Math.atan2(CR - 0.012, toe - 0.008);
    box(g, '#8e8b82', 0, 0, (toe - 0.008) / 2, 0.0025, 0.002, Math.hypot(CR - 0.012, toe - 0.008), 0, -sl);
  }
  // crest road, parapets and three gantry cranes
  box(gp, '#8e8b84', xm, h0 + CR, zd, DL, 0.004, 0.018);
  for (const s of [-1, 1]) box(gp, '#d4d0c6', xm, h0 + CR + 0.004, zd + s * 0.008, DL, 0.003, 0.002);
  for (const x of [-0.25, -0.03, 0.15]) {
    for (const s of [-1, 1]) for (const t of [-1, 1]) rod(gp, [x + s * 0.01, h0 + CR, zd + t * 0.007], [x + s * 0.01, h0 + CR + 0.03, zd + t * 0.007], 0.0018, '#c9a032', 4);
    box(gp, '#c9a032', x, h0 + CR + 0.03, zd, 0.026, 0.005, 0.02);
    box(gp, '#6a6e72', x + 0.004, h0 + CR + 0.035, zd, 0.01, 0.007, 0.01);
  }
  // ---- spillway section over the old river channel: piers, surface gates, deep-outlet jets, stilling basin
  const sx0 = -0.13, sx1 = 0.05, nB = 11, bw = (sx1 - sx0) / nB, sl = Math.atan2(CR - 0.012, toe - 0.008);
  for (let i = 0; i <= nB; i++) {
    const x = sx0 + i * bw;
    const g = grp(gp, x, zd + 0.008, 0, h0);
    box(g, '#b8b5ac', 0, 0.001, (toe - 0.008) / 2, 0.004, 0.007, Math.hypot(CR - 0.012, toe - 0.008), 0, -sl);
    box(gp, '#b8b5ac', x, h0 + CR, zd - 0.006, 0.004, 0.016, 0.012);
  }
  for (let i = 0; i < nB; i++) {
    const x = sx0 + (i + 0.5) * bw;
    box(gp, '#2e3236', x, h0 + CR - 0.01, zd - 0.0085, bw - 0.006, 0.008, 0.002);
    // deep outlet on the face and its white jet arcing into the basin
    const fz = zd + 0.008 + (toe - 0.008) * (1 - 0.055 / (CR - 0.012)), fy = h0 + 0.055;
    box(gp, '#2a2e33', x, fy - 0.004, fz, bw * 0.45, 0.008, 0.004, 0, -(Math.PI / 2 - sl));
    if (i % 2 === 0) {
      const jet = tube(gp, [[x, fy, fz + 0.004], [x, fy + 0.002, fz + 0.03], [x, h0 + 0.035, fz + 0.06], [x, h0 + TW, fz + 0.08]], 0.004, 0.009, '#eef3f2', { radial: 6, sub: 3 });
      jet.material = mat('#eef3f2', { transparent: 0.8 });
    }
  }
  box(gp, '#9a978e', sx0 - 0.004, h0, zd + toe + 0.04, 0.006, TW + 0.006, 0.09);
  box(gp, '#9a978e', sx1 + 0.004, h0, zd + toe + 0.04, 0.006, TW + 0.006, 0.09);
  for (let i = 0; i < 12; i++) {
    const x = sx0 + 0.01 + (i / 11) * (sx1 - sx0 - 0.02);
    ellip(gp, '#ffffff', x, h0 + TW, zd + toe + 0.03 + (i % 3) * 0.018, 0.016, 0.006 + (i % 2) * 0.003, 0.014).material = mat('#ffffff', { transparent: 0.8 });
  }
  smoke(gp, (sx0 + sx1) / 2, h0 + TW, zd + toe + 0.05, 0.035, '#ffffff', 6, 0.35);
  // ---- powerhouses at the toe: right bank (14 units) and left bank (12 units), tailrace below
  for (const [xa, xb, n] of [[x0 + 0.02, sx0 - 0.01, 14], [sx1 + 0.01, x1 - 0.02, 12]] as const) {
    const w = xb - xa, xc = (xa + xb) / 2, z = zd + toe + 0.012;
    box(gp, '#cfccc2', xc, h0, z, w, 0.04, 0.03);
    box(gp, '#6a7a7a', xc, h0 + 0.04, z, w + 0.004, 0.004, 0.034);
    box(gp, '#3e4a52', xc, h0 + 0.028, z + 0.0152, w - 0.006, 0.006, 0.001);
    for (let k = 0; k < n; k++) box(gp, '#2e3236', xa + (k + 0.5) * (w / n), h0, z + 0.0152, w / n * 0.5, TW + 0.002, 0.002);
    // switchyard and penstock intakes on the crest side
    for (let k = 0; k < n; k++) box(gp, '#7a7e82', xa + (k + 0.5) * (w / n), h0 + CR - 0.03, zd + 0.008 + (toe - 0.008) * (0.03 / (CR - 0.012)) + 0.002, w / n * 0.4, 0.012, 0.004, 0, -(Math.PI / 2 - sl));
  }
  // ---- five-step double-lane ship lock cut into the left-bank granite (two lanes, central rock pier)
  const LZ0 = zd - 0.008, LZ1 = 0.2, nS = 5, cl = (LZ1 - LZ0) / nS, lanes = [0.31, 0.36], LW = 0.024;
  const lvl = (i: number) => WL - (i + 0.5) * (WL - TW) / nS;
  const top = (i: number) => Math.max(lvl(i) + 0.03, 0.06);
  for (let i = 0; i < nS; i++) {
    const z = LZ0 + (i + 0.5) * cl;
    // rock walls (outer blocks and the central pier) stepping down with the chambers, concrete-lined inner faces
    for (const [xa, xb] of [[0.25, lanes[0] - LW / 2], [lanes[0] + LW / 2, lanes[1] - LW / 2], [lanes[1] + LW / 2, 0.46]] as const) {
      const pl = clipR([[xa, z - cl / 2], [xb, z - cl / 2], [xb, z + cl / 2], [xa, z + cl / 2]], 0.455);
      if (pl.length < 3) continue;
      const m = prism(gp, pl, h0, top(i), '#8a8576');
      m.geometry = paintFaces(m.geometry, '#8a8576', (_x, _y, _z, _nx, ny) => (ny > 0.5 ? '#6a7046' : '#8a8576'));
      m.material = mat('#ffffff', { vc: true, rough: 0.95 });
    }
    for (const x of lanes) {
      water(gp, [[x - LW / 2, z - cl / 2], [x + LW / 2, z - cl / 2], [x + LW / 2, z + cl / 2], [x - LW / 2, z + cl / 2]], h0, '#456a72', lvl(i));
      for (const s of [-1, 1]) box(gp, '#b4b0a6', x + s * (LW / 2 - 0.0008), h0, z, 0.0016, top(i), cl);
      // mitre gates at the upstream end of each chamber
      box(gp, '#3a3e42', x, h0, z - cl / 2, LW, (i ? lvl(i - 1) : WL) + 0.008, 0.004);
    }
    // vessels waiting in the chambers (≈ 100 m barges, 1 m ≈ 0.00026, widths exaggerated with the lock)
    if (i % 2 === 0) for (const [k, x] of lanes.entries()) {
      const y = h0 + lvl(i);
      box(gp, k ? '#3e4e5e' : '#5a3e32', x, y, z + 0.004, 0.012, 0.004, 0.03);
      box(gp, '#e8e6e0', x, y + 0.004, z + 0.014, 0.01, 0.006, 0.008);
    }
  }
  box(gp, '#3a3e42', lanes[0], h0, LZ1, LW, lvl(nS - 1) + 0.008, 0.004);
  box(gp, '#3a3e42', lanes[1], h0, LZ1, LW, lvl(nS - 1) + 0.008, 0.004);
  // rock between dam end and the lock, and the right-bank abutment
  prism(gp, clipR([[x1 - 0.004, zd - 0.008], [0.25, zd - 0.008], [0.25, 0.2], [0.24, 0.18], [x1 - 0.004, zd + 0.06]], 0.455), h0, CR + 0.005, '#7f7a6a');
  lump(gp, 0.25, h0 + CR, 0.02, 0.03, 0.03, 0.08, '#5f6e44', { seed: 7, rough: 0.25, paint: rock(7) });
  // a Yangtze cruise ship below the dam
  const sh = grp(gp, -0.08, 0.3, 0.15, h0 + TW);
  box(sh, '#ecebe6', 0, 0, 0, 0.012, 0.005, 0.034);
  box(sh, '#ecebe6', 0, 0.005, -0.002, 0.01, 0.006, 0.024);
  box(sh, '#3e4a52', 0, 0.0075, -0.002, 0.0102, 0.0015, 0.0242);
};

export const RICH2: Record<string, Builder> = { cave, stilt, jade, oracle, weir, train, factory, rocket, stadium, skyline, dam };
