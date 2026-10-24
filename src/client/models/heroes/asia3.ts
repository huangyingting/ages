import { human, passerby } from '../human.ts';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Builder, type V3, type Paint, add, g, mat, box, cyl, cone, rod, sweep, lathe, slab, skin, gable,
  paintFaces, shade, mix, fbm, hash3,
} from '../prims.ts';
import { type HFn, island, sstep, strataSide } from '../nature.ts';
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
const frac = (v: number) => v - Math.floor(v);

/** Moves a fresh geometry into place (so paint sees model coordinates), paints it and adds it. */
function place(p: THREE.Object3D, geo: THREE.BufferGeometry, base: string, paint?: Paint, x = 0, y = 0, z = 0, ry = 0, o: { flat?: boolean; metal?: number; rough?: number } = {}): THREE.Mesh {
  if (x || y || z || ry) geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
  return add(p, paintFaces(geo, base, paint), mat('#ffffff', { vc: true, flat: o.flat ?? true, metal: o.metal, rough: o.rough }), 0, 0, 0, 1, 1, 1);
}
/** Painted box with subdivisions (so the painter can draw window/arch grids), base at y. */
function pbox(p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, base: string, paint?: Paint, seg: V3 = [1, 1, 1], ry = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]);
  geo.translate(0, h / 2, 0);
  return place(p, geo, base, paint, x, y, z, ry);
}

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
const gild = (m: THREE.Mesh, c: string, smooth = true) => { m.material = mat(c, { metal: 0.55, rough: 0.32, flat: !smooth }); return m; };
const gbox = (p: THREE.Object3D, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
  gild(box(p, c, x, y, z, sx, sy, sz, ry), c, false);

/** Painted lathe, geometry cached under `key` so many identical stupas/domes share one buffer. */
function plathe(p: THREE.Object3D, key: string, pts: [number, number][], base: string, paint: Paint | undefined, x: number, y: number, z: number, seg = 16, o: { metal?: number; rough?: number; flat?: boolean } = {}): THREE.Mesh {
  const geo = g('a3pl:' + key + ':' + seg, () => {
    const lg = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
    lg.computeVertexNormals();
    return paintFaces(lg, base, paint);
  });
  return add(p, geo, mat('#ffffff', { vc: true, flat: o.flat ?? false, metal: o.metal, rough: o.rough }), x, y, z, 1, 1, 1);
}

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
function bankSlab(p: THREE.Object3D, R: number, c: number, h: number, base: string, paint: Paint, ry = 0, n = 48): THREE.Mesh {
  const th0 = Math.asin(Math.max(-0.999, Math.min(0.999, c / R))), sh = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - th0 + (i / n) * (Math.PI + 2 * th0);
    if (i === 0) sh.moveTo(Math.cos(a) * R, -Math.sin(a) * R); else sh.lineTo(Math.cos(a) * R, -Math.sin(a) * R);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  return place(p, geo, base, paint, 0, 0, 0, ry);
}

/** Tropical palm: slender leaning trunk with drooping fronds. */
function palm(p: THREE.Object3D, x: number, y: number, z: number, s: number, seed: number): void {
  const lean = hash3(seed, 1, 1) * 0.3;
  const top: V3 = [x + Math.cos(seed) * s * lean, y + s, z + Math.sin(seed) * s * lean];
  rod(p, [x, y, z], top, s * 0.03, '#7a6650', 5);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + seed, d = 0.35 + (k % 2) * 0.35, L = s * 0.32;
    box(p, k % 2 ? '#3f7a3a' : '#4f8a42', top[0] + (L / 2) * Math.cos(d) * Math.cos(a), top[1] - (L / 2) * Math.sin(d), top[2] - (L / 2) * Math.cos(d) * Math.sin(a), L, 0.003, s * 0.07, a, 0, -d);
  }
  lowball(p, '#3a6b35', top[0], top[1], top[2], s * 0.12);
}

// ---------------------------------------------------------------------------------------------------------
// Golden Temple (Harmandir Sahib) — gilded two-storey sanctum with a fluted lotus dome in the Amrit Sarovar,
// marble causeway to the Darshani Deori, white parikrama and the ring of white buildings around the pool

/** Fluted inverted-lotus dome: lathe whose radius is modulated by `flutes` vertical ribs (cached). */
function flutedDome(p: THREE.Object3D, key: string, prof: [number, number][], flutes: number, depth: number, c: string, x: number, y: number, z: number, seg = 48, ribFrom = 0, ribTo = 1): THREE.Mesh {
  const geo = g('a3fd:' + key, () => {
    const lg = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), seg);
    const pos = lg.getAttribute('position');
    const y0 = prof[0][1], y1 = prof[prof.length - 1][1];
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), t = (py - y0) / (y1 - y0);
      if (t < ribFrom || t > ribTo) continue;
      const a = Math.atan2(pz, px), k = 1 - depth * (1 - Math.abs(Math.cos((a * flutes) / 2)));
      pos.setXYZ(i, px * k, py, pz * k);
    }
    lg.computeVertexNormals();
    return lg;
  });
  return add(p, geo, mat(c, { metal: 0.6, rough: 0.3, flat: false }), x, y, z, 1, 1, 1);
}
/** Small gilded chhatri kiosk: four posts, cornice and a bulb dome with finial. */
function chhatri(p: THREE.Object3D, x: number, y: number, z: number, s: number, c: string, post = c): void {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) gbox(p, post, x + dx * s * 0.36, y, z + dz * s * 0.36, s * 0.14, s * 0.7, s * 0.14);
  gbox(p, c, x, y + s * 0.7, z, s, s * 0.12, s);
  const d = flutedDome(p, 'chhatri', [[0.0001, 0], [0.42, 0.1], [0.44, 0.3], [0.2, 0.68], [0.05, 0.85], [0, 1.1]], 5, 0.1, c, x, y + s * 0.82, z, 10);
  d.scale.setScalar(s);
}
/** White marble block with arcades: `rows` storeys of openings painted on the two long faces (3 cells per bay). */
function arcadeBlock(p: THREE.Object3D, x: number, z: number, w: number, d: number, y: number, h: number, c: string, bay: number, rows = 1, dark = '#3a3330', roofC = '#ddd6c8'): void {
  const alongX = w >= d, L = alongX ? w : d, n = Math.max(1, Math.round(L / bay));
  pbox(p, w, h, d, x, y, z, c, (px, py, pz, ax, ay, az) => {
    if (ay > 0.5) return roofC;
    if (ay < -0.5 || Math.abs(alongX ? ax : az) > 0.5) return null;
    const u = alongX ? (px - x + w / 2) / w : (pz - z + d / 2) / d, rf = frac((py - y) / h * rows), cf = frac(u * n);
    if (py > y + h - 0.005) return shade(c, 0.94);
    return cf > 0.34 && cf < 0.66 && rf > 0.34 && rf < 0.98 ? dark : null;
  }, alongX ? [n * 3, rows * 3, 1] : [1, rows * 3, n * 3]);
}

