import { h } from './dom.ts';

/**
 * The right-hand drawer: one full-height panel hosting stacked views (period details at the base; card, textbook,
 * reader and quiz above). A view is shown by un-hiding it; the most recently shown one sits on top, and hiding it
 * reveals the one beneath. The drawer is open while any view is shown.
 */
export class Panel {
  readonly el: HTMLElement;
  private order: HTMLElement[] = [];
  onChange: (open: boolean) => void = () => {};

  constructor(views: HTMLElement[]) {
    this.el = h('div', { class: 'panel' }, ...views);
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
  /** The view on top, if any. */
  get top(): HTMLElement | null { return this.order[this.order.length - 1] ?? null; }

  private apply(): void {
    this.order.forEach((v, i) => { v.style.zIndex = String(i + 1); v.classList.toggle('top', i === this.order.length - 1); });
    this.el.classList.toggle('on', this.open);
    this.onChange(this.open);
  }
}
