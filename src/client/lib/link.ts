/** Shareable deep links in the hash: #e=<event id> or #y=<year>, plus &lang=zh|en. */
import type { Lang } from '../../shared/data/types.ts';

export interface LinkState { event?: string; year?: number; lang?: Lang }

export function readLink(hash = location.hash): LinkState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const out: LinkState = {};
  const e = p.get('e'), y = p.get('y'), l = p.get('lang');
  if (e) out.event = e;
  if (y && /^-?\d+$/.test(y)) out.year = parseInt(y, 10);
  if (l === 'zh' || l === 'en') out.lang = l;
  return out;
}

export function writeLink(s: LinkState): void {
  const p = new URLSearchParams();
  if (s.event) p.set('e', s.event); else if (s.year != null) p.set('y', String(Math.round(s.year)));
  if (s.lang) p.set('lang', s.lang);
  const h = '#' + p.toString();
  if (h !== location.hash) history.replaceState(null, '', h === '#' ? location.pathname + location.search : h);
}
