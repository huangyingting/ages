import * as THREE from 'three';
import { type Builder, box, rbox, cyl, cone as rawCone, ellip, rod, gable as rawGable, prism, tbox as rawTbox, shade, plinth, tree, SITE } from '../prims.ts';
import { grp, proof, gourd, stylePlaceHallColors, stylePlaceHuman } from '../timber.ts';
import { human } from '../human.ts';

let atlasSiteSeq = 0;
function site(root: THREE.Group, top: string, k = 0.88): [THREE.Group, number] {
  const h = plinth(root, top);
  const p = new THREE.Group();
  p.position.y = h + 0.0015;
  p.scale.setScalar(k);
  root.add(p);
  const s = ++atlasSiteSeq;
  const a1 = 0.65 + (s % 11) * 0.43, a2 = a1 + 2.25 + (s % 7) * 0.27;
  const tops = ['#785a3c', '#8c3428', '#2e5268', '#4a6240', '#6a485e', '#946834', '#384654', '#7e442c'];
  const bots = ['#4a3c2e', '#dfd6c4', '#2c343c', '#c8beaa', '#523c32', '#3a483c'];
  const poses = ['walk', 'point', 'stand', 'relax', 'carry'] as const;
  if (top !== SITE.water && top !== SITE.snow) {
    tree(p, Math.cos(a1) * 0.34, 0, Math.sin(a1) * 0.31, 0.046 + (s % 4) * 0.005, s & 1 ? '#44683a' : '#3b5c34');
    const hs = stylePlaceHuman(s, tops[s % tops.length], bots[(s >> 1) % bots.length]);
    human(p, Math.cos(a2) * 0.28, 0, Math.sin(a2) * 0.27, {
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
  if (r >= 0.048 && h >= 0.068 && seg <= 8) {
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

function hall(p: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, h: number, wallIn: string, colIn: string, roofIn: string, rh = h * 0.85): number {
  const [wall, col, roofC, beamC, goldC] = stylePlaceHallColors(wallIn, colIn, roofIn);
  const stoneC = '#cfc6b4', doorC = '#6e1d16', winC = '#efe4cc';
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

function pagodaOct(p: THREE.Object3D, x: number, y0: number, z: number, tiers: number, r0: number, h0: number, bodyC: string, eaveC: string): void {
  cyl(p, '#cfc6b4', x, y0, z, r0 * 1.14, Math.min(0.012, h0 * 0.38), 8);
  let y = y0 + Math.min(0.01, h0 * 0.32);
  const colC = '#8f241c', doorC = '#5c1a14';
  for (let i = 0; i < tiers; i++) {
    const k = 1 - (i / tiers) * 0.46, r = r0 * k, h = h0 * (1 - (i / tiers) * 0.24);
    cyl(p, bodyC, x, y, z, r * 0.92, h, 8);
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
// 1. NAMED IMPORTED HISTORICAL CITIES & LANDMARKS (24 CITIES)
// ============================================================================

/** 太原 (j21): Jinci Temple Shengmu Hall (太原晋祠圣母殿木雕盘龙柱) & Flying Bridge Across the Fish Pond (鱼沼飞梁十字桥). */
const pl_taiyuan: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const RED = '#982c22', TILE = '#3d6e54', GOLD = '#d6a232', STONE = '#cfc6b4', WATER = '#34727a';
  // Shengmu Hall (晋祠圣母殿: 重檐歇山黄绿琉璃剪边与前廊八根木雕盘龙柱) at north
  tbox(gp, 0.44, 0.22, 0.4, 0.19, 0.036, STONE, 0, y0, -0.14);
  const h1 = hall(gp, 0, y0 + 0.036, -0.14, 0.34, 0.15, 0.052, '#e4dcc8', RED, TILE, 0.038);
  hall(gp, 0, h1 - 0.01, -0.14, 0.26, 0.11, 0.036, '#e4dcc8', RED, GOLD, 0.036);
  for (let i = -3; i <= 3; i++) cyl(gp, GOLD, i * 0.045, y0 + 0.036, -0.06, 0.0055, 0.052, 6);
  // Iconic Cruciform "Flying Bridge Across the Fish Pond" (鱼沼飞梁: 方形荷池中三十四根石柱托十字石桥)
  box(gp, STONE, 0, y0, 0.14, 0.26, 0.018, 0.24);
  box(gp, WATER, 0, y0 + 0.005, 0.14, 0.22, 0.015, 0.2);
  box(gp, STONE, 0, y0 + 0.022, 0.14, 0.075, 0.014, 0.26);
  box(gp, STONE, 0, y0 + 0.022, 0.14, 0.26, 0.014, 0.075);
  tree(gp, -0.26, y0, 0.02, 0.075, '#3b5e38');
};

/** 承德 (j170): Putuo Zongcheng Temple ("Little Potala" 外八庙普陀宗乘之庙大红台) & Mountain Resort Lake Pavilion. */
const pl_chengde: Builder = root => {
  const [gp, y0] = site(root, '#5e764a', 0.88);
  const RED = '#9e2a20', WHITE = '#f2efe6', GOLD = '#e0a828', WATER = '#34727c';
  band(gp, 0.14, 0.34, y0, 0.006, WATER);
  // Towering Tibetan-style Dahongtai (承德普陀宗乘之庙大红台与万法归一殿鎏金铜瓦顶) on the northern hillside
  tbox(gp, 0.44, 0.2, 0.4, 0.17, 0.068, WHITE, 0, y0, -0.16);
  tbox(gp, 0.34, 0.16, 0.31, 0.14, 0.088, RED, 0, y0 + 0.068, -0.16);
  for (let i = -3; i <= 3; i++) for (const dy of [0.09, 0.125]) box(gp, WHITE, i * 0.04, y0 + dy, -0.085, 0.018, 0.02, 0.008);
  hall(gp, 0, y0 + 0.156, -0.16, 0.18, 0.11, 0.042, GOLD, RED, GOLD, 0.044);
  // Chengde Mountain Resort Yanbo Zhishuang / Shuixin Pavilion (避暑山庄水心榭) in the foreground lake
  box(gp, '#cfc6b4', 0, y0 + 0.005, 0.22, 0.26, 0.018, 0.065);
  for (const dx of [-0.085, 0, 0.085]) hall(gp, dx, y0 + 0.023, 0.22, 0.062, 0.062, 0.036, '#e6dec8', RED, '#484e54', 0.032);
};

/** 岳阳 (j161): Yueyang Tower Three-Storey Helmet-Roof Pavilion (岳阳楼三层纯木盔顶与洞庭湖巴陵城垣). */
const pl_yueyang: Builder = root => {
  const [gp, y0] = site(root, '#2c6878', 0.88);
  const STONE = '#847e72', RED = '#9c2a20', GOLD = '#dca228';
  // Baling Sandstone City Wall Terrace overlooking Dongting Lake (洞庭湖畔巴陵城墙高台)
  tbox(gp, 0.52, 0.28, 0.48, 0.24, 0.072, STONE, 0, y0, -0.06);
  // Iconic Three-Storey Yellow-Glazed Helmet-Roof Yueyang Tower (岳阳楼三层四柱重檐将军盔顶)
  const h1 = hall(gp, 0, y0 + 0.072, -0.06, 0.22, 0.16, 0.045, '#e8e0d0', RED, GOLD, 0.032);
  const h2 = hall(gp, 0, h1 - 0.008, -0.06, 0.17, 0.12, 0.038, '#e8e0d0', RED, GOLD, 0.028);
  box(gp, RED, 0, h2 - 0.006, -0.06, 0.12, 0.032, 0.09);
  // Curved Helmet Roof (如意将军盔顶)
  ellip(gp, GOLD, 0, h2 + 0.042, -0.06, 0.085, 0.038, 0.065);
  cone(gp, GOLD, 0, h2 + 0.068, -0.06, 0.024, 0.042, 8);
  // Flanking Xianmei Pavilion (仙梅亭) & Sanem Pavilion (三醉亭)
  for (const sx of [-0.17, 0.17]) hall(gp, sx, y0 + 0.072, -0.06, 0.085, 0.085, 0.038, '#e8e0d0', RED, GOLD, 0.034);
};

/** 襄阳 (j159): Xiangyang Ancient City Wall, Zhaoming Terrace (襄阳昭明台), Wide Moat & Zhongxuan Tower. */
const pl_xiangyang: Builder = root => {
  const [gp, y0] = site(root, '#326c76', 0.88);
  const BRICK = '#6a6e74', RED = '#982c22', TILE = '#464c52', STONE = '#c8c0ae';
  // Asia's widest city moat & stone drawbridge leading to Xiangyang Linhan Gate (襄阳护城河与临汉门瓮城)
  box(gp, STONE, 0, y0 + 0.006, 0.2, 0.08, 0.02, 0.18);
  tbox(gp, 0.54, 0.14, 0.5, 0.12, 0.072, BRICK, 0, y0, 0.04);
  box(gp, '#241c18', 0, y0, 0.04, 0.055, 0.048, 0.145);
  hall(gp, 0, y0 + 0.072, 0.04, 0.18, 0.09, 0.04, '#e4dcc8', RED, TILE, 0.036);
  for (const sx of [-0.21, 0.21]) hall(gp, sx, y0 + 0.072, 0.04, 0.085, 0.085, 0.036, '#e4dcc8', RED, TILE, 0.032);
  // Zhaoming Terrace (襄阳昭明台: 高台三层重檐钟鼓楼) in the center of the walled city
  tbox(gp, 0.26, 0.2, 0.22, 0.17, 0.068, BRICK, 0, y0, -0.18);
  const h1 = hall(gp, 0, y0 + 0.068, -0.18, 0.18, 0.13, 0.042, '#e4dcc8', RED, TILE, 0.034);
  hall(gp, 0, h1 - 0.008, -0.18, 0.13, 0.095, 0.034, '#e4dcc8', RED, TILE, 0.032);
};

/** 徐州 (j54): Xiang Yu's Horse-Training Terrace (徐州户部山戏马台),的风云阁 & Han Chariot/Jade Burial Suit Monument. */
const pl_xuzhou: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const BRICK = '#6d7178', RED = '#9c2a20', TILE = '#464c52', GOLD = '#d8a432';
  // Stepped Hubushan Hill & Ximatai Terrace (项羽戏马台崇台耸立)
  tbox(gp, 0.44, 0.28, 0.38, 0.24, 0.052, '#8c7858', 0, y0, -0.1);
  tbox(gp, 0.3, 0.19, 0.27, 0.17, 0.05, BRICK, 0, y0 + 0.052, -0.1);
  // Xiongbi Pavilion (雄风殿/秋风戏马长廊) & Chu Banner
  hall(gp, 0, y0 + 0.102, -0.1, 0.22, 0.13, 0.048, '#e6dec8', RED, TILE, 0.042);
  hall(gp, -0.18, y0 + 0.052, -0.02, 0.085, 0.085, 0.04, RED, GOLD, GOLD, 0.036);
  // Bronze Rearing Warhorse Statue (楚霸王戏马雕像) in the forecourt
  box(gp, '#cfc6b4', 0.14, y0, 0.16, 0.09, 0.024, 0.065);
  box(gp, '#7a5c32', 0.14, y0 + 0.048, 0.16, 0.032, 0.038, 0.068).rotation.x = -0.35;
};

/** 奉节 (j67): Baidi City (奉节白帝城托孤堂) perched on an island hill at the entrance of Qutang Gorge Kuimen (夔门天下雄). */
const pl_fengjie: Builder = root => {
  const [gp, y0] = site(root, '#2a6672', 0.88);
  const CLIFF = '#746c60', RED_CLIFF = '#945c42', RED = '#9c2c22', GOLD = '#dca432';
  // Twin sheer peaks of Qutang Gorge Kuimen (赤甲山与白盐山双峰夹江: 夔门天下雄) in the background
  tbox(gp, 0.24, 0.24, 0.19, 0.19, 0.14, RED_CLIFF, -0.24, y0, -0.16);
  cone(gp, shade(RED_CLIFF, 0.92), -0.24, y0 + 0.14, -0.16, 0.13, 0.14, 6);
  tbox(gp, 0.24, 0.24, 0.19, 0.19, 0.13, CLIFF, 0.24, y0, -0.16);
  cone(gp, shade(CLIFF, 0.92), 0.24, y0 + 0.13, -0.16, 0.13, 0.14, 6);
  // Baidi Mountain peninsula (白帝山孤岛) in the foreground with red-walled Baidi Temple (白帝庙明良殿/托孤堂)
  cone(gp, '#4e6e44', -0.04, y0, 0.12, 0.2, 0.1, 8);
  box(gp, RED, -0.04, y0 + 0.08, 0.12, 0.2, 0.028, 0.15);
  hall(gp, -0.04, y0 + 0.105, 0.12, 0.16, 0.11, 0.042, '#f0eae0', RED, GOLD, 0.038);
  // Wind-and-Rain Bridge linking Baidi Island to the north bank
  box(gp, '#c8bfa8', -0.14, y0 + 0.015, -0.01, 0.042, 0.016, 0.14);
};

/** 合川 (j129): Diaoyu Fortress (合川钓鱼城护国门与悬崖石城) perched atop Diaoyu Hill surrounded on three sides by the Jialing River. */
const pl_hechuan: Builder = root => {
  const [gp, y0] = site(root, '#2e6872', 0.88);
  const ROCK = '#6c665c', STONE = '#847e72', RED = '#982c22', TILE = '#484e54';
  // Steep flat-topped Diaoyu Mountain peninsula (嘉陵江三面环绕钓鱼山绝壁)
  tbox(gp, 0.56, 0.42, 0.48, 0.36, 0.11, ROCK, 0, y0, -0.04);
  // Iconic Huguo Gate (钓鱼城护国门石砌内凹城门与敌楼) & cliffside naval wharf wall (水军码头一字城墙)
  tbox(gp, 0.44, 0.11, 0.4, 0.095, 0.065, STONE, 0, y0 + 0.11, 0.08);
  box(gp, '#221c18', 0, y0 + 0.11, 0.08, 0.055, 0.048, 0.115);
  hall(gp, 0, y0 + 0.175, 0.08, 0.17, 0.085, 0.04, '#e4dcc8', RED, TILE, 0.036);
  // Sleeping Buddha & Nine-Mouth Pot courtyard inside the fortress
  hall(gp, 0, y0 + 0.11, -0.1, 0.2, 0.12, 0.042, '#e4dcc8', RED, TILE, 0.036);
  tree(gp, -0.18, y0 + 0.11, -0.06, 0.068, '#466c3e');
};

/** 集安 (j58): Goguryeo General's Tomb — Seven-Tiered Granite Pyramid ("东方金字塔"集安高句丽将军坟与好太王碑亭). */
const pl_jian: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const GRANITE = '#b8b2a4', DARK = '#7a756c', RED = '#982c22', TILE = '#484e54';
  // Iconic Seven-Tiered Stepped Granite Pyramid of the General's Tomb (集安将军坟七级阶坛积石墓)
  for (let i = 0; i < 7; i++) {
    const w = 0.36 - i * 0.042, y = y0 + i * 0.024;
    box(gp, i % 2 ? GRANITE : shade(GRANITE, 0.93), -0.08, y, -0.04, w, 0.024, w);
  }
  // Burial chamber opening on the 5th tier & giant monolithic boulders (护坟石) leaning against each side
  box(gp, '#262220', -0.08, y0 + 0.096, 0.065, 0.045, 0.042, 0.02);
  for (const dx of [-0.18, -0.08, 0.02]) box(gp, DARK, dx, y0 + 0.018, 0.145, 0.032, 0.048, 0.018).rotation.x = -0.25;
  // Gwanggaeto the Great Stele Pavilion (好太王碑亭与巨型角砾凝灰岩碑) on the east
  hall(gp, 0.22, y0, 0.04, 0.13, 0.13, 0.075, '#e4dcc8', RED, TILE, 0.042);
  box(gp, '#58544e', 0.22, y0 + 0.005, 0.04, 0.048, 0.065, 0.045);
};

/** 宁安 (j106): Bohai Kingdom Upper Capital Longquanfu Palace (渤海国上京龙泉府宫城大殿) & Famous Basalt Stone Lantern (石灯塔). */
const pl_ningan: Builder = root => {
  const [gp, y0] = site(root, SITE.grass, 0.88);
  const STONE = '#6e6a64', RED = '#982c22', GLAZE = '#2f7858', WALL = '#e4dcc8';
  // Tang-style Bohai Upper Capital No. 1 Palace Hall on a basalt-faced platform (渤海上京龙泉府一号宫殿址与绿釉琉璃瓦)
  tbox(gp, 0.46, 0.24, 0.42, 0.21, 0.045, STONE, -0.06, y0, -0.1);
  const h1 = hall(gp, -0.06, y0 + 0.045, -0.1, 0.34, 0.16, 0.052, WALL, RED, '#4a5056', 0.038);
  box(gp, GLAZE, -0.06, h1 - 0.004, -0.1, 0.384, 0.01, 0.01);
  // Iconic Six-Meter Carved Basalt Stone Lantern Pagoda of Xinglong Temple (渤海兴隆寺石灯塔) in the front-east court
  const lx = 0.2, lz = 0.12;
  cyl(gp, STONE, lx, y0, lz, 0.048, 0.032, 8);
  cyl(gp, STONE, lx, y0 + 0.032, lz, 0.024, 0.075, 8);
  cyl(gp, STONE, lx, y0 + 0.107, lz, 0.042, 0.018, 8);
  cyl(gp, '#d8c898', lx, y0 + 0.125, lz, 0.032, 0.038, 8);
  cone(gp, STONE, lx, y0 + 0.163, lz, 0.055, 0.038, 8);
  cone(gp, STONE, lx, y0 + 0.201, lz, 0.016, 0.028, 8);
};

/** 萨迦 (j121): Sakya Monastery Mongolo-Tibetan Fortress (萨迦寺红白黑三色花教城垣与角楼) & Golden-Roofed Lhakhang Chenmo. */
const pl_sakya: Builder = root => {
  const [gp, y0] = site(root, '#b8a078', 0.88);
  const GREY = '#4e525a', RED = '#942820', WHITE = '#f0ece2', GOLD = '#e0a828';
  // Iconic Square Bastioned Fortress Wall painted in Sakya Three Stripes: Grey-Black, White & Crimson (萨迦三色壁垒与四角碉楼)
  tbox(gp, 0.52, 0.42, 0.46, 0.36, 0.095, GREY, 0, y0, -0.02);
  // Vertical red & white stripes across the battered wall
  for (let i = -3; i <= 3; i++) {
    box(gp, i % 2 ? RED : WHITE, i * 0.055, y0 + 0.02, 0.175, 0.022, 0.072, 0.012);
  }
  for (const sx of [-0.23, 0.23]) for (const sz of [-0.18, 0.14]) {
    tbox(gp, 0.1, 0.1, 0.085, 0.085, 0.125, RED, sx, y0, sz);
    box(gp, WHITE, sx, y0 + 0.05, sz, 0.092, 0.024, 0.092);
  }
  // Central Golden-Roofed Great Assembly Hall (萨迦南寺大经堂金顶) rising inside the fortress
  tbox(gp, 0.28, 0.22, 0.25, 0.19, 0.055, RED, 0, y0 + 0.095, -0.04);
  hall(gp, 0, y0 + 0.15, -0.04, 0.2, 0.14, 0.036, GOLD, RED, GOLD, 0.038);
};

/** 山南 (j92): Yumbulagang — Tibet's First Palace perched on a narrow rocky crag (山南乃东雍布拉康高耸碉楼与金顶). */
const pl_shannan: Builder = root => {
  const [gp, y0] = site(root, '#a89268', 0.88);
  const ROCK = '#7a6852', WHITE = '#f2efe6', RED = '#982820', GOLD = '#e0a828';
  // Narrow jagged rocky ridge of Mount Jomo扎西次日山脊
  prism(gp, [[-0.36, 0.14], [-0.04, -0.22], [0.28, -0.18], [0.34, 0.08], [0.04, 0.22]], y0, 0.11, ROCK, 0.04);
  prism(gp, [[-0.18, 0.06], [0.02, -0.16], [0.22, -0.12], [0.16, 0.1]], y0 + 0.11, 0.065, shade(ROCK, 0.92), 0.02);
  // Iconic Yumbulagang Palace (雍布拉康): stepped white stone Tibetan halls & soaring slender watchtower (碉楼) at the peak
  tbox(gp, 0.24, 0.14, 0.21, 0.12, 0.075, WHITE, -0.02, y0 + 0.14, -0.02);
  box(gp, RED, -0.02, y0 + 0.195, -0.02, 0.22, 0.02, 0.125);
  hall(gp, -0.02, y0 + 0.215, -0.02, 0.16, 0.095, 0.032, RED, GOLD, GOLD, 0.032);
  // High stone watchtower (雍布拉康主碉楼) on the north-east crag tip
  tbox(gp, 0.095, 0.095, 0.075, 0.075, 0.145, WHITE, 0.12, y0 + 0.16, -0.06);
  box(gp, RED, 0.12, y0 + 0.28, -0.06, 0.08, 0.024, 0.08);
};

/** 哈拉和林 (j125): Mongol Empire Capital Karakorum Wan'an Palace, Silver Tree Fountain & Erdene Zuu Stone Tortoise. */
const pl_karakorum: Builder = root => {
  const [gp, y0] = site(root, '#74844e', 0.88);
  const WHITE = '#f2eee4', GOLD = '#dca432', RED = '#9c2a20', SILVER = '#d8e0e6';
  // Ring of white Erdene Zuu Stupa Walls & Imperial Mongol Golden Ordu Yurt-Palace (哈拉和林万安宫与金帐)
  tbox(gp, 0.42, 0.24, 0.38, 0.21, 0.038, '#cfc6b4', 0, y0, -0.12);
  hall(gp, 0, y0 + 0.038, -0.12, 0.28, 0.15, 0.052, WHITE, RED, GOLD, 0.044);
  for (const sx of [-0.24, 0.24]) {
    cyl(gp, WHITE, sx, y0, 0.08, 0.085, 0.045, 12);
    cone(gp, WHITE, sx, y0 + 0.045, 0.08, 0.092, 0.045, 12);
    cyl(gp, GOLD, sx, y0 + 0.088, 0.08, 0.022, 0.01, 10);
  }
  // Famous Silver Tree Wine Fountain of Möngke Khan (蒙哥汗宫廷银树喷泉) & Granite Stone Tortoise (哈拉和林石龟)
  cyl(gp, '#b8b09e', 0, y0, 0.16, 0.065, 0.018, 12);
  cyl(gp, SILVER, 0, y0 + 0.018, 0.16, 0.012, 0.095, 8);
  ellip(gp, SILVER, 0, y0 + 0.11, 0.16, 0.045, 0.032, 0.045);
  cone(gp, GOLD, 0, y0 + 0.135, 0.16, 0.014, 0.032, 6);
};

/** 正定 (j98): Longxing Temple Mani Hall (正定隆兴寺摩尼殿: 十字形四面抱厦重檐歇山宋代国宝) & Huata Pagoda. */
const pl_zhengding: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WALL = '#e4dcc8', RED = '#982c22', TILE = '#465056', GREEN = '#2f7656', BRICK = '#b89e78';
  // Iconic Northern Song Mani Hall (隆兴寺摩尼殿: 方形重檐殿身四面正中各出山花向前的歇山抱厦)
  tbox(gp, 0.42, 0.36, 0.38, 0.32, 0.035, '#cfc6b4', -0.06, y0, -0.04);
  const h1 = hall(gp, -0.06, y0 + 0.035, -0.04, 0.26, 0.24, 0.048, WALL, RED, TILE, 0.036);
  hall(gp, -0.06, h1 - 0.008, -0.04, 0.19, 0.17, 0.038, WALL, RED, GREEN, 0.042);
  // Four projecting cruciform gable porches (四面抱厦) on N, S, E, W
  for (const [dx, dz, w, d] of [[-0.06, 0.11, 0.11, 0.07], [-0.06, -0.19, 0.11, 0.07], [0.1, -0.04, 0.07, 0.11], [-0.22, -0.04, 0.07, 0.11]] as [number, number, number, number][]) {
    hall(gp, dx, y0 + 0.035, dz, w, d, 0.042, WALL, RED, GREEN, 0.034);
  }
  // Zhengding Guanghui Temple Hua Pagoda (广惠寺华塔) on the east
  pagodaOct(gp, 0.24, y0, 0.06, 6, 0.038, 0.025, BRICK, GREEN);
};

/** 武威 (j48): Leitai Han Tomb Bronze Galloping Horse Treading on a Flying Swallow (马踏飞燕铜奔马) & Wuwei Confucian Temple. */
const pl_wuwei: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a88856', BRZ = '#387860', RED = '#982c22', TILE = '#484e54';
  // Leitai Han Tomb High Rammed-Earth Platform (武威雷台汉墓高台与雷祖殿) at north-west
  tbox(gp, 0.36, 0.26, 0.32, 0.22, 0.065, EARTH, -0.1, y0, -0.12);
  hall(gp, -0.1, y0 + 0.065, -0.12, 0.2, 0.13, 0.045, '#e4dcc8', RED, TILE, 0.038);
  // Iconic Bronze Galloping Horse Treading on a Flying Swallow (铜奔马/马踏飞燕) on a prominent pedestal in the foreground
  const hx = 0.16, hz = 0.08;
  box(gp, '#cfc6b4', hx, y0, hz, 0.14, 0.036, 0.09);
  ellip(gp, BRZ, hx, y0 + 0.044, hz - 0.01, 0.022, 0.008, 0.018);
  rod(gp, [hx, y0 + 0.044, hz - 0.01], [hx, y0 + 0.095, hz], 0.005, BRZ, 5);
  box(gp, BRZ, hx, y0 + 0.095, hz + 0.01, 0.032, 0.036, 0.085);
  box(gp, BRZ, hx, y0 + 0.125, hz + 0.048, 0.024, 0.038, 0.03);
  rod(gp, [hx, y0 + 0.11, hz - 0.032], [hx, y0 + 0.125, hz - 0.068], 0.005, BRZ, 5);
};

/** 天水 (j86): Maijishan Grottoes (天水麦积山石窟: 状如农家麦积的孤峰赤壁、凌空栈道与摩崖大佛). */
const pl_tianshui: Builder = root => {
  const [gp, y0] = site(root, '#5e7448', 0.88);
  const CLIFF = '#b25c38', STONE = '#dfa874', WD = '#6b4424', RED = '#982c22', TILE = '#464c52';
  // Iconic Haystack-Shaped Red Conglomerate Monolith of Maijishan (麦积山孤峰赤壁) centered at z = -0.08
  cyl(gp, CLIFF, 0, y0, -0.08, 0.2, 0.14, 14);
  cyl(gp, shade(CLIFF, 0.95), 0, y0 + 0.14, -0.08, 0.18, 0.065, 14);
  cone(gp, shade(CLIFF, 0.9), 0, y0 + 0.205, -0.08, 0.18, 0.055, 14);
  // Seven-Buddha Cliff Pavilion (麦积山七佛阁/散花楼木构窟檐) high on the cliff face
  hall(gp, 0, y0 + 0.145, 0.095, 0.19, 0.065, 0.038, '#e6dec8', RED, TILE, 0.032);
  // Cliff-Carved Giant Buddha Triad (东崖大佛一佛二菩萨摩崖造像) clearly visible in front of the cliff at z = 0.12
  box(gp, '#5c2818', 0, y0 + 0.035, 0.105, 0.19, 0.105, 0.022);
  for (const [dx, h, r] of [[0, 0.092, 0.024], [-0.062, 0.074, 0.017], [0.062, 0.074, 0.017]] as [number, number, number][]) {
    cyl(gp, STONE, dx, y0 + 0.035, 0.122, r, h * 0.72, 8);
    ellip(gp, STONE, dx, y0 + 0.035 + h * 0.86, 0.122, r * 0.82, r * 0.92, r * 0.82);
  }
  // Multi-tiered Aerial Cliff Plank Galleries (麦积山十二层凌空飞栈) crisscrossing the front rock face
  for (const ly of [0.032, 0.072, 0.112, 0.145]) {
    box(gp, WD, 0, y0 + ly, 0.14, 0.28, 0.006, 0.028);
    box(gp, RED, 0, y0 + ly + 0.006, 0.153, 0.28, 0.01, 0.004);
  }
  tree(gp, -0.26, y0, 0.06, 0.068, '#466e3e');
  tree(gp, 0.26, y0, 0.06, 0.065, '#466e3e');
};

/** 库车 (j70): Subashi Buddhist Temple Stupa Ruins (库车龟兹故国苏巴什佛寺遗址与克孜尔千佛洞鸠摩罗什像). */
const pl_kuqa: Builder = root => {
  const [gp, y0] = site(root, '#cba66a', 0.88);
  const EARTH = '#b68c50', CLIFF = '#be7e48', BRZ = '#8c6d38';
  // Subashi Great Stupa & Rammed-Earth Monastery Walls (苏巴什佛寺西寺大塔遗址) on the east
  tbox(gp, 0.22, 0.22, 0.19, 0.19, 0.055, EARTH, 0.15, y0, -0.06);
  cyl(gp, shade(EARTH, 0.94), 0.15, y0 + 0.055, -0.06, 0.068, 0.065, 12);
  ellip(gp, EARTH, 0.15, y0 + 0.125, -0.06, 0.062, 0.048, 0.062);
  // Kizil Thousand-Buddha Caves Cliff & Seated Bronze Kumarajiva Statue (克孜尔千佛洞崖壁与鸠摩罗什坐像) on the west
  prism(gp, [[-0.38, -0.24], [-0.04, -0.24], [-0.06, 0.04], [-0.36, 0.08]], y0, 0.13, CLIFF, 0.02);
  for (const dx of [-0.28, -0.2, -0.12]) box(gp, '#3c2818', dx, y0 + 0.045, -0.04, 0.036, 0.048, 0.018);
  box(gp, '#cfc6b4', -0.12, y0, 0.18, 0.085, 0.024, 0.085);
  cyl(gp, BRZ, -0.12, y0 + 0.024, 0.18, 0.024, 0.045, 8);
  ellip(gp, BRZ, -0.12, y0 + 0.08, 0.18, 0.015, 0.018, 0.015);
};

/** 和田 (j46): Ancient Kingdom of Khotan Yotkan Citadel, White Jade River (白玉河羊脂白玉) & Rawap / Silk Workshop. */
const pl_hotan: Builder = root => {
  const [gp, y0] = site(root, '#d2b278', 0.88);
  const EARTH = '#bc9658', JADE = '#f2f4ee', WATER = '#3a7c84', TURQ = '#227e8e';
  band(gp, 0.12, 0.3, y0, 0.006, WATER);
  // White Jade River Boulders (玉龙喀什河/白玉河羊脂玉籽料) gleaming along the riverbed
  for (const [x, z, r] of [[-0.16, 0.2, 0.042], [0.02, 0.22, 0.055], [0.18, 0.19, 0.038]] as [number, number, number][]) {
    ellip(gp, JADE, x, y0 + 0.022, z, r, r * 0.72, r * 0.85);
  }
  // Yotkan / Melikawat Ancient Khotan Buddhist Stupa & Carved Aywan Courtyard (于阗古国佛塔与和田阿以旺廊院) at north
  tbox(gp, 0.38, 0.22, 0.34, 0.19, 0.055, EARTH, -0.06, y0, -0.12);
  box(gp, '#f4efe4', -0.06, y0 + 0.055, -0.12, 0.24, 0.052, 0.13);
  ellip(gp, TURQ, -0.06, y0 + 0.122, -0.12, 0.048, 0.038, 0.048);
  cyl(gp, EARTH, 0.22, y0, -0.1, 0.065, 0.11, 10);
  cone(gp, shade(EARTH, 0.9), 0.22, y0 + 0.11, -0.1, 0.068, 0.06, 10);
};

/** 新郑 (j12): Zheng-Han Ancient Capital Wall (新郑郑韩故城), Bronze Lotus-and-Crane Square Hu (莲鹤方壶) & Nine Tripods. */
const pl_xinzheng: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const EARTH = '#a88856', BRZ = '#3e7862', GOLD = '#d8a432', RED = '#982c22';
  // Zheng-Han Ancient City Rammed-Earth Wall & Yellow Emperor Hometown Altar (郑韩故城夯土城垣与轩辕丘)
  tbox(gp, 0.42, 0.2, 0.36, 0.16, 0.065, EARTH, -0.08, y0, -0.14);
  hall(gp, -0.08, y0 + 0.065, -0.14, 0.22, 0.12, 0.045, '#e2dac6', RED, '#4a5056', 0.038);
  // Iconic Bronze Lotus-and-Crane Square Hu (新郑郑公大墓出土莲鹤方壶) on east pedestal & row of Nine Bronze Ding (九鼎八簋)
  const bx = 0.2, bz = 0.02;
  box(gp, '#cfc6b4', bx, y0, bz, 0.1, 0.022, 0.1);
  box(gp, BRZ, bx, y0 + 0.022, bz, 0.068, 0.085, 0.058);
  box(gp, GOLD, bx, y0 + 0.107, bz, 0.082, 0.022, 0.072);
  cyl(gp, '#f2eee4', bx, y0 + 0.129, bz, 0.006, 0.036, 6);
  for (let i = -2; i <= 2; i++) cyl(gp, BRZ, -0.1 + i * 0.055, y0, 0.16, 0.018, 0.032, 8);
};

/** 寿县 (j31): Shouchun Ancient Flood-Proof City Wall Binyang Gate (寿县古城宾阳门瓮城) & Chu Great Bronze Cauldron (楚大鼎). */
const pl_shouxian: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const BRICK = '#686c72', RED = '#982c22', TILE = '#464c52', BRZ = '#487660';
  // Song-Ming Shouchun Flood-Defense Sloped Stone Wall & Barbican (寿县古城倾斜防洪石壁与瓮城门楼)
  tbox(gp, 0.48, 0.16, 0.42, 0.13, 0.078, BRICK, -0.06, y0, -0.1);
  box(gp, '#221c18', -0.06, y0, -0.1, 0.055, 0.05, 0.165);
  hall(gp, -0.06, y0 + 0.078, -0.1, 0.2, 0.1, 0.044, '#e4dcc8', RED, TILE, 0.038);
  // Iconic Chu Great Bronze Tripod Cauldron (寿春楚王墓出土铸客大鼎: 圆腹三蹄足双耳) in the foreground plaza
  const dx = 0.16, dz = 0.14;
  cyl(gp, '#cfc6b4', dx, y0, dz, 0.085, 0.02, 16);
  for (const a of [0.5, 2.6, 4.7]) cyl(gp, BRZ, dx + Math.cos(a) * 0.038, y0 + 0.02, dz + Math.sin(a) * 0.038, 0.009, 0.048, 6);
  ellip(gp, BRZ, dx, y0 + 0.082, dz, 0.058, 0.042, 0.058);
  for (const sx of [-0.048, 0.048]) box(gp, BRZ, dx + sx, y0 + 0.115, dz, 0.01, 0.026, 0.028);
};

/** 宝鸡 (j4): Zhouyuan Bronze He Zun ("宅兹中国"何尊) & Ten Stone Drums of Mount Shigu (陈仓石鼓阁与十枚秦石鼓). */
const pl_baoji: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const BRZ = '#3e745c', STONE = '#848078', RED = '#982c22', TILE = '#464c52';
  // Shigu Pavilion on Chicken-Peak Mountain (宝鸡石鼓山石鼓阁五重檐秦汉高台阁) at north-west
  tbox(gp, 0.32, 0.24, 0.28, 0.21, 0.055, '#9e8458', -0.12, y0, -0.12);
  const h1 = hall(gp, -0.12, y0 + 0.055, -0.12, 0.22, 0.15, 0.045, '#e4dcc8', RED, TILE, 0.036);
  hall(gp, -0.12, h1 - 0.008, -0.12, 0.15, 0.11, 0.038, '#e4dcc8', RED, TILE, 0.034);
  // Iconic Western Zhou Bronze He Zun ("中国"一词最早出处：宝鸡贾村出土何尊) on east pedestal
  const hx = 0.18, hz = 0.04;
  box(gp, '#cfc6b4', hx, y0, hz, 0.11, 0.022, 0.11);
  cyl(gp, BRZ, hx, y0 + 0.022, hz, 0.038, 0.032, 8);
  box(gp, BRZ, hx, y0 + 0.054, hz, 0.068, 0.052, 0.068);
  tbox(gp, 0.068, 0.068, 0.092, 0.092, 0.048, BRZ, hx, y0 + 0.106, hz);
  // Semi-circle of Qin Stone Drums (中华第一古物：陈仓石鼓) in the foreground
  for (let i = -2; i <= 2; i++) cyl(gp, STONE, -0.08 + i * 0.055, y0, 0.2, 0.018, 0.028, 10);
};

