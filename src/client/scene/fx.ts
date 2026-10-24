import * as THREE from 'three';
import type { Formation, LonLat, ModelRecipe, Shot, Troops } from '../../shared/data/types.ts';
import { defaultFormation, eraOf } from '../../shared/data/era.ts';
import { deploy, type Slot } from './formation.ts';
import { instance } from '../models/library.ts';
import { troopMaterial, unitGeometry, type UnitType } from './troops.ts';
import { animate, rig } from './animate.ts';
import type { Geo } from './geo.ts';
import type { Label, Labels } from './labels.ts';
import type { View } from './view.ts';
import { INK, ink } from './ink.ts';

export type FxKind = 'battle' | 'fire' | 'glow' | 'flag' | 'smoke' | 'firework';
/** story: the playing animation · event: the selected event's model · base: the capital · scenery: the dynasty's landmarks and people · works */
export type Layer = 'story' | 'event' | 'base' | 'scenery' | 'works';
export interface ArmyOpts { trail?: boolean; from?: LonLat; to?: LonLat; pts?: LonLat[]; color: string; dur: number; count?: number; unit?: Troops; formation?: Formation; label?: string; follow?: boolean; keep?: boolean; retreat?: boolean }
export interface ClashOpts { lon: number; lat: number; a: string; b: string; winner?: 'a' | 'b'; angle?: number; dur?: number; count?: number; labels?: [string?, string?]; units?: [Troops?, Troops?]; formations?: [Formation?, Formation?]; siege?: boolean; cam?: boolean }
export interface FleetOpts { pts: LonLat[]; dur: number; color?: string; count?: number; model?: 'junk' | 'warship' | 'fireship' | 'boat' | 'redboat'; label?: string; follow?: boolean; keep?: boolean }

/** A gently bowed route between two points (opposing arrows don't overlap). */
function bow(a: LonLat, b: LonLat): LonLat[] {
  const mid: LonLat = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * 0.12, (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.12];
  const pts: LonLat[] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    pts.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mid[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * mid[1] + u * u * b[1]]);
  }
  return pts;
}

type Path = { p: THREE.Vector3[]; len: number[]; total: number };

/** A path arrow: `reveal` grows it, `frame` places the head each frame (sc: current model scale), `fade` 0..1 hides it. */
interface Arrow {
  obj: THREE.Object3D;
  own: { dispose(): void }[];
  reveal(k: number): void;
  frame(k: number, sc: number, carried: boolean): void;
  fade(x: number): void;
}

/** Live state of a spawned model (in its group's userData), read by the atlas for hover picking and highlights. */
export interface SpawnState { boost: number; k: number; top: number; rad: number; shown: boolean }

interface Item {
  layer: Layer;
  obj: THREE.Object3D;
  /** per-item resources disposed on removal (never shared library geometry) */
  own: { dispose(): void }[];
  label?: Label;
  update?: (dt: number, t: number, s: number) => void;
  /** 0..1 visibility used for fades */
  fade?: (k: number) => void;
}

interface Tween { dur: number; t: number; fn: (k: number) => void; done: () => void }

/**
 * Sand-table miniatures: figure scale and file spacing relative to the screen-constant model scale `s`, so soldiers
 * stand about 20 px tall at every zoom and read as real 3D figures rather than specks.
 */
const FIG = 0.7, GAP = 0.5;
/** Animation timing standard (seconds): models rise in RISE, story marks hold HOLD after they finish, then fade over FADE. */
const RISE = 0.7, HOLD = 3, FADE = 0.8;
/** Variants of the one route stroke: weight (1 = journey), dashes for planned/uncertain routes, dimmed for a retreat. */
interface StrokeOpts { weight?: number; dashed?: boolean; dim?: boolean }
/** One style per kind of great work, shared by the build animation and the permanent works layer (widths are world units). */
const WORK = {
  wall: { w: 0, c: '#a8916a', a: 1 },
  canal: { w: 0.075, c: '#2f7fc4', a: 0.9 },
  sea: { w: 0.07, c: '#1f5f8b', a: 0.5 },
  road: { w: 0.05, c: '#8a5a2b', a: 0.75 },
  rail: { w: 0.05, c: '#3d3229', a: 0.9 },
} as const;

