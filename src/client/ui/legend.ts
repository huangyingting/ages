import { formatArea, polityArea, realmArea, snapPolities } from '../../shared/data/areas.ts';
import { tr } from '../../shared/data/i18n.ts';
import { WORKS } from '../../shared/data/jiangshan.ts';
import { PLACE, mapName } from '../../shared/data/places.ts';
import { POLITY } from '../../shared/data/polities.ts';
import { SNAPSHOTS } from '../../shared/data/territories.ts';
import type { Polity, Snapshot, Year } from '../../shared/data/types.ts';
import { phaseAt, type Phase } from '../../shared/lib/chronicle.ts';
import { periodQuestion } from '../../shared/lib/quiz.ts';
import { eraAt, formatYear } from '../../shared/lib/timeline.ts';
import { lang, t, type Key } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { fill, h, iconBtn, setIcon } from './dom.ts';

const ROLE_ORDER: Polity['role'][] = ['main', 'rival', 'occupied', 'protectorate', 'neighbor'];
const WORK_COLOR: Record<string, string> = { wall: '#a8916a', canal: '#2f7fc4', road: '#8a5a2b', sea: '#1f5f8b' };
const WORK_KEY: Record<string, Key> = { wall: 'wkWall', canal: 'wkCanal', road: 'wkRoad', sea: 'wkSea' };

/**
 * The map legend, embedded in the chronicle panel under the dynasty header: 疆域 · phase i/N with dots to step between
 * the territorial phases of the dynasty, the phase title and note, the polities on the map (hover holds a highlight,
 * click frames the polity), the period facts (capital, area, polities side by side), the line keys, the border
 * disclaimer and a one-question check per phase (随堂检测). Folds to its one-line header.
 */
export class Legend {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private headEl: HTMLElement;
  private foldBtn: HTMLButtonElement;
  private key = '';
  private year: Year = 0;
  onYear: (y: Year) => void = () => {};
  onHold: (polity: string | null, color?: string) => void = () => {};
  onPolity: (polity: string) => void = () => {};

  constructor() {
    this.headEl = h('div', { class: 'lg-head' });
    this.body = h('div', { class: 'lg-body' });
    this.foldBtn = iconBtn('down', t('fold'), () => this.fold(!this.folded), 'lg-fold');
    this.headEl.addEventListener('click', () => this.fold(!this.folded));
    this.el = h('section', { class: 'legend-card', 'aria-label': t('legend') }, h('header', {}, this.headEl, this.foldBtn), this.body);
    this.fold(load<boolean>('lgFolded', matchMedia('(max-width: 720px)').matches), false);
  }

  get folded(): boolean { return this.el.classList.contains('folded'); }

  fold(on: boolean, persist = true): void {
    this.el.classList.toggle('folded', on);
    setIcon(this.foldBtn, on ? 'up' : 'down');
    this.foldBtn.title = this.foldBtn.ariaLabel = t(on ? 'unfold' : 'fold');
    if (persist) save('lgFolded', on);
  }

  setYear(y: Year): void {
    this.year = y;
    const ph = phaseAt(y);
    const works = WORKS.filter(w => y >= w.span[0] && y <= w.span[1]).map(w => w.kind);
    const key = `${ph?.snap.id}|${ph?.snap.regions.length}|${[...new Set(works)].join()}|${lang}`;
    this.el.hidden = !ph;
    if (!ph || key === this.key) return;
    this.key = key;
    this.render(ph, [...new Set(works)]);
  }

  private render(ph: Phase, works: string[]): void {
    const L = lang;
    const s = ph.snap;
    const span = `${formatYear(ph.from, L, { short: true })} – ${formatYear(ph.to, L, { short: true })}`;
    fill(this.headEl, h('b', { text: t('territory') }),
      ph.group.length > 1 ? h('span', { class: 'lg-ph', text: t('phase', { i: ph.index + 1, n: ph.group.length }) }) : null,
      h('small', { text: span }));
    const dots = ph.group.length > 1 ? h('div', { class: 'lg-dots', role: 'tablist' }, ...ph.group.map((g, i) => h('button', {
      type: 'button', role: 'tab', class: g === s ? 'on' : '', 'aria-selected': String(g === s), title: tr(g.title, L),
      'aria-label': `${t('phase', { i: i + 1, n: ph.group.length })} ${tr(g.title, L)}`, onclick: () => this.onYear(g.year),
    }))) : null;
    // each polity's area, for those drawn as one polity (not the collapsed neighbours or a polity split into named parts)
    const list = this.polities(s);
    const area = (id: string) => {
      const k = id && list.filter(p => p.id === id).length === 1 ? polityArea(s.id, id) : 0;
      return k ? h('small', { text: formatArea(k, L, true) }) : null;
    };
    const pols = list.map(({ id, color: c, role, name: n }) => {
      const b = h('button', { type: 'button', class: `lg-pol r-${role}`, style: `--c:${c}`, 'data-polity': id, onclick: () => this.onPolity(id) },
        h('i'), h('span', { text: n }), area(id));
      b.addEventListener('pointerenter', () => this.onHold(id));
      b.addEventListener('pointerleave', () => this.onHold(null));
      b.addEventListener('focus', () => this.onHold(id));
      b.addEventListener('blur', () => this.onHold(null));
      return b;
    });
    const keys = h('div', { class: 'lg-keys' },
      h('span', { class: 'lg-k ghost' }, h('i'), h('span', { text: t('roleGhost') })),
      ...works.map(k => h('span', { class: `lg-k line k-${k}`, style: `--c:${WORK_COLOR[k] ?? '#888'}` }, h('i'), h('span', { text: t(WORK_KEY[k] ?? 'works') }))));
    fill(this.body,
      dots,
      h('p', { class: 'lg-title', text: tr(s.title, L) }),
      this.facts(s),
      pols.length ? h('div', { class: 'lg-pols' }, ...pols) : null,
      s.note ? h('p', { class: 'lg-note', text: tr(s.note, L), title: t('unfold'), onclick: (ev: Event) => (ev.currentTarget as HTMLElement).classList.toggle('open') }) : null,
      keys,
      h('p', { class: 'lg-disc', text: t('disclaimer') }),
      this.check(s));
  }

