import { EVENTS } from '../data/events.ts';
import { ERAS } from '../data/eras.ts';
import { SNAPSHOTS } from '../data/territories.ts';
import type { Era, HistEvent, Snapshot, Year } from '../data/types.ts';
import { eraAt } from './timeline.ts';

/** The chronicle (大事年表): every Chinese-history event in time order, textbook events first within a year. */
export const CHRONICLE: HistEvent[] = EVENTS.filter(e => e.scope === 'china');

/** Lane-0 eras of Chinese history, in order (the chronicle's chapters). */
export const CHAPTERS: Era[] = ERAS.filter(e => e.scope === 'china' && (e.lane ?? 0) === 0).sort((a, b) => a.start - b.start);

/** The chapter for a year and the chronicle entries inside it. */
export function chapterAt(y: Year, list: HistEvent[] = CHRONICLE): { era: Era | undefined; events: HistEvent[] } {
  const era = eraAt(y, CHAPTERS);
  if (!era) return { era, events: [] };
  return { era, events: list.filter(e => eraAt(e.year, CHAPTERS)?.id === era.id) };
}

/** The last entry at or before `y` (the "current" line of the chronicle), or the first one after it. */
export function currentEntry(y: Year, list: HistEvent[]): HistEvent | undefined {
  let best: HistEvent | undefined;
  for (const e of list) { if (e.year <= y) best = e; else break; }
  return best ?? list[0];
}

export interface Phase {
  snap: Snapshot;
  /** phases of the same dynasty (imported) or era (curated), in order */
  group: Snapshot[];
  index: number;
  from: Year;
  to: Year;
}

const groupKey = (s: Snapshot): string => s.dyn ?? eraAt(s.year)?.id ?? s.id;
/** The year a snapshot stops applying: its own end, or the year before the next snapshot. */
export function snapEnd(s: Snapshot, list: Snapshot[] = SNAPSHOTS): Year {
  const i = list.indexOf(s);
  const next = list[i + 1];
  return Math.min(s.end ?? Infinity, next ? next.year - 1 : 2025);
}

/** The territorial phase shown in `y`: the snapshot, its siblings in the same dynasty and its position among them. */
export function phaseAt(y: Year, list: Snapshot[] = SNAPSHOTS): Phase | null {
  if (y < -2070) return null;
  let snap: Snapshot | null = null;
  for (const s of list) if (s.year <= y && (!snap || s.year > snap.year)) snap = s;
  snap ??= list[0] ?? null;
  if (!snap) return null;
  const k = groupKey(snap);
  const group = list.filter(s => groupKey(s) === k);
  return { snap, group, index: group.indexOf(snap), from: snap.year, to: snapEnd(snap, list) };
}

/** The phase before `s` on the timeline (for the ghost outline of the previous borders). */
export function previousSnap(s: Snapshot | null, list: Snapshot[] = SNAPSHOTS): Snapshot | null {
  if (!s) return null;
  const i = list.indexOf(s);
  return i > 0 ? list[i - 1] : null;
}

/** Years worth stopping at with ‹ › : chronicle entries and the start of every territorial phase. */
export const STOPS: Year[] = [...new Set([...CHRONICLE.filter(e => e.year >= -2070).map(e => e.year), ...SNAPSHOTS.map(s => s.year)])].sort((a, b) => a - b);

/** The next stop after `y` (dir 1) or before it (dir -1); stays put at the ends. */
export function stepStop(y: Year, dir: 1 | -1, stops: Year[] = STOPS): Year {
  if (dir > 0) return stops.find(s => s > y) ?? y;
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < y) return stops[i];
  return y;
}
