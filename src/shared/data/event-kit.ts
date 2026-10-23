import type { Book, CurriculumRef, EventKind, HistEvent, LonLat, ModelRecipe, StoryStep, Year } from './types.ts';
import { PLACE } from './places.ts';

/** Procedural model kinds the client knows how to build (builders: src/client/models/build-ancient.ts, build-modern.ts). */
export const MODEL_KINDS = [
  'cave', 'hut', 'stilt', 'jade', 'ding', 'oracle', 'chariot', 'bell', 'wall', 'beacon', 'palace', 'gate', 'pagoda', 'warrior', 'camel',
  'junk', 'boat', 'fireship', 'warship', 'weir', 'bridge', 'scroll', 'army', 'rider', 'cannon', 'flag', 'train', 'factory', 'rocket',
  'monument', 'redboat', 'statue', 'temple', 'seismoscope', 'stadium', 'skyline', 'printing', 'compass', 'tent', 'yurt', 'dam',
] as const;
export type ModelKind = typeof MODEL_KINDS[number];

type Pair = [zh: string, en: string];
export interface EvIn {
  id: string;
  y: Year;
  end?: Year;
  k: EventKind;
  /** a place id or [lon, lat] */
  at: string | LonLat;
  w: 1 | 2 | 3;
  t: Pair;
  s: Pair;
  p: Pair[];
  /** curriculum tags, e.g. 'g7a.3 hs1.1' */
  c: string;
  m?: ModelKind | (ModelRecipe & { kind: ModelKind });
  wiki?: Pair;
  who?: Pair[];
  story?: StoryStep[];
}

const i18 = ([zh, en]: Pair) => ({ zh, en });

export function parseCurriculum(c: string): CurriculumRef[] {
  return c.split(/\s+/).filter(Boolean).map(tag => {
    const [book, unit] = tag.split('.');
    return { book: book as Book, unit: Number(unit) };
  });
}

export function ev(e: EvIn): HistEvent {
  let lon: number, lat: number, place: string | undefined;
  if (typeof e.at === 'string') {
    const p = PLACE.get(e.at);
    if (!p) throw new Error(`event ${e.id}: unknown place ${e.at}`);
    ({ lon, lat } = p);
    place = p.id;
  } else [lon, lat] = e.at;
  return {
    id: e.id, scope: 'china', year: e.y, end: e.end, kind: e.k, lon, lat, place, weight: e.w,
    title: i18(e.t), summary: i18(e.s), points: e.p.map(i18), curriculum: parseCurriculum(e.c),
    model: typeof e.m === 'string' ? { kind: e.m } : e.m,
    wiki: e.wiki ? { zh: e.wiki[0], en: e.wiki[1] } : undefined,
    people: e.who?.map(i18),
    story: e.story,
  };
}
