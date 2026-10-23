import * as THREE from 'three';
import { EVENTS } from '../../shared/data/events.ts';
import { tr, type Lang } from '../../shared/data/i18n.ts';
import { PLACE, PLACES, isCapital, placeName } from '../../shared/data/places.ts';
import { POLITY } from '../../shared/data/polities.ts';
import { STAGES, type StageId } from '../../shared/data/stage.ts';
import { snapshotAt } from '../../shared/data/territories.ts';
import type { HistEvent, Snapshot, Year } from '../../shared/data/types.ts';
import { eraAt } from '../../shared/lib/timeline.ts';
import { Fx } from './fx.ts';
import { Geo } from './geo.ts';
import { Labels, type Label } from './labels.ts';
import { buildTerrain, loadHeightmap, type Terrain } from './terrain.ts';
import { TerritoryPainter, regionAnchor, texture } from './territory.ts';
import { View, type CamPose } from './view.ts';

export interface Layers { territory: boolean; places: boolean; events: boolean; models: boolean }

/**
 * The 3D atlas: relief terrain, territorial snapshots that cross-fade through time, period place names, event pins,
 * the current capital and the story FX layer. UI code talks to this class only.
 */
export class Atlas {
  geo: Geo;
  view!: View;
  labels!: Labels;
  fx!: Fx;
  terrain!: Terrain;
  private painter!: TerritoryPainter;
  year: Year = -221;
  lang: Lang = 'zh';
  layers: Layers = { territory: true, places: true, events: true, models: true };
  snapshot: Snapshot | null = null;
  selected: HistEvent | null = null;
  /** when set, map clicks report lon/lat (quiz "where" questions) instead of selecting */
  pickHandler: ((lon: number, lat: number) => void) | null = null;
  onPin: (e: HistEvent) => void = () => {};
  private pins = new Map<string, Label>();
  private placeLabels = new Map<string, Label>();
  private polityLabels: Label[] = [];
  private fade: { t: number; tex: THREE.Texture } | null = null;
  private texA: THREE.Texture | null = null;
  private capitalKey = '';
  private hiT = -1;
  private hiDur = 0;
  private hiTex: THREE.Texture | null = null;
  private eraId = '';

  constructor(readonly host: HTMLElement, readonly lowfx: boolean, stage: StageId = 'china') {
    this.geo = new Geo(STAGES[stage]);
  }

  async init(year: Year, lang: Lang): Promise<void> {
    this.year = year;
    this.lang = lang;
    const hm = await loadHeightmap(import.meta.env.BASE_URL + this.geo.stage.terrain);
    this.geo.setHeightmap(hm.rgba, hm.w, hm.h);
    const canvas = document.createElement('canvas');
    canvas.className = 'gl';
    this.host.append(canvas);
    this.view = new View(canvas, this.geo, this.lowfx);
    this.labels = new Labels(this.view, this.host);
    this.terrain = buildTerrain(this.geo, this.lowfx);
    this.view.scene.add(this.terrain.mesh, this.terrain.base);
    this.painter = new TerritoryPainter(this.geo);
    this.fx = new Fx(this.view, this.geo, this.labels);
    this.view.jump(this.geo.stage.home);
    this.view.onFrame((dt, t) => this.frame(dt, t));
    this.bindPointer(canvas);
    this.buildPlaces();
    this.setYear(year, true);
  }

  private frame(dt: number, t: number): void {
    const u = this.terrain.uniforms;
    u.uTime.value = t;
    (u.uCam.value as THREE.Vector3).copy(this.view.camera.position);
    if (this.fade) {
      this.fade.t = Math.min(1, this.fade.t + dt / 0.8);
      u.uMix.value = this.fade.t * this.fade.t * (3 - 2 * this.fade.t);
      if (this.fade.t >= 1) this.finishFade();
    }
    if (this.hiT >= 0) {
      this.hiT += dt;
      const fadeOut = Math.max(0, this.hiT - this.hiDur);
      u.uHiAmt.value = Math.max(0, (0.55 + 0.35 * Math.sin(this.hiT * 5)) * Math.min(1, this.hiT * 3) * (1 - fadeOut / 0.6));
      if (fadeOut >= 0.6) { this.hiT = -1; u.uHiAmt.value = 0; }
    }
  }

  // ------------------------------------------------------------ input