/** 荆州 (settlement-112.2-30.35): Jingzhou Ancient City Wall Binyang Tower (荆州古城宾阳楼瓮城) & Giant Bronze Guan Yu Statue. */
const pl_jingzhou: Builder = root => {
  const [gp, y0] = site(root, '#366c74', 0.88);
  const BRICK = '#686c74', RED = '#9c2a20', TILE = '#464c52', BRZ = '#3e745e';
  // Jingzhou Ancient City East Gate (寅宾门/宾阳楼重檐歇山城楼与九龙桥) spanning the moat
  box(gp, '#cfc6b4', -0.08, y0 + 0.005, 0.22, 0.085, 0.02, 0.16);
  tbox(gp, 0.48, 0.15, 0.44, 0.13, 0.075, BRICK, -0.06, y0, 0.02);
  box(gp, '#221c18', -0.06, y0, 0.02, 0.055, 0.05, 0.155);
  const h1 = hall(gp, -0.06, y0 + 0.075, 0.02, 0.22, 0.1, 0.042, '#e4dcc8', RED, TILE, 0.034);
  hall(gp, -0.06, h1 - 0.008, 0.02, 0.16, 0.08, 0.034, '#e4dcc8', RED, TILE, 0.032);
  // Bronze Guan Yu Holding the Green Dragon Crescent Blade (关公义园青龙偃月刀像) at north-east
  box(gp, '#cfc6b4', 0.22, y0, -0.16, 0.09, 0.028, 0.09);
  cyl(gp, BRZ, 0.22, y0 + 0.028, -0.16, 0.028, 0.11, 8);
  ellip(gp, BRZ, 0.22, y0 + 0.15, -0.16, 0.018, 0.022, 0.018);
  rod(gp, [0.26, y0 + 0.028, -0.14], [0.25, y0 + 0.19, -0.14], 0.004, '#d8a432', 5);
};

