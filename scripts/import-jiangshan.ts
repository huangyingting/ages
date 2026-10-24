/**
 * Imports the historical atlas content of DeanChensj/jiangshan-map (GPL-3.0, see NOTICE.md) into Ages' own data
 * formats. The upstream data files are plain browser scripts that assign `window.*` globals; we evaluate them in a
 * Node VM sandbox at a pinned commit and normalise every record:
 *
 *   public/data/atlas/shapes.json      geometry, loaded lazily by the scene: deduplicated rings (VLQ, 0.01°),
 *                                      polity / first-level region / prefecture shapes per snapshot, modern
 *                                      provinces (without the nine-dash line, see ADR-009), lakes, and the precise
 *                                      geometry of our own 1940 and PRC maps (`x_*`, derived from the provinces).
 *   src/shared/data/gen/jiangshan.json content bundled with the app: dynasties, snapshot timeline, polities,
 *                                      chronicle events, settlements, passes, city lore, gazetteer, people,
 *                                      journeys, reign eras (年号), walls / canals / routes, river labels, music.
 *
 * Usage: node scripts/import-jiangshan.ts   (clones into .cache/jiangshan-map on first run)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import pc from 'polygon-clipping';
import { pinyin } from 'pinyin-pro';
import { encodeRing } from '../src/shared/lib/rings.ts';

const REPO = 'https://github.com/DeanChensj/jiangshan-map';
const SHA = '4eb009dec7ceee781f8181a370afaddd11dbcf59';
const DIR = '.cache/jiangshan-map';

if (!existsSync(DIR)) {
  mkdirSync('.cache', { recursive: true });
  execFileSync('git', ['clone', '-q', REPO, DIR], { stdio: 'inherit' });
}
execFileSync('git', ['-C', DIR, 'fetch', '-q', 'origin', SHA], { stdio: 'inherit' });
execFileSync('git', ['-C', DIR, 'checkout', '-q', SHA], { stdio: 'inherit' });

type Pt = [number, number];
type Shape = { type: 'Polygon'; coordinates: Pt[][] } | { type: 'MultiPolygon'; coordinates: Pt[][][] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const ctx: Any = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ['map_data', 'lore_data', 'atlas_snapshots', 'china_geo_data', 'i18n_dict']) {
  vm.runInContext(readFileSync(`${DIR}/js/${f}.js`, 'utf8'), ctx, { filename: `${f}.js` });
}
const W = ctx.window;
const LORE = W.ATLAS_LORE_DATA;
const SNAPS: Record<string, Any> = W.ATLAS_SNAPSHOTS;
const EN = W.EN_LOCALE;
const DICT: Record<string, string> = EN.dict;

const en = (zh: string | undefined | null, fallback = ''): string => (zh ? DICT[zh] ?? fallback : fallback);
const i18n = (zh: string, enText?: string | null) => ({ zh, en: enText || en(zh, zh) });
const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (c: Pt): Pt => [r2(c[0]), r2(c[1])];

// ------------------------------------------------------------------ geometry

const rings: string[] = [];
const ringIdx = new Map<string, number>();
function ringRef(ring: Pt[]): number | null {
  const pts: Pt[] = [];
  for (const p of ring) {
    const q = pt(p);
    const last = pts[pts.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) pts.push(q);
  }
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return null;
  const s = encodeRing(pts);
  let i = ringIdx.get(s);
  if (i === undefined) { i = rings.length; rings.push(s); ringIdx.set(s, i); }
  return i;
}
/** All rings of a shape (outer rings and holes), painted with the even-odd rule. */
function shapeRings(shape: Shape | undefined | null): number[] {
  if (!shape) return [];
  const polys = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
  const out: number[] = [];
  for (const poly of polys) for (const ring of poly) { const r = ringRef(ring); if (r !== null) out.push(r); }
  return out;
}

const names: string[] = [];
const nameIdx = new Map<string, number>();
function nameRef(zh: string): number {
  let i = nameIdx.get(zh);
  if (i === undefined) { i = names.length / 2; names.push(zh, en(zh, zh)); nameIdx.set(zh, i); }
  return i;
}

// ------------------------------------------------------------------ dynasties and the snapshot timeline

const ROLE: Record<string, string> = { main: 'main', rival: 'rival', neighbor: 'neighbor', protectorate: 'protectorate' };
const dynasties = (W.DYNASTY_DATA as Any[]).map(d => {
  const e = EN.dynasties[d.key] ?? {};
  return {
    id: d.key, name: i18n(d.title, e.name), short: i18n(d.badge, e.short), start: d.fromYear, end: d.toYear, color: d.tint,
    seat: i18n(d.seat, e.capital), summary: i18n(d.summary, e.desc),
  };
});

