import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { ANCIENT } from './build-ancient.ts';
import { MODERN } from './build-modern.ts';
import { bake } from './bake.ts';
import { C, box, cone, type Builder } from './prims.ts';

/** Every model kind the content may reference (see MODEL_KINDS in shared/data/event-kit.ts; a unit test keeps them in sync). */
export const BUILDERS: Record<string, Builder> = { ...ANCIENT, ...MODERN };

const FALLBACK: Builder = p => { box(p, C.stone, 0, 0, 0, 0.4, 0.06, 0.4); cone(p, C.red, 0, 0.06, 0, 0.12, 0.5, 8); };

/** Builds and bakes a model (no caching; the worker and the main-thread fallback both use this). */
export function buildFresh(recipe: ModelRecipe): THREE.Group {
  const root = new THREE.Group();
  (BUILDERS[recipe.kind] ?? FALLBACK)(root, recipe);
  bake(root);
  root.userData.kind = recipe.kind;
  return root;
}
