import { BOOKS, unitOf } from '../../shared/data/curriculum.ts';
import { ERAS } from '../../shared/data/eras.ts';
import { EVENTS, hasScript } from '../../shared/data/events.ts';
import { tr } from '../../shared/data/i18n.ts';
import { JOURNEYS, PEOPLE, dynastyOfEra, personNamed, type Journey, type Person } from '../../shared/data/jiangshan.ts';
import { PLACE, isCapital, placeName } from '../../shared/data/places.ts';
import type { Era, EventKind, HistEvent, I18n, ModelRecipe, Place, Wiki, Year } from '../../shared/data/types.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { kindName, lang, t } from '../lib/i18n.ts';
import type { Progress } from '../lib/storage.ts';
import { fill, h, icon, iconBtn } from './dom.ts';
import { Preview } from './preview.ts';
import { personModel, placeModel } from '../../shared/data/heroes.ts';

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

/** A generic model for events without their own recipe. */
const KIND_MODEL: Record<EventKind, ModelRecipe> = {
  prehistory: { kind: 'hut' }, politics: { kind: 'palace' }, war: { kind: 'army' }, reform: { kind: 'ding' }, culture: { kind: 'scroll' },
  science: { kind: 'compass' }, economy: { kind: 'junk' }, diplomacy: { kind: 'camel' }, revolution: { kind: 'flag' },
};

/**
 * The info panel: a turntable 3D model of the subject on top, then a location line, the title, a stats grid, the main
 * actions and collapsible sections. Left-hand panel on desktop, bottom sheet on phones. Shows an event, an era, a place
 * or a person.
 */
export class Card {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private hero: HTMLElement;
  private heroTag: HTMLElement;
  private nav: HTMLElement;
  private preview: Preview;
  event: HistEvent | null = null;
  era: Era | null = null;
  place: { p: Place; year: Year } | null = null;
  person: Person | null = null;

  constructor(private hooks: CardHooks, private progress: Progress, still = false) {
    this.preview = new Preview(still);
    this.preview.canvas.title = t('dragTurn');
    this.heroTag = h('div', { class: 'hero-tag' });
    this.nav = h('div', { class: 'card-nav' });
    this.hero = h('div', { class: 'info-hero' }, this.preview.canvas, this.heroTag, this.nav);
    this.body = h('div', { class: 'card-body' });
    this.el = h('aside', { class: 'card', 'aria-live': 'polite', hidden: true }, this.hero, this.body);
  }

  get open(): boolean { return !this.el.hidden; }

  /** Pauses the turntable while a story owns the screen. */
  setActive(on: boolean): void { this.preview.active = on && this.open && !this.el.classList.contains('mini'); }

  private set(o: { event?: HistEvent; era?: Era; place?: { p: Place; year: Year }; person?: Person }): void {
    this.event = o.event ?? null;
    this.era = o.era ?? null;
    this.place = o.place ?? null;
    this.person = o.person ?? null;
    this.el.hidden = false;
    this.render();
    this.body.scrollTop = 0;
    this.setActive(true);
  }
  showEvent(e: HistEvent): void { this.set({ event: e }); }
  showEra(era: Era): void { this.set({ era }); }
  /** A settlement, pass or site: its names through the ages, capital years, lore, records and nearby events. */
  showPlace(p: Place, year: Year): void { this.set({ place: { p, year } }); }
  showPerson(p: Person): void { this.set({ person: p }); }

  hide(): void {
    this.el.hidden = true;
    this.preview.active = false;
    this.event = this.era = this.place = this.person = null;
  }

  render(): void {
    if (this.event) this.renderEvent(this.event);
    else if (this.era) this.renderEra(this.era);
    else if (this.place) this.renderPlace(this.place.p, this.place.year);
    else if (this.person) this.renderPerson(this.person);
  }

  // ------------------------------------------------------------ building blocks