  /** 都城 · 面积 · 并立 N 个政权 of the phase. */
  private facts(s: Snapshot): HTMLElement | null {
    const era = eraAt(s.year);
    const cap = era?.capital ? PLACE.get(era.capital) : undefined;
    const capName = cap ? mapName(cap, s.year) ?? cap.name : null;
    const area = realmArea(s.id);
    const n = snapPolities(s.id).length;
    const item = (k: string, v: string) => h('span', {}, h('small', { text: k }), h('b', { text: v }));
    const parts = [
      capName ? item(t('capitalNow'), tr(capName, lang)) : null,
      area ? item(t('lgArea'), formatArea(area, lang, true) + (lang === 'zh' ? '平方千米' : ' km²')) : null,
      n > 1 ? h('span', { text: t('lgCoexist', { n }) }) : null,
    ].filter(x => !!x);
    return parts.length ? h('p', { class: 'lg-facts' }, ...parts) : null;
  }

  /** 随堂检测: one question for the phase; the answer is kept, so the result stays shown when coming back. */
  private check(s: Snapshot): HTMLElement | null {
    const q = periodQuestion(s);
    if (!q) return null;
    const answers = load<Record<string, number>>('periodQuiz', {});
    const pick = answers[s.id];
    const done = pick != null;
    const all = Object.entries(answers);
    const right = all.filter(([id, a]) => SNAPSHOTS.some(x => x.id === id && periodQuestion(x)?.answer === a)).length;
    const opts = q.options.map((o, i) => h('button', {
      type: 'button',
      class: `pq-opt${done ? (i === q.answer ? ' ok' : i === pick ? ' bad' : ' dim') : ''}`,
      disabled: done,
      onclick: () => {
        save('periodQuiz', { ...load<Record<string, number>>('periodQuiz', {}), [s.id]: i });
        this.rerender();
      },
    }, h('i', { text: 'ABCD'[i] }), h('span', { text: tr(o, lang) })));
    const next = SNAPSHOTS[SNAPSHOTS.indexOf(s) + 1];
    const box = h('details', { class: 'lg-quiz' },
      h('summary', {}, h('b', { text: t('pqTitle') }), h('small', { text: t('pqProgress', { a: all.length, n: SNAPSHOTS.length, c: right }) })),
      h('p', { class: 'pq-q', text: tr(q.prompt, lang) }),
      h('div', { class: 'pq-opts' }, ...opts),
      done ? h('p', { class: `pq-res ${pick === q.answer ? 'ok' : 'bad'}` }, h('b', { text: t(pick === q.answer ? 'pqRight' : 'pqWrong') }), h('span', { text: tr(q.why, lang) })) : null,
      done && next ? h('button', { type: 'button', class: 'pq-next', text: `${t('pqNext')} →`, onclick: () => this.onYear(next.year) }) : null);
    const el = box;
    el.open = load<boolean>('pqOpen', false);
    el.addEventListener('toggle', () => save('pqOpen', el.open));
    return el;
  }

  private rerender(): void {
    const top = this.body.scrollTop;
    this.key = '';
    this.setYear(this.year);
    this.body.scrollTop = top;
  }

  /** Distinct polities of a snapshot, most important first (neighbours collapse into one entry). */
  private polities(s: Snapshot): { id: string; color: string; role: Polity['role']; name: string }[] {
    const seen = new Map<string, { id: string; color: string; role: Polity['role']; name: string }>();
    let neighbor: { id: string; color: string; role: Polity['role']; name: string } | null = null;
    for (const r of s.regions) {
      const p = POLITY.get(r.polity);
      if (!p) continue;
      const role = r.role ?? p.role;
      if (role === 'neighbor') { neighbor ??= { id: '', color: '#9a9a8a', role, name: t('roleNeighbor') }; continue; }
      const key = p.id + (r.name ? tr(r.name, 'en') : '');
      if (!seen.has(key)) seen.set(key, { id: p.id, color: r.color ?? p.color, role, name: tr(r.name ?? p.name, lang) });
    }
    const out = [...seen.values()].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).slice(0, 10);
    return neighbor ? [...out, neighbor] : out;
  }

  relabel(): void {
    this.el.setAttribute('aria-label', t('legend'));
    this.key = '';
    this.setYear(this.year);
    this.fold(this.folded, false);
  }
}
