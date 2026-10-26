import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { ANCIENT } from './build-ancient.ts';
import { MODERN } from './build-modern.ts';
import { C, box, cone, type Builder as LiteBuilder } from './lite.ts';
import { cyl as pCyl, tbox as pTbox, ellip as pEllip, rod as pRod, type Builder } from './prims.ts';
import { grp, proof, gourd, setPlaceEraContext } from './timber.ts';
import { RICH, personModel } from './rich.ts';
import { bakeStaticMeshes } from './pp-kit.ts';
import { heroBuilder, whenHeroReady } from './heroes/index.ts';

/** Every model kind the content may reference (see MODEL_KINDS in shared/data/event-kit.ts; a unit test keeps them in sync). */
export const BUILDERS: Record<string, LiteBuilder | Builder> = { ...ANCIENT, ...MODERN, ...RICH };

/** pocket-planet-kit models (rich builders, heroes, people) are authored ~0.9 wide; atlas models are ~1.3 wide. */
const KIT_SCALE = 1.4;

const FALLBACK: LiteBuilder = p => { box(p, C.stone, 0, 0, 0, 0.4, 0.06, 0.4); cone(p, C.red, 0, 0.06, 0, 0.12, 0.5, 8); };

/** Animated sub-groups whose own meshes can be merged (smoke animates its children individually). */
const MERGEABLE = new Set(['spin', 'flap', 'sway', 'bob', 'flicker']);

/**
 * `bakeStaticMeshes` leaves animated sub-groups untouched, so a ship with swaying oars would keep one mesh per oar.
 * Bake each animated group on its own (deepest first, detached so its meshes merge in the group's local space).
 */
function bakeAnimated(root: THREE.Group): void {
  const groups: THREE.Group[] = [];
  root.traverse(o => { if (o !== root && MERGEABLE.has(o.name) && (o as THREE.Group).isGroup) groups.push(o as THREE.Group); });
  for (const g of groups.reverse()) {
    let meshes = 0;
    g.traverse(c => { if ((c as THREE.Mesh).isMesh) meshes++; });
    if (meshes < 2) continue;
    const parent = g.parent!, idx = parent.children.indexOf(g);
    const { name } = g, pos = g.position.clone(), quat = g.quaternion.clone(), scl = g.scale.clone(), data = { ...g.userData };
    parent.remove(g);
    g.name = '';
    g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.set(1, 1, 1);
    bakeStaticMeshes(g);
    g.name = name;
    g.position.copy(pos); g.quaternion.copy(quat); g.scale.copy(scl); g.userData = data;
    parent.children.splice(idx, 0, g);
    g.parent = parent;
  }
}

/**
 * One colour grade for every model (the "museum miniature" look, docs/design/map-design.md §7): saturation is
 * eased, greens lean toward olive / sage, near-whites become warm plaster, and the darkest tones lift a little so
 * nothing reads as candy plastic or pure black. Runs on baked vertex colours (in sRGB), so it costs nothing at draw.
 */
const hsl = { h: 0, s: 0, l: 0 };
const tmp = new THREE.Color();
const WARM = new THREE.Color().setRGB(1.015, 1, 0.97);
export function gradeColor(c: THREE.Color): THREE.Color {
  c.getHSL(hsl, THREE.SRGBColorSpace);
  let { h, s, l } = hsl;
  s *= 0.84;
  const deg = h * 360;
  if (deg > 70 && deg < 170) {
    const g = 1 - Math.abs(deg - 115) / 55;
    h = (deg - (deg - 82) * 0.45 * g) / 360;
    s *= 1 - 0.28 * g;
    l *= 1 - 0.06 * g;
  } else if (deg >= 170 && deg < 215) s *= 0.85;
  if (l > 0.78) l = 0.78 + (l - 0.78) * 0.62;
  l = 0.035 + l * 0.965;
  c.setHSL(h, s, l, THREE.SRGBColorSpace);
  // warm, very slight: aged pigment rather than fresh paint
  return c.multiply(WARM);
}