/** Model scale for a viewing distance. */
const scaleFor = (d: number) => THREE.MathUtils.clamp(d * 0.028, 0.09, 1.5);
/** Map models (scenery, capital, event models) also grow on screen as the camera closes in: ~1.7× at 10, ~2.3× at 5. */
const mapScale = (d: number) => (d >= 40 ? scaleFor(d) : 1.12 * (d / 40) ** 0.6);

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeBack = (k: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

/**
 * Everything the story player draws on the map: animated routes and arrows, walls/canals/railways that build
 * themselves, marching armies, spawned 3D models, particles (battle sparks, fire, smoke, fireworks) and glow rings.
 * All animation runs on a story clock that can be paused or sped up.
 */
export class Fx {
  readonly root = new THREE.Group();
  private items: Item[] = [];
  private tweens: Tween[] = [];
  private particles: Particles;
  private missiles = new Missiles();
  private shadowTex = blobTexture();
  /** shared geometry of the base rings map items stand in */
  private baseRing = new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2);
  /** the story year: troops are equipped for its period */
  year = 1000;
  speed = 1;
  paused = false;
  /** current model scale: models stay readable at every zoom */
  s = 1;
  /** camera distance to the orbit target (drives `s` and models' `maxD`) */
  dist = 30;
  private clock = 0;
  /** the journey traveller currently on the map (one per journey, handed from leg to leg) */
  private traveller: THREE.Object3D | null = null;

  constructor(private view: View, private geo: Geo, private labels: Labels) {
    this.root.name = 'fx';
    view.scene.add(this.root);
    this.particles = new Particles();
    this.root.add(this.particles.add, this.particles.norm, this.missiles.arrows, this.missiles.stones);
    view.onFrame((dt, t) => this.frame(dt, t));
  }

  private frame(dt: number, t: number): void {
    this.dist = this.view.camera.position.distanceTo(this.view.controls.target);
    this.s = scaleFor(this.dist);
    const sdt = this.paused ? 0 : dt * this.speed;
    this.clock += sdt;
    for (const tw of this.tweens.slice()) {
      tw.t = Math.min(tw.dur, tw.t + sdt);
      tw.fn(tw.dur > 0 ? tw.t / tw.dur : 1);
      if (tw.t >= tw.dur) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    for (const it of this.items) it.update?.(sdt, t, this.s);
    this.stepFollow(sdt);
    this.missiles.step(sdt);
    this.particles.step(sdt, this.view.renderer.getPixelRatio() * this.view.canvas.clientHeight * 0.5 * this.view.camera.projectionMatrix.elements[5]);
  }

  /** Runs fn(k) for k in 0..1 over `dur` story-seconds. Resolves early if the layer is cleared. */
  tween(dur: number, fn: (k: number) => void = () => {}): Promise<void> {
    return new Promise(done => {
      if (dur <= 0) { fn(1); done(); return; }
      this.tweens.push({ dur, t: 0, fn, done });
    });
  }
  wait(dur: number): Promise<void> { return this.tween(dur); }

  private add(it: Item): Item {
    this.items.push(it);
    this.root.add(it.obj);
    if (this.hidden.has(it.layer)) it.obj.visible = false;
    return it;
  }

  private hidden = new Set<Layer>();
  /** Shows or hides a whole layer (models and their labels) without rebuilding it. */
  showLayer(layer: Layer, on: boolean): void {
    if (on) this.hidden.delete(layer); else this.hidden.add(layer);
    for (const it of this.items) if (it.layer === layer) it.obj.visible = on;
    this.labels.setGroupVisible(layer, on);
  }

  private remove(it: Item): void {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
    it.obj.removeFromParent();
    for (const o of it.own) o.dispose();
    if (it.label) this.labels.remove(it.label);
  }

  /** Removes a layer (and, for 'story', finishes pending tweens so awaiting scripts unwind). */
  clear(layer: Layer): void {
    for (const it of this.items.filter(x => x.layer === layer)) this.remove(it);
    if (layer === 'story') {
      this.epoch++;
      this.follow = null;
      this.traveller = null;
      const tw = this.tweens.splice(0);
      for (const x of tw) x.done();
      this.particles.clear();
      this.missiles.clear();
    }
  }

  /** Completes all running tweens at once (story "skip"). */
  finishTweens(): void {
    for (const x of this.tweens.splice(0)) { x.fn(1); x.done(); }
  }

  /** Bumped whenever the story layer is cleared, so multi-step effects stop after an awaited step unwinds. */
  private epoch = 0;

  count(layer: Layer): number { return this.items.filter(x => x.layer === layer).length; }

  // ---------------------------------------------------------------- paths

  /** Dense path on the terrain surface (so lines climb mountains), with cumulative lengths. */
  path(pts: LonLat[], lift: number): Path {
    const p: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = pts[i];
      if (i === 0) { p.push(this.geo.pos(a, b, lift)); continue; }
      const [pa, pb] = pts[i - 1];
      const n = Math.max(1, Math.ceil(Math.hypot((a - pa) * this.geo.kx, b - pb) / 0.2));
      for (let k = 1; k <= n; k++) {
        const u = k / n;
        // a slight bow so straight arrows read as movement rather than borders
        p.push(this.geo.pos(pa + (a - pa) * u, pb + (b - pb) * u, lift));
      }
    }
    const len = [0];
    for (let i = 1; i < p.length; i++) len.push(len[i - 1] + p[i].distanceTo(p[i - 1]));
    return { p, len, total: len[len.length - 1] || 1e-6 };
  }

  private at(path: Path, k: number, out = new THREE.Vector3()): { pos: THREE.Vector3; dir: THREE.Vector3; i: number } {
    const d = THREE.MathUtils.clamp(k, 0, 1) * path.total;
    let i = 1;
    while (i < path.len.length - 1 && path.len[i] < d) i++;
    const a = path.p[i - 1] ?? path.p[0], b = path.p[i] ?? a;
    const seg = path.len[i] - path.len[i - 1] || 1;
    const u = THREE.MathUtils.clamp((d - path.len[i - 1]) / seg, 0, 1);
    out.lerpVectors(a, b, u);
    return { pos: out, dir: b.clone().sub(a).setY(0).normalize(), i };
  }

  /** A flat ribbon along a path (optionally tapering), revealed progressively via drawRange; `setWidth` re-lays it. */
  private ribbon(path: Path, width: number, color: string, opacity: number, taper = false): { mesh: THREE.Mesh; reveal: (k: number) => void; mat: THREE.MeshBasicMaterial; setWidth: (w: number) => void } {
    const n = path.p.length;
    const pos = new Float32Array(n * 2 * 3);
    const attr = new THREE.BufferAttribute(pos, 3);
    const side = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const lay = (width: number) => {
      for (let i = 0; i < n; i++) {
        const a = path.p[Math.max(0, i - 1)], b = path.p[Math.min(n - 1, i + 1)];
        dir.copy(b).sub(a).setY(0).normalize();
        side.crossVectors(up, dir).normalize();
        const w = (width / 2) * (taper ? 0.45 + 0.55 * (path.len[i] / path.total) : 1);
        for (let s = 0; s < 2; s++) {
          const sx = path.p[i].x + side.x * w * (s ? -1 : 1), sz = path.p[i].z + side.z * w * (s ? -1 : 1);
          const y = Math.max(path.p[i].y, Math.max(0, this.geo.height(this.geo.lon(sx), this.geo.lat(sz))) + 0.02);
          pos.set([sx, y, sz], (i * 2 + s) * 3);
        }
      }
      attr.needsUpdate = true;
      g.boundingSphere = null;
    };
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', attr);
    g.setIndex(idx);
    lay(width);
    const mat = ink(new THREE.MeshBasicMaterial({ color, opacity, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = INK.ribbon;
    const reveal = (k: number) => {
      const d = k * path.total;
      let i = 0;
      while (i < n - 1 && path.len[i + 1] <= d) i++;
      g.setDrawRange(0, Math.max(0, i) * 6);
    };
    reveal(0);
    return { mesh, reveal, mat, setWidth: lay };
  }

  /** Journey-trail colour: the journey's own hue, enriched just enough to read on the terrain (neutral inks stay ink). */
  private trailColors(color: string): { body: THREE.Color; rim: THREE.Color; light: THREE.Color; dark: THREE.Color } {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(color).getHSL(hsl, THREE.SRGBColorSpace);
    const ink = hsl.s < 0.12;
    const s = ink ? hsl.s : THREE.MathUtils.clamp(hsl.s * 1.1, 0.45, 0.8), l = THREE.MathUtils.clamp(hsl.l, ink ? 0.22 : 0.38, ink ? 0.3 : 0.5);
    const mk = (dl: number, ds = 0) => new THREE.Color().setHSL(hsl.h, THREE.MathUtils.clamp(s + ds, 0, 1), THREE.MathUtils.clamp(l + dl, 0, 1), THREE.SRGBColorSpace);
    return { body: mk(0), rim: mk(-l * 0.6, 0.05), light: mk(ink ? 0.12 : 0.1, -0.05), dark: mk(-l * 0.25) };
  }

  /**
   * A journey leg drawn like a brush stroke on the sand table: a rich body with a fine dark rim and a soft shadow, paper
   * dashes flowing along its spine in the direction of travel, and a barbed two-tone arrowhead whose tip lands on the
   * stop. Its on-screen width is kept at every zoom so earlier legs still read in the closing overview. This is the one
   * line design of every moving thing (journeys, routes, armies, fleets); variants only change its weight, break the
   * body into dashes (a planned or uncertain route) or dim it (a retreat). See docs/design/map-design.md.
   */
  private trailArrow(path: Path, color: string, v: StrokeOpts = {}): Arrow {
    // half-widths in model-scale units: body, rim and shadow (the ribbon spans all three)
    const wk = v.weight ?? 1, BODY = 0.2, RIM = 0.25, SHADOW = 0.34 * wk, H = 0.95 * wk, OPACITY = v.dim ? 0.55 : 1;
    const C = this.trailColors(color);
    const n = path.p.length;
    const pos = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2), dist = new Float32Array(n * 2), lift = new Float32Array(n);
    const attr = new THREE.BufferAttribute(pos, 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', attr);
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setIndex(idx);
    const sv = new THREE.Vector3(), dv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const lay = (sc: number) => {
      const brush = Math.min(path.total * 0.2, 1.6 * sc);
      for (let i = 0; i < n; i++) {
        const a = path.p[Math.max(0, i - 1)], b = path.p[Math.min(n - 1, i + 1)];
        dv.copy(b).sub(a).setY(0).normalize();
        sv.crossVectors(up, dv).normalize();
        // the stroke starts slim like a brush touching paper, then swells to full width
        const t = THREE.MathUtils.smoothstep(path.len[i], 0, brush);
        const w = SHADOW * sc * (0.45 + 0.55 * t);
        // level cross-sections over the higher bank, so the stroke lies flat instead of folding on slopes
        let y = path.p[i].y;
        for (let s = 0; s < 2; s++) {
          const sx = path.p[i].x + sv.x * w * (s ? -1 : 1), sz = path.p[i].z + sv.z * w * (s ? -1 : 1);
          y = Math.max(y, Math.max(0, this.geo.height(this.geo.lon(sx), this.geo.lat(sz))) + 0.02);
          pos.set([sx, 0, sz], (i * 2 + s) * 3);
          side[i * 2 + s] = s ? -1 : 1;
          dist[i * 2 + s] = path.len[i];
        }
        lift[i] = y;
      }
      // a short running max smooths ridges into gentle humps
      for (let i = 0; i < n; i++) {
        let y = lift[i];
        for (let d = -2; d <= 2; d++) y = Math.max(y, lift[Math.min(n - 1, Math.max(0, i + d))] - Math.abs(d) * 0.01);
        pos[i * 6 + 1] = pos[i * 6 + 4] = y;
      }
      attr.needsUpdate = true;
      g.boundingSphere = null;
    };
    let built = this.s;
    lay(built);
    // the shader writes sRGB directly (like the terrain), while THREE.Color holds linear values
    const v3 = (c: THREE.Color) => { const k = c.clone().convertLinearToSRGB(); return new THREE.Vector3(k.r, k.g, k.b); };
    const mat = ink(new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, side: THREE.DoubleSide,
      uniforms: {
        uBody: { value: v3(C.body) }, uRim: { value: v3(C.rim) }, uLight: { value: v3(C.light) }, uPaper: { value: new THREE.Vector3(0.984, 0.953, 0.875) },
        uB: { value: (BODY * wk) / SHADOW }, uR: { value: (RIM * wk) / SHADOW }, uFlow: { value: 0 }, uPeriod: { value: 0.8 * built }, uOpacity: { value: OPACITY },
        uGap: { value: v.dashed ? 1.1 * built : 0 },
      },
    }));
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = INK.trail;
    const reveal = (k: number) => {
      const d = k * path.total;
      let i = 0;
      while (i < n - 1 && path.len[i + 1] <= d) i++;
      g.setDrawRange(0, Math.max(0, i) * 6);
    };
    reveal(0);

    // the arrowhead: a barbed dart (tip, wings and a notch) with a lit and a shaded half, a dark rim and a soft shadow
    const dart = (pts: number[][], cols: THREE.Color[] | null, c: string | THREE.Color, opacity: number, order: number) => {
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flatMap(([x, z]) => [x, 0, z])), 3));
      if (cols) hg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols.flatMap(k => [k.r, k.g, k.b])), 3));
      const m = new THREE.Mesh(hg, ink(new THREE.MeshBasicMaterial({
        color: cols ? '#ffffff' : c, vertexColors: !!cols, opacity, side: THREE.DoubleSide, toneMapped: false,
      })));
      m.renderOrder = order;
      return m;
    };
    const T = [0, 1], R = [0.55, -0.2], N = [0, 0.14], L = [-0.55, -0.2];
    const grow = (k: number, [x, z]: number[]) => [x * k, 0.2 + (z - 0.2) * k];
    const tri = (k: number) => [T, L, N, T, N, R].map(p => grow(k, p));
    const face = dart(tri(1), [C.light, C.light, C.light, C.dark, C.dark, C.dark], '#fff', 1, INK.dart);
    const rim = dart(tri(1.16), null, '#' + C.rim.getHexString(THREE.SRGBColorSpace), 1, INK.dartRim);
    const shadow = dart(tri(1.3), null, '#1c140c', 0.22, INK.dartShadow);
    const head = new THREE.Group().add(shadow, rim, face);
    if (v.dim) for (const m of [face, rim, shadow]) (m.material as THREE.MeshBasicMaterial).opacity *= OPACITY;
    shadow.position.set(0.05, -0.002, -0.06);
    const obj = new THREE.Group().add(mesh, head);
    const tmp = new THREE.Vector3();
    let flow = 0, last = this.clock;
    return {
      obj, own: [g, mat, ...[face, rim, shadow].flatMap(m => [m.geometry, m.material as THREE.Material])],
      reveal,
      frame: (x, sc) => {
        if (Math.abs(sc / built - 1) > 0.06) {
          built = sc; lay(sc);
          mat.uniforms.uPeriod.value = 0.8 * sc;
          if (v.dashed) mat.uniforms.uGap.value = 1.1 * sc;
        }
        flow += Math.max(0, this.clock - last) * 0.55 * sc;
        last = this.clock;
        mat.uniforms.uFlow.value = flow;
        const size = H * sc;
        // the stroke ends beneath the head, whose tip lands exactly on the revealed end
        reveal(Math.max(0, x - (size * 0.75) / path.total));
        const a = this.at(path, x, tmp);
        head.visible = x * path.total > size * 0.6;
        head.position.copy(a.pos).addScaledVector(a.dir, -size);
        // a flat head floats over the highest ground beneath it so slopes don't swallow its wings
        let y = a.pos.y;
        for (const [f, sd] of [[1, 0], [0.2, 0], [-0.2, 0.64], [-0.2, -0.64], [0.5, 0.35], [0.5, -0.35]]) {
          const px = head.position.x + (a.dir.x * f + a.dir.z * sd) * size, pz = head.position.z + (a.dir.z * f - a.dir.x * sd) * size;
          y = Math.max(y, this.geo.height(this.geo.lon(px), this.geo.lat(pz)));
        }
        head.position.y = y + 0.04;
        head.rotation.y = Math.atan2(a.dir.x, a.dir.z);
        head.scale.setScalar(size);
      },
      fade: x => { mat.uniforms.uOpacity.value = OPACITY * (1 - x); head.visible = false; },
    };
  }

  /** Animated route: the route stroke grows along the path, optionally carrying a model at its head. */
  async route(o: { pts: LonLat[]; dur: number; color?: string; model?: ModelRecipe; label?: string; dashed?: boolean; keep?: boolean; trail?: boolean }, layer: Layer = 'story'): Promise<void> {
    const color = o.color ?? '#c0392b';
    const path = this.path(o.pts, 0.03);
    const line = this.trailArrow(path, color, { dashed: o.dashed, weight: o.trail ? 1 : 0.8 });
    const g = new THREE.Group();
    g.add(line.obj);
    const it = this.add({ layer, obj: g, own: line.own });
    let carrier: THREE.Object3D | null = null;
    let rigs: ReturnType<typeof rig> = [];
    if (o.model) {
      instance(o.model, true).then(m => {
        if (!this.items.includes(it)) return;
        carrier = m;
        rigs = rig(m);
        g.add(m);
        // a journey has one traveller: it walks on from the stop where the last leg left it
        if (o.trail) { this.traveller?.removeFromParent(); this.traveller = m; }
      }).catch(() => {});
    }
    if (o.label) it.label = this.labels.add({ el: tag(o.label, 'route'), pos: path.p[Math.floor(path.p.length / 2)].clone().setY(path.p[Math.floor(path.p.length / 2)].y + 0.2), prio: 50, group: 'story' });
    const tmp = new THREE.Vector3();
    let k = 0;
    it.update = (_dt, t, sc) => {
      line.frame(k, sc, !!carrier);
      if (carrier) {
        const a = this.at(path, k, tmp);
        carrier.position.copy(a.pos);
        carrier.position.y = Math.max(a.pos.y - 0.03, -0.02);
        carrier.rotation.y = Math.atan2(a.dir.x, a.dir.z);
        carrier.scale.setScalar(sc * (o.trail ? 1.2 : 0.75));
        animate(rigs, t);
      }
    };
    await this.tween(o.dur, x => { k = easeOut(x) * 0.15 + x * 0.85; line.reveal(k); });
    k = 1;
    line.reveal(1);
    if (!o.keep && layer === 'story') {
      this.tween(HOLD).then(() => this.tween(FADE, x => line.fade(x))).then(() => { if (!carrier) this.remove(it); });
    }
  }

  /** Something being built along a path: a Great Wall, a canal (with a boat) or a railway (with a train). */
  async build(o: { pts: LonLat[]; dur: number; kind: 'wall' | 'canal' | 'rail'; color?: string }, layer: Layer = 'story'): Promise<void> {
    const s = Math.min(this.s, 0.8);
    const path = this.path(o.pts, o.kind === 'wall' ? 0 : 0.015);
    const g = new THREE.Group();
    const it = this.add({ layer, obj: g, own: [] });
    if (o.kind === 'wall') {
      const step = 0.16 * s;
      const n = Math.max(2, Math.floor(path.total / step));
      const seg = new THREE.BoxGeometry(step * 1.05, 0.1 * s, 0.07 * s).translate(0, 0.05 * s, 0);
      const tower = new THREE.BoxGeometry(0.11 * s, 0.17 * s, 0.11 * s).translate(0, 0.085 * s, 0);
      const mat = new THREE.MeshStandardMaterial({ color: o.color ?? WORK.wall.c, roughness: 0.9, flatShading: true });
      const segs = new THREE.InstancedMesh(seg, mat, n), towers = new THREE.InstancedMesh(tower, mat, Math.ceil(n / 6) + 1);
      const mats: THREE.Matrix4[] = [], tmats: THREE.Matrix4[] = [];
      const q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < n; i++) {
        const a = this.at(path, (i + 0.5) / n, v);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(a.dir.x, a.dir.z) + Math.PI / 2);
        mats.push(new THREE.Matrix4().compose(a.pos.clone(), q.clone(), one));
        if (i % 6 === 0) tmats.push(new THREE.Matrix4().compose(a.pos.clone(), q.clone(), one));
      }
      segs.count = 0; towers.count = 0;
      g.add(segs, towers);
      it.own.push(seg, tower, mat);
      const m = new THREE.Matrix4(), sc = new THREE.Vector3(), p = new THREE.Vector3(), qq = new THREE.Quaternion();
      await this.tween(o.dur, k => {
        const shown = Math.floor(k * n);
        segs.count = Math.min(n, shown + 1);
        for (let i = 0; i < segs.count; i++) {
          const rise = THREE.MathUtils.clamp((k * n - i) / 3, 0.05, 1);
          mats[i].decompose(p, qq, sc);
          segs.setMatrixAt(i, m.compose(p, qq, sc.set(1, rise, 1)));
        }
        towers.count = Math.min(tmats.length, Math.floor(shown / 6) + 1);
        for (let i = 0; i < towers.count; i++) towers.setMatrixAt(i, tmats[i]);
        segs.instanceMatrix.needsUpdate = true;
        towers.instanceMatrix.needsUpdate = true;
      });
      return;
    }
    const canal = o.kind === 'canal';
    const st = WORK[o.kind];
    const rb = this.ribbon(path, st.w, o.color ?? st.c, st.a);
    g.add(rb.mesh);
    it.own.push(rb.mesh.geometry, rb.mat);
    let mover: THREE.Object3D | null = null, rigs: ReturnType<typeof rig> = [];
    instance(canal ? { kind: 'boat' } : { kind: 'train' }, true).then(m => {
      if (!this.items.includes(it)) return;
      mover = m; rigs = rig(m); g.add(m);
    }).catch(() => {});
    let k = 0;
    const tmp = new THREE.Vector3();
    it.update = (_dt, t, sc) => {
      if (!mover) return;
      const a = this.at(path, k, tmp);
      mover.position.copy(a.pos);
      mover.rotation.y = Math.atan2(a.dir.x, a.dir.z);
      mover.scale.setScalar(Math.min(sc, 0.8) * 0.55);
      animate(rigs, t);
    };
    await this.tween(o.dur, x => { k = x; rb.reveal(x); });
    rb.reveal(1);
  }

  /** A permanent great work drawn at a fixed scale: wall (3D ramparts with towers), canal, road or sea route. */
  work(o: { lines: LonLat[][]; kind: string; label?: string; labelAt?: LonLat | null }, layer: Layer = 'works'): void {
    const g = new THREE.Group();
    const it = this.add({ layer, obj: g, own: [] });
    const s = 0.55;
    for (const line of o.lines) {
      if (line.length < 2) continue;
      if (o.kind === 'wall') {
        const path = this.path(line, 0);
        const step = 0.16 * s, n = Math.max(2, Math.floor(path.total / step));
        const seg = new THREE.BoxGeometry(step * 1.05, 0.12 * s, 0.08 * s).translate(0, 0.06 * s, 0);
        const tower = new THREE.BoxGeometry(0.12 * s, 0.22 * s, 0.12 * s).translate(0, 0.11 * s, 0);
        const mat = new THREE.MeshStandardMaterial({ color: WORK.wall.c, roughness: 0.9, flatShading: true });
        const segs = new THREE.InstancedMesh(seg, mat, n), towers = new THREE.InstancedMesh(tower, mat, Math.ceil(n / 5));
        const q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
        let ti = 0;
        for (let i = 0; i < n; i++) {
          const a = this.at(path, (i + 0.5) / n, v);
          q.setFromAxisAngle(up, Math.atan2(a.dir.x, a.dir.z) + Math.PI / 2);
          m.compose(a.pos, q, one);
          segs.setMatrixAt(i, m);
          if (i % 5 === 0 && ti < towers.count) towers.setMatrixAt(ti++, m);
        }
        towers.count = ti;
        g.add(segs, towers);
        it.own.push(seg, tower, mat);
      } else {
        const path = this.path(line, 0.012);
        const style = WORK[o.kind as keyof typeof WORK] ?? WORK.road;
        const rb = this.ribbon(path, style.w, style.c, style.a);
        rb.reveal(1);
        g.add(rb.mesh);
        it.own.push(rb.mesh.geometry, rb.mat);
      }
    }
    if (o.label && o.labelAt) {
      const el = Object.assign(document.createElement('div'), { className: `work k-${o.kind}`, textContent: o.label });
      it.label = this.labels.add({ el, pos: this.geo.pos(o.labelAt[0], o.labelAt[1], 0.12), prio: 26, group: 'works', maxD: 70 });
    }
  }

  /**
   * A marching army: a campaign arrow along the route and the troops in formation (a column by default) behind a mounted
   * general and a war banner, kicking up dust. `follow` makes the camera ride along.
   */
  async army(o: ArmyOpts, layer: Layer = 'story'): Promise<void> {
    const s = scaleFor(this.view.goalDist);
    const pts = o.pts && o.pts.length >= 2 ? o.pts : bow(o.from ?? o.pts![0], o.to ?? o.pts![o.pts!.length - 1]);
    const path = this.path(pts, 0.035);
    const line = this.trailArrow(path, o.color, { dim: o.retreat, weight: o.trail ? 1 : 1.15 });
    const n = Math.min(48, o.count ?? 30);
    const unit = o.unit ?? 'foot';
    const troops = this.formation(deploy(o.formation ?? 'column', unit, n, this.year), o.color, unit);
    const g = new THREE.Group();
    g.add(line.obj, ...troops.meshes);
    const it = this.add({ layer, obj: g, own: [...line.own, ...troops.own] });
    let banner: THREE.Object3D | null = null, rigs: ReturnType<typeof rig> = [];
    let general: THREE.Object3D | null = null, grigs: ReturnType<typeof rig> = [], fk = 1;
    instance({ kind: 'flag', color: o.color }, true).then(m => { if (this.items.includes(it)) { banner = m; rigs = rig(m); g.add(m); } }).catch(() => {});
    if (!o.retreat) instance({ kind: 'rider', color: o.color }, true).then(m => { if (this.items.includes(it)) { general = m; grigs = rig(m); g.add(m); } }).catch(() => {});
    if (o.label) it.label = this.labels.add({ el: tag(o.label, 'army', o.color), pos: new THREE.Vector3(), prio: 70, group: 'story', anchor: 'above' });
    const dust = this.particles.emitter('dust', new THREE.Vector3(), () => this.s);
    let k = 0, moving = true;
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3(), tmp = new THREE.Vector3();
    it.update = (_dt, t, scale) => {
      const z = Math.min(scale, s * 1.5);
      line.frame(k, scale, false);
      const hd = this.at(path, k, tmp);
      const yaw = Math.atan2(hd.dir.x, hd.dir.z);
      q.setFromAxisAngle(up, yaw);
      const side = new THREE.Vector3().crossVectors(up, hd.dir).normalize();
      const gap = GAP * z;
      troops.place((i, sl, out) => {
        const back = (sl.z * troops.zs + 2) * gap + troops.jit[i * 2] * gap * 0.3;
        const p = this.at(path, Math.max(0, k - back / path.total), v).pos;
        p.addScaledVector(side, (sl.x * troops.xs + troops.jit[i * 2 + 1] * 0.25) * gap);
        p.y = Math.max(0, this.geo.height(this.geo.lon(p.x), this.geo.lat(p.z))) + (moving ? Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.012 * z : 0);
        out.compose(p, q, sc.setScalar(z * FIG));
      });
      const rear = this.at(path, Math.max(0, k - (troops.depth * troops.zs + 2) * gap / path.total), v).pos;
      dust.p.copy(rear);
      dust.k = moving ? 1 : 0;
      if (general) {
        general.position.copy(hd.pos).addScaledVector(hd.dir, -gap * 0.6);
        general.position.y = Math.max(0, hd.pos.y) + (moving ? Math.abs(Math.sin(t * 7)) * 0.02 * z : 0);
        general.scale.setScalar(Math.max(0.001, z * 0.95 * fk));
        general.rotation.y = yaw;
        animate(grigs, t);
      }
      if (banner) {
        banner.position.copy(hd.pos).addScaledVector(hd.dir, -gap * 1.5).addScaledVector(side, gap * 0.9);
        banner.scale.setScalar(Math.max(0.001, z * 1.1 * fk));
        banner.rotation.y = yaw - Math.PI / 2;
        animate(rigs, t);
      }
      if (it.label) it.label.pos.copy(hd.pos).setY(hd.pos.y + 1.3 * z);
    };
    if (o.follow) this.followWith(() => tmp);
    await this.tween(o.dur, x => { k = 0.7 * x + 0.3 * x * x * (3 - 2 * x); line.reveal(k); });
    k = 1; moving = false;
    line.reveal(1);
    dust.stop = true;
    if (o.follow) this.followWith(null);
    if (layer === 'story' && !o.keep) this.tween(HOLD).then(() => this.tween(FADE, x => { line.fade(x); troops.fade(1 - x); fk = 1 - x; })).then(() => this.remove(it));
  }

  /**
   * Instanced troops of a deployment: one InstancedMesh per unit type (period-specific kit), sharing a team-tinted
   * material. `xs`/`zs` are the file and rank spacings in GAP units (cavalry need more room); `place` positions slot i.
   */
  private formation(slots: Slot[], color: string, unit: Troops) {
    const era = eraOf(this.year);
    const mat = troopMaterial();
    const count = new Map<UnitType, number>(), idx = new Int32Array(slots.length);
    slots.forEach((sl, i) => { const c = count.get(sl.t) ?? 0; idx[i] = c; count.set(sl.t, c + 1); });
    const meshes = new Map<UnitType, THREE.InstancedMesh>();
    for (const [t, c] of count) {
      const m = new THREE.InstancedMesh(unitGeometry(t, era), mat, c);
      m.frustumCulled = false;
      meshes.set(t, m);
    }
    const col = new THREE.Color(color), tc = new THREE.Color();
    slots.forEach((sl, i) => meshes.get(sl.t)!.setColorAt(idx[i], tc.copy(col).offsetHSL(0, 0, (i % 3) * 0.05 - 0.05)));
    const jit = new Float32Array(slots.length * 2).map(() => Math.random() - 0.5);
    const m4 = new THREE.Matrix4();
    const horse = unit === 'horse' || unit === 'chariot';
    return {
      meshes: [...meshes.values()],
      own: [mat],
      jit,
      slots,
      xs: horse ? 1.3 : 1,
      zs: horse ? 1.7 : 1.3,
      depth: Math.max(0, ...slots.map(sl => sl.z)),
      width: Math.max(1, ...slots.map(sl => Math.abs(sl.x))),
      place(fn: (i: number, sl: Slot, out: THREE.Matrix4) => void) {
        slots.forEach((sl, i) => { fn(i, sl, m4); meshes.get(sl.t)!.setMatrixAt(idx[i], m4); });
        for (const m of meshes.values()) m.instanceMatrix.needsUpdate = true;
      },
      fade(a: number) { mat.opacity = a; },
    };
  }

  /**
   * A pitched battle at a point, staged on a trampled battlefield with each side's camp behind it. Side A and side B
   * advance in their formations from opposite directions (`angle`: the direction A comes from, degrees clockwise from
   * west); square and circle formations stand their ground. Archers halt and loose volleys, riflemen fire, cavalry on
   * the wings ride round the enemy flanks; in a siege the attackers' trebuchets (cannon from the Ming) bombard the gate.
   * Then the loser routs, leaving fires behind. On the story layer the camera cuts from a low shot behind the advancing
   * line to a push-in with shake at contact and a crane up over the rout (`cam: false` keeps it still).
   */
  async clash(o: ClashOpts, layer: Layer = 'story'): Promise<void> {
    // sized for where the camera is heading (a parallel fly step may have just started)
    const dur = o.dur ?? 6, s = scaleFor(this.view.goalDist), n = Math.min(40, o.count ?? 28);
    const c = this.geo.pos(o.lon, o.lat, 0);
    const th = ((o.angle ?? 0) * Math.PI) / 180;
    const ax = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)); // from A towards B (x east, z south)
    const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(up, ax).normalize();
    const ground = (p: THREE.Vector3, lift = 0) => { p.y = Math.max(0, this.geo.height(this.geo.lon(p.x), this.geo.lat(p.z))) + lift; return p; };
    const g = new THREE.Group();
    const it = this.add({ layer, obj: g, own: [] });
    const D = 3.2 * s, gap = GAP * s;
    const forms = ([0, 1] as const).map(si => o.formations?.[si] ?? (o.siege && si ? 'line' : defaultFormation(o.units?.[si] ?? 'foot')));
    const holds = forms.map(f => f === 'square' || f === 'circle');
    const sides = (['a', 'b'] as const).map((id, si) => {
      const color = si ? o.b : o.a;
      const unit = o.units?.[si] ?? 'foot';
      const f = this.formation(deploy(forms[si], unit, n, this.year), color, unit);
      g.add(...f.meshes);
      it.own.push(...f.own);
      const dir = si ? ax.clone().negate() : ax.clone();
      const label = o.labels?.[si] ? this.labels.add({ el: tag(o.labels[si]!, 'army', color), pos: new THREE.Vector3(), prio: 72, group: 'story', anchor: 'above' }) : undefined;
      const fall = new Float32Array(f.slots.length).map(() => Math.random());
      const pos = f.slots.map(() => new THREE.Vector3());
      const archers = f.slots.flatMap((sl, i) => (sl.t === 'archer' ? [i] : []));
      const guns = f.slots.flatMap((sl, i) => (sl.t === 'gun' ? [i] : []));
      // a square or circle holds its ground unless both sides do
      const hold = holds[si] && !holds[1 - si];
      const sd = { id, color, unit, f, dir, label, fall, pos, archers, guns, hold, vol: Math.random() * 0.5, yaw: Math.atan2(dir.x, dir.z), flag: null as THREE.Object3D | null, rigs: [] as ReturnType<typeof rig> };
      instance({ kind: 'flag', color }, true).then(m => { if (this.items.includes(it)) { sd.flag = m; sd.rigs = rig(m); g.add(m); } }).catch(() => {});
      return sd;
    });
    // in a siege the defenders hold the ground just before their gate and the attackers charge from further out
    const start = (sd: typeof sides[number]) => (sd.hold ? gap * 0.6 : o.siege ? (sd.id === 'b' ? D * 0.3 : D * 1.15) : D);
    const rear = (sd: typeof sides[number]) => start(sd) + sd.f.depth * sd.f.zs * gap;
    const at = (sd: typeof sides[number], back: number, lat: number, out = new THREE.Vector3()) => out.copy(c).addScaledVector(sd.dir, -back).addScaledVector(side, lat);

    // the battlefield: trampled earth under both armies, camps behind them, siege engines and the city gate
    const field = this.field(c, ax, side, Math.max(rear(sides[0]), rear(sides[1])) + gap * 3, Math.max(sides[0].f.width * sides[0].f.xs, sides[1].f.width * sides[1].f.xs) * gap + gap * 5);
    g.add(field.mesh);
    it.own.push(field.mesh.geometry, field.mat);
    const props: { m: THREE.Object3D; k: number }[] = [];
    const prop = (r: ModelRecipe, p: THREE.Vector3, yaw: number, k: number) => instance(r, true).then(m => {
      if (!this.items.includes(it)) return null;
      m.position.copy(ground(p));
      m.rotation.y = yaw;
      m.scale.setScalar(s * k);
      g.add(m);
      props.push({ m, k });
      return m;
    }).catch(() => null);
    for (const sd of sides) {
      if (o.siege && sd.id === 'b') continue;
      for (const sx of [-1, 1]) void prop({ kind: 'tent' }, at(sd, rear(sd) + gap * 3.5, sx * (sd.f.width * sd.f.xs * 0.5 + 2) * gap), sd.yaw + sx * 0.3, 0.85);
    }
    const gatePos = ground(at(sides[1], rear(sides[1]) + gap * 1.5, 0));
    const engines: THREE.Vector3[] = [];
    const cannon = this.year >= 1350;
    if (o.siege) {
      void prop({ kind: 'gate', color: o.b }, gatePos.clone(), sides[1].yaw + Math.PI, 1.25);
      for (const sx of [-1, 1]) {
        const p = ground(at(sides[0], rear(sides[0]) + gap * 1.5, sx * (sides[0].f.width * sides[0].f.xs * 0.5 + 1) * gap));
        engines.push(p);
        void prop({ kind: cannon ? 'cannon' : 'trebuchet', color: o.a }, p.clone(), sides[0].yaw, 0.8);
      }
    }
    let fk = 1;
    let k = 0;
    const loser = o.winner === 'a' ? 'b' : o.winner === 'b' ? 'a' : null;
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler(), w = new THREE.Vector3();
    let battle: ReturnType<Particles['emitter']> | null = null;
    const fires: ReturnType<Particles['emitter']>[] = [];
    let shell = 0;
    it.update = (dt, t) => {
      const charge = Math.min(1, k / 0.35), fight = THREE.MathUtils.clamp((k - 0.35) / 0.35, 0, 1), rout = THREE.MathUtils.clamp((k - 0.7) / 0.3, 0, 1);
      for (const sd of sides) {
        const lost = sd.id === loser, won = loser !== null && !lost;
        const s0 = start(sd);
        // the front line: far away -> touching -> pushed back (loser) / forward (winner)
        let front = sd.hold ? s0 : THREE.MathUtils.lerp(s0, gap * 0.6, charge * charge);
        if (won) front -= rout * D * 0.35;
        if (lost) front += rout * rout * D * 1.4;
        const melee = fight * (1 - rout) * 0.5;
        sd.f.place((i, sl, out) => {
          const scatter = lost ? rout * (0.6 + sd.fall[i]) : 0;
          let fr = front, lat = sl.x * sd.f.xs, turn = sl.face;
          if (sl.t === 'archer' && !sd.hold) fr = Math.max(front, THREE.MathUtils.lerp(s0, s0 * 0.5, charge));
          else if (sl.t === 'gun' && !sd.hold) fr = Math.max(front, THREE.MathUtils.lerp(s0, gap * 3, charge));
          else if (sl.t === 'horse' && sd.unit === 'mixed' && !lost && Math.abs(sl.x) > 1.5) {
            // cavalry on the wings ride round the enemy's flank
            fr = THREE.MathUtils.lerp(s0, gap * 0.6, Math.min(1, charge * 1.25) ** 2) - fight * D * 0.3;
            lat *= 1 - 0.35 * fight;
            turn -= Math.sign(sl.x) * 0.8 * fight;
          }
          const jx = sd.f.jit[i * 2], jz = sd.f.jit[i * 2 + 1];
          const mel = sl.t === 'archer' || sl.t === 'gun' ? melee * 0.2 : melee;
          at(sd, fr + sl.z * sd.f.zs * gap + scatter * gap * 2 * jx, (lat + jz * (0.3 + mel + scatter * 3)) * gap, v);
          v.x += Math.sin(t * 13 + i) * mel * gap * 0.4;
          ground(v, k < 0.35 || scatter ? Math.abs(Math.sin(t * 10 + i * 1.3)) * 0.01 * s : 0);
          sd.pos[i].copy(v);
          const down = lost && sd.fall[i] < 0.35 ? Math.min(1, rout * 3) : 0;
          const flee = lost && rout > 0.1 && sd.fall[i] >= 0.35;
          e.set(down * Math.PI / 2, sd.yaw + (flee ? Math.PI : turn), 0, 'YXZ');
          q.setFromEuler(e);
          out.compose(v, q, sc.setScalar(s * FIG));
        });
        if (lost) sd.f.fade(1 - Math.max(0, rout - 0.6) / 0.4);
        if (sd.flag) {
          const down = lost ? Math.min(1, rout * 2) : 0;
          ground(at(sd, front + sd.f.depth * sd.f.zs * gap + gap, gap * 2.5, sd.flag.position));
          sd.flag.rotation.set(0, sd.yaw - Math.PI / 2, down * 1.3);
          sd.flag.scale.setScalar(Math.max(0.001, s * 1.1 * fk * (1 - (lost ? Math.max(0, rout - 0.7) / 0.3 : 0))));
          animate(sd.rigs, t);
        }
        if (sd.label) at(sd, front + gap * 3, 0, sd.label.pos).setY(c.y + 0.5 * s);
        // archers loose volleys while the lines close; riflemen fire by ranks
        const foe = sd === sides[0] ? sides[1] : sides[0];
        sd.vol -= dt;
        if (sd.vol <= 0 && k > 0.04 && k < 0.66 && !lost && fk > 0.5) {
          if (sd.archers.length) {
            sd.vol = 0.55;
            for (let j = 0; j < Math.min(14, sd.archers.length); j++) {
              const a = sd.pos[sd.archers[Math.floor(Math.random() * sd.archers.length)]];
              const b = foe.pos[Math.floor(Math.random() * foe.pos.length)];
              const d = a.distanceTo(b);
              this.missiles.fire('arrow', w.copy(a).setY(a.y + 0.55 * s * FIG), b, d * 0.35 + 0.2 * s, 0.6 + d / (D * 3) + Math.random() * 0.2, s);
            }
          } else if (sd.guns.length && k > 0.15) {
            sd.vol = 0.3;
            for (let j = 0; j < Math.min(6, sd.guns.length); j++) {
              const a = sd.pos[sd.guns[Math.floor(Math.random() * sd.guns.length)]];
              this.particles.burst('muzzle', w.copy(a).addScaledVector(sd.dir, 0.3 * s * FIG).setY(a.y + 0.45 * s * FIG), s);
            }
          } else sd.vol = 1;
        }
      }
      // siege engines bombard the gate
      shell -= dt;
      if (engines.length && shell <= 0 && k > 0.05 && k < 0.75 && fk > 0.5) {
        shell = cannon ? 0.7 : 1.2;
        const a = engines[Math.floor(Math.random() * engines.length)];
        const from = w.copy(a).setY(a.y + (cannon ? 0.2 : 0.75) * s);
        if (cannon) this.particles.burst('muzzle', from.clone().addScaledVector(ax, 0.3 * s), s * 2);
        const to = gatePos.clone().addScaledVector(side, (Math.random() - 0.5) * gap * 4).setY(gatePos.y + Math.random() * 0.4 * s);
        this.missiles.fire('stone', from, to, cannon ? from.distanceTo(to) * 0.12 : from.distanceTo(to) * 0.45, cannon ? 0.5 : 1.3, s, () => this.particles.burst('boom', to, s));
      }
    };
    const ep = this.epoch;
    const gone = () => {
      if (this.items.includes(it) && (layer !== 'story' || ep === this.epoch)) return false;
      for (const sd of sides) if (sd.label) { this.labels.remove(sd.label); sd.label = undefined; }
      return true;
    };
    // the camera: low behind the advancing line, push in at contact, crane up over the rout
    const cam = layer === 'story' && o.cam !== false;
    const p0 = this.view.pose(), base = this.view.goalDist, sp = Math.max(0.25, this.speed);
    const flank = side.clone();
    const heading = (d: THREE.Vector3) => { let h = Math.atan2(d.x, d.z); while (h - p0.heading > Math.PI) h -= Math.PI * 2; while (h - p0.heading < -Math.PI) h += Math.PI * 2; return h; };
    if (Math.abs(heading(flank) - p0.heading) > Math.abs(heading(flank.clone().negate()) - p0.heading)) flank.negate();
    const shot = (p: THREE.Vector3, dist: number, tilt: number, d: THREE.Vector3, t: number) => {
      if (!cam || gone()) return;
      const dd = THREE.MathUtils.clamp(base * dist, this.view.controls.minDistance, this.view.controls.maxDistance);
      void this.view.flyTo({ lon: this.geo.lon(p.x), lat: this.geo.lat(p.z), dist: dd, tilt, heading: heading(d) }, t / sp);
    };
    shot(at(sides[0], D * 0.35, 0), 0.72, 1.14, flank.clone().addScaledVector(ax, -0.8).normalize(), dur * 0.3);
    field.show(0.6);
    await this.tween(dur * 0.35, x => { k = x * 0.35; });
    if (gone()) return;
    battle = this.particles.emitter('battle', c.clone().setY(c.y + 0.02), () => this.s);
    this.ring(c.clone().setY(c.y + 0.02), '#ff5a36', dur * 0.4, layer, 0.8);
    shot(c, 0.5, 1.04, flank, dur * 0.12);
    if (cam) this.view.shake(0.006, dur * 0.3 / sp);
    await this.tween(dur * 0.35, x => { k = 0.35 + x * 0.35; });
    battle.stop = true;
    if (gone()) return;
    const ls = sides.find(sd => sd.id === loser);
    if (ls) {
      this.particles.emitter('smoke', c.clone(), () => this.s);
      // the loser's ground burns behind the rout
      for (let j = 0; j < 3; j++) fires.push(this.particles.emitter('fire', ground(at(ls, D * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * D * 0.8)), () => this.s * 0.6));
      for (const f of fires) f.k = 1;
    }
    shot(ls ? at(ls, D * 0.4, 0) : c, 0.95, 0.62, flank.clone().applyAxisAngle(up, 0.45), dur * 0.3);
    await this.tween(dur * 0.3, x => { k = 0.7 + x * 0.3; });
    if (gone()) return;
    for (const sd of sides) if (sd.label && sd.id === loser) { this.labels.remove(sd.label); sd.label = undefined; }
    if (o.siege && loser === 'b') {
      const top = gatePos.clone();
      top.y += s * 1.25 * 0.55;
      instance({ kind: 'flag', color: o.a }, true).then(m => {
        if (!this.items.includes(it)) return;
        const r = rig(m);
        m.position.copy(top);
        m.rotation.y = sides[0].yaw - Math.PI / 2;
        g.add(m);
        const start = this.clock;
        const prev = it.update;
        it.update = (dt, t, sc) => { prev?.(dt, t, sc); m.scale.setScalar(Math.max(0.001, s * 1.2 * fk * Math.min(1, (this.clock - start) / 0.6))); animate(r, t); };
      }).catch(() => {});
    }
    if (layer === 'story') this.tween(HOLD + 1).then(() => this.tween(FADE, x => {
      fk = 1 - x;
      field.mat.opacity = field.alpha * (1 - x);
      for (const p of props) p.m.scale.setScalar(Math.max(0.001, s * p.k * (1 - x)));
      for (const sd of sides) sd.f.fade(1 - x);
    })).then(() => {
      for (const f of fires) f.stop = true;
      for (const sd of sides) if (sd.label) this.labels.remove(sd.label);
      this.remove(it);
    });
  }

  /** A patch of trampled earth draped over the terrain, `len` along the battle axis and `wid` across each way. */
  private field(c: THREE.Vector3, ax: THREE.Vector3, side: THREE.Vector3, len: number, wid: number) {
    const N = 20, geo = new THREE.PlaneGeometry(1, 1, N, N);
    const P = geo.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      const u = P.getX(i) * 2, w = P.getY(i) * 2;
      v.copy(c).addScaledVector(ax, u * len).addScaledVector(side, w * wid);
      v.y = Math.max(0, this.geo.height(this.geo.lon(v.x), this.geo.lat(v.z))) + 0.006;
      P.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const alpha = 0.7;
    const mat = ink(new THREE.MeshBasicMaterial({ map: fieldTexture(), opacity: 0, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = INK.field;
    return { mesh, mat, alpha, show: (dur: number) => { void this.tween(dur, x => { mat.opacity = alpha * x; }); } };
  }

  /**
   * A camera shot around a point (default: the current target): `wide` establishing view, `low` angle near the
   * ground, `close` push-in, `top` overhead, `side` swing 90°, or `shake`. `heading` (degrees, 0 = looking north) fixes
   * the direction. Shots run on real time scaled by the story speed.
   */
  shot(o: { shot: Shot; lon?: number; lat?: number; heading?: number; dur?: number }): Promise<void> {
    const v = this.view, p = v.pose(), dur = (o.dur ?? 2) / Math.max(0.25, this.speed);
    if (o.shot === 'shake') { v.shake(0.008, dur); return this.wait(o.dur ?? 2); }
    const [k, tilt, turn] = ({ wide: [1.7, 0.72, 0], low: [0.65, 1.2, 0], close: [0.42, 1.02, 0], top: [1.1, 0.12, 0], side: [0.8, 1.05, Math.PI / 2] } as const)[o.shot];
    const heading = o.heading !== undefined ? (o.heading * Math.PI) / 180 : p.heading + turn;
    const dist = THREE.MathUtils.clamp(p.dist * k, v.controls.minDistance, v.controls.maxDistance);
    return v.flyTo({ lon: o.lon ?? p.lon, lat: o.lat ?? p.lat, dist, tilt, heading }, dur);
  }

  /** A fleet sailing a sea route in V formation, leaving wakes. */
  async fleet(o: FleetOpts, layer: Layer = 'story'): Promise<void> {
    const s = this.s, n = Math.min(9, o.count ?? 5);
    const path = this.path(o.pts, 0.02);
    const line = this.trailArrow(path, o.color ?? '#1f5f8b');
    const g = new THREE.Group();
    g.add(line.obj);
    const it = this.add({ layer, obj: g, own: line.own });
    const ships: { m: THREE.Object3D; rigs: ReturnType<typeof rig>; wake: ReturnType<Particles['emitter']> }[] = [];
    for (let i = 0; i < n; i++) {
      instance({ kind: o.model ?? 'junk', color: o.color }, true).then(m => {
        if (!this.items.includes(it)) return;
        g.add(m);
        ships[i] = { m, rigs: rig(m), wake: this.particles.emitter('wake', new THREE.Vector3(), () => this.s) };
      }).catch(() => {});
    }
    if (o.label) it.label = this.labels.add({ el: tag(o.label, 'army', o.color ?? '#1f5f8b'), pos: new THREE.Vector3(), prio: 70, group: 'story', anchor: 'above' });
    let k = 0, sailing = true;
    const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), v = new THREE.Vector3();
    it.update = (_dt, t, scale) => {
      line.frame(k, scale, true);
      const z = Math.min(scale, s * 1.4), gap = 0.75 * z;
      const hd = this.at(path, k, tmp);
      const sideV = new THREE.Vector3().crossVectors(up, hd.dir).normalize();
      ships.forEach((sh, i) => {
        if (!sh) return;
        const rank = Math.ceil(i / 2), lr = i % 2 ? 1 : -1;
        const a = this.at(path, Math.max(0, k - (rank * gap) / path.total), v);
        sh.m.position.copy(a.pos).addScaledVector(sideV, lr * rank * gap * 0.7);
        // inland rivers sit above sea level
        sh.m.position.y = Math.max(0, this.geo.height(this.geo.lon(sh.m.position.x), this.geo.lat(sh.m.position.z))) + 0.01 + Math.sin(t * 2 + i) * 0.006 * z;
        sh.m.rotation.set(Math.sin(t * 1.7 + i) * 0.04, Math.atan2(a.dir.x, a.dir.z), Math.sin(t * 1.3 + i) * 0.05);
        sh.m.scale.setScalar(z * 1.35);
        animate(sh.rigs, t);
        sh.wake.p.copy(sh.m.position).addScaledVector(a.dir, -0.55 * z);
        sh.wake.k = sailing ? 1 : 0.2;
      });
      if (it.label) it.label.pos.copy(hd.pos).setY(1.3 * z);
    };
    if (o.follow) this.followWith(() => tmp);
    await this.tween(o.dur, x => { k = x; line.reveal(x); });
    sailing = false;
    if (o.follow) this.followWith(null);
    if (layer === 'story' && !o.keep) this.tween(HOLD).then(() => { for (const sh of ships) if (sh) sh.wake.stop = true; return this.tween(FADE, x => line.fade(x)); }).then(() => this.remove(it));
  }

  /** A large banner caption standing over a point (battle names, new dynasties). */
  async banner(o: { lon: number; lat: number; text: string; sub?: string; color?: string; dur?: number }, layer: Layer = 'story'): Promise<void> {
    const el = document.createElement('div');
    el.className = 'tag tag-banner';
    if (o.color) el.style.setProperty('--c', o.color);
    el.append(Object.assign(document.createElement('b'), { textContent: o.text }));
    if (o.sub) el.append(Object.assign(document.createElement('small'), { textContent: o.sub }));
    const g = new THREE.Group();
    const it = this.add({ layer, obj: g, own: [] });
    it.label = this.labels.add({ el, pos: this.geo.pos(o.lon, o.lat, 0.35), prio: 96, group: 'story', anchor: 'above', pinned: true });
    const dur = o.dur ?? 4;
    this.tween(dur).then(() => { el.classList.add('out'); return this.tween(0.6); }).then(() => this.remove(it));
    await this.wait(0.8);
  }

  /** Swings the camera around its target by `deg` degrees. */
  orbit(deg: number, dur: number): Promise<void> {
    const v = this.view, t = v.controls.target, up = new THREE.Vector3(0, 1, 0);
    let last = 0;
    return this.tween(dur, k => {
      const e = k * k * (3 - 2 * k);
      const off = v.camera.position.clone().sub(t).applyAxisAngle(up, ((e - last) * deg * Math.PI) / 180);
      last = e;
      v.camera.position.copy(t).add(off);
      v.camera.lookAt(t);
    });
  }

  private follow: (() => THREE.Vector3) | null = null;
  /** While set, the camera target glides after the given point (marching armies, fleets). */
  followWith(get: (() => THREE.Vector3) | null): void { this.follow = get; }
  private stepFollow(dt: number): void {
    if (!this.follow || this.paused || this.view.flying) return;
    const p = this.follow(), t = this.view.controls.target;
    const d = new THREE.Vector3(p.x - t.x, 0, p.z - t.z).multiplyScalar(1 - Math.exp(-dt * 1.8));
    t.add(d);
    this.view.camera.position.add(d);
  }

  /** Spawns a model rising out of the ground with a blob shadow and an optional label. */
  async spawn(o: {
    lon: number; lat: number; model: ModelRecipe; scale?: number; yaw?: number;
    label?: string | HTMLElement; labelClass?: string; labelMaxD?: number;
    /** shown only while the camera is within this distance (minor scenery appears as you zoom in) */
    maxD?: number;
    /** colour of the thin base ring every map item stands in (its type colour, see docs/design/map-design.md) */
    ring?: string;
  }, layer: Layer = 'story'): Promise<THREE.Object3D | null> {
    const g = new THREE.Group();
    const base = this.geo.pos(o.lon, o.lat, 0);
    if (!this.geo.isLand(o.lon, o.lat)) base.y = Math.max(-0.02, this.geo.height(o.lon, o.lat));
    g.position.copy(base);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }));
    sh.position.y = 0.006;
    sh.renderOrder = 2;
    g.add(sh);
    const it = this.add({ layer, obj: g, own: [sh.geometry, sh.material as THREE.Material] });
    let base0: THREE.Mesh | null = null;
    if (o.ring) {
      base0 = new THREE.Mesh(this.baseRing, ink(new THREE.MeshBasicMaterial({ color: o.ring, opacity: 0.65, side: THREE.DoubleSide })));
      base0.renderOrder = INK.ring;
      g.add(base0);
      it.own.push(base0.material as THREE.Material);
    }
    if (o.label) {
      const el = typeof o.label === 'string' ? tag(o.label, o.labelClass ?? 'model') : o.label;
      it.label = this.labels.add({ el, pos: base.clone(), prio: layer === 'scenery' ? 44 : 80, group: layer === 'story' || layer === 'event' ? 'story' : layer, anchor: 'above', maxD: o.labelMaxD });
    }
    let m: THREE.Group;
    try { m = await instance(o.model, true); } catch { this.remove(it); return null; }
    if (!this.items.includes(it)) return null;
    m.rotation.y = o.yaw ?? (Math.random() - 0.5) * 0.6;
    g.add(m);
    const rigs = rig(m);
    const seed = Math.random() * 10;
    const r = (m.userData.radius as number | undefined) ?? 0.5, h = (m.userData.height as number | undefined) ?? 1;
    let grow = 0;
    const k0 = o.scale ?? 1;
    // hover / pick state shared with the atlas: `boost` is the wanted size bump (1 = none), `top` and `rad` the model's
    // current height and footprint radius in world units, `shown` whether it is standing at this zoom
    const ud = g.userData as SpawnState;
    ud.boost = 1; ud.k = 1; ud.top = 0; ud.rad = 0; ud.shown = true;
    it.update = (dt, t, sc) => {
      ud.k += (ud.boost - ud.k) * Math.min(1, dt * 14);
      const z = (layer === 'story' ? sc : mapScale(this.dist)) * k0 * (layer === 'base' || layer === 'scenery' ? 0.7 : 1) * ud.k;
      const e = easeBack(grow);
      m.scale.setScalar(Math.max(0.001, z * e));
      sh.scale.setScalar(Math.max(0.001, z * r * 2.6 * Math.min(1, grow * 2)));
      if (base0) base0.scale.setScalar(Math.max(0.001, z * THREE.MathUtils.clamp(r, 0.22, 0.5) * 1.15 * Math.min(1, grow * 2)));
      if (o.maxD !== undefined) m.visible = sh.visible = this.dist <= o.maxD;
      if (base0) base0.visible = m.visible;
      ud.top = h * z * e; ud.rad = r * z; ud.shown = m.visible;
      animate(rigs, t, seed);
      // the name clears the model's far rim too (wide dioramas would otherwise wear it on their back half)
      if (it.label) { it.label.pos.set(base.x, base.y + (h * e + r * 0.5 + 0.05) * z, base.z); it.label.off = !g.visible || !m.visible; }
    };
    it.update(0, 0, this.s);
    // the rise uses real time when paused so selected-event models still appear
    const start = performance.now();
    const step = () => {
      grow = Math.min(1, (performance.now() - start) / (RISE * 1000));
      if (grow < 1 && this.items.includes(it)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return g;
  }

  /** Effects at a point. Resolves after `dur`. */
  async fx(o: { lon: number; lat: number; fx: FxKind; color?: string; dur?: number }, layer: Layer = 'story'): Promise<void> {
    const dur = o.dur ?? 3;
    const p = this.geo.pos(o.lon, o.lat, 0.02);
    if (o.fx === 'flag') {
      await this.spawn({ lon: o.lon, lat: o.lat, model: { kind: 'flag', color: o.color ?? '#d22' }, scale: 0.8 }, layer);
      await this.wait(Math.min(dur, 1));
      return;
    }
    if (o.fx === 'glow') { this.ring(p, o.color ?? '#ffd76a', dur, layer); await this.wait(dur); return; }
    const em = this.particles.emitter(o.fx, p, () => this.s, o.color);
    if (o.fx === 'battle') this.ring(p, '#ff5a36', dur, layer, 0.9);
    await this.tween(dur, k => { em.k = k; });
    em.stop = true;
  }

  /** Expanding glow rings on the ground. */
  ring(p: THREE.Vector3, color: string, dur: number, layer: Layer = 'story', period = 1.3): void {
    const geo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    const mats: THREE.MeshBasicMaterial[] = [];
    const g = new THREE.Group();
    g.position.copy(p);
    for (let i = 0; i < 3; i++) {
      const mat = ink(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), true);
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = INK.ring;
      mats.push(mat);
      g.add(m);
    }
    const it = this.add({ layer, obj: g, own: [geo, ...mats] });
    let age = 0;
    it.update = (dt, _t, sc) => {
      age += dt;
      g.children.forEach((c, i) => {
        const k = ((age / period + i / 3) % 1);
        const alive = age < dur || k > (age - dur) / period;
        c.scale.setScalar(Math.max(0.001, sc * (0.15 + k * 1.3)));
        mats[i].opacity = alive && age < dur + period ? (1 - k) * 0.9 : 0;
      });
      if (age > dur + period) this.remove(it);
    };
  }
}

