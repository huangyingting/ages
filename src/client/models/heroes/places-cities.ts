import * as THREE from 'three';
import { type Builder, box, rbox, cyl, cone as rawCone, ellip, rod, gable as rawGable, prism, tbox as rawTbox, shade, plinth, tree, SITE } from '../prims.ts';
import { grp, proof, gourd, stylePlaceHallColors, stylePlaceHuman } from '../timber.ts';
import { human } from '../human.ts';

let citySiteSeq = 0;
function site(root: THREE.Group, top: string, k = 0.88): [THREE.Group, number] {
  const h = plinth(root, top);
  const p = new THREE.Group();
  p.position.y = h + 0.0015;
  p.scale.setScalar(k);
  root.add(p);
  const s = ++citySiteSeq;
  const a1 = 0.55 + (s % 7) * 0.31, a2 = a1 + 2.3 + (s % 5) * 0.22;
  const tops = ['#785a3c', '#8c3428', '#2e5268', '#4a6240', '#6a485e', '#946834', '#384654'];
  const bots = ['#4a3c2e', '#dfd6c4', '#2c343c', '#c8beaa', '#523c32', '#3a483c'];
  const poses = ['walk', 'point', 'stand', 'relax', 'carry'] as const;
  if (top !== SITE.water && top !== SITE.snow) {
    tree(p, Math.cos(a1) * 0.33, 0, Math.sin(a1) * 0.31, 0.048 + (s % 3) * 0.006, s & 1 ? '#44683a' : '#3b5c34');
    const hs = stylePlaceHuman(s, tops[s % tops.length], bots[(s >> 1) % bots.length]);
    human(p, Math.cos(a2) * 0.29, 0, Math.sin(a2) * 0.28, {
      h: 0.042, ry: -a2, pose: poses[s % poses.length],
      top: hs.top, bottom: hs.bottom,
      dress: hs.dress, hat: hs.hat, hatStyle: hs.hatStyle, detail: 'hi',
    });
  }
  return [p, 0];
}

function gable(
  p: THREE.Object3D, w: number, h: number, d: number,
  c: string, x = 0, y = 0, z = 0, ry = 0,
): THREE.Mesh {
  const [, , roofC, , goldC] = stylePlaceHallColors('#ece4d4', '#8e231c', c);
  const m = rawGable(p, w * 0.92, h * 0.88, d * 0.92, roofC, x, y, z, ry);
  const g = grp(p, x, z, ry, y);
  const R0 = ((d / 2) * 1.06) / Math.SQRT1_2;
  const topY = proof(g, 0, 0, 0, {
    n: 4, R0, R1: R0 * 0.28, h, lift: 0.34, sub: 4,
    tile: roofC, sx: w / Math.max(0.02, d * 1.06),
  });
  const rw = Math.max(w * 0.48, 0.024);
  box(g, shade(roofC, 0.76), 0, topY - h * 0.08, 0, rw, Math.max(0.004, h * 0.14), Math.max(0.004, d * 0.06));
  for (const sx of [-1, 1]) {
    box(g, goldC, sx * (rw * 0.49), topY - h * 0.04, 0, Math.max(0.004, h * 0.12), Math.max(0.008, h * 0.22), Math.max(0.005, d * 0.07));
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
    // Molded base foot & top stone coping (台基压阑石/城墙压顶石)
    box(g, rimC, 0, 0, 0, w0 + 0.008, Math.min(0.006, h * 0.14), d0 + 0.008);
    box(g, rimC, 0, h - Math.min(0.006, h * 0.14), 0, w1 + 0.008, Math.min(0.006, h * 0.14), d1 + 0.008);
    // Horizontal masonry / rammed-earth coursing bands (夯土层/砖石层缝)
    for (const f of [0.34, 0.67]) {
      const wf = w0 + (w1 - w0) * f + 0.003, df = d0 + (d1 - d0) * f + 0.003;
      box(g, darkC, 0, h * f, 0, wf, 0.0028, df);
    }
    // Corner stone quoins (包角石)
    const qw = Math.min(0.014, w1 * 0.1), qd = Math.min(0.014, d1 * 0.12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(g, rimC, sx * (w1 * 0.48), 0, sz * (d1 * 0.48), qw, h, qd);
    }
    // Crenellated parapet battlements (城垛/女墙) on fortress & city walls
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
  if (r >= 0.048 && h >= 0.068 && seg <= 8) {
    const sMain = 14 + (seg % 5);
    const m = rawCone(p, c, x, y, z, r, h, sMain, ry);
    // Craggy mountain ridge spurs & foothills (山脊支脉与山麓岩层)
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

function hall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, wallIn: string, colIn: string, roofIn: string, rh = h * 0.85): number {
  const [wall, col, roofC, beamC, goldC] = stylePlaceHallColors(wallIn, colIn, roofIn);
  const stoneC = '#cfc6b4', doorC = '#6e1d16', winC = '#efe4cc';
  // Molded stone foundation rim & front approach steps (台基压阑石与踏道)
  box(p, stoneC, x, y, z, w + 0.01, Math.min(0.007, h * 0.14), d + 0.01);
  if (w >= 0.085 && d >= 0.07) {
    const sw = Math.min(w * 0.32, 0.072);
    for (let s = 0; s < 3; s++) {
      box(p, stoneC, x, y + s * 0.0022, z + d * 0.5 + (2 - s) * 0.006, sw, 0.0025, 0.008);
    }
  }
  // Recessed wall core so perimeter colonnade stands proud
  box(p, wall, x, y, z, w * 0.92, h, d * 0.9);
  const nc = Math.max(3, Math.min(7, Math.round(w / 0.036)));
  const nd = Math.max(2, Math.min(5, Math.round(d / 0.04)));
  const cr = Math.min(0.0044, Math.max(0.0028, w * 0.024));
  // Front & back perimeter colonnade with stone drum bases (檐柱与柱础)
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
  // Central lattice doors (隔扇门) & side mullion windows (直棂窗)
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
  // Penetrating tie-beams (阑额), polychrome architrave (额枋彩画) & bracket sets (斗拱)
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
  // Concave curved Chinese hip-and-gable roof (飞檐歇山顶) with tile ribs
  const ov = 1.32, R0 = ((d / 2) * ov) / Math.SQRT1_2;
  const topY = proof(p, x, y + h, z, {
    n: 4, R0, R1: R0 * 0.28, h: rh, lift: 0.34, sub: 4,
    tile: roofC, sx: (w + d * (ov - 1)) / (d * ov),
  });
  // Main roof ridge (正脊) & upturned owl-tail finials (鸱吻)
  const rw = Math.max(w * 0.48, (w + d * (ov - 1)) * 0.34);
  box(p, shade(roofC, 0.76), x, topY - rh * 0.08, z, rw, Math.max(0.005, rh * 0.14), Math.max(0.005, d * 0.06));
  for (const sx of [-1, 1]) {
    box(p, goldC, x + sx * (rw * 0.49), topY - rh * 0.04, z, Math.max(0.005, rh * 0.12), Math.max(0.009, rh * 0.24), Math.max(0.006, d * 0.07));
  }
  return topY;
}

function pagodaOct(p: THREE.Object3D, x: number, y0: number, z: number, tiers: number, r0: number, h0: number, bodyC: string, eaveC: string): void {
  // Carved octagonal Sumeru pedestal (须弥座)
  cyl(p, '#cfc6b4', x, y0, z, r0 * 1.14, Math.min(0.012, h0 * 0.38), 8);
  let y = y0 + Math.min(0.01, h0 * 0.32);
  const colC = '#8f241c', doorC = '#5c1a14';
  for (let i = 0; i < tiers; i++) {
    const k = 1 - (i / tiers) * 0.46, r = r0 * k, h = h0 * (1 - (i / tiers) * 0.24);
    cyl(p, bodyC, x, y, z, r * 0.92, h, 8);
    // 8 corner columns (八角倚柱) & 4 cardinal arched door/window niches (券门)
    for (let c = 0; c < 8; c++) {
      const a = (c * Math.PI) / 4 + Math.PI / 8;
      cyl(p, colC, x + Math.cos(a) * r * 0.93, y, z + Math.sin(a) * r * 0.93, Math.max(0.0018, r * 0.055), h, 5);
    }
    for (const [dx, dz, rx, rz] of [[1, 0, 0.003, r * 0.26], [-1, 0, 0.003, r * 0.26], [0, 1, r * 0.26, 0.003], [0, -1, r * 0.26, 0.003]]) {
      box(p, doorC, x + dx * r * 0.86, y + h * 0.12, z + dz * r * 0.86, rx, h * 0.62, rz);
    }
    if (i > 0) cyl(p, colC, x, y, z, r * 1.04, Math.min(0.0045, h * 0.16), 8);
    const eaveH = Math.max(0.01, h * 0.46);
    proof(p, x, y + h - eaveH * 0.15, z, { n: 8, R0: r * 1.32, R1: r * 0.68, h: eaveH, lift: 0.36, sub: 3, tile: eaveC });
    y += h + eaveH * 0.42;
  }
  gourd(p, x, y, z, r0 * 0.28, '#d4a438');
}

// ============================================================================
// 1. CURATED CHINESE HISTORICAL CITIES (31 CITIES)
// ============================================================================

/** 郑州: Shang City rammed-earth wall (商城夯土城垣), Bronze Duling Fangding (杜岭方鼎) & Erqi Twin Memorial Tower (二七塔). */
const pl_zhengzhou: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a88858', BRZ = '#4e7c64', WHITE = '#eae4d8', GREEN = '#2f7254';
  // Ancient Shang Dynasty rammed-earth wall (郑州商城遗址夯土墙) across north-west
  tbox(gp, 0.34, 0.11, 0.28, 0.085, 0.085, EARTH, -0.14, y0, -0.16);
  // Bronze Duling Square Cauldron (商代兽面纹杜岭方鼎) on stone pedestal
  const dx = -0.14, dz = 0.12;
  box(gp, '#cfc6b4', dx, y0, dz, 0.09, 0.018, 0.09);
  for (const sx of [-0.026, 0.026]) for (const sz of [-0.026, 0.026]) cyl(gp, BRZ, dx + sx, y0 + 0.018, dz + sz, 0.006, 0.038, 6);
  box(gp, BRZ, dx, y0 + 0.052, dz, 0.072, 0.055, 0.072);
  for (const sx of [-0.028, 0.028]) box(gp, BRZ, dx + sx, y0 + 0.107, dz, 0.008, 0.018, 0.024);
  // Iconic Erqi Memorial Twin Tower (郑州二七纪念塔: 双身并联六角十三层塔) on the east
  box(gp, WHITE, 0.16, y0, 0.02, 0.14, 0.038, 0.09);
  for (const tx of [0.128, 0.192]) pagodaOct(gp, tx, y0 + 0.038, 0.02, 7, 0.032, 0.024, WHITE, GREEN);
  cyl(gp, '#c42820', 0.16, y0 + 0.25, 0.02, 0.012, 0.006, 5).rotation.x = Math.PI / 2;
};

/** 沈阳: Shenyang Imperial Palace Dazheng Hall (沈阳故宫大政殿八角重檐鎏金宝顶与十王亭). */
const pl_shenyang: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#e6dfd0', RED = '#9e2820', GOLD = '#d89e28', GREEN = '#2f7856';
  // Octagonal white-stone須弥座 platform at north-center
  cyl(gp, MARBLE, 0, y0, -0.1, 0.18, 0.032, 8);
  box(gp, MARBLE, 0, y0, 0.06, 0.068, 0.028, 0.07);
  // Dazheng Hall (大政殿): octagonal red-columned hall with double-eaved yellow-and-green glazed roof & golden spire
  cyl(gp, RED, 0, y0 + 0.032, -0.1, 0.125, 0.068, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    cyl(gp, i === 1 || i === 2 ? GOLD : RED, Math.cos(a) * 0.132, y0 + 0.032, -0.1 + Math.sin(a) * 0.132, 0.006, 0.068, 6);
  }
  cone(gp, GOLD, 0, y0 + 0.095, -0.1, 0.175, 0.032, 8);
  cyl(gp, RED, 0, y0 + 0.12, -0.1, 0.095, 0.035, 8);
  cone(gp, GOLD, 0, y0 + 0.15, -0.1, 0.145, 0.055, 8);
  cyl(gp, GOLD, 0, y0 + 0.205, -0.1, 0.014, 0.032, 8);
  // Flanking Left & Right Wing King Pavilions (左右翼王亭与八旗十王亭)
  for (const sx of [-0.22, 0.22]) {
    for (const [z, c] of [[0.04, GOLD], [0.2, GREEN]] as [number, string][]) {
      hall(gp, sx, y0, z, 0.095, 0.095, 0.044, RED, RED, c, 0.038);
    }
  }
};

/** 大理: Three Pagodas of Chongsheng Temple (崇圣寺三塔: 一大二小鼎足而立), Cangshan snow peak & Erhai Lake. */
const pl_dali: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const WHITE = '#f0ece2', GOLD = '#d6a438', MTN = '#3e6248', WATER = '#327282';
  band(gp, 0.18, 0.36, y0, 0.006, WATER);
  // Snow-capped Cangshan range (苍山十九峰积雪) at the north backdrop
  cone(gp, MTN, -0.22, y0, -0.26, 0.16, 0.19, 7);
  cone(gp, '#f4f6f8', -0.22, y0 + 0.13, -0.26, 0.06, 0.065, 7);
  cone(gp, MTN, 0.22, y0, -0.26, 0.16, 0.18, 7);
  // Central 16-tiered Square White Qianxun Pagoda (千寻塔: 方形密檐式白塔)
  box(gp, '#cfc6b4', 0, y0, 0.02, 0.14, 0.024, 0.14);
  let py = y0 + 0.024;
  for (let i = 0; i < 11; i++) {
    const s = Math.sin((i / 10) * Math.PI * 0.78), w = 0.068 * (1 - i * 0.045) + s * 0.012;
    box(gp, WHITE, 0, py, 0.02, w, 0.016, w);
    box(gp, '#585c62', 0, py + 0.016, 0.02, w + 0.018, 0.005, w + 0.018);
    py += 0.021;
  }
  cone(gp, GOLD, 0, py, 0.02, 0.016, 0.038, 8);
  // Flanking North & South 10-tiered Octagonal White Pagodas (南北双八角小塔)
  for (const sx of [-0.19, 0.19]) pagodaOct(gp, sx, y0, -0.09, 8, 0.032, 0.019, WHITE, '#686c72');
};

/** 成都: Wuhou Shrine Red Walls & Bamboo (武侯祠红墙竹影), Anshun Covered Bridge & Wangjianglou Pavilion. */
const pl_chengdu: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const RED = '#9e2b22', TILE = '#464b52', BAMBOO = '#467a3e', WATER = '#386e74', GOLD = '#d8a634';
  band(gp, 0.08, 0.24, y0, 0.006, WATER);
  // Anshun Covered Bridge (安顺廊桥) spanning the Jinjiang River
  box(gp, '#cfc6b4', 0, y0 + 0.005, 0.16, 0.24, 0.024, 0.075);
  hall(gp, 0, y0 + 0.029, 0.16, 0.18, 0.065, 0.036, '#e6dec8', RED, TILE, 0.034);
  // Iconic Wuhou Shrine Winding Red Walls & Lush Bamboo Alley (武侯祠红墙夹道与翠竹) at north-west
  box(gp, RED, -0.15, y0, -0.12, 0.28, 0.055, 0.014);
  box(gp, RED, -0.15, y0, -0.04, 0.28, 0.055, 0.014);
  hall(gp, -0.16, y0, -0.22, 0.2, 0.11, 0.048, RED, RED, TILE, 0.042);
  for (let i = -3; i <= 1; i++) tree(gp, i * 0.065, y0, -0.08, 0.068, BAMBOO);
  // Four-storey Wangjianglou Chongli Pavilion (望江楼崇丽阁) at north-east
  pagodaOct(gp, 0.2, y0, -0.14, 4, 0.055, 0.036, RED, GOLD);
};

