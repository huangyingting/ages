import * as THREE from 'three';
import { type Builder, box, rbox, cyl, cone as rawCone, ellip, rod, gable as rawGable, prism, tbox as rawTbox, shade, plinth, tree, SITE } from '../prims.ts';
import { grp, proof } from '../timber.ts';
import { human } from '../human.ts';

let siteSeq = 0;
function site(root: THREE.Group, top: string, k = 0.88): [THREE.Group, number] {
  const h = plinth(root, top);
  const p = new THREE.Group();
  p.position.y = h + 0.0015;
  p.scale.setScalar(k);
  root.add(p);
  const s = ++siteSeq;
  const a1 = 0.8 + (s % 7) * 0.37, a2 = a1 + 2.1 + (s % 5) * 0.25;
  const tops = ['#6e5238', '#843226', '#345468', '#4c643e', '#764e36', '#564458', '#8e6632'];
  const bots = ['#42362a', '#d8d0be', '#2e363e', '#c2b8a4', '#4e3a30', '#38463a'];
  const poses = ['walk', 'point', 'stand', 'relax', 'carry'] as const;
  const hats = ['knot', 'brim', 'conical', 'turban', 'hood'] as const;
  if (top !== SITE.water && top !== SITE.snow) {
    tree(p, Math.cos(a1) * 0.34, 0, Math.sin(a1) * 0.31, 0.046 + (s % 3) * 0.006, s & 1 ? '#44683a' : '#4e6c3c');
    human(p, Math.cos(a2) * 0.28, 0, Math.sin(a2) * 0.27, {
      h: 0.042, ry: -a2, pose: poses[s % poses.length],
      top: tops[s % tops.length], bottom: bots[(s >> 1) % bots.length],
      dress: s % 3 === 0 ? 'knee' : 'ankle', hat: '#362c24', hatStyle: hats[s % hats.length], detail: 'hi',
    });
  }
  return [p, 0];
}

function gable(
  p: THREE.Object3D, w: number, h: number, d: number,
  c: string, x = 0, y = 0, z = 0, ry = 0,
): THREE.Mesh {
  const m = rawGable(p, w * 0.92, h * 0.88, d * 0.92, c, x, y, z, ry);
  const g = grp(p, x, z, ry, y);
  const R0 = ((d / 2) * 1.06) / Math.SQRT1_2;
  const topY = proof(g, 0, 0, 0, {
    n: 4, R0, R1: R0 * 0.28, h, lift: 0.34, sub: 4,
    tile: c, sx: w / Math.max(0.02, d * 1.06),
  });
  const rw = Math.max(w * 0.48, 0.024);
  box(g, shade(c, 0.76), 0, topY - h * 0.08, 0, rw, Math.max(0.004, h * 0.14), Math.max(0.004, d * 0.06));
  for (const sx of [-1, 1]) {
    box(g, '#d8a634', sx * (rw * 0.49), topY - h * 0.04, 0, Math.max(0.004, h * 0.12), Math.max(0.008, h * 0.22), Math.max(0.005, d * 0.07));
  }
  return m;
}

function band(p: THREE.Object3D, z0: number, z1: number, y: number, h: number, c: string, r = 0.43): void {
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const z = z0 + ((z1 - z0) * i) / 10, x = Math.sqrt(Math.max(0, r * r - z * z));
    L.push([-x, z]); R.push([x, z]);
  }
  prism(p, [...L, ...R.reverse()], y, h, c);
}

function tbox(
  p: THREE.Object3D, w0: number, d0: number, w1: number, d1: number, h: number,
  c: string, x = 0, y = 0, z = 0, ry = 0,
): THREE.Mesh {
  const m = rawTbox(p, w0, d0, w1, d1, h, c, x, y, z, ry);
  if (w0 >= 0.11 && d0 >= 0.04 && h >= 0.022) {
    const g = grp(p, x, z, ry, y);
    const rimC = shade(c, 1.12), darkC = shade(c, 0.82);
    box(g, rimC, 0, 0, 0, w0 + 0.008, Math.min(0.006, h * 0.14), d0 + 0.008);
    box(g, rimC, 0, h - Math.min(0.006, h * 0.14), 0, w1 + 0.008, Math.min(0.006, h * 0.14), d1 + 0.008);
    for (const f of [0.34, 0.67]) {
      const wf = w0 + (w1 - w0) * f + 0.003, df = d0 + (d1 - d0) * f + 0.003;
      box(g, darkC, 0, h * f, 0, wf, 0.0028, df);
    }
    const qw = Math.min(0.014, w1 * 0.1), qd = Math.min(0.014, d1 * 0.12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(g, rimC, sx * (w1 * 0.48), 0, sz * (d1 * 0.48), qw, h, qd);
    }
    if (w0 >= 0.2 && h >= 0.042) {
      const nb = Math.max(4, Math.min(11, Math.round(w1 / 0.038)));
      const mw = (w1 * 0.9) / (nb * 1.45);
      for (let i = 0; i < nb; i++) {
        const bx = -w1 * 0.44 + (i / Math.max(1, nb - 1)) * (w1 * 0.88);
        for (const sz of [-1, 1]) {
          box(g, darkC, bx, h, sz * (d1 * 0.46), mw, 0.009, 0.007);
        }
      }
    }
  }
  return m;
}

function cone(
  p: THREE.Object3D, c: string, x: number, y: number, z: number,
  r: number, h: number, seg = 8, ry = 0,
): THREE.Mesh {
  if (r >= 0.045 && h >= 0.065 && seg <= 8) {
    const sMain = 14 + (seg % 5);
    const m = rawCone(p, c, x, y, z, r, h, sMain, ry);
    const darkC = shade(c, 0.84), lightC = shade(c, 1.12);
    rawCone(p, darkC, x, y, z, r * 1.08, h * 0.42, 10, ry + 0.35);
    for (let i = 0; i < 4; i++) {
      const a = ry + (i * Math.PI) / 2 + 0.4;
      const sr = r * (0.46 + (i % 2) * 0.08), sh = h * (0.58 + (i % 2) * 0.12);
      rawCone(p, i % 2 ? darkC : lightC, x + Math.cos(a) * r * 0.42, y, z + Math.sin(a) * r * 0.42, sr, sh, 8, a);
    }
    return m;
  }
  return rawCone(p, c, x, y, z, r, h, seg, ry);
}

function hall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, wall: string, col: string, roofC: string, rh = h * 0.85): number {
  const stoneC = '#cfc6b4', doorC = '#6e1d16', winC = '#efe4cc', goldC = '#d8a634', beamC = '#2e7666';
  box(p, stoneC, x, y, z, w + 0.01, Math.min(0.007, h * 0.14), d + 0.01);
  if (w >= 0.085 && d >= 0.07) {
    const sw = Math.min(w * 0.32, 0.072);
    for (let s = 0; s < 3; s++) {
      box(p, stoneC, x, y + s * 0.0022, z + d * 0.5 + (2 - s) * 0.006, sw, 0.0025, 0.008);
    }
  }
  box(p, wall, x, y, z, w * 0.92, h, d * 0.9);
  const nc = Math.max(3, Math.min(7, Math.round(w / 0.036)));
  const nd = Math.max(2, Math.min(5, Math.round(d / 0.04)));
  const cr = Math.min(0.0044, Math.max(0.0028, w * 0.024));
  for (let i = 0; i <= nc; i++) {
    const cx = x - w * 0.46 + (i / nc) * (w * 0.92);
    for (const sz of [-1, 1]) {
      const cz = z + sz * (d * 0.46);
      cyl(p, stoneC, cx, y, cz, cr * 1.45, Math.min(0.0055, h * 0.11), 6);
      cyl(p, col, cx, y, cz, cr, h, 6);
    }
  }
  for (let j = 1; j < nd; j++) {
    const cz = z - d * 0.46 + (j / nd) * (d * 0.92);
    for (const sx of [-1, 1]) {
      const cx = x + sx * (w * 0.46);
      cyl(p, stoneC, cx, y, cz, cr * 1.4, Math.min(0.0055, h * 0.11), 6);
      cyl(p, col, cx, y, cz, cr, h, 6);
    }
  }
  const dh = h * 0.76, dw = Math.min(w * 0.32, 0.082);
  for (const sz of [-1, 1]) {
    const fz = z + sz * (d * 0.453);
    box(p, doorC, x, y, fz, dw, dh, 0.004);
    box(p, goldC, x, y + dh * 0.48, fz + sz * 0.001, dw * 0.9, 0.003, 0.003);
    if (w >= 0.11) {
      for (const sx of [-1, 1]) {
        const wx = x + sx * Math.min(w * 0.29, dw * 0.95);
        box(p, doorC, wx, y + h * 0.24, fz, dw * 0.5, h * 0.42, 0.003);
        box(p, winC, wx, y + h * 0.26, fz + sz * 0.0008, dw * 0.42, h * 0.35, 0.002);
      }
    }
  }
  const bh = Math.min(0.0075, h * 0.17);
  box(p, beamC, x, y + h - bh, z, w + 0.006, bh, d + 0.006);
  box(p, col, x, y + h - bh * 1.55, z, w + 0.008, bh * 0.55, d + 0.008);
  const nb = Math.max(4, Math.min(10, nc * 2));
  for (let i = 0; i <= nb; i++) {
    const bx = x - w * 0.45 + (i / nb) * (w * 0.9);
    for (const sz of [-1, 1]) {
      box(p, col, bx, y + h - bh * 0.35, z + sz * (d * 0.47), cr * 2.2, bh * 0.9, cr * 2.6);
    }
  }
  const ov = 1.32, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  const topY = proof(p, x, y + h, z, {
    n: 4, R0, R1: R0 * 0.28, h: rh, lift: 0.34, sub: 4,
    tile: roofC, sx: (w + d * (ov - 1)) / (d * ov),
  });
  const rw = Math.max(w * 0.48, (w + d * (ov - 1)) * 0.34);
  box(p, shade(roofC, 0.76), x, topY - rh * 0.08, z, rw, Math.max(0.005, rh * 0.14), Math.max(0.005, d * 0.06));
  for (const sx of [-1, 1]) {
    box(p, goldC, x + sx * (rw * 0.49), topY - rh * 0.04, z, Math.max(0.005, rh * 0.12), Math.max(0.009, rh * 0.24), Math.max(0.006, d * 0.07));
  }
  return topY;
}

function banner(p: THREE.Object3D, x: number, y: number, z: number, h: number, c: string, trim = '#d6a840'): void {
  cyl(p, '#4a321e', x, y, z, 0.003, h, 5);
  box(p, c, x + 0.024, y + h - 0.045, z, 0.045, 0.036, 0.003);
  box(p, trim, x + 0.024, y + h - 0.012, z, 0.046, 0.004, 0.004);
}

// ============================================================================
// 1. PREHISTORIC & ARCHAEOLOGICAL SITES & ENGINEERING WONDERS
// ============================================================================

/** 元谋人遗址: Yuanmou Earth Forest pillars (元谋土林), red-ochre fossil stratum, hearth fire & hominin figure. */
const pl_yuanmou: Builder = root => {
  const [gp, y0] = site(root, '#b87648', 0.88);
  // Layered red-bed excavation pit (元谋红层剖面)
  box(gp, '#9e5432', -0.05, y0, 0.08, 0.34, 0.024, 0.24);
  box(gp, '#c47b4a', -0.05, y0 + 0.024, 0.08, 0.28, 0.018, 0.18);
  // Iconic Yuanmou Earth Forest pillars (土林柱群) across the northern ridge
  for (const [x, z, r, h, c] of [
    [-0.24, -0.16, 0.048, 0.22, '#c8874e'], [-0.15, -0.22, 0.04, 0.27, '#ba7640'], [-0.04, -0.2, 0.052, 0.25, '#cf9158'],
    [0.08, -0.23, 0.044, 0.29, '#b8723c'], [0.19, -0.18, 0.05, 0.23, '#c8864c'], [0.27, -0.1, 0.038, 0.18, '#b46e38'],
  ] as [number, number, number, number, string][]) {
    cone(gp, c, x, y0, z, r, h, 7);
    cyl(gp, shade(c, 0.88), x, y0, z, r * 0.72, h * 0.65, 6);
  }
  // Early hearth fire, chipped quartz stone scrapers & commemorative fossil marker
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ellip(gp, '#5f5a52', 0.06 + Math.cos(a) * 0.032, y0 + 0.046, 0.1 + Math.sin(a) * 0.032, 0.01, 0.008, 0.01);
  }
  cone(gp, '#e86820', 0.06, y0 + 0.045, 0.1, 0.018, 0.042, 6);
  cone(gp, '#f6b83b', 0.06, y0 + 0.05, 0.1, 0.01, 0.03, 5);
  box(gp, '#d6ccb8', -0.16, y0 + 0.042, 0.12, 0.055, 0.065, 0.018);
  human(gp, -0.04, y0 + 0.042, 0.06, { h: 0.055, top: '#6e4b2c', bottom: '#583b22', skin: '#a87550', hair: '#1c1612', detail: 'lo' });
  tree(gp, -0.29, y0, 0.15, 0.065, '#6a7c44');
};

/** 河姆渡遗址: Stilted mortise-and-tenon longhouse (干栏式长屋) over water, rice paddies, canoe & twin-bird sun ivory plaque. */
const pl_hemudu: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const WD = '#6b4a2e', TH = '#8c7448', WATER = '#3f6d6a', RICE = '#b8a844';
  band(gp, -0.05, 0.28, y0, 0.005, WATER);
  // Golden domesticated rice paddies (人工栽培稻田) along the south bank
  for (let i = -3; i <= 3; i++) box(gp, i % 2 ? RICE : '#8fa046', i * 0.075, y0 + 0.004, 0.31, 0.055, 0.016, 0.07);
  // Timber piles (木桩) & mortise-and-tenon stilted longhouse (干栏式木构长屋)
  const lx = -0.03, lz = -0.06, lw = 0.44, ld = 0.16, py = y0 + 0.055;
  for (let ix = -3; ix <= 3; ix++) for (const sz of [-1, 0, 1]) {
    cyl(gp, WD, lx + ix * 0.064, y0, lz + sz * 0.062, 0.005, 0.06, 5);
  }
  box(gp, shade(WD, 1.1), lx, py, lz, lw, 0.01, ld);
  rail(gp, lx, py + 0.01, lz + ld * 0.44, lw);
  box(gp, '#c4b08a', lx, py + 0.01, lz - 0.01, lw - 0.05, 0.052, ld - 0.04);
  gable(gp, lw + 0.05, 0.068, ld + 0.05, TH, lx, py + 0.062, lz);
  box(gp, shade(TH, 0.78), lx, py + 0.126, lz, lw + 0.06, 0.01, 0.012);
  // Log ladder & dugout canoe with wooden paddle on the water
  rod(gp, [0.16, y0 + 0.005, 0.1], [0.12, py + 0.01, 0.02], 0.008, WD, 5);
  rbox(gp, '#583a20', -0.14, y0 + 0.006, 0.14, 0.13, 0.014, 0.034, 0.006);
  // Twin-bird sun ivory plaque monument (双鸟朝阳象牙蝶形器) on east bank
  box(gp, '#dfd6be', 0.25, y0, -0.18, 0.085, 0.048, 0.016);
  cyl(gp, '#d69e36', 0.25, y0 + 0.024, -0.17, 0.014, 0.006, 12).rotation.x = Math.PI / 2;
};

function rail(p: THREE.Object3D, x: number, y: number, z: number, w: number): void {
  box(p, '#5a3d24', x, y + 0.016, z, w, 0.004, 0.004);
  for (let i = -4; i <= 4; i++) box(p, '#5a3d24', x + (i * w) / 9, y, z, 0.004, 0.018, 0.004);
}

