import * as THREE from "three";
import {
  type Paint, type V3, mat, add, sweep as sweep0, paintFaces, strut, g, hash3,
} from "./prims.ts";

/** Painted smooth ellipsoid whose geometry lives in model space (so coat patterns line up across parts). */
export function pblob(p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry: number, rz: number,
  paint?: Paint, rot: V3 = [0, 0, 0], seg = 22, flat = false): THREE.Mesh {
  const sg = flat ? Math.round(seg * 1.6) : seg;
  const geo = new THREE.SphereGeometry(1, sg, Math.round(sg * 0.7));
  geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), new THREE.Vector3(rx, ry, rz)));
  return add(p, paintFaces(geo, c, paint), mat("#ffffff", { flat: false, vc: true }), 0, 0, 0, 1, 1, 1);
}

const ESEG = [[8, 6], [12, 8], [16, 11]];
const ellip = (p: THREE.Object3D, c: string, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, roty = 0, rotx = 0, rotz = 0) => {
  const r = Math.max(rx, ry, rz), [a, b] = ESEG[r < 0.014 ? 0 : r < 0.035 ? 1 : 2];
  return add(p, g("an-esph" + a, () => new THREE.SphereGeometry(1, a, b)), mat(c, { flat: false }), x, y, z, rx, ry, rz, roty, rotx, rotz);
};

function sweep(p: THREE.Object3D, st: Parameters<typeof sweep0>[1], c: string, o: Parameters<typeof sweep0>[3] = {}): THREE.Mesh {
  return sweep0(p, st, c, { ...o, flat: false });
}

