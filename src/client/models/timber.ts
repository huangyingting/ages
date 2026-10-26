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
  const colC = o.col ?? '#8f1f1a', bandC = o.band ?? '#2f7d6d';
  const stoneC = '#cfc6b4', doorC = '#6e1d16', winC = '#efe4cc', goldC = '#d8a634';
  // Molded stone plinth rim (台基压阑石)
  box(gr, stoneC, 0, 0, 0, w + 0.01, Math.min(0.008, h * 0.14), d + 0.01);
  // Recessed inner wall core so perimeter colonnade stands proud
  box(gr, wall, 0, 0, 0, w * 0.92, h, d * 0.9);
  const nc = Math.max(3, Math.min(7, Math.round(w / 0.024))), nd = Math.max(2, Math.min(5, Math.round(d / 0.028)));
  const cr = Math.min(0.0044, w * 0.048);
  // Front & back perimeter colonnade (前后檐柱与柱础)
  for (let i = 0; i <= nc; i++) {
    const cx = -w * 0.47 + (i / nc) * (w * 0.94);
    for (const sz of [-1, 1]) {
      const cz = sz * (d * 0.46 + cr * 0.4);
      cyl(gr, stoneC, cx, 0, cz, cr * 1.45, Math.min(0.006, h * 0.11), 6);
      cyl(gr, colC, cx, 0, cz, cr, h, 6);
    }
  }
  // Side colonnade (山面檐柱)
  for (let j = 1; j < nd; j++) {
    const cz = -d * 0.46 + (j / nd) * (d * 0.92);
    for (const sx of [-1, 1]) {
      const cx = sx * (w * 0.47 + cr * 0.4);
      cyl(gr, stoneC, cx, 0, cz, cr * 1.4, Math.min(0.006, h * 0.11), 6);
      cyl(gr, colC, cx, 0, cz, cr, h, 6);
    }
  }
  // Central lattice doors (隔扇门) and side mullion windows (直棂窗) on front/back
  const dh = h * 0.76, dw = Math.min(w * 0.34, 0.085);
  for (const sz of [-1, 1]) {
    const fz = sz * (d * 0.452);
    box(gr, doorC, 0, 0, fz, dw, dh, 0.004);
    box(gr, goldC, 0, dh * 0.48, fz + sz * 0.001, dw * 0.92, 0.003, 0.003);
    if (w >= 0.09) {
      for (const sx of [-1, 1]) {
        const wx = sx * Math.min(w * 0.3, dw * 0.95);
        box(gr, doorC, wx, h * 0.24, fz, dw * 0.52, h * 0.42, 0.003);
        box(gr, winC, wx, h * 0.26, fz + sz * 0.0008, dw * 0.44, h * 0.36, 0.002);
      }
    }
  }
  // Polychrome architrave (额枋彩画) & under-eave bracket sets (斗拱)
  const bh = Math.min(0.008, h * 0.18);
  box(gr, bandC, 0, h - bh, 0, w + 0.006, bh, d + 0.006);
  box(gr, colC, 0, h - bh * 1.55, 0, w + 0.008, bh * 0.55, d + 0.008);
  const nb = Math.max(4, Math.min(10, nc * 2));
  for (let i = 0; i <= nb; i++) {
    const bx = -w * 0.46 + (i / nb) * (w * 0.92);
    for (const sz of [-1, 1]) {
      box(gr, colC, bx, h - bh * 0.4, sz * (d * 0.47), cr * 2.2, bh * 0.9, cr * 2.6);
    }
  }
  const ov = o.ov ?? 1.35, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  const rh = o.rh ?? d * 0.42;
  const topY = proof(gr, 0, h, 0, { n: 4, R0, R1: R0 * 0.3, h: rh, lift: o.lift ?? 0.35, tile: roof, sx: (w + d * (ov - 1)) / (d * ov) });
  // Main roof ridge (正脊) & upturned owl-tail ridge finials (鸱吻)
  const rw = Math.max(w * 0.46, (w + d * (ov - 1)) * 0.32);
  box(gr, shade(roof, 0.76), 0, topY - rh * 0.08, 0, rw, Math.max(0.005, rh * 0.14), Math.max(0.005, d * 0.06));
  for (const sx of [-1, 1]) {
    box(gr, goldC, sx * (rw * 0.49), topY - rh * 0.04, 0, Math.max(0.005, rh * 0.12), Math.max(0.009, rh * 0.24), Math.max(0.006, d * 0.07));
  }
  return y + topY;
}
/** Calabash (gourd) finial on a spike — the golden tip of pagodas and towers. */
export function gourd(p: THREE.Object3D, x: number, y: number, z: number, s: number, c = '#e8b23a'): void {
  lathe(p, [[0, 0], [0.52, 0.04], [0.46, 0.14], [0.58, 0.26], [0.34, 0.44], [0.46, 0.62], [0.28, 0.78], [0.36, 0.9], [0.16, 1.04], [0, 1.16]].map(([r, v]) => [r * s, v * s * 1.55] as [number, number]), c, x, y, z, 10);
  rod(p, [x, y + s * 1.5, z], [x, y + s * 2.45, z], s * 0.065, c, 6);
}
