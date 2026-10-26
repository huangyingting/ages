import * as THREE from 'three';
import type { Builder, Paint, V3 } from '../prims.ts';
import { add, mat, g, sweep, rbox, box, cyl, lathe, hash3, vnoise } from '../prims.ts';
import { pblob } from '../animals.ts';
import { human } from '../human.ts';

// Travellers that move along routes on the globe: migrating animal groups and historic ships / caravans.
// No plinth — just the moving subject, front +z, ~1 unit long, base at y = 0 (the sea or land surface).

// ---- Fast colour math ----
const RGB = new Map<string, number[]>();
function rgb(h: string): number[] {
  let v = RGB.get(h);
  if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(h, v); }
  return v;
}
const c8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const hx = (r: number, gg: number, b: number) => '#' + ((1 << 24) | (c8(r) << 16) | (c8(gg) << 8) | c8(b)).toString(16).slice(1);
function mx(a: string, b: string, t: number): string {
  if (t <= 0) return a; if (t >= 1) return b;
  t = Math.round(t * 16) / 16;
  const A = rgb(a), B = rgb(b);
  return hx(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
const sh = (a: string, f: number) => { const A = rgb(a); f = Math.round(f * 32) / 32; return hx(A[0] * f, A[1] * f, A[2] * f); };
const VC = new Map<string, THREE.Color>();
const vc = (h: string) => { let c = VC.get(h); if (!c) { if (VC.size > 8000) VC.clear(); c = new THREE.Color(h); VC.set(h, c); } return c; };
const speck = (c: string, x: number, y: number, z: number, n: number) => (n ? sh(c, 1 + Math.round((vnoise(x * 34, y * 34, z * 34) - 0.5) * 8) / 4 * n * 1.1) : c);
const VCM = () => mat('#ffffff', { flat: false, vc: true });

// ---- Small sculpting helpers (adapted from animals.ts) ----
const ESEG = [[6, 4], [8, 6], [12, 8], [16, 11]];
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz), [a, b] = ESEG[r < 0.006 ? 0 : r < 0.02 ? 1 : r < 0.045 ? 2 : 3];
  return add(p, g('jr-esph' + a, () => new THREE.SphereGeometry(1, a, b)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
};
function bead(p: THREE.Object3D, x: number, y: number, z: number, r: number, c = '#111827'): void {
  ellip(p, c, x, y, z, r);
  ellip(p, '#f4f4f4', x + r * 0.3, y + r * 0.35, z + r * 0.62, r * 0.3);
}
function grp(p: THREE.Object3D, pos: V3, rot: V3 = [0, 0, 0], s = 1, order: THREE.EulerOrder = 'YXZ'): THREE.Group {
  const gg = new THREE.Group();
  gg.position.set(pos[0], pos[1], pos[2]);
  gg.rotation.set(rot[0], rot[1], rot[2], order);
  gg.scale.setScalar(s);
  p.add(gg);
  return gg;
}
function vpaint<T extends THREE.Mesh>(m: T, base: string, paint?: Paint): T {
  const geo = m.geometry;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const cols = new Float32Array(pos.count * 3), bc = vc(base);
  for (let i = 0; i < pos.count; i++) {
    const h = paint ? paint(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)) : null;
    const c = h ? vc(h) : bc;
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  m.material = VCM();
  return m;
}
function vblob(p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry: number, rz: number, paint?: Paint, rot: V3 = [0, 0, 0], seg = 16): THREE.Mesh {
  return vpaint(pblob(p, c, x, y, z, rx, ry, rz, undefined, rot, seg), c, paint);
}
/** Grid surface: rings along u∈[0,1], v∈[0,1) wrapping around, fan-capped ends; outward winding is auto-detected. */
function psurf(p: THREE.Object3D, nu: number, nv: number, f: (u: number, v: number) => V3, c: string, paint?: Paint,
  uvp?: (u: number, v: number, x: number, y: number, z: number) => string | null): THREE.Mesh {
  const pos: number[] = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j < nv; j++) pos.push(...f(i / nu, j / nv));
  const idx: number[] = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * nv + j, b = i * nv + ((j + 1) % nv), c2 = (i + 1) * nv + j, d = (i + 1) * nv + ((j + 1) % nv);
    idx.push(a, b, c2, b, d, c2);
  }
  for (const [ring, sgn] of [[0, -1], [nu, 1]] as const) {
    const ctr = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < nv; j++) { cx += pos[(ring * nv + j) * 3]; cy += pos[(ring * nv + j) * 3 + 1]; cz += pos[(ring * nv + j) * 3 + 2]; }
    pos.push(cx / nv, cy / nv, cz / nv);
    for (let j = 0; j < nv; j++) {
      const a = ring * nv + j, b = ring * nv + ((j + 1) % nv);
      if (sgn < 0) idx.push(ctr, b, a); else idx.push(ctr, a, b);
    }
  }
  const mi = Math.floor(nu / 2) * nv, P = (k: number) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const cen = new THREE.Vector3();
  for (let j = 0; j < nv; j++) cen.add(P(mi + j));
  cen.multiplyScalar(1 / nv);
  const A = P(mi), B = P(mi + 1), C = P(mi + nv);
  const n = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A));
  if (n.dot(A.clone().sub(cen)) < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = vpaint(add(p, geo, VCM(), 0, 0, 0, 1, 1, 1), c, paint);
  if (uvp) {
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i <= nu; i++) for (let j = 0; j < nv; j++) {
      const k = i * nv + j, h = uvp(i / nu, j / nv, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      if (h) { const cc = vc(h); col.setXYZ(k, cc.r, cc.g, cc.b); }
    }
  }
  return m;
}
interface SpSt { p: V3; w: number; h: number }
/** Body lofted along a spine with elliptical sections; `shape(u, a)` returns a radial multiplier. */
function spine(p: THREE.Object3D, st: SpSt[], c: string, paint?: Paint,
  o: { nu?: number; nv?: number; side?: V3; shape?: (u: number, a: number) => number; uvp?: (u: number, a: number, x: number, y: number, z: number) => string | null } = {}): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(st.map(s => new THREE.Vector3(...s.p)), false, 'centripetal');
  const nu = o.nu ?? (st.length - 1) * 6, nv = o.nv ?? 18;
  const side = new THREE.Vector3(...(o.side ?? [1, 0, 0]));
  const fr: { P: THREE.Vector3; S: THREE.Vector3; N: THREE.Vector3; w: number; h: number }[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, P = curve.getPoint(u), T = curve.getTangent(u);
    const N = new THREE.Vector3().crossVectors(T, side).normalize();
    const S = new THREE.Vector3().crossVectors(N, T).normalize();
    const f = u * (st.length - 1), k = Math.min(st.length - 2, Math.floor(f)), t = f - k, s = t * t * (3 - 2 * t);
    fr.push({ P, S, N, w: st[k].w + (st[k + 1].w - st[k].w) * s, h: st[k].h + (st[k + 1].h - st[k].h) * s });
  }
  return psurf(p, nu, nv, (u, v) => {
    const F = fr[Math.round(u * nu)], a = v * Math.PI * 2, m = o.shape ? o.shape(u, a) : 1;
    const ca = Math.cos(a) * F.w * m, sa = Math.sin(a) * F.h * m;
    return [F.P.x + F.S.x * ca + F.N.x * sa, F.P.y + F.S.y * ca + F.N.y * sa, F.P.z + F.S.z * ca + F.N.z * sa];
  }, c, paint, o.uvp ? (u, v, x, y, z) => o.uvp!(u, v * Math.PI * 2, x, y, z) : undefined);
}
/** Streamlined fin / fluke / flipper: span stations root→tip with leading & trailing edge points and thickness along `up`. */
const DROP = () => g('jr-drop', () => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(Math.max(1e-4, 0.5 * Math.sin(Math.PI * Math.pow(t, 0.62))), t)); }
  const lg = new THREE.LatheGeometry(pts, 7);
  lg.computeVertexNormals();
  return lg;
});
const _Y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
/** Teardrop from base a to pointed tip b (tufts, horns, claws, beards, feathers). */
function drop(p: THREE.Object3D, c: string, a: V3, b: V3, r: number, rz = r): THREE.Mesh {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length() || 1e-4;
  const m = add(p, DROP(), mat(c, { flat: false }), a[0], a[1], a[2], r * 2, len, rz * 2);
  m.quaternion.setFromUnitVectors(_Y, _d.normalize());
  return m;
}
/** Smooth tube through points with ball ends. */
function tube(p: THREE.Object3D, pts: V3[], r0: number, r1: number, c: string, radial = 7, paint?: Paint): THREE.Mesh {
  const m = sweep(p, pts.map((pt, i) => ({ p: pt, w: r0 + (r1 - r0) * (i / Math.max(1, pts.length - 1)) })), c, { radial, sub: 4, paint, flat: false });
  ellip(p, c, ...pts[0], r0 * 0.98);
  ellip(p, c, ...pts[pts.length - 1], r1 * 0.98);
  return m;
}
/** Straight cylinder between two points (masts, yards, oars, ropes). */
function rod(p: THREE.Object3D, a: V3, b: V3, r: number, c: string, seg = 6, r1 = r): THREE.Mesh {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length() || 1e-4;
  const m = add(p, g('jr-cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1)), mat(c, { flat: false }), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, r, len, r);
  if (r1 !== r) m.geometry = g(`jr-cone${seg}:${(r1 / r).toFixed(2)}`, () => new THREE.CylinderGeometry(r1 / r, 1, 1, seg, 1));
  m.quaternion.setFromUnitVectors(_Y, _d.normalize());
  return m;
}

/**
 * Triangle soup with explicit per-face colours and (optionally) smooth normals — sails, wings and flags that need
 * crisp painted panels on both faces (the baked material is single-sided).
 */
class Soup {
  pos: number[] = []; nor: number[] = []; col: number[] = [];
  tri(a: V3, b: V3, c: V3, colour: string, na?: V3, nb?: V3, nc?: V3): void {
    const C = vc(colour);
    let n0 = na, n1 = nb, n2 = nc;
    if (!n0 || !n1 || !n2) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
      n0 = n1 = n2 = [nx / l, ny / l, nz / l];
    }
    this.pos.push(...a, ...b, ...c);
    this.nor.push(...n0, ...n1!, ...n2!);
    for (let i = 0; i < 3; i++) this.col.push(C.r, C.g, C.b);
  }
  quad(a: V3, b: V3, c: V3, d: V3, colour: string): void { this.tri(a, b, c, colour); this.tri(a, c, d, colour); }
  /**
   * Two-sided grid sheet f(u,v) with smooth normals; front/back painters get the cell centre (u,v).
   * Each side is pushed out by t/2 along the surface normal.
   */
  sheet(nu: number, nv: number, f: (u: number, v: number) => V3, front: (u: number, v: number) => string, back: (u: number, v: number) => string = front, t = 0.004,
    us?: number[], vs?: number[], sides: 0 | 1 | -1 = 0): void {
    const U = us ?? Array.from({ length: nu + 1 }, (_, i) => i / nu), Vv = vs ?? Array.from({ length: nv + 1 }, (_, j) => j / nv);
    const P: V3[][] = U.map(u => Vv.map(v => f(u, v)));
    const N: V3[][] = U.map((_u, i) => Vv.map((_v, j) => {
      const a = P[Math.min(i + 1, U.length - 1)][j], b = P[Math.max(i - 1, 0)][j], c = P[i][Math.min(j + 1, Vv.length - 1)], d = P[i][Math.max(j - 1, 0)];
      const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
      const nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0], l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l] as V3;
    }));
    const off = (i: number, j: number, s: number): V3 => [P[i][j][0] + N[i][j][0] * s, P[i][j][1] + N[i][j][1] * s, P[i][j][2] + N[i][j][2] * s];
    const neg = (n: V3): V3 => [-n[0], -n[1], -n[2]];
    for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < Vv.length - 1; j++) {
      const uc = (U[i] + U[i + 1]) / 2, vcn = (Vv[j] + Vv[j + 1]) / 2, cf = front(uc, vcn), cb = back(uc, vcn), h = t / 2;
      if (sides >= 0) {
        this.tri(off(i, j, h), off(i + 1, j, h), off(i + 1, j + 1, h), cf, N[i][j], N[i + 1][j], N[i + 1][j + 1]);
        this.tri(off(i, j, h), off(i + 1, j + 1, h), off(i, j + 1, h), cf, N[i][j], N[i + 1][j + 1], N[i][j + 1]);
      }
      if (sides <= 0) {
        this.tri(off(i, j, -h), off(i + 1, j + 1, -h), off(i + 1, j, -h), cb, neg(N[i][j]), neg(N[i + 1][j + 1]), neg(N[i + 1][j]));
        this.tri(off(i, j, -h), off(i, j + 1, -h), off(i + 1, j + 1, -h), cb, neg(N[i][j]), neg(N[i][j + 1]), neg(N[i + 1][j + 1]));
      }
    }
  }
  mesh(p: THREE.Object3D): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return add(p, geo, VCM(), 0, 0, 0, 1, 1, 1);
  }
}