const RGB = new Map<string, number[]>();
function rgb(h: string): number[] {
  let v = RGB.get(h);
  if (!v) {
    let s = h.slice(1);
    if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
    const n = parseInt(s, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    RGB.set(h, v);
  }
  return v;
}
const c8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const hx = (r: number, gg: number, b: number) => "#" + ((1 << 24) | (c8(r) << 16) | (c8(gg) << 8) | c8(b)).toString(16).slice(1);
function mx(a: string, b: string, t: number): string {
  t = Math.round(t * 12) / 12;
  const A = rgb(a), B = rgb(b);
  return hx(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function sh(a: string, f: number): string { const A = rgb(a); return hx(A[0] * f, A[1] * f, A[2] * f); }

const DROP = () => g("an-drop", () => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7; pts.push(new THREE.Vector2(Math.max(1e-4, 0.5 * Math.sin(Math.PI * Math.pow(t, 0.62))), t)); }
  const lg = new THREE.LatheGeometry(pts, 7);
  lg.computeVertexNormals();
  return lg;
});
const _Y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
function drop(p: THREE.Object3D, c: string, a: V3, b: V3, r: number, rz = r): THREE.Mesh {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length() || 1e-4;
  const m = add(p, DROP(), mat(c, { flat: false }), a[0], a[1], a[2], r * 2, len, rz * 2);
  m.quaternion.setFromUnitVectors(_Y, _d.normalize());
  return m;
}
type LS = [V3, number, number?];
function limb(p: THREE.Object3D, c: string, st: LS[], paint?: Paint, radial = 14, flat = false): THREE.Mesh {
  return sweep(p, st.map(([pt, w, h]) => ({ p: pt, w, h: h ?? w })), c, { radial, sub: 5, paint, up: [0, 0, 1], flat });
}
function grp(p: THREE.Object3D, pos: V3, rot: V3 = [0, 0, 0], order: THREE.EulerOrder = "YXZ"): THREE.Group {
  const gg = new THREE.Group();
  gg.position.set(pos[0], pos[1], pos[2]);
  gg.rotation.set(rot[0], rot[1], rot[2], order);
  p.add(gg);
  return gg;
}
const lit = (m: THREE.Mesh) => { m.material = mat("#ffffff", { emissive: "#ffffff" }); };

function aEye(p: THREE.Object3D, x: number, y: number, z: number, r: number, yaw: number, iris: string, lid?: string, slit = false): void {
  const e = grp(p, [x, y, z], [0, yaw, 0]);
  ellip(e, "#17110d", 0, 0, -r * 0.05, r * 1.16, r * 1.04, r * 0.7);
  ellip(e, iris, 0, 0, r * 0.1, r, r * 0.95, r * 0.6);
  ellip(e, "#070707", 0, 0, r * 0.36, slit ? r * 0.26 : r * 0.5, r * 0.56, r * 0.34);
  lit(ellip(e, "#ffffff", r * 0.34, r * 0.36, r * 0.6, r * 0.2));
  if (lid) ellip(e, lid, 0, r * 0.7, r * 0.02, r * 1.28, r * 0.5, r * 0.86, 0, -0.28);
}

function cupEar(p: THREE.Object3D, pos: V3, rot: V3, w: number, h: number, outer: string, inner: string, pointed = false, rim?: string): THREE.Group {
  const e = grp(p, pos, rot, "XYZ");
  if (pointed) {
    drop(e, outer, [0, -h * 0.05, 0], [0, h, 0], w, w * 0.45);
    drop(e, inner, [0, h * 0.08, w * 0.22], [0, h * 0.86, w * 0.26], w * 0.62, w * 0.18);
    if (rim) drop(e, rim, [0, h * 0.72, 0], [0, h * 1.02, 0], w * 0.36, w * 0.3);
  } else {
    ellip(e, outer, 0, h * 0.5, 0, w, h * 0.55, w * 0.42);
    ellip(e, inner, 0, h * 0.44, w * 0.24, w * 0.64, h * 0.38, w * 0.2);
    if (rim) ellip(e, rim, 0, h * 0.62, -w * 0.08, w * 0.9, h * 0.42, w * 0.36);
  }
  return e;
}

function tuft(p: THREE.Object3D, c: string, at: V3, dir: V3, len: number, r: number, n = 5, spread = 0.5, c2?: string): void {
  const dl = Math.hypot(...dir) || 1;
  const d: V3 = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = i === 0 ? 0 : spread;
    const ox = Math.cos(a) * k, oy = Math.sin(a) * k * 0.8, oz = Math.sin(a + 1) * k * 0.5;
    const L = len * (i === 0 ? 1.1 : 0.8 + hash3(i, at[0] * 50, at[2] * 50) * 0.3);
    drop(p, c2 && i % 2 ? c2 : c, [at[0] + ox * r * 0.6, at[1] + oy * r * 0.6, at[2] + oz * r * 0.6],
      [at[0] + (d[0] + ox * 0.6) * L, at[1] + (d[1] + oy * 0.6) * L, at[2] + (d[2] + oz * 0.6) * L], r);
  }
}

interface Quad {
  c: string; span: number; leg: number; bw: number; bh: number; R: number;
  withers?: number; rump?: number; tuck?: number; hind?: number; legX?: number; fore?: number;
  feet: "hoof" | "cloven"; foot?: string; stride?: number;
  body?: Paint; legP?: Paint; neckP?: Paint; flat?: boolean;
  neck: number; neckA: number; neckW: number; neckH?: number; arch?: number;
}
interface Frame { by: number; bh: number; bw: number; zs: number; zr: number; hp: V3; n0: V3; tail0: V3; wd: number; rd: number }