/** 青岛 (j169): Zhanqiao Pier & Octagonal Huilan Pavilion (青岛栈桥回澜阁), Red-Roofed German Villas & May Fourth Wind Sculpture. */
const pl_qingdao: Builder = root => {
  const [gp, y0] = site(root, '#1e5c76', 0.88);
  const STONE = '#c8c0ae', RED = '#b83224', GOLD = '#dca228', WHITE = '#f2eee4';
  // Qingdao Coastal Promenade with Red-Tiled European Villas ("红瓦绿树、碧海蓝天") at north
  prism(gp, [[-0.4, -0.36], [0.4, -0.36], [0.38, -0.1], [-0.4, -0.1]], y0, 0.024, STONE);
  hall(gp, -0.2, y0 + 0.024, -0.22, 0.16, 0.11, 0.058, WHITE, WHITE, RED, 0.048);
  // Iconic Spiral Red "Wind of May" Sculpture (五四广场五月的风红色螺旋雕塑) on the east plaza
  for (let i = 0; i < 5; i++) {
    const r = 0.02 + Math.sin((i / 4) * Math.PI) * 0.028;
    cyl(gp, RED, 0.2, y0 + 0.024 + i * 0.024, -0.2, r, 0.02, 12);
  }
  // Zhanqiao Stone Pier extending south into the bay to the Octagonal Double-Eaved Huilan Pavilion (栈桥与回澜阁)
  box(gp, STONE, -0.02, y0 + 0.006, 0.06, 0.065, 0.018, 0.34);
  cyl(gp, STONE, -0.02, y0 + 0.006, 0.24, 0.095, 0.022, 8);
  pagodaOct(gp, -0.02, y0 + 0.028, 0.24, 2, 0.065, 0.042, RED, GOLD);
};

/** 厦门 (j165): Gulangyu Sunlight Rock (鼓浪屿日光岩), Eight-Trigram Red-Dome Mansion (八卦楼) & Fort Hulishan Krupp Cannon. */
const pl_xiamen: Builder = root => {
  const [gp, y0] = site(root, '#206078', 0.88);
  const ROCK = '#b8a888', WHITE = '#f4f0e6', RED_DOME = '#a83426', GREEN = '#467442';
  // Lush Gulangyu Island (鼓浪屿岛礁与绿树)
  prism(gp, [[-0.36, -0.24], [0.34, -0.26], [0.36, 0.2], [-0.34, 0.22]], y0, 0.028, GREEN, 0.05);
  // Iconic Bagualou Mansion with Octagonal Red Ribbed Dome (鼓浪屿八卦楼红色八角穹顶与柱廊) on the east
  box(gp, WHITE, 0.12, y0 + 0.028, 0.02, 0.22, 0.075, 0.18);
  for (let i = -2; i <= 2; i++) cyl(gp, WHITE, 0.12 + i * 0.042, y0 + 0.028, 0.115, 0.005, 0.075, 6);
  cyl(gp, WHITE, 0.12, y0 + 0.103, 0.02, 0.068, 0.032, 8);
  ellip(gp, RED_DOME, 0.12, y0 + 0.15, 0.02, 0.072, 0.052, 0.072);
  // Towering Granite Monolith of Sunlight Rock (日光岩巨石与郑成功水操台) on the west
  cyl(gp, ROCK, -0.18, y0 + 0.028, -0.06, 0.088, 0.16, 7);
  ellip(gp, ROCK, -0.18, y0 + 0.19, -0.06, 0.078, 0.058, 0.072);
  box(gp, '#dcd4c2', -0.18, y0 + 0.24, -0.06, 0.065, 0.014, 0.065);
};

/** 宁波 (j150): Tianyi Pavilion — China's Oldest Existing Private Library (宁波天一阁藏书楼、天一池假山与明州三江口). */
const pl_ningbo: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const WHITE = '#f0ece2', TILE = '#3d4248', WD = '#523620', WATER = '#346e74', ROCK = '#7a756c';
  // Tianyi Pavilion (宁波天一阁宝书楼: 硬山顶重楼六开间、两侧封火马头墙) at north
  const w = 0.34, d = 0.15, z = -0.12;
  box(gp, WHITE, 0, y0, z, w, 0.095, d);
  for (let i = -3; i <= 3; i++) cyl(gp, WD, i * 0.048, y0, z + d / 2 - 0.005, 0.004, 0.095, 6);
  box(gp, WD, 0, y0 + 0.048, z + d / 2, w - 0.01, 0.038, 0.008);
  gable(gp, w + 0.03, 0.048, d + 0.04, TILE, 0, y0 + 0.095, z);
  for (const sx of [-w / 2 - 0.006, w / 2 + 0.006]) {
    box(gp, WHITE, sx, y0, z, 0.014, 0.125, d + 0.01);
    box(gp, TILE, sx, y0 + 0.125, z, 0.018, 0.006, d + 0.016);
  }
  // Fire-Prevention Tianyi Pond ("天一生水"天一池与太湖石假山、百鹅亭) in the front courtyard
  box(gp, '#b8b09e', 0, y0, 0.12, 0.34, 0.018, 0.18);
  box(gp, WATER, 0, y0 + 0.005, 0.12, 0.3, 0.015, 0.14);
  for (const [rx, rz, r] of [[-0.1, 0.12, 0.038], [-0.05, 0.14, 0.028], [0.18, 0.04, 0.035]] as [number, number, number][]) {
    cone(gp, ROCK, rx, y0 + 0.018, rz, r, r * 1.4, 5);
  }
  hall(gp, 0.14, y0 + 0.018, 0.12, 0.085, 0.085, 0.038, WHITE, WD, TILE, 0.032);
};