/** Wing (or sail) hinge: a 'flap' group that the globe & preview rock about its local z (forward) axis; left side mirrored. */

// ======================================================================================================
// Whales
// ======================================================================================================
/** Bushy V-shaped spout (white vapour puffs) above the blowholes. */
/** Flat foam patches where a body breaks the surface (y≈0) — not a base disc, just water churn. */

// ======================================================================================================
// Birds & butterflies
// ======================================================================================================
/** A flying bird ~0.4 long in local units: lofted body, flapping two-sided wings, fanned or forked tail. */
/** Monarch butterfly: orange wings with black veins, a black white-spotted border and black apex patch. */

// ======================================================================================================
// Hoofed herds & camels
// ======================================================================================================
interface QuadOpts {
  yw: number; yh: number; L: number; dep: number; wd: number; leg: number; phase: number; stride?: number;
  paint: Paint; legPaint?: Paint; c: string; hoof: string;
}
/** Torso + four striding legs; returns nothing — species functions add neck, head, tail and dressing. */
function quadBody(b: THREE.Object3D, o: QuadOpts): void {
  const { yw, yh, L, dep, wd } = o;
  const lr = (a: number, c: number, t: number) => a + (c - a) * t;
  spine(b, [
    { p: [0, yh - dep * 0.32, -L * 0.53], w: wd * 0.4, h: dep * 0.3 },
    { p: [0, yh - dep * 0.44, -L * 0.43], w: wd * 0.88, h: dep * 0.46 },
    { p: [0, lr(yh, yw, 0.3) - dep * 0.5, -L * 0.15], w: wd, h: dep * 0.5 },
    { p: [0, lr(yh, yw, 0.7) - dep * 0.5, L * 0.15], w: wd * 0.98, h: dep * 0.52 },
    { p: [0, yw - dep * 0.52, L * 0.38], w: wd * 0.86, h: dep * 0.5 },
    { p: [0, yw - dep * 0.6, L * 0.53], w: wd * 0.45, h: dep * 0.34 },
  ], o.c, o.paint, { nu: 18, nv: 12 });
  const st = o.stride ?? 0.07;
  for (const [front, z0] of [[true, L * 0.34], [false, -L * 0.36]] as const) for (const sx of [-1, 1]) {
    const ph = o.phase + (sx > 0 ? 0 : Math.PI) + (front ? Math.PI * 0.5 : 0);
    const sw = Math.sin(ph) * st, lift = Math.max(0, Math.cos(ph)) * 0.045, x = sx * wd * 0.55;
    const yb = (front ? yw : yh) - dep * 0.9, lg = o.leg;
    const pts: [V3, number, number][] = front ? [
      [[x, yb + dep * 0.35, z0], wd * 0.42, wd * 0.5], [[x * 1.02, yb - 0.02, z0 + 0.005 + sw * 0.15], lg * 1.5, lg * 1.8],
      [[x, yb * 0.42 + lift * 0.8, z0 + sw * 0.55 + lift * 0.3], lg, lg * 1.15], [[x, 0.05 + lift, z0 + sw - lift * 0.4], lg * 0.8, lg * 0.85], [[x, 0.012 + lift, z0 + sw + 0.005 - lift * 0.4], lg * 0.9, lg],
    ] : [
      [[x, yb + dep * 0.4, z0 + 0.02], wd * 0.5, wd * 0.62], [[x * 1.04, yb - 0.01, z0 + 0.04 + sw * 0.2], lg * 1.9, lg * 2.4],
      [[x, yb * 0.5 + lift * 0.5, z0 - 0.04 + sw * 0.5], lg * 0.95, lg * 1.3], [[x, 0.05 + lift, z0 - 0.01 + sw], lg * 0.8, lg * 0.85], [[x, 0.012 + lift, z0 + sw + 0.005], lg * 0.9, lg],
    ];
    sweep(b, pts.map(([p, w, h]) => ({ p, w, h })), o.c, { radial: 8, sub: 3, paint: o.legPaint ?? o.paint, up: [0, 0, 1], flat: false });
    const ft = pts[4][0];
    ellip(b, o.hoof, ft[0], ft[1], ft[2] + 0.004, lg * 1.05, lg * 0.9, lg * 1.25);
  }
}

