import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { unpackModel, type PackedModel } from './pack.ts';

/**
 * Main-thread model library: models are built in a small Web Worker pool and cached as prototypes; `instance()`
 * returns cheap clones (geometry and materials are shared). Without workers the builder code is imported lazily and
 * runs on the main thread.
 */
const protos = new Map<string, THREE.Group>();
const waits = new Map<string, Promise<THREE.Group>>();
const keyOf = (r: ModelRecipe) => JSON.stringify(r);

interface Job { id: number; recipe: ModelRecipe; resolve: (g: THREE.Group) => void; reject: (e: Error) => void }
const queue: Job[] = [];
let slots: { w: Worker; busy: Job | null }[] | null = null;
let nextId = 1;
let broken = typeof Worker === 'undefined';

function pool() {
  if (slots) return slots;
  const n = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
  slots = [];
  for (let i = 0; i < n; i++) {
    const slot = { w: new Worker(new URL('./build.worker.ts', import.meta.url), { type: 'module' }), busy: null as Job | null };
    slot.w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; model?: PackedModel; err?: string }>) => {
      const job = slot.busy;
      slot.busy = null;
      if (job?.id === e.data.id) {
        if (e.data.ok) { try { job.resolve(unpackModel(e.data.model!)); } catch (err) { job.reject(err as Error); } } else job.reject(new Error(e.data.err));
      }
      pump();
    };
    slot.w.onerror = ev => {
      ev.preventDefault();
      broken = true;
      const jobs = [...(slot.busy ? [slot.busy] : []), ...queue.splice(0)];
      slot.busy = null;
      for (const j of jobs) j.reject(new Error('worker failed'));
    };
    slots.push(slot);
  }
  return slots;
}
function pump() {
  for (const s of pool()) {
    if (s.busy || !queue.length) continue;
    s.busy = queue.shift()!;
    s.w.postMessage({ id: s.busy.id, recipe: s.busy.recipe });
  }
}
const viaWorker = (recipe: ModelRecipe, urgent: boolean) => new Promise<THREE.Group>((resolve, reject) => {
  const job = { id: nextId++, recipe, resolve, reject };
  if (urgent) queue.unshift(job); else queue.push(job);
  pump();
});
const onMain = async (recipe: ModelRecipe) => (await import('./kit.ts')).buildFresh(recipe);

/** Resolves with the cached prototype of a recipe, building it first if needed. */
export function prototype(recipe: ModelRecipe, urgent = false): Promise<THREE.Group> {
  const key = keyOf(recipe);
  const have = protos.get(key);
  if (have) return Promise.resolve(have);
  let p = waits.get(key);
  if (!p) {
    p = (broken ? Promise.reject(new Error('no workers')) : viaWorker(recipe, urgent))
      .catch(() => onMain(recipe))
      .then(g => { protos.set(key, g); waits.delete(key); return g; });
    waits.set(key, p);
  }
  return p;
}

/** A fresh instance of a recipe's model (shares GPU buffers with the prototype). */
export async function instance(recipe: ModelRecipe, urgent = false): Promise<THREE.Group> {
  const g = (await prototype(recipe, urgent)).clone(true);
  return g;
}

export const ready = (recipe: ModelRecipe): boolean => protos.has(keyOf(recipe));
export const backlog = () => queue.length + (slots?.filter(s => s.busy).length ?? 0);
