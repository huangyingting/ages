import { BOOKS, unitOf } from '../../shared/data/curriculum.ts';
import { ERAS } from '../../shared/data/eras.ts';
import { EVENTS, hasScript } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import { JOURNEYS, PEOPLE, dynastyOfEra, personNamed, type Journey, type Person } from '../../shared/data/jiangshan.ts';
import { PLACE, isCapital, placeName } from '../../shared/data/places.ts';
import type { Era, HistEvent, I18n, Place, Wiki, Year } from '../../shared/data/types.ts';
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
  journey(j: Journey): void;
  person(p: Person): void;
  fly(lon: number, lat: number): void;
}

/** The detail card: right-hand panel on desktop, bottom sheet on phones. Shows an event or an era. */
export class Card {
  readonly el: HTMLElement;
  private body: HTMLElement;
  event: HistEvent | null = null;
  era: Era | null = null;
  place: { p: Place; year: Year } | null = null;
  person: Person | null = null;

  constructor(private hooks: CardHooks, private progress: Progress) {
    this.body = h('div', { class: 'card-body' });
    this.el = h('aside', { class: 'card', 'aria-live': 'polite', hidden: true }, this.body);
  }

  get open(): boolean { return !this.el.hidden; }

  private set(o: { event?: HistEvent; era?: Era; place?: { p: Place; year: Year }; person?: Person }): void {
    this.event = o.event ?? null;
    this.era = o.era ?? null;
    this.place = o.place ?? null;
    this.person = o.person ?? null;
    this.render();
    this.el.hidden = false;
    this.body.scrollTop = 0;
  }
  showEvent(e: HistEvent): void { this.set({ event: e }); }
  showEra(era: Era): void { this.set({ era }); }
  /** A settlement, pass or site: its names through the ages, capital years, lore, records and nearby events. */
  showPlace(p: Place, year: Year): void { this.set({ place: { p, year } }); }
  showPerson(p: Person): void { this.set({ person: p }); }

  hide(): void {
    this.el.hidden = true;
    this.event = this.era = this.place = this.person = null;
  }

  render(): void {
    if (this.event) this.renderEvent(this.event);
    else if (this.era) this.renderEra(this.era);
    else if (this.place) this.renderPlace(this.place.p, this.place.year);
    else if (this.person) this.renderPerson(this.person);
  }

  private plain(chips: (Node | null)[]): HTMLElement {
    return h('div', { class: 'card-head' }, h('div', { class: 'chips' }, ...chips.filter(Boolean) as Node[]),
      h('div', { class: 'card-nav' }, iconBtn('close', t('close'), () => this.hooks.close(), 'card-x')));
  }
  private wikiBtn(w: Wiki, title: string): HTMLElement {
    return h('button', { type: 'button', class: 'btn', 'data-act': 'wiki', onclick: () => this.hooks.read(w, title) }, h('b', { class: 'w', text: 'W' }), h('span', { text: t('read') }));
  }
  private evList(evs: HistEvent[]): HTMLElement {
    return h('ul', { class: 'evlist' }, ...evs.map(e => h('li', {},
      h('button', { type: 'button', onclick: () => this.hooks.open(e) },
        h('span', { class: 'y', text: formatYear(e.year, lang, { short: true }) }),
        h('span', { text: tr(e.title, lang) }),
        this.progress.learned.has(e.id) ? h('i', { class: 'ok', text: '✓' }) : null))));
  }
  private span(a: Year, b: Year): string {
    return a === b ? formatYear(a, lang, { short: true }) : `${formatYear(a, lang, { short: true })} – ${b >= 2100 ? '' : formatYear(b, lang, { short: true })}`;
  }
  private personChip(n: I18n): HTMLElement {
    const p = personNamed(n.zh);
    return p
      ? h('button', { type: 'button', class: 'chip link', title: tr(p.title, lang), onclick: () => this.hooks.person(p) }, tr(n, lang))
      : h('span', { class: 'chip', text: tr(n, lang) });
  }

