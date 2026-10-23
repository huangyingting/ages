import type { I18n } from './i18n.ts';

export type { I18n, Lang } from './i18n.ts';
export { tr, LANGS } from './i18n.ts';

/** Years are astronomical-ish integers: negative = BCE (−221 = 221 BCE). Prehistory uses large negatives. */
export type Year = number;
export type LonLat = [number, number];

/**
 * Content scope. Phase 1 ships `china`; Phase 2 adds `world` (and possibly regional scopes). The scene filters by
 * the active scope, and the timeline shows the eras of that scope.
 */
export type Scope = 'china' | 'world';

export interface Wiki { zh?: string; en?: string }

/** A timeline band: a dynasty or period used for the coloured timeline, era readout and curriculum grouping. */
export interface Era {
  id: string;
  scope: Scope;
  name: I18n;
  /** short label for narrow timeline segments, e.g. 秦 / Qin */
  short: I18n;
  start: Year;
  end: Year;
  color: string;
  /** timeline lane: periods that overlap (e.g. 辽/北宋) sit in a second lane */
  lane?: 0 | 1;
  summary: I18n;
  capital?: string;
  wiki?: Wiki;
}

export interface Ruler { era: string; name: I18n; start: Year; end: Year }

/** A polity (dynasty, state or neighbour) whose territory can be drawn on the map. */
export interface Polity {
  id: string;
  name: I18n;
  color: string;
  /** neighbours are drawn muted; `main` polities belong to the narrative of Chinese history */
  role: 'main' | 'rival' | 'neighbor' | 'occupied';
  wiki?: Wiki;
}

/** One polity's area in a snapshot: one or more rings of lon/lat (land-masked when painted, so coasts can be loose). */
export interface Region { polity: string; rings: LonLat[][]; label?: LonLat; name?: I18n; hatch?: boolean }

/** A territorial map at a moment in time. The scene cross-fades between snapshots as the year changes. */
export interface Snapshot {
  id: string;
  scope: Scope;
  /** first year the map applies (usually the dynasty's start); the title names the year the outline depicts */
  year: Year;
  title: I18n;
  /** painted in order: later regions cover earlier ones (lets neighbours carve their border into a big polity) */
  regions: Region[];
  note?: I18n;
}

/** A city or site with names that change over time (长安 → 大兴 → 西安). */
export interface Place {
  id: string;
  scope: Scope;
  lon: number;
  lat: number;
  kind: 'city' | 'pass' | 'site' | 'mountain' | 'water';
  /** the modern name; `names` (if given) overrides it by period */
  name: I18n;
  names?: { from: Year; to: Year; name: I18n }[];
  /** years in which it was a capital (draws a capital marker) */
  capital?: [Year, Year][];
  /** importance: 1 always labelled, 2 when zoomed in, 3 only when relevant */
  tier: 1 | 2 | 3;
}

export type Book = 'g7a' | 'g7b' | 'g8a' | 'g8b' | 'hs1';
export interface CurriculumRef { book: Book; unit: number }
export interface Unit { book: Book; unit: number; title: I18n; range: [Year, Year] }

export type EventKind = 'prehistory' | 'politics' | 'war' | 'reform' | 'culture' | 'science' | 'economy' | 'diplomacy' | 'revolution';

/** Procedural 3D model recipe; `kind` selects a builder in src/client/models/kit.ts. */
export interface ModelRecipe { kind: string; color?: string; accent?: string; [k: string]: unknown }

export interface HistEvent {
  id: string;
  scope: Scope;
  year: Year;
  end?: Year;
  title: I18n;
  summary: I18n;
  /** key points students should remember (考点) */
  points: I18n[];
  kind: EventKind;
  lon: number;
  lat: number;
  place?: string;
  /** 1 = core curriculum, 2 = important, 3 = extension */
  weight: 1 | 2 | 3;
  model?: ModelRecipe;
  people?: I18n[];
  curriculum: CurriculumRef[];
  /** a scripted animation; events without one get an automatic story (fly → model → caption) */
  story?: StoryStep[];
  wiki?: Wiki;
}

/** Story DSL: steps run in order; `par: true` starts the step and moves on without waiting for it to finish. */
export type StoryStep =
  | { do: 'fly'; lon: number; lat: number; dist?: number; tilt?: number; dur?: number; par?: boolean }
  | { do: 'year'; year: Year; par?: boolean }
  | { do: 'caption'; text: I18n; dur?: number; par?: boolean }
  | { do: 'route'; pts: LonLat[]; dur: number; color?: string; model?: ModelRecipe; label?: I18n; dashed?: boolean; keep?: boolean; par?: boolean }
  | { do: 'build'; pts: LonLat[]; dur: number; kind: 'wall' | 'canal' | 'rail'; color?: string; par?: boolean }
  | { do: 'spawn'; lon: number; lat: number; model: ModelRecipe; scale?: number; label?: I18n; par?: boolean }
  | { do: 'fx'; lon: number; lat: number; fx: 'battle' | 'fire' | 'glow' | 'flag' | 'smoke' | 'firework'; color?: string; dur?: number; par?: boolean }
  | { do: 'army'; from: LonLat; to: LonLat; color: string; dur: number; count?: number; par?: boolean }
  | { do: 'highlight'; polity: string; dur?: number; par?: boolean }
  | { do: 'wait'; dur: number };
