import RAW from './gen/jiangshan.json' with { type: 'json' };
import type { EventKind, HistEvent, I18n, LonLat, ModelRecipe, Place, Polity, Snapshot, Year } from './types.ts';

/**
 * Content imported from DeanChensj/jiangshan-map (GPL-3.0, see NOTICE.md) by scripts/import-jiangshan.ts:
 * dated territorial phases, chronicle events, settlements with period names, passes, city lore, people, journeys,
 * reign eras (年号), walls / canals / routes and river labels. Geometry lives in public/data/atlas/shapes.json and is
 * loaded by the client (src/client/scene/shapes.ts). This module normalises the records into the app's content model;
 * curated data (events.ts, places.ts, territories.ts) is merged with it and always wins on conflicts.
 */
interface Raw {
  source: { repo: string; sha: string; license: string };
  dynasties: { id: string; name: I18n; short: I18n; start: Year; end: Year; color: string; seat: I18n; summary: I18n }[];
  timeline: { id: string; dyn: string; start: Year; end: Year; title: I18n; note?: I18n }[];
  polities: { id: string; name: I18n; color: string | null; role: string }[];
  milestones: { id: string; dyn: string; year: Year; title: I18n; site: I18n; lon: number; lat: number; map?: boolean }[];
  landmarks: { id: string; dyn: string; year: Year; title: I18n; site: I18n; lon: number; lat: number }[];
  settlements: { dyn: string; name: I18n; modern: I18n; lon: number; lat: number; from: Year; to: Year; capital?: boolean; minor?: boolean; note?: I18n }[];
  passes: { id: string; name: I18n; modern: I18n; lon: number; lat: number; from?: Year; to?: Year; focus?: Year; range: I18n; desc: I18n }[];
  cities: { modern: I18n; lon: number; lat: number; tag: I18n; desc: I18n }[];
  gazetteer: { name: I18n; aliases: string[]; modern: I18n; lon: number; lat: number }[];
  people: Person[];
  journeys: Journey[];
  reigns: [Year, string, number, string, string, string][];
  regional: { regime: I18n; polities: string[]; until: Year; spans: [Year, string, number, string, string, string][] }[];
  works: Work[];
  rivers: RiverLabel[];
  music: { name: I18n; mp3: string; ogg: string }[];
}
const J = RAW as unknown as Raw;

export const SOURCE = J.source;

export interface JourneyStop {
  year: Year; era: I18n; name: I18n; modern: I18n; lon: number; lat: number; via?: LonLat[]; from?: LonLat;
  title: I18n; desc: I18n; quote?: I18n;
}
/** A historical journey (秦始皇东巡, 张骞通西域, 玄奘西行 …) told stop by stop. */
export interface Journey { id: string; dyn: string; color: string; short: I18n; title: I18n; span: I18n; stops: JourneyStop[] }
/** A great work: wall, canal, road or route, drawn as a line through its active years. */
export interface Work { id: string; kind: 'wall' | 'canal' | 'road' | 'route' | 'sea' | string; name: I18n; span: [Year, Year]; summary: I18n; label: LonLat | null; lines: LonLat[][] }
export interface Person { id: string; name: I18n; title: I18n; dyn: string; span: [Year, Year]; aliases: string[]; tokens: string[] }
export interface Dynasty { id: string; name: I18n; short: I18n; start: Year; end: Year; color: string; seat: I18n; summary: I18n }

export const DYNASTIES: Dynasty[] = J.dynasties;
export const JOURNEYS: Journey[] = J.journeys;
export const WORKS: Work[] = J.works;
export const PEOPLE: Person[] = J.people;
/** A river or lake name on the map; `from` / `to` bound the years its course or water existed. */
export interface RiverLabel { name: I18n; lon: number; lat: number; kind: string; from?: Year; to?: Year }
export const RIVER_LABELS: RiverLabel[] = J.rivers;
export const MUSIC = J.music;
export const GAZETTEER = J.gazetteer;
export const PERSON = new Map(PEOPLE.map(p => [p.id, p]));
const BY_NAME = new Map(PEOPLE.map(p => [p.name.zh, p]));
export const personNamed = (zh: string): Person | undefined => BY_NAME.get(zh);
/** The imported dynasty record for an era band (matched by its Chinese name). */
export const dynastyOfEra = (nameZh: string): Dynasty | undefined => DYNASTIES.find(d => d.name.zh === nameZh);

