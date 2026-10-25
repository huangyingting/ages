import { formatArea, polityArea, realmArea, snapPolities } from '../../shared/data/areas.ts';
import { tr } from '../../shared/data/i18n.ts';
import { WORKS } from '../../shared/data/jiangshan.ts';
import { PLACE, mapName } from '../../shared/data/places.ts';
import { POLITY } from '../../shared/data/polities.ts';
import { SNAPSHOTS } from '../../shared/data/territories.ts';
import type { Lang, Polity, Snapshot, Year } from '../../shared/data/types.ts';
import { phaseAt, type Phase } from '../../shared/lib/chronicle.ts';
import { periodQuestion } from '../../shared/lib/quiz.ts';
import { eraAt, formatYear } from '../../shared/lib/timeline.ts';
import { lang, t, type Key } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { fill, h, iconBtn } from './dom.ts';

const ROLE_ORDER: Polity['role'][] = ['main', 'rival', 'occupied', 'protectorate', 'neighbor'];
const WORK_COLOR: Record<string, string> = { wall: '#a8916a', canal: '#2f7fc4', road: '#8a5a2b', sea: '#1f5f8b' };
const WORK_KEY: Record<string, Key> = { wall: 'wkWall', canal: 'wkCanal', road: 'wkRoad', sea: 'wkSea' };

interface Pol { id: string; color: string; role: Polity['role']; name: string; area: number }

/** "241" + "万平方千米" / "2.41" + "million km²" from thousands of km². */
function areaParts(k: number, l: Lang): [string, string] {
  if (l === 'zh') { const w = k / 10; return [w >= 10 ? Math.round(w).toLocaleString('zh-CN') : w.toFixed(1), '万平方千米']; }
  return k >= 1000 ? [(k / 1000).toFixed(2), 'million km²'] : [`${Math.round(k)},000`, 'km²'];
}

/**
 * The territorial period at the timeline's year, shown at three depths:
 * - `btn` (the top-right toolbar): the 时期详情 toggle;
 * - `stats` (map, top right, under the toolbar): the realm's area in large type and the largest coexisting polities;
 * - `line` (map, bottom centre): the phase title as an ambient caption;
 * - `key` (map, bottom left): the line legend and the border disclaimer;
 * - `view` (the drawer's base view, 时期详情), by priority: the overview (span, phase stepper, title, dynasty · capital ·
 *   area, note) and the chronicle (mounted by the app, fills the rest), then two folded sections — every polity with
 *   its area, and a one-question check per phase (随堂检测).
 * Hovering a polity holds its highlight on the map; clicking frames it.
 */