/** 重庆: Chaotianmen Two-River Confluence (两江交汇), tiered Hongyadong stilted cliff houses & Jiefangbei monument. */
const pl_chongqing: Builder = root => {
  const [gp, y0] = site(root, '#c28e42', 0.88);
  const JIALING = '#287874', ROCK = '#6c655a', WD = '#7a4a24', RED = '#a82c22', TILE = '#44484e', GOLD = '#e6a832';
  // Two-Color Confluence: emerald Jialing River meeting golden-brown Yangtze at Chaotianmen point
  prism(gp, [[-0.4, 0.08], [0.4, 0.04], [0.36, 0.36], [-0.36, 0.36]], y0, 0.006, JIALING);
  // Stepped Yuzhong Mountain City Bluff (重庆母城渝中半岛山体与朝天门城台)
  tbox(gp, 0.56, 0.34, 0.5, 0.28, 0.052, ROCK, -0.02, y0, -0.1);
  tbox(gp, 0.38, 0.2, 0.34, 0.17, 0.055, shade(ROCK, 1.08), -0.1, y0 + 0.052, -0.16);
  // Iconic Hongyadong Multi-Tiered Stilted Cliff Houses (洪崖洞巴渝吊脚楼群与万家灯火) cascading down the front cliff
  for (let tier = 0; tier < 3; tier++) {
    const ty = y0 + 0.038 + tier * 0.042, tz = 0.04 - tier * 0.055, tw = 0.26 - tier * 0.03;
    for (const sx of [-0.09, 0, 0.09]) cyl(gp, WD, 0.06 + sx, y0, tz + 0.03, 0.0045, ty - y0, 5);
    hall(gp, 0.06, ty, tz, tw, 0.085, 0.038, WD, RED, TILE, 0.032);
    box(gp, GOLD, 0.06, ty + 0.012, tz + 0.044, tw * 0.78, 0.014, 0.004);
  }
  // Iconic Octagonal Jiefangbei Clock Monument (人民解放纪念碑) crowning the upper mountain terrace
  cyl(gp, '#f0eae0', -0.18, y0 + 0.107, -0.16, 0.024, 0.125, 8);
  cyl(gp, GOLD, -0.18, y0 + 0.232, -0.16, 0.018, 0.024, 8);
};

/** 泉州: Twin Stone Pagodas of Kaiyuan Temple (东西塔: 镇国塔与仁寿塔), Minnan swallowtail red-brick hall & ocean junk. */
const pl_quanzhou: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#c8c0ae', BRICK = '#b44834', WATER = '#2c6878';
  band(gp, 0.16, 0.36, y0, 0.006, WATER);
  // Iconic Twin Five-Storey Octagonal Granite Pagodas of Quanzhou Kaiyuan Temple (镇国塔与仁寿塔东西双塔)
  for (const sx of [-0.21, 0.21]) {
    box(gp, STONE, sx, y0, -0.08, 0.11, 0.02, 0.11);
    pagodaOct(gp, sx, y0 + 0.02, -0.08, 5, 0.044, 0.032, STONE, shade(STONE, 0.82));
  }
  // Minnan Red-Brick Mahavira Hall (大雄宝殿闽南红砖燕尾脊) in the center
  hall(gp, 0, y0, -0.14, 0.2, 0.12, 0.048, BRICK, '#982a20', BRICK, 0.042);
  // Quanzhou Bay Song-Yuan Maritime Silk Road Junk (泉州湾宋代福船) in the foreground harbour
  rbox(gp, '#644024', 0.04, y0 + 0.008, 0.25, 0.18, 0.026, 0.056, 0.008);
  for (const dx of [-0.03, 0.04]) {
    cyl(gp, '#4a301a', 0.04 + dx, y0 + 0.034, 0.25, 0.004, 0.1, 5);
    box(gp, '#e6dac2', 0.04 + dx + 0.005, y0 + 0.055, 0.25, 0.004, 0.06, 0.045);
  }
};

/** 扬州: Slender West Lake Five-Pavilion Bridge (瘦西湖五亭桥莲花桥) & White Tibetan Dagoba (瘦西湖白塔). */
const pl_yangzhou: Builder = root => {
  const [gp, y0] = site(root, '#327278', 0.88);
  const STONE = '#d6cfc0', GOLD = '#dca42c', RED = '#9c2a20', WHITE = '#f2efe8';
  // Green island shores on north-west and south-east
  prism(gp, [[-0.4, -0.36], [0.06, -0.36], [-0.08, -0.08], [-0.4, -0.08]], y0, 0.018, '#5a7c4a');
  prism(gp, [[0.08, 0.12], [0.4, 0.12], [0.4, 0.36], [-0.1, 0.36]], y0, 0.018, '#5a7c4a');
  // Iconic Five-Pavilion Bridge (扬州五亭桥: 青石桥身与五座黄琉璃瓦风亭) spanning the lake
  box(gp, STONE, 0.04, y0 + 0.006, 0.02, 0.36, 0.036, 0.15);
  cyl(grp(gp, 0.04, 0.02, 0, y0 + 0.006), '#1e4a50', 0, 0, 0, 0.028, 0.16, 10).rotation.x = Math.PI / 2;
  // Central taller pavilion & four corner pavilions
  hall(gp, 0.04, y0 + 0.042, 0.02, 0.095, 0.095, 0.048, '#e8e0d0', RED, GOLD, 0.042);
  for (const [dx, dz] of [[-0.11, -0.04], [0.19, -0.04], [-0.11, 0.08], [0.19, 0.08]] as [number, number][]) {
    hall(gp, dx, y0 + 0.042, dz, 0.068, 0.068, 0.036, '#e8e0d0', RED, GOLD, 0.032);
  }
  // Slender West Lake White Dagoba (莲性寺白塔) on the north-west bank
  box(gp, WHITE, -0.22, y0 + 0.018, -0.2, 0.085, 0.032, 0.085);
  ellip(gp, WHITE, -0.22, y0 + 0.085, -0.2, 0.036, 0.048, 0.036);
  cone(gp, GOLD, -0.22, y0 + 0.125, -0.2, 0.018, 0.065, 10);
  tree(gp, 0.24, y0 + 0.018, 0.24, 0.065, '#4e7840');
};

/** 天津: Tianjin Drum Tower (天津卫鼓楼), Haihe River Liberation Steel Bridge & Century Clock / Wanghailou. */
const pl_tianjin: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#686c74', RED = '#982c22', TILE = '#464a50', WATER = '#346874', STEEL = '#4e5862';
  band(gp, 0.06, 0.24, y0, 0.006, WATER);
  // Haihe River Liberation Steel Truss Bridge (海河解放桥)
  box(gp, STEEL, 0, y0 + 0.018, 0.15, 0.11, 0.01, 0.22);
  for (const sx of [-0.05, 0.05]) {
    box(gp, STEEL, sx, y0 + 0.058, 0.15, 0.006, 0.006, 0.18);
    for (const dz of [-0.07, 0, 0.07]) rod(gp, [sx, y0 + 0.02, 0.15 + dz], [sx, y0 + 0.058, 0.15 + dz * 0.7], 0.003, STEEL, 4);
  }
  // Tianjin Drum Tower (天津鼓楼: 四门拱券砖墩重檐歇山顶) at north-west
  tbox(gp, 0.22, 0.22, 0.19, 0.19, 0.075, BRICK, -0.15, y0, -0.14);
  box(gp, '#241c18', -0.15, y0, -0.14, 0.052, 0.048, 0.23);
  hall(gp, -0.15, y0 + 0.075, -0.14, 0.15, 0.15, 0.045, '#e4dcc8', RED, TILE, 0.04);
  // Tianjin Golden Century Clock / Ferris Wheel silhouette on the east bank
  cyl(grp(gp, 0.2, -0.1, 0, y0 + 0.11), '#d8a838', 0, 0, 0, 0.085, 0.008, 18).rotation.x = Math.PI / 2;
  for (const sx of [-0.045, 0.045]) rod(gp, [0.2 + sx, y0, -0.1], [0.2, y0 + 0.11, -0.1], 0.005, '#dcd6c8', 5);
};

/** 济南: Baotu Spring Three Bubbling Jets (趵突泉三股水), Guanlan Pavilion, weeping willows & Daming Lake Chaoran Tower. */
const pl_jinan: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WATER = '#287a82', STONE = '#d8d0c0', RED = '#982c22', TILE = '#464c52', GOLD = '#d49c2e';
  // Square stone-railed Baotu Spring Pool (趵突泉池) with Three Bubbling White Water Jets (三股水涌流)
  box(gp, STONE, -0.06, y0, 0.1, 0.36, 0.022, 0.24);
  box(gp, WATER, -0.06, y0 + 0.006, 0.1, 0.31, 0.018, 0.19);
  for (const dx of [-0.14, -0.06, 0.02]) {
    cyl(gp, '#8ad8e0', dx, y0 + 0.022, 0.1, 0.028, 0.014, 12);
    ellip(gp, '#eef8fa', dx, y0 + 0.042, 0.1, 0.018, 0.022, 0.018);
  }
  // Guanlan Pavilion (观澜亭) & "趵突泉" stone stele by the pool edge
  hall(gp, -0.22, y0 + 0.022, -0.04, 0.12, 0.1, 0.045, '#e8e0d0', RED, TILE, 0.038);
  box(gp, '#585c62', 0.06, y0 + 0.022, 0.02, 0.032, 0.048, 0.01);
  // Multi-tiered Chaoran Tower (大明湖超然楼) at north-east & weeping willows
  tbox(gp, 0.2, 0.18, 0.18, 0.16, 0.042, STONE, 0.18, y0, -0.14);
  const h1 = hall(gp, 0.18, y0 + 0.042, -0.14, 0.15, 0.13, 0.045, '#e6dec8', RED, GOLD, 0.036);
  hall(gp, 0.18, h1 - 0.008, -0.14, 0.11, 0.095, 0.036, '#e6dec8', RED, GOLD, 0.032);
  for (const [x, z] of [[-0.28, 0.22], [0.22, 0.2]] as [number, number][]) tree(gp, x, y0, z, 0.068, '#547c42');
};

/** 曲阜: Temple of Confucius Dacheng Hall (孔庙大成殿深浮雕盘龙石柱), Apricot Altar Pavilion (杏坛) & ancient cypresses. */
const pl_qufu: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#e6dfd0', GOLD = '#dca228', RED = '#9c2820', STONE = '#bfb6a2';
  // Two-tiered white stone platform of Dacheng Hall (孔庙大成殿月台)
  tbox(gp, 0.52, 0.26, 0.48, 0.23, 0.042, MARBLE, 0, y0, -0.14);
  box(gp, MARBLE, 0, y0, 0.01, 0.09, 0.038, 0.08);
  // Double-eaved yellow-glazed Dacheng Hall with ten carved stone dragon columns (深浮雕盘龙石柱) along the front
  box(gp, RED, 0, y0 + 0.042, -0.14, 0.38, 0.068, 0.16);
  for (let i = -4; i <= 4; i++) {
    cyl(gp, STONE, i * 0.044, y0 + 0.042, -0.052, 0.006, 0.068, 8);
  }
  gable(gp, 0.44, 0.035, 0.21, GOLD, 0, y0 + 0.095, -0.14);
  box(gp, RED, 0, y0 + 0.12, -0.14, 0.32, 0.032, 0.13);
  gable(gp, 0.39, 0.048, 0.18, GOLD, 0, y0 + 0.15, -0.14);
  // Apricot Altar Pavilion (杏坛重檐十字脊亭) in the front courtyard
  box(gp, MARBLE, 0, y0, 0.18, 0.14, 0.02, 0.14);
  hall(gp, 0, y0 + 0.02, 0.18, 0.11, 0.11, 0.042, RED, RED, GOLD, 0.038);
  for (const sx of [-0.28, 0.28]) tree(gp, sx, y0, 0.16, 0.072, '#3a5c38');
};

/** 临淄: Qi Capital Linzi High Terrace (齐都临淄桓公台), stone drainage gate & Qi Knife-Coin / Sacrificial Horse monument. */
const pl_linzi: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a88856', BRZ = '#527e66', STONE = '#8e887c', RED = '#982c22', TILE = '#4a4e54';
  // Stepped oval Huangong Terrace of Qi Capital Linzi (临淄齐国故城桓公台夯土高台)
  cyl(gp, EARTH, -0.1, y0, -0.1, 0.19, 0.048, 16);
  cyl(gp, shade(EARTH, 0.94), -0.1, y0 + 0.048, -0.1, 0.14, 0.045, 16);
  hall(gp, -0.1, y0 + 0.093, -0.1, 0.16, 0.12, 0.044, '#e2dac6', RED, TILE, 0.038);
  // Famous Qi Capital Stone Drainage Culvert Wall (齐故城石砌排水道口) on the south-west
  box(gp, STONE, -0.18, y0, 0.18, 0.18, 0.055, 0.06);
  for (const dx of [-0.22, -0.18, -0.14]) box(gp, '#242220', dx, y0 + 0.01, 0.21, 0.022, 0.024, 0.01);
  // Giant Qi Bronze Knife-Coin Sculpture (齐法化刀币与足球蹴鞠祖庭标志) on the east plaza
  box(gp, '#cfc6b4', 0.2, y0, 0.06, 0.09, 0.02, 0.09);
  cyl(grp(gp, 0.2, 0.06, 0, y0 + 0.16), BRZ, 0, 0, 0, 0.024, 0.01, 12).rotation.x = Math.PI / 2;
  box(gp, BRZ, 0.2, y0 + 0.02, 0.06, 0.028, 0.13, 0.01);
  ellip(gp, '#8a522e', 0.06, y0 + 0.024, 0.2, 0.024, 0.024, 0.024);
};

/** 邯郸: Wuling Congtai Three-Tiered Terrace (武灵丛台), sky-bridge & Juemiao Pavilion over moat water. */
const pl_handan: Builder = root => {
  const [gp, y0] = site(root, '#366e74', 0.88);
  const BRICK = '#6d7178', RED = '#9c2c22', TILE = '#3d6e54', GOLD = '#d6a232';
  // Three-tiered grey-brick Wuling Congtai Terrace (赵邯郸武灵丛台三层高台) surrounded by moat
  tbox(gp, 0.42, 0.32, 0.38, 0.28, 0.052, BRICK, -0.06, y0, -0.04);
  tbox(gp, 0.3, 0.22, 0.27, 0.19, 0.048, shade(BRICK, 1.06), -0.06, y0 + 0.052, -0.04);
  // Circular-and-hexagonal Juemiao Pavilion (丛台据胜亭) on top
  cyl(gp, RED, -0.06, y0 + 0.1, -0.04, 0.085, 0.048, 8);
  cone(gp, TILE, -0.06, y0 + 0.145, -0.04, 0.115, 0.032, 8);
  cyl(gp, RED, -0.06, y0 + 0.17, -0.04, 0.062, 0.032, 8);
  cone(gp, GOLD, -0.06, y0 + 0.2, -0.04, 0.09, 0.042, 8);
  // Arched brick sky-bridge (丛台天桥) linking to the east auxiliary terrace
  tbox(gp, 0.15, 0.15, 0.13, 0.13, 0.085, BRICK, 0.24, y0, 0.04);
  box(gp, BRICK, 0.12, y0 + 0.065, 0.01, 0.14, 0.022, 0.048);
  hall(gp, 0.24, y0 + 0.085, 0.04, 0.1, 0.1, 0.038, '#e4dcc8', RED, TILE, 0.032);
};