  private bindPointer(canvas: HTMLCanvasElement): void {
    let down: { x: number; y: number; t: number } | null = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 6 || !quick) return;
      const ll = this.view.pick(e.clientX, e.clientY);
      if (!ll) return;
      if (this.pickHandler) { this.pickHandler(ll[0], ll[1]); return; }
      // a click near a pin selects it (pins are small on touch screens)
      const near = this.nearestPin(e.clientX, e.clientY);
      if (near) this.onPin(near);
    });
  }

  private nearestPin(cx: number, cy: number): HistEvent | null {
    const r = this.view.canvas.getBoundingClientRect();
    let best: HistEvent | null = null, bd = 22;
    const v = new THREE.Vector3();
    for (const [id, l] of this.pins) {
      if (!l.shown) continue;
      const p = this.view.project(l.pos, v);
      const d = Math.hypot(p.x + r.left - cx, p.y + r.top - cy);
      if (d < bd) { bd = d; best = EVENTS.find(e => e.id === id) ?? null; }
    }
    return best;
  }

  // ------------------------------------------------------------ time

  /** Moves the map to a year: territory snapshot, period names, capital and the events of the period. */
  setYear(y: Year, instant = false): void {
    this.year = y;
    const snap = snapshotAt(y);
    if (snap?.id !== this.snapshot?.id || !this.texA) {
      this.snapshot = snap;
      const tex = texture(this.painter.paint(snap));
      if (instant || !this.texA) {
        this.texA?.dispose();
        this.texA = tex;
        this.terrain.uniforms.uTerrA.value = tex;
        this.terrain.uniforms.uMix.value = 0;
        this.fade = null;
      } else {
        if (this.fade) this.finishFade();
        this.terrain.uniforms.uTerrB.value = tex;
        this.fade = { t: 0, tex };
      }
      this.buildPolityLabels();
    }
    this.updatePlaces();
    const era = eraAt(y);
    if (era?.id !== this.eraId) {
      this.eraId = era?.id ?? '';
      this.buildPins();
    }
    this.updateCapital();
  }

  private finishFade(): void {
    if (!this.fade) return;
    this.texA?.dispose();
    this.texA = this.fade.tex;
    this.terrain.uniforms.uTerrA.value = this.texA;
    this.terrain.uniforms.uMix.value = 0;
    this.fade = null;
  }

  /** Pulses a polity's area for `dur` seconds. */
  highlight(polity: string, dur = 3, color?: string): void {
    if (!this.snapshot || !this.snapshot.regions.some(r => r.polity === polity)) return;
    this.hiTex?.dispose();
    this.hiTex = texture(this.painter.mask(this.snapshot, polity));
    const u = this.terrain.uniforms;
    u.uHi.value = this.hiTex;
    (u.uHiColor.value as THREE.Color).set(color ?? '#fff3b0');
    this.hiT = 0;
    this.hiDur = dur;
  }

  // ------------------------------------------------------------ labels

  private buildPlaces(): void {
    for (const p of PLACES) {
      if (p.scope !== 'china') continue;
      const el = document.createElement('div');
      el.className = `place k-${p.kind} t${p.tier}`;
      const l = this.labels.add({
        el, pos: this.geo.pos(p.lon, p.lat, 0.05), group: 'places',
        prio: p.tier === 1 ? 40 : p.tier === 2 ? 22 : 8,
        maxD: p.tier === 1 ? Infinity : p.tier === 2 ? 48 : 20,
      });
      this.placeLabels.set(p.id, l);
    }
  }

  private updatePlaces(): void {
    for (const [id, l] of this.placeLabels) {
      const p = PLACE.get(id)!;
      const cap = isCapital(p, this.year);
      const text = tr(placeName(p, this.year), this.lang);
      if (l.el.dataset.text !== text || l.el.classList.contains('cap') !== cap) {
        l.el.dataset.text = text;
        l.el.textContent = cap ? `★ ${text}` : text;
        l.el.classList.toggle('cap', cap);
        this.labels.remeasure();
      }
      l.prio = cap ? 70 : p.tier === 1 ? 40 : p.tier === 2 ? 22 : 8;
      l.maxD = cap ? Infinity : p.tier === 1 ? Infinity : p.tier === 2 ? 48 : 20;
    }
  }

  private buildPolityLabels(): void {
    this.labels.clear('polity');
    this.polityLabels = [];
    if (!this.snapshot) return;
    const seen = new Set<string>();
    for (const r of this.snapshot.regions) {
      const pol = POLITY.get(r.polity);
      if (!pol) continue;
      const key = r.polity + (r.name ? tr(r.name, 'en') : '');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = regionAnchor(r, this.geo.kx);
      if (!this.geo.inBounds(a.lon, a.lat)) continue;
      const el = document.createElement('div');
      const size = a.area > 250 ? 'xl' : a.area > 60 ? 'l' : a.area > 12 ? 'm' : 's';
      el.className = `polity r-${pol.role} s-${size}`;
      el.style.setProperty('--c', pol.color);
      el.dataset.polity = pol.id;
      el.textContent = tr(r.name ?? pol.name, this.lang);
      this.polityLabels.push(this.labels.add({
        el, pos: this.geo.pos(a.lon, a.lat, 0.25), group: 'polity',
        prio: 30 + Math.min(25, a.area / 10) + (pol.role === 'main' ? 6 : 0),
        maxD: size === 's' ? 40 : size === 'm' ? 90 : Infinity,
        minD: size === 'xl' ? 10 : 0,
      }));
    }
    this.labels.setGroupVisible('polity', this.layers.territory);
  }

  /** Events of the current era (plus the selected one) as clickable pins. */
  private buildPins(): void {
    this.labels.clear('pins');
    this.pins.clear();
    const era = eraAt(this.year);
    const list = EVENTS.filter(e => e.scope === 'china' && (era ? e.year >= era.start && e.year <= era.end : false));
    if (this.selected && !list.includes(this.selected)) list.push(this.selected);
    for (const e of list) this.addPin(e);
    this.labels.setGroupVisible('pins', this.layers.events && !this.pickHandler);
  }

  private addPin(e: HistEvent): void {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pin w${e.weight} k-${e.kind}` + (this.selected?.id === e.id ? ' sel' : '');
    el.dataset.id = e.id;
    el.innerHTML = '<span class="t"></span><i></i>';
    el.querySelector('.t')!.textContent = tr(e.title, this.lang);
    el.addEventListener('click', ev => { ev.stopPropagation(); this.onPin(e); });
    const l = this.labels.add({
      el, pos: this.geo.pos(e.lon, e.lat, 0.02), group: 'pins', anchor: 'above',
      prio: 66 - e.weight * 10, maxD: e.weight === 1 ? Infinity : e.weight === 2 ? 75 : 38,
      pinned: this.selected?.id === e.id,
    });
    this.pins.set(e.id, l);
  }

  private updateCapital(): void {
    const era = eraAt(this.year);
    const cap = era?.capital ? PLACE.get(era.capital) : undefined;
    const key = this.layers.models && cap ? `${cap.id}:${era!.id}` : '';
    if (key === this.capitalKey) return;
    this.capitalKey = key;
    this.fx.clear('base');
    if (cap && key) {
      const modern = this.year >= 1840;
      this.fx.spawn({ lon: cap.lon, lat: cap.lat, model: modern ? { kind: 'monument' } : { kind: 'palace' }, scale: 0.9, yaw: 0 }, 'base');
    }
  }

  // ------------------------------------------------------------ selection

  /** Selects an event: highlights its pin, raises its model and (optionally) flies there. */
  select(e: HistEvent | null, fly = true): void {
    const prev = this.selected;
    this.selected = e;
    this.fx.clear('event');
    if (prev) { const l = this.pins.get(prev.id); if (l) { l.pinned = false; l.el.classList.remove('sel'); } }
    if (!e) return;
    if (!this.pins.has(e.id)) this.addPin(e);
    const l = this.pins.get(e.id)!;
    l.pinned = true;
    l.el.classList.add('sel');
    if (this.layers.models && e.model) this.fx.spawn({ lon: e.lon, lat: e.lat, model: e.model }, 'event');
    this.fx.ring(this.geo.pos(e.lon, e.lat, 0.02), '#ffd76a', 1.2, 'event');
    if (fly) this.view.flyTo({ lon: e.lon, lat: e.lat - 1.2, dist: Math.min(this.view.pose().dist, 26), tilt: 0.85 }, 1.6);
  }

  // ------------------------------------------------------------ settings

  setLang(l: Lang): void {
    this.lang = l;
    for (const [id, lab] of this.pins) {
      const e = EVENTS.find(x => x.id === id);
      if (e) lab.el.querySelector('.t')!.textContent = tr(e.title, l);
    }
    for (const lab of this.placeLabels.values()) lab.el.dataset.text = '';
    this.updatePlaces();
    this.buildPolityLabels();
    this.labels.remeasure();
  }

  setLayer(k: keyof Layers, on: boolean): void {
    this.layers[k] = on;
    if (k === 'territory') {
      this.terrain.uniforms.uTerrOn.value = on ? 1 : 0;
      this.labels.setGroupVisible('polity', on);
    }
    if (k === 'places') this.labels.setGroupVisible('places', on);
    if (k === 'events') this.labels.setGroupVisible('pins', on && !this.pickHandler);
    if (k === 'models') { this.capitalKey = '-'; this.updateCapital(); if (!on) this.fx.clear('event'); }
  }

  setPickMode(fn: ((lon: number, lat: number) => void) | null): void {
    this.pickHandler = fn;
    this.labels.setGroupVisible('pins', this.layers.events && !fn);
    this.host.classList.toggle('picking', !!fn);
  }

  home(): Promise<void> {
    return this.view.flyTo(this.geo.stage.home, 1.6);
  }

  flyTo(p: CamPose, dur?: number): Promise<void> {
    return this.view.flyTo(p, dur);
  }
}