export class Period {
  readonly stats: HTMLElement;
  readonly line: HTMLElement;
  readonly key: HTMLElement;
  readonly view: HTMLElement;
  private body: HTMLElement;
  private overview: HTMLElement;
  private pols: HTMLDetailsElement;
  private polsSum: HTMLElement;
  private polsBody: HTMLElement;
  private check: HTMLDetailsElement;
  private checkSum: HTMLElement;
  private checkBody: HTMLElement;
  readonly btn: HTMLButtonElement;
  private sig = '';
  private year: Year = 0;
  onYear: (y: Year) => void = () => {};
  onHold: (polity: string | null) => void = () => {};
  onPolity: (polity: string) => void = () => {};
  onEra: (id: string) => void = () => {};
  /** the 时期详情 button and the ambient line: open / close the period view */
  onDetails: () => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    this.btn = iconBtn('list', t('details'), () => this.onDetails(), 'b-details');
    this.btn.setAttribute('aria-expanded', 'false');
    this.stats = h('div', { class: 'hud-stats' });
    this.line = h('button', { type: 'button', class: 'amb', onclick: () => this.onDetails() });
    this.key = h('div', { class: 'map-key' });
    this.overview = h('section', { class: 'pv-sec pv-ov' });
    // folded by default; the details elements persist across years, so an opened section stays open
    this.polsSum = h('summary', { class: 'pv-h' });
    this.polsBody = h('div', { class: 'pv-fb' });
    this.pols = h('details', { class: 'pv-sec pv-fold pv-pols' }, this.polsSum, this.polsBody);
    this.checkSum = h('summary', { class: 'pv-h' });
    this.checkBody = h('div', { class: 'pv-fb' });
    this.check = h('details', { class: 'pv-sec pv-fold pv-quiz' }, this.checkSum, this.checkBody);
    this.body = h('div', { class: 'view-body' }, this.overview, this.pols, this.check);
    this.view = h('section', { class: 'view pv', hidden: true, role: 'region' },
      h('header', { class: 'view-head' }, h('h2', { text: t('details') }), iconBtn('close', t('close'), () => this.onClose(), 'pv-x')),
      this.body);
    this.relabel();
  }

  /** Docks a section (the chronicle) right after the overview. */
  mount(section: HTMLElement): void { this.body.insertBefore(section, this.pols); }

  /** Marks the 时期详情 button pressed while the view is open. */
  pressed(on: boolean): void {
    this.btn.classList.toggle('on', on);
    this.btn.setAttribute('aria-expanded', String(on));
  }

  setYear(y: Year): void {
    this.year = y;
    const ph = phaseAt(y);
    const works = [...new Set(WORKS.filter(w => y >= w.span[0] && y <= w.span[1]).map(w => w.kind))];
    const sig = `${ph?.snap.id}|${ph?.snap.regions.length}|${works.join()}|${lang}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.renderStats(ph);
    this.renderKey(works);
    this.line.hidden = !ph;
    if (ph) this.line.textContent = tr(ph.snap.title, lang);
    this.overview.hidden = this.pols.hidden = this.check.hidden = !ph;
    if (!ph) return;
    this.renderOverview(ph);
    this.renderPolities(ph.snap);
    this.renderCheck(ph.snap);
  }

  // ------------------------------------------------------------ map overlay

  private renderStats(ph: Phase | null): void {
    if (!ph) { fill(this.stats); return; }
    const s = ph.snap, L = lang;
    const list = this.polities(s);
    const main = list.find(p => p.role === 'main') ?? list[0];
    const area = realmArea(s.id);
    const others: Pol[] = snapPolities(s.id).filter(([id]) => id !== main?.id && POLITY.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, k]) => {
      const p = POLITY.get(id)!;
      return { id, color: list.find(x => x.id === id)?.color ?? p.color, role: p.role, name: tr(p.name, L), area: k };
    });
    const n = snapPolities(s.id).length;
    const [num, unit] = areaParts(area, L);
    const era = eraAt(s.year);
    fill(this.stats,
      area ? h('p', { class: 'st-k' }, h('i', { style: `--c:${main?.color ?? era?.color ?? '#888'}` }), h('span', { text: t('realmArea', { p: main?.name ?? (era ? tr(era.short, L) : '') }) })) : null,
      area ? h('p', { class: 'st-n' }, h('b', { text: num }), h('span', { text: unit })) : null,
      others.length ? h('ul', { class: 'st-pols' }, ...others.map(p => h('li', {}, this.polBtn(p, 'st-pol')))) : null,
      n > 1 ? h('p', { class: 'st-c', text: t('coexistN', { n }) }) : null);
  }

  private renderKey(works: string[]): void {
    fill(this.key,
      h('div', { class: 'mk-row' },
        h('span', { class: 'mk mk-border' }, h('i'), h('span', { text: t('keyBorder') })),
        h('span', { class: 'mk mk-ghost' }, h('i'), h('span', { text: t('roleGhost') })),
        h('span', { class: 'mk mk-cap' }, h('i'), h('span', { text: t('capitalNow') })),
        ...works.map(k => h('span', { class: `mk mk-line k-${k}`, style: `--c:${WORK_COLOR[k] ?? '#888'}` }, h('i'), h('span', { text: t(WORK_KEY[k] ?? 'works') })))),
      h('div', { class: 'mk-row' }, h('span', { class: 'mk mk-ev' }, h('i'), h('span', { text: t('keyEvent') }))),
      h('p', { class: 'mk-disc', text: t('disclaimer') }));
  }

  // ------------------------------------------------------------ the drawer view

  private renderOverview(ph: Phase): void {
    const s = ph.snap, L = lang;
    const era = eraAt(s.year);
    const cap = era?.capital ? PLACE.get(era.capital) : undefined;
    const capName = cap ? mapName(cap, s.year) ?? cap.name : null;
    const area = realmArea(s.id);
    const n = ph.group.length;
    const pad = (i: number) => String(i).padStart(2, '0');
    const steps = n > 1 ? h('div', { class: 'pv-steps', role: 'tablist' }, ...ph.group.map((g, i) => h('button', {
      type: 'button', role: 'tab', class: g === s ? 'on' : '', 'aria-selected': String(g === s), title: tr(g.title, L),
      'aria-label': `${t('phase', { i: i + 1, n })} ${tr(g.title, L)}`, onclick: () => this.onYear(g.year),
    }))) : null;
    const fact = (k: string, v: Node | string | null) => (v ? h('div', {}, h('dt', { text: k }), typeof v === 'string' ? h('dd', { text: v }) : h('dd', {}, v)) : null);
    fill(this.overview,
      h('div', { class: 'pv-top' },
        h('span', { class: 'pv-span', text: `${formatYear(ph.from, L, { short: true })} – ${formatYear(ph.to, L, { short: true })}` }),
        n > 1 ? h('small', { class: 'pv-idx', text: `${pad(ph.index + 1)} / ${pad(n)}` }) : null),
      steps,
      // the span is shown above, so a title's own leading dates ("221–215 BCE · …") are dropped
      h('p', { class: 'pv-title', text: tr(s.title, L).replace(/^[^·]*\d[^·]*·\s*(?=\S)/, '') }),
      h('dl', { class: 'pv-facts' },
        fact(t('dynasty'), era ? h('button', { type: 'button', class: 'pv-era', style: `--c:${era.color}`, onclick: () => this.onEra(era.id) }, h('i'), h('span', { text: tr(era.short, L) })) : null),
        fact(t('capitalNow'), capName ? tr(capName, L) : null),
        fact(t('pArea'), area ? areaParts(area, L).join(' ').replace('million km²', 'M km²').replace('平方千米', 'km²') : null)),
      s.note ? h('p', { class: 'pv-note', text: tr(s.note, L) }) : null);
  }

  private renderPolities(s: Snapshot): void {
    // the drawn polities first, then every other one the area table knows (the neighbours), largest first
    const list = this.polities(s).filter(p => p.id);
    const have = new Set(list.map(p => p.id));
    for (const [id, k] of snapPolities(s.id).slice().sort((a, b) => b[1] - a[1])) {
      const p = POLITY.get(id);
      if (p && !have.has(id)) list.push({ id, color: p.color, role: 'neighbor', name: tr(p.name, lang), area: k });
    }
    fill(this.polsSum, h('h3', { text: t('pPolities') }), h('small', { text: `${list.length} · ${t('pPolUnit')}` }));
    fill(this.polsBody, h('div', { class: 'pv-grid' }, ...list.map(p => this.polBtn(p, 'pv-pol'))));
  }

  private polBtn(p: Pol, cls: string): HTMLButtonElement {
    const b = h('button', { type: 'button', class: `${cls} r-${p.role}`, style: `--c:${p.color}`, 'data-polity': p.id, onclick: () => { if (p.id) this.onPolity(p.id); } },
      h('i'), h('span', { text: p.name }), p.area ? h('small', { text: formatArea(p.area, lang, true) }) : null);
    if (p.id) {
      b.addEventListener('pointerenter', () => this.onHold(p.id));
      b.addEventListener('pointerleave', () => this.onHold(null));
      b.addEventListener('focus', () => this.onHold(p.id));
      b.addEventListener('blur', () => this.onHold(null));
    }
    return b;
  }

  /** 随堂检测: one question for the phase; the answer is kept, so the result stays shown when coming back. */
  private renderCheck(s: Snapshot): void {
    const q = periodQuestion(s);
    this.check.hidden = !q;
    if (!q) return;
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
        this.sig = '';
        this.setYear(this.year);
      },
    }, h('i', { text: 'ABCD'[i] }), h('span', { text: tr(o, lang) })));
    const next = SNAPSHOTS[SNAPSHOTS.indexOf(s) + 1];
    fill(this.checkSum, h('h3', { text: t('pqTitle') }), h('small', { text: t('pqProgress', { a: all.length, n: SNAPSHOTS.length, c: right }) }), done ? null : h('em', { class: 'pv-new' }));
    fill(this.checkBody,
      h('p', { class: 'pq-q', text: tr(q.prompt, lang) }),
      h('div', { class: 'pq-opts' }, ...opts),
      done ? h('p', { class: `pq-res ${pick === q.answer ? 'ok' : 'bad'}` }, h('b', { text: t(pick === q.answer ? 'pqRight' : 'pqWrong') }), h('span', { text: tr(q.why, lang) })) : null,
      done && next ? h('button', { type: 'button', class: 'pq-next', text: `${t('pqNext')} →`, onclick: () => this.onYear(next.year) }) : null);
  }

  /** Distinct polities of a snapshot, most important first, with their areas (neighbours collapse into one entry). */
  private polities(s: Snapshot): Pol[] {
    const seen = new Map<string, Pol>();
    const named = new Map<string, number>();
    let neighbor: Pol | null = null;
    for (const r of s.regions) {
      const p = POLITY.get(r.polity);
      if (!p) continue;
      const role = r.role ?? p.role;
      if (role === 'neighbor') { neighbor ??= { id: '', color: '#9a9a8a', role, name: t('roleNeighbor'), area: 0 }; continue; }
      const key = p.id + (r.name ? tr(r.name, 'en') : '');
      named.set(p.id, (named.get(p.id) ?? 0) + (seen.has(key) ? 0 : 1));
      if (!seen.has(key)) seen.set(key, { id: p.id, color: r.color ?? p.color, role, name: tr(r.name ?? p.name, lang), area: 0 });
    }
    // areas only for polities drawn as one (not one split into named parts)
    for (const x of seen.values()) if (named.get(x.id) === 1) x.area = polityArea(s.id, x.id);
    const out = [...seen.values()].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.area - a.area).slice(0, 12);
    return neighbor ? [...out, neighbor] : out;
  }

  relabel(): void {
    this.view.setAttribute('aria-label', t('details'));
    (this.view.querySelector('.view-head h2') as HTMLElement).textContent = t('details');
    const x = this.view.querySelector<HTMLElement>('.pv-x')!;
    x.title = t('close'); x.setAttribute('aria-label', t('close'));
    this.btn.title = t('details'); this.btn.setAttribute('aria-label', t('details'));
    this.key.setAttribute('aria-label', t('legend'));
    this.line.title = t('details');
    this.sig = '';
    this.setYear(this.year);
  }
}
