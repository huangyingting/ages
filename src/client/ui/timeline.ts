import { EVENTS } from '../../shared/data/events.ts';
import { AGES, ERAS } from '../../shared/data/eras.ts';
import { tr } from '../../shared/data/i18n.ts';
import type { HistEvent, Year } from '../../shared/data/types.ts';
import { reignAt, regionalReignsAt } from '../../shared/data/jiangshan.ts';
import { STOPS, stepStop } from '../../shared/lib/chronicle.ts';
import { formatArea, realmArea } from '../../shared/data/areas.ts';
import { SNAPSHOTS, snapshotAt } from '../../shared/data/territories.ts';
import { eraAt, formatYear, normYear, parseYear, rulerAt, tToYear, ticks, yearToT } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { h, iconBtn, setIcon } from './dom.ts';

/**
 * The bottom timeline: play button, age headers, coloured era bands (two lanes for overlapping regimes) over the curve of
 * the dynasty's territorial area, event ticks and a draggable thumb. Its readout — year with ‹ › stepping, era, ruler
 * and territory area — is the `hero` headline the app places at the top left of the map. The axis is piecewise-linear (see shared/lib/timeline.ts)
 * so the dense recent centuries get room while prehistory stays visible.
 */
export class Timeline {
  readonly el: HTMLElement;
  /** The large year headline (year, era · ruler, territory area), placed over the map by the app. */
  readonly hero: HTMLElement;
  private areaEl: HTMLElement;
  private curve: HTMLElement;
  private track: HTMLElement;
  private thumb: HTMLElement;
  private yearEl: HTMLElement;
  private eraEl: HTMLButtonElement;
  private rulerEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  /** playback rate: 1× crosses the whole axis in ~100 s */
  private speed = 1;
  private tip: HTMLElement;
  private bands: HTMLElement;
  private dots: HTMLElement;
  private axis: HTMLElement;
  private agesEl: HTMLElement;
  private phases: HTMLElement;
  private flag: HTMLElement;
  private input: HTMLInputElement;
  year: Year = 0;
  playing = false;
  onYear: (y: Year, final: boolean) => void = () => {};
  onEvent: (e: HistEvent) => void = () => {};
  onEra: (eraId: string) => void = () => {};
  onPlay: (on: boolean) => void = () => {};
  /** Fires on every readout change (year, era), e.g. for the era chip in the top bar. */
  onRender: (y: Year) => void = () => {};
  private foldBtn: HTMLButtonElement;
  private selected: string | null = null;