const S2Of = (s: number) => s - 0.008;
const goldentemple: Builder = (gp, r) => {
  const GOLD = r.color ?? '#e0b040', G2 = shade(GOLD, 0.82), G3 = mix(GOLD, '#fff1c0', 0.3), MAR = '#f1ede4', MAR2 = '#e2dccf';
  const WAT = '#4f8a8c', H = 0.46, PI = 0.3, Y0 = 0.02;
  // Marble ground, the sunken Amrit Sarovar and the parikrama walkway (four paved strips with inlaid bands)
  const TX = 0.03, K = 1.3, S = 0.155;
  box(gp, '#cfc7b8', 0, 0, 0, 2 * H, 0.008, 2 * H);
  paved(gp, 2 * PI, 2 * PI, 0.011, 0, WAT, 0.025, 0, 0, (x, _y, z) => {
    if (Math.abs(x - TX) < 0.07 && z > 0.14 && z < 0.29 && hash3(Math.floor(x * 90), 1, Math.floor(z * 60)) > 0.4) return mix(WAT, '#c9a24a', 0.4);
    return sea(WAT, 0.025, 2)(x, 0, z, 0, 1, 0);
  }, 24);
  const pari: Paint = (x, _y, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (Math.abs(m - PI - 0.01) < 0.004 || Math.abs(m - 0.39) < 0.003) return '#9a7a5e';
    return (Math.floor((x + 1) / 0.024) + Math.floor((z + 1) / 0.024)) % 2 ? MAR2 : null;
  };
  const W2 = H - PI;
  for (const sd of [-1, 1]) {
    paved(gp, 2 * H, W2, 0.008, Y0 - 0.008, MAR, 0.024, 0, sd * (PI + W2 / 2), pari);
    paved(gp, W2, 2 * PI, 0.008, Y0 - 0.008, MAR, 0.024, sd * (PI + W2 / 2), 0, pari);
    // Bathing steps down into the sarovar
    box(gp, MAR2, 0, 0.008, sd * (PI - 0.004), 2 * PI, 0.007, 0.008);
    box(gp, MAR2, sd * (PI - 0.004), 0.008, 0, 0.008, 0.007, 2 * PI);
  }

  // ---- Harmandir Sahib on its marble platform in the pool (slightly east of centre)
  const tg = grp(gp, TX, 0);
  tg.scale.setScalar(K);
  box(tg, MAR, 0, 0.008, 0, S + 0.05, 0.022 - 0.008, S + 0.05);
  for (const sx of [-1, 1]) for (let i = 0; i <= 8; i++) {
    const t = -1 + (i / 8) * 2, e = (S + 0.05) / 2;
    gbox(tg, G3, t * e, 0.022, sx * e, 0.003, 0.008, 0.003);
    gbox(tg, G3, sx * e, 0.022, t * e, 0.003, 0.008, 0.003);
  }
  for (const sx of [-1, 1]) {
    box(tg, MAR2, 0, 0.03, sx * (S + 0.05) / 2, S + 0.05, 0.002, 0.002);
    box(tg, MAR2, sx * (S + 0.05) / 2, 0.03, 0, 0.002, 0.002, S + 0.05);
  }
  const YF = 0.022;
  // Ground storey: marble dado with pietra-dura inlay, gilded upper walls with arched doorways and window panels
  pbox(tg, S, 0.022, S, 0, YF, 0, MAR, (px, py, pz, ax, ay) => {
    if (Math.abs(ay) > 0.5) return null;
    const u = Math.abs(ax) > 0.5 ? pz : px;
    return hash3(Math.floor(u * 160), Math.floor(py * 260), 1) > 0.75 ? '#c9b48c' : null;
  }, [12, 3, 12]);
  // Wall panels as thin inset/raised plates on the four faces: [offset along face, y, w, h, depth]
  const facePlates = (half: number, list: number[][], skip = -1): number[][] => {
    const out: number[][] = [];
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2, cs = Math.cos(a), sn = Math.sin(a);
      list.forEach(([t, y, w, h, dd], i) => { if (i !== skip || q !== 3) out.push([sn * (half + dd / 2) + cs * t, y, cs * (half + dd / 2) - sn * t, w, h, dd, a]); });
    }
    return out;
  };
  gbox(tg, GOLD, 0, YF + 0.022, 0, S, 0.05, S);
  const p1: number[][] = [], o1: number[][] = [], p2: number[][] = [], o2: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const t = -S / 2 + (i + 0.5) * (S / 5);
    if (i === 2) { o1.push([t, YF + 0.022, 0.016, 0.03, 0.002]); p1.push([t, YF + 0.022, 0.024, 0.038, 0.001]); continue; }
    p1.push([t, YF + 0.03, 0.02, 0.032, 0.0015]);
    o1.push([t, YF + 0.036, 0.009, 0.018, 0.0025]);
  }
  for (let i = 0; i < 7; i++) {
    const t = -S2Of(S) / 2 + (i + 0.5) * (S2Of(S) / 7);
    p2.push([t, YF + 0.082, 0.016, 0.04, 0.0015]);
    o2.push([t, YF + 0.088, 0.008, 0.022, 0.0025]);
  }
  batch(tg, facePlates(S / 2, p1), G3, { metal: 0.55, rough: 0.32 });
  batch(tg, facePlates(S / 2, o1), '#3a2a16');
  batch(tg, facePlates(S2Of(S) / 2, p2), G2, { metal: 0.55, rough: 0.32 });
  batch(tg, facePlates(S2Of(S) / 2, o2), '#4a3418');
  gbox(tg, G3, 0, YF + 0.072, 0, S + 0.018, 0.005, S + 0.018);
  gbox(tg, G2, 0, YF + 0.068, 0, S + 0.01, 0.004, S + 0.01);
  // Upper storey with projecting jharokha balconies on each face
  const Y2 = YF + 0.077, S2 = S2Of(S);
  gbox(tg, GOLD, 0, Y2, 0, S2, 0.052, S2);
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2, bx = Math.sin(a) * (S2 / 2 + 0.008), bz = Math.cos(a) * (S2 / 2 + 0.008);
    const jg = grp(tg, bx, bz, a, Y2 + 0.008);
    gild(pbox(jg, 0.05, 0.03, 0.016, 0, 0, 0, GOLD, (px, py, _pz, _ax, ay) => {
      if (Math.abs(ay) > 0.5) return G2;
      const cu = frac((px + 0.025) / 0.05 * 3);
      return py > 0.006 && py < 0.024 && cu > 0.22 && cu < 0.78 ? '#4a3418' : null;
    }, [9, 6, 2]), GOLD, false);
    gbox(jg, G3, 0, 0.03, 0, 0.058, 0.004, 0.022);
    gbox(jg, G3, 0, -0.004, 0, 0.054, 0.004, 0.02);
    const dm = flutedDome(jg, 'jhar', [[0.0001, 0], [0.5, 0], [0.5, 0.1], [0.3, 0.55], [0.08, 0.85], [0, 1]], 10, 0.08, GOLD, 0, 0.034, 0, 16);
    dm.scale.set(0.05, 0.016, 0.02);
  }
  // Parapet of tiny gilded merlons and corner chhatris
  const YR = Y2 + 0.052;
  gbox(tg, G3, 0, YR, 0, S2 + 0.012, 0.005, S2 + 0.012);
  const mer: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const t = -S2 / 2 + 0.006 + (i * (S2 - 0.012)) / 15;
    for (const sd of [-1, 1]) { mer.push([t, YR + 0.005, sd * (S2 / 2 + 0.003), 0.004, 0.007, 0.003]); mer.push([sd * (S2 / 2 + 0.003), YR + 0.005, t, 0.003, 0.007, 0.004]); }
  }
  batch(tg, mer, G3, { metal: 0.55, rough: 0.32 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chhatri(tg, sx * (S2 / 2 - 0.012), YR + 0.005, sz * (S2 / 2 - 0.012), 0.026, GOLD);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) chhatri(tg, dx * (S2 / 2 - 0.01), YR + 0.005, dz * (S2 / 2 - 0.01), 0.016, GOLD);
  // Sheesh Mahal pavilion and the great fluted lotus dome
  const SP = 0.07, YP = YR + 0.005;
  gild(pbox(tg, SP, 0.03, SP, 0, YP, 0, GOLD, (px, py, pz, ax, ay) => {
    if (Math.abs(ay) > 0.5) return G2;
    const u = (Math.abs(ax) > 0.5 ? pz : px) / SP + 0.5, v = (py - YP) / 0.03, cu = frac(u * 3);
    return cu > 0.2 && cu < 0.8 && v > 0.15 && v < 0.75 ? (v > 0.62 && (cu < 0.32 || cu > 0.68) ? null : '#5a3f1a') : null;
  }, [9, 6, 9]), GOLD, false);
  gbox(tg, G3, 0, YP + 0.03, 0, SP + 0.01, 0.005, SP + 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chhatri(tg, sx * (SP / 2 - 0.002), YP + 0.035, sz * (SP / 2 - 0.002), 0.014, GOLD);
  const YD = YP + 0.035;
  gild(lathe(tg, [[0.0001, 0], [0.03, 0], [0.034, 0.004], [0.03, 0.008], [0.0001, 0.008]], G3, 0, YD, 0, 20), G3);
  flutedDome(tg, 'gt-main', [
    [0.0001, 0], [0.03, 0], [0.036, 0.004], [0.04, 0.008], [0.037, 0.011], [0.041, 0.016], [0.047, 0.026], [0.048, 0.036], [0.044, 0.048], [0.034, 0.06], [0.022, 0.07],
    [0.012, 0.076], [0.008, 0.08], [0.012, 0.084], [0.01, 0.089], [0.005, 0.092], [0.007, 0.097], [0.003, 0.104], [0.0012, 0.118], [0, 0.12],
  ], 24, 0.09, GOLD, 0, YD + 0.006, 0, 48, 0.1, 0.62);
  gild(lathe(tg, [[0.0001, 0], [0.012, 0], [0.008, 0.004], [0.0001, 0.006]], G3, 0, YD + 0.094, 0, 12), G3);

  // ---- Causeway (Guru's bridge) with gilded lamps and balustrades, from the Darshani Deori in the west
  const CW = 0.05, X0 = -H + 0.065, X1 = TX - (K * (S + 0.05)) / 2;
  box(gp, MAR, (X0 + X1) / 2, 0.016, 0, X1 - X0, 0.008, CW);
  paved(gp, X1 - X0, CW - 0.004, 0.024, 0, MAR2, 0.012, (X0 + X1) / 2, 0, (x, _y, z) => (Math.abs(z) < 0.006 ? '#b7a17a' : (Math.floor(x / 0.012) + Math.floor(z / 0.012)) % 2 ? MAR : null), 0);
  for (let k = 0; k < 7; k++) box(gp, MAR2, X0 + 0.02 + k * ((X1 - X0 - 0.04) / 6), 0.008, 0, 0.012, 0.009, CW + 0.004);
  for (const sz of [-1, 1]) {
    box(gp, MAR, (X0 + X1) / 2, 0.024, sz * (CW / 2 - 0.002), X1 - X0, 0.007, 0.003);
    for (let i = 0; i <= 9; i++) {
      const x = X0 + 0.01 + (i * (X1 - X0 - 0.02)) / 9;
      gbox(gp, G3, x, 0.024, sz * (CW / 2 - 0.002), 0.004, 0.026, 0.004);
      gild(lathe(gp, [[0.0001, 0], [0.004, 0.002], [0.0045, 0.007], [0.002, 0.011], [0, 0.013]], GOLD, x, 0.05, sz * (CW / 2 - 0.002), 8), GOLD);
    }
  }
  const pc = ['#f8fafc', '#f59e0b', '#1d4ed8', '#dc2626', '#f97316', '#0f766e', '#f8fafc', '#7c3aed'];
  for (let i = 0; i < 14; i++) person(gp, X0 + 0.02 + i * 0.012, 0.024, (i % 2 ? 1 : -1) * 0.009, pc[i % pc.length], 0.85);

  // ---- Darshani Deori gateway: marble arch block with gilded upper storey and domes
  const DX = -H + 0.035;
  pbox(gp, 0.07, 0.07, 0.11, DX, Y0, 0, MAR, (px, py, pz, ax, ay) => {
    if (ay > 0.5) return MAR2;
    if (Math.abs(ax) > 0.5 && Math.abs(pz) < 0.022 && py < Y0 + 0.052) return py > Y0 + 0.042 && Math.abs(pz) > 0.012 ? null : '#2a2220';
    if (Math.abs(ax) > 0.5 && py > Y0 + 0.012 && py < Y0 + 0.04 && Math.abs(Math.abs(pz) - 0.04) < 0.008) return '#3a3330';
    return null;
  }, [4, 14, 22]);
  gild(pbox(gp, 0.06, 0.028, 0.08, DX, Y0 + 0.07, 0, GOLD, (_px, py, pz, ax, ay) => {
    if (Math.abs(ay) > 0.5) return G2;
    const cu = frac((pz + 0.04) / 0.08 * 5);
    return Math.abs(ax) > 0.5 && cu > 0.25 && cu < 0.75 && py > Y0 + 0.076 && py < Y0 + 0.092 ? '#4a3418' : null;
  }, [3, 6, 15]), GOLD, false);
  gbox(gp, G3, DX, Y0 + 0.098, 0, 0.066, 0.004, 0.086);
  for (const sz of [-1, 1]) {
    cyl(gp, MAR, DX + 0.03, Y0, sz * 0.055, 0.009, 0.1, 8);
    chhatri(gp, DX + 0.03, Y0 + 0.1, sz * 0.055, 0.02, GOLD);
    chhatri(gp, DX - 0.02, Y0 + 0.102, sz * 0.03, 0.018, GOLD);
  }
  flutedDome(gp, 'deori', [[0.0001, 0], [0.018, 0], [0.022, 0.01], [0.02, 0.022], [0.012, 0.032], [0.004, 0.038], [0.002, 0.048], [0, 0.05]], 12, 0.08, GOLD, DX + 0.005, Y0 + 0.102, 0, 20);

  // ---- Akal Takht with its gilded dome, the twin Nishan Sahib flagpoles
  const AZ = -0.16;
  pbox(gp, 0.06, 0.09, 0.09, DX, Y0, AZ, MAR, (_px, py, pz, ax, ay) => {
    if (Math.abs(ay) > 0.5) return MAR2;
    const cu = frac((pz - AZ + 0.045) / 0.09 * 5), rf = frac((py - Y0) / 0.09 * 4);
    return Math.abs(ax) > 0.5 && cu > 0.25 && cu < 0.75 && rf > 0.2 && rf < 0.7 ? '#3a3330' : null;
  }, [3, 12, 15]);
  gild(pbox(gp, 0.055, 0.03, 0.085, DX, Y0 + 0.09, AZ, GOLD, undefined), GOLD, false);
  flutedDome(gp, 'akal', [[0.0001, 0], [0.02, 0], [0.026, 0.012], [0.024, 0.026], [0.014, 0.038], [0.005, 0.045], [0.002, 0.058], [0, 0.06]], 16, 0.08, GOLD, DX + 0.002, Y0 + 0.12, AZ, 24);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chhatri(gp, DX + sx * 0.022, Y0 + 0.12, AZ + sz * 0.036, 0.014, GOLD);
  for (const dz of [-0.075, -0.055]) {
    gild(cyl(gp, G3, -H + 0.11, Y0, dz, 0.0025, 0.3, 6), G3);
    gild(cone(gp, G3, -H + 0.11, Y0 + 0.3, dz, 0.004, 0.012, 6), G3);
    const f = slab(gp, [[0, 0], [0.05, 0.012], [0, 0.026]], 0.0015, '#f08a1c', 0, false);
    f.position.set(-H + 0.112, Y0 + 0.255, dz);
    f.rotation.y = -0.6;
  }

  // ---- Ring of white buildings around the parikrama: arcaded blocks with chhatri domes; low on the near side
  const segs: [number, number, number, number, number, number][] = [
    // x, z, w, d, h, rows
    [0.08, -H + 0.03, 0.6, 0.06, 0.075, 2], [-0.31, -H + 0.03, 0.18, 0.06, 0.06, 2],
    [H - 0.03, 0.0, 0.06, 0.72, 0.06, 2],
    [-H + 0.03, 0.27, 0.06, 0.26, 0.05, 1], [-H + 0.03, -0.31, 0.06, 0.18, 0.06, 2], [-H + 0.03, 0.105, 0.06, 0.07, 0.05, 1],
    [0.0, H - 0.02, 0.88, 0.04, 0.034, 1],
  ];
  for (const [x, z, w, d, h, rows] of segs) {
    arcadeBlock(gp, x, z, w, d, Y0, h, MAR, 0.026, rows);
    const along = w > d, L = along ? w : d, n = Math.floor(L / 0.09);
    if (h > 0.04) for (let i = 0; i < n; i++) {
      const t = -L / 2 + (i + 0.5) * (L / n), cx = along ? x + t : x, cz = along ? z : z + t;
      if (Math.abs(cx - DX) < 0.06 && Math.abs(cz) < 0.07) continue;
      chhatri(gp, cx, Y0 + h, cz, 0.018, i % 3 ? MAR : GOLD, MAR);
    }
  }
  for (const [x, z] of [[-H + 0.03, -H + 0.03], [H - 0.03, -H + 0.03], [H - 0.03, H - 0.03], [-H + 0.03, H - 0.03]] as const) {
    box(gp, MAR, x, Y0, z, 0.07, z > 0 ? 0.05 : 0.09, 0.07);
    chhatri(gp, x, Y0 + (z > 0 ? 0.05 : 0.09), z, 0.04, z > 0 ? MAR : GOLD, MAR);
  }
  // Clock-tower entrance (Ghanta Ghar) on the north side, with a white dome
  pbox(gp, 0.06, 0.12, 0.06, 0.28, Y0, -H + 0.03, MAR, (px, py, _pz, _ax, ay) => (ay > 0.5 ? MAR2 : Math.hypot(px - 0.28, py - Y0 - 0.1) < 0.012 ? '#f6f2ea' : Math.abs(px - 0.28) < 0.012 && py < Y0 + 0.04 ? '#2a2220' : null), [6, 12, 6]);
  cyl(gp, '#3a3330', 0.28, Y0 + 0.088, -H + 0.061, 0.011, 0.002, 12).rotation.x = Math.PI / 2;
  cyl(gp, '#f8f6f0', 0.28, Y0 + 0.088, -H + 0.062, 0.009, 0.002, 12).rotation.x = Math.PI / 2;
  chhatri(gp, 0.28, Y0 + 0.12, -H + 0.03, 0.05, MAR, MAR);
  // Ramgarhia Bungas: twin tall sandstone watchtowers behind the eastern range
  for (const [x, z] of [[H - 0.1, -H + 0.03], [H - 0.03, -H + 0.1]] as const) {
    lathe(gp, [[0.0001, 0], [0.02, 0], [0.018, 0.17], [0.022, 0.172], [0.022, 0.18], [0.015, 0.182], [0.0001, 0.182]], '#c8a27a', x, Y0, z, 8);
    for (let k = 1; k < 5; k++) cyl(gp, '#b08860', x, Y0 + k * 0.035, z, 0.0205, 0.003, 8);
    chhatri(gp, x, Y0 + 0.182, z, 0.024, MAR, MAR);
  }
  // Ber trees on the parikrama and pilgrims walking around the pool
  for (const [x, z] of [[0.36, 0.22], [-0.34, -0.38], [0.36, -0.34], [-0.37, 0.35]] as const) {
    rod(gp, [x, Y0, z], [x, Y0 + 0.03, z], 0.003, '#6b5040', 5);
    lowball(gp, '#4e7d3a', x, Y0 + 0.04, z, 0.045, 0.03, 0.045);
    lowball(gp, '#5f8f44', x + 0.008, Y0 + 0.052, z, 0.026, 0.02, 0.026);
  }
  for (let i = 0; i < 44; i++) {
    const t = hash3(i, 7, 1) * 4, side = Math.floor(t), u = (t - side) * 0.7 - 0.35, w = 0.31 + hash3(i, 7, 2) * 0.06;
    const [x, z] = side === 0 ? [u, w] : side === 1 ? [w, u] : side === 2 ? [u, -w] : [-w, u];
    person(gp, x, Y0, z, pc[i % pc.length], 0.9);
  }
};

// ---------------------------------------------------------------------------------------------------------
// Wat Arun — Khmer-style central prang of porcelain-studded tiers, four satellite prangs, Chao Phraya riverfront

/** Redented ("twelve-cornered") square plan with a central stair projection; fixed vertex count per ring. */
function redentPlan(s: number, n: number, pw: number, pp: number, k = 3): [number, number][] {
  const side: [number, number][] = [[-(s - 2 * n), s], [-pw, s], [-pw, s + pp], [pw, s + pp], [pw, s], [s - 2 * n, s], [s - 2 * n, s - n], [s - n, s - n], [s - n, s - 2 * n]];
  const out: [number, number][] = [];
  for (let q = 0; q < 4; q++) {
    const rot = ([x, z]: [number, number]): [number, number] => (q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]);
    for (let i = 0; i < side.length; i++) {
      const a = rot(side[i]);
      out.push(a);
      if (i === 0 || i === 4 || i === 2) {
        const b = rot(side[i + 1]);
        for (let j = 1; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
      }
    }
  }
  return out;
}
interface PrangTier { y: number; s: number; stair?: number }
/** Porcelain mosaic painter (white base, pastel sherds, grey shadow seams per band). */
const porcelain = (base: string, band: number, seed: number): Paint => (x, y, z, _nx, ny) => {
  if (ny > 0.55) return '#d6cfc0';
  if (ny < -0.4) return '#6d665c';
  const b = frac(y / band);
  if (b < 0.16) return '#9c9488';
  const h = hash3(Math.floor(x * 260 + 400), Math.floor(y * 260) + seed, Math.floor(z * 260 + 400));
  if (h > 0.95) return '#e8c0b8';
  if (h > 0.9) return '#bcd2de';
  if (h > 0.86) return '#ecdcaa';
  if (h < 0.18) return '#c9c1b2';
  return b > 0.85 ? shade(base, 0.92) : null;
};
/** Cached prang geometry: redented rings stacked through `tiers` (sawtooth ledges), porcelain-painted. */
function prangGeo(key: string, tiers: PrangTier[], band: number, k = 3): THREE.BufferGeometry {
  return g('a3pr:' + key, () => {
    const rings: V3[][] = [];
    for (const t of tiers) {
      const pl = redentPlan(t.s, t.s * 0.17, t.s * 0.26, (t.stair ?? 0) * t.s, k);
      rings.push(pl.map(([x, z]) => [x, t.y, z] as V3));
    }
    const holder = new THREE.Group();
    const m = skin(holder, rings, '#ece6da', { caps: true, flat: true, paint: porcelain('#ece6da', band, key.length) });
    return m.geometry;
  });
}
/** Prang profile: stepped stair terraces, then a corn-cob of diminishing sawtooth tiers. */
function prangTiers(H: number, W: number, nCob: number, terr: number): PrangTier[] {
  const t: PrangTier[] = [];
  let y = 0, s = W;
  // Near-vertical terrace walls with a balustraded ledge on top of each, steep central stairs
  for (let i = 0; i < terr; i++) {
    const h = H * (0.1 - i * 0.012);
    t.push({ y, s, stair: 0.36 }, { y: y + h * 0.15, s: s * 0.975, stair: 0.36 }, { y: y + h * 0.85, s: s * 0.94, stair: 0.36 }, { y: y + h, s: s * 0.96, stair: 0.36 });
    y += h; s *= 0.74;
    if (i < terr - 1) t.push({ y: y + 0.0001, s, stair: 0.36 });
  }
  // Bell-shaped base of the cob
  t.push({ y: y + 0.0002, s: s * 0.98 }, { y: y + H * 0.03, s: s * 0.9 }, { y: y + H * 0.04, s: s * 0.8 });
  y += H * 0.04; s *= 0.8;
  const y0 = y, yTop = H * 0.9, s0 = s;
  // Corn-cob: stays nearly cylindrical, then rounds off like a bullet
  const sc = (u: number) => s0 * Math.sqrt(Math.max(0.01, 1 - Math.pow(u, 2.6))) * (1 - 0.18 * u);
  for (let i = 0; i < nCob; i++) {
    const u0 = i / nCob, u1 = (i + 1) / nCob;
    const ya = y0 + (yTop - y0) * u0, yb = y0 + (yTop - y0) * u1;
    t.push({ y: ya + 0.0002, s: sc(u0) }, { y: yb - (yb - ya) * 0.3, s: sc(u0) * 0.97 }, { y: yb, s: sc(u1) * 0.88 });
  }
  t.push({ y: yTop + H * 0.01, s: s0 * 0.08 });
  return t;
}
/** Places a prang (cached geometry) plus its spire, trident and four Erawan niches. */
function prang(p: THREE.Object3D, key: string, x: number, y: number, z: number, H: number, W: number, terr: number, nCob: number, niches: boolean): void {
  const geo = prangGeo(key, prangTiers(H, W, nCob, terr), H * 0.028);
  add(p, geo, mat('#ffffff', { vc: true, flat: true }), x, y, z, 1, 1, 1);
  const yTop = y + H * 0.91;
  lathe(p, [[0.0001, 0], [H * 0.012, 0], [H * 0.008, H * 0.02], [H * 0.01, H * 0.025], [H * 0.006, H * 0.03], [H * 0.003, H * 0.07], [0, H * 0.075]], '#e9e3d6', x, yTop, z, 8);
  const ty = yTop + H * 0.07;
  rod(p, [x, ty, z], [x, ty + H * 0.06, z], H * 0.0025, '#d9a93a', 4);
  for (const s of [-1, 1]) rod(p, [x, ty + H * 0.025, z], [x + s * H * 0.012, ty + H * 0.045, z], H * 0.0018, '#d9a93a', 4);
  if (!niches) return;
  // Mid-height niches with Indra on the three-headed elephant Erawan, facing the four directions
  let yy = 0, s = W;
  for (let i = 0; i < terr; i++) { yy += H * 0.095; s *= 0.8; }
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2, R = s * 0.95;
    const ng = grp(p, x + Math.sin(a) * R, z + Math.cos(a) * R, a, y + yy + H * 0.04);
    box(ng, '#e9e3d6', 0, 0, 0, H * 0.06, H * 0.07, H * 0.03);
    box(ng, '#3a3530', 0, H * 0.008, H * 0.0152, H * 0.036, H * 0.045, 0.001);
    lowball(ng, '#f4f1ea', 0, H * 0.026, H * 0.012, H * 0.03, H * 0.022, H * 0.016);
    const gb = slab(ng, [[-H * 0.036, 0], [H * 0.036, 0], [0, H * 0.06]], H * 0.02, '#ece6da', 0, false);
    gb.position.set(0, H * 0.07, 0);
    gb.material = mat('#ece6da');
    rod(ng, [0, H * 0.13, 0], [0, H * 0.16, 0], H * 0.003, '#e9e3d6', 4);
  }
}
/** Thai sala/ubosot: white walls, layered red-and-green gable roofs with gilded chofa finials. */
function thaiHall(p: THREE.Object3D, x: number, z: number, ry: number, w: number, d: number, h: number, posts: boolean, y: number): void {
  const hg = grp(p, x, z, ry, y);
  if (posts) {
    box(hg, '#e9e3d6', 0, 0, 0, w, 0.004, d);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) box(hg, '#f4efe4', sx * (w / 2 - 0.003), 0.004, -d / 2 + 0.003 + (i * (d - 0.006)) / 3, 0.004, h, 0.004);
  } else {
    pbox(hg, w, h, d, 0, 0, 0, '#f1ece2', (_px, py, pz, ax) => (Math.abs(ax) > 0.5 && frac((pz + d / 2) / d * 4) > 0.35 && frac((pz + d / 2) / d * 4) < 0.65 && py > h * 0.2 && py < h * 0.75 ? '#7a4a2a' : null), [1, 4, 8]);
  }
  const tiers = [[1, 0], [0.75, h * 0.35]] as const;
  for (const [f, dy] of tiers) {
    gable(hg, w * 1.25 * f, w * 0.55 * f, d * (1 + 0.08 * f), '#b5452f', 0, h + dy, 0, Math.PI / 2);
    gable(hg, w * 1.29 * f, w * 0.57 * f, d * (0.94 + 0.08 * f), '#3f7f55', 0, h + dy - 0.003, 0, Math.PI / 2);
  }
  for (const sz of [-1, 1]) gbox(hg, '#d9a93a', 0, h + h * 0.35 + w * 0.42 - 0.004, sz * (d / 2 + 0.006), 0.003, 0.016, 0.003);
}
/** Long-tail boat: slim hull with a raised prow, canopy, and the engine's long propeller shaft. */
function longtail(p: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number, hull: string): void {
  const bg = grp(p, x, z, ry, y);
  bg.scale.setScalar(s);
  sweep(bg, [
    { p: [-0.07, 0.006, 0], w: 0.008, h: 0.005 }, { p: [-0.04, 0.003, 0], w: 0.011, h: 0.006 }, { p: [0.02, 0.003, 0], w: 0.011, h: 0.006 },
    { p: [0.06, 0.008, 0], w: 0.006, h: 0.005 }, { p: [0.08, 0.02, 0], w: 0.0015, h: 0.002 },
  ], hull, { radial: 8, sub: 3, squash: 0.6, paint: (_x, py) => (py > 0.0075 ? '#f3c623' : null) });
  box(bg, '#e8e2d2', -0.005, 0.009, 0, 0.07, 0.002, 0.024);
  for (const sx of [-0.035, 0.025]) for (const sz of [-1, 1]) rod(bg, [sx, 0.006, sz * 0.009], [sx, 0.024, sz * 0.009], 0.0009, '#4a3a2a', 4);
  box(bg, '#1f5fa8', -0.005, 0.024, 0, 0.074, 0.002, 0.026);
  box(bg, '#3a3a3a', -0.072, 0.008, 0, 0.012, 0.008, 0.008);
  rod(bg, [-0.072, 0.012, 0], [-0.12, 0.0, 0], 0.0012, '#5a5a5a', 4);
  for (let i = 0; i < 4; i++) person(bg, -0.03 + i * 0.016, 0.006, 0, ['#dc2626', '#1d4ed8', '#f8fafc', '#16a34a'][i], 0.8);
  // Flower garlands on the prow
  for (const c of ['#f472b6', '#facc15']) lowball(bg, c, 0.074, 0.016, 0, 0.006);
}

