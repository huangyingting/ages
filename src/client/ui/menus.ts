import type { Layers } from '../scene/atlas.ts';
import { SURFACES, type Surface } from '../scene/terrain.ts';
import { JOURNEYS, type Journey } from '../../shared/data/jiangshan.ts';
import { tr } from '../../shared/data/i18n.ts';
import { kindName, lang, t, type Key } from '../lib/i18n.ts';
import { h, icon, iconBtn, type IconName } from './dom.ts';

/** Map settings popover: 01 map style, 02 layers. */
export class SettingsMenu {
  readonly el: HTMLElement;
  onChange: (k: keyof Layers, on: boolean) => void = () => {};
  onSurface: (s: Surface) => void = () => {};
  constructor(private layers: Layers, public surface: Surface) {
    this.el = h('div', { class: 'pop menu settings', hidden: true, role: 'dialog', 'aria-label': t('settings') });
    this.render();
  }
  render(): void {
    const sw = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t('mapStyle') }, ...SURFACES.map(s => h('button', {
      type: 'button', role: 'radio', class: `sw sw-${s}` + (s === this.surface ? ' on' : ''), 'aria-checked': String(s === this.surface), 'data-surface': s,
      onclick: () => { this.surface = s; this.onSurface(s); this.render(); },
    }, h('i'), h('span', { text: t(({ ink: 'sInk', paper: 'sPaper', plain: 'sPlain' } as const)[s]) }))));
    const layers = h('div', { class: 'switches' }, ...(Object.keys(this.layers) as (keyof Layers)[]).map(k => {
      const c = h('input', { type: 'checkbox', 'data-layer': k });
      c.checked = this.layers[k];
      c.addEventListener('change', () => this.onChange(k, c.checked));
      return h('label', { class: 'switch-card' }, h('span', { text: t(k as Key) }), c, h('i', { class: 'sw-track' }));
    }));
    this.el.replaceChildren(h('h3', { text: t('mapStyle') }), sw, h('h3', { text: t('layers') }), layers);
  }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; }
}

/** Study hall popover: the study tools (textbook, quiz, help), then the journeys of historical figures. */
export class HubMenu {
  readonly el: HTMLElement;
  onPlay: (j: Journey) => void = () => {};
  onPick: (what: 'learn' | 'quiz' | 'help') => void = () => {};
  constructor() {
    this.el = h('div', { class: 'pop menu hub', hidden: true, role: 'dialog', 'aria-label': t('hub') });
    this.render();
  }
  private card(cls: string, ic: IconName, title: string, desc: string, onclick: () => void): HTMLElement {
    return h('button', { type: 'button', class: `hub-card ${cls}`, onclick }, icon(ic), h('span', { class: 'hc-t' }, h('b', { text: title }), h('small', { text: desc })));
  }
  render(): void {
    this.el.replaceChildren(
      h('h3', { text: t('study') }),
      h('div', { class: 'hub-list' },
        this.card('b-learn', 'book', t('learnTitle'), t('learnDesc'), () => this.onPick('learn')),
        this.card('b-quiz', 'quiz', t('quizTitle'), t('quizDesc'), () => this.onPick('quiz')),
        this.card('b-help2', 'help', t('helpTitle'), t('helpDesc'), () => this.onPick('help'))),
      h('h3', { text: t('journeys') }),
      h('div', { class: 'hub-list journeys' }, ...JOURNEYS.map((j, i) => h('button', {
        type: 'button', class: 'jn', 'data-journey': j.id, style: `--c:${j.color}`,
        onclick: () => { this.toggle(false); this.onPlay(j); },
      }, h('i', { text: String(i + 1).padStart(2, '0') }), h('b', { text: tr(j.title, lang) }), h('small', { text: tr(j.span, lang).replace(/（.*）|\(.*\)/, '') })))));
  }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; }
}

/** Help & about dialog. */
export class Help {
  readonly el: HTMLElement;
  constructor() {
    this.el = h('div', { class: 'modal', hidden: true, role: 'dialog', 'aria-modal': 'true', onclick: (e: Event) => { if (e.target === this.el) this.toggle(false); } });
    this.render();
  }
  render(): void {
    this.el.replaceChildren(h('div', { class: 'modal-box help' },
      h('header', {}, h('h2', { text: t('helpTitle') }), iconBtn('close', t('close'), () => this.toggle(false))),
      h('ul', {}, ...(['helpControls', 'helpTimeline', 'helpStory', 'helpKeys'] as Key[]).map(k => h('li', { text: t(k) }))),
      h('div', { class: 'legend' }, ...(['politics', 'war', 'reform', 'culture', 'science', 'economy', 'diplomacy', 'revolution'] as const).map(k => h('span', { class: `lg k-${k}` }, h('i'), h('span', { text: kindName(k) })))),
      h('p', { class: 'small', text: t('credits') }),
      h('p', { class: 'small', text: t('creditsJsm') }),
      h('p', { class: 'small', text: t('phase2') })));
  }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; }
}