  constructor() {
    this.playBtn = iconBtn('play', t('play'), () => this.setPlaying(!this.playing), 'tl-play');
    this.speedBtn = h('button', { type: 'button', class: 'tl-speed', title: t('speed'), 'aria-label': t('speed'), text: '1×', onclick: () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 0.5 : 1;
      this.speedBtn.textContent = `${this.speed}×`;
    } });
    this.yearEl = h('div', { class: 'tl-year', 'aria-live': 'polite' });
    this.eraEl = h('button', { type: 'button', class: 'tl-era', onclick: () => { const e = eraAt(this.year); if (e) this.onEra(e.id); } });
    this.rulerEl = h('div', { class: 'tl-ruler' });
    this.agesEl = h('div', { class: 'tl-ages' });
    this.bands = h('div', { class: 'tl-bands' });
    this.dots = h('div', { class: 'tl-dots' });
    this.axis = h('div', { class: 'tl-axis' });
    this.phases = h('div', { class: 'tl-phases', 'aria-hidden': 'true' });
    this.flag = h('div', { class: 'tl-flag' });
    this.thumb = h('div', { class: 'tl-thumb' }, h('i'), this.flag);
    this.tip = h('div', { class: 'tl-tip' });
    this.curve = h('div', { class: 'tl-curve', 'aria-hidden': 'true' });
    this.areaEl = h('div', { class: 'tl-area' });
    this.track = h('div', { class: 'tl-track', role: 'slider', tabindex: 0, 'aria-label': t('era') }, this.curve, this.agesEl, this.bands, this.phases, this.dots, this.axis, this.thumb, this.tip);
    this.foldBtn = iconBtn('down', t('fold'), () => this.fold(!this.el.classList.contains('folded')), 'tl-fold');
    // the year itself is the go-to-year field: click to type (前221, 1415), Enter/blur to jump
    this.input = h('input', { class: 'tl-in', type: 'text', inputmode: 'numeric', 'aria-label': t('goYear'), title: t('goYear'), hidden: true });
    const done = () => { this.input.hidden = true; this.yearEl.hidden = false; };
    this.input.addEventListener('change', () => { const y = parseYear(this.input.value); if (y != null) { this.setPlaying(false); this.set(y, true); } else this.render(); });
    this.input.addEventListener('blur', done);
    this.input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') this.input.blur(); e.stopPropagation(); });
    this.yearEl.title = t('goYear');
    this.yearEl.addEventListener('click', () => {
      this.yearEl.hidden = true; this.input.hidden = false;
      this.input.value = this.year < 0 ? (lang === 'zh' ? `前${-this.year}` : `${-this.year} BC`) : String(this.year);
      this.input.focus(); this.input.select();
    });
    const row = h('div', { class: 'tl-yr' },
      iconBtn('chevL', t('prevStop'), () => this.step(-1), 'tl-prev'), this.yearEl, this.input,
      iconBtn('chevron', t('nextStop'), () => this.step(1), 'tl-next'));
    this.hero = h('div', { class: 'hero' }, row, h('div', { class: 'tl-sub' }, this.eraEl, this.rulerEl), this.areaEl);
    this.el = h('div', { class: 'tl' }, h('div', { class: 'tl-read' }, this.playBtn, this.speedBtn), this.track, this.foldBtn);
    if (load<boolean>('tlFolded', false)) this.fold(true);
    this.build();
    this.bind();
    new ResizeObserver(() => this.layoutAxis()).observe(this.track);
  }

  private build(): void {
    this.agesEl.replaceChildren(...AGES.map(a => {
      const l = yearToT(a.start), r = yearToT(a.end);
      return h('div', { class: 'tl-age', style: `left:${l * 100}%;width:${(r - l) * 100}%`, text: tr(a.name, lang) });
    }));
    this.bands.replaceChildren(...ERAS.filter(e => e.scope === 'china').map(e => {
      const l = yearToT(e.start), r = yearToT(e.end);
      const b = h('button', {
        type: 'button', class: `tl-band lane${e.lane ?? 0}`, style: `left:${l * 100}%;width:${Math.max(0.15, (r - l) * 100)}%;--c:${e.color}`,
        title: `${tr(e.name, lang)} ${formatYear(e.start, lang)}–${formatYear(e.end, lang)}`, 'data-era': e.id,
        onclick: (ev: Event) => { ev.stopPropagation(); this.onEra(e.id); },
      });
      b.append(h('span', { text: tr(e.short, lang) }));
      return b;
    }));
    this.curve.replaceChildren(this.areaCurve());
    this.phases.replaceChildren(...SNAPSHOTS.filter(x => x.year >= -2070).map(x => h('i', { style: `left:${yearToT(x.year) * 100}%` })));
    // textbook events on top of the (fainter) imported chronicle entries
    this.dots.replaceChildren(...EVENTS.filter(e => e.scope === 'china').sort((a, b) => b.weight - a.weight).map(e => {
      const d = h('button', { type: 'button', class: `tl-dot w${e.weight} k-${e.kind}`, style: `left:${yearToT(e.year) * 100}%`, 'data-id': e.id, 'aria-label': tr(e.title, lang) });
      d.addEventListener('pointerenter', () => this.showTip(e, d));
      d.addEventListener('pointerleave', () => this.tip.classList.remove('on'));
      d.addEventListener('click', ev => { ev.stopPropagation(); this.onEvent(e); });
      return d;
    }));
    this.layoutAxis();
    this.render();
  }

  /** The dynasty's territorial area per phase as a stepped, filled line (one step per territorial snapshot). */
  private areaCurve(): SVGSVGElement {
    const NS = 'http://www.w3.org/2000/svg';
    const snaps = SNAPSHOTS.filter(x => x.year >= -2070);
    const max = Math.max(...snaps.map(x => realmArea(x.id)), 1);
    const pts: string[] = [];
    snaps.forEach((x, i) => {
      const a = 1000 * (1 - realmArea(x.id) / max);
      const x0 = yearToT(x.year) * 1000, x1 = yearToT(snaps[i + 1]?.year ?? tToYear(1)) * 1000;
      pts.push(`${x0.toFixed(1)},${a.toFixed(0)}`, `${x1.toFixed(1)},${a.toFixed(0)}`);
    });
    const first = (yearToT(snaps[0].year) * 1000).toFixed(1), last = (yearToT(tToYear(1)) * 1000).toFixed(1);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    const fill = document.createElementNS(NS, 'polygon');
    fill.setAttribute('points', `${first},1000 ${pts.join(' ')} ${last},1000`);
    const line = document.createElementNS(NS, 'polyline');
    line.setAttribute('points', pts.join(' '));
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(fill, line);
    return svg;
  }

  private layoutAxis(): void {
    const w = this.track.clientWidth || 600;
    this.axis.replaceChildren(...ticks(w).map(y => h('span', { style: `left:${yearToT(y) * 100}%`, text: formatYear(y, lang, { short: true }).replace('约', '').replace('c. ', '').replace(' million years ago', 'M ya') })));
    // hide band labels that do not fit
    for (const b of this.bands.children as HTMLCollectionOf<HTMLElement>) {
      const s = b.firstElementChild as HTMLElement;
      s.style.visibility = s.scrollWidth <= b.clientWidth - 2 ? 'visible' : 'hidden';
    }
  }

  private showTip(e: HistEvent, d: HTMLElement): void {
    this.tip.textContent = `${formatYear(e.year, lang)} ${tr(e.title, lang)}`;
    this.tip.style.left = d.style.left;
    this.tip.classList.add('on');
  }

  private bind(): void {
    let drag = false;
    const at = (cx: number) => {
      const r = this.track.getBoundingClientRect();
      return tToYear(Math.min(1, Math.max(0, (cx - r.left) / r.width)));
    };
    this.track.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('.tl-dot,.tl-band')) return;
      drag = true;
      this.el.classList.add('dragging');
      this.track.setPointerCapture(e.pointerId);
      this.setPlaying(false);
      this.set(at(e.clientX), false);
    });
    this.track.addEventListener('pointermove', e => { if (drag) this.set(at(e.clientX), false); });
    const end = (e: PointerEvent) => { if (drag) { drag = false; this.el.classList.remove('dragging'); this.set(at(e.clientX), true); } };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);
    this.track.addEventListener('keydown', e => {
      const step = this.year < -10000 ? 50000 : this.year < -1000 ? 50 : this.year < 1800 ? 10 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { this.set(this.year + step * (e.shiftKey ? 10 : 1), true); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { this.set(this.year - step * (e.shiftKey ? 10 : 1), true); e.preventDefault(); e.stopPropagation(); }
    });
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      if (this.playing) {
        // ~100 s for the whole axis; slower inside dense periods because the axis is non-linear
        const tt = yearToT(this.year) + (dt * this.speed) / 100;
        if (tt >= 1) { this.set(tToYear(1), true); this.setPlaying(false); } else this.set(tToYear(tt), false);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Collapses the bar to its readout (the map gets the whole screen). */
  fold(on: boolean): void {
    this.el.classList.toggle('folded', on);
    setIcon(this.foldBtn, on ? 'up' : 'down');
    this.foldBtn.title = this.foldBtn.ariaLabel = t(on ? 'unfold' : 'fold');
    save('tlFolded', on);
    if (!on) requestAnimationFrame(() => this.layoutAxis());
  }

  /** Jumps to the next/previous chronicle entry or territorial phase. */
  step(dir: 1 | -1): void {
    this.setPlaying(false);
    this.set(this.year < -2070 && dir > 0 ? STOPS[0] : stepStop(this.year, dir), true);
  }

  setPlaying(on: boolean): void {
    if (on === this.playing) return;
    this.playing = on;
    if (on && yearToT(this.year) >= 0.999) this.set(tToYear(0), false);
    setIcon(this.playBtn, on ? 'pause' : 'play');
    this.playBtn.title = this.playBtn.ariaLabel = t(on ? 'pause' : 'play');
    this.el.classList.toggle('playing', on);
    if (!on) this.onYear(this.year, true);
    this.onPlay(on);
  }

  /** Sets the year (from the user when `emit`, otherwise from the app). */
  set(y: Year, final: boolean, emit = true): void {
    y = normYear(Math.max(tToYear(0), Math.min(tToYear(1), y)));
    const changed = y !== this.year;
    this.year = y;
    this.render();
    if (emit && (changed || final)) this.onYear(y, final);
  }

  select(id: string | null): void {
    this.selected = id;
    for (const d of this.dots.children as HTMLCollectionOf<HTMLElement>) d.classList.toggle('sel', d.dataset.id === id);
  }

  private render(): void {
    const y = this.year;
    this.thumb.style.left = `${yearToT(y) * 100}%`;
    this.yearEl.textContent = formatYear(y, lang);
    const era = eraAt(y);
    this.eraEl.textContent = era ? tr(era.name, lang) : '';
    this.eraEl.style.setProperty('--c', era?.color ?? '#888');
    // the orthodox reign era (年号) when known, else the curated ruler; rival regimes' eras in the tooltip
    const r = rulerAt(y), reign = reignAt(y);
    this.rulerEl.textContent = reign ? tr(reign.label, lang) : r ? tr(r.name, lang) : '';
    this.flag.textContent = `${formatYear(y, lang)}${reign ? ' · ' + tr(reign.label, lang).replace(/^.*· /, '') : ''}`;
    this.rulerEl.title = [this.rulerEl.textContent, ...regionalReignsAt(y).map(x => `${tr(x.regime, lang)}${lang === 'zh' ? '：' : ': '}${tr(x.reign.label, lang)}`)].filter(Boolean).join('\n');
    const snap = snapshotAt(y), area = snap ? realmArea(snap.id) : 0;
    this.areaEl.hidden = !area;
    if (area) this.areaEl.replaceChildren(h('b', { text: t('territory') }), h('span', { text: formatArea(area, lang) }));
    this.track.setAttribute('aria-valuetext', `${formatYear(y, lang)} ${era ? tr(era.name, lang) : ''}`);
    for (const b of this.bands.children as HTMLCollectionOf<HTMLElement>) b.classList.toggle('cur', b.dataset.era === era?.id);
    this.onRender(y);
  }

  relabel(): void {
    this.track.setAttribute('aria-label', t('era'));
    this.yearEl.title = this.input.title = t('goYear');
    this.input.setAttribute('aria-label', t('goYear'));
    for (const [c, k] of [['.tl-prev', 'prevStop'], ['.tl-next', 'nextStop']] as const) { const b = this.hero.querySelector<HTMLElement>(c)!; b.title = t(k); b.setAttribute('aria-label', t(k)); }
    this.playBtn.title = this.playBtn.ariaLabel = t(this.playing ? 'pause' : 'play');
    this.speedBtn.title = this.speedBtn.ariaLabel = t('speed');
    this.foldBtn.title = this.foldBtn.ariaLabel = t(this.el.classList.contains('folded') ? 'unfold' : 'fold');
    this.build();
    this.select(this.selected);
  }
}



