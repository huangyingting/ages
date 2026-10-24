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
    rich(inner, hero ? { color: '#cccccc', ...recipe } : recipe);
    inner.scale.setScalar(KIT_SCALE * (typeof recipe.scale === 'number' ? recipe.scale : 1));
  } else (BUILDERS[recipe.kind] as LiteBuilder ?? FALLBACK)(inner, recipe);
  bakeAnimated(root);
  bakeStaticMeshes(root);
  gradeModel(root);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  root.userData.height = box3.max.y;
  root.userData.radius = Math.max(box3.max.x - box3.min.x, box3.max.z - box3.min.z) / 2;
  root.userData.kind = recipe.kind;
  return root;
}
