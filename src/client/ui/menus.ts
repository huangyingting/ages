import type { Layers } from '../scene/atlas.ts';
import { SURFACES, type Surface } from '../scene/terrain.ts';
import { ERAS } from '../../shared/data/eras.ts';
import { JOURNEYS, eraIdOfDyn, type Journey } from '../../shared/data/jiangshan.ts';
import { tr } from '../../shared/data/i18n.ts';
import type { Lang } from '../../shared/data/types.ts';
import { kindName, lang, t, type Key } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { h, icon, iconBtn, type IconName } from './dom.ts';

const sec = (n: number, title: string) => h('h3', {}, h('i', { text: String(n).padStart(2, '0') }), h('span', { text: title }));

/** Settings popover, in numbered sections: 01 map style, 02 layers, 03 sound & display, 04 language; help at the foot. */
export class SettingsMenu {
  readonly el: HTMLElement;
  onChange: (k: keyof Layers, on: boolean) => void = () => {};
  onSurface: (s: Surface) => void = () => {};
  onLang: (l: Lang) => void = () => {};
  onHelp: () => void = () => {};
  /** sound & display controls (music, fullscreen) */
  extra: HTMLElement | null = null;
  constructor(private layers: Layers, public surface: Surface) {
    this.el = h('div', { class: 'pop menu settings', hidden: true, role: 'dialog', 'aria-label': t('settings') });
    this.render();
  }
  render(): void {
    this.el.setAttribute('aria-label', t('settings'));
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
    const langs = h('div', { class: 'seg langs', role: 'radiogroup', 'aria-label': t('language') }, ...([['zh', '中文'], ['en', 'English']] as const).map(([l, name]) => h('button', {
      type: 'button', role: 'radio', class: l === lang ? 'on' : '', 'aria-checked': String(l === lang), 'data-lang': l, text: name,
      onclick: () => { if (l !== lang) this.onLang(l); },
    })));
    this.el.replaceChildren(
      sec(1, t('mapStyle')), sw,
      sec(2, t('layers')), layers,
      ...(this.extra ? [sec(3, t('display')), this.extra] : []),
      sec(this.extra ? 4 : 3, t('language')), langs,
      h('footer', { class: 'menu-foot' }, h('button', { type: 'button', class: 'b-help2', onclick: () => this.onHelp() }, icon('help'), h('span', { text: t('helpTitle') }))));
  }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; }
}

type HubTab = 'study' | 'journeys';

/** Study hall popover, in tabs: 学习 (the course, the quiz) and 人物行迹 (the journeys of historical figures). */
export class HubMenu {
  readonly el: HTMLElement;
  private tab: HubTab = load<HubTab>('hubTab', 'study');
  onPlay: (j: Journey) => void = () => {};
  onPick: (what: 'learn' | 'quiz') => void = () => {};
  /** the course's progress, e.g. ✓ 3/31 */
  stat: () => string = () => '';
  constructor() {
    this.el = h('div', { class: 'pop menu hub', hidden: true, role: 'dialog', 'aria-label': t('hub') });
    this.render();
  }
  private card(cls: string, ic: IconName, title: string, desc: string, stat: string, onclick: () => void): HTMLElement {
    return h('button', { type: 'button', class: `hub-card ${cls}`, onclick }, icon(ic), h('span', { class: 'hc-t' }, h('b', { text: title }), h('small', { text: desc })), stat ? h('em', { text: stat }) : null);
  }
  render(): void {
    this.el.setAttribute('aria-label', t('hub'));
    const tabs = h('div', { class: 'tabs hub-tabs', role: 'tablist' }, ...(['study', 'journeys'] as HubTab[]).map(k => h('button', {
      type: 'button', role: 'tab', class: k === this.tab ? 'on' : '', 'aria-selected': String(k === this.tab), 'data-tab': k, text: t(k),
      onclick: () => { this.tab = k; save('hubTab', k); this.render(); },
    })));
    const body = this.tab === 'study'
      ? h('div', { class: 'hub-list' },
        this.card('b-learn', 'book', t('learnTitle'), t('learnDesc'), this.stat(), () => this.onPick('learn')),
        this.card('b-quiz', 'quiz', t('quizTitle'), t('quizDesc'), '', () => this.onPick('quiz')))
      : h('div', { class: 'hub-list journeys' }, ...JOURNEYS.map((j, i) => h('button', {
        type: 'button', class: 'jn', 'data-journey': j.id, style: `--c:${j.color}`,
        onclick: () => { this.toggle(false); this.onPlay(j); },
      }, h('i', { text: String(i + 1).padStart(2, '0') }), h('b', { text: tr(j.title, lang) }), h('small', { text: this.era(j) + tr(j.span, lang).replace(/（.*）|\(.*\)/, '') }))));
    this.el.replaceChildren(tabs, body);
  }
  private era(j: Journey): string {
    const e = ERAS.find(x => x.id === eraIdOfDyn(j.dyn));
    return e ? tr(e.short, lang) + ' · ' : '';
  }
  /** Shows the tab (and re-reads the course's progress). */
  show(tab?: HubTab): void { if (tab) this.tab = tab; this.render(); this.toggle(true); }
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
      h('ul', {}, ...(['helpControls', 'helpTimeline', 'tlHint', 'helpStory', 'helpKeys'] as Key[]).map(k => h('li', { text: t(k) }))),
      h('div', { class: 'legend' }, ...(['politics', 'war', 'reform', 'culture', 'science', 'economy', 'diplomacy', 'revolution'] as const).map(k => h('span', { class: `lg k-${k}` }, h('i'), h('span', { text: kindName(k) })))),
      h('p', { class: 'small', text: t('disclaimer') }),
      h('p', { class: 'small', text: t('credits') }),
      h('p', { class: 'small', text: t('creditsJsm') }),
      h('p', { class: 'small', text: t('phase2') })));
  }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; }
}
