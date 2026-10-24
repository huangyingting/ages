import * as THREE from 'three';
import { type V3, box, cyl, rod, skin, lathe, shade, tree } from './prims.ts';

// East-Asian timber kit shared by the Ages builders (adapted from pocket-planet's heroes/china.ts).
// Front faces +z, base at y=0.

/** Child group at (x, z) turned by ry — lets axis-aligned helpers build rotated parts. */
export function grp(p: THREE.Object3D, x: number, z: number, ry = 0, y = 0): THREE.Group {
  const gr = new THREE.Group();
  gr.position.set(x, y, z);
  gr.rotation.y = ry;
  p.add(gr);
  return gr;
}
/** Small conifer (two stacked cones on a stub trunk). */
/** Courtyard conifer: a Chinese pine with layered canopy pads (shares prims `tree`, so every model's pines match). */
export function minipine(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#2f5a32'): void {
  tree(p, x, y - s * 0.05, z, s * 0.9, c, true);
}
// ---- East-Asian timber kit ------------------------------------------------------------------------------
export interface PRoof { n: number; R0: number; R1: number; h: number; lift?: number; k?: number; rot?: number; sub?: number; tile: string; rib?: string; under?: string; sx?: number; sz?: number }
/**
 * Polygonal pagoda roof (square, hexagonal, octagonal…) with concave slope and upturned corner tips.
 * R0 = eave corner radius, R1 = top radius; optional (sx, sz) stretches it into a rectangle.
 */
export function proof(p: THREE.Object3D, x: number, y: number, z: number, o: PRoof): number {
  const n = o.n, sub = o.sub ?? 4, lift = o.lift ?? 0.3, k = o.k ?? 0.55, rot = o.rot ?? Math.PI / n + Math.PI / 2, sx = o.sx ?? 1, sz = o.sz ?? 1;
  const T = [0, 0.08, 0.25, 0.5, 0.75, 1];
  const yAt = (t: number) => y + o.h * (t * (1 - k) + k * t * t);
  const ring = (t: number, dy: number): V3[] => {
    const R = o.R0 + (o.R1 - o.R0) * t, out: V3[] = [];
    for (let i = 0; i < n; i++) for (let s = 0; s < sub; s++) {
      const u = s / sub, a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
      const px = Math.cos(a0) * (1 - u) + Math.cos(a1) * u, pz = Math.sin(a0) * (1 - u) + Math.sin(a1) * u;
      const c = Math.max(0, 1 - Math.min(u, 1 - u) / 0.42) ** 2 * (1 - t) ** 1.6;
      const out2 = 1 + c * lift * 0.25;
      out.push([x + px * R * sx * out2, yAt(t) + dy + c * lift * o.R0 * 0.35, z + pz * R * sz * out2]);
    }
    return out;
  };
  const th = o.R0 * 0.05;
  const rings = [ring(0, -th), ...T.map(t => ring(t, 0))];
  const rib = o.rib ?? shade(o.tile, 1.12), under = o.under ?? shade(o.tile, 0.6);
  skin(p, rings, o.tile, {
    caps: true, flat: true,
    paint: (px, _py, pz, _nx, ny) => {
      if (ny < -0.3) return under;
      if (ny < 0.25) return shade(o.tile, 0.72);
      const a = Math.atan2(pz - z, px - x);
      return Math.floor(((a + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2) * n * sub * 3) % 2 ? rib : o.tile;
    },
  });
  return yAt(1);
}
/** Storey of a timber hall: columns around a polygon, solid wall core, a balcony with railing. */
export function storey(p: THREE.Object3D, x: number, y: number, z: number, n: number, R: number, h: number, col: string, wall: string, rot = Math.PI / n + Math.PI / 2, sx = 1, sz = 1, nc = 2): void {
  for (let i = 0; i < n; i++) for (let s = 0; s < nc; s++) {
    const u = s / nc, a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
    const px = (Math.cos(a0) * (1 - u) + Math.cos(a1) * u) * R * sx, pz = (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * R * sz;
    cyl(p, col, x + px, y, z + pz, R * 0.06, h, 6);
  }
  const core = lathe(p, Array.from({ length: 2 }, (_, i) => [R * 0.86, i * h] as [number, number]), wall, x, y, z, n);
  core.rotation.y = -rot + Math.PI / 2;
  core.scale.set(sx, 1, sz);
}
export function hall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, roof: string, ry = 0, wall = '#b0372b', o: { rh?: number; ov?: number; lift?: number; col?: string; band?: string } = {}): number {
  const gr = grp(p, x, z, ry, y);
  box(gr, wall, 0, 0, 0, w, h, d);
  const nc = Math.max(2, Math.round(w / 0.024)), cr = Math.min(0.0042, w * 0.05);
  for (let i = 0; i <= nc; i++) cyl(gr, o.col ?? '#8f1f1a', -w / 2 + (i / nc) * w, 0, d / 2 + cr * 0.6, cr, h, 5);
  const bh = Math.min(0.008, h * 0.18);
  box(gr, o.band ?? '#2f7d6d', 0, h - bh, 0, w + 0.004, bh, d + 0.004);
  const ov = o.ov ?? 1.35, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  return y + proof(gr, 0, h, 0, { n: 4, R0, R1: R0 * 0.3, h: o.rh ?? d * 0.42, lift: o.lift ?? 0.35, tile: roof, sx: (w + d * (ov - 1)) / (d * ov) });
}
/** Calabash (gourd) finial on a spike — the golden tip of pagodas and towers. */
export function gourd(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#e8b23a'): void {
  lathe(p, [[0, 0], [0.4, 0.05], [0.55, 0.25], [0.3, 0.48], [0.42, 0.66], [0.2, 0.9], [0, 1]].map(([r, v]) => [r * s, v * s * 1.6] as [number, number]), c, x, y, z, 8);
  rod(p, [x, y + s * 1.5, z], [x, y + s * 2.4, z], s * 0.06, c, 4);
}
