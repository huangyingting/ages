import { BOOKS, UNITS } from '../../shared/data/curriculum.ts';
import { EVENTS } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import { unitLessons } from '../../shared/data/lessons/index.ts';
import type { Book, HistEvent, Lesson } from '../../shared/data/types.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import { load, save, type Progress } from '../lib/storage.ts';
import { h, iconBtn } from './dom.ts';
import { bookShort } from './lesson.ts';

/**
 * 历史课堂 (the course catalogue): book tabs → units; an opened unit offers its lesson(s), its unit test and its
 * textbook events. The unit head shows the events learned and a mark once the lesson is passed.
 */
export class Learn {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private book: Book = load<Book>('book', 'g7a');
  private openUnit = -1;
  onOpen: (e: HistEvent) => void = () => {};
  onLesson: (l: Lesson) => void = () => {};
  onTest: (book: Book, unit: number) => void = () => {};

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
      text: bookShort(b),
      title: tr(BOOKS[b].name, L),
      onclick: () => { this.book = b; this.openUnit = -1; save('book', b); this.render(); },
    })));
    const units = UNITS.filter(u => u.book === this.book).map(u => {
      const evs = EVENTS.filter(e => e.curriculum.some(c => c.book === u.book && c.unit === u.unit)).sort((a, b) => a.year - b.year);
      const done = evs.filter(e => this.progress.learned.has(e.id)).length;
      const open = this.openUnit === u.unit;
      const lessons = unitLessons(u.book, u.unit);
      const passed = lessons.length > 0 && lessons.every(l => { const b = this.progress.scores[l.id]; return b && b[0] / b[1] >= 0.6; });
      return h('li', { class: 'unit' + (open ? ' open' : '') },
        h('button', { type: 'button', class: 'u-head', 'aria-expanded': String(open), onclick: () => { this.openUnit = open ? -1 : u.unit; this.render(); } },
          h('span', { class: 'u-n', text: String(u.unit) }),
          h('span', { class: 'u-t', text: tr(u.title, L) }),
          passed ? h('i', { class: 'u-ok', text: '✓', title: t('learned') }) : null,
          h('span', { class: 'u-p', text: `${done}/${evs.length}` }),
          h('i', { class: 'bar', style: `--p:${evs.length ? done / evs.length : 0}` })),
        open ? h('div', { class: 'u-body' },
          ...lessons.map(l => this.row('u-ls', '▶', tr(l.title, L), `${t('lsMin', { n: l.minutes })} · ${tr(l.blurb, L)}`, this.progress.scores[l.id], () => this.onLesson(l), l.id)),
          lessons.length ? this.row('u-test', '✎', t('lsTest'), t('lsTestDesc'), this.progress.scores[`test:${u.book}-${u.unit}`], () => this.onTest(u.book, u.unit)) : null,
          evs.length ? h('h4', { class: 'u-sub', text: t('lsEvents') }) : null,
          h('ul', { class: 'u-evs' }, ...evs.map(e => h('li', {}, h('button', { type: 'button', onclick: () => this.onOpen(e) },
            h('span', { class: 'y', text: formatYear(e.year, L, { short: true }) }),
            h('span', { class: 't', text: tr(e.title, L) }),
            this.progress.learned.has(e.id) ? h('i', { class: 'ok', text: '✓' }) : this.progress.watched.has(e.id) ? h('i', { class: 'seen', text: '•' }) : null))))) : null);
    });
    this.body.replaceChildren(
      h('header', {}, h('h2', { text: t('learnTitle') }), iconBtn('close', t('close'), () => this.toggle(false))),
      tabs,
      h('ul', { class: 'units' }, ...units));
  }

  /** A lesson or unit-test row: mark, title, a line under it and the best score. */
  private row(cls: string, mark: string, title: string, sub: string, best: [number, number] | undefined, onclick: () => void, id?: string): HTMLElement {
    return h('button', { type: 'button', class: `u-row ${cls}`, 'data-lesson': id, onclick },
      h('i', { class: 'u-mk', text: mark }),
      h('span', { class: 'u-rt' }, h('b', { text: title }), h('small', { text: sub })),
      best ? h('span', { class: 'u-best' + (best[0] / best[1] >= 0.6 ? ' ok' : ''), text: t('lsBest', { s: best[0], n: best[1] }) }) : null);
  }
}