/** Blue wildebeest: humped shoulders, sloping back, dark brindled neck bands, black beard & mane, cow-like hooked horns. */
/** Plains zebra: crisp black stripes (vertical body, diagonal rump, horizontal legs), upright mane. */
/** Barren-ground caribou: chocolate coat, creamy neck & mane, white rump, big C-shaped antlers with a brow shovel. */
/** Bactrian camel: long legs, two shaggy humps, shaggy neck beard, long curved neck and droopy lips. */
function camel(p: THREE.Object3D, at: V3, yaw: number, s: number, phase: number, load: boolean, blanket: string): THREE.Group {
  const b = grp(p, at, [0, yaw, 0], s);
  const c = '#a77a4c', sg = '#7a5534';
  const paint: Paint = (x, y, z, _nx, ny) => speck(ny < -0.5 ? mx(c, '#c49a6a', 0.4) : c, x, y, z, 0.07);
  quadBody(b, { yw: 0.66, yh: 0.62, L: 0.52, dep: 0.25, wd: 0.11, leg: 0.02, phase, paint, c, hoof: '#5e4630', stride: 0.06,
    legPaint: (x, y, z) => speck(y > 0.5 ? sg : c, x, y, z, 0.06) });
  // Two tall, well-separated Bactrian humps with dark shaggy caps (the riders/loads sit in the saddle between them)
  for (const z of [0.15, -0.13]) {
    vblob(b, c, 0, 0.67, z, 0.068, 0.135, 0.07, (x, y, zz) => (y > 0.74 ? speck(sg, x, y, zz, 0.15) : speck(c, x, y, zz, 0.07)), [0, 0, 0], 11);
    // Shaggy winter tuft flopping over the top of each hump
    for (let i = 0; i < 3; i++) { const sx = i - 1; drop(b, sg, [sx * 0.025, 0.79, z + 0.01], [sx * 0.05, 0.76, z - 0.04], 0.03, 0.014); }
  }
  // Neck dips forward and down from the shoulder, then swings up in a U to carry the head level
  spine(b, [{ p: [0, 0.56, 0.2], w: 0.065, h: 0.09 }, { p: [0, 0.5, 0.32], w: 0.05, h: 0.068 }, { p: [0, 0.51, 0.42], w: 0.042, h: 0.054 }, { p: [0, 0.6, 0.49], w: 0.037, h: 0.044 }, { p: [0, 0.7, 0.51], w: 0.036, h: 0.04 }],
    c, paint, { nu: 12, nv: 10 });
  for (let i = 0; i < 6; i++) { const t = i / 5; drop(b, sg, [0, 0.47 - t * 0.01, 0.28 + t * 0.12], [0, 0.4 - t * 0.0, 0.29 + t * 0.12], 0.026, 0.016); }
  const H = grp(b, [0, 0.72, 0.52], [0.25, 0, 0]);
  spine(H, [{ p: [0, 0, -0.03], w: 0.045, h: 0.05 }, { p: [0, 0, 0.05], w: 0.04, h: 0.046 }, { p: [0, -0.01, 0.11], w: 0.034, h: 0.038 }, { p: [0, -0.02, 0.15], w: 0.03, h: 0.032 }],
    c, paint, { nu: 9, nv: 10 });
  vblob(H, sh(c, 0.85), 0, -0.04, 0.14, 0.024, 0.016, 0.02, undefined, [0, 0, 0], 10);
  for (const sx of [-1, 1]) {
    drop(H, c, [sx * 0.03, 0.03, -0.02], [sx * 0.045, 0.06, -0.04], 0.01, 0.006);
    bead(H, sx * 0.038, 0.02, 0.04, 0.007, '#0a0806');
  }
  for (let i = 0; i < 4; i++) drop(H, sg, [0, 0.045, -0.02 + i * 0.015], [0, 0.07, -0.03 + i * 0.012], 0.014, 0.01);
  tube(b, [[0, 0.56, -0.28], [0, 0.46, -0.31], [0, 0.36, -0.3]], 0.01, 0.006, c, 5);
  drop(b, sg, [0, 0.38, -0.3], [0, 0.3, -0.3], 0.012, 0.008);
  if (load) {
    // Saddle blanket in the dip between the humps; bales slung low on the flanks so both humps stay visible
    vblob(b, blanket, 0, 0.6, 0.01, 0.13, 0.055, 0.075, (x, y, z) => (Math.sin(z * 120) > 0.5 ? '#a08a5c' : Math.abs(x) > 0.11 ? sh(blanket, 0.7) : blanket), [0, 0, 0], 11);
    for (const sx of [-1, 1]) {
      rbox(b, sx > 0 ? '#c9b18a' : '#8f6a45', sx * 0.15, 0.47, 0.01, 0.07, 0.11, 0.12, 0.025);
      for (const dz of [-0.035, 0.045]) box(b, '#5b4330', sx * 0.15, 0.47, 0.01 + dz, 0.074, 0.114, 0.008);
      rod(b, [sx * 0.05, 0.66, 0.01], [sx * 0.15, 0.53, 0.01], 0.006, '#5b4330', 4);
    }
    rbox(b, '#7a6a52', 0, 0.665, 0.01, 0.12, 0.035, 0.05, 0.015);
  }
  return b;
}

