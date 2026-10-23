import { EVENTS } from '../../shared/data/events.ts';
import { AGES, ERAS } from '../../shared/data/eras.ts';
import { tr } from '../../shared/data/i18n.ts';
import type { HistEvent, Year } from '../../shared/data/types.ts';
import { eraAt, formatYear, normYear, rulerAt, tToYear, ticks, yearToT } from '../../shared/lib/timeline.ts';
import { lang, t } from '../lib/i18n.ts';
import { h, iconBtn, setIcon } from './dom.ts';

/**
 * The compact bottom timeline: year/era/ruler readout, play button, age headers, coloured era bands (two lanes for
 * overlapping regimes), event ticks and a draggable thumb. The axis is piecewise-linear (see shared/lib/timeline.ts)
 * so the dense recent centuries get room while prehistory stays visible.
 */
export class Timeline {
  readonly el: HTMLElement;
  private track: HTMLElement;
  private thumb: HTMLElement;
  private yearEl: HTMLElement;
  private eraEl: HTMLButtonElement;
  private rulerEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private tip: HTMLElement;
  private bands: HTMLElement;
  private dots: HTMLElement;
  private axis: HTMLElement;
  private agesEl: HTMLElement;
  year: Year = 0;
  playing = false;
  onYear: (y: Year, final: boolean) => void = () => {};
  onEvent: (e: HistEvent) => void = () => {};
  onEra: (eraId: string) => void = () => {};
  onPlay: (on: boolean) => void = () => {};
  private selected: string | null = null;

  constructor() {
    this.playBtn = iconBtn('play', t('play'), () => this.setPlaying(!this.playing), 'tl-play');
    this.yearEl = h('div', { class: 'tl-year', 'aria-live': 'polite' });
    this.eraEl = h('button', { type: 'button', class: 'tl-era', onclick: () => { const e = eraAt(this.year); if (e) this.onEra(e.id); } });
    this.rulerEl = h('div', { class: 'tl-ruler' });
    this.agesEl = h('div', { class: 'tl-ages' });
    this.bands = h('div', { class: 'tl-bands' });
    this.dots = h('div', { class: 'tl-dots' });
    this.axis = h('div', { class: 'tl-axis' });
    this.thumb = h('div', { class: 'tl-thumb' }, h('i'));
    this.tip = h('div', { class: 'tl-tip' });
    this.track = h('div', { class: 'tl-track', role: 'slider', tabindex: 0, 'aria-label': t('era') }, this.agesEl, this.bands, this.dots, this.axis, this.thumb, this.tip);
    this.el = h('div', { class: 'tl' },
      h('div', { class: 'tl-read' }, this.playBtn, h('div', { class: 'tl-txt' }, this.yearEl, h('div', { class: 'tl-sub' }, this.eraEl, this.rulerEl))),
      this.track);
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
    this.dots.replaceChildren(...EVENTS.filter(e => e.scope === 'china' && e.weight <= 2).map(e => {
      const d = h('button', { type: 'button', class: `tl-dot w${e.weight} k-${e.kind}`, style: `left:${yearToT(e.year) * 100}%`, 'data-id': e.id, 'aria-label': tr(e.title, lang) });
      d.addEventListener('pointerenter', () => this.showTip(e, d));
      d.addEventListener('pointerleave', () => this.tip.classList.remove('on'));
      d.addEventListener('click', ev => { ev.stopPropagation(); this.onEvent(e); });
      return d;
    }));
    this.layoutAxis();
    this.render();
  }

  private layoutAxis(): void {
    const w = this.track.clientWidth || 600;
    this.axis.replaceChildren(...ticks(w).map(y => h('span', { style: `left:${yearToT(y) * 100}%`, text: formatYear(y, lang, { short: true }).replace('约', '').replace('c. ', '') })));
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
      this.track.setPointerCapture(e.pointerId);
      this.setPlaying(false);
      this.set(at(e.clientX), false);
    });
    this.track.addEventListener('pointermove', e => { if (drag) this.set(at(e.clientX), false); });
    const end = (e: PointerEvent) => { if (drag) { drag = false; this.set(at(e.clientX), true); } };
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
        const tt = yearToT(this.year) + dt / 100;
        if (tt >= 1) { this.set(tToYear(1), true); this.setPlaying(false); } else this.set(tToYear(tt), false);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
    const r = rulerAt(y);
    this.rulerEl.textContent = r ? tr(r.name, lang) : '';
    this.track.setAttribute('aria-valuetext', `${formatYear(y, lang)} ${era ? tr(era.name, lang) : ''}`);
    for (const b of this.bands.children as HTMLCollectionOf<HTMLElement>) b.classList.toggle('cur', b.dataset.era === era?.id);
  }

  relabel(): void {
    this.track.setAttribute('aria-label', t('era'));
    this.playBtn.title = this.playBtn.ariaLabel = t(this.playing ? 'pause' : 'play');
    this.build();
    this.select(this.selected);
  }
}