interface SnapMeta { id: string; dyn: string; start: number; end: number; title: { zh: string; en: string }; note?: { zh: string; en: string } }
const timeline: SnapMeta[] = [];
for (const d of W.DYNASTY_DATA as Any[]) {
  const phases: Any[] = d.phases ?? [];
  let start = d.fromYear;
  for (const p of phases) {
    const s = SNAPS[p.snap];
    if (!s) throw new Error(`missing snapshot ${p.snap}`);
    const zh = (s.caption || p.overview || d.title).replace(/\s+/g, ' ').trim();
    const note = (s.note || '').replace(/\s+/g, ' ').trim();
    timeline.push({ id: p.snap, dyn: d.key, start, end: p.until, title: i18n(zh, DICT[s.caption] ?? DICT[p.overview]), note: note ? i18n(note, DICT[s.note]) : undefined });
    start = p.until + 1;
  }
}
timeline.sort((a, b) => a.start - b.start);

// polities: one entry per distinct title; per-snapshot tint and role stay on each feature
const polities: { id: string; name: { zh: string; en: string }; color: string; role: string }[] = [];
const polityId = new Map<string, string>();
function polityRef(title: string, tint: string, role: string): string {
  let id = polityId.get(title);
  if (!id) {
    id = `j${polities.length}`;
    polityId.set(title, id);
    polities.push({ id, name: i18n(title), color: tint, role: ROLE[role] ?? 'neighbor' });
  }
  return id;
}

const used = new Set(timeline.map(t => t.id));
const shapeSnaps: Record<string, Any> = {};
for (const id of used) {
  const s = SNAPS[id];
  const pol = (s.polities ?? []).map((p: Any) => {
    const r = shapeRings(p.shape);
    return r.length ? [polityRef(p.title, p.tint, p.role), p.tint, ROLE[p.role] ?? 'neighbor', p.anchor ? pt(p.anchor) : null, r] : null;
  }).filter(Boolean);
  const admin = (list: Any[] | undefined) => (list ?? []).map((f: Any) => {
    const r = shapeRings(f.shape);
    return r.length ? [nameRef(f.title), nameRef(f.category ?? ''), f.anchor ? pt(f.anchor) : null, r] : null;
  }).filter(Boolean);
  shapeSnaps[id] = {
    p: pol,
    // first-level regions (道 / 路 / 省 …) and prefectures (郡 / 州 / 府 …); `*Ref` reuses another snapshot's
    g: s.regionRef && !s.regions?.length ? s.regionRef : admin(s.regions),
    f: s.prefRef && !s.prefectures?.length ? s.prefRef : admin(s.prefectures),
  };
}
// referenced snapshots that are not on the timeline still need their admin shapes
for (const id of Object.keys(shapeSnaps)) {
  for (const k of ['g', 'f']) {
    const ref = shapeSnaps[id][k];
    if (typeof ref === 'string' && !shapeSnaps[ref]) {
      const s = SNAPS[ref];
      shapeSnaps[ref] = { p: [], g: [], f: [] };
      shapeSnaps[ref][k] = (k === 'g' ? s.regions : s.prefectures ?? []).map((f: Any) => {
        const r = shapeRings(f.shape);
        return r.length ? [nameRef(f.title), nameRef(f.category ?? ''), f.anchor ? pt(f.anchor) : null, r] : null;
      }).filter(Boolean);
    }
  }
}

// modern provinces (the `_JD` entry is the nine-dash line, deliberately not imported — see ADR-009)
const provinces = (W.PROVINCE_OUTLINES as Any[])
  .filter(p => !String(p.code).includes('_JD'))
  .map(p => [nameRef(p.title), p.hub ? pt(p.hub) : null, shapeRings({ type: 'MultiPolygon', coordinates: p.rings })]);

// ------------------------------------------------------------------ modern-era maps from precise outlines

