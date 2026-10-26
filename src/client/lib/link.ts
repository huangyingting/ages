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
  else if (s.journey) p.set('j', s.journey);
  else if (s.year != null) p.set('y', String(Math.round(s.year)));
  if (s.lang) p.set('lang', s.lang);
  const h = '#' + p.toString();
  if (h !== location.hash) history.replaceState(null, '', h === '#' ? location.pathname + location.search : h);
}

/** The address to share: the current deep link (kept up to date by writeLink) without device-only flags such as ?lowfx. */
export function shareUrl(): string {
  const u = new URL(location.href);
  u.searchParams.delete('lowfx');
  return u.href;
}

/** Shares the current view: the system share sheet on touch devices, otherwise the clipboard. Resolves to 'copied',
 * 'shared' or null (cancelled / unavailable). */
export async function shareLink(title: string): Promise<'copied' | 'shared' | null> {
  const url = shareUrl();
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, url }); return 'shared'; } catch { return null; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { /* insecure context or denied: fall back */ }
  const ta = Object.assign(document.createElement('textarea'), { value: url, readOnly: true });
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok ? 'copied' : null;
}