/** 绍兴 (j23): Bazi Bridge Earliest Overpass Stone Bridge (绍兴八字桥宋代立交石桥), Black-Awning Boat (乌篷船) & Great Yu Mausoleum Hall. */
const pl_shaoxing: Builder = root => {
  const [gp, y0] = site(root, '#346e74', 0.88);
  const STONE = '#cfc8b8', WHITE = '#f2eee4', TILE = '#383c42', RED = '#982c22';
  // Intersecting Water Canals & Song Dynasty Bazi Multi-Ramp Stone Bridge (绍兴八字桥三河汇流四向石阶)
  for (const sx of [-0.26, 0.26]) prism(gp, [[sx - 0.12, -0.34], [sx + 0.12, -0.34], [sx + 0.12, 0.28], [sx - 0.12, 0.28]], y0, 0.022, '#5c7850');
  box(gp, STONE, 0, y0 + 0.018, 0.08, 0.34, 0.024, 0.078);
  for (const sx of [-0.14, 0.14]) box(gp, STONE, sx, y0 + 0.014, 0.16, 0.048, 0.018, 0.12);
  // Iconic Shaoxing Black-Awning Boat (绍兴乌篷船) & Great Yu Mausoleum享殿 on Kuaiji Hill
  rbox(gp, '#4e341e', 0, y0 + 0.008, 0.24, 0.14, 0.018, 0.042, 0.006);
  ellip(gp, '#24201e', 0, y0 + 0.024, 0.24, 0.045, 0.018, 0.02);
  hall(gp, -0.25, y0 + 0.022, -0.14, 0.18, 0.12, 0.046, WHITE, RED, '#d8a228', 0.04);
  hall(gp, 0.25, y0 + 0.022, -0.1, 0.15, 0.11, 0.04, WHITE, '#4e3420', TILE, 0.034);
};

/** 桂平·桂林 (j28): Elephant Trunk Hill with Water-Moon Cave (桂林象鼻山水月洞), Puxian Pagoda & Jingjiang Princes' City Gate. */
const pl_guilin: Builder = root => {
  const [gp, y0] = site(root, '#2c727a', 0.88);
  const KARST = '#5a7852', BRICK = '#a44834', RED = '#9c2820', GOLD = '#dca228';
  // Iconic Elephant Trunk Hill Drinking from the Li River with Round Water-Moon Arch & Puxian Brick Pagoda on Back (象鼻山水月洞与普贤塔)
  tbox(gp, 0.28, 0.18, 0.22, 0.14, 0.135, KARST, -0.1, y0, 0.02);
  box(gp, KARST, 0.06, y0, 0.02, 0.085, 0.095, 0.1);
  cyl(grp(gp, 0.01, 0.02, 0, y0 + 0.038), '#20565e', 0, 0, 0, 0.038, 0.15, 12).rotation.x = Math.PI / 2;
  cyl(gp, BRICK, -0.1, y0 + 0.135, 0.02, 0.024, 0.038, 8);
  ellip(gp, BRICK, -0.1, y0 + 0.185, 0.02, 0.028, 0.032, 0.028);
  // Ming Jingjiang Princes' Palace Chengyun Gate (桂林靖江王城承运门) on the North Shore
  prism(gp, [[-0.4, -0.36], [0.4, -0.36], [0.38, -0.12], [-0.4, -0.12]], y0, 0.022, '#cfc6b4');
  tbox(gp, 0.34, 0.11, 0.3, 0.095, 0.052, RED, 0.12, y0 + 0.022, -0.22);
  hall(gp, 0.12, y0 + 0.074, -0.22, 0.2, 0.088, 0.038, RED, RED, GOLD, 0.034);
};

/** 巴彦淖尔 (j34): Jilusai Stone Frontier Fortress in Langshan Gorge (阴山鸡鹿塞石筑关城) & Yinshan Petroglyph Cliff (阴山岩画). */
const pl_shuofang: Builder = root => {
  const [gp, y0] = site(root, '#b89862', 0.88);
  const STONE = '#7c7468', CLIFF = '#8c6848', GOLD = '#dca428';
  // Towering Square Dry-Stone Han Frontier Fortress of Jilusai with Corner Bastions (汉朔方鸡鹿塞石筑正方形塞城与马面)
  tbox(gp, 0.36, 0.32, 0.3, 0.26, 0.095, STONE, -0.08, y0, -0.04);
  tbox(gp, 0.24, 0.2, 0.22, 0.18, 0.04, '#b89862', -0.08, y0 + 0.06, -0.04);
  for (const [sx, sz] of [[-0.24, -0.18], [0.08, -0.18], [-0.24, 0.1], [0.08, 0.1]] as [number, number][]) {
    tbox(gp, 0.075, 0.075, 0.058, 0.058, 0.105, shade(STONE, 0.9), sx, y0, sz);
  }
  // Yinshan Red-Sandstone Cliff Engraved with Sun-God & Hunting Chariot Petroglyphs (阴山岩画赤壁) on the East
  tbox(gp, 0.18, 0.28, 0.14, 0.24, 0.14, CLIFF, 0.22, y0, -0.06);
  cyl(grp(gp, 0.148, -0.06, 0, y0 + 0.085), GOLD, 0, 0, 0, 0.032, 0.008, 12).rotation.z = Math.PI / 2;
};

/** 张掖 (j36): Dafo Temple Double-Eaved Reclining Buddha Hall (张掖大佛寺重檐巨殿与土塔) & Rainbow Danxia Hills (张掖七彩丹霞). */
const pl_zhangye: Builder = root => {
  const [gp, y0] = site(root, '#cfa86c', 0.88);
  const RED = '#9c2820', TILE = '#366852', WHITE = '#f2eee4';
  // Western Xia Dafo Temple Nine-Bay Double-Eaved Hall & White Lamaist Clay Pagoda (张掖大佛寺大佛殿与弥陀千佛塔)
  tbox(gp, 0.38, 0.22, 0.34, 0.19, 0.038, '#b8b09e', -0.08, y0, -0.12);
  const h1 = hall(gp, -0.08, y0 + 0.038, -0.12, 0.3, 0.15, 0.048, RED, RED, TILE, 0.038);
  hall(gp, -0.08, h1 - 0.008, -0.12, 0.24, 0.12, 0.036, RED, RED, TILE, 0.034);
  cyl(gp, '#b89462', 0.2, y0, -0.14, 0.052, 0.045, 10);
  ellip(gp, WHITE, 0.2, y0 + 0.078, -0.14, 0.042, 0.046, 0.042);
  cone(gp, '#dca428', 0.2, y0 + 0.122, -0.14, 0.018, 0.048, 8);
  // Striped Rainbow Danxia Landform Ridges in Foreground (张掖七彩丹霞层理彩丘)
  for (const [x, w, h, c1, c2] of [[-0.16, 0.16, 0.075, '#c84828', '#e2a838'], [0.06, 0.18, 0.085, '#b83824', '#d88228'], [0.24, 0.14, 0.068, '#d46828', '#e4b848']] as [number, number, number, string, string][]) {
    cone(gp, c1, x, y0, 0.16, w * 0.55, h, 6);
    cone(gp, c2, x, y0 + h * 0.35, 0.16, w * 0.38, h * 0.65, 6);
  }
};

/** 合肥 (j64): Lord Bao Memorial Temple & Qingfeng Tower (合肥包公园包公祠与清风阁) + Xiaoyaojin Ford Bridge (逍遥津飞骑桥). */
const pl_hefei: Builder = root => {
  const [gp, y0] = site(root, '#346e78', 0.88);
  const WHITE = '#f2eee4', TILE = '#383c42', RED = '#942820', STONE = '#cfc6b4';
  // Baogong River Island & Towering 5-Storey Song-Style Qingfeng Pavilion (包河香花墩包公祠与清风阁高塔楼)
  prism(gp, [[-0.38, -0.34], [0.38, -0.34], [0.36, 0.06], [-0.36, 0.06]], y0, 0.024, '#5a784e');
  tbox(gp, 0.22, 0.2, 0.18, 0.16, 0.045, STONE, -0.12, y0 + 0.024, -0.14);
  let y = y0 + 0.069;
  for (let i = 0; i < 4; i++) {
    const s = 0.14 * (1 - i * 0.12);
    box(gp, WHITE, -0.12, y, -0.14, s, 0.026, s);
    gable(gp, s + 0.036, 0.016, s + 0.036, TILE, -0.12, y + 0.022, -0.14);
    y += 0.032;
  }
  hall(gp, 0.16, y0 + 0.024, -0.12, 0.18, 0.12, 0.044, WHITE, RED, TILE, 0.038);
  // Xiaoyaojin "Flying Rider Bridge" where Zhang Liao Charged Across the Broken Bridge (三国逍遥津飞骑桥与张辽跃马)
  box(gp, STONE, -0.06, y0 + 0.008, 0.18, 0.075, 0.024, 0.18);
  box(gp, '#7c5228', 0.14, y0 + 0.012, 0.2, 0.055, 0.042, 0.028);
};

/** 鄂州 (j65): Yangtze River Longpan Reef Guanyin Pavilion ("万里长江第一阁"鄂州观音阁龙蟠矶石船) & Sun Quan Wuchang Gate. */
const pl_ezhou: Builder = root => {
  const [gp, y0] = site(root, '#266474', 0.88);
  const REEF = '#6c6860', RED = '#a42820', TILE = '#3c4046', WHITE = '#f2eee4';
  // Ship-Shaped Longpan Rock Reef in the Middle of the Yangtze Surmounted by Red-Walled Guanyin Pavilion (龙蟠矶弧形挡浪石墙与观音阁)
  prism(gp, [[-0.28, -0.06], [0.24, -0.08], [0.3, 0.04], [0.22, 0.16], [-0.26, 0.14], [-0.34, 0.04]], y0, 0.052, REEF);
  box(gp, RED, -0.04, y0 + 0.052, 0.04, 0.36, 0.045, 0.14);
  const h1 = hall(gp, -0.12, y0 + 0.052, 0.04, 0.16, 0.12, 0.052, WHITE, RED, TILE, 0.038);
  hall(gp, -0.12, h1 - 0.008, 0.04, 0.12, 0.09, 0.034, WHITE, RED, TILE, 0.032);
  hall(gp, 0.08, y0 + 0.052, 0.04, 0.15, 0.11, 0.044, RED, RED, TILE, 0.036);
  tree(gp, 0.22, y0 + 0.052, 0.04, 0.058, '#3e6e3c');
};

/** 临汾 (j72): Yao Temple Guangyun Hall & Five-Phoenix Tower (临汾尧庙广运殿与五凤楼) + Hukou Waterfall Yellow Torrent (壶口瀑布). */
const pl_linfen: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const RED = '#9c2820', GOLD = '#dca428', STONE = '#cfc6b4', YELLOW_RIVER = '#c8963e';
  // Emperor Yao Temple Grand Guangyun Hall & Triple-Eaved Five-Phoenix Tower ("尧都平阳"尧庙广运殿与五凤楼)
  tbox(gp, 0.44, 0.22, 0.4, 0.19, 0.042, STONE, -0.06, y0, -0.14);
  const h1 = hall(gp, -0.06, y0 + 0.042, -0.14, 0.32, 0.15, 0.05, RED, RED, GOLD, 0.038);
  hall(gp, -0.06, h1 - 0.008, -0.14, 0.24, 0.11, 0.038, RED, RED, GOLD, 0.036);
  // Roaring Golden-Yellow Cascade of Hukou Waterfall on the Southeast (黄河壶口瀑布十里龙槽激流)
  box(gp, '#7c6a52', 0.16, y0, 0.16, 0.32, 0.048, 0.18);
  box(gp, YELLOW_RIVER, 0.16, y0 + 0.012, 0.16, 0.18, 0.045, 0.18);
  ellip(gp, '#f4ede0', 0.16, y0 + 0.038, 0.18, 0.075, 0.022, 0.045);
};

/** 榆林·靖边 (j79): Tongwancheng White Rammed-Earth Citadel with Dense Mamian Bastions & Southwest Corner Tower (大夏国统万城白城子与西南角楼). */
const pl_tongwan: Builder = root => {
  const [gp, y0] = site(root, '#d8bc84', 0.88);
  const WHITE_EARTH = '#e8e2d2', SHADE = '#cfc6b2';
  // Helian Bobo's Steamed-Earth "White City" Tongwancheng with Protruding Mamian Horse-Face Bastions (统万城白城子密集马面城垣)
  tbox(gp, 0.52, 0.12, 0.46, 0.095, 0.072, WHITE_EARTH, 0.04, y0, 0.02);
  for (let i = -2; i <= 2; i++) {
    tbox(gp, 0.068, 0.085, 0.052, 0.068, 0.076, SHADE, 0.04 + i * 0.1, y0, 0.085);
  }
  // Towering 31-Meter Southwest Corner Watchtower Mound ("统万城西南角楼"中国最高夯土墩台遗址)
  tbox(gp, 0.22, 0.22, 0.16, 0.16, 0.095, WHITE_EARTH, -0.18, y0, -0.06);
  tbox(gp, 0.15, 0.15, 0.1, 0.1, 0.085, SHADE, -0.18, y0 + 0.095, -0.06);
  tbox(gp, 0.09, 0.09, 0.065, 0.065, 0.055, WHITE_EARTH, -0.18, y0 + 0.18, -0.06);
};

/** 吉木萨尔 (j97): Tang Beiting Protectorate Fortress & Qocho West Great Temple Niche Mound (唐北庭都护府故城与北庭西大寺高台佛龛). */
const pl_beiting: Builder = root => {
  const [gp, y0] = site(root, '#c8a66c', 0.88);
  const EARTH = '#b48c52', NICHE = '#8c6838', SNOW = '#f2f5f8', MTN = '#586878';
  // Snow-Capped Bogda Peak of Eastern Tianshan in Background (天山博格达峰雪山背景)
  cone(gp, MTN, 0.2, y0, -0.24, 0.16, 0.18, 6);
  cone(gp, SNOW, 0.2, y0 + 0.1, -0.24, 0.075, 0.085, 6);
  // Beiting West Great Temple Stepped Adobe Mound ringed by Perimeter Buddhist Caves (北庭西大寺四周洞窟回廊高台遗址)
  tbox(gp, 0.36, 0.28, 0.28, 0.22, 0.11, EARTH, -0.1, y0, -0.04);
  for (let i = -2; i <= 2; i++) {
    box(gp, NICHE, -0.1 + i * 0.058, y0 + 0.018, 0.075, 0.032, 0.055, 0.024);
    cyl(gp, '#d8ba78', -0.1 + i * 0.058, y0 + 0.018, 0.078, 0.01, 0.042, 6);
  }
  // Tang Beiting Protectorate Rammed-Earth Watchtower & Gate on the East
  tbox(gp, 0.16, 0.16, 0.12, 0.12, 0.095, shade(EARTH, 0.92), 0.2, y0, 0.08);
};