// Our own maps for 1937–45 and the PRC (see src/shared/data/territories.ts) take their borders from the modern
// provincial outlines: the PRC is their union, and neighbours are clipped against it so shared borders coincide.
const toMulti = (sh: Shape): Pt[][][] => (sh.type === 'Polygon' ? [sh.coordinates] : sh.coordinates);
const ringArea = (r: Pt[]) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a / 2); };
// provinces do not tile perfectly: drop the pinholes their union leaves (< ~100 km²)
const multiRings = (m: Pt[][][]): number[] => shapeRings({ type: 'MultiPolygon', coordinates: m.map(([outer, ...holes]) => [outer, ...holes.filter(h => ringArea(h) > 0.01)]) });
const largest = (m: Pt[][][]): Pt[][][] => [m.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a))];
const PROV = W.PROVINCE_OUTLINES as Any[];
const provShape = (p: Any): Pt[][][] => p.rings;
const isColony = (p: Any) => /香港|澳门/.test(p.title);
const real = PROV.filter(p => !String(p.code).includes('_JD'));
const PRC_ALL = pc.union(...(real.map(provShape) as [Pt[][][]])) as Pt[][][];
const PRC_1950 = pc.union(...(real.filter(p => !isColony(p)).map(provShape) as [Pt[][][]])) as Pt[][][];
const provOf = (re: RegExp): Pt[][][] => provShape(real.find(p => re.test(p.title)));
const polityShape = (snap: string, re: RegExp): Pt[][][] => toMulti(SNAPS[snap].polities.find((p: Any) => re.test(p.title)).shape);
// Mongolia: the 1946 outline widened southwards, then cut by the PRC so the two meet exactly
const MONGOLIA = largest(pc.difference(pc.union(polityShape('s_roc_d', /^蒙古人民共和国$/), [[[[88, 40], [120, 40], [120, 46.2], [88, 46.2], [88, 40]]]]), PRC_ALL) as Pt[][][]);
// 1940: the textbook front line (Baotou – Shanxi – the 1938 Yellow River flood – Wuhan salient to Yichang – Nanchang –
// south of the lower Yangtze – Hangzhou), drawn generously outside it and clipped to the Republic and Manchukuo
const FRONT_1940: Pt[] = [[122.5, 30.0], [124.0, 33.5], [127.0, 39.0], [135.0, 45.0], [135.0, 54.0], [108.5, 54.0], [109.0, 42.5], [109.6, 41.2],
  [110.0, 40.5], [110.8, 39.8], [111.2, 39.0], [111.4, 38.3], [111.6, 37.6], [111.7, 36.8], [111.5, 36.1], [111.3, 35.6], [111.0, 35.2],
  [111.5, 35.35], [112.1, 35.35], [112.7, 35.2], [113.3, 35.05], [113.7, 34.9], [114.0, 34.5], [114.3, 34.1], [114.8, 33.6], [115.4, 33.15],
  [115.9, 32.8], [116.4, 32.55], [116.8, 32.3], [117.2, 31.95], [117.0, 31.5], [116.8, 31.15], [116.5, 30.7], [116.1, 30.3], [115.7, 30.15],
  [115.3, 30.4], [114.9, 30.85], [114.6, 31.3], [114.4, 31.7], [114.2, 32.2], [113.8, 32.15], [113.5, 31.95], [113.3, 31.7], [112.9, 31.45],
  [112.5, 31.2], [112.0, 31.05], [111.6, 30.95], [111.2, 30.75], [111.4, 30.45], [111.9, 30.3], [112.4, 30.15], [112.8, 29.85], [113.0, 29.5],
  [113.3, 29.25], [113.8, 29.15], [114.3, 29.05], [114.8, 28.85], [115.3, 28.6], [115.75, 28.5], [116.05, 28.8], [116.3, 29.3], [116.6, 29.75],
  [117.0, 30.15], [117.5, 30.5], [118.0, 30.8], [118.5, 31.0], [118.9, 31.2], [119.3, 31.1], [119.6, 30.8], [119.85, 30.45], [120.05, 30.15],
  [120.4, 30.0], [121.2, 29.9], [122.5, 30.0]];