const watarun: Builder = (gp, r) => {
  const RIV = '#6f837c', WL = '#efe9dc', LAND = 0.028, ZR = 0.2;
  // Chao Phraya (brownish green, wide) in front; the Thonburi bank is a raised slab behind the embankment
  island(gp, 0.5, () => 0, RIV, sea(RIV, 0.022, 2), { rings: 10, segs: 72, side: strataSide(['#6a5a48', '#5a4a3a']) });
  bankSlab(gp, 0.5, ZR, 0.035 + LAND, '#6f9150', (x, y, z, _nx, ny) => {
    if (ny < 0.5) return y > 0.05 ? '#6a5a48' : y > 0.025 ? '#5a4a3a' : '#4a3a2e';
    const ci = Math.floor((x + 1) / 0.03), cj = Math.floor((z + 1) / 0.03);
    if (Math.abs(x) < 0.3 && z > -0.32 && z < 0.14) return (ci + cj) % 2 ? '#d9d2c3' : '#cfc7b6';
    return hash3(ci, 2, cj) > 0.6 ? '#7a9a5a' : null;
  });
  const G = 0.035 + LAND;
  // White embankment wall with balustrade and a promenade along the river
  box(gp, '#e5dfd2', 0, 0.02, ZR - 0.004, 0.9, G - 0.02, 0.012);
  const bal: number[][] = [];
  for (let i = 0; i < 44; i++) bal.push([-0.43 + i * 0.02, G, ZR - 0.006, 0.003, 0.009, 0.003]);
  batch(gp, bal, WL);
  box(gp, WL, 0, G + 0.009, ZR - 0.006, 0.88, 0.002, 0.005);
  // Prang courtyard platform with enclosing balustrade
  const CZ = -0.08, Y1 = G + 0.016;
  box(gp, '#d8d0bf', 0, G, CZ, 0.56, 0.016, 0.54);
  paved(gp, 0.54, 0.52, Y1 - 0.002, 0.002, '#e2dbcb', 0.024, 0, CZ);
  // Central prang with four satellite prangs at the corners and four mondops on the axes
  prang(gp, 'wa-main', 0, Y1, CZ, 0.8, 0.15, 3, 12, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) prang(gp, 'wa-sat', sx * 0.2, Y1, CZ + sz * 0.2, 0.38, 0.048, 1, 9, false);
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2, x = Math.sin(a) * 0.245, z = CZ + Math.cos(a) * 0.235;
    box(gp, '#ece6da', x, Y1, z, 0.04, 0.035, 0.04);
    box(gp, '#3a3530', x, Y1 + 0.006, z, 0.016, 0.022, 0.0415);
    box(gp, '#3a3530', x, Y1 + 0.006, z, 0.0415, 0.022, 0.016);
    lathe(gp, [[0.0001, 0], [0.026, 0], [0.024, 0.006], [0.018, 0.012], [0.017, 0.018], [0.012, 0.024], [0.011, 0.03], [0.007, 0.036], [0.004, 0.06], [0.0015, 0.09], [0, 0.095]], '#e9e3d6', x, Y1 + 0.035, z, 8);
  }
  // Riverside salas, the ordination hall behind and the pier
  thaiHall(gp, -0.3, 0.12, 0, 0.05, 0.08, 0.03, true, G);
  thaiHall(gp, 0.31, 0.12, 0, 0.05, 0.08, 0.03, true, G);
  thaiHall(gp, -0.34, -0.26, 0, 0.09, 0.15, 0.05, false, G);
  thaiHall(gp, 0.36, -0.22, 0.2, 0.06, 0.1, 0.035, false, G);
  box(gp, '#8a7a66', 0.14, 0.03, 0.27, 0.05, 0.004, 0.14);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) rod(gp, [0.14 + sx * 0.022, 0.0, 0.22 + i * 0.045], [0.14 + sx * 0.022, 0.034, 0.22 + i * 0.045], 0.002, '#5a4a3a', 4);
  thaiHall(gp, 0.14, 0.32, 0, 0.04, 0.04, 0.02, true, 0.034);
  // Trees and shrubs, visitors
  const trees: [number, number, number][] = [[-0.38, 0.0, 0.07], [-0.4, -0.12, 0.06], [0.39, -0.05, 0.065], [0.4, 0.06, 0.05], [-0.18, 0.15, 0.04], [0.2, 0.16, 0.04], [-0.12, -0.38, 0.06], [0.14, -0.4, 0.07], [0.3, -0.36, 0.05], [-0.26, 0.17, 0.035]];
  for (const [x, z, s] of trees) {
    rod(gp, [x, G, z], [x, G + s * 0.5, z], s * 0.06, '#5a4636', 5);
    lowball(gp, hash3(x, z, 1) > 0.5 ? '#3f7a3c' : '#4b8a44', x, G + s * 0.75, z, s * 1.1, s * 0.8, s * 1.1);
  }
  palm(gp, -0.24, G, 0.15, 0.09, 3);
  palm(gp, 0.25, G, 0.165, 0.08, 7);
  const pc = ['#f8fafc', '#f472b6', '#1d4ed8', '#dc2626', '#facc15', '#0f766e'];
  for (let i = 0; i < 16; i++) person(gp, -0.22 + hash3(i, 5, 1) * 0.44, Y1, CZ + 0.15 + hash3(i, 5, 2) * 0.08, pc[i % pc.length], 0.85);
  for (let i = 0; i < 8; i++) person(gp, -0.4 + hash3(i, 6, 1) * 0.8, G, ZR - 0.02, pc[i % pc.length], 0.85);
  // Long-tail boat and a river ferry on the Chao Phraya
  longtail(gp, -0.16, 0.035, 0.34, 0.15, 1.0, '#8a2a2a');
  const fg = grp(gp, 0.3, 0.38, -0.1, 0.035);
  sweep(fg, [{ p: [-0.06, 0.006, 0], w: 0.014, h: 0.006 }, { p: [0.04, 0.006, 0], w: 0.016, h: 0.007 }, { p: [0.07, 0.01, 0], w: 0.004, h: 0.004 }], '#f8fafc', { radial: 8, sub: 3, squash: 0.5, paint: (_x, py) => (py < 0.004 ? '#b91c1c' : null) });
  box(fg, '#f1ece2', -0.005, 0.01, 0, 0.08, 0.012, 0.024);
  box(fg, '#f97316', -0.005, 0.022, 0, 0.084, 0.003, 0.028);
  void r;
};