/** 良渚古城: Mojiaoshan palace earth platform, water city gate, bamboo raft & sacred Jade Cong King (玉琮王). */
const pl_liangzhu: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const EARTH = '#a88c62', JADE = '#4d8c74', TH = '#7a6644', WATER = '#3a686e';
  band(gp, 0.15, 0.3, y0, 0.005, WATER);
  // Water-gate & stone-faced city wall with bamboo raft
  for (const sx of [-1, 1]) tbox(gp, 0.18, 0.07, 0.16, 0.055, 0.048, EARTH, sx * 0.2, y0, 0.14);
  rbox(gp, '#b89e64', 0, y0 + 0.006, 0.22, 0.09, 0.008, 0.036, 0.003);
  // Mojiaoshan stepped palace terrace (莫角山大台基) with three thatched palace halls
  tbox(gp, 0.56, 0.34, 0.5, 0.3, 0.055, EARTH, 0, y0, -0.12);
  for (const [dx, dz, w, d, h] of [[0, -0.16, 0.22, 0.11, 0.048], [-0.16, -0.08, 0.11, 0.08, 0.036], [0.16, -0.08, 0.11, 0.08, 0.036]] as [number, number, number, number, number][]) {
    hall(gp, dx, y0 + 0.055, dz, w, d, h, '#d2c29e', '#5c3f26', TH, h * 0.9);
  }
  // Iconic Liangzhu Jade Cong (良渚玉琮王: 内圆外方) & Jade Bi disc on the ritual altar
  const jx = 0, jy = y0 + 0.055, jz = 0.01;
  box(gp, '#cfc6b0', jx, jy, jz, 0.075, 0.012, 0.075);
  box(gp, JADE, jx, jy + 0.012, jz, 0.048, 0.068, 0.048);
  cyl(gp, shade(JADE, 0.78), jx, jy + 0.012, jz, 0.022, 0.072, 16);
  for (let k = 0; k < 3; k++) box(gp, shade(JADE, 1.18), jx, jy + 0.02 + k * 0.02, jz, 0.052, 0.006, 0.052);
};

/** 大汶口遗址: Neolithic village, iconic white-pottery tripod Gui pitcher (白陶鬶) & sun-fire-mountain inscribed Zun jar. */
const pl_dawenkou: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const WHITE = '#ede8dc', CLAY = '#b65c3a', TH = '#7f6944';
  // Neolithic thatched houses (圆形与方形半地穴房址)
  cyl(gp, '#cbb894', -0.2, y0, -0.12, 0.085, 0.048, 14);
  cone(gp, TH, -0.2, y0 + 0.046, -0.12, 0.105, 0.075, 14);
  hall(gp, 0.18, y0, -0.12, 0.16, 0.12, 0.048, '#cbb894', '#5c3f26', TH, 0.05);
  // Iconic Dawenkou White Pottery Tripod Gui (白陶鬶: 鸟喙流、袋足、鋬手) on central display plinth
  const gx = -0.02, gy = y0 + 0.018, gz = 0.08;
  cyl(gp, '#a89b84', gx, y0, gz, 0.095, 0.018, 16);
  for (const a of [0.4, 2.5, 4.6]) {
    cone(gp, WHITE, gx + Math.cos(a) * 0.028, gy + 0.055, gz + Math.sin(a) * 0.028, 0.022, -0.055, 10);
  }
  ellip(gp, WHITE, gx, gy + 0.068, gz, 0.042, 0.036, 0.042);
  cyl(gp, WHITE, gx, gy + 0.09, gz, 0.02, 0.045, 10);
  // Upward bird-beak spout (仰天鸟喙流) and strap handle
  cone(gp, WHITE, gx + 0.022, gy + 0.125, gz, 0.016, 0.048, 8).rotation.z = -0.55;
  box(gp, WHITE, gx - 0.036, gy + 0.085, gz, 0.012, 0.042, 0.012);
  // Red-clay large-mouthed Zun jar (日月山刻符陶尊) beside it
  cyl(gp, CLAY, 0.14, y0, 0.14, 0.036, 0.095, 12);
  box(gp, '#f0c448', 0.14, y0 + 0.055, 0.176, 0.024, 0.024, 0.004);
};

/** 都江堰: Fish Mouth levee (鱼嘴分水堤), Baopingkou cut through Lidui (离堆宝瓶口), Anlan suspension bridge & Erwang Temple. */
const pl_dujiangyan: Builder = root => {
  const [gp, y0] = site(root, '#36757e', 0.88);
  const STONE = '#b8b2a2', MTN = '#4b6e44', BAMBOO = '#a89254', RED = '#982f26', TILE = '#4a5056';
  // Fish Mouth dividing levee (鱼嘴分水堤) splitting the Minjiang into Inner & Outer Rivers
  prism(gp, [[-0.08, -0.35], [0.06, -0.35], [0.1, 0.02], [0.0, 0.24], [-0.09, 0.05]], y0, 0.028, STONE);
  // Bamboo-stone gabions (竹笼杩槎) lining the levee nose
  for (let i = 0; i < 4; i++) cyl(gp, BAMBOO, -0.02 + i * 0.018, y0 + 0.028, 0.14 - i * 0.03, 0.008, 0.036, 6).rotation.x = Math.PI / 2;
  // Mount Yulei & Lidui rock island (玉垒山与离堆) cut by Baopingkou channel (宝瓶口)
  cone(gp, MTN, -0.28, y0, -0.14, 0.15, 0.22, 8);
  cone(gp, shade(MTN, 0.92), -0.22, y0, 0.2, 0.095, 0.13, 7);
  // Erwang Temple (二王庙) & Fulongguan pavilion on the mountain slopes
  hall(gp, -0.26, y0 + 0.1, -0.1, 0.11, 0.075, 0.038, '#e2dac8', RED, TILE, 0.034);
  hall(gp, -0.22, y0 + 0.09, 0.2, 0.075, 0.065, 0.032, '#e2dac8', RED, TILE, 0.03);
  // Anlan Suspension Bridge (安澜索桥) spanning across the divided river channels
  for (const x of [-0.18, -0.02, 0.18]) hall(gp, x, y0 + 0.02, -0.04, 0.038, 0.038, 0.032, '#dfd6c2', RED, TILE, 0.024);
  for (const sz of [-0.052, -0.028]) rod(gp, [-0.18, y0 + 0.042, sz], [0.18, y0 + 0.042, sz], 0.0025, '#4a3822', 4);
  box(gp, '#8c6d42', 0, y0 + 0.028, -0.04, 0.36, 0.005, 0.026);
  tree(gp, 0.28, y0, 0.12, 0.065, '#587844');
};

/** 敦煌鸣沙山与月牙泉: Crescent Moon Spring cradled by golden Singing Sand Dunes, Crescent Pavilion & camel caravan. */
const pl_dunhuang: Builder = root => {
  const [gp, y0] = site(root, '#d8b06a', 0.88);
  const SAND = '#d4a658', SAND2 = '#c49244', WATER = '#2c828c', RED = '#982e24', TILE = '#4a5258';
  // Sweeping golden Singing Sand Dunes (鸣沙山沙丘脊线)
  prism(gp, [[-0.4, -0.12], [-0.15, -0.36], [0.22, -0.32], [0.4, -0.05], [0.2, -0.12], [-0.15, -0.14]], y0, 0.14, SAND, 0.08);
  cone(gp, SAND2, -0.22, y0, -0.2, 0.18, 0.21, 6);
  cone(gp, SAND, 0.18, y0, -0.22, 0.19, 0.23, 6);
  // Crescent Moon Spring (月牙泉) in the hollow
  prism(gp, [[-0.18, 0.08], [-0.06, 0.01], [0.09, 0.02], [0.19, 0.11], [0.07, 0.07], [-0.06, 0.06]], y0, 0.006, WATER);
  // Crescent Pavilion complex (月牙泉夫妻柳与七星草堂古建群) on the south bank
  hall(gp, -0.02, y0 + 0.01, 0.2, 0.15, 0.09, 0.042, '#e4dcc8', RED, TILE, 0.038);
  hall(gp, -0.02, y0 + 0.065, 0.2, 0.1, 0.065, 0.03, '#e4dcc8', RED, TILE, 0.032);
  hall(gp, 0.15, y0 + 0.008, 0.22, 0.08, 0.065, 0.032, '#e4dcc8', RED, TILE, 0.028);
  for (const [x, z] of [[-0.2, 0.18], [0.25, 0.16], [-0.14, 0.26]] as [number, number][]) tree(gp, x, y0, z, 0.06, '#5c7c44');
};

// ============================================================================
// 2. NINE FAMOUS HISTORICAL BATTLEFIELDS (古战场)
// ============================================================================