// ======================================================================================================
// Ships: lofted hulls, decks, bulwarks and two-sided painted sails
// ======================================================================================================
interface HullOpts {
  L: number; B: number; sheer: (u: number) => number; half: (u: number) => number; keel: (u: number) => number; full: number;
  /** d: 0 at the gunwale → 1 at the keel (bands follow the sheer); y: height. */
  paint: (u: number, d: number, y: number) => string; deck: string | ((u: number, w: number) => string); tumble?: number; nu?: number; nv?: number; bands?: number[];
  bulwark?: number; bulC?: string; z0?: number;
}
interface Hull { gun: (u: number, side: number) => V3; z: (u: number) => number; top: (u: number) => number; hb: (u: number) => number }
/** Hull loft (u stern→bow, v starboard gunwale→keel→port gunwale) with transom fans, flush planked deck and bulwarks. */
function hull(p: THREE.Object3D, o: HullOpts): Hull {
  const z = (u: number) => (o.z0 ?? 0) - o.L / 2 + o.L * u, hb = (u: number) => o.B * o.half(u), tm = o.tumble ?? 0;
  const sec = (u: number, v: number): V3 => {
    const ph = Math.PI * v, s = Math.sin(ph), c = Math.cos(ph), top = o.sheer(u), k = o.keel(u);
    const y = top - (top - k) * Math.pow(s, o.full);
    return [Math.sign(c) * Math.pow(Math.abs(c), 0.8) * hb(u) * (1 - tm * Math.pow(1 - s, 2)), y, z(u)];
  };
  const sp = new Soup(), nu = o.nu ?? 24, nv = o.nv ?? 12;
  const dset = new Set<number>(Array.from({ length: nv + 1 }, (_, j) => j / nv));
  for (const d of o.bands ?? []) { dset.add(d / 2); dset.add(1 - d / 2); }
  const vs = [...dset].sort((a, b) => a - b);
  sp.sheet(nu, vs.length - 1, sec, (u, v) => o.paint(u, 1 - Math.abs(1 - 2 * v), sec(u, v)[1]), undefined, 0, undefined, vs, 1);
  // Transom / bow fans where the hull still has width
  for (const [u, sgn] of [[0, 1], [1, -1]] as const) {
    if (hb(u) < 0.004) continue;
    const ring = Array.from({ length: nv + 1 }, (_, j) => sec(u, j / nv)), cy = ring.reduce((a, q) => a + q[1], 0) / ring.length;
    const C: V3 = [0, cy, z(u)];
    for (let j = 0; j < nv; j++) {
      const col = o.paint(u, 1 - Math.abs(1 - 2 * (j + 0.5) / nv), (ring[j][1] + ring[j + 1][1] + cy) / 3);
      if (sgn > 0) sp.tri(C, ring[j], ring[j + 1], col); else sp.tri(C, ring[j + 1], ring[j], col);
    }
  }
  // Deck planking
  const dk = o.deck;
  sp.sheet(nu, 6, (u, w) => { const g0 = sec(u, 0)[0]; return [(w * 2 - 1) * g0, o.sheer(u) - 0.003, z(u)]; },
    typeof dk === 'string' ? (u, w) => (Math.floor(w * 6) % 2 ? dk : sh(dk, 0.9 + hash3(Math.floor(u * 9), Math.floor(w * 6), 1) * 0.1)) : dk, undefined, 0, undefined, undefined, 1);
  // Bulwarks: a thin two-sided strip standing on the gunwale
  if (o.bulwark) for (const sd of [-1, 1]) {
    sp.sheet(nu, 1, (u, v) => { const q = sec(u, sd > 0 ? 0 : 1); return [q[0], q[1] + v * o.bulwark!, q[2]]; }, () => o.bulC ?? '#5a3b22', () => sh(o.bulC ?? '#5a3b22', 0.8), 0.006);
  }
  sp.mesh(p);
  return { gun: (u, side) => { const q = sec(u, side > 0 ? 0 : 1); return [q[0], q[1], q[2]]; }, z, top: o.sheer, hb };
}
/** Square sail hanging from a yard: u across (port→starboard), v down; bellies forward (+z) and gets a yard spar. */
/** Triangular (lateen / crab-claw) sheet A-B-C with a belly along `bv`. */
/** Small waving flag / pennant from a staff top. */
function flag(p: THREE.Object3D, at: V3, w: number, h: number, paint: (u: number, v: number) => string, dir = -1, taper = 0): void {
  const sp = new Soup();
  sp.sheet(5, 3, (u, v) => [at[0] + Math.sin(u * 5) * 0.012 * u, at[1] - v * h * (1 - taper * u) - (taper * u * h) / 2 * 0, at[2] + dir * u * w], paint, paint, 0.003);
  sp.mesh(p);
}
/** Shroud fan: lines from a masthead down to the gunwale on both sides. */
/** Foam at the bow wave and wake (flat churn at y≈0, not a base). */

