/// <reference lib="webworker" />
import type { ModelRecipe } from '../../shared/data/types.ts';
import { loadHeroesFor } from './heroes/index.ts';
import { buildFresh, whenModelReady } from './kit.ts';
import { packModel } from './pack.ts';

const sent = new Set<string>();

// Builds and bakes models off the main thread and replies with a transferable PackedModel; `warm` pre-loads hero packs.
self.onmessage = async (e: MessageEvent<{ id: number; recipe: ModelRecipe } | { warm: string[] }>) => {
  if ('warm' in e.data) { void loadHeroesFor(e.data.warm); return; }
  const { id, recipe } = e.data;
  try {
    await whenModelReady(recipe);
    const { model, transfer } = packModel(buildFresh(recipe), sent, false);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: true, model }, transfer);
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: false, err: String(err) });
  }
};
