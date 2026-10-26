import * as THREE from 'three';
import { type V3, box, cyl, rod, skin, lathe, shade, tree } from './prims.ts';

// East-Asian timber kit shared by the Ages builders (adapted from pocket-planet's heroes/china.ts).
// Front faces +z, base at y=0.

let activePlaceYear: number | undefined;
let activePlaceEra: string | undefined;

export function setPlaceEraContext(year?: number, era?: string): void {
  activePlaceYear = year;
  activePlaceEra = era;
}
export function getPlaceEraYear(): number | undefined { return activePlaceYear; }
export function getPlaceEraId(): string | undefined { return activePlaceEra; }

interface EraTimberStyle {
  roof: string;
  wall: string;
  col: string;
  band: string;
  finial: string;
  liftMul: number;
  ovMul: number;
}

const ERA_TIMBER: Record<string, EraTimberStyle> = {
  paleo:   { roof: '#7c6240', wall: '#9e8058', col: '#5c4328', band: '#735536', finial: '#8c6d46', liftMul: 0.35, ovMul: 0.92 },
  neo:     { roof: '#8f6f44', wall: '#b08e62', col: '#694b2c', band: '#8a3a28', finial: '#a87d48', liftMul: 0.42, ovMul: 0.94 },
  legend:  { roof: '#7a6342', wall: '#a8895e', col: '#6e3524', band: '#7d5c38', finial: '#b58d46', liftMul: 0.48, ovMul: 0.95 },
  xia:     { roof: '#4a4339', wall: '#a28258', col: '#7a2b1e', band: '#5c6b58', finial: '#8c7850', liftMul: 0.55, ovMul: 0.96 },
  shang:   { roof: '#3c3833', wall: '#9c7a52', col: '#85261a', band: '#3f6e5c', finial: '#9e8244', liftMul: 0.58, ovMul: 0.97 },
  wzhou:   { roof: '#453e38', wall: '#9e3828', col: '#7d2218', band: '#3b6859', finial: '#b8923a', liftMul: 0.64, ovMul: 0.98 },
  chunqiu: { roof: '#3a3f45', wall: '#963224', col: '#732018', band: '#446358', finial: '#b08a38', liftMul: 0.68, ovMul: 0.99 },
  zhanguo: { roof: '#2d2b30', wall: '#8f291e', col: '#2b2626', band: '#9e2e22', finial: '#c49638', liftMul: 0.72, ovMul: 1.0 },
  qin:     { roof: '#22252b', wall: '#87241c', col: '#232022', band: '#8f281e', finial: '#b88c32', liftMul: 0.66, ovMul: 1.02 },
  whan:    { roof: '#464c56', wall: '#9c2e22', col: '#822018', band: '#7a281e', finial: '#c29638', liftMul: 0.74, ovMul: 1.03 },
  xin:     { roof: '#314a45', wall: '#943226', col: '#75221a', band: '#2f6b5c', finial: '#cfa03a', liftMul: 0.76, ovMul: 1.02 },
  ehan:    { roof: '#3e4752', wall: '#a13426', col: '#85241b', band: '#3c5e56', finial: '#c89a38', liftMul: 0.78, ovMul: 1.03 },
  sanguo:  { roof: '#353c45', wall: '#8f3024', col: '#6e2018', band: '#425966', finial: '#b88e36', liftMul: 0.82, ovMul: 1.01 },
  wjin:    { roof: '#48585a', wall: '#cfc4b0', col: '#7a2b22', band: '#3d6960', finial: '#bfa048', liftMul: 0.86, ovMul: 1.02 },
  ejin:    { roof: '#4b5960', wall: '#dfd6c3', col: '#6e2e26', band: '#466e66', finial: '#c4a44c', liftMul: 0.9, ovMul: 1.03 },
  nanbei:  { roof: '#52473c', wall: '#b8422e', col: '#85281c', band: '#386e62', finial: '#d4a438', liftMul: 0.94, ovMul: 1.04 },
  sui:     { roof: '#2e5e56', wall: '#e4dac6', col: '#96281e', band: '#2d7564', finial: '#d8a838', liftMul: 0.98, ovMul: 1.05 },
  tang:    { roof: '#266b58', wall: '#ebe2cf', col: '#a6281e', band: '#297a66', finial: '#e2b038', liftMul: 1.08, ovMul: 1.07 },
  wudai:   { roof: '#344e5c', wall: '#dfd5c2', col: '#82261e', band: '#356b68', finial: '#cfa23a', liftMul: 1.14, ovMul: 1.04 },
  liao:    { roof: '#7a542e', wall: '#b53c2c', col: '#80241a', band: '#38685c', finial: '#deb03c', liftMul: 1.02, ovMul: 1.05 },
  bsong:   { roof: '#2b6075', wall: '#e8dfd0', col: '#78221b', band: '#286e68', finial: '#d6a83c', liftMul: 1.24, ovMul: 1.03 },
  xixia:   { roof: '#286e4b', wall: '#d8cbb4', col: '#8a2a1e', band: '#2b7858', finial: '#dfb23c', liftMul: 1.16, ovMul: 1.02 },
  jin:     { roof: '#8c6828', wall: '#ab3628', col: '#7c2018', band: '#2f665c', finial: '#e0b23a', liftMul: 1.1, ovMul: 1.04 },
  nsong:   { roof: '#353e48', wall: '#f0eadc', col: '#69241e', band: '#346e68', finial: '#cfa442', liftMul: 1.28, ovMul: 1.04 },
  yuan:    { roof: '#254c78', wall: '#ece4d4', col: '#8f281e', band: '#245e78', finial: '#e2b43c', liftMul: 1.06, ovMul: 1.02 },
  ming:    { roof: '#c89024', wall: '#a83226', col: '#8c1f18', band: '#266b5e', finial: '#e4b43a', liftMul: 0.96, ovMul: 1.0 },
  qing:    { roof: '#d8a228', wall: '#9e2c22', col: '#821c16', band: '#1f5970', finial: '#ecc042', liftMul: 0.94, ovMul: 0.99 },
  roc:     { roof: '#525a64', wall: '#7c8086', col: '#5c6066', band: '#3d6b60', finial: '#9aa2ab', liftMul: 0.72, ovMul: 0.96 },
  prc:     { roof: '#b83b28', wall: '#b53428', col: '#941e18', band: '#d6a436', finial: '#ecc042', liftMul: 1.0, ovMul: 1.0 },
};