function tag(text: string, cls: string, color?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `tag tag-${cls}`;
  if (color) el.style.setProperty('--c', color);
  el.textContent = text;
  return el;
}

function blobTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(30,20,10,0.75)');
  gr.addColorStop(0.6, 'rgba(30,20,10,0.25)');
  gr.addColorStop(1, 'rgba(30,20,10,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

let fieldTex: THREE.Texture | null = null;
/** Trampled, scuffed earth fading out at the edges. */
function fieldTexture(): THREE.Texture {
  if (fieldTex) return fieldTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, 'rgba(120,96,64,0.7)');
  gr.addColorStop(0.65, 'rgba(120,96,64,0.45)');
  gr.addColorStop(1, 'rgba(120,96,64,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 118;
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '70,56,40' : '160,136,98'},${0.12 + Math.random() * 0.2})`;
    x.fillRect(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2 + Math.random() * 5, 1 + Math.random() * 2);
  }
  fieldTex = new THREE.CanvasTexture(c);
  fieldTex.colorSpace = THREE.SRGBColorSpace;
  return fieldTex;
}

// ---------------------------------------------------------------- missiles

interface Missile { a: THREE.Vector3; b: THREE.Vector3; h: number; t: number; T: number; s: number; stone: boolean; hit?: () => void }

/** Arrows and stones in flight on parabolic arcs (instanced; arrows point along their velocity). */
class Missiles {
  readonly arrows: THREE.InstancedMesh;
  readonly stones: THREE.InstancedMesh;
  private list: Missile[] = [];

  constructor() {
    const ag = new THREE.CylinderGeometry(0.012, 0.012, 1, 3).rotateX(Math.PI / 2);
    this.arrows = new THREE.InstancedMesh(ag, new THREE.MeshBasicMaterial({ color: '#efe4c8' }), 400);
    this.stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#4a4540', roughness: 0.9, flatShading: true }), 40);
    for (const m of [this.arrows, this.stones]) { m.count = 0; m.frustumCulled = false; }
  }

  fire(kind: 'arrow' | 'stone', a: THREE.Vector3, b: THREE.Vector3, h: number, T: number, s: number, hit?: () => void): void {
    const stone = kind === 'stone';
    if (this.list.filter(m => m.stone === stone).length >= (stone ? 40 : 400)) return;
    this.list.push({ a: a.clone(), b: b.clone(), h, t: 0, T, s, stone, hit });
  }

  clear(): void { this.list = []; this.arrows.count = this.stones.count = 0; }

  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private d = new THREE.Vector3(); private sc = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);

  step(dt: number): void {
    let na = 0, ns = 0;
    for (const m of this.list.slice()) {
      m.t += dt;
      const u = Math.min(1, m.t / m.T);
      if (u >= 1) { this.list.splice(this.list.indexOf(m), 1); m.hit?.(); continue; }
      this.p.lerpVectors(m.a, m.b, u);
      this.p.y += 4 * m.h * u * (1 - u);
      if (m.stone) {
        this.m4.compose(this.p, this.q.identity(), this.sc.setScalar(m.s * 0.05));
        this.stones.setMatrixAt(ns++, this.m4);
      } else {
        this.d.subVectors(m.b, m.a);
        this.d.y += 4 * m.h * (1 - 2 * u);
        this.q.setFromUnitVectors(this.fwd, this.d.normalize());
        this.m4.compose(this.p, this.q, this.sc.set(m.s, m.s, m.s * 0.22));
        this.arrows.setMatrixAt(na++, this.m4);
      }
    }
    this.arrows.count = na;
    this.stones.count = ns;
    this.arrows.instanceMatrix.needsUpdate = true;
    this.stones.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- particles

type EmitKind = Exclude<FxKind, 'flag' | 'glow'> | 'dust' | 'wake';
interface Emitter { kind: EmitKind; p: THREE.Vector3; scale: () => number; color?: string; acc: number; k: number; stop: boolean; age: number }

/** Journey trail: rich body, fine dark rim, soft shadow and paper dashes flowing along the spine (colours are sRGB). */
const TRAIL_VERT = /* glsl */ `
attribute float aSide;
attribute float aDist;
varying float vSide;
varying float vDist;
void main() {
  vSide = aSide;
  vDist = aDist;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TRAIL_FRAG = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uRim;
uniform vec3 uLight;
uniform vec3 uPaper;
uniform float uB;
uniform float uR;
uniform float uFlow;
uniform float uPeriod;
uniform float uOpacity;
uniform float uGap;
varying float vSide;
varying float vDist;
void main() {
  // a dashed variant breaks the whole stroke into even dashes (planned or uncertain routes)
  float on = 1.0;
  if (uGap > 0.0) {
    float g = fract(vDist / uGap), w = max(fwidth(vDist / uGap), 1e-4);
    on = smoothstep(0.0, w, g) * (1.0 - smoothstep(0.62 - w, 0.62 + w, g));
  }
  float a = abs(vSide);
  float aa = max(fwidth(a), 1e-4);
  float body = 1.0 - smoothstep(uB - aa, uB + aa, a);
  float stroke = 1.0 - smoothstep(uR - aa, uR + aa, a);
  // lit from the upper left like the terrain: a soft sheen on one flank of the stroke
  float lit = smoothstep(-uB, uB, vSide) * (1.0 - smoothstep(uB * 0.55, uB, a));
  vec3 c = mix(uBody, uLight, lit * 0.55);
  c = mix(uRim, c, body);
  // flowing paper dashes on the spine show the direction of travel
  float ph = fract((vDist - uFlow) / uPeriod);
  float dash = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.42, 0.48, ph));
  float spine = 1.0 - smoothstep(0.17 * uB - aa, 0.17 * uB + aa, a);
  c = mix(c, uPaper, dash * spine * 0.92);
  float shadow = (1.0 - smoothstep(uR, 1.0, a)) * 0.38;
  float alpha = stroke + (1.0 - stroke) * shadow;
  vec3 col = mix(vec3(0.11, 0.08, 0.05), c, stroke / max(alpha, 1e-4));
  gl_FragColor = vec4(col, alpha * on * uOpacity);
}`;

const PVERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
uniform float uPx;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uPx / -mv.z, 0.0, 160.0);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * smoothstep(1.0, 0.25, r));
}`;

