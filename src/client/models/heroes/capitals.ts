import * as THREE from 'three';
import { type Builder, type V3, type Paint, add, mat, g, box, rbox, cyl, cone, ellip, lathe, rod, skin, slab, gable, tbox, prism, shade, mix, hash3, fbm, plinth, tree, SITE } from '../prims.ts';
import { grp } from '../timber.ts';
import { human, type HumanOpts } from '../human.ts';

// Dynastic capitals, one model per capital (pack "capitals"): Erlitou, Shang Yinxu, the Western Zhou Fengchu courtyard,
// Eastern Zhou Luoyi (天子驾六), Qin Xianyang, Western Han Weiyang, Eastern Han Luoyang (灵台/太学), Wei–Jin Luoyang 太极殿,
// Six Dynasties Jiankang, the Tang Hanyuan Hall, the Song Xuande Gate, Southern Song Lin'an, Yuan Dadu's Daming Hall and the
// ROC Nanjing gateway. Ming–Qing keep `palace`. Front faces +z, base at y=0, footprint ≈ ±0.45, same overall size and
// height (~0.4) as `palace` so they read as one family on the map.
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const C = {
  earth: '#b8925e', earthTop: '#c7a574', loess: '#a88a5e', straw: '#cdb173', wood: '#6b4a30', darkwood: '#43301f', daub: '#dccaa0',
  plaster: '#e8e0cc', vermilion: '#a8352a', grey: '#5b5f66', greyTile: '#6c6f72', black: '#2c2d31', marble: '#e4ded0', jade: '#2f7d6d',
  green: '#3f8a62', blue: '#2f7a8f', gold: '#d6a840', stone: '#a7a297', paving: '#c3b9a4', grass: '#7d8a52', bronze: '#8a6a3a',
};

// ---- shared kit -----------------------------------------------------------------------------------------------

/** Local radius of the plinth top in the current builder's content frame (set by `site`). */
let RL = 0.44;
/** Pull a plan point radially inside the plinth top. */
const clip = (x: number, z: number, m = 0.004): [number, number] => {
  const r = Math.hypot(x, z), L = RL - m;
  return r > L ? [(x * L) / r, (z * L) / r] : [x, z];
};

/**
 * Every capital stands on the shared round museum base (prims `plinth`, dark walnut side, SITE-coloured top). The site
 * is authored in a ±0.5 frame and placed in a content group scaled by k so it fits the disc; returns [group, top y].
 */
function site(root: THREE.Group, top: string, k: number, paint?: Paint): [THREE.Group, number] {
  const h = plinth(root, top, { paint });
  const p = new THREE.Group();
  p.position.y = h + 0.0015;
  p.scale.setScalar(k);
  root.add(p);
  RL = 0.444 / k;
  return [p, 0];
}

/** A band of ground (road, river) across the disc between z0 and z1, following the plinth rim at both ends. */
function band(p: THREE.Object3D, z0: number, z1: number, y: number, h: number, c: string, m = 0.006): void {
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const z = z0 + ((z1 - z0) * i) / 10, x = Math.sqrt(Math.max(0, (RL - m) ** 2 - z * z));
    L.push([-x, z]);
    R.push([x, z]);
  }
  prism(p, [...L, ...R.reverse()], y, h, c);
}

/** Rammed-earth (夯土) or masonry block, tapered, with horizontal tamping/coursed layers and organic surface texture. */
function earth(p: THREE.Object3D, x: number, y: number, z: number, w0: number, d0: number, w1: number, d1: number, h: number, c: string, bands = 3, top = shade(c, 1.08)): number {
  const nb = Math.max(bands * 2, 5), sub = 6, rings: V3[][] = [];
  for (let i = 0; i <= nb; i++) {
    const t = i / nb, hw = (w0 + (w1 - w0) * t) / 2, hd = (d0 + (d1 - d0) * t) / 2, yy = y + h * t;
    const corners: [number, number][] = [[x - hw, z - hd], [x + hw, z - hd], [x + hw, z + hd], [x - hw, z + hd]];
    const ring: V3[] = [];
    for (let s = 0; s < 4; s++) {
      const [ax, az] = corners[s], [bx, bz] = corners[(s + 1) % 4];
      for (let k = 0; k < sub; k++) {
        const u = k / sub;
        ring.push([ax + (bx - ax) * u, yy, az + (bz - az) * u]);
      }
    }
    rings.push(ring);
  }
  skin(p, rings, c, {
    caps: true, flat: true,
    paint: (px, py, pz, _nx, ny) => {
      const n = fbm(px * 12, py * 18, pz * 12);
      if (ny > 0.6) return shade(top, 0.94 + n * 0.12);
      const layer = Math.floor(((py - y) / Math.max(0.001, h)) * nb);
      const blk = hash3(Math.floor(px * 28), layer, Math.floor(pz * 28));
      return shade(c, (layer % 2 ? 0.9 : 1.01) * (0.93 + n * 0.1 + blk * 0.06));
    },
  });
  return y + h;
}

function tris(): { pos: number[]; col: number[]; t: (a: V3, b: V3, c: V3, color: string) => void } {
  const pos: number[] = [], col: number[] = [], tmp = new THREE.Color();
  return {
    pos, col,
    t(a, b, c, color) {
      tmp.set(color);
      pos.push(...a, ...b, ...c);
      for (let k = 0; k < 3; k++) col.push(tmp.r, tmp.g, tmp.b);
    },
  };
}
function polyMesh(p: THREE.Object3D, pos: number[], col: number[]): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return add(p, geo, mat('#ffffff', { vc: true }), 0, 0, 0, 1, 1, 1);
}

interface RoofO {
  tile: string; k?: number; lift?: number; rib?: string | null; under?: string; fascia?: string; edge?: string; thatch?: boolean;
  /** skirt (腰檐/副阶) mode: stop where the slope meets a wall of this [w, d]; h is then the rise to that wall. */
  inner?: [number, number];
  /** half-hip (歇山): stop the hip at this fraction and finish with a gable. */
  xie?: number;
  ridge?: string | null; chi?: string; chiH?: number; th?: number;
}
/**
 * Hip roof (庑殿/四阿) over eaves w×d with a concave slope (k), upswept corners (lift) and tile ribs painted as narrow
 * alternating columns. Also makes skirts (inner) and half-hip roofs (xie). Returns the top height.
 */
function roof(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: RoofO): number {
  const hx0 = w / 2, hz0 = d / 2, rz = Math.min(0.004, hz0 * 0.04), ins = hz0 - rz;
  const k = o.k ?? 0.35, lift = o.lift ?? 0, th = o.th ?? (o.thatch ? 0.014 : 0.006);
  const f = (t: number) => t * (1 - k) + k * t * t;
  let tTop = 1;
  if (o.inner) tTop = clamp((hz0 - o.inner[1] / 2) / ins, 0.05, 1);
  else if (o.xie) tTop = o.xie;
  const H = o.inner ? h / f(tTop) : h;
  const T = [0, 0.1, 0.22, 0.37, 0.55, 0.76, 1].map(t => t * tTop);
  const Lz = Math.min(hz0, hx0) * 0.95;
  const sp = o.thatch ? 0.03 : 0.0115;
  const nx = Math.max(4, Math.round(w / sp)), nz = Math.max(3, Math.round(d / sp));
  const per: [number, number][] = [];
  for (const [s, n] of [[0, nx], [1, nz], [2, nx], [3, nz]]) for (let i = 0; i < n; i++) per.push([s, i / n]);
  const P = (s: number, u: number, t: number, dy: number): V3 => {
    const hx = hx0 - t * ins, hz = hz0 - t * ins;
    let px: number, pz: number, L: number;
    if (s === 0) { px = -hx + 2 * hx * u; pz = hz; L = w; } else if (s === 1) { px = hx; pz = hz - 2 * hz * u; L = d; } else if (s === 2) { px = hx - 2 * hx * u; pz = -hz; L = w; } else { px = -hx; pz = -hz + 2 * hz * u; L = d; }
    const c = Math.max(0, 1 - (Math.min(u, 1 - u) * L) / Lz) ** 2 * (1 - t) ** 1.5, o2 = c * lift * hz0 * 0.16;
    return [x + px + Math.sign(px) * o2, y + H * f(t) + dy + c * lift * hz0 * 0.42, z + pz + Math.sign(pz) * o2];
  };
  const R = [per.map(([s, u]) => P(s, u, 0, -th)), ...T.map(t => per.map(([s, u]) => P(s, u, t, 0)))];
  const n = per.length, M = tris();
  const tile = o.tile, rib = o.rib === undefined ? shade(tile, 1.16) : o.rib, fascia = o.fascia ?? shade(tile, 0.68), under = o.under ?? shade(tile, 0.55);
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, a = R[i][j], b = R[i][j1], c = R[i + 1][j1], e = R[i + 1][j];
    const hsh = hash3(i, j, 7);
    const baseCol = i === 0 ? fascia : o.thatch ? (i % 2 ? tile : shade(tile, 0.88)) : i === 1 && o.edge ? o.edge : rib && j % 2 ? rib : tile;
    const col = i === 0 ? baseCol : shade(baseCol, o.thatch ? 0.9 + hsh * 0.18 : 0.95 + hsh * 0.09);
    M.t(a, b, c, col);
    M.t(a, c, e, col);
  }
  const cen = (r: V3[]): V3 => { let sx = 0, sy = 0, sz = 0; for (const v of r) { sx += v[0]; sy += v[1]; sz += v[2]; } return [sx / r.length, sy / r.length, sz / r.length]; };
  const r0 = R[0], c0 = cen(r0);
  for (let j = 0; j < n; j++) M.t(c0, r0[(j + 1) % n], r0[j], under);
  const rt = R[R.length - 1], ct = cen(rt);
  if (!o.inner) for (let j = 0; j < n; j++) M.t(ct, rt[j], rt[(j + 1) % n], tile);
  polyMesh(p, M.pos, M.col);
  let top = y + H * f(tTop);
  if (o.inner) return top;
  const ridge = o.ridge === undefined ? shade(tile, 0.8) : o.ridge;
  if (o.xie) {
    const gw = 2 * (hx0 - tTop * ins), gd = 2 * (hz0 - tTop * ins), gh = gd * 0.55;
    gable(p, gw, gh, gd, tile, x, top, z);
    for (const sx of [-1, 1]) slab(grp(p, x + sx * (gw / 2 - 0.002), z, Math.PI / 2, top), [[-gd * 0.42, 0.002], [gd * 0.42, 0.002], [0, gh * 0.84]], 0.004, o.thatch ? shade(tile, 0.8) : C.plaster, 0, false);
    top += gh;
    if (ridge) box(p, ridge, x, top - 0.006, z, gw + 0.008, 0.01, 0.01);
    return top + 0.004;
  }
  const rl = Math.max(0.02, w - d + 2 * rz);
  if (ridge) {
    const rh = o.thatch ? 0.016 : 0.011;
    box(p, ridge, x, top - rh * 0.5, z, rl + 0.01, rh, o.thatch ? 0.02 : 0.012);
    top += rh * 0.5;
  }
  if (o.chi) for (const sx of [-1, 1]) chiwei(p, x + sx * (rl / 2 + 0.002), top - 0.004, z, sx, o.chiH ?? 0.03, o.chi);
  return top;
}

/** Owl-tail ridge finial (鸱尾) of Tang–Song roofs, curling inwards; sx = +1 for the right end. */
function chiwei(p: THREE.Object3D, x: number, y: number, z: number, sx: number, s: number, c: string): void {
  const out: [number, number][] = [[-0.45, 0], [0.4, 0], [0.55, 0.35], [0.45, 0.72], [0.18, 1], [-0.12, 0.98], [-0.05, 0.78], [-0.3, 0.62], [-0.45, 0.32]];
  const m = slab(grp(p, x, z, 0, y), out.map(([u, v]) => [u * s * 0.55 * sx, v * s] as [number, number]), s * 0.22, c, 0, true);
  m.castShadow = true;
}

interface BodyO { wall: string; col: string; beam?: string; bracket?: string; door?: string; doorN?: number; sp?: number; cr?: number; back?: boolean }
/** Timber hall body: wall core, columns all round, lintel band, optional bracket (斗拱) row and doors; returns the eave height. */
function body(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, o: BodyO): number {
  const cr = o.cr ?? 0.0045, sp = o.sp ?? 0.04;
  box(p, o.wall, x, y, z, w - cr * 2.4, h, d - cr * 2.4);
  const nW = Math.max(2, Math.round(w / sp)), nD = Math.max(1, Math.round(d / sp));
  const post = (px: number, pz: number) => {
    cyl(p, '#9c9588', px, y, pz, cr * 1.4, Math.min(0.0045, h * 0.1), 8);
    cyl(p, o.col, px, y, pz, cr, h, 8);
  };
  for (let i = 0; i <= nW; i++) for (const sz of o.back === false ? [1] : [-1, 1]) post(x - w / 2 + (i * w) / nW, z + (sz * d) / 2);
  for (let i = 1; i < nD; i++) for (const sx of [-1, 1]) post(x + (sx * w) / 2, z - d / 2 + (i * d) / nD);
  const bh = Math.min(0.01, h * 0.14);
  box(p, o.beam ?? o.col, x, y + h - bh, z, w + 0.004, bh, d + 0.004);
  // Decorative painted architrave band (额枋彩画) under the lintel beam
  if (h > 0.03) box(p, mix(o.beam ?? o.col, '#2f7a68', 0.38), x, y + h - bh * 1.45, z, w + 0.002, bh * 0.45, d + 0.002);
  if (o.door) {
    const nd = Math.min(nW, o.doorN ?? nW), i0 = Math.floor((nW - nd) / 2), bw = w / nW;
    for (let i = 0; i < nW; i++) {
      const dx = x - w / 2 + (i + 0.5) * bw, dw = bw * 0.72, dh = h * 0.72;
      if (i >= i0 && i < i0 + nd) {
        box(p, o.door, dx, y, z + d / 2 - cr, dw, dh, 0.004);
        box(p, o.col, dx, y, z + d / 2 - cr + 0.001, 0.0025, dh, 0.003);
        box(p, shade(o.col, 1.15), dx, y + dh * 0.52, z + d / 2 - cr + 0.001, dw * 0.96, 0.0025, 0.003);
      } else {
        // Traditional vertical mullion window (直棂窗) on flanking bays
        box(p, '#2f2018', dx, y + h * 0.28, z + d / 2 - cr, dw * 0.84, dh * 0.56, 0.0035);
        for (const mx of [-0.24, 0, 0.24]) box(p, o.col, dx + mx * dw, y + h * 0.28, z + d / 2 - cr + 0.001, 0.002, dh * 0.56, 0.0025);
      }
    }
  }
  let top = y + h;
  if (o.bracket) {
    const bk = Math.min(0.012, h * 0.16);
    for (let i = 0; i <= nW; i++) for (const sz of [-1, 1]) {
      box(p, shade(o.bracket, 0.78), x - w / 2 + (i * w) / nW, top, z + (sz * d) / 2, 0.008, bk * 0.5, 0.008);
      box(p, o.bracket, x - w / 2 + (i * w) / nW, top + bk * 0.45, z + (sz * d) / 2, 0.0125, bk * 0.55, 0.0125);
    }
    for (let i = 0; i <= nD; i++) for (const sx of [-1, 1]) {
      box(p, shade(o.bracket, 0.78), x + (sx * w) / 2, top, z - d / 2 + (i * d) / nD, 0.008, bk * 0.5, 0.008);
      box(p, o.bracket, x + (sx * w) / 2, top + bk * 0.45, z - d / 2 + (i * d) / nD, 0.0125, bk * 0.55, 0.0125);
    }
    box(p, shade(o.bracket, 0.85), x, top + bk * 0.25, z, w - 0.006, bk * 0.7, d - 0.006);
    top += bk;
  }
  return top;
}

/** Balustrade around a w×d edge (posts + top rail), leaving a gap of `gap` in the front for stairs. */
function rail(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, c: string, gap = 0, h = 0.018, sides = [true, true, true, true]): void {
  const post = (px: number, pz: number) => box(p, c, px, y, pz, 0.006, h, 0.006);
  const bar = (x0: number, x1: number, pz: number) => x1 - x0 > 0.01 && box(p, c, (x0 + x1) / 2, y + h - 0.006, pz, x1 - x0, 0.005, 0.005);
  const barZ = (px: number, z0: number, z1: number) => box(p, c, px, y + h - 0.006, (z0 + z1) / 2, 0.005, 0.005, z1 - z0);
  const nW = Math.max(3, Math.round(w / 0.05)), nD = Math.max(2, Math.round(d / 0.05));
  if (sides[0]) {
    for (let i = 0; i <= nW; i++) { const px = x - w / 2 + (i * w) / nW; if (Math.abs(px - x) >= gap / 2) post(px, z + d / 2); }
    bar(x - w / 2, x - gap / 2, z + d / 2); bar(x + gap / 2, x + w / 2, z + d / 2);
  }
  if (sides[2]) { for (let i = 0; i <= nW; i++) post(x - w / 2 + (i * w) / nW, z - d / 2); bar(x - w / 2, x + w / 2, z - d / 2); }
  for (const [si, sx] of [[1, 1], [3, -1]] as const) if (sides[si]) {
    for (let i = 1; i < nD; i++) post(x + (sx * w) / 2, z - d / 2 + (i * d) / nD);
    barZ(x + (sx * w) / 2, z - d / 2, z + d / 2);
  }
}

/** Solid staircase rising towards -z: bottom edge at zf on y0, top at y0+h after `run`. */
function steps(p: THREE.Object3D, x: number, y0: number, zf: number, w: number, h: number, run: number, c: string, n = 6): void {
  for (let i = 0; i < n; i++) box(p, i % 2 ? shade(c, 0.94) : c, x, y0, zf - (run * (i + 0.5)) / n, w, (h * (i + 1)) / n, run / n);
}

/** Sloping ramp (慢道) rising towards -z. */
function ramp(p: THREE.Object3D, x: number, y0: number, zf: number, w: number, h: number, run: number, c: string): void {
  tbox(p, w, run, w, 0.002, h, c, x, y0, zf - run / 2, 0, -run / 2 + 0.001);
}

/** Covered corridor (廊) from (x1,z1) to (x2,z2): posts both sides, optional back wall, gable roof. */
function corridor(p: THREE.Object3D, x1: number, z1: number, x2: number, z2: number, y: number, h: number, dep: number, roofC: string, colC: string, o: { wall?: string; rh?: number; ov?: number } = {}): number {
  const L = Math.hypot(x2 - x1, z2 - z1), gr = grp(p, (x1 + x2) / 2, (z1 + z2) / 2, -Math.atan2(z2 - z1, x2 - x1), y);
  const n = Math.max(1, Math.round(L / 0.04));
  for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) cyl(gr, colC, -L / 2 + (i * L) / n, 0, (sz * dep) / 2, 0.0035, h, 5);
  if (o.wall) box(gr, o.wall, 0, 0, 0, L, h, dep * 0.25);
  box(gr, colC, 0, h - 0.006, 0, L, 0.006, dep + 0.004);
  const rh = o.rh ?? dep * 0.45, ov = o.ov ?? 0.022;
  gable(gr, L + ov, rh, dep + ov * 1.6, roofC, 0, h, 0);
  box(gr, shade(roofC, 0.78), 0, h + rh - 0.004, 0, L + ov, 0.008, 0.008);
  return y + h + rh;
}

/** Open covered gallery (廊) running along z from z0 to z1: two rows of posts and a hip roof with the given options. */
function galleryZ(p: THREE.Object3D, x: number, y: number, z0: number, z1: number, dep: number, h: number, rise: number, col: string, o: RoofO, wall?: string): void {
  const L = Math.abs(z1 - z0), zm = (z0 + z1) / 2, n = Math.max(1, Math.round(L / 0.04));
  for (let i = 0; i <= n; i++) for (const sx of [-1, 1]) cyl(p, col, x + (sx * dep) / 2, y, Math.min(z0, z1) + (i * L) / n, 0.0035, h, 5);
  if (wall) box(p, wall, x, y, zm, dep * 0.25, h, L);
  for (const sx of [-1, 1]) box(p, col, x + (sx * dep) / 2, y + h - 0.006, zm, 0.007, 0.006, L);
  roof(grp(p, x, zm, Math.PI / 2, 0), 0, y + h, 0, L + 0.02, dep + 0.03, rise, o);
}

/**
 * A period figure about one storey (~3 m at diorama scale) tall in an ankle-length robe. Hand-held weapons are left out
 * on purpose: at this size a spear shaft would be a hairline.
 */
function figure(p: THREE.Object3D, x: number, y: number, z: number, h: number, robe: string, o: { hat?: HumanOpts['hatStyle']; hatC?: string; ry?: number; armor?: string; pose?: HumanOpts['pose']; phase?: number } = {}): void {
  human(p, x, y, z, {
    h, ry: o.ry ?? 0, pose: o.pose ?? 'stand', phase: o.phase ?? 0, top: robe, bottom: shade(robe, 0.8), skin: '#c49a76', hair: '#1d1915',
    hat: o.hatC ?? '#24211e', hatStyle: o.hat ?? 'knot', dress: 'ankle', shoes: '#2a2420', detail: 'hi',
    ...(o.armor ? { armor: o.armor, armorTrim: shade(o.armor, 0.7) } : {}),
  });
}

/** Free-standing ring of columns (a 副阶 / veranda) with nx × nz bays and a lintel ring on top. */
function colonnade(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, nx: number, nz: number, c: string, r = 0.004): void {
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) cyl(p, c, x - w / 2 + (i * w) / nx, y, z + (sz * d) / 2, r, h, 6);
  for (let j = 1; j < nz; j++) for (const sx of [-1, 1]) cyl(p, c, x + (sx * w) / 2, y, z - d / 2 + (j * d) / nz, r, h, 6);
  for (const sz of [-1, 1]) box(p, c, x, y + h - 0.006, z + (sz * d) / 2, w + 0.006, 0.006, 0.007);
  for (const sx of [-1, 1]) box(p, c, x + (sx * w) / 2, y + h - 0.006, z, 0.007, 0.006, d);
}

/** Straight run of balustrade along x from x0 to x1 at z (posts + rail), optional gilt post caps. */
function railRun(p: THREE.Object3D, x0: number, x1: number, y: number, z: number, c: string, cap?: string, h = 0.016): void {
  const n = Math.max(1, Math.round((x1 - x0) / 0.04));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    box(p, c, x, y, z, 0.006, h, 0.006);
    if (cap) box(p, cap, x, y + h, z, 0.008, 0.004, 0.008);
  }
  box(p, c, (x0 + x1) / 2, y + h - 0.006, z, x1 - x0, 0.005, 0.005);
}

// ---- builders ---------------------------------------------------------------------------------------------------


/**
 * 二里头一号宫殿 (c. 1700 BC; also stands for the Shang palaces of 偃师/郑州/殷墟): a ~108×100 m rammed-earth platform with
 * its NE corner cut back, ringed by thatched corridors (廊庑) with a three-passage south gate; the 8×3-bay hall (30.4×11.4 m)
 * on its own earth base at the north under a double-eaved thatched hip roof (四阿重屋). Walls are wattle-and-daub.
 * Refs: 中国社科院考古所《偃师二里头》(1999); 杨鸿勋《宫殿考古通论》 reconstruction; https://zh.wikipedia.org/wiki/二里头遗址
 */
