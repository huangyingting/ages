import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LonLat, ModelRecipe } from '../../shared/data/types.ts';
import { instance } from '../models/library.ts';
import { animate, rig } from './animate.ts';
import type { Geo } from './geo.ts';
import type { Label, Labels } from './labels.ts';
import type { View } from './view.ts';

export type FxKind = 'battle' | 'fire' | 'glow' | 'flag' | 'smoke' | 'firework';
export type Layer = 'story' | 'event' | 'base' | 'works';

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
      const tw = this.tweens.splice(0);
      for (const x of tw) x.done();
      this.particles.clear();
    }
  }

  /** Completes all running tweens at once (story "skip"). */
  finishTweens(): void {
    for (const x of this.tweens.splice(0)) { x.fn(1); x.done(); }
  }

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

  /** A marching army: a big campaign arrow plus a formation of soldiers and a banner moving along it. */
  async army(o: { from: LonLat; to: LonLat; color: string; dur: number; count?: number }, layer: Layer = 'story'): Promise<void> {
    const s = this.s;
    const [a, b] = [o.from, o.to];
    // bow the route a little to the left so opposing arrows don't overlap
    const mid: LonLat = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * 0.12, (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.12];
    const pts: LonLat[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      pts.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mid[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * mid[1] + u * u * b[1]]);
    }
    const path = this.path(pts, 0.035);
    const rb = this.ribbon(path, 0.3 * s, o.color, 0.72, true);
    const head = this.arrowHead(o.color, 0.6 * s);
    const n = Math.min(60, o.count ?? 24);
    const geo = soldierGeometry();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, flatShading: true });
    const troops = new THREE.InstancedMesh(geo, mat, n);
    const col = new THREE.Color(o.color);
    for (let i = 0; i < n; i++) troops.setColorAt(i, col.clone().offsetHSL(0, 0, (i % 3) * 0.05 - 0.05));
    const g = new THREE.Group();
    g.add(rb.mesh, head, troops);
    const it = this.add({ layer, obj: g, own: [rb.mesh.geometry, rb.mat, head.geometry, head.material as THREE.Material, mat] });
    let banner: THREE.Object3D | null = null, rigs: ReturnType<typeof rig> = [];
    instance({ kind: 'flag', color: o.color }, true).then(m => { if (this.items.includes(it)) { banner = m; rigs = rig(m); g.add(m); } }).catch(() => {});
    let k = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    it.update = (_dt, t, scale) => {
      const z = Math.min(scale, s * 1.5);
      const hd = this.at(path, k, tmp);
      head.position.copy(hd.pos).setY(hd.pos.y + 0.012);
      head.rotation.y = Math.atan2(hd.dir.x, hd.dir.z);
      const yaw = Math.atan2(hd.dir.x, hd.dir.z);
      q.setFromAxisAngle(up, yaw);
      const side = new THREE.Vector3().crossVectors(up, hd.dir).normalize();
      const cols = 6, gap = 0.075 * z;
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols), c = (i % cols) - (cols - 1) / 2;
        const back = (r + 1) * gap * 1.2;
        const kk = Math.max(0, k - back / path.total);
        const p = this.at(path, kk, v).pos;
        p.addScaledVector(side, c * gap);
        p.y = Math.max(0, this.geo.height(this.geo.lon(p.x), this.geo.lat(p.z))) + Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.012 * z;
        troops.setMatrixAt(i, m4.compose(p, q, sc.setScalar(z * 0.11)));
      }
      troops.instanceMatrix.needsUpdate = true;
      if (banner) {
        banner.position.copy(hd.pos).addScaledVector(hd.dir, -gap);
        banner.scale.setScalar(z * 0.35);
        banner.rotation.y = yaw - Math.PI / 2;
        animate(rigs, t);
      }
    };
    await this.tween(o.dur, x => { k = x; rb.reveal(x); });
    rb.reveal(1);
    if (layer === 'story') this.tween(3).then(() => this.tween(0.8, x => { rb.mat.opacity = 0.72 * (1 - x); })).then(() => this.remove(it));
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

function tag(text: string, cls: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `tag tag-${cls}`;
  el.textContent = text;
  return el;
}

let soldier: THREE.BufferGeometry | null = null;
function soldierGeometry(): THREE.BufferGeometry {
  if (soldier) return soldier;
  const body = new THREE.CylinderGeometry(0.14, 0.2, 0.55, 6).translate(0, 0.28, 0);
  const head = new THREE.SphereGeometry(0.12, 6, 4).translate(0, 0.66, 0);
  const spear = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4).translate(0.2, 0.5, 0.05);
  const shield = new THREE.BoxGeometry(0.06, 0.3, 0.24).translate(-0.2, 0.35, 0.05);
  for (const g of [body, head, spear, shield]) g.deleteAttribute('uv');
  soldier = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), spear.toNonIndexed(), shield.toNonIndexed()])!;
  return soldier;
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

interface Emitter { kind: Exclude<FxKind, 'flag' | 'glow'>; p: THREE.Vector3; scale: () => number; color?: string; acc: number; k: number; stop: boolean; age: number }

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

  emitter(kind: FxKind, p: THREE.Vector3, scale: () => number, color?: string): Emitter {
    const e: Emitter = { kind: kind as Emitter['kind'], p: p.clone(), scale, color, acc: 0, k: 0, stop: false, age: 0 };
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