/** Two CPU-simulated point pools: additive (sparks, flames, fireworks) and normal-blended (smoke). */
class Particles {
  readonly add: THREE.Points;
  readonly norm: THREE.Points;
  private pools: Pool[];
  private emitters: Emitter[] = [];

  constructor() {
    const a = new Pool(1600, true), n = new Pool(700, false);
    this.pools = [a, n];
    this.add = a.points;
    this.norm = n.points;
  }

  emitter(kind: FxKind | EmitKind, p: THREE.Vector3, scale: () => number, color?: string): Emitter {
    const e: Emitter = { kind: kind as EmitKind, p: p.clone(), scale, color, acc: 0, k: kind === 'dust' || kind === 'wake' ? 1 : 0, stop: false, age: 0 };
    this.emitters.push(e);
    return e;
  }

  clear(): void {
    this.emitters = [];
    for (const p of this.pools) p.clear();
  }

  /** One-off bursts: a musket/cannon muzzle flash with powder smoke, or a stone striking (flame, dust and smoke). */
  burst(kind: 'muzzle' | 'boom', p: THREE.Vector3, s: number): void {
    const [A, N] = this.pools;
    const r = () => (Math.random() - 0.5) * 2;
    if (kind === 'muzzle') {
      for (let i = 0; i < 3; i++) A.spawn(p.x, p.y, p.z, r() * 0.15 * s, r() * 0.15 * s, r() * 0.15 * s, 0.18, 0.08 * s, [1, 0.8, 0.35], 0);
      N.spawn(p.x, p.y, p.z, r() * 0.06 * s, 0.08 * s, r() * 0.06 * s, 1.8, 0.16 * s, [0.86, 0.84, 0.8], -0.02, 0.5);
    } else {
      for (let i = 0; i < 14; i++) A.spawn(p.x, p.y, p.z, r() * 0.7 * s, Math.random() * 0.9 * s, r() * 0.7 * s, 0.5, 0.1 * s, Math.random() < 0.5 ? [1, 0.6, 0.15] : [1, 0.85, 0.4], 1.6);
      for (let i = 0; i < 5; i++) N.spawn(p.x + r() * 0.1 * s, p.y, p.z + r() * 0.1 * s, r() * 0.12 * s, 0.25 * s, r() * 0.12 * s, 2.4, 0.3 * s, i < 2 ? [0.62, 0.52, 0.4] : [0.3, 0.28, 0.27], -0.04, 0.55);
    }
  }