// ---------------------------------------------------------------------------------------------------------
// Burj Al Arab — V-plan tower whose white fabric sail is stretched between two curved exoskeleton legs,
// X-trussed flanks, a back spine/mast with spire, the cantilevered helipad and Al Muntaha wing, on its island

const burjalarab: Builder = (gp, r) => {
  const SEA = '#2bb3c0', WHITE = '#f4f6f8', GLASS = '#8fa6b8';
  // Turquoise Gulf with lighter shallows around the island and along the Jumeirah shore
  const IX = 0.02, IZ = -0.02, IR = 0.17;
  island(gp, 0.5, () => 0, SEA, (x, y, z) => {
    const d = Math.hypot(x - IX, z - IZ);
    if (d < IR + 0.035 || x < -0.3) return hash3(Math.floor(x * 40), 1, Math.floor(z * 40)) > 0.5 ? '#7fd8d6' : '#6fd0d0';
    return sea(SEA, 0.03, 2)(x, y, z, 0, 1, 0);
  }, { rings: 12, segs: 80, side: strataSide(['#2a7f8a', '#226a74']) });
  // Jumeirah beach strip with palms and parasols
  bankSlab(gp, 0.5, -0.36, 0.05, '#e8d7ae', (x, y, _z, _nx, ny) => {
    if (ny < 0.5) return y > 0.035 ? '#d8c69c' : '#b8a47c';
    return x < -0.43 ? '#9a9a96' : null;
  }, Math.PI / 2);
  for (let i = 0; i < 7; i++) palm(gp, -0.45, 0.05, -0.27 + i * 0.09, 0.07 + hash3(i, 3, 3) * 0.02, i * 1.7);
  for (let i = 0; i < 8; i++) {
    const z = -0.24 + i * 0.07, x = -0.395;
    rod(gp, [x, 0.05, z], [x, 0.068, z], 0.0012, '#e8e2d2', 4);
    cone(gp, i % 2 ? '#f8fafc' : '#2563eb', x, 0.066, z, 0.012, 0.006, 8);
  }
  // Artificial island: revetment of rock armour, podium terrace, palms
  const Y0 = 0.05;
  lathe(gp, [[IR + 0.03, 0.03], [IR + 0.02, 0.04], [IR, Y0], [0, Y0]], '#c8bba0', IX, 0, IZ, 28);
  const rocks: number[][] = [];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, rr = IR + 0.018 + hash3(i, 1, 2) * 0.01, sz = 0.012 + hash3(i, 2, 1) * 0.008;
    rocks.push([IX + Math.cos(a) * rr, 0.026 + hash3(i, 7, 1) * 0.006, IZ + Math.sin(a) * rr, sz, sz * 0.7, sz * 0.9, a + hash3(i, 3, 3)]);
  }
  batch(gp, rocks, '#b9ad94');
  paved(gp, 0.24, 0.24, Y0, 0, '#ece6da', 0.02, IX, IZ);
  for (const [x, z] of [[-0.12, 0.08], [0.13, 0.07], [0.1, -0.12], [-0.11, -0.11]]) palm(gp, IX + x, Y0, IZ + z, 0.055, x * 40);
  // Tower group, turned so both the sail and an X-trussed flank face the viewer
  const tw = grp(gp, IX, IZ + 0.01, 0.3);
  const ZM = -0.1, L0 = 0.25, HT = 0.84, HA = 0.43;
  box(tw, '#e9edf1', 0, Y0, ZM + 0.06, 0.2, 0.022, 0.2);
  box(tw, '#4a6a80', 0, Y0 + 0.004, ZM + 0.161, 0.16, 0.012, 0.002);
  // Tower body: rings run apex → left wing face → bowed sail → right wing face
  const Ld = (y: number) => L0 * Math.pow(Math.max(0, 1 - Math.pow(y / HT, 2.2)), 0.6);
  const tip = (y: number, sgn: number): V3 => { const L = Ld(y); return [sgn * Math.sin(HA) * L, Y0 + y, ZM + Math.cos(HA) * L]; };
  const KW = 7, KS = 12, rings: V3[][] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 30; i++) ys.push(0.022 + i * 0.026, 0.0255 + i * 0.026, 0.03 + i * 0.026);
  for (const y of ys) {
    const L = Ld(y), ring: V3[] = [], A: V3 = [0, Y0 + y, ZM + 0.004];
    const TL = tip(y, -1), TR = tip(y, 1);
    for (let k = 0; k < KW; k++) { const t = k / KW; ring.push([A[0] + (TL[0] - A[0]) * t, Y0 + y, A[2] + (TL[2] - A[2]) * t]); }
    for (let k = 0; k < KS; k++) {
      const t = k / KS, bow = Math.sin(t * Math.PI) * L * 0.08;
      ring.push([TL[0] + (TR[0] - TL[0]) * t, Y0 + y, TL[2] + (TR[2] - TL[2]) * t + bow - 0.006]);
    }
    for (let k = 0; k < KW; k++) { const t = k / KW; ring.push([TR[0] + (A[0] - TR[0]) * t, Y0 + y, TR[2] + (A[2] - TR[2]) * t]); }
    rings.push(ring);
  }
  skin(tw, rings, WHITE, {
    caps: true, flat: true,
    paint: (_x, y, _z, _nx, ny, nz) => {
      if (Math.abs(ny) > 0.6) return '#d9dde2';
      const v = frac((y - Y0 - 0.022) / 0.026);
      if (nz > 0.5) return v < 0.135 ? '#d5dae0' : null; // fabric sail with seams
      return v < 0.31 ? '#f1f3f5' : GLASS;
    },
  });
  // Curved exoskeleton legs along the sail edges, meeting the mast at the crown
  for (const sgn of [-1, 1]) {
    const st = [0, 0.1, 0.25, 0.4, 0.55, 0.68, 0.77, 0.83].map((y, i, arr) => {
      const t = tip(Math.min(y, 0.835), sgn);
      return { p: [t[0] + sgn * 0.006, t[1], t[2] + 0.004] as V3, w: 0.011 - (i / arr.length) * 0.004 };
    });
    sweep(tw, st, WHITE, { radial: 8, sub: 4 });
  }
  // Big X-trusses on both flanks, standing off the room facade
  const lv = [0.02, 0.2, 0.39, 0.57, 0.73];
  for (const sgn of [-1, 1]) {
    const off = (q: V3): V3 => [q[0] + sgn * 0.012 * Math.cos(HA), q[1], q[2] - 0.012 * Math.sin(HA)];
    const mid = (y: number): V3 => off([0, Y0 + y, ZM]), edge = (y: number): V3 => off(tip(y, sgn));
    for (let i = 0; i < lv.length; i++) {
      rod(tw, mid(lv[i]), edge(lv[i]), 0.0035, WHITE, 5);
      if (i < lv.length - 1) {
        rod(tw, mid(lv[i]), edge(lv[i + 1]), 0.0042, WHITE, 5);
        rod(tw, edge(lv[i]), mid(lv[i + 1]), 0.0042, WHITE, 5);
      }
    }
  }
  // Back spine/mast with the spire
  pbox(tw, 0.034, 0.9, 0.03, 0, Y0, ZM - 0.012, '#e9edf1', (_x, y, _z, _ax, ay, az) => (az < -0.5 && frac(y / 0.03) < 0.15 && ay < 0.5 ? '#c9cfd6' : null), [1, 30, 1]);
  lathe(tw, [[0.012, 0], [0.008, 0.04], [0.004, 0.1], [0.0015, 0.17], [0, 0.18]], WHITE, 0, Y0 + 0.9, ZM - 0.012, 8);
  // Al Muntaha skybar: tapered crossbar cantilevered from the mast near the crown
  const MY = Y0 + 0.74;
  const mu = slab(tw, [[-0.13, 0], [0.13, 0], [0.13, 0.024], [0.11, 0.03], [-0.11, 0.03], [-0.13, 0.024]], 0.04, WHITE, 0, false);
  mu.position.set(0, MY, ZM - 0.002);
  pbox(tw, 0.25, 0.012, 0.042, 0, MY + 0.009, ZM - 0.002, GLASS, (_x, _y, _z, _ax, ay) => (Math.abs(ay) > 0.5 ? WHITE : null));
  for (const sx of [-1, 1]) rod(tw, [sx * 0.12, MY, ZM - 0.002], [sx * 0.02, MY - 0.07, ZM - 0.006], 0.003, WHITE, 5);
  // Helipad disc on a cantilever behind the mast
  const HX = 0.035, HZ = ZM - 0.085, HY = Y0 + 0.785;
  const hp = new THREE.CylinderGeometry(0.05, 0.045, 0.006, 24);
  hp.translate(HX, HY, HZ);
  place(tw, hp, '#d7dbe0', (x, _y, z, _nx, ny) => {
    if (ny < 0.5) return '#e9edf1';
    const u = x - HX, v = z - HZ, d = Math.hypot(u, v);
    if (d > 0.04 && d < 0.045) return '#facc15';
    if ((Math.abs(Math.abs(u) - 0.01) < 0.003 && Math.abs(v) < 0.014) || (Math.abs(v) < 0.0025 && Math.abs(u) < 0.012)) return '#f8fafc';
    return '#2f9e57';
  });
  for (const k of [-1, 1]) rod(tw, [0, HY - 0.05, ZM - 0.026], [HX + k * 0.02, HY, HZ + 0.01], 0.0028, WHITE, 5);
  rod(tw, [0, HY, ZM - 0.026], [HX, HY, HZ + 0.03], 0.004, WHITE, 5);
  // Curved causeway bridge from the island to the shore
  const cw: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; cw.push([IX - IR - 0.01 - t * 0.2, IZ + 0.02 + Math.sin(t * Math.PI) * 0.06 + t * 0.06]); }
  const deck: number[][] = [], rail: number[][] = [], piers: number[][] = [];
  for (let i = 0; i < cw.length - 1; i++) {
    const [x0, z0] = cw[i], [x1, z1] = cw[i + 1], L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(-(z1 - z0), x1 - x0);
    deck.push([(x0 + x1) / 2, 0.044, (z0 + z1) / 2, L + 0.002, 0.005, 0.022, a]);
    for (const sd of [-1, 1]) rail.push([(x0 + x1) / 2 - Math.sin(a) * sd * 0.011, 0.049, (z0 + z1) / 2 - Math.cos(a) * sd * 0.011, L + 0.002, 0.004, 0.002, a]);
    if (i % 2 === 0) piers.push([x0, 0.03, z0, 0.006, 0.014, 0.016, a]);
  }
  batch(gp, deck, '#d9d3c4');
  batch(gp, rail, WHITE);
  batch(gp, piers, '#bdb6a6');
  // Yachts and a dhow on the turquoise sea
  for (const [x, z, a, s] of [[0.3, 0.25, 0.4, 1], [0.24, 0.38, -0.3, 0.8], [0.35, -0.2, 1.2, 0.9]] as const) {
    const yg = grp(gp, x, z, a, 0.035);
    yg.scale.setScalar(s);
    sweep(yg, [{ p: [-0.04, 0.004, 0], w: 0.012, h: 0.006 }, { p: [0.02, 0.004, 0], w: 0.014, h: 0.007 }, { p: [0.05, 0.007, 0], w: 0.002, h: 0.003 }], WHITE, { radial: 8, sub: 3, squash: 0.6 });
    box(yg, '#e9edf1', -0.008, 0.007, 0, 0.035, 0.008, 0.012);
    box(yg, '#334155', -0.006, 0.011, 0, 0.03, 0.003, 0.0125);
  }
  void r;
};
// ---------------------------------------------------------------------------------------------------------
// Terracotta Army, Pit 1 (excavated 1974–) — the east end as seen today: rammed-earth partition walls (隔墙)
// dividing nine brick-floored corridors and two flank corridors, the vanguard of three ranks of archers across
// the front gallery, armoured infantry four abreast and chariot teams behind them, the army facing east (+z).
// The rear section keeps the Qin roof as found: charred cross-beams (棚木) over the walls under mats and fill.
// Pit ≈62 m across at ≈0.0125 per metre, 5 m deep; figures grey terracotta with faint traces of their paint.

