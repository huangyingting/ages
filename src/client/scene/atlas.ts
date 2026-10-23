import * as THREE from 'three';
import { EVENTS } from '../../shared/data/events.ts';
import { tr, type Lang } from '../../shared/data/i18n.ts';
import { RIVER_LABELS, WORKS, type Person } from '../../shared/data/jiangshan.ts';
import { PLACE, PLACES, isCapital, mapName } from '../../shared/data/places.ts';
import { sceneryOf } from '../../shared/data/scenery.ts';
import type { LifeItem } from '../../shared/data/life.ts';
import { POLITY, polityMatches } from '../../shared/data/polities.ts';
import { STAGES, type StageId } from '../../shared/data/stage.ts';
import { snapshotAt } from '../../shared/data/territories.ts';
import { previousSnap } from '../../shared/lib/chronicle.ts';
import type { AdminUnit, HistEvent, LonLat, Place, Region, Snapshot, Year } from '../../shared/data/types.ts';
import { eraAt, formatYear } from '../../shared/lib/timeline.ts';
import { kindName, t as ui } from '../lib/i18n.ts';
import { glyph } from '../ui/icons.ts';
import { Fx, type SpawnState } from './fx.ts';
import { Halo } from './halo.ts';
import { Geo } from './geo.ts';
import { Labels, type Label } from './labels.ts';
import { buildTerrain, loadHeightmap, SURFACE, type Surface, type Terrain } from './terrain.ts';
import { ShapeStore } from './shapes.ts';
import { TerritoryPainter, regionAnchor, texture } from './territory.ts';
import { View, type CamPose } from './view.ts';

/**
 * Something standing on the map that can be hovered and opened: a dynasty scenery model, the capital or the selected
 * event's model. `key` is `life:<id>`, `person:<id>`, `event:<id>` or `capital:<id>`.
 */
interface Mark {
  key: string;
  g: THREE.Object3D;
  icon: string;
  info: () => { title: string; sub: string };
  open: () => void;
}

/** What the pointer is over: a 3D mark or an event pin. */
type Hover = { mark: Mark } | { pin: HistEvent; label: Label };