/** 牧野之战 (1046 BC): King Wu's four-horse bronze war chariot, white feathered standard & golden axe (白旄黄钺). */
const pl_muye: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const BRZ = '#b88c38', RED = '#9a2820', WD = '#523620';
  // Earthen command platform (牧野誓师坛) with King Wu holding 黄钺 and 白旄
  tbox(gp, 0.28, 0.2, 0.24, 0.17, 0.045, '#a6895e', 0, y0, -0.16);
  human(gp, 0, y0 + 0.045, -0.15, { h: 0.068, top: '#242226', bottom: RED, hat: '#d6a840', hatStyle: 'peaked', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
  cyl(gp, WD, 0.032, y0 + 0.045, -0.14, 0.003, 0.11, 5);
  for (let k = 0; k < 3; k++) cone(gp, '#f2eee4', 0.032, y0 + 0.14 - k * 0.018, -0.14, 0.012, 0.022, 6);
  // Zhou four-horse bronze war chariot (檀车煌煌、驷騵彭彭) charging forward
  const cz = 0.08;
  box(gp, RED, 0, y0 + 0.032, cz, 0.09, 0.038, 0.075);
  for (const sx of [-1, 1]) cyl(grp(gp, sx * 0.055, cz, 0, y0 + 0.035), BRZ, 0, 0, 0, 0.035, 0.008, 14).rotation.z = Math.PI / 2;
  box(gp, WD, 0, y0 + 0.03, cz + 0.08, 0.01, 0.008, 0.11);
  for (const dx of [-0.075, -0.025, 0.025, 0.075]) {
    box(gp, '#8c4228', dx, y0 + 0.024, cz + 0.12, 0.028, 0.032, 0.065);
    box(gp, '#8c4228', dx, y0 + 0.048, cz + 0.145, 0.02, 0.028, 0.024);
  }
  banner(gp, -0.22, y0, -0.08, 0.18, RED, BRZ);
  banner(gp, 0.22, y0, -0.08, 0.18, RED, BRZ);
};

/** 长平之战 (260 BC): Steep Danshui gorge & Danling earthworks, Qin crossbow phalanx, watchtower & bronze arrowheads. */
const pl_changping: Builder = root => {
  const [gp, y0] = site(root, '#9c7d54', 0.88);
  const EARTH = '#8b6d46', DARK = '#28262a', RED = '#8c261e', BRZ = '#a88438';
  // Left & right steep ridges of the Danshui valley (丹水两岸绝壁与百里石长城垒)
  prism(gp, [[-0.4, -0.28], [-0.18, -0.32], [-0.16, 0.26], [-0.38, 0.22]], y0, 0.12, EARTH, 0.04);
  prism(gp, [[0.16, -0.3], [0.38, -0.24], [0.38, 0.24], [0.18, 0.28]], y0, 0.13, EARTH, 0.04);
  // Qin timber encirclement watchtower (秦军壁垒望楼) on the east ridge
  hall(gp, 0.26, y0 + 0.13, -0.04, 0.09, 0.09, 0.065, '#463526', DARK, DARK, 0.036);
  // Palisade wall blocking the valley floor (绝赵粮道壁垒)
  box(gp, EARTH, 0, y0, -0.18, 0.36, 0.055, 0.045);
  for (let i = -4; i <= 4; i++) box(gp, EARTH, i * 0.038, y0 + 0.055, -0.165, 0.022, 0.016, 0.015);
  // Giant sculptural Qin-Zhao bronze arrowhead monument (长平箭镞阵) & soldiers in valley
  cone(gp, BRZ, -0.04, y0 + 0.02, 0.06, 0.032, 0.11, 3).rotation.x = 0.25;
  banner(gp, -0.26, y0 + 0.12, 0.05, 0.15, DARK, RED);
  banner(gp, 0.26, y0 + 0.13, 0.1, 0.15, RED, BRZ);
  for (const [x, z, c] of [[-0.08, 0.16, DARK], [0.06, 0.14, DARK], [0, -0.04, RED]] as [number, number, string][]) {
    human(gp, x, y0, z, { h: 0.05, top: c, bottom: '#242220', armor: '#3a3632', hat: '#242220', hatStyle: 'cap', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
  }
};

/** 巨鹿之战 (207 BC): "Smash the Cauldrons and Sink the Boats" (破釜沉舟) — half-sunk boat in Zhang River & broken bronze ding. */
const pl_julu: Builder = root => {
  const [gp, y0] = site(root, '#a68c64', 0.88);
  const WATER = '#3a626a', BRZ = '#8c6e36', RED = '#a2261e', WD = '#583b22';
  band(gp, 0.12, 0.34, y0, 0.006, WATER);
  // Half-sunk wooden ferry boat (漳水沉舟) tilted into the river waves
  const boat = grp(gp, -0.12, 0.22, 0.2, y0 + 0.008);
  boat.rotation.z = -0.28;
   boat.rotation.x = 0.18;
  rbox(boat, WD, 0, 0, 0, 0.18, 0.028, 0.058, 0.008);
  // Shattered bronze cauldrons over glowing embers (破釜断甑) on the riverbank
  for (const [dx, dz, rz] of [[0.12, 0.04, 0.55], [0.19, 0.08, -0.7]] as [number, number, number][]) {
    const d = grp(gp, dx, dz, 0, y0 + 0.018);
    d.rotation.z = rz;
    cyl(d, BRZ, 0, 0, 0, 0.032, 0.034, 10);
    for (const a of [0, 2.1, 4.2]) cyl(d, BRZ, Math.cos(a) * 0.022, -0.022, Math.sin(a) * 0.022, 0.005, 0.024, 5);
  }
  cone(gp, '#e2581e', 0.15, y0, 0.06, 0.026, 0.038, 6);
  // Chu army storming the Qin corridor ramparts (九战破章邯甬道)
  tbox(gp, 0.44, 0.12, 0.4, 0.09, 0.065, '#8a7250', 0, y0, -0.18);
  banner(gp, -0.14, y0, -0.02, 0.2, RED, '#f0c440');
  banner(gp, 0.04, y0 + 0.065, -0.18, 0.18, RED, '#f0c440');
  human(gp, -0.04, y0, 0.02, { h: 0.062, top: RED, bottom: '#262220', armor: '#8c2820', hat: '#d6a840', hatStyle: 'plume', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
};

/** 垓下之战 (202 BC): Ten-sided Han encirclement banners (十面埋伏), Xiang Yu's pavilion, black steed Wujiang & Overlord Halberd. */
const pl_gaixia: Builder = root => {
  const [gp, y0] = site(root, '#9b845e', 0.88);
  const RED = '#9e261e', BLACK = '#242226', GOLD = '#d6a840';
  // Central Chu command mound & war tent (霸王中军帐)
  tbox(gp, 0.3, 0.24, 0.26, 0.2, 0.042, '#8a724e', 0, y0, -0.04);
  cone(gp, '#7a221c', 0, y0 + 0.072, -0.08, 0.11, 0.068, 8);
  cyl(gp, '#34261c', 0, y0 + 0.042, -0.08, 0.092, 0.034, 8);
  // Black warhorse Wujiang (乌骓马) & upright bronze Overlord Halberd (天龙破城戟)
  box(gp, BLACK, 0.08, y0 + 0.065, 0.02, 0.028, 0.034, 0.062);
  box(gp, BLACK, 0.08, y0 + 0.092, 0.045, 0.02, 0.03, 0.024);
  for (const sx of [-0.01, 0.01]) for (const sz of [-0.022, 0.022]) cyl(gp, BLACK, 0.08 + sx, y0 + 0.042, 0.02 + sz, 0.004, 0.026, 5);
  cyl(gp, GOLD, -0.07, y0 + 0.042, 0.03, 0.0035, 0.13, 6);
  box(gp, GOLD, -0.058, y0 + 0.145, 0.03, 0.024, 0.018, 0.004);
  // Ring of surrounding Han banners (十面埋伏汉军旌旗)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    banner(gp, Math.cos(a) * 0.34, y0, Math.sin(a) * 0.34, 0.15, RED, GOLD);
  }
  human(gp, -0.02, y0 + 0.042, 0.02, { h: 0.062, top: BLACK, bottom: RED, armor: BLACK, hat: GOLD, hatStyle: 'plume', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
};

/** 大泽乡起义 (209 BC): Rain-soaked marsh altar, Chen Sheng & Wu Guang raising bamboo poles as banners (揭竿而起). */
const pl_dazexiang: Builder = root => {
  const [gp, y0] = site(root, '#5c6e48', 0.88);
  const BAMBOO = '#7a9448', RED = '#a82a20', EARTH = '#8c724c';
  band(gp, 0.16, 0.34, y0, 0.005, '#425e5c');
  // Stepped earthen oath altar (大泽乡盟誓坛) in the marsh
  tbox(gp, 0.32, 0.24, 0.26, 0.19, 0.045, EARTH, 0, y0, -0.06);
  tbox(gp, 0.2, 0.15, 0.17, 0.12, 0.035, shade(EARTH, 1.08), 0, y0 + 0.045, -0.06);
  // Tall green bamboo poles hoisted with crimson cloth banners (斩木为兵、揭竿为旗)
  for (const [x, z, h] of [[-0.06, -0.06, 0.21], [0.06, -0.06, 0.19], [-0.18, 0.04, 0.16], [0.18, 0.04, 0.16]] as [number, number, number][]) {
    cyl(gp, BAMBOO, x, y0 + 0.045, z, 0.004, h, 6);
    box(gp, RED, x + 0.026, y0 + 0.045 + h - 0.045, z, 0.05, 0.038, 0.004);
  }
  // Thatched garrison camp shed & blazing watchfire
  hall(gp, -0.22, y0, -0.18, 0.12, 0.09, 0.04, '#b8a27a', '#5a3d24', '#7a6642', 0.038);
  cone(gp, '#e8641c', 0.18, y0, 0.1, 0.024, 0.045, 6);
  human(gp, -0.02, y0 + 0.08, -0.04, { h: 0.06, top: '#7a3428', bottom: '#3a322a', hat: '#8a2820', hatStyle: 'turban', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
  human(gp, 0.04, y0 + 0.08, -0.05, { h: 0.058, top: '#3c4e5c', bottom: '#3a322a', hat: '#24201c', hatStyle: 'knot', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
};

/** 官渡之战 (200 AD): Cao Cao's watchtower & counterweight trebuchet (霹雳车) facing the burning Wuchao granary (火烧乌巢). */
const pl_guandu: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const WD = '#5e3e24', FIRE = '#e85d1a', GOLD = '#f5b82e', EARTH = '#9a7e56';
  // Cao Cao's fortified stockade & timber watchtower (官渡曹营望楼) on the south-west
  tbox(gp, 0.24, 0.18, 0.21, 0.15, 0.045, EARTH, -0.16, y0, 0.1);
  hall(gp, -0.16, y0 + 0.045, 0.1, 0.1, 0.1, 0.075, '#cbb894', WD, '#4a4e54', 0.042);
  // Counterweight/traction trebuchet (霹雳车/发石车) aimed at Wuchao
  for (const sx of [-0.02, 0.02]) rod(gp, [-0.02 + sx, y0, 0.14], [-0.02 + sx * 0.3, y0 + 0.075, 0.11], 0.004, WD, 5);
  rod(gp, [-0.02, y0 + 0.05, 0.17], [-0.02, y0 + 0.12, 0.04], 0.0045, WD, 5);
  // Yuan Shao's Wuchao grain depot engulfed in flames (火烧乌巢粮仓) at north-east
  const wx = 0.15, wz = -0.14;
  cyl(gp, '#b89e6c', wx - 0.06, y0, wz, 0.065, 0.065, 12);
  cone(gp, '#7a623c', wx - 0.06, y0 + 0.065, wz, 0.078, 0.052, 12);
  cyl(gp, '#5c3824', wx + 0.06, y0, wz + 0.03, 0.06, 0.058, 12);
  cone(gp, FIRE, wx + 0.06, y0 + 0.05, wz + 0.03, 0.068, 0.095, 7);
  cone(gp, GOLD, wx + 0.05, y0 + 0.06, wz + 0.04, 0.042, 0.075, 6);
  cone(gp, FIRE, wx - 0.04, y0 + 0.09, wz, 0.045, 0.07, 6);
};

/** 赤壁之战 (208 AD): Red sandstone cliff carved with "赤壁", chained northern warships & Huang Gai's blazing fire-ship. */
const pl_chibi: Builder = root => {
  const [gp, y0] = site(root, '#2f5e6e', 0.88);
  const CLIFF = '#9e3e2b', WD = '#5a3a22', FIRE = '#ea5c18', GOLD = '#f6be32';
  // Towering red sandstone cliff (赤壁摩崖石刻) along the south-west shore
  prism(gp, [[-0.4, -0.1], [-0.14, -0.28], [-0.08, 0.18], [-0.36, 0.28]], y0, 0.19, CLIFF, 0.04);
  box(gp, '#f2e8d5', -0.14, y0 + 0.095, -0.02, 0.012, 0.055, 0.042);
  hall(gp, -0.25, y0 + 0.19, -0.05, 0.095, 0.075, 0.038, '#e2d8c4', '#942c22', '#4a5056', 0.034);
  // Chained Cao Cao tower-warships (铁索连环船) on the north-east river
  for (const [x, z] of [[0.14, -0.18], [0.22, -0.04]] as [number, number][]) {
    rbox(gp, WD, x, y0 + 0.008, z, 0.19, 0.026, 0.062, 0.008);
    box(gp, '#785030', x, y0 + 0.034, z, 0.11, 0.032, 0.044);
  }
  rod(gp, [0.14, y0 + 0.022, -0.15], [0.22, y0 + 0.022, -0.07], 0.004, '#3a3c40', 5);
  // Huang Gai's blazing fire-ship (黄盖火船) ramming into the fleet
  rbox(gp, WD, 0.05, y0 + 0.008, 0.12, 0.16, 0.022, 0.05, 0.006);
  cone(gp, FIRE, 0.07, y0 + 0.025, 0.11, 0.052, 0.11, 7);
  cone(gp, GOLD, 0.06, y0 + 0.03, 0.12, 0.034, 0.085, 6);
  cone(gp, FIRE, 0.16, y0 + 0.05, -0.05, 0.045, 0.085, 6);
};

/** 淝水之战 (383 AD): Fei River channel, Pine-covered Mount Bagong (八公山草木皆兵) & Beifu Army vs Former Qin banners. */
const pl_feishui: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const WATER = '#386c74', MTN = '#526e46', JIN = '#2b4c6e', QIN = '#8c3226';
  // Fei River diagonal channel cutting across the battlefield
  band(gp, -0.06, 0.1, y0, 0.006, WATER);
  // Mount Bagong (八公山) on the north ridge, dense with pines that look like arrayed troops (草木皆兵)
  prism(gp, [[-0.36, -0.34], [0.28, -0.34], [0.34, -0.14], [-0.32, -0.12]], y0, 0.13, MTN, 0.06);
  for (const x of [-0.24, -0.14, -0.04, 0.06, 0.16, 0.24]) tree(gp, x, y0 + 0.11, -0.22, 0.068, '#385834');
  // Eastern Jin Beifu Army (北府兵) formation on the south bank & retreating Former Qin banners on the north
  for (const x of [-0.16, -0.04, 0.08, 0.2]) {
    box(gp, JIN, x, y0, 0.2, 0.032, 0.045, 0.008);
    human(gp, x, y0, 0.23, { h: 0.052, top: JIN, bottom: '#262420', armor: '#484c52', hat: '#2c3036', hatStyle: 'helmet', skin: '#c49a76', hair: '#1c1814', detail: 'lo' });
  }
  banner(gp, -0.22, y0, 0.24, 0.17, JIN, '#d6a840');
  banner(gp, 0.15, y0 + 0.12, -0.2, 0.16, QIN, '#d6a840');
};

/** 崖山海战 (1279 AD): Twin Yamen sea cliffs (崖门双峰), Song imperial dragon flagship & "奇石" memorial rock in the sea. */
const pl_yashan: Builder = root => {
  const [gp, y0] = site(root, '#265868', 0.88);
  const ROCK = '#5e5a52', WD = '#5e3c22', RED = '#9c2820', GOLD = '#d8a838';
  // Twin coastal cliffs framing the Yamen sea gate (东崖山与西汤瓶山双峰对峙)
  cone(gp, ROCK, -0.28, y0, -0.14, 0.13, 0.23, 7);
  cone(gp, shade(ROCK, 0.92), 0.28, y0, -0.14, 0.13, 0.22, 7);
  // Chained Song imperial flagship & flanking sea junks (宋军连环大舶) in the strait
  rbox(gp, WD, 0, y0 + 0.01, -0.02, 0.22, 0.032, 0.078, 0.01);
  hall(gp, 0, y0 + 0.042, -0.02, 0.12, 0.058, 0.038, RED, GOLD, GOLD, 0.032);
  for (const sx of [-0.14, 0.14]) {
    rbox(gp, shade(WD, 0.9), sx, y0 + 0.008, 0.06, 0.15, 0.022, 0.048, 0.008);
    cyl(gp, WD, sx, y0 + 0.03, 0.06, 0.004, 0.11, 5);
    box(gp, '#d8ccb4', sx + 0.006, y0 + 0.055, 0.06, 0.004, 0.065, 0.048);
  }
  // Iconic Yamen Sea Stone ("奇石 · 宋少帝与陆秀夫负帝蹈海处") rising from the foreground surf
  cone(gp, '#787268', 0, y0, 0.24, 0.052, 0.11, 6);
};

// ============================================================================
// 3. STRATEGIC PASSES (CURATED + 13 IMPORTED PASSES)
// ============================================================================

/** 玉门关: Small Fangpan Castle (小方盘城) — weathered Han square rammed-earth desert fortress with west/north arched gates. */
const pl_yumenguan: Builder = root => {
  const [gp, y0] = site(root, '#c8a66e', 0.88);
  const EARTH = '#b69158', DARK = '#523d24';
  // Square battered Han rammed-earth castle (小方盘城夯土遗址) with horizontal tamping layers
  tbox(gp, 0.34, 0.32, 0.29, 0.27, 0.14, EARTH, -0.04, y0, -0.02);
  box(gp, '#c8a66e', -0.04, y0 + 0.03, -0.02, 0.22, 0.115, 0.2);
  // Arched West & North gates (西门与北门拱券缺口)
  box(gp, DARK, -0.19, y0, -0.02, 0.06, 0.075, 0.052);
  box(gp, DARK, -0.04, y0, -0.16, 0.052, 0.075, 0.06);
  // Han desert beacon tower (汉长城烽燧) & Gobi gravel ridge
  tbox(gp, 0.095, 0.095, 0.068, 0.068, 0.16, shade(EARTH, 0.92), 0.24, y0, -0.16);
  box(gp, '#e2d8c4', -0.22, y0, 0.2, 0.042, 0.058, 0.014);
};

/** 函谷关: Deep sunken loess gorge road ("车不方轨") flanked by twin triple-eaved crimson gate towers & Laozi on green ox. */
const pl_hanguguan: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const LOESS = '#a88654', BRICK = '#686b70', RED = '#9c2c22', TILE = '#484e54';
  // Deep sunken Hangu ravine road (函谷深险隘道) flanked by steep loess cliffs
  prism(gp, [[-0.4, -0.3], [-0.14, -0.32], [-0.12, 0.3], [-0.38, 0.28]], y0, 0.09, LOESS, 0.03);
  prism(gp, [[0.12, -0.32], [0.38, -0.28], [0.4, 0.28], [0.14, 0.3]], y0, 0.09, LOESS, 0.03);
  // Battlemented brick gate wall bridging the ravine with twin triple-eaved towers (紫气东来关楼)
  tbox(gp, 0.48, 0.11, 0.44, 0.095, 0.085, BRICK, 0, y0, -0.04);
  box(gp, '#2a1814', 0, y0, -0.04, 0.065, 0.058, 0.115);
  for (const sx of [-0.13, 0.13]) {
    const h1 = hall(gp, sx, y0 + 0.085, -0.04, 0.13, 0.085, 0.042, '#e4dcc8', RED, TILE, 0.032);
    hall(gp, sx, h1 - 0.012, -0.04, 0.095, 0.065, 0.03, '#e4dcc8', RED, TILE, 0.028);
  }
  // Laozi riding his green ox (老子骑青牛出关) on the eastern approach road
  box(gp, '#4e585e', 0, y0 + 0.018, 0.2, 0.028, 0.028, 0.055);
  human(gp, 0, y0 + 0.035, 0.2, { h: 0.048, pose: 'sit', top: '#4a5d6e', bottom: '#3a4854', hat: '#e8e2d4', hatStyle: 'knot', skin: '#c49a76', hair: '#e8e2d4', detail: 'lo' });
};

/** 潼关: Loess cliff fortress at the great right-angle bend where the Wei & Yellow Rivers crash together (黄河大拐弯雄关). */
const pl_tongguan: Builder = root => {
  const [gp, y0] = site(root, '#b88a44', 0.88);
  const LOESS = '#a67e46', BRICK = '#6c6e72', RED = '#982c22', TILE = '#4a4e54';
  // Sharp Yellow River bend (黄河九曲大拐弯浑黄河水) sweeping around the north and east
  prism(gp, [[-0.4, -0.35], [0.4, -0.35], [0.4, 0.25], [0.18, 0.25], [0.14, -0.14], [-0.4, -0.14]], y0, 0.008, '#c2923e');
  // Towering Loess plateau bluff (潼关麒麟山黄土绝壁) on the south-west
  prism(gp, [[-0.38, -0.1], [0.12, -0.1], [0.14, 0.34], [-0.36, 0.34]], y0, 0.11, LOESS, 0.03);
  // Tongguan First Gate Tower & climbing battlements (天下第一城·十二连城)
  tbox(gp, 0.28, 0.11, 0.25, 0.095, 0.068, BRICK, -0.1, y0 + 0.11, 0.06);
  hall(gp, -0.1, y0 + 0.178, 0.06, 0.18, 0.085, 0.044, '#e4dcc8', RED, TILE, 0.038);
  // Ancient Fenglingdu ferry tower (古渡口谯楼) by the river edge
  hall(gp, 0.26, y0 + 0.01, -0.22, 0.085, 0.075, 0.038, '#e4dcc8', RED, TILE, 0.032);
};

/** 剑门关: Twin jagged Sword-Cliffs (七十二峰如剑立) with narrow V-cleft, wedged 3-storey gatehouse & cliff plank road. */
const pl_jianmenguan: Builder = root => {
  const [gp, y0] = site(root, '#5e6e48', 0.88);
  const ROCK = '#767064', RED = '#9c2c22', TILE = '#464c52', WD = '#6b4828', STONE = '#847e72';
  // Twin jagged Dajian Mountain Sword-Cliffs (大剑山七十二峰如剑立) flanking the narrow V-gorge
  for (const sx of [-1, 1]) {
    tbox(gp, 0.22, 0.24, 0.18, 0.19, 0.12, ROCK, sx * 0.26, y0, -0.06);
    cone(gp, shade(ROCK, 0.92), sx * 0.25, y0 + 0.12, -0.08, 0.12, 0.15, 5);
    cone(gp, shade(ROCK, 1.06), sx * 0.31, y0 + 0.1, 0.02, 0.085, 0.12, 5);
  }
  // Towering Three-Storey Jianmenguan Pass Gatehouse (天下雄关·剑门关三层重檐歇山城楼) wedged in the gorge
  tbox(gp, 0.32, 0.12, 0.29, 0.105, 0.072, STONE, 0, y0, 0.02);
  box(gp, '#241a16', 0, y0, 0.02, 0.058, 0.052, 0.125);
  const h1 = hall(gp, 0, y0 + 0.072, 0.02, 0.22, 0.095, 0.042, '#e6dec8', RED, TILE, 0.032);
  const h2 = hall(gp, 0, h1 - 0.008, 0.02, 0.16, 0.078, 0.034, '#e6dec8', RED, TILE, 0.028);
  hall(gp, 0, h2 - 0.008, 0.02, 0.11, 0.062, 0.028, '#e6dec8', RED, TILE, 0.026);
  // Cliffside timber plank road (蜀道难·绝壁古栈道) pinned along the front rock face
  box(gp, WD, -0.25, y0 + 0.075, 0.075, 0.2, 0.008, 0.032);
  box(gp, RED, -0.25, y0 + 0.083, 0.088, 0.2, 0.01, 0.004);
  for (let i = -2; i <= 2; i++) rod(gp, [-0.25 + i * 0.04, y0 + 0.025, 0.06], [-0.25 + i * 0.04, y0 + 0.075, 0.085], 0.004, WD, 4);
};

/** 平型关: Ming stone pass tower, sunken Qiaogou ambush ravine (乔沟伏击隘道) & Victory Monument on the ridge. */
const pl_pingxingguan: Builder = root => {
  const [gp, y0] = site(root, '#8c7e58', 0.88);
  const BRICK = '#6d7075', LOESS = '#9e8458', RED = '#982c22', TILE = '#4a4e54';
  // Sunken Qiaogou ambush ravine (乔沟深谷公路) in the foreground
  prism(gp, [[-0.38, 0.02], [-0.08, 0.02], [-0.08, 0.34], [-0.36, 0.34]], y0, 0.075, LOESS, 0.02);
  prism(gp, [[0.08, 0.02], [0.38, 0.02], [0.36, 0.34], [0.08, 0.34]], y0, 0.08, LOESS, 0.02);
  // Pingxingguan Great Wall pass wall & stone gatehouse (平型关城楼) at north
  tbox(gp, 0.56, 0.1, 0.52, 0.085, 0.075, BRICK, 0, y0, -0.14);
  box(gp, '#262220', 0, y0, -0.14, 0.055, 0.052, 0.11);
  hall(gp, 0, y0 + 0.075, -0.14, 0.16, 0.08, 0.04, '#e4dcc8', RED, TILE, 0.036);
  // Pingxingguan Victory Monument (平型关大捷纪念碑) on the east ridge
  box(gp, '#dfd8c8', 0.24, y0 + 0.08, 0.16, 0.055, 0.02, 0.055);
  box(gp, '#ebe4d6', 0.24, y0 + 0.1, 0.16, 0.028, 0.12, 0.028);
  banner(gp, 0.18, y0 + 0.08, 0.18, 0.13, '#b82820', '#f0c440');
};

/** Helper for the 13 distinct historical passes (`pass-*`) so each pass has its own mountain/river/wall layout. */
function makePass(
  ground: string, wallC: string, roofC: string, mtnC: string,
  opts: { water?: 'front' | 'under' | 'waterfall' | 'oasis'; twin?: boolean; plum?: boolean; bamboo?: boolean; tunnel?: boolean; beacon?: boolean; triArch?: boolean; curveWall?: boolean; plankRoad?: boolean; watchtower?: boolean }
): Builder {
  return root => {
    const [gp, y0] = site(root, ground, 0.88);
    if (opts.water === 'front' || opts.water === 'under') band(gp, opts.water === 'under' ? -0.08 : 0.18, opts.water === 'under' ? 0.12 : 0.34, y0, 0.006, '#386872');
    if (opts.water === 'waterfall') {
      box(gp, '#468292', 0.22, y0, 0.02, 0.09, 0.12, 0.08);
      band(gp, 0.16, 0.32, y0, 0.006, '#386872');
    }
    if (opts.water === 'oasis') prism(gp, [[-0.26, 0.12], [-0.08, 0.08], [-0.04, 0.24], [-0.22, 0.28]], y0, 0.006, '#347882');
    // Flanking mountain peaks
    cone(gp, mtnC, -0.29, y0, -0.1, 0.14, 0.21, 7);
    if (!opts.beacon) cone(gp, shade(mtnC, 0.92), 0.29, y0, -0.08, 0.14, 0.2, 7);
    if (opts.beacon) {
      // Yangguan desert beacon tower (阳关烽燧) + farewell pavilion
      tbox(gp, 0.14, 0.14, 0.1, 0.1, 0.19, '#b88652', 0.12, y0, -0.06);
      hall(gp, -0.15, y0, 0.02, 0.11, 0.085, 0.04, '#e2d8c4', '#982c22', roofC, 0.034);
      return;
    }
    const wz = -0.04;
    tbox(gp, 0.46, 0.11, 0.42, 0.095, 0.078, wallC, 0, y0, wz);
    for (const dx of opts.triArch ? [-0.09, 0, 0.09] : [0]) box(gp, '#241c18', dx, y0, wz, 0.048, 0.052, 0.115);
    if (opts.twin) {
      for (const sx of [-0.13, 0.13]) hall(gp, sx, y0 + 0.078, wz, 0.11, 0.08, 0.042, '#e4dcc8', '#982c22', roofC, 0.036);
    } else {
      const h1 = hall(gp, 0, y0 + 0.078, wz, 0.17, 0.088, 0.042, '#e4dcc8', '#982c22', roofC, 0.036);
      if (opts.curveWall) hall(gp, 0, h1 - 0.01, wz, 0.12, 0.068, 0.028, '#e4dcc8', '#982c22', roofC, 0.026);
    }
    if (opts.plankRoad) {
      box(gp, '#6e4a2a', -0.22, y0 + 0.036, 0.16, 0.16, 0.01, 0.042);
      for (const px of [-0.28, -0.22, -0.16]) cyl(gp, '#52361c', px, y0, 0.17, 0.005, 0.038, 5);
    }
    if (opts.watchtower) {
      tbox(gp, 0.075, 0.075, 0.065, 0.065, 0.085, wallC, 0.28, y0 + 0.14, -0.08);
    }
    if (opts.plum) for (const x of [-0.18, 0.18, 0.12]) tree(gp, x, y0, 0.18, 0.065, '#c84a62');
    if (opts.bamboo) for (let i = -3; i <= 3; i++) cyl(gp, '#4e7c3e', i * 0.045, y0, 0.22, 0.005, 0.11, 5);
    if (opts.tunnel) {
      box(gp, '#585c62', 0.22, y0, 0.18, 0.09, 0.065, 0.06);
      box(gp, '#1e2022', 0.22, y0, 0.21, 0.045, 0.045, 0.01);
    }
  };
}

const pl_pass_wuguan = makePass('#6b7c4e', '#72757a', '#484e54', '#4e6b42', { water: 'front' });
const pl_pass_dasanguan = makePass('#8c7d58', '#68645e', '#464a50', '#5e6a46', { twin: true, water: 'front' });
const pl_pass_xiaoguan = makePass('#a88856', '#9e7c4c', '#584838', '#8c7046', { curveWall: true });
const pl_pass_hulao = makePass('#a48454', '#8e382c', '#4a4e54', '#947448', { triArch: true, water: 'front' });
const pl_pass_yangping = makePass('#5e764a', '#6e6a62', '#4c5258', '#48683e', { water: 'under', plankRoad: true });
const pl_pass_yanmen = makePass('#8e8264', '#666a70', '#3f6e54', '#6e6858', { curveWall: true, triArch: true });
const pl_pass_zijing = makePass('#747e54', '#6e7278', '#484e54', '#586848', { water: 'front', plum: true });
const pl_pass_niangzi = makePass('#687c52', '#747068', '#4a5056', '#4e6844', { water: 'waterfall' });
const pl_pass_gubeikou = makePass('#7e7860', '#6a6e74', '#484c52', '#646258', { twin: true, water: 'under', watchtower: true });
const pl_pass_yangguan = makePass('#cfa868', '#b88852', '#524638', '#c49654', { beacon: true, water: 'oasis' });
const pl_pass_wusheng = makePass('#64784c', '#76787e', '#4a5056', '#4c6640', { tunnel: true });
const pl_pass_xianxia = makePass('#587446', '#848078', '#484e54', '#3f6238', { bamboo: true });
const pl_pass_meiguan = makePass('#6a7c4e', '#8c4438', '#484e54', '#4e6a42', { plum: true });

// ============================================================================
// 4. REVOLUTIONARY & MODERN HISTORY SITES
// ============================================================================

/** 井冈山: Five-Finger Peaks (五指峰), undulating Red Flag Monument (井冈山红旗雕塑) & Huangyangjie stone sentry. */
const pl_jinggangshan: Builder = root => {
  const [gp, y0] = site(root, '#567246', 0.88);
  const MTN = '#3e6238', RED = '#c4261e', GOLD = '#f2c438', STONE = '#9e988c';
  // Five-Finger Peaks (井冈山五指峰群峦) across the north horizon
  for (const [x, r, h] of [[-0.26, 0.09, 0.17], [-0.13, 0.1, 0.21], [0, 0.11, 0.25], [0.13, 0.1, 0.22], [0.26, 0.09, 0.18]] as [number, number, number][]) {
    cone(gp, MTN, x, y0, -0.2, r, h, 7);
  }
  // Iconic Jinggangshan Red Flag Sculpture (井冈山红旗雕塑) on stepped granite terrace
  tbox(gp, 0.28, 0.16, 0.24, 0.13, 0.032, STONE, -0.04, y0, 0.08);
  prism(gp, [[-0.14, 0.06], [0.08, 0.04], [0.1, 0.1], [-0.12, 0.12]], y0 + 0.032, 0.14, RED);
  cyl(gp, GOLD, -0.1, y0 + 0.13, 0.122, 0.016, 0.005, 5).rotation.x = Math.PI / 2;
  // Huangyangjie stone sentry & monument stele (黄洋界保卫战纪念碑)
  box(gp, STONE, 0.22, y0, 0.12, 0.045, 0.11, 0.035);
  tree(gp, -0.28, y0, 0.14, 0.065, '#466c3a');
};

/** 瑞金: Chinese Soviet Republic Central Auditorium (大礼堂) with octagonal red-star facade & hexagonal Red Well (红井). */
const pl_ruijin: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WALL = '#ece6d8', TILE = '#4a4e54', RED = '#c42820', STONE = '#8e887c';
  // Central Auditorium (中华苏维埃共和国临时中央政府大礼堂) with stepped pediment & red star
  box(gp, WALL, -0.06, y0, -0.08, 0.34, 0.085, 0.22);
  gable(gp, 0.36, 0.052, 0.24, TILE, -0.06, y0 + 0.085, -0.08);
  box(gp, WALL, -0.06, y0 + 0.065, 0.035, 0.16, 0.068, 0.02);
  cyl(gp, RED, -0.06, y0 + 0.11, 0.048, 0.016, 0.006, 5).rotation.x = Math.PI / 2;
  for (const dx of [-0.14, -0.06, 0.02]) box(gp, '#583b24', dx, y0, 0.032, 0.032, 0.052, 0.008);
  // Iconic Hexagonal Red Well (沙洲坝红井) & "吃水不忘挖井人" stone stele in the front right court
  cyl(gp, STONE, 0.2, y0, 0.16, 0.052, 0.022, 6);
  cyl(gp, '#2f5e68', 0.2, y0 + 0.005, 0.16, 0.036, 0.02, 6);
  box(gp, '#d8cfc0', 0.26, y0, 0.08, 0.036, 0.068, 0.014);
  tree(gp, -0.28, y0, 0.16, 0.078, '#4a6e3c');
};

/** 遵义: Zunyi Conference Site (遵义会议会址) — two-storey grey-brick & white-arched veranda mansion with red columns. */
const pl_zunyi: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#6d7178', WHITE = '#ebe6da', RED = '#982a22', TILE = '#44484e';
  // Two-storey East-meets-West grey-brick villa (中西合璧两层灰砖小楼)
  const w = 0.38, d = 0.2, z = -0.04;
  box(gp, BRICK, 0, y0, z, w, 0.135, d);
  // Front two-storey arched veranda gallery (双层罗马拱券回廊)
  box(gp, WHITE, 0, y0 + 0.064, z + d / 2 + 0.015, w, 0.01, 0.036);
  for (let i = -3; i <= 3; i++) {
    const cx = i * 0.052;
    cyl(gp, RED, cx, y0, z + d / 2 + 0.028, 0.0045, 0.064, 6);
    cyl(gp, WHITE, cx, y0 + 0.074, z + d / 2 + 0.028, 0.0045, 0.06, 6);
  }
  rail(gp, 0, y0 + 0.074, z + d / 2 + 0.03, w - 0.02);
  // Hip-and-gable grey tile roof with dormer window (歇山顶老虎窗)
  gable(gp, w + 0.05, 0.068, d + 0.07, TILE, 0, y0 + 0.135, z + 0.01);
  box(gp, WHITE, 0, y0 + 0.155, z + 0.075, 0.068, 0.036, 0.035);
  gable(gp, 0.078, 0.024, 0.045, TILE, 0, y0 + 0.19, z + 0.075);
  tree(gp, -0.26, y0, 0.18, 0.07, '#587644');
  tree(gp, 0.26, y0, 0.18, 0.065, '#587644');
};

/** 延安: Baota Mountain 9-storey octagonal pagoda (延安宝塔山), 3-arch Yan River Bridge & loess Yaodong cave dwellings. */
const pl_yanan: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const LOESS = '#b69258', BRICK = '#c4a878', WATER = '#4a6e72', STONE = '#b8b09e';
  band(gp, 0.08, 0.22, y0, 0.005, WATER);
  // Three-arch stone Yan River Bridge (延河大桥)
  box(gp, STONE, -0.08, y0 + 0.004, 0.15, 0.075, 0.024, 0.18);
  // Baota Mountain (宝塔山) at north-east topped by the 9-storey octagonal Tang-Ming brick pagoda
  cone(gp, LOESS, 0.16, y0, -0.14, 0.18, 0.13, 8);
  let py = y0 + 0.125;
  for (let i = 0; i < 7; i++) {
    const r = 0.038 * (1 - i * 0.085), h = 0.022 * (1 - i * 0.05);
    cyl(gp, BRICK, 0.16, py, -0.14, r, h, 8);
    cone(gp, '#8c7248', 0.16, py + h, -0.14, r * 1.18, 0.008, 8);
    py += h + 0.004;
  }
  cone(gp, '#6e5838', 0.16, py, -0.14, 0.012, 0.028, 8);
  // Row of three arched loess Yaodong cave dwellings (杨家岭/枣园黄土窑洞) at north-west
  tbox(gp, 0.26, 0.14, 0.24, 0.12, 0.085, LOESS, -0.18, y0, -0.14);
  for (const dx of [-0.25, -0.18, -0.11]) {
    box(gp, '#e6dec8', dx, y0, -0.078, 0.052, 0.058, 0.008);
    box(gp, '#5c3c24', dx, y0, -0.072, 0.036, 0.046, 0.006);
  }
};

/** 西柏坡: Seventh Plenum Auditorium (七届二中全会旧址礼堂), North China earthen courtyard & pine-clad hillside. */
const pl_xibaipo: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const WALL = '#c4ae86', TILE = '#565a60', RED = '#b82820';
  // Seventh Plenum Hall (七届二中全会旧址大礼堂) with arched doors & red flags
  hall(gp, -0.08, y0, -0.12, 0.28, 0.14, 0.068, WALL, '#6b4a2e', TILE, 0.045);
  for (const dx of [-0.16, -0.08, 0]) box(gp, '#4a3220', dx, y0, -0.048, 0.034, 0.046, 0.006);
  banner(gp, -0.24, y0, -0.04, 0.14, RED);
  banner(gp, 0.08, y0, -0.04, 0.14, RED);
  // Central Committee courtyard house & stone mill (碾盘)
  hall(gp, 0.2, y0, 0.04, 0.14, 0.11, 0.052, WALL, '#6b4a2e', TILE, 0.036);
  cyl(gp, '#9e9688', -0.04, y0, 0.16, 0.034, 0.014, 12);
  cyl(gp, '#7e786c', -0.04, y0 + 0.014, 0.16, 0.016, 0.018, 10);
  tree(gp, 0.24, y0, -0.2, 0.072, '#4a6c3e');
  tree(gp, -0.28, y0, 0.18, 0.068, '#4a6c3e');
};

/** 卢沟桥: Multi-arch white stone Marco Polo Bridge with carved stone-lion balusters,乾隆碑亭 & Wanping Fortress Gate. */
const pl_lugouqiao: Builder = root => {
  const [gp, y0] = site(root, '#3c6874', 0.88);
  const STONE = '#e0d8c8', BRICK = '#686c72', RED = '#982c22', TILE = '#484e54';
  // Multi-arch white stone Lugou Bridge (卢沟桥十一孔石拱桥与分水尖) spanning across the Yongding River
  box(gp, STONE, -0.06, y0 + 0.006, 0.04, 0.52, 0.032, 0.12);
  for (let i = -2; i <= 2; i++) {
    const ax = -0.06 + i * 0.095;
    cyl(grp(gp, ax, 0.04, 0, y0 + 0.006), '#244650', 0, 0, 0, 0.026, 0.125, 10).rotation.x = Math.PI / 2;
    prism(gp, [[ax - 0.048, -0.02], [ax - 0.036, 0.095], [ax - 0.06, 0.095]], y0, 0.028, shade(STONE, 0.9));
  }
  // Parapet railings topped with rows of carved stone lions (卢沟桥石狮望柱)
  for (const sz of [-0.052, 0.052]) {
    box(gp, STONE, -0.06, y0 + 0.038, 0.04 + sz, 0.52, 0.014, 0.008);
    for (let i = -4; i <= 4; i++) {
      const px = -0.06 + i * 0.055;
      box(gp, STONE, px, y0 + 0.038, 0.04 + sz, 0.01, 0.024, 0.01);
      ellip(gp, '#c8bfa8', px, y0 + 0.068, 0.04 + sz, 0.007, 0.009, 0.007);
    }
  }
  // Wanping Fortress Gate (宛平城威严城楼) on the east bank & "卢沟晓月" stele pavilion
  tbox(gp, 0.16, 0.28, 0.14, 0.25, 0.085, BRICK, 0.28, y0, 0.04);
  hall(gp, 0.28, y0 + 0.085, 0.04, 0.11, 0.16, 0.042, '#e4dcc8', RED, TILE, 0.036);
  hall(gp, -0.26, y0, -0.18, 0.085, 0.085, 0.045, STONE, RED, '#d49e32', 0.036);
};

/** 台儿庄: Grand Canal stone wharf, Ming-Qing stepped horse-head gables & battle-scarred brick wall with red banner. */
const pl_taierzhuang: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WATER = '#3a6a72', BRICK = '#686c72', WHITE = '#eae4d6', TILE = '#42464c';
  band(gp, 0.14, 0.32, y0, 0.006, WATER);
  // Canal stone bridge & wooden barge on the Beijing-Hangzhou Grand Canal
  box(gp, '#c4bca8', -0.12, y0 + 0.005, 0.23, 0.08, 0.026, 0.18);
  rbox(gp, '#5c3c22', 0.16, y0 + 0.008, 0.23, 0.15, 0.018, 0.044, 0.006);
  // Tai'erzhuang canal houses with stepped gables (鲁南水乡马头墙古民居) & bullet-scarred battle wall (大战弹孔墙)
  hall(gp, -0.16, y0, -0.06, 0.2, 0.13, 0.068, WHITE, '#4a3220', TILE, 0.045);
  for (const sx of [-0.26, -0.06]) box(gp, BRICK, sx, y0, -0.06, 0.014, 0.115, 0.136);
  // Battle-scarred brick station/fortress wall on the east
  box(gp, BRICK, 0.16, y0, -0.08, 0.22, 0.095, 0.12);
  for (const [dx, dy] of [[0.1, 0.05], [0.15, 0.07], [0.21, 0.04], [0.18, 0.065]] as [number, number][]) {
    cyl(gp, '#282624', dx, y0 + dy, -0.018, 0.008, 0.006, 6).rotation.x = Math.PI / 2;
  }
  banner(gp, 0.16, y0 + 0.095, -0.08, 0.12, '#b82820', '#f0c440');
};

/** 虎门: Weiyuan granite coastal battery (威远炮台), heavy Krupp/Qing iron cannon & Lin Zexu's twin opium-destruction pools. */
const pl_humen: Builder = root => {
  const [gp, y0] = site(root, '#b8ab92', 0.88);
  const STONE = '#8e887c', IRON = '#2c2e32', WATER = '#366872';
  band(gp, 0.18, 0.36, y0, 0.006, WATER);
  // Semicircular granite coastal casemates of Weiyuan Battery (虎门威远炮台花岗岩城垣)
  tbox(gp, 0.52, 0.14, 0.48, 0.12, 0.068, STONE, 0, y0, 0.08);
  for (const dx of [-0.14, 0, 0.14]) {
    box(gp, '#34322e', dx, y0 + 0.018, 0.14, 0.055, 0.038, 0.02);
    // Heavy iron coastal defense cannons (古铁炮)
    cyl(gp, IRON, dx, y0 + 0.074, 0.09, 0.012, 0.085, 8).rotation.x = Math.PI / 2 - 0.15;
    box(gp, '#523822', dx, y0 + 0.068, 0.07, 0.032, 0.016, 0.045);
  }
  // Lin Zexu's Twin Square Opium-Destruction Pools (虎门销烟池) in the north court
  for (const sx of [-0.13, 0.13]) {
    box(gp, STONE, sx, y0, -0.16, 0.18, 0.022, 0.15);
    box(gp, '#5c786e', sx, y0 + 0.006, -0.16, 0.14, 0.018, 0.11);
  }
};

/** 威海卫: Liugong Island Beiyang Fleet Headquarters (北洋水师提督署) & Ironclad Flagship Dingyuan (定远舰). */
const pl_weihai: Builder = root => {
  const [gp, y0] = site(root, '#2a5868', 0.88);
  const ISLAND = '#687a52', WALL = '#dfd8c8', TILE = '#484e54', RED = '#982c22', SHIP = '#282c32', OCHRE = '#c8963e';
  // Liugong Island (刘公岛) rising at the north with Beiyang Fleet Headquarters & signal tower
  prism(gp, [[-0.38, -0.36], [0.36, -0.36], [0.38, -0.04], [-0.36, -0.06]], y0, 0.045, ISLAND, 0.02);
  hall(gp, -0.08, y0 + 0.045, -0.2, 0.24, 0.12, 0.048, WALL, RED, TILE, 0.038);
  box(gp, '#b8b09e', 0.22, y0 + 0.03, -0.02, 0.08, 0.02, 0.14);
  // Iconic Beiyang Fleet Ironclad Flagship "Dingyuan" (定远号铁甲舰: 黑身黄烟囱双主炮台) anchored in the bay
  const sx = -0.04, sz = 0.16;
  rbox(gp, SHIP, sx, y0 + 0.008, sz, 0.36, 0.032, 0.082, 0.014);
  box(gp, '#e6ded0', sx, y0 + 0.04, sz, 0.2, 0.018, 0.056);
  for (const dx of [-0.035, 0.035]) {
    cyl(gp, OCHRE, sx + dx, y0 + 0.058, sz, 0.014, 0.065, 8);
    cyl(gp, SHIP, sx + dx * 0.9, y0 + 0.04, sz + (dx < 0 ? 0.022 : -0.022), 0.024, 0.018, 10);
  }
  for (const dx of [-0.11, 0.11]) cyl(gp, OCHRE, sx + dx, y0 + 0.04, sz, 0.004, 0.11, 6);
};

/** 小岗村: Thatched mud-wall "Da Baogan" farmhouse (大包干茅草农舍), golden grain stack & 18 Red-Handprint contract scroll. */
const pl_xiaogang: Builder = root => {
  const [gp, y0] = site(root, '#b89e6c', 0.88);
  const MUD = '#b49460', TH = '#846c42', PAPER = '#f2ead8', RED = '#c4261e';
  // Mud-wall thatched farmhouse where the 18 farmers signed the secret contract (大包干签字茅草屋)
  box(gp, MUD, -0.08, y0, -0.08, 0.28, 0.072, 0.16);
  gable(gp, 0.32, 0.062, 0.2, TH, -0.08, y0 + 0.072, -0.08);
  box(gp, '#523620', -0.08, y0, 0.002, 0.042, 0.052, 0.006);
  // Golden grain haystack (丰收麦垛) & courtyard mud wall
  cyl(gp, '#d4ac48', 0.2, y0, -0.1, 0.058, 0.055, 10);
  cone(gp, '#dcb64e', 0.2, y0 + 0.055, -0.1, 0.068, 0.055, 10);
  // Iconic 18 Red-Handprint Contract Scroll Monument (十八枚红手印生死契约卷轴) in the foreground
  box(gp, PAPER, 0, y0 + 0.012, 0.18, 0.22, 0.075, 0.016);
  for (const sx of [-0.115, 0.115]) cyl(gp, '#6e221a', sx, y0 + 0.006, 0.18, 0.012, 0.088, 8);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    cyl(gp, RED, -0.075 + c * 0.03, y0 + 0.026 + r * 0.02, 0.19, 0.006, 0.004, 6).rotation.x = Math.PI / 2;
  }
};

/** 丹东: Yalu River Broken Bridge (鸭绿江断桥钢铁桁架) ending abruptly at the bombed mid-river pier & parallel bridge. */
const pl_dandong: Builder = root => {
  const [gp, y0] = site(root, '#2f5e6e', 0.88);
  const STEEL = '#48525a', PIER = '#9e988a';
  // North bank Dandong riverfront promenade
  band(gp, -0.42, -0.24, y0, 0.024, PIER);
  // Yalu River Broken Bridge (鸭绿江断桥: 四孔钢桁架梁止于江心被炸桥墩)
  for (let i = 0; i < 4; i++) {
    const z = -0.24 + i * 0.11;
    box(gp, PIER, -0.1, y0, z, 0.075, 0.065, 0.026);
    if (i < 3) {
      const zm = z + 0.055;
      box(gp, STEEL, -0.1, y0 + 0.065, zm, 0.058, 0.01, 0.11);
      for (const sx of [-0.026, 0.026]) {
        box(gp, STEEL, -0.1 + sx, y0 + 0.11, zm, 0.006, 0.006, 0.095);
        for (const dz of [-0.04, 0, 0.04]) rod(gp, [-0.1 + sx, y0 + 0.068, zm + dz], [-0.1 + sx, y0 + 0.11, zm + dz * 0.7], 0.003, STEEL, 4);
      }
    }
  }
  // Parallel Sino-Korean Friendship Bridge spanning all the way across on the east
  box(gp, '#646c74', 0.14, y0 + 0.065, 0, 0.052, 0.014, 0.76);
  for (const z of [-0.24, -0.08, 0.08, 0.24]) box(gp, PIER, 0.14, y0, z, 0.068, 0.065, 0.024);
};

// ============================================================================
// 5. MOUNTAINS & MARITIME ISLANDS
// ============================================================================

/** 珠穆朗玛峰: Three-faceted Everest pyramid snow peak, Yellow Band rock stratum, Rongbuk glacier, stupa & prayer flags. */
const pl_everest: Builder = root => {
  const [gp, y0] = site(root, '#8494a4', 0.88);
  const SNOW = '#f2f5f8', ROCK = '#3d434c', YELLOW = '#b89a64', ICE = '#78b8c8';
  // Towering three-faceted pyramid summit of Qomolangma (珠峰金字塔峰体与北壁横带)
  cone(gp, ROCK, 0, y0, -0.06, 0.34, 0.36, 4, 0.4);
  cone(gp, YELLOW, 0, y0 + 0.18, -0.06, 0.17, 0.045, 4, 0.4);
  cone(gp, SNOW, 0, y0 + 0.21, -0.06, 0.15, 0.16, 4, 0.4);
  cone(gp, SNOW, -0.24, y0, -0.02, 0.16, 0.22, 4, 0.2);
  cone(gp, SNOW, 0.25, y0, -0.04, 0.15, 0.21, 4, -0.3);
  // East Rongbuk serac glacier (绒布冰川冰塔林) flowing down the foreground
  for (let i = -3; i <= 3; i++) cone(gp, ICE, i * 0.052, y0, 0.18 + (i % 2) * 0.04, 0.026, 0.068, 5);
  // White Rongbuk Tibetan Stupa & five-color prayer flags (五彩经幡) at base camp
  box(gp, SNOW, -0.18, y0, 0.26, 0.045, 0.024, 0.045);
  ellip(gp, SNOW, -0.18, y0 + 0.042, 0.26, 0.018, 0.022, 0.018);
  cone(gp, '#d8a838', -0.18, y0 + 0.06, 0.26, 0.008, 0.028, 6);
  for (const [k, c] of [[0, '#2b6cb0'], [1, '#f2f5f8'], [2, '#c53030'], [3, '#2f855a'], [4, '#d69e2e']] as [number, string][]) {
    box(gp, c, -0.1 + k * 0.045, y0 + 0.048, 0.26, 0.032, 0.022, 0.004);
  }
};

/** 钓鱼岛: Twin-peaked Diaoyu Island (高华峰与神农峰), white surf, coastal lighthouse & sovereignty tablet. */
const pl_diaoyu: Builder = root => {
  const [gp, y0] = site(root, '#1e5c78', 0.88);
  // Emerald coral reef shelf & white wave ring
  prism(gp, [[-0.32, -0.16], [0.32, -0.18], [0.36, 0.16], [-0.3, 0.2]], y0, 0.012, '#3498a2', 0.04);
  // Gaohua Peak (高华峰 362m) & Shennong Peak (神农峰)
  cone(gp, '#3e6e42', -0.08, y0 + 0.012, -0.02, 0.22, 0.2, 7);
  cone(gp, '#4a7a4c', 0.14, y0 + 0.012, 0.02, 0.17, 0.16, 7);
  // White cylindrical coastal lighthouse & sovereignty stone marker
  cyl(gp, '#f4f2ec', 0.15, y0 + 0.155, 0.02, 0.016, 0.075, 10);
  cyl(gp, '#c42820', 0.15, y0 + 0.23, 0.02, 0.019, 0.014, 10);
  box(gp, '#ebe4d4', -0.2, y0 + 0.012, 0.12, 0.052, 0.068, 0.018);
};

/** 南海诸岛: Turquoise ring atoll lagoon (南海碧玉环礁与七连屿), coral sandbars & navigation beacon. */
const pl_nanhai: Builder = root => {
  const [gp, y0] = site(root, '#1b5672', 0.88);
  // Glowing turquoise coral atoll ring & central deep lagoon
  cyl(gp, '#3ab0b8', 0, y0, 0, 0.34, 0.01, 28);
  cyl(gp, '#1d6c88', 0, y0 + 0.003, 0, 0.21, 0.01, 24);
  // White coral sand islets (环礁沙洲链) with palms & sovereignty beacon
  for (const [x, z, r] of [[-0.24, 0.08, 0.085], [0.02, -0.26, 0.095], [0.25, -0.04, 0.08], [0.16, 0.2, 0.075]] as [number, number, number][]) {
    cyl(gp, '#efe6ce', x, y0 + 0.01, z, r, 0.014, 12);
    tree(gp, x, y0 + 0.024, z, 0.058, '#3f7c44');
  }
  cyl(gp, '#f2eee6', -0.24, y0 + 0.024, 0.08, 0.018, 0.11, 8);
  cyl(gp, '#c42820', -0.24, y0 + 0.134, 0.08, 0.022, 0.018, 8);
};

/** 西沙群岛: Yongxing Island (永兴岛), lush coconut grove, ancient coral-stone fishermen's temple & sovereignty stele. */
const pl_xisha: Builder = root => {
  const [gp, y0] = site(root, '#246680', 0.88);
  // Flat oval coral limestone island (永兴岛珊瑚岛盘)
  prism(gp, [[-0.32, -0.2], [0.3, -0.22], [0.34, 0.18], [-0.28, 0.22]], y0, 0.024, '#ece2c8', 0.06);
  prism(gp, [[-0.26, -0.15], [0.24, -0.16], [0.28, 0.13], [-0.22, 0.16]], y0 + 0.024, 0.012, '#5a8a4c', 0.04);
  // Ancient coral-stone temple & white observation tower
  hall(gp, -0.08, y0 + 0.036, -0.02, 0.14, 0.1, 0.045, '#e8e0d0', '#982c22', '#d49a2e', 0.038);
  cyl(gp, '#f4f2ec', 0.16, y0 + 0.036, -0.06, 0.022, 0.13, 10);
  ellip(gp, '#f4f2ec', 0.16, y0 + 0.175, -0.06, 0.028, 0.024, 0.028);
  box(gp, '#e6ded0', 0.04, y0 + 0.036, 0.12, 0.048, 0.068, 0.016);
  for (const [x, z] of [[-0.2, 0.08], [-0.18, -0.1], [0.06, -0.12], [0.2, 0.08]] as [number, number][]) tree(gp, x, y0 + 0.036, z, 0.065, '#3c7a42');
};

/** 南沙群岛: Chigua Reef Tall Striped Lighthouse (南沙赤瓜礁灯塔), reef outpost & harbor pier. */
const pl_nansha: Builder = root => {
  const [gp, y0] = site(root, '#1c5a74', 0.88);
  // Turquoise reef flat & reclaimed square outpost island
  cyl(gp, '#36a8b2', 0, y0, 0, 0.34, 0.01, 24);
  box(gp, '#e6dec8', -0.04, y0 + 0.01, -0.02, 0.34, 0.022, 0.28);
  // Harbour causeway & white guard station building with radar dome
  box(gp, '#d2cab8', 0.18, y0 + 0.01, 0.16, 0.18, 0.018, 0.045);
  box(gp, '#f2eee6', -0.12, y0 + 0.032, -0.06, 0.15, 0.068, 0.11);
  ellip(gp, '#ffffff', -0.12, y0 + 0.118, -0.06, 0.032, 0.032, 0.032);
  // Tall octagonal red-and-white striped Nansha Lighthouse (南沙灯塔)
  for (let i = 0; i < 5; i++) {
    cyl(gp, i % 2 ? '#c42820' : '#f4f2ec', 0.08, y0 + 0.032 + i * 0.034, -0.02, 0.028 - i * 0.002, 0.034, 8);
  }
  cyl(gp, '#d8a838', 0.08, y0 + 0.202, -0.02, 0.024, 0.025, 8);
};

/** 陶寺: Taosi Neolithic Solar Observatory (陶寺古观象台十三根弧形夯土观测柱与彩绘蟠龙陶盘). */
const pl_taosi: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#ad8a58', DARK = '#745632', RED = '#a83224', CLAY = '#383430';
  // Semi-circular stepped rammed-earth observatory terrace (陶寺观象台半圆形夯土基座)
  cyl(gp, EARTH, 0, y0, 0.04, 0.28, 0.032, 18);
  // 13 curved rammed-earth observation pillars forming 12 solar-term viewing slits (十三根夯土观测柱与十二道观日缝)
  for (let i = -6; i <= 6; i++) {
    const a = -Math.PI * 0.5 + i * 0.16, r = 0.22;
    const x = Math.cos(a) * r, z = 0.06 + Math.sin(a) * r;
    const b = box(gp, i % 2 ? EARTH : shade(EARTH, 0.92), x, y0 + 0.032, z, 0.026, 0.14 + Math.abs(6 - Math.abs(i)) * 0.006, 0.034);
    b.rotation.y = -a + Math.PI / 2;
  }
  // Central observation point stone disc (观测圆心太极石) & Taosi Painted Coiled-Dragon Dish (彩绘龙盘)
  cyl(gp, DARK, 0, y0 + 0.032, 0.08, 0.042, 0.008, 16);
  cyl(gp, CLAY, 0.18, y0, 0.2, 0.075, 0.02, 18);
  cyl(gp, RED, 0.18, y0 + 0.015, 0.2, 0.052, 0.008, 16);
};

