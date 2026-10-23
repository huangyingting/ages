/// <reference lib="webworker" />
import type { ModelRecipe } from '../../shared/data/types.ts';
import { buildFresh } from './kit.ts';
import { packModel } from './pack.ts';

// Builds and bakes models off the main thread and replies with a transferable PackedModel.
self.onmessage = (e: MessageEvent<{ id: number; recipe: ModelRecipe }>) => {
  const { id, recipe } = e.data;
  try {
    const { model, transfer } = packModel(buildFresh(recipe));
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: true, model }, transfer);
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: false, err: String(err) });
  }
};