export const dynastyAt = (y: Year): Dynasty | undefined => {
  let best: Dynasty | undefined;
  for (const d of DYNASTIES) if (y >= d.start && y <= d.end) best = d;
  return best;
};

// ------------------------------------------------------------------ polities and snapshots

/** jiangshan-map draws polities without a tint (neighbours) in a neutral earth tone. */
const NEIGHBOR_TINT = '#a87a4c';
export const IMPORTED_POLITIES: Polity[] = J.polities.map(p => ({ id: p.id, name: p.name, color: p.color ?? NEIGHBOR_TINT, role: p.role as Polity['role'] }));

/** Dated phases from 403 BCE to 1949; `regions` are filled from the shape store when it has loaded. */
export const IMPORTED_SNAPSHOTS: Snapshot[] = J.timeline.map(t => ({
  id: t.id, scope: 'china', year: t.start, end: t.end, dyn: t.dyn, title: t.title, note: t.note, regions: [], shapes: t.id,
}));
// a dynasty's last phase and the next dynasty's first can share their boundary year: the new dynasty takes the next year
for (let i = 1; i < IMPORTED_SNAPSHOTS.length; i++) {
  const a = IMPORTED_SNAPSHOTS[i - 1], b = IMPORTED_SNAPSHOTS[i];
  if (b.year <= a.year) b.year = a.year + 1;
}

// ------------------------------------------------------------------ reign eras

const CN = '〇一二三四五六七八九';
function cnNum(n: number): string {
  if (n === 1) return '元';
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
  if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  return String(n);
}
export interface Reign { era: string; eraEn: string; year: number; ruler: I18n; label: I18n }
const mkReign = (s: Raw['reigns'][number], y: Year): Reign => {
  const n = s[2] + (y - s[0]) - (s[0] < 0 && y > 0 ? 1 : 0);
  const era = s[1];
  return {
    era, eraEn: s[5], year: n, ruler: { zh: s[3], en: s[4] },
    label: { zh: `${s[3]} · ${era}${cnNum(n)}年`, en: `${s[4]} · ${s[5] ? `${s[5]} ${n}` : `reign year ${n}`}` },
  };
};
/** The orthodox reign era (年号) in force in a year, e.g. 汉武帝 · 元狩二年; undefined before 841 BCE gaps or after 1912. */
export function reignAt(y: Year): Reign | undefined {
  const R = J.reigns;
  if (!R.length || y < R[0][0] || y > 1911) return undefined;
  let lo = 0, hi = R.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m][0] <= y) lo = m; else hi = m - 1; }
  return mkReign(R[lo], y);
}
/** Reign eras of rival regimes in force in a year (蜀汉, 孙吴, 辽, 金, 西夏 …). */
export function regionalReignsAt(y: Year): { regime: I18n; reign: Reign }[] {
  const out: { regime: I18n; reign: Reign }[] = [];
  for (const t of J.regional) {
    if (y > t.until || !t.spans.length || y < t.spans[0][0]) continue;
    let s = t.spans[0];
    for (const x of t.spans) if (x[0] <= y) s = x;
    out.push({ regime: t.regime, reign: mkReign(s, y) });
  }
  return out;
}

// ------------------------------------------------------------------ events

const near = (a: { lon: number; lat: number }, b: { lon: number; lat: number }, d: number) => Math.abs(a.lon - b.lon) < d && Math.abs(a.lat - b.lat) < d;

/** Classifies a chronicle headline. */
export function kindOf(zh: string, year: Year): EventKind {
  if (year >= 1840 && /革命|起义|运动|共产党|红军|长征|解放|武装/.test(zh)) return 'revolution';
  if (/之战|战役|之役|大战|会战|攻|伐|破|围|灭|征|叛|起兵|兵变|兵败|陷落|屠城|击败|入侵|反击|北伐|南征|西征|东征|平定|讨/.test(zh)) return 'war';
  if (/变法|改革|新政|改制|均田|两税|一条鞭|摊丁|科举|废除|推行|颁布|颁行|律|制度|改土归流|设.{0,4}(都护|行省|郡县)/.test(zh)) return 'reform';
  if (/历法|算|天文|发明|印刷|造纸|火药|指南|地动|医|本草|农书|天工|水运仪|测量/.test(zh)) return 'science';
  if (/和亲|出使|使团|结盟|会盟|和议|和约|朝贡|册封|条约|互市|通好|遣使|求和|入贡/.test(zh)) return 'diplomacy';
  if (/运河|漕|盐|铁|丝路|商|贸|市舶|钱|币|茶|屯田|开垦|水利|堰|渠|港/.test(zh)) return 'economy';
  if (/著|撰|编|诗|书法|画|佛|道教|儒|寺|石窟|经|学|书院|戏|乐|史记|典|文/.test(zh)) return 'culture';
  return 'politics';
}

