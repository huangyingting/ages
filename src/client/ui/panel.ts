import { h } from './dom.ts';

/**
 * The side panel and its stacked views: the things being studied — a lesson, the quiz and the card with its 3D view
 * (which unfolds the Wikipedia reader beside itself) — floating between the headline and the line key. A view is shown
 * by un-hiding it; the most recently shown one sits on top and hiding it reveals the one beneath. On phones the panel
 * is a bottom sheet above the timeline. Everything else — 时期详情, the study hall, settings — is a popover.
 */
export class Panel {
  readonly el: HTMLElement;
  private order: HTMLElement[] = [];
  onChange: () => void = () => {};

  constructor(views: HTMLElement[]) {
    this.el = h('div', { class: 'panel panel-l' }, ...views);
    const mo = new MutationObserver(recs => {
      for (const r of recs) {
        const v = r.target as HTMLElement;
        this.order = this.order.filter(x => x !== v);
        if (!v.hidden) this.order.push(v);
      }
      this.apply();
    });
    for (const v of views) {
      v.classList.add('view');
      if (!v.hidden) this.order.push(v);
      mo.observe(v, { attributes: true, attributeFilter: ['hidden'] });
    }
    this.apply();
  }

  get open(): boolean { return this.order.length > 0; }
  /** The view on top. */
  get top(): HTMLElement | null { return this.order[this.order.length - 1] ?? null; }

  private apply(): void {
    this.order.forEach((v, i) => { v.style.zIndex = String(i + 1); v.classList.toggle('top', i === this.order.length - 1); });
    for (const v of this.el.children) if (!this.order.includes(v as HTMLElement)) v.classList.remove('top');
    this.el.classList.toggle('on', this.order.length > 0);
    this.onChange();
  }
}