/** 郢: Chu Capital Jinancheng Zhanghua Terrace (楚纪南城章华台) & iconic Tiger-Base Bird-Frame Lacquer Drum (虎座鸟架鼓). */
const pl_ying: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a48454', RED = '#a8281e', BLACK = '#222024', GOLD = '#d8a638';
  // Stepped Chu Zhanghua High Terrace (楚都郢城章华层台) with black-and-vermilion Chu palace halls
  tbox(gp, 0.38, 0.28, 0.34, 0.24, 0.055, EARTH, -0.1, y0, -0.1);
  const h1 = hall(gp, -0.1, y0 + 0.055, -0.1, 0.26, 0.16, 0.048, BLACK, RED, BLACK, 0.042);
  hall(gp, -0.1, h1 - 0.01, -0.1, 0.16, 0.11, 0.038, RED, BLACK, BLACK, 0.035);
  // Iconic Chu Lacquered Tiger-Base Bird-Frame Drum (虎座鸟架鼓: 双虎背向伏坐、双凤昂首悬鼓) on east pedestal
  const gx = 0.2, gz = 0.08;
  box(gp, '#cfc6b4', gx, y0, gz, 0.14, 0.018, 0.08);
  for (const sx of [-0.042, 0.042]) {
    // Recumbent tiger base & tall standing phoenix neck
    box(gp, BLACK, gx + sx, y0 + 0.018, gz, 0.042, 0.018, 0.022);
    cyl(gp, RED, gx + sx * 0.75, y0 + 0.036, gz, 0.008, 0.11, 6);
    ellip(gp, RED, gx + sx * 0.9, y0 + 0.15, gz, 0.016, 0.01, 0.012);
  }
  // Suspended red-and-black lacquer drum between the phoenixes
  cyl(grp(gp, gx, gz, 0, y0 + 0.105), RED, 0, 0, 0, 0.032, 0.018, 14).rotation.x = Math.PI / 2;
  cyl(grp(gp, gx, gz, 0, y0 + 0.105), GOLD, 0, 0, 0, 0.022, 0.02, 12).rotation.x = Math.PI / 2;
};

/** 福州: Three Lanes and Seven Alleys White Saddle-Walls (三坊七巷马鞍墙), Black Pagoda (乌塔) & White Pagoda (白塔). */
const pl_fuzhou: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WHITE = '#f0ece2', BLACK = '#34363c', TILE = '#44484e', RED = '#982c22';
  // Three Lanes & Seven Alleys Courtyard with curved Fuzhou Saddle-Shaped Fire Gables (三坊七巷曲线马鞍封火墙)
  hall(gp, 0, y0, 0.08, 0.28, 0.16, 0.062, WHITE, '#4e3420', TILE, 0.044);
  for (const sx of [-0.145, 0.145]) {
    box(gp, WHITE, sx, y0, 0.08, 0.014, 0.095, 0.168);
    cyl(grp(gp, sx, 0.08, 0, y0 + 0.095), WHITE, 0, 0, 0, 0.035, 0.016, 10).rotation.z = Math.PI / 2;
    box(gp, TILE, sx, y0 + 0.095, 0.08, 0.018, 0.006, 0.172);
  }
  // Wuta Black Granite Pagoda (崇妙保圣坚牢塔/乌塔) on the west & Baita White Pagoda (定光多宝塔/白塔) on the east
  pagodaOct(gp, -0.23, y0, -0.14, 7, 0.036, 0.025, BLACK, '#222428');
  pagodaOct(gp, 0.23, y0, -0.14, 7, 0.038, 0.026, WHITE, RED);
  tree(gp, 0, y0, -0.18, 0.082, '#3e6c38');
};

/** 昆明: Golden Horse and Jade Rooster Twin Archways (金马碧鸡坊) & Dianchi Lake Daguan Tower (大观楼). */
const pl_kunming: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const RED = '#9e2820', GOLD = '#dca428', TILE = '#3e6e58', WATER = '#32727e';
  band(gp, -0.38, -0.16, y0, 0.006, WATER);
  // Iconic Twin Carved Timber Pailou Archways: Golden Horse & Jade Rooster (金马坊与碧鸡坊) in the foreground
  for (const dz of [0.06, 0.24]) {
    for (const dx of [-0.13, -0.045, 0.045, 0.13]) {
      box(gp, '#cfc6b4', dx, y0, dz, 0.022, 0.022, 0.022);
      cyl(gp, RED, dx, y0 + 0.022, dz, 0.0055, 0.1, 6);
    }
    box(gp, RED, 0, y0 + 0.095, dz, 0.28, 0.018, 0.014);
    box(gp, GOLD, 0, y0 + 0.105, dz + 0.008, 0.055, 0.022, 0.006);
    gable(gp, 0.13, 0.028, 0.048, TILE, 0, y0 + 0.122, dz);
    for (const sx of [-0.09, 0.09]) gable(gp, 0.09, 0.022, 0.042, TILE, sx, y0 + 0.108, dz);
  }
  // Three-storey Daguan Tower (滇池大观楼) overlooking the northern water
  const h1 = hall(gp, -0.22, y0, -0.14, 0.15, 0.12, 0.042, '#e6dec8', RED, TILE, 0.032);
  hall(gp, -0.22, h1 - 0.008, -0.14, 0.11, 0.09, 0.036, '#e6dec8', RED, GOLD, 0.03);
};

/** 兰州: Zhongshan Iron Bridge ("黄河第一桥"), Giant Timber Yellow River Waterwheel (兰州水车) & White Pagoda Hill. */
const pl_lanzhou: Builder = root => {
  const [gp, y0] = site(root, '#c2903e', 0.88);
  const STEEL = '#545c64', WD = '#6b4624', MTN = '#987c52', WHITE = '#f0ece2';
  // White Pagoda Mountain (白塔山) on the north bank topped with the 7-tiered octagonal white pagoda
  prism(gp, [[-0.38, -0.36], [0.38, -0.36], [0.36, -0.1], [-0.36, -0.12]], y0, 0.085, MTN, 0.03);
  pagodaOct(gp, 0.14, y0 + 0.085, -0.22, 7, 0.034, 0.022, WHITE, '#486e58');
  // Iconic Zhongshan Iron Truss Bridge (兰州黄河铁桥: 五孔弧形钢桁架桥) spanning north-to-south
  box(gp, '#9e9688', -0.06, y0 + 0.028, 0.04, 0.095, 0.012, 0.44);
  for (const sx of [-0.044, 0.044]) {
    for (const dz of [-0.11, 0.04, 0.19]) {
      box(gp, STEEL, -0.06 + sx, y0 + 0.085, dz, 0.006, 0.008, 0.13);
      for (const s of [-0.06, 0.06]) rod(gp, [-0.06 + sx, y0 + 0.032, dz + s], [-0.06 + sx, y0 + 0.085, dz + s * 0.7], 0.0035, STEEL, 4);
    }
  }
  // Giant Timber Lanzhou Waterwheel (兰州黄河大水车) on the east bank
  const wx = 0.22, wz = 0.12;
  for (const sz of [-0.018, 0.018]) rod(gp, [wx - 0.04, y0, wz + sz], [wx, y0 + 0.1, wz + sz], 0.005, WD, 5);
  cyl(grp(gp, wx, wz, 0, y0 + 0.1), WD, 0, 0, 0, 0.088, 0.012, 18);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rod(gp, [wx - Math.cos(a) * 0.085, y0 + 0.1 - Math.sin(a) * 0.085, wz], [wx + Math.cos(a) * 0.085, y0 + 0.1 + Math.sin(a) * 0.085, wz], 0.003, WD, 4);
  }
};

/** 西宁: Kumbum Monastery (塔尔寺) — Row of Eight White Tathagata Stupas (八宝如意塔) & Great Golden-Tiled Hall (大金瓦殿). */
const pl_xining: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WHITE = '#f2efe8', RED = '#942820', GOLD = '#e0a828', GREEN = '#2c7858';
  // Great Golden-Tiled Hall of Kumbum Monastery (塔尔寺大金瓦殿: 藏汉结合三层重檐鎏金铜瓦顶) at north
  tbox(gp, 0.38, 0.22, 0.34, 0.19, 0.075, WHITE, 0, y0, -0.14);
  box(gp, RED, 0, y0 + 0.055, -0.14, 0.35, 0.02, 0.195);
  hall(gp, 0, y0 + 0.075, -0.14, 0.26, 0.14, 0.044, RED, GOLD, GREEN, 0.032);
  hall(gp, 0, y0 + 0.135, -0.14, 0.2, 0.11, 0.036, GOLD, GOLD, GOLD, 0.036);
  // Iconic Row of Eight White Tibetan Stupas (塔尔寺如来八塔: 一字排开八座汉白玉藏塔) across the foreground plaza
  for (let i = 0; i < 8; i++) {
    const sx = -0.315 + i * 0.09, sz = 0.16;
    box(gp, WHITE, sx, y0, sz, 0.058, 0.028, 0.058);
    box(gp, RED, sx, y0 + 0.028, sz, 0.048, 0.008, 0.048);
    ellip(gp, WHITE, sx, y0 + 0.058, sz, 0.022, 0.026, 0.022);
    cone(gp, GOLD, sx, y0 + 0.08, sz, 0.01, 0.034, 8);
  }
};

/** 乌鲁木齐: Red Hill Crimson Cliff & 9-Storey Pagoda (红山塔), snow-capped Bogda Peak & Grand Bazaar Islamic Minaret. */
const pl_urumqi: Builder = root => {
  const [gp, y0] = site(root, '#c8ae7e', 0.88);
  const RED_CLIFF = '#a83c28', BRICK = '#b85238', SNOW = '#f2f5f8', SAND = '#d4b47e', TURQ = '#28828e';
  // Snow-capped Three Peaks of Bogda (天山博格达峰三峰积雪) on the northern horizon
  for (const [x, r, h] of [[-0.22, 0.13, 0.19], [-0.08, 0.15, 0.24], [0.06, 0.13, 0.2]] as [number, number, number][]) {
    cone(gp, '#5c6874', x, y0, -0.26, r, h, 6);
    cone(gp, SNOW, x, y0 + h * 0.55, -0.26, r * 0.46, h * 0.46, 6);
  }
  // Iconic Red Hill (红山赤色断崖) on the west crowned by the 9-storey solid brick Zhenlong Pagoda (红山宝塔)
  prism(gp, [[-0.38, -0.04], [-0.08, -0.06], [-0.06, 0.22], [-0.36, 0.24]], y0, 0.095, RED_CLIFF, 0.02);
  pagodaOct(gp, -0.16, y0 + 0.095, 0.06, 7, 0.028, 0.018, BRICK, '#7a2e1e');
  // Xinjiang International Grand Bazaar Minaret & Turquoise Dome (国际大巴扎观光塔与穹顶) on the east
  box(gp, SAND, 0.18, y0, 0.08, 0.18, 0.068, 0.15);
  ellip(gp, TURQ, 0.18, y0 + 0.085, 0.08, 0.052, 0.045, 0.052);
  cyl(gp, SAND, 0.28, y0, -0.02, 0.028, 0.19, 10);
  cyl(gp, TURQ, 0.28, y0 + 0.16, -0.02, 0.03, 0.022, 10);
  cone(gp, TURQ, 0.28, y0 + 0.19, -0.02, 0.028, 0.036, 10);
};

/** 喀什: Id Kah Mosque Yellow-Brick Portal & Twin Minarets (艾提尕尔清真寺) + tiered Gaotai earthen old city houses. */
const pl_kashgar: Builder = root => {
  const [gp, y0] = site(root, '#d4b884', 0.88);
  const YELLOW = '#dfb864', WHITE = '#f2eee4', GREEN = '#2e7d5b', EARTH = '#c29862';
  // Id Kah Mosque (艾提尕尔清真寺): grand yellow-brick portal screen, pointed Islamic arch & twin cylindrical minarets
  box(gp, YELLOW, -0.06, y0, 0.08, 0.34, 0.085, 0.045);
  box(gp, YELLOW, -0.06, y0, 0.085, 0.13, 0.13, 0.052);
  box(gp, '#3c2e1e', -0.06, y0, 0.11, 0.068, 0.088, 0.01);
  box(gp, WHITE, -0.06, y0 + 0.095, 0.112, 0.085, 0.018, 0.008);
  for (const sx of [-0.13, 0.01]) {
    cyl(gp, YELLOW, sx, y0, 0.1, 0.022, 0.18, 10);
    cyl(gp, WHITE, sx, y0 + 0.18, 0.1, 0.026, 0.018, 10);
    ellip(gp, GREEN, sx, y0 + 0.21, 0.1, 0.022, 0.024, 0.022);
  }
  // Tiered Kashgar Gaotai Earthen Old City Houses (喀什高台民居生土叠层建筑) on the north-east bluff
  tbox(gp, 0.28, 0.22, 0.25, 0.19, 0.055, EARTH, 0.18, y0, -0.14);
  box(gp, shade(EARTH, 1.08), 0.16, y0 + 0.055, -0.14, 0.18, 0.05, 0.14);
  box(gp, shade(EARTH, 0.94), 0.2, y0 + 0.105, -0.15, 0.11, 0.042, 0.095);
};

/** 轮台: Western Regions Protectorate Wulei Fort (西域都护府乌垒城夯土大营), Han Seal Stele & Golden Populus Euphratica. */
const pl_luntai: Builder = root => {
  const [gp, y0] = site(root, '#cba668', 0.88);
  const EARTH = '#b48a4e', RED = '#982a20', TILE = '#4a4e54', POPLAR = '#e2a428';
  // Battered square rammed-earth fortress of the Han Western Regions Protectorate (西域都护府乌垒城城垣与望楼)
  tbox(gp, 0.42, 0.32, 0.38, 0.28, 0.068, EARTH, -0.04, y0, -0.08);
  box(gp, '#cba668', -0.04, y0 + 0.015, -0.08, 0.3, 0.058, 0.2);
  hall(gp, -0.04, y0 + 0.015, -0.1, 0.18, 0.11, 0.052, '#e2d8c2', RED, TILE, 0.042);
  hall(gp, -0.04, y0 + 0.068, 0.06, 0.12, 0.068, 0.036, '#e2d8c2', RED, TILE, 0.03);
  // Golden Tarim Desert Populus euphratica trees (轮台塔里木金色胡杨林) & Han Seal monument
  for (const [x, z] of [[0.24, 0.12], [0.28, -0.04], [-0.28, 0.14]] as [number, number][]) tree(gp, x, y0, z, 0.072, POPLAR);
  box(gp, '#d49e32', -0.14, y0, 0.2, 0.058, 0.052, 0.058);
};