/** 石峁: Shimao Prehistoric Stepped Stone Pyramid Huangchengtai (石峁遗址皇城台十一级石砌护坡阶梯金字塔与东门瓮城). */
const pl_shimao: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const STONE = '#988c76', DARK = '#6c6252', JADE = '#468c6e';
  // Monumental Stepped Stone-Faced Pyramid of Huangchengtai (石峁皇城台层阶式护坡石墙)
  for (let i = 0; i < 6; i++) {
    const w = 0.52 - i * 0.055, d = 0.42 - i * 0.045, y = y0 + i * 0.028;
    tbox(gp, w, d, w - 0.025, d - 0.025, 0.028, i % 2 ? STONE : shade(STONE, 0.92), -0.02, y, -0.04);
  }
  // East Gate Outer Barbican Bastion (外城东门马面与内凹瓮城) & Carved Stone Relief Blocks (石雕神面)
  box(gp, DARK, -0.1, y0, 0.18, 0.085, 0.085, 0.085);
  box(gp, DARK, 0.06, y0, 0.18, 0.085, 0.085, 0.085);
  // Jade Zhang / Dao blade embedded in the stone wall (石墙藏玉牙璋)
  box(gp, JADE, 0.2, y0 + 0.015, 0.16, 0.024, 0.085, 0.008).rotation.z = -0.2;
};

