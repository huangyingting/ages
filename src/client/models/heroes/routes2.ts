import { human, type HumanPose } from '../human.ts';
import * as THREE from 'three';
import type { Builder, V3 } from '../prims.ts';
import { add, mat, g, rbox, box, cyl, hash3 } from '../prims.ts';

// Routes pack 2: historic voyages, animal migrations and iconic vehicles that travel along routes on the globe.
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
const sh = (a: string, f: number) => { const A = rgb(a); f = Math.round(f * 32) / 32; return hx(A[0] * f, A[1] * f, A[2] * f); };
const VC = new Map<string, THREE.Color>();
const vc = (h: string) => { let c = VC.get(h); if (!c) { if (VC.size > 8000) VC.clear(); c = new THREE.Color(h); VC.set(h, c); } return c; };
const VCM = () => mat('#ffffff', { flat: false, vc: true });

// ---- Small sculpting helpers (adapted from animals.ts) ----
const ESEG = [[10, 8], [14, 10], [18, 13], [22, 16]];
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz), [a, b] = ESEG[r < 0.006 ? 0 : r < 0.02 ? 1 : r < 0.045 ? 2 : 3];
  return add(p, g('r2-esph' + a, () => new THREE.SphereGeometry(1, a, b)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
};
function grp(p: THREE.Object3D, pos: V3, rot: V3 = [0, 0, 0], s = 1, order: THREE.EulerOrder = 'YXZ'): THREE.Group {
  const gg = new THREE.Group();
  gg.position.set(pos[0], pos[1], pos[2]);
  gg.rotation.set(rot[0], rot[1], rot[2], order);
  gg.scale.setScalar(s);
  p.add(gg);
  return gg;
}
/** Grid surface: rings along u∈[0,1], v∈[0,1) wrapping around, fan-capped ends; outward winding is auto-detected. */
/** Body lofted along a spine with elliptical sections; `shape(u, a)` returns a radial multiplier. */
/** Streamlined fin / fluke / flipper: span stations root→tip with leading & trailing edge points and thickness along `up`. */
const DROP = () => g('r2-drop', () => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(1e-4, 0.5 * Math.sin(Math.PI * Math.pow(t, 0.62))), t)); }
  const lg = new THREE.LatheGeometry(pts, 12);
  lg.computeVertexNormals();
  return lg;
});
const _Y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
/** Teardrop from base a to pointed tip b (tufts, horns, claws, beards, feathers). */
const _m4 = new THREE.Matrix4(), _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3();
/** Flattened teardrop a→b whose flat face looks along `up` (feathers, manes, claws). */
function blade(p: THREE.Object3D, c: string, a: V3, b: V3, w: number, t: number, up: V3): THREE.Mesh {
  _by.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _by.length() || 1e-4;
  _by.multiplyScalar(1 / len);
  _bz.set(up[0], up[1], up[2]).addScaledVector(_by, -(up[0] * _by.x + up[1] * _by.y + up[2] * _by.z));
  if (_bz.lengthSq() < 1e-8) _bz.set(_by.y, _by.z, _by.x);
  _bz.normalize();
  _bx.crossVectors(_by, _bz);
  const m = add(p, DROP(), mat(c, { flat: false }), a[0], a[1], a[2], w * 2, len, t * 2);
  m.quaternion.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz));
  return m;
}
/** Smooth tube through points with ball ends. */
/** Straight cylinder between two points (masts, yards, oars, ropes). */
function rod(p: THREE.Object3D, a: V3, b: V3, r: number, c: string, seg = 6, r1 = r): THREE.Mesh {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length() || 1e-4;
  const m = add(p, g('r2-cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1)), mat(c, { flat: false }), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, r, len, r);
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


/** Flat foam patches where a body breaks the surface (y≈0) — not a base disc, just water churn. */

// ======================================================================================================
// Ships: lofted hulls, decks, bulwarks and two-sided painted sails
// ======================================================================================================
interface HullOpts {
  L: number; B: number; sheer: (u: number) => number; half: (u: number) => number; keel: (u: number) => number; full: number;
  /** d: 0 at the gunwale → 1 at the keel (bands follow the sheer); y: height. */
  paint: (u: number, d: number, y: number) => string; deck: string | ((u: number, w: number) => string); tumble?: number; nu?: number; nv?: number; bands?: number[];
  bulwark?: number; bulC?: string; z0?: number;
}
interface Hull { gun: (u: number, side: number) => V3; z: (u: number) => number; top: (u: number) => number; hb: (u: number) => number; pt: (u: number, v: number) => V3 }
/** Hull loft (u stern→bow, v starboard gunwale→keel→port gunwale) with transom fans, flush planked deck and bulwarks. */
function hull(p: THREE.Object3D, o: HullOpts): Hull {
  const z = (u: number) => (o.z0 ?? 0) - o.L / 2 + o.L * u, hb = (u: number) => o.B * o.half(u), tm = o.tumble ?? 0;
  const sec = (u: number, v: number): V3 => {
    const ph = Math.PI * v, s = Math.sin(ph), c = Math.cos(ph), top = o.sheer(u), k = o.keel(u);
    const y = top - (top - k) * Math.pow(s, o.full);
    return [Math.sign(c) * Math.pow(Math.abs(c), 0.8) * hb(u) * (1 - tm * Math.pow(1 - s, 2)), y, z(u)];
  };
  const sp = new Soup(), nu = o.nu ?? 36, nv = o.nv ?? 18;
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
  sp.sheet(nu, 8, (u, w) => { const g0 = sec(u, 0)[0]; return [(w * 2 - 1) * g0, o.sheer(u) - 0.003, z(u)]; },
    typeof dk === 'string' ? (u, w) => (Math.floor(w * 6) % 2 ? dk : sh(dk, 0.9 + hash3(Math.floor(u * 9), Math.floor(w * 6), 1) * 0.1)) : dk, undefined, 0, undefined, undefined, 1);
  // Bulwarks: a thin two-sided strip standing on the gunwale
  if (o.bulwark) for (const sd of [-1, 1]) {
    sp.sheet(nu, 1, (u, v) => { const q = sec(u, sd > 0 ? 0 : 1); return [q[0], q[1] + v * o.bulwark!, q[2]]; }, () => o.bulC ?? '#5a3b22', () => sh(o.bulC ?? '#5a3b22', 0.8), 0.006);
  }
  sp.mesh(p);
  return { gun: (u, side) => { const q = sec(u, side > 0 ? 0 : 1); return [q[0], q[1], q[2]]; }, z, top: o.sheer, hb, pt: sec };
}
/** Square sail hanging from a yard: u across (port→starboard), v down; bellies forward (+z) and gets a yard spar. */
/** Triangular (lateen / crab-claw) sheet A-B-C with a belly along `bv`. */
/** Small waving flag / pennant from a staff top. */
function flag(p: THREE.Object3D, at: V3, w: number, h: number, paint: (u: number, v: number) => string, dir = -1, taper = 0, nu = 5, nv = 3): void {
  const sp = new Soup();
  sp.sheet(nu, nv, (u, v) => [at[0] + Math.sin(u * 5) * 0.012 * u, at[1] - v * h * (1 - taper * u) - (taper * u * h) / 2 * 0, at[2] + dir * u * w], paint, paint, 0.003);
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
// Birds
// ======================================================================================================
/** A flying bird ~0.4 long in local units: lofted body, flapping two-sided wings, fanned or forked tail. */

// ======================================================================================================
// Extra helpers: four-cornered sails, square-rigged masts, stroke lettering, figures, dogs, ice
// ======================================================================================================
/** Four-cornered fore-and-aft sail (gaff / spanker): tack A, throat B (both on the mast), peak C, clew D. */
/** A mast stepped at hull station u carrying a stack of square sails [yard height above deck, width, drop]. */

/** Little standing figure (~0.14 tall at s = 1) with coat, head, optional hat and arms (reach: arm angle forward). */
function person(p: THREE.Object3D, at: V3, yaw: number, s: number, coat: string, o: { hat?: string; skin?: string; legs?: string; reach?: number; hair?: string; robe?: boolean; pose?: HumanPose } = {}): THREE.Group {
  const b = grp(p, at, [0, yaw, 0], s);
  const rc = o.reach ?? 0.3;
  human(b, 0, 0, 0, {
    h: 0.14, top: coat, skin: o.skin ?? '#e2ad86', bottom: o.legs ?? '#3a3a42', hair: o.hair ?? '#3b2a20', hat: o.hat, hatStyle: 'brim',
    dress: o.robe ? 'ankle' : undefined, pose: o.pose ?? (rc >= 0.6 ? 'carry' : 'relax'), detail: 'lo',
  });
  return b;
}
/** Small husky / dog: body, head with snout and ears, curled tail. */
/** Flat ice floe (jagged slab sitting at the waterline) — scattered patches, never a base. */

/** Long-necked flier (stork, goose, crane): neck stretched forward, broad two-sided flapping wings, legs trailing or tucked. */
/** Sockeye salmon in spawning colours (red body, olive-green head, hooked kype jaw, hump), ~0.42 long at s = 1. */
/** Silver-phase European eel: a long sinuous body with continuous dorsal/anal fin fringe. */
/** Floating golden sargassum weed clump with little air bladders. */
/** Straw-coloured fruit bat: golden mantle, fox face with big eyes, dark membrane wings over finger bones. */
// ======================================================================================================
// Vehicles: carriage shells, Soup boxes & wheels, ribbon lettering, hull decals
// ======================================================================================================
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm3 = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** Flat ribbon lettering baked into a Soup (one mesh); strokes face ax × ay, `map` can wrap them onto a curved hull. */
/** Axis-aligned box into a Soup; y is the bottom. Face colours [+x, −x, +y, −y, +z, −z] (default all c). */
function sbox(sp: Soup, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, fc?: (string | undefined)[]): void {
  const x0 = x - sx / 2, z0 = z - sz / 2, X = sx, Y = sy, Z = sz, f = (o: V3, u: V3, v: V3, k: number) => {
    sp.quad(o, [o[0] + u[0], o[1] + u[1], o[2] + u[2]], [o[0] + u[0] + v[0], o[1] + u[1] + v[1], o[2] + u[2] + v[2]], [o[0] + v[0], o[1] + v[1], o[2] + v[2]], fc?.[k] ?? c);
  };
  f([x0 + X, y, z0], [0, Y, 0], [0, 0, Z], 0); f([x0, y, z0], [0, 0, Z], [0, Y, 0], 1);
  f([x0, y + Y, z0], [0, 0, Z], [X, 0, 0], 2); f([x0, y, z0], [X, 0, 0], [0, 0, Z], 3);
  f([x0, y, z0 + Z], [X, 0, 0], [0, Y, 0], 4); f([x0, y, z0], [0, Y, 0], [X, 0, 0], 5);
}
/** Wheel face (disc in the y-z plane) looking out along ±x, with a darker tyre ring and hub. */
function sdisc(sp: Soup, x: number, y: number, z: number, r: number, side: number, c: string, tyre = '#1d1f23', n = 20): void {
  const ring = (rr: number, dx: number, col: string) => {
    const C: V3 = [x + dx * side, y, z];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, b = ((k + 1) / n) * Math.PI * 2;
      const A: V3 = [C[0], y + Math.sin(a) * rr, z + Math.cos(a) * rr], B: V3 = [C[0], y + Math.sin(b) * rr, z + Math.cos(b) * rr];
      if (side > 0) sp.tri(C, B, A, col); else sp.tri(C, A, B, col);
    }
  };
  ring(r, 0, tyre); ring(r * 0.8, 0.001, c); ring(r * 0.25, 0.002, tyre);
}
/** Two/three-axle bogie: frame plus wheel faces both sides. */
function sbogie(sp: Soup, z: number, w: number, axles = 2, wr = 0.013, c = '#26292e'): void {
  const L = (axles - 1) * wr * 2.4;
  sbox(sp, c, 0, wr * 0.6, z, w * 1.7, wr * 1.1, L + wr * 2.2);
  for (let i = 0; i < axles; i++) for (const sd of [-1, 1]) sdisc(sp, sd * w * 0.86, wr, z - L / 2 + i * wr * 2.4, wr, sd, '#3b3f46');
}
/** Rounded-rectangle section (right half bottom→top, then mirrored), anticlockwise seen from +z; extra side vertices at `ys`. */
function rrSec(w: number, h: number, r: number, rt: number, ys: number[], n = 6): [number, number][] {
  const R: [number, number][] = [[0, 0]];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; R.push([w - r + Math.cos(a) * r, r + Math.sin(a) * r]); }
  for (const y of [...ys].sort((a, b) => a - b)) if (y > r + 1e-4 && y < h - rt - 1e-4) R.push([w, y]);
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; R.push([w - rt + Math.cos(a) * rt, h - rt + Math.sin(a) * rt]); }
  R.push([0, h]);
  const L = R.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number]);
  return [...R, ...L];
}
interface CarO {
  zb: number; zf: number; w: number; y0: number; h: number; r?: number; rTop?: number; ys?: number[]; zs?: number[];
  /** Colour for each face from its centre and normal. */
  paint: (z: number, y: number, nx: number, ny: number, nz: number) => string; capB?: string; capF?: string;
  /** Extra rings near the ends: [distance in from the end, width scale, height scale]. */
  nose?: [number, number, number][]; tail?: [number, number, number][];
}
/** Railway carriage / locomotive shell into a Soup: crisp per-face livery (window edges come from `ys`/`zs` breakpoints). */
function carBody(sp: Soup, o: CarO): void {
  const sec = rrSec(o.w, o.h, o.r ?? 0.008, o.rTop ?? o.r ?? 0.008, (o.ys ?? []).map(y => y - o.y0)), m = sec.length;
  const rs: [number, number, number][] = [[o.zb, 1, 1], [o.zf, 1, 1]];
  for (const z of o.zs ?? []) if (z > o.zb + 1e-4 && z < o.zf - 1e-4) rs.push([z, 1, 1]);
  for (const [d, a, b] of o.nose ?? []) rs.push([o.zf - d, a, b]);
  for (const [d, a, b] of o.tail ?? []) rs.push([o.zb + d, a, b]);
  rs.sort((a, b) => a[0] - b[0]);
  const rings = rs.map(([z, a, b]) => sec.map(([x, y]) => [x * a, o.y0 + y * b, z] as V3));
  const vn = sec.map((_, j) => {
    const p0 = sec[(j + m - 1) % m], p1 = sec[j], p2 = sec[(j + 1) % m];
    const n1 = nrm3([p1[1] - p0[1], -(p1[0] - p0[0]), 0]), n2 = nrm3([p2[1] - p1[1], -(p2[0] - p1[0]), 0]);
    return nrm3([n1[0] + n2[0], n1[1] + n2[1], 0]);
  });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < m; j++) {
    const j1 = (j + 1) % m, A = rings[i][j], B = rings[i][j1], C = rings[i + 1][j1], D = rings[i + 1][j];
    const fn = nrm3(cross3([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]));
    const col = o.paint((A[2] + C[2]) / 2, (A[1] + B[1] + C[1] + D[1]) / 4, fn[0], fn[1], fn[2]);
    if (Math.abs(fn[2]) > 0.15) sp.quad(A, B, C, D, col);
    else { sp.tri(A, B, C, col, vn[j], vn[j1], vn[j1]); sp.tri(A, C, D, col, vn[j], vn[j1], vn[j]); }
  }
  for (const [ring, sg, cc] of [[rings[0], -1, o.capB], [rings[rings.length - 1], 1, o.capF]] as const) {
    const C: V3 = [0, ring.reduce((s0, q) => s0 + q[1], 0) / m, ring[0][2]], col = cc ?? o.paint(C[2], C[1], 0, 0, sg);
    for (let j = 0; j < m; j++) { const a = ring[j], b = ring[(j + 1) % m]; if (sg > 0) sp.tri(C, a, b, col); else sp.tri(C, b, a, col); }
  }
}
/** Hull-side decal between stations u0..u1 and heights y0..y1 on side sd (cells where paint(s, t) is null are skipped). */
const glow = (m: THREE.Mesh, c: string) => { m.material = mat(c, { emissive: c }); return m; };
/** Full-width diesel cab unit (y0 0.034, h 0.11) with a raked windscreen nose at +z (and at −z when `both`). */
function diesel(sp: Soup, zb: number, zf: number, o: { body: string; roof: string; glass: string; front: string; both?: boolean; ys?: number[];
  livery?: (z: number, y: number, nx: number, ny: number, nz: number) => string | null }): void {
  const w = 0.047, y0 = 0.034, nose: [number, number, number][] = [[0.034, 1, 1], [0.016, 0.985, 0.93], [0, 0.95, 0.82]];
  const cabF = (z: number) => z > zf - 0.06 || (!!o.both && z < zb + 0.06);
  carBody(sp, {
    zb, zf, w, y0, h: 0.11, r: 0.006, rTop: 0.014, ys: [0.046, 0.104, 0.124, ...(o.ys ?? [])], zs: [zf - 0.058, zf - 0.042, zb + 0.042, zb + 0.058], nose, tail: o.both ? nose : [],
    capF: o.front, capB: o.both ? o.front : o.body,
    paint: (z, y, nx, ny, nz) => {
      if (Math.abs(nz) > 0.15 && y > 0.1) return o.glass;
      const L = o.livery?.(z, y, nx, ny, nz);
      if (L) return L;
      if (ny > 0.6) return o.roof;
      if (Math.abs(nx) > 0.6 && y > 0.104 && y < 0.124 && cabF(z) && (z > zf - 0.042 || z < zb + 0.042)) return o.glass;
      return y < 0.046 ? sh(o.body, 0.6) : o.body;
    },
  });
  // Windscreen glazing and headlights on the front face(s), roof fans, three-axle bogies
  for (const [zz, sg] of (o.both ? [[zf, 1], [zb, -1]] : [[zf, 1]]) as [number, number][]) {
    sbox(sp, o.glass, 0, 0.1, zz + sg * 0.0012, 0.074, 0.018, 0.002);
    sbox(sp, '#1a1b1e', 0, 0.034, zz + sg * 0.0015, 0.09, 0.008, 0.003);
  }
  for (let k = 0; k < 3; k++) sbox(sp, '#5b6067', 0, 0.143, zb + (zf - zb) * (0.3 + k * 0.17), 0.05, 0.006, 0.04);
  sbogie(sp, zb + 0.05, w, 3, 0.012);
  sbogie(sp, zf - 0.05, w, 3, 0.012);
}
/** Passenger coach shell with one window band; `win` decides glass vs. pier at z, `livery` overrides other faces. */
function coach(sp: Soup, zb: number, zf: number, o: { body: string; roof: string; glass: string; yw: [number, number]; ys?: number[]; pitch?: number;
  livery?: (z: number, y: number, nx: number, ny: number) => string | null; rTop?: number }): void {
  const w = 0.047, pitch = o.pitch ?? 0.03, n = Math.floor((zf - zb - 0.05) / pitch), z0 = (zb + zf) / 2 - ((n - 1) * pitch) / 2, zs: number[] = [];
  for (let k = 0; k < n; k++) zs.push(z0 + k * pitch - pitch * 0.33, z0 + k * pitch + pitch * 0.33);
  const inWin = (z: number) => { const k = Math.round((z - z0) / pitch); return k >= 0 && k < n && Math.abs(z - (z0 + k * pitch)) < pitch * 0.33; };
  carBody(sp, {
    zb, zf, w, y0: 0.032, h: 0.108, r: 0.006, rTop: o.rTop ?? 0.02, ys: [0.04, ...o.yw, ...(o.ys ?? [])], zs, capB: '#1b1c20', capF: '#1b1c20',
    paint: (z, y, nx, ny) => {
      if (Math.abs(nx) > 0.6 && y > o.yw[0] && y < o.yw[1]) return inWin(z) ? o.glass : (o.livery?.(z, y, nx, ny) ?? o.body);
      const L = o.livery?.(z, y, nx, ny);
      if (L) return L;
      if (ny > 0.45) return o.roof;
      return y < 0.04 ? sh(o.body, 0.55) : o.body;
    },
  });
  sbogie(sp, zb + 0.042, w);
  sbogie(sp, zf - 0.042, w);
}
// ======================================================================================================
// Builders
// ======================================================================================================
export const H_ROUTES2: Record<string, Builder> = {
  vy_jianzhen: gp => {
    // Jianzhen's Tang voyage (753): a kentōshi-style ship — flat-bottomed hull, vermilion-and-white bulwark panels,
    // two masts with battened mat sails, a deckhouse aft — and the blind master monk standing at the bow
    // Ref: 遣唐使船 reconstructions (Heijō Palace replica, Nara 2010; Kibi Daijin scroll), Tōshōdai-ji Jianzhen statue: weathered
    // vermilion and lime-white strakes, plank-roofed deckhouse, bamboo-mat sails; monks in dark robes with an ochre kasaya; ~30 m hull.
    const red = '#8e3a2a', wht = '#d4ccb8', gold = '#7a6446';
    const H = hull(gp, {
      L: 0.78, B: 0.125, full: 0.4, tumble: 0.04, bulwark: 0.03, bulC: wht, nu: 26,
      sheer: u => 0.12 + 0.07 * Math.pow(1 - u, 2.5) + 0.06 * Math.pow(u, 2.5),
      half: u => (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.05))) * (u > 0.85 ? 1 - (u - 0.85) * 2.2 : 1),
      keel: u => 0.04 * Math.pow(1 - u, 2) + 0.06 * Math.pow(u, 2), bands: [0.12, 0.17, 0.21],
      paint: (u, d, y) => (y < 0.02 ? '#2a2220' : d < 0.12 ? (Math.floor(u * 22) % 3 === 0 ? red : wht) : d < 0.17 ? red : d < 0.21 ? '#2a2420' : '#4a3424'), deck: '#8e7454',
    });
    // Close the gap between the gunwales above the bow and stern fans, plus a transverse breastwork plank
    const cap = new Soup();
    for (const u of [0, 1]) {
      const ring = Array.from({ length: 13 }, (_, j) => H.pt(u, j / 12)), cy = ring.reduce((a, q) => a + q[1], 0) / ring.length;
      const C: V3 = [0, cy, H.z(u)], a = ring[0], b = ring[12];
      cap.tri(C, a, b, '#3a2c22'); cap.tri(C, b, a, '#3a2c22');
      sbox(cap, wht, 0, a[1] - 0.004, H.z(u) + (u ? -0.004 : 0.004), Math.abs(a[0]) * 2 + 0.01, 0.034, 0.006);
    }
    cap.mesh(gp);
    // Red posts along the white bulwark
    for (const sd of [-1, 1]) for (let i = 0; i <= 12; i++) { const q = H.gun(0.06 + i * 0.075, sd); box(gp, red, q[0] * 1.02, q[1] - 0.004, q[2], 0.008, 0.038, 0.01); }
    for (const sd of [-1, 1]) { const a = H.gun(0.03, sd), b = H.gun(0.97, sd); rod(gp, [a[0], a[1] + 0.034, a[2]], [b[0], b[1] + 0.034, b[2]], 0.004, red, 5); }
    // Pavilion aft: red pillars, white walls, dark tiled hip roof with gilded upturned corners
    const st = H.top(0.14), pz = H.z(0.15);
    rbox(gp, red, 0, st + 0.035, pz, 0.14, 0.07, 0.15, 0.004);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) box(gp, wht, sd * 0.0705, st + 0.014, pz - 0.046 + i * 0.046, 0.003, 0.046, 0.034);
    for (let i = 0; i < 2; i++) box(gp, wht, -0.03 + i * 0.06, st + 0.014, pz + 0.0755, 0.04, 0.046, 0.003);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(gp, '#6e2e22', sx * 0.072, st, pz + sz * 0.077, 0.008, 0.075, 7);
    box(gp, gold, 0, st + 0.07, pz, 0.15, 0.006, 0.16);
    for (const sd of [-1, 1]) { const m = box(gp, '#4a4038', sd * 0.048, st + 0.088, pz, 0.13, 0.014, 0.21); m.rotation.z = -sd * 0.45; }
    box(gp, '#3a322c', 0, st + 0.112, pz, 0.018, 0.016, 0.22);
    // Two timber masts with mat sails; long streamers
    const mast = (u: number, h: number): V3 => { const z = H.z(u), y = H.top(u); rod(gp, [0, y - 0.02, z], [0, y + h, z], 0.009, '#5a4232', 7, 0.006); return [0, y + h, z]; };
    const m1 = mast(0.55, 0.52), m2 = mast(0.84, 0.38);
    lugSail(gp, [0, m1[1] - 0.03, m1[2] - 0.012], 0.3, 0.38, 0.35, '#a89068');
    lugSail(gp, [0, m2[1] - 0.03, m2[2] - 0.012], 0.22, 0.26, 0.3, '#a08860');
    for (const m of [m1, m2]) flag(gp, [0, m[1] + 0.004, m[2]], 0.1, 0.016, u => (u < 0.5 ? '#a88a5a' : '#8a3a2a'), -1, 0, 6, 2);
    rod(gp, m1, [0, H.top(1) + 0.02, H.z(1)], 0.0015, '#2a2018', 3);
    rod(gp, m1, [0, H.top(0.12) + 0.12, H.z(0.08)], 0.0015, '#2a2018', 3);
    // Big stern rudder; Jianzhen at the bow (dark robe, ochre kasaya, shaven head) with a disciple, and the crew at true scale
    box(gp, '#3a2a1c', 0, 0.03, H.z(0) - 0.02, 0.014, 0.17, 0.06);
    const PS = 0.34, shaven = { robe: true, skin: '#d6a47c', hair: '#b88a68' };
    const jz = person(gp, [0, H.top(0.86) - 0.004, H.z(0.86)], 0, PS, '#4a4038', { ...shaven, reach: 0.2 });
    blade(jz, '#8a5a32', [-0.02, 0.1, 0.012], [0.02, 0.03, 0.014], 0.012, 0.003, [0, 0, 1]);
    person(gp, [0.03, H.top(0.8) - 0.004, H.z(0.8)], 0.3, PS * 0.97, '#5a4a3a', shaven);
    for (const [x, u, yw, c] of [[-0.05, 0.62, 1.2, '#7a6a52'], [0.05, 0.45, -1.4, '#5b6455'], [-0.04, 0.32, 0.6, '#8a7a60'], [0.03, 0.2, Math.PI, '#6a5a44']] as const)
      person(gp, [x, H.top(u) - 0.004, H.z(u)], yw, PS, c, { legs: '#4a4238', skin: '#c8946a', hair: '#1e1a16', pose: u === 0.62 ? 'reach' : undefined });
  },
  vh_qinghaitibet: gp => {
    // Qinghai–Tibet Railway: twin NJ2 diesels (dark green with a yellow stripe and yellow nose) hauling sealed,
    // oxygen-enriched coaches over the roof of the world — up to 5,072 m at Tanggula Pass
    // Ref: CR NJ2 (GE C38AChi, 2006) in dark green with yellow waist stripes and nose; 25T plateau coaches (Bombardier Sifang) in green/yellow.
    const sp = new Soup(), grn = '#24493a', yel = '#d4ae3a', glass = '#1b2630';
    const stripe = (z: number, y: number, nx: number) => (Math.abs(nx) > 0.6 && y > 0.068 && y < 0.08 ? yel : null);
    diesel(sp, 0.248, 0.5, { body: grn, roof: '#5d6560', glass, front: yel, ys: [0.068, 0.08], livery: (z, y, nx) => stripe(z, y, nx) ?? (Math.abs(nx) > 0.6 && z > 0.5 - 0.06 + (y - 0.046) * 0.9 && y > 0.046 ? yel : null) });
    diesel(sp, -0.012, 0.236, { body: grn, roof: '#5d6560', glass, front: yel, ys: [0.068, 0.08], livery: stripe });
    // Green V on the yellow nose, headlights, number board
    for (const sd of [-1, 1]) {
      const A: V3 = [sd * 0.045, 0.06, 0.5013], B: V3 = [0, 0.052, 0.5013], C: V3 = [sd * 0.045, 0.085, 0.5013];
      sp.tri(A, B, C, grn);
      sp.tri(A, C, B, grn);
    }
    for (const sd of [-1, 1]) glow(ellip(gp, '#f2ead0', sd * 0.03, 0.06, 0.501, 0.006, 0.006, 0.003), '#e8dcb0');
    glow(ellip(gp, '#f2ead0', 0, 0.124, 0.49, 0.005, 0.005, 0.003), '#e8dcb0');
    sbox(sp, '#111', 0, 0.088, 0.5012, 0.03, 0.008, 0.002);
    // Two passenger coaches: green with a yellow waist band, pale roof, tinted sealed windows
    for (const [zb, zf] of [[-0.252, -0.022], [-0.49, -0.262]] as [number, number][]) {
      coach(sp, zb, zf, { body: grn, roof: '#8e928e', glass, yw: [0.075, 0.103], ys: [0.062, 0.07], pitch: 0.034,
        livery: (_z, y, nx) => (Math.abs(nx) > 0.6 && y > 0.062 && y < 0.07 ? yel : null) });
    }
    for (const z of [-0.017, -0.257]) sbox(sp, '#16171a', 0, 0.04, z, 0.062, 0.09, 0.012);
    sp.mesh(gp);
  },
};
