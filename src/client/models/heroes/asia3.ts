import { human, passerby } from '../human.ts';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, rod, sweep, lathe, skin, 
  paintFaces, shade, mix, fbm, hash3,
} from '../prims.ts';
import { sstep } from '../nature.ts';
import { pblob } from '../animals.ts';

// Hero builders for: goldentemple, watarun, burjalarab, terracotta, leshan, tigersnest, bagan.
// Keyed by catalogue item key (recipe.hero). Front faces +z, base at y=0, footprint radius ≈0.5.

// ---------------------------------------------------------------------------------------------------------
// Shared helpers

/** Child group placed at (x, z) and turned by ry — lets axis-aligned helpers build rotated parts. */
function grp(p: THREE.Object3D, x: number, z: number, ry = 0, y = 0): THREE.Group {
  const gr = new THREE.Group();
  gr.position.set(x, y, z);
  gr.rotation.y = ry;
  p.add(gr);
  return gr;
}

/** Moves a fresh geometry into place (so paint sees model coordinates), paints it and adds it. */
/** Painted box with subdivisions (so the painter can draw window/arch grids), base at y. */

/** Paved slab of size w×d (flagstones with per-cell tonal variation) on a plinth of thickness th. */
function paved(p: THREE.Object3D, w: number, d: number, y: number, th: number, c: string, cell: number, x = 0, z = 0, paint?: Paint, seg = 0): void {
  const pg = new THREE.PlaneGeometry(w, d, seg || Math.max(1, Math.round(w / cell)), seg || Math.max(1, Math.round(d / cell)));
  pg.rotateX(-Math.PI / 2);
  pg.translate(x, 0, z);
  const def: Paint = (px, _py, pz) => {
    const h = hash3(Math.floor(px / cell + 500.5), 3, Math.floor(pz / cell + 500.5));
    return h > 0.72 ? shade(c, 1.06) : h < 0.22 ? shade(c, 0.92) : null;
  };
  add(p, paintFaces(pg, c, paint ?? def), mat('#ffffff', { vc: true, flat: true, rough: 0.9 }), 0, y + th, 0, 1, 1, 1);
  if (th > 0.0005) box(p, shade(c, 0.82), x, y, z, w, th - 0.0004, d);
}

/** Calm water: cell-quantised tonal patches with sparse glints. */
const sea = (c: string, cell = 0.025, glint = 0.975): Paint => (x, _y, z) => {
  const ci = Math.floor(x / cell), cj = Math.floor(z / cell), h = hash3(ci, 4, cj);
  if (Math.sin(x * 46 + Math.sin(z * 18) * 2.2) > glint) return mix(c, '#e2f4f6', 0.45);
  return h > 0.72 ? shade(c, 1.07) : h < 0.25 ? shade(c, 0.93) : null;
};

/** Tiny visitor for scale. */
function person(p: THREE.Object3D, x: number, y: number, z: number, c: string, s = 1, head = '#e9c9a4'): void {
  passerby(p, x, y, z, 0.018 * s, 1, { top: c, skin: head });
}

const LB = () => g('a3:lb', () => new THREE.SphereGeometry(0.5, 6, 4));
/** Low-poly blob (shrubs, canopies, rocks). */
const lowball = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0) =>
  add(p, LB(), mat(c), x, y, z, sx, sy, sz, ry);
/** Gold material swap for lathes, boxes & sweeps. */

/** Painted lathe, geometry cached under `key` so many identical stupas/domes share one buffer. */