/** 安阳: Houmuwu / Simuwu Rectangular Bronze Ding (安阳殷墟后母戊大方鼎) & Oracle Bone Inscription Forest (甲骨碑林). */
const pl_anyang: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const BRZ = '#3e745c', BONE = '#e2d6b8', EARTH = '#a68858', RED = '#982c22';
  // Stepped ritual altar holding the Colossal Rectangular Houmuwu Bronze Cauldron (后母戊大方鼎: 四柱足长方腹立耳)
  tbox(gp, 0.28, 0.22, 0.24, 0.18, 0.032, '#cfc6b4', -0.08, y0, -0.02);
  for (const sx of [-0.075, 0.075]) for (const sz of [-0.05, 0.05]) {
    cyl(gp, BRZ, -0.08 + sx, y0 + 0.032, -0.02 + sz, 0.016, 0.065, 8);
  }
  box(gp, BRZ, -0.08, y0 + 0.092, -0.02, 0.19, 0.095, 0.135);
  box(gp, shade(BRZ, 1.15), -0.08, y0 + 0.182, -0.02, 0.21, 0.014, 0.155);
  for (const sx of [-0.078, 0.078]) box(gp, BRZ, -0.08 + sx, y0 + 0.196, -0.02, 0.014, 0.038, 0.048);
  // Giant Carved Oracle Bone Tortoise Plastron Monument (殷墟甲骨文龟甲碑) on the east
  box(gp, EARTH, 0.2, y0, 0.04, 0.11, 0.022, 0.08);
  ellip(gp, BONE, 0.2, y0 + 0.105, 0.04, 0.068, 0.092, 0.022);
  for (const dy of [0.07, 0.105, 0.14]) box(gp, RED, 0.2, y0 + dy, 0.062, 0.065, 0.006, 0.004);
};