function modelOf(zh: string, kind: EventKind, year: Year): ModelRecipe | undefined {
  const k = (kind2: string): ModelRecipe => ({ kind: kind2, year });
  if (/水师|舰|海战|海军|船|舟|下西洋|航海/.test(zh)) return k(kind === 'war' ? (year >= 1840 ? 'warship' : 'fireship') : 'junk');
  if (/长城|筑城|城墙/.test(zh)) return k('wall');
  if (/桥/.test(zh)) return k('bridge');
  if (/运河|渠|堰/.test(zh)) return k('weir');
  if (/寺|佛|塔|石窟/.test(zh)) return k('pagoda');
  if (/关/.test(zh) && kind === 'war') return k('gate');
  if (kind === 'war') return k(year >= 1840 ? 'cannon' : /骑|匈奴|突厥|蒙古|契丹|女真/.test(zh) ? 'rider' : 'army');
  if (/称帝|即位|建立|建国|定都|迁都|登基|立国|开国/.test(zh)) return k(year >= 1840 ? 'monument' : 'palace');
  if (kind === 'culture' || kind === 'science' || kind === 'reform') return k('scroll');
  if (/丝路|西域|商队/.test(zh)) return k('camel');
  if (kind === 'diplomacy') return k('flag');
  return undefined;
}

/** A short title: the clause before the first colon / semicolon (or the headline when it is already short). */
export function shortTitle(s: I18n): I18n {
  const cut = (t: string, seps: RegExp, max: number) => {
    const head = t.split(seps)[0].trim();
    if (head && head.length <= max) return head;
    return t.length <= max ? t : t.slice(0, max - 1).replace(/[，,、\s]+$/, '') + '…';
  };
  return { zh: cut(s.zh, /[：:；;，]/, 18), en: cut(s.en, /[:;]| — | – /, 64) };
}

function peopleIn(zh: string): I18n[] | undefined {
  const out: I18n[] = [];
  for (const p of PEOPLE) if (p.tokens.some(t => t.length > 1 && zh.includes(t))) out.push(p.name);
  return out.length ? out.slice(0, 4) : undefined;
}

/** Chronicle milestones and landmark events, minus those already told by a curated event (same year ±1, nearby). */
export function importedEvents(curated: HistEvent[]): HistEvent[] {
  const all = [...J.milestones, ...J.landmarks];
  const kept: typeof all = [];
  for (const m of all) {
    if (kept.some(k => k.year === m.year && near(k, m, 0.5))) continue;
    if (curated.some(c => Math.abs(c.year - m.year) <= 1 && near(c, m, 1.5))) continue;
    kept.push(m);
  }
  return kept.map(m => {
    const kind = kindOf(m.title.zh, m.year);
    const site = m.site.zh ? m.site : undefined;
    return {
      id: m.id, scope: 'china', year: m.year, kind, lon: m.lon, lat: m.lat, weight: 3,
      title: shortTitle(m.title),
      summary: site ? { zh: `${m.title.zh}（${site.zh}）`, en: `${m.title.en} (${site.en})` } : m.title,
      points: [], curriculum: [], model: modelOf(m.title.zh, kind, m.year), people: peopleIn(m.title.zh),
      source: 'jiangshan', site, headline: m.title, mapChange: ('map' in m && m.map === true) || undefined,
    } satisfies HistEvent;
  });
}

// ------------------------------------------------------------------ places

/**
 * Settlements grouped by location, each with its names by period (from the dynasty records), capital years and notes;
 * strategic passes; city lore. A settlement near a curated place enriches it instead of adding a duplicate label.
 */