  step(dt: number, px: number): void {
    const [A, N] = this.pools;
    for (const e of this.emitters.slice()) {
      if (e.stop) { this.emitters.splice(this.emitters.indexOf(e), 1); continue; }
      e.age += dt;
      const s = e.scale();
      const r = () => (Math.random() - 0.5) * 2;
      e.acc += dt;
      switch (e.kind) {
        case 'battle':
          while (e.acc > 0.03) {
            e.acc -= 0.03;
            const ox = r() * 0.5 * s, oz = r() * 0.5 * s;
            for (let i = 0; i < 4; i++) A.spawn(e.p.x + ox, e.p.y + 0.05 * s, e.p.z + oz, r() * 0.6 * s, (0.5 + Math.random()) * 0.9 * s, r() * 0.6 * s, 0.5, 0.09 * s, Math.random() < 0.5 ? [1, 0.75, 0.2] : [1, 0.35, 0.1], 1.4);
            if (Math.random() < 0.5) N.spawn(e.p.x + ox, e.p.y + 0.05 * s, e.p.z + oz, r() * 0.05 * s, 0.25 * s, r() * 0.05 * s, 2.2, 0.35 * s, [0.35, 0.32, 0.3], -0.05, 0.55);
          }
          break;
        case 'fire':
          while (e.acc > 0.02) {
            e.acc -= 0.02;
            A.spawn(e.p.x + r() * 0.35 * s, e.p.y, e.p.z + r() * 0.35 * s, r() * 0.05 * s, (0.4 + Math.random() * 0.4) * s, r() * 0.05 * s, 0.9, 0.22 * s, Math.random() < 0.6 ? [1, 0.5, 0.1] : [1, 0.85, 0.3], -0.1);
            if (Math.random() < 0.25) N.spawn(e.p.x + r() * 0.2 * s, e.p.y + 0.3 * s, e.p.z + r() * 0.2 * s, r() * 0.06 * s, 0.35 * s, r() * 0.06 * s, 2.6, 0.4 * s, [0.25, 0.22, 0.2], -0.04, 0.5);
          }
          break;
        case 'smoke':
          while (e.acc > 0.06) {
            e.acc -= 0.06;
            N.spawn(e.p.x + r() * 0.25 * s, e.p.y, e.p.z + r() * 0.25 * s, r() * 0.06 * s, 0.3 * s, r() * 0.06 * s, 3.2, 0.45 * s, [0.45, 0.42, 0.4], -0.02, 0.5);
          }
          break;
        case 'dust':
          while (e.acc > 0.05) {
            e.acc -= 0.05;
            if (e.k <= 0) continue;
            N.spawn(e.p.x + r() * 0.25 * s, e.p.y + 0.02 * s, e.p.z + r() * 0.25 * s, r() * 0.08 * s, 0.12 * s, r() * 0.08 * s, 2.0, 0.42 * s, [0.72, 0.62, 0.46], -0.02, 0.42);
          }
          break;
        case 'wake':
          while (e.acc > 0.07) {
            e.acc -= 0.07;
            if (e.k <= 0.3 && Math.random() > e.k) continue;
            N.spawn(e.p.x + r() * 0.04 * s, e.p.y, e.p.z + r() * 0.04 * s, r() * 0.05 * s, 0, r() * 0.05 * s, 2.4, 0.16 * s, [0.97, 0.98, 1], 0, 0.6);
          }
          break;
        case 'firework':
          while (e.acc > 0.45) {
            e.acc -= 0.45;
            const c = new THREE.Color(e.color && Math.random() < 0.4 ? e.color : new THREE.Color().setHSL(Math.random(), 0.9, 0.6));
            const cx = e.p.x + r() * 0.8 * s, cy = e.p.y + (1.2 + Math.random() * 0.8) * s, cz = e.p.z + r() * 0.8 * s;
            for (let i = 0; i < 70; i++) {
              const th = Math.random() * Math.PI * 2, ph = Math.acos(r());
              const v = (0.7 + Math.random() * 0.3) * 0.9 * s;
              A.spawn(cx, cy, cz, Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v, Math.sin(ph) * Math.sin(th) * v, 1.3, 0.09 * s, [c.r, c.g, c.b], 0.9);
            }
          }
          break;
      }
    }
    for (const p of this.pools) p.step(dt, px);
  }
}