/** Terracotta warrior on his square plinth, facing +z (~100 tris); `painted` keeps traces of red/green/lacquer. */
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
// ---------------------------------------------------------------------------------------------------------
// Paro Taktsang (Tiger's Nest) — whitewashed temples with red kemar bands and gilded roofs clinging to a sheer
// dark cliff high above the Paro valley; prayer flags, pine forest on the slopes and drifting valley mist

/** Low-pitched hipped roof (ridge along local x), base at y. */
function hipRoof(p: THREE.Object3D, c: string, x: number, y: number, z: number, w: number, d: number, h: number, ry = 0, o: { metal?: number; rough?: number } = {}): THREE.Mesh {
  const hw = w / 2, hd = d / 2, rx = Math.max(0, hw - hd);
  const A: V3 = [-hw, 0, hd], B: V3 = [hw, 0, hd], C: V3 = [hw, 0, -hd], D: V3 = [-hw, 0, -hd], R1: V3 = [-rx, h, 0], R2: V3 = [rx, h, 0];
  const tris: V3[] = [A, B, R2, A, R2, R1, C, D, R1, C, R1, R2, B, C, R2, D, A, R1, A, D, C, A, C, B];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return add(p, geo, mat(c, o), x, y, z, 1, 1, 1, ry);
}

/** Pine with a slim trunk and three stacked cones (~60 tris), unit height. */
const pineTpl = () => g('a3:pine', () => template([
  [tp('cyl', 0, 0.12, 0, 0.06, 0.24, 0.06, 0, 0, 4), '#4e3a2a'],
  [tp('cone', 0, 0.36, 0, 0.42, 0.44, 0.42, 0, 0, 5), '#2c5236'],
  [tp('cone', 0, 0.6, 0, 0.32, 0.38, 0.32, 0, 0, 5), '#336040'],
  [tp('cone', 0, 0.82, 0, 0.2, 0.36, 0.2, 0, 0, 5), '#3a6a46'],
]));

