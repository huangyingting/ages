import { EVENTS } from './events.ts';
import { personModel } from './heroes.ts';
import { personNamed, type Person } from './jiangshan.ts';
import { PLACE } from './places.ts';
import type { Era, HistEvent, I18n, ModelRecipe } from './types.ts';

/** One model standing on the map for a dynasty: a landmark of one of its events, or one of its people. */
export interface SceneryItem {
  /** the event it belongs to */
  event: string;
  kind: 'landmark' | 'person';
  lon: number;
  lat: number;
  model: ModelRecipe;
  /** a person's name (landmarks are named by their event pin) */
  name?: I18n;
  person?: Person;
  yaw?: number;
}

const MAX_LANDMARKS = 8;
const MAX_PEOPLE = 6;
/** degrees kept clear between any two models (and the capital's palace), so the map doesn't turn into a heap */
const SPACING = 1.5;
/** how far (degrees) a model may step off its event's spot to find room: landmarks stay close, people stand beside */
const LANDMARK_RINGS = [0, 0.9, 1.4];
const PERSON_RINGS = [1.1, 1.6, 2.1];

/** Generic figures stand straight on the map; named heroes keep their own model. */
const bare = (m: ModelRecipe): ModelRecipe => (m.hero ? m : { ...m, bare: true });

type Pt = { lon: number; lat: number };
/** The first free spot at `at` or on a ring around it (8 directions, starting south-east, the side facing the camera). */
function room(at: Pt, taken: Pt[], rings: number[]): Pt | null {
  for (const r of rings) {
    for (let k = 0; k < (r ? 8 : 1); k++) {
      const a = -Math.PI / 4 + (k * Math.PI) / 4;
      const p = { lon: at.lon + r * Math.cos(a) * 1.2, lat: at.lat + r * Math.sin(a) };
      if (!taken.some(q => near(q, p, SPACING))) return p;
    }
  }
  return null;
}

/** Generic map objects (banners, armies, plain scrolls) that say little about a place. */
const isLandmark = (m: ModelRecipe | undefined): m is ModelRecipe =>
  !!m && !(m.kind === 'flag' || m.kind === 'army' || (m.kind === 'scroll' && !m.hero));

const near = (a: { lon: number; lat: number }, b: { lon: number; lat: number }, d: number) => Math.hypot(a.lon - b.lon, a.lat - b.lat) < d;

/**
 * The scenery for a dynasty: landmarks of its key (non-war) textbook events — buildings, works, ships, inventions — and
 * its famous people in period dress standing beside them. Most important events first; nothing piles up on the capital
 * (which has its own palace) or on another landmark.
 */
export function sceneryOf(era: Era, events: HistEvent[] = EVENTS): SceneryItem[] {
  const list = events
    .filter(e => e.scope === era.scope && !e.source && e.year >= era.start && e.year <= era.end)
    .sort((a, b) => a.weight - b.weight || Number(!!b.model?.hero) - Number(!!a.model?.hero) || a.year - b.year);
  const cap = era.capital ? PLACE.get(era.capital) : undefined;
  const taken: Pt[] = cap ? [cap] : [];
  const marks: SceneryItem[] = [];
  for (const e of list) {
    if (marks.length >= MAX_LANDMARKS) break;
    if (e.kind === 'war' || !isLandmark(e.model)) continue;
    if (cap && e.model.kind === 'palace' && near(e, cap, 0.8)) continue;
    const at = room(e, taken, LANDMARK_RINGS);
    if (!at) continue;
    taken.push(at);
    marks.push({ event: e.id, kind: 'landmark', ...at, model: e.model, yaw: 0.3 });
  }
  const seen = new Set<string>();
  const people: SceneryItem[] = [];
  for (const e of list) {
    if (people.length >= MAX_PEOPLE) break;
    const n = e.people?.[0];
    if (!n) continue;
    const zh = n.zh.replace(/（.*）|\(.*\)/g, '').trim();
    if (seen.has(zh)) continue;
    const p = personNamed(n.zh) ?? personNamed(zh);
    if (!p) continue;
    const at = room(marks.find(m => m.event === e.id) ?? e, taken, PERSON_RINGS);
    if (!at) continue;
    taken.push(at);
    seen.add(zh);
    people.push({ event: e.id, kind: 'person', ...at, model: bare(personModel(p)), name: p.name, person: p, yaw: -0.4 });
  }
  return [...marks, ...people];
}
