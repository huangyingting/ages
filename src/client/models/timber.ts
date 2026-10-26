import * as THREE from 'three';
import {
  type V3, box, cyl, cone as rawCone, ellip, rod, gable as rawGable, prism, tbox as rawTbox,
  skin, lathe, shade, tree,
} from './prims.ts';

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

// ---- Shared High-Realism Place Architectural Primitives ---------------------------------------------------

/** Curved river/moat/road band clipped to the circular plinth radius. */
export function placeBand(p: THREE.Object3D, z0: number, z1: number, y: number, h: number, c: string, r = 0.43): void {
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const z = z0 + ((z1 - z0) * i) / 12, x = Math.sqrt(Math.max(0, r * r - z * z));
    L.push([-x, z]); R.push([x, z]);
  }
  prism(p, [...L, ...R.reverse()], y, h, c);
}

/**
 * Authentic Chinese overhanging gable roof (悬山顶 / 硬山顶):
 * - Recessed masonry/plaster triangular gable walls (山墙) on ±X
 * - Two concave-curved tiled roof slopes (反宇前后坡瓦面) overhanging both front/back eaves and side gables
 * - Main ridge beam (正脊) with upturned owl-tail finials (鸱吻) and hanging bargeboards (博风板)
 */
export function placeGable(
  p: THREE.Object3D, w: number, h: number, d: number,
  c: string, x = 0, y = 0, z = 0, ry = 0,
): THREE.Mesh {
  const [wallC, colC, roofC, , goldC] = stylePlaceHallColors('#ece4d4', '#8e231c', c);
  const g = grp(p, x, z, ry, y);
  // 1. Recessed gable end-wall core (山墙)
  const m = rawGable(g, w * 0.94, h * 0.9, d * 0.88, wallC, 0, 0, 0, 0);
  // Under-eave tie beam along front & back
  const bh = Math.min(0.004, h * 0.16);
  box(g, colC, 0, 0, 0, w * 0.96, bh, d * 0.92);
  // 2. Concave-curved front & back roof slopes (反宇双坡瓦顶) built in 2 pitched tiers per slope
  const ow = w * 1.06, halfD = d * 0.56;
  const th = Math.max(0.0032, h * 0.13);
  const darkRoof = shade(roofC, 0.78), lightRoof = shade(roofC, 1.08);
  for (const sz of [-1, 1]) {
    // Lower eave slope (gentler pitch, upturned eave edge)
    const zLow = sz * (halfD * 0.72), yLow = h * 0.24;
    const lenLow = Math.hypot(halfD * 0.56, h * 0.44);
    const angLow = sz * Math.atan2(h * 0.44, halfD * 0.56);
    const mLow = box(g, roofC, 0, yLow, zLow, ow, th, lenLow);
    mLow.rotation.x = angLow;
    // Upper ridge slope (steeper pitch meeting at the ridge)
    const zHi = sz * (halfD * 0.25), yHi = h * 0.68;
    const lenHi = Math.hypot(halfD * 0.52, h * 0.56);
    const angHi = sz * Math.atan2(h * 0.56, halfD * 0.52);
    const mHi = box(g, lightRoof, 0, yHi, zHi, ow * 0.99, th, lenHi);
    mHi.rotation.x = angHi;
    // Eave fascia strip (瓦当滴水檐口)
    box(g, darkRoof, 0, h * 0.03, sz * halfD, ow, th * 0.85, Math.max(0.0025, d * 0.04));
  }
  // 3. Main ridge beam (正脊), bargeboard trim (博风板), and owl-tail finials (鸱吻)
  box(g, darkRoof, 0, h - th * 0.3, 0, ow * 1.01, Math.max(0.0045, h * 0.18), Math.max(0.0045, d * 0.09));
  for (const sx of [-1, 1]) {
    box(g, goldC, sx * (ow * 0.48), h + th * 0.4, 0, Math.max(0.004, h * 0.14), Math.max(0.0075, h * 0.24), Math.max(0.005, d * 0.09));
    // Hanging wind-board / bargeboard (博风板与悬鱼)
    box(g, colC, sx * (ow * 0.495), h * 0.62, 0, Math.max(0.0025, w * 0.025), Math.max(0.006, h * 0.22), d * 0.42);
  }
  return m;
}