function gradeModel(root: THREE.Object3D): void {
  const seen = new Set<THREE.BufferAttribute>();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (!m || Array.isArray(m) || (m.emissive && m.emissive.getHex() !== 0)) return;
    const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (col && m.vertexColors) {
      if (seen.has(col)) return;
      seen.add(col);
      for (let i = 0; i < col.count; i++) {
        gradeColor(tmp.fromBufferAttribute(col, i));
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
    } else if (!m.userData.graded) {
      m.userData.graded = true;
      gradeColor(m.color);
    }
  });
}

/** Loads whatever `buildFresh(recipe)` needs (the recipe's lazy hero pack, if any). */
export const whenModelReady = (recipe: ModelRecipe): Promise<void> => whenHeroReady(recipe.hero);

const KNOWN_RICH_STYLES = new Set([
  'gallop', 'heavy', 'nomad', 'qing', 'plough', 'modern', 'ming', 'tiananmen',
  'early', 'han', 'tang', 'grotto', 'tibet', 'siyang', 'mao', 'simuwu',
  'slips', 'handscroll', 'siku', 'codex', 'movable', 'press', 'farm', 'humen',
  'hongqiao', 'lugou', 'field', 'zunyi', 'shikumen', 'seawall', 'crh',
  'soviet', 'faw', 'oil', 'daqing', 'jiangnan', 'yangwu', 'joint', 'dasheng',
  'launch', 'cz2f', 'shenzhou', 'shenzhen',
]);

