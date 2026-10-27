import * as THREE from 'three';
import { formatArea, polityArea } from '../../shared/data/areas.ts';
import { ERAS } from '../../shared/data/eras.ts';
import { EVENTS } from '../../shared/data/events.ts';
import { tr, type Lang } from '../../shared/data/i18n.ts';
import { RIVER_LABELS, WORKS, type Person, type RiverLabel } from '../../shared/data/jiangshan.ts';
import { PLACE, PLACES, isCapital, mapName, riverName } from '../../shared/data/places.ts';
import { lifeEvent, lifePlace, sceneryOf, type Level } from '../../shared/data/scenery.ts';
import type { LifeItem } from '../../shared/data/life.ts';
import { POLITY, polityMatches } from '../../shared/data/polities.ts';
import { capitalModel } from '../../shared/data/heroes.ts';
import { STAGES, type StageId } from '../../shared/data/stage.ts';
import { snapshotAt } from '../../shared/data/territories.ts';
import { previousSnap } from '../../shared/lib/chronicle.ts';
import type { AdminUnit, Era, HistEvent, LonLat, ModelRecipe, Place, Region, Snapshot, Year } from '../../shared/data/types.ts';
import { eraAt, formatYear } from '../../shared/lib/timeline.ts';
import { kindName, t as ui } from '../lib/i18n.ts';
import { loadHeroesFor } from '../models/heroes/index.ts';
import { cancelByTag, prefetchEraModels, prunePrototypes } from '../models/library.ts';
import { glyph } from '../ui/icons.ts';
import { Fx, type SpawnState } from './fx.ts';
import { Beam, Halo } from './halo.ts';
import { Geo } from './geo.ts';
import { Labels, type Label } from './labels.ts';
import type { LayoutItem, ScreenBox } from './layout.ts';
import { buildTerrain, loadHeightmap, SURFACE, type Surface, type Terrain } from './terrain.ts';
import { TerrainDetail } from './detail.ts';
import { ShapeStore } from './shapes.ts';
import { TerritoryPainter, regionAnchor, texture, type PaintOpts } from './territory.ts';
import { TerritoryDetail } from './territory-detail.ts';
import { morphTexture } from './morph.ts';
import { View, type CamPose } from './view.ts';

interface MapTarget {
  key: string;
  icon: string;
  info: () => { title: string; sub: string };
  open: () => void;
  label: Label;
  g?: THREE.Object3D;
  nameLabel?: Label;
}

/** One object, with a compact form and an optional model; geographical names belong to that same object. */
interface Mark extends MapTarget {
  g: THREE.Object3D;
  layer: 'base' | 'scenery' | 'event';
  event?: string;
  place?: Place;
  aliases?: string[];
  prio: number;
  modelMaxD: number;
  maxD: number;
  modelForm?: boolean;
  layout?: LayoutItem;
}

/** A territory under the pointer: polity id (+ per-snapshot name), its colour, tooltip lines. */
interface PolityHit { key: string; color: string; title: string; sub: string }
type Hover = { target: MapTarget } | { area: AdminUnit; at: THREE.Vector3 } | { polity: PolityHit; at: THREE.Vector3 };

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
/** What a territory texture was painted from (the close-up detail repaints the same). */
interface TexSource { key: string; snap: Snapshot | null; opts: PaintOpts }