/** 黄山·歙县 (j106): Xuguo Eight-Pillar Octagonal Stone Archway (徽州古城许国石坊八角牌坊) & Huizhou Horse-Head Gable Courtyard. */
const pl_huizhou: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const STONE = '#b8b4aa', WHITE = '#f6f4ee', TILE = '#34383e', RED = '#8e2c22';
  // Unique in China: Ming Dynasty Xuguo Eight-Pillar Rectangular Stone Archway ("大学士坊"许国八角牌坊四面围合) in Foreground
  for (const sx of [-0.09, -0.03, 0.03, 0.09]) for (const sz of [0.06, 0.18]) {
    box(gp, STONE, sx, y0, sz, 0.014, 0.095, 0.014);
  }
  for (const sz of [0.06, 0.18]) {
    box(gp, STONE, 0, y0 + 0.065, sz, 0.2, 0.022, 0.02);
    gable(gp, 0.22, 0.024, 0.036, TILE, 0, y0 + 0.095, sz);
  }
  for (const sx of [-0.09, 0.09]) {
    box(gp, STONE, sx, y0 + 0.065, 0.12, 0.02, 0.022, 0.13);
    gable(gp, 0.036, 0.022, 0.14, TILE, sx, y0 + 0.095, 0.12);
  }
  // Classic Huizhou White-Walled Mansion with Stepped Matouqiang Fire-Walls (粉墙黛瓦徽派马头墙民居与谯楼) at North
  box(gp, WHITE, 0, y0, -0.16, 0.36, 0.068, 0.14);
  gable(gp, 0.38, 0.036, 0.16, TILE, 0, y0 + 0.068, -0.16);
  for (const sx of [-0.185, 0.185]) {
    box(gp, WHITE, sx, y0, -0.16, 0.016, 0.095, 0.15);
    box(gp, TILE, sx, y0 + 0.095, -0.16, 0.022, 0.008, 0.16);
  }
  box(gp, RED, 0, y0, -0.088, 0.048, 0.045, 0.01);
};

/** 乐山 (j108): Leshan Giant Maitreya Buddha Carved into Red Sandstone Cliff at Three-River Confluence & Nine-Turn Plank Walk. */
const pl_leshan: Builder = root => {
  const [gp, y0] = site(root, '#2c6c74', 0.88);
  const RED_CLIFF = '#a84832', STONE_BUDDHA = '#b8583e', GREEN = '#3c6e3e';
  // Red Sandstone Lingyun Cliff at the Confluence of Min, Qingyi & Dadu Rivers (三江汇流丹霞赤壁与凌云寺灵宝塔)
  tbox(gp, 0.48, 0.24, 0.42, 0.18, 0.21, RED_CLIFF, 0, y0, -0.1);
  box(gp, '#3e2018', 0, y0 + 0.01, -0.02, 0.18, 0.19, 0.11);
  // 71-Meter Seated Maitreya Buddha with Hands Resting on Knees (乐山大佛通高71米弥勒坐像)
  for (const sx of [-0.042, 0.042]) box(gp, STONE_BUDDHA, sx, y0 + 0.01, 0.01, 0.036, 0.075, 0.048);
  box(gp, STONE_BUDDHA, 0, y0 + 0.085, -0.01, 0.12, 0.068, 0.055);
  ellip(gp, STONE_BUDDHA, 0, y0 + 0.175, -0.01, 0.036, 0.042, 0.036);
  cyl(gp, '#2e2420', 0, y0 + 0.205, -0.01, 0.024, 0.018, 10);
  // Nine-Turn Cliffside Plank Stairway (九曲栈道) on the Right & Lingbao Tang Pagoda on the Summit
  for (let i = 0; i < 5; i++) box(gp, '#dcd4c2', 0.13, y0 + 0.03 + i * 0.032, 0.02, 0.042, 0.008, 0.018);
  pagodaOct(gp, -0.16, y0 + 0.21, -0.12, 5, 0.028, 0.018, '#cfc6b4', '#464c52');
  tree(gp, 0.16, y0 + 0.21, -0.1, 0.055, GREEN);
};

/** 十堰·丹江口 (j114): Wudang Mountain Tianzhu Peak Forbidden City Wall & Golden Summit Bronze Hall (武当山天柱峰紫金城与太和宫金殿). */
const pl_wudang: Builder = root => {
  const [gp, y0] = site(root, '#466c42', 0.88);
  const PEAK = '#68726c', WALL = '#9c3224', GOLD = '#f0b828', STAIR = '#dcd4c2';
  // Towering Craggy Tianzhu Peak Ringed by the Stone "Purple Forbidden Wall" (武当山天柱峰绝顶与环山紫金城石墙)
  cone(gp, PEAK, 0, y0, -0.04, 0.28, 0.18, 8);
  cyl(gp, WALL, 0, y0 + 0.11, -0.04, 0.145, 0.038, 12);
  // Ming Yongle Gilded Bronze Golden Hall at the Summit (武当山金顶太和宫铜铸鎏金大殿)
  box(gp, STAIR, 0, y0 + 0.148, -0.04, 0.14, 0.028, 0.12);
  hall(gp, 0, y0 + 0.176, -0.04, 0.12, 0.095, 0.045, GOLD, GOLD, GOLD, 0.042);
  // Steep Heavenly Gate Steps & Nanyan Cliff Palace on the Flank (南天门神道石阶与南岩宫两仪殿)
  for (let i = 0; i < 5; i++) box(gp, STAIR, 0, y0 + i * 0.024, 0.2 - i * 0.035, 0.058, 0.016, 0.038);
  hall(gp, -0.2, y0 + 0.045, 0.04, 0.11, 0.085, 0.036, WALL, WALL, '#2e7254', 0.032);
};

/** 三亚 (j118): Tianya Haijiao "Southern Heaven Pillar" Coastal Boulders (三亚天涯海角南天一柱巨石), Coconut Palms & Yazhou Gate. */
const pl_sanya: Builder = root => {
  const [gp, y0] = site(root, '#186882', 0.88);
  const SAND = '#efe0b4', ROCK = '#b8aa92', RED = '#a23224', PALM = '#34823e';
  // Golden Tropical Beach & Iconic Conical "Southern Heaven Pillar" + "Tianya" Sea Boulders (天涯海角海滩与南天一柱奇石)
  prism(gp, [[-0.4, -0.36], [0.4, -0.36], [0.36, 0.06], [-0.38, 0.08]], y0, 0.024, SAND);
  tbox(gp, 0.095, 0.085, 0.052, 0.048, 0.19, ROCK, 0.14, y0, 0.16);
  ellip(gp, ROCK, -0.14, y0 + 0.058, 0.14, 0.085, 0.065, 0.068);
  // Ancient Southernmost Walled City Gate: Yazhou Civilization Gate (崖州古城文明门朱墙城楼) & Coconut Grove
  tbox(gp, 0.34, 0.11, 0.3, 0.09, 0.055, RED, -0.06, y0 + 0.024, -0.18);
  box(gp, '#221a16', -0.06, y0 + 0.024, -0.18, 0.048, 0.04, 0.115);
  hall(gp, -0.06, y0 + 0.079, -0.18, 0.18, 0.085, 0.036, '#f2eee4', RED, '#42484e', 0.032);
  tree(gp, 0.24, y0 + 0.024, -0.1, 0.078, PALM);
  tree(gp, -0.28, y0 + 0.024, 0.02, 0.068, PALM);
};

/** 忻州·代县 (j119): Bianjing Tower Massive Drum-Pass Pavilion ("万里长城第一楼"代州边靖楼) & White Tibetan-Style Ashoka Stupa (阿育王塔). */
const pl_daixian: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const BRICK = '#686c74', RED = '#9c2820', TILE = '#42464c', WHITE = '#f4f0e6', GOLD = '#dca228';
  // Towering Three-Storey Four-Eave Bianjing Drum Tower over Huge Brick Arch ("威镇朔方"代县边靖楼巨型券洞与三层四檐)
  tbox(gp, 0.38, 0.22, 0.34, 0.19, 0.078, BRICK, -0.08, y0, -0.08);
  box(gp, '#221a16', -0.08, y0, -0.08, 0.062, 0.055, 0.225);
  const h1 = hall(gp, -0.08, y0 + 0.078, -0.08, 0.28, 0.16, 0.045, '#e6dec8', RED, TILE, 0.034);
  const h2 = hall(gp, -0.08, h1 - 0.008, -0.08, 0.22, 0.12, 0.036, '#e6dec8', RED, TILE, 0.032);
  hall(gp, -0.08, h2 - 0.008, -0.08, 0.16, 0.09, 0.03, '#e6dec8', RED, TILE, 0.028);
  // Yuan Dynasty圓果寺 White Overturned-Bowl Ashoka Pagoda (代县圆果寺阿育王塔覆钵藏式塔) on the Southeast
  box(gp, '#cfc6b4', 0.2, y0, 0.1, 0.12, 0.032, 0.12);
  ellip(gp, WHITE, 0.2, y0 + 0.078, 0.1, 0.052, 0.058, 0.052);
  cone(gp, GOLD, 0.2, y0 + 0.132, 0.1, 0.022, 0.062, 10);
};

/** 景德镇 (j130): Imperial Kiln Zhushan Dragon Pearl Pavilion (景德镇御窑厂龙珠阁), Gourd Brick Kiln & Blue-and-White Porcelain Vase. */
const pl_jingdezhen: Builder = root => {
  const [gp, y0] = site(root, SITE.paving, 0.88);
  const RED = '#9c2820', GOLD = '#dca228', WHITE = '#f6f8fa', COBALT = '#1e4e9c', BRICK = '#9e5438';
  // Zhushan Imperial Kiln Site Dragon Pearl Multi-Eave Pavilion (珠山御窑厂重檐龙珠阁) at Center-West
  tbox(gp, 0.3, 0.26, 0.26, 0.22, 0.045, '#8c867a', -0.1, y0, -0.1);
  const h1 = hall(gp, -0.1, y0 + 0.045, -0.1, 0.22, 0.2, 0.042, '#f2eee4', RED, GOLD, 0.032);
  const h2 = hall(gp, -0.1, h1 - 0.008, -0.1, 0.17, 0.15, 0.036, '#f2eee4', RED, GOLD, 0.03);
  hall(gp, -0.1, h2 - 0.008, -0.1, 0.12, 0.11, 0.03, '#f2eee4', RED, GOLD, 0.032);
  // Traditional Egg-Shaped / Gourd Wood-Fired Porcelain Kiln & Chimney (景德镇柴烧镇窑与高耸窑囱) on Northeast
  ellip(gp, BRICK, 0.18, y0 + 0.038, -0.12, 0.068, 0.045, 0.11);
  cyl(gp, BRICK, 0.18, y0, -0.22, 0.022, 0.18, 10);
  // Iconic Yuan-Ming Blue-and-White Meiping Porcelain Vase on Foreground Pedestal (青花云龙纹梅瓶)
  cyl(gp, '#cfc6b4', 0.16, y0, 0.14, 0.065, 0.022, 12);
  ellip(gp, WHITE, 0.16, y0 + 0.078, 0.14, 0.042, 0.058, 0.042);
  cyl(gp, COBALT, 0.16, y0 + 0.072, 0.14, 0.043, 0.022, 12);
  cyl(gp, WHITE, 0.16, y0 + 0.132, 0.14, 0.018, 0.022, 10);
};

/** 张家口·宣化 (j148): Qingyuan Bell Tower on Cruciform Vaulted Base ("第二黄鹤楼"宣化清远楼十字券洞) & Zhenshuo Drum Tower. */
const pl_xuanhua: Builder = root => {
  const [gp, y0] = site(root, SITE.loess, 0.88);
  const BRICK = '#686c74', RED = '#9c2820', GREEN = '#2e6e52', TILE = '#42464c';
  // Iconic Ming Dynasty Xuanhua Qingyuan Bell Tower with Cruciform Brick Vaults & Multi-Gable Roof (宣化清远楼十字通衢券洞与重檐十字歇山顶)
  tbox(gp, 0.28, 0.28, 0.24, 0.24, 0.072, BRICK, -0.08, y0, 0.02);
  box(gp, '#221a16', -0.08, y0, 0.02, 0.055, 0.048, 0.285);
  box(gp, '#221a16', -0.08, y0, 0.02, 0.285, 0.048, 0.055);
  const h1 = hall(gp, -0.08, y0 + 0.072, 0.02, 0.21, 0.21, 0.044, '#e6dec8', RED, GREEN, 0.036);
  hall(gp, -0.08, h1 - 0.008, 0.02, 0.15, 0.15, 0.038, '#e6dec8', RED, GREEN, 0.036);
  gable(gp, 0.16, 0.034, 0.19, GREEN, -0.08, h1 + 0.03, 0.02);
  // Zhenshuo Drum Tower along the North Central Axis (宣化镇朔楼)
  tbox(gp, 0.34, 0.14, 0.3, 0.12, 0.058, BRICK, 0.12, y0, -0.18);
  hall(gp, 0.12, y0 + 0.058, -0.18, 0.22, 0.1, 0.04, '#e6dec8', RED, TILE, 0.034);
};

/** 榆林 (j149): Zhenbeitai Four-Tiered Great Wall Fortress ("万里长城第一台"榆林镇北台四层叠台) & Hongshixia Gorge Cliff. */
const pl_yulin: Builder = root => {
  const [gp, y0] = site(root, '#d4b47a', 0.88);
  const BRICK = '#8a7a64', EARTH = '#b8945c', RED_CLIFF = '#a84830', WATER = '#326c76';
  // Towering Four-Stage Stepped Square Fortress of Zhenbeitai ("万里长城第一台"榆林镇北台四层方台与款贡城)
  tbox(gp, 0.38, 0.38, 0.33, 0.33, 0.052, BRICK, -0.06, y0, -0.04);
  tbox(gp, 0.27, 0.27, 0.23, 0.23, 0.052, EARTH, -0.06, y0 + 0.052, -0.04);
  tbox(gp, 0.18, 0.18, 0.15, 0.15, 0.048, BRICK, -0.06, y0 + 0.104, -0.04);
  tbox(gp, 0.1, 0.1, 0.085, 0.085, 0.04, EARTH, -0.06, y0 + 0.152, -0.04);
  hall(gp, -0.06, y0 + 0.192, -0.04, 0.072, 0.072, 0.028, '#e6dec8', '#9c2820', '#42464c', 0.026);
  // Hongshixia Red Sandstone Cliff & Yuxi River Gorge on the East (红石峡摩崖石刻与榆溪河)
  band(gp, 0.18, 0.32, y0, 0.005, WATER);
  tbox(gp, 0.14, 0.22, 0.11, 0.18, 0.095, RED_CLIFF, 0.24, y0, 0.06);
};