/** 云冈石窟: Cave 20 Colossal Open-Air Seated Buddha of Tanyao (云冈石窟第20窟昙曜五窟露天大佛与北魏木构窟檐). */
const pl_yungang: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const SAND = '#c8a26e', DARK = '#5c4228', STATUE = '#dfc08e', RED = '#982c22', TILE = '#464c52';
  // Wuzhou Mountain Sandstone Cliff Face (武州山砂岩崖壁与大佛背光龛) at z = -0.26..-0.02
  tbox(gp, 0.72, 0.24, 0.68, 0.2, 0.23, SAND, 0, y0, -0.14);
  box(gp, DARK, -0.09, y0 + 0.015, -0.025, 0.26, 0.195, 0.03);
  // Iconic Cave 20 Colossal Seated Shakyamuni Buddha with broad shoulders & ushnisha (云冈第20窟露天大佛坐像) in front of the niche
  const bx = -0.09, bz = 0.025;
  ellip(gp, STATUE, bx, y0 + 0.038, bz + 0.015, 0.11, 0.032, 0.065);
  tbox(gp, 0.18, 0.085, 0.15, 0.075, 0.09, STATUE, bx, y0 + 0.05, bz);
  ellip(gp, STATUE, bx, y0 + 0.172, bz, 0.044, 0.052, 0.042);
  cyl(gp, DARK, bx, y0 + 0.218, bz, 0.022, 0.018, 10);
  // Adjoining Cave 5/6 Multi-Storey Timber Cliff Pavilion (云冈五六窟四层木构窟檐楼阁) on the east
  for (let i = 0; i < 3; i++) {
    hall(gp, 0.21, y0 + i * 0.055, 0.02, 0.17 - i * 0.015, 0.085, 0.042, '#e4dcc8', RED, TILE, 0.03);
  }
};

/** 嘉兴: South Lake Red Boat (嘉兴南湖中共一大红船) & Misty Rain Tower on Lake-Heart Island (湖心岛烟雨楼). */
const pl_jiaxing: Builder = root => {
  const [gp, y0] = site(root, '#2c6872', 0.88);
  const WD = '#7e3c22', ROOF = '#542616', STONE = '#cfc6b4', RED = '#982c22', TILE = '#42484e';
  // Lake-Heart Island (南湖湖心岛与烟雨楼重檐歇山楼阁) at north-west
  prism(gp, [[-0.38, -0.32], [0.06, -0.34], [0.08, -0.06], [-0.36, -0.04]], y0, 0.022, STONE, 0.03);
  const h1 = hall(gp, -0.15, y0 + 0.022, -0.18, 0.22, 0.13, 0.045, '#f0ece2', RED, TILE, 0.035);
  hall(gp, -0.15, h1 - 0.008, -0.18, 0.16, 0.095, 0.034, '#f0ece2', RED, TILE, 0.032);
  tree(gp, 0.0, y0 + 0.022, -0.14, 0.065, '#487442');
  // Iconic Nanhu Red Boat (南湖红船: 单夹弄丝网船、画舫轩窗与前舱平顶) moored in the foreground water
  const bx = 0.08, bz = 0.14;
  rbox(gp, WD, bx, y0 + 0.006, bz, 0.34, 0.028, 0.088, 0.014);
  box(gp, '#944828', bx - 0.02, y0 + 0.034, bz, 0.22, 0.038, 0.072);
  for (let i = -2; i <= 2; i++) box(gp, '#e8c878', bx - 0.02 + i * 0.04, y0 + 0.042, bz + 0.037, 0.024, 0.02, 0.004);
  box(gp, ROOF, bx - 0.02, y0 + 0.072, bz, 0.24, 0.01, 0.082);
};

/** 泸定桥: Luding Thirteen-Chain Iron Suspension Bridge over the Dadu River Gorge (飞夺泸定桥十三根铁索与东西桥亭). */
const pl_luding: Builder = root => {
  const [gp, y0] = site(root, '#2a6270', 0.88);
  const CLIFF = '#6c665c', IRON = '#282c32', WD = '#8c6238', RED = '#982c22', TILE = '#464c52';
  // Steep east & west granite gorge banks of the Dadu River (大渡河两岸绝壁与桥台)
  box(gp, CLIFF, -0.32, y0, 0, 0.16, 0.1, 0.44);
  box(gp, CLIFF, 0.32, y0, 0, 0.16, 0.1, 0.44);
  // East & West Bridgehead Pavilions (泸定桥东西桥头堡皇木亭)
  for (const sx of [-0.3, 0.3]) hall(gp, sx, y0 + 0.1, 0, 0.13, 0.16, 0.052, '#e4dcc8', RED, TILE, 0.044);
  // 9 Bottom Iron Chains with Half-Planked Deck & 4 Side Handrail Chains (十三根碗口粗铁索与半铺木板)
  for (const dz of [-0.045, -0.022, 0, 0.022, 0.045]) rod(gp, [-0.24, y0 + 0.105, dz], [0.24, y0 + 0.105, dz], 0.004, IRON, 6);
  for (const dz of [-0.052, 0.052]) {
    rod(gp, [-0.24, y0 + 0.135, dz], [0.24, y0 + 0.135, dz], 0.004, IRON, 6);
    rod(gp, [-0.24, y0 + 0.12, dz], [0.24, y0 + 0.12, dz], 0.0035, IRON, 6);
  }
  for (let i = -5; i <= 1; i++) box(gp, WD, i * 0.036, y0 + 0.108, 0, 0.024, 0.006, 0.095);
};

/** 酒泉卫星发射中心: Dongfeng Space City Blue Launch Umbilical Tower & Long March-2F Shenzhou Crewed Rocket. */
const pl_jiuquan_lc: Builder = root => {
  const [gp, y0] = site(root, '#c8a66c', 0.88);
  const BLUE = '#2868a8', WHITE = '#f4f6f8', RED = '#c82820', CONCRETE = '#b8b2a6';
  // Concrete flame-trench launch pad & assembly rail track (载人航天发射坪与垂直转运轨道)
  box(gp, CONCRETE, 0, y0, 0, 0.44, 0.028, 0.34);
  box(gp, '#383c42', 0.04, y0 + 0.005, 0, 0.12, 0.026, 0.24);
  // Iconic Blue Steel Umbilical Launch Tower with Swing Arms (酒泉蓝色回转发射塔架)
  for (const sx of [-0.11, -0.03]) for (const sz of [-0.05, 0.05]) cyl(gp, BLUE, sx, y0 + 0.028, sz, 0.007, 0.28, 6);
  for (let i = 0; i < 6; i++) box(gp, BLUE, -0.07, y0 + 0.06 + i * 0.044, 0, 0.095, 0.01, 0.11);
  box(gp, BLUE, -0.03, y0 + 0.18, 0, 0.085, 0.014, 0.065);
  // Long March-2F Rocket with 4 Strap-On Boosters & Escape Tower (长征二号F运载火箭与逃逸塔)
  const rx = 0.04;
  cyl(gp, WHITE, rx, y0 + 0.028, 0, 0.024, 0.22, 12);
  for (const [dx, dz] of [[-0.028, 0], [0.028, 0], [0, -0.028], [0, 0.028]] as [number, number][]) {
    cyl(gp, WHITE, rx + dx, y0 + 0.028, dz, 0.011, 0.095, 8);
    cone(gp, WHITE, rx + dx, y0 + 0.123, dz, 0.011, 0.024, 8);
  }
  cyl(gp, RED, rx, y0 + 0.18, 0, 0.025, 0.014, 12);
  cone(gp, WHITE, rx, y0 + 0.248, 0, 0.026, 0.045, 12);
  cyl(gp, WHITE, rx, y0 + 0.293, 0, 0.005, 0.038, 6);
};