const cap_erlitou: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.76);
  const E = '#9f8762', TOP = '#ad9671', TH = '#6e5d43', DAUB = '#b8a684', WD = '#46372a';
  const X0 = -0.42, X1 = 0.42, Z0 = -0.39, Z1 = 0.39, NX = 0.25, NZ = -0.27;
  const plan: [number, number][] = [[X0, Z1], [X1, Z1], [X1, NZ], [NX, NZ], [NX, Z0], [X0, Z0]];
  const inset = (k: number) => plan.map(([x, z]) => [x * k, z * k] as [number, number]);
  prism(gp, plan, y0, 0.011, shade(E, 0.9));
  prism(gp, inset(0.994), y0 + 0.011, 0.01, E);
  prism(gp, inset(0.99), y0 + 0.021, 0.002, TOP);
  const yp = y0 + 0.023;
  const th: RoofO = { tile: TH, thatch: true, k: 0.05, ridge: shade(TH, 0.78), under: '#5b4e38', fascia: shade(TH, 0.8), th: 0.01 };
  // 廊庑: an outer daub wall with a single row of posts on the court side, under a thatched roof
  const dep = 0.046, ch = 0.028, o = dep / 2 + 0.006;
  // ea/eb: how far the outer wall runs past each end (+ at outer corners, − at the inner corner of the notch, 0 at the gate)
  const range = (a: [number, number], b: [number, number], ea: number, eb: number) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = grp(gp, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), yp);
    box(g, DAUB, (eb - ea) / 2, 0, dep / 2 - 0.006, L + ea + eb, ch, 0.01);
    const n = Math.max(1, Math.round(L / 0.034));
    for (let i = 0; i <= n; i++) cyl(g, WD, -L / 2 + (i * L) / n, 0, -dep / 2 + 0.006, 0.0035, ch, 5);
    box(g, WD, 0, ch - 0.006, -dep / 2 + 0.006, L, 0.006, 0.007);
    const ra = Math.max(ea, 0) + 0.01, rb = Math.max(eb, 0) + 0.01;
    roof(g, (rb - ra) / 2, ch, 0, L + ra + rb, dep + 0.028, 0.026, th);
  };
  const gw = 0.19, cx = dep / 2, cc = -dep / 2 + 0.012;
  const inner: [number, number][] = [[X0 + o, Z1 - o], [X1 - o, Z1 - o], [X1 - o, NZ + o], [NX - o, NZ + o], [NX - o, Z0 + o], [X0 + o, Z0 + o]];
  range(inner[0], [-gw / 2, Z1 - o], cx, 0);
  range([gw / 2, Z1 - o], inner[1], 0, cx);
  range(inner[1], inner[2], cx, cx);
  range(inner[2], inner[3], cx, cc);
  range(inner[3], inner[4], cc, cx);
  range(inner[4], inner[5], cx, cx);
  range(inner[5], inner[0], cx, cx);
  // the south gate: three passages between daub piers (the outer two piers are the 塾 rooms)
  const gz = Z1 - o, gd = dep + 0.012, gh = ch + 0.008;
  for (const x of [-0.077, -0.025, 0.025, 0.077]) box(gp, DAUB, x, yp, gz, Math.abs(x) > 0.05 ? 0.036 : 0.016, gh, gd * 0.8);
  for (const x of [-0.095, -0.059, -0.025, 0.025, 0.059, 0.095]) for (const sz of [-1, 1]) cyl(gp, WD, x, yp, gz + (sz * gd) / 2, 0.004, gh, 5);
  box(gp, WD, 0, yp + gh - 0.006, gz, gw + 0.006, 0.006, gd + 0.006);
  roof(gp, 0, yp + gh, gz, gw + 0.045, gd + 0.04, 0.042, { ...th, k: 0.08 });
  steps(gp, 0, y0, Z1 + 0.035, 0.12, 0.023, 0.035, E, 3);
  // the hall (殿) on its own earth base, 8 × 3 bays, double-eaved thatched hip roof
  const hz = -0.2, yb = earth(gp, 0, yp, hz, 0.35, 0.2, 0.34, 0.19, 0.022, E, 2, TOP);
  const bw = 0.28, bd = 0.105, bh = 0.044;
  body(gp, 0, yb, hz, bw, bd, bh, { wall: DAUB, col: WD, beam: WD, sp: 0.035, cr: 0.0045, door: '#2b2219', doorN: 3 });
  roof(gp, 0, yb + bh, hz, bw + 0.06, bd + 0.06, 0.024, { ...th, inner: [bw - 0.05, bd - 0.03] });
  box(gp, DAUB, 0, yb + bh, hz, bw - 0.05, 0.036, bd - 0.03);
  roof(gp, 0, yb + bh + 0.036, hz, bw + 0.012, bd + 0.05, 0.085, { ...th, k: 0.1, th: 0.014 });
  for (const sx of [-1, 1]) steps(gp, sx * 0.07, yp, hz + 0.095 + 0.03, 0.04, 0.022, 0.03, E, 3);
  // court life: attendants in undyed hemp
  const robes = ['#6f604a', '#80705a', '#5d5040', '#74674f', '#685a46'];
  figure(gp, -0.03, yp, 0.27, 0.028, robes[0], { ry: Math.PI });
  figure(gp, 0.05, yp, 0.06, 0.028, robes[1], { pose: 'walk', phase: 0.3, ry: -2.6 });
  figure(gp, -0.12, yp, 0.0, 0.028, robes[2], { ry: 0.6 });
  figure(gp, 0.07, yb, hz + 0.075, 0.028, robes[3]);
  figure(gp, 0.03, y0, 0.425, 0.028, robes[4], { pose: 'walk', ry: Math.PI, phase: 0.6 });
  tree(gp, 0.33, y0, -0.37, 0.065, '#5f7340');
  tree(gp, 0.39, y0, -0.27, 0.05, '#66784a');
  tree(gp, -0.47, y0, 0.12, 0.055, '#5f7340');
};

/**
 * 岐山凤雏甲组建筑 (Western Zhou, c. 11th c. BC), the earliest known two-court 四合院: a 32.5×45.2 m rammed-earth platform
 * 1.3 m high — screen wall (影壁) before the gate and its two 塾 rooms, front court, the 6-bay front hall (前堂, 17.2×6.1 m)
 * with three stairs, a 过廊 to the rear rooms (后室) and full-length east/west wings. Thatched roofs, tiles only on ridges.
 * Refs: 陕西周原考古队《陕西岐山凤雏村西周建筑基址发掘简报》(文物1979.10); 傅熹年 reconstruction; https://zh.wikipedia.org/wiki/凤雏遗址
 */
const cap_zhou: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const L = '#a38b66', LT = '#b09a76', TH = '#75684f', RT = '#5c5f62', PL = '#cfc4a9', WD = '#4a3a2b', DOOR = '#2e261d';
  const s = 0.016, W = 32.5 * s, D = 45.2 * s, zc = -0.03, zs = zc + D / 2;
  const M = (m: number) => zs - m * s;
  const yp = earth(gp, 0, y0, zc, W + 0.01, D + 0.01, W, D, 0.022, L, 2, LT);
  /** 悬山 thatched roof with a tile-capped ridge; ridge along x (ry = 0) or z (ry = π/2). */
  const thatch = (x: number, y: number, z: number, len: number, dep: number, rise: number, ry = 0) => {
    gable(gp, len, rise, dep, TH, x, y, z, ry);
    box(gp, shade(TH, 0.78), x, y - 0.004, z, ry ? dep : len, 0.004, ry ? len : dep);
    box(gp, RT, x, y + rise - 0.006, z, ry ? 0.012 : len + 0.004, 0.009, ry ? len + 0.004 : 0.012);
  };
  const eh = 0.045, wx = W / 2;
  // east and west wings (厢房): rammed-earth outer wall, rooms, a veranda on the court side, eight doors each
  for (const sx of [-1, 1]) {
    box(gp, L, sx * (wx - 0.006), yp, zc, 0.012, eh, D);
    box(gp, PL, sx * (wx - 0.04), yp, zc, 0.056, eh, D - 0.01);
    for (let i = 0; i < 8; i++) box(gp, DOOR, sx * (wx - 0.068), yp, zs - 0.12 - (i * (D - 0.24)) / 7, 0.004, 0.03, 0.02);
    const n = 16;
    for (let i = 0; i <= n; i++) cyl(gp, WD, sx * (wx - 0.09), yp, zs - 0.005 - (i * (D - 0.01)) / n, 0.0035, eh, 5);
    box(gp, WD, sx * (wx - 0.09), yp + eh - 0.006, zc, 0.007, 0.006, D - 0.01);
    thatch(sx * (wx - 0.048), yp + eh, zc, D + 0.02, 0.112, 0.042, Math.PI / 2);
  }
  // south range: the gate passage (门道, 3 m) between the two 塾 rooms, one roof over all
  const gz = M(3), iw = wx - 0.096;
  for (const sx of [-1, 1]) {
    box(gp, PL, sx * (0.024 + (iw - 0.024) / 2), yp, gz, iw - 0.024, eh, 0.07);
    box(gp, DOOR, sx * 0.06, yp, gz - 0.036, 0.022, 0.03, 0.004);
  }
  for (let i = 0; i <= 7; i++) for (const sz of [-1, 1]) cyl(gp, WD, -iw + (i * 2 * iw) / 7, yp, gz + sz * 0.042, 0.0035, eh, 5);
  thatch(0, yp + eh, gz, 2 * iw + 0.02, 0.118, 0.044);
  steps(gp, 0, y0, zs + 0.032, 0.05, 0.022, 0.032, L, 3);
  // the screen wall (影壁) 4 m in front of the gate: lime-plastered rammed earth with a small thatched coping
  earth(gp, 0, y0, zs + 0.072, 0.08, 0.02, 0.077, 0.018, 0.034, PL, 1, PL);
  gable(gp, 0.088, 0.012, 0.032, TH, 0, y0 + 0.034, zs + 0.072);
  // the front hall (前堂): 6 × 3 bays with a veranda all round, on a slightly raised base; three stairs in front
  const hz = M(23), yh = yp + 0.012;
  earth(gp, 0, yp, hz, 0.322, 0.15, 0.316, 0.144, 0.012, L, 1, LT);
  box(gp, PL, 0, yh, hz, 0.262, eh + 0.008, 0.088);
  for (let i = 0; i < 6; i++) if (i === 2 || i === 3) box(gp, DOOR, -0.131 + (i + 0.5) * 0.0437, yh, hz + 0.045, 0.026, 0.036, 0.004);
  colonnade(gp, 0, yh, hz, 0.296, 0.126, eh + 0.008, 6, 3, WD, 0.004);
  roof(gp, 0, yh + eh + 0.008, hz, 0.352, 0.182, 0.088, { tile: TH, thatch: true, k: 0.08, ridge: RT, under: '#5b4e38', fascia: shade(TH, 0.8), th: 0.012 });
  for (const x of [-0.09, 0, 0.09]) steps(gp, x, yp, hz + 0.075 + 0.018, 0.03, 0.012, 0.018, L, 2);
  // 过廊 to the rear range and the rear rooms (后室) along the north edge
  const rz = M(42.1);
  corridor(gp, 0, hz - 0.075, 0, rz + 0.04, yp, eh - 0.004, 0.048, TH, WD, { rh: 0.03, ov: 0.016 });
  box(gp, PL, 0, yp, rz, 2 * iw, eh, 0.07);
  for (let i = 0; i < 5; i++) box(gp, DOOR, -iw + 0.03 + (i * (2 * iw - 0.06)) / 4, yp, rz + 0.036, 0.022, 0.03, 0.004);
  for (let i = 0; i <= 8; i++) cyl(gp, WD, -iw + (i * 2 * iw) / 8, yp, rz + 0.046, 0.0035, eh, 5);
  thatch(0, yp + eh, rz - 0.004, 2 * iw + 0.02, 0.118, 0.044);
  // people in Zhou robes and topknots
  figure(gp, 0.06, y0, zs + 0.05, 0.03, '#5b4c3c', { pose: 'walk', ry: Math.PI, phase: 0.2 });
  figure(gp, -0.02, yp, gz - 0.07, 0.03, '#3f3832', { ry: 0.3 });
  figure(gp, 0.07, yp, M(13), 0.03, '#6e604c', { ry: -0.8 });
  figure(gp, -0.08, yp, M(15), 0.03, '#7a6b55', { pose: 'walk', ry: Math.PI * 0.9, phase: 0.55 });
  figure(gp, 0.03, yh, hz + 0.07, 0.03, '#4a3f34');
  tree(gp, -0.36, y0, 0.2, 0.07, '#5f7340');
  tree(gp, 0.37, y0, -0.12, 0.075, '#66784a');
  tree(gp, -0.35, y0, -0.3, 0.065, '#5a6e44');
};

/**
 * Han que (阙) after the surviving stone 高颐阙 (209, Ya'an; Commons "Gaoyi Que(Front).jpg", "Gao Yi Que3.jpg"): a plain
 * shaft on a low base, a corbelled zone of stacked courses with 斗拱 blocks spreading outwards, a deep hip roof, and the
 * lower 子阙 on the outer side. Palace que were plastered rammed earth with timber brackets: buff shaft, dark courses,
 * a red-painted frieze. sx = outer side.
 */
function que(p: THREE.Object3D, x: number, y: number, z: number, sx: number, tile: string, s = 1): void {
  const SH = '#b3a68b', BAND = '#3d3530', RED = '#8a3a2c', rt: RoofO = { tile, k: 0.12, lift: 0.04, ridge: shade(tile, 0.7) };
  const tower = (cx: number, w: number, d: number, h: number, rise: number) => {
    box(p, shade(SH, 0.84), cx, y, z, w * 1.22, 0.012 * s, d * 1.22);
    earth(p, cx, y + 0.012 * s, z, w * 1.06, d * 1.06, w, d, h, SH, 1, SH);
    let yy = y + 0.012 * s + h;
    box(p, BAND, cx, yy, z, w + 0.006 * s, 0.008 * s, d + 0.006 * s);
    yy += 0.008 * s;
    // two corbelled tiers, each a red frieze set with dark bracket blocks, stepping outwards under the roof
    for (const [ow, fh] of [[0.012, 0.015], [0.034, 0.014]]) {
      const fw = w + ow * s, fd = d + ow * s, hh = fh * s, n = Math.max(2, Math.round(fw / (0.026 * s)));
      box(p, RED, cx, yy, z, fw, hh, fd);
      for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) box(p, BAND, cx - fw / 2 + 0.005 * s + (i * (fw - 0.01 * s)) / n, yy + 0.003 * s, z + (sz * fd) / 2, 0.008 * s, hh - 0.003 * s, 0.006 * s);
      for (const sxx of [-1, 1]) box(p, BAND, cx + (sxx * fw) / 2, yy + 0.003 * s, z, 0.006 * s, hh - 0.003 * s, 0.008 * s);
      yy += hh;
      box(p, BAND, cx, yy, z, fw + 0.012 * s, 0.007 * s, fd + 0.012 * s);
      yy += 0.007 * s;
    }
    roof(p, cx, yy, z, w + 0.075 * s, d + 0.07 * s, rise, rt);
  };
  const qw = 0.07 * s, qd = 0.052 * s, sw = 0.042 * s;
  tower(x + sx * (qw / 2 + sw / 2 + 0.002 * s), sw, qd * 0.8, 0.075 * s, 0.022 * s);
  tower(x, qw, qd, 0.16 * s, 0.038 * s);
}

/**
 * 西汉长安未央宫前殿 (200 BC): a rammed-earth terrace about 350 m north–south by 200 m east–west, rising northwards in
 * three great steps on the 龙首原 — a gate hall and side halls on the lowest, a hall on the middle step reached by the paired
 * 左墄右平 stairs (stepped east, ramped west), and the front hall on the highest step: a long hall wrapped by a gallery under
 * a grey tile hip roof with straight eaves and no ridge finials yet, white-plastered walls and red posts. A pair of 阙 in the
 * 高颐阙 form stands before the approach. Refs: 中国社科院考古所《汉长安城未央宫：1980–1989年考古发掘报告》(1996);
 * 刘庆柱、李毓芳《汉长安城》(2003); the 未央宫国家考古遗址公园 que replicas (Commons "WeiYang Palace - 54082522066.jpg").
 */
const cap_qinhan: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 1);
  const tile = '#4a4d52', PL = '#d3cab6', TOP = '#a99372', RED = '#8e3a2c', BLK = '#3a3430', E = '#9a7f5c', SC = '#ab9878', ZB = -0.325;
  // three steps rising north, each back-aligned; the terrace is longer north–south than wide, as excavated
  const T: [number, number, number][] = [[0.56, 0.22, 0.035], [0.5, 0.05, 0.04], [0.44, -0.1, 0.045]];
  const tops: number[] = [];
  let y = y0;
  for (const [w, zf, h] of T) {
    const d = zf - ZB, z = (zf + ZB) / 2;
    y = earth(gp, 0, y, z, w + 0.012, d + 0.012, w, d, h, E, 3, TOP);
    tops.push(y);
  }
  // lowest step: the hall gate (殿门) and two side halls
  const g1 = body(gp, 0, tops[0], 0.155, 0.13, 0.055, 0.04, { wall: PL, col: RED, beam: BLK, sp: 0.033, cr: 0.004, door: '#2e2a28', doorN: 3 });
  roof(gp, 0, g1, 0.155, 0.175, 0.1, 0.042, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  for (const sx of [-1, 1]) {
    const e = body(gp, sx * 0.19, tops[0], 0.135, 0.1, 0.055, 0.038, { wall: PL, col: RED, beam: BLK, sp: 0.033, cr: 0.004 });
    roof(gp, sx * 0.19, e, 0.135, 0.14, 0.1, 0.04, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  }
  // middle step: a hall, with the east stairs (墄) and the west ramp (平) running up beside it
  const mz = -0.025;
  const e2 = body(gp, 0, tops[1], mz, 0.2, 0.065, 0.046, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0045, door: '#2e2a28', doorN: 3 });
  roof(gp, 0, e2, mz, 0.26, 0.12, 0.055, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  steps(gp, 0, tops[0], 0.05 + 0.045, 0.06, tops[1] - tops[0], 0.045, SC, 5);
  for (const sx of [-1, 1]) {
    const x = sx * 0.175;
    if (sx > 0) steps(gp, x, tops[1], -0.1 + 0.06, 0.045, tops[2] - tops[1], 0.06, SC, 6);
    else ramp(gp, x, tops[1], -0.1 + 0.06, 0.045, tops[2] - tops[1], 0.06, SC);
  }
  // the front hall on the top step, wrapped by a gallery
  const hz = -0.215;
  rbox(gp, TOP, 0, tops[2], hz, 0.42, 0.008, 0.19, 0.003);
  const yh = tops[2] + 0.008;
  const et = body(gp, 0, yh, hz, 0.34, 0.11, 0.08, { wall: PL, col: RED, beam: BLK, bracket: BLK, sp: 0.034, cr: 0.0058, door: '#2e2a28', doorN: 5 });
  colonnade(gp, 0, yh, hz, 0.38, 0.15, 0.045, 11, 4, RED, 0.0045);
  roof(gp, 0, yh + 0.045, hz, 0.41, 0.18, 0.016, { tile, inner: [0.34, 0.11], k: 0.06, lift: 0.03 });
  roof(gp, 0, et, hz, 0.43, 0.2, 0.1, { tile, k: 0.15, lift: 0.05, ridge: shade(tile, 0.72) });
  // the paired que before the approach and Han officials
  for (const sx of [-1, 1]) que(gp, sx * 0.165, y0, 0.33, sx, tile, 0.62);
  steps(gp, 0, y0, 0.22 + 0.05, 0.08, tops[0] - y0, 0.05, SC, 5);
  for (const sx of [-1, 1]) figure(gp, sx * 0.07, y0, 0.34, 0.028, '#5a2a24', { armor: '#4a4540' });
  figure(gp, -0.03, y0, 0.39, 0.028, '#2f2a2e', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.3 });
  figure(gp, 0.06, tops[0], 0.085, 0.028, '#6a3a30', { hat: 'cap', pose: 'walk', ry: Math.PI * 0.9, phase: 0.6 });
  figure(gp, -0.08, tops[1], 0.03, 0.028, '#3a3040', { hat: 'cap', ry: 0.3 });
  tree(gp, -0.33, y0, 0.25, 0.06, '#66784a');
  tree(gp, 0.36, y0, 0.2, 0.055, '#5f7340');
};


/** Tang pavilion (阁) on a brick pier with two stepped-down 子阙 on the outer side (三出阙); sx = outer side. */
function tangQue(p: THREE.Object3D, x: number, y: number, z: number, sx: number, tile: string, edge: string, base: string): void {
  const h = 0.14, red = '#8e3a2c', pl = '#e2dccb', rl = '#bdb7aa';
  tbox(p, 0.12, 0.12, 0.11, 0.11, h, base, x, y, z);
  box(p, shade(base, 1.12), x, y + h - 0.004, z, 0.112, 0.004, 0.112);
  rail(p, x, y + h, z, 0.104, 0.104, rl, 0, 0.012);
  const et = body(p, x, y + h, z, 0.075, 0.075, 0.042, { wall: pl, col: red, bracket: '#7a4a32', sp: 0.025, cr: 0.004 });
  const mid = roof(p, x, et - 0.012, z, 0.115, 0.115, 0.022, { tile, edge, inner: [0.06, 0.06], k: 0.3, lift: 0.3 });
  const et2 = body(p, x, mid - 0.004, z, 0.058, 0.058, 0.03, { wall: pl, col: red, sp: 0.03, cr: 0.0035 });
  roof(p, x, et2, z, 0.105, 0.105, 0.05, { tile, edge, k: 0.32, lift: 0.3, chi: '#34473c', chiH: 0.016, ridge: shade(tile, 0.75) });
  for (let i = 1; i <= 2; i++) {
    const xx = x + sx * (0.06 + i * 0.03), hh = h - i * 0.03, dd = 0.1 - i * 0.012;
    tbox(p, 0.035, dd, 0.03, dd - 0.01, hh, base, xx, y, z + i * 0.004);
    roof(p, xx, y + hh, z + i * 0.004, 0.05, dd + 0.02, 0.016, { tile, edge, k: 0.3, lift: 0.25, ridge: null });
  }
}

/**
 * 唐大明宫含元殿 (663): an 11-bay hall wrapped by a 副阶 (13 bays, base 75.9×41.3 m) under a double-eaved hip roof — dark
 * grey tile with green-glazed edging (剪边) and 鸱尾 — white walls, red columns; on a three-tier brick-faced 大台. The 龙尾道
 * climb in stages on both sides of the front (1995–96 excavation), and the 翔鸾阁 / 栖凤阁 stand forward on 三出阙 piers,
 * joined to the terrace by corridors on walls. Refs: 傅熹年《对含元殿遗址及原状的再探讨》(文物1998.4); 《唐大明宫含元殿遗址
 * 1995—1996年发掘报告》(考古学报1997.3); 杨鸿勋《大明宫》.
 */