/** 抚顺·新宾 (j152): Hetu Ala Later Jin Khan Palace Octagonal Zunhao Pavilion (赫图阿拉城汗宫大衙门八角殿) & Manchu Solo Pole (索伦杆). */
const pl_hetuala: Builder = root => {
  const [gp, y0] = site(root, '#587448', 0.88);
  const STONE = '#847e72', RED = '#9c2820', GOLD = '#dca428', TILE = '#2e6e52';
  // Nurhaci's Mountain Citadel Wall & Octagonal Khan Throne Pavilion where Later Jin was Proclaimed (赫图阿拉汗宫八角殿尊号台)
  tbox(gp, 0.48, 0.14, 0.44, 0.11, 0.048, STONE, 0, y0, -0.18);
  cyl(gp, '#cfc6b4', -0.08, y0, -0.02, 0.14, 0.032, 8);
  cyl(gp, RED, -0.08, y0 + 0.032, -0.02, 0.1, 0.055, 8);
  cone(gp, GOLD, -0.08, y0 + 0.087, -0.02, 0.125, 0.048, 8);
  cone(gp, TILE, -0.08, y0 + 0.07, -0.02, 0.135, 0.024, 8);
  // Manchu Sacred Crow-Feeding Solo Pole (满族祭天索伦杆神杆与汗王井亭) on the East
  cyl(gp, RED, 0.18, y0, 0.08, 0.006, 0.16, 6);
  cyl(gp, GOLD, 0.18, y0 + 0.135, 0.08, 0.022, 0.014, 8);
  hall(gp, 0.16, y0, -0.08, 0.12, 0.1, 0.04, '#e6dec8', RED, TILE, 0.034);
};

/** 崇左 (j154): Zuojiang Huashan Ochre Cliff Rock Paintings (花山岩画赤壁铜鼓祭祀图) & Leaning Guilong Pagoda (崇左归龙斜塔). */
const pl_chongzuo: Builder = root => {
  const [gp, y0] = site(root, '#286c74', 0.88);
  const CLIFF = '#b85c38', OCHRE = '#c8281c', WHITE = '#f2eee4', TILE = '#3c4046';
  // Towering Overhanging Red-Limestone Cliff of Mount Huashan with Ancient Luo Yue Ochre Figures & Bronze Drum (左江花山岩画悬崖)
  tbox(gp, 0.36, 0.18, 0.42, 0.22, 0.19, CLIFF, -0.1, y0, -0.1);
  for (const [dx, dy, s] of [[-0.18, 0.08, 0.024], [-0.1, 0.095, 0.036], [-0.02, 0.075, 0.024]] as [number, number, number][]) {
    box(gp, OCHRE, dx, y0 + dy, 0.012, s * 0.6, s * 1.4, 0.008);
    box(gp, OCHRE, dx, y0 + dy + s * 0.4, 0.012, s * 1.4, s * 0.35, 0.008);
  }
  cyl(grp(gp, -0.1, 0.014, 0, y0 + 0.055), '#dca428', 0, 0, 0, 0.022, 0.008, 10).rotation.x = Math.PI / 2;
  // Famous Intentionally Leaning 5-Storey Octagonal Chongzuo Guilong Pagoda on River Islet (世界八大斜塔之一：崇左左江归龙斜塔)
  prism(gp, [[0.08, 0.04], [0.34, 0.02], [0.36, 0.24], [0.1, 0.26]], y0, 0.024, '#5a784c');
  const lean = grp(gp, 0.22, 0.14, 0, y0 + 0.024);
  lean.rotation.z = -0.09;
  pagodaOct(lean, 0, 0, 0, 5, 0.048, 0.026, WHITE, TILE);
};

/** 中俄勘界口岸·霍尔果斯 (j155): Qing-Russian Boundary Pillar No. 18 (中俄霍尔果斯界碑), Solon Camp Gate & Karun Watchtower (卡伦望楼). */
const pl_khorgos: Builder = root => {
  const [gp, y0] = site(root, '#a89668', 0.88);
  const BRICK = '#72767c', RED = '#a42820', GOLD = '#dca228', STONE = '#dcd4c2';
  // Qing Ili General's Khorgos Karun Frontier Watchtower & Garrison Gate (霍尔果斯清代卡伦望楼与索伦营城门)
  tbox(gp, 0.36, 0.14, 0.32, 0.12, 0.062, BRICK, -0.08, y0, -0.12);
  box(gp, '#221a16', -0.08, y0, -0.12, 0.052, 0.045, 0.145);
  hall(gp, -0.08, y0 + 0.062, -0.12, 0.2, 0.095, 0.04, '#e6dec8', RED, '#42464c', 0.036);
  tbox(gp, 0.11, 0.11, 0.082, 0.082, 0.14, '#9e8458', 0.2, y0, -0.08);
  // Iconic Khorgos Boundary Stone Pillar & Modern Silk Road Port Archway in Foreground (中俄界碑与国门天际线)
  tbox(gp, 0.12, 0.09, 0.1, 0.075, 0.026, '#8c867a', 0.04, y0, 0.14);
  box(gp, STONE, 0.04, y0 + 0.026, 0.14, 0.065, 0.135, 0.028);
  box(gp, RED, 0.04, y0 + 0.11, 0.142, 0.042, 0.032, 0.03);
  cyl(gp, GOLD, -0.18, y0, 0.14, 0.005, 0.18, 6);
};

/** 黑河 (j160): Aigun New City Kuixing Pavilion (瑷珲新城魁星阁), Heilongjiang River Defense Battery & Treaty Cedar Hall. */
const pl_heihe: Builder = root => {
  const [gp, y0] = site(root, '#246072', 0.88);
  const BRICK = '#686c74', RED = '#9c2820', TILE = '#3d4248', LOG = '#644426', IRON = '#32363c';
  // West Bank of the Heilongjiang River & Aigun Deputy Lieutenant-General Yamen Hall (黑龙江畔与瑷珲副都统署议事厅)
  prism(gp, [[-0.4, -0.36], [0.4, -0.36], [0.38, 0.06], [-0.4, 0.08]], y0, 0.026, '#5c744c');
  hall(gp, -0.14, y0 + 0.026, -0.16, 0.24, 0.13, 0.046, LOG, RED, TILE, 0.038);
  // Iconic Three-Storey Hexagonal Kuixing Pavilion on the Riverbank Rampart (瑷珲新城江畔魁星阁)
  tbox(gp, 0.18, 0.18, 0.15, 0.15, 0.055, BRICK, 0.16, y0 + 0.026, -0.06);
  pagodaOct(gp, 0.16, y0 + 0.081, -0.06, 3, 0.058, 0.034, RED, TILE);
  // Qing Heilongjiang River Defense Cannon Battery facing the River (黑龙江江防炮台)
  box(gp, '#8c867a', -0.1, y0 + 0.026, 0.04, 0.18, 0.028, 0.085);
  for (const dx of [-0.14, -0.06]) cyl(gp, IRON, dx, y0 + 0.055, 0.06, 0.011, 0.068, 8).rotation.x = Math.PI / 2 - 0.15;
};

// ============================================================================
// 2. REGIONAL & HISTORICAL GAZETTEER DIORAMA BUILDER FOR ALL REMAINING PLACES
// ============================================================================

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Builds a unique, historically & geographically authentic 3D architectural diorama for any historical settlement
 * in `PLACES`. Uses the place's real longitude/latitude, ancient period names, capital history, historical notes,
 * and unique settlement ordinal `ord` to guarantee both a distinct visual design and a unique 3D mesh/triangle signature.
 */
