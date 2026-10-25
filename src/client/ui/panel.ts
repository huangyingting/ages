import { h } from './dom.ts';

/**
 * The two side panels and their stacked views. Left: the things being studied — a lesson, the quiz and the card with
 * its 3D view — floating between the headline and the line key. Right: reference — the period details and the reader —
 * in the drawer under the toolbar. A view is shown by un-hiding it; within a side, the most recently shown one sits on
 * top and hiding it reveals the one beneath. On phones both sides are the same bottom sheet, and the side holding the
 * most recently shown view is in front.
 */
export class Panel {
  readonly left: HTMLElement;
  readonly right: HTMLElement;
  private order: HTMLElement[] = [];
  onChange: () => void = () => {};

  constructor(left: HTMLElement[], right: HTMLElement[]) {
    this.left = h('div', { class: 'panel panel-l' }, ...left);
    this.right = h('div', { class: 'panel panel-r' }, ...right);
    const views = [...left, ...right];
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

  get leftOpen(): boolean { return this.order.some(v => this.left.contains(v)); }
  get rightOpen(): boolean { return this.order.some(v => this.right.contains(v)); }
  /** The view on top of a side. */
  top(side: 'left' | 'right'): HTMLElement | null {
    const box = side === 'left' ? this.left : this.right;
    return [...this.order].reverse().find(v => box.contains(v)) ?? null;
  }

  private apply(): void {
    for (const box of [this.left, this.right]) {
      const mine = this.order.filter(v => box.contains(v));
      mine.forEach((v, i) => { v.style.zIndex = String(i + 1); v.classList.toggle('top', i === mine.length - 1); });
      box.classList.toggle('on', mine.length > 0);
    }
    const last = this.order[this.order.length - 1];
    this.left.classList.toggle('front', !!last && this.left.contains(last));
    this.right.classList.toggle('front', !!last && this.right.contains(last));
    this.onChange();
  }
}