/** Many boxes merged into one mesh: items are [x, yBase, z, sx, sy, sz, ry]. */
function batch(p: THREE.Object3D, items: number[][], c: string, o: { metal?: number; rough?: number } = {}): void {
  if (!items.length) return;
  const unit = g('a3:box-ni', () => new THREE.BoxGeometry(1, 1, 1).toNonIndexed()).getAttribute('position');
  const out = new Float32Array(items.length * unit.count * 3), v = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), t = new THREE.Vector3();
  items.forEach((it, k) => {
    m.compose(t.set(it[0], it[1] + it[4] / 2, it[2]), q.setFromAxisAngle(up, it[6] ?? 0), s.set(it[3], it[4], it[5]));
    for (let i = 0; i < unit.count; i++) {
      v.fromBufferAttribute(unit, i).applyMatrix4(m);
      out[(k * unit.count + i) * 3] = v.x; out[(k * unit.count + i) * 3 + 1] = v.y; out[(k * unit.count + i) * 3 + 2] = v.z;
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.computeVertexNormals();
  add(p, geo, mat(c, o), 0, 0, 0, 1, 1, 1);
}

/**
 * Stamps a vertex-coloured template geometry many times into one mesh (armies, forests, stupa fields).
 * Each instance is [x, y, z, ry, scale, tint] — tint multiplies the template colours.
 */
function stamp(p: THREE.Object3D, tpl: THREE.BufferGeometry, inst: number[][], o: { flat?: boolean; metal?: number; rough?: number } = {}): void {
  if (!inst.length) return;
  const P = tpl.getAttribute('position'), C = tpl.getAttribute('color'), n = P.count;
  const pos = new Float32Array(inst.length * n * 3), col = new Float32Array(inst.length * n * 3);
  inst.forEach((it, k) => {
    const [x, y, z, ry, s, tint] = it, cs = Math.cos(ry), sn = Math.sin(ry), tt = tint ?? 1, sy = it[6] ?? s;
    for (let i = 0; i < n; i++) {
      const px = P.getX(i) * s, py = P.getY(i) * sy, pz = P.getZ(i) * s, j = (k * n + i) * 3;
      pos[j] = x + px * cs + pz * sn; pos[j + 1] = y + py; pos[j + 2] = z - px * sn + pz * cs;
      col[j] = C.getX(i) * tt; col[j + 1] = C.getY(i) * tt; col[j + 2] = C.getZ(i) * tt;
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  add(p, geo, mat('#ffffff', { vc: true, flat: o.flat ?? true, metal: o.metal, rough: o.rough }), 0, 0, 0, 1, 1, 1);
}
/** Builds a template by merging coloured parts: each part is a geometry already transformed into template space. */
function template(parts: [THREE.BufferGeometry, string][]): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  for (const [geo0, hex] of parts) {
    const geo = geo0.index ? geo0.toNonIndexed() : geo0, P = geo.getAttribute('position'), C = geo.getAttribute('color');
    c.set(hex);
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      if (C) col.push(C.getX(i), C.getY(i), C.getZ(i)); else col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
/** Unit box/sphere/cylinder template parts at a position & scale (and optional x/z tilt). */
function tp(kind: 'box' | 'sph' | 'cyl' | 'cone', x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, rz = 0, seg = 6): THREE.BufferGeometry {
  const geo = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : kind === 'sph' ? new THREE.SphereGeometry(0.5, seg, Math.max(3, Math.round(seg * 0.6)))
    : kind === 'cyl' ? new THREE.CylinderGeometry(0.5, 0.5, 1, seg) : new THREE.ConeGeometry(0.5, 1, seg);
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz)));
  return geo;
}

/** Raised land slab over the circular base: the part of the R-disc with u < c (u = z turned by ry), top at h. */

/** Tropical palm: slender leaning trunk with drooping fronds. */
const soldierTpl = (painted = false) => g('a3:soldier' + painted, () => {
  const robe = painted ? '#a68a7c' : '#a39684', legs = painted ? '#828a7c' : '#8f8576', arm = painted ? '#6e6a64' : '#93887a', face = painted ? '#b4a090' : '#aca090';
  return template([
    [tp('box', 0, 0.0008, 0, 0.011, 0.0016, 0.009), '#7f776b'],
    [tp('box', 0, 0.0066, 0, 0.0076, 0.0098, 0.0046), legs],
    [tp('box', 0, 0.0145, 0, 0.0112, 0.0075, 0.0074), robe],
    [tp('box', 0, 0.0228, 0, 0.0122, 0.0095, 0.0072), arm],
    [tp('box', 0.0074, 0.0205, 0.0004, 0.0034, 0.011, 0.0042), robe],
    [tp('box', -0.0074, 0.0205, 0.0004, 0.0034, 0.011, 0.0042), robe],
    [tp('box', 0, 0.0292, 0.0002, 0.0036, 0.0028, 0.0036), face],
    [tp('sph', 0, 0.0328, 0, 0.0062, 0.0068, 0.0062, 0, 0, 5), face],
    [tp('box', 0.0016, 0.0366, -0.0006, 0.0026, 0.0026, 0.0026), '#6a6258'],
  ]);
});
/** Terracotta horse facing +z (~110 tris). */
const horseTpl = () => g('a3:horse', () => template([
  [tp('sph', 0, 0.019, 0, 0.0095, 0.011, 0.027, 0, 0, 6), '#958a7b'],
  [tp('box', 0, 0.0075, 0.0085, 0.0075, 0.015, 0.0028), '#887e70'],
  [tp('box', 0, 0.0075, -0.0085, 0.0075, 0.015, 0.0028), '#887e70'],
  [tp('box', 0, 0.027, 0.0145, 0.0045, 0.012, 0.0055, 0.5), '#958a7b'],
  [tp('box', 0, 0.033, 0.0195, 0.0042, 0.0045, 0.0085, 0.25), '#9c9182'],
  [tp('box', 0, 0.0365, 0.0155, 0.0015, 0.0035, 0.0045), '#6f675c'],
  [tp('box', 0, 0.0165, -0.0145, 0.0025, 0.011, 0.0025, -0.35), '#6f675c'],
]));

const terracotta: Builder = gp => {
  const XH = 0.45, ZH = 0.44, YP = 0.024, YT = 0.089, PX = 0.392, PZ0 = -0.44, PZ1 = 0.395, WZ1 = 0.305;
  const LOESS = '#8d7656', EA = '#7d684d', BRICK = '#5d5850', CHAR = '#3a3028';
  // Loess ground block cut by the pit; the pit sides are stepped where they were excavated
  box(gp, '#5f4c39', 0, 0, 0, 2 * XH, YP, 2 * ZH);
  const rim: number[][] = [[-(PX + XH) / 2, YP, 0, XH - PX, YT - YP, 2 * ZH], [(PX + XH) / 2, YP, 0, XH - PX, YT - YP, 2 * ZH], [0, YP, (PZ1 + ZH) / 2, 2 * PX, YT - YP, ZH - PZ1]];
  batch(gp, rim, EA);
  const ledge: number[][] = [[-PX - 0.004, YP, (PZ0 + PZ1) / 2, 0.012, (YT - YP) * 0.55, PZ1 - PZ0], [PX + 0.004, YP, (PZ0 + PZ1) / 2, 0.012, (YT - YP) * 0.55, PZ1 - PZ0], [0, YP, PZ1 + 0.004, 2 * PX, (YT - YP) * 0.55, 0.012]];
  batch(gp, ledge, shade(EA, 0.92));
  paved(gp, XH - PX, 2 * ZH, YT, 0, LOESS, 0.03, -(PX + XH) / 2, 0);
  paved(gp, XH - PX, 2 * ZH, YT, 0, LOESS, 0.03, (PX + XH) / 2, 0);
  paved(gp, 2 * PX, ZH - PZ1, YT, 0, LOESS, 0.03, 0, (PZ1 + ZH) / 2);
  // Brick floor of the pit (grey Qin bricks, laid in courses)
  paved(gp, 2 * PX, PZ1 - PZ0, YP, 0, BRICK, 0.012, 0, (PZ0 + PZ1) / 2, (x, _y, z) => {
    const h = hash3(Math.floor(x * 80 + 50), 9, Math.floor(z * 80 + 50));
    return h > 0.72 ? '#66615a' : h < 0.25 ? '#544f48' : null;
  });
  // Ten partition walls: two flank corridors (边洞) and nine main corridors (过洞) between them
  const WW = 0.028, CM = 0.044, CS = (2 * PX - 9 * CM - 10 * WW) / 2;
  const cxs: number[] = [], wxs: number[] = [];
  let xx = -PX;
  for (let k = 0; k < 11; k++) {
    const w = k === 0 || k === 10 ? CS : CM;
    cxs.push(xx + w / 2); xx += w;
    if (k < 10) { wxs.push(xx + WW / 2); xx += WW; }
  }
  const WH = YT - YP - 0.008, walls: number[][] = [], bands: number[][] = [];
  const W2: number[][] = [];
  wxs.forEach((x, k) => {
    // eroded, uneven wall tops in alternating tones of the rammed layers
    for (let z = PZ0, q = 0; z < WZ1 - 0.001; q++) {
      const len = Math.min(0.05 + hash3(k, q, 11) * 0.06, WZ1 - z);
      (q % 2 ? W2 : walls).push([x, YP, z + len / 2, WW - hash3(k, q, 12) * 0.003, WH - hash3(k, q, 13) * 0.005, len]);
      z += len;
    }
  });
  batch(gp, W2, shade(EA, 1.05));
  for (const x of wxs) {
    for (let b = 1; b < 5; b++) bands.push([x, YP + (WH * b) / 5, (PZ0 + WZ1) / 2, WW + 0.0012, 0.0012, WZ1 - PZ0 + 0.0012]);
  }
  batch(gp, walls, EA);
  batch(gp, bands, shade(EA, 0.84));
  // Army: vanguard archers (unarmoured) in three ranks, then infantry four abreast down each main corridor;
  // flank corridors hold single files facing outward. Fewer restored figures further back.
  const S: number[][] = [], SP: number[][] = [], sc = 0.74, tint = (a: number, b: number) => 0.92 + hash3(a, b, 7) * 0.14;
  const put = (x: number, z: number, ry: number, a: number, b: number) => (hash3(a, b, 3) > 0.8 ? SP : S).push([x, YP, z, ry, sc, tint(a, b)]);
  for (let rI = 0; rI < 3; rI++) for (let c = 0; c < 58; c++) put(-PX + 0.012 + c * ((2 * PX - 0.024) / 57), PZ1 - 0.016 - rI * 0.024, (hash3(c, rI, 1) - 0.5) * 0.1, c, rI + 50);
  const chariot = new Set([2, 5, 8]);
  for (let k = 1; k <= 9; k++) {
    const rows = 19 - Math.floor(hash3(k, 1, 3) * 4);
    for (let rI = 0; rI < rows; rI++) {
      if (chariot.has(k) && rI >= 1 && rI < 5) continue;
      const z = WZ1 - 0.012 - rI * 0.0135;
      for (let c = 0; c < 4; c++) if (hash3(k, rI, c) < 0.95) put(cxs[k] + (c - 1.5) * 0.0105, z + (hash3(k, c, rI) - 0.5) * 0.002, (hash3(rI, c, k) - 0.5) * 0.08, k * 7 + c, rI);
    }
  }
  for (const k of [0, 10]) for (let rI = 0; rI < 12; rI++) put(cxs[k], WZ1 - 0.012 - rI * 0.016, k ? Math.PI / 2 : -Math.PI / 2, k, rI + 90);
  // Broken and fallen figures lying where excavation is still in progress
  const B: number[][] = [];
  for (let k = 0; k < 11; k++) for (let q = 0; q < 5; q++) {
    const z = WZ1 - 0.2 - q * 0.04 - hash3(k, q, 1) * 0.02;
    if (z < -0.2 || hash3(k, q, 2) > 0.7) continue;
    B.push([cxs[k] + (hash3(k, q, 3) - 0.5) * 0.02, YP, z, hash3(k, q, 4) * 6, sc, 0.85, sc * (0.25 + hash3(k, q, 5) * 0.35)]);
  }
  stamp(gp, soldierTpl(), [...S, ...B]);
  stamp(gp, soldierTpl(true), SP);
  // Chariot teams: four horses abreast before the decayed wooden chariot (its wheels and box as traces)
  const H: number[][] = [];
  for (const k of chariot) {
    const z = WZ1 - 0.03;
    for (let q = 0; q < 4; q++) H.push([cxs[k] + (q - 1.5) * 0.0095, YP, z, 0, sc, 0.95 + hash3(k, q, 3) * 0.08]);
    const cz = z - 0.036;
    for (const sx of [-1, 1]) add(gp, g('a3:wheel', () => new THREE.CylinderGeometry(0.0095, 0.0095, 0.0018, 12)), mat('#4f4234'), cxs[k] + sx * 0.0125, YP + 0.0095, cz, 1, 1, 1, 0, 0, Math.PI / 2);
    box(gp, '#584a3a', cxs[k], YP + 0.007, cz, 0.02, 0.006, 0.014);
    box(gp, '#4f4234', cxs[k], YP + 0.01, cz + 0.022, 0.002, 0.002, 0.034);
  }
  stamp(gp, horseTpl(), H);
  // Earth fill and collapsed charred timbers over the unexcavated middle of the corridors
  for (let k = 0; k < 11; k++) {
    const w = k === 0 || k === 10 ? CS : CM;
    for (let q = 0; q < 3; q++) lowball(gp, shade(EA, 0.95 + hash3(k, q, 6) * 0.1), cxs[k] + (hash3(k, q, 8) - 0.5) * 0.01, YP - 0.004, -0.17 - q * 0.05 + hash3(k, q, 9) * 0.02, w * 0.95, 0.03 + hash3(k, q, 7) * 0.02, 0.07);
    for (let q = 0; q < 2; q++) box(gp, CHAR, cxs[k], YP + 0.012 + q * 0.01, -0.15 - q * 0.06 - hash3(k, q, 4) * 0.03, w + 0.01, 0.004, 0.006, (hash3(k, q, 2) - 0.5) * 0.5);
  }
  // Qin roof as found at the west of the excavation: cross-beams spanning the walls, mats, then rammed fill
  const ZR0 = PZ0, ZR1 = -0.3, logs: number[][] = [];
  for (let z = ZR0 + 0.004; z < ZR1; z += 0.0075) logs.push([0, YT - 0.008, z, 2 * PX, 0.006, 0.0062]);
  batch(gp, logs, CHAR);
  box(gp, '#5b4d3c', 0, YT - 0.002, (ZR0 + ZR1 - 0.03) / 2, 2 * PX, 0.002, ZR1 - ZR0 - 0.03);
  box(gp, LOESS, 0, YT, (ZR0 + ZR1 - 0.06) / 2, 2 * PX, 0.006, ZR1 - ZR0 - 0.06);
  // Timber posts lining the corridor walls (their sockets carried the beams)
  const posts: number[][] = [];
  for (const x of wxs) for (let z = ZR1 + 0.02; z < WZ1; z += 0.05) for (const sx of [-1, 1]) posts.push([x + sx * (WW / 2 + 0.002), YP, z, 0.004, WH, 0.004]);
  batch(gp, posts, '#4a3d30');
};
// ---------------------------------------------------------------------------------------------------------
// Leshan Giant Buddha — seated Maitreya carved into the red sandstone cliff, hands on knees, curled hair and
// long earlobes, mossy niche, the zigzag cliff stairway and the river confluence at his feet

const G2 = (a: number, b: number, ca: number, cb: number, wa: number, wb: number) => Math.exp(-(((a - ca) / wa) ** 2 + ((b - cb) / wb) ** 2));
type Disp = (x: number, y: number, z: number) => number;
/** Sculpted head: unit sphere pushed along its radius by `disp`; `paint` sees head-local coords (face toward +z). */
function sculptHead(p: THREE.Object3D, ctr: V3, s: number, disp: Disp, base: string, paint?: Paint, seg = 30, ax: V3 = [0.8, 1, 0.86]): THREE.Mesh {
  const geo = g('a3:sph' + seg, () => {
    const sg = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8));
    sg.deleteAttribute('normal'); sg.deleteAttribute('uv');
    return mergeVertices(sg);
  }).clone();
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = 1 + disp(x, y, z);
    pos.setXYZ(i, x * ax[0] * k, y * ax[1] * k, z * ax[2] * k);
  }
  geo.computeVertexNormals();
  const pg = paintFaces(geo, base, paint);
  pg.scale(s, s, s);
  pg.translate(ctr[0], ctr[1], ctr[2]);
  return add(p, pg, mat('#ffffff', { flat: false, vc: true }), 0, 0, 0, 1, 1, 1);
}
/** Eye and mouth grooves (0..1), shared by the sculpt and the painter so the cuts also read as shadow lines. */
const buddhaGroove = (x: number, y: number, z: number) => {
  if (z < 0.2) return 0;
  const ax = Math.abs(x), eyeY = 0.1 - 0.35 * (ax - 0.3) ** 2;
  return Math.max(G2(ax, y, 0.3, eyeY, 0.16, 0.045), 0.9 * G2(x, y, 0, -0.39, 0.13, 0.035));
};
/** Serene Buddha face: heavy lids over grooved eyes, long nose ridge, small mouth, full chin; ushnisha on top. */
const buddhaDisp: Disp = (x, y, z) => {
  const ax = Math.abs(x), f = sstep(0.05, 0.6, z);
  let d = 0;
  d += f * (0.06 * G2(x, y, 0, 0.08, 0.06, 0.28) + 0.17 * G2(x, y, 0, -0.14, 0.1, 0.1) + 0.05 * G2(ax, y, 0.1, -0.2, 0.06, 0.05));
  d += f * 0.06 * G2(ax, y, 0.3, 0.17, 0.18, 0.06) - f * 0.045 * buddhaGroove(x, y, z) * (ax > 0.1 ? 1 : 0);
  d -= f * 0.05 * G2(ax, y, 0.3, 0.06, 0.15, 0.06);
  d += f * 0.05 * G2(ax, y, 0.3, 0.32, 0.24, 0.05);
  d += f * 0.04 * G2(ax, y, 0.42, -0.15, 0.16, 0.16);
  d -= f * 0.04 * G2(x, y, 0, -0.39, 0.12, 0.025);
  d += f * 0.03 * (G2(x, y, 0, -0.35, 0.1, 0.035) + G2(x, y, 0, -0.44, 0.09, 0.035));
  d += f * 0.09 * G2(x, y, 0, -0.68, 0.24, 0.12);
  d -= 0.05 * sstep(-0.4, -0.9, y) * sstep(0.25, 0.7, ax);
  const hair = sstep(0.3, 0.42, y + 0.45 * sstep(0.3, -0.3, z));
  return d + hair * 0.02 + 0.16 * sstep(0.74, 0.96, y);
};

