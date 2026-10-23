import { BOOKS, unitOf } from '../../shared/data/curriculum.ts';
import { ERAS } from '../../shared/data/eras.ts';
import { EVENTS, hasScript } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import { PLACE, placeName } from '../../shared/data/places.ts';
import type { Era, HistEvent, Wiki } from '../../shared/data/types.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { kindName, lang, t } from '../lib/i18n.ts';
import type { Progress } from '../lib/storage.ts';
import { fill, h, icon, iconBtn } from './dom.ts';

export interface CardHooks {
  play(e: HistEvent): void;
  read(wiki: Wiki, title: string): void;
  open(e: HistEvent): void;
  era(id: string): void;
  close(): void;
  learned(e: HistEvent, on: boolean): void;
}

/** The detail card: right-hand panel on desktop, bottom sheet on phones. Shows an event or an era. */
export class Card {
  readonly el: HTMLElement;
  private body: HTMLElement;
  event: HistEvent | null = null;
  era: Era | null = null;

  constructor(private hooks: CardHooks, private progress: Progress) {
    this.body = h('div', { class: 'card-body' });
    this.el = h('aside', { class: 'card', 'aria-live': 'polite', hidden: true }, this.body);
  }

  get open(): boolean { return !this.el.hidden; }

  showEvent(e: HistEvent): void {
    this.event = e;
    this.era = null;
    this.render();
    this.el.hidden = false;
    this.body.scrollTop = 0;
  }

  showEra(era: Era): void {
    this.era = era;
    this.event = null;
    this.render();
    this.el.hidden = false;
    this.body.scrollTop = 0;
  }

  hide(): void {
    this.el.hidden = true;
    this.event = null;
    this.era = null;
  }

  render(): void {
    if (this.event) this.renderEvent(this.event);
    else if (this.era) this.renderEra(this.era);
  }

  private head(chips: Node[], nav: boolean): HTMLElement {
    const list = EVENTS.filter(x => x.scope === 'china');
    const i = this.event ? list.indexOf(this.event) : -1;
    return h('div', { class: 'card-head' },
      h('div', { class: 'chips' }, ...chips),
      h('div', { class: 'card-nav' },
        nav && i > 0 ? iconBtn('prev', t('prev'), () => this.hooks.open(list[i - 1])) : null,
        nav && i >= 0 && i < list.length - 1 ? iconBtn('next', t('next'), () => this.hooks.open(list[i + 1])) : null,
        iconBtn('close', t('close'), () => this.hooks.close(), 'card-x')));
  }

  private renderEvent(e: HistEvent): void {
    const L = lang;
    const place = e.place ? PLACE.get(e.place) : undefined;
    const when = formatYear(e.year, L) + (e.end && e.end !== e.year ? ' – ' + formatYear(e.end, L) : '');
    const learned = this.progress.learned.has(e.id);
    const learnBtn = h('button', { type: 'button', class: 'btn ghost' + (learned ? ' on' : ''), 'aria-pressed': String(learned), title: t('markLearned') }, icon('check'), h('span', { text: t('learned') }));
    learnBtn.addEventListener('click', () => {
      const on = this.progress.toggleLearned(e.id);
      learnBtn.classList.toggle('on', on);
      learnBtn.setAttribute('aria-pressed', String(on));
      this.hooks.learned(e, on);
    });
    const playBtn = h('button', { type: 'button', class: 'btn primary', 'data-act': 'play', onclick: () => this.hooks.play(e) }, icon('play'), h('span', { text: t('playStory') }));
    const wikiBtn = e.wiki ? h('button', { type: 'button', class: 'btn', 'data-act': 'wiki', onclick: () => this.hooks.read(e.wiki!, tr(e.title, L)) }, h('b', { class: 'w', text: 'W' }), h('span', { text: t('read') })) : null;
    const units = e.curriculum.map(c => {
      const u = unitOf(c.book, c.unit);
      return h('li', {}, h('b', { text: tr(BOOKS[c.book].name, L) }), ' ', h('span', { text: u ? tr(u.title, L) : `#${c.unit}` }));
    });
    fill(this.body, 
      this.head([
        h('span', { class: `chip k-${e.kind}`, text: kindName(e.kind) }),
        h('span', { class: 'chip year', text: when }),
        place ? h('span', { class: 'chip place' }, icon('pin'), tr(placeName(place, e.year), L)) : null,
        hasScript(e) ? h('span', { class: 'chip star', title: t('scripted'), text: '★' }) : null,
        this.progress.watched.has(e.id) ? h('span', { class: 'chip seen', text: '✓ ' + t('watched') }) : null,
      ].filter(Boolean) as Node[], true),
      h('h2', { text: tr(e.title, L) }),
      h('p', { class: 'sum', text: tr(e.summary, L) }),
      h('div', { class: 'acts' }, playBtn, wikiBtn, learnBtn),
      e.points.length ? h('section', {}, h('h3', { text: t('keyPoints') }), h('ul', { class: 'points' }, ...e.points.map(p => h('li', { text: tr(p, L) })))) : null,
      e.people?.length ? h('section', {}, h('h3', { text: t('people') }), h('div', { class: 'people' }, ...e.people.map(p => h('span', { class: 'chip', text: tr(p, L) })))) : null,
      units.length ? h('section', {}, h('h3', { text: t('textbook') }), h('ul', { class: 'units' }, ...units)) : null,
    );
  }

  private renderEra(era: Era): void {
    const L = lang;
    const evs = EVENTS.filter(e => e.scope === era.scope && e.year >= era.start && e.year <= era.end && e.weight <= 2);
    const cap = era.capital ? PLACE.get(era.capital) : undefined;
    const i = ERAS.indexOf(era);
    fill(this.body, 
      h('div', { class: 'card-head' },
        h('div', { class: 'chips' },
          h('span', { class: 'chip era', style: `--c:${era.color}`, text: t('era') }),
          h('span', { class: 'chip year', text: `${formatYear(era.start, L)} – ${formatYear(era.end, L)}` }),
          cap ? h('span', { class: 'chip place' }, icon('pin'), '★ ' + tr(placeName(cap, era.start), L)) : null),
        h('div', { class: 'card-nav' },
          i > 0 ? iconBtn('prev', t('prev'), () => this.hooks.era(ERAS[i - 1].id)) : null,
          i < ERAS.length - 1 ? iconBtn('next', t('next'), () => this.hooks.era(ERAS[i + 1].id)) : null,
          iconBtn('close', t('close'), () => this.hooks.close(), 'card-x'))),
      h('h2', { text: tr(era.name, L) }),
      h('p', { class: 'sum', text: tr(era.summary, L) }),
      era.wiki ? h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn', 'data-act': 'wiki', onclick: () => this.hooks.read(era.wiki!, tr(era.name, L)) }, h('b', { class: 'w', text: 'W' }), h('span', { text: t('read') }))) : null,
      evs.length ? h('section', {}, h('h3', { text: t('events') }), h('ul', { class: 'evlist' }, ...evs.map(e => h('li', {},
        h('button', { type: 'button', onclick: () => this.hooks.open(e) },
          h('span', { class: 'y', text: formatYear(e.year, L, { short: true }) }),
          h('span', { text: tr(e.title, L) }),
          this.progress.learned.has(e.id) ? h('i', { class: 'ok', text: '✓' }) : null))))) : null,
    );
  }
}