/** 吐鲁番: Emin Minaret (苏公塔), Jiaohe Ancient Earthen City Ruins (交河故城) & crimson Flaming Mountains (火焰山). */
const pl_turpan: Builder = root => {
  const [gp, y0] = site(root, '#d2aa6c', 0.88);
  const FLAME = '#b84226', EARTH = '#ba9258', BRICK = '#c49c62';
  // Crimson pleated ridges of the Flaming Mountains (吐鲁番火焰山赤红沟壑) across the north
  for (let i = -3; i <= 3; i++) cone(gp, i % 2 ? FLAME : '#c8522e', i * 0.095, y0, -0.24, 0.095, 0.17 + (i % 2) * 0.03, 5);
  // Iconic Tapered Circular Patterned-Brick Emin Minaret (苏公塔) & adjacent flat-roofed mosque on the east
  cyl(gp, BRICK, 0.18, y0, 0.06, 0.058, 0.21, 16);
  ellip(gp, BRICK, 0.18, y0 + 0.215, 0.06, 0.036, 0.028, 0.036);
  box(gp, EARTH, 0.04, y0, 0.08, 0.16, 0.062, 0.14);
  // Carved raw-earth monoliths and stupa of Jiaohe Ancient City Ruins (交河故城大佛寺与中央大塔残垣) on the west
  tbox(gp, 0.22, 0.2, 0.19, 0.17, 0.045, EARTH, -0.2, y0, 0.06);
  box(gp, shade(EARTH, 0.92), -0.2, y0 + 0.045, 0.06, 0.065, 0.085, 0.065);
  for (const dx of [-0.27, -0.13]) box(gp, EARTH, dx, y0 + 0.045, 0.06, 0.032, 0.052, 0.12);
};

/** 酒泉: Four-Arch Jiuquan Bell-Drum Tower (酒泉钟鼓楼), Huo Qubing Wine Spring Pavilion (古酒泉亭) & Qilian Snow Peaks. */
const pl_jiuquan: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#6d7178', RED = '#982c22', TILE = '#464c52', GOLD = '#d8a432', WATER = '#347882';
  // Qilian Snow Mountains (祁连雪山) on the southern/northern horizon
  for (const x of [-0.22, 0, 0.22]) {
    cone(gp, '#5e6a74', x, y0, -0.28, 0.14, 0.18, 6);
    cone(gp, '#f2f5f8', x, y0 + 0.11, -0.28, 0.058, 0.075, 6);
  }
  // Iconic Three-Storey Jiuquan Drum Tower on a Four-Directional Arched Brick Base (酒泉钟鼓楼: 东迎华岳、西达伊吾)
  tbox(gp, 0.24, 0.24, 0.2, 0.2, 0.078, BRICK, -0.1, y0, 0.04);
  box(gp, '#241c18', -0.1, y0, 0.04, 0.055, 0.05, 0.245);
  box(gp, '#241c18', -0.1, y0, 0.04, 0.245, 0.05, 0.055);
  const h1 = hall(gp, -0.1, y0 + 0.078, 0.04, 0.16, 0.16, 0.042, '#e4dcc8', RED, TILE, 0.034);
  hall(gp, -0.1, h1 - 0.008, 0.04, 0.11, 0.11, 0.036, '#e4dcc8', RED, GOLD, 0.034);
  // Wine Spring Pool & Tilted Bronze Wine Jar ("霍去病倾酒入泉"古酒泉池与铜酒爵) on the east
  cyl(gp, '#cfc6b4', 0.2, y0, 0.1, 0.095, 0.02, 16);
  cyl(gp, WATER, 0.2, y0 + 0.006, 0.1, 0.075, 0.018, 16);
  cyl(gp, '#8a6c38', 0.2, y0 + 0.055, 0.06, 0.026, 0.058, 10).rotation.x = 0.65;
};

/** 呼和浩特: Dazhao Temple (大召无量寺), Five-Pagoda Vajrasana Stupa (五塔寺金刚座舍利宝塔) & Zhaojun's Green Mound. */
const pl_hohhot: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#cfc6b2', WHITE = '#f2efe8', RED = '#982a20', GOLD = '#dca228';
  // Iconic Five-Pagoda Temple (呼和浩特五塔寺: 金刚座高台托五座密檐方塔) on the west
  tbox(gp, 0.24, 0.24, 0.22, 0.22, 0.075, STONE, -0.14, y0, -0.04);
  box(gp, RED, -0.14, y0, 0.075, 0.065, 0.055, 0.02);
  pagodaOct(gp, -0.14, y0 + 0.075, -0.04, 7, 0.032, 0.018, STONE, '#585c62');
  for (const [dx, dz] of [[-0.21, -0.11], [-0.07, -0.11], [-0.21, 0.03], [-0.07, 0.03]] as [number, number][]) {
    pagodaOct(gp, dx, y0 + 0.075, dz, 5, 0.022, 0.015, STONE, '#585c62');
  }
  // Dazhao Temple Silver Buddha Hall & White Lama Stupa (大召寺与白塔) on the east
  hall(gp, 0.18, y0, -0.12, 0.2, 0.13, 0.052, RED, GOLD, GOLD, 0.042);
  box(gp, WHITE, 0.18, y0, 0.12, 0.07, 0.032, 0.07);
  ellip(gp, WHITE, 0.18, y0 + 0.065, 0.12, 0.03, 0.036, 0.03);
  cone(gp, GOLD, 0.18, y0 + 0.098, 0.12, 0.014, 0.042, 8);
};

/** 哈尔滨: Saint Sophia Cathedral (圣索菲亚大教堂) — red-brick Byzantine church with giant dark-green onion dome. */
const pl_harbin: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#9e4432', STONE = '#dfd8c8', GREEN = '#2d6a58', GOLD = '#dca834';
  // Cruciform red-brick Byzantine church body
  box(gp, BRICK, 0, y0, -0.02, 0.34, 0.095, 0.22);
  box(gp, BRICK, 0, y0, -0.02, 0.22, 0.095, 0.34);
  // White stone arched arcade bands & front bell-tower porch
  box(gp, STONE, 0, y0 + 0.048, -0.02, 0.35, 0.01, 0.23);
  box(gp, BRICK, 0, y0, 0.18, 0.11, 0.15, 0.1);
  cone(gp, GREEN, 0, y0 + 0.15, 0.18, 0.058, 0.075, 8);
  // Central cylindrical drum & giant dark-green Byzantine Onion Dome (巨型绿色洋葱头穹顶)
  cyl(gp, BRICK, 0, y0 + 0.095, -0.02, 0.095, 0.055, 16);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(gp, STONE, Math.cos(a) * 0.095, y0 + 0.105, -0.02 + Math.sin(a) * 0.095, 0.008, 0.036, 0.008);
  }
  ellip(gp, GREEN, 0, y0 + 0.195, -0.02, 0.115, 0.078, 0.115);
  cone(gp, GREEN, 0, y0 + 0.25, -0.02, 0.048, 0.055, 12);
  cyl(gp, GOLD, 0, y0 + 0.305, -0.02, 0.004, 0.038, 6);
  // Four corner turret onion domes
  for (const [sx, sz] of [[-0.13, -0.11], [0.13, -0.11], [-0.13, 0.08], [0.13, 0.08]] as [number, number][]) {
    cyl(gp, BRICK, sx, y0 + 0.095, sz, 0.028, 0.042, 10);
    ellip(gp, GREEN, sx, y0 + 0.152, sz, 0.032, 0.028, 0.032);
  }
};

/** 长春: Puppet Manchukuo Palace Tongde Hall (伪满皇宫同德殿黄琉璃瓦与缉熙楼) & Changchun Film Studio colonnade. */
const pl_changchun: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#b89e78', GOLD = '#d69e28', GREY = '#686e74', WHITE = '#ece6d8';
  // Tongde Hall (同德殿): two-storey buff-brick eclectic palace with hip-and-gable yellow-glazed roof & porte-cochere
  box(gp, BRICK, -0.06, y0, -0.1, 0.34, 0.095, 0.18);
  gable(gp, 0.38, 0.062, 0.22, GOLD, -0.06, y0 + 0.095, -0.1);
  box(gp, BRICK, 0.08, y0, -0.1, 0.09, 0.135, 0.09);
  gable(gp, 0.11, 0.038, 0.11, GOLD, 0.08, y0 + 0.135, -0.1);
  box(gp, WHITE, -0.08, y0, 0.02, 0.12, 0.055, 0.075);
  // Changchun Film Studio Neoclassical Portico (长影旧址主楼廊柱) & pine trees in front
  box(gp, WHITE, 0.06, y0, 0.16, 0.24, 0.068, 0.11);
  for (let i = -2; i <= 2; i++) cyl(gp, WHITE, 0.06 + i * 0.042, y0, 0.22, 0.005, 0.068, 6);
  gable(gp, 0.25, 0.028, 0.12, GREY, 0.06, y0 + 0.068, 0.16);
  tree(gp, -0.26, y0, 0.18, 0.068, '#3e623c');
};

/** 大连: Lushun Baiyushan Candle Tower (旅顺白玉山塔), Tiger-Tail Naval Harbour Entrance & Zhongshan Square Dome. */
const pl_dalian: Builder = root => {
  const [gp, y0] = site(root, '#24586c', 0.88);
  const MTN = '#4a6e46', WHITE = '#f0ece2', GREEN = '#2f725c', BRICK = '#a64c38';
  // Lushun Baiyushan Hill (旅顺白玉山) on the west crowned by the candle-shaped Baiyushan Tower (白玉山塔)
  cone(gp, MTN, -0.18, y0, -0.1, 0.19, 0.13, 8);
  box(gp, WHITE, -0.18, y0 + 0.125, -0.1, 0.055, 0.024, 0.055);
  cyl(gp, WHITE, -0.18, y0 + 0.149, -0.1, 0.018, 0.12, 10);
  cyl(gp, '#585c64', -0.18, y0 + 0.265, -0.1, 0.024, 0.014, 10);
  cone(gp, '#d8a432', -0.18, y0 + 0.279, -0.1, 0.014, 0.028, 8);
  // Dalian Zhongshan Square European Renaissance Building & Harbor Pier on the east shore
  prism(gp, [[0.04, -0.34], [0.38, -0.34], [0.38, 0.22], [0.08, 0.18]], y0, 0.02, '#c8bfa8');
  box(gp, BRICK, 0.22, y0 + 0.02, -0.08, 0.2, 0.075, 0.15);
  box(gp, WHITE, 0.22, y0 + 0.02, -0.002, 0.08, 0.08, 0.02);
  ellip(gp, GREEN, 0.22, y0 + 0.115, -0.08, 0.048, 0.042, 0.048);
};

/** 台南: Chihkan Tower / Fort Provintia (台南赤嵌楼: 红砖荷兰棱堡城台与海神庙、文昌阁双重檐楼阁) & 9 Bixi Stone Tortoises. */
const pl_tainan: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#b44430', RED = '#9c2820', GOLD = '#dca228', STONE = '#cfc6b4';
  // Red-brick Dutch-Qing Fort Provintia Bastion Platform (赤嵌楼红毛城砖砌高台)
  tbox(gp, 0.48, 0.28, 0.44, 0.25, 0.062, BRICK, 0, y0, -0.06);
  // Twin Double-Eaved Minnan Pavilions: Haishen Temple (海神庙) & Wenchang Pavilion (文昌阁) side by side
  for (const sx of [-0.12, 0.12]) {
    const h1 = hall(gp, sx, y0 + 0.062, -0.06, 0.17, 0.14, 0.042, '#f0eae0', RED, GOLD, 0.032);
    hall(gp, sx, h1 - 0.008, -0.06, 0.13, 0.11, 0.034, RED, GOLD, BRICK, 0.032);
  }
  // Row of Nine Royal Bixi Stone Tortoise Steles (九座御碑赑屃石龟) at the south foot of the bastion
  for (let i = -4; i <= 4; i++) {
    const bx = i * 0.045;
    ellip(gp, STONE, bx, y0 + 0.008, 0.14, 0.012, 0.008, 0.018);
    box(gp, '#e2dac8', bx, y0 + 0.012, 0.14, 0.018, 0.038, 0.006);
  }
};

/** 香港: Victoria Harbour Skyline (中银大厦棱柱天际线与国金中心), Golden Bauhinia & three-masted red-sail Dukling junk. */
const pl_hongkong: Builder = root => {
  const [gp, y0] = site(root, '#1e586e', 0.88);
  const GLASS = '#6898b4', SILVER = '#d8e0e8', RED = '#b82820';
  // Hong Kong Island waterfront promenade along the north side
  band(gp, -0.4, -0.04, y0, 0.018, '#b8b2a4');
  // Iconic I.M. Pei Bank of China Tower (中银大厦几何三角棱柱切面摩天楼) & IFC Two
  box(gp, GLASS, -0.14, y0 + 0.018, -0.18, 0.095, 0.18, 0.095);
  cone(gp, GLASS, -0.14, y0 + 0.198, -0.18, 0.068, 0.11, 4, Math.PI / 4);
  for (const dx of [-0.018, 0.018]) cyl(gp, SILVER, -0.14 + dx, y0 + 0.28, -0.18, 0.0025, 0.065, 4);
  // IFC Tower (国际金融中心二期) & convention centre curve
  box(gp, '#7aa4bc', 0.08, y0 + 0.018, -0.2, 0.09, 0.27, 0.09);
  box(gp, SILVER, 0.08, y0 + 0.288, -0.2, 0.075, 0.028, 0.075);
  ellip(gp, SILVER, -0.02, y0 + 0.032, -0.08, 0.065, 0.024, 0.038);
  // Iconic Three-Masted Red-Sail Hong Kong Junk (维多利亚港张保仔红帆船) in the foreground harbour
  rbox(gp, '#583820', 0.04, y0 + 0.008, 0.16, 0.19, 0.024, 0.052, 0.008);
  for (const [dx, h] of [[-0.055, 0.085], [0, 0.11], [0.055, 0.075]] as [number, number][]) {
    cyl(gp, '#4a2e18', 0.04 + dx, y0 + 0.032, 0.16, 0.003, h, 5);
    cone(gp, RED, 0.04 + dx, y0 + 0.042, 0.16, 0.028, h * 0.8, 3);
  }
};

/** 澳门: Ruins of St. Paul's 4-Tiered Granite Baroque Facade (大三巴牌坊), 68 Stone Steps & Guia Lighthouse. */
const pl_macao: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#c8c0b0', DARK = '#2a2826', WHITE = '#f4f0e6', GOLD = '#d8a22e';
  // Grand 68-step granite staircase rising to the plaza of St. Paul's (大三巴六十八级石阶)
  for (let i = 0; i < 6; i++) {
    box(gp, i % 2 ? STONE : shade(STONE, 0.94), -0.06, y0, 0.26 - i * 0.045, 0.32 - i * 0.012, 0.012 * (i + 1), 0.048);
  }
  // Iconic Four-Tiered Freestanding Baroque Stone Facade of St. Paul's (大三巴牌坊四层花岗岩立面与三角山花)
  const fz = -0.04, fy = y0 + 0.072;
  box(gp, STONE, -0.06, fy, fz, 0.28, 0.065, 0.028);
  for (const dx of [-0.14, -0.06, 0.02]) box(gp, DARK, dx, fy, fz + 0.01, 0.036, 0.048, 0.012);
  box(gp, STONE, -0.06, fy + 0.065, fz, 0.21, 0.058, 0.026);
  for (const dx of [-0.12, -0.06, 0.0]) box(gp, DARK, dx, fy + 0.075, fz + 0.01, 0.024, 0.036, 0.01);
  box(gp, STONE, -0.06, fy + 0.123, fz, 0.13, 0.045, 0.024);
  gable(gp, 0.12, 0.036, 0.026, STONE, -0.06, fy + 0.168, fz);
  cyl(gp, GOLD, -0.06, fy + 0.204, fz, 0.003, 0.028, 5);
  // Guia Fortress & White Lighthouse (东望洋炮台灯塔) on the east hill
  cone(gp, '#4e7246', 0.24, y0, -0.14, 0.12, 0.1, 7);
  cyl(gp, WHITE, 0.24, y0 + 0.095, -0.14, 0.024, 0.095, 10);
  ellip(gp, GOLD, 0.24, y0 + 0.198, -0.14, 0.026, 0.02, 0.026);
};