/** Bhutanese building batches: whitewashed walls, red kemar band, timber windows, eaves (world-space boxes). */
interface DzBatch { wall: number[][]; band: number[][]; win: number[][]; frame: number[][]; eave: number[][]; rock: number[][] }
function dzong(p: THREE.Object3D, B: DzBatch, x: number, y: number, z: number, w: number, d: number, h: number, ry: number,
  o: { foot?: number; gold?: boolean; roof?: string; balc?: boolean } = {}): void {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const put = (arr: number[][], lx: number, ly: number, lz: number, sx: number, sy: number, sz: number) =>
    arr.push([x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs, sx, sy, sz, ry]);
  if (o.foot) put(B.rock, 0, -o.foot, 0, w * 0.96, o.foot + 0.002, d * 0.96);
  put(B.wall, 0, 0, 0, w, h, d);
  put(B.band, 0, h * 0.8, 0, w + 0.003, h * 0.12, d + 0.003);
  put(B.eave, 0, h * 0.92, 0, w + 0.004, h * 0.08, d + 0.004);
  // Windows on all four faces: small dark openings low down, framed timber windows above, lattice in the band
  for (const [fx, fz, L] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]] as const) {
    const n = Math.max(1, Math.floor(L / 0.026)), off = (fz ? d : w) / 2 + 0.0008;
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n - 0.5) * L * 0.9;
      const at = (arr: number[][], ly: number, ww: number, wh: number, t: number) =>
        fz ? put(arr, u, ly, fz * (off + t / 2 - 0.001), ww, wh, t) : put(arr, fx * (off + t / 2 - 0.001), ly, u, t, wh, ww);
      if (h > 0.075) at(B.win, h * 0.28, 0.006, 0.008, 0.002);
      at(B.frame, h * 0.5, 0.012, 0.014, 0.002);
      at(B.win, h * 0.51, 0.008, 0.01, 0.003);
      at(B.win, h * 0.82, 0.01, h * 0.08, 0.004);
    }
  }
  if (o.balc) { put(B.frame, 0, h * 0.45, d / 2 + 0.006, w * 0.45, 0.022, 0.012); put(B.win, 0, h * 0.48, d / 2 + 0.0125, w * 0.4, 0.014, 0.002); }
  const g0 = grp(p, x, z, ry, y + h);
  box(g0, '#5a2a1c', 0, 0, 0, w + 0.028, 0.004, d + 0.028);
  const rh = Math.min(w, d) * 0.22;
  hipRoof(g0, o.roof ?? '#9b3b2a', 0, 0.004, 0, w + 0.026, d + 0.026, rh);
  if (o.gold) {
    const ty = 0.004 + rh * 0.55, cw = Math.min(w, d) * 0.36;
    box(g0, '#9a3a24', 0, ty, 0, cw, 0.014, cw);
    box(g0, '#5a2a1c', 0, ty + 0.014, 0, cw + 0.012, 0.003, cw + 0.012);
    gild(hipRoof(g0, '#d6a536', 0, ty + 0.017, 0, cw + 0.01, cw + 0.01, cw * 0.4), '#d6a536', false);
    gild(lathe(g0, [[0, 0], [0.006, 0.002], [0.0045, 0.008], [0.007, 0.012], [0.003, 0.02], [0.0015, 0.028], [0, 0.03]], '#e0b040', 0, ty + 0.017 + cw * 0.36, 0, 8), '#e0b040');
  }
}

const tigersnest: Builder = (gp) => {
  // Valley floor: forested slopes rising toward the cliff, falling away to the river valley at front-right
  const hF: HFn = (x, z) => Math.max(0.004, 0.05 + 0.1 * sstep(0.3, -0.25, z) - 0.035 * sstep(-0.05, 0.4, x + z * 0.6) + (fbm(x * 6, 2, z * 6) - 0.5) * 0.05);
  island(gp, 0.5, hF, '#3d6638', (x, _y, z) => {
    const m = fbm(x * 9, 5, z * 9);
    return m > 0.62 ? '#4d7a42' : m < 0.35 ? '#335a32' : null;
  }, { rings: 16, segs: 60, side: strataSide(['#5a4a3a', '#4a3c30']) });
  // The cliff: a tall rock mass of stacked plan rings with vertical fluting, overhang and a rounded summit
  const CX = -0.07, CZ = -0.19, RX = 0.37, RZ = 0.26, N = 56;
  const ys: number[] = [], ss: number[] = [];
  for (let j = 0; j <= 26; j++) {
    const t = j / 26, y = 0.03 + t * 0.85;
    ys.push(y); ss.push(1.06 - 0.06 * sstep(0, 0.2, t) + 0.035 * sstep(0.62, 0.9, t));
  }
  ys.push(0.915, 0.94, 0.958, 0.97); ss.push(0.93, 0.78, 0.55, 0.25);
  const lobe = (a: number) => 1 + 0.09 * Math.sin(a * 3 + 1.2) + 0.05 * Math.sin(a * 5 + 0.4) + 0.03 * Math.sin(a * 9 + 2);
  const rr = (a: number, y: number) => lobe(a) - 0.035 * Math.abs(Math.sin(a * 13 + fbm(a, y * 2, 1) * 3)) + (fbm(Math.cos(a) * 3, y * 4, Math.sin(a) * 3) - 0.5) * 0.16;
  const NR = ys.length;
  const cliff: V3[][] = ys.map((y, j) => {
    const ring: V3[] = [], t = j / (NR - 1), lean = 0.025 * Math.sin(y * 7);
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, r = rr(a, y) * ss[j];
      // the summit slopes up toward the back, where the mountain continues
      ring.push([CX + lean + Math.cos(a) * RX * r, y - sstep(0.75, 1, t) * 0.06 * (1 + Math.sin(a)) * 0.5 + 0.03 * sstep(0.75, 1, t), CZ + Math.sin(a) * RZ * r]);
    }
    return ring;
  });
  const DY = 0.85 / 26;
  skin(gp, cliff, '#5f5b56', {
    caps: true, flat: true,
    paint: (x, y, z, _nx, ny) => {
      if (ny > 0.5) return fbm(x * 14, y, z * 14) > 0.5 ? '#355e34' : '#40683a';
      const col = Math.floor(((Math.atan2(z - CZ, x - CX) / (Math.PI * 2)) + 1) * N) % N, row = Math.floor((y - 0.03) / DY);
      const hc = hash3(col, 3, 7), hr = hash3(col, row >> 2, 11), m = fbm(x * 6, y * 5, z * 6);
      if (y < 0.16 && m > 0.5) return m > 0.6 ? '#3d6a3a' : '#4a6e40';
      if (ny > 0.2 && m > 0.42) return '#4f6e3c';
      if (y > 0.86 && m > 0.45) return '#476a3a';
      if (hc < 0.3 && hr > 0.25) return hc < 0.12 ? '#36332f' : '#46423e';
      if (m > 0.63) return '#7a7266';
      return hr > 0.85 ? '#6c655c' : hr < 0.12 ? '#514d48' : null;
    },
  });
  // Rock spur under the monastery: sheared rings so its top ledge rises to the right
  const SX = 0.04, SZ = 0.06, SRX = 0.25, SRZ = 0.12, TOP = (x: number) => 0.37 + 0.25 * (x - SX);
  const spur: V3[][] = [];
  for (let j = 0; j <= 10; j++) {
    const t = j / 10, s = 1.3 - 0.3 * sstep(0, 0.7, t) - 0.08 * sstep(0.85, 1, t), ring: V3[] = [];
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2, r = s * (1 + (fbm(Math.cos(a) * 3, t * 3, Math.sin(a) * 3 + 5) - 0.5) * 0.25);
      const x = SX + Math.cos(a) * SRX * r, z = SZ + Math.sin(a) * SRZ * r;
      ring.push([x, 0.06 + t * (TOP(x) - 0.06), z]);
    }
    spur.push(ring);
  }
  skin(gp, spur, '#6f6a63', {
    caps: true, flat: true,
    paint: (x, y, z, _nx, ny) => {
      const m = fbm(x * 8, y * 6, z * 8 + 2);
      if (ny > 0.5) return m > 0.5 ? '#4a7340' : '#5a7a48';
      if (m > 0.56 || ny > 0.2 && m > 0.4) return m > 0.66 ? '#3b6436' : '#4d7442';
      return m < 0.36 ? '#5d5852' : hash3(Math.floor(x * 40), Math.floor(y * 30), 3) > 0.8 ? '#8a8173' : null;
    },
  });
  // Monastery: tiers of temples stepping up the ledge, the higher ones set back into the cliff
  const B: DzBatch = { wall: [], band: [], win: [], frame: [], eave: [], rock: [] };
  dzong(gp, B, -0.13, TOP(-0.13) - 0.015, 0.125, 0.1, 0.075, 0.085, 0.15, { foot: 0.06 });
  dzong(gp, B, -0.19, TOP(-0.19) + 0.07, 0.04, 0.08, 0.075, 0.08, 0.15, { foot: 0.08, gold: true });
  dzong(gp, B, 0.05, TOP(0.05) + 0.005, 0.09, 0.19, 0.11, 0.115, -0.12, { foot: 0.07, balc: true });
  dzong(gp, B, 0.02, TOP(0.02) + 0.075, 0.0, 0.15, 0.09, 0.11, -0.12, { foot: 0.07, gold: true });
  dzong(gp, B, -0.07, TOP(-0.07) + 0.03, 0.06, 0.06, 0.06, 0.09, -0.05, { foot: 0.05 });
  dzong(gp, B, 0.22, TOP(0.22) + 0.01, 0.02, 0.085, 0.08, 0.14, -0.35, { foot: 0.07, gold: true });
  dzong(gp, B, 0.275, TOP(0.275) + 0.08, -0.085, 0.055, 0.055, 0.08, -0.5, { foot: 0.11, gold: true });
  batch(gp, B.rock, '#6a655e');
  batch(gp, B.wall, '#f1ede4', { rough: 0.85 });
  batch(gp, B.band, '#a3402a');
  batch(gp, B.eave, '#6b3322');
  batch(gp, B.frame, '#7a4a28');
  batch(gp, B.win, '#2a1c16');
  // Prayer flags strung down the slopes, plus tall white darchor poles on the lower ridge
  const FC = ['#2f6fd0', '#f4f1ea', '#c8332b', '#2f9a4a', '#e8c23a'], flags: number[][][] = FC.map(() => []);
  const string = (a: V3, b: V3, sag: number) => {
    rod(gp, a, b, 0.0007, '#d8d2c4', 3);
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.floor(Math.hypot(L, b[1] - a[1]) / 0.011), ry = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      flags[i % 5].push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.009, a[2] + (b[2] - a[2]) * t, 0.008, 0.009, 0.0012, ry]);
    }
  };
  string([-0.08, TOP(-0.08) + 0.07, 0.15], [-0.3, hF(-0.3, 0.26) + 0.12, 0.28], 0.01);
  string([-0.13, TOP(-0.13) + 0.07, 0.16], [-0.12, hF(-0.12, 0.38) + 0.1, 0.38], 0.012);
  string([0.16, TOP(0.16) + 0.08, 0.1], [0.36, hF(0.36, 0.22) + 0.11, 0.22], 0.012);
  string([0.27, TOP(0.27) + 0.13, -0.04], [0.42, hF(0.42, 0.05) + 0.12, 0.05], 0.015);
  string([-0.3, hF(-0.3, 0.26) + 0.12, 0.28], [-0.4, hF(-0.4, 0.1) + 0.09, 0.12], 0.01);
  flags.forEach((f, i) => batch(gp, f, FC[i], { rough: 0.9 }));
  for (const [x, z] of [[-0.3, 0.26], [-0.34, 0.31], [-0.25, 0.33], [0.36, 0.22], [0.42, 0.05], [-0.4, 0.1]] as const) {
    const y = 0.035 + hF(x, z) - 0.005;
    cyl(gp, '#ddd6c8', x, y, z, 0.0012, 0.13, 4);
    box(gp, '#f4f1ea', x + 0.0035, y + 0.06, z, 0.007, 0.065, 0.001);
  }
  // Pine forest on every slope that isn't cliff
  const pines: number[][] = [];
  for (let i = 0; i < 700 && pines.length < 330; i++) {
    const a = hash3(i, 1, 9) * Math.PI * 2, r = 0.47 * Math.sqrt(hash3(i, 2, 9)), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (((x - CX) / (RX * 1.1)) ** 2 + ((z - CZ) / (RZ * 1.12)) ** 2 < 1) continue;
    if (((x - SX) / (SRX * 1.32)) ** 2 + ((z - SZ) / (SRZ * 1.35)) ** 2 < 1) continue;
    const s = 0.06 + hash3(i, 3, 9) * 0.05;
    pines.push([x, 0.035 + hF(x, z) - 0.004, z, a, s * 0.6, 0.85 + hash3(i, 4, 9) * 0.3, s]);
  }
  // A few pines clinging to the spur's flanks
  for (let i = 0; i < 18; i++) {
    const a = 0.3 + hash3(i, 5, 9) * 2.6, t = 0.25 + hash3(i, 6, 9) * 0.5, s = 1.3 - 0.3 * sstep(0, 0.7, t);
    const x = SX + Math.cos(a) * SRX * s * 1.02, z = SZ + Math.sin(a) * SRZ * s * 1.05;
    pines.push([x, 0.06 + t * (TOP(x) - 0.06) - 0.01, z, a, 0.03, 0.9 + hash3(i, 7, 9) * 0.2, 0.055]);
  }
  stamp(gp, pineTpl(), pines);
  // Forest on the summit, where the mountain carries on behind the cliff
  const top: number[][] = [];
  for (let i = 0; i < 120; i++) {
    const a = hash3(i, 8, 3) * Math.PI * 2, r = 0.86 * Math.sqrt(hash3(i, 9, 3));
    const x = CX + Math.cos(a) * RX * r * lobe(a), z = CZ + Math.sin(a) * RZ * r * lobe(a);
    const yy = r < 0.25 ? 0.97 : r < 0.55 ? 0.97 - (r - 0.25) * 0.04 : r < 0.78 ? 0.958 - (r - 0.55) * 0.08 : 0.94 - (r - 0.78) * 0.17;
    const t = sstep(0.4, 1, Math.min(1, r * 1.1));
    top.push([x + 0.025 * Math.sin(yy * 7), yy - t * 0.06 * (1 + Math.sin(a)) * 0.5 + 0.03 - 0.006, z, a, 0.04, 0.8 + hash3(i, 7, 3) * 0.35, 0.06 + hash3(i, 6, 3) * 0.04]);
  }
  stamp(gp, pineTpl(), top);
  // Valley mist drifting below the monastery
  const mist = mat('#ffffff', { transparent: 0.24, flat: false, emissive: '#9aa3b0' });
  const MS = g('a3:mist', () => new THREE.SphereGeometry(0.5, 16, 8));
  for (const [x, y, z, sx, sy, sz] of [[0.26, 0.15, 0.26, 0.15, 0.022, 0.08], [0.33, 0.17, 0.12, 0.09, 0.02, 0.1], [-0.2, 0.15, 0.34, 0.13, 0.02, 0.06], [0.06, 0.12, 0.38, 0.14, 0.018, 0.06]] as const)
    add(gp, MS, mist, x, y, z, sx * 2, sy * 2, sz * 2);
  // Pilgrims on the viewpoint below the flags
  for (let i = 0; i < 4; i++) person(gp, -0.3 + i * 0.02, 0.035 + hF(-0.3 + i * 0.02, 0.3), 0.3, ['#7a2a2a', '#d4a03a', '#3a5a8a', '#7a2a2a'][i], 1.3);
};
// ---------------------------------------------------------------------------------------------------------
// Bagan — a green-ochre plain scattered with brick stupas and temples: the white-and-gold Ananda, the terraced
// Shwesandaw pagoda, big brick temples, toddy palms and hot-air balloons drifting over at dawn