const cap_tang: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.82);
  const tile = '#4c5056', edge = '#4a6e5a', BR = '#827c72', BRT = '#99938a', PL = '#e2dccb', RED = '#8e3a2c', ST = '#bdb7aa';
  // three-tier brick-faced platform (大台)
  const tier = (y: number, w: number, d: number, h: number, z: number) => {
    earth(gp, 0, y, z, w + 0.008, d + 0.008, w, d, h, BR, Math.max(1, Math.round(h / 0.012)), BRT);
    return y + h;
  };
  const y1 = tier(y0, 0.7, 0.4, 0.05, -0.18), y2 = tier(y1, 0.56, 0.31, 0.035, -0.205), y3 = tier(y2, 0.5, 0.235, 0.02, -0.2225);
  // balustrades along the tier fronts, open where the stairs arrive
  for (const [a, b] of [[-0.345, -0.23], [-0.17, 0.17], [0.23, 0.345]]) railRun(gp, a, b, y1, 0.016, ST, undefined, 0.014);
  for (const [a, b] of [[-0.275, -0.145], [-0.095, 0.095], [0.145, 0.275]]) railRun(gp, a, b, y2, -0.054, ST, undefined, 0.014);
  // 龙尾道: two long ramps in front, each in two flights with a landing, then stairs up the upper tiers
  for (const sx of [-1, 1]) {
    const x = sx * 0.2, w = 0.05;
    ramp(gp, x, y0, 0.27, w, 0.025, 0.12, ST);
    box(gp, BR, x, y0, 0.12, w + 0.012, 0.025, 0.06);
    box(gp, ST, x, y0 + 0.025, 0.12, w, 0.002, 0.06);
    box(gp, BR, x, y0, 0.055, w + 0.012, 0.025, 0.07);
    ramp(gp, x, y0 + 0.025, 0.09, w, 0.025, 0.07, ST);
    for (const s of [-1, 1]) {
      const px = x + s * (w / 2 + 0.003);
      box(gp, BR, px, y0, 0.21, 0.006, 0.006, 0.12);
      ramp(gp, px, y0 + 0.006, 0.27, 0.006, 0.025, 0.12, BRT);
      box(gp, BRT, px, y0 + 0.025, 0.12, 0.006, 0.008, 0.06);
      box(gp, BR, px, y0, 0.055, 0.006, 0.033, 0.07);
      ramp(gp, px, y0 + 0.033, 0.09, 0.006, 0.025, 0.07, BRT);
    }
    steps(gp, x, y1, 0.0, 0.05, y2 - y1, 0.05, ST, 4);
    steps(gp, sx * 0.12, y2, -0.054, 0.04, y3 - y2, 0.05, ST, 3);
  }
  // the hall: 11 × 4 bays inside, a 13 × 6 bay 副阶 colonnade round it, double-eaved hip roof
  const hz = -0.225, bw = 0.4, bd = 0.15, bh = 0.1;
  const et = body(gp, 0, y3, hz, bw, bd, bh, { wall: PL, col: RED, bracket: '#7a4a32', beam: RED, sp: bw / 11, cr: 0.0055 });
  for (let i = 0; i < 11; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / 11);
    if (Math.abs(i - 5) <= 3) box(gp, '#7a3026', x, y3, hz + bd / 2 - 0.002, 0.026, 0.068, 0.004);
    else box(gp, '#4a4640', x, y3 + 0.036, hz + bd / 2 - 0.002, 0.024, 0.03, 0.004);
  }
  colonnade(gp, 0, y3, hz, 0.46, 0.205, 0.052, 13, 6, RED, 0.0048);
  roof(gp, 0, y3 + 0.052, hz, 0.5, 0.245, 0.024, { tile, edge, inner: [bw, bd], k: 0.2, lift: 0.25 });
  roof(gp, 0, et, hz, 0.5, 0.25, 0.112, { tile, edge, k: 0.3, lift: 0.25, chi: '#34473c', chiH: 0.032, ridge: shade(tile, 0.75) });
  // 翔鸾阁 (east) and 栖凤阁 (west) with the corridors on walls back to the terrace
  for (const sx of [-1, 1]) {
    const qx = sx * 0.3, qz = 0.2;
    tangQue(gp, qx, y0, qz, sx, tile, edge, BR);
    earth(gp, qx, y0, 0.08, 0.044, 0.12, 0.04, 0.12, 0.05, BR, 4, BRT);
    corridor(gp, qx, 0.14, qx, -0.2, y1, 0.032, 0.04, tile, RED, { wall: PL });
  }
  // officials in rank colours (purple, red, green) and guards with plumed helmets
  figure(gp, -0.05, y0, 0.33, 0.026, '#5a4762', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.2 });
  figure(gp, 0.03, y0, 0.36, 0.026, '#8a4034', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.7 });
  figure(gp, 0.08, y0, 0.3, 0.026, '#566a50', { hat: 'cap', ry: -2.8 });
  for (const sx of [-1, 1]) for (const dx of [-0.04, 0.04]) figure(gp, sx * 0.2 + dx, y0, 0.3, 0.026, '#7a3a30', { hat: 'plume', hatC: '#5a5650', armor: '#6b6258' });
};

/** A red-crowned crane, standing (wings folded) or flying; faces +x when ry = 0. */
function crane(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, fly = false): void {
  const c = grp(p, x, z, ry, y);
  ellip(c, '#ece9e1', 0, s * 0.55, 0, s * 0.32, s * 0.2, s * 0.17);
  ellip(c, '#1e1c1c', -s * 0.3, s * 0.52, 0, s * 0.16, s * 0.1, s * 0.12);
  rod(c, [s * 0.22, s * 0.6, 0], [s * (fly ? 0.62 : 0.32), s * (fly ? 0.62 : 1.05), 0], s * 0.045, '#ece9e1', 4);
  ellip(c, '#a8241e', s * (fly ? 0.66 : 0.34), s * (fly ? 0.64 : 1.09), 0, s * 0.06);
  if (fly) {
    for (const sz of [-1, 1]) {
      const wing = slab(grp(c, 0, 0, 0, s * 0.6), [[-0.1 * s, 0], [0.18 * s, 0], [0.05 * s, 0.75 * s], [-0.22 * s, 0.7 * s]], s * 0.04, '#ece9e1', 0, false);
      wing.rotation.x = sz * (Math.PI / 2 - 0.25);
    }
    rod(c, [-s * 0.2, s * 0.55, 0], [-s * 0.62, s * 0.5, 0], s * 0.03, '#2a2420', 3);
  } else for (const sz of [-1, 1]) rod(c, [0, s * 0.4, sz * s * 0.06], [0, 0, sz * s * 0.06], s * 0.025, '#2a2420', 3);
}

/**
 * 北宋东京宣德门 (宣德楼) as painted in 赵佶《瑞鹤图》(1112) and described in 《东京梦华录》 ("门皆金钉朱漆，壁皆砖石间甃…
 * 覆以琉璃瓦…曲尺朵楼，朱栏彩槛，下列两阙亭相对"): a 凹-shaped brick-and-stone 墩台 with three trapezoidal gateways (five
 * only after 1118), the 7-bay gate tower under a single-eave hip roof of grey tile with dark green glazed ridges and edges,
 * strongly upswept corners and 鸱吻 on which two cranes perch, side 朵楼, corridors forward to the 阙亭.
 * Refs: 瑞鹤图 (辽宁省博物馆, https://commons.wikimedia.org/wiki/File:瑞鹤图（亮版）.jpg); 傅熹年《中国古代建筑史·宋辽金》.
 */
const cap_song: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.92);
  const tile = '#484c50', glaze = '#3d5e4f', wall = '#948b7d', RED = '#923a2d', DOOR = '#7f2c23', PL = '#e2dccb', BK = '#4f7068', bh = 0.12;
  // 凹-shaped platform: main block and two forward wings, brick and stone courses
  const mz = -0.12, md = 0.2;
  const MW = 0.76, OX = 0.305, WZ = 0.105, QZ = 0.22;
  earth(gp, 0, y0, mz, MW + 0.02, md + 0.012, MW, md, bh, wall, 6, shade(wall, 1.06));
  for (const sx of [-1, 1]) earth(gp, sx * OX, y0, WZ, 0.16, 0.33, 0.15, 0.32, bh, wall, 6, shade(wall, 1.06));
  // three trapezoidal gateways with red, gold-studded doors
  const fz = mz + md / 2 + 0.003;
  for (const x of [-0.12, 0, 0.12]) {
    const w = x ? 0.05 : 0.062, h = x ? 0.07 : 0.082;
    slab(grp(gp, x, fz, 0, y0), [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.78], [w * 0.28, h], [-w * 0.28, h], [-w / 2, h * 0.78]], 0.008, '#2e2620', 0, false);
    for (const s of [-1, 1]) box(gp, DOOR, x + (s * w) / 4.4, y0, fz + 0.003, w * 0.42, h * 0.74, 0.004);
    for (let r = 0; r < 3; r++) box(gp, '#a88a4a', x, y0 + h * (0.18 + r * 0.2), fz + 0.0055, w * 0.8, 0.003, 0.002);
  }
  const yt = y0 + bh;
  rail(gp, 0, yt, mz, MW - 0.01, md - 0.01, RED, 0, 0.016, [false, true, true, true]);
  railRun(gp, -(OX - 0.075), OX - 0.075, yt, mz + md / 2 - 0.004, RED);
  for (const sx of [-1, 1]) rail(gp, sx * OX, yt, WZ, 0.14, 0.31, RED, 0, 0.016, [true, sx < 0, false, sx > 0]);
  // the 7-bay gate tower (门楼): red columns, white walls with red lattice doors, blue-green painted brackets
  const et = body(gp, 0, yt, mz, 0.4, 0.13, 0.072, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.06, cr: 0.0055, door: DOOR, doorN: 5 });
  const top = roof(gp, 0, et, mz, 0.52, 0.25, 0.11, { tile, edge: glaze, ridge: glaze, k: 0.5, lift: 0.6, chi: glaze, chiH: 0.036 });
  const rl = 0.52 - 0.25 + 0.008;
  for (const sx of [-1, 1]) crane(gp, sx * (rl / 2 + 0.002), top + 0.03, mz, 0.045, sx > 0 ? Math.PI : 0);
  // 曲尺朵楼 at both ends, corridors forward along the wings, and the 阙亭 at their front corners
  for (const sx of [-1, 1]) {
    const ox = sx * OX;
    const e2 = body(gp, ox, yt, mz, 0.11, 0.11, 0.05, { wall: PL, col: RED, bracket: BK, sp: 0.036, cr: 0.0045 });
    roof(gp, ox, e2, mz, 0.17, 0.16, 0.075, { tile, edge: glaze, ridge: glaze, k: 0.45, lift: 0.6, xie: 0.55 });
    galleryZ(gp, ox, yt, mz + 0.07, QZ - 0.05, 0.05, 0.04, 0.026, RED, { tile, edge: glaze, k: 0.4, lift: 0.3, ridge: glaze }, PL);
    const qz = QZ;
    const e3 = body(gp, ox, yt, qz, 0.1, 0.1, 0.05, { wall: PL, col: RED, bracket: BK, sp: 0.033, cr: 0.0045 });
    const m = roof(gp, ox, e3 - 0.004, qz, 0.15, 0.15, 0.02, { tile, edge: glaze, inner: [0.07, 0.07], k: 0.4, lift: 0.6 });
    const e4 = body(gp, ox, m, qz, 0.07, 0.07, 0.035, { wall: PL, col: RED, sp: 0.035, cr: 0.0038 });
    roof(gp, ox, e4, qz, 0.13, 0.13, 0.06, { tile, edge: glaze, k: 0.45, lift: 0.6, ridge: glaze, chi: glaze, chiH: 0.018 });
  }
  // the auspicious cranes of 1112 circling over the gate
  for (const [x, y, z, ry] of [[-0.2, 0.33, -0.07, 0.4], [0.07, 0.36, -0.15, -0.3], [0.24, 0.31, -0.03, Math.PI - 0.5]] as const) crane(gp, x, y, z, 0.04, ry, true);
  // palace guards and officials on the 御街
  for (const x of [-0.165, -0.075, 0.075, 0.165]) figure(gp, x, y0, 0.03, 0.026, '#8a3a30', { hat: 'plume', hatC: '#4f4b45', armor: '#6b6258' });
  figure(gp, -0.04, y0, 0.22, 0.026, '#5a4762', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.3 });
  figure(gp, 0.05, y0, 0.31, 0.026, '#566a50', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.8 });
};

/** Mongol ger / ordo tent: white felt walls and dome bound with dark bands, a gilt crown and a red door. */
function ger(p: THREE.Object3D, x: number, y: number, z: number, r: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y), gold = '#b8954a';
  lathe(g0, [[0, 0], [r, 0], [r, r * 0.55], [r * 0.98, r * 0.6], [0, r * 0.6]], '#e6e0d2', 0, 0, 0, 16);
  lathe(g0, [[r * 1.02, r * 0.58], [r * 0.7, r * 0.82], [r * 0.3, r * 0.98], [0, r * 1.02]], '#ebe6da', 0, 0, 0, 16);
  for (const yy of [0.18, 0.42]) lathe(g0, [[r * 1.005, r * yy], [r * 1.005, r * (yy + 0.05)]], '#5a5048', 0, 0, 0, 16);
  lathe(g0, [[r * 0.99, r * 0.54], [r * 1.0, r * 0.6]], gold, 0, 0, 0, 16);
  lathe(g0, [[0, r * 0.98], [r * 0.28, r * 0.98], [r * 0.2, r * 1.12], [0, r * 1.18]], gold, 0, 0, 0, 10);
  ellip(g0, gold, 0, r * 1.26, 0, r * 0.1);
  box(g0, '#8a3a2c', 0, 0, r * 0.97, r * 0.42, r * 0.46, 0.006);
  box(g0, gold, 0, r * 0.46, r * 0.98, r * 0.5, r * 0.05, 0.006);
}

/**
 * 元大都大明殿 (1273) per 陶宗仪《南村辍耕录》卷21〈宫阙制度〉: the 11-bay front hall (200×120 尺, 90 尺 high) joined by a 7-bay
 * 柱廊 (240×44 尺) to the 5-bay 寝室 with its east/west 夹 (140×50 尺) — a 工-shaped plan on a two-tier white-stone terrace
 * with "重陛朱阑，涂金冒楯" (red balustrades with gilt caps), 丹楹 red columns, 彤壁 red walls, 朱琐窗, and "檐脊皆饰琉璃瓦"
 * (glazed tile on eaves and ridges over grey tile). A white felt ordo (斡耳朵) stands beside it.
 * Refs: 辍耕录 卷21; 朱偰《元大都宫殿图考》(1936); 傅熹年《元大都大内宫殿的复原研究》.
 */
const cap_yuan: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 1);
  const tile = '#585c61', glaze = '#3b6763', m = '#d9d4c6', ms = shade(m, 0.93), RED = '#8a2f25', WALL = '#9a4636', RAIL = '#9a3a2c', GOLD = '#b8954a', BK = '#4c6b66';
  // 工-shaped two-tier terrace: front block, waist under the corridor, rear block
  const tierI = (y: number, h: number, c: string, k: number) => {
    rbox(gp, c, 0, y, 0.205 - k / 2, 0.46 - 2 * k, h, 0.27 - k, 0.003);
    rbox(gp, c, 0, y, -0.08, 0.12 - 2 * k, h, 0.32, 0.003);
    rbox(gp, c, 0, y, -0.295 + k / 2, 0.4 - 2 * k, h, 0.13 - k, 0.003);
    return y + h;
  };
  const y1 = tierI(y0, 0.03, m, 0), y2 = tierI(y1, 0.025, ms, 0.02);
  railRun(gp, -0.225, -0.05, y1, 0.336, RAIL, GOLD);
  railRun(gp, 0.05, 0.225, y1, 0.336, RAIL, GOLD);
  railRun(gp, -0.205, -0.04, y2, 0.316, RAIL, GOLD);
  railRun(gp, 0.04, 0.205, y2, 0.316, RAIL, GOLD);
  steps(gp, 0, y0, 0.4, 0.09, y1 - y0, 0.06, m, 4);
  steps(gp, 0, y1, 0.336, 0.07, y2 - y1, 0.02, ms, 3);
  // 大明殿: 11 bays inside a 13-bay 副阶, double-eaved hip roof
  const hz = 0.2, bw = 0.27, bd = 0.13, bh = 0.075;
  const et = body(gp, 0, y2, hz, bw, bd, bh, { wall: WALL, col: RED, beam: RED, bracket: BK, sp: bw / 11, cr: 0.005 });
  for (let i = 0; i < 11; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / 11);
    if (Math.abs(i - 5) <= 2) box(gp, '#6e2219', x, y2, hz + bd / 2 - 0.002, 0.018, 0.052, 0.004);
    else box(gp, '#7a2a20', x, y2 + 0.026, hz + bd / 2 - 0.002, 0.017, 0.026, 0.004);
  }
  colonnade(gp, 0, y2, hz, 0.3, 0.16, 0.04, 13, 6, RED, 0.0045);
  roof(gp, 0, y2 + 0.04, hz, 0.335, 0.195, 0.02, { tile, edge: glaze, inner: [bw, bd], k: 0.25, lift: 0.3 });
  roof(gp, 0, et, hz, 0.33, 0.19, 0.075, { tile, edge: glaze, k: 0.35, lift: 0.3, ridge: glaze, chi: glaze, chiH: 0.024 });
  // 柱廊 (open pillared corridor) and the 寝室 with its east/west 夹
  const bz = -0.29;
  galleryZ(gp, 0, y2, hz - 0.08, bz + 0.035, 0.062, 0.045, 0.03, RED, { tile, edge: glaze, k: 0.35, lift: 0.2, ridge: glaze });
  const e2 = body(gp, 0, y2, bz, 0.2, 0.075, 0.06, { wall: WALL, col: RED, beam: RED, bracket: BK, sp: 0.04, cr: 0.0045, door: '#6e2219', doorN: 3 });
  roof(gp, 0, e2, bz, 0.25, 0.125, 0.058, { tile, edge: glaze, k: 0.35, lift: 0.3, ridge: glaze, chi: glaze, chiH: 0.018 });
  for (const sx of [-1, 1]) {
    const e3 = body(gp, sx * 0.14, y2, bz + 0.005, 0.07, 0.06, 0.045, { wall: WALL, col: RED, sp: 0.023, cr: 0.004 });
    roof(gp, sx * 0.14, e3, bz + 0.005, 0.1, 0.095, 0.04, { tile, edge: glaze, k: 0.35, lift: 0.3, ridge: glaze });
  }
  // the khan's ordo tent and Mongol guards in fur-brimmed hats
  ger(gp, -0.31, y0, -0.06, 0.06, 0.3);
  for (const x of [-0.13, -0.075, 0.075, 0.13]) figure(gp, x, y0, 0.39, 0.026, '#5f5242', { hat: 'fur', hatC: '#4a3a2c', armor: '#5e5850' });
  figure(gp, -0.3, y0, 0.08, 0.026, '#6b4a3a', { hat: 'fur', hatC: '#4a3a2c', pose: 'walk', ry: -1.2, phase: 0.4 });
};

// ---- per-capital kit ----------------------------------------------------------------------------------------------

/** Flat ribbon (river, moat, bank) of width w along a centre line, clipped to the plinth top. */
function ribbon(p: THREE.Object3D, pts: [number, number][], w: number, y: number, h: number, c: string): void {
  const L: [number, number][] = [], R: [number, number][] = [], dense: [number, number][] = [];
  pts.forEach(([x, z], i) => {
    if (!i) return void dense.push([x, z]);
    const [px, pz] = pts[i - 1], n = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 0.025));
    for (let k = 1; k <= n; k++) dense.push([px + ((x - px) * k) / n, pz + ((z - pz) * k) / n]);
  });
  pts = dense;
  const cl = (x: number, z: number): [number, number] => clip(x, z);
  pts.forEach(([x, z], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    L.push(cl(x + (nx * w) / 2, z + (nz * w) / 2));
    R.push(cl(x - (nx * w) / 2, z - (nz * w) / 2));
  });
  prism(p, [...L, ...R.reverse()], y, h, c);
}

/** Rounded, slightly irregular hill mound rx × rz, h high (vertex-coloured, darker towards the foot). */
function hill(p: THREE.Object3D, x: number, y: number, z: number, rx: number, rz: number, h: number, c: string): void {
  const N = 20, K = 6, M = tris(), ring: V3[][] = [];
  for (let i = 0; i < K; i++) {
    const t = i / K, r = Math.cos((t * Math.PI) / 2) ** 0.7, yy = y + h * Math.sin((t * Math.PI) / 2) ** 1.4, row: V3[] = [];
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2, n = 1 + (hash3(x + j, i, z) - 0.5) * 0.08;
      const [px, pz] = clip(x + Math.cos(a) * rx * r * n, z + Math.sin(a) * rz * r * n);
      row.push([px, yy + (i && (hash3(j, x, i) - 0.5) * h * 0.05), pz]);
    }
    ring.push(row);
  }
  const top: V3 = [x, y + h, z];
  for (let i = 0; i < K; i++) for (let j = 0; j < N; j++) {
    const j1 = (j + 1) % N, col = shade(c, 0.88 + (i / K) * 0.16 + (hash3(i, j, x) - 0.5) * 0.04);
    if (i < K - 1) { M.t(ring[i][j], ring[i + 1][j], ring[i + 1][j1], col); M.t(ring[i][j], ring[i + 1][j1], ring[i][j1], col); }
    else M.t(ring[i][j], top, ring[i][j1], col);
  }
  polyMesh(p, M.pos, M.col);
}

/** Thatched Shang hall on its own low rammed-earth base; ry turns the front (+z) to face the court. */
function shangHall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y), E = '#9f8762', TH = '#655440', WD = '#6b3a2c';
  earth(g0, 0, 0, 0, w + 0.032, d + 0.03, w + 0.026, d + 0.024, 0.014, E, 1, '#ad9671');
  // per the 乙二十 reconstruction: lime-washed daub walls, red-brown posts along a veranda, a deep steep thatch
  const et = body(g0, 0, 0.014, 0, w, d, 0.038, { wall: '#d0c6ac', col: WD, beam: WD, sp: 0.03, cr: 0.004, door: '#3a2a20', doorN: Math.max(1, Math.round(w / 0.1)) });
  roof(g0, 0, et, 0, w + 0.03, d + 0.032, Math.min(0.056, d * 0.7 + 0.016), { tile: TH, thatch: true, k: 0.05, ridge: shade(TH, 0.76), under: '#4f4232', fascia: shade(TH, 0.78), th: 0.013 });
  steps(g0, 0, 0, d / 2 + 0.03, 0.03, 0.014, 0.016, E, 2);
}

/**
 * 殷墟宫殿宗庙区 (Anyang, c. 1300–1046 BC): no city wall, the 洹河 bending round the north and east of the zone; the 甲 group
 * of single halls by the river, the 乙 group of long halls on rammed-earth bases round a court open to the south (乙二十
 * reconstruction), the 丙 group of small altar platforms with rows of sacrificial pits, and pit YH127 where 17,000 inscribed
 * oracle bones were stored. Walls of wattle and daub, thatched 四阿 roofs, posts on stone footings.
 * Refs: 石璋如《小屯·殷墟建筑遗存》(1959); 中国社科院考古所《殷墟的发现与研究》(2001); 殷墟宫殿宗庙遗址 reconstruction.
 */