class Pool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private base: Float32Array;
  private grav: Float32Array;
  private alpha: Float32Array;
  private next = 0;
  private live = 0;
  private mat: THREE.ShaderMaterial;

  constructor(private n: number, additive: boolean) {
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.base = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.alpha = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG, uniforms: { uPx: { value: 500 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 7 : 6;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, rgb: number[], grav: number, alpha = 1): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([rgb[0], rgb[1], rgb[2], alpha], i * 4);
    this.life[i] = life;
    this.max[i] = life;
    this.base[i] = size;
    this.grav[i] = grav;
    this.alpha[i] = alpha;
    this.live = Math.min(this.n, this.live + 1);
  }

  clear(): void {
    this.life.fill(0);
    this.size.fill(0);
    this.live = 0;
    (this.points.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  step(dt: number, px: number): void {
    this.mat.uniforms.uPx.value = px;
    if (!this.live) return;
    let any = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      any++;
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.max[i];
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const drag = Math.pow(0.35, dt);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 1] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const smoke = this.grav[i] < 0 && this.alpha[i] < 0.9;
      this.size[i] = this.life[i] > 0 ? this.base[i] * (smoke ? 0.6 + k * 1.6 : 1 - k * 0.6) : 0;
      this.col[i * 4 + 3] = this.alpha[i] * (k < 0.1 ? k / 0.1 : 1 - k);
    }
    if (!any) this.live = 0;
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }
}