/**
 * Context-aware tapered box for places:
 * - Natural cliffs, gorges, mesas & earthen mounds (`w1 > w0` or tall thick rock/green masses): natural rock strata ledges
 * - Architectural platforms & Sumeru terraces (`h <= 0.054`): carved stone plinth/coping + front staircase (no battlements)
 * - City walls & fortress ramparts (`h > 0.054` and wall-like aspect): brick coursing + quoins + outer-edge battlements
 */
export function placeTbox(
  p: THREE.Object3D, w0: number, d0: number, w1: number, d1: number, h: number,
  c: string, x = 0, y = 0, z = 0, ry = 0,
): THREE.Mesh {
  const m = rawTbox(p, w0, d0, w1, d1, h, c, x, y, z, ry);
  if (w0 < 0.09 || d0 < 0.04 || h < 0.02) return m;

  const g = grp(p, x, z, ry, y);
  const lc = c.toLowerCase();
  const isGreenOrCliffColor = /^#[3456][0-9a-f][6789a-f]/.test(lc) || lc === '#b85c38' || lc === '#a84830' || lc === '#9c6c48' || lc === '#b86844' || lc === '#a86442';
  const isNaturalCliffOrMound = w1 > w0 || d1 > d0 || isGreenOrCliffColor || (h >= 0.088 && w0 >= 0.14 && d0 >= 0.12);

  if (isNaturalCliffOrMound) {
    // Natural rock strata bands & stepped foothill ledges (自然岩层与山麓阶地)
    const darkRock = shade(c, 0.84), lightRock = shade(c, 1.08);
    for (const f of [0.28, 0.56, 0.82]) {
      const wf = w0 + (w1 - w0) * f + 0.004, df = d0 + (d1 - d0) * f + 0.004;
      rawTbox(g, wf, df, wf * 0.98, df * 0.98, Math.min(0.006, h * 0.07), f > 0.5 ? lightRock : darkRock, 0, h * f, 0);
    }
    return m;
  }

  const rimC = shade(c, 1.12), darkC = shade(c, 0.82), stoneC = '#cfc6b4';
  const rimH = Math.min(0.005, h * 0.13);
  // Molded stone base foot & top coping (须弥座压阑石 / 城墙压顶石)
  box(g, rimC, 0, 0, 0, w0 + 0.006, rimH, d0 + 0.006);
  box(g, rimC, 0, h - rimH, 0, w1 + 0.006, rimH, d1 + 0.006);
  // Horizontal masonry / rammed-earth coursing bands
  for (const f of [0.35, 0.68]) {
    const wf = w0 + (w1 - w0) * f + 0.002, df = d0 + (d1 - d0) * f + 0.002;
    box(g, darkC, 0, h * f, 0, wf, 0.0024, df);
  }
  // Corner stone quoins (包角石)
  const qw = Math.min(0.012, w1 * 0.09), qd = Math.min(0.012, d1 * 0.11);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(g, rimC, sx * (w1 * 0.485), 0, sz * (d1 * 0.485), qw, h, qd);
  }

  // Low architectural terrace (h <= 0.054): add central front stone stair (踏道) when sitting on ground
  if (h <= 0.054) {
    if (y <= 0.005 && w0 >= 0.18 && d0 >= 0.12) {
      const sw = Math.min(w0 * 0.24, 0.068);
      for (let s = 0; s < 3; s++) {
        const sh = ((3 - s) / 3) * h * 0.9;
        box(g, stoneC, 0, 0, d0 * 0.5 + s * 0.007, sw, sh, 0.008);
      }
    }
    return m;
  }

  // City walls (w0 >= 0.2, h > 0.054) & square watchtowers (w0 <= 0.135, h >= 0.075): crenellated parapet battlements (雉堞女墙)
  const isCityWall = w0 >= 0.2 && d0 <= 0.26 && h >= 0.055 && h <= 0.095;
  const isWatchtower = w0 >= 0.08 && w0 <= 0.14 && d0 >= 0.08 && d0 <= 0.14 && h >= 0.075;
  if (isCityWall || isWatchtower) {
    const nb = Math.max(4, Math.min(11, Math.round(w1 / 0.036)));
    const mw = (w1 * 0.88) / (nb * 1.45);
    for (let i = 0; i < nb; i++) {
      const bx = -w1 * 0.44 + (i / Math.max(1, nb - 1)) * (w1 * 0.88);
      // Leave center clear on wide walls if a gatehouse hall is likely centered on top
      if (isCityWall && w1 >= 0.28 && Math.abs(bx) < w1 * 0.2) continue;
      for (const sz of [-1, 1]) {
        box(g, darkC, bx, h, sz * (d1 * 0.465), mw, 0.0085, 0.006);
      }
    }
  }
  return m;
}

