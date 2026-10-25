import { hasScript } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import type { Era, HistEvent, Year } from '../../shared/data/types.ts';
import { CHRONICLE, chapterAt, currentEntry } from '../../shared/lib/chronicle.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { h, icon, iconBtn, setIcon } from './dom.ts';

/**
 * The period panel in the right-hand column: the current dynasty (header), the docked map legend, then 大事年表 — the
 * chronicle as a list (year · headline). The line at or before the timeline's year is highlighted and scrolled into
 * view; clicking a line opens the event. Folds to its dynasty header (to a slim tab on phones).
 */
export class Chronicle {
  readonly el: HTMLElement;
  private head: HTMLElement;
  private list: HTMLElement;
  private foldBtn: HTMLButtonElement;
  private era: Era | undefined;
  private events: HistEvent[] = [];
  private cur: string | null = null;
  private sel: string | null = null;
  private core = load<boolean>('chCore', false);
  private userScroll = -Infinity;
  onOpen: (e: HistEvent) => void = () => {};
  onEra: (id: string) => void = () => {};

  constructor() {
    this.head = h('header', { class: 'ch-head' });
    this.list = h('ol', { class: 'ch-list' });
    this.list.addEventListener('wheel', () => (this.userScroll = performance.now()), { passive: true });
    this.list.addEventListener('touchmove', () => (this.userScroll = performance.now()), { passive: true });
    this.foldBtn = iconBtn('up', t('fold'), () => this.fold(!this.folded), 'ch-fold');
    const tab = h('button', { type: 'button', class: 'ch-tab', onclick: () => this.fold(false) }, icon('list'), h('span'));
    this.el = h('aside', { class: 'chronicle', 'aria-label': t('chronicle') }, tab, this.head, this.list, this.foldBtn);
    const mobile = matchMedia('(max-width: 720px)').matches;
    this.fold(load<boolean>('chFolded', mobile), false);
  }

  get folded(): boolean { return this.el.classList.contains('folded'); }

  /** Docks a section (the map legend) between the dynasty header and the list. */
  mount(section: HTMLElement): void { this.el.insertBefore(section, this.list); }

  fold(on: boolean, persist = true): void {
    this.el.classList.toggle('folded', on);
    setIcon(this.foldBtn, on ? 'down' : 'up');
    this.foldBtn.title = this.foldBtn.ariaLabel = t(on ? 'unfold' : 'fold');
    if (persist) save('chFolded', on);
    if (!on) this.scrollToCur(true);
  }

  /** Follows the timeline: rebuilds when the dynasty changes, otherwise just moves the highlight. */
  setYear(y: Year): void {
    this.lastYear = y;
    const { era, events } = chapterAt(y, this.core ? CHRONICLE.filter(e => e.weight <= 2) : CHRONICLE);
    if (era?.id !== this.era?.id || events.length !== this.events.length) {
      this.era = era;
      this.events = events;
      this.build();
    }
    const c = currentEntry(y, this.events);
    const id = c && c.year <= y ? c.id : null;
    if (id !== this.cur) {
      this.cur = id;
      for (const li of this.list.children as HTMLCollectionOf<HTMLElement>) li.classList.toggle('cur', li.dataset.id === id);
      this.scrollToCur();
    }
  }

  select(id: string | null): void {
    this.sel = id;
    for (const li of this.list.children as HTMLCollectionOf<HTMLElement>) li.classList.toggle('sel', li.dataset.id === id);
  }

  private scrollToCur(force = false): void {
    if (this.folded || (!force && performance.now() - this.userScroll < 4000)) return;
    const li = this.list.querySelector<HTMLElement>('.cur');
    if (!li) { this.list.scrollTop = 0; return; }
    const H = this.list.clientHeight;
    // not laid out yet (first paint, or just unfolded): retry next frame
    if (!H) { if (!this.retry) this.retry = requestAnimationFrame(() => { this.retry = 0; this.scrollToCur(force); }); return; }
    const top = li.getBoundingClientRect().top - this.list.getBoundingClientRect().top + this.list.scrollTop - H * 0.35;
    const far = Math.abs(top - this.list.scrollTop) > H * 2;
    this.list.scrollTo({ top, behavior: force || far ? 'auto' : 'smooth' });
  }
  private retry = 0;

  private build(): void {
    const era = this.era;
    const L = lang;
    const filter = h('div', { class: 'seg ch-filter', role: 'radiogroup' }, ...([false, true] as const).map(core => h('button', {
      type: 'button', role: 'radio', class: this.core === core ? 'on' : '', 'aria-checked': String(this.core === core), text: t(core ? 'chCore' : 'chAll'),
      onclick: () => { this.core = core; save('chCore', core); this.era = undefined; this.setYear(this.lastYear); },
    })));
    (this.el.querySelector('.ch-tab span') as HTMLElement).textContent = era ? `${tr(era.short, L)} · ${t('chronicle')}` : t('chronicle');
    this.head.replaceChildren(
      h('div', { class: 'ch-k' }, h('span', { text: t('chronicle') }), filter),
      era ? h('button', { type: 'button', class: 'ch-era', style: `--c:${era.color}`, onclick: () => this.onEra(era.id) },
        h('i', { class: 'dot' }), h('b', { text: tr(era.name, L) }),
        h('small', { text: `${formatYear(era.start, L, { short: true })} – ${formatYear(era.end, L, { short: true })} · ${t('chCount', { n: this.events.length })}` })) : h('span'));
    this.list.replaceChildren(...this.events.map(e => {
      const li = h('li', { 'data-id': e.id, class: `w${e.weight} k-${e.kind}` + (e.id === this.sel ? ' sel' : '') },
        h('button', { type: 'button', onclick: () => this.onOpen(e), title: tr(e.summary, L) },
          h('span', { class: 'ch-y', text: formatYear(e.year, L, { short: true }) }),
          h('span', { class: 'ch-t', text: tr(e.headline ?? e.title, L) }),
          e.mapChange ? h('i', { class: 'ch-m', title: t('chMap'), text: '◆' }) : null,
          hasScript(e) ? h('i', { class: 'ch-s', title: t('chStory'), text: '▶' }) : null));
      return li;
    }));
    this.cur = null;
  }

  private lastYear: Year = 0;
  update(y: Year): void { this.lastYear = y; this.setYear(y); }

  relabel(): void {
    this.el.setAttribute('aria-label', t('chronicle'));
    this.era = undefined;
    this.update(this.lastYear);
    this.fold(this.folded, false);
  }
}
