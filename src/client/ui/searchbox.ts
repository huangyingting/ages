import { ERAS } from '../../shared/data/eras.ts';
import { EVENTS } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import { PLACES } from '../../shared/data/places.ts';
import { search, type Hit } from '../../shared/lib/search.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import { h, icon } from './dom.ts';

/** Bilingual search over events, eras and places with keyboard navigation. */
export class SearchBox {
  readonly el: HTMLElement;
  readonly input: HTMLInputElement;
  private list: HTMLElement;
  private hits: Hit[] = [];
  private cur = 0;
  onPick: (h: Hit) => void = () => {};

  constructor() {
    this.input = h('input', { type: 'search', class: 'q', placeholder: t('search'), 'aria-label': t('search'), autocomplete: 'off', spellcheck: 'false' });
    this.list = h('ul', { class: 'hits', role: 'listbox', hidden: true });
    this.el = h('div', { class: 'search' }, icon('search'), this.input, this.list);
    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('focus', () => this.update());
    this.input.addEventListener('blur', () => setTimeout(() => (this.list.hidden = true), 150));
    this.input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { this.move(1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.move(-1); e.preventDefault(); }
      else if (e.key === 'Enter') { const x = this.hits[this.cur]; if (x) this.pick(x); }
      else if (e.key === 'Escape') { this.input.value = ''; this.list.hidden = true; this.input.blur(); }
      e.stopPropagation();
    });
  }

  private update(): void {
    const q = this.input.value.trim();
    this.hits = q ? search(q, { events: EVENTS, eras: ERAS, places: PLACES }, 8) : [];
    this.cur = 0;
    if (!q) { this.list.hidden = true; return; }
    this.list.replaceChildren(...(this.hits.length ? this.hits.map((x, i) => h('li', {
      role: 'option', class: i === this.cur ? 'cur' : '', 'aria-selected': String(i === this.cur),
      onmousedown: (e: Event) => { e.preventDefault(); this.pick(x); },
    }, h('span', { class: `ty ty-${x.type}`, text: x.type === 'event' ? '◆' : x.type === 'era' ? '▬' : '●' }),
      h('span', { class: 'lb', text: tr(x.label, lang) }),
      'year' in x ? h('span', { class: 'yr', text: formatYear(x.year, lang, { short: true }) }) : null)) : [h('li', { class: 'none', text: t('noHits') })]));
    this.list.hidden = false;
  }

  private move(d: number): void {
    if (!this.hits.length) return;
    this.cur = (this.cur + d + this.hits.length) % this.hits.length;
    [...this.list.children].forEach((c, i) => { c.classList.toggle('cur', i === this.cur); c.setAttribute('aria-selected', String(i === this.cur)); });
  }

  private pick(x: Hit): void {
    this.list.hidden = true;
    this.input.value = '';
    this.input.blur();
    this.onPick(x);
  }

  relabel(): void {
    this.input.placeholder = t('search');
    this.input.setAttribute('aria-label', t('search'));
  }
}