/** Carrack / nao (Victoria, Santa María) or caravel: black or brown round hull, castles, square courses with crosses. */
/** Battened junk lug sail: a fan of horizontal battens, top yard rising aft, mast a third back from the luff. */
function lugSail(p: THREE.Object3D, mast: V3, w: number, h: number, yaw: number, c: string): void {
  const gs = grp(p, mast, [0, yaw, 0]);
  const nb = 6, sp = new Soup();
  const pt = (u: number, v: number): V3 => {
    const x = (u - 0.32) * w * (1 + 0.12 * v), y = -h + v * h + (u - 0.32) * 0.18 * h * v;
    return [x, y, 0.035 * Math.sin(Math.PI * u) * (0.4 + 0.6 * Math.abs(Math.sin(v * nb * Math.PI)))];
  };
  sp.sheet(6, nb * 2, pt, (u, v) => sh(c, 0.85 + 0.15 * ((Math.floor(v * nb) + Math.floor(u * 3)) % 2)), (_u, v) => sh(c, Math.floor(v * nb) % 2 ? 0.92 : 0.84), 0.005);
  sp.mesh(gs);
  for (let k = 0; k <= nb; k++) { const v = k / nb; rod(gs, pt(-0.04, v), pt(1.04, v), 0.0035, '#3a2618', 4); }
  // Sheet lines fanning from the batten ends
  for (let k = 2; k <= nb; k += 2) rod(gs, pt(1.04, k / nb), [w * 0.72, -h - 0.04, -0.12], 0.0012, '#2a1d14', 3);
}