const OCC_SOUTH: Pt[][] = [
  [[112.6, 23.75], [113.3, 23.8], [113.9, 23.55], [114.35, 23.1], [114.25, 22.6], [113.6, 22.2], [113.1, 22.1], [112.6, 22.6], [112.6, 23.75]], // Pearl River delta
  [[116.45, 23.55], [116.85, 23.6], [117.1, 23.3], [116.75, 23.05], [116.4, 23.2], [116.45, 23.55]], // Shantou
  [[117.95, 24.65], [118.3, 24.65], [118.3, 24.35], [117.95, 24.35], [117.95, 24.65]], // Xiamen
];
const ROC_1940 = pc.union(polityShape('s_roc', /^中华民国$/), polityShape('s_roc', /伪满洲国/));
const OCC_1940 = pc.union(
  pc.intersection(ROC_1940, [[FRONT_1940], ...OCC_SOUTH.map(r => [r])] as Pt[][][]),
  provOf(/海南/),
) as Pt[][][];
const PRC_TW_HAINAN = multiRings(PRC_1950);
const modernSnaps: Record<string, Any> = {
  x_prc1950: { p: [['mongolia', null, null, [103.0, 46.8], multiRings(MONGOLIA)], ['prc', null, null, [104.0, 34.0], PRC_TW_HAINAN],
    ['colony_uk', null, null, null, multiRings(provOf(/香港/))], ['colony_pt', null, null, null, multiRings(provOf(/澳门/))]], g: [], f: [] },
  x_prc2000: { p: [['mongolia', null, null, [103.0, 46.8], multiRings(MONGOLIA)], ['prc', null, null, [104.0, 34.0], multiRings(PRC_ALL)]], g: [], f: [] },
  x_war1940: { p: [...shapeSnaps.s_roc.p, ['jp_occ', null, null, [116.6, 36.4], multiRings(OCC_1940)]], g: [], f: [] },
};
Object.assign(shapeSnaps, modernSnaps);

const lakes = (W.HYDRO_DATA.lakes as Any[]).map(l => {
  const rs = (l.rings as Pt[][]).map(ringRef).filter((x): x is number => x !== null);
  return rs.length ? [l.name || '', l.rank ?? 9, l.appear ?? null, l.vanish ?? null, rs] : null;
}).filter(Boolean);

// ------------------------------------------------------------------ chronicle events

const milestones = (W.DYNASTY_DATA as Any[]).flatMap(d => d.milestones.map((m: Any) => {
  const e = EN.milestones[`${d.key}:${m.year}`] ?? [];
  return {
    id: `m-${d.key}-${m.year}`, dyn: d.key, year: m.year, title: i18n(m.headline, e[0]), site: i18n(m.site ?? '', e[1] ?? en(m.site)),
    lon: r2(m.coord[0]), lat: r2(m.coord[1]), map: !!m.isMapChange || undefined,
  };
}));
const landmarks = (LORE.PLACE_LANDMARK_EVENTS as Any[]).map((l, i) => ({
  id: `l-${l.dynastyKey}-${i}`, dyn: l.dynastyKey, year: l.year, title: i18n(l.zh, l.en), site: i18n(l.site ?? '', l.siteEn),
  lon: r2(l.coord[0]), lat: r2(l.coord[1]),
}));

// ------------------------------------------------------------------ places

const settlements = (W.DYNASTY_DATA as Any[]).flatMap(d => d.settlements.map((s: Any) => ({
  dyn: d.key, name: i18n(s.ancient), modern: i18n(s.modern), lon: r2(s.coord[0]), lat: r2(s.coord[1]),
  from: Math.max(d.fromYear, s.appear ?? -9999), to: Math.min(d.toYear, s.vanish ?? 9999),
  capital: !!s.isCapital || undefined, minor: s.tier === 2 || undefined, note: s.remark ? i18n(s.remark) : undefined,
})));
const passes = (LORE.STRATEGIC_PASSES as Any[]).map(p => ({
  id: p.key, name: { zh: p.ancientZh, en: p.ancientEn }, modern: { zh: p.modernZh, en: p.modernEn }, lon: r2(p.coord[0]), lat: r2(p.coord[1]),
  from: p.appear, to: p.vanish, focus: p.focusYear, range: { zh: p.rangeZh, en: p.rangeEn }, desc: { zh: p.chokepointZh, en: p.chokepointEn },
}));
const cities = (LORE.CITY_LORE as Any[]).map(c => ({
  modern: i18n(c.modern), lon: r2(c.coord[0]), lat: r2(c.coord[1]), tag: { zh: c.tagZh, en: c.tagEn }, desc: { zh: c.descZh, en: c.descEn },
}));
const gazetteer = (LORE.PLACE_GAZETTEER as Any[]).map(g => ({
  name: i18n(g.name), aliases: g.aliases ?? [], modern: i18n(g.modern ?? '', en(g.modern) || undefined), lon: r2(g.coord[0]), lat: r2(g.coord[1]),
}));

// ------------------------------------------------------------------ people, journeys, reigns, works