const BELL: [number, number][] = [[0, 0], [0.5, 0], [0.5, 0.08], [0.42, 0.1], [0.42, 0.17], [0.36, 0.19], [0.36, 0.25], [0.34, 0.3], [0.31, 0.42], [0.24, 0.52], [0.15, 0.58], [0.1, 0.6], [0.1, 0.64], [0.07, 0.66], [0.06, 0.72], [0.035, 0.85], [0.012, 0.98], [0, 1]];
/** Small brick bell stupa on square tiers (~170 tris), unit height. */
const stupaTpl = () => g('a3:bstupa', () => {
  const bell = new THREE.LatheGeometry(BELL.slice(4).map(([r, y]) => new THREE.Vector2(r * 0.9, y)), 10);
  return template([
    [tp('box', 0, 0.05, 0, 0.9, 0.1, 0.9), '#9e4f36'],
    [tp('box', 0, 0.13, 0, 0.74, 0.08, 0.74), '#a85a3e'],
    [tp('box', 0, 0.2, 0, 0.6, 0.07, 0.6), '#b0623f'],
    [bell, '#b56a46'],
  ]);
});
/** Tiny corner stupa for temple terraces (~50 tris), unit height. */
const miniTpl = (white = false) => g('a3:mini' + white, () => template([
  [tp('box', 0, 0.12, 0, 0.6, 0.24, 0.6), white ? '#eee8dc' : '#a85a3e'],
  [tp('sph', 0, 0.36, 0, 0.5, 0.42, 0.5, 0, 0, 6), white ? '#f4efe4' : '#b26446'],
  [tp('cone', 0, 0.75, 0, 0.14, 0.5, 0.14, 0, 0, 4), white ? '#e0b445' : '#b8704c'],
]));
/** Small square brick shrine with a door, roof tiers and a pointed sikhara (~120 tris), unit height. */
const shrineTpl = () => g('a3:bshrine', () => {
  const sk = new THREE.LatheGeometry([[0.24, 0], [0.23, 0.12], [0.18, 0.24], [0.1, 0.34], [0.03, 0.42], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)), 4);
  sk.rotateY(Math.PI / 4); sk.translate(0, 0.56, 0);
  return template([
    [tp('box', 0, 0.2, 0, 0.62, 0.4, 0.62), '#a4553a'],
    [tp('box', 0, 0.14, 0.31, 0.16, 0.24, 0.02), '#3a2620'],
    [tp('box', 0, 0.14, -0.31, 0.16, 0.24, 0.02), '#3a2620'],
    [tp('box', 0, 0.43, 0, 0.66, 0.06, 0.66), '#8e4630'],
    [tp('box', 0, 0.5, 0, 0.5, 0.08, 0.5), '#ab5c3e'],
    [sk, '#b26446'],
  ]);
});
/** Toddy palm: tall bare trunk with a round crown of fan leaves; unit height. */
const toddyTpl = () => g('a3:toddy', () => template([
  [tp('cyl', 0, 0.4, 0, 0.035, 0.8, 0.035, 0, 0, 4), '#6e5a44'],
  [tp('sph', 0, 0.86, 0, 0.32, 0.24, 0.32, 0, 0, 6), '#3d6a32'],
  [tp('sph', 0.04, 0.93, 0.02, 0.2, 0.14, 0.2, 0, 0, 5), '#4f7c3a'],
]));
/** Broadleaf tamarind/acacia clump; unit height. */
const treeTpl = () => g('a3:btree', () => template([
  [tp('cyl', 0, 0.2, 0, 0.08, 0.4, 0.08, 0, 0, 4), '#5d4a36'],
  [tp('sph', 0, 0.55, 0, 0.75, 0.45, 0.7, 0, 0, 6), '#4d7a36'],
  [tp('sph', 0.2, 0.7, 0.1, 0.45, 0.32, 0.45, 0, 0, 6), '#5a8a3e'],
  [tp('sph', -0.18, 0.66, -0.12, 0.42, 0.3, 0.4, 0, 0, 6), '#456f30'],
]));

/** Shwesandaw: five square terraces (brick below, whitewashed above) with crenellations and steep central
 *  stairs on all four sides, crowned by octagonal plinths, a bell stupa and a gilded hti. */
function shwesandaw(p: THREE.Object3D, x: number, y: number, z: number, ry: number): number {
  const gr = grp(p, x, z, ry, y), T: [number, number, string][] = [[0.27, 0.05, '#a95b3c'], [0.222, 0.045, '#b0623f'], [0.176, 0.04, '#b86c45'], [0.134, 0.034, '#d6c8a6'], [0.098, 0.03, '#ddd2b4']];
  const mer: number[][] = [], merW: number[][] = [];
  let yy = 0;
  for (const [w, h, c] of T) {
    box(gr, c, 0, yy, 0, w, h, w);
    box(gr, shade(c, 0.78), 0, yy + h * 0.55, 0, w + 0.004, 0.004, w + 0.004);
    const n = Math.floor(w / 0.013), arr = c.startsWith('#d') ? merW : mer;
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n - 0.5) * w;
      if (Math.abs(u) < 0.022) continue;
      for (const s of [-1, 1]) { arr.push([u, yy + h, s * (w / 2 - 0.002), 0.006, 0.007, 0.004, 0]); arr.push([s * (w / 2 - 0.002), yy + h, u, 0.004, 0.007, 0.006, 0]); }
    }
    yy += h;
  }
  batch(gr, mer, '#9a5034');
  batch(gr, merW, '#cbbd99');
  // Stairs: one steep straight flight up the middle of each face, with brick side walls
  const N = 22, r0 = T[0][0] / 2 + 0.03, r1 = T[4][0] / 2, steps: number[][] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, ca = Math.sin(a), cz = Math.cos(a);
    for (let i = 0; i < N; i++) {
      const r = r0 + ((r1 - r0) * (i + 0.5)) / N;
      steps.push([ca * r, 0, cz * r, 0.026, (yy * (i + 1)) / N, (r0 - r1) / N + 0.0005, a]);
    }
    for (const o of [-1, 1]) {
      const ox = cz * o * 0.016, oz = -ca * o * 0.016;
      rod(gr, [ca * r0 + ox, 0.006, cz * r0 + oz], [ca * r1 + ox, yy + 0.006, cz * r1 + oz], 0.0035, '#a0573a', 4);
    }
  }
  batch(gr, steps, '#c27a52');
  // Octagonal plinths, bell and spire
  cyl(gr, '#d8ccac', 0, yy, 0, 0.044, 0.012, 8);
  cyl(gr, '#cfc2a0', 0, yy + 0.012, 0, 0.038, 0.01, 8);
  const st = plathe(gr, 'sws-bell', BELL.slice(4).map(([r, h]) => [r * 0.095, h * 0.12] as [number, number]), '#d9c99c', (_x, py) => (py > 0.092 ? '#c9a24a' : null), 0, yy + 0.022 - 0.0245, 0, 24);
  st.scale.y = 1.2;
  gild(lathe(gr, [[0, 0], [0.006, 0], [0.004, 0.02], [0.0015, 0.04], [0, 0.045]], '#d8a83a', 0, yy + 0.022 - 0.0245 + 0.12 * 1.2 * 0.98, 0, 8), '#d8a83a');
  return yy;
}

/** Ananda-style temple: white cruciform hall with tiered gabled porches, receding terraces with corner stupas,
 *  and a gilded curvilinear sikhara with hti. */