export class Atlas {
  geo: Geo;
  view!: View;
  labels!: Labels;
  fx!: Fx;
  terrain!: Terrain;
  private painter!: TerritoryPainter;
  private tdetail: TerritoryDetail | null = null;
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
  /** Reports dynasty-by-dynasty model streaming progress (`done / total` for `era`). */
  onEraProgress: (era: Era, done: number, total: number) => void = () => {};
  private pins = new Map<string, MapTarget>();
  private places = new Map<string, MapTarget>();
  private riverLabels: [RiverLabel, Label][] = [];
  private polityLabels: Label[] = [];
  private fade: { t: number; tex: THREE.Texture; src: TexSource; wipe?: { dur: number; r: number }; morph?: THREE.Texture } | null = null;
  private texA: THREE.Texture | null = null;
  private texCache = new Map<string, THREE.CanvasTexture>();
  private morphTex: THREE.Texture | null = null;
  private capitalKey = '';
  private sceneryKey = '';
  private lastSceneryEra = '';
  private prefetchTimer = 0;
  private storyMode = false;
  private layoutDirty = true;
  private marks: Mark[] = [];
  private hover: Hover | null = null;
  /** the map object whose card is open (gets the selection ring), and where to ring it while it has no model up */
  private selKey: string | null = null;
  private selAt: LonLat | null = null;
  private hoverHalo!: Halo;
  private selHalo!: Halo;
  private beam!: Beam;
  private tip!: HTMLElement;
  private overCanvas = false;
  /** where the mouse last really moved: a name sliding under a resting pointer fires pointerenter without it moving */
  private static ptr = { x: NaN, y: NaN };
  private static ptrBound = false;
  /** the camera's pose last frame and the frames since it last moved: hover waits until the map holds still */
  private camPos = new THREE.Vector3();
  private camQuat = new THREE.Quaternion();
  private camProj = -1;
  private camStill = Infinity;
  /** a keyboard-focused object whose tooltip waits for the map to stop */
  private focusWait: MapTarget | null = null;
  private raycaster = new THREE.Raycaster();
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
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    this.host.append(canvas, vignette);
    this.view = new View(canvas, this.geo, this.lowfx);
    this.labels = new Labels(this.view, this.host);
    this.terrain = buildTerrain(this.geo, this.lowfx);
    this.view.scene.add(this.terrain.mesh);
    if (!this.lowfx) new TerrainDetail(this.view, this.geo, this.terrain.uniforms);
    this.painter = new TerritoryPainter(this.geo, this.lowfx ? 1536 : 3072);
    if (!this.lowfx) this.tdetail = new TerritoryDetail(this.view, this.painter, this.terrain.uniforms);
    this.fx = new Fx(this.view, this.geo, this.labels);
    this.view.jump(this.geo.stage.home);
    this.hoverHalo = new Halo(this.geo, '#22c3e6');
    this.selHalo = new Halo(this.geo, '#e0402f');
    this.beam = new Beam(this.geo, '#e0402f');
    this.view.scene.add(this.hoverHalo.obj, this.selHalo.obj, this.beam.obj);
    this.tip = document.createElement('div');
    this.tip.className = 'maptip';
    this.tip.id = 'map-tooltip';
    this.tip.setAttribute('role', 'tooltip');
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
      this.fade.t = Math.min(1, this.fade.t + dt / (this.fade.morph ? 1.4 : 0.8));
      u.uMix.value = this.fade.t * this.fade.t * (3 - 2 * this.fade.t);
      if (this.fade.t >= 1) this.finishFade();
    }
    if (this.hiT >= 0) {
      this.hiT += dt;
      const fadeOut = Math.max(0, this.hiT - this.hiDur);
      u.uHiAmt.value = Math.max(0, (0.55 + 0.35 * Math.sin(this.hiT * 5)) * Math.min(1, this.hiT * 3) * (1 - fadeOut / 0.6));
      if (fadeOut >= 0.6) { this.hiT = -1; u.uHiAmt.value = 0; }
    }
    this.frameMarks(dt);
    if (this.layoutDirty || this.fx.boundsDirty || this.labels.dirtySize || this.camStill <= 1 || this.marks.some(m => !m.g.parent)) {
      this.layoutDirty = false;
      this.fx.boundsDirty = false;
      this.layoutMarks();
    }
  }

  // ------------------------------------------------------------ hover & selection of map objects

  private static live(m: MapTarget): boolean {
    if (!m.g?.parent || !(m.g.userData as SpawnState).shown) return false;
    for (let o: THREE.Object3D | null = m.g; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  private static onMap(m: MapTarget): boolean {
    return Atlas.live(m) || [m.label, m.nameLabel].some(l => l?.shown && l.el.isConnected);
  }

  private isSelected(m: MapTarget): boolean {
    return m.key === this.selKey || this.marks.some(mark => mark.key === m.key && mark.aliases?.includes(this.selKey ?? ''));
  }

  private resolveTarget(target: MapTarget): MapTarget {
    return this.marks.find(m => m.key === target.key && Atlas.onMap(m)) ?? target;
  }

  private bindTarget(target: MapTarget): void {
    const el = target.label.el;
    const enter = () => {
      if (!this.storyMode && !this.pickHandler) this.setHover({ target: this.resolveTarget(target) });
    };
    const focus = () => {
      this.focusWait = this.camMoving() ? target : null;
      enter();
    };
    const leave = () => {
      if (this.hover && 'target' in this.hover && this.hover.target.key === target.key) this.setHover(null);
    };
    if (!Atlas.ptrBound) {
      Atlas.ptrBound = true;
      window.addEventListener('pointermove', e => { Atlas.ptr.x = e.clientX; Atlas.ptr.y = e.clientY; }, { capture: true, passive: true });
    }
    // pointerenter precedes the pointermove of a real move, so a resting mouse still sits at the last recorded spot
    el.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse' && e.clientX === Atlas.ptr.x && e.clientY === Atlas.ptr.y) return;
      enter();
    });
    // a name that slid under a resting pointer while the map moved lights up on the next move
    el.addEventListener('pointermove', e => {
      if (!e.buttons && !(this.hover && 'target' in this.hover && this.hover.target.key === target.key)) enter();
    });
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focus', focus);
    el.addEventListener('blur', () => { if (this.focusWait === target) this.focusWait = null; leave(); });
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      if (this.pickHandler) {
        const ll = this.view.pick(ev.clientX, ev.clientY);
        if (ll) this.pickHandler(ll[0], ll[1]);
        return;
      }
      if (this.storyMode) return;
      this.setHover(null);
      this.resolveTarget(target).open();
    });
  }

  private boundVec = new THREE.Vector3();

  private modelBounds(m: Mark): ScreenBox | null {
    const ud = m.g.userData as SpawnState;
    // Include rotated scenery, its base and shadow, reserving hover growth without moving neighbours.
    const boost = 1.06 / ud.k;
    const b: ScreenBox = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const v = this.boundVec;
    let clipped = false;
    const addPt = () => {
      v.sub(m.g.position).multiplyScalar(boost).add(m.g.position);
      this.view.project(v, v);
      if (v.z < -1 || v.z > 1) clipped = true;
      if (v.x < b.left) b.left = v.x;
      if (v.x > b.right) b.right = v.x;
      if (v.y < b.top) b.top = v.y;
      if (v.y > b.bottom) b.bottom = v.y;
    };
    const mdl = ud.model;
    const min = mdl?.userData.min as [number, number, number] | undefined;
    const max = mdl?.userData.max as [number, number, number] | undefined;
    if (mdl && min && max) {
      m.g.updateWorldMatrix(true, false);
      mdl.updateWorldMatrix(false, false);
      const mw = mdl.matrixWorld;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]).applyMatrix4(mw);
        addPt();
      }
      const br = (ud.baseR ?? 0) * (ud.z ?? 1);
      if (br > 0) {
        const gp = m.g.position;
        for (let i = 0; i < 8; i++) {
          v.set(gp.x + (i & 1 ? br : -br), gp.y + (i & 2 ? 0.006 : 0), gp.z + (i & 4 ? br : -br));
          addPt();
        }
      }
    } else {
      m.g.updateWorldMatrix(true, true);
      m.g.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const box = o.geometry.boundingBox!;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          v.set(x, y, z).applyMatrix4(o.matrixWorld);
          addPt();
        }
      });
    }
    const canvas = this.view.canvas;
    return clipped || b.right < 0 || b.bottom < 0 || b.left > canvas.clientWidth || b.top > canvas.clientHeight ? null : b;
  }

  private layoutMarks(): void {
    for (const m of this.marks) if (!m.g.parent) this.labels.remove(m.label);
    this.marks = this.marks.filter(m => m.g.parent);
    for (const target of this.places.values()) {
      const l = target.label;
      l.model = undefined; l.screen = undefined; l.anchor = 'beside';
      l.pinned = this.isSelected(target);
    }
    const models: LayoutItem[] = [];
    const represented = new Set<string>();
    const available = (m: Mark) => this.layers.models && !this.pickHandler && (!this.storyMode || m.layer === 'base') &&
      (!m.place || !!mapName(m.place, this.year)) && (this.isSelected(m) || this.fx.dist <= m.maxD);
    const sceneryEvents = new Set<string>();
    for (const m of this.marks) if (m.layer === 'scenery' && m.event && available(m)) sceneryEvents.add(m.event);
    for (const m of this.marks) {
      const l = m.label, selected = this.isSelected(m);
      const replaced = m.layer === 'event' && !!m.event && sceneryEvents.has(m.event);
      const active = available(m) && !replaced;
      const wasModel = !!l.modelHit;
      if (m.modelForm === undefined) m.modelForm = this.fx.dist <= m.modelMaxD;
      else if (this.fx.dist > m.modelMaxD + 2) m.modelForm = false;
      else if (this.fx.dist < m.modelMaxD - 2) m.modelForm = true;
      const model = active && (selected || m.modelForm);
      l.modelHit = model;
      l.model = undefined; m.layout = undefined;
      l.pinned = selected;
      l.off = !active || (!model && !!m.place);
      l.pos.copy(m.g.position);
      if (model !== wasModel) {
        l.el.classList.toggle('model-hit', model);
        l.el.style.width = ''; l.el.style.height = '';
        l.tw = undefined; l.th = undefined;
        this.labels.remeasure();
      }
      setAttr(l.el, 'aria-pressed', selected ? 'true' : 'false');
      m.g.visible = false;
      if (active && m.event) represented.add(m.event);
      if (model) {
        const bounds = this.modelBounds(m);
        if (!bounds) { l.off = true; continue; }
        const entry: LayoutItem = { bounds, prio: m.prio, owner: m.key, pinned: selected };
        m.layout = l.model = entry;
        models.push(entry);
        if (m.nameLabel) {
          const name = m.nameLabel;
          name.model = entry; name.pinned = selected;
          name.pos.copy(m.g.position);
          name.screen = { x: (bounds.left + bounds.right) / 2, y: bounds.top - 6 };
          name.anchor = 'above';
        }
      }
    }
    for (const [id, target] of this.pins) {
      target.label.off = represented.has(id) || this.storyMode;
      target.label.pinned = this.isSelected(target);
      setAttr(target.label.el, 'aria-pressed', target.label.pinned ? 'true' : 'false');
    }
    for (const target of this.places.values()) {
      const l = target.label, modeled = !!l.model;
      if (l.el.classList.contains('modeled') !== modeled) {
        l.el.classList.toggle('modeled', modeled);
        this.labels.remeasure();
      }
    }
    this.labels.layout(models);
    const placeTi = this.pickHandler || this.storyMode ? -1 : 0;
    for (const m of this.marks) {
      m.g.visible = !!m.layout?.shown;
      const ti = placeTi < 0 || m.nameLabel?.shown ? -1 : 0;
      if (m.label.el.tabIndex !== ti) m.label.el.tabIndex = ti;
    }
    for (const target of this.places.values()) {
      if (target.label.el.tabIndex !== placeTi) target.label.el.tabIndex = placeTi;
      setAttr(target.label.el, 'aria-pressed', target.label.pinned ? 'true' : 'false');
    }
  }

  private camMoving(): boolean { return this.camStill === 0; }

  /** Halos, hover growth and the tooltip follow their objects every frame (models grow as the camera zooms). */
  private frameMarks(dt: number): void {
    // while the map moves (drag, inertia, zoom, flight) nothing is hovered: a tooltip or a lit name would ride along
    // with the map past a still pointer; hover returns once the map is still and the pointer moves
    // (damping leaves a sub-pixel tail for a long time: only motion over ~1/5000 of the view distance per frame counts)
    const cam = this.view.camera;
    const moved = this.view.projVersion !== this.camProj
      || cam.position.distanceTo(this.camPos) > cam.position.distanceTo(this.view.controls.target) * 2e-4
      || cam.quaternion.angleTo(this.camQuat) > 2e-4;
    this.camPos.copy(cam.position);
    this.camQuat.copy(cam.quaternion);
    this.camProj = this.view.projVersion;
    if (moved) {
      this.camStill = 0;
      const hv = this.hover;
      if (hv && 'target' in hv && document.activeElement === hv.target.label?.el) this.focusWait = hv.target;
      if (hv) this.setHover(null);
    } else if (this.camStill++ === 0 && this.focusWait) {
      const f = this.focusWait;
      this.focusWait = null;
      if (document.activeElement === f.label.el && !this.storyMode && !this.pickHandler) this.setHover({ target: this.resolveTarget(f) });
    }
    const h = this.hover;
    if (h && 'target' in h && (!Atlas.onMap(h.target) || this.storyMode || this.pickHandler)) this.setHover(null);
    const minR = this.fx.s * 0.42;
    const v = new THREE.Vector3();
    const hv = this.hover;
    if (hv) {
      let lift = 0;
      if ('target' in hv) {
        const m = hv.target;
        if (m.g && Atlas.live(m)) {
          const ud = m.g.userData as SpawnState;
          this.hoverHalo.place(m.g.position.x, m.g.position.z, Math.max(minR, ud.rad * 1.2));
          v.copy(m.g.position);
          v.y += ud.top + ud.rad * 0.5;
        } else {
          const l = m.nameLabel?.shown ? m.nameLabel : m.label;
          v.copy(l.pos);
          lift = l.anchor === 'above' ? l.el.offsetHeight : l.el.offsetHeight / 2;
        }
      } else v.copy(hv.at);
      const p = this.view.project(v, v);
      this.tip.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - lift - 10)}px) translate(-50%, -100%)`;
    }
    this.hoverHalo.on = !!hv && 'target' in hv && Atlas.live(hv.target) && !this.isSelected(hv.target) && !this.storyMode;
    // the selection ring sits under the open card's object, or at its spot on the map
    const sm = this.selKey ? this.marks.find(m => this.isSelected(m) && Atlas.onMap(m)) : undefined;
    const target = sm ?? (this.selKey ? [...this.places.values(), ...this.pins.values()].find(m => this.isSelected(m) && Atlas.onMap(m)) : undefined);
    if (sm && !Atlas.live(sm)) {
      this.selHalo.place(sm.label.pos.x, sm.label.pos.z, minR * 0.9);
    } else if (sm) {
      const ud = sm.g.userData as SpawnState;
      this.selHalo.place(sm.g.position.x, sm.g.position.z, Math.max(minR, ud.rad * 1.2));
    } else if (this.selAt) {
      const p = this.geo.pos(this.selAt[0], this.selAt[1], 0, v);
      this.selHalo.place(p.x, p.z, minR * 0.9);
    }
    this.selHalo.on = !this.storyMode && !this.pickHandler && (!target || Atlas.live(target)) && (!!sm || !!this.selAt);
    // an open event also gets a light over its ring
    this.beam.on = this.selHalo.on && !!this.selKey?.startsWith('event:');
    if (this.beam.on) this.beam.place(this.selHalo.obj.position.x, this.selHalo.obj.position.z, this.selHalo.radius);
    this.hoverHalo.tick(dt);
    this.selHalo.tick(dt);
    this.beam.tick(dt);
  }

  private setHover(h: Hover | null): void {
    if (h && this.camMoving()) return;
    const old = this.hover;
    const same = (a: Hover | null, b: Hover | null) => a && b && 'target' in a && 'target' in b ? a.target === b.target : a === b;
    if (old && h && 'at' in old && 'at' in h) old.at.copy(h.at);
    if (same(old, h) || (old && h && 'area' in old && 'area' in h && old.area === h.area)
      || (old && h && 'polity' in old && 'polity' in h && old.polity.key === h.polity.key)) return;
    if (old && 'target' in old) {
      if (old.target.g) (old.target.g.userData as SpawnState).boost = 1;
      for (const l of [old.target.label, old.target.nameLabel]) {
        l?.el.classList.remove('hot');
        l?.el.removeAttribute('aria-describedby');
      }
    }
    this.hover = h;
    this.view.canvas.style.cursor = h && 'target' in h ? 'pointer' : '';
    if (!h) { this.tip.hidden = true; return; }
    let icon: string, title: string, sub: string;
    if ('target' in h) {
      if (h.target.g) (h.target.g.userData as SpawnState).boost = 1.06;
      for (const l of [h.target.label, h.target.nameLabel]) {
        l?.el.classList.add('hot');
        l?.el.setAttribute('aria-describedby', this.tip.id);
      }
      ({ title, sub } = h.target.info());
      icon = h.target.icon;
    } else if ('area' in h) {
      icon = 'area';
      title = tr(h.area.name, this.lang);
      sub = h.area.category.zh ? tr(h.area.category, this.lang) : '';
    } else {
      icon = 'polity';
      ({ title, sub } = h.polity);
    }
    this.tip.className = `maptip k-${icon}`;
    const [ic, b, small] = this.tip.children as unknown as HTMLElement[];
    ic.innerHTML = icon === 'area' || icon === 'polity' ? '' : glyph(icon);
    ic.hidden = icon === 'area';
    ic.style.background = 'polity' in h ? h.polity.color : '';
    b.textContent = title;
    small.textContent = sub;
    small.hidden = !sub;
    this.tip.hidden = false;
  }

  private eventSub(e: HistEvent): string {
    return `${formatYear(e.year, this.lang, { short: true })} · ${kindName(e.kind)}`;
  }

  private pickVec = new THREE.Vector2();

  /** Hit the actual model, including wide, low landmarks rather than just their upright centre line. */
  private pickMark(cx: number, cy: number): Mark | null {
    if (this.storyMode || this.pickHandler || !this.layers.models) return null;
    const r = this.view.canvas.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    const marks = this.marks.filter(m => {
      if (!Atlas.live(m)) return false;
      const b = m.layout?.bounds;
      return !b || (x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 8 && y <= b.bottom + 8);
    });
    if (!marks.length) return null;
    for (const m of marks) m.g.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.pickVec.set((x / r.width) * 2 - 1, 1 - (y / r.height) * 2), this.view.camera);
    const hit = this.raycaster.intersectObjects(marks.map(m => m.g), true)[0];
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const mark = marks.find(m => m.g === o);
      if (mark) return mark;
    }
    return null;
  }

  private addMark(m: Mark): void {
    m.label.el.setAttribute('aria-label', m.info().title);
    m.nameLabel = m.place ? this.places.get(m.place.id)?.label : undefined;
    this.marks.push(m);
    this.bindTarget(m);
    this.layoutDirty = true;
  }

  private badge(key: string, icon: string, pos: THREE.Vector3, prio: number, group: string, maxD = Infinity): Label {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pin k-${icon}`;
    el.dataset.key = key;
    el.innerHTML = `<span class="b">${glyph(icon)}</span>`;
    return this.labels.add({ el, pos, prio, group, owner: key, maxD });
  }

  /** Puts the selection ring under a map object (`life:<id>`, `person:<id>`, ...), or at lon/lat while it has no model up; null clears it. */
  focus(key: string | null, at: LonLat | null = null): void {
    this.selKey = key;
    this.selAt = at;
    this.layoutDirty = true;
  }

  // ------------------------------------------------------------ input

  private bindPointer(canvas: HTMLCanvasElement): void {
    let down: { x: number; y: number; t: number } | null = null;
    // after a click opens something the tooltip stays away until the pointer really moves (a hover queued before the click must not bring it back)
    let mutedAt: { x: number; y: number } | null = null;
    const mute = (e: PointerEvent) => { mutedAt = { x: e.clientX, y: e.clientY }; this.setHover(null); };
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
      if (mark) { mute(e); mark.open(); return; }
      const near = this.nearestPin(e.clientX, e.clientY);
      if (near) { mute(e); near.open(); }
    });
    let pending = false;
    let last = { x: 0, y: 0 };
    canvas.addEventListener('pointerenter', () => { this.overCanvas = true; });
    canvas.addEventListener('pointermove', e => {
      this.overCanvas = true;
      if (e.buttons || e.pointerType === 'touch') { if (this.hover) this.setHover(null); return; }
      last = { x: e.clientX, y: e.clientY };
      if (mutedAt && Math.hypot(last.x - mutedAt.x, last.y - mutedAt.y) < 4) return;
      mutedAt = null;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!this.overCanvas || mutedAt) return;
        const m = this.pickMark(last.x, last.y);
        if (m) return this.setHover({ target: m });
        // over open land: the same tooltip names the administrative area (admin layer) or the polity under the pointer
        const ll = !this.storyMode && !this.pickHandler && (this.layers.admin || this.layers.territory) ? this.view.pick(last.x, last.y) : null;
        if (!ll) return this.setHover(null);
        const at = this.geo.pos(ll[0], ll[1], 0);
        const area = this.layers.admin ? this.adminAt(ll[0], ll[1]) : null;
        if (area) return this.setHover({ area, at });
        const polity = this.layers.territory ? this.polityAt(ll[0], ll[1]) : null;
        this.setHover(polity ? { polity, at } : null);
      });
    });
    canvas.addEventListener('pointerleave', () => {
      this.overCanvas = false;
      this.setHover(null);
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

  /** The polity painted on top at lon/lat in the current snapshot: name, role · area for the hover tooltip. */
  polityAt(lon: number, lat: number): PolityHit | null {
    const snap = this.snapshot;
    if (!snap) return null;
    for (let i = snap.regions.length - 1; i >= 0; i--) {
      const r = snap.regions[i];
      const hit = r.evenodd ? inside(r.rings, lon, lat) : r.rings.some(ring => inside([ring], lon, lat));
      if (!hit) continue;
      const p = POLITY.get(r.polity);
      if (!p) return null;
      const role = r.role ?? p.role;
      const roleKey = ({ main: 'roleMain', rival: 'roleRival', occupied: 'roleRival', protectorate: 'roleProt', neighbor: 'roleNeighbor' } as const)[role];
      const k = role === 'neighbor' ? 0 : polityArea(snap.id, p.id);
      const sub = [ui(roleKey), k ? formatArea(k, this.lang) : ''].filter(Boolean).join(' · ');
      return { key: snap.id + p.id + (r.name ? r.name.en : ''), color: r.color ?? p.color, title: tr(r.name ?? p.name, this.lang), sub };
    }
    return null;
  }

  private nearestPin(cx: number, cy: number): MapTarget | null {
    if (this.storyMode) return null;
    let best: MapTarget | null = null, bd = 10;
    for (const target of [...this.pins.values(), ...this.places.values(), ...this.marks]) {
      const l = target.label;
      if (!l.shown || l.modelHit) continue;
      const r = l.el.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - cx, 0, cx - r.right), Math.max(r.top - cy, 0, cy - r.bottom));
      if (d < bd) { bd = d; best = this.resolveTarget(target); }
    }
    return best;
  }

  // ------------------------------------------------------------ time

  private getTerritoryTexture(key: string, snap: Snapshot | null, opts: PaintOpts): THREE.CanvasTexture {
    const hit = this.texCache.get(key);
    if (hit) {
      this.texCache.delete(key);
      this.texCache.set(key, hit);
      return hit;
    }
    const tex = texture(this.painter.paint(snap, opts));
    this.texCache.set(key, tex);
    if (this.texCache.size > 6) {
      for (const [k, old] of this.texCache) {
        if (old !== this.texA && old !== this.fade?.tex) {
          this.texCache.delete(k);
          old.dispose();
          break;
        }
      }
    }
    return tex;
  }

  /** Moves the map to a year: territory snapshot, period names, capital and the events of the period. */
  setYear(y: Year, instant = false): void {
    this.year = y;
    this.fx.year = y;
    this.layoutDirty = true;
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
      const opts: PaintOpts = { admin: this.layers.admin, provinces: this.layers.modern ? this.shapes?.provinces() : null, lakes, ghost };
      const src: TexSource = { key, snap, opts };
      const tex = this.getTerritoryTexture(key, snap, opts);
      if (instant || !this.texA) {
        this.texA = tex;
        this.terrain.uniforms.uTerrA.value = tex;
        this.terrain.uniforms.uMix.value = 0;
        this.fade = null;
        this.tdetail?.source(key, snap, opts);
      } else {
        if (this.fade) this.finishFade();
        this.terrain.uniforms.uTerrB.value = tex;
        // a new phase grows from the old borders; a layer toggle just cross-fades
        const morph = snapChanged && this.texA.image instanceof HTMLCanvasElement ? morphTexture(this.texA.image, tex.image as HTMLCanvasElement) : null;
        if (morph) { this.morphTex?.dispose(); this.morphTex = morph; this.terrain.uniforms.uMorph.value = morph; }
        this.terrain.uniforms.uMorphOn.value = morph ? 1 : 0;
        this.fade = { t: 0, tex, src, morph: morph ?? undefined };
      }
      if (snapChanged || !this.polityLabels.length) { this.buildPolityLabels(); this.buildAdminLabels(); }
    }
    this.updatePlaces();
    this.updateRivers();
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
    this.terrain.uniforms.uMorphOn.value = 0;
    this.texA = this.fade.tex;
    this.terrain.uniforms.uTerrA.value = this.texA;
    this.terrain.uniforms.uMix.value = 0;
    const { key, snap, opts } = this.fade.src;
    this.tdetail?.source(key, snap, opts);
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
    this.flyTo({ lon: (w + e) / 2, lat: (s + n) / 2 - (n - s) * 0.08, dist: Math.max(10, Math.min(120, span * 1.2)), tilt: 0.6 }, 1.6);
    this.highlight(polity, 2.5);
  }

  // ------------------------------------------------------------ labels

  private buildPlaces(): void {
    for (const p of PLACES) {
      if (p.scope !== 'china') continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `place k-${p.kind} t${p.tier}` + (p.minor ? ' minor' : '');
      el.dataset.place = p.id;
      el.innerHTML = '<span class="b" aria-hidden="true"></span><span class="t"></span>';
      const l = this.labels.add({
        el, pos: this.geo.pos(p.lon, p.lat, 0.05), group: 'places',
        prio: p.tier === 1 ? 40 : p.tier === 2 ? 22 : 8,
        maxD: p.tier === 1 ? Infinity : p.tier === 2 ? 48 : 20,
        owner: `place:${p.id}`,
      });
      const target: MapTarget = {
        key: `place:${p.id}`, icon: 'place', label: l, open: () => this.onPlace(p),
        info: () => ({
          title: tr(mapName(p, this.year) ?? p.name, this.lang),
          sub: isCapital(p, this.year) ? ui('capitalNow') : p.lore ? tr(p.lore.tag, this.lang) : ui(p.kind === 'pass' ? 'pass' : 'place'),
        }),
      };
      this.places.set(p.id, target);
      this.bindTarget(target);
    }
  }

  private buildRivers(): void {
    for (const r of RIVER_LABELS) {
      if (!this.geo.inBounds(r.lon, r.lat)) continue;
      const el = document.createElement('div');
      el.className = `river k-${r.kind}`;
      this.riverLabels.push([r, this.labels.add({ el, pos: this.geo.pos(r.lon, r.lat, 0.03), group: 'rivers', prio: r.kind === 'trunk' ? 18 : 6, maxD: r.kind === 'trunk' ? 90 : 30 })]);
    }
  }

  /** River and lake names of the year: courses that existed, under the name then in use. */
  private updateRivers(): void {
    for (const [r, l] of this.riverLabels) {
      const name = riverName(r, this.year);
      l.off = !name;
      const text = name ? tr(name, this.lang) : '';
      if (name && l.el.textContent !== text) { l.el.textContent = text; this.labels.remeasure(l); }
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
    for (const [id, target] of this.places) {
      const l = target.label;
      const p = PLACE.get(id)!;
      const name = mapName(p, this.year);
      l.off = !name;
      if (!name) continue;
      const cap = isCapital(p, this.year);
      target.icon = cap ? 'capital' : 'place';
      const text = tr(name, this.lang);
      if (l.el.dataset.text !== text || l.el.classList.contains('cap') !== cap) {
        l.el.dataset.text = text;
        l.el.querySelector('.b')!.innerHTML = glyph(target.icon);
        l.el.querySelector('.t')!.textContent = text;
        l.el.setAttribute('aria-label', text);
        l.el.classList.toggle('cap', cap);
        this.labels.remeasure(l);
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
        primary: role === 'main',
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
    const key = `event:${e.id}`;
    const label = this.badge(key, e.kind, this.geo.pos(e.lon, e.lat, 0.02),
      66 - e.weight * 10 - (e.source ? 4 : 0), 'pins', e.weight === 1 ? Infinity : e.weight === 2 ? 75 : 38);
    label.el.dataset.id = e.id;
    label.el.setAttribute('aria-label', tr(e.title, this.lang));
    const target: MapTarget = { key, icon: e.kind, label, open: () => this.onPin(e), info: () => ({ title: tr(e.title, this.lang), sub: this.eventSub(e) }) };
    this.pins.set(e.id, target);
    this.bindTarget(target);
  }

  private updateCapital(): void {
    const era = eraAt(this.year);
    const cap = era?.capital ? PLACE.get(era.capital) : undefined;
    const key = this.layers.models && cap ? `${cap.id}:${era!.id}` : '';
    if (key !== this.capitalKey) {
      this.capitalKey = key;
      this.fx.clear('base');
      if (cap && key && era) {
        const capRecipe = capitalModel(era);
        void loadHeroesFor([capRecipe.hero]);
        this.fx.spawn({
          lon: cap.lon, lat: cap.lat, model: capRecipe, scale: 1.9, yaw: 0, ring: KIND_COLOR.capital,
          priority: 100, tag: `era:${era.id}`,
        }, 'base').then(g => {
          if (!g || this.capitalKey !== key) return;
          const target = this.places.get(cap.id)!;
          this.addMark({
            ...target, g, icon: 'capital', place: cap, layer: 'base', prio: 90, modelMaxD: Infinity, maxD: Infinity,
            label: this.badge(target.key, 'capital', g.position.clone(), 90, 'map-models'),
          });
        });
      }
    }
    this.updateScenery();
  }

  /**
   * Loads one dynasty at a time onto the map: cancels unstarted jobs from any superseded dynasty, streams the active
   * dynasty's models by importance tier (Level 1 overview landmarks first, then Level 2 & 3 detail), and once complete,
   * prunes cold prototypes and pre-warms the next chronological dynasty in the background.
   */
  private updateScenery(): void {
    const era = eraAt(this.year);
    const key = this.layers.models && era ? `${era.id}:${this.lang}` : '';
    if (key === this.sceneryKey) return;
    const prevEra = this.lastSceneryEra;
    this.sceneryKey = key;
    this.lastSceneryEra = era?.id ?? '';
    if (this.prefetchTimer) { clearTimeout(this.prefetchTimer); this.prefetchTimer = 0; }
    // Drop any unstarted worker builds from the previous dynasty or background prefetch
    cancelByTag('era:');
    cancelByTag('prefetch:');
    this.fx.clear('scenery');
    this.labels.clear('badges');
    if (!era || !key) return;
    const items = sceneryOf(era);
    const tag = `era:${era.id}`;
    // Pre-fetch all lazy hero chunks required by this single dynasty in parallel
    void loadHeroesFor(items.map(s => s.model.hero));
    // Subtle golden historical dust swirl over the new dynasty's capital when switching eras
    if (!this.lowfx && prevEra && prevEra !== era.id && era.capital) {
      const cap = PLACE.get(era.capital);
      if (cap) this.fx.dustOfAges(cap.lon, cap.lat, 11, 0.7);
    }
    const total = items.length;
    let done = 0;
    this.onEraProgress(era, 0, total);
    for (const s of items) {
      const p = s.person, l = s.life;
      const ev = !p && !l && s.event ? EVENTS.find(x => x.id === s.event) : undefined;
      const place = l ? lifePlace(l) : undefined;
      const scale = s.kind === 'person' ? 1.8 : s.kind === 'food' ? 1.3 : 1.5;
      const priority = s.level === 1 ? 85 : s.level === 2 ? 60 : 40;
      this.fx.spawn({ lon: s.lon, lat: s.lat, model: s.model, scale, yaw: s.yaw, ring: KIND_COLOR[s.kind], priority, tag }, 'scenery').then(g => {
        if (this.sceneryKey !== key) return;
        done++;
        this.onEraProgress(era, done, total);
        if (done === total) this.scheduleAdjacentEraPrefetch(era);
        if (!g) return;
        const twin = l ? lifeEvent(l) : undefined;
        let target: Omit<MapTarget, 'label'> | undefined;
        if (l) {
          target = {
            key: `life:${l.id}`, g, icon: l.kind, open: () => this.onLife(l),
            info: () => ({ title: tr(l.name, this.lang), sub: l.kind === 'person' && l.person ? tr(l.person.title, this.lang) : `${ui(l.kind)} · ${tr(era.name, this.lang)}` }),
          };
        } else if (p) {
          target = { key: `person:${p.id}`, g, icon: 'person', open: () => this.onPerson(p), info: () => ({ title: tr(p.name, this.lang), sub: tr(p.title, this.lang) }) };
        } else if (ev) {
          target = { key: `event:${ev.id}`, g, icon: ev.kind, open: () => this.onPin(ev), info: () => ({ title: tr(ev.title, this.lang), sub: this.eventSub(ev) }) };
        }
        if (!target) return;
        const alias = target.key;
        if (place) target = this.places.get(place.id)!;
        const event = s.kind === 'landmark' ? s.event : twin?.id;
        const prio = LEVEL_PRIORITY[s.level];
        this.addMark({
          ...target, g, place, event, layer: 'scenery', prio,
          aliases: [alias, ...(event ? [`event:${event}`] : [])],
          modelMaxD: s.level === 1 ? Infinity : ZOOM.model, maxD: s.level === 3 ? ZOOM.detail : Infinity,
          label: this.badge(target.key, target.icon, g.position.clone(), prio, 'badges'),
        });
      });
    }
  }

  /**
   * Once the current dynasty finishes loading, prunes cold prototypes from distant eras and pre-warms the next
   * chronological dynasty's primary models during idle time.
   */
  private scheduleAdjacentEraPrefetch(era: Era): void {
    const key = this.sceneryKey;
    this.prefetchTimer = window.setTimeout(() => {
      this.prefetchTimer = 0;
      if (this.sceneryKey !== key) return;
      const idx = ERAS.findIndex(e => e.id === era.id);
      if (idx < 0) return;
      const neighbors = [ERAS[idx], ERAS[idx + 1], ERAS[idx - 1]].filter((e): e is Era => !!e);
      const keep: ModelRecipe[] = [];
      for (const e of neighbors) {
        if (e.capital) keep.push(capitalModel(e));
        for (const s of sceneryOf(e)) keep.push(s.model);
      }
      prunePrototypes(keep);
      const nextEra = ERAS[idx + 1];
      if (nextEra) {
        const primary: ModelRecipe[] = [];
        if (nextEra.capital) primary.push(capitalModel(nextEra));
        for (const s of sceneryOf(nextEra)) if (s.level === 1) primary.push(s.model);
        void prefetchEraModels(primary, nextEra.id);
      }
    }, 650);
  }

  /** While a story plays the dynasty's scenery steps aside so the animation has the stage. */
  setStoryMode(on: boolean): void {
    if (on === this.storyMode) return;
    this.storyMode = on;
    this.layoutDirty = true;
    if (on) this.setHover(null);
    this.fx.showLayer('scenery', !on);
    this.labels.setGroupVisible('badges', !on && !this.pickHandler);
  }

  // ------------------------------------------------------------ selection

  /** Selects an event: lights its pin, raises its model (the pin then steps aside), rings it and (optionally) flies there. */
  select(e: HistEvent | null, fly = true): void {
    const prev = this.selected;
    this.selected = e;
    this.layoutDirty = true;
    this.focus(e ? `event:${e.id}` : null, e ? [e.lon, e.lat] : null);
    this.setHover(null);
    this.fx.clear('event');
    if (prev) { const l = this.pins.get(prev.id)?.label; if (l) l.pinned = false; }
    if (!e) return;
    if (!this.pins.has(e.id)) this.addPin(e);
    const l = this.pins.get(e.id)!.label;
    l.pinned = true;
    if (this.layers.models && e.model && !this.marks.some(m => m.g.parent && m.layer === 'scenery' && m.event === e.id)) {
      this.fx.spawn({ lon: e.lon, lat: e.lat, model: e.model, ring: KIND_COLOR.landmark }, 'event').then(g => {
        if (g) this.addMark({
          key: `event:${e.id}`, g, icon: e.kind, event: e.id, layer: 'event', prio: 80, modelMaxD: Infinity, maxD: Infinity,
          label: this.badge(`event:${e.id}`, e.kind, g.position.clone(), 80, 'map-models'),
          open: () => this.onPin(e), info: () => ({ title: tr(e.title, this.lang), sub: this.eventSub(e) }),
        });
      });
    }
    if (fly) this.view.flyTo({ lon: e.lon, lat: e.lat - 1.2, dist: Math.min(this.view.pose().dist, 26), tilt: 0.85 }, 1.6);
  }

  // ------------------------------------------------------------ settings

  setLang(l: Lang): void {
    this.setHover(null);
    this.lang = l;
    this.layoutDirty = true;
    for (const [id, target] of this.pins) {
      const e = EVENTS.find(x => x.id === id);
      if (e) target.label.el.setAttribute('aria-label', tr(e.title, l));
    }
    for (const target of this.places.values()) target.label.el.dataset.text = '';
    for (const m of this.marks) m.label.el.setAttribute('aria-label', m.info().title);
    this.updatePlaces();
    this.buildPolityLabels();
    this.buildAdminLabels();
    this.updateRivers();
    this.updateWorks();
    this.updateScenery();
    this.labels.remeasure();
  }

  setLayer(k: keyof Layers, on: boolean): void {
    this.layers[k] = on;
    this.layoutDirty = true;
    if (k === 'territory') {
      this.terrain.uniforms.uTerrOn.value = on ? 1 : 0;
      this.labels.setGroupVisible('polity', on);
    }
    if (k === 'places') { this.labels.setGroupVisible('places', on); this.labels.setGroupVisible('rivers', on); }
    if (k === 'admin' || k === 'modern' || k === 'ghost') { this.setYear(this.year, true); this.labels.setGroupVisible('admin', this.layers.admin); if (!this.layers.admin && this.hover && 'area' in this.hover) this.setHover(null); }
    if (k === 'works') this.updateWorks();
    if (k === 'events') this.labels.setGroupVisible('pins', on && !this.pickHandler);
    if (k === 'models') {
      this.capitalKey = '-';
      this.updateCapital();
      if (!on) this.fx.clear('event');
      else if (this.selected) this.select(this.selected, false);
    }
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
    this.layoutDirty = true;
    if (fn) this.setHover(null);
    this.labels.setGroupVisible('pins', this.layers.events && !fn);
    this.labels.setGroupVisible('badges', !fn && !this.storyMode);
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

/**
 * Two forms only: compact marker and model. A 2-unit hysteresis band avoids flickering at the model threshold.
 */
const ZOOM = { model: 40, detail: 45 };
const LEVEL_PRIORITY: Record<Level, number> = { 1: 64, 2: 48, 3: 32 };

/** Type colours of map items: the base ring each model stands in, matching the tooltip glyphs (.k-* in styles.css). */
const KIND_COLOR: Record<string, string> = {
  capital: '#b8322a', person: '#b8322a', building: '#7d5a32', landmark: '#7d5a32', custom: '#2c6e5c', food: '#b4652a',
};

function setAttr(el: HTMLElement, name: string, val: string): void {
  if (el.getAttribute(name) !== val) el.setAttribute(name, val);
}

const ringBoxes = new WeakMap<LonLat[], [number, number, number, number]>();

function ringBox(r: LonLat[]): [number, number, number, number] {
  let b = ringBoxes.get(r);
  if (!b) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < r.length; i++) {
      const [x, y] = r[i];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    b = [minX, minY, maxX, maxY];
    ringBoxes.set(r, b);
  }
  return b;
}

/** Even-odd point-in-polygon over all rings (holes included). */
function inside(rings: LonLat[][], x: number, y: number): boolean {
  let c = false;
  for (const r of rings) {
    const b = ringBox(r);
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