const people = (LORE.PERSON_PROFILES as Any[]).map(p => ({
  id: p.key, name: { zh: p.zh, en: p.en }, title: { zh: p.courtesyZh ?? '', en: p.courtesyEn ?? '' }, dyn: p.dynastyKey,
  span: p.span, aliases: p.aliases ?? [], tokens: p.tokens ?? [p.zh],
}));
const journeys = (LORE.HISTORICAL_JOURNEYS as Any[]).map(j => ({
  id: j.key, dyn: j.dynastyKey, color: j.color, short: { zh: j.shortZh, en: j.shortEn }, title: { zh: j.titleZh, en: j.titleEn },
  span: { zh: j.spanZh, en: j.spanEn },
  stops: (j.stops as Any[]).map(s => ({
    year: s.year, era: i18n(s.eraZh ?? ''), name: { zh: s.ancientZh, en: s.ancientEn }, modern: { zh: s.modernZh ?? '', en: s.modernEn ?? '' },
    lon: r2(s.coord[0]), lat: r2(s.coord[1]), via: s.via?.map(pt), from: s.fromCoord ? pt(s.fromCoord) : undefined,
    title: { zh: s.titleZh, en: s.titleEn }, desc: { zh: s.descZh, en: s.descEn },
    quote: s.quoteZh ? { zh: s.quoteZh, en: s.quoteEn ?? '' } : undefined,
  })),
}));
// [first year, era name, its year number in that first year, ruler zh, ruler en]
// era names carry the ruler's dynasty prefix (西汉武帝 · 西汉建元): strip it, and romanise eras that have no English name
const eraSpan = ([y, era, n, rz, re]: Any[]) => {
  let k = 0;
  while (k < era.length - 2 && era[k] === rz[k]) k++;
  const bare: string = era.slice(k);
  const py = (pinyin(bare, { toneType: 'none', type: 'array' }) as string[]).join('');
  return [y, bare, n, rz, re, en(era, '') || py.charAt(0).toUpperCase() + py.slice(1)];
};
const reigns = (LORE.CHINESE_ERA_SPANS as Any[]).map(eraSpan);
const regional = (LORE.REGIONAL_ERA_TRACKS as Any[]).map(t => ({
  regime: i18n(t.regime), polities: t.polities, until: t.until,
  spans: (t.spans as Any[]).map(eraSpan),
}));
const works = (W.CORRIDOR_DATA as Any[]).map(c => {
  const e = EN.corridors[c.key] ?? [];
  return {
    id: c.key, kind: c.kind, name: i18n(c.title, e[0]), span: c.span, summary: i18n(c.summary, e[1]), label: c.labelAt ? pt(c.labelAt) : null,
    lines: (c.segments as Pt[][]).map(s => s.map(pt)),
  };
});
const rivers = (W.HYDRO_DATA.labels as Any[]).map(l => ({
  name: { zh: l.zh.replace(/\s+/g, ''), en: l.en }, lon: r2(l.coord[0]), lat: r2(l.coord[1]), kind: l.kind,
  ...(l.appear != null ? { from: l.appear } : {}), ...(l.vanish != null ? { to: l.vanish - 1 } : {}),
}));
const music = (LORE.GUQIN_TRACKS as Any[]).map(t => ({ name: { zh: t.zh, en: t.en }, mp3: t.mp3, ogg: t.ogg }));

// ------------------------------------------------------------------ write

const source = { repo: REPO, sha: SHA, license: 'GPL-3.0 (CHGIS / Hartwell-derived boundaries: academic, non-commercial use)' };
mkdirSync('public/data/atlas', { recursive: true });
mkdirSync('src/shared/data/gen', { recursive: true });
writeFileSync('public/data/atlas/shapes.json', JSON.stringify({ source, rings, names, snaps: shapeSnaps, provinces, lakes }));
writeFileSync('src/shared/data/gen/jiangshan.json', JSON.stringify({
  source, dynasties, timeline, polities, milestones, landmarks, settlements, passes, cities, gazetteer, people, journeys, reigns, regional, works,
  rivers, music,
}));
const kb = (f: string) => `${(readFileSync(f).length / 1024).toFixed(0)} KB`;
console.log(`shapes: ${rings.length} rings, ${Object.keys(shapeSnaps).length} snapshots → ${kb('public/data/atlas/shapes.json')}`);
console.log(`content: ${timeline.length} phases, ${polities.length} polities, ${milestones.length} milestones, ${landmarks.length} landmarks, `
  + `${settlements.length} settlements, ${people.length} people, ${journeys.length} journeys, ${reigns.length} reigns → ${kb('src/shared/data/gen/jiangshan.json')}`);