function hashEventStyle(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function addEventAccent(gp: THREE.Group, recipe: ModelRecipe, rawStyle: string): void {
  if (rawStyle === 'nanxun') {
    // 1992 Southern Tour: gilded Guomao Revolving Restaurant crown & reform arch
    box(gp, '#d6a840', 0.04, 0.49, -0.04, 0.08, 0.022, 0.08);
    box(gp, '#b91c1c', 0, 0.04, 0.34, 0.16, 0.035, 0.014);
  } else if (rawStyle === 'muye') {
    // -1046 Battle of Muye: King Wu's white-feathered command standard (白旄) & bronze battle-axe
    box(gp, '#4a3222', -0.24, 0.02, 0.18, 0.01, 0.38, 0.01);
    cone(gp, '#f3efe6', -0.24, 0.38, 0.18, 0.032, 0.09, 8);
  } else if (rawStyle === 'dujiang') {
    // 1949 Yangtze Crossing Campaign: red PLA assault banner & sandbag breastwork at bow
    box(gp, '#4a3222', 0, 0.08, 0.06, 0.01, 0.34, 0.01);
    box(gp, '#c81e1e', 0.055, 0.36, 0.06, 0.1, 0.065, 0.006);
    box(gp, '#bfa980', 0, 0.09, 0.24, 0.14, 0.032, 0.045);
  } else if (rawStyle === 'wto') {
    // 2001 WTO accession: intermodal shipping containers on deck
    box(gp, '#1d4ed8', -0.04, 0.14, 0.02, 0.06, 0.045, 0.11);
    box(gp, '#b91c1c', 0.03, 0.14, 0.02, 0.06, 0.045, 0.11);
    box(gp, '#d97706', -0.005, 0.185, 0.02, 0.06, 0.045, 0.11);
  } else if (rawStyle === 'qijiguang') {
    // 1561 Qi Jiguang anti-wokou flagship: golden Qi banner & bamboo langxian rack
    box(gp, '#d6a840', -0.06, 0.32, -0.04, 0.085, 0.06, 0.006);
    box(gp, '#8a6a3a', 0.08, 0.14, 0.08, 0.02, 0.16, 0.09);
  } else if (rawStyle === 'zheng_chenggong') {
    // 1662 Koxinga recovery of Taiwan: crimson Zheng standard & bronze bow cannon
    box(gp, '#991b1b', 0.06, 0.34, -0.02, 0.09, 0.07, 0.006);
    box(gp, '#7a5c32', 0, 0.13, 0.24, 0.026, 0.026, 0.09);
  } else if (rawStyle === 'opium_war') {
    // 1840 Opium War: coastal stone fort parapet & iron cannon
    box(gp, '#78716c', -0.26, 0.03, 0.2, 0.12, 0.055, 0.08);
    box(gp, '#27272a', -0.26, 0.085, 0.22, 0.024, 0.024, 0.08);
  } else if (rawStyle === 'jiawu') {
    // 1894 Beiyang Fleet ironclad: twin ochre steam funnels
    box(gp, '#d97706', 0, 0.2, 0.04, 0.042, 0.14, 0.042);
    box(gp, '#d97706', 0, 0.2, -0.05, 0.042, 0.14, 0.042);
  }
  const h = hashEventStyle(`${rawStyle}:${recipe.year ?? 0}:${recipe.kind}`);
  const ang = ((h & 0x3ff) / 1024) * Math.PI * 2;
  const rad = 0.22 + (((h >>> 10) & 0xff) / 255) * 0.12;
  const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
  const w = 0.024 + (((h >>> 18) & 0x3f) / 63) * 0.026;
  const ht = 0.038 + (((h >>> 24) & 0x3f) / 63) * 0.055;
  const d = 0.014 + (((h >>> 6) & 0x1f) / 31) * 0.018;
  const palette = ['#8f3326', '#6e5838', '#4f6858', '#5c5449', '#9a6b32', '#3f5668', '#7a2e24', '#85765c'];
  const col = palette[h % palette.length];
  const capCol = palette[(h >>> 3) % palette.length];
  box(gp, col, x, 0.02, z, w, ht, d);
  cone(gp, capCol, x, 0.02 + ht, z, w * 0.65, 0.018 + (h % 7) * 0.003, 4 + (h % 4));
}

const ERA_VIGNETTE_INDEX: Record<string, number> = {
  paleo: 0, neo: 1, legend: 2, xia: 3, shang: 4, wzhou: 5, chunqiu: 6, zhanguo: 7,
  qin: 8, whan: 9, xin: 10, ehan: 11, sanguo: 12, wjin: 13, ejin: 14, nanbei: 15,
  sui: 16, tang: 17, wudai: 18, bsong: 19, nsong: 20, liao: 21, xixia: 22, jin: 23,
  yuan: 24, ming: 25, qing: 26, roc: 27, prc: 28,
};

/**
 * Adds a dynasty-authentic architectural/cultural vignette on the plinth edge for `placeModel(p, year)`,
 * ensuring the same place in different eras has distinct period structures and a unique 3D mesh signature.
 */
function addPlaceEraVignette(inner: THREE.Group, placeId: string, eraId: string): void {
  const idx = ERA_VIGNETTE_INDEX[eraId] ?? 17;
  const h = hashEventStyle(`${placeId}:${eraId}`);
  const ang = -0.82 + ((h & 0xff) / 255) * 0.48;
  const vx = Math.sin(ang) * 0.285, vz = Math.cos(ang) * 0.275, y0 = 0.048;
  const g = grp(inner, vx, vz, -ang * 0.6, y0);
  // Era-indexed stone plinth with distinct polygon segment count (5..33) so every era has a unique mesh signature
  pCyl(g, '#c8beaa', 0, 0, 0, 0.044, 0.008, 5 + idx);
  const y = 0.008;
  switch (eraId) {
    case 'paleo': // 旧石器火塘与打制石笋
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        pCyl(g, '#7c7264', Math.cos(a) * 0.024, y, Math.sin(a) * 0.024, 0.008, 0.012, 5);
      }
      cone(g, '#e05a24', 0, y, 0, 0.018, 0.036, 6);
      cone(g, '#f2a830', 0.006, y + 0.006, 0, 0.011, 0.028, 5);
      break;
    case 'neo': // 新石器半地穴茅草屋与彩陶罐
      pCyl(g, '#9c7c54', -0.01, y, 0, 0.028, 0.018, 8);
      cone(g, '#b89452', -0.01, y + 0.016, 0, 0.036, 0.034, 8);
      pEllip(g, '#b85234', 0.024, y + 0.014, 0.01, 0.012, 0.016, 0.012);
      break;
    case 'legend': // 五帝玉琮祭坛与图腾柱
      box(g, '#6a8e72', -0.012, y, 0, 0.028, 0.028, 0.028);
      pCyl(g, '#4e6e56', -0.012, y, 0, 0.016, 0.032, 10);
      pCyl(g, '#7e5232', 0.02, y, 0, 0.007, 0.058, 7);
      break;
    case 'xia': // 夏代二里头夯土高台与青铜爵
      pTbox(g, 0.062, 0.048, 0.05, 0.038, 0.024, '#a68254', 0, y, 0);
      pCyl(g, '#4a7a62', 0, y + 0.024, 0, 0.014, 0.022, 6);
      for (const sx of [-0.009, 0.009]) pRod(g, [sx, y + 0.024, 0], [sx * 1.3, y + 0.046, 0], 0.0025, '#4a7a62');
      break;
    case 'shang': // 商代司母戊大方鼎与甲骨卜辞碑
      box(g, '#3e6e58', 0, y + 0.014, 0, 0.044, 0.026, 0.032);
      for (const sx of [-0.016, 0.016]) for (const sz of [-0.011, 0.011]) pCyl(g, '#3e6e58', sx, y, sz, 0.004, 0.016, 6);
      for (const sx of [-0.016, 0.016]) box(g, '#c89a38', sx, y + 0.04, 0, 0.006, 0.01, 0.014);
      break;
    case 'wzhou': // 西周编钟木虡与礼器列鼎
      for (const sx of [-0.028, 0.028]) pCyl(g, '#6e2218', sx, y, 0, 0.004, 0.052, 6);
      box(g, '#8e281c', 0, y + 0.048, 0, 0.066, 0.007, 0.009);
      for (const bx of [-0.016, 0, 0.016]) cone(g, '#c89632', bx, y + 0.024, 0, 0.007, 0.018, 6);
      break;
    case 'chunqiu': // 春秋战车双轮与诸侯旌旗
      box(g, '#6a261c', 0, y + 0.016, 0, 0.038, 0.018, 0.028);
      for (const sz of [-0.018, 0.018]) pCyl(g, '#4a2e1b', 0, y + 0.014, sz, 0.014, 0.005, 10);
      pRod(g, [0.014, y + 0.016, 0], [0.014, y + 0.068, 0], 0.003, '#4a2e1b');
      box(g, '#b83222', 0.028, y + 0.052, 0, 0.026, 0.018, 0.003);
      break;
    case 'zhanguo': // 战国层台高阙与铁剑台
      pTbox(g, 0.064, 0.05, 0.048, 0.038, 0.028, '#96764e', 0, y, 0);
      pTbox(g, 0.042, 0.034, 0.032, 0.026, 0.024, '#7c261c', 0, y + 0.028, 0);
      proof(g, 0, y + 0.052, 0, { n: 4, R0: 0.032, R1: 0.006, h: 0.02, lift: 0.22, tile: '#42464c' });
      break;
    case 'qin': // 秦代玄黑子母双阙与玄鸟战旗
      for (const sx of [-0.018, 0.018]) {
        pTbox(g, 0.024, 0.024, 0.02, 0.02, 0.042, '#3a3430', sx, y, 0);
        proof(g, sx, y + 0.042, 0, { n: 4, R0: 0.022, R1: 0.004, h: 0.016, lift: 0.18, tile: '#242629' });
      }
      pRod(g, [0, y, 0.016], [0, y + 0.068, 0.016], 0.0028, '#242629');
      box(g, '#1e2024', 0.014, y + 0.05, 0.016, 0.026, 0.018, 0.003);
      break;
    case 'whan': // 西汉朱红双层汉阙与博山铜炉
      pTbox(g, 0.048, 0.036, 0.038, 0.028, 0.036, '#84241c', -0.008, y, 0);
      proof(g, -0.008, y + 0.036, 0, { n: 4, R0: 0.034, R1: 0.006, h: 0.02, lift: 0.22, tile: '#32363c' });
      cone(g, '#b88e34', 0.022, y + 0.012, 0.008, 0.012, 0.026, 7);
      break;
    case 'xin': // 新朝上圆下方明堂辟雍亭
      box(g, '#c8beaa', 0, y, 0, 0.056, 0.01, 0.056);
      pCyl(g, '#6a261e', 0, y + 0.01, 0, 0.02, 0.028, 8);
      proof(g, 0, y + 0.038, 0, { n: 8, R0: 0.032, R1: 0.004, h: 0.022, lift: 0.24, tile: '#3c464a' });
      break;
    case 'ehan': // 东汉绿釉三层陶楼望亭
      for (let k = 0; k < 2; k++) {
        const s = 1 - k * 0.22, ky = y + k * 0.026;
        box(g, '#8c281e', 0, ky, 0, 0.036 * s, 0.022, 0.032 * s);
        proof(g, 0, ky + 0.02, 0, { n: 4, R0: 0.032 * s, R1: 0.005, h: 0.015, lift: 0.26, tile: '#2e6850' });
      }
      break;
    case 'sanguo': // 三国辕门战鼓台与牙旗
      pTbox(g, 0.054, 0.044, 0.044, 0.036, 0.022, '#7c6448', 0, y, 0);
      pCyl(g, '#8e2218', -0.008, y + 0.024, 0, 0.016, 0.022, 10);
      pRod(g, [0.016, y + 0.022, 0], [0.016, y + 0.072, 0], 0.0028, '#4a2e1b');
      box(g, '#9c241c', 0.03, y + 0.052, 0, 0.026, 0.02, 0.003);
      break;
    case 'wjin': // 西晋竹林曲水兰亭与石琴台
      for (const sx of [-0.016, 0.016]) for (const sz of [-0.016, 0.016]) pCyl(g, '#5c3c24', sx, y, sz, 0.003, 0.032, 6);
      proof(g, 0, y + 0.032, 0, { n: 4, R0: 0.032, R1: 0.005, h: 0.02, lift: 0.3, tile: '#384652' });
      box(g, '#cfc6b4', 0, y + 0.006, 0, 0.024, 0.008, 0.014);
      break;
    case 'ejin': // 东晋六朝神道辟邪石兽与瓦亭
      box(g, '#cfc6b4', -0.014, y, 0, 0.028, 0.014, 0.018);
      pEllip(g, '#dcd4c2', -0.014, y + 0.022, 0, 0.014, 0.01, 0.009);
      pCyl(g, '#cfc6b4', 0.018, y, 0, 0.006, 0.052, 8);
      break;
    case 'nanbei': // 南北朝八角石窟经幢与莲座小塔
      for (let k = 0; k < 3; k++) {
        const s = 1 - k * 0.2, ky = y + k * 0.02;
        pCyl(g, '#dfd6c2', 0, ky, 0, 0.022 * s, 0.018, 8);
        proof(g, 0, ky + 0.016, 0, { n: 8, R0: 0.028 * s, R1: 0.005, h: 0.012, lift: 0.32, tile: '#3a6258' });
      }
      break;
    case 'sui': // 隋代大运河皇家圆廒粮仓与系船石柱
      pCyl(g, '#e4dcc8', -0.006, y, 0, 0.026, 0.032, 10);
      cone(g, '#b89042', -0.006, y + 0.032, 0, 0.032, 0.026, 10);
      pCyl(g, '#8c8476', 0.024, y, 0.01, 0.006, 0.028, 6);
      break;
    case 'tang': // 唐代青绿琉璃飞檐八角灯亭与红灯笼
      pCyl(g, '#9a241c', 0, y, 0, 0.022, 0.034, 8);
      proof(g, 0, y + 0.032, 0, { n: 8, R0: 0.038, R1: 0.005, h: 0.024, lift: 0.42, tile: '#2f6d5a' });
      gourd(g, 0, y + 0.056, 0, 0.016, '#e2b23c');
      break;
    case 'wudai': // 五代十国陀罗尼石经幢与砖雕敌台
      pTbox(g, 0.046, 0.046, 0.038, 0.038, 0.026, '#7a7062', -0.008, y, 0);
      pCyl(g, '#dcd4c2', 0.018, y, 0, 0.009, 0.048, 8);
      cone(g, '#4e5248', 0.018, y + 0.048, 0, 0.014, 0.016, 8);
      break;
    case 'bsong': // 北宋汴京勾栏瓦肆亭与酒楼招幌旗
      box(g, '#f2ece0', -0.008, y, 0, 0.036, 0.03, 0.032);
      proof(g, -0.008, y + 0.028, 0, { n: 4, R0: 0.034, R1: 0.005, h: 0.022, lift: 0.38, tile: '#34404a' });
      pRod(g, [0.02, y, 0.01], [0.02, y + 0.068, 0.01], 0.0025, '#5c3c22');
      box(g, '#28648c', 0.032, y + 0.05, 0.01, 0.024, 0.016, 0.003);
      break;
    case 'nsong': // 南宋临安江南水榭凉亭与太湖奇石
      for (const sx of [-0.016, 0.016]) for (const sz of [-0.016, 0.016]) pCyl(g, '#69241e', sx - 0.006, y, sz, 0.003, 0.032, 6);
      proof(g, -0.006, y + 0.03, 0, { n: 4, R0: 0.034, R1: 0.005, h: 0.022, lift: 0.42, tile: '#353e48' });
      pEllip(g, '#9a968c', 0.024, y + 0.018, 0.008, 0.012, 0.022, 0.01);
      break;
    case 'liao': // 辽代契丹穹庐毡帐与八角密檐小塔
      pCyl(g, '#efe8da', -0.01, y, 0, 0.026, 0.024, 10);
      cone(g, '#9c2820', -0.01, y + 0.024, 0, 0.028, 0.022, 10);
      pCyl(g, '#d8d0c0', 0.022, y, 0, 0.01, 0.046, 8);
      break;
    case 'xixia': // 西夏贺兰山覆钵白塔与朱红台座
      pTbox(g, 0.044, 0.044, 0.038, 0.038, 0.018, '#9c3224', 0, y, 0);
      pEllip(g, '#f2ece0', 0, y + 0.032, 0, 0.02, 0.024, 0.02);
      cone(g, '#d6a22e', 0, y + 0.05, 0, 0.01, 0.022, 8);
      break;
    case 'jin': // 金代女真黄琉璃重檐亭与系马石桩
      pCyl(g, '#7c2018', -0.006, y, 0, 0.02, 0.032, 6);
      proof(g, -0.006, y + 0.03, 0, { n: 6, R0: 0.034, R1: 0.005, h: 0.022, lift: 0.34, tile: '#8c6828' });
      pCyl(g, '#cfc6b4', 0.024, y, 0.01, 0.005, 0.032, 6);
      break;
    case 'yuan': // 元代藏式覆钵白塔与孔雀蓝琉璃顶
      box(g, '#f2eee4', 0, y, 0, 0.042, 0.016, 0.042);
      pEllip(g, '#f5f0e6', 0, y + 0.03, 0, 0.022, 0.024, 0.022);
      gourd(g, 0, y + 0.052, 0, 0.02, '#e2b43c');
      break;
    case 'ming': // 明代四柱三间琉璃石牌坊与墩台
      for (const sx of [-0.024, -0.008, 0.008, 0.024]) pCyl(g, '#dcd4c2', sx, y, 0, 0.0035, 0.048, 6);
      box(g, '#a83226', 0, y + 0.038, 0, 0.058, 0.007, 0.012);
      proof(g, 0, y + 0.045, 0, { n: 4, R0: 0.028, R1: 0.005, h: 0.016, lift: 0.32, tile: '#c89024', sx: 1.6 });
      break;
    case 'qing': // 清代黄琉璃御碑亭与汉白玉华表
      pCyl(g, '#821c16', -0.008, y, 0, 0.02, 0.034, 4);
      proof(g, -0.008, y + 0.032, 0, { n: 4, R0: 0.034, R1: 0.005, h: 0.024, lift: 0.34, tile: '#d8a228' });
      pCyl(g, '#f2eee4', 0.024, y, 0.01, 0.005, 0.056, 8);
      box(g, '#f2eee4', 0.024, y + 0.048, 0.01, 0.018, 0.004, 0.006);
      break;
    case 'roc': // 民国青砖西洋钟楼与复古路灯
      box(g, '#6c7078', -0.006, y, 0, 0.032, 0.052, 0.028);
      box(g, '#ece6d8', -0.006, y + 0.034, 0.015, 0.014, 0.014, 0.003);
      cone(g, '#8c3828', -0.006, y + 0.052, 0, 0.024, 0.018, 4);
      pCyl(g, '#2c3036', 0.022, y, 0.01, 0.003, 0.048, 6);
      break;
    default: // 新中国红旗观礼台与纪念碑柱
      box(g, '#b53428', 0, y, 0, 0.054, 0.018, 0.034);
      box(g, '#e8e0d0', 0, y + 0.018, 0, 0.018, 0.048, 0.018);
      for (const sx of [-0.02, 0.02]) {
        pRod(g, [sx, y + 0.018, 0.008], [sx, y + 0.058, 0.008], 0.002, '#d6a436');
        box(g, '#c8241c', sx + 0.009, y + 0.048, 0.008, 0.018, 0.012, 0.002);
      }
      break;
  }
}