/** 海口: Haikou Qilou Nanyang Arcade Shophouses (海口骑楼老街雕花山花廊柱), Wugong Temple & Coconut Palms. */
const pl_haikou: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const CREAM = '#efe8d6', WHITE = '#f8f5ee', RED = '#a22c22', PALM = '#3b7c42';
  // Row of four Nanyang Qilou Arcade Shophouses (海口骑楼老街南洋廊柱与巴洛克山花立面)
  for (let i = 0; i < 4; i++) {
    const x = -0.22 + i * 0.11, c = i % 2 ? CREAM : WHITE, h = 0.115 + (i % 2) * 0.015;
    box(gp, c, x, y0 + 0.042, -0.08, 0.102, h - 0.042, 0.16);
    box(gp, c, x, y0, -0.11, 0.1, 0.042, 0.1);
    for (const sx of [-0.042, 0.042]) cyl(gp, WHITE, x + sx, y0, -0.005, 0.005, 0.042, 6);
    // Ornate curved Nanyang parapet gable on top
    cyl(grp(gp, x, -0.002, 0, y0 + h), c, 0, 0, 0, 0.036, 0.016, 10).rotation.x = Math.PI / 2;
    for (const fy of [0.058, 0.088]) box(gp, '#3e5260', x, y0 + fy, 0.002, 0.055, 0.02, 0.006);
  }
  // Wugong Temple "First Building of Hainan" (五公祠海南第一楼红墙重檐) on the east & coconut palms
  hall(gp, 0.24, y0, 0.08, 0.14, 0.11, 0.052, RED, RED, '#d89e28', 0.042);
  for (const x of [-0.26, -0.08, 0.08]) tree(gp, x, y0, 0.2, 0.072, PALM);
};

/** 泰安: Dai Temple Tiankuang Hall (泰安岱庙天贶殿九开间重檐庑殿黄琉璃瓦、正阳门与汉柏) — distinct from Mount Tai! */
const pl_taian: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const MARBLE = '#e8e2d4', RED = '#9e2820', GOLD = '#dca228', BRICK = '#6d7178';
  // Battered crenellated Dai Temple Zhengyang Gate (岱庙正阳门与五凤楼) across the south
  tbox(gp, 0.48, 0.1, 0.44, 0.085, 0.062, BRICK, 0, y0, 0.18);
  box(gp, '#261c18', 0, y0, 0.18, 0.052, 0.045, 0.11);
  hall(gp, 0, y0 + 0.062, 0.18, 0.18, 0.075, 0.038, RED, RED, GOLD, 0.034);
  // Grand Nine-Bay Double-Eaved Tiankuang Hall (岱庙天贶殿: 中国三大宫殿式建筑之一) on white stone露台 at north
  tbox(gp, 0.52, 0.24, 0.48, 0.21, 0.04, MARBLE, 0, y0, -0.14);
  box(gp, MARBLE, 0, y0, 0.0, 0.09, 0.036, 0.07);
  box(gp, RED, 0, y0 + 0.04, -0.14, 0.4, 0.065, 0.15);
  gable(gp, 0.46, 0.034, 0.2, GOLD, 0, y0 + 0.092, -0.14);
  box(gp, RED, 0, y0 + 0.118, -0.14, 0.34, 0.032, 0.12);
  gable(gp, 0.4, 0.048, 0.17, GOLD, 0, y0 + 0.148, -0.14);
  // Ancient Two-Millennium Han Cypresses (汉柏院古柏) in the courtyard
  for (const sx of [-0.22, 0.22]) tree(gp, sx, y0, 0.03, 0.075, '#345834');
};

// ============================================================================
// 2. FOREIGN / SILK ROAD / MARITIME NEIGHBOR CITIES (9 CITIES)
// ============================================================================

/** 平壤: Daedong Gate (平壤大同门花岗岩城台与重檐门楼) overlooking the Taedong River & Ryongwang Pavilion (练光亭). */
const pl_pyongyang: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#84868c', RED = '#942c24', TILE = '#3d444c', WATER = '#2c6674';
  band(gp, 0.16, 0.36, y0, 0.006, WATER);
  // Daedong Gate (平壤内城东门大同门): battered granite gate bastion with arched portal & two-storey Korean hip-and-gable pavilion
  tbox(gp, 0.34, 0.18, 0.3, 0.15, 0.078, STONE, -0.08, y0, -0.02);
  box(gp, '#22201e', -0.08, y0, -0.02, 0.065, 0.055, 0.19);
  const h1 = hall(gp, -0.08, y0 + 0.078, -0.02, 0.24, 0.12, 0.042, '#e4dcc8', RED, TILE, 0.034);
  hall(gp, -0.08, h1 - 0.008, -0.02, 0.18, 0.095, 0.036, '#e4dcc8', RED, TILE, 0.034);
  // Ryongwang Pavilion (大同江畔德岩绝壁练光亭) on cliff rock to the east
  tbox(gp, 0.18, 0.16, 0.16, 0.14, 0.06, '#6e6a62', 0.22, y0, 0.04);
  hall(gp, 0.22, y0 + 0.06, 0.04, 0.13, 0.11, 0.04, '#e4dcc8', '#3c6e58', TILE, 0.034);
};

/** 雅克萨: Albazin Wooden Cossack Ostrog Stockade (俄军木制棱堡城寨) on Heilongjiang bluff & Qing siege cannon/warship. */
const pl_albazin: Builder = root => {
  const [gp, y0] = site(root, '#5e7248', 0.88);
  const LOG = '#6a4828', ROOF = '#4a321c', WATER = '#2c5e6c', GOLD = '#d8a432';
  band(gp, 0.08, 0.32, y0, 0.006, WATER);
  // Timber log palisade & tented corner watchtowers of Albazin Ostrog (雅克萨木制棱堡城寨) on the north bank
  box(gp, LOG, 0, y0, -0.14, 0.38, 0.065, 0.18);
  for (const sx of [-0.19, 0.19]) for (const sz of [-0.23, -0.05]) {
    box(gp, shade(LOG, 0.9), sx, y0, sz, 0.068, 0.11, 0.068);
    cone(gp, ROOF, sx, y0 + 0.11, sz, 0.058, 0.068, 4, Math.PI / 4);
  }
  // Qing Heilongjiang naval river warship & bronze siege cannon ("神威无敌大将军炮") on the south shore
  rbox(gp, '#54361e', -0.1, y0 + 0.008, 0.18, 0.18, 0.024, 0.052, 0.008);
  box(gp, GOLD, -0.1, y0 + 0.06, 0.18, 0.048, 0.036, 0.004);
  cyl(gp, '#9e7c34', 0.16, y0 + 0.024, 0.32, 0.012, 0.075, 8).rotation.x = Math.PI / 2 + 0.2;
};

/** 尼布楚: 1689 Treaty of Nerchinsk Negotiation Pavilions (中俄议和行辕帐殿) & Trilingual Boundary Stele (尼布楚界碑). */
const pl_nerchinsk: Builder = root => {
  const [gp, y0] = site(root, '#6c7e50', 0.88);
  const GOLD = '#dca834', RED = '#9e2820', WHITE = '#f0ece2', LOG = '#6b4828';
  // Qing Imperial Yellow Negotiation Tent (清朝钦差索额图议和黄幄大帐) on the west
  cyl(gp, GOLD, -0.16, y0, -0.04, 0.11, 0.052, 12);
  cone(gp, RED, -0.16, y0 + 0.052, -0.04, 0.125, 0.058, 12);
  // Russian Envoy Tent & timber stockade gate on the east
  cone(gp, WHITE, 0.18, y0, -0.06, 0.1, 0.11, 8);
  box(gp, LOG, 0.22, y0, -0.22, 0.068, 0.11, 0.068);
  cone(gp, '#4a321c', 0.22, y0 + 0.11, -0.22, 0.055, 0.06, 4, Math.PI / 4);
  // Iconic Trilingual Sino-Russian Nerchinsk Boundary Stone Stele (满俄拉丁文尼布楚条约界碑) at front-center
  tbox(gp, 0.12, 0.09, 0.1, 0.075, 0.028, '#b8b09e', 0, y0, 0.16);
  box(gp, '#dcd4c2', 0, y0 + 0.028, 0.16, 0.068, 0.13, 0.024);
  cyl(grp(gp, 0, 0.16, 0, y0 + 0.158), '#dcd4c2', 0, 0, 0, 0.034, 0.024, 10).rotation.x = Math.PI / 2;
};

/** 海参崴: Golden Horn Bay Port (金角湾海港), Tokarevsky Spit Lighthouse (托卡内夫灯塔) & Ming Yongmingcheng Stele. */
const pl_vladivostok: Builder = root => {
  const [gp, y0] = site(root, '#22586e', 0.88);
  const WHITE = '#f4f2ec', RED = '#b82820', STONE = '#c4bca8';
  // Golden Horn Bay headland & gravel spit (エgersheld / 托卡内夫沙嘴) extending into the sea
  prism(gp, [[-0.4, -0.36], [0.22, -0.36], [0.18, -0.06], [-0.4, -0.02]], y0, 0.038, '#5c7250');
  box(gp, STONE, 0.06, y0 + 0.004, 0.08, 0.045, 0.014, 0.28);
  // Iconic Red-Roofed White Tokarevsky Lighthouse (海参崴灯塔) at the tip of the spit
  cyl(gp, STONE, 0.06, y0 + 0.004, 0.22, 0.048, 0.024, 12);
  cyl(gp, WHITE, 0.06, y0 + 0.028, 0.22, 0.026, 0.11, 10);
  cone(gp, RED, 0.06, y0 + 0.138, 0.22, 0.032, 0.038, 10);
  // Port terminal building & Ming-Qing Yongmingcheng Stone Tablet (永明城历史石碑) on the northwest bluff
  hall(gp, -0.16, y0 + 0.038, -0.18, 0.2, 0.11, 0.052, WHITE, '#546878', '#3c6e5c', 0.038);
  box(gp, '#d8d0be', -0.28, y0 + 0.038, 0.06, 0.048, 0.085, 0.018);
};

/** 怛罗斯: Talas River Circular Mud-Brick Citadel (怛罗斯石城), Tang vs Abbasid banners & Papermaking Workshop (造纸西传). */
const pl_talas: Builder = root => {
  const [gp, y0] = site(root, '#c6a46c', 0.88);
  const EARTH = '#b48c52', WATER = '#36747e', PAPER = '#f6f2e8', WD = '#6b4826';
  band(gp, 0.04, 0.2, y0, 0.006, WATER);
  // Central Asian Circular Corrugated Mud-Brick Citadel of Talas (怛罗斯河谷圆城与敌台) at north-west
  cyl(gp, EARTH, -0.14, y0, -0.14, 0.16, 0.085, 16);
  cyl(gp, '#c6a46c', -0.14, y0 + 0.02, -0.14, 0.11, 0.07, 16);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cyl(gp, shade(EARTH, 0.92), -0.14 + Math.cos(a) * 0.155, y0, -0.14 + Math.sin(a) * 0.155, 0.028, 0.095, 8);
  }
  // Tang Craftsman Papermaking Vat & Drying Screens on the south-east riverbank (751年唐匠造纸西传坊)
  hall(gp, 0.16, y0, -0.12, 0.16, 0.11, 0.045, '#dfd4bc', WD, '#7a6240', 0.036);
  box(gp, WD, 0.14, y0, 0.26, 0.085, 0.028, 0.065);
  box(gp, '#8ab4bc', 0.14, y0 + 0.01, 0.26, 0.068, 0.022, 0.048);
  for (const dx of [-0.14, -0.02]) {
    box(gp, WD, dx, y0 + 0.035, 0.27, 0.075, 0.065, 0.008).rotation.x = -0.25;
    box(gp, PAPER, dx, y0 + 0.036, 0.273, 0.062, 0.052, 0.006).rotation.x = -0.25;
  }
};

/** 撒马尔罕: Registan Square Madrasah Portal (雷吉斯坦广场高拱门), Ribbed Turquoise Dome & Twin Patterned Minarets. */
const pl_samarkand: Builder = root => {
  const [gp, y0] = site(root, '#d8c094', 0.88);
  const SAND = '#d4b278', TURQ = '#1d8a9c', BLUE = '#1e4e7a', GOLD = '#dca834';
  // Monumental Pishtaq Portal Iwan of Samarkand Registan (雷吉斯坦经学院巨型尖拱门廊)
  box(gp, SAND, 0, y0, -0.04, 0.38, 0.095, 0.18);
  box(gp, BLUE, 0, y0, 0.02, 0.18, 0.165, 0.08);
  box(gp, SAND, 0, y0, 0.022, 0.15, 0.145, 0.082);
  box(gp, '#223244', 0, y0, 0.055, 0.088, 0.11, 0.025);
  // Ribbed Timurid Turquoise Melon Dome (撒马尔罕帖木儿蓝釉棱纹穹顶) rising behind the wing
  cyl(gp, BLUE, -0.12, y0 + 0.095, -0.06, 0.062, 0.038, 14);
  ellip(gp, TURQ, -0.12, y0 + 0.165, -0.06, 0.072, 0.058, 0.072);
  cone(gp, GOLD, -0.12, y0 + 0.22, -0.06, 0.008, 0.028, 6);
  // Twin Tall Mosaic-Banded Minarets flanking the plaza
  for (const sx of [-0.21, 0.21]) {
    cyl(gp, SAND, sx, y0, 0.04, 0.028, 0.21, 12);
    for (const h of [0.06, 0.12, 0.18]) cyl(gp, TURQ, sx, y0 + h, 0.04, 0.03, 0.012, 12);
    cyl(gp, BLUE, sx, y0 + 0.21, 0.04, 0.034, 0.02, 12);
  }
};

/** 古里: Calicut Malabar Spice Coast Port (古里西洋香料港), Zheng He's 1407 Memorial Pavilion (古里碑亭) & Indian Dhow. */
const pl_calicut: Builder = root => {
  const [gp, y0] = site(root, '#225e74', 0.88);
  const SAND = '#dec89a', RED = '#9c3224', GOLD = '#dca228', WD = '#5e3c20', PALM = '#387a40';
  // Malabar Coast sandy headland & stone spice-trade jetty (古里国海岸与香料码头)
  prism(gp, [[-0.4, -0.36], [0.38, -0.36], [0.34, 0.04], [-0.4, 0.08]], y0, 0.028, SAND);
  box(gp, '#a89e8c', -0.04, y0 + 0.006, 0.14, 0.075, 0.018, 0.18);
  // Traditional Kerala Sloped-Roof Zamorin Palace Hall on the northwest & Zheng He's 1407 Stele Pavilion (郑和古里碑亭) on the east
  const h1 = hall(gp, -0.16, y0 + 0.028, -0.16, 0.22, 0.13, 0.042, '#f0e8d8', WD, '#8c3c28', 0.045);
  hall(gp, -0.16, h1 - 0.01, -0.16, 0.15, 0.09, 0.032, '#f0e8d8', WD, '#8c3c28', 0.038);
  hall(gp, 0.18, y0 + 0.028, -0.1, 0.11, 0.11, 0.048, RED, RED, GOLD, 0.042);
  box(gp, '#dcd4c2', 0.18, y0 + 0.028, -0.1, 0.036, 0.042, 0.014);
  // Malabar / Arab Lateen-Sailed Spice Dhow (西洋三角帆商船) at the jetty
  rbox(gp, WD, 0.14, y0 + 0.008, 0.2, 0.17, 0.024, 0.052, 0.008);
  cyl(gp, WD, 0.14, y0 + 0.032, 0.2, 0.0035, 0.1, 5);
  cone(gp, '#f4eee0', 0.14, y0 + 0.045, 0.2, 0.042, 0.085, 3);
  tree(gp, -0.3, y0 + 0.028, -0.02, 0.072, PALM);
};