const _cA = new THREE.Color(), _cB = new THREE.Color();
function blendHex(a: string, b: string, t: number): string {
  _cA.set(a).lerp(_cB.set(b), t);
  return '#' + _cA.getHexString();
}

export function stylePlaceHallColors(wall: string, col: string, roof: string, beam = '#2e7666', gold = '#d8a634'): [string, string, string, string, string] {
  const es = activePlaceEra ? ERA_TIMBER[activePlaceEra] : undefined;
  if (!es) return [wall, col, roof, beam, gold];
  return [
    blendHex(wall, es.wall, 0.56),
    blendHex(col, es.col, 0.58),
    blendHex(roof, es.roof, 0.62),
    blendHex(beam, es.band, 0.64),
    es.finial,
  ];
}

export function stylePlaceHuman(s: number, top: string, bottom: string): { top: string; bottom: string; dress: 'knee' | 'ankle' | undefined; hat: string | undefined; hatStyle: 'bowl' | 'brim' | 'cap' | 'conical' | 'fur' | 'helmet' | 'hood' | 'knot' | 'peaked' | 'plume' | 'qing' | 'turban' | undefined } {
  const es = activePlaceEra ? ERA_TIMBER[activePlaceEra] : undefined;
  if (!es) {
    const hats = ['brim', 'knot', 'cap', 'turban', 'hood', 'conical'] as const;
    return { top, bottom, dress: s % 3 === 0 ? 'knee' : 'ankle', hat: '#362c24', hatStyle: hats[s % hats.length] };
  }
  const era = activePlaceEra!;
  const isSteppe = era === 'liao' || era === 'xixia' || era === 'jin' || era === 'yuan';
  const isPreQin = era === 'paleo' || era === 'neo' || era === 'legend' || era === 'xia' || era === 'shang' || era === 'wzhou' || era === 'chunqiu' || era === 'zhanguo';
  const isMod = era === 'roc' || era === 'prc';
  const hatStyle = era === 'paleo' || era === 'neo' ? undefined
    : isSteppe ? (s & 1 ? 'fur' : 'hood')
    : isPreQin || era === 'qin' || era === 'whan' || era === 'xin' || era === 'ehan' ? 'knot'
    : era === 'tang' || era === 'sui' || era === 'bsong' || era === 'nsong' || era === 'ming' ? 'cap'
    : era === 'qing' ? 'qing'
    : isMod ? 'peaked' : 'knot';
  return {
    top: blendHex(top, es.col, 0.55),
    bottom: blendHex(bottom, es.wall, 0.45),
    dress: isMod ? undefined : isSteppe ? 'knee' : 'ankle',
    hat: hatStyle ? es.roof : undefined,
    hatStyle,
  };
}

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
  const es = activePlaceEra ? ERA_TIMBER[activePlaceEra] : undefined;
  const tileC = es ? blendHex(o.tile, es.roof, 0.58) : o.tile;
  const n = o.n, sub = o.sub ?? 4, lift = (o.lift ?? 0.3) * (es?.liftMul ?? 1), k = o.k ?? 0.55, rot = o.rot ?? Math.PI / n + Math.PI / 2, sx = o.sx ?? 1, sz = o.sz ?? 1;
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
  const rib = o.rib ?? shade(tileC, 1.12), under = o.under ?? shade(tileC, 0.6);
  skin(p, rings, tileC, {
    caps: true, flat: true,
    paint: (px, _py, pz, _nx, ny) => {
      if (ny < -0.3) return under;
      if (ny < 0.25) return shade(tileC, 0.72);
      const a = Math.atan2(pz - z, px - x);
      return Math.floor(((a + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2) * n * sub * 3) % 2 ? rib : tileC;
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
  const es = activePlaceEra ? ERA_TIMBER[activePlaceEra] : undefined;
  const roofC = es ? blendHex(roof, es.roof, 0.62) : roof;
  const wallC = es ? blendHex(wall, es.wall, 0.55) : wall;
  const gr = grp(p, x, z, ry, y);
  const colC = es ? blendHex(o.col ?? '#8f1f1a', es.col, 0.6) : (o.col ?? '#8f1f1a');
  const bandC = es ? blendHex(o.band ?? '#2f7d6d', es.band, 0.65) : (o.band ?? '#2f7d6d');
  const stoneC = '#cfc6b4', doorC = '#6e1d16', winC = '#efe4cc', goldC = es?.finial ?? '#d8a634';
  // Molded stone plinth rim (台基压阑石)
  box(gr, stoneC, 0, 0, 0, w + 0.01, Math.min(0.008, h * 0.14), d + 0.01);
  // Recessed inner wall core so perimeter colonnade stands proud
  box(gr, wallC, 0, 0, 0, w * 0.92, h, d * 0.9);
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
  const ov = (o.ov ?? 1.35) * (es?.ovMul ?? 1), R0 = ((d / 2) * ov) / Math.SQRT1_2;
  const rh = o.rh ?? d * 0.42;
  const topY = proof(gr, 0, h, 0, { n: 4, R0, R1: R0 * 0.3, h: rh, lift: o.lift ?? 0.35, tile: roofC, sx: (w + d * (ov - 1)) / (d * ov) });
  // Main roof ridge (正脊) & upturned owl-tail ridge finials (鸱吻)
  const rw = Math.max(w * 0.46, (w + d * (ov - 1)) * 0.32);
  box(gr, shade(roofC, 0.76), 0, topY - rh * 0.08, 0, rw, Math.max(0.005, rh * 0.14), Math.max(0.005, d * 0.06));
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