const cap_yinxu: Builder = root => {
  const [gp, y0] = site(root, SITE.meadow, 0.88);
  const E = '#9f8762', BANK = '#8a7a5c', WATER = '#5f7268', BONE = '#d2c6a8', PIT = '#4a3d2e';
  // 洹河: an arc round the back and the east side
  const arc: [number, number][] = [];
  for (let i = 0; i <= 28; i++) { const a = (125 - (145 * i) / 28) * (Math.PI / 180); arc.push([-0.15 + 0.52 * Math.cos(a), 0.17 - 0.52 * Math.sin(a)]); }
  ribbon(gp, arc, 0.11, y0, 0.0015, BANK);
  ribbon(gp, arc, 0.07, y0, 0.003, WATER);
  // 甲 group: free-standing halls by the river
  shangHall(gp, -0.25, y0, -0.265, 0.15, 0.04);
  shangHall(gp, 0.0, y0, -0.255, 0.11, 0.04);
  // 乙 group: the long north hall and the east/west halls framing a court, a gate hall at its open south side
  shangHall(gp, -0.04, y0, -0.12, 0.32, 0.06);
  shangHall(gp, -0.28, y0, 0.07, 0.18, 0.05, Math.PI / 2);
  shangHall(gp, 0.2, y0, 0.07, 0.18, 0.05, -Math.PI / 2);
  shangHall(gp, -0.04, y0, 0.22, 0.1, 0.04);
  // 丙 group: square altar platforms and rows of sacrificial pits (a few with remains)
  for (const [x, z] of [[-0.36, 0.18], [-0.3, 0.25], [-0.37, 0.28]] as [number, number][]) earth(gp, x, y0, z, 0.05, 0.05, 0.044, 0.044, 0.014, E, 1, '#ad9671');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const x = -0.25 + j * 0.03, z = 0.29 + i * 0.033;
    box(gp, PIT, x, y0, z, 0.016, 0.0012, 0.026);
    if (hash3(i, j, 3) > 0.5) ellip(gp, BONE, x, y0 + 0.0014, z, 0.004, 0.0012, 0.009);
  }
  // pit YH127 with its mass of turtle plastrons
  const ox = 0.17, oz = 0.28;
  cyl(gp, shade(E, 0.85), ox, y0, oz, 0.036, 0.003, 16);
  cyl(gp, PIT, ox, y0, oz, 0.029, 0.0035, 16);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4, r = 0.02 * Math.sqrt(i / 26);
    ellip(gp, i % 3 ? '#c9b994' : '#b8a27a', ox + Math.cos(a) * r, y0 + 0.004 + (i % 4) * 0.0008, oz + Math.sin(a) * r, 0.0045, 0.0012, 0.0055, a);
  }
  // diviner and attendants in undyed hemp and dark silk
  figure(gp, ox + 0.045, y0, oz, 0.028, '#4a3d34', { ry: -Math.PI / 2 });
  figure(gp, -0.04, y0, 0.06, 0.028, '#6f604a', { ry: 0.4 });
  figure(gp, 0.04, y0, 0.0, 0.028, '#5d5040', { pose: 'walk', ry: -2.4, phase: 0.3 });
  figure(gp, -0.15, y0, 0.33, 0.028, '#74674f', { ry: 2.6 });
  figure(gp, 0.06, y0, 0.35, 0.028, '#685a46', { pose: 'walk', ry: Math.PI, phase: 0.7 });
  tree(gp, 0.29, y0, 0.23, 0.06, '#5f7340');
  tree(gp, -0.4, y0, 0.0, 0.065, '#66784a');
};

/** Horse skeleton lying on its side in a burial pit, head towards +z (as the 天子驾六 horses lie). */
function boneHorse(p: THREE.Object3D, x: number, y: number, z: number, side: number, c: string): void {
  ellip(p, c, x, y + 0.003, z, 0.0055, 0.0028, 0.011);
  rod(p, [x, y + 0.003, z + 0.009], [x + side * 0.002, y + 0.003, z + 0.02], 0.0022, c, 4);
  ellip(p, c, x + side * 0.003, y + 0.003, z + 0.025, 0.0028, 0.002, 0.006, side * 0.3);
  for (const dz of [-0.008, 0.007]) for (const k of [0, 1]) rod(p, [x + side * 0.003, y + 0.002, z + dz + k * 0.003], [x + side * 0.015, y + 0.0015, z + dz + k * 0.004 - 0.002], 0.0011, c, 3);
}

/** Decayed chariot as excavated: wheel casts standing in the earth, box, axle, pole and yoke. */
function chariotTrace(p: THREE.Object3D, x: number, y: number, z: number, s: number, pole: number): void {
  const W = '#4b3c2c';
  for (const sx of [-1, 1]) cyl(p, W, x + sx * 0.0135 * s, y + 0.006 - 0.0008, z, 0.0095 * s, 0.0016, 14).rotation.z = Math.PI / 2;
  rod(p, [x - 0.017 * s, y + 0.006, z], [x + 0.017 * s, y + 0.006, z], 0.0012, W, 4);
  box(p, '#5a4836', x, y + 0.004, z - 0.002, 0.021 * s, 0.006, 0.014);
  rod(p, [x, y + 0.004, z], [x, y + 0.004, z + pole], 0.0013, W, 4);
  rod(p, [x - 0.012 * s, y + 0.004, z + pole - 0.004], [x + 0.012 * s, y + 0.004, z + pole - 0.004], 0.0012, W, 4);
}

/**
 * 东周王城 (洛邑, Luoyang, 770–256 BC): the rammed-earth city wall, a hall on a stepped earth terrace (台榭) under a grey tile
 * hip roof with half-round eave tiles, and the royal chariot pit ZK5 found in 2002 under 王城广场 — 26 chariots in two files
 * heading south with 70 horses laid on their sides, the six-horse chariot of the Son of Heaven (天子驾六) in the middle.
 * Refs: 洛阳市文物工作队《洛阳东周王城》; 《洛阳王城广场东周墓》(2009); 洛阳周王城天子驾六博物馆.
 */
const cap_luoyi: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.78);
  const L = '#a38b66', LT = '#b09a76', G = '#958563', SOIL = '#7d6447', BONE = '#c2b28c', tile = '#55585c', PL = '#d6ccb6', RED = '#7e3428', BLK = '#2d2a27';
  // ground level raised round the open pit
  const hg = 0.02, yg = y0 + hg, X0 = 0.07, X1 = 0.31, Z0 = -0.2, Z1 = 0.37;
  // one ring-shaped slab with the pit cut out, so no seams show on the ground
  const outer = new THREE.Shape(), r0 = RL - 0.003;
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2, x = Math.cos(a) * r0, y = Math.sin(a) * r0;
    if (i) outer.lineTo(x, y); else outer.moveTo(x, y);
  }
  outer.holes.push(new THREE.Path([[X0, -Z0], [X0, -Z1], [X1, -Z1], [X1, -Z0]].map(([x, y]) => new THREE.Vector2(x, y))));
  const ring = g(`luoyi-ground:${r0.toFixed(4)}`, () => {
    const eg = new THREE.ExtrudeGeometry(outer, { depth: hg, bevelEnabled: false, curveSegments: 6 });
    eg.rotateX(-Math.PI / 2);
    return eg;
  });
  add(gp, ring, mat(G, { flat: true }), 0, y0, 0, 1, 1, 1);
  box(gp, SOIL, (X0 + X1) / 2, y0, (Z0 + Z1) / 2, X1 - X0, 0.001, Z1 - Z0);
  // ZK5: two files of chariots with paired / four-horse teams, the six-horse team in the middle
  const yb = y0 + 0.001, rows: [number, number, number][] = [];
  for (const [z, n] of [[0.29, 2], [0.215, 4], [0.03, 2], [-0.045, 4], [-0.12, 2]] as [number, number][]) for (const x of [0.13, 0.25]) rows.push([x, z, x < 0.2 ? n : 6 - n]);
  for (const [x, z, n] of rows) {
    chariotTrace(gp, x, yb, z, 1, 0.042);
    for (let k = 0; k < n; k++) boneHorse(gp, x + (k - (n - 1) / 2) * 0.016 - 0.004, yb, z + 0.024, 1, BONE);
  }
  chariotTrace(gp, 0.19, yb, 0.11, 1.2, 0.046);
  for (let k = 0; k < 6; k++) boneHorse(gp, 0.19 + (k - 2.5) * 0.017 - 0.005, yb, 0.135, 1, '#cbbb95');
  for (const [x, z] of [[0.1, -0.17], [0.28, 0.33], [0.24, -0.08]] as [number, number][]) ellip(gp, BONE, x, yb + 0.002, z, 0.006, 0.002, 0.0035, 0.5);
  // rammed-earth city wall along the north and west, a gap for the road
  earth(gp, 0.09, yg, -0.35, 0.62, 0.07, 0.6, 0.05, 0.065, L, 5, LT);
  earth(gp, -0.3, yg, -0.35, 0.08, 0.07, 0.06, 0.05, 0.065, L, 5, LT);
  earth(gp, -0.37, yg, -0.01, 0.07, 0.75, 0.05, 0.73, 0.065, L, 5, LT);
  // 台榭: two-stepped earth terrace, galleries round its foot, a seven-bay hall on top
  const hx = -0.13, hz = -0.13;
  const t1 = earth(gp, hx, yg, hz, 0.34, 0.26, 0.33, 0.25, 0.035, L, 2, LT);
  const t2 = earth(gp, hx, t1, hz - 0.01, 0.27, 0.17, 0.26, 0.16, 0.028, L, 2, LT);
  for (const [x, z, w, d] of [[hx, hz + 0.127, 0.32, 0.006], [hx, hz - 0.127, 0.32, 0.006], [hx - 0.166, hz, 0.006, 0.24], [hx + 0.166, hz, 0.006, 0.24]] as [number, number, number, number][]) box(gp, PL, x, yg, z, w, 0.028, d);
  for (let i = 0; i < 4; i++) box(gp, '#3a2a20', hx - 0.12 + i * 0.08, yg, hz + 0.13, 0.018, 0.022, 0.003);
  colonnade(gp, hx, yg, hz, 0.38, 0.3, 0.03, 10, 7, BLK, 0.0038);
  roof(gp, hx, yg + 0.03, hz, 0.4, 0.32, 0.012, { tile, inner: [0.335, 0.255], k: 0.05 });
  const et = body(gp, hx, t2, hz - 0.01, 0.2, 0.09, 0.05, { wall: PL, col: RED, beam: BLK, sp: 0.2 / 7, cr: 0.0045, door: '#3a2a20', doorN: 3 });
  roof(gp, hx, et, hz - 0.01, 0.27, 0.16, 0.075, { tile, k: 0.12, lift: 0.04, ridge: shade(tile, 0.72) });
  steps(gp, hx, yg, hz + 0.155, 0.06, t1 - yg, 0.03, L, 4);
  steps(gp, hx, t1, hz + 0.075, 0.05, t2 - t1, 0.02, L, 3);
  // Zhou court in dark robes
  figure(gp, hx - 0.03, yg, hz + 0.2, 0.028, '#3d3530', { ry: 0.2 });
  figure(gp, hx + 0.05, yg, hz + 0.24, 0.028, '#5a3a30', { pose: 'walk', ry: Math.PI, phase: 0.4 });
  figure(gp, hx + 0.03, t2, hz + 0.05, 0.028, '#2f2a28');
  figure(gp, -0.06, yg, 0.3, 0.028, '#6a5a46', { pose: 'walk', ry: 1.4, phase: 0.1 });
  tree(gp, -0.25, yg, 0.33, 0.07, '#5f7340');
  tree(gp, 0.42, yg, -0.2, 0.065, '#66784a');
};

/**
 * 秦咸阳宫一号宫殿遗址 (咸阳原, Qin, 4th–3rd c. BC): a 60×45 m rammed-earth platform about 6 m high wrapped by rooms and
 * galleries (回廊) on its lower level, the two-storey main hall (楼堂) on top; it is the western half of a symmetrical pair
 * joined across a gully by an elevated covered way (飞阁). Vermilion posts, black-lacquered beams, white-plastered walls over
 * dark painted dados (the excavated chariot-procession murals), grey tile, no ridge finials. The Wei river below to the south.
 * Refs: 陶复《秦咸阳宫第一号遗址复原问题的初步探讨》(文物1976.11); 秦都咸阳考古工作站《秦都咸阳第一号宫殿建筑遗址简报》(文物1976.11).
 */
const cap_xianyang: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.9);
  const tile = '#46494e', PL = '#dad1bd', RED = '#922f22', BLK = '#2a2826', E = '#a88f6c', ET = '#b39b78', DADO = '#4a3a33';
  // the Wei river along the front edge, a loess bank above it
  band(gp, 0.32, 0.48, y0, 0.0015, '#8d7c5c');
  band(gp, 0.355, 0.44, y0, 0.003, '#5d6e66', 0.03);
  // the gully between the twin platforms
  box(gp, '#7a6a50', 0.25, y0, -0.04, 0.13, 0.0015, 0.6);
  // main platform: lower terrace, then the core wrapped by rooms and a gallery under a skirt roof
  const cx = -0.12, cz = -0.08;
  const y1 = earth(gp, cx, y0, cz, 0.5, 0.38, 0.49, 0.37, 0.035, E, 2, ET);
  const kw = 0.3, kd = 0.22, kx = cx + 0.01, kz = cz - 0.03, kh = 0.055;
  earth(gp, kx, y1, kz, kw, kd, kw - 0.006, kd - 0.006, kh, PL, 1, ET);
  for (const [w, d, x, z] of [[kw + 0.002, 0.002, kx, kz + kd / 2], [0.002, kd + 0.002, kx - kw / 2, kz], [0.002, kd + 0.002, kx + kw / 2, kz]] as [number, number, number, number][]) box(gp, DADO, x, y1, z, w, 0.016, d);
  for (let i = 0; i < 6; i++) box(gp, '#3b2a22', kx - 0.11 + i * 0.044, y1, kz + kd / 2 + 0.002, 0.02, 0.03, 0.003);
  colonnade(gp, kx, y1, kz, kw + 0.07, kd + 0.07, 0.034, 9, 6, RED, 0.0038);
  roof(gp, kx, y1 + 0.034, kz, kw + 0.09, kd + 0.09, 0.016, { tile, inner: [kw, kd], k: 0.05 });
  // two-storey 楼堂 on top of the core
  const y2 = y1 + kh, hx = kx - 0.045, hz = kz - 0.01;
  const e1 = body(gp, hx, y2, hz, 0.2, 0.12, 0.048, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0045, door: '#3a2a20', doorN: 3 });
  const m = roof(gp, hx, e1, hz, 0.25, 0.17, 0.016, { tile, inner: [0.16, 0.09], k: 0.06 });
  const e2 = body(gp, hx, m - 0.004, hz, 0.16, 0.09, 0.036, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.004 });
  roof(gp, hx, e2, hz, 0.22, 0.16, 0.07, { tile, k: 0.12, lift: 0.04, ridge: shade(tile, 0.72) });
  // a side pavilion on the east end of the core and the lower east wing
  const e3 = body(gp, kx + 0.1, y2, kz + 0.04, 0.05, 0.05, 0.032, { wall: PL, col: RED, beam: BLK, sp: 0.025, cr: 0.0035 });
  roof(gp, kx + 0.1, e3, kz + 0.04, 0.078, 0.078, 0.036, { tile, k: 0.12, ridge: shade(tile, 0.72) });
  const e4 = body(gp, cx - 0.218, y1, cz + 0.06, 0.042, 0.16, 0.034, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0035 });
  roof(gp, cx - 0.218, e4, cz + 0.06, 0.062, 0.19, 0.03, { tile, k: 0.1, ridge: shade(tile, 0.72) });
  // stairs up the south face
  steps(gp, cx + 0.05, y0, cz + 0.19 + 0.04, 0.05, y1 - y0, 0.04, ET, 4);
  steps(gp, kx - 0.08, y1, kz + kd / 2 + 0.035 + 0.035, 0.04, kh, 0.035, ET, 5);
  // 飞阁: covered way on tall posts across the gully to the eastern twin (its edge only)
  const tz = -0.12, y3 = y0 + 0.07;
  earth(gp, 0.38, y0, tz, 0.075, 0.26, 0.07, 0.25, 0.07, E, 3, ET);
  const e5 = body(gp, 0.385, y3, tz, 0.055, 0.15, 0.04, { wall: PL, col: RED, beam: BLK, sp: 0.04, cr: 0.0035, back: true });
  roof(gp, 0.385, e5, tz, 0.085, 0.19, 0.04, { tile, k: 0.1, ridge: shade(tile, 0.72) });
  for (let x = 0.2; x <= 0.33; x += 0.033) for (const sz of [-1, 1]) cyl(gp, RED, x, y0, tz + sz * 0.018, 0.0035, y3 - y0, 5);
  box(gp, BLK, 0.25, y3 - 0.004, tz, 0.16, 0.006, 0.044);
  box(gp, PL, 0.25, y3 + 0.002, tz, 0.16, 0.008, 0.042);
  corridor(gp, 0.165, tz, 0.355, tz, y3 + 0.01, 0.026, 0.04, tile, RED, { rh: 0.02 });
  // Qin officials and guards in black (水德)
  figure(gp, cx + 0.04, y0, 0.24, 0.028, '#262422', { armor: '#4a4540' });
  figure(gp, cx + 0.1, y0, 0.24, 0.028, '#262422', { armor: '#4a4540' });
  figure(gp, -0.02, y0, 0.29, 0.028, '#2f2a2e', { hat: 'cap', pose: 'walk', ry: -2.6, phase: 0.3 });
  figure(gp, kx - 0.04, y1, kz + kd / 2 + 0.06, 0.028, '#3a2f2a', { hat: 'cap', ry: 0.4 });
  figure(gp, 0.25, y0, 0.22, 0.028, '#4a4038', { pose: 'walk', ry: Math.PI, phase: 0.6 });
};

/** Bronze armillary sphere (浑仪) on a cross stand. */
function armillary(p: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  const B = '#6f5a36', tor = g('cap:torus', () => new THREE.TorusGeometry(1, 0.06, 4, 20));
  box(p, B, x, y, z, r * 2.2, r * 0.2, r * 0.25);
  box(p, B, x, y, z, r * 0.25, r * 0.2, r * 2.2);
  cyl(p, B, x, y, z, r * 0.12, r * 0.9, 5);
  for (const [ry, rx] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2 - 0.6]]) add(p, tor, mat(B), x, y + r * 1.3, z, r, r, r, ry, rx, 0);
}

/**
 * 东汉洛阳南郊 (25–190): the 灵台 observatory (56 AD), excavated 1974–75 — a square rammed-earth terrace in a walled precinct
 * with two storeys of rooms round it whose walls were painted by direction (east blue, south red, west white, north black),
 * instruments on the summit where 张衡 worked; beside it the 太学 with the 熹平石经 (175–183), 46 stone tablets of the
 * classics set up in a row at the academy gate under a shelter, scholars copying them.
 * Refs: 中国社科院考古所洛阳工作队《汉魏洛阳城南郊的灵台遗址》(考古1978.1); 《后汉书·蔡邕传》; 《洛阳伽蓝记》卷三.
 */
const cap_luoyang: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.86);
  const tile = '#4a4d52', E = '#a99272', ET = '#b7a283', PL = '#d6cdb8', RED = '#8a3a2c', ST = '#9c978c', RD = '#a59a80';
  // road between the two precincts
  box(gp, RD, 0.115, y0, 0, 0.07, 0.0015, 0.96);
  // 灵台 precinct wall with a south gate
  const lx = -0.16, lz = 0.0, hw = 0.24, wh = 0.03;
  const wall = (x: number, z: number, w: number, d: number) => earth(gp, x, y0, z, w, d, w - 0.004, d - 0.004, wh, E, 2, ET);
  wall(lx, lz - hw, 2 * hw, 0.018);
  wall(lx - hw, lz, 0.018, 2 * hw);
  wall(lx + hw, lz, 0.018, 2 * hw);
  for (const sx of [-1, 1]) wall(lx + sx * (hw + 0.035) / 2, lz + hw, hw - 0.035, 0.018);
  for (const sx of [-1, 1]) box(gp, E, lx + sx * 0.04, y0, lz + hw, 0.014, 0.042, 0.022);
  roof(gp, lx, y0 + 0.042, lz + hw, 0.12, 0.05, 0.022, { tile, k: 0.1, ridge: shade(tile, 0.72) });
  // the terrace: lower tier wrapped by rooms (walls painted by direction), upper tier with its own gallery, summit
  const s1 = 0.2, s2 = 0.13, h1 = 0.04, h2 = 0.035;
  const y1 = earth(gp, lx, y0, lz, s1, s1, s1 - 0.006, s1 - 0.006, h1, E, 2, ET);
  for (const [x, z, w, d, c] of [[lx, lz + s1 / 2, s1 - 0.01, 0.003, '#8a3a2c'], [lx, lz - s1 / 2, s1 - 0.01, 0.003, '#2c2b2a'], [lx + s1 / 2, lz, 0.003, s1 - 0.01, '#3e6764'], [lx - s1 / 2, lz, 0.003, s1 - 0.01, '#ddd6c6']] as [number, number, number, number, string][]) box(gp, c, x, y0, z, w, h1 * 0.7, d);
  colonnade(gp, lx, y0, lz, s1 + 0.036, s1 + 0.036, h1 * 0.75, 6, 6, RED, 0.0035);
  roof(gp, lx, y0 + h1 * 0.75, lz, s1 + 0.05, s1 + 0.05, 0.012, { tile, inner: [s1, s1], k: 0.05 });
  const y2 = earth(gp, lx, y1, lz, s2, s2, s2 - 0.006, s2 - 0.006, h2, E, 2, ET);
  for (const [x, z, w, d, c] of [[lx, lz + s2 / 2, s2 - 0.01, 0.003, '#8a3a2c'], [lx, lz - s2 / 2, s2 - 0.01, 0.003, '#2c2b2a'], [lx + s2 / 2, lz, 0.003, s2 - 0.01, '#3e6764'], [lx - s2 / 2, lz, 0.003, s2 - 0.01, '#ddd6c6']] as [number, number, number, number, string][]) box(gp, c, x, y1, z, w, h2 * 0.85, d);
  railRun(gp, lx - s2 / 2 + 0.004, lx + s2 / 2 - 0.004, y2, lz + s2 / 2 - 0.004, RED, undefined, 0.01);
  armillary(gp, lx - 0.02, y2, lz - 0.01, 0.016);
  box(gp, '#6f5a36', lx + 0.035, y2, lz + 0.02, 0.012, 0.012, 0.012);
  box(gp, '#6f5a36', lx + 0.035, y2, lz + 0.035, 0.009, 0.007, 0.009);
  steps(gp, lx, y0, lz + s1 / 2 + 0.06 + 0.035, 0.036, h1, 0.06, ET, 6);
  steps(gp, lx, y1, lz + s2 / 2 + 0.035, 0.03, h2, 0.035, ET, 4);
  // 太学: the 熹平石经 tablets in a row under a long shelter, the lecture hall behind
  const tx = 0.3;
  for (const [z, n] of [[-0.17, 7], [-0.03, 7], [0.11, 7]] as [number, number][]) for (let i = 0; i < n; i++) {
    const x = tx - 0.12 + i * 0.04;
    box(gp, '#7a766e', x, y0, z, 0.03, 0.005, 0.012);
    box(gp, ST, x, y0 + 0.005, z, 0.024, 0.026, 0.005);
    for (let r = 0; r < 4; r++) box(gp, '#85817a', x, y0 + 0.009 + r * 0.0045, z + 0.0026, 0.019, 0.0018, 0.0004);
  }
  const e = body(gp, tx - 0.03, y0, -0.285, 0.16, 0.065, 0.045, { wall: PL, col: RED, beam: '#3a3430', sp: 0.04, cr: 0.0042, door: '#2e2a28', doorN: 3 });
  roof(gp, tx - 0.03, e, -0.285, 0.2, 0.11, 0.052, { tile, k: 0.12, lift: 0.03, ridge: shade(tile, 0.72) });
  // scholars in dark robes reading and copying at the tablets, an astronomer on the terrace
  for (let i = 0; i < 6; i++) figure(gp, tx - 0.1 + (i % 3) * 0.09 + (i > 2 ? 0.03 : 0), y0, i > 2 ? 0.15 : 0.01, 0.027, ['#3a3532', '#4a3f38', '#2f2c2a', '#5a4a3c'][i % 4], { hat: 'cap', ry: Math.PI + (i - 2.5) * 0.15 });
  figure(gp, lx + 0.035, y2, lz - 0.03, 0.027, '#3a3532', { hat: 'cap', ry: -0.6 });
  figure(gp, lx, y0, lz + hw + 0.06, 0.027, '#4a3f38', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.4 });
  figure(gp, 0.12, y0, 0.2, 0.027, '#5a4a3c', { pose: 'walk', ry: Math.PI, phase: 0.1 });
  tree(gp, 0.36, y0, 0.3, 0.065, '#5f7340');
  tree(gp, -0.3, y0, 0.38, 0.06, '#66784a');
};