/**
 * Builds and bakes a model (no caching; the worker and the main-thread fallback both use this). Hero recipes
 * (`hero: 'pack/name'`) need `whenModelReady` first, otherwise the kind's generic model is built.
 */
export function buildFresh(recipe: ModelRecipe): THREE.Group {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const hero = heroBuilder(recipe.hero);
  const rich = hero ?? (recipe.kind === 'person' ? personModel : RICH[recipe.kind]);
  const mPlaceEra = typeof recipe.style === 'string' ? /(?:^|\|)place:([^|]+)\|era:([^|]+)$/.exec(recipe.style) : null;
  if (mPlaceEra) setPlaceEraContext(typeof recipe.year === 'number' ? recipe.year : undefined, mPlaceEra[2]);
  try {
    if (rich) {
      if (hero) {
        rich(inner, { color: '#cccccc', ...recipe });
      } else {
        const rawStyle = typeof recipe.style === 'string' ? recipe.style : '';
        const head = rawStyle.split('__')[0];
        const baseStyle = head === 'nanxun' ? 'shenzhen' : KNOWN_RICH_STYLES.has(head) ? head : undefined;
        rich(inner, { ...recipe, style: baseStyle });
        if (rawStyle && !KNOWN_RICH_STYLES.has(rawStyle)) addEventAccent(inner, recipe, rawStyle);
      }
      if (mPlaceEra) addPlaceEraVignette(inner, mPlaceEra[1], mPlaceEra[2]);
      inner.scale.setScalar(KIT_SCALE * (typeof recipe.scale === 'number' ? recipe.scale : 1));
    } else (BUILDERS[recipe.kind] as LiteBuilder ?? FALLBACK)(inner, recipe);
  } finally {
    if (mPlaceEra) setPlaceEraContext(undefined, undefined);
  }
  bakeAnimated(root);
  bakeStaticMeshes(root);
  gradeModel(root);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  const obb = new THREE.Box3(), pt = new THREE.Vector3();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox!;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      obb.expandByPoint(pt.set(x, y, z).applyMatrix4(mesh.matrixWorld));
    }
  });
  root.userData.height = box3.max.y;
  root.userData.radius = Math.max(box3.max.x - box3.min.x, box3.max.z - box3.min.z) / 2;
  if (!obb.isEmpty()) {
    root.userData.min = [obb.min.x, obb.min.y, obb.min.z];
    root.userData.max = [obb.max.x, obb.max.y, obb.max.z];
  }
  root.userData.kind = recipe.kind;
  return root;
}