/** 文昌发射场: Coastal Wenchang Spacecraft Launch Site, Long March-5 Heavy Rocket, Lightning Masts & Coconut Grove. */
const pl_wenchang: Builder = root => {
  const [gp, y0] = site(root, '#567e48', 0.88);
  const SEA = '#1e627c', TOWER = '#86929e', WHITE = '#f4f6f8', RED = '#c82820';
  band(gp, 0.18, 0.36, y0, 0.006, SEA);
  // Coastal launch pad, Tall Vehicle Assembly Building (垂直总装测试厂房) & 4 Lightning Protection Towers (避雷塔)
  box(gp, '#c4beb2', 0.04, y0, -0.04, 0.36, 0.024, 0.26);
  box(gp, '#dce2e8', -0.22, y0, -0.12, 0.14, 0.22, 0.14);
  box(gp, '#2b6cb0', -0.22, y0 + 0.18, -0.048, 0.11, 0.024, 0.006);
  // Thick Long March-5 "Pang Wu" Cryogenic Rocket with 4 Large Boosters (长征五号“胖五”大火箭)
  const rx = 0.08, rz = -0.04;
  cyl(gp, WHITE, rx, y0 + 0.024, rz, 0.032, 0.21, 14);
  for (const [dx, dz] of [[-0.04, 0], [0.04, 0], [0, -0.04], [0, 0.04]] as [number, number][]) {
    cyl(gp, WHITE, rx + dx, y0 + 0.024, rz + dz, 0.016, 0.12, 10);
    cone(gp, WHITE, rx + dx, y0 + 0.144, rz + dz, 0.016, 0.028, 10);
  }
  cyl(gp, RED, rx, y0 + 0.18, rz, 0.033, 0.016, 14);
  cone(gp, WHITE, rx, y0 + 0.234, rz, 0.034, 0.058, 14);
  for (const [tx, tz] of [[-0.04, -0.14], [0.2, -0.14], [-0.04, 0.06], [0.2, 0.06]] as [number, number][]) {
    cyl(gp, TOWER, tx, y0 + 0.024, tz, 0.005, 0.26, 6);
  }
  tree(gp, -0.18, y0, 0.14, 0.065, '#3b7a42');
};

/** 雄安新区: Dewdrop-Shaped Xiong'an High-Speed Railway Station Solar Dome (雄安站水滴形光伏穹顶) & Baiyangdian Lotus Lake. */
const pl_xiongan: Builder = root => {
  const [gp, y0] = site(root, '#367882', 0.88);
  const ROOF = '#cfd8e2', SOLAR = '#284c78', GLASS = '#7ab8d4', LOTUS = '#48884e', PINK = '#e46c88';
  // Ecological green plaza & high-speed rail viaduct spanning north-south
  prism(gp, [[-0.4, -0.34], [0.4, -0.34], [0.38, 0.08], [-0.38, 0.08]], y0, 0.018, '#688e58', 0.04);
  box(gp, '#d8d2c4', 0, y0 + 0.018, -0.12, 0.14, 0.022, 0.56);
  // Iconic Oval Dewdrop-Shaped Xiong'an Station Roof with Central Light Canyon (雄安站椭球水滴屋盖与光谷)
  ellip(gp, GLASS, 0, y0 + 0.048, -0.12, 0.24, 0.038, 0.17);
  for (const sx of [-0.11, 0.11]) {
    ellip(gp, ROOF, sx, y0 + 0.072, -0.12, 0.135, 0.032, 0.18);
    ellip(gp, SOLAR, sx, y0 + 0.082, -0.12, 0.11, 0.026, 0.15);
  }
  // Baiyangdian Lotus & Reed Ecological Wetland (白洋淀荷花苇海) in the foreground
  for (const [lx, lz] of [[-0.22, 0.2], [-0.08, 0.24], [0.12, 0.22], [0.24, 0.18]] as [number, number][]) {
    cyl(gp, LOTUS, lx, y0 + 0.006, lz, 0.042, 0.005, 12);
    cone(gp, PINK, lx, y0 + 0.011, lz, 0.016, 0.024, 7);
  }
};

// ============================================================================
// 6. DEDICATED SITE, PASS & MOUNTAIN LANDMARKS (15 SITES)
// ============================================================================

/** 二里头: Erlitou Grid-Road Excavation Trenches, Rammed-Earth Foundation No. 1 & Turquoise Dragon-Shaped Scepter Altar (二里头绿松石龙形器与铜爵探方). */
const pl_erlitou: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a88856', TURQ = '#1ea89a', BRZ = '#487a62';
  // Criss-crossing Wheel-Rut Grid Roads & Excavation Trenches of Erlitou (二里头井字形大道车辙与考古探方)
  for (const dz of [-0.14, 0.14]) box(gp, '#8a6c42', 0, y0, dz, 0.62, 0.012, 0.055);
  for (const dx of [-0.16, 0.16]) box(gp, '#8a6c42', dx, y0, 0, 0.055, 0.012, 0.56);
  // Central Rammed-Earth Altar Displaying the IconicErlitou Turquoise Dragon & Bronze Jue Tripod (绿松石龙形器与网格纹铜鼎铜爵)
  tbox(gp, 0.28, 0.22, 0.24, 0.19, 0.048, EARTH, 0, y0, 0);
  for (let i = -3; i <= 3; i++) {
    ellip(gp, TURQ, -0.05 + i * 0.022, y0 + 0.058, Math.sin(i * 0.9) * 0.032, 0.018, 0.012, 0.018);
  }
  box(gp, TURQ, -0.13, y0 + 0.056, 0, 0.038, 0.024, 0.032);
  cyl(gp, BRZ, 0.08, y0 + 0.048, 0, 0.028, 0.058, 8);
  rod(gp, [0.05, y0 + 0.106, 0], [0.12, y0 + 0.122, 0], 0.008, BRZ, 5);
};

/** 辽上京: Liao Supreme Capital Linhuangfu Rammed-Earth Imperial Gate & Octagonal South Pagoda (辽上京临潢府乾德门遗址与南塔). */
const pl_shangjing: Builder = root => {
  const [gp, y0] = site(root, '#788852', 0.88);
  const EARTH = '#a88e60', BRICK = '#b89c72', GOLD = '#dca428', WHITE = '#f2eee4';
  // Rammed-Earth Semicircular Barbican of Liao Shangjing Qiande Gate (辽上京皇城乾德门瓮城夯土遗址)
  tbox(gp, 0.44, 0.14, 0.38, 0.11, 0.068, EARTH, 0.06, y0, -0.1);
  box(gp, '#5c6c3e', 0.06, y0, -0.1, 0.065, 0.068, 0.15);
  for (const sx of [-0.08, 0.2]) tbox(gp, 0.09, 0.14, 0.075, 0.12, 0.058, EARTH, sx, y0, 0.02);
  // Liao Dynasty Octagonal Dense-Eave South Pagoda (巴林左旗辽上京南塔八角密檐砖塔) on the West
  box(gp, '#cfc6b4', -0.2, y0, 0.04, 0.14, 0.024, 0.14);
  cyl(gp, BRICK, -0.2, y0 + 0.024, 0.04, 0.052, 0.065, 8);
  for (let i = 0; i < 7; i++) {
    const r = 0.056 * (1 - i * 0.07);
    cone(gp, '#58524a', -0.2, y0 + 0.089 + i * 0.018, 0.04, r * 1.15, 0.012, 8);
  }
  cone(gp, GOLD, -0.2, y0 + 0.215, 0.04, 0.018, 0.036, 8);
  // Khitan Stone Ancestor Statue (辽上京石人像) in Foreground
  cyl(gp, WHITE, 0.18, y0, 0.18, 0.022, 0.075, 8);
};

/** 金上京: Jin Supreme Capital Huiningfu Imperial Mound & Bronze Seated Dragon Pavilion (金上京会宁府遗址与铜坐龙碑亭). */
const pl_huining: Builder = root => {
  const [gp, y0] = site(root, '#627c4a', 0.88);
  const EARTH = '#9c8256', BRZ = '#3c785e', GOLD = '#dca228', RED = '#982a20';
  // Stepped Rammed-Earth Palace Mound of Jin Huiningfu Five-Phoenix Tower (金上京皇城午门五凤楼高大夯土台基与敌台)
  tbox(gp, 0.48, 0.2, 0.42, 0.16, 0.068, EARTH, 0, y0, -0.14);
  for (const sx of [-0.18, 0, 0.18]) tbox(gp, 0.11, 0.12, 0.09, 0.1, 0.036, shade(EARTH, 1.08), sx, y0 + 0.068, -0.14);
  // Iconic Jin Dynasty Bronze Seated Dragon Sculpture on Stone Pedestal (哈尔滨阿城金上京出土国宝铜坐龙) & Jurchen Stele Pavilion
  cyl(gp, '#cfc6b4', -0.12, y0, 0.12, 0.078, 0.026, 12);
  cyl(gp, BRZ, -0.12, y0 + 0.026, 0.12, 0.038, 0.072, 10);
  ellip(gp, BRZ, -0.12, y0 + 0.112, 0.135, 0.028, 0.032, 0.036);
  rod(gp, [-0.12, y0 + 0.125, 0.12], [-0.12, y0 + 0.165, 0.08], 0.008, GOLD, 6);
  hall(gp, 0.16, y0, 0.12, 0.13, 0.13, 0.048, '#e6dec8', RED, '#3c6e54', 0.042);
};

/** 周口店: Dragon Bone Hill Locality 1 Ape-Man Fissure Cliff, Stratigraphic Grid & Ash Layer Pit (周口店龙骨山第1地点猿人洞高崖与探方). */
const pl_zhoukoudian: Builder = root => {
  const [gp, y0] = site(root, '#8e7c60', 0.88);
  const ROCK = '#787268', ASH = '#3c322c', BONE = '#e8dfc8', RED = '#c84220';
  // Towering Limestone Fissure Cliff of Dragon Bone Hill Locality 1 (龙骨山石灰岩陡壁与猿人洞裂隙)
  tbox(gp, 0.52, 0.26, 0.44, 0.2, 0.16, ROCK, 0, y0, -0.12);
  box(gp, '#221c18', 0, y0, -0.02, 0.16, 0.12, 0.12);
  for (const [sx, h] of [[-0.2, 0.19], [0.2, 0.18]] as [number, number][]) cone(gp, shade(ROCK, 0.92), sx, y0, -0.1, 0.14, h, 6);
  // Stratified Archaeological Pit with 6m-Thick Fire Ash Layers, Quartz Flakes & Peking Man Skull Fossil Monument (用火灰烬层与头盖骨纪念石)
  box(gp, ASH, 0, y0 + 0.004, 0.12, 0.24, 0.018, 0.16);
  ellip(gp, RED, 0, y0 + 0.028, 0.12, 0.032, 0.022, 0.032);
  ellip(gp, BONE, -0.18, y0 + 0.048, 0.16, 0.042, 0.038, 0.048);
  tree(gp, 0.24, y0, 0.14, 0.068, '#4e7242');
};

/** 半坡: Banpo Moated Neolithic Village, Square Great House F1 & Human-Face Fish-Motif Painted Basin (半坡遗址环壕大房子与人面鱼纹彩陶盆). */
const pl_banpo: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const THATCH = '#b89458', CLAY = '#c45838', DARK = '#241c18', EARTH = '#987a4e';
  // Protective Circular Moat Trench & Large Pyramidal-Roof Communal House F1 (半坡环壕与F1方形大房子复原)
  tbox(gp, 0.34, 0.28, 0.3, 0.24, 0.032, EARTH, -0.1, y0, -0.08);
  cone(gp, THATCH, -0.1, y0 + 0.032, -0.08, 0.18, 0.125, 4, Math.PI / 4);
  box(gp, THATCH, -0.1, y0 + 0.02, 0.06, 0.068, 0.048, 0.065);
  // Iconic Yangshao Painted Pottery Basin with Human-Face & Twin-Fish Motif on Pedestal (半坡人面鱼纹彩陶盆与尖底瓶)
  cyl(gp, '#cfc6b4', 0.18, y0, 0.06, 0.1, 0.024, 14);
  tbox(gp, 0.11, 0.11, 0.16, 0.16, 0.062, CLAY, 0.18, y0 + 0.024, 0.06);
  cyl(gp, DARK, 0.18, y0 + 0.082, 0.06, 0.082, 0.008, 14);
  cone(gp, CLAY, -0.22, y0, 0.18, 0.028, 0.068, 10);
};

/** 三星堆: Sanxingdui Moon Bay Rammed-Earth City Wall, Towering Bronze Sacred Tree & Gold Mask Altar (三星堆青铜神树与金面具祭坛). */
const pl_sanxingdui: Builder = root => {
  const [gp, y0] = site(root, '#5c784c', 0.88);
  const BRZ = '#2e7e68', GOLD = '#f0ba28', EARTH = '#9c8256';
  // Ancient Shu Moon Bay Rammed-Earth Rampart & Sacrificial Pits (三星堆月亮湾城墙与祭祀坑)
  tbox(gp, 0.52, 0.14, 0.46, 0.11, 0.055, EARTH, 0, y0, -0.18);
  // Towering No. 1 Bronze Sacred Tree with Nine Sun-Birds on Three Tiered Branches (一号青铜神树九鸟扶桑) at Center-West
  cyl(gp, '#cfc6b4', -0.1, y0, 0.04, 0.075, 0.024, 12);
  cyl(gp, BRZ, -0.1, y0 + 0.024, 0.04, 0.014, 0.22, 8);
  for (let i = 0; i < 3; i++) {
    const y = y0 + 0.075 + i * 0.055;
    for (const a of [0, 2.1, 4.2]) {
      const bx = -0.1 + Math.cos(a + i) * 0.058, bz = 0.04 + Math.sin(a + i) * 0.058;
      rod(gp, [-0.1, y, 0.04], [bx, y + 0.018, bz], 0.005, BRZ, 5);
      ellip(gp, GOLD, bx, y + 0.026, bz, 0.012, 0.01, 0.012);
    }
  }
  // Gold Mask & Protruding-Eye Bronze Mask on East Altar (黄金面具与纵目面具)
  box(gp, EARTH, 0.16, y0, 0.06, 0.14, 0.036, 0.12);
  box(gp, GOLD, 0.16, y0 + 0.036, 0.06, 0.088, 0.078, 0.036);
  for (const sx of [-0.024, 0.024]) cyl(grp(gp, 0.16 + sx, 0.08, 0, y0 + 0.078), BRZ, 0, 0, 0, 0.009, 0.036, 8).rotation.x = Math.PI / 2;
};