/**
 * 魏晋洛阳太极殿 (235, rebuilt by Northern Wei 493), excavated 2012–16: one immense hall on a rammed-earth terrace about
 * 100 × 60 m, 12 bays wide, flanked by the smaller 东堂 and 西堂 (≈ 48 × 22 m) in a row — the 太极殿–东西堂 system of the
 * Wei–Jin–Southern Dynasties — and, far in front, the 阊阖门 gate on its platform with two que joined to it in a 凹 plan.
 * Grey tile, 鸱尾 on the ridges, red posts, white walls.
 * Refs: 中国社科院考古所洛阳汉魏城队《河南洛阳市汉魏故城太极殿遗址的发掘》(考古2016.7); 《北魏洛阳城宫城阊阖门遗址》(考古2003.7).
 */
const cap_taiji: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const tile = '#4b4f55', PL = '#e0d8c6', RED = '#8a3a2c', BR = '#9a8c70', BRT = '#ae9f82', ST = '#b9b3a5', BK = '#7a4a32', CHI = '#3a3d42';
  // 太极殿 terrace and the 12-bay hall
  const hz = -0.2, y1 = earth(gp, 0, y0, hz, 0.54, 0.26, 0.52, 0.245, 0.05, BR, 4, BRT);
  railRun(gp, -0.25, -0.16, y1, hz + 0.118, ST, undefined, 0.012);
  railRun(gp, -0.08, 0.08, y1, hz + 0.118, ST, undefined, 0.012);
  railRun(gp, 0.16, 0.25, y1, hz + 0.118, ST, undefined, 0.012);
  const bw = 0.42, bd = 0.15;
  const et = body(gp, 0, y1, hz - 0.01, bw, bd, 0.085, { wall: PL, col: RED, bracket: BK, beam: RED, sp: bw / 12, cr: 0.0055 });
  for (let i = 0; i < 12; i++) box(gp, Math.abs(i - 5.5) < 4 ? '#7a3026' : '#4a4640', -bw / 2 + (i + 0.5) * (bw / 12), y1, hz - 0.01 + bd / 2 - 0.002, 0.022, 0.06, 0.004);
  roof(gp, 0, et, hz - 0.01, 0.52, 0.25, 0.115, { tile, k: 0.25, lift: 0.12, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.03 });
  for (const sx of [-1, 1]) steps(gp, sx * 0.12, y0, hz + 0.13 + 0.05, 0.05, y1 - y0, 0.05, ST, 5);
  // 东堂 / 西堂 on their own lower terraces
  for (const sx of [-1, 1]) {
    const x = sx * 0.35, yb = earth(gp, x, y0, hz + 0.01, 0.15, 0.13, 0.145, 0.125, 0.026, BR, 2, BRT);
    const e = body(gp, x, yb, hz + 0.01, 0.11, 0.07, 0.05, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.022, cr: 0.0042, door: '#7a3026', doorN: 3 });
    roof(gp, x, e, hz + 0.01, 0.15, 0.115, 0.06, { tile, k: 0.25, lift: 0.12, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.017 });
    steps(gp, x, y0, hz + 0.075 + 0.03, 0.04, 0.026, 0.03, ST, 3);
  }
  // 阊阖门: platform with three passages, a seven-bay gate tower, walls running forward to the two que
  const gz = 0.2, gh = 0.05;
  earth(gp, 0, y0, gz, 0.3, 0.08, 0.29, 0.075, gh, BR, 4, BRT);
  for (const x of [-0.07, 0, 0.07]) box(gp, '#2e2620', x, y0, gz + 0.038, 0.034, 0.036, 0.004);
  for (const sx of [-1, 1]) box(gp, BR, sx * 0.28, y0, gz, 0.26, 0.035, 0.03);
  const eg = body(gp, 0, y0 + gh, gz, 0.22, 0.06, 0.042, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.22 / 7, cr: 0.0045 });
  roof(gp, 0, eg, gz, 0.29, 0.12, 0.055, { tile, k: 0.25, lift: 0.12, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.018 });
  for (const sx of [-1, 1]) {
    box(gp, BR, sx * 0.2, y0, gz + 0.075, 0.025, 0.035, 0.11);
    que(gp, sx * 0.24, y0, 0.34, sx, tile, 0.62);
  }
  // court officials in Jin robes and gauze caps; guards at the gate
  for (const x of [-0.035, 0.035]) figure(gp, x, y0, gz + 0.065, 0.027, '#6a2e26', { armor: '#5e5850', hat: 'helmet' });
  figure(gp, -0.06, y0, 0.0, 0.027, '#2f2c30', { hat: 'cap', pose: 'walk', ry: 0.1, phase: 0.2 });
  figure(gp, 0.05, y0, -0.02, 0.027, '#4a3a42', { hat: 'cap', pose: 'walk', ry: -0.1, phase: 0.7 });
  figure(gp, 0.0, y0, 0.32, 0.027, '#5a4a3c', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.4 });
};

/** Southern Dynasties stone 辟邪 (winged lion of the 南朝陵墓石刻): striding, chest thrust out, head high, wings on the flank. */
function bixie(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0): void {
  const g0 = grp(p, x, z, ry, y), S = '#8c877c', B = shade(S, 0.85);
  box(g0, B, 0, 0, 0, s * 0.42, s * 0.08, s * 1.15);
  for (const [lx, lz] of [[-0.12, 0.34], [0.12, 0.2], [-0.12, -0.3], [0.12, -0.38]]) box(g0, S, lx * s, s * 0.08, lz * s, s * 0.12, s * 0.32, s * 0.14);
  ellip(g0, S, 0, s * 0.52, 0, s * 0.2, s * 0.17, s * 0.45, 0, -0.25);
  ellip(g0, S, 0, s * 0.68, s * 0.34, s * 0.17, s * 0.22, s * 0.16, 0, 0.5);
  ellip(g0, S, 0, s * 0.86, s * 0.45, s * 0.14, s * 0.13, s * 0.14);
  box(g0, B, 0, s * 0.74, s * 0.56, s * 0.17, s * 0.1, s * 0.06);
  for (const sx of [-1, 1]) slab(grp(g0, sx * s * 0.2, 0, Math.PI / 2, 0), [[s * 0.25, s * 0.5], [-s * 0.15, s * 0.42], [-s * 0.05, s * 0.66], [s * 0.22, s * 0.68]], s * 0.03, B, 0, false);
  ellip(g0, B, 0, s * 0.6, -s * 0.48, s * 0.05, s * 0.18, s * 0.05, 0, 0.4);
}

/**
 * 东晋南朝建康台城 (330–589): the palace city behind a rammed-earth wall faced with grey brick (brick facing of the city walls
 * is attested from the Southern Dynasties), a gate with three timber-lintelled passages and a gate tower; inside the
 * 太极殿 with 鸱尾 and the 华林园 with its 天渊池; north of the wall the nine-storey wooden pagoda of 同泰寺; in front the
 * 秦淮河 crossed by the 朱雀航 pontoon bridge, and a pair of the Southern Dynasties stone 辟邪.
 * Refs: 南京市考古研究所《南京六朝建康城遗址考古》(2008–2015 台城城墙/城门); 贺云翱《六朝瓦当与六朝都城》(2005); 《建康实录》.
 */
const cap_jiankang: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const tile = '#4c5056', BR = '#7d7b76', BRT = '#8d8a83', PL = '#ddd5c2', RED = '#8a3a2c', BK = '#4a4038', CHI = '#3a3d42', WATER = '#58706c';
  // 秦淮河 and the pontoon bridge of boats
  ribbon(gp, [[-0.46, 0.34], [-0.2, 0.37], [0.1, 0.36], [0.46, 0.38]], 0.09, y0, 0.0015, '#8a8468');
  ribbon(gp, [[-0.46, 0.34], [-0.2, 0.37], [0.1, 0.36], [0.46, 0.38]], 0.065, y0, 0.003, WATER);
  for (let i = 0; i < 5; i++) ellip(gp, '#4e4034', 0, y0 + 0.004, 0.335 + i * 0.012, 0.022, 0.004, 0.0055);
  box(gp, '#7a6448', 0, y0 + 0.007, 0.36, 0.03, 0.002, 0.075);
  for (const sx of [-1, 1]) bixie(gp, sx * 0.08, y0, 0.27, 0.05, -sx * Math.PI / 2);
  // the brick-faced wall of the 台城 with a parapet; return walls at the sides
  const wz = 0.16, wh = 0.065;
  const seg = (x: number, z: number, w: number, d: number) => {
    const t = earth(gp, x, y0, z, w, d, w - 0.008, d - 0.008, wh, BR, 7, BRT);
    return t;
  };
  for (const sx of [-1, 1]) {
    seg(sx * 0.27, wz, 0.34, 0.04);
    seg(sx * 0.42, wz - 0.12, 0.04, 0.2);
    for (let i = 0; i < 9; i++) box(gp, BR, sx * (0.12 + i * 0.036), y0 + wh, wz + 0.016, 0.018, 0.008, 0.006);
  }
  // gate: base with three rectangular passages, a five-bay tower above
  const gy = earth(gp, 0, y0, wz, 0.22, 0.07, 0.215, 0.065, 0.075, BR, 7, BRT);
  for (const x of [-0.06, 0, 0.06]) {
    box(gp, '#2a2420', x, y0, wz + 0.033, x ? 0.03 : 0.036, x ? 0.042 : 0.048, 0.005);
    box(gp, '#5a4634', x, y0 + (x ? 0.042 : 0.048), wz + 0.035, (x ? 0.03 : 0.036) + 0.004, 0.004, 0.003);
  }
  const eg = body(gp, 0, gy, wz, 0.16, 0.05, 0.04, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.032, cr: 0.004, door: '#6e2a22', doorN: 3 });
  roof(gp, 0, eg, wz, 0.21, 0.1, 0.05, { tile, k: 0.3, lift: 0.2, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.016 });
  railRun(gp, -0.1, 0.1, gy, wz + 0.033, RED, undefined, 0.01);
  // 太极殿 on a brick-edged terrace
  const hz = -0.1, ty = earth(gp, 0, y0, hz, 0.36, 0.17, 0.35, 0.16, 0.03, BR, 3, BRT);
  const et = body(gp, 0, ty, hz, 0.28, 0.1, 0.065, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.028, cr: 0.005, door: '#6e2a22', doorN: 6 });
  roof(gp, 0, et, hz, 0.36, 0.18, 0.09, { tile, k: 0.3, lift: 0.2, ridge: shade(tile, 0.75), chi: CHI, chiH: 0.026 });
  steps(gp, 0, y0, hz + 0.085 + 0.04, 0.06, 0.03, 0.04, '#9a968c', 4);
  // 华林园: the 天渊池 with willows and a lakeside pavilion
  const px = -0.26, pz = -0.29;
  prism(gp, [[px - 0.12, pz - 0.08], [px + 0.06, pz - 0.1], [px + 0.12, pz - 0.02], [px + 0.07, pz + 0.07], [px - 0.08, pz + 0.08], [px - 0.13, pz + 0.01]], y0, 0.003, WATER, 0, true);
  const ep = body(gp, px + 0.11, y0, pz - 0.07, 0.05, 0.05, 0.03, { wall: PL, col: RED, sp: 0.025, cr: 0.0035 });
  roof(gp, px + 0.11, ep, pz - 0.07, 0.08, 0.08, 0.035, { tile, k: 0.3, lift: 0.3 });
  for (const [x, z] of [[-0.4, -0.14], [-0.22, -0.4], [-0.07, -0.33]] as [number, number][]) tree(gp, x, y0, z, 0.062, '#6f8048');
  // 同泰寺 pagoda (527), square, nine storeys, wooden, beyond the north wall
  const ox = 0.3, oz = -0.3;
  rbox(gp, BRT, ox, y0, oz, 0.09, 0.014, 0.09, 0.003);
  let py = y0 + 0.014;
  for (let i = 0; i < 9; i++) {
    const w = 0.06 - i * 0.0035, h = i ? 0.02 : 0.03;
    box(gp, i % 2 ? '#7a3a2c' : RED, ox, py, oz, w * 0.7, h, w * 0.7);
    roof(gp, ox, py + h, oz, w + 0.018, w + 0.018, 0.008, { tile, inner: [w * 0.7 - 0.01, w * 0.7 - 0.01], k: 0.1, lift: 0.3 });
    py += h + 0.004;
  }
  cyl(gp, '#6f5a36', ox, py, oz, 0.0025, 0.05, 5);
  for (let i = 0; i < 5; i++) cyl(gp, '#8a7040', ox, py + 0.012 + i * 0.007, oz, 0.008, 0.002, 8);
  // gate guards; officials in wide-sleeved robes and gauze caps
  for (const x of [-0.035, 0.035]) figure(gp, x, y0, wz + 0.06, 0.027, '#6a2e26', { armor: '#5e5850', hat: 'helmet' });
  figure(gp, -0.15, y0, 0.24, 0.027, '#2f3a40', { hat: 'cap', pose: 'walk', ry: 0.5, phase: 0.3 });
  figure(gp, 0.17, y0, 0.25, 0.027, '#5e5048', { hat: 'cap', ry: -2.6 });
  figure(gp, 0.04, y0, 0.05, 0.027, '#3a3040', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.5 });
};

/**
 * 南宋临安皇城 (1138–1276) on the eastern slopes of 凤凰山 above the 钱塘江, the West Lake just to the north-west: no
 * axial court of a northern capital but halls on terraces climbing the hillside (垂拱殿, 崇政殿 in modest five-bay
 * form), a red-washed palace wall following the slope, the northern gate 和宁门 opening on the 御街, grey-tiled 歇山 roofs
 * with 鸱吻, pines and the hills all round; the 雷峰塔 (975) on the lake shore.
 * Refs: 杭州市文物考古所《南宋临安城考古》(2008); 《咸淳临安志》皇城图; 《梦粱录》卷八〈大内〉; 傅伯星《南宋皇城探秘》.
 */
const cap_linan: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.9);
  const tile = '#55595e', HG = '#5f6b47', HG2 = '#6d7752', ST = '#8f8a7e', STT = '#a29c8e', PL = '#e3dccb', RED = '#8e3a2c', WALL = '#9c4a3a', BK = '#4f6a62', WATER = '#5c7470';
  // 凤凰山 and its spurs behind and to the west
  hill(gp, -0.1, y0, -0.42, 0.36, 0.14, 0.15, HG);
  hill(gp, 0.25, y0, -0.43, 0.26, 0.1, 0.1, HG2);
  hill(gp, -0.44, y0, -0.16, 0.12, 0.24, 0.09, HG2);
  hill(gp, 0.44, y0, -0.2, 0.1, 0.2, 0.06, HG);
  for (const [x, z, yy] of [[-0.32, -0.36, 0.06], [-0.22, -0.38, 0.11], [-0.03, -0.39, 0.13], [0.13, -0.385, 0.09], [0.24, -0.4, 0.08], [0.31, -0.35, 0.05], [-0.41, -0.24, 0.06], [-0.41, -0.06, 0.06], [0.42, -0.14, 0.04], [0.37, -0.27, 0.035], [-0.16, -0.33, 0.04]] as [number, number, number][])
    tree(gp, x, y0 + yy - 0.004, z, 0.05, (x * 7 + z * 3) % 0.2 > 0.1 ? '#4f6140' : '#5a6a44');
  // three stone-faced terraces climbing the slope, each with its hall
  const T: [number, number, number, number, number][] = [[0.03, 0.07, 0.4, 0.15, 0.02], [-0.07, -0.11, 0.32, 0.13, 0.05], [0.07, -0.27, 0.26, 0.12, 0.085]];
  const H: [number, number, number, number][] = [[0.24, 0.08, 0.05, 0.11], [0.2, 0.07, 0.045, 0.1], [0.15, 0.065, 0.045, 0.09]];
  T.forEach(([x, z, w, d, h], i) => {
    const ty = earth(gp, x, y0, z, w, d, w - 0.006, d - 0.006, h, ST, Math.max(1, Math.round(h / 0.012)), STT);
    railRun(gp, x - w / 2 + 0.005, x - 0.03, ty, z + d / 2 - 0.004, RED, undefined, 0.011);
    railRun(gp, x + 0.03, x + w / 2 - 0.005, ty, z + d / 2 - 0.004, RED, undefined, 0.011);
    const [bw, bd, bh, rh] = H[i], hz = z - 0.01;
    const et = body(gp, x, ty, hz, bw, bd, bh, { wall: PL, col: RED, beam: RED, bracket: BK, sp: bw / 5, cr: 0.0045, door: '#7a2e25', doorN: 5 });
    roof(gp, x, et, hz, bw + 0.07, bd + 0.07, rh * 0.6, { tile, k: 0.45, lift: 0.55, xie: 0.72 });
    steps(gp, x, y0, z + d / 2 + (i ? 0.035 : 0.04), 0.04, h, i ? 0.035 : 0.04, STT, 3 + i * 2);
  });
  // red palace wall along the front with 和宁门 (gate base, single gate tower under a 歇山 roof)
  const wz = 0.24, wh = 0.04;
  for (const sx of [-1, 1]) {
    box(gp, WALL, sx * 0.22, y0, wz, 0.28, wh, 0.018);
    roof(gp, sx * 0.22, y0 + wh, wz, 0.29, 0.032, 0.012, { tile, k: 0.2, ridge: shade(tile, 0.75) });
  }
  const gy = earth(gp, 0, y0, wz, 0.16, 0.06, 0.155, 0.055, 0.055, WALL, 1, shade(WALL, 1.1));
  for (const x of [-0.04, 0.04]) slab(grp(gp, x, wz + 0.028, 0, y0), [[-0.016, 0], [0.016, 0], [0.016, 0.03], [0.009, 0.038], [-0.009, 0.038], [-0.016, 0.03]], 0.006, '#2a2420', 0, false);
  const eg = body(gp, 0, gy, wz, 0.13, 0.045, 0.038, { wall: PL, col: RED, beam: RED, bracket: BK, sp: 0.026, cr: 0.004 });
  roof(gp, 0, eg, wz, 0.19, 0.1, 0.055, { tile, k: 0.45, lift: 0.55, xie: 0.72 });
  // 御街 leading north, the 钱塘江 in the south-east and the West Lake with 雷峰塔 to the west
  box(gp, '#a49c8a', 0, y0, 0.335, 0.06, 0.0015, 0.16);
  const river: [number, number][] = ([[-0.05, 0.47], [0.12, 0.385], [0.26, 0.36], [0.4, 0.24], [0.46, 0.1]] as [number, number][]).map(([x, z]) => clip(x, z, 0.02));
  for (let i = 0; i <= 12; i++) { const t = 0.21 + (i / 12) * 1.5, r = RL - 0.02; river.push([Math.cos(t) * r, Math.sin(t) * r]); }
  prism(gp, river, y0, 0.003, WATER);
  ellip(gp, '#4e4034', 0.2, y0 + 0.004, 0.405, 0.025, 0.004, 0.007, 0.1);
  slab(grp(gp, 0.2, 0.405, 0.1 + Math.PI / 2, y0 + 0.006), [[-0.006, 0], [0.012, 0], [0, 0.03]], 0.004, '#cfc4a8', 0, false);
  prism(gp, ([[-0.5, 0.06], [-0.3, 0.12], [-0.25, 0.22], [-0.3, 0.34], [-0.42, 0.3], [-0.5, 0.2]] as [number, number][]).map(([x, z]) => clip(x, z, 0.03)), y0, 0.003, WATER, 0, true);
  const lx = -0.37, lz = 0.13;
  let ly = y0;
  for (let i = 0; i < 5; i++) {
    const r = 0.022 - i * 0.002, h = i ? 0.02 : 0.026;
    cyl(gp, i ? '#8a6e52' : '#7a604a', lx, ly, lz, r * 0.75, h, 8);
    roof(gp, lx, ly + h, lz, r * 2.2, r * 2.2, 0.006, { tile, inner: [r * 1.4, r * 1.4], k: 0.2, lift: 0.4 });
    ly += h + 0.003;
  }
  cone(gp, '#5f5a50', lx, ly, lz, 0.008, 0.02, 8);
  // court officials in Song robes with long-winged caps, guards at the gate
  for (const x of [-0.03, 0.03]) figure(gp, x, y0, wz + 0.05, 0.026, '#8a3a30', { hat: 'plume', hatC: '#4f4b45', armor: '#6b6258' });
  figure(gp, -0.02, y0, 0.36, 0.026, '#4f5f4a', { hat: 'cap', pose: 'walk', ry: Math.PI, phase: 0.3 });
  figure(gp, 0.15, y0 + T[0][4], 0.12, 0.026, '#5a4762', { hat: 'cap', ry: -0.4 });
};

/** Doric-to-Ionic column on a pedestal: shaft, volute capital and base. */
function column(p: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, c: string): void {
  box(p, c, x, y, z, r * 3.2, r * 1.6, r * 3.2);
  cyl(p, c, x, y + r * 1.6, z, r, h - r * 2.8, 8);
  box(p, c, x, y + h - r * 1.2, z, r * 3.2, r * 0.5, r * 2.2);
  for (const sx of [-1, 1]) cyl(grp(p, x + sx * r * 1.3, z + r * 0.9, 0, y + h - r * 1.25), shade(c, 0.95), 0, 0, 0, r * 0.45, r * 0.25, 6).rotation.set(Math.PI / 2, 0, 0);
  box(p, c, x, y + h - r * 0.7, z, r * 3.2, r * 0.7, r * 3.2);
}

/**
 * 南京国民政府 / 总统府 (1912–1949): the 1929 gateway on 长江路 by 姚彬 — a cement-rendered neoclassical front 26.8 m wide and
 * 14 m high with three round-arched openings closed by black iron gates, eight Ionic columns in pairs, an entablature and an
 * attic bearing the name plaque, the 青天白日满地红 flag on the pole above; behind it the axis of the old 两江总督署:
 * the grey-tiled 大堂, the five-storey 子超楼 (1935) in grey render, and to the west the 煦园 pond with its stone boat 不系舟.
 * Refs: 南京中国近代史遗址博物馆 (总统府) site; 刘先觉《南京近代建筑》; 《首都计划》(1929).
 */