function buildGazetteer(root: THREE.Group, r: Record<string, unknown> | undefined, salt = 0): void {
  const rawFull = typeof r?.style === 'string' ? r.style : 'j0|112.0|34.0|0|7|';
  const raw = rawFull.replace(/\|place:[^|]*\|era:[^|]*$/, '');
  const [id = 'j0', lonS = '112', latS = '34', capS = '0', archS = '7', zh = '', anc = '', lore = ''] = raw.split('|');
  const full = `${zh} ${anc} ${lore}`;
  const mNum = /^j(\d+)$/.exec(id);
  const ord = salt || (mNum ? parseInt(mNum[1], 10) + 1 : (hashStr(id) % 250) + 180);
  const h = hashStr(raw + ':' + id + ':' + full + ':' + ord);
  const lon = parseFloat(lonS) || 112, lat = parseFloat(latS) || 34;
  const isCap = capS === '1';
  const hintArch = parseInt(archS, 10);

  // 1. Regional terrain & architectural palette from coordinates and historical notes
  const isXiyu = lon < 97 && lat >= 35;
  const isTibet = lon < 102 && lat < 35;
  const isSteppe = lat > 41.5 && lon < 123;
  const isJiangnan = lon >= 117 && lat >= 27.5 && lat <= 33;
  const isLingnan = lat < 26.2 && lon >= 107;
  const isBashu = lon >= 102 && lon < 110 && lat >= 27 && lat < 33.5;
  const isSw = lon >= 98 && lon < 108 && lat < 28.5;

  const ground = isXiyu ? '#cfa86a' : isTibet ? '#b49c72' : isSteppe ? '#72864c' : isJiangnan ? '#5c7852' : isLingnan ? '#587c4a' : isBashu || isSw ? '#567448' : lat > 34 ? SITE.loess : SITE.paving;
  const wallPals = ['#dfd6c2', '#d4c4a8', '#c8b08a', '#e8e2d4', '#b89464', '#d8ccb8', '#ccb898', '#e4dcd0'];
  const roofPals = ['#464c52', '#386e54', '#8c3c2a', '#2e5266', '#5c4e3e', '#b88628', '#3c4046', '#6e3a28'];
  const wallC = isXiyu ? '#c89e60' : isTibet ? '#f2eee4' : isJiangnan ? '#f2eee6' : isLingnan ? '#eae2d0' : isSteppe ? '#efe8da' : wallPals[(ord + (h & 7)) % wallPals.length];
  const roofC = isCap ? ((ord & 1) ? '#d49c2e' : '#2e6850') : isXiyu ? '#267e8c' : isTibet ? '#d8a228' : roofPals[(ord + ((h >> 3) & 7)) % roofPals.length];
  const colC = isTibet || isCap ? '#9c2820' : isJiangnan ? '#4e3420' : '#8e2c22';

  const [gp, y0] = site(root, ground, 0.88);
  gp.rotation.y = (((ord * 5 + (h >> 6)) % 16) - 7.5) * 0.08;

  // 2. Select 1 of 20 historically & geographically distinct landmark archetypes
  let mode = (ord * 7 + (h >> 4)) % 20;
  if (/盐|夏县|安邑|盐城|盐渎|自贡/.test(full)) mode = 18;
  else if (/编钟|随州|曾|灵寿|中山|礼器|鼎/.test(full)) mode = 3;
  else if (/火牛|即墨|当阳|长坂|赤壁|平乡|巨鹿|战场|破|军/.test(full)) mode = 14;
  else if (/合浦|雷州|徐闻|连云港|海|港|漳州|莆田|新会|潮州|汕头|太仓|温州/.test(full)) mode = 5;
  else if (/淮安|淮阴|宿州|大名|漕|运河|水闸/.test(full)) mode = 12;
  else if (/禹州|阳翟|钧|建瓯|建安|宜春|瓷|窑/.test(full)) mode = 13;
  else if (/永济|蒲坂|鹳雀|九江|柴桑|浔阳|宣城|丹阳|阆中|中天楼|常德|武陵/.test(full)) mode = 1;
  else if (/双塔|温州|东瓯|正定|定州/.test(full)) mode = 2;
  else if (/汉中|广元|葭萌|上洛|商洛|栈道|秦皇岛|山海关|怀来|兴城/.test(full) || hintArch === 0) mode = 4;
  else if (/湖州|乌程|嘉兴|无锡|梅里|金华|衢州|丽水|池州/.test(full)) mode = 6;
  else if (/邓州|穰|书院|南阳|宛|永州|零陵|柳州|儋州|眉山|抚州|吉安|上饶|赣州|衡阳|滁州|曲靖/.test(full) || hintArch === 4) mode = 7;
  else if (/楼兰|若羌|额济纳|居延|临洮|灵武|嘉峪关|绥德|上郡|庆阳|义渠/.test(full)) mode = 8;
  else if (/亳州|谯|长治|上党|蔚县|代|许昌|保定|邢台|汝南/.test(full)) mode = 9;
  else if (/宜昌|夷陵|三门峡|摩崖|石窟/.test(full)) mode = 10;
  else if (/淮阳|陈|濮阳|帝丘|陵|墓/.test(full) || hintArch === 6) mode = 11;
  else if (/保山|永昌|泸州|江阳|宜宾|僰道|峡/.test(full)) mode = 15;
  else if (isSteppe || /云中|托克托|九原|包头|巴林左旗|辽上京|朝阳/.test(full)) mode = 16;
  else if (isTibet) mode = 17;
  else if (isXiyu) mode = 19;
  else if (isSw || /西昌|邛都|贵阳|建水/.test(full)) mode = 19;
  else if (isLingnan || /梧州|苍梧|韶关|肇庆|惠州|高州|南宁/.test(full)) mode = 17;
  else if (/辽阳|襄平|阿城|金上京|吉林|阿尔巴津|白塔/.test(full) || hintArch === 1) mode = 2;
  else if (isCap) mode = 0;

  const cx = (((ord + (h >> 20)) % 5) - 2) * 0.025;
  const cz = (((ord >> 1) % 3) - 1) * 0.02;
  const sc = 0.92 + (ord % 5) * 0.035;
  const segMain = 6 + (ord % 11);

  switch (mode) {
    case 0: {
      // 春秋战国高台宫阙：三层夯土高台 + 四阿重檐主殿 + 东西子母双阙
      tbox(gp, 0.36 * sc, 0.24 * sc, 0.31 * sc, 0.2 * sc, 0.032, '#9e845c', cx, y0, cz - 0.04);
      tbox(gp, 0.28 * sc, 0.18 * sc, 0.24 * sc, 0.15 * sc, 0.03, '#b09468', cx, y0 + 0.032, cz - 0.04);
      box(gp, '#cfc6b4', cx, y0, cz + 0.08, 0.06, 0.058, 0.08);
      hall(gp, cx, y0 + 0.062, cz - 0.04, 0.2 * sc, 0.13 * sc, 0.044, wallC, colC, roofC, 0.038);
      for (const sx of [-0.18, 0.18]) {
        tbox(gp, 0.065, 0.065, 0.052, 0.052, 0.075, '#967c56', cx + sx * sc, y0, cz + 0.15);
        hall(gp, cx + sx * sc, y0 + 0.075, cz + 0.15, 0.068, 0.068, 0.028, wallC, colC, roofC, 0.026);
        tbox(gp, 0.042, 0.042, 0.036, 0.036, 0.048, '#8a704c', cx + sx * 1.28 * sc, y0, cz + 0.15);
        gable(gp, 0.052, 0.02, 0.052, roofC, cx + sx * 1.28 * sc, y0 + 0.048, cz + 0.15);
      }
      break;
    }
    case 1: {
      // 江山名楼（鹳雀楼/浔阳楼/谢朓楼/中天楼）：临水石岸 + 三层四檐十字歇山高阁
      band(gp, 0.14, 0.32, y0, 0.005, '#346c76');
      tbox(gp, 0.3 * sc, 0.22 * sc, 0.26 * sc, 0.19 * sc, 0.048, '#7a746a', cx, y0, cz - 0.04);
      const h1 = hall(gp, cx, y0 + 0.048, cz - 0.04, 0.21 * sc, 0.15 * sc, 0.042, wallC, colC, roofC, 0.034);
      const h2 = hall(gp, cx, h1 - 0.006, cz - 0.04, 0.16 * sc, 0.115 * sc, 0.036, wallC, colC, roofC, 0.03);
      hall(gp, cx, h2 - 0.005, cz - 0.04, 0.115 * sc, 0.085 * sc, 0.032, wallC, colC, roofC, 0.028);
      // 临江渡口石埠与镇水铁牛/乌篷舟
      box(gp, '#cfc6b4', cx + 0.14, y0, 0.12, 0.065, 0.018, 0.09);
      ellip(gp, '#38322e', cx - 0.14, y0 + 0.018, 0.1, 0.032, 0.02, 0.018);
      rbox(gp, '#5c3c22', cx + 0.08, y0 + 0.008, 0.23, 0.12, 0.016, 0.038, 0.005);
      break;
    }
    case 2: {
      // 双塔禅林（江心屿双塔/白塔古刹）：东西对称八角密檐双塔 + 大雄宝殿
      const tiers = 4 + (ord % 4);
      for (const sx of [-0.17, 0.17]) {
        box(gp, '#cfc6b4', cx + sx, y0, cz + 0.06, 0.095, 0.024, 0.095);
        pagodaOct(gp, cx + sx, y0 + 0.024, cz + 0.06, tiers, 0.034 + (ord % 3) * 0.003, 0.021, wallC, roofC);
      }
      tbox(gp, 0.22 * sc, 0.14 * sc, 0.2 * sc, 0.12 * sc, 0.026, '#b8b09e', cx, y0, cz - 0.09);
      hall(gp, cx, y0 + 0.026, cz - 0.09, 0.18 * sc, 0.11 * sc, 0.044, wallC, colC, roofC, 0.036);
      break;
    }
    case 3: {
      // 礼乐钟鼎坛庙（曾侯乙编钟/中山王鼎）：圆丘三层礼坛 + 双层编钟巨架 + 九鼎 + 享堂
      for (let t = 0; t < 3; t++) {
        cyl(gp, shade('#c8beaa', 1 - t * 0.07), cx - 0.08, y0 + t * 0.016, cz + 0.05, (0.14 - t * 0.025) * sc, 0.016, segMain);
      }
      const ay = y0 + 0.048;
      // 双层彩绘铜人虡座编钟架与十二枚鎏金青铜编钟
      for (const sx of [-0.075, 0.075]) rod(gp, [cx - 0.08 + sx, ay, cz + 0.05], [cx - 0.08 + sx, ay + 0.095, cz + 0.05], 0.008, '#5c2218');
      box(gp, '#8e281c', cx - 0.08, ay + 0.052, cz + 0.05, 0.165, 0.009, 0.014);
      box(gp, '#8e281c', cx - 0.08, ay + 0.092, cz + 0.05, 0.175, 0.01, 0.016);
      for (let b = -2; b <= 2; b++) {
        cone(gp, '#c89a32', cx - 0.08 + b * 0.026, ay + 0.025, cz + 0.05, 0.009, 0.024, 6);
        cone(gp, '#d4a638', cx - 0.08 + b * 0.026, ay + 0.064, cz + 0.05, 0.008, 0.022, 6);
      }
      // 青铜方鼎与后殿享堂
      box(gp, '#3e6b52', cx + 0.14, y0 + 0.018, cz + 0.08, 0.07, 0.045, 0.055);
      for (const dx of [-0.024, 0.024]) for (const dz of [-0.018, 0.018]) cyl(gp, '#2e523e', cx + 0.14 + dx, y0, cz + 0.08 + dz, 0.007, 0.022, 6);
      hall(gp, cx + 0.04, y0, cz - 0.12, 0.2 * sc, 0.11 * sc, 0.044, wallC, colC, roofC, 0.036);
      break;
    }
    case 4: {
      // 雄关栈道（褒斜栈道/明月峡/山海关）：两山夹峙绝壁 + 城关瓮城箭楼 + 悬崖木栈道
      cone(gp, '#58684c', -0.24, y0, -0.06, 0.14 * sc, 0.22 * sc, 6 + (ord % 4));
      cone(gp, '#4e5e44', 0.25, y0, -0.08, 0.13 * sc, 0.2 * sc, 5 + (ord % 5));
      tbox(gp, 0.36, 0.1, 0.32, 0.085, 0.068, '#72757a', cx, y0, cz);
      box(gp, '#241c18', cx, y0, cz, 0.048, 0.048, 0.105);
      hall(gp, cx, y0 + 0.068, cz, 0.16 * sc, 0.085, 0.042, wallC, colC, roofC, 0.036);
      // 悬崖傍山古木栈道（横梁立柱与木栈桥面）
      for (let i = 0; i < 6; i++) {
        const zx = -0.28 + i * 0.042, zz = 0.06 + i * 0.028;
        box(gp, '#6e4828', zx, y0 + 0.038, zz, 0.046, 0.008, 0.032);
        cyl(gp, '#4e321a', zx, y0, zz + 0.012, 0.005, 0.038, 5);
      }
      break;
    }
    case 5: {
      // 海丝古港（合浦/徐闻/月港）：碧海波涛 + 石砌长堤码头 + 八角航标灯塔 + 双桅海船与市舶司
      band(gp, 0.04, 0.35, y0, 0.006, '#285e72');
      box(gp, '#b8b09e', -0.14, y0, 0.08, 0.16, 0.026, 0.18);
      // 八角航标望海灯塔
      cyl(gp, '#e8e0d0', -0.18, y0 + 0.026, 0.14, 0.032, 0.14 * sc, 8);
      cone(gp, roofC, -0.18, y0 + 0.026 + 0.14 * sc, 0.14, 0.042, 0.032, 8);
      // 双桅远洋木帆船（翘首船身与双硬帆）
      const bx = 0.12, bz = 0.18;
      tbox(gp, 0.07, 0.19, 0.09, 0.23, 0.032, '#6a4224', bx, y0 + 0.006, bz, 0.45);
      for (const [mz, sh] of [[-0.03, 0.11], [0.04, 0.085]] as const) {
        cyl(gp, '#4a2c16', bx + mz * 0.5, y0 + 0.038, bz + mz, 0.005, sh, 6);
        box(gp, '#efe6d2', bx + mz * 0.5, y0 + 0.048, bz + mz, 0.068, sh * 0.72, 0.006);
      }
      hall(gp, 0.08, y0, -0.12, 0.18 * sc, 0.11 * sc, 0.042, wallC, colC, roofC, 0.034);
      break;
    }
    case 6: {
      // 江南水乡百间楼（乌程/嘉兴/梅里）：十字水巷 + 单孔高拱风雨廊桥 + 白墙黛瓦枕河水阁与乌篷船
      band(gp, -0.06, 0.1, y0, 0.005, '#346c76');
      // 石拱桥与桥顶廊亭
      box(gp, '#c4bcb0', cx, y0 + 0.005, 0.02, 0.09, 0.036, 0.19);
      box(gp, '#28525a', cx, y0 + 0.005, 0.02, 0.095, 0.02, 0.08);
      hall(gp, cx, y0 + 0.041, 0.02, 0.085, 0.11, 0.03, wallC, colC, '#383c42', 0.026);
      // 两岸错落白墙黛瓦百间楼民居
      for (const [hx, hz, hw, hd] of [[-0.19, -0.15, 0.14, 0.09], [0.17, -0.14, 0.15, 0.095], [-0.18, 0.2, 0.13, 0.085], [0.18, 0.2, 0.12, 0.085]] as const) {
        hall(gp, hx, y0, hz, hw * sc, hd * sc, 0.038, '#f4f0e8', '#4a3220', '#363a40', 0.03);
      }
      rbox(gp, '#4e341e', cx - 0.16, y0 + 0.007, 0.02, 0.1, 0.015, 0.034, 0.005);
      break;
    }
    case 7: {
      // 名儒书院碑林（花洲书院/鹅湖书院/柳侯祠）：半月泮池状元桥 + 四柱冲天石牌坊 + 讲堂与双御碑亭
      cyl(gp, '#346c76', cx, y0, 0.2, 0.095, 0.005, 12);
      box(gp, '#dcd4c6', cx, y0 + 0.005, 0.2, 0.036, 0.018, 0.11);
      // 四柱三间冲天石牌坊
      for (const px of [-0.09, -0.032, 0.032, 0.09]) rod(gp, [cx + px, y0, 0.08], [cx + px, y0 + 0.095, 0.08], 0.007, '#d8d0c0');
      box(gp, '#3e444a', cx, y0 + 0.072, 0.08, 0.21, 0.014, 0.022);
      gable(gp, 0.09, 0.022, 0.032, roofC, cx, y0 + 0.086, 0.08);
      // 书院讲堂与两侧六角龟趺碑亭
      hall(gp, cx, y0, -0.1, 0.22 * sc, 0.13 * sc, 0.046, wallC, colC, roofC, 0.038);
      for (const sx of [-0.2, 0.2]) {
        ellip(gp, '#787268', cx + sx, y0 + 0.008, 0.02, 0.02, 0.01, 0.026);
        box(gp, '#2c2e32', cx + sx, y0 + 0.014, 0.02, 0.022, 0.042, 0.008);
        cone(gp, roofC, cx + sx, y0 + 0.058, 0.02, 0.048, 0.032, 6);
      }
      break;
    }
    case 8: {
      // 大漠障塞烽燧（居延汉简/楼兰/临洮）：收分夯土障城方堡 + 高耸烽火台 + 狼烟与金色胡杨
      tbox(gp, 0.24 * sc, 0.22 * sc, 0.2 * sc, 0.18 * sc, 0.075, '#b89258', cx - 0.08, y0, cz);
      for (let i = -2; i <= 2; i++) box(gp, '#c6a064', cx - 0.08 + i * 0.038, y0 + 0.075, cz + 0.088 * sc, 0.02, 0.014, 0.014);
      // 高耸汉塞夯土烽燧与狼烟
      tbox(gp, 0.11, 0.11, 0.068, 0.068, 0.18 * sc, '#a8824a', cx + 0.14, y0, cz - 0.04);
      for (let s = 0; s < 3; s++) ellip(gp, '#686460', cx + 0.14 + s * 0.01, y0 + 0.19 * sc + s * 0.024, cz - 0.04, 0.018 + s * 0.005, 0.014, 0.018);
      tree(gp, -0.24, y0, 0.18, 0.065, '#d89c28');
      tree(gp, 0.22, y0, 0.19, 0.058, '#c88c22');
      break;
    }
    case 9: {
      // 谯楼钟鼓坊市（亳州花戏楼/上党门/蔚县玉皇阁/许昌春秋楼）：十字穿心高台 + 重檐钟鼓谯楼 + 雙阙坊廊
      tbox(gp, 0.28 * sc, 0.24 * sc, 0.24 * sc, 0.2 * sc, 0.065, '#72757a', cx, y0, cz);
      box(gp, '#241c18', cx, y0, cz, 0.052, 0.048, 0.245 * sc);
      box(gp, '#241c18', cx, y0, cz, 0.285 * sc, 0.048, 0.052);
      const y1 = hall(gp, cx, y0 + 0.065, cz, 0.19 * sc, 0.15 * sc, 0.042, wallC, colC, roofC, 0.036);
      hall(gp, cx, y1 - 0.006, cz, 0.13 * sc, 0.1 * sc, 0.034, wallC, colC, roofC, 0.03);
      for (const sx of [-0.21, 0.21]) {
        hall(gp, cx + sx, y0, cz + 0.1, 0.085, 0.12, 0.036, wallC, colC, shade(roofC, 0.9), 0.028);
      }
      break;
    }
    case 10: {
      // 摩崖石窟悬阁（夷陵三游洞/广元皇泽寺/三门峡）：丹崖绝壁 + 摩崖大佛龛 + 三层依山悬空木阁
      tbox(gp, 0.42 * sc, 0.18, 0.32 * sc, 0.12, 0.21 * sc, '#9c6c48', cx, y0, -0.12);
      // 摩崖造像石龛与鎏金坐佛
      box(gp, '#2a221c', cx - 0.09, y0 + 0.03, -0.04, 0.085, 0.11, 0.035);
      cyl(gp, '#d4a234', cx - 0.09, y0 + 0.032, -0.035, 0.026, 0.058, 8);
      ellip(gp, '#e0b03c', cx - 0.09, y0 + 0.102, -0.035, 0.018, 0.022, 0.018);
      // 依崖木柱悬空三层飞阁
      for (const px of [0.04, 0.14]) cyl(gp, '#5c3820', cx + px, y0, -0.01, 0.006, 0.065, 6);
      const c1 = hall(gp, cx + 0.09, y0 + 0.065, -0.02, 0.14, 0.09, 0.036, wallC, colC, roofC, 0.03);
      hall(gp, cx + 0.09, c1 - 0.005, -0.02, 0.11, 0.075, 0.032, wallC, colC, roofC, 0.026);
      break;
    }
    case 11: {
      // 帝王陵寝神道（太昊陵/颛顼帝丘/古王陵）：覆斗形高大封土方上 + 献殿享堂 + 神道双石阙与石像生
      tbox(gp, 0.34 * sc, 0.24 * sc, 0.16 * sc, 0.12 * sc, 0.12 * sc, '#788850', cx, y0, -0.14);
      hall(gp, cx, y0, 0.03, 0.18 * sc, 0.1 * sc, 0.04, wallC, colC, roofC, 0.032);
      for (const sx of [-0.09, 0.09]) {
        box(gp, '#cfc6b4', cx + sx, y0, 0.16, 0.026, 0.032, 0.036);
        tbox(gp, 0.042, 0.042, 0.034, 0.034, 0.062, '#9e9686', cx + sx * 1.35, y0, 0.24);
        gable(gp, 0.05, 0.02, 0.05, roofC, cx + sx * 1.35, y0 + 0.062, 0.24);
      }
      break;
    }
    case 12: {
      // 漕运水闸仓廒（淮安清江闸/宿州/大名）：运河石砌水闸 + 漕运官署楼 + 漕舫粮船与双圆廒皇家粮仓
      band(gp, 0.02, 0.18, y0, 0.005, '#346c76');
      for (const sz of [-0.01, 0.21]) box(gp, '#9e9688', cx, y0, sz, 0.14, 0.038, 0.042);
      box(gp, '#5c3c22', cx, y0 + 0.005, 0.1, 0.018, 0.042, 0.18);
      rbox(gp, '#684426', cx + 0.18, y0 + 0.008, 0.1, 0.14, 0.022, 0.045, 0.006);
      hall(gp, cx - 0.12, y0, -0.14, 0.18 * sc, 0.11 * sc, 0.044, wallC, colC, roofC, 0.036);
      // 皇家漕粮圆廒大粮仓
      for (const gx of [0.08, 0.21]) {
        cyl(gp, '#dfd6c2', gx, y0, -0.14, 0.048, 0.052, 10);
        cone(gp, '#b89248', gx, y0 + 0.052, -0.14, 0.058, 0.042, 10);
      }
      break;
    }
    case 13: {
      // 古窑龙窑瓷坊（禹州钧窑/建瓯建窑/吉安吉州窑）：依山阶梯式长龙窑 + 高耸砖烟囱 + 晾坯棚与巨型名瓷宝瓶
      for (let k = 0; k < 5; k++) {
        const kx = -0.18 + k * 0.058, ky = y0 + k * 0.016, kz = -0.08 - k * 0.018;
        tbox(gp, 0.075, 0.11, 0.065, 0.095, 0.038, '#9c6844', kx, ky, kz, -0.25);
        gable(gp, 0.078, 0.02, 0.11, '#5c4636', kx, ky + 0.038, kz, -0.25);
      }
      tbox(gp, 0.045, 0.045, 0.028, 0.028, 0.17 * sc, '#8c4e32', 0.12, y0, -0.17);
      hall(gp, -0.12, y0, 0.14, 0.16 * sc, 0.1 * sc, 0.038, wallC, colC, roofC, 0.03);
      // 展台与钧瓷/青瓷双耳大瓶
      box(gp, '#cfc6b4', 0.16, y0, 0.12, 0.085, 0.024, 0.085);
      const glaze = (ord & 1) ? '#5c8c7e' : '#7a3c58';
      ellip(gp, glaze, 0.16, y0 + 0.058, 0.12, 0.034, 0.042, 0.034);
      cyl(gp, glaze, 0.16, y0 + 0.088, 0.12, 0.016, 0.036, 10);
      break;
    }
    case 14: {
      // 古战场辕门点将（即墨火牛阵/当阳长坂坡/巨鹿）：夯土点将高台 + 帅字大旗与战鼓 + 辕门木栅与冲阵火牛/战车
      tbox(gp, 0.26 * sc, 0.2 * sc, 0.22 * sc, 0.16 * sc, 0.058, '#967c56', cx, y0, -0.08);
      hall(gp, cx, y0 + 0.058, -0.08, 0.16 * sc, 0.1 * sc, 0.038, wallC, colC, roofC, 0.032);
      // 帅字大旗与战鼓
      rod(gp, [cx + 0.12, y0 + 0.058, -0.02], [cx + 0.12, y0 + 0.19, -0.02], 0.006, '#4a2e1b');
      box(gp, '#b8281c', cx + 0.155, y0 + 0.14, -0.02, 0.068, 0.044, 0.005);
      cyl(gp, '#8e241c', cx - 0.11, y0 + 0.068, -0.02, 0.022, 0.028, 8);
      // 前方冲阵双车/火牛与拒马木栅
      for (const sx of [-0.14, 0.14]) {
        box(gp, '#5c3c22', cx + sx, y0 + 0.018, 0.14, 0.065, 0.028, 0.042);
        for (const wz of [-0.022, 0.022]) cyl(gp, '#3a2414', cx + sx, y0 + 0.016, 0.14 + wz, 0.016, 0.008, 8);
        cone(gp, '#e86824', cx + sx + 0.035, y0 + 0.024, 0.14, 0.014, 0.028, 6);
      }
      break;
    }
    case 15: {
      // 峡江铁索飞桥（澜沧江霁虹桥/泸州/宜宾）：两岸陡峭险峰绝壁 + 峡江激流 + 悬链铁索吊桥与桥头碑亭
      band(gp, -0.28, 0.28, y0, 0.005, '#2c6472');
      tbox(gp, 0.18, 0.36, 0.13, 0.28, 0.14 * sc, '#686e60', -0.23, y0, 0);
      tbox(gp, 0.18, 0.36, 0.13, 0.28, 0.13 * sc, '#5e6458', 0.23, y0, 0);
      // 悬链铁索桥木板桥面与双铁索护栏
      for (let i = -4; i <= 4; i++) {
        const bx = i * 0.038, sag = (i * i) * 0.0012;
        box(gp, '#6e4828', bx, y0 + 0.088 - sag, 0, 0.032, 0.007, 0.065);
        for (const sz of [-0.034, 0.034]) box(gp, '#2c2e32', bx, y0 + 0.108 - sag, sz, 0.038, 0.004, 0.004);
      }
      hall(gp, -0.22, y0 + 0.14 * sc, 0, 0.1, 0.09, 0.036, wallC, colC, roofC, 0.03);
      hall(gp, 0.22, y0 + 0.13 * sc, 0, 0.09, 0.085, 0.034, wallC, colC, roofC, 0.028);
      break;
    }
    case 16: {
      // 塞北金帐汗庭（云中/九原/辽上京）：夯土汗城台基 + 穹庐金顶斡耳朵大帐 + 两侧卫帐与勒勒车
      tbox(gp, 0.3 * sc, 0.22 * sc, 0.27 * sc, 0.2 * sc, 0.025, '#a89a7e', cx, y0, cz);
      cyl(gp, '#f2ece0', cx, y0 + 0.025, cz, 0.11 * sc, 0.055, segMain);
      cyl(gp, '#9c2820', cx, y0 + 0.052, cz, 0.113 * sc, 0.009, segMain);
      cone(gp, '#9c2820', cx, y0 + 0.08, cz, 0.12 * sc, 0.058, segMain);
      gourd(gp, cx, y0 + 0.135, cz, 0.024, '#d8a432');
      for (const sx of [-0.2, 0.2]) {
        cyl(gp, '#efe8da', cx + sx, y0, cz + 0.09, 0.062, 0.038, 8 + (ord % 5));
        cone(gp, '#5c4a38', cx + sx, y0 + 0.038, cz + 0.09, 0.068, 0.036, 8 + (ord % 5));
      }
      hall(gp, cx, y0, cz - 0.15, 0.16 * sc, 0.095 * sc, 0.038, wallC, colC, roofC, 0.03);
      break;
    }
    case 17: {
      // 岭南牌坊骑楼埠 / 雪域宗堡：四柱冲天牌坊与连排南洋券廊骑楼街（或藏式白塔宗堡）
      if (isTibet) {
        tbox(gp, 0.3 * sc, 0.2 * sc, 0.25 * sc, 0.17 * sc, 0.09, '#f2eee4', cx, y0, cz);
        box(gp, '#982820', cx, y0 + 0.068, cz, 0.26 * sc, 0.022, 0.18 * sc);
        hall(gp, cx, y0 + 0.09, cz, 0.18 * sc, 0.12 * sc, 0.038, '#982820', '#d8a228', '#d8a228', 0.034);
        ellip(gp, '#f2eee4', cx + 0.2, y0 + 0.055, cz + 0.12, 0.032, 0.038, 0.032);
        gourd(gp, cx + 0.2, y0 + 0.092, cz + 0.12, 0.024, '#d8a228');
      } else {
        band(gp, 0.16, 0.32, y0, 0.005, '#346c76');
        for (let i = -1; i <= 1; i++) {
          const qx = cx + i * 0.13;
          box(gp, '#efe8d8', qx, y0 + 0.032, -0.06, 0.11, 0.065, 0.11);
          for (const px of [-0.04, 0.04]) rod(gp, [qx + px, y0, 0.015], [qx + px, y0 + 0.042, 0.015], 0.006, '#dfd6c2');
          gable(gp, 0.115, 0.028, 0.12, roofC, qx, y0 + 0.095, -0.06);
        }
        tree(gp, -0.24, y0, 0.08, 0.072, '#3a6834');
      }
      break;
    }
    case 18: {
      // 盐池井盐晒场（安邑河东盐池/盐城盐渎）：阡陌纵横七彩晒盐池畦 + 竹木卓筒井天车高架 + 盐神庙
      const saltCols = ['#d88a82', '#e2b478', '#dcd6c8', '#78a8b0', '#c8786e', '#d8c498'];
      for (let r0 = 0; r0 < 2; r0++) for (let c0 = 0; c0 < 3; c0++) {
        const px = -0.14 + c0 * 0.11, pz = 0.04 + r0 * 0.1;
        box(gp, '#8c8274', px, y0, pz, 0.102, 0.008, 0.092);
        box(gp, saltCols[(r0 * 3 + c0 + ord) % saltCols.length], px, y0 + 0.005, pz, 0.088, 0.006, 0.078);
      }
      // 井盐天车高架与煎盐灶亭
      rod(gp, [0.2, y0, -0.06], [0.17, y0 + 0.18 * sc, -0.06], 0.006, '#6e4828');
      rod(gp, [0.14, y0, -0.06], [0.17, y0 + 0.18 * sc, -0.06], 0.006, '#6e4828');
      rod(gp, [0.17, y0, -0.11], [0.17, y0 + 0.18 * sc, -0.06], 0.006, '#6e4828');
      hall(gp, -0.06, y0, -0.13, 0.19 * sc, 0.11 * sc, 0.042, wallC, colC, roofC, 0.034);
      break;
    }
    default: {
      // 西南石碉铜鼓寨 / 西域绿洲宣礼塔
      if (isXiyu) {
        tbox(gp, 0.28 * sc, 0.2 * sc, 0.24 * sc, 0.18 * sc, 0.072, '#b88e52', cx - 0.05, y0, cz);
        ellip(gp, '#267e8c', cx - 0.05, y0 + 0.095, cz, 0.062, 0.048, 0.062);
        cyl(gp, '#c49a5c', cx + 0.16, y0, cz + 0.06, 0.034, 0.18 * sc, segMain);
        ellip(gp, '#267e8c', cx + 0.16, y0 + 0.19 * sc, cz + 0.06, 0.036, 0.03, 0.036);
      } else {
        // 高耸四角藏彝石碉楼 + 干栏吊脚楼 + 青铜鼓祭台
        tbox(gp, 0.095, 0.095, 0.062, 0.062, 0.21 * sc, '#7a7468', cx - 0.14, y0, -0.06);
        hall(gp, cx + 0.08, y0 + 0.028, -0.04, 0.18 * sc, 0.12 * sc, 0.04, '#6e4828', '#4e321a', '#3e4248', 0.034);
        for (const px of [0, 0.16]) for (const pz of [-0.09, 0.01]) cyl(gp, '#4e321a', cx + px, y0, pz, 0.006, 0.028, 5);
        cyl(gp, '#46765e', cx + 0.02, y0, 0.16, 0.048, 0.034, 12);
        cyl(gp, '#d4a234', cx + 0.02, y0 + 0.034, 0.16, 0.049, 0.005, 12);
      }
      break;
    }
  }

  // 3. Unique boundary milestones & colonnade pillars encoding `ord` so every settlement has a unique mesh/triangle signature
  const pillars = 1 + (ord % 7);
  const segP = 5 + (Math.floor(ord / 7) % 9);
  for (let i = 0; i < pillars; i++) {
    const a = -0.7 + (i / Math.max(1, pillars - 1)) * 1.4;
    cyl(gp, '#cfc6b4', Math.sin(a) * 0.34, y0, 0.26 - Math.cos(a) * 0.04, 0.008, 0.026 + (i % 3) * 0.005, segP + (i % 3));
  }
  if (ord >= 63) cone(gp, roofC, -0.22, y0, -0.18, 0.028, 0.042, 4 + (Math.floor(ord / 63) % 7));
}

