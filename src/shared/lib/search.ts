import type { Era, HistEvent, I18n, Place } from '../data/types.ts';

export type Hit =
  | { type: 'event'; id: string; label: I18n; year: number; score: number }
  | { type: 'era'; id: string; label: I18n; year: number; score: number }
  | { type: 'place'; id: string; label: I18n; score: number; sub?: I18n }
  | { type: 'person'; id: string; label: I18n; score: number; sub?: I18n }
  | { type: 'journey'; id: string; label: I18n; score: number };

export interface SearchPerson { id: string; name: I18n; title: I18n; aliases: string[] }
export interface SearchJourney { id: string; title: I18n; short: I18n }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’'`·\-\s]/g, '');

/** Scores a text against a query: prefix 3, word-prefix 2, substring 1. */
function score(text: string, q: string): number {
  const t = norm(text);
  if (!q || !t) return 0;
  if (t.startsWith(q)) return 3;
  const words = text.toLowerCase().split(/[\s\-’'(),]+/);
  if (words.some((_, i) => norm(words.slice(i).join('')).startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
}
const best = (q: string, ...texts: (string | undefined)[]) => Math.max(0, ...texts.map(t => (t ? score(t, q) : 0)));

/** Bilingual search across events, eras and places. Matches both languages whatever the UI language is. */
export function search(query: string, src: { events: HistEvent[]; eras: Era[]; places: Place[]; people?: SearchPerson[]; journeys?: SearchJourney[] }, limit = 12): Hit[] {
  const q = norm(query.trim());
  if (!q) return [];
  const hits: Hit[] = [];
  for (const e of src.events) {
    // curated textbook events rank above imported chronicle entries
    let s = best(q, e.title.zh, e.title.en) * (e.source === 'jiangshan' ? 2 : 3);
    s = Math.max(s, best(q, ...(e.people ?? []).flatMap(p => [p.zh, p.en])) * 2);
    if (!s) s = best(q, e.summary.zh, e.summary.en) > 0 ? 1 : 0;
    if (s) hits.push({ type: 'event', id: e.id, label: e.title, year: e.year, score: s + (4 - e.weight) * 0.3 });
  }
  for (const e of src.eras) {
    const s = best(q, e.name.zh, e.name.en, e.short.zh, e.short.en) * 3;
    if (s) hits.push({ type: 'era', id: e.id, label: e.name, year: e.start, score: s + 0.5 });
  }
  for (const p of src.places) {
    let s = best(q, p.name.zh, p.name.en, p.modern?.zh, p.modern?.en) * 2;
    // matched only by a historical name / alias: show which one
    let via: I18n | undefined;
    if (!s) {
      const olds = [...(p.names ?? []), ...(p.periods ?? [])].map(n => n.name).concat((p.aliases ?? []).map(a => ({ zh: a, en: a })));
      for (const n of olds) {
        const v = best(q, n.zh, n.en) * 1.6;
        if (v > s) { s = v; via = n; }
      }
    }
    if (s) hits.push({ type: 'place', id: p.id, label: p.name, sub: via, score: s + (3 - p.tier) * 0.2 });
  }
  for (const p of src.people ?? []) {
    const s = best(q, p.name.zh, p.name.en, ...p.aliases) * 2;
    if (s) hits.push({ type: 'person', id: p.id, label: p.name, sub: p.title, score: s + 0.4 });
  }
  for (const j of src.journeys ?? []) {
    const s = best(q, j.title.zh, j.title.en, j.short.zh, j.short.en) * 2;
    if (s) hits.push({ type: 'journey', id: j.id, label: j.title, score: s + 0.3 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
