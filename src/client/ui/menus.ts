import type { Layers } from '../scene/atlas.ts';
import { kindName, t, type Key } from '../lib/i18n.ts';
import { h, iconBtn } from './dom.ts';

/** Layers popover. */
export class LayersMenu {
  readonly el: HTMLElement;
  onChange: (k: keyof Layers, on: boolean) => void = () => {};
  constructor(private layers: Layers) {
    this.el = h('div', { class: 'pop layers', hidden: true });
    this.render();
  }
  render(): void {
    this.el.replaceChildren(...(Object.keys(this.layers) as (keyof Layers)[]).map(k => {
      const c = h('input', { type: 'checkbox', 'data-layer': k });
      c.checked = this.layers[k];
      c.addEventListener('change', () => this.onChange(k, c.checked));
      return h('label', {}, c, h('span', { text: t(k as Key) }));
    }));
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
      h('p', { class: 'note', text: t('disclaimer') }),
      h('p', { class: 'small', text: t('credits') }),
      h('p', { class: 'small', text: t('creditsJsm') }),
      h('p', { class: 'small', text: t('phase2') })));
  }
  toggle(on = this.el.hidden): void { this.el.hidden = !on; }
}
