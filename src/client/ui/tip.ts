import { h } from './dom.ts';

/**
 * The interface's one tooltip for controls (the map has its own `.maptip`, the timeline its `.tl-tip`).
 * Components keep setting `title`; it is lifted into `data-tip` the moment it is set or hovered, so the browser never
 * shows its own tooltip, and this flat translucent tip appears instead — after a short rest on hover, at once on
 * keyboard focus (not when the app moves focus itself). It sits under the control (above it near the bottom edge) and stays inside the viewport.
 */
export function initTips(): void {
  const tip = h('div', { class: 'uitip', id: 'ui-tip', role: 'tooltip', hidden: true });
  document.body.append(tip);
  let cur: HTMLElement | null = null;
  let timer = 0;
  // focus moved by the app (e.g. onto the story's pause button) is not a request for a tip — only Tab focus is
  let keyboard = false;
  document.addEventListener('keydown', e => { keyboard = e.key === 'Tab'; }, true);
  document.addEventListener('pointerdown', () => { keyboard = false; }, true);

  const lift = (n: Element): void => {
    const s = n.getAttribute('title');
    if (s === null || !(n instanceof HTMLElement || n instanceof SVGElement)) return;
    n.removeAttribute('title');
    if (!s) { delete n.dataset.tip; return; }
    n.dataset.tip = s;
    // a title that was the control's only name stays its accessible name
    if (!n.hasAttribute('aria-label') && !n.textContent?.trim()) n.setAttribute('aria-label', s);
    if (n === cur) place(n);
  };
  new MutationObserver(rs => {
    for (const r of rs) {
      if (r.type === 'attributes') { lift(r.target as Element); continue; }
      for (const n of r.addedNodes) if (n instanceof Element) { lift(n); for (const c of n.querySelectorAll('[title]')) lift(c); }
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
  for (const n of document.querySelectorAll('[title]')) lift(n);

  const hide = (): void => {
    clearTimeout(timer);
    cur?.removeAttribute('aria-describedby');
    cur = null;
    tip.hidden = true;
  };
  const place = (n: HTMLElement): void => {
    tip.textContent = n.dataset.tip ?? '';
    tip.hidden = false;
    const r = n.getBoundingClientRect(), w = tip.offsetWidth, ht = tip.offsetHeight, gap = 6;
    const below = r.bottom + gap + ht <= innerHeight - 8;
    tip.style.left = `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8))}px`;
    tip.style.top = `${Math.round(below ? r.bottom + gap : r.top - gap - ht)}px`;
  };
  const show = (n: HTMLElement, delay: number): void => {
    hide();
    if (!n.dataset.tip || !n.isConnected) return;
    cur = n;
    timer = window.setTimeout(() => {
      if (cur !== n || !n.isConnected) return;
      n.setAttribute('aria-describedby', tip.id);
      place(n);
    }, delay);
  };
  const owner = (t: EventTarget | null): HTMLElement | null => {
    if (!(t instanceof Element)) return null;
    for (let n: Element | null = t; n; n = n.parentElement) {
      if (n.hasAttribute('title')) lift(n);
      if (n instanceof HTMLElement && n.dataset.tip) return n;
    }
    return null;
  };

  document.addEventListener('pointerover', e => {
    const n = owner(e.target);
    if (n === cur) return;
    if (!n || e.pointerType === 'touch') return hide();
    show(n, 450);
  });
  document.addEventListener('pointerout', e => { if (cur && !cur.contains(e.relatedTarget as Node | null)) hide(); });
  document.addEventListener('focusin', e => {
    const n = owner(e.target);
    if (n && n === e.target && keyboard && n.matches(':focus-visible')) show(n, 0);
    else if (cur) hide();
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('wheel', hide, { capture: true, passive: true });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
}
