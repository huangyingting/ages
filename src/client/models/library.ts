import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { loadHeroesFor, parseHero } from './heroes/index.ts';
import { unpackModel, type PackedModel } from './pack.ts';

/**
 * Main-thread model library: models are built in a small Web Worker pool and cached as prototypes; `instance()`
 * returns cheap clones (geometry and materials are shared). Without workers the builder code is imported lazily and
 * runs on the main thread.
 *
 * Supports dynasty-by-dynasty priority scheduling, queue cancellation when switching eras, idle next-era prefetching,
 * and bounded LRU prototype eviction.
 */
const MAX_PROTOS = 96;
const protos = new Map<string, THREE.Group>();
const waits = new Map<string, Promise<THREE.Group>>();
export const keyOf = (r: ModelRecipe) => JSON.stringify(r);

export interface BuildOpts {
  /** Higher builds first (e.g. 100 = capital/card, 85 = era level-1, 60 = level-2, 40 = level-3, 10 = prefetch). */
  priority?: number;
  /** Group tag (e.g. `era:qin`, `prefetch:whan`) so unstarted jobs from a superseded dynasty can be cancelled. */
  tag?: string;
}

interface Job {
  id: number;
  key: string;
  recipe: ModelRecipe;
  priority: number;
  tag: string;
  resolve: (g: THREE.Group) => void;
  reject: (e: Error) => void;
}
const queue: Job[] = [];
let slots: { w: Worker; busy: Job | null }[] | null = null;
let nextId = 1;
let broken = typeof Worker === 'undefined';

function normOpts(opts?: boolean | BuildOpts): { priority: number; tag: string } {
  if (typeof opts === 'boolean') return { priority: opts ? 90 : 20, tag: '' };
  return { priority: opts?.priority ?? 50, tag: opts?.tag ?? '' };
}

function touchProto(key: string, g: THREE.Group): void {
  protos.delete(key);
  protos.set(key, g);
}

function enqueue(job: Job): void {
  // Insert in descending priority order, preserving FIFO within the same priority
  let idx = queue.findIndex(j => j.priority < job.priority);
  if (idx < 0) idx = queue.length;
  queue.splice(idx, 0, job);
}

function pool() {
  if (slots) return slots;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
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
const viaWorker = (key: string, recipe: ModelRecipe, priority: number, tag: string) => new Promise<THREE.Group>((resolve, reject) => {
  enqueue({ id: nextId++, key, recipe, priority, tag, resolve, reject });
  pump();
});
const onMain = async (recipe: ModelRecipe) => { const k = await import('./kit.ts'); await k.whenModelReady(recipe); return k.buildFresh(recipe); };

/** Resolves with the cached prototype of a recipe, building it first if needed. */
export function prototype(recipe: ModelRecipe, opts: boolean | BuildOpts = false): Promise<THREE.Group> {
  const key = keyOf(recipe);
  const have = protos.get(key);
  if (have) {
    touchProto(key, have);
    return Promise.resolve(have);
  }
  const { priority, tag } = normOpts(opts);
  const existingJob = queue.find(j => j.key === key);
  if (existingJob) {
    if (priority > existingJob.priority) {
      queue.splice(queue.indexOf(existingJob), 1);
      existingJob.priority = priority;
      if (tag) existingJob.tag = tag;
      enqueue(existingJob);
    } else if (tag) {
      existingJob.tag = tag;
    }
  }
  let p = waits.get(key);
  if (!p) {
    p = (broken ? Promise.reject(new Error('no workers')) : viaWorker(key, recipe, priority, tag))
      .catch(err => {
        if ((err as Error)?.message === 'cancelled') throw err;
        return onMain(recipe);
      })
      .then(g => { touchProto(key, g); waits.delete(key); return g; })
      .catch(err => { waits.delete(key); throw err; });
    waits.set(key, p);
  }
  return p;
}

/** A fresh instance of a recipe's model (shares GPU buffers with the prototype). */
export async function instance(recipe: ModelRecipe, opts: boolean | BuildOpts = false): Promise<THREE.Group> {
  const g = (await prototype(recipe, opts)).clone(true);
  return g;
}

/**
 * Cancels all unstarted worker jobs whose tag starts with `prefix` (e.g. `era:` or `prefetch:` when switching to a
 * new dynasty) so the worker pool immediately focuses on the newly active dynasty.
 */
export function cancelByTag(prefix: string): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].tag.startsWith(prefix)) {
      const [job] = queue.splice(i, 1);
      waits.delete(job.key);
      job.reject(new Error('cancelled'));
    }
  }
}

/**
 * Evicts cold prototypes beyond `MAX_PROTOS` while preserving any recipe in `keep` (the active and adjacent dynasties).
 */
export function prunePrototypes(keep: Iterable<ModelRecipe> = []): void {
  if (protos.size <= MAX_PROTOS) return;
  const protectedKeys = new Set<string>();
  for (const r of keep) protectedKeys.add(keyOf(r));
  for (const [k, g] of protos) {
    if (protos.size <= MAX_PROTOS) break;
    if (protectedKeys.has(k)) continue;
    protos.delete(k);
    g.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach(x => x.dispose());
        else m.material?.dispose();
      }
    });
  }
}

const warmed = new Set<string>();
/**
 * Fetches the hero packs these refs need where the models get built: in every worker (each has its own copy), or on
 * the main thread only when there are no workers.
 */
export function warmHeroes(refs: Iterable<unknown>): void {
  const fresh = [...refs].filter((r): r is string => !!parseHero(r) && !warmed.has(parseHero(r)!.pack));
  if (!fresh.length) return;
  for (const r of fresh) warmed.add(parseHero(r)!.pack);
  if (broken) { void loadHeroesFor(fresh); return; }
  for (const s of pool()) s.w.postMessage({ warm: fresh });
}

/**
 * Low-priority background pre-warmer for an upcoming dynasty: fetches its lazy hero chunks first, then queues its
 * primary models at lowest priority only if not already cached.
 */
export async function prefetchEraModels(recipes: ModelRecipe[], eraId: string): Promise<void> {
  const tag = `prefetch:${eraId}`;
  warmHeroes(recipes.map(r => r.hero));
  for (const r of recipes) {
    if (ready(r)) continue;
    try {
      await prototype(r, { priority: 10, tag });
    } catch {
      return;
    }
  }
}

export const ready = (recipe: ModelRecipe): boolean => protos.has(keyOf(recipe));
export const backlog = () => queue.length + (slots?.filter(s => s.busy).length ?? 0);