/** 灵渠: Lingqu Ancient Flash-Lock Gates ("Doumen" 灵渠天下第一陡门船闸), Qin Stone Levee & Four Sages Shrine (四贤祠). */
const pl_lingqu: Builder = root => {
  const [gp, y0] = site(root, '#32707a', 0.88);
  const STONE = '#9e988a', WD = '#6b4424', RED = '#982c22', TILE = '#3d4248';
  // Curved Stone Canal Channel & Ancient Flash-Lock ("Doumen" 半圆石砌陡门与塞木船闸 — 世界船闸之父)
  for (const sx of [-0.12, 0.12]) {
    box(gp, STONE, sx, y0, 0.02, 0.068, 0.052, 0.52);
    cyl(gp, STONE, sx * 0.85, y0, 0.04, 0.048, 0.062, 10);
  }
  box(gp, WD, 0, y0 + 0.01, 0.04, 0.11, 0.042, 0.014);
  // Qin Grain Transport Boat passing through the Lock & Four Sages Temple (四贤祠与飞来石) on the West Bank
  rbox(gp, '#54361e', 0, y0 + 0.012, -0.14, 0.065, 0.022, 0.15, 0.006);
  prism(gp, [[-0.4, -0.34], [-0.15, -0.34], [-0.15, 0.28], [-0.4, 0.28]], y0, 0.028, '#58784a');
  hall(gp, -0.27, y0 + 0.028, -0.06, 0.16, 0.12, 0.044, '#f0ece2', RED, TILE, 0.038);
};

/** 赵州桥: Anji Bridge Open-Spandrel Arch, Carved Dragon Balustrades & Imperial Stele Pavilion (赵县安济桥双龙戏珠栏板与桥头碑亭). */
const pl_zhaozhou: Builder = root => {
  const [gp, y0] = site(root, '#36707a', 0.88);
  const STONE = '#d8d0c0', RED = '#9c2a20', GOLD = '#dca228', BANK = '#627c4e';
  for (const sx of [-0.32, 0.32]) box(gp, BANK, sx, y0, 0, 0.18, 0.036, 0.52);
  // Li Chun's Single-Span Open-Spandrel Stone Arch with 4 Small Shoulder Arches & Carved Balustrade Posts (安济桥敞肩四小拱与望柱)
  for (let i = -4; i <= 4; i++) {
    const t = i / 4, y = y0 + 0.028 + (1 - t * t) * 0.068;
    box(gp, STONE, t * 0.24, y, 0.04, 0.068, 0.022, 0.15);
    for (const sz of [-0.068, 0.068]) box(gp, '#eae4d6', t * 0.24, y + 0.022, 0.04 + sz, 0.014, 0.024, 0.014);
  }
  for (const sx of [-0.16, 0.16]) cyl(grp(gp, sx, 0.04, 0, y0 + 0.052), '#264c54', 0, 0, 0, 0.022, 0.16, 10).rotation.x = Math.PI / 2;
  // Bridgehead Imperial Stele Pavilion (赵州桥桥头御碑亭) on the Northwest Bank
  hall(gp, -0.28, y0 + 0.036, -0.14, 0.12, 0.12, 0.046, '#e6dec8', RED, GOLD, 0.04);
};

/** 龙门石窟: Longmen Grottoes Yi River Canyon, Three-Arch Bridge, Honeycomb Cliff Niches & Xiangshan Temple (龙门伊水两岸石窟与漫水桥). */
const pl_longmen: Builder = root => {
  const [gp, y0] = site(root, '#346e78', 0.88);
  const CLIFF = '#b49e7c', STATUE = '#d4c4a4', BRIDGE = '#cfc6b4', RED = '#982c22';
  // West Hill Honeycomb Grotto Cliff with Vairocana Niche & East Hill Xiangshan Temple across the Yi River (西山奉先寺万佛龛与东山香山寺)
  tbox(gp, 0.24, 0.52, 0.18, 0.48, 0.165, CLIFF, -0.24, y0, 0);
  box(gp, '#322820', -0.15, y0 + 0.02, -0.04, 0.055, 0.12, 0.13);
  cyl(gp, STATUE, -0.16, y0 + 0.02, -0.04, 0.028, 0.072, 10);
  ellip(gp, STATUE, -0.16, y0 + 0.105, -0.04, 0.022, 0.026, 0.022);
  for (const dz of [-0.16, 0.1, 0.18]) box(gp, '#322820', -0.15, y0 + 0.045, dz, 0.035, 0.048, 0.038);
  // Longmen Three-Arch Stone Bridge spanning the Yi River to East Hill Xiangshan Villa
  box(gp, BRIDGE, 0, y0 + 0.012, 0.16, 0.34, 0.024, 0.068);
  tbox(gp, 0.22, 0.44, 0.18, 0.4, 0.075, '#5c784a', 0.25, y0, -0.04);
  hall(gp, 0.24, y0 + 0.075, -0.08, 0.15, 0.18, 0.044, '#e6dec8', RED, '#42484e', 0.038);
};

/** 莫高窟: Mogao Caves Sanwei Archway, Dangquan River Bridge & Abbot Wang's Library Cave White Stupa (莫高窟牌坊、宕泉桥与道士塔). */
const pl_mogao: Builder = root => {
  const [gp, y0] = site(root, '#d8b882', 0.88);
  const CLIFF = '#c29a62', RED = '#9e2820', TILE = '#366852', WHITE = '#f4f0e6';
  // Mingsha Sandstone Cliff with Multi-Tiered Timber Cave Eaves & "Shishi Baoshan" Archway (鸣沙山崖壁飞檐木构窟檐与石室宝山牌坊)
  tbox(gp, 0.48, 0.18, 0.42, 0.14, 0.15, CLIFF, 0, y0, -0.16);
  for (let i = 0; i < 3; i++) {
    const w = 0.2 - i * 0.035, y = y0 + i * 0.044;
    box(gp, RED, -0.06, y, -0.07, w, 0.034, 0.055);
    gable(gp, w + 0.03, 0.02, 0.075, TILE, -0.06, y + 0.032, -0.065);
  }
  for (const sx of [-0.065, 0.065]) cyl(gp, RED, -0.06 + sx, y0, 0.12, 0.006, 0.078, 6);
  gable(gp, 0.17, 0.026, 0.04, TILE, -0.06, y0 + 0.072, 0.12);
  // Iconic White Tibetan-Style Stupa in Front of the Library Cave (藏经洞前王圆箓道士白塔) & Desert Poplars
  cyl(gp, WHITE, 0.18, y0, 0.1, 0.038, 0.032, 10);
  ellip(gp, WHITE, 0.18, y0 + 0.058, 0.1, 0.036, 0.038, 0.036);
  cone(gp, '#dca428', 0.18, y0 + 0.095, 0.1, 0.015, 0.042, 8);
  tree(gp, 0.24, y0, -0.02, 0.068, '#d89c28');
};

/** 罗布泊: Lop Nur "Dragon City" Yardang Wind-Carved Ridges & Xiaohe Sun-Grave Concentric Wood Posts (罗布泊雅丹龙城与小河太阳墓). */
const pl_lop_nur: Builder = root => {
  const [gp, y0] = site(root, '#d6b67c', 0.88);
  const YARDANG = '#b88e52', SALT = '#dcd4be', WOOD = '#6e4a28';
  // Wind-Carved Parallel Yardang Ridge Formations ("白龙堆"雅丹风蚀垄槽与盐壳湖床)
  band(gp, 0.12, 0.3, y0, 0.005, SALT);
  for (const [x, z, w, h, d] of [[-0.18, -0.14, 0.12, 0.13, 0.24], [0.02, -0.16, 0.1, 0.15, 0.22], [0.2, -0.1, 0.11, 0.11, 0.2]] as [number, number, number, number, number][]) {
    tbox(gp, w, d, w * 0.65, d * 0.82, h, YARDANG, x, y0, z);
    box(gp, SALT, x, y0 + h * 0.45, z, w * 0.88, 0.014, d * 0.92);
  }
  // Iconic Xiaohe / Gumugou "Sun Grave" with 7 Concentric Rings of Populus Euphratica Posts (罗布泊太阳墓胡杨木桩圈)
  for (const r of [0.045, 0.085]) {
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      cyl(gp, WOOD, -0.06 + Math.cos(a) * r, y0, 0.16 + Math.sin(a) * r, 0.005, 0.042, 5);
    }
  }
};

/** 嘉峪关: First Pier of the Ming Great Wall on the Taolai River Gorge Cliff (讨赖河悬崖“万里长城第一墩”烽燧与关城). */
const pl_jiayuguan: Builder = root => {
  const [gp, y0] = site(root, '#cba86e', 0.88);
  const CLIFF = '#8c7250', EARTH = '#b89258', RIVER = '#2e6e78', RED = '#9c2a20';
  // 56-Meter Vertical Loess Conglomerate Cliff above the Turquoise Taolai River Canyon (讨赖河大峡谷绝壁)
  band(gp, 0.12, 0.32, y0, 0.006, RIVER);
  tbox(gp, 0.56, 0.28, 0.5, 0.24, 0.088, CLIFF, 0, y0, -0.06);
  // Iconic Square Rammed-Earth "First Pier of the Great Wall" Beacon Mound on the Cliff Edge (万里长城第一墩夯土墩台)
  tbox(gp, 0.16, 0.16, 0.12, 0.12, 0.11, EARTH, -0.14, y0 + 0.088, -0.02);
  // Winged Great Wall Rampart & Jiayuguan Corner Pavilion on the East
  box(gp, EARTH, 0.08, y0 + 0.088, -0.08, 0.28, 0.048, 0.042);
  hall(gp, 0.18, y0 + 0.136, -0.08, 0.13, 0.11, 0.042, '#e6dec8', RED, '#42484e', 0.038);
};

/** 山海关: Laolongtou ("Old Dragon's Head") Great Wall Entering the Bohai Sea & Chenghai Tower (山海关老龙头入海石城与澄海楼). */
const pl_shanhaiguan: Builder = root => {
  const [gp, y0] = site(root, '#1e5c74', 0.88);
  const GRANITE = '#8c8a84', BRICK = '#686c74', RED = '#9c2820', GOLD = '#dca228';
  // Coastal headland & Ming Granite Sea-Fortress Pier ("老龙头"入海石城与靖卤台深入渤海)
  prism(gp, [[-0.4, -0.36], [0.22, -0.36], [0.16, -0.04], [-0.4, 0.02]], y0, 0.042, '#b8a882');
  tbox(gp, 0.18, 0.38, 0.14, 0.34, 0.068, GRANITE, 0.02, y0, 0.04);
  cyl(gp, GRANITE, 0.02, y0, 0.22, 0.085, 0.072, 10);
  // Double-Eaved Chenghai Tower where Emperors Viewed the Sea (澄海楼重檐歇山与御碑亭)
  const h1 = hall(gp, -0.14, y0 + 0.042, -0.16, 0.24, 0.14, 0.046, '#e6dec8', RED, '#42484e', 0.036);
  hall(gp, -0.14, h1 - 0.008, -0.16, 0.18, 0.1, 0.036, '#e6dec8', RED, GOLD, 0.034);
  box(gp, BRICK, -0.04, y0 + 0.042, -0.04, 0.18, 0.038, 0.042);
};

/** 居庸关: Cloud Platform at Juyongguan (居庸关云台元代汉白玉过街塔券洞) & Mountain Pass Gate Tower. */
const pl_pass_juyong: Builder = root => {
  const [gp, y0] = site(root, '#547246', 0.88);
  const MARBLE = '#ede8dc', BRICK = '#686c74', RED = '#9c2820', TILE = '#3a6852', MTN = '#44623a';
  for (const sx of [-0.28, 0.28]) cone(gp, MTN, sx, y0, -0.14, 0.16, 0.17, 6);
  // Iconic Yuan Dynasty White-Marble "Cloud Platform" (居庸关云台：折角梯形汉白玉台基、半八角券洞与石雕栏杆)
  tbox(gp, 0.32, 0.24, 0.26, 0.2, 0.085, MARBLE, 0, y0, 0.04);
  box(gp, '#26201c', 0, y0, 0.04, 0.068, 0.058, 0.25);
  box(gp, '#cfc6b4', 0, y0 + 0.085, 0.04, 0.28, 0.016, 0.22);
  for (let i = -3; i <= 3; i++) for (const sz of [-0.1, 0.1]) cyl(gp, MARBLE, i * 0.04, y0 + 0.101, 0.04 + sz, 0.005, 0.022, 6);
  // Juyongguan North Gate Tower Rising Behind on the Ridge (居庸关南北关城楼)
  tbox(gp, 0.38, 0.11, 0.34, 0.09, 0.068, BRICK, 0, y0, -0.18);
  hall(gp, 0, y0 + 0.068, -0.18, 0.2, 0.095, 0.042, '#e6dec8', RED, TILE, 0.036);
};

/** 泰山: Mount Tai Eighteen Bends Heavenly Stairway (泰山十八盘摩天石阶), Nantianmen Gate & Jade Emperor Peak (南天门与玉皇顶). */
const pl_taishan: Builder = root => {
  const [gp, y0] = site(root, '#4e6c44', 0.88);
  const ROCK = '#72767c', STAIR = '#dcd4c2', RED = '#a22820', GOLD = '#e0a828';
  // Twin Craggy Peaks of Mount Tai flanking the Steep "Eighteen Bends" Stone Staircase (泰山东西摩天岭与十八盘天梯)
  for (const [sx, h] of [[-0.22, 0.21], [0.22, 0.23]] as [number, number][]) {
    cone(gp, ROCK, sx, y0, -0.06, 0.17, h, 7);
    tree(gp, sx * 0.85, y0 + 0.06, 0.08, 0.055, '#2e5834');
  }
  for (let i = 0; i < 8; i++) {
    box(gp, STAIR, 0, y0 + i * 0.018, 0.22 - i * 0.036, 0.095, 0.018, 0.045);
  }
  // Vermilion Nantianmen ("South Gate to Heaven") at the Top of the Stairs & Yuhuangding Summit Temple (南天门红墙飞檐与玉皇顶)
  tbox(gp, 0.24, 0.12, 0.22, 0.1, 0.052, RED, 0, y0 + 0.135, -0.08);
  box(gp, '#221a16', 0, y0 + 0.135, -0.08, 0.048, 0.038, 0.13);
  hall(gp, 0, y0 + 0.187, -0.08, 0.18, 0.095, 0.038, RED, RED, GOLD, 0.036);
};

export const PLACES_SITES: Record<string, Builder> = {
  pl_yuanmou, pl_hemudu, pl_liangzhu, pl_dawenkou, pl_dujiangyan, pl_dunhuang,
  pl_taosi, pl_shimao, pl_anyang, pl_yungang,
  pl_muye, pl_changping, pl_julu, pl_gaixia, pl_dazexiang, pl_guandu, pl_chibi, pl_feishui, pl_yashan,
  pl_yumenguan, pl_hanguguan, pl_tongguan, pl_jianmenguan, pl_pingxingguan,
  pl_pass_wuguan, pl_pass_dasanguan, pl_pass_xiaoguan, pl_pass_hulao, pl_pass_yangping,
  pl_pass_yanmen, pl_pass_zijing, pl_pass_niangzi, pl_pass_gubeikou, pl_pass_yangguan,
  pl_pass_wusheng, pl_pass_xianxia, pl_pass_meiguan,
  pl_jiaxing, pl_jinggangshan, pl_ruijin, pl_zunyi, pl_luding, pl_yanan, pl_xibaipo, pl_lugouqiao,
  pl_taierzhuang, pl_humen, pl_weihai, pl_xiaogang, pl_jiuquan_lc, pl_wenchang, pl_xiongan, pl_dandong,
  pl_everest, pl_diaoyu, pl_nanhai, pl_xisha, pl_nansha,
  pl_erlitou, pl_shangjing, pl_huining, pl_zhoukoudian, pl_banpo, pl_sanxingdui,
  pl_lingqu, pl_zhaozhou, pl_longmen, pl_mogao, pl_lop_nur, pl_jiayuguan, pl_shanhaiguan,
  pl_pass_juyong, pl_taishan,
};