/**
 * Context-aware cone for places:
 * - Ground-sitting mountain peaks (`y <= 0.006 && r >= 0.08 && h >= 0.10 && seg <= 8`): sculpted multi-ridge mountain peak
 * - Elevated conical roofs, yurts & pagoda spires (`y > 0.006`): smooth high-segment cone with eave ring & finial knob
 */
export function placeCone(
  p: THREE.Object3D, c: string, x: number, y: number, z: number,
  r: number, h: number, seg = 8, ry = 0,
): THREE.Mesh {
  if (y <= 0.006 && r >= 0.08 && h >= 0.10 && seg <= 8) {
    const sMain = 14 + (seg % 5);
    const m = rawCone(p, c, x, y, z, r, h, sMain, ry);
    const darkC = shade(c, 0.82), lightC = shade(c, 1.1);
    rawCone(p, darkC, x, y, z, r * 1.12, h * 0.4, 10, ry + 0.35);
    for (let i = 0; i < 4; i++) {
      const a = ry + (i * Math.PI) / 2 + 0.45;
      const sr = r * (0.44 + (i % 2) * 0.08), sh = h * (0.54 + (i % 2) * 0.1);
      rawCone(p, i % 2 ? darkC : lightC, x + Math.cos(a) * r * 0.44, y, z + Math.sin(a) * r * 0.44, sr, sh, 9, a);
    }
    return m;
  }
  // Elevated conical roof / yurt dome / spire: smooth segment count + eave molding + apex finial
  const sRoof = seg >= 8 ? Math.max(seg, 12) : seg;
  const m = rawCone(p, c, x, y, z, r, h, sRoof, ry);
  if (y > 0.006 && r >= 0.032 && h >= 0.018 && seg >= 6) {
    cyl(p, shade(c, 0.78), x, y, z, r * 1.02, Math.min(0.0035, h * 0.12), sRoof);
    ellip(p, '#d8a634', x, y + h + 0.002, z, Math.min(0.005, r * 0.12), Math.min(0.007, h * 0.16), Math.min(0.005, r * 0.12));
  }
  return m;
}

/**
 * Full-detail Chinese timber hall (大木作殿宇) for place dioramas:
 * - Two-tier stone platform rim (压阑石) & 3-step staircase with sloped imperial ramp (踏道与御路)
 * - Recessed wall core & proud perimeter colonnade with carved stone drum bases (檐柱与覆盆柱础)
 * - Multi-panel lattice doors (隔扇门), mullion windows (直棂窗), and hanging golden plaque (匾额)
 * - Tie-beams (阑额), polychrome architrave (额枋彩画), and two-stage Dougong bracket clusters (栌斗+华拱)
 * - Concave curved hip-and-gable roof (反宇飞檐歇山顶) with main ridge, diagonal ridges, and owl-tail finials (鸱吻)
 */