function quad(gp: THREE.Group, q: Quad): Frame {
  const { c, span, leg, bw, bh, R } = q;
  const wd = q.withers ?? 0, rd = q.rump ?? 0, tk = q.tuck ?? 0.15, hk = q.hind ?? 1, fk = q.fore ?? 1;
  const by = leg + bh, zs = span / 2, zr = -span / 2;
  const P = q.body;
  const ring = (z: number, top: number, under: number, w: number) => ({ p: [0, (top + under) / 2, z] as V3, w, h: (top - under) / 2 });
  sweep(gp, [
    ring(zr - bh * 0.8, by + bh * 0.48 - rd, by - bh * 0.02 - rd * 0.5, bw * 0.32),
    ring(zr - bh * 0.42, by + bh * 0.92 - rd, by - bh * 0.6 - rd * 0.3, bw * 0.8),
    ring(zr + span * 0.1, by + bh * 0.98 - rd * 0.85, by - bh * (0.86 - tk * 0.5), bw * 0.88),
    ring(zr + span * 0.4, by + bh * 0.9 - rd * 0.45 + wd * 0.15, by - bh * (1 - tk * 1.3), bw * (0.9 - tk * 0.22)),
    ring(zr + span * 0.7, by + bh * 1.0 + wd * 0.5, by - bh * 1.04, bw),
    ring(zs, by + bh * 1.04 + wd, by - bh * 0.98, bw * 0.9),
    ring(zs + bh * 0.42, by + bh * 0.84 + wd * 0.85, by - bh * 0.72, bw * 0.68),
    ring(zs + bh * 0.66, by + bh * 0.52 + wd * 0.7, by - bh * 0.22, bw * 0.4),
  ], c, { radial: 26, sub: 6, paint: P, flat: q.flat });
  for (const sx of [-1, 1]) {
    pblob(gp, c, sx * bw * 0.5, by + bh * 0.22 + wd * 0.55, zs - bh * 0.18, bw * 0.44 * fk, bh * 0.84, bh * 0.6 * fk, P, [-0.32, 0, sx * 0.06], 20);
    pblob(gp, c, sx * bw * 0.5, by + bh * 0.05 - rd * 0.7, zr - bh * 0.02, bw * 0.48 * hk, bh * 0.98 * hk, bh * 0.82 * hk, P, [0.22, 0, 0], 20);
  }

  const lp = q.legP ?? P;
  const st = q.stride ?? 0.03, lx = q.legX ?? 0.6;
  const footY = R * 1.25;
  const fc = q.foot ?? sh(c, 0.6);
  for (const sx of [-1, 1]) {
    const xf = sx * bw * lx, xh = sx * bw * lx * 0.97;
    const ff = sx * st, hf = -sx * st;
    const fz = zs - bh * 0.08 + ff, hz = zr - bh * 0.22 + hf;
    limb(gp, c, [
      [[xf * 0.7, by + bh * 0.5 + wd * 0.4, zs - bh * 0.02], R * 1.2 * fk, R * 1.6 * fk],
      [[xf * 0.9, by + bh * 0.05 + wd * 0.2, zs - bh * 0.1], R * 1.6 * fk, R * 2.4 * fk],
      [[xf, leg + bh * 0.2, zs - bh * 0.25], R * 1.45 * fk, R * 2.0 * fk],
      [[xf * 0.98, leg * 0.66, fz - R * 0.2], R * 1.05, R * 1.2],
      [[xf * 0.97, leg * 0.42, fz], R * 0.86, R * 0.96],
      [[xf * 0.96, leg * 0.25, fz + R * 0.05], R * 0.58, R * 0.64],
      [[xf * 0.96, footY + R * 0.55, fz + R * 0.12], R * 0.72, R * 0.82],
      [[xf * 0.96, footY + R * 0.05, fz + R * 0.5], R * 0.62, R * 0.62],
    ], lp);
    limb(gp, c, [
      [[xh * 0.7, by + bh * 0.55 - rd, zr - bh * 0.05], R * 1.4 * hk, R * 1.9 * hk],
      [[xh * 0.92, by + bh * 0.1 - rd, zr + bh * 0.12], R * 1.85 * hk, R * 2.8 * hk],
      [[xh * 1.04, leg + bh * 0.25 - rd * 0.5, zr + bh * 0.55], R * 1.55 * hk, R * 2.1 * hk],
      [[xh, leg * 0.74, zr + bh * 0.02], R * 1.05, R * 1.45],
      [[xh * 0.98, leg * 0.5, zr - bh * 0.32], R * 0.78, R * 1.05],
      [[xh * 0.97, leg * 0.27, hz], R * 0.58, R * 0.66],
      [[xh * 0.96, footY + R * 0.55, hz + R * 0.12], R * 0.72, R * 0.82],
      [[xh * 0.96, footY + R * 0.05, hz + R * 0.5], R * 0.62, R * 0.62],
    ], lp);
    for (const [x, z] of [[xf * 0.96, fz + R * 0.58], [xh * 0.96, hz + R * 0.58]] as const) {
      if (q.feet === "cloven") for (const k of [-1, 1]) strut(gp, [x + k * R * 0.32, 0, z + R * 0.12], [x + k * R * 0.2, footY + R * 0.1, z - R * 0.08], R * 0.42, R * 0.32, fc, 8);
      else strut(gp, [x, 0, z + R * 0.12], [x, footY + R * 0.1, z - R * 0.12], R * 0.84, R * 0.62, fc, 12);
    }
  }

  const n0: V3 = [0, by + bh * 0.42 + wd * 0.75, zs + bh * 0.28];
  const a = q.neckA, L = q.neck, nw = q.neckW, nh = q.neckH ?? 1, arch = q.arch ?? 0.06;
  const hp: V3 = [0, n0[1] + Math.sin(a) * L, n0[2] + Math.cos(a) * L];
  const mid: V3 = [0, (n0[1] + hp[1]) / 2 + L * arch * Math.cos(a), (n0[2] + hp[2]) / 2 - L * arch * Math.sin(a)];
  sweep(gp, [
    { p: [0, n0[1] - bh * 0.15, n0[2] - bh * 0.4], w: bw * 0.72, h: bh * 0.8 },
    { p: n0, w: nw * 1.22, h: nw * 1.5 * nh },
    { p: mid, w: nw, h: nw * 1.22 * nh },
    { p: hp, w: nw * 0.86, h: nw * 1.0 },
  ], c, { radial: 20, sub: 5, paint: q.neckP ?? P, flat: q.flat });
  return { by, bh, bw, zs, zr, hp, n0, wd, rd, tail0: [0, by + bh * 0.5 - rd, zr - bh * 0.7] };
}