const leshan: Builder = (gp, r) => {
  const XH = 0.45, ZB = -0.42, ZF = 0.07, YB = 0.035, YC = 0.79, SAND = '#7d5042';
  // Rivers: the muddy Dadu meets the greener Min at the Buddha's feet
  box(gp, '#5a4636', 0, 0, (ZB + 0.44) / 2, 2 * XH, YB - 0.006, 0.44 - ZB);
  paved(gp, 2 * XH, 0.44 - ZF + 0.04, YB - 0.002, 0, '#7b7a5a', 0.03, 0, (ZF - 0.04 + 0.44) / 2, (x, y, z) => {
    const t = x + (z - 0.15) * 0.8 + Math.sin(z * 14) * 0.03;
    const c = t < -0.03 ? '#94805e' : t > 0.03 ? '#6f8f7c' : '#82876a';
    return sea(c, 0.04, 2)(x, y, z, 0, 1, 0) ?? c;
  });
  // Cliff block: rings by height, front edge follows a noisy cliff face with the deep niche carved at centre
  const NW = 0.185, NB = -0.16;
  const niche = (x: number, y: number) => sstep(NW + 0.025, NW - 0.012, Math.abs(x)) * sstep(YC + 0.02, YC - 0.03, y);
  const F = (x: number, y: number) => {
    const n = (fbm(x * 9, y * 9, 1.3) - 0.5) * 0.07 + (fbm(x * 30, y * 22, 4.1) - 0.5) * 0.02;
    const side = sstep(0.36, 0.46, Math.abs(x)) * 0.05;
    return ZF + n - side + (NB - ZF) * niche(x, y) - 0.03 * (y - YB);
  };
  const xs: number[] = [];
  for (let i = 0; i <= 52; i++) {
    const u = -1 + (2 * i) / 52, xx = Math.sign(u) * Math.pow(Math.abs(u), 1.0) * XH;
    xs.push(xx);
  }
  const yr: number[] = [];
  for (let j = 0; j <= 26; j++) yr.push(YB - 0.004 + ((YC - YB + 0.004) * j) / 26);
  const rings: V3[][] = yr.map(y => {
    const ring: V3[] = xs.map(x => [x, y, F(x, y)] as V3);
    ring.push([XH, y, ZB], [-XH, y, ZB]);
    return ring;
  });
  skin(gp, rings, SAND, {
    caps: true, flat: true,
    paint: (x, y, z, _nx, ny) => {
      if (ny > 0.9 && y > YC - 0.01) return fbm(x * 12, 0, z * 12) > 0.45 ? '#3f5532' : '#4b6238';
      const m = fbm(x * 5, y * 4, z * 5 + 3), row = Math.floor((y - YB + 0.004) / ((YC - YB + 0.004) / 26));
      if (m > 0.64 || (ny > 0.3 && m > 0.5) || y > YC - 0.03 && m > 0.42) return m > 0.7 ? '#46593a' : '#5a6744';
      const h = hash3(row, 7, Math.floor(x * 6));
      if (m < 0.36) return h > 0.5 ? '#6f5248' : '#7c5c4f';
      return h > 0.75 ? '#8e5a48' : h < 0.2 ? '#6a4236' : null;
    },
  });
  // Buddha: legs pendant, hands on knees, smooth robed torso, sculpted head with curls and long earlobes
  const ROBE = '#82604f', STONE = '#93705f', BZ = NB + 0.08;
  // Weathered sandstone: vertical rain streaks (dark / mossy) running down the carving
  const weather = (x: number, y: number, z: number, ny = 0) => {
    const s = fbm(x * 46, y * 3.5, z * 46 + 7), m = fbm(x * 9, y * 7, z * 9);
    if (ny > 0.35 && m > 0.56) return m > 0.64 ? '#55603e' : '#6b6a4c';
    if (s > 0.7) return m > 0.55 ? '#5e5e44' : '#5f463c';
    if (s > 0.63) return '#7a5648';
    return m < 0.32 ? '#8a5a4a' : m > 0.68 ? '#7f6a58' : null;
  };
  const robeP: Paint = (x, y, z, _nx, ny) => weather(x, y, z, ny);
  const skinP: Paint = (x, y, z) => { const c = weather(x, y, z); return c === '#8a5a4a' ? null : c; };
  // Torso: smooth rings with rounded shoulders [y, rx, rz, dz]
  const TR: [number, number, number, number][] = [[0.23, 0.13, 0.088, -0.004], [0.28, 0.127, 0.082, 0], [0.34, 0.123, 0.076, 0.002], [0.4, 0.124, 0.073, 0.004],
    [0.46, 0.13, 0.071, 0.006], [0.5, 0.134, 0.07, 0.007], [0.535, 0.131, 0.067, 0.006], [0.56, 0.12, 0.062, 0.005], [0.578, 0.102, 0.056, 0.004],
    [0.592, 0.08, 0.048, 0.002], [0.602, 0.058, 0.041, 0], [0.61, 0.04, 0.035, 0]];
  const tor: V3[][] = TR.map(([y, rx, rz, dz]) => {
    const ring: V3[] = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2, fold = 1 - 0.012 * Math.max(0, Math.sin(a)) * Math.abs(Math.sin(a * 7 + y * 30));
      ring.push([Math.cos(a) * rx * fold, YB + y, BZ + dz + Math.sin(a) * rz * fold]);
    }
    return ring;
  });
  skin(gp, tor, ROBE, { caps: true, flat: false, paint: robeP });
  const trAt = (y: number) => {
    let i = 0;
    while (i < TR.length - 2 && TR[i + 1][0] < y - YB) i++;
    const [y0, a0, b0, c0] = TR[i], [y1, a1, b1, c1] = TR[i + 1], t = Math.min(1, Math.max(0, (y - YB - y0) / (y1 - y0)));
    return [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, c0 + (c1 - c0) * t];
  };
  const front = (x: number, y: number, o = 0.002): V3 => {
    const [rx, rz, dz] = trAt(y);
    return [x, y, BZ + dz + rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + o];
  };
  // Robe hems: the V of the neckline and the diagonal fold of the outer robe across the chest
  const hem = (pts: V3[], w = 0.007) => sweep(gp, pts.map(p => ({ p, w, h: w * 0.8 })), shade(ROBE, 0.9), { radial: 6, sub: 4, flat: false });
  hem([front(-0.09, YB + 0.592, -0.003), front(-0.05, YB + 0.55), front(0, YB + 0.5), front(0.05, YB + 0.55), front(0.09, YB + 0.592, -0.003)]);
  hem([front(-0.115, YB + 0.47), front(-0.04, YB + 0.42), front(0.05, YB + 0.37), front(0.11, YB + 0.33)], 0.006);
  // Thighs → rounded knees → shins
  const KZ = 0.07, KY = YB + 0.25;
  for (const sx of [-1, 1]) {
    sweep(gp, [
      { p: [sx * 0.064, KY + 0.004, BZ - 0.02], w: 0.074, h: 0.062 }, { p: [sx * 0.068, KY + 0.002, (BZ + KZ) / 2], w: 0.07, h: 0.058 },
      { p: [sx * 0.07, KY - 0.008, KZ - 0.016], w: 0.066, h: 0.064 }, { p: [sx * 0.071, KY - 0.065, KZ - 0.006], w: 0.058, h: 0.056 },
      { p: [sx * 0.072, YB + 0.085, KZ - 0.002], w: 0.054, h: 0.05 }, { p: [sx * 0.073, YB + 0.03, KZ], w: 0.058, h: 0.054 },
    ], ROBE, { radial: 16, sub: 5, paint: robeP, up: [0, 0, 1], flat: false });
    pblob(gp, ROBE, sx * 0.07, KY - 0.014, KZ - 0.012, 0.036, 0.036, 0.036, robeP, [0, 0, 0], 16);
    // Robe hem flaring just above the ankles
    pblob(gp, shade(ROBE, 0.92), sx * 0.073, YB + 0.03, KZ, 0.033, 0.008, 0.031, robeP, [0, 0, 0], 16);
    // Big bare feet with toe lobes, resting on the foot terrace
    pblob(gp, STONE, sx * 0.074, YB + 0.014, KZ + 0.034, 0.033, 0.015, 0.052, skinP, [0, 0, 0], 14);
    for (let t = 0; t < 5; t++) {
      const tx = sx * (0.074 + (t - 2) * 0.0115 * -1) , big = t === 0 ? 1.3 : 1 - t * 0.06;
      pblob(gp, STONE, tx + sx * (t === 0 ? -0.002 : 0), YB + 0.012, KZ + 0.082 - Math.abs(t - 1) * 0.003, 0.0062 * big, 0.0068 * big, 0.009 * big, skinP, [0, 0, 0], 8);
    }
    // Upper arm with the hanging sleeve, forearm along the thigh, hand cupping the knee
    sweep(gp, [
      { p: [sx * 0.118, YB + 0.522, BZ + 0.004], w: 0.044, h: 0.048 }, { p: [sx * 0.138, YB + 0.46, BZ + 0.018], w: 0.043, h: 0.047 },
      { p: [sx * 0.136, YB + 0.39, BZ + 0.05], w: 0.041, h: 0.045 }, { p: [sx * 0.116, KY + 0.075, KZ - 0.075], w: 0.035, h: 0.037 },
      { p: [sx * 0.095, KY + 0.05, KZ - 0.045], w: 0.029, h: 0.028 },
    ], ROBE, { radial: 12, sub: 5, paint: robeP, flat: false });
    pblob(gp, ROBE, sx * 0.118, YB + 0.522, BZ + 0.004, 0.047, 0.05, 0.05, robeP, [0, 0, 0], 16);
    pblob(gp, shade(ROBE, 0.9), sx * 0.1, KY + 0.054, KZ - 0.05, 0.022, 0.021, 0.008, robeP, [0.5, 0, 0], 12);
    pblob(gp, STONE, sx * 0.077, KY + 0.03, KZ - 0.002, 0.038, 0.015, 0.04, undefined, [0.35, 0, 0], 14);
    for (let f = 0; f < 4; f++) {
      const fx = sx * (0.055 + f * 0.015), L = f === 0 || f === 3 ? 0.024 : 0.03;
      pblob(gp, STONE, fx, KY + 0.016 - L * 0.4, KZ + 0.032, 0.0085, L, 0.01, undefined, [-0.3, 0, 0], 8);
    }
    pblob(gp, STONE, sx * 0.05, KY + 0.03, KZ - 0.012, 0.008, 0.009, 0.018, skinP, [0, sx * 0.3, 0], 8);
  }
  // Robe falling in a smooth curtain between the knees
  sweep(gp, [{ p: [0, KY + 0.004, KZ - 0.06], w: 0.07, h: 0.04 }, { p: [0, KY - 0.04, KZ - 0.03], w: 0.072, h: 0.034 }, { p: [0, YB + 0.06, KZ - 0.022], w: 0.084, h: 0.03 }, { p: [0, YB + 0.004, KZ - 0.018], w: 0.094, h: 0.03 }],
    shade(ROBE, 0.95), { radial: 12, sub: 4, paint: robeP, flat: false });
  // Neck with folds, then the head
  const HC: V3 = [0, YB + 0.7, BZ + 0.026], HS = 0.094;
  sweep(gp, [{ p: [0, YB + 0.585, BZ + 0.004], w: 0.058, h: 0.05 }, { p: [0, YB + 0.62, BZ + 0.012], w: 0.05, h: 0.045 }, { p: [0, HC[1] - 0.05, HC[2] - 0.006], w: 0.05, h: 0.045 }], STONE, { radial: 14, sub: 3, paint: skinP, flat: false });
  // Three neck folds (beauty rings)
  for (const t of [0.3, 0.55, 0.8]) {
    const y = YB + 0.6 + t * (HC[1] - 0.05 - YB - 0.6), q: V3[] = [];
    for (let k = 0; k <= 10; k++) { const a = Math.PI * (0.1 + 0.08 * k); q.push([Math.cos(a) * 0.05, y - 0.004 * Math.sin(a), BZ + 0.01 + Math.sin(a) * 0.046]); }
    sweep(gp, q.map(p => ({ p, w: 0.0035 })), shade(STONE, 0.86), { radial: 5, sub: 2, flat: false });
  }
  sculptHead(gp, HC, HS, buddhaDisp, STONE, (x, y, z) => {
    const xx = (x - HC[0]) / HS, yy = (y - HC[1]) / HS, zz = (z - HC[2]) / HS;
    if (yy + 0.45 * sstep(0.3, -0.3, zz) > 0.34) return '#3f3d36';
    if (buddhaGroove(xx / 0.74, yy, zz / 0.84) > 0.35) return '#4f342b';
    const st = fbm(x * 46, y * 3.5, z * 46 + 7);
    return st > 0.74 ? '#7a5a4c' : zz > 0.3 ? '#9c7a68' : '#8f6d5c';
  }, 56, [0.74, 1, 0.84]);
  // Hair: dense grid of snail-shell curls following the scalp (instanced), mossy in the damp crevices
  const curls: number[][] = [], moss: number[][] = [];
  for (let i = 0; i < 18; i++) {
    const ph = 0.04 + (i / 17) * 1.5, n = Math.max(1, Math.round(Math.sin(ph) * 40));
    for (let j = 0; j < n; j++) {
      const th = ((j + (i % 2) * 0.5) / n) * Math.PI * 2, dx = Math.sin(ph) * Math.sin(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.cos(th);
      if (dy + 0.45 * sstep(0.3, -0.3, dz) < 0.36) continue;
      const k = 1 + buddhaDisp(dx, dy, dz) + 0.01;
      const px = HC[0] + dx * 0.74 * k * HS, py = HC[1] + dy * k * HS, pz = HC[2] + dz * 0.84 * k * HS;
      const m = fbm(dx * 3, dy * 3, dz * 3 + 2), it = [px, py - 0.0045, pz, th, 0.0115, 0.85 + hash3(i, j, 5) * 0.3];
      (m > 0.6 || (dz < -0.2 && m > 0.5) ? moss : curls).push(it);
    }
  }
  stamp(gp, g('a3:curl', () => template([[tp('sph', 0, 0.5, 0, 1, 0.85, 1, 0, 0, 6), '#3f3d36']])), curls, { flat: false });
  stamp(gp, g('a3:curlm', () => template([[tp('sph', 0, 0.5, 0, 1, 0.85, 1, 0, 0, 6), '#4a5a38']])), moss, { flat: false });
  // Long pendulous ears with earlobes hanging down to the shoulders
  for (const sx of [-1, 1]) {
    sweep(gp, [
      { p: [sx * HS * 0.72, HC[1] + HS * 0.3, HC[2] - HS * 0.1], w: HS * 0.16, h: HS * 0.08 }, { p: [sx * HS * 0.78, HC[1] + HS * 0.05, HC[2] - HS * 0.06], w: HS * 0.22, h: HS * 0.09 },
      { p: [sx * HS * 0.78, HC[1] - HS * 0.45, HC[2] - HS * 0.02], w: HS * 0.16, h: HS * 0.08 }, { p: [sx * HS * 0.77, HC[1] - HS * 0.85, HC[2]], w: HS * 0.13, h: HS * 0.08 },
      { p: [sx * HS * 0.76, HC[1] - HS * 1.12, HC[2]], w: HS * 0.16, h: HS * 0.1 }, { p: [sx * HS * 0.75, HC[1] - HS * 1.24, HC[2]], w: HS * 0.07, h: HS * 0.06 },
    ], STONE, { radial: 10, sub: 4, paint: skinP, flat: false, up: [1, 0, 0] });
    pblob(gp, shade(STONE, 0.82), sx * HS * 0.8, HC[1] - HS * 0.05, HC[2] - HS * 0.04, HS * 0.04, HS * 0.22, HS * 0.1, undefined, [0, 0, 0], 8);
  }
  // Foot terrace with railing and pilgrims, steps down to the boat landing
  box(gp, '#8a8278', 0, YB, KZ + 0.1, 0.44, 0.006, 0.17);
  const rl: number[][] = [];
  for (let i = 0; i <= 22; i++) rl.push([-0.22 + i * 0.02, YB + 0.006, KZ + 0.183, 0.002, 0.012, 0.002]);
  rl.push([0, YB + 0.017, KZ + 0.183, 0.44, 0.0018, 0.002]);
  batch(gp, rl, '#7a5a3a');
  const pc = ['#7a5a3a', '#4a4038', '#5d5246', '#3e4a52', '#6b4a36', '#8a7a62', '#2f2a26'];
  for (let i = 0; i < 18; i++) person(gp, -0.2 + hash3(i, 1, 9) * 0.4, YB + 0.006, KZ + 0.1 + hash3(i, 2, 9) * 0.07, pc[i % pc.length], 0.9);
  // Nine-turn plank stairway zigzagging down the cliff left of the niche
  const steps: number[][] = [], rails: [V3, V3][] = [];
  const NF = 7, X0 = -0.4, X1 = -0.24;
  for (let f = 0; f < NF; f++) {
    const yTop = YC - 0.02 - f * ((YC - 0.08) / NF), yBot = yTop - (YC - 0.08) / NF;
    const xa = f % 2 ? X1 : X0, xb = f % 2 ? X0 : X1;
    for (let k = 0; k < 10; k++) {
      const t = k / 9, x = xa + (xb - xa) * t, y = yTop + (yBot - yTop) * t;
      steps.push([x, y - 0.004, F(x, y) + 0.008, 0.02, 0.004, 0.028]);
    }
    const zz = (x: number, y: number) => F(x, y) + 0.022;
    rails.push([[xa, yTop + 0.012, zz(xa, yTop)], [xb, yBot + 0.012, zz(xb, yBot)]]);
  }
  batch(gp, steps, '#7a5e4e');
  for (const [a, b] of rails) rod(gp, a, b, 0.0011, '#5a4334', 4);
  for (let i = 0; i < 16; i++) {
    const f = i % NF, t = hash3(i, 3, 3), yTop = YC - 0.02 - f * ((YC - 0.08) / NF), yBot = yTop - (YC - 0.08) / NF;
    const xa = f % 2 ? X1 : X0, xb = f % 2 ? X0 : X1, x = xa + (xb - xa) * t, y = yTop + (yBot - yTop) * t;
    person(gp, x, y, F(x, y) + 0.014, pc[i % pc.length], 0.8);
  }
  // Vegetation: dense subtropical woods on the cliff top (camphor, banyan, cypress); ferns and shrubs on ledges
  const crowns: number[][] = [], dark: number[][] = [];
  for (let i = 0; i < 150; i++) {
    const x = -XH + 0.02 + hash3(i, 1, 1) * (2 * XH - 0.04), z = ZB + 0.02 + hash3(i, 2, 1) * 0.42;
    if (z > F(x, YC) - 0.012 || (Math.abs(x - 0.3) < 0.04 && Math.abs(z + 0.3) < 0.04)) continue;
    const sz = 0.018 + hash3(i, 3, 1) * 0.02;
    (hash3(i, 4, 1) > 0.55 ? dark : crowns).push([x, YC + sz * 0.3, z, sz * 1.3, sz, sz * 1.2, hash3(i, 5, 1) * 3]);
  }
  for (const [x, y, z, a, b, c, ry] of crowns) lowball(gp, '#4a6236', x, y, z, a, b, c, ry);
  for (const [x, y, z, a, b, c, ry] of dark) lowball(gp, '#3d5230', x, y, z, a, b, c, ry);
  for (let i = 0; i < 14; i++) {
    const x = -XH + 0.04 + hash3(i, 7, 2) * (2 * XH - 0.08), z = ZB + 0.04 + hash3(i, 8, 2) * 0.3, h = 0.05 + hash3(i, 9, 2) * 0.03;
    if (z > F(x, YC) - 0.03 || Math.abs(x - 0.3) < 0.05) continue;
    cone(gp, '#34472c', x, YC - 0.004, z, 0.012, h, 6);
  }
  for (let i = 0; i < 40; i++) {
    const sd = i % 2 ? 1 : -1, y = YB + 0.08 + hash3(i, 5, 5) * 0.66, x = sd * (NW + 0.015 + hash3(i, 6, 5) * 0.24);
    if (x < -0.22 && x > -0.42) continue;
    const sz = 0.012 + hash3(i, 7, 5) * 0.014;
    lowball(gp, i % 3 ? '#4a5e36' : '#566a3e', x, y, F(x, y) + 0.004, sz * 1.4, sz, sz, hash3(i, 8, 5) * 3);
  }
  // Lingbao Pagoda (灵宝塔, Tang): thirteen-storey square brick tower with close-set corbelled eaves, on the hill behind
  const PX = 0.3, PZ = -0.3, P0 = YC + 0.004;
  box(gp, '#8a7a64', PX, P0, PZ, 0.05, 0.006, 0.05);
  box(gp, '#a58f72', PX, P0 + 0.006, PZ, 0.036, 0.03, 0.036);
  box(gp, '#3a3028', PX, P0 + 0.012, PZ + 0.0182, 0.01, 0.014, 0.001);
  for (let k = 0; k < 13; k++) {
    const t = k / 12, w = 0.036 * (1 - 0.32 * t * t), y = P0 + 0.036 + k * 0.0088;
    box(gp, '#6d5d4e', PX, y, PZ, w + 0.008, 0.0028, w + 0.008);
    box(gp, '#a58f72', PX, y + 0.0028, PZ, w, 0.006, w);
  }
  lathe(gp, [[0.008, 0], [0.006, 0.006], [0.002, 0.016], [0, 0.018]], '#5a4c40', PX, P0 + 0.036 + 13 * 0.0088, PZ, 6);
  // Wooden sampan with a woven bamboo awning, poled by a boatman, at the confluence below the Buddha
  const bg = grp(gp, 0.14, 0.33, -0.25, YB);
  sweep(bg, [{ p: [-0.055, 0.008, 0], w: 0.006, h: 0.006 }, { p: [-0.035, 0.005, 0], w: 0.022, h: 0.01 }, { p: [0.03, 0.005, 0], w: 0.022, h: 0.01 }, { p: [0.058, 0.009, 0], w: 0.006, h: 0.006 }], '#5a4330', { radial: 8, sub: 3, squash: 0.55 });
  cyl(bg, '#3d3529', -0.004, -0.008, 0, 0.012, 0.04, 8).rotation.z = Math.PI / 2;
  for (const [x, c, ry] of [[0.04, '#4a4038', 0.4], [-0.03, '#6b5a44', 0]] as [number, string, number][]) human(bg, x, 0.01, 0, { h: 0.019, ry, top: c, bottom: '#3a332c', hat: '#8a7a56', hatStyle: 'conical', detail: 'lo' });
  rod(bg, [0.045, 0.004, 0.008], [0.03, 0.05, 0.002], 0.0007, '#6b5a40', 4);
void r;
};
export const ASIA3: Record<string, Builder> = { terracotta, leshan };
