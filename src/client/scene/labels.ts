import * as THREE from 'three';
import type { View } from './view.ts';
import { declutter, type LayoutItem } from './layout.ts';

/**
 * HTML label overlay: world-anchored labels positioned each frame, hidden when off-screen, outside their zoom range
 * or overlapping a higher-priority label. Elements are plain DOM, so text stays crisp and accessible, and clicks work.
 */
export interface Label {
  el: HTMLElement;
  pos: THREE.Vector3;
  /** higher wins collisions */
  prio: number;
  /** visible only while the camera distance is in [minD, maxD] */
  minD?: number;
  maxD?: number;
  /** never hidden by collisions (e.g. the selected event) */
  pinned?: boolean;
  primary?: boolean;
  /** label sits above the point (pins) rather than centred on it */
  anchor?: 'center' | 'above' | 'beside';
  group: string;
  w?: number;
  h?: number;
  markerX?: number;
  shown?: boolean;
  /** hidden regardless of zoom (e.g. a place that does not exist in the current year) */
  off?: boolean;
  owner?: string;
  /** Shared layout entry of the model this label belongs to, when it is in model form. */
  model?: LayoutItem;
  /** Transparent, keyboard-accessible model target; it uses the model's projected bounds. */
  modelHit?: boolean;
  screen?: { x: number; y: number };
}

export class Labels {
  readonly root: HTMLElement;
  private items: Label[] = [];
  private tmp = new THREE.Vector3();
  private hidden = new Set<string>();
  private lz = 1;
  dirtySize = true;

  constructor(private view: View, host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    host.append(this.root);
    window.addEventListener('resize', () => (this.dirtySize = true));
  }

  add(l: Label): Label {
    this.items.push(l);
    this.root.append(l.el);
    l.el.style.visibility = 'hidden';
    this.dirtySize = true;
    return l;
  }

  remove(l: Label): void {
    const i = this.items.indexOf(l);
    if (i >= 0) this.items.splice(i, 1);
    l.el.remove();
  }

  clear(group: string): void {
    for (const l of this.items.filter(x => x.group === group)) this.remove(l);
  }

  setGroupVisible(group: string, on: boolean): void {
    if (on) this.hidden.delete(group); else this.hidden.add(group);
  }

  /** Call after label text changes (sizes are cached). */
  remeasure(): void { this.dirtySize = true; }

  layout(models: LayoutItem[] = []): void {
    const v = this.view;
    const W = v.canvas.clientWidth, H = v.canvas.clientHeight;
    const dist = v.camera.position.distanceTo(v.controls.target);
    // map text grows a little as the camera closes in (×0.9 far out … ×1.3 up close), in steps so sizes rarely re-measure
    const lz = Math.round(Math.min(1.3, Math.max(0.9, (24 / dist) ** 0.18)) * 20) / 20;
    if (lz !== this.lz) {
      this.lz = lz;
      this.root.style.setProperty('--lz', String(lz));
      this.dirtySize = true;
    }
    if (this.dirtySize) {
      for (const l of this.items) {
        l.w = l.el.offsetWidth; l.h = l.el.offsetHeight;
        const marker = l.el.querySelector<HTMLElement>('.b');
        l.markerX = marker ? marker.offsetLeft + marker.offsetWidth / 2 : l.w / 2;
      }
      this.dirtySize = false;
    }
    const candidates = new Map<Label, LayoutItem>();
    for (const l of this.items) {
      let show = !l.off && !this.hidden.has(l.group) && (!!l.model || !!l.pinned || (dist >= (l.minD ?? 0) && dist <= (l.maxD ?? Infinity)));
      let x = 0, y = 0;
      if (show && !(l.modelHit && l.model)) {
        const p = v.project(l.pos, this.tmp);
        x = l.screen?.x ?? p.x; y = l.screen?.y ?? p.y;
        if (p.z < -1 || p.z > 1 || x < -40 || y < -40 || x > W + 40 || y > H + 40) show = false;
      }
      const w = l.w ?? 0, h = l.h ?? 0;
      const left = x - (l.anchor === 'beside' ? l.markerX ?? w / 2 : w / 2), top = l.anchor === 'above' ? y - h : y - h / 2;
      if (show) {
        const bounds = l.modelHit && l.model ? l.model.bounds : { left, top, right: left + w, bottom: top + h };
        candidates.set(l, { bounds, prio: l.prio, pinned: l.pinned, primary: l.primary, owner: l.owner, model: l.model, passive: l.modelHit });
      }
    }
    declutter(models, [...candidates.values()]);
    for (const l of this.items) {
      const item = candidates.get(l);
      const show = !!item?.shown;
      if (show) {
        const b = item!.bounds;
        l.el.style.transform = `translate3d(${b.left.toFixed(1)}px, ${b.top.toFixed(1)}px, 0)`;
        if (l.modelHit) {
          l.el.style.width = `${b.right - b.left}px`;
          l.el.style.height = `${b.bottom - b.top}px`;
        }
      }
      if (show !== l.shown) {
        l.shown = show;
        l.el.style.visibility = show ? 'visible' : 'hidden';
        l.el.classList.toggle('on', show);
      }
    }
  }
}