const cap_nanjing_roc: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.9);
  const CEM = '#aaa395', CEMD = '#958e81', tile = '#55595e', WATER = '#5c7470', RED = '#8a3a2c', PL = '#e0d8c6';
  // 长江路 with plane trees
  band(gp, 0.31, 0.43, y0, 0.0015, '#5f5d58', 0.02);
  for (const x of [-0.37, -0.23, 0.23, 0.37]) tree(gp, x, y0, 0.27, 0.065, '#6c7a48');
  // the gateway: 0.012 per metre
  const gz = 0.22, gw = 0.32, gd = 0.065, gh = 0.12, fz = gz + gd / 2;
  box(gp, CEM, 0, y0, gz, gw, gh, gd);
  box(gp, CEMD, 0, y0, gz, gw + 0.004, 0.008, gd + 0.004);
  const arches: [number, number, number][] = [[-0.095, 0.042, 0.068], [0, 0.056, 0.085], [0.095, 0.042, 0.068]];
  for (const [x, w, h] of arches) {
    const out: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; out.push([(Math.cos(a) * w) / 2, h - w / 2 + (Math.sin(a) * w) / 2]); }
    slab(grp(gp, x, fz, 0, y0), out, 0.006, '#2e2c29', 0, false);
    box(gp, '#9a8040', x, y0 + (h - w / 2) * 0.5, fz + 0.0035, w, 0.005, 0.003);
    box(gp, CEMD, x, y0 + h - w / 2 - 0.003, fz + 0.002, w + 0.008, 0.006, 0.004);
  }
  for (const x of [-0.145, -0.048, 0.048, 0.145]) for (const s of [-1, 1]) column(gp, x + s * 0.009, y0, fz + 0.006, 0.0042, 0.088, CEM);
  box(gp, CEMD, 0, y0 + 0.088, gz + 0.004, gw + 0.01, 0.012, gd + 0.012);
  box(gp, CEM, 0, y0 + 0.1, gz + 0.004, gw + 0.016, 0.005, gd + 0.016);
  // stepped attic: low parapet across the front, raised central block with the dark name plaque and gilt characters
  box(gp, CEM, 0, y0 + 0.105, gz, 0.28, 0.012, gd * 0.8);
  box(gp, CEMD, 0, y0 + 0.117, gz, 0.284, 0.004, gd * 0.8 + 0.004);
  box(gp, CEM, 0, y0 + 0.105, gz, 0.13, 0.032, gd * 0.7);
  box(gp, CEMD, 0, y0 + 0.137, gz, 0.136, 0.005, gd * 0.7 + 0.006);
  box(gp, CEM, 0, y0 + 0.142, gz, 0.07, 0.008, gd * 0.6);
  for (let i = 0; i < 3; i++) box(gp, '#b3934a', -0.03 + i * 0.03, y0 + 0.114, gz + gd * 0.35, 0.018, 0.016, 0.004);
  // flagpole and the 青天白日满地红 flag
  const fy = y0 + 0.15;
  cyl(gp, '#d8d4c8', 0, fy, gz, 0.003, 0.1, 6);
  ellip(gp, '#b99a50', 0, fy + 0.101, gz, 0.005);
  const fl = grp(gp, 0.003, gz, 0, fy + 0.06);
  box(fl, '#a8332a', 0.03, 0, 0, 0.06, 0.038, 0.003);
  box(fl, '#2a4280', 0.015, 0.019, 0, 0.03, 0.019, 0.004);
  cyl(fl, '#e8e4da', 0.015, 0.0285, 0, 0.005, 0.005, 10).rotation.set(Math.PI / 2, 0, 0);
  // court behind: the 大堂 (grey-tiled Qing hall of the old 督署) and the 子超楼
  box(gp, '#a59d8c', 0, y0, 0.0, 0.05, 0.0015, 0.36);
  const hz = 0.02, et = body(gp, 0, y0 + 0.012, hz, 0.2, 0.08, 0.045, { wall: PL, col: RED, beam: '#3c4a46', sp: 0.04, cr: 0.0042, door: '#5a2a22', doorN: 3 });
  rbox(gp, '#a39d90', 0, y0, hz, 0.23, 0.012, 0.11, 0.003);
  roof(gp, 0, et, hz, 0.25, 0.13, 0.05, { tile, k: 0.35, lift: 0.15, xie: 0.7 });
  box(gp, '#2a2e3a', 0, et - 0.012, hz + 0.042, 0.05, 0.012, 0.002);
  const zx = 0.05, zz = -0.28, zb = 0.26, zd = 0.08, fh = 0.026;
  box(gp, '#8f8a80', zx, y0, zz, zb, 0.012, zd);
  box(gp, '#a7a196', zx, y0 + 0.012, zz, zb - 0.006, fh * 5, zd - 0.006);
  for (let f = 0; f < 5; f++) for (let i = 0; i < 12; i++) box(gp, '#3a3c3c', zx - zb / 2 + 0.014 + i * ((zb - 0.028) / 11), y0 + 0.012 + f * fh + 0.007, zz + zd / 2 - 0.002, 0.01, 0.014, 0.002);
  box(gp, '#8f8a80', zx, y0 + 0.012 + fh * 5, zz, zb + 0.004, 0.005, zd + 0.004);
  box(gp, '#a7a196', zx, y0 + 0.017 + fh * 5, zz, 0.06, 0.03, 0.05);
  cyl(gp, '#d8d4c8', zx, y0 + 0.047 + fh * 5, zz, 0.003, 0.04, 5);
  // 煦园: the pond and the stone boat 不系舟, a pavilion, willows
  prism(gp, [[-0.41, -0.05], [-0.25, -0.08], [-0.2, 0.0], [-0.24, 0.1], [-0.36, 0.12], [-0.42, 0.06]], y0, 0.003, WATER, 0, true);
  box(gp, '#b9b4a8', -0.31, y0, 0.02, 0.024, 0.01, 0.08);
  const eb = body(gp, -0.31, y0 + 0.01, 0.015, 0.018, 0.05, 0.018, { wall: PL, col: '#5a3a2c', sp: 0.025, cr: 0.0025 });
  gable(gp, 0.026, 0.012, 0.06, tile, -0.31, eb, 0.015, Math.PI / 2);
  const ep = body(gp, -0.22, y0, -0.17, 0.05, 0.05, 0.028, { wall: PL, col: RED, sp: 0.025, cr: 0.0032 });
  roof(gp, -0.22, ep, -0.17, 0.08, 0.08, 0.035, { tile, k: 0.4, lift: 0.5 });
  for (const [x, z] of [[-0.4, -0.15], [-0.4, 0.17], [-0.18, 0.13], [0.3, 0.05], [0.38, -0.08], [-0.3, -0.3]] as [number, number][]) tree(gp, x, y0, z, 0.065, '#6c7a48');
  // sentries in peaked caps and khaki, people in 长衫
  for (const x of [-0.06, 0.06]) human(gp, x, y0, fz + 0.03, { h: 0.027, top: '#6b6a4a', bottom: '#5e5d40', skin: '#c49a76', hair: '#1d1915', hat: '#5e5d40', hatStyle: 'peaked', shoes: '#2a2420', detail: 'lo' });
  figure(gp, -0.17, y0, 0.36, 0.027, '#3a4450', { pose: 'walk', ry: Math.PI / 2, phase: 0.3 });
  figure(gp, 0.2, y0, 0.37, 0.027, '#5a5a5a', { pose: 'walk', ry: -Math.PI / 2, phase: 0.7 });
  figure(gp, 0.02, y0, 0.12, 0.027, '#2e3440', { pose: 'walk', ry: Math.PI, phase: 0.5 });
};

/**
 * 战国高台宫室 · 齐都临淄桓公台与稷下学宫 (475–221 BC): Warring States capitals competed in stepped rammed-earth high terraces
 * (层台累榭), twin triple-tiered gate-towers (子母双阙) outside the gate, elevated flying galleries (复道飞阁) bridging halls,
 * and open lecture courts where scholars of the Hundred Schools (稷下先生) debated beside bronze bianzhong racks.
 */
const cap_zhanguo: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.86);
  const E = '#9e8159', TOP = '#b5986d', TILE = '#56595e', RED = '#983228', WD = '#4a3322', PL = '#dfd5be', BRZ = '#8a6d3b';
  band(gp, 0.28, 0.42, y0, 0.002, '#b6a88c', 0.018);
  // Twin triple-tiered子母阙 gate-towers flanking the south approach
  for (const sx of [-1, 1]) {
    const qx = sx * 0.2, qz = 0.24;
    const q1 = earth(gp, qx, y0, qz, 0.09, 0.07, 0.08, 0.062, 0.055, E, 3, TOP);
    const e1 = body(gp, qx, q1, qz, 0.074, 0.056, 0.032, { wall: PL, col: RED, bracket: WD, sp: 0.035, cr: 0.0035 });
    roof(gp, qx, e1, qz, 0.105, 0.085, 0.026, { tile: TILE, k: 0.28, lift: 0.15 });
    // Subsidiary sub-tower (子阙) on the inner side
    const zx = qx - sx * 0.052;
    const q2 = earth(gp, zx, y0, qz + 0.005, 0.048, 0.048, 0.042, 0.042, 0.038, E, 2, TOP);
    const e2 = body(gp, zx, q2, qz + 0.005, 0.038, 0.038, 0.022, { wall: PL, col: RED, sp: 0.03, cr: 0.003 });
    roof(gp, zx, e2, qz + 0.005, 0.06, 0.058, 0.018, { tile: TILE, k: 0.28, lift: 0.12 });
  }
  // Stepped 3-tier rammed-earth high terrace (桓公台 / 章华高台) at north-center
  const hz = -0.1;
  const t1 = earth(gp, 0, y0, hz, 0.48, 0.34, 0.44, 0.31, 0.052, E, 3, TOP);
  const t2 = earth(gp, 0, t1, hz - 0.01, 0.36, 0.24, 0.33, 0.22, 0.048, shade(E, 0.96), 3, TOP);
  const t3 = earth(gp, 0, t2, hz - 0.015, 0.25, 0.16, 0.23, 0.145, 0.042, shade(E, 0.92), 2, TOP);
  steps(gp, 0, y0, hz + 0.17 + 0.075, 0.085, t1 + t2 - 2 * y0, 0.09, '#9f9684', 8);
  steps(gp, 0, t2, hz - 0.015 + 0.08 + 0.03, 0.065, t3 - t2, 0.035, '#9f9684', 4);
  // Main high-terrace hall with lacquer-red columns and grey tubed tiles
  const eh = body(gp, 0, t3, hz - 0.015, 0.21, 0.12, 0.048, { wall: PL, col: RED, beam: WD, bracket: RED, door: '#5a261e', doorN: 3, sp: 0.04, cr: 0.0042 });
  roof(gp, 0, eh, hz - 0.015, 0.26, 0.165, 0.044, { tile: TILE, k: 0.3, lift: 0.18, chi: BRZ, chiH: 0.022 });
  // East & West side pavilions on tier 1 linked by elevated flying bridges (复道飞阁)
  for (const sx of [-1, 1]) {
    const px = sx * 0.29, pz = -0.06;
    const pt = earth(gp, px, y0, pz, 0.14, 0.14, 0.12, 0.12, 0.072, E, 3, TOP);
    const ep = body(gp, px, pt, pz, 0.1, 0.1, 0.038, { wall: PL, col: RED, bracket: WD, sp: 0.035, cr: 0.0036 });
    roof(gp, px, ep, pz, 0.135, 0.135, 0.034, { tile: TILE, k: 0.32, lift: 0.2 });
    // Flying bridge (飞阁) spanning between main tier-2 terrace and side pavilion
    const bx = sx * 0.2, bw = 0.09;
    box(gp, RED, bx, pt - 0.008, pz, bw, 0.008, 0.036);
    corridor(gp, sx * 0.155, pz, sx * 0.24, pz, pt, 0.024, 0.03, TILE, RED);
  }
  // Bronze bianzhong rack & Jixia debate mats in the forecourt
  box(gp, WD, -0.09, y0 + 0.028, 0.13, 0.065, 0.005, 0.006);
  for (const dx of [-0.026, 0.026]) cyl(gp, WD, -0.09 + dx, y0, 0.13, 0.003, 0.03, 5);
  for (let i = 0; i < 5; i++) cone(gp, BRZ, -0.11 + i * 0.01, y0 + 0.014, 0.13, 0.0035, 0.012, 6);
  for (const [x, z, ry, c] of [[0.06, 0.12, -0.5, '#3b4d5e'], [0.11, 0.14, 2.4, '#6e3b32'], [0.08, 0.17, 1.8, '#4e5d42'], [-0.03, 0.26, 0, '#7a342a']] as [number, number, number, string][]) {
    figure(gp, x, y0, z, 0.028, c, { hat: 'cap', ry });
  }
  for (const [x, z] of [[-0.36, 0.18], [0.36, 0.18], [-0.35, -0.26], [0.35, -0.26]] as [number, number][]) tree(gp, x, y0, z, 0.062, '#697a46');
};

/**
 * 新朝王莽明堂辟雍与九庙礼制建筑 (9–23 AD, 汉长安城南郊): excavated in southern Xi'an — a circular Biyong ritual water moat
 * (辟雍环水, 直径360米缩微) enclosing a square pounded-earth terrace (天圆地方), crossed by four ceremonial stone bridges at the
 * cardinal directions, with a cruciform Twelve-Hall Mingtang (明堂四面十二室) crowned by a circular thatched-and-tiled upper drum
 * and a gilded bronze phoenix finial (铜凤立顶).
 */
const cap_xin: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WATER = '#3a6f78', STONE = '#cfc7b4', RED = '#9c3127', TILE = '#4e5258', PL = '#e6decb', GOLD = '#d8a93e';
  // Outer circular Biyong ring moat (辟雍圆水) and inner circular island
  cyl(gp, STONE, 0, y0, 0, 0.39, 0.008, 36);
  cyl(gp, WATER, 0, y0 + 0.002, 0, 0.365, 0.008, 36);
  cyl(gp, '#8a9460', 0, y0 + 0.004, 0, 0.255, 0.01, 32);
  // Four cardinal stone bridges (四方跨水石桥) and four ceremonial gatehouses (四门塾)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, G = grp(gp, 0, 0, a, y0);
    box(G, STONE, 0, 0.004, 0.31, 0.068, 0.016, 0.12);
    railRun(G, -0.032, -0.032, 0.02, 0.31, STONE);
    const eg = body(G, 0, 0.014, 0.375, 0.088, 0.044, 0.026, { wall: PL, col: RED, door: '#5a241c', doorN: 1, sp: 0.03, cr: 0.0032 });
    roof(G, 0, eg, 0.375, 0.115, 0.068, 0.022, { tile: TILE, k: 0.3, lift: 0.15 });
  }
  // Square central ritual platform (方台: 天圆地方)
  const t1 = earth(gp, 0, y0 + 0.014, 0, 0.32, 0.32, 0.3, 0.3, 0.038, '#b59b72', 3, STONE);
  rail(gp, 0, t1, 0, 0.295, 0.295, STONE, 0.065, 0.014);
  for (let k = 0; k < 4; k++) steps(grp(gp, 0, 0, (k * Math.PI) / 2, 0), 0, y0 + 0.014, 0.185, 0.058, 0.038, 0.035, STONE, 4);
  // Cruciform four-directional halls (四面堂: 青阳、明堂、总章、玄堂)
  const e0 = body(gp, 0, t1, 0, 0.18, 0.18, 0.045, { wall: PL, col: RED, bracket: RED, door: '#5a241c', doorN: 3, sp: 0.038, cr: 0.004 });
  for (const [dx, dz, w, d] of [[0, 0.095, 0.11, 0.06], [0, -0.095, 0.11, 0.06], [0.095, 0, 0.06, 0.11], [-0.095, 0, 0.06, 0.11]] as [number, number, number, number][]) {
    const ew = body(gp, dx, t1, dz, w, d, 0.04, { wall: PL, col: RED, sp: 0.035, cr: 0.0035 });
    roof(gp, dx, ew, dz, w + 0.036, d + 0.036, 0.026, { tile: TILE, k: 0.32, lift: 0.18 });
  }
  const r1 = roof(gp, 0, e0, 0, 0.23, 0.23, 0.032, { tile: TILE, k: 0.3, lift: 0.18, inner: [0.13, 0.13] });
  // Upper circular ritual drum (太室圆顶: 上圆下方) and gilded bronze phoenix finial (金凤立顶)
  cyl(gp, PL, 0, r1 - 0.004, 0, 0.068, 0.034, 16);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    cyl(gp, RED, Math.cos(a) * 0.068, r1 - 0.004, Math.sin(a) * 0.068, 0.0032, 0.034, 5);
  }
  cone(gp, TILE, 0, r1 + 0.028, 0, 0.098, 0.048, 20);
  cyl(gp, GOLD, 0, r1 + 0.074, 0, 0.008, 0.016, 8);
  ellip(gp, GOLD, 0, r1 + 0.096, 0, 0.014, 0.009, 0.02);
  cone(gp, GOLD, 0, r1 + 0.098, -0.012, 0.008, 0.018, 5);
  // Ritual figures in Xin court dress on the south bridge and plaza
  figure(gp, -0.02, y0 + 0.02, 0.29, 0.027, '#262428', { hat: 'peaked', hatC: '#1f1d20' });
  figure(gp, 0.025, y0 + 0.02, 0.31, 0.026, '#8c2d25', { hat: 'cap' });
  for (const [x, z] of [[-0.31, 0.28], [0.31, 0.28], [-0.31, -0.28], [0.31, -0.28]] as [number, number][]) tree(gp, x, y0, z, 0.056, '#5c7244');
};

/**
 * 隋大兴城太极宫 / 东都洛阳乾阳殿与天津桥 (581–618): Emperor Wen and Emperor Yang built the grand axial capital spanning the
 * Luo / Grand Canal waters via the arched stone Tianjin Bridge (天津桥), a Sui dragon barge (龙舟) gliding past willows,
 * the five-passage vermilion gate (则天门/朱雀门) flanked by twin watchtowers (东西朵楼), and the soaring Qianyuan Hall (乾阳殿) behind.
 */
const cap_sui: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WATER = '#3f6e78', WALL = '#ddd4c0', RED = '#9e3328', TILE = '#4c5258', GLAZE = '#3b7d63', STONE = '#cbc2ae', GOLD = '#d6a840';
  // Luo River / Sui Grand Canal across the foreground
  band(gp, 0.16, 0.32, y0, 0.004, WATER, 0.014);
  band(gp, 0.145, 0.162, y0, 0.008, STONE, 0.014);
  band(gp, 0.318, 0.335, y0, 0.008, STONE, 0.014);
  // Arched stone Tianjin Bridge (天津桥) on the central imperial axis
  box(gp, STONE, 0, y0 + 0.004, 0.24, 0.095, 0.022, 0.19);
  for (const dz of [-0.055, 0, 0.055]) cyl(grp(gp, 0, 0.24 + dz, 0, y0 + 0.004), '#284850', 0, 0, 0, 0.02, 0.098, 10).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) box(gp, shade(STONE, 1.06), sx * 0.044, y0 + 0.026, 0.24, 0.006, 0.012, 0.19);
  // Sui Emperor's double-decked Dragon Boat (隋炀帝龙舟) on the east canal reach
  const bx = 0.21, bz = 0.24;
  rbox(gp, '#5c3822', bx, y0 + 0.005, bz, 0.15, 0.014, 0.044, 0.006);
  box(gp, RED, bx, y0 + 0.019, bz, 0.095, 0.018, 0.032);
  roof(grp(gp, bx, bz, Math.PI / 2, 0), 0, y0 + 0.037, 0, 0.048, 0.115, 0.018, { tile: GOLD, k: 0.35, lift: 0.25 });
  cyl(gp, GOLD, bx - 0.08, y0 + 0.016, bz, 0.006, 0.022, 6).rotation.z = 0.45;
  // Battered white-plastered Sui palace rampart with 5-passage Zetian/Zhuque Gate and twin Duolou watchtowers
  const wz = 0.04;
  earth(gp, 0, y0, wz, 0.56, 0.095, 0.52, 0.082, 0.068, WALL, 4, '#bfb6a2');
  for (const dx of [-0.09, -0.045, 0, 0.045, 0.09]) box(gp, '#4f201a', dx, y0, wz + 0.043, 0.024, 0.042, 0.012);
  const eg = body(gp, 0, y0 + 0.068, wz, 0.24, 0.068, 0.036, { wall: WALL, col: RED, bracket: RED, door: '#5a221a', doorN: 5, sp: 0.038, cr: 0.0038 });
  roof(gp, 0, eg, wz, 0.29, 0.105, 0.036, { tile: TILE, edge: GLAZE, k: 0.34, lift: 0.22, chi: GOLD, chiH: 0.024 });
  for (const sx of [-1, 1]) {
    const dx = sx * 0.21;
    const ed = body(gp, dx, y0 + 0.068, wz + 0.006, 0.075, 0.062, 0.028, { wall: WALL, col: RED, sp: 0.03, cr: 0.0032 });
    roof(gp, dx, ed, wz + 0.006, 0.105, 0.09, 0.026, { tile: TILE, edge: GLAZE, k: 0.34, lift: 0.2 });
  }
  // Soaring Qianyuan / Taiji Hall (乾阳殿) on a double stepped platform in the north court
  const hz = -0.22;
  const ht1 = earth(gp, 0, y0, hz, 0.38, 0.21, 0.35, 0.19, 0.038, STONE, 2, STONE);
  const ht2 = earth(gp, 0, ht1, hz, 0.31, 0.16, 0.29, 0.15, 0.032, STONE, 2, STONE);
  steps(gp, 0, y0, hz + 0.105 + 0.045, 0.075, 0.07, 0.055, STONE, 6);
  const eh = body(gp, 0, ht2, hz, 0.26, 0.13, 0.052, { wall: WALL, col: RED, bracket: RED, door: '#5a221a', doorN: 5, sp: 0.04, cr: 0.0045 });
  const er = roof(gp, 0, eh, hz, 0.32, 0.18, 0.024, { tile: TILE, edge: GLAZE, k: 0.32, lift: 0.18, inner: [0.22, 0.105] });
  const eh2 = body(gp, 0, er, hz, 0.22, 0.105, 0.032, { wall: WALL, col: RED, bracket: RED, sp: 0.04, cr: 0.004 });
  roof(gp, 0, eh2, hz, 0.28, 0.155, 0.042, { tile: TILE, edge: GLAZE, k: 0.36, lift: 0.24, chi: GOLD, chiH: 0.028 });
  for (const [x, z] of [[-0.28, 0.35], [-0.14, 0.36], [0.14, 0.36], [0.29, 0.35]] as [number, number][]) tree(gp, x, y0, z, 0.058, '#658048');
  figure(gp, -0.02, y0 + 0.026, 0.24, 0.027, '#c88a2e', { hat: 'cap' });
  figure(gp, 0.025, y0 + 0.026, 0.26, 0.026, '#7a2e28', { hat: 'cap' });
};

/**
 * 五代十国 · 汴梁宫城周桥水门与南唐澄心堂 (907–960): Five Dynasties Bianliang (Kaifeng) and Southern Tang Jinling combined
 * fortified brick water-gates spanning the busy Bian Canal (汴河水门与周桥), grain barges passing beneath, and refined
 * multi-eaved court halls (澄心堂) where scholar-officials in wide-winged 幞头 caps gathered.
 */
