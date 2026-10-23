import { BOOKS } from '../../shared/data/curriculum.ts';
import { EVENT, EVENTS } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import type { Book } from '../../shared/data/types.ts';
import { distKm, gradeWhere, makeQuiz, type Question } from '../../shared/lib/quiz.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import type { Progress } from '../lib/storage.ts';
import type { Atlas } from '../scene/atlas.ts';
import { h, iconBtn } from './dom.ts';

/** Quiz panel: "when" (multiple choice), "where" (click the map) and "order" (tap in time order) questions. */
export class Quiz {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private qs: Question[] = [];
  private i = 0;
  private score = 0;
  private book: Book | '' = '';
  onClose: () => void = () => {};

  constructor(private atlas: Atlas, private progress: Progress) {
    this.body = h('div', { class: 'qz-body' });
    this.el = h('section', { class: 'quiz', hidden: true, role: 'dialog', 'aria-label': t('quizTitle') }, this.body);
  }

  get open(): boolean { return !this.el.hidden; }

  toggle(on = this.el.hidden): void {
    this.el.hidden = !on;
    if (on) this.setup(); else { this.atlas.setPickMode(null); this.atlas.fx.clear('story'); this.onClose(); }
  }

  private head(extra: string): HTMLElement {
    return h('header', {}, h('h2', { text: t('quizTitle') }), h('span', { class: 'qz-n', text: extra }), iconBtn('close', t('close'), () => this.toggle(false)));
  }

  private setup(): void {
    const sel = h('select', { 'aria-label': t('quizBook') },
      h('option', { value: '', text: t('allBooks') }),
      ...(Object.keys(BOOKS) as Book[]).map(b => h('option', { value: b, text: tr(BOOKS[b].name, lang) })));
    sel.value = this.book;
    sel.addEventListener('change', () => (this.book = sel.value as Book | ''));
    this.body.replaceChildren(
      this.head(this.progress.best ? t('best', { n: this.progress.best }) : ''),
      h('div', { class: 'qz-row' }, h('label', {}, h('span', { text: t('quizBook') + ' ' }), sel),
        h('button', { type: 'button', class: 'btn primary', 'data-act': 'start', text: t('start'), onclick: () => this.start() })));
  }

  start(seed = Date.now()): void {
    this.qs = makeQuiz(EVENTS, { n: 9, seed, book: this.book || undefined });
    this.i = 0;
    this.score = 0;
    this.ask();
  }