/** 满剌加: Malacca Strait Port, Sultan's Tiered Palace (满剌加王宫), Zheng He Guanchang Depot (官厂) & Bukit Cina (三保山). */
const pl_malacca: Builder = root => {
  const [gp, y0] = site(root, '#246274', 0.88);
  const WD = '#6b4424', TH = '#7e5834', RED = '#a22c22', MTN = '#467442';
  // Malacca coastal plain & green Bukit Cina hill (三保山与三保井) at north-east
  prism(gp, [[-0.4, -0.36], [0.4, -0.36], [0.38, 0.04], [-0.4, 0.04]], y0, 0.024, '#c8b488');
  cone(gp, MTN, 0.22, y0 + 0.024, -0.18, 0.14, 0.13, 7);
  cyl(gp, '#dcd4c2', 0.22, y0 + 0.024, -0.02, 0.028, 0.018, 8);
  // Malacca Sultanate Multi-Tiered Timber Palace (满剌加苏丹王宫层叠坡顶木殿) on stilts
  const h1 = hall(gp, -0.14, y0 + 0.024, -0.16, 0.24, 0.12, 0.044, WD, WD, TH, 0.042);
  hall(gp, -0.14, h1 - 0.008, -0.16, 0.15, 0.085, 0.034, WD, WD, TH, 0.038);
  // Ming Treasure Fleet Stockade Depot (郑和满剌加官厂仓库) & Treasure Ship in the Strait of Malacca
  hall(gp, -0.24, y0 + 0.024, -0.02, 0.11, 0.08, 0.038, '#e6dec8', RED, '#484e54', 0.03);
  rbox(gp, '#5c381e', 0.04, y0 + 0.01, 0.2, 0.22, 0.028, 0.065, 0.01);
  for (const dx of [-0.05, 0.01, 0.07]) {
    cyl(gp, '#462c16', 0.04 + dx, y0 + 0.038, 0.2, 0.0035, 0.1, 5);
    box(gp, RED, 0.04 + dx + 0.005, y0 + 0.055, 0.2, 0.004, 0.062, 0.048);
  }
};

/** 河内: Thăng Long Imperial Citadel Doan Mon Gate (河内升龙皇城端门五券黄墙) & One Pillar Pagoda (独柱寺莲花水榭). */
const pl_hanoi: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const YELLOW = '#dfb44c', RED = '#9c2820', TILE = '#8e3828', WATER = '#347278', STONE = '#cfc6b4';
  // Thăng Long Imperial Citadel Doan Mon Gate (升龙皇城端门: 黄色城垣、五道拱门与双层歇山望楼) at north
  tbox(gp, 0.46, 0.14, 0.42, 0.12, 0.068, YELLOW, -0.04, y0, -0.14);
  for (const dx of [-0.16, -0.1, -0.04, 0.02, 0.08]) box(gp, '#322018', dx, y0, -0.078, 0.032, 0.042, 0.012);
  hall(gp, -0.04, y0 + 0.068, -0.14, 0.18, 0.095, 0.038, YELLOW, RED, TILE, 0.034);
  // Iconic One Pillar Pagoda (河内独柱寺: 方形莲花池中独石柱托起木构莲花阁) in the front courtyard
  box(gp, STONE, 0.06, y0, 0.14, 0.22, 0.02, 0.22);
  box(gp, WATER, 0.06, y0 + 0.006, 0.14, 0.18, 0.016, 0.18);
  cyl(gp, STONE, 0.06, y0 + 0.016, 0.14, 0.022, 0.068, 10);
  for (const sx of [-0.018, 0.018]) rod(gp, [0.06 + sx, y0 + 0.032, 0.14], [0.06 + sx * 2.2, y0 + 0.082, 0.14], 0.004, '#5a3a22', 4);
  hall(gp, 0.06, y0 + 0.082, 0.14, 0.11, 0.11, 0.038, '#5a3a22', RED, TILE, 0.038);
};

// ============================================================================
// 5. DEDICATED CITY LANDMARKS FOR CAPITALS & MAJOR METROPOLISES (23 CITIES)
// ============================================================================

/** 西安: Xi'an Bell Tower (西安钟楼四角攒尖重檐三滴水) & Ming City Wall Yongning Gate Barbican (永宁门箭楼). */
const pl_xian: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#686c74', RED = '#9c2a20', TILE = '#366852', GOLD = '#dca428';
  // Xi'an Bell Tower on High Square Brick Base with 4 Arched Portals (西安钟楼四券洞青砖基座与重檐三滴水攒尖顶)
  tbox(gp, 0.28, 0.28, 0.25, 0.25, 0.072, BRICK, 0, y0, -0.08);
  for (const [dx, dz, w, d] of [[0, 0.125, 0.055, 0.02], [0, -0.125, 0.055, 0.02], [0.125, 0, 0.02, 0.055], [-0.125, 0, 0.02, 0.055]] as [number, number, number, number][]) {
    box(gp, '#221a16', dx, y0, -0.08 + dz, w, 0.048, d);
  }
  const h1 = hall(gp, 0, y0 + 0.072, -0.08, 0.2, 0.2, 0.045, '#e8e0d0', RED, TILE, 0.034);
  const h2 = hall(gp, 0, h1 - 0.01, -0.08, 0.15, 0.15, 0.038, '#e8e0d0', RED, TILE, 0.036);
  cone(gp, GOLD, 0, h2 - 0.004, -0.08, 0.024, 0.042, 8);
  // Yongning South Gate Crenellated Rampart & Watchtower in Foreground (西安明城墙南门箭楼)
  tbox(gp, 0.48, 0.09, 0.44, 0.078, 0.058, BRICK, 0, y0, 0.2);
  box(gp, '#221a16', 0, y0, 0.2, 0.052, 0.042, 0.095);
  hall(gp, 0, y0 + 0.058, 0.2, 0.22, 0.072, 0.036, RED, RED, '#464c52', 0.03);
};

/** 咸阳: Ancient Wei River Ferry Covered Bridge (咸阳古渡廊桥) & High-Terrace Qingwei Tower (清渭楼秦汉高台). */
const pl_xianyang: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a68858', RED = '#982820', TILE = '#3e4248', WATER = '#346c76';
  band(gp, 0.08, 0.28, y0, 0.006, WATER);
  // Monumental Qin-Han High-Terrace Qingwei Tower on Northern Bank (咸阳清渭楼层台累榭)
  tbox(gp, 0.44, 0.22, 0.38, 0.18, 0.068, EARTH, 0, y0, -0.16);
  const h1 = hall(gp, 0, y0 + 0.068, -0.16, 0.28, 0.14, 0.046, '#e2dac6', RED, TILE, 0.038);
  hall(gp, 0, h1 - 0.008, -0.16, 0.19, 0.1, 0.038, '#e2dac6', RED, TILE, 0.034);
  for (const sx of [-0.18, 0.18]) hall(gp, sx, y0 + 0.068, -0.12, 0.08, 0.08, 0.036, '#e2dac6', RED, TILE, 0.03);
  // Xianyang Ancient Ferry Timber-Piling Bridge & Ferry Boat across the Wei River (咸阳古渡木桩桥与渡船)
  for (let i = -2; i <= 2; i++) cyl(gp, '#543820', -0.06, y0, 0.08 + i * 0.045, 0.008, 0.028, 6);
  box(gp, '#7c5834', -0.06, y0 + 0.024, 0.18, 0.072, 0.012, 0.24);
  rbox(gp, '#5c3c22', 0.16, y0 + 0.008, 0.18, 0.14, 0.02, 0.045, 0.006);
};

/** 洛阳: Lijing Gate Double-Barbican Fortress (洛阳丽景门瓮城箭楼) & Luo River Tianjin Stone Bridge (洛水天津桥). */
const pl_luoyang: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#6c7078', RED = '#9e2820', TILE = '#42484e', WATER = '#36707a', STONE = '#cfc6b4';
  band(gp, 0.14, 0.3, y0, 0.006, WATER);
  // Lijing Gate Semicircular Barbican & Twin Gate Towers (洛阳老城丽景门城楼、瓮城与箭楼)
  tbox(gp, 0.46, 0.15, 0.42, 0.13, 0.072, BRICK, 0, y0, -0.16);
  cyl(gp, BRICK, 0, y0, -0.05, 0.16, 0.062, 14);
  cyl(gp, SITE.paving, 0, y0 + 0.01, -0.05, 0.11, 0.055, 14);
  box(gp, '#221a16', 0, y0, 0.06, 0.052, 0.045, 0.08);
  const h1 = hall(gp, 0, y0 + 0.072, -0.16, 0.24, 0.11, 0.044, '#e6dec8', RED, TILE, 0.036);
  hall(gp, 0, h1 - 0.008, -0.16, 0.17, 0.085, 0.034, '#e6dec8', RED, TILE, 0.032);
  hall(gp, 0, y0 + 0.062, 0.04, 0.15, 0.075, 0.036, '#e6dec8', RED, TILE, 0.03);
  // Multi-Arch Tianjin Stone Bridge across the Luo River (天津晓月石拱桥)
  box(gp, STONE, 0, y0 + 0.006, 0.22, 0.08, 0.024, 0.2);
};

/** 开封: Iron Pagoda of Kaibao Monastery (开封铁塔十三层褐色琉璃砖塔) & Bian River Rainbow Bridge (汴水虹桥). */
const pl_kaifeng: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const IRON_GLAZE = '#5a3e2e', EAVE = '#3d5e48', WD = '#7a4e2c', WATER = '#367078';
  band(gp, 0.1, 0.28, y0, 0.006, WATER);
  // Iconic 13-Tier Octagonal Glazed-Brick "Iron Pagoda" (开封铁塔天下第一塔) at north-west
  box(gp, '#cfc6b4', -0.14, y0, -0.12, 0.15, 0.025, 0.15);
  pagodaOct(gp, -0.14, y0 + 0.025, -0.12, 9, 0.052, 0.024, IRON_GLAZE, EAVE);
  // Song Dynasty Timber Woven-Arch Rainbow Bridge across the Bian River & Bianjing Gate Pavilion (清明上河汴河虹桥与接引殿)
  hall(gp, 0.16, y0, -0.12, 0.19, 0.12, 0.046, '#e6dec8', '#982c22', '#3c6e54', 0.04);
  for (let i = -2; i <= 2; i++) {
    const t = i / 2, y = y0 + 0.026 + (1 - t * t) * 0.028;
    box(gp, WD, 0.06, y, 0.19 + t * 0.09, 0.095, 0.012, 0.052);
  }
  rbox(gp, '#54361e', -0.16, y0 + 0.008, 0.19, 0.15, 0.022, 0.046, 0.006);
};

/** 杭州: Liuhe Pagoda on Yuelun Hill (钱塘江畔六和塔七明六暗十三层重檐) & Qiantang Stone Sea-Wall (钱塘江鱼鳞石塘). */
const pl_hangzhou: Builder = root => {
  const [gp, y0] = site(root, '#4c7246', 0.88);
  const RED = '#8c2c22', TILE = '#3d4248', WHITE = '#f0ece2', WATER = '#2c6876', STONE = '#b8b09e';
  band(gp, 0.14, 0.34, y0, 0.006, WATER);
  // Qiantang River Fish-Scale Stone Seawall (钱塘江鱼鳞石塘)
  tbox(gp, 0.72, 0.06, 0.68, 0.045, 0.032, STONE, 0, y0, 0.11);
  // Towering Octagonal Timber-Eaved Liuhe Pagoda (六和听涛：十三层八角木檐楼阁塔) on Yuelun Hill
  tbox(gp, 0.34, 0.26, 0.28, 0.22, 0.045, '#5e7c4c', -0.08, y0, -0.12);
  pagodaOct(gp, -0.08, y0 + 0.045, -0.12, 7, 0.072, 0.028, RED, TILE);
  // Jiangnan White-Walled Pavilion & Lotus Dock on the East
  hall(gp, 0.2, y0, -0.06, 0.16, 0.11, 0.042, WHITE, '#4e3420', TILE, 0.036);
};

/** 南京: Gate of China Triple-Barbican Castle (南京明城墙中华门聚宝三道瓮城与藏兵洞) & Qinhuai Painted Boat. */
const pl_nanjing: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#646870', RED = '#9c2a20', TILE = '#42464c', WATER = '#346e78', GOLD = '#dca228';
  band(gp, 0.18, 0.34, y0, 0.006, WATER);
  // World's Largest Triple-Courtyard Barbican Gate: Zhonghua Gate (南京中华门三道瓮城与二十七座藏兵洞)
  for (const [dz, w, h] of [[-0.2, 0.48, 0.082], [-0.07, 0.42, 0.072], [0.05, 0.36, 0.064]] as [number, number, number][]) {
    tbox(gp, w, 0.07, w - 0.03, 0.058, h, BRICK, 0, y0, dz);
    box(gp, '#221a16', 0, y0, dz, 0.052, h * 0.65, 0.076);
  }
  for (const sx of [-0.2, 0.2]) box(gp, BRICK, sx, y0, -0.07, 0.048, 0.068, 0.28);
  hall(gp, 0, y0 + 0.082, -0.2, 0.22, 0.085, 0.044, '#e6dec8', RED, TILE, 0.038);
  // Qinhuai Riverの長干桥 & Painted Pleasure Boat (秦淮画舫与长干桥)
  box(gp, '#c8c0ae', -0.08, y0 + 0.005, 0.25, 0.07, 0.022, 0.16);
  rbox(gp, RED, 0.16, y0 + 0.008, 0.26, 0.15, 0.022, 0.048, 0.006);
  gable(gp, 0.1, 0.024, 0.045, GOLD, 0.16, y0 + 0.03, 0.26);
};

/** 北京: Zhengyangmen Gate & Arrow Tower on Central Axis (北京前门正阳门城楼、箭楼与五牌楼). */
const pl_beijing: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#666a72', RED = '#9e261e', GREEN = '#2e684e', GOLD = '#dca228', WHITE = '#f0ece2';
  // North: Towering Zhengyangmen Gate Tower with Green-Trimmed Grey Roof (正阳门城楼重檐歇山灰筒瓦绿琉璃剪边)
  tbox(gp, 0.46, 0.15, 0.42, 0.13, 0.082, BRICK, 0, y0, -0.18);
  box(gp, '#221a16', 0, y0, -0.18, 0.055, 0.052, 0.155);
  const h1 = hall(gp, 0, y0 + 0.082, -0.18, 0.26, 0.11, 0.046, RED, RED, GREEN, 0.036);
  hall(gp, 0, h1 - 0.008, -0.18, 0.2, 0.088, 0.036, RED, RED, GREEN, 0.034);
  // Center: Zhengyangmen Arrow Tower with 4 Rows of White Embrasure Windows (正阳门箭楼四排九十四孔箭窗)
  tbox(gp, 0.36, 0.13, 0.33, 0.11, 0.076, BRICK, 0, y0, 0.04);
  for (let i = -3; i <= 3; i++) for (const dy of [0.082, 0.102]) box(gp, WHITE, i * 0.038, y0 + dy, 0.096, 0.018, 0.012, 0.008);
  hall(gp, 0, y0 + 0.076, 0.04, 0.28, 0.095, 0.045, RED, RED, GREEN, 0.038);
  // South: Qianmen Five-Bay Imperial Pailou Archway (前门大街五牌楼)
  for (let i = -2; i <= 2; i++) cyl(gp, RED, i * 0.055, y0, 0.24, 0.005, 0.078, 6);
  gable(gp, 0.28, 0.026, 0.036, GOLD, 0, y0 + 0.072, 0.24);
};