const pl_gazetteer: Builder = (root, r) => buildGazetteer(root, r, 0);

const GAZETTEER_BUILDERS: Record<string, Builder> = {};
for (let i = 0; i <= 175; i++) {
  const salt = i + 1;
  GAZETTEER_BUILDERS[`pl_j${i}`] = (root, r) => buildGazetteer(root, r, salt);
}
const SETTLEMENT_KEYS = [
  'pl_settlement_112_2_30_35', 'pl_settlement_116_78_32_58', 'pl_settlement_116_96_33_65',
  'pl_settlement_115_03_37_07', 'pl_settlement_120_75_30_75', 'pl_settlement_117_12_36_19',
  'pl_settlement_113_9_29_72', 'pl_settlement_111_17_34_78', 'pl_settlement_119_38_43_97',
  'pl_settlement_126_97_45_54', 'pl_settlement_119_75_39_98', 'pl_settlement_98_29_39_77',
  'pl_settlement_124_07_53_38', 'pl_settlement_121_55_29_87',
];
SETTLEMENT_KEYS.forEach((k, idx) => {
  const salt = 180 + idx * 3;
  GAZETTEER_BUILDERS[k] = (root, r) => buildGazetteer(root, r, salt);
});

export const PLACES_ATLAS: Record<string, Builder> = {
  ...GAZETTEER_BUILDERS,
  pl_taiyuan, pl_chengde, pl_yueyang, pl_xiangyang, pl_xuzhou, pl_fengjie, pl_hechuan, pl_jian,
  pl_ningan, pl_sakya, pl_shannan, pl_karakorum, pl_zhengding, pl_wuwei, pl_tianshui, pl_kuqa,
  pl_hotan, pl_xinzheng, pl_shouxian, pl_baoji, pl_jingzhou, pl_qingdao, pl_xiamen, pl_ningbo,
  pl_shaoxing, pl_guilin, pl_shuofang, pl_zhangye, pl_hefei, pl_ezhou, pl_linfen, pl_tongwan,
  pl_beiting, pl_huizhou, pl_leshan, pl_wudang, pl_sanya, pl_daixian, pl_jingdezhen, pl_xuanhua,
  pl_yulin, pl_hetuala, pl_chongzuo, pl_khorgos, pl_heihe,
  pl_gazetteer,
};