export interface Layers {
  territory: boolean; places: boolean; events: boolean; models: boolean;
  /** administrative divisions of the period (郡 / 州 / 府 / 道 / 路 / 省) */
  admin: boolean;
  /** modern provincial boundaries for reference */
  modern: boolean;
  /** walls, canals, roads and sea routes */
  works: boolean;
  /** the previous phase's borders as a dashed outline */
  ghost: boolean;
}

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
  shapes: ShapeStore | null = null;
  private paintKey = '';
  private worksKey = '';
  year: Year = -221;
  lang: Lang = 'zh';
  layers: Layers = { territory: true, places: true, events: true, models: true, admin: false, modern: false, works: true, ghost: true };
  snapshot: Snapshot | null = null;
  selected: HistEvent | null = null;
  /** when set, map clicks report lon/lat (quiz "where" questions) instead of selecting */
  pickHandler: ((lon: number, lat: number) => void) | null = null;
  onPin: (e: HistEvent) => void = () => {};
  onPlace: (p: Place) => void = () => {};
  onPerson: (p: Person) => void = () => {};
  onLife: (l: LifeItem) => void = () => {};
  /** hover over the map: the administrative unit under the pointer (admin layer only) */
  onHover: (info: { unit: AdminUnit; x: number; y: number } | null) => void = () => {};
  private pins = new Map<string, Label>();
  private placeLabels = new Map<string, Label>();
  private polityLabels: Label[] = [];
  private fade: { t: number; tex: THREE.Texture; wipe?: { dur: number; r: number } } | null = null;
  private texA: THREE.Texture | null = null;
  private capitalKey = '';
  private sceneryKey = '';
  /** the dynasty's landmark models by event id (hidden while that event's own model is up) */
  private sceneryMarks = new Map<string, THREE.Object3D>();
  private storyMode = false;
  private marks: Mark[] = [];
  private hover: Hover | null = null;
  /** the map object whose card is open (gets the selection ring) */
  private selKey: string | null = null;
  private hoverHalo!: Halo;
  private selHalo!: Halo;
  private tip!: HTMLElement;
  private overCanvas = false;
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
    const [hm, shapes] = await Promise.all([
      loadHeightmap(import.meta.env.BASE_URL + this.geo.stage.terrain),
      ShapeStore.load(import.meta.env.BASE_URL + 'data/atlas/shapes.json'),
    ]);
    this.shapes = shapes;
    this.geo.setHeightmap(hm.rgba, hm.w, hm.h);
    const canvas = document.createElement('canvas');
    canvas.className = 'gl';
    this.host.append(canvas);
    this.view = new View(canvas, this.geo, this.lowfx);
    this.labels = new Labels(this.view, this.host);
    this.terrain = buildTerrain(this.geo, this.lowfx);
    this.view.scene.add(this.terrain.mesh);
    this.painter = new TerritoryPainter(this.geo, this.lowfx ? 1536 : 3072);
    this.fx = new Fx(this.view, this.geo, this.labels);
    this.view.jump(this.geo.stage.home);
    this.hoverHalo = new Halo(this.geo, '#22c3e6', '#7fe3ff', 6);
    this.selHalo = new Halo(this.geo, '#e0402f', '#ffc23a', 3.2);
    this.view.scene.add(this.hoverHalo.obj, this.selHalo.obj);
    this.tip = document.createElement('div');
    this.tip.className = 'maptip';
    this.tip.hidden = true;
    this.tip.innerHTML = '<span class="ic"></span><b></b><small></small>';
    this.host.append(this.tip);
    this.view.onFrame((dt, t) => this.frame(dt, t));
    this.bindPointer(canvas);
    this.buildPlaces();
    this.buildRivers();
    this.setYear(year, true);
  }

  private frame(dt: number, t: number): void {
    const u = this.terrain.uniforms;
    u.uTime.value = t;
    (u.uCam.value as THREE.Vector3).copy(this.view.camera.position);
    if (this.fade?.wipe) {
      const w = this.fade.wipe;
      if (!this.fx.paused) this.fade.t = Math.min(1, this.fade.t + (dt * this.fx.speed) / w.dur);
      const k = this.fade.t;
      (u.uWipe.value as THREE.Vector4).z = w.r * (1 - Math.pow(1 - k, 2));
      if (k >= 1) this.finishFade();
    } else if (this.fade) {
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
    this.frameMarks(dt, t);
  }

  // ------------------------------------------------------------ hover & selection of map objects

  private static live(m: Mark): boolean {
    if (!m.g.parent || !(m.g.userData as SpawnState).shown) return false;
    for (let o: THREE.Object3D | null = m.g; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  /** Halos, hover growth and the tooltip follow their objects every frame (models grow as the camera zooms). */
  private frameMarks(dt: number, t: number): void {
    const h = this.hover;
    if (h && 'mark' in h && (!Atlas.live(h.mark) || this.storyMode)) this.setHover(null);
    else if (h && 'pin' in h && (!h.label.shown || !h.label.el.isConnected)) this.setHover(null);
    const minR = this.fx.s * 0.42;
    const v = new THREE.Vector3();
    const hv = this.hover;
    if (hv) {
      let lift = 0;
      if ('mark' in hv) {
        const ud = hv.mark.g.userData as SpawnState;
        this.hoverHalo.place(hv.mark.g.position.x, hv.mark.g.position.z, Math.max(minR, ud.rad * 1.8));
        v.copy(hv.mark.g.position);
        v.y += ud.top;
      } else {
        v.copy(hv.label.pos);
        this.hoverHalo.place(v.x, v.z, minR * 0.8);
        lift = hv.label.el.offsetHeight;
      }
      const p = this.view.project(v, v);
      this.tip.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - lift - 10)}px) translate(-50%, -100%)`;
    }
    this.hoverHalo.on = !!hv && !this.storyMode;
    // the selection ring sits under the open card's object, or at the selected event's spot
    const sm = this.selKey ? this.marks.find(m => m.key === this.selKey && Atlas.live(m)) : undefined;
    if (sm) {
      const ud = sm.g.userData as SpawnState;
      this.selHalo.place(sm.g.position.x, sm.g.position.z, Math.max(minR, ud.rad * 2));
    } else if (this.selected && this.selKey === `event:${this.selected.id}`) {
      const p = this.geo.pos(this.selected.lon, this.selected.lat, 0, v);
      this.selHalo.place(p.x, p.z, minR * 0.9);
    }
    this.selHalo.on = !this.storyMode && !this.pickHandler && (!!sm || (!!this.selected && this.selKey === `event:${this.selected.id}`));
    this.hoverHalo.tick(dt, t);
    this.selHalo.tick(dt, t);
  }

  private setHover(h: Hover | null): void {
    const old = this.hover;
    const same = (a: Hover | null, b: Hover | null) => (a && b && 'mark' in a && 'mark' in b ? a.mark === b.mark : a && b && 'pin' in a && 'pin' in b ? a.pin === b.pin : a === b);
    if (same(old, h)) return;
    if (old && 'mark' in old) (old.mark.g.userData as SpawnState).boost = 1;
    if (old && 'pin' in old) old.label.el.classList.remove('hot');
    this.hover = h;
    this.view.canvas.style.cursor = h && 'mark' in h ? 'pointer' : '';
    if (!h) { this.tip.hidden = true; return; }
    let icon: string, title: string, sub: string;
    if ('mark' in h) {
      (h.mark.g.userData as SpawnState).boost = 1.18;
      ({ title, sub } = h.mark.info());
      icon = h.mark.icon;
    } else {
      h.label.el.classList.add('hot');
      icon = h.pin.kind;
      title = tr(h.pin.title, this.lang);
      sub = this.eventSub(h.pin);
    }
    this.tip.className = `maptip k-${icon}`;
    const [ic, b, small] = this.tip.children as unknown as HTMLElement[];
    ic.innerHTML = glyph(icon);
    b.textContent = title;
    small.textContent = sub;
    small.hidden = !sub;
    this.tip.hidden = false;
  }

  private eventSub(e: HistEvent): string {
    return `${formatYear(e.year, this.lang, { short: true })} · ${kindName(e.kind)}`;
  }

  /** The map object under a screen point: nearest model whose upright extent passes within reach of the pointer. */
  private pickMark(cx: number, cy: number): Mark | null {
    if (this.storyMode || this.pickHandler || !this.layers.models) return null;
    const r = this.view.canvas.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    let best: Mark | null = null, bk = 1, bz = Infinity;
    for (const m of this.marks) {
      if (!Atlas.live(m)) continue;
      const ud = m.g.userData as SpawnState;
      a.copy(m.g.position);
      b.copy(a); b.y += ud.top;
      this.view.project(a, a);
      this.view.project(b, b);
      if (a.z > 1 || b.z > 1) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const u = THREE.MathUtils.clamp(((x - a.x) * dx + (y - a.y) * dy) / len2, 0, 1);
      const d = Math.hypot(a.x + dx * u - x, a.y + dy * u - y);
      const reach = Math.max(14, Math.sqrt(len2) * 0.42);
      const k = d / reach;
      // overlapping hits: prefer the nearer model to the camera
      if (k < 1 && (k < bk - 0.25 || (k < bk + 0.25 && a.z < bz))) { best = m; bk = k; bz = a.z; }
    }
    return best;
  }

  private addMark(m: Mark): void {
    this.marks = this.marks.filter(x => x.g.parent && x.g !== m.g);
    this.marks.push(m);
  }

  /** Puts the selection ring under a map object (`life:<id>`, `person:<id>`, ...) or clears it. */
  focus(key: string | null): void {
    this.selKey = key;
  }

  // ------------------------------------------------------------ input

  private bindPointer(canvas: HTMLCanvasElement): void {
    let down: { x: number; y: number; t: number } | null = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 700;
      down = null;
      if (moved > 6 || !quick) return;
      const ll = this.view.pick(e.clientX, e.clientY);
      if (!ll) return;
      if (this.pickHandler) { this.pickHandler(ll[0], ll[1]); return; }
      // a model under the pointer opens its card; otherwise a click near a pin selects it (pins are small on touch)
      const mark = this.pickMark(e.clientX, e.clientY);
      if (mark) { this.setHover(null); mark.open(); return; }
      const near = this.nearestPin(e.clientX, e.clientY);
      if (near) this.onPin(near);
    });
    let pending = false;
    let last = { x: 0, y: 0 };
    canvas.addEventListener('pointerenter', () => { this.overCanvas = true; });
    canvas.addEventListener('pointermove', e => {
      this.overCanvas = true;
      if (e.buttons || e.pointerType === 'touch') { if (this.hover) this.setHover(null); return; }
      last = { x: e.clientX, y: e.clientY };
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!this.overCanvas) return;
        const m = this.pickMark(last.x, last.y);
        this.setHover(m ? { mark: m } : null);
        const ll = !m && this.layers.admin ? this.view.pick(last.x, last.y) : null;
        const unit = ll ? this.adminAt(ll[0], ll[1]) : null;
        this.onHover(unit ? { unit, x: last.x, y: last.y } : null);
      });
    });
    canvas.addEventListener('pointerleave', () => {
      this.overCanvas = false;
      this.onHover(null);
      if (this.hover && 'mark' in this.hover) this.setHover(null);
    });
  }

  /** The finest administrative unit of the current snapshot containing lon/lat. */
  adminAt(lon: number, lat: number): AdminUnit | null {
    let best: AdminUnit | null = null;
    for (const a of this.snapshot?.admin ?? []) {
      if ((!best || a.level > best.level) && inside(a.rings, lon, lat)) best = a;
    }
    return best;
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
    this.fx.year = y;
    const snap = snapshotAt(y);
    this.shapes?.hydrate(snap);
    const lakes = this.shapes?.lakes(y) ?? [];
    // the previous phase's borders as a dashed outline, so the change is visible
    const ghost = this.layers.ghost && this.layers.territory ? previousSnap(snap) : null;
    if (ghost) this.shapes?.hydrate(ghost);
    const key = [snap?.id, ghost?.id, lakes.length, lakes.map(l => l.from).join(), this.layers.admin, this.layers.modern].join('|');
    if (key !== this.paintKey || !this.texA) {
      const snapChanged = snap?.id !== this.snapshot?.id;
      this.paintKey = key;
      this.snapshot = snap;
      const tex = texture(this.painter.paint(snap, {
        admin: this.layers.admin, provinces: this.layers.modern ? this.shapes?.provinces() : null, lakes, ghost,
      }));
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
      if (snapChanged || !this.polityLabels.length) { this.buildPolityLabels(); this.buildAdminLabels(); }
    }
    this.updatePlaces();
    this.updateWorks();
    const era = eraAt(y);
    // chronicle entries follow the year in steps; textbook events follow the era
    const pinKey = `${era?.id ?? ''}|${Math.round(y / CHRONICLE_STEP)}`;
    if (pinKey !== this.eraId) {
      this.eraId = pinKey;
      this.buildPins();
    }
    this.updateCapital();
  }

  /**
   * Moves to `y` with the new map spreading outwards from lon/lat like a conquest (or a revolution) instead of a
   * cross-fade. Resolves when the front has swept the whole stage.
   */
  wipeTo(y: Year, lon: number, lat: number, dur = 3, color = '#c0392b'): Promise<void> {
    this.finishFade();
    this.setYear(y);
    if (!this.fade) return Promise.resolve();
    const u = this.terrain.uniforms;
    const c = this.geo.pos(lon, lat, 0);
    const r = Math.hypot(Math.max(Math.abs(c.x - this.geo.width / 2), Math.abs(c.x + this.geo.width / 2)), Math.max(Math.abs(c.z - this.geo.depth / 2), Math.abs(c.z + this.geo.depth / 2)));
    (u.uWipe.value as THREE.Vector4).set(c.x, c.z, 0, 1);
    (u.uWipeColor.value as THREE.Color).setStyle(color, THREE.LinearSRGBColorSpace);
    // the visible part of the map is covered well before the far corners
    this.fade.wipe = { dur, r: Math.min(r, 60) };
    const f = this.fade;
    return new Promise(done => {
      const check = () => (this.fade === f ? requestAnimationFrame(check) : done());
      check();
    });
  }

  private finishFade(): void {
    if (!this.fade) return;
    (this.terrain.uniforms.uWipe.value as THREE.Vector4).set(0, 0, 0, 0);
    this.texA?.dispose();
    this.texA = this.fade.tex;
    this.terrain.uniforms.uTerrA.value = this.texA;
    this.terrain.uniforms.uMix.value = 0;
    this.fade = null;
  }

  /** Pulses a polity's area for `dur` seconds. */
  highlight(polity: string, dur = 3, color?: string): void {
    if (!this.snapshot || !this.snapshot.regions.some(r => polityMatches(r.polity, polity))) return;
    this.hiTex?.dispose();
    this.hiTex = texture(this.painter.mask(this.snapshot, polity));
    const u = this.terrain.uniforms;
    u.uHi.value = this.hiTex;
    (u.uHiColor.value as THREE.Color).set(color ?? '#fff3b0');
    this.hiT = 0;
    this.hiDur = dur;
  }

  /** Holds a polity highlighted (legend hover) until released with null. */
  hold(polity: string | null, color?: string): void {
    if (polity) { this.highlight(polity, 1e9, color); return; }
    if (this.hiT >= 0 && this.hiDur > 1e8) this.hiDur = this.hiT;
  }

  /** Frames a polity's regions in the current snapshot. */
  flyToPolity(polity: string): void {
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    for (const r of this.snapshot?.regions ?? []) {
      if (!polityMatches(r.polity, polity)) continue;
      for (const ring of r.rings) for (const [lon, lat] of ring) {
        if (!this.geo.inBounds(lon, lat)) continue;
        w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat);
      }
    }
    if (!isFinite(w)) return;
    const a = this.geo.pos(w, s, 0), b = this.geo.pos(e, n, 0);
    const span = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z) * 1.4);
    this.flyTo({ lon: (w + e) / 2, lat: (s + n) / 2 - (n - s) * 0.12, dist: Math.max(10, Math.min(120, span * 1.25)), tilt: 0.85 }, 1.6);
    this.highlight(polity, 2.5);
  }

  // ------------------------------------------------------------ labels

  private buildPlaces(): void {
    for (const p of PLACES) {
      if (p.scope !== 'china') continue;
      const el = document.createElement('div');
      el.className = `place k-${p.kind} t${p.tier}` + (p.minor ? ' minor' : '');
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        // while answering a "where" question a label is just part of the map: pick the point under the pointer
        if (this.pickHandler) { const ll = this.view.pick(ev.clientX, ev.clientY); if (ll) this.pickHandler(ll[0], ll[1]); return; }
        this.onPlace(p);
      });
      const l = this.labels.add({
        el, pos: this.geo.pos(p.lon, p.lat, 0.05), group: 'places',
        prio: p.tier === 1 ? 40 : p.tier === 2 ? 22 : 8,
        maxD: p.tier === 1 ? Infinity : p.tier === 2 ? 48 : 20,
      });
      this.placeLabels.set(p.id, l);
    }
  }

  private buildRivers(): void {
    for (const r of RIVER_LABELS) {
      if (!this.geo.inBounds(r.lon, r.lat)) continue;
      const el = document.createElement('div');
      el.className = `river k-${r.kind}`;
      el.dataset.zh = r.name.zh;
      el.dataset.en = r.name.en;
      el.textContent = tr(r.name, this.lang);
      this.labels.add({ el, pos: this.geo.pos(r.lon, r.lat, 0.03), group: 'rivers', prio: r.kind === 'trunk' ? 18 : 6, maxD: r.kind === 'trunk' ? 90 : 30 });
    }
  }

  /** Labels of the period's administrative divisions (admin layer). */
  private buildAdminLabels(): void {
    this.labels.clear('admin');
    for (const a of this.snapshot?.admin ?? []) {
      const at = a.anchor ?? regionAnchor({ polity: '', rings: a.rings }, this.geo.kx);
      const [lon, lat] = Array.isArray(at) ? at : [at.lon, at.lat];
      if (!this.geo.inBounds(lon, lat)) continue;
      const el = document.createElement('div');
      el.className = `admin l${a.level}`;
      el.textContent = tr(a.name, this.lang);
      this.labels.add({ el, pos: this.geo.pos(lon, lat, 0.06), group: 'admin', prio: a.level === 1 ? 20 : 9, maxD: a.level === 1 ? 50 : 22 });
    }
    this.labels.setGroupVisible('admin', this.layers.admin);
  }

  /** Walls, canals, roads and sea routes in use in the current year. */
  private updateWorks(): void {
    const on = WORKS.filter(w => this.layers.works && this.year >= w.span[0] && this.year <= w.span[1]);
    const key = on.map(w => w.id).join() + this.lang;
    if (key === this.worksKey) return;
    this.worksKey = key;
    this.fx.clear('works');
    for (const w of on) this.fx.work({ lines: w.lines, kind: w.kind, label: tr(w.name, this.lang), labelAt: w.label ?? w.lines[0][Math.floor(w.lines[0].length / 2)] });
  }

  private updatePlaces(): void {
    for (const [id, l] of this.placeLabels) {
      const p = PLACE.get(id)!;
      const name = mapName(p, this.year);
      l.off = !name;
      if (!name) continue;
      const cap = isCapital(p, this.year);
      const text = tr(name, this.lang);
      if (l.el.dataset.text !== text || l.el.classList.contains('cap') !== cap) {
        l.el.dataset.text = text;
        l.el.textContent = text;
        l.el.classList.toggle('cap', cap);
        this.labels.remeasure();
      }
      l.prio = cap ? 70 : p.tier === 1 ? 40 : p.tier === 2 ? 22 : 8;
      l.maxD = cap ? Infinity : p.tier === 1 ? Infinity : p.tier === 2 ? 48 : p.minor ? 12 : 20;
    }
  }

  private buildPolityLabels(): void {
    this.labels.clear('polity');
    this.polityLabels = [];
    if (!this.snapshot) return;
    const best = new Map<string, { r: Region; a: ReturnType<typeof regionAnchor> }>();
    for (const r of this.snapshot.regions) {
      if (!POLITY.has(r.polity)) continue;
      const key = r.polity + (r.name ? tr(r.name, 'en') : '');
      const a = regionAnchor(r, this.geo.kx);
      const b = best.get(key);
      if (!b || a.area > b.a.area) best.set(key, { r, a });
    }
    for (const { r, a } of best.values()) {
      const pol = POLITY.get(r.polity)!;
      if (!this.geo.inBounds(a.lon, a.lat)) continue;
      const role = r.role ?? pol.role;
      if (role === 'neighbor' && a.area < 6) continue;
      const el = document.createElement('div');
      const size = a.area > 250 ? 'xl' : a.area > 60 ? 'l' : a.area > 12 ? 'm' : 's';
      el.className = `polity r-${role} s-${size}`;
      el.style.setProperty('--c', r.color ?? pol.color);
      el.dataset.polity = pol.id;
      el.textContent = tr(r.name ?? pol.name, this.lang);
      this.polityLabels.push(this.labels.add({
        el, pos: this.geo.pos(a.lon, a.lat, 0.25), group: 'polity',
        prio: 30 + Math.min(25, a.area / 10) + (role === 'main' ? 6 : role === 'neighbor' ? -12 : 0),
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
    const near = (e: HistEvent) => Math.abs(e.year - this.year) <= CHRONICLE_WINDOW || (e.end !== undefined && e.year <= this.year && e.end >= this.year);
    const list = EVENTS.filter(e => e.scope === 'china' && (era ? e.year >= era.start && e.year <= era.end : false) && (e.source !== 'jiangshan' || near(e)));
    if (this.selected && !list.includes(this.selected)) list.push(this.selected);
    for (const e of list) this.addPin(e);
    this.labels.setGroupVisible('pins', this.layers.events && !this.pickHandler);
  }

  private addPin(e: HistEvent): void {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pin w${e.weight} k-${e.kind}` + (this.selected?.id === e.id ? ' sel' : '');
    el.dataset.id = e.id;
    // an icon badge of the event's kind; the title shows in the map tooltip on hover (and stays open when selected)
    el.innerHTML = `<span class="b">${glyph(e.kind)}<span class="t"></span></span><i></i>`;
    el.querySelector('.t')!.textContent = tr(e.title, this.lang);
    el.setAttribute('aria-label', tr(e.title, this.lang));
    el.addEventListener('click', ev => { ev.stopPropagation(); this.setHover(null); this.onPin(e); });
    const enter = () => { if (!this.storyMode && !el.classList.contains('sel')) this.setHover({ pin: e, label: this.pins.get(e.id)! }); };
    const leave = () => { if (this.hover && 'pin' in this.hover && this.hover.pin === e) this.setHover(null); };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focus', enter);
    el.addEventListener('blur', leave);
    const l = this.labels.add({
      el, pos: this.geo.pos(e.lon, e.lat, 0.02), group: 'pins', anchor: 'above',
      prio: 66 - e.weight * 10 - (e.source ? 4 : 0), maxD: e.weight === 1 ? Infinity : e.weight === 2 ? 75 : e.source ? 30 : 38,
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
      const eraName = era!.name;
      this.fx.spawn({ lon: cap.lon, lat: cap.lat, model: modern ? { kind: 'monument' } : { kind: 'palace' }, scale: 1.9, yaw: 0 }, 'base').then(g => {
        if (!g) return;
        this.addMark({
          key: `capital:${cap.id}`, g, icon: 'capital', open: () => this.onPlace(cap),
          info: () => ({ title: tr(mapName(cap, this.year) ?? cap.name, this.lang), sub: `${ui('capitalNow')} · ${tr(eraName, this.lang)}` }),
        });
      });
    }
    this.updateScenery();
  }

  /**
   * The dynasty on the map: its curated people, buildings, customs and foods, then landmarks of its key events and
   * more of its people in period dress (see sceneryOf). Detail (tier 2) items only stand up once zoomed in.
   */
  private updateScenery(): void {
    const era = eraAt(this.year);
    const key = this.layers.models && era ? `${era.id}:${this.lang}` : '';
    if (key === this.sceneryKey) return;
    this.sceneryKey = key;
    this.fx.clear('scenery');
    this.sceneryMarks.clear();
    if (!era || !key) return;
    // models carry no name plates: hovering one shows its name in the map tooltip, clicking opens its card
    for (const s of sceneryOf(era)) {
      const p = s.person, l = s.life;
      const ev = !p && !l && s.event ? EVENTS.find(x => x.id === s.event) : undefined;
      const minor = s.tier === 2;
      const scale = s.kind === 'person' ? 2.1 : s.kind === 'food' ? 1.5 : s.kind === 'custom' ? 1.6 : 1.7;
      this.fx.spawn({ lon: s.lon, lat: s.lat, model: s.model, scale, yaw: s.yaw, maxD: minor ? 32 : undefined }, 'scenery').then(g => {
        if (!g || this.sceneryKey !== key) return;
        if (l) {
          this.addMark({
            key: `life:${l.id}`, g, icon: l.kind, open: () => this.onLife(l),
            info: () => ({ title: tr(l.name, this.lang), sub: l.kind === 'person' && l.person ? tr(l.person.title, this.lang) : `${ui(l.kind)} · ${tr(era.name, this.lang)}` }),
          });
        } else if (p) {
          this.addMark({ key: `person:${p.id}`, g, icon: 'person', open: () => this.onPerson(p), info: () => ({ title: tr(p.name, this.lang), sub: tr(p.title, this.lang) }) });
        } else if (ev) {
          this.addMark({ key: `event:${ev.id}`, g, icon: ev.kind, open: () => this.onPin(ev), info: () => ({ title: tr(ev.title, this.lang), sub: this.eventSub(ev) }) });
        }
        // only a landmark steps aside for its event's own model; people stand apart and stay
        if (s.kind !== 'landmark' || !s.event) return;
        this.sceneryMarks.set(s.event, g);
        this.syncScenery();
      });
    }
  }

  private syncScenery(): void {
    for (const [id, g] of this.sceneryMarks) g.visible = !this.storyMode && !(this.selected?.id === id && this.layers.models && this.selected.model);
  }

  /** While a story plays the dynasty's scenery steps aside so the animation has the stage. */
  setStoryMode(on: boolean): void {
    if (on === this.storyMode) return;
    this.storyMode = on;
    if (on) this.setHover(null);
    this.fx.showLayer('scenery', !on);
    this.syncScenery();
  }

  // ------------------------------------------------------------ selection

  /** Selects an event: highlights its pin, raises its model and (optionally) flies there. */
  select(e: HistEvent | null, fly = true): void {
    const prev = this.selected;
    this.selected = e;
    this.selKey = e ? `event:${e.id}` : null;
    if (this.hover && 'pin' in this.hover && this.hover.pin === e) this.setHover(null);
    this.fx.clear('event');
    if (prev) { const l = this.pins.get(prev.id); if (l) { l.pinned = false; l.el.classList.remove('sel'); } }
    this.syncScenery();
    if (!e) return;
    if (!this.pins.has(e.id)) this.addPin(e);
    const l = this.pins.get(e.id)!;
    l.pinned = true;
    l.el.classList.add('sel');
    if (this.layers.models && e.model) {
      this.fx.spawn({ lon: e.lon, lat: e.lat, model: e.model }, 'event').then(g => {
        if (g) this.addMark({ key: `event:${e.id}`, g, icon: e.kind, open: () => this.onPin(e), info: () => ({ title: tr(e.title, this.lang), sub: this.eventSub(e) }) });
      });
    }
    this.fx.ring(this.geo.pos(e.lon, e.lat, 0.02), '#ffd76a', 1.2, 'event');
    if (fly) this.view.flyTo({ lon: e.lon, lat: e.lat - 1.2, dist: Math.min(this.view.pose().dist, 26), tilt: 0.85 }, 1.6);
  }

  // ------------------------------------------------------------ settings

  setLang(l: Lang): void {
    this.lang = l;
    for (const [id, lab] of this.pins) {
      const e = EVENTS.find(x => x.id === id);
      if (e) { lab.el.querySelector('.t')!.textContent = tr(e.title, l); lab.el.setAttribute('aria-label', tr(e.title, l)); }
    }
    for (const lab of this.placeLabels.values()) lab.el.dataset.text = '';
    this.updatePlaces();
    this.buildPolityLabels();
    this.buildAdminLabels();
    for (const el of this.labels.root.querySelectorAll<HTMLElement>('.river')) el.textContent = el.dataset[l] ?? '';
    this.updateWorks();
    this.updateScenery();
    this.labels.remeasure();
  }

  setLayer(k: keyof Layers, on: boolean): void {
    this.layers[k] = on;
    if (k === 'territory') {
      this.terrain.uniforms.uTerrOn.value = on ? 1 : 0;
      this.labels.setGroupVisible('polity', on);
    }
    if (k === 'places') { this.labels.setGroupVisible('places', on); this.labels.setGroupVisible('rivers', on); }
    if (k === 'admin' || k === 'modern' || k === 'ghost') { this.setYear(this.year, true); this.labels.setGroupVisible('admin', this.layers.admin); if (!this.layers.admin) this.onHover(null); }
    if (k === 'works') this.updateWorks();
    if (k === 'events') this.labels.setGroupVisible('pins', on && !this.pickHandler);
    if (k === 'models') { this.capitalKey = '-'; this.updateCapital(); if (!on) this.fx.clear('event'); }
  }

  /** Map style: terrain palette, sky and (via the root's data-map attribute) label colours. */
  setSurface(s: Surface): void {
    const k = SURFACE[s] ?? SURFACE.ink;
    const u = this.terrain.uniforms;
    u.uStyle.value = k.style;
    (u.uHaze.value as THREE.Color).copy(k.haze);
    this.view.setSky(k.haze, k.top);
    document.documentElement.dataset.map = s;
  }

  /** Routes the next map click to `fn`; `blind` also hides place names so they cannot give the answer away. */
  setPickMode(fn: ((lon: number, lat: number) => void) | null, blind = false): void {
    this.pickHandler = fn;
    if (fn) this.setHover(null);
    this.labels.setGroupVisible('pins', this.layers.events && !fn);
    this.labels.setGroupVisible('places', this.layers.places && !(fn && blind));
    this.labels.setGroupVisible('admin', this.layers.admin && !(fn && blind));
    this.host.classList.toggle('picking', !!fn);
  }

  home(): Promise<void> {
    return this.view.flyTo(this.geo.stage.home, 1.6);
  }

  flyTo(p: CamPose, dur?: number): Promise<void> {
    return this.view.flyTo(p, dur);
  }
}

/** Chronicle (imported) events are pinned within ±CHRONICLE_WINDOW years, re-evaluated every CHRONICLE_STEP years. */
const CHRONICLE_WINDOW = 12, CHRONICLE_STEP = 6;

/** Even-odd point-in-polygon over all rings (holes included). */
function inside(rings: LonLat[][], x: number, y: number): boolean {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