/** 大同: Huayan Monastery Mahavira Hall with Huge Glazed Chiwei (大同华严寺大雄宝殿辽金巨刹) & Nine-Dragon Screen (代王府九龙壁). */
const pl_datong: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#c8c0ae', RED = '#942820', TILE = '#3d4248', GOLD = '#dca228', TURQ = '#227a88';
  // Liao-Jin Huayan Monastery High Terrace & 9-Bay Hip-Roof Mahavira Hall (大同华严寺大雄宝殿与月台高大琉璃鸱尾)
  tbox(gp, 0.48, 0.24, 0.44, 0.2, 0.052, STONE, 0, y0, -0.12);
  hall(gp, 0, y0 + 0.052, -0.12, 0.38, 0.16, 0.058, RED, RED, TILE, 0.052);
  for (const sx of [-0.19, 0.19]) box(gp, GOLD, sx, y0 + 0.152, -0.12, 0.018, 0.032, 0.016);
  // Datong Ming Prince of Dai Nine-Dragon Glazed Screen Wall (大同九龙壁五彩琉璃照壁与倒影池) in Foreground
  box(gp, STONE, 0, y0, 0.18, 0.36, 0.018, 0.042);
  box(gp, TURQ, 0, y0 + 0.018, 0.18, 0.34, 0.055, 0.024);
  for (let i = -4; i <= 4; i++) cyl(gp, i % 2 === 0 ? GOLD : '#e4dcd0', i * 0.035, y0 + 0.026, 0.194, 0.01, 0.036, 6);
  gable(gp, 0.37, 0.024, 0.038, GOLD, 0, y0 + 0.073, 0.18);
};

/** 银川: Chengtian Temple Octagonal 11-Storey Western Xia Pagoda (银川承天寺塔西夏古塔) & Yinchuan Drum Tower (银川鼓楼). */
const pl_xingqing: Builder = root => {
  const [gp, y0] = site(root, '#cfb27c', 0.88);
  const BRICK = '#b49262', GREEN = '#2e7456', RED = '#9c2820', TILE = '#424850';
  // Iconic 11-Storey Octagonal Chengtian Temple Pagoda ("西夏福塔"承天寺塔绿琉璃塔刹) on the West
  box(gp, '#cfc6b4', -0.15, y0, -0.06, 0.15, 0.024, 0.15);
  pagodaOct(gp, -0.15, y0 + 0.024, -0.06, 9, 0.055, 0.025, BRICK, GREEN);
  // Yinchuan Cruciform-Arch Drum Tower & Bell-Drum Pavilions (银川鼓楼十字券洞与四角亭) on the East
  tbox(gp, 0.26, 0.22, 0.23, 0.19, 0.058, '#686c74', 0.14, y0, 0.04);
  box(gp, '#221a16', 0.14, y0, 0.04, 0.048, 0.04, 0.23);
  const h1 = hall(gp, 0.14, y0 + 0.058, 0.04, 0.17, 0.14, 0.042, '#e6dec8', RED, TILE, 0.034);
  hall(gp, 0.14, h1 - 0.008, 0.04, 0.12, 0.1, 0.032, '#e6dec8', RED, TILE, 0.03);
};

/** 武汉: Jianghan Customs House Clock Tower (武汉江汉关钟楼) & Wuhan Yangtze River Bridge Double-Deck Truss (武汉长江大桥桥头堡). */
const pl_wuhan: Builder = root => {
  const [gp, y0] = site(root, '#2c6876', 0.88);
  const STONE = '#dcd4c2', STEEL = '#64727c', RED = '#9c2c22', GOLD = '#dca228';
  // North Bank Hankou Bund & Neoclassical Jianghan Customs Clock Tower (汉口江滩与江汉关大楼四面钟塔)
  prism(gp, [[-0.4, -0.36], [0.4, -0.36], [0.4, -0.12], [-0.4, -0.12]], y0, 0.025, '#b8b09e');
  box(gp, STONE, -0.18, y0 + 0.025, -0.22, 0.2, 0.075, 0.12);
  for (let i = -2; i <= 2; i++) cyl(gp, '#f2eee4', -0.18 + i * 0.038, y0 + 0.025, -0.158, 0.005, 0.075, 6);
  box(gp, STONE, -0.18, y0 + 0.1, -0.22, 0.068, 0.11, 0.068);
  cyl(grp(gp, -0.18, -0.184, 0, y0 + 0.165), '#f8f6f0', 0, 0, 0, 0.02, 0.006, 12).rotation.x = Math.PI / 2;
  cone(gp, GOLD, -0.18, y0 + 0.21, -0.22, 0.042, 0.038, 4, Math.PI / 4);
  // First Bridge Across the Yangtze: Wuhan Yangtze River Double-Deck Steel Bridge & Pavilion Tower (万里长江第一桥与桥头堡)
  box(gp, STONE, 0.14, y0, -0.1, 0.095, 0.135, 0.095);
  hall(gp, 0.14, y0 + 0.135, -0.1, 0.088, 0.088, 0.032, STONE, RED, '#3a6e54', 0.032);
  box(gp, STONE, 0.14, y0, 0.16, 0.072, 0.095, 0.072);
  box(gp, STEEL, 0.14, y0 + 0.078, 0.06, 0.075, 0.036, 0.48);
  box(gp, '#cfd6dc', 0.14, y0 + 0.114, 0.06, 0.085, 0.008, 0.48);
};

/** 长沙: Tianxin Pavilion Three-Storey Ancient Wall Tower (长沙天心阁古城墙三层飞檐与崇烈亭) & Orange Isle Xiang River. */
const pl_changsha: Builder = root => {
  const [gp, y0] = site(root, '#346e78', 0.88);
  const BRICK = '#666a72', RED = '#9c2820', TILE = '#3d4248', GREEN = '#4c7644';
  // Ancient Changsha Southeastern City Wall Rampart & Three-Storey Tianxin Pavilion (天心阁主阁与南北附阁长廊)
  tbox(gp, 0.52, 0.18, 0.46, 0.14, 0.075, BRICK, 0, y0, -0.12);
  const h1 = hall(gp, 0, y0 + 0.075, -0.12, 0.22, 0.12, 0.044, '#e6dec8', RED, TILE, 0.034);
  const h2 = hall(gp, 0, h1 - 0.008, -0.12, 0.17, 0.095, 0.036, '#e6dec8', RED, TILE, 0.03);
  hall(gp, 0, h2 - 0.008, -0.12, 0.13, 0.075, 0.03, '#e6dec8', RED, TILE, 0.028);
  for (const sx of [-0.18, 0.18]) {
    box(gp, RED, sx * 0.55, y0 + 0.075, -0.12, 0.06, 0.028, 0.04);
    hall(gp, sx, y0 + 0.075, -0.12, 0.095, 0.085, 0.038, '#e6dec8', RED, TILE, 0.032);
  }
  // Juzizhou (Orange Isle) Sandbar & Xiang River Sail in Foreground (湘江橘子洲头)
  prism(gp, [[-0.24, 0.14], [0.22, 0.16], [0.26, 0.28], [-0.2, 0.28]], y0, 0.022, GREEN, 0.04);
  box(gp, '#d6b898', -0.04, y0 + 0.022, 0.21, 0.09, 0.055, 0.045);
};

/** 广州: Zhenhai Tower ("Five-Storey Pagoda" 越秀山镇海楼朱墙绿瓦) & Five-Ram Stone Sculpture (五羊石像). */
const pl_guangzhou: Builder = root => {
  const [gp, y0] = site(root, '#4e7844', 0.88);
  const RED_STONE = '#8e3828', RED = '#a42820', GREEN_TILE = '#2c724e', GRANITE = '#d4cec0';
  // Iconic 5-Storey Ming Zhenhai Tower on Yuexiu Hill ("岭南第一胜概"镇海楼红砂岩基座与五层朱墙绿琉璃瓦)
  tbox(gp, 0.36, 0.2, 0.32, 0.17, 0.048, RED_STONE, -0.08, y0, -0.1);
  let y = y0 + 0.048;
  for (let i = 0; i < 5; i++) {
    const k = 1 - i * 0.08, w = 0.28 * k, d = 0.14 * k;
    box(gp, RED, -0.08, y, -0.1, w, 0.028, d);
    gable(gp, w + 0.03, 0.016, d + 0.03, GREEN_TILE, -0.08, y + 0.024, -0.1);
    y += 0.032;
  }
  // Five-Ram Stone Statue of Goat City ("羊城"五羊衔穗石雕) on Eastern Hillock
  tbox(gp, 0.16, 0.14, 0.13, 0.11, 0.045, '#8c8678', 0.2, y0, 0.1);
  ellip(gp, GRANITE, 0.2, y0 + 0.075, 0.1, 0.045, 0.048, 0.032);
  ellip(gp, GRANITE, 0.2, y0 + 0.125, 0.12, 0.022, 0.026, 0.024);
  for (const sx of [-0.018, 0.018]) rod(gp, [0.2 + sx, y0 + 0.14, 0.12], [0.2 + sx * 2.2, y0 + 0.155, 0.095], 0.005, GRANITE, 5);
};

/** 苏州: Panmen Land-and-Water Twin City Gate (苏州盘门水陆城门), Ruiguang Pagoda (瑞光塔) & Wumen High-Arch Bridge (吴门桥). */
const pl_suzhou: Builder = root => {
  const [gp, y0] = site(root, '#346e74', 0.88);
  const BRICK = '#686c72', RED = '#8c3226', TILE = '#3c4046', STONE = '#d4ccc0', WHITE = '#f2eee6';
  // Panmen Water & Land Twin Gates with Sluice Arch (盘门水陆双城门瓮城) on the East
  tbox(gp, 0.28, 0.18, 0.25, 0.16, 0.068, BRICK, 0.14, y0, -0.06);
  box(gp, '#1e282c', 0.08, y0, -0.06, 0.048, 0.048, 0.19);
  box(gp, '#221a16', 0.19, y0, -0.06, 0.045, 0.045, 0.19);
  hall(gp, 0.14, y0 + 0.068, -0.06, 0.18, 0.1, 0.038, WHITE, RED, TILE, 0.034);
  // Song Dynasty 7-Storey Brick-and-Wood Ruiguang Pagoda (盘门瑞光塔) on the Northwest Island
  prism(gp, [[-0.38, -0.34], [0.02, -0.34], [0.02, 0.04], [-0.38, 0.04]], y0, 0.022, '#5a7850');
  pagodaOct(gp, -0.18, y0 + 0.022, -0.14, 7, 0.052, 0.026, RED, TILE);
  // Tall Single-Arch Wumen Stone Bridge over the Grand Canal (吴门桥单孔高石拱桥) in Foreground
  for (let i = -3; i <= 3; i++) {
    const t = i / 3, h = (1 - t * t) * 0.055;
    box(gp, STONE, -0.04 + t * 0.15, y0 + 0.012 + h * 0.5, 0.2, 0.052, h + 0.014, 0.068);
  }
};

/** 上海: Yuyuan Huxinting Teahouse & Nine-Turn Zigzag Bridge (上海城隍庙湖心亭九曲桥) with Pudong Skyline Backdrop. */
const pl_shanghai: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WATER = '#2e6c74', RED = '#982c22', TILE = '#383c42', WHITE = '#f2eee4', GLASS = '#5ea4c4';
  // Foreground: Yuyuan Lotus Pond, Nine-Turn Zigzag Stone Bridge & Double-Eaved Huxinting Teahouse (豫园荷花池、九曲桥与湖心亭)
  box(gp, '#b8b09e', 0, y0, 0.08, 0.52, 0.018, 0.34);
  box(gp, WATER, 0, y0 + 0.005, 0.08, 0.48, 0.015, 0.3);
  const h1 = hall(gp, 0, y0 + 0.02, 0.08, 0.15, 0.15, 0.042, WHITE, RED, TILE, 0.036);
  hall(gp, 0, h1 - 0.008, 0.08, 0.11, 0.11, 0.032, WHITE, RED, TILE, 0.034);
  for (const [bx, bz, w, d] of [[-0.14, 0.12, 0.14, 0.032], [-0.08, 0.06, 0.032, 0.1], [0.14, 0.04, 0.14, 0.032]] as [number, number, number, number][]) {
    box(gp, '#dcd4c2', bx, y0 + 0.02, bz, w, 0.012, d);
  }
  // Background: Iconic Lujiazui Twisted Shanghai Tower & Jin Mao Tower (陆家嘴上海中心与金茂大厦天际线)
  cyl(gp, GLASS, -0.18, y0, -0.2, 0.042, 0.25, 10);
  box(gp, '#8ea4b4', 0.18, y0, -0.2, 0.068, 0.21, 0.068);
  cone(gp, '#cfd8e0', 0.18, y0 + 0.21, -0.2, 0.035, 0.045, 4, Math.PI / 4);
};

/** 拉萨: Jokhang Temple Golden Roof with Dharma Wheel & Twin Deer (拉萨大昭寺金顶法轮双鹿) & Barkhor White Chorten (八廓街白塔). */
const pl_lhasa: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WHITE = '#f4f0e6', RED = '#94261e', GOLD = '#e2ac28', DARK = '#28201c';
  // Jokhang Temple White-Stone Lower Walls, Crimson Bianyazi Frieze & Golden Roofs (大昭寺白墙、边玛草红檐与鎏金铜瓦顶)
  tbox(gp, 0.46, 0.24, 0.42, 0.21, 0.082, WHITE, 0, y0, -0.1);
  box(gp, RED, 0, y0 + 0.062, -0.1, 0.43, 0.024, 0.22);
  for (let i = -3; i <= 3; i++) box(gp, DARK, i * 0.052, y0 + 0.028, 0.008, 0.024, 0.028, 0.01);
  hall(gp, 0, y0 + 0.086, -0.1, 0.26, 0.14, 0.042, RED, GOLD, GOLD, 0.044);
  for (const sx of [-0.15, 0.15]) hall(gp, sx, y0 + 0.086, -0.1, 0.1, 0.1, 0.034, RED, GOLD, GOLD, 0.032);
  // Iconic Golden Dharma Wheel & Twin Kneeling Deer on the Fore-Hall Ridge (鎏金法轮双鹿) + Tang-Tibet Alliance Stele (唐蕃会盟碑)
  cyl(grp(gp, 0, -0.02, 0, y0 + 0.145), GOLD, 0, 0, 0, 0.022, 0.008, 12).rotation.x = Math.PI / 2;
  box(gp, '#cfc6b4', -0.18, y0, 0.16, 0.036, 0.088, 0.022);
  // Barkhor Street Tibetan White Stupa (八廓街白塔) on the Southeast
  box(gp, WHITE, 0.18, y0, 0.14, 0.085, 0.036, 0.085);
  ellip(gp, WHITE, 0.18, y0 + 0.068, 0.14, 0.038, 0.042, 0.038);
  cone(gp, GOLD, 0.18, y0 + 0.108, 0.14, 0.016, 0.045, 8);
};

