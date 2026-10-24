import { formatArea, polityArea } from '../../shared/data/areas.ts';
import { tr } from '../../shared/data/i18n.ts';
import { WORKS } from '../../shared/data/jiangshan.ts';
import { POLITY } from '../../shared/data/polities.ts';
import type { Polity, Snapshot, Year } from '../../shared/data/types.ts';
import { phaseAt, type Phase } from '../../shared/lib/chronicle.ts';
import { formatYear } from '../../shared/lib/timeline.ts';
import { lang, t, type Key } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { fill, h, iconBtn, setIcon } from './dom.ts';

const ROLE_ORDER: Polity['role'][] = ['main', 'rival', 'occupied', 'protectorate', 'neighbor'];
const WORK_COLOR: Record<string, string> = { wall: '#a8916a', canal: '#2f7fc4', road: '#8a5a2b', sea: '#1f5f8b' };
const WORK_KEY: Record<string, Key> = { wall: 'wkWall', canal: 'wkCanal', road: 'wkRoad', sea: 'wkSea' };

/**
 * The map legend, embedded in the chronicle panel under the dynasty header: 疆域 · phase i/N with dots to step between
 * the territorial phases of the dynasty, the phase title and note, the polities on the map (hover holds a highlight,
 * click frames the polity), the line keys and the border disclaimer. Folds to its one-line header.
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
      pols.length ? h('div', { class: 'lg-pols' }, ...pols) : null,
      s.note ? h('p', { class: 'lg-note', text: tr(s.note, L), title: t('unfold'), onclick: (ev: Event) => (ev.currentTarget as HTMLElement).classList.toggle('open') }) : null,
      keys,
      h('p', { class: 'lg-disc', text: t('disclaimer') }));
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