  private ask(): void {
    this.atlas.setPickMode(null);
    this.atlas.fx.clear('story');
    const q = this.qs[this.i];
    if (!q) { this.finish(); return; }
    const L = lang;
    const fb = h('p', { class: 'qz-fb', 'aria-live': 'polite' });
    const next = h('button', { type: 'button', class: 'btn primary', 'data-act': 'next', hidden: true, text: t('nextQ'), onclick: () => { this.i++; this.ask(); } });
    const nodes: Node[] = [this.head(`${this.i + 1}/${this.qs.length}`), h('p', { class: 'qz-q', text: tr(q.prompt, L) })];
    const finish = (ok: boolean, msg: string) => {
      if (ok) this.score++;
      fb.textContent = msg;
      fb.className = 'qz-fb ' + (ok ? 'ok' : 'no');
      next.hidden = false;
      next.focus();
    };
    if (q.type === 'when') {
      const e = EVENT.get(q.event)!;
      const opts = h('div', { class: 'qz-opts' }, ...q.options.map(y => h('button', {
        type: 'button', class: 'opt', text: formatYear(y, L),
        onclick: (ev: Event) => {
          if (!next.hidden) return;
          const ok = y === q.answer;
          (ev.currentTarget as HTMLElement).classList.add(ok ? 'ok' : 'no');
          opts.querySelectorAll('button').forEach(b => { if (b.textContent === formatYear(q.answer, L)) b.classList.add('ok'); });
          finish(ok, ok ? t('correct') : t('answerWas', { a: formatYear(q.answer, L) }));
          this.reveal(e.id);
        },
      })));
      nodes.push(opts);
    } else if (q.type === 'where') {
      nodes.push(h('p', { class: 'qz-hint', text: t('clickMap') }));
      this.atlas.home();
      this.atlas.setPickMode((lon, lat) => {
        this.atlas.setPickMode(null);
        const km = Math.round(distKm([lon, lat], [q.lon, q.lat]));
        const g = gradeWhere(km);
        this.atlas.fx.spawn({ lon, lat, model: { kind: 'flag', color: '#2e86de' }, scale: 0.8 });
        this.atlas.fx.ring(this.atlas.geo.pos(q.lon, q.lat, 0.02), g === 'wrong' ? '#ff6b4a' : '#5bd36b', 4);
        finish(g === 'correct', `${t(g === 'correct' ? 'correct' : g === 'close' ? 'close_' : 'wrong')} ${t('kmAway', { n: km })}`);
        this.reveal(q.event);
      });
    } else {
      const picked: string[] = [];
      const list = h('ol', { class: 'qz-order' });
      const check = h('button', { type: 'button', class: 'btn primary', 'data-act': 'check', text: t('check'), disabled: true });
      const btns = q.events.map(id => {
        const e = EVENT.get(id)!;
        const b = h('button', { type: 'button', class: 'opt', 'data-id': id, text: tr(e.title, L), onclick: () => {
          if (picked.includes(id) || !next.hidden) return;
          picked.push(id);
          b.disabled = true;
          list.append(h('li', { text: tr(e.title, L) }));
          check.disabled = picked.length !== q.events.length;
        } });
        return b;
      });
      const undo = h('button', { type: 'button', class: 'btn ghost', text: t('undo'), onclick: () => {
        if (!next.hidden) return;
        const id = picked.pop();
        if (!id) return;
        list.lastElementChild?.remove();
        btns.find(b => b.dataset.id === id)!.disabled = false;
        check.disabled = true;
      } });
      check.addEventListener('click', () => {
        const ok = picked.every((id, k) => id === q.answer[k]);
        list.replaceChildren(...q.answer.map((id, k) => h('li', { class: picked[k] === id ? 'ok' : 'no', text: `${formatYear(EVENT.get(id)!.year, L, { short: true })} · ${tr(EVENT.get(id)!.title, L)}` })));
        check.disabled = true;
        finish(ok, ok ? t('correct') : t('wrong'));
      });
      nodes.push(h('p', { class: 'qz-hint', text: t('orderHint') }), h('div', { class: 'qz-opts col' }, ...btns), list, h('div', { class: 'qz-row' }, undo, check));
    }
    nodes.push(fb, h('div', { class: 'qz-row end' }, next));
    this.body.replaceChildren(...nodes);
  }

  /** Flies to the answer and shows its model briefly. */
  private reveal(id: string): void {
    const e = EVENT.get(id);
    if (!e) return;
    this.atlas.setYear(e.year);
    this.atlas.flyTo({ lon: e.lon, lat: e.lat - 1.5, dist: 30, tilt: 0.85 }, 1.4);
    if (e.model) this.atlas.fx.spawn({ lon: e.lon, lat: e.lat, model: e.model, label: tr(e.title, lang) });
  }

  private finish(): void {
    this.atlas.setPickMode(null);
    this.progress.quiz(this.score);
    this.body.replaceChildren(
      this.head(''),
      h('p', { class: 'qz-done', text: t('done', { s: this.score, n: this.qs.length }) }),
      h('p', { class: 'qz-hint', text: t('best', { n: this.progress.best }) }),
      h('div', { class: 'qz-row' }, h('button', { type: 'button', class: 'btn primary', text: t('again'), onclick: () => this.start() })));
  }

  relabel(): void { if (this.open) this.setup(); }
}