export function placeHall(
  p: THREE.Object3D, x: number, y: number, z: number,
  w: number, d: number, h: number,
  wallIn: string, colIn: string, roofIn: string, rh = h * 0.85,
): number {
  const [wall, col, roofC, beamC, goldC] = stylePlaceHallColors(wallIn, colIn, roofIn);
  const stoneC = '#cfc6b4', stoneLight = '#ded6c6', doorC = '#6e1d16', winC = '#efe4cc';
  const baseH = Math.min(0.0075, h * 0.15);
  // 1. Stone foundation platform & front approach stairs (须弥台基与踏道)
  box(p, stoneC, x, y, z, w + 0.012, baseH, d + 0.012);
  box(p, stoneLight, x, y + baseH * 0.7, z, w + 0.008, baseH * 0.35, d + 0.008);
  if (w >= 0.08 && d >= 0.065) {
    const sw = Math.min(w * 0.32, 0.072);
    for (let s = 0; s < 3; s++) {
      box(p, stoneC, x, y + s * 0.0022, z + d * 0.5 + (2 - s) * 0.006, sw, 0.0025, 0.008);
    }
    // Sloped central imperial ramp (御路石) & cheek stones (垂带石)
    for (const sx of [-1, 1]) {
      box(p, stoneLight, x + sx * (sw * 0.46), y + 0.002, z + d * 0.5 + 0.006, 0.0035, 0.0055, 0.018);
    }
  }
  // 2. Recessed wall core so perimeter colonnade & veranda have true depth
  box(p, wall, x, y, z, w * 0.9, h, d * 0.88);
  const nc = Math.max(3, Math.min(7, Math.round(w / 0.034)));
  const nd = Math.max(2, Math.min(5, Math.round(d / 0.038)));
  const cr = Math.min(0.0044, Math.max(0.0026, w * 0.023));
  // 3. Front, back, and side perimeter colonnade with stone drum bases (檐柱与柱础)
  for (let i = 0; i <= nc; i++) {
    const cx = x - w * 0.46 + (i / nc) * (w * 0.92);
    const isCorner = i === 0 || i === nc;
    for (const sz of [-1, 1]) {
      const cz = z + sz * (d * 0.455);
      cyl(p, stoneC, cx, y, cz, cr * 1.48, Math.min(0.0055, h * 0.12), 6);
      cyl(p, col, cx, y, cz, isCorner ? cr * 1.12 : cr, h, 6);
    }
  }
  for (let j = 1; j < nd; j++) {
    const cz = z - d * 0.455 + (j / nd) * (d * 0.91);
    for (const sx of [-1, 1]) {
      const cx = x + sx * (w * 0.46);
      cyl(p, stoneC, cx, y, cz, cr * 1.42, Math.min(0.0055, h * 0.12), 6);
      cyl(p, col, cx, y, cz, cr, h, 6);
    }
  }
  // Perimeter wooden veranda balustrade (寻杖栏杆) on larger halls
  if (w >= 0.115 && d >= 0.08) {
    const railW = w * 0.26, railH = Math.min(0.007, h * 0.2);
    for (const sx of [-1, 1]) {
      box(p, col, x + sx * (w * 0.31), y + railH, z + d * 0.455, railW, 0.0022, 0.0025);
      box(p, shade(col, 0.85), x + sx * (w * 0.31), y + railH * 0.45, z + d * 0.455, railW, railH * 0.55, 0.0018);
    }
  }
  // 4. Multi-panel lattice doors (隔扇门), mullion windows (直棂窗) & inscribed plaque (金字匾额)
  const dh = h * 0.76, dw = Math.min(w * 0.32, 0.082);
  for (const sz of [-1, 1]) {
    const fz = z + sz * (d * 0.443);
    box(p, doorC, x, y, fz, dw, dh, 0.004);
    // Horizontal waist band (绦环板) & vertical door seam mullions
    box(p, goldC, x, y + dh * 0.46, fz + sz * 0.001, dw * 0.92, 0.0028, 0.0028);
    for (const mx of [-0.28, 0, 0.28]) {
      box(p, shade(doorC, 0.72), x + mx * dw, y, fz + sz * 0.001, 0.002, dh, 0.0025);
    }
    if (w >= 0.105) {
      for (const sx of [-1, 1]) {
        const wx = x + sx * Math.min(w * 0.29, dw * 0.96);
        box(p, doorC, wx, y + h * 0.24, fz, dw * 0.52, h * 0.42, 0.003);
        box(p, winC, wx, y + h * 0.26, fz + sz * 0.0008, dw * 0.44, h * 0.35, 0.002);
        box(p, doorC, wx, y + h * 0.26, fz + sz * 0.0012, 0.0018, h * 0.35, 0.002);
      }
    }
  }
  // Hanging inscribed plaque (匾额) under front eaves
  if (w >= 0.095) {
    box(p, '#1e1c1a', x, y + h * 0.78, z + d * 0.462, Math.min(w * 0.24, 0.048), Math.min(0.009, h * 0.18), 0.003);
    box(p, goldC, x, y + h * 0.79, z + d * 0.464, Math.min(w * 0.2, 0.04), Math.min(0.005, h * 0.1), 0.002);
  }
  // 5. Penetrating tie-beams (阑额), polychrome architrave (额枋彩画) & 2-tier Dougong bracket clusters (斗拱)
  const bh = Math.min(0.0075, h * 0.17);
  box(p, beamC, x, y + h - bh, z, w + 0.006, bh, d + 0.006);
  box(p, col, x, y + h - bh * 1.55, z, w + 0.008, bh * 0.55, d + 0.008);
  const nb = Math.max(4, Math.min(10, nc * 2));
  for (let i = 0; i <= nb; i++) {
    const bx = x - w * 0.45 + (i / nb) * (w * 0.9);
    for (const sz of [-1, 1]) {
      const bz = z + sz * (d * 0.468);
      // Ludou capital block (栌斗) + projecting Huagong bracket arm (华拱)
      box(p, col, bx, y + h - bh * 0.55, bz, cr * 2.1, bh * 0.55, cr * 2.2);
      box(p, shade(col, 1.12), bx, y + h - bh * 0.1, bz + sz * cr * 0.4, cr * 2.8, bh * 0.45, cr * 3.1);
    }
  }
  // 6. Concave curved Chinese hip-and-gable roof (反宇飞檐歇山顶)
  const ov = 1.32, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  const topY = proof(p, x, y + h, z, {
    n: 4, R0, R1: R0 * 0.28, h: rh, lift: 0.35, sub: 4,
    tile: roofC, sx: (w + d * (ov - 1)) / (d * ov),
  });
  // Main roof ridge (正脊), central ridge jewel (脊刹), and upturned owl-tail finials (鸱吻)
  const rw = Math.max(w * 0.48, (w + d * (ov - 1)) * 0.34);
  const darkRoof = shade(roofC, 0.74);
  box(p, darkRoof, x, topY - rh * 0.08, z, rw, Math.max(0.005, rh * 0.14), Math.max(0.005, d * 0.065));
  for (const sx of [-1, 1]) {
    box(p, goldC, x + sx * (rw * 0.49), topY - rh * 0.04, z, Math.max(0.005, rh * 0.13), Math.max(0.0095, rh * 0.25), Math.max(0.006, d * 0.075));
    // Gable ridge collar trim (垂脊端头与山花饰)
    box(p, darkRoof, x + sx * (rw * 0.47), topY - rh * 0.18, z, Math.max(0.0035, rh * 0.09), Math.max(0.004, rh * 0.11), d * 0.28);
  }
  return topY;
}