// ======================================================================================================
// Migrations
// ======================================================================================================
export const H_JOURNEYS: Record<string, Builder> = {
  vy_zhenghe: gp => {
    // Ming treasure ship (baochuan): huge broad flat-bottomed hull with a blunt transom bow and painted oculi,
    // towering multi-storey stern castle with tiled roofs, nine masts carrying battened lug sails
    // Ref: Ming baochuan (Longjiang yard rudder post; Nanjing Treasure Boat Park replica; Wubei zhi junks): tung-oiled hull,
    // red-ochre upper works, bamboo-matting/hemp sails in natural tan, painted tiger-head bow board and oculi.
    const red = '#7a3326', gold = '#a88a4a';
    const sheer = (u: number) => 0.13 + 0.1 * Math.pow(1 - u, 3) + 0.05 * Math.pow(u, 3);
    const H = hull(gp, {
      L: 0.86, B: 0.17, full: 0.3, bulwark: 0.022, bulC: red, nu: 28,
      sheer, half: u => (0.74 + 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.08))) * (u > 0.82 ? 1 - (u - 0.82) * 2 : 1),
      keel: u => 0.035 * Math.pow(1 - u, 2) + 0.05 * Math.pow(u, 2),
      bands: [0.16, 0.19, 0.3, 0.32, 0.42, 0.54, 0.66, 0.85],
      paint: (_u, d) => (d > 0.85 ? '#2b231d' : d < 0.16 ? red : d < 0.19 ? gold : d > 0.3 && d < 0.32 ? '#c2b494' : [0.42, 0.54, 0.66, 2].findIndex(b => d < b) % 2 ? '#4e3622' : '#5a3f28'),
      deck: '#8a6c48',
    });
    // Oculi on the bow, anchors, big rudder
    for (const sd of [-1, 1]) {
      const q = H.gun(0.93, sd), o: V3 = [q[0] + sd * 0.006, q[1] - 0.045, q[2]];
      ellip(gp, '#d8d0bc', o[0], o[1], o[2], 0.008, 0.022, 0.03);
      ellip(gp, '#151210', o[0] + sd * 0.006, o[1], o[2] + 0.006, 0.006, 0.013, 0.013);
      tube(gp, [[sd * 0.09, H.top(0.95), H.z(0.95)], [sd * 0.12, H.top(0.95) - 0.06, H.z(1) + 0.01], [sd * 0.12, 0.03, H.z(1) + 0.005]], 0.004, 0.004, '#2a2622', 5);
    }
    box(gp, '#3a2a1c', 0, 0.09, H.z(0) - 0.02, 0.016, 0.16, 0.06);
    // Bow transom board painted with a tiger head (虎头): ochre face, dark brow stripes and eyes, bared white teeth
    const bz = H.z(1) + 0.003, ty = H.top(1) - 0.04;
    cyl(gp, '#a07a3e', 0, ty, bz, 0.03, 0.006, 14).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {
      ellip(gp, '#2a2018', sx * 0.011, ty + 0.006, bz + 0.006, 0.0065, 0.0022, 0.002, 0, 0, -sx * 0.35);
      for (let k = 0; k < 3; k++) box(gp, '#3a2a1e', sx * (0.006 + k * 0.007), ty + 0.015 + k * 0.003, bz + 0.0065, 0.005, 0.0016, 0.001, 0, 0, sx * 0.5);
      for (let k = 0; k < 2; k++) box(gp, '#3a2a1e', sx * 0.024, ty - 0.004 - k * 0.006, bz + 0.0065, 0.008, 0.0016, 0.001, 0, 0, -sx * 0.25);
    }
    box(gp, '#3a2a1e', 0, ty - 0.012, bz + 0.0065, 0.022, 0.006, 0.001);
    for (const sx of [-1, 1]) box(gp, '#c8c0aa', sx * 0.007, ty - 0.012, bz + 0.0075, 0.003, 0.007, 0.001);
    // Stern castle: three stepped red storeys with white window bands, tiled roofs with upturned eaves
    const st = H.top(0.08);
    const storey = (y: number, w: number, d: number, h: number, z: number) => {
      rbox(gp, red, 0, y + h / 2, z, w, h, d, 0.006);
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) box(gp, '#a89878', sd * (w / 2 + 0.001), y + h * 0.55, z - d * 0.35 + i * d * 0.233, 0.004, h * 0.42, d * 0.15);
      box(gp, gold, 0, y + h, z, w + 0.012, 0.007, d + 0.012);
    };
    storey(st - 0.01, 0.3, 0.2, 0.07, H.z(0.12));
    storey(st + 0.065, 0.25, 0.14, 0.055, H.z(0.08));
    storey(st + 0.125, 0.18, 0.09, 0.045, H.z(0.06));
    const roof = (y: number, w: number, d: number, z: number) => {
      for (const sd of [-1, 1]) { const m = box(gp, '#4e5250', sd * w * 0.25, y + 0.012, z, w * 0.56, 0.008, d); m.rotation.z = -sd * 0.38; }
      box(gp, '#3a3e3c', 0, y + 0.026, z, 0.012, 0.012, d + 0.01);
      for (const sd of [-1, 1]) for (const e of [-1, 1]) drop(gp, gold, [sd * w * 0.5, y + 0.0, z + e * d * 0.5], [sd * w * 0.58, y + 0.03, z + e * d * 0.56], 0.006, 0.004);
    };
    roof(st + 0.17, 0.2, 0.11, H.z(0.06));
    // Red lanterns hanging from the stern gallery
    for (const sd of [-1, 1]) ellip(gp, '#8e3a2a', sd * 0.1, st + 0.04, H.z(0.0) - 0.02, 0.011, 0.015, 0.011);
    // Forecastle rail
    for (const sd of [-1, 1]) rod(gp, [sd * 0.1, H.top(0.86) + 0.035, H.z(0.84)], [sd * 0.1, H.top(0.97) + 0.035, H.z(0.97)], 0.004, gold, 5);
    // Nine masts with battened sails (heights stepped like the paintings: tallest amidships)
    const M: [number, number, number, number, number][] = [
      [0.97, 0, 0.34, 0.2, 0.22], [0.82, 0, 0.5, 0.27, 0.3], [0.68, 0, 0.66, 0.33, 0.42], [0.53, 0, 0.74, 0.37, 0.5],
      [0.39, 0, 0.64, 0.33, 0.42], [0.26, 0, 0.5, 0.27, 0.32], [0.6, 0.13, 0.4, 0.18, 0.22], [0.6, -0.13, 0.4, 0.18, 0.22], [0.04, 0, 0.42, 0.2, 0.22],
    ];
    M.forEach(([u, x, h, w, sh0], i) => {
      const zz = H.z(u), y0 = u < 0.1 ? st + 0.16 : H.top(u), rake = u > 0.9 ? 0.25 : 0;
      const top: V3 = [x, y0 + h, zz + rake * h];
      rod(gp, [x, y0 - 0.02, zz], top, 0.004 + h * 0.006, '#4a3020', 6, 0.6 * (0.004 + h * 0.006));
      lugSail(gp, [x, top[1] - 0.03, top[2] - 0.01 - rake * 0.03], w * 1.1, sh0, 0.95 + (i % 2 ? 0.12 : -0.08) + x * 2, i % 2 ? '#a08560' : '#988058');
      flag(gp, [x, top[1] + 0.005, top[2]], 0.05 + h * 0.06, 0.012, (uu) => (uu < 0.5 ? '#b0904a' : '#8a3226'));
    });
    // Stern banner
    rod(gp, [0, st + 0.17, H.z(0.0)], [0, st + 0.3, H.z(0.0) - 0.01], 0.004, '#3a2a1a', 5);
    flag(gp, [0, st + 0.3, H.z(0.0) - 0.01], 0.09, 0.07, (u, v) => (u < 0.12 || v < 0.15 || v > 0.85 ? '#8a3226' : '#b8964c'));
  },
  vy_silkroad: gp => {
    // Silk Road caravan: three laden Bactrian camels roped nose-to-tail, led on foot by a Sogdian merchant
    // Ref: Tang sancai camel-and-Sogdian tomb figures and Sogdian merchant murals (Afrasiab; Anjia tomb, Xi'an): pointed felt cap,
    // belted knee-length kaftan with lapels, tall boots, full beard; felt saddle cloths and silk bales in undyed / madder / indigo wool tones.
    const s = 0.44, line: [number, number, number, string, number][] = [[0.02, 0.24, 0, '#7e3a2c', 0.12], [-0.07, -0.08, 1.4, '#4a5668', 0.32], [-0.2, -0.38, 2.7, '#6a5e44', 0.45]];
    line.forEach(([x, z, ph, bl, yaw]) => camel(gp, [x, 0, z], yaw, s, ph, true, bl));
    const at = (i: number, lx: number, ly: number, lz: number): V3 => {
      const [x, z, , , yaw] = line[i], c = Math.cos(yaw), sn = Math.sin(yaw);
      return [x + s * (lx * c + lz * sn), ly * s, z + s * (-lx * sn + lz * c)];
    };
    // Halters: each camel's nose rope runs to the pack saddle of the one in front; the leader's to the merchant's hand
    const nose = (i: number) => at(i, 0, 0.69, 0.66), tail = (i: number) => at(i, 0, 0.52, -0.26);
    const sag = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.04, (a[2] + b[2]) / 2];
    for (let i = 1; i < line.length; i++) { const a = nose(i), b = tail(i - 1); tube(gp, [a, sag(a, b), b], 0.0025, 0.0025, '#3a2a1a', 4); }
    // Merchant (~1.7 m against 2 m camels): kaftan belted at the waist, boots, beard, pointed felt cap, staff in the right hand
    const mx0 = 0.16, mz = 0.48, MH = 0.27;
    const R = human(gp, mx0, 0, mz, { h: MH, ry: -0.35, pose: 'walk', phase: 0.2, top: '#8a6a48', bottom: '#5a4a38', dress: 'ankle', shoes: '#2e241c', skin: '#c48e64', hair: '#2a1e16', build: 1.05,
      hands: [[-0.16, 0.5, 0.12], [0.15, 0.62, 0.1]], detail: 'hi' });
    const hd = R.head;
    lathe(gp, [[0.0001, 0], [0.023, 0], [0.024, 0.006], [0.02, 0.008], [0.015, 0.024], [0.008, 0.042], [0.0001, 0.054]], '#b8a888', hd[0], hd[1] + 0.006, hd[2] - 0.003, 9);
    drop(gp, '#2a1e16', [hd[0] + 0.004, hd[1] - 0.006, hd[2] + 0.012], [hd[0] + 0.006, hd[1] - 0.03, hd[2] + 0.02], 0.011, 0.008);
    rod(gp, [R.handR[0], 0, R.handR[2] + 0.01], [R.handR[0], 0.3, R.handR[2] - 0.01], 0.0032, '#6b4a2c', 5);
    const hand = R.handL, a = nose(0);
    tube(gp, [hand, sag(hand, a), a], 0.0025, 0.0025, '#3a2a1a', 4);
  },
};