export function importedPlaces(curated: Place[]): Place[] {
  const out: Place[] = [];
  const all = [...curated];
  const nearest = (lon: number, lat: number, d: number, list: Place[]) => {
    let best: Place | undefined, bd = d * d;
    for (const p of list) {
      const dd = (p.lon - lon) ** 2 + (p.lat - lat) ** 2;
      if (dd < bd) { bd = dd; best = p; }
    }
    return best;
  };
  // settlements → places
  const groups: { lon: number; lat: number; items: Raw['settlements'] }[] = [];
  for (const s of J.settlements) {
    const g = groups.find(x => near(x, s, 0.12));
    if (g) g.items.push(s); else groups.push({ lon: s.lon, lat: s.lat, items: [s] });
  }
  let n = 0;
  for (const g of groups) {
    g.items.sort((a, b) => a.from - b.from);
    const names: NonNullable<Place['names']> = [];
    for (const s of g.items) {
      const last = names[names.length - 1];
      if (last && last.name.zh === s.name.zh && s.from <= last.to + 1) last.to = Math.max(last.to, s.to);
      else names.push({ from: s.from, to: s.to, name: s.name });
    }
    const capital = g.items.filter(s => s.capital).map(s => [s.from, s.to] as [Year, Year]);
    const notes = g.items.filter(s => s.note).map(s => ({ from: s.from, to: s.to, text: s.note! }));
    const first = g.items[0];
    const c = nearest(g.lon, g.lat, 0.3, curated);
    const sameLandmark = c && (c.name.zh === first.modern.zh || names.some(s => s.name.zh === c.name.zh || s.name.zh.startsWith(c.name.zh + '（')));
    if (c?.kind === 'city' || sameLandmark) {
      // enrich the curated place: periods it lacks, notes
      c.notes = [...(c.notes ?? []), ...notes];
      c.periods = [...(c.periods ?? []), ...names];
      continue;
    }
    const p: Place = {
      // Keep existing j-IDs stable when separating a settlement previously merged into a nearby landmark.
      id: c ? `settlement-${g.lon}-${g.lat}` : `j${n++}`, scope: 'china', lon: g.lon, lat: g.lat, kind: 'city', name: first.modern.zh ? first.modern : first.name, names,
      capital: capital.length ? capital : undefined, tier: capital.length ? 2 : 3, minor: g.items.every(s => s.minor) || undefined,
      periodOnly: true, notes: notes.length ? notes : undefined, modern: first.modern,
    };
    out.push(p);
    all.push(p);
  }
  // passes
  for (const ps of J.passes) {
    const p: Place = {
      id: `pass-${ps.id}`, scope: 'china', lon: ps.lon, lat: ps.lat, kind: 'pass', name: ps.name, tier: 3, modern: ps.modern,
      names: ps.from !== undefined ? [{ from: ps.from, to: ps.to ?? 2100, name: ps.name }] : undefined, periodOnly: ps.from !== undefined || undefined,
      lore: { tag: ps.range, desc: ps.desc },
    };
    const c = nearest(ps.lon, ps.lat, 0.15, curated.filter(x => x.kind === 'pass'));
    if (c) { c.lore ??= p.lore; continue; }
    out.push(p);
    all.push(p);
  }
  // city lore
  for (const cl of J.cities) {
    const c = nearest(cl.lon, cl.lat, 0.35, all.filter(p => p.kind === 'city'));
    const lore = { tag: cl.tag, desc: cl.desc };
    if (c) { c.lore ??= lore; c.modern ??= cl.modern; continue; }
    const p: Place = { id: `city-${out.length}`, scope: 'china', lon: cl.lon, lat: cl.lat, kind: 'city', name: cl.modern, tier: 3, lore, modern: cl.modern };
    out.push(p);
    all.push(p);
  }
  // gazetteer aliases (古称) for search, when the gazetteer entry names the same place
  for (const g of J.gazetteer) {
    const c = nearest(g.lon, g.lat, 0.3, all);
    if (!c) continue;
    const known = new Set([c.name.zh, c.modern?.zh, ...(c.names ?? []).map(x => x.name.zh), ...(c.periods ?? []).map(x => x.name.zh)]);
    if ([g.name.zh, ...g.aliases].some(a => known.has(a))) c.aliases = [...new Set([...(c.aliases ?? []), g.name.zh, ...g.aliases])];
  }
  return out;
}