function tailOf(gp: THREE.Object3D, F: Frame, c: string, len: number, r: number,
  o: { droop?: number; curl?: number; side?: number; paint?: Paint; tip?: number; lift?: number; flat?: boolean } = {}): [V3, V3] {
  let [x, y, z] = F.tail0;
  let pitch = -(o.lift ?? 0.2), yaw = 0;
  const pts: V3[] = [[x, y, z]], n = 7, stp = len / n;
  let dir: V3 = [0, 0, -1];
  for (let i = 1; i <= n; i++) {
    pitch += (o.droop ?? 0.32) - (i > n * 0.55 ? (o.curl ?? 0.25) : 0);
    yaw += (o.side ?? 0.12);
    dir = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    x += dir[0] * stp; y = Math.max(r * 1.2, y + dir[1] * stp); z += dir[2] * stp;
    pts.push([x, y, z]);
  }
  const tp = o.tip ?? 0.55;
  sweep(gp, pts.map((p, i) => ({ p, w: r * (1 - (1 - tp) * (i / n)) })), c, { radial: 12, sub: 4, paint: o.paint, flat: o.flat });
  ellip(gp, c, x, y, z, r * tp * 0.98);
  return [[x, y, z], dir];
}

interface LongO { len?: number; wide?: number; P?: Paint; muz?: string; nostril?: string; earC?: string; earIn?: string; earH?: number; earW?: number; earRot?: V3; iris?: string; lid?: string; lip?: boolean; s?: number }
function longHead(h: THREE.Group, c: string, o: LongO = {}): { tip: number; ear: V3 } {
  const s = o.s ?? 1, L = (o.len ?? 1) * s, W = (o.wide ?? 1) * s, P = o.P;
  const muz = o.muz ?? sh(c, 0.75);
  pblob(h, c, 0, -0.022 * s, 0.035 * s, 0.042 * W, 0.054 * s, 0.058 * s, P, [0.3, 0, 0], 18);
  sweep(h, [
    { p: [0, 0.008 * s, -0.012 * s], w: 0.04 * W, h: 0.04 * s },
    { p: [0, 0.0, 0.07 * L], w: 0.034 * W, h: 0.037 * s },
    { p: [0, -0.01 * s, 0.14 * L], w: 0.027 * W, h: 0.03 * s },
    { p: [0, -0.02 * s, 0.185 * L], w: 0.029 * W, h: 0.031 * s },
  ], c, { radial: 18, sub: 6, paint: P });
  const zt = 0.19 * L;
  pblob(h, muz, 0, -0.024 * s, zt, 0.031 * W, 0.031 * s, 0.026 * s, undefined, [0, 0, 0], 16);
  if (o.lip) pblob(h, muz, 0, -0.052 * s, zt - 0.006 * s, 0.024 * W, 0.014 * s, 0.022 * s, undefined, [0, 0, 0], 12);
  ellip(h, sh(muz, 0.55), 0, -0.04 * s, zt + 0.014 * s, 0.024 * W, 0.0025 * s, 0.012 * s);
  for (const sx of [-1, 1]) {
    ellip(h, o.nostril ?? "#1a1412", sx * 0.016 * W, -0.012 * s, zt + 0.022 * s, 0.006 * s, 0.009 * s, 0.004 * s, 0, 0, sx * 0.4);
    pblob(h, c, sx * 0.032 * W, 0.016 * s, 0.03 * s, 0.014 * s, 0.012 * s, 0.018 * s, P, [0, 0, 0], 10);
    aEye(h, sx * 0.037 * W, 0.008 * s, 0.034 * s, 0.012 * s, sx * 1.05, o.iris ?? "#2b1a10", o.lid ?? c);
  }
  const eh = (o.earH ?? 0.06) * s, ew = (o.earW ?? 0.02) * s;
  for (const sx of [-1, 1]) cupEar(h, [sx * 0.028 * W, 0.03 * s, -0.018 * s], o.earRot ? [o.earRot[0], sx * o.earRot[1], sx * o.earRot[2]] : [-0.3, sx * 0.5, -sx * 0.42], ew, eh, o.earC ?? c, o.earIn ?? mx(c, "#3a2a22", 0.4), true);
  return { tip: zt, ear: [0.028 * W, 0.03 * s, -0.018 * s] };
}