  /** The hero strip: model, type tag with catalogue index, and prev / next / minimise / close. */
  private setHero(model: ModelRecipe | null, tag: string, color: string, idx: [number, number] | null, prev?: () => void, next?: () => void): void {
    void this.preview.show(model);
    fill(this.heroTag,
      h('span', { class: 'type-chip', style: `--k:${color}`, text: tag }),
      idx ? h('span', { class: 'cat-idx' }, String(idx[0]), h('small', { text: ` / ${idx[1]}` })) : null);
    const mini = this.el.classList.contains('mini');
    fill(this.nav,
      prev ? iconBtn('prev', t('prev'), prev) : null,
      next ? iconBtn('next', t('next'), next) : null,
      iconBtn(mini ? 'down' : 'minus', t('min'), () => { this.el.classList.toggle('mini'); this.setActive(true); this.render(); }, 'card-min'),
      iconBtn('close', t('close'), () => this.hooks.close(), 'card-x'));
  }
  private eyebrow(...parts: (string | Node | null | undefined)[]): HTMLElement {
    const kids = parts.filter(Boolean) as (string | Node)[];
    return h('div', { class: 'eyebrow' }, icon('pin'), ...kids.flatMap((k, i) => (i ? [h('i', { text: '·' }), k] : [k])));
  }
  private stats(...cells: ([string, string | Node] | null)[]): HTMLElement {
    return h('dl', { class: 'stats' }, ...(cells.filter(Boolean) as [string, string | Node][]).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', {}, v))));
  }
  private sec(title: string, open: boolean, ...kids: (Node | null)[]): HTMLElement {
    const d = h('details', { class: 'sec' }, h('summary', {}, h('span', { text: title })), ...(kids.filter(Boolean) as Node[]));
    d.open = open;
    return d;
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
  private eraLink(era: Era): HTMLElement {
    return h('button', { type: 'button', class: 'era-link', style: `--c:${era.color}`, onclick: () => this.hooks.era(era.id) }, h('i'), tr(era.name, lang));
  }
  /** Title block; in the minimised state it is all that shows under the hero. */
  private title(eyebrow: HTMLElement | null, title: string, sub?: string | null, badges: (Node | null)[] = []): HTMLElement {
    return h('div', { class: 'ttl' }, eyebrow, h('h2', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null,
      badges.some(Boolean) ? h('div', { class: 'badges' }, ...(badges.filter(Boolean) as Node[])) : null);
  }

  // ------------------------------------------------------------ views

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
    const capYears = (p.capital ?? []).reduce((s, [a, b]) => s + Math.max(1, Math.min(b, 1949) - a), 0);
    this.setHero(placeModel(p), t(p.kind === 'pass' ? 'pass' : 'place'), '#c9a45c', null);
    const showNames = names.length > 1 || (names.length === 1 && names[0].name.zh !== now.zh);
    fill(this.body,
      this.title(this.eyebrow(modern ? `${t('today')} ${tr(modern, L)}` : tr(now, L)), tr(now, L), null,
        [isCapital(p, year) ? h('span', { class: 'badge star', text: '★ ' + t('capitalNow') }) : null]),
      p.lore ? h('p', { class: 'sum' }, h('b', { text: tr(p.lore.tag, L) + ' · ' }), tr(p.lore.desc, L)) : null,
      this.stats([t('when'), formatYear(year, L)], capYears ? [t('asCapital'), t('years', { n: capYears })] : [t('eventsN'), String(evs.length)]),
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.hooks.fly(p.lon, p.lat) }, icon('pin'), h('span', { text: t('map') })),
        this.wikiBtn({ zh: wikiName.zh, en: wikiName.en }, tr(wikiName, L))),
      showNames ? this.sec(t('namesThrough'), true, h('ul', { class: 'periods' },
        ...names.map(n => h('li', { class: year >= n.from && year <= n.to ? 'cur' : '' }, h('span', { class: 'y', text: this.span(n.from, n.to) }), h('b', { text: tr(n.name, L) }))))) : null,
      p.capital?.length ? this.sec(t('asCapital'), !showNames, h('p', { class: 'caps', text: p.capital.map(([a, b]) => this.span(a, b)).join('；') })) : null,
      notes.length ? this.sec(t('notes'), false, h('ul', { class: 'periods' },
        ...notes.map(n => h('li', {}, h('span', { class: 'y', text: this.span(n.from, n.to) }), h('span', { text: tr(n.text, L) }))))) : null,
      evs.length ? this.sec(t('nearby'), false, this.evList(evs)) : null,
    );
  }

  private renderPerson(p: Person): void {
    const L = lang;
    const evs = EVENTS.filter(e => e.people?.some(n => n.zh === p.name.zh) || p.tokens.some(tk => tk.length > 1 && e.title.zh.includes(tk)))
      .sort((a, b) => a.year - b.year).slice(0, 16);
    const j = JOURNEYS.find(x => x.id === p.id);
    const era = ERAS.find(e => e.scope === 'china' && dynastyOfEra(e.name.zh)?.id === p.dyn);
    const i = PEOPLE.indexOf(p);
    this.setHero(personModel(p), t('person'), '#b8322a', i >= 0 ? [i + 1, PEOPLE.length] : null);
    fill(this.body,
      this.title(era ? this.eyebrow(tr(era.name, L)) : null, tr(p.name, L), tr(p.title, L)),
      p.aliases.length && L === 'zh' ? h('p', { class: 'sum', text: '又称 ' + p.aliases.join('、') }) : null,
      this.stats([t('lifespan'), `${formatYear(p.span[0], L, { short: true })} – ${formatYear(p.span[1], L, { short: true })}`], era ? [t('dynasty'), this.eraLink(era)] : null),
      h('div', { class: 'acts' },
        j ? h('button', { type: 'button', class: 'btn primary', 'data-act': 'journey', onclick: () => this.hooks.journey(j) }, icon('play'), h('span', { text: tr(j.title, L) })) : null,
        this.wikiBtn({ zh: p.name.zh, en: p.name.en }, tr(p.name, L))),
      evs.length ? this.sec(t('events'), true, this.evList(evs)) : null,
    );
  }

  private renderEvent(e: HistEvent): void {
    const L = lang;
    const list = EVENTS.filter(x => x.scope === 'china');
    const i = list.indexOf(e);
    const place = e.place ? PLACE.get(e.place) : undefined;
    const era = ERAS.find(x => x.scope === e.scope && e.year >= x.start && e.year <= x.end && !x.lane) ?? ERAS.find(x => x.scope === e.scope && e.year >= x.start && e.year <= x.end);
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
    const units = e.curriculum.map(c => {
      const u = unitOf(c.book, c.unit);
      return h('li', {}, h('b', { text: tr(BOOKS[c.book].name, L) }), ' ', h('span', { text: u ? tr(u.title, L) : `#${c.unit}` }));
    });
    this.setHero(e.model ?? KIND_MODEL[e.kind], kindName(e.kind), `var(--k-${e.kind})`, i >= 0 ? [i + 1, list.length] : null,
      i > 0 ? () => this.hooks.open(list[i - 1]) : undefined, i >= 0 && i < list.length - 1 ? () => this.hooks.open(list[i + 1]) : undefined);
    fill(this.body,
      this.title(h('div', { class: 'eyebrow' }, h('b', { class: 'ey-y', text: when }),
        place ? h('i', { text: '·' }) : null, place ? h('span', { class: 'ey-p' }, icon('pin'), tr(placeName(place, e.year), L)) : null,
        era ? h('i', { text: '·' }) : null, era ? this.eraLink(era) : null), tr(e.title, L), null, [
        hasScript(e) ? h('span', { class: 'badge star', title: t('scripted'), text: '★ ' + t('scripted') }) : null,
        this.progress.watched.has(e.id) ? h('span', { class: 'badge seen', text: '✓ ' + t('watched') }) : null,
      ]),
      h('p', { class: 'sum', text: tr(e.summary, L) }),
      h('div', { class: 'acts' }, playBtn, e.wiki ? this.wikiBtn(e.wiki, tr(e.title, L)) : null, learnBtn),
      e.points.length ? this.sec(t('keyPoints'), true, h('ul', { class: 'points' }, ...e.points.map(p => h('li', { text: tr(p, L) })))) : null,
      e.people?.length ? this.sec(t('people'), false, h('div', { class: 'people' }, ...e.people.map(p => this.personChip(p)))) : null,
      units.length ? this.sec(t('textbook'), false, h('ul', { class: 'units' }, ...units)) : null,
    );
  }

  private renderEra(era: Era): void {
    const L = lang;
    const evs = EVENTS.filter(e => e.scope === era.scope && e.year >= era.start && e.year <= era.end && e.weight <= 2);
    const cap = era.capital ? PLACE.get(era.capital) : undefined;
    const i = ERAS.indexOf(era);
    const dy = dynastyOfEra(era.name.zh);
    const figures = dy ? PEOPLE.filter(p => p.dyn === dy.id) : [];
    const seat = cap ? tr(placeName(cap, era.start), L) : dy?.seat.zh ? tr(dy.seat, L) : '';
    const model: ModelRecipe = cap ? placeModel(cap) : era.start < -2000 ? { kind: 'hut' } : { kind: 'palace' };
    this.setHero(model, t('era'), era.color, [i + 1, ERAS.length],
      i > 0 ? () => this.hooks.era(ERAS[i - 1].id) : undefined, i < ERAS.length - 1 ? () => this.hooks.era(ERAS[i + 1].id) : undefined);
    fill(this.body,
      this.title(seat ? this.eyebrow('★ ' + seat) : null, tr(era.name, L)),
      h('p', { class: 'sum', text: tr(era.summary, L) }),
      this.stats([t('when'), `${formatYear(era.start, L, { short: true })} – ${formatYear(era.end, L, { short: true })}`], era.start > -5000 ? [t('duration'), t('years', { n: Math.max(1, era.end - era.start) })] : null),
      era.wiki ? h('div', { class: 'acts' }, this.wikiBtn(era.wiki, tr(era.name, L))) : null,
      dy?.summary.zh ? this.sec(t('overview'), true, h('p', { class: 'sum', text: tr(dy.summary, L) }),
        dy.seat.zh ? h('p', { class: 'caps', text: `${t('seat')}${L === 'zh' ? '：' : ': '}${tr(dy.seat, L)}` }) : null) : null,
      figures.length ? this.sec(t('figures'), !dy?.summary.zh, h('div', { class: 'people' }, ...figures.map(p => this.personChip(p.name)))) : null,
      evs.length ? this.sec(t('events'), false, this.evList(evs)) : null,
    );
  }
}