const cap_wudai: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#6d6f74', WALL = '#e2dac8', RED = '#943228', TILE = '#4a4f55', WATER = '#426b72', STONE = '#c8bfa9', WD = '#523824';
  // Bian Canal (汴河) curving front-to-east with stone embankment and Zhou Bridge (周桥)
  band(gp, 0.15, 0.29, y0, 0.004, WATER, 0.015);
  box(gp, STONE, -0.04, y0 + 0.004, 0.22, 0.088, 0.02, 0.16);
  railRun(gp, -0.08, -0.08, y0 + 0.024, 0.22, STONE);
  // Canal tribute barge passing along the Bian River
  rbox(gp, WD, 0.17, y0 + 0.005, 0.22, 0.14, 0.014, 0.042, 0.005);
  box(gp, '#b99e6b', 0.17, y0 + 0.019, 0.22, 0.08, 0.016, 0.03);
  // Fortified brick barbican wall (五代瓮城与水门) with arched water-gate and main portal
  const wz = 0.02;
  earth(gp, 0, y0, wz, 0.54, 0.09, 0.5, 0.078, 0.065, BRICK, 4, '#8b8880');
  // Semicircular barbican (月城/瓮城) projecting forward around the central gate
  for (const sx of [-1, 1]) box(gp, BRICK, sx * 0.1, y0, wz + 0.055, 0.024, 0.052, 0.06);
  box(gp, '#3f1d18', -0.04, y0, wz + 0.042, 0.034, 0.042, 0.014);
  cyl(grp(gp, 0.14, wz, 0, y0), '#28454a', 0, 0, 0, 0.026, 0.095, 10).rotation.x = Math.PI / 2;
  const eg = body(gp, -0.04, y0 + 0.065, wz, 0.2, 0.064, 0.036, { wall: WALL, col: RED, bracket: RED, door: '#5a221a', doorN: 3, sp: 0.038, cr: 0.0038 });
  roof(gp, -0.04, eg, wz, 0.25, 0.1, 0.036, { tile: TILE, k: 0.36, lift: 0.26, xie: 0.68, chi: '#c9a042', chiH: 0.022 });
  // Main palace hall (汴梁崇元殿 / 南唐澄心堂) with east-west side galleries and scholar pavilion
  const hz = -0.21;
  const ht = earth(gp, -0.03, y0, hz, 0.34, 0.18, 0.32, 0.16, 0.042, STONE, 2, STONE);
  steps(gp, -0.03, y0, hz + 0.09 + 0.035, 0.07, 0.042, 0.04, STONE, 5);
  const eh = body(gp, -0.03, ht, hz, 0.26, 0.13, 0.048, { wall: WALL, col: RED, bracket: RED, door: '#5a221a', doorN: 5, sp: 0.04, cr: 0.0042 });
  roof(gp, -0.03, eh, hz, 0.31, 0.175, 0.045, { tile: TILE, k: 0.38, lift: 0.28, xie: 0.66, chi: '#c9a042', chiH: 0.026 });
  // Waterside garden pavilion (澄心堂水榭) on the east
  const px = 0.22, pz = -0.15;
  const ep = body(gp, px, y0 + 0.012, pz, 0.095, 0.085, 0.036, { wall: WALL, col: RED, sp: 0.032, cr: 0.0035 });
  rbox(gp, STONE, px, y0, pz, 0.115, 0.012, 0.105, 0.003);
  roof(gp, px, ep, pz, 0.13, 0.12, 0.034, { tile: TILE, k: 0.4, lift: 0.3, xie: 0.65 });
  for (const [x, z] of [[-0.28, 0.34], [0.28, 0.34], [0.28, -0.28], [-0.28, -0.26]] as [number, number][]) tree(gp, x, y0, z, 0.06, '#647b47');
  figure(gp, -0.04, y0 + 0.024, 0.22, 0.027, '#584468', { hat: 'cap' });
  figure(gp, 0.01, y0 + 0.024, 0.24, 0.027, '#8a332a', { hat: 'cap' });
};

/**
 * 金上京会宁府 / 金中都大安殿 (1115–1234): Jurchen Jin imperial palace combining Northern Song structural grandeur with Jurchen
 * gold-and-green glazed tile trim (黄心绿剪边琉璃瓦), a three-tiered white marble 须弥座 terrace with dragon-carved royal ramps,
 * flanking corner pavilions (东西角楼) on high masonry bastions, and the iconic gilt-bronze seated dragon (金上京铜坐龙) in the court.
 */
const cap_jin: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#e2dcd0', WALL = '#e4dccb', RED = '#9c2f25', GOLD = '#cfa13a', GREEN = '#2f7a58', TILE = '#3d6e54';
  band(gp, 0.29, 0.41, y0, 0.002, '#b8b09e', 0.018);
  // Three-tiered white marble 须弥座 terrace in I-shaped (工字殿) imperial plan
  const hz = -0.1;
  const t1 = earth(gp, 0, y0, hz, 0.48, 0.26, 0.46, 0.24, 0.026, MARBLE, 2, MARBLE);
  const t2 = earth(gp, 0, t1, hz, 0.41, 0.21, 0.39, 0.195, 0.024, shade(MARBLE, 0.98), 2, MARBLE);
  const t3 = earth(gp, 0, t2, hz, 0.34, 0.165, 0.33, 0.155, 0.022, shade(MARBLE, 0.96), 2, MARBLE);
  rail(gp, 0, t1, hz, 0.45, 0.23, MARBLE, 0.1, 0.013);
  rail(gp, 0, t3, hz, 0.32, 0.15, MARBLE, 0.085, 0.013);
  // Triple staircase with central carved dragon royal ramp (御路丹陛)
  for (const dx of [-0.032, 0.032]) steps(gp, dx, y0, hz + 0.12 + 0.065, 0.024, t3 - y0, 0.075, MARBLE, 7);
  ramp(gp, 0, y0, hz + 0.12 + 0.065, 0.036, t3 - y0, 0.075, shade(MARBLE, 0.92));
  // Daan Hall (大安殿): double-eaved hip-and-gable roof with golden center and emerald-green trim (绿剪边)
  const eh1 = body(gp, 0, t3, hz, 0.29, 0.135, 0.044, { wall: WALL, col: RED, bracket: GOLD, door: '#5a2018', doorN: 5, sp: 0.036, cr: 0.0042 });
  const er1 = roof(gp, 0, eh1, hz, 0.35, 0.185, 0.022, { tile: GOLD, edge: GREEN, k: 0.34, lift: 0.22, inner: [0.24, 0.11] });
  const eh2 = body(gp, 0, er1, hz, 0.24, 0.11, 0.03, { wall: WALL, col: RED, bracket: GOLD, sp: 0.036, cr: 0.0038 });
  roof(gp, 0, eh2, hz, 0.31, 0.165, 0.044, { tile: GOLD, edge: GREEN, k: 0.38, lift: 0.28, xie: 0.68, chi: GOLD, chiH: 0.028 });
  // East & West elevated corner towers (应天门东西朵楼/角楼) connected by crimson perimeter walls
  for (const sx of [-1, 1]) {
    const cx = sx * 0.27, cz = 0.16;
    box(gp, RED, sx * 0.16, y0, cz, 0.14, 0.042, 0.026);
    const ct = earth(gp, cx, y0, cz, 0.11, 0.11, 0.096, 0.096, 0.056, '#7a756c', 3, MARBLE);
    const ec = body(gp, cx, ct, cz, 0.082, 0.082, 0.034, { wall: WALL, col: RED, bracket: GREEN, sp: 0.03, cr: 0.0035 });
    roof(gp, cx, ec, cz, 0.12, 0.12, 0.034, { tile: TILE, edge: GOLD, k: 0.38, lift: 0.28, xie: 0.65 });
  }
  // Iconic Gilt-Bronze Seated Dragon of Jin Shangjing (金上京铜坐龙) on a white marble pedestal in the forecourt
  box(gp, MARBLE, -0.1, y0, 0.15, 0.044, 0.022, 0.044);
  cyl(gp, GOLD, -0.1, y0 + 0.022, 0.15, 0.012, 0.028, 8);
  ellip(gp, GOLD, -0.1, y0 + 0.054, 0.155, 0.011, 0.009, 0.015);
  cone(gp, GOLD, -0.1, y0 + 0.045, 0.138, 0.006, 0.022, 5);
  // Jurchen emperor and guards in Jin attire
  figure(gp, 0, y0, 0.18, 0.028, '#c89632', { hat: 'peaked', hatC: GOLD });
  for (const sx of [-1, 1]) figure(gp, sx * 0.055, y0, 0.22, 0.027, '#7a2c24', { hat: 'helmet', armor: '#4a4640' });
  for (const [x, z] of [[-0.36, -0.25], [0.36, -0.25]] as [number, number][]) tree(gp, x, y0, z, 0.062, '#4f6842');
};

/**
 * 明代两京皇城 · 承天门外金水桥华表与奉天殿 (1368–1644): Ming imperial axial ensemble founded at Nanjing (应天府) and Beijing
 * (顺天府) — the curved Outer Golden Water River (外金水河) spanned by five white marble bridges (五座金水桥), a pair of carved
 * cloud-dragon Huabiao pillars (汉白玉华表) and gilt bronze lions, the crimson five-passage Chengtian Gate (承天门), and behind
 * it the towering Fengtian Hall (奉天殿) on its three-tiered white marble terrace.
 */
const cap_ming: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#ece6da', RED = '#9e2b22', GOLD = '#da9e28', WALL = '#e8dfd0', WATER = '#3c6d78', BRZ = '#b88c32';
  // Outer Golden Water River (外金水河) and five arched white marble bridges (外金水桥)
  band(gp, 0.22, 0.31, y0, 0.004, WATER, 0.016);
  for (const sz of [0.215, 0.315]) band(gp, sz - 0.006, sz + 0.006, y0, 0.008, MARBLE, 0.016);
  for (const [dx, w] of [[-0.14, 0.032], [-0.07, 0.036], [0, 0.046], [0.07, 0.036], [0.14, 0.032]] as [number, number][]) {
    box(gp, MARBLE, dx, y0 + 0.004, 0.265, w, 0.018, 0.115);
    for (const sx of [-1, 1]) box(gp, MARBLE, dx + sx * (w / 2 - 0.003), y0 + 0.022, 0.265, 0.005, 0.01, 0.115);
  }
  // Twin carved white marble Huabiao (云龙华表) and bronze lions flanking the approach
  for (const sx of [-1, 1]) {
    const hx = sx * 0.21, hz = 0.35;
    box(gp, MARBLE, hx, y0, hz, 0.028, 0.012, 0.028);
    cyl(gp, MARBLE, hx, y0 + 0.012, hz, 0.007, 0.068, 8);
    box(gp, MARBLE, hx, y0 + 0.072, hz, 0.026, 0.005, 0.01);
    cyl(gp, MARBLE, hx, y0 + 0.08, hz, 0.01, 0.006, 8);
    ellip(gp, BRZ, hx, y0 + 0.09, hz, 0.006, 0.008, 0.006);
    // Bronze guardian lion (铜狮)
    box(gp, MARBLE, sx * 0.055, y0, 0.175, 0.02, 0.012, 0.02);
    ellip(gp, BRZ, sx * 0.055, y0 + 0.02, 0.175, 0.008, 0.011, 0.01);
  }
  // Crimson battered Chengtian Gate (承天门) with five arched portals
  const wz = 0.09;
  earth(gp, 0, y0, wz, 0.5, 0.095, 0.46, 0.082, 0.068, RED, 4, MARBLE);
  rail(gp, 0, y0 + 0.068, wz, 0.45, 0.078, MARBLE, 0, 0.012);
  for (const [dx, r] of [[-0.12, 0.013], [-0.06, 0.014], [0, 0.017], [0.06, 0.014], [0.12, 0.013]] as [number, number][]) {
    box(gp, '#3c1410', dx, y0, wz + 0.042, r * 1.8, 0.04, 0.012);
  }
  const eg = body(gp, 0, y0 + 0.068, wz, 0.28, 0.068, 0.036, { wall: RED, col: RED, bracket: GOLD, door: '#5a1e16', doorN: 5, sp: 0.038, cr: 0.004 });
  roof(gp, 0, eg, wz, 0.34, 0.11, 0.038, { tile: GOLD, k: 0.36, lift: 0.24, xie: 0.68, chi: GOLD, chiH: 0.024 });
  // Towering Ming Fengtian Hall (奉天殿) on a 3-tiered white marble Sumeru terrace in the north court
  const fz = -0.2;
  const ft1 = earth(gp, 0, y0, fz, 0.44, 0.22, 0.42, 0.2, 0.026, MARBLE, 2, MARBLE);
  const ft2 = earth(gp, 0, ft1, fz, 0.38, 0.18, 0.36, 0.17, 0.024, MARBLE, 2, MARBLE);
  const ft3 = earth(gp, 0, ft2, fz, 0.32, 0.145, 0.31, 0.138, 0.022, MARBLE, 2, MARBLE);
  rail(gp, 0, ft1, fz, 0.41, 0.195, MARBLE, 0.09, 0.012);
  rail(gp, 0, ft3, fz, 0.3, 0.135, MARBLE, 0.08, 0.012);
  for (const dx of [-0.028, 0.028]) steps(gp, dx, y0, fz + 0.11 + 0.055, 0.022, ft3 - y0, 0.065, MARBLE, 6);
  ramp(gp, 0, y0, fz + 0.11 + 0.055, 0.032, ft3 - y0, 0.065, shade(MARBLE, 0.94));
  const fh1 = body(gp, 0, ft3, fz, 0.28, 0.125, 0.044, { wall: WALL, col: RED, bracket: GOLD, door: '#5a1e16', doorN: 5, sp: 0.036, cr: 0.0042 });
  const fr1 = roof(gp, 0, fh1, fz, 0.34, 0.175, 0.022, { tile: GOLD, k: 0.34, lift: 0.22, inner: [0.23, 0.1] });
  const fh2 = body(gp, 0, fr1, fz, 0.23, 0.1, 0.03, { wall: WALL, col: RED, bracket: GOLD, sp: 0.036, cr: 0.0038 });
  roof(gp, 0, fh2, fz, 0.3, 0.155, 0.044, { tile: GOLD, k: 0.38, lift: 0.26, chi: GOLD, chiH: 0.028 });
  // Ming court officials in 乌纱帽 and crimson robes on the Golden Water Bridges
  figure(gp, 0, y0 + 0.022, 0.265, 0.027, '#9e2620', { hat: 'cap', hatC: '#1e1c1a' });
  figure(gp, -0.07, y0 + 0.022, 0.275, 0.026, '#2b4562', { hat: 'cap', hatC: '#1e1c1a' });
  for (const [x, z] of [[-0.36, -0.04], [0.36, -0.04]] as [number, number][]) tree(gp, x, y0, z, 0.06, '#48643e');
};

/**
 * 远古人类 · 周口店龙骨山猿人洞与圣火营地 (c. 1.7M–10,000 BC): Limestone karst cavern of Dragon Bone Hill (周口店龙骨山第一地点猿人洞),
 * stratified ash-and-fossil layers, persistent hearth fire ringed by river cobbles, chipped quartz choppers (打制砾石石器),
 * charred deer antlers, and early hominins tending the sacred fire.
 */
const cap_paleo: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const ROCK = '#7e786c', DARK = '#28231e', ASH = '#58524a', OCHRE = '#b67848', WATER = '#4a6e74';
  band(gp, 0.24, 0.38, y0, 0.004, WATER, 0.015);
  // Dragon Bone Hill limestone karst massif (龙骨山石灰岩洞穴穹隆) at north
  hill(gp, -0.04, y0, -0.16, 0.34, 0.22, 0.19, ROCK);
  hill(gp, 0.22, y0, -0.12, 0.18, 0.16, 0.14, shade(ROCK, 0.92));
  // Cavern arch mouth & stratified ash layers (北京人遗址灰烬层)
  box(gp, DARK, -0.04, y0 + 0.012, -0.02, 0.16, 0.088, 0.08);
  box(gp, OCHRE, -0.04, y0, 0.05, 0.28, 0.014, 0.12);
  box(gp, ASH, -0.04, y0 + 0.014, 0.05, 0.22, 0.008, 0.09);
  // Sacred hearth fire ringed by boulders & stone-knapping anvil
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ellip(gp, '#645e54', -0.04 + Math.cos(a) * 0.042, y0 + 0.026, 0.07 + Math.sin(a) * 0.042, 0.012, 0.009, 0.012);
  }
  cone(gp, '#e86420', -0.04, y0 + 0.024, 0.07, 0.024, 0.052, 7);
  cone(gp, '#f6bc38', -0.04, y0 + 0.03, 0.07, 0.014, 0.036, 6);
  // Chipped quartz cores, bone tools, deer antlers & hominins in hide wraps
  for (const [x, z] of [[-0.18, 0.12], [0.1, 0.11], [0.16, 0.04]] as [number, number][]) {
    ellip(gp, '#c8bfa8', x, y0 + 0.01, z, 0.014, 0.008, 0.011);
  }
  for (const dx of [-0.09, -0.04, 0.01]) cone(gp, '#948d7f', dx, y0 + 0.088, 0.018, 0.007, -0.022, 6);
  figure(gp, -0.11, y0 + 0.02, 0.08, 0.028, '#6e4c2e', { ry: 0.8 });
  figure(gp, 0.05, y0 + 0.02, 0.09, 0.027, '#583c24', { ry: -0.9 });
  figure(gp, -0.02, y0 + 0.02, 0.16, 0.027, '#755334', { ry: 2.8, pose: 'point' });
  tree(gp, -0.32, y0, 0.06, 0.068, '#546b3e');
  tree(gp, 0.3, y0, 0.1, 0.062, '#5c7444');
  tree(gp, -0.26, y0, -0.22, 0.058, '#4e6338');
};

/**
 * 新石器时代 · 仰韶半坡环壕聚落大房子与红山祭坛 (c. 10,000–2070 BC): Oval defensive moat (环壕聚落), central communal assembly
 * hall (半坡F1大型半地穴式大房子) surrounded by round thatched pit-houses, Hemudu-style stilt granary (河姆渡干栏式建筑),
 * painted pottery kiln, and three-tiered circular stone altar (红山文化三层圆坛).
 */
const cap_neo: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const LOESS = '#b29464', TH = '#7c643e', WALL = '#cbb892', STONE = '#9a9282', CLAY = '#bc5838';
  // Protective defensive ditch (仰韶环壕) along the south
  band(gp, 0.24, 0.33, y0, 0.004, '#5a6e68', 0.015);
  box(gp, LOESS, 0, y0 + 0.003, 0.285, 0.08, 0.012, 0.11);
  // Central communal F1 Great House (半坡F1大房子) with wide eaves & front porch
  const hx = -0.06, hz = -0.06;
  earth(gp, hx, y0, hz, 0.24, 0.2, 0.22, 0.18, 0.018, LOESS, 2, LOESS);
  const eh = body(gp, hx, y0 + 0.018, hz, 0.18, 0.14, 0.038, { wall: WALL, col: '#684428', door: '#3a2618', doorN: 1, sp: 0.036, cr: 0.004 });
  roof(gp, hx, eh, hz, 0.25, 0.21, 0.056, { tile: TH, thatch: true, k: 0.06, ridge: shade(TH, 0.78) });
  // Surrounding round semi-subterranean thatched huts (圆形半地穴式茅屋)
  for (const [x, z, r] of [[-0.26, 0.06, 0.062], [-0.24, -0.16, 0.056], [0.14, -0.2, 0.058]] as [number, number, number][]) {
    cyl(gp, WALL, x, y0, z, r * 0.82, 0.032, 12);
    cone(gp, TH, x, y0 + 0.028, z, r, 0.058, 12);
    box(gp, TH, x, y0 + 0.016, z + r * 0.78, 0.026, 0.028, 0.024);
  }
  // Raised Hemudu timber stilt house (河姆渡干栏式长屋) on the east
  const sx = 0.21, sz = 0.06;
  for (const dx of [-0.055, 0, 0.055]) for (const dz of [-0.035, 0.035]) cyl(gp, '#5c3c22', sx + dx, y0, sz + dz, 0.004, 0.032, 6);
  box(gp, '#8a623c', sx, y0 + 0.032, sz, 0.14, 0.032, 0.09);
  gable(gp, 0.17, 0.048, 0.12, TH, sx, y0 + 0.064, sz);
  // Hongshan three-tiered circular stone altar (红山三层圆坛) & painted pottery jars (人面鱼纹彩陶盆/尖底瓶)
  for (const [i, r] of [[0, 0.058], [1, 0.042], [2, 0.026]] as [number, number][]) {
    cyl(gp, STONE, -0.22, y0 + i * 0.012, 0.2, r, 0.012, 16);
  }
  for (const [x, z] of [[0.06, 0.14], [0.1, 0.16]] as [number, number][]) ellip(gp, CLAY, x, y0 + 0.014, z, 0.012, 0.015, 0.012);
  figure(gp, -0.02, y0, 0.14, 0.028, '#8a6a44', { ry: 0.3 });
  figure(gp, 0.06, y0, 0.18, 0.027, '#6e5236', { ry: -0.6 });
  figure(gp, -0.22, y0 + 0.036, 0.2, 0.027, '#9c432c', { ry: 0.2, pose: 'pray' });
  tree(gp, -0.34, y0, -0.05, 0.058, '#58703e');
  tree(gp, 0.31, y0, -0.12, 0.056, '#58703e');
};

/**
 * 三国鼎立 · 魏洛阳金墉铜雀台、蜀成都锦官城与吴建业石头城 (220–280): Tripartite Three Kingdoms capital synthesis — Cao Wei's
 * towering rammed-earth terrace and flying bridge (曹魏洛阳金墉城/邺城铜雀三台飞阁) at north, Shu Han's Chengdu Jinguan Palace
 * (蜀汉成都皇城) at southwest, and Eastern Wu's Jianye Stone Fortress & naval tower-ship (东吴建业石头城与长江水军) at southeast.
 */
