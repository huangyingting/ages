import { BOOKS, UNITS } from '../../shared/data/curriculum.ts';
import { tr } from '../../shared/data/i18n.ts';
import { LESSONS, unitLessons } from '../../shared/data/lessons/index.ts';
import type { Book, Lesson } from '../../shared/data/types.ts';
import { lang, t } from '../lib/i18n.ts';
import { load, save, type Progress } from '../lib/storage.ts';
import { ModalFocus, h, iconBtn } from './dom.ts';
import { bookShort } from './lesson.ts';

const PASS = 0.6;

/**
 * 历史课堂 — the course picker, a dialog over the map: book tabs, then every unit of the book with its lesson and its
 * unit test. Picking one closes the dialog and starts the lesson scene (the lesson runs in the left column).
 */
export class Learn {
  readonly el: HTMLElement;
  private box: HTMLElement;
  private book: Book = load<Book>('book', 'g7a');
  onLesson: (l: Lesson) => void = () => {};
  onTest: (book: Book, unit: number) => void = () => {};

  constructor(private progress: Progress) {
    this.box = h('div', { class: 'modal-box course' });
    this.el = h('div', { class: 'modal', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('learnTitle'), onclick: (e: Event) => { if (e.target === this.el) this.toggle(false); } }, this.box);
    this.focus = new ModalFocus(this.el);
  }

  get open(): boolean { return !this.el.hidden; }
  readonly focus: ModalFocus;
  toggle(on = this.el.hidden): void {
    if (on === !this.el.hidden) return;
    this.el.hidden = !on;
    if (on) { this.render(); this.focus.opened(); } else this.focus.closed();
  }

  /** Lessons passed, out of all. */
  done(): [number, number] {
    return [LESSONS.filter(l => this.passed(l.id)).length, LESSONS.length];
  }

  private passed(id: string): boolean { const b = this.progress.scores[id]; return !!b && b[0] / b[1] >= PASS; }

  render(): void {
    const L = lang;
    this.el.setAttribute('aria-label', t('learnTitle'));
    const [n, m] = this.done();
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, ...(Object.keys(BOOKS) as Book[]).map(b => h('button', {
      type: 'button', role: 'tab', class: b === this.book ? 'on' : '', 'aria-selected': String(b === this.book), 'data-book': b,
      text: bookShort(b),
      title: tr(BOOKS[b].name, L),
      onclick: () => { this.book = b; save('book', b); this.render(); },
    })));
    const units = UNITS.filter(u => u.book === this.book).map(u => {
      const lessons = unitLessons(u.book, u.unit);
      if (!lessons.length) return null;
      const passed = lessons.every(l => this.passed(l.id));
      return h('li', { class: 'unit' + (passed ? ' done' : '') },
        h('div', { class: 'u-h' },
          h('span', { class: 'u-n', text: String(u.unit).padStart(2, '0') }),
          h('span', { class: 'u-t', text: tr(u.title, L) }),
          passed ? h('i', { class: 'u-ok', text: '✓', title: t('learned') }) : null),
        ...lessons.map(l => this.row('u-ls', '▶', tr(l.title, L), `${t('lsMin', { n: l.minutes })} · ${tr(l.blurb, L)}`, this.progress.scores[l.id], () => this.onLesson(l), l.id)),
        this.row('u-test', '✎', t('lsTest'), t('lsTestDesc'), this.progress.scores[`test:${u.book}-${u.unit}`], () => this.onTest(u.book, u.unit)));
    });
    this.box.replaceChildren(
      h('header', {}, h('h2', { text: t('learnTitle') }), h('span', { class: 'c-done', text: t('lessonsDone', { n, m }) }), iconBtn('close', t('close'), () => this.toggle(false))),
      h('p', { class: 'c-intro', text: t('courseIntro') }),
      tabs,
      h('ul', { class: 'units' }, ...units));
  }

  /** A lesson or unit-test row: mark, title, a line under it and the best score. */
  private row(cls: string, mark: string, title: string, sub: string, best: [number, number] | undefined, onclick: () => void, id?: string): HTMLElement {
    return h('button', { type: 'button', class: `u-row ${cls}`, 'data-lesson': id, onclick },
      h('i', { class: 'u-mk', text: mark }),
      h('span', { class: 'u-rt' }, h('b', { text: title }), h('small', { text: sub })),
      best ? h('span', { class: 'u-best' + (best[0] / best[1] >= PASS ? ' ok' : ''), text: t('lsBest', { s: best[0], n: best[1] }) }) : null);
  }
}