/** 台北: Grand Hotel Vermilion Palace on Yuanshan (台北圆山大饭店朱柱金瓦) & Taipei North Gate Cheng'en Gate (承恩门). */
const pl_taipei: Builder = root => {
  const [gp, y0] = site(root, '#4e7644', 0.88);
  const RED = '#b0261e', GOLD = '#e0a828', BRICK = '#9e4434', TILE = '#3d4248', WHITE = '#f0ece2';
  // Iconic 14-Storey Classical Palace-Style Grand Hotel Taipei on Yuanshan Hill (剑潭山圆山大饭店红柱金瓦重檐庑殿)
  tbox(gp, 0.44, 0.22, 0.4, 0.19, 0.038, '#cfd4c8', 0, y0, -0.12);
  box(gp, RED, 0, y0 + 0.038, -0.12, 0.34, 0.11, 0.15);
  for (let i = -4; i <= 4; i++) cyl(gp, RED, i * 0.038, y0 + 0.038, -0.042, 0.005, 0.11, 6);
  for (const dy of [0.065, 0.095, 0.122]) box(gp, GOLD, 0, y0 + dy, -0.12, 0.35, 0.007, 0.16);
  gable(gp, 0.38, 0.048, 0.18, GOLD, 0, y0 + 0.148, -0.12);
  // Qing Taipei Prefectural City North Gate "Cheng'en Gate" (台北府城北门承恩门碉堡式城门楼) in Foreground
  tbox(gp, 0.24, 0.14, 0.21, 0.12, 0.055, BRICK, 0, y0, 0.18);
  box(gp, '#221a16', 0, y0, 0.18, 0.045, 0.038, 0.145);
  hall(gp, 0, y0 + 0.055, 0.18, 0.17, 0.095, 0.036, WHITE, RED, TILE, 0.032);
};

/** 深圳: Shenzhen Civic Center Roc-Wings Roof (深圳市民中心大鹏展翅屋顶), Pioneering Bull Statue (拓荒牛) & Ping An Finance Center. */
const pl_shenzhen: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const RED = '#c42c22', BLUE = '#286494', GOLD = '#dca428', GLASS = '#68a8c8', BRZ = '#52402c';
  // Shenzhen Civic Center with Sweeping Red/Silver Roc-Wings Roof & Red Cylinder/Blue Cone Towers (市民中心大鹏展翅屋顶与红圆柱蓝方塔)
  cyl(gp, RED, -0.08, y0, -0.02, 0.052, 0.095, 14);
  box(gp, BLUE, 0.08, y0, -0.02, 0.09, 0.095, 0.09);
  for (const sx of [-1, 1]) {
    const w = box(gp, '#cfd8e0', sx * 0.14, y0 + 0.092, -0.02, 0.28, 0.012, 0.14);
    w.rotation.z = sx * 0.12;
  }
  box(gp, GOLD, 0, y0 + 0.088, -0.02, 0.14, 0.016, 0.15);
  // Towering Tapered Ping An Finance Center Skyscraper (平安金融中心摩天塔) at North-East
  tbox(gp, 0.095, 0.095, 0.052, 0.052, 0.25, GLASS, 0.22, y0, -0.18);
  cone(gp, '#dce4ec', 0.22, y0 + 0.25, -0.18, 0.026, 0.045, 4, Math.PI / 4);
  // Iconic Bronze "Pioneering Bull" Sculpture (深圳拓荒牛铜雕) in Foreground Plaza
  box(gp, '#b8b09e', -0.14, y0, 0.2, 0.14, 0.018, 0.075);
  ellip(gp, BRZ, -0.16, y0 + 0.042, 0.2, 0.048, 0.028, 0.024);
  rod(gp, [-0.11, y0 + 0.036, 0.2], [-0.06, y0 + 0.055, 0.2], 0.012, '#6b4828', 5);
};

/** 南昌: Shengjin Pagoda Seven-Storey Octagonal Brick-and-Timber Tower (南昌绳金塔七层八角飞檐) & August 1st Monument. */
const pl_nanchang: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WHITE = '#f2eee4', RED = '#9c2820', TILE = '#383c42', GOLD = '#e0a828', STONE = '#dcd4c2';
  // Iconic 7-Storey Jiangnan Shengjin Pagoda with Vermilion Balconies, White Walls & Golden Calabash Finial (南昌绳金塔镇城之宝)
  box(gp, '#cfc6b4', -0.14, y0, -0.06, 0.16, 0.024, 0.16);
  pagodaOct(gp, -0.14, y0 + 0.024, -0.06, 7, 0.058, 0.028, WHITE, TILE);
  ellip(gp, GOLD, -0.14, y0 + 0.26, -0.06, 0.014, 0.024, 0.014);
  // Nanchang August 1st Uprising Memorial Tower with Rifle & Red Flag Relief on Top (八一南昌起义纪念塔) on the East
  tbox(gp, 0.16, 0.16, 0.13, 0.13, 0.028, '#b8b09e', 0.16, y0, 0.02);
  box(gp, STONE, 0.16, y0 + 0.028, 0.02, 0.068, 0.19, 0.068);
  box(gp, RED, 0.16, y0 + 0.218, 0.02, 0.062, 0.036, 0.012);
};

/** 奈良: Todai-ji Daibutsuden Hall with Golden Shibi Finials & Karahafu Gable (奈良东大寺大佛殿唐破风与金鸱尾) & Kasuga Lanterns. */
const pl_nara: Builder = root => {
  const [gp, y0] = site(root, '#5e784c', 0.88);
  const WHITE = '#f4f0e6', WD = '#3e281a', TILE = '#383c42', GOLD = '#e2ac28', STONE = '#c8c0ae';
  // Monumental Double-Eaved Todai-ji Great Buddha Hall with Central arched Karahafu & Golden Shibi (东大寺大佛殿金鸱尾与唐破风)
  tbox(gp, 0.48, 0.26, 0.44, 0.23, 0.036, STONE, 0, y0, -0.1);
  const h1 = hall(gp, 0, y0 + 0.036, -0.1, 0.38, 0.18, 0.052, WHITE, WD, TILE, 0.042);
  hall(gp, 0, h1 - 0.01, -0.1, 0.3, 0.14, 0.042, WHITE, WD, TILE, 0.046);
  gable(gp, 0.11, 0.028, 0.06, TILE, 0, y0 + 0.082, -0.005);
  for (const sx of [-0.16, 0.16]) box(gp, GOLD, sx, h1 + 0.072, -0.1, 0.018, 0.032, 0.014);
  // Octagonal Bronze Lantern in Front Courtyard & Row of Kasuga Stone Lanterns with Nara Deer (八角灯笼与春日石灯笼)
  cyl(gp, '#466858', 0, y0, 0.14, 0.022, 0.068, 8);
  for (const sx of [-0.2, -0.12, 0.12, 0.2]) {
    cyl(gp, STONE, sx, y0, 0.2, 0.012, 0.048, 6);
    cone(gp, STONE, sx, y0 + 0.048, 0.2, 0.024, 0.018, 6);
  }
};

/** 京都: To-ji Five-Storey Timber Pagoda (京都东寺五重塔) & Fushimi Inari Senbon Torii Vermilion Tunnel (伏见稻荷千本鸟居). */
const pl_kyoto: Builder = root => {
  const [gp, y0] = site(root, '#567448', 0.88);
  const TILE = '#363a40', WHITE = '#f2eee4', VERMILION = '#d43220', DARK = '#221a16';
  // Tallest Wooden Pagoda in Japan: 5-Storey Square To-ji Pagoda on the West (京都五重塔五层方塔)
  box(gp, '#c8c0ae', -0.16, y0, -0.06, 0.18, 0.026, 0.18);
  let y = y0 + 0.026;
  for (let i = 0; i < 5; i++) {
    const k = 1 - i * 0.1, s = 0.11 * k;
    box(gp, WHITE, -0.16, y, -0.06, s, 0.028, s);
    gable(gp, s + 0.048, 0.018, s + 0.048, TILE, -0.16, y + 0.024, -0.06);
    y += 0.034;
  }
  cyl(gp, '#b88e34', -0.16, y, -0.06, 0.006, 0.055, 6);
  // Iconic Serpentine Row of Fushimi Inari Vermilion Torii Gates (伏见稻荷大社千本鸟居朱红回廊) on the East
  for (let i = 0; i < 6; i++) {
    const z = 0.2 - i * 0.065, x = 0.14 + Math.sin(i * 0.5) * 0.03;
    for (const sx of [-0.055, 0.055]) {
      cyl(gp, DARK, x + sx, y0, z, 0.008, 0.018, 6);
      cyl(gp, VERMILION, x + sx, y0 + 0.018, z, 0.007, 0.068, 6);
    }
    box(gp, VERMILION, x, y0 + 0.072, z, 0.13, 0.008, 0.01);
    box(gp, DARK, x, y0 + 0.086, z, 0.15, 0.01, 0.014);
  }
};

/** 东京: Edo Castle Nijubashi Bridge & Fujimi-yagura Turret (江户城皇居二重桥与石垣富士见橹) + Red-and-White Tokyo Tower. */
const pl_tokyo: Builder = root => {
  const [gp, y0] = site(root, '#2c6472', 0.88);
  const STONE = '#7c7870', WHITE = '#f6f4ee', TILE = '#363a40', RED = '#d82c20';
  // Battered Stone Ramparts of Edo Castle Moat & 3-Storey White Fujimi-yagura Keep (江户城巨石垣与富士见三重橹)
  tbox(gp, 0.42, 0.24, 0.34, 0.18, 0.082, STONE, -0.12, y0, -0.1);
  const h1 = hall(gp, -0.12, y0 + 0.082, -0.1, 0.2, 0.15, 0.038, WHITE, WHITE, TILE, 0.028);
  const h2 = hall(gp, -0.12, h1 - 0.008, -0.1, 0.15, 0.11, 0.032, WHITE, WHITE, TILE, 0.026);
  hall(gp, -0.12, h2 - 0.008, -0.1, 0.11, 0.08, 0.028, WHITE, WHITE, TILE, 0.028);
  // Nijubashi Double-Arch Stone Bridge over the Imperial Moat (皇居二重桥)
  box(gp, '#cfc8b8', -0.12, y0 + 0.006, 0.14, 0.075, 0.026, 0.2);
  // Iconic Red-and-White Lattice Tokyo Tower on the East (东京铁塔红白高塔)
  prism(gp, [[0.06, -0.34], [0.38, -0.34], [0.38, 0.24], [0.06, 0.24]], y0, 0.02, '#647858');
  for (let i = 0; i < 6; i++) {
    const r0 = 0.068 * (1 - i * 0.13), r1 = 0.068 * (1 - (i + 1) * 0.13);
    tbox(gp, r0 * 2, r0 * 2, r1 * 2, r1 * 2, 0.036, i % 2 === 0 ? RED : WHITE, 0.22, y0 + 0.02 + i * 0.036, -0.04);
  }
  cyl(gp, RED, 0.22, y0 + 0.236, -0.04, 0.006, 0.055, 6);
};

/** 首尔: Sungnyemun (Namdaemun 首尔崇礼门重檐歇山城门) & Namsan Five-Mound Smoke Beacon Station (南山木觅山烽燧台). */
const pl_seoul: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const GRANITE = '#9c968a', RED = '#942c22', DANQING = '#2e6e58', TILE = '#383c42';
  // National Treasure No. 1: Sungnyemun (Namdaemun) Granite Rampart with Central Rainbow Arch & Two-Storey Pavilion (崇礼门虹霓门与重檐楼阁)
  tbox(gp, 0.48, 0.16, 0.44, 0.14, 0.072, GRANITE, 0, y0, 0.04);
  box(gp, '#221a16', 0, y0, 0.04, 0.055, 0.048, 0.165);
  const h1 = hall(gp, 0, y0 + 0.072, 0.04, 0.28, 0.12, 0.042, DANQING, RED, TILE, 0.034);
  hall(gp, 0, h1 - 0.008, 0.04, 0.22, 0.095, 0.034, DANQING, RED, TILE, 0.034);
  // Namsan / Mongmyeoksan Five-Chimney Stone Beacon Terrace (木觅山五座石筑烽燧台) on the Northern Hill
  tbox(gp, 0.36, 0.14, 0.32, 0.11, 0.045, '#587448', 0, y0, -0.2);
  for (let i = -2; i <= 2; i++) {
    cyl(gp, GRANITE, i * 0.058, y0 + 0.045, -0.2, 0.018, 0.042, 8);
    cone(gp, '#322822', i * 0.058, y0 + 0.087, -0.2, 0.014, 0.018, 8);
  }
};

/** 那烂陀寺: Great Stupa of Sariputta Step-Terraced Red-Brick Pyramid (那烂陀舍利弗大佛塔角楼与阿育王柱). */
const pl_nalanda: Builder = root => {
  const [gp, y0] = site(root, '#6c844c', 0.88);
  const BRICK = '#a84830', STUCCO = '#dfd2b8', GOLD = '#dca228';
  // Monumental Terraced Red-Brick Pyramid of Nalanda Temple No. 3 (舍利弗大塔五层红砖阶梯高台与四角圆覆钵塔)
  tbox(gp, 0.42, 0.36, 0.34, 0.28, 0.048, BRICK, -0.04, y0, -0.06);
  tbox(gp, 0.3, 0.24, 0.24, 0.19, 0.048, shade(BRICK, 1.08), -0.04, y0 + 0.048, -0.06);
  tbox(gp, 0.18, 0.15, 0.14, 0.12, 0.045, BRICK, -0.04, y0 + 0.096, -0.06);
  // Central Harmika Shrine & 4 Corner Votive Stupa Domes (中央佛殿与四角覆钵小塔)
  ellip(gp, STUCCO, -0.04, y0 + 0.165, -0.06, 0.048, 0.045, 0.048);
  cone(gp, GOLD, -0.04, y0 + 0.208, -0.06, 0.018, 0.038, 8);
  for (const [sx, sz] of [[-0.17, -0.16], [0.09, -0.16], [-0.17, 0.04], [0.09, 0.04]] as [number, number][]) {
    cyl(gp, BRICK, sx, y0 + 0.048, sz, 0.028, 0.032, 10);
    ellip(gp, STUCCO, sx, y0 + 0.092, sz, 0.028, 0.026, 0.028);
  }
  // Grand Staircase on the South & Ashoka Lion Pillar (阿育王石柱与僧院红砖讲坛) on the East
  box(gp, BRICK, -0.04, y0, 0.12, 0.085, 0.038, 0.1);
  cyl(gp, STUCCO, 0.24, y0, 0.08, 0.016, 0.17, 10);
  box(gp, GOLD, 0.24, y0 + 0.17, 0.08, 0.032, 0.028, 0.032);
};

export const PLACES_CITIES: Record<string, Builder> = {
  pl_zhengzhou, pl_shenyang, pl_dali, pl_chengdu, pl_chongqing, pl_quanzhou, pl_yangzhou, pl_tianjin,
  pl_jinan, pl_qufu, pl_linzi, pl_handan, pl_ying, pl_fuzhou, pl_kunming, pl_lanzhou,
  pl_xining, pl_urumqi, pl_kashgar, pl_luntai, pl_turpan, pl_jiuquan, pl_hohhot, pl_harbin,
  pl_changchun, pl_dalian, pl_tainan, pl_hongkong, pl_macao, pl_haikou, pl_taian,
  pl_pyongyang, pl_albazin, pl_nerchinsk, pl_vladivostok, pl_talas, pl_samarkand, pl_calicut, pl_malacca, pl_hanoi,
  pl_xian, pl_xianyang, pl_luoyang, pl_kaifeng, pl_hangzhou, pl_nanjing, pl_beijing, pl_datong, pl_xingqing,
  pl_wuhan, pl_changsha, pl_guangzhou, pl_suzhou, pl_shanghai, pl_lhasa, pl_taipei, pl_shenzhen, pl_nanchang,
  pl_nara, pl_kyoto, pl_tokyo, pl_seoul, pl_nalanda,
};