function headGroup(gp: THREE.Group, F: Frame, yaw: number, pitch: number, roll = 0): THREE.Group {
  return grp(gp, F.hp, [pitch, yaw, roll]);
}

/** A saddled horse (zebra frame, plain coat) without habitat; returns the saddle height. Faces +z. Used by Ages. */
export function horse(gp: THREE.Group, coat = "#6b4426", mane = "#2a1a10", o: { stride?: number; saddle?: string; cloth?: string; donkey?: boolean } = {}): number {
  const F = quad(gp, {
    c: coat, span: 0.38, leg: 0.3, bw: 0.088, bh: 0.11, R: 0.026, tuck: 0.12, feet: "hoof", foot: "#1c1917",
    neck: 0.22, neckA: 0.95, neckW: 0.044, neckH: 1.35, arch: 0.12, stride: o.stride ?? 0.035,
  });
  const [, ny0, nz0] = F.n0, [, hy, hz] = F.hp;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, y = ny0 + 0.035 + (hy - ny0) * t + Math.sin(t * Math.PI) * 0.03, z = nz0 - 0.06 + (hz - nz0 + 0.04) * t;
    drop(gp, mane, [0, y, z], [0, y + 0.03, z - 0.03], 0.012, 0.016);
  }
  const h = headGroup(gp, F, 0, 1.0);
  longHead(h, coat, o.donkey ? { muz: "#e7e1d6", earH: 0.13, earW: 0.028, earIn: "#e7e1d6", len: 0.95, wide: 1.08 } : { muz: sh(coat, 0.6), earH: 0.06, earW: 0.022, earIn: sh(coat, 0.7), len: 1.02 });
  const [tip, dir] = tailOf(gp, F, coat, 0.26, 0.012, { droop: 0.7, curl: 0, side: 0.05 });
  tuft(gp, mane, tip, dir, 0.14, 0.022, 7, 0.25);
  const top = F.by + F.bh;
  ellip(gp, o.cloth ?? "#7f1d1d", 0, top - 0.03, 0.0, F.bw * 1.04, 0.032, 0.085);
  ellip(gp, o.saddle ?? "#3b2414", 0, top - 0.005, 0.0, F.bw * 0.75, 0.03, 0.07);
  return top + 0.01;
}
