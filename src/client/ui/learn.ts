import { BOOKS, UNITS } from '../../shared/data/curriculum.ts';
import { EVENTS } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import type { Book, HistEvent } from '../../shared/data/types.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import { load, save, type Progress } from '../lib/storage.ts';
import { h, iconBtn } from './dom.ts';

/** Textbook drawer: books → units → events, with learning progress. */
export class Learn {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private book: Book = load<Book>('book', 'g7a');
  private openUnit = -1;
  onOpen: (e: HistEvent) => void = () => {};

  constructor(private progress: Progress) {
    this.body = h('div', { class: 'dr-body' });
    this.el = h('aside', { class: 'drawer', hidden: true, 'aria-label': t('learnTitle') }, this.body);
  }

  get open(): boolean { return !this.el.hidden; }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; if (on) this.render(); }

  render(): void {
    const L = lang;
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, ...(Object.keys(BOOKS) as Book[]).map(b => h('button', {
      type: 'button', role: 'tab', class: b === this.book ? 'on' : '', 'aria-selected': String(b === this.book),
      text: L === 'zh' ? tr(BOOKS[b].name, L).replace('年级', '').replace('高中《中外历史纲要（上）》', '高中纲要') : b === 'hs1' ? 'HS' : b.replace('g', 'G').replace('a', '·1').replace('b', '·2'),
      title: tr(BOOKS[b].name, L),
      onclick: () => { this.book = b; this.openUnit = -1; save('book', b); this.render(); },
    })));
    const units = UNITS.filter(u => u.book === this.book).map(u => {
      const evs = EVENTS.filter(e => e.curriculum.some(c => c.book === u.book && c.unit === u.unit)).sort((a, b) => a.year - b.year);
      const done = evs.filter(e => this.progress.learned.has(e.id)).length;
      const open = this.openUnit === u.unit;
      return h('li', { class: 'unit' + (open ? ' open' : '') },
        h('button', { type: 'button', class: 'u-head', 'aria-expanded': String(open), onclick: () => { this.openUnit = open ? -1 : u.unit; this.render(); } },
          h('span', { class: 'u-n', text: String(u.unit) }),
          h('span', { class: 'u-t', text: tr(u.title, L) }),
          h('span', { class: 'u-p', text: `${done}/${evs.length}` }),
          h('i', { class: 'bar', style: `--p:${evs.length ? done / evs.length : 0}` })),
        open ? h('ul', { class: 'u-evs' }, ...evs.map(e => h('li', {}, h('button', { type: 'button', onclick: () => this.onOpen(e) },
          h('span', { class: 'y', text: formatYear(e.year, L, { short: true }) }),
          h('span', { class: 't', text: tr(e.title, L) }),
          this.progress.learned.has(e.id) ? h('i', { class: 'ok', text: '✓' }) : this.progress.watched.has(e.id) ? h('i', { class: 'seen', text: '•' }) : null)))) : null);
    });
    this.body.replaceChildren(
      h('header', {}, h('h2', { text: t('learnTitle') }), iconBtn('close', t('close'), () => this.toggle(false))),
      tabs,
      h('ul', { class: 'units' }, ...units));
  }
}
