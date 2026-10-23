import * as THREE from 'three';
import type { LonLat, ModelRecipe, Troops } from '../../shared/data/types.ts';
import { instance } from '../models/library.ts';
import { riderGeometry, soldierGeometry, troopMaterial } from './troops.ts';
import { animate, rig } from './animate.ts';
import type { Geo } from './geo.ts';
import type { Label, Labels } from './labels.ts';
import type { View } from './view.ts';

export type FxKind = 'battle' | 'fire' | 'glow' | 'flag' | 'smoke' | 'firework';
export type Layer = 'story' | 'event' | 'base' | 'works';
export interface ArmyOpts { from?: LonLat; to?: LonLat; pts?: LonLat[]; color: string; dur: number; count?: number; unit?: Troops; label?: string; follow?: boolean; keep?: boolean; retreat?: boolean }
export interface ClashOpts { lon: number; lat: number; a: string; b: string; winner?: 'a' | 'b'; angle?: number; dur?: number; count?: number; labels?: [string?, string?]; units?: [Troops?, Troops?] }
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
  private shadowTex = blobTexture();
  speed = 1;
  paused = false;
  /** current model scale: models stay readable at every zoom */
  s = 1;
  private clock = 0;

  constructor(private view: View, private geo: Geo, private labels: Labels) {
    this.root.name = 'fx';
    view.scene.add(this.root);
    this.particles = new Particles();
    this.root.add(this.particles.add, this.particles.norm);
    view.onFrame((dt, t) => this.frame(dt, t));
  }

  private frame(dt: number, t: number): void {
    const d = this.view.camera.position.distanceTo(this.view.controls.target);
    this.s = THREE.MathUtils.clamp(d * 0.028, 0.09, 1.5);
    const sdt = this.paused ? 0 : dt * this.speed;
    this.clock += sdt;
    for (const tw of this.tweens.slice()) {
      tw.t = Math.min(tw.dur, tw.t + sdt);
      tw.fn(tw.dur > 0 ? tw.t / tw.dur : 1);
      if (tw.t >= tw.dur) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    for (const it of this.items) it.update?.(sdt, t, this.s);
    this.stepFollow(sdt);
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
    return it;
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
      const tw = this.tweens.splice(0);
      for (const x of tw) x.done();
      this.particles.clear();
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
  path(pts: LonLat[], lift: number): { p: THREE.Vector3[]; len: number[]; total: number } {
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

  private at(path: { p: THREE.Vector3[]; len: number[]; total: number }, k: number, out = new THREE.Vector3()): { pos: THREE.Vector3; dir: THREE.Vector3; i: number } {
    const d = THREE.MathUtils.clamp(k, 0, 1) * path.total;
    let i = 1;
    while (i < path.len.length - 1 && path.len[i] < d) i++;
    const a = path.p[i - 1] ?? path.p[0], b = path.p[i] ?? a;
    const seg = path.len[i] - path.len[i - 1] || 1;
    const u = THREE.MathUtils.clamp((d - path.len[i - 1]) / seg, 0, 1);
    out.lerpVectors(a, b, u);
    return { pos: out, dir: b.clone().sub(a).setY(0).normalize(), i };
  }

  /** A flat ribbon along a path (optionally tapering), revealed progressively via drawRange. */
  private ribbon(path: { p: THREE.Vector3[]; len: number[]; total: number }, width: number, color: string, opacity: number, taper = false): { mesh: THREE.Mesh; reveal: (k: number) => void; mat: THREE.MeshBasicMaterial } {
    const n = path.p.length;
    const pos = new Float32Array(n * 2 * 3);
    const side = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
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
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 3;
    const reveal = (k: number) => {
      const d = k * path.total;
      let i = 0;
      while (i < n - 1 && path.len[i + 1] <= d) i++;
      g.setDrawRange(0, Math.max(0, i) * 6);
    };
    reveal(0);
    return { mesh, reveal, mat };
  }

  private arrowHead(color: string, size: number): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-size * 0.6, 0, -size * 0.2, size * 0.6, 0, -size * 0.2, 0, 0, size * 0.9]), 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 4;
    return m;
  }

  /** Animated route: a tapered arrow that grows along the path, optionally carrying a model at its head. */
  async route(o: { pts: LonLat[]; dur: number; color?: string; model?: ModelRecipe; label?: string; dashed?: boolean; keep?: boolean }, layer: Layer = 'story'): Promise<void> {
    const color = o.color ?? '#c0392b';
    const s = this.s;
    const path = this.path(o.pts, 0.03);
    const rb = this.ribbon(path, 0.16 * s, color, o.dashed ? 0.55 : 0.8, !o.dashed);
    const head = this.arrowHead(color, 0.32 * s);
    const g = new THREE.Group();
    g.add(rb.mesh, head);
    const it = this.add({ layer, obj: g, own: [rb.mesh.geometry, rb.mat, head.geometry, head.material as THREE.Material] });
    let carrier: THREE.Object3D | null = null;
    let rigs: ReturnType<typeof rig> = [];
    if (o.model) {
      instance(o.model, true).then(m => {
        if (!this.items.includes(it)) return;
        carrier = m;
        rigs = rig(m);
        g.add(m);
      }).catch(() => {});
    }
    if (o.label) it.label = this.labels.add({ el: tag(o.label, 'route'), pos: path.p[Math.floor(path.p.length / 2)].clone().setY(path.p[Math.floor(path.p.length / 2)].y + 0.2), prio: 50, group: 'story' });
    const tmp = new THREE.Vector3();
    let k = 0;
    it.update = (_dt, t, sc) => {
      const a = this.at(path, k, tmp);
      head.position.copy(a.pos).setY(a.pos.y + 0.01);
      head.rotation.y = Math.atan2(a.dir.x, a.dir.z);
      head.visible = k < 0.999 || !carrier;
      if (carrier) {
        carrier.position.copy(a.pos);
        carrier.position.y = Math.max(a.pos.y - 0.03, -0.02);
        carrier.rotation.y = Math.atan2(a.dir.x, a.dir.z);
        carrier.scale.setScalar(sc * 0.75);
        animate(rigs, t);
      }
    };
    await this.tween(o.dur, x => { k = easeOut(x) * 0.15 + x * 0.85; rb.reveal(k); });
    rb.reveal(1);
    if (!o.keep && layer === 'story') {
      this.tween(2.5).then(() => this.tween(0.8, x => { rb.mat.opacity = 0.8 * (1 - x); head.visible = false; })).then(() => { if (!carrier) this.remove(it); });
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
      const mat = new THREE.MeshStandardMaterial({ color: o.color ?? '#b8a27c', roughness: 0.9, flatShading: true });
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
    const rb = this.ribbon(path, (canal ? 0.13 : 0.08) * s, o.color ?? (canal ? '#2f7fc4' : '#3d3229'), 0.92);
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
        const mat = new THREE.MeshStandardMaterial({ color: '#a8916a', roughness: 0.9, flatShading: true });
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
        const style = o.kind === 'canal' ? { w: 0.075, c: '#2f7fc4', a: 0.9 } : o.kind === 'sea' ? { w: 0.07, c: '#1f5f8b', a: 0.5 } : { w: 0.05, c: '#8a5a2b', a: 0.75 };
        const rb = this.ribbon(path, style.w, style.c, style.a);
        rb.reveal(1);
        g.add(rb.mesh);
        it.own.push(rb.mesh.geometry, rb.mat);
      }
    }
    if (o.label && o.labelAt) {
      it.label = this.labels.add({ el: tag(o.label, `work k-${o.kind}`), pos: this.geo.pos(o.labelAt[0], o.labelAt[1], 0.12), prio: 26, group: 'works', maxD: 70 });
    }
  }

  /**
   * A marching army: a campaign arrow along the route, a formation of soldiers (cavalry in front for mixed units) with
   * a war banner, kicking up dust. `follow` makes the camera ride along.
   */
  async army(o: ArmyOpts, layer: Layer = 'story'): Promise<void> {
    const s = this.s;
    const pts = o.pts && o.pts.length >= 2 ? o.pts : bow(o.from ?? o.pts![0], o.to ?? o.pts![o.pts!.length - 1]);
    const path = this.path(pts, 0.035);
    const rb = this.ribbon(path, 0.3 * s, o.color, o.retreat ? 0.45 : 0.72, true);
    const head = this.arrowHead(o.color, 0.6 * s);
    const n = Math.min(90, o.count ?? 30);
    const unit = o.unit ?? 'foot';
    const troops = this.formation(n, unit, o.color);
    const g = new THREE.Group();
    g.add(rb.mesh, head, ...troops.meshes);
    const it = this.add({ layer, obj: g, own: [rb.mesh.geometry, rb.mat, head.geometry, head.material as THREE.Material, ...troops.own] });
    let banner: THREE.Object3D | null = null, rigs: ReturnType<typeof rig> = [];
    instance({ kind: 'flag', color: o.color }, true).then(m => { if (this.items.includes(it)) { banner = m; rigs = rig(m); g.add(m); } }).catch(() => {});
    if (o.label) it.label = this.labels.add({ el: tag(o.label, 'army', o.color), pos: new THREE.Vector3(), prio: 70, group: 'story', anchor: 'above' });
    const dust = this.particles.emitter('dust', new THREE.Vector3(), () => this.s);
    let k = 0, moving = true;
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), tmp = new THREE.Vector3();
    const cols = Math.max(4, Math.min(9, Math.round(Math.sqrt(n * 0.9))));
    it.update = (_dt, t, scale) => {
      const z = Math.min(scale, s * 1.5);
      const hd = this.at(path, k, tmp);
      head.position.copy(hd.pos).setY(hd.pos.y + 0.012);
      const yaw = Math.atan2(hd.dir.x, hd.dir.z);
      head.rotation.y = yaw;
      q.setFromAxisAngle(up, yaw);
      const side = new THREE.Vector3().crossVectors(up, hd.dir).normalize();
      const gap = 0.085 * z;
      troops.place((i, out) => {
        const r = Math.floor(i / cols), c = (i % cols) - (cols - 1) / 2;
        const back = (r + 1) * gap * 1.25 + troops.jit[i * 2] * gap * 0.4;
        const p = this.at(path, Math.max(0, k - back / path.total), v).pos;
        p.addScaledVector(side, (c + troops.jit[i * 2 + 1] * 0.3) * gap);
        p.y = Math.max(0, this.geo.height(this.geo.lon(p.x), this.geo.lat(p.z))) + (moving ? Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.012 * z : 0);
        out.compose(p, q, v.setScalar(z * 0.11));
      });
      const rear = this.at(path, Math.max(0, k - (Math.ceil(n / cols) + 1) * gap * 1.25 / path.total), v).pos;
      dust.p.copy(rear);
      dust.k = moving ? 1 : 0;
      if (banner) {
        banner.position.copy(hd.pos).addScaledVector(hd.dir, -gap * 0.5);
        banner.scale.setScalar(z * 0.4);
        banner.rotation.y = yaw - Math.PI / 2;
        animate(rigs, t);
      }
      if (it.label) it.label.pos.copy(hd.pos).setY(hd.pos.y + 0.55 * z);
    };
    if (o.follow) this.followWith(() => tmp);
    await this.tween(o.dur, x => { k = 0.7 * x + 0.3 * x * x * (3 - 2 * x); rb.reveal(k); });
    k = 1; moving = false;
    rb.reveal(1);
    dust.stop = true;
    if (o.follow) this.followWith(null);
    if (layer === 'story' && !o.keep) this.tween(3).then(() => this.tween(0.8, x => { rb.mat.opacity = 0.72 * (1 - x); troops.fade(1 - x); })).then(() => this.remove(it));
  }

  /** Instanced soldiers (and riders) sharing a material; `place` positions slot i. */
  private formation(n: number, unit: Troops, color: string) {
    const nh = unit === 'horse' ? n : unit === 'mixed' ? Math.round(n * 0.35) : 0;
    const mat = troopMaterial();
    const horse = nh ? new THREE.InstancedMesh(riderGeometry(), mat, nh) : null;
    const foot = n - nh ? new THREE.InstancedMesh(soldierGeometry(), mat, n - nh) : null;
    const col = new THREE.Color(color);
    const tint = (m: THREE.InstancedMesh | null) => { if (m) for (let i = 0; i < m.count; i++) m.setColorAt(i, col.clone().offsetHSL(0, 0, (i % 3) * 0.05 - 0.05)); };
    tint(horse); tint(foot);
    const jit = new Float32Array(n * 2).map(() => Math.random() - 0.5);
    const m4 = new THREE.Matrix4();
    return {
      meshes: [horse, foot].filter(Boolean) as THREE.InstancedMesh[],
      own: [mat],
      jit,
      place(fn: (i: number, out: THREE.Matrix4) => void) {
        for (let i = 0; i < n; i++) {
          fn(i, m4);
          if (i < nh) horse!.setMatrixAt(i, m4); else foot!.setMatrixAt(i - nh, m4);
        }
        if (horse) horse.instanceMatrix.needsUpdate = true;
        if (foot) foot.instanceMatrix.needsUpdate = true;
      },
      fade(a: number) { mat.opacity = a; },
    };
  }

  /**
   * A pitched battle at a point: side A and side B charge from opposite directions (`angle`: the direction A comes
   * from, degrees clockwise from west), clash amid sparks and smoke, then the loser routs and scatters.
   */
  async clash(o: ClashOpts, layer: Layer = 'story'): Promise<void> {
    const dur = o.dur ?? 6, s = this.s, n = Math.min(60, o.count ?? 28);
    const c = this.geo.pos(o.lon, o.lat, 0);
    const th = ((o.angle ?? 0) * Math.PI) / 180;
    const ax = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)); // from A towards B (x east, z south)
    const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(up, ax).normalize();
    const g = new THREE.Group();
    const it = this.add({ layer, obj: g, own: [] });
    const sides = (['a', 'b'] as const).map((id, si) => {
      const color = si ? o.b : o.a;
      const f = this.formation(n, o.units?.[si] ?? 'foot', color);
      g.add(...f.meshes);
      it.own.push(...f.own);
      const dir = si ? ax.clone().negate() : ax.clone();
      const label = o.labels?.[si] ? this.labels.add({ el: tag(o.labels[si]!, 'army', color), pos: new THREE.Vector3(), prio: 72, group: 'story', anchor: 'above' }) : undefined;
      const fall = new Float32Array(n).map(() => Math.random());
      return { id, f, dir, label, fall, yaw: Math.atan2(dir.x, dir.z) };
    });
    const D = 1.5 * s, gap = 0.085 * s, cols = 8;
    let k = 0;
    const loser = o.winner === 'a' ? 'b' : o.winner === 'b' ? 'a' : null;
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
    let battle: ReturnType<Particles['emitter']> | null = null;
    it.update = (_dt, t) => {
      for (const sd of sides) {
        const charge = Math.min(1, k / 0.35), fight = THREE.MathUtils.clamp((k - 0.35) / 0.35, 0, 1), rout = THREE.MathUtils.clamp((k - 0.7) / 0.3, 0, 1);
        const lost = sd.id === loser, won = loser !== null && !lost;
        // the front line: far away -> touching -> pushed back (loser) / forward (winner)
        let front = THREE.MathUtils.lerp(D, gap * 0.6, charge * charge);
        if (won) front -= rout * D * 0.35;
        if (lost) front += rout * rout * D * 1.4;
        sd.f.place((i, out) => {
          const r = Math.floor(i / cols), cc = (i % cols) - (cols - 1) / 2;
          const melee = fight * (1 - rout) * 0.5;
          const scatter = lost ? rout * (0.6 + sd.fall[i]) : 0;
          v.copy(c).addScaledVector(sd.dir, -(front + r * gap * 1.25 + scatter * gap * 2 * sd.f.jit[i * 2]))
            .addScaledVector(side, (cc + sd.f.jit[i * 2 + 1] * (0.3 + melee + scatter * 3)) * gap);
          v.x += Math.sin(t * 13 + i) * melee * gap * 0.4;
          v.y = Math.max(0, this.geo.height(this.geo.lon(v.x), this.geo.lat(v.z))) + (k < 0.35 || scatter ? Math.abs(Math.sin(t * 10 + i * 1.3)) * 0.01 * s : 0);
          const down = lost && sd.fall[i] < 0.35 ? Math.min(1, rout * 3) : 0;
          e.set(down * Math.PI / 2, sd.yaw + (lost && rout > 0.1 && sd.fall[i] >= 0.35 ? Math.PI : 0), 0, 'YXZ');
          q.setFromEuler(e);
          out.compose(v, q, sc.setScalar(s * 0.11));
        });
        if (lost) sd.f.fade(1 - Math.max(0, rout - 0.6) / 0.4);
        if (sd.label) sd.label.pos.copy(c).addScaledVector(sd.dir, -(front + gap * 3)).setY(c.y + 0.5 * s);
      }
    };
    const ep = this.epoch;
    const gone = () => {
      if (this.items.includes(it) && (layer !== 'story' || ep === this.epoch)) return false;
      for (const sd of sides) if (sd.label) { this.labels.remove(sd.label); sd.label = undefined; }
      return true;
    };
    await this.tween(dur * 0.35, x => { k = x * 0.35; });
    if (gone()) return;
    battle = this.particles.emitter('battle', c.clone().setY(c.y + 0.02), () => this.s);
    this.ring(c.clone().setY(c.y + 0.02), '#ff5a36', dur * 0.4, layer, 0.8);
    await this.tween(dur * 0.35, x => { k = 0.35 + x * 0.35; });
    battle.stop = true;
    if (gone()) return;
    if (loser) this.particles.emitter('smoke', c.clone(), () => this.s);
    await this.tween(dur * 0.3, x => { k = 0.7 + x * 0.3; });
    if (gone()) return;
    for (const sd of sides) if (sd.label && sd.id === loser) { this.labels.remove(sd.label); sd.label = undefined; }
    if (layer === 'story') this.tween(4).then(() => this.tween(0.8, x => { for (const sd of sides) sd.f.fade(1 - x); })).then(() => {
      for (const sd of sides) if (sd.label) this.labels.remove(sd.label);
      this.remove(it);
    });
  }

  /** A fleet sailing a sea route in V formation, leaving wakes. */
  async fleet(o: FleetOpts, layer: Layer = 'story'): Promise<void> {
    const s = this.s, n = Math.min(9, o.count ?? 5);
    const path = this.path(o.pts, 0.02);
    const rb = this.ribbon(path, 0.1 * s, o.color ?? '#1f5f8b', 0.5);
    const g = new THREE.Group();
    g.add(rb.mesh);
    const it = this.add({ layer, obj: g, own: [rb.mesh.geometry, rb.mat] });
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
      const z = Math.min(scale, s * 1.4), gap = 0.42 * z;
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
        sh.m.scale.setScalar(z * 0.8);
        animate(sh.rigs, t);
        sh.wake.p.copy(sh.m.position).addScaledVector(a.dir, -0.3 * z);
        sh.wake.k = sailing ? 1 : 0.2;
      });
      if (it.label) it.label.pos.copy(hd.pos).setY(0.6 * z);
    };
    if (o.follow) this.followWith(() => tmp);
    await this.tween(o.dur, x => { k = x; rb.reveal(x); });
    sailing = false;
    if (o.follow) this.followWith(null);
    if (layer === 'story' && !o.keep) this.tween(3).then(() => { for (const sh of ships) if (sh) sh.wake.stop = true; return this.tween(0.8, x => { rb.mat.opacity = 0.5 * (1 - x); }); }).then(() => this.remove(it));
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
  async spawn(o: { lon: number; lat: number; model: ModelRecipe; scale?: number; label?: string; labelClass?: string; yaw?: number }, layer: Layer = 'story'): Promise<THREE.Object3D | null> {
    const g = new THREE.Group();
    const base = this.geo.pos(o.lon, o.lat, 0);
    if (!this.geo.isLand(o.lon, o.lat)) base.y = Math.max(-0.02, this.geo.height(o.lon, o.lat));
    g.position.copy(base);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }));
    sh.position.y = 0.006;
    sh.renderOrder = 2;
    g.add(sh);
    const it = this.add({ layer, obj: g, own: [sh.geometry, sh.material as THREE.Material] });
    if (o.label) it.label = this.labels.add({ el: tag(o.label, o.labelClass ?? 'model'), pos: base.clone(), prio: 80, group: layer === 'base' ? 'base' : 'story', anchor: 'above' });
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
    it.update = (_dt, t, sc) => {
      const z = sc * k0 * (layer === 'base' ? 0.7 : 1);
      const e = easeBack(grow);
      m.scale.setScalar(Math.max(0.001, z * e));
      sh.scale.setScalar(Math.max(0.001, z * r * 2.6 * Math.min(1, grow * 2)));
      animate(rigs, t, seed);
      if (it.label) it.label.pos.set(base.x, base.y + h * z * e + 0.05 * z, base.z);
    };
    it.update(0, 0, this.s);
    // the rise uses real time when paused so selected-event models still appear
    const start = performance.now();
    const step = () => {
      grow = Math.min(1, (performance.now() - start) / 700);
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
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 5;
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

// ---------------------------------------------------------------- particles

type EmitKind = Exclude<FxKind, 'flag' | 'glow'> | 'dust' | 'wake';
interface Emitter { kind: EmitKind; p: THREE.Vector3; scale: () => number; color?: string; acc: number; k: number; stop: boolean; age: number }

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
