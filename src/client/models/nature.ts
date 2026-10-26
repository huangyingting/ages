import * as THREE from 'three';
import {
  type Paint, add, mat, cyl, cone, paintFaces, shade, mix, fbm, vnoise, hash3,
} from './prims.ts';

/**
 * Procedural terrain dioramas. Everything natural (mountains, canyons, falls, monoliths, reefs) is built on a
 * polar heightfield "island": a disc of displaced terrain with an earth-strata skirt, coloured per face by
 * altitude, slope and noise. This replaces the old stacked-box approximations with continuous sculpted ground.
 */

export type HFn = (x: number, z: number) => number;
export interface IslandOpts { rings?: number; segs?: number; rz?: number; base?: number; side?: (y: number, x: number, z: number) => string }

export const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const ridged = (x: number, z: number, oct = 3) => {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(2 * vnoise(x * f, 3.7 * i, z * f) - 1)); n += a; a *= 0.5; f *= 2.1; }
  return s / n;
};

/** Displaced terrain disc (radius R, optional z squash) with vertical earth skirt down to y=0. */
export function island(gp: THREE.Object3D, R: number, h: HFn, base: string, paint: Paint, o: IslandOpts = {}): void {
  const rings = o.rings ?? 52, segs = o.segs ?? 120, rz = o.rz ?? 1, y0 = o.base ?? 0.035;
  const pos: number[] = [0, y0 + h(0, 0), 0];
  for (let i = 1; i <= rings; i++) {
    const r = (R * i) / rings;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r * rz;
      pos.push(x, y0 + h(x, z), z);
    }
  }
  const vi = (i: number, j: number) => 1 + (i - 1) * segs + (j % segs);
  const idx: number[] = [];
  for (let j = 0; j < segs; j++) idx.push(0, vi(1, j + 1), vi(1, j));
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = vi(i, j), b = vi(i, j + 1), c = vi(i + 1, j), d = vi(i + 1, j + 1);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  add(gp, paintFaces(geo, base, paint), mat('#ffffff', { flat: false, vc: true, rough: 0.85 }), 0, 0, 0, 1, 1, 1);

  // Skirt: vertical rim from the terrain edge down to the ground, banded like exposed strata
  const sp: number[] = [], si: number[] = [];
  for (let j = 0; j < segs; j++) {
    const k = vi(rings, j) * 3;
    sp.push(pos[k], pos[k + 1], pos[k + 2], pos[k] * 0.985, 0, pos[k + 2] * 0.985);
  }
  for (let j = 0; j < segs; j++) {
    const t = j * 2, b = j * 2 + 1, t2 = ((j + 1) % segs) * 2, b2 = t2 + 1;
    si.push(t, t2, b, t2, b2, b);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setIndex(si);
  sg.computeVertexNormals();
  const side = o.side ?? ((y: number) => (y > y0 * 0.6 ? '#6b4f3a' : '#4a3628'));
  add(gp, paintFaces(sg, '#5b4636', (x, y, z) => side(y, x, z)), mat('#ffffff', { flat: true, vc: true, rough: 0.9 }), 0, 0, 0, 1, 1, 1);
}

export const WATER = '#2d7fb5';
export const ripple = (c: string): Paint => (x, _y, z) => (Math.sin(x * 90 + Math.sin(z * 40) * 2) > 0.93 ? mix(c, '#d6f0ff', 0.45) : hash3(Math.floor(x * 60), 0, Math.floor(z * 60)) > 0.9 ? shade(c, 1.12) : c);
export const strataSide = (pal: string[], scale = 26): IslandOpts['side'] => (y, x, z) => pal[Math.abs(Math.floor(y * scale + fbm(x * 9, y * 3, z * 9) * 1.4)) % pal.length];
export const EARTH = ['#6b4f3a', '#5a4130', '#7a5a40', '#4f3a2b'];

export function pine(gp: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#2f5e3f'): void {
  cyl(gp, '#5b4030', x, y, z, s * 0.12, s * 0.4, 5);
  cone(gp, c, x, y + s * 0.25, z, s * 0.5, s * 0.7, 7);
  cone(gp, shade(c, 1.1), x, y + s * 0.55, z, s * 0.38, s * 0.6, 7);
  cone(gp, shade(c, 1.2), x, y + s * 0.85, z, s * 0.24, s * 0.45, 7);
}
export const scatter = (n: number, seed: number, f: (x: number, z: number, i: number) => void, R = 0.42) => {
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 1) * Math.PI * 2, d = Math.sqrt(hash3(i, seed, 2)) * R;
    f(Math.cos(a) * d, Math.sin(a) * d, i);
  }
};
/** Place objects on the terrain surface: samples h(x,z) so trees/houses sit on slopes. */
export const onGround = (h: HFn, y0 = 0.035) => (x: number, z: number) => y0 + h(x, z) - 0.004;