function ananda(p: THREE.Object3D, x: number, y: number, z: number, ry: number, minis: number[][]): void {
  const gr = grp(p, x, z, ry, y), W = '#f1ece0', GD = '#ebbd4c';
  const toW = (lx: number, ly: number, lz: number) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), y + ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  box(gr, '#cfc5b0', 0, 0, 0, 0.21, 0.01, 0.21);
  box(gr, W, 0, 0.01, 0, 0.15, 0.055, 0.15);
  box(gr, '#d9cfb8', 0, 0.06, 0, 0.156, 0.006, 0.156);
  for (let s = 0; s < 4; s++) {
    const sg = grp(gr, 0, 0, (s * Math.PI) / 2);
    box(sg, W, 0, 0.01, 0.095, 0.06, 0.042, 0.04);
    box(sg, '#3a2a22', 0, 0.012, 0.1152, 0.022, 0.026, 0.002);
    gable(sg, 0.044, 0.024, 0.066, W, 0, 0.052, 0.095, Math.PI / 2);
    gable(sg, 0.03, 0.022, 0.04, '#e9e2d2', 0, 0.064, 0.1, Math.PI / 2);
    gild(cone(sg, GD, 0, 0.084, 0.1, 0.003, 0.014, 5), GD);
  }
  let yy = 0.066;
  for (const [w, h] of [[0.13, 0.018], [0.108, 0.016], [0.088, 0.014]]) {
    box(gr, W, 0, yy, 0, w, h, w);
    box(gr, '#cdbf9e', 0, yy + h - 0.003, 0, w + 0.003, 0.003, w + 0.003);
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) minis.push([...toW(cx * (w / 2 - 0.006), yy + h, cz * (w / 2 - 0.006)), 0, 0.016, 1]);
    yy += h;
  }
  box(gr, W, 0, yy, 0, 0.066, 0.016, 0.066);
  yy += 0.016;
  const sk = gild(lathe(gr, [[0.048, 0], [0.047, 0.022], [0.043, 0.05], [0.036, 0.08], [0.026, 0.105], [0.016, 0.122], [0.01, 0.13], [0, 0.134]], GD, 0, yy, 0, 4), GD, false);
  sk.rotation.y = Math.PI / 4;
  gild(lathe(gr, [[0, 0], [0.007, 0], [0.007, 0.005], [0.004, 0.012], [0.003, 0.03], [0.001, 0.045], [0, 0.048]], '#e2b443', 0, yy + 0.128, 0, 8), '#e2b443');
}

/** Big brick temple (Dhammayangyi/Sulamani type): massive base, porches, terraces and a sikhara or bell top. */
function brickTemple(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, bell: boolean, minis: number[][]): void {
  const gr = grp(p, x, z, ry, y), C = '#a8573a';
  gr.scale.setScalar(s);
  box(gr, C, 0, 0, 0, 0.16, 0.07, 0.16);
  box(gr, '#8e4630', 0, 0.064, 0, 0.166, 0.006, 0.166);
  for (let k = 0; k < 4; k++) {
    const sg = grp(gr, 0, 0, (k * Math.PI) / 2);
    box(sg, '#a95a3c', 0, 0, 0.09, 0.05, 0.05, 0.03);
    box(sg, '#2e201a', 0, 0.002, 0.1052, 0.018, 0.028, 0.002);
    gable(sg, 0.036, 0.02, 0.05, '#9a4d34', 0, 0.05, 0.09, Math.PI / 2);
    for (const o of [-0.05, 0.05]) box(sg, '#2e201a', o, 0.026, 0.0805, 0.008, 0.016, 0.002);
  }
  let yy = 0.07;
  for (const [w, h] of [[0.13, 0.02], [0.1, 0.018], [0.074, 0.016]]) {
    box(gr, shade(C, 1 + yy * 0.6), 0, yy, 0, w, h, w);
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const lx = cx * (w / 2 - 0.005) * s, lz = cz * (w / 2 - 0.005) * s;
      minis.push([x + lx * Math.cos(ry) + lz * Math.sin(ry), y + (yy + h) * s, z - lx * Math.sin(ry) + lz * Math.cos(ry), ry, 0.014 * s, 0.95]);
    }
    yy += h;
  }
  if (bell) plathe(gr, 'bt-bell', BELL.map(([r, h]) => [r * 0.1, h * 0.14] as [number, number]), '#b36446', undefined, 0, yy, 0, 16);
  else {
    const sk = lathe(gr, [[0.04, 0], [0.039, 0.03], [0.034, 0.06], [0.025, 0.085], [0.014, 0.1], [0.006, 0.11], [0, 0.118]], '#b0613f', 0, yy, 0, 4);
    sk.rotation.y = Math.PI / 4;
    gild(cone(gr, '#d8a83a', 0, yy + 0.11, 0, 0.004, 0.025, 6), '#d8a83a');
  }
}

/** Hot-air balloon: striped teardrop envelope (cached per palette), wicker basket on four ropes. */
function balloon(p: THREE.Object3D, x: number, y: number, z: number, s: number, a: string, b: string, key: string): void {
  const prof: [number, number][] = [[0.05, 0], [0.09, 0.05], [0.17, 0.15], [0.22, 0.27], [0.23, 0.36], [0.2, 0.45], [0.13, 0.52], [0.05, 0.555], [0, 0.56]];
  const env = plathe(p, 'bal-' + key, prof, a, (px, py, pz) => {
    const k = Math.floor(((Math.atan2(pz, px) / (Math.PI * 2)) + 1) * 16) % 16;
    if (py < 0.09) return shade(a, 0.75);
    return k % 2 ? b : null;
  }, x, y, z, 16);
  env.scale.setScalar(s);
  const by = y - s * 0.12;
  box(p, '#6b4a2e', x, by, z, s * 0.07, s * 0.06, s * 0.07);
  for (const [ox, oz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rod(p, [x + ox * s * 0.03, by + s * 0.06, z + oz * s * 0.03], [x + ox * s * 0.045, y + s * 0.01, z + oz * s * 0.045], 0.0006, '#3a2c20', 3);
}

const bagan: Builder = (gp) => {
  const hB: HFn = (x, z) => 0.006 + (fbm(x * 5, 1, z * 5) - 0.5) * 0.012;
  const GY = (x: number, z: number) => 0.035 + hB(x, z);
  island(gp, 0.5, hB, '#86a04a', (x, _y, z) => {
    const u = x * 0.94 + z * 0.34, v = -x * 0.34 + z * 0.94;
    if (Math.abs(v - 0.16 - 0.04 * Math.sin(u * 6)) < 0.013 || Math.abs(u + 0.02 + 0.03 * Math.sin(v * 7)) < 0.011) return '#c8a36c';
    const h = hash3(Math.floor(u / 0.09), 5, Math.floor(v / 0.07));
    return h < 0.3 ? '#7f9a45' : h < 0.55 ? '#93a852' : h < 0.72 ? '#ad9c5c' : h < 0.86 ? '#6d8a3e' : '#bb965c';
  }, { rings: 20, segs: 72, side: strataSide(['#8a6a48', '#7a5a3c']) });
  const minis: number[][] = [], wminis: number[][] = [];
  // Landmark monuments
  const SWX = -0.13, SWZ = -0.12, ANX = 0.2, ANZ = 0.12;
  shwesandaw(gp, SWX, GY(SWX, SWZ) - 0.004, SWZ, 0.1);
  ananda(gp, ANX, GY(ANX, ANZ) - 0.004, ANZ, -0.35, wminis);
  const BIG: [number, number, number, number, boolean][] = [[0.22, -0.22, 1.0, 0.3, false], [-0.3, 0.17, 0.75, -0.2, true], [0.0, 0.3, 0.6, 0.15, false], [-0.33, -0.2, 0.55, 0.5, true]];
  for (const [x, z, s, ry, bell] of BIG) brickTemple(gp, x, GY(x, z) - 0.004, z, s, ry, bell, minis);
  // Brick enclosure walls (ruined in places) around the big monuments
  const walls: number[][] = [];
  const wallRing = (cx: number, cz: number, hw: number, ry: number, seed: number) => {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    for (let k = 0; k < 4; k++) for (let i = 0; i < 8; i++) {
      if (hash3(seed, k, i) < 0.25 || i === 3 || i === 4) continue;
      const u = -hw + (i + 0.5) * (hw / 4), lx = [u, hw, -u, -hw][k], lz = [hw, -u, -hw, u][k];
      const wx = cx + lx * cs + lz * sn, wz = cz - lx * sn + lz * cs;
      walls.push([wx, GY(wx, wz) - 0.004, wz, k % 2 ? 0.007 : hw / 4 + 0.002, 0.012 + hash3(seed, i, k) * 0.01, k % 2 ? hw / 4 + 0.002 : 0.007, ry]);
    }
  };
  wallRing(SWX, SWZ, 0.18, 0.1, 1); wallRing(ANX, ANZ, 0.13, -0.35, 2); wallRing(0.22, -0.22, 0.11, 0.3, 3);
  batch(gp, walls, '#a95e40');
  // Field of small stupas and shrines, then palms and trees, keeping clear of the big monuments
  const busy: [number, number, number][] = [[SWX, SWZ, 0.2], [ANX, ANZ, 0.15], ...BIG.map(([x, z, s]) => [x, z, 0.11 * s] as [number, number, number])];
  const free = (x: number, z: number, m: number) => Math.hypot(x, z) < 0.47 && busy.every(([bx, bz, r]) => Math.hypot(x - bx, z - bz) > r + m);
  const stupas: number[][] = [], shrines: number[][] = [], palms: number[][] = [], trees: number[][] = [];
  for (let i = 0; i < 400; i++) {
    const x = (hash3(i, 1, 4) - 0.5) * 0.96, z = (hash3(i, 2, 4) - 0.5) * 0.96, k = hash3(i, 3, 4);
    if (!free(x, z, 0.02)) continue;
    const y = GY(x, z) - 0.003, tint = 0.85 + hash3(i, 4, 4) * 0.3, r = hash3(i, 5, 4) * 6;
    if (k < 0.12 && stupas.length < 26) { stupas.push([x, y, z, r, 0.04 + hash3(i, 6, 4) * 0.035, tint]); busy.push([x, z, 0.025]); }
    else if (k < 0.2 && shrines.length < 16) { shrines.push([x, y, z, r, 0.04 + hash3(i, 6, 4) * 0.025, tint]); busy.push([x, z, 0.025]); }
    else if (k < 0.62 && palms.length < 90) palms.push([x, y, z, r, 0.06, 0.85 + hash3(i, 7, 4) * 0.3, 0.07 + hash3(i, 8, 4) * 0.04]);
    else if (trees.length < 46) trees.push([x, y, z, r, 0.035 + hash3(i, 9, 4) * 0.02, 0.85 + hash3(i, 7, 4) * 0.3]);
  }
  stamp(gp, stupaTpl(), stupas);
  stamp(gp, shrineTpl(), shrines);
  stamp(gp, miniTpl(), minis);
  stamp(gp, miniTpl(true), wminis);
  stamp(gp, toddyTpl(), palms);
  stamp(gp, treeTpl(), trees);
  // Hot-air balloons drifting over the plain
  balloon(gp, -0.32, 0.46, 0.08, 0.18, '#b5482e', '#d98c3e', 'a');
  balloon(gp, 0.33, 0.52, -0.08, 0.15, '#c9a23a', '#b43a2a', 'b');
  balloon(gp, 0.06, 0.6, -0.34, 0.13, '#8a3a2e', '#c4703c', 'c');
};

export const ASIA3: Record<string, Builder> = { goldentemple, watarun, burjalarab, terracotta, leshan, tigersnest, bagan };