/**
 * Full-detail Chinese octagonal multi-eave / pavilion pagoda (八角密檐/楼阁式佛塔):
 * - Two-tier carved lotus Sumeru pedestal (八角仰覆莲须弥座) with ground balustrade
 * - Per-storey octagonal wall core, 8 vermilion corner pilasters (倚柱), arched doors (券门) & mullion windows
 * - Projecting octagonal balcony railings (平座勾栏) & under-eave bracket ring (斗拱层)
 * - Concave octagonal tiled eaves (`proof` n=8) & full Buddhist stupa spire (覆钵+十三天相轮+宝盖+塔刹)
 */
export function placePagodaOct(
  p: THREE.Object3D, x: number, y0: number, z: number,
  tiers: number, r0: number, h0: number, bodyC: string, eaveC: string,
): void {
  const [, colC, roofC, bandC, goldC] = stylePlaceHallColors(bodyC, '#8f241c', eaveC);
  const stoneC = '#cfc6b4', stoneLight = '#e0d8c8', doorC = '#5c1a14';
  // 1. Two-stage octagonal Sumeru lotus pedestal (仰覆莲须弥座)
  const baseH = Math.min(0.014, h0 * 0.42);
  cyl(p, stoneC, x, y0, z, r0 * 1.22, baseH * 0.45, 8);
  cyl(p, shade(stoneC, 0.88), x, y0 + baseH * 0.45, z, r0 * 1.06, baseH * 0.28, 8);
  cyl(p, stoneLight, x, y0 + baseH * 0.73, z, r0 * 1.16, baseH * 0.27, 8);
  let y = y0 + baseH;

  for (let i = 0; i < tiers; i++) {
    const k = 1 - (i / tiers) * 0.45;
    const r = r0 * k;
    const h = h0 * (i === 0 ? 1.12 : 1 - (i / tiers) * 0.24);
    // Projecting octagonal balcony (平座勾栏) on upper storeys
    if (i > 0 && h0 >= 0.018) {
      cyl(p, colC, x, y, z, r * 1.04, Math.min(0.0035, h * 0.14), 8);
      cyl(p, stoneLight, x, y + Math.min(0.0035, h * 0.14), z, r * 0.99, Math.min(0.002, h * 0.08), 8);
    }
    // Octagonal masonry/timber shaft
    cyl(p, bodyC, x, y, z, r * 0.91, h, 8);
    // 8 corner columns (八角倚柱)
    for (let c = 0; c < 8; c++) {
      const a = (c * Math.PI) / 4 + Math.PI / 8;
      cyl(p, colC, x + Math.cos(a) * r * 0.92, y, z + Math.sin(a) * r * 0.92, Math.max(0.0018, r * 0.055), h, 5);
    }
    // 4 cardinal arched door niches (券门) + 4 diagonal lattice windows (直棂假窗)
    for (let d = 0; d < 8; d++) {
      const a = (d * Math.PI) / 4;
      const isDoor = d % 2 === 0;
      box(
        p, isDoor ? doorC : colC,
        x + Math.cos(a) * r * 0.88, y + (isDoor ? h * 0.06 : h * 0.22), z + Math.sin(a) * r * 0.88,
        r * (isDoor ? 0.28 : 0.22), h * (isDoor ? 0.64 : 0.42), r * 0.12, -a + Math.PI / 2,
      );
    }
    // Under-eave polychrome tie-beam & bracket ring (额枋与斗拱层)
    cyl(p, bandC, x, y + h * 0.84, z, r * 0.96, h * 0.1, 8);
    cyl(p, colC, x, y + h * 0.92, z, r * 1.02, h * 0.08, 8);
    // Concave octagonal roof eave (八角飞檐瓦顶)
    const eaveH = Math.max(0.011, h0 * 0.42 * k);
    proof(p, x, y + h * 0.94, z, {
      n: 8, R0: r * 1.38, R1: r * 0.72, h: eaveH,
      lift: 0.34, sub: 2, tile: roofC,
    });
    y += h + eaveH * 0.56;
  }
  // 2. Full Buddhist Stupa Spire (塔刹：覆钵、相轮十三天、宝盖与宝珠)
  const topR = r0 * 0.34;
  cyl(p, stoneLight, x, y, z, topR * 1.05, Math.max(0.004, h0 * 0.14), 8);
  ellip(p, goldC, x, y + Math.max(0.007, topR * 0.32), z, topR * 0.78, Math.max(0.006, topR * 0.34), topR * 0.78);
  gourd(p, x, y + Math.max(0.01, topR * 0.45), z, Math.max(0.014, topR * 0.92), goldC);
}