  private renderPlace(p: Place, year: Year): void {
    const L = lang;
    const now = placeName(p, year);
    const names: { from: Year; to: Year; name: I18n }[] = [];
    for (const n of [...(p.names ?? []), ...(p.periods ?? [])].sort((a, b) => a.from - b.from)) {
      const same = names.find(m => m.name.zh === n.name.zh && n.from <= m.to + 1);
      if (same) same.to = Math.max(same.to, n.to); else names.push({ ...n });
    }
    const notes = [...(p.notes ?? [])].sort((a, b) => a.from - b.from);
    const d2 = (e: { lon: number; lat: number }) => (e.lon - p.lon) ** 2 + (e.lat - p.lat) ** 2;
    const evs = EVENTS.filter(e => e.scope === p.scope && (e.place === p.id || d2(e) < 0.6 ** 2)).sort((a, b) => a.year - b.year).slice(0, 14);
    const modern = p.modern && p.modern.zh !== now.zh ? p.modern : now.zh !== p.name.zh ? p.name : undefined;
    const wikiName = p.modern?.zh ? p.modern : p.name;
    fill(this.body,
      this.plain([
        h('span', { class: 'chip', text: t(p.kind === 'pass' ? 'pass' : 'place') }),
        isCapital(p, year) ? h('span', { class: 'chip star', text: '★ ' + t('capitalNow') }) : null,
        h('span', { class: 'chip year', text: formatYear(year, L) }),
      ]),
      h('h2', { text: tr(now, L) }),
      modern ? h('p', { class: 'sub', text: `${t('today')} ${tr(modern, L)}` }) : null,
      p.lore ? h('p', { class: 'sum' }, h('b', { text: tr(p.lore.tag, L) + ' · ' }), tr(p.lore.desc, L)) : null,
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.hooks.fly(p.lon, p.lat) }, icon('pin'), h('span', { text: t('map') })),
        this.wikiBtn({ zh: wikiName.zh, en: wikiName.en }, tr(wikiName, L))),
      names.length > 1 || (names.length === 1 && names[0].name.zh !== now.zh) ? h('section', {}, h('h3', { text: t('namesThrough') }), h('ul', { class: 'periods' },
        ...names.map(n => h('li', { class: year >= n.from && year <= n.to ? 'cur' : '' }, h('span', { class: 'y', text: this.span(n.from, n.to) }), h('b', { text: tr(n.name, L) }))))) : null,
      p.capital?.length ? h('section', {}, h('h3', { text: t('asCapital') }), h('p', { class: 'caps', text: p.capital.map(([a, b]) => this.span(a, b)).join('；') })) : null,
      notes.length ? h('section', {}, h('h3', { text: t('notes') }), h('ul', { class: 'periods' },
        ...notes.map(n => h('li', {}, h('span', { class: 'y', text: this.span(n.from, n.to) }), h('span', { text: tr(n.text, L) }))))) : null,
      evs.length ? h('section', {}, h('h3', { text: t('nearby') }), this.evList(evs)) : null,
    );
  }

  private renderPerson(p: Person): void {
    const L = lang;
    const evs = EVENTS.filter(e => e.people?.some(n => n.zh === p.name.zh) || p.tokens.some(tk => tk.length > 1 && e.title.zh.includes(tk)))
      .sort((a, b) => a.year - b.year).slice(0, 16);
    const j = JOURNEYS.find(x => x.id === p.id);
    const era = ERAS.find(e => e.scope === 'china' && dynastyOfEra(e.name.zh)?.id === p.dyn);
    fill(this.body,
      this.plain([
        h('span', { class: 'chip', text: t('person') }),
        h('span', { class: 'chip year', text: `${formatYear(p.span[0], L, { short: true })} – ${formatYear(p.span[1], L, { short: true })}` }),
        era ? h('button', { type: 'button', class: 'chip era link', style: `--c:${era.color}`, onclick: () => this.hooks.era(era.id) }, tr(era.name, L)) : null,
      ]),
      h('h2', { text: tr(p.name, L) }),
      h('p', { class: 'sub', text: tr(p.title, L) }),
      p.aliases.length && L === 'zh' ? h('p', { class: 'sum', text: '又称 ' + p.aliases.join('、') }) : null,
      h('div', { class: 'acts' },
        j ? h('button', { type: 'button', class: 'btn primary', 'data-act': 'journey', onclick: () => this.hooks.journey(j) }, icon('play'), h('span', { text: tr(j.title, L) })) : null,
        this.wikiBtn({ zh: p.name.zh, en: p.name.en }, tr(p.name, L))),
      evs.length ? h('section', {}, h('h3', { text: t('events') }), this.evList(evs)) : null,
    );
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
      e.people?.length ? h('section', {}, h('h3', { text: t('people') }), h('div', { class: 'people' }, ...e.people.map(p => this.personChip(p)))) : null,
      units.length ? h('section', {}, h('h3', { text: t('textbook') }), h('ul', { class: 'units' }, ...units)) : null,
    );
  }

  private renderEra(era: Era): void {
    const L = lang;
    const evs = EVENTS.filter(e => e.scope === era.scope && e.year >= era.start && e.year <= era.end && e.weight <= 2);
    const cap = era.capital ? PLACE.get(era.capital) : undefined;
    const i = ERAS.indexOf(era);
    const dy = dynastyOfEra(era.name.zh);
    const figures = dy ? PEOPLE.filter(p => p.dyn === dy.id) : [];
    fill(this.body, 
      h('div', { class: 'card-head' },
        h('div', { class: 'chips' },
          h('span', { class: 'chip era', style: `--c:${era.color}`, text: t('era') }),
          h('span', { class: 'chip year', text: `${formatYear(era.start, L)} – ${formatYear(era.end, L)}` }),
          cap ? h('span', { class: 'chip place' }, icon('pin'), '★ ' + tr(placeName(cap, era.start), L)) : dy?.seat.zh ? h('span', { class: 'chip place' }, icon('pin'), '★ ' + tr(dy.seat, L)) : null),
        h('div', { class: 'card-nav' },
          i > 0 ? iconBtn('prev', t('prev'), () => this.hooks.era(ERAS[i - 1].id)) : null,
          i < ERAS.length - 1 ? iconBtn('next', t('next'), () => this.hooks.era(ERAS[i + 1].id)) : null,
          iconBtn('close', t('close'), () => this.hooks.close(), 'card-x'))),
      h('h2', { text: tr(era.name, L) }),
      h('p', { class: 'sum', text: tr(era.summary, L) }),
      era.wiki ? h('div', { class: 'acts' }, this.wikiBtn(era.wiki, tr(era.name, L))) : null,
      dy?.summary.zh ? h('section', {}, h('h3', { text: t('overview') }), h('p', { class: 'sum', text: tr(dy.summary, L) }),
        dy.seat.zh ? h('p', { class: 'caps', text: `${t('seat')}${L === 'zh' ? '：' : ': '}${tr(dy.seat, L)}` }) : null) : null,
      figures.length ? h('section', {}, h('h3', { text: t('figures') }), h('div', { class: 'people' }, ...figures.map(p => this.personChip(p.name)))) : null,
      evs.length ? h('section', {}, h('h3', { text: t('events') }), this.evList(evs)) : null,
    );
  }
}
