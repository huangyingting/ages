/**
 * Shareable deep links in the hash: #e=<event>, #p=<place>, #person=<id>, #life=<id>, #j=<journey>, #lesson=<id> or #y=<year>, plus
 * &lang=zh|en. The jiangshan-map style query (?year=&place=&person=&lang=) is read too.
 */
import type { Lang } from '../../shared/data/types.ts';

export interface LinkState { event?: string; place?: string; person?: string; life?: string; journey?: string; lesson?: string; year?: number; lang?: Lang }

export function readLink(hash = location.hash, search = typeof location === 'undefined' ? '' : location.search): LinkState {
  const out: LinkState = {};
  for (const p of [new URLSearchParams(search), new URLSearchParams(hash.replace(/^#/, ''))]) {
    const e = p.get('e') ?? p.get('event'), pl = p.get('p') ?? p.get('place'), pe = p.get('person'), li = p.get('life'), j = p.get('j') ?? p.get('journey'), le = p.get('lesson');
    const y = p.get('y') ?? p.get('year'), l = p.get('lang');
    if (e) out.event = e;
    if (pl) out.place = pl;
    if (pe) out.person = pe;
    if (li) out.life = li;
    if (j) out.journey = j;
    if (le) out.lesson = le;
    if (y && /^-?\d+$/.test(y)) out.year = parseInt(y, 10);
    if (l === 'zh' || l === 'en') out.lang = l;
  }
  return out;
}

export function writeLink(s: LinkState): void {
  const p = new URLSearchParams();
  if (s.lesson) p.set('lesson', s.lesson);
  else if (s.event) p.set('e', s.event);
  else if (s.place) { p.set('p', s.place); if (s.year != null) p.set('y', String(Math.round(s.year))); }
  else if (s.person) p.set('person', s.person);
  else if (s.life) p.set('life', s.life);
  else if (s.year != null) p.set('y', String(Math.round(s.year)));
  if (s.lang) p.set('lang', s.lang);
  const h = '#' + p.toString();
  if (h !== location.hash) history.replaceState(null, '', h === '#' ? location.pathname + location.search : h);
}