const cap_sanguo: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const RAM = '#a88c62', WALL = '#e0d6c2', RED = '#8e2c22', TILE = '#464a50', WATER = '#3a6872', BRZ = '#c89b38';
  // Yangtze & Yellow River divide band across the south-east
  band(gp, 0.16, 0.3, y0, 0.004, WATER, 0.015);
  // 1. Cao Wei North Terrace: Main Tongque/Jinyong Terrace + flanking Ice-Well/Golden-Phoenix terraces linked by flying bridges (飞阁)
  const wz = -0.16;
  const tMain = earth(gp, 0, y0, wz, 0.24, 0.16, 0.21, 0.14, 0.072, RAM, 4, '#b89c72');
  const eh = body(gp, 0, tMain, wz, 0.17, 0.1, 0.044, { wall: WALL, col: RED, bracket: RED, door: '#4a1e18', doorN: 3, sp: 0.036, cr: 0.004 });
  roof(gp, 0, eh, wz, 0.22, 0.145, 0.042, { tile: TILE, k: 0.32, lift: 0.2, xie: 0.68, chi: BRZ, chiH: 0.024 });
  for (const sx of [-1, 1]) {
    const tx = sx * 0.24, tz = -0.14;
    const ts = earth(gp, tx, y0, tz, 0.13, 0.12, 0.11, 0.1, 0.056, RAM, 3, '#b89c72');
    const es = body(gp, tx, ts, tz, 0.09, 0.08, 0.034, { wall: WALL, col: RED, sp: 0.03, cr: 0.0035 });
    roof(gp, tx, es, tz, 0.13, 0.115, 0.032, { tile: TILE, k: 0.3, lift: 0.18 });
    // Elevated timber flying bridge (飞阁复道)
    corridor(gp, sx * 0.1, wz, sx * 0.18, tz, y0 + 0.052, 0.024, 0.032, TILE, RED, { wall: WALL });
  }
  // 2. Shu Han Southwest Courtyard Hall (蜀汉成都宫城与武侯祠柏树)
  const st = earth(gp, -0.18, y0, 0.08, 0.18, 0.13, 0.17, 0.12, 0.024, '#8c7e68', 2);
  const esh = body(gp, -0.18, st, 0.08, 0.14, 0.095, 0.036, { wall: WALL, col: RED, door: '#4a1e18', doorN: 3, sp: 0.034, cr: 0.0038 });
  roof(gp, -0.18, esh, 0.08, 0.18, 0.13, 0.036, { tile: TILE, k: 0.34, lift: 0.22, xie: 0.68 });
  // 3. Eastern Wu Southeast Stone Fortress (东吴建业石头城赤壁城垣) & Yangtze樓船 warship
  const wt = earth(gp, 0.18, y0, 0.06, 0.18, 0.12, 0.16, 0.1, 0.042, '#9e5842', 3, '#884a36');
  const ewu = body(gp, 0.18, wt, 0.06, 0.12, 0.08, 0.034, { wall: WALL, col: RED, sp: 0.032, cr: 0.0035 });
  roof(gp, 0.18, ewu, 0.06, 0.16, 0.11, 0.034, { tile: TILE, k: 0.36, lift: 0.24 });
  rbox(gp, '#5a3a22', 0.12, y0 + 0.005, 0.23, 0.14, 0.016, 0.044, 0.005);
  box(gp, WALL, 0.12, y0 + 0.021, 0.23, 0.075, 0.022, 0.032);
  figure(gp, 0, y0, 0.04, 0.028, '#28262a', { hat: 'peaked', hatC: BRZ });
  tree(gp, -0.32, y0, 0.12, 0.062, '#3e6238');
};

/**
 * 南北朝 · 北魏洛阳永宁寺九层木塔与南朝建康千寺瓦官阁 (420–589): Northern Wei Luoyang's towering 9-storey Yongning Temple
 * timber pagoda (北魏洛阳永宁寺九层百尺木塔，朱柱金刹) on a white stone Sumeru terrace at northwest, paired with Southern
 * Dynasties Jiankang's misty monastery pavilion (南朝四百八十寺楼台烟雨) and rock-cut Buddhist grotto niches at southeast.
 */
const cap_nanbei: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#d8d0be', WALL = '#e6decb', RED = '#982e24', TILE = '#484d54', GOLD = '#d8a634', WATER = '#426d74';
  band(gp, 0.16, 0.29, y0, 0.004, WATER, 0.015);
  // Northern Wei Luoyang Yongning Temple 9-storey timber pagoda (北魏洛阳永宁寺九层木塔) on square Sumeru platform
  const px = -0.13, pz = -0.1;
  const pt = earth(gp, px, y0, pz, 0.22, 0.22, 0.2, 0.2, 0.032, STONE, 2, STONE);
  steps(gp, px, y0, pz + 0.11 + 0.03, 0.05, 0.032, 0.035, STONE, 4);
  let py = pt;
  for (let i = 0; i < 9; i++) {
    const k = 1 - i * 0.078, w = 0.145 * k, h = (i === 0 ? 0.032 : 0.021) * (1 - i * 0.03);
    box(gp, WALL, px, py, pz, w * 0.84, h, w * 0.84);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(gp, RED, px + sx * w * 0.42, py, pz + sz * w * 0.42, 0.003, h, 5);
    roof(gp, px, py + h, pz, w + 0.032, w + 0.032, 0.015, { tile: TILE, k: 0.34, lift: 0.22 });
    py += h + 0.012;
  }
  cyl(gp, GOLD, px, py, pz, 0.005, 0.048, 8);
  ellip(gp, GOLD, px, py + 0.024, pz, 0.009, 0.014, 0.009);
  // Southern Dynasties Jiankang monastery hall & waterside pavilion (南朝建康同泰寺/瓦官寺阁)
  const sx = 0.17, sz = -0.06;
  const st = earth(gp, sx, y0, sz, 0.22, 0.15, 0.2, 0.135, 0.024, STONE, 2, STONE);
  const eh = body(gp, sx, st, sz, 0.17, 0.105, 0.042, { wall: WALL, col: RED, bracket: RED, door: '#4a1e18', doorN: 3, sp: 0.036, cr: 0.0038 });
  roof(gp, sx, eh, sz, 0.22, 0.15, 0.04, { tile: TILE, k: 0.4, lift: 0.3, xie: 0.66, chi: GOLD, chiH: 0.022 });
  // Carved Buddhist grotto cliff niche (北朝石窟大佛龛) on the northeast
  tbox(gp, 0.14, 0.08, 0.12, 0.065, 0.095, '#b8a47e', 0.06, y0, -0.26);
  box(gp, '#342c24', 0.06, y0 + 0.01, -0.22, 0.052, 0.064, 0.016);
  figure(gp, 0.06, y0 + 0.012, -0.215, 0.046, GOLD, { hat: 'knot', hatC: GOLD });
  figure(gp, -0.02, y0, 0.08, 0.028, '#8a2e26', { hat: 'cap' });
  figure(gp, 0.12, y0, 0.09, 0.027, '#4c6278', { hat: 'cap' });
  tree(gp, -0.32, y0, 0.12, 0.062, '#587444');
  tree(gp, 0.31, y0, 0.1, 0.06, '#587444');
};

/**
 * 辽上京临潢府 · 大内开皇殿、南北双城与契丹四时捺钵金帐 (916–1125): Khitan Liao Supreme Capital combining the northern Imperial
 * Palace (大内开皇殿), octagonal brick dense-eave Liao pagoda (辽上京八角密檐砖塔), and the nomadic Imperial Nabo Golden Yurt
 * (契丹四时捺钵大金帐) with camel-drawn felt wagon (毡车) and golden wolf-head banner.
 */
const cap_liao: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const RAM = '#a89068', WALL = '#e4dcc8', RED = '#942e24', TILE = '#464c52', GREEN = '#2e7654', GOLD = '#d8a632', FELT = '#f0eadc';
  // Battered rammed-earth dividing wall between Northern Imperial City (皇城) and Southern Han City (汉城)
  earth(gp, 0, y0, 0.06, 0.56, 0.068, 0.52, 0.056, 0.048, RAM, 3, '#b8a078');
  box(gp, '#321c16', 0, y0, 0.06, 0.044, 0.038, 0.072);
  // Kaihuang Hall (辽上京大内开皇殿) with bold Liao timber frame & green-edged glazed roof
  const hz = -0.16;
  const ht = earth(gp, -0.08, y0, hz, 0.28, 0.16, 0.26, 0.145, 0.032, '#cfc6b2', 2);
  steps(gp, -0.08, y0, hz + 0.08 + 0.03, 0.055, 0.032, 0.035, '#cfc6b2', 4);
  const eh = body(gp, -0.08, ht, hz, 0.22, 0.115, 0.044, { wall: WALL, col: RED, bracket: RED, door: '#4e1e18', doorN: 3, sp: 0.038, cr: 0.0042 });
  roof(gp, -0.08, eh, hz, 0.27, 0.16, 0.042, { tile: TILE, edge: GREEN, k: 0.34, lift: 0.22, xie: 0.68, chi: GOLD, chiH: 0.024 });
  // Octagonal 7-tier dense-eave brick Liao pagoda (辽代八角密檐砖塔) at northeast
  const px = 0.21, pz = -0.16;
  cyl(gp, '#d4cab6', px, y0, pz, 0.056, 0.026, 8);
  cyl(gp, '#dfd6c4', px, y0 + 0.026, pz, 0.044, 0.048, 8);
  let py = y0 + 0.074;
  for (let i = 0; i < 7; i++) {
    const r = 0.048 * (1 - i * 0.075);
    cone(gp, '#585c62', px, py, pz, r, 0.011, 8);
    cyl(gp, '#d4cab6', px, py + 0.01, pz, r * 0.76, 0.01, 8);
    py += 0.017;
  }
  cone(gp, GOLD, px, py, pz, 0.012, 0.03, 8);
  // Khitan Imperial Nabo Golden Yurt (契丹捺钵大金帐) & felt wagon in the southern steppe forecourt
  const yx = -0.14, yz = 0.2;
  cyl(gp, '#b89658', yx, y0, yz, 0.095, 0.012, 16);
  cyl(gp, FELT, yx, y0 + 0.012, yz, 0.082, 0.044, 16);
  box(gp, RED, yx, y0 + 0.034, yz, 0.168, 0.008, 0.168);
  cone(gp, FELT, yx, y0 + 0.056, yz, 0.086, 0.042, 16);
  cone(gp, GOLD, yx, y0 + 0.092, yz, 0.024, 0.018, 12);
  // Golden banner standard & Khitan figures
  cyl(gp, GOLD, yx + 0.11, y0, yz - 0.02, 0.003, 0.11, 6);
  ellip(gp, GOLD, yx + 0.11, y0 + 0.115, yz - 0.02, 0.008, 0.01, 0.008);
  figure(gp, 0.06, y0, 0.2, 0.028, '#8e2c24', { hat: 'peaked', hatC: GOLD });
  figure(gp, 0.12, y0, 0.22, 0.027, '#3c4e62', { hat: 'fur' });
};

/**
 * 西夏兴庆府 · 大内绿琉璃宫殿、贺兰山拜寺口双塔与西夏文御碑 (1038–1227): Western Xia capital Xingqing (Yinchuan) backed by the
 * Helan Mountains (贺兰山), imperial palace crowned with emerald-green glazed tiles and towering glazed owl-tail finials
 * (绿琉璃瓦与琉璃鸱尾), Baisikou twin Buddhist pagodas (拜寺口双塔), and Tangut-script royal stele pavilion (西夏文碑亭).
 */
const cap_xixia: Builder = root => {
  const [gp, y0] = site(root, SITE.sand, 0.88);
  const MTN = '#7a6c58', WALL = '#e6dec8', RED = '#982c22', GREEN = '#1f7a52', GOLD = '#da9e28', BRICK = '#c4a878';
  // Helan Mountain ridges (贺兰山脉) along the north-west horizon & Yellow River irrigation channel in front
  hill(gp, -0.24, y0, -0.24, 0.18, 0.12, 0.15, MTN);
  hill(gp, 0.22, y0, -0.25, 0.16, 0.11, 0.13, shade(MTN, 0.92));
  band(gp, 0.24, 0.35, y0, 0.004, '#3c6e76', 0.015);
  // Xingqing Imperial Palace (兴庆府大内宫殿) with Western Xia emerald-green glazed roof & tall Kalavinka/Chiwei finials
  const hz = -0.08;
  const ht1 = earth(gp, 0, y0, hz, 0.34, 0.19, 0.32, 0.175, 0.026, '#d6ccb8', 2);
  const ht2 = earth(gp, 0, ht1, hz, 0.28, 0.15, 0.26, 0.14, 0.022, '#e2d9c6', 2);
  steps(gp, 0, y0, hz + 0.095 + 0.035, 0.06, 0.048, 0.045, '#d6ccb8', 5);
  const eh = body(gp, 0, ht2, hz, 0.23, 0.115, 0.046, { wall: WALL, col: RED, bracket: GOLD, door: '#521e16', doorN: 5, sp: 0.038, cr: 0.0042 });
  roof(gp, 0, eh, hz, 0.29, 0.165, 0.046, { tile: GREEN, edge: GOLD, k: 0.38, lift: 0.28, xie: 0.66, chi: GREEN, chiH: 0.032 });
  // Baisikou-style octagonal multi-tier Western Xia brick pagodas (西夏佛塔) flanking the court
  for (const sx of [-1, 1]) {
    const px = sx * 0.25, pz = 0.04;
    cyl(gp, BRICK, px, y0, pz, 0.042, 0.032, 8);
    let py = y0 + 0.032;
    for (let i = 0; i < 7; i++) {
      const r = 0.042 * (1 - i * 0.08);
      cone(gp, GREEN, px, py, pz, r * 1.12, 0.01, 8);
      cyl(gp, BRICK, px, py + 0.009, pz, r * 0.78, 0.011, 8);
      py += 0.017;
    }
    cone(gp, GOLD, px, py, pz, 0.011, 0.026, 8);
  }
  // Tangut-script royal stele on tortoise Bixi pedestal (西夏文重修护国寺感应塔碑)
  ellip(gp, '#8a8274', -0.12, y0 + 0.008, 0.14, 0.016, 0.008, 0.022);
  box(gp, '#cfc6b2', -0.12, y0 + 0.014, 0.14, 0.024, 0.048, 0.008);
  figure(gp, 0.02, y0, 0.15, 0.028, '#ebe4d4', { hat: 'peaked', hatC: GOLD });
  figure(gp, 0.08, y0, 0.17, 0.027, '#982c22', { hat: 'cap' });
};

/**
 * 清京师顺天府 · 紫禁城太和殿、乾清门丹陛铜鹤日晷与天坛祈年殿 (1644–1912): Qing Beijing imperial synthesis pairing the Hall of
 * Supreme Harmony (紫禁城太和殿) on its three-tiered white marble Sumeru terrace with sundial, grain measure, bronze crane and
 * gilt water vats, alongside the iconic triple-eaved cobalt-blue circular Hall of Prayer for Good Harvests (天坛祈年殿).
 */
const cap_qing: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#f0ebe0', RED = '#9c2820', GOLD = '#e0a424', BLUE = '#1f4488', BRZ = '#c49630';
  // 1. Hall of Supreme Harmony (太和殿) on three-tiered white marble Sumeru terrace at north-west
  const hx = -0.11, hz = -0.12;
  const t1 = earth(gp, hx, y0, hz, 0.38, 0.21, 0.36, 0.195, 0.024, MARBLE, 2, MARBLE);
  const t2 = earth(gp, hx, t1, hz, 0.33, 0.175, 0.31, 0.16, 0.022, MARBLE, 2, MARBLE);
  const t3 = earth(gp, hx, t2, hz, 0.28, 0.14, 0.27, 0.132, 0.02, MARBLE, 2, MARBLE);
  rail(gp, hx, t1, hz, 0.35, 0.19, MARBLE, 0.08, 0.012);
  rail(gp, hx, t3, hz, 0.26, 0.128, MARBLE, 0.07, 0.012);
  for (const dx of [-0.024, 0.024]) steps(gp, hx + dx, y0, hz + 0.105 + 0.05, 0.02, t3 - y0, 0.06, MARBLE, 6);
  ramp(gp, hx, y0, hz + 0.105 + 0.05, 0.028, t3 - y0, 0.06, shade(MARBLE, 0.94));
  const eh1 = body(gp, hx, t3, hz, 0.24, 0.11, 0.042, { wall: RED, col: RED, bracket: GOLD, door: '#561a14', doorN: 5, sp: 0.034, cr: 0.004 });
  const er1 = roof(gp, hx, eh1, hz, 0.29, 0.155, 0.02, { tile: GOLD, k: 0.34, lift: 0.2, inner: [0.2, 0.09] });
  const eh2 = body(gp, hx, er1, hz, 0.2, 0.09, 0.028, { wall: RED, col: RED, bracket: GOLD, sp: 0.034, cr: 0.0036 });
  roof(gp, hx, eh2, hz, 0.26, 0.14, 0.042, { tile: GOLD, k: 0.38, lift: 0.26, chi: GOLD, chiH: 0.026 });
  // Manchu-Han bilingual plaque (满汉合璧太和殿匾), sundial (日晷), grain measure (嘉量) & gilt bronze vats (门海铜缸)
  box(gp, '#1e2c48', hx, er1 + 0.018, hz + 0.048, 0.024, 0.016, 0.005);
  for (const sx of [-1, 1]) {
    box(gp, MARBLE, hx + sx * 0.095, t3, hz + 0.055, 0.014, 0.018, 0.014);
    cyl(gp, BRZ, hx + sx * 0.14, y0, hz + 0.14, 0.014, 0.02, 10);
  }
  // 2. Temple of Heaven Qiniandian (天坛祈年殿三重蓝琉璃瓦圆攒尖大殿) on three-tiered marble circular altar at east
  const tx = 0.21, tz = 0.06;
  for (const [i, r] of [[0, 0.135], [1, 0.108], [2, 0.084]] as [number, number][]) {
    cyl(gp, MARBLE, tx, y0 + i * 0.018, tz, r, 0.018, 20);
  }
  const ty = y0 + 0.054;
  cyl(gp, RED, tx, ty, tz, 0.064, 0.046, 16);
  for (const [dy, r, h] of [[0.038, 0.082, 0.024], [0.062, 0.068, 0.024], [0.086, 0.054, 0.038]] as [number, number, number][]) {
    cyl(gp, RED, tx, ty + dy - 0.012, tz, r * 0.72, 0.016, 16);
    cone(gp, BLUE, tx, ty + dy, tz, r, h, 18);
  }
  ellip(gp, GOLD, tx, ty + 0.128, tz, 0.009, 0.014, 0.009);
  // Qing court officials in peacock-plumed 顶戴花翎 hats and 补服 robes
  figure(gp, -0.11, y0, 0.14, 0.028, '#1e2a44', { hat: 'peaked', hatC: '#262220' });
  figure(gp, -0.05, y0, 0.16, 0.027, '#243452', { hat: 'peaked', hatC: '#262220' });
  for (const [x, z] of [[-0.32, 0.22], [0.02, 0.28]] as [number, number][]) tree(gp, x, y0, z, 0.06, '#3e5e38');
};

/**
 * 中华人民共和国首都北京 · 天安门城楼、金水桥华表、五星红旗与人民英雄纪念碑 (1949–present): Tiananmen Gatehouse with golden glazed
 * double roof, eight red festival lanterns, Golden Water Bridges and Huabiao pillars at north, facing the Five-Star Red Flag
 * and the Monument to the People's Heroes (人民英雄纪念碑) on Tiananmen Square.
 */
const cap_prc: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#f2ede2', RED = '#aa241c', FLAG = '#d81e18', GOLD = '#eab026', WATER = '#3a6e78', GRANITE = '#dfd6c4';
  // Outer Golden Water River (外金水河) & five arched white marble bridges in front of Tiananmen
  band(gp, -0.04, 0.04, y0, 0.004, WATER, 0.015);
  for (const [dx, w] of [[-0.14, 0.028], [-0.07, 0.032], [0, 0.042], [0.07, 0.032], [0.14, 0.028]] as [number, number][]) {
    box(gp, MARBLE, dx, y0 + 0.004, 0, w, 0.016, 0.095);
  }
  // Twin carved white marble Huabiao pillars (汉白玉云龙华表)
  for (const sx of [-1, 1]) {
    const hx = sx * 0.22, hz = 0.055;
    box(gp, MARBLE, hx, y0, hz, 0.026, 0.012, 0.026);
    cyl(gp, MARBLE, hx, y0 + 0.012, hz, 0.007, 0.068, 8);
    box(gp, MARBLE, hx, y0 + 0.072, hz, 0.024, 0.005, 0.009);
    ellip(gp, MARBLE, hx, y0 + 0.086, hz, 0.006, 0.008, 0.006);
  }
  // Tiananmen Gatehouse (天安门城楼) at north with five arched portals, slogans, red lanterns & golden double-eave roof
  const tz = -0.15;
  earth(gp, 0, y0, tz, 0.54, 0.12, 0.5, 0.105, 0.078, RED, 4, MARBLE);
  rail(gp, 0, y0 + 0.078, tz, 0.49, 0.1, MARBLE, 0, 0.012);
  for (const [dx, r] of [[-0.13, 0.013], [-0.065, 0.014], [0, 0.018], [0.065, 0.014], [0.13, 0.013]] as [number, number][]) {
    box(gp, '#38120e', dx, y0, tz + 0.054, r * 1.8, 0.044, 0.012);
  }
  // Flanking white-letter red slogan plaques & central emblem
  for (const sx of [-1, 1]) box(gp, FLAG, sx * 0.11, y0 + 0.052, tz + 0.056, 0.11, 0.014, 0.004);
  cyl(gp, GOLD, 0, y0 + 0.062, tz + 0.057, 0.011, 0.004, 10).rotation.x = Math.PI / 2;
  const eh1 = body(gp, 0, y0 + 0.078, tz, 0.34, 0.082, 0.036, { wall: RED, col: RED, bracket: GOLD, door: '#561812', doorN: 5, sp: 0.036, cr: 0.004 });
  // Eight red lanterns under the eaves
  for (let i = -3.5; i <= 3.5; i += 1) ellip(gp, FLAG, i * 0.042, y0 + 0.106, tz + 0.044, 0.006, 0.008, 0.006);
  const er1 = roof(gp, 0, eh1, tz, 0.4, 0.125, 0.02, { tile: GOLD, k: 0.34, lift: 0.2, inner: [0.3, 0.07] });
  const eh2 = body(gp, 0, er1, tz, 0.3, 0.07, 0.026, { wall: RED, col: RED, bracket: GOLD, sp: 0.036, cr: 0.0036 });
  roof(gp, 0, eh2, tz, 0.36, 0.115, 0.04, { tile: GOLD, k: 0.38, lift: 0.26, xie: 0.68, chi: GOLD, chiH: 0.026 });
  // National Flagpole & Five-Star Red Flag (国旗杆与五星红旗) at center of square
  box(gp, MARBLE, -0.1, y0, 0.14, 0.064, 0.014, 0.064);
  cyl(gp, '#d8dde2', -0.1, y0 + 0.014, 0.14, 0.0035, 0.16, 8);
  box(gp, FLAG, -0.07, y0 + 0.145, 0.14, 0.056, 0.038, 0.003);
  ellip(gp, GOLD, -0.088, y0 + 0.156, 0.142, 0.005, 0.005, 0.003);
  // Monument to the People's Heroes (人民英雄纪念碑) on double marble terrace at south-east
  const mx = 0.08, mz = 0.2;
  box(gp, MARBLE, mx, y0, mz, 0.14, 0.016, 0.12);
  box(gp, MARBLE, mx, y0 + 0.016, mz, 0.105, 0.016, 0.09);
  box(gp, GRANITE, mx, y0 + 0.032, mz, 0.056, 0.026, 0.044);
  tbox(gp, 0.038, 0.028, 0.03, 0.022, 0.135, GRANITE, mx, y0 + 0.058, mz);
  gable(gp, 0.034, 0.016, 0.026, GRANITE, mx, y0 + 0.193, mz);
  for (const sx of [-0.28, 0.28]) tree(gp, sx, y0, 0.18, 0.064, '#365e34');
};

export const H_CAPITALS: Record<string, Builder> = {
  cap_paleo, cap_neo, cap_erlitou, cap_yinxu, cap_zhou, cap_luoyi, cap_zhanguo, cap_xianyang, cap_qinhan, cap_xin, cap_luoyang,
  cap_sanguo, cap_taiji, cap_jiankang, cap_nanbei, cap_sui, cap_tang, cap_wudai, cap_song, cap_liao, cap_xixia, cap_jin,
  cap_linan, cap_yuan, cap_ming, cap_qing, cap_nanjing_roc, cap_prc,
};
