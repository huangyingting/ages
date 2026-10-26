/** Tiny DOM helpers. Text is always set via textContent (content and Wikipedia text are never parsed as HTML). */
type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c) el.append(c);
  return el;
}

const PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
  next: 'M6 6l8.5 6L6 18zm10 0h2v12h-2z',
  prev: 'M18 6l-8.5 6L18 18zM6 6h2v12H6z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
  stop: 'M7 7h10v10H7z',
  search: 'M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  layers: 'M12 3 2 8.5l10 5.5 10-5.5zm-7.6 9.2L2 13.5 12 19l10-5.5-2.4-1.3L12 16.4z',
  book: 'M5 4h6a3 3 0 0 1 1 .2A3 3 0 0 1 13 4h6v15h-6a2 2 0 0 0-1 .3 2 2 0 0 0-1-.3H5zm2 2v11h4l.1.0V7a1 1 0 0 0-1-1zm10 0h-3a1 1 0 0 0-1 1v10h4z',
  quiz: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 16h-2v-2h2zm2.1-7.7-.9.9c-.7.7-1.2 1.3-1.2 2.8h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3A1.9 1.9 0 0 0 12 6.2 1.9 1.9 0 0 0 10 8H8a4 4 0 1 1 7.1 2.3z',
  help: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  home: 'M12 3 3 10.5V21h6v-6h6v6h6V10.5z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  sound: 'M4 9v6h4l5 4V5L8 9zm12.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1A9 9 0 0 0 14 3.2z',
  mute: 'M4 9v6h4l5 4V5L8 9zm12.6 0L15 10.6 16.4 12 15 13.4l1.6 1.6 1.4-1.4 1.4 1.4 1.6-1.6L19.6 12l1.4-1.4L19.4 9 18 10.4z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
  ext: 'M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14zM5 5h6v2H7v10h10v-4h2v6H5z',
  journey: 'M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 9c-1 0-2 .8-2 2v1h2v-1h8a3 3 0 0 1 0 6H9v2h4a5 5 0 0 0 0-10zm6-6v2h4a3 3 0 0 1 3 3h2a5 5 0 0 0-5-5z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  grid: 'M4 4h7v7H4zm2 2v3h3V6zm7-2h7v7h-7zm2 2v3h3V6zM4 13h7v7H4zm2 2v3h3v-3zm7-2h7v7h-7zm2 2v3h3v-3z',
  sliders: 'M3 6h9.2a3 3 0 0 1 5.6 0H21v2h-3.2a3 3 0 0 1-5.6 0H3zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM3 16h3.2a3 3 0 0 1 5.6 0H21v2h-9.2a3 3 0 0 1-5.6 0H3zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  minus: 'M5 11h14v2H5z',
  full: 'M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
  chevron: 'M8.6 7.4 10 6l6 6-6 6-1.4-1.4 4.6-4.6z',
  chevL: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z',
  music: 'M12 3v10.6A4 4 0 1 0 14 17V7h4V3z',
  list: 'M4 5h2v2H4zm4 0h12v2H8zm-4 6h2v2H4zm4 0h12v2H8zm-4 6h2v2H4zm4 0h12v2H8z',
  down: 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z',
  up: 'M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z',
} as const;
export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.classList.add('ic');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', PATHS[name]);
  s.append(p);
  return s;
}

/** An icon button with an accessible label and tooltip. */
export function iconBtn(name: IconName, label: string, onclick: (e: Event) => void, cls = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `ib ${cls}`, 'aria-label': label, title: label, onclick });
  b.append(icon(name));
  return b;
}

export function setIcon(b: HTMLElement, name: IconName): void {
  b.querySelector('svg.ic')?.replaceWith(icon(name));
}

/** replaceChildren that skips null/false children. */
export function fill(el: Element, ...kids: Child[]): void {
  el.replaceChildren(...(kids.filter(Boolean) as (Node | string)[]));
}

/**
 * Focus for a modal dialog: opening moves focus to its first control (remembering the opener), Tab cycles inside it,
 * closing hands focus back to the opener.
 */
export class ModalFocus {
  private opener: HTMLElement | null = null;
  constructor(private readonly el: HTMLElement) {}
  opened(): void {
    if (!this.el.contains(document.activeElement)) this.opener = document.activeElement as HTMLElement | null;
    this.el.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus();
  }
  closed(): void {
    if (this.el.contains(document.activeElement) || document.activeElement === document.body) this.opener?.focus({ preventScroll: true });
    this.opener = null;
  }
  trap(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || this.el.hidden) return;
    const f = [...this.el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.hidden && x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (!this.el.contains(at)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && at === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && at === last) { first.focus(); e.preventDefault(); }
  }
}
