import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { ANCIENT } from './build-ancient.ts';
import { MODERN } from './build-modern.ts';
import { C, box, cone, type Builder as LiteBuilder } from './lite.ts';
import type { Builder } from './prims.ts';
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
    inner.scale.setScalar(KIT_SCALE * (typeof recipe.scale === 'number' ? recipe.scale : 1));
  } else (BUILDERS[recipe.kind] as LiteBuilder ?? FALLBACK)(inner, recipe);
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
